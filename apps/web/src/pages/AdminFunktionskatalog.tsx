import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  List,
  Route,
  ScanLine,
  Search,
  SlidersHorizontal,
  Workflow,
} from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useSearchParams } from "react-router-dom";
import type {
  Funktionskatalog,
  KatalogEintrag,
  KatalogPlattform,
  KatalogSprache,
  KatalogStatus,
} from "../../../../services/app/src/funktionskatalog/vertrag";
import { api } from "../api/client";
import { GuardedLink, useGuardedNavigate } from "../app/NavGuardContext";
import { Modal } from "../components/Modal";
import texte from "../texte/funktionskatalog";
import { AdminFunktionskarte } from "./AdminFunktionskarte";
import { KatalogVergleich } from "./KatalogVergleich";

const produkte: KatalogPlattform[] = ["klarwerk", "office", "app"];
const statusListe: KatalogStatus[] = [
  "available",
  "poc",
  "contract",
  "partial",
  "commissioned",
  "planned",
  "idea",
  "deferred",
  "excluded",
  "historical",
];
const sprachen: KatalogSprache[] = ["de", "en", "nl"];
const seitengroesse = 20;
const feld =
  "w-full rounded-btn border border-hairline bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand";
const knopf =
  "inline-flex items-center justify-center gap-1 rounded-btn border border-hairline bg-surface px-3 py-2 text-sm font-medium text-text hover:bg-hairline-soft focus-visible:outline-brand";
const badgeFarben: Record<KatalogStatus, string> = {
  poc: "bg-trust-info-bg text-trust-info-text",
  contract: "bg-trust-warn-bg text-trust-warn-text",
  available: "bg-trust-pos-bg text-trust-pos-text",
  partial: "bg-trust-warn-bg text-trust-warn-text",
  commissioned: "bg-trust-info-bg text-trust-info-text",
  planned: "bg-trust-info-bg text-trust-info-text",
  idea: "bg-hairline-soft text-muted",
  deferred: "bg-trust-warn-bg text-trust-warn-text",
  excluded: "bg-trust-crit-bg text-trust-crit-text",
  historical: "bg-hairline-soft text-muted",
};

function Status({ status }: { status: KatalogStatus }): JSX.Element {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${badgeFarben[status]}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {t(`funktionskatalog.status.${status}`)}
    </span>
  );
}

function sucheNormalisieren(s: string): string {
  return s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/ß/g, "ss");
}
function indexiere(katalog: Funktionskatalog) {
  const themen = new Map(katalog.groups.map((g) => [g.id, g.label]));
  return katalog.entries.map((e) => {
    const felder = [
      e.title,
      e.description,
      e.input,
      e.output,
      ...(e.scope ? [e.scope] : []),
      ...e.sources.map((s) => s.label),
    ];
    const gruppe = themen.get(e.group);
    if (gruppe) felder.push(gruppe);
    const bezeichnungen = sprachen.flatMap((l) => [
      texte[l][`funktionskatalog.status.${e.status}`],
      ...e.platforms.map((p) => texte[l][`funktionskatalog.product.${p}`]),
    ]);
    const text = sucheNormalisieren(
      [
        e.id,
        ...felder.flatMap((f) => Object.values(f)),
        ...bezeichnungen,
        ...e.sources.map((s) => s.reference),
      ].join(" "),
    );
    return { e, text };
  });
}

function KatalogDetail({
  eintrag: e,
  sprache,
  gruppe,
}: { eintrag: KatalogEintrag; sprache: KatalogSprache; gruppe: string }): JSX.Element {
  const { t } = useTranslation();
  const schritte = [
    { label: "input", wert: e.input[sprache], Icon: ScanLine },
    { label: "action", wert: e.title[sprache], Icon: Workflow },
    { label: "output", wert: e.output[sprache], Icon: ArrowDownToLine },
  ];
  return (
    <div className="space-y-5 text-sm text-text">
      <div className="flex flex-wrap items-center gap-2">
        <Status status={e.status} />
        <span className="text-muted">
          {[gruppe, ...e.platforms.map((p) => t(`funktionskatalog.product.${p}`))].join(" · ")}
        </span>
      </div>
      <p className="leading-relaxed">{e.description[sprache]}</p>
      <section>
        <h3 className="mb-2 font-semibold">{t("funktionskatalog.flow")}</h3>
        <ol className="grid gap-3 sm:grid-cols-3">
          {schritte.map(({ label, wert, Icon }, i) => (
            <li
              key={label}
              className="relative min-w-0 rounded-card border border-hairline bg-hairline-soft p-3"
            >
              <div className="mb-2 flex items-center gap-2 text-muted">
                <Icon size={16} aria-hidden="true" />
                <span className="font-semibold">{t(`funktionskatalog.${label}`)}</span>
              </div>
              <p className="break-words leading-relaxed">{wert}</p>
              {i < 2 && (
                <ArrowRight
                  size={14}
                  aria-hidden="true"
                  className="absolute -bottom-3 left-1/2 rotate-90 bg-surface text-muted sm:-right-3 sm:bottom-auto sm:left-auto sm:top-1/2 sm:rotate-0"
                />
              )}
            </li>
          ))}
        </ol>
      </section>
      {e.scope && (
        <section>
          <h3 className="mb-1 font-semibold">{t("funktionskatalog.scope")}</h3>
          <p className="leading-relaxed">{e.scope[sprache]}</p>
        </section>
      )}
      <section className="border-t border-hairline pt-3">
        <h3 className="mb-2 flex items-center gap-2 font-semibold">
          <BookOpen size={16} aria-hidden="true" />
          {t("funktionskatalog.sources")}
        </h3>
        <ul className="space-y-2">
          {e.sources.map((s) => (
            <li
              key={s.reference + s.label[sprache]}
              className="flex flex-wrap items-baseline gap-x-2"
            >
              <span>{s.label[sprache]}</span>
              <span className="break-all text-xs text-muted">{s.reference}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function AdminFunktionskatalog(): JSX.Element {
  const { t, i18n } = useTranslation();
  const lng = i18n.resolvedLanguage?.split("-")[0] ?? i18n.language.split("-")[0];
  const sprache: KatalogSprache = lng === "en" || lng === "nl" ? lng : "de";
  const [params] = useSearchParams();
  const ort = useLocation();
  const navigate = useGuardedNavigate();
  const laden = useQuery({
    queryKey: ["admin", "funktionskatalog"],
    queryFn: () => api.get<Funktionskatalog>("/admin/funktionen"),
  });
  const katalog = laden.data;
  const index = useMemo(() => (katalog ? indexiere(katalog) : []), [katalog]);
  const q = params.get("q") ?? "";
  const produkt = params.get("produkt") ?? "";
  const thema = params.get("thema") ?? "";
  const status = params.get("status") ?? "";
  const id = params.get("funktion");
  const karte = params.get("ansicht") === "karte";
  const treffer = useMemo(() => {
    const worte = sucheNormalisieren(q).trim().split(/\s+/).filter(Boolean);
    const sortierung = new Intl.Collator(sprache, { numeric: true, sensitivity: "base" });
    return index
      .filter(
        ({ e, text }) =>
          (!produkt || e.platforms.some((p) => p === produkt)) &&
          (!thema || e.group === thema) &&
          (!status || e.status === status) &&
          worte.every((w) => text.includes(w)),
      )
      .map(({ e }) => e)
      .sort(
        (a, b) =>
          sortierung.compare(a.title[sprache], b.title[sprache]) || a.id.localeCompare(b.id),
      );
  }, [index, q, produkt, thema, status, sprache]);
  const gruppe = (g: string) =>
    katalog?.groups.find((thema) => thema.id === g)?.label[sprache] ?? g;
  const seiten = Math.max(1, Math.ceil(treffer.length / seitengroesse));
  const nr = Number(params.get("seite"));
  const seite = Number.isSafeInteger(nr) && nr >= 1 ? Math.min(nr, seiten) : 1;
  const gefiltert = Boolean(q || produkt || thema || status);
  const detail = id ? katalog?.entries.find((e) => e.id === id) : undefined;
  function ziel(aenderung: Record<string, string | null>): string {
    const neu = new URLSearchParams(params);
    if (("knoten" in aenderung || "weg" in aenderung) && !("von" in aenderung)) neu.delete("von");
    for (const [k, v] of Object.entries(aenderung)) {
      if (v) neu.set(k, v);
      else neu.delete(k);
    }
    return `${ort.pathname}?${neu}`;
  }
  function filter(k: string, v: string): void {
    navigate(ziel({ [k]: v, seite: null, funktion: null, weg: null, knoten: null }), {
      replace: k === "q",
      preventScrollReset: true,
    });
  }
  function schliessen(): void {
    if (ort.state?.katalogDialog === true) {
      navigate(-1);
      return;
    }
    navigate(ziel({ funktion: null }), { replace: true, preventScrollReset: true });
  }
  function reset(): void {
    navigate(
      ziel({ produkt: null, thema: null, status: null, q: null, seite: null, funktion: null }),
      { preventScrollReset: true },
    );
  }
  const filterFelder = katalog && (
    <>
      <div className="space-y-3 rounded-card border border-hairline bg-surface p-4">
        <label className="relative block">
          <span className="sr-only">{t("funktionskatalog.search")}</span>
          <Search
            strokeWidth={1.8}
            size={17}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            className={`${feld} pl-9`}
            value={q}
            placeholder={t("funktionskatalog.placeholder")}
            onChange={(e) => filter("q", e.target.value)}
          />
        </label>
        <fieldset className="flex flex-wrap gap-1.5">
          <legend className="sr-only">{t("funktionskatalog.products")}</legend>
          {["", ...produkte].map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={produkt === p}
              onClick={() => filter("produkt", p)}
              className={`rounded-btn border px-3 py-1.5 text-xs font-semibold focus-visible:outline-brand ${
                produkt === p
                  ? "border-ink bg-ink text-white"
                  : "border-hairline text-muted hover:bg-hairline-soft"
              }`}
            >
              {p ? t(`funktionskatalog.product.${p}`) : t("funktionskatalog.allProducts")}
              {karte && p && (
                <span className="ml-1.5 font-mono text-xs">
                  {
                    katalog.entries.filter((e) => e.platforms.some((plattform) => plattform === p))
                      .length
                  }
                </span>
              )}
            </button>
          ))}
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="min-w-0 text-xs font-semibold text-muted">
            {t("funktionskatalog.topic")}
            <select
              className={`${feld} mt-1 font-normal`}
              value={thema}
              onChange={(e) => filter("thema", e.target.value)}
            >
              <option value="">{t("funktionskatalog.allTopics")}</option>
              {katalog.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label[sprache]}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 text-xs font-semibold text-muted">
            {t("funktionskatalog.status")}
            <select
              className={`${feld} mt-1 font-normal`}
              value={status}
              onChange={(e) => filter("status", e.target.value)}
            >
              <option value="">{t("funktionskatalog.allStatus")}</option>
              {statusListe.map((s) => (
                <option key={s} value={s}>
                  {t(`funktionskatalog.status.${s}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <output className="text-sm font-semibold text-muted">
          {t("funktionskatalog.count", { count: treffer.length })}
        </output>
        {gefiltert && (
          <button
            type="button"
            className="rounded-btn text-sm font-semibold text-brand-text hover:underline"
            onClick={reset}
          >
            {t("funktionskatalog.reset")}
          </button>
        )}
      </div>
    </>
  );
  const stand = katalog?.stand ? new Date(katalog.stand) : null;
  return (
    <section className="min-w-0 space-y-4" data-testid="funktionskatalog">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold tracking-tight text-text">
          {t("funktionskatalog.heading")}
        </h2>
        {stand && Number.isFinite(stand.getTime()) && (
          <time dateTime={katalog?.stand} className="text-xs text-muted">
            {t("funktionskatalog.stand", {
              date: new Intl.DateTimeFormat(sprache, {
                dateStyle: "medium",
                timeZone: "UTC",
              }).format(stand),
            })}
          </time>
        )}
      </header>
      {katalog && !karte && <p className="text-sm text-muted">{t("funktionskatalog.legend")}</p>}
      {!katalog ? (
        laden.isError ? (
          <div role="alert" className="space-y-2">
            <p>{t("funktionskatalog.error")}</p>
            <button type="button" className={knopf} onClick={() => void laden.refetch()}>
              {t("funktionskatalog.retry")}
            </button>
          </div>
        ) : (
          <output>{t("funktionskatalog.loading")}</output>
        )
      ) : (
        <>
          <nav
            aria-label={t("funktionskatalog.view")}
            className="inline-flex flex-wrap gap-1 rounded-btn border border-hairline bg-surface p-1"
          >
            {[
              { aktiv: false, Icon: List, titel: "list" },
              { aktiv: true, Icon: Route, titel: "map" },
            ].map(({ aktiv, Icon, titel }) => (
              <GuardedLink
                key={titel}
                to={ziel({ ansicht: aktiv ? "karte" : null, funktion: null })}
                preventScrollReset
                aria-current={aktiv === karte ? "page" : undefined}
                className={`inline-flex items-center gap-2 rounded-btn px-3 py-2 text-sm font-semibold focus-visible:outline-brand ${aktiv === karte ? "bg-ink text-white" : "text-muted hover:bg-hairline-soft"}`}
              >
                <Icon size={16} aria-hidden="true" />
                {t(`funktionskatalog.${titel}`)}
              </GuardedLink>
            ))}
          </nav>
          {karte ? (
            <>
              <details
                className="rounded-card border border-hairline bg-surface px-3 py-2"
                data-katalog-filter
              >
                <summary className="cursor-pointer rounded-btn text-sm font-medium text-text focus-visible:outline-brand">
                  <SlidersHorizontal size={14} aria-hidden="true" className="mx-1 inline" />
                  {t("funktionskatalog.filters")}
                  <span className="ml-2 text-xs text-muted">
                    {t("funktionskatalog.count", { count: treffer.length })}
                  </span>
                </summary>
                <div className="mt-3 space-y-2">{filterFelder}</div>
              </details>
              <AdminFunktionskarte
                katalog={katalog}
                sprache={sprache}
                treffer={treffer}
                gefiltert={gefiltert}
                wegId={params.get("weg")}
                knotenId={params.get("knoten")}
                vonId={params.get("von")}
                ziel={ziel}
              />
            </>
          ) : (
            <>
              {filterFelder}
              {treffer.length ? (
                <ul className="divide-y divide-hairline overflow-hidden rounded-card border border-hairline bg-surface">
                  {treffer.slice((seite - 1) * seitengroesse, seite * seitengroesse).map((e) => (
                    <li key={e.id}>
                      <GuardedLink
                        to={ziel({ funktion: e.id })}
                        state={{ katalogDialog: true }}
                        aria-haspopup="dialog"
                        className="group flex items-center gap-3 px-4 py-4 text-text hover:bg-hairline-soft focus-visible:outline-brand focus-visible:-outline-offset-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <strong className="break-words text-base font-semibold group-hover:underline">
                              {e.title[sprache]}
                            </strong>
                            <Status status={e.status} />
                          </div>
                          <p className="line-clamp-2 text-sm leading-relaxed text-muted">
                            {e.description[sprache]}
                          </p>
                          <p className="mt-2 text-xs text-muted">
                            {[
                              gruppe(e.group),
                              ...e.platforms.map((p) => t(`funktionskatalog.product.${p}`)),
                            ].join(" · ")}
                          </p>
                        </div>
                        <ChevronRight
                          size={17}
                          aria-hidden="true"
                          className="shrink-0 text-muted"
                        />
                      </GuardedLink>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-card border border-hairline bg-surface p-4 text-sm text-muted">
                  {t("funktionskatalog.empty")}
                </p>
              )}
              {seiten > 1 && (
                <nav
                  aria-label={t("funktionskatalog.pages")}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <button
                    type="button"
                    className={`${knopf} disabled:opacity-40`}
                    disabled={seite <= 1}
                    onClick={() => navigate(ziel({ seite: String(seite - 1) }))}
                  >
                    <ChevronLeft size={14} aria-hidden="true" />
                    {t("funktionskatalog.prev")}
                  </button>
                  <span className="text-xs text-muted">
                    {t("funktionskatalog.page", { page: seite, total: seiten })}
                  </span>
                  <button
                    type="button"
                    className={`${knopf} disabled:opacity-40`}
                    disabled={seite >= seiten}
                    onClick={() => navigate(ziel({ seite: String(seite + 1) }))}
                  >
                    {t("funktionskatalog.next")}
                    <ChevronRight size={14} aria-hidden="true" />
                  </button>
                </nav>
              )}
            </>
          )}
          <Modal
            open={Boolean(id)}
            title={detail?.title[sprache] ?? t("funktionskatalog.heading")}
            onClose={schliessen}
            wide
            panelMarker="data-katalog-dialog"
          >
            {detail ? (
              <div className="space-y-4">
                <KatalogDetail eintrag={detail} gruppe={gruppe(detail.group)} sprache={sprache} />
                {detail.id === "V02" && <KatalogVergleich />}
                {!karte && (
                  <GuardedLink
                    to={ziel({ ansicht: "karte", knoten: detail.id, weg: null, funktion: null })}
                    replace
                    className={knopf}
                  >
                    <Route size={15} aria-hidden="true" />
                    {t("funktionskatalog.onMap")}
                  </GuardedLink>
                )}
              </div>
            ) : (
              <p>{t("funktionskatalog.absent")}</p>
            )}
          </Modal>
        </>
      )}
    </section>
  );
}
