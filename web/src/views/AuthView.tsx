import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { Icon } from "../components/Icon";
import { WaterIllustration } from "../components/WaterIllustration";
import { safeReturnPath } from "../lib/auth";

export default function AuthView() {
  const register = useLocation().pathname === "/cadastro";
  const [params] = useSearchParams();
  const auth = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [remember, setRemember] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmField = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const suffix = `?retorno=${encodeURIComponent(safeReturnPath(params.get("retorno")))}`;
  useEffect(() => {
    document.title = `${register ? "Criar conta" : "Entrar"} · AquaML`;
  }, [register]);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (sending) return;
    setError(null);
    if (register && password !== confirmation) {
      setError("As senhas não coincidem. Confira a confirmação da senha.");
      confirmField.current?.focus();
      return;
    }
    setSending(true);
    try {
      await auth.signIn(
        {
          email: email.trim(),
          password,
          ...(register ? { name: name.trim() } : { remember }),
        },
        register,
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível acessar sua conta. Tente novamente.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="auth-layout">
      <section className="auth-story" aria-label="Sobre o AquaML">
        <div className="brand auth-brand">
          <span className="brand-symbol">
            <Icon name="water" size={28} />
          </span>
          <span>
            Aqua<span className="brand-ml">ML</span>
            <small>Monitoramento ambiental</small>
          </span>
        </div>
        <div className="auth-story-copy">
          <span className="auth-story-tag">
            <span />
            Do campo à análise
          </span>
          <h2>Cuidar da água começa com um novo olhar.</h2>
          <p>
            Imagens, sensores e conhecimento de campo reunidos para compreender
            cada ecossistema.
          </p>
          <div className="auth-story-visual">
            <WaterIllustration />
          </div>
        </div>
        <p className="auth-story-foot">
          <Icon name="water" size={15} />
          Ciência a favor de rios, lagos e de quem cuida deles.
        </p>
      </section>
      <section className="auth-form-side" aria-labelledby="auth-title">
        <div className="auth-mobile-brand">
          <Icon name="water" size={24} />
          <strong>AquaML</strong>
        </div>
        <div className="auth-form-wrap">
          <span className="auth-form-icon">
            <Icon name={register ? "user" : "lock"} size={24} />
          </span>
          <h1 id="auth-title">
            {register ? "Crie sua conta" : "Bom ter você de volta"}
          </h1>
          <p className="auth-form-intro">
            {register
              ? "Faça parte do espaço de monitoramento da sua equipe."
              : "Entre para acompanhar seus dados e continuar o monitoramento."}
          </p>
          <form
            className="auth-form"
            onSubmit={submit}
            aria-label={register ? "Cadastro" : "Login"}
          >
            {register && (
              <label className="note-field" htmlFor="auth-name">
                <span>Nome completo</span>
                <input
                  autoFocus
                  id="auth-name"
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="Como podemos chamar você?"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={sending}
                />
              </label>
            )}
            <label className="note-field" htmlFor="auth-email">
              <span>E-mail</span>
              <input
                autoFocus={!register}
                id="auth-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                placeholder="voce@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={sending}
              />
            </label>
            <div className="note-field">
              <label className="auth-password-label" htmlFor="auth-password">
                Senha
              </label>
              <span className="auth-password-field">
                <input
                  id="auth-password"
                  name="password"
                  type={visible ? "text" : "password"}
                  autoComplete={register ? "new-password" : "current-password"}
                  required
                  minLength={register ? 12 : undefined}
                  maxLength={128}
                  placeholder={
                    register
                      ? "Crie uma senha com pelo menos 12 caracteres"
                      : "Sua senha"
                  }
                  aria-describedby={register ? "password-hint" : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={sending}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={visible}
                  onClick={() => setVisible(!visible)}
                >
                  <Icon name={visible ? "eyeOff" : "eye"} size={19} />
                </button>
              </span>
            </div>
            {register && (
              <>
                <p id="password-hint" className="auth-password-hint">
                  Use de 12 a 128 caracteres. Uma frase longa é uma boa escolha.
                </p>
                <label className="note-field" htmlFor="auth-confirm">
                  <span>Confirme a senha</span>
                  <input
                    ref={confirmField}
                    id="auth-confirm"
                    name="confirmation"
                    type={visible ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    maxLength={128}
                    placeholder="Digite a senha novamente"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    disabled={sending}
                  />
                </label>
              </>
            )}
            {!register && (
              <label className="auth-remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  disabled={sending}
                />
                <span>Manter conectado por 30 dias</span>
              </label>
            )}
            {error && (
              <p
                ref={errorRef}
                tabIndex={-1}
                className="auth-error"
                role="alert"
              >
                <Icon name="info" size={18} />
                <span>{error}</span>
              </p>
            )}
            <button
              className="auth-submit"
              type="submit"
              disabled={sending}
              aria-busy={sending}
            >
              {sending
                ? register
                  ? "Criando sua conta…"
                  : "Entrando…"
                : register
                  ? "Criar conta"
                  : "Entrar"}
              <Icon name={sending ? "clock" : "arrow"} size={18} />
            </button>
          </form>
          <p className="auth-switch">
            {register ? "Já tem uma conta?" : "Ainda não tem uma conta?"}{" "}
            <Link to={`${register ? "/login" : "/cadastro"}${suffix}`}>
              {register ? "Entrar" : "Criar conta"}
            </Link>
          </p>
          <div className="auth-security">
            <Icon name="lock" size={14} />
            <span>
              Seu acesso é pessoal. Os dados de monitoramento são compartilhados
              pela equipe.
            </span>
          </div>
        </div>
        <p className="auth-copyright">
          AquaML · Monitoramento de ecossistemas aquáticos
        </p>
      </section>
    </main>
  );
}
