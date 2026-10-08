import { useTranslation } from "react-i18next";
import { useReasonerStatus } from "../api/hooks";
import type { ReasonerStatus } from "../api/types";

// ================================================================================================
// Auftrag gesamt-ki-freigaberegeln · R-0606 — „IN DER KOPFZEILE STEHT SICHTBAR ‚EXTERN: BLOCKIERT'".
// ================================================================================================
//
// WAS ANGEZEIGT WIRD: der WIRKSAME Stand der zentralen Adminfreigabe für öffentliche KI, so wie
// ihn der Server aus derselben Entscheidungsstelle meldet, die jeden Lauf freigibt oder sperrt
// (`Reasoner.publicStatus().extern` → `oeffentlicheKiErlaubt`). Die Fläche rechnet nichts nach.
//   blockiert         → „Extern: Blockiert" (Vorgabe, keine Freigabe)
//   frei              → „Extern: Freigegeben" (Grundfreigabe)
//   frei_vertraulich  → „Extern: Freigegeben, auch Vertrauliches" (beide Freigaben)
// Fehlt die Auskunft (alter Server, Statusfehler, noch nicht geladen), steht NICHTS da — eine
// Behauptung ohne Deckung wäre schlimmer als keine.
//
// WARUM EINE EIGENE ZEILE ÜBER DEM KOPFBAND UND KEIN GRIFF IN IHM: dieselbe Bauform wie die
// Demo-Kennzeichnung (JOB 3761, `Kopfband.tsx`). Die Kopfbandzeile ist an ihren Breiten auf den
// Pixel ausgemessen (FE-002, `kopfbandStufe.ts`); eine eigene Zeile kostet sie NULL Breite.
//
// FARBEN: vorhandene Token-Paarungen — gesperrt neutral, freigegeben als Warnung, weil dann Inhalte
// das Haus verlassen können.

export type ExternStand = NonNullable<ReasonerStatus["extern"]>;

/** Rein: welcher Stand gilt — oder keiner, wenn der Server keinen gültigen meldet. */
export function externStand(
  status: Pick<ReasonerStatus, "extern"> | undefined,
): ExternStand | null {
  const wert = status?.extern;
  return wert === "blockiert" || wert === "frei" || wert === "frei_vertraulich" ? wert : null;
}

export function ExternStatus(): JSX.Element | null {
  const { t } = useTranslation();
  const stand = externStand(useReasonerStatus().data);
  if (stand === null) {
    return null;
  }
  const farbe =
    stand === "blockiert"
      ? "border-hairline bg-surface text-muted"
      : "border-trust-warn-fill/40 bg-trust-warn-bg text-trust-warn-text";
  // Die drei Sätze stehen ausgeschrieben, damit die Wörterbuchprüfung jeden Aufrufer findet.
  const text =
    stand === "blockiert"
      ? t("topbar.extern.blockiert")
      : stand === "frei"
        ? t("topbar.extern.frei")
        : t("topbar.extern.freiVertraulich");
  return (
    <div
      data-testid="extern-status"
      data-extern={stand}
      title={t("topbar.extern.hinweis")}
      className={`shrink-0 border-b px-4 py-0.5 text-center text-[11.5px] font-semibold ${farbe}`}
    >
      {text}
    </div>
  );
}
