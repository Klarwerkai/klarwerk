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
//     Definition), je Zeile mit Eintrag, Fassung, Geltungsbereich und Verantwortung, und unter
//     einem Kopf, der sie von der Quellenbilanz abgrenzt. `fach` ergänzt keine Erklärungen.
//
// WAS AUSDRÜCKLICH NICHT GESCHIEHT:
//   · Der wörtliche Antwortweg (Word ohne Einwilligung, Add-on-Schlüssel, `retrievalOnly`) bleibt
//     Zeichen für Zeichen die validierte Aussage — der Aufrufer wendet diese Funktion dort nicht an.
//   · Kein Modellaufruf, kein Egress: alles kommt aus Objekten, die der Aufrufer bereits sehen darf.
//   · Was schon in der Antwort steht, wird nicht noch einmal angehängt.
import type { KnowledgeObject, KnowledgeType } from "../../knowledge-object";

// Ben nacharbeit-11: eine Begriffserklärung ist eine fachliche Aussage mit EIGENER Herkunft — dem
// Wörterbucheintrag, nicht den Wissensobjekten der Antwort. Sie reist deshalb mit Identität,
// Fassung, Geltungsbereich, Verantwortung und Stand des Eintrags, steht so an der Erklärung und
// wird in der Belastbarkeit getrennt von der Quellenbilanz geführt (ohne Vertrauenswert).
export interface BegriffHerkunft {
  eintragId: string;
  fassung: number;
  geltungsbereich: string | null;
  verantwortlich: string | null;
  geaendertAm: string | null;
}

export interface ZuschnittBegriff {
  benennung: string;
  definition: string;
  herkunft: BegriffHerkunft;
}

export interface ZuschnittDerAntwort {
  tiefe: "kurz" | "ausfuehrlich";
  fachsprache: "allgemein" | "fach";
  reihenfolge: readonly KnowledgeType[];
}

/** Was der Zuschnitt an der Antwort tatsächlich ergänzt hat — sichtbar und prüfbar. */
export type ZuschnittErgaenzung =
  | {
      art: "voraussetzungen" | "massnahmen";
      /** Die tragende Quelle, aus der die Einträge wörtlich stammen. */
      quelleId: string;
      eintraege: string[];
    }
  | {
      art: "begriffe";
      /** Keine Wissensobjekt-Quelle: die Herkunft steht je Eintrag in `herkunft`. */
      quelleId: null;
      eintraege: string[];
      /** Je Eintrag (gleiche Stelle wie in `eintraege`) die erklärte Benennung … */
      benennungen: string[];
      /** … und der Wörterbucheintrag, aus dem die Erklärung stammt. */
      herkunft: BegriffHerkunft[];
    };

export interface ZugeschnitteneAntwort {
  /** Die ausgelieferte Antwort samt aller Ergänzungen. */
  text: string;
  /**
   * Ben nacharbeit-13: derselbe Text OHNE die Wörterbucherklärungen — nur, was die tragenden
   * Quellen belegen. Er ist die inhaltliche Schlussfolgerung der Argumentationskette; die
   * Wörterbuchergänzung steht allein im abgegrenzten Abschnitt der Belastbarkeit.
   */
  quellengebunden: string;
  ergaenzungen: ZuschnittErgaenzung[];
}

const BESCHRIFTUNG: Record<"de" | "en" | "nl", Record<ZuschnittErgaenzung["art"], string>> = {
  de: { voraussetzungen: "Voraussetzungen", massnahmen: "Maßnahmen", begriffe: "Begriffe" },
  en: { voraussetzungen: "Conditions", massnahmen: "Measures", begriffe: "Terms" },
  nl: { voraussetzungen: "Voorwaarden", massnahmen: "Maatregelen", begriffe: "Begrippen" },
};

// Die Herkunftsangabe der Begriffserklärungen im Antworttext — die Abgrenzung von der Quellenbilanz
// steht im Kopf, Eintrag, Fassung und Verantwortung an jeder Zeile.
interface WoerterbuchBeschriftung {
  kopf: string;
  eintrag: string;
  fassung: string;
  verantwortlich: string;
}

const WOERTERBUCH: Record<"de" | "en" | "nl", WoerterbuchBeschriftung> = {
  de: {
    kopf: "aus dem Firmenwörterbuch, nicht Teil der Quellenbilanz",
    eintrag: "Wörterbucheintrag",
    fassung: "Fassung",
    verantwortlich: "verantwortlich",
  },
  en: {
    kopf: "from the company glossary, not part of the source count",
    eintrag: "glossary entry",
    fassung: "version",
    verantwortlich: "responsible",
  },
  nl: {
    kopf: "uit het bedrijfswoordenboek, geen deel van de bronnentelling",
    eintrag: "woordenboekitem",
    fassung: "versie",
    verantwortlich: "verantwoordelijk",
  },
};

function herkunftsZusatz(h: BegriffHerkunft, locale: "de" | "en" | "nl"): string {
  const w = WOERTERBUCH[locale];
  const teile = [`${w.eintrag} ${h.eintragId}`, `${w.fassung} ${h.fassung}`];
  if (h.geltungsbereich) {
    teile.push(h.geltungsbereich);
  }
  if (h.verantwortlich) {
    teile.push(`${w.verantwortlich}: ${h.verantwortlich}`);
  }
  return `[${teile.join(", ")}]`;
}

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
    const benennungen: string[] = [];
    const herkunft: BegriffHerkunft[] = [];
    for (const b of begriffe) {
      const schluessel = b.benennung.trim().toLocaleLowerCase();
      if (!b.definition.trim() || erklaert.has(schluessel) || !kommtVor(antwort, b.benennung)) {
        continue;
      }
      erklaert.add(schluessel);
      eintraege.push(`${b.benennung.trim()}: ${b.definition.trim()}`);
      benennungen.push(b.benennung.trim());
      herkunft.push({ ...b.herkunft });
    }
    if (eintraege.length > 0) {
      ergaenzungen.push({ art: "begriffe", quelleId: null, eintraege, benennungen, herkunft });
    }
  }
  if (ergaenzungen.length === 0) {
    return { text: antwort, quellengebunden: antwort, ergaenzungen };
  }
  const titel = new Map(tragende.map((ko): [string, string] => [ko.id, ko.title]));
  const abschnitt = (e: ZuschnittErgaenzung): string => {
    const name = BESCHRIFTUNG[locale][e.art];
    if (e.art === "begriffe") {
      const zeilen = e.eintraege.map((x, i) => {
        const h = e.herkunft[i];
        return h ? `- ${x} ${herkunftsZusatz(h, locale)}` : `- ${x}`;
      });
      return `${name} (${WOERTERBUCH[locale].kopf}):\n${zeilen.join("\n")}`;
    }
    const kopf = `${name} (${titel.get(e.quelleId) ?? e.quelleId}):`;
    return `${kopf}\n${e.eintraege.map((x) => `- ${x}`).join("\n")}`;
  };
  const mitAbschnitten = (liste: readonly ZuschnittErgaenzung[]): string => {
    if (liste.length === 0) {
      return antwort;
    }
    return `${antwort.trimEnd()}\n\n${liste.map(abschnitt).join("\n\n")}`;
  };
  return {
    text: mitAbschnitten(ergaenzungen),
    quellengebunden: mitAbschnitten(ergaenzungen.filter((e) => e.art !== "begriffe")),
    ergaenzungen,
  };
}
