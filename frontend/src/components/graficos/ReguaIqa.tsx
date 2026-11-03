// Régua linimétrica do IQA: a escala de 0 a 100 pintada nas cores da CETESB, com cada estação marcada
// no seu valor atual e uma marca curta embaixo onde ela estava 30 dias antes.
import { Link } from 'react-router';
import { numero } from '../formatacao';
import { corIqa, faixasIqa } from './iqa';

export interface MarcaRegua {
  id: string;
  nome: string;
  iqa: number;
  anterior: number | null;
}

const LARGURA_NOME = 20; // cada nome ocupa ~20% da largura da régua
const ALTURA_FAIXA = 44;

/** Trecho da régua ocupado pelo nome: à direita do ponteiro, ou à esquerda perto do fim da escala. */
function trecho(iqa: number): [number, number] {
  return iqa > 80 ? [iqa - LARGURA_NOME, iqa] : [iqa, iqa + LARGURA_NOME];
}

/** Distribui os nomes em faixas acima e abaixo da régua para não se sobreporem. */
function emFaixas(marcas: MarcaRegua[]) {
  const ocupados: [number, number][][] = [];
  return [...marcas]
    .sort((a, b) => a.iqa - b.iqa)
    .map((m) => {
      const [ini, fim] = trecho(m.iqa);
      let faixa = ocupados.findIndex((lista) => lista.every(([a, b]) => fim <= a || ini >= b));
      if (faixa === -1) faixa = ocupados.push([]) - 1;
      ocupados[faixa].push([ini, fim]);
      // faixas pares ficam abaixo da régua, ímpares acima
      return { ...m, faixa: Math.floor(faixa / 2), acima: faixa % 2 === 1 };
    });
}

export function ReguaIqa({ marcas }: { marcas: MarcaRegua[] }) {
  const posicionadas = emFaixas(marcas);
  const acima = posicionadas.filter((m) => m.acima);
  const abaixo = posicionadas.filter((m) => !m.acima);
  const altura = (lista: typeof posicionadas) => Math.max(0, ...lista.map((m) => m.faixa + 1)) * ALTURA_FAIXA;
  return (
    <figure className="regua">
      <figcaption className="sr-only">
        Régua do IQA com {marcas.length} estações. {marcas.map((m) => `${m.nome}: ${numero(m.iqa, 0)}`).join('. ')}.
      </figcaption>
      <Nomes lista={acima} altura={altura(acima)} lado="acima" />
      <div className="regua-escala" aria-hidden="true">
        {faixasIqa.map((f) => (
          <div key={f.classe} className="regua-faixa" style={{ flexBasis: `${f.ate - f.de}%`, background: f.cor }}>
            <span>{f.classe}</span>
          </div>
        ))}
        {posicionadas.map((m) => (
          <span key={m.id}>
            {m.anterior != null && (
              <span className="regua-anterior" style={{ left: `${m.anterior}%` }} />
            )}
            <span className="regua-ponteiro" style={{ left: `${m.iqa}%` }} />
          </span>
        ))}
      </div>
      <div className="regua-graduacao" aria-hidden="true">
        {[0, 20, 37, 52, 80, 100].map((v) => (
          <span key={v} style={{ left: `${v}%` }}>
            {v}
          </span>
        ))}
      </div>
      <Nomes lista={abaixo} altura={altura(abaixo)} lado="abaixo" />
    </figure>
  );
}

function Nomes({
  lista,
  altura,
  lado,
}: {
  lista: (MarcaRegua & { faixa: number; acima: boolean })[];
  altura: number;
  lado: 'acima' | 'abaixo';
}) {
  if (!lista.length) return null;
  return (
    <ol className={`regua-nomes ${lado}`} style={{ height: `${altura}px` }}>
      {lista.map((m) => (
        <li
          key={m.id}
          style={{ left: `${m.iqa}%`, [lado === 'abaixo' ? 'top' : 'bottom']: `${m.faixa * ALTURA_FAIXA}px` }}
          className={m.iqa > 80 ? 'a-esquerda' : ''}
        >
          <Link to={`/estacoes/${encodeURIComponent(m.id)}`}>
            <strong style={{ color: corIqa(m.iqa) }}>{numero(m.iqa, 0)}</strong> {m.nome}
          </Link>
          {m.anterior != null && <Variacao atual={m.iqa} anterior={m.anterior} />}
        </li>
      ))}
    </ol>
  );
}

function Variacao({ atual, anterior }: { atual: number; anterior: number }) {
  const d = atual - anterior;
  if (Math.abs(d) < 1) return <small>estável em 30 dias</small>;
  return <small>{d > 0 ? 'subiu' : 'caiu'} {numero(Math.abs(d), 0)} em 30 dias</small>;
}
