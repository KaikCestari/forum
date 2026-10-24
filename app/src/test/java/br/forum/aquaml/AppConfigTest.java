package br.forum.aquaml;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AppConfigTest {

    private static final String KEY = "abc123.segredo";

    @Test
    void dotenvIgnoraComentariosEAceitaAspas(@TempDir Path tmp) throws Exception {
        Path env = tmp.resolve(".env");
        Files.writeString(env, "# comentário\n\nOLLAMA_API_KEY=\"abc.def\"\nLLAMA_MODEL = gpt-oss:20b\nsem igual\n");
        Map<String, String> read = AppConfig.readDotenv(env);
        assertEquals("abc.def", read.get("OLLAMA_API_KEY"));
        assertEquals("gpt-oss:20b", read.get("LLAMA_MODEL"));
        assertEquals(2, read.size());
        assertTrue(AppConfig.readDotenv(tmp.resolve("nao-existe")).isEmpty());
    }

    @Test
    void configNaoMostraAChaveNoToString(@TempDir Path tmp) {
        var cfg = new AppConfig(tmp, 7070, List.of(), "jdbc:h2:mem:x", "https://ollama.com", "gpt-oss:20b", KEY, "gemma4:31b");
        assertFalse(cfg.toString().contains(KEY));
    }

    /** A chave vai no cabeçalho Bearer, em /api/tags e em /api/chat, e não aparece nos erros. */
    @Test
    void llamaClientEnviaAChaveEEscondeEmErros() throws Exception {
        AtomicReference<String> auth = new AtomicReference<>();
        HttpServer s = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        s.createContext("/api/tags", ex -> {
            auth.set(ex.getRequestHeaders().getFirst("Authorization"));
            byte[] b = "{\"models\":[{\"name\":\"gpt-oss:20b\"}]}".getBytes(StandardCharsets.UTF_8);
            ex.sendResponseHeaders(200, b.length);
            ex.getResponseBody().write(b);
            ex.close();
        });
        s.createContext("/api/chat", ex -> {
            byte[] b = ("{\"error\":\"unauthorized " + KEY + " /srv/private/.env\"}").getBytes(StandardCharsets.UTF_8);
            ex.sendResponseHeaders(401, b.length);
            ex.getResponseBody().write(b);
            ex.close();
        });
        s.start();
        try {
            var client = new LlamaClient("http://localhost:" + s.getAddress().getPort(), "gpt-oss:20b", KEY);
            assertTrue(client.status().modelInstalled());
            assertEquals("Bearer " + KEY, auth.get());
            IOException e = assertThrows(IOException.class, () -> client.chat(List.of(new LlamaClient.Message("user", "oi"))));
            assertTrue(e.getMessage().contains("401"));
            assertFalse(e.getMessage().contains(KEY));
            assertFalse(e.getMessage().contains(".env"));

            var semChave = new LlamaClient("http://localhost:" + s.getAddress().getPort(), "gpt-oss:20b");
            auth.set(null);
            semChave.status();
            assertNull(auth.get());
        } finally {
            s.stop(0);
        }
    }
}
