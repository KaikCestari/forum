package br.forum.aquaml.identity.infrastructure.security;

import br.forum.aquaml.identity.application.CurrentUser;
import br.forum.aquaml.identity.domain.User;
import br.forum.aquaml.identity.domain.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.regex.Pattern;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Pattern IMAGE_FILE = Pattern.compile("^/api/images/\\d+/file$");

    private final JwtService jwt;
    private final UserRepository users;

    public JwtAuthenticationFilter(JwtService jwt, UserRepository users) {
        this.jwt = jwt;
        this.users = users;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String token = tokenFrom(request);
        if (token != null) {
            jwt.userIdFrom(token)
                    .flatMap(users::findById)
                    .filter(User::isActive)
                    .ifPresent(this::authenticate);
        }
        chain.doFilter(request, response);
    }

    private void authenticate(User user) {
        CurrentUser principal = CurrentUser.of(user);
        var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()));
        SecurityContextHolder.getContext()
                .setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, authorities));
    }

    private static String tokenFrom(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7).strip();
        }
        String query = request.getParameter("token");
        if (query != null && !query.isBlank() && IMAGE_FILE.matcher(request.getRequestURI()).matches()) {
            return query.strip();
        }
        return null;
    }
}
