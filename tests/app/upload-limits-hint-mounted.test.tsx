// @vitest-environment jsdom
// AUFTRAG-mega14 Block E (SCRUM-421): die angezeigte Grenze stammt WIRKLICH aus der Serverquelle.
//
// Der Strukturtest (tests/app/upload-limits-visible.test.ts) belegt, dass der Hinweis an jeder
// Auswahlstelle steht und keine Zahl fest verdrahtet ist. Hier wird die andere Hälfte belegt: was
// der Server sagt, steht auf dem Bildschirm — und eine Änderung im Admin kommt an.
import { afterEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({ limits: { maxAttachments: 8, maxAttachmentBytes: 20_000_000 } }));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: { uploadLimits: { get: vi.fn(async () => box.limits) } },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { UploadLimitsHint } from "../../apps/web/src/components/UploadLimitsHint";
import { maxRawAttachmentMb } from "../../apps/web/src/lib/uploadLimits";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(QueryClientProvider, { client: qc }, createElement(UploadLimitsHint)),
    );
    await flush();
  });
  await act(flush);
}

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

function text(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

describe("SCRUM-421: der Grenzen-Hinweis zeigt die Serverwerte", () => {
  it("Werkseinstellung: 8 Dateien, 20 MB", async () => {
    box.limits = { maxAttachments: 8, maxAttachmentBytes: 20_000_000 };
    await mount();
    expect(container.querySelector("[data-testid=upload-limits-hint]")).toBeTruthy();
    expect(text()).toContain("8");
    expect(text()).toContain("20");
  });

  it("eine ANDERE Admin-Einstellung kommt an — die Zahl ist nicht fest verdrahtet", async () => {
    box.limits = { maxAttachments: 3, maxAttachmentBytes: 2_500_000 };
    await mount();
    const gezeigt = text();
    expect(gezeigt).toContain("3");
    expect(gezeigt).toContain("2.5");
    // Und die Werksvorgabe steht garantiert NICHT mehr da.
    expect(gezeigt).not.toContain("20 MB");
  });

  // AUFTRAG-mega15 Block E: neben der eingestellten Übertragungsgrenze steht die ungefähre
  // ROHDATEIGRENZE — die Zahl, die der Nutzer an seiner Datei ablesen kann. Dass sie real
  // durchgeht, belegt tests/app/upload-raw-limit-e2e.test.ts gegen die echten Routen.
  it("die ungefähre Rohdateigrenze steht daneben und rechnet mit", async () => {
    box.limits = { maxAttachments: 8, maxAttachmentBytes: 20_000_000 };
    await mount();
    expect(text()).toContain(String(maxRawAttachmentMb(20_000_000)));
    expect(maxRawAttachmentMb(20_000_000)).toBe(14.9);
  });

  it("eine andere Einstellung ändert auch die Rohdateigrenze", async () => {
    box.limits = { maxAttachments: 3, maxAttachmentBytes: 2_500_000 };
    await mount();
    const gezeigt = text();
    expect(gezeigt).toContain(String(maxRawAttachmentMb(2_500_000)));
    expect(gezeigt).not.toContain("14.9");
  });

  it("ohne Serverantwort wird NICHTS behauptet — kein Platzhalter mit Vorgabezahl", async () => {
    const { endpoints } = await import("../../apps/web/src/api/endpoints");
    (endpoints.uploadLimits.get as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {}),
    );
    await mount();
    expect(container.querySelector("[data-testid=upload-limits-hint]")).toBeNull();
    expect(text()).toBe("");
  });
});
