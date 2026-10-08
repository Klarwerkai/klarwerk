// ================================================================================================
// Aufnahme gesamt-wissen-herkunft · R-0228 — DIE VERIFIZIERUNGSMARKE AM WISSENSOBJEKT.
// ================================================================================================
//
// „An jedem Wissensobjekt steht, wer es wann geprüft hat und ob der maschinelle Prüflauf
// vollständig war." Die Daten dafür lagen schon vor — nur verstreut: der Verweis auf die
// menschliche Entscheidung (`validationDecisionRef`) am Objekt, Prüfer und Zeitpunkt im
// verwiesenen Prüfprotokolleintrag, die Validierenden in `ownership.validators`, der KI-Lauf in
// `aiCheck`. Wer wissen wollte, wie frisch und wie gut eine Aussage geprüft ist, musste die
// Herkunftskette öffnen und zusammensuchen.
//
// Diese Stelle führt den MENSCHLICHEN Teil zusammen; den maschinellen Teil leitet die Oberfläche
// aus `aiCheck` mit der vorhandenen Regel ab (`kiPruefzustand`, apps/web/src/lib/aiCheckStatusCard.ts)
// — eine zweite Fassung dieser Regel hier wäre eine zweite Wahrheit.
//
// WAS DIE MARKE BEHAUPTET UND WAS NICHT:
//   · Gelesen wird GENAU der Eintrag, auf den das Objekt verweist: Folgenummer UND Hash müssen
//     übereinstimmen, die Aktion muss eine Entscheidung sein und das Ziel dieses Objekt. Es wird
//     nichts gesucht oder rekonstruiert (KW-W3-19). Trifft eine Bedingung nicht zu, heißt der Stand
//     ehrlich „nicht auffindbar" — nie „geprüft".
//   · Die Kettenprüfung des gesamten Protokolls (`pruefeValidationDecisionRef`) läuft hier NICHT; die
//     Marke ist eine Anzeige, kein Integritätsnachweis. Den führt weiterhin der Antwortbeleg.
//   · Bezieht sich die Entscheidung auf eine frühere Fassung, sagt die Marke das (`aktuell: false`).
//   · Prüfer werden als KENNUNG geliefert. Den Namen löst die Oberfläche über das Verzeichnis auf —
//     dieselbe Leseregel wie jede andere Autorenzeile. Die Nutzlast des Eintrags verlässt den Server
//     nicht.
// Leserecht: die Marke steht nur an `GET /api/kos/:id`, also hinter `sichtbaresKoOder404`.
import { type AuditService, VALIDATION_DECISION_ACTIONS } from "../../audit";
import type { KnowledgeObject } from "../../knowledge-object";

export type VerifizierungsArt = "bewertung" | "verwalter" | "rueckgabe";

export type MenschlichePruefung =
  /**
   * Am Objekt steht kein Verweis auf eine Entscheidung. Das heißt NICHT „nie geprüft“: Altbestand
   * vor KW-W3-19 trägt den Verweis nicht, auch wenn er validiert wurde (kein Backfill, Pedis
   * Entscheidung). Die Marke sagt deshalb nur, dass die Prüfung nicht BELEGT ist; die Validierenden
   * aus `ownership.validators` bleiben davon getrennt erhalten. Nichts wird nachgetragen.
   */
  | { stand: "nicht_belegt" }
  /** Ein Verweis steht da, aber der verwiesene Eintrag passt nicht (fehlt, Hash, Art, Ziel). */
  | { stand: "nicht_auffindbar" }
  /** Das Protokoll ließ sich nicht lesen — keine Aussage über die Prüfung. */
  | { stand: "nicht_abrufbar" }
  | {
      stand: "belegt";
      art: VerifizierungsArt;
      /** Kennung des Entscheidenden (Name löst die Oberfläche auf). */
      pruefer: string;
      zeitpunkt: string;
      /** Die entschiedene Fassung; `null`, wenn der Eintrag sie nicht trägt (Altbestand). */
      fassung: number | null;
      /** Entspricht die entschiedene Fassung der heutigen? */
      aktuell: boolean;
    };

export interface Verifizierung {
  mensch: MenschlichePruefung;
  /** Wer die abgeschlossene Validierung getragen hat (`ownership.validators`), als Kennungen. */
  validiertVon: string[];
}

function artVon(action: string): VerifizierungsArt {
  if (action === "ko.admin-validated") {
    return "verwalter";
  }
  if (action === "ko.rated") {
    return "bewertung";
  }
  return "rueckgabe";
}

export async function verifizierungFuer(
  ko: KnowledgeObject,
  audit: Pick<AuditService, "list"> | undefined,
): Promise<Verifizierung> {
  const validiertVon = [...(ko.ownership?.validators ?? [])];
  const ref = ko.validationDecisionRef;
  if (!ref) {
    return { mensch: { stand: "nicht_belegt" }, validiertVon };
  }
  if (!audit) {
    return { mensch: { stand: "nicht_abrufbar" }, validiertVon };
  }
  let eintraege: Awaited<ReturnType<AuditService["list"]>>;
  try {
    eintraege = await audit.list({ target: ko.id });
  } catch {
    return { mensch: { stand: "nicht_abrufbar" }, validiertVon };
  }
  const eintrag = eintraege.find((e) => e.seq === ref.auditSeq);
  if (
    !eintrag ||
    eintrag.hash !== ref.auditHash ||
    !VALIDATION_DECISION_ACTIONS.includes(eintrag.action) ||
    eintrag.target !== ko.id
  ) {
    return { mensch: { stand: "nicht_auffindbar" }, validiertVon };
  }
  const fassung = typeof eintrag.payload.koVersion === "number" ? eintrag.payload.koVersion : null;
  return {
    mensch: {
      stand: "belegt",
      art: artVon(eintrag.action),
      pruefer: eintrag.actor,
      zeitpunkt: eintrag.at,
      fassung,
      aktuell: fassung === ko.version,
    },
    validiertVon,
  };
}
