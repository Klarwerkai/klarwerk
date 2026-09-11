// @vitest-environment jsdom
// ================================================================================================
// JOB 3560 · UX-28 — TAB, ENTER UND LEERTASTE AN DEN FASSUNGSKARTEN, IM ECHTEN BROWSER GEMESSEN.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. Pedis Befund zu UX-28 lautete „Tab überspringt die Karten"
// (PRIORITAETEN.md, N-0057). JOB 3475 hat die Karten zu nativen `<button>` gemacht und das in jsdom
// belegt — aber jsdom KANN den Befund nicht in dem Medium prüfen, in dem er entstanden ist. BEN hat
// die Lücke in Runde 2 benannt und offen gelassen (`archiv/3475/runde-2/ben.md:27`): „`tests/
// ux28-fassungen/flaeche.tsx:138` löst weiterhin `.click()` aus. Folgeprüfung: echte Tab-/Enter-/
// Leertasten im Browser, einschließlich Fokus nach dem Rückweg." Genau das steht hier.
//
// WAS DIE GEMOUNTETEN DATEIEN SAGEN UND WAS DIESE — die Grenze läuft mitten durch das Wort „Tab".
//   · `fassung-per-tastatur-oeffnen.test.tsx` misst die BAUART (`<button type="button">`,
//     `tabIndex`, `disabled`) und die Mitgliedschaft in einer SELBST BERECHNETEN Kandidatenliste
//     (`flaeche.tsx:186`, `tabFolge()`) — plus die WIRKUNG des Auslösens (`aria-expanded`, der
//     gespeicherte Bericht im Baum). Keine Taste ist dabei gedrückt worden.
//   · Diese Datei drückt die Tasten. Gemessen wird allein, was der Browser selbst tut: welche
//     Elemente ein echter `Tab`-Anschlag in welcher REIHENFOLGE erreicht, ob `Enter` und die
//     Leertaste an einem fokussierten Knopf wirklich ein `click` erzeugen (die Vorgabehandlung, die
//     jsdom nachweislich nicht ausführt), und wohin der Fokus fällt, wenn das fokussierte Element
//     verschwindet.
//   Keine der beiden Seiten behauptet die Hälfte der anderen; zusammen ist die Kette geschlossen.
//
// DIE BÜHNE, EHRLICH BENANNT (Bauform wörtlich aus
// `tests/ux25-beleg-zum-original/belegkarte-schmal-chromium.test.tsx`, JOB 3272 R2):
//   · Das MARKUP stammt aus der echten, in jsdom gemounteten Fläche — derselben Vorrichtung
//     `./flaeche.tsx`, die auch die drei gemounteten Fälle aufbaut, mit dem echten Abschnitt
//     „Schnappschüsse" und beiden Fassungen aufgeklappt. Kein nachgebautes HTML.
//   · Das CSS entsteht aus der ECHTEN Tailwind-Konfiguration der App über die echten Klassennamen
//     dieses Markups. Kein handgeschriebener Stilblock. Es steht hier, weil es über Sichtbarkeit
//     entscheidet und ein unsichtbares Element nicht fokussierbar ist.
//   · NICHT dabei ist die Hülle (Kopfband, Seitenleiste, Lesespalte). Der Abschnitt steht direkt im
//     Fenster. Für die Fokusreihenfolge INNERHALB des Abschnitts ist das die getreue Lage; eine
//     Aussage über die Zahl der Anschläge von der SEITE aus wird hier deshalb nirgends getroffen —
//     gemessen wird die Reihenfolge, nicht ein Abstand zum Seitenanfang.
//   · React läuft auf dieser Bühne NICHT. Deshalb steht hier KEINE Aussage darüber, was ein Klick
//     bewirkt: dass er `aria-expanded` umlegt und den alten Bericht in den Baum stellt, misst
//     `fassung-per-tastatur-oeffnen.test.tsx` an der echten React-Fläche. Hier endet die Messung
//     beim `click`-Ereignis.
//   · Die Schriftdateien der App sind nicht geladen; Chromium löst `system-ui, sans-serif` auf.
//     Keine Aussage hier hängt an einer Pixelzahl.
//
// ZUSTANDSMODELL (Auftrag §9): diese Bühne prüft Fokus und Tasten an einem festen, ERFOLGREICH
// geladenen Markup. „laden", „erfolgreich leer" (keine frühere Fassung), Fehler, Cache mit laufender
// oder gescheiterter Auffrischung und offline sind ausdrücklich außerhalb dieser Bühne und bleiben
// Sache der gemounteten Dateien; keine Zeile hier behauptet etwas über sie.
import { createRequire } from "node:module";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { schliesseChromium } from "../tor-bereitschaft/chromium-abbau";

vi.mock("../../apps/web/src/api/endpoints", async () => (await import("./netz")).endpointsDoppel());
vi.mock("../../apps/web/src/api/auth", async () => (await import("./netz")).authDoppel());

import tailwindConfig from "../../apps/web/tailwind.config";
import {
  FASSUNG_MARKE,
  INHALT_MARKE,
  RUECKWEG_MARKE,
  abbauen,
  abschnitt,
  ausloesen,
  fassungsKnoepfe,
  fassungsKnopf,
  flaecheMitFassungen,
} from "./flaeche";
import { netz, zweiFassungen } from "./netz";

/** Die Wege der Bühne, als Marken geschrieben — Sollwerte, nicht aus dem Baum geholt. */
const KARTE_V1 = `${FASSUNG_MARKE}=ko-1:1`;
const KARTE_V2 = `${FASSUNG_MARKE}=ko-1:2`;
const RUECKWEG_V1 = `${RUECKWEG_MARKE}=ko-1:1`;
const RUECKWEG_V2 = `${RUECKWEG_MARKE}=ko-1:2`;

/**
 * DIE REIHENFOLGE DER FLÄCHE, gemessen und nicht angenommen: `koVersionSnapshots.ts:58` sortiert
 * `b.version - a.version`, die JÜNGSTE Fassung steht also oben. Die erste Fassung dieser Datei hatte
 * hier `[v1, v2]` stehen und wurde dafür rot (`expected ['ko-1:2','ko-1:1'] to deeply equal
 * ['ko-1:1','ko-1:2']`) — der Sollwert kommt aus dem Produkt, aber als Literal, damit ein Umdrehen
 * der Sortierung diesen Test nicht stillschweigend mitdreht.
 */
const KARTEN_SOLL = [KARTE_V2, KARTE_V1];

// ------------------------------------------------------------------------------------------------
// 1 · Das Markup: die echte Fläche, in jsdom gemountet, Abschnitt „Schnappschüsse", beide offen
// ------------------------------------------------------------------------------------------------
/**
 * WARUM BEIDE FASSUNGEN AUFGEKLAPPT IN DIE BÜHNE GEHEN: der Rückweg (`RUECKWEG_MARKE`) existiert im
 * Baum nur, solange seine Fassung offen ist (`MehrAbschnitte.tsx:1611-1660`). Ohne offene Fassung
 * gäbe es die Fälle T4–T6 gar nicht, und ohne die ZWEITE offene Fassung gäbe es hinter dem Rückweg
 * der ersten kein Element mehr, an dem sich „die Tab-Folge geht dort WEITER" überhaupt zeigen kann.
 * Aufgeklappt wird über die vorhandene Vorrichtung, also über dasselbe `.click()`, das die
 * gemounteten Fälle fahren — hier NUR als Weg zum Markup, nicht als Aussage.
 */
async function fassungsMarkup(): Promise<string> {
  netz.fassungen = zweiFassungen();
  await flaecheMitFassungen();
  try {
    await ausloesen(fassungsKnopf(2));
    await ausloesen(fassungsKnopf(1));
    const d = abschnitt();
    if (!d) {
      throw new Error("Abschnitt „schnappschuesse“ fehlt auf der Fläche");
    }
    // Selbstschutz: eine leere oder halbe Bühne wäre grün, ohne etwas geprüft zu haben.
    const karten = fassungsKnoepfe();
    if (karten.length !== 2) {
      throw new Error(`die Bühne trägt ${karten.length} Fassungskarten statt zwei`);
    }
    for (const karte of karten) {
      if (karte.tagName !== "BUTTON") {
        throw new Error(
          `die Fassungskarte ist ein <${karte.tagName.toLowerCase()}>, kein <button>`,
        );
      }
    }
    for (const version of [1, 2]) {
      if (!d.querySelector(`[${INHALT_MARKE}="ko-1:${version}"]`)) {
        throw new Error(`v${version} ist nicht aufgeklappt — ohne Inhalt gibt es keinen Rückweg`);
      }
      if (!d.querySelector(`[${RUECKWEG_MARKE}="ko-1:${version}"]`)) {
        throw new Error(`kein Rückweg an v${version} — die Messung hätte nichts zu messen`);
      }
    }
    if (!d.open) {
      throw new Error("der Abschnitt ist zu; sein Inhalt wäre im Browser nicht fokussierbar");
    }
    return d.outerHTML;
  } finally {
    abbauen();
  }
}

// ------------------------------------------------------------------------------------------------
// 2 · Das Stylesheet: die echte Tailwind-Konfiguration über die echten Klassennamen
// ------------------------------------------------------------------------------------------------
const WURZEL = join(__dirname, "..", "..");
const verlangeModul = createRequire(join(WURZEL, "apps", "web", "index.js"));

async function stylesheet(markup: string): Promise<string> {
  const postcss = verlangeModul("postcss") as (p: unknown[]) => {
    process(css: string, o: Record<string, unknown>): Promise<{ css: string }>;
  };
  const tailwind = verlangeModul("tailwindcss") as (c: unknown) => unknown;
  const ergebnis = await postcss([
    tailwind({ ...tailwindConfig, content: [{ raw: markup, extension: "html" }] }),
  ]).process("@tailwind base;\n@tailwind utilities;", { from: undefined });
  return ergebnis.css;
}

// ------------------------------------------------------------------------------------------------
// 3 · Die Messung im Browser
// ------------------------------------------------------------------------------------------------
interface Page {
  goto(url: string): Promise<unknown>;
  route(muster: string, handler: (route: Weiche) => unknown): Promise<void>;
  evaluate<T>(fn: string): Promise<T>;
  keyboard: { press(taste: string): Promise<void> };
}
interface Weiche {
  fulfill(o: Record<string, unknown>): Promise<void>;
}
interface Browser {
  newPage(o: Record<string, unknown>): Promise<Page>;
  close(): Promise<void>;
}

/**
 * Die MARKE eines Elements — der Name, unter dem eine Fokusfolge lesbar wird. Sie kommt aus den
 * Marken des Produkts (`data-bib-…`), nicht aus einem eigens gesetzten Attribut: eine Marke, die nur
 * dieser Test kennt, wäre eine Messung der eigenen Vorbereitung.
 */
const MARKE_FN = `
  const marke = (el) => {
    if (!el || el === document.body || el === document.documentElement) { return "body"; }
    for (const attr of ["${FASSUNG_MARKE}", "${RUECKWEG_MARKE}", "data-bib-nachladen"]) {
      if (el.hasAttribute && el.hasAttribute(attr)) { return attr + "=" + el.getAttribute(attr); }
    }
    return el.tagName.toLowerCase() + ":" + (el.textContent ?? "").replace(/\\s+/g, " ").trim().slice(0, 24);
  };`;

/** Die Marke des Elements, das gerade den Fokus hat. */
const FOKUS_MARKE = `(() => {
  ${MARKE_FN}
  return marke(document.activeElement);
})()`;

/** Die Fassungskarten in DOM-Reihenfolge — der Istwert, gegen den `KARTEN_SOLL` gelegt wird. */
const KARTEN_IN_DOM_FOLGE = `(() => {
  return [...document.querySelectorAll("[${FASSUNG_MARKE}]")]
    .map((e) => "${FASSUNG_MARKE}=" + e.getAttribute("${FASSUNG_MARKE}"));
})()`;

/**
 * Klickzähler an alle Wege der Fläche hängen. Der Aufrufer lädt die Seite VORHER neu: ein zweiter
 * Lauf auf derselben Seite hinge sonst einen zweiten Zuhörer an denselben Knopf, und ein einziger
 * Tastendruck zählte zwei (Lehre JOB 3272 R2, dort gemessen: T2 meldete 2 statt 1).
 */
const ZAEHLER_ANBRINGEN = `(() => {
  ${MARKE_FN}
  window.__klicks = [];
  const wege = document.querySelectorAll("[${FASSUNG_MARKE}], [${RUECKWEG_MARKE}]");
  for (const el of wege) {
    el.addEventListener("click", (e) => { window.__klicks.push(marke(e.currentTarget)); });
  }
  return wege.length;
})()`;

/**
 * NACHSTELLUNG des Zuklappens, wahlweise mit der Fokusrückgabe des Produkts.
 *
 * React nimmt beim Rückweg den ganzen Inhaltsblock samt Rückweg-Knopf aus dem Baum
 * (`MehrAbschnitte.tsx:1611-1660`) und setzt danach den Fokus auf die Fassungskarte
 * (`fassungZurueck`, `:602-607`). DASS React beides tut, misst
 * `rueckweg-zur-aktuellen-fassung.test.tsx` an der echten Fläche — diese Datei behauptet es nicht.
 * Hier wird der Baum nur in dieselbe Lage gebracht, um die Frage zu stellen, die allein ein Browser
 * beantwortet: wohin fällt der Fokus dabei, und wo geht die Tab-Folge danach weiter?
 */
const zuklappen = (schluessel: string, mitRueckgabe: boolean): string => `(() => {
  ${MARKE_FN}
  document.querySelector('[${INHALT_MARKE}="${schluessel}"]').remove();
  ${mitRueckgabe ? `document.querySelector('[${FASSUNG_MARKE}="${schluessel}"]').focus();` : ""}
  return marke(document.activeElement);
})()`;

const BUEHNE = "http://fassungen.pruefstand/";
const HOECHSTENS = 40;

let seitenInhalt = "";
let browser: Browser | null = null;
/** EINE Seite für alle Fälle: mit `--single-process --no-zygote` endet der Browser mit ihr. */
let seite: Page | null = null;
let vorrat: { html: string; css: string } | null = null;

/** Eine frische Seite mit angebrachten Zählern — die Ausgangslage jedes Falls. */
async function frischeBuehne(): Promise<Page> {
  if (!vorrat) {
    const html = await fassungsMarkup();
    vorrat = { html, css: await stylesheet(html) };
    seitenInhalt = `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>${vorrat.css}</style></head><body>${vorrat.html}</body></html>`;
  }
  const s = seite as Page;
  await s.goto(`${BUEHNE}wissen/ko-1`);
  expect(
    await s.evaluate<number>(ZAEHLER_ANBRINGEN),
    "die Bühne trägt nicht die erwarteten vier Wege (zwei Karten, zwei Rückwege)",
  ).toBe(4);
  return s;
}

/** Die Folge der Marken, die echte `Tab`-Anschläge erreichen — bis der Fokus das Dokument verlässt. */
async function tabFolge(s: Page): Promise<string[]> {
  const folge: string[] = [];
  for (let i = 0; i < HOECHSTENS; i++) {
    await s.keyboard.press("Tab");
    const m = await s.evaluate<string>(FOKUS_MARKE);
    if (m === "body") {
      break;
    }
    folge.push(m);
  }
  return folge;
}

/** Mit echten `Tab`-Anschlägen bis zu einer Marke gehen. Kein Sprung, kein `focus()` von Hand. */
async function tabBisZu(s: Page, ziel: string): Promise<string[]> {
  const folge: string[] = [];
  for (let i = 0; i < HOECHSTENS; i++) {
    await s.keyboard.press("Tab");
    const m = await s.evaluate<string>(FOKUS_MARKE);
    folge.push(m);
    if (m === ziel) {
      return folge;
    }
  }
  throw new Error(
    `„${ziel}" war in ${HOECHSTENS} Tab-Anschlägen nicht erreichbar — Folge: ${folge.join(" → ")}`,
  );
}

const klicks = (s: Page): Promise<string[]> => s.evaluate<string[]>("window.__klicks");

beforeAll(async () => {
  const { chromium } = verlangeModul("playwright") as {
    chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
  };
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
  });
  seite = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await seite.route("**/*", (route) =>
    route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: seitenInhalt }),
  );
}, 120_000);

afterAll(async () => {
  await schliesseChromium("tests/ux28-fassungen/tastatur-im-browser-chromium.test.tsx", browser);
}, 60_000);

describe("JOB 3560 · UX-28 · der Tabulator erreicht JEDE Fassungskarte", () => {
  it("T1 · echte Tab-Anschläge treffen beide Karten, in der Reihenfolge der Fläche", async () => {
    const s = await frischeBuehne();
    const folge = await tabFolge(s);
    expect(
      await s.evaluate<string[]>(KARTEN_IN_DOM_FOLGE),
      "die Bühne führt die Fassungen nicht in der erwarteten Reihenfolge",
    ).toEqual(KARTEN_SOLL);
    // Pedis Befund, in seinem Medium gestellt: „Tab überspringt die Karten". Gefiltert wird auf die
    // Karten, weil zwischen ihnen die Rückwege und der Nachladeweg liegen — deren Platz ist Sache
    // von T4; hier geht es allein darum, dass keine Karte fehlt und keine vorgezogen wird.
    expect(
      folge.filter((m) => m.startsWith(`${FASSUNG_MARKE}=`)),
      `der Tabulator erreicht die Karten nicht vollständig oder nicht in der Reihenfolge der Fläche — Folge: ${folge.join(" → ")}`,
    ).toEqual(KARTEN_SOLL);
  });
});

describe("JOB 3560 · UX-28 · die Tasten selbst — was jsdom nachweislich nicht leisten kann", () => {
  it("T2 · echtes Enter auf einer fokussierten Fassungskarte erzeugt ein `click`", async () => {
    const s = await frischeBuehne();
    await tabBisZu(s, KARTE_V2);
    await s.keyboard.press("Enter");
    expect(
      await klicks(s),
      "Enter auf der Fassungskarte bewirkt nichts — die Karte ist nur mit der Maus zu öffnen",
    ).toEqual([KARTE_V2]);
  });

  it("T3 · und die echte Leertaste ebenso", async () => {
    const s = await frischeBuehne();
    await tabBisZu(s, KARTE_V1);
    await s.keyboard.press("Space");
    expect(await klicks(s), "die Leertaste auf der Fassungskarte bewirkt nichts").toEqual([
      KARTE_V1,
    ]);
  });
});

describe("JOB 3560 · UX-28 · der Rückweg und der Fokus danach", () => {
  it("T4 · der Rückweg der alten Fassung liegt direkt hinter ihrer Karte und geht mit Enter", async () => {
    const s = await frischeBuehne();
    const folge = await tabBisZu(s, RUECKWEG_V1);
    // Er liegt IM geöffneten Inhalt seiner eigenen Fassung: wer sie aufgemacht hat, tabbt EINEN
    // Anschlag weiter und steht auf dem Rückweg — kein Rückwärtstabben, kein Umweg über die andere
    // Fassung. Das misst keine gemountete Datei; dort gibt es nur eine berechnete Kandidatenliste.
    expect(
      folge[folge.indexOf(KARTE_V1) + 1],
      `zwischen Karte und Rückweg liegt etwas anderes — Folge: ${folge.join(" → ")}`,
    ).toBe(RUECKWEG_V1);

    await s.keyboard.press("Enter");
    expect(await klicks(s), "Enter auf dem Rückweg bewirkt nichts").toEqual([RUECKWEG_V1]);
  });

  it("T5 · verschwindet der fokussierte Rückweg ohne Rückgabe, fällt der Fokus auf <body>", async () => {
    // DER GRUND, aus dem `fassungZurueck` (`MehrAbschnitte.tsx:602-607`) überhaupt ein `focus()`
    // enthält — hier als Verhalten des Browsers gemessen, nicht als Annahme geführt. BEN hat den
    // Verlust in JOB 3475 R2 in jsdom gesehen; dass ein echter Browser es genauso macht, stand bis
    // hierher nirgends.
    const s = await frischeBuehne();
    await tabBisZu(s, RUECKWEG_V1);
    expect(
      await s.evaluate<string>(zuklappen("ko-1:1", false)),
      "der Browser hält den Fokus am entfernten Element fest — dann wäre die Rückgabe unnötig",
    ).toBe("body");
  });

  it("T6 · mit der Rückgabe steht der Fokus auf der Karte, und Tab geht dort weiter", async () => {
    // DIE AUSSAGE, DIE NUR HIER STEHEN KANN. Dass `document.activeElement` nach dem Rückweg auf der
    // Karte liegt, misst `rueckweg-zur-aktuellen-fassung.test.tsx` in jsdom. Was dort NICHT messbar
    // ist, weil jsdom keine Tabulator-Taste kennt: ob es nach dieser Rückgabe an der richtigen
    // Stelle WEITERGEHT. Ein Fokus, der auf der Karte steht, aber die Tab-Folge am Seitenanfang neu
    // beginnen liesse, wäre für einen Tastaturleser derselbe Verlust.
    //
    // GEMESSEN WIRD AN DER OBEREN KARTE (v2), und das ist keine Bequemlichkeit: die Fläche führt die
    // jüngste Fassung oben (`koVersionSnapshots.ts:58`), v1 ist also die LETZTE Karte des
    // Abschnitts. Hinter ihr verlässt der Fokus den Abschnitt in jedem Fall — dort wäre „geht
    // weiter" nicht unterscheidbar von „ist am Ende". Die Aussage gilt der Rückgabe, nicht der
    // Fassungsnummer; für v1 hält T5 die zugehörige Hälfte fest.
    const s = await frischeBuehne();
    await tabBisZu(s, RUECKWEG_V2);
    expect(
      await s.evaluate<string>(zuklappen("ko-1:2", true)),
      "die Karte nimmt den Fokus nach dem Zuklappen nicht an",
    ).toBe(KARTE_V2);

    await s.keyboard.press("Tab");
    expect(
      await s.evaluate<string>(FOKUS_MARKE),
      "nach dem Rückweg beginnt die Tab-Folge von vorn statt bei der nächsten Fassung",
    ).toBe(KARTE_V1);
  });
});
