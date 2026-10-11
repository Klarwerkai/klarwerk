// ================================================================================================
// produkt:20261010:fragen-pruefen-einstieg — DER PRÜFANLASS STEHT AN DER KARTE, NICHT IM „?"-MENÜ.
// ================================================================================================
//
// Bis hierher beantwortete das Prüfboard „Was prüfe ich jetzt?" und „Was bewirkt die Entscheidung?"
// ausschliesslich im Hilfemenü (`reviewGuidance.ts`, gerendert in `pages/Validation.tsx`). An der
// Karte selbst stand nicht, WARUM dieser Eintrag bei der prüfenden Person liegt. Diese Datei leitet
// genau das aus VORHANDENEN Signalen ab — Zuweisung, Fassung, Autor-Übertragung, Stimmen — und
// liefert drei kurze Zeilen: warum hier, was prüfen, was die Entscheidung bewirkt.
//
// KEINE NEUE REGEL: Quorum, Begründungspflicht, KI-Sperre und Versionsschutz bleiben, wo sie sind.
// Die Wirkungszeile nennt nur, was `DECISION_IMPACTS` schon zusagt (Freigabe = eine Stimme;
// Rückfrage/Ablehnung mit Begründung in die Nacharbeit; nichts automatisch).
import { reviewGuidanceFocusKey } from "./reviewGuidance";
import type { ReviewContextKind } from "./validationReviewContext";

export interface PruefGrundEingabe {
  kind: ReviewContextKind;
  version: number;
  authorTransferred: boolean;
  /** Offene Zuweisungen (Kennungen). */
  zugewiesen: readonly string[];
  /** Kennung der angemeldeten Person; `null`, wenn unbekannt. */
  ich: string | null;
  greenVotes: number;
  needed: number;
}

export type PruefGrundWarum =
  | { key: "pruefgrund.warum.mir"; params: Record<string, never> }
  | { key: "pruefgrund.warum.andere"; params: { anzahl: number } }
  | { key: "pruefgrund.warum.offen"; params: Record<string, never> };

export interface PruefGrund {
  /** Warum der Eintrag hier liegt. */
  warum: PruefGrundWarum;
  /** Anlass aus der Fassung: neu oder überarbeitet (mit Fassungsnummer). */
  anlassKey: "pruefgrund.anlass.new" | "pruefgrund.anlass.revision";
  version: number;
  /** Was zu prüfen ist — der vorhandene Fokussatz, sonst die Erstbewertungs-Zeile. */
  wasKey: string;
  /** Was eine Freigabe bewirkt — mit den tatsächlichen Stimmen. */
  wirkung: { key: "pruefgrund.wirkung"; params: { have: number; need: number } };
}

function ganzzahl(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function pruefGrund(e: PruefGrundEingabe): PruefGrund {
  const offen = e.zugewiesen.filter((id) => id.trim().length > 0);
  let warum: PruefGrundWarum;
  if (e.ich && offen.includes(e.ich)) {
    warum = { key: "pruefgrund.warum.mir", params: {} };
  } else if (offen.length > 0) {
    warum = { key: "pruefgrund.warum.andere", params: { anzahl: offen.length } };
  } else {
    warum = { key: "pruefgrund.warum.offen", params: {} };
  }
  const fokus = reviewGuidanceFocusKey({ kind: e.kind, authorTransferred: e.authorTransferred });
  return {
    warum,
    anlassKey: e.kind === "revision" ? "pruefgrund.anlass.revision" : "pruefgrund.anlass.new",
    version: Math.max(1, ganzzahl(e.version)),
    wasKey: fokus ?? "val.reviewContext.hint.new",
    wirkung: {
      key: "pruefgrund.wirkung",
      params: { have: ganzzahl(e.greenVotes), need: Math.max(1, ganzzahl(e.needed)) },
    },
  };
}
