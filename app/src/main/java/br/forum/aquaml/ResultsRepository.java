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

/**
 * Mantém em memória o último results.json produzido pela etapa de ML. A cópia
 * definitiva fica no H2; o arquivo serve de passagem entre o Python e o Java.
 */
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

    /** Esquece a análise atual, quando os dados de sensores são apagados. */
    public void clear() {
        results = null;
    }

    /** Carrega o JSON de uma análise guardada no banco. */
    public void load(String json) throws IOException {
        results = mapper.readTree(json);
    }

    /** Lê o results.json do disco sem publicá-lo; quem chama decide quando usar. */
    public JsonNode readFile() throws IOException {
        return mapper.readTree(file.toFile());
    }

    public void set(JsonNode json) {
        results = json;
    }

    public JsonNode current() {
        return results;
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
