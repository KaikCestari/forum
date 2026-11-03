import { useState } from 'react';
import type { ResultadoAnalise } from '../../api/tipos';
import { AbasAnalise, type SecaoAnalise } from './AbasAnalise';
import { filtrarAnalise } from './filtrarAnalise';
import { AlertasAnalise } from './AlertasAnalise';
import { Anomalias } from './Anomalias';
import { Classificacao } from './Classificacao';
import { Grupos } from './Grupos';
import { Tendencias } from './Tendencias';

export function ExplorarAnalise({ analise }: { analise: ResultadoAnalise }) {
  const [estacao, setEstacao] = useState('');
  const [secao, setSecao] = useState<SecaoAnalise>('alertas');
  const nomes = Object.fromEntries(analise.stations.map((e) => [e.stationId, e.name]));
  const filtrada = filtrarAnalise(analise, estacao);
  return (
    <>
      <label className="filtro-estacao-analise">
        Filtrar por estação
        <select value={estacao} onChange={(e) => setEstacao(e.target.value)}>
          <option value="">Todas as estações</option>
          {analise.stations.map((e) => (
            <option key={e.stationId} value={e.stationId}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
      <AbasAnalise ativa={secao} selecionar={setSecao} />
      {estacao && (
        <p className="texto-apoio">
          Mostrando registros de {nomes[estacao]}. A avaliação dos modelos e as características dos
          grupos consideram o conjunto completo de dados.
        </p>
      )}
      <div
        key={estacao}
        id="secao-analise"
        role="tabpanel"
        aria-labelledby={`aba-${secao}`}
        tabIndex={0}
      >
        {secao === 'alertas' && <AlertasAnalise analise={filtrada} nomes={nomes} />}
        {secao === 'anomalias' && <Anomalias analise={filtrada} nomes={nomes} />}
        {secao === 'classificacao' && <Classificacao analise={filtrada} nomes={nomes} />}
        {secao === 'grupos' && <Grupos analise={filtrada} nomes={nomes} />}
        {secao === 'tendencias' && <Tendencias analise={filtrada} nomes={nomes} />}
      </div>
    </>
  );
}
