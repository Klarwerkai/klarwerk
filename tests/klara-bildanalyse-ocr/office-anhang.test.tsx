// @vitest-environment node
// ================================================================================================
// OCR-02 · Nacharbeit 3 (Bens Befund 1) — OFFICE IM ARTIKEL (H06, Lücke L17).
// ================================================================================================
//
// Die eingebetteten Bilder eines angehängten bzw. als neue Fassung übernommenen `.pptx` werden über
// den vorhandenen Weg gelesen: Objektspeicher (`/api/objects/<id>/raw`) → `readPptxRich` (dieselbe
// Kette wie der Dateiimport) → Analyse. Ersetzt sind nur der Abruf (Bytes eines echten Decks) und
// die Texterkennung (liest die Marke aus den Bildbytes).
import { describe, expect, it, vi } from "vitest";
import {
  officeBildArt,
  officeBildEingang,
  ohneZugriff,
  wirdGeladen,
} from "../../apps/web/src/components/bibliothek/OfficeBildBefunde";
import { createBildAnalyse } from "../../apps/web/src/lib/bildAutomatik";
import { TEXT_JE_MARKE, bildMit, deck, markenEngine } from "./deck";

const ANHANG = { id: "anh-1", name: "wartung.pptx", objectId: "obj-1" };

function abruf(bytes: Uint8Array) {
  return vi.fn(async (_href: string) => new Blob([new Uint8Array(bytes).buffer]));
}

describe("OCR-02 · Office-Anhang im Artikel", () => {
  it("die Bilder der aktuellen Fassung: Folie, Reihenfolge, Text — über den Objektspeicherweg", async () => {
    const laden = abruf(deck());
    const eingang = await officeBildEingang(ANHANG, "pptx", laden);
    // Nacharbeit 5: der Abruf trägt ein Abbruchsignal (Ladefrist für Abruf UND Antwortkörper).
    expect(laden).toHaveBeenCalledWith("/api/objects/obj-1/raw", expect.any(AbortSignal));
    if (!eingang || eingang === "frist") {
      throw new Error("kein Eingang");
    }
    const befund = await createBildAnalyse({ erkenne: markenEngine() }).analysiereQuelle(eingang, {
      automatik: true,
    });
    expect(befund.befunde.map((b) => [b.fundstelle.folie, b.status, b.text])).toEqual([
      [1, "gelesen", TEXT_JE_MARKE.A],
      [2, "gelesen", TEXT_JE_MARKE.B],
      [2, "gelesen", TEXT_JE_MARKE.C],
    ]);
    expect(befund.nichtGelesen).toEqual([{ folie: 2, anzahl: 1 }]);
    expect(befund.status).toBe("teilweise");
  });

  it("neue Fassung mit einem geänderten Bild: genau eine neue Erkennung", async () => {
    const erkenne = markenEngine();
    const analyse = createBildAnalyse({ erkenne });
    const alt = await officeBildEingang(ANHANG, "pptx", abruf(deck()));
    const neu = await officeBildEingang(
      { ...ANHANG, objectId: "obj-2" },
      "pptx",
      abruf(deck(bildMit("B2"))),
    );
    if (!alt || !neu || alt === "frist" || neu === "frist") {
      throw new Error("kein Eingang");
    }
    await analyse.analysiereQuelle(alt, { automatik: true });
    const danach = await analyse.analysiereQuelle(neu, { automatik: true });
    expect(erkenne).toHaveBeenCalledTimes(4);
    expect(danach.befunde.map((b) => b.text)).toEqual([
      TEXT_JE_MARKE.A,
      TEXT_JE_MARKE.B2,
      TEXT_JE_MARKE.C,
    ]);
  });

  it("ohne Zugriff kein Befund, ungültige Kennung kein Abruf, Excel ohne Leser", async () => {
    expect(await officeBildEingang(ANHANG, "pptx", async () => null)).toBeNull();
    const laden = abruf(deck());
    expect(await officeBildEingang({ ...ANHANG, objectId: "../x" }, "pptx", laden)).toBeNull();
    expect(laden).not.toHaveBeenCalled();
    expect(officeBildArt("tabelle.xlsx")).toBeNull();
    expect(officeBildArt("Folien.PPTX")).toBe("pptx");
    expect(officeBildArt("bericht.docx")).toBe("docx");
  });

  // Nacharbeit 5 (Bens Befund 2): ein hängender Abruf blockiert nichts.
  it("hängender Abruf: nach der Ladefrist „frist“, der Abruf ist abgebrochen", async () => {
    const gesehen: { signal?: AbortSignal | undefined } = {};
    const haengt = vi.fn((_href: string, s?: AbortSignal) => {
      gesehen.signal = s;
      return new Promise<Blob | null>(() => {});
    });
    const ergebnis = await officeBildEingang(ANHANG, "pptx", haengt, 20);
    expect(ergebnis).toBe("frist");
    expect(gesehen.signal?.aborted).toBe(true);
  });

  it("vor dem Laden „wird geladen“, nach der Ladefrist sichtbar „fehlgeschlagen“ mit Grund", () => {
    expect(wirdGeladen("wartung.pptx", "pptx")).toMatchObject({ status: "laeuft", befunde: [] });
    expect(ohneZugriff("wartung.pptx", "pptx", true)).toMatchObject({
      status: "fehlgeschlagen",
      hinweise: ["ladefrist"],
    });
  });
});
