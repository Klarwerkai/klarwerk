import { Link } from "react-router-dom";
import { HOME_ROUTE } from "../app/navigation";

// Markenlogo (BRIEF §3): weiße Kachel + zwei konzentrische orange Kreise,
// Wortmarke KLARWERK + Untertitel REASONING SYSTEM.
export function Logo(): JSX.Element {
  return (
    <Link
      to={HOME_ROUTE}
      aria-label="Klarwerk - zur Startseite"
      className="flex items-center gap-2.5 rounded-[12px] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-surface shadow-tile">
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="6.5" fill="none" stroke="#ED7D0E" strokeWidth="3.4" />
          <circle cx="10" cy="10" r="3" fill="#ED7D0E" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className="block font-sans text-[15px] font-bold tracking-[2px] text-ink">
          KLARWERK
        </span>
        <span className="block font-mono text-[10px] uppercase tracking-[1.5px] text-muted-2">
          Reasoning System
        </span>
      </span>
    </Link>
  );
}
