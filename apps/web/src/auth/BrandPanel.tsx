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
import { useTranslation } from "react-i18next";

/** Das Wortzeichen — einmal beschrieben, an drei Stellen verwendet. */
function Wortmarke({ hell }: { hell: boolean }): JSX.Element {
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
