// @vitest-environment jsdom
// ================================================================================================
// JOB 4203 · D3 · RUNDE 2 / T9 — DIE ABWEISUNG WIRD ANGESAGT. GEMOUNTET GEMESSEN.
// ================================================================================================
//
// DER BEFUND, GEGEN DEN DIESE DATEI STEHT, stammt vom Prüfer und ist am gebauten Produkt gemessen:
// „Nach sichtbarer Abweisung der `.bin`-Datei sind ALLE Live-Regionen leer." Die Meldung lief über
// `Capture.setErr` und wurde als gewöhnliches `<div>` gezeichnet — sichtbar, aber für eine
// Vorlesehilfe nicht vorhanden. Der Auftrag verlangt das Gegenteil (§5.7: „verständliche Meldung in
// der Live-Region, `CaptureFileImport.tsx:176-180`").
//
// WARUM DIESER FALL NEBEN `abweisung-erhaelt-entwurf-chromium.test.ts` STEHT und ihn nicht ersetzt:
// der Bedienwegnachweis misst die Zusage dort, wo ein Mensch sie erlebt — er braucht aber ein
// gebautes `dist` und einen Chromium, also den vollen Torlauf. Diese Datei misst DIESELBE Zusage an
// der ECHTEN Produktionskomponente in wenigen Millisekunden. Das ist kein zweiter Nachweis
// derselben Sache aus Bequemlichkeit, sondern der Preis dafür, dass die Zusage eine bezahlbare
// GEGENPROBE hat: wer `importMeldung` aus dem Träger entfernt, sieht es hier sofort.
//
// GEMOUNTET WIRD DIE ECHTE KOMPONENTE, nicht ein Nachbau — dieselbe Bauform wie
// `tests/app/capture-file-type-seam.test.tsx:44-60`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { CaptureFileImport } from "../../apps/web/src/components/CaptureFileImport";
import i18n from "../../apps/web/src/i18n";
import { CAPTURE_FILE_TEXT } from "../../apps/web/src/lib/captureFromFile";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Die Marken, an denen eine Vorlesehilfe eine Live-Region erkennt. `<output>` trägt sie implizit. */
const LIVE_MARKEN = '[role="status"],[role="alert"],[role="log"],[aria-live],output';

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

function mount(importMeldung: string | null): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  const r = createRoot(container);
  root = r;
  act(() => {
    r.render(
      createElement(CaptureFileImport, {
        onExtractFile: vi.fn() as unknown as (e: unknown) => void,
        importMeldung,
      }),
    );
  });
}

/** Alle Live-Regionen des gemounteten Baums, mit ihrem Text. */
function liveregionen(): { marke: string; text: string }[] {
  return [...(container?.querySelectorAll(LIVE_MARKEN) ?? [])].map((el) => ({
    marke: `${el.tagName.toLowerCase()}${el.getAttribute("aria-live") ? `[aria-live=${el.getAttribute("aria-live")}]` : ""}`,
    text: (el.textContent ?? "").replace(/\s+/g, " ").trim(),
  }));
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
});

describe("JOB 4203 · T9 — die Abweisung des Import-Wegs steht in einer Live-Region", () => {
  it("T9a · OHNE Abweisung: die Region ist montiert und LEER", () => {
    mount(null);
    const regionen = liveregionen();
    // Dauerhaft montiert und im Leerfall leer — die Bauform dieses Hauses. Eine erst im Fehlerfall
    // eingehängte Region wird von Vorlesehilfen überhört (`CaptureFileImport.tsx:165-168`,
    // `tests/app/a18-ansagen-ereignisse.test.tsx`, Fall I1).
    expect(regionen.length, "es gibt gar keine Live-Region").toBeGreaterThan(0);
    expect(regionen.map((r) => r.text)).toEqual(regionen.map(() => ""));
  });

  it("T9b · MIT Abweisung: genau EINE Region trägt den Satz — und sonst niemand", () => {
    const meldung = String(
      i18n.t(CAPTURE_FILE_TEXT.unsupported, { name: "d3-nicht-unterstuetzt.bin" }),
    )
      .replace(/\s+/g, " ")
      .trim();
    mount(meldung);

    const traeger = liveregionen().filter((r) => r.text.includes(meldung));
    expect(
      traeger.length,
      `die Abweisung steht in ${traeger.length} Live-Regionen: ${JSON.stringify(liveregionen())}`,
    ).toBe(1);

    // Und sie steht im ganzen Baum genau EINMAL — „EIN Träger statt zweier" (AUFTRAG-1840, K-27).
    const baum = (container?.textContent ?? "").replace(/\s+/g, " ");
    expect(baum.split(meldung).length - 1, "die Abweisung steht mehrfach im Baum").toBe(1);
  });

  it("T9c · der Träger ist höflich, nicht laut — `aria-live=polite`, wie der Rest dieser Fläche", () => {
    const meldung = "D3-PROBE-ABWEISUNG";
    mount(meldung);
    const traeger = liveregionen().find((r) => r.text.includes(meldung));
    expect(traeger, "kein Träger gefunden").toBeDefined();
    // Eine Ablehnung ist kein Alarm: sie folgt auf eine Handlung des Menschen und unterbricht ihn
    // nicht mitten im Satz. `polite` ist deshalb die richtige Stufe — und dieselbe, die diese
    // Fläche schon für Drop-Ablehnung und Kachel-Hinweis benutzt.
    expect(traeger?.marke).toContain("[aria-live=polite]");
  });

  it("T9d · die EIGENE Meldung der Fläche gewinnt gegen eine ältere Abweisung des Import-Wegs", () => {
    // Die „jüngste Ursache gewinnt"-Doktrin dieser Fläche (`CaptureFileImport.tsx:43-53`) darf durch
    // den neuen Weg nicht ausgehebelt werden: eine danach ausgelöste Ablehnung (Drop, Kachel) muss
    // die stehende Import-Meldung ersetzen, nicht sich dahinter anstellen.
    mount("ALTE-IMPORT-MELDUNG");
    const zone = container?.querySelector('[data-testid="capture-dropzone"]');
    expect(zone, "die Ablagefläche fehlt im gemounteten Baum").not.toBeNull();
    act(() => {
      zone?.dispatchEvent(
        Object.assign(new Event("drop", { bubbles: true, cancelable: true }), {
          dataTransfer: {
            files: [new File(["x"], "abgelehnt.bin", { type: "application/x-bin" })],
          },
        }),
      );
    });
    const text = (container?.textContent ?? "").replace(/\s+/g, " ");
    expect(text, "die neue Ablehnung steht nicht da").toContain("abgelehnt.bin");
    expect(text, "die alte Import-Meldung steht noch daneben").not.toContain("ALTE-IMPORT-MELDUNG");
  });
});
