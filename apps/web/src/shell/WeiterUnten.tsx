import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

// ================================================================================================
// AUFNAHME 20260922 · GESAMT-NAVIGATION (R-1045) — DIE LISTE ZEIGT, DASS ES UNTEN WEITERGEHT.
// ================================================================================================
//
// Anforderung (R-1045): „Die Seitenleiste verbirgt nicht mehr, dass unten weitere Einträge stehen,
// und Entwicklerschalter drücken ihr nicht die Höhe weg."
//
// Die Seitenleiste gibt es seit JOB 3060 nicht mehr. Ihre Rolle tragen heute zwei Listen, die
// länger sein können als das Fenster: der Off-Canvas-Drawer (≤ 899 px, also auch das Tablet hochkant)
// und die Übersicht „Arbeitsbereiche" im breiten Kopfband. Beide scrollen in sich — und beide
// schnitten den Rest bis hierher stumm an der Fensterkante ab. Wer die letzte sichtbare Zeile für
// die letzte hielt, fand „Konto", „Hilfe" oder die Verwaltung nicht.
//
// DER HINWEIS STEHT NUR, WENN ES STIMMT: er misst Scrollhöhe gegen sichtbare Höhe und Scrollstand
// des umgebenden Containers. Liegt nichts mehr darunter (alles passt, oder ganz nach unten
// gescrollt), steht nichts da — ein Hinweis, der immer steht, ist keiner.
//
// ER NIMMT KEINEN PLATZ UND KEINEN FOKUS: die Hülle ist 0 px hoch und klebt (`sticky`) am unteren
// Rand des Containers; der sichtbare Verlauf ragt von dort nach oben über die angeschnittene Zeile.
// Er ist `aria-hidden` und lässt Klicks durch — Vorlesewerkzeug und Tastatur gehen die Liste
// ohnehin Zeile für Zeile durch, die Fokusfalle des Drawers zählt keine neue Station.
//
// Die Entwicklerschalter (Rollenvorschau) stehen seit JOB 3060 IN derselben scrollenden Liste und
// nicht mehr als fester Block darunter; sie nehmen der Navigation damit keine Höhe weg. Gemessen in
// `tests/gesamt-navigation/tablet-chromium.test.ts`.

/** Ab so vielen Pixeln verdeckter Rest gilt „es geht weiter" — Rundung der Scrollwerte abgefangen. */
const SCHWELLE = 4;

/** Liegt unter der sichtbaren Kante dieses Containers noch Inhalt? */
export function weiterUnten(el: {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
}): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight > SCHWELLE;
}

/**
 * Der Hinweis „Weitere Einträge unten" — als LETZTES Kind in den scrollenden Container setzen.
 * Gemessen wird der Elternknoten; ein eigener Ref muss dafür nicht durchgereicht werden.
 */
export function WeiterUntenHinweis({ testid }: { testid?: string }): JSX.Element {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [sichtbar, setSichtbar] = useState(false);

  useLayoutEffect(() => {
    const container = ref.current?.parentElement;
    if (!container) {
      return undefined;
    }
    const messen = (): void => setSichtbar(weiterUnten(container));
    messen();
    container.addEventListener("scroll", messen, { passive: true });
    window.addEventListener("resize", messen);
    // Die Höhe ändert sich auch ohne Scrollen: ein Untermenü klappt auf, ein Zähler lädt nach.
    const groesse = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(messen);
    groesse?.observe(container);
    const inhalt = typeof MutationObserver === "undefined" ? null : new MutationObserver(messen);
    inhalt?.observe(container, { childList: true, subtree: true });
    return () => {
      container.removeEventListener("scroll", messen);
      window.removeEventListener("resize", messen);
      groesse?.disconnect();
      inhalt?.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-testid={testid}
      data-weiter-unten={sichtbar ? "ja" : "nein"}
      className="kw-weiter-unten pointer-events-none sticky bottom-0 h-0 shrink-0"
    >
      {sichtbar ? (
        <div className="absolute inset-x-0 bottom-0 flex h-10 items-end justify-center bg-gradient-to-t from-surface via-surface/90 to-surface/0 pb-1 text-[11.5px] font-semibold text-muted">
          <span>{t("navigation.weiterUnten")} ↓</span>
        </div>
      ) : null}
    </div>
  );
}
