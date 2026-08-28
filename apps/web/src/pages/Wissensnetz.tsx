// ================================================================================================
// JOB 2600 · D1 — DIE THEMENKARTE.
// ================================================================================================
//
// DIE ABNAHME, woertlich: „Auf der bestehenden Klara-Oberflaeche erscheint eine Themenkarte mit
// hoechstens 40 Themen. Knotengroesse entspricht der Menge zugeordneten Wissens. Die Farbe zeigt
// den vorhandenen Freigabe- und Quellenstatus. Eine Kante erscheint nur, wenn zwei Themen in
// demselben freigegebenen Wissensobjekt vorkommen. Beim Anklicken eines Knotens oeffnet sich die
// Liste der belegenden Wissensobjekte."
//
// WAS DIESE DATEI NICHT TUT — und das ist der Grund, warum sie kurz ist:
//   · Sie rechnet NICHTS aus. Groesse, Farbe, Ubiquitaet und Kantenauswahl entstehen im Server
//     (`services/wissensnetz/src/themenkarte.ts`), hinter der Rechte-Naht. Hier wird gezeichnet.
//   · Sie holt KEINE zweite Quelle. Eine Route, ein Hook, ein Bestand.
//   · Sie legt KEINE Liste an. Der Klick fuehrt in die BESTEHENDE Bibliothek, gefiltert auf das
//     Schlagwort (`/bibliothek?tag=…` — `Library.tsx:209`, `facetSelectionFromParams`). Genau das
//     verlangt §3 („nutzt die vorhandene Suche oder Liste") und Codex' letzte Auflage („die Liste
//     beim Klick ist die gefilterte, nicht der Hauptlesepfad").
//
// DAS LAYOUT IST EIN FESTER RING — kein Kraefte-Layout, keine Optimierung, keine Animation (§3).
// Ein Ring hat drei Vorzuege, die hier zaehlen: er ist deterministisch (gleiche Daten ⇒ gleiches
// Bild, also testbar), er braucht keine Iteration, und er kann nicht „auseinanderfliegen".
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useWissensnetz } from "../api/hooks";
import type { Themenfarbe, Themenkarte, Themenknoten } from "../api/types";
import { Card, PageHeader, QueryState, SectionLabel } from "../components/ui";

/** Die drei Farben. Mehr gibt es nicht, und Prozentanzeigen gibt es keine (§3 des Auftrags). */
const FARBE: Record<Themenfarbe, { fuellung: string; rand: string }> = {
  belegt: { fuellung: "var(--trust-pos-bg, #d8efe0)", rand: "var(--trust-pos-text, #1f6b41)" },
  freigegeben: {
    fuellung: "var(--trust-warn-bg, #fbeccd)",
    rand: "var(--trust-warn-text, #8a5a12)",
  },
  offen: { fuellung: "var(--page, #eef1f4)", rand: "var(--muted, #6b7684)" },
};

const FARB_REIHENFOLGE: Themenfarbe[] = ["belegt", "freigegeben", "offen"];

// Zeichenflaeche. Feste Groesse, damit das Bild in jedem Fenster dieselbe Geometrie hat.
const BREITE = 720;
const HOEHE = 520;
const MITTE_X = BREITE / 2;
const MITTE_Y = HOEHE / 2;
const RADIUS = 200;
const R_MIN = 10;
const R_MAX = 30;

interface Platz {
  knoten: Themenknoten;
  x: number;
  y: number;
  r: number;
}

/**
 * Der feste Ring: Knoten `i` von `n` sitzt auf dem Kreis, beginnend oben, im Uhrzeigersinn.
 *
 * Der Radius des Knotens waechst mit der WURZEL der Traegerzahl, nicht linear: die FLAECHE soll
 * die Menge tragen. Linear waere ein Thema mit vierfachem Bestand sechzehnfach so gross und
 * erschluege die Karte. Bei nur einem vorkommenden Wert bekommen alle denselben Radius — eine
 * Division durch null gibt es nicht.
 */
export function ringplaetze(themen: readonly Themenknoten[]): Platz[] {
  const n = themen.length;
  if (n === 0) {
    return [];
  }
  const werte = themen.map((k) => Math.max(k.objekte, 0));
  const min = Math.min(...werte);
  const max = Math.max(...werte);
  const spanne = max - min;
  return themen.map((knoten, i) => {
    const winkel = -Math.PI / 2 + (2 * Math.PI * i) / n;
    const anteil =
      spanne === 0
        ? 1
        : (Math.sqrt(knoten.objekte) - Math.sqrt(min)) / (Math.sqrt(max) - Math.sqrt(min) || 1);
    return {
      knoten,
      x: MITTE_X + RADIUS * Math.cos(winkel),
      y: MITTE_Y + RADIUS * Math.sin(winkel),
      r: R_MIN + (R_MAX - R_MIN) * anteil,
    };
  });
}

/** Der Klickweg: die BESTEHENDE Bibliothek, gefiltert auf dieses Schlagwort. */
export function themenHref(thema: string): string {
  return `/bibliothek?tag=${encodeURIComponent(thema)}`;
}

function Karte({ karte }: { karte: Themenkarte }): JSX.Element {
  const { t } = useTranslation();
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const plaetze = ringplaetze(karte.themen);
  const nachThema = new Map(plaetze.map((p) => [p.knoten.thema, p]));
  // Was das Bild TATSAECHLICH zeigt — die Legende unten haengt daran, nicht an einer Annahme.
  const vorhandeneFarben = new Set(karte.themen.map((k) => k.farbe));
  const hatUbiquitaere = karte.themen.some((k) => k.ohneKanten);

  return (
    <div className="space-y-4">
      <svg
        viewBox={`0 0 ${BREITE} ${HOEHE}`}
        className="w-full max-w-full"
        role="img"
        aria-label={t("wissensnetz.karte.alt", { count: karte.themen.length })}
        data-testid="themenkarte"
      >
        <title>{t("wissensnetz.karte.alt", { count: karte.themen.length })}</title>
        {/* Kanten zuerst, damit die Knoten darauf liegen. */}
        <g>
          {karte.kanten.map((kante) => {
            const a = nachThema.get(kante.a);
            const b = nachThema.get(kante.b);
            if (!a || !b) {
              return null;
            }
            return (
              <line
                key={`${kante.a}—${kante.b}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="var(--hairline, #c9d1da)"
                strokeWidth={1 + Math.min(kante.gewicht, 4)}
                data-testid="themenkante"
                data-a={kante.a}
                data-b={kante.b}
              />
            );
          })}
        </g>
        <g>
          {plaetze.map((p) => {
            const farbe = FARBE[p.knoten.farbe];
            return (
              <g
                key={p.knoten.thema}
                data-testid="themenknoten"
                data-thema={p.knoten.thema}
                data-farbe={p.knoten.farbe}
                data-objekte={p.knoten.objekte}
                onMouseEnter={() => setGewaehlt(p.knoten.thema)}
                onMouseLeave={() => setGewaehlt(null)}
              >
                {/* `Link` statt rohem Anker: ein `<a href>` im SVG laedt die ganze App neu und
                    verliert den Zustand. React setzt das Element im SVG-Namensraum an, wo `a`
                    seit SVG2 zu Hause ist — der Klickweg bleibt derselbe, nur ohne Vollladung. */}
                <Link
                  to={themenHref(p.knoten.thema)}
                  aria-label={t("wissensnetz.knoten.alt", {
                    thema: p.knoten.thema,
                    count: p.knoten.objekte,
                  })}
                >
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={p.r}
                    fill={farbe.fuellung}
                    stroke={farbe.rand}
                    strokeWidth={p.knoten.ohneKanten ? 3 : 1.5}
                    strokeDasharray={p.knoten.ohneKanten ? "4 3" : undefined}
                  />
                  <text
                    x={p.x}
                    y={p.y + p.r + 12}
                    textAnchor="middle"
                    className="fill-text text-[10px]"
                    style={{ fontWeight: gewaehlt === p.knoten.thema ? 700 : 400 }}
                  >
                    {p.knoten.thema}
                  </text>
                </Link>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Die Legende traegt ihre Farbe als STIL, nicht als zusammengesetzte Klasse — genau wie die
          Knoten oben. Eine Klasse aus einem Ausdruck waere eine unaufloesbare Klassenbindung, und
          `tests/app/mega47-modale-flaechen-sammler.test.tsx` zaehlt die (heute 207). Ein neuer
          Eintrag in dieser Liste waere stille Erosion — dieselben drei Farben gehen ohne. */}
      <div className="flex flex-wrap items-center gap-3 text-micro">
        {FARB_REIHENFOLGE.filter((f) => vorhandeneFarben.has(f)).map((f) => (
          <span key={f} className="inline-flex items-center gap-1.5" data-farbe={f}>
            <span
              className="inline-block h-3 w-3 rounded-full border"
              style={{ background: FARBE[f].fuellung, borderColor: FARBE[f].rand }}
            />
            {t(`wissensnetz.farbe.${f}`)}
          </span>
        ))}
        {/* JOB 2600 D4 · BENs Auflage zu D3: „Fassung A ist nicht fuer alle Zustaende wahr."
            Der alte Aufbau zeigte ALLE drei Farbmarken und den Ubiquitaetssatz IMMER — auch fuer
            Farben, die im Bild nicht vorkommen, und auch ohne einen einzigen gestrichelten Knoten.
            Eine Legende, die eine Kodierung erklaert, die nicht zu sehen ist, sagt ueber DIESES
            Bild die Unwahrheit.

            Jetzt gilt: jeder Satz erscheint genau in dem Zustand, fuer den er wahr ist.
              · eine Farbmarke nur, wenn ein Knoten sie traegt
              · der Ubiquitaetssatz nur, wenn ein Knoten gestrichelt ist
              · der Kantensatz nur, wenn die Karte gar keine Kante hat — sonst laese ein Mensch
                die Strichelung als Grund, obwohl hier ueberhaupt nichts verbindet */}
        {hatUbiquitaere ? (
          <span className="text-muted" data-testid="legende-ubiquitaer">
            {t("wissensnetz.legende.ubiquitaer")}
          </span>
        ) : null}
        {/* JOB 2600 D7 · BENs Auflage zu D5: „Null Kanten koennen aus der Ubiquitaetsunter-
            drueckung folgen, obwohl ein freigegebenes Wissensobjekt zwei Themen teilt."

            Bis D5 hing hier EIN Satz an `kanten.length === 0` und behauptete, es gebe keinen
            gemeinsamen Traeger. Das ist ein Schluss von der Wirkung auf die Ursache. Schritt 3
            der Rechnung (`themenkarte.ts`) nimmt ubiquitaeren Themen die Kanten, BEVOR Schritt 4
            sie bilden kann — dann ist die Liste leer und der Traeger existiert trotzdem.

            Deshalb entscheidet jetzt `unterdruecktDurchUbiquitaet` und nicht `hatUbiquitaere`:
            Ein ubiquitaeres Thema OHNE gemeinsamen Traeger gibt es auch, und dort waere der
            zweite Satz seinerseits falsch. Gemessen in D6 ueber 97.227 kantenlose Zustaende —
            der Zaehler trennt alle richtig, die Knotenfrage laege in 6.984 daneben. */}
        {karte.kanten.length === 0 ? (
          karte.unterdruecktDurchUbiquitaet > 0 ? (
            <span className="text-muted" data-testid="legende-kanten-unterdrueckt">
              {t("wissensnetz.legende.kantenUnterdrueckt")}
            </span>
          ) : (
            <span className="text-muted" data-testid="legende-keine-kanten">
              {t("wissensnetz.legende.keineKanten")}
            </span>
          )
        ) : null}
      </div>
    </div>
  );
}

function AlleThemen({ karte }: { karte: Themenkarte }): JSX.Element | null {
  const { t } = useTranslation();
  const [offen, setOffen] = useState(false);
  if (karte.weitere.length === 0) {
    return null;
  }
  return (
    <Card interactive={false}>
      <button
        type="button"
        className="text-sm font-medium underline"
        onClick={() => setOffen((v) => !v)}
        data-testid="alle-themen-schalter"
      >
        {t("wissensnetz.alle.schalter", { count: karte.weitere.length })}
      </button>
      {offen ? (
        <ul className="mt-3 flex flex-wrap gap-2" data-testid="alle-themen-liste">
          {karte.weitere.map((thema) => (
            <li key={thema}>
              <Link className="rounded-full bg-page px-2 py-0.5 text-micro" to={themenHref(thema)}>
                {thema}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {karte.weitereAbgeschnitten ? (
        <p className="mt-2 text-micro text-muted">{t("wissensnetz.alle.abgeschnitten")}</p>
      ) : null}
    </Card>
  );
}

export function Wissensnetz(): JSX.Element {
  const { t } = useTranslation();
  const netz = useWissensnetz();
  return (
    <div className="space-y-4">
      <PageHeader kicker={t("wissensnetz.kicker")} title={t("wissensnetz.title")} />
      <QueryState query={netz}>
        {(metrik) => {
          const karte = metrik.themenkarte;
          // Ehrlich statt leer: eine Karte ohne Knoten ist kein leerer Bestand, sondern ein
          // Bestand ohne Schlagworte. Beides sagt der Text, keines behauptet das andere.
          if (!karte || karte.themen.length === 0) {
            return (
              <Card interactive={false}>
                <p className="text-sm text-muted">{t("wissensnetz.leer")}</p>
              </Card>
            );
          }
          return (
            <>
              <Card interactive={false}>
                <SectionLabel>{t("wissensnetz.karte.label")}</SectionLabel>
                <Karte karte={karte} />
              </Card>
              <AlleThemen karte={karte} />
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
