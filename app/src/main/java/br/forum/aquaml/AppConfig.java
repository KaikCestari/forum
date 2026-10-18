package br.forum.aquaml;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;

/**
 * Caminhos do projeto, porta da API e origens autorizadas (CORS) para o
 * front-end React, que roda separado.
 */
public record AppConfig(Path root, int port, List<String> corsOrigins) {

    static final String DEFAULT_ORIGINS = "http://localhost:5173,http://localhost:4173";

    public Path rawDir() { return root.resolve("data/raw"); }
    public Path processedDir() { return root.resolve("data/processed"); }
    public Path resultsFile() { return root.resolve("data/results/results.json"); }
    public Path processorBin() { return root.resolve("processor/target/release/aqua-processor"); }
    public Path python() { return root.resolve("ml/.venv/bin/python"); }
    public Path mlDir() { return root.resolve("ml"); }

    /**
     * Raiz do projeto: variável AQUAML_ROOT ou, na falta dela, o primeiro
     * diretório (a partir do atual, subindo) que contenha processor/ e ml/.
     * Origens CORS: AQUAML_CORS_ORIGINS, separadas por vírgula.
     */
    public static AppConfig fromEnvironment() {
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "7070"));
        List<String> origins = parseOrigins(System.getenv().getOrDefault("AQUAML_CORS_ORIGINS", DEFAULT_ORIGINS));
        String env = System.getenv("AQUAML_ROOT");
        if (env != null && !env.isBlank()) {
            return new AppConfig(Path.of(env).toAbsolutePath().normalize(), port, origins);
        }
        Path dir = Path.of("").toAbsolutePath();
        while (dir != null) {
            if (Files.isDirectory(dir.resolve("processor")) && Files.isDirectory(dir.resolve("ml"))) {
                return new AppConfig(dir, port, origins);
            }
            dir = dir.getParent();
        }
        throw new IllegalStateException("Raiz do projeto não encontrada; defina AQUAML_ROOT");
    }

    static List<String> parseOrigins(String value) {
        return Arrays.stream(value.split(","))
                .map(String::strip)
                .filter(s -> !s.isEmpty())
                .toList();
    }
}
