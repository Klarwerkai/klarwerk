// ================================================================================================
// produkt:20261009:referenzki-pruefdienst (REF-02) — DER PRÜFDIENST AM ECHTEN HTTP-WEG.
// ================================================================================================
//
// Über `app.inject` gegen die vollständige App (In-Memory-Aufbau, fiktiver Bestand, reine
// Testkennwörter ohne Verbindung nach außen). Ersetzt ist nur die Prüferwahl des Reasoners — ein
// Doppelgänger statt eines Modells; Fragestrecke, Bindung, Rechte, Audit und Routen sind echt.
//
//   H1 (K6)    · ohne erlaubte Referenz-KI: jede beantwortete Frage trägt sichtbar „nicht prüfbar“
//   H2 (K1/K3) · mit Prüfer: Urteil je Aussage, Stufen statt Modellnamen, Rollen im Prüfprotokoll
//   H3 (K9)    · erneute Prüfung: nur der Fragende, höchstens einmal, sichtbar gezählt
//   H4 (K7)    · die Adminliste über den bestehenden Adminweg — protokolliert, Ungültiges 400,
//                ein neuer Empfänger ohne Beleg 503
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { REFERENZ_PRUEF_RICHTLINIE } from "../../services/ask";
import type { ReferenzPruefer } from "../../services/reasoner";

const VENTIL = "Am Ventil F3 gilt eine Höchsttemperatur von 80 °C.";
const FRAGE = "Welche Höchsttemperatur gilt am Ventil F3?";

type Kopf = Record<string, string>;

async function aufbau() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin Fiktiv", email: "ref02@fiktiv.example", password: "testwert-ref02-1" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "ref02@fiktiv.example", password: "testwert-ref02-1" },
  });
  const admin: Kopf = { authorization: `Bearer ${login.json().token}` };
  const anlage = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: admin,
    payload: {
      name: "Leser Fiktiv",
      email: "ref02-leser@fiktiv.example",
      password: "testwert-ref02-2",
      role: "viewer",
    },
  });
  expect(anlage.statusCode, anlage.body).toBe(201);
  const leserLogin = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "ref02-leser@fiktiv.example", password: "testwert-ref02-2" },
  });
  const leser: Kopf = { authorization: `Bearer ${leserLogin.json().token}` };
  const ko = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: admin,
    payload: {
      type: "best_practice",
      category: "Ref02",
      neededValidations: 1,
      confidentiality: "intern",
      title: "Ventil F3 Höchsttemperatur",
      statement: VENTIL,
    },
  });
  expect(ko.statusCode, ko.body).toBe(201);
  await app.inject({
    method: "PUT",
    url: `/api/kos/${ko.json().id}`,
    headers: admin,
    payload: { action: "rate", verdict: "up" },
  });
  return { services, app, admin, leser, koId: ko.json().id as string };
}

/** Ein Prüfer-Doppelgänger: urteilt „belegt“ mit der ersten Fundstelle jedes Postens. */
function pruefer(verhalten: "belegt" | "ausfall" = "belegt") {
  let aufrufe = 0;
  const p: ReferenzPruefer = {
    rolle: { anbieter: "anthropic:pruef-fiktiv", modell: "pruef-fiktiv-9", stufe: "cloud" },
    extern: true,
    pruefe: async (_system, user) => {
      aufrufe += 1;
      if (verhalten === "ausfall") {
        throw new Error("Anbieter antwortete mit 503");
      }
      const daten = JSON.parse(user.slice(user.indexOf("\n") + 1)) as {
        posten: { teilId: string; fundstellen: { fundstelleId: string }[] }[];
      };
      return {
        text: JSON.stringify({
          richtlinie: REFERENZ_PRUEF_RICHTLINIE,
          ergebnisse: daten.posten.map((x) => ({
            teilId: x.teilId,
            zustand: "belegt",
            fundstelleId: x.fundstellen[0]?.fundstelleId ?? null,
            begruendung: "Die Fundstelle nennt genau diesen Grenzwert.",
          })),
        }),
        dauerMs: 12,
        verbrauch: { eingabe: 500, ausgabe: 60 },
      };
    },
  };
  return { p, aufrufe: () => aufrufe };
}

afterEach(() => {
  vi.restoreAllMocks();
});

function fragen(app: ReturnType<typeof buildApp>, kopf: Kopf) {
  return app.inject({
    method: "POST",
    url: "/api/ask",
    headers: kopf,
    payload: { question: FRAGE },
  });
}

describe("REF-02 · Frageweg", () => {
  it("H1 · ohne erlaubte Referenz-KI: sichtbar nicht prüfbar, kein Modellaufruf, kein Leerlauf im Protokoll", async () => {
    const { app, services, admin } = await aufbau();
    const antwort = await fragen(app, admin);
    expect(antwort.statusCode, antwort.body.slice(0, 300)).toBe(200);
    const body = antwort.json();
    expect(body.result.answered).toBe(true);
    expect(body.referenzpruefung).toMatchObject({
      richtlinie: REFERENZ_PRUEF_RICHTLINIE,
      status: "nicht_pruefbar",
      grund: "pruefer_nicht_eingerichtet",
      globaleAktualitaet: "nicht_behauptet",
      messung: { modellaufrufe: 0 },
    });
    for (const a of body.referenzpruefung.aussagen) {
      expect(a.zustand).toBe("nicht_pruefbar");
    }
    expect(await services.audit.list({ action: "ask.referenzpruefung" })).toHaveLength(0);
  });

  it("H2 · mit Prüfer: Urteil je Aussage, Stufen statt Namen, Rollen und Messung im Prüfprotokoll", async () => {
    const { app, services, admin, koId } = await aufbau();
    const dp = pruefer();
    const wahl = vi
      .spyOn(services.reasoner, "referenzPruefer")
      .mockImplementation(() => ({ pruefer: dp.p }));
    vi.spyOn(services.reasoner, "externeVerarbeitungErlaubt").mockReturnValue(true);
    const antwort = await fragen(app, admin);
    expect(antwort.statusCode, antwort.body.slice(0, 300)).toBe(200);
    const body = antwort.json();
    const ref = body.referenzpruefung;
    expect(ref.status).toBe("geprueft");
    expect(ref.aussagen.length).toBeGreaterThan(0);
    const belegt = ref.aussagen.find((a: { zustand: string }) => a.zustand === "belegt");
    expect(belegt?.fundstellen[0]?.koId).toBe(koId);
    expect(belegt?.begruendung).toBe("Die Fundstelle nennt genau diesen Grenzwert.");
    // Die Fundstelle ist dieselbe, die die Antwort selbst ausweist (REF-01-Bindung).
    type Teil = { fundstellen: { fundstelleId: string }[] };
    const ids = (body.aussagen.aussagen as { teile: Teil[] }[]).flatMap((a) =>
      a.teile.flatMap((t) => t.fundstellen.map((f) => f.fundstelleId)),
    );
    expect(ids).toContain(belegt?.fundstellen[0]?.fundstelleId);
    expect(ref.bindung.antwortFingerabdruck).toBe(body.aussagen.antwortFingerabdruck);
    // Der Fragende sieht Stufen, keine Anbieter- oder Modellnamen.
    expect(ref.rollen).toEqual({ antwort: "deterministic", pruefer: "cloud" });
    expect(antwort.body).not.toContain("pruef-fiktiv-9");
    // Die konkrete Anfrage: Antwortrolle dieser Antwort ging an die Prüferwahl.
    expect(wahl).toHaveBeenCalledTimes(1);
    expect(wahl.mock.calls[0]?.[0]).toMatchObject({ stufe: "deterministic", modell: null });
    expect(dp.aufrufe()).toBe(1);
    // Das Prüfprotokoll hält beide Rollen samt tatsächlichem Modell fest — ohne Inhalt.
    await new Promise((r) => setTimeout(r, 0));
    const eintraege = await services.audit.list({ action: "ask.referenzpruefung" });
    expect(eintraege).toHaveLength(1);
    expect(eintraege[0]?.target).toBe(ref.pruefId);
    expect(eintraege[0]?.payload).toMatchObject({
      richtlinie: REFERENZ_PRUEF_RICHTLINIE,
      status: "geprueft",
      prueferAnbieter: "anthropic:pruef-fiktiv",
      prueferModell: "pruef-fiktiv-9",
      antwortModell: null,
      eingabeToken: 500,
      ausgabeToken: 60,
    });
    expect(JSON.stringify(eintraege[0])).not.toContain("80 °C");
  });
});

describe("REF-02 · erneute Prüfung", () => {
  it("H3 · nur der Fragende, höchstens einmal, sichtbar gezählt; Unbekanntes 404", async () => {
    const { app, services, admin, leser } = await aufbau();
    let n = 0;
    const ausfall = pruefer("ausfall");
    const gut = pruefer("belegt");
    vi.spyOn(services.reasoner, "referenzPruefer").mockImplementation(() => {
      n += 1;
      return { pruefer: n === 1 ? ausfall.p : gut.p };
    });
    vi.spyOn(services.reasoner, "externeVerarbeitungErlaubt").mockReturnValue(true);
    const erst = (await fragen(app, admin)).json().referenzpruefung;
    expect(erst).toMatchObject({
      status: "nicht_pruefbar",
      grund: "pruefer_fehler",
      versuch: { nummer: 1, hoechstens: 2 },
    });
    const url = `/api/ask/referenzpruefung/${erst.pruefId}/erneut`;
    const fremd = await app.inject({ method: "POST", url, headers: leser });
    expect(fremd.statusCode).toBe(404);
    const zweit = await app.inject({ method: "POST", url, headers: admin });
    expect(zweit.statusCode, zweit.body).toBe(200);
    expect(zweit.json().referenzpruefung).toMatchObject({
      status: "geprueft",
      versuch: { nummer: 2, hoechstens: 2 },
    });
    const dritt = await app.inject({ method: "POST", url, headers: admin });
    expect(dritt.statusCode).toBe(409);
    expect(dritt.json()).toMatchObject({ error: "REFERENZPRUEFUNG_AUSGESCHOEPFT", hoechstens: 2 });
    const unbekannt = await app.inject({
      method: "POST",
      url: "/api/ask/referenzpruefung/ref_gibt-es-nicht/erneut",
      headers: admin,
    });
    expect(unbekannt.statusCode).toBe(404);
    const anonym = await app.inject({ method: "POST", url });
    expect(anonym.statusCode).toBe(401);
    expect(ausfall.aufrufe() + gut.aufrufe()).toBe(2);
  });
});

describe("REF-02 · Adminliste über PUT /api/reasoner/config", () => {
  it("H4 · setzen (protokolliert), weglassen (unverändert), Ungültiges (400), aus (protokolliert), ohne Beleg 503", async () => {
    const { app, services, admin } = await aufbau();
    const setzen = (payload: Record<string, unknown>) =>
      app.inject({ method: "PUT", url: "/api/reasoner/config", headers: admin, payload });
    const eintraege = () => services.audit.list({ action: "reasoner.referenzpruefung" });

    const gesetzt = await setzen({ global: "auto", perTask: {}, referenzpruefung: ["local"] });
    expect(gesetzt.statusCode, gesetzt.body.slice(0, 300)).toBe(200);
    expect(gesetzt.json().taskConfig.referenzpruefung).toEqual(["local"]);
    expect((await eintraege()).map((e) => e.payload)).toEqual([{ vorher: [], nachher: ["local"] }]);

    const ohne = await setzen({ global: "auto", perTask: {} });
    expect(ohne.json().taskConfig.referenzpruefung).toEqual(["local"]);
    expect(await eintraege()).toHaveLength(1);

    const falsch = await setzen({
      global: "auto",
      perTask: {},
      referenzpruefung: ["deterministic"],
    });
    expect(falsch.statusCode).toBe(400);
    expect(await eintraege()).toHaveLength(1);

    const aus = await setzen({ global: "auto", perTask: {}, referenzpruefung: null });
    expect(aus.statusCode).toBe(200);
    expect(aus.json().taskConfig.referenzpruefung).toBeUndefined();
    expect((await eintraege()).map((e) => e.payload)).toEqual([
      { vorher: [], nachher: ["local"] },
      { vorher: ["local"], nachher: [] },
    ]);

    vi.spyOn(services.audit, "record").mockRejectedValue(new Error("Protokoll nicht schreibbar"));
    const ohneBeleg = await setzen({ global: "auto", perTask: {}, referenzpruefung: ["openai"] });
    expect(ohneBeleg.statusCode).toBe(503);
    expect(ohneBeleg.json().error).toBe("REASONER_REFERENZ_NICHT_PROTOKOLLIERBAR");
    expect(services.reasoner.getTaskConfig().referenzpruefung).toBeUndefined();
  });
});
