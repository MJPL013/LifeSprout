#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="${APP_NAME:-lifesprout}"
SERVER_PORT="${SERVER_PORT:-3001}"
PUBLIC_PORT="${PUBLIC_PORT:-80}"
NODE_MAJOR="${NODE_MAJOR:-20}"
DO_PULL="false"
DO_NGINX="true"
DO_SYSTEM="true"

usage() {
  cat <<USAGE
LifeSprout AWS setup/run script

Usage:
  bash scripts/aws_lifesprout.sh [options]

Options:
  --pull          Run git pull before install/build/restart.
  --no-nginx      Do not configure nginx; use http://HOST:${SERVER_PORT}/ instead.
  --skip-system   Skip apt/yum package installation.
  --help          Show this help.

Environment variables:
  SERVER_PORT     Internal Node server port. Default: 3001
  PUBLIC_PORT     Public nginx port. Default: 80
  APP_NAME        PM2/nginx app name. Default: lifesprout
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pull) DO_PULL="true" ;;
    --no-nginx) DO_NGINX="false" ;;
    --skip-system) DO_SYSTEM="false" ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown option: $1"; usage; exit 1 ;;
  esac
  shift
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"
CLIENT_DIR="$ROOT_DIR/client"
ENV_FILE="$SERVER_DIR/.env"
ENV_TEMPLATE="$SERVER_DIR/.env.template"

log() { printf '\n[%s] %s\n' "$APP_NAME" "$1"; }
warn() { printf '\n[%s warning] %s\n' "$APP_NAME" "$1"; }
need_cmd() { command -v "$1" >/dev/null 2>&1; }

install_system_dependencies() {
  if [[ "$DO_SYSTEM" != "true" ]]; then
    log "Skipping system package installation."
    return
  fi

  if need_cmd apt-get; then
    log "Installing system dependencies with apt."
    sudo apt-get update -y
    sudo apt-get install -y curl ca-certificates gnupg git build-essential nginx

    local current_major="0"
    if need_cmd node; then
      current_major="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
    fi

    if [[ "$current_major" -lt "$NODE_MAJOR" ]]; then
      log "Installing Node.js ${NODE_MAJOR}.x."
      curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
      sudo apt-get install -y nodejs
    fi
  elif need_cmd dnf; then
    log "Installing system dependencies with dnf."
    sudo dnf install -y nodejs npm git nginx gcc-c++ make
  elif need_cmd yum; then
    log "Installing system dependencies with yum."
    sudo yum install -y nodejs npm git nginx gcc-c++ make
  else
    warn "No apt, dnf, or yum found. Install Node.js ${NODE_MAJOR}+, npm, git, and nginx manually."
  fi

  if ! need_cmd pm2; then
    log "Installing PM2 globally."
    sudo npm install -g pm2
  fi
}

prepare_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    log "Creating server/.env from template."
    if [[ -f "$ENV_TEMPLATE" ]]; then
      cp "$ENV_TEMPLATE" "$ENV_FILE"
    else
      cat > "$ENV_FILE" <<ENV
PORT=${SERVER_PORT}
TICK_INTERVAL_MS=5000
USE_OLLAMA=false
VOICE_PROVIDER=deepgram
DEEPGRAM_TTS_MODEL=aura-2-thalia-en
DEEPGRAM_STT_MODEL=nova-3
ENV
    fi
  fi

  if ! grep -q '^PORT=' "$ENV_FILE"; then
    printf '\nPORT=%s\n' "$SERVER_PORT" >> "$ENV_FILE"
  fi

  if grep -Eq 'your_.*_key_here|your_gemini_key_here|your_deepgram_key_here' "$ENV_FILE"; then
    warn "server/.env still contains placeholder API keys. Edit it for real LLM/Deepgram behavior."
    warn "The app can still run, but cloud voice/LLM calls may fall back or show friendly errors."
  fi
}

install_node_dependencies() {
  log "Installing backend dependencies."
  cd "$SERVER_DIR"
  if [[ -f package-lock.json ]]; then npm ci; else npm install; fi

  log "Installing frontend dependencies."
  cd "$CLIENT_DIR"
  if [[ -f package-lock.json ]]; then npm ci; else npm install; fi
}

build_client() {
  log "Building React client."
  cd "$CLIENT_DIR"
  npm run build
}

start_pm2() {
  log "Starting/restarting backend with PM2."
  cd "$SERVER_DIR"
  PORT="$SERVER_PORT" pm2 start index.js --name "$APP_NAME" --update-env || PORT="$SERVER_PORT" pm2 restart "$APP_NAME" --update-env
  pm2 save

  if need_cmd systemctl; then
    log "Registering PM2 startup for reboot persistence."
    sudo env PATH="$PATH" pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null || true
    pm2 save
  fi
}

configure_nginx() {
  if [[ "$DO_NGINX" != "true" ]]; then
    warn "nginx disabled. Open port ${SERVER_PORT} and use http://HOST:${SERVER_PORT}/"
    return
  fi

  if ! need_cmd nginx; then
    warn "nginx not installed. Open port ${SERVER_PORT} and use http://HOST:${SERVER_PORT}/"
    return
  fi

  log "Configuring nginx public port ${PUBLIC_PORT} -> Node port ${SERVER_PORT}."
  local site_file="/etc/nginx/sites-available/${APP_NAME}"
  local enabled_file="/etc/nginx/sites-enabled/${APP_NAME}"

  sudo tee "$site_file" >/dev/null <<NGINX
server {
    listen ${PUBLIC_PORT};
    server_name _;

    client_max_body_size 4m;

    location /socket.io/ {
        proxy_pass http://127.0.0.1:${SERVER_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:${SERVER_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX

  if [[ -d /etc/nginx/sites-enabled ]]; then
    sudo ln -sf "$site_file" "$enabled_file"
    sudo rm -f /etc/nginx/sites-enabled/default
  fi

  sudo nginx -t
  sudo systemctl enable nginx >/dev/null 2>&1 || true
  sudo systemctl restart nginx || sudo service nginx restart
}

public_host() {
  local host=""
  if need_cmd curl; then
    host="$(curl -fsS --max-time 2 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || true)"
  fi
  if [[ -z "$host" ]]; then
    host="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi
  printf '%s' "${host:-YOUR_EC2_PUBLIC_IP}"
}

main() {
  log "Using project root: $ROOT_DIR"

  if [[ "$DO_PULL" == "true" ]]; then
    log "Pulling latest git changes."
    cd "$ROOT_DIR"
    git pull --ff-only
  fi

  install_system_dependencies
  prepare_env
  install_node_dependencies
  build_client
  start_pm2
  configure_nginx

  local host
  host="$(public_host)"
  local url="http://${host}/"
  if [[ "$DO_NGINX" != "true" ]]; then
    url="http://${host}:${SERVER_PORT}/"
  fi

  log "Deployment complete."
  echo "App URL: ${url}"
  echo "PM2 status: pm2 status"
  echo "Logs: pm2 logs ${APP_NAME}"
  echo "Edit env from repo root: nano server/.env && pm2 restart ${APP_NAME} --update-env"
}

main "$@"