// ================================================================================================
// JOB 3044 · V9 Scheibe 2 — DIE DAUER WIRD GENAU EINMAL ABGELEITET, UND SIE LÜGT NICHT.
// ================================================================================================
//
// `ModelRunRecord` trägt seit jeher `startedAt` und `finishedAt`. Bis zu diesem Job hat niemand
// daraus eine Dauer gerechnet — weder Fläche noch Auswertung. Diese Datei bindet die eine
// Ableitung (`modelRunDauerMs`), die eine Darstellung (`formatiereDauer`) und die additive
// Erweiterung von `summarizeModelRuns` um `dauerSummeMs`/`dauerGezaehlt`.
//
// DIE ZUSAGE, DIE HIER HÄNGT: Ein kaputtes Zeitstempelpaar erzeugt KEINE Zahl. Kein `0`, kein
// Schätzwert, kein Betrag der Differenz — sondern `null`, und die Fläche schreibt dann nichts.
// `0` ist ein ECHTER Messwert (Start = Ende) und muss vom Fehlwert unterscheidbar bleiben; genau
// deshalb liegen F2 und F3/F4 hier nebeneinander.
import { describe, expect, it } from "vitest";
import type { ModelRunRecord } from "../../apps/web/src/api/types";
import {
  formatiereDauer,
  modelRunDauerMs,
  summarizeModelRuns,
} from "../../apps/web/src/lib/modelRuns";

function lauf(over: Partial<ModelRunRecord> = {}): ModelRunRecord {
  return {
    id: "r1",
    task: "structure",
    provider: "deterministic",
    demo: true,
    fallback: false,
    locale: "de",
    startedAt: "2026-09-03T10:00:00.000Z",
    finishedAt: "2026-09-03T10:00:00.100Z",
    status: "success",
    ...over,
  };
}

describe("JOB 3044 · modelRunDauerMs — eine Ableitung, oder ehrlich nichts", () => {
  it("F1 · 10:00:00.000 → 10:00:01.799 ergibt 1799 ms und liest sich als „1.8 s“", () => {
    const ms = modelRunDauerMs({
      startedAt: "2026-09-03T10:00:00.000Z",
      finishedAt: "2026-09-03T10:00:01.799Z",
    });
    expect(ms).toBe(1799);
    expect(formatiereDauer(ms as number)).toBe("1.8 s");
  });

  it("F2 · gleiche Zeitstempel ergeben 0 (echter Messwert, NICHT null) und lesen sich als „0 ms“", () => {
    const ms = modelRunDauerMs({
      startedAt: "2026-09-03T10:00:00.000Z",
      finishedAt: "2026-09-03T10:00:00.000Z",
    });
    expect(ms).toBe(0);
    expect(ms).not.toBeNull();
    expect(formatiereDauer(ms as number)).toBe("0 ms");
  });

  it("F3 · Ende VOR Start ergibt null — kein Betrag, keine geratene Zeit", () => {
    expect(
      modelRunDauerMs({
        startedAt: "2026-09-03T10:00:01.799Z",
        finishedAt: "2026-09-03T10:00:00.000Z",
      }),
    ).toBeNull();
  });

  it("F4 · ein unparsbarer Zeitstempel ergibt null", () => {
    expect(modelRunDauerMs({ startedAt: "—", finishedAt: "2026-09-03T10:00:01.000Z" })).toBeNull();
    expect(modelRunDauerMs({ startedAt: "2026-09-03T10:00:00.000Z", finishedAt: "—" })).toBeNull();
  });

  it("formatiert unter 1000 ms als ganze Millisekunden, ab 1000 ms als Sekunde mit einer Stelle", () => {
    expect(formatiereDauer(1)).toBe("1 ms");
    expect(formatiereDauer(999)).toBe("999 ms");
    expect(formatiereDauer(1000)).toBe("1.0 s");
    expect(formatiereDauer(12_400)).toBe("12.4 s");
  });
});

describe("JOB 3044 · summarizeModelRuns trägt die Laufzeit additiv", () => {
  it("F5 · vier Läufe, zwei mit ungültiger Dauer → Summe und Grundmenge nennen nur die gültigen", () => {
    const s = summarizeModelRuns([
      lauf({
        id: "a",
        startedAt: "2026-09-03T10:00:00.000Z",
        finishedAt: "2026-09-03T10:00:01.799Z",
      }),
      lauf({
        id: "b",
        startedAt: "2026-09-03T10:00:00.000Z",
        finishedAt: "2026-09-03T10:00:00.201Z",
      }),
      // ungültig: Ende vor Start
      lauf({
        id: "c",
        startedAt: "2026-09-03T10:00:05.000Z",
        finishedAt: "2026-09-03T10:00:04.000Z",
      }),
      // ungültig: unparsbar
      lauf({ id: "d", startedAt: "2026-09-03T10:00:00.000Z", finishedAt: "—" }),
    ]);
    expect(s.dauerSummeMs).toBe(2000);
    expect(s.dauerGezaehlt).toBe(2);
    expect(s.total).toBe(4);
  });

  it("F6 · leere Liste → Summe 0 über 0 Läufe", () => {
    const s = summarizeModelRuns([]);
    expect(s.dauerSummeMs).toBe(0);
    expect(s.dauerGezaehlt).toBe(0);
    expect(s.total).toBe(0);
  });

  it("die bestehenden Zählwerte bleiben unberührt (additive Erweiterung)", () => {
    const s = summarizeModelRuns([
      lauf({ id: "a", status: "success", demo: false, fallback: false }),
      lauf({ id: "b", status: "error", demo: true, fallback: true }),
    ]);
    expect(s.success).toBe(1);
    expect(s.errors).toBe(1);
    expect(s.fallbacks).toBe(1);
    expect(s.demo).toBe(1);
    expect(s.byTask).toEqual({ structure: 2, assist: 0, interview: 0, answer: 0, select: 0 });
  });
});
