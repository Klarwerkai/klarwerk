// Die startbereite Word-Assistenz im gebauten Panel bei 360 × 720. Die ältere
// Gestaltungsquelle liefert die gemeinsamen Feld-, Farb- und Symbolwerte. Die aktiven
// Bedienelemente stehen im sichtbaren UI-MIN-Kopf und im zugehörigen Menü.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ARTBOARD,
  type Flaeche,
  MOCKUP_RUHE,
  aufloesen,
  kanon,
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
const Z_MITTE = "justify-content: center; align-items: center; gap: 10px; padding: 0 32px";
const Z_KARTE = "border-radius: 12px; box-shadow";
const Z_FELD = "padding: 12px 52px 12px 14px";
const Z_KNOPF = "width: 32px; height: 32px; border-radius: 50%";
const LUPE_PFAD = "M21 21l-4.3-4.3";
const PFEIL_PFAD = "M12 19V5";

const SELEKTOREN = {
  kopf: ".mini-head",
  titel: ".mini-name",
  avatar: ".mini-avatar",
  leeren: '.mini-head [data-mini-text="clear"]',
  menue: ".mini-menu-button",
  einstellungen: "#mini-menu-settings",
  funktionen: "#mini-menu-functions",
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
  it("K1 · der feste sichtbare Kopf füllt die gesamte Breite", async () => {
    expect(await l.sichtbar(sel?.kopf)).toBe(true);
    expect(await l.messen(sel?.kopf, "padding")).toBe("10px 12px 6px");
    expect(await l.messen(sel?.kopf, "display")).toBe("flex");
    expect(await l.messen(sel?.kopf, "align-items")).toBe("center");
    expect(await l.messen(sel?.kopf, "gap")).toBe("8px");
    const k = await l.kanten(sel?.kopf);
    expect(k.links).toBe(0);
    expect(k.breite).toBe(ARTBOARD.breite);
  });
  it("K2 · die persönliche Assistenz hat einen sichtbaren Namen und ein dekoratives Bild", async () => {
    expect(await l.sichtbar(sel?.titel)).toBe(true);
    expect(await l.text(sel?.titel)).toBe("Deine Assistenz");
    expect(await l.messen(sel?.titel, "font-size")).toBe("14px");
    expect(await l.sichtbar(sel?.avatar)).toBe(true);
    expect(await l.attr(sel?.avatar, "alt")).toBe("");
    expect(await l.attr(sel?.avatar, "src")).toBe("/klara/klara-avatar-v1.png");
    expect(await l.sichtbar(".mini-back")).toBe(false);
  });
  it("K3 · Leeren und Menü bleiben nebeneinander am rechten Innenrand", async () => {
    const clear = await l.kanten(sel?.leeren);
    const menu = await l.kanten(sel?.menue);
    expect(await l.text(sel?.leeren)).toBe("Leeren");
    expect(Math.abs(menu.links - clear.rechts - 8)).toBeLessThan(1);
    expect(Math.abs(ARTBOARD.breite - menu.rechts - 12)).toBeLessThan(1);
    expect(Math.abs(menu.oben - clear.oben)).toBeLessThan(1);
  });
  it("K4 · das zugängliche Menü öffnet und schließt die zugehörige Navigation", async () => {
    const s = l.seite();
    expect(await l.attr(sel?.menue, "aria-label")).toBe("Menü");
    expect(await l.attr(sel?.menue, "aria-controls")).toBe("mini-menu");
    expect(await l.attr(sel?.menue, "aria-expanded")).toBe("false");
    await s.click(".mini-menu-button");
    expect(await l.attr(sel?.menue, "aria-expanded")).toBe("true");
    expect(await l.sichtbar("#mini-menu")).toBe(true);
    await s.click(".mini-menu-button");
    expect(await l.sichtbar("#mini-menu")).toBe(false);
  });
  it("K5 · Geschichte und Funktionen sind über das Menü beschriftet erreichbar", async () => {
    const s = l.seite();
    await s.click(".mini-menu-button");
    expect(await l.text("#mini-menu-history")).toBe("Verlauf");
    expect(await l.sichtbar(sel?.funktionen)).toBe(true);
    expect(await l.text(sel?.funktionen)).toBe("Meine Funktionen");
    await s.click("#mini-menu-functions");
    expect(await l.sichtbar("#mini-page-functions")).toBe(true);
    expect(await l.sichtbar(".mini-back")).toBe(true);
    await s.click(".mini-back");
    expect(await l.sichtbar("#ask-input")).toBe(true);
  });
  it("K6 · Daten und Einstellungen öffnen sich über die sichtbare Navigation", async () => {
    const s = l.seite();
    expect(await l.sichtbar(sel?.einstellungen)).toBe(false);
    await s.click(".mini-menu-button");
    expect(await l.text(sel?.einstellungen)).toBe("Einstellungen");
    await s.click("#mini-menu-settings");
    expect(await l.sichtbar("#kw-einstellungen")).toBe(true);
    expect(await l.sichtbar(sel?.leeren)).toBe(false);
    await s.click(".mini-back");
    expect(await l.sichtbar(sel?.leeren)).toBe(true);
  });
  it("K7 · das Menüziel ist mindestens 32px hoch und klar vom Leeren getrennt", async () => {
    const k = await l.kanten(sel?.menue);
    expect(k.breite).toBe(34);
    expect(k.hoehe).toBeGreaterThanOrEqual(32);
    expect(await l.text(sel?.menue)).toBe("⋯");
    expect(await l.messen(sel?.menue, "padding")).toBe("0px");
    expect(await l.messen(sel?.menue, "font-size")).toBe("23px");
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
  it("M1 · mitte flex-grow 1 · spalte · zentriert · gap 10px · Polster 24px 8px — an der realen Ruhe-Mitte", async () => {
    const stil = zielStil(ziel, Z_MITTE);
    expect(await l.messen(sel?.mitte, "flex-grow")).toBe(zielProp(stil, "flex-grow"));
    expect(await l.messen(sel?.mitte, "display")).toBe(zielProp(stil, "display"));
    expect(await l.messen(sel?.mitte, "flex-direction")).toBe(zielProp(stil, "flex-direction"));
    expect(await l.messen(sel?.mitte, "justify-content")).toBe(zielProp(stil, "justify-content"));
    expect(await l.messen(sel?.mitte, "align-items")).toBe(zielProp(stil, "align-items"));
    expect(await l.messen(sel?.mitte, "gap")).toBe(zielProp(stil, "gap"));
    expect(await l.messen(sel?.mitte, "padding")).toBe("24px 8px");
    // Sie nimmt den Raum zwischen Kopf und Feld ein — Lupe und Satz stehen in der Fenstermitte.
    const m = await l.kanten(sel?.mitte);
    const s = await l.kanten(sel?.satz);
    expect(m.hoehe).toBeGreaterThan(300);
    expect(Math.abs((s.oben + s.unten) / 2 - (m.oben + m.unten) / 2)).toBeLessThan(40);
  });
  it("M2 · die vorhandene Suchgrafik bleibt in der Ruhe verborgen, die Lupe misst 40px · stroke #C9C2B6 · 1.6 — das reale Lupen-SVG mit dem Pfad des Mockups", async () => {
    expect(ziel).toContain(LUPE_PFAD);
    expect(await l.attr(sel?.lupe, "width")).toBe(zielSvgAttr(ziel, LUPE_PFAD, "width"));
    expect(await l.attr(sel?.lupe, "height")).toBe(zielSvgAttr(ziel, LUPE_PFAD, "height"));
    expect(await l.messen(sel?.lupe, "stroke")).toBe(kanon(zielSvgAttr(ziel, LUPE_PFAD, "stroke")));
    expect(await l.attr(sel?.lupe, "stroke-width")).toBe(
      zielSvgAttr(ziel, LUPE_PFAD, "stroke-width"),
    );
    expect(await l.sichtbar(sel?.lupe)).toBe(false);
  });
  it("M3 · die Ruhe zeigt genau eine lesbare Frage ohne dekorative Lupe", async () => {
    expect(await l.sichtbar(sel?.satz)).toBe(true);
    expect(await l.text(sel?.satz)).toBe("Wie kann ich helfen?");
    expect(
      await l.eval<string>("sel => document.querySelector(sel).innerText.trim()", sel?.mitte),
    ).toBe("Wie kann ich helfen?");
    expect(await l.messen(sel?.satz, "font-size")).toBe("15px");
    expect(await l.messen(sel?.satz, "color")).toBe(kanon("#525B6B"));
    expect(await l.messen(sel?.satz, "text-align")).toBe("left");
    expect(await l.messen(sel?.satz, "line-height")).toBe("22.5px");
  });

  // ---- Frage-Feld (Mockup Z.33-39) -------------------------------------------------------------
  it("F1 · Feldrahmen 9px 12px 12px — unten, mit 12px Abstand zu drei Fensterkanten", async () => {
    expect(await l.messen(sel?.feldRahmen, "padding")).toBe("9px 12px 12px");
    const k = await l.kanten(sel?.karte);
    expect(Math.abs(k.links - 12)).toBeLessThan(1);
    expect(Math.abs(ARTBOARD.breite - 12 - k.rechts)).toBeLessThan(1);
    // Unten: die Karte schliesst 12px über dem Fensterrand ab.
    expect(Math.abs(ARTBOARD.hoehe - 12 - k.unten)).toBeLessThan(1);
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
  it("F3 · Feld 5px 3px · 15px · 1.45 · Platzhalter „Frage“ in #9AA2B1 — am realen Eingabefeld", async () => {
    const stil = zielStil(ziel, Z_FELD);
    expect(zielText(ziel, Z_FELD)).toBe("Frage");
    expect(await l.messen(sel?.feld, "padding")).toBe("5px 3px");
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
  it("F4 · sendeknopf 32px · rund · neben dem Eingabefeld im Flexlayout · grau #E9E5DE solange leer · zentriert — am realen Knopf", async () => {
    const stil = zielStil(ziel, Z_KNOPF);
    expect(await l.messen(sel?.knopf, "width")).toBe(zielProp(stil, "width"));
    expect(await l.messen(sel?.knopf, "height")).toBe(zielProp(stil, "height"));
    expect(await l.messen(sel?.knopf, "border-radius")).toBe(zielProp(stil, "border-radius"));
    expect(await l.messen(sel?.knopf, "position")).toBe("static");
    const knopf = await l.kanten(sel?.knopf);
    const feld = await l.kanten(sel?.feld);
    expect(Math.abs(knopf.links - feld.rechts - 7)).toBeLessThan(1);
    expect(Math.abs(knopf.unten - feld.unten)).toBeLessThan(1);
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

it("die versionierte Gestaltungsquelle enthält Fragefeld und Sendepfeil", () => {
  expect(zielText(ziel, Z_FELD)).toBe("Frage");
  expect(zielSvgAttr(ziel, PFEIL_PFAD, "stroke-width")).toBe("2.2");
});
