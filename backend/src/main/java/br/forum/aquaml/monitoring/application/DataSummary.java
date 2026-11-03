package br.forum.aquaml.monitoring.application;

import java.time.Instant;
import java.time.LocalDateTime;

/** Resumo dos dados atuais ({@code /api/data/summary}). Campos de texto e data ficam null quando não há dados. */
public record DataSummary(String datasetName, Instant importedAt, long stations, long measurements,
                          LocalDateTime firstReading, LocalDateTime lastReading) {
}
