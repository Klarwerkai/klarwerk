// ================================================================================================
// BPA-05 · NACHARBEIT 5 — DIE BEGLEITLEISTE IST DECKEND, AUCH ÜBER DEM FORMULAR. IM ECHTEN BROWSER.
// ================================================================================================
//
// Bens Befund (Bildbeleg `AKTIV-HINWEIS.png`): die Leiste war DURCHSICHTIG; Formulartexte darunter
// lagen über Zweck, Hinweis und Knöpfen. Ursache: `bg-[var(--kw-surface,#fff)]` — die
// Themevariable ist ein RGB-Kanaltripel („255 255 255"), kein Farbwert; der Browser verwarf die
// Deklaration. jsdom rechnet weder Tailwind noch Farben — das kann nur ein Browser sagen.
//
// DIE BÜHNE: `tests/design/h6-chromium.ts` — die GEBAUTE App (`apps/web/dist`, frisch über
// `../review26-pruefen-schmal/bau`) mit echtem Server in Chromium, 390 × 700 px. Die Bühne meldet
// einen Admin an; das Prüfformular lässt aber nur experte/controller begleiten (G04). Deshalb wird
// NUR die Antwort von `/api/auth/me` auf die Rolle `experte` umgestellt — ein Rollenwechsel des
// Prüfkontos, keine Attrappe der Fläche: Seite, Leiste, CSS und Theme sind die ausgelieferten.
//
// GEMESSEN, nicht behauptet:
//   1. Die Leiste liegt tatsächlich ÜBER Formularfeldern (Rechtecke überschneiden sich).
//   2. Ihr berechneter Hintergrund ist deckend (Alpha 1) und gleich der Themefläche `--kw-surface`.
//   3. An der Mitte von Zweck, Hinweis und Knöpfen ist das oberste Element Teil der Leiste, und
//      die erste deckende Fläche unter dem Text gehört ebenfalls zur Leiste — nichts vom Formular
//      scheint durch.
//   4. Kontrast Hinweistext/Fläche ≥ 4,5:1 (G10, verständlich und lesbar).
//   GEGENPROBE: dieselbe alte Deklaration `var(--kw-surface,#fff)` ergibt in derselben Seite einen
//   durchsichtigen Hintergrund — die Messung hätte den Fehler gefunden.
//   BILDBELEG: `test-results/klara-begleitung/begleitleiste-ueber-formular.png`.
import { mkdirSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Seite, type Stand, beende, fn, starte, wechsle } from "../design/h6-chromium";
import baueFrisch from "../review26-pruefen-schmal/bau";

const ANGEBOT = '[data-testid="begleitung-angebot"]';
const LEISTE = '[data-testid="begleitung-status"]';
const HINWEIS = '[data-testid="begleitung-hinweis"]';
const BILD = "test-results/klara-begleitung/begleitleiste-ueber-formular.png";
let stand: Stand;

function seite(): Seite {
  expect(stand.fehler, "Chromium-Bühne kam nicht hoch").toBeNull();
  return stand.seite as Seite;
}

/** Ein kontrolliertes React-Feld wie ein Mensch füllen: nativer Setter, dann `input`. */
const FUELLEN = `([sel, wert]) => {
  const el = document.querySelector(sel);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(el, wert);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return el.value;
}`;

interface Messung {
  ueberdeckteFelder: number;
  hintergrund: string;
  alpha: number;
  themaFlaeche: string;
  stellen: { name: string; obenInLeiste: boolean; flaecheInLeiste: boolean }[];
  kontrast: number;
  gegenprobe: string;
}

const MESSEN = `() => {
  const leiste = document.querySelector('${LEISTE}');
  const r = leiste.getBoundingClientRect();
  const schneidet = (k) => k.right > r.left && k.left < r.right && k.bottom > r.top && k.top < r.bottom;
  const felder = [...document.querySelectorAll('[data-klara-begleitbereich] input, [data-klara-begleitbereich] label')];
  const ueberdeckteFelder = felder.filter((f) => schneidet(f.getBoundingClientRect())).length;

  const kanaele = (farbe) => {
    const m = /rgba?\\(([^)]+)\\)/.exec(farbe);
    if (!m) return null;
    const t = m[1].split(/[\\s,\\/]+/).filter(Boolean).map(Number);
    return { r: t[0], g: t[1], b: t[2], a: t.length > 3 ? t[3] : 1 };
  };
  const hintergrund = getComputedStyle(leiste).backgroundColor;
  const k = kanaele(hintergrund) ?? { r: 0, g: 0, b: 0, a: 0 };
  const probe = document.createElement("div");
  probe.style.backgroundColor = "rgb(" + getComputedStyle(document.documentElement).getPropertyValue("--kw-surface").trim() + ")";
  document.body.appendChild(probe);
  const themaFlaeche = getComputedStyle(probe).backgroundColor;
  probe.style.backgroundColor = "";
  probe.style.backgroundColor = "var(--kw-surface,#fff)";
  const gegenprobe = getComputedStyle(probe).backgroundColor;
  probe.remove();

  const ersteDeckendeFlaeche = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const f = kanaele(getComputedStyle(e).backgroundColor);
      if (f && f.a >= 1) return e;
    }
    return null;
  };
  const stelle = (name, el) => {
    if (!el) return { name, obenInLeiste: false, flaecheInLeiste: false };
    const b = el.getBoundingClientRect();
    const oben = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    const flaeche = oben ? ersteDeckendeFlaeche(oben) : null;
    return { name, obenInLeiste: Boolean(oben && leiste.contains(oben)), flaecheInLeiste: Boolean(flaeche && leiste.contains(flaeche)) };
  };
  const hinweisText = document.querySelector('${HINWEIS} p');
  const knoepfe = [...leiste.querySelectorAll("button")];
  const zweck = [...leiste.querySelectorAll("p")].find((p) => (p.textContent || "").startsWith("Zweck:"));
  const stellen = [
    stelle("zweck", zweck),
    stelle("hinweis", hinweisText),
    ...knoepfe.map((kn) => stelle("knopf:" + (kn.textContent || "").trim(), kn)),
  ];

  const lum = (c) => {
    const lin = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  };
  const schrift = kanaele(getComputedStyle(hinweisText).color) ?? { r: 255, g: 255, b: 255 };
  const [hell, dunkel] = [lum(k), lum(schrift)].sort((x, y) => y - x);
  const kontrast = (hell + 0.05) / (dunkel + 0.05);
  return { ueberdeckteFelder, hintergrund, alpha: k.a, themaFlaeche, stellen, kontrast, gegenprobe };
}`;

describe("BPA-05 · Begleitleiste über dem freigegebenen Formular (gebaute App, 390 px)", () => {
  let messung: Messung;

  beforeAll(async () => {
    await baueFrisch();
    stand = await starte("/start", "main", 390, 700);
    // Nur die Rolle des Prüfkontos: experte (das Prüfformular lässt Verwaltung nicht zu, G04).
    stand.antworten.vorAuslieferung = async (url, body) => {
      if (url.pathname !== "/api/auth/me") return body;
      const ich = JSON.parse(body) as Record<string, unknown>;
      return JSON.stringify({ ...ich, role: "experte" });
    };
    await wechsle(stand, "/begleitung/pruefformular", ANGEBOT);
    const page = seite();
    await page.evaluate(fn(FUELLEN), ['[data-testid="begleitung-auftrag"]', "Produktrecherche"]);
    await page.locator(`${ANGEBOT} button[type="submit"]`).click();
    await page.waitForFunction(fn("(s) => document.querySelector(s) !== null"), LEISTE, {
      timeout: 15_000,
    });
    // Den Hinweis auslösen und das Formular so scrollen, dass seine Felder UNTER der Leiste liegen.
    await page.evaluate(fn(FUELLEN), ["#pf-leistung", "250"]);
    await page.waitForFunction(fn("(s) => document.querySelector(s) !== null"), HINWEIS, {
      timeout: 15_000,
    });
    await page.evaluate(
      fn(
        `() => { document.getElementById("pf-anschluesse").scrollIntoView({ block: "end" }); return true; }`,
      ),
    );
    await page.waitForTimeout(200);
    messung = await page.evaluate<Messung>(fn(MESSEN));
    mkdirSync("test-results/klara-begleitung", { recursive: true });
    await page.screenshot({ path: BILD });
    console.log(`BPA-05 Nacharbeit 5 · Messung ${JSON.stringify(messung)} · Bild ${BILD}`);
  }, 300_000);

  afterAll(async () => {
    await beende(stand);
  }, 60_000);

  it("die Leiste liegt wirklich über Feldern des Formulars", () => {
    expect(messung.ueberdeckteFelder).toBeGreaterThan(0);
  });

  it("ihr Hintergrund ist deckend und gleich der Themefläche", () => {
    expect(messung.alpha).toBe(1);
    expect(messung.hintergrund).toBe(messung.themaFlaeche);
    expect(messung.hintergrund).not.toBe("rgba(0, 0, 0, 0)");
  });

  it("Zweck, Hinweis und Knöpfe liegen oben und auf der deckenden Fläche der Leiste", () => {
    expect(messung.stellen.length).toBeGreaterThanOrEqual(4);
    for (const s of messung.stellen) {
      expect(s.obenInLeiste, `${s.name}: oberstes Element gehört nicht zur Leiste`).toBe(true);
      expect(s.flaecheInLeiste, `${s.name}: keine deckende Fläche der Leiste darunter`).toBe(true);
    }
  });

  it("der Hinweistext ist lesbar: Kontrast mindestens 4,5:1", () => {
    expect(messung.kontrast).toBeGreaterThanOrEqual(4.5);
  });

  it("Gegenprobe: die alte Deklaration wäre durchsichtig gewesen", () => {
    expect(messung.gegenprobe).toBe("rgba(0, 0, 0, 0)");
  });
});
