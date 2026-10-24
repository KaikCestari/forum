import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import type { PipelineStatus } from "../api/types";
import { dmy, lowerFirst } from "../lib/format";
import { friendlyStep } from "../lib/stages";
import { Icon, type IconName } from "./Icon";
import { useAuth } from "../auth/AuthProvider";

const GROUPS: {
  label: string;
  links: { to: string; label: string; icon: IconName }[];
}[] = [
  {
    label: "Monitoramento",
    links: [
      { to: "/", label: "Visão geral", icon: "overview" },
      { to: "/estacoes", label: "Estações", icon: "stations" },
      { to: "/imagens", label: "Imagens", icon: "image" },
      { to: "/caderno", label: "Caderno de campo", icon: "notes" },
    ],
  },
  {
    label: "Inteligência",
    links: [
      { to: "/analises", label: "Análises da IA", icon: "analysis" },
      { to: "/assistente", label: "Assistente", icon: "assistant" },
      { to: "/relatorio", label: "Relatório", icon: "report" },
    ],
  },
  {
    label: "Gestão",
    links: [
      { to: "/dados", label: "Meus dados", icon: "data" },
      { to: "/atualizar", label: "Atualizar análise", icon: "refresh" },
    ],
  },
];

interface Props {
  pipeline?: PipelineStatus;
  period?: [string, string];
  offline?: boolean;
}

export function AppBar({ pipeline, period, offline }: Props) {
  const auth = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const signOut = async () => {
    setSigningOut(true);
    setLogoutError(null);
    try {
      await auth.signOut();
    } catch {
      setLogoutError("Não foi possível sair. Tente novamente.");
    } finally {
      setSigningOut(false);
    }
  };
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const group = GROUPS.find((g) =>
    g.links.some((l) =>
      l.to === "/"
        ? location.pathname === "/"
        : location.pathname.startsWith(l.to),
    ),
  );
  const current = group?.links.find((l) =>
    l.to === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(l.to),
  );
  const running = !!pipeline?.running;
  const step = pipeline?.steps.at(-1);
  const state = offline
    ? "Sem conexão com a API"
    : running
      ? step
        ? lowerFirst(friendlyStep(step.name))
        : "Iniciando atualização"
      : pipeline?.error
        ? "Falha na última análise"
        : period
          ? "Análise disponível"
          : "Aguardando dados";

  useEffect(() => {
    if (open) opener.current?.focus();
    setOpen(false);
  }, [location.pathname, location.search]);
  useEffect(() => {
    document.title = `${current?.label ?? "Guia"} · AquaML`;
  }, [current?.label]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebar.current?.querySelector<HTMLElement>("a, button")?.focus();
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        opener.current?.focus();
      }
      if (e.key === "Tab") {
        const elements =
          sidebar.current?.querySelectorAll<HTMLElement>("a, button");
        if (!elements?.length) return;
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    const resize = () => {
      if (window.innerWidth > 900) setOpen(false);
    };
    document.addEventListener("keydown", close);
    window.addEventListener("resize", resize);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", close);
      window.removeEventListener("resize", resize);
    };
  }, [open]);

  return (
    <>
      <a className="skip-link" href="#main-content">
        Ir para o conteúdo
      </a>
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="Fechar navegação"
          tabIndex={-1}
          onClick={() => {
            setOpen(false);
            opener.current?.focus();
          }}
        />
      )}
      <aside
        ref={sidebar}
        className={`sidebar${open ? " is-open" : ""}`}
        id="app-navigation"
        aria-label="Navegação principal"
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
      >
        <div className="sidebar-brand">
          <Link to="/" className="brand">
            <span className="brand-symbol">
              <Icon name="water" size={25} />
            </span>
            <span>
              Aqua<span className="brand-ml">ML</span>
              <small>Monitoramento ambiental</small>
            </span>
          </Link>
          <button
            className="icon-button sidebar-close"
            aria-label="Fechar navegação"
            onClick={() => {
              setOpen(false);
              opener.current?.focus();
            }}
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="workspace-label">
          <span className="workspace-dot" />
          Seu espaço de trabalho
        </div>
        <nav className="sidebar-nav" aria-label="Funcionalidades">
          {GROUPS.map((g) => (
            <div className="nav-group" key={g.label}>
              <p className="nav-group-title">{g.label}</p>
              {g.links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === "/"}
                  className="sidebar-link"
                >
                  <Icon name={l.icon} />
                  <span>{l.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="account-profile">
            <span className="account-avatar" aria-hidden="true">
              {auth.user?.name
                .split(/\s+/)
                .map((part) => part[0])
                .slice(0, 2)
                .join("")
                .toLocaleUpperCase("pt-BR")}
            </span>
            <span className="account-details">
              <strong>{auth.user?.name}</strong>
              <small title={auth.user?.email}>{auth.user?.email}</small>
            </span>
            <button
              className="account-logout"
              type="button"
              aria-label="Sair da conta"
              title="Sair da conta"
              onClick={signOut}
              disabled={signingOut}
            >
              <Icon name={signingOut ? "clock" : "logout"} size={18} />
            </button>
          </div>
          {logoutError && (
            <p className="account-error" role="alert">
              {logoutError}
            </p>
          )}
          <Link to="/guia" className="sidebar-help">
            <Icon name="guide" />
            <span>
              Guia do AquaML<small>Entenda seus dados</small>
            </span>
            <Icon name="chevron" size={15} />
          </Link>
          <div className="sidebar-signature">
            <Icon name="water" size={14} />
            <span>Ciência a favor da água</span>
          </div>
        </div>
      </aside>
      <header className="topbar">
        <button
          ref={opener}
          className="icon-button menu-toggle"
          aria-label="Abrir navegação"
          aria-expanded={open}
          aria-controls="app-navigation"
          onClick={() => setOpen(true)}
        >
          <Icon name="menu" />
        </button>
        <nav className="breadcrumb" aria-label="Localização">
          <span>{group?.label ?? "Ajuda"}</span>
          <Icon name="chevron" size={13} />
          <strong>{current?.label ?? "Guia"}</strong>
        </nav>
        <div className="topbar-actions">
          {period && (
            <span className="period-chip">
              <Icon name="calendar" size={15} />
              {dmy(period[0])} a {dmy(period[1])}
            </span>
          )}
          <Link to="/dados?aba=importar" className="topbar-import">
            <Icon name="upload" size={16} />
            <span>Importar dados</span>
          </Link>
        </div>
      </header>
      <div className="connection-line">
        <span
          className={`connection-state${offline || pipeline?.error ? " is-warning" : ""}${running ? " is-running" : ""}`}
        >
          <i />
          {state}
        </span>
        <span>Rios, lagos, reservatórios e estuários</span>
      </div>
    </>
  );
}
