import { Navigate, useLocation } from "react-router";
import { useEffect } from "react";
import { SWRConfig, useSWRConfig } from "swr";
import { setApiMutate } from "../api/client";
import { App } from "../App";
import { Icon } from "../components/Icon";
import { safeReturnPath } from "../lib/auth";
import AuthView from "../views/AuthView";
import { useAuth } from "./AuthProvider";

export function AuthRouter() {
  const auth = useAuth();
  const location = useLocation();
  const publicPage = ["/login", "/cadastro"].includes(location.pathname);
  if (auth.loading)
    return (
      <main className="auth-check" role="status">
        <Icon name="water" size={32} />
        <p>Verificando seu acesso…</p>
      </main>
    );
  if (auth.error && !auth.user)
    return (
      <main className="auth-check">
        <Icon name="water" size={32} />
        <h1>Não foi possível conectar</h1>
        <p>Verifique se o servidor está disponível e tente novamente.</p>
        <button className="button" type="button" onClick={auth.retry}>
          Tentar novamente
        </button>
      </main>
    );
  if (!auth.user)
    return publicPage ? (
      <AuthView key={location.pathname} />
    ) : (
      <Navigate
        to={`/login?retorno=${encodeURIComponent(location.pathname + location.search + location.hash)}`}
        replace
      />
    );
  if (publicPage)
    return (
      <Navigate
        to={safeReturnPath(new URLSearchParams(location.search).get("retorno"))}
        replace
      />
    );
  // Um cache novo por conta impede que dados da sessão anterior reapareçam.
  return (
    <SWRConfig key={auth.user.id} value={{ provider: () => new Map() }}>
      <Workspace />
    </SWRConfig>
  );
}

function Workspace() {
  const { mutate } = useSWRConfig();
  useEffect(() => {
    setApiMutate(mutate);
  }, [mutate]);
  return <App />;
}
