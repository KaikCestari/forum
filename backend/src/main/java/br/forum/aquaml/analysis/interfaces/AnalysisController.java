package br.forum.aquaml.analysis.interfaces;

import br.forum.aquaml.analysis.application.AnalysisService;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Rotas da análise de machine learning ({@code /api/analysis}) e dos alertas ({@code /api/alerts}). */
@RestController
@RequestMapping("/api")
public class AnalysisController {

    private final AnalysisService analysis;

    public AnalysisController(AnalysisService analysis) {
        this.analysis = analysis;
    }

    /** Só ADMIN. Síncrono: devolve a execução já CONCLUIDA ou FALHOU. */
    @PostMapping("/analysis/run")
    public AnalysisRunResponse run() {
        return AnalysisRunResponse.from(analysis.run());
    }

    /** Resultado completo da última análise concluída, ou 204 se ainda não houver. */
    @GetMapping("/analysis/latest")
    public ResponseEntity<JsonNode> latest() {
        return analysis.latestResult()
                .map(r -> ResponseEntity.ok(r.root()))
                .orElse(ResponseEntity.noContent().build());
    }

    @GetMapping("/analysis/runs")
    public List<AnalysisRunResponse> runs() {
        return analysis.recentRuns().stream().map(AnalysisRunResponse::from).toList();
    }

    @GetMapping("/alerts")
    public List<AlertResponse> alerts(@RequestParam(required = false) String station,
                                      @RequestParam(required = false) String severity) {
        return analysis.alerts(station, severity).stream().map(AlertResponse::from).toList();
    }
}
