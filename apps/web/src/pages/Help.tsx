import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, PageHeader } from "../components/ui";

const TOPICS = ["capture", "validate", "ask", "conflict", "roles", "trust"] as const;

export function Help(): JSX.Element {
  const { t } = useTranslation();
  const [q, setQ] = useState("");

  const visible = TOPICS.filter((topic) => {
    const text = `${t(`help.${topic}.title`)} ${t(`help.${topic}.body`)}`.toLowerCase();
    return text.includes(q.toLowerCase());
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader kicker={t("help.kicker")} title={t("nav.help")} />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("help.search")}
        className="mb-5 h-10 w-full rounded-input border border-hairline bg-surface px-3 text-sm outline-none focus:border-ink/30"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {visible.map((topic) => (
          <Card key={topic}>
            <h3 className="text-[14px] font-semibold text-ink">{t(`help.${topic}.title`)}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
              {t(`help.${topic}.body`)}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
