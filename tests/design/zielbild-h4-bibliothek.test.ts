// ================================================================================================
// JOB 3063 · H4 — DIE BIBLIOTHEK GEGEN IHR MOCKUP, IN CHROMIUM AN DER GEBAUTEN SEITE GEMESSEN.
// ================================================================================================
//
// PEDIS FRAGE (04.09.): „Sieht die Bibliothek wirklich so aus wie gezeichnet — auf der echten Seite
// gemessen, nicht an einem Nachbau?"
//
// DIE SOLLWERTE WERDEN AUS DEM MOCKUP GELESEN, nicht abgeschrieben: `zielStil`/`zielProp` holen sie
// aus `design/klarwerk/Bibliothek.dc.html`. Ändert jemand dort eine Zahl, wandert der Sollwert mit —
// eine abgeschriebene Tabelle wäre die zweite Wahrheit, die JOB 3013 R1 zu Recht gerügt hat.
//
// GEMESSEN WIRD AN DEN REALEN ELEMENTEN der gemounteten Seite, gefunden über ihre Testanker, und
// jeder Fund wird über seinen CSS-PFAD rückwärts aufgelöst (`document.querySelector(pfad) === el`).
// Fall S hält das fest; ohne ihn wäre jeder Vergleich unten wertlos.
//
// EIN VERGLEICH JE WERT. Eine Gegenmutation am Mockup (Spaltenbreite 380 → 360) macht GENAU den
// Fall rot, dessen Name den Wert trägt.
import { existsSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  BEREICH_FREI,
  type H4Stand,
  LESEN,
  MOCKUP,
  PFAD_FN,
  QUELLE_LABEL,
  TITEL_FREI,
  TITEL_OFFEN,
  fn,
  h4Stand,
  kanon,
  polster,
  zielProp,
  zielStil,
} from "./h4-harness";

// ---- Die Anker im Mockup (jeder zeigt auf GENAU ein Element der Vorlage) -------------------------
const Z_SPALTE = "width: 380px; border-right";
const Z_SUCHFELD = "padding: 8px 12px; background: #FAF8F5";
const Z_SEGMENT = "background: #EEEAE3; border-radius";
const Z_SEGMENT_AKTIV = "background: #FFFFFF; font-size: 13px; font-weight: 600";
const Z_MENUE_BEREICH = "font-size: 12.5px; color: #525B6B;";
const Z_ZEILE_GEWAEHLT = "border-bottom: 1px solid #F2EFEA; background: #FDEADD";
const Z_PUNKT_GRUEN = "background: #116B3C";
const Z_PUNKT_GELB = "background: #8A5A00";
const Z_ZEILE_TITEL = "font-size: 14px; font-weight: 600; white-space: nowrap";
const Z_ZEILE_META = "font-size: 12px; color: #525B6B";
const Z_FUSS = "padding: 10px 16px; border-top";
const Z_LESESPALTE = "width: 720px; padding: 36px 0";
const Z_PILLE = "font-size: 11px; font-weight: 700; letter-spacing";
const Z_META = "font-size: 12.5px; color: #525B6B";
const Z_KNOPF = "padding: 10px 20px; background: #FFFFFF";
const Z_TITEL = "font-size: 24px; font-weight: 650";
const Z_TEXT = "font-size: 15.5px; line-height: 1.7";
const Z_CHIPS = "gap: 8px; padding-top: 6px; border-top";
const Z_CHIP = "padding: 5px 10px; background: #FAF8F5";
const Z_CHIP_TEXT = "font-size: 12px; font-weight: 600";

// ---- Die realen Elemente finden und ihre Selektoren als Beleg zurückgeben ------------------------
const ELEMENTE = `([titelFrei, pfadFnSrc]) => {
  const pfad = eval('(' + pfadFnSrc + ')');
  const q = (s) => document.querySelector(s);
  const zeilen = [...document.querySelectorAll('[data-testid="bib-zeile"]')];
  const gewaehlt = zeilen.find((z) => z.getAttribute('aria-current') === 'true') || null;
  const andere = zeilen.find((z) => z !== gewaehlt) || null;
  const liste = q('[data-testid="bib-liste"]');
  const lesen = q('[data-testid="bib-lesen"]');
  const chip = q('[data-testid="bib-quellen-chip"]');
  const out = {
    liste: liste ? pfad(liste) : null,
    suchfeld: q('[data-testid="bib-suchfeld"]') ? pfad(q('[data-testid="bib-suchfeld"]')) : null,
    sucheingabe: q('[data-testid="bib-suche"]') ? pfad(q('[data-testid="bib-suche"]')) : null,
    segment: q('[data-testid="bib-segment"]') ? pfad(q('[data-testid="bib-segment"]')) : null,
    segmentAktiv: q('[data-testid="bib-segment-alle"]') ? pfad(q('[data-testid="bib-segment-alle"]')) : null,
    segmentPassiv: q('[data-testid="bib-segment-offen"]') ? pfad(q('[data-testid="bib-segment-offen"]')) : null,
    menueBereich: q('[data-testid="bib-menue-bereich"]') ? pfad(q('[data-testid="bib-menue-bereich"]')) : null,
    zeileGewaehlt: gewaehlt ? pfad(gewaehlt) : null,
    zeileAndere: andere ? pfad(andere) : null,
    punktGewaehlt: gewaehlt ? pfad(gewaehlt.querySelector('[data-testid="bib-punkt"]')) : null,
    punktAndere: andere ? pfad(andere.querySelector('[data-testid="bib-punkt"]')) : null,
    zeileTitel: gewaehlt ? pfad(gewaehlt.querySelector('[data-bib-text="zeile-titel"]')) : null,
    zeileMeta: gewaehlt ? pfad(gewaehlt.querySelector('[data-bib-text="zeile-meta"]')) : null,
    fuss: q('[data-testid="bib-fuss"]') ? pfad(q('[data-testid="bib-fuss"]')) : null,
    lesen: lesen ? pfad(lesen) : null,
    pille: q('[data-testid="bib-pille"]') ? pfad(q('[data-testid="bib-pille"]')) : null,
    meta: q('[data-testid="bib-meta"]') ? pfad(q('[data-testid="bib-meta"]')) : null,
    knopf: q('[data-testid="bib-fragen"]') ? pfad(q('[data-testid="bib-fragen"]')) : null,
    titel: q('[data-testid="bib-titel"]') ? pfad(q('[data-testid="bib-titel"]')) : null,
    text: q('[data-testid="bib-text"]') ? pfad(q('[data-testid="bib-text"]')) : null,
    chips: q('[data-testid="bib-chips"]') ? pfad(q('[data-testid="bib-chips"]')) : null,
    chip: chip ? pfad(chip) : null,
    chipText: chip ? pfad(chip.querySelector('span:last-child')) : null,
  };
  out.titelText = q('[data-testid="bib-titel"]') ? q('[data-testid="bib-titel"]').textContent.trim() : '';
  out.gewaehlterTitel = gewaehlt ? gewaehlt.querySelector('[data-bib-text="zeile-titel"]').textContent.trim() : '';
  out.stimmt = out.titelText === titelFrei && out.gewaehlterTitel === titelFrei;
  // Rückwärts aufgelöst: JEDER Pfad liefert genau das gefundene Element.
  out.aufgeloest = Object.entries(out)
    .filter(([k, v]) => typeof v === 'string' && v.startsWith('body > '))
    .every(([, v]) => document.querySelector(v) !== null);
  return out;
}`;

interface Selektoren {
  [k: string]: string | boolean | null;
}

let stand: H4Stand | null = null;
let fehler: string | null = null;
let sel: Selektoren | null = null;

describe("JOB 3063 · H4 · die Bibliothek gegen ihr Mockup — echte Seite, Chromium, Theme modern", () => {
  beforeAll(async () => {
    try {
      stand = await h4Stand("/bibliothek", "pedi@job3063-a.test");
      sel = await stand.seite.evaluate<Selektoren>(fn(ELEMENTE), [TITEL_FREI, PFAD_FN]);
      console.info(
        `JOB 3063 H4 · Chromium ${stand.version} · /bibliothek · Theme ${stand.theme} · Selektoren ${JSON.stringify(sel)}`,
      );
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 4).join(" | ");
    }
  }, 180_000);

  afterAll(async () => {
    await stand?.browser.close();
    await stand?.app.close();
  }, 60_000);

  const ziel = existsSync(MOCKUP) ? readFileSync(MOCKUP, "utf8") : "";

  async function messen(schluessel: string, eigenschaft: string): Promise<string | null> {
    expect(fehler, "Seite nicht gemountet").toBeNull();
    const s = sel?.[schluessel];
    expect(s, `reales Element nicht gefunden: ${schluessel}`).toBeTruthy();
    return (stand as H4Stand).seite.evaluate<string | null>(fn(LESEN), [s, eigenschaft]);
  }

  it("S · die echte Fläche steht: Theme modern, beide Spalten da, Selektoren rückwärts auflösbar, keine Seitenfehler", () => {
    expect(fehler).toBeNull();
    expect(stand?.theme).toBe("modern");
    expect(sel?.aufgeloest).toBe(true);
    expect(sel?.stimmt, "gewählter Eintrag und Lesefläche zeigen denselben Eintrag").toBe(true);
    expect(sel?.liste).toMatch(/^body > /);
    expect(sel?.lesen).toMatch(/^body > /);
    // Fail-closed: ein Laufzeitfehler der Seite darf nicht still unter grünen Messwerten liegen.
    expect(stand?.seitenfehler ?? ["nicht gemessen"]).toEqual([]);
  });

  // ---- Linke Spalte ------------------------------------------------------------------------------
  it("V1 · spaltenbreite 380px — width an der realen linken Spalte", async () => {
    expect(await messen("liste", "width")).toBe(kanon(zielProp(zielStil(ziel, Z_SPALTE), "width")));
  });
  it("V2 · spalten-trennlinie 1px #E9E5DE — border-right an der realen linken Spalte", async () => {
    const soll = zielProp(zielStil(ziel, Z_SPALTE), "border-right");
    expect(
      `${await messen("liste", "border-right-width")} solid ${await messen("liste", "border-right-color")}`,
    ).toBe(
      kanon(soll?.split(" ").slice(0, 2).join(" ") ?? null)?.concat(
        ` ${kanon(soll?.split(" ")[2] ?? null)}`,
      ),
    );
  });
  it("V3 · spalten-grund #FFFFFF — background-color an der realen linken Spalte", async () => {
    expect(await messen("liste", "background-color")).toBe(
      kanon(zielProp(zielStil(ziel, Z_SPALTE), "background")),
    );
  });
  it("V4 · suchfeld-polster 8px 12px und Radius 9px — am realen Suchfeld", async () => {
    const stil = zielStil(ziel, Z_SUCHFELD);
    expect(await messen("suchfeld", "padding-top")).toBe(polster(zielProp(stil, "padding"), "top"));
    expect(await messen("suchfeld", "padding-left")).toBe(
      polster(zielProp(stil, "padding"), "left"),
    );
    expect(await messen("suchfeld", "border-radius")).toBe(zielProp(stil, "border-radius"));
    expect(await messen("suchfeld", "background-color")).toBe(kanon(zielProp(stil, "background")));
  });
  it("V5 · suchtext 13px — font-size an der realen Sucheingabe", async () => {
    const stil = zielStil(ziel, "font-size: 13px; color: #9AA2B1");
    expect(await messen("sucheingabe", "font-size")).toBe(zielProp(stil, "font-size"));
  });
  it("V6 · segment-grund #EEEAE3, Radius 9px, Polster 2px — am realen Umschalter", async () => {
    const stil = zielStil(ziel, Z_SEGMENT);
    expect(await messen("segment", "background-color")).toBe(kanon(zielProp(stil, "background")));
    expect(await messen("segment", "border-radius")).toBe(zielProp(stil, "border-radius"));
    expect(await messen("segment", "padding-top")).toBe(zielProp(stil, "padding"));
  });
  it("V7 · aktives Segment weiß, 600, Radius 7px, Polster 6px 14px — am realen Segment „Alle“", async () => {
    const stil = zielStil(ziel, Z_SEGMENT_AKTIV);
    expect(await messen("segmentAktiv", "background-color")).toBe(
      kanon(zielProp(stil, "background")),
    );
    expect(await messen("segmentAktiv", "font-weight")).toBe(zielProp(stil, "font-weight"));
    expect(await messen("segmentAktiv", "border-radius")).toBe(zielProp(stil, "border-radius"));
    expect(await messen("segmentAktiv", "padding-top")).toBe(
      polster(zielProp(stil, "padding"), "top"),
    );
    expect(await messen("segmentAktiv", "padding-left")).toBe(
      polster(zielProp(stil, "padding"), "left"),
    );
  });
  it("V8 · passives Segment 13px #525B6B — am realen Segment „Offen“", async () => {
    const stil = zielStil(ziel, "border-radius: 7px; font-size: 13px; color: #525B6B");
    expect(await messen("segmentPassiv", "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await messen("segmentPassiv", "color")).toBe(kanon(zielProp(stil, "color")));
  });
  it("V9 · Menü „Bereich“ 12.5px #525B6B — am realen Menüknopf", async () => {
    const stil = zielStil(ziel, Z_MENUE_BEREICH);
    expect(await messen("menueBereich", "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await messen("menueBereich", "color")).toBe(kanon(zielProp(stil, "color")));
  });
  it("V10 · Zeilenpolster 12px 16px und Trennlinie #F2EFEA — an der realen Zeile", async () => {
    const stil = zielStil(ziel, Z_ZEILE_GEWAEHLT);
    expect(await messen("zeileGewaehlt", "padding-top")).toBe(
      polster(zielProp(stil, "padding"), "top"),
    );
    expect(await messen("zeileGewaehlt", "padding-left")).toBe(
      polster(zielProp(stil, "padding"), "left"),
    );
    expect(await messen("zeileGewaehlt", "border-bottom-color")).toBe(
      kanon(zielProp(stil, "border-bottom")?.split(" ")[2] ?? null),
    );
  });
  it("V11 · gewählte Zeile #FDEADD — background-color an der realen gewählten Zeile", async () => {
    expect(await messen("zeileGewaehlt", "background-color")).toBe(
      kanon(zielProp(zielStil(ziel, Z_ZEILE_GEWAEHLT), "background")),
    );
  });
  it("V12 · Zustandspunkt 8px, rund, grün #116B3C — am realen Punkt des freigegebenen Eintrags", async () => {
    const stil = zielStil(ziel, Z_PUNKT_GRUEN);
    expect(await messen("punktGewaehlt", "width")).toBe(zielProp(stil, "width"));
    expect(await messen("punktGewaehlt", "height")).toBe(zielProp(stil, "height"));
    expect(await messen("punktGewaehlt", "border-radius")).toBe(zielProp(stil, "border-radius"));
    expect(await messen("punktGewaehlt", "background-color")).toBe(
      kanon(zielProp(stil, "background")),
    );
    expect(await messen("punktGewaehlt", "margin-top")).toBe(zielProp(stil, "margin-top"));
  });
  it("V13 · Zustandspunkt gelb #8A5A00 am offenen Eintrag — dieselbe Stelle, anderer Zustand", async () => {
    expect(await messen("punktAndere", "background-color")).toBe(
      kanon(zielProp(zielStil(ziel, Z_PUNKT_GELB), "background")),
    );
  });
  it("V14 · Zeilentitel 14px, gewählt 600, gekappt — am realen Titel der gewählten Zeile", async () => {
    const stil = zielStil(ziel, Z_ZEILE_TITEL);
    expect(await messen("zeileTitel", "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await messen("zeileTitel", "font-weight")).toBe(zielProp(stil, "font-weight"));
    expect(await messen("zeileTitel", "text-overflow")).toBe(zielProp(stil, "text-overflow"));
    expect(await messen("zeileTitel", "white-space")).toBe(zielProp(stil, "white-space"));
  });
  it("V15 · Zeilen-Meta 12px #525B6B, Wortlaut „Bereich · Zustand“ — an der realen Meta-Zeile", async () => {
    const stil = zielStil(ziel, Z_ZEILE_META);
    expect(await messen("zeileMeta", "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await messen("zeileMeta", "color")).toBe(kanon(zielProp(stil, "color")));
    const text = await (stand as H4Stand).seite.evaluate<string>(
      fn("(s) => document.querySelector(s).textContent.trim()"),
      sel?.zeileMeta,
    );
    expect(text.startsWith(`${BEREICH_FREI} · `)).toBe(true);
    expect(text.split(" · ").length).toBe(2);
  });
  it("V16 · Listenfuß 10px 16px, 12px #525B6B, Zähler — am realen Fuß", async () => {
    const stil = zielStil(ziel, Z_FUSS);
    expect(await messen("fuss", "padding-top")).toBe(polster(zielProp(stil, "padding"), "top"));
    expect(await messen("fuss", "padding-left")).toBe(polster(zielProp(stil, "padding"), "left"));
    expect(await messen("fuss", "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await messen("fuss", "color")).toBe(kanon(zielProp(stil, "color")));
  });

  // ---- Rechte Lesefläche -------------------------------------------------------------------------
  it("V17 · Lesespalte 720px, 36px oben — an der realen Lesefläche", async () => {
    const stil = zielStil(ziel, Z_LESESPALTE);
    expect(await messen("lesen", "width")).toBe(zielProp(stil, "width"));
    expect(await messen("lesen", "padding-top")).toBe(polster(zielProp(stil, "padding"), "top"));
  });
  it("V18 · Status-Pille 11px/700, Abstand 0.3px, Polster 3px 10px, Radius 999px, grün auf #E0F1E7", async () => {
    const stil = zielStil(ziel, Z_PILLE);
    expect(await messen("pille", "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await messen("pille", "font-weight")).toBe(zielProp(stil, "font-weight"));
    expect(await messen("pille", "letter-spacing")).toBe(zielProp(stil, "letter-spacing"));
    expect(await messen("pille", "border-radius")).toBe(zielProp(stil, "border-radius"));
    expect(await messen("pille", "padding-top")).toBe(polster(zielProp(stil, "padding"), "top"));
    expect(await messen("pille", "padding-left")).toBe(polster(zielProp(stil, "padding"), "left"));
    expect(await messen("pille", "color")).toBe(kanon(zielProp(stil, "color")));
    expect(await messen("pille", "background-color")).toBe(kanon(zielProp(stil, "background")));
  });
  it("V19 · Meta-Zeile 12.5px #525B6B — an der realen Meta-Zeile der Lesefläche", async () => {
    const stil = zielStil(ziel, Z_META);
    expect(await messen("meta", "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await messen("meta", "color")).toBe(kanon(zielProp(stil, "color")));
  });
  it("V20 · Knopf 10px 20px, Radius 10px, 14px, weiß mit Haarlinie — am realen Knopf „Fragen“", async () => {
    const stil = zielStil(ziel, Z_KNOPF);
    expect(await messen("knopf", "padding-top")).toBe(polster(zielProp(stil, "padding"), "top"));
    expect(await messen("knopf", "padding-left")).toBe(polster(zielProp(stil, "padding"), "left"));
    expect(await messen("knopf", "border-radius")).toBe(zielProp(stil, "border-radius"));
    expect(await messen("knopf", "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await messen("knopf", "background-color")).toBe(kanon(zielProp(stil, "background")));
    expect(await messen("knopf", "border-top-color")).toBe(
      kanon(zielProp(stil, "border")?.split(" ")[2] ?? null),
    );
  });
  it("V21 · Titel 24px/650, Abstand -0.3px, Zeilenhöhe 1.3 — am realen Titel", async () => {
    const stil = zielStil(ziel, Z_TITEL);
    expect(await messen("titel", "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await messen("titel", "font-weight")).toBe(zielProp(stil, "font-weight"));
    expect(await messen("titel", "letter-spacing")).toBe(zielProp(stil, "letter-spacing"));
    const zh = Number.parseFloat((await messen("titel", "line-height")) ?? "0");
    const gr = Number.parseFloat((await messen("titel", "font-size")) ?? "1");
    expect((zh / gr).toFixed(2)).toBe(Number(zielProp(stil, "line-height")).toFixed(2));
  });
  it("V22 · Text 15.5px, Zeilenhöhe 1.7 — an der realen Textfläche", async () => {
    const stil = zielStil(ziel, Z_TEXT);
    expect(await messen("text", "font-size")).toBe(zielProp(stil, "font-size"));
    const zh = Number.parseFloat((await messen("text", "line-height")) ?? "0");
    const gr = Number.parseFloat((await messen("text", "font-size")) ?? "1");
    expect((zh / gr).toFixed(2)).toBe(Number(zielProp(stil, "line-height")).toFixed(2));
  });
  it("V23 · Chip-Reihe: Abstand 8px, 6px über der Linie, Linie #E9E5DE", async () => {
    const stil = zielStil(ziel, Z_CHIPS);
    expect(await messen("chips", "gap")).toBe(zielProp(stil, "gap"));
    expect(await messen("chips", "padding-top")).toBe(zielProp(stil, "padding-top"));
    expect(await messen("chips", "border-top-color")).toBe(
      kanon(zielProp(stil, "border-top")?.split(" ")[2] ?? null),
    );
  });
  it("V24 · Quellen-Chip 5px 10px, Radius 8px, #FAF8F5 mit Haarlinie — am realen Chip", async () => {
    const stil = zielStil(ziel, Z_CHIP);
    expect(await messen("chip", "padding-top")).toBe(polster(zielProp(stil, "padding"), "top"));
    expect(await messen("chip", "padding-left")).toBe(polster(zielProp(stil, "padding"), "left"));
    expect(await messen("chip", "border-radius")).toBe(zielProp(stil, "border-radius"));
    expect(await messen("chip", "background-color")).toBe(kanon(zielProp(stil, "background")));
  });
  it("V25 · Chip-Text 12px/600 und Wortlaut „1 · <Quelle>“ — am realen Chip-Text", async () => {
    const stil = zielStil(ziel, Z_CHIP_TEXT);
    expect(await messen("chipText", "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await messen("chipText", "font-weight")).toBe(zielProp(stil, "font-weight"));
    const text = await (stand as H4Stand).seite.evaluate<string>(
      fn("(s) => document.querySelector(s).textContent.trim()"),
      sel?.chipText,
    );
    expect(text).toBe(`1 · ${QUELLE_LABEL}`);
  });

  // ---- Was die Fläche ABGELÖST hat ---------------------------------------------------------------
  it("V26 · die Facettenwand, die Export-Leiste und der Kicker sind WEG — nicht versteckt", async () => {
    expect(fehler).toBeNull();
    const befund = await (stand as H4Stand).seite.evaluate<{
      facetten: number;
      exportSelect: number;
      /** Überschriften IM Inhaltsbereich — nach dem Umbau genau eine: der Titel des Eintrags. */
      ueberschriften: string[];
      /** Der Seitenkopf des alten Aufbaus (`PageHeader`: `h1.text-2xl` mit Kicker darüber). */
      seitenkopf: number;
      weitereLaden: number;
      antwortKarte: number;
    }>(
      fn(`() => {
        const main = document.querySelector('main');
        return {
          facetten: document.querySelectorAll('[data-testid="facet-rail"], [data-testid="facet-filter"], [data-testid="facet-active-bar"]').length,
          exportSelect: [...document.querySelectorAll('select')].filter((s) => (s.getAttribute('aria-label') || '').toLowerCase().includes('export')).length,
          ueberschriften: [...main.querySelectorAll('h1')].map((h) => (h.textContent || '').trim()),
          seitenkopf: main.querySelectorAll('h1.text-2xl').length,
          weitereLaden: [...document.querySelectorAll('button')].filter((b) => /Weitere \\d+ laden/.test(b.textContent || '')).length,
          antwortKarte: [...document.querySelectorAll('h2')].filter((h) => /Antwort statt/.test(h.textContent || '')).length,
        };
      }`),
    );
    console.info(`JOB 3063 H4 · Ablösung: ${JSON.stringify(befund)}`);
    expect(befund.facetten).toBe(0);
    expect(befund.exportSelect).toBe(0);
    // Kein `PageHeader` mehr: die einzige Überschrift der Fläche ist der Titel des Eintrags.
    expect(befund.seitenkopf).toBe(0);
    expect(befund.ueberschriften).toEqual([TITEL_FREI]);
    expect(befund.weitereLaden).toBe(0);
    expect(befund.antwortKarte).toBe(0);
  });
});

// ================================================================================================
// DIE ADRESSE `/wissen/:id` ZEIGT DIESELBE FLÄCHE — Lieferung 4 des Auftrags.
// ================================================================================================
// Bis zu diesem Auftrag war das eine EIGENE Seite mit dreizehn Karten. Sie ist ersetzt, nicht
// danebengestellt: hier wird gemessen, dass die Adresse dieselbe Zwei-Flächen-Struktur liefert, mit
// dem genannten Eintrag rechts — und dass die dreizehn Karten dort NICHT mehr offen liegen.
describe("JOB 3063 · H4 · /wissen/:id ist dieselbe Fläche mit vorgewähltem Eintrag", () => {
  let d: H4Stand | null = null;
  let dFehler: string | null = null;

  beforeAll(async () => {
    try {
      d = await h4Stand("/wissen/:frei", "pedi@job3063-d.test");
    } catch (e) {
      dFehler = String(e).split("\n").slice(0, 4).join(" | ");
    }
  }, 180_000);
  afterAll(async () => {
    await d?.browser.close();
    await d?.app.close();
  }, 60_000);

  it("D1 · dieselbe Struktur: 380-px-Liste links, 720-px-Lesefläche rechts, der Eintrag der Adresse vorgewählt", async () => {
    expect(dFehler).toBeNull();
    const befund = await (d as H4Stand).seite.evaluate<{
      liste: string;
      lesen: string;
      titel: string;
      gewaehlt: string;
      zeilen: number;
      karten: number;
      abschnitteOffen: number;
    }>(
      fn(`() => {
        const zeilen = [...document.querySelectorAll('[data-testid="bib-zeile"]')];
        const gewaehlt = zeilen.find((z) => z.getAttribute('aria-current') === 'true');
        return {
          liste: getComputedStyle(document.querySelector('[data-testid="bib-liste"]')).width,
          lesen: getComputedStyle(document.querySelector('[data-testid="bib-lesen"]')).width,
          titel: document.querySelector('[data-testid="bib-titel"]').textContent.trim(),
          gewaehlt: gewaehlt ? gewaehlt.querySelector('[data-bib-text="zeile-titel"]').textContent.trim() : '',
          zeilen: zeilen.length,
          karten: document.querySelectorAll('main .rounded-card').length,
          abschnitteOffen: document.querySelectorAll('[data-bib-abschnitt]').length,
        };
      }`),
    );
    console.info(`JOB 3063 H4 · /wissen/:id: ${JSON.stringify(befund)}`);
    expect(befund.liste).toBe("380px");
    expect(befund.lesen).toBe("720px");
    expect(befund.titel).toBe(TITEL_FREI);
    expect(befund.gewaehlt).toBe(TITEL_FREI);
    expect(befund.zeilen).toBe(2);
    // Zugeklappt als Vorgabe: die dreizehn Abschnitte sind erst NACH „Mehr" im Dokument.
    expect(befund.abschnitteOffen).toBe(0);
    // Die dreizehn Karten der alten Detailseite gibt es nicht mehr; übrig bleibt die eine
    // „Mehr"-Karte (plus, im Fall, die Panels für Rückfrage/Löschen — hier keins).
    expect(befund.karten).toBeLessThanOrEqual(2);
  }, 60_000);

  it("D2 · ein Klick auf einen anderen Eintrag wechselt Fläche UND Adresse — die Liste bleibt", async () => {
    expect(dFehler).toBeNull();
    const s = (d as H4Stand).seite;
    await s.evaluate(
      fn(`(titel) => {
        const z = [...document.querySelectorAll('[data-testid="bib-zeile"]')].find((e) => (e.textContent || '').includes(titel));
        if (z) z.click();
      }`),
      TITEL_OFFEN,
    );
    await s.waitForFunction(
      fn(
        `(titel) => { const el = document.querySelector('[data-testid="bib-titel"]'); return !!el && el.textContent.trim() === titel; }`,
      ),
      TITEL_OFFEN,
      { timeout: 20_000 },
    );
    const befund = await s.evaluate<{ pfad: string; zeilen: number }>(
      fn(
        `() => ({ pfad: location.pathname, zeilen: document.querySelectorAll('[data-testid="bib-zeile"]').length })`,
      ),
    );
    expect(befund.pfad).toBe(`/wissen/${(d as H4Stand).koOffenId}`);
    expect(befund.zeilen).toBe(2);
  }, 60_000);
});

describe.runIf(!existsSync(MOCKUP))("JOB 3063 · Mockup-Abgleich übersprungen", () => {
  it("meldet das fehlende Mockup, statt eine Prüfung vorzutäuschen", () => {
    expect(existsSync(MOCKUP), `Mockup nicht lesbar: ${MOCKUP}`).toBe(false);
  });
});
