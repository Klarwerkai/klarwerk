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
