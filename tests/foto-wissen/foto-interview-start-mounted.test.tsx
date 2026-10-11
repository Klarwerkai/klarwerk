// @vitest-environment jsdom
// ================================================================================================
// R-1624 · FOTO-ZU-WISSEN — der Einstieg, am echten Bedienweg gemessen.
// ================================================================================================
//
//   S1  Foto wählen sendet NICHTS. Erst „Bild auswerten" ruft die Bildbeschreibung — genau einmal,
//       mit genau diesem Foto. Der erkannte Kontext erscheint als KI-Vorschlag zum Korrigieren.
//   S2  „Foto-Interview starten" übergibt Foto und den KORRIGIERTEN Befund — nicht den Vorschlag.
//   S3  Ohne Bildmodell (oder ohne Ergebnis) gibt es keinen erfundenen Befund: der Mensch schreibt
//       ihn selbst, und ohne Befund startet nichts.
//   S4  Foto-Wechsel (Ben, Nacharbeit 2): während das neue Foto eingelesen wird, ist das alte weg
//       und nicht auswertbar; ein überholtes Einlesen überschreibt die letzte Auswahl nicht, und
//       eine späte Auswertung des alten Fotos erscheint nicht als Befund des neuen.
// jsdom hat keine Canvas-Pipeline: das Verkleinern ist ersetzt und liefert ein festes 1×1-PNG
// (in S4 gezielt verzögert, damit das Zeitfenster des Wechsels überhaupt existiert).
import { afterEach, describe, expect, it, vi } from "vitest";

const { PNG } = vi.hoisted(() => ({
  PNG: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
}));

vi.mock("../../apps/web/src/lib/files", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../apps/web/src/lib/files")>();
  return { ...actual, fileToThumbDataUrl: vi.fn(async () => PNG) };
});
vi.mock("../../apps/web/src/components/AiModelInfo", () => ({ AiModelInfo: () => null }));

import { act, createElement } from "../../apps/web/node_modules/react";
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { DescribeImageResult } from "../../apps/web/src/api/types";
import { FotoInterviewStart } from "../../apps/web/src/components/FotoInterviewStart";
import i18n from "../../apps/web/src/i18n";
import { fileToThumbDataUrl } from "../../apps/web/src/lib/files";
import type { FotoAnker } from "../../apps/web/src/lib/fotoInterview";
import { mitBildbeschreibung } from "../capture/bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BEFUND = "Kehlnaht an einem Stahlträger mit Riss am Nahtübergang.";

let host: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  host = null;
  root = null;
  vi.clearAllMocks();
});

async function montiere(
  describe: ((dataUrl: string, context?: string) => Promise<DescribeImageResult>) | undefined,
  available: boolean,
  onStart: (foto: FotoAnker) => void,
): Promise<HTMLDivElement> {
  await i18n.changeLanguage("de");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const el = host;
  await act(async () => {
    root?.render(
      mitBildbeschreibung(createElement(FotoInterviewStart, { onStart }), describe, available),
    );
  });
  return el;
}

function knopf(el: HTMLElement, schluessel: string): HTMLButtonElement | null {
  const text = i18n.t(schluessel);
  return (
    [...el.querySelectorAll<HTMLButtonElement>("button")].find(
      (b) => (b.textContent ?? "").trim() === text,
    ) ?? null
  );
}

async function waehleFoto(el: HTMLElement): Promise<void> {
  const input = el.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) {
    throw new Error("Kein Dateifeld für das Foto");
  }
  const datei = new File([new Uint8Array([1, 2, 3])], "schaden.jpg", { type: "image/jpeg" });
  Object.defineProperty(input, "files", { configurable: true, value: [datei] });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function tippe(feld: HTMLTextAreaElement, wert: string): Promise<void> {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(feld, wert);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("R-1624 S1 · erst der bewusste Klick sendet das Foto", () => {
  it("Foto wählen ruft nichts; „Bild auswerten“ genau einmal mit diesem Foto", async () => {
    const describeImage = vi.fn(
      async (_dataUrl: string, _context?: string): Promise<DescribeImageResult> => ({
        text: BEFUND,
        demo: false,
      }),
    );
    const el = await montiere(describeImage, true, vi.fn());

    expect(el.textContent).toContain(i18n.t("fotowissen.titel"));
    expect(knopf(el, "fotowissen.auswerten")).toBeNull();

    await waehleFoto(el);
    expect(el.querySelector(`img[src="${PNG}"]`)).not.toBeNull();
    expect(describeImage).not.toHaveBeenCalled();

    const auswerten = knopf(el, "fotowissen.auswerten");
    expect(auswerten).not.toBeNull();
    await act(async () => auswerten?.click());

    expect(describeImage).toHaveBeenCalledTimes(1);
    expect(describeImage.mock.calls[0]).toEqual([PNG]);
    const feld = el.querySelector<HTMLTextAreaElement>("textarea");
    expect(feld?.value).toBe(BEFUND);
    expect(el.textContent).toContain(i18n.t("fotowissen.befundKi"));
  });
});

describe("R-1624 S2 · gestartet wird mit dem bestätigten Befund", () => {
  it("die Korrektur des Menschen geht in das Interview, nicht der Vorschlag", async () => {
    const onStart = vi.fn();
    const el = await montiere(async () => ({ text: BEFUND, demo: false }), true, onStart);
    await waehleFoto(el);
    await act(async () => knopf(el, "fotowissen.auswerten")?.click());

    const feld = el.querySelector<HTMLTextAreaElement>("textarea");
    if (!feld) {
      throw new Error("Kein Befundfeld");
    }
    await tippe(feld, "Kehlnaht am Kranträger KT-3, Riss am Nahtübergang.");
    await act(async () => knopf(el, "fotowissen.starten")?.click());

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith({
      dataUrl: PNG,
      befund: "Kehlnaht am Kranträger KT-3, Riss am Nahtübergang.",
    });
  });
});

describe("R-1624 S3 · kein erfundener Befund", () => {
  it("ohne nutzbares Bildmodell: kein Auswerten, der Mensch beschreibt selbst", async () => {
    const onStart = vi.fn();
    const el = await montiere(undefined, false, onStart);
    await waehleFoto(el);

    expect(knopf(el, "fotowissen.auswerten")).toBeNull();
    expect(el.textContent).toContain(i18n.t("fotowissen.befundOhneKi"));
    const start = knopf(el, "fotowissen.starten");
    expect(start?.disabled).toBe(true);

    const feld = el.querySelector<HTMLTextAreaElement>("textarea");
    if (!feld) {
      throw new Error("Kein Befundfeld");
    }
    expect(feld.value).toBe("");
    await tippe(feld, "Lagerschale der Pumpe P2");
    expect(knopf(el, "fotowissen.starten")?.disabled).toBe(false);
    await act(async () => knopf(el, "fotowissen.starten")?.click());
    expect(onStart).toHaveBeenCalledWith({ dataUrl: PNG, befund: "Lagerschale der Pumpe P2" });
  });

  it("Modell ohne Ergebnis (z. B. vertraulich): leeres Feld, ehrlicher Hinweis, kein Start", async () => {
    const onStart = vi.fn();
    const el = await montiere(
      async () => ({ text: null, demo: true, fallbackReason: "confidential" }),
      true,
      onStart,
    );
    await waehleFoto(el);
    await act(async () => knopf(el, "fotowissen.auswerten")?.click());

    expect(el.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe("");
    expect(el.textContent).toContain(i18n.t("fotowissen.befundOhneKi"));
    expect(el.textContent).not.toContain(i18n.t("fotowissen.befundKi"));
    expect(knopf(el, "fotowissen.starten")?.disabled).toBe(true);
    expect(onStart).not.toHaveBeenCalled();
  });

  it("Fehlschlag der Auswertung: eigener Hinweis, Befund bleibt beim Menschen", async () => {
    const el = await montiere(
      async () => {
        throw new Error("Netz weg");
      },
      true,
      vi.fn(),
    );
    await waehleFoto(el);
    await act(async () => knopf(el, "fotowissen.auswerten")?.click());
    expect(el.textContent).toContain(i18n.t("fotowissen.befundFehler"));
    expect(el.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe("");
  });
});

// Zwei unterscheidbare, sichere Bildquellen für den Wechsel (nur das Präfix zählt für die Prüfung).
// FOTO_ALT ist das, was das ersetzte Einlesen standardmäßig liefert.
const FOTO_ALT = PNG;
const FOTO_NEU =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mNk+M9QzwAEjDAGACCDAf8j8Fk3AAAAAElFTkSuQmCC";

interface Aufschub<T> {
  promise: Promise<T>;
  aufloesen: (wert: T) => void;
  abweisen: (fehler: Error) => void;
}

function aufschub<T>(): Aufschub<T> {
  let aufloesen: (wert: T) => void = () => {};
  let abweisen: (fehler: Error) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    aufloesen = res;
    abweisen = rej;
  });
  return { promise, aufloesen, abweisen };
}

const einlesen = vi.mocked(fileToThumbDataUrl);

describe("R-1624 S4 · Foto-Wechsel während des Einlesens und Auswertens", () => {
  it("das alte Foto ist während des Einlesens weg — keine Auswertung, kein Start", async () => {
    const describeImage = vi.fn(
      async (_dataUrl: string, _context?: string): Promise<DescribeImageResult> => ({
        text: BEFUND,
        demo: false,
      }),
    );
    const el = await montiere(describeImage, true, vi.fn());
    await waehleFoto(el);
    expect(el.querySelector(`img[src="${FOTO_ALT}"]`)).not.toBeNull();
    expect(knopf(el, "fotowissen.auswerten")).not.toBeNull();

    const neu = aufschub<string>();
    einlesen.mockImplementationOnce(() => neu.promise);
    await waehleFoto(el);

    expect(el.querySelector("img")).toBeNull();
    expect(knopf(el, "fotowissen.auswerten")).toBeNull();
    expect(knopf(el, "fotowissen.starten")).toBeNull();
    expect(el.querySelector("[data-foto-interview]")?.getAttribute("aria-busy")).toBe("true");

    await act(async () => neu.aufloesen(FOTO_NEU));
    expect(el.querySelector(`img[src="${FOTO_NEU}"]`)).not.toBeNull();
    await act(async () => knopf(el, "fotowissen.auswerten")?.click());
    expect(describeImage.mock.calls.map((c) => c[0])).toEqual([FOTO_NEU]);
  });

  it("ein überholtes Einlesen überschreibt die zuletzt gewählte Auswahl nicht", async () => {
    const describeImage = vi.fn(
      async (_dataUrl: string, _context?: string): Promise<DescribeImageResult> => ({
        text: BEFUND,
        demo: false,
      }),
    );
    const el = await montiere(describeImage, true, vi.fn());
    const erstes = aufschub<string>();
    const zweites = aufschub<string>();
    einlesen.mockImplementationOnce(() => erstes.promise);
    einlesen.mockImplementationOnce(() => zweites.promise);
    await waehleFoto(el);
    await waehleFoto(el);

    // Das zuletzt gewählte Foto ist zuerst fertig …
    await act(async () => zweites.aufloesen(FOTO_NEU));
    expect(el.querySelector(`img[src="${FOTO_NEU}"]`)).not.toBeNull();
    // … das überholte kommt danach und darf es NICHT ersetzen.
    await act(async () => erstes.aufloesen(FOTO_ALT));
    expect(el.querySelector(`img[src="${FOTO_ALT}"]`)).toBeNull();
    expect(el.querySelector(`img[src="${FOTO_NEU}"]`)).not.toBeNull();

    await act(async () => knopf(el, "fotowissen.auswerten")?.click());
    expect(describeImage.mock.calls.map((c) => c[0])).toEqual([FOTO_NEU]);
  });

  it("ein überholtes Einlese-Fehlschlagen meldet keinen Fehler für die neue Auswahl", async () => {
    const el = await montiere(undefined, true, vi.fn());
    const erstes = aufschub<string>();
    einlesen.mockImplementationOnce(() => erstes.promise);
    await waehleFoto(el);
    await waehleFoto(el); // Standard: sofort FOTO_ALT
    await act(async () => erstes.abweisen(new Error("no-canvas")));
    expect(el.textContent).not.toContain(i18n.t("fotowissen.bildFehler"));
    expect(el.querySelector(`img[src="${FOTO_ALT}"]`)).not.toBeNull();
  });

  it("eine späte Auswertung des alten Fotos erscheint nicht als Befund des neuen", async () => {
    const alteAuswertung = aufschub<DescribeImageResult>();
    const describeImage = vi.fn(
      (_dataUrl: string, _context?: string): Promise<DescribeImageResult> => alteAuswertung.promise,
    );
    const onStart = vi.fn();
    const el = await montiere(describeImage, true, onStart);
    await waehleFoto(el);
    await act(async () => knopf(el, "fotowissen.auswerten")?.click());
    expect(describeImage).toHaveBeenCalledTimes(1);

    einlesen.mockImplementationOnce(async () => FOTO_NEU);
    await waehleFoto(el);
    await act(async () =>
      alteAuswertung.aufloesen({ text: "Befund des alten Fotos", demo: false }),
    );

    expect(el.querySelector(`img[src="${FOTO_NEU}"]`)).not.toBeNull();
    expect(el.textContent).not.toContain(i18n.t("fotowissen.befundKi"));
    expect(el.querySelector("textarea")).toBeNull();
    // Das neue Foto steht wieder am Anfang: erst auswerten, dann starten.
    expect(knopf(el, "fotowissen.auswerten")).not.toBeNull();
    expect(knopf(el, "fotowissen.starten")).toBeNull();
    expect(onStart).not.toHaveBeenCalled();
  });
});
