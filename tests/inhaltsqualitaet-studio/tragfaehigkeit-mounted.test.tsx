// @vitest-environment jsdom
// ================================================================================================
// R-0936 · INHALTSQUALITÄT IM STUDIO — die Tragfähigkeitsanzeige, gemountet im ECHTEN Studio.
// ================================================================================================
//
// Originalsatz: „Eine ruhige Anzeige sagt, wie tragfähig der Text gerade ist und was ihn besser
// machen würde — ohne Punkte und ohne Wertung der Person." (Altbestand F-0936: „Ausdrücklich kein
// Punktestand und keine Gamification.")
//
// Die Anzeige ist SCRUM-353 (`StudioContributionPanel`); neu ist nur, dass Titel, Stand und
// Schlussnote den TEXT beschreiben statt die Person anzusprechen (`texte/tragfaehigkeit.ts`).
// Gemessen wird deshalb dreierlei:
//   T1–T3 · im gemounteten `KnowledgeInputStudio`: der Stand passt zum Text (leer/Entwurf/solide),
//           und bei einem Entwurf stehen die Verbesserungshinweise da.
//   T4    · in der Anzeige steht keine Zahl und keiner der alten, personbezogenen Sätze.
//   T5    · jeder Satz, den die Anzeige zeigen kann, liegt in DE/EN/NL vor — ohne Ziffer, ohne
//           Anrede der Person und ohne Lob der Person.
// Erwartete Texte kommen aus dem Katalog (`i18n`), nicht abgeschrieben.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { KnowledgeInputStudio } from "../../apps/web/src/components/KnowledgeInputStudio";
import i18n from "../../apps/web/src/i18n";
import type { AttachmentLike } from "../../apps/web/src/lib/editorAttachmentContext";
import { editorContentQuality } from "../../apps/web/src/lib/editorContentQuality";
import { studioContribution } from "../../apps/web/src/lib/knowledgeStudioGuide";
import { mitBildbeschreibung } from "../capture/bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom kennt `scrollIntoView` nicht; das Studio ruft es über seine Gliederungsleiste.
Element.prototype.scrollIntoView = function scrollIntoViewStub(): void {};

const DUENN = "<p>kurz</p>";
const SOLIDE =
  "<h2>Vorgehen</h2><p>Hier steht ausreichend ausführlicher Erfahrungstext, der die Lage gut und nachvollziehbar beschreibt.</p>" +
  "<ul><li>Schritt eins</li><li>Schritt zwei</li></ul>" +
  '<div class="panel panel-info"><p>Wichtiger Hinweis</p></div>';
// Löst JEDE mögliche Stärke aus (Text, Überschrift, Liste, Block, Link, Anhang).
const ALLE_STAERKEN = `${SOLIDE}<p>Siehe <a href="/x">Quelle</a> und das angehängte Bild.</p>`;
const BILD: readonly AttachmentLike[] = [{ mime: "image/png" }];

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** Das ECHTE Studio, offen im Bearbeiten-View — Kontexte wie in `d44-knowledge-input-studio-mounted`. */
function studioMounten(bodyHtml: string): HTMLElement {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              MemoryRouter,
              { initialEntries: ["/erfassen"] },
              mitBildbeschreibung(
                createElement(KnowledgeInputStudio, {
                  open: true,
                  onClose: () => undefined,
                  bodyHtml,
                  onApply: () => undefined,
                  runAssist: async () => "",
                  documentTitle: "Wartungsnotiz",
                }),
              ),
            ),
          ),
        ),
      ),
    );
  });
  const anzeige = container.querySelector<HTMLElement>('[data-testid="studio-tragfaehigkeit"]');
  if (anzeige === null) {
    throw new Error("die Tragfähigkeitsanzeige steht nicht im Studio");
  }
  return anzeige;
}

function text(el: HTMLElement): string {
  return el.textContent ?? "";
}

describe("R-0936 · die Tragfähigkeitsanzeige im gemounteten Studio", () => {
  it("T1 · leerer Entwurf: Stand „noch kein Text“, keine Hinweisliste", () => {
    const anzeige = studioMounten("");
    expect(anzeige.dataset.level).toBe("empty");
    expect(text(anzeige)).toContain(i18n.t("tragfaehigkeit.titel"));
    expect(text(anzeige)).toContain(i18n.t("tragfaehigkeit.stand.empty"));
    expect(text(anzeige)).not.toContain(i18n.t("studio.contrib.suggestionsTitle"));
  });

  it("T2 · dünner Entwurf: Stand „trägt erst in Teilen“ und Hinweise zum Besserwerden", () => {
    const anzeige = studioMounten(DUENN);
    expect(anzeige.dataset.level).toBe("draft");
    expect(text(anzeige)).toContain(i18n.t("tragfaehigkeit.stand.draft"));
    expect(text(anzeige)).toContain(i18n.t("studio.contrib.suggestionsTitle"));
    for (const schluessel of [
      "studio.contrib.suggestion.detail",
      "studio.contrib.suggestion.headings",
      "studio.contrib.suggestion.steps",
    ]) {
      expect(text(anzeige), schluessel).toContain(i18n.t(schluessel));
    }
  });

  it("T3 · gegliederter Text: Stand „trägt“", () => {
    const anzeige = studioMounten(SOLIDE);
    expect(anzeige.dataset.level).toBe("solid");
    expect(text(anzeige)).toContain(i18n.t("tragfaehigkeit.stand.solid"));
  });

  it("T4 · keine Zahl und keiner der alten personbezogenen Sätze in der Anzeige", () => {
    const alt = [
      "studio.contrib.title",
      "studio.contrib.level.empty.hint",
      "studio.contrib.level.draft.hint",
      "studio.contrib.level.solid.hint",
      "studio.contrib.valueNote",
    ].map((schluessel) => i18n.t(schluessel));
    for (const body of ["", DUENN, SOLIDE]) {
      const anzeige = studioMounten(body);
      expect(text(anzeige), `Ziffer in der Anzeige (${body || "leer"})`).not.toMatch(/[0-9%]/);
      for (const satz of alt) {
        expect(text(anzeige), `alter Satz sichtbar: ${satz}`).not.toContain(satz);
      }
      expect(text(anzeige)).toContain(i18n.t("tragfaehigkeit.textNichtPerson"));
    }
  });
});

// Anrede der Person bzw. Lob der Person — je Sprache. Bewusst eng: Wörter, keine Wortteile.
const PERSON: Record<"de" | "en" | "nl", RegExp> = {
  de: /\b(du|dein\w*|dich|dir)\b|guter anfang|gut gemacht/i,
  en: /\b(you|your|yours)\b|good start|well done|great job/i,
  nl: /\b(je|jij|jouw|u|uw)\b|goed begin|goed gedaan/i,
};

describe("R-0936 · jeder Satz der Anzeige: Text statt Person, ohne Punkte (DE/EN/NL)", () => {
  it("T5 · alle anzeigbaren Sätze: vorhanden, ohne Ziffer, ohne Anrede/Lob", () => {
    const leer = studioContribution(editorContentQuality({ bodyHtml: "" }));
    const entwurf = studioContribution(
      editorContentQuality({ bodyHtml: DUENN, attachments: BILD }),
    );
    const voll = studioContribution(
      editorContentQuality({ bodyHtml: ALLE_STAERKEN, attachments: BILD }),
    );
    // Gegenprobe der Auswahl: sonst prüfte T5 weniger Sätze, als die Anzeige zeigen kann.
    expect(entwurf.suggestions.map((s) => s.id)).toEqual([
      "detail",
      "headings",
      "steps",
      "referenceAttachments",
    ]);
    expect(voll.strengths).toHaveLength(6);

    const schluessel = new Set<string>([
      "tragfaehigkeit.titel",
      "tragfaehigkeit.textNichtPerson",
      "studio.contrib.strengthsTitle",
      "studio.contrib.suggestionsTitle",
      ...[leer, entwurf, voll].flatMap((c) => [c.levelLabelKey, c.levelHintKey]),
      ...[...entwurf.suggestions, ...voll.strengths].map((item) => item.labelKey),
    ]);
    for (const sprache of ["de", "en", "nl"] as const) {
      for (const key of schluessel) {
        const satz = String(i18n.getResource(sprache, "translation", key) ?? "");
        expect(satz.length, `${sprache}: ${key} fehlt`).toBeGreaterThan(0);
        expect(satz, `${sprache}: ${key} enthält eine Zahl`).not.toMatch(/[0-9%]/);
        expect(satz, `${sprache}: ${key} spricht die Person an oder lobt sie`).not.toMatch(
          PERSON[sprache],
        );
      }
    }
  });
});
