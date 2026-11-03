package br.forum.aquaml.monitoring.interfaces;

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
import br.forum.aquaml.monitoring.application.StationService;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/stations")
@Tag(name = "5. Estações", description = "Pontos de monitoramento e séries")
public class StationController {

    public record CreateStationRequest(String id, @NotBlank(message = "informe o nome") String name, String type,
                                       Double lat, Double lon) {
    }

    private final StationService stations;

    public StationController(StationService stations) {
        this.stations = stations;
    }

    @GetMapping
    @Operation(summary = "Listar estações", description = "Cadastro de cada estação + o que a última análise disse dela.",
            responses = @ApiResponse(responseCode = "200", description = "Estações",
                    content = @Content(array = @ArraySchema(schema = @Schema(implementation = StationResponse.class)),
                            examples = @ExampleObject(value = ApiExamples.STATIONS))))
    public List<StationResponse> list() {
        return stations.list().stream().map(StationResponse::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Criar estação",
            description = "Só ADMIN. `type`: rio, lago, reservatorio ou estuario. Sem `id`, o código é gerado do nome.",
            requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(content = @Content(
                    mediaType = "application/json", schema = @Schema(implementation = CreateStationRequest.class),
                    examples = {
                            @ExampleObject(name = "Com código", value = ApiExamples.STATION_CREATE),
                            @ExampleObject(name = "Sem código", value = ApiExamples.STATION_CREATE_NO_ID)})),
            responses = {
                    @ApiResponse(responseCode = "201", description = "Estação criada",
                            content = @Content(schema = @Schema(implementation = StationResponse.class),
                                    examples = @ExampleObject(value = ApiExamples.STATION_CREATED))),
                    @ApiResponse(responseCode = "400", description = "Código repetido, tipo inválido ou coordenada fora da faixa",
                            content = @Content(schema = @Schema(implementation = ApiError.class),
                                    examples = @ExampleObject(value = ApiExamples.ERR_400_STATION))),
                    @ApiResponse(responseCode = "403", description = "Só ADMIN",
                            content = @Content(schema = @Schema(implementation = ApiError.class),
                                    examples = @ExampleObject(value = ApiExamples.ERR_403)))})
    public StationResponse create(@Valid @RequestBody CreateStationRequest body) {
        return StationResponse.from(stations.create(body.id(), body.name(), body.type(), body.lat(), body.lon()));
    }

    @GetMapping("/{id}/series")
    @Operation(summary = "Série diária da estação",
            description = "Listas alinhadas por data (IQA, classe, anomalia e os 8 parâmetros) da última análise.",
            responses = {
                    @ApiResponse(responseCode = "200", description = "Série",
                            content = @Content(schema = @Schema(type = "object"),
                                    examples = @ExampleObject(value = ApiExamples.SERIES))),
                    @ApiResponse(responseCode = "404", description = "Estação sem série (rode a análise)",
                            content = @Content(schema = @Schema(implementation = ApiError.class),
                                    examples = @ExampleObject(value = ApiExamples.ERR_404_STATION)))})
    public JsonNode series(@Parameter(example = "RIO-02") @PathVariable String id) {
        return stations.series(id);
    }
}
