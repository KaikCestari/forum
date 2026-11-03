package br.forum.aquaml.monitoring.infrastructure.persistence;

import br.forum.aquaml.monitoring.domain.Dataset;
import br.forum.aquaml.monitoring.domain.DatasetRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.transaction.annotation.Transactional;

public interface JpaDatasetRepository extends Repository<Dataset, Long>, DatasetRepository {

    @Override
    @Modifying
    @Transactional
    @Query("delete from Dataset d")
    void removeAll();
}
