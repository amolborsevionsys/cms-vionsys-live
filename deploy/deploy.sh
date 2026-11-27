#!/usr/bin/env bash
# Build and (re)start this app on the EC2 server. Run from the project folder:
#   bash deploy/deploy.sh
#
# The same script is used by the website and the CMS; only these two lines differ.
APP_NAME="vionsys-cms"        # pm2 process name (see deploy/ecosystem.config.cjs)
DB_SCHEMA="cms"              # PostgreSQL schema this app owns

set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Missing .env in $(pwd). Create it first (see DEPLOY.md)." >&2
  exit 1
fi

# Both apps share one database. Refuse to touch the schema unless DATABASE_URL
# points at this app's own schema, so one app can never alter the other's tables.
DB_URL_LINE="$(grep -E '^DATABASE_URL=' .env | tail -1)"
if [[ "$DB_URL_LINE" != *"schema=${DB_SCHEMA}"* ]]; then
  echo "DATABASE_URL in .env must end with ?schema=${DB_SCHEMA} for this app. Stopping." >&2
  exit 1
fi

echo "==> Pull latest code"
git pull --ff-only

echo "==> Install dependencies (also generates the Prisma client)"
npm ci

echo "==> Apply database schema (${DB_SCHEMA})"
npx prisma db push --skip-generate

echo "==> Build"
npm run build

echo "==> Start / reload"
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 reload deploy/ecosystem.config.cjs --update-env
else
  pm2 start deploy/ecosystem.config.cjs
  pm2 save
  echo "Run the 'sudo env PATH=... pm2 startup' command printed below once, so apps restart after a reboot:"
  pm2 startup systemd -u "$USER" --hp "$HOME" | tail -1
fi

pm2 status
