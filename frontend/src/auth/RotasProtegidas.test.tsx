import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { useAuth } from './AuthContext';
import { GuardaPapel, RotaProtegida } from './RotasProtegidas';
import type { Papel } from '../api/tipos';
vi.mock('./AuthContext', () => ({ useAuth: vi.fn() }));
const mockAuth = vi.mocked(useAuth);
function autenticar(papel: Papel | null, carregando = false, erro: Error | null = null) {
  mockAuth.mockReturnValue({
    usuario: papel
      ? { id: 1, name: 'Ana', email: 'ana@aquaml.local', role: papel, active: true }
      : null,
    carregando,
    erro,
    expirada: false,
    entrar: vi.fn(),
    sair: vi.fn(),
    tentar: vi.fn(),
  });
}
function montar() {
  render(
    <MemoryRouter initialEntries={['/dados']}>
      <Routes>
        <Route path="/login" element={<p>Tela de login</p>} />
        <Route element={<RotaProtegida />}>
          <Route element={<GuardaPapel papel="ADMIN" />}>
            <Route path="/dados" element={<p>Importação administrativa</p>} />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}
describe('proteção de rotas', () => {
  it('permite que ADMIN acesse Dados', () => {
    autenticar('ADMIN');
    montar();
    expect(screen.getByText('Importação administrativa')).toBeInTheDocument();
  });
  it('mostra sem permissão ao FUNCIONARIO que tenta abrir a URL diretamente', () => {
    autenticar('FUNCIONARIO');
    montar();
    expect(screen.getByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument();
    expect(screen.queryByText('Importação administrativa')).not.toBeInTheDocument();
  });
  it('redireciona uma sessão ausente para o login', () => {
    autenticar(null);
    montar();
    expect(screen.getByText('Tela de login')).toBeInTheDocument();
  });
  it('aguarda a restauração da sessão antes de renderizar conteúdo protegido', () => {
    autenticar(null, true);
    montar();
    expect(screen.getByRole('status')).toHaveTextContent('Verificando sua sessão');
    expect(screen.queryByText('Tela de login')).not.toBeInTheDocument();
  });
  it('permite tentar novamente após falha na restauração da sessão', () => {
    autenticar(null, false, new Error('Servidor indisponível'));
    montar();
    expect(screen.getByRole('alert')).toHaveTextContent('Servidor indisponível');
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });
});
