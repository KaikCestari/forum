package br.forum.aquaml.assistant.infrastructure.persistence;

import br.forum.aquaml.assistant.domain.ChatMessage;
import br.forum.aquaml.assistant.domain.ChatMessageRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.transaction.annotation.Transactional;

public interface JpaChatMessageRepository extends Repository<ChatMessage, Long>, ChatMessageRepository {

    @Override
    @Modifying
    @Transactional
    @Query("delete from ChatMessage m where m.userId = ?1")
    void deleteByUserId(Long userId);
}
