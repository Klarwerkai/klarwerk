import { Menu, Search } from "lucide-react";
import { type FormEvent, type Ref, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGuardedNavigate } from "../app/NavGuardContext";
import { KontoMenue } from "./KontoMenue";
import { KopfbandPunkte } from "./KopfbandPunkte";
import { Logo } from "./Logo";
import { ZahnradMenue } from "./ZahnradMenue";
import { useMediaQuery } from "./useMediaQuery";

// ================================================================================================
// JOB 3525 · CHR-NAVIGATION-SCHMAL — DIE SCHMALE BREITE ZERFÄLLT IN ZWEI BÄNDER, NICHT IN EINES.
// JOB 3605 — UND AUF DEM OBEREN DER BEIDEN STEHT KEIN NAVIGATIONSPUNKT MEHR, NUR NOCH „GEHE ZU …".
// ================================================================================================
//
// PEDIS BEFUND (10.09. 09:05, Bildschirmfoto bei Codex): mit schmalerem Fenster waren die
// Menüpunkte fort, sichtbar war nur ein Symbol — der Weg zu „Meine Entwürfe" und „Gehe zu …" war
// nicht zu finden. Das Symbol trug bis hierher NUR ein `aria-label`; fürs Auge stand dort nichts.
//
// PEDIS VORGABE (11.09. Vormittag, über Codex, Nachricht 0bd3a41e): „Meine Entwürfe" stand daraufhin
// allein neben dem Logo. Er verlangt „normaler Teil der gesamten Navigation, keine Sonderstellung /
// kein immer sichtbarer Sonderknopf". Der Punkt ist deshalb fort von hier
// (`KopfbandPunkte.tsx`, Block „JOB 3605"); das Band selbst BLEIBT, weil „Gehe zu …" weiter darauf
// steht. Es ist kein Navigationspunkt, sondern eine Funktion — §3.3 des Auftrags lässt es stehen.
// DESHALB HEISST DIE KONSTANTE JETZT ANDERS: sie sagt seit JOB 3605 nichts mehr über Punkte aus,
// und ein Name, der das täte, wäre eine Behauptung ohne Deckung.
//
// DIE OBERE GRENZE IST ZWINGEND DIESELBE WIE `NARROW_QUERY` (899 px). Läge sie auch nur ein Pixel
// daneben, entstünde genau die Zwischenbreite, die der Auftrag verbietet: eine, in der weder
// „Gehe zu …" noch der beschriftete Menü-Knopf ihre Rolle voll ausfüllen. Der Test
// `tests/navigation-schmal/kopfband-schmal.test.tsx` (Fall G) rechnet diesen Anschluss aus BEIDEN
// Quelltexten nach, damit ein späterer Umbau die Fuge nicht still aufreißt.
//
// DIE UNTERE GRENZE IST 760 px, UND SIE IST BELEGT — in Chromium am gebauten Produkt, mit und ohne
// aktive Firmen-CI. Die Zeile besteht seit JOB 3605 aus Menü-Knopf, Wortmarke, „Gehe zu … ⌘K",
// Zahnrad und Konto — sie ist um „Meine Entwürfe" KÜRZER geworden, nicht länger. Gemessen wird
// weiter in der langen Sprache (DE); 64 px Seitenpolster, Fugen à 20 px (`gap-5`, s. u.), der Rest
// Inhalt.
//
// OHNE Firmen-CI: `tests/navigation-schmal/kopfband-schmal-chromium.test.ts` (JOB 3525), Fälle L1–L4
// und B1 bei genau 760 px — scrollWidth 760 / clientWidth 760.
//
// MIT Firmen-CI: `tests/navigation-schmal/kopfband-ci-chromium.test.ts` (JOB 3571), Fälle CI0–CI4.
// Gemessen am 11.09.2026: das Firmenlogo neben der Wortmarke (`Logo.tsx`) kostet 110,3 px, nicht die
// hier früher überschlagenen „rund 45 px" — die Wortmarke wächst von 92,2 px auf 202,5 px. Die
// 760-px-Kante trägt das: scrollWidth 760 / clientWidth 760, nichts umgebrochen, nichts
// angeschnitten, nichts überlappt. Der frühere Satz „der Überschlag steht hier als Begründung,
// NICHT als Beleg" ist damit eingelöst; die Zahl 760 bleibt, weil die Messung sie trägt, nicht weil
// die Rechnung stimmte.
//
// DIE RESERVE IST SEIT JOB 3605 GRÖSSER, und zwar gemessen statt überschlagen: mit dem Wegfall von
// „Meine Entwürfe" bleiben bei 760 px MIT Logo 182,5 px frei statt der 58,5 px, die JOB 3571 dort
// gemessen hatte (Lauf vom 11.09.2026, Fall CI0: „freier Raum bei 760 px: ohne CI 303,8 px → mit CI
// 182,5 px"). Die Kante bleibt trotzdem bei 760 px: sie trennt nicht „passt / passt nicht", sondern
// zwei Bedienformen — unter 760 px führt allein der Menü-Knopf. Eine Schwelle wegen gewonnenen
// Platzes zu verschieben, wäre eine Layoutentscheidung, die dieser Auftrag nicht trägt.
//
// WAS DIESELBE MESSUNG AUSSERHALB DIESES BANDS GEFUNDEN HAT (Fall CI5, Befund, hier NICHT behoben):
// Unter 760 px und in der breiten Bauform bei 900 px reicht der Platz mit aktiver Firmen-CI nicht —
// bei 390 px steht der Konto-Kreis 20,5 px, bei 900 px 109,5 px rechts ausserhalb des Fensters. Das
// Band 760–899 px, um das es hier geht, ist davon nicht betroffen; die Ursache ist die Breite des
// Logokastens (`Logo.tsx`) und gehört einem eigenen Auftrag.
//
// jsdom könnte keine dieser Fragen beantworten: dort gibt es kein Layout.
//
// 760 ist zugleich die Zahl, die das Produkt an dieser Stelle bereits führt (`useMediaQuery.ts`,
// `TABLET_LESE_QUERY`: „das Band ZWISCHEN Telefon und Desktop"). Eine EIGENE Konstante steht hier
// trotzdem, weil die beiden Bänder verschiedene Fragen beantworten — die Bibliothek entscheidet
// über ihre Lesespalten, das Kopfband über „Gehe zu …". Verschiebt die Bibliothek ihre
// Leseschwelle, soll das Kopfband nicht mitwandern.
export const SCHMAL_GEHEZU_QUERY = "(min-width: 760px) and (max-width: 899px)";

// ================================================================================================
// JOB 3060 · H1 — DAS EINE KOPFBAND (Mockup design/klarwerk/Main.dc.html Z.17-34).
// ================================================================================================
//
// 56 px hoch, Nachtblau, 32 px Seitenpolster, 36 px Abstand: links KLARWERK, dann die Punkte
// (JOB 3060: fünf; seit JOB 3503 sechs, „Meine Entwürfe" zwischen Erfassen und Prüfen),
// rechts das Suchfeld (260 px), das Zahnrad und der Konto-Kreis — sonst nichts. Die Werte stehen
// hier als Klassen (Maße) und in styles/modern.css (Farben, unter dem modernen Thema); gemessen
// werden sie an der gebauten Seite in tests/design/zielbild-h1-huelle.test.ts.
//
// Was NICHT mehr hier steht, hat einen benannten Ort (Auftrag 5a/5b): Mobil, Design, Meldungen und
// Abmelden im Konto-Menü; Hilfe, Status, Rechtliches, Version, Seitenhilfe und Weitere Bereiche im
// Zahnrad-Menü; Sprache auf /profil — und seit JOB 3323 ZUSÄTZLICH im Konto-Menü
// (`components/SprachSchalter.tsx`), damit der Wechsel aus jeder laufenden Szene erreichbar ist.
// Sichtbar wird er erst mit dem aufgeklappten Menü; der sichtbare Text der geschlossenen Leiste
// bleibt deshalb unverändert. Der sichtbare Text dieser Leiste sind genau die Wörter
// KLARWERK, Start, Fragen, Bibliothek, Erfassen, Meine Entwürfe, Prüfen, Gehe zu … ⌘K und der
// Platzhalter Suchen
// (tests/design/zielbild-h1-kein-erklaertext.test.ts).
//
// JOB 3525 fügt diesem Inventar KEIN Wort hinzu: das Wort „Menü" gehört zum Menü-Knopf, und den
// gibt es erst unter 900 px — auf der breiten Ansicht, an der das Inventar gemessen wird, ändert
// sich zeichengleich nichts.
//
// Navigation läuft ausschließlich über den Ungespeichert-Wächter (`useGuardedNavigate`,
// `GuardedLink` in den Bausteinen; mega39 B, shell-links-guarded.test.ts).
export function Kopfband({
  narrow = false,
  onOpenMenu,
  menuButtonRef,
}: {
  narrow?: boolean;
  onOpenMenu?: () => void;
  // E2E-017 (bens Block F/Drawer): Referenz auf den Hamburger, damit der Drawer den Fokus beim
  // Schließen genau hierher zurückgibt.
  menuButtonRef?: Ref<HTMLButtonElement>;
} = {}): JSX.Element {
  const { t } = useTranslation();
  const navigate = useGuardedNavigate();
  const [q, setQ] = useState("");
  // JOB 3525: das obere der beiden schmalen Bänder (760–899 px). Der Wert wird IMMER gelesen, auch
  // breit — `narrow` entscheidet danach, ob er überhaupt etwas bedeutet. Ein Haken darf nicht
  // hinter einer Bedingung stehen.
  const geheZuSchmal = useMediaQuery(SCHMAL_GEHEZU_QUERY);
  /** Das UNTERE schmale Band (< 760 px): dort führt allein der beschriftete Menü-Knopf. */
  const nurMenue = narrow && !geheZuSchmal;

  // Das Kopfbandinventar gilt in JEDEM Zustand — auch in der Rollen-Vorschau des Admins. Der
  // Rückweg „Zur Admin-Ansicht" wohnt deshalb ausschließlich im Zahnrad-Menü (RollenVorschau.tsx),
  // nicht als Pille hier (Codex, JOB 3060 R5).

  // Enter → /bibliothek?q=… — derselbe Weg wie die Konsole der Startseite (pages/Start.tsx) und
  // gelesen in pages/Library.tsx (`params.get("q")`).
  const submitSearch = (e: FormEvent): void => {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/bibliothek?q=${encodeURIComponent(term)}` : "/bibliothek");
  };

  // ==============================================================================================
  // JOB 3525 · DER ABSTAND SCHMAL — UND WARUM ER NICHT IM KLASSENSTRING STEHT.
  // ==============================================================================================
  //
  // SACHE: der Abstand zwischen den Blöcken ist BREIT unverändert 36 px (`gap-9`, Mockup
  // Main.dc.html) und SCHMAL 20 px. Das war der Platz, aus dem JOB 3525 seine Lieferung 2 bezahlt
  // hat: Fugen à 36 px sind auf 760 px ein spürbarer Teil der ganzen Zeile.
  //
  // JOB 3605 hat jene Lieferung zurückgenommen (der Punkt ist fort, Begründung oben) — der schmale
  // Abstand BLEIBT trotzdem 20 px. Er ist kein Gegenstück zu einem einzelnen Punkt, sondern der
  // Abstand, in dem die schmale Zeile gemessen wurde und in dem sie weiter gemessen wird
  // (`kopfband-messung.ts`, `SCHMALE_FUGE`); ihn jetzt zu verstellen hiesse, eine belegte Zeile
  // ohne Not gegen eine ungemessene zu tauschen.
  //
  // FORM (Runde 2, nach ROT): in Runde 1 stand der Abstand als eingesetzte Klasse in einem
  // Vorlagentext (className={`kw-kopfband … ${abstand} …`}). Das hat ZWEI Prüfer gebrochen, die den
  // Klassenstring dieses `<header>` als STRING-LITERAL lesen und lesen müssen:
  //   · `tests/kontokreis-funke/konto-kreis-traegt-den-funke.test.ts:313` bricht ausdrücklich ab
  //     („`className` ist kein String-Literal") statt zu raten — die ganze Datei sammelte 0 Fälle;
  //   · `tests/legal/mega62-kontrast-pflichtflaechen.test.ts:224` sucht das Klassenattribut dieses
  //     Elements WÖRTLICH im Quelltext, weil die Kontrastrechnung sonst an einem geratenen Pfad
  //     hinge. (Die gesuchte Zeichenfolge steht hier mit Absicht NICHT im Klartext: ein Kommentar,
  //     der sie abschriebe, hielte jene Prüfung grün, während das Attribut längst fort wäre —
  //     gemessen in der Gegenprobe dieser Runde, wo genau das geschah.)
  // Beide haben recht: der DOM-Pfad des Kopfbands ist die Voraussetzung fremder Messungen, und eine
  // berechnete Klassenliste macht ihn unlesbar. Der Klassenstring bleibt deshalb, was er war.
  //
  // Der schmale Abstand steht stattdessen als EIGENSCHAFT am Element — `columnGap`, also genau die
  // Achse, um die es geht (umgebrochen wird nichts, `row-gap` wäre ohne Wirkung). BREIT ist das
  // Attribut `undefined`: die breite Ansicht trägt kein `style`, ihr DOM ist zeichengleich der
  // Bestand von JOB 3060 (Lieferung 3, Fälle F und B3).
  const schmalerAbstand = narrow ? { columnGap: "20px" } : undefined;

  return (
    <header
      data-testid="kopfband"
      className="kw-kopfband flex h-[56px] shrink-0 items-center gap-9 bg-ink px-8 text-white"
      style={schmalerAbstand}
    >
      {/* ==========================================================================================
          E2E-017 · JOB 3525 — DER SCHMALE KOPF TRÄGT EIN WORT, NICHT NUR EIN ZEICHEN.
          ==========================================================================================
          Bis JOB 3525 stand hier ein `grid h-9 w-9`-Kästchen mit dem Hamburger und einem
          `aria-label`. Wer sieht, sah nichts; wer hört, hörte „Menü öffnen". Genau diese Hälfte hat
          Pedi gefehlt. Jetzt steht das Wort DA — und es ist ein eigener, kurzer Schlüssel
          (`topbar.menuShort`, de/en/nl), nicht der Satz „Menü öffnen": eine Beschriftung ist ein
          Name, keine Aufforderung.

          DAS `aria-label` BLEIBT „Menü öffnen" und behält damit die Handlung im zugänglichen Namen.
          Es ENTHÄLT das sichtbare Wort („Menü" in „Menü öffnen", „Menu" in „Open menu") — die
          Bedingung von WCAG 2.5.3 „Label in Name", die ein Sprachbediener braucht, um „Klick Menü"
          sagen zu können. Ein `aria-label`, das das sichtbare Wort NICHT enthielte, wäre hier der
          eigentliche Fehler; der Test hält beides zusammen (Fall A).

          `shrink-0`: der Knopf gibt keinen Platz ab — er ist auf dem unteren Band der einzige Weg
          in die Navigation. `-ml-3` und `h-9` sind unverändert, die Kopfbandhöhe von 56 px bleibt
          damit unberührt (im Browser gemessen, Fall L1). */}
      {narrow ? (
        <button
          type="button"
          ref={menuButtonRef}
          data-testid="kopfband-menue"
          aria-label={t("topbar.openMenu")}
          onClick={() => onOpenMenu?.()}
          className="-ml-3 flex h-9 shrink-0 items-center gap-1.5 rounded-btn px-1.5 text-hairline hover:text-white"
        >
          <Menu size={20} aria-hidden="true" />
          <span className="text-[13px] leading-none">{t("topbar.menuShort")}</span>
        </button>
      ) : null}
      <Logo />
      {/* JOB 3605: schmal steht hier NICHTS mehr. Bis dahin zog `KopfbandPunkteSchmal` auf dem Band
          760–899 px „Meine Entwürfe" allein neben das Logo; Pedi hat am 11.09. genau das als
          Sonderstellung beanstandet. Die Navigation wohnt schmal vollständig hinter dem
          beschrifteten Menü-Knopf. Breit ändert sich nichts. */}
      {narrow ? null : <KopfbandPunkte />}
      <div className="ml-auto flex min-w-0 shrink items-center gap-4">
        {/* ==========================================================================================
            JOB 3503 · TEIL 3b — „GEHE ZU …" STEHT OBEN, NICHT NUR HINTER DEM ZAHNRAD.
            ==========================================================================================
            Pedi (10.09. 06:48 über Codex): „Gehe zu" soll ebenfalls direkt sichtbar oben im Kopfband
            stehen, nicht nur hinter dem Zahnrad. Der vorhandene Tastaturweg bleibt und soll
            erkennbar bleiben.

            ES IST DERSELBE EINSTIEG, KEIN ZWEITER: gerufen wird das Fensterereignis
            `open-command-palette`, das `shell/CommandPalette.tsx` seit langem hört und das die Zeile
            im Zahnrad-Menü (`ZahnradMenue.tsx`, `schnellnavigation`) schon benutzt. Hier entsteht
            KEINE zweite Palette, keine zweite Trefferliste und keine zweite Namensregel — nur ein
            zweiter Griff an dieselbe Fläche. Auch die Beschriftung ist die vorhandene
            (`menue.schnellnavigation`, de/en/nl), und das Kürzel steht als „⌘K" da, zeichengleich
            mit der Zahnrad-Zeile.

            DIE TASTENKOMBINATION BLEIBT ERKENNBAR und sie bleibt der eigentliche Weg: der Knopf
            NENNT sie, er ersetzt sie nicht. ⌘K/Strg+K hängt unverändert am Fenster-Zuhörer in
            `CommandPalette.tsx` — dieser Knopf fasst ihn nicht an.

            `shrink-0`: der Knopf gibt keinen Platz ab. Das Suchfeld daneben ist schrumpffähig und
            trägt bei 1280 px unverändert seine gemessenen 260 px (Zielbild V12).

            SCHMAL, SEIT JOB 3525: der Knopf steht auf dem OBEREN schmalen Band (760–899 px)
            ebenfalls hier — er ist einer der beiden Wege, die Pedi am 10.09. gesucht hat. Seit
            JOB 3605 ist er dort das EINZIGE, was oben steht: die Navigationspunkte sind ins Menü
            gewandert, er nicht, weil er keiner ist (§3.3 jenes Auftrags). Nur
            unter 760 px entfällt er, und dann führt die Beschriftung des Menü-Knopfes dorthin: die
            Zeile „Gehe zu …" steht unverändert im Zahnrad-Menü, das der Drawer mitträgt
            (`DrawerMenue.tsx`, `ZahnradEintraege`). Ein zweiter Bau entsteht dadurch nicht — es ist
            derselbe Knopf, nur eine Bedingung weiter. */}
        {nurMenue ? null : (
          <button
            type="button"
            data-testid="kopfband-gehezu"
            onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
            className="flex shrink-0 items-center gap-2 rounded-[9px] border border-hairline/25 px-2.5 py-[6px] text-[13px] leading-normal text-hairline outline-none hover:border-hairline/50 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <span>{t("menue.schnellnavigation")}</span>
            {/* Kein neuer Textschlüssel: das Kürzel ist ein Zeichen, keine Übersetzung — genauso
                steht es in der Zahnrad-Zeile (`ZahnradMenue.tsx`, `wert="⌘K"`). */}
            <span className="rounded-[5px] bg-hairline/15 px-1.5 py-px font-mono text-[10.5px] text-hairline">
              ⌘K
            </span>
          </button>
        )}
        {/* E2E-017: auf schmalen Breiten entfällt das Suchfeld (die Suche bleibt über die
            Bibliothek erreichbar); Zahnrad und Konto bleiben. */}
        {narrow ? null : (
          <form
            onSubmit={submitSearch}
            className="kw-kopfband-suche flex w-[260px] min-w-0 items-center gap-2 rounded-[9px] bg-surface px-3 py-[7px] text-[13px] text-muted-2"
          >
            <button
              type="submit"
              aria-label={t("topbar.search")}
              className="grid shrink-0 place-items-center text-muted-2 hover:text-text"
            >
              <Search size={15} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("kopfband.suchen")}
              aria-label={t("topbar.search")}
              className="w-full min-w-0 bg-transparent text-[13px] leading-normal text-text outline-none placeholder:text-muted-2"
            />
          </form>
        )}
        <ZahnradMenue />
        <KontoMenue />
      </div>
    </header>
  );
}
