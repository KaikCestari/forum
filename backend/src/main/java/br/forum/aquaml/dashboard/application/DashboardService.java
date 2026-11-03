package br.forum.aquaml.dashboard.application;

import br.forum.aquaml.analysis.application.AnalysisService;
import br.forum.aquaml.analysis.domain.Alert;
import br.forum.aquaml.analysis.domain.AnalysisResult;
import br.forum.aquaml.analysis.domain.AnalysisRun;
import br.forum.aquaml.analysis.domain.Iqa;
import br.forum.aquaml.imagery.application.ImageService;
import br.forum.aquaml.monitoring.application.DataService;
import br.forum.aquaml.monitoring.application.DataSummary;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class DashboardService {

    private static final int RECENT_ALERTS = 10;

    public record Dashboard(boolean hasData, DataSummary summary, AnalysisRun lastRun, Double iqaMean,
                            int stationsAtRisk, List<Alert> recentAlerts, List<String> insights,
                            long imagesPending, long imagesConfirmed) {
    }

    private final DataService data;
    private final AnalysisService analysis;
    private final ImageService images;

    public DashboardService(DataService data, AnalysisService analysis, ImageService images) {
        this.data = data;
        this.analysis = analysis;
        this.images = images;
    }

    public Dashboard build() {
        DataSummary summary = data.summary();
        Optional<AnalysisResult> result = analysis.latestResult();
        List<Alert> alerts = analysis.alerts(null, null).stream().limit(RECENT_ALERTS).toList();
        boolean hasData = summary.measurements() > 0 || images.countAll() > 0;
        return new Dashboard(hasData, summary, analysis.lastRun().orElse(null),
                result.map(AnalysisResult::iqaMean).orElse(null),
                result.map(DashboardService::stationsAtRisk).orElse(0),
                alerts,
                result.map(AnalysisResult::insights).orElse(List.of()),
                images.countPending(), images.countConfirmed());
    }

    private static int stationsAtRisk(AnalysisResult result) {
        int count = 0;
        for (JsonNode s : result.root().path("stations")) {
            JsonNode iqa = s.path("latest").path("iqa");
            if (iqa.isNumber() && new Iqa(Math.max(0, Math.min(100, iqa.asDouble()))).isAtRisk()) {
                count++;
            }
        }
        return count;
    }
}
