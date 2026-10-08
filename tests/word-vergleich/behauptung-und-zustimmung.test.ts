// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG „GESCHRIEBENE BEHAUPTUNGEN GEGEN DEN WISSENSBESTAND PRUEFEN" (R-0336, R-0708).
// ================================================================================================
//
// R-0336: „Man markiert in einem bestehenden Dokument eine Behauptung, und Klara sagt eines von
// drei Dingen: gedeckt (mit Quelle und Zitat), im Widerspruch (mit der Gegenquelle) oder dazu
// wissen wir nichts." Gemessen an „Markierung pruefen" (`#wv-markierung`) im Block
// KW-WORDVERGLEICH: derselbe Weg zur Route und dieselbe Einstufung wie „Dokument pruefen", nur ueber
// den markierten Text — und ohne ein Zeichen oder eine Farbe ins Dokument zu schreiben.
//
// R-0708: „Das Word-Seitenfenster behaelt seinen eigenen Pruefweg und bekommt eine ausdrueckliche
// Zustimmung, auch nicht validierten Bestand einzubeziehen. Der Weg der Erfassung bleibt davon
// getrennt." Gemessen am Rumpf, den der Pruefweg an `POST /api/check-text` schickt
// (`ungeprueftEinbeziehen`), am Standsatz, der die Reichweite des Laufs nennt, und am Bestandsweg
// („Haben wir das schon?"), der das Feld NICHT schickt. Was die Route mit dem Feld tut, misst
// `tests/text-gegen-wissen/zustimmung-an-der-route.test.ts` an der echten Route.
//
// Wie `absatzvergleich-mounted.test.ts`: das ausgelieferte Fenster (`createKlaraPanel`) gegen den
// nachgebauten Word-Host (`createWordBuehne`), die Antworten in der Form von `toResponse`/
// `toSourceHitResponse` (check-text-routes.ts). Die erwarteten Saetze stehen WOERTLICH hier.
import { afterEach, describe, expect, it } from "vitest";
import type { FakeReplyInit, FetchCall, KlaraPanel } from "../app/klara-panel-fixture";
import { reply } from "../app/klara-panel-fixture";
import { type WordBuehne, createWordBuehne, starteMitWord } from "./word-buehne";

const GEDECKT =
  "Vor jeder Wartung an der Presse P2 ist der Hauptschalter abzuschliessen und der Druck im " +
  "Hydrauliksystem vollstaendig abzubauen.";

const WIDERSPRUCH =
  "Die Schutzhaube der Presse P2 darf waehrend des Probelaufs geoeffnet bleiben, wenn ein zweiter " +
  "Mitarbeiter danebensteht.";

const UNBEKANNT =
  "Die neue Absauganlage an Linie 7 wird jeden Freitag von der Fruehschicht auf Filterbruch " +
  "durchgesehen.";

/** Der Ausschnitt der Quelle, in dem die Behauptung woertlich steht (`fundstelle` der Route). */
const FUNDSTELLE = `… Abschnitt 4.2: ${GEDECKT} Erst danach darf die Haube auf. …`;
const GEGENSTELLE = "Die Schutzhaube bleibt in jedem Betriebszustand geschlossen.";

// ------------------------------------------------------------------------------------------------
// Antwortbausteine — die Form der Route.
// ------------------------------------------------------------------------------------------------
function fundort(id: string, bereich: string): Record<string, unknown> {
  return { kategorie: bereich, bereich, bibliothekPfad: `/wissen/${id}` };
}

function quellenfund(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    refId: "ko-77",
    koTitle: "BAADER Betriebsanweisung Presse P2",
    koStatus: "validiert",
    koCategory: "Instandhaltung",
    pruefstand: "validiert",
    version: 4,
    fundort: fundort("ko-77", "Instandhaltung"),
    coverage: "full",
    gedeckteZeichen: GEDECKT.length,
    passageZeichen: GEDECKT.length,
    fundstelle: FUNDSTELLE,
    quelle: { label: "Betriebsanweisung BA-P2", url: null },
    anhang: null,
    ...over,
  };
}

function konflikt(): Record<string, unknown> {
  return {
    koId: "ko-9",
    koTitle: "Sicherheitsregel Schutzhaube",
    type: "truth",
    confidence: 0.9,
    method: "judge",
    rationale: "Der Text erlaubt, was die Regelung verbietet.",
    koStatus: "validiert",
    koCategory: "Arbeitssicherheit",
    pruefstand: "validiert",
    version: 3,
    fundort: fundort("ko-9", "Arbeitssicherheit"),
    stellen: { eigen: "darf waehrend des Probelaufs geoeffnet bleiben", quelle: GEGENSTELLE },
  };
}

function antwort(
  o: { conflicts?: unknown[]; sourceHits?: unknown[]; konfliktGelaufen?: boolean } = {},
): Record<string, unknown> {
  return {
    duplicates: [],
    conflicts: o.conflicts ?? [],
    konfliktpruefung: {
      gelaufen: o.konfliktGelaufen ?? false,
      grund: o.konfliktGelaufen === true ? null : "nicht_angefordert",
      kandidaten: 0,
      ausgefallen: 0,
      verworfen: 0,
    },
    answer: null,
    note: null,
    persisted: false,
    sourceHits: o.sourceHits ?? [],
    sourceHitsTruncated: false,
    quellenfund: { gelaufen: true, grund: null, geprueft: 3 },
  };
}

/** Die Route antwortet je nach GESENDETEM Text. */
function jeText(tabelle: Array<{ enthaelt: string; koerper: Record<string, unknown> }>) {
  return (_url: string, init: Record<string, unknown> | undefined): FakeReplyInit => {
    const roh = typeof init?.body === "string" ? init.body : "";
    for (const zeile of tabelle) {
      if (roh.includes(zeile.enthaelt)) {
        return reply(200, zeile.koerper);
      }
    }
    return reply(200, antwort());
  };
}

const DREI_LAGEN = jeText([
  { enthaelt: "Hauptschalter abzuschliessen", koerper: antwort({ sourceHits: [quellenfund()] }) },
  {
    enthaelt: "Schutzhaube der Presse P2 darf",
    koerper: antwort({ conflicts: [konflikt()], konfliktGelaufen: true }),
  },
  { enthaelt: "Absauganlage an Linie 7", koerper: antwort() },
]);

// ------------------------------------------------------------------------------------------------
// Buehne
// ------------------------------------------------------------------------------------------------
let panel: KlaraPanel | null = null;
let abKlick = 0;

afterEach(() => {
  panel?.restore();
  panel = null;
});

/** Ein Dokument mit allen drei Saetzen — markiert ist genau einer. */
function dokumentMit(markierung: string): WordBuehne {
  const absaetze = [{ text: GEDECKT }, { text: WIDERSPRUCH }, { text: UNBEKANNT }];
  return createWordBuehne(absaetze, { markierung });
}

function starte(buehne: WordBuehne, selectionText?: string): KlaraPanel {
  panel = starteMitWord(
    { "/api/check-text": DREI_LAGEN },
    buehne,
    selectionText === undefined ? {} : { selectionText },
  );
  return panel;
}

async function klicke(p: KlaraPanel, selektor: string): Promise<void> {
  await p.flush();
  const knopf = p.q(selektor);
  expect(knopf, `${selektor} fehlt`).not.toBeNull();
  abKlick = p.calls.length;
  (knopf as { click(): void }).click();
  for (let i = 0; i < 10; i += 1) {
    await p.flush();
  }
}

function checkTextRufe(p: KlaraPanel): FetchCall[] {
  return p.calls.slice(abKlick).filter((c) => c.url === "/api/check-text");
}

function rumpf(ruf: FetchCall | undefined): Record<string, unknown> {
  expect(ruf, "kein Abruf an /api/check-text").toBeDefined();
  return JSON.parse(ruf?.body ?? "{}") as Record<string, unknown>;
}

function zustimmungSetzen(p: KlaraPanel): void {
  const haken = p.q("#wv-ungeprueft") as unknown as { checked: boolean; click(): void } | null;
  expect(haken, "der Haken der Zustimmung fehlt").not.toBeNull();
  expect(haken?.checked, "die Zustimmung muss AUS beginnen").toBe(false);
  haken?.click();
  expect(haken?.checked).toBe(true);
}

// ================================================================================================
describe("R-0336 · eine markierte Behauptung — gedeckt, im Widerspruch oder kein Fund", () => {
  it("M1 · gedeckt: Quelle, Prüfstand und die belegende Stelle der Quelle als Zitat", async () => {
    const buehne = dokumentMit(GEDECKT);
    const p = starte(buehne);
    await klicke(p, "#wv-markierung");

    // Genau EIN Abruf, und er traegt die Markierung — nicht einen Absatz, nicht das Dokument.
    const rufe = checkTextRufe(p);
    expect(rufe).toHaveLength(1);
    expect(rumpf(rufe[0]).text).toBe(GEDECKT);

    const liste = p.text("#wv-liste");
    expect(liste).toContain("Markierte Stelle");
    expect(liste).toContain("Wörtlich im Bestand belegt");
    expect(liste).toContain("BAADER Betriebsanweisung Presse P2");
    expect(liste).toContain("Validiert");
    expect(liste).toContain(`Die Quelle sagt: „${FUNDSTELLE}“`);
    expect(p.text("#wv-stand")).toContain("Markierung abgeglichen · ");
    expect(p.text("#wv-stand")).toContain("Klara hat nichts im Dokument verändert.");
  });

  it("M2 · im Widerspruch: die Gegenquelle und ihre Stelle — Klara entscheidet nichts", async () => {
    const buehne = dokumentMit(WIDERSPRUCH);
    const p = starte(buehne);
    await klicke(p, "#wv-markierung");
    const liste = p.text("#wv-liste");
    expect(liste).toContain("Widerspruch zu einem Eintrag");
    expect(liste).toContain("Sicherheitsregel Schutzhaube");
    expect(liste).toContain(`Die Quelle sagt: „${GEGENSTELLE}“`);
    expect(liste).toContain("Klara entscheidet nichts");
  });

  it("M3 · dazu wissen wir nichts: kein Fund im durchsuchten Bestand", async () => {
    const buehne = dokumentMit(UNBEKANNT);
    const p = starte(buehne);
    await klicke(p, "#wv-markierung");
    const liste = p.text("#wv-liste");
    expect(liste).toContain("Kein Fund im durchsuchten Bestand");
    expect(liste).not.toContain("Wörtlich im Bestand belegt");
    expect(liste).not.toContain("Widerspruch zu einem Eintrag");
  });

  it("M4 · der Abgleich der Markierung schreibt nichts: kein Text, keine Farbe, kein Sprung", async () => {
    const buehne = dokumentMit(GEDECKT);
    const p = starte(buehne);
    await klicke(p, "#wv-markierung");
    // Kalibrierung: es gab wirklich einen Befund, der sonst eine Farbe bekaeme (gruen).
    expect(p.text("#wv-liste")).toContain("Wörtlich im Bestand belegt");
    expect(buehne.farben()).toEqual([null, null, null]);
    expect(buehne.mitschrift.schreib).toEqual([]);
    expect(buehne.texte()).toEqual([GEDECKT, WIDERSPRUCH, UNBEKANNT]);
    expect(p.q("#wv-liste button[data-wv-sprung]")).toBeNull();
    // GEGENPROBE: derselbe Satz ueber „Dokument pruefen" wird gefaerbt — die Farblosigkeit oben
    // ist also eine Eigenschaft des Markierungswegs und nicht der Buehne.
    await klicke(p, "#wv-btn");
    expect(buehne.farben()[0]).toBe("BrightGreen");
  });

  it("M5 · ohne Markierung: kein Abruf, und der Satz sagt, was fehlt", async () => {
    const buehne = dokumentMit("");
    const p = starte(buehne);
    await klicke(p, "#wv-markierung");
    expect(checkTextRufe(p)).toEqual([]);
    expect(p.text("#wv-stand")).toContain(
      "Markiere in Word die Behauptung, die Klara mit dem Bestand abgleichen soll.",
    );
    expect(p.text("#wv-liste")).toBe("");
  });

  it("M6 · EN: dieselbe Aussage nach dem Sprachwechsel", async () => {
    const buehne = dokumentMit(GEDECKT);
    const p = starte(buehne);
    await klicke(p, "#wv-markierung");
    p.setLang("en");
    await p.flush();
    expect(p.text("#wv-markierung")).toBe("Check selection");
    expect(p.text("#wv-liste")).toContain("Found verbatim in the knowledge base");
    expect(p.text("#wv-liste")).toContain(`The source says: “${FUNDSTELLE}”`);
  });
});

// ================================================================================================
describe("R-0708 · die ausdrückliche Zustimmung zum noch nicht validierten Bestand", () => {
  it("Z1 · ohne Zustimmung fragt der Prüfweg nur nach Validiertem — und sagt es", async () => {
    const buehne = dokumentMit(GEDECKT);
    const p = starte(buehne);
    await klicke(p, "#wv-markierung");
    expect(rumpf(checkTextRufe(p)[0]).ungeprueftEinbeziehen).toBe(false);
    expect(p.text("#wv-stand")).toContain("Abgeglichen nur mit validiertem Bestand.");
  });

  it("Z2 · mit Zustimmung schickt der Prüfweg sie ausdrücklich mit — und sagt es", async () => {
    const buehne = dokumentMit(GEDECKT);
    const p = starte(buehne);
    await p.flush();
    zustimmungSetzen(p);
    await klicke(p, "#wv-markierung");
    expect(rumpf(checkTextRufe(p)[0]).ungeprueftEinbeziehen).toBe(true);
    expect(p.text("#wv-stand")).toContain(
      "Mit deiner Zustimmung auch mit noch nicht validiertem Bestand abgeglichen.",
    );
  });

  it("Z3 · „Dokument prüfen“ trägt dieselbe Zustimmung — in JEDEM Abruf des Laufs", async () => {
    const ohne = starte(dokumentMit(""));
    await klicke(ohne, "#wv-btn");
    const rufeOhne = checkTextRufe(ohne);
    expect(rufeOhne).toHaveLength(3);
    for (const ruf of rufeOhne) {
      expect(rumpf(ruf).ungeprueftEinbeziehen).toBe(false);
    }
    ohne.restore();

    const mit = starte(dokumentMit(""));
    await mit.flush();
    zustimmungSetzen(mit);
    await klicke(mit, "#wv-btn");
    const rufeMit = checkTextRufe(mit);
    expect(rufeMit).toHaveLength(3);
    for (const ruf of rufeMit) {
      expect(rumpf(ruf).ungeprueftEinbeziehen).toBe(true);
    }
  });

  it("Z4 · der Weg der Erfassung bleibt getrennt: „Haben wir das schon?“ schickt das Feld nicht", async () => {
    // Auch mit gesetzter Zustimmung: der Bestandsweg stellt seine eigene Frage (JOB 3020).
    const buehne = dokumentMit(GEDECKT);
    const p = starte(buehne, GEDECKT);
    await p.flush();
    zustimmungSetzen(p);
    await klicke(p, "#bestand-btn");
    // Kalibrierung: der Bestandsweg hat wirklich gefragt — sonst bewiese die Abwesenheit nichts.
    const nachKlick = checkTextRufe(p);
    expect(nachKlick.length).toBeGreaterThanOrEqual(1);
    expect(rumpf(nachKlick[0]).text).toBe(GEDECKT);
    // Kein Abruf dieses Fensters ausserhalb des Pruefwegs traegt das Feld — weder der Bestandsweg
    // noch die Dublettenpruefung der Erfassen-Flaeche, die bei stehender Markierung von selbst fragt.
    const alle = p.calls.filter((c) => c.url === "/api/check-text");
    for (const ruf of alle) {
      expect(ruf.body ?? "").not.toContain("ungeprueftEinbeziehen");
    }
  });
});
