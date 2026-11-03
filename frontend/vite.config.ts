// Configura o React, o proxy da API Java e os testes do frontend.
// AQUAML_API e WEB_PORT permitem trocar as portas quando 8080/5173 já estão ocupadas.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const api = process.env.AQUAML_API ?? 'http://localhost:8080';
const port = Number(process.env.WEB_PORT ?? 5173);

export default defineConfig({
  plugins: [react()],
  server: { port, strictPort: true, proxy: { '/api': api } },
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], clearMocks: true },
});
