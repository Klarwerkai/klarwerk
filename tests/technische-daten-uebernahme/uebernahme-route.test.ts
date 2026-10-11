// ================================================================================================
// BPA-02 · ÜBERNAHME-ROUTEN ÜBER DEN VORHANDENEN ENTWURFSDIENST (In-Memory-Komposition)
// ================================================================================================
//
// Die echte App (`buildApp(buildServices())`) mit drei Konten (Admin, Expertin, Fachprüfer). Geprüft
// wird der Draht: Rechte, verbindlicher Fassungsabgleich gegen die geprüfte Vorschau, geschützter
// Entwurf mit Herkunft je Beleg, Wiederholung ohne Dublette — auch nach dem Einreichen —, unbekannte
// Schutzklasse, kein Netz-/Modellaufruf, Pflege über eigene Entwürfe UND eingereichte
// Wissensobjekte mit dauerhaftem Vermerk, Rechteentzug über den bestehenden Quellrechte-Weg.
// Synthetische Daten (V-17/V-18); keine Geheimniswerte.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  QUELLENBEOBACHTUNG_AKTION,
  quellKennung,
} from "../../services/app/src/routes/technische-daten-routes";
import { type ErfassterAbschnitt, belegFassung } from "../../services/app/src/technische-daten";
import { DATENBLATT, HTML_SEITE, geaendert } from "./fixture";

type App = ReturnType<typeof buildApp>;
type Kopf = { authorization: string };

const KENNWORT = "geheim12345";

async function anmelden(app: App, email: string): Promise<Kopf> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: KENNWORT },
  });
  expect(res.statusCode, res.body).toBe(200);
  return { authorization: `Bearer ${res.json().token}` };
}

async function konto(app: App, admin: Kopf, name: string, role: string): Promise<Kopf> {
  const email = `${name.toLowerCase()}@ventile.test`;
  const neu = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: admin,
    payload: { name, email, password: KENNWORT, role },
  });
  expect(neu.statusCode, neu.body).toBe(201);
  return anmelden(app, email);
}

async function aufbauen() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Anna", email: "anna@ventile.test", password: KENNWORT },
  });
  const anna = await anmelden(app, "anna@ventile.test");
  const bert = await konto(app, anna, "Bert", "experte");
  const carla = await konto(app, anna, "Carla", "controller");
  const ich = await app.inject({ method: "GET", url: "/api/auth/me", headers: anna });
  // Öffentliche Adressen dürfen beim Einreichen nur auf der passenden Stufe an ein Wissensobjekt
  // (bestehende Regel `decideExternalAttach`); der Admin stellt sie hier ausdrücklich ein.
  const stufe = await app.inject({
    method: "PUT",
    url: "/api/external/policy",
    headers: anna,
    payload: { stage: "search_attach" },
  });
  expect(stufe.statusCode, stufe.body).toBe(200);
  return { app, services, anna, bert, carla, annaId: ich.json().id as string };
}

/**
 * Ein Aufruf der Routen dieses Auftrags. Kein Abruf der genannten Adresse und kein Modellanbieter:
 * jeder `fetch` WÄHREND des Aufrufs wäre ein Befund. Gemessen je Aufruf, damit fremde
 * Hintergrundarbeit anderer Wege (etwa nach dem Einreichen) nicht hineinzählt.
 */
async function post(app: App, pfad: string, wer: Kopf | undefined, payload: unknown) {
  const vorher = vi.mocked(globalThis.fetch).mock.calls.length;
  const res = await app.inject({
    method: "POST",
    url: `/api/technische-daten/${pfad}`,
    ...(wer ? { headers: wer } : {}),
    payload: payload as object,
  });
  expect(vi.mocked(globalThis.fetch).mock.calls.length, `fetch während ${pfad}`).toBe(vorher);
  return res;
}

/** Der Adapter liest die Quelle nach der Vorschau neu — hier: dieselben Zellen, spätere Zeit. */
function neuGelesen(b: ErfassterAbschnitt, minuten = 5): ErfassterAbschnitt {
  const spaeter = Date.parse(b.abgerufenAm) + minuten * 60_000;
  return { ...b, abgerufenAm: new Date(spaeter).toISOString() };
}

/** Der ganze Adapterweg: Vorschau, Quelle neu lesen, Übernahme mit Vorschaubeleg. */
async function uebernehmen(
  app: App,
  wer: Kopf,
  auftrag: { belege: ErfassterAbschnitt[]; ziel: object; schutzklasse?: string },
) {
  const vorschau = await post(app, "vorschau", wer, { belege: auftrag.belege, ziel: auftrag.ziel });
  expect(vorschau.statusCode, vorschau.body).toBe(200);
  return post(app, "uebernahme", wer, {
    ...auftrag,
    belege: auftrag.belege.map((b) => neuGelesen(b)),
    vorschauBelege: auftrag.belege,
    vorschaubeleg: vorschau.json().vorschaubeleg,
  });
}

async function entwuerfe(app: App, wer: Kopf) {
  const res = await app.inject({ method: "GET", url: "/api/drafts", headers: wer });
  expect(res.statusCode).toBe(200);
  return (res.json() as { id: string; payload: { title?: string } }[]).filter((d) =>
    d.payload.title?.startsWith("Technische Daten"),
  );
}

async function einreichen(app: App, wer: Kopf, id: string) {
  const res = await app.inject({
    method: "POST",
    url: `/api/drafts/${id}/promote`,
    headers: wer,
    payload: { draftPayload: { category: "Wartung" } },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json() as { id: string; version: number };
}

describe("BPA-02 · /api/technische-daten", () => {
  beforeEach(() => {
    // Beobachtet, nicht ersetzt — `post()` zählt die Aufrufe je Route dieses Auftrags.
    vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ohne Anmeldung 401; ohne Abschnitt 400 und kein Entwurf (AC03)", async () => {
    const { app, anna } = await aufbauen();
    expect((await post(app, "vorschau", undefined, { belege: [HTML_SEITE] })).statusCode).toBe(401);
    const ohne = await post(app, "vorschau", anna, {
      belege: [{ ...HTML_SEITE, abschnitt: "" }],
      ziel: { objekt: "V-17" },
    });
    expect(ohne.statusCode).toBe(400);
    expect(ohne.json().error).toBe("QUELLABSCHNITT_FEHLT");
    expect(await entwuerfe(app, anna)).toHaveLength(0);
  });

  it("Vorschau speichert nichts, zeigt beide Belege samt Abweichung und liefert den Vorschaubeleg (AC05)", async () => {
    const { app, anna } = await aufbauen();
    const res = await post(app, "vorschau", anna, {
      belege: [HTML_SEITE, DATENBLATT],
      ziel: { objekt: "V-17" },
    });
    expect(res.statusCode, res.body).toBe(200);
    const v = res.json();
    expect(v.verarbeitung).toEqual({ art: "regelbasiert", kiAnbieter: null });
    expect(v.belege.map((b: { art: string; fassung: string }) => [b.art, b.fassung])).toEqual([
      ["html", belegFassung(HTML_SEITE)],
      ["datenblatt", belegFassung(DATENBLATT)],
    ]);
    expect(v.abweichungen).toHaveLength(2);
    expect(v.bewertung.erklaerung).toContain("nicht die Wahrscheinlichkeit");
    expect(typeof v.vorschaubeleg).toBe("string");
    expect(await entwuerfe(app, anna)).toHaveLength(0);
  });

  it("AC08 · ohne Vorschaubeleg, mit fremdem oder mit erneut gesendetem altem Beleg entsteht nichts", async () => {
    const { app, anna, bert } = await aufbauen();
    const auftrag = { belege: [HTML_SEITE], ziel: { objekt: "V-17" }, schutzklasse: "intern" };
    const ohne = await post(app, "uebernahme", anna, auftrag);
    expect(ohne.statusCode).toBe(428);
    expect(ohne.json().error).toBe("FASSUNGSABGLEICH_FEHLT");

    const vorschau = (await post(app, "vorschau", anna, auftrag)).json().vorschaubeleg as string;
    // Derselbe alte Beleg noch einmal — kein Abgleich mit der Quelle.
    const alt = await post(app, "uebernahme", anna, { ...auftrag, vorschaubeleg: vorschau });
    expect(alt.statusCode).toBe(409);
    expect(alt.json().error).toBe("QUELLE_NICHT_NEU_GELESEN");
    // Ein anderes Konto kann den Vorschaubeleg nicht benutzen.
    const fremd = await post(app, "uebernahme", bert, {
      ...auftrag,
      belege: [neuGelesen(HTML_SEITE)],
      vorschaubeleg: vorschau,
    });
    expect(fremd.statusCode).toBe(409);
    expect(fremd.json().error).toBe("VORSCHAU_UNGUELTIG");
    // Ein anderes Ziel ist eine andere Vorschau.
    const anderesZiel = await post(app, "uebernahme", anna, {
      ...auftrag,
      ziel: { objekt: "V-18" },
      belege: [neuGelesen(HTML_SEITE)],
      vorschaubeleg: vorschau,
    });
    expect(anderesZiel.json().error).toBe("VORSCHAU_UNGUELTIG");
    // Ein manipulierter Beleg trägt keine gültige Signatur.
    const verfaelscht = `${vorschau.slice(0, -2)}xx`;
    const falsch = await post(app, "uebernahme", anna, {
      ...auftrag,
      belege: [neuGelesen(HTML_SEITE)],
      vorschaubeleg: verfaelscht,
    });
    expect(falsch.json().error).toBe("VORSCHAU_UNGUELTIG");
    expect(await entwuerfe(app, anna)).toHaveLength(0);
  });

  it("AC08 · neu gelesene, geänderte Quelle: 409 mit zellgenauem Abgleich und neuer Vorschau, nichts gespeichert", async () => {
    const { app, anna } = await aufbauen();
    const auftrag = { belege: [HTML_SEITE], ziel: { objekt: "V-17" }, schutzklasse: "intern" };
    const vorschau = (await post(app, "vorschau", anna, auftrag)).json().vorschaubeleg;
    const jetzt = neuGelesen(geaendert(HTML_SEITE, 0, 2, "20 bar"));
    const res = await post(app, "uebernahme", anna, {
      ...auftrag,
      belege: [jetzt],
      vorschauBelege: [HTML_SEITE],
      vorschaubeleg: vorschau,
    });
    expect(res.statusCode).toBe(409);
    const r = res.json();
    expect(r.error).toBe("QUELLE_GEAENDERT");
    expect(r.geaendert).toEqual([
      {
        url: HTML_SEITE.url,
        abschnitt: HTML_SEITE.abschnitt,
        erwarteteFassung: belegFassung(HTML_SEITE),
        aktuelleFassung: belegFassung(jetzt),
        aenderungen: [
          { zeile: 1, spalte: "Betriebsdruck", vorher: "16 bar ±0,5 bar", jetzt: "20 bar" },
        ],
      },
    ]);
    expect(r.vorschau.geraete[0].werte[0].original).toBe("20 bar");
    expect(await entwuerfe(app, anna)).toHaveLength(0);
    // Mit der neuen Vorschau und einer weiteren Lesung geht es — die geprüfte Fassung wird gespeichert.
    const danach = await post(app, "uebernahme", anna, {
      ...auftrag,
      belege: [neuGelesen(jetzt)],
      vorschaubeleg: r.vorschau.vorschaubeleg,
    });
    expect(danach.statusCode, danach.body).toBe(201);
  });

  it("Übernahme: eigener Entwurf mit Originalwerten und Herkunft je Beleg; getrennte Stände (AC03, AC10)", async () => {
    const { app, anna, annaId } = await aufbauen();
    const res = await uebernehmen(app, anna, {
      belege: [HTML_SEITE, DATENBLATT],
      ziel: { objekt: "V-17" },
      schutzklasse: "intern",
    });
    expect(res.statusCode, res.body).toBe(201);
    const r = res.json();
    expect(r.entwurf).toMatchObject({ eigentuemer: annaId, schutzklasse: "intern", privat: true });
    expect(r.stand).toEqual({
      entwurf: "gespeichert",
      uebernahmeInsWissen: "nicht_erfolgt",
      fachlicheFreigabe: "nicht_erteilt",
    });
    const d = (
      await app.inject({ method: "GET", url: `/api/drafts/${r.entwurf.id}`, headers: anna })
    ).json();
    expect(d.originalAuthor).toBe(annaId);
    expect(d.payload.type).toBe("technik");
    expect(d.payload.vorlage).toBeUndefined();
    expect(d.payload.bodyHtml).toContain("16 bar ±0,5 bar");
    expect(d.payload.bodyHtml).toContain("10 (bei 20 °C)");
    expect(d.payload.bodyHtml).toContain("Zeile 1, Spalte „Betriebsdruck");
    expect(d.payload.bodyHtml).toContain("Nicht fachlich freigegeben");
    expect(d.payload.pendingSources).toEqual([
      expect.objectContaining({
        url: "https://ventile.example.test/produkte/v-serie#technische-daten",
        label: "V-Serie Absperrventile · Technische Daten",
        sourceProvider: "Webseite",
        excerpt: expect.stringContaining(`Fassung sha256:${belegFassung(HTML_SEITE)}`),
      }),
      expect.objectContaining({
        url: DATENBLATT.url,
        sourceProvider: "Datenblatt",
        excerpt: expect.stringContaining("Stand 2026-09-01"),
      }),
    ]);
  });

  it("AC06 · Wiederholung — auch später erfasst und nach dem Einreichen — legt keine Dublette an", async () => {
    const { app, anna } = await aufbauen();
    const auftrag = { belege: [HTML_SEITE], ziel: { objekt: "V-18" }, schutzklasse: "intern" };
    const erst = await uebernehmen(app, anna, auftrag);
    expect(erst.statusCode, erst.body).toBe(201);
    const nochmal = await uebernehmen(app, anna, auftrag);
    expect(nochmal.statusCode, nochmal.body).toBe(200);
    expect(nochmal.json()).toMatchObject({
      wiederholung: true,
      entwurf: { id: erst.json().entwurf.id },
    });
    expect(await entwuerfe(app, anna)).toHaveLength(1);

    const html = (
      await app.inject({
        method: "GET",
        url: `/api/drafts/${erst.json().entwurf.id}`,
        headers: anna,
      })
    ).json().payload.bodyHtml as string;
    // Zwei Geräte mit gleichen Werten bleiben getrennt — zwei Abschnitte V-18/DN40 und V-18/DN50.
    expect(html).toContain("<h3>V-18 / DN40</h3>");
    expect(html).toContain("<h3>V-18 / DN50</h3>");
    expect(html).not.toContain("V-17");

    // Bewusste Übernahme ins Wissen über den bestehenden Einreichweg — danach dieselbe Erfassung.
    const wissen = await einreichen(app, anna, erst.json().entwurf.id);
    expect(await entwuerfe(app, anna)).toHaveLength(0);
    const nachEinreichen = await uebernehmen(app, anna, auftrag);
    expect(nachEinreichen.statusCode, nachEinreichen.body).toBe(200);
    expect(nachEinreichen.json()).toMatchObject({
      wiederholung: true,
      wissensobjekt: { id: wissen.id },
      stand: {
        entwurf: "nicht_angelegt",
        uebernahmeInsWissen: "erfolgt",
        fachlicheFreigabe: "nicht_erteilt",
      },
    });
    expect(await entwuerfe(app, anna), "keine Dublette als neuer Entwurf").toHaveLength(0);
  });

  it("AC07 · unbekannte Schutzklasse: streng vertraulich, privat, kein Fremdzugriff", async () => {
    const { app, anna, bert } = await aufbauen();
    const res = await uebernehmen(app, anna, { belege: [HTML_SEITE], ziel: { objekt: "V-17" } });
    expect(res.statusCode, res.body).toBe(201);
    const r = res.json();
    expect(r.geschuetzteKlaerung).toBe(true);
    expect(r.entwurf).toMatchObject({ schutzklasse: "streng_vertraulich", privat: true });
    expect(r.verarbeitung.kiAnbieter).toBeNull();
    const fremd = await app.inject({
      method: "GET",
      url: `/api/drafts/${r.entwurf.id}`,
      headers: bert,
    });
    expect([403, 404]).toContain(fremd.statusCode);
    expect(fremd.body).not.toContain("16 bar");
    expect(await entwuerfe(app, bert)).toHaveLength(0);
    const falsch = await uebernehmen(app, anna, {
      belege: [HTML_SEITE],
      ziel: { objekt: "V-17" },
      schutzklasse: "oeffentlich",
    });
    expect(falsch.statusCode).toBe(400);
  });

  it("AC08/AC09 · Pflege: Entwurf und eingereichtes Wissensobjekt werden benannt, Lage dauerhaft vermerkt", async () => {
    const { app, services, anna, bert } = await aufbauen();
    const html = await uebernehmen(app, anna, {
      belege: [HTML_SEITE],
      ziel: { objekt: "V-17" },
      schutzklasse: "intern",
    });
    const entwurfId = html.json().entwurf.id as string;
    const zweiter = await uebernehmen(app, anna, {
      belege: [HTML_SEITE],
      ziel: { objekt: "V-18" },
      schutzklasse: "intern",
    });
    const wissen = await einreichen(app, anna, zweiter.json().entwurf.id);

    const gleich = (await post(app, "quellenabgleich", anna, { beleg: HTML_SEITE })).json();
    expect(gleich.betroffen).toEqual([]);
    expect(gleich.unveraendert.map((t: { art: string; id: string }) => [t.art, t.id])).toEqual([
      ["entwurf", entwurfId],
      ["wissensobjekt", wissen.id],
    ]);

    const jetzt = geaendert(HTML_SEITE, 0, 2, "20 bar");
    const neu = (await post(app, "quellenabgleich", anna, { beleg: jetzt })).json();
    expect(neu.betroffen).toEqual([
      {
        art: "entwurf",
        id: entwurfId,
        titel: "Technische Daten · V-17",
        erfassteFassung: belegFassung(HTML_SEITE),
        aktuelleFassung: belegFassung(jetzt),
        lage: "quelle_geaendert",
      },
      {
        art: "wissensobjekt",
        id: wissen.id,
        titel: "Technische Daten · V-18",
        fassung: wissen.version,
        erfassteFassung: belegFassung(HTML_SEITE),
        aktuelleFassung: belegFassung(jetzt),
        lage: "quelle_geaendert",
      },
    ]);
    // Die eingereichte Wissensfassung trägt jetzt den vorhandenen Merker „Stimmt das noch?".
    expect(await services.lifecycle.pendingRevalidation()).toContain(wissen.id);
    // Beobachtung im Prüfprotokoll — mit Quellkennung, ohne Adresse.
    const protokoll = await services.audit.list({ action: QUELLENBEOBACHTUNG_AKTION });
    expect(protokoll.map((e) => e.target).sort()).toEqual([entwurfId, wissen.id].sort());
    expect(protokoll[0]?.payload.quelle).toBe(quellKennung(HTML_SEITE));
    expect(JSON.stringify(protokoll)).not.toContain(HTML_SEITE.url);

    // Gewöhnliche Quellenlöschung: nichts wird gelöscht oder gesperrt, der Vermerk bleibt dauerhaft.
    const weg = (
      await post(app, "quellenabgleich", anna, { beleg: HTML_SEITE, zustand: "geloescht" })
    ).json();
    expect(weg.betroffen.map((t: { lage: string }) => t.lage)).toEqual([
      "quelle_nicht_mehr_erreichbar",
      "quelle_nicht_mehr_erreichbar",
    ]);
    const entwurf = await app.inject({
      method: "GET",
      url: `/api/drafts/${entwurfId}`,
      headers: anna,
    });
    expect(entwurf.statusCode).toBe(200);
    expect(entwurf.json().payload.pendingSources[0].excerpt).toContain(
      "Lage: Quelle nicht mehr erreichbar (festgestellt",
    );
    expect(entwurf.json().payload.pendingSources[0].excerpt).toContain(
      `Fassung sha256:${belegFassung(HTML_SEITE)}`,
    );
    const ko = await app.inject({ method: "GET", url: `/api/kos/${wissen.id}`, headers: anna });
    expect(ko.statusCode, "der berechtigte Import bleibt erreichbar").toBe(200);

    // Fremde Übernahmen erscheinen nicht; ein sichtbares Wissensobjekt aber schon (intern).
    const fremd = (await post(app, "quellenabgleich", bert, { beleg: jetzt })).json();
    expect(fremd.betroffen.map((t: { art: string }) => t.art)).toEqual(["wissensobjekt"]);
  });

  it("AC09 · Rechteentzug sperrt Wissensobjekt, Entwürfe, Vorschau und laufende Übernahme; Erteilen hebt die Sperre auf", async () => {
    const { app, anna, bert, carla } = await aufbauen();
    const auftrag = { belege: [HTML_SEITE], ziel: { objekt: "V-17" }, schutzklasse: "intern" };
    const v17 = await uebernehmen(app, anna, auftrag);
    const wissen = await einreichen(app, anna, v17.json().entwurf.id);
    const entwurf = await uebernehmen(app, bert, {
      belege: [HTML_SEITE],
      ziel: { objekt: "V-18" },
      schutzklasse: "intern",
    });
    expect(entwurf.statusCode).toBe(201);
    // Eine Übernahme ist schon in Vorbereitung (Vorschau liegt vor), als das Recht entzogen wird.
    const laufend = (await post(app, "vorschau", anna, { belege: [HTML_SEITE], ziel: {} })).json();

    const ort = { url: HTML_SEITE.url, abschnitt: HTML_SEITE.abschnitt, anker: HTML_SEITE.anker };
    const nichtBerechtigt = await post(app, "quellenrechte", bert, { ...ort, zustand: "entzogen" });
    expect(nichtBerechtigt.statusCode, "nur die Fachprüfung entzieht Quellrechte").toBe(403);
    const entzug = await post(app, "quellenrechte", carla, { ...ort, zustand: "entzogen" });
    expect(entzug.statusCode, entzug.body).toBe(200);
    expect(entzug.json()).toEqual({ zustand: "entzogen", wissensobjekte: 1, entwuerfe: 1 });

    // Kopie, Lesen und Suche gesperrt — auch für die Autorin.
    const lesen = await app.inject({ method: "GET", url: `/api/kos/${wissen.id}`, headers: anna });
    expect([403, 404]).toContain(lesen.statusCode);
    const liste = await app.inject({ method: "GET", url: "/api/kos", headers: anna });
    expect(liste.body).not.toContain(wissen.id);
    expect(await entwuerfe(app, bert), "der Entwurf liegt im Papierkorb").toHaveLength(0);
    // Erfassung und laufende Übernahme derselben Quelle sind gesperrt.
    const vorschau = await post(app, "vorschau", anna, auftrag);
    expect(vorschau.statusCode).toBe(403);
    expect(vorschau.json().error).toBe("QUELLE_GESPERRT");
    const spaet = await post(app, "uebernahme", anna, {
      belege: [neuGelesen(HTML_SEITE)],
      ziel: {},
      schutzklasse: "intern",
      vorschaubeleg: laufend.vorschaubeleg,
    });
    expect(spaet.statusCode).toBe(403);
    expect(spaet.json().error).toBe("QUELLE_GESPERRT");

    const erteilt = await post(app, "quellenrechte", carla, { ...ort, zustand: "erteilt" });
    expect(erteilt.json()).toEqual({ zustand: "erteilt", wissensobjekte: 1, entwuerfe: 0 });
    const wieder = await app.inject({ method: "GET", url: `/api/kos/${wissen.id}`, headers: anna });
    expect(wieder.statusCode).toBe(200);
    expect((await post(app, "vorschau", anna, auftrag)).statusCode).toBe(200);
  });

  it("kein Wert für das Ziel: 422 mit Klärung, nichts gespeichert (AC04)", async () => {
    const { app, anna } = await aufbauen();
    const res = await uebernehmen(app, anna, {
      belege: [HTML_SEITE],
      ziel: { objekt: "V-99" },
      schutzklasse: "intern",
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().klaerungen.map((k: { art: string }) => k.art)).toEqual([
      "ziel_nicht_gefunden",
    ]);
    expect(await entwuerfe(app, anna)).toHaveLength(0);
  });
});
