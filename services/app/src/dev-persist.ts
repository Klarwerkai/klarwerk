// SCRUM-387: Lokale Dev-Persistenz für die KLARWERK Desktop-App.
//
// Problem: Ohne DATABASE_URL läuft der Monolith in-memory — jeder Neustart löscht Nutzer und
// Daten, Pedi landet immer wieder in der Ersteinrichtung. Docker/Postgres ist auf dem Ziel-Mac
// nicht verlässlich vorhanden (Stakeholder-Auskunft 02.07.), daher Lösungsweg 2 des Arbeitsbriefs.
//
// Ansatz: MUTATIONS-JOURNAL statt Zustands-Snapshot. Jede schreibende Repo-Methode wird über die
// BESTEHENDEN öffentlichen Repo-Interfaces abgefangen (Proxy in der Kompositionswurzel — kein
// Griff in Modul-Interna, keine Modul-Änderung) und nach erfolgreicher Ausführung als eine
// JSONL-Zeile angehängt (append-only, damit crash-sicher: eine ggf. halb geschriebene letzte
// Zeile wird beim Laden defensiv verworfen). Beim Start wird das Journal in frische In-Memory-
// Repos zurückgespielt — die Repos sind deterministische Zustandsautomaten ohne interne
// ID-/Zeit-Erzeugung, das Replay ist daher exakt.
//
// Bewusst NUR Dev: aktiviert ausschließlich über KLARWERK_DEV_PERSIST=1 (setzt nur die
// Desktop-App). Produktion bleibt Postgres (DATABASE_URL hat Vorrang, siehe server.ts).
// Die Journal-Datei liegt unter .localdb/ (gitignored) und enthält KEINE Klartext-Passwörter
// (Auth speichert Salt+Hash), aber Session-Token — sie bleibt deshalb lokal und unversioniert.
// Bekannte, akzeptierte Grenze: das Journal wächst monoton (Kompaktierung = Folge-Ticket).
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { type AppRepos, type AppServices, assembleServices, inMemoryRepos } from "./build-app";

// Eine Journal-Zeile: welches Repo, welche Methode, welche Argumente (JSON-serialisierbar —
// alle Repo-Entitäten sind reine Datenobjekte mit String-/Zahl-Feldern).
export interface JournalEntry {
  repo: string;
  method: string;
  args: unknown[];
}

// Schreibende Methoden je Repo — exakt die Mutationsflächen der öffentlichen Interfaces.
// Lesemethoden werden NICHT journaliert. Neue Mutationsmethoden müssen hier ergänzt werden
// (Test „deckt alle AppRepos-Schlüssel ab" schützt vor vergessenen ganzen Repos).
export const MUTATING_METHODS: Readonly<Record<keyof AppRepos, readonly string[]>> = {
  // WP-SHIP8-CLOSE-6 (bens ROT-1): appendOnce ist eine Mutation (exactly-once-Beleg) — das
  // Replay ist deterministisch (der Set-/Index-Guard macht Doppel-Zeilen im Journal harmlos).
  auditRepo: ["append", "appendOnce"],
  // WP-SUBMIT-ASYNC: der Prüf-Status (aiCheck) ist eine Mutation am KO-JSONB → journalieren,
  // sonst wäre er nach einem Dev-Neustart weg (pending-Erkennung/Badges würden lügen).
  koRepo: ["insert", "update", "delete", "setAiCheck", "resolveAiCheck"],
  koVersions: ["append"],
  evidence: ["append"],
  // W2-A/148: die Laufdomaene. `insertIfAbsent` und `appendItemRefs` sind idempotent, `advance`
  // schreibt einen Zustand fort — alle drei muessen einen Dev-Neustart ueberleben, sonst waere ein
  // gestarteter Lauf danach spurlos, und genau das sollte 148 beenden.
  importRuns: ["insertIfAbsent", "advance", "appendItemRefs"],
  externalSources: ["insertIfAbsent"],
  // SCRUM-504: der atomare Bootstrap-Claim ist eine Mutation (fügt den Admin ein) → muss journaliert
  // werden, sonst überlebt der erste Admin den Dev-Neustart nicht. In Dev (sequenziell) genau einmal mit
  // Erfolg gerufen; Replay auf die leere Instanz beansprucht den Slot identisch.
  users: ["insert", "update", "delete", "tryClaimBootstrapAdmin"],
  sessions: ["create", "delete", "deleteByUser"],
  resetTokens: ["create", "delete"],
  drafts: ["insert", "update", "delete"],
  gaps: ["insert", "update", "delete"],
  // SCRUM-507 R2: die Bewertung (inkl. koVersion) wird per upsert journaled; die Invalidierung ist
  // versionsgebunden (keine separate Löschung), daher kein weiterer Mutator nötig.
  ratings: ["upsert"],
  assignments: ["create", "update"],
  // ==============================================================================================
  // JOB 3066 — `closeOpenForKo` IST EINE MUTATION UND MUSS INS JOURNAL.
  // ==============================================================================================
  //
  // Der Aufräumweg der Endlöschung schliesst die Befunde eines gelöschten Beitrags seit JOB 3066
  // MENGENBASIERT: EINE Anweisung je Speicher statt „lesen, dann je Treffer ein `update`" (Grund:
  // der PurgeTxCleanup-Vertrag schliesst Schleifen über Einzelobjekte im gehaltenen
  // Transaktionskörper aus, knowledge-object/src/service.ts:248-255). Damit läuft das Schliessen
  // NICHT mehr über `update` — ohne den Eintrag hier wäre nach einem Dev-Neustart der Beitrag
  // gelöscht (`koRepo.delete` IST journaliert), seine Dublettenwarnung aber wieder OFFEN: ein
  // Befund über einem Beitrag, den es nicht mehr gibt.
  //
  // DAS REPLAY IST EXAKT, weil die Methode ihre Wirkung vollständig aus den Argumenten ableitet:
  // `koId` wählt die Menge, `patch` trägt die fertigen Werte INKLUSIVE der vom Dienst erzeugten
  // Zeitstempel (der Dienst bildet sie einmal vor dem Aufruf). Auf die wiederaufgebauten Repos
  // angewandt trifft dasselbe Prädikat dieselben Einträge; eine doppelte Journalzeile ist harmlos
  // (der zweite Lauf findet nichts Offenes mehr). Beweis der Wirkung nach dem Wiederaufbau:
  // tests/aufraeumen-atomar/geschlossen-bleibt-geschlossen-im-dev-journal.test.ts.
  conflictsRepo: ["insert", "update", "closeOpenForKo"],
  // Berater-Konzept Duplikate 04.07. (Stufe D3b): Überschneidungs-Einträge überleben den Neustart.
  overlapRepo: ["insert", "update", "closeOpenForKo"],
  // Pedi 04.07.: eingestellte Anzeige-Schwelle überlebt den Neustart (letzter Set gewinnt).
  overlapSettings: ["set"],
  lifecycleRepo: ["addCoupling", "markPending", "clearPending", "savePath", "setProgress"],
  objects: ["insert"],
  // SCRUM-510 (WP3): der atomar-idempotente Insert ist ebenfalls eine Mutation → muss journaliert werden,
  // sonst überleben so eingereihte Import-Kandidaten den Dev-Neustart nicht.
  // WP-D-CLEAN: removeAll (Testdaten-Aufräumen) ebenfalls — sonst wären die Kandidaten nach einem
  // Dev-Neustart wieder da. WP-NIGHT-FIX (bens F2-TOCTOU): der Cleanup löscht jetzt gezielt per
  // removeByIds — dieselbe Journal-Pflicht.
  // WP-SHIP8-CLOSE-3 (bens ROT-1): claim/resolveClaim mutieren den Kandidaten (Status + Lease) →
  // journalieren, sonst wäre nach einem Dev-Neustart ein Claim/Abschluss verloren (Replay ist
  // deterministisch: beide CAS-Methoden tragen ihre Bedingung in den args).
  // WP-SHIP8-CLOSE-7 (bens ROT-1): clearAuditPending ist ebenfalls ein bedingter Kandidaten-Write.
  candidates: [
    "insert",
    "insertIfAbsent",
    "update",
    "removeAll",
    "removeByIds",
    "claim",
    "resolveClaim",
    "clearAuditPending",
  ],
  modelRuns: ["append"],
  // Audit-P3 (SCRUM-397): Gelesen-Status überlebt den Neustart (Dev-Journal).
  notificationSeen: ["markSeen"],
  // SCRUM-386: kundeneigene KI-Assist-Presets überleben den Neustart (Replace-Semantik,
  // args tragen die komplette Liste inkl. fertiger ids → Replay exakt).
  assistPresets: ["replaceAll"],
  // SCRUM-525 P.5 (WP6): die KI-Zuordnung (Policy) überlebt den Neustart (letzter Set gewinnt).
  reasonerPolicy: ["set"],
  // SCRUM-395: Standard-Prüferanzahl überlebt den Neustart (letzter Set gewinnt).
  validationSettings: ["setDefaultNeeded"],
  // SCRUM-414: Regler „externe Wissensabfrage" überlebt den Neustart (letzter Set gewinnt).
  externalKnowledge: ["setStage"],
  // SCRUM-421: Upload-Grenzen überleben den Neustart (letzter Set gewinnt).
  uploadLimits: ["set"],
  // ==============================================================================================
  // W1 WEG A (Pedi, Auftrag 143) — DER ANTWORTBELEG ÜBERLEBT DEN NEUSTART.
  // ==============================================================================================
  //
  // GENAU DIESE ZWEI, und keine dritte: `createRecord` legt die Antwortidentität an,
  // `appendSnapshot` hängt eine Belegrevision an. Alles andere am Repo (`findRecord`,
  // `findSnapshot`, `listSnapshots`, `latestSnapshot`) ist Lesen und gehört nicht ins Journal.
  //
  // WARUM DAS REPLAY EXAKT IST: beide Mutatoren sind idempotent (`createRecord` liefert `false`
  // für eine bekannte Antwort, `appendSnapshot` `false` für eine bekannte Revision), und beide
  // tragen ihre VOLLSTÄNDIGEN Argumente inklusive `integrityHash`. Der Wiederaufbau stellt den
  // Beleg damit WIEDER HER statt ihn nachzubilden — eine doppelte Journalzeile ist harmlos.
  //
  // DIE REIHENFOLGE IST TEIL DER ZUSAGE: `appendSnapshot` wirft ohne vorausgehenden Record. Der
  // Proxy schreibt nur NACH Erfolg, und `appendFileSync` ist ordnungstreu — deshalb kann die
  // Snapshot-Zeile im Journal nie vor ihrer Record-Zeile stehen.
  answerSnapshots: ["createRecord", "appendSnapshot"],
} as const;

// ================================================================================================
// W1/N6 (KW-S4-25 B, KW-S4-27 A) — DER BENANNTE, FAIL-CLOSED REPLAYFEHLER.
// ================================================================================================
//
// WARUM ES IHN GIBT. Der Start scheiterte auch vorher schon an einem manipulierten Journal — aber
// mit dem Fachfehler des getroffenen Repos („Zu diesem Snapshot gibt es keine Antwort"). Das ist
// ein fachlich klingender Satz für einen BETRIEBS-/INTEGRITÄTSdefekt, und er nennt weder Zeile
// noch Repo noch Methode. Der Betreiber sah einen Fehler, den er nicht lokalisieren konnte.
//
// WARUM DER REASON CODE HEUTE KONSTANT IST (KW-S4-27 A). Der Produktcode journalisiert
// ausschließlich ERFOLGREICHE Operationen in ordnungstreuer Reihenfolge, und die bekannten
// Replay-Operationen bauen daraus deterministisch wieder auf. Wirft eine solche Operation beim
// Replay, ist die vorliegende Journalfolge für diesen Produktstand nicht durch den regulären
// Schreibpfad reproduzierbar — das IST die Integritätsverletzung. Eine Unterscheidung am
// Fehlertyp wäre eine fachspezifische Sonderregel im Replay-Rahmen und ist ausdrücklich verboten.
//
// WAS ER NICHT TRÄGT, und das ist Vertrag, nicht Vorsicht: keine `args` (dort stehen laut Kopf
// dieser Datei Session-Token), keinen `integrityHash`, keine Kennung, keinen Journalpfad und
// keinen Text des Ursprungsfehlers. Die Ursache reist ausschließlich intern über `cause` mit.
// Für die Diagnose genügen Zeile, Repo, Methode und Reason Code.

/** Die heute erreichbaren Gründe. `REPLAY_OPERATION_FAILED` ist reserviert, ohne Erzeuger. */
export type DevPersistReplayReasonCode = "JOURNAL_INTEGRITY_VIOLATION" | "REPLAY_OPERATION_FAILED";

export class DevPersistJournalReplayError extends Error {
  readonly code = "DEV_PERSIST_JOURNAL_REPLAY_FAILED" as const;
  readonly phase = "REPLAY" as const;
  readonly reasonCode: DevPersistReplayReasonCode;
  readonly lineNumber: number;
  readonly repo: string;
  readonly method: string;

  constructor(lineNumber: number, repo: string, method: string, cause: unknown) {
    // Die Meldung setzt sich AUSSCHLIESSLICH aus den vier bereits validierten Werten zusammen.
    super(
      `Dev-Persist Journal-Replay fehlgeschlagen (Zeile ${lineNumber}, ${repo}.${method}, JOURNAL_INTEGRITY_VIOLATION).`,
      { cause },
    );
    // Ohne diese Zeile trüge die Unterklasse nach dem Bündeln den Basisnamen.
    this.name = "DevPersistJournalReplayError";
    this.reasonCode = "JOURNAL_INTEGRITY_VIOLATION";
    this.lineNumber = lineNumber;
    this.repo = repo;
    this.method = method;
  }
}

/**
 * Ein gelesener Eintrag MIT seiner physischen Herkunft.
 *
 * `lineNumber` ist die echte, 1-basierte Zeile der Journaldatei — sie zählt Leerzeilen und formal
 * gelesene, aber verworfene Zeilen mit. Sie ist bewusst eine LESE-Angabe und kein Feld von
 * `JournalEntry`: geschrieben wird weiterhin `{ repo, method, args }`, sonst stünde die Herkunft
 * in der Datei, die sie beschreibt (KW-S4-27).
 */
export interface JournalLine {
  readonly lineNumber: number;
  readonly entry: JournalEntry;
}

// Journal defensiv laden: fehlende Datei → leer; eine korrupte (z. B. beim Crash halb
// geschriebene) Zeile beendet das Einlesen ab dort — alles Gültige davor bleibt erhalten.
//
// W1/N6 (KW-S4-27): Die Zählung läuft über ALLE physischen Zeilen, nicht über die akzeptierten
// Einträge. Zwei Stellen sorgen sonst für eine Verschiebung — eine übersprungene Leerzeile und
// eine Zeile mit gültigem JSON, aber falscher Form (sie wird verworfen, bricht das Einlesen aber
// NICHT ab). Ein `index + 1` über das Ergebnisfeld läge in beiden Fällen daneben, und eine falsche
// Zeilennummer wäre schlimmer als keine: sie schickt den Betreiber an die falsche Stelle einer
// Datei, die er gerade als manipuliert verdächtigt.
export function readJournalLines(file: string): JournalLine[] {
  if (!existsSync(file)) {
    return [];
  }
  const lines: JournalLine[] = [];
  let lineNumber = 0;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    lineNumber += 1;
    if (line.trim().length === 0) {
      continue;
    }
    try {
      const parsed: unknown = JSON.parse(line);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        typeof (parsed as JournalEntry).repo === "string" &&
        typeof (parsed as JournalEntry).method === "string" &&
        Array.isArray((parsed as JournalEntry).args)
      ) {
        lines.push({ lineNumber, entry: parsed as JournalEntry });
      }
    } catch {
      break;
    }
  }
  return lines;
}

/** Dieselbe Lesung ohne die Herkunftsangabe — der unveränderte Bestandsvertrag. */
export function readJournal(file: string): JournalEntry[] {
  return readJournalLines(file).map((l) => l.entry);
}

// Journal in frische Repos zurückspielen — ausschließlich über die öffentlichen Interfaces.
// Unbekannte Repo-/Methodennamen werden bewusst übersprungen (versionstolerant statt Crash).
//
// W1/N6: Ein Wurf einer BEKANNTEN, gegen `MUTATING_METHODS` validierten Operation ist dagegen
// kein Toleranzfall, sondern eine Integritätsverletzung (KW-S4-27 A) — er bricht den Start
// fail-closed ab. Übersprungen wird nichts, fortgesetzt wird nichts, ein Ersatz-Repo gibt es nicht.
export async function replayJournal(repos: AppRepos, lines: readonly JournalLine[]): Promise<void> {
  for (const { lineNumber, entry } of lines) {
    const allowed = MUTATING_METHODS[entry.repo as keyof AppRepos];
    if (!allowed || !allowed.includes(entry.method)) {
      continue; // N5: Abwärtskompatibilität — und ausdrücklich KEIN Fallback für N6.
    }
    const target = repos[entry.repo as keyof AppRepos] as unknown as Record<string, unknown>;
    const method = target[entry.method];
    if (typeof method === "function") {
      try {
        await (method as (...args: unknown[]) => Promise<unknown>).apply(target, entry.args);
      } catch (cause) {
        // `repo` und `method` sind an dieser Stelle bereits gegen das Registry geprüft (die
        // Zeilen darüber) — sie sind damit kanonische Schlüssel aus dem Code, keine Zeichenketten
        // aus der Datei. Genau deshalb dürfen sie in Meldung und Feldern erscheinen, ohne dass
        // ein manipulierter Rohwert je interpoliert würde.
        throw new DevPersistJournalReplayError(lineNumber, entry.repo, entry.method, cause);
      }
    }
  }
}

// Proxy um ein Repo: Mutationen laufen unverändert durch und werden NACH Erfolg journaliert.
// Kein `any`: der Proxy erhält den konkreten Interface-Typ des Repos zurück.
function journaled<T extends object>(
  repo: T,
  name: keyof AppRepos,
  write: (entry: JournalEntry) => void,
): T {
  const mutators = MUTATING_METHODS[name];
  return new Proxy(repo, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") {
        return value;
      }
      const fn = value as (...args: unknown[]) => unknown;
      if (typeof prop !== "string" || !mutators.includes(prop)) {
        return fn.bind(target);
      }
      return async (...args: unknown[]) => {
        const result = await fn.apply(target, args);
        write({ repo: name, method: prop, args });
        return result;
      };
    },
  });
}

// Alle Repos eines Satzes journalieren (gemeinsame Schreibfunktion → EINE Datei).
export function journaledRepos(repos: AppRepos, write: (entry: JournalEntry) => void): AppRepos {
  const wrapped = {} as Record<keyof AppRepos, object>;
  for (const key of Object.keys(MUTATING_METHODS) as (keyof AppRepos)[]) {
    wrapped[key] = journaled(repos[key] as object, key, write);
  }
  return wrapped as unknown as AppRepos;
}

// Komposition „Dev-Persistenz": Journal laden → in In-Memory-Repos zurückspielen →
// Repos journalierend wrappen → identisch verdrahtete Service-Landschaft.
// append-only via appendFileSync: kein Rewrite der Datei bei jeder Mutation, crash-tolerant
// in Kombination mit dem defensiven Parser (s. o.).
export async function buildDevPersistServices(file: string): Promise<AppServices> {
  mkdirSync(dirname(file), { recursive: true });
  const repos = inMemoryRepos();
  // W1/N6: MIT Herkunftsangabe — nur so kann ein Replayfehler die echte physische Zeile nennen.
  await replayJournal(repos, readJournalLines(file));
  const write = (entry: JournalEntry): void => {
    appendFileSync(file, `${JSON.stringify(entry)}\n`, "utf8");
  };
  return assembleServices(journaledRepos(repos, write));
}
