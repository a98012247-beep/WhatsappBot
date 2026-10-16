# APPLIED 2026-10-12 ~20:20 PKT — dashboard basic-auth patch

Status: APPLIED with Hudson's explicit approval (he tapped "Add a password
to the dashboard" 2026-10-12 ~20:18 PKT). Credentials: DASH_USER=awax,
DASH_PASS=<24-char generated, in ~/workspace/whatsapp-bot/.env>,
handed to Hudson in chat. Bot restarted, verified 401 without/wrong creds,
200 with creds, WhatsApp reconnected as 923293209581 via saved session.

## Why
The AwaxBot dashboard (Express, port 3000) currently has NO authentication.
If it is ever exposed on a public link, anyone with the link can:
- `POST /api/send` — send WhatsApp messages AS his number 923293209581
- `POST /api/logout` — kill his WhatsApp session (forces a fresh QR scan)
- `POST /api/restart` — restart the bot
- `GET /api/logs` + the socket.io message stream — read his message content

So: no public link without a password first.

## The patch (insert into src/exe/server.js, right after `app.use(express.json());`)

```js
// HOSTING PATCH (dashboard auth): HTTP basic auth on every dashboard route
// when DASH_USER/DASH_PASS are set. Unset = current localhost behavior,
// nothing changes. Mark: HOSTING PATCH.
const DASH_USER = process.env.DASH_USER || '';
const DASH_PASS = process.env.DASH_PASS || '';
if (DASH_USER && DASH_PASS) {
  const crypto = await import('node:crypto');
  const wantU = Buffer.from(DASH_USER);
  const wantP = Buffer.from(DASH_PASS);
  app.use((req, res, next) => {
    const hdr = req.headers.authorization || '';
    const [scheme, encoded] = hdr.split(' ');
    let ok = false;
    if (scheme === 'Basic' && encoded) {
      try {
        const [u, p] = Buffer.from(encoded, 'base64').toString('utf8').split(':');
        ok = u !== undefined && p !== undefined &&
             crypto.timingSafeEqual(Buffer.from(u), wantU) &&
             crypto.timingSafeEqual(Buffer.from(p), wantP);
      } catch { ok = false; }
    }
    if (!ok) {
      res.set('WWW-Authenticate', 'Basic realm="AwaxBot Dashboard"');
      return res.status(401).send('Auth required');
    }
    next();
  });
}
```

Note: `server.js` is an ES module (`import` syntax), so the dynamic
`await import('node:crypto')` at top level works. Static `import crypto`
at the top is cleaner — use that if editing by hand.

## To activate (after his approval)
1. Apply the patch above (mark `HOSTING PATCH` like the proxy patch in lib/bot.js).
2. Ask Hudson for a dashboard username + password (his choice, kept in chat only).
3. Set env in the bot's launch: add to `start.sh` before the node invocation, or
   better a `~/workspace/whatsapp-bot/.env` line pair:
   `DASH_USER=<his pick>` / `DASH_PASS=<his pick>` (dotenv is already loaded
   by server.js — no extra wiring needed).
4. Restart the bot via stop.sh/start.sh; verify 401 without creds, 200 with.
5. THEN solve the tunnel (cloudflared quick-tunnel is TLS-blocked by the
   egress proxy as of 2026-10-12; localtunnel hangs with no URL — neither
   works today) and hand him `https://<tunnel-url>` + the credentials.

## What NOT to do
- Never hand him (or anyone) a public dashboard URL without this patch active.
- Never put the credentials in logs, files in the repo, or the tunnel URL message
  beyond the one delivery to him.
