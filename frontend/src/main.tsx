// Inicializa o React e os estilos globais do AquaML.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/funcionalidades.css';
import './styles/graficos.css';
import './styles/limno.css';
import './styles/tema.css';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
