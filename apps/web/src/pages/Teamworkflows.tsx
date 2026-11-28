import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { type Entwurf, workflowFehler, workflows } from "../api/teamworkflows";
import { kartenstil, useTeamKontext } from "../components/teamassistenten/teamKontext";
import { OffeneWorkflowVorschlaege } from "../components/teamworkflows/OffeneWorkflowVorschlaege";
import { WorkflowEditor } from "../components/teamworkflows/WorkflowEditor";
import { WorkflowLaeufe, WorkflowVorgang } from "../components/teamworkflows/WorkflowLaeufe";
import { Button, PageHeader } from "../components/ui";

export function Teamworkflows() {
  const kontext = useTeamKontext();
  return <Arbeitsort key={kontext} kontext={kontext} />;
}

function Arbeitsort({ kontext }: { kontext: string }) {
  const { t } = useTranslation();
  const [p, navigate] = useSearchParams();
  const cache = useQueryClient();
  const editId = p.get("bearbeiten") ?? "";
  const workflowId = p.get("workflow") ?? "";
  const laufId = p.get("lauf") ?? "";
  const neu = p.has("neu");
  const manage = p.has("verwalten");
  const id = editId || workflowId;
  const queryOptionen = { retry: false, gcTime: 0, refetchOnWindowFocus: "always" as const };
  const listeKey = ["workflows", kontext, "liste"];
  const liste = useQuery({
    ...queryOptionen,
    queryKey: listeKey,
    queryFn: workflows.liste,
    enabled: !!kontext,
  });
  const detailKey = ["workflows", kontext, id, "detail"];
  const detail = useQuery({
    ...queryOptionen,
    queryKey: detailKey,
    queryFn: () => workflows.detail(id),
    enabled: !!kontext && !!id,
  });
  const d = detail.data;
  const teams = liste.data?.teams ?? [];
  const eintraege = liste.data?.workflows ?? [];
  const darfAnlegen = teams.some((x) => x.kannErstellen);
  const kannVerwalten = darfAnlegen || eintraege.some((x) => x.bearbeitbar);
  const karte = eintraege.find((x) => x.id === id);
  const sichtbar = eintraege.filter((x) =>
    manage ? x.bearbeitbar : x.nutzbar && x.aktiv !== null,
  );
  const zurListe = () =>
    navigate(manage || editId || neu ? { verwalten: "1" } : laufId ? { workflow: workflowId } : {});
  async function aktualisiere(e: Entwurf) {
    cache.setQueryData(["workflows", kontext, e.id, "detail"], e);
    await cache.invalidateQueries({ queryKey: listeKey });
    if (neu) navigate({ bearbeiten: e.id }, { replace: true });
  }
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader pageKey="teamworkflows" title={t("workflows.titel")} lead={t("workflows.lead")} />
      {neu || id ? (
        <Button variant="ghost" onClick={zurListe}>
          <ArrowLeft aria-hidden size={15} />
          {t(laufId ? "workflows.zumWorkflow" : "workflows.zurListe")}
        </Button>
      ) : null}
      {!kontext || liste.isError ? (
        <p role="alert">{t(workflowFehler(liste.error))}</p>
      ) : !liste.data ? (
        <output>{t("workflows.laden")}</output>
      ) : id && detail.isError ? (
        <p role="alert">{t(workflowFehler(detail.error))}</p>
      ) : id && !d ? (
        <output>{t("workflows.laden")}</output>
      ) : neu || editId ? (
        (neu && !darfAnlegen) || (editId && (!karte?.bearbeitbar || !d || !("definition" in d))) ? (
          <p role="alert">{t("workflows.keinZugang")}</p>
        ) : (
          <WorkflowEditor
            key={id || "neu"}
            basis={editId && d && "definition" in d ? d : undefined}
            teams={teams}
            kontext={kontext}
            aktualisiere={aktualisiere}
            neuLaden={async () => {
              const gesehen = await detail.refetch();
              return gesehen.isSuccess && gesehen.data && "definition" in gesehen.data
                ? gesehen.data
                : undefined;
            }}
            entfernt={async () => {
              cache.removeQueries({ queryKey: detailKey, exact: true });
              await cache.invalidateQueries({ queryKey: listeKey });
              navigate({ verwalten: "1" }, { replace: true });
            }}
          />
        )
      ) : workflowId && d ? (
        !karte?.nutzbar || karte.aktiv === null ? (
          <p role="alert">{t("workflows.keinZugang")}</p>
        ) : laufId ? (
          <WorkflowVorgang
            key={[workflowId, laufId].join("/")}
            kontext={kontext}
            workflow={d}
            laufId={laufId}
          />
        ) : (
          <WorkflowLaeufe
            key={[workflowId, d.aktiv].join("/")}
            kontext={kontext}
            workflow={d}
            oeffnen={(l) => navigate({ workflow: workflowId, lauf: l })}
          />
        )
      ) : (
        <>
          {kannVerwalten ? (
            <nav aria-label={t("workflows.titel")} className="flex flex-wrap gap-2">
              <Button
                variant={!manage ? "primary" : "outline"}
                aria-pressed={!manage}
                onClick={() => navigate({})}
              >
                {t("workflows.nutzen")}
              </Button>
              <Button
                variant={manage ? "primary" : "outline"}
                aria-pressed={manage}
                onClick={() => navigate({ verwalten: "1" })}
              >
                {t("workflows.verwalten")}
              </Button>
            </nav>
          ) : null}
          <OffeneWorkflowVorschlaege />
          <section className={kartenstil}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">
                {t(manage ? "workflows.eigene" : "workflows.fuerTeam")}
              </h2>
              {manage && darfAnlegen ? (
                <Button variant="primary" onClick={() => navigate({ neu: "1" })}>
                  <Plus aria-hidden size={15} />
                  {t("workflows.erstellen")}
                </Button>
              ) : null}
            </div>
            {!sichtbar.length ? (
              <p className="text-sm text-muted">
                {t(manage ? "workflows.leereEntwuerfe" : "workflows.leereFreigaben")}
              </p>
            ) : (
              <ul className="divide-y divide-hairline">
                {sichtbar.map((x) => (
                  <li key={x.id}>
                    <button
                      type="button"
                      data-testid="teamworkflow-eintrag"
                      className="flex w-full items-center justify-between gap-3 py-3 text-left"
                      onClick={() => navigate(manage ? { bearbeiten: x.id } : { workflow: x.id })}
                    >
                      <span>
                        <span className="block font-medium">
                          {manage ? x.name : x.aktivName || x.name}
                        </span>
                        <span className="text-sm text-muted">
                          {teams.find((a) => a.id === x.teamId)?.name} ·{" "}
                          {x.aktiv === null
                            ? t("workflows.privat")
                            : t("workflows.aktiv", { v: x.aktiv })}
                        </span>
                      </span>
                      <ChevronRight aria-hidden size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
