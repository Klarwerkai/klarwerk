// @vitest-environment jsdom
// ================================================================================================
// JOB 3030 — WÄHREND DIE SEITE UNTERWEGS IST, STEHT DORT „LÄDT …" UND NICHT NICHTS.
// ================================================================================================
//
// DIE LÜCKE, DIE DIESE DATEI SCHLIESST (ben, JOB 3030 R2, Prüflücke 6): „fehlt ein Mount-Test, der
// bei aufgeschobenem Seitenimport den sichtbaren `Splash` prüft." Bis hierher hing die Zusage aus
// Lieferpunkt 2 — genau EIN `<Suspense fallback={<Splash />}>`, niemals `fallback={null}` — allein
// am Quelltext. Ein `null` wäre eine stumme weiße Fläche und damit genau die Sorte Aussage, die das
// Regelwerk verbietet: sie sieht aus wie „hier ist nichts", während in Wahrheit etwas unterwegs ist.
//
// WARUM DER NACHWEIS AN EINEM EIGENEN, ANGEHALTENEN MODUL LÄUFT UND NICHT AN EINER ECHTEN SEITE:
// Ein echtes Seitenmodul löst unter vitest binnen weniger Millisekunden auf. Ein Test, der den
// Ladezustand dann „schnell genug" abgreifen müsste, wäre ein Wettlauf — mal grün, mal rot, und
// beides ohne Aussage. Hier hält ein Promise das Modul auf, bis der Test es SELBST freigibt. Damit
// ist der Ladezustand ein Zustand und kein Zeitfenster.
//
// DREI FÄLLE, und keiner davon ist ohne die anderen belastbar:
//   L1  Der Rückfall der Anwendung IST `Splash` — geprüft am Element, das `AppRoutes` zurückgibt,
//       nicht an einer Zeichenfolge im Quelltext.
//   L2  Solange das Modul hängt, steht „Lädt …" SICHTBAR im DOM.
//   L3  Nach der Freigabe verschwindet der Text und der Inhalt erscheint. Ohne L3 wäre L2 auch dann
//       grün, wenn die Ladefläche nie wieder wiche.
//
// ZUR REIHENFOLGE DIESER IMPORTE: `vitest` steht zuerst, weil biome Paket- vor Pfadimporte sortiert.
// Die Zeile `// @vitest-environment jsdom` MUSS dabei die erste Zeile der Datei bleiben — vitest
// liest den Umgebungsschalter aus dem Kopf-Docblock. `biome check --fix --unsafe` würde den Import
// ÜBER den Docblock heben und die Umgebung damit still abschalten; deshalb ist hier von Hand
// sortiert und nicht automatisch.
import { afterEach, describe, expect, it } from "vitest";
import { Suspense, act, createElement, lazy } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { Splash } from "../../apps/web/src/components/Splash";
import i18n from "../../apps/web/src/i18n";
import { AppRoutes } from "../../apps/web/src/routes";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: { render(n: unknown): void; unmount(): void } | null = null;

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    root = null;
  }
  container?.remove();
  container = null;
});

describe("JOB 3030 · die Ladefläche ist da, solange die Seite unterwegs ist", () => {
  it("L1 · der Rückfall der Anwendung ist `Splash` — nicht `null`", () => {
    // `AppRoutes` hat keine Hooks; ihr Rückgabewert lässt sich direkt lesen. Geprüft wird die
    // BAUFORM am Element: äußerstes Element ist eine Suspense-Grenze, und ihr `fallback` ist die
    // Ladefläche. Ein `fallback={null}` fiele hier auf, ein Quelltext-Pin auf „Splash" nicht.
    const element = AppRoutes() as unknown as {
      type: unknown;
      props: { fallback?: { type?: unknown } | null };
    };
    expect(element.type, "AppRoutes muss eine Suspense-Grenze zurückgeben").toBe(Suspense);
    expect(element.props.fallback, "fallback={null} wäre die stumme weiße Fläche").not.toBeNull();
    expect(element.props.fallback?.type, "der Rückfall muss die Ladefläche sein").toBe(Splash);
  });

  it("L2/L3 · solange das Modul hängt, steht der Ladetext sichtbar im DOM — und weicht danach", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    // Ein Modul, das NICHT auflöst, bis der Test es freigibt: der Ladezustand als Zustand.
    let freigeben: (() => void) | null = null;
    const angehalten = new Promise<{ default: () => JSX.Element }>((aufloesen) => {
      freigeben = () =>
        aufloesen({ default: () => createElement("p", null, "die Seite ist da") as JSX.Element });
    });
    const Aufgeschoben = lazy(() => angehalten);

    await act(async () => {
      root?.render(
        createElement(Suspense, { fallback: createElement(Splash) }, createElement(Aufgeschoben)),
      );
    });

    const ladetext = i18n.t("state.loading");
    expect(ladetext.length, "der Ladetext darf nicht leer sein").toBeGreaterThan(0);
    expect(
      container.textContent,
      "Während das Modul unterwegs ist, muss die Fläche sagen, dass etwas lädt — eine leere " +
        "Fläche behauptet, es sei nichts da.",
    ).toContain(ladetext);
    // Und sie ist wirklich SICHTBAR, nicht nur im Textinhalt vorhanden.
    const traeger = container.querySelector("div");
    expect(traeger, "die Ladefläche muss einen Träger im DOM haben").not.toBeNull();
    expect((traeger as HTMLElement).hidden).toBe(false);

    // L3 im selben Aufbau: ohne die Freigabe wäre nicht belegt, dass die Fläche je wieder weicht.
    await act(async () => {
      freigeben?.();
      await angehalten;
    });
    expect(container.textContent, "nach der Freigabe muss der Inhalt da sein").toContain(
      "die Seite ist da",
    );
    expect(
      container.textContent,
      "und die Ladefläche muss weichen — sonst wäre L2 auch bei einem Dauerzustand grün",
    ).not.toContain(ladetext);
  });
});
