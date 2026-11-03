package br.forum.aquaml.assistant.domain;

import java.util.List;

public interface ChatMessageRepository {

    ChatMessage save(ChatMessage message);

    List<ChatMessage> findTop50ByUserIdOrderByIdDesc(Long userId);

    List<ChatMessage> findTop3ByUserIdOrderByIdDesc(Long userId);

    void deleteByUserId(Long userId);
}
