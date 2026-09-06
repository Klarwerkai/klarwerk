// JOB 3065 H6 — DIE FLÄCHE „EINSTELLUNGEN" (Maßstab: `design/klarwerk/Admin.dc.html`, Z.36-44).
//
// Titel oben (26px/650/−0.3px, KEIN Kicker, KEIN Untertitel). AB `sm` (640 px): links die
// 200px-Reiterspalte, rechts die Karten — genau das Zielbild. UNTERHALB von `sm`: die Reiterleiste
// steht ÜBER dem Inhalt, und der Inhalt bekommt die volle Spaltenbreite.
//
// WARUM UNTERHALB ANDERS (JOB 3155 UX-12b): Die feste Breite galt bis hierher bei JEDER Fensterbreite
// (`w-[200px] shrink-0` in einer Flexzeile ohne Weiche). Der Prüfer von JOB 3124 hat die Folge
// GEMESSEN, nicht gerechnet — `archiv/3124/runde-4/ben.md:26`: „Gemessen: 320 px → 30 px Raster,
// drei bis fünf Textzeilen; 390 px → 100 px Raster, jeweils eine Textzeile." Vom Telefon blieben
// dem Inhalt also rund 30 px, und derselbe Befund verlangte: „Behandle die schmale Reiterspalte als
// eigenen Layoutauftrag." Die Weiche unten ist dieser Auftrag; gemessen wird sie an der gebauten App
// in `tests/einstellungen-schmal/ux12b-einstellungen-schmal-chromium.test.ts` (320/390/1280 px,
// DE und EN, samt Tastaturweg und einer dauerhaft mitlaufenden Gegenprobe auf den alten Vertrag).
//
// Es gibt weiterhin GENAU EINEN Ort, der Reiter zeichnet: `Reiterspalte` hier. Kein zweites,
// „mobiles" Parallelbauteil, keine zweite Einstellungshülle.
//
// Sonst steht auf der Fläche kein Satz — Pedis Maßstab 04.09.: Apple Pages, Knopf und Feld
// erklären sich selbst.
import type { ReactNode } from "react";
import { cx } from "../ui";

export interface Reiter {
  id: string;
  label: string;
}

export function Reiterspalte({
  reiter,
  aktiv,
  onWechsel,
}: {
  reiter: readonly Reiter[];
  aktiv: string;
  onWechsel: (id: string) => void;
}): JSX.Element {
  return (
    // Schmal: eine umbrechende Leiste über die volle Breite — jeder Reiter bleibt ganz sichtbar und
    // wandert bei Platzmangel in die nächste Zeile, statt abgeschnitten zu werden. Ab `sm` wieder
    // die 200-px-Spalte des Zielbilds (`Admin.dc.html`, Z.43), unschrumpfbar wie bisher.
    <div
      data-einst="reiterspalte"
      className="flex w-full flex-row flex-wrap gap-1 sm:w-[200px] sm:shrink-0 sm:flex-col"
    >
      {reiter.map((r) => (
        <button
          key={r.id}
          type="button"
          data-einst="reiter"
          aria-pressed={aktiv === r.id}
          onClick={() => onWechsel(r.id)}
          className={cx(
            "rounded-[9px] px-3.5 py-2.5 text-left text-[14px]",
            aktiv === r.id
              ? "border border-hairline bg-surface font-semibold text-text"
              : "text-muted-2 hover:text-text",
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

export function EinstellungenSeite({
  titel,
  seitenSchluessel,
  reiter,
  aktiv,
  onWechsel,
  children,
}: {
  titel: string;
  /**
   * Der namentliche Seitenanker (`page-<schlüssel>`), den bisher `PageHeader` gesetzt hat. Die
   * Routenprobe `tests-smoke/ui-smoke.spec.ts` prüft mit ihm, dass die ECHTE Seite steht und nicht
   * die Fehlerkarte, der Platzhalter oder eine stille Umleitung — er darf hier nicht verloren gehen.
   */
  seitenSchluessel?: string;
  reiter?: readonly Reiter[];
  aktiv?: string;
  onWechsel?: (id: string) => void;
  children: ReactNode;
}): JSX.Element {
  return (
    <div
      data-einst="seite"
      data-testid={seitenSchluessel ? `page-${seitenSchluessel}` : undefined}
      className="mx-auto flex w-full max-w-[900px] flex-col gap-[22px] py-9"
    >
      <div className="flex items-center justify-between">
        <h1 data-einst="titel" className="text-[26px] font-[650] tracking-[-0.3px] text-text">
          {titel}
        </h1>
      </div>
      {/* Die Breiten-Weiche (JOB 3155): unterhalb von `sm` untereinander — Reiter oben, Inhalt
          darunter, jeder über die volle Breite. Ab `sm` unverändert nebeneinander mit 24 px Abstand
          und oben ausgerichtet. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
        {reiter && aktiv !== undefined && onWechsel ? (
          <Reiterspalte reiter={reiter} aktiv={aktiv} onWechsel={onWechsel} />
        ) : null}
        <div data-einst="spalte" className="flex min-w-0 flex-1 flex-col gap-5">
          {children}
        </div>
      </div>
    </div>
  );
}
