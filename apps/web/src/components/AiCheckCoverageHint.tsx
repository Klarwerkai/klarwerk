// ================================================================================================
// AUFTRAG-mega29 BLOCK C (bens M28-3) — DIE EINSCHRÄNKUNG ERREICHT MEHR ALS ZWEI ANSICHTEN.
// ================================================================================================
//
// mega28 hat den Deckel-Ehrlichkeitsvertrag an genau zwei Stellen sichtbar gemacht: der
// Validierungsliste (AiCheckBadge) und der Erfolgskarte im Erfassen. Überall sonst las ein Mensch
// dasselbe Urteil — oder schloss aus dessen Ausbleiben etwas — ohne die Einschränkung zu sehen.
//
// Diese Datei trägt die beiden Flächen, die mega29 ausdrücklich nachzieht:
//
//   C1 — AiCheckCoverageNotes: die Abdeckung EINES Objekts, dort wo jemand dieses Objekt beurteilt
//        (KO-Detail). Ein Satz je vorliegender Einschränkung (mega29 B4 — Abbruch und Übersprünge
//        verdrängen einander nicht mehr).
//   C2 — AiCheckBoardCaveat: die Fußnote der LEEREN Konflikt-/Duplikat-Boards. „Keine offenen
//        Konflikte" ist wörtlich richtig und lädt trotzdem zu genau dem Schluss ein, gegen den der
//        Deckel-Vertrag gebaut wurde. Die Finding-Endpunkte kennen keine Laufabdeckung, deshalb
//        liest diese Komponente die schmale serverseitige Zusammenfassung (drei Zähler).
import { useTranslation } from "react-i18next";
import { useAiCheckCoverageSummary } from "../api/hooks";
import type { AiCheckCoverage } from "../api/types";
import {
  aiCheckCoverageNote,
  aiCheckCoverageNoteKeys,
  aiCheckCoverageVars,
} from "../lib/aiCheckStatusCard";

// Ein Satz je Einschränkung. Ein wirklich vollständiger Lauf (und ein Objekt ganz ohne Protokoll)
// schweigt weiterhin — sonst wäre der Hinweis Dauerrauschen statt Warnung.
export function AiCheckCoverageNotes({
  coverage,
  className = "mt-2 text-[12px] leading-relaxed text-trust-warn-text",
}: {
  coverage: AiCheckCoverage | null | undefined;
  className?: string;
}): JSX.Element | null {
  const { t } = useTranslation();
  const note = aiCheckCoverageNote(coverage);
  if (!note) {
    return null;
  }
  return (
    <>
      {aiCheckCoverageNoteKeys(note).map((key) => (
        <p key={key} className={className}>
          {t(key, aiCheckCoverageVars(note))}
        </p>
      ))}
    </>
  );
}

// Die Fußnote unter einem LEEREN Board. Sie erscheint NUR, wenn es wirklich etwas einzuschränken
// gibt (unvollständige oder gar nicht geprüfte Objekte) — ein durchweg vollständig geprüfter
// Bestand bekommt keinen Warnsatz, den er nicht verdient. Solange die Zusammenfassung lädt oder
// scheitert, wird NICHTS behauptet (kein „alles gut" aus einem Ladezustand).
// AUFTRAG-mega31 A3/A4: `noCoverage` ist ein DRITTER Grund zu schweigen zu verbieten. Ein Bestand
// aus lauter Altobjekten mit Laufstatus, aber ohne Abdeckung, hätte sonst weiterhin nichts gerendert
// — dieselbe stille Entwarnung, nur eine Ebene tiefer. Er bekommt einen eigenen Satz, weil „ein Lauf
// ist vermerkt, seine Reichweite nicht" etwas anderes ist als „gar kein Lauf".
export function AiCheckBoardCaveat({
  className = "mx-auto mt-2 max-w-md text-left text-[12.5px] leading-relaxed text-trust-warn-text",
}: { className?: string } = {}): JSX.Element | null {
  const { t } = useTranslation();
  const summary = useAiCheckCoverageSummary().data;
  if (
    !summary ||
    (summary.incomplete === 0 && summary.unchecked === 0 && summary.noCoverage === 0)
  ) {
    return null;
  }
  return (
    <>
      {(summary.incomplete > 0 || summary.unchecked > 0) && (
        <p className={className}>
          {t("val.aiCheck.boardCaveat", {
            total: summary.total,
            incomplete: summary.incomplete,
            unchecked: summary.unchecked,
          })}
        </p>
      )}
      {summary.noCoverage > 0 && (
        <p className={className}>
          {t("val.aiCheck.boardCaveat.noCoverage", { noCoverage: summary.noCoverage })}
        </p>
      )}
    </>
  );
}
