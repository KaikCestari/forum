package br.forum.aquaml.analysis;

import br.forum.aquaml.ApiTestSupport;
import br.forum.aquaml.analysis.domain.AnalysisInput;
import br.forum.aquaml.analysis.domain.AnalysisResult;
import br.forum.aquaml.analysis.domain.MlServiceException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AnalysisApiTest extends ApiTestSupport {

    private static final String CSV = """
            Data;Estação;pH;OD (mg/L);Coliformes (NMP/100mL)
            01/01/2026 00:00;rio-a;7,1;3,9;<10
            01/01/2026 04:00;rio-a;7,0;4,0;20
            01/01/2026 08:00;rio-a;7,2;4,1;30
            01/01/2026 12:00;rio-a;7,3;4,2;40
            01/01/2026 16:00;rio-a;7,1;4,0;50
            01/01/2026 20:00;rio-a;7,0;3,8;60
            """;

    private static final String STATIONS = """
            id;nome;tipo;latitude;longitude
            rio-a;Rio A;rio;-23,5;-46,6
            """;

    private String admin;

    @BeforeEach
    void cleanData() throws Exception {
        admin = adminToken();
        mvc.perform(delete("/api/data").header("Authorization", bearer(admin))).andExpect(status().isNoContent());
    }

    private static AnalysisResult sampleResult() throws Exception {
        try (var in = AnalysisApiTest.class.getResourceAsStream("/ml-result.json")) {
            return AnalysisResult.fromJson(new String(in.readAllBytes(), StandardCharsets.UTF_8));
        }
    }

    private org.springframework.test.web.servlet.ResultActions importCsv() throws Exception {
        return mvc.perform(multipart("/api/data/import")
                .file(new MockMultipartFile("measurements", "leituras.csv", "text/csv", CSV.getBytes(StandardCharsets.UTF_8)))
                .file(new MockMultipartFile("stations", "estacoes.csv", "text/csv", STATIONS.getBytes(StandardCharsets.UTF_8)))
                .param("name", "Campanha de janeiro")
                .header("Authorization", bearer(admin)));
    }

    @Test
    void latestIs204WhenThereIsNoAnalysis() throws Exception {
        mvc.perform(get("/api/analysis/latest").header("Authorization", bearer(admin)))
                .andExpect(status().isNoContent());
    }

    @Test
    void importRunsAnalysisAndStoresResultAndAlerts() throws Exception {
        when(mlService.analyze(any())).thenReturn(sampleResult());

        importCsv()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Campanha de janeiro"))
                .andExpect(jsonPath("$.measurements").value(6))
                .andExpect(jsonPath("$.stations").value(1))
                .andExpect(jsonPath("$.events").value(0))
                .andExpect(jsonPath("$.readingsPerDay").value(6.0))
                .andExpect(jsonPath("$.warnings").isArray())
                .andExpect(jsonPath("$.analysis.status").value("CONCLUIDA"))
                .andExpect(jsonPath("$.analysis.iqaMean").value(45.0))
                .andExpect(jsonPath("$.analysis.alertCount").value(2))
                .andExpect(jsonPath("$.analysis.accuracy").value(0.91))
                .andExpect(jsonPath("$.analysis.error").isEmpty());

        ArgumentCaptor<AnalysisInput> input = ArgumentCaptor.forClass(AnalysisInput.class);
        verify(mlService).analyze(input.capture());
        assertEquals(6, input.getValue().measurements().size());
        assertEquals(5.0, input.getValue().measurements().get(0).getParameters().coliformsNmp());
        assertEquals("Rio A", input.getValue().stations().get(0).getName());

        mvc.perform(get("/api/analysis/latest").header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.classification.accuracy").value(0.91))
                .andExpect(jsonPath("$.series['rio-a'].iqa[0]").value(45.0));

        mvc.perform(get("/api/alerts").param("severity", "critico").header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].parameter").value("coliformsNmp"))
                .andExpect(jsonPath("$[0].value").value(5000.0));

        mvc.perform(get("/api/stations").header("Authorization", bearer(admin)))
                .andExpect(jsonPath("$[?(@.id == 'rio-a')].latest.iqaClass").value("Regular"))
                .andExpect(jsonPath("$[?(@.id == 'rio-a')].clusterLabel").value("Água com pouco oxigênio"))
                .andExpect(jsonPath("$[?(@.id == 'rio-a')].alertsRecent").value(2));

        mvc.perform(get("/api/stations/rio-a/series").header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dates[0]").value("2026-01-01"));
        mvc.perform(get("/api/stations/nao-existe/series").header("Authorization", bearer(admin)))
                .andExpect(status().isNotFound());

        mvc.perform(get("/api/dashboard").header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasData").value(true))
                .andExpect(jsonPath("$.summary.datasetName").value("Campanha de janeiro"))
                .andExpect(jsonPath("$.summary.measurements").value(6))
                .andExpect(jsonPath("$.summary.firstReading").value("2026-01-01T00:00:00"))
                .andExpect(jsonPath("$.lastRun.status").value("CONCLUIDA"))
                .andExpect(jsonPath("$.iqaMean").value(45.0))
                .andExpect(jsonPath("$.stationsAtRisk").value(1))
                .andExpect(jsonPath("$.recentAlerts.length()").value(2))
                .andExpect(jsonPath("$.insights[0]").value("O Rio A está com oxigênio baixo."));
    }

    @Test
    void whenMlServiceIsDownTheImportSucceedsAndTheRunFails() throws Exception {
        when(mlService.analyze(any())).thenThrow(new MlServiceException("O serviço de análise não está respondendo."));

        importCsv()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.measurements").value(6))
                .andExpect(jsonPath("$.analysis.status").value("FALHOU"))
                .andExpect(jsonPath("$.analysis.error").value("O serviço de análise não está respondendo."));

        mvc.perform(get("/api/data/summary").header("Authorization", bearer(admin)))
                .andExpect(jsonPath("$.measurements").value(6));
        mvc.perform(post("/api/analysis/run").header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("FALHOU"));
        mvc.perform(get("/api/analysis/runs").header("Authorization", bearer(admin)))
                .andExpect(jsonPath("$[0].status").value("FALHOU"));
    }

    @Test
    void runWithoutDataFailsWithFriendlyMessage() throws Exception {
        mvc.perform(post("/api/analysis/run").header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("FALHOU"))
                .andExpect(jsonPath("$.error").isString());
        mvc.perform(get("/api/data/summary").header("Authorization", bearer(admin)))
                .andExpect(jsonPath("$.datasetName").isEmpty())
                .andExpect(jsonPath("$.firstReading").isEmpty());
    }

    @Test
    void invalidCsvReturns400() throws Exception {
        mvc.perform(multipart("/api/data/import")
                        .file(new MockMultipartFile("measurements", "x.csv", "text/csv", "foo,bar\n1,2\n".getBytes()))
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").isString());
    }
}
