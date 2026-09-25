// ================================================================================================
// AUFNAHME 20260922 · PRÜFBASIS-AKTUALITÄT — DER PRÜFNACHWEIS IST AN SEINE BASIS GEBUNDEN.
// ================================================================================================
//
// ENTSCHEIDUNG (ausführlich in docs/entscheidungen/pruefbasis-aktualitaet.md): GLOBALE
// BASISBINDUNG je Nachweis, KEINE selektive Wiederverwendung.
//
// Ein KI-Prüfnachweis (`aiCheck`) gilt nur für GENAU die Basis, unter der sein Lauf gestartet ist.
// Die Basis hat drei Teile:
//   quelle  — die Inhaltsfassung (`version`; Titel, Kernaussage, Bedingungen, Maßnahmen und Fließtext
//             ändern sich nur mit ihr) sowie die gebundenen Quellen und Anhänge (Kennungen). Quellen
//             und Anhänge können OHNE Versionssprung hinzukommen oder wegfallen.
//   kontext — die Einordnung (Kategorie, Schlagworte, Anlage) und die Vertraulichkeit des Objekts.
//             Sie steuern Kandidatenwahl und Modellweg und ändern sich ohne Versionssprung.
//   bestand — die VERGLEICHSQUELLEN samt AUSWAHLKONTEXT: Quelle und Kontext JEDES Objekts, gegen
//             das die Erkennung ihre Kandidaten wählt (aktiver Bestand ohne Vorführdaten, derselbe
//             Pool wie in detectConflictsForKo/detectDuplicatesForKo). Welche davon ein Lauf
//             tatsächlich verglichen hat, hält kein Protokoll fest — deshalb der ganze Pool.
//
// JEDE Änderung irgendeines Teils macht den ganzen Nachweis überholt. Eine selektive Wiederverwendung
// („nur ein nicht verglichenes Objekt hat sich geändert, das Urteil gilt weiter") verlangte einen
// QUALIFIZIERTEN Nachweis, von welchen Eingaben das Urteil abhing. Den gibt es nicht: die Erkennung
// wählt ihre Kandidaten gedeckelt aus dem Pool, die Wahl hängt vom ganzen Pool ab, und das
// Abdeckungsprotokoll hält nur Zahlen fest.
//
// „Gleicher Text" genügt nie: die Fassungsnummer ist Teil der Quelle (auch der Vergleichsquellen).
//
// NICHT Teil der Basis sind Ablauf- und Ergebnisfelder (Prüfstatus, Vertrauenswert, Zuweisungen,
// Kommentare, Eigentum, der Nachweis selbst, abgeleitete Suchfelder) — an keinem Objekt. Sie sind
// FOLGEN der Prüfung oder der Bewertung. Wären sie Basis, entwertete eine Prüfung, die einen
// Konflikt anlegt und damit den Prüfstatus eines Objekts ändert, sich selbst.
//
// UNBELEGT IST ÜBERHOLT: ein abgeschlossener Nachweis ohne vollständige gespeicherte Basis
// (Altbestand) belegt keinen Stand und wird deshalb als überholt gelesen — Abruf und Wiederholung
// erneuern ihn.
import { createHash } from "node:crypto";
import type { AiCheck, AiCheckBasis, KnowledgeObject } from "./types";

type BasisQuelle = Pick<
  KnowledgeObject,
  "version" | "sources" | "attachments" | "category" | "tags" | "asset" | "confidentiality"
>;

type BestandsEintrag = BasisQuelle & Pick<KnowledgeObject, "id" | "demoSeed" | "deletedAt">;

function fingerabdruck(teile: readonly unknown[]): string {
  return createHash("sha256").update(JSON.stringify(teile)).digest("hex").slice(0, 32);
}

function kennungen(liste: readonly { id: string }[] | undefined): string[] {
  return (liste ?? []).map((eintrag) => eintrag.id).sort();
}

function quelleVon(ko: BasisQuelle): string {
  return fingerabdruck(["quelle", ko.version, kennungen(ko.sources), kennungen(ko.attachments)]);
}

function kontextVon(ko: BasisQuelle): string {
  return fingerabdruck([
    "kontext",
    ko.category ?? "",
    [...(ko.tags ?? [])].sort(),
    ko.asset ?? null,
    // Altbestand ohne Feld gilt als „intern" (s. Confidentiality) — dieselbe Lesart hier.
    ko.confidentiality ?? "intern",
  ]);
}

/**
 * Der Fingerabdruck des Vergleichsbestands: Quelle und Kontext jedes aktiven Nicht-Demo-Objekts,
 * nach Kennung geordnet. Rein, deterministisch; Ablauffelder gehen nicht ein.
 */
export function bestandsStempelVon(bestand: readonly BestandsEintrag[]): string {
  const eintraege = bestand
    .filter((ko) => !ko.deletedAt && !ko.demoSeed)
    .map((ko) => [ko.id, quelleVon(ko), kontextVon(ko)] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return fingerabdruck(["bestand", eintraege]);
}

/** Die Prüfbasis eines Objekts in seinem JETZIGEN Stand gegen den JETZIGEN Bestandsstempel. */
export function pruefbasisVon(ko: BasisQuelle, bestand: string): AiCheckBasis {
  return { quelle: quelleVon(ko), kontext: kontextVon(ko), bestand };
}

export function gleichePruefbasis(a: AiCheckBasis, b: AiCheckBasis): boolean {
  return a.quelle === b.quelle && a.kontext === b.kontext && a.bestand === b.bestand;
}

/** Braucht die Lesefassung dieses Objekts den Bestandsstempel? (nur abgeschlossene Nachweise) */
export function brauchtPruefstand(ko: { aiCheck?: AiCheck | undefined }): boolean {
  return ko.aiCheck !== undefined && ko.aiCheck.status !== "pending";
}

/**
 * Ist dieser abgeschlossene Nachweis gegenüber dem jetzigen Objekt und Bestand überholt?
 *
 * Nur ein ABGESCHLOSSENER Nachweis (done/failed) kann überholt sein — ein wartender Lauf gilt ohnehin
 * nicht als aktuell, und der Lauf selbst bindet sich beim Start an die dann gültige Basis. Ohne
 * vollständige gespeicherte Basis ist nichts belegt: überholt.
 */
export function aiCheckUeberholt(
  ko: BasisQuelle & { aiCheck?: AiCheck | undefined },
  bestand: string,
): boolean {
  const check = ko.aiCheck;
  if (!check || check.status === "pending") {
    return false;
  }
  if (!check.basis?.quelle || !check.basis.kontext || !check.basis.bestand) {
    return true;
  }
  return !gleichePruefbasis(check.basis, pruefbasisVon(ko, bestand));
}

/**
 * Die Lesefassung eines Objekts: `aiCheck.ueberholt` wird bei JEDEM Lesen aus der gespeicherten
 * Basisbindung neu abgeleitet — nie geglaubt, nie fortgeschrieben. Ein versehentlich mitgespeicherter
 * Merker wird hier also auch wieder entfernt.
 */
export function mitPruefstand<T extends BasisQuelle & { aiCheck?: AiCheck | undefined }>(
  ko: T,
  bestand: string,
): T {
  if (!ko.aiCheck) {
    return ko;
  }
  const { ueberholt: alt, ...gespeichert } = ko.aiCheck;
  const ueberholt = aiCheckUeberholt({ ...ko, aiCheck: gespeichert }, bestand);
  if (!ueberholt && alt === undefined) {
    return ko;
  }
  return { ...ko, aiCheck: ueberholt ? { ...gespeichert, ueberholt: true } : gespeichert };
}
