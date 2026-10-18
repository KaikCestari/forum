# AquaML — Rust (processamento) + Python (IA/ML) + Java 21 (estrutura principal)

ROOT      := $(abspath .)
CARGO     ?= $(shell command -v cargo 2>/dev/null || echo $(HOME)/.cargo/bin/cargo)
MVN       ?= $(shell command -v mvn 2>/dev/null || echo $(HOME)/.local/bin/mvn)
# Java 21 é obrigatório (o pom.xml recusa outras versões).
JAVA_HOME ?= $(HOME)/.local/opt/jdk-21
JAVA      := $(JAVA_HOME)/bin/java
PYTHON    := ml/.venv/bin/python
PORT      ?= 7070
SEED      ?= 42

export JAVA_HOME

.PHONY: setup build data process analyze pipeline run test clean

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

run:                                 ## sobe o painel em http://localhost:$(PORT)
	PORT=$(PORT) AQUAML_ROOT=$(ROOT) $(JAVA) -jar app/target/aquaml.jar

test:                                ## testes das três linguagens
	cd processor && $(CARGO) test -q
	cd ml && .venv/bin/python -m pytest -q
	cd app && $(MVN) -q -B test

clean:
	rm -rf data/raw/*.csv data/processed/* data/results/*
	cd processor && $(CARGO) clean
	cd app && $(MVN) -q clean
