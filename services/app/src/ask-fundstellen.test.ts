// produkt:20261009:referenzki-quellenbelege (REF-01) — über die ECHTEN HTTP-Routen der Kandidatenfassung:
// POST /api/ask liefert je Aussage Kennung, Quellenfassung und Passage; POST /api/ask/fundstellen löst
// eine Fundstelle mit den aktuellen Rechten des Lesers auf (aktuell, geändert, gelöscht, nicht
// zugänglich, beschädigt). Bestand und Konten sind fiktiv; die Kennwörter sind reine Testwerte des
// In-Memory-Aufbaus ohne jede Verbindung nach aussen.
import { describe, expect, it } from "vitest";
import {
  type AussagenBeleg,
  type ExterneFundstelle,
  type InterneFundstelle,
  fingerabdruck,
} from "../../ask";
import { ExternalSearchService } from "../../external-search";
import { buildApp, buildServices } from "./build-app";

const VENTIL = "Am Ventil F3 gilt eine Höchsttemperatur von 80 °C. Bei Dauerbetrieb gilt 70 °C.";
const PASSAGE = "Am Ventil F3 gilt eine Höchsttemperatur von 80 °C.";
const PRESSE = "Die Presse P2 im Werk Süd hat einen Grenzdruck von 300 bar.";

type App = ReturnType<typeof buildApp>;
type Kopf = Record<string, string>;

async function aufbau() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin Fiktiv", email: "admin@fiktiv.example", password: "testwert-admin-1" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@fiktiv.example", password: "testwert-admin-1" },
  });
  const admin: Kopf = { authorization: `Bearer ${login.json().token}` };
  const gast = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: admin,
    payload: {
      name: "Leser Fiktiv",
      email: "leser@fiktiv.example",
      password: "testwert-leser-1",
      role: "viewer",
    },
  });
  expect(gast.statusCode, gast.body).toBe(201);
  const gastLogin = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "leser@fiktiv.example", password: "testwert-leser-1" },
  });
  const leser: Kopf = { authorization: `Bearer ${gastLogin.json().token}` };
  return { app, services, admin, leser };
}

async function anlegen(app: App, kopf: Kopf, felder: Record<string, unknown>): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: kopf,
    payload: { type: "best_practice", category: "Ref01", neededValidations: 1, ...felder },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

function aufloesen(app: App, kopf: Kopf, fundstellen: unknown[]) {
  return app.inject({
    method: "POST",
    url: "/api/ask/fundstellen",
    headers: kopf,
    payload: { fundstellen },
  });
}

function verweisAus(fs: InterneFundstelle) {
  return {
    art: fs.art,
    koId: fs.koId,
    koVersion: fs.koVersion,
    feld: fs.feld,
    start: fs.start,
    ende: fs.ende,
    fingerabdruck: fs.fingerabdruck,
  };
}

describe("REF-01 · Aussage → Quellenversion → Passage über HTTP", () => {
  it("K1/K2/K7/K8 · Antwort trägt Aussagen mit Fundstellen; Auflösung mit aktuellen Rechten", async () => {
    const { app, services, admin, leser } = await aufbau();
    const koId = await anlegen(app, admin, {
      confidentiality: "intern",
      title: "Ventil F3 Höchsttemperatur",
      statement: VENTIL,
    });
    await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: admin,
      payload: { action: "rate", verdict: "up" },
    });

    // --- Antwort: Aussage → Quellenversion → Passage (Daten-/API-Beispiel) ---------------------
    const antwort = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: admin,
      payload: { question: "Welche Höchsttemperatur gilt am Ventil F3?" },
    });
    expect(antwort.statusCode, antwort.body).toBe(200);
    const body = antwort.json();
    expect(body.result.answered).toBe(true);
    expect(body.result.citedSources).toContain(koId);
    const beleg = body.aussagen as AussagenBeleg;
    // Der Beleg bindet die Antwort über ihren Inhalt, nicht über die je Lauf frische Kennung.
    expect(beleg.antwortFingerabdruck).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(Object.keys(beleg)).not.toContain("answerId");
    expect(beleg.fehlendeDeckung).toEqual([]);
    const fs = beleg.aussagen
      .flatMap((a) => a.teile.flatMap((t) => t.fundstellen))
      .find((f): f is InterneFundstelle => f.art === "intern" && f.auszug === PASSAGE);
    expect(fs, JSON.stringify(beleg)).toBeDefined();
    const fundstelle = fs!;

    // K7: dieselben Kennungen und Fassungen wie die bestehenden Verträge — Quellenliste
    // (`result.sources`), `quellenStand`, Receipt und Absatzzuordnung bleiben, wie sie waren.
    const ko = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers: admin });
    expect(ko.statusCode).toBe(200);
    expect(fundstelle.koVersion).toBe(ko.json().version);
    expect(body.quellenStand[koId]).toBe(fundstelle.koVersion);
    expect(body.result.sources).toContain(fundstelle.koId);
    expect(typeof body.receipt).toBe("string");
    expect(Array.isArray(body.absaetze)).toBe(true);
    // Der Quellenlink ist der bestehende direkte Weg der Oberfläche samt Belegstelle (dieselbe Form
    // wie der Quellenchip, `?stelle=…&fassung=…`); die Objektroute dahinter liest.
    const link = new URL(fundstelle.link, "https://klarwerk.test");
    expect(link.pathname).toBe(`/wissen/${koId}`);
    expect(link.searchParams.get("stelle")).toBe(PASSAGE);
    expect(link.searchParams.get("fassung")).toBe(String(fundstelle.koVersion));
    expect(VENTIL.slice(fundstelle.start, fundstelle.ende)).toBe(PASSAGE);
    expect(fundstelle.fingerabdruck).toBe(fingerabdruck(PASSAGE));
    expect(fundstelle.originalAutor).toEqual(expect.any(String));

    // --- passende Fundstelle: für Admin und für den Leser aktuell ------------------------------
    const verweis = verweisAus(fundstelle);
    for (const kopf of [admin, leser]) {
      const r = await aufloesen(app, kopf, [verweis]);
      expect(r.statusCode, r.body).toBe(200);
      expect(r.json().fundstellen[0]).toMatchObject({
        zustand: "aktuell",
        koId,
        koVersion: fundstelle.koVersion,
        auszug: PASSAGE,
        link: `/wissen/${koId}`,
      });
    }

    // --- nicht berechtigt: vertrauliche Quelle eines anderen Berechtigungsraums ----------------
    const geheimId = await anlegen(app, admin, {
      confidentiality: "vertraulich",
      title: "Presse P2 Grenzdruck",
      statement: PRESSE,
    });
    const geheimKo = await app.inject({
      method: "GET",
      url: `/api/kos/${geheimId}`,
      headers: admin,
    });
    const geheimFassung = geheimKo.json().version as number;
    const geheim = {
      art: "intern",
      koId: geheimId,
      koVersion: geheimFassung,
      feld: "statement",
      start: 0,
      ende: PRESSE.length,
      fingerabdruck: fingerabdruck(PRESSE),
    };
    const unbekannt = { ...geheim, koId: "ko-gibt-es-nicht" };
    const gesperrt = (await aufloesen(app, leser, [geheim, unbekannt])).json().fundstellen;
    expect(gesperrt[0]).toEqual({ ...gesperrt[1], koId: geheimId });
    expect(gesperrt[0].zustand).toBe("nicht_zugaenglich");
    for (const verraeterisch of ["300 bar", "Presse", "Werk Süd", "version", "originalAutor"]) {
      expect(JSON.stringify(gesperrt)).not.toContain(verraeterisch);
    }
    // Gegenprobe: wer die Quelle sehen darf, bekommt sie.
    const offen = (await aufloesen(app, admin, [geheim])).json().fundstellen[0];
    expect(offen).toMatchObject({ zustand: "aktuell", auszug: PRESSE });

    // --- erfunden/gefälscht: falscher Fingerabdruck ist kein Beleg -----------------------------
    const gefaelscht = { ...verweis, fingerabdruck: fingerabdruck("erfunden") };
    expect((await aufloesen(app, admin, [gefaelscht])).json().fundstellen[0]).toEqual({
      zustand: "beschaedigt",
      hinweis: expect.any(String),
      koId,
    });

    // --- nachträglich geändert: historischer Stand und aktuelle Quelle getrennt ----------------
    await services.ko.revise(
      koId,
      { statement: VENTIL.replace("80 °C", "85 °C") },
      "redaktion-fiktiv",
    );
    const geaendert = (await aufloesen(app, admin, [verweis])).json().fundstellen[0];
    expect(geaendert).toMatchObject({
      zustand: "geaendert",
      koId,
      gebunden: { version: fundstelle.koVersion, auszug: PASSAGE },
      aktuell: { passageUnveraendert: false },
      link: `/wissen/${koId}`,
    });
    expect(geaendert.aktuell.version).toBeGreaterThan(fundstelle.koVersion);

    // --- gelöscht: wer sehen durfte, erfährt es; Inhalt kommt nicht mehr ------------------------
    await services.ko.delete(koId, "redaktion-fiktiv");
    await services.ko.delete(geheimId, "redaktion-fiktiv");
    const nachLoeschung = (await aufloesen(app, leser, [verweis, geheim])).json().fundstellen;
    expect(nachLoeschung[0]).toEqual({ zustand: "geloescht", hinweis: expect.any(String), koId });
    // Die vertrauliche Quelle durfte der Leser nie sehen — auch gelöscht bleibt sie „nicht zugänglich".
    expect(nachLoeschung[1]).toEqual({ ...gesperrt[1], koId: geheimId });
    expect(JSON.stringify(nachLoeschung)).not.toContain("Höchsttemperatur");
  });

  it("K2/K4 · externer Treffer: Abrufbeleg der Serversuche → vollständige Fundstelle; entfernter Anker → kein Auszug", async () => {
    // Ben nacharbeit-7: der vollständige externe Positivfall über die ECHTEN Routen. Der Anbieter
    // ist ein fiktiver Doppelgänger (kein Netz); Suche, Abrufbeleg, Anhängen, Antwort und Auflösung
    // laufen durch die Kandidatenfassung.
    const treffer = {
      title: "Fiktivmetall",
      url: "https://de.wikipedia.org/wiki/Fiktivmetall",
      snippet: "Fiktivmetall schmilzt bei 1234 °C.",
      provider: "Wikipedia",
    };
    const services = buildServices();
    services.externalSearch = new ExternalSearchService({
      provider: { name: "Wikipedia", search: async () => [treffer] },
    });
    const app = buildApp(services);
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        name: "Admin Fiktiv",
        email: "extern@fiktiv.example",
        password: "testwert-extern-1",
      },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "extern@fiktiv.example", password: "testwert-extern-1" },
    });
    const admin: Kopf = { authorization: `Bearer ${login.json().token}` };
    const stufe = await app.inject({
      method: "PUT",
      url: "/api/external/policy",
      headers: admin,
      payload: { stage: "search_attach" },
    });
    expect(stufe.statusCode, stufe.body).toBe(200);
    const koId = await anlegen(app, admin, {
      confidentiality: "intern",
      title: "Fiktivmetall Schmelzpunkt",
      statement: treffer.snippet,
    });
    await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: admin,
      payload: { action: "rate", verdict: "up" },
    });

    // 1 · Die Suche läuft über den Server und stellt je Treffer den Abrufbeleg aus.
    const suche = await app.inject({
      method: "GET",
      url: "/api/external/search?q=Fiktivmetall",
      headers: admin,
    });
    expect(suche.statusCode, suche.body).toBe(200);
    const hit = suche.json()[0] as { abgerufenAm: string; abrufbeleg: string };
    expect(typeof hit.abrufbeleg).toBe("string");
    expect(Number.isNaN(Date.parse(hit.abgerufenAm))).toBe(false);

    // 2 · Gegenprobe: derselbe Beleg für eine ANDERE Adresse belegt keinen Abruf.
    const kopie = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: admin,
      payload: {
        action: "add-source",
        source: {
          label: "Kopie",
          url: "https://example.invalid/kopie",
          excerpt: treffer.snippet,
          abrufbeleg: hit.abrufbeleg,
        },
      },
    });
    expect(kopie.statusCode, kopie.body).toBe(200);
    // 3 · Der echte Treffer mit seinem Beleg.
    const echt = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: admin,
      payload: {
        action: "add-source",
        source: {
          label: treffer.title,
          url: treffer.url,
          excerpt: treffer.snippet,
          abrufbeleg: hit.abrufbeleg,
        },
      },
    });
    expect(echt.statusCode, echt.body).toBe(200);
    const quellen = echt.json().sources as {
      id: string;
      url: string | null;
      at: string;
      abgerufenAm?: string;
    }[];
    const belegt = quellen.find((s) => s.url === treffer.url);
    const unbelegt = quellen.find((s) => s.url === "https://example.invalid/kopie");
    expect(belegt?.abgerufenAm).toBe(hit.abgerufenAm);
    expect(unbelegt?.abgerufenAm).toBeUndefined();

    // 4 · Die Antwort bindet die externe Fundstelle VOLLSTÄNDIG: Herkunft, Abruf, Passage, Abdruck.
    const antwort = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: admin,
      payload: { question: "Wann schmilzt Fiktivmetall?" },
    });
    expect(antwort.statusCode, antwort.body).toBe(200);
    const beleg = antwort.json().aussagen as AussagenBeleg;
    const extern = beleg.aussagen
      .flatMap((a) => a.teile.flatMap((t) => t.fundstellen))
      .filter((f): f is ExterneFundstelle => f.art === "extern");
    const vollstaendig = extern.find((f) => f.herkunft === treffer.url);
    expect(vollstaendig, JSON.stringify(beleg)).toMatchObject({
      vollstaendigkeit: "vollstaendig",
      abgerufenAm: hit.abgerufenAm,
      auszug: treffer.snippet,
      fingerabdruck: fingerabdruck(treffer.snippet),
    });
    expect(vollstaendig?.gespeichertAm).toBe(belegt?.at);
    const ohneNachweis = extern.find((f) => f.herkunft === "https://example.invalid/kopie");
    expect(ohneNachweis).toMatchObject({
      vollstaendigkeit: "abruf_nicht_belegt",
      abgerufenAm: null,
    });

    // 5 · Auflösung reicht den Nachweis weiter.
    const verweis = {
      art: "extern",
      koId,
      koVersion: vollstaendig?.koVersion,
      quelleId: vollstaendig?.quelleId,
      start: vollstaendig?.start,
      ende: vollstaendig?.ende,
      fingerabdruck: vollstaendig?.fingerabdruck,
    };
    const vorher = (await aufloesen(app, admin, [verweis])).json().fundstellen[0];
    expect(vorher).toMatchObject({
      zustand: "aktuell",
      abgerufenAm: hit.abgerufenAm,
      vollstaendigkeit: "vollstaendig",
    });

    // 6 · Der Anker wird vollständig entfernt (`remove-source`, ohne neue Fassung): kein Auszug mehr.
    const entfernen = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: admin,
      payload: { action: "remove-source", sourceId: belegt?.id },
    });
    expect(entfernen.statusCode, entfernen.body).toBe(200);
    const nachher = (await aufloesen(app, admin, [verweis])).json().fundstellen[0];
    expect(nachher).toEqual({
      zustand: "herkunft_entfernt",
      hinweis: expect.any(String),
      koId,
      link: `/wissen/${koId}`,
    });
  });

  it("Rumpf und Recht: ungültige Verweise sind 400, ohne Anmeldung 401", async () => {
    const { app, admin } = await aufbau();
    const leer = await aufloesen(app, admin, []);
    expect(leer.statusCode).toBe(400);
    const kaputt = await aufloesen(app, admin, [{ art: "intern", koId: "x" }]);
    expect(kaputt.statusCode).toBe(400);
    const anonym = await aufloesen(app, {}, [
      { art: "intern", koId: "x", koVersion: 1, feld: "statement", start: 0, ende: 1 },
    ]);
    expect(anonym.statusCode).toBe(401);
  });
});
