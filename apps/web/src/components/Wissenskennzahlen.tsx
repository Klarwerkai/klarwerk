// ================================================================================================
// ADMIN-11 · WISSENSKENNZAHLEN — Handlungsbedarf zuerst, Berechnung als erreichbares Detail.
// ================================================================================================
//
// produkt:20261009:admin-wissenskennzahlen. Der Abschnitt steht OBEN auf `/analytics`: zuerst, was
// jetzt offen ist (aus den Qualitätsaufgaben, ADMIN-10), dann Fragen und Lücken im gewählten
// Zeitraum. Jede Zahl nennt ihre Lage (gemessen, unvollständig, nicht erhoben, unbekannt); wie sie
// gezählt ist, steht zugeklappt darunter — es verdrängt den Handlungsbedarf nicht.
//
// Zahl, Detailliste und Export lesen DIESELBE Antwort. Die Auswahl steht in der Adresse
// (`lib/wissenskennzahlen.ts`), deshalb führt Zurück aus einer Arbeitsliste auf genau diese Sicht.
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import {
  type Wissenskennzahlen as Antwort,
  type Kennzahl,
  ZEITRAEUME,
  wissenskennzahlenApi,
  wissenskennzahlenKey,
} from "../api/wissenskennzahlen";
import { formatKoTimestamp } from "../lib/koDates";
import {
  type AuswahlFeld,
  anzeigeVon,
  auswahlAusAdresse,
  auswahlInAdresse,
  exportDateiname,
  kennzahlenCsv,
  trendText,
  vorherText,
} from "../lib/wissenskennzahlen";
import { StaleMarker } from "./LoadState";
import { Card, SectionLabel } from "./ui";

// Kein eigener Fokusstil: der Ring kommt aus der einen Regel `*:focus-visible` (index.css).
const SELECT_KLASSE =
  "w-full rounded-btn border border-hairline bg-surface px-2.5 py-1.5 text-[13px] text-text";
const KNOPF_KLASSE =
  "rounded-btn border border-hairline px-3 py-1 text-[12.5px] font-semibold text-text hover:bg-hairline-soft";

const LAGE_TON: Record<string, string> = {
  zahl: "bg-trust-pos-bg text-trust-pos-text",
  nicht_berechenbar: "bg-page text-muted-2",
  unvollstaendig: "bg-trust-warn-bg text-trust-warn-text",
  nicht_erhoben: "bg-page text-muted-2",
  unbekannt: "bg-trust-crit-bg text-trust-crit-text",
};

export function Wissenskennzahlen(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const auswahl = auswahlAusAdresse(params);
  const abfrage = useQuery({
    queryKey: wissenskennzahlenKey(auswahl),
    queryFn: () => wissenskennzahlenApi.laden(auswahl),
    // Frischer Stand bei jedem Betreten: ein Abschluss am Ursprung steht danach auch hier.
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const setze = (feld: AuswahlFeld, wert: string): void => {
    // `replace`: Auswahlklicks kosten keinen Zurück-Schritt; der Rückweg landet auf dieser Sicht.
    const neu = wert === "" ? null : wert;
    setParams((vorher) => auswahlInAdresse(vorher, feld, neu), { replace: true });
  };
  const zuruecksetzen = (): void => {
    const ohne = (vorher: URLSearchParams): URLSearchParams =>
      auswahlInAdresse(auswahlInAdresse(vorher, "space", null), "team", null);
    setParams(ohne, { replace: true });
  };

  const zeit = (iso: string): string => formatKoTimestamp(iso, i18n.language) ?? iso;
  const recht =
    abfrage.isError &&
    abfrage.error instanceof ApiError &&
    (abfrage.error.status === 403 || abfrage.error.status === 401);
  const ungueltig =
    abfrage.isError && abfrage.error instanceof ApiError && abfrage.error.status === 400;
  const daten = recht || ungueltig ? undefined : abfrage.data;
  const spaces = daten?.filterwerte.spaces ?? [];
  const teams = daten?.filterwerte.teams ?? [];
  // Eine Wahl aus der Adresse, die (noch) nicht geladen ist, bleibt als eigene Option sichtbar.
  const spaceFremd = auswahl.space !== null && !spaces.some((s) => s.id === auswahl.space);
  const teamFremd = auswahl.team !== null && !teams.some((x) => x.id === auswahl.team);

  const kopf = (
    <>
      <div className="mb-1 flex items-center gap-1.5">
        <h2 id="wkz-titel" className="text-[15px] font-semibold text-ink">
          {t("wkz.titel")}
        </h2>
      </div>
      <p className="mb-3 text-[12.5px] text-muted">{t("wkz.leitsatz")}</p>
    </>
  );

  const auswahlFelder = (
    <fieldset className="mb-3 rounded-[14px] border border-hairline bg-surface p-3">
      <legend className="px-1 text-[12px] font-semibold text-muted-2">
        {t("wkz.filter.titel")}
      </legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="wkz-filter-tage" className="text-[12px] font-semibold text-muted-2">
            {t("wkz.filter.zeitraum")}
          </label>
          <select
            id="wkz-filter-tage"
            data-testid="wkz-filter-tage"
            value={String(auswahl.tage)}
            onChange={(e) => setze("tage", e.target.value)}
            className={SELECT_KLASSE}
          >
            {ZEITRAEUME.map((tage) => (
              <option key={tage} value={String(tage)}>
                {t("wkz.filter.tage", { anzahl: tage })}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="wkz-filter-space" className="text-[12px] font-semibold text-muted-2">
            {t("wkz.filter.space")}
          </label>
          <select
            id="wkz-filter-space"
            data-testid="wkz-filter-space"
            value={auswahl.space ?? ""}
            onChange={(e) => setze("space", e.target.value)}
            className={SELECT_KLASSE}
          >
            <option value="">{t("wkz.filter.alle")}</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            {spaceFremd ? <option value={auswahl.space ?? ""}>{auswahl.space}</option> : null}
          </select>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="wkz-filter-team" className="text-[12px] font-semibold text-muted-2">
            {t("wkz.filter.team")}
          </label>
          <select
            id="wkz-filter-team"
            data-testid="wkz-filter-team"
            value={auswahl.team ?? ""}
            onChange={(e) => setze("team", e.target.value)}
            className={SELECT_KLASSE}
          >
            <option value="">{t("wkz.filter.alle")}</option>
            {teams.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
            {teamFremd ? <option value={auswahl.team ?? ""}>{auswahl.team}</option> : null}
          </select>
        </div>
      </div>
      <p className="mt-2 text-[12px] text-muted-2">{t("wkz.filter.hinweis")}</p>
      {auswahl.space !== null || auswahl.team !== null ? (
        <button
          type="button"
          data-testid="wkz-filter-zuruecksetzen"
          onClick={zuruecksetzen}
          className={`mt-2 ${KNOPF_KLASSE}`}
        >
          {t("wkz.filter.zuruecksetzen")}
        </button>
      ) : null}
    </fieldset>
  );

  if (daten === undefined) {
    return (
      <section aria-labelledby="wkz-titel" data-testid="wkz">
        {kopf}
        {auswahlFelder}
        <div
          data-testid="wkz-ladezustand"
          className="rounded-[14px] border border-hairline bg-surface px-4 py-3 text-[14px]"
        >
          {abfrage.isError ? (
            <div className="flex flex-wrap items-center gap-3">
              <span role="alert" className="flex-1">
                {t(recht ? "wkz.recht" : ungueltig ? "wkz.filter.ungueltig" : "wkz.fehler")}
              </span>
              {recht ? null : (
                <button
                  type="button"
                  onClick={ungueltig ? zuruecksetzen : () => void abfrage.refetch()}
                  className={KNOPF_KLASSE}
                >
                  {t(ungueltig ? "wkz.filter.zuruecksetzen" : "wkz.erneut")}
                </button>
              )}
            </div>
          ) : (
            <output>{t("wkz.laedt")}</output>
          )}
        </div>
      </section>
    );
  }

  const exportieren = (): void => {
    const blob = new Blob([kennzahlenCsv(daten, t, i18n.language)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportDateiname(daten);
    a.click();
    URL.revokeObjectURL(url);
  };
  const zeitraumSatz = t("wkz.zeitraum", {
    von: zeit(daten.zeitraum.von),
    bis: zeit(daten.zeitraum.bis),
  });
  const vorperiodeSatz = t("wkz.vorperiode", {
    von: zeit(daten.vorperiode.von),
    bis: zeit(daten.vorperiode.bis),
  });

  return (
    <section aria-labelledby="wkz-titel" data-testid="wkz">
      {kopf}
      {auswahlFelder}

      <div className="mb-3 flex flex-wrap items-center gap-3 text-[12.5px] text-muted-2">
        <span data-testid="wkz-stand">{t("wkz.stand", { zeit: zeit(daten.stand) })}</span>
        <button
          type="button"
          data-testid="wkz-aktualisieren"
          onClick={() => void abfrage.refetch()}
          className={KNOPF_KLASSE}
        >
          {t("wkz.aktualisieren")}
        </button>
        <button
          type="button"
          data-testid="wkz-export"
          onClick={exportieren}
          className={KNOPF_KLASSE}
          aria-describedby="wkz-export-hinweis"
        >
          {t("wkz.export.knopf")}
        </button>
        <span id="wkz-export-hinweis" className="text-[12px]">
          {t("wkz.export.hinweis")}
        </span>
      </div>

      {abfrage.isError ? (
        <div data-testid="wkz-stand-veraltet" className="mb-3">
          <StaleMarker onRetry={() => void abfrage.refetch()} />
        </div>
      ) : null}
      {daten.quellen.vorgaenge !== "ok" ? (
        <p
          data-testid="wkz-quelle-teilweise"
          className="mb-3 rounded-btn bg-trust-warn-bg px-3 py-2 text-[12.5px] font-semibold text-trust-warn-text"
        >
          {t("wkz.quelle.teilweise")}
        </p>
      ) : null}

      <SectionLabel>{t("wkz.handlungsbedarf.titel")}</SectionLabel>
      <p className="mb-2 text-[12px] text-muted-2">{t("wkz.handlungsbedarf.erklaerung")}</p>
      <div data-testid="wkz-handlungsbedarf" className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {daten.handlungsbedarf.map((k) => (
          <KennzahlKarte key={k.schluessel} k={k} daten={daten} />
        ))}
      </div>

      <Bedarf daten={daten} />

      <SectionLabel>{t("wkz.nutzung.titel")}</SectionLabel>
      <p className="mb-1 text-[12px] text-muted-2">{t("wkz.nutzung.erklaerung")}</p>
      <p data-testid="wkz-zeitraum" className="mb-2 text-[12px] text-muted-2">
        {zeitraumSatz}
        {" · "}
        {vorperiodeSatz}
      </p>
      <div data-testid="wkz-nutzung" className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {daten.nutzung.map((k) => (
          <KennzahlKarte key={k.schluessel} k={k} daten={daten} />
        ))}
      </div>

      <EigeneSuchen daten={daten} />
    </section>
  );
}

function KennzahlKarte({ k, daten }: { k: Kennzahl; daten: Antwort }): JSX.Element {
  const { t, i18n } = useTranslation();
  const zeit = (iso: string): string => formatKoTimestamp(iso, i18n.language) ?? iso;
  const anzeige = anzeigeVon(k, i18n.language);
  const titel = t(`wkz.k.${k.schluessel}.titel`);
  const trend = trendText(k, t, i18n.language);
  const vorher = vorherText(k, i18n.language);
  const trendSatz =
    trend === null
      ? t(`wkz.trend.${k.trendGrund}`)
      : t("wkz.trend.verglichen", { differenz: trend, vorher });
  const zeitraumWert =
    k.art === "momentaufnahme"
      ? t("wkz.details.momentaufnahme")
      : t("wkz.details.zeitraumWert", {
          von: zeit(daten.zeitraum.von),
          bis: zeit(daten.zeitraum.bis),
        });
  const mitTrend =
    k.art === "zeitraum" && anzeige.art !== "nicht_erhoben" && anzeige.art !== "unbekannt";
  const eintraege = k.eintraege;
  return (
    <div
      data-testid="wkz-kennzahl"
      data-schluessel={k.schluessel}
      data-lage={k.lage}
      data-anzeige={anzeige.art}
      className="rounded-card border border-hairline bg-surface p-3"
    >
      <div className="font-mono text-micro uppercase tracking-wider text-muted-2">{titel}</div>
      <div className="mt-1 flex flex-wrap items-baseline gap-2">
        <span data-testid="wkz-wert" className="text-2xl font-semibold text-ink">
          {anzeige.text}
        </span>
        <span
          data-testid="wkz-lage"
          className={`rounded-pill px-2 py-0.5 text-[11px] font-semibold ${LAGE_TON[anzeige.art] ?? ""}`}
        >
          {t(`wkz.anzeige.${anzeige.art}`)}
        </span>
      </div>
      {anzeige.art === "unvollstaendig" ? (
        <p data-testid="wkz-erhoben" className="mt-1 text-[12px] text-trust-warn-text">
          {k.erhobenSeit === null
            ? t("wkz.erhoben.keins")
            : t("wkz.erhoben.seit", { datum: zeit(k.erhobenSeit) })}
        </p>
      ) : null}
      {anzeige.art === "nicht_erhoben" ? (
        <p className="mt-1 text-[12px] text-muted-2">{t("wkz.anzeige.nichtErhobenGrund")}</p>
      ) : null}
      {mitTrend ? (
        <p data-testid="wkz-trend" className="mt-1 text-[12px] text-muted-2">
          {trendSatz}
        </p>
      ) : null}

      <details className="mt-2 text-[12px] text-muted">
        <summary data-testid="wkz-details" className="cursor-pointer font-semibold text-text">
          {t("wkz.details.zusammenfassung")}
        </summary>
        <dl className="mt-1 space-y-1">
          <div>
            <dt className="font-semibold text-muted-2">{t("wkz.details.bedeutung")}</dt>
            <dd>{t(`wkz.k.${k.schluessel}.bedeutung`)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-muted-2">{t("wkz.details.nenner")}</dt>
            <dd>
              {t(`wkz.k.${k.schluessel}.nenner`)}
              {k.zaehler !== null && k.nenner !== null ? (
                <>
                  {" · "}
                  {t("wkz.details.quote", { zaehler: k.zaehler, nenner: k.nenner })}
                </>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-muted-2">{t("wkz.details.zeitraum")}</dt>
            <dd>{zeitraumWert}</dd>
          </div>
          <div>
            <dt className="font-semibold text-muted-2">{t("wkz.details.datenstand")}</dt>
            <dd>
              {t("wkz.stand", { zeit: zeit(daten.stand) })}
              {k.art === "zeitraum" && k.erhobenSeit !== null ? (
                <>
                  {" · "}
                  {t("wkz.erhoben.seit", { datum: zeit(k.erhobenSeit) })}
                </>
              ) : null}
            </dd>
          </div>
        </dl>
      </details>

      {eintraege ? <Detailliste k={k} eintraege={eintraege} /> : null}
      {eintraege === undefined && k.arbeitsliste ? (
        <Link
          to={k.arbeitsliste}
          data-testid="wkz-arbeitsliste"
          className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-text underline"
        >
          {t("wkz.liste.arbeitsliste")}
          <ChevronRight size={13} strokeWidth={2} aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

function Detailliste({
  k,
  eintraege,
}: {
  k: Kennzahl;
  eintraege: NonNullable<Kennzahl["eintraege"]>;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <details className="mt-2 text-[12.5px]">
      <summary data-testid="wkz-liste" className="cursor-pointer font-semibold text-text">
        {t("wkz.liste.zusammenfassung", { anzahl: eintraege.length })}
      </summary>
      {eintraege.length === 0 ? (
        <p className="mt-1 text-muted-2">{t("wkz.liste.leer")}</p>
      ) : (
        <ul className="mt-1 divide-y divide-hairline-soft">
          {eintraege.map((e) => {
            const titel = e.titel ?? t("wkz.liste.zurueckgehalten");
            return (
              <li
                key={e.schluessel}
                data-testid="wkz-eintrag"
                data-schluessel={e.schluessel}
                className="flex flex-wrap items-center gap-2 py-1.5"
              >
                <span className="min-w-0 flex-1 break-words text-text">
                  {titel}
                  {e.ueberfaellig ? (
                    <span className="ml-1 font-semibold text-trust-crit-text">
                      {t("wkz.liste.ueberfaellig")}
                    </span>
                  ) : null}
                </span>
                <Link
                  to={e.arbeitsweg}
                  aria-label={t("wkz.liste.oeffnenLabel", { titel })}
                  className="inline-flex items-center gap-1 rounded-btn border border-hairline px-2.5 py-0.5 text-[12px] font-semibold text-text hover:bg-hairline-soft"
                >
                  {t("wkz.liste.oeffnen")}
                  <ChevronRight size={12} strokeWidth={2} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {k.arbeitsliste ? (
        <Link
          to={k.arbeitsliste}
          data-testid="wkz-arbeitsliste"
          className="mt-1 inline-flex items-center gap-1 font-semibold text-brand-text underline"
        >
          {t("wkz.liste.arbeitsliste")}
          <ChevronRight size={13} strokeWidth={2} aria-hidden="true" />
        </Link>
      ) : (
        <p className="mt-1 text-[12px] text-muted-2">
          {t(k.art === "zeitraum" ? "wkz.liste.nurHierZeitraum" : "wkz.liste.nurHier")}
        </p>
      )}
    </details>
  );
}

/**
 * Nacharbeit 3 (Ben): die EIGENEN Suchen ohne Treffer — der vorhandene Leseweg, nur für diese
 * Person. Häufigkeit und letzter Zeitpunkt sind kumuliert; es gibt keine Zahl je Zeitraum, keinen
 * Trend und keinen Space. Passt ein Begriff zu einer offenen Lücke, führt die Zeile dorthin.
 */
function EigeneSuchen({ daten }: { daten: Antwort }): JSX.Element {
  const { t, i18n } = useTranslation();
  const s = daten.suche;
  const zeit = (iso: string): string => formatKoTimestamp(iso, i18n.language) ?? iso;
  const filterText = (e: Record<string, string>): string => {
    const teile = Object.entries(e).map(([feld, wert]) => `${feld}: ${wert}`);
    return teile.join(", ");
  };
  return (
    <Card data-testid="wkz-suche" data-lage={s.lage} className="text-[12.5px]">
      <p className="font-semibold text-text">{t("wkz.suche.titel")}</p>
      <p className="mt-0.5 text-muted">{t("wkz.suche.text", { deckel: s.deckel })}</p>
      {s.lage === "gemessen" ? null : (
        <p data-testid="wkz-suche-lage" className="mt-1 text-muted-2">
          {t(`wkz.suche.${s.lage}`)}
        </p>
      )}
      {s.lage === "gemessen" && s.eintraege.length === 0 ? (
        <p className="mt-1 text-muted-2">{t("wkz.suche.leer")}</p>
      ) : null}
      {s.eintraege.length > 0 ? (
        <ul className="mt-2 divide-y divide-hairline-soft">
          {s.eintraege.map((e) => (
            <li
              key={`${e.begriff}|${filterText(e.eingrenzung)}`}
              data-testid="wkz-suche-eintrag"
              data-vorgang={e.vorgang?.schluessel ?? ""}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5"
            >
              <span className="min-w-0 flex-1 break-words text-text">{e.begriff}</span>
              <span className="font-mono text-[11px] text-muted-2">
                {t("wkz.suche.anzahl", { anzahl: e.anzahl, zeit: zeit(e.zuletzt) })}
              </span>
              {Object.keys(e.eingrenzung).length > 0 ? (
                <span className="text-[12px] text-muted-2">
                  {t("wkz.suche.eingegrenzt", { filter: filterText(e.eingrenzung) })}
                </span>
              ) : null}
              {e.vorgang ? (
                <Link
                  to={e.vorgang.arbeitsweg}
                  aria-label={t("wkz.suche.vorgangLabel", { begriff: e.begriff })}
                  className="inline-flex items-center gap-1 rounded-btn border border-hairline px-2.5 py-0.5 text-[12px] font-semibold text-text hover:bg-hairline-soft"
                >
                  {t("wkz.suche.vorgang")}
                  <ChevronRight size={12} strokeWidth={2} aria-hidden="true" />
                </Link>
              ) : (
                <span className="text-[12px] text-muted-2">{t("wkz.suche.ohneVorgang")}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

function Bedarf({ daten }: { daten: Antwort }): JSX.Element {
  const { t, i18n } = useTranslation();
  const b = daten.bedarf;
  const zeit = (iso: string): string => formatKoTimestamp(iso, i18n.language) ?? iso;
  return (
    <div data-testid="wkz-bedarf" data-lage={b.lage} className="mb-5">
      <SectionLabel>{t("wkz.bedarf.titel")}</SectionLabel>
      <p className="mb-2 text-[12px] text-muted-2">{t("wkz.bedarf.erklaerung")}</p>
      {b.lage === "nicht_erhoben" || b.lage === "unbekannt" ? (
        <p className="rounded-card border border-hairline bg-surface px-3 py-2 text-[12.5px] text-muted">
          {t(`wkz.bedarf.${b.lage}`)}
        </p>
      ) : b.eintraege.length === 0 ? (
        <p className="rounded-card border border-hairline bg-surface px-3 py-2 text-[12.5px] text-muted">
          {t("wkz.bedarf.leer")}
        </p>
      ) : (
        <>
          <ul className="overflow-hidden rounded-card border border-hairline bg-surface">
            {b.eintraege.map((e) => {
              const frage = e.frage ?? t("wkz.liste.zurueckgehalten");
              return (
                <li
                  key={e.lueckeId}
                  data-testid="wkz-bedarf-eintrag"
                  data-vorgang={e.vorgang}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-hairline-soft px-3 py-2 text-[12.5px] last:border-b-0"
                >
                  <span className="min-w-0 flex-1 break-words text-text">{frage}</span>
                  <span className="font-mono text-[11px] text-muted-2">
                    {e.haeufigkeit === null
                      ? t("wkz.bedarf.ohneZaehlung")
                      : t("wkz.bedarf.haeufigkeit", { anzahl: e.haeufigkeit })}
                  </span>
                  <span className="text-[12px] text-muted-2">
                    {t(e.zugeordnet ? "wkz.bedarf.zugeordnet" : "wkz.bedarf.niemand")}
                    {" · "}
                    {zeit(e.seit)}
                  </span>
                  <Link
                    to={e.arbeitsweg}
                    aria-label={`${t("wkz.bedarf.oeffnen")}: ${frage}`}
                    className="inline-flex items-center gap-1 rounded-btn border border-hairline px-2.5 py-0.5 text-[12px] font-semibold text-text hover:bg-hairline-soft"
                  >
                    {t("wkz.bedarf.oeffnen")}
                    <ChevronRight size={12} strokeWidth={2} aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
          <p data-testid="wkz-bedarf-bilanz" className="mt-1 text-[12px] text-muted-2">
            {t("wkz.bedarf.gesamt", { gezeigt: b.eintraege.length, offen: b.offen ?? 0 })}
            {b.ohneZaehlung ? (
              <>
                {" · "}
                {t("wkz.bedarf.altbestand", { anzahl: b.ohneZaehlung })}
              </>
            ) : null}
          </p>
        </>
      )}
    </div>
  );
}
