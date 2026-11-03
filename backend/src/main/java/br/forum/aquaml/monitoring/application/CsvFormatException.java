package br.forum.aquaml.monitoring.application;

import br.forum.aquaml.shared.domain.BusinessRuleException;

/** A planilha não está num formato que o sistema entende; a mensagem explica o que corrigir. */
public class CsvFormatException extends BusinessRuleException {
    public CsvFormatException(String message) {
        super(message);
    }
}
