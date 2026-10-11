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
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Kopf = { authorization: string };

const KENNWORT = "geheim12345";
// Das Wort steht in JEDEM Testeintrag — so trifft die Suche jeden, und nur der Filter grenzt ein.
const WORT = "Messkettenabgleich";
const ALLE = "firmenbereich=eigen,partner,oeffentlich";

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

/** Firma A mit vollständigem Bestand. Vorbereitung über HTTP; Space/Prüfstand über den Dienst. */
async function firmaA() {
  const services = buildServices();
  const app = buildApp(services);
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
  return { app, services, k, ids, ko, spaces: { alpha, beta, werkstatt }, alphaEingabe };
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
    zugang: "alle",
    mitglieder: [],
    ansichten: [],
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
      payload: { ...a.alphaEingabe, version: 1, partner: null },
    });
    expect(aufheben.statusCode, aufheben.body).toBe(200);
    expect(aufheben.json().partner).toBeUndefined();
    expect(await liste(a, a.k.erik, "firmenbereich=partner")).toEqual([]);
    expect(await liste(a, a.k.erik, "firmenbereich=eigen")).toEqual(["E1", "E2", "P1"]);
  });

  it("eine für Lea unsichtbare Änderung ändert ihre gefilterten Antworten nicht", async () => {
    const a = await firmaA();
    const sicht = async () => {
      const liste_ = await lies(a.app, a.k.lea, `/api/kos?${ALLE}`);
      const suche_ = await lies(a.app, a.k.lea, `/api/library/search?q=${WORT}&${ALLE}`);
      const ausfuhr_ = await lies(a.app, a.k.lea, `/api/library/export?${ALLE}`);
      return {
        liste: kennungen(liste_.body),
        suche: kennungen(suche_.body),
        ausfuhr: kennungen(ausfuhr_.body),
      };
    };
    const vorher = await sicht();
    // KALIBRIERUNG: die Sicht ist nicht leer — sonst bewiese die Gleichheit nichts.
    expect(vorher.liste.length).toBeGreaterThan(0);
    // Für Lea unsichtbar: ein neuer Eintrag im Beta-Bereich und eine Höherstufung von P2.
    const neu = await eintrag(a.app, a.k.erik, "NochEinBeta");
    await a.services.ko.setLeadingSpace(neu, a.spaces.beta, a.ids.carla, null);
    await a.services.ko.setValidationState(neu, { trust: 90, status: "validiert" });
    const hoch = await a.app.inject({
      method: "PUT",
      url: `/api/kos/${a.ko.P2}`,
      headers: a.k.carla,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(hoch.statusCode, hoch.body).toBe(200);
    expect(await sicht()).toEqual(vorher);
    // Gegenprobe: für Carla ist die Änderung sichtbar.
    const carla = await lies(a.app, a.k.carla, "/api/kos?firmenbereich=partner");
    expect(kennungen(carla.body)).toContain(neu);
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
