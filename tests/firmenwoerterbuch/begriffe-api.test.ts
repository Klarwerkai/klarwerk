// ================================================================================================
// FIRMENWÖRTERBUCH · DER DRAHT — Pflege, Neuladen, Rechte, Instanztrennung, keine Rückwirkung.
// ================================================================================================
//
// Gemessen an der ECHTEN App (`buildApp`), mit echten Konten aus dem Demo-Seed: Admin, Controllerin
// Carla (`ko.validate`) und Experte Erik (ohne `ko.validate`). Alle Begriffe hier sind getrennte
// Beispieldaten dieses Tests; kein produktiver Nutzerinhalt.
//
// Ordnung zu den Originalkriterien des Auftrags:
//   K1 · Anlegen mit Definition, DE/EN, Kontext, Synonym, unerwünschter Variante; Neuladen.
//   K2 · (Serverseite) Vorschlag im passenden Kontext mit Vorzugsbezeichnung und Herkunft.
//   K3 · Synonym ist kein Fehler; gleichlautende Begriffe verschiedener Bereiche bleiben getrennt.
//   K5 · Änderung = neue Fassung; freigegebene Wissensobjekte bleiben unverändert; alte Fassungen
//        bleiben abrufbar und Hinweisen zuordenbar.
//   K6 · Unberechtigte Pflege → 403/401; Sitzung und Kennung einer anderen Instanz greifen nicht.
//   K8 · Ergebnis trägt `sachlichGeprueft: false`; ein neuer Beitrag bleibt prüfpflichtig.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { demoKennwort } from "../support/demoZugang";

type App = ReturnType<typeof buildApp>;
type Kopf = { headers: { authorization: string } };

interface Hinweis {
  begriffId: string;
  begriffVersion: number;
  vorzug: string;
  mehrdeutig: boolean;
}

async function anmelden(app: App, email: string, password: string): Promise<Kopf> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  expect(res.statusCode, `Anmeldung ${email}`).toBe(200);
  return { headers: { authorization: `Bearer ${res.json().token}` } };
}

async function instanz() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const admin = await anmelden(app, "a@x.de", "secret123");
  const seed = await app.inject({
    method: "POST",
    url: "/api/admin/demo-seed",
    headers: admin.headers,
  });
  expect(seed.statusCode).toBe(200);
  const carla = await anmelden(
    app,
    "carla@demo.klarwerk",
    demoKennwort(seed, "carla@demo.klarwerk"),
  );
  const erik = await anmelden(app, "erik@demo.klarwerk", demoKennwort(seed, "erik@demo.klarwerk"));
  return { app, admin, carla, erik };
}

const KUNDENKONTO = {
  geltungsbereich: "Vertrieb",
  verantwortlich: "Team Vertriebsinnendienst",
  definition: {
    de: "Das Konto eines Kunden im Abrechnungssystem.",
    en: "A customer's account in the billing system.",
  },
  bezeichnungen: {
    de: { vorzug: "Kundenkonto", synonyme: ["Debitorenkonto"], unerwuenscht: ["Kundenaccount"] },
    en: { vorzug: "customer account", synonyme: [], unerwuenscht: ["client account"] },
  },
};

async function anlegen(app: App, kopf: Kopf, eingabe: unknown) {
  return app.inject({
    method: "POST",
    url: "/api/begriffe",
    headers: kopf.headers,
    payload: eingabe,
  });
}

async function angelegt(app: App, kopf: Kopf, eingabe: unknown) {
  const res = await anlegen(app, kopf, eingabe);
  expect(res.statusCode, res.body).toBe(201);
  return res.json();
}

async function lies(app: App, kopf: Kopf, url: string) {
  return app.inject({ method: "GET", url, headers: kopf.headers });
}

async function pruefen(app: App, kopf: Kopf, segmente: string[], kontext: string | null = null) {
  const res = await app.inject({
    method: "POST",
    url: "/api/begriffe/pruefen",
    headers: kopf.headers,
    payload: { segmente, kontext },
  });
  expect(res.statusCode).toBe(200);
  return res.json() as { hinweise: Hinweis[]; begriffeGeprueft: number; sachlichGeprueft: false };
}

function vorzuege(hinweise: Hinweis[]): string[] {
  return hinweise.map((h) => h.vorzug);
}

/** Was eine Fassung ausmacht: Version, Status, Text und der Fassungsverlauf. */
async function stand(app: App, kopf: Kopf, kos: { id: string }[]) {
  return Promise.all(
    kos.map(async (k) => {
      const ko = (await lies(app, kopf, `/api/kos/${k.id}`)).json();
      const verlauf = (await lies(app, kopf, `/api/kos/${k.id}/versions`)).json();
      return {
        id: ko.id,
        version: ko.version,
        status: ko.status,
        title: ko.title,
        statement: ko.statement,
        bodyHtml: ko.bodyHtml ?? null,
        updatedAt: ko.updatedAt,
        verlauf,
      };
    }),
  );
}

describe("K1 · berechtigte Pflege legt einen vollständigen Begriff an — Neuladen liefert dieselbe Fassung", () => {
  it("Carla (ko.validate) legt an; Liste, Einzelabruf und Fassungsabruf tragen genau diese Fassung", async () => {
    const { app, carla, erik } = await instanz();
    const b = await angelegt(app, carla, KUNDENKONTO);
    expect(b).toMatchObject({ ...KUNDENKONTO, version: 1 });
    expect(typeof b.id).toBe("string");
    expect(typeof b.geaendertVon).toBe("string");

    // „Neuladen": ein frischer Lesevorgang — auch durch ein ANDERES Konto mit Leserecht.
    const liste = await lies(app, erik, "/api/begriffe");
    expect(liste.statusCode).toBe(200);
    expect(liste.json().begriffe).toEqual([b]);
    expect((await lies(app, erik, `/api/begriffe/${b.id}`)).json()).toEqual({
      aktuell: b,
      fassungen: [b],
    });
    expect((await lies(app, erik, `/api/begriffe/${b.id}/fassungen/1`)).json()).toEqual(b);
  });

  it("Pflichtangaben und Widersprüche werden abgewiesen, nichts wird angelegt", async () => {
    const { app, carla } = await instanz();
    const ohneDefinition = await anlegen(app, carla, { ...KUNDENKONTO, definition: {} });
    expect(ohneDefinition.json().error).toBe("BEGRIFF_UNGUELTIG");
    const ohneBereich = await anlegen(app, carla, { ...KUNDENKONTO, geltungsbereich: " " });
    expect(ohneBereich.statusCode).toBe(400);
    const widerspruch = await anlegen(app, carla, {
      ...KUNDENKONTO,
      bezeichnungen: { de: { vorzug: "Kundenkonto", synonyme: [], unerwuenscht: ["kundenkonto"] } },
      definition: { de: "x" },
    });
    expect(widerspruch.json().error).toBe("BEGRIFF_WIDERSPRUECHLICH");
    expect((await lies(app, carla, "/api/begriffe")).json().begriffe).toEqual([]);
  });
});

describe("K2 (Server) · eine unerwünschte Variante bekommt im passenden Kontext die Vorzugsbezeichnung", () => {
  it("DE und EN je in ihrer Sprache, mit Eintrag, Fassung, Definition und genauer Fundstelle", async () => {
    const { app, carla, erik } = await instanz();
    const b = await angelegt(app, carla, KUNDENKONTO);
    const satz = "Bitte das Kundenaccount prüfen. Then check the client account.";
    const ergebnis = await pruefen(app, erik, [satz], "Vertrieb");
    expect(ergebnis.sachlichGeprueft).toBe(false);
    expect(ergebnis.hinweise).toHaveLength(2);
    const [de, en] = ergebnis.hinweise as unknown as Record<string, unknown>[];
    expect(de).toMatchObject({
      begriffId: b.id,
      begriffVersion: 1,
      sprache: "de",
      geltungsbereich: "Vertrieb",
      segment: 0,
      gefunden: "Kundenaccount",
      vorzug: "Kundenkonto",
      definition: "Das Konto eines Kunden im Abrechnungssystem.",
      vorkommen: 0,
      vorkommenGesamt: 1,
    });
    expect(satz.slice(Number(de?.start), Number(de?.ende))).toBe("Kundenaccount");
    // Englisch bekommt die ENGLISCHE Vorzugsbezeichnung — keine ungeprüfte Gleichsetzung.
    expect(en).toMatchObject({
      sprache: "en",
      gefunden: "client account",
      vorzug: "customer account",
    });
  });

  it("in einem anderen Geltungsbereich gibt es keinen Hinweis", async () => {
    const { app, carla, erik } = await instanz();
    await angelegt(app, carla, KUNDENKONTO);
    const ergebnis = await pruefen(app, erik, ["Bitte das Kundenaccount prüfen."], "Produktion");
    expect(ergebnis.hinweise).toEqual([]);
    expect(ergebnis.begriffeGeprueft).toBe(0);
  });
});

describe("K3 · Synonyme sind keine Fehler — gleichlautende Begriffe bleiben getrennt", () => {
  it("Vorzugsbezeichnung und zugelassenes Synonym erzeugen keinen Hinweis", async () => {
    const { app, carla, erik } = await instanz();
    await angelegt(app, carla, KUNDENKONTO);
    const texte = ["Das Kundenkonto ist angelegt.", "Das Debitorenkonto ist gesperrt."];
    expect((await pruefen(app, erik, texte, "Vertrieb")).hinweise).toEqual([]);
  });

  it("„Order“ im Vertrieb und in der Fertigung: zwei Einträge, getrennte Hinweise, nichts zusammengeführt", async () => {
    const { app, carla, erik } = await instanz();
    const vertrieb = await angelegt(app, carla, {
      geltungsbereich: "Vertrieb",
      verantwortlich: "Vertrieb",
      definition: { de: "Bestellung eines Kunden." },
      bezeichnungen: { de: { vorzug: "Kundenauftrag", synonyme: [], unerwuenscht: ["Order"] } },
    });
    const fertigung = await angelegt(app, carla, {
      geltungsbereich: "Fertigung",
      verantwortlich: "Arbeitsvorbereitung",
      definition: { de: "Interner Auftrag zur Herstellung." },
      bezeichnungen: { de: { vorzug: "Fertigungsauftrag", synonyme: [], unerwuenscht: ["Order"] } },
    });
    expect(vertrieb.id).not.toBe(fertigung.id);

    // Dieselbe Vorzugsbezeichnung in einem ANDEREN Bereich ist erlaubt …
    await angelegt(app, carla, {
      geltungsbereich: "Fertigung",
      verantwortlich: "Arbeitsvorbereitung",
      definition: { de: "Ein anderer Begriff mit demselben Namen." },
      bezeichnungen: { de: { vorzug: "Kundenauftrag", synonyme: [], unerwuenscht: [] } },
    });
    // … im SELBEN Bereich wird die Dublette abgewiesen statt still zusammengeführt.
    const doppelt = await anlegen(app, carla, {
      geltungsbereich: "vertrieb",
      verantwortlich: "Vertrieb",
      definition: { de: "Doppelt." },
      bezeichnungen: { de: { vorzug: "kundenauftrag", synonyme: [], unerwuenscht: [] } },
    });
    expect(doppelt.statusCode).toBe(409);
    expect(doppelt.json()).toMatchObject({ error: "BEGRIFF_DOPPELT", vorhanden: vertrieb.id });

    const text = ["Die Order ist eingegangen."];
    const imVertrieb = await pruefen(app, erik, text, "Vertrieb");
    expect(vorzuege(imVertrieb.hinweise)).toEqual(["Kundenauftrag"]);
    const inDerFertigung = await pruefen(app, erik, text, "Fertigung");
    expect(vorzuege(inDerFertigung.hinweise)).toEqual(["Fertigungsauftrag"]);
    // Ohne Kontext: zwei getrennte Hinweise, beide als mehrdeutig gekennzeichnet.
    const ohne = await pruefen(app, erik, text);
    expect(ohne.hinweise).toHaveLength(2);
    expect(ohne.hinweise.every((h) => h.mehrdeutig)).toBe(true);
    const herkunft = new Set(ohne.hinweise.map((h) => h.begriffId));
    expect(herkunft).toEqual(new Set([vertrieb.id, fertigung.id]));
  });
});

describe("K5 · eine Änderung ist eine neue Fassung — nichts Freigegebenes wird angefasst", () => {
  it("Fassung 2 entsteht, Fassung 1 bleibt abrufbar; freigegebene Wissensobjekte bleiben gleich", async () => {
    const { app, carla, erik, admin } = await instanz();
    const bestand = await lies(app, admin, "/api/kos");
    const kos: { id: string; status: string; statement: string }[] = bestand.json();
    const freigegeben = kos.filter((k) => k.status === "validiert");
    expect(freigegeben.length, "der Demo-Seed hat keine freigegebenen Einträge").toBeGreaterThan(0);
    const ziel = freigegeben[0] as { id: string; statement: string };
    // Ein Wort, das WIRKLICH im freigegebenen Eintrag steht, wird zur unerwünschten Benennung.
    const wort = ziel.statement.match(/\p{L}{6,}/u)?.[0] as string;
    expect(wort, "kein ausreichend langes Wort in der Kernaussage").toBeDefined();
    const vorher = await stand(app, admin, freigegeben);

    const v1 = await angelegt(app, carla, {
      geltungsbereich: "Allgemein",
      verantwortlich: "Redaktion",
      definition: { de: "Testbegriff." },
      bezeichnungen: { de: { vorzug: "Vorzugswort", synonyme: [], unerwuenscht: [wort] } },
    });
    const hinweisV1 = (await pruefen(app, erik, [ziel.statement])).hinweise[0] as Hinweis;
    expect(hinweisV1).toMatchObject({ begriffId: v1.id, begriffVersion: 1, vorzug: "Vorzugswort" });

    const aenderung = await app.inject({
      method: "PUT",
      url: `/api/begriffe/${v1.id}`,
      headers: carla.headers,
      payload: {
        version: 1,
        geltungsbereich: "Allgemein",
        verantwortlich: "Redaktion",
        definition: { de: "Testbegriff, überarbeitet." },
        bezeichnungen: { de: { vorzug: "Neues Vorzugswort", synonyme: [], unerwuenscht: [wort] } },
      },
    });
    expect(aenderung.statusCode).toBe(200);
    expect(aenderung.json()).toMatchObject({ id: v1.id, version: 2 });

    // Eine Änderung auf dem Stand von Fassung 1 kommt NICHT durch — nichts wird überschrieben.
    const veraltet = await app.inject({
      method: "PUT",
      url: `/api/begriffe/${v1.id}`,
      headers: carla.headers,
      payload: { ...KUNDENKONTO, version: 1, geltungsbereich: "Allgemein" },
    });
    expect(veraltet.statusCode).toBe(409);
    expect(veraltet.json().error).toBe("VERSION_VERALTET");

    // Die alte Fassung bleibt GENAU so abrufbar, wie der frühere Hinweis sie nannte.
    const altUrl = `/api/begriffe/${hinweisV1.begriffId}/fassungen/${hinweisV1.begriffVersion}`;
    const alt = await lies(app, erik, altUrl);
    expect(alt.statusCode).toBe(200);
    expect(alt.json()).toEqual(v1);
    const verlauf = (await lies(app, erik, `/api/begriffe/${v1.id}`)).json();
    expect(verlauf.fassungen.map((f: { version: number }) => f.version)).toEqual([1, 2]);
    expect(verlauf.aktuell.bezeichnungen.de.vorzug).toBe("Neues Vorzugswort");
    // Neue Hinweise beziehen sich auf die neue Fassung.
    const hinweisV2 = (await pruefen(app, erik, [ziel.statement])).hinweise[0];
    expect(hinweisV2).toMatchObject({ begriffVersion: 2, vorzug: "Neues Vorzugswort" });

    // KEINE RÜCKWIRKUNG: jeder freigegebene Eintrag hat dieselbe Fassung, denselben Status und
    // denselben Text — und keinen zusätzlichen Eintrag im Fassungsverlauf.
    expect(await stand(app, admin, freigegeben)).toEqual(vorher);
  });
});

describe("K6 · unberechtigte Pflege und fremde Instanzen werden abgewiesen", () => {
  it("Experte ohne ko.validate: Anlegen und Ändern → 403, Bestand unverändert; ohne Sitzung → 401", async () => {
    const { app, carla, erik } = await instanz();
    const b = await angelegt(app, carla, KUNDENKONTO);
    const einkauf = { ...KUNDENKONTO, geltungsbereich: "Einkauf" };
    const anlegenVerboten = await anlegen(app, erik, einkauf);
    expect(anlegenVerboten.statusCode).toBe(403);
    const aendernVerboten = await app.inject({
      method: "PUT",
      url: `/api/begriffe/${b.id}`,
      headers: erik.headers,
      payload: { ...KUNDENKONTO, version: 1, verantwortlich: "Erik" },
    });
    expect(aendernVerboten.statusCode).toBe(403);
    const ohne = await app.inject({ method: "POST", url: "/api/begriffe", payload: KUNDENKONTO });
    expect(ohne.statusCode).toBe(401);
    const ohneLesen = await app.inject({ method: "GET", url: "/api/begriffe" });
    expect(ohneLesen.statusCode).toBe(401);
    const bestand = (await lies(app, carla, "/api/begriffe")).json();
    expect(bestand.begriffe).toEqual([b]);
  });

  it("zwei Unternehmensinstanzen: weder Sitzung noch Kennung noch Katalog greifen hinüber", async () => {
    const a = await instanz();
    const b = await instanz();
    const begriffA = await angelegt(a.app, a.carla, KUNDENKONTO);

    // Die Sitzung aus A ist in B keine Sitzung.
    const fremdeSitzung = await lies(b.app, a.carla, `/api/begriffe/${begriffA.id}`);
    expect(fremdeSitzung.statusCode).toBe(401);
    const fremdesAnlegen = await anlegen(b.app, a.carla, KUNDENKONTO);
    expect(fremdesAnlegen.statusCode).toBe(401);
    // Die Kennung aus A ist in B kein Eintrag — auch für ein berechtigtes Konto von B.
    const fremdeAdressen = [
      `/api/begriffe/${begriffA.id}`,
      `/api/begriffe/${begriffA.id}/fassungen/1`,
    ];
    for (const url of fremdeAdressen) {
      expect((await lies(b.app, b.carla, url)).statusCode, url).toBe(404);
    }
    const aendernInB = await b.app.inject({
      method: "PUT",
      url: `/api/begriffe/${begriffA.id}`,
      headers: b.carla.headers,
      payload: { ...KUNDENKONTO, version: 1 },
    });
    expect(aendernInB.statusCode).toBe(404);
    // Der Katalog von B ist leer, und ein Text in B bekommt keine Hinweise aus A.
    expect((await lies(b.app, b.erik, "/api/begriffe")).json()).toEqual({ begriffe: [] });
    expect((await pruefen(b.app, b.erik, ["Das Kundenaccount."])).hinweise).toEqual([]);
    // A ist unverändert.
    expect((await lies(a.app, a.erik, "/api/begriffe")).json()).toEqual({ begriffe: [begriffA] });
  });
});

describe("K8 · Begriffskonformität ist keine Aussage über sachliche Richtigkeit", () => {
  it("auch ohne jeden Hinweis lautet das Ergebnis sachlichGeprueft: false", async () => {
    const { app, carla, erik } = await instanz();
    await angelegt(app, carla, KUNDENKONTO);
    const ergebnis = await pruefen(app, erik, ["Das Kundenkonto wird nie gelöscht."], "Vertrieb");
    expect(ergebnis).toEqual({
      hinweise: [],
      begriffeGeprueft: 1,
      kontext: "Vertrieb",
      sachlichGeprueft: false,
    });
  });

  it("ein begriffskonformer Beitrag bleibt prüfpflichtig — der Abgleich ändert nichts am Prüfweg", async () => {
    const { app, carla, erik } = await instanz();
    await angelegt(app, carla, KUNDENKONTO);
    const titel = "Kundenkonto wird nach Kündigung sofort gelöscht";
    const aussage =
      "Das Kundenkonto wird am Tag der Kündigung gelöscht; das Debitorenkonto ebenso.";
    expect((await pruefen(app, erik, [titel, aussage], "Vertrieb")).hinweise).toEqual([]);
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: erik.headers,
      payload: {
        title: titel,
        statement: aussage,
        type: "best_practice",
        category: "Vertrieb",
        tags: ["firmenwoerterbuch-test"],
        confidentiality: "intern",
      },
    });
    expect(res.statusCode, res.body).toBe(201);
    // Nicht freigegeben, nur weil die Begriffe stimmen: der Eintrag steht offen zur Prüfung.
    expect(res.json().status).toBe("offen");
  });
});
