import { Download } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useKos } from "../api/hooks";
import { ConfidenceBar, KnowledgeTypeTag, StatusPill } from "../components/trust";
import { Button, Card, PageHeader, QueryState } from "../components/ui";
import { deriveStatus } from "../lib/displayStatus";

export function Library(): JSX.Element {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const query = useKos(status ? { status } : undefined);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        kicker={t("lib.kicker")}
        title={t("nav.library")}
        actions={
          <a href="/api/library/export" className="inline-flex">
            <Button>
              <Download size={15} />
              {t("lib.export")}
            </Button>
          </a>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("lib.search")}
          className="h-10 flex-1 rounded-input border border-hairline bg-surface px-3 text-sm outline-none focus:border-ink/30"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-input border border-hairline bg-surface px-2 text-sm"
        >
          <option value="">{t("lib.allStatus")}</option>
          <option value="offen">{t("status.offen")}</option>
          <option value="validiert">{t("status.validiert")}</option>
        </select>
      </div>

      <QueryState query={query} emptyText={t("lib.empty")}>
        {(items) => (
          <Card className="p-0">
            <div className="divide-y divide-hairline">
              {items
                .filter((k) => k.title.toLowerCase().includes(q.toLowerCase()))
                .map((k) => (
                  <Link
                    key={k.id}
                    to={`/wissen/${k.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-hairline-soft"
                  >
                    <StatusPill status={deriveStatus(k)} />
                    <KnowledgeTypeTag type={k.type} />
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-text">
                      {k.title}
                    </span>
                    <span className="hidden font-mono text-[11px] text-muted-2 sm:block">
                      {k.category}
                    </span>
                    <div className="hidden sm:block">
                      <ConfidenceBar value={k.confidence} showLabel={false} />
                    </div>
                  </Link>
                ))}
            </div>
          </Card>
        )}
      </QueryState>
    </div>
  );
}
