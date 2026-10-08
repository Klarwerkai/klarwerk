// @vitest-environment jsdom
// ================================================================================================
// R-0872 / R-1956 · DIE PAARUNGEN DER PFLICHTFLÄCHEN, AM GERENDERTEN DOM GESAMMELT UND GERECHNET.
// ================================================================================================
//
// DIE BENANNTE RESTLÜCKE (Register F27, ben sammel60; `tests/legal/mega62-kontrast-pflichtflaechen
// .test.ts`, Kopf von „mega63 C"): Der Vollständigkeitssammler dort bildet MENGEN von Text- und
// Flächentokens aus dem Quelltext der Rechtsflächen, nicht deren PAARUNGEN. Eine falsche
// Kreuzkombination bekannter Tokens bliebe grün — genau so ein Fall war der mega63-Befund
// (`text-brand-text` auf `--kw-night`, beide Tokens „gemessen", die Paarung nie).
//
// WAS DIESE DATEI DAGEGEN TUT: Sie montiert die ECHTEN Pflichtflächen — Hinweisbanner (beide
// Zustände), Impressum, Datenschutzerklärung, Sperrfläche nach gescheiterter Abmeldung — und
// bestimmt für JEDEN sichtbaren Textknoten die Paarung, die dort wirklich gilt: die nächste
// Textfarbe und die nächste Fläche in seiner Vorfahrenkette (ohne Klasse: `bg-page text-text` aus
// dem `body` in index.css). Jede so gefundene Paarung wird in BEIDEN Themen mit der WCAG-Formel
// aus der einen Token-Datei gerechnet und muss AA (4,5:1) erreichen. Es gibt keine Liste, gegen
// die verglichen wird — die Paarung selbst wird gemessen.
//
// UND WAS SIE NICHT RATEN DARF: Eine Farbklasse, die sich keinem Token zuordnen lässt (Rohwert
// `text-[#…]`, Deckkraft `bg-white/20`), wird nicht übergangen, sondern gemeldet — dann wäre die
// Rechnung an dieser Stelle eine Schätzung, und der Fall wird rot.
//
// GRENZEN, ausdrücklich:
//   · jsdom rechnet kein CSS. Gesammelt wird die Klassenkette, nicht die gemalte Farbe; eine
//     Überschreibung allein in modern.css (Komponentenregel) sähe dieser Sammler nicht.
//   · Der Hinweistext ohne Knöpfe auf der Anmeldemaske und der Fußbereich in der dunklen
//     Markenspalte (`tone="inverse"`, Deckkraftklassen) liegen ausserhalb dieser Flächen; für sie
//     gilt weiter der Mengensammler in mega62.
//   · Großtext-Ausnahme (3:1) wird nicht in Anspruch genommen — jede Paarung muss 4,5:1 erreichen.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/endpoints", () => ({
  endpoints: {
    features: {
      get: () => Promise.resolve({ features: { rechtsseiten: true, hinweisbanner: true } }),
    },
  },
}));
vi.mock("../api/auth", () => ({
  authApi: {
    status: () => Promise.resolve({ needsSetup: false, oidcEnabled: false }),
    me: () => Promise.resolve({ id: "u1", role: "experte" }),
    notice: () => Promise.resolve({ currentVersion: "v1", due: true }),
    acknowledgeNotice: () =>
      Promise.resolve({ currentVersion: "v1", acknowledgedVersion: "v1", due: false }),
    logout: () => Promise.resolve(),
    ssoStartUrl: "/api/auth/oidc/start",
  },
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

const { NoticeBanner } = await import("./NoticeBanner");
const { LegalScreen } = await import("./LegalPages");
const { SignOutBlocked } = await import("./SignOutBlocked");
const { AuthProvider } = await import("../app/AuthContext");
const { default: i18n } = await import("../i18n");

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ------------------------------------------------------------------------------------------------
// Die Token-Datei und die WCAG-Rechnung — dieselbe Formel wie in mega62, aus derselben Datei.
// ------------------------------------------------------------------------------------------------
// Pfad über das Arbeitsverzeichnis (Werkswurzel) wie in `pages/Stufe2.kopf.test.tsx`: unter jsdom
// ist `import.meta.url` kein `file:`-URL, `readFileSync(new URL(…))` lud die Datei deshalb nicht.
const THEMES = readFileSync(
  resolve(process.cwd(), "apps/web/src/styles/themes.css"),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");
const MODERN_START = THEMES.indexOf('[data-theme="modern"]');
const KLASSISCH_BLOCK = THEMES.slice(0, MODERN_START);
const MODERN_BLOCK = THEMES.slice(MODERN_START);
const TOKEN_NAMEN = new Set(
  [...THEMES.matchAll(/--kw-([a-z0-9-]+):\s*\d+ \d+ \d+;/g)].map((m) => m[1] ?? ""),
);

type Thema = "klassisch" | "modern";
type Rgb = [number, number, number];

function farbe(name: string, thema: Thema): Rgb {
  // `white` ist Tailwinds eigenes Weiß, kein Token.
  if (name === "white") {
    return [255, 255, 255];
  }
  const suche = (block: string): RegExpMatchArray | null =>
    block.match(new RegExp(`--kw-${name}:\\s*(\\d+) (\\d+) (\\d+);`));
  // Das moderne Thema ERBT, was es nicht selbst überschreibt.
  const treffer = (thema === "modern" ? suche(MODERN_BLOCK) : null) ?? suche(KLASSISCH_BLOCK);
  if (!treffer?.[1] || !treffer[2] || !treffer[3]) {
    throw new Error(`Token --kw-${name} fehlt im Thema ${thema}`);
  }
  return [Number(treffer[1]), Number(treffer[2]), Number(treffer[3])];
}

function kanal(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function leuchtdichte([r, g, b]: Rgb): number {
  return 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b);
}

function kontrast(vorne: Rgb, hinten: Rgb): number {
  const a = leuchtdichte(vorne);
  const b = leuchtdichte(hinten);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const AA = 4.5;

// ------------------------------------------------------------------------------------------------
// Der Paarungssammler.
// ------------------------------------------------------------------------------------------------
type Art = "text" | "bg";

/** `text-…`-Klassen, die keine Farbe sind: Größen, Ausrichtung, Umbruch, Größen-Rohwerte. */
const TEXT_OHNE_FARBE =
  /^(xs|sm|base|lg|xl|\d+xl|micro|left|center|right|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip|\[\d[^\]]*\])$/;

interface Sammlung {
  /** „text|fläche" → Beispieltexte, an denen die Paarung gefunden wurde. */
  paare: Map<string, string[]>;
  /** Farbklassen, die sich keinem Token zuordnen lassen — jede ist ein Befund. */
  unbekannt: Set<string>;
}

function farbklasse(klasse: string, art: Art, unbekannt: Set<string>): string | null {
  // Zustands- und Breitenvarianten (`hover:`, `focus-visible:`, `sm:`) gelten nicht im Ruhezustand.
  if (klasse.includes(":") || !klasse.startsWith(`${art}-`)) {
    return null;
  }
  const name = klasse.slice(art.length + 1);
  if (name === "white" || TOKEN_NAMEN.has(name)) {
    return name;
  }
  if (art === "text" && TEXT_OHNE_FARBE.test(name)) {
    return null;
  }
  if (art === "bg" && name === "transparent") {
    return null;
  }
  unbekannt.add(klasse);
  return null;
}

/** Die wirksame Farbe einer Art: die nächste zuordenbare Klasse in der Vorfahrenkette. */
function wirksam(start: Element | null, art: Art, unbekannt: Set<string>): string {
  for (let el = start; el; el = el.parentElement) {
    for (const klasse of Array.from(el.classList)) {
      const name = farbklasse(klasse, art, unbekannt);
      if (name) {
        return name;
      }
    }
  }
  // index.css: `body { @apply bg-page text-text … }`.
  return art === "text" ? "text" : "page";
}

function sammle(wurzel: Element, sammlung: Sammlung): void {
  const gang = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT);
  for (let knoten = gang.nextNode(); knoten; knoten = gang.nextNode()) {
    const inhalt = (knoten.textContent ?? "").trim();
    if (!inhalt) {
      continue;
    }
    const el = knoten.parentElement;
    const text = wirksam(el, "text", sammlung.unbekannt);
    const grund = wirksam(el, "bg", sammlung.unbekannt);
    const schluessel = `${text}|${grund}`;
    const beispiele = sammlung.paare.get(schluessel) ?? [];
    if (beispiele.length < 3) {
      beispiele.push(inhalt.slice(0, 40));
    }
    sammlung.paare.set(schluessel, beispiele);
  }
}

function neueSammlung(): Sammlung {
  return { paare: new Map(), unbekannt: new Set() };
}

// ------------------------------------------------------------------------------------------------
// Die echten Flächen, montiert.
// ------------------------------------------------------------------------------------------------
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

async function warte(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
}

async function montieren(element: ReturnType<typeof createElement>): Promise<void> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(QueryClientProvider, { client }, createElement(AuthProvider, null, element)),
    );
  });
  await warte();
}

function flaeche(kennung: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(`[data-testid="${kennung}"]`);
  if (!el) {
    throw new Error(`Fläche „${kennung}“ ist nicht gerendert — es gäbe nichts zu sammeln`);
  }
  return el;
}

/** Sammelt alle Pflichtflächen in eine Sammlung — jede Fläche in ihrem eigenen Baum. */
async function sammleAllePflichtflaechen(): Promise<Map<string, Sammlung>> {
  const je = new Map<string, Sammlung>();

  await montieren(createElement(NoticeBanner));
  const banner = neueSammlung();
  sammle(flaeche("notice-banner"), banner);
  je.set("Hinweisbanner", banner);
  // Der zweite Zustand derselben Fläche: die Erklärung vor der Ablehnung.
  await act(async () => {
    flaeche("notice-decline-open").click();
  });
  await warte();
  const ablehnung = neueSammlung();
  sammle(flaeche("notice-decline"), ablehnung);
  sammle(flaeche("notice-banner"), ablehnung);
  je.set("Hinweisbanner, Ablehnung", ablehnung);
  abbauen();

  for (const seite of ["imprint", "privacy"] as const) {
    await montieren(createElement(LegalScreen, { page: seite }));
    const s = neueSammlung();
    // Die ganze Seite, nicht nur der Artikel: Zurück-Verweis und Fußbereich gehören dazu.
    flaeche("legal-draft-notice");
    flaeche("legal-footer");
    sammle(container, s);
    je.set(seite === "imprint" ? "Impressum" : "Datenschutzerklärung", s);
    abbauen();
  }

  await montieren(createElement(SignOutBlocked));
  const sperre = neueSammlung();
  sammle(flaeche("signout-blocked"), sperre);
  je.set("Sperrfläche", sperre);
  abbauen();

  return je;
}

function abbauen(): void {
  act(() => root.unmount());
  container.remove();
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("R-0872 · jede Paarung auf einer Pflichtfläche erreicht AA — am DOM gesammelt, nicht aufgezählt", () => {
  it("jede gefundene Paarung misst in beiden Themen mindestens 4,5:1", async () => {
    const je = await sammleAllePflichtflaechen();
    const verstoesse: string[] = [];
    let gemessen = 0;
    for (const [wo, sammlung] of je) {
      // Selbstschutz: eine Fläche ohne Textknoten wäre grün, ohne etwas gemessen zu haben.
      expect(sammlung.paare.size, `${wo}: keine einzige Paarung gefunden`).toBeGreaterThan(0);
      for (const [schluessel, beispiele] of sammlung.paare) {
        const [text = "", grund = ""] = schluessel.split("|");
        for (const thema of ["klassisch", "modern"] as const) {
          const wert = kontrast(farbe(text, thema), farbe(grund, thema));
          gemessen += 1;
          if (wert < AA) {
            verstoesse.push(
              `${wo} · ${thema}: text-${text} auf ${grund} misst ${wert.toFixed(3)}:1 („${beispiele[0]}“)`,
            );
          }
        }
      }
    }
    expect(gemessen, "es wurde nichts gerechnet").toBeGreaterThan(10);
    expect(verstoesse).toEqual([]);
  });

  it("keine Farbklasse bleibt ungeklärt — ein Rohwert oder eine Deckkraft wäre eine Schätzung", async () => {
    const je = await sammleAllePflichtflaechen();
    const unbekannt = [...je.values()].flatMap((s) => [...s.unbekannt]);
    expect(unbekannt).toEqual([]);
  });

  it("der Sammler sieht die echten Kreuzpaarungen — auch die, die keine Paarungsliste nannte", async () => {
    const je = await sammleAllePflichtflaechen();
    const alle = new Set([...je.values()].flatMap((s) => [...s.paare.keys()]));
    const gefunden = [...alle].join(", ");
    // Bekannte Paarungen der Flächen — wenn eine davon fehlt, sammelt der Sammler nicht mehr dort,
    // wo die Texte stehen.
    for (const paar of [
      "text|hairline-soft", // Bannertitel
      "muted|hairline-soft", // Pflichtabsätze und Verweise im Banner
      "trust-warn-text|trust-warn-bg", // Entwurfsvermerk und Sperrfläche
      "ink|white", // Überschriften der Rechtsseiten
      "text|white", // Fließtext der Rechtsseiten
      "muted-2|white", // offene Angaben und Fußbereich
      // Die Hauptaktion (`Button variant="primary"`): ihre Farben stehen in components/ui.tsx,
      // nicht in den Rechtsdateien — der Mengensammler in mega62 hat sie deshalb nie gesehen.
      "white|ink",
    ]) {
      expect(alle.has(paar), `Paarung ${paar} fehlt — gefunden: ${gefunden}`).toBe(true);
    }
  });
});

describe("R-0872 · KALIBRIERUNG — der Sammler fängt genau den Fall, den der Mengensammler übersah", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("Markentext auf der Nachtfläche: beide Tokens bekannt, die Paarung rot (mega63-Befund, 3,069:1)", () => {
    // Eine Fixture, kein Produktcode: genau die Kreuzkombination, die ben gefunden hat.
    const huelle = document.createElement("div");
    huelle.className = "bg-night";
    huelle.innerHTML = '<p class="text-[12px] text-brand-text hover:text-text">Markentext</p>';
    document.body.appendChild(huelle);

    const s = neueSammlung();
    sammle(huelle, s);
    expect([...s.paare.keys()]).toEqual(["brand-text|night"]);
    // Jedes Token für sich ist „bekannt" — der Mengensammler wäre hier grün.
    expect(TOKEN_NAMEN.has("brand-text") && TOKEN_NAMEN.has("night")).toBe(true);
    const wert = kontrast(farbe("brand-text", "modern"), farbe("night", "modern"));
    expect(wert).toBeLessThan(AA);
    expect(wert).toBeCloseTo(3.069, 2);
  });

  it("ein Rohwert und eine Deckkraftklasse werden gemeldet, nicht geraten", () => {
    const huelle = document.createElement("div");
    huelle.className = "bg-white/20";
    huelle.innerHTML = '<span class="text-[#999999]">Rohwert</span>';
    document.body.appendChild(huelle);

    const s = neueSammlung();
    sammle(huelle, s);
    expect([...s.unbekannt].sort()).toEqual(["bg-white/20", "text-[#999999]"]);
  });

  it("die Formel trifft die Eckwerte (Schwarz auf Weiß = 21, Weiß auf Weiß = 1)", () => {
    expect(kontrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(kontrast([255, 255, 255], [255, 255, 255])).toBeCloseTo(1, 5);
  });
});
