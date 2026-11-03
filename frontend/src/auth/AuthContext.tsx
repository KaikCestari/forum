import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../api/recursos';
import { EVENTO_SESSAO_EXPIRADA, sessao } from '../api/cliente';
import type { Usuario } from '../api/tipos';
interface Autenticacao {
  usuario: Usuario | null;
  carregando: boolean;
  erro: Error | null;
  expirada: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => void;
  tentar: () => void;
}
const Contexto = createContext<Autenticacao | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<Error | null>(null);
  const [expirada, setExpirada] = useState(false);
  const [versao, setVersao] = useState(0);
  const sair = useCallback(() => {
    sessao.limpar();
    setUsuario(null);
    setErro(null);
    setExpirada(false);
  }, []);
  useEffect(() => {
    const expirar = () => {
      sair();
      setExpirada(true);
    };
    const sincronizar = (evento: StorageEvent) => {
      if (evento.storageArea === localStorage) setVersao((v) => v + 1);
    };
    window.addEventListener(EVENTO_SESSAO_EXPIRADA, expirar);
    window.addEventListener('storage', sincronizar);
    return () => {
      window.removeEventListener(EVENTO_SESSAO_EXPIRADA, expirar);
      window.removeEventListener('storage', sincronizar);
    };
  }, [sair]);
  useEffect(() => {
    const controle = new AbortController();
    setErro(null);
    if (!sessao.token()) {
      setUsuario(null);
      setCarregando(false);
      return;
    }
    setCarregando(true);
    api
      .eu(controle.signal)
      .then((u) => {
        if (!controle.signal.aborted) setUsuario(u);
      })
      .catch((e: Error) => {
        if (!controle.signal.aborted && sessao.token()) setErro(e);
      })
      .finally(() => {
        if (!controle.signal.aborted) setCarregando(false);
      });
    return () => controle.abort();
  }, [versao]);
  async function entrar(email: string, senha: string) {
    const resposta = await api.login(email, senha);
    sessao.salvar(resposta.token);
    setUsuario(resposta.user);
    setExpirada(false);
    setErro(null);
  }
  return (
    <Contexto.Provider
      value={{
        usuario,
        carregando,
        erro,
        expirada,
        entrar,
        sair,
        tentar: () => setVersao((v) => v + 1),
      }}
    >
      {children}
    </Contexto.Provider>
  );
}
export function useAuth() {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useAuth precisa de AuthProvider.');
  return contexto;
}
