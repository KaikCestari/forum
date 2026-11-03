import type { ResultadoAnalise } from '../../api/tipos';
import { ComoFunciona } from '../../components/Pagina';
import { EtapaAnalise } from './EtapaAnalise';
import { percentual } from '../../components/formatacao';
import { ListaProgressiva } from '../../components/ListaProgressiva';
export function Classificacao({
  analise,
  nomes,
}: {
  analise: ResultadoAnalise;
  nomes: Record<string, string>;
}) {
  const modelo = analise.classification;
  return (
    <EtapaAnalise titulo="Qualidade estimada" metodo={modelo.method}>
      <p>O modelo reconhece combinações de parâmetros para estimar a classe de qualidade.</p>
      {modelo.accuracy === null ? (
        <p className="texto-apoio">A taxa de acerto ainda não está disponível para esta análise.</p>
      ) : (
        <>
          <p className="destaque-metrica">
            <strong>{percentual(modelo.accuracy)}</strong>
            <span>de acertos na avaliação (acurácia)</span>
          </p>
          <p className="texto-apoio">
            Essa taxa descreve a avaliação do modelo; não é a certeza de cada previsão.
          </p>
        </>
      )}
      {Object.keys(modelo.current).length ? (
        <ListaProgressiva itens={Object.entries(modelo.current)}>
          {(visiveis) => (
            <ul className="lista-registros">
              {visiveis.map(([id, classe]) => (
                <li className="linha" key={id}>
                  <strong>{nomes[id] ?? id}</strong>
                  <span>{classe}</span>
                </li>
              ))}
            </ul>
          )}
        </ListaProgressiva>
      ) : (
        <p>Ainda não há classificações disponíveis.</p>
      )}
      <h3>O que mais influenciou a classificação</h3>
      {modelo.featureImportance.length ? (
        <ul className="importancias">
          {[...modelo.featureImportance]
            .sort((a, b) => b.importance - a.importance)
            .map((item) => (
              <li key={item.feature}>
                <div className="linha">
                  <span>{analise.parameters[item.feature]?.label ?? item.feature}</span>
                  <strong>{percentual(item.importance)}</strong>
                </div>
                <div className="barra-importancia" aria-hidden="true">
                  <span
                    style={{ width: `${Math.max(0, Math.min(100, item.importance * 100))}%` }}
                  />
                </div>
              </li>
            ))}
        </ul>
      ) : (
        <p className="texto-apoio">A importância das variáveis ainda não está disponível.</p>
      )}
      <ComoFunciona algoritmo={modelo.method}>
        Random Forest combina várias árvores de decisão. A importância indica quanto cada parâmetro
        ajudou o modelo, sem demonstrar uma relação de causa e efeito.
      </ComoFunciona>
    </EtapaAnalise>
  );
}
