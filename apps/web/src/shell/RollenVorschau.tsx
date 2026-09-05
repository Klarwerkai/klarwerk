import { useTranslation } from "react-i18next";
import { useRole } from "../app/RoleContext";
import { ROLES, type Role } from "../app/navigation";
import { MenueKopf } from "./Menue";

// ================================================================================================
// JOB 3060 · H1 — ROLLEN-VORSCHAU UND STUFE-2-HÄKCHEN, AUS DER SEITENLEISTE INS ZAHNRAD-MENÜ.
// ================================================================================================
//
// Bug (Pedi 04.07.): Ein Admin darf die ANSICHT als jede Rolle prüfen (Beta-Test); die echte
// Session bleibt Admin. Nicht-Admins sehen den Umschalter nicht (keine Rechte-Eskalation). Das
// Stufe-2-Häkchen schaltet die erweiterten Module frei (WP-SHIP9-S2, persistiert).
//
// DER ORT: der Auftrag nennt /admin Konten („Ansicht als Rolle", „Erweiterte Module") als Endort.
// Diese Seite baut JOB 3065, das auf diesen Auftrag WARTET (jobs/3065/zustand.json:
// `wartet_wegen: JOB 3060`). Solange sie nicht da ist, wäre ein Entfernen aus der Hülle ein
// Funktionsverlust — Pedi 04.09. 07:58: „Stelle 100 % sicher, dass wir keine Funktion verlieren."
// Deshalb steht beides hier, als Gruppe im Zahnrad-Menü; die Bedienung ist dieselbe wie zuvor.
export function RollenVorschau(): JSX.Element | null {
  const { t } = useTranslation();
  const { role, setRole, stufe2, setStufe2, canPreview, previewActive } = useRole();
  const showPreviewSwitch = canPreview;
  const showStufe2 = role === "admin";
  if (!showPreviewSwitch && !showStufe2) {
    return null;
  }
  return (
    <div data-testid="zahnrad-ansicht">
      {showPreviewSwitch ? (
        <>
          <MenueKopf>{t("role.viewAs")}</MenueKopf>
          {/* Sichtbarer Hinweis, dass die echte Rolle Admin bleibt — plus 1-Klick zurück. */}
          {previewActive ? (
            <div className="mx-2.5 mb-1.5 flex items-center justify-between gap-2 rounded-btn bg-trust-warn-bg px-2 py-1.5">
              <span className="text-[11px] leading-tight text-trust-warn-text">
                {t("role.previewNote", { role: t(`role.short.${role}`) })}
              </span>
              <button
                type="button"
                onClick={() => setRole("admin")}
                className="shrink-0 rounded-pill bg-surface px-2 py-0.5 text-[11px] font-semibold text-text hover:opacity-80"
              >
                {t("role.backToAdmin")}
              </button>
            </div>
          ) : null}
          <fieldset aria-label={t("role.viewAs")} className="grid grid-cols-4 gap-1 px-2.5">
            {ROLES.map((r: Role) => (
              <button
                key={r}
                type="button"
                role="menuitemradio"
                aria-checked={role === r}
                onClick={() => setRole(r)}
                className={`rounded-pill px-1 py-1 text-[11px] font-semibold transition-colors ${
                  role === r ? "bg-brand text-white" : "bg-hairline-soft text-muted hover:text-text"
                }`}
              >
                {t(`role.short.${r}`)}
              </button>
            ))}
          </fieldset>
        </>
      ) : null}
      {showStufe2 ? (
        // AUFTRAG-mega51 BLOCK G1: „Stufe 2" ist ein Hausbegriff — der Schalter trägt den
        // erklärenden Halbsatz als Tooltip.
        <label
          title={t("role.stage2Hint")}
          className="mt-1.5 flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-[13px] text-text"
        >
          <input
            type="checkbox"
            checked={stufe2}
            onChange={(e) => setStufe2(e.target.checked)}
            className="accent-brand"
          />
          <span>{t("role.stage2")}</span>
        </label>
      ) : null}
    </div>
  );
}
