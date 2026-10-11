// ================================================================================================
// VERÖFFENTLICHUNG MIT BENACHRICHTIGUNGSWAHL (produkt:20261007:veroeffentlichungsoptionen) · SERVER.
// ================================================================================================
//
// Gemessen über die ECHTE Anwendung (`buildApp(assembleServices(inMemoryRepos(), …))`, `app.inject`).
// Nur die Vorbereitung der Fassungen (Überarbeiten, Gültigsetzen, Einstufen) läuft über die
// vorhandenen Dienste; jeder Schritt der Veröffentlichung, der Kenntnisnahme und der Glocke geht
// über HTTP. Fiktive Beispielkonten, keine produktiven Daten.
//
// Die Uhr läuft mit der echten Zeit und wird nur VORGESTELLT (`versatz`): Konten werden mit der
// echten Zeit angelegt, und eine Meldung geht nur an Konten, die zum Veröffentlichungszeitpunkt
// schon bestanden.
//
// Originalkriterien:
//   K1  Aktionen erklären resultierenden Zustand, Sichtbarkeit und Benachrichtigungsempfänger.
//   K2  Stille Veröffentlichung erzeugt keine üblichen Meldungen, bleibt berechtigt auffindbar und
//       nachvollziehbar in der Historie.
//   K3  Normale und hervorgehobene Veröffentlichung haben ihre erklärte Meldungswirkung;
//       Hervorheben erweitert keine Rechte.
//   K4  Entwurf und veröffentlichte Fassung sind eindeutig; Berechtigungen und fachliche
//       Prüfregeln bleiben wirksam.
//   K5  Ausdrücklich angeforderte Kenntnisnahme wird durch still nicht unbemerkt ausgeschaltet.
//   K6  Neue Veröffentlichung und Aktualisierung werden getrennt mit passenden Rollen geprüft.
//
// GEGENPROBEN (benannt, nicht gefahren):
//   · In `VeroeffentlichungDienst.meldungenFuer` die Prüfung `meldung === "still"` entfernen → die
//     K2-Fälle „keine Meldung" werden rot.
//   · In `notifications-routes.ts` `sichtbareEintraege` für Veröffentlichungen weglassen → K3
//     „hervorgehoben auf vertraulichem Eintrag" und „Entzug nach dem Veröffentlichen" werden rot.
//   · In `veroeffentlichung-routes.ts` das Tor `ko.validate` durch `ko.read` ersetzen → K4/K6
//     „Experte und Leser dürfen nicht veröffentlichen" werden rot.
//   · Den Status-Check in `bilde` (veroeffentlichung.ts) entfernen → K4 „Entwurf wird nicht
//     veröffentlicht" wird rot.
import { beforeEach, describe, expect, it } from "vitest";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;

const STUNDE = 3_600_000;

let versatz = 0;
let services: AppServices;
let app: App;
let ada = { id: "", token: "" };
let clara = { id: "", token: "" };
let erik = { id: "", token: "" };
let vera = { id: "", token: "" };
let fiona = { id: "", token: "" };

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
    headers: { authorization: `Bearer ${ada.token}` },
    payload: { name, email, password: "secret123", role: rolle },
  });
  expect(angelegt.statusCode).toBe(201);
  return { id: (angelegt.json() as { id: string }).id, token: await anmelden(email) };
}

const auf = (wer: string, methode: "GET" | "POST", url: string, payload?: unknown) =>
  app.inject({
    method: methode,
    url,
    headers: { authorization: `Bearer ${wer}` },
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });

/** Ein Eintrag in Fassung V1 (Status offen), angelegt von Ada. */
async function eintrag(titel: string): Promise<string> {
  const angelegt = await auf(ada.token, "POST", "/api/kos", {
    confidentiality: "intern",
    title: titel,
    statement: `${titel}: Prüfschritt mit fiktiven Beispielwerten.`,
    type: "best_practice",
    category: "Anlage Beispiel",
  });
  expect(angelegt.statusCode).toBe(201);
  return (angelegt.json() as { id: string }).id;
}

/** Setzt die aktuelle Fassung gültig — der Weg einer abgeschlossenen Prüfung. */
async function gueltig(id: string): Promise<number> {
  const ko = await services.ko.setValidationState(id, { trust: 80, status: "validiert" });
  expect(ko.status).toBe("validiert");
  return ko.version;
}

/** Ein Eintrag mit GÜLTIGER Fassung V1. */
async function gueltigerEintrag(titel = "Druckprobe Leitung 7"): Promise<string> {
  const id = await eintrag(titel);
  expect(await gueltig(id)).toBe(1);
  return id;
}

interface Verlauf {
  id: string;
  fassung: number;
  art: string;
  meldung: string;
  von: { id: string; name: string };
  am: string;
  empfaenger: number;
}
interface Stand {
  darfVeroeffentlichen: boolean;
  koId: string;
  aktuelleFassung: number;
  gueltig: boolean;
  veroeffentlichteFassung: number | null;
  aktuelleIstVeroeffentlicht: boolean;
  verlauf: Verlauf[];
  art?: string;
  hinderungsgrund?: string | null;
  sichtbarkeit?: { stufe: string | null; spaceId: string | null; leser: number };
  empfaenger?: Array<{ id: string; name: string }>;
  kenntnisnahmen?: { offen: number; ueberholt: number };
}
interface Meldung {
  id: string;
  kind: string;
  koId?: string;
  fassung?: number;
  art?: string;
  hervorgehoben?: boolean;
  seen: boolean;
  at: string;
}

const stand = async (wer: string, koId: string): Promise<Stand> => {
  const antwort = await auf(wer, "GET", `/api/kos/${koId}/veroeffentlichung`);
  expect(antwort.statusCode, antwort.body).toBe(200);
  return antwort.json() as Stand;
};
const veroeffentlichen = (wer: string, koId: string, fassung: number, meldung: string) =>
  auf(wer, "POST", `/api/kos/${koId}/veroeffentlichung`, { fassung, meldung });
const glocke = async (wer: string): Promise<Meldung[]> => {
  const antwort = await auf(wer, "GET", "/api/notifications");
  expect(antwort.statusCode).toBe(200);
  return antwort.json() as Meldung[];
};
const veroeffentlichungsMeldungen = async (wer: string): Promise<Meldung[]> =>
  (await glocke(wer)).filter((m) => m.kind === "veroeffentlichung");

beforeEach(async () => {
  versatz = 0;
  services = assembleServices(inMemoryRepos(), { kenntnisnahmeUhr: () => Date.now() + versatz });
  app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@veroeffentlichung.test", password: "secret123" },
  });
  ada = {
    id: (await services.auth.listUsers())[0]?.id ?? "",
    token: await anmelden("ada@veroeffentlichung.test"),
  };
  clara = await konto("controller", "clara@veroeffentlichung.test", "Clara Controller");
  erik = await konto("experte", "erik@veroeffentlichung.test", "Erik Experte");
  vera = await konto("viewer", "vera@veroeffentlichung.test", "Vera Viewer");
  fiona = await konto("experte", "fiona@veroeffentlichung.test", "Fiona Fachkraft");
  // Die Veröffentlichungen liegen zeitlich NACH der Kontoanlage.
  versatz = STUNDE;
});

describe("K1 · die Aktion erklärt Zustand, Sichtbarkeit und Empfänger — vor dem Klick", () => {
  it("Vorschau für die Freigebende: neue Veröffentlichung, Leserkreis, Empfänger ohne sie selbst", async () => {
    const id = await gueltigerEintrag();
    const v = await stand(clara.token, id);
    expect(v.darfVeroeffentlichen).toBe(true);
    expect(v).toMatchObject({
      koId: id,
      aktuelleFassung: 1,
      gueltig: true,
      veroeffentlichteFassung: null,
      aktuelleIstVeroeffentlicht: false,
      art: "neu",
      hinderungsgrund: null,
      sichtbarkeit: { stufe: "intern", spaceId: null, leser: 5 },
      kenntnisnahmen: { offen: 0, ueberholt: 0 },
      verlauf: [],
    });
    expect(v.empfaenger?.map((k) => k.name)).toEqual([
      "Ada Admin",
      "Erik Experte",
      "Fiona Fachkraft",
      "Vera Viewer",
    ]);
  });

  it("auf einem vertraulichen Eintrag nennt die Vorschau nur, wer ihn lesen darf", async () => {
    const id = await gueltigerEintrag("Vertrauliche Prüfanweisung");
    await services.ko.setConfidentiality(id, "vertraulich", ada.id);
    const v = await stand(clara.token, id);
    expect(v.sichtbarkeit).toEqual({ stufe: "vertraulich", spaceId: null, leser: 2 });
    expect(v.empfaenger?.map((k) => k.id)).toEqual([ada.id]);
  });

  it("an einem Entwurf nennt die Vorschau den Hinderungsgrund statt einer Wirkung", async () => {
    const id = await eintrag("Noch ungeprüfter Entwurf");
    const v = await stand(clara.token, id);
    expect(v.gueltig).toBe(false);
    expect(v.hinderungsgrund).toBe("keine_gueltige_fassung");
  });

  it("ein Leser ohne Freigaberecht bekommt den Stand, aber keine Empfängerliste", async () => {
    const id = await gueltigerEintrag();
    const roh = await auf(vera.token, "GET", `/api/kos/${id}/veroeffentlichung`);
    expect(roh.statusCode).toBe(200);
    const v = roh.json() as Stand;
    expect(v.darfVeroeffentlichen).toBe(false);
    expect(v).not.toHaveProperty("empfaenger");
    expect(v).not.toHaveProperty("sichtbarkeit");
    expect(v).not.toHaveProperty("kenntnisnahmen");
    expect(roh.body).not.toContain("Fiona Fachkraft");
  });
});

describe("K2 · still: keine Meldung, auffindbar, im Verlauf nachvollziehbar", () => {
  it("niemand bekommt eine Meldung; Eintrag bleibt lesbar und in der Liste", async () => {
    const id = await gueltigerEintrag("Stille Fassung Ventilwartung");
    const antwort = await veroeffentlichen(clara.token, id, 1, "still");
    expect(antwort.statusCode, antwort.body).toBe(201);
    expect(antwort.json()).toMatchObject({
      vermerk: { fassung: 1, art: "neu", meldung: "still", empfaenger: 0 },
    });
    for (const wer of [ada, clara, erik, vera, fiona]) {
      expect(await veroeffentlichungsMeldungen(wer.token)).toEqual([]);
    }
    // Berechtigt auffindbar: Detail und Liste für Leser.
    expect((await auf(vera.token, "GET", `/api/kos/${id}`)).statusCode).toBe(200);
    const liste = (await auf(erik.token, "GET", "/api/kos")).json() as Array<{ id: string }>;
    expect(liste.map((k) => k.id)).toContain(id);
  });

  it("der Verlauf nennt Fassung, Art, Wahl, Person und Zeitpunkt — auch für Leser; Beleg im Protokoll", async () => {
    const id = await gueltigerEintrag();
    expect((await veroeffentlichen(clara.token, id, 1, "still")).statusCode).toBe(201);
    const v = await stand(vera.token, id);
    expect(v).toMatchObject({
      veroeffentlichteFassung: 1,
      aktuelleIstVeroeffentlicht: true,
    });
    expect(v.verlauf).toHaveLength(1);
    expect(v.verlauf[0]).toMatchObject({
      fassung: 1,
      art: "neu",
      meldung: "still",
      von: { id: clara.id, name: "Clara Controller" },
      empfaenger: 0,
    });
    const belege = await services.audit.list({ action: "ko.veroeffentlicht", target: id });
    expect(belege).toHaveLength(1);
    expect(belege[0]?.actor).toBe(clara.id);
    expect(belege[0]?.payload).toMatchObject({ fassung: 1, art: "neu", meldung: "still" });
    // Am Objekt steht keine Liste der Kollegen — nur die Anzahl.
    const roh = (await auf(vera.token, "GET", `/api/kos/${id}`)).body;
    expect(roh).not.toContain(erik.id);
  });

  it("dieselbe Fassung zweimal veröffentlichen geht nicht", async () => {
    const id = await gueltigerEintrag();
    expect((await veroeffentlichen(clara.token, id, 1, "still")).statusCode).toBe(201);
    const zweit = await veroeffentlichen(clara.token, id, 1, "normal");
    expect(zweit.statusCode).toBe(409);
    expect(zweit.json()).toMatchObject({ grund: "bereits_veroeffentlicht" });
    expect(await veroeffentlichungsMeldungen(erik.token)).toEqual([]);
  });
});

describe("K3 · normal und hervorgehoben wirken wie erklärt; Hervorheben erweitert keine Rechte", () => {
  it("normal: genau die erklärten Empfänger bekommen je eine Meldung, die Veröffentlichende nicht", async () => {
    const id = await gueltigerEintrag();
    const erklaert = (await stand(clara.token, id)).empfaenger?.map((k) => k.id) ?? [];
    const antwort = await veroeffentlichen(clara.token, id, 1, "normal");
    expect(antwort.statusCode).toBe(201);
    expect(antwort.json()).toMatchObject({ vermerk: { empfaenger: erklaert.length } });
    const konten = { [ada.id]: ada, [erik.id]: erik, [vera.id]: vera, [fiona.id]: fiona };
    for (const kontoId of erklaert) {
      const m = await veroeffentlichungsMeldungen(konten[kontoId]?.token ?? "");
      expect(m).toHaveLength(1);
      expect(m[0]).toMatchObject({ koId: id, fassung: 1, art: "neu", hervorgehoben: false });
    }
    expect(await veroeffentlichungsMeldungen(clara.token)).toEqual([]);
  });

  it("hervorgehoben: dieselben Empfänger, markiert und oben, bis gelesen", async () => {
    const wichtig = await gueltigerEintrag("Wichtige Sicherheitsfassung");
    const normal = await gueltigerEintrag("Gewöhnliche Fassung");
    const empfaengerWichtig = (await stand(clara.token, wichtig)).empfaenger;
    expect((await veroeffentlichen(clara.token, wichtig, 1, "hervorgehoben")).statusCode).toBe(201);
    versatz += STUNDE; // die normale Meldung ist JÜNGER
    expect((await veroeffentlichen(clara.token, normal, 1, "normal")).statusCode).toBe(201);
    // Gleicher Empfängerkreis wie die Vorschau für „normal" an demselben Eintrag.
    expect((await stand(clara.token, wichtig)).verlauf[0]?.empfaenger).toBe(
      empfaengerWichtig?.length,
    );

    const vorher = await glocke(erik.token);
    const pub = vorher.filter((m) => m.kind === "veroeffentlichung");
    expect(pub.map((m) => m.koId)).toEqual([wichtig, normal]);
    expect(vorher[0]).toMatchObject({ koId: wichtig, hervorgehoben: true, seen: false });

    // Gelesen: die hervorgehobene Meldung reiht sich wieder nach Zeit ein.
    const gelesen = await auf(erik.token, "POST", "/api/notifications/seen", {
      ids: [vorher[0]?.id],
    });
    expect(gelesen.statusCode).toBe(200);
    const nachher = (await glocke(erik.token)).filter((m) => m.kind === "veroeffentlichung");
    expect(nachher.map((m) => m.koId)).toEqual([normal, wichtig]);
  });

  it("hervorgehoben auf einem vertraulichen Eintrag erreicht nur, wer ihn lesen darf", async () => {
    const id = await gueltigerEintrag("Vertrauliche Störfallanweisung");
    await services.ko.setConfidentiality(id, "vertraulich", ada.id);
    const antwort = await veroeffentlichen(clara.token, id, 1, "hervorgehoben");
    expect(antwort.json()).toMatchObject({ vermerk: { empfaenger: 1 } });
    expect(await veroeffentlichungsMeldungen(ada.token)).toHaveLength(1);
    for (const wer of [erik, vera, fiona]) {
      expect(await veroeffentlichungsMeldungen(wer.token)).toEqual([]);
      expect((await auf(wer.token, "GET", `/api/kos/${id}`)).statusCode).toBe(404);
    }
  });

  it("wird der Zugriff nach dem Veröffentlichen entzogen, verschwindet auch die Meldung", async () => {
    const id = await gueltigerEintrag();
    expect((await veroeffentlichen(clara.token, id, 1, "hervorgehoben")).statusCode).toBe(201);
    expect(await veroeffentlichungsMeldungen(erik.token)).toHaveLength(1);
    await services.ko.setConfidentiality(id, "vertraulich", ada.id);
    expect(await veroeffentlichungsMeldungen(erik.token)).toEqual([]);
    expect(await veroeffentlichungsMeldungen(ada.token)).toHaveLength(1);
  });

  it("ein Konto, das erst nach der Veröffentlichung angelegt wurde, bekommt keine Meldung", async () => {
    const id = await gueltigerEintrag();
    versatz = 0; // Veröffentlichung JETZT, das neue Konto entsteht danach
    expect((await veroeffentlichen(clara.token, id, 1, "normal")).statusCode).toBe(201);
    await new Promise((weiter) => setTimeout(weiter, 5));
    const neu = await konto("viewer", "nora@veroeffentlichung.test", "Nora Neu");
    expect(await veroeffentlichungsMeldungen(neu.token)).toEqual([]);
    // Gegenprobe: ein vorher bestehendes Konto mit derselben Rolle bekommt sie.
    expect(await veroeffentlichungsMeldungen(vera.token)).toHaveLength(1);
  });
});

// Ben, Nacharbeit 8 — zwei Gegenproben zur erklärten Wirkung.
//   GEGENPROBEN (benannt, nicht gefahren):
//   · `meldungenFuer` wieder aus allen Belegen statt aus den Zustellungen des Kontos lesen → der
//     Fall „spätere Rechteerteilung" wird rot (Erik bekommt die alte Meldung).
//   · Ein globales Fenster vor dem Ausschluss stiller/fremder Veröffentlichungen → der Fall
//     „über 100 weitere Veröffentlichungen" wird rot (die hervorgehobene Meldung fehlt).
describe("K1/K3 · der tatsächliche Kreis ist der angekündigte — und nichts verdrängt „hervorgehoben“", () => {
  it("spätere Rechteerteilung an ein Bestandskonto öffnet keine alte Veröffentlichungsmeldung", async () => {
    const id = await gueltigerEintrag("Vertrauliche Abschaltfolge");
    await services.ko.setConfidentiality(id, "vertraulich", ada.id);
    const angekuendigt = (await stand(clara.token, id)).empfaenger?.map((k) => k.id) ?? [];
    expect(angekuendigt).toEqual([ada.id]);
    const antwort = await veroeffentlichen(clara.token, id, 1, "hervorgehoben");
    expect(antwort.json()).toMatchObject({ vermerk: { empfaenger: 1 } });

    // Erik bekommt NACH der Veröffentlichung Leserechte (Rolle mit Freigaberecht).
    const hoch = await app.inject({
      method: "PUT",
      url: `/api/users/${erik.id}`,
      headers: { authorization: `Bearer ${ada.token}` },
      payload: { role: "controller" },
    });
    expect(hoch.statusCode).toBeLessThan(300);
    expect((await auf(erik.token, "GET", `/api/kos/${id}`)).statusCode).toBe(200);

    // Er war nicht im angekündigten Kreis — die alte Meldung erreicht ihn nicht.
    expect(await veroeffentlichungsMeldungen(erik.token)).toEqual([]);
    expect(await veroeffentlichungsMeldungen(ada.token)).toHaveLength(1);
    // Am lesbaren Objekt steht nur die Anzahl des Kreises, keine Kennungen.
    const gelesen = (await auf(erik.token, "GET", `/api/kos/${id}`)).json() as {
      veroeffentlichungen?: Array<{ empfaenger: unknown }>;
    };
    expect(gelesen.veroeffentlichungen?.map((v) => v.empfaenger)).toEqual([1]);
  });

  it("über 100 weitere stille und gewöhnliche Veröffentlichungen verdrängen „hervorgehoben“ nicht", async () => {
    const wichtig = await gueltigerEintrag("Wichtige Sperrfassung");
    expect((await veroeffentlichen(clara.token, wichtig, 1, "hervorgehoben")).statusCode).toBe(201);
    for (let i = 0; i < 101; i += 1) {
      versatz += 1_000;
      const still = await gueltigerEintrag(`Stille Fassung ${i}`);
      expect((await veroeffentlichen(clara.token, still, 1, "still")).statusCode).toBe(201);
    }
    for (let i = 0; i < 101; i += 1) {
      versatz += 1_000;
      const normal = await gueltigerEintrag(`Gewöhnliche Fassung ${i}`);
      expect((await veroeffentlichen(clara.token, normal, 1, "normal")).statusCode).toBe(201);
    }
    const feed = await glocke(erik.token);
    // Ungelesen und hervorgehoben: steht oben — trotz 202 jüngerer Veröffentlichungen.
    expect(feed[0]).toMatchObject({
      kind: "veroeffentlichung",
      koId: wichtig,
      hervorgehoben: true,
      seen: false,
    });
    const pub = feed.filter((m) => m.kind === "veroeffentlichung");
    // Die hervorgehobene plus die jüngsten 100 gewöhnlichen; stille erzeugen nichts.
    expect(pub).toHaveLength(101);
    expect(pub.filter((m) => m.hervorgehoben)).toHaveLength(1);
  });
});

// Ben, Nacharbeit 11 — abgelehnte Versuche dürfen gültige Meldungen nicht verdrängen.
//   GEGENPROBEN (benannt, nicht gefahren):
//   · Die Zustellungen wieder VOR `vermerkeVeroeffentlichung` schreiben → der erste Fall wird rot
//     (101 abgelehnte Versuche lassen Eriks gültige Meldung aus dem Fenster fallen).
//   · Das Entfernen verwaister Zeilen in `meldungenFuer` weglassen → der zweite Fall wird rot.
describe("K3 · abgelehnte oder gescheiterte Veröffentlichungen verdrängen keine gültige Meldung", () => {
  it("101 abgelehnte Normal-Veröffentlichungen hinterlassen keine Zustellung", async () => {
    const gueltige = await gueltigerEintrag("Gültige Meldung Kühlkreislauf");
    expect((await veroeffentlichen(clara.token, gueltige, 1, "normal")).statusCode).toBe(201);
    const schon = await gueltigerEintrag("Schon veröffentlichte Fassung");
    expect((await veroeffentlichen(clara.token, schon, 1, "normal")).statusCode).toBe(201);
    for (let i = 0; i < 101; i += 1) {
      versatz += 1_000;
      const abgelehnt = await veroeffentlichen(clara.token, schon, 1, "normal");
      expect(abgelehnt.statusCode).toBe(409);
      expect(abgelehnt.json()).toMatchObject({ grund: "bereits_veroeffentlicht" });
    }
    const meldungen = await veroeffentlichungsMeldungen(erik.token);
    expect(meldungen.map((m) => m.koId).sort()).toEqual([gueltige, schon].sort());
    // Am Bestand: genau die zwei gültigen Zustellungen — kein abgelehnter Versuch hat geschrieben.
    expect(await services.veroeffentlichungsZustellungen.fuer(erik.id, 1_000)).toHaveLength(2);
  });

  it("bereits verwaiste Zeilen werden beim Abruf entfernt und belegen das Fenster nicht", async () => {
    const gueltige = await gueltigerEintrag("Gültige Meldung Druckluft");
    expect((await veroeffentlichen(clara.token, gueltige, 1, "normal")).statusCode).toBe(201);
    // Altbestand eines früheren Fehlers: 101 jüngere Zustellungen ohne Vermerk am Eintrag.
    await services.veroeffentlichungsZustellungen.anlegen(
      Array.from({ length: 101 }, (_, i) => ({
        vermerkId: `verwaist-${i}`,
        koId: gueltige,
        empfaengerId: erik.id,
        am: new Date(Date.now() + versatz + (i + 1) * 1_000).toISOString(),
        hervorgehoben: false,
      })),
    );
    const meldungen = await veroeffentlichungsMeldungen(erik.token);
    expect(meldungen.map((m) => m.koId)).toEqual([gueltige]);
    expect(await services.veroeffentlichungsZustellungen.fuer(erik.id, 1_000)).toHaveLength(1);
  });
});

describe("K4 · Entwurf und veröffentlichte Fassung eindeutig; Rechte und Prüfregeln wirken", () => {
  it("nur mit Freigaberecht: Experte und Leser dürfen nicht veröffentlichen", async () => {
    const id = await gueltigerEintrag();
    for (const wer of [erik, vera, fiona]) {
      expect((await veroeffentlichen(wer.token, id, 1, "normal")).statusCode).toBe(403);
    }
    expect((await stand(clara.token, id)).verlauf).toEqual([]);
    expect(
      (await app.inject({ method: "POST", url: `/api/kos/${id}/veroeffentlichung` })).statusCode,
    ).toBe(401);
  });

  it("ein Entwurf wird nicht veröffentlicht; eine veraltete Fassung auch nicht", async () => {
    const id = await eintrag("Entwurf ohne Prüfung");
    const entwurf = await veroeffentlichen(clara.token, id, 1, "normal");
    expect(entwurf.statusCode).toBe(409);
    expect(entwurf.json()).toMatchObject({ grund: "keine_gueltige_fassung" });

    await gueltig(id);
    await services.ko.revise(id, { statement: "Fassung 2: geänderter Prüfdruck." }, ada.id);
    await gueltig(id);
    const veraltet = await veroeffentlichen(clara.token, id, 1, "normal");
    expect(veraltet.statusCode).toBe(409);
    expect(veraltet.json()).toMatchObject({ grund: "fassung_veraltet", aktuelleFassung: 2 });
    expect(await veroeffentlichungsMeldungen(erik.token)).toEqual([]);
  });

  it("nach einer Überarbeitung bleibt V1 die veröffentlichte, V2 ist erkennbar Entwurf", async () => {
    const id = await gueltigerEintrag();
    expect((await veroeffentlichen(clara.token, id, 1, "normal")).statusCode).toBe(201);
    const ueberarbeitet = await services.ko.revise(
      id,
      { statement: "Fassung 2: Entwurf mit neuer Haltezeit." },
      erik.id,
    );
    expect(ueberarbeitet.status).toBe("offen");
    const leser = await stand(vera.token, id);
    expect(leser).toMatchObject({
      aktuelleFassung: 2,
      gueltig: false,
      veroeffentlichteFassung: 1,
      aktuelleIstVeroeffentlicht: false,
    });
    expect((await stand(clara.token, id)).hinderungsgrund).toBe("keine_gueltige_fassung");
    const versuch = await veroeffentlichen(clara.token, id, 2, "normal");
    expect(versuch.statusCode).toBe(409);
    expect(versuch.json()).toMatchObject({ grund: "keine_gueltige_fassung" });
  });

  it("das Veröffentlichen ändert weder Status, Fassung, Verlauf noch Einstufung", async () => {
    const id = await gueltigerEintrag();
    const vorher = await services.ko.get(id);
    expect((await veroeffentlichen(clara.token, id, 1, "hervorgehoben")).statusCode).toBe(201);
    const nachher = await services.ko.get(id);
    expect(nachher?.status).toBe(vorher?.status);
    expect(nachher?.version).toBe(vorher?.version);
    expect(nachher?.history).toEqual(vorher?.history);
    expect(nachher?.confidentiality).toBe(vorher?.confidentiality);
    expect(nachher?.trust).toBe(vorher?.trust);
  });

  it("ein unsichtbarer Eintrag ist an beiden Türen 404; eine unbekannte Wahl ist 400", async () => {
    const id = await gueltigerEintrag("Vertraulicher Eintrag");
    await services.ko.setConfidentiality(id, "vertraulich", ada.id);
    expect((await auf(erik.token, "GET", `/api/kos/${id}/veroeffentlichung`)).statusCode).toBe(404);
    const offen = await gueltigerEintrag("Offener Eintrag");
    const laut = await veroeffentlichen(clara.token, offen, 1, "laut");
    expect(laut.statusCode).toBe(400);
    expect((await stand(clara.token, offen)).verlauf).toEqual([]);
  });
});

describe("K5 · still schaltet eine angeforderte Kenntnisnahme nicht unbemerkt aus", () => {
  it("still lässt die offene Kenntnisnahme samt Glockenmeldung bestehen und nennt sie", async () => {
    const id = await gueltigerEintrag();
    const anforderung = await auf(clara.token, "POST", `/api/kos/${id}/kenntnisnahmen`, {
      fassung: 1,
      empfaenger: [erik.id],
    });
    expect(anforderung.statusCode).toBe(201);
    expect((await stand(clara.token, id)).kenntnisnahmen).toEqual({ offen: 1, ueberholt: 0 });

    const still = await veroeffentlichen(clara.token, id, 1, "still");
    expect(still.statusCode).toBe(201);
    expect(still.json()).toMatchObject({ kenntnisnahmen: { offen: 1, ueberholt: 0 } });

    const meldungen = await glocke(erik.token);
    expect(meldungen.filter((m) => m.kind === "kenntnisnahme")).toHaveLength(1);
    expect(meldungen.filter((m) => m.kind === "veroeffentlichung")).toEqual([]);
    const meine = (await auf(erik.token, "GET", "/api/kenntnisnahmen/meine")).json() as {
      eintraege: Array<{ status: string; fassung: number }>;
    };
    expect(meine.eintraege).toEqual([
      expect.objectContaining({ status: "ausstehend", fassung: 1 }),
    ]);
  });

  it("eine stille Aktualisierung nennt die durch sie überholten Kenntnisnahmen ausdrücklich", async () => {
    const id = await gueltigerEintrag();
    await auf(clara.token, "POST", `/api/kos/${id}/kenntnisnahmen`, {
      fassung: 1,
      empfaenger: [erik.id, vera.id],
    });
    expect((await veroeffentlichen(clara.token, id, 1, "still")).statusCode).toBe(201);
    await services.ko.revise(id, { statement: "Fassung 2: neue Grenzwerte." }, ada.id);
    await gueltig(id);
    const vorschau = await stand(clara.token, id);
    expect(vorschau.kenntnisnahmen).toEqual({ offen: 0, ueberholt: 2 });
    const update = await veroeffentlichen(clara.token, id, 2, "still");
    expect(update.json()).toMatchObject({
      vermerk: { art: "aktualisierung", meldung: "still" },
      kenntnisnahmen: { offen: 0, ueberholt: 2 },
    });
  });
});

describe("K6 · neue Veröffentlichung und Aktualisierung getrennt, je mit passender Rolle", () => {
  it("neu durch Controllerin, Aktualisierung durch Admin nach Überarbeitung einer Expertin", async () => {
    const id = await gueltigerEintrag("Anfahrprozedur Pumpe 3");

    // NEUE VERÖFFENTLICHUNG — Controllerin, normal.
    const neu = await veroeffentlichen(clara.token, id, 1, "normal");
    expect(neu.statusCode).toBe(201);
    expect(neu.json()).toMatchObject({ vermerk: { art: "neu", fassung: 1, meldung: "normal" } });
    expect(await veroeffentlichungsMeldungen(fiona.token)).toEqual([
      expect.objectContaining({ koId: id, art: "neu", fassung: 1, hervorgehoben: false }),
    ]);

    // Überarbeitung durch einen Experten → V2 ist Entwurf; er darf sie nicht veröffentlichen.
    versatz += STUNDE;
    await services.ko.revise(id, { statement: "Fassung 2: Vorwärmen 10 Minuten." }, erik.id);
    expect((await veroeffentlichen(erik.token, id, 2, "normal")).statusCode).toBe(403);
    await gueltig(id);
    expect((await veroeffentlichen(erik.token, id, 2, "normal")).statusCode).toBe(403);

    // AKTUALISIERUNG — Admin, hervorgehoben.
    const vorschau = await stand(ada.token, id);
    expect(vorschau).toMatchObject({ art: "aktualisierung", hinderungsgrund: null });
    const update = await veroeffentlichen(ada.token, id, 2, "hervorgehoben");
    expect(update.statusCode).toBe(201);
    expect(update.json()).toMatchObject({
      vermerk: { art: "aktualisierung", fassung: 2, meldung: "hervorgehoben" },
    });

    // Fiona: beide Meldungen, die Aktualisierung hervorgehoben oben.
    const fionas = await veroeffentlichungsMeldungen(fiona.token);
    expect(fionas.map((m) => [m.art, m.fassung, m.hervorgehoben])).toEqual([
      ["aktualisierung", 2, true],
      ["neu", 1, false],
    ]);
    // Clara bekommt jetzt die Aktualisierung (nicht ihre eigene neue Veröffentlichung); Ada nicht
    // ihre eigene Aktualisierung.
    expect((await veroeffentlichungsMeldungen(clara.token)).map((m) => m.art)).toEqual([
      "aktualisierung",
    ]);
    expect((await veroeffentlichungsMeldungen(ada.token)).map((m) => m.art)).toEqual(["neu"]);

    // Der Verlauf trägt beide, neueste zuerst — die Überarbeitung hat den ersten Vermerk behalten.
    const verlauf = (await stand(vera.token, id)).verlauf;
    expect(verlauf.map((v) => [v.fassung, v.art, v.meldung, v.von.name])).toEqual([
      [2, "aktualisierung", "hervorgehoben", "Ada Admin"],
      [1, "neu", "normal", "Clara Controller"],
    ]);
  });
});
