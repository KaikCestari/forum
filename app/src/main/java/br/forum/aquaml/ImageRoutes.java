package br.forum.aquaml;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.javalin.Javalin;
import io.javalin.http.Context;
import io.javalin.http.HttpStatus;
import io.javalin.http.UploadedFile;

import java.io.IOException;
import java.nio.file.Files;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Rotas das observações por imagem (foto da água e imagem de satélite) e dos pontos de monitoramento. */
final class ImageRoutes {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final List<String> POINT_TYPES = List.of("rio", "lago", "reservatorio", "estuario");
    private static final int MAX_NOTE = 500;
    private static final int MAX_NAME = 120;

    private ImageRoutes() {}

    static void register(Javalin app, Database db, ImageService images) {
        app.get("/api/points", ctx -> ctx.json(db.points()));

        app.post("/api/images", ctx -> {
            try {
                ctx.status(HttpStatus.CREATED).json(submit(ctx, db, images));
            } catch (IllegalArgumentException e) {
                ctx.status(HttpStatus.BAD_REQUEST).json(Map.of("error", e.getMessage()));
            }
        });

        app.get("/api/images", ctx -> {
            int limit = Math.max(1, Math.min(200, ctx.queryParamAsClass("limit", Integer.class).getOrDefault(60)));
            ctx.json(images.list(ctx.queryParam("station"), ctx.queryParam("status"), limit));
        });

        app.get("/api/images/{id}/file", ctx -> {
            Optional<Map.Entry<java.nio.file.Path, String>> file = id(ctx).flatMap(images::file);
            if (file.isEmpty() || !Files.isRegularFile(file.get().getKey())) {
                ctx.status(HttpStatus.NOT_FOUND).json(Map.of("error", "imagem não encontrada"));
                return;
            }
            ctx.header("Cache-Control", "private, max-age=3600");
            ctx.contentType(file.get().getValue()).result(Files.readAllBytes(file.get().getKey()));
        });

        app.post("/api/images/{id}/confirm", ctx -> {
            Optional<Long> id = id(ctx);
            JsonNode body = MAPPER.readTree(ctx.body().isBlank() ? "{}" : ctx.body());
            Optional<Map<String, Object>> done = id.isEmpty() || !body.isObject() ? Optional.empty() : images.confirm(id.get(), body);
            if (done.isPresent()) {
                ctx.json(done.get());
            } else {
                ctx.status(HttpStatus.NOT_FOUND).json(Map.of("error", "observação não encontrada"));
            }
        });

        app.delete("/api/images/{id}", ctx -> {
            if (id(ctx).map(images::delete).orElse(false)) {
                ctx.status(HttpStatus.NO_CONTENT);
            } else {
                ctx.status(HttpStatus.NOT_FOUND).json(Map.of("error", "observação não encontrada"));
            }
        });
    }

    private static Optional<Long> id(Context ctx) {
        try {
            return Optional.of(Long.parseLong(ctx.pathParam("id")));
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    private static Map<String, Object> submit(Context ctx, Database db, ImageService images) throws IOException {
        UploadedFile file = ctx.uploadedFile("image");
        if (file == null || file.size() == 0) {
            throw new IllegalArgumentException("escolha uma imagem para enviar");
        }
        String kind = form(ctx, "kind");
        if (!ImageService.KINDS.contains(kind)) {
            throw new IllegalArgumentException("diga se é uma foto da água ou uma imagem de satélite");
        }
        LocalDate date;
        try {
            date = LocalDate.parse(form(ctx, "date"));
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("informe a data da imagem");
        }
        if (date.isAfter(LocalDate.now().plusDays(1))) {
            throw new IllegalArgumentException("a data da imagem não pode estar no futuro");
        }
        String note = form(ctx, "note");
        if (note.length() > MAX_NOTE) {
            throw new IllegalArgumentException("a observação deve ter até " + MAX_NOTE + " caracteres");
        }

        byte[] data = file.content().readNBytes((int) ImageService.MAX_BYTES + 1);
        images.validate(data);

        String stationId = form(ctx, "station_id");
        if (!stationId.isEmpty()) {
            if (!db.stationKnown(stationId)) {
                throw new IllegalArgumentException("ponto de monitoramento desconhecido");
            }
        } else {
            stationId = (String) newPoint(ctx, db).get("id");
        }
        return images.submit(data, stationId, date, kind, note);
    }

    private static Map<String, Object> newPoint(Context ctx, Database db) {
        String name = form(ctx, "point_name");
        if (name.isEmpty()) {
            throw new IllegalArgumentException("escolha um ponto de monitoramento ou dê um nome ao novo ponto");
        }
        if (name.length() > MAX_NAME) {
            throw new IllegalArgumentException("o nome do ponto deve ter até " + MAX_NAME + " caracteres");
        }
        String type = form(ctx, "point_type");
        if (!POINT_TYPES.contains(type)) {
            throw new IllegalArgumentException("escolha o tipo do ponto: rio, lago, reservatório ou estuário");
        }
        Double lat = coordinate(form(ctx, "point_lat"), 90, "latitude");
        Double lon = coordinate(form(ctx, "point_lon"), 180, "longitude");
        return db.addPoint(name, type, lat, lon);
    }

    private static Double coordinate(String raw, double limit, String label) {
        if (raw.isEmpty()) {
            return null;
        }
        try {
            double v = Double.parseDouble(raw.replace(',', '.'));
            if (Math.abs(v) > limit) {
                throw new IllegalArgumentException(label + " fora do intervalo permitido");
            }
            return v;
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(label + " inválida");
        }
    }

    private static String form(Context ctx, String name) {
        String v = ctx.formParam(name);
        return v == null ? "" : v.strip();
    }
}
