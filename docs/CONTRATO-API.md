# AquaML — Contrato entre as partes

Este documento é a **fonte da verdade** que liga as três partes do sistema. Quem mexer em uma
parte não pode quebrar o que está escrito aqui sem atualizar este arquivo.

```
  Navegador (React, porta 5173)  ──/api──►  Backend Java Spring (porta 8080)  ──HTTP──►  Serviço ML Python (porta 8000)
                                                    │                                     (FastAPI + scikit-learn)
                                                    ├──► Banco H2 (arquivo em data/db)
                                                    └──► Ollama (chat do assistente + modelo com visão para imagens)
```

## Objetivo do produto

Uso de **algoritmos e machine learning no estudo de ecossistemas aquáticos**. Público: biólogos e
técnicos ambientais (linguagem simples em português na tela, sem jargão técnico).

- Entrada de dados: **imagens** (foto da água ou satélite, lidas por modelo com visão e
  conferidas pelo biólogo) e **planilhas CSV de sensores** (opcional).
- Algoritmos: IQA (Índice de Qualidade da Água, fórmula CETESB/NSF), detecção de anomalias
  (Isolation Forest + z-score), classificação da qualidade (Random Forest), agrupamento de
  perfis (K-Means + PCA), tendências (Mann-Kendall) e alertas por limites (CONAMA 357).
- Assistente: Ollama, **modelo fixo** definido no `.env` (`LLAMA_MODEL`), nunca escolhido na tela.
- Sem dados de demonstração: o sistema começa vazio.

## Variáveis de ambiente (arquivo `.env` na raiz, nunca vai para o git)

| Variável | Uso | Padrão |
|---|---|---|
| `OLLAMA_URL` | Endereço do Ollama | `http://localhost:11434` |
| `OLLAMA_API_KEY` | Chave do Ollama Cloud (opcional) | vazio |
| `LLAMA_MODEL` | Modelo do assistente | `llama3.2` |
| `VISION_MODEL` | Modelo com visão para imagens | `gemma4:31b` |
| `JWT_SECRET` | Segredo HMAC do JWT (mín. 32 caracteres) | gerado no início se ausente (avisa no log) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Administrador criado no primeiro início | `admin@aquaml.local` / `admin123` |
| `ML_SERVICE_URL` | Endereço do serviço Python | `http://localhost:8000` |

---

## 1. API do backend (Spring) usada pelo frontend

- Base: `/api`. JSON em **camelCase**. Datas `YYYY-MM-DD`, data-hora ISO-8601.
- Autenticação: **JWT** no cabeçalho `Authorization: Bearer <token>`. Validade 8 horas.
- Papéis (**roles**): `ADMIN` e `FUNCIONARIO`.
- Erros: `{"status": 400, "error": "mensagem em português"}`. 401 = sem login / token
  inválido; 403 = papel sem permissão; 404 = não encontrado; 503 = Ollama ou serviço ML fora.

### Permissões

| Ação | FUNCIONARIO | ADMIN |
|---|:-:|:-:|
| Ver painel, estações, análises, alertas, imagens, anotações | ✔ | ✔ |
| Enviar e confirmar imagens, criar anotações, usar o assistente | ✔ | ✔ |
| Apagar a própria imagem/anotação | ✔ | ✔ |
| Apagar imagem/anotação de outra pessoa | ✘ | ✔ |
| Importar planilha, apagar dados, rodar análise, criar estação | ✘ | ✔ |
| Gerenciar usuários | ✘ | ✔ |

### Autenticação
| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| POST | `/api/auth/login` | `{email, password}` | `{token, expiresAt, user}` |
| GET | `/api/auth/me` | — | `user` |

`user` = `{id, name, email, role: "ADMIN"|"FUNCIONARIO", active}`. Login aberto (sem token);
todas as outras rotas exigem token. Não há cadastro público: o ADMIN cria as contas.

### Usuários (só ADMIN)
| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| GET | `/api/users` | — | `user[]` |
| POST | `/api/users` | `{name, email, password, role}` | `user` (201) |
| PATCH | `/api/users/{id}` | `{role?, active?, name?}` | `user` |
| DELETE | `/api/users/{id}` | — | 204 (não pode apagar a si mesmo) |

### Painel e dados
| Método | Rota | Papel | Resposta |
|---|---|---|---|
| GET | `/api/dashboard` | todos | `Dashboard` (abaixo) |
| GET | `/api/data/summary` | todos | `{datasetName, importedAt, stations, measurements, firstReading, lastReading}` (campos `null` quando vazio) |
| POST | `/api/data/import` | ADMIN | multipart: `measurements` (CSV, obrigatório), `stations` (CSV, opcional), `events` (CSV, opcional), `name` (texto, opcional) → `{name, measurements, stations, events, readingsPerDay, warnings: string[], analysis: AnalysisRun}` |
| DELETE | `/api/data` | ADMIN | 204 (apaga leituras, eventos e análises) |

`Dashboard` = `{hasData: boolean, summary: <data/summary>, lastRun: AnalysisRun|null, iqaMean: number|null, stationsAtRisk: number, recentAlerts: Alert[] (até 10), insights: string[], imagesPending: number, imagesConfirmed: number}`

### Estações
| Método | Rota | Papel | Resposta |
|---|---|---|---|
| GET | `/api/stations` | todos | `Station[]` |
| POST | `/api/stations` | ADMIN | `{id?, name, type, lat?, lon?}` → `Station` (201). `id` gerado de `name` se ausente |
| GET | `/api/stations/{id}/series` | todos | `Series` da última análise (404 se não há) |

`Station` = `{id, name, type: "rio"|"lago"|"reservatorio"|"estuario", lat, lon, latest: {date, iqa, iqaClass}|null, predictedClass|null, clusterLabel|null, alertsRecent: number, worseningTrends: string[]}`

### Análise (machine learning)
| Método | Rota | Papel | Resposta |
|---|---|---|---|
| POST | `/api/analysis/run` | ADMIN | `AnalysisRun` (síncrono; status `CONCLUIDA` ou `FALHOU`) |
| GET | `/api/analysis/latest` | todos | `AnalysisResult` (seção 2) da última análise concluída; **204** se nenhuma |
| GET | `/api/analysis/runs` | todos | `AnalysisRun[]` (mais recente primeiro, até 20) |
| GET | `/api/alerts?station=&severity=` | todos | `Alert[]` da última análise |

`AnalysisRun` = `{id, startedAt, finishedAt, status: "EXECUTANDO"|"CONCLUIDA"|"FALHOU", iqaMean, alertCount, accuracy, error}`

### Imagens
| Método | Rota | Papel | Resposta |
|---|---|---|---|
| GET | `/api/images` | todos | `WaterImage[]` (mais recente primeiro) |
| POST | `/api/images` | todos | multipart: `file` (JPG/PNG até 12 MB), `kind` (`foto`/`satelite`), `observedOn` (data), `stationId` **ou** `newStationName` + `newStationType` (+ `lat`, `lon` opcionais) → `WaterImage` (201). Demora 10–40 s (modelo com visão) |
| GET | `/api/images/{id}/file` | todos | bytes da imagem. Como `<img>` não envia cabeçalho, aceita também `?token=<jwt>` |
| POST | `/api/images/{id}/confirm` | todos | `{waterColor?, turbidity?, algaeBloom?, foam?, oil?, floatingDebris?, attentionLevel?, notes?}` → `WaterImage` com `status: "CONFIRMADA"` |
| DELETE | `/api/images/{id}` | dono ou ADMIN | 204 |

`WaterImage` = `{id, stationId, stationName, kind, observedOn, uploadedAt, uploadedBy (nome), status: "PENDENTE"|"CONFIRMADA"|"ERRO_ANALISE", fileUrl, colorIndicators: {meanRed, meanGreen, meanBlue, brightnessPct, greenRedIndex, blueRatio, greenishFraction, darkFraction}, vision: {waterColor, turbidity: "baixa"|"media"|"alta"|null, algaeBloom: boolean|null, foam, oil, floatingDebris, surroundings: string|null, attentionLevel: 0..3, summary: string}|null, analysisError: string|null}`

### Anotações de campo
| Método | Rota | Papel | Corpo / Resposta |
|---|---|---|---|
| GET | `/api/notes?station=` | todos | `FieldNote[]` |
| POST | `/api/notes` | todos | `{stationId, notedOn, kind: "observacao"|"coleta"|"evento", text}` → `FieldNote` (201) |
| DELETE | `/api/notes/{id}` | dono ou ADMIN | 204 |

`FieldNote` = `{id, stationId, stationName, notedOn, kind, text, author, createdAt}`

### Assistente (Ollama)
| Método | Rota | Resposta |
|---|---|---|
| GET | `/api/assistant/status` | `{available: boolean, model: string}` |
| GET | `/api/assistant/history` | `ChatMessage[]` do usuário logado (até 50, mais antiga primeiro) |
| POST | `/api/assistant/ask` | `{question}` → `ChatMessage` (a resposta) |
| DELETE | `/api/assistant/history` | 204 |

`ChatMessage` = `{id, question, answer, model, createdAt}`. O backend monta o contexto com a última
análise, as imagens confirmadas e as anotações, e pede ao modelo que responda em português simples.

---

## 2. Serviço ML (Python) usado pelo backend

- `GET /health` → `{"status": "ok"}`
- `POST /analyze` → corpo `AnalyzeRequest`, resposta `AnalysisResult`. Erro de dados: 422
  `{"detail": "mensagem"}`.

`AnalyzeRequest`:
```json
{
  "stations": [{"id": "rio-a", "name": "Rio A", "type": "rio", "lat": -23.5, "lon": -46.6}],
  "measurements": [{"timestamp": "2026-01-01T00:00:00", "stationId": "rio-a",
                    "ph": 7.1, "doMgl": 7.8, "tempC": 22.0, "turbidityNtu": 12.0,
                    "conductivityUscm": 180.0, "nitrateMgl": 1.2, "phosphorusMgl": 0.05,
                    "coliformsNmp": 800.0}],
  "events": [{"stationId": "rio-a", "start": "2026-02-01", "end": "2026-02-04",
              "type": "despejo", "description": "..."}]
}
```
Parâmetros de medição podem ser `null`. Um dia só entra na análise com **pelo menos 6 leituras**.

`AnalysisResult` (todas as chaves em camelCase):
```json
{
  "generatedAt": "2026-11-02T12:00:00Z",
  "period": {"start": "2026-01-01", "end": "2026-06-30"},
  "parameters": {"ph": {"label": "pH", "unit": ""}, "doMgl": {"label": "Oxigênio dissolvido", "unit": "mg/L"}},
  "processing": {"rawReadings": 0, "validReadings": 0, "days": 0, "discardedDays": 0},
  "stations": [{"stationId": "rio-a", "name": "Rio A", "type": "rio",
                "latest": {"date": "2026-06-30", "iqa": 61.2, "iqaClass": "Boa"},
                "iqaPeriod": 58.4, "predictedClass": "Boa", "cluster": 1,
                "clusterLabel": "Água limpa e oxigenada", "worseningTrends": ["phosphorusMgl"],
                "alertsTotal": 4, "alertsRecent": 1, "criticalTotal": 0}],
  "insights": ["frase curta em português"],
  "alerts": [{"stationId": "rio-a", "date": "2026-06-30", "parameter": "doMgl", "value": 3.9,
              "unit": "mg/L", "severity": "atencao", "message": "Oxigênio abaixo de 5 mg/L"}],
  "anomalies": {"method": "Isolation Forest + z-score (30 dias)",
                "episodes": [{"stationId": "rio-a", "start": "2026-02-01", "end": "2026-02-03",
                              "days": 3, "maxScore": 0.71, "parameters": ["turbidityNtu"]}],
                "evaluation": {"knownEvents": 2, "detected": 2, "recall": 1.0}},
  "classification": {"method": "Random Forest", "accuracy": 0.91,
                     "featureImportance": [{"feature": "doMgl", "importance": 0.34}],
                     "current": {"rio-a": "Boa"}},
  "clusters": {"method": "K-Means + PCA",
               "points": [{"stationId": "rio-a", "date": "2026-06-30", "x": 0.4, "y": -1.2, "cluster": 1}],
               "profiles": [{"cluster": 1, "label": "Água limpa e oxigenada", "size": 120,
                             "means": {"doMgl": 7.9}}]},
  "trends": [{"stationId": "rio-a", "parameter": "phosphorusMgl", "direction": "piora",
              "slopePerYear": 0.01, "pValue": 0.03}],
  "series": {"rio-a": {"dates": ["2026-01-01"], "iqa": [61.2], "iqaClass": ["Boa"],
                       "anomaly": [false], "anomalyScore": [0.12],
                       "params": {"ph": [7.1], "doMgl": [7.8]}}}
}
```
`evaluation` é `null` quando não há eventos. `iqaClass`: `Ótima` (≥80), `Boa` (≥52), `Regular`
(≥37), `Ruim` (≥20), `Péssima` (<20). `severity`: `atencao` ou `critico`. `direction`: `piora`,
`melhora` ou `estavel`.

`Series` (rota `/api/stations/{id}/series`) é o item `series[id]` acima.

### Detalhes confirmados pelo serviço ML (valem para backend e frontend)
- Podem vir `null`: `classification.accuracy` (etapa pulada), `stations[].latest`, `iqaPeriod`,
  `predictedClass`, `cluster`, `clusterLabel`; itens de `series.*.iqa`, `iqaClass`, `anomalyScore`;
  `episodes[].maxScore`.
- `parameters` e `series[id].params` sempre trazem as 8 chaves (`ph`, `doMgl`, `tempC`,
  `turbidityNtu`, `conductivityUscm`, `nitrateMgl`, `phosphorusMgl`, `coliformsNmp`); lista toda
  `null` quando o sensor não existe.
- Alertas são por **episódio** (dias seguidos viram um alerta, com a data do último dia e o pior valor).
- Ids de cluster começam em 0; não fixe significado pelo id, use `profiles[].label`.
- Quando uma etapa é pulada (poucos dados), `method` começa com "não executado: …" e as listas vêm vazias.
