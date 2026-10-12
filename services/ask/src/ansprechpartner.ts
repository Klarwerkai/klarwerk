// ================================================================================================
// R-1663 / R-2178 (aufnahme:20260922:gesamt-expertensuche) — PASSENDE ANSPRECHPARTNER NACH
// VORHANDENEN WISSENSSPUREN, MIT BEGRÜNDUNG.
// ================================================================================================
//
// Der Wortlaut der Quelle (Knowledge-OS-Addendum, „B. Expert Routing"): nicht als soziale Bewertung,
// sondern als evidenzbasierte Wissensspur — „Person A: Originalautor von 5 ähnlichen Wissensobjekten",
// „Person B: hat 3 relevante Objekte validiert", „Person C: zuletzt an ähnlicher Wissenslücke
// gearbeitet". Klarwerk darf NICHT sagen „Das ist der beste Experte", sondern nur „Passende
// Ansprechpartner nach vorhandenen Wissensspuren".
//
// DARAUS DIE DREI BAUREGELN DIESER DATEI:
//   1. JEDER VORSCHLAG TRÄGT SEINE SPUREN. Eine Person erscheint nur, weil mindestens eine Spur auf
//      sie zeigt, und die Antwort nennt jede Spur mit ihrer Zahl und den Objekten dahinter. Ein
//      Vorschlag ohne Begründung kann hier nicht entstehen.
//   2. KEINE RANGLISTE. Kein Punktwert, keine Gewichtung, keine Sortierung nach Spurenmenge. Die
//      Reihenfolge ist alphabetisch nach Kennung — dieselbe Produktentscheidung wie im
//      Consultant-System (`LibraryService.expertise`, library-analytics), damit dieselbe Sache nicht
//      zwei Auffassungen bekommt.
//   3. KEIN ZUGRIFF HIER. Diese Funktion liest nichts und schreibt nichts: Sie bekommt die bereits
//      sichtbarkeitsgefilterte Objektmenge und die geschlossenen Lücken vom Aufrufer und leitet nur
//      ab. Sichtbarkeit, Vertraulichkeit und Schalter entscheidet der Aufrufer
//      (`AskService.ansprechpartnerZuLuecke`, Route `GET /api/gaps/:id/ansprechpartner`).
//
// WAS AUSDRÜCKLICH NICHT GESCHIEHT: keine Zuweisung, keine Aufgabe, keine Benachrichtigung. Die
// Quelle sagt, Expert Routing erzeuge „später idealerweise eine Aufgabe oder Anfrage, aber nur über
// geregelte Task-/Review-Mechanik" — das bleibt die bestehende, menschlich ausgelöste Zuweisung
// (`assignGap`).

import type { KnowledgeObject } from "../../knowledge-object";

/** Höchstens so viele Belegobjekte je Person stehen in der Antwort (die Zählung bleibt vollständig). */
export const ANSPRECHPARTNER_OBJEKTE_JE_PERSON = 3;

/**
 * Die Spurenarten. Jede ist eine am Objekt oder an der Lücke GESPEICHERTE Tatsache, keine Schätzung:
 *   · `originalautor`    — `KnowledgeObject.originalAuthor` (wer das Wissen einbrachte)
 *   · `erfasst`          — `KnowledgeObject.author`, wenn er vom Originalautor abweicht
 *   · `validiert`        — `ownership.validators` (wer eine abgeschlossene Validierung trug)
 *   · `pruefung`         — `ownership.reviewers` (wer zur Prüfung zugewiesen wurde)
 *   · `verantwortlich`   — `ownership.owner` (benannte Verantwortung; kein Rückfall auf den Autor)
 *   · `aehnlicheLuecken` — geschlossene Wissenslücken mit ähnlicher Frage, die dieser Person
 *                          zugewiesen waren
 */
export interface AnsprechpartnerSpuren {
  originalautor: number;
  erfasst: number;
  validiert: number;
  pruefung: number;
  verantwortlich: number;
  aehnlicheLuecken: number;
}

export interface AnsprechpartnerVorschlag {
  personId: string;
  spuren: AnsprechpartnerSpuren;
  /** Die passenden Objekte, auf denen die Objektspuren dieser Person liegen (gekürzt, s. o.). */
  objekte: { id: string; title: string }[];
}

export interface AnsprechpartnerAuskunft {
  vorschlaege: AnsprechpartnerVorschlag[];
  /**
   * Worauf die Vorschläge beruhen — damit eine leere Liste lesbar bleibt: `objekte: 0` heisst „zu
   * dieser Frage lag kein sichtbares passendes Objekt vor", nicht „niemand weiss etwas".
   */
  grundlage: { objekte: number; aehnlicheLuecken: number };
}

export interface GeschlosseneLueckeSpur {
  assignee: string;
  terme: readonly string[];
}

/**
 * Ist eine geschlossene Lücke der offenen ähnlich? Mindestens die Hälfte der Inhaltstoken der
 * kürzeren Frage muss in der anderen vorkommen (und mindestens eines). Bewusst schlicht und
 * deterministisch — dieselben Token (`queryTokens`), auf denen auch die Vorauswahl rechnet.
 */
export function aehnlicheFrage(a: readonly string[], b: readonly string[]): boolean {
  const menge = new Set(a);
  const andere = new Set(b);
  const kuerzer = Math.min(menge.size, andere.size);
  if (kuerzer === 0) {
    return false;
  }
  let gemeinsam = 0;
  for (const term of menge) {
    if (andere.has(term)) {
      gemeinsam += 1;
    }
  }
  return gemeinsam >= Math.max(1, Math.ceil(kuerzer / 2));
}

/** Eine Kennung, die eine Person ist: nicht leer und nicht der Systemkontext. */
function istPerson(id: string | null | undefined): id is string {
  return typeof id === "string" && id.trim().length > 0 && id !== "system";
}

interface PersonSpur {
  spuren: AnsprechpartnerSpuren;
  /** Objektkennung → Titel, in der Reihenfolge der Vorauswahl. */
  objekte: Map<string, string>;
}

function leereSpuren(): AnsprechpartnerSpuren {
  return {
    originalautor: 0,
    erfasst: 0,
    validiert: 0,
    pruefung: 0,
    verantwortlich: 0,
    aehnlicheLuecken: 0,
  };
}

export function leiteAnsprechpartnerAb(eingabe: {
  frageterme: readonly string[];
  objekte: readonly KnowledgeObject[];
  geschlosseneLuecken: readonly GeschlosseneLueckeSpur[];
}): AnsprechpartnerAuskunft {
  const personen = new Map<string, PersonSpur>();
  const eintrag = (id: string): PersonSpur => {
    const vorhanden = personen.get(id);
    if (vorhanden) {
      return vorhanden;
    }
    const neu: PersonSpur = { spuren: leereSpuren(), objekte: new Map<string, string>() };
    personen.set(id, neu);
    return neu;
  };
  const spur = (
    id: string | null | undefined,
    art: Exclude<keyof AnsprechpartnerSpuren, "aehnlicheLuecken">,
    ko: KnowledgeObject,
  ): void => {
    if (!istPerson(id)) {
      return;
    }
    const person = eintrag(id);
    person.spuren[art] += 1;
    person.objekte.set(ko.id, ko.title);
  };

  for (const ko of eingabe.objekte) {
    spur(ko.originalAuthor, "originalautor", ko);
    if (ko.author !== ko.originalAuthor) {
      spur(ko.author, "erfasst", ko);
    }
    // Je Objekt zählt eine Person je Spurenart höchstens einmal, auch wenn die Liste sie doppelt
    // führte — die Zahl heisst „an so vielen Objekten", nicht „so viele Einträge".
    for (const validator of new Set(ko.ownership?.validators ?? [])) {
      spur(validator, "validiert", ko);
    }
    for (const pruefer of new Set(ko.ownership?.reviewers ?? [])) {
      spur(pruefer, "pruefung", ko);
    }
    spur(ko.ownership?.owner, "verantwortlich", ko);
  }

  let aehnlicheLuecken = 0;
  for (const luecke of eingabe.geschlosseneLuecken) {
    if (!istPerson(luecke.assignee) || !aehnlicheFrage(eingabe.frageterme, luecke.terme)) {
      continue;
    }
    aehnlicheLuecken += 1;
    eintrag(luecke.assignee).spuren.aehnlicheLuecken += 1;
  }

  const vorschlaege = [...personen.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([personId, person]) => ({
      personId,
      spuren: person.spuren,
      objekte: [...person.objekte.entries()]
        .slice(0, ANSPRECHPARTNER_OBJEKTE_JE_PERSON)
        .map(([id, title]) => ({ id, title })),
    }));
  return { vorschlaege, grundlage: { objekte: eingabe.objekte.length, aehnlicheLuecken } };
}
