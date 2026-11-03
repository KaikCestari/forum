// Autentica email e senha e devolve o usuário à página solicitada.
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { useAcao } from '../../api/useAcao';
import { Carregando, Erro } from '../../components/Estados';
import { Marca } from '../../components/Layout';
import { faixasIqa } from '../../components/graficos/iqa';
export function Login() {
  const auth = useAuth();
  const local = useLocation();
  const acao = useAcao();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  if (auth.carregando) return <Carregando />;
  const destino = (local.state as { destino?: string } | null)?.destino;
  if (auth.usuario)
    return (
      <Navigate
        to={
          destino?.startsWith('/') && !destino.startsWith('//') && destino !== '/login'
            ? destino
            : '/'
        }
        replace
      />
    );
  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    await acao.executar(() => auth.entrar(email.trim(), senha));
  }
  return (
    <main className="login">
      <section className="login-apresentacao">
        <Marca />
        <div className="login-regua" aria-hidden="true">
          {faixasIqa.map((f) => (
            <span key={f.classe} style={{ flexGrow: f.ate - f.de, background: f.cor }}>
              <em>{f.classe}</em>
              <b>{f.de}</b>
            </span>
          ))}
        </div>
        <div className="login-texto">
          <h1>Qualidade da água, estação por estação.</h1>
          <p>
            Leituras de sensores, fotos e imagens de satélite analisadas por algoritmos e aprendizado de
            máquina, no IQA da CETESB e nos limites da CONAMA 357.
          </p>
        </div>
      </section>
      <section className="login-formulario">
        <div>
          <h2>Entre no observatório</h2>
          <p className="texto-apoio">Use a conta fornecida pela sua equipe.</p>
          {auth.expirada && (
            <p className="aviso" role="status">
              Sua sessão expirou. Entre novamente para continuar.
            </p>
          )}
          <Erro erro={acao.erro ?? auth.erro} />
          <form onSubmit={enviar}>
            <label>
              Email
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
            </label>
            <button className="botao" disabled={acao.executando}>
              {acao.executando ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
          <p className="texto-apoio ajuda-login">
            Ainda não tem acesso? Solicite uma conta ao administrador da sua equipe.
          </p>
        </div>
      </section>
    </main>
  );
}
