// ================================================================================================
// KLARA-OFFICE-02 (produkt:20261010:klara-office-mac-maskottchen) · DER KONTEXTKANAL AM ECHTEN SERVER.
// ================================================================================================
//
// Gemessen über die ECHTE Anwendung (`buildApp(assembleServices(inMemoryRepos()))`, `app.inject`):
// der Office-Adapter (`word-addin/begleiter.js`) meldet sich an und meldet seine Auswahl, die
// Begleitapp (`pages/Begleiter.tsx`) liest den Kontext und beauftragt Word. Alles fiktiv.
//
//   B1  KO-02-05 · Anmelden, Auswahl melden, Kontext lesen: Host, Fassung, Dateiname, Auswahl —
//       und KEINE Dokumentkennung, keine Kontokennung.
//   B2  KO-02-05 · Fremd: eine andere Person sieht kein Fenster, meldet und beauftragt nichts.
//   B3  KO-02-05 · Nicht angemeldet: Meldung und Auftrag an eine unbekannte Kennung → 404.
//   B4  KO-02-05 · Veraltet: gleiche oder kleinere Folgenummer, älterer Auswahlstand → 409, nichts
//       übernommen.
//   B5  KO-02-05 · Rückweg: Einfügen nur für den gesehenen Auswahlstand; der Adapter holt den Auftrag
//       mit der nächsten Meldung und meldet das Ergebnis; eine Frage trägt ihre Antwort zurück.
//   B6  KO-02-04 · Getrennte Dokumentfenster bleiben getrennt: zwei Fenster, zwei Kennungen, je ihr
//       Dokument; ein Auftrag erreicht nur sein Fenster.
//   B7  Ohne Anmeldung: alle fünf Türen 401. Abmelden entfernt das Fenster.
import { beforeEach, describe, expect, it } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;

let app: App;
let erik = "";
let vera = "";

const BASIS = "/api/me/klara/begleiter";
const FENSTER_A = `bgl-${"a".repeat(32)}`;
const FENSTER_B = `bgl-${"b".repeat(32)}`;
const DOK_A = {
  kennung: `url-${"1".repeat(32)}`,
  titel: "Angebot Muster GmbH.docx",
  gespeichert: true,
};
const DOK_B = { kennung: `neu-${"2".repeat(32)}`, titel: "", gespeichert: false };
const AUSWAHL = "Der fiktive Liefertermin ist der 3. Werktag nach Auftragseingang.";

/** Der Rumpf einer Meldung mit Auswahl — so, wie der Adapter ihn schickt. */
function mitAuswahl(seq: number, stand = 1, text = AUSWAHL): Record<string, unknown> {
  return { seq, auswahl: { text, laenge: text.length, stand } };
}

async function anmeldenAlsKonto(email: string): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode).toBe(200);
  return (login.json() as { token: string }).token;
}

async function konto(adminToken: string, rolle: string, email: string, name: string) {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name, email, password: "secret123", role: rolle },
  });
  expect(angelegt.statusCode).toBe(201);
  return anmeldenAlsKonto(email);
}

const auf = (
  wer: string,
  methode: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  payload?: unknown,
) =>
  app.inject({
    method: methode,
    url,
    headers: wer ? { authorization: `Bearer ${wer}` } : {},
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });

interface Aktion {
  id: string;
  art: string;
  stand: string;
  ergebnis: string | null;
  grund: string | null;
}

interface Kontext {
  adapter: Array<{
    instanz: string;
    host: string;
    hostFassung: string;
    dokument: { titel: string; gespeichert: boolean };
    aktiv: boolean;
    auswahl: { text: string; laenge: number; stand: number; gekuerzt: boolean } | null;
    aktionen: Aktion[];
  }>;
}

async function kontext(wer: string): Promise<Kontext> {
  const r = await auf(wer, "GET", `${BASIS}/kontext`);
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as Kontext;
}

async function fensterAnmelden(wer: string, instanz = FENSTER_A, dokument: unknown = DOK_A) {
  const r = await auf(wer, "POST", `${BASIS}/adapter`, {
    instanz,
    host: "word-mac",
    hostFassung: "16.89 (25091415)",
    dokument,
  });
  expect(r.statusCode, r.body).toBe(201);
}

function melden(wer: string, instanz: string, rumpf: Record<string, unknown>) {
  return auf(wer, "PUT", `${BASIS}/adapter/${instanz}`, rumpf);
}

function beauftragen(wer: string, instanz: string, rumpf: Record<string, unknown>) {
  return auf(wer, "POST", `${BASIS}/adapter/${instanz}/aktionen`, rumpf);
}

beforeEach(async () => {
  app = buildApp(assembleServices(inMemoryRepos()));
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@begleiter.test", password: "secret123" },
  });
  const adminToken = await anmeldenAlsKonto("ada@begleiter.test");
  erik = await konto(adminToken, "experte", "erik@begleiter.test", "Erik Experte");
  vera = await konto(adminToken, "viewer", "vera@begleiter.test", "Vera Viewer");
});

describe("B1 · KO-02-05 — der gebundene Kontext kommt vom Office-Adapter", () => {
  it("Anmelden, Auswahl melden, Kontext lesen — mit Host, Fassung und Dateiname", async () => {
    expect((await kontext(erik)).adapter).toEqual([]);
    await fensterAnmelden(erik);
    const ohne = await kontext(erik);
    expect(ohne.adapter).toHaveLength(1);
    expect(ohne.adapter[0]?.aktiv).toBe(true);
    // Angemeldet, aber noch keine Meldung: keine Auswahl.
    expect(ohne.adapter[0]?.auswahl).toBeNull();

    const r = await melden(erik, FENSTER_A, mitAuswahl(1));
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toEqual({ aktionen: [] });

    const k = await kontext(erik);
    expect(k.adapter[0]).toMatchObject({
      instanz: FENSTER_A,
      host: "word-mac",
      hostFassung: "16.89 (25091415)",
      dokument: { titel: "Angebot Muster GmbH.docx", gespeichert: true },
      aktiv: true,
      auswahl: { text: AUSWAHL, laenge: AUSWAHL.length, stand: 1, gekuerzt: false },
    });
    // Die Dokumentkennung (Prüfsumme der Adresse) geht nicht an die Begleitapp hinaus.
    expect(JSON.stringify(k)).not.toContain(DOK_A.kennung);
  });

  it("eine gekürzte Auswahl sagt es — die volle Länge reist mit", async () => {
    await fensterAnmelden(erik);
    const teil = "x".repeat(4000);
    const r = await melden(erik, FENSTER_A, {
      seq: 1,
      auswahl: { text: teil, laenge: 9000, stand: 1 },
    });
    expect(r.statusCode, r.body).toBe(200);
    const k = await kontext(erik);
    expect(k.adapter[0]?.auswahl).toMatchObject({ laenge: 9000, gekuerzt: true });
  });

  it("weist ungeprüfte Eingaben ab: Kennung, Host, Dokument, Steuerzeichen, Länge", async () => {
    const adresse = { ...DOK_A, kennung: "https://x/y.docx" };
    const widerspruch = { ...DOK_A, gespeichert: false };
    const schlecht = [
      { instanz: "inst-123", host: "word-mac", dokument: DOK_A },
      { instanz: FENSTER_A, host: "excel", dokument: DOK_A },
      { instanz: FENSTER_A, host: "word-mac", dokument: adresse },
      { instanz: FENSTER_A, host: "word-mac", dokument: widerspruch },
    ];
    for (const rumpf of schlecht) {
      const r = await auf(erik, "POST", `${BASIS}/adapter`, rumpf);
      expect(r.statusCode, JSON.stringify(rumpf)).toBe(400);
    }
    await fensterAnmelden(erik);
    const steuer = await melden(erik, FENSTER_A, mitAuswahl(1, 1, "a\u0000b"));
    expect(steuer.statusCode).toBe(400);
    const lang = await melden(erik, FENSTER_A, mitAuswahl(1, 1, "y".repeat(4001)));
    expect(lang.statusCode).toBe(400);
    // Nach den abgewiesenen Meldungen ist NICHTS übernommen — die Nummer 1 gilt noch.
    expect((await melden(erik, FENSTER_A, { seq: 1, auswahl: null })).statusCode).toBe(200);
  });
});

describe("B2 · KO-02-05 — fremde Nachrichten werden abgewiesen", () => {
  it("eine andere Person sieht das Fenster nicht, meldet und beauftragt nichts", async () => {
    await fensterAnmelden(erik);
    await melden(erik, FENSTER_A, mitAuswahl(1));

    expect((await kontext(vera)).adapter).toEqual([]);
    const fremdMelden = await melden(vera, FENSTER_A, { seq: 2, auswahl: null, auswahlStand: 1 });
    expect(fremdMelden.statusCode).toBe(404);
    expect(fremdMelden.json()).toMatchObject({ grund: "nicht_angemeldet" });
    const fremdAuftrag = await beauftragen(vera, FENSTER_A, {
      art: "einfuegen",
      text: "Fremder Text",
      auswahlStand: 1,
    });
    expect(fremdAuftrag.statusCode).toBe(404);
    // Erik ist unberührt: seine Auswahl steht, kein Auftrag ist entstanden.
    const k = await kontext(erik);
    expect(k.adapter[0]?.auswahl?.text).toBe(AUSWAHL);
    expect(k.adapter[0]?.aktionen).toEqual([]);
  });
});

describe("B3 · KO-02-05 — nicht angemeldete Nachrichten werden abgewiesen", () => {
  it("Meldung, Auftrag und Abmeldung an eine unbekannte Kennung bleiben wirkungslos", async () => {
    const r = await melden(erik, FENSTER_B, { seq: 1, auswahl: null });
    expect(r.statusCode).toBe(404);
    expect(r.json()).toMatchObject({ grund: "nicht_angemeldet" });
    const a = await beauftragen(erik, FENSTER_B, {
      art: "frage",
      text: "Was steht hier?",
      auswahlStand: 0,
    });
    expect(a.statusCode).toBe(404);
    const d = await auf(erik, "DELETE", `${BASIS}/adapter/${FENSTER_B}`);
    expect(d.statusCode).toBe(200);
    expect(d.json()).toEqual({ abgemeldet: false });
  });
});

describe("B4 · KO-02-05 — veraltete Nachrichten werden abgewiesen", () => {
  it("gleiche oder kleinere Folgenummer, älterer Auswahlstand → 409, der Stand bleibt", async () => {
    await fensterAnmelden(erik);
    expect((await melden(erik, FENSTER_A, mitAuswahl(5, 3))).statusCode).toBe(200);
    for (const seq of [5, 4]) {
      const alt = await melden(erik, FENSTER_A, mitAuswahl(seq, 4, "Veralteter Text"));
      expect(alt.statusCode).toBe(409);
      expect(alt.json()).toMatchObject({ grund: "veraltet" });
    }
    const aelter = await melden(erik, FENSTER_A, mitAuswahl(6, 2, "Älterer Stand"));
    expect(aelter.statusCode).toBe(409);
    const k = await kontext(erik);
    expect(k.adapter[0]?.auswahl).toMatchObject({ text: AUSWAHL, stand: 3 });
  });
});

describe("B5 · KO-02-05 — dokumentbezogene Aktionen laufen über den Adapter zurück", () => {
  const passage = {
    text: "Guest Wi-Fi must not provide access to the internal staff network.",
    stand: 2,
  };
  const frageZurPassage = {
    art: "frage",
    text: "Is this correct?",
    auswahlStand: passage.stand,
    pruefpassage: passage.text,
    locale: "en",
  };
  const meldung = { seq: 1, auswahl: null, auswahlStand: passage.stand, passage };

  it("die App prüft ohne Markierung exakt den angezeigten Wortlaut des eigenen Fensters", async () => {
    await fensterAnmelden(erik);
    await melden(erik, FENSTER_A, meldung);
    expect((await kontext(erik)).adapter[0]).toMatchObject({ auswahl: null, passage });
    expect((await kontext(vera)).adapter).toEqual([]);
    const auftrag = await beauftragen(erik, FENSTER_A, frageZurPassage);
    expect(auftrag.statusCode).toBe(202);
    const abgeholt = await melden(erik, FENSTER_A, { ...meldung, seq: 2 });
    expect(abgeholt.json()).toMatchObject({ aktionen: [frageZurPassage] });
  });

  it("eine geänderte oder entfernte Vorschau kann nicht beauftragt oder nachträglich abgeholt werden", async () => {
    await fensterAnmelden(erik);
    await melden(erik, FENSTER_A, meldung);
    for (const abweichung of [{ auswahlStand: 1 }, { pruefpassage: "Guest Wi-Fi is allowed." }]) {
      expect(
        (await beauftragen(erik, FENSTER_A, { ...frageZurPassage, ...abweichung })).statusCode,
      ).toBe(409);
    }
    expect((await beauftragen(erik, FENSTER_A, frageZurPassage)).statusCode).toBe(202);
    expect((await melden(erik, FENSTER_A, { ...meldung, seq: 2, passage: null })).json()).toEqual({
      aktionen: [],
    });
    const sicht = (await kontext(erik)).adapter[0];
    expect(sicht).not.toHaveProperty("passage");
    expect(sicht?.aktionen[0]).toMatchObject({ stand: "abgelehnt", grund: "veraltet" });
    expect((await beauftragen(erik, FENSTER_A, frageZurPassage)).statusCode).toBe(409);
  });

  it("zeigt auch bei einer fehlerhaften Adapterantwort keinen Befund zu einem anderen Satz", async () => {
    await fensterAnmelden(erik);
    await melden(erik, FENSTER_A, meldung);
    const auftrag = await beauftragen(erik, FENSTER_A, frageZurPassage);
    const { id } = auftrag.json().aktion;
    await melden(erik, FENSTER_A, { ...meldung, seq: 2 });
    const vergleich = {
      art: "offen",
      dokument: "A different passage.",
      belege: [],
      dokumentMarke: null,
      belegMarke: null,
      zeigbar: false,
      aiGenerated: false,
    };
    await melden(erik, FENSTER_A, {
      ...meldung,
      seq: 3,
      erledigt: [{ id, stand: "erledigt", ergebnis: "No result", vergleich }],
    });
    const aktion = (await kontext(erik)).adapter[0]?.aktionen[0];
    expect(aktion).toMatchObject({
      stand: "abgelehnt",
      grund: "passage_geaendert",
      ergebnis: null,
    });
    expect(aktion).not.toHaveProperty("vergleich");
  });

  it("ein neu angemeldetes Dokument übernimmt keine alte Vorschauprüfung bei gleichem Text und Stand", async () => {
    await fensterAnmelden(erik);
    await melden(erik, FENSTER_A, meldung);
    await beauftragen(erik, FENSTER_A, frageZurPassage);
    await fensterAnmelden(erik, FENSTER_A, DOK_B);
    expect((await melden(erik, FENSTER_A, meldung)).json()).toEqual({ aktionen: [] });
    expect((await kontext(erik)).adapter[0]?.aktionen[0]).toMatchObject({ stand: "abgelehnt" });
  });

  it("lehnt überlange Vorschauen und eine vom gemeldeten Auswahlstand abweichende Passage atomar ab", async () => {
    await fensterAnmelden(erik);
    for (const kaputt of [
      { ...passage, stand: 1 },
      { ...passage, text: "x".repeat(2001) },
    ]) {
      expect((await melden(erik, FENSTER_A, { ...meldung, passage: kaputt })).statusCode).toBe(400);
    }
    expect((await melden(erik, FENSTER_A, meldung)).statusCode).toBe(200);
  });

  it("Einfügen gilt nur für den gesehenen Auswahlstand und kommt mit Ergebnis zurück", async () => {
    await fensterAnmelden(erik);
    await melden(erik, FENSTER_A, mitAuswahl(1));

    const veraltet = await beauftragen(erik, FENSTER_A, {
      art: "einfuegen",
      text: "Ergänzung",
      auswahlStand: 0,
    });
    expect(veraltet.statusCode).toBe(409);
    expect(veraltet.json()).toMatchObject({ grund: "veraltet" });

    const auftrag = await beauftragen(erik, FENSTER_A, {
      art: "einfuegen",
      text: "Ergänzung aus Klara",
      auswahlStand: 1,
    });
    expect(auftrag.statusCode, auftrag.body).toBe(202);
    const id = (auftrag.json() as { aktion: { id: string } }).aktion.id;
    expect((await kontext(erik)).adapter[0]?.aktionen).toEqual([
      { id, art: "einfuegen", stand: "offen", ergebnis: null, grund: null },
    ]);

    // Der Adapter holt den Auftrag mit seiner nächsten Meldung — genau einmal.
    const holen = await melden(erik, FENSTER_A, mitAuswahl(2));
    expect(holen.json()).toEqual({
      aktionen: [{ id, art: "einfuegen", text: "Ergänzung aus Klara", auswahlStand: 1 }],
    });
    const nochmal = await melden(erik, FENSTER_A, mitAuswahl(3));
    expect(nochmal.json()).toEqual({ aktionen: [] });
    expect((await kontext(erik)).adapter[0]?.aktionen[0]?.stand).toBe("uebergeben");

    // Das Ergebnis kommt mit der nächsten Meldung zurück.
    await melden(erik, FENSTER_A, { ...mitAuswahl(4), erledigt: [{ id, stand: "erledigt" }] });
    expect((await kontext(erik)).adapter[0]?.aktionen[0]).toMatchObject({ id, stand: "erledigt" });
  });

  it("eine Frage geht an Word und trägt die Antwort des Word-Fensters zurück", async () => {
    await fensterAnmelden(erik);
    await melden(erik, FENSTER_A, mitAuswahl(1));
    const auftrag = await beauftragen(erik, FENSTER_A, {
      art: "frage",
      text: "Welcher Liefertermin gilt?",
      auswahlStand: 1,
    });
    expect(auftrag.statusCode).toBe(202);
    const id = (auftrag.json() as { aktion: { id: string } }).aktion.id;
    await melden(erik, FENSTER_A, { seq: 2, auswahl: null, auswahlStand: 2 });
    await melden(erik, FENSTER_A, {
      seq: 3,
      auswahl: null,
      auswahlStand: 2,
      erledigt: [{ id, stand: "erledigt", ergebnis: "Der 3. Werktag (fiktiv)." }],
    });
    const k = await kontext(erik);
    expect(k.adapter[0]?.aktionen[0]).toMatchObject({
      art: "frage",
      stand: "erledigt",
      ergebnis: "Der 3. Werktag (fiktiv).",
    });
    // Eine leere Markierung ist keine Auswahl.
    expect(k.adapter[0]?.auswahl).toBeNull();
  });
});

describe("Direktvergleich zwischen Word und Begleitapp", () => {
  const vergleich = {
    art: "widersprochen",
    dokument: "Guest Wi-Fi must provide access.",
    belege: [
      { text: "Guest Wi-Fi must not provide access.", quellen: ["quelle-1"], woertlich: true },
    ],
    dokumentMarke: { start: 12, end: 24 },
    belegMarke: { start: 17, end: 20 },
    zeigbar: true,
    aiGenerated: true,
  };

  async function frageHolen() {
    await fensterAnmelden(erik);
    const auftrag = await beauftragen(erik, FENSTER_A, {
      art: "frage",
      text: "Is this correct?",
      auswahlStand: 0,
      locale: "en",
    });
    expect(auftrag.statusCode).toBe(202);
    const id = (auftrag.json() as { aktion: { id: string } }).aktion.id;
    const geholt = await melden(erik, FENSTER_A, mitAuswahl(1));
    expect(geholt.json()).toMatchObject({ aktionen: [{ id, art: "frage", locale: "en" }] });
    return id;
  }

  it("transportiert den belegten Vergleich und zeigt die Stelle nur im ursprünglichen Fenster", async () => {
    const id = await frageHolen();
    const zeigen = { art: "zeigen", text: id, auswahlStand: 0 };
    expect((await beauftragen(erik, FENSTER_A, zeigen)).statusCode).toBe(409);
    const ende = await melden(erik, FENSTER_A, {
      ...mitAuswahl(2, 2, "Anderer Absatz"),
      erledigt: [{ id, stand: "erledigt", ergebnis: "Contradicted", vergleich }],
    });
    expect(ende.json()).toMatchObject({ quittiert: [id] });
    expect((await kontext(erik)).adapter[0]?.aktionen[0]).toMatchObject({
      id,
      ergebnis: "Contradicted",
      vergleich,
    });
    await fensterAnmelden(erik, FENSTER_B, DOK_B);
    await fensterAnmelden(vera, FENSTER_A);
    for (const [person, fenster] of [
      [erik, FENSTER_B],
      [vera, FENSTER_A],
    ] as const) {
      const fremd = await beauftragen(person, fenster, zeigen);
      expect(fremd.statusCode).toBe(409);
      expect(fremd.json()).toMatchObject({ grund: "vergleich_nicht_verfuegbar" });
    }
    expect((await beauftragen(erik, FENSTER_A, zeigen)).statusCode).toBe(202);
    const geholt = await melden(erik, FENSTER_A, mitAuswahl(3, 3, "Wieder anderer Absatz"));
    expect(geholt.json()).toMatchObject({ aktionen: [{ art: "zeigen", text: id }] });
    // Selbst eine vor dem Fensterwechsel beauftragte, noch offene Navigation verfällt.
    expect((await beauftragen(erik, FENSTER_A, zeigen)).statusCode).toBe(202);
    await fensterAnmelden(erik, FENSTER_A, DOK_B);
    expect((await melden(erik, FENSTER_A, mitAuswahl(1))).json()).toEqual({ aktionen: [] });
    expect((await beauftragen(erik, FENSTER_A, zeigen)).statusCode).toBe(409);
  });

  it.each([
    [
      "unzulässige Quellenkennung",
      { ...vergleich, belege: [{ ...vergleich.belege[0], quellen: [".."] }] },
    ],
    ["unbelegtes Urteil", { ...vergleich, belege: [] }],
    ["Markierung außerhalb des Texts", { ...vergleich, dokumentMarke: { start: 0, end: 5000 } }],
    [
      "überlanger Belegtext",
      { ...vergleich, belege: [{ ...vergleich.belege[0], text: "x".repeat(8001) }] },
    ],
  ])("bei ungültiger Karte bleibt der Klartext erhalten (%s)", async (_art, karte) => {
    const id = await frageHolen();
    const ende = await melden(erik, FENSTER_A, {
      ...mitAuswahl(2),
      erledigt: [{ id, stand: "erledigt", ergebnis: "Originalantwort", vergleich: karte }],
    });
    expect(ende.json()).toMatchObject({ quittiert: [id] });
    expect((await kontext(erik)).adapter[0]?.aktionen[0]).toEqual({
      id,
      art: "frage",
      stand: "erledigt",
      ergebnis: "Originalantwort",
      grund: null,
    });
  });

  it("überträgt ein offenes Urteil ohne Beleg und erlaubt Zeigen nur bei erhaltenem Word-Bereich", async () => {
    const id = await frageHolen();
    const karte = {
      art: "offen",
      dokument: vergleich.dokument,
      belege: [],
      dokumentMarke: null,
      belegMarke: null,
      zeigbar: false,
    };
    const ende = await melden(erik, FENSTER_A, {
      ...mitAuswahl(2),
      erledigt: [{ id, stand: "erledigt", vergleich: { ...karte, aiGenerated: true } }],
    });
    expect(ende.json()).toMatchObject({ quittiert: [id] });
    expect((await kontext(erik)).adapter[0]?.aktionen[0]).toHaveProperty("vergleich", karte);
    expect(
      (await beauftragen(erik, FENSTER_A, { art: "zeigen", text: id, auswahlStand: 1 })).statusCode,
    ).toBe(409);
  });

  it("ein wahrheitsähnlicher Wert kennzeichnet ein Urteil nicht als KI-generiert", async () => {
    const id = await frageHolen();
    await melden(erik, FENSTER_A, {
      ...mitAuswahl(2),
      erledigt: [{ id, stand: "erledigt", vergleich: { ...vergleich, aiGenerated: "true" } }],
    });
    const a = (await kontext(erik)).adapter[0]?.aktionen[0];
    expect(a).toHaveProperty("vergleich.art", "widersprochen");
    expect(a).not.toHaveProperty("vergleich.aiGenerated");
  });
});

describe("B6 · KO-02-04 — getrennte Dokumentfenster bleiben getrennt", () => {
  it("zwei Fenster, zwei Dokumente; ein Auftrag erreicht nur sein Fenster", async () => {
    await fensterAnmelden(erik, FENSTER_A, DOK_A);
    await fensterAnmelden(erik, FENSTER_B, DOK_B);
    await melden(erik, FENSTER_A, mitAuswahl(1, 1, "Text in A"));
    await melden(erik, FENSTER_B, mitAuswahl(1, 1, "Text in B"));
    const k = await kontext(erik);
    expect(k.adapter.map((a) => [a.instanz, a.dokument.titel, a.auswahl?.text]).sort()).toEqual([
      [FENSTER_A, "Angebot Muster GmbH.docx", "Text in A"],
      [FENSTER_B, "", "Text in B"],
    ]);
    const auftrag = await beauftragen(erik, FENSTER_B, {
      art: "einfuegen",
      text: "Nur für B",
      auswahlStand: 1,
    });
    expect(auftrag.statusCode).toBe(202);
    const a = await melden(erik, FENSTER_A, mitAuswahl(2, 1, "Text in A"));
    expect(a.json()).toEqual({ aktionen: [] });
    const b = await melden(erik, FENSTER_B, mitAuswahl(2, 1, "Text in B"));
    const fuerB = (b.json() as { aktionen: Array<{ text: string }> }).aktionen;
    expect(fuerB.map((x) => x.text)).toEqual(["Nur für B"]);
  });
});

describe("B7 · Anmeldung und Abmeldung", () => {
  it("ohne Anmeldung sind alle fünf Türen zu (401)", async () => {
    const anmeldung = { instanz: FENSTER_A, host: "word-mac", dokument: DOK_A };
    const frage = { art: "frage", text: "x", auswahlStand: 0 };
    const tueren: Array<["GET" | "POST" | "PUT" | "DELETE", string, unknown]> = [
      ["POST", `${BASIS}/adapter`, anmeldung],
      ["PUT", `${BASIS}/adapter/${FENSTER_A}`, { seq: 1 }],
      ["DELETE", `${BASIS}/adapter/${FENSTER_A}`, undefined],
      ["GET", `${BASIS}/kontext`, undefined],
      ["POST", `${BASIS}/adapter/${FENSTER_A}/aktionen`, frage],
    ];
    for (const [methode, url, rumpf] of tueren) {
      const r = await auf("", methode, url, rumpf);
      expect(r.statusCode, `${methode} ${url}`).toBe(401);
    }
  });

  it("Abmelden entfernt das Fenster — danach ist es nicht angemeldet", async () => {
    await fensterAnmelden(erik);
    const d = await auf(erik, "DELETE", `${BASIS}/adapter/${FENSTER_A}`);
    expect(d.json()).toEqual({ abgemeldet: true });
    expect((await kontext(erik)).adapter).toEqual([]);
    expect((await melden(erik, FENSTER_A, { seq: 1, auswahl: null })).statusCode).toBe(404);
  });
});
