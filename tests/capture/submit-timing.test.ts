// WP-D10 (Fix 2, Pedis Live-Befund): die Einreichen-Latenz wird in der Bestätigung sichtbar —
// aufklappbare „Details zur Dauer" aus den VORHANDENEN performance.now-Spannen (WP-D7b), keine neuen
// Messpunkte. Getestet: die pure Sammel-/Formatierlogik (Reihenfolge, Locale-Format, ehrliches
// Weglassen ungültiger Spannen), die Capture-Verdrahtung und die i18n-Keys DE/EN/NL.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  buildSubmitTimingEntries,
  formatSubmitSeconds,
  submitPhaseSpans,
} from "../../apps/web/src/lib/submitTiming";

describe("WP-D10 Fix 2: formatSubmitSeconds", () => {
  it("formatiert ms als Sekunden mit EINER Nachkommastelle im Locale", () => {
    expect(formatSubmitSeconds(3_400, "de")).toBe("3,4");
    expect(formatSubmitSeconds(3_400, "en")).toBe("3.4");
    // Sehr schnelle Phase bleibt ehrlich sichtbar (0,0/0,1 statt versteckt).
    expect(formatSubmitSeconds(40, "de")).toBe("0,0");
    expect(formatSubmitSeconds(12_345, "de")).toBe("12,3");
  });
});

describe("WP-D10 Fix 2: buildSubmitTimingEntries", () => {
  it("feste Phasen-Reihenfolge create → upload → link, MB nur am Upload", () => {
    const entries = buildSubmitTimingEntries(
      [
        { key: "link", ms: 800 },
        { key: "create", ms: 450 },
        { key: "upload", ms: 6_200, mb: "4,2" },
      ],
      "de",
    );
    expect(entries.map((e) => e.key)).toEqual(["create", "upload", "link"]);
    expect(entries[0]).toEqual({
      key: "create",
      labelKey: "capture.submitTiming.create",
      seconds: "0,5",
    });
    expect(entries[1]?.mb).toBe("4,2");
    expect(entries[1]?.seconds).toBe("6,2");
    expect(entries[2]?.mb).toBeUndefined();
  });

  it("ungültige/fehlende Spannen werden EHRLICH weggelassen (nichts erfunden)", () => {
    const entries = buildSubmitTimingEntries(
      [
        { key: "create", ms: 100 },
        { key: "upload", ms: Number.NaN },
        { key: "link", ms: -5 },
      ],
      "de",
    );
    expect(entries.map((e) => e.key)).toEqual(["create"]);
    expect(buildSubmitTimingEntries([], "de")).toEqual([]);
  });
});

// WP-D10b (bens GELB-Auflage): Zeilen NUR für ECHTE Arbeit. Der Finalizer feuert onPhase immer —
// die Ableitung aus den vorhandenen Arbeitszählern (Anhänge/Original/Quellen) entscheidet, welche
// Zeilen ehrlich sind. Ersetzt den alten Pin, der die leere Upload-Zeile (ms>0, mb:null) noch als
// erwarteten Eintrag festschrieb.
describe("WP-D10b: submitPhaseSpans — Zeilen nur fuer echte Arbeit", () => {
  const CREATE: Parameters<typeof buildSubmitTimingEntries>[0][number] = { key: "create", ms: 300 };

  it("reiner Text-Submit (keine Anhaenge/Original/Quellen) → NUR die Anlegen-Zeile", () => {
    // onPhase feuerte (uploadMs/linkMs gemessen), aber es gab NICHTS zu tun → keine Zeilen dafür.
    const spans = submitPhaseSpans({
      uploadWork: 0,
      linkWork: 0,
      uploadMs: 5,
      linkMs: 8,
      uploadMb: null,
    });
    expect(spans).toEqual([]);
    const entries = buildSubmitTimingEntries([CREATE, ...spans], "de");
    expect(entries.map((e) => e.key)).toEqual(["create"]);
  });

  it("echter Upload (Anhang) → create/upload/link, MB an der Upload-Zeile", () => {
    const spans = submitPhaseSpans({
      uploadWork: 1,
      linkWork: 1,
      uploadMs: 6_200,
      linkMs: 800,
      uploadMb: "4,2",
    });
    const entries = buildSubmitTimingEntries([CREATE, ...spans], "de");
    expect(entries.map((e) => e.key)).toEqual(["create", "upload", "link"]);
    expect(entries[1]?.mb).toBe("4,2");
  });

  it("reine externe Quelle (kein Upload) → create/link, KEINE Upload-Zeile", () => {
    const spans = submitPhaseSpans({
      uploadWork: 0,
      linkWork: 1,
      uploadMs: 3,
      linkMs: 900,
      uploadMb: null,
    });
    const entries = buildSubmitTimingEntries([CREATE, ...spans], "de");
    expect(entries.map((e) => e.key)).toEqual(["create", "link"]);
  });

  it("defensiv: fehlt der Phasen-Uebergang (uploadMs null), gibt es trotz Arbeit keine erfundene Upload-Zeile", () => {
    const spans = submitPhaseSpans({
      uploadWork: 2,
      linkWork: 2,
      uploadMs: null,
      linkMs: 950,
      uploadMb: "1,3",
    });
    expect(spans.map((s) => s.key)).toEqual(["link"]);
  });
});

describe("WP-D10 Fix 2: Capture-Verdrahtung + i18n", () => {
  it("Capture sammelt die VORHANDENEN Spannen und rendert die aufklappbaren Details", () => {
    const src = readFileSync(resolve(process.cwd(), "apps/web/src/pages/Capture.tsx"), "utf8");
    // Spannen aus den bestehenden Messpunkten (tCreate/tFinalize/onPhase) — keine neue Messung im Finalizer.
    expect(src).toContain('timingSpans.push({ key: "create", ms: performance.now() - tCreate })');
    expect(src).toContain("buildSubmitTimingEntries(timingSpans, i18n.language)");
    // WP-D10b: Upload-/Verknuepfen-Zeilen laufen ueber die Arbeits-Ableitung (keine Zeile ohne Arbeit).
    expect(src).toContain("submitPhaseSpans({");
    expect(src).toContain(
      "const uploadWork = attachmentItems.length + (originalWillUpload ? 1 : 0)",
    );
    // Aufklappbare Zeile in der Bestätigung (Erfolg UND Teilfehler nutzen dieselbe Karte).
    expect(src).toContain('t("capture.submitTiming.title")');
    expect(src).toContain("submitTimings.map");
  });

  it("die Dauer-Keys existieren DE/EN/NL", () => {
    for (const lng of ["de", "en", "nl"]) {
      for (const key of [
        "capture.submitTiming.title",
        "capture.submitTiming.create",
        "capture.submitTiming.upload",
        "capture.submitTiming.link",
        "capture.submitTiming.seconds",
        "capture.submitTiming.mb",
      ]) {
        expect(
          String(i18n.getResource(lng, "translation", key)).length,
          `${lng}:${key}`,
        ).toBeGreaterThan(0);
      }
    }
    expect(String(i18n.getResource("de", "translation", "capture.submitTiming.title"))).toBe(
      "Details zur Dauer",
    );
  });
});
