package br.forum.aquaml.monitoring.interfaces;

import br.forum.aquaml.shared.docs.ApiExamples;
import br.forum.aquaml.shared.interfaces.ApiError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import br.forum.aquaml.analysis.interfaces.AnalysisRunResponse;
import br.forum.aquaml.monitoring.application.DataImportService;
import br.forum.aquaml.monitoring.application.DataImportService.ImportCommand;
import br.forum.aquaml.monitoring.application.DataService;
import br.forum.aquaml.monitoring.application.DataSummary;
import br.forum.aquaml.shared.domain.BusinessRuleException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
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

@RestController
@RequestMapping("/api/data")
@Tag(name = "4. Dados", description = "Importar planilhas CSV, resumo e apagar dados")
public class DataController {

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
    @Operation(summary = "Resumo dos dados importados", description = "Campos de texto e data vêm null quando não há dados.",
            responses = @ApiResponse(responseCode = "200", description = "Resumo",
                    content = @Content(schema = @Schema(implementation = DataSummary.class), examples = {
                            @ExampleObject(name = "Com dados", value = ApiExamples.DATA_SUMMARY),
                            @ExampleObject(name = "Vazio", value = ApiExamples.DATA_SUMMARY_EMPTY)})))
    public DataSummary summary() {
        return data.summary();
    }

    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Importar planilhas CSV (substitui os dados)",
            description = "Só ADMIN. Formulário multipart. **Apaga as leituras atuais** e roda a análise de ML em "
                    + "seguida. Arquivos de exemplo em `docs/postman/dados/` (leituras.csv, estacoes.csv, eventos.csv).",
            responses = {
                    @ApiResponse(responseCode = "200", description = "Importado e analisado",
                            content = @Content(schema = @Schema(implementation = ImportResponse.class),
                                    examples = @ExampleObject(value = ApiExamples.IMPORT_RESPONSE))),
                    @ApiResponse(responseCode = "400", description = "CSV ausente ou com colunas erradas",
                            content = @Content(schema = @Schema(implementation = ApiError.class),
                                    examples = @ExampleObject(value = ApiExamples.ERR_400_CSV))),
                    @ApiResponse(responseCode = "403", description = "Só ADMIN",
                            content = @Content(schema = @Schema(implementation = ApiError.class),
                                    examples = @ExampleObject(value = ApiExamples.ERR_403)))})
    public ImportResponse importData(
            @Parameter(description = "CSV de leituras dos sensores (obrigatório)")
            @RequestParam(value = "measurements", required = false) MultipartFile measurements,
            @Parameter(description = "CSV das estações (opcional)")
            @RequestParam(value = "stations", required = false) MultipartFile stations,
            @Parameter(description = "CSV de eventos conhecidos, ex.: despejos (opcional)")
            @RequestParam(value = "events", required = false) MultipartFile events,
            @Parameter(description = "Nome do conjunto de dados", example = "Rede de exemplo")
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
    @Operation(summary = "Apagar todos os dados", description = "Só ADMIN. Apaga leituras, eventos e análises. "
            + "Não tem volta.",
            responses = {@ApiResponse(responseCode = "204", description = "Dados apagados"), @ApiResponse(responseCode = "403", description = "Só ADMIN",
                            content = @Content(schema = @Schema(implementation = ApiError.class),
                                    examples = @ExampleObject(value = ApiExamples.ERR_403)))})
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAll() {
        data.deleteAll();
    }

    private static InputStream streamOrNull(MultipartFile file) throws IOException {
        return file == null || file.isEmpty() ? null : file.getInputStream();
    }
}
