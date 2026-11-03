// Compartilha o controle de envio e a apresentação de erros das ações do usuário.
import { useRef, useState } from 'react';
export function useAcao() {
  const ocupado = useRef(false);
  const [executando, setExecutando] = useState(false);
  const [erro, setErro] = useState<Error | null>(null);
  async function executar<T>(acao: () => Promise<T>): Promise<{ valor: T } | null> {
    if (ocupado.current) return null;
    ocupado.current = true;
    setExecutando(true);
    setErro(null);
    try {
      return { valor: await acao() };
    } catch (e) {
      setErro(e instanceof Error ? e : new Error('Não foi possível concluir a ação.'));
      return null;
    } finally {
      ocupado.current = false;
      setExecutando(false);
    }
  }
  return { executar, executando, erro };
}
