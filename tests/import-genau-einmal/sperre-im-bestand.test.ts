// ================================================================================================
// LAUF gesamt-import-adoption:2 — BENS RUNDE-3-BEFUNDE R3-1 UND R3-2, DAZU B1 AUS LAUF :2 RUNDE 1.
// ================================================================================================
//
// R3-1  Die Annahme-Reihenfolge galt nur je Dienstinstanz und nur auf dem Textweg. Zwei
//       gleichzeitig angenommene Fassungen derselben Quelle (Upsert-Schalter an) legten zwei
//       Objekte an; zwei Dienstinstanzen mit gemeinsamem Bestand ebenso bei gleichem Text.
// R3-2  Eine von der Recovery vollendete Annahme behielt den Dublettenbefund vom Einreihen — ein
//       wirklich angelegtes Objekt blieb als Dublette eines abgelehnten Kandidaten dokumentiert.
// B1    Runde 1 brach die Sperre, sobald die Recovery den Claim ihres Halters freigab; der
//       fortgesetzte alte Halter legte dann neben einem anderen Kandidaten ein zweites Objekt an.
//
// Die Pg-Fälle hier prüfen nur SQL-Folge und Fehlerabbildung über einen Pool-Ersatz. Die echte
// datenbankweite Wirkung prüft `annahme-sperre-pg.integration.test.ts` (Prüfserver).
//
// Ohne Dienststart, ohne Datenbank: InMemory-Bestände und ein aufzeichnender Pool-Ersatz.
import { EventEmitter } from "node:events";
import { Client, type Pool } from "pg";
import { describe, expect, it } from "vitest";
import type { ImportCandidate as WebImportCandidate } from "../../apps/web/src/api/types";
import { candidateFindings } from "../../apps/web/src/lib/extConcept";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import {
  type ClaimResolution,
  type DublettenPruefung,
  InMemoryCandidateRepo,
  LibraryService,
  PgCandidateRepo,
  REVIEW_CLAIM_LEASE_MS,
} from "../../services/library-analytics";

const WARTEZEIT = 600_000;

const NIE_AEHNLICH: DublettenPruefung = () => ({ dublette: false });

const EINTRAG = {
  title: "Filterkerze wechseln",
  statement: "Die Filterkerze bei jedem Oelwechsel mit tauschen",
  type: "best_practice" as const,
  category: "Wartung",
  confidentiality: "intern" as const,
};

const QUELLE = {
  ...EINTRAG,
  provider: "customer-wiki",
  externalId: "source-42",
};

async function bestand(candidates = new InMemoryCandidateRepo()) {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  await koService.activateSearchProjectionV2();
  return { koService, candidates };
}

describe("R3-1 · die Annahme-Sperre gilt für jeden Weg und jede Instanz am selben Bestand", () => {
  it("R3-1a · eine Instanz, Upsert an: zwei Fassungen derselben Quelle gleichzeitig angenommen → ein Objekt, Version 2", async () => {
    const { koService, candidates } = await bestand();
    const library = new LibraryService({ koService, candidates, externalUpsert: true });
    const [v1] = await library.createImportCandidates([{ ...QUELLE, sourceVersion: 1 }], "imp");
    const [v2] = await library.createImportCandidates(
      [{ ...QUELLE, sourceVersion: 2, statement: `${QUELLE.statement} und pruefen` }],
      "imp",
    );
    expect(v1?.id).toBeTruthy();
    expect(v2?.id).toBeTruthy();

    const [r1, r2] = await Promise.all([
      library.reviewImportCandidate(v1!.id, "accept", "controller"),
      library.reviewImportCandidate(v2!.id, "accept", "controller"),
    ]);

    const kos = await koService.list();
    expect(kos, "Dieselbe Quelle darf nur EINE Kennung bekommen.").toHaveLength(1);
    expect(r1.koId).toBe(kos[0]?.id);
    expect(r2.koId).toBe(kos[0]?.id);
    expect(kos[0]?.sources.find((s) => s.externalId === "source-42")?.sourceVersion).toBe(2);
  });

  it("R3-1b · zwei Instanzen, gemeinsamer Bestand, Textweg: identische Kandidaten gleichzeitig → ein Objekt", async () => {
    const { koService, candidates } = await bestand();
    const links = new LibraryService({ koService, candidates });
    const rechts = new LibraryService({ koService, candidates });
    const [a] = await links.createImportCandidates([EINTRAG], "imp", NIE_AEHNLICH);
    const [b] = await rechts.createImportCandidates([EINTRAG], "imp", NIE_AEHNLICH);

    const [ra, rb] = await Promise.all([
      links.reviewImportCandidate(a!.id, "accept", "controller", undefined, NIE_AEHNLICH),
      rechts.reviewImportCandidate(b!.id, "accept", "controller", undefined, NIE_AEHNLICH),
    ]);

    expect(await koService.list()).toHaveLength(1);
    const angelegt = [ra.koId, rb.koId].filter((id) => id !== null);
    expect(angelegt).toHaveLength(1);
    const zweite = ra.koId === null ? ra : rb;
    expect(zweite.dublettenbefund).toEqual({
      ergebnis: "identisch",
      treffer: { art: "wissensobjekt", koId: angelegt[0] },
    });
  });

  it("R3-1c · zwei Instanzen, gemeinsamer Bestand, Upsert an: zwei Fassungen derselben Quelle → ein Objekt", async () => {
    const { koService, candidates } = await bestand();
    const links = new LibraryService({ koService, candidates, externalUpsert: true });
    const rechts = new LibraryService({ koService, candidates, externalUpsert: true });
    const [v1] = await links.createImportCandidates([{ ...QUELLE, sourceVersion: 1 }], "imp");
    const [v2] = await rechts.createImportCandidates([{ ...QUELLE, sourceVersion: 2 }], "imp");

    const [r1, r2] = await Promise.all([
      links.reviewImportCandidate(v1!.id, "accept", "controller"),
      rechts.reviewImportCandidate(v2!.id, "accept", "controller"),
    ]);

    const kos = await koService.list();
    expect(kos).toHaveLength(1);
    expect(new Set([r1.koId, r2.koId])).toEqual(new Set([kos[0]?.id]));
  });

  it("R3-1d · KALIBRIERUNG: ohne Sperre (durchreichendes Repo) entstehen am Anker-Weg zwei Objekte", async () => {
    // Belegt, dass R3-1a/c wirklich die Sperre messen: dasselbe Szenario ohne Reihenfolge.
    class OhneSperre extends InMemoryCandidateRepo {
      override annahmeSperre<T>(
        _wartezeitMs: number,
        schritt: (sperreGilt: () => Promise<void>) => Promise<T>,
      ): Promise<T> {
        return schritt(() => Promise.resolve());
      }
    }
    const { koService, candidates } = await bestand(new OhneSperre());
    const library = new LibraryService({ koService, candidates, externalUpsert: true });
    const [v1] = await library.createImportCandidates([{ ...QUELLE, sourceVersion: 1 }], "imp");
    const [v2] = await library.createImportCandidates([{ ...QUELLE, sourceVersion: 2 }], "imp");
    await Promise.all([
      library.reviewImportCandidate(v1!.id, "accept", "controller"),
      library.reviewImportCandidate(v2!.id, "accept", "controller"),
    ]);
    expect(await koService.list()).toHaveLength(2);
  });
});

describe("R3-1 · Postgres: die Sperre ist eine transaktionsgebundene Advisory-Sperre", () => {
  function aufzeichnenderPool() {
    const protokoll: string[] = [];
    let freigaben = 0;
    let verworfen = 0;
    const client = Object.assign(new EventEmitter(), {
      query: (text: string) => {
        protokoll.push(text);
        return Promise.resolve({ rows: [], rowCount: 0 });
      },
      release: (fehler?: unknown) => {
        freigaben += 1;
        if (fehler) {
          verworfen += 1;
        }
      },
    });
    const pool = { connect: () => Promise.resolve(client) } as unknown as Pool;
    return {
      pool,
      protokoll,
      freigaben: () => freigaben,
      verworfen: () => verworfen,
    };
  }

  it("Schritt läuft INNERHALB von BEGIN · Sperre · COMMIT, Verbindung wird freigegeben", async () => {
    const p = aufzeichnenderPool();
    const repo = new PgCandidateRepo(p.pool);
    const ergebnis = await repo.annahmeSperre(WARTEZEIT, () => {
      p.protokoll.push("SCHRITT");
      return Promise.resolve(42);
    });
    expect(ergebnis).toBe(42);
    expect(p.protokoll[0]).toBe("BEGIN");
    // Bens B1: eine server-/rollenweite Leerlauffrist darf die Sperrsitzung nicht beenden; begrenzt
    // wird nur das Warten.
    expect(p.protokoll[1]).toBe("SET LOCAL idle_in_transaction_session_timeout = 0");
    expect(p.protokoll[2]).toMatch(/^SET LOCAL lock_timeout = \d+$/);
    expect(p.protokoll[3]).toMatch(/^SELECT pg_advisory_xact_lock\(\d+\)$/);
    expect(p.protokoll.slice(4)).toEqual(["SCHRITT", "COMMIT"]);
    expect(p.freigaben()).toBe(1);
    expect(p.verworfen()).toBe(0);
  });

  it("ein werfender Schritt: ROLLBACK, Fehler kommt durch, nächster Schritt läuft", async () => {
    const p = aufzeichnenderPool();
    const repo = new PgCandidateRepo(p.pool);
    await expect(
      repo.annahmeSperre(WARTEZEIT, () => Promise.reject(new Error("kaputt"))),
    ).rejects.toThrow("kaputt");
    expect(p.protokoll.at(-1)).toBe("ROLLBACK");
    await expect(repo.annahmeSperre(WARTEZEIT, () => Promise.resolve("weiter"))).resolves.toBe(
      "weiter",
    );
    expect(p.freigaben()).toBe(2);
  });

  it("im Prozess wartet höchstens EIN Schritt auf der Datenbank: zweiter beginnt erst nach dem ersten", async () => {
    const p = aufzeichnenderPool();
    const repo = new PgCandidateRepo(p.pool);
    let loesen: () => void = () => undefined;
    const erster = repo.annahmeSperre(
      WARTEZEIT,
      () =>
        new Promise<void>((r) => {
          p.protokoll.push("ERSTER");
          loesen = r;
        }),
    );
    const zweiter = repo.annahmeSperre(WARTEZEIT, () => {
      p.protokoll.push("ZWEITER");
      return Promise.resolve();
    });
    await new Promise((r) => setTimeout(r, 5));
    expect(p.protokoll.filter((z) => z === "BEGIN")).toHaveLength(1);
    expect(p.protokoll).not.toContain("ZWEITER");
    loesen();
    await Promise.all([erster, zweiter]);
    expect(p.protokoll.indexOf("ZWEITER")).toBeGreaterThan(p.protokoll.indexOf("COMMIT"));
  });
});

describe("B1 · ein abgelöster, aber lebender Halter behält die Sperre bis zu seiner Anlage", () => {
  it("InMemory: der Claim des hängenden Halters wird freigegeben — der Nächste wartet trotzdem und bekommt nach der Wartezeit CONFLICT", async () => {
    const repo = new InMemoryCandidateRepo();
    void repo.annahmeSperre(WARTEZEIT, () => new Promise<never>(() => undefined));
    let zweiterLief = false;
    await expect(
      repo.annahmeSperre(20, () => {
        zweiterLief = true;
        return Promise.resolve();
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(zweiterLief, "Ein abgewiesener Schritt läuft nie.").toBe(false);
  });

  it("Pg: abgelaufene lock_timeout (55P03) wird CONFLICT, der Schritt läuft nicht, die Verbindung kehrt zurück", async () => {
    const protokoll: string[] = [];
    let freigaben = 0;
    const client = Object.assign(new EventEmitter(), {
      query: (text: string) => {
        protokoll.push(text);
        if (text.startsWith("SELECT pg_advisory_xact_lock")) {
          return Promise.reject(Object.assign(new Error("lock timeout"), { code: "55P03" }));
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      },
      release: () => {
        freigaben += 1;
      },
    });
    const repo = new PgCandidateRepo({ connect: () => Promise.resolve(client) } as unknown as Pool);
    let lief = false;
    await expect(
      repo.annahmeSperre(WARTEZEIT, () => {
        lief = true;
        return Promise.resolve();
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(lief).toBe(false);
    expect(protokoll.at(-1)).toBe("ROLLBACK");
    expect(freigaben).toBe(1);
  });

  // Bens Gegenbeleg (ben-lease-dubletten.test.ts), als Regression übernommen. A hängt unmittelbar
  // vor der echten Objektanlage, die Lease läuft ab, die Recovery gibt A frei, ein ANDERER Kandidat
  // B desselben Inhalts bzw. derselben Quelle wird angenommen, dann setzt A fort.
  //
  // EINE ABWEICHUNG VON BENS FALL, ausdrücklich: Ben wartete Bs Annahme VOR der Fortsetzung von A
  // ab und erwartete dort schon ein angelegtes Objekt. Das ist mit dem verlangten Ausschluss „bis
  // zur wirksamen Objektanlage" unvereinbar, solange A lebt — B kann erst entscheiden, wenn As
  // Anlage feststeht (sonst entstehen genau die zwei Objekte). Darum: B läuft nebenher und wartet
  // (Fall 1), oder B gibt nach der Wartezeit mit CONFLICT auf und gelingt beim zweiten Klick (Fall 2).
  for (const anker of [false, true]) {
    const weg = anker ? "Herkunftsanker" : "Textweg";
    const aufbau = async (annahmeWartezeitMs?: number) => {
      const candidates = new InMemoryCandidateRepo();
      const koService = new KoService({ repo: new InMemoryKoRepo() });
      await koService.activateSearchProjectionV2();
      const uhr = { ms: Date.parse("2026-10-01T08:00:00Z") };
      const library = new LibraryService({
        candidates,
        koService,
        externalUpsert: anker,
        now: () => uhr.ms,
        ...(annahmeWartezeitMs === undefined ? {} : { annahmeWartezeitMs }),
      });
      const quelle = anker ? { ...EINTRAG, provider: "wiki", externalId: "quelle-42" } : EINTRAG;
      const [a] = await library.createImportCandidates(
        [{ ...quelle, sourceVersion: 1 }],
        "imp",
        NIE_AEHNLICH,
      );
      const [b] = await library.createImportCandidates(
        [{ ...quelle, sourceVersion: 2 }],
        "imp",
        NIE_AEHNLICH,
      );
      expect(a!.id).not.toBe(b!.id);
      const create = koService.create.bind(koService);
      let loesen: () => void = () => undefined;
      let betreten: () => void = () => undefined;
      const tor = new Promise<void>((r) => {
        loesen = r;
      });
      const bereit = new Promise<void>((r) => {
        betreten = r;
      });
      let erster = true;
      // Nur eine zeitliche Barriere vor dem unveränderten echten create — wie bei Ben.
      koService.create = async (input) => {
        if (erster) {
          erster = false;
          betreten();
          await tor;
        }
        return create(input);
      };
      const alterLauf = library
        .reviewImportCandidate(a!.id, "accept", "reviewer-a", undefined, NIE_AEHNLICH)
        .then(
          (value) => ({ value }),
          (error: { code?: string }) => ({ code: error.code }),
        );
      await bereit;
      uhr.ms += REVIEW_CLAIM_LEASE_MS + 1;
      expect(await library.recoverStaleReviewClaims()).toEqual({ completed: 0, released: 1 });
      return { candidates, koService, library, a: a!, b: b!, alterLauf, loesen };
    };

    it(`B1 · ${weg}: B wartet auf den fortgesetzten alten Halter → genau EINE Kennung`, async () => {
      const { candidates, koService, library, a, b, alterLauf, loesen } = await aufbau();
      const bLauf = library.reviewImportCandidate(
        b.id,
        "accept",
        "reviewer-b",
        undefined,
        NIE_AEHNLICH,
      );
      await new Promise((r) => setTimeout(r, 5));
      expect(await koService.list(), "Solange A lebt, legt B nicht daneben an.").toHaveLength(0);
      loesen();
      expect(await alterLauf).toEqual({ code: "CONFLICT" });
      const angenommen = await bLauf;
      const kos = await koService.list();
      expect(kos, "Ein abgelöster Lauf darf kein zweites Objekt hinterlassen.").toHaveLength(1);
      expect(kos[0]?.importCandidateId).toBe(a.id);
      expect(angenommen.status).toBe("angenommen");
      if (anker) {
        // Dieselbe Quelle: B schreibt As Objekt fort, dieselbe Kennung.
        expect(angenommen.koId).toBe(kos[0]?.id);
        expect(kos[0]?.sources.find((s) => s.externalId === "quelle-42")?.sourceVersion).toBe(2);
      } else {
        // Derselbe Inhalt: B legt nichts an und nennt As Objekt.
        expect(angenommen.koId).toBeNull();
        expect(angenommen.dublettenbefund).toEqual({
          ergebnis: "identisch",
          treffer: { art: "wissensobjekt", koId: kos[0]?.id },
        });
      }
      expect((await candidates.findById(a.id))?.status).toBe("neu");
    });

    it(`B1 · ${weg}: B gibt nach der Wartezeit mit CONFLICT auf, legt nichts an; der zweite Klick gelingt`, async () => {
      const { candidates, koService, library, b, alterLauf, loesen } = await aufbau(20);
      await expect(
        library.reviewImportCandidate(b.id, "accept", "reviewer-b", undefined, NIE_AEHNLICH),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(await koService.list()).toHaveLength(0);
      expect((await candidates.findById(b.id))?.status, "Claim zurückgegeben.").toBe("neu");

      loesen();
      await alterLauf;
      const zweiterKlick = await library.reviewImportCandidate(
        b.id,
        "accept",
        "reviewer-b",
        undefined,
        NIE_AEHNLICH,
      );
      expect(zweiterKlick.status).toBe("angenommen");
      expect(await koService.list()).toHaveLength(1);
    });
  }
});

describe("B4 · der Verlust der Sperrsitzung wird behandelt und verhindert jede weitere Mutation", () => {
  // Bens Fehlerkanalprobe: ein ECHTER pg.Client ohne connect (keine Datenbank, kein Socket); nur
  // die vorbereitenden SQL-Antworten sind simuliert. `_handleErrorEvent` ist derselbe Treiberpfad,
  // den ein Socketfehler nimmt.
  function echterClient() {
    const client = new Client();
    const zustand = { kaputt: false, freigegebenMitFehler: undefined as unknown };
    const fehler = Object.assign(new Error("Sperrverbindung abgebrochen"), { code: "ECONNRESET" });
    client.query = (() =>
      zustand.kaputt
        ? Promise.reject(fehler)
        : Promise.resolve({ rows: [], rowCount: 0 })) as unknown as typeof client.query;
    Object.assign(client, {
      release: (f?: unknown) => {
        zustand.freigegebenMitFehler = f;
      },
    });
    const abbrechen = () => {
      zustand.kaputt = true;
      (client as unknown as { _handleErrorEvent(e: Error): void })._handleErrorEvent(fehler);
    };
    const repo = new PgCandidateRepo({ connect: async () => client } as unknown as Pool);
    return { repo, zustand, abbrechen };
  }

  it("Verbindungsfehler WÄHREND des Schritts: kein unbehandelter Fehler, die nächste Mutation unterbleibt (CONFLICT), Verbindung verworfen", async () => {
    const { repo, zustand, abbrechen } = echterClient();
    let betreten: () => void = () => undefined;
    let weiter: () => void = () => undefined;
    const bereit = new Promise<void>((r) => {
      betreten = r;
    });
    const tor = new Promise<void>((r) => {
      weiter = r;
    });
    let mutiert = false;
    const annahme = repo.annahmeSperre(WARTEZEIT, async (sperreGilt) => {
      betreten();
      await tor;
      await sperreGilt();
      mutiert = true;
      return 42;
    });
    const ausgang = annahme.then(
      (value) => ({ value }),
      (error: { code?: string }) => ({ code: error.code }),
    );
    await bereit;
    expect(() => abbrechen(), "Der Adapter behandelt den Fehler seines Clients.").not.toThrow();
    weiter();
    expect(await ausgang).toEqual({ code: "CONFLICT" });
    expect(mutiert, "Nach Sitzungsverlust wird nichts mehr geschrieben.").toBe(false);
    expect(zustand.freigegebenMitFehler, "Die verlorene Verbindung kehrt nicht in den Pool.").toBe(
      true,
    );
  });

  it("Sitzung tot, aber ohne Fehlerereignis: `SELECT 1` über dieselbe Sitzung scheitert → CONFLICT, nichts geschrieben", async () => {
    const { repo, zustand } = echterClient();
    let mutiert = false;
    await expect(
      repo.annahmeSperre(WARTEZEIT, async (sperreGilt) => {
        zustand.kaputt = true;
        await sperreGilt();
        mutiert = true;
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mutiert).toBe(false);
    expect(zustand.freigegebenMitFehler).toBe(true);
  });

  it("Sitzung erst NACH der letzten Mutation verloren: die Wirkung steht, das Ergebnis kommt zurück, Verbindung verworfen", async () => {
    const { repo, zustand, abbrechen } = echterClient();
    const ergebnis = await repo.annahmeSperre(WARTEZEIT, async (sperreGilt) => {
      await sperreGilt();
      abbrechen();
      return "angelegt";
    });
    expect(ergebnis).toBe("angelegt");
    expect(zustand.freigegebenMitFehler).toBe(true);
  });

  it("Dienst: verlorene Sperre vor der Anlage → CONFLICT, kein Objekt, Claim zurück", async () => {
    class SperreVerloren extends InMemoryCandidateRepo {
      override annahmeSperre<T>(
        wartezeitMs: number,
        schritt: (sperreGilt: () => Promise<void>) => Promise<T>,
      ): Promise<T> {
        return super.annahmeSperre(wartezeitMs, () =>
          schritt(() =>
            Promise.reject(Object.assign(new Error("Sperre verloren"), { code: "CONFLICT" })),
          ),
        );
      }
    }
    for (const anker of [false, true]) {
      const { koService, candidates } = await bestand(new SperreVerloren());
      const library = new LibraryService({ koService, candidates, externalUpsert: anker });
      const eintrag = anker ? { ...QUELLE, sourceVersion: 1 } : EINTRAG;
      const [k] = await library.createImportCandidates([eintrag], "imp", NIE_AEHNLICH);
      await expect(
        library.reviewImportCandidate(k!.id, "accept", "rev", undefined, NIE_AEHNLICH),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(await koService.list()).toHaveLength(0);
      expect((await candidates.findById(k!.id))?.status).toBe("neu");
    }
  });
});

describe("B3 · der tatsächliche Annahmeausgang am Herkunftsanker steht in Antwort, Bestand und Fläche", () => {
  const FASSUNG = (v: number) => ({ ...QUELLE, sourceVersion: v });

  it('zwei Fassungen VOR der ersten Anlage eingereiht: die zweite Annahme meldet `wiederverwendet` mit Kennung, nicht „KO erzeugt"', async () => {
    const { koService, candidates } = await bestand();
    const library = new LibraryService({ koService, candidates, externalUpsert: true });
    const [a] = await library.createImportCandidates([FASSUNG(1)], "imp");
    const [b] = await library.createImportCandidates([FASSUNG(2)], "imp");
    expect(b?.dublettenbefund).toEqual({ ergebnis: "nicht_gestellt" });
    const ra = await library.reviewImportCandidate(a!.id, "accept", "rev");
    const rb = await library.reviewImportCandidate(b!.id, "accept", "rev");
    expect(ra.dublettenbefund).toEqual({ ergebnis: "nicht_gestellt" });
    const erwartet = {
      ergebnis: "wiederverwendet",
      treffer: { art: "wissensobjekt", koId: ra.koId },
    };
    expect(rb.koId).toBe(ra.koId);
    expect(rb.dublettenbefund).toEqual(erwartet);
    expect(rb.duplicate).toBe(false);
    expect((await candidates.findById(b!.id))?.dublettenbefund, "auch im Bestand").toEqual(
      erwartet,
    );
    const f = candidateFindings(rb as unknown as WebImportCandidate);
    expect(f.acceptedKo).toBe(false);
    expect(f.wiederverwendet).toEqual({ koId: ra.koId });
    expect(candidateFindings(ra as unknown as WebImportCandidate).acceptedKo).toBe(true);
  });

  it("dasselbe gleichzeitig (Promise.all, Bens Fall): ein Objekt, die zweite Annahme sagt `wiederverwendet`", async () => {
    const { koService, candidates } = await bestand();
    const library = new LibraryService({ koService, candidates, externalUpsert: true });
    const [a] = await library.createImportCandidates([FASSUNG(1)], "imp");
    const [b] = await library.createImportCandidates([FASSUNG(2)], "imp");
    const [ra, rb] = await Promise.all([
      library.reviewImportCandidate(a!.id, "accept", "rev"),
      library.reviewImportCandidate(b!.id, "accept", "rev"),
    ]);
    expect(await koService.list()).toHaveLength(1);
    expect(rb.koId).toBe(ra.koId);
    expect(rb.dublettenbefund).toEqual({
      ergebnis: "wiederverwendet",
      treffer: { art: "wissensobjekt", koId: ra.koId },
    });
    expect(candidateFindings(rb as unknown as WebImportCandidate).acceptedKo).toBe(false);
  });

  it('nach dem Einreihen gelöscht: die Annahme meldet `im_papierkorb` mit Kennung, nichts angelegt, nicht „KO erzeugt"', async () => {
    const { koService, candidates } = await bestand();
    const library = new LibraryService({ koService, candidates, externalUpsert: true });
    const [a] = await library.createImportCandidates([FASSUNG(1)], "imp");
    const [b] = await library.createImportCandidates([FASSUNG(2)], "imp");
    const ra = await library.reviewImportCandidate(a!.id, "accept", "rev");
    await koService.delete(ra.koId as string, "rev");
    const rb = await library.reviewImportCandidate(b!.id, "accept", "rev");
    const erwartet = {
      ergebnis: "im_papierkorb",
      treffer: { art: "wissensobjekt", koId: ra.koId },
    };
    expect(rb.koId).toBe(ra.koId);
    expect(rb.dublettenbefund).toEqual(erwartet);
    expect(rb.duplicate).toBe(true);
    expect((await candidates.findById(b!.id))?.dublettenbefund).toEqual(erwartet);
    expect(await koService.list()).toHaveLength(0);
    const f = candidateFindings(rb as unknown as WebImportCandidate);
    expect(f.acceptedKo).toBe(false);
    expect(f.imPapierkorb).toEqual({ koId: ra.koId });
    expect(f.duplicate).toBe(false);
  });

  it("eingereiht mit `wiederverwendet`, Träger danach im Papierkorb: die Annahme meldet `im_papierkorb`", async () => {
    const { koService, candidates } = await bestand();
    const library = new LibraryService({ koService, candidates, externalUpsert: true });
    const [a] = await library.createImportCandidates([FASSUNG(1)], "imp");
    const ra = await library.reviewImportCandidate(a!.id, "accept", "rev");
    const [b] = await library.createImportCandidates([FASSUNG(2)], "imp");
    expect(b?.dublettenbefund?.ergebnis).toBe("wiederverwendet");
    await koService.delete(ra.koId as string, "rev");
    const rb = await library.reviewImportCandidate(b!.id, "accept", "rev");
    expect(rb.dublettenbefund).toEqual({
      ergebnis: "im_papierkorb",
      treffer: { art: "wissensobjekt", koId: ra.koId },
    });
    expect(await koService.list()).toHaveLength(0);
  });
});

describe("R3-2 · die Recovery schreibt den tatsächlichen Übernahmebefund", () => {
  it("A abgelehnt, B angenommen, beide Abschlusswrites fallen aus → Recovery: angenommen, duplicate=false, Befund `keine`", async () => {
    class AbschlussFaelltAus extends InMemoryCandidateRepo {
      ausfaelle = 0;
      override resolveClaim(id: string, opId: string, next: ClaimResolution) {
        if (this.ausfaelle < 2 && next.status === "angenommen" && next.koId) {
          this.ausfaelle += 1;
          return Promise.reject(new Error("Statuspersistenz faellt aus"));
        }
        return super.resolveClaim(id, opId, next);
      }
    }
    const repo = new AbschlussFaelltAus();
    const { koService, candidates } = await bestand(repo);
    const uhr = { ms: Date.parse("2026-10-01T08:00:00Z") };
    const library = new LibraryService({ koService, candidates, now: () => uhr.ms });
    const [a] = await library.createImportCandidates([EINTRAG], "imp", NIE_AEHNLICH);
    const [b] = await library.createImportCandidates([EINTRAG], "imp", NIE_AEHNLICH);
    expect(b?.duplicate).toBe(true);
    await library.reviewImportCandidate(a!.id, "reject", "controller");

    await expect(
      library.reviewImportCandidate(b!.id, "accept", "controller", undefined, NIE_AEHNLICH),
    ).rejects.toThrow();
    expect(repo.ausfaelle, "Vorbedingung: beide Abschlusswrites fielen aus.").toBe(2);
    expect((await repo.findById(b!.id))?.status).toBe("in_bearbeitung");
    const kos = await koService.list();
    expect(kos).toHaveLength(1);

    uhr.ms += REVIEW_CLAIM_LEASE_MS + 1;
    expect(await library.recoverStaleReviewClaims()).toEqual({ completed: 1, released: 0 });

    const gespeichert = await repo.findById(b!.id);
    expect(gespeichert?.status).toBe("angenommen");
    expect(gespeichert?.koId).toBe(kos[0]?.id);
    expect(gespeichert?.duplicate).toBe(false);
    expect(gespeichert?.dublettenbefund).toEqual({ ergebnis: "keine" });
    expect(await koService.list()).toHaveLength(1);
  });

  it("GEGENPROBE: ein schon anlegender gespeicherter Befund bleibt bei der Recovery unverändert", async () => {
    class AbschlussFaelltAus extends InMemoryCandidateRepo {
      ausfaelle = 0;
      override resolveClaim(id: string, opId: string, next: ClaimResolution) {
        if (this.ausfaelle < 2 && next.status === "angenommen" && next.koId) {
          this.ausfaelle += 1;
          return Promise.reject(new Error("Statuspersistenz faellt aus"));
        }
        return super.resolveClaim(id, opId, next);
      }
    }
    const repo = new AbschlussFaelltAus();
    const { koService, candidates } = await bestand(repo);
    const uhr = { ms: Date.parse("2026-10-01T08:00:00Z") };
    const library = new LibraryService({ koService, candidates, now: () => uhr.ms });
    const [k] = await library.createImportCandidates([EINTRAG], "imp", NIE_AEHNLICH);
    expect(k?.dublettenbefund).toEqual({ ergebnis: "keine" });
    await expect(library.reviewImportCandidate(k!.id, "accept", "controller")).rejects.toThrow();
    uhr.ms += REVIEW_CLAIM_LEASE_MS + 1;
    expect(await library.recoverStaleReviewClaims()).toEqual({ completed: 1, released: 0 });
    const gespeichert = await repo.findById(k!.id);
    expect(gespeichert?.duplicate).toBe(false);
    expect(gespeichert?.dublettenbefund).toEqual({ ergebnis: "keine" });
  });
});
