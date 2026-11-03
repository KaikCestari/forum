package br.forum.aquaml.dashboard.interfaces;

import io.swagger.v3.oas.annotations.tags.Tag;
import br.forum.aquaml.analysis.interfaces.AlertResponse;
import br.forum.aquaml.analysis.interfaces.AnalysisRunResponse;
import br.forum.aquaml.dashboard.application.DashboardService;
import br.forum.aquaml.monitoring.application.DataSummary;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Rota do painel ({@code GET /api/dashboard}). */
@RestController
@RequestMapping("/api/dashboard")
@Tag(name = "3. Painel", description = "Resumo para a tela inicial")
public class DashboardController {

    /** JSON {@code Dashboard} do contrato. */
    public record DashboardResponse(boolean hasData, DataSummary summary, AnalysisRunResponse lastRun, Double iqaMean,
                                    int stationsAtRisk, List<AlertResponse> recentAlerts, List<String> insights,
                                    long imagesPending, long imagesConfirmed) {
    }

    private final DashboardService dashboard;

    public DashboardController(DashboardService dashboard) {
        this.dashboard = dashboard;
    }

    @GetMapping
    public DashboardResponse get() {
        var d = dashboard.build();
        return new DashboardResponse(d.hasData(), d.summary(), AnalysisRunResponse.from(d.lastRun()), d.iqaMean(),
                d.stationsAtRisk(), d.recentAlerts().stream().map(AlertResponse::from).toList(), d.insights(),
                d.imagesPending(), d.imagesConfirmed());
    }
}
