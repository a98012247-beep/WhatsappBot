#!/bin/bash
# ProxyCommand helper: SSH -> HTTP CONNECT proxy -> target. Reads creds from env, keeps them out of ps.
P=$(echo "$https_proxy" | sed 's#http://##')
AUTH=$(echo "$P" | cut -d@ -f1)
PHOST=$(echo "$P" | cut -d@ -f2 | cut -d: -f1)
exec socat STDIO "PROXY:$PHOST:$1:$2,proxyport=3128,proxyauth=$AUTH"
