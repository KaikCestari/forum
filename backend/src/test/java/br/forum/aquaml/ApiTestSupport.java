package br.forum.aquaml;

import br.forum.aquaml.analysis.domain.MlServiceClient;
import br.forum.aquaml.imagery.domain.VisionAnalyzer;
import br.forum.aquaml.shared.ollama.OllamaClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Base dos testes de API: sobe o Spring inteiro com banco H2 em memória e troca os serviços externos
 * (serviço de ML, modelo com visão e Ollama) por dublês do Mockito.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class ApiTestSupport {

    protected static final String ADMIN_EMAIL = "admin@aquaml.local";
    protected static final String ADMIN_PASSWORD = "admin123";

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected ObjectMapper json;

    @MockitoBean
    protected MlServiceClient mlService;

    @MockitoBean
    protected VisionAnalyzer visionAnalyzer;

    @MockitoBean
    protected OllamaClient ollama;

    protected String login(String email, String password) throws Exception {
        String body = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("email", email, "password", password))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }

    protected String adminToken() throws Exception {
        return login(ADMIN_EMAIL, ADMIN_PASSWORD);
    }

    /** Cria um usuário (como ADMIN) e devolve o token dele. */
    protected String createUserAndLogin(String email, String role) throws Exception {
        mvc.perform(post("/api/users")
                        .header("Authorization", "Bearer " + adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("name", "Pessoa " + email, "email", email,
                                "password", "senha123", "role", role))))
                .andExpect(status().isCreated());
        return login(email, "senha123");
    }

    protected static String bearer(String token) {
        return "Bearer " + token;
    }

    protected JsonNode read(String body) throws Exception {
        return json.readTree(body);
    }
}
