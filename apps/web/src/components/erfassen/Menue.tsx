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
  // JOB 3282 (EDITOR-R26): Das Werkzeug selbst — Escape gibt ihm den Fokus zurück (s. unten).
  const werkzeug = useRef<HTMLButtonElement | null>(null);
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
  // ==============================================================================================
  // JOB 3769 — UND DASSELBE SENKRECHT: DIE FLÄCHE WURDE UNTEN ABGESCHNITTEN.
  // ==============================================================================================
  //
  // DIE MESSUNG (echtes Chromium, gebaute Anwendung, 390×844, Fall B6 in
  // `tests/ki-freie-anweisung/ki-palette-390px-chromium.test.ts`): die KI-Palette öffnet bei y=130
  // und ist 426 px hoch, endet also bei y=556. Die Fläche, in der die Seite rollt, ist aber nur
  // y=56–519 hoch (`shell/AppShell.tsx:102`, `main.flex-1 overflow-y-auto`) — darunter liegt der
  // KI-Hinweis als GESCHWISTER und nimmt bei 390 px 325 px echten Layout-Platz (`AppShell.tsx:105-109`,
  // dort ausdrücklich so gewollt). Vom 36 px hohen freien Eingabefeld (y=509–545) waren damit 10 px zu
  // sehen und 26 px weggeschnitten; beim Ausführen-Knopf dasselbe. Das Rechteck lag im FENSTER
  // (545 < 844) — und trotzdem sah der Mensch das Feld nicht. Nur die Rollfläche sagt die Wahrheit.
  //
  // WARUM DER GEMESSENE AUSGLEICH UND NICHT EIN FESTER ANKER. Es ist Zeile für Zeile die Mechanik,
  // die oben schon waagerecht steht: gemessen wird das, worauf es ankommt — liegt die Fläche in dem
  // Kasten, in dem sie zu sehen ist? —, und nur die Differenz wird ausgeglichen. Ein festes
  // „nach oben öffnen" (`bottom-full`) wäre derselbe Fehler auf dem Kopf: über dem Werkzeug liegen
  // hier nur 44 px (Werkzeug y=100–120, Kasten ab y=56), die Fläche stünde dann ganz draussen.
  // Eine feste Höhenbegrenzung mit eigenem Rollen bringt die Zusage AUS §1 NICHT: das Eingabefeld
  // ist das LETZTE Stück der Fläche, ein Deckel schneidet also genau es ab — statt vom Fensterrand
  // eben von der eigenen Rollkante. Gemessen wäre das dieselbe Zahl.
  //
  // NUR NACH OBEN, UND NUR SO WEIT WIE PLATZ IST. Der Schub ist auf den Weg begrenzt, den die
  // Oberkante bis zum oberen Rand des Kastens hat (`moeglich`) — eine Fläche, die höher ist als der
  // Kasten, bleibt deshalb oben bündig und springt nicht zwischen zwei Rändern. Nach unten wird NIE
  // verschoben: die Fläche öffnet unter ihrem Werkzeug, sie kann oben gar nicht hinausragen, und ein
  // zweiter Ausgleich in der Gegenrichtung wäre genau das Schwingen, das der Kommentar oben beschreibt.
  //
  // WAS ES KOSTET, ausdrücklich benannt: um 45 px verschoben deckt die Palette bei 390 px ihr eigenes
  // Werkzeug zu (Palette dann y=85–511, Werkzeug y=100–120). Sie zu schliessen geht weiter über
  // Escape und über einen Klick ausserhalb (beides unten in EINER Mechanik) — nur der Klick auf das
  // Werkzeug selbst liegt hinter der Fläche. Die Alternative wäre eine Fläche, deren untere 26 px
  // niemand sieht, und das war der gemeldete Mangel.
  //
  // ES GILT FÜR JEDES MENÜ DIESER ZEILE und ändert doch nur die, die WIRKLICH abgeschnitten sind:
  // liegt die Fläche im Kasten, bleibt der Versatz 0 und es steht kein `style` da — die Fläche ist
  // dann zeichengleich die von vorher (gemessen: `tests/design` bleibt unverändert grün).
  const [versatz, setVersatz] = useState(0);
  const [versatzHoch, setVersatzHoch] = useState(0);
  const versuche = useRef(0);
  useLayoutEffect(() => {
    if (!istOffen) {
      versuche.current = 0;
      if (versatz !== 0) {
        setVersatz(0);
      }
      if (versatzHoch !== 0) {
        setVersatzHoch(0);
      }
      return;
    }
    // Der KASTEN, in dem die Fläche wirklich zu sehen ist: die nächste Fläche darüber, die senkrecht
    // wegschneidet (hier `main`), auf das Fenster beschnitten. Gibt es keine, ist es das Fenster
    // selbst. Ohne diesen Blick misst die Prüfung gegen 844 px und übersieht die 519 px, die gelten.
    const kasten = (el: HTMLElement): { oben: number; unten: number } => {
      const fensterhoehe = document.documentElement.clientHeight;
      for (let p = el.parentElement; p; p = p.parentElement) {
        if (getComputedStyle(p).overflowY !== "visible") {
          const pr = p.getBoundingClientRect();
          return { oben: Math.max(pr.top, 0), unten: Math.min(pr.bottom, fensterhoehe) };
        }
      }
      return { oben: 0, unten: fensterhoehe };
    };
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
      let neuHoch = versatzHoch;
      const k = kasten(el);
      if (r.bottom > k.unten - rand) {
        const schub = r.bottom - (k.unten - rand);
        // DER RAND GIBT SENKRECHT NACH, BEVOR INHALT VERSCHWINDET — und nur hier, nicht waagerecht.
        // Waagerecht ist der Kasten das Fenster und weit genug; senkrecht ist er bei 390×844 gemessen
        // 463 px hoch (y=56–519), und die Palette wird im höchsten Zustand (eigene Vorlagen UND der
        // Satz zum gescheiterten Abruf) 470 px hoch — nötig wären dort 89 px Schub, mit 8 px Rand
        // möglich nur 66. GEMESSEN mit diesem Rand: 4 px des Eingabefeldes blieben abgeschnitten
        // („px":4), dann wäre der RAND der Grund, warum ein Mensch sein Feld nicht sieht. Also
        // höchstens bis an die Oberkante des Kastens (74 px; Feld dann y=479–515 im Kasten bis 519).
        // Im gewöhnlichen Fall ändert das nichts: dort sind 45 px nötig und 66 px bequem möglich.
        const moeglich = Math.max(0, r.top - k.oben);
        neuHoch = versatzHoch - Math.min(schub, moeglich);
      }
      if (Math.abs(neu - versatz) > 0.5 || Math.abs(neuHoch - versatzHoch) > 0.5) {
        versuche.current += 1;
        setVersatz(neu);
        setVersatzHoch(neuHoch);
      }
    };
    einpassen();
    // Ein neues Fenster ist eine neue Lage — dafür stehen die Anläufe wieder offen.
    const beiGroesse = (): void => {
      versuche.current = 0;
      einpassen();
    };
    window.addEventListener("resize", beiGroesse);
    // ============================================================================================
    // JOB 3769 — EINE NEUE HÖHE DER FLÄCHE IST GENAUSO EINE NEUE LAGE.
    // ============================================================================================
    //
    // GEMESSEN, nicht überlegt: ohne diese Beobachtung blieb der senkrechte Ausgleich beim ERSTEN
    // Öffnen 0, obwohl die Palette 45 px zu tief stand (`translate(-206.281px, 0px)`); beim zweiten
    // Öffnen stimmte er (`translate(-206.281px, -45px)`, Palette dann y=85–511 im Kasten y=56–519).
    // Der Unterschied ist die Reihenfolge: dieser Ausgleich rechnet in dem Augenblick, in dem die
    // Fläche erscheint — und da ist sie noch nicht fertig. Die eigenen KI-Vorlagen kommen aus einem
    // Abruf und machen sie danach über 100 px höher, ohne dass sich ein Fenster ändert; der Hörer
    // oben feuert dann nicht, und die Rechnung blieb auf dem ersten, falschen Stand stehen.
    // Waagerecht fiel das nie auf: die Breite hängt hier nicht am Inhalt (`min-w`/`max-w` deckeln
    // sie), die Höhe hängt daran.
    //
    // BEOBACHTET WIRD NUR DIE FLÄCHE, NICHT AUCH IHR KASTEN — weil GEMESSEN ist, dass die Fläche
    // genügt: mit der Kastenbeobachtung daneben und ohne sie steht dieselbe Zahl (B6 grün, Palette
    // y=85–511). Der Kasten wird zwar ebenfalls niedriger, sobald der KI-Hinweis unter der
    // Inhaltsfläche seinen Platz nimmt (`shell/AppShell.tsx:105-109`, 325 px bei 390 px Breite) —
    // aber das geschieht VOR dem Abruf der Vorlagen, die Neuberechnung holt es also mit. Eine
    // zweite Beobachtung, die nachweislich nichts ändert, wäre eine Zeile, die etwas behauptet, was
    // sie nicht leistet. Was damit NICHT abgedeckt ist und in der Rückgabe als REST steht: ein
    // Kasten, der schrumpft, WÄHREND das Menü offen steht (etwa ein Hinweis, der dann erst
    // erscheint) — dann bleibt die Fläche stehen, wo sie steht.
    //
    // ES SCHWINGT NICHT: eine Verschiebung ändert die GRÖSSE der Fläche nicht, die Beobachtung
    // feuert also nicht wegen ihres eigenen Ergebnisses. Und wo es keinen `ResizeObserver` gibt
    // (jsdom), bleibt alles wie zuvor — dieselbe Grenze, die `pages/Wissensnetz.tsx:716` zieht.
    const el = flaeche.current;
    const beobachter =
      el && typeof ResizeObserver !== "undefined" ? new ResizeObserver(beiGroesse) : null;
    if (beobachter !== null && el !== null) {
      beobachter.observe(el);
    }
    return () => {
      window.removeEventListener("resize", beiGroesse);
      beobachter?.disconnect();
    };
  }, [istOffen, versatz, versatzHoch]);

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
    // ==========================================================================================
    // JOB 3282 (EDITOR-R26) — ESCAPE GIBT DEN FOKUS ZURÜCK, SONST ENDET DER TASTATURWEG IM NICHTS.
    // ==========================================================================================
    //
    // DER BELEGTE BEFUND (Codex, Nutzerprüfung review26-ki-editor, 08.09., Live 1.185, Schritt
    // „Bedienbarkeit bei 390 Pixeln und Tastatur"): „Enter öffnet das fokussierte KI-Menü, Pfeil ab
    // lässt Fokus auf KI, Tab erreicht Struktur vorschlagen. Escape schließt, stellt den Fokus aber
    // nicht zum KI-Knopf zurück."
    //
    // WAS DAS FÜR DIE TASTATUR HEISST: Der Fokus stand auf einem Eintrag INNERHALB der Fläche. Mit
    // dem Schliessen verschwindet dieser Knoten aus dem Dokument, und der Fokus fällt auf `body`
    // zurück. Der nächste Tabulator beginnt damit wieder ganz vorne auf der Seite — wer das Menü
    // nur ansehen und wieder verlassen wollte, verliert seine Stelle in der Werkzeugzeile. Der Weg
    // hinein (Enter auf dem Werkzeug) hat also keinen Weg zurück.
    //
    // DIE RÜCKGABE STEHT HIER UND NICHT AN DEN ACHT AUFRUFERN: Öffnen, Schliessen, Klick nach
    // aussen und Escape sind seit JOB 3062 EINE Mechanik in dieser Datei (s. Kopf). Jedes Menü der
    // Zeile — Datei, KI, Bereich, Vertraulichkeit, „?", „…" — erbt sie damit, und keines kann sie
    // vergessen.
    //
    // NUR BEI ESCAPE, NICHT BEIM KLICK NACH AUSSEN: Ein Klick sagt selbst, wohin der Fokus gehört
    // (dorthin, wo geklickt wurde). Ihn auf das Werkzeug zurückzureissen nähme dem Menschen die
    // Stelle, die er gerade angefasst hat.
    const beiTaste = (ereignis: KeyboardEvent): void => {
      if (ereignis.key === "Escape") {
        setOffen(null);
        werkzeug.current?.focus();
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
        ref={werkzeug}
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
          // Der gemessene Ausgleich, beide Achsen in EINER Verschiebung (s. oben). Ohne Verschiebung
          // steht hier nichts — die Fläche bleibt dann zeichengleich die, die das Zielbild bei
          // 1280 px misst.
          style={
            versatz === 0 && versatzHoch === 0
              ? undefined
              : { transform: `translate(${versatz}px, ${versatzHoch}px)` }
          }
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
