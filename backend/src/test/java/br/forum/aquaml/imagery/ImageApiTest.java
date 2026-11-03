package br.forum.aquaml.imagery;

import br.forum.aquaml.ApiTestSupport;
import br.forum.aquaml.imagery.domain.VisionReading;
import br.forum.aquaml.imagery.domain.VisionUnavailableException;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ImageApiTest extends ApiTestSupport {

    private static byte[] png() throws Exception {
        BufferedImage img = new BufferedImage(20, 20, BufferedImage.TYPE_INT_RGB);
        var g = img.createGraphics();
        g.setColor(new Color(30, 140, 70));
        g.fillRect(0, 0, 20, 20);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "png", out);
        return out.toByteArray();
    }

    @Test
    void uploadWithVisionReadingThenConfirm() throws Exception {
        when(visionAnalyzer.read(any(), anyString())).thenReturn(
                new VisionReading("verde", "media", true, false, false, false, null, 2, "Água esverdeada."));
        String token = createUserAndLogin("fotografa@aquaml.local", "FUNCIONARIO");

        String body = mvc.perform(multipart("/api/images")
                        .file(new MockMultipartFile("file", "lago.png", "image/png", png()))
                        .param("kind", "foto")
                        .param("observedOn", "2026-10-20")
                        .param("newStationName", "Lago Azul")
                        .param("newStationType", "lago")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDENTE"))
                .andExpect(jsonPath("$.stationName").value("Lago Azul"))
                .andExpect(jsonPath("$.uploadedBy").value("Pessoa fotografa@aquaml.local"))
                .andExpect(jsonPath("$.colorIndicators.greenishFraction").value(1.0))
                .andExpect(jsonPath("$.vision.turbidity").value("media"))
                .andExpect(jsonPath("$.analysisError").isEmpty())
                .andReturn().getResponse().getContentAsString();
        long id = read(body).get("id").asLong();
        String fileUrl = read(body).get("fileUrl").asText();

        mvc.perform(get(fileUrl).param("token", token))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG));
        mvc.perform(get(fileUrl)).andExpect(status().isUnauthorized());

        mvc.perform(post("/api/images/" + id + "/confirm").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"turbidity\":\"alta\",\"attentionLevel\":3,\"notes\":\"conferido\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONFIRMADA"))
                .andExpect(jsonPath("$.vision.turbidity").value("alta"))
                .andExpect(jsonPath("$.vision.waterColor").value("verde"))
                .andExpect(jsonPath("$.vision.attentionLevel").value(3));

        String other = createUserAndLogin("outra-foto@aquaml.local", "FUNCIONARIO");
        mvc.perform(delete("/api/images/" + id).header("Authorization", bearer(other)))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/images/" + id).header("Authorization", bearer(token)))
                .andExpect(status().isNoContent());
    }

    @Test
    void whenVisionModelIsDownTheImageIsStoredWithError() throws Exception {
        when(visionAnalyzer.read(any(), anyString())).thenThrow(new VisionUnavailableException("O modelo não respondeu."));
        String admin = adminToken();
        mvc.perform(post("/api/stations").header("Authorization", bearer(admin))
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Rio das Fotos\",\"type\":\"rio\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("rio-das-fotos"));

        mvc.perform(multipart("/api/images")
                        .file(new MockMultipartFile("file", "rio.png", "image/png", png()))
                        .param("kind", "satelite")
                        .param("observedOn", "2026-10-21")
                        .param("stationId", "rio-das-fotos")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("ERRO_ANALISE"))
                .andExpect(jsonPath("$.vision").isEmpty())
                .andExpect(jsonPath("$.analysisError").value("O modelo não respondeu."));
    }

    @Test
    void rejectsFileThatIsNotAnImage() throws Exception {
        mvc.perform(multipart("/api/images")
                        .file(new MockMultipartFile("file", "x.png", "image/png", "não é imagem".getBytes()))
                        .param("kind", "foto")
                        .param("observedOn", "2026-10-21")
                        .param("newStationName", "Qualquer")
                        .header("Authorization", bearer(adminToken())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }
}
