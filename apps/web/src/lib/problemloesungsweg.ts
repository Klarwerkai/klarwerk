// ================================================================================================
// R-1662 · GEFÜHRTER WEG VOM PROBLEM ZUR LÖSUNG — DIE EINE ABLEITUNG, DOM-FREI.
// ================================================================================================
//
// Das Addendum (Problem Resolution Flow) verlangt zu einer Antwort vier Teile: gefundene
// Lösungsansätze, bekannte Fehler („Was vermeiden?"), mögliche Experten und nächste Schritte — und
// die Rahmung „die belastbarsten Hinweise", nie „definitiv die Lösung". Diese Datei bildet daraus
// ausschliesslich, was die Antwort SCHON trägt: ihre herangezogenen Quellen (in der Ordnung von
// `attributeSources`, tragende zuerst) und die Wissensobjekte des Bestands. Sie fragt nichts nach
// und erfindet nichts:
//   · „Was vermeiden" ist jede herangezogene Quelle vom Wissenstyp `negativwissen`.
//   · Ansprechpersonen sind Autor und (bei Übergabe) Originalautor der tragenden Quellen; gibt es
//     keine tragende, die der herangezogenen. Ohne Wissensobjekt im Bestand steht keine Person da.
//   · Die Rahmung hängt an der EINEN Einstufung (`AnswerGrade`): „validiert" sagt sie nur bei
//     `verified` — sonst wäre sie die Sicherheitsbehauptung, die mega33 beseitigt hat.
// Prüfer ähnlicher Objekte nennt sie NICHT: der Bestand liefert sie der Fläche nicht.
import type { KnowledgeObject } from "../api/types";
import type { AnswerGrade } from "./answerGrade";

export interface WegQuelle {
  id: string;
  label: string;
  carrying: boolean;
}

export interface WegPerson {
  /** Verzeichnis-Kennung — der Name wird an der Fläche über `useAuthorName` aufgelöst. */
  ref: string;
  /** Titel der Quellen, an denen diese Person eine Wissensspur hat. */
  quellen: string[];
}

export interface Problemloesungsweg {
  hinweisKey: string;
  /** Die Quelle, die als Erstes zu öffnen ist: die erste tragende, die kein Negativwissen ist. */
  oeffnen: WegQuelle | null;
  vermeiden: WegQuelle[];
  personen: WegPerson[];
}

export const LOESUNGSWEG_HINWEIS_KEY: Record<Exclude<AnswerGrade, "gap">, string> = {
  verified: "loesungsweg.hinweis.geprueft",
  unverified: "loesungsweg.hinweis.ungeprueft",
};

export function problemloesungsweg(
  grade: AnswerGrade,
  quellen: readonly WegQuelle[],
  kosById: ReadonlyMap<string, Pick<KnowledgeObject, "type" | "author" | "originalAuthor">>,
): Problemloesungsweg | null {
  if (grade === "gap" || quellen.length === 0) {
    return null;
  }
  const istNegativ = (q: WegQuelle): boolean => kosById.get(q.id)?.type === "negativwissen";
  const vermeiden = quellen.filter(istNegativ);
  const ansaetze = quellen.filter((q) => !istNegativ(q));
  const oeffnen = ansaetze.find((q) => q.carrying) ?? ansaetze[0] ?? null;

  const tragend = quellen.filter((q) => q.carrying);
  const spurQuellen = tragend.length > 0 ? tragend : quellen;
  const personen = new Map<string, WegPerson>();
  for (const q of spurQuellen) {
    const ko = kosById.get(q.id);
    if (!ko) {
      continue;
    }
    for (const ref of [ko.author, ko.originalAuthor]) {
      const kennung = ref?.trim();
      if (!kennung) {
        continue;
      }
      const person = personen.get(kennung) ?? { ref: kennung, quellen: [] };
      if (!person.quellen.includes(q.label)) {
        person.quellen.push(q.label);
      }
      personen.set(kennung, person);
    }
  }

  return {
    hinweisKey: LOESUNGSWEG_HINWEIS_KEY[grade],
    oeffnen,
    vermeiden,
    personen: [...personen.values()],
  };
}
