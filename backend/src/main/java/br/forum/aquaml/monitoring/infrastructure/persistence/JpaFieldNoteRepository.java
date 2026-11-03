package br.forum.aquaml.monitoring.infrastructure.persistence;

import br.forum.aquaml.monitoring.domain.FieldNote;
import br.forum.aquaml.monitoring.domain.FieldNoteRepository;
import org.springframework.data.repository.Repository;

public interface JpaFieldNoteRepository extends Repository<FieldNote, Long>, FieldNoteRepository {
}
