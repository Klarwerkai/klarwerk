// AUFTRAG-mega11 Block B-2 (bens SB-2): das Logo war ein roher `Link` — ein Klick darauf verließ eine
// Seite mit ungespeicherter Eingabe ohne jede Nachfrage. Es läuft jetzt durch dieselbe geschützte
// Grenze wie alle übrigen Shell-Navigationen.
import { useSyncExternalStore } from "react";
import { GuardedLink } from "../app/NavGuardContext";
import { HOME_ROUTE } from "../app/navigation";
import { BRAND_LOGO_ALT, abonniereBranding, aktuellesBranding } from "../lib/brandTheme";
import { useMediaQuery } from "./useMediaQuery";

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
//
// ================================================================================================
// JOB 3582 — DER LOGOKASTEN BEKOMMT EINE OBERGRENZE, DAMIT DIE ZEILE INS FENSTER PASST.
// ================================================================================================
//
// DER BEFUND, der hier behoben wird, ist gemessen und nicht behauptet (JOB 3571, Fall CI5 in
// `tests/navigation-schmal/kopfband-ci-chromium.test.ts`): mit eingeschalteter Firmen-CI stand der
// Konto-Kreis bei 390 px rund 20,5 px rechts AUSSERHALB des Fensters. Ursache war genau diese
// Stelle — das Logo hing mit `w-auto` am Seitenverhältnis der Bilddatei und kostete die Zeile
// 110,3 px statt der früher überschlagenen „rund 45 px".
//
// DIE OBERGRENZE GILT DEM KASTEN, NICHT DEM HEUTIGEN SEITENVERHÄLTNIS. Heute gibt es genau EIN
// Firmenprofil; ein zweites, breiteres Logo wäre morgen dieselbe Lücke. Deshalb: die Höhe bleibt
// (`h-5` im Kasten `h-7`), die Breite bekommt eine Grenze, und das Bild wird darin EINGEPASST
// (`object-contain`) statt beschnitten. Ein Bild mit vielfachem Seitenverhältnis wird kleiner
// gezeichnet; es verschwindet nicht und es wird nicht angeschnitten.
//
// SIE IST ZWEISTUFIG — UND DAS IST DIE KORREKTUR AUS RUNDE 2. Runde 1 deckelte auf EINEN Wert für
// jede Fensterbreite und nahm dem Logo damit auch bei 1280 px seine halbe Breite (88,3 px → 44 px).
// Das war ein Umbau der breiten Bauform, den dieser Auftrag ausdrücklich ausschliesst (§5.4: „Die
// Deckelung darf bei 1280 px nicht greifen"), und der Prüfer hat gemessen, dass es auch nicht nötig
// ist. Eine Obergrenze, die nur dort gilt, wo die Zeile eng ist, erfüllt beides.
//
// WARUM 44 px IN DER SCHMALEN ZEILE — die Zahl ist gemessen, nicht gewählt
// (`tests/chr-navigation-ci-logo/`). Der Kasten kostet die Zeile immer `Bildbreite + 12 px`
// (Plattenpolster `px-1.5`) `+ 10 px` (Aussenabstand `ml-2.5`). Zwei Messungen binden ihn:
//   · NACH UNTEN — 390 px, die engste Breite und die des Befunds. Ungedeckelt kostete der Kasten
//     110,3 px, und 20,5 px davon standen draussen. Mit 44 px kostet er 66 px, und der Konto-Kreis
//     endet rund 24 px INNERHALB des Fensters.
//   · NACH OBEN — 1000 px, die erste Breite oberhalb der Spanne unten, an der die BREITE Bauform
//     den Kasten wieder trägt. Dort steht die Zeile mit 44 px restlos im Fenster (Fall L2, und
//     gemessen Fälle K0/K1 in `tests/chr-kopfband-1000/`: der rechteste Kasten endet bei 968,0 px
//     von 1000 px). Mehr trägt die Zeile dort nicht; deshalb endet diese Stufe nicht früher.
//     NACHGEFÜHRT JOB 3641 (11.09.2026): bis dahin stand hier „rund 31 px Reserve bis zur
//     Fensterkante". Reserve ist das nicht — die 32,0 px bis zur Kante sind das Seitenpolster
//     (`px-8`), der freie Zwischenraum der Zeile ist an dieser Breite 0,0 px. Der ausgeschriebene
//     Beleg steht unten bei `LOGO_OHNE_PLATZ_QUERY`.
const LOGO_MAX_BREITE_PX = 44;

// WARUM 132 px IN DER BREITEN ZEILE, und warum dort überhaupt eine zweite Zahl steht.
//
// ZWECK DIESER STUFE IST NICHT ZU DECKELN, SONDERN NICHT ZU DECKELN: bei 1280 px soll das
// Firmenlogo in seiner ursprünglichen Grösse stehen, genau wie vor diesem Auftrag. Das heutige Bild
// ist dort gemessen 88,3 px breit (Datei 300 × 68 bei 20 px Höhe) — 132 px greift für es also
// nicht, und Fall L4 misst genau das: die Zeile ist bei 1280 px Kasten für Kasten dieselbe wie
// ohne jede Deckelung, Wortmarke und Bild eingeschlossen.
//
// WARUM DANN ÜBERHAUPT EINE GRENZE: weil die Regel nicht an der heutigen Bilddatei hängen darf
// (Lieferung 2). Ohne Grenze wäre ein Bild mit zwölffachem Seitenverhältnis bei 20 px Höhe über
// 1000 px breit und risse auch die breite Zeile auf.
//
// UND WARUM AUSGERECHNET 132 px — gemessen bei 1280 px mit einem solchen Bild (Scanlauf
// d34e0357…, Runde 2): bis dorthin zahlt die Zeile den Zuwachs überwiegend aus ihrem freien
// Zwischenraum, das Suchfeld hält 218,5 px. Erst darüber ist der Zwischenraum aufgebraucht und das
// SUCHFELD zahlt allein (160 px Bild → 190,8 px Suchfeld, also 27,7 px von 28 px Zuwachs). Das
// Suchfeld ist fremder Bestand (JOB 3060); die Grenze steht deshalb an dem Punkt, an dem die Zeile
// aufhört, aus Eigenem zu zahlen. Fall L6 misst sie am zwölffach breiten Bild.
const LOGO_MAX_BREITE_BREIT_PX = 132;

// AB WANN DIE BREITE ZEILE GILT.
//
// 1280 px ist die Breite, an der das Kopfband gegen sein Mockup gemessen wird (JOB 3060,
// `tests/design/zielbild-h1-huelle.test.ts`) — und damit die Breite, für die §5.4 die unveränderte
// Bauform verlangt. BEIDE Seiten der Kante sind gemessen (Fall L4): bei 1279 px gilt die schmale
// Grenze, das Bild steht mit 44 px, das Suchfeld behält seine vollen 260 px; bei 1280 px steht das
// Bild mit seinen 88,3 px, und nichts verlässt das Fenster.
//
// WAS DAMIT NICHT BEHAUPTET WIRD: dass 1280 px die kleinste Breite ist, die das volle Logo trüge.
// Zwischen 1000 und 1279 px ist das nicht ausgemessen; die Kante liegt hier, weil dort die Zusage
// des Mockups liegt, nicht weil darunter nichts ginge.
const LOGO_BREITE_ZEILE_QUERY = "(min-width: 1280px)";

// ================================================================================================
// UND DIE EINE BREITENSPANNE, IN DER DIE ZEILE DEN KASTEN IN KEINER GRÖSSE TRÄGT.
// ================================================================================================
//
// DAS IST DER UNANGENEHME TEIL DIESER ARBEIT, und er wird hier benannt statt versteckt. Bei 900 px
// beginnt die BREITE Bauform (`NARROW_QUERY` in `shell/useMediaQuery.ts` endet bei 899 px): volle
// Punktreihe, „Gehe zu …", Suchfeld, Zahnrad, Konto. Dort ist die Zeile schon OHNE Firmen-CI am
// Anschlag — gemessen bleiben 15,8 px bis zur Fensterkante (Fall L9). Der Logokasten kostet aber
// allein für Aussenabstand und Plattenpolster 22 px, BEVOR das Bild überhaupt einen Pixel bekommt.
// Es gibt in diesem Band also keine Obergrenze, die trägt; auch 0 px trüge nicht.
//
// DESHALB STEHT DAS LOGO DORT NICHT — und zwar sichtbar als benannte Regel mit ihrer Zahl, nicht
// als stilles `hidden`. Die obere Kante ist gemessen: mit einer Deckelung auf 56 px trug die breite
// Bauform den Kasten ab 980 px (rechter Rand 977,2 px), bei 970 px stand er noch 7,2 px draussen.
// 1000 px steht hier als die nächste runde Kante darüber. BEIDE Seiten sind gemessen (Fall L2:
// 999 px ohne Kasten, 1000 px mit Kasten, beide restlos im Fenster).
//
// NACHGEFÜHRT JOB 3641 (11.09.2026) — BIS DAHIN STAND HIER EIN SATZ ZU VIEL: „mit der jetzigen
// Deckelung auf 44 px bleiben bei 1000 px rund 31 px Reserve". Die Zahl gibt es, die RESERVE nicht.
// Gemessen bei 1000 px mit Firmen-CI (`tests/chr-kopfband-1000/`, Fälle K0/K1): der rechteste
// Kasten („konto") endet bei 968,0 px, also 32,0 px vor der Fensterkante — und diese 32,0 px sind
// das Seitenpolster der Zeile (`px-8`), das dort ohnehin steht. Der freie Zwischenraum der Zeile,
// die einzige Zahl, die „Reserve" heissen dürfte, ist an dieser Breite mit UND ohne Firmen-CI
// gemessene 0,0 px: bezahlt wird der Logokasten vom Suchfeld, das im selben Lauf um genau den
// Betrag schrumpft, um den die Wortmarke wächst. Der Kasten PASST bei 1000 px — das ist die
// Aussage, und sie ist gemessen. Luft hat er dort keine.
//
// WAS DAMIT NICHT BEHAUPTET WIRD: dass 900 px die richtige Kante der breiten Bauform ist. Dass die
// Zeile dort schon ohne Firmen-CI an ihre Grenze stösst, ist der Bestand von JOB 3060 und gehört
// nicht diesem Auftrag. Hier wird nur dafür gesorgt, dass die Firmen-CI ihn nicht über die
// Fensterkante schiebt.
//
// GELESEN WIRD DIE SPANNE ÜBER `useMediaQuery` — derselbe eine `matchMedia`-Griff, an dem auch
// `Kopfband.tsx` hängt. Kein zweiter Takt, kein eigener Zuhörer, und der Wechsel wirkt ohne
// Neuladen. Der Anfangswert wird synchron ausgewertet (`useMediaQuery.ts:19`), es gibt also kein
// kurzes Aufblitzen des Logos.
const LOGO_OHNE_PLATZ_QUERY = "(min-width: 900px) and (max-width: 999px)";

export function Logo(): JSX.Element {
  const stand = useSyncExternalStore(abonniereBranding, aktuellesBranding, aktuellesBranding);
  const ohnePlatz = useMediaQuery(LOGO_OHNE_PLATZ_QUERY);
  const breiteZeile = useMediaQuery(LOGO_BREITE_ZEILE_QUERY);
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
      {profil === null || marke === null || ohnePlatz ? null : (
        <span
          data-testid="kopfband-firmenlogo"
          className="ml-2.5 inline-grid h-7 place-items-center rounded-[6px] bg-white px-1.5 align-middle"
        >
          <img
            src={marke.logo}
            alt={BRAND_LOGO_ALT[profil]}
            className="h-5 w-auto object-contain"
            style={{
              maxWidth: `${breiteZeile ? LOGO_MAX_BREITE_BREIT_PX : LOGO_MAX_BREITE_PX}px`,
            }}
          />
        </span>
      )}
    </GuardedLink>
  );
}
