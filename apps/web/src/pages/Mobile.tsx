import { Camera, ChevronRight, Mic, PencilLine, Search } from "lucide-react";
import { useTranslation } from "react-i18next";

// Mobile/PWA-Vorschau (BRIEF §6.19): erfassungs-first im Geräterahmen.
export function Mobile(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-[520px] place-items-center rounded-card bg-page p-6">
      <div className="w-[320px] overflow-hidden rounded-[34px] border-4 border-ink bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="font-sans text-[15px] font-bold tracking-[2px] text-ink">KLARWERK</span>
          <span className="flex items-center gap-1 font-mono text-[11px] text-trust-pos-text">
            <span className="h-1.5 w-1.5 rounded-full bg-trust-pos-fill" />
            online
          </span>
        </div>
        <h2 className="text-xl font-semibold text-ink">{t("mob.title")}</h2>
        <p className="mt-1 text-[13px] text-muted">{t("mob.sub")}</p>

        <button
          type="button"
          className="mt-4 flex w-full items-center gap-3 rounded-card bg-ink p-4 text-left text-white"
        >
          <span className="grid h-11 w-11 place-items-center rounded-btn bg-brand">
            <Mic size={20} />
          </span>
          <span>
            <span className="block text-[15px] font-semibold">{t("mob.dictate")}</span>
            <span className="block text-[12px] text-white/60">{t("mob.dictateSub")}</span>
          </span>
        </button>

        <div className="mt-3 grid grid-cols-2 gap-3">
          {[
            { icon: PencilLine, key: "note" },
            { icon: Camera, key: "photo" },
            { icon: ChevronRight, key: "interview" },
            { icon: Search, key: "lookup" },
          ].map(({ icon: Icon, key }) => (
            <div key={key} className="rounded-card border border-hairline p-3">
              <Icon size={18} className="text-ink" />
              <div className="mt-2 text-[13px] font-semibold text-text">{t(`mob.${key}`)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
