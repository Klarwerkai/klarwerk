// ================================================================================================
// JOB 3056 · K1 — DIE ANTWORT NACH PEDIS MOCKUP `design/klara/Main.dc.html` (04.09.2026), IN CHROMIUM.
// ================================================================================================
//
// Kopf mit Zurueck-Chevron + „Klara" + Zahnrad (kein Umschalter); die Frage als eine gedaempfte
// Zeile; EINE Antwortkarte mit Text und Quellen-Chips „1 · Titel"; darunter „Einfuegen" und
// „Kopieren"; unten wieder das Frage-Feld (ohne Schatten). Weg: Pruefhinweis, Herkunftszeile,
// Fusszeile „Woertlich zitiert · fachlich pruefen", „Neue Frage", Leitsatz.
//
// Der ANTWORTZUSTAND entsteht echt: validiertes Wissensobjekt ueber POST /api/kos + admin-validate,
// Frage im echten Feld getippt, echter Knopf, Antwort ueber POST /api/ask (retrieval-only),
// Quellen ueber GET /api/kos/:id. Gemessen per getComputedStyle an den REALEN Elementen.
import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ARTBOARD,
  ASK_URL,
  AUSSAGE,
  FRAGE,
  type Flaeche,
  MOCKUP_ANTWORT,
  ORIGIN,
  TITEL,
  askAntwort,
  aufloesen,
  fn,
  frageStellen,
  kanon,
  kanonLaenge,
  kanonRand,
  kanonSchatten,
  kanonZeilenhoehe,
  leser,
  mockup,
  starteFlaeche,
  zielProp,
  zielStil,
  zielSvgAttr,
  zielText,
} from "./k1-messung";

const ziel = mockup(MOCKUP_ANTWORT);

// ---- Anker im Mockup (Main.dc.html) ------------------------------------------------------------
const Z_KOPF_LINKS = "align-items: center; gap: 8px";
const Z_TITEL = "font-size: 15px; font-weight: 650";
const Z_FRAGE = "margin: 6px 16px 0; font-size: 13px";
const Z_KARTE = "margin: 14px 16px 0; padding: 18px 16px";
const Z_TEXT = "font-size: 16px; line-height: 1.55";
const Z_QUELLEN = "border-top: 1px solid #E9E5DE; padding-top: 12px";
const Z_CHIP = "gap: 6px; padding: 5px 9px";
const Z_CHIP_TITEL = "font-size: 11.5px; color: #1A2233; font-weight: 600";
const Z_AKTIONEN = "margin: 12px 16px 0; display: flex; gap: 8px";
const Z_EINFUEGEN = "background: #C2500A; color: #FFFFFF";
const Z_KOPIEREN = "background: #FFFFFF; color: #1A2233; border: 1px solid #E9E5DE";
const Z_FELD_RAHMEN = "margin-top: auto; padding: 12px 16px 16px";
const Z_FELD_KARTE =
  'position: relative; background: #FFFFFF; border: 1px solid #E9E5DE; border-radius: 12px;"';
const CHEVRON_PFAD = "M15 18l-6-6 6-6";
const DOKUMENT_PFAD = "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z";
// Runde 4: der <sup>-Stil des Mockups (Z.28) und die realen Ziffern.
const Z_SUP = "font-size: 10px; color: #9C5009; font-weight: 700";
const SUP = "#ask-fussnoten sup.fussnote";
const FUSSNOTEN_TEXT =
  "() => [...document.querySelectorAll('#ask-fussnoten sup.fussnote')].map((s) => s.textContent.trim())";
const FUSSNOTEN_QUELLEN =
  "() => [...document.querySelectorAll('#ask-fussnoten sup.fussnote')].map((s) => s.getAttribute('data-quelle'))";
/** Die x-Koordinate des Textendes des Felds, UNABHAENGIG vom Spiegel des Panels gemessen: eine
 *  Kopie des Texts in einem Block gleicher Breite und Schrift, das letzte Zeichen in einem Span. */
const TEXTENDE_X = `(sel) => {
  const feld = document.querySelector(sel);
  const cs = getComputedStyle(feld);
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;white-space:pre-wrap;overflow-wrap:break-word;margin:0;padding:0;border:0;width:' + feld.clientWidth + 'px;font:' + cs.font + ';letter-spacing:' + cs.letterSpacing + ';line-height:' + cs.lineHeight;
  const v = feld.value;
  probe.appendChild(document.createTextNode(v.slice(0, -1)));
  const letztes = document.createElement('span');
  letztes.textContent = v.slice(-1);
  probe.appendChild(letztes);
  feld.parentElement.appendChild(probe);
  const x = letztes.getBoundingClientRect().right;
  probe.remove();
  return x;
}`;

const SELEKTOREN = {
  kopfLinks: "#kw-kopf-links",
  chevron: "#kw-zurueck",
  chevronSvg: "#kw-zurueck svg",
  titel: "#kw-titel",
  zahnrad: "#kw-zahnrad",
  frage: "#ask-frage-zeile-btn",
  frageText: "#ask-frage-zeile",
  karte: "#antwortkarte",
  text: "#ask-answer-edit",
  quellen: "#ask-sources-block",
  chips: "#ask-sources",
  chip: "#ask-sources li.quelle-chip",
  chipIcon: "#ask-sources li.quelle-chip svg",
  chipTitel: "#ask-sources li.quelle-chip .quelle-chip-titel",
  mehr: "#ask-mehr-btn",
  aktionen: "#antwortkarte-aktionen",
  einfuegen: "#ask-insert-btn",
  kopieren: "#ask-copy-btn",
  feldRahmen: "#ask-feld",
  feldKarte: "#ask-karte",
  feld: "#ask-input",
};
type Sel = Record<keyof typeof SELEKTOREN, string | null> & { aufgeloest: boolean };

let flaeche: Flaeche | null = null;
let fehler: string | null = null;
let sel: Sel | null = null;

describe("JOB 3056 · K1 · Antwort — die echte taskpane.html aus dist, in Chromium, im echten Antwortzustand", () => {
  beforeAll(async () => {
    try {
      flaeche = await starteFlaeche({ mitWissen: true });
      await frageStellen(flaeche.seite);
      sel = (await aufloesen(flaeche.seite, SELEKTOREN)) as Sel;
      console.info(
        `JOB 3056 K1 Antwort · Chromium ${flaeche.version} · KO ${flaeche.koId} · Selektoren ${JSON.stringify(sel)}`,
      );
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 3).join(" | ");
    }
  }, 120_000);

  afterAll(async () => {
    await flaeche?.schliessen();
  }, 60_000);

  const l = leser(
    () => flaeche?.seite ?? null,
    () => fehler,
  );
  const rand = (anker: string, eig = "border") => kanonRand(zielProp(zielStil(ziel, anker), eig));
  function kantenGegenRand(k: { links: number; rechts: number }, name: string): void {
    expect(Math.abs(k.links - 16), `${name}: linke Kante ${k.links}`).toBeLessThan(1);
    expect(
      Math.abs(ARTBOARD.breite - 16 - k.rechts),
      `${name}: rechte Kante ${k.rechts}`,
    ).toBeLessThan(1);
  }

  it("S · Antwortzustand erreicht, JEDES Element des Mockups gefunden, kein Seitenfehler", () => {
    expect(fehler).toBeNull();
    expect(sel).not.toBeNull();
    const fehlend = Object.entries(sel as Sel)
      .filter(([k, v]) => k !== "aufgeloest" && v === null)
      .map(([k]) => k);
    expect(fehlend, "Elemente des Mockups fehlen in der geladenen Seite").toEqual([]);
    expect((sel as Sel).aufgeloest).toBe(true);
    expect(flaeche?.seitenfehler).toEqual([]);
  });

  // ---- Kopf (Mockup Z.17-23) -------------------------------------------------------------------
  it("K1 · kopf links: chevron 18px · stroke #525B6B · 2 + „Klara“ 15px/650, gap 8px; Umschalter WEG, Zahnrad da", async () => {
    const stil = zielStil(ziel, Z_KOPF_LINKS);
    expect(await l.messen(sel?.kopfLinks, "gap")).toBe(zielProp(stil, "gap"));
    expect(await l.messen(sel?.kopfLinks, "align-items")).toBe(zielProp(stil, "align-items"));
    expect(await l.sichtbar(sel?.chevron)).toBe(true);
    expect(ziel).toContain(CHEVRON_PFAD);
    expect(await l.pfadD(sel?.chevronSvg)).toBe(CHEVRON_PFAD);
    expect(await l.attr(sel?.chevronSvg, "width")).toBe(zielSvgAttr(ziel, CHEVRON_PFAD, "width"));
    expect(await l.messen(sel?.chevronSvg, "stroke")).toBe(
      kanon(zielSvgAttr(ziel, CHEVRON_PFAD, "stroke")),
    );
    expect(await l.text(sel?.titel)).toBe(zielText(ziel, Z_TITEL));
    expect(await l.messen(sel?.titel, "font-size")).toBe(
      zielProp(zielStil(ziel, Z_TITEL), "font-size"),
    );
    expect(await l.messen(sel?.titel, "font-weight")).toBe(
      zielProp(zielStil(ziel, Z_TITEL), "font-weight"),
    );
    expect(await l.sichtbar("#kw-segment")).toBe(false);
    expect(await l.sichtbar(sel?.zahnrad)).toBe(true);
  });

  // ---- Frage-Zeile (Mockup Z.25) ---------------------------------------------------------------
  it("Q1 · frage-zeile 6px 16px 0 · 13px · #525B6B · 1.4 · Wortlaut der gestellten Frage — ohne Pille, ohne Rand", async () => {
    const stil = zielStil(ziel, Z_FRAGE);
    expect(await l.messen(sel?.frage, "margin")).toBe(kanonLaenge(zielProp(stil, "margin")));
    expect(await l.messen(sel?.frage, "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await l.messen(sel?.frage, "color")).toBe(kanon(zielProp(stil, "color")));
    expect(await l.messen(sel?.frage, "line-height")).toBe(
      kanonZeilenhoehe(zielProp(stil, "line-height"), zielProp(stil, "font-size")),
    );
    expect(await l.messen(sel?.frage, "background-color")).toBe("rgba(0, 0, 0, 0)");
    expect(await l.messen(sel?.frage, "border-top-width")).toBe("0px");
    expect(await l.messen(sel?.frage, "padding")).toBe("0px");
    expect(await l.text(sel?.frageText)).toBe(FRAGE);
    kantenGegenRand(await l.kanten(sel?.frage), "Frage-Zeile");
  });

  // ---- Antwortkarte (Mockup Z.27-29) -----------------------------------------------------------
  it("A1 · karte 14px 16px 0 · 18px 16px · #FFFFFF · rand · radius 12 · schatten · spalte gap 14 — an der realen Karte", async () => {
    const stil = zielStil(ziel, Z_KARTE);
    const soll = rand(Z_KARTE);
    expect(await l.messen(sel?.karte, "margin")).toBe(kanonLaenge(zielProp(stil, "margin")));
    expect(await l.messen(sel?.karte, "padding")).toBe(kanonLaenge(zielProp(stil, "padding")));
    expect(await l.messen(sel?.karte, "background-color")).toBe(
      kanon(zielProp(stil, "background")),
    );
    expect(await l.messen(sel?.karte, "border-top-width")).toBe(soll?.breite);
    expect(await l.messen(sel?.karte, "border-top-color")).toBe(soll?.farbe);
    expect(await l.messen(sel?.karte, "border-radius")).toBe(zielProp(stil, "border-radius"));
    expect(await l.messen(sel?.karte, "box-shadow")).toBe(
      kanonSchatten(zielProp(stil, "box-shadow")),
    );
    expect(await l.messen(sel?.karte, "display")).toBe(zielProp(stil, "display"));
    expect(await l.messen(sel?.karte, "flex-direction")).toBe(zielProp(stil, "flex-direction"));
    expect(await l.messen(sel?.karte, "gap")).toBe(zielProp(stil, "gap"));
    kantenGegenRand(await l.kanten(sel?.karte), "Karte");
  });
  it("A2 · antworttext 16px · 1.55 · #1A2233 · ohne Rahmen · Wortlaut der Quelle — am realen Feld", async () => {
    const stil = zielStil(ziel, Z_TEXT);
    expect(await l.messen(sel?.text, "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await l.messen(sel?.text, "line-height")).toBe(
      kanonZeilenhoehe(zielProp(stil, "line-height"), zielProp(stil, "font-size")),
    );
    expect(await l.messen(sel?.text, "color")).toBe(kanon(zielProp(stil, "color")));
    expect(await l.messen(sel?.text, "border-top-width")).toBe("0px");
    expect(await l.messen(sel?.text, "padding")).toBe("0px");
    expect(await l.eval<string>("(sel) => document.querySelector(sel).value", sel?.text)).toBe(
      AUSSAGE,
    );
  });

  // ---- Quellen-Chips (Mockup Z.30-38) ----------------------------------------------------------
  it("C1 · quellenreihe trennlinie 1px #E9E5DE · padding-top 12 · chips flex wrap gap 6 — an der realen Reihe", async () => {
    const soll = rand(Z_QUELLEN, "border-top");
    expect(await l.messen(sel?.quellen, "border-top-width")).toBe(soll?.breite);
    expect(await l.messen(sel?.quellen, "border-top-color")).toBe(soll?.farbe);
    expect(await l.messen(sel?.quellen, "padding-top")).toBe(
      zielProp(zielStil(ziel, Z_QUELLEN), "padding-top"),
    );
    const stil = zielStil(ziel, Z_QUELLEN);
    expect(await l.messen(sel?.chips, "display")).toBe(zielProp(stil, "display"));
    expect(await l.messen(sel?.chips, "flex-wrap")).toBe(zielProp(stil, "flex-wrap"));
    expect(await l.messen(sel?.chips, "gap")).toBe(zielProp(stil, "gap"));
  });
  it("C2 · chip flex · gap 6 · 5px 9px · #FAF8F5 · rand · radius 8 — am realen Chip", async () => {
    const stil = zielStil(ziel, Z_CHIP);
    const soll = rand(Z_CHIP);
    expect(await l.messen(sel?.chip, "display")).toBe(zielProp(stil, "display"));
    expect(await l.messen(sel?.chip, "align-items")).toBe(zielProp(stil, "align-items"));
    expect(await l.messen(sel?.chip, "gap")).toBe(zielProp(stil, "gap"));
    expect(await l.messen(sel?.chip, "padding")).toBe(kanonLaenge(zielProp(stil, "padding")));
    expect(await l.messen(sel?.chip, "background-color")).toBe(kanon(zielProp(stil, "background")));
    expect(await l.messen(sel?.chip, "border-top-width")).toBe(soll?.breite);
    expect(await l.messen(sel?.chip, "border-top-color")).toBe(soll?.farbe);
    expect(await l.messen(sel?.chip, "border-radius")).toBe(zielProp(stil, "border-radius"));
    // Geometrie: Symbol → Titel 6px, dieselbe Zeile.
    const symbol = await l.kanten(sel?.chipIcon);
    const titel = await l.kanten(sel?.chipTitel);
    expect(Math.abs(titel.links - symbol.rechts - 6)).toBeLessThan(0.5);
    expect(
      Math.abs((symbol.oben + symbol.unten) / 2 - (titel.oben + titel.unten) / 2),
    ).toBeLessThan(2);
  });
  it("C3 · chip-symbol 13px (Dokument-Pfad des Mockups) · titel 11.5px · 600 · #1A2233 · „1 · <Titel>“ — OHNE Fassung", async () => {
    expect(ziel).toContain(DOKUMENT_PFAD);
    expect(await l.pfadD(sel?.chipIcon)).toBe(DOKUMENT_PFAD);
    expect(await l.attr(sel?.chipIcon, "width")).toBe("13");
    const stil = zielStil(ziel, Z_CHIP_TITEL);
    expect(await l.messen(sel?.chipTitel, "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await l.messen(sel?.chipTitel, "font-weight")).toBe(zielProp(stil, "font-weight"));
    expect(await l.messen(sel?.chipTitel, "color")).toBe(kanon(zielProp(stil, "color")));
    expect(await l.text(sel?.chipTitel)).toBe(`1 · ${TITEL}`);
    // Der Chip traegt NUR Symbol und Titel — kein Status, keine Rolle, kein Vertrauen, kein Datum.
    expect(await l.text(sel?.chip)).toBe(`1 · ${TITEL}`);
    expect(
      await l.eval<number>("() => document.querySelectorAll('.quelle-chip-fassung').length"),
    ).toBe(0);
    // Der Chip verlinkt das ECHTE Wissensobjekt.
    const href = await l.eval<string | null>(
      "(sel) => { const a = document.querySelector(sel + ' a'); return a ? a.getAttribute('href') : null; }",
      sel?.chip,
    );
    expect(href).toContain(flaeche?.koId);
  });
  it("C4 · „Mehr“ (Funktionsinventar §5a): Einstufung, Konfliktlage, Herkunft und Quellen-Details sind erreichbar — aufklappbar, nicht Dauertext", async () => {
    expect(fehler).toBeNull();
    expect(await l.sichtbar("#ask-mehr-block")).toBe(false);
    expect(await l.text(sel?.mehr)).toBe("Mehr");
    await l.seite().click(sel?.mehr ?? "");
    expect(await l.sichtbar("#ask-mehr-block")).toBe(true);
    expect(await l.text(sel?.mehr)).toBe("Weniger");
    expect(await l.text("#ask-evidence-note")).toMatch(/^Einstufung: /);
    expect(await l.sichtbar("#ask-conflict-line")).toBe(true);
    expect(await l.text("#antwortkarte-herkunft-zeile")).toBe("Aus freigegebenem Firmenwissen");
    const detail = await l.text("#ask-quellen-detail li");
    expect(detail).toContain(`1 · ${TITEL}`);
    expect(detail).toMatch(/Validiert|In Prüfung|Offen|Status unbekannt/);
    await l.seite().click(sel?.mehr ?? "");
    expect(await l.sichtbar("#ask-mehr-block")).toBe(false);
  });

  // ---- Aktionen (Mockup Z.42-45) ---------------------------------------------------------------
  it("B1 · aktionen 12px 16px 0 · flex · gap 8 · zwei gleich breite Knoepfe — an der realen Leiste", async () => {
    const stil = zielStil(ziel, Z_AKTIONEN);
    expect(await l.messen(sel?.aktionen, "margin")).toBe(kanonLaenge(zielProp(stil, "margin")));
    expect(await l.messen(sel?.aktionen, "display")).toBe(zielProp(stil, "display"));
    expect(await l.messen(sel?.aktionen, "gap")).toBe(zielProp(stil, "gap"));
    kantenGegenRand(await l.kanten(sel?.aktionen), "Aktionen");
    const e = await l.kanten(sel?.einfuegen);
    const k = await l.kanten(sel?.kopieren);
    expect(Math.abs(e.breite - k.breite)).toBeLessThan(1);
    expect(Math.abs(e.oben - k.oben)).toBeLessThan(1);
  });
  it("B2 · „Einfügen“ #C2500A · #FFFFFF · 12px 0 · radius 10 · 14px · 600 · zentriert · ohne Leuchten", async () => {
    const stil = zielStil(ziel, Z_EINFUEGEN);
    expect(zielText(ziel, Z_EINFUEGEN)).toBe("Einfügen");
    expect(await l.text(sel?.einfuegen)).toBe("Einfügen");
    expect(await l.messen(sel?.einfuegen, "background-color")).toBe(
      kanon(zielProp(stil, "background")),
    );
    expect(await l.messen(sel?.einfuegen, "color")).toBe(kanon(zielProp(stil, "color")));
    expect(await l.messen(sel?.einfuegen, "padding")).toBe(kanonLaenge(zielProp(stil, "padding")));
    expect(await l.messen(sel?.einfuegen, "border-radius")).toBe(zielProp(stil, "border-radius"));
    expect(await l.messen(sel?.einfuegen, "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await l.messen(sel?.einfuegen, "font-weight")).toBe(zielProp(stil, "font-weight"));
    expect(await l.messen(sel?.einfuegen, "text-align")).toBe(zielProp(stil, "text-align"));
    expect(await l.messen(sel?.einfuegen, "box-shadow")).toBe("none");
  });
  it("B3 · „Kopieren“ #FFFFFF · #1A2233 · rand 1px #E9E5DE · 12px 0 · radius 10 · 14px · 400", async () => {
    const stil = zielStil(ziel, Z_KOPIEREN);
    const soll = kanonRand(zielProp(stil, "border"));
    expect(zielText(ziel, Z_KOPIEREN)).toBe("Kopieren");
    expect(await l.text(sel?.kopieren)).toBe("Kopieren");
    expect(await l.messen(sel?.kopieren, "background-color")).toBe(
      kanon(zielProp(stil, "background")),
    );
    expect(await l.messen(sel?.kopieren, "color")).toBe(kanon(zielProp(stil, "color")));
    expect(await l.messen(sel?.kopieren, "border-top-width")).toBe(soll?.breite);
    expect(await l.messen(sel?.kopieren, "border-top-color")).toBe(soll?.farbe);
    expect(await l.messen(sel?.kopieren, "padding")).toBe(kanonLaenge(zielProp(stil, "padding")));
    expect(await l.messen(sel?.kopieren, "border-radius")).toBe(zielProp(stil, "border-radius"));
    expect(await l.messen(sel?.kopieren, "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await l.messen(sel?.kopieren, "font-weight")).toBe("400");
  });

  // ---- Frage-Feld unten (Mockup Z.47-53) -------------------------------------------------------
  it("F1 · feld unten: rahmen margin-top auto · 12px 16px 16px · karte OHNE schatten · leer · Platzhalter „Frage“", async () => {
    const stil = zielStil(ziel, Z_FELD_RAHMEN);
    // `margin-top: auto` loest Chromium fuer ein Flex-Kind zu Pixeln auf — gemessen wird deshalb
    // die WIRKUNG (der Rahmen schliesst unten ab, s. u.), nicht das Schluesselwort.
    expect(zielProp(stil, "margin-top")).toBe("auto");
    expect(await l.messen(sel?.feldRahmen, "padding")).toBe(kanonLaenge(zielProp(stil, "padding")));
    expect(zielStil(ziel, Z_FELD_KARTE.replace('"', "")) ?? "").not.toContain("box-shadow");
    expect(await l.messen(sel?.feldKarte, "box-shadow")).toBe("none");
    expect(await l.messen(sel?.feldKarte, "border-radius")).toBe("12px");
    expect(await l.sichtbar(sel?.feld)).toBe(true);
    expect(await l.eval<string>("(sel) => document.querySelector(sel).value", sel?.feld)).toBe("");
    expect(await l.attr(sel?.feld, "placeholder")).toBe("Frage");
    const k = await l.kanten(sel?.feldKarte);
    kantenGegenRand(k, "Frage-Feld");
    expect(Math.abs(ARTBOARD.hoehe - 16 - k.unten)).toBeLessThan(1);
  });

  // ---- Fussnotenziffern (Mockup Z.28-29) — Runde 4, Codex Pflicht 1 ---------------------------
  it("N1 · fussnote: GENAU EIN echtes <sup> „1“ — 10px · #9C5009 · 700 · super — am Ende des Antworttexts, sichtbar", async () => {
    expect(fehler).toBeNull();
    const stil = zielStil(ziel, Z_SUP);
    expect(stil, "Mockup ohne <sup>-Stil").not.toBeNull();
    const ziffern = await l.eval<string[]>(FUSSNOTEN_TEXT);
    expect(ziffern).toEqual(["1"]);
    expect(await l.sichtbar(SUP)).toBe(true);
    expect(await l.messen(SUP, "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await l.messen(SUP, "color")).toBe(kanon(zielProp(stil, "color")));
    expect(await l.messen(SUP, "font-weight")).toBe(zielProp(stil, "font-weight"));
    expect(await l.messen(SUP, "vertical-align")).toBe("super");
    // Ort: auf der letzten Zeile des Textfelds, rechts vom Textende, innerhalb der Karte.
    const s = await l.kanten(SUP);
    const text = await l.kanten(sel?.text);
    const karte = await l.kanten(sel?.karte);
    const zeile = Number.parseFloat((await l.messen(sel?.text, "line-height")) ?? "0");
    expect(s.oben).toBeGreaterThanOrEqual(text.unten - zeile - 2);
    expect(s.unten).toBeLessThanOrEqual(text.unten + 2);
    expect(s.links).toBeGreaterThan(text.links);
    expect(s.rechts).toBeLessThanOrEqual(karte.rechts);
    const textende = await l.eval<number>(TEXTENDE_X, sel?.text);
    expect(Math.abs(s.links - textende)).toBeLessThan(6);
  });
  it("N2 · fussnote ist dem Chip zugeordnet: dieselbe Quelle (data-quelle = Id des ECHTEN Objekts), dieselbe Nummer wie „1 · Titel“", async () => {
    expect(fehler).toBeNull();
    const quelle = await l.attr(SUP, "data-quelle");
    expect(quelle).toBe(flaeche?.koId);
    expect(await l.attr(sel?.chip, "data-quelle")).toBe(quelle);
    expect(await l.text(sel?.chipTitel)).toBe(`1 · ${TITEL}`);
  });
  it("N3 · KALIBRIERUNG: die Ziffer FOLGT dem Textende — getippter Text schiebt sie nach rechts, eine neue Zeile nach unten; danach steht der Antwortzustand wieder", async () => {
    expect(fehler).toBeNull();
    const s = l.seite();
    const vorher = await l.kanten(SUP);
    await s.focus(sel?.text ?? "");
    await s.type(sel?.text ?? "", " Zusatz");
    const rechts = await l.kanten(SUP);
    expect(rechts.links).toBeGreaterThan(vorher.links + 20);
    expect(Math.abs(rechts.oben - vorher.oben)).toBeLessThan(1);
    await s.type(sel?.text ?? "", "\nNeue Zeile");
    const unten = await l.kanten(SUP);
    expect(unten.oben).toBeGreaterThan(vorher.oben + 10);
    // Zurueck in den gemessenen Antwortzustand — ueber denselben echten Weg.
    await frageStellen(s);
    expect(await l.eval<string>("(sel) => document.querySelector(sel).value", sel?.text)).toBe(
      AUSSAGE,
    );
    expect(await l.eval<string[]>(FUSSNOTEN_TEXT)).toEqual(["1"]);
  });

  // ---- Was NICHT mehr da ist / Gesamtkomposition -----------------------------------------------
  it("W1 · weg: Pruefhinweis, Herkunftszeile im Sichtfeld, Fusszeile, „Neue Frage“, Leitsatz, Ladekarte; Ruhe-Mitte verborgen", async () => {
    expect(fehler).toBeNull();
    for (const weg of [
      "ask-review-notice",
      "antwortkarte-fuss",
      "antwortkarte-fuss-hinweis",
      "ask-neue-frage-btn",
      "klara-leitsatz",
      "kw-fuss",
      "ask-ladekarte",
    ]) {
      expect(
        await l.eval<boolean>(`() => !!document.getElementById('${weg}')`),
        `${weg} existiert noch`,
      ).toBe(false);
    }
    expect(await l.sichtbar("#antwortkarte-herkunft-zeile")).toBe(false);
    expect(await l.sichtbar("#ask-ruhe")).toBe(false);
    expect(await l.sichtbar("#ask-ai-notice")).toBe(false);
  });
  it("W2 · Gesamtkomposition: Frage-Zeile → Karte → Aktionen von oben nach unten, das Feld unten; kein Ueberlauf in der Breite", async () => {
    expect(fehler).toBeNull();
    const masse = await l.eval<{ scrollBreite: number }>(
      "() => ({ scrollBreite: document.documentElement.scrollWidth })",
    );
    expect(masse.scrollBreite).toBeLessThanOrEqual(ARTBOARD.breite);
    let vorher = Number.NEGATIVE_INFINITY;
    for (const el of [sel?.frage, sel?.karte, sel?.aktionen, sel?.feldRahmen]) {
      const k = await l.kanten(el);
      expect(k.oben).toBeGreaterThanOrEqual(vorher);
      vorher = k.unten - 1;
    }
    const kinder = await l.eval<string[]>(
      "() => { const sichtbar = (el) => { const r = el.getBoundingClientRect(); return getComputedStyle(el).display !== 'none' && r.height > 0 && r.width > 0; }; return [...document.getElementById('ask-answer-block').children].filter(sichtbar).map((el) => el.id || el.tagName.toLowerCase()); }",
    );
    expect(kinder.slice(0, 3)).toEqual([
      "ask-frage-zeile-btn",
      "antwortkarte",
      "antwortkarte-aktionen",
    ]);
    // Ein etwaiger vierter Eintrag ist NUR der lagebezogene Satz (Lieferung 5) — nie ein Hinweis.
    expect(kinder.slice(3).filter((k) => k !== "ask-vorbehalt")).toEqual([]);
  });

  // ---- Verhalten: Frage-Zeile → bearbeiten, Chevron → Ruhe -------------------------------------
  it("V1 · Klick auf die Frage-Zeile: die Frage steht wieder im Feld, die Antwort tritt zurueck, der Knopf ist bereit (Funke dunkel)", async () => {
    expect(fehler).toBeNull();
    const s = l.seite();
    await s.click(sel?.frage ?? "");
    expect(await l.eval<string>("() => document.getElementById('ask-input').value")).toBe(FRAGE);
    expect(await l.sichtbar("#ask-answer-block")).toBe(false);
    expect(await l.sichtbar("#ask-ruhe")).toBe(true);
    expect(await l.messen("#ask-btn", "background-color")).toBe("rgb(194, 80, 10)");
    // Zurueck in den Antwortzustand — ueber denselben echten Weg.
    await frageStellen(s);
    expect(await l.sichtbar("#ask-answer-block")).toBe(true);
  });
  it("V2 · der Zurueck-Chevron: Ruhe — Feld leer, Antwort verborgen, Antwortfeld geleert, Umschalter wieder da", async () => {
    expect(fehler).toBeNull();
    await l.seite().click("#kw-zurueck");
    expect(await l.eval<string>("() => document.getElementById('ask-input').value")).toBe("");
    expect(await l.sichtbar("#ask-answer-block")).toBe(false);
    expect(await l.eval<string>("() => document.getElementById('ask-answer-edit').value")).toBe("");
    expect(await l.sichtbar("#ask-ruhe")).toBe(true);
    expect(await l.sichtbar("#kw-segment")).toBe(true);
    expect(await l.sichtbar("#kw-zurueck")).toBe(false);
    expect(flaeche?.seitenfehler).toEqual([]);
  });
});

// ================================================================================================
// Runde 4 (Codex Pflicht 1): MINDESTENS ZWEI ZUORDNUNGEN. Der retrieval-only-Server liefert eine
// Antwort als Aussage GENAU EINER Quelle (provider.ts: sources = citedSources = [best.id]) — zwei
// tragende Quellen stellt deshalb der Ask-Vertrag als Route; die Quellen selbst sind DREI ECHTE
// validierte Objekte der App (GET /api/kos/:id laeuft gegen die echte App): zwei tragend, eine nur
// herangezogen.
// ================================================================================================
describe("JOB 3056 · K1 · Antwort — zwei tragende Quellen, eine herangezogene: Ziffern, Reihenfolge, Stil, Quellenbezug", () => {
  const ZWEITER_TITEL = "HD Handbook";
  const DRITTER_TITEL = "Randnotiz Spritzzonen";
  const ANTWORT =
    "Offene, ablaufende Profile sind zu bevorzugen.\n\nIst ein geschlossenes Profil unvermeidbar, sind Begruendung und Entwaesserungskonzept zu dokumentieren.";
  let f2: Flaeche | null = null;
  let fehler2: string | null = null;
  const l2 = leser(
    () => f2?.seite ?? null,
    () => fehler2,
  );
  const ids = (): string[] => [f2?.koId ?? "", ...(f2?.weitereIds ?? [])];

  beforeAll(async () => {
    try {
      f2 = await starteFlaeche({
        mitWissen: true,
        weitereObjekte: [
          { titel: ZWEITER_TITEL, aussage: "Geschlossene Profile sind zu begruenden." },
          { titel: DRITTER_TITEL, aussage: "Spritzzonen sind gesondert zu betrachten." },
        ],
      });
      const [a, b, c] = ids();
      await f2.seite.route(
        ASK_URL,
        askAntwort({
          answered: true,
          answer: ANTWORT,
          sources: [a, b, c],
          citedSources: [a, b],
          trust: 80,
          steps: [],
          demo: false,
          evidence: { grade: "verified" },
        }),
      );
      await frageStellen(f2.seite, "Welche Profile sind in Spritzzonen erlaubt?");
    } catch (e) {
      fehler2 = String(e).split("\n").slice(0, 3).join(" | ");
    }
  }, 120_000);

  afterAll(async () => {
    await f2?.schliessen();
  }, 60_000);

  it("Z1 · zwei Ziffern „1“ „2“ in Chip-Reihenfolge, beide mit dem Stil des Mockups, nebeneinander am Textende — kein Seitenfehler", async () => {
    expect(fehler2).toBeNull();
    expect(await l2.eval<string[]>(FUSSNOTEN_TEXT)).toEqual(["1", "2"]);
    const stil = zielStil(ziel, Z_SUP);
    for (const n of [1, 2]) {
      const s = `${SUP}:nth-child(${n})`;
      expect(await l2.sichtbar(s)).toBe(true);
      expect(await l2.messen(s, "font-size")).toBe(zielProp(stil, "font-size"));
      expect(await l2.messen(s, "color")).toBe(kanon(zielProp(stil, "color")));
      expect(await l2.messen(s, "font-weight")).toBe(zielProp(stil, "font-weight"));
    }
    const eins = await l2.kanten(`${SUP}:nth-child(1)`);
    const zwei = await l2.kanten(`${SUP}:nth-child(2)`);
    expect(zwei.links).toBeGreaterThan(eins.rechts - 0.5);
    expect(Math.abs(zwei.oben - eins.oben)).toBeLessThan(1);
    // Am Ende des ZWEITEN Absatzes — die letzte Zeile des Felds, rechts vom Textende.
    const text = await l2.kanten("#ask-answer-edit");
    const zeile = Number.parseFloat((await l2.messen("#ask-answer-edit", "line-height")) ?? "0");
    expect(eins.oben).toBeGreaterThanOrEqual(text.unten - zeile - 2);
    expect(
      Math.abs(eins.links - (await l2.eval<number>(TEXTENDE_X, "#ask-answer-edit"))),
    ).toBeLessThan(6);
    expect(f2?.seitenfehler).toEqual([]);
  });
  it("Z2 · Quellenbezug: Ziffer 1 → Chip 1, Ziffer 2 → Chip 2 (dieselbe Objekt-Id, derselbe Titel); die dritte, nur herangezogene Quelle hat KEINE Ziffer", async () => {
    expect(fehler2).toBeNull();
    const [a, b, c] = ids();
    expect(await l2.eval<string[]>(FUSSNOTEN_QUELLEN)).toEqual([a, b]);
    const chips = await l2.eval<Array<{ q: string | null; t: string }>>(
      "() => [...document.querySelectorAll('#ask-sources li.quelle-chip')].map((c) => ({ q: c.getAttribute('data-quelle'), t: c.textContent.replace(/\\s+/g, ' ').trim() }))",
    );
    expect(chips).toEqual([
      { q: a, t: `1 · ${TITEL}` },
      { q: b, t: `2 · ${ZWEITER_TITEL}` },
    ]);
    // „+1" holt die dritte Quelle ins Bild — sie bleibt ohne Ziffer, und unter „Mehr" steht ihre
    // Rolle: herangezogen, nicht tragend.
    expect(await l2.text("#ask-quellen-mehr-btn")).toBe("+1");
    await l2.seite().click("#ask-quellen-mehr-btn");
    const alle = await l2.eval<Array<string | null>>(
      "() => [...document.querySelectorAll('#ask-sources li.quelle-chip')].map((c) => c.getAttribute('data-quelle'))",
    );
    expect(alle).toEqual([a, b, c]);
    expect(await l2.eval<string[]>(FUSSNOTEN_QUELLEN)).toEqual([a, b]);
    await l2.seite().click("#ask-mehr-btn");
    const dritte = await l2.text("#ask-quellen-detail li:nth-child(3)");
    expect(dritte).toContain(`3 · ${DRITTER_TITEL}`);
    expect(dritte).toContain(await l2.eval<string>("() => t('askRoleConsulted')"));
    const erste = await l2.text("#ask-quellen-detail li:nth-child(1)");
    expect(erste).toContain(await l2.eval<string>("() => t('askRoleCarrying')"));
  });
  it("Z3 · KALIBRIERUNG: ohne die zweite Ziffer ist die Zuordnung unvollstaendig — die Pruefung wuerde rot; zurueckgesetzt ist sie wieder gruen", async () => {
    expect(fehler2).toBeNull();
    const ohne = await l2.eval<string[]>(
      `() => { const s = document.querySelectorAll('#ask-fussnoten sup.fussnote')[1]; const eltern = s.parentNode; s.remove(); const r = (${FUSSNOTEN_QUELLEN})(); eltern.appendChild(s); return r; }`,
    );
    expect(ohne).toEqual([ids()[0]]);
    expect(await l2.eval<string[]>(FUSSNOTEN_QUELLEN)).toEqual(ids().slice(0, 2));
  });
});

// ================================================================================================
// Runde 6 (Codex, Runde 5): DAS RENNEN ZWEIER FRAGEN. Das Frage-Feld bleibt unter der Antwort (es
// IST die neue Frage); die Quellen werden NACH der Antwort aufgeloest (GET /api/kos/:id gegen die
// echte App). Hier wird der Quellen-Abruf der ERSTEN Antwort GEHALTEN, die zweite Frage mit einer
// anderen Quelle vollstaendig angezeigt, und erst dann der gehaltene Abruf freigegeben. Antwort,
// Chip, Fussnote und die Quellenmetadaten der Ausgabe (currentAskSourceTitles) muessen danach
// weiter Frage 2 gehoeren. Codex' Gegenbeweis (Runde 5) zeigte am Stand davor den Chip von Frage 1.
// ================================================================================================
describe("JOB 3056 · K1 · Antwort — zwei Fragen nacheinander: der verspaetete Quellen-Ruecklauf der ersten aendert die zweite nicht", () => {
  const ZWEITER_TITEL = "HD Handbook";
  const ANTWORT_ZWEI = "Geschlossene Profile sind zu begruenden.";
  let f3: Flaeche | null = null;
  let fehler3: string | null = null;
  let freigeben: (() => void) | null = null;
  let gehalten = 0;
  let freigegebenNach: "antwort2" | null = null;
  const l3 = leser(
    () => f3?.seite ?? null,
    () => fehler3,
  );
  const CHIPS =
    "() => [...document.querySelectorAll('#ask-sources li.quelle-chip')].map((c) => ({ q: c.getAttribute('data-quelle'), t: c.textContent.replace(/\\s+/g, ' ').trim() }))";
  const WERT = "(sel) => document.querySelector(sel).value";

  beforeAll(async () => {
    try {
      f3 = await starteFlaeche({
        mitWissen: true,
        weitereObjekte: [{ titel: ZWEITER_TITEL, aussage: ANTWORT_ZWEI }],
      });
      const s = f3.seite;
      const a = f3.koId;
      const b = f3.weitereIds[0] ?? "";
      // Der Quellen-Abruf der ERSTEN Quelle wird gehalten — bis `freigeben` ruft; danach geht er
      // an die echte App (fallback = die Werkbank-Route).
      const tor = new Promise<void>((r) => {
        freigeben = r;
      });
      await s.route(`${ORIGIN}/api/kos/${a}`, async (route) => {
        gehalten += 1;
        await tor;
        await route.fallback();
      });
      // Frage 1 → Quelle a, Frage 2 → Quelle b (gezaehlt, nicht am Wortlaut erraten).
      let fragen = 0;
      await s.route(ASK_URL, async (route) => {
        fragen += 1;
        const zweite = fragen >= 2;
        await askAntwort({
          answered: true,
          answer: zweite ? ANTWORT_ZWEI : AUSSAGE,
          sources: [zweite ? b : a],
          citedSources: [zweite ? b : a],
          trust: 80,
          steps: [],
          demo: false,
          evidence: { grade: "verified" },
        })(route);
      });
      // Frage 1: nur bis die Karte steht — der Kopieren-Knopf wird NICHT frei, der Abruf haengt.
      await s.fill("#ask-input", FRAGE);
      await s.click("#ask-btn");
      await s.waitForFunction(
        fn(
          `(soll) => { const b = document.getElementById('ask-answer-block'); return !!b && b.className.indexOf('hidden') === -1 && document.getElementById('ask-answer-edit').value === soll; }`,
        ),
        AUSSAGE,
        { timeout: 30_000 },
      );
      // Frage 2 ueber das Feld unten — bis Kopieren frei ist (Quelle b kommt von der echten App).
      await frageStellen(s, "Und geschlossene Profile?");
      freigegebenNach = "antwort2";
    } catch (e) {
      fehler3 = String(e).split("\n").slice(0, 3).join(" | ");
    }
  }, 120_000);

  afterAll(async () => {
    freigeben?.();
    await f3?.schliessen();
  }, 60_000);

  it("V1 · vor der Freigabe: Antwort 2 steht mit Chip 2, Ziffer 2 und freiem Kopieren; der Abruf von Quelle 1 ist genau einmal gehalten", async () => {
    expect(fehler3).toBeNull();
    const b = f3?.weitereIds[0] ?? "";
    expect(gehalten).toBe(1);
    expect(await l3.eval<string>(WERT, "#ask-answer-edit")).toBe(ANTWORT_ZWEI);
    expect(await l3.eval<Array<{ q: string | null; t: string }>>(CHIPS)).toEqual([
      { q: b, t: `1 · ${ZWEITER_TITEL}` },
    ]);
    expect(await l3.eval<string[]>(FUSSNOTEN_QUELLEN)).toEqual([b]);
    expect(await l3.eval<boolean>("() => document.getElementById('ask-copy-btn').disabled")).toBe(
      false,
    );
  });
  it("V2 · nach der Freigabe des Ruecklaufs von Frage 1: Text, Chip, Ziffer, Quellenmetadaten der Ausgabe und das Tor gehoeren weiter Frage 2 — kein Seitenfehler", async () => {
    expect(fehler3).toBeNull();
    expect(freigegebenNach).toBe("antwort2");
    const b = f3?.weitereIds[0] ?? "";
    freigeben?.();
    // Der freigegebene Abruf laeuft gegen die echte App und kommt binnen Millisekunden zurueck;
    // zwei Sekunden sind die Frist, in der ein falscher Ruecklauf sichtbar wuerde.
    await new Promise((r) => setTimeout(r, 2_000));
    expect(await l3.eval<string>(WERT, "#ask-answer-edit")).toBe(ANTWORT_ZWEI);
    expect(await l3.eval<Array<{ q: string | null; t: string }>>(CHIPS)).toEqual([
      { q: b, t: `1 · ${ZWEITER_TITEL}` },
    ]);
    expect(await l3.eval<string[]>(FUSSNOTEN_QUELLEN)).toEqual([b]);
    expect(await l3.eval<string[]>("() => currentAskSourceTitles")).toEqual([ZWEITER_TITEL]);
    expect(await l3.eval<boolean>("() => currentAskSourcesResolved")).toBe(true);
    expect(await l3.eval<boolean>("() => document.getElementById('ask-copy-btn').disabled")).toBe(
      false,
    );
    expect(f3?.seitenfehler).toEqual([]);
  });
  it("V3 · KALIBRIERUNG: die Werkbank sieht einen fremden Chip — ein Chip mit der Quelle von Frage 1 wuerde V2 rot machen", async () => {
    expect(fehler3).toBeNull();
    const a = f3?.koId ?? "";
    const vorher = await l3.eval<Array<{ q: string | null }>>(CHIPS);
    const fremd = await l3.eval<Array<{ q: string | null; t: string }>>(
      `(a) => { const li = document.querySelector('#ask-sources li.quelle-chip'); const alt = li.getAttribute('data-quelle'); li.setAttribute('data-quelle', a); const r = (${CHIPS})(); li.setAttribute('data-quelle', alt); return r; }`,
      a,
    );
    expect(fremd[0]?.q).toBe(a);
    expect(await l3.eval<Array<{ q: string | null }>>(CHIPS)).toEqual(vorher);
  });
});

describe.runIf(!existsSync(MOCKUP_ANTWORT))(
  "JOB 3056 · Mockup-Abgleich Antwort uebersprungen",
  () => {
    it("meldet das fehlende Mockup statt eine Pruefung vorzutaeuschen", () => {
      expect(existsSync(MOCKUP_ANTWORT), `Mockup nicht lesbar: ${MOCKUP_ANTWORT}`).toBe(false);
    });
  },
);
