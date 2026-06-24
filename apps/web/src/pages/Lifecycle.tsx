import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { endpoints } from "../api/endpoints";
import { useLifecyclePending } from "../api/hooks";
import { StatusPill } from "../components/trust";
import { Button, Card, PageHeader, QueryState } from "../components/ui";

export function Lifecycle(): JSX.Element {
  const { t } = useTranslation();
  const query = useLifecyclePending();
  const qc = useQueryClient();
  const confirm = useMutation({
    mutationFn: (id: string) => endpoints.ko.act(id, { action: "revalidate" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["lifecycle"] }),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader kicker={t("lcy.kicker")} title={t("nav.lifecycle")} />
      <div className="mb-4 rounded-card border border-trust-warn-fill/30 bg-trust-warn-bg p-3 text-[13px] text-trust-warn-text">
        {t("lcy.banner")}
      </div>
      <QueryState query={query} emptyText={t("lcy.empty")}>
        {(ids) => (
          <div className="space-y-3">
            {ids.map((id) => (
              <Card key={id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1">
                    <StatusPill status="revalidierung" />
                  </div>
                  <Link
                    to={`/wissen/${id}`}
                    className="block truncate font-mono text-[13px] text-text hover:text-ink"
                  >
                    {id}
                  </Link>
                </div>
                <Button
                  variant="primary"
                  disabled={confirm.isPending}
                  onClick={() => confirm.mutate(id)}
                >
                  {t("lcy.stillValid")}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}
