import { describe, expect, it } from 'vitest';
import { emBlocos, partesNegrito, separarGraficos } from './resposta';

describe('resposta da Limno', () => {
  it('separa os marcadores de gráfico do texto', () => {
    const r = separarGraficos('A estação piorou.\n[[grafico estacao=RIO-02 parametro=iqa]]\n[[grafico estacao=RIO-02 parametro=coliformsNmp]]');
    expect(r.texto).toBe('A estação piorou.');
    expect(r.graficos).toEqual([
      { estacao: 'RIO-02', parametro: 'iqa' },
      { estacao: 'RIO-02', parametro: 'coliformsNmp' },
    ]);
  });

  it('ignora parâmetros desconhecidos, repetidos e mais de dois gráficos', () => {
    const r = separarGraficos(
      '[[grafico estacao=A parametro=xyz]][[grafico estacao=A parametro=iqa]][[grafico estacao=A parametro=iqa]][[grafico estacao=B parametro=ph]][[grafico estacao=C parametro=ph]]',
    );
    expect(r.graficos.map((g) => g.estacao)).toEqual(['A', 'B']);
    expect(r.texto).toBe('');
  });

  it('transforma linhas em parágrafos e listas', () => {
    expect(emBlocos('Resumo\n- um\n- dois\n\nFim')).toEqual([
      { tipo: 'paragrafo', texto: 'Resumo' },
      { tipo: 'lista', itens: ['um', 'dois'] },
      { tipo: 'paragrafo', texto: 'Fim' },
    ]);
  });

  it('marca o negrito', () => {
    expect(partesNegrito('IQA **61** hoje')).toEqual([
      { texto: 'IQA ', negrito: false },
      { texto: '61', negrito: true },
      { texto: ' hoje', negrito: false },
    ]);
  });
});
