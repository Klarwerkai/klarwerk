import { ChevronRight, Layers3, Monitor, PanelsTopLeft, Smartphone } from "lucide-react";
import { type MouseEventHandler, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  Funktionskatalog,
  KatalogEintrag,
  KatalogPlattform,
  KatalogSprache,
} from "../../../../services/app/src/funktionskatalog/vertrag";
import { GuardedLink } from "../app/NavGuardContext";

const produkte = [
  { id: "klarwerk", Icon: PanelsTopLeft },
  { id: "office", Icon: Monitor },
  { id: "app", Icon: Smartphone },
] as const;

export function KatalogProduktpfade({
  gruppen,
  eintraege,
  aktiv,
  sprache,
  ziel,
  folgen,
}: {
  gruppen: Funktionskatalog["groups"];
  eintraege: KatalogEintrag[];
  aktiv: KatalogEintrag;
  sprache: KatalogSprache;
  ziel: (id: string) => string;
  folgen: MouseEventHandler<HTMLAnchorElement>;
}): JSX.Element {
  const { t } = useTranslation();
  const id = useId();
  const [wahl, waehle] = useState<{ produkt: KatalogPlattform; gruppe: string } | null>(null);
  const vorhanden = produkte
    .map((p) => ({ ...p, eintraege: eintraege.filter((e) => e.platforms.includes(p.id)) }))
    .filter((p) => p.eintraege.length);
  const produkt =
    vorhanden.find((p) => p.id === wahl?.produkt) ??
    vorhanden.find((p) => aktiv.platforms.includes(p.id)) ??
    vorhanden[0];
  if (!produkt) return <></>;
  const kategorien = gruppen
    .map((g) => ({ ...g, eintraege: produkt.eintraege.filter((e) => e.group === g.id) }))
    .filter((g) => g.eintraege.length);
  const thema =
    kategorien.find((g) => g.id === wahl?.gruppe) ??
    kategorien.find((g) => g.id === aktiv.group) ??
    kategorien[0];
  if (!thema) return <></>;
  return (
    <details
      className="rounded-card border border-hairline bg-surface px-4 py-3"
      data-katalog-struktur
    >
      <summary className="cursor-pointer rounded-btn text-sm font-semibold focus-visible:outline-brand">
        <Layers3 size={16} aria-hidden="true" className="mx-1 inline text-brand-text" />
        {t("funktionskatalog.productPaths")}
      </summary>
      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,1.3fr)]">
        <fieldset className="min-w-0">
          <legend className="mb-1.5 text-xs font-semibold text-muted">
            {t("funktionskatalog.products")}
          </legend>
          <div className="space-y-1">
            {vorhanden.map(({ id: pid, eintraege: liste, Icon }) => (
              <button
                type="button"
                key={pid}
                aria-pressed={pid === produkt.id}
                onClick={() => waehle({ produkt: pid, gruppe: "" })}
                className={`flex w-full items-center gap-2 rounded-btn border px-2 py-2 text-left text-xs font-medium focus-visible:outline-brand ${pid === produkt.id ? "border-brand bg-brand/5" : "border-hairline"}`}
              >
                <Icon size={16} aria-hidden="true" className="shrink-0" />
                <span className="flex-1">{t(`funktionskatalog.product.${pid}`)}</span>
                <span className="font-mono">{liste.length}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <div className="min-w-0">
          <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-muted">
            {t("funktionskatalog.topic")}
          </label>
          <select
            id={id}
            value={thema.id}
            onChange={(e) => waehle({ produkt: produkt.id, gruppe: e.target.value })}
            className="w-full rounded-btn border border-hairline bg-surface p-2 text-sm focus-visible:outline-brand"
          >
            {kategorien.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label[sprache]} ({g.eintraege.length})
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <p className="mb-1.5 text-xs font-semibold text-muted">
            {t("funktionskatalog.count", { count: thema.eintraege.length })}
          </p>
          <ul className="max-h-56 space-y-1 overflow-auto border-l-2 border-hairline pl-2">
            {thema.eintraege.map((e) => (
              <li key={e.id}>
                <GuardedLink
                  to={ziel(e.id)}
                  onClick={folgen}
                  preventScrollReset
                  aria-current={e.id === aktiv.id ? "step" : undefined}
                  className="flex items-center gap-1.5 rounded-btn p-1 text-sm text-brand-text hover:underline focus-visible:outline-brand"
                >
                  <ChevronRight size={13} aria-hidden="true" className="shrink-0" />
                  {e.title[sprache]}
                </GuardedLink>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}
