// @vitest-environment jsdom
// ================================================================================================
// Aufnahme `gesamt-hilfen` · R-0935 / R-0924 — DIE HÄUFIGEN FRAGEN STEHEN AUF DER HILFESEITE,
// IN DE/EN/NL UND IN ANWENDERSPRACHE.
// ================================================================================================
//
// DER BEFUND (Quelltext am Basisstand 6f9e961b): die ausformulierten FAQ-Antworten
// (`lib/faqContent.ts`) hatten genau EINEN Leser — Klaras Suche. R-0935 verlangt neben den
// Themenkarten „eine Sammlung häufiger Fragen" in beiden Sprachen; R-0924 den Fragenkatalog je
// Seite und Funktion mit Antworten.
//
// NACHARBEIT 3 (Ben): die erste Fassung blendete `faqContent.ts` WÖRTLICH ein — mit Rollen- und
// Prüfbegriffen und nur auf Deutsch. Die Seite liest jetzt die Lesefassung `lib/hilfeFaq.ts`; die
// Wortwahl und die Rollenausnahme prüft `hilfe-faq-anwendersprache.test.ts` daneben.
//
// GEPRÜFT WIRD DIE ECHTE SEITE mit echtem Router und echtem i18n — ein DOM-freier Zwilling bliebe
// grün, wenn die Seite die Liste gar nicht zeichnet.
//
// GEGENPROBEN (je Fall genannt):
//   · FAQ-Block aus `Help.tsx` entfernen                         → S1, S2 rot
//   · wieder `faqContent.ts` wörtlich einblenden                  → S2 rot (andere Texte)
//   · Suche nicht auf die FAQ anwenden                            → S3 rot
//   · Nulltreffer nur an den Kapiteln entscheiden                 → S3 rot
//   · Rollenprüfung am Sprunglink weglassen                       → S5 rot
//   · EN/NL wieder ausblenden oder deutsch zeigen                 → S6 rot
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { type Role, routePathAllows } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
import { HILFE_FAQ } from "../../apps/web/src/lib/hilfeFaq";
import { Help } from "../../apps/web/src/pages/Help";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Dieselbe Rollenattrappe wie `tests/einstieg-gastweg/hilfe-fuehrt-den-gast-nicht-ins-leere.test.tsx`.
const rollenquelle = vi.hoisted(() => ({ rolle: "controller" as string }));

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({
    role: rollenquelle.rolle,
    setRole: () => {},
    stufe2: false,
    setStufe2: () => {},
    isSessionRole: true,
    canPreview: false,
    previewActive: false,
  }),
}));

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

async function hilfeMounten(rolle: Role, sprache: string): Promise<HTMLElement> {
  rollenquelle.rolle = rolle;
  await i18n.changeLanguage(sprache);
  const flaeche = document.createElement("div");
  document.body.appendChild(flaeche);
  container = flaeche;
  const wurzel = createRoot(flaeche);
  root = wurzel;
  await act(async () => {
    wurzel.render(createElement(MemoryRouter, { initialEntries: ["/hilfe"] }, createElement(Help)));
  });
  return flaeche;
}

async function abbauen(): Promise<void> {
  const wurzel = root;
  if (wurzel) {
    await act(async () => {
      wurzel.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
}

afterEach(async () => {
  await abbauen();
  await i18n.changeLanguage("de");
});

async function suche(flaeche: HTMLElement, text: string): Promise<void> {
  const feld = flaeche.querySelector<HTMLInputElement>('[data-testid="hilfe-suche"]');
  if (!feld) {
    throw new Error("Das Suchfeld der Hilfeseite fehlt.");
  }
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function faqEintraege(flaeche: HTMLElement): HTMLElement[] {
  return [...flaeche.querySelectorAll<HTMLElement>("[data-hilfe-faq]")];
}

function faqEintrag(flaeche: HTMLElement, id: string): HTMLElement {
  const eintrag = flaeche.querySelector<HTMLElement>(`[data-hilfe-faq="${id}"]`);
  if (!eintrag) {
    throw new Error(`FAQ-Eintrag fehlt auf der Hilfeseite: ${id}`);
  }
  return eintrag;
}

const SPRACHEN = ["de", "en", "nl"] as const;

describe("R-0935 / R-0924 · die Sammlung häufiger Fragen auf der Hilfeseite", () => {
  it("S1 · DE: die Sammlung steht da — mit Überschrift und JEDER Frage der Lesefassung", async () => {
    const flaeche = await hilfeMounten("controller", "de");
    const sammlung = flaeche.querySelector('[data-testid="hilfe-faq"]');
    expect(sammlung, "keine FAQ-Sammlung auf der Hilfeseite").not.toBeNull();
    expect(sammlung?.querySelector("h2")?.textContent).toBe(i18n.t("hilfefaq.titel"));
    expect(faqEintraege(flaeche).map((eintrag) => eintrag.dataset.hilfeFaq)).toEqual(
      HILFE_FAQ.map((faq) => faq.id),
    );
  });

  it.each(SPRACHEN)(
    "S2 · %s: jede Frage ist eine aufklappbare Zusammenfassung, darunter die Antwort der Lesefassung",
    async (sprache) => {
      const flaeche = await hilfeMounten("controller", sprache);
      for (const faq of HILFE_FAQ) {
        const eintrag = faqEintrag(flaeche, faq.id);
        expect(eintrag.querySelector("details > summary")?.textContent, faq.id).toBe(
          faq.frage[sprache],
        );
        expect(eintrag.querySelector("details > p")?.textContent, faq.id).toBe(
          faq.antwort[sprache],
        );
      }
    },
  );

  it("S3 · DE: dieselbe Suche filtert die Fragen; ein reiner FAQ-Treffer ist KEIN Nulltreffer", async () => {
    const flaeche = await hilfeMounten("controller", "de");
    const frage = HILFE_FAQ.find((faq) => faq.id === "faq.bibliothek.6");
    if (!frage) {
      throw new Error("FAQ faq.bibliothek.6 fehlt in der Lesefassung.");
    }
    await suche(flaeche, frage.frage.de);
    expect(faqEintraege(flaeche).map((eintrag) => eintrag.dataset.hilfeFaq)).toEqual([
      "faq.bibliothek.6",
    ]);
    // Die Frage steht in keinem Kapitel — die Kapitelliste ist leer, die Seite trotzdem nicht.
    expect(flaeche.querySelectorAll("[data-hilfe-thema]")).toHaveLength(0);
    expect(flaeche.querySelector('[data-testid="hilfe-nulltreffer"]')).toBeNull();
  });

  it("S4 · DE: findet weder Kapitel noch Frage etwas, steht der Nulltreffer und keine leere Sammlung", async () => {
    const flaeche = await hilfeMounten("controller", "de");
    await suche(flaeche, "zzqx-weder-kapitel-noch-frage");
    expect(faqEintraege(flaeche)).toHaveLength(0);
    expect(flaeche.querySelector('[data-testid="hilfe-faq"]')).toBeNull();
    expect(flaeche.querySelector('[data-testid="hilfe-nulltreffer"]')).not.toBeNull();
  });

  it("S5 · der Sprung in den Bereich folgt der Rolle — und zeigt nie auf /hilfe selbst", async () => {
    const gesehen: Record<string, Set<string>> = {};
    for (const rolle of ["viewer", "controller"] as const) {
      const flaeche = await hilfeMounten(rolle, "de");
      const mitLink = new Set<string>();
      for (const faq of HILFE_FAQ) {
        const link = faqEintrag(flaeche, faq.id).querySelector<HTMLAnchorElement>("a");
        const erwartet = faq.route !== "/hilfe" && routePathAllows(faq.route, rolle);
        expect(link !== null, `${rolle} ${faq.id} → ${faq.route}`).toBe(erwartet);
        if (link) {
          expect(link.getAttribute("href"), faq.id).toBe(faq.route);
          expect(link.textContent, faq.id).toContain(i18n.t("help.openRoute"));
          mitLink.add(faq.id);
        }
      }
      gesehen[rolle] = mitLink;
      await abbauen();
    }
    // Gerechnet, nicht verdrahtet: dieselbe Liste, zwei Rollen, zwei verschiedene Linkmengen.
    expect(gesehen.controller?.has("faq.pruefen.1")).toBe(true);
    expect(gesehen.viewer?.has("faq.pruefen.1")).toBe(false);
  });

  it.each(["en", "nl"] as const)(
    "S6 · %s: die Sammlung steht in der Sprache der Oberfläche da — kein deutscher Rückfall",
    async (sprache) => {
      const flaeche = await hilfeMounten("controller", sprache);
      const sammlung = flaeche.querySelector('[data-testid="hilfe-faq"]');
      expect(sammlung, "keine FAQ-Sammlung in dieser Sprache").not.toBeNull();
      expect(sammlung?.querySelector("h2")?.textContent).toBe(i18n.t("hilfefaq.titel"));
      expect(i18n.t("hilfefaq.titel")).not.toBe(i18n.getFixedT("de")("hilfefaq.titel"));
      expect(faqEintraege(flaeche)).toHaveLength(HILFE_FAQ.length);
      for (const faq of HILFE_FAQ) {
        expect(faq.frage[sprache], `${faq.id}: Frage nicht übersetzt`).not.toBe(faq.frage.de);
        expect(faq.antwort[sprache], `${faq.id}: Antwort nicht übersetzt`).not.toBe(faq.antwort.de);
      }
      // Die Suche läuft in der Sprache der Oberfläche über die übersetzte Frage.
      const frage = HILFE_FAQ.find((faq) => faq.id === "faq.bibliothek.6");
      if (!frage) {
        throw new Error("FAQ faq.bibliothek.6 fehlt in der Lesefassung.");
      }
      await suche(flaeche, frage.frage[sprache]);
      expect(faqEintraege(flaeche).map((eintrag) => eintrag.dataset.hilfeFaq)).toEqual([
        "faq.bibliothek.6",
      ]);
    },
  );
});
