package br.forum.aquaml.monitoring.domain;

import br.forum.aquaml.shared.domain.BusinessRuleException;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.text.Normalizer;
import java.util.Locale;

@Entity
@Table(name = "stations")
public class Station {

    @Id
    @Column(length = 80)
    private String id;

    @Column(nullable = false, length = 160)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StationType type;

    private Double lat;
    private Double lon;

    protected Station() {
        // exigido pelo JPA
    }

    public Station(String id, String name, StationType type, Double lat, Double lon) {
        if (id == null || id.isBlank()) {
            throw new BusinessRuleException("A estação precisa de um código.");
        }
        this.id = id.strip();
        update(name == null || name.isBlank() ? this.id : name, type, lat, lon);
    }

    public static String codeFromName(String name) {
        if (name == null || name.isBlank()) {
            throw new BusinessRuleException("Informe o nome da estação.");
        }
        String slug = Normalizer.normalize(name.strip().toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").replaceAll("[^a-z0-9]+", "-").replaceAll("^-+|-+$", "");
        return slug.isEmpty() ? "estacao" : slug;
    }

    public void update(String newName, StationType newType, Double newLat, Double newLon) {
        if (newName == null || newName.isBlank()) {
            throw new BusinessRuleException("Informe o nome da estação.");
        }
        if (newLat != null && (newLat < -90 || newLat > 90)) {
            throw new BusinessRuleException("Latitude deve ficar entre -90 e 90.");
        }
        if (newLon != null && (newLon < -180 || newLon > 180)) {
            throw new BusinessRuleException("Longitude deve ficar entre -180 e 180.");
        }
        this.name = newName.strip();
        this.type = newType == null ? StationType.RIO : newType;
        this.lat = newLat;
        this.lon = newLon;
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public StationType getType() {
        return type;
    }

    public Double getLat() {
        return lat;
    }

    public Double getLon() {
        return lon;
    }
}
