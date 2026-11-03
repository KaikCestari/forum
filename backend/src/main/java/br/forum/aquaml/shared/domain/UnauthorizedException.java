package br.forum.aquaml.shared.domain;

/** Login inválido ou ausente (vira HTTP 401). */
public class UnauthorizedException extends RuntimeException {
    public UnauthorizedException(String message) {
        super(message);
    }
}
