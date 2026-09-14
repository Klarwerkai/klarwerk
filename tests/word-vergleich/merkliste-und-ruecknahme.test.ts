// @vitest-environment jsdom
// ================================================================================================
// JOB 3281 · WORD-VERGLEICH — DIE MERKLISTE: KLARA NIMMT NUR IHRE EIGENEN FARBEN ZURUECK.
// ================================================================================================
//
// Codex' Nachfuehrung vom 08.09. (verbindlich) steht hier als Messung:
//   · Eine VORHANDENE Hervorhebung wird weder ueberschrieben noch verloren. Der Absatz wird
//     trotzdem im Panel eingestuft — mit Hinweis, nicht mit Farbe.
//   · „Markierungen entfernen" nimmt NUR Klaras eigene Farben zurueck und schreibt dabei
//     gemessen „keine Farbe" (`null`) — siehe den Block JOB 3892 unten. Bis 13.09. stand an
//     dieser Stelle „stellt die URSPRUNGSFARBE wieder her, nicht ‚keine Farbe'". Das war eine
//     Behauptung ohne Messung und ist falsch; der Satz ist ersetzt, nicht ergaenzt.
//   · Die Merkliste haengt am TEXT-HASH, nicht an der Absatznummer: verschiebt sich ein Absatz,
//     findet die Ruecknahme ihn trotzdem; aendert sich sein Text, wird NICHTS blind entfaerbt —
//     der Posten wird als „veraendert" gemeldet.
//
// ================================================================================================
// JOB 3892 · WAS DIE RUECKNAHME WIRKLICH SCHREIBT — GEMESSEN STATT BEHAUPTET (13.09.2026).
// ================================================================================================
//
// HERKUNFT: `jobs/3873/runde-1/RUECKGABE.md`, Abschnitt REST. Jener Job hat die Ruecknahmezeile im
// Produkt auf `null` verstellt und an 41 Faellen KEINE Reaktion bekommen (Gegenprobe V2): kein
// einziger Fall las, welcher Wert geschrieben wird. Die Zeile war ungedeckt, der Kopfsatz hier
// behauptete trotzdem eine Wiederherstellung.
//
// BEFUND, an drei Produktzeilen nachgelesen (Zeilennummern vom Stand ece535b, der ANKER ist der
// Funktionsname — die Nummern wandern):
//   · `taskpane.html:12876` — jede Zeile traegt `fremdeFarbe: absatz.vorher !== null`.
//   · `taskpane.html:12898` — in den Faerbeauftrag kommt nur, was `!z.fremdeFarbe` ist; ein Absatz
//     mit vorhandener Hervorhebung wird also nie gefaerbt und nie vorgemerkt.
//   · `taskpane.html:12982` — die Ruecknahme schreibt `p.posten.vorher`. Weil ein Posten mit
//     `vorher !== null` nach den zwei Zeilen darueber gar nicht entstehen kann, ist dieser Wert
//     auf JEDEM heute erreichbaren Weg `null`. Die Zeile ist Vorsorge, kein erreichbarer Weg.
//
// Das ist KEIN Produktfehler: fremde Hervorhebungen ueberleben nachweislich (D1, D2, D8). Falsch
// war nur die Behauptung. D7 misst deshalb den TATSAECHLICH geschriebenen Wert, D8 die Kette, aus
// der er folgt, und D9/D10 halten beide Bausteine im Quelltext fest.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { FakeReplyInit, KlaraPanel } from "../app/klara-panel-fixture";
import { TASKPANE_PATH, reply, splitTaskpane } from "../app/klara-panel-fixture";
import { type WordBuehne, createWordBuehne, starteMitWord } from "./word-buehne";

const A =
  "Vor jeder Wartung an der Presse P2 ist der Hauptschalter abzuschliessen und der Druck " +
  "abzubauen.";
const B = "Die neue Absauganlage an Linie 7 wird jeden Freitag von der Fruehschicht durchgesehen.";
const C = "Der Gabelstapler wird vor Schichtbeginn auf Bremsen, Hupe und Hubkette angesehen.";

function leereAntwort(): Record<string, unknown> {
  return {
    duplicates: [],
    conflicts: [],
    konfliktpruefung: { gelaufen: false, grund: "nicht_angefordert" },
    answer: null,
    note: null,
    persisted: false,
    sourceHits: [],
    sourceHitsTruncated: false,
    quellenfund: { gelaufen: true, grund: null, geprueft: 2 },
  };
}

/** Jeder Absatz kommt als „kein Fund" zurueck — dann faerbt der Weg alles Tuerkis, und die
 *  Ruecknahme ist an EINER Farbe messbar. Um die Einstufung geht es hier nicht. */
const ALLES_NEU: Record<string, FakeReplyInit> = {
  "/api/check-text": reply(200, leereAntwort()),
};

let panel: KlaraPanel | null = null;

function starte(buehne: WordBuehne): KlaraPanel {
  panel = starteMitWord(ALLES_NEU, buehne);
  return panel;
}

async function pruefe(p: KlaraPanel): Promise<void> {
  await p.flush();
  const knopf = p.q("#wv-btn");
  expect(knopf, "der Knopf „Dokument pruefen“ fehlt").not.toBeNull();
  (knopf as { click(): void }).click();
  for (let i = 0; i < 10; i += 1) {
    await p.flush();
  }
}

async function entferne(p: KlaraPanel): Promise<void> {
  const knopf = p.q("#wv-entfernen");
  expect(knopf, "der Knopf „Markierungen entfernen“ fehlt").not.toBeNull();
  (knopf as { click(): void }).click();
  for (let i = 0; i < 6; i += 1) {
    await p.flush();
  }
}

// ------------------------------------------------------------------------------------------------
// JOB 3892 · DIE SCHREIBMITSCHRIFT — WELCHER WERT WIRKLICH INS DOKUMENT GEHT.
// ------------------------------------------------------------------------------------------------
// `buehne.farben()` sagt, was am ENDE dasteht. Das reicht nicht: „die Farbe ist weg" bestehen
// `null`, `undefined` und `""` gleichermassen, und genau deshalb blieb JOB 3873 V2 gruen. Der
// Horcher haengt sich in `Word.run` DERSELBEN Buehne (keine zweite Buehne, keine Aenderung an
// `word-buehne.ts`) und ersetzt an ihren Absaetzen `font.highlightColor` durch ein Paar aus Lesen
// und Schreiben: gelesen wird weiter derselbe Wert, zusaetzlich steht jetzt fest, WELCHER Wert
// geschrieben wurde und auf welchen Absatz.

interface Schreibung {
  /** Der Text des Absatzes, auf den geschrieben wurde — stabiler als seine Nummer. */
  text: string;
  /** Der geschriebene Wert, unveraendert weitergereicht: `null` heisst „keine Hervorhebung". */
  wert: string | null | undefined;
}

interface HorchAbsatz {
  text: string;
  font: { highlightColor: string | null };
}

interface HorchKontext {
  document: { body: { paragraphs: { items: HorchAbsatz[] } } };
}

type HorchLauf = (rueckruf: (ctx: HorchKontext) => Promise<unknown>) => Promise<unknown>;

function horcheAufFarbschreiben(buehne: WordBuehne): Schreibung[] {
  const schreibungen: Schreibung[] = [];
  const verkabelt = new WeakSet<object>();
  const lauf = buehne.Word.run as HorchLauf;
  buehne.Word.run = (rueckruf: (ctx: HorchKontext) => Promise<unknown>): Promise<unknown> =>
    lauf((ctx) => {
      for (const absatz of ctx.document.body.paragraphs.items) {
        if (verkabelt.has(absatz)) {
          continue;
        }
        verkabelt.add(absatz);
        let wert: string | null | undefined = absatz.font.highlightColor;
        Object.defineProperty(absatz.font, "highlightColor", {
          configurable: true,
          enumerable: true,
          get: (): string | null | undefined => wert,
          set: (neu: string | null | undefined): void => {
            wert = neu;
            schreibungen.push({ text: absatz.text, wert: neu });
          },
        });
      }
      return rueckruf(ctx);
    });
  return schreibungen;
}

/** Alle Schreibvorgaenge auf diesen Absatz — nach Text, nicht nach Nummer (die verschiebt sich). */
function schreibungenAuf(schreibungen: readonly Schreibung[], text: string): Schreibung[] {
  return schreibungen.filter((s) => s.text === text);
}

/** Wie ein Wert in einer Fehlermeldung dasteht: `null` und `"Yellow"` duerfen nie gleich aussehen. */
function wertWort(wert: string | null | undefined): string {
  return wert === undefined ? "undefined" : JSON.stringify(wert);
}

// ------------------------------------------------------------------------------------------------
// JOB 3892 · DER QUELLTEXT-WAECHTER — AUSFUEHRBARE STELLEN, KEINE KOMMENTARE.
// ------------------------------------------------------------------------------------------------
// Gelesen wird die AUSGELIEFERTE Seite, und zwar ueber `TASKPANE_PATH` der Panel-Fixture: dort
// wohnt das Pfadwissen ohnehin (`splitTaskpane` schneidet fuer jeden Fall dieser Datei dasselbe
// Skript heraus). Deshalb bleibt diese Datei im Mitfahrer-Verzeichnis
// `tests/klara-zerlegung/schnitt-pins.test.ts` genau der Griff, der sie heute traegt: `fixture`.
//
// Vor jedem Vergleich fallen Kommentare weg. Das ist die Stelle, an der Codex schon zweimal einen
// Waechter zerlegt hat (Lehren 3564 R2, 3565 R1, 3838 R1): ein Kommentar, der die gesuchte Stelle
// nur BESCHREIBT, darf ihn nicht befriedigen — und ein zu grober Filter darf keinen Code fuer
// einen Kommentar halten. Im Skript stehen beide Fallen wirklich: `/[‘’‚‛′´`]/g` (ein Backtick
// MITTEN in einem regulaeren Ausdruck) und `return /…/i.test(…)`. Der Leser unten ist deshalb ein
// kleiner Zustandsautomat ueber Zeichenketten, regulaere Ausdruecke und Kommentare; D10 misst an
// beiden Fallen nach, dass er sie nicht verwechselt.

const TASKPANE_QUELLE = readFileSync(resolve(process.cwd(), TASKPANE_PATH), "utf8");
const TASKPANE_SKRIPT = splitTaskpane(TASKPANE_QUELLE).script;
const SKRIPT_ANFANG = TASKPANE_QUELLE.indexOf(TASKPANE_SKRIPT);

interface Quelltext {
  /** Der Code mit Kommentaren als Leerzeichen — Laenge und Zeilenumbrueche bleiben erhalten. */
  code: string;
  /** Derselbe Text, zusaetzlich mit geleerten Zeichenketten und Ausdruecken — fuer Klammerzaehlung. */
  maske: string;
}

/** Vor diesen Woertern beginnt ein `/` einen regulaeren Ausdruck, keine Division. */
const REGEX_WOERTER = new Set([
  "return",
  "typeof",
  "instanceof",
  "case",
  "in",
  "of",
  "new",
  "delete",
  "void",
  "throw",
  "do",
  "else",
]);

function beginntRegex(bisher: string): boolean {
  const rest = bisher.replace(/\s+$/, "");
  if (rest.length === 0) {
    return true;
  }
  const letztes = rest[rest.length - 1] as string;
  if (/[A-Za-z0-9_$)\]]/.test(letztes)) {
    const wort = /[A-Za-z_$][A-Za-z0-9_$]*$/.exec(rest);
    return wort !== null && REGEX_WOERTER.has(wort[0]);
  }
  return true;
}

function lesbarerCode(quelle: string): Quelltext {
  let code = "";
  let maske = "";
  let i = 0;
  const leer = (zeichen: string): string => (zeichen === "\n" ? "\n" : " ");
  while (i < quelle.length) {
    const z = quelle[i] as string;
    const n = quelle[i + 1];
    if (z === "/" && n === "*") {
      while (i < quelle.length && !(quelle[i] === "*" && quelle[i + 1] === "/")) {
        code += leer(quelle[i] as string);
        maske += leer(quelle[i] as string);
        i += 1;
      }
      code += "  ";
      maske += "  ";
      i += 2;
      continue;
    }
    if (z === "/" && n === "/") {
      while (i < quelle.length && quelle[i] !== "\n") {
        code += " ";
        maske += " ";
        i += 1;
      }
      continue;
    }
    if (z === '"' || z === "'" || z === "`") {
      code += z;
      maske += z;
      i += 1;
      while (i < quelle.length && quelle[i] !== z) {
        const c = quelle[i] as string;
        if (c === "\\") {
          code += c + (quelle[i + 1] ?? "");
          maske += "  ";
          i += 2;
          continue;
        }
        code += c;
        maske += leer(c);
        i += 1;
      }
      code += quelle[i] ?? "";
      maske += quelle[i] ?? "";
      i += 1;
      continue;
    }
    if (z === "/" && beginntRegex(code)) {
      code += z;
      maske += z;
      i += 1;
      let klasse = false;
      while (i < quelle.length && !(quelle[i] === "/" && !klasse)) {
        const c = quelle[i] as string;
        if (c === "\\") {
          code += c + (quelle[i + 1] ?? "");
          maske += "  ";
          i += 2;
          continue;
        }
        if (c === "[") {
          klasse = true;
        } else if (c === "]") {
          klasse = false;
        }
        code += c;
        maske += leer(c);
        i += 1;
      }
      code += quelle[i] ?? "";
      maske += quelle[i] ?? "";
      i += 1;
      continue;
    }
    code += z;
    maske += z;
    i += 1;
  }
  return { code, maske };
}

const SKRIPT: Quelltext = lesbarerCode(TASKPANE_SKRIPT);

/** Die Zeile im HTML, auf die ein Index im Skript zeigt — fuer Fehlermeldungen, die man findet. */
function zeileImHtml(indexImSkript: number): number {
  return TASKPANE_QUELLE.slice(0, SKRIPT_ANFANG + indexImSkript).split("\n").length;
}

/** Der Rumpf genau dieser Funktion, Kommentare entfernt. Anker ist der Name, nicht die Zeile. */
function koerperVon(name: string): { text: string; zeile: number } {
  const kopf = SKRIPT.maske.indexOf(`function ${name}(`);
  expect(kopf, `im Skript des Aufgabenfensters fehlt \`function ${name}(\``).toBeGreaterThan(-1);
  const klammerAuf = SKRIPT.maske.indexOf("{", kopf);
  let tiefe = 0;
  for (let i = klammerAuf; i < SKRIPT.maske.length; i += 1) {
    if (SKRIPT.maske[i] === "{") {
      tiefe += 1;
    } else if (SKRIPT.maske[i] === "}") {
      tiefe -= 1;
      if (tiefe === 0) {
        return { text: SKRIPT.code.slice(klammerAuf, i + 1), zeile: zeileImHtml(kopf) };
      }
    }
  }
  throw new Error(`der Rumpf von \`${name}\` ist nicht geschlossen`);
}

/** Leerraum spielt keine Rolle: der Waechter prueft den Ausdruck, nicht seine Einrueckung. */
function eineZeile(text: string): string {
  return text.replace(/\s+/g, " ");
}

afterEach(() => {
  panel?.restore();
  panel = null;
});

describe("JOB 3281 · (d) Ruecknahme nimmt nur Klaras eigene Farben", () => {
  it("D1 · eine FREMDE Hervorhebung wird nicht ueberfaerbt — der Absatz steht trotzdem in der Liste", async () => {
    const buehne = createWordBuehne([{ text: A, highlightColor: "Pink" }, { text: B }]);
    const p = starte(buehne);
    await pruefe(p);
    // Die fremde Farbe bleibt Ziffer fuer Ziffer stehen; nur der freie Absatz bekommt Klaras Farbe.
    expect(buehne.farben()).toEqual(["Pink", "Turquoise"]);
    expect(p.text("#wv-liste")).toContain(
      "Der Absatz trägt bereits eine eigene Hervorhebung — Klara hat sie nicht überschrieben.",
    );
    // Und er ist trotzdem eingestuft — der Hinweis ersetzt die Aussage nicht.
    expect(p.text("#wv-liste")).toContain("Kein Fund im durchsuchten Bestand");
  });

  it("D2 · „Markierungen entfernen“ nimmt Klaras Farben zurueck und laesst die fremde stehen", async () => {
    // Der erste Absatz trug vor dem Lauf schon „Gray25" — aber von einem FRUEHEREN Klara-Lauf
    // weiss das Panel nichts; hier geht es um den Fall, den Codex benannt hat: ein Absatz OHNE
    // fremde Farbe wird gefaerbt und muss danach wieder farblos sein, waehrend ein Absatz MIT
    // fremder Farbe nie angefasst wurde und sie behaelt.
    // WELCHER Wert dabei geschrieben wird, misst dieser Fall NICHT — „Gray25, null, null" bestuende
    // auch eine Ruecknahme, die etwas anderes als `null` schreibt. Das misst D7 (JOB 3892).
    const buehne = createWordBuehne([
      { text: A, highlightColor: "Gray25" },
      { text: B },
      { text: C },
    ]);
    const p = starte(buehne);
    await pruefe(p);
    expect(buehne.farben()).toEqual(["Gray25", "Turquoise", "Turquoise"]);

    // Vor der Ruecknahme erklaert die Legende die Farben, die WIRKLICH im Dokument stehen.
    expect(p.text("#wv-legende")).toContain("Türkis");

    await entferne(p);
    expect(buehne.farben()).toEqual(["Gray25", null, null]);
    expect(p.text("#wv-stand")).toContain("2 Markierungen zurückgenommen");
    // Danach steht keine Farbe von Klara mehr im Dokument — also erklaert die Legende nichts mehr,
    // und keine Zeile behauptet eine Farbe, die niemand sieht. Der BEFUND bleibt sichtbar.
    expect(p.text("#wv-legende")).toBe("");
    expect(p.text("#wv-liste")).not.toContain("Türkis");
    expect(p.text("#wv-liste")).toContain("Kein Fund im durchsuchten Bestand");
  });

  it("D3 · ohne eigenen Lauf gibt es nichts zurueckzunehmen — und Klara sagt genau das", async () => {
    const buehne = createWordBuehne([{ text: A, highlightColor: "Pink" }]);
    const p = starte(buehne);
    await p.flush();
    // Der Knopf steht erst da, wenn Klara wirklich etwas gefaerbt hat.
    expect(p.q("#wv-entfernen")?.className.includes("hidden")).toBe(true);
    await pruefe(p);
    // Nur der fremd markierte Absatz — Klara hat nichts gefaerbt, also bleibt der Knopf weg.
    expect(buehne.farben()).toEqual(["Pink"]);
    expect(p.q("#wv-entfernen")?.className.includes("hidden")).toBe(true);
  });

  it("D4 · ein VERSCHOBENER Absatz wird ueber den Text-Hash wiedergefunden", async () => {
    const buehne = createWordBuehne([{ text: A }, { text: B }, { text: C }]);
    const p = starte(buehne);
    await pruefe(p);
    expect(buehne.farben()).toEqual(["Turquoise", "Turquoise", "Turquoise"]);

    // Der Mensch loescht den ersten Absatz: alle Nummern verschieben sich um eins.
    buehne.entferne(0);
    await entferne(p);
    expect(buehne.farben()).toEqual([null, null]);
    expect(p.text("#wv-stand")).toContain("2 Markierungen zurückgenommen");
    expect(p.text("#wv-stand")).toContain("1 Absätze haben sich seither verändert");
  });

  it("D5 · ein GEAENDERTER Absatz wird NICHT blind entfaerbt, sondern gemeldet", async () => {
    const buehne = createWordBuehne([{ text: A }, { text: B }]);
    const p = starte(buehne);
    await pruefe(p);
    expect(buehne.farben()).toEqual(["Turquoise", "Turquoise"]);

    buehne.aendere(1, "Ein voellig anderer Satz steht jetzt an dieser Stelle im Dokument.");
    await entferne(p);
    // Der unveraenderte Absatz ist zurueckgesetzt, der veraenderte bleibt unangetastet.
    expect(buehne.farben()).toEqual([null, "Turquoise"]);
    expect(p.text("#wv-stand")).toContain("1 Markierungen zurückgenommen");
    expect(p.text("#wv-stand")).toContain("1 Absätze haben sich seither verändert");
    // Und der Posten bleibt in der Merkliste — der Knopf verschwindet nicht.
    expect(p.q("#wv-entfernen")?.className.includes("hidden")).toBe(false);
  });

  it("D6 · ein zweiter Lauf merkt sich NICHT Klaras eigene Farbe als Ausgangswert", async () => {
    const buehne = createWordBuehne([{ text: A, highlightColor: null }]);
    const p = starte(buehne);
    await pruefe(p);
    expect(buehne.farben()).toEqual(["Turquoise"]);
    // Zweiter Lauf: der Absatz traegt jetzt Klaras Farbe. Wuerde sie als Ausgangswert (`vorher`)
    // gemerkt, liesse „entfernen" sie fuer immer stehen — `wvUrsprung` verhindert genau das.
    await pruefe(p);
    expect(buehne.farben()).toEqual(["Turquoise"]);
    await entferne(p);
    expect(buehne.farben()).toEqual([null]);
  });

  it("D7 · die Ruecknahme schreibt gemessen „keine Farbe“ — der Wert ist `null`, nicht irgendeiner", async () => {
    // Alle Absaetze kommen OHNE vorherige Hervorhebung: genau die Lage, in der die Merkliste
    // ueberhaupt entsteht (§5 Lieferung 1). Gemessen wird nicht „die Farbe ist weg", sondern der
    // Wert, den `wvEntfernen` (taskpane.html:12982) in `font.highlightColor` schreibt.
    const buehne = createWordBuehne([{ text: A }, { text: B }]);
    const schreibungen = horcheAufFarbschreiben(buehne);
    const p = starte(buehne);
    await pruefe(p);

    // Erst der Beleg, dass der Horcher wirklich am Schreibweg haengt: das Faerben steht drin, mit
    // Wert. Ohne diese Zeile bewiese ein leeres Protokoll nach der Ruecknahme gar nichts.
    expect(schreibungen, "kein Faerbeschreiben mitgeschnitten — der Horcher haengt nicht").toEqual([
      { text: A, wert: "Turquoise" },
      { text: B, wert: "Turquoise" },
    ]);
    const vorDerRuecknahme = schreibungen.length;

    await entferne(p);

    const zurueck = schreibungen.slice(vorDerRuecknahme);
    expect(
      zurueck.map((s) => s.text),
      "die Ruecknahme hat nicht genau die zwei gefaerbten Absaetze beschrieben",
    ).toEqual([A, B]);
    const warum =
      "Gemessen ist heute IMMER `null`: `posten.vorher` kann nichts anderes sein, weil ein " +
      "Absatz mit vorhandener Hervorhebung nie in die Merkliste kommt (`fremdeFarbe`, " +
      "taskpane.html:12876 und :12898). Wer die Zeile aendert, aendert diese Aussage.";
    for (const s of zurueck) {
      expect(
        s.wert === null,
        `wvEntfernen (taskpane.html:12982) hat ${wertWort(s.wert)} geschrieben. ${warum}`,
      ).toBe(true);
    }
    // Und das Ergebnis am Dokument stimmt mit dem ueberein, was geschrieben wurde.
    expect(buehne.farben()).toEqual([null, null]);
  });

  it("D8 · ein Absatz mit fremder Hervorhebung wird eingestuft, nie beschrieben, nie vorgemerkt", async () => {
    // Die Kette, aus der D7s Aussage folgt (§5 Lieferung 2): `fremdeFarbe` haelt den Absatz aus
    // dem Faerbeauftrag heraus, deshalb entsteht kein Posten mit Ausgangsfarbe, deshalb ist
    // `posten.vorher` immer `null`.
    const buehne = createWordBuehne([{ text: A, highlightColor: "Pink" }, { text: B }]);
    const schreibungen = horcheAufFarbschreiben(buehne);
    const p = starte(buehne);
    await pruefe(p);

    const nieBeschrieben =
      "Klara hat auf einen Absatz mit fremder Hervorhebung geschrieben. Entschieden wird das an " +
      "`fremdeFarbe` (taskpane.html:12876) und am Filter `!z.fremdeFarbe` vor dem Faerbeauftrag " +
      "(taskpane.html:12898); faellt einer von beiden, ist die Arbeit eines Menschen ueberschrieben.";
    expect(schreibungenAuf(schreibungen, A), nieBeschrieben).toEqual([]);
    expect(schreibungenAuf(schreibungen, B)).toEqual([{ text: B, wert: "Turquoise" }]);
    // Eingestuft ist er trotzdem — mit Hinweis, nicht mit Farbe.
    expect(p.text("#wv-liste")).toContain(
      "Der Absatz trägt bereits eine eigene Hervorhebung — Klara hat sie nicht überschrieben.",
    );
    expect(p.text("#wv-liste")).toContain("Kein Fund im durchsuchten Bestand");

    await entferne(p);

    expect(schreibungenAuf(schreibungen, A), nieBeschrieben).toEqual([]);
    expect(buehne.farben()).toEqual(["Pink", null]);
    // DASS er nicht in der Merkliste steht, sagt die Auskunft: stuende er darin, meldete die
    // Ruecknahme ihn als „traegt inzwischen eine andere Hervorhebung" (wvEntferntFremd,
    // taskpane.html:12992). Sie zaehlt genau einen zurueckgenommenen Absatz und keinen fremden.
    expect(p.text("#wv-stand")).toContain("1 Markierungen zurückgenommen");
    expect(
      p.text("#wv-stand"),
      "der fremd markierte Absatz steckte doch in der Merkliste — dann ist `fremdeFarbe` " +
        "(taskpane.html:12876/:12898) nicht mehr das, was den Faerbeauftrag begrenzt",
    ).not.toContain("tragen inzwischen eine andere Hervorhebung");
    expect(p.q("#wv-entfernen")?.className.includes("hidden")).toBe(true);
  });

  it("D9 · die zwei Bausteine der Aussage stehen als AUSFUEHRBARER Code im Aufgabenfenster", () => {
    // Der Waechter gegen das Wiederaufleben der toten Zusage (§5 Lieferung 3). Er prueft die
    // Stellen, nicht ihre Beschreibung: D10 zeigt, dass ein Kommentar ihn nicht befriedigt.
    const entfernen = koerperVon("wvEntfernen");
    const fehltZuweisung =
      "steht die Zuweisung `p.absatz.font.highlightColor = p.posten.vorher` nicht mehr. Genau " +
      "sie ist der Grund, warum D7 `null` misst: wer sie entfernt oder umschreibt, aendert die " +
      "Aussage dieser Datei und muss D7 und diesen Fall nachfuehren.";
    expect(
      eineZeile(entfernen.text).includes("p.absatz.font.highlightColor = p.posten.vorher"),
      `in \`wvEntfernen\` ab taskpane.html:${entfernen.zeile} (Stand ece535b: :12982) ${fehltZuweisung}`,
    ).toBe(true);

    const schluss = koerperVon("wvSchluss");
    const fehltFilter =
      "haelt `!z.fremdeFarbe` keinen Absatz mehr aus dem Faerbeauftrag heraus. Dann koennte ein " +
      "Posten mit Ausgangsfarbe entstehen — und `posten.vorher` waere nicht mehr immer `null`.";
    expect(
      /if \(WV_FARBEN\[z\.kategorie\] && !z\.fremdeFarbe\) \{ auftraege\.push\(z\); \}/.test(
        eineZeile(schluss.text),
      ),
      `in \`wvSchluss\` ab taskpane.html:${schluss.zeile} (Stand ece535b: :12898) ${fehltFilter}`,
    ).toBe(true);

    const zeile = koerperVon("wvZeile");
    const fehltHerkunft =
      "entsteht `fremdeFarbe` nicht mehr aus `absatz.vorher !== null` — der Filter in " +
      "`wvSchluss` haette dann eine andere Bedeutung als die, die D7 und D8 messen.";
    expect(
      eineZeile(zeile.text).includes("fremdeFarbe: absatz.vorher !== null"),
      `in \`wvZeile\` ab taskpane.html:${zeile.zeile} (Stand ece535b: :12876) ${fehltHerkunft}`,
    ).toBe(true);

    // Und `vorher` gelangt NUR ueber diesen Filter in die Merkliste: `wvMerken` traegt es ein und
    // wird an genau einer Stelle gerufen — in der Schleife ueber das, was den Filter ueberlebt hat.
    const merken = koerperVon("wvMerken");
    expect(
      eineZeile(merken.text).includes("vorher: zeile.vorher"),
      `\`wvMerken\` ab taskpane.html:${merken.zeile} uebernimmt \`vorher\` nicht mehr aus der Zeile.`,
    ).toBe(true);
    const rufe = SKRIPT.maske.split("wvMerken(").length - 1;
    expect(
      rufe,
      "`wvMerken` steht nicht mehr genau zweimal im ausfuehrbaren Code (Definition + ein " +
        "Aufruf). Ein zweiter Weg in die Merkliste koennte am `fremdeFarbe`-Filter vorbeifuehren.",
    ).toBe(2);
    expect(
      eineZeile(schluss.text).includes("wvMerken(geschrieben[m].zeile, geschrieben[m].farbe)"),
      `der einzige Aufruf von \`wvMerken\` steht nicht mehr in \`wvSchluss\` ab taskpane.html:${schluss.zeile} ueber dem, was wirklich geschrieben wurde.`,
    ).toBe(true);
  });

  it("D10 · der Waechter liest Code, nicht Kommentare — an beiden Fallen des Skripts gemessen", () => {
    // (a) Die tote Zusage steht im Produkt NUR als Kommentar. Faende der Waechter sie im Code,
    //     liesse er sich von jeder Beschreibung befriedigen (Lehren 3564 R2, 3565 R1, 3838 R1).
    expect(TASKPANE_SKRIPT).toContain("URSPRUNGSFARBE");
    expect(
      SKRIPT.code,
      "der Kommentarfilter laesst Kommentartext stehen — dann ist D9 keine Code-Messung",
    ).not.toContain("URSPRUNGSFARBE");

    // (b) Die umgekehrte Falle: ein zu grober Filter haelt Code fuer einen Kommentar. Im Skript
    //     steht ein Backtick MITTEN in einem regulaeren Ausdruck; wer ihn fuer den Beginn einer
    //     Zeichenkette haelt, verschluckt den ganzen Rest der Datei. `5381` (der djb2-Startwert in
    //     `wvHash`) steht DAHINTER und ist der Beleg, dass nichts verschluckt wurde.
    expect(SKRIPT.code).toContain("/[‘’‚‛′´`]/g");
    expect(SKRIPT.code, "hinter dem Backtick im regulaeren Ausdruck fehlt Code").toContain("5381");
    expect(SKRIPT.code).toContain('var WV_FARBEN = { exakt: "BrightGreen"');
    expect(SKRIPT.code.length, "Laenge und Zeilenlage bleiben erhalten").toBe(
      TASKPANE_SKRIPT.length,
    );

    // (c) Die Probe aufs Exempel, ohne das Produkt anzufassen: dieselbe Zuweisung, die D9 sucht,
    //     einmal als Kommentar und einmal als Code. Nur die zweite darf zaehlen.
    const probe = lesbarerCode(
      [
        "// p.absatz.font.highlightColor = p.posten.vorher;",
        "/* p.absatz.font.highlightColor = p.posten.vorher; */",
        'var hinweis = "p.absatz.font.highlightColor = p.posten.vorher";',
      ].join("\n"),
    );
    expect(probe.code.split("p.absatz.font.highlightColor = p.posten.vorher").length - 1).toBe(1);
    expect(probe.maske.split("p.absatz.font.highlightColor = p.posten.vorher").length - 1).toBe(0);
  });
});
