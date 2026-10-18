package br.forum.aquaml;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;
import java.util.function.Predicate;

/** Mantém em memória o último results.json produzido pela etapa de ML. */
public class ResultsRepository {

    private final ObjectMapper mapper = new ObjectMapper();
    private final Path file;
    private volatile JsonNode results;

    public ResultsRepository(Path file) {
        this.file = file;
    }

    /** Recarrega do disco; retorna false se o arquivo ainda não existe. */
    public boolean reload() throws IOException {
        if (!Files.exists(file)) {
            return false;
        }
        results = mapper.readTree(file.toFile());
        return true;
    }

    public boolean isLoaded() {
        return results != null;
    }

    public Optional<JsonNode> get(String field) {
        JsonNode r = results;
        if (r == null || !r.has(field)) {
            return Optional.empty();
        }
        return Optional.of(r.get(field));
    }

    /** Visão geral: tudo exceto as séries temporais completas. */
    public Optional<JsonNode> overview() {
        JsonNode r = results;
        if (r == null) {
            return Optional.empty();
        }
        ObjectNode copy = r.deepCopy();
        copy.remove("series");
        return Optional.of(copy);
    }

    public Optional<JsonNode> series(String stationId) {
        return get("series").map(s -> s.get(stationId));
    }

    public Optional<ArrayNode> filter(String field, Predicate<JsonNode> keep) {
        return get(field).map(arr -> {
            ArrayNode out = mapper.createArrayNode();
            arr.forEach(n -> {
                if (keep.test(n)) {
                    out.add(n);
                }
            });
            return out;
        });
    }
}
