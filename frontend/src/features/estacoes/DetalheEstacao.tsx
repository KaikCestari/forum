import { useCallback } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../../api/recursos';
import { ErroApi } from '../../api/cliente';
import { useConsulta } from '../../api/useConsulta';
import { Carregando, Erro, Vazio } from '../../components/Estados';
import { Bloco, Pagina, ComoFunciona } from '../../components/Pagina';
import { GraficoSerie } from '../../components/GraficoSerie';
import { nomeParametro, numero, tiposEstacao } from '../../components/formatacao';
import { ParametrosEstacao } from './ParametrosEstacao';
export function DetalheEstacao() {
  const { id = '' } = useParams();
  const estacoes = useConsulta(api.estacoes);
  const carregar = useCallback(
    async (signal: AbortSignal) => {
      try {
        return await api.serie(id, signal);
      } catch (erro) {
        if (erro instanceof ErroApi && erro.status === 404) return null;
        throw erro;
      }
    },
    [id],
  );
  const consulta = useConsulta(carregar);
  const serie = consulta.dados;
  const estacao = estacoes.dados?.find((e) => e.id === id);
  return (
    <Pagina
      titulo={estacao?.name ?? 'Detalhe da estação'}
      descricao={
        estacao
          ? `${tiposEstacao[estacao.type]}. Acompanhe as mudanças ao longo do tempo.`
          : 'Histórico do ponto de monitoramento.'
      }
      acoes={
        <Link className="botao secundario" to="/estacoes">
          Voltar às estações
        </Link>
      }
    >
      <Erro erro={estacoes.erro} tentar={estacoes.recarregar} />
      <Erro erro={consulta.erro} tentar={consulta.recarregar} />
      {(consulta.carregando || estacoes.carregando) && <Carregando />}
      {estacoes.dados && !estacao && (
        <Vazio titulo="Estação não encontrada">
          <p>Volte à lista e escolha uma estação cadastrada.</p>
        </Vazio>
      )}
      {estacao && (
        <>
          <div className="faixa-periodo">
            <span>
              {estacao.lat != null && estacao.lon != null
                ? `Localização: ${numero(estacao.lat, 5)}, ${numero(estacao.lon, 5)}`
                : 'Coordenadas não informadas'}
            </span>
            <span>Qualidade prevista: {estacao.predictedClass ?? 'Ainda não calculada'}</span>
          </div>
          {estacao.worseningTrends.length > 0 && (
            <p className="aviso">
              Acompanhe com atenção: {estacao.worseningTrends.map(nomeParametro).join(', ')}.
            </p>
          )}
          {serie === null && (
            <Vazio titulo="Ainda não há uma série analisada">
              <p>
                O administrador precisa importar leituras e executar uma análise para mostrar o
                histórico desta estação.
              </p>
            </Vazio>
          )}
          {serie && (
            <>
              <Bloco titulo="Qualidade da água ao longo do tempo">
                <GraficoSerie
                  titulo="IQA"
                  datas={serie.dates}
                  valores={serie.iqa}
                  anomalias={serie.anomaly}
                  limite={[0, 100]}
                />
                <ComoFunciona algoritmo="IQA CETESB/NSF">
                  Valores maiores indicam melhor qualidade. Os losangos marcam dias identificados
                  como fora do padrão pela análise, sem afirmar sua causa.
                </ComoFunciona>
              </Bloco>
              <ParametrosEstacao serie={serie} />
            </>
          )}
        </>
      )}
    </Pagina>
  );
}
