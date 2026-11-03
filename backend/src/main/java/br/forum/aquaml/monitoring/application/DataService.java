package br.forum.aquaml.monitoring.application;

import br.forum.aquaml.analysis.application.AnalysisService;
import br.forum.aquaml.monitoring.domain.Dataset;
import br.forum.aquaml.monitoring.domain.DatasetRepository;
import br.forum.aquaml.monitoring.domain.MeasurementRepository;
import br.forum.aquaml.monitoring.domain.MonitoringEventRepository;
import br.forum.aquaml.monitoring.domain.StationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DataService {

    private final StationRepository stations;
    private final MeasurementRepository measurements;
    private final MonitoringEventRepository events;
    private final DatasetRepository datasets;
    private final AnalysisService analysis;

    public DataService(StationRepository stations, MeasurementRepository measurements,
                       MonitoringEventRepository events, DatasetRepository datasets, AnalysisService analysis) {
        this.stations = stations;
        this.measurements = measurements;
        this.events = events;
        this.datasets = datasets;
        this.analysis = analysis;
    }

    public DataSummary summary() {
        Dataset current = datasets.findFirstByOrderByIdDesc().orElse(null);
        return new DataSummary(current == null ? null : current.getName(),
                current == null ? null : current.getImportedAt(),
                stations.count(), measurements.count(),
                measurements.firstReadingTime(), measurements.lastReadingTime());
    }

    @Transactional
    public void deleteAll() {
        measurements.removeAll();
        events.removeAll();
        datasets.removeAll();
        analysis.deleteAll();
    }
}
