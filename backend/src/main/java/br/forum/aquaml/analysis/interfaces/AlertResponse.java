package br.forum.aquaml.analysis.interfaces;

import br.forum.aquaml.analysis.domain.Alert;

import java.time.LocalDate;

/** JSON {@code Alert} do contrato (o mesmo formato do item {@code alerts[]} do AnalysisResult). */
public record AlertResponse(String stationId, LocalDate date, String parameter, Double value, String unit,
                            String severity, String message) {

    public static AlertResponse from(Alert a) {
        return new AlertResponse(a.getStationId(), a.getDate(), a.getParameter(), a.getValue(), a.getUnit(),
                a.getSeverity(), a.getMessage());
    }
}
