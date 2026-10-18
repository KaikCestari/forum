package br.forum.aquaml;

import java.nio.file.Files;
import java.nio.file.Path;

/** Caminhos do projeto e dos executáveis de cada etapa do pipeline. */
public record AppConfig(Path root, int port) {

    public Path rawDir() { return root.resolve("data/raw"); }
    public Path processedDir() { return root.resolve("data/processed"); }
    public Path resultsFile() { return root.resolve("data/results/results.json"); }
    public Path processorBin() { return root.resolve("processor/target/release/aqua-processor"); }
    public Path python() { return root.resolve("ml/.venv/bin/python"); }
    public Path mlDir() { return root.resolve("ml"); }

    /**
     * Raiz do projeto: variável AQUAML_ROOT ou, na falta dela, o primeiro
     * diretório (a partir do atual, subindo) que contenha processor/ e ml/.
     */
    public static AppConfig fromEnvironment() {
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "7070"));
        String env = System.getenv("AQUAML_ROOT");
        if (env != null && !env.isBlank()) {
            return new AppConfig(Path.of(env).toAbsolutePath().normalize(), port);
        }
        Path dir = Path.of("").toAbsolutePath();
        while (dir != null) {
            if (Files.isDirectory(dir.resolve("processor")) && Files.isDirectory(dir.resolve("ml"))) {
                return new AppConfig(dir, port);
            }
            dir = dir.getParent();
        }
        throw new IllegalStateException("Raiz do projeto não encontrada; defina AQUAML_ROOT");
    }
}
