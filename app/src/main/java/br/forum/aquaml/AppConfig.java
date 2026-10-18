package br.forum.aquaml;

import java.nio.file.Files;
import java.nio.file.Path;

/** Caminhos do projeto, banco H2, Llama e executáveis de cada etapa do pipeline. */
public record AppConfig(Path root, int port, String dbUrl, String ollamaUrl, String llamaModel) {

    public static final String DEFAULT_OLLAMA_URL = "http://localhost:11434";
    public static final String DEFAULT_LLAMA_MODEL = "llama3.2";

    /** Configuração com o banco em arquivo dentro de {@code root} e o Llama local padrão. */
    public AppConfig(Path root, int port) {
        this(root, port, fileDbUrl(root), DEFAULT_OLLAMA_URL, DEFAULT_LLAMA_MODEL);
    }

    public Path rawDir() { return root.resolve("data/raw"); }
    public Path processedDir() { return root.resolve("data/processed"); }
    public Path resultsFile() { return root.resolve("data/results/results.json"); }
    public Path processorBin() { return root.resolve("processor/target/release/aqua-processor"); }
    public Path python() { return root.resolve("ml/.venv/bin/python"); }
    public Path mlDir() { return root.resolve("ml"); }

    /** AUTO_SERVER permite abrir o mesmo banco no console do H2 com o app no ar. */
    static String fileDbUrl(Path root) {
        return "jdbc:h2:file:" + root.resolve("data/db/aquaml").toAbsolutePath() + ";AUTO_SERVER=TRUE";
    }

    /**
     * Raiz do projeto: variável AQUAML_ROOT ou, na falta dela, o primeiro
     * diretório (a partir do atual, subindo) que contenha processor/ e ml/.
     * AQUAML_DB_URL, OLLAMA_URL e LLAMA_MODEL sobrescrevem os padrões.
     */
    public static AppConfig fromEnvironment() {
        var env = System.getenv();
        int port = Integer.parseInt(env.getOrDefault("PORT", "7070"));
        Path root = findRoot(env.get("AQUAML_ROOT"));
        String db = env.getOrDefault("AQUAML_DB_URL", "");
        return new AppConfig(root, port,
                db.isBlank() ? fileDbUrl(root) : db,
                env.getOrDefault("OLLAMA_URL", DEFAULT_OLLAMA_URL),
                env.getOrDefault("LLAMA_MODEL", DEFAULT_LLAMA_MODEL));
    }

    private static Path findRoot(String env) {
        if (env != null && !env.isBlank()) {
            return Path.of(env).toAbsolutePath().normalize();
        }
        Path dir = Path.of("").toAbsolutePath();
        while (dir != null) {
            if (Files.isDirectory(dir.resolve("processor")) && Files.isDirectory(dir.resolve("ml"))) {
                return dir;
            }
            dir = dir.getParent();
        }
        throw new IllegalStateException("Raiz do projeto não encontrada; defina AQUAML_ROOT");
    }
}
