import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { expect, it, vi } from 'vitest';
import { api } from '../../api/recursos';
import { criarSerieSemSensores, estacaoSemLeituras } from '../../test/analiseParcial';
import { DetalheEstacao } from './DetalheEstacao';

it('apresenta a estação sem qualidade prevista nem gráficos inventados', async () => {
  vi.spyOn(api, 'estacoes').mockResolvedValue([estacaoSemLeituras]);
  vi.spyOn(api, 'serie').mockResolvedValue(criarSerieSemSensores());
  render(
    <MemoryRouter initialEntries={['/estacoes/rio-a']}>
      <Routes>
        <Route path="/estacoes/:id" element={<DetalheEstacao />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(await screen.findByRole('heading', { name: 'Rio A' })).toBeInTheDocument();
  expect(await screen.findByText(/Nenhum sensor com leituras disponível/)).toBeInTheDocument();
  expect(screen.getByText('Qualidade prevista: Ainda não calculada')).toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
