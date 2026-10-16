# 🚀 AwaxBot WhatsApp SuperBot & Web Studio

An all-in-one autonomous **WhatsApp Bot** with real-time **Web Management Dashboard**, built using **Node.js**, **@whiskeysockets/baileys**, and **Google Gemini AI**.

---

## ✨ Features

1. **📱 Free Multi-Device QR Code Connection**
   - Connects directly using WhatsApp's multi-device web protocol.
   - Live pairing QR Code displayed right in your browser dashboard at `http://localhost:3000`.
   - Your phone does not need to stay online once paired.
   - Zero Meta business verification fees or approval delays.

2. **🧠 AI Intelligence (Google Gemini)**
   - Ask AI questions anytime using `!ai <question>`.
   - Option to enable auto-AI responses on 1-on-1 chats.
   - Customizable system instructions & bot persona.

3. **⚡ Keyword Auto-Responder & FAQ**
   - Pre-configured rules for `hello`, `price`, `hours`, `location`, `contact`.
   - Visual dashboard to add, edit, enable/disable trigger rules with Contains, Exact, or Regex matching.

4. **🛡️ WhatsApp Group Status & Audit Hub**
   - Detailed security & permission audit of joined groups with `!groupstatus` (or `!gstatus`).
   - Member count, admin count, chat permissions (Muted vs Open), and bot privileges.
   - Interactive Group Manager in web dashboard with one-click group mute/unmute.

5. **🎫 Customer Support Desk**
   - Customers can file issues: `!support Need help with setup`
   - Ticket management with status toggles (`OPEN` / `RESOLVED`).

6. **👥 Group Admin & Management Utilities**
   - `!tagall [message]` / `!everyone`: Mentions all members in the group.
   - `!hidetag <message>`: Silent ghost mention.
   - `!promote` / `!demote @user`: Admin role assignment.
   - `!mute` / `!unmute`: Group chat permission locking.
   - `!warn @user`: Issues warning strikes (1 to 3).
   - `!kick @user`: Removes offending participants (requires bot admin).
   - `!groupinfo`: Shows group title, description, and participant count.
   - Auto-welcome banner when new members join.

7. **💬 Live Console & Direct Broadcaster**
   - Real-time feed of all incoming WhatsApp chats and bot replies.
   - Quick reply box to send a message directly from the browser to any number.

---

## 🛠️ Quick Start

### 1. Start the Bot & Web Dashboard
```bash
npm start
```
The server will start at:
👉 **[http://localhost:3000](http://localhost:3000)**

### 2. Pair with WhatsApp
1. Open **WhatsApp** on your mobile phone.
2. Go to **Settings** (or 3 dots ⋮ on Android) > **Linked Devices**.
3. Tap **Link a Device**.
4. Scan the QR code displayed on **http://localhost:3000**.
5. Once scanned, the status pill will turn green: **Connected & Active**!

---

## 📖 WhatsApp Commands Reference

| Category | Command | Description | Example |
| :--- | :--- | :--- | :--- |
| **🤖 AI & Chat** | `!ai <query>` | Natural Roman Urdu conversation via Google Gemini | `!ai easy dinner ideas kya hain?` |
| **🕌 Islamic** | `!surah <name/no>` | 114 Surahs info, Arabic name, Urdu meaning, Ayahs | `!surah Yasin` |
| **🕌 Islamic** | `!ayah <surah:ayah>` | Arabic text + Urdu (Jalandhry) & English translation | `!ayah 2:255` |
| **🕌 Islamic** | `!tafseer <surah:ayah>` | Tafheem-ul-Quran (Maududi) Urdu Tafseer | `!tafseer 1:1` |
| **🕌 Islamic** | `!tilawat <surah> [qari]` | Full Surah MP3 Audio sent directly to WhatsApp | `!tilawat Rahman` |
| **🕌 Islamic** | `!hadith <book> <no>` | Bukhari, Muslim, Tirmidhi, Abu Dawud, Nasai, Ibn Majah | `!hadith bukhari 1` |
| **🕌 Islamic** | `!namaz <city>` | Accurate Fajr, Dhuhr, Asr, Maghrib, Isha & Hijri date | `!namaz Karachi` |
| **🕌 Islamic** | `!date` / `!hijri` | Today's Hijri Islamic date, month info & holy events | `!hijri` / `!events` |
| **🕌 Islamic** | `!allahnames` & `!dua` | 99 Names of Allah with meanings & daily Masnoon Duas | `!allahnames` / `!dua` |
| **⚡ Downloader**| `!dl <url>` / `!tiktok` / `!reel` / `!yt` | Ultra-fast video downloader (TikTok, Reels, Shorts) | `!dl https://...` |
| **🎉 Fun** | `!latifa` / `!shairi` / `!quote` | Desi Roman Urdu jokes, fun shayari & quotes | `!latifa` / `!shairi` |
| **📱 QR Tools** | `!qr <text/link>` | Generates high-res QR code image | `!qr https://google.com` |
| **🧮 Math** | `!calc <expression>` | Safe arithmetic & percentage calculator | `!calc (150 * 4) + 15%` |
| **🌤️ Weather** | `!weather <city>` | Live temperature & weather forecast | `!weather New York` |
| **🪙 Crypto** | `!crypto` | Real-time BTC, ETH, SOL, BNB, XRP rates | `!crypto` |
| **⏰ Reminders** | `!remind <time> <task>` | Sets automated reminder with @mention | `!remind 10m Call back client` |
| **🛍️ Business** | `!catalog` | Displays services & packages catalog | `!catalog` |
| **🎫 Support** | `!support <issue>` | Registers high-priority support ticket | `!support Cannot reset password` |
| **💌 Feedback** | `!feedback <msg>` | Submits customer feedback | `!feedback Great response speed!` |
| **🎉 Fun** | `!quote` / `!joke` / `!fact` | Inspiring quotes, jokes, or science trivia | `!joke` |
| **🎲 Chance** | `!flip` / `!roll` | Coin flip (Heads/Tails) or roll a dice 🎲 | `!flip` |
| **👥 Groups** | `!tagall [msg]` | Mentions all members in the group | `!tagall Meeting starting now!` |
| **👥 Groups** | `!hidetag <msg>` | Ghost mention all members silently | `!hidetag Important update` |
| **👥 Moderation** | `!warn @user` | Issues warning strike (1 to 3) | `!warn @user` |
| **👥 Moderation** | `!kick @user` | Removes member from group (bot=admin) | `!kick @user` |
| **👑 Admin** | `!promote` / `!demote @user`| Promotes/demotes group admins | `!promote @user` |
| **🔒 Group** | `!mute` / `!unmute` | Closes/opens group chat for members | `!mute` |
| **✏️ Group** | `!setname <title>` | Changes group subject title | `!setname Project Alpha` |
| **ℹ️ Group** | `!groupinfo` | Displays group member count & bio | `!groupinfo` |
| **📊 Diagnostics**| `!ping` / `!status` / `!time`| Bot latency, uptime & world clocks | `!ping` |
| **📋 Guide** | `!menu` / `!rules` | Displays master command list & rules | `!menu` |

---

## ⚙️ Configuration

- **Web Dashboard**: Adjust AI keys, persona prompts, and toggle modules dynamically at [http://localhost:3000](http://localhost:3000).
- **Environment variables (`.env`)**:
  ```env
  PORT=3000
  GEMINI_API_KEY=your_gemini_api_key_here
  ```
- **Free Gemini API Key**: Obtain a key for free from [Google AI Studio](https://aistudio.google.com/app/apikey).
