package br.forum.aquaml.analysis.interfaces;

import br.forum.aquaml.analysis.domain.AnalysisRun;
import br.forum.aquaml.analysis.domain.RunStatus;

import java.time.Instant;

/** JSON {@code AnalysisRun} do contrato. */
public record AnalysisRunResponse(Long id, Instant startedAt, Instant finishedAt, RunStatus status, Double iqaMean,
                                  Integer alertCount, Double accuracy, String error) {

    public static AnalysisRunResponse from(AnalysisRun r) {
        return r == null ? null : new AnalysisRunResponse(r.getId(), r.getStartedAt(), r.getFinishedAt(),
                r.getStatus(), r.getIqaMean(), r.getAlertCount(), r.getAccuracy(), r.getError());
    }
}
