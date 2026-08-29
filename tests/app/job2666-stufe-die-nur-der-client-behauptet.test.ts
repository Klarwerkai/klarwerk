// ================================================================================================
// JOB 2666 · D2 — DIE VERDRAHTUNG IM ECHTEN WEG (Korrektur zu D1, BEN: CODE=GRÜN, SUBSTANZ=ROT)
// ================================================================================================
//
// PEDIS FRAGE: „Bleibt ein vertraulicher Entwurf vertraulich — auch wenn der Browser etwas anderes
// behauptet?"
//
// BEN an D1: „Die Schutzlogik ist nur serverintern vorbereitet, weil der reale Client keine `draftId`
// sendet und die Produktionskomposition das KA4-Tor nicht an die Reasoner-Routen reicht." Und zu den
// D1-Tests: „S1/S2 lesen am gespiegelten Reasoner-Eintritt … K3 injiziert `services.ka4` unmittelbar
// in den Test." — „Tests dürfen weder `services.ka4` direkt am Handler injizieren noch den Client
// durch einen gespiegelten Eintritt ersetzen."
//
// WAS SEIT D1 IM PRODUKT LIEGT (JOB 2692 D1+D2, Zeiger b885492): `build-app.ts` reicht das EINE
// `KlaraSessionService` an `reasonerRoutes` (`ka4: klaraSessions`), `ka4Freigabe` ist aus
// `ask-routes.ts` exportiert und in `reasoner-routes.ts` DERSELBE Aufruf (keine zweite Hülle), der
// Client trägt bei fortgesetzten Entwürfen die `draftId` (`lib/reasonerProvenance.ts`,
// `endpoints.ts:provenanceFields`, `Capture.tsx`), und `source:"draft"` ohne auflösbaren Anker gilt
// serverseitig als vertraulich. Dieser Test misst genau das — ohne eine einzige Krücke:
//
//   * kein `services.ka4` am Handler: die App ist `buildApp(services)`, wie im Betrieb;
//   * kein gespiegelter Eintritt: der Client ist `endpoints.reasoner.*` aus `apps/web`, sein `fetch`
//     läuft über eine Transportbrücke (`fetch → app.inject`, Bearer der echten Anmeldung) in die
//     echte Route; aufgezeichnet wird der ERZEUGTE Request;
//   * die Klara-Sitzung entsteht über die ECHTE Route `POST /api/klara/sessions`, die Einwilligung
//     wird über die ECHTE Route `POST …/consent` versucht;
//   * der Spion sitzt hinter der Route am `confidential`-Argument des Reasoner-Dienstes — das Bit,
//     das über Cloud oder lokal entscheidet (dieselbe Stelle wie in JOB 2692);
//   * die Verdrahtung selbst ist am PROTOKOLL sichtbar: das echte Tor schreibt
//     `reasoner.ka4.dokument-consent` mit SEINEM Grund in die Logsenke. Ein nicht verdrahtetes Tor
//     schriebe nichts, ein Doppel einen anderen Grund.
//
// DER POSITIVE ZWEIG (bestätigte Einwilligung hebt den Riegel) ist im Produkt heute NICHT erreichbar:
// `KLARA_EXTERNAL_EXECUTION_MIGRATED` steht als Ownerkonstante auf `false`
// (`services/reasoner/src/klara-policy.ts:161`), die Einwilligungsroute antwortet 409 „nur für
// externe KI möglich", und `pruefeExterneAusfuehrung` kann kein `erlaubt:true` liefern. Der Fall
// steht hier fertig und springt an, sobald die Konstante kippt — dieselbe Bauform wie
// `services/app/src/routes/ka4-endzustand.test.ts` (`nurWennFreigegeben`). Bis dahin ist er
// ausdrücklich NICHT MESSBAR, und V0 protokolliert das in jedem Lauf.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import { endpoints } from "../../apps/web/src/api/endpoints";
import { draftProvenance } from "../../apps/web/src/lib/reasonerProvenance";
import { type LogSenke, buildApp, buildServices } from "../../services/app/src/build-app";
import type { Confidentiality } from "../../services/knowledge-object";
import { KLARA_EXTERNAL_EXECUTION_MIGRATED } from "../../services/reasoner";

type Dienste = ReturnType<typeof buildServices>;
type App = ReturnType<typeof buildApp>;

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_URL = `data:image/png;base64,${Buffer.concat([PNG_MAGIC, Buffer.alloc(8)]).toString("base64")}`;
const INSTANZ = "instanz-2666";
const nurWennFreigegeben = KLARA_EXTERNAL_EXECUTION_MIGRATED ? it : it.skip;

// ------------------------------------------------------------------------------------------------
// Bausteine — alle echt bis auf den Reasoner-Dienst hinter der Route (Spion am `confidential`-Bit).
// ------------------------------------------------------------------------------------------------
function spione(services: Dienste) {
  const structure = vi.fn(async () => ({ title: "t", statement: "s", demo: true }));
  const describeImage = vi.fn(async () => ({
    text: null,
    demo: true as const,
    fallbackReason: "no-model" as const,
  }));
  const ask = vi.fn(async () => ({
    result: {
      answered: false,
      answer: null,
      knowledgeClass: "unbekannt",
      trust: 0,
      sources: [],
      citedSources: [],
      steps: [],
      demo: true,
    },
    answerId: "a",
    gap: null,
    receipt: "r",
  }));
  const r = services.reasoner as unknown as Record<string, unknown>;
  r.structure = structure;
  r.describeImage = describeImage;
  (services.ask as unknown as Record<string, unknown>).ask = ask;
  return { structure, describeImage, ask };
}

/** Das `confidential`-Argument des letzten Aufrufs. */
const bit = (spy: ReturnType<typeof vi.fn>, index: number): unknown =>
  (spy.mock.calls.at(-1) as unknown[] | undefined)?.[index];

/** Die Logsenke: jede Zeile, die die echte App schreibt — hier wird die Verdrahtung sichtbar. */
function logsenke(): { senke: LogSenke; zeilen: string[] } {
  const zeilen: string[] = [];
  return { senke: { write: (z) => void zeilen.push(z) }, zeilen };
}

/** Die `ka4`-Protokollzeilen des Reasoner-Wegs — Entscheidung und Grund des ECHTEN Tors. */
function ka4Zeilen(zeilen: string[]): { entscheidung: string; grund?: string }[] {
  return zeilen
    .filter((z) => z.includes("reasoner.ka4.dokument-consent"))
    .map((z) => (JSON.parse(z) as { ka4: { entscheidung: string; grund?: string } }).ka4);
}

function appBauen(): {
  services: Dienste;
  s: ReturnType<typeof spione>;
  app: App;
  zeilen: string[];
} {
  const services = buildServices();
  const s = spione(services);
  const { senke, zeilen } = logsenke();
  const app = buildApp(services, { log: { senke, stufe: "info" } });
  return { services, s, app, zeilen };
}

async function anmelden(app: App, email = "pedi@job2666.test"): Promise<Record<string, string>> {
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

/** Ein gespeicherter Entwurf mit (oder ohne) Stufe — über den echten Capture-Dienst. */
async function entwurf(services: Dienste, stufe: Confidentiality | undefined): Promise<string> {
  const d = await services.capture.createDraft(
    {
      title: "Entwurf 2666",
      statement: "Ein Satz, der im Entwurf steht.",
      ...(stufe ? { confidentiality: stufe } : {}),
    },
    "autor-2666",
  );
  return d.id;
}

/** Eine ECHTE Klara-Sitzung über die vorhandene Route — die drei Kopfzeilen der Bindung. */
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
      documentDescriptor: { kind: "saved", hostDocumentId: "word-doc-2666" },
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

/** Der ECHTE Einwilligungsversuch über die vorhandene Route. */
async function einwilligen(
  app: App,
  gebunden: Record<string, string>,
): Promise<{ status: number; message: string }> {
  const res = await app.inject({
    method: "POST",
    url: `/api/klara/sessions/${gebunden["x-klara-session"]}/consent`,
    headers: gebunden,
  });
  return {
    status: res.statusCode,
    message: String((res.json() as { message?: string }).message ?? ""),
  };
}

async function structure(app: App, headers: Record<string, string>, body: Record<string, unknown>) {
  const res = await app.inject({
    method: "POST",
    url: "/api/reasoner",
    headers,
    payload: { task: "structure", text: "Rohtext aus dem Entwurf.", ...body },
  });
  return res.statusCode;
}

async function describe_(app: App, headers: Record<string, string>, body: Record<string, unknown>) {
  const res = await app.inject({
    method: "POST",
    url: "/api/reasoner/describe",
    headers,
    payload: { dataUrl: PNG_URL, ...body },
  });
  return res.statusCode;
}

// ------------------------------------------------------------------------------------------------
// Die Transportbrücke für den ECHTEN Client: `fetch → app.inject`. Sie ersetzt Basisadresse und
// Sitzung (das bringt ein Browser mit), nie eine Antwort — und zeichnet den erzeugten Request auf.
// ------------------------------------------------------------------------------------------------
const bruecke = {
  app: null as unknown as App,
  token: "",
  requests: [] as { method: string; url: string; body: Record<string, unknown> }[],
};

function brueckeAufbauen(app: App, auth: Record<string, string>): void {
  bruecke.app = app;
  bruecke.token = auth.authorization ?? "";
  bruecke.requests = [];
  (globalThis as unknown as { fetch: unknown }).fetch = async (
    input: unknown,
    init: {
      method?: string;
      body?: string;
      headers?: ConstructorParameters<typeof Headers>[0];
    } = {},
  ) => {
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((value, key) => {
      headers[key] = value;
    });
    headers.authorization = bruecke.token;
    const res = await bruecke.app.inject({
      method: (init.method ?? "GET") as "POST",
      url: String(input),
      headers,
      ...(init.body !== undefined ? { payload: init.body } : {}),
    });
    bruecke.requests.push({
      method: init.method ?? "GET",
      url: String(input),
      body: init.body ? (JSON.parse(init.body) as Record<string, unknown>) : {},
    });
    return {
      ok: res.statusCode < 400,
      status: res.statusCode,
      statusText: "",
      text: async () => res.body,
    };
  };
}

// ================================================================================================
describe("JOB 2666 D2 · V — die Verdrahtung: das EINE KA4-Tor an /api/reasoner und /describe, über buildApp", () => {
  it("V0 · DIE VORBEDINGUNG, protokolliert: der positive Zweig ist heute per Ownerkonstante gesperrt — die echte Einwilligungsroute sagt es selbst", async () => {
    expect(typeof KLARA_EXTERNAL_EXECUTION_MIGRATED).toBe("boolean");
    const { app } = appBauen();
    const gebunden = await klaraBindung(app, await anmelden(app));
    const versuch = await einwilligen(app, gebunden);
    if (KLARA_EXTERNAL_EXECUTION_MIGRATED) {
      expect(versuch.status).toBe(200);
    } else {
      expect(versuch.status).toBe(409);
      expect(versuch.message).toContain("nur für externe KI möglich");
    }
    console.info(
      `JOB 2666 D2 · V0 · KLARA_EXTERNAL_EXECUTION_MIGRATED = ${KLARA_EXTERNAL_EXECUTION_MIGRATED} → ` +
        `Einwilligung ${versuch.status}; der positive Zweig V2 ist ${KLARA_EXTERNAL_EXECUTION_MIGRATED ? "WIRKSAM" : "NICHT MESSBAR (gesperrt)"}`,
    );
    await app.close();
  });

  it("V1 · NEGATIV, echt: Klara-gebunden ohne bestätigte Einwilligung, ‹intern› behauptet → structure UND describe laufen vertraulich — und das ECHTE Tor hat entschieden (Protokollgrund)", async () => {
    const { services, s, app, zeilen } = appBauen();
    const auth = await anmelden(app);
    const gebunden = await klaraBindung(app, auth);
    // Anker aufgelöst und intern: hier entscheidet ausschließlich der Riegel.
    const draftId = await entwurf(services, "intern");

    expect(
      await structure(app, gebunden, { source: "draft", confidentiality: "intern", draftId }),
    ).toBe(200);
    expect(bit(s.structure, 2), "structure: gebunden ohne Einwilligung").toBe(true);
    expect(
      await describe_(app, gebunden, { source: "draft", confidentiality: "intern", draftId }),
    ).toBe(200);
    expect(bit(s.describeImage, 2), "describe: gebunden ohne Einwilligung").toBe(true);

    // DIE VERDRAHTUNG: zwei Entscheidungen des ECHTEN `KlaraSessionService` im Protokoll — je eine
    // pro Route. Ohne `ka4` in der Komposition gäbe es keine Zeile (ka4Freigabe kehrt vorher um);
    // ein Doppel schriebe einen erfundenen Grund. Der Grund hier ist der des Produkts.
    const entscheidungen = ka4Zeilen(zeilen);
    expect(entscheidungen).toHaveLength(2);
    // Der Grund ist der des ECHTEN `KlaraSessionService` (gemessen 29.08.: eine frische Sitzung ohne
    // Einwilligung meldet `CONSENT_RECONFIRMATION_REQUIRED`; bei gekippter Ownerkonstante wäre es
    // `kein_consent`/`external_not_migrated`). Ein Doppel oder ein fehlendes Tor kann diesen Wert nicht
    // liefern — `ka4Freigabe` schreibt ohne Tor gar nicht, und ein Doppel kennt die Policy nicht.
    for (const e of entscheidungen) {
      expect(e.entscheidung).toBe("blockiert");
      expect(e.grund, "der Grund des echten Tors").toMatch(
        /^(CONSENT_RECONFIRMATION_REQUIRED|external_not_migrated|kein_consent)$/,
      );
    }
    await app.close();
  });

  nurWennFreigegeben(
    "V2 · POSITIV, echt: bestätigte Einwilligung über die Route → der Riegel fällt, die Deklaration gilt (structure nicht erzwungen vertraulich)",
    async () => {
      const { services, s, app, zeilen } = appBauen();
      const auth = await anmelden(app);
      const gebunden = await klaraBindung(app, auth);
      expect((await einwilligen(app, gebunden)).status).toBe(200);
      const draftId = await entwurf(services, "intern");
      expect(
        await structure(app, gebunden, { source: "draft", confidentiality: "intern", draftId }),
      ).toBe(200);
      expect(bit(s.structure, 2)).toBe(false);
      expect(ka4Zeilen(zeilen).at(-1)?.entscheidung).toBe("freigegeben");
      // Die Einwilligung hebt NUR den Riegel, nie die Vertraulichkeit.
      const vertraulich = await entwurf(services, "vertraulich");
      await structure(app, gebunden, {
        source: "draft",
        confidentiality: "intern",
        draftId: vertraulich,
      });
      expect(bit(s.structure, 2)).toBe(true);
      await app.close();
    },
  );

  it("V3 · GEGENPROBE: dieselben Aufrufe OHNE Bindung (Konsole) mit aufgelöstem internen Anker → Cloud erreichbar, kein Tor-Eintrag — der Riegel sperrt nicht pauschal", async () => {
    const { services, s, app, zeilen } = appBauen();
    const auth = await anmelden(app);
    const draftId = await entwurf(services, "intern");
    await structure(app, auth, { source: "draft", confidentiality: "intern", draftId });
    expect(bit(s.structure, 2)).toBe(false);
    await describe_(app, auth, { source: "draft", confidentiality: "intern", draftId });
    expect(bit(s.describeImage, 2)).toBe(false);
    expect(ka4Zeilen(zeilen)).toHaveLength(0);
    await app.close();
  });

  it("V4 · GEGENFALL fremdes Dokument: die Sitzung ist echt, aber die Dokument-Kopfzeile zeigt auf ein anderes Dokument → das echte Tor wirft, der Riegel hält (`bindung_ungueltig`)", async () => {
    const { services, s, app, zeilen } = appBauen();
    const auth = await anmelden(app);
    const gebunden = await klaraBindung(app, auth);
    const draftId = await entwurf(services, "intern");
    await structure(
      app,
      { ...gebunden, "x-klara-document": "ein-anderes-dokument" },
      {
        source: "draft",
        confidentiality: "intern",
        draftId,
      },
    );
    expect(bit(s.structure, 2)).toBe(true);
    expect(ka4Zeilen(zeilen).at(-1)).toEqual({
      entscheidung: "blockiert",
      grund: "bindung_ungueltig",
    });
    await app.close();
  });
});

// ================================================================================================
describe("JOB 2666 D2 · K — die Identitätskette: der ECHTE Clientvertrag trägt die draftId bis in die echte Route", () => {
  it("K1 · endpoints.reasoner.structure mit draftProvenance(‹intern›, draftId eines VERTRAULICHEN Entwurfs): der erzeugte Request trägt die Kennung, der Server hebt — confidential=true", async () => {
    const { services, s, app } = appBauen();
    const auth = await anmelden(app);
    brueckeAufbauen(app, auth);
    const draftId = await entwurf(services, "vertraulich");

    // Der Client: der Aufruf, den Capture.tsx beim Fortsetzen eines Entwurfs macht (Z.828ff).
    await endpoints.reasoner.structure(
      "Rohtext",
      "de",
      draftProvenance("intern", undefined, draftId),
    );

    const req = bruecke.requests.at(-1);
    expect(req?.method).toBe("POST");
    expect(req?.url).toBe("/api/reasoner");
    expect(req?.body).toMatchObject({
      task: "structure",
      source: "draft",
      confidentiality: "intern",
      draftId,
    });
    expect(s.structure).toHaveBeenCalledTimes(1);
    expect(bit(s.structure, 2), "die gespeicherte Stufe hat den Client-Wert ‹intern› gehoben").toBe(
      true,
    );
    await app.close();
  });

  it("K2 · dasselbe für die Bildbeschreibung: endpoints.reasoner.describeImage trägt die draftId, der Server hält das Bild aus der Cloud", async () => {
    const { services, s, app } = appBauen();
    const auth = await anmelden(app);
    brueckeAufbauen(app, auth);
    const draftId = await entwurf(services, "vertraulich");
    await endpoints.reasoner.describeImage(
      PNG_URL,
      "de",
      draftProvenance("intern", undefined, draftId),
      "Kontext",
    );
    const req = bruecke.requests.at(-1);
    expect(req?.url).toBe("/api/reasoner/describe");
    expect(req?.body).toMatchObject({
      source: "draft",
      confidentiality: "intern",
      draftId,
      context: "Kontext",
    });
    expect(bit(s.describeImage, 2)).toBe(true);
    await app.close();
  });

  it("K3 · GEGENPROBE: Entwurf ‹intern› gespeichert, derselbe Clientweg → Cloud erreichbar (die Kette hebt, sie sperrt nicht pauschal)", async () => {
    const { services, s, app } = appBauen();
    const auth = await anmelden(app);
    brueckeAufbauen(app, auth);
    const draftId = await entwurf(services, "intern");
    await endpoints.reasoner.structure(
      "Rohtext",
      "de",
      draftProvenance("intern", undefined, draftId),
    );
    expect(bruecke.requests.at(-1)?.body).toMatchObject({ draftId });
    expect(bit(s.structure, 2)).toBe(false);
    await app.close();
  });

  it("K4 · die Kennung reist NUR, wenn eine da ist: draftProvenance ohne draftId erzeugt kein Feld — und der Server fällt dann geschlossen (vertraulich)", async () => {
    const { s, app } = appBauen();
    const auth = await anmelden(app);
    brueckeAufbauen(app, auth);
    await endpoints.reasoner.structure("Rohtext", "de", draftProvenance("intern"));
    const body = bruecke.requests.at(-1)?.body ?? {};
    expect("draftId" in body).toBe(false);
    expect(bit(s.structure, 2)).toBe(true);
    await app.close();
  });
});

// ================================================================================================
describe("JOB 2666 D2 · A — der Backstop lässt sich nicht durch Weglassen umgehen (ohne die NULL-Stufen-Semantik anzurühren)", () => {
  it("A1 · source:‹draft› OHNE draftId und OHNE koId → vertraulich, auf structure UND describe (fail-closed statt 4xx: der Aufruf läuft lokal weiter)", async () => {
    const { s, app } = appBauen();
    const auth = await anmelden(app);
    expect(await structure(app, auth, { source: "draft", confidentiality: "intern" })).toBe(200);
    expect(bit(s.structure, 2)).toBe(true);
    expect(await describe_(app, auth, { source: "draft", confidentiality: "intern" })).toBe(200);
    expect(bit(s.describeImage, 2)).toBe(true);
    await app.close();
  });

  it("A2 · eine Kennung, die sich NICHT auflöst, ist kein Anker → vertraulich", async () => {
    const { s, app } = appBauen();
    const auth = await anmelden(app);
    await structure(app, auth, {
      source: "draft",
      confidentiality: "intern",
      draftId: "gibt-es-nicht",
    });
    expect(bit(s.structure, 2)).toBe(true);
    await app.close();
  });

  it("A3 · der verpflichtende Lookup ist belegt: ein aufgelöstes INTERNES Objekt (koId) genügt als Anker → nicht vertraulich", async () => {
    const { services, s, app } = appBauen();
    const auth = await anmelden(app);
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: auth });
    const userId = (me.json() as { id: string }).id;
    const ko = await services.ko.create({
      title: "Rezeptur",
      statement: "Mischverhältnis 3:1.",
      type: "best_practice",
      category: "Produktion",
      author: userId,
    } as never);
    await structure(app, auth, {
      source: "draft",
      confidentiality: "intern",
      koId: (ko as { id: string }).id,
    });
    expect(bit(s.structure, 2)).toBe(false);
    await app.close();
  });

  it("A4 · GRENZE, unverändert: ein aufgelöster Entwurf OHNE gespeicherte Stufe hebt nichts — die Deklaration gilt (E-VERTRAULICHKEIT-OHNE-STUFE, OFFEN, nicht entschieden)", async () => {
    const { services, s, app } = appBauen();
    const auth = await anmelden(app);
    const draftId = await entwurf(services, undefined);
    await structure(app, auth, { source: "draft", confidentiality: "intern", draftId });
    expect(bit(s.structure, 2)).toBe(false);
    await app.close();
  });
});

// ================================================================================================
describe("JOB 2666 D2 · E — task:‹ask› in der Enge von /api/ask, mit ECHTER Bindung", () => {
  it("E1 · Klara-gebunden ohne Einwilligung → ask läuft mit validatedOnly + retrievalOnly; ohne Bindung ohne Enge", async () => {
    const { s, app } = appBauen();
    const auth = await anmelden(app);
    const gebunden = await klaraBindung(app, auth);
    const res = await app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers: gebunden,
      payload: { task: "ask", text: "Was tun bei Überdruck?" },
    });
    expect(res.statusCode, res.body).toBe(200);
    const opts = bit(s.ask, 3) as { validatedOnly?: boolean; retrievalOnly?: boolean } | undefined;
    expect(opts?.validatedOnly).toBe(true);
    expect(opts?.retrievalOnly).toBe(true);
    await app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers: auth,
      payload: { task: "ask", text: "Was tun bei Überdruck?" },
    });
    expect(bit(s.ask, 3)).toBeUndefined();
    await app.close();
  });
});

// ================================================================================================
describe("JOB 2666 D2 · P — Pins an der Quelle: eine Komposition, eine KA4-Hülle", () => {
  const wurzel = new URL("../../", import.meta.url).pathname;
  const lesen = (p: string): string => readFileSync(`${wurzel}${p}`, "utf8");

  it("P1 · build-app.ts reicht DASSELBE `klaraSessions` an askRoutes und reasonerRoutes — keine zweite Instanz", () => {
    const quelle = lesen("services/app/src/build-app.ts");
    expect(quelle).toMatch(/reasonerRoutes\(\{\s*\.\.\.services,\s*ka4:\s*klaraSessions\s*\}/);
    expect(quelle).toMatch(/askRoutes\(\s*\{[^}]*klaraSessions[^}]*\}/);
    expect(quelle.match(/new KlaraSessionService\(/g)).toHaveLength(1);
  });

  it("P2 · reasoner-routes.ts benutzt `ka4Freigabe` aus ask-routes.ts — die doppelte Hülle aus D1 (`klaraRiegel`) gibt es nicht mehr", () => {
    const routen = lesen("services/app/src/routes/reasoner-routes.ts");
    expect(routen).toMatch(/import \{[^}]*ka4Freigabe[^}]*\} from "\.\/ask-routes"/);
    expect(routen).not.toMatch(/function klaraRiegel/);
    expect(routen).not.toMatch(/pruefeExterneAusfuehrung\(/);
    const ask = lesen("services/app/src/routes/ask-routes.ts");
    expect(ask).toMatch(/export async function ka4Freigabe\(/);
  });

  it("P3 · der Clientvertrag serialisiert die draftId: provenanceFields in endpoints.ts, draftProvenance in reasonerProvenance.ts, Capture.tsx gibt sie mit", () => {
    expect(lesen("apps/web/src/api/endpoints.ts")).toMatch(
      /\.\.\.\(p\.draftId \? \{ draftId: p\.draftId \} : \{\}\)/,
    );
    expect(lesen("apps/web/src/lib/reasonerProvenance.ts")).toMatch(
      /draftId\?: string,\n\): ReasonerProvenance/,
    );
    expect(
      lesen("apps/web/src/pages/Capture.tsx").match(
        /draftProvenance\([^)]*draftId \?\? undefined\)/g,
      )?.length,
    ).toBeGreaterThanOrEqual(3);
  });
});
