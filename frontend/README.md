<!-- Explica como executar e onde encontrar cada responsabilidade do frontend. -->

# AquaML — frontend

React 19, TypeScript, Vite e React Router. Interface em português, CSS próprio e gráficos SVG acessíveis. Não inclui dados de demonstração.

Requer Node.js 22.12+ e o backend Java na porta 8080.

```bash
npm install
npm run dev
```

Abra http://localhost:5173. O Vite encaminha `/api` para `http://localhost:8080`. Use uma conta criada pelo administrador; não há cadastro público.

```bash
npm run build   # verifica TypeScript e gera dist/
npm test        # cliente HTTP, proteção de rotas e formatação
```

- `src/api/`: tipos do [contrato](../docs/CONTRATO-API.md), cliente HTTP único, rotas e hooks de consulta/ação.
- `src/auth/`: sessão, restauração via `/auth/me` e guardas por papel.
- `src/features/`: uma pasta para cada área de negócio, com página e componentes específicos.
- `src/components/`: layout, gráficos, feedback, confirmação e formatação compartilhados.
- `src/styles/`: tokens, base, layout responsivo e estilos das funcionalidades.
- `src/test/`: configuração comum dos testes; testes ficam ao lado do código.

O JWT fica em `localStorage` e segue no cabeçalho das requisições. Um 401 de uma rota protegida limpa a sessão e leva ao login. Arquivos de imagem usam `fileUrl?token=...`, restritos à API de mesma origem. O servidor é a autoridade das permissões; como o contrato identifica autores de imagens/anotações somente pelo nome, a interface usa esse nome para apresentar a exclusão ao provável dono e respeita eventuais respostas 403.

Imagens podem levar de 10 a 40 segundos para serem lidas. A interface mostra a espera e exige revisão antes da confirmação. O assistente exibe o modelo fixo retornado pelo backend. O IQA e os resultados de ML dependem das leituras de sensores; não são inferidos localmente a partir de fotos.

Em produção, sirva `dist/` com fallback de rotas para `index.html` e encaminhe `/api` ao backend na mesma origem. O proxy descrito no Vite vale para desenvolvimento.
