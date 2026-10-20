// ================================================================================================
// produkt:20261011:peter-p06:beschaffungsroutine · BES-07 — MEINE FUNKTIONEN AM ECHTEN SERVER.
// ================================================================================================
//
// Gemessen über die ECHTE Anwendung (`buildApp(assembleServices(inMemoryRepos()))`, `app.inject`).
// Jeder Schritt der Funktion geht über HTTP; nur die Vorbereitung der Quelle (neue Fassung,
// Einstufung als vertraulich) läuft über den vorhandenen Wissensdienst. Rollen: Ada (Verwaltung,
// legt die Quelle an), Erik (Experte, Eigentümer der Funktion), Vera (Leserin, fremdes Konto).
// Alle Inhalte fiktiv; kein Postfach, kein Lieferant, kein Modell.
//
//   S13 · BES-07-K01..K04  „So wie eben speichern; für anderes Produkt/Menge manuell aufrufen."
//   S14 · BES-07-K05..K08  Serie ab Datum, Pause über Neuladen, neue Quellfassung, Rechteentzug.
import { beforeEach, describe, expect, it } from "vitest";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import {
  FUNKTION_GEAENDERT,
  FUNKTION_GESPEICHERT,
  FUNKTION_LAUF_VORBEREITET,
  FUNKTION_ZEITAUFTRAG_GESETZT,
} from "../../services/app/src/routes/persoenliche-funktionen-routes";

type App = ReturnType<typeof buildApp>;

let services: AppServices;
let app: App;
let admin = { id: "", token: "" };
let erik = { id: "", token: "" };
let vera = { id: "", token: "" };

const URL = "/api/me/funktionen";
const QUELLTITEL = "Verpackungsspezifikation Faltschachtel FS-12 (fiktiv)";
const SATZ = "So möchte ich künftig Angebote für eine Verpackung einholen.";
const SATZ_MIT_WERTEN =
  "So möchte ich künftig Angebote für Faltschachteln einholen – diesmal 500 Stück bis 30.11.2026, Ansprechpartner einkauf@lieferant.example.";

interface Lauf {
  id: string;
  fassung: number;
  parameterwerte: Record<string, string>;
  rechte: { rolle: string };
  quellen: Array<{ koId: string; zustand: string; fassung: number | null }>;
  stand: string;
  klaerung: Array<{ art: string; koId: string | null; hinweis: string }>;
  offen: string[];
  aussenwirkung: string;
}

interface Funktion {
  id: string;
  art: string;
  stand: string;
  rev: number;
  aktuell: { version: number; name: string; quellen: string[]; ausgangstext: string };
  fassungen: Array<{ version: number; name: string }>;
  zeitauftrag: { ausfuehrung: string; zeitzone: string } | null;
  vorschau: Array<{ datum: string; zeitpunkt: string; hinweis: string | null }>;
  laeufe: Lauf[];
  ausfuehrbar: boolean;
  offeneFaehigkeiten: Array<{ id: string; grund: string }>;
  zeitauftragFaehigkeit: { id: string; erfuellt: boolean };
}

async function anmelden(email: string): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode).toBe(200);
  return (login.json() as { token: string }).token;
}

async function konto(rolle: string, email: string, name: string) {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${admin.token}` },
    payload: { name, email, password: "secret123", role: rolle },
  });
  expect(angelegt.statusCode).toBe(201);
  return { id: (angelegt.json() as { id: string }).id, token: await anmelden(email) };
}

type Methode = "GET" | "POST" | "PUT" | "DELETE";

const auf = (wer: string, methode: Methode, url: string, payload?: unknown) =>
  app.inject({
    method: methode,
    url,
    headers: wer ? { authorization: `Bearer ${wer}` } : {},
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });

const versuche = (wer: string, id: string, eingabe: unknown) =>
  auf(wer, "POST", `${URL}/${id}/laeufe`, eingabe);

const aendere = (wer: string, id: string, eingabe: Record<string, unknown>) =>
  auf(wer, "PUT", `${URL}/${id}`, eingabe);

const fall = (produkt: string, menge: string, termin = "2026-11-30") => ({
  parameter: { produkt, menge, termin },
});

async function quelle(): Promise<string> {
  const angelegt = await auf(admin.token, "POST", "/api/kos", {
    confidentiality: "intern",
    title: QUELLTITEL,
    statement: "Faltschachteln FS-12 werden aus 400 g/m² Karton mit Recyclinganteil gefertigt.",
    type: "best_practice",
    category: "Beschaffung Beispiel",
  });
  expect(angelegt.statusCode).toBe(201);
  return (angelegt.json() as { id: string }).id;
}

async function speichere(wer: string, eingabe: Record<string, unknown>): Promise<Funktion> {
  const antwort = await auf(wer, "POST", URL, eingabe);
  expect(antwort.statusCode, antwort.body).toBe(201);
  return (antwort.json() as { funktion: Funktion }).funktion;
}

async function lies(wer: string, id: string): Promise<Funktion> {
  const antwort = await auf(wer, "GET", `${URL}/${id}`);
  expect(antwort.statusCode, antwort.body).toBe(200);
  return (antwort.json() as { funktion: Funktion }).funktion;
}

async function laufe(wer: string, id: string, eingabe: unknown): Promise<Lauf> {
  const antwort = await versuche(wer, id, eingabe);
  expect(antwort.statusCode, antwort.body).toBe(201);
  return (antwort.json() as { lauf: Lauf }).lauf;
}

beforeEach(async () => {
  services = assembleServices(inMemoryRepos());
  app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@funktionen.test", password: "secret123" },
  });
  admin = {
    id: (await services.auth.listUsers())[0]?.id ?? "",
    token: await anmelden("ada@funktionen.test"),
  };
  erik = await konto("experte", "erik@funktionen.test", "Erik Experte");
  vera = await konto("viewer", "vera@funktionen.test", "Vera Viewer");
});

describe("BES-S13 · persönliche Funktion speichern und für einen anderen Fall aufrufen", () => {
  it("K01/K02 · aus einem gesprochenen Satz ein Entwurf — Beispielwerte zurückgemeldet, nichts gespeichert", async () => {
    const antwort = await auf(erik.token, "POST", `${URL}/entwurf`, {
      text: SATZ_MIT_WERTEN,
      eingabeweg: "sprache",
    });
    expect(antwort.statusCode, antwort.body).toBe(200);
    const { entwurf } = antwort.json() as {
      entwurf: { name: string; eingabeweg: string; beispielwerte: Array<{ wert: string }> };
    };
    expect(entwurf.name).toBe("Angebote für Faltschachteln einholen");
    expect(entwurf.eingabeweg).toBe("sprache");
    expect(entwurf.beispielwerte.map((b) => b.wert)).toEqual(
      expect.arrayContaining(["500 Stück", "bis 30.11.2026", "einkauf@lieferant.example"]),
    );
    // Der Entwurf ist nur ein Blick: keine Funktion, kein Protokolleintrag.
    expect((await auf(erik.token, "GET", URL)).json()).toEqual({ funktionen: [] });
    expect(await services.audit.list({ action: FUNKTION_GESPEICHERT })).toEqual([]);
  });

  it("K02/K03/K04 · Speichern legt den Vertrag an — ohne Testwerte, ohne Lauf, ohne Serie, ohne Außenrecht", async () => {
    const koId = await quelle();
    const antwort = await auf(erik.token, "POST", URL, {
      text: SATZ_MIT_WERTEN,
      eingabeweg: "sprache",
      quellen: [koId],
    });
    expect(antwort.statusCode, antwort.body).toBe(201);
    const { funktion } = antwort.json() as { funktion: Funktion };
    expect(funktion).toMatchObject({
      art: "favorit",
      stand: "aktiv",
      laeufe: [],
      zeitauftrag: null,
      ausfuehrbar: false,
    });
    expect(funktion.aktuell).toMatchObject({ version: 1, quellen: [koId] });

    const gelesen = await auf(erik.token, "GET", URL);
    for (const wert of ["500", "30.11.2026", "einkauf@lieferant.example", QUELLTITEL]) {
      expect(gelesen.body, wert).not.toContain(wert);
    }
    const gespeichert = await services.audit.list({ action: FUNKTION_GESPEICHERT });
    expect(gespeichert).toHaveLength(1);
    expect(gespeichert[0]?.actor).toBe(erik.id);
    expect(JSON.stringify(gespeichert)).not.toContain("Faltschachteln");
    expect(await services.audit.list({ action: FUNKTION_LAUF_VORBEREITET })).toEqual([]);
  });

  it("K03 · eine unbekannte und eine verborgene Quelle antworten gleich — gespeichert wird nichts", async () => {
    const koId = await quelle();
    await services.ko.setConfidentiality(koId, "vertraulich", admin.id);
    const verborgen = await auf(erik.token, "POST", URL, { text: SATZ, quellen: [koId] });
    const unbekannt = await auf(erik.token, "POST", URL, { text: SATZ, quellen: ["ko-fehlt"] });
    expect(verborgen.statusCode).toBe(404);
    expect(unbekannt.statusCode).toBe(404);
    expect(verborgen.json()).toMatchObject({ grund: "quelle_unbekannt" });
    expect(verborgen.body).not.toContain(QUELLTITEL);
    expect((await auf(erik.token, "GET", URL)).json()).toEqual({ funktionen: [] });
  });

  it("K01 · ein Satz ohne Beschaffungsablauf wird abgelehnt", async () => {
    const text = "Bitte erinnere mich ans Mittagessen.";
    const antwort = await auf(erik.token, "POST", URL, { text });
    expect(antwort.statusCode).toBe(400);
    expect(antwort.json()).toMatchObject({ grund: "nicht_erkannt" });
  });

  it("K04 · ein Vorschlag ist erst nach Übernahme aufrufbar", async () => {
    const f = await speichere(erik.token, { text: SATZ, art: "vorschlag" });
    expect(f.stand).toBe("vorschlag");
    const versuch = await versuche(erik.token, f.id, fall("Karton A", "1 Palette"));
    expect(versuch.statusCode).toBe(409);
    const uebernommen = await aendere(erik.token, f.id, { rev: f.rev, stand: "aktiv" });
    expect(uebernommen.statusCode).toBe(200);
    const lauf = await laufe(erik.token, f.id, fall("Karton A", "1 Palette"));
    // Nacharbeit 3: ohne Quelle ist der übernommene Vorschlag aufrufbar, hält aber gezielt an.
    expect(lauf.stand).toBe("klaerung_noetig");
    expect(lauf.klaerung.map((k) => k.art)).toEqual(["keine_quelle"]);
  });
});

describe("BES-S14 · neuer Fall, neue Quellfassung, Rechteentzug, Pause und Serie", () => {
  it("K05/K07 · jeder Fall liest die Quelle und die Rolle von jetzt; alte Fälle bleiben unterscheidbar", async () => {
    const koId = await quelle();
    const f = await speichere(erik.token, { text: SATZ, quellen: [koId] });

    const erster = await laufe(erik.token, f.id, fall("Faltschachtel FS-12", "500 Stück"));
    expect(erster).toMatchObject({
      fassung: 1,
      rechte: { rolle: "experte" },
      quellen: [{ koId, zustand: "gelesen", fassung: 1 }],
      stand: "wartet_auf_faehigkeit",
      offen: ["BES-02", "BES-06", "postfach"],
      aussenwirkung: "keine",
    });

    // Die Quelle bekommt eine neue Fassung: der nächste Fall liest sie, nicht die alte.
    const neu = await services.ko.revise(koId, { statement: "FS-12 mit 450 g/m²." }, admin.id);
    expect(neu.version).toBe(2);
    const zweiter = await laufe(erik.token, f.id, fall("Versandkarton VK-3", "40 Paletten"));
    expect(zweiter.quellen).toEqual([{ koId, zustand: "gelesen", fassung: 2, status: neu.status }]);

    // Recht entzogen: der dritte Fall sieht die Quelle nicht mehr — und erfährt nichts aus ihr.
    await services.ko.setConfidentiality(koId, "vertraulich", admin.id);
    const antwort = await versuche(erik.token, f.id, fall("Etikett E1", "2000 Stück"));
    expect(antwort.statusCode, antwort.body).toBe(201);
    expect(antwort.body).not.toContain(QUELLTITEL);
    const dritter = (antwort.json() as { lauf: Lauf }).lauf;
    expect(dritter.quellen).toEqual([
      { koId, zustand: "nicht_zugaenglich", fassung: null, status: null },
    ]);
    // Nacharbeit 3: der Entzug ist gezielter Handlungsbedarf, nicht nur eine Zahl.
    expect(dritter.stand).toBe("klaerung_noetig");
    expect(dritter.klaerung.map((k) => [k.art, k.koId])).toEqual([
      ["quelle_nicht_zugaenglich", koId],
    ]);

    const stand = await lies(erik.token, f.id);
    expect(stand.laeufe.map((l) => [l.parameterwerte.produkt, l.quellen[0]?.fassung])).toEqual([
      ["Etikett E1", null],
      ["Versandkarton VK-3", 2],
      ["Faltschachtel FS-12", 1],
    ]);
    // Kein Parameter eines Falls ist Teil der Funktion geworden.
    expect(JSON.stringify(stand.fassungen)).not.toContain("Faltschachtel FS-12");
    expect(await services.audit.list({ action: FUNKTION_LAUF_VORBEREITET })).toHaveLength(3);
  });

  it("K05 · fehlt eine Pflichtangabe, hält der Fall an und nennt sie", async () => {
    const f = await speichere(erik.token, { text: SATZ });
    const antwort = await versuche(erik.token, f.id, { parameter: { produkt: "Karton A" } });
    expect(antwort.statusCode).toBe(400);
    expect(antwort.json()).toMatchObject({ grund: "angabe_fehlt", fehlend: ["menge", "termin"] });
    expect((await lies(erik.token, f.id)).laeufe).toEqual([]);
  });

  it("K07 · Ändern ergibt eine neue Fassung; Pause gilt nach Neuladen und über einen neuen Server", async () => {
    const f = await speichere(erik.token, { text: SATZ });
    const geaendert = await aendere(erik.token, f.id, { rev: f.rev, name: "Verpackungsangebote" });
    expect(geaendert.statusCode).toBe(200);
    const v2 = (geaendert.json() as { funktion: Funktion }).funktion;
    expect(v2.fassungen.map((v) => v.version)).toEqual([1, 2]);

    const pausiert = await aendere(erik.token, f.id, { rev: v2.rev, stand: "pausiert" });
    expect(pausiert.statusCode).toBe(200);
    // Ein zweiter Server auf demselben Bestand — so sieht Neuladen hier aus.
    app = buildApp(services);
    erik.token = await anmelden("erik@funktionen.test");
    expect((await lies(erik.token, f.id)).stand).toBe("pausiert");
    const versuch = await versuche(erik.token, f.id, fall("Karton A", "10 Stück"));
    expect(versuch.statusCode).toBe(409);
    expect(versuch.json()).toMatchObject({ grund: "nicht_aufrufbar" });

    const veraltet = await aendere(erik.token, f.id, { rev: f.rev, stand: "aktiv" });
    expect(veraltet.statusCode).toBe(409);
    expect(await services.audit.list({ action: FUNKTION_GEAENDERT })).toHaveLength(2);
  });

  it("K06 · Serie ab Datum: ausdrücklich eingerichtet, Zeitzone und Vorschau, ausgelöst wird nichts", async () => {
    const f = await speichere(erik.token, {
      text: "So möchte ich jeden Monat Angebote für eine Verpackung einholen.",
    });
    // Die erwähnte Wiederholung hat nichts eingerichtet.
    expect(f.zeitauftrag).toBeNull();
    const antwort = await auf(erik.token, "PUT", `${URL}/${f.id}/zeitauftrag`, {
      rev: f.rev,
      rhythmus: "woechentlich",
      beginn: "2027-03-21",
      ende: "2027-04-04",
      uhrzeit: "02:30",
      nachholen: "einmal",
    });
    expect(antwort.statusCode, antwort.body).toBe(200);
    const mitSerie = (antwort.json() as { funktion: Funktion }).funktion;
    expect(mitSerie.zeitauftrag).toMatchObject({
      ausfuehrung: "vorbereitung",
      zeitzone: "Europe/Berlin",
    });
    expect(mitSerie.vorschau.map((v) => v.hinweis)).toEqual([null, "sommerzeit_verschoben", null]);
    expect(mitSerie.zeitauftragFaehigkeit).toMatchObject({ id: "zeitauftrag", erfuellt: true });
    expect(mitSerie.laeufe).toEqual([]);
    expect(await services.audit.list({ action: FUNKTION_ZEITAUFTRAG_GESETZT })).toHaveLength(1);
    expect(await services.audit.list({ action: FUNKTION_LAUF_VORBEREITET })).toEqual([]);

    const ohne = `${URL}/${f.id}/zeitauftrag?rev=${mitSerie.rev}`;
    expect((await auf(erik.token, "DELETE", ohne)).statusCode).toBe(200);
    expect((await lies(erik.token, f.id)).zeitauftrag).toBeNull();
  });

  it("K08 · die Funktion ist erreichbar, aber ehrlich nicht ausführbar — mit konkreten Gründen", async () => {
    const f = await speichere(erik.token, { text: SATZ });
    const liste = (await auf(erik.token, "GET", URL)).json() as { funktionen: Funktion[] };
    expect(liste.funktionen.map((x) => x.id)).toEqual([f.id]);
    const [eins] = liste.funktionen;
    expect(eins?.ausfuehrbar).toBe(false);
    expect(eins?.offeneFaehigkeiten.map((x) => x.id)).toEqual(["BES-02", "BES-06", "postfach"]);
    for (const offen of eins?.offeneFaehigkeiten ?? []) {
      expect(offen.grund.length).toBeGreaterThan(10);
    }
  });
});

// ------------------------------------------------------------------------------------------------
// NACHARBEIT 3 (Ben) — „So wie eben speichern" über das ECHTE Assistenzgespräch, Quellenbindung bis
// zum nächsten Aufruf, gelöschte Quelle als gezielter Klärungsbedarf.
// ------------------------------------------------------------------------------------------------
describe("BES-S13 · „So wie eben speichern“ übernimmt den Vorgang aus dem Assistenzgespräch", () => {
  const FRAGE = "Bitte hole Angebote für Faltschachteln FS-12 ein, 500 Stück bis 30.11.2026.";
  const GEHEIMTITEL = "Vertrauliche Preisliste Lieferant X (fiktiv)";

  const ORT = { pfad: "/bibliothek", seitenName: "Bibliothek", objekt: QUELLTITEL };

  /** Eine eigene Nachricht im Gespräch — mit dem Objekt, auf das sie sich bezog. */
  async function sage(id: string, text: string, koId: string, objekt = QUELLTITEL) {
    const r = await auf(erik.token, "POST", `/api/me/klara/gespraeche/${id}/nachrichten`, {
      von: "du",
      modus: "frage",
      text,
      objektbezug: { ...ORT, objekt, koId },
    });
    expect(r.statusCode, r.body).toBe(201);
  }

  /** Ein Gespräch mit EINEM Fall: Frage zur Spezifikation, Nachfrage zur (verborgenen) Preisliste. */
  async function vorgang(spezId: string, geheimId: string): Promise<string> {
    const begonnen = await auf(erik.token, "POST", "/api/me/klara/gespraeche", {
      objektbezug: ORT,
    });
    expect(begonnen.statusCode, begonnen.body).toBe(201);
    const id = (begonnen.json() as { gespraech: { id: string } }).gespraech.id;
    const ja = await auf(erik.token, "PUT", `/api/me/klara/gespraeche/${id}/einwilligung`, {
      erteilt: true,
    });
    expect(ja.statusCode, ja.body).toBe(200);
    await sage(id, FRAGE, spezId);
    await sage(id, "Und die Preisliste dazu?", geheimId, GEHEIMTITEL);
    return id;
  }

  /** Speichern mit der Bindung der Vorschau — so, wie die Oberfläche es tut. */
  function mitBindung(vorschau: Vorschau, text = "So wie eben speichern.") {
    return {
      text,
      vorschauName: vorschau.entwurf.name,
      vorschauAusgangstext: vorschau.entwurf.ausgangstext,
      gespraech: vorschau.bindung.gespraechId,
      gespraechFassung: vorschau.bindung.gespraechFassung,
      abschnitt: vorschau.bindung.abschnitt,
      vorschauQuellen: vorschau.quellen,
    };
  }

  type Vorschau = {
    bindung: Record<string, unknown>;
    quellen: string[];
    entwurf: { name: string; ausgangstext: string };
  };

  async function geheimeQuelle(): Promise<string> {
    const angelegt = await auf(admin.token, "POST", "/api/kos", {
      confidentiality: "intern",
      title: GEHEIMTITEL,
      statement: "Staffelpreise für Faltschachteln, nur für den Einkauf (fiktiv).",
      type: "best_practice",
      category: "Beschaffung Beispiel",
    });
    expect(angelegt.statusCode).toBe(201);
    const id = (angelegt.json() as { id: string }).id;
    await services.ko.setConfidentiality(id, "vertraulich", admin.id);
    return id;
  }

  it("ohne Vorgang wird der Übernahmesatz gezielt abgewiesen", async () => {
    const antwort = await auf(erik.token, "POST", URL, { text: "So wie eben speichern." });
    expect(antwort.statusCode).toBe(400);
    expect(antwort.json()).toMatchObject({ grund: "kontext_fehlt" });
  });

  // ----------------------------------------------------------------------------------------------
  // Nacharbeit 4 (Ben): zwei Fälle mit getrennten Quellen; Bindung zwischen Vorschau und Speichern.
  // ----------------------------------------------------------------------------------------------

  async function zweiFaelle(spezId: string, etikettId: string): Promise<string> {
    const begonnen = await auf(erik.token, "POST", "/api/me/klara/gespraeche", {
      objektbezug: ORT,
    });
    const id = (begonnen.json() as { gespraech: { id: string } }).gespraech.id;
    await auf(erik.token, "PUT", `/api/me/klara/gespraeche/${id}/einwilligung`, { erteilt: true });
    await sage(id, FRAGE, spezId);
    await sage(id, "Und jetzt bitte Angebote für Etiketten E7 anfragen.", etikettId);
    return id;
  }

  async function vorschau(eingabe: Record<string, unknown>) {
    return auf(erik.token, "POST", `${URL}/entwurf`, {
      text: "So wie eben speichern.",
      gespraech: "letztes",
      ...eingabe,
    });
  }

  it("zwei Fälle im Gespräch: ohne Wahl 409 mit Auswahl, mit Wahl nur dessen Quellen", async () => {
    const spezId = await quelle();
    const etikettId = await quelle();
    await zweiFaelle(spezId, etikettId);

    const mehrdeutig = await vorschau({});
    expect(mehrdeutig.statusCode).toBe(409);
    const { abschnitte } = mehrdeutig.json() as {
      grund: string;
      abschnitte: Array<{ abschnitt: string; text: string }>;
    };
    expect(mehrdeutig.json()).toMatchObject({ grund: "vorgang_mehrdeutig" });
    expect(abschnitte.map((a) => a.text)).toEqual([
      FRAGE,
      "Und jetzt bitte Angebote für Etiketten E7 anfragen.",
    ]);

    const zweiter = await vorschau({ abschnitt: abschnitte[1]?.abschnitt });
    expect(zweiter.statusCode, zweiter.body).toBe(200);
    expect(zweiter.json()).toMatchObject({
      entwurf: { name: "Angebote für Etiketten E7 einholen" },
      quellen: [etikettId],
    });
    const gespeichert = await auf(erik.token, "POST", URL, mitBindung(zweiter.json() as Vorschau));
    expect(gespeichert.statusCode, gespeichert.body).toBe(201);
    const { funktion } = gespeichert.json() as { funktion: Funktion };
    expect(funktion.aktuell.quellen).toEqual([etikettId]);
    expect(funktion.aktuell.name).toBe("Angebote für Etiketten E7 einholen");
  });

  it("eine neue Nachricht zwischen Vorschau und Speichern ist ein Konflikt — nichts wird gespeichert", async () => {
    const spezId = await quelle();
    const geheimId = await geheimeQuelle();
    const gespraechId = await vorgang(spezId, geheimId);
    const gezeigt = (await vorschau({})).json() as Vorschau;
    await sage(gespraechId, "Bitte auch die Kartonstärke beachten.", spezId);
    const antwort = await auf(erik.token, "POST", URL, mitBindung(gezeigt));
    expect(antwort.statusCode).toBe(409);
    expect(antwort.json()).toMatchObject({ grund: "vorgang_geaendert" });
    expect((await auf(erik.token, "GET", URL)).json()).toEqual({ funktionen: [] });
  });

  // Nacharbeit 5 (Ben): nach der Vorschau ein anderer Ablauf diktiert — mit der alten Bindung
  // gespeichert, wäre er still die neue Definition. Der Server weist das ab.
  it("ein nach der Vorschau geänderter Text wird mit der alten Bindung nicht gespeichert", async () => {
    const spezId = await quelle();
    const geheimId = await geheimeQuelle();
    await vorgang(spezId, geheimId);
    const gezeigt = (await vorschau({})).json() as Vorschau;
    const diktiert = "So wie eben speichern. Bitte Angebote für Etiketten E7 anfragen.";
    const antwort = await auf(erik.token, "POST", URL, mitBindung(gezeigt, diktiert));
    expect(antwort.statusCode).toBe(409);
    expect(antwort.json()).toMatchObject({ grund: "vorgang_geaendert" });
    expect((await auf(erik.token, "GET", URL)).json()).toEqual({ funktionen: [] });
    // Gegenprobe: derselbe Eingabestand wie in der Vorschau wird gespeichert.
    const gleich = await auf(erik.token, "POST", URL, mitBindung(gezeigt));
    expect(gleich.statusCode, gleich.body).toBe(201);
  });

  it("ein Gesprächswechsel nach der Vorschau ändert nicht, was gespeichert wird", async () => {
    const spezId = await quelle();
    const etikettId = await quelle();
    const geheimId = await geheimeQuelle();
    const erstesId = await vorgang(spezId, geheimId);
    const gezeigt = (await vorschau({})).json() as Vorschau;
    // Inzwischen ein neues Gespräch mit einem anderen Fall — es ist jetzt das „letzte".
    const neu = await auf(erik.token, "POST", "/api/me/klara/gespraeche", { objektbezug: ORT });
    const neuId = (neu.json() as { gespraech: { id: string } }).gespraech.id;
    await auf(erik.token, "PUT", `/api/me/klara/gespraeche/${neuId}/einwilligung`, {
      erteilt: true,
    });
    await sage(neuId, "Bitte Angebote für Etiketten E7 anfragen.", etikettId);
    expect(((await vorschau({})).json() as Vorschau).bindung.gespraechId).toBe(neuId);

    const antwort = await auf(erik.token, "POST", URL, mitBindung(gezeigt));
    expect(antwort.statusCode, antwort.body).toBe(201);
    const { funktion } = antwort.json() as { funktion: Funktion };
    expect(funktion.aktuell.quellen).toEqual([spezId]);
    expect((funktion.aktuell as { herkunft?: unknown }).herkunft).toMatchObject({
      gespraechId: erstesId,
    });
  });

  it("Ablauf und berechtigte Quellen kommen aus dem Gespräch; die Bindung trägt bis zum Aufruf", async () => {
    const spezId = await quelle();
    const geheimId = await geheimeQuelle();
    const gespraechId = await vorgang(spezId, geheimId);

    const gesehen = await auf(erik.token, "POST", `${URL}/entwurf`, {
      text: "So wie eben speichern.",
      gespraech: "letztes",
    });
    expect(gesehen.statusCode, gesehen.body).toBe(200);
    expect(gesehen.json()).toMatchObject({ quellen: [spezId], nichtUebernommen: 1 });
    expect(gesehen.body).not.toContain(GEHEIMTITEL);

    // Nacharbeit 4: „letztes" gilt nur für die Vorschau; gespeichert wird mit ihrer Bindung.
    const ohneBindung = await auf(erik.token, "POST", URL, {
      text: "So wie eben speichern.",
      gespraech: "letztes",
    });
    expect(ohneBindung.statusCode).toBe(400);
    expect(ohneBindung.json()).toMatchObject({ grund: "vorschau_fehlt" });
    const antwort = await auf(erik.token, "POST", URL, mitBindung(gesehen.json() as Vorschau));
    expect(antwort.statusCode, antwort.body).toBe(201);
    const { funktion } = antwort.json() as { funktion: Funktion };
    expect(funktion.aktuell.name).toBe("Angebote für Faltschachteln FS-12 einholen");
    expect(funktion.aktuell.quellen).toEqual([spezId]);
    expect((funktion.aktuell as { herkunft?: unknown }).herkunft).toMatchObject({
      art: "assistenzgespraech",
      gespraechId,
    });
    const roh = (await auf(erik.token, "GET", `${URL}/${funktion.id}`)).body;
    for (const wert of ["500", "30.11.2026", geheimId, GEHEIMTITEL]) {
      expect(roh, wert).not.toContain(wert);
    }

    // Nächster manueller Aufruf: die übernommene Quelle wird neu gelesen.
    const erster = await laufe(erik.token, funktion.id, fall("Faltschachtel FS-12", "500 Stück"));
    expect(erster).toMatchObject({
      stand: "wartet_auf_faehigkeit",
      klaerung: [],
      quellen: [{ koId: spezId, zustand: "gelesen", fassung: 1 }],
    });

    // Die Quelle wandert in den Papierkorb: gezielte Klärung „gelöscht", kein alter Inhalt.
    const geloescht = await auf(admin.token, "DELETE", `/api/kos/${spezId}`);
    expect(geloescht.statusCode, geloescht.body).toBeLessThan(300);
    const zweiter = await laufe(erik.token, funktion.id, fall("Etikett E1", "2000 Stück"));
    expect(zweiter.stand).toBe("klaerung_noetig");
    expect(zweiter.quellen).toEqual([
      { koId: spezId, zustand: "geloescht", fassung: null, status: null },
    ]);
    expect(zweiter.klaerung.map((k) => [k.art, k.koId])).toEqual([["quelle_geloescht", spezId]]);
  });

  it("K07 · Name, Zweck und Quellen über den Änderungsweg: neue Fassung, alte Läufe bleiben", async () => {
    const spezId = await quelle();
    const f = await speichere(erik.token, { text: SATZ, quellen: [spezId] });
    await laufe(erik.token, f.id, fall("Karton A", "10 Stück"));
    const v1 = await lies(erik.token, f.id);
    const geaendert = await aendere(erik.token, f.id, {
      rev: v1.rev,
      name: "Verpackungsangebote FS",
      zweck: "Angebote für Faltschachteln, Spezifikation FS-12.",
      quellen: [],
    });
    expect(geaendert.statusCode, geaendert.body).toBe(200);
    const wieder = await lies(erik.token, f.id);
    expect(wieder.fassungen.map((v) => [v.version, v.name])).toEqual([
      [1, "Angebote für Verpackung einholen"],
      [2, "Verpackungsangebote FS"],
    ]);
    expect(wieder.aktuell.quellen).toEqual([]);
    expect(wieder.laeufe.map((l) => [l.fassung, l.quellen[0]?.koId])).toEqual([[1, spezId]]);
  });
});

describe("Eigentum und Anmeldung", () => {
  it("ein fremdes Konto sieht, ändert und ruft die Funktion nicht auf — 404 wie unbekannt", async () => {
    const f = await speichere(erik.token, { text: SATZ });
    expect((await auf(vera.token, "GET", URL)).json()).toEqual({ funktionen: [] });
    expect((await auf(vera.token, "GET", `${URL}/${f.id}`)).statusCode).toBe(404);
    const aendern = await aendere(vera.token, f.id, { rev: f.rev, stand: "pausiert" });
    expect(aendern.statusCode).toBe(404);
    const lauf = await versuche(vera.token, f.id, fall("Karton A", "1 Stück"));
    expect(lauf.statusCode).toBe(404);
    expect((await lies(erik.token, f.id)).stand).toBe("aktiv");
  });

  it("ohne Anmeldung ist jede Tür zu", async () => {
    expect((await auf("", "GET", URL)).statusCode).toBe(401);
    expect((await auf("", "POST", `${URL}/entwurf`, { text: "Angebote" })).statusCode).toBe(401);
    expect((await auf("", "POST", URL, {})).statusCode).toBe(401);
  });
});
