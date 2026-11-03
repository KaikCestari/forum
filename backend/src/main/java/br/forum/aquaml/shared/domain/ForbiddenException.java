package br.forum.aquaml.shared.domain;

/** O usuário está logado, mas o papel dele não permite a ação (vira HTTP 403). */
public class ForbiddenException extends RuntimeException {
    public ForbiddenException(String message) {
        super(message);
    }
}
