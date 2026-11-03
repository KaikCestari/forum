package br.forum.aquaml.imagery.domain;

import jakarta.persistence.Embeddable;

import java.awt.image.BufferedImage;

@Embeddable
public record ColorIndicators(double meanRed, double meanGreen, double meanBlue, double brightnessPct,
                              double greenRedIndex, double blueRatio, double greenishFraction, double darkFraction) {

    public static ColorIndicators measure(BufferedImage img) {
        long n = 0;
        double sr = 0;
        double sg = 0;
        double sb = 0;
        long green = 0;
        long dark = 0;
        for (int y = 0; y < img.getHeight(); y++) {
            for (int x = 0; x < img.getWidth(); x++) {
                int rgb = img.getRGB(x, y);
                int r = (rgb >> 16) & 0xff;
                int g = (rgb >> 8) & 0xff;
                int b = rgb & 0xff;
                sr += r;
                sg += g;
                sb += b;
                n++;
                if (luminance(r, g, b) < 40) {
                    dark++;
                }
                if (g > 50 && g > r * 1.05 && g > b * 1.05) {
                    green++;
                }
            }
        }
        double mr = sr / n;
        double mg = sg / n;
        double mb = sb / n;
        return new ColorIndicators(
                round(mr, 1), round(mg, 1), round(mb, 1),
                round(luminance(mr, mg, mb) / 255 * 100, 1),
                round(mg + mr == 0 ? 0 : (mg - mr) / (mg + mr), 3),
                round(mr + mg + mb == 0 ? 0 : mb / (mr + mg + mb), 3),
                round((double) green / n, 3),
                round((double) dark / n, 3));
    }

    private static double luminance(double r, double g, double b) {
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    private static double round(double v, int digits) {
        double f = Math.pow(10, digits);
        return Math.round(v * f) / f;
    }
}
