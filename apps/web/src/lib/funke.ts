// FUNKE (nacht24 Paket 6, SCRUM-477/529): pure Ableitungen der Wirkungs-Schleife — DOM-frei,
// ohne Netz, nur aus bereits geladenen, berechtigten Daten. DSGVO-nüchtern: keine Ranglisten,
// keine Bloßstellung — nur anonyme Bestandssummen bzw. Zahlen über eigene Beiträge.
import type { Gap, GapPriority, KnowledgeObject } from "../api/types";

// F3: Offene Wissenslücken, gebündelt nach PRIORITÄT (hoch → mittel → niedrig). Ehrlich: Lücken
// tragen im Datenmodell KEINE Kategorie — die Bündelung „je Kategorie" ist ohne Erfindung nicht
// möglich; Priorität ist die vorhandene, echte Ordnung (im Bericht vermerkt). Innerhalb einer
// Priorität neueste zuerst; limit deckelt die GESAMTZAHL (Rest steht ehrlich in `hidden`).
export interface OpenGapsGroup {
  priority: GapPriority;
  items: Gap[];
}

export interface OpenGapsView {
  groups: OpenGapsGroup[];
  total: number;
  hidden: number;
}

const PRIORITY_ORDER: GapPriority[] = ["hoch", "mittel", "niedrig"];

function gapTime(gap: Gap): number {
  const parsed = Date.parse(gap.createdAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function openGapsView(gaps: readonly Gap[], limit = 6): OpenGapsView {
  const open = gaps.filter((gap) => gap.status === "offen");
  const groups: OpenGapsGroup[] = [];
  let used = 0;
  for (const priority of PRIORITY_ORDER) {
    if (used >= limit) {
      break;
    }
    const items = open
      .filter((gap) => gap.priority === priority)
      .sort((a, b) => gapTime(b) - gapTime(a))
      .slice(0, limit - used);
    if (items.length > 0) {
      groups.push({ priority, items });
      used += items.length;
    }
  }
  return { groups, total: open.length, hidden: Math.max(0, open.length - used) };
}

// F5: Wissenskapital — NUR echte Zahlen aus dem Bestand (keine Fantasie-Metriken):
// gesicherte Wissensobjekte · davon validiert · beantwortbare Themenfelder (Kategorien mit
// mindestens einem validierten KO) · aktive Wissensträger (verschiedene Autoren) · offene Lücken.
export interface KnowledgeCapital {
  secured: number;
  validated: number;
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
  for (const ko of kos) {
    if (ko.author) {
      authors.add(ko.author);
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
    answerableCategories: validatedCategories.size,
    activeAuthors: authors.size,
    openGaps: gaps.filter((gap) => gap.status === "offen").length,
  };
}
