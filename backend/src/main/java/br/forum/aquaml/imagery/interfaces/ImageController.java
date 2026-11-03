package br.forum.aquaml.imagery.interfaces;

import io.swagger.v3.oas.annotations.tags.Tag;
import br.forum.aquaml.identity.application.CurrentUser;
import br.forum.aquaml.imagery.application.ImageService;
import br.forum.aquaml.imagery.application.ImageService.UploadCommand;
import br.forum.aquaml.imagery.domain.ImageCorrections;
import br.forum.aquaml.monitoring.application.StationService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;

/** Rotas das imagens da água ({@code /api/images}). */
@RestController
@RequestMapping("/api/images")
@Tag(name = "7. Imagens", description = "Foto/satélite lidas pelo modelo com visão e conferidas")
public class ImageController {

    /** Corpo de {@code POST /api/images/{id}/confirm}: todos os campos são opcionais. */
    public record ConfirmImageRequest(String waterColor, String turbidity, Boolean algaeBloom, Boolean foam,
                                      Boolean oil, Boolean floatingDebris, Integer attentionLevel, String notes) {

        ImageCorrections toCorrections() {
            return new ImageCorrections(waterColor, turbidity, algaeBloom, foam, oil, floatingDebris, attentionLevel,
                    notes);
        }
    }

    private final ImageService images;
    private final StationService stations;

    public ImageController(ImageService images, StationService stations) {
        this.images = images;
        this.stations = stations;
    }

    @GetMapping
    public List<WaterImageResponse> list() {
        var names = stations.names();
        return images.list().stream().map(i -> WaterImageResponse.from(i, names)).toList();
    }

    /** Envio da imagem (multipart). Demora 10 a 40 s por causa do modelo com visão. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WaterImageResponse upload(@RequestParam(value = "file", required = false) MultipartFile file,
                                     @RequestParam(value = "kind", required = false) String kind,
                                     @RequestParam(value = "observedOn", required = false)
                                     @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate observedOn,
                                     @RequestParam(value = "stationId", required = false) String stationId,
                                     @RequestParam(value = "newStationName", required = false) String newStationName,
                                     @RequestParam(value = "newStationType", required = false) String newStationType,
                                     @RequestParam(value = "lat", required = false) Double lat,
                                     @RequestParam(value = "lon", required = false) Double lon,
                                     @AuthenticationPrincipal CurrentUser user) throws IOException {
        byte[] bytes = file == null ? null : file.getBytes();
        var image = images.upload(new UploadCommand(bytes, kind, observedOn, stationId, newStationName,
                newStationType, lat, lon), user);
        return WaterImageResponse.from(image, stations.names());
    }

    /** Bytes da imagem. Aceita também {@code ?token=} (a tag img não envia cabeçalho). */
    @GetMapping("/{id}/file")
    public ResponseEntity<byte[]> file(@PathVariable Long id) {
        var file = images.file(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.mimeType()))
                .cacheControl(CacheControl.noCache().cachePrivate())
                .body(file.data());
    }

    @PostMapping("/{id}/confirm")
    public WaterImageResponse confirm(@PathVariable Long id, @RequestBody(required = false) ConfirmImageRequest body) {
        ImageCorrections corrections = body == null ? ImageCorrections.none() : body.toCorrections();
        return WaterImageResponse.from(images.confirm(id, corrections), stations.names());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @AuthenticationPrincipal CurrentUser user) {
        images.delete(id, user);
    }
}
