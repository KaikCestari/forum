package br.forum.aquaml.shared.ollama;

import br.forum.aquaml.shared.domain.ServiceUnavailableException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Cliente HTTP do Ollama ({@code /api/chat} e {@code /api/tags}), local ou no Ollama Cloud.
 * No Cloud a chave vai no cabeçalho {@code Authorization: Bearer}. A chave nunca aparece em logs nem em erros.
 *
 * <p>Fica em {@code shared} porque é usado por dois contextos: o assistente (texto) e as imagens (visão).
 */
@Component
public class OllamaClient {

    private static final Duration ANSWER_TIMEOUT = Duration.ofMinutes(5);

    private final OllamaProperties props;
    private final ObjectMapper mapper;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(6)).build();

    public OllamaClient(OllamaProperties props, ObjectMapper mapper) {
        this.props = props;
        this.mapper = mapper;
    }

    /** Modelo do assistente (fixo, vem do .env). */
    public String chatModel() {
        return props.model();
    }

    /** Modelo com visão usado para ler as imagens. */
    public String visionModel() {
        return props.visionModel();
    }

    /** O Ollama responde? Usa {@code /api/tags}, que é rápido. */
    public boolean isAvailable() {
        try {
            HttpResponse<Void> r = http.send(request("/api/tags").timeout(Duration.ofSeconds(8)).GET().build(),
                    HttpResponse.BodyHandlers.discarding());
            return r.statusCode() == 200;
        } catch (IOException e) {
            return false;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    /**
     * Envia a conversa e devolve o texto da resposta (sem streaming).
     *
     * @param json quando verdadeiro, pede ao Ollama que responda só com um objeto JSON
     * @throws ServiceUnavailableException se o Ollama estiver fora ou responder com erro
     */
    public String chat(List<OllamaMessage> messages, String model, boolean json) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", model);
        payload.put("messages", messages);
        payload.put("stream", false);
        payload.put("options", Map.of("temperature", 0.2, "num_ctx", 8192));
        if (json) {
            payload.put("format", "json");
        }
        try {
            HttpRequest req = request("/api/chat")
                    .timeout(ANSWER_TIMEOUT)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(payload)))
                    .build();
            HttpResponse<String> r = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (r.statusCode() != 200) {
                // O corpo da resposta do provedor pode ter detalhes internos: não repassamos.
                throw new ServiceUnavailableException("O Ollama respondeu com erro (HTTP " + r.statusCode() + ").");
            }
            return mapper.readTree(r.body()).path("message").path("content").asText("").strip();
        } catch (IOException e) {
            throw new ServiceUnavailableException("Não foi possível falar com o Ollama em " + props.url() + ".", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ServiceUnavailableException("A chamada ao Ollama foi interrompida.", e);
        }
    }

    private HttpRequest.Builder request(String path) {
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(props.url() + path));
        if (!props.apiKey().isEmpty()) {
            b.header("Authorization", "Bearer " + props.apiKey());
        }
        return b;
    }
}
