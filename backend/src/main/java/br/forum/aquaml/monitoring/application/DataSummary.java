package br.forum.aquaml.monitoring.application;

import java.time.Instant;
import java.time.LocalDateTime;

public record DataSummary(String datasetName, Instant importedAt, long stations, long measurements,
                          LocalDateTime firstReading, LocalDateTime lastReading) {
}
