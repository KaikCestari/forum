// Verifica sensores ausentes, seleção de leituras válidas e preservação de lacunas no gráfico.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { criarSerieSemSensores } from '../../test/analiseParcial';
import { ParametrosEstacao } from './ParametrosEstacao';

describe('parâmetros da estação', () => {
  it('não oferece nem desenha sensores com todas as leituras null', () => {
    render(<ParametrosEstacao serie={criarSerieSemSensores()} />);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText(/Nenhum sensor com leituras disponível/)).toBeInTheDocument();
  });

  it('seleciona o primeiro sensor disponível mesmo que os anteriores estejam ausentes', () => {
    const serie = criarSerieSemSensores();
    serie.params.doMgl = [null, 0, null];
    render(<ParametrosEstacao serie={serie} />);
    expect(screen.getByRole('combobox')).toHaveValue('doMgl');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.queryByRole('option', { name: 'pH' })).not.toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAccessibleName(/Oxigênio dissolvido/);
  });

  it('troca de sensor e recupera uma seleção válida quando o sensor anterior fica ausente', () => {
    const serie = criarSerieSemSensores();
    serie.params.ph = [7, null, 7.2];
    serie.params.tempC = [20, 21, 22];
    const { rerender } = render(<ParametrosEstacao serie={serie} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'tempC' } });
    expect(screen.getByRole('img')).toHaveAccessibleName(/Temperatura/);
    serie.params.tempC = [null, null, null];
    rerender(<ParametrosEstacao serie={serie} />);
    expect(screen.getByRole('combobox')).toHaveValue('ph');
    expect(screen.getByRole('img')).toHaveAccessibleName(/pH/);
  });
});
