package br.forum.aquaml;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Caminhos do projeto, porta da API, origens autorizadas (CORS) para o
 * front-end React, que roda separado, banco H2 e Llama.
 */
public record AppConfig(Path root, int port, List<String> corsOrigins, String dbUrl, String ollamaUrl,
                        String llamaModel, String ollamaApiKey, String visionModel) {

    static final String DEFAULT_ORIGINS = "http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173,http://127.0.0.1:4173";
    public static final String DEFAULT_OLLAMA_URL = "http://localhost:11434";
    public static final String DEFAULT_LLAMA_MODEL = "llama3.2";
    /** Modelo com visão usado para ler fotos e imagens de satélite. */
    public static final String DEFAULT_VISION_MODEL = "gemma4:31b";

    /** Ollama sem chave, o caso do servidor local. */
    public AppConfig(Path root, int port, List<String> corsOrigins, String dbUrl, String ollamaUrl, String llamaModel) {
        this(root, port, corsOrigins, dbUrl, ollamaUrl, llamaModel, "", DEFAULT_VISION_MODEL);
    }

    public Path imagesDir() { return root.resolve("data/images"); }

    /** Configuração com o banco em arquivo dentro de {@code root} e o Llama local padrão. */
    public AppConfig(Path root, int port, List<String> corsOrigins) {
        this(root, port, corsOrigins, fileDbUrl(root), DEFAULT_OLLAMA_URL, DEFAULT_LLAMA_MODEL);
    }

    /** Sem a chave: um record imprime todos os campos, e um log não pode vazá-la. */
    @Override
    public String toString() {
        return "AppConfig[root=" + root + ", port=" + port + ", ollamaUrl=" + ollamaUrl + "]";
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
     * Origens CORS: AQUAML_CORS_ORIGINS, separadas por vírgula.
     * AQUAML_DB_URL, OLLAMA_URL e LLAMA_MODEL sobrescrevem os padrões.
     * OLLAMA_API_KEY, com OLLAMA_URL=https://ollama.com, usa os modelos da nuvem do Ollama.
     * VISION_MODEL escolhe o modelo que lê fotos e imagens de satélite.
     * Os valores também podem vir de um arquivo {@code .env} na raiz; as variáveis
     * de ambiente de verdade têm precedência.
     */
    public static AppConfig fromEnvironment() {
        var real = System.getenv();
        Path root = findRoot(real.get("AQUAML_ROOT"));
        Map<String, String> env = new HashMap<>(readDotenv(root.resolve(".env")));
        env.putAll(real);
        int port = Integer.parseInt(env.getOrDefault("PORT", "7070"));
        List<String> origins = parseOrigins(env.getOrDefault("AQUAML_CORS_ORIGINS", DEFAULT_ORIGINS));
        String db = env.getOrDefault("AQUAML_DB_URL", "");
        return new AppConfig(root, port, origins,
                db.isBlank() ? fileDbUrl(root) : db,
                env.getOrDefault("OLLAMA_URL", DEFAULT_OLLAMA_URL),
                env.getOrDefault("LLAMA_MODEL", DEFAULT_LLAMA_MODEL),
                env.getOrDefault("OLLAMA_API_KEY", "").strip(),
                env.getOrDefault("VISION_MODEL", DEFAULT_VISION_MODEL).strip());
    }

    /** Lê linhas CHAVE=valor, ignorando comentários e linhas vazias; sem o arquivo, devolve vazio. */
    static Map<String, String> readDotenv(Path file) {
        Map<String, String> out = new HashMap<>();
        if (!Files.isRegularFile(file)) {
            return out;
        }
        try {
            for (String line : Files.readAllLines(file)) {
                String t = line.strip();
                int eq = t.indexOf('=');
                if (t.isEmpty() || t.startsWith("#") || eq <= 0) {
                    continue;
                }
                String value = t.substring(eq + 1).strip();
                if (value.length() >= 2 && (value.startsWith("\"") && value.endsWith("\"")
                        || value.startsWith("'") && value.endsWith("'"))) {
                    value = value.substring(1, value.length() - 1);
                }
                out.put(t.substring(0, eq).strip(), value);
            }
        } catch (IOException e) {
            throw new IllegalStateException("Não foi possível ler " + file + ": " + e.getMessage(), e);
        }
        return out;
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

    static List<String> parseOrigins(String value) {
        return Arrays.stream(value.split(","))
                .map(String::strip)
                .filter(s -> !s.isEmpty())
                .toList();
    }
}
