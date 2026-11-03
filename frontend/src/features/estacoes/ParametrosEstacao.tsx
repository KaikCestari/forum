import { useState } from 'react';
import type { Serie } from '../../api/tipos';
import { GraficoSerie } from '../../components/GraficoSerie';
import { Bloco } from '../../components/Pagina';
import { nomeParametro, parametros } from '../../components/formatacao';

export function ParametrosEstacao({ serie }: { serie: Serie }) {
  const [parametro, setParametro] = useState('');
  const disponiveis = Object.keys(serie.params).filter((chave) =>
    serie.params[chave].some((valor) => valor !== null && Number.isFinite(valor)),
  );
  const ausentes = Object.keys(serie.params).filter((chave) => !disponiveis.includes(chave));
  const selecionado = disponiveis.includes(parametro) ? parametro : disponiveis[0];
  return (
    <Bloco titulo="Parâmetros da água">
      {selecionado ? (
        <>
          <label className="seletor-parametro">
            Parâmetro
            <select value={selecionado} onChange={(e) => setParametro(e.target.value)}>
              {disponiveis.map((chave) => (
                <option key={chave} value={chave}>
                  {nomeParametro(chave)}
                </option>
              ))}
            </select>
          </label>
          <GraficoSerie
            titulo={nomeParametro(selecionado)}
            datas={serie.dates}
            valores={serie.params[selecionado]}
            anomalias={serie.anomaly}
            unidade={parametros[selecionado]?.unit}
          />
        </>
      ) : (
        <p>Nenhum sensor com leituras disponível nesta série. Não há parâmetros para desenhar.</p>
      )}
      {ausentes.length > 0 && (
        <p className="texto-apoio">
          Sensores ausentes nesta série: {ausentes.map(nomeParametro).join(', ')}.
        </p>
      )}
    </Bloco>
  );
}
