package br.forum.aquaml.imagery.domain;

import br.forum.aquaml.shared.domain.BusinessRuleException;
import br.forum.aquaml.shared.domain.ForbiddenException;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Set;

@Entity
@Table(name = "water_images")
public class WaterImage {

    public static final Set<String> KINDS = Set.of("foto", "satelite");

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 80)
    private String stationId;

    @Column(nullable = false, length = 20)
    private String kind;

    @Column(nullable = false)
    private LocalDate observedOn;

    @Column(nullable = false)
    private Instant uploadedAt;

    private Long uploadedById;

    @Column(length = 120)
    private String uploadedByName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ImageStatus status;

    @Column(nullable = false, length = 120)
    private String fileName;

    @Column(nullable = false, length = 40)
    private String mimeType;

    @Embedded
    private ColorIndicators colorIndicators;

    @Embedded
    private VisionReading vision;

    @Column(length = 500)
    private String analysisError;

    @Column(length = 1000)
    private String reviewNotes;

    private Instant confirmedAt;

    protected WaterImage() {
        // exigido pelo JPA
    }

    public WaterImage(String stationId, String kind, LocalDate observedOn, Long uploadedById, String uploadedByName,
                      String fileName, String mimeType, ColorIndicators colorIndicators) {
        if (kind == null || !KINDS.contains(kind)) {
            throw new BusinessRuleException("Tipo de imagem inválido: use foto ou satelite.");
        }
        if (observedOn == null) {
            throw new BusinessRuleException("Informe a data em que a imagem foi feita.");
        }
        if (observedOn.isAfter(LocalDate.now().plusDays(1))) {
            throw new BusinessRuleException("A data da imagem não pode estar no futuro.");
        }
        this.stationId = stationId;
        this.kind = kind;
        this.observedOn = observedOn;
        this.uploadedById = uploadedById;
        this.uploadedByName = uploadedByName;
        this.fileName = fileName;
        this.mimeType = mimeType;
        this.colorIndicators = colorIndicators;
        this.uploadedAt = Instant.now();
        this.status = ImageStatus.PENDENTE;
    }

    public void recordVisionReading(VisionReading reading) {
        this.vision = reading;
        this.analysisError = null;
        this.status = ImageStatus.PENDENTE;
    }

    public void markAnalysisFailed(String reason) {
        this.vision = null;
        this.analysisError = reason;
        this.status = ImageStatus.ERRO_ANALISE;
    }

    public void confirm(ImageCorrections corrections) {
        ImageCorrections c = corrections == null ? ImageCorrections.none() : corrections;
        VisionReading base = vision != null ? vision : VisionReading.empty();
        this.vision = base.correctedWith(c);
        if (c.notes() != null && !c.notes().isBlank()) {
            String notes = c.notes().strip();
            this.reviewNotes = notes.length() <= 1000 ? notes : notes.substring(0, 1000);
        }
        this.analysisError = null;
        this.status = ImageStatus.CONFIRMADA;
        this.confirmedAt = Instant.now();
    }

    public void checkCanBeDeletedBy(Long userId, boolean isAdmin) {
        if (!isAdmin && !userId.equals(uploadedById)) {
            throw new ForbiddenException("Só quem enviou a imagem ou um administrador pode apagá-la.");
        }
    }

    public boolean isConfirmed() {
        return status == ImageStatus.CONFIRMADA;
    }

    public Long getId() {
        return id;
    }

    public String getStationId() {
        return stationId;
    }

    public String getKind() {
        return kind;
    }

    public LocalDate getObservedOn() {
        return observedOn;
    }

    public Instant getUploadedAt() {
        return uploadedAt;
    }

    public String getUploadedByName() {
        return uploadedByName;
    }

    public ImageStatus getStatus() {
        return status;
    }

    public String getFileName() {
        return fileName;
    }

    public String getMimeType() {
        return mimeType;
    }

    public ColorIndicators getColorIndicators() {
        return colorIndicators;
    }

    public VisionReading getVision() {
        return vision;
    }

    public String getAnalysisError() {
        return analysisError;
    }

    public String getReviewNotes() {
        return reviewNotes;
    }
}
