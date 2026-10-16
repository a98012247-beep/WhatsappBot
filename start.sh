#!/bin/bash
# WhatsApp bot launcher / watchdog entry point.
# Persistent home storage: survives VM replacement. Safe to run repeatedly:
# it starts the bot only if it is not already running.
set -u
BOT_DIR="/home/hatch/workspace/whatsapp-bot"
PID_FILE="$BOT_DIR/bot.pid"
LOG_DIR="$BOT_DIR/logs"
ENTRY="${ENTRY:-src/exe/server.js}"

mkdir -p "$LOG_DIR"

# AUDIT (2026-10-15, temporary): log every invocation to trace the restart loop
echo "$(date -u +%FT%TZ) start.sh invoked args=[$*] ppid=$PPID parent=$(ps -o args= -p $PPID 2>/dev/null | head -c 80) stopped_exists=$([ -f "$BOT_DIR/STOPPED" ] && echo yes || echo no)" >> "$LOG_DIR/start-audit.log"

# A deliberate stop is honoured unless explicitly overridden with --force.
# RACE SAFETY (2026-10-15): STOPPED is ONLY deleted on the --force path.
# The old code did an unconditional `rm -f` after the check, leaving a
# TOCTOU window: a worker that checked (absent), then got delayed while
# stop.sh created STOPPED, would delete the flag and start the bot anyway.
# Now the flag survives unless the caller explicitly forces.
if [ -f "$BOT_DIR/STOPPED" ]; then
  if [ "${1:-}" != "--force" ]; then
    exit 0  # deliberately stopped; honour it, leave flag intact
  fi
  rm -f "$BOT_DIR/STOPPED"  # --force: deliberate override, clear the flag
fi

# 1. Find node (system node may vanish after VM replacement; check nvm fallback)
NODE_BIN=""
for cand in /usr/bin/node /usr/local/bin/node "$HOME/.nvm/versions/node"/*/bin/node; do
  if [ -x "$cand" ]; then NODE_BIN="$cand"; break; fi
done
if [ -z "$NODE_BIN" ]; then
  echo "$(date -u +%FT%TZ) FATAL: node binary not found" >> "$LOG_DIR/err.log"
  exit 1
fi

# 2. Install deps if missing (node_modules lives in home, persists)
if [ -f "$BOT_DIR/package.json" ] && [ ! -d "$BOT_DIR/node_modules" ]; then
  echo "$(date -u +%FT%TZ) installing deps..." >> "$LOG_DIR/out.log"
  (cd "$BOT_DIR" && "$NODE_BIN" "$HOME/.nvm/versions/node"/*/bin/npm install --omit=dev >> "$LOG_DIR/out.log" 2>&1 || npm install --omit=dev >> "$LOG_DIR/out.log" 2>&1) || true
fi

# 3. Already running? (pidfile + process check)
if [ -f "$PID_FILE" ]; then
  OLD_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "${OLD_PID:-}" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    exit 0  # healthy, nothing to do
  fi
fi
# stale pidfile or no pidfile: also guard against a duplicate by entry script
# name (argv is "/usr/bin/node src/exe/server.js" — no whatsapp-bot/ in it)
if pgrep -f "[s]rc/exe/server\.js" >/dev/null 2>&1; then
  exit 0
fi

# 3b. Dashboard port: prefer 3000, but if something else already has the TCP
# port bound (e.g. a video render's dev server), fall back to 3001 so the bot
# still starts. Written to .port so the tunnel and debugging know where the
# dashboard is. NOTE (2026-10-13): check the TCP port itself, NOT an HTTP
# response — render-v2.mjs binds :3000 without answering GET /, so the old
# curl-based check kept picking 3000 and node died on EADDRINUSE.
BOT_PORT="${PORT:-3000}"
if [ "$BOT_PORT" = "3000" ] && (exec 3<>/dev/tcp/127.0.0.1/3000) 2>/dev/null; then
  BOT_PORT=3001
fi
export PORT="$BOT_PORT"
echo "$BOT_PORT" > "$BOT_DIR/.port"

# 4. Start detached, record pid
if [ ! -f "$BOT_DIR/$ENTRY" ]; then
  echo "$(date -u +%FT%TZ) FATAL: entry file $ENTRY missing" >> "$LOG_DIR/err.log"
  exit 1
fi
cd "$BOT_DIR"
nohup "$NODE_BIN" "$ENTRY" >> "$LOG_DIR/out.log" 2>> "$LOG_DIR/err.log" &
echo $! > "$PID_FILE"
echo "$(date -u +%FT%TZ) started pid $(cat "$PID_FILE") entry=$ENTRY port=$BOT_PORT node=$NODE_BIN" >> "$LOG_DIR/out.log"
