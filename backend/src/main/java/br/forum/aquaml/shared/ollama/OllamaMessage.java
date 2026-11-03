package br.forum.aquaml.shared.ollama;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/** Uma mensagem da conversa com o Ollama; {@code images} (base64) só vai quando o modelo precisa enxergar. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record OllamaMessage(String role, String content, List<String> images) {

    public static OllamaMessage system(String content) {
        return new OllamaMessage("system", content, null);
    }

    public static OllamaMessage user(String content) {
        return new OllamaMessage("user", content, null);
    }

    public static OllamaMessage assistant(String content) {
        return new OllamaMessage("assistant", content, null);
    }

    public static OllamaMessage userWithImage(String content, String imageBase64) {
        return new OllamaMessage("user", content, List.of(imageBase64));
    }
}
