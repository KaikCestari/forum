package br.forum.aquaml.monitoring.domain;

import java.util.Optional;

public interface DatasetRepository {

    Dataset save(Dataset dataset);

    Optional<Dataset> findFirstByOrderByIdDesc();

    void removeAll();
}
