package br.forum.aquaml.shared.ollama;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "aquaml.ollama")
public record OllamaProperties(String url, String apiKey, String model, String visionModel) {

    public OllamaProperties {
        url = (url == null || url.isBlank() ? "http://localhost:11434" : url.strip()).replaceAll("/+$", "");
        apiKey = apiKey == null ? "" : apiKey.strip();
        model = model == null || model.isBlank() ? "llama3.2" : model.strip();
        visionModel = visionModel == null || visionModel.isBlank() ? "gemma4:31b" : visionModel.strip();
    }

    @Override
    public String toString() {
        return "OllamaProperties[url=" + url + ", apiKey=" + (apiKey.isEmpty() ? "(vazia)" : "(definida)")
                + ", model=" + model + ", visionModel=" + visionModel + "]";
    }
}
