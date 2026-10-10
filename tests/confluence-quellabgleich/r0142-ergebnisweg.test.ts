// ================================================================================================
// R-0142 · LAUF 5 · BENS B7 — DER IMPORTLAUF REFERENZIERT, WAS AUS SEINEN SEITEN GEWORDEN IST.
// ================================================================================================
//
//   E1  Bens Gegenprobe wörtlich: abgeschlossener Lauf, Kandidat angenommen → die Ergebnisroute
//       liefert eine Elementreferenz (CREATED, Objekt-Id, Quellrevision), die Revision selbst ist
//       über die Quellroute lesbar. Vor der Entscheidung: keine Referenz (kein erfundener Ausgang).
//   E2  Fortschreibung: Fassung 2 in einem zweiten Lauf, angenommen → BOUND auf dasselbe Objekt.
//   E3  Ablehnung → SKIPPED ohne Objekt; Rückfrage (`info`) schreibt nichts.
//   E4  Eine vom Client mitgeschickte Laufbindung wird an der Eingangsgrenze verworfen.
//   E5  Das Importergebnis EINES Wissensobjekts (`/api/admin/import/knowledge/:koId`): Revision,
//       Lauf, Ausgang; Lückenbindung nachgesehen (`AVAILABLE`, ohne offene Lücke `[]`); 404 für
//       nicht importierte Objekte.
//   E6  Der Selektivimport (`/apply`) bindet ebenso an seine Lauf-Kennung.
//
// LAUF 5 · RUNDE 3 (Bens B7, B11–B13):
//   E7  Lücken aus echten Serverdaten: eine über den echten Antwortweg entstandene offene Lücke,
//       deren Frage die Antwortsuche heute zum importierten Objekt führt, steht am Objekt und am
//       Element (`AVAILABLE` + Kennung, redigierte Sicht mit Frage für Admins); eine fremde Lücke
//       nicht; geprüfte/offene Lücken sind ausgewiesen. Eine geschlossene Lücke zählt nicht.
//   E8  (B11) Ablehnung in Lauf 1, Wiederimport und Annahme in Lauf 2: das Objekt zeigt Lauf 2.
//   E9  (B12) einmaliger Schreibfehler der Referenz: die Wiederaufnahme beim Laden der
//       Warteschlange zieht sie nach — genau eine Referenz, auch bei wiederholtem Nachzug.
//   E10 (B13) eine von der Wiederaufnahme vollendete Annahme bekommt ihre Referenz (CREATED).
//
// LAUF 5 · RUNDE 4 (Bens B14, B15):
//   E11 (B14) ein vorübergehender Lesefehler der Herkunftsabfrage schreibt keine falsche BOUND;
//       der Nachzug schreibt danach CREATED.
//   E12 (B15) bei administrativ abgeschalteter KI liefern Objekt- und Ergebnisroute HTTP 200 mit
//       dem gespeicherten Ergebnis, `RELATION_NOT_AVAILABLE` und Grund `KI_ABGESCHALTET`.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { makeGuards } from "../../services/app/src/http";
import {
  confluenceImportRoutes,
  warteAufOffeneImportLaeufe,
} from "../../services/app/src/routes/confluence-import-routes";
import { importRunRoutes } from "../../services/app/src/routes/import-run-routes";
import type { ImportItem } from "../../services/library-analytics";
import { adapterFromConfig } from "../support/confluence-adapter";

type Seite = Record<string, unknown>;

function seite(id: string, version: number, titel = "Wartung"): Seite {
  return {
    id,
    title: titel,
    version: { number: version },
    body: { storage: { value: `<p>Vor ${titel} ausschalten.</p><p>Fassung ${version}.</p>` } },
    _links: { webui: `/spaces/K/pages/${id}` },
    metadata: { labels: { results: [{ name: "wartung" }] } },
    ancestors: [{ id: "parent", title: "Betrieb" }],
  };
}

// confluence-import-rechte (Nacharbeit 16, Ben K1): die Quelle trägt die Rechte, die Confluence
// tatsächlich liefert — der Space ist für das Quellkonto des Admins lesbar (mit seiner
// Klara-Adresse), und der referenzierte Vorfahr „Betrieb" ist eine offene Seite desselben Bereichs.
// Ohne beides ist ein Objekt nach R-0549 für niemanden lesbar. Der Vorfahr steht am ENDE der
// Bereichsliste; er wird nie entschieden und ist keine der Seiten, die die Fälle prüfen.
const ADMIN_EMAIL = "a@r0142.test";
const ELTERN: Seite = {
  id: "parent",
  title: "Betrieb",
  version: { number: 1 },
  body: { storage: { value: "<p>Betrieb.</p>" } },
  _links: { webui: "/spaces/K/pages/parent" },
  ancestors: [],
};

async function aufbau() {
  const bereich = new Map<string, Seite>();
  // Die Quellkonten mit Space-Leserecht; ein Fall kann sie erweitern (Nacharbeit 17, E14).
  const spaceLeser: { accountId: string; email: string }[] = [
    { accountId: "acc-admin", email: ADMIN_EMAIL },
  ];
  const antwort = (status: number, body: unknown) =>
    ({ ok: status < 300, status, json: async () => body }) as Response;
  const fetchFn = (async (u: string) => {
    const url = new URL(String(u));
    if (/\/child\/attachment$/.test(url.pathname)) {
      return antwort(200, { results: [] });
    }
    if (url.pathname.endsWith("/rest/api/space/K")) {
      return antwort(200, {
        id: 655363,
        key: "K",
        permissions: [
          {
            operation: { operation: "read", targetType: "space" },
            anonymousAccess: false,
            subjects: {
              user: { results: [...spaceLeser] },
              group: { results: [] },
            },
          },
        ],
      });
    }
    // Einzelabruf einer Seite (Selektivimport lädt je Id frisch, Löschabgleich fragt nach).
    const id = /\/rest\/api\/content\/([^/?]+)$/.exec(url.pathname)?.[1];
    if (id) {
      const gesucht = decodeURIComponent(id);
      const s = gesucht === ELTERN.id ? ELTERN : bereich.get(gesucht);
      return s ? antwort(200, s) : antwort(404, {});
    }
    return antwort(200, { results: [...bereich.values(), ELTERN] });
  }) as unknown as typeof fetch;
  const adapter = adapterFromConfig({
    baseUrl: "https://fixture.example/wiki",
    email: "fixture@example.test",
    apiToken: "fixture-only",
    spaceKey: "K",
    fetchFn,
  });
  process.env.KLARWERK_CONFLUENCE_IMPORT = "1";
  const services = buildServices();
  delete process.env.KLARWERK_CONFLUENCE_IMPORT;
  const app = buildApp(services);
  const guards = makeGuards(services.auth);
  app.register(
    confluenceImportRoutes({
      library: services.library,
      koService: services.ko,
      guards,
      reasoner: services.reasoner,
      makeAdapter: () => adapter,
      importRuns: services.importRuns,
      quellabgleich: services.quellabgleich,
    }),
  );
  app.register(
    importRunRoutes({
      importRuns: services.importRuns,
      externalSources: services.externalSources,
      quellabgleich: services.quellabgleich,
      koService: services.ko,
      // R-0142 (Lauf 5 R3): genau die Verdrahtung der Kompositionswurzel (build-app.ts).
      luecken: services.ask,
      kandidaten: services.candidates,
      kandidatenRechte: services.library,
      guards,
    }),
  );
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: ADMIN_EMAIL, password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ADMIN_EMAIL, password: "secret123" },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };
  // R-0585 (Auftrag gesamt-datenschutz-voreinstellung): den Fragetext einer Lücke sehen nur der
  // Fragende und der Zuständige — kein Rollenrecht mehr. Wer im Test fragt und danach das Ergebnis
  // liest, muss deshalb DASSELBE Konto sein.
  const adminId = login.json().user.id as string;
  // Nacharbeit 16 (Ben K1): eine zweite Administratorin mit denselben Routenrechten
  // (`users.manage`), die in der Quelle NICHT lesen darf.
  const fremdeMail = "fremd@r0142.test";
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers,
    payload: { name: "Fremd", email: fremdeMail, password: "geheim12345", role: "admin" },
  });
  expect(angelegt.statusCode, angelegt.body).toBe(201);
  const fremdLogin = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: fremdeMail, password: "geheim12345" },
  });
  const fremdHeaders = { authorization: `Bearer ${fremdLogin.json().token}` };

  const lauf = async (): Promise<string> => {
    const start = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence",
      headers,
      payload: {},
    });
    expect(start.statusCode, start.body).toBe(202);
    await warteAufOffeneImportLaeufe(services.importRuns);
    return (start.json() as { importId: string }).importId;
  };
  const ergebnis = async (importId: string) => {
    const res = await app.inject({
      method: "GET",
      url: `/api/admin/import/runs/${importId}/result`,
      headers,
    });
    expect(res.statusCode, res.body).toBe(200);
    return res.json() as {
      run: { status: string };
      items: {
        ordinal: number;
        sourceRecordId: string | null;
        candidateItemId: string;
        knowledgeObjectId: string | null;
        itemOutcome: string;
        knowledgeGapRelationState: string;
        knowledgeGapIds: string[] | null;
      }[];
    };
  };
  // Der Vorfahr der Fixture wird nie entschieden — die Fälle sehen nur ihre eigenen Seiten.
  const offene = async () =>
    (await services.library.listImportCandidates()).filter(
      (k) => k.status === "neu" && k.item.externalId !== ELTERN.id,
    );
  return {
    app,
    services,
    headers,
    adminId,
    fremdHeaders,
    fremdeMail,
    spaceLeser,
    bereich,
    lauf,
    ergebnis,
    offene,
  };
}

describe("R-0142 · der Ergebnisweg des Confluence-Imports", () => {
  it("E1 · Bens Gegenprobe: nach Annahme liefert die Ergebnisroute die Referenz auf das Objekt", async () => {
    const t = await aufbau();
    try {
      t.bereich.set("P-1", seite("P-1", 1));
      const importId = await t.lauf();
      // Vor der Entscheidung steht nichts fest — und es wird nichts behauptet.
      expect((await t.ergebnis(importId)).items).toEqual([]);
      const [kandidat] = await t.offene();
      expect(kandidat).toBeDefined();
      expect(await t.services.ko.list()).toHaveLength(0);
      const angenommen = await t.services.library.reviewImportCandidate(
        kandidat?.id ?? "",
        "accept",
        "admin",
      );
      const kos = await t.services.ko.list();
      expect(kos).toHaveLength(1);
      expect(kos[0]?.status).toBe("offen");

      const e = await t.ergebnis(importId);
      expect(e.run.status).toBe("COMPLETED");
      expect(e.items).toHaveLength(1);
      expect(e.items[0]).toMatchObject({
        ordinal: 0,
        candidateItemId: kandidat?.id,
        knowledgeObjectId: angenommen.koId,
        itemOutcome: "CREATED",
        // Lauf 5 R3: mit Lückenport nachgesehen — keine offene Lücke betrifft dieses Objekt.
        knowledgeGapRelationState: "AVAILABLE",
        knowledgeGapIds: [],
      });
      const quelle = await t.app.inject({
        method: "GET",
        url: `/api/admin/import/source-records/${e.items[0]?.sourceRecordId}`,
        headers: t.headers,
      });
      expect(quelle.statusCode, quelle.body).toBe(200);
      expect(quelle.json()).toMatchObject({
        externalId: "P-1",
        sourceVersion: 1,
        title: "Wartung",
        url: "https://fixture.example/wiki/spaces/K/pages/P-1",
        contentReferenceState: "NOT_CAPTURED",
        rawOrRenderedContentReference: null,
      });
    } finally {
      await t.app.close();
    }
  });

  it("E2 · Fassung 2 im zweiten Lauf, angenommen: BOUND auf dasselbe Objekt, eigene Revision", async () => {
    const t = await aufbau();
    try {
      t.bereich.set("P-1", seite("P-1", 1));
      const erster = await t.lauf();
      const [k1] = await t.offene();
      const a1 = await t.services.library.reviewImportCandidate(k1?.id ?? "", "accept", "admin");
      t.bereich.set("P-1", seite("P-1", 2));
      const zweiter = await t.lauf();
      const [k2] = await t.offene();
      expect(k2?.item.sourceVersion).toBe(2);
      const a2 = await t.services.library.reviewImportCandidate(k2?.id ?? "", "accept", "admin");
      expect(a2.koId).toBe(a1.koId);

      const e1 = await t.ergebnis(erster);
      const e2 = await t.ergebnis(zweiter);
      expect(e1.items.map((i) => i.itemOutcome)).toEqual(["CREATED"]);
      expect(e2.items).toHaveLength(1);
      expect(e2.items[0]).toMatchObject({ knowledgeObjectId: a1.koId, itemOutcome: "BOUND" });
      expect(e2.items[0]?.sourceRecordId).not.toBe(e1.items[0]?.sourceRecordId);
    } finally {
      await t.app.close();
    }
  });

  it("E3 · Ablehnung → SKIPPED ohne Objekt; eine Rückfrage schreibt keine Referenz", async () => {
    const t = await aufbau();
    try {
      t.bereich.set("P-1", seite("P-1", 1, "Eins"));
      t.bereich.set("P-2", seite("P-2", 1, "Zwei"));
      const importId = await t.lauf();
      const offen = await t.offene();
      const eins = offen.find((k) => k.item.externalId === "P-1");
      const zwei = offen.find((k) => k.item.externalId === "P-2");
      await t.services.library.reviewImportCandidate(zwei?.id ?? "", "info", "admin", "Quelle?");
      expect((await t.ergebnis(importId)).items).toEqual([]);
      await t.services.library.reviewImportCandidate(eins?.id ?? "", "reject", "admin");
      const e = await t.ergebnis(importId);
      expect(e.items).toHaveLength(1);
      expect(e.items[0]).toMatchObject({
        candidateItemId: eins?.id,
        knowledgeObjectId: null,
        itemOutcome: "SKIPPED",
      });
    } finally {
      await t.app.close();
    }
  });

  it("E4 · eine vom Client mitgeschickte Laufbindung überlebt die Eingangsgrenze nicht", async () => {
    const t = await aufbau();
    try {
      t.bereich.set("P-1", seite("P-1", 1));
      const importId = await t.lauf();
      const fremd = {
        title: "Untergeschoben",
        statement: "Behauptet, aus einem fremden Lauf zu stammen.",
        type: "best_practice",
        category: "ADV",
        importRun: { importId, ordinal: 7, sourceRecordId: "erfunden" },
      } as unknown as ImportItem;
      const [kandidat] = await t.services.library.createImportCandidates([fremd], "admin");
      expect((kandidat?.item as { importRun?: unknown }).importRun).toBeUndefined();
      await t.services.library.reviewImportCandidate(kandidat?.id ?? "", "accept", "admin");
      expect((await t.ergebnis(importId)).items).toEqual([]);
    } finally {
      await t.app.close();
    }
  });

  it("E5 · das Importergebnis eines Wissensobjekts: Revision, Lauf, Ausgang; 404 ohne Import", async () => {
    const t = await aufbau();
    try {
      t.bereich.set("P-1", seite("P-1", 1));
      const importId = await t.lauf();
      const [kandidat] = await t.offene();
      const a = await t.services.library.reviewImportCandidate(
        kandidat?.id ?? "",
        "accept",
        "admin",
      );
      const res = await t.app.inject({
        method: "GET",
        url: `/api/admin/import/knowledge/${a.koId}`,
        headers: t.headers,
      });
      expect(res.statusCode, res.body).toBe(200);
      expect(res.json()).toMatchObject({
        knowledgeObjectId: a.koId,
        source: { externalId: "P-1", sourceVersion: 1, contentReferenceState: "NOT_CAPTURED" },
        run: { importId, status: "COMPLETED" },
        item: { itemOutcome: "CREATED", knowledgeObjectId: a.koId },
        // Lauf 5 R3: mit Lückenport nachgesehen — keine offene Lücke betrifft dieses Objekt.
        knowledgeGapRelationState: "AVAILABLE",
        knowledgeGapIds: [],
      });

      const eigen = await t.services.ko.create({
        title: "Eigenes Wissen",
        statement: "Nicht importiert.",
        type: "best_practice",
        category: "Wartung",
        author: "admin",
      });
      const ohne = await t.app.inject({
        method: "GET",
        url: `/api/admin/import/knowledge/${eigen.id}`,
        headers: t.headers,
      });
      expect(ohne.statusCode).toBe(404);
      expect(ohne.body).not.toContain(eigen.id);
    } finally {
      await t.app.close();
    }
  });

  it("E6 · der Selektivimport bindet an seine Lauf-Kennung", async () => {
    const t = await aufbau();
    try {
      t.bereich.set("P-1", seite("P-1", 1, "Eins"));
      t.bereich.set("P-2", seite("P-2", 1, "Zwei"));
      const res = await t.app.inject({
        method: "POST",
        url: "/api/admin/import/confluence/apply",
        headers: t.headers,
        payload: { criteria: {}, includeIds: ["P-2", "P-1"] },
      });
      expect(res.statusCode, res.body).toBe(200);
      const { importId } = res.json() as { importId: string };
      expect(importId).toBeTruthy();
      for (const k of await t.offene()) {
        await t.services.library.reviewImportCandidate(k.id, "accept", "admin");
      }
      const e = await t.ergebnis(importId);
      expect(e.items.map((i) => [i.ordinal, i.itemOutcome])).toEqual([
        [0, "CREATED"],
        [1, "CREATED"],
      ]);
      expect(e.items.every((i) => i.sourceRecordId !== null)).toBe(true);
    } finally {
      await t.app.close();
    }
  });

  it("E7 · Lücken aus echten Serverdaten: die offene Lücke, die das Objekt betrifft, steht dort", async () => {
    const t = await aufbau();
    try {
      // Die Fragen werden gestellt, BEVOR es Wissen dazu gibt — der echte Antwortweg legt Lücken an.
      const passend = await t.services.ask.ask("Wie wird die Wartung ausgeschaltet?", t.adminId);
      const fremd = await t.services.ask.ask("Welche Kantine hat montags geöffnet?", t.adminId);
      const geschlossen = await t.services.ask.ask("Wartung ausschalten Fassung?", t.adminId);
      expect(passend.gap?.id, "der Antwortweg muss eine Lücke anlegen").toBeTruthy();
      expect(fremd.gap?.id).toBeTruthy();
      expect(geschlossen.gap?.id).toBeTruthy();
      // R-0846 / L6: eine Lücke schliesst nur mit dem Wissensobjekt, das sie beantwortet. Dafür
      // steht hier ein eigenes Objekt, damit der Import unten unberührt bleibt.
      // produkt:20261010:wissenskreislauf-schliessen: ein ungeprüfter „Abschlussvermerk" schliesst
      // FACHLICH nicht mehr (keine Fachfreigabe). Was dieser Fall braucht, ist eine geschlossene
      // Lücke — „anderweitig beantwortet" ist die administrative Rücknahme mit eigenem Grund.
      await t.services.ko.create({
        title: "Abschlussvermerk Wartungsfrage",
        statement: "Die Frage ist anderweitig beantwortet.",
        type: "best_practice",
        category: "Vermerk",
        author: "admin",
      });
      await t.services.ask.withdrawGap(geschlossen.gap?.id ?? "", "dublette", "admin");

      t.bereich.set("P-1", seite("P-1", 1));
      const importId = await t.lauf();
      const [kandidat] = await t.offene();
      const a = await t.services.library.reviewImportCandidate(
        kandidat?.id ?? "",
        "accept",
        "admin",
      );

      const res = await t.app.inject({
        method: "GET",
        url: `/api/admin/import/knowledge/${a.koId}`,
        headers: t.headers,
      });
      expect(res.statusCode, res.body).toBe(200);
      const o = res.json() as {
        knowledgeGapRelationState: string;
        knowledgeGapIds: string[];
        knowledgeGaps: { id: string; question: string; redacted?: boolean }[];
        knowledgeGapScope: { checkedOpenGaps: number; openGaps: number };
        item: { knowledgeGapRelationState: string; knowledgeGapIds: string[] };
      };
      expect(o.knowledgeGapRelationState).toBe("AVAILABLE");
      expect(o.knowledgeGapIds).toEqual([passend.gap?.id]);
      expect(o.knowledgeGaps).toEqual([
        expect.objectContaining({
          id: passend.gap?.id,
          question: "Wie wird die Wartung ausgeschaltet?",
        }),
      ]);
      expect(o.knowledgeGapScope).toEqual({ checkedOpenGaps: 2, openGaps: 2 });
      expect(o.item).toMatchObject({
        knowledgeGapRelationState: "AVAILABLE",
        knowledgeGapIds: [passend.gap?.id],
      });

      const e = await t.ergebnis(importId);
      expect(e.items[0]).toMatchObject({
        knowledgeGapRelationState: "AVAILABLE",
        knowledgeGapIds: [passend.gap?.id],
      });
    } finally {
      await t.app.close();
    }
  });

  it("E8 · (B11) abgelehnt in Lauf 1, angenommen in Lauf 2: das Objekt zeigt Lauf 2", async () => {
    const t = await aufbau();
    try {
      t.bereich.set("P-1", seite("P-1", 1));
      const erster = await t.lauf();
      const [k1] = await t.offene();
      await t.services.library.reviewImportCandidate(k1?.id ?? "", "reject", "admin");
      const zweiter = await t.lauf();
      const [k2] = await t.offene();
      const a = await t.services.library.reviewImportCandidate(k2?.id ?? "", "accept", "admin");
      const res = await t.app.inject({
        method: "GET",
        url: `/api/admin/import/knowledge/${a.koId}`,
        headers: t.headers,
      });
      expect(res.statusCode, res.body).toBe(200);
      const o = res.json() as {
        run: { importId: string };
        item: { importId: string; knowledgeObjectId: string; itemOutcome: string };
      };
      expect(o.run.importId).not.toBe(erster);
      expect(o.run.importId).toBe(zweiter);
      expect(o.item).toMatchObject({
        importId: zweiter,
        knowledgeObjectId: a.koId,
        itemOutcome: "CREATED",
      });
      // Lauf 1 behält seinen eigenen, ehrlichen Ausgang.
      expect((await t.ergebnis(erster)).items.map((i) => i.itemOutcome)).toEqual(["SKIPPED"]);
    } finally {
      await t.app.close();
    }
  });

  it("E9 · (B12) ein einmaliger Schreibfehler der Referenz wird beim Laden der Warteschlange nachgezogen", async () => {
    const t = await aufbau();
    try {
      t.bereich.set("P-1", seite("P-1", 1));
      const importId = await t.lauf();
      const [k] = await t.offene();
      const echt = t.services.importRuns.appendItemRefs.bind(t.services.importRuns);
      let versuche = 0;
      t.services.importRuns.appendItemRefs = async (refs) => {
        versuche += 1;
        if (versuche === 1) {
          throw new Error("vorübergehend nicht erreichbar");
        }
        return echt(refs);
      };
      const a = await t.services.library.reviewImportCandidate(k?.id ?? "", "accept", "admin");
      expect(a.status).toBe("angenommen");
      expect((await t.ergebnis(importId)).items).toEqual([]);
      // Der Queue-Load der Prüfwarteschlange ruft die Wiederaufnahme (library-routes.ts).
      await t.services.library.recoverStaleReviewClaims();
      await t.services.library.recoverStaleReviewClaims();
      const e = await t.ergebnis(importId);
      expect(e.items).toHaveLength(1);
      expect(e.items[0]).toMatchObject({ knowledgeObjectId: a.koId, itemOutcome: "CREATED" });
      expect(await t.services.library.zieheLaufReferenzenNach()).toBe(0);
    } finally {
      await t.app.close();
    }
  });

  it("E10 · (B13) die Wiederaufnahme einer hängenden Annahme schreibt die Referenz", async () => {
    const t = await aufbau();
    try {
      t.bereich.set("P-1", seite("P-1", 1));
      const importId = await t.lauf();
      const [k] = await t.offene();
      if (!k) {
        throw new Error("Kandidat fehlt");
      }
      // Absturz nach der Objektanlage, vor dem Endstatus: Claim mit abgelaufener Lease + Stempel-KO.
      const alt = new Date(Date.now() - 3_600_000).toISOString();
      expect(
        await t.services.candidates.claim(k.id, "op-absturz", alt, "admin", "accept"),
      ).toBeTruthy();
      const ko = await t.services.ko.create({
        title: k.item.title,
        statement: k.item.statement,
        type: k.item.type,
        category: k.item.category,
        author: "admin",
        importCandidateId: k.id,
      });
      expect((await t.services.library.recoverStaleReviewClaims()).completed).toBe(1);
      const e = await t.ergebnis(importId);
      expect(e.items).toHaveLength(1);
      expect(e.items[0]).toMatchObject({
        candidateItemId: k.id,
        knowledgeObjectId: ko.id,
        itemOutcome: "CREATED",
      });
      await t.services.library.recoverStaleReviewClaims();
      expect((await t.ergebnis(importId)).items).toHaveLength(1);
    } finally {
      await t.app.close();
    }
  });

  it("E11 · (B14) ein Lesefehler der Herkunftsabfrage macht CREATED nicht zu BOUND; der Nachzug schreibt CREATED", async () => {
    const t = await aufbau();
    try {
      t.bereich.set("P-1", seite("P-1", 1));
      const importId = await t.lauf();
      const [k] = await t.offene();
      const echt = t.services.ko.findByImportCandidateId.bind(t.services.ko);
      let gescheitert = false;
      // Genau die Herkunftsabfrage NACH der gespeicherten Annahme scheitert einmal (Bens Probe).
      t.services.ko.findByImportCandidateId = async (id) => {
        const kandidat = await t.services.candidates.findById(id);
        if (!gescheitert && kandidat?.status === "angenommen") {
          gescheitert = true;
          throw new Error("vorübergehender Lesefehler");
        }
        return echt(id);
      };
      const a = await t.services.library.reviewImportCandidate(k?.id ?? "", "accept", "admin");
      expect(gescheitert).toBe(true);
      expect((await t.services.ko.get(a.koId ?? ""))?.importCandidateId).toBe(k?.id);
      // Keine falsche Referenz — lieber keine, bis der Nachzug sie richtig schreibt.
      expect((await t.ergebnis(importId)).items).toEqual([]);
      await t.services.library.recoverStaleReviewClaims();
      const e = await t.ergebnis(importId);
      expect(e.items.map((i) => i.itemOutcome)).toEqual(["CREATED"]);
      expect(await t.services.library.zieheLaufReferenzenNach()).toBe(0);
    } finally {
      await t.app.close();
    }
  });

  it("E12 · (B15) bei abgeschalteter KI bleiben beide Ergebnisse lesbar — ohne Lückenbezug, mit Grund", async () => {
    const t = await aufbau();
    try {
      const frage = await t.services.ask.ask("Wie wird die Wartung ausgeschaltet?", "admin");
      expect(frage.gap?.id).toBeTruthy();
      t.bereich.set("P-1", seite("P-1", 1));
      const importId = await t.lauf();
      const [k] = await t.offene();
      const a = await t.services.library.reviewImportCandidate(k?.id ?? "", "accept", "admin");
      const url = `/api/admin/import/knowledge/${a.koId}`;
      const vorher = await t.app.inject({ method: "GET", url, headers: t.headers });
      expect(vorher.statusCode, vorher.body).toBe(200);
      expect(vorher.json().knowledgeGapIds).toEqual([frage.gap?.id]);

      // Der echte administrative Abschaltweg — die Sperre wird danach NICHT umgangen.
      const aus = await t.app.inject({
        method: "PUT",
        url: "/api/reasoner/config",
        headers: t.headers,
        payload: { global: "deterministic" },
      });
      expect(aus.statusCode, aus.body).toBe(200);
      expect(t.services.reasoner.kiAbschaltung().abgeschaltet).toBe(true);

      const objekt = await t.app.inject({ method: "GET", url, headers: t.headers });
      expect(objekt.statusCode, objekt.body).toBe(200);
      expect(objekt.json()).toMatchObject({
        knowledgeObjectId: a.koId,
        run: { importId },
        item: { itemOutcome: "CREATED", knowledgeGapRelationState: "RELATION_NOT_AVAILABLE" },
        knowledgeGapRelationState: "RELATION_NOT_AVAILABLE",
        knowledgeGapIds: null,
        knowledgeGaps: [],
        knowledgeGapScope: null,
        knowledgeGapUnavailableReason: "KI_ABGESCHALTET",
      });
      const ergebnis = await t.app.inject({
        method: "GET",
        url: `/api/admin/import/runs/${importId}/result`,
        headers: t.headers,
      });
      expect(ergebnis.statusCode, ergebnis.body).toBe(200);
      expect(ergebnis.json()).toMatchObject({
        items: [
          {
            knowledgeObjectId: a.koId,
            itemOutcome: "CREATED",
            knowledgeGapRelationState: "RELATION_NOT_AVAILABLE",
            knowledgeGapIds: null,
          },
        ],
        knowledgeGapUnavailableReason: "KI_ABGESCHALTET",
      });
    } finally {
      await t.app.close();
    }
  });

  // confluence-import-rechte (Nacharbeit 16, Ben K1): dieselben Wege für eine Administratorin mit
  // denselben Routenrechten, die in der QUELLE nicht lesen darf. Die Quellberechtigte (E1/E5) liest
  // weiter alles; die andere bekommt weder Objekt- noch Herkunftsinhalt.
  it("E13 · nicht quellberechtigt trotz Routenrecht: Objekt-Ergebnis 404, keine Herkunftsinhalte", async () => {
    const t = await aufbau();
    try {
      t.bereich.set("P-1", seite("P-1", 1));
      const importId = await t.lauf();
      const [kandidat] = await t.offene();
      const a = await t.services.library.reviewImportCandidate(
        kandidat?.id ?? "",
        "accept",
        "admin",
      );
      const koId = a.koId ?? "";
      const sourceRecordId = (await t.ergebnis(importId)).items[0]?.sourceRecordId ?? "";
      expect(sourceRecordId).not.toBe("");

      // Gegenprobe: die Quellberechtigte liest Objekt-Ergebnis und Herkunft.
      const eigenObjekt = await t.app.inject({
        method: "GET",
        url: `/api/admin/import/knowledge/${koId}`,
        headers: t.headers,
      });
      expect(eigenObjekt.statusCode, eigenObjekt.body).toBe(200);
      const eigenQuelle = await t.app.inject({
        method: "GET",
        url: `/api/admin/import/source-records/${sourceRecordId}`,
        headers: t.headers,
      });
      expect(eigenQuelle.statusCode, eigenQuelle.body).toBe(200);
      expect(eigenQuelle.json()).toMatchObject({ title: "Wartung" });

      const fremd = (url: string) => t.app.inject({ method: "GET", url, headers: t.fremdHeaders });
      const objekt = await fremd(`/api/admin/import/knowledge/${koId}`);
      expect(objekt.statusCode).toBe(404);
      expect(objekt.json()).toEqual({ error: "NOT_FOUND", message: "Nicht gefunden." });
      const quelle = await fremd(`/api/admin/import/source-records/${sourceRecordId}`);
      expect(quelle.statusCode).toBe(404);
      expect(quelle.body).not.toContain("Wartung");
      expect(quelle.body).not.toContain("/spaces/K/pages/P-1");
      expect((await fremd(`/api/kos/${koId}`)).statusCode).toBe(404);
      // Der Lauf selbst bleibt für das Routenrecht lesbar — ohne Titel, Adresse oder Lückenbezug.
      const ergebnis = await fremd(`/api/admin/import/runs/${importId}/result`);
      expect(ergebnis.statusCode, ergebnis.body).toBe(200);
      expect(ergebnis.body).not.toContain("Wartung");
      expect(ergebnis.body).not.toContain("/spaces/K/pages/P-1");
      expect(ergebnis.json().items[0]).toMatchObject({
        knowledgeGapRelationState: "RELATION_NOT_AVAILABLE",
        knowledgeGapIds: null,
      });
    } finally {
      await t.app.close();
    }
  });

  // confluence-import-rechte (Nacharbeit 17, Ben K1): ein älterer, abgelehnter Kandidat mit damals
  // offenen Quellrechten darf die heutige Sperre am Wissensobjekt nicht überstimmen.
  it("E14 · Ablehnung v1 → Wiederimport und Annahme v1 → Beschränkung v2: die alte Quellrevision bleibt für Ausgeschlossene verschlossen", async () => {
    const t = await aufbau();
    try {
      // Beide Administratorinnen dürfen den Space in der Quelle zunächst lesen.
      t.spaceLeser.push({ accountId: "acc-fremd", email: t.fremdeMail });
      t.bereich.set("P-1", seite("P-1", 1));
      await t.lauf();
      const [abgelehnt] = await t.offene();
      await t.services.library.reviewImportCandidate(abgelehnt?.id ?? "", "reject", "admin");
      const zweiter = await t.lauf();
      const [k1] = await t.offene();
      const a1 = await t.services.library.reviewImportCandidate(k1?.id ?? "", "accept", "admin");
      const altRevision = (await t.ergebnis(zweiter)).items[0]?.sourceRecordId ?? "";
      expect(altRevision).not.toBe("");
      const fremd = (url: string) => t.app.inject({ method: "GET", url, headers: t.fremdHeaders });
      const eigen = (url: string) => t.app.inject({ method: "GET", url, headers: t.headers });
      const quelleUrl = `/api/admin/import/source-records/${altRevision}`;
      // Gegenprobe: solange beide quellberechtigt sind, liest auch die zweite die Revision.
      expect((await fremd(quelleUrl)).statusCode).toBe(200);

      // Fassung 2: die Seite ist an der Quelle nur noch für die erste Administratorin lesbar.
      t.bereich.set("P-1", {
        ...seite("P-1", 2),
        restrictions: {
          read: {
            restrictions: {
              user: { results: [{ accountId: "acc-admin", email: ADMIN_EMAIL }] },
              group: { results: [] },
            },
          },
        },
      });
      await t.lauf();
      const [k2] = await t.offene();
      const a2 = await t.services.library.reviewImportCandidate(k2?.id ?? "", "accept", "admin");
      expect(a2.koId).toBe(a1.koId);

      const alt = await fremd(quelleUrl);
      expect(alt.statusCode).toBe(404);
      expect(alt.body).not.toContain("Wartung");
      expect(alt.body).not.toContain("/spaces/K/pages/P-1");
      const laufErgebnis = await fremd(`/api/admin/import/runs/${zweiter}/result`);
      expect(laufErgebnis.statusCode, laufErgebnis.body).toBe(200);
      expect(laufErgebnis.body).not.toContain("Wartung");
      expect(laufErgebnis.body).not.toContain("/spaces/K/pages/P-1");
      expect((await fremd(`/api/admin/import/knowledge/${a1.koId}`)).statusCode).toBe(404);

      // Die weiterhin Berechtigte liest die alte Revision unverändert.
      const berechtigt = await eigen(quelleUrl);
      expect(berechtigt.statusCode, berechtigt.body).toBe(200);
      expect(berechtigt.json()).toMatchObject({ externalId: "P-1", sourceVersion: 1 });
    } finally {
      await t.app.close();
    }
  });
});
