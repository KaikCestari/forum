# AquaML — Java Spring (backend DDD) + Python (serviço de ML) + React (frontend) + Ollama (assistente)
# Rode cada serviço em um terminal: make ml, make backend, make frontend.

JAVA_HOME ?= $(HOME)/.local/opt/jdk-21
MVN       ?= $(shell command -v mvn 2>/dev/null || echo $(HOME)/.local/bin/mvn)
export JAVA_HOME

.PHONY: setup ml backend frontend test clean-db

setup:                 ## instala dependências das três partes
	cd ml-service && python3 -m venv .venv && .venv/bin/pip install -q -r requirements.txt
	cd backend && $(MVN) -q -B package -DskipTests
	cd frontend && npm install

ml:                    ## serviço de ML em http://localhost:8000
	cd ml-service && .venv/bin/uvicorn app.main:app --port 8000

backend:               ## API Java Spring em http://localhost:8080 (lê o .env da raiz)
	cd backend && $(MVN) -q -B package -DskipTests && $(JAVA_HOME)/bin/java -jar target/aquaml-backend.jar

frontend:              ## painel em http://localhost:5173
	cd frontend && npm run dev

test:                  ## testes das três partes
	cd ml-service && .venv/bin/python -m pytest -q
	cd backend && $(MVN) -q -B test
	cd frontend && npm test

clean-db:              ## apaga o banco H2 (inclusive dados importados)
	rm -f data/db/aquaml-spring*.db
