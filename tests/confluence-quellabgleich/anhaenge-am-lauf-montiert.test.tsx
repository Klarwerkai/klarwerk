// @vitest-environment jsdom
// ================================================================================================
// R-0163 (Lauf 2) — DIE LAUFKARTE NENNT ANGEGLICHENE ANHÄNGE, WENN DER SERVER SIE MELDET.
// ================================================================================================
//
// Gedoppelt ist allein `fetch` (Muster aus `tests/app/f0140-importlauf-fortschritt.test.tsx`); der
// Laufkörper ist Feld für Feld der von `import-run-routes.ts` (`laufNachAussen`). Die Zeile steht
// nur, wenn `sourceSync.attachmentsUpdated` Einträge trägt — ein Altlauf ohne das Feld und ein
// leerer Eintrag zeigen nichts.
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { ImportRunPanel } from "../../apps/web/src/pages/Stufe2";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function antwort(status: number, koerper: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    text: async () => JSON.stringify(koerper),
  } as unknown as Response;
}

function laufKoerper(sourceSync: unknown): Record<string, unknown> {
  return {
    importId: "lauf-1",
    sourceSystem: "confluence",
    externalId: null,
    sourceScope: "space:KW",
    requestedSourceVersion: null,
    status: "COMPLETED",
    sourceRecordId: null,
    startedAt: "2026-09-27T08:00:00.000Z",
    completedAt: "2026-09-27T08:01:00.000Z",
    failureCode: null,
    failureReason: null,
    counters: { itemsTotal: 2, itemsCreated: 0, itemsBound: 0, itemsSkipped: 2, itemsFailed: 0 },
    sourceSync,
  };
}

async function laufZeigen(sourceSync: unknown): Promise<void> {
  (globalThis as unknown as { fetch: unknown }).fetch = vi.fn(async (url: string) =>
    String(url).includes("/runs/")
      ? antwort(200, laufKoerper(sourceSync))
      : antwort(202, { importId: "lauf-1", status: "QUEUED" }),
  );
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root?.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(ToastProvider, null, createElement(ImportRunPanel, null)),
      ),
    );
  });
  await act(flush);
  await act(async () => {
    container?.querySelector<HTMLButtonElement>('[data-testid="f0140-start"]')?.click();
  });
  await act(flush);
}

const zeile = () => container?.querySelector('[data-testid="f0140-anhaenge"]') ?? null;

const basis = {
  checked: true,
  reason: null,
  removed: [],
  restored: [],
  outsideScope: [],
  unchecked: [],
};

describe("R-0163 · Laufkarte: angeglichene Anhänge", () => {
  afterEach(async () => {
    if (root) {
      const r = root;
      await act(async () => r.unmount());
    }
    container?.remove();
    root = null;
    container = null;
  });

  for (const sprache of ["de", "en", "nl"] as const) {
    it(`[${sprache}] nennt die Zahl der Seiten mit angeglichenen Anhängen`, async () => {
      await i18n.changeLanguage(sprache);
      await laufZeigen({ ...basis, attachmentsUpdated: ["P-1", "P-2"] });
      expect(container?.querySelector('[data-testid="f0140-abgleich"]')).not.toBeNull();
      expect(zeile()?.textContent).toBe(i18n.t("w2.run.attachmentsSynced", { anzahl: 2 }));
      expect(zeile()?.textContent).toContain("2");
      expect(zeile()?.textContent).not.toContain("w2.run");
    });
  }

  it("leer oder Altlauf ohne das Feld: keine Zeile", async () => {
    await i18n.changeLanguage("de");
    await laufZeigen({ ...basis, attachmentsUpdated: [] });
    expect(container?.querySelector('[data-testid="f0140-abgleich"]')).not.toBeNull();
    expect(zeile()).toBeNull();
  });

  it("Altlauf ohne attachmentsUpdated: keine Zeile", async () => {
    await i18n.changeLanguage("de");
    await laufZeigen(basis);
    expect(container?.querySelector('[data-testid="f0140-abgleich"]')).not.toBeNull();
    expect(zeile()).toBeNull();
  });
});
