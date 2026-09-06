import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @vitest-environment jsdom
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import * as React from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { ToastProvider, useToast } from "../../apps/web/src/app/ToastContext";
import { ImportJsonUpload } from "../../apps/web/src/components/ImportJsonUpload";
import i18n from "../../apps/web/src/i18n";
import { parseImportItems } from "../../apps/web/src/lib/importReview";
import { JSON_UPLOAD_INPUT_ID } from "../../apps/web/src/lib/importSourceGallery";
import { ImportReview } from "../../apps/web/src/pages/Stufe2";

// Nur Abfragen isolieren; Parser, Uebersetzungen, Dateieingaenge, Mutation und Toast-Bus sind echt.
vi.mock("../../apps/web/src/api/hooks", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  const loading = Object.freeze({
    data: undefined,
    isLoading: true,
    isError: false,
    isSuccess: false,
    error: null,
  });
  const stable = () => loading;
  return Object.fromEntries(
    Object.entries(original).map(([key, value]) => [key, key.startsWith("use") ? stable : value]),
  );
});
vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u1", name: "Pedi", role: "admin" } }),
}));
vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "admin", stufe2: true, setStufe2: () => {} }),
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function ToastTexts() {
  return (
    <>
      {useToast().toasts.map((toast) => (
        <output key={toast.id} data-kind={toast.kind}>
          {toast.message}
        </output>
      ))}
    </>
  );
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

beforeEach(async () => {
  await i18n.changeLanguage("de");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(() => {
  React.act(() => root.unmount());
  qc.clear();
  container.remove();
  vi.restoreAllMocks();
});

async function mountPage(lng = "de") {
  await i18n.changeLanguage(lng);
  await React.act(async () =>
    root.render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/import"]}>
          <ToastProvider>
            <ImportReview />
            <ToastTexts />
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  expect(container.querySelector("h1")).not.toBeNull();
}

async function upload(text: string, seam: "onFile" | "onDrop", reject = false) {
  const file = new File([text], "test.json", { type: "application/json" });
  Object.defineProperty(file, "text", {
    value: reject ? () => Promise.reject(new Error("Lesefehler")) : () => Promise.resolve(text),
  });
  await React.act(async () => {
    if (seam === "onFile") {
      const input = container.querySelector<HTMLInputElement>(`#${JSON_UPLOAD_INPUT_ID}`);
      expect(input).not.toBeNull();
      Object.defineProperty(input, "files", { configurable: true, value: [file] });
      input?.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      const event = new Event("drop", { bubbles: true, cancelable: true });
      Object.defineProperty(event, "dataTransfer", { value: { files: [file] } });
      container.querySelector('[data-testid="import-dropzone"]')?.dispatchEvent(event);
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("UX-20: JSON-Kasten und echter Dateifluss", () => {
  it.each(["de", "en", "nl"])(
    "R7 Format und kopierbare gueltige Mindestvorlage in %s",
    async (lng) => {
      await mountPage(lng);
      const card = container.querySelector("#import-json-card");
      // Unabhaengiger Pin fuer G4; die Anzeige muss ihre Werte aus der Parserquelle beziehen.
      for (const name of [
        "title",
        "statement",
        "category",
        "type",
        "bauchgefuehl",
        "best_practice",
        "lernkurve",
        "technik",
        "negativwissen",
      ]) {
        expect(card?.textContent, `R7 Formatangabe fehlt: ${name}`).toContain(name);
      }
      const example = card?.querySelector("textarea");
      expect(example?.readOnly).toBe(true);
      expect(example?.labels?.[0]?.textContent).toBeTruthy();
      const parsed = parseImportItems(example?.value ?? "");
      expect(parsed).toHaveLength(1);
      expect(Object.keys(parsed[0] ?? {}).sort()).toEqual([
        "category",
        "statement",
        "title",
        "type",
      ]);
      React.act(() => example?.focus());
      expect(example?.selectionStart).toBe(0);
      expect(example?.selectionEnd).toBe(example?.value.length);
      expect(card?.querySelector('a[href="/bibliothek"]')?.textContent).toContain("JSON");
      expect(card?.textContent).not.toMatch(/imp\.json|\{\{/);
    },
  );

  for (const seam of ["onFile", "onDrop"] as const) {
    it.each(["de", "en", "nl"])(
      `R8 ${seam}: Syntax und Struktur ergeben verschiedene Toast-Texte in %s`,
      async (lng) => {
        const create = vi.spyOn(endpoints.library.importCandidates, "create").mockResolvedValue([]);
        await mountPage(lng);
        await upload('[{"title":"A",', seam);
        await upload('[{"title":"A","statement":"B","category":"C","type":"unfug"}]', seam);
        const texts = [...container.querySelectorAll("output")].map((el) => el.textContent);
        expect(texts).toHaveLength(2);
        expect(texts[0], "R8 Syntax und Struktur muessen verschiedene Toast-Texte haben").not.toBe(
          texts[1],
        );
        expect(texts[0]).toMatch(/Editor|editor/);
        expect(texts[1]).toContain("1");
        expect(texts[1]).toContain("type");
        expect(texts.join(" ")).not.toMatch(/item-\d|not-array|imp\./);
        expect(create).not.toHaveBeenCalled();
      },
    );
  }

  it("leere Liste bleibt erfolgreich: null Kandidaten, kein Parserfehler", async () => {
    const create = vi.spyOn(endpoints.library.importCandidates, "create").mockResolvedValue([]);
    await mountPage();
    await upload("[]", "onFile");
    expect(create).toHaveBeenCalledWith([]);
    expect(container.querySelector('output[data-kind="success"]')?.textContent).toBe(
      i18n.t("imp.parsed", { n: 0 }),
    );
    expect(container.querySelector('output[data-kind="error"]')).toBeNull();
  });

  it("Nicht-Parser-Fehler behalten state.error", async () => {
    const create = vi.spyOn(endpoints.library.importCandidates, "create").mockResolvedValue([]);
    await mountPage();
    await upload("", "onFile", true);
    expect(container.querySelector("output")?.textContent).toBe(i18n.t("state.error"));
    expect(create).not.toHaveBeenCalled();
  });

  it("Format bleibt auch bei gesperrtem Upload sichtbar", async () => {
    await React.act(async () =>
      root.render(
        <MemoryRouter>
          <ImportJsonUpload
            dragOver={false}
            setDragOver={() => {}}
            onDrop={() => {}}
            onFile={() => {}}
            disabled
          />
        </MemoryRouter>,
      ),
    );
    expect(container.querySelector<HTMLInputElement>(`#${JSON_UPLOAD_INPUT_ID}`)?.disabled).toBe(
      true,
    );
    expect(container.querySelector<HTMLInputElement>(`#${JSON_UPLOAD_INPUT_ID}`)?.accept).toBe(
      ".json,application/json",
    );
    expect(container.textContent).toContain("negativwissen");
    expect(container.querySelector("textarea")?.value).toContain('"title"');
  });
});
