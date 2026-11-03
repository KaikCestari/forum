package br.forum.aquaml.analysis.infrastructure.persistence;

import br.forum.aquaml.analysis.domain.AnalysisRun;
import br.forum.aquaml.analysis.domain.AnalysisRunRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.transaction.annotation.Transactional;

public interface JpaAnalysisRunRepository extends Repository<AnalysisRun, Long>, AnalysisRunRepository {

    @Override
    @Modifying
    @Transactional
    @Query("delete from AnalysisRun r")
    void removeAll();
}
