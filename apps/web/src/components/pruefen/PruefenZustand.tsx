// ================================================================================================
// JOB 3061 · H2 — DIE VIER LAGEN DER FLÄCHE, JEDE MIT GENAU EINEM SATZ (Auftrag §9).
// ================================================================================================
//
//   laden       drei graue Platzhalterzeilen — kein Text, keine Zahl, keine Behauptung
//   leer        EIN Satz. Kein Kasten, keine Erklärung; das Warum steht im „?"-Menü.
//   Erstfehler  EIN Satz + „Erneut laden" — nur wenn es NIE eine Antwort gab.
//   Bestand     die Fläche selbst; eine gescheiterte AUFFRISCHUNG löscht sie nicht, sie bekommt
//               eine Zeile darüber („Stand von … · Auffrischung fehlgeschlagen").
//
// Der letzte Punkt ist die Lehre aus JOB 3027 R2 (Regelwerk §7, erster Spiegelstrich): wer bei
// einem gescheiterten Hintergrund-Abruf die Karten durch eine Fehlerfläche ersetzt, nimmt einem
// Menschen mitten in der Entscheidung den Bestand weg.
import { useTranslation } from "react-i18next";

export function PruefenPlatzhalter({ zeilen = 3 }: { zeilen?: number }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div data-testid="pruefen-platzhalter" aria-label={t("state.loading")} aria-busy="true">
      {Array.from({ length: zeilen }, (_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: Platzhalterzeilen haben keine Identität ausser ihrer Lage.
          key={`platzhalter-${i}`}
          className="mb-1 h-[38px] rounded-[9px] bg-hairline-soft"
        />
      ))}
    </div>
  );
}

/** Der EINE Satz. Keine Karte, kein Rahmen, keine zweite Zeile. */
export function PruefenSatz({
  kennung,
  children,
}: { kennung: string; children: string }): JSX.Element {
  return (
    <p
      data-testid={`pruefen-satz-${kennung}`}
      data-text="text"
      className="text-[13.5px] text-muted"
    >
      {children}
    </p>
  );
}

/** Erstfehler: ein Satz und der Weg zurück. */
export function PruefenErstfehler({ onRetry }: { onRetry: () => void }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div data-testid="pruefen-erstfehler" className="flex flex-wrap items-center gap-2">
      <PruefenSatz kennung="fehler">{t("pruefen.loadError")}</PruefenSatz>
      <button
        type="button"
        data-text="knopf"
        onClick={onRetry}
        className="rounded-[9px] border border-hairline bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-text hover:bg-hairline-soft"
      >
        {t("pruefen.reload")}
      </button>
    </div>
  );
}

/** „Stand von … · Auffrischung fehlgeschlagen" — der Bestand bleibt stehen, er ist nur nicht frisch. */
export function PruefenNichtFrisch(): JSX.Element {
  const { t } = useTranslation();
  return (
    <p
      data-testid="pruefen-nicht-frisch"
      data-text="text"
      className="mb-2 text-[11.5px] text-muted"
    >
      {t("pruefen.refreshFailed")}
    </p>
  );
}
