package br.forum.aquaml.monitoring.infrastructure.persistence;

import br.forum.aquaml.monitoring.domain.FieldNote;
import br.forum.aquaml.monitoring.domain.FieldNoteRepository;
import org.springframework.data.repository.Repository;

/** Adaptador JPA da porta {@link FieldNoteRepository}. */
public interface JpaFieldNoteRepository extends Repository<FieldNote, Long>, FieldNoteRepository {
}
