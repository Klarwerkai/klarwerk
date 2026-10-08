import { existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { migrateAuthTokensAtRest } from "../../auth";
import { buildApp, buildPgServices, buildServices } from "./build-app";
import { createPool, migrate } from "./db";
import { buildDevPersistServices } from "./dev-persist";
import { waehleWerksreset } from "./factory-reset";
import { GedaechtnisDienst } from "./interaktionsgedaechtnis";
import { resolveKlaraAufraeumIntervalMs, starteKlaraAufraeumen } from "./klara-aufraeumen";
import { registerNoindexHook } from "./noindex-hook";
import { registerSecurityHeaders } from "./security-headers";
// JOB 3776: der Startvertrag wird am Einstiegspunkt gerufen — als erste Anweisung von `start()`,
// damit sein Abbruch durch `start().catch(...)` läuft und als EINE lesbare Zeile erscheint.
import { pruefeStartvertrag } from "./start-vertrag";
import { startfehlerZeile } from "./startfehler-zeile";
import { assertPersistentStore, normalizeEnv } from "./storage-guard";
import { resolveTrashSweepIntervalMs, startTrashSweepScheduler } from "./trash-sweep-scheduler";
import { registerWebStatic } from "./web-static";

// Kanonische Domain (klarwerk.ai). app.<domain> wird dauerhaft hierher umgeleitet.
const CANONICAL_HOST = process.env.CANONICAL_HOST ?? "klarwerk.ai";

// Laufzeit-Einstiegspunkt. Mit DATABASE_URL → Postgres (Migration + echte DB);
// ohne → In-Memory (lokaler Schnellstart). Läuft identisch auf Hetzner/On-Prem/Cloud.
async function pgServices(databaseUrl: string) {
  const pool = createPool(databaseUrl);
  await migrate(pool);
  // WP-VIP2-GATE (bens P1, Token-at-Rest): Einmal-Migration des Klartext-Token-Bestands
  // (Format-Erkennung via sha256:-Praefix → idempotent, zweiter Lauf findet nichts mehr);
  // raeumt dabei abgelaufene Sessions/Reset-Tokens auf.
  const migrated = await migrateAuthTokensAtRest(pool);
  if (migrated.hashedSessions > 0 || migrated.hashedResets > 0) {
    process.stderr.write(
      `[KLARWERK] Token-at-Rest-Migration: ${migrated.hashedSessions} Session(s) und ${migrated.hashedResets} Reset-Token in-place gehasht.\n`,
    );
  }
  return buildPgServices(pool);
}

// State-of-the-Art Single-Origin-Auslieferung: Security-Header (HSTS/CSP/…),
// Kanonik-Redirect, noindex (Vorab-Phase) und die gebaute SPA als Fallback
// neben der API. Bleibt aus den Tests heraus (buildApp ist rein API).
async function configureWebDelivery(app: FastifyInstance): Promise<void> {
  // WP-KLARA-1b (K1/K2): globale Security-Header (helmet, frame-ancestors 'none') + die EXAKT an die
  // kanonischen Taskpane-Pfade gebundene Word-Add-in-CSP-Ausnahme — als exportierte Produktionsfunktion
  // (security-headers.ts), gegen die der Header-Matrix-Test per echtem HTTP-inject läuft (keine Kopie,
  // keine Drift; gleiches Muster wie registerNoindexHook).
  await registerSecurityHeaders(app);

  // Kanonik: app.<domain> → 301 auf <domain> (pfaderhaltend).
  app.addHook("onRequest", async (request, reply) => {
    if (request.hostname === `app.${CANONICAL_HOST}`) {
      return reply.redirect(`https://${CANONICAL_HOST}${request.url}`, 301);
    }
  });

  // WP-E/WP-E2: Noindex über die exportierte, testbare Produktionsfunktion (synchroner Callback-Stil;
  // der Crash-Repro-Test verdrahtet exakt dieselbe Registrierung — keine Kopie, keine Drift).
  registerNoindexHook(app);

  // Gebaute SPA (Single-Origin). Fehlt das Verzeichnis (reiner API-Betrieb), bleibt es aus.
  const dist = join(dirname(fileURLToPath(import.meta.url)), "../../../apps/web/dist");
  if (!existsSync(dist)) {
    return;
  }
  // Statische Auslieferung + SPA-Fallback (Stale-Static-Fix, siehe web-static.ts).
  await registerWebStatic(app, dist);
}

// SCRUM-387: Dev-Persistenz-Journal der Desktop-App. Nur aktiv mit KLARWERK_DEV_PERSIST=1
// und OHNE DATABASE_URL (Postgres hat immer Vorrang — Produktion bleibt unberührt).
// Ablage: <repo>/.localdb/state.jsonl (gitignored), überschreibbar via KLARWERK_DEV_PERSIST_FILE.
function devPersistFile(): string | undefined {
  if (process.env.KLARWERK_DEV_PERSIST !== "1") {
    return undefined;
  }
  const override = process.env.KLARWERK_DEV_PERSIST_FILE;
  if (override) {
    return override;
  }
  return join(dirname(fileURLToPath(import.meta.url)), "../../..", ".localdb/state.jsonl");
}

async function start(): Promise<void> {
  // ==============================================================================================
  // JOB 3776 — DER STARTVERTRAG, ALS ERSTE ANWEISUNG DES EINSTIEGSPUNKTS.
  // ==============================================================================================
  //
  // WARUM HIER UND NICHT IM MODULRUMPF VON `build-app.ts`, wo er bis JOB 3776 stand: Ein Wurf im
  // Modulrumpf geschieht beim `import` — also bevor die erste Anweisung dieser Datei läuft — und
  // erreicht den Fänger `start().catch(...)` am Ende dieser Datei deshalb NIE. Der Betreiber bekam
  // eine Stapelspur aus dem Modulladen (`at ModuleJob.run`), in der die Meldung zwar vorkam, die
  // aber wie ein Programmabsturz aussah. Gemessen am Stand 8208f57, erste Zeile:
  // `/…/services/app/src/start-vertrag.ts:927`. JOB 3655 Runde 2 hat diesen Preis selbst
  // ausgeschrieben und den Grund genannt: `server.ts` stand damals nicht in den Zielpfaden.
  //
  // JETZT GILT DIE GEWOHNTE FORM: der Wurf läuft durch `start().catch(...)` und erscheint als EINE
  // Zeile `Serverstart fehlgeschlagen: …` mit ALLEN fehlenden Werten auf einmal.
  //
  // UND ER STEHT VOR `assertPersistentStore` (unten): Fehlen BEIDE Pflichtwerte, nennte der
  // Speicherwächter nur `DATABASE_URL` und schnitte die Sammelmeldung ab — genau BENs Befund aus
  // JOB 3655 Runde 1. In Nicht-Produktion prüft der Vertrag nichts (s. `fehlendePflichtwerte`),
  // Entwicklung und Desktopbetrieb bleiben unberührt.
  pruefeStartvertrag(process.env);
  // EINE Quelle der Wahrheit (ben-Review ROT-1): DATABASE_URL genau hier am Rand normalisieren
  // (trim; leer/whitespace → undefined). Derselbe Wert speist ALLE vier Verwendungen — Guard,
  // Pg-vs-InMemory/Journal-Verzweigung, Factory-Reset-Erkennung und Modus-Log — sodass Guard-Entscheid
  // und tatsächliche Verzweigung nie auseinanderlaufen. Kein zweites rohes process.env.DATABASE_URL.
  const databaseUrl = normalizeEnv(process.env.DATABASE_URL);
  const journal = devPersistFile();
  // Betriebssicherheit (SCRUM-498 B3): in Produktion NIE still auf InMemory/Journal starten.
  //
  // JOB 3776 RUNDE 2 — WER HIER WAS TUT, hat sich verschoben und der alte Satz stimmte nicht mehr:
  // Bis dahin stand hier „bricht der Start FAIL-CLOSED ab". Das tut `assertPersistentStore` nicht
  // mehr; der Wurf ist entfernt, weil der Startvertrag oben (Zeile 121) dieselbe Lage mit derselben
  // Ausnahme schon abfängt — zwei Wege zur selben Absage waren einer zu viel (Prüfpunkt 7).
  // Ohne DATABASE_URL in Produktion bricht der Start also WEITERHIN ab, nur eben am Vertrag.
  // Was hier bleibt, ist die laute, pfad-genaue WARNUNG: sie ist im bewusst überstimmten Fall
  // (KLARWERK_ALLOW_INMEMORY_PROD=1) der einzige Hinweis darauf, dass diese Instanz ihre Daten bei
  // jedem Neustart verliert.
  const storageDecision = assertPersistentStore({
    databaseUrl,
    nodeEnv: process.env.NODE_ENV,
    allowInMemoryProd: process.env.KLARWERK_ALLOW_INMEMORY_PROD,
    journalActive: journal !== undefined,
  });
  if (storageDecision.warning) {
    process.stderr.write(`${storageDecision.warning}\n`);
  }
  const services = databaseUrl
    ? await pgServices(databaseUrl)
    : journal
      ? await buildDevPersistServices(journal)
      : buildServices();
  // Werksreset nur im Desktop/Dev-Journal-Modus (nie mit DATABASE_URL), s. factory-reset.ts.
  const factoryReset = waehleWerksreset({ databaseUrl, journal });
  // R-0609 · Bens B13: der Aufräumlauf der Klara-Sitzungen (Nachtrag fehlender Endeinträge des
  // Prüfprotokolls, dann Löschen) — gestartet unten, nach `app.listen`, neben dem Papierkorb-Sweep.
  let klaraAufraeumLauf: (() => Promise<number>) | undefined;
  const app = buildApp(services, {
    factoryReset,
    klaraAufraeumen: (lauf) => {
      klaraAufraeumLauf = lauf;
    },
  });
  await configureWebDelivery(app);
  const port = Number(process.env.PORT ?? "3001");
  // SCRUM-525 P.5 (WP3-Batch3): die wirksame KI-Zuordnung (Policy) MUSS feststehen, BEVOR der Server
  // Requests annimmt — sonst gäbe es kurz nach dem Neustart ein Fenster mit Default-„auto". Daher VOR
  // app.listen und mit await. Präzedenz: ENV KLARWERK_REASONER_POLICY (deklarativ, transient) > persistierte
  // Admin-Wahl > Default. Ein DB-Lesefehler fällt NICHT still auf auto, sondern fail-closed auf
  // deterministic (source "load-error") und wird LAUT geloggt.
  const policy = await services.reasoner.loadPersistedPolicy({
    envGlobal: process.env.KLARWERK_REASONER_POLICY,
  });
  if (policy.source === "load-error") {
    // SCRUM-525 P.5 (WP-C): Befund 3(b) — es gibt HIER keinen Retry/Auto-Recovery-Mechanismus (die Policy
    // wird nur EINMAL beim Boot geladen, s. Kommentar an loadPersistedPolicy). Die persistierte Wahl greift
    // erst wieder nach einem Prozess-Neustart, NICHT automatisch, sobald die DB wieder erreichbar ist —
    // die Log-Meldung darf das nicht suggerieren. Bis zum Neustart bleibt fail-closed=deterministic aktiv;
    // ein Admin kann die Zuordnung in der Zwischenzeit über die API neu setzen (setTaskConfig ist nicht
    // ENV-gesperrt, s. ReasonerPolicyLockedError).
    // R-0623 (Ben, Nacharbeit 3): `policy.detail` ist hier der rohe Text des Datenbankfehlers — er
    // steht nicht im Log; die Lage nennt das Ereignis, der Text bleibt fest.
    app.log.error(
      { event: "ki_zuordnung_ladefehler" },
      `KI-Zuordnung konnte NICHT geladen werden — fail-closed auf global=${policy.config.global} (kein Cloud-Egress). Bitte DB prüfen und den Prozess NEU STARTEN, um die persistierte Wahl zu laden (keine automatische Wiederherstellung im laufenden Betrieb) — oder die Zuordnung in der Zwischenzeit unter KI-Verwaltung neu setzen.`,
    );
  } else if (policy.source === "env") {
    app.log.info(
      `KI-Zuordnung per KLARWERK_REASONER_POLICY gesetzt (global=${policy.config.global}, transient — überschreibt die persistierte Wahl für diesen Start).`,
    );
  } else if (policy.source === "persisted") {
    app.log.info(`KI-Zuordnung aus der Persistenz geladen (global=${policy.config.global}).`);
  } else {
    app.log.info(
      `Keine KI-Zuordnung konfiguriert — es gilt der Standard (global=${policy.config.global}). Unter KI-Verwaltung setzbar; die Wahl wird dann persistiert.`,
    );
  }
  if (policy.detail && policy.source !== "load-error") {
    // z. B. ein ignorierter, ungültiger ENV-Wert — ehrlich melden.
    app.log.warn(policy.detail);
  }
  await app.listen({ port, host: "0.0.0.0" });
  // JOB 517 — PID-DATEI FUER DEN RESTORE-DRILL. Additiv und nur bei gesetztem KLARWERK_PID_FILE;
  // ohne die Variable aendert sich nichts.
  //
  // Warum NACH `app.listen` und nicht davor: Die Datei ist die Zusage „dieser Prozess nimmt
  // Requests an". Wer sie vorher schriebe, liesse den Drill gegen einen Server laufen, der noch
  // nicht horcht — und ein Verbindungsfehler saehe dann wie ein Restorefehler aus. Scheitert
  // `listen`, wird die Datei nie geschrieben, und der Drill bricht am fehlenden PID ab statt an
  // einer falschen Zusage.
  const pidFile = process.env.KLARWERK_PID_FILE;
  if (pidFile && pidFile.trim() !== "") {
    writeFileSync(pidFile, `${process.pid}\n`, "utf8");
    app.log.info(`PID-Datei geschrieben: ${pidFile} (pid ${process.pid})`);
  }
  // Ehrlicher Betriebsmodus im Log — hilft bei „warum sind meine Daten weg?"-Diagnosen.
  const mode = databaseUrl ? "Postgres" : journal ? "Dev-Persistenz (Journal)" : "In-Memory";
  app.log.info(`KLARWERK läuft auf :${port} — Datenhaltung: ${mode}`);
  // SCRUM-523 P.3 (WP2): die abgelaufene-Papierkorb-Endlöschung ist eine EXPLIZITE Operation (nicht mehr
  // lazy beim Lesen — Lesen/Import-Dry-Run bleiben schreibfrei). Einmal beim Start anstoßen, damit die
  // Frist aus `TRASH_RETENTION_DAYS` ohne Cron greift; ein KO-Fehler bricht den Lauf nicht ab (per-KO onSweepError-Log).
  // R-0623 (Ben, Nacharbeit 1): die Fehler dieser Läufe gehen als `err` über den
  // Erlaubnislisten-Serializer ins Log (Typ, Code, Quelltextstelle) — nicht mehr als `String(error)`
  // im Meldungstext, der Datenbankmeldungen samt Inhalten trägt.
  const sweepFehler = (id: string, error: unknown) =>
    app.log.warn({ err: error, koId: id }, "Papierkorb-Endlöschung eines KO fehlgeschlagen");
  services.ko
    .runTrashSweep("system", sweepFehler)
    .then((purged) => {
      if (purged > 0) {
        app.log.info(`Papierkorb-Endlöschung beim Start: ${purged} abgelaufene KO(s) entfernt.`);
      }
    })
    .catch((error) => {
      app.log.warn({ err: error }, "Papierkorb-Endlöschung beim Start übersprungen");
    });
  // SCRUM-523 P.3 (WP1-Batch3): zusätzlich PERIODISCH sweepen (nicht nur beim Start), damit abgelaufene
  // Einträge auch in langlaufenden Prozessen ohne Neustart endgültig verschwinden. Intervall aus der
  // Umgebung (Default 6 h). Reads bleiben schreibfrei; der Sweep ist idempotent (nur abgelaufene Einträge).
  const sweepInterval = resolveTrashSweepIntervalMs(process.env.KLARWERK_TRASH_SWEEP_INTERVAL_MS);
  startTrashSweepScheduler({
    intervalMs: sweepInterval,
    runSweep: () => services.ko.runTrashSweep("system", sweepFehler),
    onSwept: (purged) =>
      app.log.info(`Papierkorb-Endlöschung (periodisch): ${purged} abgelaufene KO(s) entfernt.`),
    onError: (error) => app.log.warn({ err: error }, "Periodischer Papierkorb-Sweep übersprungen"),
  });
  app.log.info(`Papierkorb-Sweep aktiv — Intervall ${Math.round(sweepInterval / 60000)} min.`);
  if (klaraAufraeumLauf) {
    const klaraInterval = resolveKlaraAufraeumIntervalMs(
      process.env.KLARWERK_KLARA_AUFRAEUM_INTERVAL_MS,
    );
    starteKlaraAufraeumen({
      lauf: klaraAufraeumLauf,
      intervalMs: klaraInterval,
      log: { info: (t) => app.log.info(t), warn: (felder, t) => app.log.warn(felder, t) },
    });
    app.log.info(`Klara-Aufräumlauf aktiv — Intervall ${Math.round(klaraInterval / 60000)} min.`);
  }
  // R-0466: die Aufbewahrungsfrist des Interaktionsgedächtnisses ist eine LÖSCHFRIST. Gelesen wird
  // ein abgelaufener Eintrag ohnehin nicht mehr; dieser Lauf entfernt ihn beim Start und danach im
  // Takt des Papierkorb-Sweeps endgültig aus der Ablage.
  const gedaechtnis = new GedaechtnisDienst({ repo: services.gedaechtnis });
  const gedaechtnisGeloescht = (anlass: string) => (n: number) => {
    if (n > 0) {
      app.log.info(`Gedächtnis aufgeräumt (${anlass}): ${n} abgelaufene Einträge gelöscht.`);
    }
  };
  gedaechtnis
    .raeumeAbgelaufeneAuf()
    .then(gedaechtnisGeloescht("Start"))
    .catch((error) => app.log.warn({ err: error }, "Gedächtnis-Aufräumlauf übersprungen"));
  startTrashSweepScheduler({
    intervalMs: sweepInterval,
    runSweep: () => gedaechtnis.raeumeAbgelaufeneAuf(),
    onSwept: gedaechtnisGeloescht("periodisch"),
    onError: (error) => app.log.warn({ err: error }, "Gedächtnis-Aufräumlauf übersprungen"),
  });
}

start().catch((error) => {
  // R-0623 (Ben, Nacharbeit 5): nur Ereignistext und freigegebene Fehlerkennungen — nie die rohe
  // Meldung oder der Stack (`startfehler-zeile.ts`).
  process.stderr.write(`${startfehlerZeile(error)}\n`);
  process.exit(1);
});
