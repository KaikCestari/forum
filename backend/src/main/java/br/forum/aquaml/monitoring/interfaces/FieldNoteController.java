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
import br.forum.aquaml.identity.application.CurrentUser;
import br.forum.aquaml.monitoring.application.FieldNoteService;
import br.forum.aquaml.monitoring.application.StationService;
import br.forum.aquaml.monitoring.domain.FieldNote;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notes")
@Tag(name = "8. Anotações de campo", description = "Observações dos biólogos")
public class FieldNoteController {

    public record CreateNoteRequest(@NotBlank(message = "escolha a estação") String stationId,
                                    @NotNull(message = "informe a data") LocalDate notedOn,
                                    @NotBlank(message = "informe o tipo") String kind,
                                    @NotBlank(message = "escreva o texto") String text) {
    }

    public record FieldNoteResponse(Long id, String stationId, String stationName, LocalDate notedOn, String kind,
                                    String text, String author, Instant createdAt) {

        static FieldNoteResponse from(FieldNote n, Map<String, String> names) {
            return new FieldNoteResponse(n.getId(), n.getStationId(),
                    names.getOrDefault(n.getStationId(), n.getStationId()), n.getNotedOn(), n.getKind(), n.getText(),
                    n.getAuthorName(), n.getCreatedAt());
        }
    }

    private final FieldNoteService notes;
    private final StationService stations;

    public FieldNoteController(FieldNoteService notes, StationService stations) {
        this.notes = notes;
        this.stations = stations;
    }

    @GetMapping
    @Operation(summary = "Listar anotações", description = "Filtro opcional por estação.",
            responses = @ApiResponse(responseCode = "200", description = "Anotações",
                    content = @Content(array = @ArraySchema(schema = @Schema(implementation = FieldNoteResponse.class)),
                            examples = @ExampleObject(value = ApiExamples.NOTE_LIST))))
    public List<FieldNoteResponse> list(@Parameter(description = "Código da estação", example = "RIO-02")
                                        @RequestParam(required = false) String station) {
        Map<String, String> names = stations.names();
        return notes.list(station).stream().map(n -> FieldNoteResponse.from(n, names)).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Criar anotação de campo",
            description = "`kind`: observacao, coleta ou evento. Texto até 2000 caracteres.",
            requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(content = @Content(
                    mediaType = "application/json", schema = @Schema(implementation = CreateNoteRequest.class),
                    examples = {
                            @ExampleObject(name = "Observação", value = ApiExamples.NOTE_CREATE),
                            @ExampleObject(name = "Coleta", value = ApiExamples.NOTE_CREATE_COLLECT)})),
            responses = {
                    @ApiResponse(responseCode = "201", description = "Anotação criada",
                            content = @Content(schema = @Schema(implementation = FieldNoteResponse.class),
                                    examples = @ExampleObject(value = ApiExamples.NOTE))),
                    @ApiResponse(responseCode = "400", description = "Estação inexistente, tipo inválido ou texto vazio",
                            content = @Content(schema = @Schema(implementation = ApiError.class),
                                    examples = @ExampleObject(value = ApiExamples.ERR_400_NOTE)))})
    public FieldNoteResponse create(@Valid @RequestBody CreateNoteRequest body,
                                    @AuthenticationPrincipal CurrentUser user) {
        FieldNote note = notes.create(body.stationId(), body.notedOn(), body.kind(), body.text(), user);
        return FieldNoteResponse.from(note, stations.names());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Apagar anotação", description = "Só o autor ou um ADMIN.",
            responses = {
                    @ApiResponse(responseCode = "204", description = "Anotação apagada"),
                    @ApiResponse(responseCode = "403", description = "Anotação de outra pessoa",
                            content = @Content(schema = @Schema(implementation = ApiError.class),
                                    examples = @ExampleObject(value = ApiExamples.ERR_403_OWNER))),
                    @ApiResponse(responseCode = "404", description = "Anotação não existe",
                            content = @Content(schema = @Schema(implementation = ApiError.class),
                                    examples = @ExampleObject(value = ApiExamples.ERR_404_NOTE)))})
    public void delete(@Parameter(example = "1") @PathVariable Long id, @AuthenticationPrincipal CurrentUser user) {
        notes.delete(id, user);
    }
}
