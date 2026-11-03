package br.forum.aquaml.analysis.domain;

import java.util.List;
import java.util.Optional;

public interface AnalysisRunRepository {

    AnalysisRun save(AnalysisRun run);

    Optional<AnalysisRun> findFirstByOrderByIdDesc();

    Optional<AnalysisRun> findFirstByStatusOrderByIdDesc(RunStatus status);

    List<AnalysisRun> findTop20ByOrderByIdDesc();

    void removeAll();
}
