// ================================================================================================
// R-0920 — DAS ERGEBNIS EINES IMPORTLAUFS HAT EINE EIGENE ADRESSE: `/import/lauf/:importId`.
// ================================================================================================
//
// DER BEFUND: Den Ausgang eines Laufs gab es bis hierher nur INNERHALB von `/import` — in der
// Lauf-Kachel (`pages/Stufe2.tsx`, `ImportRunPanel`) und in der Bilanz der Übernahme
// (`components/ImportGroups.tsx`). Beide kennen die Kennung nur, solange das Fenster offen ist.
// Neu laden, teilen, später nachsehen: ging nicht. Die Kennung stand da, aber sie führte nirgends hin.
//
// WAS DIESE SEITE IST: eine Leseansicht. Sie holt den Lauf über den VORHANDENEN Lesehaken
// (`useImportRun`, derselbe Abfrageschlüssel — kein zweiter Abruf neben der Kachel) und zeigt den
// Ausgang über das VORHANDENE Bauteil `LaufAusgang` (lädt · gelesen · nicht abrufbar · ausgesetzt ·
// alter Stand). Sie startet nichts, ändert nichts und rechnet nichts aus: die Zähler kommen fertig
// vom Server, der Zustand wird gelesen und über `importRunStateView` benannt.
//
// ROLLE: die Adresse steht in `EXTRA_GUARDED_ITEMS` (`app/navigation.ts`) mit DERSELBEN Schranke
// wie `/import` (Admin, Stufe 2). Wer dort nicht hinkommt, bekommt hier dieselbe erklärende Karte
// statt einer stillen Umleitung; der Server fordert sein Recht an `GET /admin/import/runs/:id` ohnehin
// selbst.
//
// TASTATUR UND VORLESEPROGRAMM: genau eine `h1`; die Kennung ist als Text da (nicht abgeschnitten,
// markierbar); der Ausgang steht in einer höflichen Live-Region, damit ein Zustandswechsel des noch
// laufenden Laufs angesagt wird; die Aufschlüsselung ist eine Beschreibungsliste mit benannten
// Werten; der Rückweg ist ein gewöhnlicher Verweis mit sichtbarem Fokus. Alle Texte in DE, EN, NL.
import { ArrowLeft } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { useImportRun } from "../api/hooks";
import type { ImportRunRecord } from "../api/types";
import { LaufAusgang } from "../components/ImportGroups";
import { Card, PageHeader, SectionLabel } from "../components/ui";

/** Die Aufschlüsselung, wie der Server sie zählt — Reihenfolge fest, Schlüssel je Zeile eigen. */
const ZAEHLER: ReadonlyArray<{ feld: keyof ImportRunRecord["counters"]; key: string }> = [
  { feld: "itemsTotal", key: "imp.lauf.zaehler.gesamt" },
  { feld: "itemsCreated", key: "imp.lauf.zaehler.angelegt" },
  { feld: "itemsBound", key: "imp.lauf.zaehler.gebunden" },
  { feld: "itemsSkipped", key: "imp.lauf.zaehler.uebersprungen" },
  { feld: "itemsFailed", key: "imp.lauf.zaehler.gescheitert" },
];

function Zeitpunkt({ wert, sprache }: { wert: string; sprache: string }): JSX.Element {
  const datum = new Date(wert);
  // Ein unlesbarer Wert wird WÖRTLICH gezeigt — nie durch ein erfundenes Datum ersetzt.
  const text = Number.isNaN(datum.getTime()) ? wert : datum.toLocaleString(sprache);
  return <time dateTime={wert}>{text}</time>;
}

export function ImportLauf(): JSX.Element {
  const { t, i18n } = useTranslation();
  const { importId = "" } = useParams();
  const lauf = useImportRun(importId === "" ? null : importId);
  const akte = lauf.data;
  const ausgangId = useId();
  const nichtGefunden = lauf.error instanceof ApiError && lauf.error.status === 404;

  return (
    <div data-testid="imp-lauf-seite">
      <PageHeader kicker={t("s2.kicker")} title={t("imp.lauf.titel")} lead={t("imp.lauf.lead")} />
      <Card className="mb-4">
        <SectionLabel>{t("imp.lauf.kennung")}</SectionLabel>
        {/* Bewusst KEIN `truncate` — eine halbe Kennung ist keine Kennung. */}
        <p
          data-testid="imp-lauf-kennung"
          className="mt-1 select-all break-all font-mono text-[12.5px] text-text"
        >
          {importId}
        </p>
      </Card>
      <Card className="mb-4">
        <section aria-labelledby={ausgangId}>
          <h2 id={ausgangId} className="text-[13px] font-semibold text-text">
            {t("imp.lauf.ausgang")}
          </h2>
          {nichtGefunden ? (
            // 404 ist eine eigene Lage: diesen Lauf gibt es nicht (oder nicht für diese Sitzung).
            // Es wird KEIN Zustand und KEIN Zähler behauptet. `<output>` trägt die Rolle `status`
            // von sich aus — die Meldung wird angesagt, ohne eine Rolle von Hand zu setzen.
            <output data-testid="imp-lauf-nicht-gefunden" className="mt-1.5 block text-[12.5px]">
              {t("imp.lauf.nichtGefunden")}
            </output>
          ) : (
            <div aria-live="polite" data-testid="imp-lauf-ausgang">
              {importId === "" ? null : <LaufAusgang importId={importId} />}
            </div>
          )}
        </section>
        {akte && !nichtGefunden ? (
          <dl
            data-testid="imp-lauf-zaehler"
            className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-[12.5px] sm:grid-cols-2"
          >
            {ZAEHLER.map((z) => (
              <div
                key={z.feld}
                className="flex justify-between gap-2 border-b border-hairline py-1"
              >
                <dt className="text-muted">{t(z.key)}</dt>
                <dd data-testid={`imp-lauf-zaehler-${z.feld}`} className="font-mono text-text">
                  {akte.counters[z.feld]}
                </dd>
              </div>
            ))}
            <div className="flex justify-between gap-2 border-b border-hairline py-1">
              <dt className="text-muted">{t("imp.lauf.gestartet")}</dt>
              <dd className="text-text">
                <Zeitpunkt wert={akte.startedAt} sprache={i18n.language} />
              </dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-hairline py-1">
              <dt className="text-muted">{t("imp.lauf.beendet")}</dt>
              <dd data-testid="imp-lauf-beendet" className="text-text">
                {akte.completedAt ? (
                  <Zeitpunkt wert={akte.completedAt} sprache={i18n.language} />
                ) : (
                  t("imp.lauf.nochNichtBeendet")
                )}
              </dd>
            </div>
          </dl>
        ) : null}
      </Card>
      <Link
        to="/import"
        data-testid="imp-lauf-zurueck"
        className="inline-flex items-center gap-1 rounded-btn text-[13px] font-semibold text-brand-text underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        {t("imp.lauf.zurueck")}
      </Link>
    </div>
  );
}
