# Testes da API no Postman

1. No Postman: **Import** → arraste `AquaML.postman_collection.json` e `AquaML-local.postman_environment.json`.
2. No canto superior direito, escolha o ambiente **AquaML local**.
3. Com a API rodando (`make ml` e `make backend`), rode as pastas em ordem, ou a coleção inteira com
   **Run collection** (deixe a pasta 11 desmarcada).

| Pasta | O que mostra |
|---|---|
| 1. Login (JWT) | Login do ADMIN; o token é salvo sozinho em `{{token}}`. Também mostra o 401 sem token e com senha errada |
| 2. Usuários | ADMIN cria a funcionária `ana@aquaml.local` (senha `segredo1`) |
| 3 a 5 | Painel, estações, série, análise de ML, alertas e nova execução da análise |
| 6. Imagens | Envia a foto do Encontro das Águas e o satélite do Rio Doce; a IA lê em 10 a 40 s; confirma a leitura |
| 7. Anotações | Cria e lista anotações de campo |
| 8. Limno IA | Perguntas para a IA especialista (precisa do Ollama) |
| 9. Permissões | Entra como FUNCIONARIO e recebe 403 nas rotas de ADMIN |
| 10. Limpeza | Apaga a anotação e as imagens criadas nos testes |
| 11. ⚠ Admin | Importa a planilha de exemplo (arquivos em `dados/`) ou apaga todos os dados. Só de propósito |

Os arquivos de upload apontam para caminhos desta máquina (`/home/kaikdev/orca/forum/...`). Em outro
computador, escolha os arquivos de novo no campo **Body → form-data** de cada requisição.

## Sem conta no Postman: pelo terminal
O Postman CLI roda a coleção sem login:
```bash
cd ~/orca/forum/docs/postman
./rodar-testes.sh             # tudo, menos a pasta 11
./rodar-testes.sh permissoes  # login, cria a funcionária e mostra os 403
./rodar-testes.sh login       # só o login
```
