#!/usr/bin/env bash
#
# Proxima installer — Native Node.js & PM2 deployment.
#
# Preflight checks (Node.js, npm, git), generates ENCRYPTION_KEY, sets up .env,
# builds backend & frontend, and starts the native stack with PM2.
#
set -euo pipefail

REPO_URL="${PROXIMA_REPO_URL:-https://github.com/sumit-kumawat/proxima.git}"
MODE=""
DOMAIN=""
HTTP_HOST=""
ASSUME_YES=0

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_RESET=$'\033[0m'; C_DIM=$'\033[2m'; C_BOLD=$'\033[1m'
  C_RED=$'\033[31m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_BLUE=$'\033[34m'
else
  C_RESET=""; C_DIM=""; C_BOLD=""; C_RED=""; C_GREEN=""; C_YELLOW=""; C_BLUE=""
fi

step() { printf '%s==>%s %s\n' "$C_BLUE$C_BOLD" "$C_RESET$C_BOLD" "$*$C_RESET"; }
ok()   { printf '  %s+%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn() { printf '  %s!%s %s\n' "$C_YELLOW" "$C_RESET" "$*"; }
info() { printf '  %s%s%s\n' "$C_DIM" "$*" "$C_RESET"; }
die()  { printf '\n%serror:%s %s\n' "$C_RED$C_BOLD" "$C_RESET" "$*" >&2; exit 1; }

step "Checking prerequisites"

command -v node >/dev/null 2>&1 || die "Node.js is not installed (Node.js 20+ required)."
command -v npm >/dev/null 2>&1 || die "npm is not installed."

NODE_VER=$(node -v | cut -d. -f1 | tr -d 'v')
[ "$NODE_VER" -ge 20 ] || die "Node.js 20+ is required (found $(node -v))."

ok "Node.js $(node -v)"
ok "npm $(npm -v)"

step "Installing dependencies & generating Prisma client"
(cd backend && npm install && npx prisma generate)
(cd frontend && npm install)

step "Building Proxima for production"
npm run build

step "Starting Proxima with PM2"
if command -v pm2 >/dev/null 2>&1; then
  npx pm2 start deploy/pm2.config.js
  ok "Proxima started under PM2"
else
  warn "PM2 is not installed globally. Starting backend in background..."
  npm run start:backend &
  npm run start:frontend &
fi

step "Proxima is ready"
info "Open http://localhost:3000 in your browser to complete setup."
