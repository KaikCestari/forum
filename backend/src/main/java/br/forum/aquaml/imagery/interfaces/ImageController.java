package br.forum.aquaml.imagery.interfaces;

import br.forum.aquaml.shared.docs.ApiExamples;
import br.forum.aquaml.shared.interfaces.ApiError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
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

@RestController
@RequestMapping("/api/images")
@Tag(name = "7. Imagens", description = "Foto/satélite lidas pelo modelo com visão e conferidas")
public class ImageController {

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
    @Operation(summary = "Listar imagens", description = "A mais recente primeiro.",
            responses = @ApiResponse(responseCode = "200", description = "Imagens",
                    content = @Content(array = @ArraySchema(schema = @Schema(implementation = WaterImageResponse.class)),
                            examples = @ExampleObject(value = ApiExamples.IMAGE_LIST))))
    public List<WaterImageResponse> list() {
        var names = stations.names();
        return images.list().stream().map(i -> WaterImageResponse.from(i, names)).toList();
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Enviar foto ou imagem de satélite",
            description = "Formulário multipart. Demora **10 a 40 s** (o modelo com visão lê a imagem). Informe "
                    + "`stationId` **ou** `newStationName` + `newStationType`. Se a IA falhar, a imagem é guardada "
                    + "com `status: ERRO_ANALISE` para o biólogo preencher à mão. Fotos de exemplo em "
                    + "`frontend/public/exemplos/`.",
            responses = {
                    @ApiResponse(responseCode = "201", description = "Imagem guardada",
                            content = @Content(schema = @Schema(implementation = WaterImageResponse.class), examples = {
                                    @ExampleObject(name = "Lida pela IA", value = ApiExamples.IMAGE_PENDING),
                                    @ExampleObject(name = "IA fora do ar", value = ApiExamples.IMAGE_ERROR)})),
                    @ApiResponse(responseCode = "400", description = "Sem arquivo, formato não aceito, maior que 12 MB ou estação inválida",
                            content = @Content(schema = @Schema(implementation = ApiError.class),
                                    examples = @ExampleObject(value = ApiExamples.ERR_400_IMAGE)))})
    public WaterImageResponse upload(
            @Parameter(description = "Imagem JPG ou PNG até 12 MB")
            @RequestParam(value = "file", required = false) MultipartFile file,
            @Parameter(description = "foto ou satelite", example = "foto",
                    schema = @Schema(allowableValues = {"foto", "satelite"}))
            @RequestParam(value = "kind", required = false) String kind,
            @Parameter(description = "Data em que a imagem foi feita", example = "2026-09-28")
            @RequestParam(value = "observedOn", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate observedOn,
            @Parameter(description = "Estação já cadastrada", example = "RIO-02")
            @RequestParam(value = "stationId", required = false) String stationId,
            @Parameter(description = "Nome de uma estação nova (no lugar de stationId)")
            @RequestParam(value = "newStationName", required = false) String newStationName,
            @Parameter(description = "Tipo da estação nova: rio, lago, reservatorio ou estuario")
            @RequestParam(value = "newStationType", required = false) String newStationType,
            @Parameter(description = "Latitude da estação nova") @RequestParam(value = "lat", required = false) Double lat,
            @Parameter(description = "Longitude da estação nova") @RequestParam(value = "lon", required = false) Double lon,
            @AuthenticationPrincipal CurrentUser user) throws IOException {
        byte[] bytes = file == null ? null : file.getBytes();
        var image = images.upload(new UploadCommand(bytes, kind, observedOn, stationId, newStationName,
                newStationType, lat, lon), user);
        return WaterImageResponse.from(image, stations.names());
    }

    @GetMapping("/{id}/file")
    @Operation(summary = "Arquivo da imagem",
            description = "Devolve os bytes (JPEG). Aceita também `?token=<jwt>`, porque a tag img não envia cabeçalho.",
            responses = {
                    @ApiResponse(responseCode = "200", description = "Imagem",
                            content = @Content(mediaType = "image/jpeg", schema = @Schema(type = "string", format = "binary"))),
                    @ApiResponse(responseCode = "404", description = "Imagem não existe",
                            content = @Content(schema = @Schema(implementation = ApiError.class),
                                    examples = @ExampleObject(value = ApiExamples.ERR_404_IMAGE)))})
    public ResponseEntity<byte[]> file(@Parameter(example = "1") @PathVariable Long id) {
        var file = images.file(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.mimeType()))
                .cacheControl(CacheControl.noCache().cachePrivate())
                .body(file.data());
    }

    @PostMapping("/{id}/confirm")
    @Operation(summary = "Conferir a leitura da IA",
            description = "O biólogo corrige o que quiser; campos ausentes ficam como a IA leu. "
                    + "`turbidity`: baixa, media ou alta. `attentionLevel`: 0 a 3.",
            requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(content = @Content(
                    mediaType = "application/json", schema = @Schema(implementation = ConfirmImageRequest.class),
                    examples = {
                            @ExampleObject(name = "Com correções", value = ApiExamples.IMAGE_CONFIRM),
                            @ExampleObject(name = "Aceitar como está", value = ApiExamples.IMAGE_CONFIRM_AS_IS)})),
            responses = {
                    @ApiResponse(responseCode = "200", description = "Imagem confirmada",
                            content = @Content(schema = @Schema(implementation = WaterImageResponse.class),
                                    examples = @ExampleObject(value = ApiExamples.IMAGE_CONFIRMED))),
                    @ApiResponse(responseCode = "404", description = "Imagem não existe",
                            content = @Content(schema = @Schema(implementation = ApiError.class),
                                    examples = @ExampleObject(value = ApiExamples.ERR_404_IMAGE)))})
    public WaterImageResponse confirm(@Parameter(example = "1") @PathVariable Long id,
                                      @RequestBody(required = false) ConfirmImageRequest body) {
        ImageCorrections corrections = body == null ? ImageCorrections.none() : body.toCorrections();
        return WaterImageResponse.from(images.confirm(id, corrections), stations.names());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Apagar imagem", description = "Só quem enviou ou um ADMIN.",
            responses = {
                    @ApiResponse(responseCode = "204", description = "Imagem apagada"),
                    @ApiResponse(responseCode = "403", description = "Imagem de outra pessoa",
                            content = @Content(schema = @Schema(implementation = ApiError.class),
                                    examples = @ExampleObject(value = ApiExamples.ERR_403))),
                    @ApiResponse(responseCode = "404", description = "Imagem não existe",
                            content = @Content(schema = @Schema(implementation = ApiError.class),
                                    examples = @ExampleObject(value = ApiExamples.ERR_404_IMAGE)))})
    public void delete(@Parameter(example = "1") @PathVariable Long id, @AuthenticationPrincipal CurrentUser user) {
        images.delete(id, user);
    }
}
