// ================================================================================================
// AUFNAHME 20260922 · R-0346 (Ben nacharbeit-9, Befund 2) — DER ZUSCHNITT WIRKT AUF DIE ANTWORT.
// ================================================================================================
//
// Bis hierher erreichte der Zuschnitt (Rolle und Dokumentanlass) nur die nachträgliche Erklärung:
// Aufklappzustand und technische Kennungen. Jetzt verändert er die gegebene Antwort selbst — und
// zwar so, dass ihre Quellenbindung bleibt:
//
//   · TIEFE `ausfuehrlich` ergänzt die Antwort um die WÖRTLICHEN Voraussetzungen und Maßnahmen der
//     TRAGENDEN Quellen (`KnowledgeObject.conditions` / `measures`), je Quelle benannt. Es wird
//     nichts formuliert, nichts zusammengefasst und keine weitere Quelle herangezogen. `kurz` lässt
//     die Antwort, wie sie ist.
//   · REIHENFOLGE DER WISSENSARTEN: die Ergänzungen der tragenden Quellen folgen der Reihenfolge
//     des Zuschnitts (z. B. Anlass Dokument: bewährte Vorgehensweise vor Technik).
//   · FACHSPRACHE `allgemein` ergänzt Erklärungen der Fachbegriffe, die in der Antwort vorkommen —
//     AUSSCHLIESSLICH aus dem gepflegten Firmenwörterbuch (Vorzugsbenennung oder Synonym mit
//     Definition). `fach` ergänzt keine Erklärungen.
//
// WAS AUSDRÜCKLICH NICHT GESCHIEHT:
//   · Der wörtliche Antwortweg (Word ohne Einwilligung, Add-on-Schlüssel, `retrievalOnly`) bleibt
//     Zeichen für Zeichen die validierte Aussage — der Aufrufer wendet diese Funktion dort nicht an.
//   · Kein Modellaufruf, kein Egress: alles kommt aus Objekten, die der Aufrufer bereits sehen darf.
//   · Was schon in der Antwort steht, wird nicht noch einmal angehängt.
import type { KnowledgeObject, KnowledgeType } from "../../knowledge-object";

export interface ZuschnittBegriff {
  benennung: string;
  definition: string;
}

export interface ZuschnittDerAntwort {
  tiefe: "kurz" | "ausfuehrlich";
  fachsprache: "allgemein" | "fach";
  reihenfolge: readonly KnowledgeType[];
}

/** Was der Zuschnitt an der Antwort tatsächlich ergänzt hat — sichtbar und prüfbar. */
export interface ZuschnittErgaenzung {
  art: "voraussetzungen" | "massnahmen" | "begriffe";
  /** Die tragende Quelle, aus der die Einträge wörtlich stammen; bei Begriffen `null`. */
  quelleId: string | null;
  eintraege: string[];
}

export interface ZugeschnitteneAntwort {
  text: string;
  ergaenzungen: ZuschnittErgaenzung[];
}

const BESCHRIFTUNG: Record<"de" | "en" | "nl", Record<ZuschnittErgaenzung["art"], string>> = {
  de: { voraussetzungen: "Voraussetzungen", massnahmen: "Maßnahmen", begriffe: "Begriffe" },
  en: { voraussetzungen: "Conditions", massnahmen: "Measures", begriffe: "Terms" },
  nl: { voraussetzungen: "Voorwaarden", massnahmen: "Maatregelen", begriffe: "Begrippen" },
};

function schonEnthalten(text: string, eintrag: string): boolean {
  return text.toLocaleLowerCase().includes(eintrag.trim().toLocaleLowerCase());
}

function kommtVor(text: string, benennung: string): boolean {
  const kern = benennung
    .trim()
    .split(/\s+/)
    .map((teil) => teil.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  if (!kern) {
    return false;
  }
  return new RegExp(`(?<![\\p{L}\\p{N}_])${kern}(?![\\p{L}\\p{N}_])`, "iu").test(text);
}

/**
 * Schneidet die gegebene Antwort zu. REINE RECHNUNG: die tragenden Quellen und die
 * Wörterbuchbegriffe kommen fertig herein.
 */
export function schneideAntwortZu(
  antwort: string,
  tragende: readonly KnowledgeObject[],
  zuschnitt: ZuschnittDerAntwort,
  begriffe: readonly ZuschnittBegriff[],
  locale: "de" | "en" | "nl",
): ZugeschnitteneAntwort {
  const ergaenzungen: ZuschnittErgaenzung[] = [];
  if (zuschnitt.tiefe === "ausfuehrlich") {
    const rang = (art: KnowledgeType): number => {
      const i = zuschnitt.reihenfolge.indexOf(art);
      return i < 0 ? zuschnitt.reihenfolge.length : i;
    };
    const geordnet = tragende
      .map((ko, i) => ({ ko, i }))
      .sort((a, b) => rang(a.ko.type) - rang(b.ko.type) || a.i - b.i)
      .map((e) => e.ko);
    for (const ko of geordnet) {
      const voraussetzungen = (ko.conditions ?? [])
        .map((c) => c.trim())
        .filter((c) => c && !schonEnthalten(antwort, c));
      if (voraussetzungen.length > 0) {
        ergaenzungen.push({ art: "voraussetzungen", quelleId: ko.id, eintraege: voraussetzungen });
      }
      const massnahmen = (ko.measures ?? [])
        .map((m) => m.trim())
        .filter((m) => m && !schonEnthalten(antwort, m));
      if (massnahmen.length > 0) {
        ergaenzungen.push({ art: "massnahmen", quelleId: ko.id, eintraege: massnahmen });
      }
    }
  }
  if (zuschnitt.fachsprache === "allgemein") {
    const erklaert = new Set<string>();
    const eintraege: string[] = [];
    for (const b of begriffe) {
      const schluessel = b.benennung.trim().toLocaleLowerCase();
      if (!b.definition.trim() || erklaert.has(schluessel) || !kommtVor(antwort, b.benennung)) {
        continue;
      }
      erklaert.add(schluessel);
      eintraege.push(`${b.benennung.trim()}: ${b.definition.trim()}`);
    }
    if (eintraege.length > 0) {
      ergaenzungen.push({ art: "begriffe", quelleId: null, eintraege });
    }
  }
  if (ergaenzungen.length === 0) {
    return { text: antwort, ergaenzungen };
  }
  const titel = new Map(tragende.map((ko): [string, string] => [ko.id, ko.title]));
  const abschnitte = ergaenzungen.map((e) => {
    const name = BESCHRIFTUNG[locale][e.art];
    const kopf = e.quelleId ? `${name} (${titel.get(e.quelleId) ?? e.quelleId}):` : `${name}:`;
    return `${kopf}\n${e.eintraege.map((x) => `- ${x}`).join("\n")}`;
  });
  return { text: `${antwort.trimEnd()}\n\n${abschnitte.join("\n\n")}`, ergaenzungen };
}
