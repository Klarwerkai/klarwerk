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
  decisionArguments,
  decisionProtocolRows,
  sourceFacts,
} from "../../apps/web/src/lib/answerExport";
import { antwortAbsaetze, buildAnswerDatei } from "../../apps/web/src/lib/antwortDateien";

const WURZEL = join(__dirname, "..", "..");

const PROTOKOLL_LABELS = {
  heading: "Entscheidungs-Protokoll",
  time: "Zeitpunkt (UTC)",
  user: "Nutzer-ID",
  userUnknown: "nicht angemeldet – keine Kennung vorhanden",
  argumentation: "Argumentationskette",
  supportedBy: "belegt durch",
  argumentationMissing: "Für diese Antwort liegt keine Argumentationskette vor.",
};

const KETTE = [
  {
    aussage: "Alle Firmenwagen werden in Blau bestellt.",
    belegtDurch: "ko-487",
  },
];

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
    protocol: { userId: "u-7", argumentation: KETTE, labels: PROTOKOLL_LABELS },
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
      eingabe({ protocol: { userId: null, argumentation: KETTE, labels: PROTOKOLL_LABELS } }),
    );
    expect(md).toContain("- Nutzer-ID: nicht angemeldet – keine Kennung vorhanden");
    expect(md).not.toContain("user-id:");
    // Der Zeitpunkt steht trotzdem.
    expect(md).toContain("exported-at: 2026-10-08T09:15:02.123Z");
  });

  it("eine leere Kennung zählt wie keine", () => {
    const zeilen = decisionProtocolRows(eingabe(), {
      userId: "  ",
      argumentation: KETTE,
      labels: PROTOKOLL_LABELS,
    });
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

// ================================================================================================
// R-1643 · DIE ARGUMENTATIONSKETTE (Ben, Nacharbeit 2).
// ================================================================================================
// Befund: exportiert wurden nur Quellenüberschriften und Auszüge (`steps`), die der Reasoner direkt
// aus den herangezogenen Kandidaten baut — keine Begründung. Jetzt steht je Aussage der Antwort die
// Quelle da, deren Wortlaut sie belegt (vom Reasoner gemessen, s. `argumentationAus`). Fehlt die
// Kette, sagt das Dokument das; die Schritte springen NICHT ein.
describe("R-1643 · Argumentationskette im exportierten Dokument", () => {
  it("jede Aussage steht nummeriert mit der Quelle, die sie belegt — Titel und Kennung", () => {
    const md = buildAnswerMarkdown(
      eingabe({
        protocol: {
          userId: "u-7",
          argumentation: [
            { aussage: "Alle Firmenwagen werden in Blau bestellt.", belegtDurch: "ko-487" },
            { aussage: "Ausnahmen gibt es nicht.", belegtDurch: "ko-unbekannt" },
          ],
          labels: PROTOKOLL_LABELS,
        },
      }),
    );
    const zeilen = md.split("\n");
    const kopf = zeilen.indexOf("### Argumentationskette");
    expect(kopf, "kein Abschnitt Argumentationskette").toBeGreaterThan(0);
    expect(zeilen.slice(kopf + 1, kopf + 3)).toEqual([
      "1. „Alle Firmenwagen werden in Blau bestellt.“ — belegt durch: Farbregelung Firmenwagen `ko-487`",
      // Steht die Quelle nicht in der Quellenliste, bleibt es bei der Kennung — kein erfundener Titel.
      "2. „Ausnahmen gibt es nicht.“ — belegt durch: `ko-unbekannt`",
    ]);
    // Die Kette gehört zum Protokoll: nach Zeitpunkt und Nutzer-ID, vor der Fußnote.
    expect(md.indexOf("- Nutzer-ID:")).toBeLessThan(md.indexOf("### Argumentationskette"));
    expect(md.indexOf("### Argumentationskette")).toBeLessThan(md.indexOf("_erstellt am"));
  });

  it("ohne Kette sagt das Dokument es — die Schritte ersetzen sie NICHT", () => {
    for (const argumentation of [null, []]) {
      const md = buildAnswerMarkdown(
        eingabe({ protocol: { userId: "u-7", argumentation, labels: PROTOKOLL_LABELS } }),
      );
      const zeilen = md.split("\n");
      const kopf = zeilen.indexOf("### Argumentationskette");
      expect(kopf).toBeGreaterThan(0);
      expect(zeilen[kopf + 1]).toBe(`_${PROTOKOLL_LABELS.argumentationMissing}_`);
      // Kein Glied, und schon gar nicht der Schritt „Quelle: Farbregelung" als Glied.
      expect(zeilen[kopf + 2] ?? "").not.toMatch(/^1\. /);
    }
  });

  it("decisionArguments liefert Datei und Blatt dieselben Glieder", () => {
    const protokoll = eingabe().protocol;
    expect(protokoll).toBeDefined();
    if (!protokoll) return;
    expect(decisionArguments(eingabe(), protokoll)).toEqual([
      {
        aussage: "Alle Firmenwagen werden in Blau bestellt.",
        quelleTitel: "Farbregelung Firmenwagen",
        quelleId: "ko-487",
      },
    ]);
  });

  it("die Fragenfläche nimmt die Kette vom Server und setzt keine Schritte an ihre Stelle", () => {
    const ask = readFileSync(join(WURZEL, "apps/web/src/pages/Ask.tsx"), "utf8");
    expect(ask).toContain("argumentation: result.argumentation ?? null,");
    expect(ask).not.toMatch(/argumentation: result\.steps/);
  });
});

// ================================================================================================
// R-1643 · ZUSAMMENFÜHRUNG MIT main (R-0703 / R-0604 / R-0625).
// ================================================================================================
// main hat echte Word-, PowerPoint- und PDF-Dateien (`antwortDateien.ts`) und die dreiwertige
// KI-Herkunft (`kiHerkunft`) gebracht. Beide Zusagen bleiben: die Dateien tragen das Protokoll, und
// der belegte modellfreie Rückfall nimmt nur die KI-Zeilen heraus — nicht Zeitpunkt und Nutzer-ID.
describe("R-1643 · Protokoll in Word, PowerPoint und PDF; Kopfblock bei „ohne-ki“", () => {
  it("antwortAbsaetze (gemeinsamer Inhalt aller drei Dateiformate) trägt Zeitpunkt, Nutzer-ID und Kette", () => {
    const texte = antwortAbsaetze(eingabe()).map((a) => a.text);
    expect(texte).toContain("Entscheidungs-Protokoll");
    expect(texte).toContain("Zeitpunkt (UTC): 2026-10-08T09:15:02.123Z");
    expect(texte).toContain("Nutzer-ID: u-7");
    expect(texte).toContain("Argumentationskette");
    expect(texte).toContain(
      "1. „Alle Firmenwagen werden in Blau bestellt.“ — belegt durch: Farbregelung Firmenwagen (ko-487)",
    );
    // Wie im Markdown: nach den Quellen, vor der Fußnote.
    const kopf = texte.indexOf("Entscheidungs-Protokoll");
    expect(kopf).toBeGreaterThan(texte.indexOf("Quellen"));
    expect(kopf).toBeLessThan(texte.findIndex((t) => t.startsWith("erstellt am")));
  });

  it("ohne Kette sagen auch die Dateien es — keine Schritte als Ersatz", () => {
    const texte = antwortAbsaetze(
      eingabe({ protocol: { userId: null, argumentation: null, labels: PROTOKOLL_LABELS } }),
    ).map((a) => a.text);
    expect(texte).toContain(PROTOKOLL_LABELS.argumentationMissing);
    expect(texte).toContain(`Nutzer-ID: ${PROTOKOLL_LABELS.userUnknown}`);
    expect(texte.some((t) => t.startsWith("1. "))).toBe(false);
  });

  it("die PDF-Datei entsteht mit Protokoll — alle Protokollzeichen sind darstellbar", () => {
    for (const format of ["pdf", "docx", "pptx"] as const) {
      const bytes = buildAnswerDatei(eingabe(), format);
      expect(bytes.length, `${format}: leere Datei`).toBeGreaterThan(0);
    }
  });

  it("„ohne-ki“ mit Protokoll: Kopfblock nur mit Zeitpunkt und Nutzer-ID, ohne KI-Zeilen", () => {
    const md = buildAnswerMarkdown(eingabe({ kiHerkunft: "ohne-ki" }));
    expect(md.split("\n").slice(0, 4)).toEqual([
      "---",
      "exported-at: 2026-10-08T09:15:02.123Z",
      'user-id: "u-7"',
      "---",
    ]);
    expect(md).not.toContain("ai-generated");
    expect(md).toContain("## Entscheidungs-Protokoll");
  });

  it("GEGENPROBE: „ohne-ki“ ohne Protokoll bleibt wie in main — gar kein Kopfblock", () => {
    const ohneProtokoll = eingabe({ kiHerkunft: "ohne-ki" });
    delete ohneProtokoll.protocol;
    expect(buildAnswerMarkdown(ohneProtokoll).startsWith("# ")).toBe(true);
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
      for (const schluessel of [
        "heading",
        "time",
        "user",
        "userUnknown",
        "argumentation",
        "supportedBy",
        "argumentationMissing",
      ]) {
        expect(datei, `${sprache}: ask.export.protocol.${schluessel} fehlt`).toContain(
          `"ask.export.protocol.${schluessel}":`,
        );
      }
    }
  });
});
