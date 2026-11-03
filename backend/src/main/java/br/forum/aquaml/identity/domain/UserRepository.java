package br.forum.aquaml.identity.domain;

import java.util.List;
import java.util.Optional;

/**
 * Porta (interface) do repositório de usuários. O domínio só conhece esta interface;
 * quem a implementa é a infraestrutura (Spring Data JPA).
 */
public interface UserRepository {

    User save(User user);

    Optional<User> findById(Long id);

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    List<User> findAllByOrderByNameAsc();

    long count();

    void delete(User user);
}
