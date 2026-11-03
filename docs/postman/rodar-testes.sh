#!/usr/bin/env bash
# Roda a coleção do Postman pelo terminal, sem precisar de conta.
#   ./rodar-testes.sh            → tudo, menos a pasta 11 (que substitui os dados)
#   ./rodar-testes.sh login      → só o login
#   ./rodar-testes.sh permissoes → login + criar funcionária + testes de 403
cd "$(dirname "$0")"
case "${1:-tudo}" in
  login)      pastas=("1. Login (JWT)") ;;
  permissoes) pastas=("1. Login (JWT)" "2. Usuários (só ADMIN)" "9. Permissões: FUNCIONARIO recebe 403") ;;
  *)          pastas=("1. Login (JWT)" "2. Usuários (só ADMIN)" "3. Painel" "4. Estações" "5. Análise (machine learning)"
                      "6. Imagens (IA com visão)" "7. Anotações de campo" "8. Limno IA (Ollama)"
                      "9. Permissões: FUNCIONARIO recebe 403" "10. Limpeza (apaga o que os testes criaram)") ;;
esac
args=()
for p in "${pastas[@]}"; do args+=(-i "$p"); done
postman collection run AquaML.postman_collection.json -e AquaML-local.postman_environment.json "${args[@]}" 2>&1 \
  | grep -v 'Postman credentials are required\|postman login'
