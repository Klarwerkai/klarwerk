// ================================================================================================
// JOB 3326 · LESEVARIANTE — DER SICHTBARE HINWEIS UND DER WEG ZURÜCK ZUM ORIGINAL.
// ================================================================================================
//
// Wer eine Übersetzung liest, muss es WISSEN. Dieses Bauteil ist die eine Stelle, an der das steht:
// die Kennzeichnung „Übersetzung · Original: Englisch", der ehrliche Zusatz, dass eine Übersetzung
// nie Freigabegegenstand ist, der Vorbehalt „Original seit der Übersetzung geändert" (serverseitig
// gemessen) — und der Umschalter, der mit einem Klick das Original zeigt.
//
// Es entscheidet NICHTS: ob überhaupt eine Variante gezeigt wird, entscheidet `anzuzeigendeVariante`
// (lib/lesevariante.ts). Hier steht nur, wie die Entscheidung aussieht.
import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LesevarianteKennzeichnung } from "../api/types";

// Die Kennzeichnung trägt bewusst KEINE von aussen gesetzte Klassenkette: sie soll überall gleich
// aussehen, und ein durchgereichtes `className` wäre eine im Quelltext nicht auflösbare Bindung
// (der Flächen-Sammler in `tests/app/mega47-modale-flaechen-sammler.test.tsx` zählt genau die).
//
// JOB 3363: DIE PROPS SIND VERENGT, NICHT ERWEITERT. Bis hierher verlangte dieser Baustein eine
// vollständige `LesevarianteKurz` — samt `koId`, `lang`, `title`, `statement`, `updatedAt`. Gelesen
// hat er davon nie mehr als `originalLanguage`, `herkunft`, `quellabgleich` und `originalGeaendert`.
// Die Prüfkarte in Stufe 2 zeigt die Variante eines noch NICHT angenommenen Kandidaten: dort gibt es
// keine `koId`, und eine erfundene wäre eine Kennung, die auf nichts zeigt. Statt einer zweiten
// Kennzeichnungsfläche daneben (oder eines `as`, das die Lücke überstreicht) verlangt der Baustein
// jetzt genau das, was er benutzt — `LesevarianteKennzeichnung`. Die beiden Verbraucher aus JOB 3326
// (Detailansicht, Bibliotheks-Lesefläche) übergeben unverändert ihre volle Variante.
export function LesevarianteHinweis({
  variante,
  zeigtOriginal,
  onUmschalten,
}: {
  variante: LesevarianteKennzeichnung;
  /** Der Leser hat „Original anzeigen" gewählt — dann steht hier die Gegenrichtung. */
  zeigtOriginal: boolean;
  onUmschalten: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  // Die Sprachnamen kommen aus der Übersetzungsfläche und nicht aus einer Tabelle im Code: „EN"
  // heißt auf Deutsch „Englisch" und auf Englisch „English".
  const sprachname = (code: string): string => {
    const schluessel = `lesevariante.sprache.${code}`;
    const name = t(schluessel);
    // Unbekannter Code → der Code selbst, groß. Ehrlicher als ein erfundener Name.
    return name === schluessel ? code.toUpperCase() : name;
  };
  return (
    <div
      data-testid="lesevariante-hinweis"
      className="rounded-card border border-hairline bg-page px-3 py-2 text-[12px] text-muted"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 font-semibold text-text">
          <Languages size={14} aria-hidden="true" />
          {zeigtOriginal
            ? t("lesevariante.badge.original", { sprache: sprachname(variante.originalLanguage) })
            : t("lesevariante.badge.uebersetzung", {
                sprache: sprachname(variante.originalLanguage),
              })}
        </span>
        <button
          type="button"
          data-testid="lesevariante-umschalter"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onUmschalten();
          }}
          className="rounded-btn border border-hairline px-2 py-0.5 text-[11.5px] font-semibold text-text hover:bg-card"
        >
          {zeigtOriginal ? t("lesevariante.zeigeUebersetzung") : t("lesevariante.zeigeOriginal")}
        </button>
      </div>
      {zeigtOriginal ? null : (
        <p className="mt-1 text-[11.5px] text-muted-2">
          {t("lesevariante.keineFreigabe")} ·{" "}
          {t("lesevariante.herkunft", { herkunft: variante.herkunft })}
        </p>
      )}
      {variante.originalGeaendert ? (
        <p
          data-testid="lesevariante-veraltet"
          className="mt-1 text-[11.5px] font-semibold text-trust-warn-text"
        >
          {t("lesevariante.originalGeaendert")}
        </p>
      ) : null}
      {/* JOB 3326 R2 (Codex e4b79ac9): Fehlt der Beleg, dass diese Übersetzung zu genau diesem
          Originaltext gehört, steht das DA. Der Abdruck am Objekt belegt sonst nur „seit dem Laden
          unverändert" — und das ist eine schwächere Aussage, als der Leser ihm ansieht. */}
      {variante.quellabgleich === "unbestaetigt" ? (
        <p data-testid="lesevariante-unbestaetigt" className="mt-1 text-[11.5px] text-muted-2">
          {t("lesevariante.zuordnungUnbestaetigt")}
        </p>
      ) : null}
    </div>
  );
}
