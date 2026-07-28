// WP-SUBMIT-ASYNC (Pedis Architektur-Entscheid R3, 21.07.): das Einreichen blockiert nicht mehr
// auf die KI-Pruefung — DIESES Badge macht den Hintergrund-Status auf der Validierungs-Karte
// sichtbar. pending → dezenter Laeuft-Hinweis (Uhr, kein lauter Spinner); failed → ehrliche
// Warn-Pill mit Ursache im Tooltip + Retry-Knopf (reiht den Job serverseitig neu ein);
// done ODER Altbestand ohne aiCheck-Feld → bewusst NICHTS (kein Badge-Rauschen fuer den Normalfall).
import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Confidentiality, KnowledgeObject } from "../api/types";
import {
  aiCheckCoverageNote,
  aiCheckCoverageNoteKeys,
  aiCheckCoverageVars,
  aiCheckFailureReasonKey,
  aiCheckPendingHintKey,
  aiCheckPendingLabelKey,
} from "../lib/aiCheckStatusCard";

export interface AiCheckBadgeProps {
  aiCheck: KnowledgeObject["aiCheck"];
  // Reiht die Pruefung neu ein (POST /api/kos/:id/ai-check) — nur im failed-Zustand sichtbar.
  onRetry: () => void;
  retryBusy?: boolean;
  // PAKET 1.4 (D-AISTATE): ehrlicher Name je Modellzustand — „(mit KI)" nur bei nutzbarem Modell.
  // Als PROP (nicht Hook), damit das Badge ohne QueryClient-Provider isoliert testbar bleibt; der
  // Eltern-Kontext (Validierung) reicht den globalen Modellzustand ein. Default false = no-KI-Text.
  modelActive?: boolean;
  // AUFTRAG-mega9 Block E-3 (KW-E2E-007): die TATSÄCHLICHE Vertraulichkeitsstufe des Objekts. Der
  // Grund „confidential" ist eine PAAR-Eigenschaft (subject ODER Kandidat vertraulich) — ohne die
  // echte Stufe behauptete der Tooltip, das Objekt selbst sei vertraulich. Als Prop (nicht Hook),
  // damit das Badge isoliert testbar bleibt — gleiches Muster wie modelActive.
  subjectConfidentiality?: Confidentiality | null | undefined;
}

// WP-SHIP9-S1 (Pedis B3): die Ursache→Key-Abbildung lebt jetzt in der lib (aiCheckStatusCard) —
// EINE Quelle für dieses Badge UND die Live-Status-Karte auf /erfassen (eine .ts-lib darf keine
// .tsx importieren, Root-Build ohne jsx). Re-Export erhält die bestehende Import-Fläche.
export { aiCheckFailureReasonKey };

export function AiCheckBadge({
  aiCheck,
  onRetry,
  retryBusy,
  modelActive = false,
  subjectConfidentiality,
}: AiCheckBadgeProps): JSX.Element | null {
  const { t } = useTranslation();
  if (!aiCheck) {
    return null;
  }
  // AUFTRAG-mega28 A2 (Pedi 26.07.): Seit dem Deckel ist „done ⇒ nichts anzeigen" FALSCH geworden.
  // Ein abgeschlossener Lauf, der gegen 20 von 12.479 möglichen Nachbarn geprüft hat, sähe sonst
  // exakt aus wie ein vollständiger — und sein leeres Ergebnis läse sich als „konfliktfrei". Die
  // Einschränkung steht deshalb AUCH im Erfolgsfall an der Karte; nur ein wirklich vollständiger
  // Lauf schweigt weiterhin (aiCheckCoverageNote liefert dann null — kein Badge-Rauschen).
  //
  // AUFTRAG-mega29 B4: die Notiz trägt eine LISTE von Einschränkungen (Abbruch UND Übersprünge
  // können zugleich vorliegen). Der Tooltip führt sie zu EINEM Text zusammen — bis mega28 gewann
  // der Abbruchtext, und die bereits ausgelassenen Vergleiche verschwanden für den Leser.
  const coverage = aiCheckCoverageNote(aiCheck.coverage);
  const coverageTip = coverage
    ? aiCheckCoverageNoteKeys(coverage)
        .map((key) => t(key, aiCheckCoverageVars(coverage)))
        .join(" ")
    : "";
  if (aiCheck.status === "done") {
    return coverage ? (
      <span
        title={coverageTip}
        className="rounded-pill bg-page px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted"
      >
        {t("val.aiCheck.coverage.partial")}
      </span>
    ) : null;
  }
  if (aiCheck.status === "pending") {
    return (
      <span
        title={t(aiCheckPendingHintKey(modelActive))}
        className="inline-flex items-center gap-1 rounded-pill bg-page px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted"
      >
        <Clock className="h-3 w-3 animate-pulse" aria-hidden="true" />
        {t(aiCheckPendingLabelKey(modelActive))}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <span
        title={t(aiCheckFailureReasonKey(aiCheck.fallbackReason, subjectConfidentiality))}
        className="rounded-pill bg-trust-warn-bg px-1.5 py-0.5 font-mono text-[10px] font-semibold text-trust-warn-text"
      >
        {t("val.aiCheck.failed")}
      </span>
      {/* mega28 A2: auch der gescheiterte Lauf sagt, wie weit er kam — die Ursache allein
          beantwortet nicht, wie viel überhaupt angesehen wurde. */}
      {coverage ? (
        <span
          title={coverageTip}
          className="rounded-pill bg-page px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted"
        >
          {t("val.aiCheck.coverage.partial")}
        </span>
      ) : null}
      <button
        type="button"
        onClick={onRetry}
        disabled={retryBusy}
        className="rounded-pill border border-hairline px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted hover:text-text disabled:opacity-50"
      >
        {t("val.aiCheck.retry")}
      </button>
    </span>
  );
}
