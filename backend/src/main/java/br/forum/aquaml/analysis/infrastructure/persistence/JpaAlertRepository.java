package br.forum.aquaml.analysis.infrastructure.persistence;

import br.forum.aquaml.analysis.domain.Alert;
import br.forum.aquaml.analysis.domain.AlertRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.transaction.annotation.Transactional;

public interface JpaAlertRepository extends Repository<Alert, Long>, AlertRepository {

    @Override
    @Modifying
    @Transactional
    @Query("delete from Alert a")
    void removeAll();
}
