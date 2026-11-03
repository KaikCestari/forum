package br.forum.aquaml.imagery.application;

import br.forum.aquaml.identity.application.CurrentUser;
import br.forum.aquaml.imagery.application.PhotoProcessor.Photo;
import br.forum.aquaml.imagery.domain.ColorIndicators;
import br.forum.aquaml.imagery.domain.ImageCorrections;
import br.forum.aquaml.imagery.domain.ImageStatus;
import br.forum.aquaml.imagery.domain.ImageStorage;
import br.forum.aquaml.imagery.domain.VisionAnalyzer;
import br.forum.aquaml.imagery.domain.VisionUnavailableException;
import br.forum.aquaml.imagery.domain.WaterImage;
import br.forum.aquaml.imagery.domain.WaterImageRepository;
import br.forum.aquaml.monitoring.application.StationService;
import br.forum.aquaml.monitoring.domain.Station;
import br.forum.aquaml.shared.domain.BusinessRuleException;
import br.forum.aquaml.shared.domain.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * Casos de uso das imagens: enviar (com leitura pela IA), listar, baixar o arquivo, confirmar e apagar.
 *
 * <p>O envio não abre transação durante a chamada ao modelo com visão (10 a 40 segundos). Se a IA falhar, a
 * imagem é guardada mesmo assim com status ERRO_ANALISE.
 */
@Service
public class ImageService {

    /** Dados do envio. Use {@code stationId} ou {@code newStationName} (+ tipo e coordenadas opcionais). */
    public record UploadCommand(byte[] file, String kind, LocalDate observedOn, String stationId,
                                String newStationName, String newStationType, Double lat, Double lon) {
    }

    /** Bytes e tipo do arquivo, para a rota que devolve a imagem. */
    public record ImageFile(byte[] data, String mimeType) {
    }

    private final WaterImageRepository images;
    private final ImageStorage storage;
    private final VisionAnalyzer vision;
    private final StationService stations;

    public ImageService(WaterImageRepository images, ImageStorage storage, VisionAnalyzer vision,
                        StationService stations) {
        this.images = images;
        this.storage = storage;
        this.vision = vision;
        this.stations = stations;
    }

    public List<WaterImage> list() {
        return images.findAllByOrderByUploadedAtDescIdDesc();
    }

    public List<WaterImage> confirmed() {
        return images.findByStatusOrderByObservedOnDescIdDesc(ImageStatus.CONFIRMADA);
    }

    public long countConfirmed() {
        return images.countByStatus(ImageStatus.CONFIRMADA);
    }

    /** Pendentes de conferência: lidas pela IA (PENDENTE) ou com erro de leitura (ERRO_ANALISE). */
    public long countPending() {
        return images.countByStatus(ImageStatus.PENDENTE) + images.countByStatus(ImageStatus.ERRO_ANALISE);
    }

    public long countAll() {
        return images.count();
    }

    public WaterImage upload(UploadCommand cmd, CurrentUser user) {
        // 1. Validar tudo antes de gravar qualquer coisa.
        if (cmd.kind() == null || !WaterImage.KINDS.contains(cmd.kind())) {
            throw new BusinessRuleException("Tipo de imagem inválido: use foto ou satelite.");
        }
        if (cmd.observedOn() == null) {
            throw new BusinessRuleException("Informe a data em que a imagem foi feita (observedOn).");
        }
        Photo photo = PhotoProcessor.decode(cmd.file());
        String stationId = resolveStation(cmd);

        // 2. Indicadores de cor (pixels) e leitura pelo modelo com visão.
        ColorIndicators colors = ColorIndicators.measure(PhotoProcessor.resize(photo.image(), PhotoProcessor.METRICS_MAX_SIDE));
        String fileName = storage.store(cmd.file(), photo.extension());
        WaterImage image = new WaterImage(stationId, cmd.kind(), cmd.observedOn(), user.id(), user.name(), fileName,
                photo.mimeType(), colors);
        try {
            byte[] jpeg = PhotoProcessor.toJpeg(PhotoProcessor.resize(photo.image(), PhotoProcessor.VISION_MAX_SIDE));
            image.recordVisionReading(vision.read(jpeg, cmd.kind()));
        } catch (VisionUnavailableException e) {
            image.markAnalysisFailed(e.getMessage());
        }

        // 3. Gravar; se o banco falhar, o arquivo não fica órfão.
        try {
            return images.save(image);
        } catch (RuntimeException e) {
            storage.delete(fileName);
            throw e;
        }
    }

    public ImageFile file(Long id) {
        WaterImage image = find(id);
        return new ImageFile(storage.load(image.getFileName()), image.getMimeType());
    }

    /** O biólogo conferiu: grava as correções e marca CONFIRMADA (regra na entidade). */
    @Transactional
    public WaterImage confirm(Long id, ImageCorrections corrections) {
        WaterImage image = find(id);
        image.confirm(corrections);
        return images.save(image);
    }

    /** Só quem enviou ou um ADMIN pode apagar (regra na entidade). */
    @Transactional
    public void delete(Long id, CurrentUser user) {
        WaterImage image = find(id);
        image.checkCanBeDeletedBy(user.id(), user.isAdmin());
        images.delete(image);
        storage.delete(image.getFileName());
    }

    private String resolveStation(UploadCommand cmd) {
        if (cmd.stationId() != null && !cmd.stationId().isBlank()) {
            try {
                return stations.get(cmd.stationId().strip()).getId();
            } catch (NotFoundException e) {
                throw new BusinessRuleException("Estação não encontrada: escolha uma da lista ou cadastre uma nova.");
            }
        }
        if (cmd.newStationName() != null && !cmd.newStationName().isBlank()) {
            Station created = stations.createFromName(cmd.newStationName(), cmd.newStationType(), cmd.lat(), cmd.lon());
            return created.getId();
        }
        throw new BusinessRuleException("Escolha a estação (stationId) ou informe o nome de uma nova (newStationName).");
    }

    private WaterImage find(Long id) {
        return images.findById(id).orElseThrow(() -> new NotFoundException("Imagem não encontrada."));
    }
}
