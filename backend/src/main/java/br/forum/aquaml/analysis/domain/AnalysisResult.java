package br.forum.aquaml.analysis.domain;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Objeto de valor com o resultado completo devolvido pelo serviço de ML (formato {@code AnalysisResult} do
 * contrato). Guardamos o JSON inteiro e oferecemos leituras fáceis das partes que o backend usa.
 */
public final class AnalysisResult {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final String json;
    private final JsonNode root;

    private AnalysisResult(String json, JsonNode root) {
        this.json = json;
        this.root = root;
    }

    /** Lê o JSON; se não for um objeto, a análise é considerada inválida. */
    public static AnalysisResult fromJson(String json) {
        try {
            JsonNode root = MAPPER.readTree(json);
            if (root == null || !root.isObject()) {
                throw new MlServiceException("O serviço de análise devolveu um resultado ilegível.");
            }
            return new AnalysisResult(json, root);
        } catch (JsonProcessingException e) {
            throw new MlServiceException("O serviço de análise devolveu um resultado ilegível.");
        }
    }

    public String json() {
        return json;
    }

    public JsonNode root() {
        return root;
    }

    /** Média do IQA mais recente de cada estação (1 casa decimal), ou null se nenhuma tiver IQA. */
    public Double iqaMean() {
        double sum = 0;
        int n = 0;
        for (JsonNode s : root.path("stations")) {
            JsonNode iqa = s.path("latest").path("iqa");
            if (iqa.isNumber()) {
                sum += iqa.asDouble();
                n++;
            }
        }
        return n == 0 ? null : Math.round(sum / n * 10) / 10.0;
    }

    /** Acurácia do classificador (Random Forest), ou null se não houver. */
    public Double accuracy() {
        JsonNode a = root.path("classification").path("accuracy");
        return a.isNumber() ? a.asDouble() : null;
    }

    public List<String> insights() {
        List<String> out = new ArrayList<>();
        root.path("insights").forEach(i -> out.add(i.asText()));
        return out;
    }

    /** Alertas do resultado, já como entidades ligadas à execução {@code runId}. */
    public List<Alert> alerts(Long runId) {
        List<Alert> out = new ArrayList<>();
        for (JsonNode a : root.path("alerts")) {
            out.add(new Alert(runId, a.path("stationId").asText(""), parseDate(a.path("date").asText("")),
                    a.path("parameter").asText(""), a.path("value").isNumber() ? a.path("value").asDouble() : null,
                    a.path("unit").asText(""), a.path("severity").asText("atencao"), a.path("message").asText("")));
        }
        return out;
    }

    public int alertCount() {
        return root.path("alerts").size();
    }

    /** Resumo da estação no resultado ({@code stations[]}), se ela foi analisada. */
    public Optional<JsonNode> station(String stationId) {
        for (JsonNode s : root.path("stations")) {
            if (stationId.equals(s.path("stationId").asText())) {
                return Optional.of(s);
            }
        }
        return Optional.empty();
    }

    /** Série diária da estação ({@code series[id]}). */
    public Optional<JsonNode> series(String stationId) {
        JsonNode s = root.path("series").path(stationId);
        return s.isObject() ? Optional.of(s) : Optional.empty();
    }

    private static LocalDate parseDate(String s) {
        try {
            return s.length() >= 10 ? LocalDate.parse(s.substring(0, 10)) : null;
        } catch (RuntimeException e) {
            return null;
        }
    }
}
