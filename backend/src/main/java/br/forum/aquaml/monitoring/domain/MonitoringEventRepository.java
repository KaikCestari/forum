package br.forum.aquaml.monitoring.domain;

import java.util.List;

public interface MonitoringEventRepository {

    List<MonitoringEvent> saveAll(Iterable<MonitoringEvent> events);

    List<MonitoringEvent> findAllByOrderByStartDateAsc();

    void removeAll();
}
