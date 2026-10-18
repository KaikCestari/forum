package br.forum.aquaml;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/**
 * Orquestra as etapas do pipeline: geração de dados (Python), processamento
 * (Rust) e análise com IA/ML (Python). Executa em segundo plano, uma
 * execução por vez, e expõe o andamento para o painel.
 */
public class PipelineService {

    private static final Logger log = LoggerFactory.getLogger(PipelineService.class);
    private static final long STEP_TIMEOUT_MIN = 10;

    public record Step(String name, String language, List<String> command, String status,
                       long durationMs, String output) {}

    public record Status(boolean running, String startedAt, String finishedAt,
                         List<Step> steps, String error) {}

    private final AppConfig config;
    private final ResultsRepository repository;
    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "pipeline");
        t.setDaemon(true);
        return t;
    });
    private volatile Status status = new Status(false, null, null, List.of(), null);

    public PipelineService(AppConfig config, ResultsRepository repository) {
        this.config = config;
        this.repository = repository;
    }

    public Status status() {
        return status;
    }

    /**
     * Inicia uma execução. Com {@code regenerate} (ou sem dados brutos), gera um
     * novo conjunto sintético com a semente informada. Retorna false se já houver
     * uma execução em andamento.
     */
    public synchronized boolean start(boolean regenerate, Long seed) {
        if (status.running()) {
            return false;
        }
        status = new Status(true, Instant.now().toString(), null, List.of(), null);
        executor.submit(() -> run(regenerate, seed));
        return true;
    }

    private void run(boolean regenerate, Long seed) {
        List<Step> steps = new ArrayList<>();
        String error = null;
        try {
            if (regenerate || !Files.exists(config.rawDir().resolve("measurements.csv"))) {
                List<String> cmd = new ArrayList<>(List.of(config.python().toString(), "generate_data.py",
                        "--out", config.rawDir().toString()));
                if (seed != null) {
                    cmd.addAll(List.of("--seed", seed.toString()));
                }
                execute(steps, "Geração de dados sintéticos", "Python", cmd);
            }
            execute(steps, "Processamento e cálculo do IQA", "Rust", List.of(
                    config.processorBin().toString(),
                    "--input", config.rawDir().resolve("measurements.csv").toString(),
                    "--out", config.processedDir().toString()));
            execute(steps, "Análise com IA/ML", "Python", List.of(
                    config.python().toString(), "analyze.py",
                    "--processed", config.processedDir().toString(),
                    "--raw", config.rawDir().toString(),
                    "--out", config.resultsFile().toString()));
            repository.reload();
        } catch (Exception e) {
            error = e.getMessage();
            log.error("Falha no pipeline", e);
        }
        status = new Status(false, status.startedAt(), Instant.now().toString(), List.copyOf(steps), error);
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
