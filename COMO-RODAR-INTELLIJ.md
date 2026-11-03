COMO RODAR O AQUAML PELO INTELLIJ
=================================

São 3 partes, cada uma num terminal ou numa configuração de execução:
  1. Serviço de ML (Python)  -> http://localhost:8000
  2. Backend (Java Spring)   -> http://localhost:8080
  3. Frontend (React)        -> http://localhost:5173

Suba nessa ordem: ML, backend e frontend.


ANTES DA PRIMEIRA VEZ
---------------------
- JDK 21 (File > Project Structure > SDK). Funciona também o JDK 21 em ~/.local/opt/jdk-21.
- Python 3.11 ou mais novo.
- Node 20 ou mais novo.
- Arquivo .env na raiz do projeto: copie o .env.example e preencha OLLAMA_API_KEY e JWT_SECRET
  (JWT_SECRET precisa ter pelo menos 32 caracteres).

No terminal do IntelliJ (View > Tool Windows > Terminal), na raiz do projeto:

    cd ml-service
    python3 -m venv .venv
    .venv/bin/pip install -r requirements.txt
    cd ../frontend
    npm install

O backend o IntelliJ resolve sozinho pelo Maven (abra o backend/pom.xml e clique em "Load Maven Project").


1. SERVIÇO DE ML (PYTHON)
-------------------------
Pelo terminal do IntelliJ:

    cd ml-service
    .venv/bin/uvicorn app.main:app --port 8000

Ou como configuração (precisa do plugin Python):
  Run > Edit Configurations > + > Python
    Module name:       uvicorn
    Parameters:        app.main:app --port 8000
    Working directory: <projeto>/ml-service
    Interpreter:       <projeto>/ml-service/.venv/bin/python

Teste: http://localhost:8000/health deve responder {"status":"ok"}


2. BACKEND (JAVA SPRING)
------------------------
Run > Edit Configurations > + > Application
  Name:              AquaML Backend
  JDK:               21
  Main class:        br.forum.aquaml.AquamlApplication
  Module:            aquaml-backend
  Working directory: <projeto>/backend      <- IMPORTANTE

O working directory precisa ser a pasta backend, porque o backend lê o ../.env e grava o
banco em ../data/db. Com outra pasta, ele não acha o .env nem o banco.

Ou pelo terminal:

    cd backend
    mvn spring-boot:run

Endereços:
  Swagger:       http://localhost:8080/swagger-ui.html
  Console do H2: http://localhost:8080/h2-console
      JDBC URL: jdbc:h2:file:<projeto>/data/db/aquaml-spring
      User:     sa
      Password: (vazio)
      (troque a JDBC URL que vem preenchida, senão abre um banco vazio)

Login padrão: admin@aquaml.local / admin123


3. FRONTEND (REACT)
-------------------
Pelo terminal:

    cd frontend
    npm run dev

Ou como configuração:
  Run > Edit Configurations > + > npm
    package.json: <projeto>/frontend/package.json
    Command:      run
    Scripts:      dev

Abra http://localhost:5173 e entre com o login padrão.


RODAR OS TESTES
---------------
  Backend:  clique com o botão direito em backend/src/test/java > Run 'All Tests'
            (ou: cd backend && mvn test)
  ML:       cd ml-service && .venv/bin/python -m pytest -q
  Frontend: cd frontend && npm test


PROBLEMAS COMUNS
----------------
- "Port 8080 already in use": outro programa usa a porta. Pare o outro programa ou rode o
  backend com a variável de ambiente PORT=8081. Nesse caso, rode o frontend com
  AQUAML_API=http://localhost:8081.
- Backend sobe, mas a análise falha: o serviço de ML (passo 1) não está rodando.
- O assistente Limno não responde: confira OLLAMA_API_KEY no .env.
- Login cai toda vez que o backend reinicia: falta o JWT_SECRET no .env.
