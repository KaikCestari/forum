package br.forum.aquaml.shared.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configuração do Swagger (OpenAPI).
 *
 * <p>Abra {@code /swagger-ui.html}, faça login em {@code POST /api/auth/login}, copie o {@code token}
 * e cole no botão "Authorize". A partir daí todas as rotas podem ser testadas pela página.
 */
@Configuration
public class OpenApiConfig {

    private static final String JWT = "bearerAuth";

    @Bean
    public OpenAPI aquamlOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("AquaML API")
                        .version("1.0.0")
                        .description("Algoritmos e machine learning no estudo de ecossistemas aquáticos. "
                                + "Papéis: ADMIN e FUNCIONARIO. Contrato completo em docs/CONTRATO-API.md."))
                .components(new Components().addSecuritySchemes(JWT, new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList(JWT));
    }
}
