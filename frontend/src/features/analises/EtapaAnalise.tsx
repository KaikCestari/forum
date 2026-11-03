import type { ReactNode } from 'react';
import { Bloco } from '../../components/Pagina';

export function EtapaAnalise({
  titulo,
  metodo,
  children,
}: {
  titulo: string;
  metodo: string;
  children: ReactNode;
}) {
  const naoExecutada = metodo.trim().toLocaleLowerCase('pt-BR').startsWith('não executado');
  const motivo = metodo.replace(/^\s*não executado\s*:?\s*/i, '').trim();
  return (
    <Bloco titulo={titulo}>
      {naoExecutada ? (
        <>
          <p>
            Ainda não há dados suficientes para esta etapa. Reúna mais leituras de sensores e peça
            ao administrador para executar uma nova análise.
          </p>
          <p className="texto-apoio">
            Esta etapa não foi realizada; ainda não é possível tirar conclusões sobre ela.
          </p>
          {motivo && (
            <details>
              <summary>Por que esta etapa não foi executada?</summary>
              <p>{motivo}</p>
            </details>
          )}
        </>
      ) : (
        children
      )}
    </Bloco>
  );
}
