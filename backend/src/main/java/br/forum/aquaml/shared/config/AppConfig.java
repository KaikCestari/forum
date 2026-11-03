package br.forum.aquaml.shared.config;

import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.context.annotation.Configuration;

/** Liga a leitura das classes {@code @ConfigurationProperties} (Ollama, JWT, serviço de ML, pastas). */
@Configuration
@ConfigurationPropertiesScan("br.forum.aquaml")
public class AppConfig {
}
