// JOB 3065 H6 — DIE FLÄCHE „EINSTELLUNGEN" (Maßstab: `design/klarwerk/Admin.dc.html`, Z.36-44).
//
// Titel oben (26px/650/−0.3px, KEIN Kicker, KEIN Untertitel), links die 200px-Reiterspalte, rechts
// die Karten. Sonst steht auf der Fläche kein Satz — Pedis Maßstab 04.09.: Apple Pages, Knopf und
// Feld erklären sich selbst.
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
    <div data-einst="reiterspalte" className="flex w-[200px] shrink-0 flex-col gap-1">
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
      <div className="flex items-start gap-6">
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
