# Project notes for Claude & DeepSeek

## Mode

Simple mode: read the repository, understand the codebase, and perform tasks
as requested. No auto-commit, no auto-push, no auto-PR, no auto-merge.
Confirm before any write operation.

### Ausnahme: MZ.9 Lead-/Konzeptseiten immer live stellen

Fertige Lead-/Konzeptseiten (`docs/leads/<id>/index.html`, gebaut mit dem
`mz9-lead-build`-Skill) gehen **immer automatisch live** — ohne Rückfrage:
committen → auf den Arbeitsbranch pushen → **direkt nach `main` mergen** →
`main` pushen. GitHub Pages deployt dann in ~1–2 Min. So ist jede neue
Konzeptseite sofort unter
`https://maikz91.github.io/the-tribe-bot/leads/<id>/` erreichbar.

## E-Mail-Versand: AgentMail (einziger Versandweg)

Der MZ.9 Lead-Agent verschickt **ausschließlich über AgentMail** (E-Mail-API
für Agenten) — **kein** Gmail/SMTP, **kein** nodemailer-Fallback mehr.
Verdrahtet in `lead_agent_deepseek/scripts/send_mail.js`.

- **Endpoint:** `POST https://api.agentmail.to/v0/inboxes/{inbox}/messages/send`
  mit `Authorization: Bearer $AGENTMAIL_API_KEY`.
- **Inbox / Absender:** `mz9-media-engineering-ai@agentmail.to`,
  Display-Name **„Maik Zschach"**.
- **API-Key:** kommt **nur** aus der Env-Var `AGENTMAIL_API_KEY` (niemals ins
  Repo committen). Ohne Key blockiert der Versand sauber statt zu senden.
  Optional: `AGENTMAIL_INBOX`, `AGENTMAIL_BASE` überschreiben Inbox/Base-URL.
- **Inline-Bilder:** Vorher/Nachher-Vergleich wird via
  `content_disposition:"inline"` + `content_id` (CID) gemappt — bleibt erhalten.
- **Test-Empfänger erzwingen:** `MAIL_TO_OVERRIDE=<adresse>` lenkt JEDE Mail an
  diese Adresse um (für Tests/Self-Sends, ohne echte Leads anzuschreiben).
- **Autonomer Lauf:** Damit `auto.js` Stufe 3 mailt, muss `AGENTMAIL_API_KEY`
  in der Umgebung gesetzt sein (wird an die `send_mail.js`-Subprozesse vererbt).
  Am besten als Environment-Variable des Cloud-Environments hinterlegen.
- **Mail-Optik (fix, nicht ungefragt ändern):** schwarz/weiß-„MZ.9"-Look —
  schwarzer Header oben, Inhalt schwarz auf weiß, **kein Grün**. Lösungs-Karten
  weiß mit schwarzem Akzentbalken (Lösung fett schwarz, Problem grau/durchgestrichen),
  CTA-Button schwarz, Footer-Links grau. So vom Inhaber bestätigt.

## Known issue: space in user path

The Windows username `Maik Zschach` contains a space. This workspace sits at
`C:\Users\Maik Zschach\the-tribe` — many tools (shell, read_file with offsets,
git, path-based operations) break on or misbehave with the space.

### Workarounds (apply in order of preference)

1. **Open workspace from a junction without spaces.** Create it once as admin:
   ```
   mklink /J C:\Users\MaikZschach "C:\Users\Maik Zschach"
   ```
   Then open `C:\Users\MaikZschach\the-tribe` as workspace in DeepSeek TUI.

2. **Clone/move the repo to a path without spaces**, e.g. `C:\dev\the-tribe`.

3. **When stuck:** use `grep_files` instead of `read_file` with offsets for
   targeted lookups. For shell commands, escape or avoid paths with spaces;
   prefer `git` operations that work on the current directory implicitly.

4. **If `read_file` returns file from line 1 regardless of offset**, the tool
   is hitting the space-in-path bug — use `grep_files` for the specific lines
   and verify with `exec_shell` (PowerShell) quoting the path carefully.

## Deployment

`docs/` is published via GitHub Pages from the `main` branch, so a merge
to `main` triggers an automatic deploy to `https://maikz91.github.io/the-tribe-bot/`
within ~1-2 minutes.
