import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { endpoints, type KoAction } from "../api/endpoints";
import { useKo } from "../api/hooks";
import { useRole } from "../app/RoleContext";
import {
  ConfidenceBar,
  KnowledgeTypeTag,
  ProvenanceLine,
  StatusPill,
} from "../components/trust";
import { Button, Card, PageHeader, QueryState, SectionLabel } from "../components/ui";
import { deriveStatus } from "../lib/displayStatus";

export function KnowledgeDetail(): JSX.Element {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const { role } = useRole();
  const query = useKo(id);
  const qc = useQueryClient();

  const act = useMutation({
    mutationFn: (body: KoAction) => endpoints.ko.act(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ko", id] });
      void qc.invalidateQueries({ queryKey: ["validation"] });
    },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader kicker={t("ko.kicker")} title={t("ko.title")} />
      <QueryState query={query}>
        {(ko) => (
          <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
            <Card>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={deriveStatus(ko)} />
                <KnowledgeTypeTag type={ko.type} />
                <span className="font-mono text-[11px] text-muted-2">
                  v{ko.version}
                  {ko.asset ? ` · ${ko.asset}` : ""}
                </span>
              </div>
              <h2 className="mt-3 text-xl font-semibold text-ink">{ko.title}</h2>
              <div className="mt-2">
                <ConfidenceBar value={ko.confidence} />
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <SectionLabel>{t("ko.statement")}</SectionLabel>
                  <p className="text-[14.5px] leading-relaxed text-text">{ko.statement}</p>
                </div>
                {ko.conditions.length > 0 ? (
                  <div>
                    <SectionLabel>{t("ko.conditions")}</SectionLabel>
                    <ul className="list-inside list-disc text-[13.5px] text-text">
                      {ko.conditions.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {ko.measures.length > 0 ? (
                  <div className="rounded-card bg-trust-pos-bg p-3">
                    <SectionLabel>{t("ko.measures")}</SectionLabel>
                    <ul className="list-inside list-disc text-[13.5px] text-trust-pos-text">
                      {ko.measures.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {ko.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {ko.tags.map((tag) => (
                      <span key={tag} className="rounded-pill bg-page px-2 py-0.5 font-mono text-[11px] text-muted">
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="mt-5 flex flex-wrap gap-2 border-t border-hairline pt-4">
                {role === "controller" || role === "admin" ? (
                  <Button variant="primary" disabled={act.isPending} onClick={() => act.mutate({ action: "rate", verdict: "up" })}>
                    {t("ko.validate")}
                  </Button>
                ) : null}
                <Button disabled={act.isPending} onClick={() => act.mutate({ action: "revalidate" })}>
                  {t("ko.stillValid")}
                </Button>
              </div>
            </Card>

            <div className="space-y-5">
              <Card>
                <SectionLabel>{t("ko.provenance")}</SectionLabel>
                <ProvenanceLine
                  author={ko.author}
                  originalAuthor={ko.originalAuthor}
                  domain={ko.category}
                  version={ko.version}
                />
              </Card>
              <Card>
                <SectionLabel>{t("ko.history")}</SectionLabel>
                <ol className="space-y-3">
                  {ko.history.map((h) => (
                    <li key={h.version} className="border-l-2 border-hairline pl-3">
                      <div className="font-mono text-[11px] text-muted-2">
                        v{h.version} · {new Date(h.at).toLocaleDateString()}
                      </div>
                      <div className="text-[12.5px] text-text">{h.note || h.author}</div>
                    </li>
                  ))}
                </ol>
              </Card>
            </div>
          </div>
        )}
      </QueryState>
    </div>
  );
}
