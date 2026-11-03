import { data, numero } from './formatacao';
interface Props {
  titulo: string;
  datas: string[];
  valores: (number | null)[];
  anomalias?: boolean[];
  unidade?: string;
  limite?: [number, number];
}
export function GraficoSerie({
  titulo,
  datas,
  valores,
  anomalias = [],
  unidade = '',
  limite,
}: Props) {
  const validos = valores.filter((v): v is number => v !== null && Number.isFinite(v));
  if (!validos.length)
    return <p className="texto-apoio">Não há valores de {titulo.toLowerCase()} neste período.</p>;
  const min = limite?.[0] ?? Math.min(...validos);
  const max = limite?.[1] ?? Math.max(...validos);
  const amplitude = max - min || 1;
  const x = (i: number) => 56 + (i / Math.max(1, datas.length - 1)) * 634;
  const y = (v: number) => 186 - ((v - min) / amplitude) * 154;
  let caminho = '';
  let conectado = false;
  valores.forEach((v, i) => {
    if (v === null || !Number.isFinite(v)) {
      conectado = false;
      return;
    }
    caminho += `${conectado ? 'L' : 'M'} ${x(i)} ${y(v)} `;
    conectado = true;
  });
  return (
    <div className="grafico">
      <svg
        viewBox="0 0 720 228"
        role="img"
        aria-label={`${titulo}. ${datas.length} dias. Dias anômalos aparecem com um losango. Valores disponíveis na tabela abaixo.`}
      >
        {[min, min + amplitude / 2, max].map((v, i) => (
          <g key={i}>
            <line x1="56" x2="690" y1={y(v)} y2={y(v)} className="grade-grafico" />
            <text x="46" y={y(v) + 4} textAnchor="end">
              {numero(v)}
            </text>
          </g>
        ))}
        <path d={caminho} fill="none" stroke="var(--verde)" strokeWidth="2.5" />
        {valores.map((v, i) =>
          v === null || !Number.isFinite(v) ? null : anomalias[i] ? (
            <path key={i} d={`M ${x(i)} ${y(v) - 6} l 6 6 l -6 6 l -6 -6 z`} fill="var(--critico)">
              <title>
                {data(datas[i])}: {numero(v)} {unidade}, dia anômalo
              </title>
            </path>
          ) : (
            <circle key={i} cx={x(i)} cy={y(v)} r={datas.length < 90 ? 3 : 1.5} fill="var(--verde)">
              <title>
                {data(datas[i])}: {numero(v)} {unidade}
              </title>
            </circle>
          ),
        )}
        <text x="56" y="217">
          {data(datas[0])}
        </text>
        <text x="690" y="217" textAnchor="end">
          {data(datas.at(-1))}
        </text>
      </svg>
      <p className="legenda">
        Linha verde: {titulo.toLowerCase()}
        {unidade && ` (${unidade})`}. ◆ Losango vermelho: dia fora do padrão.
      </p>
      <details>
        <summary>Ver valores em tabela</summary>
        <div className="tabela-rolagem tabela-grafico">
          <table>
            <caption>
              {titulo}
              {unidade && ` (${unidade})`}
            </caption>
            <thead>
              <tr>
                <th>Data</th>
                <th>Valor</th>
                <th>Observação</th>
              </tr>
            </thead>
            <tbody>
              {datas.map((d, i) => (
                <tr key={d}>
                  <td>{data(d)}</td>
                  <td>{numero(valores[i])}</td>
                  <td>{anomalias[i] ? 'Dia fora do padrão' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
