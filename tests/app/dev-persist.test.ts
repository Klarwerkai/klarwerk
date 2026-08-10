import { appendFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { inMemoryRepos } from "../../services/app/src/build-app";
import {
  DevPersistJournalReplayError,
  type JournalEntry,
  MUTATING_METHODS,
  buildDevPersistServices,
  journaledRepos,
  readJournal,
  readJournalLines,
  replayJournal,
} from "../../services/app/src/dev-persist";

// SCRUM-387: Dev-Persistenz der Desktop-App — Mutations-Journal über die öffentlichen
// Repo-Interfaces (kein Modul-Eingriff), Replay beim Start. Netz- und DOM-frei.
function tmpJournal(): string {
  return join(mkdtempSync(join(tmpdir(), "kw-devpersist-")), "state.jsonl");
}

const ADMIN = { name: "Pedi", email: "pedi@example.com", password: "geheim-123" };

describe("SCRUM-387: dev-persist", () => {
  it("readJournal: fehlende Datei → leer; korrupte Schlusszeile verwirft nur den Rest", () => {
    const file = tmpJournal();
    expect(readJournal(file)).toEqual([]);
    const a: JournalEntry = { repo: "drafts", method: "insert", args: [{ id: "d1" }] };
    const b: JournalEntry = { repo: "drafts", method: "delete", args: ["d1"] };
    appendFileSync(file, `${JSON.stringify(a)}\n${JSON.stringify(b)}\n{"repo":"dra`, "utf8");
    // Crash-Simulation: die halb geschriebene letzte Zeile fällt weg, alles Gültige bleibt.
    expect(readJournal(file)).toEqual([a, b]);
  });

  it("MUTATING_METHODS deckt exakt die Repos der Komposition ab (nichts vergessen)", () => {
    const repoKeys = Object.keys(inMemoryRepos()).sort();
    expect(Object.keys(MUTATING_METHODS).sort()).toEqual(repoKeys);
    // Jede gelistete Mutationsmethode existiert wirklich am In-Memory-Repo.
    const repos = inMemoryRepos() as unknown as Record<string, Record<string, unknown>>;
    for (const [name, methods] of Object.entries(MUTATING_METHODS)) {
      for (const method of methods) {
        expect(typeof repos[name]?.[method], `${name}.${method}`).toBe("function");
      }
    }
  });

  it("journalisiert Mutationen (nach Erfolg), aber keine Lesezugriffe", async () => {
    const entries: JournalEntry[] = [];
    const repos = journaledRepos(inMemoryRepos(), (e) => entries.push(e));
    const draft = {
      id: "d1",
      payload: { title: "T", statement: "S" },
      originalAuthor: "pedi",
      lastEditor: "pedi",
      createdAt: "2026-07-02T00:00:00.000Z",
      updatedAt: "2026-07-02T00:00:00.000Z",
    };
    await repos.drafts.insert(draft as never);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ repo: "drafts", method: "insert" });
    // Lesen ändert nichts am Journal — und liefert den geschriebenen Stand.
    expect((await repos.drafts.list()).map((d) => d.id)).toEqual(["d1"]);
    expect(await repos.drafts.findById("d1")).toBeDefined();
    expect(entries).toHaveLength(1);
    await repos.drafts.delete("d1");
    expect(entries).toHaveLength(2);
  });

  it("Erfolgstest des Briefs: Neustart ohne Ersteinrichtung, Daten bleiben erhalten", async () => {
    const file = tmpJournal();

    // 1. Start: Ersteinrichtung → Admin anlegen → Entwurf speichern.
    const s1 = await buildDevPersistServices(file);
    expect(await s1.auth.needsSetup()).toBe(true);
    await s1.auth.register(ADMIN);
    expect(await s1.auth.needsSetup()).toBe(false);
    await s1.capture.createDraft({ title: "Riemenwechsel L4", statement: "Nach Schicht" }, "Pedi");

    // 2. „App-Neustart": komplett frische Komposition aus derselben Journal-Datei.
    const s2 = await buildDevPersistServices(file);
    expect(await s2.auth.needsSetup()).toBe(false); // KEIN Ersteinrichtungs-Screen mehr.
    const login = await s2.auth.login({ email: ADMIN.email, password: ADMIN.password });
    expect(login.user.role).toBe("admin");
    const drafts = await s2.capture.listDrafts();
    expect(drafts.map((d) => d.payload.title)).toEqual(["Riemenwechsel L4"]);

    // 3. Sicherheit: das Journal enthält NIE das Klartext-Passwort (nur Salt+Hash).
    expect(readFileSync(file, "utf8")).not.toContain(ADMIN.password);
  });

  it("auch die im 2. Lauf erzeugten Sessions/Mutationen landen im Journal (3. Lauf sieht sie)", async () => {
    const file = tmpJournal();
    const s1 = await buildDevPersistServices(file);
    await s1.auth.register(ADMIN);
    const s2 = await buildDevPersistServices(file);
    const { token } = await s2.auth.login({ email: ADMIN.email, password: ADMIN.password });
    const s3 = await buildDevPersistServices(file);
    // Die in Lauf 2 erzeugte Session überlebt den Neustart → kein erneuter Login nötig.
    const me = await s3.auth.authenticate(token);
    expect(me?.email).toBe(ADMIN.email);
  });
});

// ================================================================================================
// W1 · DEV-PERSIST WEG A (N1–N5) — DER ANTWORTBELEG ÜBERLEBT DEN NEUSTART
// ================================================================================================
//
// Pedis Entscheidung: die Zusage wird journalisiert und über Neustarts erhalten. Der Answer-Beleg
// war bis hierher der eine Bestand, der das NICHT tat — `build-app.ts` reichte das Repo als
// OPTION an `assembleServices`, statt es in `AppRepos` zu führen, und benannte die Folge selbst
// als „benannte Restgrenze, kein Versehen": der Beleg lief nicht durch das Dev-Journal.
//
// WAS DIESE FÄLLE PRÜFEN — und was sie bewusst nicht tun. Sie prüfen, dass der Beleg ENTSTEHT
// (N1), dass er als genau zwei geordnete Journalzeilen ANKOMMT (N4), dass er sich daraus
// WIEDERHERSTELLEN lässt (N2) und dass er den Neustart UNVERÄNDERT übersteht (N3). Sie prüfen
// NICHT die Ask-Fachsemantik; die liegt in `services/ask/**` und wird hier nicht berührt.
//
// WARUM N2/N3 DEN WIEDERAUFBAU NACHSTELLEN, statt ein Repo aus den Services zu ziehen: die
// Kompositionswurzel gibt ihre Repos nicht heraus (`buildDevPersistServices` liefert
// `AppServices`). Die beiden Fälle benutzen deshalb GENAU DIE BAUSTEINE, die der Produktpfad in
// `buildDevPersistServices:185-186` selbst benutzt — `inMemoryRepos()`, `readJournal`,
// `replayJournal`. Das ist kein Nachbau der Regel, sondern derselbe Weg mit sichtbarem Ergebnis.
//
// DIE JOURNALDATEI IST DIE WAHRHEIT, die Repos sind ihre Projektion. Genau das machen N2 und N3
// messbar: gemessen wird nie der Prozessspeicher des schreibenden Laufs, sondern immer das, was
// aus der DATEI wieder entsteht.

/** Alle Journalzeilen eines Repos in Dateireihenfolge — die Grundlage von N4. */
function zeilenVon(file: string, repo: string): JournalEntry[] {
  return readJournal(file).filter((e) => e.repo === repo);
}

/** Der Wiederaufbau, wie ihn der Produktpfad fährt: frische Repos, Journal hinein. */
async function ausDemJournal(file: string) {
  const repos = inMemoryRepos();
  await replayJournal(repos, readJournalLines(file));
  return repos;
}

describe("W1/Weg A · N1–N5 · der Answer-Beleg im Dev-Journal", () => {
  /** Ein Antwortlauf über die ECHTE Dev-Persist-Komposition. */
  async function antwortLauf(file: string): Promise<string> {
    const services = await buildDevPersistServices(file);
    await services.ko.activateSearchProjectionV2();
    const out = await services.ask.ask("Gibt es dazu etwas?", "anna", "de");
    // N1: ohne verdrahtetes Repo bliebe das `null` — eine Kennung ohne Beleg wäre eine leere
    // Zusage, und genau deshalb ist `null` im Bestand die ehrliche Antwort.
    expect(out.answerId, "Dev-Persist muss den Beleg-Schreibweg verdrahten").not.toBeNull();
    return out.answerId as string;
  }

  it("N1: ein Antwortlauf über buildDevPersistServices liefert eine Beleg-Identität", async () => {
    const file = tmpJournal();
    const answerId = await antwortLauf(file);
    expect(typeof answerId).toBe("string");
    expect(answerId.length).toBeGreaterThan(0);
  });

  it("N4: genau zwei Journalzeilen je Antwort — createRecord VOR appendSnapshot", async () => {
    const file = tmpJournal();
    await antwortLauf(file);

    const zeilen = zeilenVon(file, "answerSnapshots");
    expect(zeilen.map((e) => e.method)).toEqual(["createRecord", "appendSnapshot"]);
    // Die Reihenfolge ist die Aussage: `appendSnapshot` wirft ohne vorausgehenden Record. Ein
    // Journal in der anderen Reihenfolge wäre beim Replay nicht wiederherstellbar.
  });

  it("N2: aus dem Journal entstehen Record UND Snapshot-Revision 1 wieder", async () => {
    const file = tmpJournal();
    const answerId = await antwortLauf(file);

    const repos = await ausDemJournal(file);
    expect(await repos.answerSnapshots.findRecord(answerId)).toBeDefined();
    expect(await repos.answerSnapshots.findSnapshot(answerId, 1)).toBeDefined();
  });

  it("N3: nach dem Neustart ist der Beleg wieder da — integrityHash UNVERÄNDERT", async () => {
    const file = tmpJournal();
    const answerId = await antwortLauf(file);

    const vorher = await (await ausDemJournal(file)).answerSnapshots.findSnapshot(answerId, 1);
    expect(vorher).toBeDefined();

    // Der „Neustart": eine komplett frische Komposition aus derselben Datei.
    await buildDevPersistServices(file);

    const nachher = await (await ausDemJournal(file)).answerSnapshots.findSnapshot(answerId, 1);
    expect(nachher).toBeDefined();
    // DER EIGENTLICHE PUNKT: nicht „ein Snapshot ist da", sondern DERSELBE. Der Abdruck ist der
    // schärfste Einzelwert dafür — er hängt an jedem Feld des Belegs.
    expect(nachher?.integrityHash).toBe(vorher?.integrityHash);
    expect(nachher).toEqual(vorher);
  });

  it("N5: ein unbekannter Reponame wird beim Replay übersprungen — kein Wurf", async () => {
    const file = tmpJournal();
    const fremd: JournalEntry = { repo: "gibtEsNicht", method: "insert", args: [{ id: "x" }] };
    const bekannt: JournalEntry = { repo: "drafts", method: "insert", args: [{ id: "d1" }] };
    appendFileSync(file, `${JSON.stringify(fremd)}\n${JSON.stringify(bekannt)}\n`, "utf8");

    // Abwärtskompatibilität: ein Journal aus einem Stand mit MEHR Repos darf einen älteren
    // Aufbau nicht zum Absturz bringen. Die bekannte Zeile wird trotzdem gespielt.
    const repos = await ausDemJournal(file);
    expect(await repos.drafts.findById("d1")).toBeDefined();

    // Und dasselbe über den echten Produktpfad — der Start gelingt.
    await expect(buildDevPersistServices(file)).resolves.toBeDefined();
  });

  it("N5b: eine unbekannte METHODE eines bekannten Repos wird ebenso übersprungen", async () => {
    const file = tmpJournal();
    const fremd: JournalEntry = { repo: "drafts", method: "gibtEsNicht", args: [] };
    appendFileSync(file, `${JSON.stringify(fremd)}\n`, "utf8");
    await expect(buildDevPersistServices(file)).resolves.toBeDefined();
  });
});

// ================================================================================================
// W1 · N6 (KW-S4-25 B / KW-S4-27 A) — DAS MANIPULIERTE JOURNAL SCHEITERT LAUT UND LOKALISIERBAR
// ================================================================================================
//
// PRO 131 §6 hat bewiesen, dass eine `appendSnapshot`-Zeile ohne ihre `createRecord`-Zeile durch
// den regulären Code-, Fehler-, Absturz- oder Kürzungspfad NICHT entstehen kann: der Proxy
// schreibt nur nach Erfolg, `appendFileSync` ist ordnungstreu, und `readJournal` beendet das
// Einlesen an einer angebrochenen Zeile. Wer sie im Journal findet, hat eine BEARBEITETE Datei.
//
// Der Start scheiterte daran auch bisher schon — aber mit `AskError("NOT_FOUND", "Zu diesem
// Snapshot gibt es keine Antwort.")`. Das ist ein fachlich klingender Satz für einen
// Integritätsdefekt, und er nennt weder Zeile noch Repo noch Methode. KW-S4-25 entscheidet
// deshalb B: ein eigener benannter Fehler. KW-S4-27 entscheidet A: für jeden heute erreichbaren
// Wurf einer VALIDIERTEN BEKANNTEN Operation gilt `JOURNAL_INTEGRITY_VIOLATION`.
//
// DIE ZEILENNUMMER IST DER SCHARFE TEIL. Sie ist die echte physische Dateizeile — sie zählt auch
// Leerzeilen und formal gelesene, aber verworfene Zeilen mit, und sie darf NICHT aus dem Index
// der bereits akzeptierten Einträge rekonstruiert werden (KW-S4-27). Eine falsche Zeilennummer
// wäre schlimmer als keine: sie schickt den Betreiber an die falsche Stelle einer Datei, die er
// gerade als manipuliert verdächtigt.

/** Ein Sessiontoken-artiger Wert im Journal — er darf den Fehler NIE berühren. */
const TOKEN = "tok_7Hs93JdkeUxQm2LpAa04ZzVvBb61CcNn";
const HASH = "9f2c41aa0b7e5d3c8814ffa6e2b0d75913c4a8e6b1d0f7a25c93e48b6d1a0c72";

/** Die Belegrevision, wie sie im Journal steht — mit Abdruck und einem Token in den Argumenten. */
function snapshotArg(answerId: string): Record<string, unknown> {
  return {
    answerId,
    snapshotRevision: 1,
    supersedesSnapshotRevision: null,
    schemaVersion: 1,
    capturedAt: "2026-08-03T09:00:00.000Z",
    citedSources: [],
    evidence: [],
    resolutionId: null,
    resolutionIdReason: "w1_not_on_answer_path",
    validationDecisionRef: null,
    validationDecisionRefReason: "w3c_no_decision_carrier",
    status: "PENDING_EVIDENCE",
    integrityHash: HASH,
    sitzungstoken: TOKEN,
  };
}

/**
 * Das manipulierte Journal aus KW-S4-27 und BASIC 142 — vier physische Zeilen:
 *
 *   1  gültiges JSON, FALSCHE Form  -> von `readJournal` verworfen, aber KEIN Abbruch
 *   2  eine bekannte, harmlose Zeile
 *   3  LEERZEILE
 *   4  `appendSnapshot` mit einer answerId, zu der es keinen Record gibt  -> wirft
 *
 * Eine index-basierte Zählung käme hier auf 2. Die Wahrheit ist 4.
 */
function manipuliertesJournal(): { file: string; zeile: number } {
  const file = tmpJournal();
  const zeilen = [
    JSON.stringify({ foo: 1 }),
    JSON.stringify({ repo: "drafts", method: "insert", args: [{ id: "d1" }] }),
    "",
    JSON.stringify({
      repo: "answerSnapshots",
      method: "appendSnapshot",
      args: [snapshotArg("a-ohne-record")],
    }),
  ];
  appendFileSync(file, `${zeilen.join("\n")}\n`, "utf8");
  return { file, zeile: 4 };
}

/** Der Fehler, den der Start wirft — als Objekt, nicht als Text. */
async function startFehler(file: string): Promise<DevPersistJournalReplayError> {
  try {
    await buildDevPersistServices(file);
  } catch (err) {
    return err as DevPersistJournalReplayError;
  }
  throw new Error("Der Start haette fail-closed scheitern muessen, tat es aber nicht.");
}

describe("W1/N6 · der benannte fail-closed Replayfehler", () => {
  it("B-1: der Start scheitert mit DevPersistJournalReplayError, nicht mit einem Fachfehler", async () => {
    const { file } = manipuliertesJournal();
    const err = await startFehler(file);

    expect(err).toBeInstanceOf(DevPersistJournalReplayError);
    expect(err.name).toBe("DevPersistJournalReplayError");
    expect(err.code).toBe("DEV_PERSIST_JOURNAL_REPLAY_FAILED");
    expect(err.phase).toBe("REPLAY");
  });

  it("B-2: lineNumber ist die ECHTE physische Zeile — inklusive Leer- und verworfener Zeilen", async () => {
    const { file, zeile } = manipuliertesJournal();
    const err = await startFehler(file);

    // Der Kern des Falls. Index+1 der akzeptierten Einträge wäre 2 (Zeile 1 verworfen, Zeile 3
    // leer). Beides zählt mit — die Datei hat vier Zeilen, und die vierte ist die schuldige.
    expect(err.lineNumber).toBe(zeile);
    expect(Number.isInteger(err.lineNumber)).toBe(true);
    expect(err.lineNumber).toBeGreaterThan(0);
  });

  it("B-3: repo, method und reasonCode sind gesetzt UND kanonisch validiert", async () => {
    const { file } = manipuliertesJournal();
    const err = await startFehler(file);

    expect(err.repo).toBe("answerSnapshots");
    expect(err.method).toBe("appendSnapshot");
    // KW-S4-27 A: eine validierte bekannte Operation, die beim Replay wirft, IST eine
    // Journalintegritätsverletzung. Ein anderer Wert wäre heute unbelegt.
    expect(err.reasonCode).toBe("JOURNAL_INTEGRITY_VIOLATION");

    // Die zweite Hälfte ist der eigentliche Wert: nicht nur der Inhalt stimmt, sondern die
    // Werte stammen nachweislich aus dem Registry — ein durchgereichter Rohwert fiele hier auf.
    const bekannt = Object.keys(MUTATING_METHODS) as (keyof typeof MUTATING_METHODS)[];
    expect(bekannt).toContain(err.repo);
    expect([...MUTATING_METHODS[err.repo as keyof typeof MUTATING_METHODS]]).toContain(err.method);
  });

  it("B-4: kein Payload-, Secret-, Abdruck- oder Pfadleck", async () => {
    const { file } = manipuliertesJournal();
    const err = await startFehler(file);

    const sichtbar = JSON.stringify({
      name: err.name,
      code: err.code,
      phase: err.phase,
      lineNumber: err.lineNumber,
      repo: err.repo,
      method: err.method,
      reasonCode: err.reasonCode,
      message: err.message,
    });

    expect(sichtbar).not.toContain(TOKEN);
    expect(sichtbar).not.toContain(HASH);
    expect(sichtbar).not.toContain("a-ohne-record");
    expect(sichtbar).not.toContain("args");
    // Kein absoluter Journalpfad in einer nutzer-/HTTP-sichtbaren Meldung (KW-S4-25).
    expect(sichtbar).not.toContain(file);
    expect(err.message).not.toContain(".jsonl");
  });

  it("B-5: die Ursache ist intern verkettet, aber nicht in die Meldung gereicht", async () => {
    const { file } = manipuliertesJournal();
    const err = await startFehler(file);

    expect(err.cause).toBeDefined();
    const ursache = err.cause as Error;
    // Der Fachfehler bleibt für die interne Diagnose erhalten …
    expect(ursache).toBeInstanceOf(Error);
    // … aber sein Text reist NICHT nach außen mit.
    expect(err.message).not.toContain(ursache.message);
  });

  it("B-6: kein Teilzustand — der Start liefert nichts, obwohl gültige Zeilen vorausgingen", async () => {
    const { file } = manipuliertesJournal();
    await expect(buildDevPersistServices(file)).rejects.toBeInstanceOf(
      DevPersistJournalReplayError,
    );

    // GEGENKONTROLLE: dieselben gültigen Zeilen OHNE die manipulierte ergeben sehr wohl einen
    // Aufbau — sonst wäre der Fall auch bei einem generell kaputten Journal grün.
    const heil = tmpJournal();
    appendFileSync(
      heil,
      `${JSON.stringify({ repo: "drafts", method: "insert", args: [{ id: "d1" }] })}\n`,
      "utf8",
    );
    const services = await buildDevPersistServices(heil);
    expect(await services.capture.listDrafts()).toHaveLength(1);
  });

  it("B-7: N5 ist KEIN Fallback für N6 — die erkannte Operation wird nicht übersprungen", async () => {
    const { file } = manipuliertesJournal();
    // Würde der Rahmen nach dem Wurf weiterlaufen (catch/continue), käme hier ein Servicebündel
    // heraus. Genau das verbietet KW-S4-27: kein Überspringen, kein Fortsetzen.
    await expect(buildDevPersistServices(file)).rejects.toBeDefined();
  });

  it("B-8: N5 bleibt grün — unbekannte Paare werden weiterhin still übersprungen", async () => {
    const file = tmpJournal();
    appendFileSync(
      file,
      `${JSON.stringify({ repo: "gibtEsNicht", method: "insert", args: [{}] })}\n` +
        `${JSON.stringify({ repo: "drafts", method: "gibtEsNicht", args: [] })}\n` +
        `${JSON.stringify({ repo: "drafts", method: "insert", args: [{ id: "d1" }] })}\n`,
      "utf8",
    );
    const services = await buildDevPersistServices(file);
    expect(await services.capture.listDrafts()).toHaveLength(1);
  });
});
