import { describe, expect, it } from "vitest";
import { InMemoryAssistPresetRepo, MAX_ASSIST_PRESETS, normalizeAssistPresets } from "./presets";
import { Reasoner } from "./service";

// SCRUM-386: kundeneigene KI-Assist-Funktionen (Presets). Getestet werden Validierung
// (Längen, Duplikate, Obergrenze), stabile ids (bestehende bleiben, neue kommen vom
// injizierten Generator) und der Service-Rundweg über das Repo (Replace-Semantik).
describe("SCRUM-386: Assist-Presets", () => {
  const newId = (() => {
    let n = 0;
    return () => `id-${++n}`;
  })();

  it("validiert Name und Anweisung mit klaren deutschen Meldungen", () => {
    expect(() =>
      normalizeAssistPresets([{ name: "K", instruction: "gültige Anweisung" }], newId),
    ).toThrow(/Name/);
    expect(() => normalizeAssistPresets([{ name: "Kürzen", instruction: "kurz" }], newId)).toThrow(
      /Anweisung/,
    );
    expect(() =>
      normalizeAssistPresets(
        [
          { name: "Kürzen", instruction: "Fasse den Text deutlich kürzer." },
          { name: "kürzen", instruction: "Noch einmal, andere Groß-/Kleinschreibung." },
        ],
        newId,
      ),
    ).toThrow(/doppelt/);
    const tooMany = Array.from({ length: MAX_ASSIST_PRESETS + 1 }, (_, i) => ({
      name: `Funktion ${i}`,
      instruction: "Eine gültige Anweisung an die KI.",
    }));
    expect(() => normalizeAssistPresets(tooMany, newId)).toThrow(/Höchstens/);
  });

  it("behält vorhandene ids und vergibt neue nur für neue Einträge; trimmt Eingaben", () => {
    const out = normalizeAssistPresets(
      [
        {
          id: "alt-1",
          name: "  Schichtübergabe  ",
          instruction: "  Fasse in 5 Stichpunkten zusammen.  ",
        },
        { name: "Kundenmail", instruction: "Formuliere als höfliche, kurze Kundenmail." },
      ],
      newId,
    );
    expect(out[0]).toEqual({
      id: "alt-1",
      name: "Schichtübergabe",
      instruction: "Fasse in 5 Stichpunkten zusammen.",
    });
    expect(out[1]?.id).toMatch(/^id-/);
    expect(out[1]?.name).toBe("Kundenmail");
  });

  it("Service-Rundweg: setAssistPresets ersetzt die Liste im Repo, getAssistPresets liest sie", async () => {
    const repo = new InMemoryAssistPresetRepo();
    const reasoner = new Reasoner(undefined, undefined, undefined, repo);
    expect(await reasoner.getAssistPresets()).toEqual([]);
    const saved = await reasoner.setAssistPresets([
      { name: "Schichtübergabe", instruction: "Fasse in 5 Stichpunkten zusammen." },
    ]);
    expect(saved).toHaveLength(1);
    const firstId = saved[0]?.id ?? "";
    expect(firstId.length).toBeGreaterThan(0);
    // Replace-Semantik: neue Liste ersetzt die alte vollständig (Entfernen = Weglassen).
    const replaced = await reasoner.setAssistPresets([
      { id: firstId, name: "Schichtübergabe", instruction: "Fasse in 5 Stichpunkten zusammen." },
      { name: "Prüfbericht", instruction: "Formuliere sachlich für den Prüfbericht." },
    ]);
    expect(replaced).toHaveLength(2);
    expect(replaced[0]?.id).toBe(firstId);
    expect(await reasoner.setAssistPresets([])).toEqual([]);
    expect(await reasoner.getAssistPresets()).toEqual([]);
  });

  it("weist ungültige Listen ab, ohne den Bestand zu verändern", async () => {
    const repo = new InMemoryAssistPresetRepo();
    const reasoner = new Reasoner(undefined, undefined, undefined, repo);
    await reasoner.setAssistPresets([
      { name: "Schichtübergabe", instruction: "Fasse in 5 Stichpunkten zusammen." },
    ]);
    await expect(
      reasoner.setAssistPresets([{ name: "X", instruction: "zu kurz Name" }]),
    ).rejects.toThrow();
    expect(await reasoner.getAssistPresets()).toHaveLength(1);
  });
});
