// Menu lateral com a marca, a navegação (que muda conforme o papel) e o usuário logado.
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { nomePapel } from './formatacao';
import { icones } from './Icones';

type Pagina = [rota: string, nome: string, icone: string];
const paginas: Pagina[] = [
  ['/', 'Painel', 'painel'],
  ['/estacoes', 'Estações', 'estacoes'],
  ['/imagens', 'Imagens', 'imagens'],
  ['/analises', 'Análises', 'analises'],
  ['/anotacoes', 'Anotações de campo', 'anotacoes'],
  ['/assistente', 'Limno IA', 'assistente'],
];
const paginasAdmin: Pagina[] = [
  ['/dados', 'Dados', 'dados'],
  ['/usuarios', 'Usuários', 'usuarios'],
];

/** Símbolo: uma gota com a lâmina d'água marcada por uma régua. */
export function SimboloRegua({ tamanho = 28 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 32 32" aria-hidden="true" className="simbolo">
      <rect width="32" height="32" fill="var(--correnteza)" />
      <path d="M16 6.5s-7 7.6-7 12.4a7 7 0 0 0 14 0c0-4.8-7-12.4-7-12.4Z" fill="var(--primary-foreground)" />
      <path d="M9.4 20.5h13.2" stroke="var(--correnteza)" strokeWidth="1.6" />
      <path d="M12 23.4h8" stroke="var(--correnteza)" strokeWidth="1.6" opacity=".6" />
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

function Item({ pagina: [rota, nome, icone] }: { pagina: Pagina }) {
  return (
    <NavLink to={rota} end={rota === '/'}>
      {icones[icone]({ tamanho: 18 })}
      <span>{nome}</span>
    </NavLink>
  );
}

export function Layout() {
  const { usuario, sair } = useAuth();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  const principal = useRef<HTMLElement>(null);
  const todas = usuario?.role === 'ADMIN' ? [...paginas, ...paginasAdmin] : paginas;
  const chat = pathname === '/assistente';

  useEffect(() => {
    setMenu(false);
    principal.current?.focus();
    document.title = `AquaML | ${todas.find(([p]) => p === pathname)?.[1] ?? 'Monitoramento da água'}`;
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const iniciais = (usuario?.name ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  return (
    <div className="aplicacao">
      <a className="pular" href="#conteudo">
        Pular para o conteúdo
      </a>
      <aside className={`lateral${menu ? ' aberto' : ''}`}>
        <div className="lateral-topo">
          <NavLink to="/" className="link-marca" aria-label="AquaML, página inicial">
            <Marca />
          </NavLink>
          <button
            className="botao-icone menu-movel"
            aria-expanded={menu}
            aria-controls="navegacao"
            aria-label="Abrir menu"
            onClick={() => setMenu(!menu)}
          >
            {icones.menu({ tamanho: 20 })}
          </button>
        </div>
        <nav id="navegacao" className="navegacao" aria-label="Navegação principal">
          {paginas.map((p) => (
            <Item key={p[0]} pagina={p} />
          ))}
          {usuario?.role === 'ADMIN' && (
            <>
              <p className="navegacao-grupo">Administração</p>
              {paginasAdmin.map((p) => (
                <Item key={p[0]} pagina={p} />
              ))}
            </>
          )}
        </nav>
        <div className="identidade">
          <span className="avatar" aria-hidden="true">
            {iniciais}
          </span>
          <div>
            <strong>{usuario?.name}</strong>
            <span>{usuario && nomePapel[usuario.role]}</span>
          </div>
          <button className="botao-icone" onClick={sair} aria-label="Sair" title="Sair">
            {icones.sair({ tamanho: 18 })}
          </button>
        </div>
      </aside>
      <main id="conteudo" className={`area-principal${chat ? ' modo-chat' : ''}`} ref={principal} tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
