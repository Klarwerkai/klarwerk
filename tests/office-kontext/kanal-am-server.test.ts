import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { OFFICE_KONTEXT_VERTRAG } from "../../services/app/src/office-kontext";

// ================================================================================================
// KLARA-OFFICE-01 · DER ENGE OFFICE-KANAL AM ECHTEN DRAHT
// ================================================================================================
//
// Gemessen über `app.inject()` gegen die ECHTE Kompositionswurzel (`buildApp`): dieselbe Anmeldung,
// dieselbe Klara-Sitzung (`POST /api/klara/sessions`, `…/document-context`, `…/close`) und dieselben
// Rechte wie `/api/ask`. Wiederverwendet wird also die vorhandene Konto-, Sitzungs- und Rechte-
// verwaltung; der Kanal ergänzt nur Office-Kontext und Zielprüfung.
//
// Fiktive Inhalte und Konten (Ada, Bea, „Angebot Musterfirma"); keine Geheimnisse.

const EIGENE_HERKUNFT = "http://localhost";

function summe(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

const AUSWAHL = "Angebot Musterfirma";

function meldung(sequenz: number, text = AUSWAHL, ueber: Record<string, unknown> = {}) {
  return {
    vertrag: OFFICE_KONTEXT_VERTRAG,
    host: { anwendung: "word", plattform: "Mac", version: "16.89" },
    objekt: { art: "dokument" },
    auswahl: {
      quelle: "host-api",
      art: text.length > 0 ? "text" : "leer",
      laenge: text.length,
      pruefsumme: summe(text),
    },
    sequenz,
    ...ueber,
  };
}

const offen: ReturnType<typeof buildApp>[] = [];
afterEach(async () => {
  for (const app of offen.splice(0)) {
    await app.close();
  }
});

async function buehne() {
  const app = buildApp(buildServices());
  offen.push(app);
  const anmelden = async (email: string) => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "secret123" },
    });
    expect(res.statusCode, res.body).toBe(200);
    return { authorization: `Bearer ${res.json().token as string}` };
  };
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@office-kontext.test", password: "secret123" },
  });
  const ada = await anmelden("ada@office-kontext.test");
  const reg = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Bea Beispiel", email: "bea@office-kontext.test", password: "secret123" },
  });
  const roh = reg.json() as { id?: string; user?: { id: string } };
  const beaId = roh.id ?? roh.user?.id ?? "";
  const frei = await app.inject({
    method: "POST",
    url: `/api/auth/users/${beaId}/approve`,
    headers: ada,
  });
  expect(frei.statusCode, frei.body).toBe(200);
  const bea = await anmelden("bea@office-kontext.test");
  return { app, ada, bea, beaId };
}

type App = Awaited<ReturnType<typeof buehne>>["app"];

async function sitzung(
  app: App,
  auth: Record<string, string>,
  instanz: string,
  descriptor: Record<string, string> = { kind: "saved", canonicalUrl: "https://fiktiv/angebot" },
) {
  const res = await app.inject({
    method: "POST",
    url: "/api/klara/sessions",
    headers: auth,
    payload: { addinInstanceId: instanz, documentDescriptor: descriptor },
  });
  expect(res.statusCode, res.body).toBe(201);
  const sessionId = res.json().sessionId as string;
  return {
    sessionId,
    kopf: {
      ...auth,
      origin: EIGENE_HERKUNFT,
      "x-klara-session": sessionId,
      "x-klara-instance": instanz,
      "x-klara-document": res.json().documentContextId as string,
    },
  };
}

function melde(app: App, s: { sessionId: string; kopf: Record<string, string> }, koerper: unknown) {
  return app.inject({
    method: "POST",
    url: `/api/klara/sessions/${s.sessionId}/office-kontext`,
    headers: s.kopf,
    payload: koerper as Record<string, unknown>,
  });
}

function ziel(
  app: App,
  s: { sessionId: string; kopf: Record<string, string> },
  marke: unknown,
  text = AUSWAHL,
) {
  return app.inject({
    method: "POST",
    url: `/api/klara/sessions/${s.sessionId}/office-kontext/ziel`,
    headers: s.kopf,
    payload: { marke, ziel: { pruefsumme: summe(text) } },
  });
}

describe("KO-01-07 · Kanal: angemeldet, eigene Herkunft, bestehende Sitzung", () => {
  it("anonym verweigern alle drei Wege mit 401", async () => {
    const { app } = await buehne();
    for (const [method, url] of [
      ["POST", "/api/klara/sessions/x/office-kontext"],
      ["POST", "/api/klara/sessions/x/office-kontext/ziel"],
      ["DELETE", "/api/klara/sessions/x/office-kontext"],
    ] as const) {
      const res = await app.inject({ method, url, headers: { origin: EIGENE_HERKUNFT } });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
    }
  });

  it("ohne Origin oder mit fremder Herkunft: 403 OFFICE_HERKUNFT — kein offener Loopback-Weg", async () => {
    const { app, ada } = await buehne();
    const s = await sitzung(app, ada, "inst-a");
    const ohneOrigin: Record<string, string> = { ...s.kopf };
    delete ohneOrigin.origin;
    for (const kopf of [
      ohneOrigin,
      { ...s.kopf, origin: "https://angreifer.example" },
      { ...s.kopf, origin: "http://127.0.0.1:9999" },
      { ...s.kopf, "sec-fetch-site": "cross-site" },
    ]) {
      const res = await melde(app, { ...s, kopf }, meldung(1));
      expect(res.statusCode, res.body).toBe(403);
      expect(res.json().error).toBe("OFFICE_HERKUNFT");
    }
  });

  it("eine fremde Bindung (anderes Dokument im Kopf) bekommt keinen Kontext", async () => {
    const { app, ada } = await buehne();
    const s = await sitzung(app, ada, "inst-a");
    const res = await melde(
      app,
      { ...s, kopf: { ...s.kopf, "x-klara-document": "doc-s-fremd" } },
      meldung(1),
    );
    expect(res.statusCode).toBe(404);
  });
});

describe("KO-01-02/04/05 · die Meldung bindet Kontext und führt selbst nichts aus", () => {
  it("200 mit Office-Bezug, Marke, Aktionen — ohne KO-Kennung, ohne KI, ohne Zustimmung", async () => {
    const { app, ada } = await buehne();
    const s = await sitzung(app, ada, "inst-a");
    const res = await melde(app, s, meldung(1));
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.vertrag).toBe(OFFICE_KONTEXT_VERTRAG);
    expect(body.verbindung).toBe("aktiv");
    expect(body.bezug.kennung).toBe(`office:word:${s.kopf["x-klara-document"]}#1`);
    expect(body.bezug.objekt.documentContextId).toBe(s.kopf["x-klara-document"]);
    expect(body.bezug.pruefstand).toBe("ungeprueft");
    expect(JSON.stringify(body.bezug)).not.toMatch(/"koId"/);
    expect(JSON.stringify(body)).not.toContain(AUSWAHL);
    expect(typeof body.marke).toBe("string");
    expect(body.kiVerarbeitung).toBe("nicht-ausgeloest");
    expect(body.sitzung.consentState).toBe("none");
    // KO-01-04: kein zweites Profil — solange die kontobezogene Ablage nicht geliefert ist, sagt
    // die Antwort das, statt Name/Avatar zu erfinden.
    expect(body.auftritt).toEqual({ quelle: "nicht-geliefert", name: null, avatarUrl: null });
    expect(body.erlaubteAktionen.map((a: { aktion: string }) => a.aktion)).toEqual([
      "kontext-lesen",
      "fragen",
      "text-pruefen",
      "einfuegen",
    ]);
    expect(res.headers["cache-control"]).toBe("no-store");

    // Die Sitzung trägt danach dieselbe (keine) Zustimmung: die Meldung erteilt nichts.
    const nachher = await app.inject({
      method: "GET",
      url: `/api/klara/sessions/${s.sessionId}`,
      headers: s.kopf,
    });
    expect(nachher.statusCode).toBe(200);
    expect(nachher.json().consentState).toBe("none");
  });

  it("Volltext, Seitenfenster-Auswahl und nicht gelieferte Hosts werden abgelehnt (400)", async () => {
    const { app, ada } = await buehne();
    const s = await sitzung(app, ada, "inst-a");
    const faelle: [unknown, string][] = [
      [{ ...meldung(1), text: AUSWAHL }, "felder_unzulaessig"],
      [
        meldung(1, AUSWAHL, {
          auswahl: {
            quelle: "seitenfenster",
            art: "text",
            laenge: 19,
            pruefsumme: summe(AUSWAHL),
          },
        }),
        "auswahl_nicht_vom_host",
      ],
      [
        meldung(1, AUSWAHL, {
          host: { anwendung: "outlook", plattform: "Mac", version: "16.89" },
        }),
        "adapter_nicht_geliefert",
      ],
    ];
    for (const [koerper, grund] of faelle) {
      const res = await melde(app, s, koerper);
      expect(res.statusCode, grund).toBe(400);
      expect(res.json()).toEqual({ error: "OFFICE_KONTEXT_UNGUELTIG", grund });
    }
  });

  it("eine Folge, die nicht steigt, ist veraltet (409)", async () => {
    const { app, ada } = await buehne();
    const s = await sitzung(app, ada, "inst-a");
    expect((await melde(app, s, meldung(2))).statusCode).toBe(200);
    const alt = await melde(app, s, meldung(2));
    expect(alt.statusCode).toBe(409);
    expect(alt.json()).toEqual({ error: "OFFICE_SEQUENZ_VERALTET", letzteSequenz: 2 });
  });
});

describe("KO-01-06/07 · Zielprüfung: richtige Sitzung, Wechsel, falsches Ziel", () => {
  it("passt alles: gültig, und eingefügt wird erst nach dem zweiten Klick", async () => {
    const { app, ada } = await buehne();
    const s = await sitzung(app, ada, "inst-a");
    const { marke } = (await melde(app, s, meldung(1))).json();
    const res = await ziel(app, s, marke);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toEqual({
      gueltig: true,
      verbindung: "aktiv",
      bestaetigung: "zweiter-klick",
      sequenz: 1,
    });
  });

  it("falsches Ziel (Auswahl inzwischen anders) ⇒ 409 ziel_abweichend, aktualisieren", async () => {
    const { app, ada } = await buehne();
    const s = await sitzung(app, ada, "inst-a");
    const { marke } = (await melde(app, s, meldung(1))).json();
    const res = await ziel(app, s, marke, "Ganz anderer Absatz");
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ grund: "ziel_abweichend", aktion: "aktualisieren" });
  });

  it("veraltete Auswahl: nach einer neueren Meldung gilt die alte Marke nicht mehr", async () => {
    const { app, ada } = await buehne();
    const s = await sitzung(app, ada, "inst-a");
    const alt = (await melde(app, s, meldung(1))).json().marke;
    expect((await melde(app, s, meldung(2, "Neuer Absatz"))).statusCode).toBe(200);
    const res = await ziel(app, s, alt);
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ grund: "auswahl_veraltet", aktion: "aktualisieren" });
  });

  it("Dokumentwechsel über den vorhandenen Rebind ⇒ dokument_gewechselt, verwerfen", async () => {
    const { app, ada } = await buehne();
    const s = await sitzung(app, ada, "inst-a", {
      kind: "unsaved",
      clientDocumentNonce: "nonce-fiktiv",
    });
    const { marke } = (await melde(app, s, meldung(1))).json();
    const rebind = await app.inject({
      method: "POST",
      url: `/api/klara/sessions/${s.sessionId}/document-context`,
      headers: s.kopf,
      payload: { documentDescriptor: { kind: "saved", canonicalUrl: "https://fiktiv/neu" } },
    });
    expect(rebind.statusCode, rebind.body).toBe(200);
    const neu = { ...s, kopf: { ...s.kopf, "x-klara-document": rebind.json().documentContextId } };
    expect(neu.kopf["x-klara-document"]).not.toBe(s.kopf["x-klara-document"]);
    const res = await ziel(app, neu, marke);
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ grund: "dokument_gewechselt", aktion: "verwerfen" });
    // Mit dem alten Dokumentkopf antwortet die Sitzung gar nicht mehr: getrennt.
    const altKopf = await ziel(app, s, marke);
    expect(altKopf.statusCode).toBe(409);
    expect(altKopf.json()).toMatchObject({ aktion: "verwerfen" });
  });

  it("Kontowechsel: ein anderes Konto kann die Marke nicht benutzen und keinen Kontext melden", async () => {
    const { app, ada, bea } = await buehne();
    const s = await sitzung(app, ada, "inst-a");
    const { marke } = (await melde(app, s, meldung(1))).json();
    const beaKopf = { ...s.kopf, authorization: bea.authorization };
    const res = await ziel(app, { ...s, kopf: beaKopf }, marke);
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ grund: "konto_gewechselt", aktion: "verwerfen" });
    const fremd = await melde(app, { ...s, kopf: beaKopf }, meldung(5));
    expect(fremd.statusCode).toBe(404);
    // Gegenprobe: die abgelehnten Versuche des fremden Kontos haben Adas Bezug nicht berührt.
    expect((await ziel(app, s, marke)).statusCode).toBe(200);
  });

  it("geschlossene Sitzung ⇒ sitzung_nicht_aktiv, Verbindung sichtbar getrennt", async () => {
    const { app, ada } = await buehne();
    const s = await sitzung(app, ada, "inst-a");
    const { marke } = (await melde(app, s, meldung(1))).json();
    const zu = await app.inject({
      method: "POST",
      url: `/api/klara/sessions/${s.sessionId}/close`,
      headers: s.kopf,
    });
    expect(zu.statusCode, zu.body).toBe(200);
    const res = await ziel(app, s, marke);
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({
      gueltig: false,
      grund: "sitzung_nicht_aktiv",
      aktion: "verwerfen",
      verbindung: "getrennt",
    });
    expect((await melde(app, s, meldung(2))).statusCode).not.toBe(200);
  });

  it("Rechteentzug: nach Löschen des Kontos gilt weder Marke noch Meldung", async () => {
    const { app, ada, bea, beaId } = await buehne();
    const s = await sitzung(app, bea, "inst-b");
    const { marke } = (await melde(app, s, meldung(1))).json();
    expect((await ziel(app, s, marke)).statusCode).toBe(200);
    const weg = await app.inject({
      method: "DELETE",
      url: `/api/auth/users/${beaId}`,
      headers: ada,
    });
    expect(weg.statusCode, weg.body).toBe(204);
    const res = await ziel(app, s, marke);
    expect([401, 403]).toContain(res.statusCode);
    expect([401, 403]).toContain((await melde(app, s, meldung(2))).statusCode);
  });

  it("Verwerfen und gefälschte Marke: danach gilt kein alter Bezug", async () => {
    const { app, ada } = await buehne();
    const s = await sitzung(app, ada, "inst-a");
    const { marke } = (await melde(app, s, meldung(1))).json();
    const verworfen = await app.inject({
      method: "DELETE",
      url: `/api/klara/sessions/${s.sessionId}/office-kontext`,
      headers: s.kopf,
    });
    expect(verworfen.statusCode).toBe(200);
    expect(verworfen.json()).toEqual({ verbindung: "getrennt" });
    expect((await ziel(app, s, marke)).json()).toMatchObject({ grund: "auswahl_veraltet" });
    const gefaelscht = await ziel(app, s, `${String(marke).split(".")[0]}.AAAA`);
    expect(gefaelscht.json()).toMatchObject({ grund: "marke_ungueltig" });
  });
});
