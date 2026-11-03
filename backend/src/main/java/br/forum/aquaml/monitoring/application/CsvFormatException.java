package br.forum.aquaml.monitoring.application;

import br.forum.aquaml.shared.domain.BusinessRuleException;

public class CsvFormatException extends BusinessRuleException {
    public CsvFormatException(String message) {
        super(message);
    }
}
