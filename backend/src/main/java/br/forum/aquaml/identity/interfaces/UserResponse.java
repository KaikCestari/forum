package br.forum.aquaml.identity.interfaces;

import br.forum.aquaml.identity.domain.Role;
import br.forum.aquaml.identity.domain.User;

/** JSON {@code user} do contrato: {@code {id, name, email, role, active}}. Nunca expõe a senha. */
public record UserResponse(Long id, String name, String email, Role role, boolean active) {

    public static UserResponse from(User u) {
        return new UserResponse(u.getId(), u.getName(), u.getEmail(), u.getRole(), u.isActive());
    }
}
