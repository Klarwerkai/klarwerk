// ================================================================================================
// R-1643 · ENTSCHEIDUNGS-PROTOKOLL — DER DATEIVERTRAG.
// ================================================================================================
//
// Originalwortlaut (Funktions-Roadmap 6.1): eine KLARWERK-gestützte Entscheidung „kann mit einem
// Klick als Audit-Dokument exportiert werden — PDF mit allen Quellen, Trust-Werten,
// Argumentationskette, Zeitstempel, Nutzer-ID".
//
// Quellen samt Kennung (JOB 502), Vertrauenswerte und Schritte (SCRUM-430) trug der Export schon;
// sie sind in `answer-export.test.ts` und `mega62-export-kennzeichnung.test.ts` belegt und werden
// hier nicht wiederholt. Dieser Test prüft, was R-1643 HINZUFÜGT: Zeitstempel (voll, nicht nur der
// Tag) und Nutzer-ID — maschinenlesbar im Kopfblock und lesbar im Abschnitt — und dass ohne
// Sitzung nichts erfunden wird. Der Druck-/PDF-Weg ist gemountet in
// `r1643-entscheidungsprotokoll-druck.test.tsx` geprüft.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type AnswerExportInput,
  buildAnswerMarkdown,
  decisionProtocolRows,
  sourceFacts,
} from "../../apps/web/src/lib/answerExport";

const WURZEL = join(__dirname, "..", "..");

const PROTOKOLL_LABELS = {
  heading: "Entscheidungs-Protokoll",
  time: "Zeitpunkt (UTC)",
  user: "Nutzer-ID",
  userUnknown: "nicht angemeldet – keine Kennung vorhanden",
};

function eingabe(ueberschreibung: Partial<AnswerExportInput> = {}): AnswerExportInput {
  return {
    question: "Bestellen wir die Firmenwagen in Blau?",
    answer: "Ja — laut Farbregelung werden alle Firmenwagen in Blau bestellt.",
    statusLabel: "Gesichert",
    evidenceLabel: "validiert",
    trust: 91,
    steps: [{ description: "Quelle: Farbregelung", snippet: "Alle in Blau." }],
    sources: [
      {
        sourceId: "ko-487",
        title: "Farbregelung Firmenwagen",
        attributionLabel: "trägt",
        statusLabel: "Validiert",
        trust: 91,
      },
    ],
    generatedAt: "2026-10-08T09:15:02.123Z",
    labels: {
      answer: "Antwort",
      evidence: "Evidenz",
      trust: "Vertrauen",
      steps: "Schritte",
      sources: "Quellen",
      footer: "erstellt am {{date}}",
      aiNotice: "Von künstlicher Intelligenz erzeugt (KLARWERK, Frage beantwortet, 2026-10-08).",
    },
    protocol: { userId: "u-7", labels: PROTOKOLL_LABELS },
    ...ueberschreibung,
  };
}

describe("R-1643 · Zeitstempel und Nutzer-ID im exportierten Dokument", () => {
  it("der Abschnitt nennt den VOLLEN Zeitstempel und die Nutzer-ID", () => {
    const md = buildAnswerMarkdown(eingabe());
    const zeilen = md.split("\n");
    const kopf = zeilen.indexOf("## Entscheidungs-Protokoll");
    expect(kopf, "kein Protokollabschnitt").toBeGreaterThan(0);
    expect(zeilen.slice(kopf + 1, kopf + 3)).toEqual([
      "- Zeitpunkt (UTC): 2026-10-08T09:15:02.123Z",
      "- Nutzer-ID: `u-7`",
    ]);
  });

  it("der Kopfblock trägt beides maschinenlesbar — die KI-Kennzeichnung bleibt unverändert davor", () => {
    const md = buildAnswerMarkdown(eingabe());
    const zeilen = md.split("\n");
    expect(zeilen.slice(0, 8)).toEqual([
      "---",
      "ai-generated: true",
      "ai-system: KLARWERK",
      "ai-task: answer",
      "ai-date: 2026-10-08",
      "exported-at: 2026-10-08T09:15:02.123Z",
      'user-id: "u-7"',
      "---",
    ]);
  });

  it("im selben Dokument stehen weiterhin Quellen mit Kennung, Vertrauenswert und Schritte", () => {
    const md = buildAnswerMarkdown(eingabe());
    expect(md).toContain("**Antwort** · Gesichert · Evidenz: validiert · Vertrauen 91");
    expect(md).toContain("## Schritte");
    expect(md).toContain("> Alle in Blau.");
    expect(md).toContain(
      "- Farbregelung Firmenwagen — trägt · Validiert · Vertrauen 91 · `ko-487`",
    );
    // Das Protokoll steht nach den Quellen und vor der Fußnote.
    expect(md.indexOf("## Quellen")).toBeLessThan(md.indexOf("## Entscheidungs-Protokoll"));
    expect(md.indexOf("## Entscheidungs-Protokoll")).toBeLessThan(md.indexOf("_erstellt am"));
  });

  it("ohne Sitzung wird KEINE Kennung erfunden — das Dokument sagt, dass niemand angemeldet war", () => {
    const md = buildAnswerMarkdown(
      eingabe({ protocol: { userId: null, labels: PROTOKOLL_LABELS } }),
    );
    expect(md).toContain("- Nutzer-ID: nicht angemeldet – keine Kennung vorhanden");
    expect(md).not.toContain("user-id:");
    // Der Zeitpunkt steht trotzdem.
    expect(md).toContain("exported-at: 2026-10-08T09:15:02.123Z");
  });

  it("eine leere Kennung zählt wie keine", () => {
    const zeilen = decisionProtocolRows(eingabe(), { userId: "  ", labels: PROTOKOLL_LABELS });
    expect(zeilen[1]).toEqual({
      label: "Nutzer-ID",
      value: PROTOKOLL_LABELS.userUnknown,
      kennung: false,
    });
  });

  it("KALIBRIERUNG: ohne Protokoll bleibt die Datei zeichengleich wie vor R-1643", () => {
    // `exactOptionalPropertyTypes`: „kein Protokoll" heißt, das Feld FEHLT — nicht `undefined`.
    const ohneProtokoll = eingabe();
    delete ohneProtokoll.protocol;
    const md = buildAnswerMarkdown(ohneProtokoll);
    expect(md).not.toContain("Entscheidungs-Protokoll");
    expect(md).not.toContain("exported-at:");
    expect(md.split("\n")[5]).toBe("---");
  });

  it("Datei und Blatt teilen die Quellenangaben — die Markdown-Zeile setzt nur die Kennung in Backticks", () => {
    const quelle = eingabe().sources[0];
    expect(quelle).toBeDefined();
    if (!quelle) return;
    expect(sourceFacts(quelle, "Vertrauen")).toEqual([
      "trägt",
      "Validiert",
      "Vertrauen 91",
      "ko-487",
    ]);
  });
});

describe("R-1643 · die Fragenfläche gibt das Protokoll wirklich mit", () => {
  it("Nutzer-ID aus derselben Kontokennung wie der Arbeitsstand, ohne Ersatzwert", () => {
    const ask = readFileSync(join(WURZEL, "apps/web/src/pages/Ask.tsx"), "utf8");
    expect(ask).toContain("userId: konto,");
    expect(ask).not.toContain("userId: konto ??");
    expect(ask).toContain("const konto = useKontoKennung();");
  });

  it("die Protokolltexte stehen in allen drei Sprachen", () => {
    for (const sprache of ["de", "en", "nl"]) {
      const datei = readFileSync(join(WURZEL, `apps/web/src/woerterbuch/${sprache}.ts`), "utf8");
      for (const schluessel of ["heading", "time", "user", "userUnknown"]) {
        expect(datei, `${sprache}: ask.export.protocol.${schluessel} fehlt`).toContain(
          `"ask.export.protocol.${schluessel}":`,
        );
      }
    }
  });
});
