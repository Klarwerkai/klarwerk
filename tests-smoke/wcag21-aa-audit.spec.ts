// ================================================================================================
// R-0891 / R-2074 / SOLL:NFR-UX-02 — DER AUTOMATISIERBARE TEIL DES WCAG-2.1-AA-AUDITS.
// ================================================================================================
//
// AUFTRAG: „WCAG 2.1 AA (Kontrast, Tastatur, Screenreader). AK: Accessibility-Audit." ben
// (nacharbeit-2) hat zu Recht beanstandet, dass Einzelprüfungen das Audit nicht ersetzen. Diese Datei
// fährt deshalb die Erfolgskriterien, die sich am ECHTEN Produkt maschinell entscheiden lassen, über
// die Kernflächen — Anmeldemaske, Start, Fragen, Bibliothek, Erfassen, Prüfen — im echten Chromium
// mit dem echten Server, und zwar in BEIDEN Themen (klassisch und modern). Die Zuordnung ALLER 50
// A/AA-Kriterien steht in `docs/barrierefreiheit/WCAG-2.1-AA-AUDIT.md`.
//
// GEMESSEN WIRD, ausschliesslich aus der Rechnung des Browsers:
//   3.1.1  Sprache der Seite         — `html[lang]` ist de, en oder nl
//   2.4.2  Seitentitel               — `document.title` ist nicht leer
//   4.1.2  Name, Rolle, Wert         — jedes bedienbare Element im AX-Baum von Chromium (CDP) hat
//   1.1.1  Nicht-Text-Inhalt           einen nicht leeren zugänglichen Namen; ebenso jedes nicht
//   2.4.4  Linkzweck                   ignorierte Bild
//   3.3.2  Beschriftungen
//   4.1.1  Syntaxanalyse             — per aria-labelledby/-describedby/-controls oder `for`
//                                      referenzierte IDs sind eindeutig; labelledby/for existieren
//   1.4.3  Kontrast (Minimum)        — jeder sichtbare Textknoten UND jeder sichtbare Platzhalter:
//                                      berechnete Farbe gegen die zusammengesetzte Hintergrundfarbe,
//                                      4,5:1 bzw. 3:1 für großen Text — in beiden Themen
//   2.1.1  Tastatur                  — der Tab-Weg erreicht bedienbare Elemente
//   2.1.2  Keine Tastaturfalle       — kein Element hält den Fokus über Tab UND Escape fest
//   2.4.7  Fokus sichtbar            — jedes per Tab erreichte Element zeigt im Fokus eine
//                                      Kennzeichnung, die es OHNE Fokus nicht hat (Umriss, Schatten,
//                                      Rand oder `focus-within`-Umriss einer Hülle) und deren Farbe
//                                      nicht durchsichtig ist — verglichen wird fokussiert gegen
//                                      unfokussiert, nicht „irgendein Schatten ist da" (ben nacharbeit-5)
//   1.4.11 Nicht-Text-Kontrast       — diese Fokuskennzeichnung hebt sich mit ≥ 3:1 von der Fläche ab,
//                                      auf der sie steht
//   1.4.12 Textabstand               — mit Zeilenhöhe 1,5, Buchstabenabstand 0,12 em, Wortabstand
//                                      0,16 em und Absatzabstand 2 em wird kein Text abgeschnitten,
//                                      der vorher vollständig stand
//   1.4.4  Text vergrößern           — bei 640 × 400 CSS-px (200 % Zoom von 1280 × 800) kein
//                                      waagerechtes Scrollen und kein neu abgeschnittener Text
//   1.4.13 Inhalt bei Hover/Fokus    — erscheint beim Fokussieren oder Überfahren ein `role=tooltip`,
//                                      muss er sich mit Escape schließen lassen und beim Überfahren
//                                      stehen bleiben
//   1.4.10 Umbruch (Reflow)          — bei 320 CSS-px Breite kein waagerechtes Scrollen der Seite
//   2.4.1  Blöcke überspringen       — angemeldet: genau eine `main`-Landmarke (Technik ARIA11)
//
// AUSDRÜCKLICH NICHT GEMESSEN (in der Auditdatei als offen geführt): ob ein Vorleseprogramm den Text
// hörbar ausgibt, ob Alternativtexte und Beschriftungen SINNVOLL sind, ob die Reihenfolge
// bedeutungstragend ist, Lesbarkeit mit Handschuhen und bei wechselndem Licht.
//
// AUSNAHMEN NACH WCAG, nicht nach Bequemlichkeit: deaktivierte Bedienelemente und unsichtbarer Text.
// Was der Browser nicht eindeutig rechnen kann (Hintergrundbild, durchscheinende Vorfahren, nicht
// lesbares Farbformat, ein Element, das zwischen Messungen verschwindet), wird GEZÄHLT und im Bericht
// ausgewiesen, nicht stillschweigend als bestanden gewertet. Gewollte Kürzung mit Auslassungszeichen
// (`text-overflow: ellipsis`, `line-clamp`) wird bei 1.4.12/1.4.4 gezählt und ausgewiesen, aber nicht
// als Abschneiden gewertet.
import {
  type Browser,
  type CDPSession,
  type Page,
  type TestInfo,
  expect,
  test,
} from "@playwright/test";
import { ensureLoggedIn, workspaceMarker } from "./support/auth";

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "Der AX-Baum wird über das Chrome DevTools Protocol gelesen; Firefox und WebKit sprechen es nicht.",
);

/** Die angemeldeten Kernflächen. Die Anmeldemaske kommt in einem frischen Kontext dazu. */
const ROUTEN = ["/start", "/fragen", "/bibliothek", "/erfassen", "/validierung"] as const;

/** Rollen, die bedienbar sind und deshalb einen Namen brauchen (Chromium-Rollennamen). */
const BEDIENBAR = new Set([
  "button",
  "link",
  "textbox",
  "searchbox",
  "combobox",
  "checkbox",
  "radio",
  "switch",
  "slider",
  "spinbutton",
  "tab",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "listbox",
]);
const BILD = new Set(["image", "img"]);

const TAB_SCHRITTE = 30;

// ------------------------------------------------------------------------------------------------
// Die Rechenhilfen in der Seite. EINE Fassung für Kontrast, Fokus und Abschneiden — sie wird je
// Seite einmal hineingelegt (`installiereHelfer`) und von allen Messungen benutzt.
// ------------------------------------------------------------------------------------------------
type Rgba = [number, number, number, number];
interface Spur {
  farbe: Rgba;
  sig: string;
}
interface Fokusbild {
  umriss: Spur | null;
  schatten: Spur[];
  rand: Spur | null;
}
interface Helfer {
  lies(wert: string): Rgba | null;
  ueber(oben: Rgba, unten: Rgba): Rgba;
  verhaeltnis(a: Rgba, b: Rgba): number;
  hintergrund(start: Element): Rgba | null;
  sichtbar(el: Element): boolean;
  fokusBild(el: Element): Fokusbild;
  beschreibe(el: Element): string;
  warteAufUebergaenge(): Promise<void>;
  ueberlaufMerken(): void;
  neuGeclippt(): { befunde: string[]; gekuerzt: number };
  tooltips(): Element[];
}

function installiereHelfer(): void {
  const lies = (wert: string): Rgba | null => {
    const m = wert.match(/^rgba?\(([^)]+)\)$/);
    if (!m?.[1]) {
      return null;
    }
    const teile = m[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map((t) => (t.endsWith("%") ? Number(t.slice(0, -1)) / 100 : Number(t)));
    if (teile.length < 3 || teile.some((t) => Number.isNaN(t))) {
      return null;
    }
    return [teile[0] ?? 0, teile[1] ?? 0, teile[2] ?? 0, teile.length > 3 ? (teile[3] ?? 1) : 1];
  };
  const ueber = (oben: Rgba, unten: Rgba): Rgba => {
    const a = oben[3];
    return [
      oben[0] * a + unten[0] * (1 - a),
      oben[1] * a + unten[1] * (1 - a),
      oben[2] * a + unten[2] * (1 - a),
      1,
    ];
  };
  const kanal = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const leucht = (f: Rgba): number =>
    0.2126 * kanal(f[0]) + 0.7152 * kanal(f[1]) + 0.0722 * kanal(f[2]);
  const verhaeltnis = (a: Rgba, b: Rgba): number => {
    const x = leucht(a);
    const y = leucht(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  /** Der wirklich gemalte Hintergrund — oder null, wenn er nicht eindeutig zu rechnen ist. */
  const hintergrund = (start: Element): Rgba | null => {
    const schichten: Rgba[] = [];
    for (let el: Element | null = start; el; el = el.parentElement) {
      const stil = getComputedStyle(el);
      if (stil.backgroundImage !== "none") {
        return null;
      }
      const farbe = lies(stil.backgroundColor);
      if (!farbe) {
        return null;
      }
      if (farbe[3] > 0) {
        schichten.push(farbe);
      }
      if (farbe[3] >= 1) {
        break;
      }
    }
    // Ohne deckende Fläche malt der Browser auf Weiß (Leinwand).
    let ergebnis: Rgba = [255, 255, 255, 1];
    for (const schicht of schichten.reverse()) {
      ergebnis = ueber(schicht, ergebnis);
    }
    return ergebnis;
  };
  const sichtbar = (el: Element): boolean => {
    const r = el.getBoundingClientRect();
    const pruefbar = el as unknown as { checkVisibility(o: Record<string, boolean>): boolean };
    return (
      r.width > 1 &&
      r.height > 1 &&
      pruefbar.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    );
  };
  /** Sichtbare Schattenschichten: deckende Farbe UND eine Ausdehnung — sonst malt sie nichts. */
  const schatten = (wert: string): Spur[] => {
    if (!wert || wert === "none") {
      return [];
    }
    const spuren: Spur[] = [];
    for (const roh of wert.split(/,(?![^(]*\))/)) {
      const t = roh.trim();
      const farbe = lies(t.match(/rgba?\([^)]*\)/)?.[0] ?? "");
      const zahlen = (t.replace(/rgba?\([^)]*\)/, "").match(/-?[\d.]+px/g) ?? []).map((z) =>
        Number.parseFloat(z),
      );
      const [x = 0, y = 0, unschaerfe = 0, ausdehnung = 0] = zahlen;
      if (farbe && farbe[3] > 0 && (unschaerfe > 0 || ausdehnung > 0 || x !== 0 || y !== 0)) {
        spuren.push({ farbe, sig: t });
      }
    }
    return spuren;
  };
  const fokusBild = (el: Element): Fokusbild => {
    const s = getComputedStyle(el);
    const umrissFarbe = lies(s.outlineColor);
    const umriss =
      s.outlineStyle !== "none" &&
      Number.parseFloat(s.outlineWidth) > 0 &&
      umrissFarbe &&
      umrissFarbe[3] > 0
        ? { farbe: umrissFarbe, sig: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}` }
        : null;
    const randFarbe = lies(s.borderTopColor);
    const randBreite = Number.parseFloat(s.borderTopWidth);
    const rand =
      randFarbe && randFarbe[3] > 0 && randBreite >= 1
        ? {
            farbe: randFarbe,
            sig: [s.borderTopColor, s.borderRightColor, s.borderBottomColor, s.borderLeftColor]
              .concat([s.borderTopWidth])
              .join(" "),
          }
        : null;
    return { umriss, schatten: schatten(s.boxShadow), rand };
  };
  const beschreibe = (el: Element): string => {
    const anker = el.closest("[data-testid], [aria-label], [id]");
    const wo = anker
      ? `${anker.tagName.toLowerCase()}[${
          anker.getAttribute("data-testid")
            ? `data-testid=${anker.getAttribute("data-testid")}`
            : anker.getAttribute("aria-label")
              ? `aria-label=${anker.getAttribute("aria-label")}`
              : `id=${anker.id}`
        }]`
      : "ohne Anker";
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
    return `<${el.tagName.toLowerCase()}> in ${wo} „${text}“`;
  };
  const warteAufUebergaenge = async (): Promise<void> => {
    // Endliche CSS-Übergänge (der Ring blendet über 150 ms ein) abwarten; Endlos-Animationen
    // (Ladekreise) nicht — sie enden nie.
    const endlich = document
      .getAnimations()
      .filter((a) => a.effect?.getTiming().iterations !== Number.POSITIVE_INFINITY);
    await Promise.race([
      Promise.all(endlich.map((a) => a.finished.catch(() => undefined))),
      new Promise((r) => setTimeout(r, 800)),
    ]);
  };
  // 1.4.12 / 1.4.4: Elemente, die Text abschneiden KÖNNEN (overflow hidden/clip) — vorher, nachher.
  const ueberlauf = (e: Element): boolean =>
    e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1;
  const schneidend = (e: Element): boolean => {
    const s = getComputedStyle(e);
    const zu = (v: string): boolean => v === "hidden" || v === "clip";
    return (zu(s.overflowX) || zu(s.overflowY)) && (e.textContent ?? "").trim() !== "";
  };
  const merker = new Map<Element, boolean>();
  const ueberlaufMerken = (): void => {
    merker.clear();
    for (const e of document.querySelectorAll("body *")) {
      if (schneidend(e) && sichtbar(e)) {
        merker.set(e, ueberlauf(e));
      }
    }
  };
  const neuGeclippt = (): { befunde: string[]; gekuerzt: number } => {
    const befunde: string[] = [];
    let gekuerzt = 0;
    for (const [e, vorher] of merker) {
      if (vorher || !e.isConnected || !sichtbar(e) || !ueberlauf(e)) {
        continue;
      }
      const s = getComputedStyle(e);
      const gewollt =
        s.textOverflow === "ellipsis" ||
        (s.getPropertyValue("-webkit-line-clamp") || "none") !== "none";
      if (gewollt) {
        gekuerzt += 1;
      } else {
        befunde.push(`${beschreibe(e)} schneidet Text ab`);
      }
    }
    return { befunde, gekuerzt };
  };
  const tooltips = (): Element[] =>
    [...document.querySelectorAll("[role='tooltip']")].filter((t) => sichtbar(t));

  const helfer: Helfer = {
    lies,
    ueber,
    verhaeltnis,
    hintergrund,
    sichtbar,
    fokusBild,
    beschreibe,
    warteAufUebergaenge,
    ueberlaufMerken,
    neuGeclippt,
    tooltips,
  };
  (window as unknown as { __kwA11y: Helfer }).__kwA11y = helfer;
}

// ------------------------------------------------------------------------------------------------
// 1.4.3 — Textknoten und Platzhalter, im Browser gerechnet.
// ------------------------------------------------------------------------------------------------
interface Kontrastbericht {
  verstoesse: string[];
  gemessen: number;
  unbestimmt: number;
}

function kontrastImBrowser(): Kontrastbericht {
  const h = (window as unknown as { __kwA11y: Helfer }).__kwA11y;
  const bericht: Kontrastbericht = { verstoesse: [], gemessen: 0, unbestimmt: 0 };
  const fmt = (f: Rgba): string => `rgb(${f.slice(0, 3).map(Math.round).join(",")})`;
  const miss = (was: string, el: Element, farbe: string): void => {
    // Durchscheinende Vorfahren ändern die gemalte Farbe auf eine Weise, die hier nicht gerechnet
    // wird — gezählt statt geraten.
    let deckkraft = 1;
    for (let v: Element | null = el; v; v = v.parentElement) {
      deckkraft *= Number(getComputedStyle(v).opacity);
    }
    const grund = h.hintergrund(el);
    const vorne = h.lies(farbe);
    if (deckkraft < 1 || !grund || !vorne) {
      bericht.unbestimmt += 1;
      return;
    }
    const stil = getComputedStyle(el);
    const text = vorne[3] < 1 ? h.ueber(vorne, grund) : vorne;
    const groesse = Number.parseFloat(stil.fontSize);
    const fett = Number.parseInt(stil.fontWeight, 10) >= 700;
    const soll = groesse >= 24 || (groesse >= 18.66 && fett) ? 3 : 4.5;
    const wert = h.verhaeltnis(text, grund);
    bericht.gemessen += 1;
    if (wert < soll) {
      bericht.verstoesse.push(
        `${was} ${fmt(text)} auf ${fmt(grund)} = ${wert.toFixed(2)}:1 (Soll ${soll}:1, ${groesse}px)`,
      );
    }
  };

  const gang = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let knoten = gang.nextNode(); knoten; knoten = gang.nextNode()) {
    const inhalt = (knoten.textContent ?? "").trim();
    const el = knoten.parentElement;
    if (!inhalt || !el || el.closest("svg, script, style, noscript, template")) {
      continue;
    }
    // Unsichtbarer Text ist nicht gemeint; 1-px-Flächen sind Vorlesetext (sr-only). Inaktive
    // Bedienelemente nimmt 1.4.3 ausdrücklich aus.
    if (!h.sichtbar(el) || el.closest("[disabled], [aria-disabled='true']")) {
      continue;
    }
    miss(`„${inhalt.slice(0, 50)}“`, el, getComputedStyle(el).color);
  }
  // Platzhalter sind Text, aber kein Textknoten — eigens über `::placeholder` gerechnet.
  for (const feld of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    "input[placeholder], textarea[placeholder]",
  )) {
    if (
      !feld.placeholder.trim() ||
      feld.value !== "" ||
      feld.disabled ||
      !h.sichtbar(feld) ||
      feld.closest("[aria-disabled='true']")
    ) {
      continue;
    }
    miss(
      `Platzhalter „${feld.placeholder.slice(0, 50)}“`,
      feld,
      getComputedStyle(feld, "::placeholder").color,
    );
  }
  return bericht;
}

// ------------------------------------------------------------------------------------------------
// 4.1.2/1.1.1 — Namen im AX-Baum.
// ------------------------------------------------------------------------------------------------
/**
 * Benennt einen Befund so, dass er ohne zweiten Lauf zu finden ist: Element, nächster Anker
 * (data-testid, aria-label oder id eines Vorfahren) und der Anfang seines Markups. Eine blosse
 * Knotennummer (nacharbeit-3) war nicht auffindbar.
 */
async function beschreibe(cdp: CDPSession, backendNodeId: number | undefined): Promise<string> {
  if (backendNodeId === undefined) {
    return "(ohne DOM-Knoten)";
  }
  try {
    const { object } = await cdp.send("DOM.resolveNode", { backendNodeId });
    if (!object.objectId) {
      return `(backendDOMNodeId ${backendNodeId})`;
    }
    const antwort = await cdp.send("Runtime.callFunctionOn", {
      objectId: object.objectId,
      returnByValue: true,
      functionDeclaration: `function () {
        const anker = this.closest ? this.closest("[data-testid], [aria-label], [id]") : null;
        const wo = anker
          ? anker.tagName.toLowerCase() + "[" + (anker.getAttribute("data-testid")
              ? "data-testid=" + anker.getAttribute("data-testid")
              : anker.getAttribute("aria-label")
                ? "aria-label=" + anker.getAttribute("aria-label")
                : "id=" + anker.id) + "]"
          : "ohne Anker";
        const markup = (this.outerHTML || "").replace(/\\s+/g, " ").slice(0, 120);
        return "<" + this.tagName.toLowerCase() + "> in " + wo + " · " + markup;
      }`,
    });
    const text = antwort.result.value;
    return typeof text === "string" ? text : `(backendDOMNodeId ${backendNodeId})`;
  } catch {
    return `(backendDOMNodeId ${backendNodeId})`;
  }
}

async function namenImAxBaum(page: Page): Promise<string[]> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Accessibility.enable");
  // Für `beschreibe()`: DOM.resolveNode braucht die eingeschaltete DOM-Domäne.
  await cdp.send("DOM.enable");
  const { nodes } = await cdp.send("Accessibility.getFullAXTree");
  const ohneNamen: string[] = [];
  for (const knoten of nodes) {
    if (knoten.ignored) {
      continue;
    }
    const rolle = typeof knoten.role?.value === "string" ? knoten.role.value : "";
    if (!BEDIENBAR.has(rolle) && !BILD.has(rolle)) {
      continue;
    }
    const name = typeof knoten.name?.value === "string" ? knoten.name.value.trim() : "";
    if (!name) {
      ohneNamen.push(`${rolle} ${await beschreibe(cdp, knoten.backendDOMNodeId)}`);
    }
  }
  await cdp.detach();
  return ohneNamen;
}

async function idVerweise(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const befunde: string[] = [];
    const zaehle = (id: string): number =>
      document.querySelectorAll(`[id="${CSS.escape(id)}"]`).length;
    const verweise: Array<{ attr: string; muss: boolean }> = [
      { attr: "aria-labelledby", muss: true },
      { attr: "aria-describedby", muss: false },
      { attr: "aria-controls", muss: false },
      { attr: "for", muss: true },
    ];
    for (const { attr, muss } of verweise) {
      for (const el of document.querySelectorAll(`[${attr}]`)) {
        for (const id of (el.getAttribute(attr) ?? "").split(/\s+/).filter(Boolean)) {
          const n = zaehle(id);
          if (n > 1) {
            befunde.push(`${attr}="${id}" ist ${n}-mal vergeben`);
          } else if (n === 0 && muss) {
            befunde.push(`${attr}="${id}" zeigt ins Leere`);
          }
        }
      }
    }
    return befunde;
  });
}

// ------------------------------------------------------------------------------------------------
// 2.1.1 / 2.1.2 / 2.4.7 / 1.4.11 / 1.4.13 — der Tab-Weg.
//
// DIE FOKUSMESSUNG IN ZWEI SCHRITTEN (ben nacharbeit-5): Ein Schatten ≠ `none` beweist keinen
// sichtbaren Fokus — er kann durchsichtig sein oder als Dekoration ohnehin dastehen. Deshalb wird
// jedes erreichte Element zweimal gemessen: IM Fokus (direkt nach Tab, nach Ende der Übergänge) und
// OHNE Fokus (am Ende des Wegs, wenn nichts mehr fokussiert ist). Als Kennzeichnung zählt nur, was
// im Fokus sichtbar dasteht und ohne Fokus NICHT — und ihre Farbe muss sich mit ≥ 3:1 von der Fläche
// abheben, auf der sie gemalt wird.
// ------------------------------------------------------------------------------------------------
interface Fokusschritt {
  /** Eindeutige Kennung DIESES Elements — gleiche Beschriftungen sind nicht dasselbe Element. */
  id: string;
  wer: string;
  tooltips: number;
}

async function fokusSchritt(page: Page): Promise<Fokusschritt | null> {
  return page.evaluate(async () => {
    const h = (window as unknown as { __kwA11y: Helfer }).__kwA11y;
    const el = document.activeElement;
    if (!el || el === document.body || el === document.documentElement) {
      return null;
    }
    const ablage = window as unknown as {
      __kwAuditNr?: number;
      __kwFokus?: Map<string, { el: Element; wer: string; f: Fokusbild; huellen: Fokusbild[] }>;
    };
    if (!el.hasAttribute("data-kw-audit-nr")) {
      ablage.__kwAuditNr = (ablage.__kwAuditNr ?? 0) + 1;
      el.setAttribute("data-kw-audit-nr", String(ablage.__kwAuditNr));
    }
    const id = el.getAttribute("data-kw-audit-nr") ?? "";
    await h.warteAufUebergaenge();
    // Bis zu drei Hüllen: `focus-within:outline` (z. B. das Suchfeld im Kopfband) zählt mit.
    const huellen: Fokusbild[] = [];
    let v = el.parentElement;
    for (let i = 0; v && i < 3; i++, v = v.parentElement) {
      huellen.push(h.fokusBild(v));
    }
    const name =
      el.getAttribute("aria-label") ?? el.getAttribute("data-testid") ?? el.textContent ?? "";
    const wer = `${el.tagName.toLowerCase()} „${name.trim().slice(0, 40)}“`;
    ablage.__kwFokus ??= new Map();
    ablage.__kwFokus.set(id, { el, wer, f: h.fokusBild(el), huellen });
    return { id, wer, tooltips: h.tooltips().length };
  });
}

interface Fokusauswertung {
  befunde: string[];
  gemessen: number;
  unbestimmt: number;
}

/** Am Ende des Wegs: nichts fokussiert — jetzt der Vergleich gegen den unfokussierten Zustand. */
async function fokusAuswertung(page: Page): Promise<Fokusauswertung> {
  return page.evaluate(async () => {
    const h = (window as unknown as { __kwA11y: Helfer }).__kwA11y;
    const ablage = window as unknown as {
      __kwFokus?: Map<string, { el: Element; wer: string; f: Fokusbild; huellen: Fokusbild[] }>;
    };
    (document.activeElement as HTMLElement | null)?.blur();
    await h.warteAufUebergaenge();
    const ergebnis: Fokusauswertung = { befunde: [], gemessen: 0, unbestimmt: 0 };
    for (const { el, wer, f, huellen } of ablage.__kwFokus?.values() ?? []) {
      if (!el.isConnected) {
        // Das Element ist mit dem Fokuswechsel verschwunden (z. B. ein geschlossenes Menü).
        ergebnis.unbestimmt += 1;
        continue;
      }
      const u = h.fokusBild(el);
      // Was NUR im Fokus gemalt ist, mit der Fläche, auf der es steht.
      const neu: Array<{ farbe: Rgba; auf: Element }> = [];
      const auf = el.parentElement ?? el;
      if (f.umriss && f.umriss.sig !== u.umriss?.sig) {
        neu.push({ farbe: f.umriss.farbe, auf });
      }
      for (const s of f.schatten) {
        if (!u.schatten.some((x) => x.sig === s.sig)) {
          neu.push({ farbe: s.farbe, auf });
        }
      }
      if (f.rand && u.rand && f.rand.sig !== u.rand.sig) {
        neu.push({ farbe: f.rand.farbe, auf });
      }
      let huelle = el.parentElement;
      for (const hf of huellen) {
        if (!huelle) {
          break;
        }
        const hu = h.fokusBild(huelle);
        if (hf.umriss && hf.umriss.sig !== hu.umriss?.sig) {
          neu.push({ farbe: hf.umriss.farbe, auf: huelle.parentElement ?? huelle });
        }
        huelle = huelle.parentElement;
      }
      ergebnis.gemessen += 1;
      if (neu.length === 0) {
        ergebnis.befunde.push(
          `2.4.7: kein sichtbarer Fokus an ${wer} (im Fokus nichts Sichtbares, das ohne Fokus fehlt)`,
        );
        continue;
      }
      let bester: number | null = null;
      for (const { farbe, auf: flaeche } of neu) {
        const grund = h.hintergrund(flaeche);
        if (!grund) {
          continue;
        }
        const wert = h.verhaeltnis(farbe[3] < 1 ? h.ueber(farbe, grund) : farbe, grund);
        bester = bester === null ? wert : Math.max(bester, wert);
      }
      if (bester === null) {
        ergebnis.unbestimmt += 1;
      } else if (bester < 3) {
        ergebnis.befunde.push(
          `1.4.11: Fokuskennzeichnung an ${wer} hebt sich nur mit ${bester.toFixed(2)}:1 ab (Soll 3:1)`,
        );
      }
    }
    ablage.__kwFokus?.clear();
    return ergebnis;
  });
}

async function tastaturweg(page: Page): Promise<{ befunde: string[]; fokus: Fokusauswertung }> {
  const befunde: string[] = [];
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
  const erreicht = new Set<string>();
  let vorher = "";
  let gleich = 0;
  for (let i = 0; i < TAB_SCHRITTE; i++) {
    await page.keyboard.press("Tab");
    const schritt = await fokusSchritt(page);
    if (!schritt) {
      continue;
    }
    erreicht.add(schritt.id);
    // 1.4.13: ein beim Fokussieren erschienener Hinweis muss sich mit Escape schließen lassen.
    if (schritt.tooltips > 0) {
      await page.keyboard.press("Escape");
      const danach = await page.evaluate(
        () => (window as unknown as { __kwA11y: Helfer }).__kwA11y.tooltips().length,
      );
      if (danach > 0) {
        befunde.push(`1.4.13: Fokusinhalt an ${schritt.wer} schließt nicht mit Escape`);
      }
    }
    gleich = schritt.id === vorher ? gleich + 1 : 0;
    vorher = schritt.id;
    if (gleich >= 2) {
      // Ein Dialog mit nur einem Element darf den Fokus halten, solange Escape hinausführt.
      await page.keyboard.press("Escape");
      await page.keyboard.press("Tab");
      const danach = await fokusSchritt(page);
      if (danach?.id === vorher) {
        befunde.push(`2.1.2: Tastaturfalle an ${schritt.wer}`);
        break;
      }
      gleich = 0;
    }
  }
  if (erreicht.size < 3) {
    befunde.push(`2.1.1: der Tab-Weg erreicht nur ${erreicht.size} Elemente`);
  }
  const fokus = await fokusAuswertung(page);
  befunde.push(...fokus.befunde);
  return { befunde: [...new Set(befunde)], fokus };
}

/** 1.4.13 beim Überfahren: jedes auf dem Tab-Weg erreichte Element wird einmal überfahren. */
async function hoverInhalte(page: Page): Promise<{ befunde: string[]; gefunden: number }> {
  const befunde: string[] = [];
  let gefunden = 0;
  const ids = await page.evaluate(() =>
    [...document.querySelectorAll("[data-kw-audit-nr]")].map(
      (e) => e.getAttribute("data-kw-audit-nr") ?? "",
    ),
  );
  const zaehle = (): Promise<number> =>
    page.evaluate(() => (window as unknown as { __kwA11y: Helfer }).__kwA11y.tooltips().length);
  for (const id of ids) {
    const ziel = page.locator(`[data-kw-audit-nr="${id}"]`);
    try {
      if (!(await ziel.isVisible())) {
        continue;
      }
      await ziel.hover({ timeout: 1_000 });
    } catch {
      continue;
    }
    if ((await zaehle()) === 0) {
      continue;
    }
    gefunden += 1;
    const wer = await ziel.evaluate((e) =>
      (window as unknown as { __kwA11y: Helfer }).__kwA11y.beschreibe(e),
    );
    // Überfahrbar: der Zeiger wandert auf den Hinweis — er bleibt stehen.
    const kasten = await page.locator("[role='tooltip']").first().boundingBox();
    if (kasten) {
      await page.mouse.move(kasten.x + kasten.width / 2, kasten.y + kasten.height / 2);
      if ((await zaehle()) === 0) {
        befunde.push(`1.4.13: Hover-Inhalt an ${wer} verschwindet beim Überfahren`);
      }
    }
    // Schließbar: Escape, ohne den Zeiger zu bewegen.
    await page.keyboard.press("Escape");
    if ((await zaehle()) > 0) {
      befunde.push(`1.4.13: Hover-Inhalt an ${wer} schließt nicht mit Escape`);
    }
  }
  await page.mouse.move(0, 0);
  return { befunde, gefunden };
}

/** 1.4.12: die Abstände aus dem Erfolgskriterium, als Nutzerstil mit Vorrang. */
async function textabstand(page: Page): Promise<{ befunde: string[]; gekuerzt: number }> {
  return page.evaluate(async () => {
    const h = (window as unknown as { __kwA11y: Helfer }).__kwA11y;
    h.ueberlaufMerken();
    const stil = document.createElement("style");
    stil.setAttribute("data-kw-audit", "textabstand");
    stil.textContent =
      "* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }";
    document.head.appendChild(stil);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const ergebnis = h.neuGeclippt();
    stil.remove();
    return {
      befunde: ergebnis.befunde.map((b) => `1.4.12: ${b}`),
      gekuerzt: ergebnis.gekuerzt,
    };
  });
}

/** Misst bei einer Fenstergröße: waagerechtes Scrollen und (optional) neu abgeschnittenen Text. */
async function beiGroesse(
  page: Page,
  breite: number,
  hoehe: number,
  sc: string,
  mitAbschneiden: boolean,
): Promise<{ befunde: string[]; gekuerzt: number }> {
  const vorher = page.viewportSize();
  if (mitAbschneiden) {
    await page.evaluate(() =>
      (window as unknown as { __kwA11y: Helfer }).__kwA11y.ueberlaufMerken(),
    );
  }
  await page.setViewportSize({ width: breite, height: hoehe });
  await page.waitForTimeout(400);
  const m = await page.evaluate((abschneiden) => {
    const h = (window as unknown as { __kwA11y: Helfer }).__kwA11y;
    return {
      breite: document.documentElement.scrollWidth,
      sicht: document.documentElement.clientWidth,
      geclippt: abschneiden ? h.neuGeclippt() : { befunde: [], gekuerzt: 0 },
    };
  }, mitAbschneiden);
  if (vorher) {
    await page.setViewportSize(vorher);
    await page.waitForTimeout(200);
  }
  const befunde =
    m.breite > m.sicht + 1
      ? [`${sc}: bei ${breite} px scrollt die Seite waagerecht (${m.breite} > ${m.sicht} px)`]
      : [];
  befunde.push(...m.geclippt.befunde.map((b) => `${sc}: bei ${breite} × ${hoehe} px ${b}`));
  return { befunde, gekuerzt: m.geclippt.gekuerzt };
}

/** Schaltet zwischen klassischem und modernem Thema (`data-theme="modern"` an <html>). */
async function themaUmschalten(page: Page): Promise<{ vorher: string; nachher: string }> {
  const lage = await page.evaluate(() => {
    const wurzel = document.documentElement;
    const vorher = wurzel.getAttribute("data-theme") === "modern" ? "modern" : "klassisch";
    if (vorher === "modern") {
      wurzel.removeAttribute("data-theme");
    } else {
      wurzel.setAttribute("data-theme", "modern");
    }
    return { vorher, nachher: vorher === "modern" ? "klassisch" : "modern" };
  });
  await page.waitForTimeout(300);
  return lage;
}

/** Alle Messungen einer Fläche, in beiden Themen; der Bericht hängt als Anhang am Lauf. */
async function pruefeFlaeche(page: Page, wo: string, testInfo: TestInfo): Promise<string[]> {
  await page.evaluate(installiereHelfer);
  const befunde: string[] = [];
  const kopf = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    titel: document.title,
  }));
  if (!/^(de|en|nl)\b/.test(kopf.lang)) {
    befunde.push(`3.1.1: html[lang] ist „${kopf.lang}“`);
  }
  if (!kopf.titel.trim()) {
    befunde.push("2.4.2: der Seitentitel ist leer");
  }
  for (const n of await namenImAxBaum(page)) {
    befunde.push(`4.1.2/1.1.1: ohne zugänglichen Namen: ${n}`);
  }
  for (const v of await idVerweise(page)) {
    befunde.push(`4.1.1: ${v}`);
  }

  const bericht: Record<string, unknown> = { flaeche: wo };
  const themaMessen = async (thema: string, voll: boolean): Promise<void> => {
    const kontrast = await page.evaluate(kontrastImBrowser);
    befunde.push(...kontrast.verstoesse.map((v) => `1.4.3 [${thema}]: ${v}`));
    const weg = await tastaturweg(page);
    befunde.push(...weg.befunde.map((b) => b.replace(/^([\d.]+):/, `$1 [${thema}]:`)));
    const eintrag: Record<string, unknown> = {
      kontrastGemessen: kontrast.gemessen,
      kontrastUnbestimmt: kontrast.unbestimmt,
      fokusGemessen: weg.fokus.gemessen,
      fokusUnbestimmt: weg.fokus.unbestimmt,
    };
    if (voll) {
      const hover = await hoverInhalte(page);
      befunde.push(...hover.befunde);
      const abstand = await textabstand(page);
      befunde.push(...abstand.befunde);
      const zoom = await beiGroesse(page, 640, 400, "1.4.4", true);
      befunde.push(...zoom.befunde);
      const reflow = await beiGroesse(page, 320, 640, "1.4.10", false);
      befunde.push(...reflow.befunde);
      Object.assign(eintrag, {
        hoverInhalte: hover.gefunden,
        textabstandGekuerzt: abstand.gekuerzt,
        zoomGekuerzt: zoom.gekuerzt,
      });
    }
    bericht[thema] = eintrag;
    // Selbstschutz: eine Fläche ohne gemessenen Text wäre grün, ohne etwas geprüft zu haben.
    const leer = `${wo} [${thema}]: kein einziger Textknoten gemessen`;
    expect(kontrast.gemessen, leer).toBeGreaterThan(5);
  };

  const erstes = await page.evaluate(() =>
    document.documentElement.getAttribute("data-theme") === "modern" ? "modern" : "klassisch",
  );
  await themaMessen(erstes, true);
  const lage = await themaUmschalten(page);
  await themaMessen(lage.nachher, false);
  await themaUmschalten(page);

  bericht.befunde = befunde;
  await testInfo.attach(`wcag-audit-${wo.replace(/\W+/g, "_")}.json`, {
    body: JSON.stringify(bericht, null, 2),
    contentType: "application/json",
  });
  return befunde;
}

async function frischeSeite(browser: Browser, testInfo: TestInfo): Promise<Page> {
  const baseURL = testInfo.project.use.baseURL;
  const kontext = await browser.newContext(baseURL ? { baseURL } : {});
  return kontext.newPage();
}

// ================================================================================================
// KALIBRIERUNG — die Messmittel erkennen jeden Verstoss, bevor sie Grün behaupten.
// ================================================================================================
//
// Für 2.4.7 die Fehlklassen, die ben (nacharbeit-5) benannt hat — jede muss ROT werden:
//   f-nackt                  im Fokus weder Umriss noch Schatten
//   f-transparent-umriss     im Fokus ein Umriss, aber durchsichtig
//   f-transparent-schatten   im Fokus ein Schatten, aber durchsichtig
//   f-deko                   ein Dekorationsschatten, der mit und ohne Fokus gleich dasteht
// Für 1.4.11:  f-schwach    sichtbarer Fokusring, aber hellgrau auf Weiß (~1,2:1)
// Und GRÜN muss bleiben:   f-gut     schwarzer Ring nur im Fokus (21:1)
const KALIBRIERUNG = `
<html lang="de"><head><title>Kalibrierung</title>
<style>
  body { background: #fff; color: #000; font: 16px sans-serif; }
  .grau { color: #999; }
  button { color: #000; background: #fff; border: 1px solid #000; font: 16px sans-serif; }
  button:focus { outline: none; }
  #f-nackt:focus { box-shadow: none; }
  #f-transparent-umriss:focus { outline: 2px solid transparent; }
  #f-transparent-schatten:focus { box-shadow: 0 0 0 3px rgba(0, 0, 0, 0); }
  #f-deko { box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5); }
  #f-schwach:focus { box-shadow: 0 0 0 2px #eeeeee; }
  #f-gut:focus { box-shadow: 0 0 0 2px #000; }
  #f-tip:focus { box-shadow: 0 0 0 2px #000; }
  .blass::placeholder { color: #cccccc; }
  .klar::placeholder { color: #333333; }
  input { color: #000; background: #fff; border: 1px solid #000; }
  input:focus { outline: 2px solid #000; }
  .eng { width: 600px; height: 20px; line-height: 20px; overflow: hidden; }
  .breit { width: 900px; }
</style></head>
<body>
  <p class="grau">Grau auf Weiß, ~2,8:1</p>
  <p>Schwarz auf Weiß</p>
  <p>Noch ein Absatz</p>
  <p>Und noch einer</p>
  <p>Und ein vierter</p>
  <p>Und ein fünfter</p>
  <button id="f-nackt" data-testid="f-nackt"></button>
  <button id="f-transparent-umriss" data-testid="f-transparent-umriss">Umriss</button>
  <button id="f-transparent-schatten" data-testid="f-transparent-schatten">Schatten</button>
  <button id="f-deko" data-testid="f-deko">Deko</button>
  <button id="f-schwach" data-testid="f-schwach">Schwach</button>
  <button id="f-gut" data-testid="f-gut">Gut</button>
  <button id="f-tip" data-testid="f-tip" aria-describedby="tip">Hinweis</button>
  <div role="tooltip" id="tip" hidden>Bleibt stehen, auch nach Escape</div>
  <input class="blass" placeholder="Blass" aria-label="Blass">
  <input class="klar" placeholder="Klar" aria-label="Klar">
  <div class="eng" data-testid="f-eng">Eine Zeile, die mit Textabstand nicht mehr passt</div>
  <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="10" height="10">
  <div class="breit">Breit</div>
  <script>
    const knopf = document.getElementById("f-tip");
    const tip = document.getElementById("tip");
    const zeige = () => { tip.hidden = false; };
    knopf.addEventListener("focus", zeige);
    knopf.addEventListener("mouseenter", zeige);
  </script>
</body></html>`;

test("KALIBRIERUNG · jede Messart schlägt an einer fehlerhaften Fixture an — und nur dort", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.setContent(KALIBRIERUNG);
  const befunde = await pruefeFlaeche(page, "Kalibrierung", testInfo);
  const text = befunde.join("\n");
  const hat = (muster: RegExp, warum: string): void => {
    expect(text, warum).toMatch(muster);
  };
  hat(/1\.4\.3 \[\w+\]: „Grau auf Weiß/, "der Kontrastverstoss wird nicht erkannt");
  hat(/4\.1\.2\/1\.1\.1: .*button/, "der namenlose Knopf wird nicht erkannt");
  hat(/4\.1\.2\/1\.1\.1: .*(image|img)/, "das namenlose Bild wird nicht erkannt");
  for (const fall of ["f-nackt", "f-transparent-umriss", "f-transparent-schatten", "f-deko"]) {
    hat(new RegExp(`2\\.4\\.7 \\[\\w+\\]: kein sichtbarer Fokus an button „${fall}“`), fall);
  }
  hat(/1\.4\.11 \[\w+\]: Fokuskennzeichnung an button „f-schwach“/, "der blasse Ring");
  hat(/1\.4\.3 \[\w+\]: Platzhalter „Blass“/, "der blasse Platzhalter wird nicht erkannt");
  hat(/1\.4\.12: .*data-testid=f-eng/, "das Abschneiden bei Textabstand wird nicht erkannt");
  hat(/1\.4\.13.*f-tip.*Escape/, "der stehende Hinweis wird nicht erkannt");
  hat(/1\.4\.10: /, "der waagerechte Überlauf bei 320 px wird nicht erkannt");
  // Und das Richtige wird nicht beanstandet.
  expect(text).not.toMatch(/(2\.4\.7|1\.4\.11) \[\w+\]: .*„f-gut“/);
  expect(text).not.toContain("Schwarz auf Weiß");
  expect(text).not.toContain("Platzhalter „Klar“");
});

// ================================================================================================
// DIE FLÄCHEN DES PRODUKTS.
// ================================================================================================
test("AUDIT · Anmeldemaske (ohne Sitzung)", async ({ browser }, testInfo) => {
  test.setTimeout(180_000);
  const seite = await frischeSeite(browser, testInfo);
  await seite.goto("/");
  await expect(seite.locator('input[type="password"]').first()).toBeVisible({ timeout: 15_000 });
  const befunde = await pruefeFlaeche(seite, "Anmeldemaske", testInfo);
  await seite.context().close();
  expect(befunde, "WCAG-2.1-AA-Befunde auf der Anmeldemaske").toEqual([]);
});

for (const route of ROUTEN) {
  test(`AUDIT · ${route}`, async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    await ensureLoggedIn(page);
    await page.goto(route);
    await expect(workspaceMarker(page)).toBeVisible({ timeout: 15_000 });
    // Nachladende Abfragen fertig werden lassen, ohne auf ein Netz-Ruhefenster zu warten, das
    // Abfragen mit Wiederholung nie erreichen.
    await page.waitForTimeout(1_000);
    const befunde = await pruefeFlaeche(page, route, testInfo);
    // 2.4.1 (Technik ARIA11): Kopfband und Navigation lassen sich über die Landmarke `main`
    // überspringen — genau eine, damit Vorlesewerkzeuge eindeutig dorthin springen.
    const hauptbereiche = await page.locator("main").count();
    if (hauptbereiche !== 1) {
      befunde.push(`2.4.1: ${hauptbereiche} main-Landmarken statt genau einer`);
    }
    expect(befunde, `WCAG-2.1-AA-Befunde auf ${route}`).toEqual([]);
  });
}
