// Apresenta dias fora do padrão e explica o método usado na análise.
import { Link } from 'react-router';
import { ComoFunciona } from '../../components/Pagina';
import { EtapaAnalise } from './EtapaAnalise';
import { data, percentual } from '../../components/formatacao';
import type { ResultadoAnalise } from '../../api/tipos';
import { ListaProgressiva } from '../../components/ListaProgressiva';
export function Anomalias({
  analise,
  nomes,
}: {
  analise: ResultadoAnalise;
  nomes: Record<string, string>;
}) {
  const parametro = (chave: string) => analise.parameters[chave]?.label ?? chave;
  return (
    <EtapaAnalise titulo="Dias fora do padrão" metodo={analise.anomalies.method}>
      <p>Mudanças incomuns que podem ajudar a localizar eventos no ambiente.</p>
      {analise.anomalies.episodes.length ? (
        <ListaProgressiva itens={analise.anomalies.episodes}>
          {(visiveis) => (
            <ul className="lista-registros">
              {visiveis.map((episodio, i) => (
                <li key={i}>
                  <strong>{nomes[episodio.stationId] ?? episodio.stationId}</strong>
                  <p>
                    {data(episodio.start)} a {data(episodio.end)} · {episodio.days} dia(s)
                  </p>
                  <p>
                    Parâmetros:{' '}
                    {episodio.parameters.map(parametro).join(', ') || 'Não especificados'}
                  </p>
                  <Link to={`/estacoes/${encodeURIComponent(episodio.stationId)}`}>
                    Ver no histórico
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ListaProgressiva>
      ) : (
        <p className="texto-apoio">Nenhum episódio fora do padrão foi identificado.</p>
      )}
      {analise.anomalies.evaluation ? (
        <p>
          Foram identificados {analise.anomalies.evaluation.detected} de{' '}
          {analise.anomalies.evaluation.knownEvents} eventos conhecidos (
          {percentual(analise.anomalies.evaluation.recall)}).
        </p>
      ) : (
        <p className="texto-apoio">Sem eventos conhecidos para avaliar a detecção.</p>
      )}
      <ComoFunciona algoritmo={analise.anomalies.method}>
        Isolation Forest procura combinações incomuns entre os parâmetros. O z-score compara cada
        valor ao comportamento dos últimos 30 dias. Uma anomalia é um sinal para investigar, não uma
        confirmação de contaminação.
      </ComoFunciona>
    </EtapaAnalise>
  );
}
