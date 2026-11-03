import { describe, expect, it, vi } from 'vitest';
import { data, hoje, nomeParametro, numero, percentual } from './formatacao';
describe('formatação em português', () => {
  it('formata decimais, milhares e zero', () => {
    expect(numero(1234.56)).toBe('1.234,6');
    expect(numero(0)).toBe('0');
    expect(numero(-1.234, 2)).toBe('-1,23');
  });
  it('diferencia ausência de zero e protege valores não finitos', () => {
    expect(numero(null)).toBe('—');
    expect(numero(undefined)).toBe('—');
    expect(numero(NaN)).toBe('—');
    expect(numero(Infinity)).toBe('—');
  });
  it('converte frações do ML em porcentagens', () => {
    expect(percentual(0.913)).toBe('91,3%');
    expect(percentual(0)).toBe('0%');
    expect(percentual(null)).toBe('—');
  });
  it('preserva datas sem hora no calendário local', () => {
    expect(data('2026-01-01')).toBe('01/01/2026');
    expect(data('2026-11-02')).toBe('02/11/2026');
  });
  it('formata horários ISO e trata datas ausentes ou inválidas', () => {
    expect(data('2026-11-02T12:00:00Z')).toBe('02/11/2026');
    expect(data(null)).toBe('—');
    expect(data('inválida')).toBe('—');
  });
  it('produz a data local usada pelos formulários', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 2, 23, 30));
    expect(hoje()).toBe('2026-11-02');
    vi.useRealTimers();
  });
  it('traduz parâmetros conhecidos sem ocultar chaves futuras', () => {
    expect(nomeParametro('doMgl')).toBe('Oxigênio dissolvido');
    expect(nomeParametro('novoParametro')).toBe('novoParametro');
  });
});
