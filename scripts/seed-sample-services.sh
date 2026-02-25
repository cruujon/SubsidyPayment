#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

if [[ -f "${REPO_ROOT}/.env" ]]; then
  set -a
  source "${REPO_ROOT}/.env"
  set +a
fi

DEFAULT_DATABASE_URL="postgres://postgres:postgres@localhost:55432/payloadexchange"
DATABASE_URL="${DATABASE_URL:-$DEFAULT_DATABASE_URL}"

if ! command -v psql >/dev/null 2>&1; then
  echo "エラー: psql コマンドが見つかりません。PostgreSQL クライアントをインストールしてください。"
  exit 1
fi

echo "対象DB: $DATABASE_URL"
echo "サンプルServiceデータを投入中..."

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO sponsored_apis (
  id,
  name,
  sponsor,
  description,
  upstream_url,
  upstream_method,
  upstream_headers,
  price_cents,
  budget_total_cents,
  budget_remaining_cents,
  active,
  service_key
)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'GitHub API',
    'GitHub Enterprise',
    'Create a campaign for GitHub API usage, sponsored by GitHub Enterprise.',
    'https://api.github.com',
    'POST',
    '{"x-demo-provider":"github","content-type":"application/json"}'::jsonb,
    25,
    300000,
    300000,
    true,
    'sponsored-api-11111111-1111-1111-1111-111111111111'
  )
ON CONFLICT (id)
DO UPDATE SET
  name = EXCLUDED.name,
  sponsor = EXCLUDED.sponsor,
  description = EXCLUDED.description,
  upstream_url = EXCLUDED.upstream_url,
  upstream_method = EXCLUDED.upstream_method,
  upstream_headers = EXCLUDED.upstream_headers,
  price_cents = EXCLUDED.price_cents,
  budget_total_cents = EXCLUDED.budget_total_cents,
  budget_remaining_cents = EXCLUDED.budget_remaining_cents,
  active = EXCLUDED.active,
  service_key = EXCLUDED.service_key;

SELECT service_key, name, sponsor, price_cents, budget_remaining_cents, active
FROM sponsored_apis
WHERE service_key = 'sponsored-api-11111111-1111-1111-1111-111111111111'
ORDER BY service_key;
SQL

echo "完了: サンプルServiceデータの投入が終了しました。"
