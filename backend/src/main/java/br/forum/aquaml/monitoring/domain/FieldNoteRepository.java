package br.forum.aquaml.monitoring.domain;

import java.util.List;
import java.util.Optional;

/** Porta do repositório de anotações de campo. */
public interface FieldNoteRepository {

    FieldNote save(FieldNote note);

    Optional<FieldNote> findById(Long id);

    List<FieldNote> findAllByOrderByNotedOnDescIdDesc();

    List<FieldNote> findByStationIdOrderByNotedOnDescIdDesc(String stationId);

    void delete(FieldNote note);
}
