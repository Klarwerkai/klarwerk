import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Card, PageHeader } from "../components/ui";
import { HELP_TOPICS, type HelpSearchItem, filterHelpTopics } from "../lib/helpTopics";
import { PILOT_CHECKLIST } from "../lib/pilotChecklist";

// SCRUM-219: produktnahe Hilfe mit clientseitiger Suche über Titel/Text/Tags. Links nur auf
// echte App-Routen, ehrlicher Leerzustand. Kein Backend, keine KI-Suche, kein CMS.
export function Help(): JSX.Element {
  const { t } = useTranslation();
  const [q, setQ] = useState("");

  // i18n-Texte auflösen → durchsuchbare Items (DOM-freie Filterung im Helper).
  const items: (HelpSearchItem & { to: string })[] = HELP_TOPICS.map((topic) => ({
    id: topic.id,
    title: t(topic.titleKey),
    body: t(topic.bodyKey),
    tags: topic.tags,
    to: topic.to,
  }));
  const visible = filterHelpTopics(items, q);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader kicker={t("help.kicker")} title={t("nav.help")} />
      <p className="-mt-3 mb-4 text-sm text-muted">{t("help.intro")}</p>
      {/* SCRUM-305: kompakte Pilot-Checkliste für den ersten Nutzerlauf — ehrlich, Stage-1, nicht
          durchsuchbar (fixer Orientierungspunkt), stört die normale Hilfe-Suche nicht. */}
      <Card className="mb-5 border-dashed">
        <h2 className="text-[14px] font-semibold text-ink">{t("pilot.title")}</h2>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{t("pilot.subtitle")}</p>
        <ol className="mt-3 space-y-2">
          {PILOT_CHECKLIST.map((item) => (
            <li key={item.id} className="flex items-start gap-2.5">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink font-mono text-[10px] font-semibold text-white">
                {item.n}
              </span>
              <span className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-text">
                {t(item.labelKey)}
              </span>
              <Link
                to={item.to}
                className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-ai hover:opacity-80"
              >
                {t("help.openRoute")}
                <ArrowRight size={12} />
              </Link>
            </li>
          ))}
        </ol>
      </Card>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("help.search")}
        className="mb-5 h-10 w-full rounded-input border border-hairline bg-surface px-3 text-sm outline-none focus:border-ink/30"
      />
      {visible.length === 0 ? (
        <Card className="border-dashed text-center text-sm text-muted">{t("help.noResults")}</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map((topic) => (
            <Card key={topic.id} className="flex flex-col">
              <h3 className="text-[14px] font-semibold text-ink">{topic.title}</h3>
              <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-muted">{topic.body}</p>
              <div className="mt-2.5 flex flex-wrap gap-1">
                {topic.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-pill bg-hairline-soft px-1.5 py-0.5 font-mono text-[10px] text-muted-2"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <Link
                to={topic.to}
                className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-ai hover:opacity-80"
              >
                {t("help.openRoute")}
                <ArrowRight size={13} />
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
