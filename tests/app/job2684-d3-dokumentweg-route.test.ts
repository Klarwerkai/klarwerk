// ================================================================================================
// JOB 2684 D3 (R2-17) — DER DOKUMENTWEG IST GESCHÜTZT: POST /api/kos/from-document mit gesehenem Stand.
// ================================================================================================
//
// BEN an D2: „beim Studio-Dokumentweg fehlt `expectedUpdatedAt` bereits am Clientaufruf". Der
// Client sendet ihn jetzt (Capture.tsx, Quellpin in tests/capture/job2684-d3-zwei-prozesse), und
// hier ist die ECHTE Route belegt: ein veralteter Stand legt KEIN Wissensobjekt an, schreibt den
// Entwurf nicht und antwortet 409 DRAFT_STALE mit dem gespeicherten Stand — derselbe Vertrag wie
// PUT /api/drafts/:id und der Promote. Mit dem aktuellen Stand: 201, Entwurf verbraucht.
// JOB 2684 D4: OHNE Stand (fehlend, leer, falsch getypt) → 400 DRAFT_STAND_FEHLT ohne Wirkung — der
// Altweg ist zu; nur der Weg ohne Entwurf (`create`) kennt keinen Stand, weil keiner veralten kann.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function angemeldeteApp() {
  const services = buildServices();
  const app = buildApp(services);
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
  const headers = { authorization: `Bearer ${login.json().token}` };
  const anlegen = await app.inject({
    method: "POST",
    url: "/api/drafts",
    headers,
    payload: {
      title: "Wartung der Presse",
      statement: "Ursprung",
      type: "best_practice",
      category: "Instandhaltung",
    },
  });
  expect(anlegen.statusCode, anlegen.body).toBe(201);
  const draft = anlegen.json() as { id: string; updatedAt: string };
  const upload = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers,
    payload: {
      name: "original.png",
      mime: "image/png",
      data: PNG_DATA_URL,
      kind: "image",
      purpose: "attachment",
    },
  });
  expect(upload.statusCode, upload.body).toBe(201);
  const objectId = upload.json().id as string;
  return { app, headers, draft, objectId };
}

function dokumentweg(
  draftId: string,
  objectId: string,
  statement: string,
  expectedUpdatedAt?: string,
) {
  return {
    // Der Wiederholschlüssel der Erstanlage (mega20 Block A) — eine UUID je Vorgang.
    operationId: randomUUID(),
    draftId,
    draftPayload: { statement },
    documents: [
      {
        anchor: { objectId, name: "original.png", mime: "image/png" },
        points: [{ label: "Seite 1", excerpt: "Anlage freischalten." }],
      },
    ],
    ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
  };
}

describe("JOB 2684 D3 · POST /api/kos/from-document mit gesehenem Stand", () => {
  it("ein anderer Tab hat den Entwurf inzwischen geändert → 409 DRAFT_STALE, KEIN Wissensobjekt, der Entwurf trägt die andere Fassung und den aktuellen Stand", async () => {
    const { app, headers, draft, objectId } = await angemeldeteApp();
    const alterStand = draft.updatedAt;
    // Tab B schreibt zuerst.
    const b = await app.inject({
      method: "PUT",
      url: `/api/drafts/${draft.id}`,
      headers,
      payload: { statement: "Fassung B", expectedUpdatedAt: alterStand },
    });
    expect(b.statusCode, b.body).toBe(200);
    const neuerStand = (b.json() as { updatedAt: string }).updatedAt;
    // Tab A reicht aus dem Dokument ein — mit dem ALTEN Stand.
    const a = await app.inject({
      method: "POST",
      url: "/api/kos/from-document",
      headers,
      payload: dokumentweg(draft.id, objectId, "Fassung A", alterStand),
    });
    expect(a.statusCode, a.body).toBe(409);
    expect(a.json()).toMatchObject({ error: "DRAFT_STALE", currentUpdatedAt: neuerStand });
    // Nichts entstanden, nichts geschrieben.
    const kos = await app.inject({ method: "GET", url: "/api/kos", headers });
    expect(kos.json()).toEqual([]);
    const noch = await app.inject({ method: "GET", url: `/api/drafts/${draft.id}`, headers });
    expect(noch.statusCode).toBe(200);
    expect(noch.json()).toMatchObject({
      updatedAt: neuerStand,
      payload: { statement: "Fassung B" },
    });
  });

  it("mit dem AKTUELLEN Stand → 201, das Wissensobjekt trägt die mitgeschickte Fassung, der Entwurf ist verbraucht", async () => {
    const { app, headers, draft, objectId } = await angemeldeteApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/kos/from-document",
      headers,
      payload: dokumentweg(draft.id, objectId, "Fassung aus dem Dokument", draft.updatedAt),
    });
    expect(res.statusCode, res.body).toBe(201);
    expect(res.json()).toMatchObject({ statement: "Fassung aus dem Dokument" });
    const weg = await app.inject({ method: "GET", url: `/api/drafts/${draft.id}`, headers });
    expect(weg.statusCode).toBe(404);
  });

  // D4 (BEN an D3: „der Fall ohne Stand bleibt absichtlich gruen"): DER WEG OHNE STAND IST ZU.
  for (const [name, stand] of [
    ["fehlt", undefined],
    ["leer", ""],
    ["nur Leerraum", "   "],
    ["falsch getypt", 12345 as unknown as string],
  ] as const) {
    it(`D4 · Stand ${name} → 400 DRAFT_STAND_FEHLT — kein Wissensobjekt, der Entwurf bleibt zeichengleich, auch wenn jemand anders ihn inzwischen geändert hat`, async () => {
      const { app, headers, draft, objectId } = await angemeldeteApp();
      const b = await app.inject({
        method: "PUT",
        url: `/api/drafts/${draft.id}`,
        headers,
        payload: { statement: "Fassung B" },
      });
      expect(b.statusCode, b.body).toBe(200);
      const vorher = (await app.inject({ method: "GET", url: `/api/drafts/${draft.id}`, headers }))
        .body;
      const res = await app.inject({
        method: "POST",
        url: "/api/kos/from-document",
        headers,
        payload: {
          ...dokumentweg(draft.id, objectId, "Fassung A ohne Stand"),
          ...(stand === undefined ? {} : { expectedUpdatedAt: stand }),
        },
      });
      expect(res.statusCode, res.body).toBe(400);
      expect(res.json()).toMatchObject({ error: "DRAFT_STAND_FEHLT" });
      const kos = await app.inject({ method: "GET", url: "/api/kos", headers });
      expect(kos.json()).toEqual([]);
      const nachher = (await app.inject({ method: "GET", url: `/api/drafts/${draft.id}`, headers }))
        .body;
      expect(nachher).toBe(vorher);
    });
  }

  it("D4 · der Weg OHNE Entwurf (`create`, kein draftId) braucht keinen Stand — es gibt keinen, der veralten könnte", async () => {
    const { app, headers, objectId } = await angemeldeteApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/kos/from-document",
      headers,
      payload: {
        operationId: randomUUID(),
        create: {
          title: "Aus dem Dokument",
          statement: "Frisch, ohne Entwurf",
          type: "best_practice",
          category: "Instandhaltung",
        },
        documents: [
          {
            anchor: { objectId, name: "original.png", mime: "image/png" },
            points: [{ label: "Seite 1", excerpt: "Anlage freischalten." }],
          },
        ],
      },
    });
    expect(res.statusCode, res.body).toBe(201);
    expect(res.json()).toMatchObject({ statement: "Frisch, ohne Entwurf" });
  });
});
