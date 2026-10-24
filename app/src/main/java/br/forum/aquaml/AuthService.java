package br.forum.aquaml;

import io.javalin.Javalin;
import io.javalin.http.Context;
import io.javalin.http.Cookie;
import io.javalin.http.SameSite;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/** Autenticação do espaço compartilhado. Apenas o hash da sessão é persistido. */
public final class AuthService {
    static final String COOKIE = "aquaml_session";
    private static final int ITERATIONS = 600_000;
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Set<String> PUBLIC = Set.of("/api/auth/login", "/api/auth/register", "/api/auth/session");
    private final Database db;
    private final List<String> origins;
    private final Map<String, Attempt> attempts = new ConcurrentHashMap<>();
    private final String dummyHash = hashPassword("unused-password-for-timing");
    private record Attempt(long until, int count) {}

    public AuthService(Database db, List<String> origins) {
        this.db = db;
        this.origins = origins;
    }

    public void register(Javalin app) {
        app.before("/api/*", ctx -> {
            ctx.header("Cache-Control", "no-store");
            ctx.header("X-Content-Type-Options", "nosniff");
            if (ctx.method().name().equals("OPTIONS")) return;
            if (PUBLIC.contains(ctx.path())) return;
            var session = currentSession(ctx);
            if (session.isEmpty()) {
                fail(ctx, 401, "Sua sessão terminou. Entre novamente para continuar.");
                return;
            }
            if (!Set.of("GET", "HEAD").contains(ctx.method().name()) &&
                    (!allowedOrigin(ctx) || !same(session.get().csrfToken(), ctx.header("X-CSRF-Token")))) {
                fail(ctx, 403, "Não foi possível validar esta solicitação. Atualize a página e tente novamente.");
            }
        });
        app.get("/api/auth/session", ctx -> {
            var session = currentSession(ctx);
            if (session.isPresent()) ctx.json(session.get());
            else {
                if (ctx.cookie(COOKIE) != null) setCookie(ctx, "", 0);
                ctx.json(java.util.Collections.singletonMap("user", null));
            }
        });
        app.post("/api/auth/register", ctx -> authenticate(ctx, true));
        app.post("/api/auth/login", ctx -> authenticate(ctx, false));
        app.post("/api/auth/logout", ctx -> {
            revokeCurrent(ctx);
            setCookie(ctx, "", 0);
            ctx.status(204);
        });
    }

    private Optional<Database.AuthSession> currentSession(Context ctx) {
        String token = ctx.cookie(COOKIE);
        return token != null && token.matches("[A-Za-z0-9_-]{43}")
                ? db.authSession(tokenHash(token)) : Optional.empty();
    }

    private void authenticate(Context ctx, boolean registering) {
        if (!allowedOrigin(ctx) || !ctx.isJson()) {
            fail(ctx, 403, "Solicitação de acesso inválida.");
            return;
        }
        if (ctx.contentLength() > 16_384) {
            fail(ctx, 413, "Os dados enviados ultrapassam o tamanho permitido.");
            return;
        }
        // Endereço direto do cliente: cabeçalhos encaminhados não controlam o limite.
        if (!allowAttempt((registering ? "register:" : "login:") + ctx.req().getRemoteAddr(), registering ? 10 : 20)) {
            ctx.header("Retry-After", "900");
            fail(ctx, 429, "Muitas tentativas. Aguarde 15 minutos e tente novamente.");
            return;
        }
        Map<?, ?> body;
        try { body = ctx.bodyAsClass(Map.class); }
        catch (Exception e) { fail(ctx, 400, "Envie nome, e-mail e senha em um formato válido."); return; }
        if (body == null) { fail(ctx, 400, "Informe seus dados de acesso."); return; }
        String email = text(body, "email").strip().toLowerCase(Locale.ROOT);
        String password = text(body, "password");
        String name = text(body, "name").strip();
        if (email.length() > 254 || !email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")) {
            fail(ctx, 400, "Informe um e-mail válido."); return;
        }
        if (password.length() > 128 || password.isBlank() || (registering && password.length() < 12)) {
            fail(ctx, 400, registering ? "Use uma senha de 12 a 128 caracteres." : "Informe uma senha válida."); return;
        }
        Database.UserIdentity user;
        if (registering) {
            if (name.length() < 2 || name.length() > 100) { fail(ctx, 400, "Informe seu nome, com 2 a 100 caracteres."); return; }
            var created = db.createAccount(name, email, hashPassword(password));
            if (created.isEmpty()) { fail(ctx, 409, "Este e-mail já está cadastrado. Entre com a sua conta."); return; }
            user = created.get();
        } else {
            var account = db.accountByEmail(email);
            boolean valid = verifyPassword(password, account.map(Database.Account::passwordHash).orElse(dummyHash));
            if (account.isEmpty() || !valid) { fail(ctx, 401, "E-mail ou senha incorretos."); return; }
            user = account.get().user();
        }
        boolean remember = Boolean.TRUE.equals(body.get("remember"));
        int seconds = (int) (remember ? Duration.ofDays(30) : Duration.ofHours(12)).toSeconds();
        String token = randomToken();
        String csrf = randomToken();
        db.createAuthSession(tokenHash(token), user.id(), csrf, Instant.now().plusSeconds(seconds));
        revokeCurrent(ctx);
        setCookie(ctx, token, remember ? seconds : -1);
        ctx.status(registering ? 201 : 200).json(new Database.AuthSession(user, csrf));
    }

    private void revokeCurrent(Context ctx) {
        String token = ctx.cookie(COOKIE);
        if (token != null && token.length() < 200) db.revokeAuthSession(tokenHash(token));
    }

    private boolean allowedOrigin(Context ctx) {
        String origin = ctx.header("Origin");
        if (origin == null) return !"cross-site".equals(ctx.header("Sec-Fetch-Site"));
        return origins.contains(origin) || origin.equals(ctx.scheme() + "://" + ctx.host());
    }

    private synchronized boolean allowAttempt(String key, int limit) {
        long now = System.currentTimeMillis();
        attempts.entrySet().removeIf(e -> e.getValue().until() <= now);
        Attempt previous = attempts.get(key);
        if (previous != null && previous.count() >= limit) return false;
        if (previous == null && attempts.size() >= 10_000) return false;
        attempts.put(key, previous == null ? new Attempt(now + Duration.ofMinutes(15).toMillis(), 1)
                : new Attempt(previous.until(), previous.count() + 1));
        return true;
    }

    private static void setCookie(Context ctx, String token, int maxAge) {
        Cookie cookie = new Cookie(COOKIE, token);
        cookie.setPath("/");
        cookie.setHttpOnly(true);
        cookie.setSecure(ctx.req().isSecure() || "true".equalsIgnoreCase(System.getenv("AQUAML_SECURE_COOKIES")));
        cookie.setSameSite(SameSite.LAX);
        cookie.setMaxAge(maxAge);
        ctx.cookie(cookie);
    }

    private static String text(Map<?, ?> body, String key) {
        return body.get(key) instanceof String value ? value : "";
    }

    private static void fail(Context ctx, int status, String message) {
        ctx.status(status).json(Map.of("error", message));
        ctx.skipRemainingHandlers();
    }

    private static String randomToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    static String tokenHash(String token) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))); }
        catch (GeneralSecurityException e) { throw new IllegalStateException(e); }
    }

    static String hashPassword(String password) {
        byte[] salt = new byte[16];
        RANDOM.nextBytes(salt);
        return "pbkdf2-sha256$" + ITERATIONS + "$" + Base64.getEncoder().encodeToString(salt) + "$"
                + Base64.getEncoder().encodeToString(derive(password, salt, ITERATIONS));
    }

    static boolean verifyPassword(String password, String hash) {
        try {
            String[] parts = hash.split("\\$");
            if (parts.length != 4 || !parts[0].equals("pbkdf2-sha256")) return false;
            int iterations = Integer.parseInt(parts[1]);
            if (iterations < ITERATIONS || iterations > 2_000_000) return false;
            return MessageDigest.isEqual(Base64.getDecoder().decode(parts[3]),
                    derive(password, Base64.getDecoder().decode(parts[2]), iterations));
        } catch (IllegalArgumentException e) { return false; }
    }

    private static byte[] derive(String password, byte[] salt, int iterations) {
        PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, iterations, 256);
        try { return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded(); }
        catch (GeneralSecurityException e) { throw new IllegalStateException(e); }
        finally { spec.clearPassword(); }
    }

    private static boolean same(String expected, String actual) {
        return actual != null && MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), actual.getBytes(StandardCharsets.UTF_8));
    }
}
