import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ConfluenceSourceAdapter } from "../../../confluence";
import type { ImportItem } from "../../../library-analytics";
import { buildApp, buildServices } from "../build-app";
import {
  importStatusFor,
  importStatusKey,
  importedAnchorVersions,
  normalizeSourceVersion,
  pendingCandidateVersions,
} from "../confluence-import";
import { makeGuards } from "../http";
import { confluenceImportRoutes } from "./confluence-import-routes";

// WP-IC-PAKET-1 (Teil 4, IC-6a): Import-Status + Doppel-Import-Schutz — gegen die ECHTEN Routen und
// Services (LibraryService-Queue, KoService-Herkunftsanker). Der Quell-Referenz-Vertrag ist
// externalId (Confluence-Seiten-ID) + sourceVersion an KoSource bzw. am offenen Kandidaten; genau
// derselbe Vertrag, den die Import-Idempotenz nutzt. „Quelle neuer als Import" läuft über die
// VERSIONSNUMMER (die Quell-Referenz führt kein Änderungsdatum) — reine Anzeige, kein Update (IC-6b).

const SAVED: Record<string, string | undefined> = {};
const KEYS = ["KLARWERK_CONFLUENCE_IMPORT", "KLARWERK_ADDON_API"];
beforeEach(() => {
  for (const k of KEYS) {
    SAVED[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of KEYS) {
    if (SAVED[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = SAVED[k];
    }
  }
});

function baseItem(over: Partial<ImportItem>): ImportItem {
  return {
    title: over.title ?? "Seite",
    statement: over.statement ?? "Aussage der Seite.",
    type: "best_practice",
    category: "K",
    ...over,
  };
}

const P1_V1 = baseItem({ title: "Wartung Pumpe", externalId: "p1", sourceVersion: 1 });
const P2_V1 = baseItem({ title: "Wartung Ventile", externalId: "p2", sourceVersion: 1 });
const NO_ID = baseItem({ title: "Seite ohne Anker" });

async function statusApp(itemsRef: { current: ImportItem[] }, onScan?: () => void) {
  const adapter = {
    source: "Confluence",
    collect: async () => itemsRef.current,
    collectAll: async () => {
      onScan?.();
      return { items: itemsRef.current, failed: [], truncated: false };
    },
  } as unknown as ConfluenceSourceAdapter;
  // Der Quell-Anker (KoSource.externalId) wird nur bei aktivem externem Import geschrieben
  // (externalUpsert, s. build-app) — exakt der Produktionszustand mit KLARWERK_CONFLUENCE_IMPORT=1.
  // Flag NUR für buildServices setzen; buildApp würde sonst die Routen selbst registrieren (Duplikat) —
  // hier registrieren wir sie manuell mit dem Fixture-Adapter (Muster der übrigen Route-Tests).
  process.env.KLARWERK_CONFLUENCE_IMPORT = "1";
  const services = buildServices();
  delete process.env.KLARWERK_CONFLUENCE_IMPORT;
  const app = buildApp(services);
  app.register(
    confluenceImportRoutes({
      library: services.library,
      koService: services.ko,
      guards: makeGuards(services.auth),
      reasoner: services.reasoner,
      makeAdapter: () => adapter,
    }),
  );
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  return { app, services, headers: { authorization: `Bearer ${login.json().token}` } };
}

describe("WP-IC-PAKET-1 Teil 4: Import-Status-Abgleich (echte Routen + Services)", () => {
  // WP-SHIP9-S1b (bens GELB): offene Kandidaten kennzeichnen jetzt EHRLICH als „bereits zur
  // Prüfung vorgemerkt" (alreadyQueued) — NIE mehr als „bereits importiert" (das bleibt lebenden
  // KO-Herkunftsankern vorbehalten).
  it("Erkundung/Vorschau: vor dem Import 0 markiert; nach dem Einreihen zählen offene Kandidaten als VORGEMERKT", async () => {
    const itemsRef = { current: [P1_V1, P2_V1, NO_ID] };
    const { app, headers } = await statusApp(itemsRef);

    // VOR jedem Import: nichts markiert.
    const before = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/explore",
      headers,
    });
    expect(before.statusCode).toBe(200);
    expect(before.json().alreadyImported).toBe(0);
    expect(before.json().alreadyQueued).toBe(0);

    // Echter Import → alle drei landen als offene Kandidaten (Review-Invariante).
    const run = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence",
      headers,
      payload: { dryRun: false },
    });
    expect(run.statusCode).toBe(200);
    expect(run.json().imported).toBe(3);

    // Erkundung: „X Seiten, davon Y vorgemerkt" — NUR die verankerten Seiten (p1/p2) sind
    // abgleichbar; die ankerlose Seite wird EHRLICH nicht behauptet. Nichts ist importiert
    // (kein KO existiert) — die offenen Kandidaten sind NUR vorgemerkt.
    const after = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/explore",
      headers,
    });
    expect(after.json().summary.totalCount).toBe(3);
    expect(after.json().alreadyImported).toBe(0);
    expect(after.json().alreadyQueued).toBe(2);

    // Vorschau: je Eintrag markiert (Badge-Datenlage) + Zähler über die Vorschau-Liste.
    const select = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/select",
      headers,
      payload: {},
    });
    expect(select.statusCode).toBe(200);
    const preview = select.json().preview as {
      title: string;
      alreadyImported?: boolean;
      alreadyQueued?: boolean;
      sourceNewer?: boolean;
    }[];
    expect(preview.find((e) => e.title === "Wartung Pumpe")?.alreadyQueued).toBe(true);
    expect(preview.find((e) => e.title === "Wartung Pumpe")?.alreadyImported).toBeUndefined();
    expect(preview.find((e) => e.title === "Wartung Ventile")?.alreadyQueued).toBe(true);
    expect(preview.find((e) => e.title === "Seite ohne Anker")?.alreadyQueued).toBeUndefined();
    expect(select.json().alreadyImported).toBe(0);
    expect(select.json().alreadyQueued).toBe(2);
    // Gleiche Version wie eingereiht → KEIN „Quelle neuer"-Signal.
    expect(preview.some((e) => e.sourceNewer === true)).toBe(false);
  });

  it("angenommener Kandidat (KO-Herkunftsanker) + höhere Quell-Version → sourceNewer-Badge-Datenlage", async () => {
    const itemsRef = { current: [P1_V1, P2_V1] };
    const { app, services, headers } = await statusApp(itemsRef);

    await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence",
      headers,
      payload: { dryRun: false },
    });
    // p1 annehmen → echtes KO mit Herkunftsanker (externalId=p1, sourceVersion=1).
    const candidates = await services.library.listImportCandidates();
    const p1 = candidates.find((c) => c.item.externalId === "p1");
    expect(p1).toBeDefined();
    if (!p1) {
      throw new Error("Kandidat p1 fehlt");
    }
    await services.library.reviewImportCandidate(p1.id, "accept", "tester");

    // Die QUELLE ändert sich: p1 liegt dort jetzt in Version 2.
    itemsRef.current = [{ ...P1_V1, sourceVersion: 2 }, P2_V1];

    const select = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/select",
      headers,
      payload: {},
    });
    const preview = select.json().preview as {
      title: string;
      alreadyImported?: boolean;
      alreadyQueued?: boolean;
      sourceNewer?: boolean;
    }[];
    const p1Entry = preview.find((e) => e.title === "Wartung Pumpe");
    // Importiert (lebender KO-Anker) UND Quelle neuer als der Import (Versionsvergleich).
    expect(p1Entry?.alreadyImported).toBe(true);
    expect(p1Entry?.sourceNewer).toBe(true);
    // p2 ist nur offener Kandidat gleicher Version: VORGEMERKT ja (S1b), importiert nein, „neuer" nein.
    const p2Entry = preview.find((e) => e.title === "Wartung Ventile");
    expect(p2Entry?.alreadyImported).toBeUndefined();
    expect(p2Entry?.alreadyQueued).toBe(true);
    expect(p2Entry?.sourceNewer).toBeUndefined();
  });

  // WP-IC-PAKET-1b (bens ROT-2): offener Kandidat v1 + Quelle v2 → Kennzeichen UND „Quelle neuer"
  // (die Kandidaten-Version wird MIT ausgewertet, nicht nur der KO-Anker). WP-SHIP9-S1b: das
  // Kennzeichen heißt jetzt ehrlich alreadyQueued (vorgemerkt), nicht mehr alreadyImported.
  it("offener Kandidat v1 + Quelle in v2 → alreadyQueued UND sourceNewer", async () => {
    const itemsRef = { current: [P1_V1] };
    const { app, headers } = await statusApp(itemsRef);
    await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence",
      headers,
      payload: { dryRun: false },
    });
    // Die Quelle liegt jetzt in Version 2 — der Kandidat (v1) ist noch ungeprüft in der Queue.
    // Neue App-Instanz (frischer Snapshot-Cache), dieselben Services wären ideal — hier reicht
    // die direkte Helfer-Prüfung unten; HTTP-seitig: itemsRef ändern und erste select-Anfrage stellen.
    itemsRef.current = [{ ...P1_V1, sourceVersion: 2 }];
    const select = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/select",
      headers,
      payload: {},
    });
    const entry = (
      select.json().preview as {
        title: string;
        alreadyImported?: boolean;
        alreadyQueued?: boolean;
        sourceNewer?: boolean;
      }[]
    ).find((e) => e.title === "Wartung Pumpe");
    expect(entry?.alreadyImported).toBeUndefined();
    expect(entry?.alreadyQueued).toBe(true);
    expect(entry?.sourceNewer).toBe(true);
  });
});

// WP-SHIP9-S1 (Pedis D1) + WP-SHIP9-S1b (bens GELB, Trennung der Semantik): „BEREITS IMPORTIERT"
// lügt nicht über Gelöschtes — das Kennzeichen kommt NUR aus einem LEBENDEN KO-Herkunftsanker.
// Ein offener Kandidat ist ein EIGENER Zustand („bereits zur Prüfung vorgemerkt") und bleibt das
// unabhängig vom Papierkorb-/Purge-Zustand seines Ziels (der Ship-8-Anker wird nie zerstört).
describe("WP-SHIP9-S1/S1b D1: importiert nur bei lebendem Anker; offener Kandidat ist eigener Zustand", () => {
  // Der select-Status der Seite p1 aus Sicht der Web-Trefferliste (Badge-Datenlage).
  async function selectStatus(
    app: Awaited<ReturnType<typeof statusApp>>["app"],
    headers: Record<string, string>,
  ): Promise<{ alreadyImported: boolean | undefined; alreadyQueued: boolean | undefined }> {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/select",
      headers,
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const entry = (
      res.json().preview as {
        title: string;
        alreadyImported?: boolean;
        alreadyQueued?: boolean;
      }[]
    ).find((e) => e.title === "Wartung Pumpe");
    if (!entry) {
      throw new Error("Vorschau-Eintrag Wartung Pumpe fehlt");
    }
    return { alreadyImported: entry.alreadyImported, alreadyQueued: entry.alreadyQueued };
  }

  // Pflichtfälle 2/3/5: offen → angenommen (lebendes KO) → „bereits importiert"; Papierkorb →
  // neutral/wählbar (kein offener Kandidat mehr, Ziel getrasht); Restore → wieder „importiert".
  it("angenommen → importiert; KO im Papierkorb → neutral (wählbar); wiederhergestellt → wieder importiert", async () => {
    const itemsRef = { current: [P1_V1] };
    const { app, services, headers } = await statusApp(itemsRef);
    await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence",
      headers,
      payload: { dryRun: false },
    });
    const candidates = await services.library.listImportCandidates();
    const p1 = candidates.find((c) => c.item.externalId === "p1");
    if (!p1) {
      throw new Error("Kandidat p1 fehlt");
    }
    // Pflichtfall 1 (vor der Annahme): offen, nie ein Ziel → NUR vorgemerkt, NICHT importiert.
    expect(await selectStatus(app, headers)).toEqual({
      alreadyImported: undefined,
      alreadyQueued: true,
    });
    await services.library.reviewImportCandidate(p1.id, "accept", "tester");
    // Angenommen (lebendes KO mit Herkunftsanker, Kandidat geschlossen) → importiert, nicht mehr vorgemerkt.
    expect(await selectStatus(app, headers)).toEqual({
      alreadyImported: true,
      alreadyQueued: undefined,
    });
    const ko = (await services.ko.list()).find((k) =>
      (k.sources ?? []).some((s) => s.externalId === "p1"),
    );
    if (!ko) {
      throw new Error("importiertes KO fehlt");
    }
    // In den Papierkorb → KEIN Kennzeichen (kein offener Kandidat mehr) — ehrlich neutral/wählbar.
    await services.ko.delete(ko.id, "tester");
    expect(await selectStatus(app, headers)).toEqual({
      alreadyImported: undefined,
      alreadyQueued: undefined,
    });
    // Wiederherstellen → „bereits importiert" lebt über den lebenden Anker wieder auf.
    await services.ko.restore(ko.id, "tester");
    expect(await selectStatus(app, headers)).toEqual({
      alreadyImported: true,
      alreadyQueued: undefined,
    });
  });

  // bens KERNFALL (Pflichtfall 4): offener Kandidat, Ziel erzeugt → trash → HARD PURGE. Die
  // Anzeige sagt IMMER „vorgemerkt" (wahr: der Kandidat liegt weiter in der Review-Queue) und
  // NIE „bereits importiert" (falsch: es existiert kein lebendes Zielobjekt). Vor S1b lief der
  // Purge-Fall wieder in das falsche „importiert" (der S1-Filter sah nur getrashte, nicht
  // gepurgte Ziele); die Trennung der Semantik löst das ohne Tombstone.
  it("offener Kandidat: Ziel getrasht und danach HART GEPURGT → immer vorgemerkt, nie importiert", async () => {
    const itemsRef = { current: [P1_V1] };
    const { app, services, headers } = await statusApp(itemsRef);
    await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence",
      headers,
      payload: { dryRun: false },
    });
    const cand = (await services.library.listImportCandidates()).find(
      (c) => c.item.externalId === "p1",
    );
    if (!cand) {
      throw new Error("Kandidat p1 fehlt");
    }
    // Zielobjekt entsteht MIT Kandidaten- und Quell-Anker, der Kandidat bleibt OFFEN
    // (Claim-Crash-Fall) → solange das Ziel lebt: importiert UND vorgemerkt (beides wahr).
    const ko = await services.ko.create({
      title: "Wartung Pumpe",
      statement: "Aussage der Seite.",
      type: "best_practice",
      category: "K",
      author: "tester",
      importCandidateId: cand.id,
      sources: [
        {
          id: "src-p1",
          label: "Confluence-Seite",
          url: null,
          excerpt: null,
          kind: "external",
          peerValidated: false,
          provider: "Confluence",
          externalId: "p1",
          author: "importer",
          at: "2026-07-01T00:00:00.000Z",
          sourceVersion: 1,
        },
      ],
    });
    expect(await selectStatus(app, headers)).toEqual({
      alreadyImported: true,
      alreadyQueued: true,
    });
    // Papierkorb: der Anker ist tot → nur noch „vorgemerkt" (Soft-Delete-Fall ohne S1-Filter).
    await services.ko.delete(ko.id, "tester");
    expect(await selectStatus(app, headers)).toEqual({
      alreadyImported: undefined,
      alreadyQueued: true,
    });
    // HARD PURGE: das Ziel ist endgültig weg → weiterhin „vorgemerkt", NIE „importiert".
    await services.ko.purgeTrashed(ko.id, "tester");
    expect(await selectStatus(app, headers)).toEqual({
      alreadyImported: undefined,
      alreadyQueued: true,
    });
  });

  // S1b-Basis direkt am Helfer: die Pending-Basis kennzeichnet offene Kandidaten UNABHÄNGIG vom
  // Papierkorb-Zustand des Ziels (der S1-Filter ist bewusst entfallen — die Trennung der
  // Semantik macht ihn überflüssig, der Queue-Schutz bleibt vollständig).
  it("pendingCandidateVersions: offener Kandidat bleibt vorgemerkt, auch wenn sein Ziel getrasht ist", async () => {
    const services = buildServices();
    const [cand] = await services.library.createImportCandidates(
      [baseItem({ title: "Wartung Pumpe", externalId: "p1", sourceVersion: 1 })],
      "tester",
    );
    if (!cand) {
      throw new Error("Kandidat fehlt");
    }
    expect(
      (await pendingCandidateVersions(services.library)).has(importStatusKey("Confluence", "p1")),
    ).toBe(true);
    const ko = await services.ko.create({
      title: "Wartung Pumpe",
      statement: "Aussage der Seite.",
      type: "best_practice",
      category: "K",
      author: "tester",
      importCandidateId: cand.id,
    });
    await services.ko.delete(ko.id, "tester");
    expect(
      (await pendingCandidateVersions(services.library)).has(importStatusKey("Confluence", "p1")),
    ).toBe(true);
    // Und die Anker-Basis kennt den Schlüssel dabei NIE (das KO trug keinen Quell-Anker).
    expect(
      (await importedAnchorVersions(services.ko)).has(importStatusKey("Confluence", "p1")),
    ).toBe(false);
  });
});

// WP-IC-PAKET-1b (bens ROT-2): die Status-Helfer direkt gegen echte Services — Versionsanwesenheit
// und Provider-Scoping.
describe("WP-IC-PAKET-1b ROT-2: importStatusFor — versions- und quellrobust", () => {
  function legacySource(externalId: string, provider: string | null, sourceVersion?: number) {
    return {
      id: `src-${externalId}`,
      label: "Legacy-Anker",
      url: null,
      excerpt: null,
      kind: "external" as const,
      peerValidated: false,
      provider,
      externalId,
      author: "importer",
      at: "2026-01-01T00:00:00.000Z",
      ...(sourceVersion !== undefined ? { sourceVersion } : {}),
    };
  }

  async function servicesWithKoSource(source: ReturnType<typeof legacySource>) {
    const services = buildServices();
    await services.ko.create({
      title: "Bestand",
      statement: "Bestehendes importiertes Wissen.",
      type: "best_practice",
      category: "K",
      author: "importer",
      sources: [source],
    });
    return services;
  }

  it("Legacy-Anker OHNE Version + Quelle OHNE Version → alreadyImported, aber KEIN sourceNewer", async () => {
    const services = await servicesWithKoSource(legacySource("p1", "Confluence"));
    const anchors = await importedAnchorVersions(services.ko);
    const pending = await pendingCandidateVersions(services.library);
    const status = importStatusFor(
      baseItem({ title: "Wartung Pumpe", externalId: "p1", provider: "Confluence" }),
      anchors,
      pending,
    );
    expect(status.alreadyImported).toBe(true);
    expect(status.sourceNewer).toBe(false);
  });

  it("Legacy-Anker OHNE Version + Quelle MIT Version → weiterhin KEIN sourceNewer (einseitig reicht nicht)", async () => {
    const services = await servicesWithKoSource(legacySource("p1", "Confluence"));
    const anchors = await importedAnchorVersions(services.ko);
    const status = importStatusFor(
      baseItem({
        title: "Wartung Pumpe",
        externalId: "p1",
        sourceVersion: 2,
        provider: "Confluence",
      }),
      anchors,
      new Map(),
    );
    expect(status.alreadyImported).toBe(true);
    expect(status.sourceNewer).toBe(false);
  });

  // WP-IC-PAKET-1c (bens ROT-3): EINE Normalisierung für alle drei Versions-Eingänge — nur positive
  // sichere Ganzzahlen sind explizit; alles andere ist "keine Version" und erzeugt NIE sourceNewer.
  it("ROT-3: normalizeSourceVersion — nur positive sichere Ganzzahlen sind explizit", () => {
    expect(normalizeSourceVersion(1)).toBe(1);
    expect(normalizeSourceVersion(42)).toBe(42);
    for (const invalid of [
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
      undefined,
      null,
      "3",
    ]) {
      expect(normalizeSourceVersion(invalid), String(invalid)).toBeNull();
    }
  });

  it("ROT-3 (bens Fehlfall): Anker sourceVersion=0 + Quelle v1 → alreadyImported, aber KEIN sourceNewer", async () => {
    const services = await servicesWithKoSource(legacySource("p1", "Confluence", 0));
    const anchors = await importedAnchorVersions(services.ko);
    const status = importStatusFor(
      baseItem({
        title: "Wartung Pumpe",
        externalId: "p1",
        sourceVersion: 1,
        provider: "Confluence",
      }),
      anchors,
      new Map(),
    );
    // Vorher galt 0 als explizite Version → 1 > 0 → fälschlich „Quelle neuer". Jetzt: 0 ist KEINE
    // Version → kein Vergleich möglich → ehrlich kein Badge.
    expect(status.alreadyImported).toBe(true);
    expect(status.sourceNewer).toBe(false);
  });

  it("ROT-3: kaputte Quell-Versionen (gebrochen/NaN) erzeugen ebenfalls NIE sourceNewer", async () => {
    const services = await servicesWithKoSource(legacySource("p1", "Confluence", 1));
    const anchors = await importedAnchorVersions(services.ko);
    for (const broken of [1.5, Number.NaN, 0, -2]) {
      const status = importStatusFor(
        baseItem({
          title: "Wartung Pumpe",
          externalId: "p1",
          sourceVersion: broken,
          provider: "Confluence",
        }),
        anchors,
        new Map(),
      );
      expect(status.alreadyImported, String(broken)).toBe(true);
      expect(status.sourceNewer, String(broken)).toBe(false);
    }
  });

  it("Provider-Scoping: Jira-Anker mit gleicher externalId markiert die Confluence-Seite NICHT", async () => {
    const services = await servicesWithKoSource(legacySource("p9", "Jira", 5));
    const anchors = await importedAnchorVersions(services.ko);
    const status = importStatusFor(
      baseItem({
        title: "Wartung Pumpe",
        externalId: "p9",
        sourceVersion: 9,
        provider: "Confluence",
      }),
      anchors,
      new Map(),
    );
    expect(status.alreadyImported).toBe(false);
    expect(status.sourceNewer).toBe(false);
    // Der explizite, getestete Vertrag: Schlüssel = provider + externalId (ZENTRAL über
    // importSourceKey normalisiert, WP-NIGHT-FIX bens F3-Rest): Jira bleibt getrennt; die
    // Normalisierung macht Schreibvarianten gleich, und Anker OHNE Provider zählen jetzt —
    // deckungsgleich mit Queue/acceptToKo/Pg-Backfill — als Confluence (die frühere Sonderregel
    // „ohne Provider matcht nie" widersprach dem Backfill).
    expect(importStatusKey("Confluence", "p9")).not.toBe(importStatusKey("Jira", "p9"));
    expect(importStatusKey(" confluence ", "p9")).toBe(importStatusKey("Confluence", "p9"));
    expect(importStatusKey(null, "p9")).toBe(importStatusKey("Confluence", "p9"));
  });
});

// WP-IC-PAKET-1b (bens ROT-3): Snapshot-Cache — Live-Filterung läuft auf EINER geladenen Datenbasis.
describe("WP-IC-PAKET-1b ROT-3: 60-s-Snapshot für Erkundung/Vorschau (Import liest frisch)", () => {
  it("mehrere Erkundungs-/Vorschau-Aufrufe innerhalb der TTL teilen EINEN Quell-Scan", async () => {
    let scans = 0;
    const itemsRef = { current: [P1_V1, P2_V1] };
    const { app, headers } = await statusApp(itemsRef, () => {
      scans += 1;
    });
    await app.inject({ method: "POST", url: "/api/admin/import/confluence/explore", headers });
    expect(scans).toBe(1);
    // Drei schnelle Live-Filter-Änderungen → KEIN weiterer Vollscan (Filter auf dem Snapshot).
    for (const criteria of [{}, { themes: ["Wartung"] }, { yearFrom: 2020 }]) {
      const res = await app.inject({
        method: "POST",
        url: "/api/admin/import/confluence/select",
        headers,
        payload: { criteria },
      });
      expect(res.statusCode).toBe(200);
    }
    expect(scans).toBe(1);
    // Der ECHTE Import liest IMMER frisch (kein Import auf veralteter Datenbasis).
    await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence",
      headers,
      payload: { dryRun: true },
    });
    expect(scans).toBe(2);
  });
});
