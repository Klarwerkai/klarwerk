import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  GitBranch,
  MapPin,
  Route,
} from "lucide-react";
import { type MouseEvent, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import type {
  Funktionskatalog,
  KatalogEintrag,
  KatalogKantenstand,
  KatalogSprache,
  KatalogVerbindung,
  KatalogWeg,
} from "../../../../services/app/src/funktionskatalog/vertrag";
import { GuardedLink, useGuardedNavigate } from "../app/NavGuardContext";
import { FunktionswegeGraph, Linienzeichen } from "./FunktionswegeGraph";
import { FunktionswegeUebersicht } from "./FunktionswegeUebersicht";
import { KatalogProduktpfade } from "./KatalogProduktpfade";
import { KatalogVergleich } from "./KatalogVergleich";

const feld =
  "mt-1 w-full rounded-btn border border-hairline bg-surface px-3 py-2 text-sm font-medium text-text focus-visible:outline-brand";
const staende: KatalogKantenstand[] = ["nachgewiesen", "dokumentiert", "vorgesehen"];

function enthaelt(weg: KatalogWeg, id: string): boolean {
  return weg.verbindungen.some((k) => k.von === id || k.nach === id);
}

function Anschluss({
  kante,
  ausgehend,
  andere,
  sprache,
  ziel,
  folgen,
}: {
  folgen: (event: MouseEvent<HTMLAnchorElement>) => void;
  kante: KatalogVerbindung;
  ausgehend: boolean;
  andere: KatalogEintrag;
  sprache: KatalogSprache;
  ziel: string;
}): JSX.Element {
  const { t } = useTranslation();
  const Icon = ausgehend ? ArrowUpRight : ArrowDownLeft;
  return (
    <li className="space-y-2 rounded-btn border border-hairline bg-surface p-3">
      <GuardedLink
        to={ziel}
        onClick={folgen}
        preventScrollReset
        className="group block rounded-btn text-left focus-visible:outline-brand"
      >
        <span className="flex items-start gap-2 text-sm font-semibold text-text">
          <Icon size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-brand-text" />
          <span className="min-w-0 break-words group-hover:underline">{andere.title[sprache]}</span>
        </span>
        <span className="mt-1 block pl-6 text-sm leading-snug text-muted">
          {kante.text[sprache]}
        </span>
      </GuardedLink>
      <details>
        <summary className="cursor-pointer text-xs font-medium text-muted focus-visible:outline-brand">
          {t(`funktionskatalog.edge.${kante.stand}`)} · {t("funktionskatalog.evidence")}
        </summary>
        <p className="mt-1 break-words text-xs leading-relaxed text-muted [overflow-wrap:anywhere]">
          {kante.beleg[sprache]}
        </p>
      </details>
    </li>
  );
}

export function AdminFunktionskarte({
  katalog,
  sprache,
  treffer,
  gefiltert,
  wegId,
  knotenId,
  vonId,
  ziel,
}: {
  katalog: Funktionskatalog;
  sprache: KatalogSprache;
  treffer: KatalogEintrag[];
  gefiltert: boolean;
  wegId: string | null;
  knotenId: string | null;
  vonId: string | null;
  ziel: (werte: Record<string, string | null>) => string;
}): JSX.Element {
  const { t } = useTranslation();
  const navigate = useGuardedNavigate();
  const stationskopf = useRef<HTMLHeadingElement>(null);
  function folgen(event: MouseEvent<HTMLAnchorElement>): void {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey)
      return;
    window.requestAnimationFrame(() => {
      stationskopf.current?.focus({ preventScroll: true });
      if (window.matchMedia?.("(max-width: 1279px)").matches)
        stationskopf.current?.scrollIntoView?.({ block: "nearest" });
    });
  }
  const eintraege = useMemo(
    () => new Map(katalog.entries.map((e) => [e.id, e])),
    [katalog.entries],
  );
  const treffermenge = useMemo(() => new Set(treffer.map((e) => e.id)), [treffer]);
  const wege = katalog.wege ?? [];
  const passendeWege = gefiltert
    ? wege.filter((w) =>
        w.verbindungen.some((k) => treffermenge.has(k.von) || treffermenge.has(k.nach)),
      )
    : wege;
  if (!treffer.length)
    return (
      <p className="rounded-card border border-hairline bg-surface p-4 text-sm text-muted">
        {t("funktionskatalog.empty")}
      </p>
    );
  const wunsch = knotenId ? eintraege.get(knotenId) : undefined;
  const gewaehlt = (wunsch ? wege : passendeWege).find((w) => w.id === wegId);
  const weg = wunsch
    ? gewaehlt && enthaelt(gewaehlt, wunsch.id)
      ? gewaehlt
      : wege.find((w) => enthaelt(w, wunsch.id))
    : (gewaehlt ?? passendeWege[0]);
  const erster = weg?.verbindungen
    .flatMap((k) => [k.von, k.nach])
    .find((id) => treffermenge.has(id));
  const einstieg =
    weg?.id === "dokumentpruefung" && !gefiltert && eintraege.has("V02") ? "V02" : erster;
  const aktiv = wunsch ?? (einstieg ? eintraege.get(einstieg) : undefined) ?? treffer[0];
  if (!aktiv) return <p>{t("funktionskatalog.empty")}</p>;
  const stationsziel = (id: string) => ziel({ weg: weg?.id ?? null, knoten: id, funktion: null });
  const pfeil = weg?.verbindungen.find((k) => k.von === vonId && k.nach === aktiv.id);
  const gruppe = katalog.groups.find((g) => g.id === aktiv.group);
  const einordnung = aktiv.platforms.map((p) => t(`funktionskatalog.product.${p}`)).join(" · ");
  const weitere = wege.filter((w) => w.id !== weg?.id && enthaelt(w, aktiv.id));
  const optionen = weg && !passendeWege.includes(weg) ? [weg, ...passendeWege] : passendeWege;
  const knotenImFilter = treffermenge.has(aktiv.id);
  return (
    <section
      aria-label={t("funktionskatalog.map")}
      className="min-w-0 space-y-4"
      data-testid="funktionskarte"
    >
      <div className="grid gap-3 rounded-card border border-hairline bg-surface p-4 sm:grid-cols-2">
        <label className="min-w-0 text-xs font-semibold text-muted">
          <span className="flex items-center gap-2">
            <Route size={15} aria-hidden="true" />
            {t("funktionskatalog.path")}
          </span>
          <select
            className={feld}
            data-katalog-weg
            value={weg?.id ?? ""}
            onChange={(evt) =>
              navigate(ziel({ weg: evt.target.value, knoten: null, funktion: null }), {
                preventScrollReset: true,
              })
            }
          >
            {!weg && <option value="">{t("funktionskatalog.choosePath")}</option>}
            {optionen.map((w) => (
              <option key={w.id} value={w.id}>
                {w.titel[sprache]}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 text-xs font-semibold text-muted">
          <span className="flex items-center gap-2">
            <MapPin size={15} aria-hidden="true" />
            {t("funktionskatalog.startFeature")}
          </span>
          <select
            data-katalog-start
            className={feld}
            value={aktiv.id}
            onChange={(evt) => {
              const id = evt.target.value;
              navigate(
                ziel({ knoten: id, weg: weg && enthaelt(weg, id) ? weg.id : null, funktion: null }),
                { preventScrollReset: true },
              );
            }}
          >
            {!knotenImFilter && <option value={aktiv.id}>{aktiv.title[sprache]}</option>}
            {katalog.groups.map((g) => {
              const gruppeTreffer = treffer.filter((e) => e.group === g.id);
              return (
                gruppeTreffer.length > 0 && (
                  <optgroup key={g.id} label={g.label[sprache]}>
                    {gruppeTreffer.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.title[sprache]}
                      </option>
                    ))}
                  </optgroup>
                )
              );
            })}
          </select>
        </label>
      </div>
      <KatalogProduktpfade
        gruppen={katalog.groups}
        eintraege={treffer}
        aktiv={aktiv}
        sprache={sprache}
        ziel={(id) =>
          ziel({ knoten: id, weg: weg && enthaelt(weg, id) ? weg.id : null, funktion: null })
        }
        folgen={folgen}
      />
      {optionen.length > 0 && (
        <FunktionswegeUebersicht
          wege={optionen}
          eintraege={eintraege}
          sprache={sprache}
          ziel={ziel}
          aktiv={weg?.id}
        />
      )}
      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-card border border-hairline bg-surface p-4">
          {weg ? (
            <>
              <h3 className="text-lg font-semibold leading-snug text-text">{weg.titel[sprache]}</h3>
              <p className="mb-3 mt-1 text-sm leading-relaxed text-muted">
                {t("funktionskatalog.follow")}
              </p>
              <FunktionswegeGraph
                weg={weg}
                eintraege={eintraege}
                sprache={sprache}
                aktiv={aktiv.id}
                stationsziel={stationsziel}
                pfeilziel={(von, nach) => ziel({ weg: weg.id, knoten: nach, von, funktion: null })}
                vonId={vonId}
                folgen={folgen}
              />
              <ul
                aria-label={t("funktionskatalog.edgeLegend")}
                className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-hairline pt-3"
              >
                {staende
                  .filter((s) => weg.verbindungen.some((k) => k.stand === s))
                  .map((s) => (
                    <li key={s} className="flex items-center gap-1.5 text-xs text-muted">
                      <Linienzeichen stand={s} />
                      {t(`funktionskatalog.edge.${s}`)}
                    </li>
                  ))}
              </ul>
            </>
          ) : (
            <>
              <h3 className="font-semibold">{t("funktionskatalog.classification")}</h3>
              <ol className="mt-3 space-y-2 border-l-2 border-hairline pl-4 text-sm">
                <li>{einordnung}</li>
                <li>{gruppe?.label[sprache]}</li>
                <li className="font-semibold text-text">{aktiv.title[sprache]}</li>
              </ol>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                {t("funktionskatalog.noPath")}
              </p>
            </>
          )}
        </section>
        <section
          key={aktiv.id}
          aria-label={t("funktionskatalog.station")}
          data-katalog-station={aktiv.id}
          className="min-w-0 space-y-4 rounded-card border border-hairline bg-surface p-4"
        >
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-brand-text">
              <MapPin size={14} aria-hidden="true" />
              {t("funktionskatalog.station")}
            </p>
            <h3
              ref={stationskopf}
              tabIndex={-1}
              className="rounded-btn text-lg font-semibold leading-snug outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {aktiv.title[sprache]}
            </h3>
            <p className="mt-1 text-xs text-muted">
              {einordnung} · {t(`funktionskatalog.status.${aktiv.status}`)}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-text">{aktiv.description[sprache]}</p>
            <GuardedLink
              to={ziel({ funktion: aktiv.id })}
              state={{ katalogDialog: true }}
              preventScrollReset
              aria-haspopup="dialog"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-text hover:underline focus-visible:outline-brand"
            >
              <BookOpen size={14} aria-hidden="true" />
              {t("funktionskatalog.details")}
            </GuardedLink>
          </div>
          {pfeil && (
            <section
              data-katalog-kante
              className="rounded-btn border border-brand bg-brand/5 p-3 space-y-1 text-text"
            >
              <h4 className="text-xs font-semibold text-muted">
                {t("funktionskatalog.selectedEdge")}
              </h4>
              <p className="text-xs text-muted">
                {eintraege.get(pfeil.von)?.title[sprache]} → {aktiv.title[sprache]}
              </p>
              <p className="text-sm font-semibold">{pfeil.text[sprache]}</p>
              <p className="text-xs leading-relaxed text-muted [overflow-wrap:anywhere]">
                {t(`funktionskatalog.edge.${pfeil.stand}`)} · {pfeil.beleg[sprache]}
              </p>
            </section>
          )}
          {[true, false].map((ausgehend) => {
            const kanten =
              weg?.verbindungen.filter((k) =>
                ausgehend ? k.von === aktiv.id : k.nach === aktiv.id,
              ) ?? [];
            return (
              kanten.length > 0 && (
                <div key={String(ausgehend)}>
                  <h4 className="mb-2 text-sm font-semibold">
                    {t(ausgehend ? "funktionskatalog.toStation" : "funktionskatalog.fromStation")}
                  </h4>
                  <ul className="space-y-2">
                    {kanten.map((k) => {
                      const andere = eintraege.get(ausgehend ? k.nach : k.von);
                      return (
                        andere && (
                          <Anschluss
                            key={`${k.von}-${k.nach}`}
                            kante={k}
                            ausgehend={ausgehend}
                            andere={andere}
                            sprache={sprache}
                            ziel={stationsziel(andere.id)}
                            folgen={folgen}
                          />
                        )
                      );
                    })}
                  </ul>
                </div>
              )
            );
          })}
          {weitere.length > 0 && (
            <div className="border-t border-hairline pt-3">
              <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <GitBranch size={15} aria-hidden="true" />
                {t("funktionskatalog.transfer")}
              </h4>
              <ul className="space-y-2">
                {weitere.map((w) => (
                  <li key={w.id}>
                    <GuardedLink
                      to={ziel({ weg: w.id, knoten: aktiv.id, funktion: null })}
                      preventScrollReset
                      className="inline-flex items-center gap-1 text-sm font-semibold text-brand-text hover:underline focus-visible:outline-brand"
                    >
                      {w.titel[sprache]}
                      <ArrowRight size={13} aria-hidden="true" />
                    </GuardedLink>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
      {aktiv.id === "V02" && <KatalogVergleich />}
    </section>
  );
}
