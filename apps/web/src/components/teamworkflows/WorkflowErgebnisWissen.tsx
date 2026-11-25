import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, FileCheck2, Quote } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import {
  type Lauf,
  type Wissensvorschlag,
  workflowFehler,
  workflows,
} from "../../api/teamworkflows";
import { zitatFragment } from "../../lib/belegstelle";
import { formatKoTimestamp } from "../../lib/koDates";
import { gespeicherteFassungHref } from "../../lib/objektbezug";
import { eingabestil } from "../teamassistenten/teamKontext";
import { Button, Field } from "../ui";

function Belege({ vorschlag, namen }: { vorschlag: Wissensvorschlag; namen: Lauf["namen"] }) {
  const { t, i18n } = useTranslation();
  const { quellen, beschluss } = vorschlag;
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 font-medium">
        <Quote size={15} aria-hidden />
        {t("workflows.wissen.quellen")}
      </p>
      <ul className="space-y-2">
        {beschluss ? (
          <li
            className="space-y-1 border-l-2 border-hairline pl-3"
            data-testid="workflow-wissen-beschluss"
          >
            <p className="font-medium">
              {t("workflows.wissen.beschluss", { titel: beschluss.titel })}
            </p>
            <blockquote className="whitespace-pre-line">{beschluss.auszug}</blockquote>
            <p className="text-xs text-muted">
              {namen?.[beschluss.person] ? `${namen[beschluss.person]} · ` : ""}
              <time dateTime={beschluss.am}>{formatKoTimestamp(beschluss.am, i18n.language)}</time>
            </p>
          </li>
        ) : null}
        {quellen.map((q) => (
          <li
            key={JSON.stringify([q.id, q.version, q.auszug])}
            className="space-y-1 border-l-2 border-hairline pl-3"
          >
            <a
              className="font-medium text-brand-text underline"
              target="_blank"
              rel="noreferrer"
              href={gespeicherteFassungHref(q.id, q.version) + zitatFragment(q.auszug)}
            >
              {t("workflows.nameVersion", { name: q.titel, v: q.version })}
              <span className="sr-only"> {t("workflows.wissen.neuerTab")}</span>
            </a>
            {q.auszug ? <blockquote className="whitespace-pre-line">{q.auszug}</blockquote> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

type Vorgangsbezug = { workflowId: string; laufId: string; ergebnisId: string; kontext: string };
function Vorschlagsansicht({
  workflowId,
  laufId,
  ergebnisId,
  kontext,
  v,
  namen,
}: Vorgangsbezug & { v: Wissensvorschlag; namen: Lauf["namen"] }) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const [offen, setOffen] = useState(false);
  const [titel, setTitel] = useState(v.titel);
  const [aussage, setAussage] = useState(v.aussage);
  const [grund, setGrund] = useState("");
  const [ablehnen, setAblehnen] = useState(false);
  const key = ["workflowwissen", kontext, workflowId, laufId, ergebnisId];
  const aktion = useMutation({
    mutationFn: (was: "senden" | "freigeben" | "ablehnen") =>
      was === "senden"
        ? workflows.vorschlagen(workflowId, laufId, ergebnisId, {
            titel: titel.trim(),
            aussage: aussage.trim(),
            stempel: v.stempel,
          })
        : workflows.beurteilen(workflowId, laufId, ergebnisId, {
            entscheidung: was,
            stempel: v.stempel,
            ...(was === "ablehnen" ? { grund: grund.trim() } : {}),
          }),
    onSuccess: async (daten) => {
      cache.setQueryData(key, daten);
      await cache.invalidateQueries({ queryKey: ["workflowwissen", kontext, "offen"] });
    },
    onError: async () => {
      await cache.invalidateQueries({ queryKey: key, exact: true });
    },
  });
  const pruefer = v.zustaendigName ?? t("workflows.rolle.verantwortlich");
  if (v.stand === "gesperrt")
    return (
      <p className="text-sm text-muted">
        {t(
          v.grund === "QUELLEN_FEHLEN"
            ? "workflows.wissen.ohneBeleg"
            : v.grund === "KEIN_PRUEFRECHT"
              ? "workflows.wissen.ohnePruefer"
              : "workflows.wissen.gesperrt",
        )}
      </p>
    );
  if (v.stand === "entwurf" && !v.kannVorschlagen)
    return <p className="text-sm text-muted">{t("workflows.wissen.keineFreigabe")}</p>;
  if (v.stand === "entwurf" && !offen)
    return (
      <Button onClick={() => setOffen(true)} data-testid="workflow-wissen-oeffnen">
        <BookOpen size={16} aria-hidden />
        {t("workflows.wissen.vorschlagen")}
      </Button>
    );

  return (
    <div
      className="space-y-4 rounded-input border border-hairline bg-page p-4 text-sm"
      data-testid="workflow-wissen-detail"
    >
      <output className="flex items-center gap-2 font-semibold">
        <FileCheck2 size={16} aria-hidden />
        {t(`workflows.wissen.stand.${v.stand}`)}
      </output>
      {v.stand === "entwurf" ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!aktion.isPending && titel.trim() && aussage.trim()) aktion.mutate("senden");
          }}
        >
          <p>{t("workflows.wissen.vorpruefung", { name: pruefer })}</p>
          <Field label={t("workflows.wissen.titel")}>
            <input
              required
              maxLength={150}
              className={eingabestil}
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              data-testid="workflow-wissen-titel"
            />
          </Field>
          <Field label={t("workflows.wissen.aussage")}>
            <textarea
              required
              maxLength={2000}
              rows={4}
              className={eingabestil}
              value={aussage}
              onChange={(e) => setAussage(e.target.value)}
              data-testid="workflow-wissen-aussage"
            />
          </Field>
          <Belege vorschlag={v} namen={namen} />
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="primary"
              disabled={!titel.trim() || !aussage.trim() || aktion.isPending}
              data-testid="workflow-wissen-senden"
            >
              {t("workflows.wissen.senden")}
            </Button>
            <Button
              disabled={aktion.isPending}
              variant="ghost"
              onClick={() => {
                setTitel(v.titel);
                setAussage(v.aussage);
                aktion.reset();
                setOffen(false);
              }}
            >
              {t("workflows.abbrechen")}
            </Button>
          </div>
        </form>
      ) : (
        <>
          <div className="space-y-1">
            <p className="font-medium">{v.titel}</p>
            <p className="whitespace-pre-line">{v.aussage}</p>
          </div>
          {v.stand === "vorgeschlagen" ? (
            <p className="text-muted">{t("workflows.zustaendig", { name: pruefer })}</p>
          ) : null}
          {v.stand === "abgelehnt" && v.grund ? (
            <p>
              {t("workflows.wissen.ablehnungsgrund")} · {v.grund}
            </p>
          ) : null}
          {v.quellen.length || v.beschluss ? <Belege vorschlag={v} namen={namen} /> : null}
          {v.stand === "freigegeben" && v.koId && v.koVersion ? (
            <Link
              className="inline-flex items-center gap-2 font-semibold text-brand-text underline"
              to={gespeicherteFassungHref(v.koId, v.koVersion)}
              data-testid="workflow-wissen-artikel"
            >
              <BookOpen aria-hidden size={16} />
              {t("workflows.wissen.artikel", { v: v.koVersion })}
            </Link>
          ) : null}
          {v.stand === "vorgeschlagen" && v.kannPruefen ? (
            <div className="space-y-3">
              {ablehnen ? (
                <>
                  <Field label={t("workflows.wissen.ablehnungsgrund")}>
                    <textarea
                      maxLength={1000}
                      rows={2}
                      className={eingabestil}
                      value={grund}
                      onChange={(e) => setGrund(e.target.value)}
                      data-testid="workflow-wissen-grund"
                    />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="danger"
                      disabled={!grund.trim() || aktion.isPending}
                      onClick={() => aktion.mutate("ablehnen")}
                      data-testid="workflow-wissen-ablehnen-bestaetigen"
                    >
                      {t("workflows.wissen.ablehnenBestaetigen")}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={aktion.isPending}
                      onClick={() => setAblehnen(false)}
                    >
                      {t("workflows.abbrechen")}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    disabled={aktion.isPending}
                    onClick={() => aktion.mutate("freigeben")}
                    data-testid="workflow-wissen-freigeben"
                  >
                    {t("workflows.wissen.freigeben")}
                  </Button>
                  <Button
                    disabled={aktion.isPending}
                    onClick={() => setAblehnen(true)}
                    data-testid="workflow-wissen-ablehnen"
                  >
                    {t("workflows.tun.ablehnen")}
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </>
      )}
      {aktion.isError ? <p role="alert">{t(workflowFehler(aktion.error))}</p> : null}
    </div>
  );
}

export function WorkflowErgebnisWissen({
  lauf,
  ergebnis,
  kontext,
}: { lauf: Lauf; ergebnis: Lauf["ergebnisse"][number]; kontext: string }) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const ref = useRef<HTMLDivElement>(null);
  const gezielt = params.get("ergebnis") === ergebnis.id;
  const q = useQuery({
    queryKey: ["workflowwissen", kontext, lauf.workflowId, lauf.id, ergebnis.id],
    queryFn: () => workflows.vorschlag(lauf.workflowId, lauf.id, ergebnis.id),
    gcTime: 0,
    refetchInterval: 15000,
    refetchOnWindowFocus: "always",
    retry: false,
  });
  const bereit = !!q.data || q.isError;
  useEffect(() => {
    if (gezielt && bereit) {
      ref.current?.focus({ preventScroll: true });
      ref.current?.scrollIntoView?.({ block: "center" });
    }
  }, [gezielt, bereit]);
  return (
    <div ref={ref} tabIndex={-1} aria-label={ergebnis.titel} data-testid="workflow-ergebnis-wissen">
      {q.isError ? (
        <div role="alert" className="space-y-2 text-sm">
          <p>{t(workflowFehler(q.error))}</p>
          <Button variant="ghost" onClick={() => void q.refetch()}>
            {t("workflows.aktualisieren")}
          </Button>
        </div>
      ) : q.data ? (
        <Vorschlagsansicht
          key={q.data.stand + q.data.stempel}
          v={q.data}
          namen={lauf.namen}
          kontext={kontext}
          workflowId={lauf.workflowId}
          laufId={lauf.id}
          ergebnisId={ergebnis.id}
        />
      ) : (
        <output className="text-sm text-muted">{t("workflows.laden")}</output>
      )}
    </div>
  );
}
