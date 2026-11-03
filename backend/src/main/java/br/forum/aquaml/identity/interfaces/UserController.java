package br.forum.aquaml.identity.interfaces;

import io.swagger.v3.oas.annotations.tags.Tag;
import br.forum.aquaml.identity.application.CurrentUser;
import br.forum.aquaml.identity.application.UserService;
import br.forum.aquaml.identity.interfaces.UserDtos.CreateUserRequest;
import br.forum.aquaml.identity.interfaces.UserDtos.UpdateUserRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Gestão de usuários ({@code /api/users}), só para ADMIN. */
@RestController
@RequestMapping("/api/users")
@Tag(name = "2. Usuários (ADMIN)", description = "Criar, mudar papel, ativar e apagar contas")
public class UserController {

    private final UserService users;

    public UserController(UserService users) {
        this.users = users;
    }

    @GetMapping
    public List<UserResponse> list() {
        return users.list().stream().map(UserResponse::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse create(@Valid @RequestBody CreateUserRequest body) {
        return UserResponse.from(users.create(body.name(), body.email(), body.password(), body.role()));
    }

    @PatchMapping("/{id}")
    public UserResponse update(@PathVariable Long id, @RequestBody UpdateUserRequest body,
                               @AuthenticationPrincipal CurrentUser current) {
        return UserResponse.from(users.update(id, body.role(), body.active(), body.name(), current));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @AuthenticationPrincipal CurrentUser current) {
        users.delete(id, current);
    }
}
