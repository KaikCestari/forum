import type { ReactNode } from 'react';
export function Carregando({ texto = 'Carregando informações…' }: { texto?: string }) {
  return (
    <div className="carregando" role="status">
      <span className="indicador" aria-hidden="true" />
      {texto}
    </div>
  );
}
export function Erro({ erro, tentar }: { erro: Error | string | null; tentar?: () => void }) {
  if (!erro) return null;
  return (
    <div className="aviso erro" role="alert">
      <p>{typeof erro === 'string' ? erro : erro.message}</p>
      {tentar && (
        <button className="botao secundario" onClick={tentar}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}
export function Sucesso({ children }: { children: ReactNode }) {
  return (
    <div className="aviso sucesso" role="status">
      {children}
    </div>
  );
}
export function Vazio({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="vazio">
      <span className="ondas" aria-hidden="true">
        ≈
      </span>
      <h2>{titulo}</h2>
      <div>{children}</div>
    </div>
  );
}
