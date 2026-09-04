// ================================================================================================
// JOB 3061 · H2 — EINE FLÄCHE „PRÜFEN", VIER REITER.
// ================================================================================================
//
// Bis hierher waren „Validierung", „Konflikte", „Duplikate" und „Lebenszyklus" vier Seiten mit vier
// eigenen Köpfen, vier Kickern („Validation Board", „Konflikt-Übersicht", „Duplikate-Board", …) und
// vier Einleitungssätzen. Pedi 04.09. 06:50: „Sie vergleichen Duplikat und in Konflikte sind so
// irreführend und so unübersichtlich."
//
// Dieser Kopf ist der gemeinsame Deckel dieser vier Flächen — Titel links, das Segment rechts, und
// daneben die zwei Menüorte, die zur GANZEN Fläche gehören (Filter und „?"). Die vier Routen
// bleiben unverändert; der Reiter ist ein Link, kein Zustand.
//
// SOLLWERTE aus `design/klarwerk/Pruefen.dc.html` Z.38–41 — je Wert ein Messfall in
// `tests/design/zielbild-h2-pruefen.test.ts`:
//   Titel      26px · 650 · letter-spacing -0.3px
//   Segment    Fläche #EEEAE3 · Radius 9px · Polster 2px
//   Reiter     Polster 6px 14px · Radius 7px · 13px · #525B6B
//   aktiv      Fläche #FFFFFF · 600 · #1A2233 · Schatten 0 1px 2px rgba(14,22,38,0.08)
//
// DIE ZWEI DIREKTWERTE (#EEEAE3, #9AA2B1) benennt die Rückgabe unter ABWEICHUNGEN: die
// Werkbank-Palette in `styles/themes.css` führt beide nicht, und diese Datei liegt nicht in den
// Zielpfaden dieses Auftrags. Sie gehören als Token dorthin — hier stehen sie sichtbar und
// benannt statt still danebengeraten.
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  useConflicts,
  useDuplicates,
  useLifecyclePending,
  useValidationBoard,
} from "../../api/hooks";
import { cx } from "../ui";
import { type ReiterZaehler, reiterZaehler, zaehlerQuelle } from "./zaehler";

export type PruefenReiter = "offen" | "konflikte" | "duplikate" | "erneut";

const REITER: ReadonlyArray<{
  id: PruefenReiter;
  to: string;
  labelKey: string;
  /** Der Routenanker der Rauchprobe („keine weiße Seite") — er hing bis hierher am `PageHeader`. */
  pageKey: string;
}> = [
  { id: "offen", to: "/validierung", labelKey: "pruefen.tab.offen", pageKey: "validierung" },
  { id: "konflikte", to: "/konflikte", labelKey: "pruefen.tab.konflikte", pageKey: "konflikte" },
  { id: "duplikate", to: "/duplikate", labelKey: "pruefen.tab.duplikate", pageKey: "duplikate" },
  { id: "erneut", to: "/lebenszyklus", labelKey: "pruefen.tab.erneut", pageKey: "lebenszyklus" },
];

/** Die vier Zähler aus den vier ECHTEN Abrufen. Kein Reiter trägt eine Zahl, die nicht gemessen ist. */
function useReiterZaehler(): Record<PruefenReiter, ReiterZaehler> {
  const board = useValidationBoard();
  const konflikte = useConflicts();
  const duplikate = useDuplicates();
  const erneut = useLifecyclePending();
  return {
    offen: reiterZaehler(zaehlerQuelle(board)),
    konflikte: reiterZaehler(zaehlerQuelle(konflikte)),
    duplikate: reiterZaehler(zaehlerQuelle(duplikate)),
    erneut: reiterZaehler(zaehlerQuelle(erneut)),
  };
}

export function PruefenKopf({
  aktiv,
  filter,
  hilfe,
}: {
  aktiv: PruefenReiter;
  /** Das Filter-Menü dieses Reiters (Trichter neben dem Segment). Ohne Filter: weglassen. */
  filter?: ReactNode;
  /** Das „?"-Menü dieses Reiters (Leitkarte, Wirkung, Vorbehalte). */
  hilfe?: ReactNode;
}): JSX.Element {
  const { t } = useTranslation();
  const zaehler = useReiterZaehler();
  const anker = REITER.find((r) => r.id === aktiv);
  return (
    <div
      data-testid={anker ? `page-${anker.pageKey}` : undefined}
      className="mb-[22px] flex flex-wrap items-center justify-between gap-3"
    >
      <div className="flex items-center gap-1.5">
        <h1 className="text-[26px] font-[650] leading-tight tracking-[-0.3px] text-text">
          {t("pruefen.title")}
        </h1>
        {hilfe}
      </div>
      <div className="flex items-center gap-2">
        <nav
          data-testid="pruefen-segment"
          aria-label={t("pruefen.title")}
          className="flex rounded-[9px] bg-[#EEEAE3] p-[2px]"
        >
          {REITER.map((r) => {
            const z = zaehler[r.id];
            const ist = r.id === aktiv;
            return (
              <Link
                key={r.id}
                to={r.to}
                data-testid={`pruefen-reiter-${r.id}`}
                data-lage={z.lage}
                aria-current={ist ? "page" : undefined}
                className={cx(
                  "rounded-[7px] px-[14px] py-[6px] text-[13px] leading-tight",
                  ist
                    ? "bg-surface font-semibold text-text shadow-[0_1px_2px_rgba(14,22,38,0.08)]"
                    : "text-muted hover:text-text",
                )}
              >
                {t(r.labelKey)}
                {z.wert !== null ? (
                  <>
                    <span aria-hidden="true"> · </span>
                    <span className={z.lage === "gedaempft" ? "text-[#9AA2B1]" : undefined}>
                      {z.wert}
                    </span>
                  </>
                ) : null}
              </Link>
            );
          })}
        </nav>
        {filter}
      </div>
    </div>
  );
}
