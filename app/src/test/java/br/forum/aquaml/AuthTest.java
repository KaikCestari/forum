package br.forum.aquaml;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.javalin.Javalin;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.net.CookieManager;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class AuthTest {
    @TempDir Path tmp;
    private Database db;
    private Javalin app;
    private final ObjectMapper json = new ObjectMapper();
    private final CookieManager cookies = new CookieManager();
    private final HttpClient http = HttpClient.newBuilder().cookieHandler(cookies).build();
    private static final String ORIGIN = "http://localhost:5173";
    private static final String ACCOUNT = """
            {"name":"Ana Bióloga","email":"ANA@example.test","password":"Uma frase de teste 123"}""";

    @BeforeEach void start() {
        db = new Database("jdbc:h2:mem:" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1");
        var config = new AppConfig(tmp, 0, List.of(ORIGIN), "unused", "http://localhost:9", "test");
        var repo = new ResultsRepository(tmp.resolve("results.json"));
        var llama = new LlamaClient("http://localhost:9", "test");
        app = Main.createApp(repo, new PipelineService(config, repo, db), db,
                new AssistantService(llama, repo, db), new ImageService(db, llama, tmp.resolve("images"), "test"), List.of(ORIGIN)).start(0);
    }
    @AfterEach void stop() { app.stop(); db.close(); }

    private HttpResponse<String> request(String method, String path, String body, String... headers) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://localhost:" + app.port() + path))
                .method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body));
        if (body != null) builder.header("Content-Type", "application/json");
        for (int i = 0; i < headers.length; i += 2) builder.header(headers[i], headers[i + 1]);
        return http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }
    private JsonNode register() throws Exception {
        var response = request("POST", "/api/auth/register", ACCOUNT, "Origin", ORIGIN);
        assertEquals(201, response.statusCode(), response.body());
        return json.readTree(response.body());
    }

    @Test void protectsEveryDataRouteAndReturnsAnonymousSession() throws Exception {
        var session = request("GET", "/api/auth/session", null);
        assertTrue(json.readTree(session.body()).get("user").isNull());
        assertEquals("no-store", session.headers().firstValue("Cache-Control").orElseThrow());
        for (String path : List.of("/api/overview", "/api/points", "/api/images", "/api/images/1/file", "/api/notes", "/api/db/summary", "/api/assistant/history"))
            assertEquals(401, request("GET", path, null).statusCode(), path);
        assertEquals(401, request("DELETE", "/api/data", null).statusCode());
    }

    @Test void registrationCreatesPersistentHashedAccountAndHttpOnlySession() throws Exception {
        var response = request("POST", "/api/auth/register", ACCOUNT);
        assertEquals(201, response.statusCode(), response.body());
        var body = json.readTree(response.body());
        assertEquals("ana@example.test", body.at("/user/email").asText());
        assertEquals("Ana Bióloga", body.at("/user/name").asText());
        assertFalse(response.body().contains("password"));
        String cookie = response.headers().firstValue("Set-Cookie").orElseThrow();
        assertTrue(cookie.toLowerCase().contains("httponly"));
        assertTrue(cookie.toLowerCase().contains("samesite=lax"));
        assertFalse(cookie.toLowerCase().contains("max-age"));
        var stored = db.accountByEmail("ana@example.test").orElseThrow();
        assertTrue(stored.passwordHash().startsWith("pbkdf2-sha256$600000$"));
        assertTrue(AuthService.verifyPassword("Uma frase de teste 123", stored.passwordHash()));
        assertFalse(AuthService.verifyPassword("outra senha", stored.passwordHash()));
        assertEquals(body, json.readTree(request("GET", "/api/auth/session", null).body()));
        assertEquals(200, request("GET", "/api/points", null).statusCode());
        assertEquals(409, request("POST", "/api/auth/register", ACCOUNT).statusCode());
    }

    @Test void validatesRegistrationAndRejectsCrossOriginLoginAndNonJson() throws Exception {
        assertEquals(400, request("POST", "/api/auth/register", ACCOUNT.replace("ANA@example.test", "sem-email")).statusCode());
        assertEquals(400, request("POST", "/api/auth/register", ACCOUNT.replace("Uma frase de teste 123", "curta")).statusCode());
        assertEquals(400, request("POST", "/api/auth/register", ACCOUNT.replace("Ana Bióloga", " ")).statusCode());
        assertEquals(400, request("POST", "/api/auth/register", "{invalid").statusCode());
        assertEquals(403, request("POST", "/api/auth/register", ACCOUNT, "Origin", "https://evil.example").statusCode());
        assertEquals(403, request("POST", "/api/auth/login", null).statusCode());
    }

    @Test void loginUsesGenericErrorsAndRotatesSession() throws Exception {
        register();
        String first = cookies.getCookieStore().getCookies().getFirst().getValue();
        String wrong = "{\"email\":\"ana@example.test\",\"password\":\"senha incorreta\"}";
        var existing = request("POST", "/api/auth/login", wrong);
        var missing = request("POST", "/api/auth/login", wrong.replace("ana@", "missing@"));
        assertEquals(401, existing.statusCode());
        assertEquals(existing.body(), missing.body());
        var correct = request("POST", "/api/auth/login", ACCOUNT);
        assertEquals(200, correct.statusCode());
        assertNotEquals(first, cookies.getCookieStore().getCookies().getFirst().getValue());
        assertTrue(db.authSession(AuthService.tokenHash(first)).isEmpty());
    }

    @Test void rejectsCsrfAndRevokesSessionAtLogout() throws Exception {
        var session = register();
        assertEquals(403, request("POST", "/api/auth/logout", null).statusCode());
        assertEquals(403, request("POST", "/api/auth/logout", null, "X-CSRF-Token", "invalid").statusCode());
        String csrf = session.get("csrfToken").asText();
        assertEquals(403, request("POST", "/api/auth/logout", null, "X-CSRF-Token", csrf, "Origin", "https://evil.example").statusCode());
        String token = cookies.getCookieStore().getCookies().getFirst().getValue();
        assertEquals(204, request("POST", "/api/auth/logout", null, "X-CSRF-Token", csrf, "Origin", ORIGIN).statusCode());
        assertTrue(db.authSession(AuthService.tokenHash(token)).isEmpty());
        assertEquals(401, request("GET", "/api/points", null).statusCode());
    }

    @Test void expiresServerSessionsAndPersistsOnlyHashedTokens() throws Exception {
        var session = register();
        String token = cookies.getCookieStore().getCookies().getFirst().getValue();
        var rows = db.query("SELECT token_hash FROM auth_sessions");
        assertEquals(AuthService.tokenHash(token), rows.getFirst().get("token_hash"));
        db.revokeAuthSession(AuthService.tokenHash(token));
        db.createAuthSession(AuthService.tokenHash(token), session.at("/user/id").asText(), "csrf", Instant.now().minusSeconds(1));
        assertEquals(401, request("GET", "/api/points", null).statusCode());
        assertTrue(json.readTree(request("GET", "/api/auth/session", null).body()).get("user").isNull());
    }

    @Test void rememberMeSetsPersistentCookie() throws Exception {
        register();
        var response = request("POST", "/api/auth/login", ACCOUNT.replace("}", ",\"remember\":true}"));
        assertEquals(200, response.statusCode());
        assertTrue(response.headers().firstValue("Set-Cookie").orElseThrow().toLowerCase().contains("max-age=2592000"));
    }

    @Test void throttlesRepeatedLoginAttempts() throws Exception {
        String wrong = "{\"email\":\"missing@example.test\",\"password\":\"qualquer senha\"}";
        for (int i = 0; i < 20; i++) assertEquals(401, request("POST", "/api/auth/login", wrong).statusCode());
        var response = request("POST", "/api/auth/login", wrong);
        assertEquals(429, response.statusCode());
        assertEquals("900", response.headers().firstValue("Retry-After").orElseThrow());
    }
}
