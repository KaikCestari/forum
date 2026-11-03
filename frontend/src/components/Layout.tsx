// Barra superior com a marca, a navegação (que muda conforme o papel) e o usuário logado.
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { nomePapel } from './formatacao';

const paginas: [string, string][] = [
  ['/', 'Painel'],
  ['/estacoes', 'Estações'],
  ['/imagens', 'Imagens'],
  ['/analises', 'Análises'],
  ['/anotacoes', 'Anotações de campo'],
  ['/assistente', 'Limno IA'],
];
const paginasAdmin: [string, string][] = [
  ['/dados', 'Dados'],
  ['/usuarios', 'Usuários'],
];

/** Símbolo: uma régua linimétrica (a régua graduada das estações hidrométricas) com a lâmina d'água. */
export function SimboloRegua({ tamanho = 28 }: { tamanho?: number }) {
  return (
    <svg width={tamanho * 0.6} height={tamanho} viewBox="0 0 12 20" aria-hidden="true">
      <rect x="3" y="0" width="6" height="20" fill="var(--leito)" />
      {[2, 6, 10].map((y) => (
        <rect key={y} x="3" y={y} width="6" height="2" fill="var(--margem)" />
      ))}
      <rect x="0" y="13" width="12" height="7" fill="var(--correnteza)" opacity="0.85" />
    </svg>
  );
}

export function Marca() {
  return (
    <span className="marca">
      <SimboloRegua />
      AquaML
    </span>
  );
}

export function Layout() {
  const { usuario, sair } = useAuth();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  const principal = useRef<HTMLElement>(null);
  const todas = usuario?.role === 'ADMIN' ? [...paginas, ...paginasAdmin] : paginas;

  useEffect(() => {
    setMenu(false);
    principal.current?.focus();
    document.title = `AquaML | ${todas.find(([p]) => p === pathname)?.[1] ?? 'Monitoramento da água'}`;
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="aplicacao">
      <a className="pular" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="barra-superior">
        <div className="barra-superior-interna">
          <NavLink to="/" className="link-marca" aria-label="AquaML, página inicial">
            <Marca />
          </NavLink>
          <nav id="navegacao" className={`navegacao${menu ? ' aberto' : ''}`} aria-label="Navegação principal">
            {paginas.map(([rota, nome]) => (
              <NavLink key={rota} to={rota} end={rota === '/'}>
                {nome}
              </NavLink>
            ))}
            {usuario?.role === 'ADMIN' && (
              <>
                <span className="separador" aria-hidden="true" />
                {paginasAdmin.map(([rota, nome]) => (
                  <NavLink key={rota} to={rota}>
                    {nome}
                  </NavLink>
                ))}
              </>
            )}
          </nav>
          <div className="identidade">
            <div>
              <strong>{usuario?.name}</strong>
              <span>{usuario && nomePapel[usuario.role]}</span>
            </div>
            <button
              className="botao secundario pequeno menu-movel"
              aria-expanded={menu}
              aria-controls="navegacao"
              onClick={() => setMenu(!menu)}
            >
              Menu
            </button>
            <button className="botao secundario pequeno" onClick={sair}>
              Sair
            </button>
          </div>
        </div>
      </header>
      <main id="conteudo" className="area-principal" ref={principal} tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="rodape">
        <p>AquaML, monitoramento de ecossistemas aquáticos com algoritmos e aprendizado de máquina.</p>
      </footer>
    </div>
  );
}
