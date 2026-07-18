import type { Pool } from "pg";
import { beforeEach, describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../audit";
import {
  InMemoryEvidenceRepo,
  InMemoryKoRepo,
  InMemoryKoVersionRepo,
  type KoVersionRepo,
} from "./repo";
import { PgEvidenceRepo, PgKoVersionRepo } from "./repo-pg";
import {
  type CreateKoInput,
  DEFAULT_EVIDENCE_LIMIT,
  KoService,
  MAX_EVIDENCE_LIMIT,
  TRUTH_CONFLICT_TRUST_PENALTY,
  normalizeEvidenceLimit,
} from "./service";
import type { EvidenceRecord, KoVersionSnapshot } from "./types";

function base(overrides: Partial<CreateKoInput> = {}): CreateKoInput {
  return {
    title: "Ventil X schließt bei Überdruck",
    statement: "Bei Überdruck Ventil X manuell schließen.",
    type: "best_practice",
    category: "Anlage 1",
    author: "pedi",
    ...overrides,
  };
}

describe("KoService", () => {
  let service: KoService;

  beforeEach(() => {
    service = new KoService({ repo: new InMemoryKoRepo() });
  });

  it("FR-KO-01: erzeugt KO mit allen Pflichtfeldern", async () => {
    const ko = await service.create(base());
    expect(ko.version).toBe(1);
    expect(ko.status).toBe("offen");
    expect(ko.trust).toBe(0);
    expect(ko.originalAuthor).toBe("pedi");
    expect(ko.neededValidations).toBe(3);
    expect(ko.assignments).toEqual([]);
    expect(ko.asset).toBeNull();
    expect(ko.history).toHaveLength(1);
    expect(ko.history[0]?.note).toBe("erstellt");
    expect(ko.comments).toEqual([]);
  });

  it("FR-KO-01: create ohne sources → sources bleibt leer (Alt-Verhalten)", async () => {
    const ko = await service.create(base());
    expect(ko.sources).toEqual([]);
  });

  it("SCRUM-470: create übernimmt Herkunfts-Anker (Confluence pageId/spaceKey/Version)", async () => {
    const ko = await service.create(
      base({
        sources: [
          {
            id: "src-1",
            label: "Confluence: Pumpe entlüften",
            url: "https://wiki.example.com/pages/12345",
            excerpt: null,
            kind: "external",
            peerValidated: false,
            provider: "Confluence",
            externalId: "12345",
            spaceKey: "WART",
            sourceVersion: 3,
            author: "pedi",
            at: new Date().toISOString(),
          },
        ],
      }),
    );
    expect(ko.sources).toHaveLength(1);
    expect(ko.sources[0]?.externalId).toBe("12345");
    expect(ko.sources[0]?.spaceKey).toBe("WART");
    expect(ko.sources[0]?.sourceVersion).toBe(3);
    expect(ko.sources[0]?.peerValidated).toBe(false);
  });

  it("KW-STR: create sanitisiert bodyHtml serverseitig", async () => {
    const ko = await service.create(
      base({ bodyHtml: '<p>ok</p><script>alert(1)</script><img src="https://evil/x">' }),
    );
    expect(ko.bodyHtml).toBe("<p>ok</p>");
    expect(ko.bodyHtml).not.toContain("<script");
    expect(ko.bodyHtml).not.toContain("alert(1)");
    expect(ko.bodyHtml).not.toContain("evil");
  });

  it("KW-STR: leeres statement wird aus bodyHtml als Plaintext abgeleitet", async () => {
    const ko = await service.create(
      base({ statement: "  ", bodyHtml: "<h2>Titel</h2><p>Inhalt</p>" }),
    );
    expect(ko.statement).toBe("Titel Inhalt");
  });

  it("KW-STR: revise sanitisiert neuen bodyHtml + bewahrt vorhandenen", async () => {
    const ko = await service.create(base({ bodyHtml: "<p>v1</p>" }));
    const rev = await service.revise(ko.id, { bodyHtml: "<p>v2</p><script>x</script>" }, "pedi");
    expect(rev.bodyHtml).toBe("<p>v2</p>");
    // ohne bodyHtml-Änderung bleibt der bestehende Body erhalten
    const rev2 = await service.revise(ko.id, { statement: "nur text" }, "pedi");
    expect(rev2.bodyHtml).toBe("<p>v2</p>");
  });

  it("FR-KO-06: fügt Kommentare an und bewahrt sie über revise", async () => {
    const ko = await service.create(base());
    const c1 = await service.addComment(ko.id, "controller", "Bitte Quelle ergänzen.");
    expect(c1.comments).toHaveLength(1);
    expect(c1.comments[0]?.author).toBe("controller");
    expect(c1.comments[0]?.text).toBe("Bitte Quelle ergänzen.");
    const revised = await service.revise(ko.id, { statement: "neu" }, "controller");
    expect(revised.comments).toHaveLength(1);
  });

  it("SCRUM-129 / FR-KO-07: externe Quelle anfügen — nie peer-validiert, über revise erhalten", async () => {
    const audit = new AuditService({ repo: new InMemoryAuditRepo() });
    const svc = new KoService({ repo: new InMemoryKoRepo(), audit });
    const ko = await svc.create(base());
    expect(ko.sources).toEqual([]);

    const withSource = await svc.addSource(ko.id, "experte", {
      label: "Wartungshandbuch P2",
      url: "https://wiki/p2",
      excerpt: "Kapitel 4.2",
      provider: "Wikipedia", // SCRUM-118
    });
    expect(withSource.sources).toHaveLength(1);
    const src = withSource.sources[0];
    expect(src?.kind).toBe("external");
    expect(src?.peerValidated).toBe(false); // externe Quelle ist NIE peer-validiert
    expect(src?.label).toBe("Wartungshandbuch P2");
    expect(src?.url).toBe("https://wiki/p2");
    expect(src?.provider).toBe("Wikipedia"); // SCRUM-118: Provider gespeichert

    // Quelle bleibt über eine Überarbeitung erhalten.
    const revised = await svc.revise(ko.id, { statement: "neu" }, "experte");
    expect(revised.sources).toHaveLength(1);

    // Audit-Eintrag entstanden.
    const entries = await audit.list({ action: "ko.source-added" });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.target).toBe(ko.id);
  });

  it("SCRUM-129: leeres Label wird abgelehnt; Quelle entfernbar", async () => {
    const ko = await service.create(base());
    await expect(service.addSource(ko.id, "experte", { label: "   " })).rejects.toMatchObject({
      code: "INVALID_SOURCE",
    });
    const withSource = await service.addSource(ko.id, "experte", { label: "Norm DIN 1234" });
    const sid = withSource.sources[0]?.id ?? "";
    expect(withSource.sources[0]?.url).toBeNull();
    const removed = await service.removeSource(ko.id, sid, "experte");
    expect(removed.sources).toHaveLength(0);
  });

  it("SCRUM-527 (WP2): addSource verwirft aktive/relative URLs an der Persistenzgrenze (inkl. Evidence)", async () => {
    const evidence = new InMemoryEvidenceRepo();
    const svc = new KoService({ repo: new InMemoryKoRepo(), evidence });
    const ko = await svc.create(base());

    // javascript:-URL → weder in der Quelle noch im Evidence-Record persistiert.
    const withBad = await svc.addSource(ko.id, "experte", {
      label: "Manipulierte Quelle",
      url: "javascript:alert(document.cookie)",
    });
    expect(withBad.sources[0]?.url).toBeNull();
    const records = await evidence.listByKo(ko.id);
    expect(records[0]?.url).toBeNull();

    // gültige https-URL bleibt erhalten.
    const withGood = await svc.addSource(ko.id, "experte", {
      label: "Echte Quelle",
      url: "https://wiki.example/p2",
    });
    expect(withGood.sources[1]?.url).toBe("https://wiki.example/p2");
  });

  it("SCRUM-527 (WP2): create & revise säubern übernommene Quell-URLs (Import-Pfad)", async () => {
    const ko = await service.create(
      base({
        sources: [
          {
            id: "s1",
            label: "Import böse",
            url: "javascript:alert(1)",
            excerpt: null,
            kind: "external",
            peerValidated: false,
            author: "sys",
            at: "2026-01-01T00:00:00.000Z",
          },
          {
            id: "s2",
            label: "Import gut",
            url: "https://intranet.example/doc",
            excerpt: null,
            kind: "external",
            peerValidated: false,
            author: "sys",
            at: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    );
    expect(ko.sources[0]?.url).toBeNull(); // javascript: verworfen
    expect(ko.sources[1]?.url).toBe("https://intranet.example/doc"); // https erhalten

    // Auch beim Revise wird eine untergeschobene aktive URL neutralisiert.
    const revised = await service.revise(
      ko.id,
      {
        sources: [
          {
            id: "s3",
            label: "Revise böse",
            url: "vbscript:msgbox(1)",
            excerpt: null,
            kind: "external",
            peerValidated: false,
            author: "sys",
            at: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
      "experte",
    );
    expect(revised.sources[0]?.url).toBeNull();
  });

  it("FR-CAP-05: Anhänge anfügen und entfernen", async () => {
    const ko = await service.create(base());
    expect(ko.attachments).toEqual([]);
    const withAtt = await service.addAttachment(ko.id, "pedi", {
      name: "foto.jpg",
      mime: "image/jpeg",
      dataUrl: "data:image/jpeg;base64,AAAA",
    });
    expect(withAtt.attachments).toHaveLength(1);
    const attId = withAtt.attachments[0]?.id ?? "";
    const removed = await service.removeAttachment(ko.id, attId, "pedi");
    expect(removed.attachments).toHaveLength(0);
  });

  it("SCRUM-121: neuer Anhang speichert Objekt-Referenz + Vorschau, KEIN großes dataUrl", async () => {
    const ko = await service.create(base());
    const withRef = await service.addAttachment(ko.id, "pedi", {
      name: "foto.jpg",
      mime: "image/jpeg",
      objectId: "obj-123",
      thumbnail: "data:image/jpeg;base64,THUMB",
      size: 2_000_000,
    });
    const a = withRef.attachments[0];
    expect(a?.objectId).toBe("obj-123");
    expect(a?.thumbnail).toBe("data:image/jpeg;base64,THUMB");
    expect(a?.size).toBe(2_000_000);
    expect(a?.dataUrl).toBeUndefined(); // kein Inline-Original im KO-Modell
  });

  it("FR-KO-02: Wissensart setzbar und filterbar", async () => {
    await service.create(base({ type: "best_practice" }));
    await service.create(base({ type: "negativwissen" }));
    const negativ = await service.list({ type: "negativwissen" });
    expect(negativ).toHaveLength(1);
    expect(negativ[0]?.type).toBe("negativwissen");
  });

  it("FR-KO-02: unbekannte Wissensart wird abgewiesen", async () => {
    await expect(service.create(base({ type: "quatsch" as never }))).rejects.toMatchObject({
      code: "INVALID_TYPE",
    });
  });

  it("FR-KO-03: Kategorie und Tags nachträglich änderbar und filterbar", async () => {
    const ko = await service.create(base({ category: "Anlage 1", tags: ["druck"] }));
    await service.updateCategory(ko.id, "Anlage 2");
    await service.updateTags(ko.id, ["druck", "ventil"]);

    const byCategory = await service.list({ category: "Anlage 2" });
    expect(byCategory).toHaveLength(1);
    const byTag = await service.list({ tag: "ventil" });
    expect(byTag).toHaveLength(1);
    const byOldCategory = await service.list({ category: "Anlage 1" });
    expect(byOldCategory).toHaveLength(0);
  });

  it("FR-KO-04: Überarbeiten erhöht Version, setzt Bewertungen zurück, erzeugt History", async () => {
    const ko = await service.create(base());
    // Simuliere vorhandenes Vertrauen aus Validierung.
    const stored = await service.get(ko.id);
    if (!stored) {
      throw new Error("KO fehlt.");
    }
    stored.trust = 7;
    stored.status = "validiert";

    const revised = await service.revise(
      ko.id,
      { statement: "Korrigierte Maßnahme." },
      "controller",
    );
    expect(revised.version).toBe(2);
    expect(revised.trust).toBe(0);
    expect(revised.status).toBe("offen");
    expect(revised.statement).toBe("Korrigierte Maßnahme.");
    expect(revised.history).toHaveLength(2);
    expect(revised.history[1]?.author).toBe("controller");
  });

  it("weist ungültige Validierungsanzahl ab (1–5)", async () => {
    await expect(service.create(base({ neededValidations: 9 }))).rejects.toMatchObject({
      code: "INVALID_NEEDED",
    });
  });
});

describe("KoService — Audit-Verdrahtung (FR-AUD-01)", () => {
  it("protokolliert Anlegen und Überarbeiten", async () => {
    const audit = new AuditService({ repo: new InMemoryAuditRepo() });
    const service = new KoService({ repo: new InMemoryKoRepo(), audit });
    const ko = await service.create(base());
    await service.revise(ko.id, { statement: "neu" }, "controller");
    await service.updateCategory(ko.id, "Anlage 9", "admin");
    await service.setAuthor(ko.id, "bob", "admin");

    const entries = await audit.list();
    expect(entries.map((e) => e.action)).toEqual([
      "ko.created",
      "ko.revised",
      "ko.category-changed",
      "ko.author-transferred",
    ]);
    expect(await audit.verify()).toBe(true);
  });
});

// SCRUM-159: Fake-Pool, der ko_versions nachbildet (INSERT … ON CONFLICT DO NOTHING / SELECT).
function fakeVersionPool() {
  const rows = new Map<
    string,
    { version: number; snapshot: unknown; at: string; author: string; note: string }
  >();
  return {
    query: async (sql: string, params: unknown[] = []) => {
      if (sql.includes("INSERT INTO ko_versions")) {
        const [koId, version, snapshot, at, author, note] = params as [
          string,
          number,
          string,
          string,
          string,
          string,
        ];
        const key = `${koId}#${version}`;
        if (!rows.has(key)) {
          rows.set(key, { version, snapshot: JSON.parse(snapshot), at, author, note });
        }
        return { rows: [] };
      }
      if (sql.includes("SELECT snapshot,version,at,author,note FROM ko_versions")) {
        const [koId] = params as [string];
        const out = [...rows.entries()]
          .filter(([k]) => k.startsWith(`${koId}#`))
          .map(([, v]) => v)
          .sort((a, b) => a.version - b.version);
        return { rows: out };
      }
      return { rows: [] };
    },
  } as unknown as Pool;
}

describe("SCRUM-159: KO-Version-Snapshots", () => {
  it("create erzeugt Version-1-Snapshot", async () => {
    const versions = new InMemoryKoVersionRepo();
    const svc = new KoService({ repo: new InMemoryKoRepo(), versions });
    const ko = await svc.create(base());
    const list = await versions.listByKo(ko.id);
    expect(list).toHaveLength(1);
    expect(list[0]?.version).toBe(1);
    expect(list[0]?.snapshot.title).toBe(ko.title);
    expect(list[0]?.note).toBe("erstellt");
  });

  it("revise erzeugt Version-2-Snapshot; Version-1-Snapshot bleibt unverändert", async () => {
    const versions = new InMemoryKoVersionRepo();
    const svc = new KoService({ repo: new InMemoryKoRepo(), versions });
    const ko = await svc.create(base({ title: "Original" }));
    await svc.revise(ko.id, { title: "Überarbeitet" }, "carla");

    const list = await versions.listByKo(ko.id);
    expect(list.map((v) => v.version)).toEqual([1, 2]);
    // V1 hält den Original-Stand fest (kein stilles Überschreiben durch Revise).
    expect(list[0]?.snapshot.title).toBe("Original");
    expect(list[0]?.snapshot.version).toBe(1);
    expect(list[1]?.snapshot.title).toBe("Überarbeitet");
    expect(list[1]?.snapshot.version).toBe(2);
  });

  it("Snapshot ist eine echte Kopie (spätere KO-Änderungen berühren ihn nicht)", async () => {
    const versions = new InMemoryKoVersionRepo();
    const svc = new KoService({ repo: new InMemoryKoRepo(), versions });
    const ko = await svc.create(base());
    // Folge-Revision verändert das Live-KO; der V1-Snapshot muss Original-Status behalten.
    await svc.revise(ko.id, { statement: "Neue Aussage." }, "carla");
    const v1 = (await versions.listByKo(ko.id))[0];
    expect(v1?.snapshot.status).toBe("offen");
    expect(v1?.snapshot.statement).toBe(base().statement);
  });

  it("ohne Versions-Repo bleibt create/revise funktionsfähig (No-op-Snapshot)", async () => {
    const svc = new KoService({ repo: new InMemoryKoRepo() });
    const ko = await svc.create(base());
    const rev = await svc.revise(ko.id, { title: "X" }, "carla");
    expect(rev.version).toBe(2);
  });

  it("PgKoVersionRepo: Round-Trip + Immutabilität über denselben Fake-Pool", async () => {
    const pool = fakeVersionPool();
    const svc = new KoService({ repo: new InMemoryKoRepo(), versions: new PgKoVersionRepo(pool) });
    const ko = await svc.create(base({ title: "PG-Original" }));
    await svc.revise(ko.id, { title: "PG-Revidiert" }, "carla");

    // Frische Repo-Instanz über denselben Pool → beide Versionen persistent + unveränderlich.
    const list = await new PgKoVersionRepo(pool).listByKo(ko.id);
    expect(list.map((v) => v.version)).toEqual([1, 2]);
    expect(list[0]?.snapshot.title).toBe("PG-Original");
    expect(list[1]?.snapshot.title).toBe("PG-Revidiert");
  });
});

// SCRUM-507 R3: die Revision ist ein Mehrschritt-Mutation (persist + Snapshot + Audit + Status). Schlägt
// ein NACHGELAGERTER Schritt fehl, muss ALLES zurückgerollt werden — kein Teilzustand, keine unauditierte
// Änderung. Versions-Repo, das den Snapshot einer bestimmten Version ablehnt (Downstream-Fehler nach Persist).
function versionsFailingAppendAt(version: number): KoVersionRepo {
  const inner = new InMemoryKoVersionRepo();
  return {
    append: (s: KoVersionSnapshot) =>
      s.version === version ? Promise.reject(new Error("snapshot down")) : inner.append(s),
    listByKo: (id: string) => inner.listByKo(id),
    remove: (id: string, v: number) => inner.remove(id, v),
  };
}

describe("SCRUM-507 R3: transaktionale Revision mit vollständigem Rollback", () => {
  it("Snapshot-Fehler nach Persist → KO (inkl. Status/Trust/Version) vollständig zurückgerollt", async () => {
    const versions = versionsFailingAppendAt(2); // create-Snapshot (v1) ok, Revise-Snapshot (v2) fällt
    const audit = new AuditService({ repo: new InMemoryAuditRepo() });
    const svc = new KoService({ repo: new InMemoryKoRepo(), versions, audit });
    const ko = await svc.create(base({ title: "Original", statement: "Stand 1." }));
    await svc.setValidationState(ko.id, { trust: 90, status: "validiert" });

    await expect(
      svc.revise(ko.id, { title: "Neu", statement: "Stand 2." }, "carla"),
    ).rejects.toThrow("snapshot down");

    const after = await svc.get(ko.id);
    expect(after?.version).toBe(1); // kein Versions-Bump
    expect(after?.title).toBe("Original"); // Inhalt zurückgerollt
    expect(after?.statement).toBe("Stand 1.");
    expect(after?.status).toBe("validiert"); // Status NICHT auf „offen" hängengeblieben
    expect(after?.trust).toBe(90); // Trust NICHT auf 0 hängengeblieben
    // Kein Revise-Audit hinterlassen; nur V1 in der Historie (V2-Snapshot nie committet).
    expect(await audit.list({ action: "ko.revised" })).toHaveLength(0);
    expect((await versions.listByKo(ko.id)).map((v) => v.version)).toEqual([1]);
  });

  it("Audit-Fehler nach Persist+Snapshot → KO zurückgerollt UND V2-Snapshot entfernt", async () => {
    const versions = new InMemoryKoVersionRepo();
    // Wirft NUR beim Revise-Audit; create-Audit (andere Action) bleibt funktionsfähig.
    const throwingAudit = {
      record: async (entry: { action: string }) => {
        if (entry.action === "ko.revised") {
          throw new Error("audit down");
        }
      },
    } as unknown as AuditService;
    const svc = new KoService({ repo: new InMemoryKoRepo(), versions, audit: throwingAudit });
    const ko = await svc.create(base({ title: "Original", statement: "Stand 1." }));

    await expect(
      svc.revise(ko.id, { title: "Neu", statement: "Stand 2." }, "carla"),
    ).rejects.toThrow("audit down");

    const after = await svc.get(ko.id);
    expect(after?.version).toBe(1);
    expect(after?.title).toBe("Original");
    expect(after?.statement).toBe("Stand 1.");
    // V2-Snapshot war geschrieben, wurde beim Rollback ENTFERNT → nur V1 bleibt (keine Geister-Version).
    expect((await versions.listByKo(ko.id)).map((v) => v.version)).toEqual([1]);
  });

  it("Erfolgspfad unverändert: Revise wirkt, Snapshot + Audit vorhanden", async () => {
    const versions = new InMemoryKoVersionRepo();
    const audit = new AuditService({ repo: new InMemoryAuditRepo() });
    const svc = new KoService({ repo: new InMemoryKoRepo(), versions, audit });
    const ko = await svc.create(base({ title: "Original" }));

    const rev = await svc.revise(ko.id, { title: "Neu", statement: "Stand 2." }, "carla");
    expect(rev.version).toBe(2);
    expect(rev.title).toBe("Neu");
    expect((await versions.listByKo(ko.id)).map((v) => v.version)).toEqual([1, 2]);
    expect(await audit.list({ action: "ko.revised" })).toHaveLength(1);
  });
});

describe("SCRUM-161: KO-Version-Snapshots lesbar", () => {
  it("versionsOf liefert gespeicherte Snapshots über den Service", async () => {
    const versions = new InMemoryKoVersionRepo();
    const svc = new KoService({ repo: new InMemoryKoRepo(), versions });
    const ko = await svc.create(base({ title: "V1" }));
    await svc.revise(ko.id, { title: "V2" }, "carla");

    const list = await svc.versionsOf(ko.id);
    expect(list.map((v) => v.version)).toEqual([1, 2]);
    expect(list[0]?.snapshot.title).toBe("V1");
    expect(list[1]?.snapshot.title).toBe("V2");
  });

  it("versionsOf liefert ohne Versions-Repo einen ehrlichen Leerzustand", async () => {
    const svc = new KoService({ repo: new InMemoryKoRepo() });
    const ko = await svc.create(base());
    await expect(svc.versionsOf(ko.id)).resolves.toEqual([]);
  });

  it("versionsOf prüft, ob das KO existiert", async () => {
    const svc = new KoService({
      repo: new InMemoryKoRepo(),
      versions: new InMemoryKoVersionRepo(),
    });
    await expect(svc.versionsOf("missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// SCRUM-160: Fake-Pool, der ko_evidence nachbildet (INSERT … ON CONFLICT DO NOTHING / SELECT).
function fakeEvidencePool() {
  const rows = new Map<string, { data: unknown; created_at: string }>();
  return {
    query: async (sql: string, params: unknown[] = []) => {
      if (sql.includes("INSERT INTO ko_evidence")) {
        const [id, _koId, _koVersion, _kind, data, createdAt] = params as [
          string,
          string,
          number,
          string,
          string,
          string,
        ];
        if (!rows.has(id)) {
          rows.set(id, { data: JSON.parse(data), created_at: createdAt });
        }
        return { rows: [] };
      }
      if (sql.includes("SELECT data FROM ko_evidence")) {
        const [koId] = params as [string];
        const out = [...rows.values()]
          .filter((row) => (row.data as { koId: string }).koId === koId)
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map((row) => ({ data: row.data }));
        return { rows: out };
      }
      return { rows: [] };
    },
  } as unknown as Pool;
}

describe("SCRUM-160: Evidence-Records v1", () => {
  it("addSource erzeugt einen EvidenceRecord", async () => {
    const evidence = new InMemoryEvidenceRepo();
    const svc = new KoService({ repo: new InMemoryKoRepo(), evidence });
    const ko = await svc.create(base());
    const withSource = await svc.addSource(ko.id, "experte", {
      label: "Wikipedia Ventil",
      url: "https://de.wikipedia.org/wiki/Ventil",
      provider: "Wikipedia",
    });

    const records = await evidence.listByKo(ko.id);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      koId: ko.id,
      koVersion: 1,
      kind: "source",
      sourceId: withSource.sources[0]?.id,
      label: "Wikipedia Ventil",
      url: "https://de.wikipedia.org/wiki/Ventil",
      provider: "Wikipedia",
      createdBy: "experte",
    });
  });

  it("addAttachment erzeugt Evidence nur für Object-Store-Anhänge", async () => {
    const evidence = new InMemoryEvidenceRepo();
    const svc = new KoService({ repo: new InMemoryKoRepo(), evidence });
    const ko = await svc.create(base());

    await svc.addAttachment(ko.id, "pedi", {
      name: "inline.jpg",
      mime: "image/jpeg",
      dataUrl: "data:image/jpeg;base64,AAAA",
    });
    expect(await evidence.listByKo(ko.id)).toHaveLength(0);

    const withRef = await svc.addAttachment(ko.id, "pedi", {
      name: "foto.jpg",
      mime: "image/jpeg",
      objectId: "obj-123",
      thumbnail: "data:image/jpeg;base64,THUMB",
      size: 1234,
    });
    const record = (await evidence.listByKo(ko.id))[0];
    expect(record).toMatchObject({
      koId: ko.id,
      koVersion: 1,
      kind: "attachment",
      attachmentId: withRef.attachments.at(-1)?.id,
      objectId: "obj-123",
      label: "foto.jpg",
      mime: "image/jpeg",
      createdBy: "pedi",
    });
  });

  it("evidenceOf liefert ohne Evidence-Repo einen ehrlichen Leerzustand", async () => {
    const svc = new KoService({ repo: new InMemoryKoRepo() });
    const ko = await svc.create(base());
    await expect(svc.evidenceOf(ko.id)).resolves.toEqual([]);
  });

  it("PgEvidenceRepo: Round-Trip + Immutabilität über denselben Fake-Pool", async () => {
    const pool = fakeEvidencePool();
    const evidence = new PgEvidenceRepo(pool);
    const svc = new KoService({ repo: new InMemoryKoRepo(), evidence });
    const ko = await svc.create(base());
    await svc.addSource(ko.id, "experte", { label: "Quelle" });

    const list = await new PgEvidenceRepo(pool).listByKo(ko.id);
    expect(list).toHaveLength(1);
    expect(list[0]?.kind).toBe("source");
    expect(list[0]?.label).toBe("Quelle");

    const first = list[0];
    if (!first) {
      throw new Error("Evidence fehlt.");
    }
    await new PgEvidenceRepo(pool).append({ ...first, label: "Überschrieben?" });
    const again = await new PgEvidenceRepo(pool).listByKo(ko.id);
    expect(again[0]?.label).toBe("Quelle");
  });
});

describe("SCRUM-169: Evidence-Index (recentEvidence)", () => {
  it("normalizeEvidenceLimit: default/max/invalid", () => {
    expect(normalizeEvidenceLimit(undefined)).toBe(DEFAULT_EVIDENCE_LIMIT);
    expect(normalizeEvidenceLimit(0)).toBe(DEFAULT_EVIDENCE_LIMIT);
    expect(normalizeEvidenceLimit(-5)).toBe(DEFAULT_EVIDENCE_LIMIT);
    expect(normalizeEvidenceLimit(Number.NaN)).toBe(DEFAULT_EVIDENCE_LIMIT);
    expect(normalizeEvidenceLimit(10_000)).toBe(MAX_EVIDENCE_LIMIT);
    expect(normalizeEvidenceLimit(7.8)).toBe(7);
  });

  it("recentEvidence liefert KO-übergreifend, jüngste zuerst, defensiv limitiert", async () => {
    const evidence = new InMemoryEvidenceRepo();
    const svc = new KoService({ repo: new InMemoryKoRepo(), evidence });
    const a = await svc.create(base({ title: "KO A xx" }));
    const b = await svc.create(base({ title: "KO B yy" }));
    const older: EvidenceRecord = {
      id: "ev-older",
      koId: a.id,
      koVersion: 1,
      kind: "source",
      sourceId: "src-a",
      label: "Quelle A",
      url: "https://example.org/a",
      createdBy: "experte",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const newer: EvidenceRecord = {
      id: "ev-newer",
      koId: b.id,
      koVersion: 1,
      kind: "source",
      sourceId: "src-b",
      label: "Quelle B",
      createdBy: "experte",
      createdAt: "2026-01-02T00:00:00.000Z",
    };
    await evidence.append(older);
    await evidence.append(newer);

    const all = await svc.recentEvidence();
    expect(all).toHaveLength(2);
    expect(new Set(all.map((r) => r.koId))).toEqual(new Set([a.id, b.id]));
    // jüngste zuerst (Quelle B wurde zuletzt angelegt)
    expect(all[0]?.label).toBe("Quelle B");

    const limited = await svc.recentEvidence(1);
    expect(limited).toHaveLength(1);
    expect(limited[0]?.label).toBe("Quelle B");
  });

  it("recentEvidence enthält nur Metadaten — kein dataUrl/raw object data", async () => {
    const evidence = new InMemoryEvidenceRepo();
    const svc = new KoService({ repo: new InMemoryKoRepo(), evidence });
    const ko = await svc.create(base());
    await svc.addAttachment(ko.id, "pedi", {
      name: "foto.jpg",
      mime: "image/jpeg",
      objectId: "obj-7",
      thumbnail: "data:image/jpeg;base64,THUMB",
      size: 99,
    });
    const records = await svc.recentEvidence();
    expect(records).toHaveLength(1);
    const json = JSON.stringify(records);
    expect(json).not.toContain("dataUrl");
    expect(json).not.toContain("data:image");
    expect(json).not.toContain("THUMB");
    expect(records[0]).toMatchObject({ kind: "attachment", objectId: "obj-7", mime: "image/jpeg" });
  });

  it("recentEvidence ohne Evidence-Repo → ehrlicher Leerzustand", async () => {
    const svc = new KoService({ repo: new InMemoryKoRepo() });
    await expect(svc.recentEvidence()).resolves.toEqual([]);
  });
});

// SCRUM-358 / AG-14-SERVER-TRUST: serverseitige Wahrheitskonflikt-Wirkung auf KO-Status/Trust.
describe("KoService.markTruthConflictReview", () => {
  it("validiertes KO → Status offen + Trust konservativ gesenkt (kein Reset auf 0)", async () => {
    const service = new KoService({ repo: new InMemoryKoRepo() });
    const ko = await service.create(base());
    await service.setValidationState(ko.id, { trust: 100, status: "validiert" });

    const reviewed = await service.markTruthConflictReview(ko.id, "controller");
    expect(reviewed?.status).toBe("offen");
    expect(reviewed?.trust).toBe(100 - TRUTH_CONFLICT_TRUST_PENALTY);
    expect(reviewed?.trust).toBeGreaterThan(0); // eingeschränkt, nicht „falsch"
  });

  it("offenes KO bleibt unverändert (No-op); Trust nie negativ", async () => {
    const service = new KoService({ repo: new InMemoryKoRepo() });
    const open = await service.create(base());
    const sameOpen = await service.markTruthConflictReview(open.id);
    expect(sameOpen?.status).toBe("offen");
    expect(sameOpen?.trust).toBe(0);

    // Validiertes KO mit sehr niedrigem Trust → Floor bei 0 (keine negative Strafe).
    const low = await service.create(base({ title: "Low-Trust-KO" }));
    await service.setValidationState(low.id, { trust: 5, status: "validiert" });
    const reviewedLow = await service.markTruthConflictReview(low.id);
    expect(reviewedLow?.trust).toBe(0);
  });

  it("unbekanntes KO → No-op (undefined), kein Fehler", async () => {
    const service = new KoService({ repo: new InMemoryKoRepo() });
    await expect(service.markTruthConflictReview("does-not-exist")).resolves.toBeUndefined();
  });
});
