// Organiza navegação por papel, identificação do usuário e conteúdo responsivo.
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { nomePapel } from './formatacao';
const paginas = [
  ['/', 'Painel', '◫'],
  ['/estacoes', 'Estações', '⌖'],
  ['/imagens', 'Imagens', '▧'],
  ['/analises', 'Análises', '≋'],
  ['/anotacoes', 'Anotações de campo', '≡'],
  ['/assistente', 'Assistente', '◌'],
];
export function Marca() {
  return (
    <span className="marca">
      <span className="marca-simbolo" aria-hidden="true">
        ≈
      </span>
      Aqua<span>ML</span>
    </span>
  );
}
export function Layout() {
  const { usuario, sair } = useAuth();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  const principal = useRef<HTMLElement>(null);
  useEffect(() => {
    setMenu(false);
    principal.current?.focus();
    document.title = `AquaML | ${paginas.find(([p]) => p === pathname)?.[1] ?? 'Monitoramento da água'}`;
  }, [pathname]);
  return (
    <div className="aplicacao">
      <a className="pular" href="#conteudo">
        Pular para o conteúdo
      </a>
      <div className="coluna-lateral">
        <aside className="lateral">
          <NavLink to="/" className="link-marca" aria-label="AquaML, página inicial">
            <Marca />
          </NavLink>
          <button
            className="botao menu-movel"
            aria-expanded={menu}
            aria-controls="navegacao"
            onClick={() => setMenu(!menu)}
          >
            Menu
          </button>
          <nav id="navegacao" className={menu ? 'aberto' : ''} aria-label="Navegação principal">
            {paginas.map(([rota, nome, icone]) => (
              <NavLink key={rota} to={rota} end={rota === '/'}>
                <span aria-hidden="true">{icone}</span>
                {nome}
              </NavLink>
            ))}
            {usuario?.role === 'ADMIN' && (
              <div className="menu-admin">
                <p>Administração</p>
                <NavLink to="/dados">
                  <span aria-hidden="true">▤</span>Dados
                </NavLink>
                <NavLink to="/usuarios">
                  <span aria-hidden="true">♙</span>Usuários
                </NavLink>
              </div>
            )}
          </nav>
          <p className="lateral-rodape">
            Ciência a serviço
            <br />
            dos ecossistemas aquáticos.
          </p>
        </aside>
      </div>
      <div className="area-principal">
        <header className="barra-topo">
          <span className="contexto-topo">Observatório da água</span>
          <div className="identidade">
            <span className="avatar" aria-hidden="true">
              {usuario?.name.charAt(0).toUpperCase()}
            </span>
            <div>
              <strong>{usuario?.name}</strong>
              <span>{usuario && nomePapel[usuario.role]}</span>
            </div>
            <button className="botao secundario pequeno" onClick={sair}>
              Sair
            </button>
          </div>
        </header>
        <main id="conteudo" ref={principal} tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="rodape">
          AquaML <span>Observação, dados e conhecimento ambiental.</span>
        </footer>
      </div>
    </div>
  );
}
