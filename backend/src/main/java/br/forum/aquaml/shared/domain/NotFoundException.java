package br.forum.aquaml.shared.domain;

/** Algo que foi pedido não existe (vira HTTP 404). */
public class NotFoundException extends RuntimeException {
    public NotFoundException(String message) {
        super(message);
    }
}
