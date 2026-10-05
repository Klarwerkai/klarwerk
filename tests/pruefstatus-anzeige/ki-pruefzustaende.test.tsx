// @vitest-environment jsdom
// ================================================================================================
// PRÜFSTATUS-ANZEIGE (R-0208, Ben R2 BEN-03) · DIE SICHTBAREN ZUSTÄNDE DER KI-PRÜFUNG.
// ================================================================================================
//
// Zielzustand: „Ein Eintrag kann von der KI geprüft sein, ohne freigegeben zu sein. Sichtbare
// Zustände sind: Prüfung ausstehend, läuft, geprüft, Konflikt gefunden, unsicher, KI nicht
// verfügbar, fehlgeschlagen. Der Begriff ‚KI validiert' wird bewusst vermieden; in der
// Validierungsansicht erscheinen dafür eigene Kennzeichen."
//
// Teil A prüft die reine Ableitung, Teil B das montierte Kennzeichen der Prüfseite (`AiCheckBadge`).
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { AiCheckBadge } from "../../apps/web/src/components/AiCheckBadge";
import i18n from "../../apps/web/src/i18n";
import { type KiPruefzustand, kiPruefzustand } from "../../apps/web/src/lib/aiCheckStatusCard";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Vermerk = NonNullable<KnowledgeObject["aiCheck"]>;

const ZEIT = { requestedAt: "2026-10-03T08:00:00.000Z", finishedAt: "2026-10-03T08:01:00.000Z" };
const GEDECKELT = {
  available: 120,
  selected: 20,
  alreadyOpen: 0,
  attempted: 20,
  completed: 20,
  skipped: 0,
  capped: true,
  aborted: false,
};

/** Je sichtbarem Zustand ein Vermerk, wie das Prüfbrett ihn liefert. */
const FAELLE: ReadonlyArray<[KiPruefzustand, Vermerk]> = [
  ["ausstehend", { status: "pending", requestedAt: ZEIT.requestedAt, laeuft: false }],
  ["laeuft", { status: "pending", requestedAt: ZEIT.requestedAt, laeuft: true }],
  ["geprueft", { status: "done", ...ZEIT, konfliktGefunden: false }],
  ["konflikt", { status: "done", ...ZEIT, konfliktGefunden: true }],
  ["unsicher", { status: "done", ...ZEIT, coverage: GEDECKELT }],
  ["nicht_verfuegbar", { status: "failed", ...ZEIT, fallbackReason: "no-model" }],
  ["fehlgeschlagen", { status: "failed", ...ZEIT, fallbackReason: "model-error" }],
];

describe("A · kiPruefzustand — die Ableitung", () => {
  it.each(FAELLE)("%s", (erwartet, vermerk) => {
    expect(kiPruefzustand(vermerk)).toBe(erwartet);
  });

  it("KI nicht verfügbar: genau die Ursachen, bei denen keine KI zur Verfügung stand", () => {
    for (const grund of ["no-model", "confidential", "privacy-no-cloud", "auth", "unreachable"]) {
      expect(kiPruefzustand({ status: "failed", ...ZEIT, fallbackReason: grund }), grund).toBe(
        "nicht_verfuegbar",
      );
    }
    for (const grund of ["model-error", "timeout", "model-timeout", "queue-overflow", undefined]) {
      expect(
        kiPruefzustand({ status: "failed", ...ZEIT, ...(grund ? { fallbackReason: grund } : {}) }),
        String(grund),
      ).toBe("fehlgeschlagen");
    }
  });

  it("ohne Laufauskunft bleibt ein eingereihter Job beim bisherigen „läuft“; überholt geht vor", () => {
    expect(kiPruefzustand({ status: "pending", requestedAt: ZEIT.requestedAt })).toBe("laeuft");
    expect(
      kiPruefzustand({ status: "done", ...ZEIT, ueberholt: true, konfliktGefunden: true }),
    ).toBe("ueberholt");
    expect(kiPruefzustand(undefined)).toBeNull();
  });

  it("ein Konflikt geht der Teilprüfung vor — er ist das Ergebnis, das den Leser angeht", () => {
    expect(
      kiPruefzustand({ status: "done", ...ZEIT, coverage: GEDECKELT, konfliktGefunden: true }),
    ).toBe("konflikt");
  });
});

// ------------------------------------------------------------------------------------------------
// B · DAS KENNZEICHEN AUF DER PRÜFSEITE
// ------------------------------------------------------------------------------------------------

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | undefined;

function mount(aiCheck: Vermerk, modelActive = true): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  const neu = createRoot(container);
  root = neu;
  act(() => {
    neu.render(createElement(AiCheckBadge, { aiCheck, onRetry: () => {}, modelActive }));
  });
}

afterEach(() => {
  // Teil A montiert nichts — dann gibt es auch nichts abzubauen.
  if (root) {
    act(() => {
      root?.unmount();
    });
    container.remove();
    root = undefined;
  }
});

describe("B · AiCheckBadge — sieben sichtbare, unterscheidbare Kennzeichen", () => {
  it.each(FAELLE)("%s: eigenes Kennzeichen mit Text, nie „validiert“", (zustand, vermerk) => {
    mount(vermerk);
    const kennzeichen = container.querySelector(`[data-ki-pruefzustand="${zustand}"]`);
    expect(kennzeichen, `kein Kennzeichen für ${zustand}`).not.toBeNull();
    expect((kennzeichen?.textContent ?? "").trim()).not.toBe("");
    expect(container.textContent ?? "").not.toMatch(/validiert/i);
  });

  it("die sichtbaren Texte der sieben Zustände sind paarweise verschieden (DE, EN, NL)", async () => {
    for (const sprache of ["de", "en", "nl"]) {
      await act(async () => {
        await i18n.changeLanguage(sprache);
      });
      const texte = new Set<string>();
      for (const [zustand, vermerk] of FAELLE) {
        mount(vermerk);
        const kennzeichen = container.querySelector(`[data-ki-pruefzustand="${zustand}"]`);
        // Bei „läuft" und „ausstehend" steht nur die Pille; bei den Fehlschlägen die erste Pille.
        const pille = kennzeichen?.matches("span[title]")
          ? kennzeichen
          : kennzeichen?.querySelector("span[title]");
        texte.add((pille?.textContent ?? "").trim());
        act(() => {
          root?.unmount();
        });
        container.remove();
        root = undefined;
      }
      expect(texte.size, `${sprache}: Zustände fallen sprachlich zusammen`).toBe(FAELLE.length);
    }
    await act(async () => {
      await i18n.changeLanguage("de");
    });
  });

  it("geprüft sagt ausdrücklich: keine Freigabe", () => {
    mount({ status: "done", ...ZEIT, konfliktGefunden: false });
    const pille = container.querySelector('[data-ki-pruefzustand="geprueft"]');
    expect(pille?.textContent).toContain("keine Freigabe");
    expect(pille?.getAttribute("title")).toContain("keine menschliche Freigabe");
  });

  it("Gegenprobe ohne Modell: „geprüft“ ohne „KI-“, „ausstehend“ ebenso", () => {
    mount({ status: "done", ...ZEIT }, false);
    expect(container.textContent).toBe("Geprüft – keine Freigabe");
    act(() => {
      root?.unmount();
    });
    container.remove();
    mount({ status: "pending", requestedAt: ZEIT.requestedAt, laeuft: false }, false);
    expect(container.textContent).toBe("Prüfung ausstehend");
  });
});
