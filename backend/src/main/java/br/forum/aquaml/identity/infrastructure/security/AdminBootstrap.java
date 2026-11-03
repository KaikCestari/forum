package br.forum.aquaml.identity.infrastructure.security;

import br.forum.aquaml.identity.domain.Role;
import br.forum.aquaml.identity.domain.User;
import br.forum.aquaml.identity.domain.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class AdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final String email;
    private final String password;

    public AdminBootstrap(UserRepository users, PasswordEncoder passwordEncoder,
                          @Value("${aquaml.admin.email}") String email,
                          @Value("${aquaml.admin.password}") String password) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.email = email;
        this.password = password;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (users.count() > 0) {
            return;
        }
        users.save(new User("Administrador", email, passwordEncoder.encode(password), Role.ADMIN));
        log.info("Administrador inicial criado: {} (troque a senha padrão em produção).", email);
    }
}
