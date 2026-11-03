package br.forum.aquaml.monitoring.domain;

import java.util.List;

/** Porta do repositório de eventos conhecidos. */
public interface MonitoringEventRepository {

    List<MonitoringEvent> saveAll(Iterable<MonitoringEvent> events);

    List<MonitoringEvent> findAllByOrderByStartDateAsc();

    /** Apaga todos os eventos de uma vez. */
    void removeAll();
}
