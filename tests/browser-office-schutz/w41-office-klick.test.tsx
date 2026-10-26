// @vitest-environment jsdom
import { Blob as NodeBlob, File as NodeFile } from "node:buffer";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import type { BildAnalyse } from "../../apps/web/src/lib/bildAutomatik";

const control = vi.hoisted(() => ({
  lage: "an" as "an" | "aus" | "laedt" | "unbekannt",
  analyse: null as unknown as BildAnalyse,
  auswerten: vi.fn(),
  melden: vi.fn(),
  metadaten: vi.fn(),
}));
vi.mock("../../apps/web/src/lib/bildAutomatikLauf", () => ({
  useBildAnalyse: () => control.analyse,
}));
vi.mock("../../apps/web/src/lib/bildAutomatikEinstellung", () => ({
  useBildAutomatikLage: () => control.lage,
}));
vi.mock("../../apps/web/src/app/ImageDescribeContext", () => ({
  useImageDescribeWennVorhanden: () => null,
}));
vi.mock("../../apps/web/src/components/bibliothek/PowerPointBildquellen", () => ({
  PowerPointBildquellen: ({ children }: { children: unknown }) => children,
  usePowerPointBildmeldung: () => control.melden,
}));
vi.mock("../../apps/web/src/components/bibliothek/FolienAufbau", () => ({
  FolienAufbau: () => null,
}));
vi.mock("../../apps/web/src/components/bibliothek/FolienDaten", () => ({
  FolienDaten: () => null,
}));
vi.mock("../../apps/web/src/components/BildBefundListe", () => ({
  BildBefundListe: ({ befund }: { befund: { status: string } }) =>
    createElement("output", { "data-befund-status": befund.status }, befund.status),
}));
vi.mock("../../apps/web/src/components/KlaraBereichsfrage", () => ({
  KlaraBereichsfrage: () => null,
}));
vi.mock("../../apps/web/src/components/KlaraBildKontextFrage", () => ({
  KlaraBildKontextFrage: () => null,
}));
vi.mock("../../apps/web/src/api/officeArtikel", async (original) => {
  const actual = await original<typeof import("../../apps/web/src/api/officeArtikel")>();
  return { ...actual, officeArtikel: { ...actual.officeArtikel, lage: control.metadaten } };
});
vi.mock("../../apps/web/src/lib/files", async (original) => {
  const actual = await original<typeof import("../../apps/web/src/lib/files")>();
  return {
    ...actual,
    readDocxRich: vi.fn(actual.readDocxRich),
    readPptxRich: vi.fn(actual.readPptxRich),
  };
});

import { OfficeBildBefunde } from "../../apps/web/src/components/bibliothek/OfficeBildBefunde";
import { OfficeImArtikel } from "../../apps/web/src/components/bibliothek/OfficeImArtikel";
import i18n from "../../apps/web/src/i18n";
import { DOCX_MAX_COMPRESSED_BYTES } from "../../apps/web/src/lib/docxArchive";
import { readDocxFile, readDocxRich, readPptxRich } from "../../apps/web/src/lib/files";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const bytes = readFileSync(resolve(process.cwd(), "tests/fixtures/sample.docx"));
const A = { id: "a", objectId: "obj-a", name: "Plan.docx" };
const ko = (id: string, attachments = [A]) =>
  ({ id, title: id, attachments, sources: [] }) as unknown as KnowledgeObject;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;
let fetcher: ReturnType<typeof vi.fn>;

function neueAnalyse(): BildAnalyse {
  return { analysiereQuelle: control.auswerten } as unknown as BildAnalyse;
}
async function anzeigen(k = ko("artikel-a")) {
  await act(async () => {
    root.render(
      createElement(QueryClientProvider, { client: qc }, createElement(OfficeImArtikel, { ko: k })),
    );
  });
}
function lesen() {
  const button = container.querySelector<HTMLButtonElement>("[data-office-bild-lesen]");
  expect(button?.tagName).toBe("BUTTON");
  expect(button?.type).toBe("button");
  expect(button?.tabIndex).toBe(0);
  expect(button?.getAttribute("aria-label")).toContain("Plan.docx");
  act(() => button?.click());
}
async function fertig() {
  try {
    await act(async () => {
      await vi.waitFor(() => expect(control.auswerten).toHaveBeenCalled(), {
        timeout: 3000,
        interval: 10,
      });
    });
  } catch (error) {
    const results = await Promise.all(
      vi.mocked(readDocxRich).mock.results.map((result) =>
        Promise.race([
          Promise.resolve(result.value).then(
            () => "fulfilled",
            (reason: unknown) =>
              reason instanceof Error ? `${reason.name}:${reason.message}` : String(reason),
          ),
          new Promise<string>((resolve) => setTimeout(() => resolve("pending"), 5)),
        ]),
      ),
    );
    console.error(
      "W4_KLICK_DIAGNOSE",
      JSON.stringify({ parser: results, html: container.innerHTML }),
    );
    throw error;
  }
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  vi.stubGlobal("File", NodeFile);
  vi.stubGlobal("Blob", NodeBlob);
  vi.mocked(readDocxRich).mockClear();
  vi.mocked(readPptxRich).mockClear();
  control.lage = "an";
  control.auswerten.mockReset();
  control.auswerten.mockImplementation(async (eingang) => ({
    quelle: eingang.quelle,
    art: "docx",
    status: "vollstaendig",
    befunde: [],
    nichtGelesen: [],
    hinweise: [],
  }));
  control.analyse = neueAnalyse();
  control.melden.mockReset();
  control.metadaten.mockReset();
  control.metadaten.mockResolvedValue({
    anwendung: "word",
    endung: "docx",
    bearbeitbar: true,
    schreibweg: "nur-lesen",
    editorEingerichtet: false,
    fassung: 1,
    status: "validiert",
    verlauf: [],
    belegstellen: [],
    sitzung: { laeuft: false },
    gesichert: [],
  });
  fetcher = vi.fn(async () => ({ ok: true, blob: async () => new NodeBlob([bytes]) }));
  vi.stubGlobal("fetch", fetcher);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(async () => {
  await act(async () => root.unmount());
  qc.clear();
  container.remove();
  vi.unstubAllGlobals();
});

describe("W4.1 · Office-Anhang nur nach bewusster Aktion", () => {
  it.each(["an", "aus"] as const)(
    "Bildautomatik%s: vorher0Abrufe/0Parser; Klick liest echtes DOCX",
    async (lage) => {
      control.lage = lage;
      await anzeigen();
      expect(fetcher).not.toHaveBeenCalled();
      expect(readDocxRich).not.toHaveBeenCalled();
      expect(readPptxRich).not.toHaveBeenCalled();
      expect(control.metadaten).not.toHaveBeenCalled();
      lesen();
      await fertig();
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(fetcher).toHaveBeenCalledWith(
        "/api/objects/obj-a/raw",
        expect.objectContaining({ credentials: "same-origin", signal: expect.any(AbortSignal) }),
      );
      expect(readDocxRich).toHaveBeenCalledTimes(1);
      expect(control.auswerten).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ automatik: lage === "an" }),
      );
    },
  );

  it("Artikelwechsel mit identischer Anhangskennung bricht den alten Abruf ab und startet keinen neuen", async () => {
    let signal: AbortSignal | undefined;
    let liefern: ((value: unknown) => void) | undefined;
    fetcher.mockImplementation((_url, options) => {
      signal = options.signal;
      return new Promise((resolve) => {
        liefern = resolve;
      });
    });
    await anzeigen();
    lesen();
    expect(fetcher).toHaveBeenCalledTimes(1);
    await anzeigen(ko("artikel-b"));
    expect(signal?.aborted).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => {
      liefern?.({ ok: true, blob: async () => new NodeBlob([bytes]) });
    });
    expect(readDocxRich).not.toHaveBeenCalled();
    expect(control.auswerten).not.toHaveBeenCalled();
  });

  it("neue Objektfassung braucht einen eigenen Klick, alter Lauf wird abgebrochen", async () => {
    let signal: AbortSignal | undefined;
    fetcher.mockImplementation((_url, options) => {
      signal = options.signal;
      return new Promise(() => {});
    });
    await anzeigen();
    lesen();
    await anzeigen(ko("artikel-a", [{ ...A, objectId: "obj-neu" }]));
    expect(signal?.aborted).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(readDocxRich).not.toHaveBeenCalled();
  });

  it("Einstellungswechsel bricht ab; auch Zurückschalten startet keinen alten Auftrag neu", async () => {
    let signal: AbortSignal | undefined;
    fetcher.mockImplementation((_url, options) => {
      signal = options.signal;
      return new Promise(() => {});
    });
    await anzeigen();
    lesen();
    control.lage = "aus";
    await anzeigen();
    expect(signal?.aborted).toBe(true);
    control.lage = "an";
    await anzeigen();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(readDocxRich).not.toHaveBeenCalled();
  });

  it("anderes Konto erbt weder Auftrag noch Befund", async () => {
    await anzeigen();
    lesen();
    await fertig();
    expect(container.querySelector('[data-befund-status="vollstaendig"]')).not.toBeNull();
    control.analyse = neueAnalyse();
    control.auswerten.mockClear();
    await anzeigen();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[data-befund-status]")).toBeNull();
    lesen();
    await fertig();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("403 bleibt ohne Parser und ohne automatische Wiederholung", async () => {
    fetcher.mockResolvedValue({ ok: false });
    await anzeigen();
    lesen();
    await vi.waitFor(async () => {
      await act(async () => {
        await Promise.resolve();
      });
      expect(container.querySelector('[data-befund-status="fehlgeschlagen"]')).not.toBeNull();
    });
    expect(readDocxRich).not.toHaveBeenCalled();
    expect(control.auswerten).not.toHaveBeenCalled();
    await anzeigen();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("alleinstehende Befundfläche lädt ebenfalls erst auf Klick", async () => {
    await act(async () => root.render(createElement(OfficeBildBefunde, { anhaenge: [A] })));
    expect(fetcher).not.toHaveBeenCalled();
    lesen();
    await fertig();
    expect(readDocxRich).toHaveBeenCalledTimes(1);
  });

  it("Dateigröße fällt vor arrayBuffer an beiden Browser-Wrappern", async () => {
    const arrayBuffer = vi.fn();
    const file = { size: DOCX_MAX_COMPRESSED_BYTES + 1, arrayBuffer } as unknown as File;
    await expect(readDocxFile(file)).rejects.toMatchObject({ reason: "file-too-large" });
    await expect(readDocxRich(file)).rejects.toMatchObject({ reason: "file-too-large" });
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it("ein bloßer Artikelwechsel übernimmt keinen aufgeklappten Editor", async () => {
    await anzeigen();
    act(() => container.querySelector<HTMLButtonElement>("[data-office-oeffnen]")?.click());
    await vi.waitFor(() => expect(control.metadaten).toHaveBeenCalledTimes(1));
    await anzeigen(ko("artikel-b"));
    expect(control.metadaten).toHaveBeenCalledTimes(1);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
