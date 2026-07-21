import { afterEach, describe, expect, it } from "vitest";
// @vitest-environment jsdom
// WP-SUBMIT-ASYNC (Teil 3): das AiCheckBadge macht den Status der Hintergrund-KI-Pruefung auf der
// Validierungs-Karte sichtbar — echter React-Mount (gleiches Muster wie file-format-info-mounted:
// react/react-dom relativ aus apps/web/node_modules, createElement statt JSX, act aus React 18.3).
// Gepinnt: (a) pending → dezente Laeuft-Pill mit Tooltip, KEIN Retry-Knopf; (b) failed → Warn-Pill
// mit Ursache im title-Tooltip + Retry-Knopf, Klick feuert onRetry; (c) done und Altbestand ohne
// aiCheck-Feld → bewusst NICHTS im DOM (kein Badge-Rauschen im Normalfall).
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { AiCheckBadge, aiCheckFailureReasonKey } from "../../apps/web/src/components/AiCheckBadge";
// i18n VOR der Komponente importieren: initialisiert react-i18next global (useTranslation ohne Provider).
import i18n from "../../apps/web/src/i18n";

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

const de = (key: string): string => String(i18n.getResource("de", "translation", key));

describe("WP-SUBMIT-ASYNC: AiCheckBadge — pending/failed sichtbar, done/Altbestand still", () => {
  it("(a) pending → Laeuft-Pill mit Tooltip, KEIN Retry-Knopf", () => {
    mount({
      aiCheck: { status: "pending", requestedAt: "2026-07-21T06:00:00.000Z" },
      onRetry: () => {
        throw new Error("Retry darf im pending-Zustand nicht angeboten werden");
      },
    });
    expect(container.textContent).toContain(de("val.aiCheck.pending"));
    const pill = container.querySelector("span[title]");
    expect(pill?.getAttribute("title")).toBe(de("val.aiCheck.pendingHint"));
    expect(container.querySelector("button")).toBeNull();
  });

  it("(b) failed/no-model → Warn-Pill, Ursache im Tooltip, Retry-Klick feuert onRetry", () => {
    let retried = 0;
    mount({
      aiCheck: {
        status: "failed",
        requestedAt: "2026-07-21T06:00:00.000Z",
        finishedAt: "2026-07-21T06:00:05.000Z",
        fallbackReason: "no-model",
      },
      onRetry: () => {
        retried += 1;
      },
    });
    expect(container.textContent).toContain(de("val.aiCheck.failed"));
    const pill = container.querySelector("span[title]");
    expect(pill?.getAttribute("title")).toBe(de("val.aiCheck.reason.no-model"));
    const retry = container.querySelector("button");
    expect(retry?.textContent).toContain(de("val.aiCheck.retry"));
    act(() => {
      retry?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(retried).toBe(1);
  });

  it("(b2) failed/model-error → Tooltip traegt die Modellfehler-Ursache; unbekannte Ursache faellt auf model-error zurueck", () => {
    mount({
      aiCheck: {
        status: "failed",
        requestedAt: "2026-07-21T06:00:00.000Z",
        fallbackReason: "model-error",
      },
      onRetry: () => {},
    });
    const pill = container.querySelector("span[title]");
    expect(pill?.getAttribute("title")).toBe(de("val.aiCheck.reason.model-error"));
    // Pure Ableitung: unbekannte/fehlende Ursache wird ehrlich als Modellfehler erklaert.
    expect(aiCheckFailureReasonKey(undefined)).toBe("val.aiCheck.reason.model-error");
    expect(aiCheckFailureReasonKey("no-model")).toBe("val.aiCheck.reason.no-model");
  });

  it("(b3) retryBusy deaktiviert den Retry-Knopf (kein Doppel-Einreihen per Doppelklick)", () => {
    mount({
      aiCheck: {
        status: "failed",
        requestedAt: "2026-07-21T06:00:00.000Z",
        fallbackReason: "no-model",
      },
      onRetry: () => {},
      retryBusy: true,
    });
    expect(container.querySelector("button")?.disabled).toBe(true);
  });

  it("(c) done → NICHTS im DOM", () => {
    mount({
      aiCheck: {
        status: "done",
        requestedAt: "2026-07-21T06:00:00.000Z",
        finishedAt: "2026-07-21T06:01:00.000Z",
      },
      onRetry: () => {},
    });
    expect(container.innerHTML).toBe("");
  });

  it("(c2) Altbestand ohne aiCheck-Feld → NICHTS im DOM (kein Pruef-Job vermerkt)", () => {
    mount({ aiCheck: undefined, onRetry: () => {} });
    expect(container.innerHTML).toBe("");
  });
});
