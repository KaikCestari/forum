package br.forum.aquaml.monitoring.interfaces;

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

/** Rotas do caderno de campo ({@code /api/notes}). Apagar: só o autor ou ADMIN. */
@RestController
@RequestMapping("/api/notes")
@Tag(name = "8. Anotações de campo", description = "Observações dos biólogos")
public class FieldNoteController {

    public record CreateNoteRequest(@NotBlank(message = "escolha a estação") String stationId,
                                    @NotNull(message = "informe a data") LocalDate notedOn,
                                    @NotBlank(message = "informe o tipo") String kind,
                                    @NotBlank(message = "escreva o texto") String text) {
    }

    /** JSON {@code FieldNote} do contrato. */
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
    public List<FieldNoteResponse> list(@RequestParam(required = false) String station) {
        Map<String, String> names = stations.names();
        return notes.list(station).stream().map(n -> FieldNoteResponse.from(n, names)).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public FieldNoteResponse create(@Valid @RequestBody CreateNoteRequest body,
                                    @AuthenticationPrincipal CurrentUser user) {
        FieldNote note = notes.create(body.stationId(), body.notedOn(), body.kind(), body.text(), user);
        return FieldNoteResponse.from(note, stations.names());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @AuthenticationPrincipal CurrentUser user) {
        notes.delete(id, user);
    }
}
