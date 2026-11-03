package br.forum.aquaml.monitoring.domain;

import jakarta.persistence.Embeddable;

import java.util.List;

@Embeddable
public record WaterParameters(Double ph, Double doMgl, Double tempC, Double turbidityNtu, Double conductivityUscm,
                              Double nitrateMgl, Double phosphorusMgl, Double coliformsNmp) {

    public static final List<String> NAMES = List.of("ph", "doMgl", "tempC", "turbidityNtu", "conductivityUscm",
            "nitrateMgl", "phosphorusMgl", "coliformsNmp");

    public static WaterParameters of(Double[] v) {
        return new WaterParameters(v[0], v[1], v[2], v[3], v[4], v[5], v[6], v[7]);
    }
}
