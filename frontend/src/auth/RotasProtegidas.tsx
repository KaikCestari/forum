import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './AuthContext';
import { Carregando, Erro } from '../components/Estados';
import { Pagina } from '../components/Pagina';
import type { Papel } from '../api/tipos';
export function temPermissao(papel: Papel, permitido: Papel) {
  return papel === permitido;
}
export function RotaProtegida() {
  const auth = useAuth();
  const local = useLocation();
  if (auth.carregando) return <Carregando texto="Verificando sua sessão…" />;
  if (auth.erro)
    return (
      <main className="entrada-erro">
        <Erro erro={auth.erro} tentar={auth.tentar} />
        <button className="botao secundario" onClick={auth.sair}>
          Voltar ao login
        </button>
      </main>
    );
  if (!auth.usuario) return <Navigate to="/login" replace state={{ destino: local.pathname }} />;
  return <Outlet />;
}
export function GuardaPapel({ papel }: { papel: Papel }) {
  const { usuario } = useAuth();
  if (!usuario || !temPermissao(usuario.role, papel))
    return (
      <Pagina titulo="Sem permissão" descricao="Esta área é exclusiva de administradores.">
        <p>Peça ajuda ao administrador da sua equipe para realizar esta ação.</p>
      </Pagina>
    );
  return <Outlet />;
}
