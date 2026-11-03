package br.forum.aquaml.monitoring.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/** Entidade Leitura: o que um sensor mediu numa estação, num instante. */
@Entity
@Table(name = "measurements", indexes = @Index(name = "idx_measurement_station_time", columnList = "stationId,timestamp"))
public class Measurement {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "measurement_seq")
    @SequenceGenerator(name = "measurement_seq", sequenceName = "measurement_seq", allocationSize = 500)
    private Long id;

    @Column(nullable = false, length = 80)
    private String stationId;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    @Embedded
    private WaterParameters parameters;

    protected Measurement() {
        // exigido pelo JPA
    }

    public Measurement(String stationId, LocalDateTime timestamp, WaterParameters parameters) {
        this.stationId = stationId;
        this.timestamp = timestamp;
        this.parameters = parameters;
    }

    public Long getId() {
        return id;
    }

    public String getStationId() {
        return stationId;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    /** O JPA devolve null quando todos os parâmetros estão vazios; aqui isso vira um objeto vazio. */
    public WaterParameters getParameters() {
        return parameters != null ? parameters : new WaterParameters(null, null, null, null, null, null, null, null);
    }
}
