# AquaML: análise de ecossistemas aquáticos com IA

Aplicação que usa **algoritmos e machine learning** para apoiar biólogos e técnicos no
monitoramento de ecossistemas aquáticos. Os dados entram por **imagens** (foto da água ou
imagem de satélite, lidas por uma IA com visão e conferidas pelo biólogo) ou por **planilhas
de sensores** (que geram o IQA, os gráficos, as tendências e os alertas). Não há dados de
demonstração embutidos: o painel começa vazio e orienta o primeiro uso.

| Linguagem | Papel | Onde |
|-----------|-------|------|
| **Java 21** | Estrutura principal: orquestra o pipeline, analisa imagens e expõe a API REST | `app/` |
| **React + Vite** | Painel web em português para biólogos: visão geral, imagens, estações, análises da IA, relatório, dados, assistente e guia | `web/` |
| **Rust** | Processamento de alto desempenho: limpeza, interpolação, agregação diária e cálculo do IQA | `processor/` |
| **Python** | IA/ML: detecção de anomalias, classificação, agrupamento, tendências e alertas | `ml/` |
| **H2** | Banco de dados: leituras de sensores, imagens e pontos, anotações de campo, histórico de análises, alertas, série diária e conversas | `data/db/` |
| **Ollama** (local ou nuvem) | Assistente que responde com base na análise, nas imagens confirmadas e nas anotações; modelo com visão que lê as imagens | `app/…/AssistantService.java`, `ImageService.java` |

## Arquitetura

```
                ┌──────────────────────────── Java 21 (Javalin) ────────────────────────────┐
                │  PipelineService ── ProcessBuilder ──┐   ApiRoutes /api/* ◄── painel React │
                │  Database (H2) ◄──── grava análise ──┼── ResultsRepository                 │
                │  AssistantService ── LlamaClient ────┼──────────────► Ollama (Llama 3.2)   │
                └──────────────────────────────────────┼─────────────────────────────────────┘
                                                       ▼
 CSV real (upload)  ┐
                    ├─► H2: leituras ──► measurements.csv ──► aqua-processor (Rust) ──► processed.csv ──► analyze.py ──► results.json ──► H2
 generate_data.py   ┘     estações         (exportado)          validação, lacunas,                         Isolation Forest              histórico,
   (sintético)            eventos                               médias móveis, IQA                          Random Forest                 alertas,
                                                                                                            K-Means + PCA                 série diária
                                                                                                            Mann-Kendall sazonal
```

### Banco de dados (H2)
O H2 roda embutido no Java, gravando em `data/db/aquaml.mv.db`, e é a fonte da verdade:
cada execução exporta as leituras do banco para o Rust e grava o resultado de volta.

| Tabela | Conteúdo |
|--------|----------|
| `auth_users`, `auth_sessions` | Contas, hashes de senha e sessões com expiração; o token da sessão também é armazenado como hash |
| `dataset` | Conjunto atual: origem (`real` ou `sintetico`), nome e data da importação |
| `stations`, `measurements`, `events` | Estações, leituras horárias e eventos conhecidos (opcionais) |
| `analysis_runs` | Histórico de análises com resumo (IQA médio, alertas, acurácia); as 5 mais recentes guardam o `results.json` completo |
| `alerts` | Alertas de cada análise |
| `daily` | Série diária da última análise, base das consultas SQL (ex.: IQA mensal) |
| `assistant_messages` | Perguntas e respostas do Llama |

Ao subir, o app carrega a última análise do H2, sem refazer o pipeline. Para explorar o
banco com SQL enquanto o app roda, use `make h2` (console web do H2; usuário `sa`, sem senha).

### Dados reais
Na vista **Dados** do painel (ou em `POST /api/data/import`), envie:

- **leituras** (obrigatório): colunas `timestamp`, `station_id` e os parâmetros disponíveis
  (`ph`, `do_mgl`, `temp_c`, `turbidity_ntu`, `conductivity_uscm`, `nitrate_mgl`,
  `phosphorus_mgl`, `coliforms_nmp`);
- **estações** (opcional): `id`, `name`, `type` (`rio`, `lago`, `reservatorio`, `estuario`), `lat`, `lon`;
- **eventos conhecidos** (opcional): `station_id`, `start`, `end`, `type`, `description`, usados
  só para medir quantos a IA encontra.

O leitor aceita planilhas exportadas no Brasil: separador `;` com vírgula decimal, datas
`dd/mm/aaaa hh:mm`, cabeçalhos como “Data/Hora”, “Estação”, “OD (mg/L)” ou “Fósforo total”,
e valores abaixo do limite de detecção (`<0,02` vira metade do limite). A importação
substitui o conjunto atual no H2 e refaz toda a análise.

O processador só consolida dias com **pelo menos 6 leituras**, então os dados reais devem
vir de sensores contínuos (por exemplo, de hora em hora). Coletas mensais de laboratório não
bastam; a importação avisa quando a média de leituras por dia é baixa.

### Imagens (foto da água e imagem de satélite)
Na vista **Imagens**, o biólogo envia uma imagem JPG ou PNG (até 12 MB), informa a data e o
ponto de monitoramento (existente ou novo, com nome, tipo e coordenadas opcionais) e espera de
10 a 40 segundos:

1. o Java calcula **indicadores de cor** dos pixels (verde, vermelho, azul, brilho, índice
   verde-vermelho, fração esverdeada), de forma reprodutível;
2. um modelo com visão (`VISION_MODEL`, padrão `gemma4:31b` no Ollama Cloud) descreve só o que
   enxerga: cor da água, turbidez, floração de algas, espuma, óleo, material flutuante (foto) ou
   uso do entorno e mata ciliar (satélite), com nível de atenção de 0 a 3;
3. o resultado fica **pendente**: o biólogo confere, corrige cada campo e confirma. Se a IA falhar,
   a imagem é guardada e ele preenche à mão.

Só observações **confirmadas** entram no relatório e no contexto do assistente. São indícios
visuais, não medições de laboratório: cor e turbidez aparentes variam com a luz e o reflexo do
céu, e uma imagem comum (RGB) não mede clorofila.

### Caderno de campo
Anotações por estação ou ponto (observação, coleta, ocorrência, manejo), guardadas no H2 e
incluídas no contexto do assistente.

### Assistente
A vista **Assistente** conversa com um modelo servido pelo [Ollama](https://ollama.com), local ou na
nuvem (`OLLAMA_URL=https://ollama.com` com `OLLAMA_API_KEY`). O modelo é fixo e vem de `LLAMA_MODEL`.
A cada pergunta, o Java monta um contexto com as estações, conclusões, alertas recentes,
tendências, o IQA mensal consultado no H2, as observações por imagem confirmadas e as anotações
de campo, e instrui o modelo a usar apenas esses dados, em linguagem de biólogo.
As conversas ficam no H2, e as três últimas trocas vão junto para permitir perguntas de
seguimento. O texto exato enviado ao modelo pode ser visto em `GET /api/assistant/context`.

### Gerador de dados para desenvolvimento
`ml/generate_data.py` gera 2 anos de leituras horárias de 6 estações sintéticas, com 7 eventos
rotulados, e serve só para testar o pipeline e os modelos (`make data`). **O aplicativo não gera
nem carrega esses dados**: o conjunto de sensores vem da importação de uma planilha.

### Processamento (Rust)
- descarta valores fora da faixa física e interpola lacunas de até 6 h;
- agrega por dia e preenche lacunas diárias de até 3 dias;
- calcula a média móvel de 7 dias e o z-score em relação aos 30 dias anteriores;
- calcula o **IQA** (versão simplificada do IQA-CETESB/NSF, com 7 dos 9 parâmetros);
- processa as estações em paralelo (`rayon`): 105 mil leituras em cerca de 100 ms.

### IA / ML (Python)
| Técnica | Objetivo |
|---------|----------|
| Isolation Forest + z-score | Detectar alterações bruscas em relação à linha de base móvel |
| Random Forest | Reconhecer a classe de qualidade (Ótima…Péssima) a partir dos sensores, mesmo com um sensor ausente |
| K-Means + PCA | Agrupar perfis mensais (preservado / intermediário / impactado) |
| Mann-Kendall sazonal + declive de Sen | Identificar tendências de piora ou melhora de longo prazo |
| Regras CONAMA 357/2005 | Gerar alertas em linguagem simples, com recomendações |

Nos dados do gerador (semente padrão): **7/7 eventos detectados**, cerca de **94% de acurácia**
do classificador em dados futuros (91% com um sensor ausente) e tendências de
eutrofização identificadas no reservatório.

## Como executar

Pré-requisitos: **JDK 21**, Maven, Rust (cargo) e Python 3.11 ou superior. Para o assistente e a
leitura de imagens, o [Ollama](https://ollama.com) local ou uma chave do Ollama Cloud (opcional: sem
eles, o resto do painel funciona normalmente, e as imagens podem ser preenchidas à mão).

Para o painel, também **Node.js 20** ou superior.

```bash
make setup     # cria o venv Python e compila o Rust e o Java (o H2 vem como dependência Maven)
ollama serve & # opcional: sobe o Ollama
make llama     # opcional: baixa o modelo (padrão llama3.2; outro: make llama LLAMA_MODEL=llama3.1:8b)
make run       # API em http://localhost:7070
make web       # em outro terminal: painel em http://localhost:5173
```

O painel (Vite) encaminha `/api` para a API Java. Em produção, prefira um proxy de `/api`
na mesma origem do painel, para manter os cookies de sessão no mesmo site. Para outra origem
no mesmo site, defina `VITE_API_URL` e liste a origem exata em `AQUAML_CORS_ORIGINS`.
Autenticação com cookies não usa CORS `*`. Sirva por HTTPS e, se o TLS terminar em um proxy,
defina `AQUAML_SECURE_COOKIES=true` no ambiente do Java para exigir cookies seguros.

Variáveis (também lidas de um arquivo `.env` na raiz, que o Git ignora; veja `.env.example`):
`OLLAMA_URL` (padrão `http://localhost:11434`), `OLLAMA_API_KEY` (só para o Ollama Cloud),
`LLAMA_MODEL` (padrão `llama3.2`, modelo fixo do assistente), `VISION_MODEL` (padrão `gemma4:31b`,
modelo que lê as imagens) e `AQUAML_DB_URL` (outra URL JDBC do H2). Variáveis de ambiente têm
precedência sobre o `.env`. A chave nunca aparece em logs nem em mensagens de erro.

Na primeira execução, abra **Criar conta** em `/cadastro`, informe nome, e-mail e uma senha de
12 a 128 caracteres. O cadastro entra automaticamente no painel; nas próximas visitas, use
`/login`. Não há conta nem senha padrão. As contas têm acesso ao mesmo espaço de monitoramento
da equipe. Não há separação de dados por usuário ou níveis de permissão nesta versão.
No painel vazio, envie uma imagem em **Imagens** ou importe uma planilha de
sensores em **Meus dados**; a importação dispara o pipeline completo. Em **Atualizar** (link em Meus
dados) a análise é refeita sobre os dados guardados, e **Apagar dados de sensores** limpa o conjunto
de sensores sem tocar em imagens, anotações e conversas.

O menu lateral organiza o trabalho em **Monitoramento** (visão geral, estações, imagens e caderno
de campo), **Inteligência** (análises da IA, assistente e relatório) e **Gestão** (dados e atualização).
Imagens separa envio, revisão e observações confirmadas em abas; Meus dados separa fontes,
importação e histórico. As análises também têm abas por tipo. O caderno permite selecionar estações
ou pontos cadastrados por imagem. As abas e o ponto selecionado ficam na URL para compartilhar
links e usar o histórico do navegador. Em celulares, o menu abre pelo botão no cabeçalho.

O botão **Sair da conta**, junto ao nome no menu lateral, revoga a sessão no servidor.
A sessão padrão expira em 12 horas e o cookie dura até o navegador fechar; **Manter conectado**
usa um cookie persistente e uma sessão de 30 dias. Senhas usam PBKDF2-HMAC-SHA256 com salt
individual e 600 mil iterações. As operações de alteração exigem o token CSRF da sessão.
Ainda não há verificação de e-mail nem recuperação de senha por e-mail.

Outros alvos: `make data` e `make pipeline` (gerador e etapas de dados para desenvolvimento, sem o H2), `make test` (testes Rust,
Python, Java e do painel), `make h2` (console SQL), `make clean` (preserva o banco) e `make clean-db`
(apaga o banco, inclusive dados reais importados). Se o JDK 21 não estiver em `~/.local/opt/jdk-21`, use
`make run JAVA_HOME=/caminho/do/jdk-21`.

## API

As rotas de dados, imagens e análises exigem o cookie `aquaml_session`. As rotas públicas de
autenticação estão abaixo; login e cadastro recebem JSON. A resposta inclui `user` e
`csrfToken`: clientes devem guardar o cookie e enviar `X-CSRF-Token` nos métodos de alteração
(inclusive upload e logout). O navegador recebe um cookie HttpOnly, SameSite=Lax; o frontend
não armazena senhas ou tokens de sessão no localStorage.

| Rota | Descrição |
|------|-----------|
| `POST /api/auth/register` | Cadastra com `name`, `email`, `password` e inicia sessão |
| `POST /api/auth/login` | Entra com `email`, `password` e `remember` opcional |
| `GET /api/auth/session` | Consulta a conta e token CSRF da sessão, ou `user: null` |
| `POST /api/auth/logout` | Revoga a sessão e remove o cookie; exige autenticação e CSRF |

Teste de navegador com a CLI `agent-browser` da Vercel instalada: inicie API e painel locais e
execute `cd web && npm run test:auth-browser`. O teste usa os formulários e o backend real,
cria uma conta `qa-…@example.test` e grava capturas em um diretório temporário. Para não
misturar dados de teste, inicie a API com `AQUAML_DB_URL` apontando para um banco H2 isolado.

| Rota | Descrição |
|------|-----------|
| `GET /api/overview` | Todos os resultados, exceto as séries |
| `GET /api/stations` | Estações com IQA atual, classe prevista, perfil e tendências |
| `GET /api/stations/{id}/series` | Série diária completa da estação |
| `GET /api/alerts?station=&severity=` | Alertas (crítico, alto, atenção, recorrente) |
| `GET /api/anomalies` · `/api/classification` · `/api/clusters` · `/api/trends?significant=true` | Resultados de cada modelo |
| `GET /api/pipeline/status` · `POST /api/pipeline/run` | Andamento e nova execução do pipeline sobre os dados de sensores guardados |
| `DELETE /api/data` | Apaga o conjunto de sensores e as análises (imagens, anotações e conversas ficam) |
| `POST /api/images` (multipart: `image`, `kind`=`foto`\|`satelite`, `date`, `station_id` ou `point_name`+`point_type`+`point_lat`+`point_lon`, `note`) | Envia e analisa uma imagem; fica pendente até a confirmação |
| `GET /api/images?station=&status=` · `GET /api/images/{id}/file` | Observações por imagem e o arquivo da imagem |
| `POST /api/images/{id}/confirm` (JSON com os campos revisados) · `DELETE /api/images/{id}` | Confirma com a revisão do biólogo; apaga |
| `GET /api/points` | Pontos de monitoramento criados a partir de imagens |
| `GET /api/notes?station=` · `POST /api/notes` · `DELETE /api/notes/{id}` | Caderno de campo |
| `POST /api/data/import` (multipart: `measurements`, `stations`, `events`, `name`) | Importa dados reais para o H2 e refaz a análise |
| `GET /api/db/summary` · `/api/db/runs?limit=` · `/api/db/monthly?station=` | Conjunto atual, histórico de análises e IQA mensal (SQL) |
| `GET /api/assistant/status` · `POST /api/assistant/ask` `{"question": "…"}` | Estado do modelo e perguntas ao assistente |
| `GET` · `DELETE /api/assistant/history` · `GET /api/assistant/context` | Conversa guardada no H2 e contexto enviado ao modelo |

## Limitações
- Sem importação de planilha, não há IQA, gráficos nem tendências: só imagens, anotações e assistente.
  Os dados de sensores precisam de leituras contínuas.
- A leitura de imagens é um indício visual feito por uma IA que pode errar, e o resultado varia entre
  execuções. Por isso nada vale até o biólogo confirmar. Não substitui medição e coleta em campo.
- O assistente responde a partir do contexto montado pelo Java; modelos pequenos podem errar contas
  ou simplificar demais, então confira os números no painel.
- O IQA é uma aproximação: DBO e sólidos totais não são medidos, e os pesos são renormalizados.
- Com 2 anos de dados, o teste de tendência tem pouco poder estatístico, e tendências
  fracas podem surgir por acaso.
# forum
