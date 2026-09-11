import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { documentProvenance, draftProvenance } from "../../apps/web/src/lib/reasonerProvenance";
import { buildApp, buildServices } from "../../services/app/src/build-app";
// JOB 3353 B: die Kennung der typisierten Sperrantwort — aus der EINEN Quelle, nicht getippt.
import { CONFIDENTIAL_CLOUD_BLOCKED } from "../../services/app/src/routes/reasoner-routes";
import { ModelProvider, Reasoner } from "../../services/reasoner";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

const TEXT = "Nach dem Anfahren zehn Sekunden warten, dann die Pumpe entlüften.";
// JOB 3276: die Antwort, die dieses Test-Modell auf eine Überarbeitung gibt. Sie war bis hierher
// der EINGABETEXT — und genau das ist seit JOB 3276 kein Vorschlag mehr, sondern eine ehrliche
// Meldung (`tests/ki-assist-leer`). Dieser Test misst den EGRESS-Weg („hat die Cloud den Text
// gesehen?"), nicht die Güte der Überarbeitung; sein Modell verhält sich deshalb wie ein Modell,
// das wirklich etwas tut. Die Zusagen der Fälle unten bleiben Wort für Wort dieselben.
const UEBERARBEITET = "Nach dem Anfahren zehn Sekunden warten und die Pumpe danach entlüften.";
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
        return UEBERARBEITET;
      },
    }),
  );
  // JOB 3588: die GRUNDFREIGABE im Aufbau. Die Datei misst, dass die bestätigte DOKUMENTZUSTIMMUNG
  // den tiefen Zweig öffnet — `gesehen`/`bilder` müssen dafür wirklich gefüllt werden. Ohne die
  // Adminfreigabe des Kerns von JOB 3549 wäre der Zweig immer zu, und die Fälle „mit Zustimmung"
  // und „ohne Zustimmung" gäben dasselbe Ergebnis aus zwei verschiedenen Gründen.
  // KEIN `vertraulicheInhalte`: die Zusage dieser Datei ist, dass die Zustimmung Text auf INTERN
  // hebt — sie hebt ihn nicht über die Vertraulichkeitsgrenze, und der zweite Schalter würde genau
  // diese Grenze aufweichen.
  await erteileKiFreigabe(services.reasoner);
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
// JOB 3276: „keine Cloud" ist bei `assist` kein 200 mit geglättetem Originaltext mehr — ein Ersatz,
// der nur den Eingabetext zurückgibt, war ein Scheinvorschlag (tests/ki-assist-leer). Seither endet
// dieser Weg in einer ehrlichen Meldung, und seit JOB 3353 in einer typisierten Antwort.
//
// JOB 3353 B, RUNDE 4 — JEDER FALL SAGT VORHER, WAS ER ERWARTET.
//
// BENs Befund an Runde 3, und er trifft zu: der Helfer nahm die typisierte Sperre ODER den
// generischen 3276-Satz an, je nachdem was kam. Das ist eine ALTERNATIVE, keine Verschärfung — wer
// den typisierten Wurf entfernt, bekommt wieder den 500 mit dem alten Satz, und der Helfer nickt ihn
// durch. Die Rückgabe der Runde 3 hat das Gegenteil behauptet; das war falsch.
//
// JETZT VERLANGT JEDER AUFRUF EINE ANGABE, und sie ist ein Pflichtargument — ein Fall, der nichts
// sagt, kompiliert nicht:
//   · "cloud"                → 200, die Cloud hat wirklich gearbeitet,
//   · "unsaved_draft" | "declared" | "backstop"
//                            → 409 mit `CONFIDENTIAL_CLOUD_BLOCKED` und GENAU diesem Grund.
// Der Grund ist Teil der Zusage, nicht Beiwerk: er sagt dem Menschen, WAS er ändern muss, und drei
// verschiedene Sperren dürfen nicht dieselbe Prüfung bestehen.
//
// Was in beiden Formen unverändert weiter geprüft wird, ist die Sache dieses Tests: der geschützte
// Text steht in keiner Fehlerantwort, und die Fälle unten zählen daneben den Cloud-Spion (`gesehen`).
type SperrGrund = "unsaved_draft" | "declared" | "backstop";
async function reasoner(
  a: Aufbau,
  // Die Erwartung steht VORN und ohne Vorgabewert: sie ist die Aussage des Falles, nicht sein
  // Beiwerk — und so verlangt sie der Compiler von jedem Aufruf.
  erwartet: "cloud" | SperrGrund,
  provenance: object = draftProvenance(undefined, a.koId),
  binding = a.binding,
): Promise<{ demo: boolean }> {
  const response = await a.app.inject({
    method: "POST",
    url: "/api/reasoner",
    headers: { ...a.headers, ...binding, "content-type": "application/json" },
    payload: { task: "assist", text: TEXT, ...provenance },
  });
  if (erwartet === "cloud") {
    expect(response.statusCode, response.body).toBe(200);
    return response.json() as { demo: boolean };
  }
  // Der Sperrfall hat GENAU EINE zulässige Form. Ein 500, ein Zeitlimit, ein Absturz oder ein 409
  // mit dem falschen Grund macht den Fall rot — „kein Egress" darf nie aus einem Ausfall abgeleitet
  // werden, und ein falscher Grund schickt den Menschen an die falsche Stelle.
  expect(response.statusCode, response.body).toBe(409);
  const koerper = response.json() as { message?: unknown; code?: unknown; reason?: unknown };
  expect(koerper.code, response.body).toBe(CONFIDENTIAL_CLOUD_BLOCKED);
  expect(koerper.reason, response.body).toBe(erwartet);
  expect(String(koerper.message).length).toBeGreaterThan(0);
  // Und der geschützte Text steht in keiner Fehlerantwort.
  expect(response.body).not.toContain(TEXT);
  return { demo: true };
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
    expect(await reasoner(a, "cloud")).toMatchObject({
      demo: false,
      text: UEBERARBEITET,
    });
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
    expect(response).toMatchObject({ demo: false, text: UEBERARBEITET });
    expect(a.gesehen.join("\n")).toContain(TEXT);
  });
  it.each(["Reasoner", "Word"])("Z3 Ohne Zustimmung: %s vertraulich, kein Egress", async (weg) => {
    const a = await aufbauen(false);
    if (weg === "Word") {
      expect((await word(a)).konfliktpruefung.grund).toBe("vertraulich");
    } else {
      // Der Anker ist auflösbar (internes KO), gesperrt hat die fehlende Zustimmung → `declared`.
      expect((await reasoner(a, "declared")).demo).toBe(true);
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
      expect((await reasoner(a, "declared", undefined, fremd)).demo).toBe(true);
    }
    expect(a.gesehen).toEqual([]);
  });
  it.each(["vertraulich", "streng_vertraulich"] as const)(
    "Z5 Explizit %s bleibt trotz Zustimmung vertraulich",
    async (level) => {
      const a = await aufbauen();
      // Hier ist die EINSTUFUNG dieses Aufrufs die Ursache — genau das sagt `declared`.
      expect((await reasoner(a, "declared", draftProvenance(level, a.koId))).demo).toBe(true);
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
      expect((await reasoner(a, "declared", provenance)).demo).toBe(true);
      expect((await word(a, provenance)).konfliktpruefung.grund).toBe("vertraulich");
      expect(a.gesehen).toEqual([]);
    },
  );
  it.each([undefined, "nicht-gespeichert"])(
    "Z7 Draft ohne auflösbaren Anker %s bleibt vertraulich",
    async (koId) => {
      const a = await aufbauen();
      // KEIN auflösbarer Anker (JOB 2692 D2) — der Mensch sichert, also `unsaved_draft`.
      expect((await reasoner(a, "unsaved_draft", draftProvenance(undefined, koId))).demo).toBe(
        true,
      );
      expect(a.gesehen).toEqual([]);
    },
  );
  it("Z8 Ohne Klara-Bindung: alter Konsolenvertrag bleibt", async () => {
    const a = await aufbauen();
    const ungebunden = {} as Aufbau["binding"];
    expect((await reasoner(a, "declared", undefined, ungebunden)).demo).toBe(true);
    expect((await word(a, undefined, ungebunden)).konfliktpruefung.grund).toBe("vertraulich");
    expect(a.gesehen).toEqual([]);
    expect((await reasoner(a, "cloud", draftProvenance("intern", a.koId), ungebunden)).demo).toBe(
      false,
    );
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
  // Der Anker ist auflösbar, aber der GESPEICHERTE Stand trägt die Stufe → `backstop`: umgestuft
  // wird das gespeicherte Objekt, nicht das Formular.
  expect((await reasoner(a, "backstop", draftProvenance(undefined, response.json().id))).demo).toBe(
    true,
  );
  expect(
    (await word(a, { source: "transient-document", koId: response.json().id })).konfliktpruefung
      .grund,
  ).toBe("vertraulich");
  expect(a.gesehen).toEqual([]);
});

it("Z2 ohne Marker: fehlendes Drahtfeld öffnet nur bei bestätigter Zustimmung", async () => {
  const a = await aufbauen();
  expect((await reasoner(a, "cloud", { source: "draft", koId: a.koId })).demo).toBe(false);
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
    // Der Entwurf ist GESPEICHERT, die Kennung reist mit: bei „intern" arbeitet die Cloud, bei
    // „vertraulich" hebt der gespeicherte Stand → `backstop` (nicht `unsaved_draft`, der Anker ist da).
    const response = await reasoner(
      a,
      level === "vertraulich" ? "backstop" : "cloud",
      draftProvenance(undefined, undefined, draft.id),
    );
    expect(response.demo).toBe(level === "vertraulich");
    expect(a.gesehen.length > 0).toBe(level === "intern");
  },
);

it("Unvollständige Bindung sperrt auch ausdrücklich internen Text", async () => {
  const a = await aufbauen();
  const binding = { ...a.binding, "x-klara-instance": "" };
  expect((await reasoner(a, "declared", draftProvenance("intern", a.koId), binding)).demo).toBe(
    true,
  );
  expect(
    (await word(a, { source: "transient-document", confidentiality: "intern" }, binding))
      .konfliktpruefung.grund,
  ).toBe("vertraulich");
  expect(a.gesehen).toEqual([]);
});
