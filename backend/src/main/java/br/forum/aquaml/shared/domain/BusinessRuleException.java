package br.forum.aquaml.shared.domain;

/** Uma regra de negócio foi violada ou o pedido veio com dados inválidos (vira HTTP 400). */
public class BusinessRuleException extends RuntimeException {
    public BusinessRuleException(String message) {
        super(message);
    }
}
