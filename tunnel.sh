#!/bin/bash
# Public tunnel for the bot's web dashboard (Cloudflare quick tunnel).
# Idempotent: starts only if not already running. The public URL changes
# on every restart; the current one is always in logs/tunnel.log.
set -u
BOT_DIR="/home/hatch/workspace/whatsapp-bot"
PID_FILE="$BOT_DIR/tunnel.pid"
CLOUDFLARED="/home/hatch/workspace/bin/cloudflared"

if [ ! -x "$CLOUDFLARED" ] && [ -x /usr/local/bin/cloudflared ]; then
  cp /usr/local/bin/cloudflared "$CLOUDFLARED" 2>/dev/null || true
fi
if [ ! -x "$CLOUDFLARED" ]; then
  echo "$(date -u +%FT%TZ) tunnel: cloudflared binary missing" >> "$BOT_DIR/logs/tunnel.log"
  exit 1
fi

if [ -f "$PID_FILE" ]; then
  P="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "${P:-}" ] && kill -0 "$P" 2>/dev/null; then
    exit 0
  fi
fi

cd "$BOT_DIR"
: > logs/tunnel.log
nohup "$CLOUDFLARED" tunnel --url http://localhost:3000 --no-autoupdate > logs/tunnel.log 2>&1 &
echo $! > "$PID_FILE"
echo "$(date -u +%FT%TZ) tunnel started pid $(cat "$PID_FILE")" >> logs/tunnel.log
