package br.forum.aquaml.analysis.domain;

import br.forum.aquaml.monitoring.domain.Measurement;
import br.forum.aquaml.monitoring.domain.MonitoringEvent;
import br.forum.aquaml.monitoring.domain.Station;

import java.util.List;

public record AnalysisInput(List<Station> stations, List<Measurement> measurements, List<MonitoringEvent> events) {
}
