package br.forum.aquaml.assistant.domain;

import br.forum.aquaml.shared.domain.BusinessRuleException;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

import java.time.Instant;

/** Entidade Mensagem do assistente: uma pergunta de um usuário e a resposta do modelo. */
@Entity
@Table(name = "chat_messages", indexes = @Index(name = "idx_chat_user", columnList = "userId"))
public class ChatMessage {

    public static final int MAX_QUESTION = 2000;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false, length = MAX_QUESTION)
    private String question;

    @Lob
    @Column(columnDefinition = "CLOB")
    private String answer;

    @Column(length = 120)
    private String model;

    private Instant createdAt;

    protected ChatMessage() {
        // exigido pelo JPA
    }

    public ChatMessage(Long userId, String question, String answer, String model) {
        this.userId = userId;
        this.question = validQuestion(question);
        this.answer = answer;
        this.model = model;
        this.createdAt = Instant.now();
    }

    /** Regra: pergunta não vazia e com até 2000 caracteres. */
    public static String validQuestion(String question) {
        if (question == null || question.isBlank()) {
            throw new BusinessRuleException("Escreva uma pergunta.");
        }
        String q = question.strip();
        if (q.length() > MAX_QUESTION) {
            throw new BusinessRuleException("A pergunta pode ter até " + MAX_QUESTION + " caracteres.");
        }
        return q;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public String getQuestion() {
        return question;
    }

    public String getAnswer() {
        return answer;
    }

    public String getModel() {
        return model;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
