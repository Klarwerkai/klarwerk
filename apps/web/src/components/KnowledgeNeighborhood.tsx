// ================================================================================================
// AUFTRAG-mega68 — DIE ANWENDERSICHT DES WISSENSNETZES: DIE NACHBARSCHAFT (Entwurf Variante A).
// ================================================================================================
//
// Das Netz beginnt an dem Beitrag, den jemand gerade liest: er steht in der Mitte, darum herum,
// was tatsächlich mit ihm zu tun hat — und AN JEDER KANTE STEHT, WARUM (das geteilte Schlagwort;
// teilen sich zwei Objekte mehrere, zeigt die Kante „+n" und die Liste darunter alle). Ein Klick
// macht den Nachbarn zur neuen Mitte — OHNE Seitenwechsel (lokale Spur, warmer Query-Cache) und
// mit Rückweg; „Beitrag öffnen" führt dann als normale Router-Navigation zum Artikel.
//
// Die Daten kommen aus der BEGRENZTEN Server-Auskunft (GET /api/kos/:id/neighbors, mega68) — NICHT
// aus /api/graph (globaler O(n²)-Graph, Register H5) und NICHT aus der Client-Heuristik relatedKos
// (SCRUM-130), die über die volle KO-Liste rechnete und ubiquitäre Schlagwörter (pilot-demo)
// mitzählte. Vertraulichkeit ist damit SERVERSEITIG entschieden: was hier ankommt, darf der
// Aufrufer sehen — die Fläche muss (und kann) nichts mehr filtern.
//
// Die Liste unter der Zeichnung ist kein Beiwerk, sondern der zweite Zugang zur selben Auskunft:
// Tastatur/Screenreader (echte Buttons/Links), Telefon (kleine Fläche), und sie zeigt ALLE
// geteilten Schlagwörter, wo die Kante nur das erste trägt.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useKoNeighbors } from "../api/hooks";
import type { KoStatus, NeighborKo } from "../api/types";
import { layoutNeighborhood } from "../lib/graphLayout";
import { koDetailPath } from "../lib/graphNav";
import { QueryState } from "./ui";

// Dieselbe Status-Farbsprache wie der Stufe-2-Graph (GraphView) und die Legende dort.
const NODE_COLOR: Record<KoStatus, string> = {
  validiert: "text-trust-pos-fill",
  offen: "text-muted-2",
};
const DOT_COLOR: Record<KoStatus, string> = {
  validiert: "bg-trust-pos-fill",
  offen: "bg-muted-2",
};

const shorten = (s: string, max: number): string =>
  s.length > max ? `${s.slice(0, max - 1)}…` : s;

// Das sichtbare „warum" an der Kante: erstes geteiltes Schlagwort, weitere als „+n" —
// vollständig steht es in der Liste darunter (Fläche nicht überladen, nichts verschweigen).
export function edgeLabel(via: readonly string[]): string {
  const first = via[0] ?? "";
  return via.length > 1 ? `${first} +${via.length - 1}` : first;
}

interface Crumb {
  id: string;
  title: string;
}

export function KnowledgeNeighborhood({
  koId,
  koTitle,
}: {
  koId: string;
  koTitle: string;
}): JSX.Element {
  const { t } = useTranslation();
  // Die Spur der Erkundung: leer = die Mitte ist der gelesene Beitrag selbst. Jeder Klick auf
  // einen Nachbarn schiebt ihn auf die Spur; „Zurück" nimmt den letzten Schritt. Bei einem
  // ANDEREN Beitrag beginnt die Erkundung neu — das erledigt der Einbauort über key={ko.id}
  // (Remount statt Effekt; KnowledgeDetail.tsx).
  const [trail, setTrail] = useState<Crumb[]>([]);
  const last = trail[trail.length - 1];
  const centerId = last ? last.id : koId;
  const query = useKoNeighbors(centerId);
  const previousTitle = trail.length >= 2 ? (trail[trail.length - 2]?.title ?? "") : koTitle;

  const recenter = (n: NeighborKo): void => {
    setTrail((prev) => [...prev, { id: n.id, title: n.title }]);
  };
  const back = (): void => {
    setTrail((prev) => prev.slice(0, -1));
  };

  return (
    <div className="space-y-3" data-testid="knowledge-neighborhood">
      {trail.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            onClick={back}
            className="inline-flex items-center gap-1 rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-muted hover:text-text"
            data-testid="nb-back"
          >
            <span aria-hidden="true">←</span> {t("nb.back", { title: shorten(previousTitle, 40) })}
          </button>
          <Link
            to={koDetailPath(centerId)}
            className="text-[12px] font-semibold text-ai hover:underline"
            data-testid="nb-open-center"
          >
            {t("nb.open")} <span aria-hidden="true">→</span>
          </Link>
        </div>
      ) : null}
      <QueryState query={query}>
        {(nb) => {
          const layout = layoutNeighborhood(nb.neighbors.map((n) => n.id));
          const spotOf = new Map(layout.spots.map((s) => [s.id, s]));
          return (
            <>
              {nb.neighbors.length === 0 ? (
                <p className="text-[13px] text-muted">{t("nb.empty")}</p>
              ) : (
                <svg
                  viewBox={`0 0 ${layout.width} ${layout.height}`}
                  className="w-full"
                  role="img"
                  aria-label={t("nb.svgLabel", { title: nb.center.title })}
                >
                  <title>{t("nb.svgLabel", { title: nb.center.title })}</title>
                  {nb.neighbors.map((n) => {
                    const spot = spotOf.get(n.id);
                    if (!spot) {
                      return null;
                    }
                    return (
                      <g key={`edge-${n.id}`}>
                        <line
                          x1={layout.cx}
                          y1={layout.cy}
                          x2={spot.x}
                          y2={spot.y}
                          className="text-hairline"
                          stroke="currentColor"
                          strokeWidth={n.via.length > 1 ? 2 : 1}
                        />
                        {/* Das WARUM, direkt an der Kante. */}
                        <text
                          x={spot.labelX}
                          y={spot.labelY}
                          textAnchor="middle"
                          className="fill-muted-2 text-[8.5px] font-semibold"
                        >
                          {edgeLabel(n.via)}
                        </text>
                      </g>
                    );
                  })}
                  {nb.neighbors.map((n) => {
                    const spot = spotOf.get(n.id);
                    if (!spot) {
                      return null;
                    }
                    // Interaktionsmuster wie der Stufe-2-GraphView (bedingtes role="link" auf
                    // der SVG-Gruppe — im SVG gibt es kein <button>; fokussierbar, mit
                    // Tastatur-Äquivalent). Der Klick führt zur Nachbarschaft des Nachbarn
                    // (neue Mitte); derselbe Weg steht als echter Button in der Liste darunter.
                    const interactive = spotOf.has(n.id);
                    const go = (): void => recenter(n);
                    return (
                      <g
                        key={`node-${n.id}`}
                        role={interactive ? "link" : undefined}
                        aria-label={
                          interactive ? t("nb.makeCenter", { title: n.title }) : undefined
                        }
                        tabIndex={interactive ? 0 : undefined}
                        className={interactive ? "cursor-pointer outline-none" : undefined}
                        onClick={go}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            go();
                          }
                        }}
                      >
                        <circle
                          cx={spot.x}
                          cy={spot.y}
                          r={8}
                          className={NODE_COLOR[n.status] ?? "text-muted-2"}
                          fill="currentColor"
                        />
                        <text
                          x={spot.x}
                          y={spot.y + 20}
                          textAnchor="middle"
                          className="fill-text text-[9px]"
                        >
                          {shorten(n.title, 22)}
                        </text>
                      </g>
                    );
                  })}
                  <g>
                    <circle
                      cx={layout.cx}
                      cy={layout.cy}
                      r={12}
                      className="text-ink"
                      fill="currentColor"
                    />
                    <text
                      x={layout.cx}
                      y={layout.cy + 28}
                      textAnchor="middle"
                      className="fill-text text-[10px] font-bold"
                    >
                      {shorten(nb.center.title, 34)}
                    </text>
                  </g>
                </svg>
              )}
              {nb.neighbors.length > 0 ? (
                <p className="text-[11.5px] text-muted-2">
                  {nb.truncated
                    ? t("nb.countTruncated", { shown: nb.neighbors.length, total: nb.total })
                    : t("nb.countAll", { count: nb.total })}
                </p>
              ) : null}
              {/* Die Ehrlichkeitsauflage aus dem Entwurf: der Schlagwort-Filter ist SICHTBAR
                  begründet — welche Allerwelts-Schlagwörter keine Kante erzeugen, steht hier. */}
              {nb.excludedTags.length > 0 ? (
                <p className="text-[11.5px] text-muted-2" data-testid="nb-excluded">
                  {t("nb.excluded", { tags: nb.excludedTags.join(", ") })}
                </p>
              ) : null}
              {nb.neighbors.length > 0 ? (
                <ul className="space-y-1.5">
                  {nb.neighbors.map((n) => (
                    <li key={n.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span
                        className={`h-2 w-2 rounded-full ${DOT_COLOR[n.status] ?? "bg-muted-2"}`}
                        aria-hidden="true"
                      />
                      <button
                        type="button"
                        onClick={() => recenter(n)}
                        className="max-w-full truncate text-left text-[12.5px] font-semibold text-text hover:underline"
                        aria-label={t("nb.makeCenter", { title: n.title })}
                      >
                        {n.title}
                      </button>
                      <span className="font-mono text-[10.5px] text-muted-2">
                        {n.via.join(" · ")}
                      </span>
                      <Link
                        to={koDetailPath(n.id)}
                        className="ml-auto shrink-0 text-[11.5px] font-semibold text-ai hover:underline"
                      >
                        {t("nb.open")} <span aria-hidden="true">→</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
