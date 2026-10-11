import { useMutation } from "@tanstack/react-query";
import { History } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { endpoints } from "../../api/endpoints";
import type { AnswerResult, VergleichsQuelle, WissensstandVergleich } from "../../api/types";
import { formatKoTimestamp } from "../../lib/koDates";
import { koHistoryNote } from "../../lib/koHistoryNote";
import { toReasonerLocale } from "../../lib/reasonerLocale";
import { AiCostHint } from "../AiCostHint";
import { AiGeneratedNotice } from "../AiGeneratedNotice";
import { AntwortText } from "../start/AntwortText";

// ================================================================================================
// R-1630 / R-2176 — „DIESE FRAGE HÄTTE VOR EINEM JAHR EINE ANDERE ANTWORT GEHABT."
// ================================================================================================
//
// Auf Wunsch, nicht bei jeder Frage: der Vergleich kostet zwei Antwortläufe. Er zeigt die Antwort,
// die der Wissensstand zum Stichtag ergeben hätte, neben der heutigen, und je Quelle den belegten
// Grund des Unterschieds (neu, überarbeitet, Freigabe). Die Regeln stehen am Dienst
// (`services/ask/src/wissensstand-vergleich.ts`); diese Fläche zeigt, was der Server schickt, und
// sagt dazu, was der Vergleich NICHT kann.

/** Der Tag ein Jahr vor heute als `JJJJ-MM-TT` — die Vorgabe des Datumsfelds. */
export function tagVorEinemJahr(jetzt: Date): string {
  const tag = new Date(
    Date.UTC(jetzt.getUTCFullYear() - 1, jetzt.getUTCMonth(), jetzt.getUTCDate()),
  );
  return tag.toISOString().slice(0, 10);
}

/** Gestern als `JJJJ-MM-TT` — der späteste Stichtag, den der Server annimmt. */
function gestern(jetzt: Date): string {
  return new Date(jetzt.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Die Stellen der tragenden Quellen (1-basiert) — `undefined`, wenn die Zuordnung unbekannt ist. */
function tragendeStellen(result: AnswerResult): number[] | undefined {
  const getragen = result.citedSources ?? [];
  if (getragen.length === 0) {
    return undefined;
  }
  return getragen.map((id) => result.sources.indexOf(id) + 1).filter((n) => n > 0);
}

function Antwortspalte({
  titel,
  result,
  testid,
}: {
  titel: string;
  result: AnswerResult;
  testid: string;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div data-testid={testid} className="rounded-[10px] border border-hairline bg-surface p-3">
      <p className="text-[11.5px] font-medium text-muted-2">{titel}</p>
      {result.answered && result.answer ? (
        <AntwortText
          text={result.answer}
          quellen={result.sources.length}
          tragend={tragendeStellen(result)}
          className="mt-1 text-sm text-text"
        />
      ) : (
        <p className="mt-1 text-sm text-muted">{t("antwortvergleich.keineGrundlage")}</p>
      )}
    </div>
  );
}

function Quellenzeile({
  quelle,
  wissenHref,
}: {
  quelle: VergleichsQuelle;
  wissenHref: (id: string) => string;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  return (
    <li
      data-testid="ask-vergleich-quelle"
      className="border-t border-hairline-soft pt-2 text-[13px]"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Link
          to={wissenHref(quelle.id)}
          className="font-medium text-text underline decoration-hairline underline-offset-2 hover:decoration-ink"
        >
          {quelle.title}
        </Link>
        {quelle.gruende.map((grund) => (
          <span
            key={grund}
            data-testid={`ask-vergleich-grund-${grund}`}
            className="rounded-pill bg-hairline-soft px-2 py-0.5 text-[11px] text-muted"
          >
            {t(`antwortvergleich.grund.${grund}`, {
              damals: quelle.versionDamals ?? "–",
              heute: quelle.versionHeute,
            })}
          </span>
        ))}
      </div>
      <p className="mt-0.5 text-[11.5px] text-muted-2">
        {t("antwortvergleich.verwendung", {
          damals: quelle.inAntwortDamals ? t("antwortvergleich.ja") : t("antwortvergleich.nein"),
          heute: quelle.inAntwortHeute ? t("antwortvergleich.ja") : t("antwortvergleich.nein"),
        })}
      </p>
      {quelle.titelDamals ? (
        <p className="mt-1 text-[12px] text-muted">
          {t("antwortvergleich.titelDamals", { titel: quelle.titelDamals })}
        </p>
      ) : null}
      {quelle.aussageDamals !== null && quelle.aussageHeute !== null ? (
        <div className="mt-1 grid gap-1 text-[12px] sm:grid-cols-2">
          <p data-testid="ask-vergleich-aussage-damals" className="text-muted">
            <span className="font-medium">{t("antwortvergleich.aussageDamals")}</span>{" "}
            {quelle.aussageDamals}
          </p>
          <p data-testid="ask-vergleich-aussage-heute" className="text-text">
            <span className="font-medium">{t("antwortvergleich.aussageHeute")}</span>{" "}
            {quelle.aussageHeute}
          </p>
        </div>
      ) : null}
      {quelle.aenderungen.length > 0 ? (
        <ul className="mt-1 space-y-0.5 text-[11.5px] text-muted-2">
          {quelle.aenderungen.map((a) => (
            <li key={`${a.version}-${a.at}`}>
              {t("antwortvergleich.aenderung", {
                version: a.version,
                zeit: formatKoTimestamp(a.at, i18n.language) ?? a.at,
                vermerk: koHistoryNote(a.note, t) ?? "",
              })}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function WissensstandVergleichAnzeige({
  vergleich,
  wissenHref,
}: {
  vergleich: WissensstandVergleich;
  wissenHref: (id: string) => string;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const datum = new Date(vergleich.stichtag).toLocaleDateString(i18n.language, {
    timeZone: "UTC",
  });
  return (
    <div data-testid="ask-vergleich-ergebnis" className="mt-3 space-y-3">
      <p data-testid="ask-vergleich-befund" className="text-sm font-semibold text-text">
        {vergleich.antwortGeaendert
          ? t("antwortvergleich.anders", { datum })
          : t("antwortvergleich.gleich", { datum })}
      </p>
      <div className="grid gap-2 md:grid-cols-2">
        <Antwortspalte
          titel={t("antwortvergleich.damals", { datum })}
          result={vergleich.damals}
          testid="ask-vergleich-damals"
        />
        <Antwortspalte
          titel={t("antwortvergleich.heute")}
          result={vergleich.heute}
          testid="ask-vergleich-heute"
        />
      </div>
      <AiGeneratedNotice />
      {vergleich.quellen.length > 0 ? (
        <div>
          <p className="text-[12px] font-medium text-muted-2">{t("antwortvergleich.warum")}</p>
          <ul className="mt-1 space-y-2">
            {vergleich.quellen.map((quelle) => (
              <Quellenzeile key={quelle.id} quelle={quelle} wissenHref={wissenHref} />
            ))}
          </ul>
        </div>
      ) : null}
      <p data-testid="ask-vergleich-grenzen" className="text-[11.5px] text-muted-2">
        {t("antwortvergleich.grenzen")}
      </p>
    </div>
  );
}

/**
 * Der Vergleich zur zuletzt gestellten Frage. `frage` ist die Frage, zu der die Antwort darüber
 * gehört — nicht der Inhalt des Eingabefelds, der inzwischen ein anderer sein kann.
 */
export function WissensstandVergleichBereich({
  frage,
  billable,
  wissenHref,
}: {
  frage: string;
  billable: boolean | undefined;
  wissenHref: (id: string) => string;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const [jetzt] = useState(() => new Date());
  const [stichtag, setStichtag] = useState(() => tagVorEinemJahr(jetzt));
  const vergleich = useMutation({
    mutationFn: () =>
      endpoints.ask.vergleich(frage, toReasonerLocale(i18n.language), stichtag || undefined),
  });
  // Ein Ergebnis gehört zu genau einer Frage und einem Stichtag. Ändert sich eines davon, ist das
  // angezeigte Ergebnis nicht mehr die Antwort auf das, was jetzt dasteht.
  const [ergebnisFuer, setErgebnisFuer] = useState<string | null>(null);
  const schluessel = `${frage}\u0000${stichtag}`;
  const aktuell = vergleich.data && ergebnisFuer === schluessel ? vergleich.data : null;
  return (
    <section
      data-testid="ask-vergleich"
      aria-labelledby="ask-vergleich-titel"
      className="print-hide basis-full rounded-[10px] border border-hairline bg-surface p-3"
    >
      <p id="ask-vergleich-titel" className="text-[13px] font-semibold text-text">
        {t("antwortvergleich.titel")}
      </p>
      <p className="mt-0.5 text-[12px] text-muted">{t("antwortvergleich.erklaerung")}</p>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-[11.5px] text-muted-2">
          {t("antwortvergleich.stichtag")}
          <input
            type="date"
            data-testid="ask-vergleich-stichtag"
            value={stichtag}
            max={gestern(jetzt)}
            onChange={(e) => setStichtag(e.target.value)}
            className="mt-0.5 rounded-[8px] border border-hairline bg-surface px-2 py-1 text-[13px] text-text"
          />
        </label>
        <button
          type="button"
          data-testid="ask-vergleich-start"
          disabled={vergleich.isPending || frage.trim().length === 0}
          onClick={() => {
            setErgebnisFuer(schluessel);
            vergleich.mutate();
          }}
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-hairline bg-surface px-4 py-2 text-[14px] text-text hover:bg-hairline-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          <History size={14} aria-hidden="true" />
          {vergleich.isPending ? t("antwortvergleich.laeuft") : t("antwortvergleich.start")}
        </button>
        <AiCostHint billable={billable} className="text-[10.5px]" />
      </div>
      {vergleich.isError && ergebnisFuer === schluessel ? (
        <p
          data-testid="ask-vergleich-fehler"
          role="alert"
          className="mt-2 rounded-[8px] border border-trust-crit-fill bg-trust-crit-bg p-2 text-[12px] text-text"
        >
          {t("antwortvergleich.fehler")}
        </p>
      ) : null}
      {aktuell ? (
        <WissensstandVergleichAnzeige vergleich={aktuell} wissenHref={wissenHref} />
      ) : null}
    </section>
  );
}
