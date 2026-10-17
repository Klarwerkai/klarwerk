// @vitest-environment jsdom
// ================================================================================================
// OCR-E02 · Nacharbeit 2 (Bens Befund „gleichnamige Dokumente“) — DIE QUELLE IST DIE DATEI SELBST.
// ================================================================================================
//
// Auftrag produkt:20261012:klara-ocr-fundstellen-korrekturen, Kriterien K6 und K8.
//
// Gemountet über die Hülle aus `tests/entwurf-verlassen/` (echter Erfassen-Baum, echte Ablegezone
// des Dateiimports), wie `datei-automatik-lauf-mounted.test.tsx`. Ersetzt sind die Texterkennung
// (liest die Marke aus den Bildbytes) und die Drähte des Assistenzprofils und der Berichtigungen
// (je ein kleiner Server im Speicher). Import, Analyse, Quellbildung, Anzeige und Berichtigung sind
// echt.
//
//   Q1  Zwei VERSCHIEDENE Dokumente mit demselben Namen und demselben Bild auf Folie 1: die
//       Berichtigung in A gilt in B nicht; A unverändert wieder eingelesen trägt sie; nach
//       „Neuladen“ (Fläche neu, Stände verworfen) ebenso. Gebunden ist an `datei:sha256:…|<name>`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OcrResult } from "../../apps/web/src/lib/ocr";

const steuerung = vi.hoisted(() => ({
  ocr: vi.fn(async (_input: unknown): Promise<OcrResult> => ({ status: "success", text: "" })),
}));

vi.mock("../../apps/web/src/lib/files", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/web/src/lib/files")>()),
  runImageOcr: steuerung.ocr,
}));

vi.mock("../../apps/web/src/api/auth", async () =>
  (await import("../entwurf-verlassen/attrappen")).authAttrappe(),
);

vi.mock("../../apps/web/src/api/endpoints", async () =>
  (await import("../entwurf-verlassen/attrappen")).endpointsAttrappe(),
);

import { act } from "../../apps/web/node_modules/react";
import {
  type AssistenzProfilAntwort,
  assistenzProfilApi,
} from "../../apps/web/src/api/assistenzProfil";
import {
  type BildKorrekturAenderung,
  type BildKorrekturAntwort,
  type BildKorrekturDaten,
  bildKorrekturApi,
} from "../../apps/web/src/api/bildKorrekturen";
import {
  ladeAssistenzProfil,
  verwerfeAssistenzProfil,
} from "../../apps/web/src/lib/assistenzProfil";
import { verwerfeBildKorrekturen } from "../../apps/web/src/lib/bildKorrekturenStand";
import {
  abbauen,
  dateiAblegen,
  flaeche,
  flush,
  grundzustand,
  mount,
} from "../entwurf-verlassen/huelle";
import { TEXT_JE_MARKE, bildMit, deck, markeAus } from "./deck";

const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const NAME = "plan.pptx";

/** Eine PowerPoint als Datei (mit `arrayBuffer`, falls die Testumgebung ihn nicht hat). */
function pptxDatei(bytes: Uint8Array, name = NAME): File {
  const datei = new File([new Uint8Array(bytes).buffer], name, { type: PPTX_MIME });
  if (typeof (datei as { arrayBuffer?: unknown }).arrayBuffer !== "function") {
    Object.defineProperty(datei, "arrayBuffer", {
      value: () =>
        new Promise<ArrayBuffer>((resolve, reject) => {
          const leser = new FileReader();
          leser.onload = () => resolve(leser.result as ArrayBuffer);
          leser.onerror = () => reject(leser.error);
          leser.readAsArrayBuffer(datei);
        }),
    });
  }
  return datei;
}

// Dokument A und B: dasselbe Bild A auf Folie 1, aber ein anderes Bild auf Folie 2 — also zwei
// verschiedene Dateien mit demselben Namen.
const DOKUMENT_A = deck();
const DOKUMENT_B = deck(bildMit("B2"));

const PROFIL: AssistenzProfilAntwort = {
  profil: {
    name: null,
    avatar: null,
    bewegung: "standard",
    eingerichtetAm: null,
    fassung: 1,
    geaendertAm: "2026-10-13T08:00:00.000Z",
    bildAutomatik: true,
  },
  einrichtungOffen: true,
};

let gespeichert: BildKorrekturDaten[] = [];
let aufrufe: BildKorrekturAenderung[] = [];

function sicht(): BildKorrekturAntwort {
  return { darfBearbeiten: true, korrekturen: gespeichert.map((k) => ({ ...k })) };
}

async function bis(bedingung: () => boolean, runden = 120): Promise<void> {
  for (let i = 0; i < runden && !bedingung(); i += 1) {
    await act(async () => {
      await flush();
      await new Promise((r) => setTimeout(r, 5));
    });
  }
}

const auswahl = "[data-testid=datei-bild-befunde]";

function zeile(index: number): HTMLElement | null {
  const zeilen = flaeche().querySelectorAll<HTMLElement>(`${auswahl} [data-testid=bild-befund]`);
  return zeilen[index] ?? null;
}

function text(index: number): string {
  return zeile(index)?.querySelector("[data-testid=bild-befund-text]")?.textContent ?? "";
}

function berichtigt(index: number): string | null {
  const el = zeile(index)?.querySelector("[data-testid=bild-berichtigung]");
  return el?.getAttribute("data-berichtigt") ?? null;
}

function fertig(): boolean {
  const status = flaeche()
    .querySelector(`${auswahl} [data-testid=bild-befunde]`)
    ?.getAttribute("data-status");
  return Boolean(status) && status !== "laeuft" && status !== "wartet";
}

/** Eine Datei ablegen und warten, bis Befund UND gespeicherte Berichtigungen da sind. */
async function einlesen(bytes: Uint8Array, name = NAME): Promise<void> {
  await dateiAblegen(pptxDatei(bytes, name));
  const bearbeitbar = (): boolean =>
    Boolean(zeile(0)?.querySelector("[data-testid=bild-berichtigung-bearbeiten]"));
  await bis(() => fertig() && bearbeitbar());
}

async function klick(el: Element | null | undefined): Promise<void> {
  await act(async () => {
    (el as HTMLButtonElement).click();
    await flush();
  });
  await bis(() => false, 10);
}

async function tippe(el: Element | null | undefined, wert: string): Promise<void> {
  const feld = el as HTMLTextAreaElement;
  const setzer = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  await act(async () => {
    setzer?.call(feld, wert);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(async () => {
  await grundzustand();
  gespeichert = [];
  aufrufe = [];
  steuerung.ocr.mockReset();
  steuerung.ocr.mockImplementation(async (src: unknown): Promise<OcrResult> => {
    const marke = markeAus(String(src));
    return { status: "success", text: (marke ? TEXT_JE_MARKE[marke] : "") ?? "" };
  });
  vi.spyOn(assistenzProfilApi, "lesen").mockImplementation(async () => PROFIL);
  vi.spyOn(bildKorrekturApi, "lesen").mockImplementation(async () => sicht());
  vi.spyOn(bildKorrekturApi, "aendern").mockImplementation(async (a) => {
    aufrufe.push(a);
    gespeichert = gespeichert.filter(
      (k) => !(k.quelle === a.quelle && k.inhaltskennung === a.inhaltskennung),
    );
    if (a.aktion === "setzen") {
      gespeichert.push({
        quelle: a.quelle,
        inhaltskennung: a.inhaltskennung,
        ort: a.ort ?? null,
        text: a.text,
        schritte: 0,
        geaendertAm: "2026-10-13T09:00:00.000Z",
      });
    }
    return sicht();
  });
  await act(async () => {
    await ladeAssistenzProfil("konto-a");
  });
  await mount("/erfassen", "datei");
});

afterEach(() => {
  abbauen();
  verwerfeAssistenzProfil();
  verwerfeBildKorrekturen();
  vi.restoreAllMocks();
});

describe("Q1 · K6/K8 — gleichnamige verschiedene Dokumente teilen keine Berichtigung", () => {
  it("A berichtigt; B (gleicher Name, gleiches Bild) bleibt roh; A wieder eingelesen trägt sie", async () => {
    await einlesen(DOKUMENT_A);
    expect(text(0)).toBe(TEXT_JE_MARKE.A);

    await klick(zeile(0)?.querySelector("[data-testid=bild-berichtigung-bearbeiten]"));
    await tippe(zeile(0)?.querySelector("[data-testid=bild-berichtigung-feld]"), "PRUEFKARTE 74");
    await klick(zeile(0)?.querySelector("[data-testid=bild-berichtigung-speichern]"));
    await bis(() => text(0) === "PRUEFKARTE 74");
    expect(text(0)).toBe("PRUEFKARTE 74");
    // Gebunden an die Datei selbst (Inhalt und Name), nicht an den Namen allein.
    const quelleA = aufrufe[0]?.quelle ?? "";
    expect(quelleA).toMatch(/^datei:sha256:[0-9a-f]{64}\|plan\.pptx$/);

    // Ein ANDERES Dokument gleichen Namens mit demselben Bild auf Folie 1: keine Übertragung.
    await einlesen(DOKUMENT_B);
    expect(text(0)).toBe(TEXT_JE_MARKE.A);
    expect(berichtigt(0)).toBe("false");

    // Dasselbe Dokument A unverändert wieder eingelesen: die Berichtigung gilt.
    await einlesen(DOKUMENT_A);
    await bis(() => text(0) === "PRUEFKARTE 74");
    expect(text(0)).toBe("PRUEFKARTE 74");
    expect(berichtigt(0)).toBe("true");

    // Dieselben Bytes unter einem anderen Namen sind eine andere Quelle (keine neue Übertragung).
    await einlesen(DOKUMENT_A, "plan-kopie.pptx");
    expect(text(0)).toBe(TEXT_JE_MARKE.A);

    // „Neuladen“: Fläche neu, Browserstände verworfen — A trägt die Berichtigung weiter, B nicht.
    abbauen();
    verwerfeBildKorrekturen();
    await mount("/erfassen", "datei");
    await einlesen(DOKUMENT_A);
    await bis(() => text(0) === "PRUEFKARTE 74");
    expect(text(0)).toBe("PRUEFKARTE 74");
    await einlesen(DOKUMENT_B);
    expect(text(0)).toBe(TEXT_JE_MARKE.A);
    // Es gibt genau eine gespeicherte Berichtigung — die von A.
    expect(gespeichert.map((k) => k.quelle)).toEqual([quelleA]);
  });
});
