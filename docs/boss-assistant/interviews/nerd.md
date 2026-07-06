# Interview — Nerd (Mac Studio / On-Prem Insel)

_Erhalten: 2026-07-06. Quelle: Selbstauskunft Nerd (unverifiziert, wo markiert)._

## Rahmen
- Erreicht den Mac Studio nur **mittelbar** (Bridge am Arbeits-Mac; Studio **air-gapped**, nur über **Tailscale**).
  Manche System-Versionen aus Projektkontext bekannt, nicht frisch am Gerät ausgelesen → schließt Inventar-Ticket **KLLM-70**.

## 1. Rolle & Domäne
- Verantwortlich für die **On-Prem-Insel**: air-gapped Betrieb der KLARWERK-App auf dem Mac Studio
  (`klarwerk-mac-studio`, User `klarwerk`) — lokale LLM-Laufzeit, Paketierung/Deployment, Start-/Update-Wege,
  Reproduzierbarkeit, Betriebsdoku.
- **Nicht Domäne:** fachliche App-Entwicklung der Teams (nur Schnittstellen-Abstimmung mit Paul).

## 2. Aufgaben & Verantwortung
- **Deployment:** Bau `KLARWERK-App.zip` auf Arbeits-Mac → Transfer per Tailscale → Installation nach `/Applications/KLARWERK-App`.
- **Lokale LLM-Umgebung:** MLX (`mlx_lm.server`, `:8080`, `mlx-community/Qwen3-32B-4bit`) bzw. Ollama (`:11434`,
  `qwen3:32b`, Embedding `bge-m3`); Start-Launcher setzt Env.
- **Start:** `START-KLARWERK-App.command` (App auf `127.0.0.1:3001`), Desktop-Icon „KLARWERK App".
- **Updates:** `UPDATE-einspielen.command` (Code-Update ohne `node_modules`/Daten).
- **Reproduzierbarkeit:** `Insel-inventarisieren.command` / `Insel-aufbauen.command` (KLLM-70).
- **Zugänge/Backups:** keine Zugangsverwaltung durch Nerd; Secrets im macOS-Schlüsselbund. **Backup-Konzept noch nicht etabliert.**

## 3. Stand der Umgebung
- **Läuft:** App startet nativ/offline, Oberfläche Single-Origin, rendert im Browser (`:3001`), lokaler LLM als
  zweites Backend verdrahtet (in „KI-Verwaltung" aktiv zu schalten).
- **Baustellen:**
  - 404 beim Nutzer-Anlegen im Bundle (lokal ok) — Ursache offen, Repro ausstehend → **KLLM-72**.
  - HTTPS-Header-Fix aktuell als **Bundle-Patch (weicht vom Repo ab)**, sauberer App-Fix offen → **KLLM-73**.
  - Erstlauf Inventar auf echtem Studio steht aus → Systemstände nicht autoritativ → **KLLM-70**.
  - E-Mail nicht angebunden (bewusst offen, Entscheidung nötig) → **KLLM-71**.

## 4. Entscheidungen & verworfene Ansätze
- **Verworfen:** externe LLM-Server (UpCloud vLLM via SSH-Tunnel `:8123`, KLLM-61 urspr.; früher Hetzner-GPU/MacBook-
  Evals KLLM-55) → **on-prem lokaler LLM** (air-gapped, datensouverän).
- **Verworfen:** App aus Repo starten (`scripts/insel`-Launcher) → **self-contained Bundle** (Studio ohne Repo/Netz).
- **Geändert:** Standard-Backend Ollama → **MLX (`Qwen3-32B-4bit`)** auf Pedis Wunsch.
- **Bereinigt:** Namenswirrwarr → ein Name `KLARWERK-App`.
- **Fix weiße Seite:** `upgrade-insecure-requests` + HSTS erzwangen HTTPS auf HTTP-Host → im Bundle
  `upgradeInsecureRequests: null`, `hsts: false`; sauberer Weg = KLLM-73.
- **MLX-Historie:** transformers-Konflikt → Pin `transformers>=4.44,<5`; Rosetta/arm64 → `sysctl hw.optional.arm64`
  + `arch -arm64`; MLX-Start aus GUI scheiterte an PATH → venv-Python direkt.
- **Update-Weg:** volle 268-MB-Übertragung → zusätzlich kleines Code-Update-Zip (~2,4 MB).

## 5. Offene Punkte & Abhängigkeiten
- **Von Pedi:** exakte fehlschlagende Anfrage zum 404 (Methode/Pfad/Status) — Blocker KLLM-72; E-Mail A/B/C (KLLM-71);
  Erstlauf Inventar (KLLM-70).
- **Von/mit Paul:** Bewertung des 404 (FE↔BE-Drift vs. Journal-Persistenz-Pfad); konditionaler HTTPS-Header-Fix (KLLM-73).
- **Ziel Pedi:** lokale und ausgelieferte Version identisch (Bundles aus konsistentem Snapshot).

## 6. Risiken, SPOF, Secrets
- **🔴 SPOF:** einzelner Mac Studio **ohne etabliertes Backup und ohne verifizierten Wiederaufbau** — Restrisiko bis
  KLLM-70 durchgezogen. **Backup-Strategie offen.** → bestätigt Berater-K1 / PMO-RISK-0001 (Bus-Faktor) auf Hardware-Ebene.
- **Air-Gap:** kein `npm install`/`ollama pull` auf Studio → Deps gebündelt/USB (KWN-3); native Binaries
  (`esbuild` darwin-arm64) brauchen gleiche Architektur (beide arm64).
- **Gatekeeper/Quarantäne** (`xattr -dr com.apple.quarantine`); HSTS-Cache in Safari (`~/Library/Cookies/HSTS.plist`).
- **Drift:** Bundle-CSP-Patch weicht vom Repo ab bis KLLM-73.
- **Bridge-Falle:** git über gemountete Bridge hinterlässt `.git/index.lock` (FUSE kein Unlink) → git nur nativ.
  → deckt sich mit Team-5-Befund (`.git/index.lock: Operation not permitted`).
- **🔑 Secrets:** ausschließlich macOS-Schlüsselbund (Cloud-Keys Anthropic/OpenAI/Gemini; Eintrag
  `KLARWERK-UpCloud-API`). Nichts im Klartext; `.env` gitignored (nur `.env.example`). Transport via Tailscale
  (dessen Zugriffskontrolle = Teil der Angriffsfläche).

## 7. Übergabewissen
- **Hosts/User:** Studio `klarwerk-mac-studio`/`klarwerk`; Arbeits-Mac (Bridge `mac-claude-work`)/`peterkohnert`.
- **Pfade (Studio):** App `/Applications/KLARWERK-App/`; Starter `~/Desktop/KLARWERK App.app`; Daten (Journal)
  `.localdb` bzw. `~/Library/Application Support/KLARWERK-Insel/`; Staging `~/Downloads/`.
- **Ports:** App `:3001`, Ollama `:11434`, MLX `:8080`, Insel-Modell-Manager `:11888`.
- **Stände:** Node ≥ 20; MLX + `Qwen3-32B-4bit`; Ollama `qwen3:32b` + `bge-m3`; MLX-venv-Pin `transformers<5`.
  Exakte macOS-/Paketstände liefert Inventarlauf KLLM-70.
- **Runbooks:** `docs/operations/UEBERGABE-KLARWERK-Insel.md` (maßgebliche Betriebs-Wahrheit),
  `docs/operations/PROMPT-Uebergabe.md`; Skripte unter `scripts/insel/`.
- **Repos:** `github.com/Klarwerkai/klarwerk` (`github`, `main`) + lokales Gitea (`localhost:3000`); Repo auf
  Arbeits-Mac `~/Documents/dev_Klarwerk`. → **gleiches Produkt-Repo wie Team 1.**
- **Tickets (KLLM):** Dach KLLM-62; Betrieb KLLM-61; Reproduzierbarkeit KLLM-70; E-Mail KLLM-71; Bug KLLM-72;
  App-Fix KLLM-73. Secrets nur als Verweis auf Schlüsselbund.
