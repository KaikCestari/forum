package br.forum.aquaml.assistant.application;

import br.forum.aquaml.analysis.application.AnalysisService;
import br.forum.aquaml.analysis.domain.AnalysisResult;
import br.forum.aquaml.imagery.application.ImageService;
import br.forum.aquaml.imagery.domain.VisionReading;
import br.forum.aquaml.imagery.domain.WaterImage;
import br.forum.aquaml.monitoring.application.DataService;
import br.forum.aquaml.monitoring.application.DataSummary;
import br.forum.aquaml.monitoring.application.FieldNoteService;
import br.forum.aquaml.monitoring.application.StationService;
import br.forum.aquaml.monitoring.domain.FieldNote;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Monta o texto de CONTEXTO que vai junto com cada pergunta ao assistente: dados atuais, última análise de
 * machine learning, imagens confirmadas pelo biólogo e anotações de campo. Assim o modelo responde com os números
 * reais do monitoramento, e não de memória.
 */
@Component
public class AssistantContextBuilder {

    private static final int MAX_ALERTS = 12;
    private static final int MAX_IMAGES = 15;
    private static final int MAX_NOTES = 15;

    private final DataService data;
    private final StationService stations;
    private final AnalysisService analysis;
    private final ImageService images;
    private final FieldNoteService notes;

    public AssistantContextBuilder(DataService data, StationService stations, AnalysisService analysis,
                                   ImageService images, FieldNoteService notes) {
        this.data = data;
        this.stations = stations;
        this.analysis = analysis;
        this.images = images;
        this.notes = notes;
    }

    public String build() {
        StringBuilder sb = new StringBuilder();
        Map<String, String> names = stations.names();
        appendData(sb, data.summary());
        analysis.latestResult().ifPresentOrElse(
                r -> appendAnalysis(sb, r, names),
                () -> sb.append("Ainda não há análise de dados de sensores. Use as imagens e as anotações abaixo.\n"));
        appendImages(sb, names);
        appendNotes(sb, names);
        return sb.toString();
    }

    private static void appendData(StringBuilder sb, DataSummary s) {
        sb.append("## Dados importados\n");
        if (s.measurements() == 0) {
            sb.append("Nenhuma planilha de sensores importada. ").append(s.stations()).append(" estações cadastradas.\n");
            return;
        }
        sb.append("Planilha: ").append(s.datasetName()).append(". ").append(s.stations()).append(" estações, ")
                .append(s.measurements()).append(" leituras de ").append(s.firstReading()).append(" a ")
                .append(s.lastReading()).append(".\n");
    }

    private static void appendAnalysis(StringBuilder sb, AnalysisResult r, Map<String, String> names) {
        JsonNode root = r.root();
        sb.append("\n## Última análise (período ").append(root.path("period").path("start").asText("?"))
                .append(" a ").append(root.path("period").path("end").asText("?")).append(")\n");
        for (JsonNode s : root.path("stations")) {
            JsonNode latest = s.path("latest");
            sb.append("- ").append(s.path("name").asText(s.path("stationId").asText())).append(" (")
                    .append(s.path("type").asText()).append("): IQA mais recente ").append(num(latest.path("iqa"), 0))
                    .append(" (").append(latest.path("iqaClass").asText("n/d")).append(") em ")
                    .append(latest.path("date").asText("?")).append(", média do período ")
                    .append(num(s.path("iqaPeriod"), 1)).append('.');
            if (s.path("predictedClass").isTextual()) {
                sb.append(" Classe prevista pelo modelo: ").append(s.path("predictedClass").asText()).append('.');
            }
            if (s.path("clusterLabel").isTextual()) {
                sb.append(" Grupo de estações parecidas: ").append(s.path("clusterLabel").asText()).append('.');
            }
            List<String> worse = new ArrayList<>();
            s.path("worseningTrends").forEach(t -> worse.add(t.asText()));
            if (!worse.isEmpty()) {
                sb.append(" Tendência confirmada de piora em: ").append(String.join(", ", worse)).append('.');
            }
            sb.append(" Alertas: ").append(s.path("alertsTotal").asInt()).append(" no período (")
                    .append(s.path("alertsRecent").asInt()).append(" recentes, ")
                    .append(s.path("criticalTotal").asInt()).append(" críticos).\n");
        }
        sb.append("\n## Conclusões\n");
        r.insights().forEach(i -> sb.append("- ").append(i).append('\n'));

        sb.append("\n## Alertas mais recentes\n");
        List<JsonNode> alerts = new ArrayList<>();
        root.path("alerts").forEach(alerts::add);
        alerts.sort((a, b) -> b.path("date").asText().compareTo(a.path("date").asText()));
        alerts.stream().limit(MAX_ALERTS).forEach(a -> sb.append("- [").append(a.path("severity").asText()).append("] ")
                .append(a.path("date").asText()).append(", ")
                .append(names.getOrDefault(a.path("stationId").asText(), a.path("stationId").asText())).append(": ")
                .append(a.path("message").asText()).append('\n'));

        sb.append("\n## Dias fora do padrão (episódios)\n");
        JsonNode episodes = root.path("anomalies").path("episodes");
        sb.append("- ").append(episodes.size()).append(" episódios encontrados.\n");
        for (JsonNode t : root.path("trends")) {
            if (!"estavel".equals(t.path("direction").asText())) {
                sb.append("- Tendência em ").append(names.getOrDefault(t.path("stationId").asText(), t.path("stationId").asText()))
                        .append(", ").append(t.path("parameter").asText()).append(": ").append(t.path("direction").asText())
                        .append('\n');
            }
        }
        Double accuracy = r.accuracy();
        if (accuracy != null) {
            sb.append("\nO modelo de classificação acertou ").append(num(accuracy * 100, 0))
                    .append("% em dados que não viu no treino.\n");
        }
    }

    private void appendImages(StringBuilder sb, Map<String, String> names) {
        sb.append("\n## Imagens conferidas pelo biólogo (indícios visuais, não medições de laboratório)\n");
        List<WaterImage> confirmed = images.confirmed().stream().limit(MAX_IMAGES).toList();
        if (confirmed.isEmpty()) {
            sb.append("- Nenhuma imagem confirmada.\n");
        }
        for (WaterImage i : confirmed) {
            sb.append("- ").append(i.getObservedOn()).append(", ")
                    .append(names.getOrDefault(i.getStationId(), i.getStationId())).append(", ")
                    .append("satelite".equals(i.getKind()) ? "imagem de satélite" : "foto da água").append(": ")
                    .append(describe(i.getVision()));
            if (i.getReviewNotes() != null) {
                sb.append(" Nota de quem conferiu: ").append(i.getReviewNotes());
            }
            sb.append('\n');
        }
    }

    private void appendNotes(StringBuilder sb, Map<String, String> names) {
        sb.append("\n## Anotações de campo (registros da equipe)\n");
        List<FieldNote> list = notes.list(null).stream().limit(MAX_NOTES).toList();
        if (list.isEmpty()) {
            sb.append("- Nenhuma anotação registrada.\n");
        }
        for (FieldNote n : list) {
            sb.append("- ").append(n.getNotedOn()).append(", ")
                    .append(names.getOrDefault(n.getStationId(), n.getStationId())).append(", ").append(n.getKind())
                    .append(": ").append(n.getText()).append('\n');
        }
    }

    private static String describe(VisionReading v) {
        if (v == null) {
            return "sem leitura.";
        }
        List<String> parts = new ArrayList<>();
        if (v.waterColor() != null) {
            parts.add("água " + v.waterColor());
        }
        if (v.turbidity() != null) {
            parts.add("turbidez " + ("media".equals(v.turbidity()) ? "média" : v.turbidity()));
        }
        if (Boolean.TRUE.equals(v.algaeBloom())) {
            parts.add("sinais de floração de algas");
        }
        if (Boolean.TRUE.equals(v.foam())) {
            parts.add("espuma visível");
        }
        if (Boolean.TRUE.equals(v.oil())) {
            parts.add("película de óleo");
        }
        if (Boolean.TRUE.equals(v.floatingDebris())) {
            parts.add("material flutuante");
        }
        if (v.surroundings() != null) {
            parts.add("entorno: " + v.surroundings());
        }
        parts.add("nível de atenção " + v.attentionLevel() + " de 3");
        String text = String.join(", ", parts) + ".";
        return v.summary().isBlank() ? text : text + " " + v.summary();
    }

    private static String num(JsonNode n, int digits) {
        return n.isNumber() ? num(n.asDouble(), digits) : "n/d";
    }

    private static String num(double v, int digits) {
        return String.format(Locale.ROOT, "%." + digits + "f", v);
    }
}
