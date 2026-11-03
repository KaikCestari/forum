import type { Papel, TipoEstacao } from '../api/tipos';
export function numero(valor: number | null | undefined, casas = 1): string {
  return valor == null || !Number.isFinite(valor)
    ? '—'
    : valor.toLocaleString('pt-BR', { maximumFractionDigits: casas });
}
export function percentual(valor: number | null | undefined): string {
  return valor == null || !Number.isFinite(valor) ? '—' : `${numero(valor * 100)}%`;
}
export function data(valor: string | null | undefined): string {
  if (!valor) return '—';
  const instante = new Date(/^\d{4}-\d{2}-\d{2}$/.test(valor) ? `${valor}T12:00:00` : valor);
  return Number.isNaN(instante.getTime()) ? '—' : instante.toLocaleDateString('pt-BR');
}
export function hoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const nomePapel: Record<Papel, string> = {
  ADMIN: 'Administrador',
  FUNCIONARIO: 'Funcionário',
};
export const tiposEstacao: Record<TipoEstacao, string> = {
  rio: 'Rio',
  lago: 'Lago',
  reservatorio: 'Reservatório',
  estuario: 'Estuário',
};
export const parametros: Record<string, { label: string; unit: string }> = {
  ph: { label: 'pH', unit: '' },
  doMgl: { label: 'Oxigênio dissolvido', unit: 'mg/L' },
  tempC: { label: 'Temperatura', unit: '°C' },
  turbidityNtu: { label: 'Turbidez', unit: 'NTU' },
  conductivityUscm: { label: 'Condutividade', unit: 'µS/cm' },
  nitrateMgl: { label: 'Nitrato', unit: 'mg/L' },
  phosphorusMgl: { label: 'Fósforo', unit: 'mg/L' },
  coliformsNmp: { label: 'Coliformes', unit: 'NMP/100 mL' },
};
export function nomeParametro(chave: string) {
  return parametros[chave]?.label ?? chave;
}
