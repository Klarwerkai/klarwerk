import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

type KlaraPathSurface = "start" | "capture" | "import";

export function KlaraPathTeaser({ surface }: { surface: KlaraPathSurface }): JSX.Element {
  const { t } = useTranslation();

  return (
    <aside
      // JOB 691 / D-021: die eine Marke, an der der Teaser belastbar gezaehlt wird. Eine Zaehlung
      // ueber Textfragmente waere eine Scheinmessung — sie traefe auch den Fliesstext daneben.
      // Ausschliesslich Testadressierbarkeit: Text, i18n-Schluessel, Layout und Verhalten bleiben
      // unveraendert.
      data-testid="klara-path-teaser"
      aria-label={t("klara.path.ariaLabel")}
      className="mb-5 rounded-card border border-ai/30 bg-ai/5 px-4 py-3.5"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ai/10 text-ai">
          <Sparkles size={18} aria-hidden="true" />
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-ai">
              {t("klara.path.kicker")}
            </span>
            <span className="rounded-pill border border-ai/25 bg-surface px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wide text-ai">
              {t("klara.path.soon")}
            </span>
          </div>
          <h2 className="mt-1 text-[15px] font-semibold text-ink">
            {t(`klara.path.${surface}.title`)}
          </h2>
          <p className="mt-0.5 max-w-2xl text-[12.5px] leading-relaxed text-muted">
            {t(`klara.path.${surface}.body`)}
          </p>
          {/* BASIC-338: Erklaerdropdown als natives details/summary — der einzige interaktive
              Teil des Teasers. Kein Link, kein Startknopf, keine CTA: die Vorschau bleibt
              `Demnaechst`. Der Text ist flaechenunabhaengig, alle drei Einbindungen erben ihn. */}
          <details className="mt-2">
            <summary className="w-fit cursor-pointer text-[12px] font-medium text-ai marker:text-ai/60">
              {t("klara.path.m365.summary")}
            </summary>
            <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-muted">
              {t("klara.path.m365.body")}
            </p>
          </details>
        </div>
      </div>
    </aside>
  );
}
