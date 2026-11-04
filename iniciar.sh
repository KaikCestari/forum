#!/usr/bin/env bash
# Sobe o serviço de ML, o backend e o frontend. Ctrl+C desliga os três.
set -u
cd "$(dirname "$0")"
RAIZ=$(pwd)
LOGS="$RAIZ/logs"
mkdir -p "$LOGS"

if [ -d "$HOME/.local/opt/jdk-21" ]; then
  export JAVA_HOME="$HOME/.local/opt/jdk-21"
  export PATH="$JAVA_HOME/bin:$PATH"
fi
MVN=$(command -v mvn || echo "$HOME/.local/bin/mvn")

for porta in 8000 8080 5173; do
  if ss -ltn 2>/dev/null | grep -q ":$porta "; then
    echo "A porta $porta já está em uso. Feche o programa que usa essa porta e rode de novo."
    exit 1
  fi
done

[ -f .env ] || echo "Aviso: sem .env na raiz. Copie o .env.example e preencha OLLAMA_API_KEY e JWT_SECRET."

if [ ! -x ml-service/.venv/bin/uvicorn ]; then
  echo "Instalando as dependências do Python (só na primeira vez)..."
  (cd ml-service && python3 -m venv .venv && .venv/bin/pip install -q -r requirements.txt) || exit 1
fi
if [ ! -d frontend/node_modules ]; then
  echo "Instalando as dependências do frontend (só na primeira vez)..."
  (cd frontend && npm install --silent) || exit 1
fi

PIDS=()
parar() {
  echo
  echo "Desligando..."
  for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null; done
  wait 2>/dev/null
  exit 0
}
trap parar INT TERM

echo "Subindo o serviço de ML..."
(cd ml-service && exec .venv/bin/uvicorn app.main:app --port 8000) > "$LOGS/ml.log" 2>&1 &
PIDS+=($!)

echo "Compilando e subindo o backend..."
(cd backend && "$MVN" -q -B package -DskipTests && exec java -jar target/aquaml-backend.jar) > "$LOGS/backend.log" 2>&1 &
PIDS+=($!)

echo "Subindo o frontend..."
(cd frontend && exec npm run dev) > "$LOGS/frontend.log" 2>&1 &
PIDS+=($!)

esperar() {
  local nome=$1 url=$2 log=$3
  for _ in $(seq 120); do
    curl -s -o /dev/null "$url" && { echo "  ok  $nome"; return 0; }
    sleep 2
  done
  echo "  ERRO  $nome não subiu. Veja $log"
  return 1
}

echo "Aguardando..."
esperar "Serviço de ML" http://localhost:8000/health "$LOGS/ml.log"
esperar "Backend" http://localhost:8080/v3/api-docs "$LOGS/backend.log"
esperar "Frontend" http://localhost:5173 "$LOGS/frontend.log"

cat <<EOF

AquaML no ar:
  Aplicação      http://localhost:5173   (admin@aquaml.local / admin123)
  Swagger        http://localhost:8080/swagger-ui.html
  Console do H2  http://localhost:8080/h2-console
                 JDBC URL: jdbc:h2:file:$RAIZ/data/db/aquaml-spring  (usuário sa, sem senha)

Logs em $LOGS
Ctrl+C para desligar tudo.
EOF

wait
