package br.forum.aquaml;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Ponto de entrada do backend do AquaML.
 *
 * <p>O código está dividido por contextos (identity, monitoring, analysis, imagery, assistant) e, dentro de cada
 * um, pelas camadas do DDD: domain, application, infrastructure e interfaces. Veja o README.md.
 */
@SpringBootApplication
public class AquamlApplication {

    public static void main(String[] args) {
        SpringApplication.run(AquamlApplication.class, args);
    }
}
