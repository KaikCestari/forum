// Lista alertas com gravidade escrita, data e estação identificada.
import type { Alerta } from '../api/tipos';
import { data, numero } from './formatacao';
import { Selo } from './Pagina';
export function ListaAlertas({
  alertas,
  nomes = {},
}: {
  alertas: Alerta[];
  nomes?: Record<string, string>;
}) {
  if (!alertas.length)
    return <p className="texto-apoio">Nenhum alerta registrado nesta análise.</p>;
  return (
    <ul className="lista-registros">
      {alertas.map((a, i) => (
        <li key={`${a.stationId}-${a.date}-${a.parameter}-${i}`}>
          <div className="linha">
            <strong>{a.message}</strong>
            <Selo tom={a.severity === 'critico' ? 'critico' : 'atencao'}>
              {a.severity === 'critico' ? 'Crítico' : 'Atenção'}
            </Selo>
          </div>
          <p>
            {nomes[a.stationId] ?? a.stationId} · {data(a.date)} · {numero(a.value)} {a.unit}
          </p>
        </li>
      ))}
    </ul>
  );
}
