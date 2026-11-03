package br.forum.aquaml.analysis.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import java.time.LocalDate;

/**
 * Entidade Alerta: um parâmetro fora do limite da Resolução CONAMA 357 numa estação e data.
 * Pertence a uma execução da análise ({@code runId}). Severidade: {@code atencao} ou {@code critico}.
 */
@Entity
@Table(name = "alerts", indexes = @Index(name = "idx_alert_run", columnList = "runId"))
public class Alert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long runId;

    @Column(length = 80)
    private String stationId;

    private LocalDate date;

    @Column(length = 40)
    private String parameter;

    private Double measuredValue;

    @Column(length = 20)
    private String unit;

    @Column(length = 20)
    private String severity;

    @Column(length = 500)
    private String message;

    protected Alert() {
        // exigido pelo JPA
    }

    public Alert(Long runId, String stationId, LocalDate date, String parameter, Double value, String unit,
                 String severity, String message) {
        this.runId = runId;
        this.stationId = stationId;
        this.date = date;
        this.parameter = parameter;
        this.measuredValue = value;
        this.unit = unit;
        this.severity = severity;
        this.message = message;
    }

    public boolean isCritical() {
        return "critico".equals(severity);
    }

    public Long getId() {
        return id;
    }

    public Long getRunId() {
        return runId;
    }

    public String getStationId() {
        return stationId;
    }

    public LocalDate getDate() {
        return date;
    }

    public String getParameter() {
        return parameter;
    }

    public Double getValue() {
        return measuredValue;
    }

    public String getUnit() {
        return unit;
    }

    public String getSeverity() {
        return severity;
    }

    public String getMessage() {
        return message;
    }
}
