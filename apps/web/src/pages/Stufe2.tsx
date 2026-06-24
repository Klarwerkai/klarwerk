import { useTranslation } from "react-i18next";
import { useGraph } from "../api/hooks";
import { Card, PageHeader, QueryState } from "../components/ui";

function Stufe2Header({ titleKey, ticket }: { titleKey: string; ticket: string }): JSX.Element {
  const { t } = useTranslation();
  return (
    <PageHeader
      kicker={t("s2.kicker")}
      title={t(titleKey)}
      actions={
        <span className="rounded-pill bg-ai-surface-1 px-2.5 py-1 font-mono text-[11px] font-semibold text-ai">
          Stufe 2 · {ticket}
        </span>
      }
    />
  );
}

function Notice({ textKey }: { textKey: string }): JSX.Element {
  const { t } = useTranslation();
  return <Card className="border-dashed text-center text-sm text-muted">{t(textKey)}</Card>;
}

export function Output(): JSX.Element {
  return (
    <div className="mx-auto max-w-3xl">
      <Stufe2Header titleKey="nav.output" ticket="SCRUM-117" />
      <Notice textKey="s2.output" />
    </div>
  );
}

export function ImportReview(): JSX.Element {
  return (
    <div className="mx-auto max-w-3xl">
      <Stufe2Header titleKey="nav.import" ticket="SCRUM-116" />
      <Notice textKey="s2.import" />
    </div>
  );
}

export function Capital(): JSX.Element {
  return (
    <div className="mx-auto max-w-3xl">
      <Stufe2Header titleKey="nav.capital" ticket="SCRUM-120" />
      <Notice textKey="s2.capital" />
    </div>
  );
}

export function GraphView(): JSX.Element {
  const { t } = useTranslation();
  const query = useGraph();
  return (
    <div className="mx-auto max-w-3xl">
      <Stufe2Header titleKey="nav.graph" ticket="SCRUM-119" />
      <QueryState query={query} emptyText={t("s2.graphEmpty")}>
        {(g) => (
          <Card>
            <p className="mb-3 text-[13px] text-muted">
              {t("s2.graphCount", { nodes: g.nodes.length, edges: g.edges.length })}
            </p>
            <div className="space-y-1.5">
              {g.edges.slice(0, 30).map((e) => (
                <div
                  key={`${e.a}-${e.via}-${e.b}`}
                  className="flex items-center gap-2 font-mono text-[12px] text-text"
                >
                  <span className="truncate">{e.a}</span>
                  <span className="text-muted-2">—{e.via}→</span>
                  <span className="truncate">{e.b}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </QueryState>
    </div>
  );
}
