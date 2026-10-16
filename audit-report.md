# WhatsApp Bot — Full Command Audit Report
**Date:** 2026-10-13
**Scope:** `~/workspace/whatsapp-bot/src/exe/` — all ~306 command keys (172 built-in `KNOWN_COMMANDS` in `lib/bot.js` + 134 `NEW_COMMANDS` across batch1–7)
**Method:** read-only code audit by 9 parallel workers; every external API live-tested with curl from the bot's own VM on 2026-10-13. No code was modified.

## Executive summary

| Verdict | Count (deduped) |
|---|---|
| **Working** | ~225 |
| **Broken** | **22** |
| **Suspect** (degraded, wrong data, or fragile) | **~54** |

The bot is not "full of bugs" in the wiring sense — dispatch works, ~166/177 core switch labels and all batch handlers are registered. The real problems are **dead third-party APIs** (the #1 cause), **duplicate `case` labels shadowing each other**, **hardcoded/stale data presented as live**, and **missing conversation memory in the AI**. Details below.

### Cross-cutting root causes (read first)
1. **AI has zero conversation memory — confirmed by design.** `askAI` builds messages as `[system, current message]` only. No per-user history exists anywhere (`ai.js`, `bot.js`, `store.js`). Every turn is stateless. This is the user's "LLM context nahi samajhta, peeche ki baat bhool jata hai" complaint — it's architectural, not a bug.
2. **Command always beats AI.** Dispatch order: message hooks → `NEW_COMMANDS` → built-in switch → AI fallback (DMs only). Any natural message whose first word matches a command (e.g. "choose chai or coffee") gets hijacked by the command. In groups the AI fallback never runs at all.
3. **Voice-note replies are degraded by a real bug:** `bot.js:615-619` calls `askAI(transcript, {systemPrompt, model, senderName})` but `askAI(prompt, senderName='Friend')` takes a string — the voice-optimized prompt is silently dropped and `"[object Object]"` leaks into the AI prompt.
4. **Downloader engine collapse:** all 4 Cobalt instances dead, Siputzx 503, GuruAPI dead, tikwm... (see Downloaders section). TikTok (TikWM) and YouTube (btch + 1 Invidious) partially work; Instagram/Twitter/Pinterest/Facebook/CapCut/Spotify/Reddit are effectively broken.
5. **"Wrong song" is a matching bug, not API death:** `searchAndDownloadSong` takes `results[0]` blindly with no title/artist check, and prefers the 30-second JioTune ringtone preview over the full track.
6. **Timers don't survive the ~hourly VM restart:** `pollsched`, `sendlater`, `meeting`, `cryptoalert` all use in-memory `setTimeout` — they almost never fire.
7. **Meme/joke content is tiny:** 15 roasts, 10 chutkulay, 10 meme templates — nowhere near the 100+ the user wants. Fresh memes come from meme-api.com (alive).
8. **All games share one bug:** state is keyed per-chat, so group members overwrite each other's games.

---

## BROKEN commands (22)

| # | Command | What's wrong | File:Line |
|---|---|---|---|
| 1 | `mp3 <link>` (video→audio) | Duplicate `case 'mp3'` — the song case at L1023 shadows the v2a case at L1219, which is unreachable. `mp3 <link>` searches JioSaavn for the URL string instead of extracting audio. Workaround: use `v2a`/`tomp3`/`audio` | `lib/bot.js:1219` (dead) vs `:1023` (wins) |
| 2 | `joke` (2nd handler) | Duplicate `case 'joke'` — first label (memes.js) shadows the tools.js `getRandomJoke` block, which never fires | `lib/bot.js:2106` |
| 3 | `latifa` (2nd handler) | Same duplicate-case shadowing as above | `lib/bot.js:2107` |
| 4 | `chutkula` (2nd handler) | Same duplicate-case shadowing as above | `lib/bot.js:2109` |
| 5 | voice-note auto-reply | `askAI(transcript, {systemPrompt, model, senderName})` — wrong signature; options object swallowed, voice prompt ignored, `"[object Object]"` injected into AI prompt | `lib/bot.js:615-619`, `lib/ai.js:152` |
| 6 | `mausam`/`mosam <city>` (natural-language weather intent) | Treats `getWeather()`'s string return as an object → replies "Weather in undefined / Temperature: undefined / Condition: undefined". (The `weather` command itself is fine) | `lib/bot.js:2962-2963` |
| 7 | `editphoto` | Gemini vision payload uses snake_case `inline_data`/`mime_type`; REST API expects camelCase `inlineData`/`mimeType` → photo silently dropped, always "Photo samajh nahi aayi" | `lib/batch1-fun-ai.js:329` |
| 8 | `pindl` | Only engine `api.siputzx.my.id` returns HTTP 503 `{"code":503,"error":"All nodes failed"}` | `lib/batch2-media-tools.js:231` |
| 9 | `spotidl` / `spotify` | Same dead Siputzx API (`/api/d/spotify`) → 503, always errors | `lib/batch2-media-tools.js:273,288` |
| 10 | `redditdl` | Reddit `.json` returns HTTP 403 from server IPs → always throws | `lib/batch2-media-tools.js:235` |
| 11 | `tempemail` / `fakemail` | `1secmail.com` dead from this server (curl 000, DNS bogon) → always "Temp email nahi ban saka" | `lib/batch2-media-tools.js:516,544` |
| 12 | `umrah` | Alias resolves to `hajj` with `query=''` → always shows the HAJJ guide, never the Umrah guide (handler branches on query text, but alias resolution discards the command name) | `lib/batch3-deen-edu.js:612` |
| 13 | `ghusl` | Alias resolves to `wudu` with `query=''` → always shows WUDU steps, never ghusl steps | `lib/batch3-deen-edu.js:803` |
| 14 | `pin` | Advertised in the Group Control menu but only `pinmsg` is registered — typing `pin` hits "unknown command" | `lib/batch4-groups-auto.js:860` (menu) vs `:328` (handler) |
| 15 | `stocks` | Stooq `/q/l/` CSV endpoint 404s from this VM → always "rate nahi mil saka". No live path | `lib/batch5-biz-money.js:680-688` |
| 16 | `goldrate` | Stooq half dead → always falls through to hardcoded `~Rs 278,000/tola` frozen guess | `lib/batch5-biz-money.js:703-716` |
| 17 | `salarytax` | Hardcoded slabs are FY2024-25 (5/15/25/30/35%) but labeled "FY2025-26" — real FY2025-26 slabs are 1/11/23/30/35%. Tax figures are wrong | `lib/batch5-biz-money.js:735-744` |
| 18 | `price` | Menu advertises `!price add <item> | <rate>` but HANDLERS only registers `pricelist` — `!price` doesn't exist | `lib/batch5-biz-money.js:877` |
| 19 | `train` | Hardcoded 12-route static array with approximate times, no API — fails the real-time requirement | `lib/batch6-health-news.js:496-523` |
| 20 | `crypto` / `btc` / `eth` | `api.binance.com` returns HTTP 451 (Unavailable For Legal Reasons) from this server's egress IP → always "Couldn't retrieve current crypto prices" | `lib/tools.js:52`, `lib/bot.js:1797` |
| 21 | `lyrics` | `api.lyrics.ovh/v1` 404s even for well-known songs (endpoint degraded) → always "Lyrics nahi mile" | `lib/batch7-more.js:119` |
| 22 | `emailcheck` | Command doesn't exist anywhere — missing feature, not a code bug | — |

### Missing features (user asked about, don't exist)
- `sciencequiz` — only `science` (daily facts) exists; `!sciencequiz` gets no response (`lib/batch3-deen-edu.js`)
- `emailcheck`/`email verify` — no such command (`lib/batch7-more.js`)
- `bemyage` — only `age` exists, no alias (`lib/batch2-media-tools.js:642`)
- `groupstatus`/`gstatus` exist in `bot.js:1862` but are invisible in the Group Control menu — the "status show nahi kar raha" complaint (`lib/batch4-groups-auto.js` menu)
- No `invoke` command exists anywhere in the codebase (user found the name confusing — it's likely `rmsgs`/`pollsched`/`welcomebiz`)
- Link→MP3 exists only as `v2a`/`tomp3`/`audio` (works via fallback chain); `mp3 <link>` is broken per #1

## SUSPECT commands (~54, deduped)

### Downloaders & media (engines half-dead)
| Command | Issue | File:Line |
|---|---|---|
| `dl`/`video`/`tiktok`/`reel`/`ig`/`insta`/`yt`/`fb`/`twitter`/`x`/`capcut`/`snapchat`/`threads`/`likee`/`kwai`/`vimeo`/`dailymotion` (+aliases, 32 keys) | Primary engines dead (all 4 Cobalt instances curl 000, Siputzx 503, GuruAPI 000, tiklydown 000, vxtwitter 403, fxtwitter endpoint changed). Fallbacks alive: TikWM (TikTok ✓), btch `youtube` + `fbdown` ✓, Invidious 1/3 ✓. Net: TikTok/YouTube partial; IG/Twitter/Pinterest/CapCut mostly broken | `lib/bot.js:1066`, `lib/downloader.js:27-32` |
| `song`/`music`/`gana`/`mp3 <query>` | Blind `results[0]`/`videos[0]` matching (no title/artist check) = wrong-song bug; prefers 30s JioTune preview over full 320kbps track; sends `.mp4` audio as `audio/mpeg` | `lib/downloader.js:935,942,990`, `lib/bot.js:705,1020` |
| `v2a`/`tomp3`/`audio` | Primary engine dead Cobalt; works only via `downloadVideo` fallback; quoted-video path sends whole video as audio (no extraction) | `lib/bot.js:1216`, `lib/downloader.js:845` |
| `photo`/`image`/`img`/`pic`/`wallpaper` | DDG scrape fragile; on failure sends a **hardcoded unrelated Unsplash gradient** as if it were the search result — guaranteed wrong image | `lib/downloader.js:1016,1040` |
| `meme`/`sound`/`sfx` | `findMemeSound(query, fallbackToRandom=true)` returns a **random** sound on no match instead of "not found" | `lib/media.js:140` |
| `dmd` | Dailymotion URL is an m3u8 playlist — user gets a text link, not a video | `lib/batch2-media-tools.js:248` |
| `vimeodl` | Vimeo gates `files.progressive` on most videos → frequent null | `lib/batch2-media-tools.js:259` |
| `ytpl` | Scrapes YouTube HTML (bot-check prone); processes songs sequentially, each a full downloader race — slow | `lib/batch2-media-tools.js:290` |
| `soundboard` header | Menu says "(41 Sounds)" but list has 66 entries | `lib/bot.js:1293,2666` |

**Downloader engine liveness (verified 2026-10-13):** DEAD — Cobalt ×4, Siputzx, GuruAPI, tiklydown, vxtwitter, fxtwitter(JSON). ALIVE — TikWM, btch `youtube`/`fbdown`, Invidious `f5.si` (1/3), JioSaavn search + auth-token, meme-api.com, myinstants.com (66 sound URLs ✓). "Slow" causes: sequential dead-engine races (~7s before error), `ytpl` per-song races, `sendMediaUrl` buffers whole files (up to 60MB) in RAM.

### AI / fun / games (batch1)
| Command | Issue | File:Line |
|---|---|---|
| `imggen` | Pollinations keyless endpoint alive but no SLA — flaky, generic "try again" errors | `lib/batch1-fun-ai.js:303` |
| `translate`/`tr` | MyMemory free tier alive but anonymous quota throttles under group use | `lib/batch1-fun-ai.js:370` |
| `personality` | Per-chat state — group members overwrite each other's quizzes; answers not validated | `lib/batch1-fun-ai.js:455` |
| `tictactoe` | Per-chat state collision; bot plays pure random, never blocks | `lib/batch1-fun-ai.js:487` |
| `hangman` | Per-chat state collision | `lib/batch1-fun-ai.js:521` |
| `quizgame`/`quiz` | Per-chat question state collision (scoring correctly per-sender) | `lib/batch1-fun-ai.js:546` |
| `guessnum` | Per-chat collision; `parseInt('50abc')` accepted as 50 | `lib/batch1-fun-ai.js:598` |
| `wordchain` | Per-chat collision | `lib/batch1-fun-ai.js:622` |
| `emojimovie` | Per-chat collision; only 20 hardcoded movies; loose substring matching | `lib/batch1-fun-ai.js:652` |
| `scramble` | Per-chat collision | `lib/batch1-fun-ai.js:680` |
| `mathduel` | Per-chat collision | `lib/batch1-fun-ai.js:698` |
| `joke`/`chutkula`/`latifa`/`aqwal`/`poetry`/`roast`/`fact` | Tiny hardcoded lists (15 roasts, 10 jokes, 10 templates) — the "generic replies" complaint. Fresh image memes via meme-api.com ✓ | `lib/memes.js` |

### Islamic & education (batch3)
| Command | Issue | File:Line |
|---|---|---|
| `zakat` | Stooq gold/silver 404 from this host → silently falls back to hardcoded "andazan" rates; "live rate" never works here | `lib/batch3-deen-edu.js:571-572` |
| `dictionary`/`dict` | dictionaryapi.dev ✓ + MyMemory ✓ alive, but Urdu translations are crowd-sourced — live test returned a vandalized/vulgar word as the "meaning" | `lib/batch3-deen-edu.js:806-822` |
| `hadithday` | 8am scheduler only runs if `botRef` was captured by an earlier batch3 command; 60s tick must land exactly on minute 00 | `lib/batch3-deen-edu.js:1088` |
| `wordday` | Working (deterministic daily pick, no API) | `lib/batch3-deen-edu.js:830` |
| `mathquiz` | Working — two-turn Q&A tested ✓ (complaints are UX, not breakage) | `lib/batch3-deen-edu.js` |
| prayer times / quran / hadith / hijri / qibla | All live: aladhan.com ✓, api.alquran.cloud ✓, jsdelivr hadith-api (all 6 books) ✓, open-meteo geocoding ✓ | `lib/islamic.js` |

### Groups & automation (batch4)
| Command | Issue | File:Line |
|---|---|---|
| `antilink` / `antispam` / `slowmode` | No bot-admin check; deletes are `.catch(()=>{})` → feature says "ON" but silently does nothing without admin | `lib/batch4-groups-auto.js:135,145,230` |
| `pollsched` | In-memory `setTimeout` (up to 7 days) wiped on every ~hourly VM restart → scheduled polls almost never fire | `lib/batch4-groups-auto.js:336` |
| `fwd`/`autoforward` | No admin check — any member can exfiltrate all group text; text-only, drops media. on/off both work ✓ | `lib/batch4-groups-auto.js:409` |
| `rmsgs` | No admin check — any member can set recurring group spam | `lib/batch4-groups-auto.js:431` |
| `rsswatch`/`keywordalert`/`welcomebiz` | No admin checks — any member can add feeds/keywords or make bot DM numbers | `lib/batch4-groups-auto.js:355,381,456` |
| `inactive` | Bot self-exclusion compares JIDs; Baileys `sock.user.id` often has `:device` suffix → bot can appear in its own inactive list | `lib/batch4-groups-auto.js:276` |
| `afk` | Never auto-clears when the AFK user chats again; mentions keep firing | `lib/batch4-groups-auto.js:197` |
| `unpin` | Registered and working but missing from menu — undiscoverable | `lib/batch4-groups-auto.js:331` |
| Duplicates | 21 intentional alias pairs (fine); structural duplicate: "16. Group Control" + "17. Automation" menus overlap (user wants merged); batch7 hosts group commands (`votekick`, `groupicon`, `grouplink`…) outside batch4 | `lib/batch4-groups-auto.js` |

### Money & business (batch5)
| Command | Issue | File:Line |
|---|---|---|
| `cryptoalert` | CoinGecko feed live ✓, but alert loop only starts on command and dies on restart; invalid coin names accepted silently | `lib/batch5-biz-money.js:623-676` |
| `sendlater` / `meeting` | In-memory timers lost on restart | `lib/batch5-biz-money.js:326-342,506-531` |
| `forex` | `open.er-api.com` live ✓ (rates updated 12 Oct 2026) but **query ignored** — `!forex USD PKR` returns the fixed USD list | `lib/batch5-biz-money.js:721-730` |
| `orderbook` | Orders stored globally, not per-user — group members share one book | `lib/batch5-biz-money.js:392-428` |
| `review` | `review list` shows all feedback + names to anyone in DM (admin check only in groups) — privacy leak | `lib/batch5-biz-money.js:592-619` |
| `billsplit` | `Math.round()` per share → shares can sum ≠ total | `lib/batch5-biz-money.js:831-851` |
| `folio` | CoinGecko live ✓ but menu example omits required `<buy_usd>` arg | `lib/batch7-more.js:520-546` |
| Business Plus section | Junk drawer: `dietplan`, `essay`, `presentation` aren't business; `invoice`/`quotation`/`receipt` are 3 overlapping doc commands across two batches | `lib/batch7-more.js:443-561` |

### News, sports, health (batch6)
| Command | Issue | File:Line |
|---|---|---|
| `cricket` | Google News RSS is live but returns **headlines, not live scores** (code admits it); query ignored | `lib/batch6-health-news.js:297` |
| `football` | `api.openligadb.de` live but **Bundesliga-only, latest finished matchday** — no live scores, no other leagues | `lib/batch6-health-news.js:311` |
| `paknews` | Live headlines ✓ but query ignored (`!paknews india` → Pakistan news) | `lib/batch6-health-news.js:283` |
| Health (`water`/`med`/`sleep`/`steps`/`calories`/`workout`/`recipe`) | Working — stateful trackers with per-minute tick reminders; AI-generated plans | `lib/batch6-health-news.js:199-591` |

### Daily utilities, voice, AI (batch7 + libs)
| Command | Issue | File:Line |
|---|---|---|
| `numinfo`/`siminfo` | No real API — static Pakistani prefix table; wrong for ported/unknown/non-PK numbers | `lib/batch2-media-tools.js:546` |
| `qrscan`/`scanqr` | Code correct (api.qrserver.com reachable) — user's failure likely rate limits/image quality; needs live repro | `lib/batch2-media-tools.js:467` |
| `votekick` | "votekick yes" double-processed (message hook + command dispatch) — works but noisy | `lib/batch7-more.js:230` |
| `whois`/`dnslookup` | API alive but hackertarget free tier 100/day/IP — silent fails at scale | `lib/batch7-more.js:311,320` |
| `memegen`/`cartoon`/`avatar`/`ocr`/`imgtr` | Depend on lazy `sharp` import — silently degrade if missing | `lib/batch7-more.js:41-46` |
| `antakshari` | English-transliteration first-letter matching; Roman-Urdu lyrics fail the check | `lib/batch7-more.js:600` |
| Groq model ID | `qwen/qwen3.8-27b` (`lib/ai.js:39`) — Groq's published Qwen3 ID is `qwen/qwen3-32b`; if wrong, Groq 404s and silently falls back to Gemini (verify!) | `lib/ai.js:39` |
| Deepgram key | Hardcoded in source (`lib/voice.js:4`) with env fallback — works but secret exposed; if revoked/quota-exhausted, every voice note shows the user-visible transcription error | `lib/voice.js:4` |
| `owner`/`developer` | Reply points to `http://localhost:3000` — useless to the WhatsApp user; dashboard is on the rotating pinggy tunnel | `lib/bot.js:2400` |
| `calc`/`math` | `Function()` eval with char allowlist — low risk, minor hardening gap | `lib/tools.js` |
| Working utilities (verified live) | `shorturl` (is.gd ✓), `barcode` (tec-it ✓), `websnap` (thum.io ✓), `sitedown` ✓, `unitconv` ✓, `currency` (er-api ✓), `timeconv` ✓, `dictionary` ✓, `wordday` ✓, `iploc` ✓, `quransearch` ✓, `prayermonth` ✓, `aqi`/`uv` ✓ | batch2/batch7 |

---

## Per-area counts

| Area | Working | Broken | Suspect |
|---|---|---|---|
| Core `bot.js` switch (~177 labels) | ~166 | 5 (mp3-dup, joke/latifa/chutkula-dup, voice askAI, mausam intent) | 7 |
| Batch1 fun/AI/games (+memes) | 15 | 1 (editphoto) | 11 |
| Batch2 media/downloaders (+downloader.js/media.js) | 53 | 7 (pindl, spotidl/spotify, redditdl, tempemail/fakemail, mp3-link) | 49* |
| Batch3 islamic/edu (+islamic.js) | 37 | 2 (umrah, ghusl) | 3 |
| Batch4 groups/automation | 20 | 1 (pin) | 9+ |
| Batch5 biz/money | 15 | 4 (stocks, goldrate, salarytax, price) | 7 |
| Batch6 health/news/sports | 12 | 1 (train) | 3 |
| Batch7 utilities/voice/AI (+tools/voice/ai.js) | 13+ | 6 (tempemail, crypto, lyrics, emailcheck, askAI-args, weather-undefined) | 6 |
| **Total (deduped)** | **~225** | **22** | **~54** |

\* Batch2's suspect count is dominated by the 32-key downloader family sharing dead engines.

## Priority fix list (biggest user impact first)
1. **Add per-user conversation history** to `askAI` (fixes "context bhool jata hai") — `lib/ai.js` + `lib/store.js`
2. **Fix voice-note `askAI` call** `bot.js:615-619` (fixes "voice ka reply sahi nahi")
3. **Replace dead downloader engines** (Cobalt ×4, Siputzx) or re-rank races to live ones first (fixes "downloaders slow/broken")
4. **Fix song matching**: verify title/artist instead of blind `[0]`; prefer full track over 30s preview (`lib/downloader.js:935,942,990`)
5. **Remove duplicate `case` labels** (`mp3` L1219, `joke`/`latifa`/`chutkula` L2106-2109) — 30-second fixes
6. **Fix `editphoto` payload** `inline_data`→`inlineData` (`lib/batch1-fun-ai.js:329`)
7. **Fix `salarytax` slabs** to FY2025-26; replace `stocks`/`goldrate` stooq source; fix `crypto` backend (Binance 451 → CoinGecko)
8. **Fix `umrah`/`ghusl` alias-query bug** (pass command name or branch on alias, `lib/batch3-deen-edu.js:609,800`)
9. **Persist timers** (`pollsched`, `sendlater`, `meeting`, `cryptoalert`) or re-arm on boot
10. **Real-time sports**: `cricket`/`football` need a live-score API (currently headlines/Bundesliga-history)
11. **Expand meme/joke lists** toward 100+ or route through AI; fix per-chat game state → per-sender
12. Move the Deepgram key out of source into env (`lib/voice.js:4`); verify Groq model ID (`lib/ai.js:39`)
