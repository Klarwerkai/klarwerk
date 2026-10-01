// ================================================================================================
// LAUF gesamt-import-adoption:2 — BENS RUNDE-3-BEFUNDE R3-1 UND R3-2.
// ================================================================================================
//
// R3-1  Die Annahme-Reihenfolge galt nur je Dienstinstanz und nur auf dem Textweg. Zwei
//       gleichzeitig angenommene Fassungen derselben Quelle (Upsert-Schalter an) legten zwei
//       Objekte an; zwei Dienstinstanzen mit gemeinsamem Bestand ebenso bei gleichem Text.
// R3-2  Eine von der Recovery vollendete Annahme behielt den Dublettenbefund vom Einreihen — ein
//       wirklich angelegtes Objekt blieb als Dublette eines abgelehnten Kandidaten dokumentiert.
//
// Ohne Dienststart, ohne Datenbank: InMemory-Bestände und ein aufzeichnender Pool-Ersatz.
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import {
  type ClaimResolution,
  type DublettenPruefung,
  InMemoryCandidateRepo,
  LibraryService,
  PgCandidateRepo,
  REVIEW_CLAIM_LEASE_MS,
} from "../../services/library-analytics";
// Der Halter-Typ ist bewusst nicht über die (eingefrorene) Fassade ausgeleitet — nur dieser Test braucht ihn.
import type { AnnahmeHalter } from "../../services/library-analytics/src/repo";

const HALTER: AnnahmeHalter = { id: "k-1", opId: "op-1", leaseMs: 600_000 };

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
      override annahmeSperre<T>(_halter: AnnahmeHalter, schritt: () => Promise<T>): Promise<T> {
        return schritt();
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
    const client = {
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
    };
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
    const ergebnis = await repo.annahmeSperre(HALTER, () => {
      p.protokoll.push("SCHRITT");
      return Promise.resolve(42);
    });
    expect(ergebnis).toBe(42);
    expect(p.protokoll[0]).toBe("BEGIN");
    // Die Sperre lebt nicht länger als die Lease des Claims (Server beendet die Sitzung).
    expect(p.protokoll[1]).toBe("SET LOCAL idle_in_transaction_session_timeout = 600000");
    expect(p.protokoll[2]).toMatch(/^SELECT pg_advisory_xact_lock\(\d+\)$/);
    expect(p.protokoll.slice(3)).toEqual(["SCHRITT", "COMMIT"]);
    expect(p.freigaben()).toBe(1);
    expect(p.verworfen()).toBe(0);
  });

  it("ein werfender Schritt: ROLLBACK, Fehler kommt durch, nächster Schritt läuft", async () => {
    const p = aufzeichnenderPool();
    const repo = new PgCandidateRepo(p.pool);
    await expect(
      repo.annahmeSperre(HALTER, () => Promise.reject(new Error("kaputt"))),
    ).rejects.toThrow("kaputt");
    expect(p.protokoll.at(-1)).toBe("ROLLBACK");
    await expect(repo.annahmeSperre(HALTER, () => Promise.resolve("weiter"))).resolves.toBe(
      "weiter",
    );
    expect(p.freigaben()).toBe(2);
  });

  it("im Prozess wartet höchstens EIN Schritt auf der Datenbank: zweiter beginnt erst nach dem ersten", async () => {
    const p = aufzeichnenderPool();
    const repo = new PgCandidateRepo(p.pool);
    let loesen: () => void = () => undefined;
    const erster = repo.annahmeSperre(
      HALTER,
      () =>
        new Promise<void>((r) => {
          p.protokoll.push("ERSTER");
          loesen = r;
        }),
    );
    const zweiter = repo.annahmeSperre(HALTER, () => {
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

describe("R3-1 · die Sperre lebt nicht länger als der Claim ihres Halters", () => {
  it("ein hängender Halter, dessen Claim die Recovery abschliesst, hält die nächste Annahme nicht auf", async () => {
    const repo = new InMemoryCandidateRepo();
    await repo.insert({
      id: "k-1",
      item: EINTRAG,
      status: "neu",
      duplicate: false,
      createdAt: "2026-10-01T08:00:00.000Z",
    } as Parameters<InMemoryCandidateRepo["insert"]>[0]);
    expect(await repo.claim("k-1", "op-1", "2026-10-01T08:00:00.000Z")).toBeTruthy();

    // Der Halter hängt für immer in seinem Schritt.
    void repo.annahmeSperre(HALTER, () => new Promise<never>(() => undefined));
    let zweiterLief = false;
    const zweiter = repo.annahmeSperre({ id: "k-2", opId: "op-2", leaseMs: 1 }, () => {
      zweiterLief = true;
      return Promise.resolve();
    });
    await new Promise((r) => setTimeout(r, 5));
    expect(zweiterLief, "Solange der Claim lebt, gilt die Reihenfolge.").toBe(false);

    // Fremde Hand (Recovery) schliesst den Claim des Halters ab → die Sperre fällt mit ihm.
    expect(await repo.resolveClaim("k-1", "op-1", { status: "neu" })).toBeTruthy();
    await zweiter;
    expect(zweiterLief).toBe(true);
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
