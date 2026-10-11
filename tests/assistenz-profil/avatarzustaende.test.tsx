// @vitest-environment jsdom
// ================================================================================================
// produkt:20261010:assistenz-avatarzustaende · ZUSTÄNDE ALLER 13 MOTIVE: VORSCHAU, VORRANG, FEHLERARTEN.
// ================================================================================================
//
// Ergänzt `ausdruck.test.ts`, `mimik.test.tsx` und `sprachaktivitaet.test.tsx` (Auftrag
// assistenz-name-avatar) um den fehlenden Umfang dieses Auftrags:
//
//   A1  K4: Eine neue Aktion bestimmt sofort den Zustand; das Ergebnis einer ÄLTEREN Aktion
//       (langsame Antwort, verspätetes Speichern) überschreibt die neuere nicht.
//   A2  K2/K3: Das Ergebnis einer Frage aus dem tatsächlichen Stand — Freude nur bei belegter
//       Antwort; „ohne Grundlage“ ist Fehler „quelle“, nicht Erfolg; nicht gespeichert ist keine
//       Freude; fehlende Einwilligung ist eine fehlende Angabe („eingabe“), Server/Netz „technisch“.
//   A3  K3/K5/K9: Jeder Zustand und jede Fehlerart hat einen eigenen verständlichen Text (DE/EN/NL).
//   A4  K5/K9/K10: index.css — sachliche Objekte zeigen jeden Zustand auch STATISCH (Licht/Neigung,
//       ohne Animation); fehlende Quelle/Angabe neigen fragend statt abzusinken.
//   A5  K6/K1/K8: Die Avatar-Auswahl startet für JEDES der 13 Motive bewusst eine Vorschau, die alle
//       neun Zustände nacheinander zeigt — erkennbar als Vorschau, ohne Profil-, Wahl- oder
//       Ergebnisänderung; Mimik nur für Motive mit Gesicht; „Nachdenken“ als nur-Vorschau markiert.
//   A6  K6/K8: Tastatur — „Vorschau beenden“ hat den Fokus; Escape/Enter beenden, der Fokus kehrt
//       zum Startknopf zurück. Verborgene Seite beendet die Vorschau (K7).
//   A7  K5: Reduzierte Bewegung (eigene Wahl) gilt auch in der Vorschau — Hinweis und Attribut.
//   A8  K2/K4: Die Figur nutzt Aktionskennung und Fehlerart (Quelle `KlaraVorschau.tsx`).
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { AvatarAuswahl } from "../../apps/web/src/components/assistenz/AvatarAuswahl";
import {
  ASSISTENZ_ZUSTAENDE,
  FEHLER_ARTEN,
  VORSCHAU_SCHRITT_MS,
  ausdruckNachFrage,
  beginneAktion,
  ermittleZustand,
  letztesErgebnis,
  meldeErgebnis,
  zustandsTextSchluessel,
} from "../../apps/web/src/components/assistenz/ausdruck";
import i18n from "../../apps/web/src/i18n";
import { ASSISTENZ_AVATAR_KATALOG, animationsStil } from "../../apps/web/src/lib/assistenzAvatare";
import texte from "../../apps/web/src/texte/assistenz";
import { repoPfad } from "../support/repoPfad";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  meldeErgebnis(null);
  vi.useRealTimers();
});

describe("A1 · neue Aktion vor altem Ergebnis (K4)", () => {
  it("ein verspätetes Ergebnis einer älteren Aktion ist wirkungslos", () => {
    const alt = beginneAktion();
    const neu = beginneAktion();
    meldeErgebnis("freude", { aktion: alt });
    expect(letztesErgebnis()).toBeNull();
    meldeErgebnis("fehler", { aktion: neu, fehlerArt: "technisch" });
    expect(letztesErgebnis()).toMatchObject({ art: "fehler", fehlerArt: "technisch" });
    // Auch ein altes Fehlerergebnis überschreibt die neuere Freude nicht.
    const dritte = beginneAktion();
    meldeErgebnis("freude", { aktion: dritte });
    meldeErgebnis("fehler", { aktion: neu });
    expect(letztesErgebnis()?.art).toBe("freude");
  });

  it("beginneAktion beendet Fehler, Pause und Freude sofort", () => {
    for (const art of ["fehler", "pause", "freude"] as const) {
      meldeErgebnis(art, { aktion: beginneAktion() });
      expect(letztesErgebnis()?.art).toBe(art);
      beginneAktion();
      expect(letztesErgebnis()).toBeNull();
    }
  });

  it("schneller Wechsel: läuft eine neue Anfrage, zeigt die Figur Warten — nicht das alte Ergebnis", () => {
    const basis = {
      minimiert: false,
      hoertZu: false,
      spricht: false,
      verarbeitet: false,
      rueckfrage: false,
      jetzt: 10_000,
    };
    const ergebnis = { art: "freude" as const, seit: 9_900 };
    expect(ermittleZustand({ ...basis, laeuft: true, ergebnis })).toBe("warten");
    expect(ermittleZustand({ ...basis, laeuft: false, ergebnis })).toBe("freude");
  });

  it("ein Fehler ohne Angabe der Art gilt als technisch", () => {
    meldeErgebnis("fehler");
    expect(letztesErgebnis()?.fehlerArt).toBe("technisch");
    meldeErgebnis("freude");
    expect(letztesErgebnis()?.fehlerArt).toBeUndefined();
  });
});

describe("A2 · Ergebnis einer Frage aus dem tatsächlichen Stand (K2/K3)", () => {
  it.each([
    ["belegte KI-Antwort", "beantwortet", { modus: "ki" }, { art: "freude" }],
    ["ohne Grundlage", "beantwortet", { modus: "ohne_ki" }, { art: "fehler", fehlerArt: "quelle" }],
    ["nicht gespeichert", "beantwortet", { modus: "ki", ohneBeleg: true }, null],
    ["ohne Nachricht", "beantwortet", null, null],
    ["gestoppt", "abgebrochen", { modus: "abgebrochen" }, { art: "pause" }],
    [
      "Einwilligung fehlt",
      "fehlgeschlagen",
      { modus: "fehler", grund: "einwilligung_fehlt" },
      { art: "fehler", fehlerArt: "eingabe" },
    ],
    [
      "Server",
      "fehlgeschlagen",
      { modus: "fehler", grund: "server" },
      { art: "fehler", fehlerArt: "technisch" },
    ],
    [
      "Netz",
      "fehlgeschlagen",
      { modus: "fehler", grund: "netz" },
      { art: "fehler", fehlerArt: "technisch" },
    ],
  ] as const)("%s", (_name, stand, letzte, erwartet) => {
    expect(ausdruckNachFrage(stand, letzte)).toEqual(erwartet);
  });
});

describe("A3 · Textstatus je Zustand und Fehlerart (K3/K5/K9)", () => {
  const SPRACHEN = ["de", "en", "nl"] as const;
  it.each(SPRACHEN)("%s: neun Zustände und drei Fehlerarten, je eigener Text", (sprache) => {
    const block = texte[sprache] as Record<string, string>;
    const schluessel = [
      ...ASSISTENZ_ZUSTAENDE.map((z) => zustandsTextSchluessel(z)),
      ...FEHLER_ARTEN.map((a) => zustandsTextSchluessel("fehler", a)),
    ];
    // „fehler“ + „technisch“ ist derselbe Schlüssel wie „fehler“ — elf verschiedene Texte.
    const eindeutig = [...new Set(schluessel)];
    expect(eindeutig).toHaveLength(11);
    const werte = eindeutig.map((k) => block[k]);
    for (const [i, w] of werte.entries()) {
      expect(w, `${sprache}: ${eindeutig[i]}`).toBeTruthy();
    }
    expect(new Set(werte).size).toBe(11);
  });

  it("Vorschautexte stehen in allen Sprachen", () => {
    for (const sprache of SPRACHEN) {
      const block = texte[sprache] as Record<string, string>;
      for (const k of [
        "assistenz.vorschau.starten",
        "assistenz.vorschau.startenLabel",
        "assistenz.vorschau.titel",
        "assistenz.vorschau.hinweis",
        "assistenz.vorschau.schritt",
        "assistenz.vorschau.nurVorschau",
        "assistenz.vorschau.ruhig",
        "assistenz.vorschau.beenden",
        "assistenz.vorschau.fertig",
      ]) {
        expect(block[k], `${sprache}: ${k}`).toBeTruthy();
      }
    }
  });
});

describe("A4 · index.css: statischer Lichtausdruck und Fehlerarten (K5/K9/K10)", () => {
  const css = readFileSync(repoPfad("apps/web/src/index.css"), "utf8");
  const anker = css.indexOf("DIE NEUN ZUSTÄNDE DER FIGUR");
  const start = css.indexOf("@media (prefers-reduced-motion: no-preference) {", anker);
  const ende = css.indexOf("@keyframes kw-assistenz-atmen");
  const statisch = css.slice(anker, start);
  const bewegt = css.slice(start, ende);

  function regelIn(teil: string, kopf: string): string | null {
    const i = teil.indexOf(kopf);
    return i < 0 ? null : teil.slice(i, teil.indexOf("}", i) + 1);
  }

  it.each(["warten", "nachdenken", "zuhoeren", "sprechen", "ratlos", "freude", "fehler", "pause"])(
    "zurückhaltend · %s hat einen ruhigen statischen Ausdruck ohne Animation",
    (z) => {
      const r = regelIn(statisch, `.klara-figur[data-stil="zurueckhaltend"][data-zustand="${z}"]`);
      expect(r, z).not.toBeNull();
      expect(r).toMatch(/filter:|transform: rotate\(-?\d+deg\)/);
      expect(r).not.toMatch(/animation/);
    },
  );

  it("fehlende Quelle/Angabe: kaum gedimmt, im Bewegungsblock fragende Neigung statt Absinken", () => {
    expect(statisch).toContain('.klara-figur[data-fehlerart="quelle"][data-zustand="fehler"]');
    expect(statisch).toContain('.klara-figur[data-fehlerart="eingabe"][data-zustand="fehler"]');
    const r = regelIn(bewegt, '.klara-figur[data-fehlerart="quelle"][data-stil="expressiv"]');
    expect(r).toContain("kw-assistenz-neigen-klein");
    expect(r).not.toMatch(/absinken|huepfer/);
    expect(r).toMatch(/\[data-bewegung="reduziert"\]/);
  });
});

// ------------------------------------------------------------------------------------------------
// Die Vorschau in der echten Auswahl-Komponente.
// ------------------------------------------------------------------------------------------------
let wurzel: ReturnType<typeof createRoot> | null = null;
let behaelter: HTMLDivElement | null = null;

function q(testId: string): HTMLElement | null {
  return document.querySelector(`[data-testid="${testId}"]`);
}

function montiere(props: { bewegungReduziert?: boolean; onWahl?: (id: string) => void }): void {
  behaelter = document.createElement("div");
  document.body.appendChild(behaelter);
  wurzel = createRoot(behaelter);
  act(() => {
    wurzel?.render(
      createElement(AvatarAuswahl, {
        idBasis: "t",
        wert: "eule",
        onWahl: props.onWahl ?? (() => {}),
        fehler: null,
        bewegungReduziert: props.bewegungReduziert ?? false,
      }),
    );
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  act(() => wurzel?.unmount());
  behaelter?.remove();
  wurzel = null;
  behaelter = null;
});

function weiter(): void {
  act(() => {
    vi.advanceTimersByTime(VORSCHAU_SCHRITT_MS);
  });
}

describe("A5 · Vorschau aller neun Zustände für jedes der 13 Motive (K6/K1/K8)", () => {
  it("13 Startknöpfe, je mit zugänglichem Namen des Motivs", () => {
    montiere({});
    for (const m of ASSISTENZ_AVATAR_KATALOG) {
      const knopf = q(`assistenz-vorschau-start-${m.id}`);
      expect(knopf, m.id).not.toBeNull();
      expect(knopf?.getAttribute("type")).toBe("button");
      expect(knopf?.getAttribute("aria-label")).toContain(i18n.t(`assistenz.avatar.name.${m.id}`));
      // Der Knopf liegt NICHT in der Beschriftung des Radioknopfs — er wählt nichts.
      expect(knopf?.closest("label")).toBeNull();
    }
    expect(q("assistenz-zustandsvorschau")).toBeNull();
  });

  it.each(ASSISTENZ_AVATAR_KATALOG.map((m) => [m.id, m] as const))(
    "%s: neun Zustände nacheinander, als Vorschau erkennbar, ohne Wirkung auf Wahl und Figur",
    (id, motiv) => {
      const onWahl = vi.fn();
      montiere({ onWahl });
      const vorher = letztesErgebnis();
      act(() => q(`assistenz-vorschau-start-${id}`)?.click());
      const panel = q("assistenz-zustandsvorschau");
      expect(panel?.getAttribute("data-vorschau")).toBe("true");
      expect(panel?.getAttribute("data-avatar-vorschau")).toBe(id);
      expect(panel?.textContent).toContain("Vorschau:");
      expect(panel?.textContent).toContain("Nur eine Vorschau");
      expect(q(`assistenz-vorschau-start-${id}`)?.getAttribute("aria-pressed")).toBe("true");

      const gesehen: string[] = [];
      for (const [i, z] of ASSISTENZ_ZUSTAENDE.entries()) {
        const figur = q("assistenz-zustandsvorschau-figur");
        expect(figur?.getAttribute("data-zustand"), `${id} Schritt ${i + 1}`).toBe(z);
        expect(figur?.getAttribute("data-stil")).toBe(animationsStil(motiv));
        expect(figur?.classList.contains("klara-figur")).toBe(true);
        expect(figur?.querySelector(".klara-motiv")?.getAttribute("data-avatar")).toBe(id);
        // Mimik nur für Motive mit Gesicht — sachliche Objekte bleiben gesichtslos.
        const mimik = figur?.querySelector('[data-testid="klara-mimik"]') ?? null;
        expect(mimik !== null, `${id}: Mimik`).toBe(animationsStil(motiv) === "expressiv");
        if (mimik) {
          expect(mimik.getAttribute("data-zustand")).toBe(z);
        }
        const text = q("assistenz-zustandsvorschau-text")?.textContent ?? "";
        expect(text).toContain(`Vorschau ${i + 1} von 9`);
        expect(text).toContain(i18n.t(zustandsTextSchluessel(z)));
        expect(q("assistenz-zustandsvorschau-nurvorschau") !== null).toBe(z === "nachdenken");
        gesehen.push(z);
        weiter();
      }
      expect(gesehen).toEqual([...ASSISTENZ_ZUSTAENDE]);
      // Von selbst zu Ende — kurz, ohne Dauerschleife.
      expect(q("assistenz-zustandsvorschau")).toBeNull();
      expect(q("assistenz-zustandsvorschau-fertig")?.textContent).toContain(
        "nichts wurde geändert",
      );
      // Keine Wirkung: kein Motiv gewählt, kein Ergebnis an die Figur gemeldet.
      expect(onWahl).not.toHaveBeenCalled();
      expect(letztesErgebnis()).toBe(vorher);
      expect(ASSISTENZ_ZUSTAENDE.length * VORSCHAU_SCHRITT_MS).toBeLessThanOrEqual(12_000);
    },
  );

  it("schneller Wechsel zwischen zwei Motiven beginnt die Vorschau von vorn", () => {
    montiere({});
    act(() => q("assistenz-vorschau-start-prisma")?.click());
    weiter();
    weiter();
    expect(q("assistenz-zustandsvorschau-figur")?.getAttribute("data-zustand")).toBe("nachdenken");
    act(() => q("assistenz-vorschau-start-fuchs")?.click());
    expect(q("assistenz-zustandsvorschau")?.getAttribute("data-avatar-vorschau")).toBe("fuchs");
    expect(q("assistenz-zustandsvorschau-figur")?.getAttribute("data-zustand")).toBe("bereit");
    expect(q("assistenz-vorschau-start-prisma")?.getAttribute("aria-pressed")).toBe("false");
  });
});

describe("A6 · Tastatur und Sichtbarkeit (K6/K7/K8)", () => {
  it("Fokus auf „Vorschau beenden“; Escape beendet, Fokus zurück zum Startknopf", () => {
    montiere({});
    act(() => q("assistenz-vorschau-start-leuchtkreis")?.click());
    const beenden = q("assistenz-zustandsvorschau-beenden");
    expect(document.activeElement).toBe(beenden);
    act(() => {
      beenden?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(q("assistenz-zustandsvorschau")).toBeNull();
    expect(document.activeElement).toBe(q("assistenz-vorschau-start-leuchtkreis"));
  });

  it("Klick auf „Vorschau beenden“ beendet ebenso", () => {
    montiere({});
    act(() => q("assistenz-vorschau-start-original")?.click());
    act(() => q("assistenz-zustandsvorschau-beenden")?.click());
    expect(q("assistenz-zustandsvorschau")).toBeNull();
    expect(document.activeElement).toBe(q("assistenz-vorschau-start-original"));
  });

  it("endet die Vorschau von selbst, während der Fokus in ihr steht, geht der Fokus nicht verloren", () => {
    montiere({});
    act(() => q("assistenz-vorschau-start-monolith")?.click());
    for (const _ of ASSISTENZ_ZUSTAENDE) {
      weiter();
    }
    expect(document.activeElement).toBe(q("assistenz-vorschau-start-monolith"));
  });

  it("verborgene Seite: die Vorschau endet (keine unnötige Animation)", () => {
    montiere({});
    act(() => q("assistenz-vorschau-start-wolke")?.click());
    const setze = (wert: string): void => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => wert });
    };
    setze("hidden");
    try {
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      expect(q("assistenz-zustandsvorschau")).toBeNull();
    } finally {
      setze("visible");
    }
  });
});

describe("A7 · reduzierte Bewegung in der Vorschau (K5)", () => {
  it("eigene Wahl: still, mit Hinweis — der Textstatus bleibt", () => {
    montiere({ bewegungReduziert: true });
    act(() => q("assistenz-vorschau-start-roboter")?.click());
    const figur = q("assistenz-zustandsvorschau-figur");
    expect(figur?.getAttribute("data-bewegung")).toBe("reduziert");
    expect(figur?.querySelector('[data-testid="klara-mimik"]')?.getAttribute("data-bewegung")).toBe(
      "reduziert",
    );
    expect(q("assistenz-zustandsvorschau-ruhig")).not.toBeNull();
    expect(q("assistenz-zustandsvorschau-text")?.textContent).toContain("Bereit");
  });

  it("ohne Wahl und ohne Systemeinstellung: bewegt, ohne Hinweis", () => {
    montiere({});
    act(() => q("assistenz-vorschau-start-roboter")?.click());
    expect(q("assistenz-zustandsvorschau-figur")?.getAttribute("data-bewegung")).toBe("standard");
    expect(q("assistenz-zustandsvorschau-ruhig")).toBeNull();
  });
});

describe("A8 · die Figur nutzt Aktionskennung und Fehlerart (Quelle)", () => {
  const quelle = readFileSync(
    repoPfad("apps/web/src/components/klara-vorschau/KlaraVorschau.tsx"),
    "utf8",
  );
  const formular = readFileSync(
    repoPfad("apps/web/src/components/assistenz/AssistenzFormular.tsx"),
    "utf8",
  );
  it("Frageweg: beginneAktion vor der Anfrage, Ergebnis nur mit dieser Kennung", () => {
    expect(quelle).toContain("const aktion = beginneAktion();");
    expect(quelle).toContain("ausdruckNachFrage(stand, letzte ?? null)");
    expect(quelle).toMatch(/meldeErgebnis\(ausdruck\?\.art \?\? null, \{\s*aktion,/);
    expect(quelle).toContain("data-fehlerart={figurFehlerArt}");
    // Kein Ergebnis ohne Kennung mehr im Frageweg.
    expect(quelle).not.toMatch(/meldeErgebnis\(\s*stand ===/);
  });
  it("Speichern: Ergebnis an die Kennung gebunden; Feldprüfung ist ein Nutzerfehler", () => {
    expect(formular).toContain("const aktion = beginneAktion();");
    expect(formular).toContain('meldeErgebnis("freude", { aktion });');
    expect(formular).toContain('meldeErgebnis("fehler", { aktion, fehlerArt: "technisch" });');
    expect(formular).toContain('fehlerArt: "eingabe"');
  });
});
