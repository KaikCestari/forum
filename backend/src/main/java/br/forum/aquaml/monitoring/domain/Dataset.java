package br.forum.aquaml.monitoring.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "datasets")
public class Dataset {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(nullable = false)
    private Instant importedAt;

    private int measurements;
    private int stations;
    private int events;

    protected Dataset() {
        // exigido pelo JPA
    }

    public Dataset(String name, int measurements, int stations, int events) {
        this.name = name == null || name.isBlank() ? "Planilha importada" : name.strip();
        this.importedAt = Instant.now();
        this.measurements = measurements;
        this.stations = stations;
        this.events = events;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public Instant getImportedAt() {
        return importedAt;
    }
}
