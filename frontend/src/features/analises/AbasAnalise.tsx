// Oferece navegação entre seções com suporte a teclado e identificação da aba ativa.
import type { KeyboardEvent } from 'react';

const abas = [
  ['alertas', 'Alertas'],
  ['anomalias', 'Anomalias'],
  ['classificacao', 'Classificação'],
  ['grupos', 'Grupos'],
  ['tendencias', 'Tendências'],
] as const;
export type SecaoAnalise = (typeof abas)[number][0];

export function AbasAnalise({
  ativa,
  selecionar,
}: {
  ativa: SecaoAnalise;
  selecionar: (secao: SecaoAnalise) => void;
}) {
  function navegar(evento: KeyboardEvent<HTMLButtonElement>, indice: number) {
    let proxima: number;
    if (evento.key === 'ArrowRight') proxima = (indice + 1) % abas.length;
    else if (evento.key === 'ArrowLeft') proxima = (indice + abas.length - 1) % abas.length;
    else if (evento.key === 'Home') proxima = 0;
    else if (evento.key === 'End') proxima = abas.length - 1;
    else return;
    evento.preventDefault();
    selecionar(abas[proxima][0]);
    document.getElementById(`aba-${abas[proxima][0]}`)?.focus();
  }
  return (
    <div className="abas-analise" role="tablist" aria-label="Seções da análise">
      {abas.map(([id, nome], indice) => (
        <button
          key={id}
          id={`aba-${id}`}
          type="button"
          role="tab"
          aria-selected={ativa === id}
          aria-controls="secao-analise"
          tabIndex={ativa === id ? 0 : -1}
          onClick={() => selecionar(id)}
          onKeyDown={(e) => navegar(e, indice)}
        >
          {nome}
        </button>
      ))}
    </div>
  );
}
