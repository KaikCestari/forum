package br.forum.aquaml.analysis.interfaces;

import br.forum.aquaml.shared.docs.ApiExamples;
import br.forum.aquaml.shared.interfaces.ApiError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import br.forum.aquaml.analysis.application.AnalysisService;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
@Tag(name = "6. Análise (ML)", description = "Rodar o serviço de ML, resultados e alertas")
public class AnalysisController {

    private final AnalysisService analysis;

    public AnalysisController(AnalysisService analysis) {
        this.analysis = analysis;
    }

    @PostMapping("/analysis/run")
    @Operation(summary = "Rodar a análise de machine learning",
            description = "Só ADMIN. Síncrono (alguns segundos): envia as leituras ao serviço Python e devolve a "
                    + "execução já `CONCLUIDA` ou `FALHOU` (com o motivo em `error`).",
            responses = {
                    @ApiResponse(responseCode = "200", description = "Execução terminada",
                            content = @Content(schema = @Schema(implementation = AnalysisRunResponse.class), examples = {
                                    @ExampleObject(name = "Concluída", value = ApiExamples.ANALYSIS_RUN),
                                    @ExampleObject(name = "Falhou", value = ApiExamples.ANALYSIS_RUN_FAILED)})),
                    @ApiResponse(responseCode = "403", description = "Só ADMIN",
                            content = @Content(schema = @Schema(implementation = ApiError.class),
                                    examples = @ExampleObject(value = ApiExamples.ERR_403)))})
    public AnalysisRunResponse run() {
        return AnalysisRunResponse.from(analysis.run());
    }

    @GetMapping("/analysis/latest")
    @Operation(summary = "Resultado completo da última análise",
            description = "IQA, alertas, anomalias, classificação, agrupamentos, tendências e séries. "
                    + "O exemplo abaixo está encurtado: as listas reais têm centenas de itens.",
            responses = {
                    @ApiResponse(responseCode = "200", description = "AnalysisResult",
                            content = @Content(schema = @Schema(type = "object"),
                                    examples = @ExampleObject(value = ApiExamples.ANALYSIS_RESULT))),
                    @ApiResponse(responseCode = "204", description = "Nenhuma análise concluída ainda",
                            content = @Content)})
    public ResponseEntity<JsonNode> latest() {
        return analysis.latestResult()
                .map(r -> ResponseEntity.ok(r.root()))
                .orElse(ResponseEntity.noContent().build());
    }

    @GetMapping("/analysis/runs")
    @Operation(summary = "Histórico de execuções", description = "Até 20, a mais recente primeiro.",
            responses = @ApiResponse(responseCode = "200", description = "Execuções",
                    content = @Content(array = @ArraySchema(schema = @Schema(implementation = AnalysisRunResponse.class)),
                            examples = @ExampleObject(value = ApiExamples.ANALYSIS_RUNS))))
    public List<AnalysisRunResponse> runs() {
        return analysis.recentRuns().stream().map(AnalysisRunResponse::from).toList();
    }

    @GetMapping("/alerts")
    @Operation(summary = "Alertas da última análise", description = "Limites da CONAMA 357. Filtros opcionais.",
            responses = @ApiResponse(responseCode = "200", description = "Alertas",
                    content = @Content(array = @ArraySchema(schema = @Schema(implementation = AlertResponse.class)),
                            examples = @ExampleObject(value = ApiExamples.ALERTS))))
    public List<AlertResponse> alerts(
            @Parameter(description = "Código da estação", example = "RIO-02")
            @RequestParam(required = false) String station,
            @Parameter(description = "atencao ou critico", schema = @Schema(allowableValues = {"atencao", "critico"}))
            @RequestParam(required = false) String severity) {
        return analysis.alerts(station, severity).stream().map(AlertResponse::from).toList();
    }
}
