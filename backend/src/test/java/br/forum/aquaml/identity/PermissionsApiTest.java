package br.forum.aquaml.identity;

import br.forum.aquaml.ApiTestSupport;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Tabela de permissões do contrato: ADMIN x FUNCIONARIO, e a regra "dono ou ADMIN". */
class PermissionsApiTest extends ApiTestSupport {

    @Test
    void adminCreatesUserAndListsUsers() throws Exception {
        mvc.perform(post("/api/users")
                        .header("Authorization", bearer(adminToken()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("name", "Bióloga Ana", "email", "Ana@AquaML.local",
                                "password", "senha123", "role", "FUNCIONARIO"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.name").value("Bióloga Ana"))
                .andExpect(jsonPath("$.email").value("ana@aquaml.local"))
                .andExpect(jsonPath("$.role").value("FUNCIONARIO"))
                .andExpect(jsonPath("$.active").value(true));

        mvc.perform(get("/api/users").header("Authorization", bearer(adminToken())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.email == 'ana@aquaml.local')]").exists());

        // E-mail repetido é recusado.
        mvc.perform(post("/api/users")
                        .header("Authorization", bearer(adminToken()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("name", "Outra", "email", "ana@aquaml.local",
                                "password", "senha123", "role", "FUNCIONARIO"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void funcionarioGets403OnAdminRoutes() throws Exception {
        String token = createUserAndLogin("func403@aquaml.local", "FUNCIONARIO");

        mvc.perform(get("/api/users").header("Authorization", bearer(token)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.error").isString());
        mvc.perform(post("/api/analysis/run").header("Authorization", bearer(token)))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/data").header("Authorization", bearer(token)))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/stations").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"X\",\"type\":\"rio\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(multipart("/api/data/import")
                        .file(new MockMultipartFile("measurements", "m.csv", "text/csv", "a,b\n1,2\n".getBytes()))
                        .header("Authorization", bearer(token)))
                .andExpect(status().isForbidden());

        // Rotas de leitura continuam abertas para o FUNCIONARIO.
        mvc.perform(get("/api/dashboard").header("Authorization", bearer(token))).andExpect(status().isOk());
        mvc.perform(get("/api/stations").header("Authorization", bearer(token))).andExpect(status().isOk());
    }

    @Test
    void adminCannotDeleteItself() throws Exception {
        String admin = adminToken();
        long id = read(mvc.perform(get("/api/auth/me").header("Authorization", bearer(admin)))
                .andReturn().getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(delete("/api/users/" + id).header("Authorization", bearer(admin)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void onlyAuthorOrAdminDeletesNote() throws Exception {
        String admin = adminToken();
        mvc.perform(post("/api/stations").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":\"lagoa-notas\",\"name\":\"Lagoa das Notas\",\"type\":\"lago\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("lagoa-notas"))
                .andExpect(jsonPath("$.latest").isEmpty());

        String author = createUserAndLogin("autor@aquaml.local", "FUNCIONARIO");
        String other = createUserAndLogin("outro@aquaml.local", "FUNCIONARIO");
        String body = mvc.perform(post("/api/notes").header("Authorization", bearer(author))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"stationId\":\"lagoa-notas\",\"notedOn\":\"2026-10-01\",\"kind\":\"coleta\",\"text\":\"Coleta de 2 frascos\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.stationName").value("Lagoa das Notas"))
                .andExpect(jsonPath("$.author").value("Pessoa autor@aquaml.local"))
                .andReturn().getResponse().getContentAsString();
        long noteId = read(body).get("id").asLong();

        mvc.perform(delete("/api/notes/" + noteId).header("Authorization", bearer(other)))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/notes/" + noteId).header("Authorization", bearer(admin)))
                .andExpect(status().isNoContent());
        mvc.perform(delete("/api/notes/" + noteId).header("Authorization", bearer(admin)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }
}
