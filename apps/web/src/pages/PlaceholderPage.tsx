import { useTranslation } from "react-i18next";
import type { NavItem } from "../app/navigation";

// Generischer Platzhalter je Route. Die echten Screens entstehen in #64 ff.
// Zeigt Titel, §-Bezug und Screenshot-Referenz aus dem Design-Handoff.
export function PlaceholderPage({ item }: { item: NavItem }): JSX.Element {
  const { t } = useTranslation();
  const Icon = item.icon;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="font-mono text-micro uppercase text-muted-2">{item.path}</div>
      <h1 className="mt-1 flex items-center gap-2.5 text-2xl font-semibold text-ink">
        <Icon size={22} strokeWidth={2} />
        {t(item.labelKey)}
        {item.stufe2 ? (
          <span className="rounded-pill bg-ai-surface-1 px-2 py-0.5 font-mono text-[11px] font-semibold text-ai">
            Stufe 2
          </span>
        ) : null}
      </h1>
      <div className="mt-6 rounded-card border border-dashed border-hairline bg-surface p-10 text-center">
        <p className="text-sm text-muted">{t("page.placeholder")}</p>
        <p className="mt-2 font-mono text-[12px] text-muted-2">
          Design: §{item.section} · screenshots/{item.shot}-screen.png
        </p>
      </div>
    </div>
  );
}
