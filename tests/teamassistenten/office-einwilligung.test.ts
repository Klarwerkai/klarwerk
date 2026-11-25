import {
  type MockInstance,
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import { ABSAGE_MARKE } from "../../services/reasoner/src/provider-model";
import { mitKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";
import { anfrage, fachbereich } from "./aufbau";

const transport = vi.hoisted(() => vi.fn(async (_system: string, _user: string) => ""));
// Keep the real request, consent, provider binding, ranking and Ask implementation.
// Only the external model transport is replaced. It has no network client or credentials.
vi.mock("../../services/reasoner", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/reasoner")>()),
  createCappedCloudClientFromEnv: () => ({
    openai: { name: "cloud:openai:test", complete: transport },
    anthropic: undefined,
    gruende: {},
  }),
  createCappedLocalClientFromEnv: () => undefined,
}));

describe("persönliche Office-Einwilligung für freigegebene Teamassistenten", () => {
  const frage = "Must guest Wi-Fi provide access to the staff network?";
  let app: ReturnType<typeof buildApp>;
  let bereich: Awaited<ReturnType<typeof fachbereich>>;
  let s: ReturnType<typeof assembleServices>;
  let askAufrufe: MockInstance<typeof s.ask.ask>;
  const bodyFlags = {
    erlaubt: true,
    modellErlaubt: true,
    mode: "external",
    retrievalOnly: false,
    dokumenttextFreigegeben: true,
  };
  beforeAll(async () => {
    s = assembleServices(inMemoryRepos());
    await s.reasoner.setTaskConfig(mitKiFreigabe({ global: "openai", perTask: {} }));
    await s.ko.activateSearchProjectionV2();
    app = buildApp(s);
    bereich = await fachbereich(s, app);
    // No source covers the author's negative example used during setup.
    transport.mockResolvedValue(ABSAGE_MARKE);
    const autor = anfrage(app, bereich.autor.token);
    const probe = await autor("POST", `${bereich.pfad}/pruefen`, { revision: 1, sprache: "en" });
    expect(probe.json().pruefung.bestanden, probe.body).toBe(true);
    const frei = await autor("POST", `${bereich.pfad}/freigeben`, { revision: 2, version: 1 });
    expect(frei.statusCode, frei.body).toBe(200);
    askAufrufe = vi.spyOn(s.ask, "ask");
  });
  beforeEach(() => {
    transport.mockClear().mockResolvedValue(`${bereich.aussage} [1]`);
    askAufrufe.mockClear();
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    await app?.close();
  });
  async function sitzung(addinInstanceId: string) {
    const r = await anfrage(app, bereich.leser.token)("POST", "/api/klara/sessions", {
      addinInstanceId,
      documentDescriptor: { kind: "saved", hostDocumentId: `doc-${addinInstanceId}` },
    });
    expect(r.statusCode, r.body).toBe(201);
    const { sessionId, documentContextId, resolution } = r.json();
    expect(resolution.executionAllowed).toBe(true);
    return {
      "x-klara-session": sessionId as string,
      "x-klara-instance": addinInstanceId,
      "x-klara-document": documentContextId as string,
    };
  }
  function office(headers: Record<string, string>, inhalt = frage) {
    return app.inject({
      method: "POST",
      url: `/api/office/teamassistenten/${bereich.id}/fragen`,
      headers: { authorization: `Bearer ${bereich.leser.token}`, ...headers },
      payload: { version: 1, sprache: "en", frage: inhalt, ...bodyFlags },
    });
  }
  async function gesperrt(headers: Record<string, string>) {
    const r = await office(headers);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().antwort).toMatchObject({ stand: "offen", quellen: [] });
    expect(askAufrufe).not.toHaveBeenCalled();
    expect(transport).not.toHaveBeenCalled();
  }
  it("lässt ohne Sitzung auch mit angeblicher Freigabe im Body keine Modellanfrage zu", async () => {
    await gesperrt({});
  });
  it("prüft Sitzungskennung, Add-in-Instanz und Dokumentbindung unabhängig vom Body", async () => {
    const h = await sitzung("word-getrennt");
    await gesperrt({
      "x-klara-session": h["x-klara-session"],
      "x-klara-instance": h["x-klara-instance"],
    });
    await gesperrt({ ...h, "x-klara-instance": "andere-instanz" });
    await gesperrt({ ...h, "x-klara-document": "anderes-dokument" });
  });
  it("übermittelt eine frei formulierte Frage nur mit wirksam gebundener Zustimmung an den gewählten Testanbieter", async () => {
    const h = await sitzung("word-aktiv");
    const r = await office(h);
    expect(r.statusCode, r.body).toBe(200);
    expect(askAufrufe).toHaveBeenCalledTimes(1);
    const diagnostik = await askAufrufe.mock.results[0]?.value;
    expect(
      transport,
      JSON.stringify({ antwort: r.json().antwort, ask: diagnostik?.result }),
    ).toHaveBeenCalledTimes(1);
    const [, nutzlast] = transport.mock.calls[0] ?? [];
    expect(nutzlast).toContain(frage);
    expect(nutzlast).toContain(bereich.aussage);
    expect(r.json().antwort).toMatchObject({
      stand: "belegt",
      quellen: [{ id: bereich.ko.id, auszug: bereich.aussage }],
    });
  });
  it("honoriert den persönlichen Widerruf bei weiter gültiger Sitzung und vergleicht belegte Aussagen weiterhin lokal", async () => {
    const h = await sitzung("word-widerrufen");
    const antwort = await app.inject({
      method: "DELETE",
      url: `/api/klara/sessions/${h["x-klara-session"]}/consent`,
      headers: { ...h, authorization: `Bearer ${bereich.leser.token}` },
    });
    expect(antwort.statusCode, antwort.body).toBe(200);
    expect(antwort.json().consentState).toBe("revoked");
    await gesperrt(h);
    const r = await office(h, bereich.aussage);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().antwort).toMatchObject({
      stand: "belegt",
      quellen: [{ id: bereich.ko.id, auszug: bereich.aussage }],
    });
    expect(askAufrufe).not.toHaveBeenCalled();
    expect(transport).not.toHaveBeenCalled();
  });
});
