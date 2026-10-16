#!/bin/bash
# SSH reverse tunnel for the AwaxBot dashboard via the egress HTTP proxy.
# Uses the bot's actual dashboard port (from .port; server moved to 3001 when
# another job took 3000) instead of a hardcoded port.
cd ~/workspace/whatsapp-bot
PORT="$(cat .port 2>/dev/null || echo 3000)"
exec ssh -t -t -N \
  -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
  -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \
  -o ConnectTimeout=20 -o BatchMode=yes \
  -p 443 -R0:localhost:"$PORT" \
  -o ProxyCommand="$HOME/workspace/whatsapp-bot/proxy-ssh-helper.sh %h %p" \
  tcp@a.pinggy.io
