import { AlertTriangle, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

// AUFTRAG-mega3 Block B (bens D9): EIN sichtbarer, übersetzter Fehlerzustand mit Wiederholen-Knopf für
// die zusammengehörigen Kennzahl-Gruppen (Start, Analytics, Bereitschaft). Ehrlich: ein dauerhaft
// gescheiterter Abruf zeigt „konnte nicht geladen werden" statt endlos „lädt" oder einer erfundenen 0.
export function LoadErrorState({ onRetry }: { onRetry: () => void }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-card border border-trust-crit-bg bg-trust-crit-bg px-3 py-2.5 text-[13px] text-trust-crit-text"
    >
      <AlertTriangle size={16} className="shrink-0" />
      <span className="flex-1">{t("loadstate.error.title")}</span>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-btn border border-trust-crit-text/40 px-2.5 py-1 font-semibold hover:bg-trust-crit-text/10"
      >
        <RefreshCw size={13} />
        {t("loadstate.error.retry")}
      </button>
    </div>
  );
}

// Stale/gestört: die Daten sind noch da (weiter angezeigt), aber ein Refetch scheiterte — sichtbar als
// veraltet markiert (NICHT in den Initialfehlerzustand gefallen). Optionaler Retry.
export function StaleMarker({ onRetry }: { onRetry?: () => void }): JSX.Element {
  const { t } = useTranslation();
  return (
    // <output> trägt implizit role="status" (biome useSemanticElements) — sichtbare Störungsmarkierung.
    <output className="flex flex-wrap items-center gap-2 rounded-btn bg-trust-warn-bg px-2.5 py-1.5 text-[11.5px] font-semibold text-trust-warn-text">
      <AlertTriangle size={13} className="shrink-0" />
      <span className="flex-1">{t("loadstate.stale")}</span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1 rounded-btn px-2 py-0.5 hover:bg-trust-warn-text/10"
        >
          <RefreshCw size={12} />
          {t("loadstate.error.retry")}
        </button>
      ) : null}
    </output>
  );
}

// ================================================================================================
// JOB 3808 — DER RUHENDE ABRUF IST KEIN GESCHEITERTER.
// ================================================================================================
// `StaleMarker` darüber sagt „Auffrischung fehlgeschlagen" und bietet einen Wiederholen-Knopf an.
// Ohne Netz sind BEIDE Hälften falsch. Die Begründung steht wörtlich in
// `components/start/forYou.ts:198-202`: „OHNE NETZ gibt es keinen gescheiterten Versuch, den man
// melden könnte: die Abfrage ruht." Und `forYou.ts:232-239` begründet die zweite Hälfte: ein Knopf,
// der nichts bewirken kann, solange das Netz fehlt, wäre eine Scheinfunktion (REGELN §7) — deshalb
// trägt dieses Bauteil KEINEN Knopf, und zwar nicht als optionale Eigenschaft, sondern gar nicht.
//
// KEIN NEUER WORTLAUT: die zwei Sätze sind die vorhandenen der Startseite (`forYou.ts:216-229`,
// `kollision.lage.pausiert` / `kollision.lage.pausiertOhneStand`, DE/EN/NL bereits vorhanden). Der
// Mensch liest über der Aufgabenliste denselben Satz, den ihm die Startseite in derselben Lage schon
// gibt.
//
// `hatStand` wird HINEINGEREICHT und nicht hier erraten: welche Werte sichtbar sind, weiß nur die
// Fläche. Die Bedeutung ist die des Vorbilds (`forYou.ts:212-215`): „stehen wirklich Werte von vorhin
// da" — nicht „es gab mal einen Abruf". Ohne sichtbaren Stand wäre „Stand von zuletzt" ein Verweis
// auf einen Stand, den der Mensch nirgends sieht.
export function PausedMarker({ hatStand }: { hatStand: boolean }): JSX.Element {
  const { t } = useTranslation();
  return (
    // Dieselbe Bauart wie `StaleMarker`: <output> (implizit role="status"), dasselbe Warn-Tokenpaar,
    // dasselbe Symbol- und Textmass — eine Störungsmarkierung sieht im Haus überall gleich aus.
    <output className="flex flex-wrap items-center gap-2 rounded-btn bg-trust-warn-bg px-2.5 py-1.5 text-[11.5px] font-semibold text-trust-warn-text">
      <AlertTriangle size={13} className="shrink-0" />
      <span className="flex-1">
        {t(hatStand ? "kollision.lage.pausiert" : "kollision.lage.pausiertOhneStand")}
      </span>
    </output>
  );
}
