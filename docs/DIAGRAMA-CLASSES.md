# AquaML — Diagrama de classes (backend Java Spring, DDD)

Gerado a partir do código real em `backend/src/main/java/br/forum/aquaml`. As imagens renderizadas
estão em `docs/img/`.

## Como ler

- Cada **contexto** (bounded context) é um pacote: `identity`, `monitoring`, `analysis`, `imagery`,
  `assistant` e `dashboard`. O pacote `shared` guarda o que todos usam (erros, segurança, cliente do Ollama).
- Dentro de cada contexto há quatro camadas:
  - `domain`: entidades com as regras (ex.: `WaterImage.confirm`), objetos de valor (`ColorIndicators`) e
    interfaces de repositório e de serviços externos (as **portas**);
  - `application`: os casos de uso (`AnalysisService.run()`);
  - `infrastructure`: implementações das portas (JPA, HTTP para o Python, Ollama, disco);
  - `interfaces`: os controllers REST e os DTOs de resposta.
- Os contextos se referem uns aos outros **pelo id** (ex.: `stationId`), não por objeto. Assim cada
  contexto continua independente.

## 1. Visão geral: o domínio

![Domínio](img/classes-dominio.png)

```mermaid
classDiagram
    direction LR

    namespace identity {
        class User {
            -Long id
            -String name
            -String email
            -String passwordHash
            -Role role
            -boolean active
            +changeRole(Role, Long changedBy)
            +setActive(boolean, Long changedBy)
            +rename(String)
            +isAdmin() boolean
        }
        class Role {
            <<enumeration>>
            ADMIN
            FUNCIONARIO
        }
    }

    namespace monitoring {
        class Station {
            -String id
            -String name
            -StationType type
            -Double lat
            -Double lon
            +update(name, type, lat, lon)
            +codeFromName(String)$ String
        }
        class StationType {
            <<enumeration>>
            RIO
            LAGO
            RESERVATORIO
            ESTUARIO
        }
        class Measurement {
            -Long id
            -String stationId
            -LocalDateTime timestamp
            -WaterParameters parameters
        }
        class WaterParameters {
            <<value object>>
            ph, doMgl, tempC, turbidityNtu
            conductivityUscm, nitrateMgl
            phosphorusMgl, coliformsNmp
        }
        class MonitoringEvent {
            -String stationId
            -LocalDate startDate
            -LocalDate endDate
            -String type
            -String description
        }
        class Dataset {
            -String name
            -Instant importedAt
            -int measurements
            -int stations
            -int events
        }
        class FieldNote {
            -String stationId
            -LocalDate notedOn
            -String kind
            -String text
            -Long authorId
            +checkCanBeDeletedBy(Long, boolean)
        }
    }

    namespace analysis {
        class AnalysisRun {
            -Long id
            -Instant startedAt
            -Instant finishedAt
            -RunStatus status
            -Double iqaMean
            -Integer alertCount
            -Double accuracy
            -String error
            -String resultJson
            +start()$ AnalysisRun
            +complete(AnalysisResult)
            +fail(String)
            +result() Optional~AnalysisResult~
        }
        class RunStatus {
            <<enumeration>>
            EXECUTANDO
            CONCLUIDA
            FALHOU
        }
        class Alert {
            -Long runId
            -String stationId
            -LocalDate date
            -String parameter
            -Double measuredValue
            -String severity
            -String message
            +isCritical() boolean
        }
        class Iqa {
            <<value object>>
            +double value
            +classification() String
            +isAtRisk() boolean
        }
        class AnalysisResult {
            <<value object>>
            JSON devolvido pelo Python
        }
    }

    namespace imagery {
        class WaterImage {
            -Long id
            -String stationId
            -String kind
            -LocalDate observedOn
            -ImageStatus status
            -ColorIndicators colorIndicators
            -VisionReading vision
            -String analysisError
            +recordVisionReading(VisionReading)
            +markAnalysisFailed(String)
            +confirm(ImageCorrections)
            +checkCanBeDeletedBy(Long, boolean)
        }
        class ImageStatus {
            <<enumeration>>
            PENDENTE
            CONFIRMADA
            ERRO_ANALISE
        }
        class ColorIndicators {
            <<value object>>
            meanRed, meanGreen, meanBlue
            brightnessPct, greenRedIndex
            blueRatio, greenishFraction, darkFraction
            +measure(BufferedImage)$ ColorIndicators
        }
        class VisionReading {
            <<value object>>
            waterColor, turbidity, algaeBloom
            foam, oil, floatingDebris
            surroundings, attentionLevel, summary
            +correctedWith(ImageCorrections) VisionReading
        }
        class ImageCorrections {
            <<value object>>
            correções feitas pelo biólogo
        }
    }

    namespace assistant {
        class ChatMessage {
            -Long userId
            -String question
            -String answer
            -String model
            -Instant createdAt
            +validQuestion(String)$ String
        }
    }

    User --> Role
    Station --> StationType
    Measurement *-- WaterParameters
    Measurement ..> Station : stationId
    MonitoringEvent ..> Station : stationId
    FieldNote ..> Station : stationId
    FieldNote ..> User : authorId
    AnalysisRun --> RunStatus
    AnalysisRun ..> AnalysisResult : guarda em JSON
    AnalysisRun "1" o-- "*" Alert : runId
    Alert ..> Station : stationId
    AnalysisResult ..> Iqa
    WaterImage --> ImageStatus
    WaterImage *-- ColorIndicators
    WaterImage *-- VisionReading
    WaterImage ..> ImageCorrections : confirm()
    WaterImage ..> Station : stationId
    WaterImage ..> User : uploadedById
    ChatMessage ..> User : userId
```

## 2. Camadas DDD: casos de uso, portas e adaptadores

![Camadas](img/classes-camadas.png)

As interfaces marcadas como `<<port>>` ficam no `domain` (ou no `application`). As classes de
`infrastructure` implementam essas interfaces. Assim o domínio não depende do Spring, do JPA nem do HTTP.

```mermaid
classDiagram
    direction TB

    class AuthController { <<interfaces>> }
    class UserController { <<interfaces>> }
    class DataController { <<interfaces>> }
    class StationController { <<interfaces>> }
    class FieldNoteController { <<interfaces>> }
    class AnalysisController { <<interfaces>> }
    class ImageController { <<interfaces>> }
    class AssistantController { <<interfaces>> }
    class DashboardController { <<interfaces>> }

    class AuthService {
        <<application>>
        +login(email, password) LoginResult
        +me(CurrentUser) User
    }
    class UserService {
        <<application>>
        +list() List~User~
        +create(name, email, password, role) User
        +update(id, role, active, name, CurrentUser) User
        +delete(id, CurrentUser)
    }
    class DataImportService {
        <<application>>
        +importData(ImportCommand) ImportResult
    }
    class DataService {
        <<application>>
        +summary() DataSummary
        +deleteAll()
    }
    class StationService {
        <<application>>
        +list() List~StationOverview~
        +create(id, name, type, lat, lon)
        +series(id) JsonNode
    }
    class FieldNoteService {
        <<application>>
        +list(stationId)
        +create(...) FieldNote
        +delete(id, CurrentUser)
    }
    class AnalysisService {
        <<application>>
        +run() AnalysisRun
        +latestResult() Optional~AnalysisResult~
        +recentRuns() List~AnalysisRun~
        +alerts(stationId, severity) List~Alert~
    }
    class ImageService {
        <<application>>
        +upload(UploadCommand, CurrentUser) WaterImage
        +confirm(id, ImageCorrections) WaterImage
        +file(id) ImageFile
        +delete(id, CurrentUser)
    }
    class AssistantService {
        <<application>>
        +isAvailable() boolean
        +model() String
        +ask(question, CurrentUser) ChatMessage
        +history(CurrentUser)
        +clearHistory(CurrentUser)
    }
    class AssistantContextBuilder { <<application>> }
    class DashboardService {
        <<application>>
        +build() Dashboard
    }
    class CsvSpreadsheetParser { <<application>> }
    class PhotoProcessor { <<application>> }

    class TokenIssuer {
        <<port>>
        +issue(User) IssuedToken
    }
    class MlServiceClient {
        <<port>>
        +analyze(AnalysisInput) AnalysisResult
    }
    class VisionAnalyzer {
        <<port>>
        +read(byte[] jpeg, String kind) VisionReading
    }
    class ImageStorage {
        <<port>>
        +store(byte[], String) String
        +delete(String)
    }
    class UserRepository { <<port>> }
    class StationRepository { <<port>> }
    class MeasurementRepository { <<port>> }
    class AnalysisRunRepository { <<port>> }
    class WaterImageRepository { <<port>> }
    class ChatMessageRepository { <<port>> }

    class JwtService { <<infrastructure>> }
    class JwtAuthenticationFilter { <<infrastructure>> }
    class HttpMlServiceClient {
        <<infrastructure>>
        POST ML_SERVICE_URL/analyze
    }
    class OllamaVisionAnalyzer { <<infrastructure>> }
    class LocalImageStorage { <<infrastructure>> }
    class OllamaClient {
        <<shared>>
        POST OLLAMA_URL/api/chat
    }
    class JpaRepositories {
        <<infrastructure>>
        Spring Data gera o código
    }

    AuthController --> AuthService
    UserController --> UserService
    DataController --> DataImportService
    DataController --> DataService
    StationController --> StationService
    FieldNoteController --> FieldNoteService
    AnalysisController --> AnalysisService
    ImageController --> ImageService
    AssistantController --> AssistantService
    DashboardController --> DashboardService

    AuthService --> UserRepository
    AuthService --> TokenIssuer
    UserService --> UserRepository
    DataImportService --> CsvSpreadsheetParser
    DataImportService --> StationRepository
    DataImportService --> MeasurementRepository
    DataImportService --> AnalysisService : roda a análise após importar
    AnalysisService --> MlServiceClient
    AnalysisService --> AnalysisRunRepository
    AnalysisService --> StationRepository : lê os dados
    AnalysisService --> MeasurementRepository : lê os dados
    ImageService --> PhotoProcessor
    ImageService --> VisionAnalyzer
    ImageService --> ImageStorage
    ImageService --> WaterImageRepository
    ImageService --> StationService : cria ponto novo
    AssistantService --> AssistantContextBuilder
    AssistantService --> OllamaClient
    AssistantService --> ChatMessageRepository
    DashboardService --> AnalysisService
    DashboardService --> DataService
    DashboardService --> ImageService

    JwtService ..|> TokenIssuer
    HttpMlServiceClient ..|> MlServiceClient
    OllamaVisionAnalyzer ..|> VisionAnalyzer
    OllamaVisionAnalyzer --> OllamaClient
    LocalImageStorage ..|> ImageStorage
    JpaRepositories ..|> UserRepository
    JpaRepositories ..|> StationRepository
    JpaRepositories ..|> MeasurementRepository
    JpaRepositories ..|> AnalysisRunRepository
    JpaRepositories ..|> WaterImageRepository
    JpaRepositories ..|> ChatMessageRepository
    JwtAuthenticationFilter --> JwtService
```

`JpaRepositories` resume os adaptadores `JpaUserRepository`, `JpaStationRepository` etc. Cada um é só
`interface JpaXRepository extends Repository<X, Id>, XRepository`.

## 3. Serviço ML (Python) — módulos

![Serviço ML](img/classes-ml-python.png)

```mermaid
classDiagram
    direction LR
    class main_py {
        <<FastAPI>>
        GET /health
        POST /analyze
    }
    class schemas_py {
        <<pydantic>>
        AnalyzeRequest
        AnalysisResult
    }
    class pipeline_py {
        <<caso de uso>>
        run(AnalyzeRequest) AnalysisResult
    }
    class cleaning_py {
        <<domain>>
        valida, interpola, média diária
        mínimo 6 leituras por dia
    }
    class iqa_py {
        <<domain>>
        curvas CETESB/NSF
        classe Ótima..Péssima
    }
    class alerts_py {
        <<domain>>
        limites CONAMA 357
    }
    class anomaly_py {
        <<ml>>
        Isolation Forest + z-score
    }
    class classification_py {
        <<ml>>
        Random Forest
    }
    class clustering_py {
        <<ml>>
        K-Means + PCA
    }
    class trends_py {
        <<ml>>
        Mann-Kendall sazonal + Sen
    }
    main_py --> schemas_py
    main_py --> pipeline_py
    pipeline_py --> cleaning_py
    pipeline_py --> iqa_py
    pipeline_py --> alerts_py
    pipeline_py --> anomaly_py
    pipeline_py --> classification_py
    pipeline_py --> clustering_py
    pipeline_py --> trends_py
```
