// AUFTRAG-mega11 Block B-2 (bens SB-2): das Logo war ein roher `Link` — ein Klick darauf verließ eine
// Seite mit ungespeicherter Eingabe ohne jede Nachfrage. Es läuft jetzt durch dieselbe geschützte
// Grenze wie alle übrigen Shell-Navigationen.
import { GuardedLink } from "../app/NavGuardContext";
import { HOME_ROUTE } from "../app/navigation";

// Wortmarke KLARWERK (Mockup design/klarwerk/Main.dc.html Z.18: 16 px, Gewicht 650, Laufweite
// 0,4 px). JOB 3060 · H1: Kachel mit Kreisen und der Untertitel „Reasoning System" sind aus dem
// Kopfband gegangen — der sichtbare Text der Hülle ist genau das eine Wort.
export function Logo(): JSX.Element {
  return (
    <GuardedLink
      to={HOME_ROUTE}
      aria-label="Klarwerk - zur Startseite"
      className="kw-kopfband-marke shrink-0 text-[16px] font-[650] leading-none tracking-[0.4px] text-white no-underline outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      KLARWERK
    </GuardedLink>
  );
}
