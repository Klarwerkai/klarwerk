import { useTranslation } from "react-i18next";
import { ArbeitsbereicheEintraege } from "./ArbeitsbereicheMenue";
import { KontoEintraege } from "./KontoMenue";
import { KopfbandPunkteListe } from "./KopfbandPunkte";
import { useMeldungenZustand } from "./Meldungen";
import { MenueKopf, MenueTrenner } from "./Menue";
import { WeiterUntenHinweis } from "./WeiterUnten";
import { ZahnradEintraege } from "./ZahnradMenue";

// ================================================================================================
// JOB 3060 · H1 — DER INHALT DES OFF-CANVAS-DRAWERS (≤ 899 px).
// ================================================================================================
//
// Bis hierher rendert der Drawer die Seitenleiste. Die gibt es nicht mehr; er zeigt jetzt dieselben
// Bausteine wie das Kopfband und seine Menüs: die fünf Punkte, die Einträge des Zahnrad-Menüs
// (mit „Weitere Bereiche" und ⌘K) und die des Konto-Menüs. Ein Bau, drei Orte — was auf dem
// Desktop erreichbar ist, ist es auch auf dem Telefon.
//
// FE-002: die Abschnitte tragen dieselben Namen wie ihre Griffe im breiten Kopfband —
// Hauptnavigation, Arbeitsbereiche (mit „Seite finden … ⌘K"), Einstellungen und Hilfe, Konto.
// Die weiteren Seiten stehen hier offen, nicht mehr eingeklappt unter „Bereiche".
export function DrawerMenue({
  onClose,
  rueckweg,
}: {
  onClose: () => void;
  /** Der Auslöser des Drawers — Rückweg des Fokus nach „Seite finden" (FE-002). */
  rueckweg?: (() => HTMLElement | null) | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const meldungen = useMeldungenZustand();
  return (
    <div
      role="menu"
      aria-label={t("topbar.menuLabel")}
      className="kw-drawer flex h-full flex-col overflow-y-auto bg-surface px-2 pb-4 pt-12 text-text"
    >
      <MenueKopf>{t("kopfband.navigation")}</MenueKopf>
      <KopfbandPunkteListe />
      <MenueTrenner />
      <MenueKopf>{t("fe002.arbeitsbereiche")}</MenueKopf>
      <ArbeitsbereicheEintraege onSchnellzugriff={onClose} rueckweg={rueckweg} />
      <MenueTrenner />
      <MenueKopf>{t("fe002.einstellungen")}</MenueKopf>
      <ZahnradEintraege />
      <MenueTrenner />
      <MenueKopf>{t("kopfband.konto")}</MenueKopf>
      <KontoEintraege meldungen={meldungen} onNavigiert={onClose} />
      {/* Gesamt-Navigation (R-1045): die Liste ist auf dem Tablet hochkant länger als das Fenster. */}
      <WeiterUntenHinweis testid="drawer-weiter-unten" />
    </div>
  );
}
