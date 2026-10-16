#!/bin/bash
# tunnel-keepalive.sh — keeps the AwaxBot dashboard's public tunnel alive.
# Idempotent: exits quietly if the tunnel is already up and serving.
# On (re)start, writes the fresh public URL to tunnel/current_url.txt
# (free pinggy URLs rotate ~hourly, so always read the file, never cache it).
set -u
cd /home/hatch/workspace/whatsapp-bot || exit 1

url_ok() {
  [ -f tunnel/current_url.txt ] || return 1
  local url code
  url="$(cat tunnel/current_url.txt)"
  [ -n "$url" ] || return 1
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$url/api/status" 2>/dev/null)"
  [ "$code" = "401" ]  # 401 = tunnel reaches the bot and the auth gate is on
}

# Fast path: tunnel already serving
if pgrep -f "proxy-ssh-helper\.sh" >/dev/null 2>&1 && url_ok; then
  exit 0
fi

# Stale or dead — clean up and start fresh
pkill -f "proxy-ssh-helper\.sh" 2>/dev/null || true
sleep 1
rm -f tunnel/pg.log tunnel/current_url.txt
nohup script -qec "$HOME/workspace/whatsapp-bot/tunnel_ssh_shell.sh" /dev/null \
  > tunnel/pg.log 2>&1 &
echo "$!" > tunnel/tunnel.pid

# Wait up to ~70s for pinggy to print the public endpoint
for _ in $(seq 1 14); do
  sleep 5
  ep="$(grep -aoE 'tcp://[a-z0-9.-]+\.run\.pinggy[a-z.-]*:[0-9]+' tunnel/pg.log 2>/dev/null | head -1)"
  if [ -n "${ep:-}" ]; then
    echo "http://${ep#tcp://}" > tunnel/current_url.txt
    # confirm it serves before declaring success
    if url_ok; then exit 0; fi
  fi
done
exit 1
