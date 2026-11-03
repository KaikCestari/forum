package br.forum.aquaml.shared.config;

import br.forum.aquaml.shared.docs.ApiExamples;
import io.swagger.v3.core.util.Json;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.examples.Example;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    private static final String JWT = "bearerAuth";

    private static final String DESCRIPTION = """
            Algoritmos e machine learning no estudo de ecossistemas aquáticos.

            **Como testar por esta página**
            1. Abra **1. Login → POST /api/auth/login**, clique em *Try it out* e em *Execute* \
            (o corpo do ADMIN já vem preenchido).
            2. Copie o `token` da resposta, clique no cadeado **Authorize** no topo e cole.
            3. Pronto: todas as rotas têm corpos de exemplo (mocks) prontos. Em várias há mais de um \
            exemplo no menu *Examples*.

            Ordem sugerida para um sistema vazio: **4. Dados → importar** (arquivos em `docs/postman/dados/`), \
            depois painel, estações, alertas, imagens, anotações e assistente.

            **Papéis:** `ADMIN` faz tudo; `FUNCIONARIO` recebe **403** em usuários, importar/apagar dados, \
            rodar análise e criar estação. Erros sempre no formato `{"status": 400, "error": "mensagem"}`.

            Contrato completo em `docs/CONTRATO-API.md`.""";

    @Bean
    public OpenAPI aquamlOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("AquaML API")
                        .version("1.0.0")
                        .description(DESCRIPTION))
                .components(new Components().addSecuritySchemes(JWT, new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")
                        .description("Cole só o token, sem a palavra Bearer.")))
                .addSecurityItem(new SecurityRequirement().addList(JWT));
    }

    @Bean
    public OpenApiCustomizer unauthorizedResponse() {
        return openApi -> openApi.getPaths().values().forEach(path -> path.readOperations().forEach(op -> {
            boolean open = op.getSecurity() != null && op.getSecurity().isEmpty();
            if (open || op.getResponses().containsKey("401")) {
                return;
            }
            op.getResponses().addApiResponse("401", new ApiResponse()
                    .description("Sem token, token inválido ou vencido")
                    .content(new Content().addMediaType("application/json", new MediaType()
                            .schema(new Schema<>().$ref("#/components/schemas/ApiError"))
                            .addExamples("sem login", new Example().value(json(ApiExamples.ERR_401))))));
        }));
    }

    private static Object json(String text) {
        try {
            return Json.mapper().readTree(text);
        } catch (Exception e) {
            return text;
        }
    }
}
