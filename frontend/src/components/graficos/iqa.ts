export const faixasIqa = [
  { classe: 'Péssima', de: 0, ate: 20, cor: 'var(--iqa-pessima)' },
  { classe: 'Ruim', de: 20, ate: 37, cor: 'var(--iqa-ruim)' },
  { classe: 'Regular', de: 37, ate: 52, cor: 'var(--iqa-regular)' },
  { classe: 'Boa', de: 52, ate: 80, cor: 'var(--iqa-boa)' },
  { classe: 'Ótima', de: 80, ate: 100, cor: 'var(--iqa-otima)' },
] as const;

export function faixaDoIqa(valor: number) {
  return faixasIqa.find((f) => valor < f.ate) ?? faixasIqa[faixasIqa.length - 1];
}

export function corIqa(valor: number | null | undefined): string {
  return valor == null ? 'var(--sedimento)' : faixaDoIqa(valor).cor;
}

export function mediasSemanais(
  datas: string[],
  valores: (number | null)[],
  ultimosDias = 365,
): { data: string; valor: number }[] {
  const inicio = Math.max(0, datas.length - ultimosDias);
  const saida: { data: string; valor: number }[] = [];
  for (let i = inicio; i < datas.length; i += 7) {
    const semana = valores.slice(i, i + 7).filter((v): v is number => v != null && Number.isFinite(v));
    if (semana.length) saida.push({ data: datas[i], valor: semana.reduce((a, b) => a + b, 0) / semana.length });
  }
  return saida;
}

export function valorDiasAntes(valores: (number | null)[], dias: number): number | null {
  for (let i = valores.length - 1 - dias; i >= 0; i--) {
    const v = valores[i];
    if (v != null && Number.isFinite(v)) return v;
  }
  return null;
}

export function pisoIqa(valores: number[]): number {
  if (!valores.length) return 0;
  return Math.max(0, Math.floor((Math.min(...valores) - 8) / 10) * 10);
}
