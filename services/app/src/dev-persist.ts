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
import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { type AppRepos, type AppServices, assembleServices, inMemoryRepos } from "./build-app";
import { journalZeileFuer, ohneVorgang } from "./speicher-vorgang";

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
  // R-0162: das Quellabgleichsergebnis eines Laufs muss einen Dev-Neustart ebenso überleben wie
  // der Lauf selbst. `speichere` ersetzt je Lauf — das Replay ist damit deterministisch.
  quellabgleich: ["speichere"],
  // R-0169 (Nacharbeit 5): die Fassungen der Dokumentakte überleben den Dev-Neustart.
  dokumente: ["insertFassung"],
  // SCRUM-504: der atomare Bootstrap-Claim ist eine Mutation (fügt den Admin ein) → muss journaliert
  // werden, sonst überlebt der erste Admin den Dev-Neustart nicht. In Dev (sequenziell) genau einmal mit
  // Erfolg gerufen; Replay auf die leere Instanz beansprucht den Slot identisch.
  users: ["insert", "update", "delete", "tryClaimBootstrapAdmin"],
  sessions: ["create", "delete", "deleteByUser"],
  resetTokens: ["create", "delete"],
  // R-0169 (Nacharbeit 8, bens Befund zum Neustartrundlauf): `insertIfOperationAbsent` (Anlage mit
  // Vorgangskennung, der Word-Weg) und `updateWennStand` (Fortsetzen und das Binden der
  // Dokumentfassung, `CaptureService.dokumentHerkunftBinden`) sind Mutationen. Ohne sie verlor ein
  // Dev-Neustart den Entwurf bzw. seinen Fassungsbezug. Das Replay ist deterministisch: beide tragen
  // ihre Bedingung in den Argumenten, und in derselben Reihenfolge trifft sie denselben Stand.
  drafts: ["insert", "update", "delete", "insertIfOperationAbsent", "updateWennStand"],
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
  // Aufnahme 20260922 · Prüfung-Gedächtnis: `put` ersetzt je Paar (letzter Stand gewinnt) — das
  // Replay ist deterministisch. Ohne den Eintrag ginge nach einem Neustart erneut alles an die KI.
  conflictMemory: ["put"],
  // Berater-Konzept Duplikate 04.07. (Stufe D3b): Überschneidungs-Einträge überleben den Neustart.
  overlapRepo: ["insert", "update", "closeOpenForKo"],
  // Pedi 04.07.: eingestellte Anzeige-Schwelle überlebt den Neustart (letzter Set gewinnt).
  overlapSettings: ["set"],
  // R-0751 / R-1639 / R-2183 (Nacharbeit 3): Bereichsprofile und Ruhestandshorizonte überleben den
  // Neustart. Die args tragen den fertigen Datensatz (inkl. Zeitstempel/Frist) → Replay exakt.
  managementProfiles: ["setCategoryProfile", "setRetirement", "removeRetirement"],
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

/**
 * Auftrag gesamt-dubletten-rueckzug (Lauf 4, BEN-R3-2): der NEUAUFSATZ nach einem gescheiterten
 * Schreibaufruf. Ein Schreibaufruf kann scheitern, nachdem er schon einen Teil seiner Zeile
 * geschrieben hat (ENOSPC mitten im Anhängen). Ohne Gegenmassnahme hinge die nächste, bestätigte
 * Zeile an diesem Rest, das Einlesen bräche dort ab — und alles Bestätigte danach fehlte beim
 * Replay. Deshalb schreibt das Journal nach einem Fehler VOR der nächsten Zeile diese Markierung:
 * sie schliesst einen etwaigen Rest zu einer als verworfen erkennbaren Zeile ab (`readJournalLines`
 * überspringt sie) und steht, wenn nichts geschrieben war, als eigene, beim Lesen übergangene Zeile.
 * Kein Repo trägt diesen Namen; auch ein älterer Leser spielt sie nicht zurück.
 */
const NEUAUFSATZ: JournalEntry = { repo: "journal", method: "neuaufsatz", args: [] };
// Die geschriebene Form von `NEUAUFSATZ` als Literal, nicht als `JSON.stringify(NEUAUFSATZ)`: ein
// Aufruf auf Modulebene machte diese Bibliothek für den Einstiegspunkt-Wächter
// (tests/demo-zugang-start/vertrag-am-einstiegspunkt.test.ts, R2/7) zum Prozessstart (BEN-R5-6).
// Dass beide Formen übereinstimmen, belegt der Neuaufsatz-Durchlauf in
// tests/dubletten-ruecknahme-lesepfad/journal-teilschreiben.test.ts.
const NEUAUFSATZ_TEXT = '{"repo":"journal","method":"neuaufsatz","args":[]}';

// Journal defensiv laden: fehlende Datei → leer; eine korrupte (z. B. beim Crash halb
// geschriebene) Zeile beendet das Einlesen ab dort — alles Gültige davor bleibt erhalten. Eine
// letzte Zeile OHNE Zeilenende ist nie bestätigt und wird nie gelesen (Lauf 4, Runde 2).
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
  // Lauf 4, Runde 2 (BEN-R3-2): BESTÄTIGT ist eine Zeile erst mit ihrem Zeilenende. Jeder
  // Schreibaufruf hängt `JSON + "\n"` in EINEM Aufruf an; ist er zurückgekehrt, steht das
  // Zeilenende. Was nach dem letzten Zeilenende steht, stammt also aus einem Aufruf, der gescheitert
  // oder abgebrochen ist — auch wenn es gültiges JSON ist (ENOSPC genau vor dem letzten Byte). Der
  // Aufrufer hat dafür einen Fehler bekommen, die Klammer hat zurückgestellt; es wirkt nie.
  const physisch = readFileSync(file, "utf8").split("\n");
  physisch.pop(); // das Unbestätigte (bei sauberem Ende die leere Zeichenkette nach dem letzten "\n")
  for (const line of physisch) {
    lineNumber += 1;
    if (line.trim().length === 0 || line === NEUAUFSATZ_TEXT) {
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
      // Auftrag gesamt-dubletten-rueckzug (Lauf 4, BEN-R3-2): ein Rest eines gescheiterten
      // Schreibaufrufs, den der nächste Schreibaufruf mit dem Neuaufsatz abgeschlossen hat (s.
      // `mitNeuaufsatz`). Der Rest wurde als Fehler gemeldet und nie bestätigt; was danach steht,
      // ist bestätigt und wird weiter gelesen. Jede andere ungültige Zeile beendet wie bisher.
      if (line.endsWith(NEUAUFSATZ_TEXT)) {
        continue;
      }
      break;
    }
  }
  return lines;
}

// R-1349: Die Projektion `readJournal` (ohne Zeilennummer) hatte keinen Produktaufrufer und ist
// entfernt. Start und Bestätigung lesen über `readJournalLines`; die Tests bilden die Projektion lokal.

// Journal in frische Repos zurückspielen — ausschließlich über die öffentlichen Interfaces.
// Unbekannte Repo-/Methodennamen werden bewusst übersprungen (versionstolerant statt Crash).
//
// W1/N6: Ein Wurf einer BEKANNTEN, gegen `MUTATING_METHODS` validierten Operation ist dagegen
// kein Toleranzfall, sondern eine Integritätsverletzung (KW-S4-27 A) — er bricht den Start
// fail-closed ab. Übersprungen wird nichts, fortgesetzt wird nichts, ein Ersatz-Repo gibt es nicht.
export async function replayJournal(repos: AppRepos, lines: readonly JournalLine[]): Promise<void> {
  // Lauf 5 (BEN-R4-1): eine Vorgangszeile wirkt nur mit ihrer Bestätigung und ohne Widerruf —
  // dieselbe Regel, mit der auch die laufende Instanz einen ungewissen Ausgang klärt (`wirksamIn`).
  const wirksam = wirksamIn(lines);
  for (const { lineNumber, entry } of lines) {
    if (istVorgangsZeile(entry)) {
      const vorgang = (entry as VorgangsEintrag).vorgang;
      if (typeof vorgang !== "string" || !wirksam(vorgang)) {
        continue;
      }
    }
    // Auftrag gesamt-dubletten-rueckzug (Runde 3, BEN-R3-2): eine Vorgangszeile trägt ALLE Zeilen
    // eines Rücknahme-Vorgangs und wird hier als Ganzes angewandt — mit derselben Prüfung je
    // Teilzeile.
    const teile = istVorgangsZeile(entry) ? (entry.args as JournalEntry[]) : [entry];
    for (const teil of teile) {
      await wendeAn(repos, lineNumber, teil);
    }
  }
}

/**
 * Die Journalzeile eines Rücknahme-Vorgangs (speicher-vorgang.ts): `args` sind die Zeilen des
 * Vorgangs in Schreibreihenfolge, `vorgang` seine Kennung. EINE Zeile, EIN Schreibaufruf — sie wirkt
 * beim Replay nur ganz und nur, wenn ihre `BESTAETIGUNG` steht (Lauf 5).
 */
export const VORGANG_ZEILE = { repo: "ruecknahmeVorgang", method: "abschluss" } as const;

type VorgangsEintrag = JournalEntry & { vorgang?: string };

/**
 * Lauf 5 (BEN-R4-1): die BESTÄTIGUNG einer Vorgangszeile — eine eigene, zweite Zeile mit der Kennung.
 *
 * Ein gescheiterter Schreibaufruf hat einen UNGEWISSEN Ausgang: er kann die Zeile samt Zeilenende
 * vollständig geschrieben haben und erst danach scheitern (EIO beim Schliessen). In Lauf 4 machte
 * das die Vorgangszeile selbst ungewiss; ihr Unwirksam-Machen hing an einem Widerruf, der nur
 * flüchtig offen blieb, wenn auch er nicht geschrieben werden konnte — Replay und Neustart spielten
 * den im Speicher zurückgestellten Vorgang dann doch zurück. Jetzt gilt: eine Vorgangszeile OHNE
 * Bestätigung wirkt nie. Scheitert die Vorgangszeile, wird keine Bestätigung geschrieben — was auch
 * immer von ihr in der Datei steht, bleibt wirkungslos, ohne dass danach noch etwas geschrieben
 * werden muss. Die verbleibende Ungewissheit sitzt allein in der Bestätigung; wie sie aufgelöst wird,
 * steht an `mitBestaetigung`.
 */
const BESTAETIGUNG = { repo: "ruecknahmeVorgang", method: "bestaetigung" } as const;

/**
 * Der WIDERRUF einer Vorgangskennung: hebt eine etwa stehende Bestätigung auf. Nur dort tragend, wo
 * der Ausgang der Bestätigung nicht durch Zurücklesen geklärt werden konnte (s. `mitBestaetigung`).
 */
const WIDERRUF = { repo: "journal", method: "widerruf" } as const;

function kennungAus(
  entry: JournalEntry,
  art: { readonly repo: string; readonly method: string },
): string | undefined {
  if (entry.repo !== art.repo || entry.method !== art.method) {
    return undefined;
  }
  const [kennung] = entry.args;
  return typeof kennung === "string" ? kennung : undefined;
}

function istVorgangsZeile(entry: JournalEntry): boolean {
  return (
    entry.repo === VORGANG_ZEILE.repo &&
    entry.method === VORGANG_ZEILE.method &&
    Array.isArray(entry.args) &&
    entry.args.every(
      (t) =>
        typeof t === "object" &&
        t !== null &&
        typeof (t as JournalEntry).repo === "string" &&
        typeof (t as JournalEntry).method === "string" &&
        Array.isArray((t as JournalEntry).args),
    )
  );
}

async function wendeAn(repos: AppRepos, lineNumber: number, entry: JournalEntry): Promise<void> {
  const allowed = MUTATING_METHODS[entry.repo as keyof AppRepos];
  if (!allowed || !allowed.includes(entry.method)) {
    return; // N5: Abwärtskompatibilität — und ausdrücklich KEIN Fallback für N6.
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

// Proxy um ein Repo: Mutationen laufen unverändert durch und werden NACH Erfolg journaliert.
// Kein `any`: der Proxy erhält den konkreten Interface-Typ des Repos zurück.
//
// Lauf 5, Runde 2 (BEN-R5-1): ist der Ausgang eines Rücknahme-Vorgangs UNGEWISS (s.
// `mitBestaetigung`), wird jeder Aufruf dieser Ablagen — lesend wie schreibend — zuerst an der Datei
// aufgelöst (`waechter.aufloesen`); gelingt das nicht, wird er abgewiesen. Ausgenommen sind nur die
// Rückstellmethoden der Klammer (`RUECKSTELLMETHODEN`), die im selben Zug den Speicher zurücksetzen.
function journaled<T extends object>(
  repo: T,
  name: keyof AppRepos,
  write: (entry: JournalEntry) => void,
  vorgangAbschluss: (zeilen: JournalEntry[]) => void,
  waechter: Waechter,
): T {
  const mutators = MUTATING_METHODS[name];
  return new Proxy(repo, {
    get(target, prop, receiver) {
      // Aufnahme gesamt-auditprotokoll: `appendNext` schreibt in der Ablage an `append`/`appendOnce`
      // vorbei und landete so nicht im Journal — nach einem Neustart fehlte der Eintrag. Die
      // journalierte Ablage bietet ihn nicht an; der Audit-Dienst nimmt `last` + `append`/`appendOnce`
      // (ungeteilt unter der `kettenSperre` der Speicher-Klammer, services/app/src/speicher-vorgang.ts).
      if (name === "auditRepo" && prop === "appendNext") {
        return undefined;
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") {
        return value;
      }
      const fn = value as (...args: unknown[]) => unknown;
      if (typeof prop !== "string" || !mutators.includes(prop)) {
        if (typeof prop !== "string" || RUECKSTELLMETHODEN.includes(prop)) {
          return fn.bind(target);
        }
        return (...args: unknown[]) =>
          waechter.ungewiss()
            ? waechter.aufloesen().then(() => fn.apply(target, args))
            : fn.apply(target, args);
      }
      return async (...args: unknown[]) => {
        await waechter.aufloesen();
        const result = await fn.apply(target, args);
        // Auftrag gesamt-dubletten-rueckzug (Runden 2/3, BEN-R3-1/-2): gehört der Aufruf zu einem
        // offenen Rücknahme-Vorgang ohne Datenbank (speicher-vorgang.ts), wird die Zeile
        // zurückgehalten und beim Abschluss mit allen anderen des Vorgangs geschrieben (Vorgangszeile
        // und Bestätigung). Scheitert das, stellt die Klammer den Speicher zurück.
        const zeile: JournalEntry = { repo: name, method: prop, args: ohneVorgang(args) };
        if (!journalZeileFuer(args, zeile, vorgangAbschluss)) {
          write(zeile);
        }
        return result;
      };
    },
  });
}

/** Die Rückstellmethoden der Klammer (speicher-vorgang.ts) — nie vom Wächter aufgehalten. */
const RUECKSTELLMETHODEN: readonly string[] = ["zuruecksetzen", "verwerfen"];

/**
 * Die Schreibfunktion mit Neuaufsatz (s. `NEUAUFSATZ`): nach einem gescheiterten Schreibaufruf —
 * oder wenn das Journal schon mit einem unvollständigen Rest endet (`restAmEnde`) — geht dem
 * nächsten Eintrag die Markierung voraus. Scheitert auch sie, bleibt der Zustand „gestört“ und der
 * Eintrag gilt als nicht geschrieben (der Aufrufer bekommt den Fehler, die Klammer stellt zurück).
 */
function mitNeuaufsatz(
  write: (entry: JournalEntry) => void,
  restAmEnde: boolean,
): (entry: JournalEntry) => void {
  let gestoert = restAmEnde;
  return (entry) => {
    try {
      if (gestoert) {
        write(NEUAUFSATZ);
        gestoert = false;
      }
      write(entry);
    } catch (error) {
      gestoert = true;
      throw error;
    }
  };
}

/**
 * DIE Wirksamkeitsregel einer Vorgangszeile: ihre Bestätigung steht, und kein Widerruf hebt sie auf.
 * Replay (`replayJournal`) und die Klärung eines ungewissen Ausgangs (`bestaetigungInDatei`) benutzen
 * beide genau diese Funktion — sonst könnte die laufende Instanz nach der Klärung einen anderen Stand
 * zeigen als ein Neustart (Lauf 5, Runde 3, BEN-R5-2: ein vollständig geschriebener Widerruf, dessen
 * Schreibaufruf trotzdem scheiterte, wurde von der Klärung übersehen).
 */
function wirksamIn(lines: readonly JournalLine[]): (vorgang: string) => boolean {
  const bestaetigt = new Set<string>();
  const widerrufen = new Set<string>();
  for (const { entry } of lines) {
    const bestaetigung = kennungAus(entry, BESTAETIGUNG);
    if (bestaetigung !== undefined) {
      bestaetigt.add(bestaetigung);
    }
    const widerruf = kennungAus(entry, WIDERRUF);
    if (widerruf !== undefined) {
      widerrufen.add(widerruf);
    }
  }
  return (vorgang) => bestaetigt.has(vorgang) && !widerrufen.has(vorgang);
}

/**
 * Liest zurück, ob ein Vorgang laut Journal WIRKT (`wirksamIn`: Bestätigung steht, kein Widerruf) —
 * mit genau der Lesung und Regel, die auch Replay und Neustart verwenden. `undefined`, wenn das nicht
 * feststellbar ist (Lesefehler).
 */
export type BestaetigungLesen = (vorgang: string) => boolean | undefined;

/** Das Zurücklesen aus der Journaldatei selbst (Komposition `buildDevPersistServices`). */
export function bestaetigungInDatei(file: string): BestaetigungLesen {
  return (vorgang) => {
    try {
      return wirksamIn(readJournalLines(file))(vorgang);
    } catch {
      return undefined;
    }
  };
}

/**
 * Lauf 5, Runde 2 (BEN-R5-1): der Ausgang eines Rücknahme-Vorgangs ist UNGEWISS und im Moment
 * nicht auflösbar. Der Aufrufer bekommt diesen Fehler statt eines gewöhnlichen Fehlschlags: es ist
 * NICHT gesagt, dass der Vorgang nicht stattfand. Bis der Ausgang an der Datei geklärt ist, weisen
 * die Ablagen dieses Journals jeden Aufruf mit demselben Fehler ab.
 */
export class JournalAusgangUngewiss extends Error {
  readonly code = "JOURNAL_AUSGANG_UNGEWISS";
  readonly vorgang: string;

  constructor(vorgang: string, cause: unknown) {
    // Die Meldung geht über `sendError` nach aussen (http.ts: 503) und ist deshalb ein fester Satz:
    // Ursache (Datenträgermeldung, ggf. mit Pfad) und Vorgangskennung stehen nur in `cause` bzw.
    // `vorgang` (Lauf 5, Runde 3, BEN-R5-3).
    super(
      "Der Ausgang ist ungewiss: der Speicher ist gerade weder lesbar noch beschreibbar. Bitte später neu laden, bevor Sie es erneut versuchen.",
      { cause },
    );
    this.name = "JournalAusgangUngewiss";
    this.vorgang = vorgang;
  }
}

/** Der geteilte Zustand eines Journals: steht ein Vorgang mit ungewissem Ausgang offen? */
interface Waechter {
  ungewiss(): boolean;
  /** Klärt einen ungewissen Ausgang an der Datei; wirft `JournalAusgangUngewiss`, solange das nicht geht. */
  aufloesen(): Promise<void>;
}

/**
 * Lauf 5 (BEN-R4-1) und Lauf 5, Runde 2 (BEN-R5-1): Abschluss eines Rücknahme-Vorgangs in zwei
 * Zeilen — Vorgangszeile, dann Bestätigung (s. `BESTAETIGUNG`). Die Klammer stellt zurück, wenn
 * dieser Abschluss wirft.
 *
 *   Vorgangszeile scheitert  Keine Bestätigung → wirkt nie, gleich was in der Datei steht. Wirft.
 *                            (Ein Widerruf wird noch versucht, ist hier aber nicht tragend.)
 *   Bestätigung scheitert    Der Ausgang wird durch Zurücklesen geklärt (`lesen`):
 *                              steht sie bestätigt  → der Vorgang wirkt; Rückkehr ohne Fehler.
 *                              steht sie nicht      → wirkt nie. Wirft.
 *                              nicht feststellbar   → Widerruf; gelingt er, wirkt der Vorgang nie.
 *                                                     Wirft.
 *                              auch der Widerruf    → UNGEWISS (BEN-R5-1), s. unten.
 *                              scheitert
 *
 * UNGEWISS: Der Prozess kann nicht wissen, ob die Bestätigung in der Datei steht — eine vollständig
 * geschriebene Zeile mit anschliessendem Fehler und eine gar nicht geschriebene melden ihm dasselbe,
 * und Lesen wie Schreiben scheitern. Kein fester Speicherstand passt dann zu beiden möglichen
 * Dateien. Deshalb gilt der Speicher in diesem Zustand NICHT als Wahrheit: die Klammer stellt ihn
 * zurück, der Aufrufer bekommt `JournalAusgangUngewiss` (kein „zurückgestellt“), und JEDER weitere
 * Aufruf der Ablagen klärt zuerst an der Datei (`aufloesen`) — mit DERSELBEN Regel wie das Replay
 * (`wirksamIn`): wirkt der Vorgang laut Datei (Bestätigung steht, kein Widerruf — auch keiner, der
 * trotz Schreibfehler vollständig gespeichert wurde), werden seine Zeilen in den Speicher
 * nachgetragen; wirkt er nicht oder gelingt jetzt der Widerruf, bleibt es beim zurückgestellten
 * Speicher. Solange beides nicht geht, wird der
 * Aufruf abgewiesen. So zeigt die laufende Instanz nie einen anderen Stand als Replay und Neustart:
 * sie zeigt entweder den Stand der Datei oder gar keinen.
 */
function mitBestaetigung(
  write: (entry: JournalEntry) => void,
  lesen: BestaetigungLesen | undefined,
  roh: AppRepos,
): {
  write: (entry: JournalEntry) => void;
  vorgangAbschluss: (zeilen: JournalEntry[]) => void;
  waechter: Waechter;
} {
  let offen: { vorgang: string; zeilen: JournalEntry[]; fehler: unknown } | undefined;
  let laufend: Promise<void> | undefined;
  const widerruf = (vorgang: string): JournalEntry => ({
    repo: WIDERRUF.repo,
    method: WIDERRUF.method,
    args: [vorgang],
  });
  const liest = (vorgang: string): boolean | undefined => {
    try {
      return lesen?.(vorgang);
    } catch {
      return undefined;
    }
  };
  /** Wirkt der Vorgang laut Datei? Unklar → Widerruf versuchen; gelingt er, wirkt er nicht. */
  const klaeren = (vorgang: string): boolean | undefined => {
    const steht = liest(vorgang);
    if (steht !== undefined) {
      return steht;
    }
    try {
      write(widerruf(vorgang));
      return false;
    } catch {
      return undefined;
    }
  };
  const waechter: Waechter = {
    ungewiss: () => offen !== undefined,
    aufloesen: () => {
      if (!offen) {
        return Promise.resolve();
      }
      // Ein Klärungslauf für alle gleichzeitigen Aufrufer; scheitert er, versucht der nächste Aufruf
      // es neu (das Zurücksetzen läuft asynchron NACH der Zuweisung).
      laufend ??= (async () => {
        const ungewiss = offen;
        if (!ungewiss) {
          return;
        }
        const steht = klaeren(ungewiss.vorgang);
        if (steht === undefined) {
          throw new JournalAusgangUngewiss(ungewiss.vorgang, ungewiss.fehler);
        }
        if (steht) {
          // Die Datei sagt: der Vorgang wirkt. Der Speicher folgt ihr — wie beim Replay.
          for (const teil of ungewiss.zeilen) {
            await wendeAn(roh, 0, teil);
          }
        }
        offen = undefined;
      })().finally(() => {
        laufend = undefined;
      });
      return laufend;
    },
  };
  const blockiert = (): void => {
    if (offen) {
      throw new JournalAusgangUngewiss(offen.vorgang, offen.fehler);
    }
  };
  return {
    write: (entry) => {
      blockiert();
      write(entry);
    },
    vorgangAbschluss: (zeilen) => {
      blockiert();
      const vorgang = randomUUID();
      const zeile: VorgangsEintrag = {
        repo: VORGANG_ZEILE.repo,
        method: VORGANG_ZEILE.method,
        args: zeilen,
        vorgang,
      };
      try {
        write(zeile);
      } catch (fehler) {
        try {
          write(widerruf(vorgang)); // nicht tragend: ohne Bestätigung wirkt die Zeile ohnehin nie
        } catch {
          // bewusst ohne Folge
        }
        throw fehler;
      }
      try {
        write({ repo: BESTAETIGUNG.repo, method: BESTAETIGUNG.method, args: [vorgang] });
      } catch (fehler) {
        const steht = klaeren(vorgang);
        if (steht === true) {
          return;
        }
        if (steht === undefined) {
          offen = { vorgang, zeilen, fehler };
          throw new JournalAusgangUngewiss(vorgang, fehler);
        }
        throw fehler;
      }
    },
    waechter,
  };
}

// Alle Repos eines Satzes journalieren (gemeinsame Schreibfunktion → EINE Datei).
// `restAmEnde`: das Journal endet beim Start mit einem unvollständigen Rest (s. `buildDevPersistServices`).
// `lesen`: Zurücklesen einer Bestätigung nach einem Schreibfehler (s. `mitBestaetigung`); ohne es
// gilt ihr Ausgang als nicht feststellbar.
export function journaledRepos(
  repos: AppRepos,
  rohesSchreiben: (entry: JournalEntry) => void,
  restAmEnde = false,
  lesen?: BestaetigungLesen,
): AppRepos {
  const { write, vorgangAbschluss, waechter } = mitBestaetigung(
    mitNeuaufsatz(rohesSchreiben, restAmEnde),
    lesen,
    repos,
  );
  const wrapped = {} as Record<keyof AppRepos, object>;
  for (const key of Object.keys(MUTATING_METHODS) as (keyof AppRepos)[]) {
    wrapped[key] = journaled(repos[key] as object, key, write, vorgangAbschluss, waechter);
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
  return assembleServices(
    journaledRepos(repos, write, restAmEnde(file), bestaetigungInDatei(file)),
  );
}

// Lauf 4 (BEN-R3-2, Runde 2): endet das Journal ohne Zeilenende (Abbruch oder Fehler mitten im
// Anhängen), ist der Rest unbestätigt und wurde beim Einlesen eben übergangen (s. `readJournalLines`)
// — auch dann, wenn er gültiges JSON ist. Das erste Schreiben dieses Laufs setzt deshalb mit dem
// Neuaufsatz neu auf; sonst hinge seine Zeile am Rest. Der Rest selbst bekommt NIE ein Zeilenende:
// das machte einen gescheiterten, zurückgestellten Vorgang nachträglich wirksam.
function restAmEnde(file: string): boolean {
  if (!existsSync(file)) {
    return false;
  }
  const inhalt = readFileSync(file, "utf8");
  return inhalt.length > 0 && !inhalt.endsWith("\n");
}
