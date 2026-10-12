// @vitest-environment jsdom
// ================================================================================================
// OCR-03 · Nacharbeit 4 (Bens Befund „datei-automatik“) — DER DATEILAUF FOLGT KONTO UND EINSTELLUNG.
// ================================================================================================
//
// Gemountet über die Hülle aus `tests/entwurf-verlassen/` (echter Baum, echte Ablegezone des
// Dateiimports). Bereitgestellt wird eine echte PowerPoint (`deck.ts`: drei eingebettete Bilder).
// Ersetzt sind die Texterkennung (liest die Marke aus den Bildbytes; das erste Bild wartet, bis der
// Test es freigibt) und der Draht des Assistenzprofils. Der bestätigte Profilstand ist echt.
//
//   D1  K4 — Ausschalten, während das erste Bild gelesen wird: es wird fertig gelesen, KEIN weiteres
//       Bild startet, die übrigen stehen sichtbar als „nicht gelesen · Automatik aus“ da.
//   D2  K6 — Kontowechsel während des Laufs: kein weiteres Bild startet, und die Rückgabe des
//       überholten Kontos erscheint nicht als gelesener Befund.
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
import i18n from "../../apps/web/src/i18n";
import {
  bestaetigeAssistenzProfil,
  ladeAssistenzProfil,
  verwerfeAssistenzProfil,
} from "../../apps/web/src/lib/assistenzProfil";
import {
  abbauen,
  dateiAblegen,
  flaeche,
  flush,
  grundzustand,
  mount,
} from "../entwurf-verlassen/huelle";
import { TEXT_JE_MARKE, deck, markeAus } from "./deck";

const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

function profilMit(bildAutomatik: boolean): AssistenzProfilAntwort {
  return {
    profil: {
      name: null,
      avatar: null,
      bewegung: "standard",
      eingerichtetAm: null,
      fassung: 1,
      geaendertAm: "2026-10-13T08:00:00.000Z",
      bildAutomatik,
    },
    einrichtungOffen: true,
  };
}

/** Die PowerPoint als Datei. `arrayBuffer` wird nur ergänzt, falls die Testumgebung ihn nicht hat. */
function pptxDatei(): File {
  const datei = new File([deck()], "wartung.pptx", { type: PPTX_MIME });
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

async function bis(bedingung: () => boolean, runden = 80): Promise<void> {
  for (let i = 0; i < runden && !bedingung(); i += 1) {
    await act(async () => {
      await flush();
      await new Promise((r) => setTimeout(r, 5));
    });
  }
}

function befunde(): { status: string | null; text: string; zeile: string }[] {
  return [
    ...flaeche().querySelectorAll<HTMLElement>(
      "[data-testid=datei-bild-befunde] [data-testid=bild-befund]",
    ),
  ].map((el) => ({
    status: el.getAttribute("data-status"),
    text: el.querySelector("[data-testid=bild-befund-text]")?.textContent ?? "",
    zeile: (el.textContent ?? "").replace(/\s+/g, " "),
  }));
}

function quellenStatus(): string | null {
  return (
    flaeche()
      .querySelector("[data-testid=datei-bild-befunde] [data-testid=bild-befunde]")
      ?.getAttribute("data-status") ?? null
  );
}

/** Das erste Bild (Marke A) wartet, bis `tor.oeffnen` gerufen wird; die übrigen lesen sofort. */
function torEngine(tor: { oeffnen?: () => void }): void {
  steuerung.ocr.mockImplementation(async (src: unknown): Promise<OcrResult> => {
    const marke = markeAus(String(src));
    if (marke === "A") {
      await new Promise<void>((r) => {
        tor.oeffnen = r;
      });
    }
    return { status: "success", text: (marke ? TEXT_JE_MARKE[marke] : "") ?? "" };
  });
}

let profile: Record<string, AssistenzProfilAntwort> = {};
let konto = "konto-a";

beforeEach(async () => {
  await grundzustand();
  steuerung.ocr.mockReset();
  profile = { "konto-a": profilMit(true), "konto-b": profilMit(true) };
  konto = "konto-a";
  vi.spyOn(assistenzProfilApi, "lesen").mockImplementation(
    async () => profile[konto] ?? { profil: null, einrichtungOffen: true },
  );
  await act(async () => {
    await ladeAssistenzProfil("konto-a");
  });
  await mount("/erfassen", "datei");
});

afterEach(() => {
  abbauen();
  verwerfeAssistenzProfil();
  vi.restoreAllMocks();
});

describe("Nacharbeit 4 · der Dateilauf folgt Einstellung und Konto", () => {
  it("D1 · Ausschalten während des Laufs: Fertiges bleibt, kein weiteres Bild startet", async () => {
    const tor: { oeffnen?: () => void } = {};
    torEngine(tor);
    await dateiAblegen(pptxDatei());
    await bis(() => steuerung.ocr.mock.calls.length === 1 && tor.oeffnen !== undefined);
    expect(steuerung.ocr).toHaveBeenCalledTimes(1);
    expect(quellenStatus()).toBe("laeuft");

    // Bestätigte Deaktivierung (derselbe Weg wie nach dem Speichern in Setup › Klara).
    await act(async () => {
      bestaetigeAssistenzProfil("konto-a", profilMit(false));
    });
    await act(async () => {
      tor.oeffnen?.();
    });
    await bis(() => quellenStatus() !== "laeuft");

    expect(steuerung.ocr).toHaveBeenCalledTimes(1);
    const b = befunde();
    expect(b.map((x) => x.status)).toEqual(["gelesen", "nicht-analysiert", "nicht-analysiert"]);
    expect(b[0]?.text).toBe(TEXT_JE_MARKE.A);
    expect(b[1]?.zeile).toContain(i18n.t("klarabildkontext.grund.automatikAus"));
    expect(b[2]?.zeile).toContain(i18n.t("klarabildkontext.grund.automatikAus"));
    expect(quellenStatus()).toBe("teilweise");
  });

  it("D2 · Kontowechsel während des Laufs: nichts startet weiter, nichts Überholtes erscheint", async () => {
    const tor: { oeffnen?: () => void } = {};
    torEngine(tor);
    await dateiAblegen(pptxDatei());
    await bis(() => steuerung.ocr.mock.calls.length === 1 && tor.oeffnen !== undefined);
    expect(steuerung.ocr).toHaveBeenCalledTimes(1);

    konto = "konto-b";
    await act(async () => {
      await ladeAssistenzProfil("konto-b");
    });
    await act(async () => {
      tor.oeffnen?.();
    });
    await bis(() => false, 30);

    // Kein weiteres Bild des überholten Laufs, und sein Ergebnis steht nicht als gelesen da.
    expect(steuerung.ocr).toHaveBeenCalledTimes(1);
    expect(befunde().some((x) => x.status === "gelesen")).toBe(false);
    expect(flaeche().textContent ?? "").not.toContain(TEXT_JE_MARKE.A);
  });
});
