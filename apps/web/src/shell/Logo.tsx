// AUFTRAG-mega11 Block B-2 (bens SB-2): das Logo war ein roher `Link` — ein Klick darauf verließ eine
// Seite mit ungespeicherter Eingabe ohne jede Nachfrage. Es läuft jetzt durch dieselbe geschützte
// Grenze wie alle übrigen Shell-Navigationen.
import { useSyncExternalStore } from "react";
import { GuardedLink } from "../app/NavGuardContext";
import { HOME_ROUTE } from "../app/navigation";
import { BRAND_LOGO_ALT, abonniereBranding, aktuellesBranding } from "../lib/brandTheme";

// Wortmarke KLARWERK (Mockup design/klarwerk/Main.dc.html Z.18: 16 px, Gewicht 650, Laufweite
// 0,4 px). JOB 3060 · H1: Kachel mit Kreisen und der Untertitel „Reasoning System" sind aus dem
// Kopfband gegangen — der sichtbare Text der Hülle ist genau das eine Wort.
//
// ================================================================================================
// JOB 3511 — BEI AKTIVER FIRMEN-CI TRITT DAS FIRMENLOGO NEBEN DIE WORTMARKE.
// ================================================================================================
//
// NEBEN, NICHT ANSTELLE. Pedis Vorgabe für Freitag lautet „Produktidentität erkennbar halten"
// (gespraech/ci-advisor/AUFTRAGSGRUNDLAGE.md): das Wort KLARWERK verschwindet nicht, es bekommt
// das Logo des vorgeführten Hauses an die Seite. Ist die Firmen-CI aus — oder ist der Stand noch
// gar nicht bekannt —, steht hier zeichengleich das, was vorher hier stand.
//
// WOHER DER STAND KOMMT: aus `lib/brandTheme.ts`, dem EINEN Modul, das `/api/branding` abfragt und
// dabei auf einen Abruf je Minute gedrosselt ist. Die Hülle fragt bewusst NICHT selbst — eine
// zweite Abfrage wäre ein zweiter, ungedrosselter Takt. `useSyncExternalStore` ist die dafür
// vorgesehene React-Anbindung an einen Speicher außerhalb von React; sie sorgt auch dafür, dass
// ein bereits geöffnetes Fenster das Umschalten OHNE Neuladen mitbekommt.
//
// DIE HELLE PLATTE: Das Kopfband ist dunkel (`bg-ink` bzw. Nacht). Das Advisor-Blau hielte dort als
// Grafik noch 3,37:1, der dunkle Schriftzug #161417 wäre praktisch unsichtbar. Die Platte ist
// dieselbe Bauform, die die Wortmarke der öffentlichen Strecke schon benutzt
// (`auth/BrandPanel.tsx:20`: `rounded-[10px] bg-white` hinter dem Zeichen).
//
// `alt` KOMMT AUS DEM PROFIL, nicht aus dem Namen: der Alternativtext ist eine Eigenschaft der
// Originaldatei (BRAND_LOGO_ALT), keine aus `marke.name` zusammengesetzte Behauptung.
export function Logo(): JSX.Element {
  const stand = useSyncExternalStore(abonniereBranding, aktuellesBranding, aktuellesBranding);
  // Ein Profil OHNE Schalter und ein Schalter OHNE Profil sind beide „aus" — dieselbe Regel wie
  // an der Wurzel (`markeAktiv` in brandTheme.ts).
  const profil = stand?.aktiv ? stand.profil : null;
  const marke = profil === null ? null : (stand?.marke ?? null);
  return (
    // Die Klassen der Wortmarke bleiben ZEICHENGLEICH die bisherigen: das Kopfband wird in
    // Chromium gegen sein Mockup gemessen (tests/design/zielbild-h1-huelle.test.ts), und ein
    // Layoutwechsel hier wäre der Umbau, den der Auftrag für Freitag ausschließt. Das Logo hängt
    // sich deshalb als eigenes Inline-Element daneben, statt den Link zu einer Flexbox zu machen.
    <GuardedLink
      to={HOME_ROUTE}
      aria-label="Klarwerk - zur Startseite"
      className="kw-kopfband-marke shrink-0 text-[16px] font-[650] leading-none tracking-[0.4px] text-white no-underline outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      KLARWERK
      {profil === null || marke === null ? null : (
        <span
          data-testid="kopfband-firmenlogo"
          className="ml-2.5 inline-grid h-7 place-items-center rounded-[6px] bg-white px-1.5 align-middle"
        >
          <img src={marke.logo} alt={BRAND_LOGO_ALT[profil]} className="h-5 w-auto" />
        </span>
      )}
    </GuardedLink>
  );
}
