import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { criarAnaliseExtensa } from '../../test/analiseExtensa';
import { ExplorarAnalise } from './ExplorarAnalise';

function montar() {
  return render(
    <MemoryRouter>
      <ExplorarAnalise analise={criarAnaliseExtensa()} />
    </MemoryRouter>,
  );
}
const painel = () => screen.getByRole('tabpanel');
const abrir = (nome: string) => fireEvent.click(screen.getByRole('tab', { name: nome }));

describe('exploração de análises extensas', () => {
  it('monta somente a seção ativa e revela alertas em blocos de dez', () => {
    montar();
    expect(screen.getByRole('tab', { name: 'Alertas' })).toHaveAttribute('aria-selected', 'true');
    expect(within(painel()).getAllByRole('listitem')).toHaveLength(10);
    expect(screen.getByText('Mostrando 10 de 157 registros.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Dias fora do padrão' })).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar mais' }));
    expect(within(painel()).getAllByRole('listitem')).toHaveLength(20);
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar menos' }));
    expect(within(painel()).getAllByRole('listitem')).toHaveLength(10);
    fireEvent.change(screen.getByLabelText('Gravidade'), { target: { value: 'critico' } });
    expect(screen.getByText('Mostrando 10 de 78 registros.')).toBeInTheDocument();
    expect(within(painel()).queryByText('Alerta 1', { exact: true })).not.toBeInTheDocument();
  });

  it('limita episódios a dez, preserva o filtro global e reinicia o limite ao trocar estação', () => {
    montar();
    abrir('Anomalias');
    expect(screen.getByText('Mostrando 10 de 91 registros.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar mais' }));
    expect(within(painel()).getAllByRole('listitem')).toHaveLength(20);
    fireEvent.change(screen.getByLabelText('Filtrar por estação'), {
      target: { value: 'estacao-1' },
    });
    expect(screen.getByText('Mostrando 10 de 16 registros.')).toBeInTheDocument();
    expect(within(painel()).queryByText('Estação 2')).not.toBeInTheDocument();
    abrir('Classificação');
    expect(screen.getByLabelText('Filtrar por estação')).toHaveValue('estacao-1');
    expect(within(painel()).getAllByRole('listitem')).toHaveLength(1);
    expect(within(painel()).getByText('Estação 1')).toBeInTheDocument();
    abrir('Alertas');
    expect(screen.getByText('Mostrando 10 de 27 registros.')).toBeInTheDocument();
  });

  it('oculta estáveis por padrão e combina direção com o filtro de estação', () => {
    montar();
    abrir('Tendências');
    expect(screen.getByLabelText('Tendências exibidas')).toHaveValue('mudancas');
    expect(screen.queryByText('Estável', { exact: true })).not.toBeInTheDocument();
    expect(screen.getByText('Mostrando 10 de 24 registros.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar mais' }));
    expect(within(painel()).getAllByRole('listitem')).toHaveLength(20);
    fireEvent.change(screen.getByLabelText('Tendências exibidas'), {
      target: { value: 'estavel' },
    });
    expect(screen.getByText('Mostrando 10 de 12 registros.')).toBeInTheDocument();
    expect(screen.getAllByText('Estável', { exact: true })).toHaveLength(10);
    fireEvent.change(screen.getByLabelText('Filtrar por estação'), {
      target: { value: 'estacao-3' },
    });
    expect(screen.getByText(/Nenhuma tendência corresponde ao filtro/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Tendências exibidas'), { target: { value: 'todas' } });
    expect(screen.getAllByText('Estável', { exact: true })).toHaveLength(6);
  });

  it('desenha 4340 pontos discretos com legenda e limita as linhas da tabela', () => {
    const { container } = montar();
    abrir('Grupos');
    const pontos = container.querySelectorAll('svg circle');
    expect(pontos).toHaveLength(4340);
    expect(pontos[0]).toHaveAttribute('r', '2');
    expect(pontos[0]).toHaveAttribute('fill-opacity', '0.4');
    expect(container.querySelectorAll('svg text')).toHaveLength(1);
    expect(screen.getByRole('list', { name: 'Legenda dos grupos' })).toHaveTextContent(
      'Perfil 0 (grupo 0)',
    );
    const detalhes = screen.getByText('Ver pontos em tabela').closest('details')!;
    fireEvent.click(screen.getByText('Ver pontos em tabela'));
    expect(detalhes.querySelectorAll('tbody tr')).toHaveLength(10);
    fireEvent.click(within(detalhes).getByRole('button', { name: 'Mostrar mais' }));
    expect(detalhes.querySelectorAll('tbody tr')).toHaveLength(20);
    fireEvent.change(screen.getByLabelText('Filtrar por estação'), {
      target: { value: 'estacao-1' },
    });
    expect(container.querySelectorAll('svg circle')).toHaveLength(724);
    expect(container.querySelector('svg title')).toHaveTextContent('Estação 1');
    expect(screen.queryByRole('heading', { name: 'Perfil 1' })).not.toBeInTheDocument();
  });

  it('permite navegar nas abas pelo teclado e mantém somente um painel', () => {
    montar();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Alertas' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Anomalias' })).toHaveFocus();
    expect(painel()).toHaveAccessibleName('Anomalias');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Anomalias' }), { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Tendências' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Tendências' }), { key: 'Home' });
    expect(screen.getByRole('tab', { name: 'Alertas' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Alertas' }), { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Tendências' })).toHaveFocus();
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
  });
});
