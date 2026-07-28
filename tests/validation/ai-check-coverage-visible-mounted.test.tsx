// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega28 A2 / mega29 B3+B4 — WO GENAU EIN MENSCH SIEHT, DASS GEDECKELT WURDE.
// ================================================================================================
//
// Der Deckel allein wäre eine Lüge. Diese Datei pinnt die Stelle, an der er sich ZEIGT: dieselbe
// Anzeige, an der ein Prüfer das Urteil des Laufs liest (Validierungs-Badge). Belegt wird beides —
// dass ein gedeckelter Lauf sich NICHT wie ein vollständiger liest, UND dass ein wirklich
// vollständiger Lauf weiterhin schweigt (sonst wäre der Hinweis nur Rauschen).
//
// mega29 B3: die zusammengefasste Zahl ist eine MINDESTABDECKUNG (mergeCoverage nimmt je Weg das
// Minimum) — der Text muss sie auch so benennen, statt sie als tatsächliche Paarzahl auszugeben.
// mega29 B4: bis mega28 gewann der Abbruchtext VOR dem Übersprungen-Text, und aufgetretene
// Übersprünge verschwanden für den Leser. Beides muss nebeneinander sichtbar bleiben.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { AiCheckBadge } from "../../apps/web/src/components/AiCheckBadge";
import i18n from "../../apps/web/src/i18n";
import {
  AI_CHECK_COVERAGE_TEXT,
  aiCheckCoverageNote,
  aiCheckCoverageNoteKeys,
  aiCheckFailureReasonKey,
} from "../../apps/web/src/lib/aiCheckStatusCard";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(props: Parameters<typeof AiCheckBadge>[0]): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(AiCheckBadge, props));
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

const text = (lang: string, key: string): string =>
  String(i18n.getResource(lang, "translation", key));

const CAPPED = {
  available: 12479,
  selected: 20,
  alreadyOpen: 0,
  attempted: 20,
  completed: 20,
  skipped: 0,
  capped: true,
  aborted: false,
};
const COMPLETE = {
  available: 12,
  selected: 12,
  alreadyOpen: 0,
  attempted: 12,
  completed: 12,
  skipped: 0,
  capped: false,
  aborted: false,
};

describe("mega28 A2 · der gedeckelte Lauf zeigt sich dort, wo das Urteil gelesen wird", () => {
  it("done + gedeckelt → die Anzeige nennt geprüfte UND verfügbare Menge (nicht mehr stumm)", () => {
    mount({
      aiCheck: {
        status: "done",
        requestedAt: "2026-07-26T06:00:00.000Z",
        finishedAt: "2026-07-26T06:01:00.000Z",
        coverage: CAPPED,
      },
      onRetry: () => {},
    });
    // Vor mega28 war hier NICHTS im DOM — ein gegen 20 von 12.479 geprüfter Lauf sah aus wie ein
    // vollständiger.
    expect(container.innerHTML).not.toBe("");
    const pill = container.querySelector("span[title]");
    const tip = pill?.getAttribute("title") ?? "";
    expect(tip).toContain("20");
    expect(tip).toContain("12479");
    // Und der Text sagt ausdrücklich, was ein leeres Ergebnis NICHT heißt.
    expect(tip).toContain("Konflikten und Duplikaten");
    // mega29 B3: die Zahl stammt aus mergeCoverage (Minimum beider Wege) — sie darf nicht als
    // tatsächliche Gesamtzahl geprüfter Paare auftreten, sondern nur als Mindestabdeckung.
    expect(tip).toContain("mindestens");
  });

  it("done + vollständig → weiterhin NICHTS (der Hinweis ist kein Dauerrauschen)", () => {
    mount({
      aiCheck: {
        status: "done",
        requestedAt: "2026-07-26T06:00:00.000Z",
        finishedAt: "2026-07-26T06:01:00.000Z",
        coverage: COMPLETE,
      },
      onRetry: () => {},
    });
    expect(container.innerHTML).toBe("");
  });

  it("Altbestand ohne Abdeckung → NICHTS behauptet, in keine Richtung", () => {
    mount({
      aiCheck: { status: "done", requestedAt: "2026-07-26T06:00:00.000Z" },
      onRetry: () => {},
    });
    expect(container.innerHTML).toBe("");
    expect(aiCheckCoverageNote(undefined)).toBeNull();
  });

  it("failed + abgebrochen → Ursache UND Abbruch-Stand stehen nebeneinander", () => {
    mount({
      aiCheck: {
        status: "failed",
        requestedAt: "2026-07-26T06:00:00.000Z",
        fallbackReason: "model-error",
        coverage: {
          available: 500,
          selected: 8,
          alreadyOpen: 0,
          attempted: 8,
          completed: 7,
          skipped: 0,
          capped: true,
          aborted: true,
        },
      },
      onRetry: () => {},
    });
    const tips = [...container.querySelectorAll("span[title]")].map((s) => s.getAttribute("title"));
    expect(tips).toContain(text("de", "val.aiCheck.reason.model-error"));
    expect(tips.some((t) => t?.includes("7") && t?.includes("500"))).toBe(true);
  });

  it("mega29 B4 · Abbruch UND Übersprünge stehen NEBENEINANDER (vorher verschwand einer davon)", () => {
    const mixed = { ...CAPPED, completed: 5, skipped: 3, aborted: true };
    const note = aiCheckCoverageNote(mixed);
    expect(note).not.toBeNull();
    // Bis mega28 lieferte die Ableitung EINE Art, und der Abbruch gewann — die drei bereits
    // aufgetretenen Übersprünge waren für den Leser weg.
    expect(note?.limits).toEqual(["aborted", "skipped"]);

    mount({
      aiCheck: {
        status: "failed",
        requestedAt: "2026-07-26T06:00:00.000Z",
        fallbackReason: "model-error",
        coverage: mixed,
      },
      onRetry: () => {},
    });
    const tips = [...container.querySelectorAll("span[title]")]
      .map((s) => s.getAttribute("title") ?? "")
      .join(" ");
    // BEIDE Sätze erreichen den Leser: der Abbruch und die Zahl der ausgelassenen Vergleiche.
    expect(tips).toContain("Abgebrochen");
    expect(tips).toContain("3");
    expect(tips).toContain("ausgelassen");
  });

  it("die Ableitung unterscheidet die drei Unvollständigkeiten sauber", () => {
    expect(aiCheckCoverageNote(CAPPED)?.limits).toEqual(["capped"]);
    expect(aiCheckCoverageNote(COMPLETE)).toBeNull();
    expect(aiCheckCoverageNote({ ...COMPLETE, skipped: 2 })?.limits).toEqual(["skipped"]);
    // „gedeckelt" tritt nur allein auf — Abbruch und Übersprung sagen die Unvollständigkeit bereits
    // schärfer, ein dritter Satz daneben wäre nur Rauschen.
    expect(aiCheckCoverageNote({ ...CAPPED, aborted: true })?.limits).toEqual(["aborted"]);
    expect(aiCheckCoverageNoteKeys({ limits: ["aborted", "skipped"] })).toEqual([
      AI_CHECK_COVERAGE_TEXT.aborted,
      AI_CHECK_COVERAGE_TEXT.skipped,
    ]);
    // Der Kapazitätsabbruch bleibt eine benennbare Ursache (Altbestand-Werte am KO).
    expect(aiCheckFailureReasonKey("capacity")).toBe("val.aiCheck.reason.capacity");
  });

  it("die neuen Texte sind in DE/EN/NL vorhanden und tragen die richtigen Platzhalter", () => {
    const keys = [
      ...Object.values(AI_CHECK_COVERAGE_TEXT),
      "val.aiCheck.coverage.partial",
      "val.aiCheck.reason.capacity",
    ];
    for (const lang of ["de", "en", "nl"]) {
      for (const key of keys) {
        const value = text(lang, key);
        expect(value, `${lang}/${key}`).toBeTruthy();
        expect(value, `${lang}/${key}`).not.toBe("undefined");
      }
      for (const key of Object.values(AI_CHECK_COVERAGE_TEXT)) {
        // mega29 B1: die sichtbare Zahl ist `completed` (fehlerfrei zu Ende verglichen) — NICHT
        // mehr die Vorab-Auswahl, die die Oberfläche bis mega28 als „geprüft" ausgab.
        expect(text(lang, key), `${lang}/${key}`).toContain("{{completed}}");
        expect(text(lang, key), `${lang}/${key}`).toContain("{{available}}");
      }
      // Nur der Übersprung-Satz nennt die Zahl der ausgelassenen Vergleiche.
      expect(text(lang, AI_CHECK_COVERAGE_TEXT.skipped)).toContain("{{skipped}}");
    }
  });
});
