// Apresenta mudanças ao longo do tempo e explica o método usado na análise.
import { Bloco, ComoFunciona, Selo } from '../../components/Pagina';
import { numero } from '../../components/formatacao';
import type { ResultadoAnalise } from '../../api/tipos';
import { useState } from 'react';
import { ListaProgressiva } from '../../components/ListaProgressiva';
export function Tendencias({
  analise,
  nomes,
}: {
  analise: ResultadoAnalise;
  nomes: Record<string, string>;
}) {
  const parametro = (chave: string) => analise.parameters[chave]?.label ?? chave;
  const [direcao, setDirecao] = useState('mudancas');
  const tendencias = analise.trends.filter(
    (t) =>
      direcao === 'todas' ||
      (direcao === 'mudancas' ? t.direction !== 'estavel' : t.direction === direcao),
  );
  return (
    <Bloco titulo="Mudanças ao longo do tempo">
      <label className="seletor-parametro">
        Tendências exibidas
        <select value={direcao} onChange={(e) => setDirecao(e.target.value)}>
          <option value="mudancas">Piora e melhora</option>
          <option value="piora">Somente piora</option>
          <option value="melhora">Somente melhora</option>
          <option value="estavel">Somente estáveis</option>
          <option value="todas">Todas, incluindo estáveis</option>
        </select>
      </label>
      {tendencias.length ? (
        <ListaProgressiva key={direcao} itens={tendencias}>
          {(visiveis) => (
            <ul className="lista-registros">
              {visiveis.map((t, i) => (
                <li key={i}>
                  <div className="linha">
                    <strong>
                      {nomes[t.stationId] ?? t.stationId} · {parametro(t.parameter)}
                    </strong>
                    <Selo
                      tom={
                        t.direction === 'piora'
                          ? 'atencao'
                          : t.direction === 'melhora'
                            ? 'bom'
                            : 'neutro'
                      }
                    >
                      {t.direction === 'piora'
                        ? 'Piorando'
                        : t.direction === 'melhora'
                          ? 'Melhorando'
                          : 'Estável'}
                    </Selo>
                  </div>
                  <p>
                    Variação estimada: {numero(t.slopePerYear, 3)}{' '}
                    {analise.parameters[t.parameter]?.unit} por ano.
                  </p>
                  <details>
                    <summary>Detalhe estatístico</summary>
                    <p>
                      Valor p: {numero(t.pValue, 4)}. Valores menores indicam mais evidência de uma
                      tendência no período observado.
                    </p>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </ListaProgressiva>
      ) : (
        <p className="texto-apoio">
          {analise.trends.length
            ? 'Nenhuma tendência corresponde ao filtro. Escolha outra opção para consultar os resultados.'
            : 'Ainda não há tendências disponíveis. Pode ser necessário um período maior de observação.'}
        </p>
      )}
      <ComoFunciona algoritmo="Mann-Kendall">
        O teste procura uma direção persistente nos dados ao longo do tempo. A interpretação de
        melhora ou piora depende do parâmetro. Uma tendência não garante o que vai acontecer no
        futuro.
      </ComoFunciona>
    </Bloco>
  );
}
