package br.forum.aquaml.identity.application;

import br.forum.aquaml.identity.domain.Role;
import br.forum.aquaml.identity.domain.User;

public record CurrentUser(Long id, String name, String email, Role role) {

    public static CurrentUser of(User user) {
        return new CurrentUser(user.getId(), user.getName(), user.getEmail(), user.getRole());
    }

    public boolean isAdmin() {
        return role == Role.ADMIN;
    }
}
