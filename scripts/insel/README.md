# scripts/insel — On-Prem-Insel (Mac Studio)

Werkzeuge für den Betrieb der KLARWERK-App auf dem air-gapped Mac Studio.
Alles läuft **nativ und lokal** (kein Docker, kein Cloud-Schlüssel, nur `127.0.0.1`).
Quelle der Wahrheit: **KLLM-61** (App ↔ lokaler LLM), **KLLM-62** (Insel), **KLLM-70** (Aufbau).

## Dateien

| Datei | Zweck |
|---|---|
| `Insel-App-starten.command` | Startet die KLARWERK-App **nativ** (`npm start`), bindet den lokalen LLM an (Ollama/MLX), setzt die Datenhaltung und öffnet den Browser. |
| `Insel-App-Desktop-Icon.command` | Legt einmalig eine Doppelklick-App „KLARWERK App" auf den Schreibtisch, die den Launcher startet. |
| `Insel-inventarisieren.command` | Erfasst den Ist-Zustand des Mac (Homebrew, Ollama-Modelle inkl. bge-m3, MLX-Pins, Node, Ports, Datenpfade) → versioniert unter `docs/operations/` (**ohne Secrets**). |
| `Insel-aufbauen.command` | Baut aus dem Inventar einen vergleichbaren Rechner (idempotent, Air-Gap-bewusst). |
| `build-current-release.mjs` | Baut ein Release-Paket (Code + Oberfläche + Startbefehl + **Betriebswege** + `SCHEMA-VERTRAG`). |
| `update-einspielen.sh` | **Update mit Netz**: sichert, prüft den Schema-Vertrag, schaltet um, prüft Health samt Version — und fällt bei Rot von selbst zurück. |
| `rueckfall.sh` | Schaltet `current` auf die Vorversion, startet, prüft Health samt Version. Von Hand und als automatischer Rückweg des Updates. |
| `schema-vertrag.mjs` | Erzeugt und prüft den Schema-Vertrag (Migrationsstufen + Risikoklasse) eines Releases gegen den Stand neben den Daten. |
| `insel-betrieb.sh` | Gemeinsame Handgriffe beider Wege (Server stoppen/starten — auch über launchd —, `/health` mit Version). Wird gesourct, nicht gestartet. |
| `release-texte.mjs` | Die Texte, die in jedes Release wandern: Release-**Identität**, `start.command`, `install.command`, `ROLLBACK.md`. Ohne Nebenwirkung, damit sie prüfbar sind. |
| `paketinhalt.mjs` | Berechnet, welche Quelldateien ein Release **außerhalb** von `services/` mitbringen muss, weil sein Startpfad sie lädt. Ohne Nebenwirkung, damit es prüfbar ist. |
| `LIESMICH.txt` | Ausführliche Bedienung (deutsch). |

## Was das Paket mitbringt

Auf dem Mac Studio liegt **kein Repo**. Was nicht im Paket steckt, gibt es dort nicht. Ein Release
von `build-current-release.mjs` enthält deshalb genau drei Sorten Inhalt:

1. **Die zwei Bäume:** `services/**` (ohne `node_modules`, `.git`, `dist` und Testdateien) und das
   gebaute Bündel `apps/web/dist`.
2. **Die Betriebswege:** `update-einspielen.sh`, `rueckfall.sh`, `insel-betrieb.sh`,
   `schema-vertrag.mjs` sowie `scripts/backup/backup.sh` und `restore-drill.sh` — dazu
   `start.command`, `install.command`, `SCHEMA-VERTRAG`, `BUILD_INFO` und `ROLLBACK.md`.
3. **Die Fremdquellen:** jede Quelldatei **außerhalb** von `services/`, die der Startpfad wirklich
   lädt. Heute ist das genau `apps/web/src/lib/docx.ts` — der DOM-freie DOCX-Kern, den
   `services/app/src/routes/capture-routes.ts` ausdrücklich von dort einführt statt ihn zu kopieren.

Die dritte Liste wird **berechnet, nicht gepflegt** (`paketinhalt.mjs`): sie folgt den relativen
Import-Angaben ab dem Einstieg aus `start.command` (`services/app/src/server.ts`) durch den
Quellbaum. Gezählt wird dabei **Import-Syntax, nicht Import-Text**: der Quelltext wird zerlegt, und
eine Zeichenkette gilt nur dann als Pfad, wenn sie an der Stelle steht, an der die Sprache einen
erwartet. Ein Importbeispiel *innerhalb* einer Zeichenkette (`const s = "import … from './x'"`)
erzeugt deshalb keine Kante — sonst verlangte der Bau eine Datei, die niemand lädt. Umgekehrt zählt
ein dynamischer Import mit **konstantem Backtick** (``import(`./x`)``) genauso wie einer mit
Anführungszeichen; er ist echte Syntax mit festem Pfad. Ein Schablonenliteral besteht dabei aus
zwei Sorten Inhalt, und sie werden verschieden behandelt: sein **Text** ist ein Datum, seine
**Einsetzungen `${…}` sind Code** und werden mitgelesen — ein
``console.log(`Stand: ${(await import("./x")).wert}`)`` lädt `./x` wirklich, also wandert `./x` mit. Ein **neuer Import aus `apps/web/src`
wandert dadurch von selbst mit**; findet der Bau eine so gemeldete Datei nicht, **bricht er ab** und
baut kein halbes Paket. Dasselbe gilt für einen Pfad, der erst zur Laufzeit entsteht
(``import(`./teil/${name}`)``): welche Datei dafür mitmüsste, ist nicht bestimmbar, also bricht der
Bau ab, statt sie stillschweigend wegzulassen. Kopiert wird jede Datei
unter ihrem unveränderten repo-relativen Pfad — kein pauschales `apps/web/src`, kein
Entwicklerbaum, keine `node_modules`. Was ein Paket mitgebracht hat, steht in seiner `BUILD_INFO`
(Zeile `fremdquellen=…`). Bibliotheken (`mammoth`, `jszip`, `sharp`, …) sind **keine** Fremdquellen;
sie kommen über `package.json` und `npm ci --omit=dev` ins Release.

Geprüft wird das in `tests/insel-paketausgabe/`: dort wird ein Paket nachgestellt und **jede**
relative Einfuhr ab `server.ts` im Zielordner aufgelöst. Der volle Baulauf (`npm ci`, `zip`) ist
dort nicht fahrbar; ein echtes Auspacken und Starten auf dem Mac Studio bleibt eine Handprobe.

**Lesegrenzen.** `paketinhalt.mjs` ist **kein Parser**, sondern ein Zerleger mit Regeln. Zugesagt
ist nur, was `tests/insel-paketausgabe/quellgrenzen-katalog.test.ts` mit einem kleinen, wirklich
startenden Quellbaum belegt (Kennungen `Q-…`, dieselben wie im Dateikopf von `erreichteQuellen`:
Quellstart, Inhaltsliste, Paket, Entfernen des Entwicklerbaums, isolierter Paketstart).

- **Belegt unterstützt:** `import`/`export … from "…"`, `import "…"`, `import("…")`,
  `require("…")` und `require.resolve("…")`, jeweils mit **genau einem** Zeichenkettenliteral ohne
  Rückstrich — auch hinter den im Katalog gemessenen Regex/Division-Formen (`if (…) /x/`,
  `i++ / 2`, `x! / 2`, `break`/`continue`/`debugger` mit Zeilenumbruch vor `/x/`, …).
- **Belegt abgewiesen** (Bauabbruch mit Datei:Zeile und Grund): berechnete Pfade (`require(p)`,
  `"…" + x`, `` `${…}` ``), Escape-Schreibweisen im Pfad, absolute Pfade, erreichte
  `.tsx`/`.jsx`-Dateien, ein `/` hinter `}` oder `of`/`yield`/`await`, ein `/` am Zeilenanfang,
  das als Division gelesen würde, und eine Datei, bei der Anführungszeichen, Kommentare oder
  Klammern nicht aufgehen.
- **Still, also weder Kante noch Abbruch — verbleibende Grenzen:**
  1. Dateien, die anders geladen werden (`readFileSync`, `new URL(…, import.meta.url)`,
     `import.meta.resolve`, Arbeiterprozesse).
  2. Eine Fehllesung von Division gegen regulären Ausdruck **mitten in einer Zeile** in einer Form,
     die der Katalog nicht kennt, nach der Anführungszeichen und Klammern zufällig wieder aufgehen.
     Genau so war BENs Gegenfall zu Runde 1 (`break` + Zeilenumbruch + ``/`/``) — er ist heute
     erkannt (Q-RD9), aber die Klasse ist ohne Parser nicht abschliessend zu schliessen.

Ein Bau, der durchläuft, beweist deshalb **nicht**, dass jede geladene Datei im Paket ist; er
beweist es für die belegten Formen.

## Update und Rückfall

```bash
bash /Users/Shared/Klarwerk_Insel/current/scripts/insel/update-einspielen.sh <paket.zip|ordner>
bash /Users/Shared/Klarwerk_Insel/current/scripts/insel/rueckfall.sh [<release>] [--daten-zurueck <sicherung>]
```

Dasselbe tut der Doppelklick: `install.command` im Paket **übergibt** an `update-einspielen.sh` und
schaltet nichts mehr selbst um — ein Einstieg, kein zweiter an der Sicherung vorbei.

Beide enden mit **einer** Ergebniszeile — `Update auf <version> aktiv, Sicherung <pfad>`,
`Update abgebrochen, Vorversion <version> läuft wieder, Grund: …` oder `Vorversion <version> aktiv`.
Ohne gelungene Sicherung wird nicht umgeschaltet; ein Downgrade oder eine neue **nicht umkehrbare**
Migration bricht **vor** dem Umschalten ab (letztere lässt sich mit `--nicht-umkehrbar-einspielen`
ausdrücklich zulassen). Zwei weitere Abbrüche schützen die Vorversion und die Daten:

- **Kollision** (Exit 6): ein vorhandenes Release-Verzeichnis wird nie überschrieben — sonst fehlte
  beim roten Health genau die Fassung, auf die zurückgefallen werden soll. Jeder Baulauf trägt
  dafür seinen eigenen Namen (`klarwerk-insel-<app-version>-<commit8>-<bauzeit>`). Darunter fällt
  auch die **Wiederholung**: ein Release, das schon unter `releases/` liegt (erst recht das
  laufende), wird nicht noch einmal eingespielt. Es anfahren tut `rueckfall.sh <release>`.
- **Unbekannter Datenstand** (Exit 10): Es liegen Daten vor, aber keine Fassung sagt, wie weit an
  ihnen migriert wurde (jede **Altinstallation**). Übergang mit
  `--datenstand-unbekannt-uebernehmen`; danach gilt jede Stufe als neu.

Kommt der Start des neuen Releases gar nicht erst zustande (etwa weil `launchctl kickstart`
scheitert), führt derselbe Weg in den Rückfall (**Exit 11**) statt wortlos mitten im Umschalten
abzubrechen; scheitert auch der Rückfall, sagt die Ergebniszeile das (**Exit 9**).

Der ganze Ablauf steht in `docs/operations/maintenance-update-process.md` §6.1; geprüft wird er in
`tests/insel-update/`.

## App starten

```bash
bash ~/Documents/dev_Klarwerk/scripts/insel/Insel-App-starten.command
```

Öffnet die App unter <http://127.0.0.1:3001>. Danach in der App unter **„KI-Verwaltung"**
den lokalen LLM als **aktives** Backend wählen (der Launcher hat ihn bereits verbunden).
Fenster offen lassen; `Strg-C` beendet.

Bequemer per Doppelklick: einmal `Insel-App-Desktop-Icon.command` ausführen → danach
startet die App vom Schreibtisch.

### Einstellungen (oben in `Insel-App-starten.command`)

| Variable | Standard | Bedeutung |
|---|---|---|
| `BACKEND` | `ollama` | `ollama` (`:11434`) oder `mlx` (`:8080`) |
| `OLLAMA_MODELL` | `qwen3:32b` | genaues Ollama-Modell |
| `MLX_MODELL` | `mlx-community/Qwen3-32B-4bit` | MLX-Modellname |
| `PERSIST` | `journal` | `journal` (Daten bleiben) oder `memory` (frisch je Start) |
| `PORT` | `3001` | Adresse |

Umschalten ohne Datei-Änderung, z. B. auf MLX:

```bash
BACKEND=mlx bash ~/Documents/dev_Klarwerk/scripts/insel/Insel-App-starten.command
```

## Voraussetzungen

- Node.js ≥ 20 und `npm install` (Projekt-Abhängigkeiten vorhanden).
- Ollama-Modell geladen (`ollama pull qwen3:32b`) **oder** MLX-Server auf `:8080` aktiv.
- Das Frontend (`apps/web/dist`) wird beim ersten Start automatisch gebaut, falls es fehlt.

## Wie es technisch läuft (kurz)

Der Server (`services/app/src/server.ts`) liefert die gebaute Web-Oberfläche
Single-Origin gleich mit aus. Der lokale LLM ist als **zweites Backend** im
Composition-Root verdrahtet (`build-app.ts` → `createLocalClientFromEnv`,
Env `KLARWERK_LOCAL_LLM_URL` / `KLARWERK_LOCAL_LLM_MODEL`, SCRUM-424). Der Launcher
setzt nur diese Umgebung — **kein Eingriff in den App-Code**.

## Sicherheit

Keine Secrets in Repo, Skripten oder Doku. API-Schlüssel bleiben im macOS-Schlüsselbund
(das Inventar nennt nur Referenznamen). Betrieb rein lokal; Datenbank bewusst nicht in
der Cloud (nativ, Journal oder In-Memory).
