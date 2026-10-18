package br.forum.aquaml;

import br.forum.aquaml.Database.Event;
import br.forum.aquaml.Database.Measurement;
import br.forum.aquaml.Database.Station;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.Reader;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoField;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Lê os CSVs de dados reais (leituras, estações e eventos). Aceita vírgula ou
 * ponto e vírgula como separador (com vírgula decimal no segundo caso), datas
 * ISO ou dd/MM/yyyy e nomes de coluna em português.
 */
public final class CsvImport {

    /** Erro de formato, com mensagem para quem enviou o arquivo. */
    public static class ImportException extends Exception {
        public ImportException(String message) {
            super(message);
        }
    }

    public record Parsed(List<Measurement> measurements, Set<String> stationIds, List<String> missingParams,
                         int skippedRows, double readingsPerDay) {}

    private static final Map<String, String> ALIASES = new HashMap<>();

    static {
        alias("timestamp", "datetime", "data_hora", "datahora", "data", "date", "time", "horario");
        alias("station_id", "station", "estacao", "id_estacao", "codigo", "posto");
        alias("do_mgl", "do", "od", "od_mgl", "oxigenio", "oxigenio_dissolvido", "dissolved_oxygen");
        alias("temp_c", "temp", "temperatura", "temperatura_agua", "water_temperature", "temperature");
        alias("turbidity_ntu", "turbidity", "turbidez", "turbidez_ntu");
        alias("conductivity_uscm", "conductivity", "condutividade", "condutividade_uscm", "condutividade_us_cm");
        alias("nitrate_mgl", "nitrate", "nitrato", "nitrato_mgl", "nitrogenio");
        alias("phosphorus_mgl", "phosphorus", "fosforo", "fosforo_total", "fosforo_mgl");
        alias("coliforms_nmp", "coliforms", "coliformes", "coliformes_termotolerantes", "e_coli", "ecoli");
        alias("id", "station_id", "estacao", "codigo");
        alias("name", "nome", "station_name");
        alias("type", "tipo", "ambiente");
        alias("lat", "latitude");
        alias("lon", "lng", "longitude");
        alias("start", "inicio", "start_date");
        alias("end", "fim", "end_date");
        alias("description", "descricao");
    }

    private static void alias(String canonical, String... names) {
        ALIASES.putIfAbsent(canonical, canonical);
        for (String n : names) {
            ALIASES.putIfAbsent(n, canonical);
        }
    }

    private static final Set<String> STATION_TYPES = Set.of("rio", "lago", "reservatorio", "estuario");

    private static final DateTimeFormatter DATE_TIME = new DateTimeFormatterBuilder()
            .appendOptional(DateTimeFormatter.ofPattern("yyyy-MM-dd"))
            .appendOptional(DateTimeFormatter.ofPattern("dd/MM/yyyy"))
            .optionalStart().appendLiteral('T').optionalEnd()
            .optionalStart().appendLiteral(' ').optionalEnd()
            .optionalStart().appendPattern("HH:mm").optionalStart().appendPattern(":ss").optionalEnd()
            .optionalStart().appendFraction(ChronoField.NANO_OF_SECOND, 0, 9, true).optionalEnd().optionalEnd()
            .parseDefaulting(ChronoField.HOUR_OF_DAY, 0)
            .toFormatter(Locale.ROOT);

    private CsvImport() {}

    /** Leituras: exige data/hora e estação; parâmetros ausentes ficam vazios. */
    public static Parsed measurements(Reader in) throws IOException, ImportException {
        Table t = read(in);
        int ts = t.require("timestamp", "data/hora (timestamp)");
        int st = t.require("station_id", "estação (station_id)");
        int[] idx = Database.PARAMS.stream().mapToInt(t::index).toArray();
        List<String> missing = new ArrayList<>();
        for (int i = 0; i < idx.length; i++) {
            if (idx[i] < 0) {
                missing.add(Database.PARAMS.get(i));
            }
        }
        if (missing.size() == idx.length) {
            throw new ImportException("Nenhuma coluna de parâmetro reconhecida. Use: " + String.join(", ", Database.PARAMS));
        }
        List<Measurement> out = new ArrayList<>(t.rows.size());
        Map<String, Set<LocalDate>> days = new LinkedHashMap<>();
        int skipped = 0;
        for (String[] row : t.rows) {
            LocalDateTime time = parseTime(cell(row, ts));
            String station = cell(row, st);
            if (time == null || station.isEmpty()) {
                skipped++;
                continue;
            }
            Double[] values = new Double[idx.length];
            for (int i = 0; i < idx.length; i++) {
                values[i] = idx[i] < 0 ? null : number(cell(row, idx[i]), t.decimalComma);
            }
            out.add(new Measurement(station, time.withNano(0), values));
            days.computeIfAbsent(station, k -> new java.util.HashSet<>()).add(time.toLocalDate());
        }
        if (out.isEmpty()) {
            throw new ImportException("Nenhuma leitura válida: confira o formato da data/hora (ex.: 2025-03-10T14:00:00 ou 10/03/2025 14:00).");
        }
        int dayCount = days.values().stream().mapToInt(Set::size).sum();
        return new Parsed(out, days.keySet(), missing, skipped, (double) out.size() / Math.max(1, dayCount));
    }

    /** Estações; tipos desconhecidos viram "rio" (limites CONAMA de água doce). */
    public static List<Station> stations(Reader in) throws IOException, ImportException {
        Table t = read(in);
        int id = t.index("id") >= 0 ? t.index("id") : t.require("station_id", "id da estação");
        int name = t.index("name"), type = t.index("type"), lat = t.index("lat"), lon = t.index("lon");
        List<Station> out = new ArrayList<>();
        for (String[] row : t.rows) {
            String sid = cell(row, id);
            if (sid.isEmpty()) {
                continue;
            }
            String n = cell(row, name);
            out.add(new Station(sid, n.isEmpty() ? sid : n, stationType(cell(row, type)),
                    number(cell(row, lat), t.decimalComma), number(cell(row, lon), t.decimalComma)));
        }
        return out;
    }

    /** Eventos conhecidos (opcionais), usados só para avaliar a detecção de anomalias. */
    public static List<Event> events(Reader in) throws IOException, ImportException {
        Table t = read(in);
        int st = t.require("station_id", "estação (station_id)");
        int start = t.require("start", "início (start)");
        int end = t.index("end"), type = t.index("type"), desc = t.index("description");
        List<Event> out = new ArrayList<>();
        for (String[] row : t.rows) {
            LocalDateTime s = parseTime(cell(row, start));
            if (s == null) {
                continue;
            }
            LocalDateTime e = parseTime(cell(row, end));
            String ty = cell(row, type);
            out.add(new Event(cell(row, st), s.toLocalDate(), e == null ? s.toLocalDate() : e.toLocalDate(),
                    ty.isEmpty() ? "evento" : ty, cell(row, desc)));
        }
        return out;
    }

    static String stationType(String raw) {
        String t = normalize(raw);
        if (t.startsWith("lag") || t.startsWith("lake")) {
            return "lago";
        }
        if (t.startsWith("reserv") || t.startsWith("represa") || t.startsWith("acude")) {
            return "reservatorio";
        }
        if (t.startsWith("estu") || t.startsWith("salob")) {
            return "estuario";
        }
        return STATION_TYPES.contains(t) ? t : "rio";
    }

    static LocalDateTime parseTime(String s) {
        if (s.isEmpty()) {
            return null;
        }
        try {
            return LocalDateTime.parse(s, DATE_TIME);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    static Double number(String s, boolean decimalComma) {
        if (s.isEmpty()) {
            return null;
        }
        // Com vírgula decimal, o ponto é separador de milhar ("1.234,5"); sem vírgula, vale o ponto.
        String v = decimalComma && s.contains(",") ? s.replace(".", "").replace(',', '.') : s;
        if (v.startsWith("<")) {
            // Abaixo do limite de detecção: usa metade do limite, prática comum em qualidade da água.
            Double lim = number(v.substring(1).trim(), false);
            return lim == null ? null : lim / 2;
        }
        try {
            double d = Double.parseDouble(v);
            return Double.isFinite(d) ? d : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /* ---------------- leitura genérica de CSV ---------------- */

    private record Table(Map<String, Integer> columns, List<String[]> rows, boolean decimalComma) {
        int index(String canonical) {
            return columns.getOrDefault(canonical, -1);
        }

        int require(String canonical, String what) throws ImportException {
            int i = index(canonical);
            if (i < 0) {
                throw new ImportException("Coluna obrigatória ausente: " + what + ". Colunas encontradas: "
                        + String.join(", ", columns.keySet()));
            }
            return i;
        }
    }

    private static Table read(Reader in) throws IOException, ImportException {
        BufferedReader r = new BufferedReader(in);
        String header = r.readLine();
        if (header == null || header.isBlank()) {
            throw new ImportException("Arquivo vazio.");
        }
        if (header.startsWith("﻿")) {
            header = header.substring(1);
        }
        char sep = count(header, ';') > count(header, ',') ? ';' : count(header, '\t') > count(header, ',') ? '\t' : ',';
        String[] names = split(header, sep);
        Map<String, Integer> cols = new LinkedHashMap<>();
        for (int i = 0; i < names.length; i++) {
            String key = normalize(names[i]);
            cols.putIfAbsent(ALIASES.getOrDefault(key, key), i);
        }
        List<String[]> rows = new ArrayList<>();
        String line;
        while ((line = r.readLine()) != null) {
            if (!line.isBlank()) {
                rows.add(split(line, sep));
            }
        }
        return new Table(cols, rows, sep == ';');
    }

    /** Minúsculas, sem acentos, com unidades entre parênteses removidas: "Fósforo (mg/L)" → "fosforo". */
    static String normalize(String s) {
        String n = Normalizer.normalize(s.trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replaceAll("\\(.*?\\)|\\[.*?]", "")
                .replaceAll("[^a-z0-9]+", "_");
        return n.replaceAll("^_+|_+$", "");
    }

    private static String[] split(String line, char sep) {
        List<String> out = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (quoted) {
                if (c == '"' && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    cur.append('"');
                    i++;
                } else if (c == '"') {
                    quoted = false;
                } else {
                    cur.append(c);
                }
            } else if (c == '"') {
                quoted = true;
            } else if (c == sep) {
                out.add(cur.toString());
                cur.setLength(0);
            } else {
                cur.append(c);
            }
        }
        out.add(cur.toString());
        return out.toArray(String[]::new);
    }

    private static String cell(String[] row, int i) {
        return i < 0 || i >= row.length ? "" : row[i].trim();
    }

    private static int count(String s, char c) {
        return (int) s.chars().filter(x -> x == c).count();
    }
}
