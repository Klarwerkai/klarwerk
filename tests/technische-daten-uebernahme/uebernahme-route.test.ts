// ================================================================================================
// BPA-02 · ÜBERNAHME-ROUTEN ÜBER DEN VORHANDENEN ENTWURFSDIENST (In-Memory-Komposition)
// ================================================================================================
//
// Die echte App (`buildApp(buildServices())`) mit zwei Konten. Geprüft wird der Draht: Rechte,
// geschützter Entwurf mit Herkunft je Beleg, Wiederholung ohne Dublette, unbekannte Schutzklasse,
// kein Netz-/Modellaufruf, Fassungsabgleich vor der Übernahme und der Quellenabgleich danach.
// Synthetische Daten (V-17/V-18); keine Geheimniswerte.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { belegFassung } from "../../services/app/src/technische-daten";
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

async function aufbauen() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Anna", email: "anna@ventile.test", password: KENNWORT },
  });
  const anna = await anmelden(app, "anna@ventile.test");
  const neu = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: anna,
    payload: { name: "Bert", email: "bert@ventile.test", password: KENNWORT, role: "experte" },
  });
  expect(neu.statusCode, neu.body).toBe(201);
  const bert = await anmelden(app, "bert@ventile.test");
  const ich = await app.inject({ method: "GET", url: "/api/auth/me", headers: anna });
  // Gemessen wird ab hier: nur die Wege dieses Auftrags, nicht der Kontenaufbau.
  vi.mocked(globalThis.fetch).mockClear();
  return { app, anna, bert, annaId: ich.json().id as string };
}

function post(app: App, pfad: string, wer: Kopf | undefined, payload: unknown) {
  return app.inject({
    method: "POST",
    url: `/api/technische-daten/${pfad}`,
    ...(wer ? { headers: wer } : {}),
    payload: payload as object,
  });
}

async function entwuerfe(app: App, wer: Kopf) {
  const res = await app.inject({ method: "GET", url: "/api/drafts", headers: wer });
  expect(res.statusCode).toBe(200);
  return (res.json() as { id: string; payload: { title?: string } }[]).filter((d) =>
    d.payload.title?.startsWith("Technische Daten"),
  );
}

describe("BPA-02 · /api/technische-daten", () => {
  beforeEach(() => {
    // Kein Abruf der genannten Adresse, kein Modellanbieter: jeder fetch-Aufruf wäre ein Befund.
    vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => {
    expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("ohne Anmeldung 401; ohne Abschnitt 400 und kein Entwurf (AC03)", async () => {
    const { app, anna } = await aufbauen();
    expect((await post(app, "vorschau", undefined, { belege: [HTML_SEITE] })).statusCode).toBe(401);
    const ohne = await post(app, "uebernahme", anna, {
      belege: [{ ...HTML_SEITE, abschnitt: "" }],
      ziel: { objekt: "V-17" },
      schutzklasse: "intern",
    });
    expect(ohne.statusCode).toBe(400);
    expect(ohne.json().error).toBe("QUELLABSCHNITT_FEHLT");
    expect(await entwuerfe(app, anna)).toHaveLength(0);
  });

  it("Vorschau speichert nichts und zeigt beide Belege samt Abweichung (AC05)", async () => {
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
    expect(await entwuerfe(app, anna)).toHaveLength(0);
  });

  it("Übernahme: eigener Entwurf mit Originalwerten und Herkunft je Beleg; getrennte Stände (AC03, AC10)", async () => {
    const { app, anna, annaId } = await aufbauen();
    const res = await post(app, "uebernahme", anna, {
      belege: [HTML_SEITE, DATENBLATT],
      ziel: { objekt: "V-17" },
      schutzklasse: "intern",
      erwarteteFassungen: [belegFassung(HTML_SEITE), belegFassung(DATENBLATT)],
    });
    expect(res.statusCode, res.body).toBe(201);
    const r = res.json();
    expect(r.entwurf).toMatchObject({ eigentuemer: annaId, schutzklasse: "intern", privat: true });
    expect(r.stand).toEqual({
      entwurf: "gespeichert",
      uebernahmeInsWissen: "nicht_erfolgt",
      fachlicheFreigabe: "nicht_erteilt",
    });
    expect(r.geschuetzteKlaerung).toBe(false);

    const gelesen = await app.inject({
      method: "GET",
      url: `/api/drafts/${r.entwurf.id}`,
      headers: anna,
    });
    expect(gelesen.statusCode).toBe(200);
    const d = gelesen.json();
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

  it("Wiederholung derselben Fassung — auch später erfasst — legt keinen zweiten Entwurf an (AC06)", async () => {
    const { app, anna } = await aufbauen();
    const auftrag = { belege: [HTML_SEITE], ziel: { objekt: "V-18" }, schutzklasse: "intern" };
    const erst = await post(app, "uebernahme", anna, auftrag);
    expect(erst.statusCode, erst.body).toBe(201);
    const nochmal = await post(app, "uebernahme", anna, auftrag);
    expect(nochmal.statusCode).toBe(200);
    expect(nochmal.json()).toMatchObject({
      wiederholung: true,
      entwurf: { id: erst.json().entwurf.id },
    });
    const spaeter = await post(app, "uebernahme", anna, {
      ...auftrag,
      belege: [{ ...HTML_SEITE, abgerufenAm: "2026-10-12T08:30:00Z" }],
    });
    expect(spaeter.statusCode, spaeter.body).toBe(200);
    expect(spaeter.json().entwurf.id).toBe(erst.json().entwurf.id);
    expect(await entwuerfe(app, anna)).toHaveLength(1);

    // Zwei Geräte mit gleichen Werten bleiben getrennt — zwei Abschnitte V-18/DN40 und V-18/DN50.
    const html = (
      await app.inject({
        method: "GET",
        url: `/api/drafts/${erst.json().entwurf.id}`,
        headers: anna,
      })
    ).json().payload.bodyHtml as string;
    expect(html).toContain("<h3>V-18 / DN40</h3>");
    expect(html).toContain("<h3>V-18 / DN50</h3>");
    expect(html).not.toContain("V-17");
  });

  it("unbekannte Schutzklasse: streng vertraulich, privat, kein Fremdzugriff (AC07)", async () => {
    const { app, anna, bert } = await aufbauen();
    const res = await post(app, "uebernahme", anna, {
      belege: [HTML_SEITE],
      ziel: { objekt: "V-17" },
    });
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
    const unbekannt = await post(app, "uebernahme", anna, {
      belege: [HTML_SEITE],
      ziel: { objekt: "V-17" },
      schutzklasse: "oeffentlich",
    });
    expect(unbekannt.statusCode).toBe(400);
  });

  it("geänderte Quelle vor der Übernahme: 409 mit zellgenauem Abgleich, nichts gespeichert (AC08)", async () => {
    const { app, anna } = await aufbauen();
    const jetzt = geaendert(HTML_SEITE, 0, 2, "20 bar");
    const res = await post(app, "uebernahme", anna, {
      belege: [jetzt],
      ziel: { objekt: "V-17" },
      schutzklasse: "intern",
      erwarteteFassungen: [belegFassung(HTML_SEITE)],
      vorschauBelege: [HTML_SEITE],
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
  });

  it("Pflege: Quellenabgleich nennt die betroffene eigene Übernahme mit ihrer Fassung (AC08, AC09)", async () => {
    const { app, anna, bert } = await aufbauen();
    const erst = await post(app, "uebernahme", anna, {
      belege: [HTML_SEITE],
      ziel: { objekt: "V-17" },
      schutzklasse: "intern",
    });
    const id = erst.json().entwurf.id;

    const gleich = await post(app, "quellenabgleich", anna, { beleg: HTML_SEITE });
    expect(gleich.statusCode, gleich.body).toBe(200);
    expect(gleich.json().betroffen).toEqual([]);
    expect(gleich.json().unveraendert.map((t: { entwurfId: string }) => t.entwurfId)).toEqual([id]);

    const jetzt = geaendert(HTML_SEITE, 0, 2, "20 bar");
    const neu = (await post(app, "quellenabgleich", anna, { beleg: jetzt })).json();
    expect(neu.betroffen).toEqual([
      {
        entwurfId: id,
        titel: "Technische Daten · V-17",
        erfassteFassung: belegFassung(HTML_SEITE),
        aktuelleFassung: belegFassung(jetzt),
        lage: "quelle_geaendert",
      },
    ]);

    // Gewöhnliche Quellenlöschung: die Übernahme bleibt erhalten und wird nur gekennzeichnet.
    const weg = (
      await post(app, "quellenabgleich", anna, { beleg: HTML_SEITE, zustand: "geloescht" })
    ).json();
    expect(weg.betroffen.map((t: { lage: string }) => t.lage)).toEqual([
      "quelle_nicht_mehr_erreichbar",
    ]);
    const noch = await app.inject({ method: "GET", url: `/api/drafts/${id}`, headers: anna });
    expect(noch.statusCode).toBe(200);

    // Fremde Übernahmen erscheinen nicht.
    const fremd = (await post(app, "quellenabgleich", bert, { beleg: jetzt })).json();
    expect(fremd.betroffen).toEqual([]);
    expect(fremd.unveraendert).toEqual([]);
  });

  it("kein Wert für das Ziel: 422 mit Klärung, nichts gespeichert (AC04)", async () => {
    const { app, anna } = await aufbauen();
    const res = await post(app, "uebernahme", anna, {
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
