// ================================================================================================
// produkt:20261009:referenzki-adminauswahl (REF-03) — DER EINSTIEG „REFERENZPRÜFUNG" AM ECHTEN
// HTTP-WEG.
// ================================================================================================
//
// Über `app.inject` gegen die vollständige App (In-Memory-Aufbau, fiktiver Bestand, reine
// Testkennwörter ohne Verbindung nach außen). Ersetzt ist für den Funktionscheck nur die Wahl des
// Prüfers — ein Doppelgänger statt eines Modells. Routen, Rechte, Schreibweg, Audit und Prüflauf
// sind echt.
//
//   E1 (K9)       · nicht berechtigte Rolle und ohne Anmeldung: direkte API-Aufrufe abgelehnt, nichts
//                   geändert, nichts protokolliert, kein Modellaufruf
//   E2 (K1/K2/K3) · Lage lesen ohne Modellaufruf; speichern; nach erneutem Lesen erhalten; die
//                   übrige Zuordnung und die Freigaben bleiben, wie der Server sie hält
//   E3 (K3/K6)    · die gespeicherte Auswahl wirkt im tatsächlichen Prüflauf einer Frage; ohne
//                   einsatzbereite Referenz-KI bleibt der Prüfstatus offen
//   E4 (K8)       · Audit mit Akteur, Zeit, Wahlen und Modellen vorher/nachher — kein Schlüssel
//   E5 (K7)       · Funktionscheck nur auf Aufruf: Ergebnis mit Zeit, Modell, Modellaufruf, im Audit
//                   gespeichert, danach als letzte Prüfung gelesen; nicht bereit → 409, nichts gesendet
//   E6 (K7)       · ein Funktionscheck zur Zeit
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { REFERENZ_PRUEF_RICHTLINIE } from "../../services/ask";
import type { ReferenzPruefer } from "../../services/reasoner";

type Kopf = Record<string, string>;

const VENTIL = "Am fiktiven Ventil R3 gilt eine Höchsttemperatur von 70 °C.";
const FRAGE = "Welche Höchsttemperatur gilt am Ventil R3?";

async function aufbau() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin Fiktiv", email: "ref03@fiktiv.example", password: "testwert-ref03-1" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "ref03@fiktiv.example", password: "testwert-ref03-1" },
  });
  const admin: Kopf = { authorization: `Bearer ${login.json().token}` };
  const adminId = login.json().user?.id as string | undefined;
  const konten: Record<string, Kopf> = {};
  for (const role of ["viewer", "experte", "controller"] as const) {
    const anlage = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: {
        name: `Konto ${role}`,
        email: `ref03-${role}@fiktiv.example`,
        password: `testwert-ref03-${role}`,
        role,
      },
    });
    expect(anlage.statusCode, anlage.body).toBe(201);
    const l = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: `ref03-${role}@fiktiv.example`, password: `testwert-ref03-${role}` },
    });
    konten[role] = { authorization: `Bearer ${l.json().token}` };
  }
  return { services, app, admin, adminId, konten };
}

/** Ein Prüfer-Doppelgänger, der den fiktiven Prüfstoff richtig beurteilt. */
function pruefer(modell = "pruef-fiktiv-3", warten?: Promise<void>) {
  let aufrufe = 0;
  const p: ReferenzPruefer = {
    rolle: { anbieter: `anthropic:${modell}`, modell, stufe: "cloud" },
    extern: true,
    pruefe: async (_system, user) => {
      aufrufe += 1;
      await warten;
      const daten = JSON.parse(user.slice(user.indexOf("\n") + 1)) as {
        posten: { teilId: string; fundstellen: { fundstelleId: string }[] }[];
      };
      return {
        text: JSON.stringify({
          richtlinie: REFERENZ_PRUEF_RICHTLINIE,
          ergebnisse: daten.posten.map((x) => ({
            teilId: x.teilId,
            zustand: x.teilId === "fc.t1" ? "belegt" : "widersprochen",
            fundstelleId: x.fundstellen[0]?.fundstelleId ?? null,
            begruendung: "Fiktive Begründung.",
          })),
        }),
        dauerMs: 11,
        verbrauch: { eingabe: 410, ausgabe: 52 },
      };
    },
  };
  return { p, aufrufe: () => aufrufe };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("REF-03 · Rechte (K9)", () => {
  it("E1 · nicht berechtigte Rollen und ohne Anmeldung: direkt per API abgelehnt, nichts geändert", async () => {
    const { app, services, konten } = await aufbau();
    const funktionsPruefer = vi.spyOn(services.reasoner, "referenzFunktionsPruefer");
    const vorher = services.reasoner.getTaskConfig();
    const auditVorher = (await services.audit.list({})).length;
    for (const [rolle, kopf] of Object.entries(konten)) {
      const lesen = await app.inject({
        method: "GET",
        url: "/api/reasoner/referenzpruefung",
        headers: kopf,
      });
      expect(lesen.statusCode, `${rolle} GET`).toBe(403);
      const setzen = await app.inject({
        method: "PUT",
        url: "/api/reasoner/referenzpruefung",
        headers: kopf,
        payload: { liste: ["local"] },
      });
      expect(setzen.statusCode, `${rolle} PUT`).toBe(403);
      const ueberConfig = await app.inject({
        method: "PUT",
        url: "/api/reasoner/config",
        headers: kopf,
        payload: { global: "auto", perTask: {}, referenzpruefung: ["local"] },
      });
      expect(ueberConfig.statusCode, `${rolle} PUT config`).toBe(403);
      const check = await app.inject({
        method: "POST",
        url: "/api/reasoner/referenzpruefung/funktionscheck",
        headers: kopf,
        payload: { wahl: "local" },
      });
      expect(check.statusCode, `${rolle} POST`).toBe(403);
      expect(JSON.stringify(lesen.json())).not.toContain("optionen");
    }
    for (const [methode, url] of [
      ["GET", "/api/reasoner/referenzpruefung"],
      ["PUT", "/api/reasoner/referenzpruefung"],
      ["POST", "/api/reasoner/referenzpruefung/funktionscheck"],
    ] as const) {
      const ohne = await app.inject(
        methode === "GET" ? { method: methode, url } : { method: methode, url, payload: {} },
      );
      expect(ohne.statusCode, `${methode} ${url} ohne Anmeldung`).toBe(401);
    }
    expect(services.reasoner.getTaskConfig()).toEqual(vorher);
    expect(
      (await services.audit.list({})).filter((e) => e.action.startsWith("reasoner.referenz")),
    ).toHaveLength(0);
    expect((await services.audit.list({})).length).toBeGreaterThanOrEqual(auditVorher);
    expect(funktionsPruefer).not.toHaveBeenCalled();
  });
});

describe("REF-03 · Lesen und Speichern", () => {
  it("E2 · lesen ruft kein Modell; speichern, neu lesen, Zuordnung und Freigabe bleiben", async () => {
    const { app, services, admin } = await aufbau();
    const funktionsPruefer = vi.spyOn(services.reasoner, "referenzFunktionsPruefer");
    // Eine gesetzte Zuordnung mit Ausnahme und Grundfreigabe — beides darf das Speichern der
    // Referenzliste nicht verändern.
    const zuordnung = await app.inject({
      method: "PUT",
      url: "/api/reasoner/config",
      headers: admin,
      payload: {
        global: "anthropic",
        perTask: { structure: "local" },
        kiFreigabe: { oeffentlicheKi: true },
      },
    });
    expect(zuordnung.statusCode, zuordnung.body.slice(0, 300)).toBe(200);

    const erst = await app.inject({
      method: "GET",
      url: "/api/reasoner/referenzpruefung",
      headers: admin,
    });
    expect(erst.statusCode, erst.body.slice(0, 300)).toBe(200);
    const lage = erst.json();
    expect(lage.liste).toEqual([]);
    expect(lage.optionen.map((o: { wahl: string }) => o.wahl)).toEqual([
      "openai",
      "anthropic",
      "local",
    ]);
    for (const o of lage.optionen) {
      expect(Object.keys(o).sort()).toEqual(
        [
          "anbieter",
          "art",
          "eingerichtet",
          "erlaubt",
          "gleichWieAntwortmodell",
          "letzteFunktionspruefung",
          "modell",
          "rang",
          "sperre",
          "wahl",
          "zustand",
        ].sort(),
      );
      expect(["intern", "oeffentlich"]).toContain(o.art);
      // Ohne eingerichteten Zugang (Prüfbühne ohne Modell) ehrlich „nicht eingerichtet".
      expect(o.zustand).toBe(o.eingerichtet ? o.zustand : "nicht_eingerichtet");
    }
    expect(lage.grenzen).toMatchObject({
      richtlinie: REFERENZ_PRUEF_RICHTLINIE,
      zeitlimitMs: 25_000,
      antwortMaxToken: 1_500,
      postenMax: 40,
      eingabeMaxZeichen: 24_000,
      erneutMax: 1,
      automatischeWiederholung: false,
    });
    expect(lage.preise).toHaveProperty("hinterlegt");
    expect(lage.freigabe).toEqual({ oeffentlicheKi: true, vertraulicheInhalte: false });
    expect(funktionsPruefer).not.toHaveBeenCalled();

    const gespeichert = await app.inject({
      method: "PUT",
      url: "/api/reasoner/referenzpruefung",
      headers: admin,
      payload: { liste: ["local", "anthropic"] },
    });
    expect(gespeichert.statusCode, gespeichert.body.slice(0, 300)).toBe(200);
    expect(gespeichert.json().liste).toEqual(["local", "anthropic"]);

    // „Neu laden": derselbe Stand vom Server, im Reasoner wirksam, in der Persistenz.
    const neu = await app.inject({
      method: "GET",
      url: "/api/reasoner/referenzpruefung",
      headers: admin,
    });
    expect(neu.json().liste).toEqual(["local", "anthropic"]);
    expect(neu.json().optionen.find((o: { wahl: string }) => o.wahl === "local")).toMatchObject({
      erlaubt: true,
      rang: 1,
    });
    const config = services.reasoner.getTaskConfig();
    expect(config).toMatchObject({
      global: "anthropic",
      perTask: { structure: "local" },
      kiFreigabe: { oeffentlicheKi: true },
      referenzpruefung: ["local", "anthropic"],
    });
    // Die Persistenz der Liste über einen Neustart belegt REF-02 P5
    // (`tests/referenzki-pruefdienst/reasoner-referenzpruefer.test.ts`); der Schreibweg ist derselbe.

    // Ungültiges: 400, nichts geändert.
    const falsch = await app.inject({
      method: "PUT",
      url: "/api/reasoner/referenzpruefung",
      headers: admin,
      payload: { liste: ["deterministic"] },
    });
    expect(falsch.statusCode).toBe(400);
    expect(services.reasoner.getTaskConfig().referenzpruefung).toEqual(["local", "anthropic"]);

    // Aus: null.
    const aus = await app.inject({
      method: "PUT",
      url: "/api/reasoner/referenzpruefung",
      headers: admin,
      payload: { liste: null },
    });
    expect(aus.statusCode).toBe(200);
    expect(aus.json().liste).toEqual([]);
    expect(services.reasoner.getTaskConfig().referenzpruefung).toBeUndefined();
    expect(services.reasoner.getTaskConfig().global).toBe("anthropic");
    expect(funktionsPruefer).not.toHaveBeenCalled();
  });
});

describe("REF-03 · Wirkung im tatsächlichen Prüflauf (K3/K6)", () => {
  it("E3 · die gespeicherte Auswahl gilt beim Fragen; ohne einsatzbereiten Prüfer bleibt der Status offen", async () => {
    const { app, services, admin } = await aufbau();
    const ko = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: admin,
      payload: {
        type: "best_practice",
        category: "Ref03",
        neededValidations: 1,
        confidentiality: "intern",
        title: "Ventil R3 Höchsttemperatur",
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
    const fragen = async () => {
      const r = await app.inject({
        method: "POST",
        url: "/api/ask",
        headers: admin,
        payload: { question: FRAGE },
      });
      expect(r.statusCode, r.body.slice(0, 300)).toBe(200);
      return r.json();
    };

    // Ohne Auswahl: offen, „nicht eingerichtet".
    const ohne = await fragen();
    expect(ohne.referenzpruefung).toMatchObject({
      status: "nicht_pruefbar",
      grund: "pruefer_nicht_eingerichtet",
    });

    // Über den Einstieg gespeichert: der Prüflauf liest GENAU diese Liste. Die Prüfbühne hat kein
    // Modell — der Prüfer ist erlaubt, aber nicht verfügbar, und der Status bleibt offen.
    const waehle = vi.spyOn(services.reasoner, "referenzPruefer");
    await app.inject({
      method: "PUT",
      url: "/api/reasoner/referenzpruefung",
      headers: admin,
      payload: { liste: ["local"] },
    });
    const mit = await fragen();
    expect(waehle).toHaveBeenCalled();
    expect(mit.referenzpruefung).toMatchObject({
      status: "nicht_pruefbar",
      grund: "pruefer_nicht_verfuegbar",
    });
    for (const a of mit.referenzpruefung.aussagen) {
      expect(a.zustand).not.toBe("belegt");
    }

    // Mit einem einsatzbereiten Prüfer (Doppelgänger) aus derselben Wahl: geprüft.
    const d = pruefer();
    waehle.mockImplementation(() => ({ pruefer: d.p }));
    vi.spyOn(services.reasoner, "externeVerarbeitungErlaubt").mockReturnValue(true);
    const geprueft = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: admin,
      payload: { question: `${FRAGE} Bitte genau.` },
    });
    expect(geprueft.json().referenzpruefung.status).toBe("geprueft");
  });
});

describe("REF-03 · Audit (K8)", () => {
  it("E4 · Akteur, Zeit, Wahlen und Modelle vorher/nachher — ohne Schlüssel und Quelltext", async () => {
    const { app, services, admin, adminId } = await aufbau();
    const setzen = (liste: string[] | null) =>
      app.inject({
        method: "PUT",
        url: "/api/reasoner/referenzpruefung",
        headers: admin,
        payload: { liste },
      });
    expect((await setzen(["local"])).statusCode).toBe(200);
    expect((await setzen(["anthropic", "local"])).statusCode).toBe(200);
    expect((await setzen(null)).statusCode).toBe(200);
    const eintraege = await services.audit.list({ action: "reasoner.referenzpruefung" });
    expect(eintraege).toHaveLength(3);
    for (const e of eintraege) {
      expect(e.target).toBe("reasoner.referenzpruefung");
      if (adminId) {
        expect(e.actor).toBe(adminId);
      }
      expect(Number.isNaN(Date.parse(e.at))).toBe(false);
      expect(Object.keys(e.payload).sort()).toEqual(
        ["modelleNachher", "modelleVorher", "nachher", "vorher"].sort(),
      );
      const text = JSON.stringify(e.payload);
      expect(text).not.toMatch(/api_?key|schluessel|secret|passwort|sk-/i);
      expect(text).not.toContain(VENTIL);
    }
    expect(eintraege.map((e) => e.payload)).toEqual([
      {
        vorher: [],
        nachher: ["local"],
        modelleVorher: [],
        modelleNachher: [{ wahl: "local", anbieter: null, modell: null }],
      },
      {
        vorher: ["local"],
        nachher: ["anthropic", "local"],
        modelleVorher: [{ wahl: "local", anbieter: null, modell: null }],
        modelleNachher: [
          { wahl: "anthropic", anbieter: null, modell: null },
          { wahl: "local", anbieter: null, modell: null },
        ],
      },
      {
        vorher: ["anthropic", "local"],
        nachher: [],
        modelleVorher: [
          { wahl: "anthropic", anbieter: null, modell: null },
          { wahl: "local", anbieter: null, modell: null },
        ],
        modelleNachher: [],
      },
    ]);
  });

  it("E4b · das Modell im Protokoll ist das tatsächliche Modell hinter der Wahl", async () => {
    const { app, services, admin } = await aufbau();
    const echt = services.reasoner.referenzLage.bind(services.reasoner);
    vi.spyOn(services.reasoner, "referenzLage").mockImplementation(() => {
      const lage = echt();
      return {
        ...lage,
        optionen: lage.optionen.map((o) =>
          o.wahl === "anthropic"
            ? {
                ...o,
                eingerichtet: true,
                anbieter: "anthropic:claude-fiktiv",
                modell: "claude-fiktiv-5",
              }
            : o,
        ),
      };
    });
    await app.inject({
      method: "PUT",
      url: "/api/reasoner/referenzpruefung",
      headers: admin,
      payload: { liste: ["anthropic"] },
    });
    const [e] = await services.audit.list({ action: "reasoner.referenzpruefung" });
    expect(e?.payload.modelleNachher).toEqual([
      { wahl: "anthropic", anbieter: "anthropic:claude-fiktiv", modell: "claude-fiktiv-5" },
    ]);
  });
});

describe("REF-03 · Funktionscheck (K7)", () => {
  it("E5 · nur auf Aufruf; Ergebnis mit Zeit, Modell, Aufruf; gespeichert und als letzte Prüfung gelesen", async () => {
    const { app, services, admin, adminId } = await aufbau();
    const d = pruefer("claude-fiktiv-8");
    const wahl = vi
      .spyOn(services.reasoner, "referenzFunktionsPruefer")
      .mockImplementation(() => ({ pruefer: d.p }));

    // Lesen löst keinen Check aus.
    await app.inject({ method: "GET", url: "/api/reasoner/referenzpruefung", headers: admin });
    expect(wahl).not.toHaveBeenCalled();
    expect(d.aufrufe()).toBe(0);

    const unbekannt = await app.inject({
      method: "POST",
      url: "/api/reasoner/referenzpruefung/funktionscheck",
      headers: admin,
      payload: { wahl: "deterministic" },
    });
    expect(unbekannt.statusCode).toBe(400);

    const r = await app.inject({
      method: "POST",
      url: "/api/reasoner/referenzpruefung/funktionscheck",
      headers: admin,
      payload: { wahl: "anthropic" },
    });
    expect(r.statusCode, r.body.slice(0, 300)).toBe(200);
    expect(wahl).toHaveBeenCalledWith("anthropic");
    expect(d.aufrufe()).toBe(1);
    const e = r.json();
    expect(e).toMatchObject({
      wahl: "anthropic",
      anbieter: "anthropic:claude-fiktiv-8",
      modell: "claude-fiktiv-8",
      ergebnis: "erfolgreich",
      grund: null,
      modellaufruf: true,
      verbrauch: { eingabe: 410, ausgabe: 52 },
      richtlinie: REFERENZ_PRUEF_RICHTLINIE,
      fiktiv: true,
      gespeichert: true,
    });
    expect(Number.isNaN(Date.parse(e.zeit))).toBe(false);
    // Ohne Preisliste: keine geschätzten Kosten.
    expect(e.kosten).toBeNull();

    const [protokoll, ...rest] = await services.audit.list({
      action: "reasoner.referenzpruefung-funktionscheck",
    });
    expect(rest).toHaveLength(0);
    expect(protokoll?.target).toBe("reasoner.referenzpruefung:anthropic");
    if (adminId) {
      expect(protokoll?.actor).toBe(adminId);
    }
    expect(protokoll?.payload).toMatchObject({
      wahl: "anthropic",
      modell: "claude-fiktiv-8",
      ergebnis: "erfolgreich",
      zeit: e.zeit,
    });
    // Der fiktive Prüfstoff steht nicht im Protokoll.
    expect(JSON.stringify(protokoll?.payload)).not.toContain("Musterwerk");

    const lage = (
      await app.inject({ method: "GET", url: "/api/reasoner/referenzpruefung", headers: admin })
    ).json();
    expect(
      lage.optionen.find((o: { wahl: string }) => o.wahl === "anthropic").letzteFunktionspruefung,
    ).toMatchObject({ zeit: e.zeit, modell: "claude-fiktiv-8", ergebnis: "erfolgreich" });
    expect(d.aufrufe()).toBe(1);
  });

  it("E5b · nicht einsatzbereit: 409 mit Grund, nichts gesendet, nichts protokolliert", async () => {
    const { app, services, admin } = await aufbau();
    const r = await app.inject({
      method: "POST",
      url: "/api/reasoner/referenzpruefung/funktionscheck",
      headers: admin,
      payload: { wahl: "openai" },
    });
    expect(r.statusCode).toBe(409);
    expect(r.json()).toMatchObject({ error: "REFERENZ_PRUEFER_NICHT_BEREIT" });
    expect(
      await services.audit.list({ action: "reasoner.referenzpruefung-funktionscheck" }),
    ).toHaveLength(0);
  });

  it("E6 · ein Funktionscheck zur Zeit", async () => {
    const { app, services, admin } = await aufbau();
    let loslassen: () => void = () => undefined;
    const warten = new Promise<void>((fertig) => {
      loslassen = fertig;
    });
    const d = pruefer("claude-fiktiv-9", warten);
    vi.spyOn(services.reasoner, "referenzFunktionsPruefer").mockImplementation(() => ({
      pruefer: d.p,
    }));
    // `.then` stößt den Aufruf sofort an (ein `inject` ohne Rückruf ist sonst eine träge Kette).
    const erster = app
      .inject({
        method: "POST",
        url: "/api/reasoner/referenzpruefung/funktionscheck",
        headers: admin,
        payload: { wahl: "anthropic" },
      })
      .then((antwort) => antwort);
    await vi.waitFor(() => expect(d.aufrufe()).toBe(1));
    const zweiter = await app.inject({
      method: "POST",
      url: "/api/reasoner/referenzpruefung/funktionscheck",
      headers: admin,
      payload: { wahl: "anthropic" },
    });
    expect(zweiter.statusCode).toBe(409);
    expect(zweiter.json().error).toBe("REFERENZ_FUNKTIONSCHECK_LAEUFT");
    loslassen();
    expect((await erster).statusCode).toBe(200);
    expect(d.aufrufe()).toBe(1);
  });
});
