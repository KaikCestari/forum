package br.forum.aquaml.monitoring.domain;

import java.util.List;
import java.util.Optional;

/** Porta do repositório de estações. */
public interface StationRepository {

    Station save(Station station);

    List<Station> saveAll(Iterable<Station> stations);

    Optional<Station> findById(String id);

    boolean existsById(String id);

    List<Station> findAllByOrderByNameAsc();

    long count();
}
