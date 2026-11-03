import { Link } from 'react-router';
import { api } from '../../api/recursos';
import { useConsulta } from '../../api/useConsulta';
import type { ResultadoAnalise } from '../../api/tipos';
import { useAuth } from '../../auth/AuthContext';
import { Carregando, Erro, Vazio } from '../../components/Estados';
import { Pagina, ComoFunciona } from '../../components/Pagina';
import { ListaAlertas } from '../../components/ListaAlertas';
import { data, nomeParametro, numero } from '../../components/formatacao';
import { ReguaIqa, type MarcaRegua } from '../../components/graficos/ReguaIqa';
import { SerieMiniatura } from '../../components/graficos/SerieMiniatura';
import { BarrasHorizontais } from '../../components/graficos/BarrasHorizontais';
import { corIqa, mediasSemanais, pisoIqa, valorDiasAntes } from '../../components/graficos/iqa';

function marcasDaRegua(analise: ResultadoAnalise): MarcaRegua[] {
  return analise.stations
    .filter((s) => s.latest?.iqa != null)
    .map((s) => ({
      id: s.stationId,
      nome: s.name,
      iqa: s.latest!.iqa!,
      anterior: valorDiasAntes(analise.series[s.stationId]?.iqa ?? [], 30),
    }));
}

function alertasPorParametro(analise: ResultadoAnalise) {
  const contagem = new Map<string, number>();
  analise.alerts.forEach((a) => contagem.set(a.parameter, (contagem.get(a.parameter) ?? 0) + 1));
  return [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([parametro, valor]) => ({ rotulo: nomeParametro(parametro), valor }));
}

export function Painel() {
  const consulta = useConsulta(api.painel);
  const analise = useConsulta(api.analise);
  const { usuario } = useAuth();
  const painel = consulta.dados;
  const resultado = analise.dados;
  const nomes = Object.fromEntries((resultado?.stations ?? []).map((s) => [s.stationId, s.name]));

  return (
    <Pagina
      titulo="Painel"
      descricao={
        painel?.summary.firstReading
          ? `${painel.summary.datasetName ?? 'Leituras'} de ${data(painel.summary.firstReading)} a ${data(painel.summary.lastReading)}.`
          : 'Acompanhe a qualidade da água dos seus pontos de monitoramento.'
      }
      acoes={
        <Link className="botao" to="/imagens">
          Registrar imagem
        </Link>
      }
    >
      <Erro erro={consulta.erro} tentar={consulta.recarregar} />
      {consulta.carregando && <Carregando />}

      {painel && !painel.hasData && (
        <Vazio titulo="Seu monitoramento começa aqui">
          <p>
            Registre uma foto da água ou uma imagem de satélite e confira a leitura da IA. Para ver o
            IQA, os gráficos e os alertas, importe uma planilha de sensores com pelo menos seis leituras
            por dia.
          </p>
          <div className="acoes">
            <Link className="botao" to="/imagens">
              Enviar primeira imagem
            </Link>
            {usuario?.role === 'ADMIN' ? (
              <Link className="botao secundario" to="/dados">
                Importar planilha
              </Link>
            ) : (
              <span className="texto-apoio">Peça ao administrador para importar as leituras.</span>
            )}
          </div>
        </Vazio>
      )}

      {painel?.hasData && resultado && (
        <>
          <section className="secao-regua" aria-labelledby="titulo-regua">
            <h2 id="titulo-regua">Como está a água em cada estação</h2>
            <p className="texto-apoio">
              IQA do último dia medido. A marca curta abaixo da régua mostra onde cada estação estava 30 dias antes.
            </p>
            <ReguaIqa marcas={marcasDaRegua(resultado)} />
            <dl className="fatos">
              <div>
                <dt>IQA médio</dt>
                <dd style={{ color: corIqa(painel.iqaMean) }}>{numero(painel.iqaMean)}</dd>
              </div>
              <div>
                <dt>Estações abaixo de Boa</dt>
                <dd>{numero(painel.stationsAtRisk, 0)}</dd>
              </div>
              <div>
                <dt>Alertas na última análise</dt>
                <dd>{numero(resultado.alerts.length, 0)}</dd>
              </div>
              <div>
                <dt>
                  <Link to="/imagens">Imagens para revisar</Link>
                </dt>
                <dd>{numero(painel.imagesPending, 0)}</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="titulo-evolucao">
            <h2 id="titulo-evolucao">IQA nos últimos 12 meses</h2>
            <ul className="grade-miniaturas">
              {resultado.stations.map((s) => {
                const serie = resultado.series[s.stationId];
                const pontos = serie ? mediasSemanais(serie.dates, serie.iqa) : [];
                return (
                  <li key={s.stationId}>
                    <Link to={`/estacoes/${encodeURIComponent(s.stationId)}`} className="miniatura-titulo">
                      <span>{s.name}</span>
                      <strong style={{ color: corIqa(s.latest?.iqa) }}>{numero(s.latest?.iqa, 0)}</strong>
                    </Link>
                    <SerieMiniatura
                      titulo={`IQA de ${s.name}`}
                      pontos={pontos}
                      minimo={pisoIqa(pontos.map((p) => p.valor))}
                    />
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="duas-colunas">
            <section className="bloco" aria-labelledby="titulo-parametros">
              <h2 id="titulo-parametros">O que mais gerou alertas</h2>
              <BarrasHorizontais
                titulo="Quantidade de alertas por parâmetro"
                itens={alertasPorParametro(resultado)}
                cor="var(--iqa-ruim)"
              />
              <p className="texto-apoio">Limites da Resolução CONAMA 357 para rios de classe 2.</p>
            </section>
            <section className="bloco" aria-labelledby="titulo-alertas">
              <h2 id="titulo-alertas">Alertas recentes</h2>
              <ListaAlertas alertas={painel.recentAlerts.slice(0, 5)} nomes={nomes} />
              <Link className="link-texto" to="/analises">
                Ver todos os alertas
              </Link>
            </section>
          </div>

          <section className="bloco" aria-labelledby="titulo-insights">
            <h2 id="titulo-insights">O que os dados mostram</h2>
            <ul className="lista-insights">
              {painel.insights.map((texto, i) => (
                <li key={i}>{texto}</li>
              ))}
            </ul>
            <ComoFunciona algoritmo="IQA CETESB/NSF">
              O Índice de Qualidade da Água reúne nove parâmetros em uma nota de 0 a 100. Ótima a partir
              de 80, boa a partir de 52, regular a partir de 37, ruim a partir de 20 e péssima abaixo de 20.
            </ComoFunciona>
          </section>
        </>
      )}
      {painel?.hasData && analise.carregando && <Carregando texto="Carregando os gráficos…" />}
    </Pagina>
  );
}
