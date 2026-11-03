package br.forum.aquaml.assistant;

import br.forum.aquaml.ApiTestSupport;
import br.forum.aquaml.shared.domain.ServiceUnavailableException;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Assistente com o Ollama trocado por um dublê. */
class AssistantApiTest extends ApiTestSupport {

    @Test
    void asksAndKeepsHistoryPerUser() throws Exception {
        when(ollama.chatModel()).thenReturn("modelo-teste");
        when(ollama.chat(anyList(), anyString(), anyBoolean())).thenReturn("A água está boa.");
        String token = createUserAndLogin("pergunta@aquaml.local", "FUNCIONARIO");

        mvc.perform(post("/api/assistant/ask").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"question\":\"Como está o rio?\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.question").value("Como está o rio?"))
                .andExpect(jsonPath("$.answer").value("A água está boa."))
                .andExpect(jsonPath("$.model").value("modelo-teste"))
                .andExpect(jsonPath("$.createdAt").isString());

        mvc.perform(get("/api/assistant/history").header("Authorization", bearer(token)))
                .andExpect(jsonPath("$.length()").value(1));
        mvc.perform(get("/api/assistant/history").header("Authorization", bearer(adminToken())))
                .andExpect(jsonPath("$.length()").value(0));
        mvc.perform(delete("/api/assistant/history").header("Authorization", bearer(token)))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/assistant/history").header("Authorization", bearer(token)))
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void returns503WhenOllamaIsDown() throws Exception {
        when(ollama.chat(anyList(), anyString(), anyBoolean()))
                .thenThrow(new ServiceUnavailableException("Não foi possível falar com o Ollama."));
        when(ollama.chatModel()).thenReturn("modelo-teste");
        when(ollama.isAvailable()).thenReturn(false);
        String admin = adminToken();

        mvc.perform(post("/api/assistant/ask").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"question\":\"Oi?\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value(503));
        mvc.perform(get("/api/assistant/status").header("Authorization", bearer(admin)))
                .andExpect(jsonPath("$.available").value(false))
                .andExpect(jsonPath("$.model").value("modelo-teste"));
    }
}
