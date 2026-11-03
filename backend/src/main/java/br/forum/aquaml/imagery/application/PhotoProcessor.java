package br.forum.aquaml.imagery.application;

import br.forum.aquaml.shared.domain.BusinessRuleException;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReadParam;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.MemoryCacheImageOutputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Iterator;
import java.util.Locale;

/**
 * Lê e prepara a imagem enviada: confere se é JPG/PNG de até 12 MB, reduz o tamanho para calcular os indicadores
 * de cor e gera um JPEG menor para mandar ao modelo com visão. Java puro (javax.imageio), sem serviços externos.
 */
public final class PhotoProcessor {

    public static final long MAX_BYTES = 12L * 1024 * 1024;
    private static final long MAX_PIXELS = 80_000_000L;
    private static final int DECODE_TARGET_PIXELS = 4_000_000;
    public static final int VISION_MAX_SIDE = 1024;
    public static final int METRICS_MAX_SIDE = 512;

    /** Imagem decodificada, com o formato original ({@code jpeg} ou {@code png}). */
    public record Photo(BufferedImage image, String format) {

        public String mimeType() {
            return "jpeg".equals(format) ? "image/jpeg" : "image/png";
        }

        public String extension() {
            return "jpeg".equals(format) ? "jpg" : "png";
        }
    }

    private PhotoProcessor() {
    }

    /** @throws BusinessRuleException se o arquivo não for uma imagem JPG ou PNG aceitável */
    public static Photo decode(byte[] data) {
        if (data == null || data.length == 0) {
            throw new BusinessRuleException("Envie o arquivo da imagem no campo file.");
        }
        if (data.length > MAX_BYTES) {
            throw new BusinessRuleException("A imagem deve ter até 12 MB.");
        }
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(data))) {
            Iterator<ImageReader> readers = in == null ? null : ImageIO.getImageReaders(in);
            if (readers == null || !readers.hasNext()) {
                throw new BusinessRuleException("Formato não reconhecido: envie uma imagem JPG ou PNG.");
            }
            ImageReader reader = readers.next();
            try {
                String format = reader.getFormatName().toLowerCase(Locale.ROOT);
                if (!format.equals("jpeg") && !format.equals("png")) {
                    throw new BusinessRuleException("Formato não aceito: envie uma imagem JPG ou PNG.");
                }
                reader.setInput(in, true, true);
                int w = reader.getWidth(0);
                int h = reader.getHeight(0);
                if ((long) w * h > MAX_PIXELS) {
                    throw new BusinessRuleException("A imagem tem pixels demais; reduza a resolução e envie de novo.");
                }
                ImageReadParam param = reader.getDefaultReadParam();
                int step = Math.max(1, (int) Math.ceil(Math.sqrt((double) w * h / DECODE_TARGET_PIXELS)));
                if (step > 1) {
                    param.setSourceSubsampling(step, step, 0, 0);
                }
                return new Photo(reader.read(0, param), format);
            } finally {
                reader.dispose();
            }
        } catch (IOException | RuntimeException e) {
            if (e instanceof BusinessRuleException b) {
                throw b;
            }
            throw new BusinessRuleException("Não foi possível ler a imagem; confira se o arquivo não está corrompido.");
        }
    }

    /** Reduz para caber em {@code maxSide} pixels no maior lado, sobre fundo branco (PNG com transparência). */
    public static BufferedImage resize(BufferedImage src, int maxSide) {
        double scale = Math.min(1.0, (double) maxSide / Math.max(src.getWidth(), src.getHeight()));
        int w = Math.max(1, (int) Math.round(src.getWidth() * scale));
        int h = Math.max(1, (int) Math.round(src.getHeight() * scale));
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setColor(Color.WHITE);
            g.fillRect(0, 0, w, h);
            g.drawImage(src, 0, 0, w, h, null);
        } finally {
            g.dispose();
        }
        return out;
    }

    public static byte[] toJpeg(BufferedImage img) {
        ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
        ImageWriteParam param = writer.getDefaultWriteParam();
        param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
        param.setCompressionQuality(0.85f);
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (MemoryCacheImageOutputStream out = new MemoryCacheImageOutputStream(bytes)) {
            writer.setOutput(out);
            writer.write(null, new IIOImage(img, null, null), param);
        } catch (IOException e) {
            throw new IllegalStateException("Falha ao gerar JPEG", e);
        } finally {
            writer.dispose();
        }
        return bytes.toByteArray();
    }
}
