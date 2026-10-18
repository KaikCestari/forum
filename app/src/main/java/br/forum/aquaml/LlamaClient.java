package br.forum.aquaml;

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

/** Cliente do Llama servido localmente pelo Ollama (API /api/chat e /api/tags). */
public class LlamaClient {

    public record Message(String role, String content) {}

    public record Status(boolean available, boolean modelInstalled, String url, String model,
                         List<String> models, String error) {}

    private static final Duration ANSWER_TIMEOUT = Duration.ofMinutes(5);

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
    private final String baseUrl;
    private final String model;

    public LlamaClient(String baseUrl, String model) {
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        this.model = model;
    }

    public String model() {
        return model;
    }

    /** O Ollama está no ar e o modelo já foi baixado? */
    public Status status() {
        try {
            HttpResponse<String> r = http.send(HttpRequest.newBuilder(URI.create(baseUrl + "/api/tags"))
                    .timeout(Duration.ofSeconds(5)).GET().build(), HttpResponse.BodyHandlers.ofString());
            if (r.statusCode() != 200) {
                return new Status(false, false, baseUrl, model, List.of(), "Ollama respondeu HTTP " + r.statusCode());
            }
            List<String> models = new ArrayList<>();
            mapper.readTree(r.body()).path("models").forEach(m -> models.add(m.path("name").asText()));
            boolean installed = models.stream().anyMatch(this::matches);
            return new Status(true, installed, baseUrl, model, models,
                    installed ? null : "Modelo " + model + " não instalado; rode: ollama pull " + model);
        } catch (IOException e) {
            return new Status(false, false, baseUrl, model, List.of(),
                    "Ollama não encontrado em " + baseUrl + "; instale e rode: ollama serve");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new Status(false, false, baseUrl, model, List.of(), "interrompido");
        }
    }

    private boolean matches(String installed) {
        return installed.equals(model) || installed.equals(model + ":latest")
                || (!model.contains(":") && installed.startsWith(model + ":"));
    }

    /** Envia a conversa e devolve a resposta completa (sem streaming). */
    public String chat(List<Message> messages) throws IOException, InterruptedException {
        String body = mapper.writeValueAsString(Map.of(
                "model", model,
                "messages", messages,
                "stream", false,
                "options", Map.of("temperature", 0.2, "num_ctx", 8192)));
        HttpResponse<String> r = http.send(HttpRequest.newBuilder(URI.create(baseUrl + "/api/chat"))
                        .timeout(ANSWER_TIMEOUT)
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(body)).build(),
                HttpResponse.BodyHandlers.ofString());
        JsonNode json = mapper.readTree(r.body());
        if (r.statusCode() != 200) {
            throw new IOException("Llama respondeu HTTP " + r.statusCode() + ": " + json.path("error").asText(r.body()));
        }
        return json.path("message").path("content").asText().strip();
    }
}
