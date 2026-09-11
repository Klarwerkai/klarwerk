// ================================================================================================
// JOB 1097 — DIE GEMEINSAMEN BAUSTEINE DER OEFFENTLICHEN STRECKE (D-028 und D-027).
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. Der Markenblock stand zeichengleich zweimal im Baum — in
// `AuthScreens.tsx` und in `ResetScreen.tsx`. Die Designlieferung nennt genau das als Befund von
// D-028: „Jede Änderung muss an beide Stellen, sonst laufen sie auseinander." Dieselbe Falle
// drohte beim Sprachumschalter aus D-027, der auf BEIDE Masken gehört. Deshalb liegen beide
// Bausteine hier und nicht doppelt dort.
//
// Der Name der Datei sagt „BrandPanel", weil die Markenfläche der größere Teil ist; der
// Sprachumschalter liegt bewusst daneben statt in einer dritten Datei — beide sind ausschließlich
// Bausteine der öffentlichen Strecke und haben außerhalb von ihr keinen Aufrufer.
import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { BRAND_LOGO_ALT, abonniereBranding, aktuellesBranding } from "../lib/brandTheme";

// ================================================================================================
// JOB 3577 — DIE ANMELDEMASKE TRÄGT DIE FIRMEN-CI MIT. SIE IST DIE ERSTE FLÄCHE, DIE EIN GAST SIEHT.
// ================================================================================================
//
// Bis hierher trug bei aktiver Firmen-CI ALLES das Advisor-Zeichen — Kopfband, Bibliothek, Admin —,
// nur die öffentliche Strecke nicht. Sie ist damit die einzige Fläche gewesen, die der Markenwahl
// der Installation widersprochen hat, und ausgerechnet die, die bei der Vorführung zuerst dasteht.
//
// NEBEN, NICHT ANSTELLE: Pedis Auflage „die Produktidentität bleibt erkennbar" gilt hier genauso wie
// im Kopfband (`shell/Logo.tsx:17`). Das Wort KLARWERK und der Untertitel „Reasoning System" bleiben
// in JEDEM Zustand stehen; das Firmenlogo tritt daneben.
//
// WOHER DER STAND KOMMT — dieselbe EINE Quelle wie an der Wurzel (`shell/Logo.tsx:36`): das Modul
// `lib/brandTheme.ts`, das `/api/branding` auf einen Abruf je Minute gedrosselt abfragt. Diese Datei
// fragt AUSDRÜCKLICH nicht selbst; eine eigene Abfrage „nur für die Anmeldemaske" wäre ein zweiter,
// ungedrosselter Takt neben dem dort gedrosselten (`brandTheme.ts:187-189`). `useSyncExternalStore`
// sorgt zugleich dafür, dass ein bereits geöffnetes `/login`-Fenster das Umschalten ohne Neuladen
// mitbekommt. Dass die öffentliche Strecke den Stand überhaupt haben KANN, hängt an zwei belegten
// Punkten: `GET /api/branding` ist `public` (JOB 3510), und `main.tsx:23` ruft `initBrandTheme()`
// bedingungslos vor dem ersten Render — also auch vor der Anmeldung.
//
// DIE WEISSE PLATTE, IN BEIDEN VARIANTEN — gemessen, nicht geschätzt (WCAG-Leuchtdichte):
//   · Auf dem dunklen `bg-ink` der Spalte ist sie PFLICHT. Der dunkle Schriftzug des Logos (#161417)
//     misst dort 1,13:1 (klassisch #16222C) bzw. 1,01:1 (modern #0E1626) — praktisch unsichtbar;
//     das Advisor-Blau käme mit 3,37:1 bzw. 3,77:1 gerade so durch. Auf Weiß sind es 18,32:1 und
//     4,80:1. Dieselbe Bauform und dieselbe Begründung wie `shell/Logo.tsx:28-31`.
//   · Auf dem hellen Grund des schmalen Ankers wäre sie nicht nötig (Blau 4,36:1 auf der klassischen
//     Seite #F3F4F6 und 4,53:1 auf modernem Papier #FAF8F5 — beides über den 3:1 für Grafik) und
//     steht trotzdem: das KLARWERK-Zeichen direkt daneben sitzt schon heute BEDINGUNGSLOS auf einer
//     weißen Platte (`:20`), zwei verschiedene Behandlungen nebeneinander sähen zufällig aus. Und
//     Weiß ist themenfest, während der Seitenton mit der Darstellungswahl wechselt.
// Es entsteht dabei KEINE neue CSS-Regel mit `color`: die Platte ist eine Tailwind-Utility auf
// vorhandenen Token-Werten, der Kontrastsammler bekommt also nichts Neues zu messen.
//
// `alt` KOMMT AUS DEM PROFIL (`BRAND_LOGO_ALT`), nicht aus `marke.name` und nicht über `i18n`: der
// Alternativtext ist eine Eigenschaft der Originaldatei, keine Übersetzung (`brandTheme.ts:43-49`).

/** Das Wortzeichen — einmal beschrieben, an drei Stellen verwendet. */
function Wortmarke({ hell }: { hell: boolean }): JSX.Element {
  const stand = useSyncExternalStore(abonniereBranding, aktuellesBranding, aktuellesBranding);
  // Ein Profil OHNE Schalter und ein Schalter OHNE Profil sind beide „aus" — wörtlich die Regel aus
  // `shell/Logo.tsx:39-40`, damit die Anmeldemaske und die Hülle nicht zwei Sichtbarkeitsbegriffe
  // bekommen. `null` („noch nicht bekannt") führt auf denselben Zweig wie „aus": kein Platzhalter,
  // kein Skelett, kein Aufblitzen.
  const profil = stand?.aktiv ? stand.profil : null;
  const marke = profil === null ? null : (stand?.marke ?? null);
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-white">
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="6.5" fill="none" stroke="#ED7D0E" strokeWidth="3.4" />
          <circle cx="10" cy="10" r="3" fill="#ED7D0E" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className={`block text-[15px] font-bold tracking-[2px] ${hell ? "" : "text-ink"}`}>
          KLARWERK
        </span>
        <span
          className={`block font-mono text-[10px] uppercase tracking-[1.5px] ${
            hell ? "text-white/50" : "text-muted-2"
          }`}
        >
          Reasoning System
        </span>
      </span>
      {profil === null || marke === null ? null : (
        // Der Abstand kommt aus dem `gap-2.5` des Umschlags — kein eigener Rand, der neben der
        // vorhandenen Lücke eine zweite Zahl wäre.
        <span
          data-testid="auth-firmenlogo"
          className="grid h-9 place-items-center rounded-[10px] bg-white px-2"
        >
          <img src={marke.logo} alt={BRAND_LOGO_ALT[profil]} className="h-6 w-auto" />
        </span>
      )}
    </span>
  );
}

/**
 * Die Markenspalte am Desktop.
 *
 * D-028 hatte zwei Befunde: die halbe Bildschirmbreite trug nur Logo, Tagline und Domain, weit
 * auseinandergezogen — und unterhalb 1024 px verschwand sie KOMPLETT (`hidden … lg:flex`), also
 * kein Markenanker auf Tablet und Telefon.
 *
 * Die Fläche trägt jetzt die vorhandene Nutzenzeile (`auth.taglineSub`) als eigene Aussage und
 * rückt zusammen, statt sich über die volle Höhe zu verteilen. Kein neues Bild, kein neuer Text:
 * beide Zeilen liegen dreisprachig im Bestand.
 */
export function BrandPanel(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      data-testid="auth-brand-panel"
      className="hidden w-1/2 flex-col justify-center gap-8 bg-ink p-10 text-white lg:flex"
    >
      <Wortmarke hell />
      <div className="max-w-sm">
        <p className="text-xl font-semibold leading-snug">{t("auth.tagline")}</p>
        <p className="mt-3 text-sm text-white/60">{t("auth.taglineSub")}</p>
      </div>
      <div className="font-mono text-[11px] text-white/40">klarwerk.ai</div>
    </div>
  );
}

/**
 * Der Markenanker für schmale Geräte.
 *
 * Er steht ÜBER der Karte und ersetzt nicht die Spalte, sondern füllt die Lücke, die sie unterhalb
 * 1024 px hinterlässt: dort war bisher gar nichts. Umgekehrt verschwindet er am Desktop, wo die
 * Spalte daneben dasselbe schon sagt — zwei Wortmarken nebeneinander wären eine Dopplung.
 */
export function BrandCompact(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div data-testid="auth-brand-compact" className="mb-6 flex flex-col gap-2 lg:hidden">
      <Wortmarke hell={false} />
      <p className="text-[13px] text-muted">{t("auth.tagline")}</p>
    </div>
  );
}

/**
 * Die Sprachwahl VOR der Anmeldung (D-027).
 *
 * Der Befund: die Anmeldemaske war fest deutsch. Beide vorhandenen Umschalter liegen HINTER dem
 * Anmeldetor (Topbar und Profil) — „die Übersetzung ist da, sie ist nur nicht erreichbar". Sämtliche
 * `auth.*`-Texte liegen dreisprachig vor.
 *
 * Bauform übernommen vom vorhandenen Muster in `shell/Topbar.tsx`. Bewusst NACHGEBAUT und nicht
 * importiert: jener Schalter ist dateilokal und gehört zur angemeldeten Hülle; ein Export von dort
 * hinge die öffentliche Strecke an die Shell, die sie gerade nicht hat.
 */
export function PublicLangSwitch(): JSX.Element {
  const { i18n } = useTranslation();
  const aktiv = i18n.language.startsWith("en")
    ? "en"
    : i18n.language.startsWith("nl")
      ? "nl"
      : "de";
  return (
    <div
      data-testid="auth-lang-switch"
      className="flex overflow-hidden rounded-pill border border-hairline text-[12px] font-semibold"
    >
      {(["de", "en", "nl"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => void i18n.changeLanguage(l)}
          className={`px-2.5 py-1 uppercase transition-colors ${
            aktiv === l ? "bg-ink text-white" : "text-muted hover:text-text"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
