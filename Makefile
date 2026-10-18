# AquaML — Rust (processamento) + Python (IA/ML) + Java 21 (API) + React (painel) + H2 (banco) + Llama (assistente)

ROOT      := $(abspath .)
CARGO     ?= $(shell command -v cargo 2>/dev/null || echo $(HOME)/.cargo/bin/cargo)
MVN       ?= $(shell command -v mvn 2>/dev/null || echo $(HOME)/.local/bin/mvn)
# Java 21 é obrigatório (o pom.xml recusa outras versões).
JAVA_HOME ?= $(HOME)/.local/opt/jdk-21
JAVA      := $(JAVA_HOME)/bin/java
PYTHON    := ml/.venv/bin/python
PORT      ?= 7070
SEED      ?= 42
# Llama servido localmente pelo Ollama (https://ollama.com).
OLLAMA      ?= $(shell command -v ollama 2>/dev/null || echo ollama)
OLLAMA_URL  ?= http://localhost:11434
LLAMA_MODEL ?= llama3.2
DB_URL      := jdbc:h2:file:$(ROOT)/data/db/aquaml;AUTO_SERVER=TRUE

export JAVA_HOME

.PHONY: setup build data process analyze pipeline run web web-build llama h2 test clean clean-db

setup: ml/.venv build                ## instala dependências e compila tudo

ml/.venv: ml/requirements.txt
	python3 -m venv ml/.venv
	ml/.venv/bin/pip install -q -r ml/requirements.txt
	@touch ml/.venv

build:                               ## compila o processador Rust e a aplicação Java
	cd processor && $(CARGO) build --release
	cd app && $(MVN) -q -B package -DskipTests

data:                                ## gera dados sintéticos (SEED=42)
	$(PYTHON) ml/generate_data.py --out data/raw --seed $(SEED)

process:                             ## etapa Rust
	processor/target/release/aqua-processor --input data/raw/measurements.csv --out data/processed

analyze:                             ## etapa Python (IA/ML)
	$(PYTHON) ml/analyze.py

pipeline: data process analyze       ## pipeline completo sem o servidor

run:                                 ## sobe a API Java em http://localhost:$(PORT)
	PORT=$(PORT) AQUAML_ROOT=$(ROOT) OLLAMA_URL=$(OLLAMA_URL) LLAMA_MODEL=$(LLAMA_MODEL) \
		$(JAVA) -jar app/target/aquaml.jar

web/node_modules: web/package-lock.json
	cd web && npm install
	@touch web/node_modules

web: web/node_modules                ## sobe o painel React em http://localhost:5173 (com make run em outro terminal)
	cd web && AQUAML_API=http://localhost:$(PORT) npm run dev

web-build: web/node_modules          ## gera o painel de produção em web/dist
	cd web && npm run build

llama:                               ## baixa o modelo Llama no Ollama (LLAMA_MODEL=llama3.2)
	$(OLLAMA) pull $(LLAMA_MODEL)

h2:                                  ## abre o console web do H2 sobre o banco do AquaML
	$(JAVA) -cp app/target/aquaml.jar org.h2.tools.Console -url "$(DB_URL)" -user sa -password ""

test:                                ## testes de Rust, Python, Java e do painel
	cd processor && $(CARGO) test -q
	cd ml && .venv/bin/python -m pytest -q
	cd app && $(MVN) -q -B test
	cd web && npm test

clean:                               ## apaga arquivos gerados e compilados (o banco H2 fica)
	rm -rf data/raw/*.csv data/processed/* data/results/*
	cd processor && $(CARGO) clean
	cd app && $(MVN) -q clean

clean-db:                            ## apaga o banco H2, inclusive dados reais importados
	rm -f data/db/*.db
