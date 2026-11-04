# To-Do

Persönliche To-Do-App (nur für den Besitzer) auf Cloudflare Workers.

- **Ansichten:** Heute (mit Tagesplan aus Google Kalender), Diese Woche, Demnächst, Projekte, Labels, Suche, Erledigt
- **Aufgaben:** Projekte, Unteraufgaben, Notizen, Labels, Priorität 1–4, Fälligkeit mit Uhrzeit, Dauer, Wiederholungen
- **Schnelleingabe:** „Zahnarzt morgen 15 Uhr p1 #Privat @telefon 15min“, „jeden Montag“, „monatlich am 1.“
- **Erinnerungen:** Web-Push (iPhone/iPad als Home-Bildschirm-App, PC), Mail für Prio-1-Aufgaben, Standort per iOS-Kurzbefehl
- **Claude:** MCP-Server unter `/mcp` mit OAuth (Google-Login des Besitzers)

Einrichtung: siehe [SETUP.md](SETUP.md).

## Aufbau

| Pfad | Inhalt |
|---|---|
| `src/index.js` | Einstieg, Routing, OAuth für Claude |
| `src/api.js` | REST-API der Web-App |
| `src/mcp.js` | MCP-Server (Tools für Claude) |
| `src/tasks.js` | Datenlogik, Wiederholungen, Erinnerungsplanung |
| `src/notify.js` | Cron-Versand, Standort-Webhook |
| `src/push.js` | Web Push (VAPID + Verschlüsselung) |
| `src/google.js` | Google Login, Kalender, Gmail |
| `public/` | Oberfläche (PWA) |
| `migrations/` | D1-Datenbankschema |
