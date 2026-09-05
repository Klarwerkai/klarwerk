import { useTranslation } from "react-i18next";
import { KontoEintraege } from "./KontoMenue";
import { KopfbandPunkteListe } from "./KopfbandPunkte";
import { useMeldungenZustand } from "./Meldungen";
import { MenueKopf, MenueTrenner } from "./Menue";
import { ZahnradEintraege } from "./ZahnradMenue";

// ================================================================================================
// JOB 3060 · H1 — DER INHALT DES OFF-CANVAS-DRAWERS (≤ 899 px).
// ================================================================================================
//
// Bis hierher rendert der Drawer die Seitenleiste. Die gibt es nicht mehr; er zeigt jetzt dieselben
// Bausteine wie das Kopfband und seine Menüs: die fünf Punkte, die Einträge des Zahnrad-Menüs
// (mit „Weitere Bereiche" und ⌘K) und die des Konto-Menüs. Ein Bau, drei Orte — was auf dem
// Desktop erreichbar ist, ist es auch auf dem Telefon.
export function DrawerMenue({ onClose }: { onClose: () => void }): JSX.Element {
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
      <MenueKopf>{t("kopfband.menue")}</MenueKopf>
      <ZahnradEintraege onNavigiert={onClose} />
      <MenueTrenner />
      <MenueKopf>{t("kopfband.konto")}</MenueKopf>
      <KontoEintraege meldungen={meldungen} onNavigiert={onClose} />
    </div>
  );
}
