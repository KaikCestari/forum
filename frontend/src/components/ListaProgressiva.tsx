import { useState, type ReactNode } from 'react';

export function ListaProgressiva<T>({
  itens,
  children,
}: {
  itens: T[];
  children: (visiveis: T[]) => ReactNode;
}) {
  const [limite, setLimite] = useState(10);
  return (
    <>
      {children(itens.slice(0, limite))}
      {itens.length > 0 && (
        <div className="lista-controles">
          <p className="texto-apoio" role="status">
            Mostrando {Math.min(limite, itens.length)} de {itens.length} registros.
          </p>
          <div className="acoes">
            {limite < itens.length && (
              <button className="botao secundario" onClick={() => setLimite(limite + 10)}>
                Mostrar mais
              </button>
            )}
            {limite > 10 && (
              <button className="botao secundario" onClick={() => setLimite(10)}>
                Mostrar menos
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
