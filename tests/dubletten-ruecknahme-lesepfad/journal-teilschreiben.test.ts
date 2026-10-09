import { appendFileSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  type AppRepos,
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import {
  type BestaetigungLesen,
  type JournalEntry,
  bestaetigungInDatei,
  buildDevPersistServices,
  journaledRepos,
  readJournalLines,
  replayJournal,
} from "../../services/app/src/dev-persist";

// R-1349: die Projektion ohne Zeilennummer lebt hier statt als Produktexport `readJournal`, den
// kein Produktcode las. Der Betrieb liest über `readJournalLines` — genau diese Lesung wird geprüft.
const readJournal = (file: string): JournalEntry[] => readJournalLines(file).map((l) => l.entry);

// ================================================================================================
// Auftrag gesamt-dubletten-rueckzug, Lauf 4 — BENS BEN-R3-2 (Rest): TEILSCHREIBEN IM JOURNAL.
// ================================================================================================
//
// Ben (Lauf 3, Runde 3) hat an der Schreibgrenze von `journaledRepos` mit einer ECHTEN Datei
// gemessen: der Abschluss eines Rückzugs bzw. einer Wiederherstellung schreibt die halbe
// Vorgangszeile und wirft dann ENOSPC. Speicher und Replay stimmten danach mit dem Vorher überein —
// aber die anschliessend ERFOLGREICH gemeldete Wiederholung hing ihre Zeile an den Rest, das
// Einlesen brach dort ab, und nach dem Replay fehlte sie (Rückzug: live im Papierkorb, nach Replay
// aktiv; Wiederherstellung: live aktiv, nach Replay im Papierkorb).
//
// Soll: ein gescheiterter Abschluss wirkt weder live noch nach Replay; jede danach bestätigte
// Schreibung bleibt beim Replay erhalten. Die Fälle hier sind Bens Gegenprobe (derselbe
// Schreibfehler, dieselben Dienste) plus die Nachbarn: zweimal hintereinander gescheitert, ein
// gescheiterter Einzelbeleg ausserhalb eines Vorgangs, und der Rest nach einem Abbruch beim Start.

const verzeichnisse: string[] = [];
afterEach(() => {
  for (const dir of verzeichnisse.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function neueDatei(): string {
  const dir = mkdtempSync(join(tmpdir(), "klarwerk-teilschreiben-"));
  verzeichnisse.push(dir);
  return join(dir, "journal.jsonl");
}

/**
 * Wie viel ein scheiternder Schreibaufruf noch schreibt, bevor er wirft:
 *   halb         die halbe Zeile, dann ENOSPC (Lauf 3, Runde 3)
 *   ohneUmbruch  die ganze Zeile bis auf das abschliessende Zeilenende, dann ENOSPC (Lauf 4, Runde 1)
 *   ganz         die ganze Zeile SAMT Zeilenende, dann EIO beim Schliessen (Lauf 4, Runde 2)
 *   nichts       gar nichts, dann ENOSPC
 *   ok           kein Fehler (nur in `folge`, um einen Aufruf gezielt durchzulassen; Lauf 5)
 */
type Schnitt = "halb" | "ohneUmbruch" | "ganz" | "nichts" | "ok";

/**
 * Das Journal wie `buildDevPersistServices` — nur mit schaltbaren Fehlern: `teilschreiben`
 * Aufrufe scheitern mit dem Grundschnitt; `folge` legt die Schnitte der nächsten Aufrufe einzeln fest.
 */
function schreiberMitTeilschreiben(datei: string, schnitt: Schnitt = "halb") {
  const schalter: {
    teilschreiben: number;
    folge: Schnitt[];
    /** Lauf 5, Runde 2: der Datenträger nimmt gar nichts mehr an (jeder Aufruf „nichts“). */
    voll: boolean;
    /** Lauf 5, Runde 2: das Zurücklesen im Modus `kaputt` scheitert, solange dies gesetzt ist. */
    lesenKaputt: boolean;
  } = { teilschreiben: 0, folge: [], voll: false, lesenKaputt: true };
  const schreiben = (e: JournalEntry): void => {
    const text = `${JSON.stringify(e)}\n`;
    let dieser: Schnitt | undefined = schalter.folge.shift();
    if (dieser === undefined && schalter.voll) {
      dieser = "nichts";
    }
    if (dieser === undefined && schalter.teilschreiben > 0) {
      schalter.teilschreiben -= 1;
      dieser = schnitt;
    }
    if (dieser !== undefined && dieser !== "ok") {
      const bis = {
        halb: Math.floor(text.length / 2),
        ohneUmbruch: text.length - 1,
        ganz: text.length,
        nichts: 0,
      }[dieser];
      appendFileSync(datei, text.slice(0, bis), "utf8");
      if (dieser === "ganz") {
        throw Object.assign(new Error("EIO beim Schliessen"), { code: "EIO", syscall: "close" });
      }
      throw Object.assign(new Error("ENOSPC: Datenträger voll"), { code: "ENOSPC" });
    }
    appendFileSync(datei, text, "utf8");
  };
  return { schalter, schreiben };
}

async function paar(services: AppServices) {
  const a = await services.ko.create({
    title: "KO A",
    statement: "Pumpe entlüften alle 200h.",
    type: "best_practice",
    category: "Wartung",
    author: "anna",
  });
  const b = await services.ko.create({
    title: "KO B",
    statement: "Pumpe alle 200 Stunden entlüften.",
    type: "best_practice",
    category: "Wartung",
    author: "bob",
  });
  const overlap = await services.overlaps.createAuto(
    {
      koA: a.id,
      koB: b.id,
      relation: "identisch",
      aspects: [{ beschreibung: "gleiche Anweisung", zitatA: "entlüften", zitatB: "entlüften" }],
      eigenanteilA: "",
      eigenanteilB: "",
      recommendation: "zusammenfuehren",
    },
    { trigger: "manual", method: "deterministic", lexicalScore: 0.95 },
    "system",
  );
  return { a, b, overlap };
}

/**
 * `lesen` (Lauf 5): wie das Journal nach einem Schreibfehler seine Bestätigung zurückliest —
 * `datei` wie `buildDevPersistServices`, `kaputt` mit Lesefehler (solange `schalter.lesenKaputt`,
 * danach wie `datei`), `ohne` gar nicht.
 */
async function lage(schnitt: Schnitt = "halb", lesen: "datei" | "kaputt" | "ohne" = "ohne") {
  const datei = neueDatei();
  const { schalter, schreiben } = schreiberMitTeilschreiben(datei, schnitt);
  const roh = inMemoryRepos();
  const leser: BestaetigungLesen | undefined = {
    datei: bestaetigungInDatei(datei),
    kaputt: (vorgang: string) => {
      if (schalter.lesenKaputt) {
        throw Object.assign(new Error("EIO beim Lesen"), { code: "EIO" });
      }
      return bestaetigungInDatei(datei)(vorgang);
    },
    ohne: undefined,
  }[lesen];
  const services = assembleServices(journaledRepos(roh, schreiben, false, leser));
  buildApp(services); // die Aufräum-Haken leben in der Kompositionswurzel
  const { a, b, overlap } = await paar(services);

  /** Der beobachtbare Zustand: eigene Seite, Gegenseite, Befund, Belege. */
  async function stand(r: AppRepos) {
    return {
      a: await r.koRepo.findById(a.id),
      b: await r.koRepo.findById(b.id),
      befund: await r.overlapRepo.findById(overlap.id),
      belege: await r.auditRepo.all(),
    };
  }
  /** Der Neustart: frische Ablagen, nur die DATEI als Wahrheit. */
  async function nachReplay() {
    const frisch = inMemoryRepos();
    await replayJournal(frisch, readJournalLines(datei));
    return stand(frisch);
  }
  return { datei, schalter, roh, services, a, b, overlap, stand, nachReplay };
}

describe("BEN-R3-2 (Lauf 4): Teilschreiben beim Journal-Abschluss, danach erfolgreiche Wiederholung", () => {
  it("Rückzug: Rest im Journal, nichts wirkt; die Wiederholung bleibt nach Replay erhalten", async () => {
    const w = await lage();
    const vorher = await w.stand(w.roh);
    const bytesVorher = statSync(w.datei).size;

    w.schalter.teilschreiben = 1;
    await expect(w.services.ko.delete(w.a.id, "anna")).rejects.toThrow("ENOSPC");
    // Der Rest steht wirklich in der Datei — sonst prüfte der Fall nichts.
    expect(statSync(w.datei).size).toBeGreaterThan(bytesVorher);
    expect(await w.stand(w.roh)).toEqual(vorher);
    expect(await w.nachReplay()).toEqual(vorher);

    await w.services.ko.delete(w.a.id, "anna");
    const live = await w.stand(w.roh);
    expect(live.a?.deletedBy).toBe("anna");
    expect(live.befund?.status).toBe("geschlossen");
    expect(live.befund?.resolution).toMatchObject({ reason: "withdrawn_own", by: "anna" });
    expect(live.b).toEqual(vorher.b); // die Gegenseite bleibt unangetastet
    expect(await w.nachReplay()).toEqual(live);
    expect(await w.services.audit.verify()).toBe(true);
  });

  it("Wiederherstellen: Rest im Journal, nichts wirkt; die Wiederholung bleibt nach Replay erhalten", async () => {
    const w = await lage();
    await w.services.ko.delete(w.a.id, "anna");
    const vorher = await w.stand(w.roh);

    w.schalter.teilschreiben = 1;
    await expect(w.services.ko.restore(w.a.id, "admin")).rejects.toThrow("ENOSPC");
    expect(await w.stand(w.roh)).toEqual(vorher);
    expect(await w.nachReplay()).toEqual(vorher);

    await w.services.ko.restore(w.a.id, "admin");
    const live = await w.stand(w.roh);
    expect(live.a?.deletedAt).toBeUndefined();
    // Entscheidung 43017d60: der durch Rückzug geschlossene Befund bleibt zu, die Gegenseite unberührt.
    expect(live.befund).toEqual(vorher.befund);
    expect(live.b).toEqual(vorher.b);
    expect(await w.nachReplay()).toEqual(live);
  });

  it("zweimal hintereinander Teilschreiben, dann Erfolg: nur der bestätigte Vorgang wirkt nach Replay", async () => {
    const w = await lage();
    const vorher = await w.stand(w.roh);

    // Drei Fehler: der Abschluss, der sofortige Neuaufsatz vor dem Widerruf (Runde 3) und — bei der
    // zweiten Rücknahme — erneut der Neuaufsatz. Auch er kann nur halb geschrieben werden: der Rest
    // wächst, bleibt aber Rest, und die zweite Rücknahme wird abgewiesen, bevor sie schreibt.
    w.schalter.teilschreiben = 3;
    await expect(w.services.ko.delete(w.a.id, "anna")).rejects.toThrow("ENOSPC");
    await expect(w.services.ko.delete(w.a.id, "anna")).rejects.toThrow("ENOSPC");
    expect(await w.stand(w.roh)).toEqual(vorher);
    expect(await w.nachReplay()).toEqual(vorher);

    await w.services.ko.delete(w.a.id, "anna");
    const live = await w.stand(w.roh);
    expect(live.a?.deletedBy).toBe("anna");
    expect(await w.nachReplay()).toEqual(live);
  });

  it("Teilschreiben einer Einzelzeile ausserhalb eines Vorgangs: spätere Zeilen bleiben lesbar", async () => {
    const w = await lage();
    w.schalter.teilschreiben = 1;
    await expect(
      w.services.conflicts.create(
        { koA: w.a.id, koB: w.b.id, type: "truth", description: "Widerspruch zur Frist" },
        "anna",
      ),
    ).rejects.toThrow("ENOSPC");

    await w.services.ko.delete(w.a.id, "anna");
    const nach = await w.nachReplay();
    expect(nach.a?.deletedBy).toBe("anna");
    expect(nach.befund?.resolution).toMatchObject({ reason: "withdrawn_own", by: "anna" });
  });
});

describe("BEN-R3-2 (Lauf 4): das Einlesen", () => {
  it("ein Rest OHNE Neuaufsatz beendet das Einlesen weiterhin (Bestandsvertrag)", () => {
    const datei = neueDatei();
    const a: JournalEntry = { repo: "drafts", method: "insert", args: [{ id: "d1" }] };
    const b: JournalEntry = { repo: "drafts", method: "insert", args: [{ id: "d2" }] };
    appendFileSync(datei, `${JSON.stringify(a)}\n{"repo":"dra\n${JSON.stringify(b)}\n`, "utf8");
    expect(readJournal(datei)).toEqual([a]);
  });

  it("der Neuaufsatz erscheint nie als Eintrag — weder allein noch hinter einem Rest", async () => {
    const datei = neueDatei();
    const { schalter, schreiben } = schreiberMitTeilschreiben(datei);
    const services = assembleServices(journaledRepos(inMemoryRepos(), schreiben));
    // Hinter einem Rest: Teilschreiben, dann eine bestätigte Zeile.
    const { a } = await paar(services);
    schalter.teilschreiben = 1;
    await expect(services.ko.delete(a.id, "anna")).rejects.toThrow("ENOSPC");
    await services.ko.delete(a.id, "anna");
    // Allein: ein Fehler, der nichts geschrieben hat, und danach eine bestätigte Zeile.
    const scheitern = (e: JournalEntry): void => {
      throw Object.assign(new Error(`ENOSPC vor dem Schreiben (${e.repo})`), { code: "ENOSPC" });
    };
    let aufrufe = 0;
    const zweite = assembleServices(
      journaledRepos(inMemoryRepos(), (e) => (aufrufe++ === 0 ? scheitern(e) : schreiben(e))),
    );
    await expect(paar(zweite)).rejects.toThrow("ENOSPC");
    await paar(zweite);

    const text = readFileSync(datei, "utf8");
    expect(text).toContain('{"repo":"journal","method":"neuaufsatz","args":[]}');
    expect(readJournal(datei).some((e) => e.method === "neuaufsatz")).toBe(false);
  });
});

describe("BEN-R3-2 (Lauf 4): Rest am Dateiende beim Start (Abbruch mitten im Anhängen)", () => {
  it("die erste Schreibung nach dem Start hängt nicht am Rest und überlebt den nächsten Start", async () => {
    const datei = neueDatei();
    const erster = await buildDevPersistServices(datei);
    const app1 = buildApp(erster);
    const { a, overlap } = await paar(erster);
    await app1.close();
    appendFileSync(datei, '{"repo":"koRepo","method":"upd', "utf8"); // Abbruch mitten im Anhängen

    const zweiter = await buildDevPersistServices(datei);
    const app2 = buildApp(zweiter);
    await zweiter.ko.delete(a.id, "anna");
    await app2.close();

    const repos = inMemoryRepos();
    await replayJournal(repos, readJournalLines(datei));
    expect((await repos.koRepo.findById(a.id))?.deletedBy).toBe("anna");
    expect((await repos.overlapRepo.findById(overlap.id))?.resolution).toMatchObject({
      reason: "withdrawn_own",
      by: "anna",
    });
  });

  it("eine letzte Zeile ohne Zeilenende ist unbestätigt: nie gelesen, auch nicht nach dem nächsten Start", async () => {
    const datei = neueDatei();
    const d1: JournalEntry = { repo: "drafts", method: "insert", args: [{ id: "d1" }] };
    const d2: JournalEntry = { repo: "drafts", method: "insert", args: [{ id: "d2" }] };
    appendFileSync(datei, `${JSON.stringify(d1)}\n${JSON.stringify(d2)}`, "utf8");
    expect(readJournal(datei)).toEqual([d1]);

    const services = await buildDevPersistServices(datei);
    const app = buildApp(services);
    expect((await services.capture.listDrafts()).map((d) => d.id)).toEqual(["d1"]);
    await services.ko.create({
      title: "KO C",
      statement: "Filter tauschen.",
      type: "best_practice",
      category: "Wartung",
      author: "anna",
    });
    await app.close();

    const eintraege = readJournal(datei);
    expect(eintraege[0]).toEqual(d1);
    expect(
      eintraege.some(
        (e) => e.repo === "drafts" && e.args[0] && (e.args[0] as { id: string }).id === "d2",
      ),
    ).toBe(false);
    expect(eintraege.some((e) => e.repo === "koRepo" && e.method === "insert")).toBe(true);
  });
});

// ================================================================================================
// Lauf 4, Runde 2 — Bens BEN-R3-2 erneut: ENOSPC GENAU VOR DEM LETZTEN ZEILENENDE.
// ================================================================================================
//
// Der gescheiterte Abschluss schreibt die GANZE Vorgangszeile, nur ohne "\n". Runde 1 las sie als
// gültige Zeile: das Replay (und `buildDevPersistServices`, das ihr sogar das Zeilenende nachtrug)
// machte den im Speicher zurückgestellten Vorgang wirksam. Soll: unwirksam — nach dem Fehler, nach
// einem Neustart aus der Datei und nach der erfolgreichen Wiederholung.
describe("BEN-R3-2 (Lauf 4, Runde 2): ENOSPC vor dem Zeilenende — der zurückgestellte Vorgang wirkt nie", () => {
  it.each([
    ["Rückzug", false],
    ["Wiederherstellen", true],
  ] as const)(
    "%s: live, nach Replay und nach Neustart wie vorher; die Wiederholung wirkt genau einmal",
    async (_art, wiederherstellen) => {
      const w = await lage("ohneUmbruch");
      const aktion = () =>
        wiederherstellen
          ? w.services.ko.restore(w.a.id, "admin")
          : w.services.ko.delete(w.a.id, "anna");
      if (wiederherstellen) {
        await w.services.ko.delete(w.a.id, "anna");
      }
      const vorher = await w.stand(w.roh);

      // Seit Runde 3 folgt dem gescheiterten Abschluss sofort der Widerruf. Damit das Journal
      // wirklich ohne Zeilenende endet (Bens Fall), scheitert auch dieser Schreibaufruf, ohne zu
      // schreiben; der Widerruf bleibt offen und wird von der Wiederholung nachgeholt.
      w.schalter.folge = ["ohneUmbruch", "nichts"];
      await expect(aktion()).rejects.toThrow("ENOSPC");
      expect(readFileSync(w.datei, "utf8").endsWith("\n")).toBe(false); // der Fall ist wirklich da
      expect(await w.stand(w.roh)).toEqual(vorher);
      expect(await w.nachReplay()).toEqual(vorher);

      // Neustart aus der Datei (zweite Komposition, wie beim Desktop-Neustart) — und die Datei bleibt dabei unbestätigt.
      const neu = await buildDevPersistServices(w.datei);
      const imPapierkorb = (await neu.ko.trashed()).some((k) => k.id === w.a.id);
      expect(imPapierkorb).toBe(Boolean(vorher.a?.deletedAt));
      expect((await neu.overlaps.get(w.overlap.id))?.status).toBe(vorher.befund?.status);
      expect(readFileSync(w.datei, "utf8").endsWith("\n")).toBe(false);
      expect(await w.nachReplay()).toEqual(vorher);

      await aktion();
      const live = await w.stand(w.roh);
      expect(Boolean(live.a?.deletedAt)).toBe(!wiederherstellen);
      expect(live.b).toEqual(vorher.b); // die Gegenseite bleibt unangetastet
      if (wiederherstellen) {
        expect(live.befund).toEqual(vorher.befund); // 43017d60: keine Wiederöffnung
      } else {
        expect(live.befund?.resolution).toMatchObject({ reason: "withdrawn_own", by: "anna" });
      }
      expect(await w.nachReplay()).toEqual(live);
      // Der Vorgang steht genau EINMAL wirksam im Journal: ein Beleg, nicht zwei.
      const aktionName = wiederherstellen ? "ko.restored" : "ko.deleted";
      expect((await w.nachReplay()).belege.filter((b) => b.action === aktionName)).toHaveLength(
        live.belege.filter((b) => b.action === aktionName).length,
      );
    },
  );
});

// ================================================================================================
// Lauf 5 — Bens BEN-R4-1 (Lauf 4, Runde 3): ABSCHLUSSFEHLER UND GESCHEITERTER WIDERRUF.
// ================================================================================================
//
// Bens Gegenprobe: die Vorgangszeile steht samt Zeilenende in der Datei, der Schreibaufruf wirft
// trotzdem (EIO beim Schliessen), und auch der sofortige Widerruf scheitert (ENOSPC ohne
// Schreibwirkung). Lauf 4 hielt den Widerruf dann nur flüchtig offen: live zurückgestellt, nach
// Replay und Neustart wirksam (Rückzug: Papierkorb/Befund geschlossen; Wiederherstellung: aktiv).
//
// Soll: Speicher, Replay, Neustart und Aufrufergebnis stimmen überein — in BEIDEN Richtungen und
// geprüft VOR jeder späteren Schreibung. Lauf 5 schreibt den Abschluss in zwei Zeilen (Vorgangszeile,
// dann Bestätigung); ohne Bestätigung wirkt eine Vorgangszeile nie (dev-persist.ts, `BESTAETIGUNG`,
// `mitBestaetigung`). Die Fälle unten decken jeden Schreibaufruf des Abschlusses mit jedem Schnitt ab.
describe("BEN-R4-1 (Lauf 5): Abschlussfehler — Speicher, Replay, Neustart und Aufrufergebnis stimmen überein", () => {
  const richtungen = [
    ["Rückzug", false],
    ["Wiederherstellen", true],
  ] as const;

  async function ablauf(
    wiederherstellen: boolean,
    folge: Schnitt[],
    lesen: "datei" | "kaputt" | "ohne" = "ohne",
  ) {
    const w = await lage("ganz", lesen);
    const aktion = () =>
      wiederherstellen
        ? w.services.ko.restore(w.a.id, "admin")
        : w.services.ko.delete(w.a.id, "anna");
    if (wiederherstellen) {
      await w.services.ko.delete(w.a.id, "anna");
    }
    const vorher = await w.stand(w.roh);
    w.schalter.folge = folge;
    /** Der Neustart der Desktop-App aus derselben Datei (zweite Komposition). */
    async function nachNeustart() {
      const neu = await buildDevPersistServices(w.datei);
      return {
        papierkorb: (await neu.ko.trashed()).some((k) => k.id === w.a.id),
        befund: (await neu.overlaps.get(w.overlap.id))?.status,
      };
    }
    const kurz = (s: Awaited<ReturnType<typeof w.stand>>) => ({
      papierkorb: Boolean(s.a?.deletedAt),
      befund: s.befund?.status,
    });
    return { w, aktion, vorher, nachNeustart, kurz };
  }

  /** Nach einem gemeldeten Fehler: alles wie vorher — live, nach Replay, nach Neustart. */
  async function wieVorher(l: Awaited<ReturnType<typeof ablauf>>) {
    expect(await l.w.stand(l.w.roh)).toEqual(l.vorher);
    expect(await l.w.nachReplay()).toEqual(l.vorher);
    expect(await l.nachNeustart()).toEqual(l.kurz(l.vorher));
  }

  /** Die Wiederholung wirkt genau einmal; live = Replay = Neustart; die Gegenseite bleibt. */
  async function wiederholungWirkt(
    l: Awaited<ReturnType<typeof ablauf>>,
    wiederherstellen: boolean,
  ) {
    await l.aktion();
    await wirkt(l, wiederherstellen);
  }

  async function wirkt(l: Awaited<ReturnType<typeof ablauf>>, wiederherstellen: boolean) {
    const live = await l.w.stand(l.w.roh);
    expect(Boolean(live.a?.deletedAt)).toBe(!wiederherstellen);
    expect(live.b).toEqual(l.vorher.b); // die Gegenseite bleibt unangetastet
    if (wiederherstellen) {
      expect(live.befund).toEqual(l.vorher.befund); // 43017d60: keine Wiederöffnung
    } else {
      expect(live.befund?.resolution).toMatchObject({ reason: "withdrawn_own", by: "anna" });
    }
    expect(await l.w.nachReplay()).toEqual(live);
    expect(await l.nachNeustart()).toEqual(l.kurz(live));
    expect(await l.w.services.audit.verify()).toBe(true);
  }

  it.each(richtungen)(
    "%s — Bens Fall: Vorgangszeile ganz + EIO, Widerruf ENOSPC → Fehler, und VOR jeder weiteren Schreibung überall wie vorher",
    async (_art, wiederherstellen) => {
      // Vorgangszeile: ganz + EIO; Neuaufsatz vor dem Widerruf: ok; Widerruf selbst: scheitert.
      const l = await ablauf(wiederherstellen, ["ganz", "ok", "nichts"]);
      await expect(l.aktion()).rejects.toThrow("EIO");
      // Der Fall ist wirklich da: Vorgangszeile vollständig, kein Widerruf, sauberes Zeilenende.
      const eintraege = readJournal(l.w.datei);
      expect(eintraege.at(-1)).toMatchObject({ repo: "ruecknahmeVorgang", method: "abschluss" });
      expect(eintraege.some((e) => e.method === "widerruf")).toBe(false);
      expect(readFileSync(l.w.datei, "utf8").endsWith("\n")).toBe(true);
      await wieVorher(l);
      await wiederholungWirkt(l, wiederherstellen);
    },
  );

  it.each(richtungen)(
    "%s — Vorgangszeile halb / ohne Zeilenende / gar nicht, Widerruf scheitert → überall wie vorher",
    async (_art, wiederherstellen) => {
      for (const schnitt of ["halb", "ohneUmbruch", "nichts"] as const) {
        const l = await ablauf(wiederherstellen, [schnitt, "nichts"]);
        await expect(l.aktion()).rejects.toThrow("ENOSPC");
        await wieVorher(l);
        await wiederholungWirkt(l, wiederherstellen);
      }
    },
  );

  it.each(richtungen)(
    "%s — Bestätigung ganz + EIO, Zurücklesen findet sie → KEIN Fehler, der Vorgang wirkt überall",
    async (_art, wiederherstellen) => {
      const l = await ablauf(wiederherstellen, ["ok", "ganz"], "datei");
      await l.aktion(); // der Ausgang ist geklärt: die Bestätigung steht, der Vorgang gilt
      await wirkt(l, wiederherstellen);
      // Die nächste Schreibung setzt sauber auf und bleibt einlesbar.
      await l.w.services.conflicts.create(
        { koA: l.w.a.id, koB: l.w.b.id, type: "truth", description: "Widerspruch zur Frist" },
        "anna",
      );
      expect(await l.w.nachReplay()).toEqual(await l.w.stand(l.w.roh));
    },
  );

  it.each(richtungen)(
    "%s — Bestätigung halb / ohne Zeilenende, Zurücklesen findet sie nicht → Fehler, überall wie vorher",
    async (_art, wiederherstellen) => {
      for (const schnitt of ["halb", "ohneUmbruch"] as const) {
        // Das Zurücklesen klärt: sie steht nicht — es braucht keinen weiteren Schreibaufruf.
        const l = await ablauf(wiederherstellen, ["ok", schnitt], "datei");
        await expect(l.aktion()).rejects.toThrow("ENOSPC");
        await wieVorher(l);
        await wiederholungWirkt(l, wiederherstellen);
      }
    },
  );

  it.each(richtungen)(
    "%s — Bestätigung ganz + EIO, Zurücklesen scheitert, Widerruf gelingt → Fehler, überall wie vorher",
    async (_art, wiederherstellen) => {
      const l = await ablauf(wiederherstellen, ["ok", "ganz"], "kaputt");
      await expect(l.aktion()).rejects.toThrow("EIO");
      expect(readJournal(l.w.datei).at(-1)).toMatchObject({ repo: "journal", method: "widerruf" });
      await wieVorher(l);
      await wiederholungWirkt(l, wiederherstellen);
    },
  );

  it("ohne Zurücklesen (reine Schreibfunktion) gilt der Ausgang als ungewiss: Widerruf, Fehler, überall wie vorher", async () => {
    const l = await ablauf(false, ["ok", "ganz"], "ohne");
    await expect(l.aktion()).rejects.toThrow("EIO");
    await wieVorher(l);
    await wiederholungWirkt(l, false);
  });

  it("eine Vorgangszeile ohne Bestätigung wirkt nie — auch nicht, wenn danach Bestätigtes folgt", async () => {
    const datei = neueDatei();
    const vorgang: JournalEntry & { vorgang: string } = {
      repo: "ruecknahmeVorgang",
      method: "abschluss",
      args: [{ repo: "drafts", method: "insert", args: [{ id: "d-unbestaetigt" }] }],
      vorgang: "v-1",
    };
    const danach: JournalEntry = { repo: "drafts", method: "insert", args: [{ id: "d-danach" }] };
    appendFileSync(datei, `${JSON.stringify(vorgang)}\n${JSON.stringify(danach)}\n`, "utf8");
    const repos = inMemoryRepos();
    await replayJournal(repos, readJournalLines(datei));
    expect((await repos.drafts.list()).map((d) => d.id)).toEqual(["d-danach"]);

    // Mit Bestätigung wirkt sie; ein Widerruf hebt die Bestätigung auf.
    appendFileSync(
      datei,
      `${JSON.stringify({ repo: "ruecknahmeVorgang", method: "bestaetigung", args: ["v-1"] })}\n`,
      "utf8",
    );
    const bestaetigt = inMemoryRepos();
    await replayJournal(bestaetigt, readJournalLines(datei));
    expect((await bestaetigt.drafts.list()).map((d) => d.id).sort()).toEqual([
      "d-danach",
      "d-unbestaetigt",
    ]);
    appendFileSync(
      datei,
      `${JSON.stringify({ repo: "journal", method: "widerruf", args: ["v-1"] })}\n`,
      "utf8",
    );
    const widerrufen = inMemoryRepos();
    await replayJournal(widerrufen, readJournalLines(datei));
    expect((await widerrufen.drafts.list()).map((d) => d.id)).toEqual(["d-danach"]);
  });
});

// ================================================================================================
// Lauf 5, Runde 2 — Bens BEN-R5-1: UNGEWISSE BESTÄTIGUNG, ZURÜCKLESEN UND WIDERRUF SCHEITERN.
// ================================================================================================
//
// Ben: die Bestätigung steht vollständig in der Datei, der Schreibaufruf meldet trotzdem EIO, und
// weder Zurücklesen noch Widerruf gelingen. Runde 1 stellte den Speicher zurück und meldete einen
// gewöhnlichen Fehler — Replay und Neustart zeigten den entgegengesetzten Stand der eigenen Seite.
//
// Der Prozess kann in dieser Lage nicht wissen, ob die Bestätigung steht: eine vollständig
// geschriebene Zeile mit Fehler danach und eine gar nicht geschriebene melden ihm dasselbe (der
// Fall „Unmöglichkeit“ unten zeigt es an zwei Dateien). Kein fester Speicherstand passt zu beiden.
// Soll deshalb: der Aufrufer bekommt `JournalAusgangUngewiss` (kein „zurückgestellt“), die laufende
// Instanz liefert KEINEN Stand aus, bis der Ausgang an der Datei geklärt ist, und danach — wie beim
// Neustart — genau den Stand der Datei. Live = Replay = Neustart, in beiden Richtungen.
describe("BEN-R5-1 (Lauf 5, Runde 2): ungewisse Bestätigung — die Instanz folgt der Datei", () => {
  const UNGEWISS = "JOURNAL_AUSGANG_UNGEWISS";

  /**
   * `bestaetigung`: `steht` = vollständig geschrieben, dann EIO (Bens Fall); `fehlt` = nichts
   * geschrieben, dann ENOSPC (der Spiegelfall). Danach nimmt der Datenträger nichts mehr an, und
   * das Zurücklesen scheitert.
   */
  async function ungewiss(wiederherstellen: boolean, bestaetigung: "steht" | "fehlt") {
    const w = await lage("ganz", "kaputt");
    const aktion = () =>
      wiederherstellen
        ? w.services.ko.restore(w.a.id, "admin")
        : w.services.ko.delete(w.a.id, "anna");
    if (wiederherstellen) {
      await w.services.ko.delete(w.a.id, "anna");
    }
    const vorher = await w.stand(w.roh);
    w.schalter.folge = ["ok", bestaetigung === "steht" ? "ganz" : "nichts"];
    w.schalter.voll = true;
    const fehler = await aktion().then(
      () => undefined,
      (e: unknown) => e,
    );
    async function nachNeustart() {
      const neu = await buildDevPersistServices(w.datei);
      return {
        papierkorb: (await neu.ko.trashed()).some((k) => k.id === w.a.id),
        befund: await neu.overlaps.get(w.overlap.id),
        gegenseite: await neu.ko.get(w.b.id),
      };
    }
    return { w, vorher, fehler, nachNeustart };
  }

  it.each([
    ["Rückzug", false],
    ["Wiederherstellen", true],
  ] as const)(
    "%s — Bens Fall (Bestätigung steht): Fehler „ungewiss“, keine Auslieferung, nach Klärung live = Replay = Neustart = wirksam",
    async (_art, wiederherstellen) => {
      const l = await ungewiss(wiederherstellen, "steht");
      expect(l.fehler).toHaveProperty("code", UNGEWISS);
      // Die Datenträgerursache steht nur in `cause`, nie in der Meldung (Runde 3, BEN-R5-3).
      expect(String(((l.fehler as Error).cause as Error).message)).toContain("EIO");
      expect(String((l.fehler as Error).message)).not.toContain("EIO");
      // Der Fall ist wirklich da: Bestätigung vollständig in der Datei, kein Widerruf.
      const eintraege = readJournal(l.w.datei);
      expect(eintraege.at(-1)).toMatchObject({ repo: "ruecknahmeVorgang", method: "bestaetigung" });
      expect(eintraege.some((e) => e.method === "widerruf")).toBe(false);

      // Solange weder Lesen noch Schreiben geht: die Instanz liefert nichts aus — lesend wie schreibend.
      await expect(l.w.services.ko.trashed()).rejects.toHaveProperty("code", UNGEWISS);
      await expect(l.w.services.overlaps.get(l.w.overlap.id)).rejects.toHaveProperty(
        "code",
        UNGEWISS,
      );
      await expect(l.w.services.ko.get(l.w.b.id)).rejects.toHaveProperty("code", UNGEWISS);
      await expect(
        l.w.services.conflicts.create(
          { koA: l.w.a.id, koB: l.w.b.id, type: "truth", description: "Widerspruch zur Frist" },
          "anna",
        ),
      ).rejects.toHaveProperty("code", UNGEWISS);

      // Die Datei sagt „wirksam“ — Replay und Neustart schon jetzt, VOR jeder Klärung.
      const replay = await l.w.nachReplay();
      expect(Boolean(replay.a?.deletedAt)).toBe(!wiederherstellen);
      expect(replay.b).toEqual(l.vorher.b); // die Gegenseite bleibt unangetastet
      const neustart = await l.nachNeustart();
      expect(neustart.papierkorb).toBe(!wiederherstellen);
      expect(neustart.gegenseite).toEqual(l.vorher.b);
      if (wiederherstellen) {
        expect(neustart.befund).toEqual(l.vorher.befund); // 43017d60: keine Wiederöffnung
      } else {
        expect(neustart.befund?.resolution).toMatchObject({ reason: "withdrawn_own", by: "anna" });
      }

      // Der Datenträger ist wieder lesbar (Schreiben geht weiterhin nicht): der nächste Aufruf klärt.
      l.w.schalter.lesenKaputt = false;
      const papierkorb = await l.w.services.ko.trashed();
      expect(papierkorb.some((k) => k.id === l.w.a.id)).toBe(!wiederherstellen);
      const live = await l.w.stand(l.w.roh);
      expect(live).toEqual(await l.w.nachReplay());
      expect(await l.w.services.overlaps.get(l.w.overlap.id)).toEqual(neustart.befund);
      expect(await l.w.services.audit.verify()).toBe(true);
    },
  );

  it.each([
    ["Rückzug", false],
    ["Wiederherstellen", true],
  ] as const)(
    "%s — Spiegelfall (Bestätigung fehlt): Fehler „ungewiss“, Replay = Neustart = vorher, nach Klärung live = vorher",
    async (_art, wiederherstellen) => {
      const l = await ungewiss(wiederherstellen, "fehlt");
      expect(l.fehler).toHaveProperty("code", UNGEWISS);
      await expect(l.w.services.ko.trashed()).rejects.toHaveProperty("code", UNGEWISS);
      expect(await l.w.nachReplay()).toEqual(l.vorher);
      expect((await l.nachNeustart()).papierkorb).toBe(Boolean(l.vorher.a?.deletedAt));

      l.w.schalter.lesenKaputt = false;
      await l.w.services.ko.trashed();
      expect(await l.w.stand(l.w.roh)).toEqual(l.vorher);
      expect(await l.w.nachReplay()).toEqual(l.vorher);
    },
  );

  it("Klärung über den Widerruf: Lesen scheitert weiter, Schreiben geht wieder → der Vorgang wirkt nie, live = Replay = Neustart = vorher", async () => {
    const l = await ungewiss(false, "steht");
    expect(l.fehler).toHaveProperty("code", UNGEWISS);
    l.w.schalter.voll = false; // Zurücklesen bleibt kaputt
    await l.w.services.ko.trashed();
    expect(readJournal(l.w.datei).at(-1)).toMatchObject({ repo: "journal", method: "widerruf" });
    expect(await l.w.stand(l.w.roh)).toEqual(l.vorher);
    expect(await l.w.nachReplay()).toEqual(l.vorher);
    expect((await l.nachNeustart()).papierkorb).toBe(false);
    // Danach läuft alles wieder normal: die Wiederholung wirkt genau einmal.
    await l.w.services.ko.delete(l.w.a.id, "anna");
    const live = await l.w.stand(l.w.roh);
    expect(live.a?.deletedBy).toBe("anna");
    expect(await l.w.nachReplay()).toEqual(live);
  });

  it("Unmöglichkeit: beide Dateien melden dem Prozess dasselbe — deshalb ist sein Speicher in dieser Lage nicht die Wahrheit", async () => {
    const steht = await ungewiss(false, "steht");
    const fehlt = await ungewiss(false, "fehlt");
    // Gleiche Rückmeldung an den Prozess (Fehlerart), gleicher zurückgestellter Speicher …
    expect((steht.fehler as { code?: string }).code).toBe((fehlt.fehler as { code?: string }).code);
    const speicher = async (l: typeof steht) => Boolean((await l.w.stand(l.w.roh)).a?.deletedAt);
    expect(await speicher(steht)).toBe(await speicher(fehlt));
    // … aber entgegengesetzte Dateien. Ein fester Speicherstand widerspräche einer von beiden;
    // die Instanz liefert deshalb nichts aus, bis sie an der Datei geklärt hat.
    expect(Boolean((await steht.w.nachReplay()).a?.deletedAt)).toBe(true);
    expect(Boolean((await fehlt.w.nachReplay()).a?.deletedAt)).toBe(false);
    await expect(steht.w.services.ko.trashed()).rejects.toHaveProperty("code", UNGEWISS);
    await expect(fehlt.w.services.ko.trashed()).rejects.toHaveProperty("code", UNGEWISS);
  });
});

// ================================================================================================
// Lauf 5, Runde 3 — Bens BEN-R5-2: DER WIDERRUF SELBST MIT UNGEWISSEM AUSGANG.
// ================================================================================================
//
// Ben: Bestätigung vollständig + EIO, Zurücklesen scheitert, der Widerruf wird VOLLSTÄNDIG
// gespeichert und sein Schreibaufruf meldet trotzdem EIO. Sobald Lesen wieder ging, sah die Klärung
// in Runde 2 nur die Bestätigung und trug den Vorgang nach — Replay und Neustart verwarfen ihn wegen
// des Widerrufs. Soll: Klärung und Replay benutzen dieselbe Wirksamkeitsregel (`wirksamIn`).
describe("BEN-R5-2 (Lauf 5, Runde 3): gespeicherter Widerruf trotz Schreibfehler — Klärung = Replay = Neustart", () => {
  it.each([
    ["Rückzug", false],
    ["Wiederherstellen", true],
  ] as const)(
    "%s: nach wieder möglichem Lesen liefern die Dienste den Stand der Datei (Vorgang widerrufen = wie vorher)",
    async (_art, wiederherstellen) => {
      const w = await lage("ganz", "kaputt");
      const aktion = () =>
        wiederherstellen
          ? w.services.ko.restore(w.a.id, "admin")
          : w.services.ko.delete(w.a.id, "anna");
      if (wiederherstellen) {
        await w.services.ko.delete(w.a.id, "anna");
      }
      const vorher = await w.stand(w.roh);
      // Vorgangszeile ok; Bestätigung ganz + EIO; Neuaufsatz ok; Widerruf ganz + EIO; danach voll.
      w.schalter.folge = ["ok", "ganz", "ok", "ganz"];
      w.schalter.voll = true;
      await expect(aktion()).rejects.toHaveProperty("code", "JOURNAL_AUSGANG_UNGEWISS");
      // Der Fall ist wirklich da: Bestätigung UND Widerruf stehen vollständig in der Datei.
      const methoden = readJournal(w.datei).map((e) => e.method);
      expect(methoden.slice(-2)).toEqual(["bestaetigung", "widerruf"]);
      await expect(w.services.ko.trashed()).rejects.toHaveProperty(
        "code",
        "JOURNAL_AUSGANG_UNGEWISS",
      );

      w.schalter.lesenKaputt = false; // Schreiben geht weiterhin nicht
      const papierkorb = await w.services.ko.trashed();
      expect(papierkorb.some((k) => k.id === w.a.id)).toBe(Boolean(vorher.a?.deletedAt));
      expect(await w.services.overlaps.get(w.overlap.id)).toEqual(vorher.befund);
      expect(await w.services.ko.get(w.b.id)).toEqual(vorher.b); // Gegenseite unangetastet
      expect(await w.stand(w.roh)).toEqual(vorher);
      expect(await w.nachReplay()).toEqual(vorher);
      const neu = await buildDevPersistServices(w.datei);
      expect((await neu.ko.trashed()).some((k) => k.id === w.a.id)).toBe(
        Boolean(vorher.a?.deletedAt),
      );
      expect(await neu.overlaps.get(w.overlap.id)).toEqual(vorher.befund);
    },
  );

  it("die Klärung eines Vorgangs ohne Widerruf trägt ihn weiterhin nach (Kontrollfall)", async () => {
    const w = await lage("ganz", "kaputt");
    // Bestätigung ganz + EIO; Widerruf ohne Schreibwirkung; danach voll.
    w.schalter.folge = ["ok", "ganz", "ok", "nichts"];
    w.schalter.voll = true;
    await expect(w.services.ko.delete(w.a.id, "anna")).rejects.toHaveProperty(
      "code",
      "JOURNAL_AUSGANG_UNGEWISS",
    );
    w.schalter.lesenKaputt = false;
    expect((await w.services.ko.trashed()).some((k) => k.id === w.a.id)).toBe(true);
    expect(await w.nachReplay()).toEqual(await w.stand(w.roh));
  });
});
