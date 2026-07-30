// ================================================================================================
// AUFTRAG-mega61 BLOCK E — DER SATZ, DEN MAN NICHT AUFKLAPPEN MUSS.
// ================================================================================================
//
// DER BEFUND: Bis mega60 stand an einer KI-Fläche, WELCHE Art Modell arbeitet — hinter einem
// „(!)"-Knopf (AiModelInfo). Das ist eine gute Auskunft, aber sie setzt voraus, dass man die Frage
// schon gestellt hat. Artikel 50 Absatz 5 der KI-Verordnung verlangt die Information „klar und
// deutlich unterscheidbar", und Absatz 1 verlangt sie bei der ERSTEN Interaktion. Was man erst
// aufklappen muss, ist beides nicht.
//
// DESHALB EIN DAUERHAFT SICHTBARER SATZ, EINER FÜR ALLE FLÄCHEN. Ein zweiter Wortlaut wäre eine
// zweite Wahrheit über dasselbe Produkt — und je Fläche anders formuliert wäre er auch nicht mehr
// „deutlich unterscheidbar", sondern nur noch Dekoration.
//
// OHNE MERKMALSSCHALTER, und das ist keine Nachlässigkeit: Der Satz sagt, was das Produkt TUT.
// Eine Wahrheit über das eigene Verhalten abschaltbar zu machen, hieße, sie zur Option zu erklären.
//
// BARRIEREARM: keine Aussage allein über Farbe (es ist reiner Text), kein eigener Fokuspunkt (er
// ist nicht bedienbar, also gehört er auch nicht in die Tabreihenfolge), und `text-muted` statt
// `text-muted-2` — die Transparenzhinweise müssen nach Artikel 50 Absatz 5 ausdrücklich die
// Barrierefreiheitsanforderungen erfüllen, und das schließt den Kontrast ein.
import { useTranslation } from "react-i18next";

/** Der i18n-Schlüssel, einmal. Sammler und Tests lesen ihn hier statt ihn abzuschreiben. */
export const AI_GENERATED_NOTICE_KEY = "ai.generatedNotice";

export function AiGeneratedNotice({ className }: { className?: string }): JSX.Element {
  const { t } = useTranslation();
  return (
    <span
      data-testid="ai-generated-notice"
      className={`text-[11.5px] leading-snug text-muted ${className ?? ""}`}
    >
      {t(AI_GENERATED_NOTICE_KEY)}
    </span>
  );
}
