package br.forum.aquaml.monitoring.domain;

import jakarta.persistence.Embeddable;

import java.util.List;

/**
 * Objeto de valor com os parâmetros de qualidade da água de uma leitura. Qualquer parâmetro pode faltar (null).
 * A ordem de {@link #NAMES} é a mesma usada pela planilha e pelo serviço de ML.
 */
@Embeddable
public record WaterParameters(Double ph, Double doMgl, Double tempC, Double turbidityNtu, Double conductivityUscm,
                              Double nitrateMgl, Double phosphorusMgl, Double coliformsNmp) {

    /** Nomes dos parâmetros no JSON do contrato, na ordem dos campos. */
    public static final List<String> NAMES = List.of("ph", "doMgl", "tempC", "turbidityNtu", "conductivityUscm",
            "nitrateMgl", "phosphorusMgl", "coliformsNmp");

    /** Cria a partir de um vetor de 8 valores na ordem de {@link #NAMES}. */
    public static WaterParameters of(Double[] v) {
        return new WaterParameters(v[0], v[1], v[2], v[3], v[4], v[5], v[6], v[7]);
    }
}
