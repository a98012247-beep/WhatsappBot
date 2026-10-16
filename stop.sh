#!/bin/bash
# Stop the WhatsApp bot and record the stop state so the watchdog
# does not restart it against the user's decision.
set -u
BOT_DIR="/home/hatch/workspace/whatsapp-bot"
PID_FILE="$BOT_DIR/bot.pid"
STOP_FILE="$BOT_DIR/STOPPED"

# RACE SAFETY (2026-10-15): record the deliberate stop FIRST, before touching
# the process. The old ordering wrote STOPPED at the end (after sleep 2 +
# kills), leaving a window where a watchdog worker that passed its pre-check
# could invoke start.sh before the flag landed — overriding the stop.
touch "$STOP_FILE"

if [ -f "$PID_FILE" ]; then
  PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "${PID:-}" ] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null
    sleep 2
    kill -9 "$PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
fi
pkill -f "node.*whatsapp-bot/" 2>/dev/null || true
echo "$(date -u +%FT%TZ) stopped by user" >> "$BOT_DIR/logs/out.log"
echo "bot stopped; watchdog will stay quiet until start.sh runs again"
