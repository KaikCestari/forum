package br.forum.aquaml.dashboard.interfaces;

import br.forum.aquaml.shared.docs.ApiExamples;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import br.forum.aquaml.analysis.interfaces.AlertResponse;
import br.forum.aquaml.analysis.interfaces.AnalysisRunResponse;
import br.forum.aquaml.dashboard.application.DashboardService;
import br.forum.aquaml.monitoring.application.DataSummary;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/dashboard")
@Tag(name = "3. Painel", description = "Resumo para a tela inicial")
public class DashboardController {

    public record DashboardResponse(boolean hasData, DataSummary summary, AnalysisRunResponse lastRun, Double iqaMean,
                                    int stationsAtRisk, List<AlertResponse> recentAlerts, List<String> insights,
                                    long imagesPending, long imagesConfirmed) {
    }

    private final DashboardService dashboard;

    public DashboardController(DashboardService dashboard) {
        this.dashboard = dashboard;
    }

    @GetMapping
    @Operation(summary = "Resumo da tela inicial",
            description = "Dados importados, última análise, IQA médio, estações em risco, até 10 alertas "
                    + "recentes, frases de destaque e contagem de imagens.",
            responses = @ApiResponse(responseCode = "200", description = "Painel",
                    content = @Content(schema = @Schema(implementation = DashboardResponse.class), examples = {
                            @ExampleObject(name = "Com dados", value = ApiExamples.DASHBOARD),
                            @ExampleObject(name = "Sistema vazio", value = ApiExamples.DASHBOARD_EMPTY)})))
    public DashboardResponse get() {
        var d = dashboard.build();
        return new DashboardResponse(d.hasData(), d.summary(), AnalysisRunResponse.from(d.lastRun()), d.iqaMean(),
                d.stationsAtRisk(), d.recentAlerts().stream().map(AlertResponse::from).toList(), d.insights(),
                d.imagesPending(), d.imagesConfirmed());
    }
}
