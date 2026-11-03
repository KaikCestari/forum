// Garante que ausência de medição não vire zero nem uma linha que atravesse lacunas.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GraficoSerie } from './GraficoSerie';

const datas = ['2026-11-01', '2026-11-02', '2026-11-03'];
describe('gráfico com leituras ausentes', () => {
  it('não desenha SVG para uma série inteira null', () => {
    render(<GraficoSerie titulo="IQA" datas={datas} valores={[null, null, null]} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Não há valores de iqa neste período.')).toBeInTheDocument();
  });

  it('interrompe a linha na lacuna, mantém zero e não marca anomalia sem valor', () => {
    const { container } = render(
      <GraficoSerie
        titulo="IQA"
        datas={datas}
        valores={[0, null, 60]}
        anomalias={[false, true, false]}
      />,
    );
    const linha = container.querySelector('path[stroke]')?.getAttribute('d');
    expect(linha?.match(/M/g)).toHaveLength(2);
    expect(linha).not.toContain('L');
    expect(container.querySelectorAll('circle')).toHaveLength(2);
    expect(container.querySelectorAll('path[fill="var(--critico)"]')).toHaveLength(0);
    const linhas = container.querySelectorAll('tbody tr');
    expect(linhas[0].children[1]).toHaveTextContent('0');
    expect(linhas[1].children[1]).toHaveTextContent('—');
  });
});
