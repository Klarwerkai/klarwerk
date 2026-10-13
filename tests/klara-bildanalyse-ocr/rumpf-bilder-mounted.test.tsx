// @vitest-environment jsdom
// ================================================================================================
// OCR-02 · Nacharbeit 3 (Bens Befund 1/2) — BILDER IM TEXT WERDEN OHNE KLICK GELESEN.
// ================================================================================================
//
// Gemountet ist die Komponente, die JEDER RichTextEditor trägt (Erfassen, Blatt, Studio, Artikel,
// gemeinsamer Entwurf — und damit auch Entwürfe aus „Klara in Word“ und der Browser-Erweiterung).
// Ersetzt sind die Texterkennung (liest die Marke aus den Bildbytes) und der Beschreibungsweg (W02,
// über die Test-Naht `ImageDescribeValueProvider`). Der Objektspeicher antwortet über `fetch`.
//
//   R1  eingebettete UND gespeicherte Bilder: Reihenfolge, Text und Bildinhalt — „vollständig“.
//   R2  die Einstufung erlaubt kein Modell: Text ja, Bildinhalt „nicht zulässig“ — „teilweise“.
//   R3  Weitertippen ohne Bildänderung: keine neue Erkennung, kein neuer Lauf.
//   R4  der Editor trägt die Komponente wirklich.
//   R5  (Nacharbeit 5) Bild ersetzt: der alte Befund ist sofort weg; der neue Lauf läuft trotz
//       fortgesetzter Eingabe ohne Pause zu Ende, das unveränderte Bild wird wiederverwendet.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OcrResult } from "../../apps/web/src/lib/ocr";

const steuerung = vi.hoisted(() => ({
  ocr: vi.fn(async (_src: unknown): Promise<OcrResult> => ({ status: "success", text: "" })),
}));

vi.mock("../../apps/web/src/lib/files", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/web/src/lib/files")>()),
  runImageOcr: steuerung.ocr,
}));

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { DescribeImageResult } from "../../apps/web/src/api/types";
import {
  type ImageDescribeValue,
  ImageDescribeValueProvider,
} from "../../apps/web/src/app/ImageDescribeContext";
import { BildBefundeImRumpf } from "../../apps/web/src/components/BildBefundeImRumpf";
import i18n from "../../apps/web/src/i18n";
import { TEXT_JE_MARKE, bildMit, dataUrl, markeAus } from "./deck";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const GESPEICHERT = "/api/objects/obj-9/raw";

function rumpf(zusatz = ""): string {
  return [
    `<p>Einleitung</p><figure><img data-image-id="kw-fig-1" src="${dataUrl(bildMit("A"))}"></figure>`,
    `<p>Gespeichert</p><figure><img data-image-id="kw-fig-2" src="${GESPEICHERT}"></figure>`,
    zusatz,
  ].join("");
}

function wert(describe: ImageDescribeValue["describe"]): ImageDescribeValue {
  return { available: true, describe };
}

/** Rendern, ohne irgendetwas abzuwarten — wie ein Tastendruck. */
async function zeigeSofort(html: string, weg: ImageDescribeValue): Promise<void> {
  await act(async () => {
    root.render(
      createElement(ImageDescribeValueProvider, {
        value: weg,
        children: createElement(BildBefundeImRumpf, { html }),
      }),
    );
  });
}

/** Erkennung, Kennung, Laden und Beschreibung abwarten. */
async function abwarten(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
  }
}

async function zeige(html: string, weg: ImageDescribeValue): Promise<void> {
  await zeigeSofort(html, weg);
  await abwarten();
}

function lauf(): string | null {
  return container.querySelector("[data-testid=bild-befunde]")?.getAttribute("data-lauf") ?? null;
}

interface Abgelesen {
  status: string | null;
  inhalt: string | null;
  text: string;
  zeile: string;
}

function befunde(): Abgelesen[] {
  return [...container.querySelectorAll<HTMLElement>("[data-testid=bild-befund]")].map((el) => ({
    status: el.getAttribute("data-status"),
    inhalt: el.getAttribute("data-bildinhalt"),
    text: el.querySelector("[data-testid=bild-befund-text]")?.textContent ?? "",
    zeile: (el.textContent ?? "").replace(/\s+/g, " "),
  }));
}

function quellenStatus(): string | null {
  return container.querySelector("[data-testid=bild-befunde]")?.getAttribute("data-status") ?? null;
}

const objektspeicher = vi.fn(async (_href: string) => ({
  ok: true,
  blob: async () => new Blob([new Uint8Array(bildMit("C")).buffer], { type: "image/png" }),
}));

beforeEach(async () => {
  await i18n.changeLanguage("de");
  steuerung.ocr.mockReset();
  steuerung.ocr.mockImplementation(async (src: unknown): Promise<OcrResult> => {
    const marke = markeAus(String(src));
    return { status: "success", text: (marke ? TEXT_JE_MARKE[marke] : "") ?? "" };
  });
  objektspeicher.mockClear();
  vi.stubGlobal("fetch", objektspeicher);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("OCR-02 · Bilder im Text eines Entwurfs oder Wissensobjekts", () => {
  it("R1 · eingebettete und gespeicherte Bilder: Text und Bildinhalt, in Reihenfolge, ohne Klick", async () => {
    const describe = vi.fn(
      async (src: string): Promise<DescribeImageResult> => ({
        text: `Schild am Ventil (${markeAus(src) ?? "?"})`,
        demo: false,
      }),
    );
    await zeige(rumpf(), wert(describe));

    // Nacharbeit 5: der Abruf trägt das Abbruchsignal der Ladefrist.
    expect(objektspeicher).toHaveBeenCalledWith(
      GESPEICHERT,
      expect.objectContaining({ credentials: "same-origin", signal: expect.any(AbortSignal) }),
    );
    expect(steuerung.ocr).toHaveBeenCalledTimes(2);
    expect(befunde().map(({ status, inhalt, text }) => ({ status, inhalt, text }))).toEqual([
      { status: "gelesen", inhalt: "beschrieben", text: TEXT_JE_MARKE.A },
      { status: "gelesen", inhalt: "beschrieben", text: TEXT_JE_MARKE.C },
    ]);
    expect(befunde()[1]?.zeile).toContain("Schild am Ventil (C)");
    expect(quellenStatus()).toBe("vollstaendig");
  });

  it("R2 · die Einstufung erlaubt kein Modell: Bildinhalt „nicht zulässig“, Quelle „teilweise“", async () => {
    const describe = vi.fn(
      async (): Promise<DescribeImageResult> => ({
        text: null,
        demo: true,
        fallbackReason: "confidential",
      }),
    );
    await zeige(rumpf(), wert(describe));

    expect(befunde().map((b) => b.inhalt)).toEqual(["nicht-zulaessig", "nicht-zulaessig"]);
    expect(befunde().map((b) => b.status)).toEqual(["gelesen", "gelesen"]);
    expect(quellenStatus()).toBe("teilweise");
    expect(container.textContent).toContain(i18n.t("bildautomatik.bildinhalt.nichtZulaessig"));
  });

  it("R3 · Weitertippen ohne Bildänderung liest nichts neu und startet keinen Lauf", async () => {
    const describe = vi.fn(
      async (): Promise<DescribeImageResult> => ({ text: "Ein Schild", demo: false }),
    );
    const weg = wert(describe);
    await zeige(rumpf(), weg);
    expect(steuerung.ocr).toHaveBeenCalledTimes(2);
    expect(describe).toHaveBeenCalledTimes(2);
    const vorher = lauf();

    await zeige(rumpf("<p>Noch ein Satz.</p>"), weg);
    expect(steuerung.ocr).toHaveBeenCalledTimes(2);
    expect(describe).toHaveBeenCalledTimes(2);
    expect(lauf()).toBe(vorher);
    expect(befunde().map((b) => b.text)).toEqual([TEXT_JE_MARKE.A, TEXT_JE_MARKE.C]);
  });

  // Nacharbeit 5 (Bens Befund 1): Bildtausch während fortgesetzter Texteingabe.
  it("R5 · Bild ersetzt: alter Befund sofort weg, neuer Lauf trotz Weitertippen ohne Pause", async () => {
    const describe = vi.fn(
      async (): Promise<DescribeImageResult> => ({ text: "Ein Schild", demo: false }),
    );
    const weg = wert(describe);
    await zeige(rumpf(), weg);
    expect(befunde()[0]?.text).toBe(TEXT_JE_MARKE.A);

    // Das neue Bild (E) wird erst erkannt, wenn der Test es freigibt — so ist der Zwischenstand
    // nach dem Austausch ablesbar.
    const tor: { oeffnen?: () => void } = {};
    steuerung.ocr.mockImplementation(async (src: unknown): Promise<OcrResult> => {
      const marke = markeAus(String(src));
      if (marke === "E") {
        await new Promise<void>((r) => {
          tor.oeffnen = r;
        });
      }
      return { status: "success", text: (marke ? TEXT_JE_MARKE[marke] : "") ?? "" };
    });
    const ersetzt = (text: string): string =>
      rumpf(text).replace(dataUrl(bildMit("A")), dataUrl(bildMit("E")));

    // Austausch — ohne zu warten: der alte Text des ersetzten Bildes steht NICHT mehr als aktuell da.
    await zeigeSofort(ersetzt(""), weg);
    expect(befunde()[0]?.text).not.toBe(TEXT_JE_MARKE.A);
    expect(["wartet", "laeuft"]).toContain(befunde()[0]?.status);
    expect(quellenStatus()).toBe("laeuft");
    const neuerLauf = lauf();

    // Weitertippen: jeder Tastendruck ein neues Rendern, kein neuer Lauf, kein Aufschub.
    for (const text of ["<p>a</p>", "<p>ab</p>", "<p>abc</p>"]) {
      await zeigeSofort(ersetzt(text), weg);
      await abwarten();
    }
    expect(lauf()).toBe(neuerLauf);
    tor.oeffnen?.();
    await abwarten();

    expect(befunde().map((b) => [b.status, b.text])).toEqual([
      ["gelesen", TEXT_JE_MARKE.E],
      ["gelesen", TEXT_JE_MARKE.C],
    ]);
    // A und C früher, jetzt nur E neu — C ist unverändert und wurde wiederverwendet.
    expect(steuerung.ocr).toHaveBeenCalledTimes(3);
    expect(quellenStatus()).toBe("vollstaendig");
  });

  it("R4 · der Editor trägt die Automatik (jede Fläche mit RichTextEditor)", () => {
    const quelle = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/RichTextEditor.tsx"),
      "utf8",
    );
    expect(quelle).toContain("<BildBefundeImRumpf html={value} />");
  });
});
