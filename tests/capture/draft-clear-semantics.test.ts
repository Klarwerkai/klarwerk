// AUFTRAG-mega6 Block B (bens ROT 2): Löschsemantik an der Persistenzgrenze. Gewählt wurde WEG ZWEI
// (explizite Leerwerte), weil fünf der sieben PUT-Aufrufer auf die Merge-Semantik ANGEWIESEN sind
// (Mobile ×2 senden nur {title?, statement?}, Vordertür ×2 nur ihren Ausschnitt, die Offline-Queue
// spielt Mobile-Payloads nach) — echte Replace-Semantik würde dort bodyHtml/Metadaten löschen.
// Diese Tests pinnen BEIDE Seiten der Regel über die öffentliche Service-Oberfläche:
//   Feld NICHT mitgeschickt  ⇒ Altwert bleibt   (die fünf Aufrufer bleiben heil)
//   Feld MIT LEERWERT        ⇒ Altwert ist weg  (der Nutzer kann wirklich löschen)
import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryDraftRepo } from "../../services/capture/src/repo";
import { CaptureService } from "../../services/capture/src/service";
import type { Draft, DraftPayload } from "../../services/capture/src/types";

let svc: CaptureService;

const FULL: DraftPayload = {
  title: "Dichtung tauschen",
  statement: "Alle sechs Monate prüfen.",
  type: "best_practice",
  category: "Anlage 1",
  reviewerIds: ["p2", "p3"],
  pendingSources: [{ label: "Handbuch", url: "https://example.org/h", sourceProvider: "Wiki" }],
  sourceForm: { label: "Notiz", url: "https://example.org/n", excerpt: "Auszug" },
  extQuery: "Dichtung Norm",
  interview: { started: true, answers: ["A1"], question: "Frage 2?", done: false, demo: false },
};

beforeEach(() => {
  svc = new CaptureService({ repo: new InMemoryDraftRepo() });
});

async function seed(): Promise<Draft> {
  return svc.createDraft({ ...FULL }, "anna");
}

describe("Block B: ausdrücklicher Leerwert entfernt den Altwert wirklich", () => {
  it("alle fünf Felder ausdrücklich geleert → nach dem Fortsetzen kehrt keiner zurück", async () => {
    const draft = await seed();
    // Genau das, was der Client beim Aktualisieren eines bestehenden Entwurfs jetzt sendet.
    const updated = await svc.continueDraft(
      draft.id,
      {
        title: FULL.title ?? "",
        statement: FULL.statement ?? "",
        reviewerIds: [],
        pendingSources: [],
        sourceForm: { label: "", url: "", excerpt: "" },
        extQuery: "",
        interview: { started: false, answers: [] },
      },
      "bob",
    );

    expect(updated.payload.reviewerIds).toBeUndefined();
    expect(updated.payload.pendingSources).toBeUndefined();
    expect(updated.payload.sourceForm).toBeUndefined();
    expect(updated.payload.extQuery).toBeUndefined();
    expect(updated.payload.interview).toBeUndefined();
    // Der Bestand selbst — nicht nur die Antwort — ist frei davon (Datenminimierung).
    const stored = await svc.getDraft(draft.id);
    expect(stored?.payload.extQuery).toBeUndefined();
    expect(stored?.payload.pendingSources).toBeUndefined();
    // Was NICHT geleert wurde, bleibt selbstverständlich erhalten.
    expect(stored?.payload.title).toBe(FULL.title);
    expect(stored?.payload.category).toBe("Anlage 1");
  });

  const SINGLE_CLEARS: { name: string; key: keyof DraftPayload; empty: () => DraftPayload }[] = [
    { name: "Prüfer", key: "reviewerIds", empty: () => ({ reviewerIds: [] }) },
    { name: "Quellen", key: "pendingSources", empty: () => ({ pendingSources: [] }) },
    {
      name: "Quellenformular",
      key: "sourceForm",
      empty: () => ({ sourceForm: { label: "", url: "", excerpt: "" } }),
    },
    { name: "Suchanfrage", key: "extQuery", empty: () => ({ extQuery: "" }) },
  ];

  for (const { name, key, empty } of SINGLE_CLEARS) {
    it(`${name} einzeln geleert → weg, alle übrigen Felder unberührt`, async () => {
      const draft = await seed();
      const change = empty();
      const updated = await svc.continueDraft(draft.id, change, "bob");
      expect(updated.payload[key]).toBeUndefined();
      // Kollateralschaden ausgeschlossen: die anderen Strukturen stehen noch.
      const others = (["reviewerIds", "pendingSources", "sourceForm", "extQuery"] as const).filter(
        (k) => k !== key,
      );
      for (const other of others) {
        expect(updated.payload[other]).toBeDefined();
      }
      expect(updated.payload.interview).toBeDefined();
    });
  }
});

describe("Block B: ein nicht mitgeschicktes Feld löscht NICHTS (die fünf Merge-Aufrufer bleiben heil)", () => {
  it("Mobile-Muster {title, statement} lässt Prüfer, Quellen, Suchanfrage und Interview stehen", async () => {
    const draft = await seed();
    const updated = await svc.continueDraft(
      draft.id,
      { title: "Neu vom Handy", statement: "Kurzfassung." },
      "bob",
    );
    expect(updated.payload.title).toBe("Neu vom Handy");
    expect(updated.payload.reviewerIds).toEqual(["p2", "p3"]);
    expect(updated.payload.pendingSources).toHaveLength(1);
    expect(updated.payload.sourceForm).toEqual(FULL.sourceForm);
    expect(updated.payload.extQuery).toBe("Dichtung Norm");
    expect(updated.payload.interview).toBeDefined();
  });

  it("ein ausdrückliches undefined gilt als nicht gemeint, nicht als geleert", async () => {
    const draft = await seed();
    // exactOptionalPropertyTypes verbietet das im Vertrag — über die HTTP-Grenze kann es trotzdem
    // ankommen. Der Merge darf daraus keinen Löschbefehl machen.
    const updated = await svc.continueDraft(
      draft.id,
      { extQuery: undefined, reviewerIds: undefined } as unknown as DraftPayload,
      "bob",
    );
    expect(updated.payload.extQuery).toBe("Dichtung Norm");
    expect(updated.payload.reviewerIds).toEqual(["p2", "p3"]);
  });
});
