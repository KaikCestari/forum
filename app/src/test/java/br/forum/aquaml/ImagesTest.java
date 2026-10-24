package br.forum.aquaml;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import io.javalin.Javalin;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ImagesTest {

    private static final String FRONT = "http://localhost:5173";
    private static final String GOOD_ANALYSIS = """
            {"cor_da_agua":"verde-escura","turbidez":"media","floracao_algas":"provavel","espuma":false,
             "oleo_ou_filme":false,"material_flutuante":true,"vegetacao_aquatica":"pouca","nivel_de_atencao":2,
             "resumo":"Água esverdeada com possível floração.","o_que_conferir_em_campo":"Medir oxigênio e clorofila.",
             "confianca":0.8}""";

    @TempDir Path tmp;
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newHttpClient();
    private final AtomicReference<String> lastVisionRequest = new AtomicReference<>();
    private volatile int visionStatus = 200;
    private volatile String visionContent = GOOD_ANALYSIS;
    private HttpServer ollama;
    private Javalin app;
    private Database db;

    @BeforeEach
    void setUp() throws Exception {
        ollama = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        ollama.createContext("/api/chat", ex -> {
            lastVisionRequest.set(new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            String body = visionStatus == 200
                    ? mapper.writeValueAsString(java.util.Map.of("message", java.util.Map.of("role", "assistant", "content", visionContent)))
                    : "{\"error\":\"modelo indisponível\"}";
            byte[] b = body.getBytes(StandardCharsets.UTF_8);
            ex.sendResponseHeaders(visionStatus, b.length);
            ex.getResponseBody().write(b);
            ex.close();
        });
        ollama.start();
        String url = "http://localhost:" + ollama.getAddress().getPort();
        AppConfig config = new AppConfig(tmp, 0, List.of(FRONT), "jdbc:h2:mem:" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1", url, "llama3.2");
        db = new Database(config.dbUrl());
        ResultsRepository repo = new ResultsRepository(tmp.resolve("results.json"));
        LlamaClient llama = new LlamaClient(url, "llama3.2");
        ImageService images = new ImageService(db, llama, tmp.resolve("images"), "gemma4:31b");
        app = Main.createApp(repo, new PipelineService(config, repo, db), db, new AssistantService(llama, repo, db), images,
                List.of(FRONT)).start(0);
    }

    @AfterEach
    void tearDown() {
        app.stop();
        ollama.stop(0);
        db.close();
    }

    private static byte[] png(Color color, int w, int h) throws Exception {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        var g = img.createGraphics();
        g.setColor(color);
        g.fillRect(0, 0, w, h);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "png", out);
        return out.toByteArray();
    }

    private HttpResponse<String> upload(byte[] file, String... fields) throws Exception {
        String boundary = "b" + UUID.randomUUID();
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        for (int i = 0; i < fields.length; i += 2) {
            body.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + fields[i] + "\"\r\n\r\n" + fields[i + 1]
                    + "\r\n").getBytes(StandardCharsets.UTF_8));
        }
        if (file != null) {
            body.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"image\"; filename=\"x.png\"\r\n"
                    + "Content-Type: image/png\r\n\r\n").getBytes(StandardCharsets.UTF_8));
            body.write(file);
            body.write("\r\n".getBytes(StandardCharsets.UTF_8));
        }
        body.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        return http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + app.port() + "/api/images"))
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body.toByteArray())).build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> send(String method, String path, String json) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://localhost:" + app.port() + path)).header("Content-Type", "application/json");
        builder.method(method, json == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(json));
        return http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    private JsonNode uploadOk(String kind) throws Exception {
        HttpResponse<String> r = upload(png(new Color(40, 140, 60), 60, 40), "kind", kind, "date", "2026-07-13",
                "point_name", "Lagoa do Parque", "point_type", "lago", "point_lat", "-22,9", "point_lon", "-47.1", "note", "Perto da ponte");
        assertEquals(201, r.statusCode(), r.body());
        return mapper.readTree(r.body());
    }

    @Test
    void uploadAnalyzesStoresAndCreatesThePoint() throws Exception {
        JsonNode obs = uploadOk("foto");
        assertEquals("pendente", obs.get("status").asText());
        assertEquals("foto", obs.get("kind").asText());
        assertEquals("verde-escura", obs.get("analysis").get("cor_da_agua").asText());
        assertEquals("provavel", obs.get("analysis").get("floracao_algas").asText());
        assertEquals(2, obs.get("analysis").get("nivel_de_atencao").asInt());
        assertTrue(obs.get("analysis_error").isNull());
        assertEquals("Perto da ponte", obs.get("note").asText());
        assertTrue(obs.get("metrics").get("indice_verde_vermelho").asDouble() > 0.4, "imagem verde deve ter índice alto");
        assertEquals(1.0, obs.get("metrics").get("fracao_esverdeada").asDouble(), 0.001);

        JsonNode sent = mapper.readTree(lastVisionRequest.get());
        assertEquals("gemma4:31b", sent.get("model").asText());
        assertEquals("json", sent.get("format").asText());
        assertEquals(1, sent.get("messages").get(1).get("images").size());
        assertFalse(sent.get("messages").get(0).has("images"), "a mensagem de sistema não leva imagem");

        JsonNode points = mapper.readTree(send("GET", "/api/points", null).body());
        assertEquals(1, points.size());
        assertEquals("Lagoa do Parque", points.get(0).get("name").asText());
        assertEquals(obs.get("station_id").asText(), points.get(0).get("id").asText());
        assertEquals(-22.9, points.get(0).get("lat").asDouble(), 0.001);

        HttpResponse<byte[]> file = http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + app.port() + obs.get("file_url").asText())).build(),
                HttpResponse.BodyHandlers.ofByteArray());
        assertEquals(200, file.statusCode());
        assertEquals("image/png", file.headers().firstValue("Content-Type").orElse(""));
        try (var files = Files.list(tmp.resolve("images"))) {
            assertEquals(1, files.count());
        }
    }

    @Test
    void satelliteImagesUseTheirOwnFields() throws Exception {
        visionContent = "{\"cor_da_agua\":\"marrom\",\"turbidez\":\"alta\",\"floracao_algas\":\"nenhuma\",\"uso_do_entorno\":\"lavoura\","
                + "\"vegetacao_ribeirinha\":\"ausente\",\"nivel_de_atencao\":3,\"resumo\":\"Sem mata ciliar.\",\"espuma\":true}";
        JsonNode a = uploadOk("satelite").get("analysis");
        assertEquals("lavoura", a.get("uso_do_entorno").asText());
        assertEquals("ausente", a.get("vegetacao_ribeirinha").asText());
        assertFalse(a.has("espuma"), "campos de foto não entram na análise de satélite");
    }

    @Test
    void messyModelOutputIsNormalized() throws Exception {
        visionContent = "```json\n{\"cor_da_agua\":\"verde\",\"turbidez\":\"Média\",\"floracao_algas\":\"talvez\",\"espuma\":\"sim\","
                + "\"nivel_de_atencao\":7,\"confianca\":1.5,\"resumo\":\"x\"}\n```";
        JsonNode a = uploadOk("foto").get("analysis");
        assertEquals("media", a.get("turbidez").asText());
        assertEquals("nao_avaliavel", a.get("floracao_algas").asText());
        assertTrue(a.get("espuma").asBoolean());
        assertEquals(3, a.get("nivel_de_atencao").asInt());
        assertEquals(1.0, a.get("confianca").asDouble(), 0.0001);
    }

    @Test
    void whenTheModelFailsTheImageIsStillSavedForManualReview() throws Exception {
        visionStatus = 500;
        JsonNode obs = uploadOk("foto");
        assertTrue(obs.get("analysis_error").asText().contains("Preencha à mão"));
        assertEquals("nao_avaliavel", obs.get("analysis").get("turbidez").asText());
        assertEquals(0, obs.get("analysis").get("nivel_de_atencao").asInt());

        visionStatus = 200;
        visionContent = "isto não é json";
        assertTrue(uploadOk("foto").get("analysis_error").asText().contains("legível"));
    }

    @Test
    void confirmedObservationsReachTheAssistantContextAndCanBeDeleted() throws Exception {
        JsonNode obs = uploadOk("foto");
        long id = obs.get("id").asLong();
        assertFalse(send("GET", "/api/assistant/context", null).body().contains("Água esverdeada"),
                "observação pendente não entra no contexto");

        HttpResponse<String> confirmed = send("POST", "/api/images/" + id + "/confirm",
                "{\"cor_da_agua\":\"verde\",\"turbidez\":\"alta\",\"floracao_algas\":\"provavel\",\"nivel_de_atencao\":3,"
                        + "\"resumo\":\"Floração confirmada pelo biólogo.\"}");
        assertEquals(200, confirmed.statusCode(), confirmed.body());
        JsonNode c = mapper.readTree(confirmed.body());
        assertEquals("confirmado", c.get("status").asText());
        assertEquals("alta", c.get("analysis").get("turbidez").asText());

        assertEquals(1, mapper.readTree(send("GET", "/api/images?status=confirmado", null).body()).size());
        assertEquals(0, mapper.readTree(send("GET", "/api/images?status=pendente", null).body()).size());
        String context = send("GET", "/api/assistant/context", null).body();
        assertTrue(context.contains("Floração confirmada pelo biólogo."));
        assertTrue(context.contains("Lagoa do Parque"));
        assertTrue(context.contains("nível de atenção 3 de 3"));

        assertEquals(204, send("DELETE", "/api/images/" + id, null).statusCode());
        assertEquals(404, send("DELETE", "/api/images/" + id, null).statusCode());
        assertEquals(404, send("POST", "/api/images/" + id + "/confirm", "{}").statusCode());
        try (var files = Files.list(tmp.resolve("images"))) {
            assertEquals(0, files.count(), "o arquivo da imagem também é apagado");
        }
    }

    @Test
    void uploadsAreValidated() throws Exception {
        byte[] img = png(Color.BLUE, 20, 20);
        String[] ok = {"kind", "foto", "date", "2026-07-13", "point_name", "P", "point_type", "rio"};
        assertEquals(400, upload(null, ok).statusCode());
        assertEquals(400, upload("não sou imagem".getBytes(StandardCharsets.UTF_8), ok).statusCode());
        assertEquals(400, upload(img, "kind", "video", "date", "2026-07-13", "point_name", "P", "point_type", "rio").statusCode());
        assertEquals(400, upload(img, "kind", "foto", "date", "ontem", "point_name", "P", "point_type", "rio").statusCode());
        assertEquals(400, upload(img, "kind", "foto", "date", "2999-01-01", "point_name", "P", "point_type", "rio").statusCode());
        assertEquals(400, upload(img, "kind", "foto", "date", "2026-07-13").statusCode(), "falta o ponto");
        assertEquals(400, upload(img, "kind", "foto", "date", "2026-07-13", "station_id", "NAO-EXISTE").statusCode());
        assertEquals(400, upload(img, "kind", "foto", "date", "2026-07-13", "point_name", "P", "point_type", "mar").statusCode());
        assertEquals(400, upload(img, "kind", "foto", "date", "2026-07-13", "point_name", "P", "point_type", "rio", "point_lat", "95").statusCode());
        assertEquals(0, mapper.readTree(send("GET", "/api/points", null).body()).size(), "uma falha não deixa ponto órfão");
        assertNull(lastVisionRequest.get(), "nada inválido chega à IA");
    }

    @Test
    void anExistingPointCanBeReused() throws Exception {
        JsonNode first = uploadOk("foto");
        HttpResponse<String> r = upload(png(Color.GREEN, 30, 30), "kind", "satelite", "date", "2026-07-14",
                "station_id", first.get("station_id").asText());
        assertEquals(201, r.statusCode(), r.body());
        assertEquals(1, mapper.readTree(send("GET", "/api/points", null).body()).size());
        assertEquals(2, mapper.readTree(send("GET", "/api/images?station=" + first.get("station_id").asText(), null).body()).size());
    }

    @Test
    void colorMetricsDescribeTheImage() {
        BufferedImage blue = new BufferedImage(10, 10, BufferedImage.TYPE_INT_RGB);
        var g = blue.createGraphics();
        g.setColor(new Color(20, 40, 200));
        g.fillRect(0, 0, 10, 10);
        g.dispose();
        var m = ImageService.colorMetrics(blue);
        assertEquals(0.0, (double) m.get("fracao_esverdeada"), 0.0001);
        assertTrue((double) m.get("indice_verde_vermelho") > 0);
        assertTrue((double) m.get("proporcao_azul") > 0.6);
    }

    @Test
    void clearingTheDatasetKeepsImagesAndNotes() throws Exception {
        uploadOk("foto");
        db.addNote("PT-1", java.time.LocalDate.of(2026, 7, 1), "coleta", "Coleta");
        assertEquals(204, send("DELETE", "/api/data", null).statusCode());
        assertEquals(503, send("GET", "/api/overview", null).statusCode());
        assertEquals(1, mapper.readTree(send("GET", "/api/images", null).body()).size());
        assertEquals(1, mapper.readTree(send("GET", "/api/notes", null).body()).size());
    }

    @Test
    void refreshingWithoutSensorDataExplainsHowToBringIt() throws Exception {
        assertEquals(202, send("POST", "/api/pipeline/run", null).statusCode());
        JsonNode status = null;
        for (int i = 0; i < 50; i++) {
            Thread.sleep(100);
            status = mapper.readTree(send("GET", "/api/pipeline/status", null).body());
            if (!status.get("running").asBoolean()) {
                break;
            }
        }
        assertTrue(status.get("error").asText().contains("planilha CSV"), status.toString());
    }
}
