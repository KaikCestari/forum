package br.forum.aquaml.imagery;

import br.forum.aquaml.imagery.domain.ColorIndicators;
import br.forum.aquaml.imagery.domain.ImageCorrections;
import br.forum.aquaml.imagery.domain.ImageStatus;
import br.forum.aquaml.imagery.domain.VisionReading;
import br.forum.aquaml.imagery.domain.WaterImage;
import br.forum.aquaml.shared.domain.BusinessRuleException;
import br.forum.aquaml.shared.domain.ForbiddenException;
import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WaterImageTest {

    private static final ColorIndicators COLORS = new ColorIndicators(90, 120, 80, 42, 0.14, 0.27, 0.6, 0.05);

    private static WaterImage newImage() {
        return new WaterImage("rio-a", "foto", LocalDate.of(2026, 10, 1), 7L, "Ana", "x.jpg", "image/jpeg", COLORS);
    }

    @Test
    void confirmKeepsAiReadingAndAppliesBiologistCorrections() {
        WaterImage image = newImage();
        image.recordVisionReading(new VisionReading("verde-escura", "media", true, false, false, false,
                "margem com mata", 2, "Água esverdeada."));
        assertEquals(ImageStatus.PENDENTE, image.getStatus());

        image.confirm(new ImageCorrections(null, "alta", null, true, null, null, 3, "Conferido em campo"));

        assertEquals(ImageStatus.CONFIRMADA, image.getStatus());
        VisionReading v = image.getVision();
        assertEquals("verde-escura", v.waterColor(), "o que o biólogo não mudou fica como a IA leu");
        assertEquals("alta", v.turbidity());
        assertTrue(v.algaeBloom());
        assertTrue(v.foam());
        assertEquals(3, v.attentionLevel());
        assertEquals("Conferido em campo", image.getReviewNotes());
        assertTrue(image.isConfirmed());
    }

    @Test
    void imageWithAnalysisErrorCanBeFilledByHandOnConfirm() {
        WaterImage image = newImage();
        image.markAnalysisFailed("O modelo com visão não respondeu.");
        assertEquals(ImageStatus.ERRO_ANALISE, image.getStatus());
        assertNull(image.getVision());

        image.confirm(new ImageCorrections("marrom", "baixa", false, false, false, true, 1, null));

        assertEquals(ImageStatus.CONFIRMADA, image.getStatus());
        assertEquals("marrom", image.getVision().waterColor());
        assertTrue(image.getVision().floatingDebris());
        assertNull(image.getAnalysisError());
    }

    @Test
    void confirmRejectsInvalidValues() {
        WaterImage image = newImage();
        image.recordVisionReading(VisionReading.empty());
        assertThrows(BusinessRuleException.class,
                () -> image.confirm(new ImageCorrections(null, null, null, null, null, null, 5, null)));
        assertThrows(BusinessRuleException.class,
                () -> image.confirm(new ImageCorrections(null, "turva", null, null, null, null, null, null)));
        assertEquals(ImageStatus.PENDENTE, image.getStatus(), "uma confirmação inválida não muda a imagem");
    }

    @Test
    void onlyOwnerOrAdminCanDelete() {
        WaterImage image = newImage();
        assertDoesNotThrow(() -> image.checkCanBeDeletedBy(7L, false));
        assertDoesNotThrow(() -> image.checkCanBeDeletedBy(99L, true));
        assertThrows(ForbiddenException.class, () -> image.checkCanBeDeletedBy(99L, false));
    }

    @Test
    void rejectsUnknownKind() {
        assertThrows(BusinessRuleException.class, () -> new WaterImage("rio-a", "video", LocalDate.now(), 1L, "Ana",
                "x.jpg", "image/jpeg", COLORS));
    }

    @Test
    void colorIndicatorsOfAGreenImage() {
        BufferedImage img = new BufferedImage(10, 10, BufferedImage.TYPE_INT_RGB);
        var g = img.createGraphics();
        g.setColor(new Color(40, 160, 60));
        g.fillRect(0, 0, 10, 10);
        g.dispose();
        ColorIndicators c = ColorIndicators.measure(img);
        assertEquals(1.0, c.greenishFraction());
        assertEquals(0.6, c.greenRedIndex());
        assertFalse(c.darkFraction() > 0);
    }
}
