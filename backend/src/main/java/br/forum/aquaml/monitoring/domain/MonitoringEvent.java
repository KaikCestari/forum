package br.forum.aquaml.monitoring.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDate;

/**
 * Entidade Evento conhecido (despejo, chuva forte, obra...). É opcional e serve para o serviço de ML medir
 * se a detecção de anomalias encontrou os eventos reais.
 */
@Entity
@Table(name = "monitoring_events")
public class MonitoringEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 80)
    private String stationId;

    @Column(nullable = false)
    private LocalDate startDate;

    @Column(nullable = false)
    private LocalDate endDate;

    @Column(length = 60)
    private String type;

    @Column(length = 1000)
    private String description;

    protected MonitoringEvent() {
        // exigido pelo JPA
    }

    /** Se o fim não for informado, o evento dura um dia; fim antes do início é corrigido para o início. */
    public MonitoringEvent(String stationId, LocalDate start, LocalDate end, String type, String description) {
        this.stationId = stationId;
        this.startDate = start;
        this.endDate = end == null || end.isBefore(start) ? start : end;
        this.type = type == null || type.isBlank() ? "evento" : type.strip();
        this.description = description == null ? "" : description.strip();
    }

    public Long getId() {
        return id;
    }

    public String getStationId() {
        return stationId;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public String getType() {
        return type;
    }

    public String getDescription() {
        return description;
    }
}
