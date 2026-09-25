// ================================================================================================
// AUFNAHME 20260922 · PRÜFBASIS-AKTUALITÄT — DER PRÜFNACHWEIS IST AN SEINE BASIS GEBUNDEN.
// ================================================================================================
//
// ENTSCHEIDUNG (ausführlich in docs/entscheidungen/pruefbasis-aktualitaet.md): GLOBALE
// BASISBINDUNG je Nachweis, KEINE selektive Wiederverwendung.
//
// Ein KI-Prüfnachweis (`aiCheck`) gilt nur für GENAU die Basis, unter der sein Lauf gestartet ist.
// Die Basis ist das Objekt als Prüfgegenstand, in zwei Teilen:
//   quelle  — die Inhaltsfassung (`version`; Titel, Kernaussage, Bedingungen, Maßnahmen und Fließtext
//             ändern sich nur mit ihr) sowie die gebundenen Quellen und Anhänge (Kennungen). Quellen
//             und Anhänge können OHNE Versionssprung hinzukommen oder wegfallen.
//   kontext — die Einordnung (Kategorie, Schlagworte, Anlage) und die Vertraulichkeit. Sie steuern
//             Kandidatenwahl und Modellweg der Prüfung und ändern sich ebenfalls ohne Versionssprung.
//
// JEDE Änderung irgendeines Teils macht den ganzen Nachweis überholt — auch dann, wenn die Prüfung
// das geänderte Feld heute vielleicht gar nicht auswertet. Eine selektive Wiederverwendung („nur die
// Schlagworte haben sich geändert, das Urteil gilt weiter") verlangte einen QUALIFIZIERTEN Nachweis,
// von welchen Eingaben das Urteil tatsächlich abhing. Den gibt es nicht: die Erkennung wählt ihre
// Kandidaten gedeckelt aus dem Bestand, und das Abdeckungsprotokoll hält nur Zahlen fest.
//
// „Gleicher Text" genügt nie: die Fassungsnummer ist Teil der Quelle. Eine neue Fassung mit
// zeichengleichem Inhalt ist eine neue Basis.
//
// NICHT Teil der Basis sind Ablauf- und Ergebnisfelder (Prüfstatus, Vertrauenswert, Zuweisungen,
// Kommentare, Eigentum, der Nachweis selbst, abgeleitete Suchfelder). Sie sind FOLGEN der Prüfung
// oder der Bewertung. Wären sie Basis, entwertete eine Prüfung, die einen Konflikt anlegt und damit
// den Prüfstatus eines Objekts ändert, sich selbst — eine Schleife ohne Ende.
import { createHash } from "node:crypto";
import type { AiCheck, AiCheckBasis, KnowledgeObject } from "./types";

type BasisQuelle = Pick<
  KnowledgeObject,
  "version" | "sources" | "attachments" | "category" | "tags" | "asset" | "confidentiality"
>;

function fingerabdruck(teile: readonly unknown[]): string {
  return createHash("sha256").update(JSON.stringify(teile)).digest("hex").slice(0, 32);
}

function kennungen(liste: readonly { id: string }[] | undefined): string[] {
  return (liste ?? []).map((eintrag) => eintrag.id).sort();
}

/** Die Prüfbasis eines Objekts in seinem JETZIGEN Stand. Rein, deterministisch. */
export function pruefbasisVon(ko: BasisQuelle): AiCheckBasis {
  return {
    quelle: fingerabdruck(["quelle", ko.version, kennungen(ko.sources), kennungen(ko.attachments)]),
    kontext: fingerabdruck([
      "kontext",
      ko.category ?? "",
      [...(ko.tags ?? [])].sort(),
      ko.asset ?? null,
      // Altbestand ohne Feld gilt als „intern" (s. Confidentiality) — dieselbe Lesart hier.
      ko.confidentiality ?? "intern",
    ]),
  };
}

export function gleichePruefbasis(a: AiCheckBasis, b: AiCheckBasis): boolean {
  return a.quelle === b.quelle && a.kontext === b.kontext;
}

/**
 * Ist dieser abgeschlossene Nachweis gegenüber dem jetzigen Objekt überholt?
 *
 * Nur ein ABGESCHLOSSENER Nachweis (done/failed) kann überholt sein — ein wartender Lauf gilt ohnehin
 * nicht als aktuell, und der Lauf selbst bindet sich beim Start an die dann gültige Basis.
 *
 * Altbestand ohne gespeicherte Basis wird an der Fassung gemessen, die er trägt (`koVersion`, die
 * vorhandene Versionsbindung). Ohne beides lässt sich nichts belegen — dann wird auch nichts
 * behauptet (Bestandsverhalten; Folge in der Entscheidungsnotiz).
 */
export function aiCheckUeberholt(ko: BasisQuelle & { aiCheck?: AiCheck | undefined }): boolean {
  const check = ko.aiCheck;
  if (!check || check.status === "pending") {
    return false;
  }
  if (check.basis) {
    return !gleichePruefbasis(check.basis, pruefbasisVon(ko));
  }
  return check.koVersion !== undefined && check.koVersion !== ko.version;
}

/**
 * Die Lesefassung eines Objekts: `aiCheck.ueberholt` wird bei JEDEM Lesen aus der gespeicherten
 * Basisbindung neu abgeleitet — nie geglaubt, nie fortgeschrieben. Ein versehentlich mitgespeicherter
 * Merker wird hier also auch wieder entfernt.
 */
export function mitPruefstand<T extends BasisQuelle & { aiCheck?: AiCheck | undefined }>(ko: T): T {
  if (!ko.aiCheck) {
    return ko;
  }
  const { ueberholt: _alt, ...gespeichert } = ko.aiCheck;
  const ueberholt = aiCheckUeberholt({ ...ko, aiCheck: gespeichert });
  if (!ueberholt && _alt === undefined) {
    return ko;
  }
  return { ...ko, aiCheck: ueberholt ? { ...gespeichert, ueberholt: true } : gespeichert };
}
