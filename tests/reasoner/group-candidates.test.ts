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

  it("WP-SHIP7-FIX (Fix 2): leerer Gruppentitel → Ids gehen NICHT verloren, sondern in die Auffanggruppe", () => {
    // bens Regression: die Gruppe mit leerem Titel wird verworfen — vorher waren ihre Ids da schon
    // als „gesehen" markiert und verschwanden unsichtbar (beim Übernehmen trotzdem mitimportiert).
    const raw = JSON.stringify({
      groups: [
        { title: "", ids: ["a"] },
        { title: "B", ids: ["b"] },
      ],
    });
    const groups = normalizeCandidateGroups(raw, ["a", "b"], "de");
    expect(groups.map((g) => ({ title: g.title, ids: g.ids, kind: g.kind }))).toEqual([
      { title: "B", ids: ["b"], kind: undefined },
      { title: "Weitere Beiträge", ids: ["a"], kind: "catchall" },
    ]);
    // Auch ein reiner Whitespace-Titel ist KEIN Titel — gleiche Rettung in die Auffanggruppe.
    const ws = JSON.stringify({
      groups: [
        { title: "   ", ids: ["a"] },
        { title: "B", ids: ["b"] },
      ],
    });
    const wsGroups = normalizeCandidateGroups(ws, ["a", "b"], "de");
    expect(wsGroups[wsGroups.length - 1]).toEqual({
      title: "Weitere Beiträge",
      ids: ["a"],
      kind: "catchall",
    });
  });

  it("WP-SHIP7-FIX (Fix 2): ABSCHLUSS-INVARIANTE — flache Id-Menge aller Gruppen == eindeutige Eingabemenge", () => {
    // Gemischtes Chaos: Duplikate (auch innerhalb einer Gruppe), Unbekanntes, verworfene Gruppe,
    // vergessene Ids — am Ende ist JEDE bekannte Id GENAU einmal gerendert.
    const raw = JSON.stringify({
      groups: [
        { title: "", ids: ["a", "b"] },
        { title: "Wartung", ids: ["b", "b", "unbekannt"] },
        { title: "Fehler", ids: ["c", "b"] },
      ],
    });
    const known = ["a", "b", "c", "d", "d"]; // doppelte Eingabe-Id zählt einmal
    const groups = normalizeCandidateGroups(raw, known, "de");
    const flat = groups.flatMap((g) => g.ids);
    expect([...flat].sort()).toEqual(["a", "b", "c", "d"]);
    expect(new Set(flat).size).toBe(flat.length);
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

  it("WP-SHIP9-S1 T1: Cloud da + auto + vertraulich + kein lokal → confidential + NULL Cloud-Aufrufe", async () => {
    let cloudCalls = 0;
    const cloud = new ModelProvider({
      name: "anthropic:test",
      complete: async () => {
        cloudCalls += 1;
        return JSON.stringify({ groups: [{ title: "Alles", ids: ["a", "b", "c", "d"] }] });
      },
    });
    const res = await new Reasoner(cloud).groupCandidates(CANDIDATES, "de", true);
    expect(res.demo).toBe(true);
    expect(res.fallbackReason).toBe("confidential");
    expect(cloudCalls).toBe(0); // die Vertraulichkeits-DURCHSETZUNG bleibt unangetastet
    // Deterministische Gruppen bleiben nutzbar (Flow benutzbar wie bisher).
    expect(res.groups.map((g) => g.title)).toEqual(["Wartung", "Fehler", "Ohne Thema"]);
  });

  it("WP-SHIP9-S1 T2: Policy deterministic + vertraulich → NICHT confidential (bewusste Wahl)", async () => {
    const cloud = new ModelProvider({
      name: "anthropic:test",
      complete: async () => JSON.stringify({ groups: [{ title: "X", ids: ["a"] }] }),
    });
    const reasoner = new Reasoner(cloud);
    await reasoner.setTaskConfig({ global: "deterministic", perTask: {} });
    const res = await reasoner.groupCandidates(CANDIDATES, "de", true);
    expect(res.demo).toBe(true);
    expect(res.fallbackReason).toBe("no-model");
    // Auch als reine perTask-Wahl (global cloud-geeignet, group bewusst deterministisch).
    const perTask = new Reasoner(cloud);
    await perTask.setTaskConfig({ global: "auto", perTask: { group: "deterministic" } });
    const res2 = await perTask.groupCandidates(CANDIDATES, "de", true);
    expect(res2.fallbackReason).toBe("no-model");
  });

  it("WP-SHIP9-S1 T2b: fail-closed Policy-Ladefehler (deterministic) → NIE confidential", async () => {
    const cloud = new ModelProvider({
      name: "anthropic:test",
      complete: async () => JSON.stringify({ groups: [{ title: "X", ids: ["a"] }] }),
    });
    const reasoner = new Reasoner(cloud, undefined, undefined, undefined, undefined, {
      get: async () => {
        throw new Error("DB nicht erreichbar");
      },
      set: async () => {},
    });
    const loaded = await reasoner.loadPersistedPolicy();
    expect(loaded.source).toBe("load-error");
    const res = await reasoner.groupCandidates(CANDIDATES, "de", true);
    expect(res.demo).toBe(true);
    expect(res.fallbackReason).toBe("no-model");
  });

  it("WP-SHIP9-S1 T3: Policy local ohne lokales Modell + vertraulich → NICHT confidential", async () => {
    const cloud = new ModelProvider({
      name: "anthropic:test",
      complete: async () => JSON.stringify({ groups: [{ title: "X", ids: ["a"] }] }),
    });
    const reasoner = new Reasoner(cloud);
    await reasoner.setTaskConfig({ global: "local", perTask: {} });
    const res = await reasoner.groupCandidates(CANDIDATES, "de", true);
    expect(res.demo).toBe(true);
    // Die Cloud war per Policy NIE zulässig — Vertraulichkeit ist nicht die entscheidende Ursache.
    expect(res.fallbackReason).toBe("no-model");
  });

  it("WP-SHIP9-S1 T4: lokales Modell + vertraulich + Erfolg → kein Demo-Fallback, Cloud unangetastet", async () => {
    let cloudCalls = 0;
    const cloud = new ModelProvider({
      name: "anthropic:test",
      complete: async () => {
        cloudCalls += 1;
        return JSON.stringify({ groups: [{ title: "Cloud", ids: ["a", "b", "c", "d"] }] });
      },
    });
    const local = new ModelProvider({
      name: "local:test",
      complete: async () =>
        JSON.stringify({
          groups: [
            { title: "Instandhaltung", ids: ["a", "b"] },
            { title: "Störungen", ids: ["c", "d"] },
          ],
        }),
    });
    const res = await new Reasoner(cloud, undefined, undefined, undefined, local).groupCandidates(
      CANDIDATES,
      "de",
      true,
    );
    expect(res.demo).toBe(false);
    expect(res.fallbackReason).toBeUndefined();
    expect(cloudCalls).toBe(0);
  });

  it("WP-SHIP9-S1 T5: lokales Modell + vertraulich + Timeout/Fehler → model-timeout/model-error", async () => {
    const cloud = new ModelProvider({
      name: "anthropic:test",
      complete: async () => JSON.stringify({ groups: [{ title: "Cloud", ids: ["a"] }] }),
    });
    const timingOut = new ModelProvider({
      name: "local:test",
      complete: async () => {
        throw new ModelTimeoutError("Zeitlimit", 30000);
      },
    });
    const timeout = await new Reasoner(
      cloud,
      undefined,
      undefined,
      undefined,
      timingOut,
    ).groupCandidates(CANDIDATES, "de", true);
    expect(timeout.demo).toBe(true);
    expect(timeout.fallbackReason).toBe("model-timeout");
    const failing = new ModelProvider({
      name: "local:test",
      complete: async () => {
        throw new Error("Modell-API antwortete mit 529");
      },
    });
    const err = await new Reasoner(cloud, undefined, undefined, undefined, failing).groupCandidates(
      CANDIDATES,
      "de",
      true,
    );
    expect(err.demo).toBe(true);
    expect(err.fallbackReason).toBe("model-error");
  });

  it("WP-SHIP9-S1 T9 (Server-Seite): no-model/model-timeout/model-error UNVERÄNDERT ohne Vertraulichkeit", async () => {
    // Kein Modell, nicht vertraulich → weiterhin no-model (gepinnt oben) — hier der Kontrast:
    // vertraulich OHNE konfigurierte Cloud bleibt ebenfalls ehrlich no-model, NICHT confidential.
    const res = await new Reasoner().groupCandidates(CANDIDATES, "de", true);
    expect(res.fallbackReason).toBe("no-model");
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
