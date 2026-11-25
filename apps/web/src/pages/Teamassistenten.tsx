import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { teamFehler, teamassistenten } from "../api/teamassistenten";
import { TeamassistentenEditor } from "../components/teamassistenten/TeamassistentenEditor";
import { TeamassistentenNutzen } from "../components/teamassistenten/TeamassistentenNutzen";
import {
  kartenstil,
  teamDetailKey,
  teamListeKey,
  useTeamKontext,
  useTeamListe,
} from "../components/teamassistenten/teamKontext";
import { Button, PageHeader } from "../components/ui";

export function Teamassistenten() {
  const kontext = useTeamKontext();
  return <Arbeitsbereich key={kontext} kontext={kontext} />;
}

function Arbeitsbereich({ kontext }: { kontext: string }) {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const liste = useTeamListe(kontext);
  const cache = useQueryClient();
  const id = params.get("bearbeiten") ?? "";
  const neu = params.get("neu") === "1";
  const detail = useQuery({
    queryKey: teamDetailKey(kontext, id),
    queryFn: () => teamassistenten.detail(id),
    enabled: Boolean(id && kontext),
    gcTime: 0,
    retry: false,
  });
  const teams = liste.data?.teams ?? [];
  const erlaubte = teams.filter((team) => team.kannErstellen);
  const eigene = liste.data?.assistenten.filter((a) => a.bearbeitbar) ?? [];
  const normaleAnsicht = !id && !neu && !params.has("verwalten");
  const meldung = !kontext || liste.isError ? t(teamFehler(liste.error)) : "";
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        pageKey="teamassistenten"
        title={t("teamassistenten.titel")}
        lead={t("teamassistenten.einleitung")}
      />
      {meldung ? (
        <p role="alert">{meldung}</p>
      ) : !liste.data ? (
        <output>{t("teamassistenten.laden")}</output>
      ) : (
        <>
          {!id && !neu && (erlaubte.length > 0 || eigene.length > 0) ? (
            <nav className="flex gap-2" aria-label={t("teamassistenten.titel")}>
              <Button
                aria-pressed={normaleAnsicht}
                variant={normaleAnsicht ? "primary" : "outline"}
                onClick={() => setParams({})}
              >
                {t("teamassistenten.nutzen")}
              </Button>
              <Button
                aria-pressed={!normaleAnsicht}
                variant={!normaleAnsicht ? "primary" : "outline"}
                onClick={() => setParams({ verwalten: "1" })}
              >
                {t("teamassistenten.verwalten")}
              </Button>
            </nav>
          ) : null}
          {!normaleAnsicht && (id || neu) ? (
            <Button variant="ghost" onClick={() => setParams({ verwalten: "1" })}>
              <ChevronLeft aria-hidden size={15} />
              {t("teamassistenten.zurListe")}
            </Button>
          ) : null}
          {normaleAnsicht ? (
            <section className={kartenstil}>
              <TeamassistentenNutzen
                assistentId={params.get("assistent") ?? undefined}
                frage={params.get("frage") ?? undefined}
              />
            </section>
          ) : id || neu ? (
            id && detail.isError ? (
              <p role="alert">{t(teamFehler(detail.error))}</p>
            ) : id && !detail.data ? (
              <output>{t("teamassistenten.laden")}</output>
            ) : (id &&
                (!detail.data ||
                  !("definition" in detail.data) ||
                  !eigene.some((a) => a.id === id))) ||
              (neu && !erlaubte.length) ? (
              <p role="alert">{t("teamassistenten.zugang")}</p>
            ) : (
              <TeamassistentenEditor
                key={id || "neu"}
                kontext={kontext}
                teams={teams}
                aktuell={detail.data && "definition" in detail.data ? detail.data : undefined}
                nachBuchung={async (a) => {
                  cache.setQueryData(teamDetailKey(kontext, a.id), a);
                  await cache.invalidateQueries({ queryKey: teamListeKey(kontext) });
                  if (!id) setParams({ bearbeiten: a.id }, { replace: true });
                }}
                nachEntfernen={async () => {
                  cache.removeQueries({ queryKey: teamDetailKey(kontext, id), exact: true });
                  await cache.invalidateQueries({ queryKey: teamListeKey(kontext) });
                  setParams({ verwalten: "1" }, { replace: true });
                }}
                nachLaden={async () => {
                  const neu = await detail.refetch();
                  return neu.isSuccess && neu.data && "definition" in neu.data
                    ? neu.data
                    : undefined;
                }}
              />
            )
          ) : (
            <section className={kartenstil}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold">{t("teamassistenten.meine")}</h2>
                {erlaubte.length > 0 ? (
                  <Button
                    variant="primary"
                    data-testid="teamassistent-neu"
                    onClick={() => setParams({ neu: "1" })}
                  >
                    <Plus aria-hidden size={15} />
                    {t("teamassistenten.neu")}
                  </Button>
                ) : null}
              </div>
              {eigene.length ? (
                <ul className="divide-y divide-hairline">
                  {eigene.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                      <div>
                        <h3 className="font-medium">{a.name}</h3>
                        <p className="text-sm text-muted">
                          {teams.find((team) => team.id === a.teamId)?.name} ·{" "}
                          {a.aktiv === null
                            ? t("teamassistenten.privat")
                            : t("teamassistenten.aktiv", { version: a.aktiv })}
                        </p>
                      </div>
                      <Button
                        onClick={() => setParams({ bearbeiten: a.id })}
                        aria-label={t("teamassistenten.bearbeitenName", { name: a.name })}
                      >
                        {t("teamassistenten.bearbeiten")}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">{t("teamassistenten.keinEntwurf")}</p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
