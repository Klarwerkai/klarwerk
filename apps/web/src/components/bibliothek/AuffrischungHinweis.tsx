import type { UseQueryResult } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  AUFFRISCHUNG_HINWEIS_KLASSE,
  AUFFRISCHUNG_HINWEIS_MARKE,
  auffrischungGescheitert,
  auffrischungHinweisText,
} from "../../lib/confidentiality";

// ==================================================================================================
// JOB 3063 R6 — „STAND VON <ZEIT> · AUFFRISCHUNG FEHLGESCHLAGEN": EIN SATZ, EINE BAUFORM.
// ==================================================================================================
//
// DER BEFUND: nach dem Einbau der Runde 5 stand dieser Block ZWEIMAL im selben Ordner — einmal in
// `BibliothekLesen` und einmal in `BibliothekFlaeche` für die Liste, Zeichen für Zeichen gleich.
// Der Doppelungs-Wächter hat ihn gefunden (`tests/structure/fremddoppelungen-kd-capture.test.ts`:
// 27 Knoten, `BibliothekLesen.tsx` ↔ `BibliothekFlaeche.tsx`), und er hat recht: eine Aussage mit
// zwei Bauformen wird über kurz oder lang zu zwei Aussagen.
//
// WAS HIER WOHNT UND WAS NICHT: die BAUFORM (Marke, Klassen, `aria-live`) und die Bedingung „nur
// bei gescheiterter Auffrischung eines vorhandenen Bestands". Die REGEL, welcher Text mit welcher
// Zeit entsteht, wohnt weiter in `lib/confidentiality.ts` — dort teilen sie sich auch andere
// Flächen. Wer den Satz braucht, gibt seine eigene Abfrage her; ohne den Fall kommt nichts.
export function AuffrischungHinweis<T>({
  query,
}: {
  query: UseQueryResult<T>;
}): JSX.Element | null {
  const { t, i18n } = useTranslation();
  if (!auffrischungGescheitert(query)) {
    return null;
  }
  return (
    <output
      aria-live="polite"
      data-testid={AUFFRISCHUNG_HINWEIS_MARKE}
      className={AUFFRISCHUNG_HINWEIS_KLASSE}
    >
      {auffrischungHinweisText(query, t, i18n.language)}
    </output>
  );
}
