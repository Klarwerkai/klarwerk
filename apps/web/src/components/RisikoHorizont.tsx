// ================================================================================================
// R-1639 · R-2183 (Nacharbeit 3) — MEIN BEREICH: WISSEN VOR DEM RUHESTAND SICHERN.
// ================================================================================================
//
// Roadmap 5.1: „Für jeden Manager ein eigenes Dashboard … Welche kritischen Themen meines Bereichs
// haben Bus-Faktor 1? Welche Mitarbeiter gehen in den nächsten 24/36 Monaten in Rente — was wissen
// sie, was nicht im System ist?" B14: persönlicher Arbeitsvorrat gegen Wissensverlust.
//
// Die Fläche RECHNET NICHTS: Bereiche, Träger, Fristen und Arbeitsvorrat kommen aus
// `GET /api/management/risk-horizon` (services/management/src/horizon.ts). Der Server liefert nur
// die Bereiche, die den Betrachter als Verantwortlichen nennen (die Pflegerolle sieht alle) — und
// Ruhestandsangaben nur an Trägern dieser Bereiche.
//
// „Was nicht im System ist" kann niemand zählen. Gezeigt wird, was an der Person HÄNGT (einziger
// Träger, ungeprüfte eigene Objekte, ihr zugewiesene offene Lücken) — und ein Satz sagt das.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useRiskHorizon } from "../api/hooks";
import type { RetirementHorizon, RiskHorizonArea } from "../api/types";
import { useAuthorName } from "../lib/useAuthorName";
import { Card, QueryState, SectionLabel, cx } from "./ui";

const HORIZONTE: readonly RetirementHorizon[] = [24, 36];

function datum(iso: string, locale: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Nacharbeit 4: die Namensauflösung kommt von OBEN. Holte jede Karte sie selbst, begänne das
// Verzeichnis erst zu laden, NACHDEM der Bereichsblick angekommen ist — eine zweite, nachgelagerte
// Ladekette, in der die Karte „Autorenname wird geladen" statt des Namens zeigt.
function Bereich({
  area,
  horizont,
  nameOf,
}: {
  area: RiskHorizonArea;
  horizont: RetirementHorizon;
  nameOf: ReturnType<typeof useAuthorName>;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  // Nacharbeit 5 (ben F4): gefiltert wird nach der HEUTIGEN Zugehörigkeit (Frist gegen Bezugszeit,
  // vom Server abgeleitet) — nicht nach der einmal gepflegten Klasse. Sonst bliebe ein mit 36
  // Monaten gepflegter Eintrag auch dann aus dem 24-Monats-Blick, wenn die Frist nur noch 21
  // Monate entfernt ist.
  const traeger = area.bearers.filter(
    (b) => b.currentHorizon !== null && b.currentHorizon <= horizont,
  );
  return (
    <Card data-testid="horizont-bereich" data-kategorie={area.category} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-text">
          {area.category}
        </span>
        {area.singleSource ? (
          <span
            data-testid="horizont-busfaktor"
            className="shrink-0 rounded-pill bg-trust-crit-bg px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-trust-crit-text"
          >
            {t("fachwort.einzelperson.risiko")}
          </span>
        ) : null}
        {area.criticality ? (
          <span data-testid="horizont-kritikalitaet" className="text-[11.5px] text-muted">
            {t("risk.horizon.criticality", { level: t(`risk.horizon.level.${area.criticality}`) })}
          </span>
        ) : null}
      </div>
      <p data-testid="horizont-verantwortlich" className="text-[11.5px] text-muted">
        {area.managerId === null
          ? t("risk.horizon.noManager")
          : t("risk.horizon.manager", { name: nameOf(area.managerId) })}
      </p>
      {traeger.length === 0 ? (
        <p data-testid="horizont-keine-traeger" className="text-[12px] text-muted">
          {t("risk.horizon.noneInHorizon", { months: horizont })}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {traeger.map((b) => (
            <li
              key={b.userId}
              data-testid="horizont-traeger"
              data-person={b.userId}
              className="rounded-btn bg-page px-2.5 py-2 text-[12px]"
            >
              <div className="font-semibold text-text">
                {t("risk.horizon.bearer", {
                  name: nameOf(b.userId),
                  months: b.currentHorizon ?? b.horizonMonths,
                  due: datum(b.dueAt, i18n.language),
                })}
              </div>
              {/* Der Arbeitsvorrat bis zur Frist — nur Zeilen, die etwas zu tun nennen. */}
              <ul data-testid="horizont-vorrat" className="mt-1 space-y-0.5 text-muted">
                {b.soleBearer ? (
                  <li data-testid="horizont-vorrat-einziger" className="text-trust-crit-text">
                    {t("risk.horizon.todo.soleBearer")}
                  </li>
                ) : null}
                {b.openKoIds.length > 0 ? (
                  <li data-testid="horizont-vorrat-offen">
                    <Link
                      to={`/bibliothek?category=${encodeURIComponent(area.category)}`}
                      className="hover:underline"
                    >
                      {t("risk.horizon.todo.openKos", { count: b.openKoIds.length })}
                    </Link>
                  </li>
                ) : null}
                {b.openGaps > 0 ? (
                  <li data-testid="horizont-vorrat-luecken">
                    {t("risk.horizon.todo.openGaps", { count: b.openGaps })}
                  </li>
                ) : null}
                <li data-testid="horizont-vorrat-objekte">
                  {t("risk.horizon.todo.koCount", { count: b.koCount })}
                </li>
              </ul>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function RisikoHorizont(): JSX.Element {
  const { t } = useTranslation();
  const sicht = useRiskHorizon();
  // Nacharbeit 4: Verzeichnis und Bereichsblick laden GLEICHZEITIG ab dem Aufbau der Fläche.
  const nameOf = useAuthorName();
  const [horizont, setHorizont] = useState<RetirementHorizon>(36);
  return (
    <div data-testid="risiko-horizont">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <SectionLabel>{t("risk.horizon.title")}</SectionLabel>
        <fieldset aria-label={t("risk.horizon.filterLabel")} className="flex min-w-0 gap-1.5">
          {HORIZONTE.map((h) => (
            <button
              key={h}
              type="button"
              data-testid="horizont-filter"
              data-monate={h}
              aria-pressed={horizont === h}
              onClick={() => setHorizont(h)}
              className={cx(
                "rounded-pill border px-2.5 py-0.5 text-[11.5px]",
                horizont === h
                  ? "border-ink bg-ink text-white"
                  : "border-hairline bg-page text-muted hover:text-ink",
              )}
            >
              {t("risk.horizon.filter", { months: h })}
            </button>
          ))}
        </fieldset>
      </div>
      <p className="mb-2 text-[12px] text-muted-2">{t("risk.horizon.notCountable")}</p>
      <QueryState query={sicht}>
        {(v) =>
          v.areas.length === 0 ? (
            <Card
              data-testid="horizont-leer"
              className="border-dashed text-center text-sm text-muted"
            >
              {v.seesAll ? t("risk.horizon.noAreas") : t("risk.horizon.noOwnArea")}
            </Card>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {v.areas.map((a) => (
                <Bereich key={a.category} area={a} horizont={horizont} nameOf={nameOf} />
              ))}
            </div>
          )
        }
      </QueryState>
    </div>
  );
}
