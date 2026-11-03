import { BrowserRouter, Link, Route, Routes } from 'react-router';
import { AuthProvider } from './auth/AuthContext';
import { GuardaPapel, RotaProtegida } from './auth/RotasProtegidas';
import { Layout } from './components/Layout';
import { Pagina } from './components/Pagina';
import { Login } from './features/login/Login';
import { Painel } from './features/painel/Painel';
import { Estacoes } from './features/estacoes/Estacoes';
import { DetalheEstacao } from './features/estacoes/DetalheEstacao';
import { Imagens } from './features/imagens/Imagens';
import { Analises } from './features/analises/Analises';
import { Anotacoes } from './features/anotacoes/Anotacoes';
import { Assistente } from './features/assistente/Assistente';
import { Dados } from './features/dados/Dados';
import { Usuarios } from './features/usuarios/Usuarios';
export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RotaProtegida />}>
            <Route element={<Layout />}>
              <Route index element={<Painel />} />
              <Route path="estacoes" element={<Estacoes />} />
              <Route path="estacoes/:id" element={<DetalheEstacao />} />
              <Route path="imagens" element={<Imagens />} />
              <Route path="analises" element={<Analises />} />
              <Route path="anotacoes" element={<Anotacoes />} />
              <Route path="assistente" element={<Assistente />} />
              <Route element={<GuardaPapel papel="ADMIN" />}>
                <Route path="dados" element={<Dados />} />
                <Route path="usuarios" element={<Usuarios />} />
              </Route>
              <Route
                path="*"
                element={
                  <Pagina
                    titulo="Página não encontrada"
                    descricao="Este endereço não corresponde a uma área do AquaML."
                  >
                    <Link className="botao" to="/">
                      Voltar ao painel
                    </Link>
                  </Pagina>
                }
              />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
