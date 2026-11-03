import { useCallback } from 'react';
import { Link } from 'react-router';
import { api } from '../../api/recursos';
import { useConsulta } from '../../api/useConsulta';
import { nomeParametro, numero, parametros } from '../../components/formatacao';
import { SerieMiniatura } from '../../components/graficos/SerieMiniatura';
import { corIqa, mediasSemanais, pisoIqa } from '../../components/graficos/iqa';
import type { PedidoGrafico } from './resposta';

export function GraficoResposta({ pedido, nomeEstacao }: { pedido: PedidoGrafico; nomeEstacao: string }) {
  const carregar = useCallback((s: AbortSignal) => api.serie(pedido.estacao, s), [pedido.estacao]);
  const serie = useConsulta(carregar);
  const ehIqa = pedido.parametro === 'iqa';
  const titulo = ehIqa ? 'IQA' : nomeParametro(pedido.parametro);
  const unidade = ehIqa ? '' : (parametros[pedido.parametro]?.unit ?? '');

  if (serie.carregando) return <figure className="grafico-resposta carregando-grafico" aria-busy="true" />;
  if (!serie.dados) return null;
  const valores = ehIqa ? serie.dados.iqa : (serie.dados.params[pedido.parametro] ?? []);
  const pontos = mediasSemanais(serie.dados.dates, valores, 180);
  if (pontos.length < 2) return null;
  const ultimo = pontos[pontos.length - 1].valor;
  const numeros = pontos.map((p) => p.valor);
  const folga = (Math.max(...numeros) - Math.min(...numeros)) * 0.1 || 1;

  return (
    <figure className="grafico-resposta">
      <figcaption>
        <Link to={`/estacoes/${encodeURIComponent(pedido.estacao)}`}>{nomeEstacao}</Link>
        <span>
          {titulo} nos últimos 6 meses:{' '}
          <strong style={ehIqa ? { color: corIqa(ultimo) } : undefined}>
            {numero(ultimo)} {unidade}
          </strong>
        </span>
      </figcaption>
      <SerieMiniatura
        titulo={`${titulo} em ${nomeEstacao}`}
        pontos={pontos}
        faixas={ehIqa}
        minimo={ehIqa ? pisoIqa(numeros) : Math.min(...numeros) - folga}
        maximo={ehIqa ? 100 : Math.max(...numeros) + folga}
        unidade={unidade}
      />
    </figure>
  );
}
