package br.forum.aquaml.monitoring.domain;

import br.forum.aquaml.shared.domain.BusinessRuleException;
import br.forum.aquaml.shared.domain.ForbiddenException;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Set;

@Entity
@Table(name = "field_notes")
public class FieldNote {

    public static final Set<String> KINDS = Set.of("observacao", "coleta", "evento");
    private static final int MAX_TEXT = 2000;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 80)
    private String stationId;

    @Column(nullable = false)
    private LocalDate notedOn;

    @Column(nullable = false, length = 20)
    private String kind;

    @Column(nullable = false, length = MAX_TEXT)
    private String text;

    private Long authorId;

    @Column(length = 120)
    private String authorName;

    private Instant createdAt;

    protected FieldNote() {
        // exigido pelo JPA
    }

    public FieldNote(String stationId, LocalDate notedOn, String kind, String text, Long authorId, String authorName) {
        if (notedOn == null) {
            throw new BusinessRuleException("Informe a data da anotação.");
        }
        if (kind == null || !KINDS.contains(kind)) {
            throw new BusinessRuleException("Tipo de anotação inválido: use observacao, coleta ou evento.");
        }
        if (text == null || text.isBlank()) {
            throw new BusinessRuleException("Escreva o texto da anotação.");
        }
        if (text.strip().length() > MAX_TEXT) {
            throw new BusinessRuleException("A anotação pode ter até " + MAX_TEXT + " caracteres.");
        }
        this.stationId = stationId;
        this.notedOn = notedOn;
        this.kind = kind;
        this.text = text.strip();
        this.authorId = authorId;
        this.authorName = authorName;
        this.createdAt = Instant.now();
    }

    public void checkCanBeDeletedBy(Long userId, boolean isAdmin) {
        if (!isAdmin && !userId.equals(authorId)) {
            throw new ForbiddenException("Só quem escreveu a anotação ou um administrador pode apagá-la.");
        }
    }

    public Long getId() {
        return id;
    }

    public String getStationId() {
        return stationId;
    }

    public LocalDate getNotedOn() {
        return notedOn;
    }

    public String getKind() {
        return kind;
    }

    public String getText() {
        return text;
    }

    public String getAuthorName() {
        return authorName;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
