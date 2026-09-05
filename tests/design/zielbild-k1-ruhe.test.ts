// ================================================================================================
// JOB 3056 · K1 — DIE RUHE NACH PEDIS MOCKUP `design/klara/Ruhe.dc.html` (04.09.2026), IN CHROMIUM.
// ================================================================================================
//
// PEDIS URTEIL (04.09. 06:50): „Text über Text über Text. Die Anwendung selbst macht ungefähr 10 %
// des Ganzen aus. Absolut unmöglich." MASSSTAB: Apple Pages — oben nur „Klara", der Umschalter
// Fragen | Erfassen und ein Zahnrad; in der Mitte nichts als Lupe und EIN Satz; unten das Frage-
// Feld. Sprache, KI-Stand, Sitzung, Zustimmung und Konto liegen hinter dem Zahnrad.
//
// Gemessen wird die ECHTE Auslieferung (apps/web/dist) in Chromium bei 360 × 720, angemeldet
// (echter GET /api/auth/me), JEDER tragende Wert des Mockups am realen Element (k1-messung.ts).
// Fall S verlangt, dass jedes Element gefunden ist — ein fehlendes ist ein Fehlschlag, kein
// „0 von 0 gruen". Kein Seitenfehler (`pageerror`) darf auftreten: entfernte Kennungen, die das
// Skript noch anfasst, fielen hier auf (Pruefpunkt 6).
//
// RED-FIRST (§6 des Auftrags): vor dem Umbau war dieser Test rot — Segment-Umschalter, Zahnrad und
// leere Mitte fehlten, #kw-fuss war sichtbar. Gegenprobe je Mutation aussen (Rueckgabe).
import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ARTBOARD,
  type Flaeche,
  MOCKUP_RUHE,
  aufloesen,
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

const ziel = mockup(MOCKUP_RUHE);

// ---- Anker im Mockup (Ruhe.dc.html) ------------------------------------------------------------
const Z_KOPF = "padding: 14px 16px 10px";
const Z_TITEL = "font-size: 15px; font-weight: 650";
const Z_RECHTS = "align-items: center; gap: 12px";
const Z_SEGMENT = "background: #EEEAE3; border-radius: 9px";
const Z_AKTIV = "background: #FFFFFF; font-size: 12.5px; font-weight: 600";
const Z_INAKTIV = "border-radius: 7px; font-size: 12.5px; color: #525B6B";
const Z_MITTE = "justify-content: center; align-items: center; gap: 10px; padding: 0 32px";
const Z_SATZ = "font-size: 14px; color: #9AA2B1";
const Z_FELD_RAHMEN = "padding: 12px 16px 16px";
const Z_KARTE = "border-radius: 12px; box-shadow";
const Z_FELD = "padding: 12px 52px 12px 14px";
const Z_KNOPF = "width: 32px; height: 32px; border-radius: 50%";
const ZAHNRAD_PFAD = "M19.4 15a1.65";
const LUPE_PFAD = "M21 21l-4.3-4.3";
const PFEIL_PFAD = "M12 19V5";

const SELEKTOREN = {
  kopf: "#kw-kopf",
  titel: "#kw-titel",
  rechts: "#kw-kopf-rechts",
  segment: "#kw-segment",
  aktiv: "#tab-ask",
  inaktiv: "#tab-capture",
  zahnrad: "#kw-zahnrad",
  zahnradSvg: "#kw-zahnrad svg",
  mitte: "#ask-ruhe",
  lupe: "#ask-ruhe-lupe",
  satz: "#ask-ruhe-satz",
  feldRahmen: "#ask-feld",
  karte: "#ask-karte",
  feld: "#ask-input",
  knopf: "#ask-btn",
  pfeil: "#ask-btn svg.pfeil",
};
type Sel = Record<keyof typeof SELEKTOREN, string | null> & { aufgeloest: boolean };

let flaeche: Flaeche | null = null;
let fehler: string | null = null;
let sel: Sel | null = null;

describe("JOB 3056 · K1 · Ruhe — die echte taskpane.html aus dist, in Chromium, angemeldet, ohne Frage", () => {
  beforeAll(async () => {
    try {
      flaeche = await starteFlaeche({ mitWissen: false });
      sel = (await aufloesen(flaeche.seite, SELEKTOREN)) as Sel;
      console.info(
        `JOB 3056 K1 Ruhe · Chromium ${flaeche.version} · Selektoren ${JSON.stringify(sel)}`,
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

  it("S · die echte Flaeche steht: JEDES Element des Mockups gefunden, Selektoren rueckwaerts aufloesbar, kein Seitenfehler", () => {
    expect(fehler).toBeNull();
    expect(sel).not.toBeNull();
    const fehlend = Object.entries(sel as Sel)
      .filter(([k, v]) => k !== "aufgeloest" && v === null)
      .map(([k]) => k);
    expect(fehlend, "Elemente des Mockups fehlen in der geladenen Seite").toEqual([]);
    expect((sel as Sel).aufgeloest).toBe(true);
    expect(flaeche?.seitenfehler, "Seitenfehler beim Laden (entfernte Kennung im Skript?)").toEqual(
      [],
    );
  });

  // ---- Kopf (Mockup Z.17-26) -------------------------------------------------------------------
  it("K1 · kopf-polster 14px 16px 10px · flex · space-between · center — am realen <header>", async () => {
    const stil = zielStil(ziel, Z_KOPF);
    expect(await l.messen(sel?.kopf, "padding")).toBe(kanonLaenge(zielProp(stil, "padding")));
    expect(await l.messen(sel?.kopf, "display")).toBe(zielProp(stil, "display"));
    expect(await l.messen(sel?.kopf, "justify-content")).toBe(zielProp(stil, "justify-content"));
    expect(await l.messen(sel?.kopf, "align-items")).toBe(zielProp(stil, "align-items"));
    const k = await l.kanten(sel?.kopf);
    expect(Math.abs(k.links)).toBeLessThan(1);
    expect(Math.abs(k.breite - ARTBOARD.breite)).toBeLessThan(1);
  });
  it("K2 · titel „Klara“ 15px · 650 · 0.2px — am realen Titel; sonst nichts im Kopf links", async () => {
    const stil = zielStil(ziel, Z_TITEL);
    expect(zielText(ziel, Z_TITEL)).toBe("Klara");
    expect(await l.text(sel?.titel)).toBe("Klara");
    expect(await l.messen(sel?.titel, "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await l.messen(sel?.titel, "font-weight")).toBe(zielProp(stil, "font-weight"));
    expect(await l.messen(sel?.titel, "letter-spacing")).toBe(zielProp(stil, "letter-spacing"));
    // In der Ruhe gibt es keinen Zurueck-Chevron: der Titel ist das erste sichtbare Kind links.
    expect(await l.sichtbar("#kw-zurueck")).toBe(false);
  });
  it("K3 · kopf-rechts flex · center · gap 12px — Umschalter und Zahnrad nebeneinander", async () => {
    const stil = zielStil(ziel, Z_RECHTS);
    expect(await l.messen(sel?.rechts, "display")).toBe(zielProp(stil, "display"));
    expect(await l.messen(sel?.rechts, "align-items")).toBe(zielProp(stil, "align-items"));
    expect(await l.messen(sel?.rechts, "gap")).toBe(zielProp(stil, "gap"));
    const s = await l.kanten(sel?.segment);
    const z = await l.kanten(sel?.zahnrad);
    expect(Math.abs(z.links - s.rechts - 12)).toBeLessThan(0.5);
    expect(Math.abs(ARTBOARD.breite - 16 - z.rechts)).toBeLessThan(1);
  });
  it("K4 · segment-grund #EEEAE3 · radius 9px · polster 2px · flex — am realen Umschalter", async () => {
    const stil = zielStil(ziel, Z_SEGMENT);
    expect(await l.messen(sel?.segment, "background-color")).toBe(
      kanon(zielProp(stil, "background")),
    );
    expect(await l.messen(sel?.segment, "border-radius")).toBe(zielProp(stil, "border-radius"));
    expect(await l.messen(sel?.segment, "padding")).toBe(kanonLaenge(zielProp(stil, "padding")));
    expect(await l.messen(sel?.segment, "display")).toBe(zielProp(stil, "display"));
  });
  it("K5 · aktives segment „Fragen“ 5px 12px · radius 7 · #FFFFFF · 12.5px · 600 · #1A2233 · schatten — am realen Fragen-Knopf", async () => {
    const stil = zielStil(ziel, Z_AKTIV);
    expect(zielText(ziel, Z_AKTIV)).toBe("Fragen");
    expect(await l.text(sel?.aktiv)).toBe("Fragen");
    expect(await l.messen(sel?.aktiv, "padding")).toBe(kanonLaenge(zielProp(stil, "padding")));
    expect(await l.messen(sel?.aktiv, "border-radius")).toBe(zielProp(stil, "border-radius"));
    expect(await l.messen(sel?.aktiv, "background-color")).toBe(
      kanon(zielProp(stil, "background")),
    );
    expect(await l.messen(sel?.aktiv, "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await l.messen(sel?.aktiv, "font-weight")).toBe(zielProp(stil, "font-weight"));
    expect(await l.messen(sel?.aktiv, "color")).toBe(kanon(zielProp(stil, "color")));
    expect(await l.messen(sel?.aktiv, "box-shadow")).toBe(
      kanonSchatten(zielProp(stil, "box-shadow")),
    );
  });
  it("K6 · inaktives segment „Erfassen“ 5px 12px · radius 7 · 12.5px · #525B6B · ohne Grund — am realen Erfassen-Knopf", async () => {
    const stil = zielStil(ziel, Z_INAKTIV);
    expect(zielText(ziel, Z_INAKTIV)).toBe("Erfassen");
    expect(await l.text(sel?.inaktiv)).toBe("Erfassen");
    expect(await l.messen(sel?.inaktiv, "padding")).toBe(kanonLaenge(zielProp(stil, "padding")));
    expect(await l.messen(sel?.inaktiv, "border-radius")).toBe(zielProp(stil, "border-radius"));
    expect(await l.messen(sel?.inaktiv, "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await l.messen(sel?.inaktiv, "color")).toBe(kanon(zielProp(stil, "color")));
    expect(await l.messen(sel?.inaktiv, "background-color")).toBe("rgba(0, 0, 0, 0)");
    expect(await l.messen(sel?.inaktiv, "box-shadow")).toBe("none");
  });
  it("K7 · zahnrad 18px · stroke #525B6B · 2 — das reale Zahnrad-SVG mit dem Pfad des Mockups", async () => {
    expect(ziel).toContain(ZAHNRAD_PFAD);
    expect(await l.attr(sel?.zahnradSvg, "width")).toBe(zielSvgAttr(ziel, ZAHNRAD_PFAD, "width"));
    expect(await l.messen(sel?.zahnradSvg, "stroke")).toBe(
      kanon(zielSvgAttr(ziel, ZAHNRAD_PFAD, "stroke")),
    );
    expect(await l.attr(sel?.zahnradSvg, "stroke-width")).toBe(
      zielSvgAttr(ziel, ZAHNRAD_PFAD, "stroke-width"),
    );
    const d = await l.eval<string | null>(
      "(sel) => { const p = document.querySelector(sel + ' path'); return p ? p.getAttribute('d') : null; }",
      sel?.zahnradSvg,
    );
    expect(d?.startsWith(ZAHNRAD_PFAD)).toBe(true);
  });
  it("K8 · sonst NICHTS im Kopf: keine Sprachwahl, keine Anmeldezeile, kein Vertrauenskopf, keine Sitzungszeile", async () => {
    const kinder = await l.eval<string[]>(
      `(sel) => { const sichtbar = (el) => { const r = el.getBoundingClientRect(); return getComputedStyle(el).display !== 'none' && r.width > 0 && r.height > 0; }; return [...document.querySelector(sel).querySelectorAll('*')].filter(sichtbar).map((el) => el.id || el.tagName.toLowerCase()); }`,
      sel?.kopf,
    );
    for (const alt of [
      "lang-de",
      "kw-anmeldung",
      "kw-stand-kopf",
      "klara-trust-head",
      "klara-s4",
    ]) {
      expect(kinder, `${alt} steht noch im Kopf`).not.toContain(alt);
    }
    expect(await l.eval<boolean>("() => !!document.getElementById('kw-kopf-zeile')")).toBe(false);
  });

  // ---- Mitte (Mockup Z.28-31) ------------------------------------------------------------------
  it("M1 · mitte flex-grow 1 · spalte · zentriert · gap 10px · polster 0 32px — an der realen Ruhe-Mitte", async () => {
    const stil = zielStil(ziel, Z_MITTE);
    expect(await l.messen(sel?.mitte, "flex-grow")).toBe(zielProp(stil, "flex-grow"));
    expect(await l.messen(sel?.mitte, "display")).toBe(zielProp(stil, "display"));
    expect(await l.messen(sel?.mitte, "flex-direction")).toBe(zielProp(stil, "flex-direction"));
    expect(await l.messen(sel?.mitte, "justify-content")).toBe(zielProp(stil, "justify-content"));
    expect(await l.messen(sel?.mitte, "align-items")).toBe(zielProp(stil, "align-items"));
    expect(await l.messen(sel?.mitte, "gap")).toBe(zielProp(stil, "gap"));
    expect(await l.messen(sel?.mitte, "padding")).toBe(kanonLaenge(zielProp(stil, "padding")));
    // Sie nimmt den Raum zwischen Kopf und Feld ein — Lupe und Satz stehen in der Fenstermitte.
    const m = await l.kanten(sel?.mitte);
    const s = await l.kanten(sel?.satz);
    expect(m.hoehe).toBeGreaterThan(300);
    expect(Math.abs((s.oben + s.unten) / 2 - (m.oben + m.unten) / 2)).toBeLessThan(40);
  });
  it("M2 · lupe 40px · stroke #C9C2B6 · 1.6 — das reale Lupen-SVG mit dem Pfad des Mockups", async () => {
    expect(ziel).toContain(LUPE_PFAD);
    expect(await l.attr(sel?.lupe, "width")).toBe(zielSvgAttr(ziel, LUPE_PFAD, "width"));
    expect(await l.attr(sel?.lupe, "height")).toBe(zielSvgAttr(ziel, LUPE_PFAD, "height"));
    expect(await l.messen(sel?.lupe, "stroke")).toBe(kanon(zielSvgAttr(ziel, LUPE_PFAD, "stroke")));
    expect(await l.attr(sel?.lupe, "stroke-width")).toBe(
      zielSvgAttr(ziel, LUPE_PFAD, "stroke-width"),
    );
    expect(await l.sichtbar(sel?.lupe)).toBe(true);
  });
  it("M3 · der EINE Satz 14px · #9AA2B1 · 1.5 · zentriert · Wortlaut des Mockups — am realen Satz", async () => {
    const stil = zielStil(ziel, Z_SATZ);
    expect(zielText(ziel, Z_SATZ)).toBe("Stell eine Frage oder markiere Text in Word.");
    expect(await l.text(sel?.satz)).toBe(zielText(ziel, Z_SATZ));
    expect(await l.messen(sel?.satz, "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await l.messen(sel?.satz, "color")).toBe(kanon(zielProp(stil, "color")));
    expect(await l.messen(sel?.satz, "text-align")).toBe(zielProp(stil, "text-align"));
    expect(await l.messen(sel?.satz, "line-height")).toBe(
      kanonZeilenhoehe(zielProp(stil, "line-height"), zielProp(stil, "font-size")),
    );
  });

  // ---- Frage-Feld (Mockup Z.33-39) -------------------------------------------------------------
  it("F1 · feld-rahmen 12px 16px 16px — unten, am realen Rahmen; die Karte spannt zwischen den 16px-Raendern", async () => {
    expect(await l.messen(sel?.feldRahmen, "padding")).toBe(
      kanonLaenge(zielProp(zielStil(ziel, Z_FELD_RAHMEN), "padding")),
    );
    const k = await l.kanten(sel?.karte);
    expect(Math.abs(k.links - 16)).toBeLessThan(1);
    expect(Math.abs(ARTBOARD.breite - 16 - k.rechts)).toBeLessThan(1);
    // Unten: die Karte schliesst 16px ueber dem Fensterrand ab.
    expect(Math.abs(ARTBOARD.hoehe - 16 - k.unten)).toBeLessThan(1);
  });
  it("F2 · karte #FFFFFF · rand 1px #E9E5DE · radius 12 · schatten · relativ — an der realen Karte", async () => {
    const stil = zielStil(ziel, Z_KARTE);
    const soll = rand(Z_KARTE);
    expect(await l.messen(sel?.karte, "background-color")).toBe(
      kanon(zielProp(stil, "background")),
    );
    expect(await l.messen(sel?.karte, "border-top-width")).toBe(soll?.breite);
    expect(await l.messen(sel?.karte, "border-top-style")).toBe(soll?.stil);
    expect(await l.messen(sel?.karte, "border-top-color")).toBe(soll?.farbe);
    expect(await l.messen(sel?.karte, "border-radius")).toBe(zielProp(stil, "border-radius"));
    expect(await l.messen(sel?.karte, "box-shadow")).toBe(
      kanonSchatten(zielProp(stil, "box-shadow")),
    );
    expect(await l.messen(sel?.karte, "position")).toBe(zielProp(stil, "position"));
  });
  it("F3 · feld 12px 52px 12px 14px · 15px · 1.45 · Platzhalter „Frage“ in #9AA2B1 — am realen Eingabefeld", async () => {
    const stil = zielStil(ziel, Z_FELD);
    expect(zielText(ziel, Z_FELD)).toBe("Frage");
    expect(await l.messen(sel?.feld, "padding")).toBe(kanonLaenge(zielProp(stil, "padding")));
    expect(await l.messen(sel?.feld, "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await l.messen(sel?.feld, "line-height")).toBe(
      kanonZeilenhoehe(zielProp(stil, "line-height"), zielProp(stil, "font-size")),
    );
    expect(await l.attr(sel?.feld, "placeholder")).toBe("Frage");
    const platzhalterFarbe = await l.eval<string | null>(
      "(sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el, '::placeholder').color : null; }",
      sel?.feld,
    );
    expect(platzhalterFarbe).toBe(kanon(zielProp(stil, "color")));
    expect(await l.eval<string>("(sel) => document.querySelector(sel).value", sel?.feld)).toBe("");
    // Kein Rahmen am Feld selbst: die Karte traegt ihn.
    expect(await l.messen(sel?.feld, "border-top-width")).toBe("0px");
  });
  it("F4 · sendeknopf 32px · rund · rechts 8 / oben 7 · grau #E9E5DE solange leer · zentriert — am realen Knopf", async () => {
    const stil = zielStil(ziel, Z_KNOPF);
    expect(await l.messen(sel?.knopf, "width")).toBe(zielProp(stil, "width"));
    expect(await l.messen(sel?.knopf, "height")).toBe(zielProp(stil, "height"));
    expect(await l.messen(sel?.knopf, "border-radius")).toBe(zielProp(stil, "border-radius"));
    expect(await l.messen(sel?.knopf, "position")).toBe(zielProp(stil, "position"));
    expect(await l.messen(sel?.knopf, "right")).toBe(zielProp(stil, "right"));
    expect(await l.messen(sel?.knopf, "top")).toBe(zielProp(stil, "top"));
    expect(await l.messen(sel?.knopf, "background-color")).toBe(
      kanon(zielProp(stil, "background")),
    );
    expect(await l.messen(sel?.knopf, "display")).toBe(zielProp(stil, "display"));
    expect(await l.messen(sel?.knopf, "align-items")).toBe(zielProp(stil, "align-items"));
    expect(await l.messen(sel?.knopf, "justify-content")).toBe(zielProp(stil, "justify-content"));
    expect(await l.messen(sel?.knopf, "box-shadow")).toBe("none");
    expect(await l.messen(sel?.knopf, "opacity")).toBe("1");
  });
  it("F5 · pfeil 16px · stroke #FFFFFF · 2.2 — das reale Pfeil-SVG mit dem Pfad des Mockups; der Kreisel ist verborgen", async () => {
    expect(ziel).toContain(PFEIL_PFAD);
    expect(await l.attr(sel?.pfeil, "width")).toBe(zielSvgAttr(ziel, PFEIL_PFAD, "width"));
    expect(await l.messen(sel?.pfeil, "stroke")).toBe(
      kanon(zielSvgAttr(ziel, PFEIL_PFAD, "stroke")),
    );
    expect(await l.attr(sel?.pfeil, "stroke-width")).toBe(
      zielSvgAttr(ziel, PFEIL_PFAD, "stroke-width"),
    );
    expect(await l.pfadD(sel?.pfeil)).toBe(PFEIL_PFAD);
    expect(await l.sichtbar("#ask-btn svg.kreisel")).toBe(false);
  });
  it("F6 · Verhalten: mit Text wird der Knopf Funke dunkel (#C2500A), leer wieder grau — am realen Knopf", async () => {
    expect(fehler).toBeNull();
    const s = l.seite();
    await s.fill("#ask-input", "Ventil");
    expect(await l.messen(sel?.knopf, "background-color")).toBe("rgb(194, 80, 10)");
    await s.fill("#ask-input", "");
    expect(await l.messen(sel?.knopf, "background-color")).toBe(
      kanon(zielProp(zielStil(ziel, Z_KNOPF), "background")),
    );
  });

  // ---- Was NICHT mehr im Sichtfeld steht (Lieferung 2 / Pruefpunkt 7) --------------------------
  it("W1 · keine Fusszeile, kein Regelsatz, kein Stand, kein Pruefhinweis, keine Sitzungskarte, keine Hilfe-Karte im Sichtfeld — GELOESCHT oder hinter dem Zahnrad", async () => {
    expect(fehler).toBeNull();
    for (const weg of [
      "kw-fuss",
      "kw-kopf-zeile",
      "session-card",
      "ask-ladekarte",
      "ask-review-notice",
      "antwortkarte-fuss",
      "klara-leitsatz",
      "ask-neue-frage-btn",
      "ask-luecke-fuss",
    ]) {
      expect(
        await l.eval<boolean>(`() => !!document.getElementById('${weg}')`),
        `${weg} existiert noch`,
      ).toBe(false);
    }
    // Was hinter das Zahnrad gezogen ist, steht in der Ruhe NICHT im Bild.
    for (const hinten of [
      "#ask-rule-note",
      "#kw-stand",
      "#klara-trust-head",
      "#lang-de",
      "#klara-s4-session",
      "#einst-konto-name",
      "[data-t=helpTitle]",
      "[data-t=greetBody]",
    ]) {
      expect(await l.sichtbar(hinten), `${hinten} ist in der Ruhe sichtbar`).toBe(false);
    }
    // Und die Sitzungsauskunft schweigt, solange die Anmeldung belegt ist.
    expect(await l.sichtbar("#session-block")).toBe(false);
  });
  it("W2 · Gesamtgeometrie 360×720: kein Ueberlauf, Kopf oben, Mitte dazwischen, Feld unten", async () => {
    expect(fehler).toBeNull();
    const masse = await l.eval<{ scrollBreite: number; scrollHoehe: number; b: number; h: number }>(
      "() => ({ scrollBreite: document.documentElement.scrollWidth, scrollHoehe: document.documentElement.scrollHeight, b: window.innerWidth, h: window.innerHeight })",
    );
    expect(masse.b).toBe(ARTBOARD.breite);
    expect(masse.h).toBe(ARTBOARD.hoehe);
    expect(masse.scrollBreite).toBeLessThanOrEqual(ARTBOARD.breite);
    expect(masse.scrollHoehe).toBeLessThanOrEqual(ARTBOARD.hoehe);
    const kopf = await l.kanten(sel?.kopf);
    const mitte = await l.kanten(sel?.mitte);
    const feld = await l.kanten(sel?.feldRahmen);
    expect(kopf.oben).toBe(0);
    expect(mitte.oben).toBeGreaterThanOrEqual(kopf.unten - 1);
    expect(feld.oben).toBeGreaterThanOrEqual(mitte.unten - 1);
    expect(Math.abs(feld.unten - ARTBOARD.hoehe)).toBeLessThan(1);
  });
});

describe.runIf(!existsSync(MOCKUP_RUHE))("JOB 3056 · Mockup-Abgleich Ruhe uebersprungen", () => {
  it("meldet das fehlende Mockup statt eine Pruefung vorzutaeuschen", () => {
    expect(existsSync(MOCKUP_RUHE), `Mockup nicht lesbar: ${MOCKUP_RUHE}`).toBe(false);
  });
});
