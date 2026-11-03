package br.forum.aquaml.monitoring.application;

import br.forum.aquaml.identity.application.CurrentUser;
import br.forum.aquaml.monitoring.domain.FieldNote;
import br.forum.aquaml.monitoring.domain.FieldNoteRepository;
import br.forum.aquaml.monitoring.domain.StationRepository;
import br.forum.aquaml.shared.domain.BusinessRuleException;
import br.forum.aquaml.shared.domain.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/** Casos de uso do caderno de campo: listar, escrever e apagar anotações. */
@Service
public class FieldNoteService {

    private final FieldNoteRepository notes;
    private final StationRepository stations;

    public FieldNoteService(FieldNoteRepository notes, StationRepository stations) {
        this.notes = notes;
        this.stations = stations;
    }

    public List<FieldNote> list(String stationId) {
        return stationId == null || stationId.isBlank()
                ? notes.findAllByOrderByNotedOnDescIdDesc()
                : notes.findByStationIdOrderByNotedOnDescIdDesc(stationId);
    }

    @Transactional
    public FieldNote create(String stationId, LocalDate notedOn, String kind, String text, CurrentUser author) {
        if (stationId == null || !stations.existsById(stationId)) {
            throw new BusinessRuleException("Escolha uma estação cadastrada.");
        }
        return notes.save(new FieldNote(stationId, notedOn, kind, text, author.id(), author.name()));
    }

    /** Só o autor ou um ADMIN pode apagar (a regra está na entidade). */
    @Transactional
    public void delete(Long id, CurrentUser user) {
        FieldNote note = notes.findById(id).orElseThrow(() -> new NotFoundException("Anotação não encontrada."));
        note.checkCanBeDeletedBy(user.id(), user.isAdmin());
        notes.delete(note);
    }
}
