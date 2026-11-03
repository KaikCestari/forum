package br.forum.aquaml.imagery.interfaces;

import br.forum.aquaml.imagery.domain.ColorIndicators;
import br.forum.aquaml.imagery.domain.ImageStatus;
import br.forum.aquaml.imagery.domain.VisionReading;
import br.forum.aquaml.imagery.domain.WaterImage;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;

public record WaterImageResponse(Long id, String stationId, String stationName, String kind, LocalDate observedOn,
                                 Instant uploadedAt, String uploadedBy, ImageStatus status, String fileUrl,
                                 ColorIndicators colorIndicators, VisionReading vision, String analysisError) {

    public static WaterImageResponse from(WaterImage i, Map<String, String> stationNames) {
        return new WaterImageResponse(i.getId(), i.getStationId(),
                stationNames.getOrDefault(i.getStationId(), i.getStationId()), i.getKind(), i.getObservedOn(),
                i.getUploadedAt(), i.getUploadedByName(), i.getStatus(), "/api/images/" + i.getId() + "/file",
                i.getColorIndicators(), i.getVision(), i.getAnalysisError());
    }
}
