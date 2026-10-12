// ================================================================================================
// produkt:20261010:assistenz-name-avatar · DIE NEUN ZUSTÄNDE DER FIGUR (ANIMATIONSZUSTAENDE.json).
// ================================================================================================
//
//   Z1  Jeder Zustand entsteht nur aus seinem echten Auslöser; Vorrang wie in `ausdruck.ts`.
//   Z2  Freude endet von selbst nach FREUDE_MS; Fehler und Pause bleiben bis zur nächsten Aktion.
//   Z3  Stil je Motiv nach `style_variants`: expressiv / zurückhaltend; Ersatzgrafik zurückhaltend.
//   Z4  index.css: jede vorgesehene Bewegung hat je Stil eine Regel — nur unter
//       `prefers-reduced-motion: no-preference` und nie bei `data-bewegung="reduziert"`; sachliche
//       Objekte bekommen nur Licht und sparsame Neigung, keine Hüpfer oder Gesten.
//   Z5  Der klassische Hilfeknopf nutzt keinen festen Produktnamen mehr (K6).
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ASSISTENZ_ZUSTAENDE,
  FREUDE_MS,
  type ZustandsLage,
  ermittleZustand,
  letztesErgebnis,
  meldeErgebnis,
} from "../../apps/web/src/components/assistenz/ausdruck";
import { ASSISTENZ_AVATAR_KATALOG, animationsStil } from "../../apps/web/src/lib/assistenzAvatare";
import { repoPfad } from "../support/repoPfad";

const RUHE: ZustandsLage = {
  minimiert: false,
  hoertZu: false,
  spricht: false,
  laeuft: false,
  verarbeitet: false,
  rueckfrage: false,
  ergebnis: null,
  jetzt: 10_000,
};

afterEach(() => {
  meldeErgebnis(null);
  vi.useRealTimers();
});

describe("Z1 · Auslöser und Vorrang", () => {
  it("die neun Zustände der Vorgabe", () => {
    expect([...ASSISTENZ_ZUSTAENDE]).toEqual([
      "bereit",
      "warten",
      "nachdenken",
      "zuhoeren",
      "sprechen",
      "ratlos",
      "freude",
      "fehler",
      "pause",
    ]);
  });

  it.each([
    ["bereit", {}],
    ["warten", { laeuft: true }],
    ["nachdenken", { laeuft: true, verarbeitet: true }],
    ["zuhoeren", { hoertZu: true }],
    ["sprechen", { spricht: true }],
    ["ratlos", { rueckfrage: true }],
    ["freude", { ergebnis: { art: "freude", seit: 9_000 } }],
    ["fehler", { ergebnis: { art: "fehler", seit: 1 } }],
    ["pause", { ergebnis: { art: "pause", seit: 1 } }],
    ["pause", { minimiert: true, laeuft: true, hoertZu: true }],
  ] as const)("%s aus %j", (erwartet, lage) => {
    expect(ermittleZustand({ ...RUHE, ...lage })).toBe(erwartet);
  });

  it("ohne gemeldete Verarbeitung gibt es kein Nachdenken — eine laufende Anfrage ist Warten", () => {
    expect(ermittleZustand({ ...RUHE, laeuft: true })).toBe("warten");
  });

  it("Zuhören und Sprechen gehen der Anfrage vor; die laufende Anfrage dem alten Ergebnis", () => {
    expect(ermittleZustand({ ...RUHE, laeuft: true, hoertZu: true })).toBe("zuhoeren");
    expect(ermittleZustand({ ...RUHE, laeuft: true, spricht: true })).toBe("sprechen");
    const alt = { art: "fehler" as const, seit: 1 };
    expect(ermittleZustand({ ...RUHE, laeuft: true, ergebnis: alt })).toBe("warten");
  });
});

describe("Z2 · Ende der Zustände", () => {
  it("Freude höchstens FREUDE_MS, danach bereit — kein Dauerjubel", () => {
    const seit = 10_000;
    const freude = { art: "freude" as const, seit };
    const kurz = ermittleZustand({ ...RUHE, ergebnis: freude, jetzt: seit + FREUDE_MS - 1 });
    const spaeter = ermittleZustand({ ...RUHE, ergebnis: freude, jetzt: seit + FREUDE_MS });
    expect(kurz).toBe("freude");
    expect(spaeter).toBe("bereit");
    expect(FREUDE_MS).toBeLessThanOrEqual(3_000);
  });

  it("der Ergebnisspeicher räumt die Freude von selbst; Fehler bleibt bis zur neuen Aktion", () => {
    vi.useFakeTimers();
    meldeErgebnis("freude");
    expect(letztesErgebnis()?.art).toBe("freude");
    vi.advanceTimersByTime(FREUDE_MS + 10);
    expect(letztesErgebnis()).toBeNull();

    meldeErgebnis("fehler");
    vi.advanceTimersByTime(FREUDE_MS * 10);
    expect(letztesErgebnis()?.art).toBe("fehler");
    meldeErgebnis("pause");
    vi.advanceTimersByTime(FREUDE_MS * 10);
    expect(letztesErgebnis()?.art).toBe("pause");
    // Eine neue Aktion beendet den Zustand.
    meldeErgebnis(null);
    expect(letztesErgebnis()).toBeNull();
  });
});

describe("Z3 · Stil je Motiv nach style_variants", () => {
  it("expressiv: Original, Lichtwesen, Roboter, Eule, Fuchs, Pinguin, Wolke, Kompass", () => {
    const expressiv = ASSISTENZ_AVATAR_KATALOG.filter((m) => animationsStil(m) === "expressiv");
    expect(expressiv.map((m) => m.id)).toEqual([
      "original",
      "lichtwesen",
      "roboter",
      "eule",
      "fuchs",
      "pinguin",
      "wolke",
      "kompass",
    ]);
  });

  it("zurückhaltend: Prisma, Wissensbuch, Verbindungsknoten, Monolith, Leuchtkreis — und Ersatz", () => {
    const sachlich = ASSISTENZ_AVATAR_KATALOG.filter((m) => animationsStil(m) === "zurueckhaltend");
    expect(sachlich.map((m) => m.id)).toEqual([
      "prisma",
      "wissensbuch",
      "verbindungsknoten",
      "monolith",
      "leuchtkreis",
    ]);
    expect(animationsStil(null)).toBe("zurueckhaltend");
  });
});

describe("Z4 · die Darstellung in index.css", () => {
  const css = readFileSync(repoPfad("apps/web/src/index.css"), "utf8");
  const anker = css.indexOf("DIE NEUN ZUSTÄNDE DER FIGUR");
  const start = css.indexOf("@media (prefers-reduced-motion: no-preference) {", anker);
  const ende = css.indexOf("@keyframes kw-assistenz-atmen");
  const block = css.slice(start, ende);

  /** Die Regel für Stil und Zustand innerhalb des Bewegungsblocks — oder `null`. */
  function regel(stil: string, zustand: string): string | null {
    const kopf = `.klara-figur[data-stil="${stil}"][data-zustand="${zustand}"]`;
    const i = block.indexOf(kopf);
    if (i < 0) {
      return null;
    }
    return block.slice(i, block.indexOf("}", i) + 1);
  }

  it("der Bewegungsblock ist gefunden", () => {
    expect(anker).toBeGreaterThan(0);
    expect(start).toBeGreaterThan(anker);
    expect(ende).toBeGreaterThan(start);
  });

  const BEWEGT_EXPRESSIV = [
    "bereit",
    "warten",
    "nachdenken",
    "zuhoeren",
    "sprechen",
    "ratlos",
    "freude",
    "fehler",
  ];
  it.each(BEWEGT_EXPRESSIV)("expressiv · %s ist bewegt — nur ohne reduzierte Bewegung", (z) => {
    const r = regel("expressiv", z);
    expect(r, z).not.toBeNull();
    expect(r).toMatch(/:not\(\s*\[data-bewegung="reduziert"\]\s*\)/);
    expect(r).toMatch(/animation: kw-/);
  });

  const LICHT = /animation: kw-assistenz-(lichtpuls|lichtwandern|signal|neigen-klein|aufhellen) /;
  const GESTE = /huepfer|nicken|kippen|atmen|absinken|kw-assistenz-sprechen/;
  const BEWEGT_SACHLICH = ["warten", "nachdenken", "zuhoeren", "sprechen", "ratlos", "freude"];
  it.each(BEWEGT_SACHLICH)("zurückhaltend · %s ist Licht oder sparsame Neigung", (z) => {
    const r = regel("zurueckhaltend", z) ?? "";
    expect(r, z).toMatch(/:not\(\s*\[data-bewegung="reduziert"\]\s*\)/);
    expect(r, z).toMatch(LICHT);
    expect(r, z).not.toMatch(GESTE);
  });

  it("Pause ist in beiden Stilen still; Fehler und Pause der Objekte statisch gedimmt", () => {
    expect(regel("expressiv", "pause")).toBeNull();
    expect(regel("zurueckhaltend", "pause")).toBeNull();
    expect(regel("zurueckhaltend", "fehler")).toBeNull();
    expect(regel("zurueckhaltend", "bereit")).toBeNull();
    const gedimmt = css.slice(anker, start);
    expect(gedimmt).toContain('[data-stil="zurueckhaltend"][data-zustand="pause"] .klara-motiv');
    expect(gedimmt).toContain("filter: brightness(0.86)");
  });

  it("ausserhalb des Blocks für nicht reduzierte Bewegung läuft keine Zustandsanimation", () => {
    const ausserhalb = css.slice(0, start) + css.slice(ende);
    expect(ausserhalb).not.toMatch(/animation: kw-assistenz-/);
  });
});

describe("Z5 · klassischer Hilfeknopf ohne festen Produktnamen (K6)", () => {
  it("KlaraAssistant beschriftet Öffnen, Tooltip und Kopf über das persönliche Profil", () => {
    const quelle = readFileSync(repoPfad("apps/web/src/components/KlaraAssistant.tsx"), "utf8");
    expect(quelle).not.toMatch(/t\("klara\.(open|title)"\)/);
    expect(quelle).toContain('t("assistenz.hilfe.oeffnen", { assistenz: anzeigename })');
    expect(quelle).toContain("aria-label={titelText}");
  });
});
