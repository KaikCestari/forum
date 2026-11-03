package br.forum.aquaml.analysis.domain;

import java.util.List;

/** Porta do repositório de alertas. */
public interface AlertRepository {

    List<Alert> saveAll(Iterable<Alert> alerts);

    List<Alert> findByRunIdOrderByDateDescIdAsc(Long runId);

    /** Apaga todos os alertas. */
    void removeAll();
}
