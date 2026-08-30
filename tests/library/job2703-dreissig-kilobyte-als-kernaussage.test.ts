// ================================================================================================
// JOB 2703 · D1 — DREISSIG KILOBYTE ALS KERNAUSSAGE (Review R2-3, dieselbe Klasse wie Befund 5).
// ================================================================================================
//
// DER BEFUND: `services/confluence/src/mapper.ts` setzte `statement: plain || title` — der GESAMTE
// Klartext der Seite wurde zur Kernaussage, der Volltext reiste zusätzlich als `bodyHtml`. Eine
// 30-KB-Seite ergab einen Kandidaten mit einer 30-KB-„Aussage".
//
// WAS HIER GEMESSEN WIRD:
//   H · DIE EINE HILFSFUNKTION (`library-analytics/src/kernaussage.ts`): Satzgrenze, Wortgrenze, hart
//       bei max, Leerraumfaltung, schließende Typografie, erster Absatz aus HTML, Rückfall bei leerem
//       erstem Block, Leeres bleibt leer.
//   A · DIE ABNAHME aus §5: Fixture-Seite mit DREI Absätzen → `statement` ist Absatz 1, `bodyHtml`
//       trägt alle drei. Dazu die 30-KB-Seite: Aussage höchstens 500 Zeichen, Volltext vollständig.
//   G · GEGENPROBE mit der alten Regel (der ganze Klartext) — damit der Fall nicht aus Zufall grün ist.
//   U · WAS UNVERÄNDERT BLEIBT: Titel-Rückfall bei leerem Body, Entity-Dekodierung, Provenienz.
//   D · DIE „ERSTE FOLGE" DES REVIEWS am heutigen Stand: die Zitatdeckung (JOB 2659 D4) liest den
//       Volltext seit JOB 2614 D3 ohnehin als eigenes Segment (`bodyText`). Ein Zitat aus dem Körper
//       ist VORHER wie NACHHER gedeckt — das ist richtig so (es steht in der Quelle). Der Befund trifft
//       deshalb die ANZEIGE und das Kurzfeld, nicht mehr die Deckung; belegt statt behauptet (§3).
import { describe, expect, it } from "vitest";
import { mapConfluencePageToImportItem } from "../../services/confluence/src/mapper";
import type { ConfluencePage } from "../../services/confluence/src/rest-client";
import type { KnowledgeRef } from "../../services/reasoner";
import { pruefeDeckung } from "../../services/reasoner/src/provider-model";
// JOB 2703 D2: die Kuerzungsregel liegt in `structure` (D1: library-analytics, umgelegt).
import {
  KERNAUSSAGE_MAX,
  htmlToPlainText,
  kernaussageAusHtml,
  kernaussageAusKlartext,
} from "../../services/structure";

const OPTS = { baseUrl: "https://acme.atlassian.net/wiki", spaceKey: "K" };

const ABSATZ_1 = "Bei Überdruck über 6 bar ist Ventil X sofort zu schließen.";
const ABSATZ_2 =
  "Danach wird der Druck am Manometer M4 abgelesen und im Schichtbuch vermerkt; der Schichtleiter ist zu informieren.";
const ABSATZ_3 = "Erst nach Freigabe durch den Schichtleiter darf die Anlage wieder anfahren.";

const DREI_ABSAETZE: ConfluencePage = {
  id: "2703",
  title: "Überdruck an Ventil X",
  body: {
    storage: {
      value: `<p>${ABSATZ_1}</p><p>${ABSATZ_2}</p><p>${ABSATZ_3}</p>`,
    },
  },
  version: { number: 2, by: { displayName: "Anna Admin" } },
  _links: { webui: "/spaces/K/pages/2703/Ueberdruck" },
  metadata: { labels: { results: [{ name: "sicherheit" }] } },
  restrictions: { read: { restrictions: { user: { results: [] }, group: { results: [] } } } },
};

/** Eine Seite mit rund 30 KB Klartext in einem einzigen Absatz — der Fall des Befunds. */
function dreissigKilobyte(): ConfluencePage {
  const satz =
    "Die Pumpe P-12 wird wöchentlich auf Dichtheit geprüft und das Ergebnis dokumentiert. ";
  const koerper = satz.repeat(Math.ceil(30_000 / satz.length));
  return {
    ...DREI_ABSAETZE,
    id: "2703-lang",
    title: "Pumpe P-12",
    body: { storage: { value: `<p>${koerper}</p>` } },
  };
}

describe("JOB 2703 · H — die eine Hilfsfunktion", () => {
  it("H1 · kurzer Text bleibt, wie er ist (Leerraum gefaltet)", () => {
    expect(kernaussageAusKlartext("  Ventil  X\n schließen. ")).toBe("Ventil X schließen.");
    expect(KERNAUSSAGE_MAX).toBe(500);
  });

  it("H2 · langer Text endet an der letzten SATZGRENZE im Fenster — nie mitten im Wort", () => {
    const text = `${ABSATZ_1} ${ABSATZ_2} ${ABSATZ_3}`;
    const max = ABSATZ_1.length + 20;
    expect(kernaussageAusKlartext(text, max)).toBe(ABSATZ_1);
  });

  it("H3 · ohne Satzgrenze im Fenster: die letzte WORTGRENZE; ohne Wortgrenze: hart bei max", () => {
    expect(kernaussageAusKlartext("eins zwei drei vier fünf", 14)).toBe("eins zwei drei");
    expect(kernaussageAusKlartext("x".repeat(40), 10)).toBe("x".repeat(10));
  });

  it("H4 · schließende Typografie hinter dem Satzende gehört zum Satz; Abkürzungspunkt vor Text ist keine Grenze am Rand", () => {
    const text = "Er sagte „Stopp.“ Dann ging er. Und blieb nicht.";
    expect(kernaussageAusKlartext(text, 32)).toBe("Er sagte „Stopp.“ Dann ging er.");
    // Ein Punkt genau am Fensterrand zählt nur, wenn im ganzen Text Leerraum folgt.
    expect(kernaussageAusKlartext("Wert 6.5 bar messen und protokollieren.", 6)).toBe("Wert");
  });

  it("H5 · aus HTML: der ERSTE Absatz; leerer erster Block (Bild) → Rückfall auf den ganzen Klartext, gekürzt", () => {
    expect(kernaussageAusHtml(`<p>${ABSATZ_1}</p><p>${ABSATZ_2}</p>`)).toBe(ABSATZ_1);
    expect(kernaussageAusHtml(`<h2>Titelzeile</h2><p>${ABSATZ_1}</p>`)).toBe("Titelzeile");
    expect(
      kernaussageAusHtml(`<p><img src="x.png"></p><p>${ABSATZ_1}</p><p>${ABSATZ_2}</p>`, 70),
    ).toBe(ABSATZ_1);
    expect(kernaussageAusHtml("")).toBe("");
    expect(kernaussageAusHtml("<p></p><div> </div>")).toBe("");
  });

  it("H6 · HTML-Entities werden dekodiert (dieselbe Dekodierung wie htmlToPlainText)", () => {
    expect(kernaussageAusHtml("<p>Gr&ouml;&szlig;e &amp; Ma&szlig;.</p>")).toBe("Größe & Maß.");
  });
});

describe("JOB 2703 · A — die Abnahme: ein Satz auf der Karte, der Volltext trotzdem da", () => {
  it("A1 · drei Absätze → `statement` ist Absatz 1, `bodyHtml` trägt alle drei", () => {
    const item = mapConfluencePageToImportItem(DREI_ABSAETZE, OPTS);
    expect(item.statement).toBe(ABSATZ_1);
    expect(item.bodyHtml).toContain(ABSATZ_1);
    expect(item.bodyHtml).toContain(ABSATZ_2);
    expect(item.bodyHtml).toContain(ABSATZ_3);
    // Nichts geht verloren: der Klartext des Volltexts enthält weiterhin jeden Absatz.
    expect(htmlToPlainText(item.bodyHtml ?? "")).toContain(ABSATZ_3);
  });

  it("A2 · die 30-KB-Seite: Aussage höchstens 500 Zeichen an einer Satzgrenze, Volltext vollständig", () => {
    const item = mapConfluencePageToImportItem(dreissigKilobyte(), OPTS);
    expect(item.statement.length).toBeLessThanOrEqual(KERNAUSSAGE_MAX);
    expect(item.statement.endsWith("dokumentiert.")).toBe(true);
    expect((item.bodyHtml ?? "").length).toBeGreaterThan(30_000);
  });

  it("A3 · G — GEGENPROBE: die alte Regel (ganzer Klartext) hätte die 30 KB als Aussage geführt", () => {
    const alt = htmlToPlainText(
      mapConfluencePageToImportItem(dreissigKilobyte(), OPTS).bodyHtml ?? "",
    );
    expect(alt.length).toBeGreaterThan(30_000);
    expect(kernaussageAusKlartext(alt).length).toBeLessThanOrEqual(KERNAUSSAGE_MAX);
  });
});

describe("JOB 2703 · U — was unverändert bleibt", () => {
  it("U1 · leerer Body → Titel als Aussage (nie leer); Entities im Titel dekodiert", () => {
    const leer: ConfluencePage = {
      ...DREI_ABSAETZE,
      title: "Nur &Uuml;berschrift",
      body: { storage: { value: "" } },
    };
    expect(mapConfluencePageToImportItem(leer, OPTS).statement).toBe("Nur Überschrift");
  });

  it("U2 · Provenienz, Tags und Decode-Marker wie bisher", () => {
    const item = mapConfluencePageToImportItem(DREI_ABSAETZE, OPTS);
    expect(item.externalId).toBe("2703");
    expect(item.sourceScope).toBe("K");
    expect(item.tags).toEqual(["sicherheit"]);
    expect(item.provider).toBe("Confluence");
    expect(item.textCodec).toBe("decoded");
  });
});

describe("JOB 2703 · D — die Deckung (2659) am heutigen Stand: Körpertext ist ohnehin ein Segment", () => {
  function refVon(statement: string, bodyText: string): KnowledgeRef {
    return {
      id: "p12",
      title: "Pumpe P-12",
      statement,
      status: "validiert",
      trust: 90,
      bodyText,
    };
  }
  const item = mapConfluencePageToImportItem(DREI_ABSAETZE, OPTS);
  const bodyText = htmlToPlainText(item.bodyHtml ?? "");
  const zitatAusAbsatz3 =
    "Erst nach Freigabe durch den Schichtleiter darf die Anlage wieder anfahren [1].";

  it("D1 · ein Zitat aus Absatz 3 ist mit KURZER Aussage gedeckt (über bodyText) — richtig, es steht in der Quelle", () => {
    expect(pruefeDeckung(zitatAusAbsatz3, [refVon(item.statement, bodyText)]).gedeckt).toBe(true);
  });

  it("D2 · … und war es mit der ALTEN 30-KB-Aussage ebenso — der Befund trifft die Anzeige, nicht die Deckung", () => {
    expect(pruefeDeckung(zitatAusAbsatz3, [refVon(bodyText, bodyText)]).gedeckt).toBe(true);
    // Was sich WIRKLICH ändert: die Aussage selbst ist ein Satz, nicht der Text.
    expect(item.statement.length).toBeLessThan(bodyText.length);
  });

  it("D3 · eine Erfindung bleibt ungedeckt — die Kürzung öffnet kein Loch", () => {
    expect(
      pruefeDeckung("Die Anlage darf ohne Freigabe anfahren [1].", [
        refVon(item.statement, bodyText),
      ]).gedeckt,
    ).toBe(false);
  });
});
