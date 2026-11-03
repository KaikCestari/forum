package br.forum.aquaml.monitoring.application;

import br.forum.aquaml.analysis.application.AnalysisService;
import br.forum.aquaml.analysis.domain.AnalysisResult;
import br.forum.aquaml.monitoring.domain.Station;
import br.forum.aquaml.monitoring.domain.StationRepository;
import br.forum.aquaml.monitoring.domain.StationType;
import br.forum.aquaml.shared.domain.BusinessRuleException;
import br.forum.aquaml.shared.domain.NotFoundException;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/** Casos de uso das estações: listar (com o que a última análise disse de cada uma), criar e ver a série. */
@Service
public class StationService {

    /** Estação junto com o resumo dela na última análise (null se ainda não foi analisada). */
    public record StationOverview(Station station, JsonNode analysis) {
    }

    private final StationRepository stations;
    private final AnalysisService analysis;

    public StationService(StationRepository stations, AnalysisService analysis) {
        this.stations = stations;
        this.analysis = analysis;
    }

    public List<StationOverview> list() {
        Optional<AnalysisResult> latest = analysis.latestResult();
        return stations.findAllByOrderByNameAsc().stream()
                .map(s -> new StationOverview(s, latest.flatMap(r -> r.station(s.getId())).orElse(null)))
                .toList();
    }

    /** Cria uma estação. Sem código, ele é gerado do nome (e fica único). Código repetido é recusado. */
    @Transactional
    public StationOverview create(String id, String name, String type, Double lat, Double lon) {
        StationType stationType = StationType.fromCode(type);
        String code;
        if (id != null && !id.isBlank()) {
            code = id.strip();
            if (stations.existsById(code)) {
                throw new BusinessRuleException("Já existe uma estação com o código " + code + ".");
            }
        } else {
            code = uniqueCode(Station.codeFromName(name));
        }
        return new StationOverview(stations.save(new Station(code, name, stationType, lat, lon)), null);
    }

    /** Usado no envio de imagem com "nova estação": sempre cria, com código único. */
    @Transactional
    public Station createFromName(String name, String type, Double lat, Double lon) {
        return create(null, name, type, lat, lon).station();
    }

    /** Mapa código → nome, para mostrar o nome da estação em imagens e anotações. */
    public Map<String, String> names() {
        return stations.findAllByOrderByNameAsc().stream()
                .collect(Collectors.toMap(Station::getId, Station::getName, (a, b) -> a));
    }

    public Station get(String id) {
        return stations.findById(id).orElseThrow(() -> new NotFoundException("Estação não encontrada."));
    }

    /** Série diária da estação na última análise (404 se não houver). */
    public JsonNode series(String id) {
        return analysis.latestResult()
                .flatMap(r -> r.series(id))
                .orElseThrow(() -> new NotFoundException("Não há série para esta estação: rode a análise com leituras dela."));
    }

    private String uniqueCode(String base) {
        String code = base;
        for (int i = 2; stations.existsById(code); i++) {
            code = base + "-" + i;
        }
        return code;
    }
}
