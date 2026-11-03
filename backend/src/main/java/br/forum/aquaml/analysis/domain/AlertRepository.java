package br.forum.aquaml.analysis.domain;

import java.util.List;

public interface AlertRepository {

    List<Alert> saveAll(Iterable<Alert> alerts);

    List<Alert> findByRunIdOrderByDateDescIdAsc(Long runId);

    void removeAll();
}
