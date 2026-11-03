package br.forum.aquaml.identity.application;

import br.forum.aquaml.identity.domain.Role;
import br.forum.aquaml.identity.domain.User;

/**
 * Quem está fazendo a requisição. Os controllers recebem este objeto com {@code @AuthenticationPrincipal}
 * e o repassam aos casos de uso que precisam saber o autor (imagens, anotações, assistente).
 */
public record CurrentUser(Long id, String name, String email, Role role) {

    public static CurrentUser of(User user) {
        return new CurrentUser(user.getId(), user.getName(), user.getEmail(), user.getRole());
    }

    public boolean isAdmin() {
        return role == Role.ADMIN;
    }

    /** Regra "dono ou ADMIN", usada para apagar imagens e anotações. */
    public boolean canManage(Long ownerId) {
        return isAdmin() || id.equals(ownerId);
    }
}
