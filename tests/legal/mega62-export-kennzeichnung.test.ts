// ================================================================================================
// AUFTRAG-mega62 BLOCK E — DIE KENNZEICHNUNG WANDERT IN DEN EXPORT, UND DIE QUELLEN AUCH.
// ================================================================================================
//
// ZWEI ZUSAGEN IN EINER DATEI, WEIL ES DIESELBE STELLE IST:
//   E1  Die KI-Kennzeichnung geht mit — maschinenlesbar als Kopfblock UND lesbar als erste Zeile.
//       Wortlaut aus Abschnitt 8 von `_relay/kopf/RECHT-KI-Verordnung-Umsetzung.md`.
//   E2  Der Export unterscheidet tragende von nur konsultierten Quellen so deutlich wie der
//       Desktop (Register F29). Bis mega61 wurde das Kennzeichen beim Bauen weggeworfen; übrig
//       blieb die Reihenfolge, und die sagt niemandem etwas.
//
// WAS DIESER BLOCK NICHT ERREICHT HAT UND WARUM — ausdrücklich, damit niemand mehr hineinliest,
// als dasteht: Es gibt in diesem Repo KEINEN Word-, PowerPoint- oder PDF-ERZEUGER. `lib/docx.ts`,
// `lib/pptx.ts` und `lib/pdf.ts` sind Import-Extraktoren, und keine der Bibliotheken (docx,
// pptxgenjs, pdfkit, jspdf) ist Abhängigkeit. „Dokumenteigenschaften setzen" hat damit heute
// keinen Anknüpfungspunkt. Der PDF-Weg des Produkts ist der Druck (`window.print()` auf
// `.print-area`) — und genau dort fehlte die Kennzeichnung, weil der Satz AUSSERHALB der
// Druckfläche stand. Das ist behoben und wird unten geprüft.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type AnswerExportInput, buildAnswerMarkdown } from "../../apps/web/src/lib/answerExport";

const WURZEL = join(__dirname, "..", "..");

// JOB 502 (Klara-Export, Quellidentität): `AnswerExportSource.sourceId` ist PFLICHT — jede Quelle
// in diesen Fällen trägt deshalb ihre stabile Kennung. Sie stehen hier ausdrücklich als benannte
// Konstanten und nicht als eingestreute Zeichenketten: dieselbe Quelle heißt in allen Fällen
// gleich, und die Erwartungen unten prüfen weiterhin GENAU die Angaben, um die es mega62 ging —
// die Kennung tritt hinzu, sie ersetzt nichts.
const KO_LIEFERWEG_NORD = "ko-lieferweg-nord";
const KO_ALTVERTRAG_2019 = "ko-altvertrag-2019";

const LABELS = {
  answer: "Antwort",
  evidence: "Evidenz",
  trust: "Trust",
  steps: "Schritte",
  sources: "Quellen",
  footer: "erstellt am {{date}}",
  aiNotice:
    "Von künstlicher Intelligenz erzeugt (KLARWERK, Frage beantwortet, 2026-07-30). Inhaltlich zu prüfen.",
};

function eingabe(ueberschreibung: Partial<AnswerExportInput> = {}): AnswerExportInput {
  return {
    question: "Wie liefern wir an Standort Nord?",
    answer: "Über das Zentrallager, mit Vorlauf von zwei Tagen.",
    statusLabel: "Gesichert",
    evidenceLabel: "belegt",
    trust: 4,
    steps: [],
    sources: [],
    generatedAt: "2026-07-30T09:00:00.000Z",
    labels: LABELS,
    ...ueberschreibung,
  };
}

describe("mega62 E1 · die KI-Kennzeichnung reist mit der Datei", () => {
  it("MASCHINENLESBAR: der Kopfblock steht ganz oben, ohne Leerzeile davor", () => {
    const md = buildAnswerMarkdown(eingabe());
    const zeilen = md.split("\n");
    // Ohne Position ganz oben erkennt ihn kein Werkzeug — dann wäre er nur Zierat.
    expect(zeilen[0]).toBe("---");
    expect(zeilen.slice(1, 5)).toEqual([
      "ai-generated: true",
      "ai-system: KLARWERK",
      "ai-task: answer",
      "ai-date: 2026-07-30",
    ]);
    expect(zeilen[5]).toBe("---");
  });

  it("MENSCHENLESBAR: der Satz steht direkt unter der Überschrift, nicht am Ende", () => {
    const md = buildAnswerMarkdown(eingabe());
    const zeilen = md.split("\n");
    const ueberschrift = zeilen.findIndex((z) => z.startsWith("# "));
    expect(ueberschrift).toBeGreaterThan(0);
    // Direkt darunter (eine Leerzeile dazwischen) — wer die Datei aufmacht, sieht ihn sofort.
    expect(zeilen[ueberschrift + 2]).toBe(`_${LABELS.aiNotice}_`);
  });

  it("der Wortlaut nennt System, Aufgabe und Datum — sonst wäre er ohne Bezug", () => {
    const md = buildAnswerMarkdown(eingabe());
    expect(md).toContain("KLARWERK");
    expect(md).toContain("Frage beantwortet");
    expect(md).toContain("2026-07-30");
    expect(md).toContain("Inhaltlich zu prüfen");
  });

  it("KALIBRIERUNG: der Kopfblock ist nicht schon vorher dagewesen", () => {
    // Ohne diesen Schritt bewiese der erste Fall nichts über DIESEN Block. Der Vertrag verlangt
    // `aiNotice` seit mega62 als PFLICHTFELD — ein Export ohne Kennzeichnung ist typseitig
    // unmöglich, und genau das hält dieser Fall fest.
    const quelle = readFileSync(join(WURZEL, "apps/web/src/lib/answerExport.ts"), "utf8");
    expect(quelle).toContain("aiNotice: string;");
    expect(quelle).not.toContain("aiNotice?: string");
  });

  it("der Druckweg trägt sie ebenfalls — der Satz steht INNERHALB der Druckfläche", () => {
    // Das Produkt hat keinen PDF-Erzeuger; sein PDF entsteht über den Browserdruck von
    // `.print-area`. Stand der Satz außerhalb, fehlte er im gedruckten Blatt — die Fläche, die am
    // ehesten weitergereicht wird.
    const ask = readFileSync(join(WURZEL, "apps/web/src/pages/Ask.tsx"), "utf8");
    const druckflaeche = ask.indexOf('className="print-area');
    expect(druckflaeche, "die Druckfläche ist verschwunden").toBeGreaterThan(0);
    const rest = ask.slice(druckflaeche);
    const satz = rest.indexOf("<AiGeneratedNotice");
    expect(satz, "der KI-Satz steht nicht innerhalb der Druckfläche").toBeGreaterThan(0);
    // Und er kommt VOR dem Ende der Karte, nicht irgendwo weit dahinter.
    expect(satz).toBeLessThan(2000);
  });
});

describe("mega62 E2 · der Export unterscheidet tragende von konsultierten Quellen", () => {
  it("das Kennzeichen steht an jeder Zeile, und zwar ZUERST", () => {
    const md = buildAnswerMarkdown(
      eingabe({
        sources: [
          {
            sourceId: KO_LIEFERWEG_NORD,
            title: "Lieferweg Nord",
            attributionLabel: "trägt",
            statusLabel: "Gesichert",
            trust: 5,
          },
          {
            sourceId: KO_ALTVERTRAG_2019,
            title: "Altvertrag 2019",
            attributionLabel: "angesehen",
            statusLabel: "Entwurf",
          },
        ],
      }),
    );
    expect(md).toContain("- Lieferweg Nord — trägt · Gesichert · Trust 5");
    expect(md).toContain("- Altvertrag 2019 — angesehen · Entwurf");
  });

  it("KALIBRIERUNG: ohne Kennzeichen sähen beide Zeilen gleich aus — genau der alte Zustand", () => {
    const md = buildAnswerMarkdown(
      eingabe({
        sources: [
          { sourceId: KO_LIEFERWEG_NORD, title: "Lieferweg Nord", statusLabel: "Gesichert" },
          { sourceId: KO_ALTVERTRAG_2019, title: "Altvertrag 2019", statusLabel: "Gesichert" },
        ],
        labels: {
          ...LABELS,
          attributionUnknown: "Welche Quellen die Antwort tragen, ist unbekannt.",
        },
      }),
    );
    // Beide Zeilen ohne Kennzeichen — und genau deshalb MUSS der Erklärsatz dastehen.
    expect(md).toContain("- Lieferweg Nord — Gesichert");
    expect(md).toContain("- Altvertrag 2019 — Gesichert");
    expect(md).toContain("_Welche Quellen die Antwort tragen, ist unbekannt._");
  });

  it("UNBEKANNTE ZUORDNUNG wird gesagt, nicht verschwiegen", () => {
    const md = buildAnswerMarkdown(
      eingabe({
        sources: [{ sourceId: KO_LIEFERWEG_NORD, title: "Lieferweg Nord" }],
        labels: { ...LABELS, attributionUnknown: "Zuordnung unbekannt." },
      }),
    );
    const zeilen = md.split("\n");
    const ueberschrift = zeilen.findIndex((z) => z === "## Quellen");
    expect(ueberschrift).toBeGreaterThan(0);
    // Der Satz steht ÜBER der Liste — danach wäre er die Fußnote zu einer schon gelesenen Liste.
    expect(zeilen.slice(ueberschrift, ueberschrift + 3).join("\n")).toContain(
      "_Zuordnung unbekannt._",
    );
  });

  it("bei bekannter Zuordnung steht der Unbekannt-Satz NICHT da", () => {
    const md = buildAnswerMarkdown(
      eingabe({
        sources: [
          { sourceId: KO_LIEFERWEG_NORD, title: "Lieferweg Nord", attributionLabel: "trägt" },
        ],
        labels: { ...LABELS, attributionUnknown: "Zuordnung unbekannt." },
      }),
    );
    expect(md).not.toContain("Zuordnung unbekannt.");
  });

  it("die Oberfläche reicht das Kennzeichen wirklich durch — sonst wäre der Vertrag oben leer", () => {
    // Der Vertrag kann das Feld nur tragen; FÜLLEN muss es die Fragenfläche. Bis mega61 tat sie
    // das nicht, und genau daran ist es gescheitert.
    const ask = readFileSync(join(WURZEL, "apps/web/src/pages/Ask.tsx"), "utf8");
    expect(ask).toContain("attributionLabel:");
    expect(ask).toContain("ask.attribution.carrying.badge");
    expect(ask).toContain("ask.attribution.consulted.badge");
  });
});

describe("mega62 E · die Kennzeichnung gibt es in allen drei Sprachen", () => {
  it("ai.exportNotice und ai.task.answer stehen je dreimal", () => {
    const i18n = readFileSync(join(WURZEL, "apps/web/src/i18n.ts"), "utf8");
    for (const schluessel of ["ai.exportNotice", "ai.task.answer"]) {
      const treffer = i18n.split("\n").filter((z) => z.includes(`"${schluessel}"`));
      expect(treffer.length, `${schluessel} fehlt in einer Sprache`).toBe(3);
    }
    // Und die Platzhalter sind in jeder Sprache da — ein Satz ohne Bezug wäre wertlos.
    const zeilen = i18n.split("\n");
    for (const [i, zeile] of zeilen.entries()) {
      if (!zeile.includes('"ai.exportNotice"')) {
        continue;
      }
      const text = `${zeile}${zeilen[i + 1] ?? ""}`;
      expect(text).toContain("{{task}}");
      expect(text).toContain("{{date}}");
      expect(text).toContain("KLARWERK");
    }
  });
});
