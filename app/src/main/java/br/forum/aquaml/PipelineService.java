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
 * Orquestra as etapas do pipeline: carga dos dados de sensores no H2 (importados
 * de CSV), processamento (Rust), análise com IA/ML (Python) e gravação da análise no H2. Executa em segundo plano, uma
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
     * Reexecuta a análise sobre os dados de sensores guardados no H2. Sem dados, a execução termina com uma mensagem
     * explicando como trazê-los. Retorna false se já houver uma execução em andamento.
     */
    public synchronized boolean start() {
        return launch(steps -> {
            if (db.measurementCount() == 0) {
                throw new IllegalStateException("Não há leituras de sensores para analisar. Importe uma planilha CSV em Meus dados.");
            }
        });
    }

    /** Apaga os dados de sensores e as análises. Imagens, anotações e conversas continuam. Falso se houver execução em curso. */
    public synchronized boolean clearData() {
        if (status.running()) {
            return false;
        }
        db.clearDataset();
        repository.clear();
        for (Path dir : List.of(config.rawDir(), config.processedDir())) {
            try (var files = Files.list(dir)) {
                files.filter(f -> f.toString().endsWith(".csv")).forEach(f -> f.toFile().delete());
            } catch (IOException ignored) {
                // Pasta inexistente: nada a limpar.
            }
        }
        config.resultsFile().toFile().delete();
        status = new Status(false, null, null, List.of(), null);
        return true;
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
