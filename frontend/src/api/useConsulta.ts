import { useCallback, useEffect, useState } from 'react';
export function useConsulta<T>(carregar: (signal: AbortSignal) => Promise<T>) {
  const [dados, setDados] = useState<T>();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<Error | null>(null);
  const [versao, setVersao] = useState(0);
  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  useEffect(() => {
    const controle = new AbortController();
    setCarregando(true);
    setErro(null);
    setDados(undefined);
    carregar(controle.signal)
      .then((resultado) => {
        if (!controle.signal.aborted) setDados(resultado);
      })
      .catch((e: Error) => {
        if (!controle.signal.aborted) setErro(e);
      })
      .finally(() => {
        if (!controle.signal.aborted) setCarregando(false);
      });
    return () => controle.abort();
  }, [carregar, versao]);
  return { dados, carregando, erro, recarregar };
}
