package br.forum.aquaml.assistant.interfaces;

import br.forum.aquaml.assistant.application.AssistantService;
import br.forum.aquaml.assistant.domain.ChatMessage;
import br.forum.aquaml.identity.application.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

/** Rotas do assistente ({@code /api/assistant}). */
@RestController
@RequestMapping("/api/assistant")
public class AssistantController {

    public record StatusResponse(boolean available, String model) {
    }

    public record AskRequest(String question) {
    }

    /** JSON {@code ChatMessage} do contrato. */
    public record ChatMessageResponse(Long id, String question, String answer, String model, Instant createdAt) {

        static ChatMessageResponse from(ChatMessage m) {
            return new ChatMessageResponse(m.getId(), m.getQuestion(), m.getAnswer(), m.getModel(), m.getCreatedAt());
        }
    }

    private final AssistantService assistant;

    public AssistantController(AssistantService assistant) {
        this.assistant = assistant;
    }

    @GetMapping("/status")
    public StatusResponse status() {
        return new StatusResponse(assistant.isAvailable(), assistant.model());
    }

    @GetMapping("/history")
    public List<ChatMessageResponse> history(@AuthenticationPrincipal CurrentUser user) {
        return assistant.history(user).stream().map(ChatMessageResponse::from).toList();
    }

    @PostMapping("/ask")
    public ChatMessageResponse ask(@RequestBody AskRequest body, @AuthenticationPrincipal CurrentUser user) {
        return ChatMessageResponse.from(assistant.ask(body == null ? null : body.question(), user));
    }

    @DeleteMapping("/history")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clear(@AuthenticationPrincipal CurrentUser user) {
        assistant.clearHistory(user);
    }
}
