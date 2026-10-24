package br.forum.aquaml;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Cliente da API do Ollama (/api/chat e /api/tags), local ou na nuvem (ollama.com), que usa a mesma API
 * com a chave no cabeçalho Bearer. A chave nunca entra em mensagens de erro nem em logs.
 */
public class LlamaClient {

    /** Mensagem de conversa; {@code images} (base64) só vai quando o modelo precisa enxergar. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Message(String role, String content, List<String> images) {
        public Message(String role, String content) {
            this(role, content, null);
        }
    }

    public record Status(boolean available, boolean modelInstalled, String url, String model,
                         List<String> models, String error) {}

    private static final Duration ANSWER_TIMEOUT = Duration.ofMinutes(5);

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(6)).build();
    private final String baseUrl;
    private final String model;
    private final String apiKey;

    public LlamaClient(String baseUrl, String model) {
        this(baseUrl, model, "");
    }

    public LlamaClient(String baseUrl, String model, String apiKey) {
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        this.model = model;
        this.apiKey = apiKey == null ? "" : apiKey.strip();
    }

    private HttpRequest.Builder request(String path) {
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(baseUrl + path));
        if (!apiKey.isEmpty()) {
            b.header("Authorization", "Bearer " + apiKey);
        }
        return b;
    }

    public String model() {
        return model;
    }

    /** O Ollama está no ar e o modelo já foi baixado? */
    public Status status() {
        try {
            HttpResponse<String> r = http.send(request("/api/tags")
                    .timeout(Duration.ofSeconds(10)).GET().build(), HttpResponse.BodyHandlers.ofString());
            if (r.statusCode() != 200) {
                return new Status(false, false, baseUrl, model, List.of(), "Ollama respondeu HTTP " + r.statusCode());
            }
            List<String> models = new ArrayList<>();
            mapper.readTree(r.body()).path("models").forEach(m -> models.add(m.path("name").asText()));
            boolean installed = models.stream().anyMatch(this::matches);
            return new Status(true, installed, baseUrl, model, models,
                    installed ? null : "Modelo " + model + " não instalado; rode: ollama pull " + model);
        } catch (IOException e) {
            boolean local = baseUrl.contains("localhost") || baseUrl.contains("127.0.0.1");
            return new Status(false, false, baseUrl, model, List.of(), local
                    ? "Ollama não encontrado em " + baseUrl + "; instale e rode: ollama serve"
                    : "Não foi possível conectar a " + baseUrl + "; confira a internet e a chave");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new Status(false, false, baseUrl, model, List.of(), "interrompido");
        }
    }

    private boolean matches(String installed) {
        return installed.equals(model) || installed.equals(model + ":latest")
                || (!model.contains(":") && installed.startsWith(model + ":"));
    }

    /** Envia a conversa ao modelo configurado e devolve a resposta completa (sem streaming). */
    public String chat(List<Message> messages) throws IOException, InterruptedException {
        return chat(messages, model, false);
    }

    /**
     * Envia a conversa a um modelo específico. Com {@code json}, o Ollama é instruído a responder só com um objeto JSON.
     */
    public String chat(List<Message> messages, String useModel, boolean json) throws IOException, InterruptedException {
        Map<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("model", useModel);
        payload.put("messages", messages);
        payload.put("stream", false);
        payload.put("options", Map.of("temperature", 0.2, "num_ctx", 8192));
        if (json) {
            payload.put("format", "json");
        }
        HttpResponse<String> r = http.send(request("/api/chat")
                        .timeout(ANSWER_TIMEOUT)
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(payload))).build(),
                HttpResponse.BodyHandlers.ofString());
        JsonNode body = mapper.readTree(r.body());
        if (r.statusCode() != 200) {
            throw new IOException("Llama respondeu HTTP " + r.statusCode() + ": " + body.path("error").asText(r.body()));
        }
        return body.path("message").path("content").asText().strip();
    }
}
