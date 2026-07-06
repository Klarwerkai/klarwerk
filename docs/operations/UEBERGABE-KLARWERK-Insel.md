# KLARWERK Insel — Übergabepaket

*Stand: 06.07.2026 · Autor: NERD (für Pedi / Team / Paul) · Bezug: KLLM-61, KLLM-62, KLLM-70, KLLM-71, KLLM-72, KLLM-73*

> Dieses Dokument beschreibt vollständig, **was** die „Insel" ist, **was diese Woche gebaut wurde**, **wie man alles betreibt** (installieren, starten, updaten), **wie es technisch funktioniert**, **was noch offen ist** und **wie es weitergeht**. Ziel: Jede/r kann daraus alles erkennen und selbst durchführen — auch ohne den Chatverlauf.

---

## 0. In einem Satz

Die **KLARWERK-App** (das eigentliche Produkt: Fastify-Backend + React-Oberfläche, „Wissens- & Reasoning-System") läuft jetzt **nativ, offline und air-gapped auf dem Mac Studio**, angebunden an ein **lokales Sprachmodell** (MLX oder Ollama) — als Ein-Datei-Paket ausgeliefert, das per Tailscale übertragen und lokal gestartet wird.

---

## 1. Die Landschaft: zwei Maschinen + Transport

Es gibt **zwei getrennte Rechner** — das ist der Schlüssel zum Verständnis:

| | **Arbeits-Mac** (Entwicklung) | **Mac Studio** (Insel / Betrieb) |
|---|---|---|
| Rolle | Hier wird entwickelt; hier liegt das Repo `dev_Klarwerk`. | Air-gapped VIP-Betrieb; hier **läuft** die App + das lokale LLM. |
| Netz | normal | **abgeschottet**, kein Internet |
| Repo | ja (`~/Documents/dev_Klarwerk`) | **nein** — nur das ausgelieferte Paket |
| Erreichbar | via Claude-Bridge (Cowork) | **nur** über den Arbeits-Mac + **Tailscale** |

**Transportweg:** Paket auf dem Arbeits-Mac bauen → in `~/Downloads` ablegen → **per Tailscale** auf den Mac Studio kopieren → dort auspacken & starten. Deshalb wird alles **gezippt**; man kann nicht direkt auf den Mac Studio schreiben.

Wichtig für Terminal auf dem (deutschen) Mac: Der Finder zeigt „**Programme**", der echte Pfad im Terminal bleibt aber immer `/Applications`. Nie „Programme" ins Terminal tippen.

---

## 2. Was diese Woche entstanden ist

1. **App-Start auf dem Mac Studio (KLLM-61).** Launcher, der die App nativ startet (`npm start`/`tsx`), das lokale LLM anbindet und den Browser öffnet. Kein Docker, kein Cloud-Schlüssel, rein `127.0.0.1`.
2. **Reproduzierbarer Rechner-Aufbau (KLLM-70).** Skripte `Insel-inventarisieren.command` (schreibt Ist-Zustand versioniert ins Repo) und `Insel-aufbauen.command` (baut vergleichbaren Rechner). Versioniert unter `scripts/insel/`.
3. **On-Prem-App-Bundle `KLARWERK-App.zip`** — die komplette App inkl. Laufzeit (`node_modules`), gebautem Frontend (`apps/web/dist`) und Startbefehl. Ein Ordnername überall: `KLARWERK-App`.
4. **MLX als Standard-Backend** (`mlx-community/Qwen3-32B-4bit`, Port 8080); Ollama per Variable umschaltbar.
5. **Anzeige-Bug gefunden & gefixt** (weiße Seite → HTTPS-Erzwingung; Details §6). Fix ist im Bundle eingebacken.
6. **Update-Mechanismus.** `UPDATE-einspielen.command` spielt ein kleines Update-Zip (~2,4 MB, nur Code + Oberfläche) ein, ohne `node_modules` und Daten anzufassen.
7. **Desktop-Icon** „KLARWERK App" mit dem KLARWERK-Bullseye (orange).
8. **E-Mail-Thema erkannt (KLLM-71).** Entscheidung offen (§7).

---

## 3. Wo liegt was — Artefakt-Landkarte

**Im Repo `dev_Klarwerk` (versioniert, GitHub `Klarwerkai/klarwerk`):**
- `scripts/insel/` — `Insel-inventarisieren.command`, `Insel-aufbauen.command`, `Insel-App-starten.command`, `UPDATE-einspielen.command`, `README.md`, `LIESMICH.txt`.
- `README.md` — Abschnitt „On-Prem-Betrieb (Mac Studio · Insel)".
- `docs/operations/` — Ablage für `INSEL-AUFBAU.md` (entsteht beim ersten Inventar-Lauf) + dieses Übergabepaket.
- Die App selbst: `services/` (Backend, modularer Monolith) + `apps/web/` (React-Frontend).

**Auf dem Arbeits-Mac, `~/Downloads/` (Transport-Staging):**
- `KLARWERK-App.zip` (~268 MB) — das volle Paket. **Nur diese Datei zählt.**
- `KLARWERK-Bullseye.png` — das Icon.
- (Alte Zips `KLARWERK-App-MacStudio*`, `KLARWERK-App-Update*` sind Altlasten — ignorieren/löschen.)

**Auf dem Mac Studio (Ziel):**
- `/Applications/KLARWERK-App/` — die installierte App (im Finder unter „Programme").
- `~/Desktop/KLARWERK App.app` — Doppelklick-Starter mit Bullseye-Icon.
- `~/Library/Application Support/KLARWERK-Insel/` bzw. `.localdb/` im App-Ordner — Daten (Journal).

---

## 4. Betrieb Mac Studio — Installieren · Starten · Updaten

### 4.1 Erstinstallation
Voraussetzung: Node.js ≥ 20 ist installiert (der Modell-Manager läuft ebenfalls auf Node). „KLARWERK MLX" (mlx_lm.server, Port 8080) läuft, Modell `mlx-community/Qwen3-32B-4bit` geladen.

1. `KLARWERK-App.zip` per Tailscale nach `~/Downloads` bringen, doppelklicken (entpackt zu `~/Downloads/KLARWERK-App`).
2. Terminal:
   ```
   mv ~/Downloads/KLARWERK-App /Applications/KLARWERK-App
   xattr -dr com.apple.quarantine /Applications/KLARWERK-App
   ```
   (Falls „Vorgang nicht erlaubt": `sudo mv …` — Passwort wird beim Tippen nicht angezeigt, das ist normal.)
3. Desktop-Icon anlegen (einmalig) — Block aus dem Übergabe-Prompt / der `scripts/insel/README.md`. Icon-PNG: `~/Downloads/KLARWERK-Bullseye.png`.

### 4.2 Starten
- Doppelklick auf **KLARWERK App** (Schreibtisch), **oder** Terminal:
  ```
  bash /Applications/KLARWERK-App/START-KLARWERK-App.command
  ```
- Der Browser öffnet `http://127.0.0.1:3001` (Port **:3001** ist Pflicht — ohne ist die Seite leer).
- In der App unter **„KI-Verwaltung"** den lokalen LLM als **aktives** Backend wählen.
- Fenster offen lassen; **`ctrl + C`** (deutsch „Strg") beendet. Weil per Doppelklick gestartet, schließt sich das Fenster nach dem Stopp selbst — für neue Befehle ein **neues** Terminal öffnen.

### 4.3 Backend umstellen (MLX ↔ Ollama)
Oben in `START-KLARWERK-App.command` die Variablen, oder einmalig ohne Datei-Änderung:
```
BACKEND=ollama bash /Applications/KLARWERK-App/START-KLARWERK-App.command
```

### 4.4 Updaten (kleiner Weg)
1. Neues `KLARWERK-App-Update-*.zip` (baut NERD, ~2 MB) per Tailscale nach `~/Downloads`.
2. Doppelklick auf `UPDATE-einspielen.command` im App-Ordner → ersetzt `services/` + `apps/web/dist/`, lässt **`node_modules` und Daten (`.localdb`) unberührt**, startet neu.
3. Nur wenn sich Abhängigkeiten ändern (selten), das **volle** `KLARWERK-App.zip` neu einspielen — der Update-Befehl warnt in dem Fall.

---

## 5. Wie die App technisch läuft

- **Ein Deploybares (modularer Monolith).** `services/app/src/server.ts` startet Fastify, bindet alle Fachmodule (`auth`, `rbac`, `knowledge-object`, `validation`, `reasoner`, `ask`, `conflicts`, `audit`, …) und liefert **die gebaute Oberfläche gleich mit aus** (Single-Origin, `apps/web/dist`). Start: `npm start` → `tsx services/app/src/server.ts`.
- **Ports:** App `127.0.0.1:3001` · Ollama `:11434` · MLX `:8080`.
- **Datenhaltung (env-gesteuert):** ohne `DATABASE_URL` → In-Memory; mit `KLARWERK_DEV_PERSIST=1` → lokales **Journal** (`.localdb`, übersteht Neustart, Werksreset möglich, SCRUM-387); mit `DATABASE_URL` → Postgres. Das Insel-Bundle nutzt **Journal**.
- **Lokaler LLM (SCRUM-424):** `services/reasoner/src/model-client.ts` hat `openAiCompatibleClient` (spricht `/v1/chat/completions` — MLX, Ollama, vLLM, llama.cpp …). Im Composition-Root (`build-app.ts`) als **zweites Backend** (`secondary`) am `Reasoner` verdrahtet, gesteuert per Env `KLARWERK_LOCAL_LLM_URL` + `KLARWERK_LOCAL_LLM_MODEL`. Der Launcher setzt diese. **Kein Eingriff in den App-Code** — deshalb freeze-sicher.
- **Wichtig:** Ohne Cloud-Schlüssel ist das Primär-Backend der deterministische Ersatzmodus; der lokale LLM ist das Zweit-Backend und muss in der **KI-Verwaltung** aktiv geschaltet werden.

---

## 6. Der HTTPS/CSP-Fix (wichtig für jeden HTTP-On-Prem-Betrieb)

**Symptom:** App startet, `curl` liefert `HTTP 200` für Seite und JS/CSS, aber der Browser zeigt **weiße Seite**. Konsole: „TLS-Fehler" für `https://127.0.0.1:3001/assets/*`.

**Ursache:** `configureWebDelivery()` in `server.ts` setzt via `@fastify/helmet` standardmäßig **`upgrade-insecure-requests`** (CSP) und **HSTS**. Beide zwingen den Browser, Unterressourcen über **https** zu laden. On-Prem läuft aber **http** (kein Zertifikat) → JS/CSS scheitern → nichts wird gerendert. In Produktion (HTTPS) unsichtbar.

**Fix im Bundle (eingebacken):** in der Helmet-Registrierung `upgradeInsecureRequests: null` und `hsts: false`. Verifikation: `curl -sI http://127.0.0.1:3001/` enthält **kein** `upgrade-insecure-requests` mehr.

**Sauberer Weg (KLLM-73, für Repo/Paul):** diese Header **konditional** machen (nur bei echtem HTTPS/Produktion, z. B. an `COOKIE_SECURE`/`HTTPS`-Flag gekoppelt) — dann läuft **ein** Build on-prem (HTTP) und in Produktion (HTTPS) ohne Bundle-Patch.

---

## 7. Offene Punkte (mit genauem nächstem Schritt)

| # | Punkt | Ticket | Nächster Schritt |
|---|---|---|---|
| 1 | **404 beim Nutzer-Anlegen** (Bundle; lokal ok) | **KLLM-72** | Web-Inspektor → Netzwerk → Nutzer speichern → **rote Zeile** (Methode + Pfad + Status) erfassen. Damit Ursache eindeutig; dann Fix (Konsistenz-Build oder Journal-Auth-Pfad). Mit Paul. |
| 2 | **HTTPS-Header konditional im Repo** | **KLLM-73** | Nach Freeze: Header an HTTPS-Flag koppeln; Bundle-Patch entfällt. |
| 3 | **E-Mail-Anbindung** (Reset/Benachrichtigung) | **KLLM-71** | Entscheidung **A** (kein Außenversand, Admin-Reset) / **B** (EU-Dienst über kontrollierten Weg) / **C** (interner Relay). Bei B/C: SMTP-Creds aus Keychain, nie ins Repo. |
| 4 | **Erstlauf-Inventar** (INSEL-AUFBAU.md mit realen Werten) | **KLLM-70** | `Insel-inventarisieren.command` **auf dem Mac Studio** laufen lassen, Diff prüfen, committen → In Review. |
| 5 | **Vergleichs-Charts** (Insel-Modell-Manager) | Task #52 | Nur aktuellste Läufe listen; Stände je Modell als Segmente in **einem** Balken. Beim nächsten Insel-App-Durchlauf. |
| 6 | **„lokal == deployed"** | KLLM-72 | Bundles künftig aus **frischem, konsistentem** Build (dist + services aus einem Snapshot); Punkt 1 hängt evtl. damit zusammen. |

---

## 8. Sicherheitsregeln (verbindlich)

- API-Schlüssel **nur** im macOS-Schlüsselbund. **Keine** Secrets in Code, Repo, Tickets, Chats, Skripten, Launchern, Manifesten. Private SSH-Keys nie in Git.
- LLM-API **nie** öffentlich (nur `localhost` bzw. ausgehender, trennbarer Tunnel).
- **Käufe/Zahlungen/Mails nach außen: nur Pedi.**
- Fernhilfe nur ausgehend, auf Klick, trennbar, protokolliert.
- Testfälle sind **erfunden** (keine Kundendaten). Datenzustände werden dokumentiert als **Pfade**, nie Inhalte.

---

## 9. Jira-Landkarte (Projekt KLLM)

- **KLLM-62** — On-Prem-Insel „Mac Studio" (Dach). *To Do.*
- **KLLM-61** — App an lokalen LLM + KI-Verwaltung. *In Progress* (läuft on-prem; Kommentare mit Details).
- **KLLM-70** — Mac-Studio-Aufbau dokumentieren + Ein-Command. *In Progress* (Skripte da; Erstlauf offen).
- **KLLM-71** — E-Mail-Anbindung entscheiden + einrichten. *To Do* (A/B/C).
- **KLLM-72** — Bug: 404 Nutzer-Anlegen im Bundle. *To Do* (Repro offen).
- **KLLM-73** — App-Fix HTTPS-Header konditional. *To Do* (nach Freeze).
- Gehirn-Kontext: **KLLM-63** (Beraterauftrag Wissens-/Gedächtnisschicht), **KLLM-64** (Phase 0 PoC, *In Review*), **KLLM-65** (Phase 2 Embedding/Vektor, *In Progress*), **KLLM-66** (Phase 3 USB-Sync), **KLLM-69** (KI-Arbeitsgruppe, *In Review*).

---

## 10. Größerer Kontext: „KLARWERK-Gehirn" & Insel

Die App ist Teil einer modellunabhängigen Wissens-/Gedächtnis-Architektur („KLARWERK-Gehirn", KLLM-63). Kernideen für Kontinuität:
- **Verhaltensartefakte** (KLLM-64): modellunabhängige Regeln/Kontrakte/Few-Shots, die in den System-Prompt injiziert werden und den Modellwechsel überleben (auf MLX bewiesen: 106/106).
- **Bedeutungssuche** (KLLM-65, Phase 2): lokale Embeddings via **bge-m3** (Ollama), Hybrid-Score, „Embedding-Falle" (Modellwechsel erzwingt bewussten Re-Index).
- **Insel** (KLLM-62): air-gapped Betrieb, USB-Updates, Notfall-Fernhilfe. Das hier übergebene App-Deployment ist der Betriebs-Kern davon.

---

## 11. Glossar

- **Insel** — der air-gapped Mac-Studio-Betrieb.
- **Bundle / Paket** — `KLARWERK-App.zip`: die komplette lauffähige App zum Übertragen.
- **Launcher** — `START-KLARWERK-App.command`: startet Server + Browser, setzt LLM-Env.
- **Journal** — lokale Dev-Persistenz (`.localdb`); Daten überleben Neustarts.
- **KI-Verwaltung** — App-Bereich zum Wählen des aktiven KI-Backends.
- **MLX / Ollama** — lokale LLM-Server (Ports 8080 / 11434), OpenAI-kompatibel.
- **Tailscale** — der Weg, Dateien auf den air-gapped Mac Studio zu bringen.
