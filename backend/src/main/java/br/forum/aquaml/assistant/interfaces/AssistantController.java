package br.forum.aquaml.assistant.interfaces;

import br.forum.aquaml.shared.docs.ApiExamples;
import br.forum.aquaml.shared.interfaces.ApiError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
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

@RestController
@RequestMapping("/api/assistant")
@Tag(name = "9. Assistente (Ollama)", description = "Perguntas sobre os resultados")
public class AssistantController {

    public record StatusResponse(boolean available, String model) {
    }

    public record AskRequest(String question) {
    }

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
    @Operation(summary = "O assistente está no ar?", description = "Modelo fixo, definido no .env (LLAMA_MODEL).",
            responses = @ApiResponse(responseCode = "200", description = "Situação",
                    content = @Content(schema = @Schema(implementation = StatusResponse.class),
                            examples = @ExampleObject(value = ApiExamples.ASSISTANT_STATUS))))
    public StatusResponse status() {
        return new StatusResponse(assistant.isAvailable(), assistant.model());
    }

    @GetMapping("/history")
    @Operation(summary = "Conversa do usuário logado", description = "Até 50 mensagens, a mais antiga primeiro.",
            responses = @ApiResponse(responseCode = "200", description = "Histórico",
                    content = @Content(array = @ArraySchema(schema = @Schema(implementation = ChatMessageResponse.class)),
                            examples = @ExampleObject(value = ApiExamples.CHAT_HISTORY))))
    public List<ChatMessageResponse> history(@AuthenticationPrincipal CurrentUser user) {
        return assistant.history(user).stream().map(ChatMessageResponse::from).toList();
    }

    @PostMapping("/ask")
    @Operation(summary = "Perguntar ao Limno",
            description = "O backend junta a última análise, as imagens confirmadas e as anotações como contexto. "
                    + "Pode demorar alguns segundos. A resposta pode trazer marcadores "
                    + "`[[grafico estacao=X parametro=Y]]`, que o frontend troca por gráficos.",
            requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(content = @Content(
                    mediaType = "application/json", schema = @Schema(implementation = AskRequest.class),
                    examples = {
                            @ExampleObject(name = "Pior estação", value = ApiExamples.ASK),
                            @ExampleObject(name = "Pedir gráfico", value = ApiExamples.ASK_CHART)})),
            responses = {
                    @ApiResponse(responseCode = "200", description = "Resposta do assistente",
                            content = @Content(schema = @Schema(implementation = ChatMessageResponse.class),
                                    examples = @ExampleObject(value = ApiExamples.CHAT_MESSAGE))),
                    @ApiResponse(responseCode = "400", description = "Pergunta vazia ou longa demais",
                            content = @Content(schema = @Schema(implementation = ApiError.class),
                                    examples = @ExampleObject(value = ApiExamples.ERR_400_QUESTION))),
                    @ApiResponse(responseCode = "503", description = "Ollama fora do ar",
                            content = @Content(schema = @Schema(implementation = ApiError.class),
                                    examples = @ExampleObject(value = ApiExamples.ERR_503_OLLAMA)))})
    public ChatMessageResponse ask(@RequestBody AskRequest body, @AuthenticationPrincipal CurrentUser user) {
        return ChatMessageResponse.from(assistant.ask(body == null ? null : body.question(), user));
    }

    @DeleteMapping("/history")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Limpar a conversa", description = "Apaga só as mensagens do usuário logado.",
            responses = @ApiResponse(responseCode = "204", description = "Conversa apagada"))
    public void clear(@AuthenticationPrincipal CurrentUser user) {
        assistant.clearHistory(user);
    }
}
