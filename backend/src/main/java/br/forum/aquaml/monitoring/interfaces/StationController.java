package br.forum.aquaml.monitoring.interfaces;

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

/** Rotas das estações ({@code /api/stations}). Criar é só para ADMIN. */
@RestController
@RequestMapping("/api/stations")
@Tag(name = "5. Estações", description = "Pontos de monitoramento e séries")
public class StationController {

    /** Corpo de {@code POST /api/stations}; {@code id} é gerado do nome se vier vazio. */
    public record CreateStationRequest(String id, @NotBlank(message = "informe o nome") String name, String type,
                                       Double lat, Double lon) {
    }

    private final StationService stations;

    public StationController(StationService stations) {
        this.stations = stations;
    }

    @GetMapping
    public List<StationResponse> list() {
        return stations.list().stream().map(StationResponse::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public StationResponse create(@Valid @RequestBody CreateStationRequest body) {
        return StationResponse.from(stations.create(body.id(), body.name(), body.type(), body.lat(), body.lon()));
    }

    @GetMapping("/{id}/series")
    public JsonNode series(@PathVariable String id) {
        return stations.series(id);
    }
}
