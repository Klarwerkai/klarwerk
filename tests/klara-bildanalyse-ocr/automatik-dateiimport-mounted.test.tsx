// @vitest-environment jsdom
// ================================================================================================
// OCR-02 · EIN BEREITGESTELLTES BILD WIRD OHNE KLICK GELESEN — an der echten Erfassungsfläche.
// ================================================================================================
//
// Gemountet über die Hülle aus `tests/entwurf-verlassen/` (echter Baum, echte Ablegezone des
// Dateiimports). Ersetzt ist allein die Texterkennung (`runImageOcr`), damit Status und Fehlerfälle
// steuerbar sind; die echte Engine misst `tests-smoke/klara-bildautomatik-browser.spec.ts`.
//
//   A1  Bild ablegen → Erkennung läuft ohne Klick, Befund „vollständig", Text ist der Dateitext.
//   A2  Engine nicht verfügbar → Befund „nicht verfügbar", kein Text, keine Erfolgsangabe.
//   A3  Engine scheitert → „fehlgeschlagen"; der manuelle Knopf bleibt als zweiter Versuch.
//   A4  Unsichere Wörter sind im Befund gekennzeichnet, nichts ist ergänzt.
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
import i18n from "../../apps/web/src/i18n";
import { CAPTURE_FILE_TEXT } from "../../apps/web/src/lib/captureFromFile";
import {
  abbauen,
  dateiAblegen,
  flaeche,
  flush,
  grundzustand,
  klick,
  knopf,
  mount,
} from "../entwurf-verlassen/huelle";

// Ein echtes 1×1-PNG — der Inhalt ist für die ersetzte Engine gleichgültig, die Bytes sind es nicht.
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=";

function bild(name: string, zusatz = 0): File {
  const bytes = Uint8Array.from(atob(PNG), (c) => c.charCodeAt(0));
  // Ein abweichendes Byte am Ende macht eine andere Inhaltskennung — ein anderes Bild.
  const mit = new Uint8Array(bytes.length + 1);
  mit.set(bytes);
  mit[bytes.length] = zusatz;
  return new File([mit], name, { type: "image/png" });
}

/** Ablegen wie von Hand und warten, bis Lesen, Inhaltskennung und Erkennung durch sind. */
async function ablegen(datei: File): Promise<void> {
  await dateiAblegen(datei);
  for (let i = 0; i < 3; i += 1) {
    await act(flush);
  }
}

function panel(): HTMLElement | null {
  return flaeche().querySelector<HTMLElement>("[data-testid=bild-befunde]");
}

function befunde(): { status: string | null; text: string }[] {
  return [...flaeche().querySelectorAll<HTMLElement>("[data-testid=bild-befund]")].map((el) => ({
    status: el.getAttribute("data-status"),
    text: el.querySelector("[data-testid=bild-befund-text]")?.textContent ?? "",
  }));
}

function sichtbar(): string {
  return (flaeche().textContent ?? "").replace(/\s+/g, " ");
}

let zaehler = 0;

beforeEach(async () => {
  await grundzustand();
  steuerung.ocr.mockReset();
  zaehler += 1;
  await mount("/erfassen", "datei");
});

afterEach(() => {
  abbauen();
  vi.clearAllMocks();
});

describe("OCR-02 · Dateiimport: ein bereitgestelltes Bild wird automatisch gelesen", () => {
  it("A1 · ohne Klick erkannt, Befund vollständig, Text übernommen", async () => {
    steuerung.ocr.mockResolvedValue({ status: "success", text: "Ventil V3 vor Wartung schließen" });
    await ablegen(bild("aushang.png", zaehler));

    expect(steuerung.ocr).toHaveBeenCalledTimes(1);
    expect(panel()?.getAttribute("data-status")).toBe("vollstaendig");
    expect(befunde()).toEqual([{ status: "gelesen", text: "Ventil V3 vor Wartung schließen" }]);
    expect(sichtbar()).toContain(
      i18n.t("bildautomatik.quelle.vollstaendig", { name: "aushang.png", gesamt: 1 }),
    );
    // Der manuelle Knopf ist nicht mehr nötig: es gibt schon Text.
    expect(sichtbar()).not.toContain(i18n.t(CAPTURE_FILE_TEXT.ocrCta));
  });

  it("A2 · Engine nicht verfügbar → ehrlich „nicht verfügbar“, kein gelesener Text", async () => {
    steuerung.ocr.mockResolvedValue({ status: "unavailable", text: "" });
    await ablegen(bild("aushang.png", zaehler));

    expect(steuerung.ocr).toHaveBeenCalledTimes(1);
    expect(panel()?.getAttribute("data-status")).toBe("nicht-verfuegbar");
    expect(befunde()).toEqual([{ status: "nicht-verfuegbar", text: "" }]);
    expect(sichtbar()).not.toContain(i18n.t("bildautomatik.status.gelesen"));
  });

  it("A3 · Fehlschlag → „fehlgeschlagen“; der Knopf versucht es erneut und liest dann", async () => {
    steuerung.ocr.mockRejectedValueOnce(new Error("worker-crash"));
    await ablegen(bild("aushang.png", zaehler));
    expect(panel()?.getAttribute("data-status")).toBe("fehlgeschlagen");
    expect(befunde()).toEqual([{ status: "fehlgeschlagen", text: "" }]);

    steuerung.ocr.mockResolvedValueOnce({ status: "success", text: "Zweiter Versuch gelesen" });
    await klick(knopf(i18n.t(CAPTURE_FILE_TEXT.ocrCta)));
    expect(steuerung.ocr).toHaveBeenCalledTimes(2);
    expect(sichtbar()).not.toContain(i18n.t(CAPTURE_FILE_TEXT.ocrCta));
  });

  it("A4 · unsichere und unleserliche Wörter sind gekennzeichnet, nicht ergänzt", async () => {
    steuerung.ocr.mockResolvedValue({
      status: "success",
      text: "Druck 4,5 bar xq7",
      woerter: [
        { text: "Druck", confidence: 95 },
        { text: "4,5", confidence: 45 },
        { text: "bar", confidence: 91 },
        { text: "xq7", confidence: 12 },
      ],
    });
    await ablegen(bild("aushang.png", zaehler));

    expect(befunde()).toEqual([{ status: "gelesen", text: "Druck [?4,5] bar [unleserlich]" }]);
    expect(sichtbar()).toContain(i18n.t("bildautomatik.unsicher", { n: 2 }));
  });
});
