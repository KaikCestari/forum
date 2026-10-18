package br.forum.aquaml;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/**
 * Orquestra as etapas do pipeline: carga dos dados no H2 (sintéticos gerados
 * pelo Python ou reais importados de CSV), processamento (Rust), análise com
 * IA/ML (Python) e gravação da análise no H2. Executa em segundo plano, uma
 * execução por vez, e expõe o andamento para o painel.
 */
public class PipelineService {

    private static final Logger log = LoggerFactory.getLogger(PipelineService.class);
    private static final long STEP_TIMEOUT_MIN = 10;

    public record Step(String name, String language, List<String> command, String status,
                       long durationMs, String output) {}

    public record Status(boolean running, String startedAt, String finishedAt,
                         List<Step> steps, String error) {}

    /** Preparação dos dados que antecede o processamento. */
    @FunctionalInterface
    private interface Prepare {
        void run(List<Step> steps) throws Exception;
    }

    @FunctionalInterface
    private interface JavaWork {
        String run() throws Exception;
    }

    private final AppConfig config;
    private final ResultsRepository repository;
    private final Database db;
    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "pipeline");
        t.setDaemon(true);
        return t;
    });
    private volatile Status status = new Status(false, null, null, List.of(), null);

    public PipelineService(AppConfig config, ResultsRepository repository, Database db) {
        this.config = config;
        this.repository = repository;
        this.db = db;
    }

    public Status status() {
        return status;
    }

    /**
     * Inicia uma execução sobre os dados do H2. Com {@code regenerate} (ou com o
     * banco vazio), gera um novo conjunto sintético com a semente informada e o
     * grava no banco. Retorna false se já houver uma execução em andamento.
     */
    public synchronized boolean start(boolean regenerate, Long seed) {
        return launch(steps -> {
            if (regenerate || db.measurementCount() == 0) {
                loadSynthetic(steps, regenerate, seed);
            }
        });
    }

    /** Substitui os dados do H2 por dados reais e reexecuta toda a análise. */
    public synchronized boolean startImport(String name, List<Database.Station> stations,
                                            List<Database.Measurement> measurements, List<Database.Event> events) {
        return launch(steps -> javaStep(steps, "Importação de dados reais para o H2", () -> {
            db.replaceDataset("real", name, stations, measurements, events);
            return measurements.size() + " leituras de " + stations.size() + " estações gravadas no H2";
        }));
    }

    private boolean launch(Prepare prepare) {
        if (status.running()) {
            return false;
        }
        status = new Status(true, Instant.now().toString(), null, List.of(), null);
        executor.submit(() -> run(prepare));
        return true;
    }

    private void run(Prepare prepare) {
        List<Step> steps = new ArrayList<>();
        String error = null;
        try {
            prepare.run(steps);
            javaStep(steps, "Exportação do H2 para o processador", () -> {
                db.exportCsv(config.rawDir());
                return db.measurementCount() + " leituras exportadas de " + config.rawDir().getFileName();
            });
            execute(steps, "Processamento e cálculo do IQA", "Rust", List.of(
                    config.processorBin().toString(),
                    "--input", config.rawDir().resolve("measurements.csv").toString(),
                    "--out", config.processedDir().toString()));
            execute(steps, "Análise com IA/ML", "Python", List.of(
                    config.python().toString(), "analyze.py",
                    "--processed", config.processedDir().toString(),
                    "--raw", config.rawDir().toString(),
                    "--out", config.resultsFile().toString()));
            javaStep(steps, "Gravação dos resultados no H2", () -> {
                var results = repository.readFile();
                long id = db.saveRun(results);
                repository.set(results);
                return "análise nº " + id + " gravada com " + results.path("alerts").size() + " alertas";
            });
        } catch (Exception e) {
            error = e.getMessage();
            log.error("Falha no pipeline", e);
        }
        status = new Status(false, status.startedAt(), Instant.now().toString(), List.copyOf(steps), error);
    }

    /**
     * Gera dados sintéticos (ou reaproveita os CSVs de data/raw, se o banco
     * estiver vazio) e os grava no H2.
     */
    private void loadSynthetic(List<Step> steps, boolean regenerate, Long seed) throws Exception {
        Path raw = config.rawDir();
        boolean generated = regenerate || !Files.exists(raw.resolve("measurements.csv"));
        if (generated) {
            List<String> cmd = new ArrayList<>(List.of(config.python().toString(), "generate_data.py",
                    "--out", raw.toString()));
            if (seed != null) {
                cmd.addAll(List.of("--seed", seed.toString()));
            }
            execute(steps, "Geração de dados sintéticos", "Python", cmd);
        }
        javaStep(steps, "Carga dos dados no H2", () -> {
            List<Database.Station> stations;
            CsvImport.Parsed parsed;
            List<Database.Event> events = List.of();
            try (var r = Files.newBufferedReader(raw.resolve("stations.csv"))) {
                stations = CsvImport.stations(r);
            }
            try (var r = Files.newBufferedReader(raw.resolve("measurements.csv"))) {
                parsed = CsvImport.measurements(r);
            }
            if (Files.exists(raw.resolve("events.csv"))) {
                try (var r = Files.newBufferedReader(raw.resolve("events.csv"))) {
                    events = CsvImport.events(r);
                }
            }
            // Sem events.csv, os arquivos não vieram do gerador: tratamos como dados reais.
            boolean synthetic = generated || !events.isEmpty();
            db.replaceDataset(synthetic ? "sintetico" : "real",
                    synthetic ? "Bacia sintética" + (seed != null ? " (semente " + seed + ")" : "") : "Arquivos de data/raw",
                    stations, parsed.measurements(), events);
            return parsed.measurements().size() + " leituras de " + stations.size() + " estações gravadas no H2";
        });
    }

    private void javaStep(List<Step> steps, String name, JavaWork work) throws Exception {
        log.info("[Java/H2] {}", name);
        long t0 = System.nanoTime();
        steps.add(new Step(name, "Java", List.of(), "executando", 0, ""));
        status = new Status(true, status.startedAt(), null, List.copyOf(steps), null);
        try {
            String out = work.run();
            steps.set(steps.size() - 1, new Step(name, "Java", List.of(), "ok", (System.nanoTime() - t0) / 1_000_000, out));
        } catch (Exception e) {
            steps.set(steps.size() - 1, new Step(name, "Java", List.of(), "erro",
                    (System.nanoTime() - t0) / 1_000_000, String.valueOf(e.getMessage())));
            throw new IOException(name + " falhou: " + e.getMessage(), e);
        } finally {
            status = new Status(true, status.startedAt(), null, List.copyOf(steps), null);
        }
    }

    private void execute(List<Step> steps, String name, String language, List<String> command)
            throws IOException, InterruptedException {
        log.info("[{}] {}", language, name);
        long t0 = System.nanoTime();
        steps.add(new Step(name, language, command, "executando", 0, ""));
        status = new Status(true, status.startedAt(), null, List.copyOf(steps), null);

        Process p = new ProcessBuilder(command)
                .directory(config.mlDir().toFile())
                .redirectErrorStream(true)
                .start();
        String output = new String(p.getInputStream().readAllBytes(), StandardCharsets.UTF_8).strip();
        boolean finished = p.waitFor(STEP_TIMEOUT_MIN, TimeUnit.MINUTES);
        long ms = (System.nanoTime() - t0) / 1_000_000;
        boolean ok = finished && p.exitValue() == 0;
        steps.set(steps.size() - 1, new Step(name, language, command, ok ? "ok" : "erro", ms, tail(output)));
        status = new Status(true, status.startedAt(), null, List.copyOf(steps), null);
        if (!ok) {
            p.destroyForcibly();
            throw new IOException(name + " falhou: " + tail(output));
        }
    }

    private static String tail(String s) {
        String[] lines = s.split("\n");
        return String.join("\n", List.of(lines).subList(Math.max(0, lines.length - 8), lines.length));
    }
}
