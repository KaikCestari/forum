// Cobre etapas puladas, acurácia ausente, episódios incompletos e significado dos grupos.
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { criarAnaliseParcial } from '../../test/analiseParcial';
import { Anomalias } from './Anomalias';
import { Classificacao } from './Classificacao';
import { Grupos } from './Grupos';

const etapas = [
  {
    Componente: Anomalias,
    chave: 'anomalies',
    vazio: 'Nenhum episódio fora do padrão foi identificado.',
  },
  {
    Componente: Classificacao,
    chave: 'classification',
    vazio: 'Ainda não há classificações disponíveis.',
  },
  { Componente: Grupos, chave: 'clusters', vazio: 'Ainda não há grupos definidos.' },
] as const;

describe('etapas do ML', () => {
  it.each(etapas)(
    'explica a etapa $chave não executada sem sugerir um resultado vazio',
    ({ Componente, chave, vazio }) => {
      const analise = criarAnaliseParcial();
      analise[chave].method = 'não executado: poucos dias válidos';
      render(<Componente analise={analise} nomes={{}} />);
      expect(
        screen.getByText(/Ainda não há dados suficientes para esta etapa/),
      ).toBeInTheDocument();
      expect(screen.getByText('poucos dias válidos')).toBeInTheDocument();
      expect(screen.queryByText(vazio)).not.toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(screen.queryByText('de acertos na avaliação (acurácia)')).not.toBeInTheDocument();
    },
  );

  it.each(etapas)(
    'mantém a mensagem sem resultados quando $chave foi executada',
    ({ Componente, vazio }) => {
      render(<Componente analise={criarAnaliseParcial()} nomes={{}} />);
      expect(screen.getByText(vazio)).toBeInTheDocument();
      expect(
        screen.queryByText(/Ainda não há dados suficientes para esta etapa/),
      ).not.toBeInTheDocument();
    },
  );

  it('reconhece o prefixo não executado mesmo com espaços e maiúsculas', () => {
    const analise = criarAnaliseParcial();
    analise.classification.method = '  Não executado: amostras insuficientes';
    render(<Classificacao analise={analise} nomes={{}} />);
    expect(screen.getByText(/Esta etapa não foi realizada/)).toBeInTheDocument();
  });

  it('não apresenta acurácia null como zero e preserva uma acurácia de 0%', () => {
    const analise = criarAnaliseParcial();
    const { rerender } = render(<Classificacao analise={analise} nomes={{}} />);
    expect(
      screen.getByText('A taxa de acerto ainda não está disponível para esta análise.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    analise.classification.accuracy = 0;
    rerender(<Classificacao analise={analise} nomes={{}} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('renderiza um episódio com maxScore null sem perder data e parâmetros', () => {
    const analise = criarAnaliseParcial();
    analise.anomalies.episodes = [
      {
        stationId: 'rio-a',
        start: '2026-11-01',
        end: '2026-11-03',
        days: 3,
        maxScore: null,
        parameters: ['doMgl'],
      },
    ];
    render(
      <MemoryRouter>
        <Anomalias analise={analise} nomes={{ 'rio-a': 'Rio A' }} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Rio A')).toBeInTheDocument();
    expect(screen.getByText('01/11/2026 a 03/11/2026, 3 dia(s)')).toBeInTheDocument();
    expect(screen.getByText('Parâmetros: Oxigênio dissolvido')).toBeInTheDocument();
  });

  it('usa o rótulo retornado pelo ML para o grupo zero no gráfico, tabela e perfil', () => {
    const analise = criarAnaliseParcial();
    analise.clusters.points = [{ stationId: 'rio-a', date: '2026-11-01', x: 0, y: 0, cluster: 0 }];
    analise.clusters.profiles = [
      { cluster: 1, label: 'Água oxigenada', size: 1, means: {} },
      { cluster: 0, label: 'Água com muitos nutrientes', size: 1, means: { doMgl: null } },
    ];
    const { container, rerender } = render(
      <Grupos analise={analise} nomes={{ 'rio-a': 'Rio A' }} />,
    );
    expect(screen.getByRole('heading', { name: 'Água com muitos nutrientes' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('table', { hidden: true })).getByText(
        'Água com muitos nutrientes (grupo 0)',
      ),
    ).toBeInTheDocument();
    expect(container.querySelector('svg title')).toHaveTextContent(
      'Água com muitos nutrientes (grupo 0)',
    );
    analise.clusters.profiles[1].label = 'Perfil atualizado pelo ML';
    rerender(<Grupos analise={analise} nomes={{}} />);
    expect(container.querySelector('svg title')).toHaveTextContent(
      'Perfil atualizado pelo ML (grupo 0)',
    );
    expect(
      screen.queryByRole('heading', { name: 'Água com muitos nutrientes' }),
    ).not.toBeInTheDocument();
  });
});
