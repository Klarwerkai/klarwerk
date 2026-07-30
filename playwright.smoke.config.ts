// SCRUM-381 (Entscheidung 02.07.2026, Pedi: „wir arbeiten von 1 nach 4"): MINIMALER UI-Smoke.
// Zweck: genau die Fehlerklasse fangen, die Logik-Tests nicht sehen (weiße Seite, kaputtes
// Bundle, tote Kernflüsse). Bewusst klein: 1 Browser (Chromium), 1 Spec, ~1 Minute.
// NICHT Teil von tools/check (kein Browser-Zwang für jeden Lauf) — Aufruf: npm run smoke:ui
// (Erstlauf einmalig: npx playwright install chromium firefox webkit).
//
// AUFTRAG-mega38 BLOCK C: hier stand bis mega37 „erwartet gebautes apps/web/dist" — eine ERWARTUNG,
// die niemand durchsetzte. Der Smoke serviert dieses Verzeichnis, gebaut hat aber nur `tools/check`;
// ein direkter `npm run smoke:ui` konnte deshalb ein Bündel von vorgestern grün melden und über den
// heutigen Quellstand nichts aussagen. Beiden Smoke-Befehlen ist jetzt `smoke:ui:frisch`
// vorgeschaltet (`package.json`, `scripts/dist-frische.ts`); es bricht LAUT ab statt zu warnen.
//
// AUFTRAG-mega14 Block C (bens SB-3): NICHT MEHR CHROMIUM-ONLY. Die vereinbarte Kante 11 verlangte
// Chrome/Chromium, Firefox und Safari/WebKit — `history.go(delta)`, schnelle aufeinanderfolgende
// Traversierungen und `popstate`-Reihenfolgen sind browsernahe Mechanik, und ein Beleg aus EINER
// Engine sagt darüber wenig. Pedi hat die Nachinstallation freigegeben; hier sind die drei Engines.
import { defineConfig, devices } from "@playwright/test";

const PORT = 3123;

// ────────────────────────────────────────────────────────────────────────────────────────────────
// AUFTRAG-mega25 Blöcke A + C — DIE UMGEBUNG DES SMOKE-SERVERS WIRD HIER DEKLARIERT, NIRGENDWO SONST.
//
// DER BEFUND (ben, sammel24): `tools/test:8` exportierte `KLARWERK_SKIP_KEYCHAIN=1` in einem
// KINDPROZESS. `tools/check` startete `npm run smoke:ui:gate` danach im ELTERNprozess — dessen
// Umgebung ein Kind nicht ändern kann. Playwright mischt beim Webserverstart `process.env` in die
// Serverumgebung; ein gewöhnlicher Aufruf von `./tools/check` konnte deshalb weiterhin den
// persönlichen Schlüsselbund auflösen und ein echtes Cloud-Modell bauen. Das Tor druckte
// „hermetisch" und erzwang es nicht. Belegte Läufe waren hermetisch, WEIL die Variable zufällig von
// aussen gesetzt war — das beweist den Lauf, nicht den Vertrag.
//
// DIE REPARATUR: die Hermetik wird am TATSÄCHLICHEN Webserver-Prozess gesetzt (unten `webServer.env`,
// das gewinnt gegen `process.env`), nicht in einem Geschwisterprozess. Und sie wird nicht geglaubt,
// sondern GEPRÜFT: `tests-smoke/smoke-umgebung.spec.ts` liest den öffentlichen Reasoner-Status des
// laufenden Servers und wird ROT, wenn die Umgebung ihn nicht erreicht hat.
//
// ZWEI BETRIEBSARTEN, und der Unterschied ist ausschliesslich die Herkunft des Zugangsdatums:
//   * TOR (`KLARWERK_SMOKE_MODE=gate`, gesetzt in `package.json` → `smoke:ui:gate`): KEIN Modell.
//     Weder Schlüsselbund noch Env noch lokaler LLM — alle drei Wege werden hier hart zugedreht.
//   * VOLL (`npm run smoke:ui`, Ship-Vorbedingung): Modell aus GENAU EINER, eigens dafür benannten
//     Variablen — `KLARWERK_SHIP_SMOKE_API_KEY`. Der Schlüsselbund bleibt auch hier zu.
const GATE = process.env.KLARWERK_SMOKE_MODE === "gate";

// AUFTRAG-mega25 Block C (Pedi-Entscheidung, bens Zusatzbedingung): der volle Ship-Smoke zieht sein
// Zugangsdatum NIE aus dem persönlichen Schlüsselbund eines Menschen, sondern ausschliesslich aus
// dieser Variablen. Der Name ist bewusst so gewählt:
//   * `KLARWERK_` — Hauskonvention aller Betriebsschalter dieses Repos.
//   * `SHIP_SMOKE` — nennt den EINZIGEN Verbraucher; niemand kann sie versehentlich für Produktion
//     halten, und sie kollidiert nicht mit `ANTHROPIC_API_KEY`, das auf Dev-Maschinen für ganz
//     andere Zwecke gesetzt sein kann.
//   * `_API_KEY` — trifft das Segment-Muster von `services/app/src/log-sanitize.ts:12`
//     (`API_?KEY` als eigenes Segment). Ihr WERT wird damit von der generischen Log-Senke
//     automatisch redigiert, falls er je in eine Log-Zeile geriete.
const SHIP_SMOKE_KEY_ENV = "KLARWERK_SHIP_SMOKE_API_KEY";

// WO DIE UMBENENNUNG STATTFINDET — UND WARUM NICHT HIER:
// Die Anbieterauflösung liest den Cloud-Schlüssel aus einer Env-Variablen, deren Namen NUR die
// Chokepoint-Datei kennen darf (`services/reasoner/src/model-client.ts`). Genau das erzwingt
// `tests/security/egress-chokepoint.test.ts` (SCRUM-502 R8): ein Credential-Name als Literal in
// IRGENDEINER anderen .ts-Datei macht das Tor rot. Ein erster Entwurf dieser Runde hat die
// Zuordnung hier hingeschrieben — und der Guard hat sie gefangen. Das war RICHTIG von ihm, und die
// Antwort darauf ist nicht, ihn zu erweitern, sondern die Verdrahtung dorthin zu legen, wo dieses
// Repo Zugangsdaten ohnehin verdrahtet: in den Start-Befehl (`package.json` → `smoke:ui`, analog zu
// `scripts/local/klarwerk-lokal-starten.command:40-45`). Der Wert erreicht den Playwright-Läufer
// darüber als gewöhnliche Prozessumgebung und wird unten mitvererbt.
//
// FOLGE, und sie ist die stärkste Zusicherung dieses Blocks: DIESE Datei liest den WERT nirgends.
// Sie prüft ausschliesslich, ob die Variable DA ist.
const shipSmokeKeyVorhanden = (process.env[SHIP_SMOKE_KEY_ENV] ?? "").trim().length > 0;

// LAUTER ABBRUCH statt stillem Rückfall. Ein Ship-Tor, das ohne Zugangsdatum grün wird, wäre
// schlimmer als eines, das rot wird — deshalb hier kein Fallback auf den Schlüsselbund, kein
// deterministischer Ersatz und kein Überspringen des @modell-Tests. Die Meldung nennt den NAMEN der
// Variablen und wie man sie setzt; sie nennt NIE einen Wert, auch keinen abgekürzten.
if (!GATE && !shipSmokeKeyVorhanden) {
  throw new Error(
    [
      `Der volle UI-Smoke braucht ein Modell — und sein Zugangsdatum kommt ausschliesslich aus ${SHIP_SMOKE_KEY_ENV}. Die Variable ist nicht gesetzt.`,
      "  So setzen (verdeckte Eingabe, nichts landet in der Befehlshistorie):",
      `    read -rs -p "Schluessel: " ${SHIP_SMOKE_KEY_ENV} && export ${SHIP_SMOKE_KEY_ENV}`,
      "  KEIN Rueckfall: der Smoke liest den persoenlichen Schluesselbund auf keinem Weg mehr (KLARWERK_SKIP_KEYCHAIN=1).",
      "  Ohne Zugangsdatum laeuft nur das hermetische Tor: npm run smoke:ui:gate (fuehrt den @modell-Test bewusst nicht aus).",
    ].join("\n"),
  );
}

export default defineConfig({
  testDir: "./tests-smoke",
  timeout: 60_000,
  retries: 0,
  reporter: [["list"]],
  // Genau EIN Arbeiter. Der Smoke-Server läuft mit In-Memory-Backend: alle drei Engines teilen sich
  // EINEN Datenbestand und EINE Ersteinrichtung. Liefen sie parallel, würden sie sich gegenseitig
  // den Anmeldezustand unter den Füßen wegziehen — ein grüner oder roter Lauf hätte dann nichts mit
  // dem Wächter zu tun. Die Engines laufen deshalb nacheinander.
  workers: 1,
  // AUFTRAG-mega16 Block B — DIE NACHFÜHRUNG. Hier stand bis mega15, WebKit laufe wegen
  // `upgrade-insecure-requests` in der CSP rot und komme gar nicht bis zum Wächter. Das war zum
  // Zeitpunkt des Schreibens richtig und ist es seit mega15 NICHT mehr: die Direktive wird nur noch
  // bei erkanntem HTTPS gesetzt (services/app/src/security-headers.ts), WebKit rendert die App über
  // plain HTTP vollständig, und fünf der sechs Kanten waren danach in WebKit grün.
  //
  // Übrig blieb GENAU EINE rote Kante (Kante 6, erzwungener Speicherfehler), und ihre Ursache ist
  // in mega16 gemessen worden, nicht vermutet:
  //
  //   Die App registriert im PROD-Build einen Service Worker (apps/web/src/main.tsx:29-31,
  //   apps/web/public/sw.js). Der Smoke fährt genau diesen Build. Sobald der Worker die Seite
  //   kontrolliert, fasst Playwrights `page.route` die Anfragen in WEBKIT nicht mehr an — gemessen:
  //   `navigator.serviceWorker.controller` = /sw.js in beiden Engines, aber der Route-Handler
  //   feuerte in Chromium zweimal und in WebKit KEIN EINZIGES MAL, während die Anfragen laut
  //   Request-Mitschnitt sehr wohl gestellt wurden. Der erzwungene Fehler von Kante 6 trat in
  //   WebKit also NIE ein: das Speichern GELANG, und der Wächter tat danach genau das Richtige —
  //   er navigierte. Der rote Lauf war ein Mangel der Fehlereinspeisung, kein Wächter-Fehler.
  //
  // Deshalb steht hier `serviceWorkers: "block"` — und ausdrücklich NICHT eine Wartezeit, ein
  // anderer Selektor oder ein weggepatchter Produkt-Header. Diese Einstellung ist zulässig, weil
  // der Worker für die geprüfte Fläche nachweislich ein Durchreicher ist: `sw.js:35-42` verlässt
  // seinen fetch-Handler ohne `respondWith` für jede Nicht-GET-Anfrage UND für jeden /api-Pfad.
  // Für Entwurf-Speichern (POST /api/drafts) verhält sich die App mit und ohne Worker identisch;
  // blockiert wird also nichts, was dieser Test prüft.
  //
  // EHRLICHE GRENZE, die hier stehen bleiben soll: der Smoke prüft damit den Weg OHNE Service
  // Worker. Der Worker selbst (Offline-Start, App-Shell-Fallback) ist nicht Gegenstand dieser
  // Sonde und hat keine eigene. Das ist ein benannter, offener Punkt — keine stille Auslassung.
  // AUFTRAG-mega24 Block A: die Ersteinrichtung hat jetzt einen EIGENTÜMER.
  //
  // Der geteilte In-Memory-Server hat GENAU EINE Ersteinrichtung pro Lauf. Bis mega23 verbrauchte
  // sie, wer alphabetisch zuerst lief (`mobile-drawer-…`), und die beiden anderen Sonden fielen
  // danach auf ein Anmeldeformular, in dem ihr eigenes Konto nie angelegt war — der rote Lauf, der
  // mega24 ausgelöst hat. Beide Ursachen sind hier geschlossen:
  //
  //   * `setup` durchläuft die Ersteinrichtung EIN MAL, deterministisch als erstes, gegen einen
  //     frischen Server — mit harten Zusicherungen statt eines stillen „falls das Formular da ist".
  //   * Die drei Engines hängen über `dependencies` davon ab und finden deshalb IMMER das
  //     Anmeldeformular vor, in beliebiger Dateireihenfolge.
  //   * Alle Sonden teilen sich EIN Konto (`tests-smoke/support/auth.ts`) — das Konto der
  //     Ersteinrichtung, das als einziges Admin und freigegeben ist.
  //
  // Der Wirknachweis ist die Reihenfolge-Unabhängigkeit, nicht das blosse Grün: die Suite ist auch
  // dann grün, wenn eine beliebige der drei Dateien zuerst läuft (in mega24 einzeln belegt).
  projects: [
    {
      name: "setup",
      testMatch: /ersteinrichtung\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup"] },
    { name: "firefox", use: { ...devices["Desktop Firefox"] }, dependencies: ["setup"] },
    { name: "webkit", use: { ...devices["Desktop Safari"] }, dependencies: ["setup"] },
  ],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    // AUFTRAG-mega16 Block B: siehe die Begründung oben bei `projects`. Ohne diese Zeile läuft die
    // Fehlereinspeisung von Kante 6 in WebKit ins Leere und der Test misst das Gegenteil dessen,
    // was er behauptet zu messen.
    serviceWorkers: "block",
  },
  webServer: {
    // In-Memory-Backend (keine DATABASE_URL, kein Dev-Persist) → jeder Lauf startet jungfräulich
    // mit Ersteinrichtung.
    //
    // AUFTRAG-mega24 — RICHTIGSTELLUNG: hier stand bis mega23 „deterministischer Reasoner (kein
    // API-Key nötig, ehrliche Entwürfe)". Das ist FALSCH und war es spätestens seit
    // „KI-Ehrlichkeit" (AI-STATE V1-V5, Commit c4a6a5b). Gemessen in mega24:
    //
    //   Der Server erbt hier die Umgebung des Aufrufers. OHNE `KLARWERK_SKIP_KEYCHAIN` zieht er auf
    //   dieser Maschine ECHTE Cloud-Zugangsdaten aus dem Schlüsselbund — `npm run smoke:ui` macht
    //   dann echte Modell-Läufe und damit echten EGRESS (im Lauf sichtbar als „CloudReasoner aktiv"
    //   und als KI-Prüf-Zeilen des Servers). MIT `KLARWERK_SKIP_KEYCHAIN=1` ist kein Modell aktiv,
    //   und der Test „Kernfluss … @modell" kann gar nicht grün werden: der Knopf „Mit KI
    //   strukturieren" wird dann bewusst HART ausgegraut, statt still deterministisch zu antworten
    //   (`apps/web/src/lib/aiAvailability.ts:29-49`) — das ist gewolltes Produktverhalten.
    //
    // Der deterministische Fallback existiert also weiter, aber er trägt diesen einen Test NICHT.
    // Deshalb ist er mit `@modell` markiert und läuft im hermetischen Tor-Lauf nicht mit
    // (`npm run smoke:ui:gate`, s. `tools/check`). Pedis Entscheidung (SCRUM-552): dass die volle
    // Smoke-Suite für ihr Grün einen echten Modell-Lauf braucht, bleibt befristet bestehen.
    //
    // AUFTRAG-mega25 — HIER wird die Umgebung des Servers festgelegt, und zwar VOLLSTÄNDIG für
    // alles, was über Modell und Egress entscheidet. Playwright mischt `process.env` unter, aber
    // die Einträge dieses Objekts GEWINNEN (playwright/lib/runner/index.js: `{...process.env,
    // ...options.env}`) — was hier steht, kann eine Aufrufer-Shell nicht mehr überschreiben.
    command: "npm start",
    url: `http://127.0.0.1:${PORT}/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PORT: String(PORT),
      // (1) Der Schlüsselbund bleibt auf JEDEM Testweg zu — auch im vollen Smoke. Das ist bens
      //     Zusatzbedingung aus sammel24 und gilt unabhängig davon, welchen Weg Pedi wählt: dass
      //     ein automatisiertes Tor ohne ausdrückliche Freigabe das persönliche Zugangsdatum eines
      //     Menschen aus dessen Schlüsselbund zieht, ist in keiner Variante der Endzustand.
      //     Wirkung im Produkt: `services/app/src/build-app.ts:305` reicht bei gesetzter Variable
      //     `() => undefined` als Keychain-Lookup durch — der `security`-Aufruf in
      //     `services/reasoner/src/model-client.ts:156-166` läuft dann gar nicht erst an.
      KLARWERK_SKIP_KEYCHAIN: "1",
      // (2) Der dritte Weg zu einem aktiven Modell (SCRUM-424, eigener lokaler LLM) wird im Tor
      //     ebenfalls zugedreht — sonst hinge die Zusage „hermetisch" daran, ob auf der Maschine
      //     zufällig ein On-Prem-Endpunkt konfiguriert ist.
      ...(GATE
        ? {
            KLARWERK_LOCAL_LLM_URL: "",
            KLARWERK_LOCAL_LLM_MODEL: "",
            // AUFTRAG-mega25, aus dem Zusatzbefund von `tests/setup-env.ts` gelernt: „hermetisch"
            // heisst KEIN Netz, nicht bloss „kein Modell". Der externe Such-Proxy (Wikipedia) ist
            // der zweite Weg, auf dem dieser Server einen Dritten kontaktieren könnte. Heute läuft
            // ihn keine Smoke-Sonde — genau so eine „heute noch nicht"-Lücke war aber Block B.
            // Deshalb im Tor strukturell zu, statt darauf zu vertrauen, dass es so bleibt.
            EXTERNAL_SEARCH: "off",
          }
        : {}),
      // (2b) AUFTRAG-mega64 Block A: Das Demodaten-Laden liegt seit mega64 hinter einem fail-closed
      //      Betriebsschalter mit Vorgabe AUS — ohne ihn existiert die Route nicht und der Knopf
      //      „Demodaten laden" wird nicht gerendert. `smoke:ui:gate:daten` fährt genau über diesen
      //      Produktweg (`tests-smoke/ersteinrichtung.setup.ts:95-108`) und braucht den Schalter
      //      deshalb ausdrücklich. Er wird NUR für diesen Lauf gesetzt: der normale Tor-Lauf
      //      (`smoke:ui:gate`, der Lauf in `tools/check`) seedet keine Demodaten und bekommt den
      //      Schalter darum auch nicht — sonst stünde in der Tor-Umgebung ein Werkzeug scharf, das
      //      dieser Lauf nicht benutzt.
      ...(process.env.KLARWERK_SMOKE_SEED === "1" ? { KLARWERK_DEMO_SEED: "1" } : {}),
      // (3) Der Cloud-Schlüssel steht NICHT hier — er kommt als geerbte Prozessumgebung aus dem
      //     Start-Befehl (s. oben, `package.json`). Dort wird er im Tor auf LEER gesetzt (nicht
      //     „ungesetzt": leer, damit ein in Pedis Shell exportierter Wert die Hermetik nicht doch
      //     noch aufreisst) und im vollen Lauf aus KLARWERK_SHIP_SMOKE_API_KEY gefüllt. Dass beides
      //     tatsächlich am Server ankommt, prüft `tests-smoke/smoke-umgebung.spec.ts` — in BEIDEN
      //     Richtungen: „im Tor kein Modell" und „im vollen Lauf ein Cloud-Modell".
    },
  },
});
