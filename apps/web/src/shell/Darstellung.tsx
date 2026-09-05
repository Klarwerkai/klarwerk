import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_DESIGN_THEME,
  DESIGN_THEMES,
  DESIGN_THEME_STORAGE_KEY,
  type DesignTheme,
  applyDesignTheme,
} from "../lib/designTheme";
import { usePersistentEnum } from "../lib/usePersistentValue";

// AUFTRAG-mega40 BLOCK B (Pedi 28.07.): der Design-Umschalter — ein ECHTER Button (kein Link,
// keine Navigation), sichtbar für ALLE Rollen. Er schaltet ausschließlich die Präsentationsebene
// (data-theme="modern" an <html>, s. lib/designTheme.ts) und merkt sich die Wahl je Browser über
// die bestehende fehlertolerante Speicher-Grenze (usePersistentEnum → safeLocalStorage: kaputter/
// verweigerter Speicher = Wahl lebt nur diese Sitzung, nie ein Absturz). Er läuft bewusst NICHT
// durch den NavGuard und setzt keinen Dirty-Zustand — er berührt keinen laufenden Entwurf.
//
// JOB 3060 · H1: der Umschalter verlässt die Kopfzeile. Sein Ort ist die Zeile „Darstellung" im
// Konto-Menü (der Auftrag nennt /profil als Endort; die Profilseite liegt bei JOB 3065, das auf
// diesen Auftrag wartet — bis dahin ist das Konto-Menü der EINE Bedienort, damit Klassisch wählbar
// bleibt). Vorgabe ist jetzt „Modern" (lib/designTheme.ts, DEFAULT_DESIGN_THEME).
export function DarstellungWahl(): JSX.Element {
  const { t } = useTranslation();
  const [theme, setTheme] = usePersistentEnum<DesignTheme>(
    DESIGN_THEME_STORAGE_KEY,
    DESIGN_THEMES,
    DEFAULT_DESIGN_THEME,
  );
  useEffect(() => {
    applyDesignTheme(theme);
  }, [theme]);
  const modern = theme === "modern";
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 text-[13px]">
      <span className="min-w-0 flex-1 truncate text-text">{t("menue.darstellung")}</span>
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={modern}
        aria-pressed={modern}
        onClick={() => setTheme(modern ? "classic" : "modern")}
        title={t("topbar.design.hint")}
        data-testid="konto-darstellung"
        className="shrink-0 rounded-btn border border-hairline px-2 py-0.5 text-[12px] font-medium text-muted hover:text-text"
      >
        {t(modern ? "topbar.design.modern" : "topbar.design.classic")}
      </button>
    </div>
  );
}
