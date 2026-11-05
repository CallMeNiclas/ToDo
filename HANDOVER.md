# NTD's – Übergabe für neue Chats

Persönliche To-Do-App von Niclas („Nic“), gebaut mit Claude. Kommunikation: Deutsch, direkt & knapp.
Wenn ein neuer Chat startet: diese Datei lesen, dann `README.md` / `SETUP.md` nur bei Bedarf.

## Links
- App: https://todo.hinske-niclas.workers.dev
- Claude-Connector (MCP): https://todo.hinske-niclas.workers.dev/mcp
- Repo: https://github.com/CallMeNiclas/ToDo (Branch `main`, Push = automatischer Deploy über Cloudflare Workers Builds, `npm run deploy` inkl. D1-Migrationen)

## Stack
- Cloudflare Worker (`src/`), statische PWA (`public/`, Vanilla JS, kein Build), D1 (`todo-db`), KV (`OAUTH_KV`), Cron jede Minute, Smart Placement
- Login: Google OAuth, nur `hinske.niclas@gmail.com`. Secrets in Cloudflare: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Google-App ist veröffentlicht (Produktion, unverifiziert), Scopes: calendar.readonly, gmail.send
- Zeitzone Europe/Berlin

## Dateien
| Datei | Inhalt |
|---|---|
| `src/index.js` | Routing, OAuth-Provider für Claude (`/authorize`, `/oauth/*`), Fehlerseite, Cron |
| `src/api.js` | REST-API der App (`/api/*`), Bootstrap |
| `src/mcp.js` | MCP-Tools für Claude (Aufgaben, Projekte, Kalender, Health, Habits, Modus) |
| `src/tasks.js` | Datenlogik, Validierung, Wiederholungen, Erinnerungsplanung, Settings |
| `src/notify.js` | Cron-Versand (Push/Mail), Standort-Webhook |
| `src/mode.js` | Fokus-Modus Arbeit/Privat/Alles, Zeitplan, Urlaub, iOS-Fokus-Webhook |
| `src/focus.js` | Fokus-Timer |
| `src/habits.js` | Streaks (nur Aufgaben mit `habit=1`) |
| `src/health.js` | Apple Health via „Health Auto Export“ (`/hooks/health`) |
| `src/google.js` | Google Token, Kalender, Gmail |
| `src/push.js` | Web Push (VAPID + aes128gcm) |
| `public/js/app.js` | gesamte Oberfläche |
| `public/js/parse.js` | Schnelleingabe-Parser (Deutsch, auch gesprochen) |
| `public/css/app.css` | Styles (Touch-Größen über `@media (pointer: coarse)`) |
| `public/sw.js` | Service Worker (Offline-Shell, Push). Bei UI-Änderungen `todo-shell-vNN` hochzählen |
| `migrations/` | D1-Schema, fortlaufend nummeriert |

## Features (Stand)
Übersicht-Dashboard (Kacheln pro Gerät anpassbar, Masonry), Heute mit Tagesplan (Google-Termine in Terminfarben),
Woche (1/3/7 Tage), Demnächst, Projekte mit Hauptprojekt/Unterprojekten (1 Ebene, Haken „Hauptprojekt“),
Labels, Suche (nur im Menü), Erledigt, Deadline-Feld, Dauer, Wiederholungen, Erinnerungen (Push; Mail nur Prio 1 & nicht wiederkehrend),
Standort-Erinnerungen (iOS-Kurzbefehl), Offline-Modus mit Sync-Status, Fokus-Modus (Zeitplan Mo–Fr 08:15–18:15, iPhone-Fokus, manuell, Urlaub)
mit Hintergrundfoto je Modus, Fokus-Timer (+ Kurzbefehl „NTD Fokus“ für Dynamic Island), Streaks (opt-in: WeWard, Inbox Zero),
Apple Health (Schritte/Ziel, Schlaf, weitere Werte), Spracheingabe, anpassbare Menüleiste unten, optimistische UI (sofortige Reaktion).

## Nics Daten
- Projekte: `🛋️fundus7` (Hauptprojekt, Bereich Arbeit) mit `☑️To-Do‘s` und `🔁 W. To-Do’s`; `🫡Nic` (Privat)
- Geräte: iPhone 18 Pro Max, iPad Pro M4 13", Windows-PC. Große Touch-Ziele gewünscht, kein Zoomen.

## Arbeitsweise
- Lokal testen: `npx wrangler dev` mit `.dev.vars` (`DEV_LOGIN=1`), Login über `/auth/dev`; Screenshots mit Playwright (Skripte in `scripts/`)
- Vor dem Push: `npx wrangler deploy --dry-run` (Build-Check), Service-Worker-Version hochzählen
- Live-Daten über den Connector prüfen (Tools `mcp__Todo__*`)
- Offene Ideen („maybe“): Planungsansicht „Morgen“ inkl. Tourenplan aus Google Sheets, Todoist-Import
