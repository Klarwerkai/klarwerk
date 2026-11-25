import { ChevronRight } from "lucide-react";
import { type MouseEvent, useId } from "react";
import { useTranslation } from "react-i18next";
import type {
  KatalogEintrag,
  KatalogKantenstand,
  KatalogSprache,
  KatalogWeg,
} from "../../../../services/app/src/funktionskatalog/vertrag";
import { GuardedLink } from "../app/NavGuardContext";

const linien: Record<KatalogKantenstand, { farbe: string; muster?: string }> = {
  nachgewiesen: { farbe: "text-trust-pos-text" },
  dokumentiert: { farbe: "text-trust-info-text", muster: "7 4" },
  vorgesehen: { farbe: "text-muted", muster: "2 5" },
};

export function Linienzeichen({ stand }: { stand: KatalogKantenstand }): JSX.Element {
  const linie = linien[stand];
  return (
    <svg aria-hidden="true" width="25" height="10" viewBox="0 0 25 10" className={linie.farbe}>
      <path d="M1 5 H20" stroke="currentColor" strokeWidth="2" strokeDasharray={linie.muster} />
      <path d="m16 1 6 4-6 4" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

// Place prerequisites before their successors. An editorial loop still keeps all of its stations.
function reihenfolge(weg: KatalogWeg): string[] {
  const offen = new Set(weg.verbindungen.flatMap((k) => [k.von, k.nach]));
  const folge: string[] = [];
  while (offen.size) {
    const bereit = [...offen].find(
      (id) => !weg.verbindungen.some((k) => k.nach === id && offen.has(k.von)),
    );
    const id = bereit ?? [...offen][0];
    if (!id) break;
    folge.push(id);
    offen.delete(id);
  }
  return folge;
}

export function FunktionswegeGraph({
  weg,
  eintraege,
  sprache,
  aktiv,
  stationsziel,
  pfeilziel,
  vonId,
  folgen,
}: {
  weg: KatalogWeg;
  eintraege: Map<string, KatalogEintrag>;
  sprache: KatalogSprache;
  aktiv: string;
  stationsziel: (id: string) => string;
  pfeilziel: (von: string, nach: string) => string;
  vonId: string | null;
  folgen: (event: MouseEvent<HTMLAnchorElement>) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const marker = useId().replace(/:/g, "");
  const folge = reihenfolge(weg);
  const zeile = 64;
  const y = (i: number) => (i + 0.5) * zeile;
  const kanten = weg.verbindungen.map((k) => ({
    k,
    von: folge.indexOf(k.von),
    nach: folge.indexOf(k.nach),
  }));
  const boegen = kanten.filter((p) => Math.abs(p.von - p.nach) > 1);
  const achse = 20 + 12 * boegen.length;
  const breite = achse + 15;
  return (
    <div className="relative" data-testid="funktionswege-graph">
      <svg
        aria-label={t("funktionskatalog.connections")}
        className="pointer-events-none absolute inset-y-0 left-0 h-full"
        style={{ width: breite }}
        viewBox={`0 0 ${breite} ${folge.length * zeile}`}
        preserveAspectRatio="none"
      >
        <title>{t("funktionskatalog.connections")}</title>
        <defs>
          {Object.entries(linien).map(([s, l]) => (
            <marker
              key={s}
              id={`${marker}-${s}`}
              markerWidth="8"
              markerHeight="8"
              refX="6.5"
              refY="4"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path d="M0 0 7 4 0 8 2 4Z" className={l.farbe} fill="currentColor" />
            </marker>
          ))}
        </defs>
        {kanten.map((p) => {
          const { k, von, nach } = p;
          const richtung = nach > von ? 1 : -1;
          const start = y(von);
          const ende = y(nach);
          const bogen = boegen.indexOf(p);
          const spur = achse - 14 - 12 * bogen;
          const d =
            bogen < 0
              ? `M ${achse} ${start + richtung * 7} V ${ende - richtung * 9}`
              : `M ${achse - 5} ${start + richtung * 5} Q ${spur} ${start + richtung * 5} ${spur} ${start + richtung * 15} V ${ende - richtung * 15} Q ${spur} ${ende - richtung * 5} ${achse - 8} ${ende - richtung * 5}`;
          const label = `${eintraege.get(k.von)?.title[sprache]} → ${eintraege.get(k.nach)?.title[sprache]} · ${k.text[sprache]}`;
          return (
            <GuardedLink
              key={`${k.von}-${k.nach}`}
              to={pfeilziel(k.von, k.nach)}
              preventScrollReset
              onClick={folgen}
              tabIndex={0}
              aria-label={label}
              data-katalog-pfeil={`${k.von}-${k.nach}`}
              className="group cursor-pointer focus-visible:outline-brand"
            >
              <title>{label}</title>
              <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth="14"
                pointerEvents="stroke"
              />
              <path
                d={d}
                fill="none"
                stroke="currentColor"
                strokeWidth={
                  k.von === vonId && k.nach === aktiv
                    ? 4
                    : k.von === aktiv || k.nach === aktiv
                      ? 2.8
                      : 1.8
                }
                strokeLinecap="round"
                strokeDasharray={linien[k.stand].muster}
                className={`${linien[k.stand].farbe} group-hover:stroke-[4] group-focus-visible:stroke-[4]`}
                markerEnd={`url(#${marker}-${k.stand})`}
              />
            </GuardedLink>
          );
        })}
        {folge.map((id, i) => (
          <g key={id}>
            <path
              d={`M ${achse + 5} ${y(i)} H ${breite}`}
              className="text-hairline"
              stroke="currentColor"
              strokeWidth="2"
            />
            <circle
              cx={achse}
              cy={y(i)}
              r={id === aktiv ? 7 : 5}
              fill="rgb(var(--kw-surface))"
              className={id === aktiv ? "text-brand-text" : "text-muted"}
              stroke="currentColor"
              strokeWidth={id === aktiv ? 3 : 2}
            />
            {id === aktiv && (
              <circle
                cx={achse}
                cy={y(i)}
                r="2.7"
                fill="currentColor"
                className="text-brand-text"
              />
            )}
          </g>
        ))}
      </svg>
      <ol className="grid auto-rows-fr" style={{ paddingLeft: breite }}>
        {folge.map((id) => {
          const e = eintraege.get(id);
          if (!e) return null;
          return (
            <li key={id} className="flex min-w-0 items-center py-1">
              <GuardedLink
                to={stationsziel(id)}
                onClick={folgen}
                preventScrollReset
                data-station={id}
                aria-current={aktiv === id ? "step" : undefined}
                className={`group flex min-h-14 w-full items-center justify-between gap-2 rounded-btn border px-3 py-2 focus-visible:outline-brand ${aktiv === id ? "border-brand bg-brand/5" : "border-hairline bg-surface hover:border-ink/40"}`}
              >
                <span className="min-w-0">
                  <span className="block break-words text-sm font-semibold leading-snug text-text">
                    {e.title[sprache]}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {e.platforms.map((p) => t(`funktionskatalog.product.${p}`)).join(" · ")}
                  </span>
                </span>
                <ChevronRight
                  size={15}
                  aria-hidden="true"
                  className={aktiv === id ? "shrink-0 text-brand-text" : "shrink-0 text-muted"}
                />
              </GuardedLink>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
