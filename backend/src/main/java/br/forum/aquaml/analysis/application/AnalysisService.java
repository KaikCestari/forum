package br.forum.aquaml.analysis.application;

import br.forum.aquaml.analysis.domain.Alert;
import br.forum.aquaml.analysis.domain.AlertRepository;
import br.forum.aquaml.analysis.domain.AnalysisInput;
import br.forum.aquaml.analysis.domain.AnalysisResult;
import br.forum.aquaml.analysis.domain.AnalysisRun;
import br.forum.aquaml.analysis.domain.AnalysisRunRepository;
import br.forum.aquaml.analysis.domain.MlServiceClient;
import br.forum.aquaml.analysis.domain.MlServiceException;
import br.forum.aquaml.analysis.domain.RunStatus;
import br.forum.aquaml.monitoring.domain.Measurement;
import br.forum.aquaml.monitoring.domain.MeasurementRepository;
import br.forum.aquaml.monitoring.domain.MonitoringEventRepository;
import br.forum.aquaml.monitoring.domain.StationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Optional;

/**
 * Casos de uso da análise: rodar o machine learning sobre os dados do banco e consultar os resultados.
 *
 * <p>A análise é síncrona: a requisição espera o serviço Python responder. Se ele estiver fora do ar, a execução
 * fica {@code FALHOU} com a mensagem do motivo (não é lançado erro para quem chamou).
 */
@Service
public class AnalysisService {

    private static final Logger log = LoggerFactory.getLogger(AnalysisService.class);

    private final AnalysisRunRepository runs;
    private final AlertRepository alerts;
    private final StationRepository stations;
    private final MeasurementRepository measurements;
    private final MonitoringEventRepository events;
    private final MlServiceClient mlService;
    private final TransactionTemplate tx;

    public AnalysisService(AnalysisRunRepository runs, AlertRepository alerts, StationRepository stations,
                           MeasurementRepository measurements, MonitoringEventRepository events,
                           MlServiceClient mlService, TransactionTemplate tx) {
        this.runs = runs;
        this.alerts = alerts;
        this.stations = stations;
        this.measurements = measurements;
        this.events = events;
        this.mlService = mlService;
        this.tx = tx;
    }

    /** Roda a análise com todas as leituras, estações e eventos do banco. */
    public AnalysisRun run() {
        AnalysisRun run = runs.save(AnalysisRun.start());
        List<Measurement> readings = measurements.findAllByOrderByStationIdAscTimestampAsc();
        if (readings.isEmpty()) {
            run.fail("Não há leituras de sensores para analisar. Importe uma planilha primeiro.");
            return runs.save(run);
        }
        AnalysisInput input = new AnalysisInput(stations.findAllByOrderByNameAsc(), readings,
                events.findAllByOrderByStartDateAsc());
        try {
            AnalysisResult result = mlService.analyze(input);
            return tx.execute(status -> {
                run.complete(result);
                alerts.saveAll(result.alerts(run.getId()));
                return runs.save(run);
            });
        } catch (MlServiceException e) {
            log.warn("Análise {} falhou: {}", run.getId(), e.getMessage());
            run.fail(e.getMessage());
            return runs.save(run);
        }
    }

    /** Última execução, de qualquer situação (para o painel). */
    public Optional<AnalysisRun> lastRun() {
        return runs.findFirstByOrderByIdDesc();
    }

    /** Última execução concluída com sucesso. */
    public Optional<AnalysisRun> lastCompletedRun() {
        return runs.findFirstByStatusOrderByIdDesc(RunStatus.CONCLUIDA);
    }

    /** Resultado completo da última análise concluída. */
    public Optional<AnalysisResult> latestResult() {
        return lastCompletedRun().flatMap(AnalysisRun::result);
    }

    public List<AnalysisRun> recentRuns() {
        return runs.findTop20ByOrderByIdDesc();
    }

    /** Alertas da última análise concluída, com filtros opcionais de estação e severidade. */
    public List<Alert> alerts(String stationId, String severity) {
        return lastCompletedRun()
                .map(run -> alerts.findByRunIdOrderByDateDescIdAsc(run.getId()).stream()
                        .filter(a -> stationId == null || stationId.isBlank() || stationId.equals(a.getStationId()))
                        .filter(a -> severity == null || severity.isBlank() || severity.equals(a.getSeverity()))
                        .toList())
                .orElse(List.of());
    }

    /** Apaga o histórico de análises e alertas. */
    public void deleteAll() {
        alerts.removeAll();
        runs.removeAll();
    }
}
