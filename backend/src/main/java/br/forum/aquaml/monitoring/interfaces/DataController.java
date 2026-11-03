package br.forum.aquaml.monitoring.interfaces;

import io.swagger.v3.oas.annotations.tags.Tag;
import br.forum.aquaml.analysis.interfaces.AnalysisRunResponse;
import br.forum.aquaml.monitoring.application.DataImportService;
import br.forum.aquaml.monitoring.application.DataImportService.ImportCommand;
import br.forum.aquaml.monitoring.application.DataService;
import br.forum.aquaml.monitoring.application.DataSummary;
import br.forum.aquaml.shared.domain.BusinessRuleException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;

/** Rotas do conjunto de dados ({@code /api/data}): resumo, importar planilha (ADMIN) e apagar (ADMIN). */
@RestController
@RequestMapping("/api/data")
@Tag(name = "4. Dados", description = "Importar planilhas CSV, resumo e apagar dados")
public class DataController {

    /** Resposta da importação, no formato do contrato. */
    public record ImportResponse(String name, int measurements, int stations, int events, double readingsPerDay,
                                 List<String> warnings, AnalysisRunResponse analysis) {
    }

    private final DataService data;
    private final DataImportService importer;

    public DataController(DataService data, DataImportService importer) {
        this.data = data;
        this.importer = importer;
    }

    @GetMapping("/summary")
    public DataSummary summary() {
        return data.summary();
    }

    @PostMapping("/import")
    public ImportResponse importData(@RequestParam(value = "measurements", required = false) MultipartFile measurements,
                                     @RequestParam(value = "stations", required = false) MultipartFile stations,
                                     @RequestParam(value = "events", required = false) MultipartFile events,
                                     @RequestParam(value = "name", required = false) String name) throws IOException {
        if (measurements == null || measurements.isEmpty()) {
            throw new BusinessRuleException("Envie o CSV de leituras no campo measurements.");
        }
        var result = importer.importData(new ImportCommand(measurements.getInputStream(),
                measurements.getOriginalFilename(), streamOrNull(stations), streamOrNull(events), name));
        return new ImportResponse(result.name(), result.measurements(), result.stations(), result.events(),
                result.readingsPerDay(), result.warnings(), AnalysisRunResponse.from(result.analysis()));
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAll() {
        data.deleteAll();
    }

    private static InputStream streamOrNull(MultipartFile file) throws IOException {
        return file == null || file.isEmpty() ? null : file.getInputStream();
    }
}
