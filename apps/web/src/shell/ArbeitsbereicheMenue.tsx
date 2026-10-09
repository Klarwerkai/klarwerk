import { ChevronDown } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import type { PaletteAnfrage } from "./CommandPalette";
import { WeitereBereicheZeilen } from "./KopfbandPunkte";
import { MenueFlaeche, MenueTrenner, MenueZeile, useMenue } from "./Menue";
import { WeiterUntenHinweis } from "./WeiterUnten";

// ================================================================================================
// FE-002 · DER BESCHRIFTETE EINSTIEG „ARBEITSBEREICHE".
// ================================================================================================
//
// Pedis Befund (26.09.2026): wichtige Arbeitsseiten wie „Meine Aufgaben" lagen hinter dem Zahnrad
// unter „Bereiche". Wer sie suchte, musste wissen, dass ein Einstellungssymbol zu Arbeitsseiten
// führt. Die Liste zieht deshalb aus dem Zahnrad hierher, unter ein eigenes Wort im Kopfband.
//
// ES IST DIESELBE LISTE, KEINE ZWEITE: `WeitereBereicheZeilen` (KopfbandPunkte.tsx) mit ihren
// Obergruppen, Zählern und dem Rollenfilter `canSee`. Kein Ziel kommt hinzu, keines fällt weg.
//
// DREI WEGE, DREI AUFGABEN — so sind sie jetzt auseinanderzuhalten:
//   · die Punkte des Kopfbands     — die häufigen Aufgaben, immer sichtbar
//   · „Arbeitsbereiche"            — die Übersicht über alle weiteren Seiten, gruppiert
//   · „Seite finden" (⌘K)          — der Schnellzugriff per Namen, derselbe wie bisher „Gehe zu …"
// Der Schnellzugriff steht deshalb als letzte Zeile auch in dieser Übersicht: wer die Seite in der
// Liste nicht sieht, findet dort den Weg, nach ihrem Namen zu suchen.

/** Die Zeilen der Übersicht — im Kopfband-Menü und im Drawer dieselben. */
export function ArbeitsbereicheEintraege({
  onSchnellzugriff,
  rueckweg,
}: {
  /**
   * Schließt das umgebende Menü VOR dem Öffnen der Palette, mit Fokusrückgabe an den Auslöser —
   * die Palette merkt sich den fokussierten Auslöser als Rückweg (JOB 3337 R2, s. ZahnradMenue).
   */
  onSchnellzugriff?: () => void;
  /** Im Drawer: der Auslöser „Menü", an den der Fokus nach der Palette zurückgeht. */
  rueckweg?: (() => HTMLElement | null) | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const seiteFinden = (): void => {
    onSchnellzugriff?.();
    // Im Drawer (erkennbar am Rückweg) ist die Modalgrenze in diesem Moment noch gesperrt — die
    // Palette merkt die Anfrage vor und öffnet nach der Freigabe (`nachModalgrenze`,
    // CommandPalette.tsx). Im Kopfband-Menü gibt es keine Grenze; dort bleibt es die gewöhnliche
    // Anfrage, die sofort öffnet.
    const detail: PaletteAnfrage | null = rueckweg ? { nachModalgrenze: true, rueckweg } : null;
    window.dispatchEvent(
      new CustomEvent<PaletteAnfrage | null>("open-command-palette", { detail }),
    );
  };
  return (
    <>
      <WeitereBereicheZeilen />
      <MenueTrenner />
      <MenueZeile
        onClick={seiteFinden}
        wert="⌘K"
        title={t("fe002.seiteFindenLabel")}
        testid="arbeitsbereiche-seite-finden"
      >
        {t("fe002.seiteFindenMenue")}
      </MenueZeile>
    </>
  );
}

/** Der Auslöser „Arbeitsbereiche" im Kopfband und seine aufklappende Übersicht. */
export function ArbeitsbereicheMenue(): JSX.Element {
  const { t } = useTranslation();
  const menue = useMenue();
  const { pathname } = useLocation();
  const { schliessen } = menue;
  // Jeder Routenwechsel schließt das Menü — wie Zahnrad und Konto.
  // biome-ignore lint/correctness/useExhaustiveDependencies: bewusst nur auf Pfadwechsel schließen.
  useEffect(() => {
    schliessen(false);
  }, [pathname, schliessen]);
  return (
    <div className="relative flex shrink-0 items-center">
      <button
        type="button"
        ref={menue.ausloeserRef}
        aria-haspopup="menu"
        aria-expanded={menue.offen}
        aria-controls={menue.offen ? menue.flaecheId : undefined}
        onClick={menue.umschalten}
        data-testid="kopfband-arbeitsbereiche"
        className="kw-kopfband-bereiche flex items-center gap-1 whitespace-nowrap rounded-btn px-1 py-1.5 text-[13.5px] leading-tight text-hairline outline-none hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <span>{t("fe002.arbeitsbereiche")}</span>
        <ChevronDown size={14} strokeWidth={2} aria-hidden="true" className="shrink-0" />
      </button>
      <MenueFlaeche
        menue={menue}
        label={t("fe002.arbeitsbereiche")}
        testid="arbeitsbereiche-menue"
        className="kw-menue-links max-h-[calc(100vh-80px)] overflow-y-auto"
      >
        <ArbeitsbereicheEintraege onSchnellzugriff={() => schliessen(true)} />
        {/* Gesamt-Navigation (R-1045): bei niedrigem Fenster (Tablet quer) scrollt die Übersicht. */}
        <WeiterUntenHinweis testid="arbeitsbereiche-weiter-unten" />
      </MenueFlaeche>
    </div>
  );
}
