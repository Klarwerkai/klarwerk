import { useTranslation } from "react-i18next";
import { useKiLage } from "../api/hooks";
import { kiLageAnzeige } from "../lib/kiLageAnzeige";

// ================================================================================================
// R-0599 (Ben nacharbeit-2) · DIE KI-LAGE IN DER KOPFZEILE — DAUERHAFT, FÜR JEDE ROLLE.
// ================================================================================================
//
// WO SIE STEHT, UND WARUM GENAU DORT. Die Zeile des Kopfbands ist an ihren engen Breiten
// ausgemessen (JOB 3641: 0,0 px frei bei 1000 px; `kopfbandStufe.ts` stuft die rechte Gruppe nach
// Messung zurück). Ein weiteres Flex-Kind nähme Breite UND eine Fuge weg und schöbe genau die
// gemessenen Griffe hinaus. Diese Anzeige liegt deshalb NICHT im Fluss der Zeile, sondern absolut
// im unteren Rand des Kopfbands (rechts, unter Zahnrad und Konto): dort ist das 56 px hohe Band
// frei, weil alle Griffe vertikal mittig stehen und höchstens 36 px hoch sind. Sie kostet die Zeile
// keine Breite, ist in ihrer eigenen Breite begrenzt (`max-w-[45%]`, gekürzt mit „…") und kann
// deshalb nichts aus dem Band schieben.
//
// WAS SIE SAGT: sichtbar Modus und Anbieter („KI: extern · ChatGPT (OpenAI)" / „KI: Server des
// Betreibers" / „Keine KI · regelbasiert"); im Zeigehinweis und für Vorlesewerkzeuge zusätzlich
// Betriebsort und Datenfluss, Herkunft mit Nachweisstufe und die offenen Prüfungen.
export function KiLageZeile(): JSX.Element {
  const { t } = useTranslation();
  const { data } = useKiLage();
  const anzeige = kiLageAnzeige(data);
  // Ben nacharbeit-7: die bekannte Erreichbarkeit gehört zum sichtbaren Satz, nicht nur in den
  // Zeigehinweis — „KI: extern · ChatGPT (OpenAI) · antwortet" ist eine andere Auskunft als
  // „… · Erreichbarkeit noch nicht bestätigt".
  const kurz = anzeige.verfuegbarkeitKey
    ? `${t(anzeige.textKey, anzeige.params)} · ${t(anzeige.verfuegbarkeitKey)}`
    : t(anzeige.textKey, anzeige.params);
  const herkunft = anzeige.herkunft
    ? t(anzeige.herkunft.key, {
        land: anzeige.herkunft.landKey ? t(anzeige.herkunft.landKey) : anzeige.herkunft.landCode,
      })
    : null;
  const hinweis = [kurz, ...anzeige.hinweisKeys.map((key) => t(key)), herkunft]
    .filter(Boolean)
    .join(" — ");
  return (
    // `<output>` trägt die Rolle „status“ implizit (lint/a11y/useSemanticElements).
    <output
      data-testid="kopfband-ki-lage"
      aria-label={hinweis}
      title={hinweis}
      className="kw-kopfband-ki-lage absolute bottom-px right-8 flex max-w-[45%] items-center gap-1 overflow-hidden whitespace-nowrap text-[9.5px] leading-[10px] text-hairline"
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          anzeige.ton === "warn" ? "bg-trust-warn-fill" : "bg-muted-2"
        }`}
      />
      {/* `min-w-0`: der Satz schrumpft und kürzt mit „…" IN seinem Kasten — so ragt die Zeile nie
          über ihren eigenen Rand, den `kopfbandStufe.ts` an jedem Kind des Bands nachmisst. */}
      <span className="min-w-0 truncate">{kurz}</span>
    </output>
  );
}
