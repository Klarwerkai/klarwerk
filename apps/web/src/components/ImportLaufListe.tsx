// ================================================================================================
// ADMIN-02 (Nacharbeit 2) — DIE IMPORTLISTE. STATUS, ZEITRAUM, ZUSTÄNDIGKEIT, FEHLERHILFE.
// ================================================================================================
//
// Bens Befund: die Zugangskarten und die Übernahmebilanz sagen etwas über EINE Anbindung bzw. EINE
// Übernahme — eine Übersicht über die Läufe aller Quellen gab es nicht. Diese Fläche ist sie, und
// sie baut auf dem BESTEHENDEN Laufbestand auf (`GET /api/admin/import/runs`, dieselbe Laufform wie
// `GET /api/admin/import/runs/:importId`) und auf demselben Rechteweg (`users.manage`).
//
// WAS FEHLT, STEHT DA: Wer einen Lauf ausgelöst hat, hält der Lauf nicht fest. Die Liste nennt
// deshalb die Zuständigkeit der Rolle und sagt ausdrücklich „nicht festgehalten", statt eine Person
// zu erfinden. Ein Lauf ohne Ende heisst „läuft" oder „kein Ende festgehalten", nie „fertig".
//
// ZUSTANDSMODELL: Recht fehlt → nichts (kein 403-Rauschen). Laden → Ladesatz. Fehler → Satz und
// erneuter Versuch, KEINE alte Liste daneben (Fehler vor Daten). Ablage kann nicht auflisten →
// eigener Satz. Leer → „noch kein Lauf festgehalten". Läuft ein Lauf, wird alle 10 s nachgefragt —
// so sieht auch eine zweite Verwaltende, was eine erste gerade gestartet hat.
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import type { ImportRunListe, ImportRunRecord } from "../api/types";
import { useRole } from "../app/RoleContext";
import { QUELLE_NAME, laeuftNoch, laufHilfe, laufStatusKey } from "../lib/importLaufHilfe";
import { formatKoTimestamp } from "../lib/koDates";
import { Button, Card, SectionLabel } from "./ui";

/** Der Abfrageschlüssel — Übernahmewege frischen ihn nach einem Lauf auf. */
export const IMPORT_LAUFLISTE_KEY = ["import-runs-liste"] as const;

function LaufZeile({ run }: { run: ImportRunRecord }): JSX.Element {
  const { t, i18n } = useTranslation();
  const [offen, setOffen] = useState(false);
  const start = formatKoTimestamp(run.startedAt, i18n.language);
  const ende = formatKoTimestamp(run.completedAt, i18n.language);
  const hilfe = laufHilfe(run);
  const quelle = QUELLE_NAME[run.sourceSystem];
  const c = run.counters;
  const zeitraum =
    start === null
      ? t("integrationen.liste.zeitraum.unbekannt")
      : ende !== null
        ? t("integrationen.liste.zeitraum.vonBis", { start, ende })
        : laeuftNoch(run.status)
          ? t("integrationen.liste.zeitraum.laeuftSeit", { start })
          : t("integrationen.liste.zeitraum.ohneEnde", { start });
  return (
    <li
      data-testid={`import-lauf-${run.importId}`}
      data-status={run.status}
      className="rounded-input border border-hairline px-3 py-2"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[13px] font-semibold text-text">
          {quelle ? t(quelle) : run.sourceSystem}
        </span>
        <span
          data-testid={`import-lauf-status-${run.importId}`}
          className="rounded-pill bg-hairline-soft px-2 py-0.5 font-mono text-[10px] font-semibold text-muted"
        >
          {t(laufStatusKey(run.status))}
        </span>
      </div>
      <p
        data-testid={`import-lauf-zeitraum-${run.importId}`}
        className="mt-1 text-[12px] text-muted"
      >
        {zeitraum}
      </p>
      <p className="mt-0.5 text-[12px] text-muted">
        {t("integrationen.liste.bilanz", {
          gesamt: c.itemsTotal,
          neu: c.itemsCreated,
          vorhanden: c.itemsSkipped,
          offen: c.itemsFailed,
        })}
      </p>
      <p
        data-testid={`import-lauf-zustaendig-${run.importId}`}
        className="mt-0.5 text-[12px] text-muted"
      >
        {t("integrationen.liste.zustaendig")}
      </p>
      <p
        data-testid={`import-lauf-hilfe-${run.importId}`}
        data-hilfe={hilfe.key}
        className="mt-1 rounded-btn bg-hairline-soft px-2.5 py-1.5 text-[12.5px] leading-relaxed text-text"
      >
        {t("integrationen.naechsterSchritt")} {t(hilfe.key, { code: hilfe.code ?? "" })}
      </p>
      <button
        type="button"
        data-testid={`import-lauf-details-${run.importId}`}
        aria-expanded={offen}
        onClick={() => setOffen((v) => !v)}
        className="mt-1.5 rounded-btn text-[12px] text-ai underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-text"
      >
        {t(offen ? "integrationen.liste.detailsZu" : "integrationen.liste.detailsAuf")}
      </button>
      {offen ? (
        <dl
          data-testid={`import-lauf-detail-${run.importId}`}
          className="mt-1.5 grid grid-cols-1 gap-x-3 gap-y-0.5 text-[12px] text-muted sm:grid-cols-[auto_1fr]"
        >
          <dt className="font-semibold">{t("integrationen.liste.detail.kennung")}</dt>
          <dd className="break-all font-mono text-[11px]">{run.importId}</dd>
          <dt className="font-semibold">{t("integrationen.liste.detail.umfang")}</dt>
          <dd className="break-all">
            {run.sourceScope ?? run.externalId ?? t("integrationen.liste.nichtFestgehalten")}
          </dd>
          <dt className="font-semibold">{t("integrationen.liste.detail.fehlercode")}</dt>
          <dd className="break-all font-mono text-[11px]">
            {run.failureCode ?? t("integrationen.liste.keiner")}
          </dd>
          <dt className="font-semibold">{t("integrationen.liste.detail.grund")}</dt>
          <dd className="break-words">{run.failureReason ?? t("integrationen.liste.keiner")}</dd>
          <dt className="font-semibold">{t("integrationen.liste.detail.abgleich")}</dt>
          <dd>
            {run.sourceSync
              ? t("integrationen.liste.detail.abgleichZahlen", {
                  entfernt: run.sourceSync.removed.length,
                  zurueck: run.sourceSync.restored.length,
                  ungeprueft: run.sourceSync.unchecked.length,
                })
              : t("integrationen.liste.nichtFestgehalten")}
          </dd>
        </dl>
      ) : null}
    </li>
  );
}

export function ImportLaufListe(): JSX.Element | null {
  const { t } = useTranslation();
  const { role } = useRole();
  const istVerwalter = role === "admin";
  const liste = useQuery<ImportRunListe>({
    queryKey: IMPORT_LAUFLISTE_KEY,
    queryFn: () => endpoints.admin.import.runs(50),
    enabled: istVerwalter,
    retry: false,
    // Läuft ein Lauf, fragt die Liste nach — sonst stünde „läuft" stehen, bis jemand neu lädt.
    refetchInterval: (q) =>
      (q.state.data?.runs ?? []).some((r) => laeuftNoch(r.status)) ? 10_000 : false,
  });
  if (!istVerwalter) {
    return null;
  }
  // FEHLER VOR DATEN: eine alte Liste neben einem gescheiterten Nachladen wäre ein falscher Stand.
  const inhalt = liste.isError ? (
    <p
      data-testid="import-laufliste-fehler"
      className="mt-2 rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text"
    >
      {t(
        liste.error instanceof ApiError && liste.error.status === 403
          ? "integrationen.liste.keinRecht"
          : "integrationen.liste.fehler",
      )}
    </p>
  ) : !liste.data ? (
    <p data-testid="import-laufliste-laedt" className="mt-2 text-[12.5px] text-muted">
      {t("integrationen.liste.laedt")}
    </p>
  ) : !liste.data.verfuegbar ? (
    <p data-testid="import-laufliste-nicht-verfuegbar" className="mt-2 text-[12.5px] text-muted">
      {t("integrationen.liste.nichtVerfuegbar")}
    </p>
  ) : liste.data.runs.length === 0 ? (
    <p data-testid="import-laufliste-leer" className="mt-2 text-[12.5px] text-muted">
      {t("integrationen.liste.leer")}
    </p>
  ) : (
    <ul data-testid="import-laufliste" className="mt-2 space-y-2">
      {liste.data.runs.map((run) => (
        <LaufZeile key={run.importId} run={run} />
      ))}
    </ul>
  );
  return (
    <Card className="mb-5" data-testid="import-laufliste-karte">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionLabel>{t("integrationen.liste.titel")}</SectionLabel>
        <Button
          variant="outline"
          data-testid="import-laufliste-neu-laden"
          disabled={liste.isFetching}
          onClick={() => void liste.refetch()}
        >
          <RefreshCw size={14} />
          {t("integrationen.liste.neuLaden")}
        </Button>
      </div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
        {t("integrationen.liste.was")}
      </p>
      {liste.data && !liste.data.ausloeserFestgehalten ? (
        <p data-testid="import-laufliste-ausloeser" className="mt-1 text-[12px] text-muted-2">
          {t("integrationen.liste.ausloeserFehlt")}
        </p>
      ) : null}
      {inhalt}
    </Card>
  );
}
