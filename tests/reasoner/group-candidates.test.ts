// WP-IC-4 (Teil 1): KI-Gruppierung der Import-Kandidaten — strikte Antwort-Validierung (jede Id
// genau einmal, Unbekanntes verworfen, Fehlendes in der Auffanggruppe), EHRLICHER deterministischer
// Themen-Fallback (der Flow bleibt ohne Modell benutzbar, fallbackReason-Muster wie structure/
// describe), ModelRun-Protokoll + KI-Verwaltung wie die anderen Tasks.
import { describe, expect, it } from "vitest";
import type { ModelRunRecord } from "../../services/model-runs";
import {
  type GroupCandidateInput,
  ModelProvider,
  ModelTimeoutError,
  Reasoner,
  deterministicCandidateGroups,
  normalizeCandidateGroups,
} from "../../services/reasoner";

const CANDIDATES: GroupCandidateInput[] = [
  { id: "a", title: "Pumpe warten", theme: "Wartung" },
  { id: "b", title: "Ventil tauschen", theme: "Wartung" },
  { id: "c", title: "Fehlercode E5", theme: "Fehler" },
  { id: "d", title: "Notizen", theme: null },
];

describe("WP-IC-4: normalizeCandidateGroups (strikte Validierung)", () => {
  it("jede bekannte Id GENAU einmal: Duplikate fliegen, Unbekanntes wird verworfen", () => {
    const raw = JSON.stringify({
      groups: [
        { title: "Wartung", ids: ["a", "b", "a", "unbekannt"] },
        { title: "Fehler", ids: ["c", "b"] },
      ],
    });
    const groups = normalizeCandidateGroups(raw, ["a", "b", "c"], "de");
    expect(groups.map((g) => ({ title: g.title, ids: g.ids }))).toEqual([
      { title: "Wartung", ids: ["a", "b"] },
      { title: "Fehler", ids: ["c"] },
    ]);
  });

  it("vom Modell vergessene Ids landen EHRLICH in der markierten Auffanggruppe", () => {
    const raw = JSON.stringify({ groups: [{ title: "Wartung", ids: ["a"] }] });
    const groups = normalizeCandidateGroups(raw, ["a", "b", "c"], "de");
    const last = groups[groups.length - 1];
    expect(last?.kind).toBe("catchall");
    expect(last?.title).toBe("Weitere Beiträge");
    expect(last?.ids).toEqual(["b", "c"]);
    // EN-Label für locale en (NL lokalisiert die UI über kind).
    const enGroups = normalizeCandidateGroups(raw, ["a", "b"], "en");
    expect(enGroups[enGroups.length - 1]?.title).toBe("More posts");
  });

  it("strukturell unbrauchbare Antworten werfen (Kette fällt auf den Themen-Fallback)", () => {
    expect(() => normalizeCandidateGroups("kein json", ["a"], "de")).toThrow();
    expect(() => normalizeCandidateGroups(JSON.stringify({ groups: [] }), ["a"], "de")).toThrow();
    expect(() =>
      normalizeCandidateGroups(
        JSON.stringify({ groups: [{ title: "X", ids: ["zz"] }] }),
        ["a"],
        "de",
      ),
    ).toThrow();
  });
});

describe("WP-IC-4: deterministischer Themen-Fallback (ehrlich, ohne Modell)", () => {
  it("gruppiert nach IC-1-Themen; ohne Thema → markierte Ohne-Thema-Gruppe", () => {
    const groups = deterministicCandidateGroups(CANDIDATES, "de");
    expect(groups.map((g) => g.title)).toEqual(["Wartung", "Fehler", "Ohne Thema"]);
    expect(groups[0]?.ids).toEqual(["a", "b"]);
    expect(groups[2]?.kind).toBe("no-theme");
    // Deterministisch: gleicher Input → gleiche Ausgabe.
    expect(deterministicCandidateGroups(CANDIDATES, "de")).toEqual(groups);
  });
});

describe("WP-IC-4: Reasoner.groupCandidates (Fallback-Muster + Protokoll)", () => {
  it("ohne Modell: deterministische Gruppen + demo + fallbackReason no-model — Flow bleibt benutzbar", async () => {
    const res = await new Reasoner().groupCandidates(CANDIDATES, "de");
    expect(res.demo).toBe(true);
    expect(res.fallbackReason).toBe("no-model");
    expect(res.groups.map((g) => g.title)).toEqual(["Wartung", "Fehler", "Ohne Thema"]);
  });

  it("mit Modell: validierte KI-Gruppen (demo false); jede Id genau einmal", async () => {
    const provider = new ModelProvider({
      name: "anthropic:test",
      complete: async () =>
        JSON.stringify({
          groups: [
            { title: "Instandhaltung", ids: ["a", "b"] },
            { title: "Störungen", ids: ["c", "d"] },
          ],
        }),
    });
    const res = await new Reasoner(provider).groupCandidates(CANDIDATES, "de");
    expect(res.demo).toBe(false);
    expect(res.fallbackReason).toBeUndefined();
    expect(res.groups.flatMap((g) => g.ids).sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("Modellfehler/Timeout: ehrlicher Fallback mit unterschiedener Ursache", async () => {
    const failing = new ModelProvider({
      name: "anthropic:test",
      complete: async () => {
        throw new Error("Modell-API antwortete mit 529");
      },
    });
    const err = await new Reasoner(failing).groupCandidates(CANDIDATES, "de");
    expect(err.demo).toBe(true);
    expect(err.fallbackReason).toBe("model-error");
    const timingOut = new ModelProvider({
      name: "anthropic:test",
      complete: async () => {
        throw new ModelTimeoutError("Zeitlimit", 30000);
      },
    });
    const timeout = await new Reasoner(timingOut).groupCandidates(CANDIDATES, "de");
    expect(timeout.fallbackReason).toBe("model-timeout");
  });

  it("ModelRun-Protokoll + KI-Verwaltung: group läuft wie die anderen Tasks mit", async () => {
    const runs: ModelRunRecord[] = [];
    const reasoner = new Reasoner(undefined, undefined, {
      append: async (r) => {
        runs.push(r);
      },
      recent: async () => runs,
    });
    await reasoner.groupCandidates(CANDIDATES, "de");
    expect(runs[0]?.task).toBe("group");
    const config = reasoner.configStatus();
    expect(config.tasks).toContain("group");
    expect(config.effective.group).toBe("deterministic");
  });
});
