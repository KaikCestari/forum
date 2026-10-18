package br.forum.aquaml;

import com.fasterxml.jackson.databind.JsonNode;
import io.javalin.Javalin;
import io.javalin.http.Context;
import io.javalin.http.HttpStatus;
import io.javalin.http.UploadedFile;

import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/** Rotas HTTP da API consumida pelo painel. */
public final class ApiRoutes {

    private ApiRoutes() {}

    /** O processador Rust só consolida dias com pelo menos 6 leituras horárias. */
    private static final double MIN_READINGS_PER_DAY = 6;
    private static final int MAX_QUESTION = 2000;

    public static void register(Javalin app, ResultsRepository repo, PipelineService pipeline,
                                Database db, AssistantService assistant) {
        app.get("/api/overview", ctx -> respond(ctx, repo.overview(), pipeline));
        app.get("/api/stations", ctx -> respond(ctx, repo.get("stations"), pipeline));
        app.get("/api/stations/{id}/series", ctx -> {
            if (!repo.isLoaded()) {
                notReady(ctx, pipeline);
                return;
            }
            Optional<JsonNode> s = repo.series(ctx.pathParam("id"));
            if (s.isEmpty()) {
                ctx.status(HttpStatus.NOT_FOUND).json(Map.of("error", "estação não encontrada"));
            } else {
                ctx.json(s.get());
            }
        });
        app.get("/api/alerts", ctx -> {
            String station = ctx.queryParam("station");
            String severity = ctx.queryParam("severity");
            respond(ctx, repo.filter("alerts", a ->
                    (station == null || station.equals(a.path("station_id").asText()))
                            && (severity == null || severity.equals(a.path("severity").asText()))), pipeline);
        });
        app.get("/api/anomalies", ctx -> respond(ctx, repo.get("anomalies"), pipeline));
        app.get("/api/classification", ctx -> respond(ctx, repo.get("classification"), pipeline));
        app.get("/api/clusters", ctx -> respond(ctx, repo.get("clusters"), pipeline));
        app.get("/api/trends", ctx -> {
            boolean onlySignificant = "true".equals(ctx.queryParam("significant"));
            respond(ctx, repo.filter("trends", t -> !onlySignificant || t.path("significant").asBoolean()),
                    pipeline);
        });

        app.get("/api/pipeline/status", ctx -> ctx.json(pipeline.status()));
        app.post("/api/pipeline/run", ctx -> {
            boolean regenerate = "true".equals(ctx.queryParam("regenerate"));
            String seed = ctx.queryParam("seed");
            Long seedValue;
            try {
                seedValue = seed == null || seed.isBlank() ? null : Long.parseLong(seed);
            } catch (NumberFormatException e) {
                ctx.status(HttpStatus.BAD_REQUEST).json(Map.of("error", "semente inválida"));
                return;
            }
            if (pipeline.start(regenerate, seedValue)) {
                ctx.status(HttpStatus.ACCEPTED).json(pipeline.status());
            } else {
                ctx.status(HttpStatus.CONFLICT).json(Map.of("error", "pipeline já em execução"));
            }
        });

        // Banco H2: dados atuais, histórico de análises e agregados em SQL.
        app.get("/api/db/summary", ctx -> ctx.json(db.summary()));
        app.get("/api/db/runs", ctx -> ctx.json(db.runs(ctx.queryParamAsClass("limit", Integer.class)
                .check(n -> n > 0 && n <= 500, "limite entre 1 e 500").getOrDefault(30))));
        app.get("/api/db/monthly", ctx -> ctx.json(db.monthly(ctx.queryParam("station"))));
        app.post("/api/data/import", ctx -> importData(ctx, pipeline));

        // Assistente Llama.
        app.get("/api/assistant/status", ctx -> ctx.json(assistant.status()));
        app.get("/api/assistant/context", ctx -> ctx.contentType("text/plain; charset=utf-8").result(assistant.context()));
        app.get("/api/assistant/history", ctx -> ctx.json(db.messages(50)));
        app.delete("/api/assistant/history", ctx -> {
            db.clearMessages();
            ctx.status(HttpStatus.NO_CONTENT);
        });
        app.post("/api/assistant/ask", ctx -> {
            String question = ctx.bodyAsClass(Map.class).getOrDefault("question", "").toString().strip();
            if (question.isEmpty() || question.length() > MAX_QUESTION) {
                ctx.status(HttpStatus.BAD_REQUEST).json(Map.of("error", "escreva uma pergunta de até " + MAX_QUESTION + " caracteres"));
                return;
            }
            if (!repo.isLoaded()) {
                notReady(ctx, pipeline);
                return;
            }
            try {
                ctx.json(assistant.ask(question));
            } catch (IOException e) {
                LlamaClient.Status st = assistant.status();
                ctx.status(HttpStatus.SERVICE_UNAVAILABLE).json(Map.of(
                        "error", st.error() != null ? st.error() : "o Llama não respondeu: " + e.getMessage(),
                        "llama", st));
            }
        });
    }

    /**
     * Recebe CSVs de dados reais (multipart): {@code measurements} obrigatório,
     * {@code stations} e {@code events} opcionais. Valida, grava no H2 e
     * reexecuta o pipeline.
     */
    private static void importData(Context ctx, PipelineService pipeline) throws IOException {
        if (pipeline.status().running()) {
            ctx.status(HttpStatus.CONFLICT).json(Map.of("error", "pipeline já em execução"));
            return;
        }
        UploadedFile mFile = ctx.uploadedFile("measurements");
        if (mFile == null || mFile.size() == 0) {
            ctx.status(HttpStatus.BAD_REQUEST).json(Map.of("error", "envie o CSV de leituras no campo measurements"));
            return;
        }
        CsvImport.Parsed parsed;
        List<Database.Station> stations = new ArrayList<>();
        List<Database.Event> events = List.of();
        try {
            try (var r = new InputStreamReader(mFile.content(), StandardCharsets.UTF_8)) {
                parsed = CsvImport.measurements(r);
            }
            UploadedFile sFile = ctx.uploadedFile("stations");
            if (sFile != null && sFile.size() > 0) {
                try (var r = new InputStreamReader(sFile.content(), StandardCharsets.UTF_8)) {
                    stations.addAll(CsvImport.stations(r));
                }
            }
            UploadedFile eFile = ctx.uploadedFile("events");
            if (eFile != null && eFile.size() > 0) {
                try (var r = new InputStreamReader(eFile.content(), StandardCharsets.UTF_8)) {
                    events = CsvImport.events(r);
                }
            }
        } catch (CsvImport.ImportException e) {
            ctx.status(HttpStatus.BAD_REQUEST).json(Map.of("error", e.getMessage()));
            return;
        }

        // Estações presentes nas leituras e ausentes do cadastro entram com o próprio código.
        Set<String> known = new LinkedHashSet<>();
        stations.forEach(s -> known.add(s.id()));
        for (String id : parsed.stationIds()) {
            if (known.add(id)) {
                stations.add(new Database.Station(id, id, "rio", null, null));
            }
        }
        stations.removeIf(s -> !parsed.stationIds().contains(s.id()));

        List<String> warnings = new ArrayList<>();
        if (parsed.readingsPerDay() < MIN_READINGS_PER_DAY) {
            warnings.add(String.format("Média de %.1f leituras por dia: o processador só consolida dias com pelo "
                    + "menos %.0f leituras, então use dados de sensores contínuos (de hora em hora, por exemplo).",
                    parsed.readingsPerDay(), MIN_READINGS_PER_DAY));
        }
        if (!parsed.missingParams().isEmpty()) {
            warnings.add("Parâmetros ausentes (o IQA e os modelos usam só os presentes): "
                    + String.join(", ", parsed.missingParams()));
        }
        if (parsed.skippedRows() > 0) {
            warnings.add(parsed.skippedRows() + " linhas sem data/hora ou estação válidas foram ignoradas.");
        }

        String name = Optional.ofNullable(ctx.formParam("name")).filter(n -> !n.isBlank())
                .orElse(mFile.filename());
        if (!pipeline.startImport(name, stations, parsed.measurements(), events)) {
            ctx.status(HttpStatus.CONFLICT).json(Map.of("error", "pipeline já em execução"));
            return;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("name", name);
        out.put("measurements", parsed.measurements().size());
        out.put("stations", stations.size());
        out.put("events", events.size());
        out.put("readingsPerDay", Math.round(parsed.readingsPerDay() * 10) / 10.0);
        out.put("warnings", warnings);
        out.put("pipeline", pipeline.status());
        ctx.status(HttpStatus.ACCEPTED).json(out);
    }

    private static void respond(Context ctx, Optional<? extends JsonNode> data, PipelineService pipeline) {
        if (data.isPresent()) {
            ctx.json(data.get());
        } else {
            notReady(ctx, pipeline);
        }
    }

    private static void notReady(Context ctx, PipelineService pipeline) {
        ctx.status(HttpStatus.SERVICE_UNAVAILABLE)
                .json(Map.of("error", "resultados ainda não disponíveis", "pipeline", pipeline.status()));
    }
}
