// ================================================================================================
// produkt:20261011:peter-p06 · VORMACHEN UND PERSÖNLICHE ROUTINE AM ECHTEN SERVER.
// ================================================================================================
//
// Gemessen über die ECHTE Anwendung (`buildApp(buildServices())`, `app.inject`). Vorgemacht wird
// über die VORHANDENEN Arbeitswege — Entwurf anlegen (`POST /api/drafts`), speichern
// (`PUT /api/drafts/:id`), einreichen (`POST /api/drafts/:id/promote`), im Word-Kanal mit der
// Herkunft des Taskpanes (`origin: "word_addin"`, Herkunftsseite `/word-addin/taskpane.html`). Der
// Server schreibt mit; niemand meldet eine Beobachtung von Hand. Allein der Seitenwechsel
// (Quelle `client`) geht über `POST /api/me/vormachen/:id/beobachtungen`. Der KI-Prüfjob ist ein
// stiller Zähler (kein Modell). Fiktive Testdaten („Musterfirma Beispiel GmbH").
//
//   AC01  Nur ausgewählte Anwendung und Vorgänge werden beobachtet.
//   AC02  Sichtbarer Lernzustand und sofortige Pause.
//   AC03  Zweckgebundene Lernnotiz von bestätigter Routine getrennt.
//   AC04  Vorschau bildet die vorgemachte Aufgabe nachvollziehbar ab (mit Korrektur, Stand).
//   AC05  Folgenreiche Außenaktion braucht die passende Bestätigung — je Ausführung, einmal.
//   AC06  Abbruch entfernt unnötige Rohdaten nach konfigurierter Regel.
//   AC07  Privatlöschung vernichtet keine getrennt freigegebenen Firmeninhalte.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiCheckWorker } from "../../services/app/src/ai-check-worker";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";
import {
  VORMACHEN_ABGEBROCHEN,
  VORMACHEN_AUSSENAKTION,
  VORMACHEN_PRIVAT_GELOESCHT,
} from "../../services/app/src/routes/vormachen-routes";
import {
  AUSSEN_BESTAETIGUNG_GUELTIG_MS,
  SICHTBAR_GUELTIG_MS,
  VormachenDienst,
} from "../../services/app/src/vormachen";

type App = ReturnType<typeof buildApp>;
type Methode = "GET" | "POST" | "PUT" | "DELETE";

let services: AppServices;
let app: App;
let ada = { id: "", token: "" };
let vera = { id: "", token: "" };

const URL = "/api/me/vormachen";
const WEB = "http://localhost/erfassen";
const WORD = "http://localhost/word-addin/taskpane.html";
/** Ein Titel, der als Rohwert mitgeschrieben wird und nie über die Lernsitzung hinaus erscheint. */
const ROHWERT = "Angebot Musterfirma Beispiel GmbH 48.250 EUR";
const FREMDER_TITEL = "Private Notiz aus einem anderen Fenster";

/** Ein stiller Prüf-Job: zählt nur, kein Worker-Lauf, kein Modell (wie `tests/entwurf-einreichen`). */
function stillerPruefjob(): AiCheckWorker {
  const eingereiht = new Set<string>();
  return {
    enqueue: vi.fn((koId: string) => {
      eingereiht.add(koId);
    }),
    has: (koId) => eingereiht.has(koId),
    laeuft: () => false,
    queuedCount: () => 0,
    idle: async () => undefined,
  };
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

const auf = (wer: string, methode: Methode, url: string, payload?: unknown, herkunft?: string) =>
  app.inject({
    method: methode,
    url,
    headers: {
      ...(wer ? { authorization: `Bearer ${wer}` } : {}),
      ...(herkunft ? { referer: herkunft } : {}),
    },
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });

// ---- die vorhandenen Arbeitswege -------------------------------------------------------------

async function entwurf(wer: string, titel: string, herkunft?: string, word = false) {
  const r = await auf(
    wer,
    "POST",
    "/api/drafts",
    {
      title: titel,
      statement: "Angebot vor Versand fachlich prüfen.",
      type: "best_practice",
      category: "Vertrieb",
      confidentiality: "intern",
      bodyHtml: "<p>Angebotsnotiz mit fiktiven Werten.</p>",
      ...(word ? { origin: "word_addin" } : {}),
    },
    herkunft,
  );
  expect(r.statusCode, r.body).toBeLessThan(300);
  return (r.json() as { id: string }).id;
}

async function speichere(wer: string, id: string, titel: string, herkunft?: string) {
  const r = await auf(wer, "PUT", `/api/drafts/${id}`, { title: titel }, herkunft);
  expect(r.statusCode, r.body).toBe(200);
}

let vorgangNr = 0;
async function reicheEin(wer: string, id: string, herkunft?: string) {
  vorgangNr += 1;
  const operationId = `vormachen-einreichen-${String(vorgangNr).padStart(4, "0")}`;
  const r = await auf(wer, "POST", `/api/drafts/${id}/promote`, { operationId }, herkunft);
  expect(r.statusCode, r.body).toBe(201);
  return r.json() as { id: string; status: string; title: string };
}

/** Vormachen in Klarwerk-Web: Entwurf anlegen, speichern, zur Prüfung einreichen. */
async function machVorWeb(wer: string): Promise<void> {
  const id = await entwurf(wer, ROHWERT, WEB);
  await speichere(wer, id, ROHWERT, WEB);
  await reicheEin(wer, id, WEB);
}

// ---- Vormachen ---------------------------------------------------------------------------------

interface SitzungSicht {
  id: string;
  host: string;
  zustand: string;
  beobachtet: number;
  rohwerte: number;
  nichtAufgenommen: { host: number; vorgang: number; pausiert: number };
  lernnotiz: { zweck: string; schritte: { nr: number; beschreibung: string; vorgang: string }[] };
}

interface VorschauSicht {
  stand: string;
  modus: string;
  schritte: {
    nr: number;
    vorgang: string;
    beschreibung: string;
    aussenwirkung: boolean;
    beleg: number;
    korrigiert: boolean;
  }[];
  beobachtet: number;
  entfernt: number;
}

interface RoutineSicht {
  id: string;
  fassung: number;
  modus: string;
  schritte: { id: string; vorgang: string; beschreibung: string; aussenwirkung: boolean }[];
  firmenuebergabe: { entwurfId: string } | null;
}

async function uebersicht(wer: string) {
  const r = await auf(wer, "GET", URL);
  expect(r.statusCode, r.body).toBe(200);
  return { roh: r.body, ...(r.json() as { sitzungen: SitzungSicht[]; routinen: RoutineSicht[] }) };
}

/** Die sichtbare Lernanzeige dieses Clients meldet sich — wie `VormachenAnzeige` es tut. */
async function zeigeAn(wer: string): Promise<boolean> {
  const r = await auf(wer, "GET", `${URL}?anzeige=klarwerk_web`);
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { sichtbar: boolean }).sichtbar;
}

/** Start und danach die Sichtbarkeitsmeldung der Anzeige im selben Client. */
async function starte(wer: string, eingabe: Record<string, unknown>): Promise<SitzungSicht> {
  const r = await auf(wer, "POST", URL, eingabe);
  expect(r.statusCode, r.body).toBe(201);
  expect(await zeigeAn(wer)).toBe(true);
  return (r.json() as { sitzung: SitzungSicht }).sitzung;
}

/** Die Beschreibungen, die der Server aus `machVorWeb` ableitet. */
const ANGELEGT =
  "Entwurf anlegen: Art „best_practice“, Kategorie „Vertrieb“, Vertraulichkeit „intern“, Titel, Aussage, Inhalt";
const GESPEICHERT = "Entwurf speichern (Entwurf aus Schritt 1): Titel";
const EINGEREICHT = "Entwurf zur Prüfung einreichen (Entwurf aus Schritt 1)";

const WEB_START = {
  host: "klarwerk_web",
  vorgaenge: ["entwurf_anlegen", "entwurf_speichern", "zur_pruefung_einreichen"],
  zweck: "Angebotsnotiz für Musterfirma einreichen",
};

async function vorschau(wer: string, id: string): Promise<VorschauSicht> {
  const r = await auf(wer, "GET", `${URL}/${id}/vorschau`);
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { vorschau: VorschauSicht }).vorschau;
}

async function bestaetigeRoutine(wer: string, id: string): Promise<RoutineSicht> {
  const v = await vorschau(wer, id);
  const r = await auf(wer, "POST", `${URL}/${id}/bestaetigung`, { stand: v.stand });
  expect(r.statusCode, r.body).toBe(201);
  return (r.json() as { routine: RoutineSicht }).routine;
}

beforeEach(async () => {
  services = buildServices();
  services.aiCheckWorker = stillerPruefjob();
  app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@vormachen.test", password: "secret123" },
  });
  const adaToken = await anmelden("ada@vormachen.test");
  ada = { id: "", token: adaToken };
  const angelegt = await auf(adaToken, "POST", "/api/users", {
    name: "Vera Viewer",
    email: "vera@vormachen.test",
    password: "secret123",
    role: "viewer",
  });
  expect(angelegt.statusCode).toBe(201);
  vera = {
    id: (angelegt.json() as { id: string }).id,
    token: await anmelden("vera@vormachen.test"),
  };
});

describe("P06-AC01 · nur ausgewählte Anwendung und Vorgänge werden beobachtet", () => {
  it("schreibt nur den gewählten Vorgang im gewählten Host mit — am echten Arbeitsweg", async () => {
    // Vor dem Start: Arbeit ohne Lernsitzung wird nie mitgeschrieben.
    await entwurf(ada.token, "Vor dem Start", WEB);
    const s = await starte(ada.token, { ...WEB_START, vorgaenge: ["entwurf_anlegen"] });
    expect(s.beobachtet).toBe(0);

    // Word-Kanal (nicht gewählt), Speichern (nicht gewählt), Anfrage ohne bestimmbaren Host.
    await entwurf(ada.token, FREMDER_TITEL, WORD, true);
    const id = await entwurf(ada.token, ROHWERT, WEB);
    await speichere(ada.token, id, FREMDER_TITEL, WEB);
    await entwurf(ada.token, FREMDER_TITEL);

    const { roh, sitzungen } = await uebersicht(ada.token);
    expect(sitzungen[0]).toMatchObject({
      beobachtet: 1,
      nichtAufgenommen: { host: 2, vorgang: 1, pausiert: 0 },
    });
    expect(sitzungen[0]?.lernnotiz.schritte.map((x) => [x.nr, x.vorgang, x.beschreibung])).toEqual([
      [1, "entwurf_anlegen", ANGELEGT],
    ]);
    // Was nicht gewählt war, steht nirgends.
    expect(roh).not.toContain(FREMDER_TITEL);
  });

  it("Word-Kanal: mitgeschrieben wird erst, wenn das Word-Panel den Lernzustand anzeigt", async () => {
    const r = await auf(ada.token, "POST", URL, {
      host: "word",
      vorgaenge: ["word_auswahl_uebernehmen"],
      zweck: "Angebotstext aus Word übernehmen",
    });
    expect(r.statusCode, r.body).toBe(201);
    // Nur Klarwerk-Web zeigt an — für Word gilt das nicht: die Übernahme bleibt draußen.
    expect(await zeigeAn(ada.token)).toBe(true);
    await entwurf(ada.token, FREMDER_TITEL, WORD, true);
    let stand = await uebersicht(ada.token);
    expect(stand.sitzungen[0]).toMatchObject({
      beobachtet: 0,
      nichtAufgenommen: { unsichtbar: 1 },
    });
    expect(stand.roh).not.toContain(FREMDER_TITEL);

    // Das Word-Panel (`vormachen.js`) meldet sich mit `?anzeige=word` — ab jetzt zählt Word.
    const word = await auf(ada.token, "GET", `${URL}?anzeige=word`);
    expect((word.json() as { sichtbar: boolean }).sichtbar).toBe(true);
    await entwurf(ada.token, ROHWERT, WORD, true);
    // Eine Arbeit in Klarwerk-Web gehört nicht zum gewählten Host.
    await entwurf(ada.token, FREMDER_TITEL, WEB);
    stand = await uebersicht(ada.token);
    expect(stand.sitzungen[0]).toMatchObject({
      host: "word",
      beobachtet: 1,
      rohwerte: 1,
      nichtAufgenommen: { host: 1, unsichtbar: 1 },
    });
    expect(stand.sitzungen[0]?.lernnotiz.schritte.map((x) => x.beschreibung)).toEqual([
      "Markierten Text aus Word als Entwurf übernehmen: Art „best_practice“, Kategorie „Vertrieb“, Vertraulichkeit „intern“, Titel, Aussage, Inhalt",
    ]);
    expect(stand.roh).not.toContain(ROHWERT);
  });

  it("ein Arbeitsweg-Vorgang lässt sich nicht von Hand melden; der Seitenwechsel schon", async () => {
    const s = await starte(ada.token, {
      host: "klarwerk_web",
      vorgaenge: ["entwurf_anlegen", "seite_oeffnen"],
      zweck: "Bibliothek und Entwurf",
    });
    const vorgetaeuscht = await auf(ada.token, "POST", `${URL}/${s.id}/beobachtungen`, {
      host: "klarwerk_web",
      vorgang: "entwurf_anlegen",
      beschreibung: "Entwurf angelegt (behauptet)",
    });
    expect(vorgetaeuscht.statusCode).toBe(422);
    expect(vorgetaeuscht.json()).toMatchObject({ grund: "nur_arbeitsweg" });
    const seite = await auf(ada.token, "POST", `${URL}/${s.id}/beobachtungen`, {
      host: "klarwerk_web",
      vorgang: "seite_oeffnen",
      beschreibung: "/bibliothek",
    });
    expect(seite.statusCode).toBe(201);
    expect((await uebersicht(ada.token)).sitzungen[0]?.beobachtet).toBe(1);
  });

  it("lehnt beim Start Vorgänge eines anderen Hosts, unbekannte Hosts und leere Auswahl ab", async () => {
    for (const eingabe of [
      { ...WEB_START, vorgaenge: ["word_frage"] },
      { ...WEB_START, host: "bildschirm" },
      { ...WEB_START, vorgaenge: [] },
      { ...WEB_START, vorgaenge: ["text_einfuegen"] },
      { ...WEB_START, zweck: "" },
    ]) {
      const r = await auf(ada.token, "POST", URL, eingabe);
      expect(r.statusCode, JSON.stringify(eingabe)).toBe(400);
    }
    expect((await uebersicht(ada.token)).sitzungen).toEqual([]);
  });

  it("je Konto getrennt: eine fremde Sitzung ist weder beobachtbar noch sichtbar", async () => {
    const s = await starte(ada.token, { ...WEB_START, vorgaenge: ["seite_oeffnen"] });
    const r = await auf(vera.token, "POST", `${URL}/${s.id}/beobachtungen`, {
      host: "klarwerk_web",
      vorgang: "seite_oeffnen",
      beschreibung: "/fremd",
    });
    expect(r.statusCode).toBe(404);
    expect((await uebersicht(vera.token)).sitzungen).toEqual([]);
    expect((await auf("", "GET", URL)).statusCode).toBe(401);
  });
});

describe("P06-AC02 · nie unsichtbar: mitgeschrieben wird nur, wo der Lernzustand angezeigt wird", () => {
  it("ohne Sichtbarkeitsmeldung des beobachteten Clients wird nichts gespeichert, nur gezählt", async () => {
    const r = await auf(ada.token, "POST", URL, WEB_START);
    expect(r.statusCode).toBe(201);
    // Keine Anzeige hat sich gemeldet (etwa: Starttab geschlossen) — die Arbeit gelingt trotzdem.
    await entwurf(ada.token, ROHWERT, WEB);
    const stand = await uebersicht(ada.token);
    expect(stand.sitzungen[0]).toMatchObject({
      beobachtet: 0,
      rohwerte: 0,
      nichtAufgenommen: { unsichtbar: 1 },
    });
    expect(stand.roh).not.toContain(ROHWERT);
    // Sobald die Anzeige sich meldet, wird mitgeschrieben.
    expect(await zeigeAn(ada.token)).toBe(true);
    await entwurf(ada.token, ROHWERT, WEB);
    expect((await uebersicht(ada.token)).sitzungen[0]?.beobachtet).toBe(1);
  });

  it("die Anzeige gilt nur für ihren Client: eine zweite Anmeldung desselben Kontos lernt nicht mit", async () => {
    await starte(ada.token, WEB_START);
    const zweitesGeraet = await anmelden("ada@vormachen.test");
    expect(zweitesGeraet).not.toBe(ada.token);
    await entwurf(zweitesGeraet, ROHWERT, WEB);
    const stand = await uebersicht(ada.token);
    expect(stand.sitzungen[0]).toMatchObject({
      beobachtet: 0,
      nichtAufgenommen: { unsichtbar: 1 },
    });
    // Ohne offene Sitzung nimmt der Server keine Sichtbarkeitsmeldung an.
    expect(await zeigeAn(vera.token)).toBe(false);
  });

  it("eine Sichtbarkeitsmeldung verfällt — danach wird nicht mehr mitgeschrieben (gestellte Uhr)", () => {
    let jetzt = Date.parse("2026-10-11T10:00:00.000Z");
    const dienst = new VormachenDienst({ jetzt: () => jetzt });
    dienst.starte("konto-sicht", { ...WEB_START, vorgaenge: ["entwurf_anlegen"] });
    const b = {
      host: "klarwerk_web",
      vorgang: "entwurf_anlegen",
      beschreibung: "Entwurf anlegen",
      rohwert: null,
    } as const;
    expect(dienst.meldeSichtbar("konto-sicht", "klarwerk_web", "c1")).toBe(true);
    // Ein Host ohne Anzeige meldet nichts an; die Word-Meldung macht Klarwerk-Web nicht sichtbar.
    expect(dienst.meldeSichtbar("konto-sicht", "bildschirm", "c1")).toBe(false);
    expect(dienst.meldeSichtbar("konto-sicht", "word", "c2")).toBe(true);
    expect(dienst.beobachteArbeitsweg("konto-sicht", b, "c1")).toBe(1);
    expect(dienst.beobachteArbeitsweg("konto-sicht", b, "c2")).toBeNull();
    jetzt += SICHTBAR_GUELTIG_MS + 1;
    expect(dienst.beobachteArbeitsweg("konto-sicht", b, "c1")).toBeNull();
  });
});

describe("P06-AC04 · die Beschreibung folgt der tatsächlich ausgeführten Änderung", () => {
  it("gesetzte Ordnungsangaben mit Wert, Inhalt nur beim Namen, Zielbezug auf den Schritt", async () => {
    await starte(ada.token, { ...WEB_START, vorgaenge: ["entwurf_anlegen", "entwurf_speichern"] });
    const r = await auf(
      ada.token,
      "POST",
      "/api/drafts",
      { title: ROHWERT, statement: "Rabatt nur ab 10 Stück.", type: "best_practice" },
      WEB,
    );
    expect(r.statusCode).toBe(201);
    const id = (r.json() as { id: string }).id;
    const kategorie = await auf(
      ada.token,
      "PUT",
      `/api/drafts/${id}`,
      { category: "Vertrieb" },
      WEB,
    );
    expect(kategorie.statusCode).toBe(200);
    // Ein Entwurf, der nicht in dieser Lernsitzung entstand.
    const vorher = await entwurf(ada.token, "Älterer Entwurf");
    const fremd = await auf(
      ada.token,
      "PUT",
      `/api/drafts/${vorher}`,
      { category: "Einkauf" },
      WEB,
    );
    expect(fremd.statusCode).toBe(200);

    const { sitzungen, roh } = await uebersicht(ada.token);
    expect(sitzungen[0]?.lernnotiz.schritte.map((x) => x.beschreibung)).toEqual([
      "Entwurf anlegen: Art „best_practice“, Titel, Aussage",
      "Entwurf speichern (Entwurf aus Schritt 1): Kategorie „Vertrieb“",
      "Entwurf speichern (vorhandener Entwurf): Kategorie „Einkauf“",
    ]);
    // Der Inhalt selbst steht nirgends.
    expect(roh).not.toContain("Rabatt nur ab 10 Stück");
    expect(roh).not.toContain(ROHWERT);
  });
});

describe("P06-AC02 · sichtbarer Lernzustand und sofortige Pause", () => {
  it("pausiert sofort: der Arbeitsweg gelingt, wird aber nicht mitgeschrieben", async () => {
    const s = await starte(ada.token, WEB_START);
    expect(s.zustand).toBe("lernt");

    const pause = await auf(ada.token, "PUT", `${URL}/${s.id}/zustand`, { zustand: "pausiert" });
    expect(pause.statusCode).toBe(200);
    expect((pause.json() as { sitzung: SitzungSicht }).sitzung.zustand).toBe("pausiert");

    await entwurf(ada.token, ROHWERT, WEB);
    const nachPause = await uebersicht(ada.token);
    expect(nachPause.sitzungen[0]).toMatchObject({
      zustand: "pausiert",
      beobachtet: 0,
      rohwerte: 0,
    });
    expect(nachPause.sitzungen[0]?.nichtAufgenommen.pausiert).toBe(1);
    expect(nachPause.roh).not.toContain(ROHWERT);

    const weiter = await auf(ada.token, "PUT", `${URL}/${s.id}/zustand`, { zustand: "lernt" });
    expect(weiter.statusCode).toBe(200);
    await entwurf(ada.token, "Nach der Pause", WEB);
    expect((await uebersicht(ada.token)).sitzungen[0]?.beobachtet).toBe(1);
  });

  it("erlaubt nur eine offene Lernsitzung je Konto", async () => {
    await starte(ada.token, WEB_START);
    const zweite = await auf(ada.token, "POST", URL, WEB_START);
    expect(zweite.statusCode).toBe(409);
    expect(zweite.json()).toMatchObject({ grund: "laeuft_schon" });
  });
});

describe("P06-AC03 · zweckgebundene Lernnotiz getrennt von der bestätigten Routine", () => {
  it("Notiz mit Zweck und Schritten ohne Rohwerte; erst die Bestätigung erzeugt die Routine", async () => {
    const s = await starte(ada.token, WEB_START);
    await machVorWeb(ada.token);

    const vorher = await uebersicht(ada.token);
    expect(vorher.routinen).toEqual([]);
    const notiz = vorher.sitzungen[0]?.lernnotiz;
    expect(notiz?.zweck).toBe(WEB_START.zweck);
    expect(notiz?.schritte.map((x) => x.vorgang)).toEqual([
      "entwurf_anlegen",
      "entwurf_speichern",
      "zur_pruefung_einreichen",
    ]);
    expect(vorher.sitzungen[0]?.rohwerte).toBe(2);
    expect(vorher.roh).not.toContain(ROHWERT);

    const routine = await bestaetigeRoutine(ada.token, s.id);
    const nachher = await uebersicht(ada.token);
    expect(nachher.routinen.map((r) => r.id)).toEqual([routine.id]);
    expect(nachher.sitzungen).toEqual([]);
    expect(nachher.roh).not.toContain(ROHWERT);
  });

  it("eine nach Abbruch behaltene Notiz wird nie zur Routine", async () => {
    const s = await starte(ada.token, { ...WEB_START, abbruchRegel: "lernnotiz_behalten" });
    await machVorWeb(ada.token);
    expect((await auf(ada.token, "POST", `${URL}/${s.id}/abbruch`)).statusCode).toBe(200);
    const stand = await uebersicht(ada.token);
    expect(stand.routinen).toEqual([]);
    expect(stand.sitzungen[0]?.zustand).toBe("abgebrochen");
    const r = await auf(ada.token, "POST", `${URL}/${s.id}/bestaetigung`, { stand: "x" });
    expect(r.statusCode).toBe(409);
  });
});

describe("P06-AC04 · die Vorschau bildet die vorgemachte Aufgabe nachvollziehbar ab", () => {
  it("Schritte in Reihenfolge der Ausführung mit Beleg, Außenwirkung und Modus", async () => {
    const s = await starte(ada.token, WEB_START);
    await machVorWeb(ada.token);
    const v = await vorschau(ada.token, s.id);
    expect(v.modus).toBe("ergebnis_zur_pruefung");
    const zeilen = v.schritte.map((x) => [
      x.nr,
      x.beleg,
      x.vorgang,
      x.beschreibung,
      x.aussenwirkung,
    ]);
    expect(zeilen).toEqual([
      [1, 1, "entwurf_anlegen", ANGELEGT, false],
      [2, 2, "entwurf_speichern", GESPEICHERT, false],
      [3, 3, "zur_pruefung_einreichen", EINGEREICHT, true],
    ]);
    expect(JSON.stringify(v)).not.toContain(ROHWERT);
  });

  it("Korrektur und Herausnehmen ändern Vorschau und Stand; ein alter Stand wird nicht bestätigt", async () => {
    const s = await starte(ada.token, WEB_START);
    await machVorWeb(ada.token);
    const alt = await vorschau(ada.token, s.id);

    const korr = await auf(ada.token, "PUT", `${URL}/${s.id}/korrektur`, {
      nr: 1,
      beschreibung: "Entwurf für das Angebot anlegen",
    });
    expect(korr.statusCode, korr.body).toBe(200);
    const raus = await auf(ada.token, "PUT", `${URL}/${s.id}/korrektur`, {
      nr: 2,
      entfernen: true,
    });
    const neu = (raus.json() as { vorschau: VorschauSicht }).vorschau;
    expect(neu.stand).not.toBe(alt.stand);
    expect(neu.entfernt).toBe(1);
    expect(neu.schritte.map((x) => [x.nr, x.beleg, x.korrigiert])).toEqual([
      [1, 1, true],
      [2, 3, false],
    ]);
    expect(neu.schritte[0]?.beschreibung).toBe("Entwurf für das Angebot anlegen");

    const veraltet = await auf(ada.token, "POST", `${URL}/${s.id}/bestaetigung`, {
      stand: alt.stand,
    });
    expect(veraltet.statusCode).toBe(409);
    expect(veraltet.json()).toMatchObject({ grund: "stand_veraltet" });

    const ok = await auf(ada.token, "POST", `${URL}/${s.id}/bestaetigung`, { stand: neu.stand });
    expect(ok.statusCode).toBe(201);
    const routine = (ok.json() as { routine: RoutineSicht }).routine;
    expect(routine.schritte.map((x) => x.beschreibung)).toEqual(
      neu.schritte.map((x) => x.beschreibung),
    );
  });
});

describe("P06-AC05 · folgenreiche Außenaktion braucht die passende Bestätigung", () => {
  /** Zwei Einreichungen vormachen: die Routine trägt zwei Außenschritte. */
  async function routineMitZweiAussenschritten(): Promise<RoutineSicht> {
    const s = await starte(ada.token, {
      ...WEB_START,
      vorgaenge: ["entwurf_anlegen", "zur_pruefung_einreichen"],
    });
    for (const teil of ["A", "B"]) {
      const titel = `Angebot Teil ${teil} · Lauf ${vorgangNr}`;
      await reicheEin(ada.token, await entwurf(ada.token, titel, WEB), WEB);
    }
    return bestaetigeRoutine(ada.token, s.id);
  }

  const frei = (wer: string, routine: string, schritt: string, ausfuehrung?: unknown) =>
    auf(
      wer,
      "POST",
      `${URL}/routinen/${routine}/schritte/${schritt}/freigabe`,
      ausfuehrung === undefined ? {} : { bestaetigung: { ausfuehrung } },
    );

  async function fordereAn(routine: string, schritt: string): Promise<string> {
    const r = await frei(ada.token, routine, schritt);
    expect(r.statusCode).toBe(409);
    const body = r.json() as {
      grund: string;
      ausfuehrung: { id: string; routineId: string; schrittId: string };
    };
    expect(body.grund).toBe("bestaetigung_fehlt");
    expect(body.ausfuehrung).toMatchObject({ routineId: routine, schrittId: schritt });
    return body.ausfuehrung.id;
  }

  it("bindet die Bestätigung an Routine, Schritt und genau eine Ausführung — kein zweiter Gebrauch", async () => {
    const eins = await routineMitZweiAussenschritten();
    expect(eins.schritte.map((x) => [x.id, x.aussenwirkung])).toEqual([
      ["s1", false],
      ["s2", true],
      ["s3", false],
      ["s4", true],
    ]);
    // Intern: nur Ergebnis zur Prüfung, keine Bestätigung nötig.
    const intern = await frei(ada.token, eins.id, "s1");
    expect(intern.json()).toMatchObject({ freigabe: { art: "ergebnis_zur_pruefung" } });

    // Die Bestätigung der Routine allein gibt nichts frei; es wird eine Ausführung angefordert.
    const fuerS2 = await fordereAn(eins.id, "s2");
    // Dieselbe Kennung für einen ANDEREN Schritt derselben Routine: nichts.
    const andererSchritt = await frei(ada.token, eins.id, "s4", fuerS2);
    expect(andererSchritt.statusCode).toBe(409);
    expect(andererSchritt.json()).toMatchObject({ grund: "bestaetigung_passt_nicht" });

    // Eine zweite Routine gleicher Fassung und gleichen Vorgangs: die Kennung passt dort nicht.
    const zwei = await routineMitZweiAussenschritten();
    const andereRoutine = await frei(ada.token, zwei.id, "s2", fuerS2);
    expect(andereRoutine.json()).toMatchObject({ grund: "bestaetigung_passt_nicht" });
    // Eine erfundene oder alte Bestätigungsform: nichts.
    for (const falsch of ["erfunden", { fassung: 1, vorgang: "zur_pruefung_einreichen" }]) {
      const r = await frei(ada.token, eins.id, "s2", falsch);
      expect(r.json(), JSON.stringify(falsch)).toMatchObject({ grund: "bestaetigung_passt_nicht" });
    }
    expect(await services.audit.list({ action: VORMACHEN_AUSSENAKTION })).toHaveLength(0);

    // Die passende Bestätigung gibt genau diese Ausführung frei …
    const ok = await frei(ada.token, eins.id, "s2", fuerS2);
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json()).toMatchObject({
      freigabe: { art: "aussenaktion_bestaetigt", ausfuehrung: fuerS2 },
    });
    // … und ist danach verbraucht.
    const nochmal = await frei(ada.token, eins.id, "s2", fuerS2);
    expect(nochmal.statusCode).toBe(409);
    expect(nochmal.json()).toMatchObject({ grund: "bestaetigung_passt_nicht" });
    // Die nächste Ausführung braucht eine neue Anforderung und eine neue Bestätigung.
    const naechste = await fordereAn(eins.id, "s2");
    expect(naechste).not.toBe(fuerS2);
    expect((await frei(ada.token, eins.id, "s2", naechste)).statusCode).toBe(200);

    const ereignisse = await services.audit.list({ action: VORMACHEN_AUSSENAKTION });
    expect(ereignisse.map((e) => e.target)).toEqual([`routine:${eins.id}`, `routine:${eins.id}`]);
  });

  it("eine fremde Person kann weder anfordern noch eine fremde Ausführung bestätigen", async () => {
    const routine = await routineMitZweiAussenschritten();
    const kennung = await fordereAn(routine.id, "s2");
    expect((await frei(vera.token, routine.id, "s2")).statusCode).toBe(404);
    expect((await frei(vera.token, routine.id, "s2", kennung)).statusCode).toBe(404);
    expect((await frei(ada.token, routine.id, "s2", kennung)).statusCode).toBe(200);
  });

  it("eine angeforderte Ausführung verfällt nach ihrer Frist (Dienst mit gestellter Uhr)", async () => {
    let jetzt = Date.parse("2026-10-11T10:00:00.000Z");
    const dienst = new VormachenDienst({ jetzt: () => jetzt });
    const s = dienst.starte("konto-uhr", {
      host: "klarwerk_web",
      vorgaenge: ["zur_pruefung_einreichen"],
      zweck: "Einreichen",
    });
    expect(dienst.meldeSichtbar("konto-uhr", "klarwerk_web", "client-uhr")).toBe(true);
    const nr = dienst.beobachteArbeitsweg(
      "konto-uhr",
      {
        host: "klarwerk_web",
        vorgang: "zur_pruefung_einreichen",
        beschreibung: "Entwurf zur Prüfung einreichen",
        rohwert: null,
      },
      "client-uhr",
    );
    expect(nr).toBe(1);
    const stand = dienst.vorschau("konto-uhr", s.id).stand;
    const r = await dienst.bestaetige("konto-uhr", s.id, { stand });
    const angefordert = await dienst
      .gibSchrittFrei("konto-uhr", r.id, "s1", undefined)
      .catch((e: { details: { ausfuehrung: { id: string } } }) => e.details.ausfuehrung.id);
    jetzt += AUSSEN_BESTAETIGUNG_GUELTIG_MS + 1;
    await expect(
      dienst.gibSchrittFrei("konto-uhr", r.id, "s1", { ausfuehrung: angefordert }),
    ).rejects.toMatchObject({ grund: "bestaetigung_passt_nicht" });
  });
});

describe("P06-AC06 · Abbruch entfernt unnötige Rohdaten nach konfigurierter Regel", () => {
  it("Regel alles_verwerfen (Voreinstellung): Sitzung, Notiz und Rohwerte sind fort", async () => {
    const s = await starte(ada.token, WEB_START);
    await machVorWeb(ada.token);
    const r = await auf(ada.token, "POST", `${URL}/${s.id}/abbruch`);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({
      regel: "alles_verwerfen",
      rohdatenEntfernt: 2,
      notizBehalten: false,
    });
    const stand = await uebersicht(ada.token);
    expect(stand.sitzungen).toEqual([]);
    expect(stand.routinen).toEqual([]);
    const ereignis = await services.audit.list({ action: VORMACHEN_ABGEBROCHEN });
    expect(JSON.stringify(ereignis)).not.toContain(ROHWERT);
  });

  it("Regel lernnotiz_behalten: Rohwerte fort, Notiz bleibt bis zur gezielten Löschung", async () => {
    const s = await starte(ada.token, { ...WEB_START, abbruchRegel: "lernnotiz_behalten" });
    await machVorWeb(ada.token);
    const r = await auf(ada.token, "POST", `${URL}/${s.id}/abbruch`);
    expect(r.json()).toEqual({
      regel: "lernnotiz_behalten",
      rohdatenEntfernt: 2,
      notizBehalten: true,
    });
    const stand = await uebersicht(ada.token);
    expect(stand.sitzungen[0]).toMatchObject({
      zustand: "abgebrochen",
      rohwerte: 0,
      beobachtet: 3,
    });
    // Nach dem Abbruch schreibt auch der Arbeitsweg nichts mehr mit.
    await entwurf(ada.token, "Nach dem Abbruch", WEB);
    expect((await uebersicht(ada.token)).sitzungen[0]?.beobachtet).toBe(3);
    expect((await auf(ada.token, "DELETE", `${URL}/${s.id}`)).statusCode).toBe(200);
    expect((await uebersicht(ada.token)).sitzungen).toEqual([]);
  });

  it("eine unbekannte Regel wird beim Start abgewiesen", async () => {
    const r = await auf(ada.token, "POST", URL, { ...WEB_START, abbruchRegel: "alles_behalten" });
    expect(r.statusCode).toBe(400);
  });
});

describe("P06-AC07 · Privatlöschung vernichtet keine getrennt freigegebenen Firmeninhalte", () => {
  it("löscht eigene Sitzungen und Routinen; der übergebene Firmenentwurf bleibt unverändert", async () => {
    const s = await starte(ada.token, WEB_START);
    await machVorWeb(ada.token);
    const routine = await bestaetigeRoutine(ada.token, s.id);

    const uebergabeUrl = `${URL}/routinen/${routine.id}/firmenuebergabe`;
    const uebergabe = await auf(ada.token, "POST", uebergabeUrl);
    expect(uebergabe.statusCode, uebergabe.body).toBe(201);
    const uebergeben = (uebergabe.json() as { routine: RoutineSicht }).routine;
    const entwurfId = uebergeben.firmenuebergabe?.entwurfId ?? "";
    expect(entwurfId).not.toBe("");
    const entwurfVorher = await services.capture.getDraft(entwurfId);
    expect(entwurfVorher?.payload.title).toBe(WEB_START.zweck);

    await starte(ada.token, { ...WEB_START, vorgaenge: ["seite_oeffnen"] });

    const loeschen = await auf(ada.token, "DELETE", URL);
    expect(loeschen.statusCode).toBe(200);
    expect(loeschen.json()).toEqual({ geloescht: { sitzungen: 1, routinen: 1 } });
    const stand = await uebersicht(ada.token);
    expect(stand.sitzungen).toEqual([]);
    expect(stand.routinen).toEqual([]);

    expect(await services.capture.getDraft(entwurfId)).toEqual(entwurfVorher);
    expect((await auf(ada.token, "GET", `/api/drafts/${entwurfId}`)).statusCode).toBe(200);
    expect(await services.audit.list({ action: VORMACHEN_PRIVAT_GELOESCHT })).toHaveLength(1);
  });

  it("die Privatlöschung berührt kein anderes Konto; die Übergabe verlangt ko.create", async () => {
    const e = await starte(ada.token, WEB_START);
    await machVorWeb(ada.token);
    const routine = await bestaetigeRoutine(ada.token, e.id);

    // Vera (Gast) macht einen Seitenweg vor — der einzige Weg ohne Anlagerecht.
    const v = await starte(vera.token, { ...WEB_START, vorgaenge: ["seite_oeffnen"] });
    const seite = await auf(vera.token, "POST", `${URL}/${v.id}/beobachtungen`, {
      host: "klarwerk_web",
      vorgang: "seite_oeffnen",
      beschreibung: "/bibliothek",
    });
    expect(seite.statusCode).toBe(201);
    const veraRoutine = await bestaetigeRoutine(vera.token, v.id);
    const r = await auf(vera.token, "POST", `${URL}/routinen/${veraRoutine.id}/firmenuebergabe`);
    expect(r.statusCode).toBe(403);

    expect((await auf(vera.token, "DELETE", URL)).json()).toEqual({
      geloescht: { sitzungen: 0, routinen: 1 },
    });
    expect((await uebersicht(ada.token)).routinen.map((x) => x.id)).toEqual([routine.id]);
  });
});
