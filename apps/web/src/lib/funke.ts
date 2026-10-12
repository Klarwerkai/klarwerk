// FUNKE (nacht24 Paket 6, SCRUM-477/529): pure Ableitungen der Wirkungs-Schleife — DOM-frei,
// ohne Netz, nur aus bereits geladenen, berechtigten Daten. DSGVO-nüchtern: keine Ranglisten,
// keine Bloßstellung — nur anonyme Bestandssummen bzw. Zahlen über eigene Beiträge.
import type { Gap, KnowledgeObject } from "../api/types";

// R-1349 (Aufnahme gesamt-aufruferwaechter): Hier stand F3 `openGapsView` (offene Lücken nach
// Priorität gebündelt, samt Typen und Hilfen). Die Liste mit Freitexten ist bewusst durch eine
// Zahl ersetzt (`components/FunkeCards.tsx`, `OpenGapsSummary`); Prioritäten pflegt die
// Risikofläche (R-0991 Nr. 28). Der Baustein rief niemand und ist entfernt.

// F5: Wissenskapital — NUR echte Zahlen aus dem Bestand (keine Fantasie-Metriken):
// gesicherte Wissensobjekte · davon validiert · beantwortbare Themenfelder (Kategorien mit
// mindestens einem validierten KO) · aktive Wissensträger (verschiedene Autoren) · offene Lücken.
export interface KnowledgeCapital {
  secured: number;
  validated: number;
  // AUFTRAG-mega38 BLOCK G2: „Offen" war die EINZIGE Zahl, die der gestrichene Kennzahlen-Block
  // exklusiv trug. Sie gehört neben „davon validiert" — dort erklärt sie sich selbst.
  open: number;
  answerableCategories: number;
  activeAuthors: number;
  openGaps: number;
}

export function knowledgeCapital(
  kos: readonly Pick<KnowledgeObject, "status" | "category" | "author">[],
  gaps: readonly Pick<Gap, "status">[],
): KnowledgeCapital {
  const validatedCategories = new Set<string>();
  const authors = new Set<string>();
  let validated = 0;
  let open = 0;
  for (const ko of kos) {
    if (ko.author) {
      authors.add(ko.author);
    }
    if (ko.status === "offen") {
      open += 1;
    }
    if (ko.status === "validiert") {
      validated += 1;
      if (ko.category) {
        validatedCategories.add(ko.category);
      }
    }
  }
  return {
    secured: kos.length,
    validated,
    open,
    answerableCategories: validatedCategories.size,
    activeAuthors: authors.size,
    openGaps: gaps.filter((gap) => gap.status === "offen").length,
  };
}
