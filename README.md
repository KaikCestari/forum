# AquaML: análise de ecossistemas aquáticos com IA

Protótipo de uma aplicação que usa **algoritmos e machine learning** para analisar dados
de qualidade da água. Ela identifica padrões, reconhece a condição ambiental, detecta
alterações e apoia a tomada de decisão no monitoramento de ecossistemas aquáticos.

| Linguagem | Papel | Onde |
|-----------|-------|------|
| **Java 21** | Estrutura principal: orquestra o pipeline, expõe a API REST e serve o painel web | `app/` |
| **Rust** | Processamento de alto desempenho: limpeza, interpolação, agregação diária e cálculo do IQA | `processor/` |
| **Python** | IA/ML: detecção de anomalias, classificação, agrupamento, tendências e alertas | `ml/` |

## Arquitetura

```
                ┌────────────────────── Java 21 (Javalin) ──────────────────────┐
                │  PipelineService ── ProcessBuilder ──┐      ApiRoutes /api/*   │
                │  ResultsRepository ◄── results.json  │      painel web (/)     │
                └──────────────────────────────────────┼─────────────────────────┘
                                                       ▼
 generate_data.py ──► measurements.csv ──► aqua-processor (Rust) ──► processed.csv ──► analyze.py ──► results.json
   (Python)            105 mil leituras      validação, lacunas,       4.380 dias       Isolation Forest
                       horárias              médias móveis, IQA                         Random Forest
                                                                                         K-Means + PCA
                                                                                         Mann-Kendall sazonal
```

### Dados (sintéticos)
`ml/generate_data.py` gera 2 anos de leituras horárias de 6 estações (rios, lagoa,
reservatório e estuário) com pH, oxigênio dissolvido, temperatura, turbidez,
condutividade, nitrato, fósforo e coliformes. Os dados incluem sazonalidade, ciclo
diário, chuvas, falhas de sensor (valores ausentes e impossíveis), tendências graduais
e **7 eventos ambientais rotulados** (esgoto, floração de algas, hipóxia, descarga
industrial e escoamento agrícola). Os rótulos servem para avaliar se a IA detecta os
eventos.

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

Resultados com a semente padrão: **7/7 eventos detectados**, cerca de **94% de acurácia**
do classificador em dados futuros (91% com um sensor ausente) e tendências de
eutrofização identificadas no reservatório.

## Como executar

Pré-requisitos: **JDK 21**, Maven, Rust (cargo) e Python 3.11 ou superior.

```bash
make setup     # cria o venv Python e compila o Rust e o Java
make run       # http://localhost:7070
```

Na primeira execução, sem resultados, o Java roda o pipeline completo sozinho. No painel,
**Reexecutar análise** refaz o processo; marque *novos dados* e informe uma semente para
gerar outro cenário.

Outros alvos: `make pipeline` (só as etapas de dados), `make test` (testes Rust, Python e
Java) e `make clean`. Se o JDK 21 não estiver em `~/.local/opt/jdk-21`, use
`make run JAVA_HOME=/caminho/do/jdk-21`.

## API

| Rota | Descrição |
|------|-----------|
| `GET /api/overview` | Todos os resultados, exceto as séries |
| `GET /api/stations` | Estações com IQA atual, classe prevista, perfil e tendências |
| `GET /api/stations/{id}/series` | Série diária completa da estação |
| `GET /api/alerts?station=&severity=` | Alertas (crítico, alto, atenção, recorrente) |
| `GET /api/anomalies` · `/api/classification` · `/api/clusters` · `/api/trends?significant=true` | Resultados de cada modelo |
| `GET /api/pipeline/status` · `POST /api/pipeline/run?regenerate=&seed=` | Execução do pipeline |

## Limitações
- Os dados são sintéticos. Para usar dados reais, basta fornecer um `measurements.csv`
  com as mesmas colunas, além de `stations.csv`. O `events.csv` é opcional e só serve
  para a avaliação.
- O IQA é uma aproximação: DBO e sólidos totais não são medidos, e os pesos são renormalizados.
- Com 2 anos de dados, o teste de tendência tem pouco poder estatístico, e tendências
  fracas podem surgir por acaso.
# forum
