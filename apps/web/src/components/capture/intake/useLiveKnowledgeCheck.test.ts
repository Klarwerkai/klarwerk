import { describe, expect, it } from "vitest";
import type { KnowledgeCheckResult } from "../../../api/types";
import { mapKnowledgeCheck } from "./useLiveKnowledgeCheck";

// G-2-EHRLICHKEIT (SCRUM-527): die reine Abbildung Endpoint-Ergebnis → Anzeige-Verdict. Kernregel:
// „neu" NUR bei status "done" UND leer. „pending" (Widerspruch nicht geprüft) und „failed" (Prüfung
// nicht verfügbar) dürfen NIEMALS als „neu" erscheinen.

const empty = (over: Partial<KnowledgeCheckResult>): KnowledgeCheckResult => ({
  status: "pending",
  similar: [],
  conflicts: [],
  ...over,
});

describe("mapKnowledgeCheck", () => {
  it("pending + nichts gefunden → 'pending', NICHT 'new'", () => {
    const v = mapKnowledgeCheck(empty({ status: "pending" }));
    expect(v.status).toBe("pending");
    expect(v.status).not.toBe("new");
  });

  it("failed + nichts gefunden → 'unavailable', NICHT 'new'", () => {
    const v = mapKnowledgeCheck(empty({ status: "failed" }));
    expect(v.status).toBe("unavailable");
    expect(v.status).not.toBe("new");
  });

  it("done + nichts gefunden → 'new' (ehrlich geprüft, nichts existiert)", () => {
    expect(mapKnowledgeCheck(empty({ status: "done" })).status).toBe("new");
  });

  it("conflicts haben Vorrang (auch bei pending)", () => {
    const v = mapKnowledgeCheck(
      empty({
        status: "pending",
        conflicts: [
          {
            id: "k9",
            title: "Alte Regel",
            reason: "x",
            koStatus: "offen",
            koCategory: "Verwaltung",
          },
        ],
      }),
    );
    expect(v).toEqual({
      status: "conflict",
      match: {
        koId: "k9",
        title: "Alte Regel",
        score: 1,
        koStatus: "offen",
        koCategory: "Verwaltung",
      },
    });
  });

  it("similar vor 'neu'/'pending' — und pending wird so nie fälschlich 'neu'", () => {
    const v = mapKnowledgeCheck(
      empty({
        status: "pending",
        similar: [
          { id: "k1", title: "Ähnlich", score: 0.7, koStatus: "validiert", koCategory: "Anlage 1" },
        ],
      }),
    );
    expect(v).toEqual({
      status: "similar",
      match: {
        koId: "k1",
        title: "Ähnlich",
        score: 0.7,
        koStatus: "validiert",
        koCategory: "Anlage 1",
      },
    });
  });

  // JOB 3045: `null` reist unverändert mit — kein `?? "offen"`, kein `?? ""`. Der Bestand darf
  // schweigen, und dieses Schweigen muss bis in den Verdict durchkommen, statt aufgefüllt zu werden.
  it("null bleibt null — der Fundort wird nicht aufgefüllt", () => {
    const v = mapKnowledgeCheck(
      empty({
        status: "done",
        similar: [{ id: "k1", title: "Ähnlich", score: 0.7, koStatus: null, koCategory: null }],
      }),
    );
    expect(v).toEqual({
      status: "similar",
      match: { koId: "k1", title: "Ähnlich", score: 0.7, koStatus: null, koCategory: null },
    });
  });
});
