import { data, numero } from '../formatacao';
import { corIqa, faixasIqa } from './iqa';

const L = 300;
const A = 96;

export function SerieMiniatura({
  titulo,
  pontos,
  faixas = true,
  minimo = 0,
  maximo = 100,
  unidade = '',
}: {
  titulo: string;
  pontos: { data: string; valor: number }[];
  faixas?: boolean;
  minimo?: number;
  maximo?: number;
  unidade?: string;
}) {
  if (pontos.length < 2) return <p className="texto-apoio">Sem dados suficientes para {titulo}.</p>;
  const amplitude = maximo - minimo || 1;
  const x = (i: number) => (i / (pontos.length - 1)) * L;
  const y = (v: number) => A - ((Math.min(maximo, Math.max(minimo, v)) - minimo) / amplitude) * A;
  const linha = pontos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.valor).toFixed(1)}`).join(' ');
  const ultimo = pontos[pontos.length - 1];
  return (
    <svg
      className="serie-miniatura"
      viewBox={`-2 -4 ${L + 8} ${A + 8}`}
      role="img"
      aria-label={`${titulo}: de ${data(pontos[0].data)} a ${data(ultimo.data)}, último valor ${numero(ultimo.valor)} ${unidade}`}
    >
      {faixas &&
        faixasIqa.map((f) => (
          <rect key={f.classe} x="0" width={L} y={y(f.ate)} height={y(f.de) - y(f.ate)} fill={f.cor} opacity="0.12" />
        ))}
      <path d={linha} fill="none" stroke="var(--leito)" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx={x(pontos.length - 1)} cy={y(ultimo.valor)} r="4" fill={faixas ? corIqa(ultimo.valor) : 'var(--correnteza)'} stroke="var(--margem)" strokeWidth="1.5" />
    </svg>
  );
}
