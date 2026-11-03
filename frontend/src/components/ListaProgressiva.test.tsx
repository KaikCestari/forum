import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { ListaProgressiva } from './ListaProgressiva';

it('mostra dez por vez e não perde o último registro de uma lista ímpar', () => {
  render(
    <ListaProgressiva itens={Array.from({ length: 21 }, (_, i) => i)}>
      {(itens) => (
        <ul>
          {itens.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </ListaProgressiva>,
  );
  expect(screen.getAllByRole('listitem')).toHaveLength(10);
  fireEvent.click(screen.getByRole('button', { name: 'Mostrar mais' }));
  fireEvent.click(screen.getByRole('button', { name: 'Mostrar mais' }));
  expect(screen.getAllByRole('listitem')).toHaveLength(21);
  expect(screen.getByRole('status')).toHaveTextContent('Mostrando 21 de 21 registros.');
  expect(screen.queryByRole('button', { name: 'Mostrar mais' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Mostrar menos' }));
  expect(screen.getAllByRole('listitem')).toHaveLength(10);
});
