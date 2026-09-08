import type { ReactNode } from "react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

// ================================================================================================
// JOB 3062 · H3 — DAS UNTERMENÜ NACH PAGES-ART.
// ================================================================================================
//
// PEDIS VORGABE (04.09. 07:58): „Orientiere dich an Pages, arbeite mit Untermenüs. Behalte die
// klare Linie bei. Wir haben sehr, sehr viele Informationsfunktionen."
//
// Ein Blatt hat Platz für Titel und Text — sonst nichts. Alles andere, was die Erfassung KANN,
// liegt hinter einem Werkzeug der Zeile darüber und klappt bei Klick als Liste darunter auf. Das
// ist genau die Bauform des Mockups `design/klarwerk/Menues.dc.html`: weiße Fläche, eine Haarlinie,
// Radius 10 px, der Werkbank-Schatten, Einträge 13,5 px auf 36 px Höhe.
//
// EINE MECHANIK, NICHT SIEBEN: Öffnen/Schließen, Klick nach außen, Escape und die
// Tastaturzugänglichkeit (`aria-haspopup`, `aria-expanded`, `aria-controls`) stehen hier EINMAL.
// Die Werkzeugzeile hält den offenen Namen als EINEN Zustand — es kann also nie zwei offene Menüs
// geben, und kein Werkzeug baut sich seine eigene Auslegung davon.
export interface MenueProps {
  /** Stabiler Name dieses Menüs — der Schlüssel im gemeinsamen Offen-Zustand der Zeile. */
  name: string;
  /** Der offene Name der Zeile (oder null). */
  offen: string | null;
  /** Setzt den offenen Namen der Zeile. */
  setOffen: (name: string | null) => void;
  /** Beschriftung des Werkzeugs — das eine Wort, das der Mensch liest. */
  wort: string;
  /**
   * JOB 3266 (D1): Der zugängliche NAME des Werkzeugs, wenn das sichtbare Wort ihn nicht trägt.
   *
   * Das „…"-Menü der Erfassung führt `wort=""` und nur ein Symbol (`SymbolMehr`). Für Auge und
   * Maus reicht das; für Tastatur und Screenreader war der Knopf bis hierher NAMENLOS — er wurde
   * als „Schaltfläche" ohne Wort angesagt, und der Weg zu den eigenen Entwürfen lag dahinter
   * (Vorführung 07.09., Pedi fand ihn nicht). `aria-label` gibt ihm den Namen, ohne die Fläche zu
   * verändern.
   *
   * Das ausgeschriebene `| undefined` ist Pflicht (`exactOptionalPropertyTypes`), aus demselben
   * Grund wie bei `beschriebenVon` weiter unten: die Aufrufer reichen den Wert bedingt herein.
   */
  beschriftung?: string | undefined;
  /** Das 16-px-Symbol links vom Wort (Mockup Z.36-38); ohne Symbol bleibt nur das Wort. */
  symbol?: ReactNode;
  /** Rechte Zeilenhälfte (Bereich, Vertraulichkeit, …): Rahmen, Fläche, Chevron. */
  gerahmt?: boolean;
  /** Gesperrt (z. B. „Diktieren" ohne SpeechRecognition) — sichtbar grau, NICHT verschwunden. */
  gesperrt?: boolean;
  /** Grund der Sperre bzw. Kurzhinweis am Werkzeug (title). */
  titel?: string;
  /** Ein zusätzlicher Rand am Werkzeug — die Pflichtmarkierung der Vertraulichkeit (§5.4). */
  markiert?: boolean;
  /**
   * JOB 3114 (UX-05): Die `id` eines Erklärsatzes, der zu DIESEM Werkzeug gehört — sie landet als
   * `aria-describedby` am Knopf. Ohne sie steht kein Attribut da; ein `aria-describedby`, das auf
   * nichts zeigt, wäre für ein Hilfsmittel schlechter als gar keines.
   *
   * DAS AUSDRÜCKLICHE `| undefined` IST PFLICHT, NICHT KOSMETIK (JOB 3114 R2): Das Tor fährt mit
   * `exactOptionalPropertyTypes: true` (`tsconfig.json:12`). Unter dieser Regel heisst `x?: string`
   * „weglassen ODER ein String" — ein AUSGESCHRIEBENES `undefined` ist damit verboten. Genau so
   * ruft das Blatt aber auf (`beschriebenVon={steht ? ID : undefined}`), und genau so muss es
   * rufen: der Verweis darf nur stehen, solange der Satz steht. Dieselbe Schreibweise trägt
   * `CaptureArbeitsraumProps.modus` aus demselben Grund.
   */
  beschriebenVon?: string | undefined;
  /**
   * JOB 3114 (UX-05): Der Knopf trägt eine offene Pflicht (`aria-invalid`). Nur `true` schreibt das
   * Attribut — `aria-invalid="false"` an jedem Werkzeug wäre Rauschen im Screenreader.
   * `| undefined` aus demselben Grund wie oben.
   */
  ungueltig?: boolean | undefined;
  /** Der Inhalt der aufklappenden Fläche. */
  children: ReactNode;
  /** Testanker. */
  pruefname?: string;
}

const CHEVRON = (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#9AA2B1"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <title>·</title>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export function Menue({
  name,
  offen,
  setOffen,
  wort,
  beschriftung,
  symbol,
  gerahmt = false,
  gesperrt = false,
  titel,
  markiert = false,
  beschriebenVon,
  ungueltig = false,
  children,
  pruefname,
}: MenueProps): JSX.Element {
  const istOffen = offen === name;
  const huelle = useRef<HTMLDivElement | null>(null);
  const flaeche = useRef<HTMLDivElement | null>(null);
  const flaecheId = useId();

  // ==============================================================================================
  // JOB 3266 R2 (bens Korrekturpflicht 1) — DIE FLÄCHE BLEIBT IM FENSTER.
  // ==============================================================================================
  //
  // BENS MESSUNG an Runde 1, in echtem Chromium bei 390 px: die Titelzeile der Entwurfsliste lag
  // bei x = −237 px — die Liste stand fast vollständig links AUSSERHALB des Fensters, ihre Titel
  // waren nicht lesbar. Ursache ist die Verankerung: ein gerahmtes Werkzeug öffnet seine Fläche
  // mit `right-0`, also rechtsbündig zum KNOPF. Auf dem Schreibtisch steht dieser Knopf weit
  // rechts, die 320 px breite Fläche liegt also im Bild. Auf dem Telefon bricht die Werkzeugzeile
  // um (`flex-wrap`), der Knopf steht am linken Zeilenanfang — und dieselbe Regel schiebt die
  // Fläche über den linken Rand hinaus. Der zusätzliche Zugang dieses Auftrags hat den Umbruch
  // ausgelöst; die Regel war schon vorher einseitig.
  //
  // DESHALB WIRD NICHT DIE SEITE UMGEBAUT, SONDERN DIE FLÄCHE GEMESSEN. Ein zweiter fester
  // Anker („unter `sm` eben `left-0`") wäre bloß derselbe Fehler spiegelverkehrt: ein Werkzeug am
  // rechten Zeilenende schöbe die Fläche dann nach rechts hinaus. Gemessen wird das, worauf es
  // ankommt — liegt die Fläche im Fenster? —, und nur die Differenz wird ausgeglichen.
  //
  // ES KONVERGIERT UND ES SCHWINGT NICHT: Die Verschiebung nach links ist auf den Weg begrenzt,
  // den die linke Kante bis zum Rand hat (`moeglich`). Eine Fläche, die breiter ist als das
  // Fenster, bleibt deshalb links bündig, statt zwischen beiden Rändern hin und her zu springen —
  // ihre BREITE deckelt zusätzlich `max-w-[calc(100vw-1rem)]` unten.
  //
  // OHNE GEMESSENE FLÄCHE WIRD NICHTS VERSCHOBEN (`breite === 0 && hoehe === 0`): In jsdom gibt es
  // keinen Umbruch und kein Layout, jedes Rechteck ist null. Ein Ausgleich auf dieser Grundlage
  // wäre eine erfundene Zahl — und ein Effekt, der sich selbst immer weiter verschiebt.
  //
  // UND ER HÖRT AUF (`versuche`): Ein Effekt, der misst, verschiebt und daraufhin wieder misst,
  // hängt an der Zusage, dass die Verschiebung auch WIRKT. Nähme eine spätere Regel sie zurück
  // (ein `transform` am selben Knoten, eine Elternfläche, die nicht mitgeht), berechnete er
  // dieselbe Differenz endlos neu — React bräche mit „Maximum update depth exceeded", und die
  // ganze Seite stünde. Gemessen: genau das passiert, wenn man die Anwendung der Verschiebung
  // entfernt (Gegenprobe A dieser Runde). Drei Anläufe je Öffnung sind mehr, als der Ausgleich je
  // braucht (er konvergiert im ersten), und sie machen aus einem möglichen Stillstand eine
  // Fläche, die im Zweifel nur nicht ganz sitzt.
  const [versatz, setVersatz] = useState(0);
  const versuche = useRef(0);
  useLayoutEffect(() => {
    if (!istOffen) {
      versuche.current = 0;
      if (versatz !== 0) {
        setVersatz(0);
      }
      return;
    }
    const einpassen = (): void => {
      const el = flaeche.current;
      if (!el || versuche.current >= 3) {
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) {
        return;
      }
      const rand = 8;
      const fenster = document.documentElement.clientWidth;
      let neu = versatz;
      if (r.left < rand) {
        neu = versatz + (rand - r.left);
      } else if (r.right > fenster - rand) {
        const schub = r.right - (fenster - rand);
        const moeglich = Math.max(0, r.left - rand);
        neu = versatz - Math.min(schub, moeglich);
      }
      if (Math.abs(neu - versatz) > 0.5) {
        versuche.current += 1;
        setVersatz(neu);
      }
    };
    einpassen();
    // Ein neues Fenster ist eine neue Lage — dafür stehen die Anläufe wieder offen.
    const beiGroesse = (): void => {
      versuche.current = 0;
      einpassen();
    };
    window.addEventListener("resize", beiGroesse);
    return () => window.removeEventListener("resize", beiGroesse);
  }, [istOffen, versatz]);

  // Klick nach außen und Escape schließen — beides nur, solange DIESES Menü offen ist. Der Hörer
  // hängt am Dokument und nicht an der Hülle: ein Klick auf eine andere Stelle der Seite erreicht
  // die Hülle sonst nie.
  useEffect(() => {
    if (!istOffen) {
      return;
    }
    const beiKlick = (ereignis: MouseEvent): void => {
      if (huelle.current && !huelle.current.contains(ereignis.target as Node)) {
        setOffen(null);
      }
    };
    const beiTaste = (ereignis: KeyboardEvent): void => {
      if (ereignis.key === "Escape") {
        setOffen(null);
      }
    };
    document.addEventListener("mousedown", beiKlick);
    document.addEventListener("keydown", beiTaste);
    return () => {
      document.removeEventListener("mousedown", beiKlick);
      document.removeEventListener("keydown", beiTaste);
    };
  }, [istOffen, setOffen]);

  const werkzeugKlasse = gerahmt
    ? `inline-flex items-center gap-1.5 rounded-[8px] border bg-surface px-3 py-1.5 text-[13px] ${
        markiert ? "border-trust-crit-fill" : "border-hairline"
      } ${gesperrt ? "text-muted-2 opacity-60" : "text-text hover:bg-hairline-soft"}`
    : `inline-flex items-center gap-1.5 text-[13px] ${
        gesperrt ? "text-muted-2 opacity-50" : "text-muted-2 hover:text-text"
      }`;

  return (
    <div className="relative" ref={huelle}>
      <button
        type="button"
        disabled={gesperrt}
        aria-haspopup="menu"
        aria-expanded={istOffen}
        // Nur, wenn das sichtbare Wort den Namen nicht schon trägt: ein `aria-label` neben einem
        // gleichlautenden Wort wäre doppelt, ein abweichendes wäre eine zweite Wahrheit über
        // denselben Knopf.
        aria-label={beschriftung ?? undefined}
        aria-controls={flaecheId}
        aria-describedby={beschriebenVon ?? undefined}
        aria-invalid={ungueltig ? true : undefined}
        title={titel ?? undefined}
        data-testid={pruefname ?? `blatt-werkzeug-${name}`}
        onClick={() => setOffen(istOffen ? null : name)}
        className={werkzeugKlasse}
      >
        {symbol}
        {wort}
        {gerahmt ? CHEVRON : null}
      </button>
      {istOffen ? (
        <div
          id={flaecheId}
          ref={flaeche}
          role="menu"
          data-testid={`blatt-menue-${name}`}
          // `max-w-[calc(100vw-1rem)]`: die Fläche kann nie breiter sein als das Fenster. Ohne
          // diesen Deckel liefe die 320-px-Liste bei 320 px Fensterbreite an BEIDEN Rändern über,
          // und keine Verschiebung der Welt brächte sie hinein.
          className={`absolute z-40 mt-1.5 min-w-[220px] max-w-[min(340px,calc(100vw-1rem))] rounded-[10px] border border-hairline bg-surface p-1 shadow-tile ${
            gerahmt ? "right-0" : "left-0"
          }`}
          // Der gemessene Ausgleich (s. oben). Ohne Verschiebung steht hier nichts — die Fläche
          // bleibt dann zeichengleich die, die das Zielbild bei 1280 px misst.
          style={versatz === 0 ? undefined : { transform: `translateX(${versatz}px)` }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

// Ein Eintrag der Liste — 36 px hoch, 13,5 px, links bündig (Auftrag §5.2).
export function MenueEintrag({
  children,
  onClick,
  gesperrt = false,
  gewaehlt = false,
  titel,
}: {
  children: ReactNode;
  onClick: () => void;
  gesperrt?: boolean;
  gewaehlt?: boolean;
  titel?: string;
}): JSX.Element {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={gesperrt}
      title={titel ?? undefined}
      onClick={onClick}
      className={`flex h-9 w-full items-center gap-2 rounded-[7px] px-3 text-left text-[13.5px] ${
        gesperrt
          ? "cursor-default text-muted-2 opacity-50"
          : gewaehlt
            ? "bg-hairline-soft font-semibold text-text"
            : "text-text hover:bg-hairline-soft"
      }`}
    >
      {children}
    </button>
  );
}

// Eine Trennlinie zwischen zwei Gruppen derselben Liste.
export function MenueTrenner(): JSX.Element {
  return <div aria-hidden="true" className="my-1 h-px bg-hairline" />;
}

// Eine MENÜFLÄCHE: kein Eintrag, sondern Inhalt (Status, Hilfe, Anhänge, Entwürfe). Sie ist der
// Ort aus dem Funktionsinventar §5a für alles, was heute als Karte auf der Fläche stand.
export function MenueFlaeche({ children }: { children: ReactNode }): JSX.Element {
  // JOB 3266 R2: `max-w-full` — 320 px bleiben das Maß, aber auf einem 320-px-Telefon gilt das
  // Fenster. Ohne diese Grenze wäre die Fläche breiter als ihr eigener Deckel (`Menue`, oben) und
  // die Titel liefen rechts unter dem Rand hinaus, statt zu kürzen.
  return (
    <div className="max-h-[420px] w-[320px] max-w-full overflow-auto px-2 py-1.5">{children}</div>
  );
}
