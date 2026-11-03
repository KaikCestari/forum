# AquaML — backend (Java + Spring Boot)

Backend do AquaML, sistema que usa **algoritmos e machine learning no estudo de ecossistemas aquáticos**.
Ele guarda os dados (banco H2), controla o login (JWT), conversa com o serviço de machine learning em Python
e com o Ollama (assistente e modelo com visão). As rotas seguem exatamente `docs/CONTRATO-API.md`.

```
Navegador (5173) ──/api──► este backend (8080) ──HTTP──► serviço ML Python (8000)
                                  ├──► H2 em data/db/aquaml-spring.mv.db
                                  └──► Ollama (assistente + visão)
```

## Como rodar

Precisa de Java 21 e Maven.

```bash
cd backend
mvn -q test                      # roda os testes
mvn -q package                   # gera target/aquaml-backend.jar
java -jar target/aquaml-backend.jar
```

Rode sempre **de dentro da pasta `backend/`**: o `.env` (`../.env`), o banco (`../data/db`) e as imagens
(`../data/images`) são procurados a partir dela.

No primeiro início é criado o administrador `admin@aquaml.local` / `admin123` (ou o que estiver em
`ADMIN_EMAIL` / `ADMIN_PASSWORD`). Teste rápido:

```bash
curl -X POST localhost:8080/api/auth/login -H 'Content-Type: application/json' \
     -d '{"email":"admin@aquaml.local","password":"admin123"}'
```

### Configuração (`.env` na raiz do repositório ou variáveis de ambiente)

| Variável | Para quê | Padrão |
|---|---|---|
| `OLLAMA_URL`, `OLLAMA_API_KEY` | Ollama local ou Ollama Cloud (chave no cabeçalho Bearer) | `http://localhost:11434`, vazio |
| `LLAMA_MODEL`, `VISION_MODEL` | Modelo do assistente e modelo com visão | `llama3.2`, `gemma4:31b` |
| `JWT_SECRET` | Segredo do JWT (mín. 32 caracteres) | gerado no início (aviso no log) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Administrador do primeiro início | `admin@aquaml.local`, `admin123` |
| `ML_SERVICE_URL` | Serviço Python de machine learning | `http://localhost:8000` |
| `PORT` | Porta HTTP | `8080` |
| `AQUAML_DB_URL` | Endereço JDBC do banco | `jdbc:h2:file:../data/db/aquaml-spring` |
| `AQUAML_IMAGES_DIR` | Pasta das imagens enviadas | `../data/images` |

As variáveis de ambiente valem mais que o `.env`. Nenhum segredo é escrito no log.

## Como o código está organizado (DDD sem complicação)

DDD (Domain-Driven Design) é organizar o código pelo **assunto do negócio**, e não pela tecnologia.
Cada assunto é um **contexto** (uma pasta), e dentro dele há sempre as mesmas **quatro camadas**:

| Camada | O que tem | Pergunta que responde |
|---|---|---|
| `domain` | Entidades, objetos de valor, regras e as **interfaces** dos repositórios (portas) | "O que é isto e quais são as regras?" |
| `application` | Serviços com **um método por caso de uso** (importar planilha, confirmar imagem...) | "O que o sistema faz?" |
| `infrastructure` | Implementações técnicas: banco (Spring Data JPA), HTTP para Ollama e serviço ML, disco | "Como falar com o mundo de fora?" |
| `interfaces` | Controllers REST e os formatos JSON (DTOs, `record`s) | "Como a tela pede e recebe?" |

Regra de ouro: **as regras de negócio moram nas entidades**. Exemplos:

- `User.changeRole(...)` — ninguém tira o próprio papel de administrador.
- `WaterImage.confirm(...)` — as correções do biólogo vão por cima da leitura da IA e a imagem vira CONFIRMADA.
- `AnalysisRun.complete(...)` / `fail(...)` — uma execução nasce EXECUTANDO e termina CONCLUIDA ou FALHOU.
- `Iqa.classification()` — Ótima (≥80), Boa (≥52), Regular (≥37), Ruim (≥20), Péssima (<20).
- `FieldNote.checkCanBeDeletedBy(...)` — só o autor ou um ADMIN apaga a anotação.

**Portas e adaptadores**: o domínio declara uma interface (ex.: `MlServiceClient`, `VisionAnalyzer`,
`UserRepository`) e a infraestrutura a implementa (ex.: `HttpMlServiceClient`, `OllamaVisionAnalyzer`,
`JpaUserRepository`). Nos repositórios o adaptador é só uma interface que estende a porta do domínio; o
Spring Data gera o código. Nos testes, as portas externas são trocadas por dublês (Mockito).

Por praticidade, as entidades usam as anotações do JPA (`@Entity`) direto no domínio.

## Mapa de pacotes (`br.forum.aquaml`)

```
AquamlApplication            ponto de entrada
shared/                      o que todos usam
  domain/                    exceções → 400, 401, 403, 404, 503
  interfaces/                ApiError {status, error} e o tradutor global de erros
  config/                    SecurityConfig (tabela de permissões, CORS) e AppConfig
  ollama/                    cliente HTTP do Ollama (assistente e visão)
identity/                    usuários, papéis (ADMIN / FUNCIONARIO) e login
  domain/                    User, Role, UserRepository
  application/               AuthService, UserService, CurrentUser, TokenIssuer (porta)
  infrastructure/            JWT (JwtService, filtro), criação do admin, JpaUserRepository
  interfaces/                AuthController, UserController
monitoring/                  estações, leituras dos sensores, eventos, planilhas e anotações de campo
  domain/                    Station, StationType, Measurement, WaterParameters, MonitoringEvent, Dataset, FieldNote
  application/               DataImportService, CsvSpreadsheetParser, DataService, StationService, FieldNoteService
  infrastructure/            repositórios JPA
  interfaces/                DataController, StationController, FieldNoteController
analysis/                    machine learning: execuções, resultados e alertas
  domain/                    AnalysisRun, RunStatus, AnalysisResult, Alert, Iqa, MlServiceClient (porta)
  application/               AnalysisService
  infrastructure/            HttpMlServiceClient (POST /analyze no Python), repositórios JPA
  interfaces/                AnalysisController (/api/analysis e /api/alerts)
imagery/                     imagens da água (foto ou satélite)
  domain/                    WaterImage, ImageStatus, ColorIndicators, VisionReading, ImageCorrections,
                             VisionAnalyzer e ImageStorage (portas)
  application/               ImageService, PhotoProcessor (lê/reduz a imagem)
  infrastructure/            OllamaVisionAnalyzer, LocalImageStorage (data/images), repositório JPA
  interfaces/                ImageController
assistant/                   assistente com Ollama
  domain/                    ChatMessage, ChatMessageRepository
  application/               AssistantService, AssistantContextBuilder (monta o contexto)
  infrastructure/            repositório JPA
  interfaces/                AssistantController
dashboard/                   tela inicial: só junta dados dos outros contextos para leitura
```

## Fluxos principais

- **Importar planilha** (`POST /api/data/import`, ADMIN): `CsvSpreadsheetParser` lê o CSV no jeito brasileiro
  (`;`, vírgula decimal, `dd/mm/aaaa`, colunas como `OD (mg/L)`, `<0,02` vira metade do limite). As leituras e
  eventos antigos são trocados pelos novos numa transação, e em seguida a análise roda. Se o serviço de ML
  estiver fora, a importação vale do mesmo jeito e a análise volta com `status: FALHOU` e o motivo.
- **Rodar análise** (`POST /api/analysis/run`, ADMIN): envia estações, leituras e eventos ao Python
  (`POST /analyze`), guarda o JSON completo do resultado, o resumo (IQA médio, alertas, acurácia) e os alertas.
- **Enviar imagem** (`POST /api/images`): calcula indicadores de cor dos pixels e pede ao modelo com visão uma
  leitura. Se o Ollama não responder, a imagem é guardada com `ERRO_ANALISE` (ainda 201) para o biólogo
  preencher à mão ao confirmar.
- **Assistente** (`POST /api/assistant/ask`): monta o contexto (última análise, imagens confirmadas, anotações) e
  pergunta ao modelo fixo do `.env`. Ollama fora = 503.

## Testes

`mvn -q test` roda 31 testes (JUnit + MockMvc, banco H2 em memória, serviços externos mockados):
login e JWT, 401/403 da tabela de permissões, criação de usuários pelo ADMIN, leitura das planilhas,
regras da `WaterImage`, importação + análise com o serviço de ML mockado (sucesso e falha), envio/
confirmação de imagens e o assistente (incluindo 503).
