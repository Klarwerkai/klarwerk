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
//
// ================================================================================================
// AUFTRAG-mega67 BLOCK G (Pedi 30.07.) — „Die kostenpflichtige sollte nur kommen, wenn eine
// öffentliche KI aktiviert ist."
// ================================================================================================
//
// Er hat recht. Bis mega66 stand dieser Satz UNBEDINGT — auch dann, wenn die Aufgabe über den
// deterministischen Ersatzweg oder das LOKALE Modell lief. Dann kostet der Klick nichts, und
// „kostenpflichtig" ist eine falsche Tatsachenaussage in der Oberfläche; dieselbe Klasse wie die
// 24-Stunden-Zusage, die mega65 entfernt hat.
//
// Der Hinweis hängt deshalb jetzt an `billable` je Aufgabe (services/reasoner/src/service.ts,
// taskBillable) — nicht am globalen `mode`, der über die Kette DIESER Aufgabe nichts sagt.
//
// NICHT MITBEDINGT: der KI-Satz nach Artikel 50 (AiGeneratedNotice). Die Kennzeichnungspflicht
// hängt am KI-ERZEUGNIS, nicht am Preis — ein lokal erzeugter Text ist genauso gekennzeichnet.
// Wer beides zusammen bedingt, baut eine Rechtslücke. Die beiden Sätze stehen zwar oft
// nebeneinander, aber sie folgen bewusst verschiedenen Bedingungen; der Test
// tests/legal/mega67-kostenhinweis-bedingt.test.tsx belegt in JEDEM Fall beide.
// WARUM DIESES BAUTEIL DIE AUSKUNFT NICHT SELBST HOLT (erster Wurf von mega67, zurückgenommen):
// Es sitzt als BLATT in Bäumen, die keinen React-Query-Client haben — der Editor und seine
// Bildbeschreibungs-Formulare werden in Tests bewusst ohne Provider gemountet. Ein `useQuery` hier
// riss 28 Bestandstests mit „No QueryClient set" auf. Die Auskunft wird deshalb dort geholt, wo ein
// Client garantiert ist, und als BOOLEAN hereingereicht — dieselbe Bauform, mit der schon
// `imageDescribe.available` an genau diese Stellen kommt (app/ImageDescribeContext.tsx).
import { useTranslation } from "react-i18next";

/** Der i18n-Schlüssel, einmal. Sammler und Tests lesen ihn hier statt ihn abzuschreiben. */
export const AI_COST_HINT_KEY = "ai.costHint";

export function AiCostHint({
  billable,
  className,
}: {
  // Kostet der Klick daneben WIRKLICH etwas? Abgeleitet aus `billable` je Aufgabe
  // (lib/aiAvailability.ts deriveAiBillable). `undefined` = noch keine Auskunft.
  billable: boolean | undefined;
  className?: string;
}): JSX.Element | null {
  const { t } = useTranslation();
  // Ohne Auskunft wird NICHTS behauptet: ein Kostenhinweis, der beim Laden aufblitzt und dann
  // verschwindet, wäre für die Dauer seines Aufblitzens genau die falsche Aussage, die dieser
  // Block beseitigt. Schweigen ist keine Falschaussage.
  if (billable !== true) {
    return null;
  }
  return (
    <span
      data-testid="ai-cost-hint"
      className={`text-[11.5px] leading-snug text-muted ${className ?? ""}`}
    >
      {t(AI_COST_HINT_KEY)}
    </span>
  );
}
