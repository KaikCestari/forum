package br.forum.aquaml.monitoring.domain;

import br.forum.aquaml.shared.domain.BusinessRuleException;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.Locale;

public enum StationType {
    RIO("rio"),
    LAGO("lago"),
    RESERVATORIO("reservatorio"),
    ESTUARIO("estuario");

    private final String code;

    StationType(String code) {
        this.code = code;
    }

    public String code() {
        return code;
    }

    public static StationType fromCode(String code) {
        if (code == null || code.isBlank()) {
            return RIO;
        }
        String c = code.strip().toLowerCase(Locale.ROOT);
        return Arrays.stream(values()).filter(t -> t.code.equals(c)).findFirst()
                .orElseThrow(() -> new BusinessRuleException("Tipo de estação inválido: use rio, lago, reservatorio ou estuario."));
    }

    public static StationType fromText(String raw) {
        String t = raw == null ? "" : Normalizer.normalize(raw.strip().toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        if (t.startsWith("lag") || t.startsWith("lake")) {
            return LAGO;
        }
        if (t.startsWith("reserv") || t.startsWith("represa") || t.startsWith("acude")) {
            return RESERVATORIO;
        }
        if (t.startsWith("estu") || t.startsWith("salob")) {
            return ESTUARIO;
        }
        return RIO;
    }
}
