package br.forum.aquaml;

import com.fasterxml.jackson.databind.JsonNode;
import io.javalin.Javalin;
import io.javalin.http.Context;
import io.javalin.http.HttpStatus;

import java.util.Map;
import java.util.Optional;

/** Rotas HTTP da API consumida pelo painel. */
public final class ApiRoutes {

    private ApiRoutes() {}

    public static void register(Javalin app, ResultsRepository repo, PipelineService pipeline) {
        app.get("/", ctx -> ctx.json(Map.of(
                "name", "AquaML API",
                "ready", repo.isLoaded(),
                "endpoints", java.util.List.of(
                        "GET /api/overview", "GET /api/stations", "GET /api/stations/{id}/series",
                        "GET /api/alerts", "GET /api/anomalies", "GET /api/classification",
                        "GET /api/clusters", "GET /api/trends", "GET /api/pipeline/status",
                        "POST /api/pipeline/run"))));
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
