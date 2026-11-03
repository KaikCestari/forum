# AquaML — serviço de machine learning (Python)

Serviço HTTP que recebe as medições dos sensores e devolve a análise completa
da qualidade da água: IQA, anomalias, classificação, grupos, tendências e
alertas. Quem chama é o backend Java (Spring); o formato do JSON está na
seção 2 de [`docs/CONTRATO-API.md`](../docs/CONTRATO-API.md).

Substitui o antigo processador em Rust (`processor/`) e os scripts de `ml/`:
a limpeza, a média diária e o IQA foram traduzidos fielmente para Python
(mesmas curvas e mesmas classes).

## Como rodar

```bash
cd ml-service
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

.venv/bin/uvicorn app.main:app --port 8000     # serviço em http://localhost:8000
.venv/bin/python -m pytest                     # testes
```

Testar à mão com dados sintéticos (só para desenvolvimento; o serviço nunca
carrega esses dados sozinho):

```bash
.venv/bin/python -m tools.generate_data --out samples/request.json      # 2 anos, 6 estações
.venv/bin/python -m tools.generate_data --out samples/curto.json --days 20
curl -s -H 'Content-Type: application/json' --data-binary @samples/request.json \
     localhost:8000/analyze > resposta.json
```

## Rotas

| Método | Rota | O que faz |
|---|---|---|
| GET | `/health` | `{"status": "ok"}` |
| POST | `/analyze` | recebe `AnalyzeRequest` (estações, medições, eventos) e devolve `AnalysisResult` |

Se os dados não permitem análise (ex.: nenhum dia com 6 leituras), a resposta
é `422 {"detail": "mensagem em português"}`. Pedidos mal formados também
recebem 422 com `detail` em texto (não em lista).

## Organização do código

```
app/
  main.py               rotas HTTP (só isso)
  pipeline.py           o caso de uso: pedido → limpeza → IQA → ML → resultado
  api/schemas.py        formato do JSON de entrada e saída (camelCase)
  domain/               regras da área ambiental, sem nada de web
    parameters.py       parâmetros, unidades e faixas físicas
    cleaning.py         limpeza, lacunas e média diária
    iqa.py              Índice de Qualidade das Águas
    alerts.py           limites da CONAMA 357
  ml/                   algoritmos de machine learning
    features.py         escala logarítmica e semente fixa (42)
    anomaly.py          Isolation Forest + z-score
    classification.py   Random Forest
    clustering.py       K-Means + PCA
    trends.py           Mann-Kendall sazonal
tools/generate_data.py  gera um pedido sintético para testes
tests/                  testes (pytest)
```

## Os algoritmos, em palavras simples

**1. Limpeza e média diária** (`domain/cleaning.py`)
Valores impossíveis (pH −1, 150 °C) são descartados como falha de sensor.
As leituras são postas numa grade hora a hora; buracos de até 6 horas são
preenchidos ligando o valor anterior ao seguinte por uma reta (interpolação
linear) — buracos maiores não são inventados. Um dia só entra na análise com
**pelo menos 6 leituras**, e cada parâmetro só tem média se tiver 6 horas com
valor. Buracos de até 3 dias de um parâmetro também são interpolados.

**2. IQA — Índice de Qualidade das Águas** (`domain/iqa.py`)
Nota de 0 a 100 (fórmula CETESB/NSF). Cada parâmetro vira uma nota de 0 a 100
por uma curva (ex.: oxigênio perto de 100% de saturação ≈ nota 100) e as
notas são combinadas por um produtório ponderado — um parâmetro muito ruim
derruba o índice todo. Usamos 7 parâmetros (oxigênio, coliformes, pH,
variação de temperatura, nitrato, fósforo, turbidez) e exigimos pelo menos 5
no dia. Classes: Ótima (≥80), Boa (≥52), Regular (≥37), Ruim (≥20), Péssima.

**3. Dias fora do padrão** (`ml/anomaly.py`)
O algoritmo aprende como cada estação costuma ser e marca dias estranhos para
aquele local, como um despejo de esgoto. Duas técnicas: o **Isolation Forest**
(árvores que isolam dias raros com poucos cortes; nota de 0 a 1) e a **regra do
z-score** (dois parâmetros a mais de 4 desvios-padrão dos 30 dias anteriores).
Dias próximos viram um episódio. Se vierem eventos registrados em campo,
mostramos quantos foram encontrados (`evaluation`).

**4. Classe de qualidade** (`ml/classification.py`)
Uma **Random Forest** (centenas de árvores de decisão que votam) aprende a
reconhecer a classe do IQA direto das leituras — e funciona mesmo com um
sensor desligado. O acerto é medido treinando com os primeiros 75% do período
e testando nos 25% finais. Mostra também quais parâmetros mais pesam.

**5. Grupos de perfis** (`ml/clustering.py`)
O **K-Means** junta, sem nenhuma regra prévia, os dias que se parecem em 3
grupos, nomeados pela qualidade média ("Água limpa e oxigenada", "Água com
sinais de impacto", "Água muito impactada"). O **PCA** resume os parâmetros em
dois eixos (x, y) para desenhar cada dia num gráfico de pontos.

**6. Tendências** (`ml/trends.py`)
O teste de **Mann-Kendall sazonal** responde se um parâmetro sobe ou desce de
forma consistente, comparando cada mês só com o mesmo mês de outros anos (para
não confundir chuva/seca com tendência). O **declive de Sen** diz quanto muda
por ano. Só é "piora"/"melhora" se p < 0,05 e a mudança for de pelo menos 5% da
média ao ano. Com menos de 13 meses usamos o teste comum sobre médias semanais.

**7. Alertas** (`domain/alerts.py`)
Compara as médias diárias com a **Resolução CONAMA 357/2005** (água doce
classe 2; estuário: salobra classe 1). `atencao` = passou do limite;
`critico` = passou muito (ex.: oxigênio < 3 mg/L). Dias de violação próximos
viram um único alerta, com a data do último dia e o pior valor.

## Robustez

- Parâmetros `null` são aceitos; com menos de 5 parâmetros o IQA fica `null`.
- Uma estação só, poucos dias ou uma única classe de qualidade: a classificação
  e os grupos são pulados (`method` explica o motivo, listas vazias), sem erro.
- Sem eventos: `anomalies.evaluation` é `null`.
- Estação presente nas medições mas não em `stations`: nome = id, tipo = `rio`.
- NaN e infinito nunca chegam ao JSON (viram `null`).
- Resultados determinísticos (semente fixa `random_state=42`).
