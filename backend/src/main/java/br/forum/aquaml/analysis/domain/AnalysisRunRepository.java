package br.forum.aquaml.analysis.domain;

import java.util.List;
import java.util.Optional;

/** Porta do repositório de execuções da análise. */
public interface AnalysisRunRepository {

    AnalysisRun save(AnalysisRun run);

    /** Última execução, de qualquer situação. */
    Optional<AnalysisRun> findFirstByOrderByIdDesc();

    /** Última execução com a situação pedida (ex.: a última CONCLUIDA). */
    Optional<AnalysisRun> findFirstByStatusOrderByIdDesc(RunStatus status);

    List<AnalysisRun> findTop20ByOrderByIdDesc();

    /** Apaga todas as execuções. */
    void removeAll();
}
