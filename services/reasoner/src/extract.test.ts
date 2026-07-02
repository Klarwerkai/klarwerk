// PMO-FEA-0006: Tests für die Wissens-Extraktion aus Dokumenten (DOM-frei).
// Schwerpunkte: G-2-Belegstellen-Gate (nichts erfinden), ehrlicher Fallback ohne Modell
// (keine Fake-Punkte), ModelRun-Protokoll, KI-Verwaltung kennt die neue Aufgabe.
import { describe, expect, it, vi } from "vitest";
import type { ModelRunRecord, ModelRunRepo } from "../../model-runs";
import { DeterministicProvider, honestExtractUnavailable } from "./provider";
import {
  MAX_EXTRACT_POINTS,
  type ModelClient,
  ModelProvider,
  excerptFoundInDocument,
  parseExtractResponse,
} from "./provider-model";
import { Reasoner } from "./service";

const DOC =
  "Wartungsbericht Linie L4.\n" +
  "Der Dosierwert muss nach jedem Schichtwechsel neu kalibriert werden.\n" +
  "Bei Überdruck über 6 bar ist Ventil X sofort zu schließen.\n" +
  "Filter F3 wird alle 500 Betriebsstunden getauscht.";

function fakeClient(reply: string): ModelClient {
  return { name: "fake", complete: async () => reply };
}

function pointJson(points: { title: string; summary?: string; sourceExcerpt: string }[]): string {
  return JSON.stringify({ points });
}

describe("PMO-FEA-0006: excerptFoundInDocument (G-2-Gate)", () => {
  it("findet wörtliche Auszüge — auch mit abweichendem Whitespace und Groß-/Kleinschreibung", () => {
    expect(excerptFoundInDocument("Ventil X sofort zu schließen", DOC)).toBe(true);
    expect(excerptFoundInDocument("  ventil x   sofort zu schließen ", DOC)).toBe(true);
    expect(excerptFoundInDocument("Dosierwert muss nach jedem\nSchichtwechsel", DOC)).toBe(true);
  });

  it("weist erfundene oder paraphrasierte Auszüge zurück", () => {
    expect(excerptFoundInDocument("Das Ventil öffnet man bei Unterdruck", DOC)).toBe(false);
    expect(excerptFoundInDocument("", DOC)).toBe(false);
    expect(excerptFoundInDocument("   ", DOC)).toBe(false);
  });
});

describe("PMO-FEA-0006: parseExtractResponse", () => {
  it("übernimmt nur Punkte mit echter Belegstelle im Dokument", () => {
    const raw = pointJson([
      {
        title: "Dosierwert nach Schichtwechsel kalibrieren",
        summary: "Nach jedem Schichtwechsel neu kalibrieren.",
        sourceExcerpt: "Der Dosierwert muss nach jedem Schichtwechsel neu kalibriert werden.",
      },
      {
        title: "Erfundener Punkt",
        summary: "Steht nicht im Text.",
        sourceExcerpt: "Die Anlage wird bei Vollmond gewartet.",
      },
    ]);
    const points = parseExtractResponse(raw, DOC);
    expect(points).toHaveLength(1);
    expect(points[0]?.title).toBe("Dosierwert nach Schichtwechsel kalibrieren");
  });

  it("verwirft Punkte ohne Titel; fehlende summary fällt auf den Titel zurück", () => {
    const raw = pointJson([
      { title: "", sourceExcerpt: "Filter F3 wird alle 500 Betriebsstunden getauscht." },
      {
        title: "Filter-Tausch",
        sourceExcerpt: "Filter F3 wird alle 500 Betriebsstunden getauscht.",
      },
    ]);
    const points = parseExtractResponse(raw, DOC);
    expect(points).toHaveLength(1);
    expect(points[0]?.summary).toBe("Filter-Tausch");
  });

  it("deckelt die Punkteliste auf MAX_EXTRACT_POINTS", () => {
    const many = Array.from({ length: MAX_EXTRACT_POINTS + 10 }, (_v, i) => ({
      title: `Punkt ${i}`,
      summary: "s",
      sourceExcerpt: "Wartungsbericht Linie L4.",
    }));
    expect(parseExtractResponse(pointJson(many), DOC)).toHaveLength(MAX_EXTRACT_POINTS);
  });

  it("toleriert Vor-/Nachwort um das JSON (extractJson-Muster wie bei structure)", () => {
    const raw = `Hier die Punkte: ${pointJson([
      { title: "Überdruck-Regel", sourceExcerpt: "Bei Überdruck über 6 bar" },
    ])} — fertig.`;
    expect(parseExtractResponse(raw, DOC)).toHaveLength(1);
  });

  it("wirft bei strukturell unbrauchbarer Antwort (kein JSON) — Reasoner fällt dann ehrlich zurück", () => {
    expect(() => parseExtractResponse("kein json", DOC)).toThrow();
  });
});

describe("PMO-FEA-0006: ModelProvider.extract", () => {
  it("liefert geprüfte Punkte (demo=false); erfundene Belegstellen fliegen raus", async () => {
    const raw = pointJson([
      {
        title: "Überdruck-Regel",
        summary: "Ventil X bei >6 bar schließen.",
        sourceExcerpt: "Bei Überdruck über 6 bar ist Ventil X sofort zu schließen.",
      },
      { title: "Halluzination", summary: "x", sourceExcerpt: "Nicht im Dokument." },
    ]);
    const res = await new ModelProvider(fakeClient(raw)).extract(DOC);
    expect(res.demo).toBe(false);
    expect(res.points).toHaveLength(1);
    expect(res.note).toBeNull();
  });

  it("reicht den optionalen Suchauftrag des Experten in den System-Prompt", async () => {
    let seenSystem = "";
    const client: ModelClient = {
      name: "fake",
      complete: async (system) => {
        seenSystem = system;
        return pointJson([]);
      },
    };
    await new ModelProvider(client).extract(DOC, "de", "Grenzwerte für Druck");
    expect(seenSystem).toContain("Grenzwerte für Druck");
  });

  it("leeres Dokument → ehrliche note, kein Modell-Aufruf nötig", async () => {
    const complete = vi.fn(async () => pointJson([]));
    const res = await new ModelProvider({ name: "fake", complete }).extract("   ");
    expect(res.points).toHaveLength(0);
    expect(res.note).toContain("keinen auswertbaren Text");
    expect(complete).not.toHaveBeenCalled();
  });

  it("keine belegbaren Punkte → leere Liste MIT erklärender note (kein stilles Nichts)", async () => {
    const res = await new ModelProvider(fakeClient(pointJson([]))).extract(DOC);
    expect(res.points).toHaveLength(0);
    expect(res.note).toContain("keine Wissenspunkte");
  });
});

describe("PMO-FEA-0006: ehrlicher Fallback ohne Modell (G-2/FR-RSN-04)", () => {
  it("DeterministicProvider.extract liefert KEINE Punkte, nur die ehrliche Meldung", async () => {
    const res = await new DeterministicProvider().extract(DOC);
    expect(res.points).toHaveLength(0);
    expect(res.demo).toBe(true);
    expect(res.note).toContain("Ohne KI-Modell");
  });

  it("honestExtractUnavailable ist lokalisiert (de/en)", () => {
    expect(honestExtractUnavailable("de").note).toContain("keine Wissens-Extraktion");
    expect(honestExtractUnavailable("en").note).toContain("no knowledge extraction");
  });

  it("Reasoner ohne Modell → Fallback-Ergebnis, demo=true", async () => {
    const res = await new Reasoner().extract(DOC);
    expect(res.points).toHaveLength(0);
    expect(res.demo).toBe(true);
    expect(res.note).toBeTruthy();
  });

  it("Modellfehler beim extract → deterministischer, ehrlicher Fallback (Betrieb stabil)", async () => {
    const flaky = new ModelProvider({
      name: "flaky",
      complete: async () => {
        throw new Error("Netzfehler");
      },
    });
    const res = await new Reasoner(flaky).extract(DOC);
    expect(res.points).toHaveLength(0);
    expect(res.demo).toBe(true);
  });
});

describe("PMO-FEA-0006: ModelRun-Protokoll + KI-Verwaltung", () => {
  function memRepo(): { repo: ModelRunRepo; records: ModelRunRecord[] } {
    const records: ModelRunRecord[] = [];
    const repo: ModelRunRepo = {
      append: async (r) => {
        records.push(r);
      },
      recent: async () => records,
    };
    return { repo, records };
  }

  it("extract-Läufe erscheinen im ModelRun-Protokoll (nur Metadaten)", async () => {
    const { repo, records } = memRepo();
    const reasoner = new Reasoner(undefined, undefined, repo);
    await reasoner.extract(DOC, "en");
    expect(records).toHaveLength(1);
    expect(records[0]?.task).toBe("extract");
    expect(records[0]?.status).toBe("success");
    expect(records[0]?.demo).toBe(true);
    expect(records[0]?.locale).toBe("en");
  });

  it("KI-Verwaltung: 'extract' ist konfigurierbar und in configStatus sichtbar", () => {
    const reasoner = new Reasoner();
    const status = reasoner.configStatus();
    expect(status.tasks).toContain("extract");
    expect(status.effective.extract).toBe("deterministic");
    const next = reasoner.setTaskConfig({ global: "auto", perTask: { extract: "deterministic" } });
    expect(next.perTask.extract).toBe("deterministic");
    expect(() =>
      reasoner.setTaskConfig({
        global: "auto",
        // @ts-expect-error: ungültiger Wert wird zur Laufzeit abgewiesen
        perTask: { extract: "quatsch" },
      }),
    ).toThrow();
  });
});
