import type { Pool } from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gemeinsameQuellrechte } from "../../services/app/src/dubletten-zusammenfuehrung";
import { journalZeileFuer } from "../../services/app/src/speicher-vorgang";
import { type TxContext, withPgTx } from "../../services/db-tx";
import type { KnowledgeObject } from "../../services/knowledge-object";
import {
  InMemoryKoRepo,
  InMemoryKoVersionRepo,
  KoError,
  KoService,
} from "../../services/knowledge-object";
import { PgKoRepo } from "../../services/knowledge-object/src/repo-pg";
import {
  type FrischeBuehne,
  baueFrischeBuehne,
  schliesseBuehnen,
} from "../beta-rollenabnahme/buehne";

afterEach(async () => {
  vi.restoreAllMocks();
  await schliesseBuehnen();
});
const offen = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const kopf = (
  w: FrischeBuehne,
  rolle: "experte" | "controller" | "admin" | "viewer" = "controller",
) => ({ authorization: `Bearer ${w.sitzung[rolle]}` });
const daten = {
  type: "best_practice" as const,
  category: "Anlage",
  confidentiality: "intern" as const,
  title: "Wartung",
  statement: "Ausgangstext",
  conditions: [],
  measures: [],
};
async function paar(w: FrischeBuehne) {
  const a = await w.services.ko.create({ ...daten, author: w.konto.experte.id });
  const b = await w.services.ko.create({
    ...daten,
    title: "Gegenseite",
    statement: "Zusatz aus B",
    author: w.konto.experte.id,
  });
  await w.services.aiCheckWorker?.idle();
  const befund = await w.services.overlaps.createAuto(
    {
      koA: a.id,
      koB: b.id,
      relation: "teilweise",
      aspects: [],
      eigenanteilA: "",
      eigenanteilB: "",
      recommendation: "zusammenfuehren_pruefen",
    },
    { trigger: "manual", method: "deterministic", lexicalScore: 0.8 },
  );
  return {
    a,
    b,
    befund,
    auftrag: {
      fuehrend: { id: a.id, version: a.version },
      aufgehend: { id: b.id, version: b.version },
      titel: "fuehrend",
      kernaussage: "aufgehend",
      bedingungen: [],
      massnahmen: [],
      quellen: [],
      bestaetigt: true,
    },
  };
}
const DOCX_OHNE_BILDER =
  "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";

describe("W4.5 reale Schreibwege", () => {
  it("Word-DOCX-Anlage quittiert dieselbe Kennung mit demselben Entwurf und Dokumentbezug", async () => {
    const w = await baueFrischeBuehne();
    const payload = {
      name: "Probe.docx",
      data: DOCX_OHNE_BILDER,
      operationId: "docx-w45-antwortverlust-001",
    };
    const post = (p: object) =>
      w.app.inject({
        method: "POST",
        url: "/api/drafts/from-docx",
        headers: kopf(w, "experte"),
        payload: p,
      });
    const a = await post(payload);
    const b = await post(payload);
    expect(a.statusCode, a.body).toBe(201);
    expect(b.statusCode, b.body).toBe(200);
    expect(b.json().id).toBe(a.json().id);
    expect(b.json().dokumentHerkunft).toEqual(a.json().dokumentHerkunft);
    expect((await post({ ...payload, operationId: 5 })).statusCode).toBe(400);
  });

  it.each(["einschraenken", "entziehen"])(
    "Merge liest Rechte erst hinter dem gemeinsamen Sperrport frisch: %s",
    async (art) => {
      const w = await baueFrischeBuehne();
      const p = await paar(w);
      const imVorgang = w.services.ko.imPaarVorgang.bind(w.services.ko);
      vi.spyOn(w.services.ko, "imPaarVorgang").mockImplementationOnce(
        async <T>(kontext: object, fn: (tx: TxContext) => Promise<T>): Promise<T> => {
          // Simuliert den zweiten Serverprozess vor dem Erwerb der PG-Zeilensperre:
          // ein echter CAS-Repo-Write, keine erfundene erfolgreiche Antwort.
          const b = await w.repos.koRepo.findById(p.b.id);
          if (!b) throw new Error("Gegenseite fehlt");
          await w.repos.koRepo.update({
            ...b,
            category: "Neue Einordnung",
            quellrechte: {
              stufe: "intern",
              leser:
                art === "entziehen"
                  ? [w.konto.experte.id]
                  : [w.konto.experte.id, w.konto.controller.id],
            },
          });
          return imVorgang(kontext, fn);
        },
      );
      const r = await w.app.inject({
        method: "POST",
        url: `/api/duplicates/${p.befund.id}/merge`,
        headers: kopf(w),
        payload: p.auftrag,
      });
      expect(r.statusCode, r.body).toBe(art === "entziehen" ? 404 : 200);
      const a = await w.services.ko.get(p.a.id);
      if (art === "entziehen") {
        expect(a?.version).toBe(p.a.version);
        expect((await w.services.ko.get(p.b.id))?.mergedInto).toBeUndefined();
      } else
        expect(a?.quellrechte?.leser?.sort()).toEqual(
          [w.konto.experte.id, w.konto.controller.id].sort(),
        );
      expect((await w.services.ko.get(p.b.id))?.category).toBe("Neue Einordnung");
    },
  );

  it("erfindet beim Zusammenführen keine Einstufung für historischen ungeklärten Bestand", () => {
    const ungeklärt = { confidentiality: undefined } as unknown as KnowledgeObject;
    const bekannt = { confidentiality: "intern" } as KnowledgeObject;
    expect(() => gemeinsameQuellrechte(ungeklärt, bekannt)).toThrow("ungeklärte Schutzstufe");
  });

  it("reguläre Anlage bindet Wiederholung an Konto und semantischen Inhalt", async () => {
    const w = await baueFrischeBuehne();
    const payload = { ...daten, operationId: "create-w45-account-001" };
    const post = (rolle: "experte" | "controller", p = payload) =>
      w.app.inject({
        method: "POST",
        url: "/api/kos",
        headers: kopf(w, rolle),
        payload: p,
      });
    const [a, b] = await Promise.all([post("experte"), post("experte")]);
    expect(a.statusCode).toBe(201);
    expect(b.statusCode).toBe(201);
    expect(a.json().id).toBe(b.json().id);
    const fremd = await post("controller");
    expect(fremd.statusCode).toBe(201);
    expect(fremd.json().id).not.toBe(a.json().id);
    expect(fremd.json().author).toBe(w.konto.controller.id);
    const anders = await post("experte", { ...payload, statement: "Geänderter Inhalt" });
    expect(anders.statusCode).toBe(409);
    expect((await w.services.ko.get(a.json().id))?.statement).toBe(daten.statement);
  });

  it.each([undefined, "verschieden", "gleich"])(
    "Promotion verbraucht einen Entwurf genau einmal: %s",
    async (art) => {
      const w = await baueFrischeBuehne();
      const d = await w.services.capture.createDraft(daten, w.konto.experte.id);
      const create = w.services.ko.create.bind(w.services.ko);
      const erreicht = offen();
      const frei = offen();
      vi.spyOn(w.services.ko, "create").mockImplementationOnce(async (...args) => {
        erreicht.resolve();
        await frei.promise;
        return create(...args);
      });
      const post = (n: number) =>
        w.app.inject({
          method: "POST",
          url: `/api/drafts/${d.id}/promote`,
          headers: kopf(w, "experte"),
          payload: art ? { operationId: `promote-w45-${art}-${art === "gleich" ? 0 : n}` } : {},
        });
      const erster = post(1);
      await erreicht.promise;
      const zweiter = post(2);
      frei.resolve();
      const resultate = await Promise.all([erster, zweiter]);
      expect(resultate.map((r) => r.statusCode).sort()).toEqual(
        art === "gleich" ? [200, 201] : [201, 404],
      );
      expect(await w.services.ko.list()).toHaveLength(1);
      expect(await w.services.capture.getDraft(d.id)).toBeUndefined();
    },
  );

  it("zwei Anlagen und gleichzeitiges Entfernen/Anfügen verlieren keine Datei", async () => {
    const w = await baueFrischeBuehne();
    const a = await w.services.ko.create({ ...daten, author: w.konto.experte.id });
    const add = (name: string) =>
      w.services.ko.addAttachment(a.id, w.konto.experte.id, { name, mime: "text/plain" });
    await Promise.all([add("eins.txt"), add("zwei.txt")]);
    let aktuell = (await w.services.ko.get(a.id))!;
    expect(aktuell.attachments.map((x) => x.name).sort()).toEqual(["eins.txt", "zwei.txt"]);
    const eins = aktuell.attachments.find((x) => x.name === "eins.txt")!;
    await Promise.all([
      w.services.ko.removeAttachment(a.id, eins.id, w.konto.experte.id),
      add("drei.txt"),
    ]);
    aktuell = (await w.services.ko.get(a.id))!;
    expect(aktuell.attachments.map((x) => x.name).sort()).toEqual(["drei.txt", "zwei.txt"]);
  });

  it("STALE_WRITE bleibt 409 und der legitime erneute Anlagenaufruf gelingt", async () => {
    const w = await baueFrischeBuehne();
    const a = await w.services.ko.create({ ...daten, author: w.konto.experte.id });
    vi.spyOn(w.repos.koRepo, "update").mockRejectedValueOnce(
      new KoError("STALE_WRITE", "Konkurrierender Stand"),
    );
    const erster = await w.app.inject({
      method: "PUT",
      url: `/api/kos/${a.id}`,
      headers: kopf(w, "experte"),
      payload: {
        action: "attach",
        attachment: { name: "bild.png", mime: "image/png", dataUrl: "data:image/png;base64,YQ==" },
      },
    });
    expect(erster.statusCode, erster.body).toBe(409);
    await w.services.ko.addAttachment(a.id, w.konto.experte.id, {
      name: "datei.txt",
      mime: "text/plain",
    });
    expect((await w.services.ko.get(a.id))?.attachments).toHaveLength(1);
  });

  it("Rebuild verwendet Kategorie und Tags nach verzögerter Bestandslesung frisch", async () => {
    const repo = new InMemoryKoRepo();
    const ko = new KoService({ repo });
    const a = await ko.create({ ...daten, author: "autor" });
    const gelesen = offen();
    const weiter = offen();
    const list = repo.list.bind(repo);
    vi.spyOn(repo, "list").mockImplementationOnce(async (...args) => {
      const alt = await list(...args);
      gelesen.resolve();
      await weiter.promise;
      return alt;
    });
    const lauf = ko.rebuildSearchProjections();
    await gelesen.promise;
    await ko.updateCategory(a.id, "Neue Kategorie", "autor");
    await ko.updateTags(a.id, ["Neues Tag"], "autor");
    weiter.resolve();
    await lauf;
    expect(await ko.metadataProjectionOf(a.id)).toMatchObject({
      categoryText: "Neue Kategorie",
      tagText: "Neues Tag",
    });
  });

  it("PG-Leseport sperrt die KO-Zeile auf genau dem vorhandenen Transaktionsclient", async () => {
    const client = Object.assign(new (await import("node:events")).EventEmitter(), {
      query: vi.fn(async (_sql: string, _params?: unknown[]) => ({ rows: [], rowCount: 0 })),
      release: vi.fn(),
    });
    const pool = {
      connect: vi.fn(async () => client),
      query: vi.fn(() => {
        throw new Error("Fremde Verbindung");
      }),
    } as unknown as Pool;
    const repo = new PgKoRepo(pool);
    await withPgTx(pool, async (tx) => {
      await repo.findById("ko", tx, true);
    });
    expect(client.query.mock.calls.map((c) => c[0])).toEqual([
      "BEGIN",
      "SELECT data FROM kos WHERE id=$1 FOR UPDATE",
      "COMMIT",
    ]);
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("Rebuild reicht denselben Tx durch frische Lesung und beide Projektionen", async () => {
    const repo = new InMemoryKoRepo();
    const versions = new InMemoryKoVersionRepo();
    const tx = { brand: "TxContext" } as TxContext;
    const ko = new KoService({ repo, versions, withTx: async (fn) => fn(tx) });
    const a = await ko.create({ ...daten, author: "autor" });
    const leser = vi.spyOn(repo, "findById");
    const projektionen = (
      ko as unknown as {
        searchProjections: {
          replace: (...args: unknown[]) => Promise<void>;
          metadata: { upsert: (...args: unknown[]) => Promise<unknown> };
        };
      }
    ).searchProjections;
    const replace = vi.spyOn(projektionen, "replace");
    const metadata = vi.spyOn(projektionen.metadata, "upsert");
    await ko.rebuildSearchProjections();
    expect(leser).toHaveBeenCalledWith(a.id, tx, true);
    expect(replace.mock.calls.at(-1)?.[1]).toBe(tx);
    expect(metadata.mock.calls.at(-1)?.[1]).toBe(tx);
  });

  it("zweite Vorschlagsannahme bleibt 409; erste Fassung und offener zweiter Vorschlag bleiben", async () => {
    const w = await baueFrischeBuehne();
    const a = await w.services.ko.create({ ...daten, author: w.konto.admin.id });
    const put = (rolle: "experte" | "controller" | "admin", payload: Record<string, unknown>) =>
      w.app.inject({ method: "PUT", url: `/api/kos/${a.id}`, headers: kopf(w, rolle), payload });
    expect((await put("admin", { action: "admin-validate" })).statusCode).toBe(200);
    for (const rolle of ["experte", "controller"] as const)
      expect(
        (
          await put(rolle, {
            action: "propose",
            proposal: { statement: rolle, baseVersion: a.version, origin: "word_addin" },
          })
        ).statusCode,
      ).toBe(200);
    const vor = (await w.services.ko.get(a.id))!;
    const [p, q] = vor.proposals!;
    expect(
      (
        await put("admin", {
          action: "decide-proposal",
          proposalId: p!.id,
          decision: "uebernehmen",
          expectedVersion: a.version,
        })
      ).statusCode,
    ).toBe(200);
    const neu = (await w.services.ko.get(a.id))!;
    expect(
      (
        await put("admin", {
          action: "decide-proposal",
          proposalId: q!.id,
          decision: "uebernehmen",
          expectedVersion: neu.version,
        })
      ).statusCode,
    ).toBe(409);
    const ende = (await w.services.ko.get(a.id))!;
    expect(ende.statement).toBe(p!.statement);
    expect(ende.version).toBe(neu.version);
    expect(ende.proposals?.find((x) => x.id === q!.id)?.status).toBe("offen");
  });

  it("Merge schneidet Leserlisten, erhält höhere Stufe und historische Gegenseite", async () => {
    const w = await baueFrischeBuehne();
    const p = await paar(w);
    await w.services.ko.setQuellrechte(
      p.a.id,
      { stufe: "intern", leser: [w.konto.controller.id, w.konto.experte.id, w.konto.admin.id] },
      "system",
    );
    await w.services.ko.setQuellrechte(
      p.b.id,
      { stufe: "intern", leser: [w.konto.controller.id, w.konto.experte.id] },
      "system",
    );
    const res = await w.app.inject({
      method: "POST",
      url: `/api/duplicates/${p.befund.id}/merge`,
      headers: kopf(w),
      payload: p.auftrag,
    });
    expect(res.statusCode, res.body).toBe(200);
    const a = (await w.services.ko.get(p.a.id))!;
    expect(a.quellrechte?.leser?.sort()).toEqual(
      [w.konto.controller.id, w.konto.experte.id].sort(),
    );
    expect(
      (await w.app.inject({ method: "GET", url: `/api/kos/${a.id}`, headers: kopf(w, "viewer") }))
        .statusCode,
    ).toBe(404);
    expect((await w.services.ko.get(p.b.id))?.statement).toBe(p.b.statement);
    expect(
      gemeinsameQuellrechte(a, {
        ...a,
        confidentiality: "streng_vertraulich",
        quellrechte: { stufe: "vertraulich", leser: [] },
      }),
    ).toEqual({ stufe: "streng_vertraulich", leser: [] });
  });

  it.each(["gegenrichtung", "fremde-revision"])(
    "Merge serialisiert echte externe Nebenaufrufe: %s",
    async (art) => {
      const w = await baueFrischeBuehne();
      const p = await paar(w);
      const bereit = offen();
      const frei = offen();
      const revise = w.services.ko.revise.bind(w.services.ko);
      vi.spyOn(w.services.ko, "revise").mockImplementationOnce(async (...args) => {
        const r = await revise(...args);
        bereit.resolve();
        await frei.promise;
        return r;
      });
      const erster = w.app.inject({
        method: "POST",
        url: `/api/duplicates/${p.befund.id}/merge`,
        headers: kopf(w),
        payload: p.auftrag,
      });
      await bereit.promise;
      const zweiter =
        art === "gegenrichtung"
          ? w.app.inject({
              method: "POST",
              url: `/api/duplicates/${p.befund.id}/merge`,
              headers: kopf(w),
              payload: {
                ...p.auftrag,
                fuehrend: p.auftrag.aufgehend,
                aufgehend: p.auftrag.fuehrend,
              },
            })
          : w.app.inject({
              method: "PUT",
              url: `/api/kos/${p.b.id}`,
              headers: kopf(w, "experte"),
              payload: {
                action: "revise",
                changes: {
                  statement: "Zeitgleich neuer Text",
                  bodyHtml: "<p>Zeitgleich neuer Text</p>",
                },
                expectedVersion: p.b.version,
              },
            });
      frei.resolve();
      const [a, b] = await Promise.all([erster, zweiter]);
      expect(a.statusCode, a.body).toBe(200);
      if (art === "gegenrichtung") expect(b.statusCode).toBe(409);
      else expect(b.statusCode).toBe(409);
      expect((await w.services.ko.get(p.b.id))?.mergedInto?.koId).toBe(p.a.id);
      expect((await w.services.ko.get(p.a.id))?.statement).toBe(p.b.statement);
    },
  );

  it.each(["ko-update", "snapshot", "overlap-update", "merge-audit", "journal-abschluss"])(
    "Merge rollt alle Träger bei Ausfall %s zurück",
    async (stelle) => {
      const w = await baueFrischeBuehne();
      const p = await paar(w);
      const vorherA = await w.repos.koRepo.findById(p.a.id);
      const vorherB = await w.repos.koRepo.findById(p.b.id);
      const belege = (await w.services.audit.list({})).map((x) => x.seq);
      if (stelle === "ko-update") {
        const update = w.repos.koRepo.update.bind(w.repos.koRepo);
        vi.spyOn(w.repos.koRepo, "update").mockImplementation(async (...args) => {
          if (args[0].id === p.b.id) throw new Error("abbruch");
          return update(...args);
        });
      } else if (stelle === "snapshot")
        vi.spyOn(w.repos.koVersions, "append").mockRejectedValueOnce(new Error("abbruch"));
      else if (stelle === "overlap-update")
        vi.spyOn(w.repos.overlapRepo, "update").mockRejectedValueOnce(new Error("abbruch"));
      else if (stelle === "journal-abschluss") {
        const close = w.services.overlaps.closeAsMerged.bind(w.services.overlaps);
        vi.spyOn(w.services.overlaps, "closeAsMerged").mockImplementation(async (...args) => {
          const wert = await close(...args);
          journalZeileFuer([args[4]], { probe: "journal-abschluss" }, () => {
            throw new Error("abbruch");
          });
          return wert;
        });
      } else {
        const record = w.services.audit.record.bind(w.services.audit);
        vi.spyOn(w.services.audit, "record").mockImplementation(async (...args) => {
          if (args[0].action === "overlap.merge-completed") throw new Error("abbruch");
          return record(...args);
        });
      }
      const r = await w.app.inject({
        method: "POST",
        url: `/api/duplicates/${p.befund.id}/merge`,
        headers: kopf(w),
        payload: p.auftrag,
      });
      expect(r.statusCode).toBe(500);
      expect(await w.repos.koRepo.findById(p.a.id)).toEqual(vorherA);
      expect(await w.repos.koRepo.findById(p.b.id)).toEqual(vorherB);
      expect((await w.services.overlaps.get(p.befund.id))?.status).toBe("offen");
      expect(
        (await w.services.ko.versionsOf(p.a.id)).some((x) => x.version === p.a.version + 1),
      ).toBe(false);
      expect(await w.services.ko.searchProjectionOf(p.a.id, p.a.version + 1)).toBeUndefined();
      expect((await w.services.audit.list({})).map((x) => x.seq)).toEqual(belege);
    },
  );

  it("Merge-Wiederholung bindet Konto, gerichtetes Paar und Auftrag; aktive Wege lassen B weg", async () => {
    const w = await baueFrischeBuehne();
    const p = await paar(w);
    await w.services.ko.setValidationState(p.b.id, { status: "validiert", trust: 99 });
    const auftrag = { ...p.auftrag, operationId: "merge-w45-identisch-001" };
    const post = (payload: Record<string, unknown>, rolle: "controller" | "admin" = "controller") =>
      w.app.inject({
        method: "POST",
        url: `/api/duplicates/${p.befund.id}/merge`,
        headers: kopf(w, rolle),
        payload,
      });
    const a = await post(auftrag);
    const b = await post(auftrag);
    expect(a.statusCode, a.body).toBe(200);
    expect(b.statusCode, b.body).toBe(200);
    expect(b.json().fuehrend).toEqual(a.json().fuehrend);
    expect((await post({ ...auftrag, vermerk: "anderer Auftrag" })).statusCode).toBe(409);
    expect((await post(auftrag, "admin")).statusCode).toBe(409);
    expect((await w.services.ko.list()).some((k) => k.id === p.b.id)).toBe(false);
    expect((await w.services.ko.get(p.b.id))?.statement).toBe(p.b.statement);
    const graph = await w.app.inject({
      method: "GET",
      url: "/api/graph",
      headers: kopf(w, "admin"),
    });
    expect(graph.statusCode, graph.body).toBe(200);
    expect(graph.body).toContain(p.a.id);
    expect(graph.body).not.toContain(p.b.id);
    const lage = await w.app.inject({
      method: "GET",
      url: "/api/management/snapshot",
      headers: kopf(w, "admin"),
    });
    expect(lage.statusCode, lage.body).toBe(200);
    expect(lage.json().overview.totalKos).toBe(1);
    await w.services.lifecycle.requestRevalidation(p.b.id);
    expect(await w.services.lifecycle.pendingRevalidation()).not.toContain(p.b.id);
    expect(
      (
        await w.app.inject({
          method: "POST",
          url: "/api/output/generate",
          headers: kopf(w),
          payload: { kind: "instruction", koIds: [p.b.id] },
        })
      ).statusCode,
    ).toBeGreaterThanOrEqual(400);
  });
});
