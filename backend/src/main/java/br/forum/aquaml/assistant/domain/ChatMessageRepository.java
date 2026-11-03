package br.forum.aquaml.assistant.domain;

import java.util.List;

/** Porta do repositório das conversas com o assistente. */
public interface ChatMessageRepository {

    ChatMessage save(ChatMessage message);

    /** As 50 mensagens mais recentes do usuário (mais nova primeiro). */
    List<ChatMessage> findTop50ByUserIdOrderByIdDesc(Long userId);

    /** As 3 mensagens mais recentes do usuário, usadas como memória curta da conversa. */
    List<ChatMessage> findTop3ByUserIdOrderByIdDesc(Long userId);

    void deleteByUserId(Long userId);
}
