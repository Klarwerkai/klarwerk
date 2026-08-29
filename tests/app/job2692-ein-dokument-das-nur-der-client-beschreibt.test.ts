// ================================================================================================
// JOB 2692 · D1 — EIN DOKUMENT, DAS NUR DER CLIENT BESCHREIBT (Review-Befund 17)
// ================================================================================================
//
// PEDIS FRAGE: „Bleibt ein vertrauliches Dokument vertraulich, auch beim Bildbeschreiben?"
//
// DER BEFUND, gemessen an der Basis 71d3c2b: Bei `source:"draft"` zählte auf /api/reasoner und
// /api/reasoner/describe allein die Client-Deklaration `confidentiality`. Der Entwurf, aus dem der
// Text oder das Bild stammt, wurde nie geladen — ein Aufruf, der „intern" behauptete, bekam die
// Cloud, auch wenn der Entwurf als „vertraulich" gespeichert war. Und der KA4-Riegel (Einwilligung
// je Dokument) galt nur auf /api/ask.
//
// WAS DIESER TEST MISST — an der ECHTEN App (`buildApp`), über die ECHTEN Routen, mit einem Spion
// GENAU an der Stelle, an der die Entscheidung den Reasoner erreicht: dem `confidential`-Argument
// von `structure`/`assistText`/`interview`/`extract`/`describeImage`. `true` heißt: die Cloud ist
// aus der Kette; `false` heißt: der Text/das Bild darf sie erreichen.
//
// D2 (BEN an D1: „der tatsächliche Weg ohne Kennung wird weiterhin durchgelassen"): Der Client
// sendet die `draftId` jetzt mit (apps/web: reasonerProvenance.ts, endpoints.ts, Capture.tsx,
// ImageDescribeContext.tsx — gemountet belegt in tests/capture/job2692-d2-…mounted.test.tsx), und
// der Server lässt `source:"draft"` OHNE aufgelösten Anker (weder `draftId` noch `koId` im Bestand)
// nicht mehr nach Client-Deklaration laufen: fail-closed vertraulich (A2, A6, A11, B2).
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { makeGuards } from "../../services/app/src/http";
import { ka4Freigabe } from "../../services/app/src/routes/ask-routes";
import { reasonerRoutes } from "../../services/app/src/routes/reasoner-routes";
import type { Confidentiality } from "../../services/knowledge-object";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_URL = `data:image/png;base64,${Buffer.concat([PNG_MAGIC, Buffer.alloc(8)]).toString("base64")}`;

type Dienste = ReturnType<typeof buildServices>;
type App = ReturnType<typeof buildApp>;

/** Die fünf Cloud-fähigen Wege, je mit dem Index des `confidential`-Arguments. */
function spione(services: Dienste) {
  const structure = vi.fn(async () => ({ title: "t", statement: "s", demo: true }));
  const assistText = vi.fn(async () => ({ text: "x", demo: true }));
  const interview = vi.fn(async () => ({ question: "q", done: false, demo: true }));
  const extract = vi.fn(async () => ({ points: [], demo: true, note: "kein Modell" }));
  const describeImage = vi.fn(async () => ({
    text: null,
    demo: true as const,
    fallbackReason: "no-model" as const,
  }));
  const r = services.reasoner as unknown as Record<string, unknown>;
  r.structure = structure;
  r.assistText = assistText;
  r.interview = interview;
  r.extract = extract;
  r.describeImage = describeImage;
  return { structure, assistText, interview, extract, describeImage };
}

async function anmelden(app: App, email = "pedi@job2692.test"): Promise<Record<string, string>> {
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email, password: "geheim12345" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "geheim12345" },
  });
  if (login.statusCode !== 200) {
    throw new Error(`Anmeldung fehlgeschlagen: ${login.statusCode} ${login.body}`);
  }
  return { authorization: `Bearer ${(login.json() as { token: string }).token}` };
}

/** Ein gespeicherter Entwurf mit (oder ohne) Stufe — über den ECHTEN Capture-Dienst. */
async function entwurf(services: Dienste, stufe: Confidentiality | undefined): Promise<string> {
  const d = await services.capture.createDraft(
    {
      title: "Entwurf 2692",
      statement: "Ein Satz, der im Entwurf steht.",
      ...(stufe ? { confidentiality: stufe } : {}),
    },
    "autor-2692",
  );
  return d.id;
}

async function structureUeberRoute(
  app: App,
  headers: Record<string, string>,
  body: Record<string, unknown>,
): Promise<number> {
  const res = await app.inject({
    method: "POST",
    url: "/api/reasoner",
    headers,
    payload: { task: "structure", text: "Rohtext aus dem Entwurf.", ...body },
  });
  return res.statusCode;
}

async function describeUeberRoute(
  app: App,
  headers: Record<string, string>,
  body: Record<string, unknown>,
): Promise<number> {
  const res = await app.inject({
    method: "POST",
    url: "/api/reasoner/describe",
    headers,
    payload: { dataUrl: PNG_URL, ...body },
  });
  return res.statusCode;
}

/** Das dritte Argument von `structure(text, locale, confidential)`. */
const vertraulichBei = (spy: ReturnType<typeof vi.fn>, index: number): unknown =>
  (spy.mock.calls.at(-1) as unknown[] | undefined)?.[index];

describe("JOB 2692 A — der Entwurfs-Backstop: die gespeicherte Stufe hebt, sie senkt nie", () => {
  it("A1 — Entwurf ‹vertraulich›, Aufruf behauptet ‹intern›, draftId dabei → die Cloud ist aus der Kette", async () => {
    const services = buildServices();
    const s = spione(services);
    const app = buildApp(services);
    const headers = await anmelden(app);
    const draftId = await entwurf(services, "vertraulich");

    expect(
      await structureUeberRoute(app, headers, {
        source: "draft",
        confidentiality: "intern",
        draftId,
      }),
    ).toBe(200);
    expect(s.structure).toHaveBeenCalledTimes(1);
    expect(vertraulichBei(s.structure, 2), "die gespeicherte Stufe hat nicht gehoben").toBe(true);
  });

  it("A2 — D2: derselbe Aufruf OHNE draftId (und ohne koId) → vertraulich — ohne aufgelösten Anker entscheidet nicht mehr die Client-Deklaration", async () => {
    const services = buildServices();
    const s = spione(services);
    const app = buildApp(services);
    const headers = await anmelden(app);
    await entwurf(services, "vertraulich");

    expect(
      await structureUeberRoute(app, headers, { source: "draft", confidentiality: "intern" }),
    ).toBe(200);
    // In D1 war das der Parallelweg (BEN: „weiterhin durchgelassen"). Jetzt: 200, aber ohne Cloud —
    // fail-closed statt 4xx, damit ein Aufrufer ohne Kennung nicht bricht, sondern nur lokal läuft.
    expect(vertraulichBei(s.structure, 2)).toBe(true);
  });

  it("A3 — Entwurf ‹intern›, Aufruf ‹intern› → hebt nicht falsch (Cloud bleibt erreichbar)", async () => {
    const services = buildServices();
    const s = spione(services);
    const app = buildApp(services);
    const headers = await anmelden(app);
    const draftId = await entwurf(services, "intern");

    await structureUeberRoute(app, headers, {
      source: "draft",
      confidentiality: "intern",
      draftId,
    });
    expect(vertraulichBei(s.structure, 2)).toBe(false);
  });

  it("A4 — Entwurf ‹intern›, Aufruf ‹vertraulich› → senkt nie: die Deklaration bleibt vertraulich", async () => {
    const services = buildServices();
    const s = spione(services);
    const app = buildApp(services);
    const headers = await anmelden(app);
    const draftId = await entwurf(services, "intern");

    await structureUeberRoute(app, headers, {
      source: "draft",
      confidentiality: "vertraulich",
      draftId,
    });
    expect(vertraulichBei(s.structure, 2)).toBe(true);
  });

  it("A5 — DIE GRENZE: Entwurf OHNE Stufe, Aufruf ‹intern› → unverändert (was eine fehlende Stufe bedeutet, entscheidet Pedi, nicht dieser Job)", async () => {
    const services = buildServices();
    const s = spione(services);
    const app = buildApp(services);
    const headers = await anmelden(app);
    const draftId = await entwurf(services, undefined);
    const gespeichert = await services.capture.getDraft(draftId);
    expect(
      gespeichert?.payload.confidentiality,
      "Kalibrierung: der Entwurf trägt keine Stufe",
    ).toBeUndefined();

    await structureUeberRoute(app, headers, {
      source: "draft",
      confidentiality: "intern",
      draftId,
    });
    expect(vertraulichBei(s.structure, 2)).toBe(false);
  });

  it("A6 — D2: unbekannte draftId löst nicht auf → kein Anker → vertraulich (nichts erfunden, nichts durchgelassen)", async () => {
    const services = buildServices();
    const s = spione(services);
    const app = buildApp(services);
    const headers = await anmelden(app);

    await structureUeberRoute(app, headers, {
      source: "draft",
      confidentiality: "intern",
      draftId: "gibt-es-nicht",
    });
    expect(vertraulichBei(s.structure, 2)).toBe(true);
  });

  it("A7 — Entwurf ‹streng_vertraulich› hebt ebenso", async () => {
    const services = buildServices();
    const s = spione(services);
    const app = buildApp(services);
    const headers = await anmelden(app);
    const draftId = await entwurf(services, "streng_vertraulich");

    await structureUeberRoute(app, headers, {
      source: "draft",
      confidentiality: "intern",
      draftId,
    });
    expect(vertraulichBei(s.structure, 2)).toBe(true);
  });

  it("A8 — ein Upload (transient-document) ist NEUER Inhalt: eine mitgeschickte draftId hebt dort nicht", async () => {
    const services = buildServices();
    const s = spione(services);
    const app = buildApp(services);
    const headers = await anmelden(app);
    const draftId = await entwurf(services, "vertraulich");

    await structureUeberRoute(app, headers, {
      source: "transient-document",
      confidentiality: "intern",
      draftId,
    });
    expect(vertraulichBei(s.structure, 2)).toBe(false);
  });

  it("A9 — zwei Backstops, die höhere Stufe gewinnt: internes KO + vertraulicher Entwurf → vertraulich; vertrauliches KO + interner Entwurf → vertraulich", async () => {
    const services = buildServices();
    const s = spione(services);
    const app = buildApp(services);
    const headers = await anmelden(app);
    const koIntern = await services.ko.create({
      title: "KO intern",
      statement: "Aussage intern.",
      type: "best_practice",
      category: "test",
      author: "autor-2692",
      confidentiality: "intern",
    });
    const koVertraulich = await services.ko.create({
      title: "KO vertraulich",
      statement: "Aussage vertraulich.",
      type: "best_practice",
      category: "test",
      author: "autor-2692",
      confidentiality: "vertraulich",
    });
    const entwurfVertraulich = await entwurf(services, "vertraulich");
    const entwurfIntern = await entwurf(services, "intern");

    await structureUeberRoute(app, headers, {
      source: "draft",
      confidentiality: "intern",
      koId: koIntern.id,
      draftId: entwurfVertraulich,
    });
    expect(vertraulichBei(s.structure, 2)).toBe(true);

    await structureUeberRoute(app, headers, {
      source: "draft",
      confidentiality: "intern",
      koId: koVertraulich.id,
      draftId: entwurfIntern,
    });
    expect(vertraulichBei(s.structure, 2)).toBe(true);

    await structureUeberRoute(app, headers, {
      source: "draft",
      confidentiality: "intern",
      koId: koIntern.id,
      draftId: entwurfIntern,
    });
    expect(vertraulichBei(s.structure, 2)).toBe(false);
  });

  it("A10 — D2: die koId ist ein gültiger Anker (KnowledgeDetail-Editor): internes KO, keine draftId → intern bleibt intern", async () => {
    const services = buildServices();
    const s = spione(services);
    const app = buildApp(services);
    const headers = await anmelden(app);
    const ko = await services.ko.create({
      title: "KO intern",
      statement: "Aussage intern.",
      type: "best_practice",
      category: "test",
      author: "autor-2692",
      confidentiality: "intern",
    });

    await structureUeberRoute(app, headers, {
      source: "draft",
      confidentiality: "intern",
      koId: ko.id,
    });
    expect(vertraulichBei(s.structure, 2)).toBe(false);
  });

  it("A11 — D2: eine koId, die nicht auflöst, ist kein Anker → vertraulich", async () => {
    const services = buildServices();
    const s = spione(services);
    const app = buildApp(services);
    const headers = await anmelden(app);

    await structureUeberRoute(app, headers, {
      source: "draft",
      confidentiality: "intern",
      koId: "ko-gibt-es-nicht",
    });
    expect(vertraulichBei(s.structure, 2)).toBe(true);
  });
});

describe("JOB 2692 B — derselbe Backstop auf JEDEM Cloud-fähigen Weg, auch beim Bildbeschreiben", () => {
  it("B1 — assist, interview, extract: Entwurf ‹vertraulich›, Aufruf ‹intern› + draftId → vertraulich", async () => {
    const services = buildServices();
    const s = spione(services);
    const app = buildApp(services);
    const headers = await anmelden(app);
    const draftId = await entwurf(services, "vertraulich");
    const provenienz = { source: "draft", confidentiality: "intern", draftId };

    await app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers,
      payload: { task: "assist", text: "Text.", ...provenienz },
    });
    expect(vertraulichBei(s.assistText, 3), "assist").toBe(true);

    await app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers,
      payload: { task: "interview", answers: ["a"], ...provenienz },
    });
    expect(vertraulichBei(s.interview, 2), "interview").toBe(true);

    await app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers,
      payload: { task: "extract", text: "Dokumenttext.", ...provenienz },
    });
    expect(vertraulichBei(s.extract, 4), "extract").toBe(true);
  });

  it("B2 — PEDIS FRAGE: das Bild aus einem vertraulichen Entwurf erreicht die Cloud-Vision nicht, auch wenn der Aufruf ‹intern› behauptet — und ohne Kennung (D2) ebenso wenig", async () => {
    const services = buildServices();
    const s = spione(services);
    const app = buildApp(services);
    const headers = await anmelden(app);
    const draftId = await entwurf(services, "vertraulich");

    expect(
      await describeUeberRoute(app, headers, {
        source: "draft",
        confidentiality: "intern",
        draftId,
      }),
    ).toBe(200);
    expect(s.describeImage).toHaveBeenCalledTimes(1);
    expect(vertraulichBei(s.describeImage, 2), "describe: die Stufe hat nicht gehoben").toBe(true);

    // D2: ohne Kennung gibt es keinen aufgelösten Anker — fail-closed. Die Fassade
    // `resolveConfidential` hat keine eigene Regel; sie trägt exakt das, was `resolveProvenance`
    // entscheidet (in D1 war dieser Aufruf noch „intern": der Parallelweg).
    await describeUeberRoute(app, headers, { source: "draft", confidentiality: "intern" });
    expect(vertraulichBei(s.describeImage, 2)).toBe(true);
  });
});

// ------------------------------------------------------------------------------------------------
// KA4 — die Einwilligung je Dokument gilt jetzt auch auf /api/reasoner und /api/reasoner/describe.
// ------------------------------------------------------------------------------------------------
const INSTANZ = "instanz-2692";

/** Eine ECHTE Klara-Sitzung über die vorhandene Route — die drei Kopfzeilen, die die Bindung tragen. */
async function klaraBindung(
  app: App,
  auth: Record<string, string>,
): Promise<Record<string, string>> {
  const mitInstanz = { ...auth, "x-klara-instance": INSTANZ };
  const res = await app.inject({
    method: "POST",
    url: "/api/klara/sessions",
    headers: mitInstanz,
    payload: {
      addinInstanceId: INSTANZ,
      documentDescriptor: { kind: "saved", hostDocumentId: "word-doc-2692" },
    },
  });
  if (res.statusCode !== 201) {
    throw new Error(`Klara-Sitzung nicht angelegt: ${res.statusCode} ${res.body}`);
  }
  const body = res.json() as { sessionId: string; documentContextId: string };
  return {
    ...mitInstanz,
    "x-klara-session": body.sessionId,
    "x-klara-document": body.documentContextId,
  };
}

describe("JOB 2692 C — der KA4-Riegel auf dem Reasoner-Weg", () => {
  it("C1 — ECHTE Klara-Bindung ohne bestätigte Einwilligung: Text UND Bild bleiben aus der Cloud, obwohl ‹intern› behauptet wird", async () => {
    const services = buildServices();
    const s = spione(services);
    const app = buildApp(services);
    const auth = await anmelden(app);
    const gebunden = await klaraBindung(app, auth);
    // D2: mit aufgelöstem internen Anker, damit hier ausschließlich der Riegel entscheidet.
    const draftId = await entwurf(services, "intern");

    expect(
      await structureUeberRoute(app, gebunden, {
        source: "draft",
        confidentiality: "intern",
        draftId,
      }),
    ).toBe(200);
    expect(vertraulichBei(s.structure, 2), "structure mit Bindung ohne Einwilligung").toBe(true);

    expect(
      await describeUeberRoute(app, gebunden, {
        source: "draft",
        confidentiality: "intern",
        draftId,
      }),
    ).toBe(200);
    expect(vertraulichBei(s.describeImage, 2), "describe mit Bindung ohne Einwilligung").toBe(true);
  });

  it("C2 — unvollständige Bindung (nur eine Kopfzeile) ist fail-closed: keine Cloud", async () => {
    const services = buildServices();
    const s = spione(services);
    const app = buildApp(services);
    const auth = await anmelden(app);

    const draftId = await entwurf(services, "intern");
    await structureUeberRoute(
      app,
      { ...auth, "x-klara-session": "irgendeine-sitzung" },
      { source: "draft", confidentiality: "intern", draftId },
    );
    expect(vertraulichBei(s.structure, 2)).toBe(true);
  });

  it("C3 — OHNE Bindung (Konsole: Capture, Studio, Detail) bleibt alles wie vor 2692 — mit aufgelöstem Anker", async () => {
    const services = buildServices();
    const s = spione(services);
    const app = buildApp(services);
    const auth = await anmelden(app);
    const draftId = await entwurf(services, "intern");

    await structureUeberRoute(app, auth, { source: "draft", confidentiality: "intern", draftId });
    expect(vertraulichBei(s.structure, 2)).toBe(false);
    await describeUeberRoute(app, auth, { source: "draft", confidentiality: "intern", draftId });
    expect(vertraulichBei(s.describeImage, 2)).toBe(false);
  });

  /**
   * Die Freigabe hebt den Riegel — messbar nur mit einem Tor, das `erlaubt:true` liefern kann. Das
   * echte Tor kann das heute nicht (`KLARA_EXTERNAL_EXECUTION_MIGRATED = false`, klara-policy.ts),
   * deshalb hier ein Doppel des Tors an den ECHTEN Routen und ECHTEN Guards; alles andere ist echt.
   */
  async function appMitTor(
    services: Dienste,
    tor:
      | { pruefeExterneAusfuehrung: () => Promise<{ erlaubt: boolean; grund?: string }> }
      | undefined,
  ): Promise<{ app: import("fastify").FastifyInstance; auth: Record<string, string> }> {
    const app = Fastify();
    await app.register(reasonerRoutes({ ...services, ka4: tor }, makeGuards(services.auth)));
    await app.ready();
    await services.auth.register({
      name: "Pedi",
      email: "tor@job2692.test",
      password: "geheim12345",
    });
    const { token } = await services.auth.login({
      email: "tor@job2692.test",
      password: "geheim12345",
    });
    return { app, auth: { authorization: `Bearer ${token}` } };
  }
  const BINDUNG = {
    "x-klara-session": "s-2692",
    "x-klara-instance": "i-2692",
    "x-klara-document": "d-2692",
  };

  it("C4 — bestätigte Einwilligung hebt den Riegel; Absage, Fehler oder fehlendes Tor halten ihn (fail-closed)", async () => {
    const faelle: [string, Parameters<typeof appMitTor>[1], boolean][] = [
      ["freigegeben", { pruefeExterneAusfuehrung: async () => ({ erlaubt: true }) }, false],
      [
        "blockiert",
        { pruefeExterneAusfuehrung: async () => ({ erlaubt: false, grund: "x" }) },
        true,
      ],
      [
        "wirft",
        {
          pruefeExterneAusfuehrung: async () => {
            throw new Error("NOT_FOUND");
          },
        },
        true,
      ],
      ["kein Tor", undefined, true],
    ];
    for (const [name, tor, erwartet] of faelle) {
      const services = buildServices();
      const s = spione(services);
      const { app, auth } = await appMitTor(services, tor);
      const status = await structureUeberRoute(
        app as unknown as App,
        { ...auth, ...BINDUNG },
        { source: "draft", confidentiality: "intern", draftId: await entwurf(services, "intern") },
      );
      expect(status, name).toBe(200);
      expect(vertraulichBei(s.structure, 2), name).toBe(erwartet);
    }
  });

  it("C5 — die Einwilligung hebt NUR den Riegel, nie die Vertraulichkeit: vertraulicher Entwurf bleibt trotz Freigabe aus der Cloud", async () => {
    const services = buildServices();
    const s = spione(services);
    const { app, auth } = await appMitTor(services, {
      pruefeExterneAusfuehrung: async () => ({ erlaubt: true }),
    });
    const draftId = await entwurf(services, "vertraulich");
    await structureUeberRoute(
      app as unknown as App,
      { ...auth, ...BINDUNG },
      { source: "draft", confidentiality: "intern", draftId },
    );
    expect(vertraulichBei(s.structure, 2)).toBe(true);
  });

  it("C6 — EIN Riegel, zwei Protokollnamen: der Reasoner-Weg meldet sich als solcher, der Ask-Weg bleibt byteweise wie vor 2692", async () => {
    const meldungen: string[] = [];
    const log = { info: (_obj: unknown, msg: string) => void meldungen.push(msg) };
    const tor = { pruefeExterneAusfuehrung: async () => ({ erlaubt: false, grund: "x" }) };
    await ka4Freigabe(tor, BINDUNG, "u", log, "reasoner.ka4.dokument-consent");
    await ka4Freigabe(tor, BINDUNG, "u", log);
    expect(meldungen).toEqual(["reasoner.ka4.dokument-consent", "ask.ka4.dokument-consent"]);
  });
});
