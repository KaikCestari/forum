package br.forum.aquaml.identity.interfaces;

import br.forum.aquaml.identity.domain.Role;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public final class UserDtos {

    private UserDtos() {
    }

    public record CreateUserRequest(@NotBlank(message = "informe o nome") String name,
                                    @NotBlank(message = "informe o e-mail") String email,
                                    @NotBlank(message = "informe a senha") String password,
                                    @NotNull(message = "informe o papel (ADMIN ou FUNCIONARIO)") Role role) {
    }

    public record UpdateUserRequest(Role role, Boolean active, String name) {
    }
}
