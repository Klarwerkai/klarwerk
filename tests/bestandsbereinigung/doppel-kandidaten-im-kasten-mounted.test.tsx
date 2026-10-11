// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME 20260922 · GESAMT-BESTANDSBEREINIGUNG (R-0124) — der Aufräum-Kasten nennt die erkannten
// Doppel-Kandidaten in der Vorschau UND in der Bilanz.
// ================================================================================================
//
// Gemessen an der echten Komponente `ImportCleanup` (Import-Bereich, Stufe 2); ersetzt ist nur die
// HTTP-Grenze. Dass der Server die Zahlen richtig ermittelt (Vorschau aus der Queue, Bilanz aus dem
// Ergebnis des bedingten DELETE), misst tests/app/import-cleanup.test.ts an der echten App.
//
// Was hier zugesagt wird:
//   · vor dem Aufräumen steht die Vorschau mit der Zahl der erkannten Doppel-Kandidaten — auch 0;
//   · bestätigt wird mit dem Digest der Vorschau (unverändert);
//   · danach steht die Bilanz mit der Zahl der TATSÄCHLICH entfernten Doppel-Kandidaten — die Zahl
//     aus der Antwort, nicht die der Vorschau.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  vorschau: {} as Record<string, unknown>,
  bilanz: {} as Record<string, unknown>,
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    admin: {
      import: {
        cleanupPreview: vi.fn(async () => box.vorschau),
        cleanupConfirm: vi.fn(async () => box.bilanz),
      },
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { ImportCleanup } from "../../apps/web/src/components/ImportCleanup";
import i18n from "../../apps/web/src/i18n";
import { AUFRAEUM_DOPPEL_TEXT, IMPORT_CLEANUP_TEXT } from "../../apps/web/src/lib/importCleanup";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(createElement(QueryClientProvider, { client: qc }, createElement(ImportCleanup)));
    await flush();
  });
}

function knopfMitText(text: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
}

async function klick(el: HTMLElement | undefined): Promise<void> {
  expect(el, "Knopf fehlt").toBeTruthy();
  await act(async () => {
    (el as HTMLElement).click();
    await flush();
  });
}

function text(): string {
  return container.textContent ?? "";
}

function vorschau(teil: Record<string, unknown>): Record<string, unknown> {
  return {
    preview: true,
    candidates: 3,
    importedKos: 2,
    digest: "d".repeat(64),
    claimedKos: 0,
    auditPendingCandidates: 0,
    duplicateCandidates: 0,
    ...teil,
  };
}

function bilanz(teil: Record<string, unknown>): Record<string, unknown> {
  return {
    preview: false,
    removedCandidates: 3,
    trashedKos: 2,
    skipped: [],
    auditFailed: false,
    newCandidates: 0,
    claimedKos: 0,
    auditPendingCandidates: 0,
    removedDuplicateCandidates: 0,
    ...teil,
  };
}

beforeEach(async () => {
  vi.mocked(endpoints.admin.import.cleanupPreview).mockClear();
  vi.mocked(endpoints.admin.import.cleanupConfirm).mockClear();
  await i18n.changeLanguage("de");
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  qc.clear();
});

describe("R-0124: Vorschau und Bilanz nennen die erkannten Doppel-Kandidaten", () => {
  it("die Vorschau nennt die Doppel-Kandidaten, die Bilanz die wirklich entfernten", async () => {
    box.vorschau = vorschau({ duplicateCandidates: 2 });
    box.bilanz = bilanz({ removedDuplicateCandidates: 2 });
    await mount();
    // Vor dem Klick: noch keine Vorschau, nichts passiert.
    expect(text()).not.toContain(i18n.t(AUFRAEUM_DOPPEL_TEXT.vorschau, { n: 2 }));

    await klick(knopfMitText(i18n.t(IMPORT_CLEANUP_TEXT.previewCta)));
    expect(text()).toContain(i18n.t(IMPORT_CLEANUP_TEXT.previewResult, { n: 3, m: 2 }));
    expect(text()).toContain("Davon 2 erkannte Doppel-Kandidaten.");
    expect(endpoints.admin.import.cleanupConfirm).not.toHaveBeenCalled();

    await klick(knopfMitText(i18n.t(IMPORT_CLEANUP_TEXT.confirmCta)));
    expect(vi.mocked(endpoints.admin.import.cleanupConfirm).mock.calls).toEqual([["d".repeat(64)]]);
    expect(text()).toContain(i18n.t(IMPORT_CLEANUP_TEXT.doneCandidates, { n: 3 }));
    expect(text()).toContain("davon 2 erkannte Doppel-Kandidaten entfernt");
  });

  it("die Bilanz zeigt, was WIRKLICH passiert ist — nicht die Zahl der Vorschau", async () => {
    // Vorschau: 1 Doppel-Kandidat. Ein Beitrag liess sich nicht löschen → die Queue blieb stehen,
    // also wurde auch der Doppel-Kandidat NICHT entfernt.
    box.vorschau = vorschau({ duplicateCandidates: 1 });
    box.bilanz = bilanz({
      removedCandidates: 0,
      trashedKos: 1,
      skipped: [{ id: "ko-x", reason: "RepoDown" }],
      removedDuplicateCandidates: 0,
    });
    await mount();
    await klick(knopfMitText(i18n.t(IMPORT_CLEANUP_TEXT.previewCta)));
    expect(text()).toContain("Davon 1 erkannte Doppel-Kandidaten.");
    await klick(knopfMitText(i18n.t(IMPORT_CLEANUP_TEXT.confirmCta)));
    expect(text()).toContain("davon 0 erkannte Doppel-Kandidaten entfernt");
    expect(text()).toContain(i18n.t(IMPORT_CLEANUP_TEXT.doneSkipped, { n: 1 }));
  });

  it("auch ohne Doppel-Kandidaten steht die Zahl da (0) — in DE, EN und NL", async () => {
    box.vorschau = vorschau({ duplicateCandidates: 0 });
    await mount();
    await klick(knopfMitText(i18n.t(IMPORT_CLEANUP_TEXT.previewCta)));
    expect(text()).toContain("Davon 0 erkannte Doppel-Kandidaten.");
    for (const [sprache, erwartet] of [
      ["en", "Of these, 0 detected duplicate candidates."],
      ["nl", "Waarvan 0 herkende dubbele kandidaten."],
    ] as const) {
      expect(i18n.getFixedT(sprache)(AUFRAEUM_DOPPEL_TEXT.vorschau, { n: 0 })).toBe(erwartet);
    }
    expect(i18n.getFixedT("en")(AUFRAEUM_DOPPEL_TEXT.bilanz, { n: 4 })).toBe(
      "of these, 4 detected duplicate candidates removed",
    );
    expect(i18n.getFixedT("nl")(AUFRAEUM_DOPPEL_TEXT.bilanz, { n: 4 })).toBe(
      "waarvan 4 herkende dubbele kandidaten verwijderd",
    );
  });
});
