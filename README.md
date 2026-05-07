# the-tribe-bot

WhatsApp bot for THE TRIBE.

## Local run

```bash
npm install
npm start
```

Without `BOT_COMMAND`, the bot runs continuously, starts the dashboard, listens for
new WhatsApp group joins, and uses the internal scheduler.

## GitHub Actions run

The workflow in `.github/workflows/whatsapp-bot.yml` runs the bot in one-shot mode:

```bash
BOT_COMMAND=run-due npm start
```

`run-due` checks the current Berlin time and sends only jobs that are due. Manual
workflow runs can also trigger a specific command, for example `daily-highlights`
or `wednesday-poll`.

The first workflow run may print a WhatsApp QR code in the log. Scan it once. The
workflow caches `.wwebjs_auth` and the bot state files for later runs.

## GitHub Secrets

Optional but recommended:

- `WHATSAPP_CHAT_ID`
- `WHATSAPP_TUESDAY_RUN_CHAT_ID`
- `WHATSAPP_JAM_SESSION_CHAT_ID`
- `WHATSAPP_ANNOUNCEMENTS_CHAT_ID`
- `WHATSAPP_AUSGEHEN_CHAT_ID`
- `WHATSAPP_COMMUNITY_SOURCE_CHAT_IDS`
- `TRIBE_TUESDAY_RUN_IMAGE_URL`
- `TRIBE_JAM_SESSION_IMAGE_URL`
- `TRIBE_THURSDAY_FOOTBALL_IMAGE_URL`
- `TRIBE_KENNENLERNABEND_IMAGE_URL`
- `IG_ACCESS_TOKEN`
- `IG_USER_ID`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Notes:

- GitHub Actions is not a reliable replacement for always-on `group_join`
  handling. Local or VPS continuous mode is still needed for instant welcome
  messages.
- Do not commit `.wwebjs_auth`, `.wwebjs_cache`, state JSON files, `.env`, or
  `node_modules`.
