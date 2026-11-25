import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, CircleHelp, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TeamLauf } from "../../api/teamassistenten";
import { teamFehler, teamassistenten } from "../../api/teamassistenten";
import { zitatFragment } from "../../lib/belegstelle";
import { gespeicherteFassungHref } from "../../lib/objektbezug";
import { Button, Field } from "../ui";
import { eingabestil, useTeamKontext, useTeamListe } from "./teamKontext";

type Auswahl = { assistentId?: string | undefined; frage?: string | undefined };

export function TeamassistentenNutzen(props: Auswahl) {
  const kontext = useTeamKontext();
  const { i18n } = useTranslation();
  return (
    <Nutzung
      key={JSON.stringify([kontext, props.assistentId, props.frage, i18n.language])}
      {...props}
      kontext={kontext}
    />
  );
}

function Nutzung({ assistentId, frage, kontext }: Auswahl & { kontext: string }) {
  const { t } = useTranslation();
  const liste = useTeamListe(kontext);
  const [wahl, setWahl] = useState(assistentId ?? "");
  if (!kontext || liste.isError) return <p role="alert">{t(teamFehler(liste.error))}</p>;
  if (!liste.data) return <output>{t("teamassistenten.laden")}</output>;
  const aktiv = liste.data.assistenten.filter((a) => a.nutzbar && a.aktiv !== null);
  if (!aktiv.length)
    return <p className="text-sm text-muted">{t("teamassistenten.keinAktiver")}</p>;
  const auswahl = wahl || (aktiv.length === 1 ? aktiv[0]?.id : "");
  const ausgesucht = aktiv.find((a) => a.id === auswahl);
  const teamName = (id: string) => liste.data.teams.find((team) => team.id === id)?.name;
  return (
    <div className="space-y-4" data-testid="teamassistenten-nutzen">
      <Field label={t("teamassistenten.auswahl")}>
        <select
          className={eingabestil}
          data-testid="teamassistent-auswahl"
          value={ausgesucht?.id ?? ""}
          onChange={(e) => setWahl(e.target.value)}
        >
          <option value="">{t("teamassistenten.waehlen")}</option>
          {aktiv.map((a) => (
            <option key={a.id} value={a.id}>
              {a.aktivName} · {teamName(a.teamId)} ·{" "}
              {t("teamassistenten.version", { version: a.aktiv })}
            </option>
          ))}
        </select>
      </Field>
      {wahl && !ausgesucht ? <output>{t("teamassistenten.zugang")}</output> : null}
      {ausgesucht && ausgesucht.aktiv !== null ? (
        <Frage
          key={JSON.stringify([ausgesucht.id, ausgesucht.aktiv])}
          id={ausgesucht.id}
          version={ausgesucht.aktiv}
          start={frage ?? ""}
          aktualisieren={() => void liste.refetch()}
        />
      ) : null}
    </div>
  );
}

function Frage({
  id,
  version,
  start,
  aktualisieren,
}: { id: string; version: number; start: string; aktualisieren: () => void }) {
  const { t, i18n } = useTranslation();
  const [frage, setFrage] = useState(start);
  const lauf = useMutation({
    mutationFn: () => teamassistenten.fragen(id, version, frage.trim(), i18n.language),
    onError: aktualisieren,
  });
  return (
    <div className="space-y-4">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (frage.trim() && !lauf.isPending) lauf.mutate();
        }}
      >
        <Field label={t("teamassistenten.frage")}>
          <textarea
            className={eingabestil}
            rows={3}
            maxLength={1000}
            data-testid="teamassistent-frage"
            required
            value={frage}
            disabled={lauf.isPending}
            placeholder={t("teamassistenten.frageHinweis")}
            onChange={(e) => {
              setFrage(e.target.value);
              lauf.reset();
            }}
          />
        </Field>
        <Button
          type="submit"
          variant="primary"
          data-testid="teamassistent-senden"
          disabled={!frage.trim() || lauf.isPending}
        >
          {t(lauf.isPending ? "teamassistenten.antwortet" : "teamassistenten.fragen")}
        </Button>
      </form>
      {lauf.isError ? <p role="alert">{t(teamFehler(lauf.error))}</p> : null}
      {lauf.isSuccess ? <Ergebnis lauf={lauf.data} /> : null}
    </div>
  );
}

function Ergebnis({ lauf }: { lauf: TeamLauf }) {
  const { t } = useTranslation();
  const { stand, text, quellen } = lauf.antwort;
  const Standzeichen = { belegt: CheckCircle2, widerspruch: TriangleAlert, offen: CircleHelp }[
    stand
  ];
  const farbe = {
    belegt: "text-trust-ok-text",
    widerspruch: "text-trust-crit-text",
    offen: "text-muted",
  }[stand];
  return (
    <div
      aria-live="polite"
      data-testid="teamassistent-antwort"
      className="space-y-3 border-t border-hairline pt-4"
    >
      <h3 className={`flex items-center gap-2 font-semibold ${farbe}`}>
        <Standzeichen size={17} aria-hidden="true" />
        {t(`teamassistenten.${stand}`)}
      </h3>
      <p className="whitespace-pre-line text-sm leading-relaxed">{text}</p>
      {quellen.map((q) => (
        <div key={q.id} className="space-y-1 border-l-2 border-hairline pl-3 text-sm">
          <a
            href={gespeicherteFassungHref(q.id, q.version) + zitatFragment(q.auszug)}
            className="font-semibold text-brand-text underline underline-offset-2"
          >
            {q.titel} · {t("teamassistenten.version", { version: q.version })}
          </a>
          <blockquote className="text-muted">{q.auszug}</blockquote>
        </div>
      ))}
      <p className="text-xs text-muted">
        {t("teamassistenten.beantwortetMit", { version: lauf.version })}
      </p>
    </div>
  );
}
