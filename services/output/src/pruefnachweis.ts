// aufnahme:20260922:gesamt-dokumenterzeugung (R-0337) — DAS PRÜFDATUM JE QUELLE, EINE STELLE FÜR
// ALLE AUSGABEWEGE.
//
// Output Factory und Zuruf (KI-Entwurf) nennen dasselbe Prüfdatum derselben Quelle. Deshalb steht
// die Lesung hier EINMAL: der Auditeintrag, auf den `validationDecisionRef` zeigt, wird über
// `findBySeq` adressiert und mit `pruefeValidationDecisionRef` gegen Hash, Kette, Ereignisart und
// die aktuelle Fassung geprüft (KW-W3-19). Nur „OK" liefert ein Datum; jeder andere Zustand bleibt
// als Zustand stehen und wird im Herkunftsnachweis als Unsicherheit genannt.
import { type AuditEntry, type AuditRepo, pruefeValidationDecisionRef } from "../../audit";
import type { KnowledgeObject } from "../../knowledge-object";
import type { OutputPruefnachweis } from "./types";

/** Der Leseweg zum Validierungsnachweis — Punktzugriff und Kette, sonst nichts. */
export type AuditLeser = Pick<AuditRepo, "all" | "findBySeq">;

export async function pruefnachweiseFuer(
  audit: AuditLeser | undefined,
  kos: readonly KnowledgeObject[],
): Promise<OutputPruefnachweis[]> {
  const findBySeq = audit?.findBySeq?.bind(audit);
  if (!audit || !findBySeq || !kos.some((ko) => ko.validationDecisionRef)) {
    return kos.map(() => ({ zustand: "MISSING" }));
  }
  // Die Kette wird nur geladen, wenn mindestens eine Quelle einen Nachweis trägt.
  const kette: AuditEntry[] = await audit.all();
  const raus: OutputPruefnachweis[] = [];
  for (const ko of kos) {
    const ref = ko.validationDecisionRef;
    if (!ref) {
      raus.push({ zustand: "MISSING" });
      continue;
    }
    const eintrag = await findBySeq(ref.auditSeq);
    const zustand = pruefeValidationDecisionRef(
      eintrag,
      ref,
      { koId: ko.id, koVersion: ko.version },
      kette,
    );
    raus.push(
      zustand === "OK" && eintrag
        ? { zustand: "OK", am: eintrag.at, ereignis: eintrag.action }
        : { zustand: zustand === "OK" ? "MISSING" : zustand },
    );
  }
  return raus;
}
