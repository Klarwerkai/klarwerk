// R-0293 / R-0276 / R-0317 / R-0340 / R-0618 — die Erklärfläche unter der Antwort, statisch gerendert.
// Die Abfrage (`AnswerExplanation`) und die Anzeige (`AnswerExplanationPanel`) sind getrennt; hier
// wird die Anzeige mit Serverantworten gefüttert, wie sie die Erklärroute liefert.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import type { AnswerExplanationEvidence, AnswerExplanationResponse } from "../api/types";
import { AUFLOESUNGSGRUND_SCHLUESSEL, antwortwegLage } from "../lib/answerExplanation";
import { setLanguage } from "../test/render";
import { AnswerExplanation, AnswerExplanationPanel } from "./AnswerExplanation";

type Ok = Extract<AnswerExplanationResponse, { state: "OK" }>;

function zeile(over: Partial<AnswerExplanationEvidence> = {}): AnswerExplanationEvidence {
  return {
    knowledgeObjectId: "ko-ventil",
    knowledgeObjectVersion: 3,
    evidenceRole: "carrying",
    validationDecisionRef: { auditSeq: 42, auditHash: "abcdef0123456789abcdef" },
    validationReferenceAbsenceReason: null,
    sourceRecordId: null,
    sourceRecordIdReason: "w2a_not_wired",
    locator: "Abschnitt 4.2",
    locatorReason: null,
    confidentialityAtExecution: "intern",
    responsibleAtExecution: "u-bernd",
    responsibleKindAtExecution: "owner",
    openConflictToday: false,
    redacted: false,
    ...over,
  };
}

function ok(over: Partial<Ok> = {}): Ok {
  return {
    state: "OK",
    answerId: "a-1",
    createdAt: "2026-10-01T08:00:00.000Z",
    snapshotStatus: "PARTIAL",
    snapshotRevision: 1,
    integrity: "DEGRADED",
    primaryResolutionFailure: null,
    carryingSourcesValidated: true,
    openConflictToday: false,
    generationMode: "deterministic",
    evidence: [zeile()],
    evidenceCount: 1,
    ...over,
  };
}

function panel(erklaerung: AnswerExplanationResponse): string {
  return renderToStaticMarkup(
    <AnswerExplanationPanel
      erklaerung={erklaerung}
      nameVon={(kennung) => (kennung === "u-bernd" ? "Bernd" : kennung)}
    />,
  );
}

afterEach(async () => {
  await setLanguage("de");
});

describe("Antwortweg · die Anzeige des gespeicherten Belegs", () => {
  it("zeigt Wissenseinheit, Fassung, Rolle, Quelle/Fundstelle, Freigabe, Rechte und Zuständigkeit", () => {
    const html = panel(ok());
    expect(html).toContain("Der Weg zu dieser Antwort");
    expect(html).toContain("Es wird nicht neu gesucht");
    expect(html).toContain("ko-ventil");
    expect(html).toContain("Fassung 3");
    expect(html).toContain("Trägt die Antwort – im Antworttext als Quelle belegt");
    expect(html).toContain("Quelle nicht erfasst (w2a_not_wired)");
    expect(html).toContain("Fundstelle: Abschnitt 4.2");
    expect(html).toContain("Freigabe im Prüfbuch: Eintrag 42, Prüfsumme abcdef012345");
    expect(html).toContain("Vertraulichkeit beim Antworten: intern");
    expect(html).toContain("Zuständig beim Antworten: Bernd");
    expect(html).toContain("Alle tragenden Quellen sind geprüft und freigegeben.");
    expect(html).toContain("Zu den tragenden Quellen ist heute kein Widerspruch offen.");
    expect(html).toContain("ohne KI-Modell");
    expect(html).not.toContain('data-testid="antwortweg-grund"');
  });

  it("sagt ehrlich, wenn nicht geprüft, ein Widerspruch offen oder die Lage unbekannt ist", () => {
    const offen = panel(
      ok({
        carryingSourcesValidated: false,
        openConflictToday: true,
        evidence: [zeile({ openConflictToday: true, validationDecisionRef: null })],
      }),
    );
    expect(offen).toContain("Nicht alle tragenden Quellen sind geprüft und freigegeben.");
    expect(offen).toContain("Zu einer tragenden Quelle ist heute ein Widerspruch offen.");
    expect(offen).toContain("Heute ist ein Widerspruch offen.");

    const unbekannt = panel(ok({ carryingSourcesValidated: null, openConflictToday: null }));
    expect(unbekannt).toContain("lässt sich für dich nicht feststellen");
    expect(unbekannt).toContain("Ob heute ein Widerspruch offen ist, ist nicht bekannt.");
  });

  it("R-0276: nennt genau den einen Grund — und ohne Grund die Entwertung", () => {
    expect(Object.keys(AUFLOESUNGSGRUND_SCHLUESSEL)).toHaveLength(5);
    const geloescht = panel(
      ok({ integrity: "INVALIDATED", primaryResolutionFailure: "UNKNOWN_REFERENCE", evidence: [] }),
    );
    expect(geloescht).toContain(
      "Warum der Hauptbeleg nicht auflöst: unbekannt – die Wissenseinheit gibt es nicht mehr",
    );
    expect(geloescht).not.toContain('data-testid="antwortweg-ohne-grund"');

    const ohneGrund = panel(ok({ integrity: "INVALIDATED", evidence: [] }));
    expect(ohneGrund).toContain("Ein Beleg ohne Grund gilt als entwertet.");
    expect(ohneGrund).not.toContain('data-testid="antwortweg-grund"');

    for (const [grund, schluessel] of Object.entries(AUFLOESUNGSGRUND_SCHLUESSEL)) {
      const primaryResolutionFailure = grund as Ok["primaryResolutionFailure"];
      const lage = antwortwegLage(ok({ integrity: "INVALIDATED", primaryResolutionFailure }));
      expect(lage.grundSchluessel).toBe(schluessel);
      expect(lage.entwertetOhneGrund).toBe(false);
    }
  });

  it("R-0618: eine geschwärzte Zeile zeigt nur, DASS sie beigetragen hat", () => {
    const html = panel(
      ok({
        integrity: "REDACTED",
        primaryResolutionFailure: "ACCESS_DENIED",
        carryingSourcesValidated: null,
        evidence: [
          zeile({
            knowledgeObjectId: "",
            knowledgeObjectVersion: null,
            validationDecisionRef: null,
            sourceRecordIdReason: null,
            locator: null,
            confidentialityAtExecution: null,
            responsibleAtExecution: null,
            responsibleKindAtExecution: null,
            openConflictToday: null,
            redacted: true,
          }),
          zeile({
            knowledgeObjectId: "ko-sichtbar",
            evidenceRole: "consulted",
            locator: "Kapitel 7",
          }),
        ],
        evidenceCount: 2,
      }),
    );
    expect(html).toContain("Geschwärzt – diesen Beleg darfst du heute nicht sehen.");
    expect(html).toContain("kein Zugriffsrecht");
    // Der Rest des Belegs bleibt sichtbar — geschwärzt wird die Zeile, nicht der ganze Beleg.
    expect(html).toContain("ko-sichtbar");
    expect(html).toContain("Herangezogen, aber im Antworttext nicht zitiert");
    expect(html).toContain("Fundstelle: Kapitel 7");
    expect(html).toContain("2 Belege gespeichert");
    // Genau EINE Zeile ist geschwärzt; über sie steht keine Fundstelle und keine Zuständigkeit.
    expect(html.match(/data-geschwaerzt="true"/g)).toHaveLength(1);
    expect(html.match(/Fundstelle:/g)).toHaveLength(1);
    expect(html.match(/Zuständig beim Antworten/g)).toHaveLength(1);
  });

  it("R-0340: ein Autor ohne benannten Eigentümer wird als Rückfall ausgewiesen", () => {
    const html = panel(
      ok({ evidence: [zeile({ responsibleKindAtExecution: "author-fallback" })] }),
    );
    expect(html).toContain("Zuständig beim Antworten: Bernd (als Autor – kein Eigentümer benannt)");
  });

  it("R-0317: nennt die Modellfassung als Laufprotokoll-Referenz — oder ihren Grund", () => {
    const mitLauf = panel(ok({ modelRunId: "lauf-123", modelRunIdReason: null }));
    expect(mitLauf).toContain("Modellfassung: Eintrag lauf-123 im KI-Laufprotokoll");
    const ohneLauf = panel(ok({ modelRunId: null, modelRunIdReason: "no_model_run_recorded" }));
    expect(ohneLauf).toContain("Keine Modellfassung gebunden (no_model_run_recorded)");
    // Altbestand ohne beide Felder: keine Zeile, keine Behauptung.
    expect(panel(ok())).not.toContain('data-testid="antwortweg-modelllauf"');
  });

  it("R-0618: bei geschwärzter tragender Zeile ist die Konfliktlage unbekannt, nicht „kein Widerspruch“", () => {
    const html = panel(ok({ integrity: "REDACTED", openConflictToday: null }));
    expect(html).toContain("Ob heute ein Widerspruch offen ist, ist nicht bekannt.");
    expect(html).not.toContain("Zu den tragenden Quellen ist heute kein Widerspruch offen.");
  });

  it("NO_SNAPSHOT: die Antwort hat keinen gespeicherten Beleg", () => {
    const html = panel({
      state: "NO_SNAPSHOT",
      answerId: "a-2",
      createdAt: "2026-10-01T08:00:00Z",
    });
    expect(html).toContain("Zu dieser Antwort wurde kein Beleg gespeichert.");
  });

  it("trägt die Texte in allen drei Sprachen", async () => {
    await setLanguage("en");
    expect(panel(ok())).toContain("The path to this answer");
    await setLanguage("nl");
    expect(panel(ok())).toContain("De weg naar dit antwoord");
  });
});

describe("Antwortweg · der Knopf unter der Antwort", () => {
  function knopf(answerId: string | null): string {
    return renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <AnswerExplanation answerId={answerId} />
      </QueryClientProvider>,
    );
  }

  it("bietet den Weg mit einem Klick an — geladen wird erst beim Öffnen", () => {
    const html = knopf("a-1");
    expect(html).toContain('data-testid="antwortweg-oeffnen"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Wie kam diese Antwort zustande?");
    expect(html).not.toContain('data-testid="antwortweg"');
  });

  it("ohne Belegkennung gibt es keinen toten Knopf", () => {
    expect(knopf(null)).toBe("");
  });
});
