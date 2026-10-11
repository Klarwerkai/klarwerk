// ================================================================================================
// R-0570 · DIE INHALTE DER ANONYMEN VORFÜHRUNG — AUSSCHLIESSLICH ERFUNDEN.
// ================================================================================================
//
// Entscheidung zu Frage 14 (Peter, 11.10.2026, QUELLEN-FACHHILFE-PETER-ENTSCHEIDUNGEN-20261011):
// „Firmenwissen authentifiziert; anonyme Demo nur öffentlich/fiktiv."
//
// DIESE DATEI IST EIN BLATT UND MUSS ES BLEIBEN. Sie importiert nichts — keinen Wissensspeicher,
// keine Suche, keinen KI-Weg. Was ein Unangemeldeter lesen oder fragen kann, steht vollständig in
// den Zeilen unten; einen Weg zum Unternehmenswissen gibt es von hier aus nicht, auch nicht durch
// einen Fehler in einer Abfrage. Gehalten von `tests/vorfuehrung-anonym/abgrenzung.test.ts` (I1).
//
// ERFUNDEN HEISST: der Betrieb („Musterwerk“), die Abläufe und die Zahlen sind ausgedacht und als
// Beispiel gekennzeichnet. Jeder Titel trägt die Kennzeichnung selbst, damit sie auch dann nicht
// verloren geht, wenn jemand einen einzelnen Eintrag weitergibt.

export type VorfuehrungsSprache = "de" | "en" | "nl";

export interface VorfuehrungsEintrag {
  readonly id: string;
  readonly titel: string;
  readonly aussage: string;
}

/** Die Kennzeichnung, die jede Antwort dieser Fläche trägt. */
export const KENNZEICHNUNG: Readonly<Record<VorfuehrungsSprache, string>> = {
  de: "Vorführung mit erfundenen Beispielinhalten des fiktiven Betriebs „Musterwerk“. Kein Unternehmenswissen.",
  en: "Demonstration with invented sample content from the fictitious company “Musterwerk”. No company knowledge.",
  nl: "Demonstratie met verzonnen voorbeeldinhoud van het fictieve bedrijf „Musterwerk”. Geen bedrijfskennis.",
};

export const INHALTE: Readonly<Record<VorfuehrungsSprache, readonly VorfuehrungsEintrag[]>> = {
  de: [
    {
      id: "v1",
      titel: "Druckluftanlage vor der Wartung drucklos machen (Beispiel, fiktiv)",
      aussage:
        "Vor jeder Wartung an der Druckluftanlage im Musterwerk wird der Hauptschieber geschlossen, der Restdruck über das Ablassventil abgebaut und am Manometer null bar abgelesen. Erst dann wird geöffnet.",
    },
    {
      id: "v2",
      titel: "Erste-Hilfe-Kasten monatlich prüfen (Beispiel, fiktiv)",
      aussage:
        "Im Musterwerk prüft die Schichtleitung am ersten Werktag jedes Monats Vollständigkeit und Ablaufdaten des Erste-Hilfe-Kastens und trägt die Prüfung ins Kastenblatt ein.",
    },
    {
      id: "v3",
      titel: "Werkzeugausgabe dokumentieren (Beispiel, fiktiv)",
      aussage:
        "Ausgegebenes Spezialwerkzeug wird im Musterwerk mit Name, Datum und Rückgabetermin im Ausgabebuch vermerkt; bei Rückgabe zeichnet die Ausgabe gegen.",
    },
    {
      id: "v4",
      titel: "Urlaub beantragen (Beispiel, fiktiv)",
      aussage:
        "Urlaub wird im Musterwerk spätestens zwei Wochen vorher bei der direkten Vorgesetzten beantragt; die Bestätigung kommt schriftlich.",
    },
  ],
  en: [
    {
      id: "v1",
      titel: "Depressurise the compressed-air system before maintenance (sample, fictitious)",
      aussage:
        "Before any maintenance on the compressed-air system at Musterwerk, the main valve is closed, residual pressure is released through the drain valve and zero bar is read on the pressure gauge. Only then is the system opened.",
    },
    {
      id: "v2",
      titel: "Check the first-aid kit monthly (sample, fictitious)",
      aussage:
        "At Musterwerk, the shift lead checks the first-aid kit for completeness and expiry dates on the first working day of each month and records the check on the kit sheet.",
    },
    {
      id: "v3",
      titel: "Record tool issue (sample, fictitious)",
      aussage:
        "Special tools issued at Musterwerk are recorded in the issue book with name, date and return date; the tool desk countersigns on return.",
    },
    {
      id: "v4",
      titel: "Request leave (sample, fictitious)",
      aussage:
        "At Musterwerk, leave is requested from the direct manager at least two weeks in advance; confirmation is given in writing.",
    },
  ],
  nl: [
    {
      id: "v1",
      titel: "Persluchtinstallatie vóór onderhoud drukloos maken (voorbeeld, fictief)",
      aussage:
        "Vóór elk onderhoud aan de persluchtinstallatie in het Musterwerk wordt de hoofdafsluiter gesloten, de restdruk via de aftapkraan afgelaten en nul bar op de manometer afgelezen. Pas dan wordt geopend.",
    },
    {
      id: "v2",
      titel: "EHBO-koffer maandelijks controleren (voorbeeld, fictief)",
      aussage:
        "In het Musterwerk controleert de ploegleiding op de eerste werkdag van elke maand of de EHBO-koffer volledig is en niets over datum is, en noteert de controle op het kofferblad.",
    },
    {
      id: "v3",
      titel: "Uitgifte van gereedschap vastleggen (voorbeeld, fictief)",
      aussage:
        "Uitgegeven speciaal gereedschap wordt in het Musterwerk met naam, datum en retourdatum in het uitgifteboek genoteerd; bij retour tekent de uitgifte af.",
    },
    {
      id: "v4",
      titel: "Verlof aanvragen (voorbeeld, fictief)",
      aussage:
        "Verlof wordt in het Musterwerk uiterlijk twee weken vooraf bij de directe leidinggevende aangevraagd; de bevestiging volgt schriftelijk.",
    },
  ],
};

/** Die längste Frage, die gelesen wird — der Rest wird abgeschnitten, nicht abgewiesen. */
export const FRAGE_MAX_ZEICHEN = 300;

const WORT = /[\p{L}\p{N}]+/gu;

/** Füllwörter ab vier Zeichen, die sonst jeden Eintrag träfen. Kürzere Wörter zählen ohnehin nicht. */
const FUELLWOERTER = new Set([
  "wird",
  "werden",
  "eine",
  "einen",
  "einem",
  "einer",
  "dann",
  "oder",
  "nach",
  "auch",
  "wann",
  "muss",
  "with",
  "from",
  "this",
  "that",
  "what",
  "when",
  "should",
  "must",
  "wordt",
  "worden",
  "voor",
  "naar",
  "moet",
  "wanneer",
]);

function woerter(text: string): string[] {
  return (text.toLowerCase().match(WORT) ?? []).filter(
    (w) => w.length >= 4 && !FUELLWOERTER.has(w),
  );
}

/** Gleiches Wort, oder bei Wörtern ab fünf Zeichen dieselbe Wortwurzel („Wartung“ ~ „Wartungen“). */
function passt(a: string, b: string): boolean {
  if (a === b) {
    return true;
  }
  return Math.min(a.length, b.length) >= 5 && (a.startsWith(b) || b.startsWith(a));
}

/**
 * Die Antwort auf eine Frage: die passenden erfundenen Einträge, bestbewertet zuerst.
 *
 * BEWUSST OHNE KI. Ein Sprachmodell für Unangemeldete wäre ein offener Kostenweg und eine
 * Übermittlung an einen Dritten ohne jede Kenntnisnahme; darüber ist nicht entschieden. Gesucht wird
 * deshalb nur im festen Bestand oben — die Antwort IST der passende Eintrag.
 */
export function beantworte(
  frage: string,
  sprache: VorfuehrungsSprache,
): { treffer: VorfuehrungsEintrag[] } {
  const gesucht = new Set(woerter(frage.slice(0, FRAGE_MAX_ZEICHEN)));
  if (gesucht.size === 0) {
    return { treffer: [] };
  }
  const bewertet = INHALTE[sprache]
    .map((eintrag) => {
      const vorhanden = woerter(`${eintrag.titel} ${eintrag.aussage}`);
      let punkte = 0;
      for (const wort of gesucht) {
        if (vorhanden.some((v) => passt(v, wort))) {
          punkte += 1;
        }
      }
      return { eintrag, punkte };
    })
    .filter((b) => b.punkte > 0)
    .sort((a, b) => b.punkte - a.punkte);
  return { treffer: bewertet.slice(0, 3).map((b) => b.eintrag) };
}
