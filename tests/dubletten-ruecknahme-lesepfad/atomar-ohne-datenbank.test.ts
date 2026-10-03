import { describe, expect, it } from "vitest";
import {
  type AppRepos,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import {
  type JournalEntry,
  MUTATING_METHODS,
  VORGANG_ZEILE,
  journaledRepos,
  replayJournal,
} from "../../services/app/src/dev-persist";
import { SCHREIBEND, speicherVorgang } from "../../services/app/src/speicher-vorgang";

// ================================================================================================
// Auftrag gesamt-dubletten-rueckzug, Runde 2 — BENS BEN-R3-1: ATOMAR AUCH OHNE DATENBANK.
// ================================================================================================
//
// Ben hat in Runde 1 gegen unveränderte Dienste über `journaledRepos` (Dev-Journal der
// Desktop-App) und anschliessendem `replayJournal` gemessen:
//   (1) Ausfall beim Beleg `overlap.withdrawn-own` → Beitrag aktiv, Befund aber geschlossen.
//   (2) Ausfall beim Beleg `ko.deleted`            → Beitrag im Papierkorb, Befund geschlossen,
//                                                    kein Beleg.
//   (3) Ausfall beim Beleg `ko.restored`           → Beitrag schon wieder aktiv, kein Beleg.
// Soll: ein gescheiterter Rückzug bzw. eine gescheiterte Wiederherstellung hinterlässt KEINEN
// Teilzustand — weder im laufenden Prozess noch nach dem Journal-Replay (Neustart). Die Klammer
// dafür steht in services/app/src/speicher-vorgang.ts; hier die drei Gegenproben und ihre
// Nachbarn, jeweils mit Zustandsprüfung live UND nach Replay.

type Scharf = {
  action: string | null;
  koUpdate: boolean;
  // Runde 3 (BEN-R3-2): das Journal wirft beim Schreiben einer Zeile, die diesen Beleg trägt.
  journal: string | null;
  // Runde 3 (BEN-R3-3): nach dem Anhängen dieses Belegs läuft `fn` (ein unabhängiger Schreiber).
  beiBeleg: { action: string; fn: () => void } | null;
};

/** Trägt diese Journalzeile (auch als Vorgangszeile) einen Beleg mit `action`? */
function traegtBeleg(zeile: JournalEntry, action: string): boolean {
  const teile = zeile.repo === VORGANG_ZEILE.repo ? (zeile.args as JournalEntry[]) : [zeile];
  return teile.some(
    (t) =>
      t.repo === "auditRepo" && (t.args[0] as { action?: string } | undefined)?.action === action,
  );
}

async function lage(mitJournal: boolean) {
  const roh = inMemoryRepos();
  const scharf: Scharf = { action: null, koUpdate: false, journal: null, beiBeleg: null };
  // Ausfall genau eines Schreibschritts, an der ROHEN Ablage (unter Journal und Klammer).
  const echtesAppend = roh.auditRepo.append.bind(roh.auditRepo);
  roh.auditRepo.append = async (entry, tx) => {
    if (scharf.action !== null && entry.action === scharf.action) {
      throw new Error("Audit-Ablage nicht erreichbar");
    }
    await echtesAppend(entry, tx);
    if (scharf.beiBeleg && entry.action === scharf.beiBeleg.action) {
      const { fn } = scharf.beiBeleg;
      scharf.beiBeleg = null;
      fn();
    }
  };
  const echtesUpdate = roh.koRepo.update.bind(roh.koRepo);
  roh.koRepo.update = async (ko, tx) => {
    if (scharf.koUpdate) {
      throw new Error("KO-Ablage nicht erreichbar");
    }
    return echtesUpdate(ko, tx);
  };
  const zeilen: JournalEntry[] = [];
  const schreiben = (e: JournalEntry) => {
    if (scharf.journal !== null && traegtBeleg(e, scharf.journal)) {
      throw new Error("Journal nicht schreibbar");
    }
    zeilen.push(e);
  };
  const repos: AppRepos = mitJournal ? journaledRepos(roh, schreiben) : roh;
  const services = assembleServices(repos);
  buildApp(services); // die Aufräum-Haken leben in der Kompositionswurzel

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
  const conflict = await services.conflicts.create(
    { koA: a.id, koB: b.id, type: "truth", description: "Widerspruch zur Frist" },
    "anna",
  );

  /** Der ganze beobachtbare Zustand der beteiligten Ablagen eines Satzes. */
  async function stand(r: AppRepos) {
    return {
      a: await r.koRepo.findById(a.id),
      b: await r.koRepo.findById(b.id),
      befund: await r.overlapRepo.findById(overlap.id),
      konflikt: await r.conflictsRepo.findById(conflict.id),
      belege: await r.auditRepo.all(),
    };
  }

  /** Der Neustart: frische Ablagen, nur das Journal als Wahrheit. */
  async function nachReplay() {
    const frisch = inMemoryRepos();
    await replayJournal(
      frisch,
      zeilen.map((entry, i) => ({ lineNumber: i + 1, entry })),
    );
    return stand(frisch);
  }

  return { roh, repos, services, scharf, zeilen, a, b, overlap, conflict, stand, nachReplay };
}

describe("BEN-R3-1: Rückzug ohne Datenbank — ein Ausfall hinterlässt keinen Teilzustand", () => {
  for (const ausfall of ["overlap.withdrawn-own", "ko.deleted"] as const) {
    it(`Dev-Journal · Ausfall bei ${ausfall}: live und nach Replay alles wie vorher`, async () => {
      const w = await lage(true);
      const vorher = await w.stand(w.roh);
      const zeilenVorher = w.zeilen.length;

      w.scharf.action = ausfall;
      await expect(w.services.ko.delete(w.a.id, "anna")).rejects.toThrow(
        "Audit-Ablage nicht erreichbar",
      );

      const live = await w.stand(w.roh);
      expect(live).toEqual(vorher);
      expect(live.a?.deletedAt).toBeUndefined();
      expect(live.befund?.status).toBe("offen");
      // Keine Journalzeile des gescheiterten Vorgangs.
      expect(w.zeilen.length).toBe(zeilenVorher);
      expect(await w.nachReplay()).toEqual(vorher);
      expect(await w.services.audit.verify()).toBe(true);

      // Die Wiederholung läuft vollständig durch — live und nach Replay derselbe Stand.
      w.scharf.action = null;
      await w.services.ko.delete(w.a.id, "anna");
      const danach = await w.stand(w.roh);
      expect(danach.a?.deletedBy).toBe("anna");
      expect(danach.befund?.resolution).toMatchObject({ reason: "withdrawn_own", by: "anna" });
      expect(danach.belege.filter((e) => e.action === "overlap.withdrawn-own")).toHaveLength(1);
      expect(danach.belege.filter((e) => e.action === "ko.deleted")).toHaveLength(1);
      expect(await w.nachReplay()).toEqual(danach);
      expect(await w.services.audit.verify()).toBe(true);
    });
  }

  it("Dev-Journal · Ausfall beim Schreiben des Beitrags (nach dem Schliessen): Befund und Konflikt wieder offen", async () => {
    const w = await lage(true);
    const vorher = await w.stand(w.roh);

    w.scharf.koUpdate = true;
    await expect(w.services.ko.delete(w.a.id, "anna")).rejects.toThrow("KO-Ablage");

    expect(await w.stand(w.roh)).toEqual(vorher);
    expect(await w.nachReplay()).toEqual(vorher);
  });

  it("reines InMemory (ohne Journal) · Ausfall bei overlap.withdrawn-own: alles wie vorher", async () => {
    const w = await lage(false);
    const vorher = await w.stand(w.roh);

    w.scharf.action = "overlap.withdrawn-own";
    await expect(w.services.ko.delete(w.a.id, "anna")).rejects.toThrow();

    expect(await w.stand(w.roh)).toEqual(vorher);
    expect(await w.services.audit.verify()).toBe(true);
  });
});

describe("BEN-R3-1: Wiederherstellen ohne Datenbank — ein Ausfall hinterlässt keinen Teilzustand", () => {
  it("Dev-Journal · Ausfall bei ko.restored: Beitrag bleibt im Papierkorb, live und nach Replay", async () => {
    const w = await lage(true);
    await w.services.ko.delete(w.a.id, "anna");
    const vorher = await w.stand(w.roh);
    expect(vorher.a?.deletedAt).toBeDefined();
    const zeilenVorher = w.zeilen.length;

    w.scharf.action = "ko.restored";
    await expect(w.services.ko.restore(w.a.id, "admin")).rejects.toThrow(
      "Audit-Ablage nicht erreichbar",
    );

    const live = await w.stand(w.roh);
    expect(live).toEqual(vorher);
    expect(live.a?.deletedAt).toBeDefined();
    expect(w.zeilen.length).toBe(zeilenVorher);
    expect(await w.nachReplay()).toEqual(vorher);

    // Die Wiederholung: der Beitrag ist zurück, der Befund bleibt zu (Entscheidung 43017d60).
    w.scharf.action = null;
    await w.services.ko.restore(w.a.id, "admin");
    const danach = await w.stand(w.roh);
    expect(danach.a?.deletedAt).toBeUndefined();
    expect(danach.befund).toEqual(vorher.befund);
    expect(danach.b).toEqual(vorher.b);
    expect(danach.belege.filter((e) => e.action === "ko.restored")).toHaveLength(1);
    expect(await w.nachReplay()).toEqual(danach);
    expect(await w.services.audit.verify()).toBe(true);
  });

  it("reines InMemory · Ausfall beim Schreiben des Beitrags: Beitrag bleibt im Papierkorb", async () => {
    const w = await lage(false);
    await w.services.ko.delete(w.a.id, "anna");
    const vorher = await w.stand(w.roh);

    w.scharf.koUpdate = true;
    await expect(w.services.ko.restore(w.a.id, "admin")).rejects.toThrow("KO-Ablage");

    expect(await w.stand(w.roh)).toEqual(vorher);
  });
});

describe("BEN-R3-1: die Klammer selbst", () => {
  it("führt mindestens die Mutationsflächen des Dev-Journals als schreibend", () => {
    for (const name of ["koRepo", "overlapRepo", "conflictsRepo", "auditRepo"] as const) {
      for (const methode of MUTATING_METHODS[name]) {
        expect(SCHREIBEND[name], `${name}.${methode}`).toContain(methode);
      }
    }
  });

  it("die Produktkompositionen (InMemory, Dev-Journal) bekommen die Klammer", () => {
    expect(speicherVorgang(inMemoryRepos())).toBeDefined();
    expect(speicherVorgang(journaledRepos(inMemoryRepos(), () => undefined))).toBeDefined();
  });

  it("fail-closed: eine nicht rückstellbare Schreibmethode im Vorgang wird nicht ausgeführt", async () => {
    const roh = inMemoryRepos();
    const vorgang = speicherVorgang(roh);
    if (!vorgang) {
      throw new Error("Klammer fehlt");
    }
    const services = assembleServices(roh);
    const ko = await services.ko.create({
      title: "KO A",
      statement: "Pumpe entlüften alle 200h.",
      type: "best_practice",
      category: "Wartung",
      author: "anna",
    });

    await expect(vorgang.klammer((tx) => vorgang.repos.koRepo.delete(ko.id, tx))).rejects.toThrow(
      "nicht rückstellbar",
    );
    expect(await roh.koRepo.findById(ko.id)).toBeDefined();
  });

  it("Lesezugriffe mit Vorgangskontext laufen durch, Schreiben ohne Kontext bleibt unberührt", async () => {
    const roh = inMemoryRepos();
    const vorgang = speicherVorgang(roh);
    if (!vorgang) {
      throw new Error("Klammer fehlt");
    }
    const letzter = await vorgang.klammer((tx) => vorgang.repos.auditRepo.last(tx));
    expect(letzter).toBeUndefined();
  });
});

// ================================================================================================
// Runde 3 — Bens BEN-R3-2: ein Fehler WÄHREND des Journal-Abschlusses.
// ================================================================================================
//
// Die Zeilen eines Vorgangs gehen als EINE Vorgangszeile ins Journal (dev-persist.ts,
// `VORGANG_ZEILE`); das Replay wendet sie nur als Ganzes an. Wirft das Schreiben, stellt die
// Klammer den Speicher zurück, und das Journal widerruft den Vorgang (Lauf 4, Runde 3).
describe("BEN-R3-2: Fehler beim Journal-Abschluss — kein Teilvorgang, auch nicht nach Replay", () => {
  it("Rückzug: das Journal wirft beim Abschluss → live und nach Replay alles wie vorher", async () => {
    const w = await lage(true);
    const vorher = await w.stand(w.roh);
    const zeilenVorher = w.zeilen.length;

    w.scharf.journal = "ko.deleted";
    await expect(w.services.ko.delete(w.a.id, "anna")).rejects.toThrow("Journal nicht schreibbar");

    expect(await w.stand(w.roh)).toEqual(vorher);
    // Lauf 4, Runde 3 (BEN-R4-1): der Ausgang eines gescheiterten Abschlusses ist ungewiss; das
    // Journal schreibt sofort Neuaufsatz und Widerruf — keine Zeile mit Wirkung.
    expect(w.zeilen.slice(zeilenVorher).map((z) => `${z.repo}.${z.method}`)).toEqual([
      "journal.neuaufsatz",
      "journal.widerruf",
    ]);
    expect(await w.nachReplay()).toEqual(vorher);
    expect(await w.services.audit.verify()).toBe(true);

    // Danach läuft derselbe Rückzug vollständig — genau EINE neue Vorgangszeile samt Bestätigung
    // (Lauf 5), die ganze Wirkung.
    w.scharf.journal = null;
    await w.services.ko.delete(w.a.id, "anna");
    expect(w.zeilen.length).toBe(zeilenVorher + 4);
    expect(w.zeilen.at(-2)).toMatchObject(VORGANG_ZEILE);
    expect(w.zeilen.at(-1)).toMatchObject({ repo: "ruecknahmeVorgang", method: "bestaetigung" });
    const danach = await w.stand(w.roh);
    expect(danach.a?.deletedBy).toBe("anna");
    expect(await w.nachReplay()).toEqual(danach);
  });

  it("Wiederherstellen: das Journal wirft beim Abschluss → Beitrag bleibt im Papierkorb, live und nach Replay", async () => {
    const w = await lage(true);
    await w.services.ko.delete(w.a.id, "anna");
    const vorher = await w.stand(w.roh);
    const zeilenVorher = w.zeilen.length;

    w.scharf.journal = "ko.restored";
    await expect(w.services.ko.restore(w.a.id, "admin")).rejects.toThrow(
      "Journal nicht schreibbar",
    );

    expect(await w.stand(w.roh)).toEqual(vorher);
    expect(w.zeilen.slice(zeilenVorher).map((z) => `${z.repo}.${z.method}`)).toEqual([
      "journal.neuaufsatz",
      "journal.widerruf",
    ]);
    expect(await w.nachReplay()).toEqual(vorher);

    w.scharf.journal = null;
    await w.services.ko.restore(w.a.id, "admin");
    const danach = await w.stand(w.roh);
    expect(danach.a?.deletedAt).toBeUndefined();
    expect(await w.nachReplay()).toEqual(danach);
  });
});

// ================================================================================================
// Runde 3 — Bens BEN-R3-3: ein UNABHÄNGIGER Audit-Schreiber während des Vorgangs.
// ================================================================================================
//
// Nach dem Beleg `overlap.withdrawn-own` (mitten im Vorgang) startet ein `AuditService.record`
// ohne Vorgangskontext — nur Promise-Microtasks, wie in Bens Gegenprobe. Er wartet, bis der Vorgang
// abgeschlossen bzw. zurückgestellt ist; sein Kettenglied hängt am bestätigten Stand, seine
// Journalzeile folgt der des Vorgangs.
describe("BEN-R3-3: unabhängiger Audit-Schreiber während eines Rücknahme-Vorgangs", () => {
  async function mitFremdbeleg(ausfall: string | null) {
    const w = await lage(true);
    const vorher = await w.stand(w.roh);
    let fremd: Promise<unknown> | undefined;
    w.scharf.beiBeleg = {
      action: "overlap.withdrawn-own",
      fn: () => {
        fremd = w.services.audit.record({ actor: "carla", action: "fremd.vorgang", target: "x" });
      },
    };
    w.scharf.action = ausfall;
    const rueckzug = w.services.ko.delete(w.a.id, "anna");
    return { w, vorher, rueckzug, fremd: () => fremd };
  }

  it("Rückzug gelingt: beide Vorgänge erfüllt, Kette live UND nach Replay gültig, Replay = live", async () => {
    const { w, rueckzug, fremd } = await mitFremdbeleg(null);
    await rueckzug;
    await fremd();

    const live = await w.stand(w.roh);
    const aktionen = live.belege.map((e) => e.action);
    expect(aktionen).toContain("fremd.vorgang");
    // Der fremde Beleg steht HINTER allen Belegen des Vorgangs.
    expect(aktionen.indexOf("fremd.vorgang")).toBeGreaterThan(aktionen.indexOf("ko.deleted"));
    expect(await w.services.audit.verify()).toBe(true);

    const nachReplay = await w.nachReplay();
    expect(nachReplay).toEqual(live);
    const frisch = inMemoryRepos();
    await replayJournal(
      frisch,
      w.zeilen.map((entry, i) => ({ lineNumber: i + 1, entry })),
    );
    const { AuditService } = await import("../../services/audit");
    expect(await new AuditService({ repo: frisch.auditRepo }).verify()).toBe(true);
  });

  it("Rückzug scheitert danach (ko.deleted): sauber zurückgestellt, fremder Beleg bleibt, Kette gültig", async () => {
    const { w, vorher, rueckzug, fremd } = await mitFremdbeleg("ko.deleted");
    // Der Ausgangsfehler — KEIN AggregateError (unvollständige Rückstellung).
    await expect(rueckzug).rejects.toThrow("Audit-Ablage nicht erreichbar");
    await expect(rueckzug).rejects.not.toBeInstanceOf(AggregateError);
    await fremd();

    const live = await w.stand(w.roh);
    // Alles wie vorher — plus genau der fremde Beleg, angehängt an den bestätigten Stand.
    expect({ ...live, belege: live.belege.slice(0, -1) }).toEqual(vorher);
    expect(live.belege.at(-1)).toMatchObject({
      action: "fremd.vorgang",
      seq: vorher.belege.length + 1,
    });
    expect(await w.services.audit.verify()).toBe(true);

    const frisch = inMemoryRepos();
    await replayJournal(
      frisch,
      w.zeilen.map((entry, i) => ({ lineNumber: i + 1, entry })),
    );
    expect(await w.nachReplay()).toEqual(live);
    const { AuditService } = await import("../../services/audit");
    expect(await new AuditService({ repo: frisch.auditRepo }).verify()).toBe(true);
  });

  it("ein unabhängiger Leser sieht während des Vorgangs keine unbestätigten Zeilen", async () => {
    const w = await lage(true);
    let gelesen: Promise<string | undefined> | undefined;
    w.scharf.beiBeleg = {
      action: "overlap.withdrawn-own",
      fn: () => {
        gelesen = w.services.overlaps.get(w.overlap.id).then((e) => e?.status);
      },
    };
    w.scharf.action = "ko.deleted";
    await expect(w.services.ko.delete(w.a.id, "anna")).rejects.toThrow();
    // Im Vorgang war der Befund schon geschlossen; der Leser wartete und sah den zurückgestellten.
    expect(await gelesen).toBe("offen");
  });
});
