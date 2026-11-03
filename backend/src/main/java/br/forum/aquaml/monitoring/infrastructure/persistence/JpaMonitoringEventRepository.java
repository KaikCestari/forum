package br.forum.aquaml.monitoring.infrastructure.persistence;

import br.forum.aquaml.monitoring.domain.MonitoringEvent;
import br.forum.aquaml.monitoring.domain.MonitoringEventRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.transaction.annotation.Transactional;

public interface JpaMonitoringEventRepository extends Repository<MonitoringEvent, Long>, MonitoringEventRepository {

    @Override
    @Modifying
    @Transactional
    @Query("delete from MonitoringEvent e")
    void removeAll();
}
