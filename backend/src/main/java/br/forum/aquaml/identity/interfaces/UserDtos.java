package br.forum.aquaml.identity.interfaces;

import br.forum.aquaml.identity.domain.Role;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** DTOs (formatos JSON) da gestão de usuários. */
public final class UserDtos {

    private UserDtos() {
    }

    public record CreateUserRequest(@NotBlank(message = "informe o nome") String name,
                                    @NotBlank(message = "informe o e-mail") String email,
                                    @NotBlank(message = "informe a senha") String password,
                                    @NotNull(message = "informe o papel (ADMIN ou FUNCIONARIO)") Role role) {
    }

    /** Todos os campos são opcionais: só o que vier preenchido é alterado. */
    public record UpdateUserRequest(Role role, Boolean active, String name) {
    }
}
