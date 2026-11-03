package br.forum.aquaml.shared.config;

import br.forum.aquaml.identity.infrastructure.security.JwtAuthenticationFilter;
import br.forum.aquaml.shared.interfaces.ApiError;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.io.IOException;
import java.util.List;

/**
 * Segurança da API: login sem sessão (stateless) com JWT e a tabela de permissões do contrato.
 *
 * <p>A tabela abaixo é a mesma de {@code docs/CONTRATO-API.md}: rotas de ADMIN, rotas para qualquer usuário
 * logado e o login aberto. A regra "dono ou ADMIN" para apagar imagens e anotações fica nos casos de uso.
 */
@Configuration
public class SecurityConfig {

    private static final String ADMIN = "ADMIN";

    /** Endereços do frontend que podem chamar a API (variável AQUAML_CORS_ORIGINS, separados por vírgula). */
    private final List<String> allowedOrigins;

    public SecurityConfig(@Value("${aquaml.cors-origins:http://localhost:5173,http://127.0.0.1:5173}") List<String> allowedOrigins) {
        this.allowedOrigins = allowedOrigins;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, JwtAuthenticationFilter jwtFilter,
                                                   ObjectMapper mapper) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsSource()))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                        .requestMatchers("/error").permitAll()
                        // Só ADMIN
                        .requestMatchers("/api/users", "/api/users/**").hasRole(ADMIN)
                        .requestMatchers(HttpMethod.POST, "/api/data/import").hasRole(ADMIN)
                        .requestMatchers(HttpMethod.DELETE, "/api/data").hasRole(ADMIN)
                        .requestMatchers(HttpMethod.POST, "/api/analysis/run").hasRole(ADMIN)
                        .requestMatchers(HttpMethod.POST, "/api/stations").hasRole(ADMIN)
                        // Qualquer usuário logado
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().permitAll())
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((req, res, ex) -> writeError(res, mapper, 401,
                                "Faça login para continuar (token ausente, inválido ou vencido)."))
                        .accessDeniedHandler((req, res, ex) -> writeError(res, mapper, 403,
                                "Seu papel não tem permissão para esta ação.")))
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    /** O filtro JWT roda só dentro da cadeia do Spring Security, não como filtro solto do servidor. */
    @Bean
    public FilterRegistrationBean<JwtAuthenticationFilter> jwtFilterRegistration(JwtAuthenticationFilter filter) {
        FilterRegistrationBean<JwtAuthenticationFilter> registration = new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /** Por padrão o frontend em desenvolvimento roda em http://localhost:5173. */
    private CorsConfigurationSource corsSource() {
        CorsConfiguration cors = new CorsConfiguration();
        cors.setAllowedOrigins(allowedOrigins);
        cors.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cors.setAllowedHeaders(List.of("*"));
        cors.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cors);
        return source;
    }

    private static void writeError(HttpServletResponse res, ObjectMapper mapper, int status, String message)
            throws IOException {
        res.setStatus(status);
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.setCharacterEncoding("UTF-8");
        mapper.writeValue(res.getOutputStream(), new ApiError(status, message));
    }
}
