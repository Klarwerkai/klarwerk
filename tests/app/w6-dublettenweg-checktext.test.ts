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

type Weg = (
  grund: string,
  leseText: (grund: string) => unknown,
  fetchFn: (url: string, init: Record<string, unknown>) => Promise<unknown>,
  sprache?: string,
) => Promise<{ treffer: { id: string; title: string; status: null }[] }>;

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

  it("W6-2 · die Antwort wird in die VERTRAGSFORM uebersetzt — id, title, status", async () => {
    const { fetchFn } = sonde({
      duplicates: [
        { koId: "ko-1", koTitle: "Ventilwartung", relation: "identisch", confidence: 0.9 },
        { koId: "ko-2", koTitle: "Druckentlastung", relation: "teilweise", confidence: null },
      ],
    });
    const ergebnis = await ausgelieferterWeg()("tastenruhe", () => LANG, fetchFn);

    expect(ergebnis).toEqual({
      treffer: [
        { id: "ko-1", title: "Ventilwartung", status: null },
        { id: "ko-2", title: "Druckentlastung", status: null },
      ],
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

  it("W6-4 · ein Eintrag OHNE Kennung ist kein Treffer", async () => {
    const { fetchFn } = sonde({
      duplicates: [{ koTitle: "ohne Id" }, { koId: "", koTitle: "leer" }, { koId: "ko-3" }],
    });
    const ergebnis = await ausgelieferterWeg()("tastenruhe", () => LANG, fetchFn);
    expect(ergebnis).toEqual({ treffer: [{ id: "ko-3", title: "", status: null }] });
  });

  it("W6-5 · FAIL-CLOSED: zu kurzer Text wird gar nicht erst gerufen", async () => {
    // `check-text-routes.ts:20` verlangt 40 Zeichen. Ein kuerzerer Ruf waere ein sicherer 400 —
    // und ein 400 je Schreibpause waere Laerm ohne Nutzen.
    const { rufe, fetchFn } = sonde({ duplicates: [{ koId: "ko-1", koTitle: "T" }] });
    const ergebnis = await ausgelieferterWeg()("tastenruhe", () => "zu kurz", fetchFn);
    expect(rufe.length, "ein zu kurzer Text wurde trotzdem gesendet").toBe(0);
    expect(ergebnis).toEqual({ treffer: [] });
  });

  it("W6-6 · FAIL-CLOSED: Fehlerantwort, kaputter Koerper und Ausnahme schweigen alle", async () => {
    const weg = ausgelieferterWeg();

    const fehler = sonde({ duplicates: [{ koId: "ko-1", koTitle: "T" }] }, false);
    expect(await weg("tastenruhe", () => LANG, fehler.fetchFn)).toEqual({ treffer: [] });

    const kaputt = sonde({ nichts: true });
    expect(await weg("tastenruhe", () => LANG, kaputt.fetchFn)).toEqual({ treffer: [] });

    const wirft = () => Promise.reject(new Error("offline"));
    expect(await weg("tastenruhe", () => LANG, wirft as never)).toEqual({ treffer: [] });

    // Und ohne Textquelle passiert gar nichts.
    expect(await weg("tastenruhe", (() => undefined) as never, kaputt.fetchFn)).toEqual({
      treffer: [],
    });
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
