package br.forum.aquaml.identity.application;

import br.forum.aquaml.identity.domain.Role;
import br.forum.aquaml.identity.domain.User;
import br.forum.aquaml.identity.domain.UserRepository;
import br.forum.aquaml.shared.domain.BusinessRuleException;
import br.forum.aquaml.shared.domain.NotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class UserService {

    private static final int MIN_PASSWORD = 6;

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository users, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    public List<User> list() {
        return users.findAllByOrderByNameAsc();
    }

    @Transactional
    public User create(String name, String email, String password, Role role) {
        String normalized = User.normalizeEmail(email);
        if (users.existsByEmail(normalized)) {
            throw new BusinessRuleException("Já existe uma conta com este e-mail.");
        }
        if (password == null || password.length() < MIN_PASSWORD) {
            throw new BusinessRuleException("A senha precisa ter pelo menos " + MIN_PASSWORD + " caracteres.");
        }
        return users.save(new User(name, normalized, passwordEncoder.encode(password), role));
    }

    @Transactional
    public User update(Long id, Role role, Boolean active, String name, CurrentUser changedBy) {
        User user = find(id);
        if (name != null) {
            user.rename(name);
        }
        user.changeRole(role, changedBy.id());
        if (active != null) {
            user.setActive(active, changedBy.id());
        }
        return users.save(user);
    }

    @Transactional
    public void delete(Long id, CurrentUser deletedBy) {
        if (id.equals(deletedBy.id())) {
            throw new BusinessRuleException("Você não pode apagar a sua própria conta.");
        }
        users.delete(find(id));
    }

    private User find(Long id) {
        return users.findById(id).orElseThrow(() -> new NotFoundException("Usuário não encontrado."));
    }
}
