#!/usr/bin/env bash
# scripts/wait-for-db.sh — keluar 0 hanya setelah Postgres siap,
# lalu pastikan database test `formforge_test` ada.
set -euo pipefail
for i in $(seq 1 40); do
  if docker compose exec -T db pg_isready -U formforge -d formforge >/dev/null 2>&1; then
    echo "db ready after ${i} attempt(s)"
    break
  fi
  sleep 2
done

# DB test terpisah (test TIDAK boleh jalan di DB dev).
if ! docker compose exec -T db psql -U formforge -d postgres -tAc \
      "SELECT 1 FROM pg_database WHERE datname='formforge_test'" | grep -q 1; then
  docker compose exec -T db psql -U formforge -d postgres -c "CREATE DATABASE formforge_test"
  echo "created database formforge_test"
else
  echo "database formforge_test already exists"
fi
