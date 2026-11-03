package br.forum.aquaml.monitoring.application;

import br.forum.aquaml.analysis.application.AnalysisService;
import br.forum.aquaml.analysis.domain.AnalysisRun;
import br.forum.aquaml.monitoring.application.CsvSpreadsheetParser.ParsedMeasurements;
import br.forum.aquaml.monitoring.domain.Dataset;
import br.forum.aquaml.monitoring.domain.DatasetRepository;
import br.forum.aquaml.monitoring.domain.MeasurementRepository;
import br.forum.aquaml.monitoring.domain.MonitoringEvent;
import br.forum.aquaml.monitoring.domain.MonitoringEventRepository;
import br.forum.aquaml.monitoring.domain.Station;
import br.forum.aquaml.monitoring.domain.StationRepository;
import br.forum.aquaml.monitoring.domain.StationType;
import br.forum.aquaml.shared.domain.BusinessRuleException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.io.InputStream;
import java.io.StringReader;
import java.io.UncheckedIOException;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Caso de uso "importar planilha": lê os CSVs, troca as leituras e eventos atuais pelos novos, cadastra as
 * estações e roda a análise. Se a análise falhar (ex.: serviço de ML fora), a importação continua valendo e a
 * execução volta com status FALHOU.
 */
@Service
public class DataImportService {

    private static final Logger log = LoggerFactory.getLogger(DataImportService.class);
    /** O serviço de ML só usa dias com pelo menos 6 leituras (contrato). */
    private static final double MIN_READINGS_PER_DAY = 6;

    /** Arquivos recebidos; {@code stations} e {@code events} podem ser null. */
    public record ImportCommand(InputStream measurements, String measurementsFileName, InputStream stations,
                                InputStream events, String name) {
    }

    public record ImportResult(String name, int measurements, int stations, int events, double readingsPerDay,
                               List<String> warnings, AnalysisRun analysis) {
    }

    private final StationRepository stationRepo;
    private final MeasurementRepository measurementRepo;
    private final MonitoringEventRepository eventRepo;
    private final DatasetRepository datasetRepo;
    private final AnalysisService analysis;
    private final TransactionTemplate tx;

    public DataImportService(StationRepository stationRepo, MeasurementRepository measurementRepo,
                             MonitoringEventRepository eventRepo, DatasetRepository datasetRepo,
                             AnalysisService analysis, TransactionTemplate tx) {
        this.stationRepo = stationRepo;
        this.measurementRepo = measurementRepo;
        this.eventRepo = eventRepo;
        this.datasetRepo = datasetRepo;
        this.analysis = analysis;
        this.tx = tx;
    }

    public ImportResult importData(ImportCommand cmd) {
        if (cmd.measurements() == null) {
            throw new BusinessRuleException("Envie o CSV de leituras no campo measurements.");
        }
        // 1. Ler e validar tudo antes de mexer no banco.
        ParsedMeasurements parsed = CsvSpreadsheetParser.measurements(new StringReader(text(cmd.measurements())));
        List<Station> csvStations = cmd.stations() == null ? List.of()
                : CsvSpreadsheetParser.stations(new StringReader(text(cmd.stations())));
        List<MonitoringEvent> events = cmd.events() == null ? List.of()
                : CsvSpreadsheetParser.events(new StringReader(text(cmd.events())));
        String name = cmd.name() != null && !cmd.name().isBlank() ? cmd.name().strip()
                : cmd.measurementsFileName() != null && !cmd.measurementsFileName().isBlank()
                ? cmd.measurementsFileName() : "Planilha importada";

        // 2. Gravar numa transação só: ou entra tudo, ou nada.
        int stationCount = tx.execute(status -> {
            List<Station> stations = mergeStations(csvStations, parsed);
            stationRepo.saveAll(stations);
            measurementRepo.removeAll();
            eventRepo.removeAll();
            measurementRepo.saveAll(parsed.measurements());
            eventRepo.saveAll(events);
            datasetRepo.save(new Dataset(name, parsed.measurements().size(), stations.size(), events.size()));
            return stations.size();
        });

        // 3. Rodar a análise; uma falha aqui não desfaz a importação.
        AnalysisRun run = analysis.run();
        log.info("Planilha '{}' importada: {} leituras, análise {}", name, parsed.measurements().size(), run.getStatus());
        return new ImportResult(name, parsed.measurements().size(), stationCount, events.size(),
                Math.round(parsed.readingsPerDay() * 10) / 10.0, warnings(parsed), run);
    }

    /**
     * Estações da planilha atualizam o cadastro; códigos que aparecem só nas leituras viram estações novas
     * (nome = código, tipo rio), sem sobrescrever uma estação já cadastrada.
     */
    private List<Station> mergeStations(List<Station> fromCsv, ParsedMeasurements parsed) {
        Map<String, Station> result = new LinkedHashMap<>();
        for (Station s : fromCsv) {
            Station existing = stationRepo.findById(s.getId()).orElse(null);
            if (existing != null) {
                existing.update(s.getName(), s.getType(), s.getLat(), s.getLon());
                result.put(s.getId(), existing);
            } else {
                result.put(s.getId(), s);
            }
        }
        for (String id : parsed.stationIds()) {
            if (!result.containsKey(id)) {
                result.put(id, stationRepo.findById(id).orElseGet(() -> new Station(id, id, StationType.RIO, null, null)));
            }
        }
        return new ArrayList<>(result.values());
    }

    private static List<String> warnings(ParsedMeasurements parsed) {
        List<String> warnings = new ArrayList<>();
        if (parsed.readingsPerDay() < MIN_READINGS_PER_DAY) {
            warnings.add(String.format(Locale.of("pt", "BR"), "Média de %.1f leituras por dia: a análise só usa dias com pelo "
                    + "menos %.0f leituras. Prefira dados de sensores contínuos (de hora em hora, por exemplo).",
                    parsed.readingsPerDay(), MIN_READINGS_PER_DAY));
        }
        if (!parsed.missingParams().isEmpty()) {
            warnings.add("Parâmetros ausentes (o IQA e os modelos usam só os presentes): "
                    + String.join(", ", parsed.missingParams()));
        }
        if (parsed.skippedRows() > 0) {
            warnings.add(parsed.skippedRows() + " linhas sem data/hora ou estação válidas foram ignoradas.");
        }
        return warnings;
    }

    /** Lê o arquivo como UTF-8; se não for, tenta Windows-1252 (padrão do Excel em português). */
    static String text(InputStream in) {
        try (in) {
            byte[] bytes = in.readAllBytes();
            try {
                return StandardCharsets.UTF_8.newDecoder()
                        .onMalformedInput(CodingErrorAction.REPORT)
                        .decode(ByteBuffer.wrap(bytes)).toString();
            } catch (CharacterCodingException e) {
                return new String(bytes, Charset.forName("windows-1252"));
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
