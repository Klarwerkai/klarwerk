// @vitest-environment jsdom
// ================================================================================================
// Aufnahme `gesamt-hilfen` · R-0890 — JEDE FUNKTION HAT IHREN ARTIKEL NACH FESTEM BAUPLAN.
// ================================================================================================
//
// DER ORIGINALWORTLAUT: „Eine gegliederte Bibliothek erklärt jede Funktion nach festem Bauplan: was
// es ist, wie es funktioniert, warum es so gebaut ist, was danach passiert und welche typischen
// Missverständnisse es gibt."
//
// BENS BEFUND (Nacharbeit 3): „Die Bibliotheksartikel nach dem Fünf-Teil-Bauplan … fehlen
// weiterhin." Geliefert sind sie in `lib/hilfeBibliothek.ts`; dieser Fall hält fest:
//   B1 · jede Funktion (= jedes Hilfekapitel, `HELP_TOPICS`) hat einen Artikel mit allen fünf
//        Teilen in DE, EN und NL — übersetzt, nicht deutsch zurückgefallen;
//   B2 · es gibt keinen Artikel ohne Funktion;
//   B3 · die Artikel sprechen Anwendersprache (dieselbe Wortwahl wie die FAQ der Hilfeseite);
//   B4 · die ECHTE Hilfeseite zeigt den Artikel zugeklappt unter jeder Kapitelkarte, die fünf Teile
//        in der Reihenfolge des Bauplans und mit ihren Überschriften.
//
// GEGENPROBEN: einen Teil eines Artikels leeren → B1 rot; einen Artikel entfernen → B1/B4 rot;
// „Admins" in einen Teil schreiben → B3 rot; den Aufklapper aus `Help.tsx` nehmen → B4 rot.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import { HELP_TOPICS } from "../../apps/web/src/lib/helpTopics";
import { ISO_HELP_TOPICS } from "../../apps/web/src/lib/helpTopics.iso";
import { BIBLIOTHEK_TEILE, HILFE_BIBLIOTHEK } from "../../apps/web/src/lib/hilfeBibliothek";
import { Help } from "../../apps/web/src/pages/Help";
import { SPRACHEN, funde } from "../hilfe-faq-sammlung/wortwahl";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({
    role: "controller",
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

afterEach(async () => {
  const wurzel = root;
  if (wurzel) {
    await act(async () => {
      wurzel.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
  await i18n.changeLanguage("de");
});

async function hilfeMounten(sprache: string): Promise<HTMLElement> {
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

describe("R-0890 · die Anwender-Wissensbibliothek nach festem Bauplan", () => {
  it("B1 · jede Funktion hat einen Artikel mit allen fünf Teilen in DE, EN und NL", () => {
    expect(BIBLIOTHEK_TEILE).toEqual(["was", "wie", "warum", "danach", "missverstaendnisse"]);
    const fehlt: string[] = [];
    for (const kapitel of HELP_TOPICS) {
      const artikel = HILFE_BIBLIOTHEK[kapitel.id];
      if (!artikel) {
        fehlt.push(`${kapitel.id}: kein Artikel`);
        continue;
      }
      for (const teil of BIBLIOTHEK_TEILE) {
        const text = artikel[teil];
        for (const sprache of SPRACHEN) {
          if ((text?.[sprache] ?? "").trim().length < 20) {
            fehlt.push(`${kapitel.id} · ${teil} · ${sprache}: leer oder zu kurz`);
          }
        }
        if (text && (text.en === text.de || text.nl === text.de)) {
          fehlt.push(`${kapitel.id} · ${teil}: nicht übersetzt`);
        }
      }
    }
    expect(fehlt).toEqual([]);
  });

  it("B2 · kein Artikel ohne Funktion", () => {
    const kapitel = new Set(HELP_TOPICS.map((eintrag) => eintrag.id));
    expect(Object.keys(HILFE_BIBLIOTHEK).filter((id) => !kapitel.has(id))).toEqual([]);
  });

  it("B3 · die Artikel sprechen Anwendersprache — ohne Rollen-, Prüf- oder Pilotbegriffe", () => {
    const gefunden: string[] = [];
    for (const [id, artikel] of Object.entries(HILFE_BIBLIOTHEK)) {
      for (const teil of BIBLIOTHEK_TEILE) {
        for (const sprache of SPRACHEN) {
          for (const fund of funde(artikel[teil][sprache], sprache, false)) {
            gefunden.push(`${id} · ${teil} · ${sprache}: ${fund}`);
          }
        }
      }
    }
    expect(gefunden).toEqual([]);
  });

  it.each(SPRACHEN)("B4 · %s: Artikel zugeklappt unter jeder Karte", async (sprache) => {
    const flaeche = await hilfeMounten(sprache);
    const aufklapper = i18n.t("hilfebibliothek.oeffnen");
    for (const kapitel of HELP_TOPICS) {
      const karte = flaeche.querySelector(`[data-hilfe-thema="${kapitel.id}"]`);
      expect(karte, `${kapitel.id}: Kapitelkarte fehlt`).not.toBeNull();
      const auswahl = `details[data-hilfe-artikel="${kapitel.id}"]`;
      const artikel = karte?.querySelector<HTMLDetailsElement>(auswahl);
      expect(artikel, `${kapitel.id}: Artikel fehlt auf der Karte`).not.toBeNull();
      expect(artikel?.open, `${kapitel.id}: Artikel steht offen`).toBe(false);
      expect(artikel?.querySelector("summary")?.textContent).toBe(aufklapper);
      const knoten = artikel?.querySelectorAll<HTMLElement>("dd[data-hilfe-artikel-teil]");
      const teile = [...(knoten ?? [])];
      expect(teile.map((dd) => dd.dataset.hilfeArtikelTeil)).toEqual([...BIBLIOTHEK_TEILE]);
      const quelle = HILFE_BIBLIOTHEK[kapitel.id];
      for (const dd of teile) {
        const teil = dd.dataset.hilfeArtikelTeil as (typeof BIBLIOTHEK_TEILE)[number];
        const ueberschrift = i18n.t(`hilfebibliothek.teil.${teil}`);
        expect(dd.textContent, `${kapitel.id} · ${teil}`).toBe(quelle?.[teil][sprache]);
        expect(dd.previousElementSibling?.textContent).toBe(ueberschrift);
      }
    }
    // Die ISO-Kapitel sind keine Funktion der Anwendung und tragen keinen Artikel.
    for (const iso of ISO_HELP_TOPICS) {
      const karte = flaeche.querySelector(`[data-hilfe-thema="${iso.id}"]`);
      expect(karte?.querySelector("details[data-hilfe-artikel]") ?? null).toBeNull();
    }
  });
});
