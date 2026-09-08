import { useTranslation } from "react-i18next";
import { useNavGuard } from "../app/NavGuardContext";
import { useNeueVersionVerfuegbar } from "../lib/versionswaechter";

// ================================================================================================
// JOB 3268 · D1-R — DIE EINE ZEILE, DIE DEM ALTEN TAB SAGT, DASS ER ALT IST.
// ================================================================================================
//
// EINE STELLE, RUHIG, OHNE MODAL (§5.2): eine schmale Zeile am oberen Rand mit höchstens 60 Zeichen
// und EINEM Knopf. Kein Dialog, der die Arbeit unterbricht, und ausdrücklich KEIN automatisches
// Neuladen — das wäre genau der stille Verlust, gegen den dieser Auftrag steht.
//
// WARUM SIE ALS ÜBERLAGERUNG HÄNGT UND NICHT IM KOPFBAND: die Zielpfade dieses Auftrags enthalten
// `App.tsx`, nicht `shell/Kopfband.tsx` — und das Kopfband ist bis auf den Pixel vermessen
// (`tests/design/zielbild-h1-huelle.test.ts`, 56 px, feste Punkteliste). Eine Zeile IM Fluss
// darüber verschöbe die ganze Hülle nach unten und machte diese Messungen rot. Die Überlagerung
// sitzt deshalb direkt UNTER dem Kopfband am rechten Rand: sichtbar, ohne ein Bedienelement zu
// verdecken, und sie verschwindet mit dem Neuladen von selbst. Sie liegt unter der Modalebene
// (z-40 wie Klara, Modal ist z-50), damit ein offener Dialog immer obenauf bleibt.
//
// DER KLICK GEHT DURCH DEN VORHANDENEN ENTWURFSSCHUTZ (§5.3). `guard()` aus dem Navigationswächter
// ist genau die Frage „darf die aktuelle Fläche jetzt verlassen werden?": ohne ungesicherte Eingabe
// führt es sofort weiter, mit ungesicherter Eingabe stellt es die sichtbare Rückfrage mit
// „Entwurf speichern" (`erfassen/Blatt.tsx:1234-1252` meldet den Schutz an). Hier entsteht also
// KEINE zweite Rückfrage neben der bestehenden — die eine wird benutzt.
export function VersionsHinweis(): JSX.Element | null {
  const { t } = useTranslation();
  const { guard } = useNavGuard();
  const neueVersion = useNeueVersionVerfuegbar();

  if (!neueVersion) {
    return null;
  }

  return (
    // `<output aria-live="polite">` ist die Hausform der ruhigen Meldezeile (vgl.
    // `components/bibliothek/AuffrischungHinweis.tsx:34`): sie meldet sich höflich, ohne den Fokus
    // zu stehlen — ein `role="status"` an einem `<div>` wäre dieselbe Aussage mit weniger Semantik.
    <output
      data-testid="versions-hinweis"
      aria-live="polite"
      className="fixed right-4 top-[64px] z-40 flex items-center gap-3 rounded-card border border-hairline bg-surface px-3 py-2 text-[13px] text-text shadow-popover"
    >
      <span>{t("version.neu.hinweis")}</span>
      <button
        type="button"
        data-testid="versions-hinweis-neu-laden"
        onClick={() => guard(() => window.location.reload())}
        className="shrink-0 rounded-btn bg-ink px-2.5 py-1 text-[12.5px] font-semibold text-page hover:opacity-85"
      >
        {t("version.neu.neuLaden")}
      </button>
    </output>
  );
}
