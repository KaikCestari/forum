package br.forum.aquaml;

import com.fasterxml.jackson.databind.JsonNode;
import org.h2.jdbcx.JdbcConnectionPool;

import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Banco H2 do AquaML. Guarda o conjunto de dados atual (estações, leituras
 * horárias e eventos conhecidos), o histórico de análises com a série diária
 * e os alertas, e as conversas com o assistente Llama.
 */
public class Database implements AutoCloseable {

    public static final List<String> PARAMS = List.of("ph", "do_mgl", "temp_c", "turbidity_ntu",
            "conductivity_uscm", "nitrate_mgl", "phosphorus_mgl", "coliforms_nmp");
    /** Execuções que mantêm o results.json completo; as mais antigas guardam só o resumo. */
    private static final int KEEP_FULL_RESULTS = 5;
    private static final DateTimeFormatter ISO = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    public record Station(String id, String name, String type, Double lat, Double lon) {}

    public record Measurement(String stationId, LocalDateTime time, Double[] values) {}

    public record Event(String stationId, LocalDate start, LocalDate end, String type, String description) {}

    private final JdbcConnectionPool pool;

    public Database(String url) {
        pool = JdbcConnectionPool.create(url, "sa", "");
        migrate();
    }

    @Override
    public void close() {
        pool.dispose();
    }

    private void migrate() {
        String params = String.join(", ", PARAMS.stream().map(p -> p + " DOUBLE").toList());
        exec("""
                CREATE TABLE IF NOT EXISTS dataset (
                    id INT PRIMARY KEY, source VARCHAR(20) NOT NULL, name VARCHAR(255),
                    imported_at TIMESTAMP WITH TIME ZONE NOT NULL)""",
                """
                CREATE TABLE IF NOT EXISTS stations (
                    id VARCHAR(64) PRIMARY KEY, name VARCHAR(255) NOT NULL, type VARCHAR(32) NOT NULL,
                    lat DOUBLE, lon DOUBLE)""",
                "CREATE TABLE IF NOT EXISTS measurements (station_id VARCHAR(64) NOT NULL, ts TIMESTAMP NOT NULL, "
                        + params + ", PRIMARY KEY (station_id, ts))",
                """
                CREATE TABLE IF NOT EXISTS events (
                    station_id VARCHAR(64) NOT NULL, start_date DATE NOT NULL, end_date DATE NOT NULL,
                    type VARCHAR(64), description VARCHAR(1000))""",
                """
                CREATE TABLE IF NOT EXISTS analysis_runs (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY, created_at TIMESTAMP WITH TIME ZONE NOT NULL,
                    source VARCHAR(20), dataset_name VARCHAR(255), period_start DATE, period_end DATE,
                    stations INT, alerts INT, critical_alerts INT, accuracy DOUBLE, mean_iqa DOUBLE,
                    results CLOB)""",
                "CREATE TABLE IF NOT EXISTS daily (station_id VARCHAR(64) NOT NULL, obs_date DATE NOT NULL, "
                        + params + ", do_sat_pct DOUBLE, iqa DOUBLE, iqa_class VARCHAR(16), anomaly BOOLEAN, "
                        + "PRIMARY KEY (station_id, obs_date))",
                """
                CREATE TABLE IF NOT EXISTS alerts (
                    run_id BIGINT NOT NULL, station_id VARCHAR(64), severity VARCHAR(16), category VARCHAR(32),
                    parameter VARCHAR(32), title VARCHAR(255), message VARCHAR(2000), recommendation VARCHAR(2000),
                    start_date DATE, end_date DATE, days INT,
                    FOREIGN KEY (run_id) REFERENCES analysis_runs(id) ON DELETE CASCADE)""",
                """
                CREATE TABLE IF NOT EXISTS assistant_messages (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY, created_at TIMESTAMP WITH TIME ZONE NOT NULL,
                    question CLOB NOT NULL, answer CLOB NOT NULL, model VARCHAR(64), duration_ms BIGINT,
                    run_id BIGINT)""");
    }

    /* ---------------- conjunto de dados ---------------- */

    /** Substitui todo o conjunto de dados atual numa única transação. */
    public void replaceDataset(String source, String name, List<Station> stations,
                               List<Measurement> measurements, List<Event> events) {
        inTransaction(c -> {
            try (Statement s = c.createStatement()) {
                s.execute("DELETE FROM measurements");
                s.execute("DELETE FROM events");
                s.execute("DELETE FROM stations");
                s.execute("DELETE FROM dataset");
            }
            try (PreparedStatement ps = c.prepareStatement("INSERT INTO stations VALUES (?, ?, ?, ?, ?)")) {
                for (Station st : stations) {
                    ps.setString(1, st.id());
                    ps.setString(2, st.name());
                    ps.setString(3, st.type());
                    setDouble(ps, 4, st.lat());
                    setDouble(ps, 5, st.lon());
                    ps.addBatch();
                }
                ps.executeBatch();
            }
            String marks = "?, ".repeat(PARAMS.size() + 1) + "?";
            try (PreparedStatement ps = c.prepareStatement(
                    "MERGE INTO measurements (station_id, ts, " + String.join(", ", PARAMS) + ") VALUES (" + marks + ")")) {
                int n = 0;
                for (Measurement m : measurements) {
                    ps.setString(1, m.stationId());
                    ps.setTimestamp(2, Timestamp.valueOf(m.time()));
                    for (int i = 0; i < PARAMS.size(); i++) {
                        setDouble(ps, i + 3, m.values()[i]);
                    }
                    ps.addBatch();
                    if (++n % 5000 == 0) {
                        ps.executeBatch();
                    }
                }
                ps.executeBatch();
            }
            try (PreparedStatement ps = c.prepareStatement("INSERT INTO events VALUES (?, ?, ?, ?, ?)")) {
                for (Event e : events) {
                    ps.setString(1, e.stationId());
                    ps.setObject(2, e.start());
                    ps.setObject(3, e.end());
                    ps.setString(4, e.type());
                    ps.setString(5, e.description());
                    ps.addBatch();
                }
                ps.executeBatch();
            }
            try (PreparedStatement ps = c.prepareStatement("INSERT INTO dataset VALUES (1, ?, ?, ?)")) {
                ps.setString(1, source);
                ps.setString(2, name);
                ps.setObject(3, Instant.now().atOffset(java.time.ZoneOffset.UTC));
                ps.executeUpdate();
            }
            return null;
        });
    }

    public long measurementCount() {
        return ((Number) query("SELECT COUNT(*) AS n FROM measurements").get(0).get("n")).longValue();
    }

    public Optional<Map<String, Object>> dataset() {
        return query("SELECT source, name, imported_at FROM dataset WHERE id = 1").stream().findFirst();
    }

    /**
     * Escreve o conjunto atual nos CSVs que o processador Rust e a etapa de ML
     * leem. Sem eventos conhecidos, remove o events.csv (a avaliação é opcional).
     */
    public void exportCsv(Path rawDir) throws IOException {
        Files.createDirectories(rawDir);
        try (BufferedWriter w = Files.newBufferedWriter(rawDir.resolve("stations.csv"), StandardCharsets.UTF_8)) {
            w.write("id,name,type,lat,lon\n");
            for (Map<String, Object> r : query("SELECT * FROM stations ORDER BY id")) {
                w.write(String.join(",", csv(r.get("id")), csv(r.get("name")), csv(r.get("type")),
                        csv(r.get("lat")), csv(r.get("lon"))) + "\n");
            }
        }
        withConnection(c -> {
            try (BufferedWriter w = Files.newBufferedWriter(rawDir.resolve("measurements.csv"), StandardCharsets.UTF_8);
                 Statement s = c.createStatement();
                 ResultSet rs = s.executeQuery("SELECT * FROM measurements ORDER BY station_id, ts")) {
                w.write("timestamp,station_id," + String.join(",", PARAMS) + "\n");
                StringBuilder line = new StringBuilder();
                while (rs.next()) {
                    line.setLength(0);
                    line.append(rs.getTimestamp("ts").toLocalDateTime().format(ISO)).append(',')
                            .append(csv(rs.getString("station_id")));
                    for (String p : PARAMS) {
                        double v = rs.getDouble(p);
                        line.append(',');
                        if (!rs.wasNull()) {
                            line.append(String.format(Locale.ROOT, "%.4f", v));
                        }
                    }
                    w.write(line.append('\n').toString());
                }
            }
            return null;
        });
        List<Map<String, Object>> events = query("SELECT * FROM events ORDER BY start_date");
        Path eventsFile = rawDir.resolve("events.csv");
        if (events.isEmpty()) {
            Files.deleteIfExists(eventsFile);
            return;
        }
        try (BufferedWriter w = Files.newBufferedWriter(eventsFile, StandardCharsets.UTF_8)) {
            w.write("station_id,start,end,type,description\n");
            for (Map<String, Object> r : events) {
                w.write(String.join(",", csv(r.get("station_id")), csv(r.get("start_date")), csv(r.get("end_date")),
                        csv(r.get("type")), csv(r.get("description"))) + "\n");
            }
        }
    }

    /* ---------------- análises ---------------- */

    /** Grava uma execução: resumo, results.json completo, alertas e a série diária atual. */
    public long saveRun(JsonNode results) {
        return inTransaction(c -> {
            Map<String, Object> ds = dataset().orElse(Map.of());
            JsonNode stations = results.path("stations");
            double iqaSum = 0;
            int iqaN = 0;
            for (JsonNode s : stations) {
                if (s.path("iqa_30d").isNumber()) {
                    iqaSum += s.get("iqa_30d").asDouble();
                    iqaN++;
                }
            }
            int critical = 0;
            for (JsonNode a : results.path("alerts")) {
                critical += "critico".equals(a.path("severity").asText()) ? 1 : 0;
            }
            long runId;
            try (PreparedStatement ps = c.prepareStatement("""
                    INSERT INTO analysis_runs (created_at, source, dataset_name, period_start, period_end,
                        stations, alerts, critical_alerts, accuracy, mean_iqa, results)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""", Statement.RETURN_GENERATED_KEYS)) {
                ps.setObject(1, Instant.now().atOffset(java.time.ZoneOffset.UTC));
                ps.setString(2, (String) ds.getOrDefault("source", "sintetico"));
                ps.setString(3, (String) ds.get("name"));
                ps.setObject(4, date(results.path("period").path(0)));
                ps.setObject(5, date(results.path("period").path(1)));
                ps.setInt(6, stations.size());
                ps.setInt(7, results.path("alerts").size());
                ps.setInt(8, critical);
                setDouble(ps, 9, results.path("classification").path("accuracy").isNumber()
                        ? results.path("classification").path("accuracy").asDouble() : null);
                setDouble(ps, 10, iqaN > 0 ? iqaSum / iqaN : null);
                ps.setString(11, results.toString());
                ps.executeUpdate();
                try (ResultSet keys = ps.getGeneratedKeys()) {
                    keys.next();
                    runId = keys.getLong(1);
                }
            }
            try (PreparedStatement ps = c.prepareStatement("INSERT INTO alerts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")) {
                for (JsonNode a : results.path("alerts")) {
                    ps.setLong(1, runId);
                    ps.setString(2, text(a, "station_id"));
                    ps.setString(3, text(a, "severity"));
                    ps.setString(4, text(a, "category"));
                    ps.setString(5, text(a, "parameter"));
                    ps.setString(6, clip(text(a, "title"), 255));
                    ps.setString(7, clip(text(a, "message"), 2000));
                    ps.setString(8, clip(text(a, "recommendation"), 2000));
                    ps.setObject(9, date(a.path("start")));
                    ps.setObject(10, date(a.path("end")));
                    ps.setInt(11, a.path("days").asInt());
                    ps.addBatch();
                }
                ps.executeBatch();
            }
            saveDaily(c, results.path("series"));
            try (PreparedStatement ps = c.prepareStatement(
                    "UPDATE analysis_runs SET results = NULL WHERE id <= ? AND results IS NOT NULL")) {
                ps.setLong(1, runId - KEEP_FULL_RESULTS);
                ps.executeUpdate();
            }
            return runId;
        });
    }

    private static void saveDaily(Connection c, JsonNode series) throws SQLException {
        try (Statement s = c.createStatement()) {
            s.execute("DELETE FROM daily");
        }
        List<String> cols = new ArrayList<>(PARAMS);
        cols.addAll(List.of("do_sat_pct", "iqa"));
        String sql = "INSERT INTO daily (station_id, obs_date, " + String.join(", ", cols) + ", iqa_class, anomaly) VALUES ("
                + "?, ".repeat(cols.size() + 3) + "?)";
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            var it = series.fields();
            int n = 0;
            while (it.hasNext()) {
                var e = it.next();
                JsonNode s = e.getValue();
                JsonNode dates = s.path("dates");
                for (int d = 0; d < dates.size(); d++) {
                    ps.setString(1, e.getKey());
                    ps.setObject(2, LocalDate.parse(dates.get(d).asText()));
                    for (int i = 0; i < cols.size(); i++) {
                        JsonNode v = s.path(cols.get(i)).path(d);
                        setDouble(ps, i + 3, v.isNumber() ? v.asDouble() : null);
                    }
                    String cls = s.path("iqa_class").path(d).asText("");
                    ps.setString(cols.size() + 3, cls.isEmpty() ? null : cls);
                    ps.setBoolean(cols.size() + 4, s.path("anomaly").path(d).asBoolean(false));
                    ps.addBatch();
                    if (++n % 5000 == 0) {
                        ps.executeBatch();
                    }
                }
            }
            ps.executeBatch();
        }
    }

    /** results.json da execução mais recente, se houver. */
    public Optional<String> latestResults() {
        return query("SELECT results FROM analysis_runs WHERE results IS NOT NULL ORDER BY id DESC LIMIT 1")
                .stream().findFirst().map(r -> (String) r.get("results"));
    }

    public Optional<Long> latestRunId() {
        return query("SELECT MAX(id) AS id FROM analysis_runs").stream()
                .map(r -> (Number) r.get("id")).filter(n -> n != null).map(Number::longValue).findFirst();
    }

    public List<Map<String, Object>> runs(int limit) {
        return query("""
                SELECT id, created_at, source, dataset_name, period_start, period_end, stations, alerts,
                       critical_alerts, accuracy, mean_iqa
                FROM analysis_runs ORDER BY id DESC LIMIT ?""", limit);
    }

    /** IQA mensal por estação, calculado em SQL sobre a série diária da última análise. */
    public List<Map<String, Object>> monthly(String stationId) {
        return query("""
                SELECT d.station_id, s.name AS station_name, FORMATDATETIME(d.obs_date, 'yyyy-MM') AS \"month\",
                       ROUND(AVG(d.iqa), 1) AS iqa_mean, ROUND(MIN(d.iqa), 1) AS iqa_min,
                       ROUND(AVG(d.do_mgl), 2) AS do_mean, ROUND(AVG(d.phosphorus_mgl), 3) AS phosphorus_mean,
                       ROUND(AVG(d.coliforms_nmp), 0) AS coliforms_mean,
                       SUM(CASE WHEN d.anomaly THEN 1 ELSE 0 END) AS anomaly_days, COUNT(*) AS days
                FROM daily d LEFT JOIN stations s ON s.id = d.station_id
                WHERE ? IS NULL OR d.station_id = ?
                GROUP BY d.station_id, s.name, FORMATDATETIME(d.obs_date, 'yyyy-MM')
                ORDER BY d.station_id, \"month\"""", stationId, stationId);
    }

    /** Números do banco para o painel: conjunto atual, cobertura por estação e totais. */
    public Map<String, Object> summary() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("dataset", dataset().orElse(null));
        out.put("totals", query("""
                SELECT (SELECT COUNT(*) FROM stations) AS stations,
                       (SELECT COUNT(*) FROM measurements) AS measurements,
                       (SELECT MIN(ts) FROM measurements) AS first_reading,
                       (SELECT MAX(ts) FROM measurements) AS last_reading,
                       (SELECT COUNT(*) FROM events) AS events,
                       (SELECT COUNT(*) FROM daily) AS daily_rows,
                       (SELECT COUNT(*) FROM analysis_runs) AS runs,
                       (SELECT COUNT(*) FROM assistant_messages) AS messages""").get(0));
        out.put("stations", query("""
                SELECT s.id, s.name, s.type, COUNT(m.ts) AS readings, MIN(m.ts) AS first_reading,
                       MAX(m.ts) AS last_reading,
                       ROUND(CAST(COUNT(m.ts) AS DOUBLE) / GREATEST(1, COUNT(DISTINCT CAST(m.ts AS DATE))), 1) AS readings_per_day
                FROM stations s LEFT JOIN measurements m ON m.station_id = s.id
                GROUP BY s.id, s.name, s.type ORDER BY s.id"""));
        return out;
    }

    /* ---------------- assistente ---------------- */

    public long saveMessage(String question, String answer, String model, long durationMs) {
        Long runId = latestRunId().orElse(null);
        return inTransaction(c -> {
            try (PreparedStatement ps = c.prepareStatement("""
                    INSERT INTO assistant_messages (created_at, question, answer, model, duration_ms, run_id)
                    VALUES (?, ?, ?, ?, ?, ?)""", Statement.RETURN_GENERATED_KEYS)) {
                ps.setObject(1, Instant.now().atOffset(java.time.ZoneOffset.UTC));
                ps.setString(2, question);
                ps.setString(3, answer);
                ps.setString(4, model);
                ps.setLong(5, durationMs);
                if (runId == null) {
                    ps.setNull(6, Types.BIGINT);
                } else {
                    ps.setLong(6, runId);
                }
                ps.executeUpdate();
                try (ResultSet keys = ps.getGeneratedKeys()) {
                    keys.next();
                    return keys.getLong(1);
                }
            }
        });
    }

    /** Últimas mensagens, da mais antiga para a mais nova. */
    public List<Map<String, Object>> messages(int limit) {
        return query("""
                SELECT * FROM (SELECT id, created_at, question, answer, model, duration_ms
                               FROM assistant_messages ORDER BY id DESC LIMIT ?) ORDER BY id""", limit);
    }

    public void clearMessages() {
        exec("DELETE FROM assistant_messages");
    }

    /* ---------------- utilidades JDBC ---------------- */

    @FunctionalInterface
    private interface Work<T> {
        T run(Connection c) throws SQLException, IOException;
    }

    private <T> T withConnection(Work<T> work) {
        try (Connection c = pool.getConnection()) {
            return work.run(c);
        } catch (SQLException | IOException e) {
            throw new IllegalStateException("Erro no banco H2: " + e.getMessage(), e);
        }
    }

    private <T> T inTransaction(Work<T> work) {
        return withConnection(c -> {
            c.setAutoCommit(false);
            try {
                T out = work.run(c);
                c.commit();
                return out;
            } catch (SQLException | IOException | RuntimeException e) {
                c.rollback();
                throw e;
            } finally {
                c.setAutoCommit(true);
            }
        });
    }

    private void exec(String... sql) {
        withConnection(c -> {
            try (Statement s = c.createStatement()) {
                for (String q : sql) {
                    s.execute(q);
                }
            }
            return null;
        });
    }

    /** Consulta com parâmetros posicionais; datas viram texto ISO para o JSON da API. */
    public List<Map<String, Object>> query(String sql, Object... args) {
        return withConnection(c -> {
            try (PreparedStatement ps = c.prepareStatement(sql)) {
                for (int i = 0; i < args.length; i++) {
                    ps.setObject(i + 1, args[i]);
                }
                try (ResultSet rs = ps.executeQuery()) {
                    ResultSetMetaData md = rs.getMetaData();
                    List<Map<String, Object>> rows = new ArrayList<>();
                    while (rs.next()) {
                        Map<String, Object> row = new LinkedHashMap<>();
                        for (int i = 1; i <= md.getColumnCount(); i++) {
                            row.put(md.getColumnLabel(i).toLowerCase(Locale.ROOT), jsonValue(rs.getObject(i)));
                        }
                        rows.add(row);
                    }
                    return rows;
                }
            }
        });
    }

    private static Object jsonValue(Object v) throws SQLException {
        if (v instanceof java.sql.Clob clob) {
            return clob.getSubString(1, (int) clob.length());
        }
        if (v instanceof Timestamp t) {
            return t.toLocalDateTime().format(ISO);
        }
        if (v instanceof java.sql.Date d) {
            return d.toLocalDate().toString();
        }
        if (v instanceof java.time.temporal.TemporalAccessor) {
            return v.toString();
        }
        return v;
    }

    private static void setDouble(PreparedStatement ps, int i, Double v) throws SQLException {
        if (v == null || v.isNaN() || v.isInfinite()) {
            ps.setNull(i, Types.DOUBLE);
        } else {
            ps.setDouble(i, v);
        }
    }

    private static LocalDate date(JsonNode n) {
        return n.isTextual() && !n.asText().isBlank() ? LocalDate.parse(n.asText().substring(0, 10)) : null;
    }

    private static String text(JsonNode n, String field) {
        JsonNode v = n.path(field);
        return v.isNull() || v.isMissingNode() ? null : v.asText();
    }

    private static String clip(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }

    private static String csv(Object v) {
        if (v == null) {
            return "";
        }
        String s = v.toString();
        return s.contains(",") || s.contains("\"") || s.contains("\n") ? "\"" + s.replace("\"", "\"\"") + "\"" : s;
    }
}
