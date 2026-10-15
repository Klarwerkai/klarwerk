// ================================================================================================
// produkt:20261011:peter-p14 · DER FIRMENFILTER AM DRAHT — zwei Firmen, fünf Rollen, alle Wege.
// ================================================================================================
//
// Gemessen an der ECHTEN App (`buildApp(buildServices())`, Speicherablage) über die HTTP-Routen
// `GET /api/kos`, `GET /api/library/search`, `GET /api/library/export` und `POST /api/ask`. Jede
// Firma ist eine eigene Instanz (das zugesagte Betriebsmodell: eine Firma je Anlage). Alle Namen,
// Konten und Inhalte sind erfundene Testdaten dieses Falls; kein echtes Modell, kein Fremddienst.
// Die SQL-Form desselben Filters misst `firmenfilter-pg.integration.test.ts` gegen Postgres.
//
// FIRMA A
//   Ada    (admin)      — Kontoverwaltung, in KEINEM Space Mitglied (kein Rollen-Durchgriff)
//   Carla  (controller) — zuständig für beide Partnerbereiche und die Werkstatt
//   Lea    (experte)    — Mitglied „Partner Alpha" (lesen) und Werkstatt (lesen)
//   Erik   (experte)    — Autor aller Einträge, Mitglied „Partner Alpha" (schreiben)
//   Vera   (viewer)     — kein Mitglied
//
//   E1 eigen, intern · E2 eigen, vertraulich · W1 eigen, im geschlossenen Space „Werkstatt"
//   P1 im Partnerbereich „Alpha GmbH" · P2 im Partnerbereich „Beta AG" · O1 öffentlich
//
// FIRMA B — eine zweite Instanz mit eigenem Partnerbereich und eigenem Eintrag.
//
// Ordnung zu den Originalkriterien (AUFTRAG-B1.json):
//   K1 · Eigene Firma, freigegebener Partner und öffentlich unterscheidbar
//   K2 · Filter verleiht keine zusätzlichen Rechte
//   K3 · Mandant und Rechte vor Suche sowie vor Ausgabe geprüft
//   K4 · Manipulierter Firmenschlüssel bleibt erfolglos
//   K5 · Zähler, Export und Modellkontext bleiben im erlaubten Raum
//   K6 · Rechtekontext und Widerruf wirken mit der nächsten Anfrage (kein Zwischenstand)
//   K7 · Kontextwechsel lässt keine unberechtigten alten Ergebnisse stehen
//   K8 · Zwei Firmen und mehrere Rollen mit positiven/negativen Fällen
import { describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { HintergrundlaufBericht } from "../../services/app/src/hintergrundpruefung";
import { fingerabdruck } from "../../services/ask";
import type { KnowledgeObject } from "../../services/knowledge-object";
import {
  beobachtungenAus,
  halbwertszeitenAusVerlauf,
} from "../../services/knowledge-object/src/frische";
import { type ModelClient, ModelProvider, Reasoner } from "../../services/reasoner";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";
import { GOOD_CONFLICT, GOOD_DUPLICATE } from "../review26-teilpruefung-ursache/fixture";

type App = ReturnType<typeof buildApp>;
type Kopf = { authorization: string };

const KENNWORT = "geheim12345";
// Das Wort steht in JEDEM Testeintrag — so trifft die Suche jeden, und nur der Filter grenzt ein.
const WORT = "Messkettenabgleich";
const ALLE = "firmenbereich=eigen,partner,oeffentlich";
const MINUTE = 60_000;
const TAG = 24 * 60 * MINUTE;

async function anmelden(app: App, email: string): Promise<Kopf> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: KENNWORT },
  });
  expect(res.statusCode, `Anmeldung ${email}: ${res.body}`).toBe(200);
  return { authorization: `Bearer ${res.json().token}` };
}

async function konto(app: App, admin: Kopf, name: string, email: string, role: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: admin,
    payload: { name, email, password: KENNWORT, role },
  });
  expect(res.statusCode, `Konto ${email}: ${res.body}`).toBe(201);
}

async function kontoIds(app: App, kopf: Kopf): Promise<Map<string, string>> {
  const res = await app.inject({ method: "GET", url: "/api/spaces/konten", headers: kopf });
  expect(res.statusCode, res.body).toBe(200);
  const konten = res.json().konten as { id: string; name: string }[];
  return new Map(konten.map((k) => [k.name, k.id]));
}

async function space(app: App, kopf: Kopf, eingabe: Record<string, unknown>): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/spaces",
    headers: kopf,
    payload: eingabe,
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

async function eintrag(app: App, kopf: Kopf, titel: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: kopf,
    payload: {
      confidentiality: "intern",
      title: `${WORT} ${titel}`,
      statement: `Der ${WORT} ${titel} läuft vor jeder Schicht.`,
      type: "best_practice",
      category: "Messtechnik",
      tags: ["messkette"],
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

/**
 * P14 · B-07 (Nacharbeit 5): eine neutrale Modellattrappe — jeder Vergleich antwortet „kein
 * Konflikt"/„verschieden". Kein echtes Modell; sie macht nur den Hintergrundabgleich ausführbar.
 * Wie ein lokaler Anbieter beurteilt sie auch Paare mit vertraulichem Nachbarn — sonst bliebe jeder
 * Vergleich mit E2 übersprungen und kein Abgleich vollständig.
 */
async function mitNeutralemModell(services: ReturnType<typeof buildServices>) {
  const client: ModelClient = {
    name: "test-provider",
    rejectsConfidential: false,
    async complete(system) {
      return system.includes('"relation"') ? GOOD_CONFLICT : GOOD_DUPLICATE;
    },
  };
  services.reasoner = new Reasoner(new ModelProvider(client));
  // Nacharbeit 7: ausdrücklich AUCH für vertrauliche Inhalte freigegeben (wie es ein Administrator
  // setzt). Ohne diese Freigabe bleibt jeder Vergleich mit dem vertraulichen Nachbarn E2 aus, und
  // der stille Abgleich von Leas Einträgen kann nicht gelingen (Prüflauf: fehlgeschlagen je Takt).
  await erteileKiFreigabe(services.reasoner, { oeffentlicheKi: true, vertraulicheInhalte: true });
}

/** Firma A mit vollständigem Bestand. Vorbereitung über HTTP; Space/Prüfstand über den Dienst. */
async function firmaA(optionen: { modell?: boolean } = {}) {
  const services = buildServices();
  if (optionen.modell) {
    await mitNeutralemModell(services);
  }
  // Der Hintergrundlauf DIESER App (build-app.ts) — `server.ts` taktet ihn, hier ruft ihn der Test.
  let hintergrundlauf: (() => Promise<HintergrundlaufBericht | null>) | undefined;
  const app = buildApp(services, {
    hintergrundpruefung: (lauf) => {
      hintergrundlauf = lauf;
    },
  });
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@firma-a.test", password: KENNWORT },
  });
  const ada = await anmelden(app, "ada@firma-a.test");
  await konto(app, ada, "Carla Controller", "carla@firma-a.test", "controller");
  await konto(app, ada, "Lea Leitung", "lea@firma-a.test", "experte");
  await konto(app, ada, "Erik Experte", "erik@firma-a.test", "experte");
  await konto(app, ada, "Vera Viewer", "vera@firma-a.test", "viewer");
  const k = {
    ada,
    carla: await anmelden(app, "carla@firma-a.test"),
    lea: await anmelden(app, "lea@firma-a.test"),
    erik: await anmelden(app, "erik@firma-a.test"),
    vera: await anmelden(app, "vera@firma-a.test"),
  };
  const n = await kontoIds(app, k.carla);
  const ids = {
    carla: n.get("Carla Controller") ?? "",
    lea: n.get("Lea Leitung") ?? "",
    erik: n.get("Erik Experte") ?? "",
  };
  const alphaEingabe = {
    name: "Partner Alpha",
    zweck: "Freigegebener Austausch mit der Alpha GmbH.",
    verantwortlich: ids.carla,
    zugang: "mitglieder",
    mitglieder: [
      { nutzer: ids.lea, recht: "lesen" },
      { nutzer: ids.erik, recht: "schreiben" },
    ],
    ansichten: [],
    kontext: "partner",
    partner: "Alpha GmbH",
  };
  const alpha = await space(app, k.carla, alphaEingabe);
  const beta = await space(app, k.carla, {
    name: "Partner Beta",
    zweck: "Freigegebener Austausch mit der Beta AG.",
    verantwortlich: ids.carla,
    zugang: "mitglieder",
    mitglieder: [],
    ansichten: [],
    kontext: "partner",
    partner: "Beta AG",
  });
  const werkstatt = await space(app, k.carla, {
    name: "Werkstatt",
    zweck: "Eigene Arbeitsanweisungen der Werkstatt.",
    verantwortlich: ids.carla,
    zugang: "mitglieder",
    mitglieder: [{ nutzer: ids.lea, recht: "lesen" }],
    ansichten: [],
  });
  const ko = {
    E1: await eintrag(app, k.erik, "Eigenwissen"),
    E2: await eintrag(app, k.erik, "Vertraulich"),
    W1: await eintrag(app, k.erik, "Werkstatt"),
    P1: await eintrag(app, k.erik, "PartnerAlpha"),
    P2: await eintrag(app, k.erik, "PartnerBeta"),
    O1: await eintrag(app, k.erik, "Oeffentlich"),
  };
  const hoch = await app.inject({
    method: "PUT",
    url: `/api/kos/${ko.E2}`,
    headers: k.erik,
    payload: { action: "confidentiality", level: "vertraulich" },
  });
  expect(hoch.statusCode, hoch.body).toBe(200);
  const oeffentlich = await app.inject({
    method: "PUT",
    url: `/api/kos/${ko.O1}`,
    headers: k.carla,
    payload: { action: "schutz-oeffentlich", oeffentlich: true },
  });
  expect(oeffentlich.statusCode, oeffentlich.body).toBe(200);
  // Testvorbereitung über den Dienst: führender Space und Prüfstand (Export und Klara verlangen
  // geprüftes Wissen). Gelesen wird danach ausschliesslich über HTTP.
  await services.ko.setLeadingSpace(ko.W1, werkstatt, ids.carla, null);
  await services.ko.setLeadingSpace(ko.P1, alpha, ids.carla, null);
  await services.ko.setLeadingSpace(ko.P2, beta, ids.carla, null);
  for (const id of Object.values(ko)) {
    await services.ko.setValidationState(id, { trust: 90, status: "validiert" });
  }
  const hintergrund = async () => {
    if (!hintergrundlauf) {
      throw new Error("Aufbau: der Hintergrundlauf der App ist nicht verdrahtet.");
    }
    return hintergrundlauf();
  };
  return {
    app,
    services,
    k,
    ids,
    ko,
    spaces: { alpha, beta, werkstatt },
    alphaEingabe,
    hintergrund,
  };
}

/** Firma B — eine zweite Anlage mit eigenem Partnerbereich und eigenem Eintrag. */
async function firmaB() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Bodo Admin", email: "bodo@firma-b.test", password: KENNWORT },
  });
  const bodo = await anmelden(app, "bodo@firma-b.test");
  const n = await kontoIds(app, bodo);
  const partner = await space(app, bodo, {
    name: "Partner Alpha",
    zweck: "Austausch der Firma B mit derselben Partnerfirma.",
    verantwortlich: n.get("Bodo Admin") ?? "",
    // Ein Partnerbereich ist nie für alle offen (gesamt-wissensprojekte); Bodo liest als Zuständiger.
    zugang: "mitglieder",
    mitglieder: [],
    ansichten: [],
    kontext: "partner",
    partner: "Alpha GmbH",
  });
  const eigen = await eintrag(app, bodo, "FirmaB");
  return { app, bodo, partner, eigen };
}

type FirmaA = Awaited<ReturnType<typeof firmaA>>;

async function lies(app: App, kopf: Kopf, url: string) {
  return app.inject({ method: "GET", url, headers: kopf });
}

/** Die Testeinträge, die eine Antwort nennt — als Kürzel in fester Reihenfolge. */
function genannt(a: FirmaA, body: string): string[] {
  return Object.entries(a.ko)
    .filter(([, id]) => body.includes(id))
    .map(([name]) => name)
    .sort();
}

/** ALLE Kennungen einer Listenantwort — auch die, die dieser Test nicht angelegt hat. */
function kennungen(body: string): string[] {
  return (JSON.parse(body) as { id: string }[]).map((x) => x.id).sort();
}

async function liste(a: FirmaA, kopf: Kopf, abfrage: string): Promise<string[]> {
  const res = await lies(a.app, kopf, `/api/kos?${abfrage}`);
  expect(res.statusCode, res.body).toBe(200);
  return genannt(a, res.body);
}

async function suche(a: FirmaA, kopf: Kopf, abfrage: string): Promise<string[]> {
  const res = await lies(a.app, kopf, `/api/library/search?q=${WORT}&${abfrage}`);
  expect(res.statusCode, res.body).toBe(200);
  return genannt(a, res.body);
}

async function ausfuhr(a: FirmaA, kopf: Kopf, abfrage: string): Promise<string[]> {
  const res = await lies(a.app, kopf, `/api/library/export?${abfrage}`);
  expect(res.statusCode, res.body).toBe(200);
  return genannt(a, res.body);
}

async function frage(a: FirmaA, kopf: Kopf, filter: Record<string, string>) {
  return a.app.inject({
    method: "POST",
    url: "/api/ask",
    headers: kopf,
    payload: { question: `Wie läuft der ${WORT}?`, mode: "retrieval-only", ...filter },
  });
}

// Die erwartete Sicht je Rolle — abgeleitet aus Stufe, Autorschaft und Spacemitgliedschaft, nicht
// aus dem Filter. Der Filter darf diese Mengen nur zerlegen.
const ERWARTET: Record<
  "ada" | "carla" | "lea" | "erik" | "vera",
  { eigen: string[]; partner: string[]; oeffentlich: string[] }
> = {
  ada: { eigen: ["E1", "E2"], partner: [], oeffentlich: ["O1"] },
  carla: { eigen: ["E1", "E2", "W1"], partner: ["P1", "P2"], oeffentlich: ["O1"] },
  lea: { eigen: ["E1", "W1"], partner: ["P1"], oeffentlich: ["O1"] },
  erik: { eigen: ["E1", "E2"], partner: ["P1"], oeffentlich: ["O1"] },
  vera: { eigen: ["E1"], partner: [], oeffentlich: ["O1"] },
};
const ROLLEN = Object.keys(ERWARTET) as (keyof typeof ERWARTET)[];

describe("K1 · eigene Firma, freigegebener Partner und öffentlich sind unterscheidbar", () => {
  it("jeder Bereich liefert genau seine Einträge und nennt ihn an jedem Treffer", async () => {
    const a = await firmaA();
    expect(await liste(a, a.k.carla, "firmenbereich=eigen")).toEqual(["E1", "E2", "W1"]);
    expect(await liste(a, a.k.carla, "firmenbereich=partner")).toEqual(["P1", "P2"]);
    expect(await liste(a, a.k.carla, "firmenbereich=oeffentlich")).toEqual(["O1"]);
    expect(await liste(a, a.k.carla, `partner=${a.spaces.alpha}`)).toEqual(["P1"]);

    const res = await lies(a.app, a.k.carla, `/api/kos?${ALLE}`);
    const treffer = res.json() as { id: string; firmenbereich: string }[];
    const bereichJe = new Map(treffer.map((x) => [x.id, x.firmenbereich]));
    expect(bereichJe.get(a.ko.E1)).toBe("eigen");
    expect(bereichJe.get(a.ko.W1)).toBe("eigen");
    expect(bereichJe.get(a.ko.P1)).toBe("partner");
    expect(bereichJe.get(a.ko.P2)).toBe("partner");
    expect(bereichJe.get(a.ko.O1)).toBe("oeffentlich");

    // Die Suche zerlegt genauso und nennt den Bereich ebenfalls.
    const url = `/api/library/search?q=${WORT}&firmenbereich=partner`;
    const gefunden = await lies(a.app, a.k.lea, url);
    expect(gefunden.json()).toEqual([
      expect.objectContaining({ id: a.ko.P1, firmenbereich: "partner" }),
    ]);
    // Ungefiltert bleibt der Draht wie bisher: kein neues Feld.
    const ohne = await lies(a.app, a.k.lea, "/api/kos");
    expect(ohne.body).not.toContain("firmenbereich");
  });

  it("die Partnermarke ist am Space lesbar und überlebt eine Pflege, die sie nicht nennt", async () => {
    const a = await firmaA();
    const vorher = await lies(a.app, a.k.lea, `/api/spaces/${a.spaces.alpha}`);
    expect(vorher.json().space.partner).toBe("Alpha GmbH");
    const { partner: _weg, ...ohnePartner } = a.alphaEingabe;
    const pflege = await a.app.inject({
      method: "PUT",
      url: `/api/spaces/${a.spaces.alpha}`,
      headers: a.k.carla,
      payload: { ...ohnePartner, version: 1, zweck: "Neu beschrieben." },
    });
    expect(pflege.statusCode, pflege.body).toBe(200);
    expect(pflege.json().partner).toBe("Alpha GmbH");
    expect(await liste(a, a.k.lea, "firmenbereich=partner")).toEqual(["P1"]);
  });
});

describe("K2 · der Filter verleiht keine zusätzlichen Rechte", () => {
  it("für jede Rolle ist jede gefilterte Menge Teil der ungefilterten Sicht", async () => {
    const a = await firmaA();
    for (const rolle of ROLLEN) {
      const kopf = a.k[rolle];
      const alle = await liste(a, kopf, "");
      for (const abfrage of [
        "firmenbereich=eigen",
        "firmenbereich=partner",
        "firmenbereich=oeffentlich",
        `partner=${a.spaces.alpha}`,
        `partner=${a.spaces.beta}`,
        `partner=${a.spaces.werkstatt}`,
      ]) {
        const gefiltert = await liste(a, kopf, abfrage);
        const ueberschuss = gefiltert.filter((x) => !alle.includes(x));
        expect(ueberschuss, `${rolle} · ${abfrage}`).toEqual([]);
      }
    }
  });

  it("Admin und Viewer bekommen über den Partnerfilter keinen Partnerinhalt", async () => {
    const a = await firmaA();
    for (const kopf of [a.k.ada, a.k.vera]) {
      for (const abfrage of ["firmenbereich=partner", `partner=${a.spaces.alpha}`]) {
        expect(await liste(a, kopf, abfrage)).toEqual([]);
        expect(await suche(a, kopf, abfrage)).toEqual([]);
        expect(await ausfuhr(a, kopf, abfrage)).toEqual([]);
        const res = await lies(a.app, kopf, `/api/kos?${abfrage}`);
        expect(res.body).not.toContain("PartnerAlpha");
      }
    }
    // Lea ist nur in Alpha: Beta bleibt verschlossen, auch wenn sie die Kennung nennt.
    expect(await liste(a, a.k.lea, `partner=${a.spaces.beta}`)).toEqual([]);
    // Und das Vertrauliche bleibt beim Bereich „eigen" so geschützt wie ohne Filter.
    expect(await liste(a, a.k.lea, "firmenbereich=eigen")).not.toContain("E2");
  });
});

describe("K3 · Mandant und Rechte vor Suche sowie vor Ausgabe", () => {
  it("ohne gültige Sitzung entscheidet zuerst die Anmeldung — auch bei ungültigem Filter", async () => {
    const a = await firmaA();
    const b = await firmaB();
    for (const url of [
      "/api/kos?firmenbereich=eigen",
      "/api/kos?firmenbereich=fremd",
      `/api/library/search?q=${WORT}&firmenbereich=partner`,
      "/api/library/export?firmenbereich=oeffentlich",
    ]) {
      const anonym = await a.app.inject({ method: "GET", url });
      expect(anonym.statusCode, url).toBe(401);
      // Die Sitzung von Firma B gilt in Firma A nicht — der Filter ändert daran nichts.
      const fremdeSitzung = await a.app.inject({ method: "GET", url, headers: b.bodo });
      expect(fremdeSitzung.statusCode, url).toBe(401);
    }
  });

  it("ein ungültiger Filter wird abgewiesen, bevor gelesen wird — gleich für jede Rolle", async () => {
    const a = await firmaA();
    const antworten = new Set<string>();
    for (const rolle of ROLLEN) {
      for (const url of [
        "/api/kos?firmenbereich=fremd",
        `/api/library/search?q=${WORT}&firmenbereich=`,
        "/api/library/export?partner=x'%20OR%201=1",
      ]) {
        const res = await lies(a.app, a.k[rolle], url);
        expect(res.statusCode, `${rolle} ${url}`).toBe(400);
        antworten.add(res.body);
      }
    }
    // EINE Antwort für alle Rollen und Wege: sie hängt an der Eingabe, nie am Bestand.
    expect(antworten.size).toBe(1);
    expect([...antworten][0]).not.toContain(WORT);
  });

  it("der Bereich wird nur an sichtbaren Treffern genannt", async () => {
    const a = await firmaA();
    const res = await lies(a.app, a.k.vera, `/api/kos?${ALLE}`);
    expect(genannt(a, res.body)).toEqual(["E1", "O1"]);
    expect(res.body).not.toContain(a.spaces.alpha);
    expect(res.body).not.toContain(a.spaces.beta);
  });
});

describe("K4 · ein manipulierter Firmenschlüssel bleibt erfolglos", () => {
  it("fremde, unbekannte, nicht freigegebene und firmenfremde Kennungen: dieselbe leere Antwort", async () => {
    const a = await firmaA();
    const b = await firmaB();
    const antworten = new Set<string>();
    for (const partner of [
      a.spaces.beta, // gibt es, Lea ist kein Mitglied
      a.spaces.werkstatt, // gibt es, Lea darf lesen — aber es ist kein Partnerbereich
      "00000000-0000-4000-8000-000000000000", // gibt es nicht
      b.partner, // Partnerbereich der ANDEREN Firma
    ]) {
      const res = await lies(a.app, a.k.lea, `/api/kos?partner=${partner}`);
      expect(res.statusCode, partner).toBe(200);
      antworten.add(res.body);
      const url = `/api/library/search?q=${WORT}&partner=${partner}`;
      const treffer = await lies(a.app, a.k.lea, url);
      expect(treffer.statusCode, partner).toBe(200);
      antworten.add(treffer.body);
    }
    expect([...antworten]).toEqual(["[]"]);
  });

  it("Mandanten-, Firmen- und Gastangaben in der Anfrage werden nicht als Schlüssel gelesen", async () => {
    const a = await firmaA();
    const b = await firmaB();
    const sauber = await liste(a, a.k.lea, "firmenbereich=eigen");
    for (const zusatz of [
      `tenant_id=${b.partner}`,
      "mandant=firma-b",
      "firma=Alpha%20GmbH",
      "gast=true",
      `spaceId=${a.spaces.beta}`,
    ]) {
      expect(await liste(a, a.k.lea, `firmenbereich=eigen&${zusatz}`), zusatz).toEqual(sauber);
    }
    // Die Instanz der anderen Firma kennt die Kennungen von Firma A nicht — auch nicht gefiltert.
    const quer = await lies(b.app, b.bodo, `/api/kos?partner=${a.spaces.alpha}`);
    expect(quer.statusCode).toBe(200);
    expect(quer.json()).toEqual([]);
    const fremdesObjekt = await lies(b.app, b.bodo, `/api/kos/${a.ko.P1}`);
    expect(fremdesObjekt.statusCode).toBe(404);
  });
});

describe("K5 · Zähler, Export und Modellkontext bleiben im erlaubten Raum", () => {
  it("die drei Bereiche zerlegen die Sicht jeder Rolle ohne Überschuss — Liste und Suche", async () => {
    const a = await firmaA();
    for (const rolle of ROLLEN) {
      const kopf = a.k[rolle];
      for (const weg of [liste, suche]) {
        const eigen = await weg(a, kopf, "firmenbereich=eigen");
        const partner = await weg(a, kopf, "firmenbereich=partner");
        const oeffentlich = await weg(a, kopf, "firmenbereich=oeffentlich");
        expect({ eigen, partner, oeffentlich }, `${rolle} · ${weg.name}`).toEqual(ERWARTET[rolle]);
        const summe = eigen.length + partner.length + oeffentlich.length;
        expect((await weg(a, kopf, "")).length, `${rolle} · Zahl`).toBe(summe);
      }
    }
  });

  it("der Export grenzt mit dem Filter nur ein — nie über die Lesemenge hinaus", async () => {
    const a = await firmaA();
    expect(await ausfuhr(a, a.k.lea, "firmenbereich=partner")).toEqual(["P1"]);
    expect(await ausfuhr(a, a.k.carla, "firmenbereich=partner")).toEqual(["P1", "P2"]);
    expect(await ausfuhr(a, a.k.carla, `partner=${a.spaces.beta}`)).toEqual(["P2"]);
    // Viewer: Vertrauliches nie, Partnerinhalt ohne Mitgliedschaft nie.
    expect(await ausfuhr(a, a.k.vera, ALLE)).toEqual(["E1", "O1"]);
    // `ids` und Filter zugleich: eine genannte fremde Kennung kommt nicht heraus.
    const auswahl = `firmenbereich=eigen&ids=${a.ko.P2},${a.ko.E1}`;
    expect(await ausfuhr(a, a.k.lea, auswahl)).toEqual(["E1"]);
    const url = "/api/library/export?format=markdown&firmenbereich=partner";
    const md = await lies(a.app, a.k.lea, url);
    expect(md.statusCode).toBe(200);
    expect(md.body).toContain("PartnerAlpha");
    expect(md.body).not.toContain("PartnerBeta");
    expect(md.body).not.toContain("Eigenwissen");
  });

  it("die Grundlage der Antwort (Modellkontext) folgt Recht UND Filter", async () => {
    const a = await firmaA();
    const partner = await frage(a, a.k.lea, { firmenbereich: "partner" });
    expect(partner.statusCode, partner.body).toBe(200);
    expect(genannt(a, partner.body), "KALIBRIERUNG: Lea bekommt P1").toEqual(["P1"]);

    const eigen = await frage(a, a.k.lea, { firmenbereich: "eigen" });
    expect(eigen.statusCode, eigen.body).toBe(200);
    const fremd = genannt(a, eigen.body).filter((x) => ["P1", "P2", "O1", "E2"].includes(x));
    expect(fremd).toEqual([]);

    // Ohne Recht hilft der Filter nicht: Vera bekommt keinen Partnerinhalt als Grundlage.
    const vera = await frage(a, a.k.vera, { partner: a.spaces.alpha });
    expect(vera.statusCode, vera.body).toBe(200);
    expect(genannt(a, vera.body)).toEqual([]);
    expect(vera.body).not.toContain("PartnerAlpha");

    const kaputt = await frage(a, a.k.lea, { firmenbereich: "alle-firmen" });
    expect(kaputt.statusCode).toBe(400);
  });
});

describe("K6 · Rechtekontext und Widerruf wirken mit der nächsten Anfrage", () => {
  it("nach dem Entzug der Mitgliedschaft ist der Partnerinhalt auf allen Wegen weg", async () => {
    const a = await firmaA();
    expect(await liste(a, a.k.lea, "firmenbereich=partner")).toEqual(["P1"]);
    expect(await suche(a, a.k.lea, "firmenbereich=partner")).toEqual(["P1"]);
    expect(await ausfuhr(a, a.k.lea, "firmenbereich=partner")).toEqual(["P1"]);

    const entzug = await a.app.inject({
      method: "PUT",
      url: `/api/spaces/${a.spaces.alpha}`,
      headers: a.k.carla,
      payload: {
        ...a.alphaEingabe,
        version: 1,
        mitglieder: [{ nutzer: a.ids.erik, recht: "schreiben" }],
      },
    });
    expect(entzug.statusCode, entzug.body).toBe(200);

    expect(await liste(a, a.k.lea, "firmenbereich=partner")).toEqual([]);
    expect(await suche(a, a.k.lea, "firmenbereich=partner")).toEqual([]);
    expect(await ausfuhr(a, a.k.lea, "firmenbereich=partner")).toEqual([]);
    const antwort = await frage(a, a.k.lea, { firmenbereich: "partner" });
    expect(antwort.statusCode, antwort.body).toBe(200);
    expect(genannt(a, antwort.body)).toEqual([]);
    // Gegenprobe: Erik behält sein Recht.
    expect(await liste(a, a.k.erik, "firmenbereich=partner")).toEqual(["P1"]);
  });

  it("eine aufgehobene Partnermarke wirkt sofort — der Bereich folgt dem aktuellen Space", async () => {
    const a = await firmaA();
    const aufheben = await a.app.inject({
      method: "PUT",
      url: `/api/spaces/${a.spaces.alpha}`,
      headers: a.k.carla,
      // Seit der Zusammenführung mit main: Rückkehr zur eigenen Firma über den Kontext.
      payload: { ...a.alphaEingabe, version: 1, kontext: "firma", partner: null },
    });
    expect(aufheben.statusCode, aufheben.body).toBe(200);
    expect(aufheben.json()).toMatchObject({ kontext: "firma", partner: null });
    expect(await liste(a, a.k.erik, "firmenbereich=partner")).toEqual([]);
    expect(await liste(a, a.k.erik, "firmenbereich=eigen")).toEqual(["E1", "E2", "P1"]);
  });

  // ==============================================================================================
  // B-07 (Prüfnachtrag) · Nacharbeit 2, Bens Befund „Antwortvergleich": verglichen werden die
  // VOLLSTÄNDIGEN Antworten — samt Metadaten, Prüfvermerk (`aiCheck.ueberholt`), Zählung und
  // Rechtekontext-Kopf —, nicht nur Kennungen. Kalibriert ist mit abgeschlossenen Nachweisen samt
  // vollständig gespeicherter Basis. Normalisiert wird NICHTS: die Uhr steht während der Vergleiche
  // still (`Date`), weil die Frische-Auskunft an der Uhrzeit hängt — das ist der einzige begründet
  // veränderliche Anteil, und er wird angehalten statt herausgerechnet.
  //
  // Nacharbeit 5 (Bens Befunde 1 und 2): der Vergleich schliesst jetzt den TATSÄCHLICH AUSGEFÜHRTEN
  // Hintergrundabgleich der App ein (derselbe Lauf, den `server.ts` taktet; neutrale Modellattrappe)
  // und die ERNEUERUNG des Zwischenspeichers der gelernten Halbwertszeiten (Frist 10 Minuten). Damit
  // die zeitabhängige Frische-Auskunft vergleichbar bleibt, wird nach der Erneuerung die Uhr auf den
  // Vergleichszeitpunkt zurückgestellt; der erneuerte Zwischenspeicher bleibt dabei wirksam (seine
  // Frist liegt danach). Ob unsichtbare Fassungen eine sichtbare Frist verschieben, misst — mit einem
  // neuen sichtbaren Stand NACH dem Lernen — der eigene Fall „Halbwertszeiten" unten.
  // ==============================================================================================
  it("B-07: eine für Lea unsichtbare Änderung ändert keine ihrer vollständigen Antworten — Gegenprobe, Existenz, Widerruf", async () => {
    const a = await firmaA({ modell: true });
    await a.services.aiCheckWorker?.idle();
    // KALIBRIERUNG 1: jeder Eintrag trägt einen abgeschlossenen Nachweis mit vollständiger Basis.
    for (const id of Object.values(a.ko)) {
      expect(await a.services.ko.markAiCheckPending(id)).toBe(true);
      const start = (await a.services.ko.get(id)) as KnowledgeObject;
      const basis = await a.services.ko.aktuellePruefbasis(start);
      const fassung = start.aiCheck?.koVersion;
      expect(await a.services.ko.resolveAiCheck(id, { ok: true }, fassung, basis), id).toBe(true);
    }
    const sichtbar = [a.ko.E1, a.ko.W1, a.ko.P1, a.ko.O1];
    const intern0 = await a.services.ko.listMitBestandsabgleich();
    for (const id of sichtbar) {
      // Intern ist die Bindung vollständig (samt Bestandsteil) …
      expect(intern0.find((k) => k.id === id)?.aiCheck?.basis?.bestand, id).toBeTruthy();
      // … am Draht trägt kein Eintrag den Bestandsteil (er hängt am ganzen Bestand).
      const ko = (await lies(a.app, a.k.lea, `/api/kos/${id}`)).json() as KnowledgeObject;
      expect(ko.aiCheck?.status, id).toBe("done");
      expect(ko.aiCheck?.basis?.quelle, id).toBeTruthy();
      expect(ko.aiCheck?.basis?.bestand, id).toBeUndefined();
      expect(ko.aiCheck?.ueberholt, id).toBeUndefined();
    }
    const unbekannt = "00000000-0000-4000-8000-0000000000b7";
    const wege = [
      `/api/kos?${ALLE}`,
      "/api/kos",
      `/api/library/search?q=${WORT}&${ALLE}`,
      `/api/library/search?q=${WORT}`,
      `/api/library/export?${ALLE}`,
      "/api/library/export",
      ...sichtbar.map((id) => `/api/kos/${id}`),
    ];
    const antworten = async (kopf: Kopf) => {
      const aus: Record<string, unknown> = {};
      for (const url of wege) {
        const res = await lies(a.app, kopf, url);
        aus[url] = {
          status: res.statusCode,
          koerper: res.json(),
          kontext: res.headers["x-klarwerk-rechtekontext"],
        };
      }
      return aus;
    };
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const vergleichszeit = Date.now();
      vi.setSystemTime(vergleichszeit);
      const vorher = await antworten(a.k.lea);

      // Für Lea unsichtbar: ein neuer Eintrag im Beta-Bereich, eine neue Fassung und eine
      // Höherstufung von P2.
      const neu = await eintrag(a.app, a.k.erik, "NochEinBeta");
      await a.services.ko.setLeadingSpace(neu, a.spaces.beta, a.ids.carla, null);
      await a.services.ko.setValidationState(neu, { trust: 90, status: "validiert" });
      await a.services.aiCheckWorker?.idle();
      const neueFassung = { statement: "Beta prüft künftig zweimal." };
      await a.services.ko.revise(a.ko.P2, neueFassung, a.ids.carla);
      const hoch = await a.app.inject({
        method: "PUT",
        url: `/api/kos/${a.ko.P2}`,
        headers: a.k.carla,
        payload: { action: "confidentiality", level: "vertraulich" },
      });
      expect(hoch.statusCode, hoch.body).toBe(200);

      // KALIBRIERUNG 2: die Änderung HAT den Bestandsteil verschoben — intern ist Leas sichtbarer
      // Nachweis überholt. Genau dieses Bit stand vor der Reparatur in jeder ihrer Antworten.
      const intern = await a.services.ko.listMitBestandsabgleich();
      expect(intern.find((k) => k.id === a.ko.E1)?.aiCheck?.ueberholt).toBe(true);

      expect(await antworten(a.k.lea)).toEqual(vorher);

      // DER HINTERGRUNDABGLEICH LÄUFT TATSÄCHLICH — nach Ablauf des Halbwertszeit-Zwischenspeichers.
      vi.setSystemTime(vergleichszeit + 11 * MINUTE);
      await a.services.ko.gelernteHalbwertszeiten(); // erneuert (Frist 10 Minuten abgelaufen)
      // Je Takt passt nach dem Laufbudget etwa ein Objekt; getaktet wird, bis Leas sichtbare
      // Einträge intern nicht mehr überholt sind (höchstens 20 Takte).
      const sichtbarUeberholt = async () =>
        (await a.services.ko.listMitBestandsabgleich()).filter(
          (k) => sichtbar.includes(k.id) && k.aiCheck?.ueberholt,
        ).length;
      const berichte: HintergrundlaufBericht[] = [];
      for (let takt = 0; takt < 20 && (await sichtbarUeberholt()) > 0; takt++) {
        const bericht = await a.hintergrund();
        expect(bericht, "der Lauf überlappt nicht").not.toBeNull();
        if (!bericht) {
          break;
        }
        berichte.push(bericht);
        expect(bericht.abbruch, JSON.stringify(bericht)).not.toBe("kein-modell");
      }
      // KALIBRIERUNG 3: der Lauf hat Leas sichtbare Einträge wirklich neu verglichen (still) —
      // intern ist keiner mehr überholt, der Bericht zählt sie, und das Modell wurde gerufen.
      expect(await sichtbarUeberholt(), JSON.stringify(berichte)).toBe(0);
      const abgeglichen = berichte.reduce((s, b) => s + b.abgeglichen, 0);
      expect(abgeglichen, JSON.stringify(berichte)).toBeGreaterThanOrEqual(sichtbar.length);
      expect(berichte.reduce((s, b) => s + b.vergleiche, 0)).toBeGreaterThan(0);
      const nachAbgleich = await a.services.ko.listMitBestandsabgleich();
      for (const id of sichtbar) {
        expect(nachAbgleich.find((k) => k.id === id)?.aiCheck?.status, id).toBe("done");
      }

      // Zurück auf den Vergleichszeitpunkt: Abgleich und erneuerter Lernstand sind in Kraft — und
      // Leas vollständige Antworten (Metadaten, Prüfvermerk, Frische, Kopf) sind unverändert.
      vi.setSystemTime(vergleichszeit);
      expect(await antworten(a.k.lea)).toEqual(vorher);

      // GEGENPROBE (erlaubt): eine Änderung, die Lea sehen darf, kommt bei ihr an — samt Bit.
      await a.services.ko.updateTags(a.ko.W1, ["neu"], a.ids.carla);
      const danach = await antworten(a.k.lea);
      expect(danach).not.toEqual(vorher);
      const w1 = (await lies(a.app, a.k.lea, `/api/kos/${a.ko.W1}`)).json() as KnowledgeObject;
      expect(w1.aiCheck?.ueberholt).toBe(true);
      expect(w1.tags).toEqual(["neu"]);
    } finally {
      vi.useRealTimers();
    }

    // EXISTENZ, bereichsgebunden: wer den Partnerbereich lesen darf, erfährt vom Eintrag (positiv);
    // wer nicht, bekommt dieselbe Antwort wie für eine Kennung, die es nicht gibt (negativ).
    const nichtDa = await lies(a.app, a.k.lea, `/api/kos/${unbekannt}`);
    expect(nichtDa.statusCode).toBe(404);
    expect((await lies(a.app, a.k.lea, `/api/kos/${a.ko.P1}`)).statusCode).toBe(200);
    const fremdFuerLea = await lies(a.app, a.k.lea, `/api/kos/${a.ko.P2}`);
    expect([fremdFuerLea.statusCode, fremdFuerLea.body]).toEqual([404, nichtDa.body]);
    const fremdFuerVera = await lies(a.app, a.k.vera, `/api/kos/${a.ko.P1}`);
    const nichtDaVera = await lies(a.app, a.k.vera, `/api/kos/${unbekannt}`);
    expect([fremdFuerVera.statusCode, fremdFuerVera.body]).toEqual([404, nichtDaVera.body]);

    // WIDERRUF: nach dem Entzug ist P1 für Lea wie nie dagewesen; ihr übriges Wissen bleibt gleich.
    const e1Vorher = (await lies(a.app, a.k.lea, `/api/kos/${a.ko.E1}`)).body;
    const entzug = await a.app.inject({
      method: "PUT",
      url: `/api/spaces/${a.spaces.alpha}`,
      headers: a.k.carla,
      payload: {
        ...a.alphaEingabe,
        version: 1,
        mitglieder: [{ nutzer: a.ids.erik, recht: "schreiben" }],
      },
    });
    expect(entzug.statusCode, entzug.body).toBe(200);
    const p1Danach = await lies(a.app, a.k.lea, `/api/kos/${a.ko.P1}`);
    expect([p1Danach.statusCode, p1Danach.body]).toEqual([404, nichtDa.body]);
    expect(await liste(a, a.k.lea, ALLE)).not.toContain("P1");
    expect(await ausfuhr(a, a.k.lea, ALLE)).not.toContain("P1");
    expect((await lies(a.app, a.k.lea, `/api/kos/${a.ko.E1}`)).body).toBe(e1Vorher);
  });

  // ==============================================================================================
  // B-07 · Nacharbeit 5, Bens Befund 2 — GELERNTE HALBWERTSZEITEN NACH ABLAUF DES ZWISCHENSPEICHERS.
  //
  // Synthetischer Verlauf (erfundene Fassungen im Abstand von zwei Tagen, Kategorie „Messtechnik"):
  // zuerst an P2 (Partnerbereich Beta) und E2 (vertraulich) — für Lea unsichtbar —, danach als
  // erlaubte Gegenprobe an O1 (öffentlich). Nach jedem Verlauf läuft die 10-Minuten-Frist ab, der
  // Lernstand wird erneuert, und erst DANACH beginnt Leas sichtbarer W1 einen neuen Stand (Bestätigung
  // durch den Verantwortlichen) — nur so kann ein neuer Lernstand seine Frist überhaupt erreichen.
  // ==============================================================================================
  it("B-07 · Halbwertszeiten: nach Ablauf des Zwischenspeichers lernt Leas Frist nichts aus unsichtbaren Fassungen — Gegenprobe öffentlich", async () => {
    const a = await firmaA();
    const frist = async () => {
      const res = await lies(a.app, a.k.lea, `/api/kos/${a.ko.W1}`);
      expect(res.statusCode, res.body).toBe(200);
      const f = (res.json() as { frische: Record<string, unknown> }).frische;
      return {
        herkunft: f.halbwertszeitHerkunft,
        beobachtungen: f.halbwertszeitBeobachtungen,
        tage: f.halbwertszeitTage,
        bezugAm: f.bezugAm,
      };
    };
    const verlauf = async (id: string, actor: string, ab: number) => {
      for (const schritt of [0, 2, 4]) {
        vi.setSystemTime(ab + schritt * TAG);
        await a.services.ko.revise(id, { statement: `${WORT} Stand ${schritt}.` }, actor);
      }
    };
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const start = Date.now() + TAG;
      const vorgabe = await frist();
      expect(vorgabe).toMatchObject({ herkunft: "vorgabe", beobachtungen: 0 });

      // 1 · UNSICHTBARER VERLAUF an P2 und E2.
      await verlauf(a.ko.P2, a.ids.carla, start);
      await verlauf(a.ko.E2, a.ids.erik, start);
      vi.setSystemTime(start + 4 * TAG + 11 * MINUTE); // Frist des Zwischenspeichers abgelaufen
      expect((await a.services.ko.gelernteHalbwertszeiten()).get("messtechnik")).toBeUndefined();
      // KALIBRIERUNG: der Verlauf hätte gereicht — nach der früheren Regel (alle Beobachtungen des
      // Bestands, ohne Rücksicht auf Lesbarkeit) wäre „Messtechnik" mit sechs Beobachtungen gelernt.
      const roh = [
        (await a.services.ko.get(a.ko.P2)) as KnowledgeObject,
        (await a.services.ko.get(a.ko.E2)) as KnowledgeObject,
      ];
      const beobachtet = beobachtungenAus(roh);
      expect(beobachtet).toHaveLength(6);
      expect(beobachtet.every((b) => b.oeffentlich === false)).toBe(true);
      const frueher = halbwertszeitenAusVerlauf(
        beobachtet.map((b) => ({ ...b, oeffentlich: true, erfasst: b.ende })),
      );
      expect(frueher.get("messtechnik")).toEqual({ tage: 30, beobachtungen: 6 });

      // Leas W1 beginnt NACH dem Lernen einen neuen Stand — die Frist bleibt bei der Vorgabe.
      vi.setSystemTime(start + 4 * TAG + 12 * MINUTE);
      await a.services.ko.bestaetigeFrische(a.ko.W1, a.ids.erik);
      const nachUnsichtbar = await frist();
      expect(nachUnsichtbar.bezugAm).toBe(new Date(start + 4 * TAG + 12 * MINUTE).toISOString());
      expect({ ...nachUnsichtbar, bezugAm: vorgabe.bezugAm }).toEqual(vorgabe);

      // 2 · ERLAUBTE GEGENPROBE: derselbe Verlauf an O1, das jedes Konto lesen darf, wirkt.
      const gegen = start + 5 * TAG;
      await verlauf(a.ko.O1, a.ids.carla, gegen);
      vi.setSystemTime(gegen + 4 * TAG + 11 * MINUTE);
      expect((await a.services.ko.gelernteHalbwertszeiten()).get("messtechnik")).toEqual({
        tage: 30,
        beobachtungen: 3,
      });
      vi.setSystemTime(gegen + 4 * TAG + 12 * MINUTE);
      await a.services.ko.bestaetigeFrische(a.ko.W1, a.ids.erik);
      expect(await frist()).toMatchObject({ herkunft: "gelernt", beobachtungen: 3, tage: 30 });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("K6/K7 · der Rechtekontext jeder Antwort folgt Rolle, Mitgliedschaft und Konto", () => {
  const kontext = (res: { headers: Record<string, unknown> }) =>
    res.headers["x-klarwerk-rechtekontext"] as string | undefined;

  it("Mitgliedschaftsentzug, Rollenentzug und Personenwechsel ändern den Stempel — sonst bleibt er", async () => {
    const a = await firmaA();
    const lea1 = await lies(a.app, a.k.lea, "/api/kos");
    const lea2 = await lies(a.app, a.k.lea, `/api/library/search?q=${WORT}`);
    expect(kontext(lea1), "jede angemeldete Antwort trägt ihn").toMatch(/^[0-9a-f]{32}$/);
    // Gegenprobe: gleiche Person, gleiche Rechte — gleicher Stempel auf jedem Weg.
    expect(kontext(lea2)).toBe(kontext(lea1));
    // Personenwechsel: Vera hat einen anderen Kontext.
    expect(kontext(await lies(a.app, a.k.vera, "/api/kos"))).not.toBe(kontext(lea1));

    // Mitgliedschaftsentzug.
    const entzug = await a.app.inject({
      method: "PUT",
      url: `/api/spaces/${a.spaces.alpha}`,
      headers: a.k.carla,
      payload: {
        ...a.alphaEingabe,
        version: 1,
        mitglieder: [{ nutzer: a.ids.erik, recht: "schreiben" }],
      },
    });
    expect(entzug.statusCode, entzug.body).toBe(200);
    const lea3 = await lies(a.app, a.k.lea, "/api/kos");
    expect(kontext(lea3)).not.toBe(kontext(lea1));
    expect(genannt(a, lea3.body)).not.toContain("P1");

    // Rollenentzug: Carla wird von controller zu experte — das Vertrauliche fällt weg.
    const carla1 = await lies(a.app, a.k.carla, "/api/kos");
    expect(genannt(a, carla1.body), "KALIBRIERUNG").toContain("E2");
    const herab = await a.app.inject({
      method: "PUT",
      url: `/api/users/${a.ids.carla}`,
      headers: a.k.ada,
      payload: { role: "experte" },
    });
    expect(herab.statusCode, herab.body).toBe(200);
    const carla2 = await lies(a.app, a.k.carla, "/api/kos");
    expect(kontext(carla2)).not.toBe(kontext(carla1));
    expect(genannt(a, carla2.body)).not.toContain("E2");

    // Nacharbeit 9 (Zusammenführung mit gesamt-leserechte): das persönliche Freigabeniveau
    // entscheidet mit — eine Erteilung und ein Entzug ändern den Stempel ebenso, bei gleicher Rolle.
    const vera1 = await lies(a.app, a.k.vera, "/api/kos");
    expect(genannt(a, vera1.body), "KALIBRIERUNG").not.toContain("E2");
    const veraId = (await kontoIds(a.app, a.k.ada)).get("Vera Viewer") ?? "";
    const setzeFreigabe = async (freigabe: string | null) => {
      const res = await a.app.inject({
        method: "PUT",
        url: `/api/users/${veraId}`,
        headers: a.k.ada,
        payload: { freigabe },
      });
      expect(res.statusCode, res.body).toBe(200);
    };
    await setzeFreigabe("vertraulich");
    const vera2 = await lies(a.app, a.k.vera, "/api/kos");
    expect(kontext(vera2)).not.toBe(kontext(vera1));
    expect(genannt(a, vera2.body)).toContain("E2");
    await setzeFreigabe(null);
    const vera3 = await lies(a.app, a.k.vera, "/api/kos");
    expect(kontext(vera3)).toBe(kontext(vera1));
    expect(genannt(a, vera3.body)).not.toContain("E2");
  });

  it("ohne Anmeldung gibt es keinen Stempel", async () => {
    const a = await firmaA();
    const anonym = await a.app.inject({ method: "GET", url: "/api/kos" });
    expect(anonym.statusCode).toBe(401);
    expect(kontext(anonym)).toBeUndefined();
  });
});

// ================================================================================================
// RF08/RF16 · Bens Befund 3 (Nacharbeit 5) — DAS BEREICHSGEBUNDENE EXISTENZRECHT.
//
// Vergeben am Space (`existenz`), gelesen über `GET /api/library/existenzhinweise?q=…`. Der Hinweis
// nennt nur den Bereich. Geprüft: positiv ohne Inhaltsfreigabe, kein Recht, falscher Bereich, die
// Stufe bleibt wirksam, wer lesen darf bekommt keinen Hinweis, Pflege ohne Feld, Widerruf.
// ================================================================================================
describe("K2/K3/K6 · das bereichsgebundene Existenzrecht", () => {
  const betaEingabe = (a: FirmaA, version: number, extra: Record<string, unknown> = {}) => ({
    name: "Partner Beta",
    zweck: "Freigegebener Austausch mit der Beta AG.",
    verantwortlich: a.ids.carla,
    zugang: "mitglieder",
    mitglieder: [],
    ansichten: [],
    kontext: "partner",
    partner: "Beta AG",
    version,
    ...extra,
  });
  const pflege = async (a: FirmaA, space: string, payload: Record<string, unknown>) => {
    const res = await a.app.inject({
      method: "PUT",
      url: `/api/spaces/${space}`,
      headers: a.k.carla,
      payload,
    });
    expect(res.statusCode, res.body).toBe(200);
    return res;
  };
  const hinweise = async (a: FirmaA, kopf: Kopf, q: string) => {
    const res = await lies(a.app, kopf, `/api/library/existenzhinweise?q=${encodeURIComponent(q)}`);
    return { status: res.statusCode, body: res.body };
  };
  const LEER = { status: 200, body: JSON.stringify({ hinweise: [] }) };
  const OHNE_TREFFER = "Zahnradpumpenlager";

  it("positiv: mit Existenzrecht an Beta erfährt Lea den Bereich — keinen Titel, keine Kennung, keinen Inhalt", async () => {
    const a = await firmaA();
    // VORHER: ohne Recht konstant leer — mit und ohne passenden verborgenen Treffer.
    expect(await hinweise(a, a.k.lea, WORT)).toEqual(LEER);
    expect(await hinweise(a, a.k.lea, OHNE_TREFFER)).toEqual(LEER);

    await pflege(a, a.spaces.beta, betaEingabe(a, 1, { existenz: [a.ids.lea] }));
    const mit = await hinweise(a, a.k.lea, WORT);
    expect(mit.status).toBe(200);
    expect(JSON.parse(mit.body)).toEqual({
      hinweise: [{ spaceId: a.spaces.beta, spaceName: "Partner Beta" }],
    });
    // Kein Inhaltsdetail: weder Kennung noch Titelwort des verborgenen Eintrags.
    expect(mit.body).not.toContain(a.ko.P2);
    expect(mit.body).not.toContain("PartnerBeta");
    // Ohne passenden Treffer: dieselbe leere Antwort wie ohne Recht.
    expect(await hinweise(a, a.k.lea, OHNE_TREFFER)).toEqual(LEER);

    // KEINE INHALTSFREIGABE: P2 bleibt auf jedem Leseweg verborgen.
    const nichtDa = await lies(a.app, a.k.lea, "/api/kos/00000000-0000-4000-8000-0000000000e1");
    const p2 = await lies(a.app, a.k.lea, `/api/kos/${a.ko.P2}`);
    expect([p2.statusCode, p2.body]).toEqual([404, nichtDa.body]);
    expect(await liste(a, a.k.lea, ALLE)).not.toContain("P2");
    expect(await suche(a, a.k.lea, ALLE)).not.toContain("P2");
    expect(await ausfuhr(a, a.k.lea, ALLE)).not.toContain("P2");
    const antwort = await frage(a, a.k.lea, {});
    expect(antwort.statusCode, antwort.body).toBe(200);
    expect(genannt(a, antwort.body)).not.toContain("P2");
    // Der Space selbst bleibt für Lea verborgen (kein Durchgriff auf Mitglieder oder Zweck).
    expect((await lies(a.app, a.k.lea, `/api/spaces/${a.spaces.beta}`)).statusCode).toBe(404);
  });

  it("negativ: kein Recht, falscher Bereich — Vera erfährt nur von Beta, nicht von Werkstatt oder Alpha", async () => {
    const a = await firmaA();
    const vera = (await kontoIds(a.app, a.k.carla)).get("Vera Viewer") ?? "";
    // Ohne Recht: leer, obwohl W1 (Werkstatt), P1 (Alpha) und P2 (Beta) passen.
    expect(await hinweise(a, a.k.vera, WORT)).toEqual(LEER);
    // Recht NUR an Beta.
    await pflege(a, a.spaces.beta, betaEingabe(a, 1, { existenz: [vera] }));
    expect(JSON.parse((await hinweise(a, a.k.vera, WORT)).body)).toEqual({
      hinweise: [{ spaceId: a.spaces.beta, spaceName: "Partner Beta" }],
    });
    // Das Recht anderer bleibt leer: Ada (Admin, kein Mitglied) und Lea haben es nicht.
    expect(await hinweise(a, a.k.ada, WORT)).toEqual(LEER);
    expect(await hinweise(a, a.k.lea, WORT)).toEqual(LEER);
    // Eine ungültige Anfrage wird für jedes Konto gleich abgewiesen — vor jedem Lesen.
    const kurzVera = await hinweise(a, a.k.vera, "ab");
    const kurzLea = await hinweise(a, a.k.lea, "ab");
    expect(kurzVera.status).toBe(400);
    expect(kurzLea).toEqual(kurzVera);
    // Ohne Anmeldung entscheidet die Anmeldung.
    const anonym = await a.app.inject({
      method: "GET",
      url: `/api/library/existenzhinweise?q=${WORT}`,
    });
    expect(anonym.statusCode).toBe(401);
  });

  it("die Stufe bleibt wirksam, und wer lesen darf, bekommt keinen Hinweis", async () => {
    const a = await firmaA();
    await pflege(a, a.spaces.beta, betaEingabe(a, 1, { existenz: [a.ids.lea, a.ids.erik] }));
    expect(JSON.parse((await hinweise(a, a.k.lea, WORT)).body).hinweise).toHaveLength(1);
    // P2 wird vertraulich: auch ein Mitglied mit Lea's Rolle sähe es nicht — kein Hinweis mehr.
    const hoch = await a.app.inject({
      method: "PUT",
      url: `/api/kos/${a.ko.P2}`,
      headers: a.k.carla,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(hoch.statusCode, hoch.body).toBe(200);
    expect(await hinweise(a, a.k.lea, WORT)).toEqual(LEER);
    // Erik (Autor von P2) dürfte es als Mitglied sehen — er bekommt den Hinweis weiterhin.
    expect(JSON.parse((await hinweise(a, a.k.erik, WORT)).body).hinweise).toEqual([
      { spaceId: a.spaces.beta, spaceName: "Partner Beta" },
    ]);
    // Ein Existenzrecht an Alpha, das Erik ohnehin liest, ergibt keinen zweiten Weg.
    await pflege(a, a.spaces.alpha, {
      ...a.alphaEingabe,
      version: 1,
      existenz: [a.ids.erik],
    });
    expect(JSON.parse((await hinweise(a, a.k.erik, WORT)).body).hinweise).toEqual([
      { spaceId: a.spaces.beta, spaceName: "Partner Beta" },
    ]);
  });

  it("Widerruf: eine Pflege ohne Feld lässt das Recht stehen, eine leere Liste nimmt es sofort", async () => {
    const a = await firmaA();
    await pflege(a, a.spaces.beta, betaEingabe(a, 1, { existenz: [a.ids.lea] }));
    expect(JSON.parse((await hinweise(a, a.k.lea, WORT)).body).hinweise).toHaveLength(1);
    // Pflege des Zwecks, ohne `existenz` zu nennen: das Recht bleibt.
    const zweck = await pflege(a, a.spaces.beta, {
      ...betaEingabe(a, 2),
      zweck: "Austausch mit der Beta AG (neu gefasst).",
    });
    expect(zweck.json().existenz).toEqual([a.ids.lea]);
    expect(JSON.parse((await hinweise(a, a.k.lea, WORT)).body).hinweise).toHaveLength(1);
    // WIDERRUF: mit der nächsten Anfrage wieder die allgemeine leere Antwort.
    const entzug = await pflege(a, a.spaces.beta, betaEingabe(a, 3, { existenz: [] }));
    expect(entzug.json().existenz).toBeUndefined();
    expect(await hinweise(a, a.k.lea, WORT)).toEqual(LEER);
    // Ein Konto, das es nicht gibt, kann kein Existenzrecht erhalten.
    const fremd = await a.app.inject({
      method: "PUT",
      url: `/api/spaces/${a.spaces.beta}`,
      headers: a.k.carla,
      payload: betaEingabe(a, 4, { existenz: ["00000000-0000-4000-8000-00000000dead"] }),
    });
    expect(fremd.statusCode).toBe(400);
  });
});

// ================================================================================================
// B-07 Prüfnachtrag · Bens Befund 4 (Nacharbeit 5) — ERFOLGREICHE FUNDSTELLENAUFLÖSUNG.
//
// Der alte 400er war kein Funktionsnachweis. Hier legt der Test GÜLTIGE Verweise vor — Objekt,
// Fassung, Feld, Bereich und Fingerabdruck aus der synthetischen Quellfassung berechnet — und misst
// die Auflösung über `POST /api/ask/fundstellen` mit den aktuellen Rechten.
// ================================================================================================
describe("K3/K4/K6 · Fundstellen lösen mit aktuellen Rechten auf — positiv und negativ", () => {
  const verweis = async (a: FirmaA, koId: string) => {
    const ko = (await a.services.ko.get(koId)) as KnowledgeObject;
    const start = ko.statement.indexOf(WORT);
    expect(start, koId).toBeGreaterThanOrEqual(0);
    const ende = start + WORT.length;
    return {
      art: "intern",
      koId,
      koVersion: ko.version,
      feld: "statement",
      start,
      ende,
      fingerabdruck: fingerabdruck(ko.statement.slice(start, ende)),
    };
  };
  const loese = async (app: App, kopf: Kopf, verweise: unknown[]) => {
    const res = await app.inject({
      method: "POST",
      url: "/api/ask/fundstellen",
      headers: kopf,
      payload: { fundstellen: verweise },
    });
    expect(res.statusCode, res.body).toBe(200);
    return res.json().fundstellen as Record<string, unknown>[];
  };
  const ohneKennung = (r: Record<string, unknown> | undefined) => ({ ...r, koId: "—" });

  it("sichtbar: eigener und Partnereintrag lösen auf — Auszug, Fassung, Autor, Link", async () => {
    const a = await firmaA();
    const [e1, p1] = await loese(a.app, a.k.lea, [
      await verweis(a, a.ko.E1),
      await verweis(a, a.ko.P1),
    ]);
    for (const [r, id] of [
      [e1, a.ko.E1],
      [p1, a.ko.P1],
    ] as const) {
      expect(r).toMatchObject({
        zustand: "aktuell",
        koId: id,
        auszug: WORT,
        link: `/wissen/${id}`,
      });
      expect(r?.koVersion).toBe(((await a.services.ko.get(id)) as KnowledgeObject).version);
    }
    // Eine neue Fassung: der damals verwendete Stand bleibt unterscheidbar („geaendert").
    const alt = await verweis(a, a.ko.E1);
    await a.services.ko.revise(a.ko.E1, { statement: "Ganz neu formuliert." }, a.ids.erik);
    const [geaendert] = await loese(a.app, a.k.lea, [alt]);
    expect(geaendert).toMatchObject({
      zustand: "geaendert",
      gebunden: { version: alt.koVersion, auszug: WORT },
      aktuell: { passageUnveraendert: false },
    });
  });

  it("negativ: verfälschter Fingerabdruck, unsichtbarer Bereich, unbekannte Kennung, Widerruf, zweite Firma", async () => {
    const a = await firmaA();
    const e1 = await verweis(a, a.ko.E1);
    const [verfaelscht] = await loese(a.app, a.k.lea, [
      { ...e1, fingerabdruck: fingerabdruck("etwas anderes") },
    ]);
    expect(verfaelscht).toMatchObject({ zustand: "beschaedigt", koId: a.ko.E1 });
    expect(verfaelscht).not.toHaveProperty("auszug");

    // P2 (Beta) mit KORREKTEM Fingerabdruck: für Lea wie eine Kennung, die es nicht gibt.
    const p2 = await verweis(a, a.ko.P2);
    const unbekannt = { ...p2, koId: "00000000-0000-4000-8000-0000000000f5" };
    const [fremd, nichtDa] = await loese(a.app, a.k.lea, [p2, unbekannt]);
    expect(fremd).toMatchObject({ zustand: "nicht_zugaenglich", koId: a.ko.P2 });
    expect(ohneKennung(fremd)).toEqual(ohneKennung(nichtDa));
    expect(JSON.stringify(fremd)).not.toContain("PartnerBeta");
    // Gegenprobe: Carla (zuständig für Beta) löst denselben Verweis auf.
    const [carla] = await loese(a.app, a.k.carla, [p2]);
    expect(carla).toMatchObject({ zustand: "aktuell", auszug: WORT });

    // WIDERRUF: nach dem Entzug der Alpha-Mitgliedschaft ist P1 für Lea nicht mehr zugänglich.
    const p1 = await verweis(a, a.ko.P1);
    expect((await loese(a.app, a.k.lea, [p1]))[0]).toMatchObject({ zustand: "aktuell" });
    const entzug = await a.app.inject({
      method: "PUT",
      url: `/api/spaces/${a.spaces.alpha}`,
      headers: a.k.carla,
      payload: {
        ...a.alphaEingabe,
        version: 1,
        mitglieder: [{ nutzer: a.ids.erik, recht: "schreiben" }],
      },
    });
    expect(entzug.statusCode, entzug.body).toBe(200);
    const [nachEntzug] = await loese(a.app, a.k.lea, [p1]);
    expect(ohneKennung(nachEntzug)).toEqual(ohneKennung(nichtDa));

    // ZWEITE FIRMA: Firma B kennt Firma A's Kennung nicht — dieselbe Antwort wie „gibt es nicht".
    const b = await firmaB();
    const [fremdeFirma] = await loese(b.app, b.bodo, [e1]);
    expect(ohneKennung(fremdeFirma)).toEqual(ohneKennung(nichtDa));
  });
});

// ================================================================================================
// Bens Befund (Nacharbeit 8, AC01) — EINE EINORDNUNG ÜBER BEIDE PRODUKTWEGE.
//
// Dieselben synthetischen Objekte, alle Kombinationen aus Spacekontext (ohne, firma, partner,
// oeffentlich, Altfassung nur mit Partnernamen) × Öffentlich-Marke × Stufe. Gemessen wird für drei
// Rollen über den Space-Artikelfilter (`/api/spaces/artikel?kontext=…`) UND den Firmenfilter
// (Liste, Suche, Export): dieselbe Menge, derselbe Bereich (`eigen` heisst im Spaceweg `firma`), und
// beide nur innerhalb der Lesemenge. Die SQL/In-Memory-Gleichheit derselben Regel misst
// `firmenfilter-pg.integration.test.ts` mit einem öffentlichen Space im Kreuzbestand.
// ================================================================================================
describe("K1/K2/K5 · Firmenfilter und Space-Artikelfilter ordnen dieselben Objekte gleich ein", () => {
  it("Spacekontext × Objektmarke × Stufe × Rolle: beide Wege, dieselbe Menge und derselbe Bereich", async () => {
    const services = buildServices();
    const app = buildApp(services);
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Ada Admin", email: "ada@ac01.test", password: KENNWORT },
    });
    const ada = await anmelden(app, "ada@ac01.test");
    await konto(app, ada, "Carla Controller", "carla@ac01.test", "controller");
    await konto(app, ada, "Erik Experte", "erik@ac01.test", "experte");
    await konto(app, ada, "Vera Viewer", "vera@ac01.test", "viewer");
    const k = {
      carla: await anmelden(app, "carla@ac01.test"),
      erik: await anmelden(app, "erik@ac01.test"),
      vera: await anmelden(app, "vera@ac01.test"),
    };
    const n = await kontoIds(app, k.carla);
    const carla = n.get("Carla Controller") ?? "";
    const erik = n.get("Erik Experte") ?? "";
    const grund = { verantwortlich: carla, ansichten: [] };
    const mitErik = [{ nutzer: erik, recht: "schreiben" }];
    const werkstatt = await space(app, k.carla, {
      ...grund,
      name: "Werkstatt",
      zweck: "Eigene Anweisungen.",
      zugang: "mitglieder",
      mitglieder: mitErik,
      kontext: "firma",
    });
    const alpha = await space(app, k.carla, {
      ...grund,
      name: "Partner Alpha",
      zweck: "Austausch mit der Alpha GmbH.",
      zugang: "mitglieder",
      mitglieder: mitErik,
      kontext: "partner",
      partner: "Alpha GmbH",
    });
    const normen = await space(app, k.carla, {
      ...grund,
      name: "Normen",
      zweck: "Öffentliche Quellen.",
      zugang: "alle",
      mitglieder: [],
      kontext: "oeffentlich",
    });
    // Altfassung aus einem P14-Kandidaten vor der Zusammenführung: Partnername ohne `kontext`.
    const altPartner = "s-alt-gamma";
    const am = "2026-10-11T08:00:00.000Z";
    await services.spaces.lege({
      id: altPartner,
      version: 1,
      name: "Partner Gamma (alt)",
      zweck: "Vor der Zusammenführung angelegt.",
      verantwortlich: carla,
      zugang: "mitglieder",
      mitglieder: [{ nutzer: erik, recht: "lesen" }],
      ansichten: [],
      partner: "Gamma KG",
      angelegtVon: carla,
      angelegtAm: am,
      geaendertVon: carla,
      geaendertAm: am,
    });

    const lege = async (
      titel: string,
      spaceId: string | null,
      oeffentlich: boolean,
      vertraulich = false,
    ) => {
      const id = await eintrag(app, k.erik, titel);
      if (oeffentlich) {
        const res = await app.inject({
          method: "PUT",
          url: `/api/kos/${id}`,
          headers: k.carla,
          payload: { action: "schutz-oeffentlich", oeffentlich: true },
        });
        expect(res.statusCode, res.body).toBe(200);
      }
      if (vertraulich) {
        const res = await app.inject({
          method: "PUT",
          url: `/api/kos/${id}`,
          headers: k.erik,
          payload: { action: "confidentiality", level: "vertraulich" },
        });
        expect(res.statusCode, res.body).toBe(200);
      }
      if (spaceId) {
        await services.ko.setLeadingSpace(id, spaceId, carla, null);
      }
      await services.ko.setValidationState(id, { trust: 90, status: "validiert" });
      return id;
    };
    // Erwarteter Bereich (Firmenfilter-Namen) — abgeleitet aus Spacekontext, Marke und Stufe.
    const faelle = {
      OhneSpace: { id: await lege("OhneSpace", null, false), soll: "eigen" },
      OhneSpaceMarke: { id: await lege("OhneSpaceMarke", null, true), soll: "oeffentlich" },
      Werkstatt: { id: await lege("Werkstatt", werkstatt, false), soll: "eigen" },
      WerkstattMarke: { id: await lege("WerkstattMarke", werkstatt, true), soll: "oeffentlich" },
      Normen: { id: await lege("Normen", normen, false), soll: "oeffentlich" },
      NormenMarke: { id: await lege("NormenMarke", normen, true), soll: "oeffentlich" },
      NormenVertraulich: { id: await lege("NormenVertr", normen, false, true), soll: "eigen" },
      Alpha: { id: await lege("Alpha", alpha, false), soll: "partner" },
      AlphaMarke: { id: await lege("AlphaMarke", alpha, true), soll: "partner" },
      AltPartner: { id: await lege("AltPartner", altPartner, false), soll: "partner" },
    };
    const name = (id: string) => Object.entries(faelle).find(([, f]) => f.id === id)?.[0];
    // Wer was LESEN darf — unabhängig von jedem Filter.
    const lesbar: Record<keyof typeof k, (keyof typeof faelle)[]> = {
      carla: Object.keys(faelle) as (keyof typeof faelle)[],
      erik: Object.keys(faelle) as (keyof typeof faelle)[],
      vera: ["OhneSpace", "OhneSpaceMarke", "Normen", "NormenMarke"],
    };

    const spaceweg = async (kopf: Kopf) => {
      const aus: Record<string, string> = {};
      for (const kontext of ["firma", "partner", "oeffentlich"]) {
        const res = await lies(app, kopf, `/api/spaces/artikel?kontext=${kontext}`);
        expect(res.statusCode, res.body).toBe(200);
        for (const z of res.json().artikel as { id: string; kontext: string }[]) {
          expect(z.kontext, z.id).toBe(kontext);
          const fall = name(z.id);
          if (fall) {
            aus[fall] = kontext === "firma" ? "eigen" : kontext;
          }
        }
      }
      return aus;
    };
    const firmenweg = async (kopf: Kopf, weg: "liste" | "suche" | "export") => {
      const aus: Record<string, string> = {};
      for (const bereich of ["eigen", "partner", "oeffentlich"]) {
        const url =
          weg === "liste"
            ? `/api/kos?firmenbereich=${bereich}`
            : weg === "suche"
              ? `/api/library/search?q=${WORT}&firmenbereich=${bereich}`
              : `/api/library/export?firmenbereich=${bereich}`;
        const res = await lies(app, kopf, url);
        expect(res.statusCode, res.body).toBe(200);
        for (const [fall, f] of Object.entries(faelle)) {
          if (res.body.includes(f.id)) {
            expect(aus[fall], `${fall} in zwei Bereichen (${weg})`).toBeUndefined();
            aus[fall] = bereich;
          }
        }
      }
      return aus;
    };

    for (const rolle of Object.keys(k) as (keyof typeof k)[]) {
      const soll = Object.fromEntries(lesbar[rolle].map((fall) => [fall, faelle[fall].soll]));
      expect(await spaceweg(k[rolle]), `${rolle} · Spaceweg`).toEqual(soll);
      for (const weg of ["liste", "suche"] as const) {
        expect(await firmenweg(k[rolle], weg), `${rolle} · Firmenfilter ${weg}`).toEqual(soll);
      }
      // Der Export gibt Vertrauliches nur an `ko.validate` (SCRUM-506) — auch nicht an den Autor.
      const { NormenVertraulich: _vertraulich, ...ohneVertraulich } = soll;
      const sollExport = rolle === "carla" ? soll : ohneVertraulich;
      expect(await firmenweg(k[rolle], "export"), `${rolle} · Firmenfilter export`).toEqual(
        sollExport,
      );
    }
    // Die gefilterte Liste nennt den Bereich an jedem Treffer — derselbe wie im Spaceweg.
    const normenListe = await lies(app, k.vera, "/api/kos?firmenbereich=oeffentlich");
    expect(normenListe.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: faelle.Normen.id, firmenbereich: "oeffentlich" }),
      ]),
    );
  });
});

describe("K7 · ein Kontextwechsel lässt keine unberechtigten alten Ergebnisse stehen", () => {
  it("Wechsel der Person, des Bereichs und des Space — jede Antwort gehört zum neuen Kontext", async () => {
    const a = await firmaA();
    // Person: Lea, dann Vera mit derselben Anfrage an dieselbe Anlage.
    expect(await suche(a, a.k.lea, "firmenbereich=partner")).toEqual(["P1"]);
    expect(await suche(a, a.k.vera, "firmenbereich=partner")).toEqual([]);
    // Bereich: Partner, dann eigen.
    expect(await liste(a, a.k.lea, "firmenbereich=partner")).toEqual(["P1"]);
    expect(await liste(a, a.k.lea, "firmenbereich=eigen")).toEqual(["E1", "W1"]);
    // Space: P1 wandert von Alpha nach Beta — für Lea weg, auch unter der alten Kennung.
    await a.services.ko.setLeadingSpace(a.ko.P1, a.spaces.beta, a.ids.carla, a.spaces.alpha);
    expect(await liste(a, a.k.lea, `partner=${a.spaces.alpha}`)).toEqual([]);
    expect(await suche(a, a.k.lea, "firmenbereich=partner")).toEqual([]);
    expect(await liste(a, a.k.carla, `partner=${a.spaces.beta}`)).toEqual(["P1", "P2"]);
  });

  it("nach der Abmeldung liefert die alte Sitzung nichts mehr — gefiltert wie ungefiltert", async () => {
    const a = await firmaA();
    expect(await liste(a, a.k.lea, "firmenbereich=partner")).toEqual(["P1"]);
    const ab = await a.app.inject({ method: "POST", url: "/api/auth/logout", headers: a.k.lea });
    expect(ab.statusCode).toBe(204);
    for (const url of ["/api/kos?firmenbereich=partner", "/api/kos", "/api/library/export"]) {
      const res = await lies(a.app, a.k.lea, url);
      expect(res.statusCode, url).toBe(401);
      expect(res.body).not.toContain(a.ko.P1);
    }
  });
});

describe("K8 · zwei Firmen und mehrere Rollen — positive und negative Fälle", () => {
  it("Firma A: fünf Rollen × drei Bereiche entsprechen genau der erwarteten Tafel", async () => {
    const a = await firmaA();
    for (const rolle of ROLLEN) {
      const sicht = (abfrage: string) => liste(a, a.k[rolle], abfrage);
      const soll = ERWARTET[rolle];
      expect(await sicht("firmenbereich=eigen"), `${rolle} eigen`).toEqual(soll.eigen);
      expect(await sicht("firmenbereich=partner"), `${rolle} partner`).toEqual(soll.partner);
      expect(await sicht("firmenbereich=oeffentlich"), `${rolle} öffentlich`).toEqual(
        soll.oeffentlich,
      );
    }
    // Positive Fälle sind nicht leer — sonst bewiese die Tafel nichts.
    expect(ROLLEN.every((r) => ERWARTET[r].eigen.length > 0)).toBe(true);
    expect(ROLLEN.filter((r) => ERWARTET[r].partner.length > 0)).toEqual(["carla", "lea", "erik"]);
  });

  it("Firma B sieht nur ihren eigenen Bestand — in jedem Bereich", async () => {
    const a = await firmaA();
    const b = await firmaB();
    const eigen = await lies(b.app, b.bodo, "/api/kos?firmenbereich=eigen");
    expect(eigen.statusCode, eigen.body).toBe(200);
    expect(kennungen(eigen.body)).toContain(b.eigen);
    expect(genannt(a, eigen.body)).toEqual([]);
    for (const abfrage of ["firmenbereich=partner", "firmenbereich=oeffentlich", ALLE]) {
      const res = await lies(b.app, b.bodo, `/api/kos?${abfrage}`);
      expect(res.statusCode, abfrage).toBe(200);
      expect(genannt(a, res.body), abfrage).toEqual([]);
    }
    const url = `/api/library/search?q=${WORT}&firmenbereich=eigen`;
    const treffer = await lies(b.app, b.bodo, url);
    expect(genannt(a, treffer.body)).toEqual([]);
    expect(treffer.body).toContain(b.eigen);
    // Gegenprobe in Firma A: das Wissen der Firma B taucht in keinem Bereich auf.
    const inA = await lies(a.app, a.k.carla, `/api/kos?${ALLE}`);
    expect(inA.body).not.toContain(b.eigen);
  });
});
