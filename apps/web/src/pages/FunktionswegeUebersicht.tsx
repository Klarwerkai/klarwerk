import { ArrowLeftRight, CircleDot, Network } from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  KatalogEintrag,
  KatalogSprache,
  KatalogWeg,
} from "../../../../services/app/src/funktionskatalog/vertrag";
import { GuardedLink } from "../app/NavGuardContext";

export function FunktionswegeUebersicht({
  wege,
  eintraege,
  sprache,
  ziel,
  aktiv,
}: {
  wege: KatalogWeg[];
  eintraege: Map<string, KatalogEintrag>;
  sprache: KatalogSprache;
  ziel: (werte: Record<string, string | null>) => string;
  aktiv: string | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const stationen = wege.map((w) => new Set(w.verbindungen.flatMap((k) => [k.von, k.nach])));
  const paare = wege.flatMap((links, i) =>
    wege.slice(i + 1).flatMap((rechts, j) => {
      const gegen = stationen[i + j + 1];
      const gemeinsame = [...(stationen[i] ?? [])].filter((id) => gegen?.has(id));
      return gemeinsame.map((id) => ({ links, rechts, id }));
    }),
  );
  const einzeln = wege.filter((w) => !paare.some((p) => p.links === w || p.rechts === w));
  function weglink(w: KatalogWeg, id: string | null) {
    return (
      <GuardedLink
        key={w.id}
        to={ziel({ weg: w.id, knoten: id, funktion: null })}
        preventScrollReset
        className={`flex min-w-0 items-center gap-2 rounded-btn border px-3 py-2 text-sm font-semibold text-text hover:underline focus-visible:outline-brand ${aktiv === w.id ? "border-brand bg-brand/5" : "border-hairline bg-surface"}`}
      >
        <CircleDot size={15} aria-hidden="true" className="shrink-0 text-brand-text" />
        {w.titel[sprache]}
      </GuardedLink>
    );
  }
  return (
    <details className="rounded-card border border-hairline bg-surface px-4 py-3" data-katalog-netz>
      <summary className="cursor-pointer rounded-btn text-sm font-semibold focus-visible:outline-brand">
        <Network size={16} aria-hidden="true" className="mx-1 inline text-brand-text" />
        {t("funktionskatalog.pathOverview")}
      </summary>
      <div className="mt-3 space-y-3">
        {paare.map(({ links, rechts, id }) => (
          <div
            key={links.id + rechts.id + id}
            className="grid items-center gap-1 rounded-btn bg-hairline-soft p-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1fr)]"
          >
            {weglink(links, id)}
            <div className="flex items-center justify-center gap-1.5 py-1 text-center text-xs font-medium text-muted">
              <ArrowLeftRight
                size={14}
                aria-hidden="true"
                className="shrink-0 rotate-90 lg:rotate-0"
              />
              {t("funktionskatalog.via", { feature: eintraege.get(id)?.title[sprache] ?? id })}
            </div>
            {weglink(rechts, id)}
          </div>
        ))}
        {einzeln.length > 0 && (
          <div className="flex flex-wrap gap-2">{einzeln.map((w) => weglink(w, null))}</div>
        )}
      </div>
    </details>
  );
}
