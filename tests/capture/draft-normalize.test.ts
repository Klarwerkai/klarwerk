// AUFTRAG-mega5 Block B (bens Zusatzpunkt 1): Runtime-Normalisierung + harte Obergrenzen für die neu
// persistierten Draft-Strukturen an der Persistenz-Grenze (CaptureService). Ein authentifizierter
// ko.create-Nutzer konnte malformte oder sehr große Strukturen speichern, an denen der Resume mit
// .map()/.includes() scheitert. Diese Tests beweisen über die ÖFFENTLICHE Service-Oberfläche
// (createDraft/continueDraft/getDraft), dass gespeicherter und wiederhergestellter Zustand immer
// vertragskonform und unschädlich ist: falscher Typ → Feld verworfen; zu viele Einträge → gekappt;
// überlange Felder → gekürzt; URLs nur http/https (Allowlist); extResults nie persistiert (Block C).
import { describe, expect, it } from "vitest";
import { InMemoryDraftRepo } from "../../services/capture/src/repo";
import { CaptureService } from "../../services/capture/src/service";
import type { Draft, DraftPayload } from "../../services/capture/src/types";

function setup(): { svc: CaptureService; repo: InMemoryDraftRepo } {
  const repo = new InMemoryDraftRepo();
  return { svc: new CaptureService({ repo }), repo };
}

// Malformte Strukturen kommen als unknown über die HTTP-Grenze — der Cast simuliert genau das.
function asPayload(raw: Record<string, unknown>): DraftPayload {
  return raw as DraftPayload;
}

describe("Block B: Draft-Normalisierung — falscher Typ wird verworfen, nie gespeichert", () => {
  it("reviewerIds als String / mit Nicht-Strings → Feld bereinigt, Resume-sicher", async () => {
    const { svc } = setup();
    const a = await svc.createDraft(asPayload({ title: "T", reviewerIds: "kaputt" }), "anna");
    expect(a.payload.reviewerIds).toBeUndefined();

    const b = await svc.createDraft(
      asPayload({ title: "T", reviewerIds: ["p1", 7, null, "p2", "p1", "   "] }),
      "anna",
    );
    // Nicht-Strings und Leer-IDs raus, Duplikate dedupliziert — .includes()/.map() beim Resume sicher.
    expect(b.payload.reviewerIds).toEqual(["p1", "p2"]);
  });

  it("pendingSources als Objekt statt Array → Feld verworfen; Einträge ohne Label → raus", async () => {
    const { svc } = setup();
    const a = await svc.createDraft(
      asPayload({ title: "T", pendingSources: { label: "x" } }),
      "anna",
    );
    expect(a.payload.pendingSources).toBeUndefined();

    const b = await svc.createDraft(
      asPayload({
        title: "T",
        pendingSources: [
          { label: "Gültig", url: "https://example.org/a", excerpt: "ok", sourceProvider: "Wiki" },
          { url: "https://example.org/ohne-label" },
          "kein-objekt",
          null,
          { label: 42 },
        ],
      }),
      "anna",
    );
    expect(b.payload.pendingSources).toEqual([
      { label: "Gültig", url: "https://example.org/a", excerpt: "ok", sourceProvider: "Wiki" },
    ]);
  });

  it("interview malformed (String / leere Hülle / Nicht-String-Antworten) → verworfen bzw. bereinigt", async () => {
    const { svc } = setup();
    const a = await svc.createDraft(asPayload({ title: "T", interview: "kaputt" }), "anna");
    expect(a.payload.interview).toBeUndefined();

    const b = await svc.createDraft(asPayload({ title: "T", interview: {} }), "anna");
    expect(b.payload.interview).toBeUndefined();

    const c = await svc.createDraft(
      asPayload({
        title: "T",
        interview: { started: true, answers: ["eins", 2, null, "zwei"], done: "ja", demo: 1 },
      }),
      "anna",
    );
    // Antworten nur Strings; done/demo nur echte Booleans (sonst weg) — Resume rechnet mit dem Vertrag.
    expect(c.payload.interview).toEqual({ started: true, answers: ["eins", "zwei"] });
  });
});

describe("Block B: Mengen- und Längen-Caps", () => {
  it("zu viele pendingSources/reviewerIds/Antworten → hart gekappt", async () => {
    const { svc } = setup();
    const d = await svc.createDraft(
      asPayload({
        title: "T",
        reviewerIds: Array.from({ length: 500 }, (_, i) => `p${i}`),
        pendingSources: Array.from({ length: 1000 }, (_, i) => ({ label: `Q${i}` })),
        interview: {
          started: true,
          answers: Array.from({ length: 200 }, (_, i) => `Antwort ${i}`),
        },
      }),
      "anna",
    );
    expect(d.payload.reviewerIds).toHaveLength(20);
    expect(d.payload.pendingSources).toHaveLength(25);
    expect(d.payload.interview?.answers).toHaveLength(50);
  });

  it("überlange Felder → gekürzt (Label/Excerpt/Provider/Query/Antworttexte)", async () => {
    const { svc } = setup();
    const long = "x".repeat(100_000);
    const d = await svc.createDraft(
      asPayload({
        title: "T",
        extQuery: long,
        pendingSources: [{ label: long, excerpt: long, sourceProvider: long }],
        sourceForm: { label: long, url: `https://example.org/${long}`, excerpt: long },
        interview: { started: true, answers: [long], answer: long, question: long },
      }),
      "anna",
    );
    expect(d.payload.extQuery).toHaveLength(300);
    const src = d.payload.pendingSources?.[0];
    expect(src?.label).toHaveLength(300);
    expect(src?.excerpt).toHaveLength(500);
    expect(src?.sourceProvider).toHaveLength(100);
    // Überlange URL: nach dem Kappen keine Sonderfälle — hier fällt sie unter die 2048er-Grenze.
    expect((d.payload.sourceForm?.url ?? "").length).toBeLessThanOrEqual(2048);
    expect(d.payload.interview?.answers?.[0]).toHaveLength(4000);
    expect(d.payload.interview?.answer).toHaveLength(4000);
    expect(d.payload.interview?.question).toHaveLength(2000);
  });
});

describe("Block B: URL-Allowlist — nur http/https wird gespeichert", () => {
  it("javascript:/data:/relative URLs werden verworfen, nicht gespeichert", async () => {
    const { svc } = setup();
    const d = await svc.createDraft(
      asPayload({
        title: "T",
        pendingSources: [
          { label: "Böse", url: "javascript:alert(1)" },
          { label: "Data", url: "data:text/html,x" },
          { label: "Relativ", url: "/nur/pfad" },
          { label: "Gut", url: "http://example.org/ok" },
        ],
        sourceForm: { label: "Form", url: "javascript:alert(2)", excerpt: "" },
      }),
      "anna",
    );
    expect(d.payload.pendingSources).toEqual([
      { label: "Böse" },
      { label: "Data" },
      { label: "Relativ" },
      { label: "Gut", url: "http://example.org/ok" },
    ]);
    // Auch das (teilweise) Quellenformular speichert keine Nicht-Web-URL.
    expect(d.payload.sourceForm).toEqual({ label: "Form", url: "", excerpt: "" });
  });
});

describe("Block C: extResults verlassen den Draft-Vertrag (Datenminimierung)", () => {
  it("extResults im Create-Payload werden nicht persistiert; extQuery bleibt", async () => {
    const { svc } = setup();
    const d = await svc.createDraft(
      asPayload({
        title: "T",
        extQuery: "Dichtung Norm",
        extResults: [{ title: "A", url: "https://x", snippet: "s", provider: "Wiki" }],
      }),
      "anna",
    );
    expect((d.payload as Record<string, unknown>).extResults).toBeUndefined();
    expect(d.payload.extQuery).toBe("Dichtung Norm");
    const stored = await svc.getDraft(d.id);
    expect((stored?.payload as Record<string, unknown>).extResults).toBeUndefined();
  });

  it("Alt-Bestand mit extResults wird beim Fortsetzen (continueDraft) davon befreit", async () => {
    const { svc, repo } = setup();
    const legacy: Draft = {
      id: "alt1",
      payload: asPayload({
        title: "Alt",
        extResults: [{ title: "A", url: "https://x", snippet: "s", provider: "Wiki" }],
        pendingSources: [{ label: "Ok" }, { kaputt: true }],
      }),
      originalAuthor: "anna",
      lastEditor: "anna",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    };
    await repo.insert(legacy);
    const updated = await svc.continueDraft("alt1", { statement: "weiter" }, "bob");
    expect((updated.payload as Record<string, unknown>).extResults).toBeUndefined();
    expect(updated.payload.pendingSources).toEqual([{ label: "Ok" }]);
    expect(updated.payload.statement).toBe("weiter");
  });
});
