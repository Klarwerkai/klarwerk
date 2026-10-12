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
//
// Ben, Nacharbeit 2 — Prüfpunkte 5 und 6 des Addendums („Gibt es offene oder gelöste Konflikte?",
// „Gibt es alte Revalidierungsfälle?") werden jetzt wirklich geprüft, nicht nur benannt:
//   · `geloesteKonflikte`: die von einem Menschen gelösten Konflikte, an denen eine Quelle der
//     Antwort beteiligt ist (`GET /api/conflicts/geloest`, dort Paar-Tor und Feldredaktion).
//     Offene Konflikte stehen weiter im Warnblock der Antwort (`conflict.impact`).
//   · `revalidierungsfaelle`: die Quellen der Antwort, die in der Revalidierungsliste stehen
//     (`GET /api/lifecycle/pending`) — ein offener Fall heisst, die Gültigkeit ist neu zu prüfen.
// Beide sagen „nicht abrufbar", wenn der Abruf scheitert, und nie „keine": ein Netzfehler ist
// keine Auskunft über den Bestand (dieselbe Regel wie `conflictKnowledge`).
//
// Ben, Nacharbeit 5 — „alte" Revalidierungsfälle sind auch die schon BESTÄTIGTEN: Nach „stimmt
// noch" ist der offene Merker gelöscht, der Beleg `ko.revalidated` bleibt im Prüfprotokoll.
// `fruehereRevalidierungen` liest ihn über `GET /api/lifecycle/revalidiert` (Kennung, Zeitpunkt,
// Fassung) und hält ihn getrennt von den offenen Fällen.
import type { Conflict, KnowledgeObject, RevalidierungBestaetigt } from "../api/types";
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

/** Der Stand eines Abrufs, wie die Fläche ihn kennt — „fehler" ist keine leere Liste. */
export type WegAbruf<T> = { stand: "laedt" } | { stand: "fehler" } | { stand: "da"; daten: T };

/** Der Abrufstand aus einer react-query-Abfrage: Fehler vor Daten, keine Daten heisst „lädt". */
export function wegAbrufAus<T>(abfrage: { data: T | undefined; isError: boolean }): WegAbruf<T> {
  if (abfrage.isError) {
    return { stand: "fehler" };
  }
  return abfrage.data === undefined ? { stand: "laedt" } : { stand: "da", daten: abfrage.data };
}

/** Ein Ergebnis der Prüfung: noch offen, nicht abrufbar, oder die gefundenen Einträge. */
export type WegBefund<T> =
  | { stand: "laedt" }
  | { stand: "fehler" }
  | { stand: "da"; eintraege: T[] };

export interface GeloesterKonfliktHinweis {
  id: string;
  /** Die Quelle der Antwort, an der der Konflikt hing. */
  quelle: WegQuelle;
  /** Die Gegenseite: Titel aus dem Bestand, sonst ihre Kennung (nie erfunden). */
  gegen: { id: string; label: string };
  /** „fehlalarm" = als kein Widerspruch geschlossen; sonst von einem Menschen entschieden. */
  ausgang: "entschieden" | "fehlalarm";
  /** Der Entscheidungstext — `null`, wenn keiner vorliegt oder der Server ihn zurückhält. */
  entscheidung: string | null;
  zurueckgehalten: boolean;
}

export function geloesteKonflikte(
  quellen: readonly WegQuelle[],
  kosById: ReadonlyMap<string, Pick<KnowledgeObject, "title">>,
  abruf: WegAbruf<readonly Conflict[]>,
): WegBefund<GeloesterKonfliktHinweis> {
  if (abruf.stand !== "da") {
    return abruf;
  }
  // Ein Abruf, der keine Liste ist (Anmeldeumleitung, Zwischenspeicher), ist keine Auskunft.
  if (!Array.isArray(abruf.daten)) {
    return { stand: "fehler" };
  }
  const jeId = new Map(quellen.map((q) => [q.id, q]));
  const eintraege: GeloesterKonfliktHinweis[] = [];
  const gesehen = new Set<string>();
  for (const q of quellen) {
    for (const k of abruf.daten) {
      if (k.status !== "geloest" || gesehen.has(k.id) || (k.koA !== q.id && k.koB !== q.id)) {
        continue;
      }
      gesehen.add(k.id);
      const gegenId = k.koA === q.id ? k.koB : k.koA;
      const gegenLabel = jeId.get(gegenId)?.label ?? kosById.get(gegenId)?.title ?? gegenId;
      const text = k.decision?.trim() ?? "";
      eintraege.push({
        id: k.id,
        quelle: q,
        gegen: { id: gegenId, label: gegenLabel },
        ausgang: k.resolutionReason === "dismissed" ? "fehlalarm" : "entschieden",
        entscheidung: k.redacted || text.length === 0 ? null : text,
        zurueckgehalten: k.redacted === true,
      });
    }
  }
  return { stand: "da", eintraege };
}

export function revalidierungsfaelle(
  quellen: readonly WegQuelle[],
  abruf: WegAbruf<readonly string[]>,
): WegBefund<WegQuelle> {
  if (abruf.stand !== "da") {
    return abruf;
  }
  if (!Array.isArray(abruf.daten)) {
    return { stand: "fehler" };
  }
  const faellig = new Set(abruf.daten);
  return { stand: "da", eintraege: quellen.filter((q) => faellig.has(q.id)) };
}

export interface FruehereRevalidierung {
  quelle: WegQuelle;
  /** Die jüngste Bestätigung „stimmt noch" (ISO-Zeitpunkt) und ihre Fassung, soweit belegt. */
  zuletztAm: string;
  version: number | null;
  /** Wie oft diese Quelle schon bestätigt wurde. */
  anzahl: number;
}

/** Frühere, schon BESTÄTIGTE Revalidierungen je Quelle — in der Reihenfolge der Quellen. */
export function fruehereRevalidierungen(
  quellen: readonly WegQuelle[],
  abruf: WegAbruf<readonly RevalidierungBestaetigt[]>,
): WegBefund<FruehereRevalidierung> {
  if (abruf.stand !== "da") {
    return abruf;
  }
  if (!Array.isArray(abruf.daten)) {
    return { stand: "fehler" };
  }
  const eintraege: FruehereRevalidierung[] = [];
  for (const q of quellen) {
    const belege = abruf.daten.filter((b) => b.koId === q.id);
    const juengster = belege.reduce<RevalidierungBestaetigt | null>(
      (best, b) => (best === null || b.am > best.am ? b : best),
      null,
    );
    if (juengster) {
      eintraege.push({
        quelle: q,
        zuletztAm: juengster.am,
        version: juengster.version,
        anzahl: belege.length,
      });
    }
  }
  return { stand: "da", eintraege };
}
