# Swagger da API AquaML

Todas as 29 rotas estão documentadas: o que cada uma faz, qual papel ela exige, os corpos de requisição
**já preenchidos com mocks** e exemplos reais de resposta (sucesso e erro). Os mocks foram copiados de
chamadas reais à API com a planilha de exemplo importada e ficam em
`backend/src/main/java/br/forum/aquaml/shared/docs/ApiExamples.java`.

## Testar pelo navegador

1. Suba o serviço de ML e a API: `make ml` e `make backend`.
2. Abra <http://localhost:8080/swagger-ui.html>.
3. **1. Login → POST /api/auth/login → Try it out → Execute**. O corpo do ADMIN já vem preenchido.
4. Copie o `token` da resposta, clique no cadeado **Authorize** e cole (só o token, sem `Bearer`).
   O token continua salvo se você recarregar a página.
5. Teste qualquer rota. Onde houver mais de um mock, escolha no menu **Examples**
   (ex.: login ADMIN / FUNCIONARIO / senha errada).

Num sistema vazio, comece por **4. Dados → POST /api/data/import** com os arquivos de
`docs/postman/dados/` (leituras.csv, estacoes.csv, eventos.csv). Para imagens, use as fotos de
`frontend/public/exemplos/`.

| Mock | Onde |
|---|---|
| Login ADMIN `admin@aquaml.local` / `admin123` | POST /api/auth/login |
| Funcionária `ana@aquaml.local` / `segredo1` (crie antes) | POST /api/users → exemplo FUNCIONARIO |
| Estação `RIO-04` com código ou só pelo nome | POST /api/stations |
| Anotação de observação ou de coleta | POST /api/notes |
| Confirmar imagem com correções ou "aceitar como está" (`{}`) | POST /api/images/{id}/confirm |
| Pergunta ao Limno, inclusive pedindo gráfico | POST /api/assistant/ask |

## Importar no Postman ou Insomnia

`openapi.json` (nesta pasta) é a especificação completa com os mocks. No Postman: **Import** → arraste
o arquivo; cada rota vira uma requisição com o corpo de exemplo. Ela aponta para `http://localhost:8080`.

Depois de mudar alguma rota, gere o arquivo de novo com o backend rodando:

```bash
make openapi                                   # backend na 8080
make openapi AQUAML_API=http://localhost:8088  # backend em outra porta
```

A especificação ao vivo fica em <http://localhost:8080/v3/api-docs>.
