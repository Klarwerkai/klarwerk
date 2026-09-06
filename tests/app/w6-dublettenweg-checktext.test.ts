// W6 (OFFEN.md) — DER WEG ZUR DUBLETTENPRUEFUNG.
//
// W6 lautet: „`POST /api/check-text` ist die Dublettenpruefung — und Klara benutzt sie nirgends."
// Gemessen (JOB 1621 D1): `check-text` hat in `apps/` NULL Treffer. PRO3 hat dasselbe gemessen
// (`RUECKGABE-PRO3-JOB-1530-D1-W6-CHECKTEXT.md`, §3.1: „nicht ‚Klara benutzt sie nirgends',
// sondern NIEMAND benutzt sie") — die Messung gilt weiter und ist hier nicht wiederholt.
//
// WAS DIESE DATEI PRUEFT: den Weg selbst — Aufruf, Uebersetzung, Fail-closed. Der Vertragsort
// (`window.klaraBestandsblick`) gehoert PRO3 (1571 D3) und wird hier NICHT besetzt; die
// Funktion liefert genau die Vertragsform, damit der Vertragsort sie ohne Anpassung einsetzen
// kann.
//
// WIE: geschnitten aus der WIRKLICH AUSGELIEFERTEN Datei und ausgefuehrt — dieselbe Bauform wie
// KW-KLARA-ASK-FETCH-* (mega79), KW-KLARA-AI-NOTICE-* (mega81) und KW-KLARA-AI-MARK-* (G24).
// Ein Quelltext-Pin wuerde nur belegen, dass etwas dasteht; hier laeuft es.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const TASKPANE = "apps/web/public/word-addin/taskpane.html";
const HTML = readFileSync(resolve(process.cwd(), TASKPANE), "utf8");

const W_START = "// KW-KLARA-W6-CHECKTEXT-START";
const W_END = "// KW-KLARA-W6-CHECKTEXT-END";

// JOB 3092 S6 (W6): der Weg hat seinen ersten Verbraucher (die Erfassen-Flaeche,
// captureDublettenPruefen) und traegt seither die LAGE des Laufs mit — „leer" | „treffer" |
// „fehler" | „zu-kurz" — sowie je Treffer additiv `relation`, `koStatus`, `koCategory`. Grund:
// „Nichts Vergleichbares gefunden" darf NUR nach einem erfolgreichen Lauf stehen; ein stummes
// `{treffer: []}` fuer Fehler UND Leere konnte das nicht unterscheiden. `treffer` bleibt in jedem
// Nicht-Erfolgsfall leer wie bisher (KA3 liest nur `treffer`); `status` bleibt `null`.
// JOB 3093 (M3 „Haben wir das schon?"): je Treffer additiv `pruefstand`, `version`, `fundort`
// (gelesen aus den gleichnamigen Feldern der Route, `null` wo nicht geliefert) und ein fuenfter,
// optionaler Parameter `titel` — der Titel reist als `title` mit, wenn er nichtleer ist.
type Treffer = {
  id: string;
  title: string;
  status: null;
  deviatesFrom: string | null;
  relation: string | null;
  koStatus: string | null;
  koCategory: string | null;
  pruefstand: "validiert" | "eingereicht" | null;
  version: number | null;
  fundort: { bereich: string | null; bibliothekPfad: string | null };
};
type Lage = "leer" | "treffer" | "fehler" | "zu-kurz";
type Weg = (
  grund: string,
  leseText: (grund: string) => unknown,
  fetchFn: (url: string, init: Record<string, unknown>) => Promise<unknown>,
  sprache?: string,
  titel?: string,
) => Promise<{ lage: Lage; gekuerzt?: boolean; treffer: Treffer[] }>;

/** Die drei JOB-3093-Felder, wenn die Route sie nicht liefert. */
const OHNE_FUNDORT = {
  pruefstand: null,
  version: null,
  fundort: { bereich: null, bibliothekPfad: null },
} as const;

/** Der ausgelieferte Weg — geschnitten und ausgefuehrt, nicht gelesen. */
function ausgelieferterWeg(): Weg {
  const start = HTML.indexOf(W_START);
  const end = HTML.indexOf(W_END);
  expect(start, `${TASKPANE}: ${W_START} fehlt — der Weg ist nicht auffindbar`).toBeGreaterThan(0);
  expect(end, `${TASKPANE}: ${W_END} fehlt`).toBeGreaterThan(start);
  const block = HTML.slice(start, end);
  // Die zwei Konstanten stehen bewusst AUSSERHALB der Schnittmarken (sie tragen die Begruendung
  // mit den Zeilennummern der Route); fuer den Schnitt werden sie hier gestellt.
  const factory = new Function(
    `var W6_MINDESTZEICHEN = 40; var W6_HOECHSTZEICHEN = 8000;${block} return w6DublettenAusCheckText;`,
  );
  return factory() as Weg;
}

/** Ein Nicht-Erfolg: leere Treffer und die benannte Lage. */
const OHNE = (lage: Lage): { lage: Lage; treffer: Treffer[] } => ({ lage, treffer: [] });

const LANG = "Ventil vor jeder Wartung drucklos schalten und gegen Wiedereinschalten sichern.";

function antwort(koerper: unknown, ok = true): Promise<unknown> {
  return Promise.resolve({ ok, json: () => Promise.resolve(koerper) });
}

/** Merkt sich, womit gerufen wurde — und antwortet mit dem uebergebenen Koerper. */
function sonde(koerper: unknown, ok = true) {
  const rufe: { url: string; init: Record<string, unknown> }[] = [];
  const fetchFn = (url: string, init: Record<string, unknown>) => {
    rufe.push({ url, init });
    return antwort(koerper, ok);
  };
  return { rufe, fetchFn };
}

// ================================================================================================
describe("W6 · der Weg zur Dublettenpruefung", () => {
  it("W6-1 · ein ausreichend langer Text geht an `POST /api/check-text` — same-origin, mit Sitzung", async () => {
    const { rufe, fetchFn } = sonde({ duplicates: [] });
    await ausgelieferterWeg()("tastenruhe", () => LANG, fetchFn, "en");

    expect(rufe.length, "die Dublettenpruefung wurde gar nicht gerufen").toBe(1);
    expect(rufe[0]?.url).toBe("/api/check-text");
    expect(rufe[0]?.init.method).toBe("POST");
    // Genau der Weg, den das Panel schon fuer `performAsk` benutzt (taskpane.html:1023-1027).
    expect(rufe[0]?.init.credentials).toBe("include");
    const body = JSON.parse(String(rufe[0]?.init.body));
    expect(body.text).toBe(LANG);
    expect(body.locale, "die Sprache des Fensters reist nicht mit").toBe("en");
    expect(body.source).toBe("transient-document");
  });

  it("W6-2 · die Antwort wird in die VERTRAGSFORM uebersetzt — id, title, status, deviatesFrom", async () => {
    // NACHGEFUEHRT (JOB 1963 D4): die Vertragsform hat seit `D2` ein VIERTES, optionales Feld —
    // `deviatesFrom`, die Wertung (`ka3Normalisieren` liest es, `ka3Zeichnen` zeichnet es). Diese
    // Zelle pinnt die Form weiterhin VOLLSTAENDIG und exakt; sie ist nicht gelockert, sondern um
    // das hinzugekommene Feld ergaenzt. Der Unterschied der beiden Eintraege ist Absicht und
    // zugleich der Beleg des Erzeugers: `identisch` weicht nicht ab, `teilweise` schon.
    // JOB 3092 S6: dazu `relation`, `koStatus`, `koCategory` — gelesen, `null` wo nicht geliefert —
    // und die Lage „treffer".
    const { fetchFn } = sonde({
      duplicates: [
        {
          koId: "ko-1",
          koTitle: "Ventilwartung",
          relation: "identisch",
          confidence: 0.9,
          koStatus: "validiert",
          koCategory: "Wartung",
        },
        {
          koId: "ko-2",
          koTitle: "Druckentlastung",
          relation: "teilweise",
          confidence: null,
          koStatus: "offen",
          koCategory: null,
        },
      ],
    });
    const ergebnis = await ausgelieferterWeg()("tastenruhe", () => LANG, fetchFn);

    expect(ergebnis).toEqual({
      lage: "treffer",
      gekuerzt: false,
      treffer: [
        {
          id: "ko-1",
          title: "Ventilwartung",
          status: null,
          deviatesFrom: null,
          relation: "identisch",
          koStatus: "validiert",
          koCategory: "Wartung",
          ...OHNE_FUNDORT,
        },
        {
          id: "ko-2",
          title: "Druckentlastung",
          status: null,
          deviatesFrom: "Druckentlastung",
          relation: "teilweise",
          koStatus: "offen",
          koCategory: null,
          ...OHNE_FUNDORT,
        },
      ],
    });
  });

  it("W6-10 · JOB 3093: Pruefstand, Version und Fundort werden GELESEN — und der Titel reist als fuenftes Argument mit", async () => {
    const { rufe, fetchFn } = sonde({
      duplicates: [
        {
          koId: "ko-1",
          koTitle: "Vor jeder Wartung an der Presse P2",
          relation: "identisch",
          koStatus: "offen",
          koCategory: "Instandhaltung",
          pruefstand: "eingereicht",
          version: 3,
          fundort: {
            kategorie: "Instandhaltung",
            bereich: "Instandhaltung",
            bibliothekPfad: "/wissen/ko-1",
          },
        },
        // Ein Pfad, der nicht am eigenen Ursprung liegt, ist kein Weg; ein unbekannter Pruefstand
        // und eine Nicht-Zahl als Version sind `null` — nichts wird erfunden.
        {
          koId: "ko-2",
          koTitle: "Fremd",
          pruefstand: "geheim",
          version: "3",
          fundort: { bereich: "  ", bibliothekPfad: "//boese.example/x" },
        },
      ],
    });
    const ergebnis = await ausgelieferterWeg()(
      "bestand",
      () => LANG,
      fetchFn,
      "de",
      "Ventil vor jeder Wartung drucklos schalten",
    );
    const body = JSON.parse(String(rufe[0]?.init.body));
    expect(body.title).toBe("Ventil vor jeder Wartung drucklos schalten");
    expect(body.text).toBe(LANG);
    expect(ergebnis.lage).toBe("treffer");
    expect(ergebnis.treffer[0]).toMatchObject({
      id: "ko-1",
      pruefstand: "eingereicht",
      version: 3,
      fundort: { bereich: "Instandhaltung", bibliothekPfad: "/wissen/ko-1" },
    });
    expect(ergebnis.treffer[1]).toMatchObject({ id: "ko-2", ...OHNE_FUNDORT });
    // Ohne fuenftes Argument (Erfassen vor JOB 3093, KA3) und mit leerem Titel: KEIN `title` im Koerper.
    const ohne = sonde({ duplicates: [] });
    await ausgelieferterWeg()("tastenruhe", () => LANG, ohne.fetchFn, "de");
    expect(Object.hasOwn(JSON.parse(String(ohne.rufe[0]?.init.body)), "title")).toBe(false);
    const leer = sonde({ duplicates: [] });
    await ausgelieferterWeg()("erfassen", () => LANG, leer.fetchFn, "de", "   ");
    expect(Object.hasOwn(JSON.parse(String(leer.rufe[0]?.init.body)), "title")).toBe(false);
  });

  it("W6-11 · JOB 3093 Runde 3: im Fehlerfall reist der HTTP-Status mit — 403 bleibt Lage „fehler“, nie Leere", async () => {
    const verweigert = async () => ({ ok: false, status: 403, json: async () => ({}) });
    expect(await ausgelieferterWeg()("bestand", () => LANG, verweigert as never)).toEqual({
      lage: "fehler",
      http: 403,
      treffer: [],
    });
    // Ohne Status (kein Antwortobjekt, Werfen) bleibt die Form die bisherige.
    const wirft = () => Promise.reject(new Error("offline"));
    expect(await ausgelieferterWeg()("bestand", () => LANG, wirft as never)).toEqual(
      OHNE("fehler"),
    );
  });

  it("W6-2b · JOB 3092: die LAGE unterscheidet Leere von Fehler — `leer` nur nach erfolgreichem Lauf", async () => {
    const { fetchFn } = sonde({ duplicates: [] });
    expect(await ausgelieferterWeg()("tastenruhe", () => LANG, fetchFn)).toEqual({
      lage: "leer",
      gekuerzt: false,
      treffer: [],
    });
  });

  it("W6-3 · `status` bleibt null — die Dublettenpruefung fuehrt kein Statusfeld", async () => {
    // Ein erfundener Status waere eine Behauptung ueber den Bestand. KA3 vertraegt `null`
    // ausdruecklich (`taskpane.html`, ka3Normalisieren) — deshalb ist `null` die ehrliche Form.
    const { fetchFn } = sonde({
      duplicates: [{ koId: "ko-1", koTitle: "T", status: "validiert" }],
    });
    const ergebnis = await ausgelieferterWeg()("tastenruhe", () => LANG, fetchFn);
    expect(
      ergebnis.treffer[0]?.status,
      "ein Status wurde uebernommen, den die Route nie liefert",
    ).toBe(null);
  });

  it("W6-4 · ein Eintrag OHNE Kennung macht die Antwort zu BESCHAEDIGTEN Daten — Lage „fehler“, kein Treffer, keine Leere", async () => {
    // JOB 3092 Runde 2 (BEN, Korrekturpflicht 2): bis Runde 1 wurden solche Eintraege still
    // verworfen; eine Liste, die NUR aus ihnen bestand, wurde zur erfolgreichen Leere. Eine Antwort
    // der Route traegt je Treffer eine Kennung (toResponse, check-text-routes.ts:89) — fehlt sie,
    // ist die Antwort nicht die der Route, und dann gilt „Pruefung nicht moeglich", auch wenn
    // daneben ein gueltiger Eintrag steht: eine halb lesbare Liste ist keine vollstaendige Auswertung.
    const nurKaputt = sonde({
      duplicates: [{ koTitle: "ohne Id" }, { koId: "", koTitle: "leer" }],
    });
    expect(await ausgelieferterWeg()("tastenruhe", () => LANG, nurKaputt.fetchFn)).toEqual(
      OHNE("fehler"),
    );
    const gemischt = sonde({ duplicates: [{ koTitle: "ohne Id" }, { koId: "ko-3" }] });
    expect(await ausgelieferterWeg()("tastenruhe", () => LANG, gemischt.fetchFn)).toEqual(
      OHNE("fehler"),
    );
    // Ein gueltiger Eintrag ohne Titel und Beziehung bleibt ein Treffer — mit ehrlich `null`.
    const duenn = sonde({ duplicates: [{ koId: "ko-3" }] });
    expect(await ausgelieferterWeg()("tastenruhe", () => LANG, duenn.fetchFn)).toEqual({
      lage: "treffer",
      gekuerzt: false,
      treffer: [
        {
          id: "ko-3",
          title: "",
          status: null,
          deviatesFrom: null,
          relation: null,
          koStatus: null,
          koCategory: null,
          ...OHNE_FUNDORT,
        },
      ],
    });
  });

  it("W6-9 · JOB 3092 Runde 2: ueber 8.000 Zeichen geht nur der Anfang — und das Ergebnis sagt `gekuerzt: true`", async () => {
    // BENs Korrekturpflicht 1: der Schnitt war da (Zeile `schnitt`), aber unsichtbar — die Karte
    // gab danach eine uneingeschraenkte Entwarnung. Jetzt reist die Kuerzung als Feld mit.
    const lang = `${"Ventil vor jeder Wartung drucklos schalten. ".repeat(200)}Ende hinter der Grenze.`;
    expect(lang.length).toBeGreaterThan(8000);
    const { rufe, fetchFn } = sonde({ duplicates: [] });
    const ergebnis = await ausgelieferterWeg()("tastenruhe", () => lang, fetchFn);
    expect(JSON.parse(String(rufe[0]?.init.body)).text.length).toBe(8000);
    expect(ergebnis).toEqual({ lage: "leer", gekuerzt: true, treffer: [] });
    // Ein Text innerhalb der Grenze ist NICHT gekuerzt.
    const kurz = sonde({ duplicates: [] });
    expect(await ausgelieferterWeg()("tastenruhe", () => LANG, kurz.fetchFn)).toEqual({
      lage: "leer",
      gekuerzt: false,
      treffer: [],
    });
  });

  it("W6-5 · FAIL-CLOSED: zu kurzer Text wird gar nicht erst gerufen", async () => {
    // `check-text-routes.ts:20` verlangt 40 Zeichen. Ein kuerzerer Ruf waere ein sicherer 400 —
    // und ein 400 je Schreibpause waere Laerm ohne Nutzen.
    const { rufe, fetchFn } = sonde({ duplicates: [{ koId: "ko-1", koTitle: "T" }] });
    const ergebnis = await ausgelieferterWeg()("tastenruhe", () => "zu kurz", fetchFn);
    expect(rufe.length, "ein zu kurzer Text wurde trotzdem gesendet").toBe(0);
    expect(ergebnis).toEqual(OHNE("zu-kurz"));
  });

  it("W6-6 · FAIL-CLOSED: Fehlerantwort, kaputter Koerper und Ausnahme schweigen alle — als Lage „fehler“, nie als Leere", async () => {
    const weg = ausgelieferterWeg();

    const fehler = sonde({ duplicates: [{ koId: "ko-1", koTitle: "T" }] }, false);
    expect(await weg("tastenruhe", () => LANG, fehler.fetchFn)).toEqual(OHNE("fehler"));

    const kaputt = sonde({ nichts: true });
    expect(await weg("tastenruhe", () => LANG, kaputt.fetchFn)).toEqual(OHNE("fehler"));

    const wirft = () => Promise.reject(new Error("offline"));
    expect(await weg("tastenruhe", () => LANG, wirft as never)).toEqual(OHNE("fehler"));

    // Und ohne Textquelle passiert gar nichts.
    expect(await weg("tastenruhe", (() => undefined) as never, kaputt.fetchFn)).toEqual(
      OHNE("fehler"),
    );
  });

  it("W6-7 · der Weg besetzt den VERTRAGSORT nicht — kein zweiter Anbieter", async () => {
    // Die Grenze dieses Durchgangs, als Zusicherung statt als Zusage im Text: `taskpane.html`
    // haengt die Funktion NICHT an `window.klaraBestandsblick`. Der Slot gehoert PRO3 (1571 D3);
    // zwei Anbieter an einem Slot waeren der zweite Weg aus ENTSCHEIDUNGEN/JOB-646.md.
    //
    // EINGEGRENZT AM 21.08. (CHEF), nachdem PRO3 den Fehlalarm gemeldet statt weggeraeumt hat:
    // Bis KA2 gebaut war, enthielt die Datei GAR KEINE solche Zuweisung, und eine Suche ueber die
    // ganze Datei war deshalb unauffaellig richtig. Seit JOB 1571 D5 steht dort GENAU EINE — die
    // von Regel A, also die des rechtmaessigen Eigentuemers (ENTSCHEIDUNGEN/JOB-1571.md). Eine
    // Zeichenkettensuche ueber die ganze Datei kann den Eigentuemer nicht vom Eindringling
    // unterscheiden; sie fiel damit ueber genau den Bau, den sie schuetzen sollte.
    // Gemessen wird ab jetzt NUR der W6-Block — also genau die erklaerte Absicht dieses Falls.
    // Der Waechter bleibt scharf: nimmt W6 sich den Slot, wird er weiterhin rot.
    const w6Start = HTML.indexOf("KW-KLARA-W6-CHECKTEXT-START");
    const w6Ende = HTML.indexOf("KW-KLARA-W6-CHECKTEXT-END");
    expect(w6Start, "der W6-Block fehlt in taskpane.html").toBeGreaterThan(-1);
    expect(w6Ende, "das Ende des W6-Blocks fehlt in taskpane.html").toBeGreaterThan(w6Start);
    const w6Block = HTML.slice(w6Start, w6Ende);
    expect(
      w6Block,
      "der Weg hat sich den Vertragsort genommen — das ist PRO3s Gebiet (1571 D3)",
    ).not.toContain("window.klaraBestandsblick =");
    expect(w6Block).not.toContain("window.klaraBestandsblick=");
    // Der Konsument liest ihn weiterhin — die Uebergabestelle bleibt, wie sie war.
    expect(HTML, "der KA2-Vertrag wird nicht mehr gelesen").toContain(
      "var vertrag = window.klaraBestandsblick;",
    );
  });

  it("W6-8 · die Dubletten-Kette selbst ist unberuehrt", () => {
    // §GR: `check-text-routes.ts` bleibt unberuehrt (JOB 989/686/631). Dieser Fall haelt fest,
    // dass der Weg die Route BENUTZT und nicht veraendert — er kennt nur ihren Pfad und ihre
    // beiden Grenzen.
    const route = readFileSync(
      resolve(process.cwd(), "services/app/src/routes/check-text-routes.ts"),
      "utf8",
    );
    expect(route).toContain("const MIN_TEXT = 40;");
    expect(route).toContain("const MAX_TEXT = 8_000;");
    expect(HTML).toContain("var W6_MINDESTZEICHEN = 40;");
    expect(HTML).toContain("var W6_HOECHSTZEICHEN = 8000;");
  });
});
