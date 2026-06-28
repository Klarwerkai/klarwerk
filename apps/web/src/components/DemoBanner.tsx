import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { type DemoSurface, demoSurfaceBanner } from "../lib/demoPilotPath";

// SCRUM-291: kompakte, wiedererkennbare Demo-/Pilotpfad-Hinweisbox für eine Zielseite. Wird NUR
// gerendert, wenn die Seite den Demo-Kontext erkennt (Aufrufer gated via isDemoContext) — ohne
// Demo-Kontext bleibt die normale Nutzung unverändert. Reine Anzeige: Schrittnummer, „was hier zu
// sehen ist", optional „nächster Schritt" auf eine vorhandene Route. Keine Logik/kein Backend.
export function DemoBanner({ surface }: { surface: DemoSurface }): JSX.Element {
  const { t } = useTranslation();
  const banner = demoSurfaceBanner(surface);
  return (
    <div className="-mt-2 mb-4 rounded-card border border-dashed border-hairline bg-page p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink font-mono text-[10px] font-semibold text-white">
          {banner.n}
        </span>
        <span className="text-[12.5px] font-semibold text-ink">{t(banner.titleKey)}</span>
        <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
          {t("demo.banner.tag")}
        </span>
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-muted">{t(banner.bodyKey)}</p>
      {banner.next ? (
        <Link
          to={banner.next.to}
          className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-brand hover:underline"
        >
          {t(banner.next.labelKey)} <ArrowRight size={13} />
        </Link>
      ) : null}
    </div>
  );
}
