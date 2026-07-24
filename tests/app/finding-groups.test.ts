// SCRUM-486 (nacht24 Paket 3): pure Aufbereitungs-Lib der einheitlichen Befund-Darstellung —
// ehrliche Benennung je Erkennungsweg („mit KI" NUR bei echtem Modell-Fund MIT Konfidenz),
// WAS/WARUM/AKTION kompakt, Gruppierung je Beitrag mit „neueste zuerst".
import { describe, expect, it } from "vitest";
import type { Conflict, OverlapEntry } from "../../apps/web/src/api/types";
import {
  conflictFinding,
  groupFindingsByBeitrag,
  overlapFinding,
  resolveKo,
} from "../../apps/web/src/lib/findingGroups";

function conflict(overrides: Partial<Conflict> = {}): Conflict {
  return {
    id: "c1",
    koA: "ko-a",
    koB: "ko-b",
    type: "truth",
    description: "Widerspruch bei Druckangabe.",
    status: "offen",
    secondOpinion: null,
    decidedBy: null,
    decision: null,
    createdAt: "2026-07-20T10:00:00.000Z",
    ...overrides,
  };
}

function overlap(overrides: Partial<OverlapEntry> = {}): OverlapEntry {
  return {
    id: "o1",
    koA: "ko-a",
    koB: "ko-c",
    relation: "teilweise",
    aspects: [],
    eigenanteilA: "",
    eigenanteilB: "",
    recommendation: "zusammenfuehren_pruefen",
    status: "offen",
    pairKey: "ko-a|ko-c",
    origin: "auto",
    createdAt: "2026-07-21T10:00:00.000Z",
    ...overrides,
  };
}

describe("SCRUM-486: Benennung je Erkennungsweg (ehrlich)", () => {
  it("Konflikt: auto MIT Konfidenz = mit KI, auto ohne Konfidenz = deterministisch, sonst manuell", () => {
    const ki = conflictFinding(
      conflict({
        origin: "auto",
        detector: {
          trigger: "validation",
          method: "model",
          confidence: 0.87,
          rationale: "Werte widersprechen sich.",
        },
      }),
    );
    expect(ki.way).toBe("ki");
    expect(ki.wayLabelKey).toBe("finding.way.ki");
    expect(ki.whyPercent).toBe(87);
    expect(ki.whyRationale).toBe("Werte widersprechen sich.");

    // Auto ohne Konfidenz: KEIN „KI"-Etikett ohne echten Modell-Beleg.
    const det = conflictFinding(
      conflict({ origin: "auto", detector: { trigger: "validation", method: "deterministic" } }),
    );
    expect(det.way).toBe("deterministisch");
    expect(det.whyPercent).toBeUndefined();

    // bens Sammel-Nacht (P1) Negativtest: method:"deterministic" MIT Confidence darf NIE „mit KI"
    // heißen — der Erkennungsweg hängt an method==="model", nicht an bloßer vorhandener Confidence.
    // Auch der KI-Sicherheits-Prozentwert erscheint dann NICHT.
    const detWithConfidence = conflictFinding(
      conflict({
        origin: "auto",
        detector: {
          trigger: "validation",
          method: "deterministic",
          confidence: 0.91,
          rationale: "Textabgleich, kein Modell.",
        },
      }),
    );
    expect(detWithConfidence.way).toBe("deterministisch");
    expect(detWithConfidence.wayLabelKey).toBe("finding.way.deterministisch");
    expect(detWithConfidence.whyPercent).toBeUndefined();

    const man = conflictFinding(conflict({ origin: "manual" }));
    expect(man.way).toBe("manuell");
    expect(man.wayLabelKey).toBe("finding.way.manuell");
  });

  it("Konflikt: WAS/AKTION/offen — Kind konflikt, Aktion aus conflictNextStep, geloest = zu", () => {
    const offen = conflictFinding(conflict({ type: "truth", status: "offen" }));
    expect(offen.kind).toBe("konflikt");
    expect(offen.kindLabelKey).toBe("finding.kind.konflikt");
    expect(offen.actionLabelKey).toBe("con.next.escalate");
    expect(offen.open).toBe(true);
    const done = conflictFinding(conflict({ status: "geloest" }));
    expect(done.actionLabelKey).toBe("con.next.done");
    expect(done.open).toBe(false);
  });

  it("Überschneidung: mit KI NUR bei Modell-Fund MIT Konfidenz; relation identisch = Duplikat", () => {
    const ki = overlapFinding(
      overlap({
        relation: "identisch",
        detector: {
          trigger: "validation",
          method: "model",
          lexicalScore: 0.4,
          confidence: 0.91,
          rationale: "Gleicher Inhalt, andere Worte.",
        },
      }),
    );
    expect(ki.kind).toBe("duplikat");
    expect(ki.way).toBe("ki");
    expect(ki.whyPercent).toBe(91); // KI-Sicherheit führt
    expect(ki.whyRationale).toBe("Gleicher Inhalt, andere Worte.");

    // Modell-Fund OHNE Konfidenz wird konsistent als Textabgleich (deterministisch) geführt.
    const detOhneKonfidenz = overlapFinding(
      overlap({ detector: { trigger: "validation", method: "model", lexicalScore: 0.83 } }),
    );
    expect(detOhneKonfidenz.way).toBe("deterministisch");
    expect(detOhneKonfidenz.whyPercent).toBe(83); // Textdeckung führt
    expect(detOhneKonfidenz.kind).toBe("ueberschneidung");

    // Manuell angelegt bleibt manuell; ohne detector kein erfundener Prozentwert.
    const man = overlapFinding(overlap({ origin: "manual" }));
    expect(man.way).toBe("manuell");
    expect(man.whyPercent).toBeUndefined();

    // Aktion = bestehende Empfehlungs-Ableitung; geschlossen = zu.
    expect(overlapFinding(overlap()).actionLabelKey).toBe("dup.rec.zusammenfuehren_pruefen");
    expect(overlapFinding(overlap({ status: "geschlossen" })).open).toBe(false);
  });
});

describe("SCRUM-486: Gruppierung je Beitrag, neueste zuerst", () => {
  it("gruppiert nach koA; innerhalb der Gruppe und zwischen Gruppen neueste zuerst", () => {
    const items = [
      overlap({ id: "alt", koA: "ko-a", createdAt: "2026-07-01T00:00:00.000Z" }),
      overlap({ id: "neu", koA: "ko-a", createdAt: "2026-07-22T00:00:00.000Z" }),
      overlap({ id: "fremd", koA: "ko-z", createdAt: "2026-07-23T00:00:00.000Z" }),
    ];
    const groups = groupFindingsByBeitrag(items);
    expect(groups.map((g) => g.koId)).toEqual(["ko-z", "ko-a"]); // Gruppe mit neuestem Befund zuerst
    expect(groups[1]?.items.map((i) => i.id)).toEqual(["neu", "alt"]); // innerhalb neueste zuerst
    expect(groups[1]?.newestAt).toBe("2026-07-22T00:00:00.000Z");
    // Jeder Befund erscheint genau EINMAL (keine Doppelung unter koB).
    expect(groups.flatMap((g) => g.items).length).toBe(3);
  });

  it("unparsebares Datum bricht die Sortierung nicht (zählt als ältester Stand)", () => {
    const groups = groupFindingsByBeitrag([
      overlap({ id: "kaputt", koA: "ko-a", createdAt: "kein-datum" }),
      overlap({ id: "ok", koA: "ko-a", createdAt: "2026-07-22T00:00:00.000Z" }),
    ]);
    expect(groups[0]?.items.map((i) => i.id)).toEqual(["ok", "kaputt"]);
  });

  it("resolveKo: findet den Beitrag oder liefert ehrlich null (nie ein Fake)", () => {
    const ko = { id: "ko-a", title: "Ventil entlasten" } as never;
    expect(resolveKo("ko-a", [ko])).toBe(ko);
    expect(resolveKo("gibt-es-nicht", [ko])).toBeNull();
  });
});
