import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { workflows } from "../../api/teamworkflows";
import { useSession } from "../../app/AuthContext";
import { useTeamKontext } from "../teamassistenten/teamKontext";

export function OffeneWorkflowVorschlaege() {
  const { t } = useTranslation();
  const { user } = useSession();
  const kontext = useTeamKontext();
  const darfPruefen = Boolean(kontext && (user?.role === "controller" || user?.role === "admin"));
  const q = useQuery({
    queryKey: ["workflowwissen", kontext, "offen"],
    queryFn: workflows.wissenspruefungen,
    enabled: darfPruefen,
    gcTime: 0,
    retry: false,
    refetchInterval: 30000,
    refetchOnWindowFocus: "always",
  });
  if (!darfPruefen) return null;
  if (q.isError)
    return (
      <output className="mb-2 block text-sm text-muted">
        {t("workflows.wissen.listeFehler")}{" "}
        <button className="underline" type="button" onClick={() => void q.refetch()}>
          {t("workflows.aktualisieren")}
        </button>
      </output>
    );
  if (!q.data?.vorschlaege.length) return null;
  return (
    <section
      className="mb-2 min-w-0 shrink-0 rounded-card border border-hairline bg-surface p-4"
      data-testid="workflow-wissenspruefungen"
    >
      <h2 className="font-semibold">{t("workflows.wissen.eingang")}</h2>
      <ul className="mt-2 max-h-48 divide-y divide-hairline overflow-y-auto">
        {q.data.vorschlaege.map((v) => (
          <li key={v.ergebnisId}>
            <Link
              className="flex items-center justify-between gap-3 py-2 text-sm font-medium text-brand-text hover:underline"
              to={`/teamworkflows?${new URLSearchParams({ workflow: v.workflowId, lauf: v.laufId, ergebnis: v.ergebnisId })}`}
            >
              <span className="break-words">{v.titel}</span>
              <ArrowRight size={16} aria-hidden className="shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
