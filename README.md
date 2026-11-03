# AquaML: algoritmos e machine learning no estudo de ecossistemas aquáticos

Painel para **biólogos e técnicos ambientais** acompanharem rios, lagos, reservatórios e estuários.
Os dados entram por **imagens** (foto da água ou satélite, lidas por um modelo com visão e conferidas
pelo biólogo) e por **planilhas de sensores** (opcional). O sistema calcula o IQA, procura dias fora
do padrão, classifica a qualidade da água, agrupa perfis parecidos, mede tendências e gera alertas.
Um assistente (Ollama, modelo fixo no `.env`) responde perguntas com base nesses resultados.

| Parte | Tecnologia | Pasta | Porta |
|---|---|---|---|
| Frontend | React + TypeScript + Vite (feito com o Codex) | `frontend/` | 5173 |
| Backend | Java 21 + Spring Boot, arquitetura **DDD**, Spring Security com **JWT** | `backend/` | 8080 |
| Serviço de ML | Python + FastAPI + scikit-learn + pandas | `ml-service/` | 8000 |
| Banco | H2 em arquivo (`data/db/`) | — | — |
| IA generativa | Ollama (local ou nuvem): assistente e leitura de imagens | — | — |

```
Navegador ──/api──► Backend Spring ──HTTP──► Serviço ML Python
                        │
                        ├──► H2
                        └──► Ollama
```

## Documentação
- [`docs/CONTRATO-API.md`](docs/CONTRATO-API.md): todas as rotas, JSON e permissões (a fonte da verdade entre as partes)
- [`docs/MAPA-MENTAL.md`](docs/MAPA-MENTAL.md): mapa mental do sistema
- [`docs/DIAGRAMA-CLASSES.md`](docs/DIAGRAMA-CLASSES.md): diagrama de classes (domínio, camadas DDD e módulos Python)
- READMEs de cada parte: [`backend/`](backend/README.md), [`ml-service/`](ml-service/README.md), [`frontend/`](frontend/README.md)

## Papéis (JWT)
- **ADMIN**: tudo, mais importar planilhas, apagar dados, rodar a análise, criar estações e gerenciar usuários.
- **FUNCIONARIO**: consulta painel, estações e análises; envia e confere imagens; escreve anotações; usa o assistente.

Não há cadastro público. No primeiro início o backend cria o administrador definido em
`ADMIN_EMAIL` / `ADMIN_PASSWORD` (padrão `admin@aquaml.local` / `admin123`, **troque em produção**),
e ele cria as contas dos funcionários.

## Como rodar
Requisitos: Java 21, Maven, Python 3.11+, Node 20+.

```bash
cp .env.example .env     # preencha OLLAMA_URL / OLLAMA_API_KEY / LLAMA_MODEL / VISION_MODEL / JWT_SECRET
make setup
make ml          # terminal 1
make backend     # terminal 2
make frontend    # terminal 3 → http://localhost:5173
make test        # testes das três partes
```

Portas ocupadas? `PORT=8089` no backend, `AQUAML_API=http://localhost:8089 WEB_PORT=5180` no frontend e
`AQUAML_CORS_ORIGINS=http://localhost:5180` no backend.

### Formato da planilha
`timestamp`, `station_id` e os parâmetros disponíveis (`ph`, `do_mgl`, `temp_c`, `turbidity_ntu`,
`conductivity_uscm`, `nitrate_mgl`, `phosphorus_mgl`, `coliforms_nmp`). Aceita o formato brasileiro
(`;`, vírgula decimal, `dd/mm/aaaa hh:mm`, cabeçalhos como "OD (mg/L)", `<0,02`). Um dia só entra na
análise com pelo menos 6 leituras, então use dados de sensores contínuos.

## Versão antiga
As pastas `app/` (Javalin), `processor/` (Rust), `web/` (React antigo) e `ml/` são da versão anterior e
foram substituídas por `backend/`, `ml-service/` e `frontend/`. Elas podem ser removidas com
`git rm -r app processor web ml`.
