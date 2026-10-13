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
//
// NACHARBEIT 9 (Ben G10, Bildbeleg bildbeleg-000.png): die Assistenzfigur samt Namensschild lag
// über Hinweis und Tastaturzeile; der Mittelpunkttest sah das nicht. Jetzt: jede Textfläche wird
// als Rechteck gegen die Figur gelegt UND als 7 × 3-Raster abgetastet. Und es wird belegt, dass
// die Figur in diesem Aufbau wirklich da ist und die Leiste an der alten Grundposition bedeckt
// hätte — der Fall ist nachgestellt, nicht umgangen.
//   BILDBELEG: `test-results/klara-begleitung/begleitleiste-ueber-formular.png`.
import { mkdirSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Seite, type Stand, beende, fn, starte, wechsle } from "../design/h6-chromium";
import baueFrisch from "../review26-pruefen-schmal/bau";

const ANGEBOT = '[data-testid="begleitung-angebot"]';
const LEISTE = '[data-testid="begleitung-status"]';
const HINWEIS = '[data-testid="begleitung-hinweis"]';
const FIGUR = '[data-testid="klara-figur-huelle"]';
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
  stellen: {
    name: string;
    gefunden: boolean;
    verdeckt: number;
    schneidetFigur: boolean;
    flaecheInLeiste: boolean;
  }[];
  kontrast: number;
  gegenprobe: string;
  figurSichtbar: boolean;
  ohneAusweichenBedeckt: boolean;
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
  // Nacharbeit 9: die Figur samt Namensschild. Ein Mittelpunkt reicht nicht (Bens Befund) — jede
  // Textfläche wird als RECHTECK gegen die Figur gelegt und zusätzlich als 7 × 3-Punktraster
  // abgetastet: an JEDEM Rasterpunkt muss das oberste Element zur Leiste gehören.
  const figurEl = document.querySelector('${FIGUR}');
  const fr = figurEl ? figurEl.getBoundingClientRect() : null;
  const figurSichtbar = Boolean(fr && fr.width > 0 && fr.height > 0);
  const ueberschneiden = (a, b) => Boolean(b) && a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
  // Wo die Leiste OHNE Ausweichen stünde (unten links, 16 px): hätte die Figur sie dort bedeckt?
  const grundRect = { left: r.left, right: r.right, top: innerHeight - 16 - r.height, bottom: innerHeight - 16 };
  const ohneAusweichenBedeckt = figurSichtbar && ueberschneiden(grundRect, fr);
  const stelle = (name, el) => {
    if (!el) return { name, gefunden: false, verdeckt: 99, schneidetFigur: true, flaecheInLeiste: false };
    const b = el.getBoundingClientRect();
    let verdeckt = 0;
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 3; j++) {
        const x = b.left + 2 + ((b.width - 4) * i) / 6;
        const y = b.top + 2 + ((b.height - 4) * j) / 2;
        const oben = document.elementFromPoint(x, y);
        if (!oben || !leiste.contains(oben)) verdeckt++;
      }
    }
    const mitte = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    const flaeche = mitte ? ersteDeckendeFlaeche(mitte) : null;
    return {
      name,
      gefunden: true,
      verdeckt,
      schneidetFigur: figurSichtbar && ueberschneiden(b, fr),
      flaecheInLeiste: Boolean(flaeche && leiste.contains(flaeche)),
    };
  };
  const hinweisText = document.querySelector('${HINWEIS} p');
  const knoepfe = [...leiste.querySelectorAll("button")];
  const zweck = [...leiste.querySelectorAll("p")].find((p) => (p.textContent || "").startsWith("Zweck:"));
  const stellen = [
    stelle("zustand", document.querySelector('[data-testid="begleitung-zustand"]')),
    stelle("zweck", zweck),
    stelle("tastatur", document.querySelector('[data-testid="begleitung-tastatur"]')),
    stelle("hinweis", hinweisText),
    stelle("hinweisfeld", document.querySelector('${HINWEIS}')),
    ...knoepfe.map((kn) => stelle("knopf:" + (kn.textContent || "").trim(), kn)),
  ];

  const lum = (c) => {
    const lin = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  };
  const schrift = kanaele(getComputedStyle(hinweisText).color) ?? { r: 255, g: 255, b: 255 };
  const [hell, dunkel] = [lum(k), lum(schrift)].sort((x, y) => y - x);
  const kontrast = (hell + 0.05) / (dunkel + 0.05);
  return {
    ueberdeckteFelder, hintergrund, alpha: k.a, themaFlaeche, stellen, kontrast, gegenprobe,
    figurSichtbar, ohneAusweichenBedeckt,
  };
}`;

// ------------------------------------------------------------------------------------------------
// NACHARBEIT 10 (Ben K3/G10): die Figur wird per Tastatur (Pfeil hoch, 16 px je Schritt)
// so weit nach oben geschoben, dass die Leiste über ihr nicht mehr ganz Platz hat und begrenzt
// werden MUSS. Danach wird die Lage mehrfach gelesen — sie darf nicht mehr wechseln (kein Pendel,
// keine Renderschleife) — und Pause/Stopp müssen erreichbar sein: in den sichtbaren Bereich der
// Leiste gerollt, oben, ohne Figur darüber, und Pause wirkt auf einen echten Mausklick.
// ------------------------------------------------------------------------------------------------
const FIGUR_KNOPF = '[data-testid="klara-figur"]';
const BILD_VERSCHOBEN = "test-results/klara-begleitung/begleitleiste-figur-verschoben.png";

interface Lage {
  bottom: string;
  maxHeight: string;
  begrenzt: boolean;
  figurOben: number;
}

const LAGE_LESEN = `() => {
  const leiste = document.querySelector('${LEISTE}');
  const cs = getComputedStyle(leiste);
  const f = document.querySelector('${FIGUR}');
  return {
    bottom: cs.bottom,
    maxHeight: cs.maxHeight,
    begrenzt: leiste.scrollHeight > leiste.clientHeight + 1,
    figurOben: f ? Math.round(f.getBoundingClientRect().top) : -1,
  };
}`;

interface Knopflage {
  name: string;
  obenInLeiste: boolean;
  schneidetFigur: boolean;
  imFenster: boolean;
  x: number;
  y: number;
}

const KNOPF_LAGE = `(name) => {
  const leiste = document.querySelector('${LEISTE}');
  const knopf = [...leiste.querySelectorAll("button")].find((k) => (k.textContent || "").trim() === name);
  if (!knopf) return { name, obenInLeiste: false, schneidetFigur: true, imFenster: false, x: 0, y: 0 };
  knopf.scrollIntoView({ block: "nearest" });
  const b = knopf.getBoundingClientRect();
  const x = b.left + b.width / 2;
  const y = b.top + b.height / 2;
  const oben = document.elementFromPoint(x, y);
  const f = document.querySelector('${FIGUR}');
  const fr = f ? f.getBoundingClientRect() : null;
  const schneidet = Boolean(fr) && fr.width > 0 && b.right > fr.left && b.left < fr.right && b.bottom > fr.top && b.top < fr.bottom;
  return {
    name,
    obenInLeiste: Boolean(oben && leiste.contains(oben)),
    schneidetFigur: schneidet,
    imFenster: b.top >= 0 && b.bottom <= innerHeight,
    x,
    y,
  };
}`;

describe("BPA-05 · Begleitleiste über dem freigegebenen Formular (gebaute App, 390 px)", () => {
  let messung: Messung;
  let lagen: Lage[] = [];
  let knoepfe: Knopflage[] = [];
  let nachPause = "";

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
    // Die Leiste misst die Figur nach jedem Rendern und im 400-ms-Takt; danach steht sie fest.
    await page.waitForTimeout(1000);
    messung = await page.evaluate<Messung>(fn(MESSEN));
    mkdirSync("test-results/klara-begleitung", { recursive: true });
    await page.screenshot({ path: BILD });
    console.log(`BPA-05 Nacharbeit 9 · Messung ${JSON.stringify(messung)} · Bild ${BILD}`);

    // Nacharbeit 10: die Figur hochschieben, bis die Leiste begrenzt werden muss.
    await page.evaluate(
      fn("(s) => { const k = document.querySelector(s); if (k) k.focus(); return Boolean(k); }"),
      FIGUR_KNOPF,
    );
    // In 16-px-Schritten (Pfeil hoch), bis die Figur bei y ≤ 320 steht: dort überschneidet sie die
    // Leiste noch, und darüber ist weniger Platz als die volle Leistenhöhe — die Begrenzung greift.
    for (let i = 0; i < 40; i += 1) {
      const jetzt = await page.evaluate<Lage>(fn(LAGE_LESEN));
      if (jetzt.figurOben >= 0 && jetzt.figurOben <= 320) {
        break;
      }
      await page.keyboard.press("ArrowUp");
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(1200);
    lagen = [];
    for (let i = 0; i < 5; i += 1) {
      lagen.push(await page.evaluate<Lage>(fn(LAGE_LESEN)));
      await page.waitForTimeout(300);
    }
    knoepfe = [];
    for (const name of ["Pause", "Stopp"]) {
      knoepfe.push(await page.evaluate<Knopflage>(fn(KNOPF_LAGE), name));
    }
    await page.screenshot({ path: BILD_VERSCHOBEN });
    const pause = knoepfe[0];
    if (pause) {
      await page.mouse.click(pause.x, pause.y);
      await page.waitForTimeout(300);
    }
    nachPause = await page.evaluate<string>(
      fn(`() => document.querySelector('[data-testid="begleitung-zustand"]')?.textContent ?? ""`),
    );
    console.log(
      `BPA-05 Nacharbeit 10 · Lagen ${JSON.stringify(lagen)} · Knöpfe ${JSON.stringify(knoepfe)} · nach Pause „${nachPause}“ · Bild ${BILD_VERSCHOBEN}`,
    );
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

  it("Zustand, Zweck, Tastaturzeile, Hinweis und Knöpfe sind an JEDEM Rasterpunkt oben und deckend", () => {
    expect(messung.stellen.length).toBeGreaterThanOrEqual(7);
    for (const s of messung.stellen) {
      expect(s.gefunden, `${s.name}: nicht gefunden`).toBe(true);
      expect(s.verdeckt, `${s.name}: Rasterpunkte von Fremdem bedeckt`).toBe(0);
      expect(s.flaecheInLeiste, `${s.name}: keine deckende Fläche der Leiste darunter`).toBe(true);
    }
  });

  it("die Assistenzfigur überdeckt keine Textfläche der Leiste (G10, Nacharbeit 9)", () => {
    // Die Figur ist in diesem Aufbau wirklich da, und an der alten Grundposition hätte sie die
    // Leiste bedeckt — der Fall aus Bens Bildbeleg ist also nachgestellt, nicht umgangen.
    expect(messung.figurSichtbar).toBe(true);
    expect(messung.ohneAusweichenBedeckt).toBe(true);
    for (const s of messung.stellen) {
      expect(s.schneidetFigur, `${s.name}: überschneidet die Assistenzfigur`).toBe(false);
    }
  });

  it("der Hinweistext ist lesbar: Kontrast mindestens 4,5:1", () => {
    expect(messung.kontrast).toBeGreaterThanOrEqual(4.5);
  });

  it("Nacharbeit 10: nach Verschieben der Figur ist die Leiste begrenzt — und ihre Lage bleibt stabil", () => {
    expect(lagen).toHaveLength(5);
    const erste = lagen[0] as Lage;
    // Der kritische Fall ist wirklich erreicht: Figur oben genug, Leiste muss scrollen.
    expect(erste.figurOben).toBeGreaterThanOrEqual(0);
    expect(erste.figurOben).toBeLessThanOrEqual(320);
    expect(erste.begrenzt).toBe(true);
    for (const l of lagen) {
      expect(l.bottom).toBe(erste.bottom);
      expect(l.maxHeight).toBe(erste.maxHeight);
      expect(l.begrenzt).toBe(true);
    }
  });

  it("Nacharbeit 10: Pause und Stopp bleiben erreichbar, und Pause wirkt auf einen echten Klick", () => {
    expect(knoepfe.map((k) => k.name)).toEqual(["Pause", "Stopp"]);
    for (const k of knoepfe) {
      expect(k.imFenster, `${k.name}: außerhalb des Fensters`).toBe(true);
      expect(k.obenInLeiste, `${k.name}: nicht oben in der Leiste`).toBe(true);
      expect(k.schneidetFigur, `${k.name}: von der Figur überdeckt`).toBe(false);
    }
    expect(nachPause).toMatch(/^Pausiert · /);
  });

  it("Gegenprobe: die alte Deklaration wäre durchsichtig gewesen", () => {
    expect(messung.gegenprobe).toBe("rgba(0, 0, 0, 0)");
  });
});
