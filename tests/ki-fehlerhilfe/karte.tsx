// ================================================================================================
// JOB 3420 · UX-10b — DIE GEMEINSAME MONTAGE DER KI-DETAILKARTE FÜR DIESEN ORDNER.
// ================================================================================================
//
// WARUM EINE GEMEINSAME DATEI UND NICHT VIER KOPIEN: Die vier gemounteten Fälle dieses Ordners
// unterscheiden sich AUSSCHLIESSLICH in der Serverantwort, die der `fetch`-Spion liefert. Wäre die
// Montage viermal abgeschrieben, könnte eine Kopie stillschweigend abweichen (andere Konfiguration,
// anderer Abbau) und ein Fall wäre grün, weil er etwas anderes misst als sein Nachbar.
//
// WARUM `.tsx` OHNE JSX: `tsconfig.tests-tsx.json` (`include: ["tests/**/*.tsx", …]`) ist die
// Typprüfung, die `jsx` und die DOM-Bibliothek mitbringt; die Wurzel-Prüfung schliesst `tests/**/*.tsx`
// ausdrücklich aus und hat kein DOM. Eine `.ts`-Hilfsdatei landete also in der falschen Prüfung und
// wäre dort rot. Gerendert wird trotzdem über `createElement` — `@testing-library/react` ist in
// diesem Werk weder in der Wurzel noch unter `apps/web` installiert.
//
// HERMETIK: kein Netz. `fetch` ist global ersetzt; nicht hinterlegte Wege antworten 500 — genau der
// Zustand, den Fall (h) des Auftrags braucht (die Anfrage an KLARWERK selbst scheitert).
import { expect, vi } from "vitest";

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { ReasonerConfigStatus } from "../../apps/web/src/api/types";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { KiDetail } from "../../apps/web/src/pages/AdminKiDetails";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Die Client-Namen, wie `services/reasoner/src/model-client.ts` sie bildet. */
export const OPENAI = "cloud:openai:gpt-6-astra";
export const ANTHROPIC = "anthropic:claude-sonnet-4-6";
export const LOKAL = "local:Qwen3-32B-AWQ";

const AUFGABEN = [
  "structure",
  "assist",
  "interview",
  "answer",
  "select",
  "extract",
  "describe",
  "group",
] as const;

/** Eine vollständige, gültige Konfigurationsantwort — nur die genannten Felder verstellt. */
export function konfig(
  over: Partial<ReasonerConfigStatus> & { provider: string },
): ReasonerConfigStatus {
  return {
    model: over.provider,
    configured: true,
    mode: "model",
    fallbackAvailable: true,
    supportsLocales: ["de", "en", "nl"],
    tasks: [...AUFGABEN],
    taskConfig: { global: "auto", perTask: {} },
    effective: Object.fromEntries(AUFGABEN.map((t) => [t, "model"])),
    cloudConfigured: true,
    localConfigured: false,
    effectiveProvider: Object.fromEntries(AUFGABEN.map((t) => [t, "cloud"])),
    persisted: true,
    ...over,
  };
}

export interface Antworten {
  config: ReasonerConfigStatus;
  test?: unknown;
  testLocal?: unknown;
  conflict?: unknown;
  dup?: unknown;
  /**
   * RUNDE 2 (BENs Korrekturpflicht 1): eine Antwort GEZIELT offen halten. Ohne diesen Griff endet
   * jede Mutation im selben Zug, in dem sie startet — der laufende Zustand („teste …", deaktiviert)
   * wäre unbeobachtbar und seine Zusage unprüfbar. `nr` ist der wievielte Ruf DIESES Pfades es ist
   * (1 = der erste). Gibt die Funktion nichts zurück, antwortet der Spion sofort wie bisher.
   */
  bremse?: (pfad: string, nr: number) => Promise<void> | undefined;
}

export interface Spion {
  /** Jeder angefragte Pfad, in der Reihenfolge des Aufrufs — so wird ein Wiederholen zählbar. */
  readonly rufe: string[];
}

/**
 * Der Spion als Server. Ein NICHT hinterlegter Weg antwortet 500 mit dem Fehlerschema des Hauses
 * (`{error, message}`, `services/app/src/http.ts`) — daraus baut `apps/web/src/api/client.ts` einen
 * `ApiError`, und die Mutation der Karte steht auf `isError`.
 */
export function fetchSpion(antworten: Antworten): Spion {
  const spion: Spion = { rufe: [] };
  vi.stubGlobal("fetch", (async (url: unknown) => {
    const pfad = String(url);
    spion.rufe.push(pfad);
    const nr = spion.rufe.filter((p) => p === pfad).length;
    await antworten.bremse?.(pfad, nr);
    const hinterlegt = pfad.includes("/reasoner/config")
      ? antworten.config
      : pfad.includes("/reasoner/test-local")
        ? antworten.testLocal
        : pfad.includes("/reasoner/test")
          ? antworten.test
          : pfad.includes("/reasoner/conflict-self-test")
            ? antworten.conflict
            : pfad.includes("/reasoner/duplicate-self-test")
              ? antworten.dup
              : undefined;
    // Eine Funktion statt eines festen Körpers heisst: die Antwort HÄNGT AM RUF (erster Ruf
    // Fehler, zweiter Ruf Erfolg) — anders lässt sich nicht messen, was ein geglückter zweiter
    // Versuch mit dem stehen gebliebenen Befund macht.
    const koerper =
      typeof hinterlegt === "function" ? (hinterlegt as (nr: number) => unknown)(nr) : hinterlegt;
    const da = koerper !== undefined;
    return {
      ok: da,
      status: da ? 200 : 500,
      statusText: da ? "OK" : "Internal Server Error",
      text: async () =>
        JSON.stringify(da ? koerper : { error: "SERVER_ERROR", message: "kein Fixture" }),
    } as unknown as Response;
  }) as unknown as typeof fetch);
  return spion;
}

export const durchlaufen = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

const gemountet: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];

/** Abbau nach jedem Fall — in jeder Testdatei als `afterEach(aufraeumen)` zu registrieren. */
export function aufraeumen(): void {
  for (const { root, container } of gemountet.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
}

export async function karteMounten(sprache: "de" | "en" = "de"): Promise<HTMLDivElement> {
  await i18n.changeLanguage(sprache);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  gemountet.push({ root, container });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(ToastProvider, null, createElement(KiDetail, { onZurueck: () => {} })),
      ),
    );
    await durchlaufen();
  });
  await act(durchlaufen);
  expect(
    container.querySelector('[data-testid="detail-ki"]'),
    "KI-Karte nicht gemountet",
  ).toBeTruthy();
  return container;
}

/**
 * Zurück auf Deutsch, ohne React-Warnung: die Sprache umzuschalten rendert die noch gemountete
 * Karte neu — das ist ein Zustandswechsel und gehört deshalb in `act`.
 */
export async function spracheZurueck(): Promise<void> {
  await act(async () => {
    await i18n.changeLanguage("de");
    await durchlaufen();
  });
}

/** Ein Knopf, gefunden über seine WÖRTLICHE sichtbare Beschriftung. */
export function knopfMit(wurzel: ParentNode, beschriftung: string): HTMLButtonElement {
  const knopf = [...wurzel.querySelectorAll("button")].find(
    (b) => (b.textContent ?? "").trim() === beschriftung,
  );
  expect(knopf, `Knopf „${beschriftung}" nicht gefunden`).toBeTruthy();
  return knopf as HTMLButtonElement;
}

export async function druecken(knopf: HTMLButtonElement): Promise<void> {
  await act(async () => {
    knopf.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await durchlaufen();
  });
  await act(durchlaufen);
}

export async function knopfDruecken(wurzel: ParentNode, beschriftung: string): Promise<void> {
  await druecken(knopfMit(wurzel, beschriftung));
}

/** Der Fehlerkasten eines Weges — über seine Kennung, nicht über einen Text. */
export function fehlerkasten(container: HTMLDivElement, testId: string): HTMLElement {
  const kasten = container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  expect(kasten, `Fehlerkasten „${testId}" nicht gefunden`).toBeTruthy();
  return kasten as HTMLElement;
}
