package br.forum.aquaml.monitoring.interfaces;

import br.forum.aquaml.monitoring.application.StationService.StationOverview;
import br.forum.aquaml.monitoring.domain.Station;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.List;

/** JSON {@code Station} do contrato: cadastro + o que a última análise disse da estação. */
public record StationResponse(String id, String name, String type, Double lat, Double lon, Latest latest,
                              String predictedClass, String clusterLabel, int alertsRecent,
                              List<String> worseningTrends) {

    /** Última leitura diária consolidada: {@code {date, iqa, iqaClass}}. */
    public record Latest(String date, Double iqa, String iqaClass) {
    }

    public static StationResponse from(StationOverview overview) {
        Station s = overview.station();
        JsonNode a = overview.analysis();
        if (a == null) {
            return new StationResponse(s.getId(), s.getName(), s.getType().code(), s.getLat(), s.getLon(),
                    null, null, null, 0, List.of());
        }
        JsonNode l = a.path("latest");
        Latest latest = l.isObject()
                ? new Latest(text(l.path("date")), l.path("iqa").isNumber() ? l.path("iqa").asDouble() : null,
                text(l.path("iqaClass")))
                : null;
        List<String> trends = new ArrayList<>();
        a.path("worseningTrends").forEach(t -> trends.add(t.asText()));
        return new StationResponse(s.getId(), s.getName(), s.getType().code(), s.getLat(), s.getLon(), latest,
                text(a.path("predictedClass")), text(a.path("clusterLabel")), a.path("alertsRecent").asInt(0), trends);
    }

    private static String text(JsonNode n) {
        return n.isTextual() ? n.asText() : null;
    }
}
