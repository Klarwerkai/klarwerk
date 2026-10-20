// ================================================================================================
// produkt:20261011:assistenz-lernen-hostfortsetzung · BPA-06 — LAUF ÜBER DEN AKTIONSKERN.
// ================================================================================================
//
// Am ECHTEN Server (`buildApp(assembleServices(inMemoryRepos()))`, `app.inject`), dieselbe
// Vorrichtung wie `tests/klara-aktionen/auftragsgrenze-am-server.test.ts`:
//   1. Zwei Vorführungen in Klarwerk-Web → Lernnotiz → bestätigte persönliche Funktion
//      (`assistenz-lernen.ts`), Laufplan mit neuen Eingaben (`planeLauf`).
//   2. Die Brücke (`assistenz-lernen-auftrag.ts`) übersetzt den Plan in einen Klara-Auftrag.
//   3. Angelegt und ausgeführt wird über die VORHANDENEN Routen des Aktionskerns (Klara 05):
//      `POST …/auftraege`, `POST …/schritte/:schluessel/ausfuehrung` — der Entwurfsweg legt den
//      Bericht mit den Rechten der Person an; nachgelesen über `GET /api/drafts/:id`.
//
// GRENZEN: Klarwerk-Web ist der einzige Host dieses Wegs; Word/Finder/Chrome nicht. Die
// `rechte`-Angabe in `planeLauf` stellt hier der Test; wirksam geprüft wird das Recht vom
// vorhandenen Entwurfsweg (Fall „viewer“). Fiktive Konten und Daten, kein Modell.
import { beforeEach, describe, expect, it } from "vitest";
import {
  type Bindung,
  type HostEreignis,
  type LaufAnfrage,
  type LernFreigabe,
  type PersoenlicheFunktion,
  type Ziel,
  beendeLernen,
  beginneLernen,
  bestaetige,
  entwerfeLernnotiz,
  naechsteVorfuehrung,
  nimmAuf,
  planeLauf,
} from "../../services/app/src/assistenz-lernen";
import {
  HOST_KLARWERK_WEB,
  alsKlaraAuftrag,
  pruefeEntwurf,
} from "../../services/app/src/assistenz-lernen-auftrag";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import type { KlaraAuftrag } from "../../services/app/src/klara-auftrag";

type App = ReturnType<typeof buildApp>;
type Konto = { id: string; token: string };

let app: App;
let erik: Konto;
let vera: Konto;

const BASIS = "/api/me/klara";
const ZIELOBJEKT = { kennung: "klarwerk:erfassung", fassung: "neu" };
const RECHT_AM_ZIEL = { objekt: ZIELOBJEKT.kennung, fassung: ZIELOBJEKT.fassung };
const FREIGABE: LernFreigabe = {
  anwendungen: ["Klarwerk"],
  ausgeschlosseneFelder: [],
  fensterbild: false,
  abbruchRegel: "rohdaten_verwerfen",
};
const Z = {
  titel: { rolle: "textbox", name: "Titel" },
  kernaussage: { rolle: "textbox", name: "Kernaussage" },
  // Ein Ordnungsfeld des Entwurfs: wird strukturiert gesetzt (Nacharbeit 31).
  kategorie: { rolle: "combobox", name: "Kategorie" },
  // Keine Auswahl, die ein Klarwerk-Entwurf kennt: der Lauf muss davor anhalten.
  region: { rolle: "combobox", name: "Region" },
  speichern: { rolle: "button", name: "Entwurf speichern" },
} satisfies Record<string, Ziel>;
const HOST = {
  kennung: HOST_KLARWERK_WEB,
  anwendung: "Klarwerk",
  hostVersion: "web-1",
  ziele: [Z.titel, Z.kernaussage, Z.kategorie, Z.region, Z.speichern],
};

const auf = (wer: string, methode: "GET" | "POST", url: string, payload?: unknown) =>
  app.inject({
    method: methode,
    url,
    headers: { authorization: `Bearer ${wer}` },
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });

async function anmelden(email: string): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode, login.body).toBe(200);
  return (login.json() as { token: string }).token;
}

async function konto(adminToken: string, rolle: string, email: string): Promise<Konto> {
  const angelegt = await auf(adminToken, "POST", "/api/users", {
    name: `Fiktiv ${rolle}`,
    email,
    password: "secret123",
    role: rolle,
  });
  expect(angelegt.statusCode, angelegt.body).toBe(201);
  return { id: (angelegt.json() as { id: string }).id, token: await anmelden(email) };
}

function ev(art: HostEreignis["art"], ziel: Ziel, wert?: string): HostEreignis {
  return {
    anwendung: "Klarwerk",
    fenster: "/erfassen",
    art,
    ziel,
    ...(wert === undefined ? {} : { wert }),
    zeitpunkt: "2026-10-12T08:00:00+02:00",
  };
}

function bericht(titel: string, kernaussage: string, auswahl: [Ziel, string]): HostEreignis[] {
  return [
    ev("eingabe", Z.titel, titel),
    ev("eingabe", Z.kernaussage, kernaussage),
    ev("auswahl", auswahl[0], auswahl[1]),
    ev("speichern", Z.speichern),
  ];
}

/** Lernen, Lernnotiz, Bestätigung — als die Person `wer` in Klarwerk-Web. */
function funktionVon(
  wer: Konto,
  host = HOST_KLARWERK_WEB,
  auswahl: [Ziel, string] = [Z.kategorie, "Bericht"],
): PersoenlicheFunktion {
  const bindung: Bindung = {
    mandant: "mandant-test",
    nutzer: wer.id,
    sitzung: "lern-sitzung",
    host,
    hostVersion: "web-1",
    anwendung: "Klarwerk",
    fenster: "/erfassen",
    zeitpunkt: "2026-10-12T08:00:00+02:00",
  };
  const text = "Verfolge, wie ich diesen Bericht erstelle.";
  const beginn = beginneLernen("l1", text, bindung, FREIGABE);
  if (!beginn.ok) {
    throw new Error(beginn.text);
  }
  let s = beginn.sitzung;
  for (const e of bericht("Wochenbericht KW41", "Umsatz stabil", auswahl)) {
    s = nimmAuf(s, e);
  }
  s = naechsteVorfuehrung(s);
  for (const e of bericht("Wochenbericht KW42", "Umsatz gestiegen", auswahl)) {
    s = nimmAuf(s, e);
  }
  const notiz = entwerfeLernnotiz(beendeLernen(s));
  if ("fehler" in notiz) {
    throw new Error(notiz.fehler);
  }
  const f = bestaetige("funktion-bericht", notiz, {
    person: wer.id,
    am: "2026-10-12T09:00:00+02:00",
    erlaubteWirkungen: ["eingeben", "speichern"],
    zeitplan: null,
    objekt: ZIELOBJEKT.kennung,
  });
  if ("fehler" in f) {
    throw new Error(f.fehler);
  }
  return f;
}

function anfrage(f: PersoenlicheFunktion, mehr: Partial<LaufAnfrage> = {}): LaufAnfrage {
  return {
    lauf: "lauf-1",
    version: f.version,
    person: f.eigentuemer,
    mandant: "mandant-test",
    sitzung: "sitzung-1",
    eingaben: { titel: "Wochenbericht KW43", kernaussage: "Umsatz gehalten" },
    host: { ...HOST, kennung: f.bindung.host },
    objekt: ZIELOBJEKT,
    rechte: { ...RECHT_AM_ZIEL, beobachten: true, schreiben: true },
    bestaetigungen: [],
    ...mehr,
  };
}

async function gespraech(wer: Konto): Promise<string> {
  const bezug = { pfad: "/erfassen", seitenName: "Erfassen", objekt: "Neuer Entwurf" };
  const r = await auf(wer.token, "POST", `${BASIS}/gespraeche`, { objektbezug: bezug });
  expect(r.statusCode, r.body).toBe(201);
  return (r.json() as { gespraech: { id: string } }).gespraech.id;
}

type SchrittAntwort = {
  auftrag: KlaraAuftrag;
  schritt: KlaraAuftrag["schritte"][number];
  wiederholt: boolean;
};

/** Plan → Brücke → vorhandener Aktionskern: anlegen und Schritt 1 ausführen. */
async function laufUeberAktionskern(wer: Konto, f: PersoenlicheFunktion) {
  const plan = planeLauf(f, anfrage(f));
  expect(plan.stand).toBe("vollstaendig");
  const bruecke = alsKlaraAuftrag(f, plan);
  if (!bruecke.ok) {
    throw new Error(bruecke.text);
  }
  const gid = await gespraech(wer);
  const auftraege = `${BASIS}/gespraeche/${gid}/auftraege`;
  const angelegt = await auf(wer.token, "POST", auftraege, bruecke.eingabe);
  expect(angelegt.statusCode, angelegt.body).toBe(201);
  const auftrag = (angelegt.json() as { auftrag: KlaraAuftrag }).auftrag;
  const pfad = `${auftraege}/${auftrag.id}/schritte/bericht-1/ausfuehrung`;
  const ausfuehren = () => auf(wer.token, "POST", pfad, { nr: 1, auftragFassung: auftrag.fassung });
  const erster = await ausfuehren();
  expect(erster.statusCode, erster.body).toBe(200);
  return { plan, auftrag, erster: erster.json() as SchrittAntwort, ausfuehren };
}

beforeEach(async () => {
  app = buildApp(assembleServices(inMemoryRepos()));
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Fiktiv Admin", email: "admin@bpa06-lauf.test", password: "secret123" },
  });
  const admin = await anmelden("admin@bpa06-lauf.test");
  erik = await konto(admin, "experte", "erik@bpa06-lauf.test");
  vera = await konto(admin, "viewer", "vera@bpa06-lauf.test");
});

describe("BPA-06 · bestätigte Funktion läuft über den vorhandenen Aktionskern", () => {
  it("AC04/AC08: Testbericht wird als Entwurf angelegt, nachgelesen und geprüft", async () => {
    const f = funktionVon(erik);
    const { plan, auftrag, erster } = await laufUeberAktionskern(erik, f);
    expect(auftrag).toMatchObject({
      verantwortlich: erik.id,
      erlaubteAktionen: ["entwurf_erstellen"],
      geplanteSchritte: 1,
    });
    expect(erster.schritt).toMatchObject({ nr: 1, aktion: "entwurf_erstellen" });
    expect(erster.schritt.stand).toBe("gespeichert");
    const ergebnis = erster.schritt.ergebnis;
    expect(ergebnis?.art).toBe("entwurf");
    const gelesen = await auf(erik.token, "GET", `/api/drafts/${ergebnis?.id ?? ""}`);
    expect(gelesen.statusCode, gelesen.body).toBe(200);
    const entwurf = gelesen.json() as Parameters<typeof pruefeEntwurf>[1];
    expect(entwurf.payload.title).toBe("Wochenbericht KW43");
    expect(entwurf.payload.statement).toContain("Umsatz gehalten");
    // Die Auswahl steht in IHREM Feld, nicht als Text in der Kernaussage (Nacharbeit 31).
    expect(entwurf.payload.category).toBe("Bericht");
    expect(entwurf.payload.statement).not.toContain("Kategorie");
    // Keine Beispielwerte der Vorführungen im Ergebnis (AC02 im echten Weg).
    expect(JSON.stringify(entwurf.payload)).not.toMatch(/KW41|KW42|stabil|gestiegen/);
    expect(pruefeEntwurf(plan, entwurf)).toEqual({ ok: true, abweichungen: [] });
  });

  it("Wiederholung desselben Schritts legt keinen zweiten Bericht an", async () => {
    const { erster, ausfuehren } = await laufUeberAktionskern(erik, funktionVon(erik));
    const zweiter = await ausfuehren();
    expect(zweiter.statusCode, zweiter.body).toBe(200);
    const antwort = zweiter.json() as SchrittAntwort;
    expect(antwort.wiederholt).toBe(true);
    expect(antwort.schritt.ergebnis?.id).toBe(erster.schritt.ergebnis?.id);
  });

  it("AC08: ohne Schreibrecht lehnt der vorhandene Entwurfsweg ab — kein Bericht", async () => {
    const { erster } = await laufUeberAktionskern(vera, funktionVon(vera));
    expect(erster.schritt).toMatchObject({ stand: "fehlgeschlagen", fehlerCode: "recht" });
    expect(erster.schritt.ergebnis).toBeNull();
  });

  it("AC07: geänderte Hostfassung hält vor dem Aktionskern — kein Auftrag entsteht", () => {
    const f = funktionVon(erik);
    const plan = planeLauf(f, anfrage(f, { host: { ...HOST, hostVersion: "web-2" } }));
    expect(plan).toMatchObject({ stand: "haelt_an", haltBei: 1 });
    expect(alsKlaraAuftrag(f, plan)).toMatchObject({ ok: false, grund: "nicht_freigegeben" });
  });

  it("Finder und Außenwirkungen nicht über diese Brücke; Word seit Nacharbeit 41", () => {
    const finder = funktionVon(erik, "finder");
    const planFinder = planeLauf(finder, anfrage(finder));
    expect(planFinder.stand).toBe("vollstaendig");
    expect(alsKlaraAuftrag(finder, planFinder)).toMatchObject({ ok: false, grund: "anderer_host" });
    // Nacharbeit 41 (Ben zu 32e10b9d): Word läuft über den integrierten Programmadapter (BPA-04);
    // Ziel- und Markierungsprüfung stehen am Rand (`tests/assistenz-lernen/word-routine-am-server`).
    const word = funktionVon(erik, "word-mac");
    const planWord = planeLauf(word, anfrage(word));
    expect(alsKlaraAuftrag(word, planWord)).toMatchObject({ ok: true });
    const f = funktionVon(erik);
    const plan = planeLauf(f, anfrage(f));
    if (plan.stand !== "vollstaendig") {
      throw new Error("Plan erwartet vollständig");
    }
    const senden = { nr: 5, art: "senden" as const, ausfuehrung: "automatisch" as const };
    const mitSenden = { ...plan, schritte: [...plan.schritte, senden] };
    expect(alsKlaraAuftrag(f, mitSenden)).toMatchObject({ ok: false, grund: "aussenwirkung" });
  });

  it("Nacharbeit 31: eine Auswahl ohne Entwurfsfeld hält vor der Ausführung an", () => {
    const f = funktionVon(erik, HOST_KLARWERK_WEB, [Z.region, "Nord"]);
    const plan = planeLauf(f, anfrage(f));
    expect(plan.stand).toBe("vollstaendig");
    const bruecke = alsKlaraAuftrag(f, plan);
    expect(bruecke).toMatchObject({ ok: false, grund: "auswahl_nicht_unterstuetzt" });
    if (!bruecke.ok) {
      expect(bruecke.text).toContain("Region");
    }
  });

  it("Nacharbeit 31: Ergebnisprüfung vergleicht die Auswahl mit ihrem Feld, nicht mit dem Text", () => {
    const f = funktionVon(erik);
    const plan = planeLauf(f, anfrage(f));
    const nurImText = {
      id: "entwurf-x",
      payload: {
        title: "Wochenbericht KW43",
        statement: "Umsatz gehalten\nKategorie: Bericht",
        category: "Vertrieb",
      },
    };
    expect(pruefeEntwurf(plan, nurImText).ok).toBe(false);
    const imFeld = { ...nurImText, payload: { ...nurImText.payload, category: "Bericht" } };
    expect(pruefeEntwurf(plan, imFeld)).toEqual({ ok: true, abweichungen: [] });
  });
});
