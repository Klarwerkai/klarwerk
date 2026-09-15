// ================================================================================================
// JOB 4077 — DER GEPRÜFTE ANKER WIRD NICHT MEHR WEGGEWORFEN (R1 · R2 · R3)
// ================================================================================================
//
// DER GEMESSENE AUSGANGSZUSTAND (main fa5eff5, 1.0.0-beta.1.512): die `add-source`-Route beschafft
// den Anker einer Belegstelle ausdrücklich NICHT aus dem Clientfeld, sondern schlägt ihn in der
// ANHANGSLISTE DIESES Wissensobjekts nach (`ko-routes.ts:2355-2359`) — und vierzehn Zeilen später
// ruft sie `ko.addSource(id, user.id, { label, url, excerpt, provider })` (`:2374-2382`). Der
// Server hat also bewiesen, dass die Belegstelle zu einem bestimmten Anhang gehört, und vergisst
// diese Tatsache beim Speichern. Dasselbe im Übernahmeweg: dort geht der Anker mit `objectId` UND
// `name` an den Anhang (`:2546-2547`), die im selben Aufruf angelegten Belegstellen bekommen ihn
// nicht (`:2553-2559`).
//
// RUNDE 2: der Arbeitsbaum steht seit dem Rebase auf `2fcc3f6` (1.0.0-beta.1.514). Der Befund oben
// bleibt wortgleich gültig, und das ist nachgesehen und nicht angenommen: zwischen `fa5eff5` und
// `2fcc3f6` liegen 15 geänderte Dateien, und keine davon ist eine der hier genannten (JOB 4061 und
// 4067 haben `i18n.ts`, zwei Seiten und ihre eigenen Prüfstände angefasst).
//
// GEMESSEN WIRD DER GESPEICHERTE STAND NACH ERNEUTEM LESEN, über die ECHTEN Routen
// (`buildApp(buildServices())`, Aufbau wie `tests/app/external-attach-gate-e2e.test.ts`). Ein
// gemockter Serviceaufruf genügt hier ausdrücklich nicht: er belegte, dass ein Mock gerufen wird,
// nicht dass der Anker im Bestand ankommt (Korrekturpflicht aus LEHREN.md 15.09. 02:37, JOB 3667 R9).
//
// WAS HIER NICHT GEMESSEN WIRD: die Stufenentscheidung selbst. Sie ist in
// `tests/app/external-attach-gate-e2e.test.ts` mit 16 Zeilen gepinnt und bleibt zeichengleich —
// dieser Auftrag speichert nur, er erlaubt nichts.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;

const PDF_DATA_URL = `data:application/pdf;base64,${Buffer.from("%PDF-1.4 Pruefbericht").toString("base64")}`;
const DATEINAME = "Pruefbericht-2026.pdf";

// Alle Läufe dieser Datei arbeiten mit DERSELBEN, ausdrücklich gesetzten Allowlist und stellen sie
// danach zurück — sonst hinge das Urteil an der Reihenfolge der Testdateien.
let vorher: string | undefined;
beforeEach(() => {
  vorher = process.env.KLARWERK_INTERNAL_SOURCE_ORIGINS;
  process.env.KLARWERK_INTERNAL_SOURCE_ORIGINS = "intranet.werk.local";
});
afterEach(() => {
  if (vorher === undefined) {
    delete process.env.KLARWERK_INTERNAL_SOURCE_ORIGINS;
  } else {
    process.env.KLARWERK_INTERNAL_SOURCE_ORIGINS = vorher;
  }
});

async function login(app: App, email: string, password: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  return { authorization: `Bearer ${res.json().token}` };
}

async function setup(stage?: string) {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const headers = await login(app, "a@x.de", "secret123");
  if (stage) {
    const put = await app.inject({
      method: "PUT",
      url: "/api/external/policy",
      headers,
      payload: { stage },
    });
    expect(put.statusCode).toBe(200);
  }
  const ko = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      confidentiality: "intern",
      title: "Dichtungswechsel L4",
      statement: "Dichtung vor jedem Anlauf prüfen.",
      type: "best_practice",
      category: "Instandhaltung",
      bodyHtml: "<p>Alter Stand.</p>",
    },
  });
  expect(ko.statusCode).toBe(201);
  return { app, headers, koId: ko.json().id as string };
}

/** Legt ein echtes Dokument im Objektspeicher an — über die ECHTE Route, kein Bestands-Schreiben. */
async function objektAnlegen(app: App, headers: Record<string, string>, name = DATEINAME) {
  const obj = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers,
    payload: { name, mime: "application/pdf", data: PDF_DATA_URL },
  });
  expect(obj.statusCode).toBeLessThan(300);
  return obj.json().id as string;
}

/** Hängt das Dokument ans KO — erst DAMIT ist es der Anker, den der Server nachschlägt. */
async function anhaengen(
  app: App,
  headers: Record<string, string>,
  koId: string,
  objectId: string,
  name = DATEINAME,
) {
  const res = await app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers,
    payload: { action: "attach", attachment: { name, mime: "application/pdf", objectId } },
  });
  expect(res.statusCode).toBe(200);
}

function belegstelleAnhaengen(
  app: App,
  headers: Record<string, string>,
  koId: string,
  source: Record<string, unknown>,
) {
  return app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers,
    payload: { action: "add-source", source },
  });
}

/** DER MASSSTAB: nicht die Antwort des schreibenden Aufrufs, sondern der ERNEUT GELESENE Bestand. */
async function gelesenerBestand(app: App, headers: Record<string, string>, koId: string) {
  const res = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers });
  expect(res.statusCode).toBe(200);
  const ko = res.json();
  return {
    sources: (ko.sources ?? []) as { id: string; label: string; objectId?: string }[],
    attachments: (ko.attachments ?? []) as { id: string; name: string; objectId?: string }[],
  };
}

// ================================================================================================
// R1 — DIE KETTE: was der Server bestätigt hat, steht danach im Bestand
// ================================================================================================
describe("JOB 4077 · R1: der bestätigte Anker überlebt das Speichern", () => {
  it("add-source mit Anker auf ein hinterlegtes Dokument → die gelesene Quelle trägt `objectId`", async () => {
    // Auf `search_on_click` ist der Anker zugleich die Bedingung der Erlaubnis — hier ist am
    // deutlichsten, dass der Server die Tatsache KENNT und sie bis hierher wegwarf.
    const { app, headers, koId } = await setup("search_on_click");
    const objectId = await objektAnlegen(app, headers);
    await anhaengen(app, headers, koId, objectId);

    const res = await belegstelleAnhaengen(app, headers, koId, {
      label: "Seite 4",
      excerpt: "Die tragende Naht wird vor dem Verzinken geprüft.",
      objectId,
    });
    expect(res.statusCode).toBe(200);

    const { sources, attachments } = await gelesenerBestand(app, headers, koId);
    expect(sources).toHaveLength(1);
    expect(sources[0]?.objectId).toBe(objectId);
    // Und der Anker zeigt auf den Anhang, aus dem der Dateiname kommt — die Verbindung, die die
    // Prüfseite auflöst. Gespeichert wird der ANKER, nicht der Name (eine Umbenennung des Anhangs
    // machte einen kopierten Namen zur Lüge).
    expect(attachments.find((a) => a.objectId === sources[0]?.objectId)?.name).toBe(DATEINAME);
    expect(sources[0]).not.toHaveProperty("name");
  });

  it("auch auf einer offenen Stufe wird der Anker gespeichert — er ist kein Sperr-Sonderfall", async () => {
    // Bis hierher lief die Bestätigung NUR im restriktiven Fall (`ko-routes.ts:2356`). Auf `open`
    // wäre der Anker also nie bestätigt und damit nie speicherbar gewesen.
    const { app, headers, koId } = await setup("open");
    const objectId = await objektAnlegen(app, headers);
    await anhaengen(app, headers, koId, objectId);

    const res = await belegstelleAnhaengen(app, headers, koId, { label: "Seite 4", objectId });
    expect(res.statusCode).toBe(200);

    const { sources } = await gelesenerBestand(app, headers, koId);
    expect(sources[0]?.objectId).toBe(objectId);
  });
});

// ================================================================================================
// R1b — DIE STRECKE BIS ZUR PRÜFSEITE: die Board-Route liefert BEIDE Hälften der Auflösung
// ================================================================================================
describe("JOB 4077 · R1b: `/api/validation/board` trägt Anker UND Anhangsliste", () => {
  it("die Zeile, aus der `/pruefen` zeichnet, erlaubt die Auflösung Anker → Dateiname", async () => {
    // Ohne diesen Fall bewiese R5 nur, dass die Fläche einen Namen zeichnet, WENN beides ankommt.
    // Die Prüfseite liest ausschliesslich diese Route (`endpoints.validation.board`).
    const { app, headers, koId } = await setup("search_on_click");
    const objectId = await objektAnlegen(app, headers);
    await anhaengen(app, headers, koId, objectId);
    expect(
      (await belegstelleAnhaengen(app, headers, koId, { label: "Seite 4", objectId })).statusCode,
    ).toBe(200);

    const board = await app.inject({ method: "GET", url: "/api/validation/board", headers });
    expect(board.statusCode).toBe(200);
    const zeile = (board.json() as { id: string }[]).find((z) => z.id === koId) as {
      sources?: { objectId?: string }[];
      attachments?: { objectId?: string; name: string }[];
    };
    expect(zeile).toBeDefined();
    expect(zeile.sources?.[0]?.objectId).toBe(objectId);
    expect(zeile.attachments?.find((a) => a.objectId === objectId)?.name).toBe(DATEINAME);
  });
});

// ================================================================================================
// R2 — DER WÄCHTER GEGEN DIE HALBHEIT: ein unbestätigter Anker landet NICHT im Bestand
// ================================================================================================
describe("JOB 4077 · R2: nur der bestätigte Anker wird gespeichert", () => {
  it("ein Anker, den dieses Objekt nicht trägt, wird verworfen — die Quelle entsteht trotzdem", async () => {
    // Auf einer OFFENEN Stufe, weil dort die Quelle auch ohne Anker erlaubt ist: nur so ist die
    // Frage „wird der erfundene Wert GESPEICHERT?" von der Frage „darf angehängt werden?"
    // getrennt messbar. Auf den restriktiven Stufen weist die Stufenregel denselben Aufruf schon
    // mit 403 ab (gepinnt in `tests/app/external-attach-gate-e2e.test.ts`).
    const { app, headers, koId } = await setup("search_attach");

    const res = await belegstelleAnhaengen(app, headers, koId, {
      label: "Seite 4",
      objectId: "obj-fremd",
    });
    expect(res.statusCode).toBe(200);

    const { sources } = await gelesenerBestand(app, headers, koId);
    expect(sources).toHaveLength(1);
    expect(sources[0]?.label).toBe("Seite 4");
    expect(sources[0]?.objectId).toBeUndefined();
  });

  it("ein real existierender Anhang eines FREMDEN Wissensobjekts zählt nicht", async () => {
    const { app, headers, koId } = await setup("search_attach");
    const zweites = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        confidentiality: "intern",
        title: "Anderes Objekt",
        statement: "Egal.",
        type: "best_practice",
        category: "X",
      },
    });
    const fremdesKo = zweites.json().id as string;
    const objectId = await objektAnlegen(app, headers, "Fremdbericht.pdf");
    await anhaengen(app, headers, fremdesKo, objectId, "Fremdbericht.pdf");

    const res = await belegstelleAnhaengen(app, headers, koId, { label: "Seite 4", objectId });
    expect(res.statusCode).toBe(200);

    const { sources } = await gelesenerBestand(app, headers, koId);
    expect(sources[0]?.objectId).toBeUndefined();
  });

  it("ein leerer Anker ist kein Anker — und kein Fehler", async () => {
    const { app, headers, koId } = await setup("search_attach");

    const res = await belegstelleAnhaengen(app, headers, koId, {
      label: "Seite 4",
      objectId: "  ",
    });
    expect(res.statusCode).toBe(200);

    const { sources } = await gelesenerBestand(app, headers, koId);
    expect(sources[0]?.objectId).toBeUndefined();
  });
});

// ================================================================================================
// R3 — DER ÜBERNAHMEWEG: der Weg, der die Originaldatei SELBST mitbringt
// ================================================================================================
describe("JOB 4077 · R3: die Verbund-Operation hängt ihren eigenen Anker an", () => {
  const ZWEI_PUNKTE = [
    { label: "Pruefbericht-2026.pdf", excerpt: "Dichtung nach 500 h tauschen." },
    { label: "Pruefbericht-2026.pdf", excerpt: "Drehmoment 42 Nm einhalten." },
  ];

  it("beide Belegstellen tragen den Anker des im selben Vorgang entstandenen Anhangs", async () => {
    const { app, headers, koId } = await setup("search_on_click");
    const objectId = await objektAnlegen(app, headers);

    const res = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers,
      payload: {
        action: "append-document",
        appendDocument: {
          operationId: "append-vorgang-4077",
          anchor: { objectId, name: DATEINAME, mime: "application/pdf" },
          points: ZWEI_PUNKTE,
          changes: { bodyHtml: "<p>Neuer Stand aus dem Bericht.</p>" },
        },
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().committed).toBe(true);

    const { sources, attachments } = await gelesenerBestand(app, headers, koId);
    expect(sources).toHaveLength(2);
    for (const s of sources) {
      expect(s.objectId).toBe(objectId);
    }
    expect(attachments.find((a) => a.objectId === objectId)?.name).toBe(DATEINAME);
  });

  it("die Idempotenz bleibt unberührt: dieselbe Kennung → `replayed`, identischer Bestand", async () => {
    const { app, headers, koId } = await setup("search_on_click");
    const objectId = await objektAnlegen(app, headers);
    const payload = {
      action: "append-document",
      appendDocument: {
        operationId: "append-vorgang-4077-wdh",
        anchor: { objectId, name: DATEINAME, mime: "application/pdf" },
        points: ZWEI_PUNKTE,
      },
    };

    const erst = await app.inject({ method: "PUT", url: `/api/kos/${koId}`, headers, payload });
    expect(erst.statusCode).toBe(200);
    const nachErstem = await gelesenerBestand(app, headers, koId);

    const zweit = await app.inject({ method: "PUT", url: `/api/kos/${koId}`, headers, payload });
    expect(zweit.statusCode).toBe(200);
    expect(zweit.json().replayed).toBe(true);
    expect(zweit.json().sourceIds).toEqual(erst.json().sourceIds);

    const nachZweitem = await gelesenerBestand(app, headers, koId);
    expect(nachZweitem).toEqual(nachErstem);
    expect(nachZweitem.sources.map((s) => s.objectId)).toEqual([objectId, objectId]);
  });

  // --------------------------------------------------------------------------------------------
  // R3b — DERSELBE VORGANG BEI DER ERSTANLAGE. Der häufigste Fall auf `/pruefen` überhaupt:
  // ein Wissensobjekt, das gerade AUS einem Dokument entstanden ist und auf Freigabe wartet.
  // `createWithDocuments` baut Anker und Belegstellen in derselben Schleife (`service.ts:2136-2168`)
  // und hielt die Zuordnung bis hierher nur für die Evidence-Records fest.
  // --------------------------------------------------------------------------------------------
  it("die Erstanlage AUS Dokumenten (`POST /api/kos/from-document`) hängt ihren Anker ebenso an", async () => {
    const { app, headers } = await setup("search_on_click");
    const objectId = await objektAnlegen(app, headers);
    const entwurf = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: {
        title: "Dichtungswechsel L4",
        statement: "Dichtung vor jedem Anlauf prüfen.",
        type: "best_practice",
        category: "Instandhaltung",
        confidentiality: "intern",
        bodyHtml: "<p>Dichtung nach 500 h tauschen.</p>",
      },
    });
    expect(entwurf.statusCode).toBeLessThan(300);
    const draftId = entwurf.json().id as string;
    const stand = await app.inject({ method: "GET", url: `/api/drafts/${draftId}`, headers });
    expect(stand.statusCode).toBe(200);

    const res = await app.inject({
      method: "POST",
      url: "/api/kos/from-document",
      headers,
      payload: {
        operationId: "erstanlage-4077",
        draftId,
        expectedUpdatedAt: (stand.json() as { updatedAt: string }).updatedAt,
        draftPayload: { title: "Dichtungswechsel L4" },
        documents: [
          {
            anchor: { objectId, name: DATEINAME, mime: "application/pdf" },
            points: [{ label: DATEINAME, excerpt: "Dichtung nach 500 h tauschen." }],
          },
        ],
      },
    });
    expect(res.statusCode).toBe(201);

    const { sources, attachments } = await gelesenerBestand(app, headers, res.json().id as string);
    expect(sources).toHaveLength(1);
    expect(sources[0]?.objectId).toBe(objectId);
    expect(attachments.find((a) => a.objectId === objectId)?.name).toBe(DATEINAME);
  });
});
