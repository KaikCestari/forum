package br.forum.aquaml;

import io.javalin.Javalin;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ApiRoutesTest {

    private static final String SAMPLE = """
            {"stations": [{"id": "RIO-01"}],
             "alerts": [{"station_id": "RIO-01", "severity": "critico"},
                        {"station_id": "LAG-01", "severity": "alto"}],
             "trends": [{"significant": true}, {"significant": false}],
             "series": {"RIO-01": {"dates": ["2025-01-01"], "iqa": [90.0]}}}
            """;

    private static final String FRONT = "http://localhost:5173";

    @TempDir
    Path tmp;
    private Javalin app;
    private ResultsRepository repo;
    private final HttpClient http = HttpClient.newHttpClient();

    @BeforeEach
    void setUp() {
        repo = new ResultsRepository(tmp.resolve("results.json"));
        PipelineService pipeline = new PipelineService(new AppConfig(tmp, 0, List.of(FRONT)), repo);
        app = Main.createApp(repo, pipeline, List.of(FRONT)).start(0);
    }

    @AfterEach
    void tearDown() {
        app.stop();
    }

    private HttpResponse<String> get(String path) throws Exception {
        return http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + app.port() + path)).build(),
                HttpResponse.BodyHandlers.ofString());
    }

    @Test
    void returns503BeforeResultsExist() throws Exception {
        assertEquals(503, get("/api/overview").statusCode());
        assertEquals(200, get("/api/pipeline/status").statusCode());
    }

    @Test
    void servesResultsAfterReload() throws Exception {
        Files.writeString(tmp.resolve("results.json"), SAMPLE);
        assertTrue(repo.reload());

        HttpResponse<String> overview = get("/api/overview");
        assertEquals(200, overview.statusCode());
        assertFalse(overview.body().contains("\"series\""), "overview não deve incluir séries");

        assertTrue(get("/api/stations/RIO-01/series").body().contains("2025-01-01"));
        assertEquals(404, get("/api/stations/XXX/series").statusCode());
        assertEquals(1, countOccurrences(get("/api/alerts?severity=critico").body(), "station_id"));
        assertEquals(1, countOccurrences(get("/api/alerts?station=LAG-01").body(), "station_id"));
        assertEquals(1, countOccurrences(get("/api/trends?significant=true").body(), "significant"));
    }

    @Test
    void rootDescribesTheApi() throws Exception {
        HttpResponse<String> index = get("/");
        assertEquals(200, index.statusCode());
        assertTrue(index.body().contains("AquaML API"));
        assertTrue(index.body().contains("/api/overview"));
    }

    @Test
    void allowsTheFrontEndOrigin() throws Exception {
        HttpRequest req = HttpRequest.newBuilder(URI.create("http://localhost:" + app.port() + "/api/pipeline/status"))
                .header("Origin", FRONT).build();
        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        assertEquals(FRONT, res.headers().firstValue("Access-Control-Allow-Origin").orElse(null));

        HttpRequest other = HttpRequest.newBuilder(URI.create("http://localhost:" + app.port() + "/api/pipeline/status"))
                .header("Origin", "http://evil.example").build();
        HttpResponse<String> denied = http.send(other, HttpResponse.BodyHandlers.ofString());
        assertTrue(denied.headers().firstValue("Access-Control-Allow-Origin").isEmpty());
    }

    private static int countOccurrences(String s, String needle) {
        return s.split(needle, -1).length - 1;
    }
}
