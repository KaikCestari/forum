package br.forum.aquaml;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import io.javalin.Javalin;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ApiRoutesTest {

    private static final String SAMPLE = """
            {"period": ["2025-01-01", "2025-01-02"],
             "stations": [{"id": "RIO-01", "name": "Rio Teste", "type": "rio", "iqa_30d": 81.5,
                           "latest": {"date": "2025-01-02", "iqa": 82.0, "iqa_class": "Ótima"},
                           "worsening_trends": [], "alerts_total": 1, "alerts_recent": 1, "critical_total": 1}],
             "insights": ["Melhor condição: Rio Teste."],
             "alerts": [{"station_id": "RIO-01", "severity": "critico", "title": "OD baixo",
                         "start": "2025-01-02", "end": "2025-01-02", "days": 1},
                        {"station_id": "LAG-01", "severity": "alto", "start": "2025-01-01", "end": "2025-01-01"}],
             "trends": [{"significant": true}, {"significant": false}],
             "classification": {"accuracy": 0.9},
             "anomalies": {"episodes": []},
             "series": {"RIO-01": {"dates": ["2025-01-01", "2025-01-02"], "iqa": [90.0, 74.0],
                                   "do_mgl": [8.0, null], "iqa_class": ["Ótima", "Boa"],
                                   "anomaly": [false, true]}}}
            """;

    private static final String FRONT = "http://localhost:5173";

    @TempDir
    Path tmp;
    private Javalin app;
    private ResultsRepository repo;
    private Database db;
    private PipelineService pipeline;
    private HttpServer ollama;
    private final AtomicReference<String> lastLlamaRequest = new AtomicReference<>();
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newHttpClient();

    @BeforeEach
    void setUp() throws Exception {
        ollama = fakeOllama();
        String llamaUrl = "http://localhost:" + ollama.getAddress().getPort();
        AppConfig config = new AppConfig(tmp, 0, List.of(FRONT), "jdbc:h2:mem:" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1",
                llamaUrl, "llama3.2");
        db = new Database(config.dbUrl());
        repo = new ResultsRepository(tmp.resolve("results.json"));
        pipeline = new PipelineService(config, repo, db);
        AssistantService assistant = new AssistantService(new LlamaClient(llamaUrl, "llama3.2"), repo, db);
        ImageService images = new ImageService(db, new LlamaClient(llamaUrl, "llama3.2"), tmp.resolve("images"), "gemma4:31b");
        app = Main.createApp(repo, pipeline, db, assistant, images, List.of(FRONT)).start(0);
    }

    @AfterEach
    void tearDown() {
        app.stop();
        ollama.stop(0);
        db.close();
    }

    /** Imita as rotas do Ollama usadas pelo LlamaClient. */
    private HttpServer fakeOllama() throws Exception {
        HttpServer s = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        s.createContext("/api/tags", ex -> {
            byte[] b = "{\"models\":[{\"name\":\"llama3.2:latest\"}]}".getBytes(StandardCharsets.UTF_8);
            ex.sendResponseHeaders(200, b.length);
            ex.getResponseBody().write(b);
            ex.close();
        });
        s.createContext("/api/chat", ex -> {
            lastLlamaRequest.set(new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] b = "{\"message\":{\"role\":\"assistant\",\"content\":\"O Rio Teste está com IQA 81,5.\"}}"
                    .getBytes(StandardCharsets.UTF_8);
            ex.sendResponseHeaders(200, b.length);
            ex.getResponseBody().write(b);
            ex.close();
        });
        s.start();
        return s;
    }

    private HttpResponse<String> get(String path) throws Exception {
        return http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + app.port() + path)).build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> delete(String path) throws Exception {
        return http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + app.port() + path)).DELETE().build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> post(String path, String contentType, String body) throws Exception {
        return http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + app.port() + path))
                        .header("Content-Type", contentType)
                        .POST(HttpRequest.BodyPublishers.ofString(body)).build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private void loadSample() {
        JsonNode json;
        try {
            json = mapper.readTree(SAMPLE);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
        db.saveRun(json);
        repo.set(json);
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
    void storesAnalysisInH2() throws Exception {
        loadSample();
        assertTrue(db.latestResults().orElseThrow().contains("RIO-01"));

        JsonNode runs = mapper.readTree(get("/api/db/runs").body());
        assertEquals(1, runs.size());
        assertEquals(2, runs.get(0).get("alerts").asInt());
        assertEquals(1, runs.get(0).get("critical_alerts").asInt());

        JsonNode monthly = mapper.readTree(get("/api/db/monthly?station=RIO-01").body());
        assertEquals(1, monthly.size());
        assertEquals("2025-01", monthly.get(0).get("month").asText());
        assertEquals(82.0, monthly.get(0).get("iqa_mean").asDouble(), 1e-9);
        assertEquals(1, monthly.get(0).get("anomaly_days").asInt());

        assertEquals(2, mapper.readTree(get("/api/db/summary").body()).at("/totals/daily_rows").asInt());
    }

    @Test
    void importsRealCsvIntoH2() throws Exception {
        String boundary = "aquaml-" + UUID.randomUUID();
        StringBuilder csv = new StringBuilder("Data/Hora;Estação;pH;OD (mg/L);Temperatura (°C);Fósforo total (mg/L)\n");
        for (int h = 0; h < 24; h++) {
            csv.append(String.format("10/03/2025 %02d:00;PONTE-1;7,1;6,5;22,4;<0,02%n", h));
        }
        String body = "--" + boundary + "\r\n"
                + "Content-Disposition: form-data; name=\"name\"\r\n\r\nRio real\r\n"
                + "--" + boundary + "\r\n"
                + "Content-Disposition: form-data; name=\"measurements\"; filename=\"leituras.csv\"\r\n"
                + "Content-Type: text/csv\r\n\r\n" + csv + "\r\n"
                + "--" + boundary + "--\r\n";

        HttpResponse<String> r = post("/api/data/import", "multipart/form-data; boundary=" + boundary, body);
        assertEquals(202, r.statusCode(), r.body());
        JsonNode out = mapper.readTree(r.body());
        assertEquals(24, out.get("measurements").asInt());
        assertEquals(1, out.get("stations").asInt());

        awaitPipeline();
        // A importação e a exportação do H2 rodam; o Rust não existe no diretório temporário de teste.
        assertEquals(24, db.measurementCount());
        assertEquals("real", db.dataset().orElseThrow().get("source"));
        assertEquals(0.01, (Double) db.query("SELECT phosphorus_mgl FROM measurements LIMIT 1").get(0).get("phosphorus_mgl"), 1e-9);
        String exported = Files.readString(tmp.resolve("data/raw/measurements.csv"));
        assertTrue(exported.startsWith("timestamp,station_id,ph,do_mgl"));
        assertTrue(exported.contains("2025-03-10T05:00:00,PONTE-1,7.1000,6.5000,22.4000,,,,0.0100,"));
    }

    @Test
    void rejectsCsvWithoutRequiredColumns() throws Exception {
        String boundary = "b" + UUID.randomUUID();
        String body = "--" + boundary + "\r\nContent-Disposition: form-data; name=\"measurements\"; filename=\"x.csv\"\r\n\r\n"
                + "foo,bar\n1,2\r\n--" + boundary + "--\r\n";
        HttpResponse<String> r = post("/api/data/import", "multipart/form-data; boundary=" + boundary, body);
        assertEquals(400, r.statusCode());
        assertTrue(r.body().contains("timestamp"));
    }

    @Test
    void assistantAnswersWithLlamaAndStoresHistory() throws Exception {
        loadSample();
        JsonNode status = mapper.readTree(get("/api/assistant/status").body());
        assertTrue(status.get("modelInstalled").asBoolean());

        HttpResponse<String> r = post("/api/assistant/ask", "application/json", "{\"question\":\"Como está o Rio Teste?\"}");
        assertEquals(200, r.statusCode(), r.body());
        assertTrue(r.body().contains("IQA 81,5"));

        JsonNode sent = mapper.readTree(lastLlamaRequest.get());
        assertEquals("llama3.2", sent.get("model").asText());
        String system = sent.get("messages").get(0).get("content").asText();
        assertTrue(system.contains("Rio Teste"), "o contexto deve trazer as estações");
        assertTrue(system.contains("2025-01 IQA 82 (mín 74"), "o contexto deve trazer o IQA mensal do H2");
        assertEquals("Como está o Rio Teste?", sent.get("messages").get(1).get("content").asText());

        assertEquals(1, mapper.readTree(get("/api/assistant/history").body()).size());
        assertEquals(400, post("/api/assistant/ask", "application/json", "{\"question\":\"  \"}").statusCode());
    }

    @Test
    void fieldNotesCanBeCreatedFilteredAndDeleted() throws Exception {
        String json = "{\"station_id\":\"RIO-1\",\"date\":\"2025-02-03\",\"kind\":\"ocorrencia\",\"text\":\"Peixes mortos perto da ponte\"}";
        HttpResponse<String> created = post("/api/notes", "application/json", json);
        assertEquals(201, created.statusCode(), created.body());
        JsonNode note = mapper.readTree(created.body());
        assertEquals("2025-02-03", note.get("noted_on").asText());
        assertEquals("ocorrencia", note.get("kind").asText());

        post("/api/notes", "application/json", json.replace("RIO-1", "LAG-1").replace("2025-02-03", "2025-03-01"));
        assertEquals(2, mapper.readTree(get("/api/notes").body()).size());
        JsonNode only = mapper.readTree(get("/api/notes?station=RIO-1").body());
        assertEquals(1, only.size());
        assertEquals("Peixes mortos perto da ponte", only.get(0).get("text").asText());
        assertEquals("LAG-1", mapper.readTree(get("/api/notes").body()).get(0).get("station_id").asText(),
                "a anotação de data mais recente vem primeiro");

        assertEquals(204, delete("/api/notes/" + note.get("id").asLong()).statusCode());
        assertEquals(404, delete("/api/notes/" + note.get("id").asLong()).statusCode());
        assertEquals(404, delete("/api/notes/abc").statusCode());
        assertEquals(1, mapper.readTree(get("/api/notes").body()).size());
    }

    @Test
    void fieldNotesAreValidated() throws Exception {
        String ok = "{\"station_id\":\"RIO-1\",\"date\":\"2025-02-03\",\"kind\":\"coleta\",\"text\":\"Coleta de água\"}";
        assertEquals(400, post("/api/notes", "application/json", ok.replace("coleta\"", "outro\"")).statusCode());
        assertEquals(400, post("/api/notes", "application/json", ok.replace("2025-02-03", "ontem")).statusCode());
        assertEquals(400, post("/api/notes", "application/json", ok.replace("Coleta de água", "  ")).statusCode());
        assertEquals(400, post("/api/notes", "application/json", ok.replace("RIO-1", "")).statusCode());
        assertEquals(400, post("/api/notes", "application/json", ok.replace("2025-02-03", "2999-01-01")).statusCode());
        assertEquals(0, mapper.readTree(get("/api/notes").body()).size());
    }

    @Test
    void assistantContextIncludesFieldNotes() throws Exception {
        loadSample();
        post("/api/notes", "application/json",
                "{\"station_id\":\"RIO-1\",\"date\":\"2025-02-03\",\"kind\":\"observacao\",\"text\":\"Espuma branca na margem\"}");
        HttpResponse<String> r = post("/api/assistant/ask", "application/json", "{\"question\":\"Oi\"}");
        assertEquals(200, r.statusCode(), r.body());
        String system = mapper.readTree(lastLlamaRequest.get()).get("messages").get(0).get("content").asText();
        assertTrue(system.contains("Espuma branca na margem"), "o contexto deve trazer as anotações de campo");
        assertTrue(system.contains("biólogos"), "o prompt deve pedir linguagem para biólogos");
    }

    @Test
    void assistantReports503WhenLlamaIsDown() throws Exception {
        loadSample();
        ollama.stop(0);
        HttpResponse<String> r = post("/api/assistant/ask", "application/json", "{\"question\":\"Oi\"}");
        assertEquals(503, r.statusCode());
        assertTrue(r.body().contains("ollama serve"));
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

    private void awaitPipeline() throws InterruptedException {
        for (int i = 0; i < 200 && pipeline.status().running(); i++) {
            Thread.sleep(50);
        }
        assertFalse(pipeline.status().running());
    }

    private static int countOccurrences(String s, String needle) {
        return s.split(needle, -1).length - 1;
    }
}
