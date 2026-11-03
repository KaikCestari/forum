package br.forum.aquaml.analysis.infrastructure.ml;

import br.forum.aquaml.analysis.domain.AnalysisInput;
import br.forum.aquaml.analysis.domain.AnalysisResult;
import br.forum.aquaml.analysis.domain.MlServiceClient;
import br.forum.aquaml.analysis.domain.MlServiceException;
import br.forum.aquaml.monitoring.domain.Measurement;
import br.forum.aquaml.monitoring.domain.MonitoringEvent;
import br.forum.aquaml.monitoring.domain.Station;
import br.forum.aquaml.monitoring.domain.WaterParameters;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.net.http.HttpClient;
import java.time.Duration;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Adaptador HTTP da porta {@link MlServiceClient}: envia {@code POST /analyze} ao serviço Python (FastAPI) no
 * formato {@code AnalyzeRequest} do contrato e recebe o {@code AnalysisResult}.
 */
@Component
public class HttpMlServiceClient implements MlServiceClient {

    private static final Logger log = LoggerFactory.getLogger(HttpMlServiceClient.class);
    private static final DateTimeFormatter TIMESTAMP = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    private final RestClient http;
    private final String baseUrl;
    private final ObjectMapper mapper;

    public HttpMlServiceClient(@Value("${aquaml.ml-service.url}") String baseUrl, ObjectMapper mapper) {
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        this.mapper = mapper;
        HttpClient jdk = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(jdk);
        factory.setReadTimeout(Duration.ofMinutes(10));
        this.http = RestClient.builder().baseUrl(this.baseUrl).requestFactory(factory).build();
    }

    @Override
    public AnalysisResult analyze(AnalysisInput input) {
        try {
            String body = http.post().uri("/analyze")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(toRequest(input))
                    .retrieve()
                    .body(String.class);
            return AnalysisResult.fromJson(body);
        } catch (ResourceAccessException e) {
            throw new MlServiceException("O serviço de análise (machine learning) não está respondendo em "
                    + baseUrl + ". Confira se ele foi iniciado e tente de novo.");
        } catch (RestClientResponseException e) {
            if (e.getStatusCode().value() == 422) {
                throw new MlServiceException("O serviço de análise recusou os dados: " + detail(e.getResponseBodyAsString()));
            }
            log.warn("Serviço de ML respondeu HTTP {}", e.getStatusCode().value());
            throw new MlServiceException("O serviço de análise respondeu com erro (HTTP " + e.getStatusCode().value() + ").");
        }
    }

    /** O FastAPI responde {@code {"detail": "mensagem"}}; se o detalhe não for texto, usamos uma frase genérica. */
    private String detail(String body) {
        try {
            JsonNode d = mapper.readTree(body).path("detail");
            return d.isTextual() ? d.asText() : "os dados estão num formato inesperado.";
        } catch (Exception e) {
            return "os dados estão num formato inesperado.";
        }
    }

    /* ---------- formato AnalyzeRequest do contrato ---------- */

    record StationDto(String id, String name, String type, Double lat, Double lon) {
    }

    record MeasurementDto(String timestamp, String stationId, Double ph, Double doMgl, Double tempC,
                          Double turbidityNtu, Double conductivityUscm, Double nitrateMgl, Double phosphorusMgl,
                          Double coliformsNmp) {
    }

    record EventDto(String stationId, String start, String end, String type, String description) {
    }

    record AnalyzeRequest(List<StationDto> stations, List<MeasurementDto> measurements, List<EventDto> events) {
    }

    static AnalyzeRequest toRequest(AnalysisInput input) {
        return new AnalyzeRequest(
                input.stations().stream().map(HttpMlServiceClient::station).toList(),
                input.measurements().stream().map(HttpMlServiceClient::measurement).toList(),
                input.events().stream().map(HttpMlServiceClient::event).toList());
    }

    private static StationDto station(Station s) {
        return new StationDto(s.getId(), s.getName(), s.getType().code(), s.getLat(), s.getLon());
    }

    private static MeasurementDto measurement(Measurement m) {
        WaterParameters p = m.getParameters();
        return new MeasurementDto(m.getTimestamp().format(TIMESTAMP), m.getStationId(), p.ph(), p.doMgl(), p.tempC(),
                p.turbidityNtu(), p.conductivityUscm(), p.nitrateMgl(), p.phosphorusMgl(), p.coliformsNmp());
    }

    private static EventDto event(MonitoringEvent e) {
        return new EventDto(e.getStationId(), e.getStartDate().toString(), e.getEndDate().toString(), e.getType(),
                e.getDescription());
    }
}
