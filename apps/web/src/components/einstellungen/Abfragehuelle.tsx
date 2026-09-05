// JOB 3065 H6 R2 — DER LADE-, FEHLER- UND STALE-VERTRAG DER DETAILKARTEN.
//
// BENs Befund aus Runde 1 (Korrekturpflicht 2): Die Zeile sagte bei einem gescheiterten Abruf
// ehrlich „nicht abrufbar" — die Detailkarte dahinter zeigte danach DAUERHAFT „Wird geladen …".
// Ein injizierter 503 auf `/api/reasoner/config` ergab `{ laden: true, erneut: false }`. Das ist
// genau die zweite Unwahrheit statt der ersten: die Karte behauptet fortgesetzte Arbeit, obwohl
// der Abruf gescheitert ist, und bietet keinen Weg zurück.
//
// Diese Hülle ist die EINE Stelle, an der eine Detailkarte ihren Zustand rendert. Sie bildet
// dasselbe Modell ab wie der Zeilenwert (`zeilenWert.ts`, REGELN §7, Auftrag §9):
//
//   lädt ....................... „Wird geladen …"
//   Fehler ohne Daten .......... „nicht abrufbar" + „Erneut versuchen" (ruft wirklich neu ab)
//   offline ohne Daten ......... ehrliche Offline-Auskunft + „Erneut versuchen"
//   Daten + gestörte Auffrischung  Daten BLEIBEN sichtbar, darüber der Stale-Hinweis mit Wiederholen
//   Daten ...................... der Inhalt
//
// Der Offline-Zustand wird reaktiv aus dem `onlineManager` gelesen (LEHREN 3037 R5, 3044 R2), nicht
// allein aus `fetchStatus === "paused"`.
import { AlertTriangle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { StaleMarker } from "../LoadState";
import { abfragelage, useIstOnline, wertBefund } from "./zeilenWert";

/** Die Minimalsicht auf eine react-query-Abfrage, die die Hülle braucht. */
export interface Abfrage<T> {
  data: T | undefined;
  isError: boolean;
  isFetching: boolean;
  fetchStatus: string;
  dataUpdatedAt: number;
  refetch: () => unknown;
}

/**
 * Der Fehlerzustand als eigenes Bauteil — EINE Fassung für alle Einstellungen.
 *
 * JOB 3065 R3 (BENs Korrekturpflicht 1: „sämtliche querygestützten Detailkarten an denselben
 * Zustandsvertrag"): Die Bereitschaft ist die einzige Karte mit einer GRUPPE von sechs Quellen; sie
 * kann die Hülle nicht verwenden, weil ihre Zeilen im Ladezustand einzeln „wird geladen" sagen
 * (mega2/mega3, von `readiness-loading-mounted` gepinnt). Ihren FEHLERZUSTAND teilt sie sich jetzt
 * aber mit allen anderen: derselbe Wortlaut, derselbe Ausweg.
 */
export function Fehlerbox({
  label,
  offline = false,
  onErneut,
}: {
  /**
   * JOB 3065 R4: Auf einer FLÄCHE (Konten) tritt die Box an die Stelle einer Zeile — dort sagt erst
   * das Label, WORÜBER die Auskunft geht. In einer Detailkarte trägt die Karte den Titel schon; dann
   * bleibt das Label weg, statt ihn zu wiederholen.
   */
  label?: string;
  offline?: boolean;
  onErneut: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      data-einst="abfrage-fehler"
      className="flex flex-wrap items-center gap-3 rounded-card border border-trust-crit-bg bg-trust-crit-bg px-3 py-2.5 text-[13px] text-trust-crit-text"
    >
      <AlertTriangle size={16} className="shrink-0" />
      {label === undefined ? null : (
        <span data-einst="label" className="font-semibold">
          {label}
        </span>
      )}
      <span className="flex-1">
        {offline ? t("einst.detail.offline") : t("einst.wert.nichtAbrufbar")}
      </span>
      <button
        type="button"
        onClick={onErneut}
        className="inline-flex items-center gap-1.5 rounded-btn border border-trust-crit-text/40 px-2.5 py-1 font-semibold hover:bg-trust-crit-text/10"
      >
        <RefreshCw size={13} />
        {t("loadstate.error.retry")}
      </button>
    </div>
  );
}

export function Abfragehuelle<T>({
  abfrage,
  children,
  testId,
}: {
  abfrage: Abfrage<T>;
  children: (daten: T) => ReactNode;
  testId?: string;
}): JSX.Element {
  const { t } = useTranslation();
  const online = useIstOnline();
  const befund = wertBefund(abfragelage(abfrage, online), null);
  const erneut = (): void => void abfrage.refetch();

  if (befund.art === "laedt") {
    return (
      <p data-einst="laedt" data-testid={testId} className="text-[12.5px] text-muted-2">
        {t("state.loading")}
      </p>
    );
  }
  if (befund.art === "fehler" || befund.art === "offline") {
    return (
      <div data-testid={testId}>
        <Fehlerbox offline={befund.art === "offline"} onErneut={erneut} />
      </div>
    );
  }
  // Daten sind da — sie bleiben SICHTBAR, auch wenn die Auffrischung scheitert oder ruht.
  return (
    <div data-testid={testId} className="space-y-4">
      {befund.nichtAktualisiert ? <StaleMarker onRetry={erneut} /> : null}
      {children(abfrage.data as T)}
    </div>
  );
}
