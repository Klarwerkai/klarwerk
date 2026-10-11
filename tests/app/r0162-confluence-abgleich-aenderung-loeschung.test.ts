// ================================================================================================
// R-0162 — ÄNDERT ODER LÖSCHT JEMAND EINE SEITE IN DER QUELLE, ZIEHT KLARA BEIM NÄCHSTEN ABGLEICH NACH
// ================================================================================================
//
// Gemessen wird der ganze Produktweg innerhalb des Servers:
//   echter Confluence-Adapter (fetch-Attrappe an der Netzgrenze) → runConfluenceImport →
//   Review-Queue → Annehmen (acceptToKo) → echter KoService auf InMemoryKoRepo.
//
// ÄNDERUNG: höhere sourceVersion → neuer Kandidat → Annehmen revidiert DASSELBE Wissensobjekt.
// LÖSCHUNG: fehlt eine Seite im VOLLSTÄNDIGEN Lauf und bestätigt die Quelle das je Id (404 oder
// nicht mehr `current`), wandert das Wissensobjekt in den Papierkorb — wiederherstellbar.
// Die Gegenfälle pinnen, dass „fehlt in der Liste" allein nie etwas löscht.
import { describe, expect, it, vi } from "vitest";
import { runConfluenceImport } from "../../services/app/src/confluence-import";
import type { ConfluencePage } from "../../services/confluence/src/rest-client";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { InMemoryCandidateRepo, LibraryService } from "../../services/library-analytics";
import { adapterFromConfig } from "../support/confluence-adapter";

function antwort(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function seite(id: string, title: string, version = 1, status?: string): ConfluencePage {
  return {
    id,
    title,
    ...(status ? { status } : {}),
    body: { storage: { value: `<p>${title}</p>` } },
    version: { number: version },
  };
}

/**
 * Die Quelle: `liste` ist, was das Space-Listing liefert; `jeId` beantwortet den Einzelabruf
 * (Seite, 404 oder ein HTTP-Status als Fehler). Fehlt eine Id in `jeId`, gilt das Listing.
 * `{ roh200 }` antwortet mit HTTP 200 und genau diesem Body (z. B. `{}` oder `null`).
 */
interface Quelle {
  liste: ConfluencePage[];
  jeId?: Record<string, ConfluencePage | 404 | 500 | { roh200: unknown }>;
}

function adapterFuer(quelle: Quelle, spaceKey = "K") {
  const einzelabrufe: string[] = [];
  const fetchFn = (async (url: string | URL | Request) => {
    const u = new URL(String(url));
    // R-0163: der Importeur liest je Seite auch die Anhangsliste. Diese Quelle führt keine
    // Anhänge — sie antwortet darauf wie Confluence mit einer leeren Liste und nicht mit dem
    // Space-Listing (das wären Seiten ohne Abrufweg, also eine unbrauchbare Anhangsliste).
    if (u.pathname.endsWith("/child/attachment")) {
      return antwort(200, { results: [] });
    }
    const treffer = /\/rest\/api\/content\/([^/]+)$/.exec(u.pathname);
    if (!treffer) {
      return antwort(200, { results: quelle.liste });
    }
    const id = decodeURIComponent(treffer[1] ?? "");
    einzelabrufe.push(id);
    const vorgabe = quelle.jeId?.[id];
    if (vorgabe === 404) {
      return antwort(404, { message: "not found" });
    }
    if (vorgabe === 500) {
      return antwort(500, {});
    }
    if (vorgabe && "roh200" in vorgabe) {
      return antwort(200, vorgabe.roh200);
    }
    const page = vorgabe ?? quelle.liste.find((p) => p.id === id);
    return page ? antwort(200, page) : antwort(404, { message: "not found" });
  }) as unknown as typeof fetch;
  const adapter = adapterFromConfig({
    baseUrl: "https://acme.atlassian.net/wiki",
    email: "svc@acme.example",
    apiToken: "read-only-tok",
    spaceKey,
    fetchFn,
  });
  return { adapter, einzelabrufe };
}

function dienst() {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  const library = new LibraryService({
    koService,
    candidates: new InMemoryCandidateRepo(),
    externalUpsert: true,
  });
  return { koService, library };
}

type Dienst = ReturnType<typeof dienst>;

async function abgleich(
  d: Dienst,
  adapter: ReturnType<typeof adapterFuer>["adapter"],
  dryRun = false,
) {
  return runConfluenceImport({
    adapter,
    library: d.library,
    koService: d.koService,
    dryRun,
    actor: "r0162@test",
  });
}

/** Der Mensch nimmt alle offenen Kandidaten an — der reguläre Review-Weg. */
async function nimmAlleAn(d: Dienst): Promise<void> {
  for (const c of await d.library.listImportCandidates()) {
    if (c.status === "neu") {
      await d.library.reviewImportCandidate(c.id, "accept", "pedi");
    }
  }
}

async function traeger(d: Dienst, externalId: string) {
  return (await d.koService.list()).filter((ko) =>
    (ko.sources ?? []).some((s) => s.externalId === externalId),
  );
}

/** Ausgangsbestand: p1 und p2 aus Space K sind importiert und angenommen. */
async function bestand() {
  const d = dienst();
  const { adapter } = adapterFuer({ liste: [seite("p1", "Pumpe warten"), seite("p2", "Filter")] });
  const erst = await abgleich(d, adapter);
  expect(erst.imported).toBe(2);
  await nimmAlleAn(d);
  expect(await d.koService.list()).toHaveLength(2);
  return d;
}

describe("R-0162 · Änderungen der Quelle werden beim nächsten Abgleich nachgezogen", () => {
  it("A1: eine geänderte Seite (höhere Version) revidiert DASSELBE Wissensobjekt", async () => {
    const d = await bestand();
    const [vorher] = await traeger(d, "p1");
    expect(vorher?.title).toBe("Pumpe warten");

    const { adapter } = adapterFuer({
      liste: [seite("p1", "Pumpe warten und prüfen", 2), seite("p2", "Filter")],
    });
    const lauf = await abgleich(d, adapter);
    expect(lauf.imported).toBe(1);
    expect(lauf.perPage.find((p) => p.ref === "p1")?.status).toBe("imported");
    expect(lauf.perPage.find((p) => p.ref === "p2")?.status).toBe("skipped");
    await nimmAlleAn(d);

    const nachher = await traeger(d, "p1");
    expect(nachher).toHaveLength(1);
    expect(nachher[0]?.id).toBe(vorher?.id);
    expect(nachher[0]?.title).toBe("Pumpe warten und prüfen");
    expect(nachher[0]?.sources?.find((s) => s.externalId === "p1")?.sourceVersion).toBe(2);
    expect(await d.koService.list()).toHaveLength(2);
  });

  it("A2: eine unveränderte Seite erzeugt keinen neuen Kandidaten (idempotent)", async () => {
    const d = await bestand();
    const { adapter } = adapterFuer({
      liste: [seite("p1", "Pumpe warten"), seite("p2", "Filter")],
    });
    const lauf = await abgleich(d, adapter);
    expect(lauf.imported).toBe(0);
    expect(lauf.removed).toBe(0);
    expect(lauf.removalChecked).toBe(true);
  });
});

describe("R-0162 · Löschungen der Quelle werden beim nächsten Abgleich nachgezogen", () => {
  it("L1: eine in der Quelle gelöschte Seite legt ihr Wissensobjekt in den Papierkorb", async () => {
    const d = await bestand();
    const [p2] = await traeger(d, "p2");
    const { adapter, einzelabrufe } = adapterFuer({
      liste: [seite("p1", "Pumpe warten")],
      jeId: { p2: 404 },
    });
    const lauf = await abgleich(d, adapter);

    expect(lauf.removalChecked).toBe(true);
    expect(lauf.removed).toBe(1);
    expect(lauf.removalOpen).toBe(0);
    expect(lauf.perPage.find((p) => p.ref === "p2")?.status).toBe("removed");
    // Gegenprobe genau für die fehlende Seite, nicht für die vorhandene.
    expect(einzelabrufe).toEqual(["p2"]);
    expect(await traeger(d, "p2")).toHaveLength(0);
    expect(await traeger(d, "p1")).toHaveLength(1);
    // Wiederherstellbar: Papierkorb, keine Endlöschung.
    const papierkorb = await d.koService.trashed();
    expect(papierkorb.map((t) => t.id)).toEqual([p2?.id]);
    expect(papierkorb[0]?.deletedBy).toBe("r0162@test");
  });

  it("L2: eine archivierte/getrashte Seite (status ≠ current) gilt ebenfalls als gelöscht", async () => {
    const d = await bestand();
    const { adapter } = adapterFuer({
      liste: [seite("p1", "Pumpe warten")],
      jeId: { p2: seite("p2", "Filter", 1, "trashed") },
    });
    const lauf = await abgleich(d, adapter);
    expect(lauf.removed).toBe(1);
    expect(await traeger(d, "p2")).toHaveLength(0);
  });

  it("L3: der nächste Abgleich nach der Löschung ist ruhig (kein zweites Nachziehen)", async () => {
    const d = await bestand();
    const quelle = { liste: [seite("p1", "Pumpe warten")], jeId: { p2: 404 as const } };
    await abgleich(d, adapterFuer(quelle).adapter);
    const zweiter = await abgleich(d, adapterFuer(quelle).adapter);
    expect(zweiter.removed).toBe(0);
    expect(zweiter.removalOpen).toBe(0);
    expect(await d.koService.trashed()).toHaveLength(1);
  });

  it("L4: der Probelauf meldet die Löschung, schreibt aber nichts", async () => {
    const d = await bestand();
    const { adapter } = adapterFuer({ liste: [seite("p1", "Pumpe warten")], jeId: { p2: 404 } });
    const lauf = await abgleich(d, adapter, true);
    expect(lauf.removed).toBe(1);
    expect(lauf.perPage.find((p) => p.ref === "p2")?.status).toBe("removed");
    expect(await traeger(d, "p2")).toHaveLength(1);
    expect(await d.koService.trashed()).toHaveLength(0);
  });
});

describe("R-0162 · Gegenfälle — „fehlt in der Liste“ allein löscht nie", () => {
  it("G1: liefert die Quelle die Seite je Id noch (current), bleibt alles stehen", async () => {
    const d = await bestand();
    const { adapter } = adapterFuer({
      liste: [seite("p1", "Pumpe warten")],
      jeId: { p2: seite("p2", "Filter", 1, "current") },
    });
    const lauf = await abgleich(d, adapter);
    expect(lauf.removed).toBe(0);
    expect(lauf.removalOpen).toBe(0);
    expect(await traeger(d, "p2")).toHaveLength(1);
  });

  it("G2: scheitert die Gegenprobe, wird nichts geändert und die Seite als offen gemeldet", async () => {
    const d = await bestand();
    const { adapter } = adapterFuer({ liste: [seite("p1", "Pumpe warten")], jeId: { p2: 500 } });
    const lauf = await abgleich(d, adapter);
    expect(lauf.removed).toBe(0);
    expect(lauf.removalOpen).toBe(1);
    const eintrag = lauf.perPage.find((p) => p.ref === "p2");
    expect(eintrag?.status).toBe("failed");
    expect(eintrag?.note).toContain("nichts geändert");
    expect(await traeger(d, "p2")).toHaveLength(1);
  });

  it("G3: ein abgeschnittener Lauf (truncated) prüft keine Löschungen", async () => {
    const d = await bestand();
    const { adapter, einzelabrufe } = adapterFuer({ liste: [seite("p1", "Pumpe warten")] });
    const echt = await adapter.collectAll();
    vi.spyOn(adapter, "collectAll").mockResolvedValue({ ...echt, truncated: true });
    const lauf = await abgleich(d, adapter);
    expect(lauf.removalChecked).toBe(false);
    expect(lauf.removed).toBe(0);
    expect(einzelabrufe).toEqual([]);
    expect(await traeger(d, "p2")).toHaveLength(1);
  });

  it("G4: Anker eines ANDEREN Space werden von diesem Lauf nicht beurteilt", async () => {
    const d = dienst();
    await abgleich(d, adapterFuer({ liste: [seite("x1", "Fremd")] }, "ANDERS").adapter);
    await nimmAlleAn(d);
    expect(await traeger(d, "x1")).toHaveLength(1);

    const { adapter, einzelabrufe } = adapterFuer({ liste: [] }, "K");
    const lauf = await abgleich(d, adapter);
    expect(lauf.removed).toBe(0);
    expect(einzelabrufe).toEqual([]);
    expect(await traeger(d, "x1")).toHaveLength(1);
  });

  it("G5: trägt das Objekt weitere Quellen, bleibt es stehen und wird als behalten gemeldet", async () => {
    const d = await bestand();
    const [p2] = await traeger(d, "p2");
    if (!p2) {
      throw new Error("Vorbedingung verletzt: kein Träger für p2.");
    }
    await d.koService.addSource(p2.id, "pedi", { label: "Handbuch Kapitel 4" });
    const { adapter } = adapterFuer({ liste: [seite("p1", "Pumpe warten")], jeId: { p2: 404 } });
    const lauf = await abgleich(d, adapter);
    expect(lauf.removed).toBe(0);
    expect(lauf.removalKept).toBe(1);
    expect(lauf.removalOpen).toBe(0);
    expect(lauf.perPage.find((p) => p.ref === "p2")?.status).toBe("kept");
    expect(await traeger(d, "p2")).toHaveLength(1);
  });

  // Nacharbeit (bens Befund 1/3): HTTP 200 ohne gültige Seite ist KEINE bestätigte Löschung.
  const ungueltigeBodies: [string, unknown][] = [
    ["{}", {}],
    ["null", null],
  ];
  for (const [name, body] of ungueltigeBodies) {
    it(`G6: Einzelabruf HTTP 200 mit Body ${name} — Wissen bleibt, Prüfung offen`, async () => {
      const d = await bestand();
      const { adapter, einzelabrufe } = adapterFuer({
        liste: [seite("p1", "Pumpe warten")],
        jeId: { p2: { roh200: body } },
      });
      const lauf = await abgleich(d, adapter);
      expect(einzelabrufe).toEqual(["p2"]);
      expect(lauf.removed).toBe(0);
      expect(lauf.removalOpen).toBe(1);
      const eintrag = lauf.perPage.find((p) => p.ref === "p2");
      expect(eintrag?.status).toBe("failed");
      expect(eintrag?.note).toContain("ConfluenceAntwortUngueltig");
      expect(await traeger(d, "p2")).toHaveLength(1);
      expect(await d.koService.trashed()).toHaveLength(0);
    });
  }
});

// Nacharbeit (bens Befund 2/4): eine Seite wird eingereiht, dann in der Quelle gelöscht, BEVOR
// jemand den Kandidaten annimmt. Der nächste Abgleich muss die spätere Übernahme verhindern.
describe("R-0162 · offene Kandidaten gelöschter Seiten", () => {
  async function eingereiht() {
    const d = dienst();
    const erst = await abgleich(d, adapterFuer({ liste: [seite("p2", "Filter")] }).adapter);
    expect(erst.imported).toBe(1);
    const [kandidat] = await d.library.listImportCandidates();
    if (!kandidat) {
      throw new Error("Vorbedingung verletzt: kein Kandidat eingereiht.");
    }
    expect(kandidat.status).toBe("neu");
    expect(await d.koService.list()).toHaveLength(0);
    return { d, kandidatId: kandidat.id };
  }

  async function kandidat(d: Dienst, id: string) {
    return (await d.library.listImportCandidates()).find((c) => c.id === id);
  }

  it("K1: bestätigte Löschung lehnt den offenen Kandidaten ab — Annehmen legt nichts an", async () => {
    const { d, kandidatId } = await eingereiht();
    const { adapter, einzelabrufe } = adapterFuer({ liste: [], jeId: { p2: 404 } });
    const lauf = await abgleich(d, adapter);

    expect(einzelabrufe).toEqual(["p2"]);
    expect(lauf.candidatesRejected).toBe(1);
    expect(lauf.removalOpen).toBe(0);
    const eintrag = lauf.perPage.find((p) => p.ref === "p2");
    expect(eintrag?.status).toBe("removed");
    expect(eintrag?.note).toContain("Importkandidat abgelehnt");
    const nachher = await kandidat(d, kandidatId);
    expect(nachher?.status).toBe("abgelehnt");
    expect(nachher?.reviewedBy).toBe("r0162@test");

    await expect(d.library.reviewImportCandidate(kandidatId, "accept", "pedi")).rejects.toThrow();
    expect(await d.koService.list()).toHaveLength(0);
    expect(await d.koService.trashed()).toHaveLength(0);
  });

  it("K2: im Probelauf bleibt der Kandidat unverändert und regulär annehmbar", async () => {
    const { d, kandidatId } = await eingereiht();
    const lauf = await abgleich(d, adapterFuer({ liste: [], jeId: { p2: 404 } }).adapter, true);
    expect(lauf.candidatesRejected).toBe(1);
    expect(lauf.perPage.find((p) => p.ref === "p2")?.note).toContain("würde abgelehnt");
    expect((await kandidat(d, kandidatId))?.status).toBe("neu");

    const angenommen = await d.library.reviewImportCandidate(kandidatId, "accept", "pedi");
    expect(angenommen.koId).toBeTruthy();
    expect(await traeger(d, "p2")).toHaveLength(1);
  });

  it("K3: scheitert die Gegenprobe (500), bleibt der Kandidat unverändert und annehmbar", async () => {
    const { d, kandidatId } = await eingereiht();
    const lauf = await abgleich(d, adapterFuer({ liste: [], jeId: { p2: 500 } }).adapter);
    expect(lauf.candidatesRejected).toBe(0);
    expect(lauf.removalOpen).toBe(1);
    expect(lauf.perPage.find((p) => p.ref === "p2")?.status).toBe("failed");
    expect((await kandidat(d, kandidatId))?.status).toBe("neu");

    const angenommen = await d.library.reviewImportCandidate(kandidatId, "accept", "pedi");
    expect(angenommen.koId).toBeTruthy();
    expect(await traeger(d, "p2")).toHaveLength(1);
  });

  // Nacharbeit 2 (bens Befund): HTTP 200 MIT Seiten-Id, aber ungültigem/unbekanntem Statuswert ist
  // KEINE bestätigte Löschung — weder für einen angenommenen Bestand noch für einen offenen
  // Kandidaten. Die Erfolgsfälle 404 (L1/K1) und trashed (L2) bleiben unverändert.
  const ungueltigeStatus: [string, unknown][] = [
    ["null", null],
    ["42", 42],
    ["unbekannter String", "verschollen"],
  ];
  for (const [name, status] of ungueltigeStatus) {
    it(`G7: Status ${name} bei angenommenem Bestand — Wissen bleibt, Prüfung offen`, async () => {
      const d = await bestand();
      const [vorher] = await traeger(d, "p2");
      const { adapter, einzelabrufe } = adapterFuer({
        liste: [seite("p1", "Pumpe warten")],
        jeId: { p2: { roh200: { id: "p2", status } } },
      });
      const lauf = await abgleich(d, adapter);
      expect(einzelabrufe).toEqual(["p2"]);
      expect(lauf.removed).toBe(0);
      expect(lauf.candidatesRejected).toBe(0);
      expect(lauf.removalOpen).toBe(1);
      const eintrag = lauf.perPage.find((p) => p.ref === "p2");
      expect(eintrag?.status).toBe("failed");
      expect(eintrag?.note).toContain("ConfluenceStatusUnbekannt");
      const [nachher] = await traeger(d, "p2");
      expect(nachher?.id).toBe(vorher?.id);
      expect(nachher?.version).toBe(vorher?.version);
      expect(await d.koService.trashed()).toHaveLength(0);
    });

    it(`G7: Status ${name} bei offenem Kandidaten — Kandidat bleibt neu, Prüfung offen`, async () => {
      const { d, kandidatId } = await eingereiht();
      const { adapter } = adapterFuer({
        liste: [],
        jeId: { p2: { roh200: { id: "p2", status } } },
      });
      const lauf = await abgleich(d, adapter);
      expect(lauf.removed).toBe(0);
      expect(lauf.candidatesRejected).toBe(0);
      expect(lauf.removalOpen).toBe(1);
      expect(lauf.perPage.find((p) => p.ref === "p2")?.status).toBe("failed");
      expect((await kandidat(d, kandidatId))?.status).toBe("neu");
      expect(await d.koService.list()).toHaveLength(0);
    });
  }
});
