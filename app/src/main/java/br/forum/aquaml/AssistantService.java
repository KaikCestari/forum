package br.forum.aquaml;

import br.forum.aquaml.LlamaClient.Message;
import com.fasterxml.jackson.databind.JsonNode;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Assistente de análise com Llama. Cada pergunta vai acompanhada de um
 * contexto montado a partir da última análise e de consultas ao H2, para que
 * o modelo responda com os números reais do monitoramento, e não de memória.
 */
public class AssistantService {

    public record Answer(long id, String question, String answer, String model, long durationMs) {}

    private static final int HISTORY_TURNS = 3;
    private static final int MAX_ALERTS = 12;
    private static final int MONTHS = 6;

    private static final String SYSTEM = """
            Você é o assistente de análise do AquaML, um sistema de monitoramento da qualidade da água em \
            ecossistemas aquáticos. Responda sempre em português do Brasil, de forma direta e objetiva.
            Regras:
            - Use somente os dados do CONTEXTO abaixo. Cite números, estações e datas quando ajudarem.
            - Se o contexto não tiver a informação, diga claramente que ela não está nos dados.
            - IQA vai de 0 a 100: Ótima >= 80, Boa >= 52, Regular >= 37, Ruim >= 20, Péssima < 20.
            - Limites da Resolução CONAMA 357/2005 (classe 2): OD >= 5 mg/L, coliformes <= 1.000 NMP/100mL, \
            nitrato <= 10 mg/L, turbidez <= 100 NTU, pH entre 6 e 9.
            - Quando fizer sentido, termine com recomendações práticas (coleta de campo, fiscalização, \
            conferência de sensores).
            - Não invente medições nem estações.
            """;

    private final LlamaClient llama;
    private final ResultsRepository repo;
    private final Database db;

    public AssistantService(LlamaClient llama, ResultsRepository repo, Database db) {
        this.llama = llama;
        this.repo = repo;
        this.db = db;
    }

    public LlamaClient.Status status() {
        return llama.status();
    }

    public Answer ask(String question) throws IOException, InterruptedException {
        List<Message> messages = new ArrayList<>();
        messages.add(new Message("system", SYSTEM + "\nCONTEXTO\n" + context()));
        for (Map<String, Object> m : db.messages(HISTORY_TURNS)) {
            messages.add(new Message("user", (String) m.get("question")));
            messages.add(new Message("assistant", (String) m.get("answer")));
        }
        messages.add(new Message("user", question));

        long t0 = System.nanoTime();
        String answer = llama.chat(messages);
        long ms = (System.nanoTime() - t0) / 1_000_000;
        long id = db.saveMessage(question, answer, llama.model(), ms);
        return new Answer(id, question, answer, llama.model(), ms);
    }

    /** Texto compacto com o estado atual da bacia; também exposto na API para conferência. */
    public String context() {
        StringBuilder sb = new StringBuilder();
        JsonNode r = repo.current();
        Map<String, Object> summary = db.summary();
        @SuppressWarnings("unchecked")
        Map<String, Object> totals = (Map<String, Object>) summary.get("totals");
        @SuppressWarnings("unchecked")
        Map<String, Object> ds = (Map<String, Object>) summary.get("dataset");

        sb.append("## Conjunto de dados (banco H2)\n");
        if (ds != null) {
            sb.append("Origem: ").append("real".equals(ds.get("source")) ? "dados reais importados" : "dados sintéticos de demonstração");
            if (ds.get("name") != null) {
                sb.append(" (").append(ds.get("name")).append(')');
            }
            sb.append(". ");
        }
        if (totals.get("first_reading") != null) {
            sb.append(totals.get("stations")).append(" estações, ").append(totals.get("measurements"))
                    .append(" leituras horárias de ").append(totals.get("first_reading")).append(" a ")
                    .append(totals.get("last_reading")).append(".\n");
        }

        if (r == null) {
            sb.append("Ainda não há análise concluída.\n");
            return sb.toString();
        }
        sb.append("Período analisado: ").append(r.path("period").path(0).asText()).append(" a ")
                .append(r.path("period").path(1).asText()).append(".\n\n");

        sb.append("## Estações\n");
        Map<String, String> names = new LinkedHashMap<>();
        for (JsonNode s : r.path("stations")) {
            names.put(s.path("id").asText(), s.path("name").asText());
            JsonNode last = s.path("latest");
            sb.append("- ").append(s.path("id").asText()).append(" ").append(s.path("name").asText())
                    .append(" (").append(s.path("type").asText()).append("): IQA médio 30 dias ")
                    .append(num(s.path("iqa_30d"), 1)).append(", média do período ").append(num(s.path("iqa_period"), 1))
                    .append(". Última leitura ").append(last.path("date").asText()).append(": IQA ")
                    .append(num(last.path("iqa"), 0)).append(" (").append(last.path("iqa_class").asText()).append("), OD ")
                    .append(num(last.path("do_mgl"), 2)).append(" mg/L, pH ").append(num(last.path("ph"), 2))
                    .append(", coliformes ").append(num(last.path("coliforms_nmp"), 0)).append(" NMP/100mL, fósforo ")
                    .append(num(last.path("phosphorus_mgl"), 3)).append(" mg/L, nitrato ")
                    .append(num(last.path("nitrate_mgl"), 2)).append(" mg/L, turbidez ")
                    .append(num(last.path("turbidity_ntu"), 1)).append(" NTU.");
            JsonNode pred = s.path("predicted");
            if (pred.isObject()) {
                sb.append(" Classe prevista pelo Random Forest: ").append(pred.path("predicted").asText())
                        .append(" (confiança ").append(num(pred.path("confidence").asDouble() * 100, 0)).append("%).");
            }
            if (s.path("cluster_label").isTextual()) {
                sb.append(" Perfil K-Means: ").append(s.path("cluster_label").asText()).append('.');
            }
            if (s.path("worsening_trends").size() > 0) {
                List<String> w = new ArrayList<>();
                s.path("worsening_trends").forEach(t -> w.add(t.asText()));
                sb.append(" Tendências de piora: ").append(String.join(", ", w)).append('.');
            }
            sb.append(" Alertas: ").append(s.path("alerts_total").asInt()).append(" no período (")
                    .append(s.path("alerts_recent").asInt()).append(" nos últimos 30 dias, ")
                    .append(s.path("critical_total").asInt()).append(" críticos).\n");
        }

        sb.append("\n## Conclusões da análise\n");
        r.path("insights").forEach(i -> sb.append("- ").append(i.asText()).append('\n'));

        sb.append("\n## Alertas mais recentes\n");
        List<JsonNode> alerts = new ArrayList<>();
        r.path("alerts").forEach(alerts::add);
        alerts.sort((a, b) -> b.path("end").asText().compareTo(a.path("end").asText()));
        alerts.stream().limit(MAX_ALERTS).forEach(a -> sb.append("- [").append(a.path("severity").asText())
                .append("] ").append(a.path("start").asText())
                .append(a.path("end").asText().equals(a.path("start").asText()) ? "" : " a " + a.path("end").asText())
                .append(", ").append(names.getOrDefault(a.path("station_id").asText(), a.path("station_id").asText()))
                .append(": ").append(a.path("title").asText()).append(". ").append(a.path("message").asText())
                .append('\n'));

        sb.append("\n## Tendências significativas (Mann-Kendall sazonal)\n");
        int trends = 0;
        for (JsonNode t : r.path("trends")) {
            if (t.path("significant").asBoolean() && t.has("station_id")) {
                trends++;
                sb.append("- ").append(names.getOrDefault(t.path("station_id").asText(), t.path("station_id").asText()))
                        .append(", ").append(t.path("label").asText()).append(": ").append(t.path("verdict").asText())
                        .append(" (").append(t.path("direction").asText()).append(" de ")
                        .append(num(t.path("pct_per_year"), 1)).append("% ao ano, p = ")
                        .append(num(t.path("p_value"), 3)).append(")\n");
            }
        }
        if (trends == 0) {
            sb.append("- Nenhuma tendência significativa.\n");
        }

        sb.append("\n## IQA mensal (consulta SQL no H2, últimos ").append(MONTHS).append(" meses)\n");
        Map<String, List<String>> monthly = new LinkedHashMap<>();
        for (Map<String, Object> m : db.monthly(null)) {
            monthly.computeIfAbsent((String) m.get("station_id"), k -> new ArrayList<>())
                    .add(m.get("month") + " IQA " + m.get("iqa_mean") + " (mín " + m.get("iqa_min") + ", "
                            + m.get("anomaly_days") + " dias anômalos)");
        }
        monthly.forEach((sid, months) -> sb.append("- ").append(names.getOrDefault(sid, sid)).append(": ")
                .append(String.join("; ", months.subList(Math.max(0, months.size() - MONTHS), months.size())))
                .append('\n'));

        JsonNode clf = r.path("classification");
        sb.append("\n## Modelos\n- Random Forest: acurácia ").append(num(clf.path("accuracy").asDouble() * 100, 0))
                .append("% em dados futuros.\n");
        JsonNode ev = r.path("anomalies").path("evaluation");
        if (ev.isObject()) {
            int hits = 0;
            for (JsonNode e : ev.path("events")) {
                hits += e.path("detected").asBoolean() ? 1 : 0;
            }
            sb.append("- Isolation Forest: ").append(hits).append(" de ").append(ev.path("events").size())
                    .append(" eventos conhecidos detectados.\n");
        }
        sb.append("- Episódios anômalos encontrados: ").append(r.path("anomalies").path("episodes").size()).append(".\n");
        return sb.toString();
    }

    private static String num(JsonNode n, int digits) {
        return n.isNumber() ? num(n.asDouble(), digits) : "n/d";
    }

    private static String num(double v, int digits) {
        return String.format(Locale.ROOT, "%." + digits + "f", v);
    }
}
