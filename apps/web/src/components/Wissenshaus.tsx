// ================================================================================================
// FE-MGMT-08 / FR-EXT-05 / R-0768 · R-1772 · R-2111 — DAS WISSENSHAUS (COMPANY MEMORY, VISUELL).
// ================================================================================================
//
// Abnahme der Quelle: „Screen zeigt Haus mit Domänen-Füllgrad + KPIs"; Domänen = Stockwerke,
// gesichert vs. fragil; Import → Haus → Output. Die Fläche RECHNET NICHTS: Stockwerke und Zähler
// kommen aus dem Management-Snapshot (services/management/src/metrics.ts, `house`/`houseFlow`).
//
// Gezeichnet wird ein Haus: Dach, darunter ein Stockwerk je Fachgebiet (das vollste oben), ganz
// unten das Stockwerk „ohne Fachgebiet". Jedes Stockwerk trägt seinen Füllgrad als Balken und sagt,
// ob es gesichert oder fragil ist — und warum fragil. Darüber: Import → Haus → Ausgabe.
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MgmtHouseFloor, MgmtHouseFlow } from "../api/types";
import { cx } from "./ui";

function Stockwerk({ floor }: { floor: MgmtHouseFloor }): JSX.Element {
  const { t } = useTranslation();
  const name = floor.domain ?? t("wissenshaus.ohneFachgebiet");
  const gruende = [
    floor.validatedRatio < 50 ? t("wissenshaus.grund.fuellgrad") : null,
    floor.singleSource ? t("wissenshaus.grund.einzelquelle") : null,
  ].filter((g): g is string => g !== null);
  return (
    <li
      data-testid="haus-stockwerk"
      data-fachgebiet={floor.domain ?? ""}
      data-zustand={floor.fragile ? "fragil" : "gesichert"}
      className={cx(
        "border-x border-b px-3 py-2",
        floor.fragile ? "border-trust-crit-fill/30 bg-trust-crit-bg" : "border-hairline bg-page",
        floor.domain === null && "border-dashed",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[13px] text-text">{name}</span>
        <span
          data-testid="haus-zustand"
          className={cx(
            "shrink-0 rounded-pill px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase",
            floor.fragile
              ? "bg-trust-crit-bg text-trust-crit-text"
              : "bg-trust-pos-bg text-trust-pos-text",
          )}
        >
          {t(floor.fragile ? "wissenshaus.zustand.fragil" : "wissenshaus.zustand.gesichert")}
          {gruende.length > 0 ? ` · ${gruende.join(", ")}` : ""}
        </span>
      </div>
      {/* Der Balken ist Bild; der Füllgrad steht als Text in der Zeile darunter. */}
      <div
        aria-hidden="true"
        data-testid="haus-fuellgrad"
        data-pct={floor.validatedRatio}
        className="mt-1.5 h-2 rounded-pill bg-surface"
      >
        <div
          className={cx(
            "h-2 rounded-pill",
            floor.fragile ? "bg-trust-crit-fill" : "bg-trust-pos-fill",
          )}
          style={{ width: `${floor.validatedRatio}%` }}
        />
      </div>
      <div className="mt-1 font-mono text-[11px] text-muted-2">
        {t("wissenshaus.fuellgrad", { pct: floor.validatedRatio })} ·{" "}
        {t("wissenshaus.zeile", {
          count: floor.koCount,
          validated: floor.validated,
          authors: floor.authorCount,
          imported: floor.imported,
        })}
      </div>
    </li>
  );
}

function Station({
  id,
  label,
  value,
  detail,
}: {
  id: string;
  label: string;
  value: number;
  detail: string;
}): JSX.Element {
  return (
    <div data-testid={`haus-fluss-${id}`} className="min-w-0 flex-1 rounded-card bg-page p-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-2">{label}</div>
      <div data-testid="haus-fluss-wert" className="mt-1 text-xl font-semibold text-ink">
        {value}
      </div>
      <div className="text-[11px] text-muted">{detail}</div>
    </div>
  );
}

export function Wissenshaus({
  floors,
  flow,
}: {
  floors: readonly MgmtHouseFloor[];
  flow: MgmtHouseFlow;
}): JSX.Element {
  const { t } = useTranslation();
  const ohneFachgebiet = floors.some((f) => f.domain === null);
  return (
    <div className="mt-2 space-y-3">
      <section data-testid="haus-fluss" aria-label={t("wissenshaus.fluss.titel")}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <Station
            id="import"
            label={t("wissenshaus.fluss.import")}
            value={flow.imported}
            detail={t("wissenshaus.fluss.importDetail", { n: flow.importedValidated })}
          />
          <ArrowRight
            aria-hidden="true"
            size={16}
            className="hidden shrink-0 self-center text-muted-2 sm:block"
          />
          <Station
            id="haus"
            label={t("wissenshaus.fluss.haus")}
            value={flow.inHouse}
            detail={t("wissenshaus.fluss.hausDetail", {
              secured: flow.secured,
              fragile: flow.fragileFloors,
              floors: flow.floors,
            })}
          />
          <ArrowRight
            aria-hidden="true"
            size={16}
            className="hidden shrink-0 self-center text-muted-2 sm:block"
          />
          <Station
            id="ausgabe"
            label={t("wissenshaus.fluss.ausgabe")}
            value={flow.outputReady}
            detail={t("wissenshaus.fluss.ausgabeDetail")}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-muted-2">{t("wissenshaus.fluss.grenze")}</p>
      </section>

      <div data-testid="haus-bild" className="mx-auto max-w-xl">
        {/* Das Dach: reine Form, die Aussage steht im Text darunter. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 200 36"
          preserveAspectRatio="none"
          className="block h-8 w-full"
        >
          <polygon
            points="100,2 198,34 2,34"
            className="fill-surface stroke-hairline"
            strokeWidth={1.5}
          />
        </svg>
        <div
          data-testid="haus-dach"
          className="border-x border-t border-hairline bg-surface px-3 py-1 text-center font-mono text-[11px] text-muted-2"
        >
          {t("wissenshaus.dach", { floors: floors.length })}
        </div>
        <ol aria-label={t("wissenshaus.fluss.haus")}>
          {floors.map((f) => (
            <Stockwerk key={f.domain ?? ""} floor={f} />
          ))}
        </ol>
      </div>

      <p className="text-[11px] text-muted-2">{t("wissenshaus.legende")}</p>
      {ohneFachgebiet ? (
        <p data-testid="haus-ohne-fachgebiet" className="text-[11px] text-muted-2">
          {t("wissenshaus.ohneFachgebietHinweis")}
        </p>
      ) : null}
    </div>
  );
}
