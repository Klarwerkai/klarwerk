// ================================================================================================
// JOB 3056 · K1 — EINSTELLUNGEN NACH PEDIS MOCKUP `design/klara/Einstellungen.dc.html`, IN CHROMIUM.
// ================================================================================================
//
// Erreichbar ueber das Zahnrad; Kopf mit Zurueck-Chevron und „Einstellungen". Gruppe 1: Sprache
// (die bisherige Sprachwahl lebt hier weiter) und „Text in Word mitlesen" (Schalter). Gruppe „VOM
// ADMIN EINGESTELLT": KI, Wissen, Server — je mit Schloss. Gruppe Konto: Name aus checkSession und
// „Abmelden". Unten „Klara <Stand>". Gemessen an der echten Auslieferung in Chromium, angemeldet.
//
// Zustandsmodell (§9): jeder Admin-Wert erst nach frischem Abruf, bis dahin „–" — die KI-Zeile
// zeigt hier „–", weil der Test-Server keine Klara-Sitzung eroeffnet (kein Word-Dokumentkontext);
// nie ein positiver Wert aus dem Cache.
import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ARTBOARD,
  type Flaeche,
  MOCKUP_EINSTELLUNGEN,
  NUTZER,
  aufloesen,
  kanon,
  kanonLaenge,
  kanonRand,
  leser,
  mockup,
  starteFlaeche,
  zielProp,
  zielStil,
  zielSvgAttr,
  zielText,
} from "./k1-messung";

const ziel = mockup(MOCKUP_EINSTELLUNGEN);

// ---- Anker im Mockup (Einstellungen.dc.html) ---------------------------------------------------
const Z_KOPF = "padding: 14px 16px 10px; display: flex; align-items: center; gap: 8px";
const Z_TITEL = "font-size: 15px; font-weight: 650";
const Z_GRUPPE1 = "margin: 10px 16px 0; background: #FFFFFF";
const Z_ZEILE = "padding: 13px 14px; border-bottom: 1px solid #E9E5DE";
const Z_LABEL_SPRACHE = 'style="font-size: 14px;">Sprache';
const Z_WERT = "font-size: 14px; color: #525B6B";
const Z_SCHALTER = "width: 40px; height: 24px; border-radius: 12px; background: #116B3C";
const Z_KNOPF = "width: 20px; height: 20px; border-radius: 50%; background: #FFFFFF";
const Z_KICKER = "margin: 20px 16px 6px; font-size: 11px; letter-spacing: 0.4px";
const Z_ADMIN = "margin: 0 16px; background: #FFFFFF";
const Z_KONTO = "margin: 20px 16px 0; background: #FFFFFF";
const Z_ABMELDEN = "font-size: 14px; color: #C2500A";
const Z_FUSS = "margin-top: auto; padding: 12px 16px 16px; text-align: center; font-size: 11px";
const CHEVRON_ZURUECK = "M15 18l-6-6 6-6";
const CHEVRON_RECHTS = "M9 6l6 6-6 6";
const SCHLOSS_PFAD = "M8 10V7a4 4 0 0 1 8 0v3";

const SELEKTOREN = {
  kopf: "#kw-kopf",
  kopfLinks: "#kw-kopf-links",
  chevron: "#kw-zurueck svg",
  titel: "#kw-titel",
  gruppe1: "#kw-einstellungen > .einst-gruppe:first-child",
  spracheZeile: "#einst-sprache-zeile",
  spracheWert: "#einst-sprache-wert",
  spracheChevron: "#einst-sprache-zeile .einst-wert svg",
  mitlesenZeile: "#einst-mitlesen",
  mitlesenKnopf: "#einst-mitlesen .knopf",
  kicker: "#kw-einstellungen > .einst-kicker",
  admin: "#kw-einstellungen > .einst-gruppe.admin",
  kiZeile: "#kw-einstellungen > .einst-gruppe.admin > .einst-zeile:nth-child(1)",
  kiWert: "#klara-s4-mode",
  kiSchloss: "#kw-einstellungen > .einst-gruppe.admin > .einst-zeile:nth-child(1) svg",
  wissenWert: "[data-t=einstWissenWert]",
  serverWert: "#einst-server-wert",
  konto: "#kw-einstellungen > .einst-gruppe.konto",
  kontoName: "#einst-konto-name",
  abmelden: "#logout-btn",
  fuss: "#kw-stand-zeile",
  stand: "#kw-stand",
};
type Sel = Record<keyof typeof SELEKTOREN, string | null> & { aufgeloest: boolean };

let flaeche: Flaeche | null = null;
let fehler: string | null = null;
let sel: Sel | null = null;

describe("JOB 3056 · K1 · Einstellungen — die echte taskpane.html aus dist, in Chromium, hinter dem Zahnrad", () => {
  beforeAll(async () => {
    try {
      flaeche = await starteFlaeche({ mitWissen: false });
      await flaeche.seite.click("#kw-zahnrad");
      sel = (await aufloesen(flaeche.seite, SELEKTOREN)) as Sel;
      console.info(
        `JOB 3056 K1 Einstellungen · Chromium ${flaeche.version} · Selektoren ${JSON.stringify(sel)}`,
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

  it("S · die Einstellungen stehen nach dem Klick auf das Zahnrad: JEDES Element gefunden, kein Seitenfehler; Fragen-Flaeche verborgen", async () => {
    expect(fehler).toBeNull();
    expect(sel).not.toBeNull();
    const fehlend = Object.entries(sel as Sel)
      .filter(([k, v]) => k !== "aufgeloest" && v === null)
      .map(([k]) => k);
    expect(fehlend, "Elemente des Mockups fehlen in der geladenen Seite").toEqual([]);
    expect((sel as Sel).aufgeloest).toBe(true);
    expect(flaeche?.seitenfehler).toEqual([]);
    expect(await l.sichtbar("#section-ask")).toBe(false);
    expect(await l.sichtbar("#kw-einstellungen")).toBe(true);
  });

  // ---- Kopf (Mockup Z.17-20) -------------------------------------------------------------------
  it("K1 · kopf 14px 16px 10px · chevron (Pfad des Mockups, 18px, #525B6B) + „Einstellungen“ 15px/650 · gap 8 · kein Umschalter, kein Zahnrad", async () => {
    expect(await l.messen(sel?.kopf, "padding")).toBe(
      kanonLaenge(zielProp(zielStil(ziel, Z_KOPF), "padding")),
    );
    expect(await l.messen(sel?.kopfLinks, "gap")).toBe("8px");
    expect(ziel).toContain(CHEVRON_ZURUECK);
    expect(await l.pfadD(sel?.chevron)).toBe(CHEVRON_ZURUECK);
    expect(await l.attr(sel?.chevron, "width")).toBe(zielSvgAttr(ziel, CHEVRON_ZURUECK, "width"));
    expect(await l.messen(sel?.chevron, "stroke")).toBe(
      kanon(zielSvgAttr(ziel, CHEVRON_ZURUECK, "stroke")),
    );
    expect(zielText(ziel, Z_TITEL)).toBe("Einstellungen");
    expect(await l.text(sel?.titel)).toBe("Einstellungen");
    expect(await l.messen(sel?.titel, "font-size")).toBe(
      zielProp(zielStil(ziel, Z_TITEL), "font-size"),
    );
    expect(await l.messen(sel?.titel, "font-weight")).toBe(
      zielProp(zielStil(ziel, Z_TITEL), "font-weight"),
    );
    expect(await l.sichtbar("#kw-segment")).toBe(false);
    expect(await l.sichtbar("#kw-zahnrad")).toBe(false);
  });

  // ---- Gruppe 1 (Mockup Z.22-34) ---------------------------------------------------------------
  it("G1 · gruppe 10px 16px 0 · #FFFFFF · rand 1px #E9E5DE · radius 12 · spalte — an der realen Gruppe", async () => {
    const stil = zielStil(ziel, Z_GRUPPE1);
    const soll = rand(Z_GRUPPE1);
    expect(await l.messen(sel?.gruppe1, "margin")).toBe(kanonLaenge(zielProp(stil, "margin")));
    expect(await l.messen(sel?.gruppe1, "background-color")).toBe(
      kanon(zielProp(stil, "background")),
    );
    expect(await l.messen(sel?.gruppe1, "border-top-width")).toBe(soll?.breite);
    expect(await l.messen(sel?.gruppe1, "border-top-color")).toBe(soll?.farbe);
    expect(await l.messen(sel?.gruppe1, "border-radius")).toBe(zielProp(stil, "border-radius"));
    expect(await l.messen(sel?.gruppe1, "display")).toBe(zielProp(stil, "display"));
    expect(await l.messen(sel?.gruppe1, "flex-direction")).toBe(zielProp(stil, "flex-direction"));
    kantenGegenRand(await l.kanten(sel?.gruppe1), "Gruppe 1");
  });
  it("G2 · zeile „Sprache“ 13px 14px · space-between · trennlinie · label 14px · wert „Deutsch“ 14px #525B6B · chevron 14px #9AA2B1", async () => {
    const stil = zielStil(ziel, Z_ZEILE);
    const soll = rand(Z_ZEILE, "border-bottom");
    expect(await l.messen(sel?.spracheZeile, "padding")).toBe(
      kanonLaenge(zielProp(stil, "padding")),
    );
    expect(await l.messen(sel?.spracheZeile, "display")).toBe(zielProp(stil, "display"));
    expect(await l.messen(sel?.spracheZeile, "justify-content")).toBe(
      zielProp(stil, "justify-content"),
    );
    expect(await l.messen(sel?.spracheZeile, "align-items")).toBe(zielProp(stil, "align-items"));
    expect(await l.messen(sel?.spracheZeile, "border-bottom-width")).toBe(soll?.breite);
    expect(await l.messen(sel?.spracheZeile, "border-bottom-color")).toBe(soll?.farbe);
    expect(ziel).toContain(Z_LABEL_SPRACHE);
    expect(await l.text("#einst-sprache-zeile > span:first-child")).toBe("Sprache");
    expect(await l.messen(sel?.spracheZeile, "font-size")).toBe("14px");
    expect(await l.text(sel?.spracheWert)).toBe(zielText(ziel, Z_WERT));
    expect(await l.messen(sel?.spracheWert, "font-size")).toBe(
      zielProp(zielStil(ziel, Z_WERT), "font-size"),
    );
    expect(await l.messen(sel?.spracheWert, "color")).toBe(
      kanon(zielProp(zielStil(ziel, Z_WERT), "color")),
    );
    expect(await l.pfadD(sel?.spracheChevron)).toBe(CHEVRON_RECHTS);
    expect(await l.attr(sel?.spracheChevron, "width")).toBe(
      zielSvgAttr(ziel, CHEVRON_RECHTS, "width"),
    );
    expect(await l.messen(sel?.spracheChevron, "stroke")).toBe(
      kanon(zielSvgAttr(ziel, CHEVRON_RECHTS, "stroke")),
    );
  });
  it("G3 · schalter „Text in Word mitlesen“ 40×24 · radius 12 · #116B3C · knopf 20 · #FFFFFF · oben 2 / rechts 2 — an", async () => {
    const stil = zielStil(ziel, Z_SCHALTER);
    expect((await l.text("#einst-mitlesen")) ?? "").toBe("");
    expect(
      await l.text(
        "#kw-einstellungen .einst-gruppe:first-child > .einst-zeile:nth-child(3) > span",
      ),
    ).toBe("Text in Word mitlesen");
    expect(await l.messen(sel?.mitlesenZeile, "width")).toBe(zielProp(stil, "width"));
    expect(await l.messen(sel?.mitlesenZeile, "height")).toBe(zielProp(stil, "height"));
    expect(await l.messen(sel?.mitlesenZeile, "border-radius")).toBe(
      zielProp(stil, "border-radius"),
    );
    expect(await l.messen(sel?.mitlesenZeile, "background-color")).toBe(
      kanon(zielProp(stil, "background")),
    );
    expect(await l.messen(sel?.mitlesenZeile, "position")).toBe(zielProp(stil, "position"));
    const knopf = zielStil(ziel, Z_KNOPF);
    expect(await l.messen(sel?.mitlesenKnopf, "width")).toBe(zielProp(knopf, "width"));
    expect(await l.messen(sel?.mitlesenKnopf, "height")).toBe(zielProp(knopf, "height"));
    expect(await l.messen(sel?.mitlesenKnopf, "border-radius")).toBe(
      zielProp(knopf, "border-radius"),
    );
    expect(await l.messen(sel?.mitlesenKnopf, "background-color")).toBe(
      kanon(zielProp(knopf, "background")),
    );
    expect(await l.messen(sel?.mitlesenKnopf, "top")).toBe(zielProp(knopf, "top"));
    expect(await l.messen(sel?.mitlesenKnopf, "right")).toBe(zielProp(knopf, "right"));
    expect(await l.attr(sel?.mitlesenZeile, "aria-checked")).toBe("true");
    expect(await l.attr(sel?.mitlesenZeile, "role")).toBe("switch");
  });

  // ---- Vom Admin eingestellt (Mockup Z.36-59) --------------------------------------------------
  it("A1 · kicker „VOM ADMIN EINGESTELLT“ 20px 16px 6px · 11px · 0.4px · #525B6B — am realen Kicker", async () => {
    const stil = zielStil(ziel, Z_KICKER);
    expect(zielText(ziel, Z_KICKER)).toBe("VOM ADMIN EINGESTELLT");
    expect(await l.text(sel?.kicker)).toBe("VOM ADMIN EINGESTELLT");
    expect(await l.messen(sel?.kicker, "margin")).toBe(kanonLaenge(zielProp(stil, "margin")));
    expect(await l.messen(sel?.kicker, "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await l.messen(sel?.kicker, "letter-spacing")).toBe(zielProp(stil, "letter-spacing"));
    expect(await l.messen(sel?.kicker, "color")).toBe(kanon(zielProp(stil, "color")));
  });
  it("A2 · admin-gruppe 0 16px · #FFFFFF · radius 12 · drei Zeilen KI / Wissen / Server, je mit Schloss 13px #9AA2B1", async () => {
    const stil = zielStil(ziel, Z_ADMIN);
    expect(await l.messen(sel?.admin, "margin")).toBe(kanonLaenge(zielProp(stil, "margin")));
    expect(await l.messen(sel?.admin, "background-color")).toBe(
      kanon(zielProp(stil, "background")),
    );
    expect(await l.messen(sel?.admin, "border-radius")).toBe(zielProp(stil, "border-radius"));
    kantenGegenRand(await l.kanten(sel?.admin), "Admin-Gruppe");
    const labels = await l.eval<string[]>(
      "(sel) => [...document.querySelector(sel).querySelectorAll('.einst-zeile > span:first-child')].map((s) => s.textContent.trim())",
      sel?.admin,
    );
    expect(labels).toEqual(["KI", "Wissen", "Server"]);
    expect(ziel).toContain(SCHLOSS_PFAD);
    const schloesser = await l.eval<number>(
      `(sel) => [...document.querySelector(sel).querySelectorAll('.einst-wert svg')].filter((s) => (s.querySelector('path') || {}).getAttribute && s.querySelector('path').getAttribute('d') === ${JSON.stringify(SCHLOSS_PFAD)}).length`,
      sel?.admin,
    );
    expect(schloesser).toBe(3);
    expect(await l.attr(sel?.kiSchloss, "width")).toBe(zielSvgAttr(ziel, SCHLOSS_PFAD, "width"));
    expect(await l.messen(sel?.kiSchloss, "stroke")).toBe(
      kanon(zielSvgAttr(ziel, SCHLOSS_PFAD, "stroke")),
    );
    // Die letzte Zeile ohne Trennlinie (Mockup Z.52), die erste mit.
    expect(await l.messen(sel?.kiZeile, "border-bottom-width")).toBe("1px");
    expect(
      await l.messen(
        "#kw-einstellungen > .einst-gruppe.admin > .einst-zeile:nth-child(3)",
        "border-bottom-width",
      ),
    ).toBe("0px");
  });
  it("A3 · werte: KI = der fuer diese Sitzung aufgeloeste Modus („Ohne Modell“: die Test-App laeuft deterministisch) · Wissen „Nur freigegeben“ · Server = Host der App — 14px #525B6B", async () => {
    // §9: „–", solange nichts Frisches gelesen ist — hier hat die echte App die Sitzung eroeffnet
    // und die Aufloesung geliefert (GET /api/klara/ai-status): der Wert ist der WOERTLICHE Modus.
    expect(await l.text(sel?.kiWert)).toBe("Ohne Modell");
    expect(await l.text(sel?.wissenWert)).toBe(
      zielText(ziel, 'style="font-size: 14px; color: #525B6B;">Nur freigegeben'),
    );
    expect(await l.text(sel?.serverWert)).toBe("klarwerk.test");
    for (const w of [sel?.kiWert, sel?.wissenWert, sel?.serverWert]) {
      expect(await l.messen(w, "font-size")).toBe("14px");
      expect(await l.messen(w, "color")).toBe(kanon("#525B6B"));
    }
  });

  // ---- Konto (Mockup Z.61-66) und Fuss (Z.68) --------------------------------------------------
  it("KO1 · konto-gruppe 20px 16px 0 · name aus checkSession · „Abmelden“ 14px #C2500A", async () => {
    const stil = zielStil(ziel, Z_KONTO);
    expect(await l.messen(sel?.konto, "margin")).toBe(kanonLaenge(zielProp(stil, "margin")));
    expect(await l.messen(sel?.konto, "background-color")).toBe(
      kanon(zielProp(stil, "background")),
    );
    expect(await l.messen(sel?.konto, "border-radius")).toBe(zielProp(stil, "border-radius"));
    expect(await l.text(sel?.kontoName)).toBe(NUTZER.name);
    expect(await l.messen(sel?.kontoName, "font-size")).toBe("14px");
    expect(zielText(ziel, Z_ABMELDEN)).toBe("Abmelden");
    expect(await l.text(sel?.abmelden)).toBe("Abmelden");
    expect(await l.messen(sel?.abmelden, "font-size")).toBe(
      zielProp(zielStil(ziel, Z_ABMELDEN), "font-size"),
    );
    expect(await l.messen(sel?.abmelden, "color")).toBe(
      kanon(zielProp(zielStil(ziel, Z_ABMELDEN), "color")),
    );
    expect(await l.sichtbar(sel?.abmelden)).toBe(true);
  });
  it("F1 · fuss „Klara <Stand>“ margin-top auto · 12px 16px 16px · zentriert · 11px · #9AA2B1 — unten", async () => {
    const stil = zielStil(ziel, Z_FUSS);
    expect(zielText(ziel, Z_FUSS)?.startsWith("Klara ")).toBe(true);
    expect((await l.text(sel?.fuss))?.startsWith("Klara ")).toBe(true);
    expect((await l.text(sel?.stand))?.length).toBeGreaterThan(0);
    // `margin-top: auto` loest Chromium fuer ein Flex-Kind zu Pixeln auf (0px, sobald die Gruppen
    // das Fenster fuellen) — gemessen wird die Wirkung: der Fuss ist das letzte Kind, unter Konto.
    expect(zielProp(stil, "margin-top")).toBe("auto");
    expect(await l.messen(sel?.fuss, "padding")).toBe(kanonLaenge(zielProp(stil, "padding")));
    expect(await l.messen(sel?.fuss, "text-align")).toBe(zielProp(stil, "text-align"));
    expect(await l.messen(sel?.fuss, "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await l.messen(sel?.fuss, "color")).toBe(kanon(zielProp(stil, "color")));
    const f = await l.kanten(sel?.fuss);
    const k = await l.kanten(sel?.konto);
    expect(f.oben).toBeGreaterThanOrEqual(k.unten);
  });

  // ---- Verhalten: Sprache, Hilfe, Zurueck ------------------------------------------------------
  it("V1 · Sprache: die Zeile klappt die drei Wahlen auf; „English“ schaltet die Flaeche um (Titel „Settings“), „Deutsch“ zurueck", async () => {
    expect(fehler).toBeNull();
    const s = l.seite();
    expect(await l.sichtbar("#lang-en")).toBe(false);
    await s.click("#einst-sprache-zeile");
    expect(await l.sichtbar("#lang-en")).toBe(true);
    await s.click("#lang-en");
    expect(await l.text("#kw-titel")).toBe("Settings");
    expect(await l.text("#einst-sprache-wert")).toBe("English");
    expect(await l.text("#kw-einstellungen > .einst-kicker")).toBe("SET BY ADMIN");
    expect(await l.eval<string>("() => document.documentElement.lang")).toBe("en");
    await s.click("#lang-de");
    expect(await l.text("#kw-titel")).toBe("Einstellungen");
    expect(await l.eval<string>("() => document.documentElement.lang")).toBe("de");
  });
  it("V2 · „Wie Klara antwortet“: Regel, Pruefhinweis, KI-Stand von KLARWERK und Hilfe stehen dort — und nur dort", async () => {
    expect(fehler).toBeNull();
    const s = l.seite();
    await s.click("#einst-hilfe-zeile");
    expect(await l.sichtbar("#kw-hilfe")).toBe(true);
    expect(await l.text("#kw-titel")).toBe("Wie Klara antwortet");
    expect(await l.sichtbar("#ask-rule-note")).toBe(true);
    expect(await l.text("#ask-rule-note")).toContain("Keine KI-Antwort ohne Beleg");
    expect(await l.sichtbar("[data-t=askReviewNotice]")).toBe(true);
    expect(await l.sichtbar("#klara-trust-head")).toBe(true);
    expect((await l.text("#klara-trust-mode"))?.length).toBeGreaterThan(0);
    expect(await l.sichtbar("[data-t=helpTitle]")).toBe(true);
    await s.click("#kw-zurueck");
    expect(await l.sichtbar("#kw-einstellungen")).toBe(true);
    expect(await l.sichtbar("#kw-hilfe")).toBe(false);
  });
  it("V3 · der Zurueck-Chevron fuehrt auf den Fragen-Bereich zurueck: Ruhe sichtbar, Einstellungen verborgen, kein Seitenfehler", async () => {
    expect(fehler).toBeNull();
    await l.seite().click("#kw-zurueck");
    expect(await l.sichtbar("#kw-einstellungen")).toBe(false);
    expect(await l.sichtbar("#section-ask")).toBe(true);
    expect(await l.sichtbar("#ask-ruhe")).toBe(true);
    expect(await l.text("#kw-titel")).toBe("Klara");
    expect(flaeche?.seitenfehler).toEqual([]);
  });
});

describe.runIf(!existsSync(MOCKUP_EINSTELLUNGEN))(
  "JOB 3056 · Mockup-Abgleich Einstellungen uebersprungen",
  () => {
    it("meldet das fehlende Mockup statt eine Pruefung vorzutaeuschen", () => {
      expect(existsSync(MOCKUP_EINSTELLUNGEN), `Mockup nicht lesbar: ${MOCKUP_EINSTELLUNGEN}`).toBe(
        false,
      );
    });
  },
);
