package br.forum.aquaml.monitoring.domain;

import java.util.Optional;

/** Porta do repositório de conjuntos de dados importados. */
public interface DatasetRepository {

    Dataset save(Dataset dataset);

    Optional<Dataset> findFirstByOrderByIdDesc();

    /** Apaga o histórico de importações. */
    void removeAll();
}
