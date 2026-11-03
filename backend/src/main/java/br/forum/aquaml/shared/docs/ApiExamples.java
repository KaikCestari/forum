package br.forum.aquaml.shared.docs;

public final class ApiExamples {

    private ApiExamples() {
    }

    public static final String LOGIN_ADMIN = """
            {"email": "admin@aquaml.local", "password": "admin123"}""";

    public static final String LOGIN_FUNCIONARIO = """
            {"email": "ana@aquaml.local", "password": "segredo1"}""";

    public static final String LOGIN_WRONG = """
            {"email": "admin@aquaml.local", "password": "senha-errada"}""";

    public static final String LOGIN_RESPONSE = """
            {
              "token": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIiwicm9sZSI6IkFETUlOIn0.assinatura",
              "expiresAt": "2026-11-04T00:24:00Z",
              "user": {"id": 1, "name": "Administrador", "email": "admin@aquaml.local", "role": "ADMIN", "active": true}
            }""";

    public static final String USER_ADMIN = """
            {"id": 1, "name": "Administrador", "email": "admin@aquaml.local", "role": "ADMIN", "active": true}""";

    public static final String USER_LIST = """
            [
              {"id": 1, "name": "Administrador", "email": "admin@aquaml.local", "role": "ADMIN", "active": true},
              {"id": 2, "name": "Ana Souza", "email": "ana@aquaml.local", "role": "FUNCIONARIO", "active": true}
            ]""";

    public static final String USER_CREATE = """
            {"name": "Ana Souza", "email": "ana@aquaml.local", "password": "segredo1", "role": "FUNCIONARIO"}""";

    public static final String USER_CREATE_ADMIN = """
            {"name": "Bruno Lima", "email": "bruno@aquaml.local", "password": "segredo2", "role": "ADMIN"}""";

    public static final String USER_FUNCIONARIO = """
            {"id": 2, "name": "Ana Souza", "email": "ana@aquaml.local", "role": "FUNCIONARIO", "active": true}""";

    public static final String USER_PROMOTE = """
            {"role": "ADMIN"}""";

    public static final String USER_DEACTIVATE = """
            {"active": false}""";

    public static final String USER_RENAME = """
            {"name": "Ana Souza Pereira"}""";

    public static final String DATA_SUMMARY = """
            {
              "datasetName": "Rede de exemplo",
              "importedAt": "2026-11-03T16:23:59.357641Z",
              "stations": 6,
              "measurements": 105120,
              "firstReading": "2024-10-01T00:00:00",
              "lastReading": "2026-09-30T23:00:00"
            }""";

    public static final String DATA_SUMMARY_EMPTY = """
            {"datasetName": null, "importedAt": null, "stations": 0, "measurements": 0,
             "firstReading": null, "lastReading": null}""";

    public static final String ANALYSIS_RUN = """
            {
              "id": 2,
              "startedAt": "2026-11-03T16:24:00.702709Z",
              "finishedAt": "2026-11-03T16:24:06.089270Z",
              "status": "CONCLUIDA",
              "iqaMean": 75.9,
              "alertCount": 157,
              "accuracy": 0.9416,
              "error": null
            }""";

    public static final String ANALYSIS_RUN_FAILED = """
            {
              "id": 3,
              "startedAt": "2026-11-03T16:30:00Z",
              "finishedAt": "2026-11-03T16:30:01Z",
              "status": "FALHOU",
              "iqaMean": null,
              "alertCount": null,
              "accuracy": null,
              "error": "Não há leituras de sensores para analisar. Importe uma planilha primeiro."
            }""";

    public static final String ANALYSIS_RUNS = "[" + ANALYSIS_RUN + """
            ,
            {"id": 1, "startedAt": "2026-11-03T16:23:50.960071Z", "finishedAt": "2026-11-03T16:23:59.748522Z",
             "status": "CONCLUIDA", "iqaMean": 75.9, "alertCount": 157, "accuracy": 0.9416, "error": null}
            ]""";

    public static final String IMPORT_RESPONSE = """
            {
              "name": "Rede de exemplo",
              "measurements": 105120,
              "stations": 6,
              "events": 7,
              "readingsPerDay": 24.0,
              "warnings": [],
              "analysis": {"id": 2, "startedAt": "2026-11-03T16:24:00.702709Z",
                           "finishedAt": "2026-11-03T16:24:06.089270Z", "status": "CONCLUIDA",
                           "iqaMean": 75.9, "alertCount": 157, "accuracy": 0.9416, "error": null}
            }""";

    public static final String ALERTS = """
            [
              {"stationId": "RIO-02", "date": "2026-09-30", "parameter": "coliformsNmp", "value": 175140.5946,
               "unit": "NMP/100mL", "severity": "critico",
               "message": "Coliformes acima de 1000 NMP/100mL (limite CONAMA 357) em 579 dia(s); pior valor 175.141 NMP/100mL."},
              {"stationId": "RIO-02", "date": "2026-09-30", "parameter": "phosphorusMgl", "value": 1.0869,
               "unit": "mg/L", "severity": "critico",
               "message": "Fósforo total acima de 0,1 mg/L (limite CONAMA 357) em 581 dia(s); pior valor 1,09 mg/L."},
              {"stationId": "LAG-01", "date": "2026-09-30", "parameter": "phosphorusMgl", "value": 0.0505,
               "unit": "mg/L", "severity": "atencao",
               "message": "Fósforo total acima de 0,03 mg/L (limite CONAMA 357) em 15 dia(s); pior valor 0,05 mg/L."}
            ]""";

    public static final String DASHBOARD = """
            {
              "hasData": true,
              "summary": {"datasetName": "Rede de exemplo", "importedAt": "2026-11-03T16:23:59.357641Z",
                          "stations": 6, "measurements": 105120,
                          "firstReading": "2024-10-01T00:00:00", "lastReading": "2026-09-30T23:00:00"},
              "lastRun": {"id": 2, "startedAt": "2026-11-03T16:24:00.702709Z",
                          "finishedAt": "2026-11-03T16:24:06.089270Z", "status": "CONCLUIDA",
                          "iqaMean": 75.9, "alertCount": 157, "accuracy": 0.9416, "error": null},
              "iqaMean": 75.9,
              "stationsAtRisk": 0,
              "recentAlerts": [
                {"stationId": "RIO-02", "date": "2026-09-30", "parameter": "coliformsNmp", "value": 175140.5946,
                 "unit": "NMP/100mL", "severity": "critico",
                 "message": "Coliformes acima de 1000 NMP/100mL (limite CONAMA 357) em 579 dia(s); pior valor 175.141 NMP/100mL."}
              ],
              "insights": ["Rio Claro — Jusante urbana tem a pior qualidade da rede no período."],
              "imagesPending": 1,
              "imagesConfirmed": 0
            }""";

    public static final String DASHBOARD_EMPTY = """
            {
              "hasData": false,
              "summary": {"datasetName": null, "importedAt": null, "stations": 0, "measurements": 0,
                          "firstReading": null, "lastReading": null},
              "lastRun": null, "iqaMean": null, "stationsAtRisk": 0, "recentAlerts": [], "insights": [],
              "imagesPending": 0, "imagesConfirmed": 0
            }""";

    public static final String STATIONS = """
            [
              {"id": "EST-01", "name": "Estuário Baía Norte", "type": "estuario", "lat": -23.4, "lon": -45.2,
               "latest": {"date": "2026-09-30", "iqa": 74.69, "iqaClass": "Boa"}, "predictedClass": "Boa",
               "clusterLabel": "Água com sinais de impacto", "alertsRecent": 2, "worseningTrends": []},
              {"id": "LAG-01", "name": "Lagoa Azul", "type": "lago", "lat": -22.95, "lon": -46.9,
               "latest": {"date": "2026-09-30", "iqa": 81.42, "iqaClass": "Ótima"}, "predictedClass": "Ótima",
               "clusterLabel": "Água com sinais de impacto", "alertsRecent": 2, "worseningTrends": []},
              {"id": "RIO-02", "name": "Rio Claro — Jusante urbana", "type": "rio", "lat": -22.8, "lon": -47.05,
               "latest": {"date": "2026-09-30", "iqa": 61.0, "iqaClass": "Boa"}, "predictedClass": "Boa",
               "clusterLabel": "Água muito impactada", "alertsRecent": 19,
               "worseningTrends": ["coliformsNmp", "phosphorusMgl", "turbidityNtu"]}
            ]""";

    public static final String STATION_CREATE = """
            {"id": "RIO-04", "name": "Córrego Fundo", "type": "rio", "lat": -22.81, "lon": -47.06}""";

    public static final String STATION_CREATE_NO_ID = """
            {"name": "Represa do Jaguari", "type": "reservatorio"}""";

    public static final String STATION_CREATED = """
            {"id": "RIO-04", "name": "Córrego Fundo", "type": "rio", "lat": -22.81, "lon": -47.06,
             "latest": null, "predictedClass": null, "clusterLabel": null, "alertsRecent": 0, "worseningTrends": []}""";

    public static final String SERIES = """
            {
              "dates": ["2024-10-01", "2024-10-02", "2024-10-03"],
              "iqa": [61.42, 58.33, 59.5],
              "iqaClass": ["Boa", "Boa", "Boa"],
              "anomaly": [false, false, false],
              "anomalyScore": [null, null, null],
              "params": {
                "ph": [6.9176, 6.8408, 6.8477],
                "doMgl": [6.0052, 6.0744, 6.0594],
                "tempC": [21.2875, 20.6765, 21.4457],
                "turbidityNtu": [15.3602, 18.7579, 19.0482],
                "conductivityUscm": [362.7108, 373.2537, 368.6494],
                "nitrateMgl": [3.8967, 3.636, 4.3971],
                "phosphorusMgl": [0.293, 0.4555, 0.429],
                "coliformsNmp": [3968.6239, 5534.6608, 4093.1177]
              }
            }""";

    public static final String ANALYSIS_RESULT = """
            {
              "generatedAt": "2026-11-03T16:24:06Z",
              "period": {"start": "2024-10-01", "end": "2026-09-30"},
              "parameters": {"ph": {"label": "pH", "unit": ""}, "doMgl": {"label": "Oxigênio dissolvido", "unit": "mg/L"}},
              "processing": {"rawReadings": 105120, "validReadings": 104980, "days": 4380, "discardedDays": 0},
              "stations": [{"stationId": "RIO-02", "name": "Rio Claro — Jusante urbana", "type": "rio",
                            "latest": {"date": "2026-09-30", "iqa": 61.0, "iqaClass": "Boa"},
                            "iqaPeriod": 58.4, "predictedClass": "Boa", "cluster": 1,
                            "clusterLabel": "Água muito impactada",
                            "worseningTrends": ["coliformsNmp", "phosphorusMgl", "turbidityNtu"],
                            "alertsTotal": 19, "alertsRecent": 19, "criticalTotal": 4}],
              "insights": ["Rio Claro — Jusante urbana tem a pior qualidade da rede no período."],
              "alerts": [{"stationId": "RIO-02", "date": "2026-09-30", "parameter": "phosphorusMgl", "value": 1.0869,
                          "unit": "mg/L", "severity": "critico",
                          "message": "Fósforo total acima de 0,1 mg/L (limite CONAMA 357) em 581 dia(s); pior valor 1,09 mg/L."}],
              "anomalies": {"method": "Isolation Forest + z-score (30 dias)",
                            "episodes": [{"stationId": "RIO-02", "start": "2025-02-01", "end": "2025-02-03", "days": 3,
                                          "maxScore": 0.71, "parameters": ["turbidityNtu"]}],
                            "evaluation": {"knownEvents": 7, "detected": 6, "recall": 0.857}},
              "classification": {"method": "Random Forest", "accuracy": 0.9416,
                                 "featureImportance": [{"feature": "doMgl", "importance": 0.34}],
                                 "current": {"RIO-02": "Boa"}},
              "clusters": {"method": "K-Means + PCA",
                           "points": [{"stationId": "RIO-02", "date": "2026-09-30", "x": 0.4, "y": -1.2, "cluster": 1}],
                           "profiles": [{"cluster": 1, "label": "Água muito impactada", "size": 730,
                                         "means": {"doMgl": 6.0}}]},
              "trends": [{"stationId": "RIO-02", "parameter": "phosphorusMgl", "direction": "piora",
                          "slopePerYear": 0.01, "pValue": 0.03}],
              "series": {"RIO-02": {"dates": ["2026-09-30"], "iqa": [61.0], "iqaClass": ["Boa"], "anomaly": [false],
                                    "anomalyScore": [0.12], "params": {"ph": [7.1], "doMgl": [6.06]}}}
            }""";

    private static final String IMAGE_BODY = """
              "stationId": "RIO-02",
              "stationName": "Rio Claro — Jusante urbana",
              "kind": "foto",
              "observedOn": "2026-09-28",
              "uploadedAt": "2026-11-03T16:24:20.415381Z",
              "uploadedBy": "Administrador",
              "fileUrl": "/api/images/1/file",
              "colorIndicators": {"meanRed": 145.6, "meanGreen": 152.8, "meanBlue": 151.4, "brightnessPct": 59.3,
                                  "greenRedIndex": 0.024, "blueRatio": 0.337, "greenishFraction": 0.003,
                                  "darkFraction": 0.004},
              "vision": {"waterColor": "marrom-turva e azul-escura", "turbidity": "alta", "algaeBloom": null,
                         "foam": false, "oil": null, "floatingDebris": false,
                         "surroundings": "linha de costa distante com vegetação verde", "attentionLevel": 2,
                         "summary": "A imagem mostra o encontro de duas massas de água com cores e turbidez distintas."},
              "analysisError": null
            """;

    public static final String IMAGE_PENDING = "{\n  \"id\": 1,\n  \"status\": \"PENDENTE\",\n" + IMAGE_BODY + "}";

    public static final String IMAGE_CONFIRMED = "{\n  \"id\": 1,\n  \"status\": \"CONFIRMADA\",\n" + IMAGE_BODY + "}";

    public static final String IMAGE_ERROR = """
            {
              "id": 2, "stationId": "RIO-02", "stationName": "Rio Claro — Jusante urbana", "kind": "satelite",
              "observedOn": "2026-09-28", "uploadedAt": "2026-11-03T16:30:00Z", "uploadedBy": "Ana Souza",
              "status": "ERRO_ANALISE", "fileUrl": "/api/images/2/file",
              "colorIndicators": {"meanRed": 120.2, "meanGreen": 98.4, "meanBlue": 71.0, "brightnessPct": 39.8,
                                  "greenRedIndex": -0.1, "blueRatio": 0.244, "greenishFraction": 0.01,
                                  "darkFraction": 0.08},
              "vision": null,
              "analysisError": "O modelo com visão não respondeu. A imagem foi guardada: confira e preencha os campos à mão."
            }""";

    public static final String IMAGE_LIST = "[" + IMAGE_PENDING + "]";

    public static final String IMAGE_CONFIRM = """
            {
              "waterColor": "marrom",
              "turbidity": "alta",
              "algaeBloom": false,
              "foam": false,
              "oil": false,
              "floatingDebris": false,
              "attentionLevel": 2,
              "notes": "Conferido em campo: água barrenta depois da chuva."
            }""";

    public static final String IMAGE_CONFIRM_AS_IS = "{}";

    public static final String NOTE_CREATE = """
            {"stationId": "RIO-02", "notedOn": "2026-09-30", "kind": "observacao",
             "text": "Água escura e com cheiro forte perto da galeria pluvial."}""";

    public static final String NOTE_CREATE_COLLECT = """
            {"stationId": "LAG-01", "notedOn": "2026-10-02", "kind": "coleta",
             "text": "Coletadas 3 amostras para fósforo total, enviadas ao laboratório."}""";

    public static final String NOTE = """
            {"id": 1, "stationId": "RIO-02", "stationName": "Rio Claro — Jusante urbana", "notedOn": "2026-09-30",
             "kind": "observacao", "text": "Água escura e com cheiro forte perto da galeria pluvial.",
             "author": "Administrador", "createdAt": "2026-11-03T16:24:15.707717Z"}""";

    public static final String NOTE_LIST = "[" + NOTE + "]";

    public static final String ASSISTANT_STATUS = """
            {"available": true, "model": "gpt-oss:20b"}""";

    public static final String ASK = """
            {"question": "Qual estação está pior e por quê?"}""";

    public static final String ASK_CHART = """
            {"question": "Mostre o fósforo da RIO-02 num gráfico."}""";

    public static final String CHAT_MESSAGE = """
            {
              "id": 1,
              "question": "Qual estação está pior e por quê?",
              "answer": "A estação com pior qualidade de água é **Rio Claro — Jusante urbana (RIO-02)**: coliformes e fósforo acima do limite CONAMA 357, com tendência de piora.\\n\\n[[grafico estacao=RIO-02 parametro=phosphorusMgl]]",
              "model": "gpt-oss:20b",
              "createdAt": "2026-11-03T16:25:02Z"
            }""";

    public static final String CHAT_HISTORY = "[" + CHAT_MESSAGE + "]";

    public static final String ERR_400 = """
            {"status": 400, "error": "email: informe o e-mail"}""";

    public static final String ERR_401 = """
            {"status": 401, "error": "Faça login para continuar (token ausente, inválido ou vencido)."}""";

    public static final String ERR_401_LOGIN = """
            {"status": 401, "error": "E-mail ou senha incorretos."}""";

    public static final String ERR_403 = """
            {"status": 403, "error": "Seu papel não tem permissão para esta ação."}""";

    public static final String ERR_403_OWNER = """
            {"status": 403, "error": "Só quem escreveu a anotação ou um administrador pode apagá-la."}""";

    public static final String ERR_404_USER = """
            {"status": 404, "error": "Usuário não encontrado."}""";

    public static final String ERR_404_STATION = """
            {"status": 404, "error": "Não há série para esta estação: rode a análise com leituras dela."}""";

    public static final String ERR_404_NOTE = """
            {"status": 404, "error": "Anotação não encontrada."}""";

    public static final String ERR_404_IMAGE = """
            {"status": 404, "error": "Imagem não encontrada."}""";

    public static final String ERR_400_SELF = """
            {"status": 400, "error": "Você não pode apagar a sua própria conta."}""";

    public static final String ERR_400_EMAIL = """
            {"status": 400, "error": "Já existe uma conta com este e-mail."}""";

    public static final String ERR_400_STATION = """
            {"status": 400, "error": "Já existe uma estação com o código RIO-04."}""";

    public static final String ERR_400_CSV = """
            {"status": 400, "error": "Envie o CSV de leituras no campo measurements."}""";

    public static final String ERR_400_IMAGE = """
            {"status": 400, "error": "Formato não reconhecido: envie uma imagem JPG ou PNG."}""";

    public static final String ERR_400_NOTE = """
            {"status": 400, "error": "Tipo de anotação inválido: use observacao, coleta ou evento."}""";

    public static final String ERR_400_QUESTION = """
            {"status": 400, "error": "Escreva uma pergunta."}""";

    public static final String ERR_503_OLLAMA = """
            {"status": 503, "error": "Não foi possível falar com o Ollama em http://localhost:11434."}""";
}
