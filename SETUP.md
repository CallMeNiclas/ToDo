# Einrichtung – Schritt für Schritt

Einmalig ca. 30 Minuten. Danach läuft alles automatisch: Jede Änderung am Code auf GitHub wird von Cloudflare automatisch veröffentlicht.

**Überblick:**
1. GitHub: Code speichern
2. Cloudflare: App hosten (kostenlos)
3. Google: Login, Kalender & Mail freischalten
4. Schlüssel in Cloudflare eintragen
5. Erster Login, Push auf iPhone/iPad/PC aktivieren
6. Claude verbinden
7. (Optional) Standort-Erinnerungen per Kurzbefehl

---

## 1. GitHub

1. Konto anlegen auf <https://github.com/signup> (falls noch keins vorhanden).
2. Neues **privates** Repository anlegen: <https://github.com/new>
   - Name: `ToDo`
   - Sichtbarkeit: **Private**
   - Sonst nichts ankreuzen → „Create repository“.
3. GitHub mit Claude verbinden: <https://claude.ai/connect-github> und die Claude-GitHub-App für das Repo `ToDo` installieren.
4. Claude Bescheid geben → Claude lädt den Code hoch.

## 2. Cloudflare

1. Konto anlegen auf <https://dash.cloudflare.com/sign-up> (kostenloser Plan reicht).
2. Links **Compute (Workers)** → **Workers & Pages** → **Create** → **Import a repository**.
3. GitHub verbinden und das Repo `ToDo` auswählen.
4. Einstellungen:
   - Project name: `todo`
   - Build command: *(leer lassen)*
   - Deploy command: `npm run deploy`
5. **Deploy** klicken. Cloudflare legt Datenbank und Speicher automatisch an.
6. Danach steht oben die Adresse der App, z. B. `https://todo.DEINNAME.workers.dev` → **notieren**, die brauchst du gleich.

## 3. Google Cloud (Login, Kalender, Gmail)

1. <https://console.cloud.google.com/projectcreate> → Projektname `To-Do` → Erstellen.
2. APIs aktivieren (jeweils Link öffnen → „Aktivieren“):
   - <https://console.cloud.google.com/apis/library/calendar-json.googleapis.com>
   - <https://console.cloud.google.com/apis/library/gmail.googleapis.com>
3. **OAuth-Zustimmungsbildschirm** (Google Auth Platform): <https://console.cloud.google.com/auth/overview>
   - „Jetzt starten“ → App-Name `To-Do`, Support-E-Mail = deine Gmail.
   - Zielgruppe: **Extern**.
   - Kontakt: deine Gmail → Fertigstellen.
4. **Datenzugriff** → „Bereiche hinzufügen“: `.../auth/calendar.readonly` und `.../auth/gmail.send` → Speichern.
5. **Zielgruppe** → **„App veröffentlichen“** (In Produktion).
   > Wichtig: Im Testmodus läuft die Google-Verbindung alle 7 Tage ab. Eine Prüfung durch Google ist **nicht** nötig. Beim Login siehst du einmalig „Google hat diese App nicht überprüft“ → **Erweitert** → **Weiter zu To-Do**. Das ist normal, weil es deine eigene App ist.
6. **Clients** → „Client erstellen“:
   - Anwendungstyp: **Webanwendung**
   - Name: `To-Do`
   - Autorisierte Weiterleitungs-URI: `https://todo.DEINNAME.workers.dev/auth/callback` (deine Adresse aus Schritt 2.6 + `/auth/callback`)
   - Erstellen → **Client-ID** und **Clientschlüssel** kopieren.

## 4. Schlüssel in Cloudflare eintragen

Cloudflare → Workers & Pages → `todo` → **Settings** → **Variables and Secrets** → **Add**:

| Typ    | Name                   | Wert                    |
|--------|------------------------|-------------------------|
| Secret | `GOOGLE_CLIENT_ID`     | Client-ID aus 3.6       |
| Secret | `GOOGLE_CLIENT_SECRET` | Clientschlüssel aus 3.6 |

Speichern („Deploy“).

## 5. Erster Start

**PC:** Adresse öffnen → „Mit Google anmelden“ → Zugriff erlauben (Kalender lesen, Mail senden).
Danach Einstellungen → **Push aktivieren**.

**iPhone / iPad** (iOS 16.4 oder neuer):
1. Adresse in **Safari** öffnen und anmelden.
2. Teilen-Symbol → **„Zum Home-Bildschirm“**.
3. App **vom Home-Bildschirm** starten → Einstellungen → **Push aktivieren** → Erlauben.
4. Test: „Test senden“.

Push muss auf jedem Gerät einzeln aktiviert werden.

## 6. Claude verbinden

1. claude.ai → **Einstellungen** → **Connectors** → **„Eigenen Connector hinzufügen“**.
2. Name: `To-Do` · URL: `https://todo.DEINNAME.workers.dev/mcp`
3. **Verbinden** → mit Google anmelden → **Erlauben**.
4. In einem Chat testen: *„Was steht heute an?“* oder *„Leg mir für morgen 10 Uhr ‚Steuerberater anrufen‘ mit Prio 1 an.“*

Der Connector gilt automatisch auch in der Claude-App auf iPhone und iPad.

## 7. Standort-Erinnerungen (optional, iPhone)

1. In der App: Einstellungen → Orte → z. B. `Zuhause`, `Büro`, `REWE` anlegen.
2. Unter „Kurzbefehl einrichten“ stehen **URL** und **Token**.
3. iPhone-App **Kurzbefehle** → **Automation** → **+** → **Ankommen** (oder **Verlassen**) → Ort wählen → **Sofort ausführen**.
4. Aktion **„Inhalte von URL abrufen“**:
   - URL: die angezeigte URL
   - Methode: **POST**, Anfragetext: **JSON**
   - Felder: `token` = Token · `place` = Ortsname (exakt wie in der App) · `event` = `arrive` bzw. `leave`
5. In einer Aufgabe unter **Ort** den Ort auswählen. Beim Ankommen kommt dann eine Push-Nachricht.

---

## Wie Erinnerungen funktionieren

| Fall | Push | Mail |
|---|---|---|
| Aufgabe mit Uhrzeit | 15 Min. vorher (einstellbar) oder eigene Erinnerungen | nur bei Prio 1 und nicht wiederkehrend |
| Prio 1 ohne Uhrzeit, nicht wiederkehrend | am Fälligkeitstag um 08:00 (einstellbar) | ja |
| Ort verknüpft | beim Ankommen/Verlassen | nur bei Prio 1 und nicht wiederkehrend |

## Lokale Entwicklung

```bash
npm install
npm run db:migrate:local
printf 'DEV_LOGIN=1\nGOOGLE_CLIENT_ID=x\nGOOGLE_CLIENT_SECRET=x\n' > .dev.vars
npm run dev
```

Dann <http://localhost:8787/auth/dev> öffnen. Der Dev-Login funktioniert nur auf `localhost` und mit `DEV_LOGIN=1`.
