// ================================================================================================
// AUFTRAG-mega62 BLOCK F — DER HALBSATZ, DER SAGT, DASS DER KLICK ETWAS KOSTET.
// ================================================================================================
//
// DER BEFUND (bens mega61-Anmerkung 5): Der Kostenhinweis stand an GENAU EINER Auslösestelle — dem
// Beispielklick auf der Fragenfläche (`ask.examplesSendHint`). An Strukturieren, Extrahieren,
// Interview, Umformulieren, Gruppieren und Bildbeschreibung fehlte er, obwohl dort dasselbe
// passiert: ein Klick, ein echter Modellaufruf, echte Kosten.
//
// WARUM ER EIN EIGENES BAUTEIL IST UND KEIN KOPIERTER SATZ: Der Grund, aus dem er an sechs Stellen
// fehlte, ist genau der, dass er an der siebten nur eine Zeile Markup war. Als Bauteil hat er einen
// Ort, einen Wortlaut, einen Schlüssel — und der Sammler
// tests/legal/mega62-kostenhinweis-sammler.test.ts kann über ihn RECHNEN statt Fälle aufzuzählen.
//
// KEIN BESTÄTIGUNGSDIALOG. Das war in mega61 eine bewusste Entscheidung und bleibt eine: Wer sechs
// Mal am Tag strukturiert, klickt einen Dialog weg, ohne ihn zu lesen — dann kostet er Aufmerksamkeit
// und schützt nichts. Ein Halbsatz neben dem Knopf steht da, bevor geklickt wird, und stört nie.
//
// KEINE BELEHRUNG: ein Halbsatz, kein Absatz. Er sagt, was passiert, nicht was man tun soll.
//
// BARRIEREARM: reiner Text (keine Aussage über Farbe), nicht bedienbar (also kein Fokuspunkt), und
// `text-muted` — dasselbe Token wie beim KI-Satz, seit mega62 Block D auch auf `bg-hairline-soft`
// über AA.
import { useTranslation } from "react-i18next";

/** Der i18n-Schlüssel, einmal. Sammler und Tests lesen ihn hier statt ihn abzuschreiben. */
export const AI_COST_HINT_KEY = "ai.costHint";

export function AiCostHint({ className }: { className?: string }): JSX.Element {
  const { t } = useTranslation();
  return (
    <span
      data-testid="ai-cost-hint"
      className={`text-[11.5px] leading-snug text-muted ${className ?? ""}`}
    >
      {t(AI_COST_HINT_KEY)}
    </span>
  );
}
