// ================================================================================================
// JOB 3243 · M3c-UI, Pflichtlieferung 6 — DER W6-ANSCHLUSS AM ECHTEN ROUTER, MIT UND OHNE ZUSTIMMUNG.
// ================================================================================================
//
// Runde 1 hat den Anschluss GEBAUT und nur belegt, WAS der Panelweg sendet — die Wirkung stand als
// REST in der Rückgabe, weil JOB 3244 (die Serverhälfte) im damaligen Basisstand fehlte. Er ist
// inzwischen eingebaut (main `4c97829`, ship 1.0.0-beta.1.181), und damit ist diese Datei fällig:
// hier läuft die ganze Kette.
//
// WAS GEMESSEN WIRD, und woher jedes Stück kommt:
//   · Rumpf und Kopfzeilen entstehen im AUSGELIEFERTEN `w6DublettenAusCheckText`, aus
//     `apps/web/public/word-addin/taskpane.html` geschnitten und ausgeführt — kein nachgebauter
//     Rumpf, keine Attrappe. Was der Weg absetzt, geht ZEICHENGLEICH an `app.inject`.
//   · Der Server ist die echte Kompositionswurzel (`buildApp(buildServices())`), mit echter
//     Anmeldung, echter Klara-Sitzung und echter Zustimmung — kein eingesetzter Freigabeprüfer,
//     kein Sitzungsmock. Vorlage: `tests/n11b-zustimmung-macht-intern/zustimmung.test.ts:20-100`.
//   · Der externe Modelltransport schreibt mit (`gesehen`): so ist Egress kein Urteil, sondern eine
//     Beobachtung.
//
// DIE EHRLICHE UNTERSCHEIDUNG, die dieser Test festhält (und die in der Rückgabe steht):
// `confidential` steuert im Handler AUSSCHLIESSLICH `deepAllowed`
// (`check-text-routes.ts:656`, `konfliktpruefungVon` :272-276). Der Bestandsweg des Panels sendet
// bewusst NIE `want: "deep"` — der Dokumenttext bleibt im Haus (JOB 3093). Am Panelweg selbst
// ändert der Marker deshalb heute NICHTS an der Antwort (R1), und genau das steht hier als
// gemessene Zusage. Was er ändert, ist die EINSTUFUNG: R2/R3 fordern denselben Rumpf einmal mit
// `want: "deep"` an und zeigen, dass er mit Zustimmung intern ist und ohne sie vertraulich bleibt.
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { ModelProvider, Reasoner } from "../../services/reasoner";

const TEXT =
  "Vor jeder Wartung an der Presse P2 ist der Hauptschalter abzuschließen und der Druck im " +
  "Hydrauliksystem vollständig abzubauen.";

const apps: ReturnType<typeof buildApp>[] = [];
beforeEach(() => vi.stubEnv("KLARWERK_ADDON_API", "1"));
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  vi.unstubAllEnvs();
});

/** Der AUSGELIEFERTE W6-Weg, geschnitten und ausgeführt; `klaraS4Header` wie zur Laufzeit gestellt. */
type W6Weg = (
  grund: string,
  leseText: () => string,
  fetchFn: (url: string, init: Record<string, unknown>) => Promise<unknown>,
  sprache: string,
) => Promise<unknown>;
function w6Weg(bindung: Record<string, string>): W6Weg {
  const html = readFileSync("apps/web/public/word-addin/taskpane.html", "utf8");
  const start = html.indexOf("    function w6DublettenAusCheckText(");
  const end = html.indexOf("    // KW-KLARA-W6-CHECKTEXT-END", start);
  expect(start, "w6DublettenAusCheckText nicht auffindbar").toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  const gestellt =
    "var W6_HOECHSTZEICHEN=8000; var W6_MINDESTZEICHEN=40;" +
    "function klaraS4Header() { return kopfzeilenDerBindung; }";
  return new Function(
    "kopfzeilenDerBindung",
    `${gestellt}${html.slice(start, end)}; return w6DublettenAusCheckText;`,
  )(bindung) as W6Weg;
}

/** Echte Wurzel, echte Anmeldung, echte Klara-Sitzung, echte Zustimmung. */
async function aufbauen(zustimmen: boolean) {
  const gesehen: string[] = [];
  const services = buildServices();
  services.reasoner = new Reasoner(
    new ModelProvider({
      name: "anthropic-3243",
      complete: async (system: string, prompt: string) => {
        gesehen.push(`${system}\n${prompt}`);
        return JSON.stringify({
          relation: "kein_konflikt",
          older: null,
          confidence: 0.9,
          begruendung: "Die beiden Aussagen widersprechen sich nicht.",
          zitat_a: "Hauptschalter abschließen",
          zitat_b: "Hauptschalter abschließen",
        });
      },
    }),
  );
  const app = buildApp(services);
  apps.push(app);
  const anmeldung = { email: "m3c@example.test", password: "test-password-3243" };
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "M3c", ...anmeldung },
      })
    ).statusCode,
  ).toBe(201);
  const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: anmeldung });
  expect(login.statusCode).toBe(200);
  const headers = { authorization: `Bearer ${login.json().token}` };
  const ko = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      title: "Wartung Presse P2",
      statement: TEXT,
      type: "best_practice",
      category: "Instandhaltung",
      confidentiality: "intern",
    },
  });
  expect(ko.statusCode).toBe(201);
  const sitzung = await app.inject({
    method: "POST",
    url: "/api/klara/sessions",
    headers: { ...headers, "x-klara-instance": "m3c-instance" },
    payload: {
      addinInstanceId: "m3c-instance",
      documentDescriptor: { kind: "saved", hostDocumentId: "m3c-document" },
    },
  });
  expect(sitzung.statusCode).toBe(201);
  const bindung = {
    "x-klara-session": sitzung.json().sessionId as string,
    "x-klara-instance": "m3c-instance",
    "x-klara-document": sitzung.json().documentContextId as string,
  };
  expect(bindung["x-klara-session"]).toBeTruthy();
  expect(bindung["x-klara-document"]).toBeTruthy();
  if (zustimmen) {
    const consent = await app.inject({
      method: "POST",
      url: `/api/klara/sessions/${bindung["x-klara-session"]}/consent`,
      headers: { ...headers, ...bindung },
    });
    expect(consent.statusCode, consent.body).toBe(200);
    expect(consent.json().consentState).toBe("granted");
  }
  gesehen.length = 0;
  return { app, headers, bindung, gesehen };
}

/**
 * Der Panelweg gegen die echte Route. Rumpf und Kopfzeilen kommen aus dem ausgelieferten Skript;
 * `zusatz` kommt NUR dort dazu, wo der Test es sagt (R2/R3 fordern den tiefen Zweig an, den der
 * Bestandsweg von sich aus nie anfordert), `weglassen` streicht ein Feld für die Gegenprobe.
 */
async function panelweg(
  a: Awaited<ReturnType<typeof aufbauen>>,
  zusatz: Record<string, unknown> = {},
  weglassen: string[] = [],
) {
  let abgesetzt: { koerper: Record<string, unknown>; kopf: Record<string, string> } | null = null;
  let antwort: { statusCode: number; body: string } | null = null;
  await w6Weg(a.bindung)(
    "bestand",
    () => TEXT,
    async (url, init) => {
      const kopf = init.headers as Record<string, string>;
      const koerper = JSON.parse(String(init.body)) as Record<string, unknown>;
      abgesetzt = { koerper: { ...koerper }, kopf: { ...kopf } };
      for (const feld of weglassen) {
        Reflect.deleteProperty(koerper, feld);
      }
      const res = await a.app.inject({
        method: "POST",
        url,
        headers: { ...a.headers, ...kopf },
        payload: JSON.stringify({ ...koerper, ...zusatz }),
      });
      antwort = { statusCode: res.statusCode, body: res.body };
      return { ok: res.statusCode < 300, status: res.statusCode, json: async () => res.json() };
    },
    "de",
  );
  expect(abgesetzt, "der Panelweg hat nichts abgesetzt").not.toBeNull();
  expect(antwort, "die Route hat nicht geantwortet").not.toBeNull();
  const fertig = antwort as unknown as { statusCode: number; body: string };
  expect(fertig.statusCode, fertig.body).toBe(200);
  return {
    ...(abgesetzt as unknown as { koerper: Record<string, unknown>; kopf: Record<string, string> }),
    antwort: JSON.parse(fertig.body) as Record<string, never>,
  };
}

describe("JOB 3243 · Lieferung 6 · der Panelweg an der echten /api/check-text-Route", () => {
  it("R1 · was der Panelweg WIRKLICH absetzt, kommt an: Marker im Rumpf, Bindung im Kopf, 200 — und keine Cloud", async () => {
    const a = await aufbauen(true);
    const lauf = await panelweg(a);
    // Der Rumpf ist der des ausgelieferten Fensters, nicht der des Tests.
    expect(lauf.koerper.nichtEingestuft).toBe(true);
    expect(lauf.koerper.confidentiality).toBeUndefined();
    expect(lauf.koerper.want).toBeUndefined();
    expect(lauf.kopf["x-klara-session"]).toBe(a.bindung["x-klara-session"]);
    expect(lauf.kopf["x-klara-document"]).toBe(a.bindung["x-klara-document"]);
    // OHNE `want: "deep"` fordert dieser Weg den tiefen Zweig nicht an — die Zustimmung öffnet
    // deshalb NICHTS am Bestandsweg. Genau das steht hier, statt einen Nutzen zu behaupten.
    expect(lauf.antwort.konfliktpruefung).toMatchObject({
      gelaufen: false,
      grund: "nicht_angefordert",
    });
    expect(a.gesehen, "der Dokumenttext hat trotz Zustimmung das Haus verlassen").toEqual([]);
  });

  it("R2 · MIT Zustimmung gilt der nicht eingestufte Panel-Rumpf als intern — der tiefe Zweig läuft", async () => {
    const a = await aufbauen(true);
    const lauf = await panelweg(a, { want: "deep" });
    expect(lauf.antwort.konfliktpruefung).toMatchObject({ grund: null, gelaufen: true });
    expect(a.gesehen.join("\n")).toContain(TEXT);
  });

  it("R3 · OHNE Zustimmung bleibt derselbe Rumpf vertraulich — kein Egress", async () => {
    const a = await aufbauen(false);
    const lauf = await panelweg(a, { want: "deep" });
    expect(lauf.antwort.konfliktpruefung).toMatchObject({ grund: "vertraulich" });
    expect(a.gesehen).toEqual([]);
  });

  it("R4 · GEMESSEN, nicht behauptet: an DIESEM Weg wirkt die Bindung, nicht der Marker — ohne ihn bleibt es intern", async () => {
    // Ohne den Marker, sonst alles gleich: die Route stuft weiter als intern ein. Das ist kein
    // Defekt, sondern der Vertrag von JOB 3244 — `classifyProvenanceConfidential`
    // (reasoner-routes.ts:47-53) liest „keine der drei Stufen deklariert" schon als „nicht
    // eingestuft", und der Panelweg deklariert seit jeher nichts. Der Marker ist hier also die
    // AUSDRÜCKLICHE Form derselben Aussage, keine zusätzliche Wirkung. Das steht hier als Zusage,
    // damit niemand aus Lieferung 6 einen Nutzen liest, den sie an diesem Weg nicht hat; wo der
    // Marker WIRKLICH den Ausschlag gibt, misst R6.
    const a = await aufbauen(true);
    const lauf = await panelweg(a, { want: "deep" }, ["nichtEingestuft"]);
    expect(lauf.koerper.nichtEingestuft, "der Weg sendet den Marker sehr wohl").toBe(true);
    expect(lauf.antwort.konfliktpruefung).toMatchObject({ grund: null, gelaufen: true });
  });

  it("R5 · GEGENPROBE: OHNE die Klara-Kopfzeilen bleibt derselbe Rumpf vertraulich — sie sind das wirksame Stück", async () => {
    const a = await aufbauen(true);
    // Der Panelweg schickt die Bindung nur VOLLSTÄNDIG; hier steht das Fenster vor
    // `POST /api/klara/sessions` — also keine Kopfzeilen, obwohl die Zustimmung längst erteilt ist.
    const leer = {
      "x-klara-session": "",
      "x-klara-instance": "m3c-instance",
      "x-klara-document": "",
    };
    let antwort: { statusCode: number; body: string } | null = null;
    await w6Weg(leer)(
      "bestand",
      () => TEXT,
      async (url, init) => {
        const kopf = init.headers as Record<string, string>;
        expect(kopf["x-klara-session"], "eine halbe Bindung ist mitgereist").toBeUndefined();
        const res = await a.app.inject({
          method: "POST",
          url,
          headers: { ...a.headers, ...kopf },
          payload: JSON.stringify({ ...JSON.parse(String(init.body)), want: "deep" }),
        });
        antwort = { statusCode: res.statusCode, body: res.body };
        return { ok: res.statusCode < 300, status: res.statusCode, json: async () => res.json() };
      },
      "de",
    );
    const fertig = antwort as unknown as { statusCode: number; body: string };
    expect(fertig.statusCode, fertig.body).toBe(200);
    expect(JSON.parse(fertig.body).konfliktpruefung).toMatchObject({ grund: "vertraulich" });
    expect(a.gesehen).toEqual([]);
  });

  it('R6 · DORT wirkt der Marker: ein gewaschenes `confidentiality: "vertraulich"` bleibt ohne ihn vertraulich', async () => {
    // Die Lage, für die JOB 3244 den Marker überhaupt eingeführt hat (endpoints.ts): ein Client,
    // der pflichtgemäß eine Stufe mitschickt, obwohl der Mensch nichts eingestuft hat. Der Panelweg
    // tut das heute nicht — aber wenn er es täte, entscheidet allein der Marker. Beide Richtungen,
    // damit die Zusage nicht von einem einzigen Wert abhängt.
    const mit = await aufbauen(true);
    expect(
      (await panelweg(mit, { want: "deep", confidentiality: "vertraulich" })).antwort
        .konfliktpruefung,
    ).toMatchObject({ grund: null, gelaufen: true });

    const ohne = await aufbauen(true);
    expect(
      (await panelweg(ohne, { want: "deep", confidentiality: "vertraulich" }, ["nichtEingestuft"]))
        .antwort.konfliktpruefung,
    ).toMatchObject({ grund: "vertraulich" });
    expect(ohne.gesehen).toEqual([]);
  });
});
