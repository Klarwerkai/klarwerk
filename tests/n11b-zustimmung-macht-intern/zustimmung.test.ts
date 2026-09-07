import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { documentProvenance, draftProvenance } from "../../apps/web/src/lib/reasonerProvenance";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { ModelProvider, Reasoner } from "../../services/reasoner";

const TEXT = "Nach dem Anfahren zehn Sekunden warten, dann die Pumpe entlüften.";
const apps: ReturnType<typeof buildApp>[] = [];
beforeEach(() => vi.stubEnv("KLARWERK_ADDON_API", "1"));
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// Das Word-taskpane sendet im W6-Weg noch weder deep noch Klara-Bindung; Z1 prüft den
// angeforderten Routervertrag mit diesen zusätzlichen Eingaben (siehe einstiege.test.ts).
// Echte Kompositionswurzel, Auth, Klara-Sitzung und Zustimmung. Nur der externe Modelltransport
// schreibt mit; keine eingesetzte Policy, kein eingesetzter Freigabeprüfer, kein Sitzungsmock.
async function aufbauen(zustimmen = true, modellfehler = false) {
  const gesehen: string[] = [];
  const bilder: string[] = [];
  const services = buildServices();
  services.reasoner = new Reasoner(
    new ModelProvider({
      name: "anthropic-n11b",
      completeVision: async (_system, dataUrl, prompt) => {
        bilder.push(`${dataUrl}\n${prompt}`);
        return "Eine Pumpe.";
      },
      complete: async (system, prompt) => {
        gesehen.push(`${system}\n${prompt}`);
        if (system.includes('"kein_konflikt"') && !modellfehler) {
          return JSON.stringify({
            relation: "kein_konflikt",
            older: null,
            confidence: 0.95,
            begruendung: "Die beiden Aussagen widersprechen sich nicht.",
            zitat_a: "Pumpe entlüften",
            zitat_b: "Pumpe entlüften",
          });
        }
        return TEXT;
      },
    }),
  );
  const app = buildApp(services);
  apps.push(app);
  const registration = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "N11b", email: "n11b@example.test", password: "test-password-3244" },
  });
  expect(registration.statusCode).toBe(201);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "n11b@example.test", password: "test-password-3244" },
  });
  expect(login.statusCode).toBe(200);
  const headers = { authorization: `Bearer ${login.json().token}` };
  const ko = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      title: "Pumpe entlüften",
      statement: TEXT,
      type: "best_practice",
      category: "Wartung",
      confidentiality: "intern",
    },
  });
  expect(ko.statusCode).toBe(201);
  const session = await app.inject({
    method: "POST",
    url: "/api/klara/sessions",
    headers: { ...headers, "x-klara-instance": "n11b-instance" },
    payload: {
      addinInstanceId: "n11b-instance",
      documentDescriptor: { kind: "saved", hostDocumentId: "n11b-document" },
    },
  });
  expect(session.statusCode).toBe(201);
  const binding = {
    "x-klara-session": session.json().sessionId as string,
    "x-klara-instance": "n11b-instance",
    "x-klara-document": session.json().documentContextId as string,
  };
  expect(binding["x-klara-session"]).toBeTruthy();
  expect(binding["x-klara-document"]).toBeTruthy();
  if (zustimmen) {
    const consent = await app.inject({
      method: "POST",
      url: `/api/klara/sessions/${binding["x-klara-session"]}/consent`,
      headers: { ...headers, ...binding },
    });
    expect(consent.statusCode, consent.body).toBe(200);
    expect(consent.json().consentState).toBe("granted");
  }
  gesehen.length = 0;
  return { services, app, headers, binding, gesehen, bilder, koId: ko.json().id as string };
}
type Aufbau = Awaited<ReturnType<typeof aufbauen>>;
async function reasoner(
  a: Aufbau,
  provenance: object = draftProvenance(undefined, a.koId),
  binding = a.binding,
) {
  const response = await a.app.inject({
    method: "POST",
    url: "/api/reasoner",
    headers: { ...a.headers, ...binding, "content-type": "application/json" },
    payload: { task: "assist", text: TEXT, ...provenance },
  });
  expect(response.statusCode, response.body).toBe(200);
  return response.json();
}
async function word(
  a: Aufbau,
  provenance: object = { source: "transient-document" },
  binding = a.binding,
) {
  const response = await a.app.inject({
    method: "POST",
    url: "/api/check-text",
    headers: { ...a.headers, ...binding, "content-type": "application/json" },
    payload: { text: TEXT, want: "deep", ...provenance },
  });
  expect(response.statusCode, response.body).toBe(200);
  return response.json();
}

describe("N11b: bestätigte Dokumentzustimmung am echten Router", () => {
  it("Z1 Word: Zustimmung öffnet den tiefen Zweig für nicht eingestuften Text", async () => {
    const a = await aufbauen();
    const result = await word(a);
    expect(result.konfliktpruefung.grund).not.toBe("vertraulich");
    expect(result.konfliktpruefung).toMatchObject({ gelaufen: true, grund: null, ausgefallen: 0 });
    expect(result.konfliktpruefung.kandidaten).toBeGreaterThan(0);
    expect(a.gesehen.join("\n")).toContain(TEXT);
    expect(result.persisted).toBe(false);
  });
  it("Z1 Modellfehler nach Zustimmung: kein falsches gelaufen und kein Vertraulichkeitsgrund", async () => {
    const a = await aufbauen(true, true);
    const result = await word(a);
    expect(result.konfliktpruefung).toMatchObject({ gelaufen: false, grund: "modellfehler" });
    expect(result.konfliktpruefung.kandidaten).toBeGreaterThan(0);
    expect(a.gesehen.join("\n")).toContain(TEXT);
  });
  it("Z2 Reasoner: Zustimmung und auflösbarer Anker öffnen den Cloud-Weg", async () => {
    const a = await aufbauen();
    expect(await reasoner(a)).toMatchObject({ demo: false, text: TEXT });
    expect(a.gesehen.length).toBeGreaterThan(0);
    expect(a.gesehen.join("\n")).toContain(TEXT);
  });
  it("Z2 Web-Versand: der unveränderte serialisierte Rumpf erreicht den echten Router", async () => {
    const a = await aufbauen();
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      expect(url).toBe("/api/reasoner");
      expect(init.method).toBe("POST");
      expect(new Headers(init.headers).get("content-type")).toBe("application/json");
      const response = await a.app.inject({
        method: "POST",
        url,
        // Die bestehende Klara-Bindung kommt aus dem Testaufbau; der reine Browser-Editor
        // hat heute keine eigene Zustimmungsquelle. Der serialisierte Body bleibt unverändert.
        headers: { ...a.headers, ...a.binding, "content-type": "application/json" },
        payload: String(init.body),
      });
      expect(response.statusCode).toBe(200);
      return new Response(response.body, { status: response.statusCode });
    });
    const response = await endpoints.reasoner.assist(
      TEXT,
      "de",
      undefined,
      draftProvenance(undefined, a.koId),
    );
    expect(response).toMatchObject({ demo: false, text: TEXT });
    expect(a.gesehen.join("\n")).toContain(TEXT);
  });
  it.each(["Reasoner", "Word"])("Z3 Ohne Zustimmung: %s vertraulich, kein Egress", async (weg) => {
    const a = await aufbauen(false);
    if (weg === "Word") {
      expect((await word(a)).konfliktpruefung.grund).toBe("vertraulich");
    } else {
      expect((await reasoner(a)).demo).toBe(true);
    }
    expect(a.gesehen).toEqual([]);
  });
  it.each(
    ["x-klara-session", "x-klara-document", "x-klara-instance"].flatMap((header) =>
      ["Reasoner", "Word"].map((weg) => ({ header, weg })),
    ),
  )("Z4 Fremde Bindung $header: $weg ohne Egress", async ({ header, weg }) => {
    const a = await aufbauen();
    const fremd = { ...a.binding, [header]: "fremd" };
    if (weg === "Word") {
      expect((await word(a, undefined, fremd)).konfliktpruefung.grund).toBe("vertraulich");
    } else {
      expect((await reasoner(a, undefined, fremd)).demo).toBe(true);
    }
    expect(a.gesehen).toEqual([]);
  });
  it.each(["vertraulich", "streng_vertraulich"] as const)(
    "Z5 Explizit %s bleibt trotz Zustimmung vertraulich",
    async (level) => {
      const a = await aufbauen();
      expect((await reasoner(a, draftProvenance(level, a.koId))).demo).toBe(true);
      expect(
        (await word(a, { source: "transient-document", confidentiality: level })).konfliktpruefung
          .grund,
      ).toBe("vertraulich");
      expect(a.gesehen).toEqual([]);
    },
  );
  it.each(["ko", undefined, "unbekannt"])(
    "Z6 Quelle %s ersetzt keinen Textanker",
    async (source) => {
      const a = await aufbauen();
      const provenance = { source, koId: a.koId };
      expect((await reasoner(a, provenance)).demo).toBe(true);
      expect((await word(a, provenance)).konfliktpruefung.grund).toBe("vertraulich");
      expect(a.gesehen).toEqual([]);
    },
  );
  it.each([undefined, "nicht-gespeichert"])(
    "Z7 Draft ohne auflösbaren Anker %s bleibt vertraulich",
    async (koId) => {
      const a = await aufbauen();
      expect((await reasoner(a, draftProvenance(undefined, koId))).demo).toBe(true);
      expect(a.gesehen).toEqual([]);
    },
  );
  it("Z8 Ohne Klara-Bindung: alter Konsolenvertrag bleibt", async () => {
    const a = await aufbauen();
    const ungebunden = {} as Aufbau["binding"];
    expect((await reasoner(a, undefined, ungebunden)).demo).toBe(true);
    expect((await word(a, undefined, ungebunden)).konfliktpruefung.grund).toBe("vertraulich");
    expect(a.gesehen).toEqual([]);
    expect((await reasoner(a, draftProvenance("intern", a.koId), ungebunden)).demo).toBe(false);
    expect(a.gesehen.length).toBeGreaterThan(0);
  });
});

describe("N11b R3: Dokumentzustimmung stuft ausschließlich Text herab", () => {
  const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAAA";
  it.each(["draft", "transient-document"] as const)(
    "B1 Bildquelle %s: fehlend, ungültig und Marker bleiben mit und ohne Zustimmung gesperrt",
    async (source) => {
      for (const zustimmen of [false, true]) {
        const a = await aufbauen(zustimmen);
        const make = source === "draft" ? draftProvenance : documentProvenance;
        for (const provenance of [
          { source, koId: a.koId },
          { source, koId: a.koId, confidentiality: "" },
          make(undefined, a.koId),
          make("vertraulich", a.koId),
          make("streng_vertraulich", a.koId),
        ]) {
          const response = await a.app.inject({
            method: "POST",
            url: "/api/reasoner/describe",
            headers: { ...a.headers, ...a.binding },
            payload: { dataUrl, context: TEXT, ...provenance },
          });
          expect(response.statusCode, response.body).toBe(200);
          expect(response.json()).toMatchObject({
            text: null,
            demo: true,
            fallbackReason: "confidential",
          });
          expect(a.bilder).toEqual([]);
          expect(a.gesehen).toEqual([]);
        }
      }
    },
  );
  it("B2 Bildkalibrierung: ausdrücklich intern öffnet nur mit Zustimmung oder ohne Klara-Bindung", async () => {
    for (const zustimmen of [false, true]) {
      const a = await aufbauen(zustimmen);
      for (const binding of [a.binding, {}]) {
        a.bilder.length = 0;
        const response = await a.app.inject({
          method: "POST",
          url: "/api/reasoner/describe",
          headers: { ...a.headers, ...binding },
          payload: { dataUrl, context: TEXT, ...draftProvenance("intern", a.koId) },
        });
        expect(response.statusCode).toBe(200);
        const erlaubt = zustimmen || Object.keys(binding).length === 0;
        expect(response.json().demo).toBe(!erlaubt);
        expect(a.bilder).toHaveLength(erlaubt ? 1 : 0);
        if (erlaubt) {
          expect(a.bilder[0]).toContain(dataUrl);
          expect(a.bilder[0]).toContain(TEXT);
        }
      }
    }
  });
});

it("Bestands-Backstop: gespeichert vertrauliches KO hebt trotz Zustimmung und Marker", async () => {
  const a = await aufbauen();
  const response = await a.app.inject({
    method: "POST",
    url: "/api/kos",
    headers: a.headers,
    payload: {
      title: "Geschütztes Wissen",
      statement: TEXT,
      type: "best_practice",
      category: "Wartung",
      confidentiality: "vertraulich",
    },
  });
  expect(response.statusCode).toBe(201);
  a.gesehen.length = 0;
  expect((await reasoner(a, draftProvenance(undefined, response.json().id))).demo).toBe(true);
  expect(
    (await word(a, { source: "transient-document", koId: response.json().id })).konfliktpruefung
      .grund,
  ).toBe("vertraulich");
  expect(a.gesehen).toEqual([]);
});

it("Z2 ohne Marker: fehlendes Drahtfeld öffnet nur bei bestätigter Zustimmung", async () => {
  const a = await aufbauen();
  expect((await reasoner(a, { source: "draft", koId: a.koId })).demo).toBe(false);
  expect(a.gesehen.length).toBeGreaterThan(0);
});

it.each(["intern", "vertraulich"] as const)(
  "Draft-Backstop %s: Zustimmung erhält die gespeicherte Schutzstufe",
  async (level) => {
    const a = await aufbauen();
    const draft = await a.services.capture.createDraft(
      { title: "Entwurf", statement: TEXT, confidentiality: level },
      "n11b-autor",
    );
    const response = await reasoner(a, draftProvenance(undefined, undefined, draft.id));
    expect(response.demo).toBe(level === "vertraulich");
    expect(a.gesehen.length > 0).toBe(level === "intern");
  },
);

it("Unvollständige Bindung sperrt auch ausdrücklich internen Text", async () => {
  const a = await aufbauen();
  const binding = { ...a.binding, "x-klara-instance": "" };
  expect((await reasoner(a, draftProvenance("intern", a.koId), binding)).demo).toBe(true);
  expect(
    (await word(a, { source: "transient-document", confidentiality: "intern" }, binding))
      .konfliktpruefung.grund,
  ).toBe("vertraulich");
  expect(a.gesehen).toEqual([]);
});
