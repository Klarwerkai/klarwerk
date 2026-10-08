// ================================================================================================
// FE-003 · DER TUTORIAL-BEREICH — Lernziel, Kapitel, Fortschritt, Erklärung, Vorführung, Demo.
// ================================================================================================
//
// DER NUTZER BESTIMMT DAS TEMPO. Beim Betreten eines Schritts spielt dessen Vorführung EINMAL ab —
// Teil für Teil, mit Verweildauer — und hält am Ende an. Weiter geht es nur auf „Weiter“ oder über
// die Kapitelwahl; durch den ganzen Unterricht läuft nichts von selbst. „Pause“ friert die
// Vorführung (auch die Tippanimation) ein, „Schritt wiederholen“ setzt sie neu auf, jeder Teil ist
// einzeln anwählbar. Übungsschritte (`interaktiv`) spielen gar nicht von selbst.
//
// ALLES IST TEXT. Erklärung, Vertiefung und jeder Teil der Vorführung stehen als lesbarer Text da —
// ohne Animation, ohne Vorlesen, ohne Maus. Vorlesen ist ein Knopf (Browser-Sprachausgabe, kein
// externer Dienst) und stoppt auf Klick, beim Schrittwechsel und beim Schliessen.
//
// DIE ZIELE SIND NAMEN, KEINE KOORDINATEN. Hervorgehoben wird das Element mit
// `data-tutorial-ziel="<ziel>"` INNERHALB der Demo — die echten Bausteine tragen diese Namen selbst.
// Fehlt das Ziel, steht das sichtbar da (`data-tutorial-ziel-fehlt`), statt dass ein Rahmen ins
// Leere zeigt. Die Hervorhebung ist zusätzlich als Text benannt („Gerade gezeigt: …“), sie hängt
// also nicht an Farbe allein.
//
// DIE DEMO-GRENZE: Verweise innerhalb der Demo werden abgefangen und erklärt, nicht verfolgt. Die
// Demo selbst ruft keinen Endpunkt auf (siehe `fragen/FragenDemo.tsx`).
import { ArrowLeft, ArrowRight, Pause, Play, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import {
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { ZIEL_ATTRIBUT } from "../components/fragen/ziele";
import { cleanForSpeech, pickVoice, vorlesenMoeglich } from "../lib/vorlesen";
import { useMediaQuery } from "../shell/useMediaQuery";
import { TutorialMeldungCtx } from "./fernsteuerung";
import type { TutorialDefinition, TutorialModul } from "./typen";

/** Takt der Vorführuhr (ms). */
const TAKT_MS = 100;

const REDUZIERT_QUERY = "(prefers-reduced-motion: reduce)";

const KNOPF =
  "inline-flex items-center gap-1.5 rounded-btn border border-hairline bg-surface px-2.5 py-1.5 text-[12.5px] font-semibold text-text hover:border-ink/30 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const KNOPF_HAUPT =
  "inline-flex items-center gap-1.5 rounded-btn bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

function sprachTag(sprache: string): { lang: string; praefix: string } {
  if (sprache.startsWith("en")) {
    return { lang: "en-US", praefix: "en" };
  }
  if (sprache.startsWith("nl")) {
    return { lang: "nl-NL", praefix: "nl" };
  }
  return { lang: "de-DE", praefix: "de" };
}

export function TutorialBereich({
  definition,
  id,
  onSchliessen,
}: {
  definition: TutorialDefinition;
  id: string;
  onSchliessen: (mitFokus: boolean) => void;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const titelId = useId();
  const titelRef = useRef<HTMLHeadingElement | null>(null);
  const demoRef = useRef<HTMLElement | null>(null);
  const reduziert = useMediaQuery(REDUZIERT_QUERY);
  const werte = definition.textWerte((schluessel) => t(schluessel));
  const text = (schluessel: string): string => t(schluessel, werte);

  const [modul, setModul] = useState<TutorialModul | null>(null);
  const [ladefehler, setLadefehler] = useState(false);
  const [ladeversuch, setLadeversuch] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `ladeversuch` ist der Auslöser.
  useEffect(() => {
    let aktiv = true;
    setLadefehler(false);
    definition.laden().then(
      (m) => {
        if (aktiv) {
          setModul(m);
        }
      },
      () => {
        if (aktiv) {
          setLadefehler(true);
        }
      },
    );
    return () => {
      aktiv = false;
    };
  }, [definition, ladeversuch]);

  const schritte = definition.schritte;
  const [schrittIndex, setSchrittIndex] = useState(0);
  const [teilIndex, setTeilIndex] = useState(0);
  const [teilZeit, setTeilZeit] = useState(0);
  const [spielt, setSpielt] = useState(() => !schritte[0]?.interaktiv);
  const [lauf, setLauf] = useState(0);
  const [zielFehlt, setZielFehlt] = useState<string | null>(null);
  const [demoVerweis, setDemoVerweis] = useState<string | null>(null);
  const [zielGefunden, setZielGefunden] = useState(true);
  const schritt = schritte[schrittIndex] ?? schritte[0];
  if (!schritt) {
    throw new Error(`Tutorial ${definition.id} hat keine Schritte.`);
  }
  const teile = schritt.teile;
  const teil = teile[teilIndex] ?? null;
  const letzterSchritt = schrittIndex === schritte.length - 1;
  const amEnde = teilIndex >= teile.length - 1 && teilZeit >= (teil?.dauerMs ?? 0);

  // ---------------------------------------------------------------------------------------------
  // Die Vorführuhr. Sie läuft nur, solange „spielt“ gilt; die Pause hält sie an.
  // ---------------------------------------------------------------------------------------------
  useEffect(() => {
    if (!spielt) {
      return;
    }
    const uhr = window.setInterval(() => setTeilZeit((z) => z + TAKT_MS), TAKT_MS);
    return () => window.clearInterval(uhr);
  }, [spielt]);
  useEffect(() => {
    if (!spielt || !teil || teilZeit < teil.dauerMs) {
      return;
    }
    if (teilIndex < teile.length - 1) {
      setTeilIndex(teilIndex + 1);
      setTeilZeit(0);
    } else {
      // Am Ende des Schritts: anhalten. Kein Weiterlaufen in den nächsten Schritt.
      setSpielt(false);
    }
  }, [spielt, teil, teilZeit, teilIndex, teile.length]);

  // ---------------------------------------------------------------------------------------------
  // Vorlesen — nur auf Klick, stoppbar, stoppt beim Schrittwechsel und beim Schliessen.
  // ---------------------------------------------------------------------------------------------
  const vorlesbar = vorlesenMoeglich();
  const [liest, setLiest] = useState(false);
  const vorlesenStoppen = useCallback(() => {
    if (vorlesenMoeglich()) {
      window.speechSynthesis.cancel();
    }
    setLiest(false);
  }, []);
  useEffect(() => () => vorlesenStoppen(), [vorlesenStoppen]);
  const vorlesenUmschalten = (): void => {
    if (!vorlesbar) {
      return;
    }
    if (liest) {
      vorlesenStoppen();
      return;
    }
    const satz = [
      t(schritt.titelKey, werte),
      text(schritt.textKey),
      ...teile.map((x) => text(x.textKey)),
    ].join(". ");
    const { lang, praefix } = sprachTag(i18n.language);
    const u = new window.SpeechSynthesisUtterance(cleanForSpeech(satz));
    u.lang = lang;
    const stimme = pickVoice(praefix);
    if (stimme) {
      u.voice = stimme;
    }
    u.onend = () => setLiest(false);
    u.onerror = () => setLiest(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setLiest(true);
  };

  // ---------------------------------------------------------------------------------------------
  // Steuerung.
  // ---------------------------------------------------------------------------------------------
  const zuSchritt = (index: number): void => {
    const ziel = schritte[index];
    if (!ziel) {
      return;
    }
    vorlesenStoppen();
    setSchrittIndex(index);
    setTeilIndex(0);
    setTeilZeit(0);
    setLauf((l) => l + 1);
    setSpielt(!ziel.interaktiv);
    setDemoVerweis(null);
    setZielGefunden(true);
  };
  const wiederholen = (): void => {
    setTeilIndex(0);
    setTeilZeit(0);
    setLauf((l) => l + 1);
    setSpielt(!schritt.interaktiv);
    setDemoVerweis(null);
  };
  const abspielenOderPause = (): void => {
    if (spielt) {
      setSpielt(false);
      return;
    }
    if (amEnde) {
      setTeilIndex(0);
      setTeilZeit(0);
    }
    setSpielt(true);
  };
  const [teilWahl, setTeilWahl] = useState(0);
  const teilWaehlen = (index: number): void => {
    // Wer einen Teil selbst wählt, übernimmt das Tempo: die Vorführung hält dort an.
    setTeilIndex(index);
    setTeilZeit(0);
    setSpielt(false);
    setTeilWahl((n) => n + 1);
  };
  // Die Demo darf melden, wie weit der Nutzer ist (Übung, eigenes Absenden in der Demo).
  const zuTeil = useCallback((index: number) => {
    setTeilIndex(index);
    setTeilZeit(0);
  }, []);
  // … und anhalten, wenn der Nutzer die Vorführung selbst unterbricht (z. B. ein Blatt schliesst).
  const anhalten = useCallback(() => setSpielt(false), []);

  // Beim Öffnen: Fokus auf die Überschrift — Tastatur und Vorlesehilfe beginnen hier. Bewusst OHNE
  // `preventScroll`: war die Seite nach unten gescrollt, holt der Fokus den Bereich ins Bild.
  useEffect(() => {
    titelRef.current?.focus();
  }, []);

  const schliessen = (mitFokus: boolean): void => {
    vorlesenStoppen();
    onSchliessen(mitFokus);
  };
  const beiTaste = (e: KeyboardEvent<HTMLElement>): void => {
    // Escape gehört zuerst dem, was IN der Demo offen ist: das Menü „…“ und das Blatt „Mehr“
    // schliessen sich selbst. Das Blatt hängt als Portal ausserhalb dieses Bereichs (sein Ereignis
    // kommt über den React-Baum trotzdem hier an) — dann ist nicht das Tutorial gemeint.
    const ziel = e.target as Node;
    if (
      !e.currentTarget.contains(ziel) ||
      (ziel instanceof Element && ziel.closest('[role="menu"], [aria-haspopup="menu"]'))
    ) {
      return;
    }
    if (e.key === "Escape" && !e.defaultPrevented) {
      e.preventDefault();
      schliessen(true);
    }
  };

  // Der Übergang zur echten Seite: Fokus auf das ECHTE Ziel (ausserhalb der Demo), dann schliessen.
  // Es wird nichts eingefüllt und nichts ausgelöst.
  const zurEchtenSeite = (): void => {
    const kandidaten = Array.from(
      document.querySelectorAll<HTMLElement>(`[${ZIEL_ATTRIBUT}="${definition.uebergabeZiel}"]`),
    ).filter((el) => !el.closest("[data-tutorial-demo]"));
    const ziel = kandidaten[0];
    if (!ziel) {
      setZielGefunden(false);
      return;
    }
    ziel.focus({ preventScroll: true });
    schliessen(false);
    window.setTimeout(() => {
      if (typeof ziel.scrollIntoView === "function") {
        ziel.scrollIntoView({ block: "center", behavior: reduziert ? "auto" : "smooth" });
      }
    }, 0);
  };

  // ---------------------------------------------------------------------------------------------
  // Hervorhebung des erklärten Elements — über seinen Zielnamen, nie über Koordinaten.
  // ---------------------------------------------------------------------------------------------
  const zielName = teil?.ziel ?? null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: Schritt/Lauf/Modul erneuern die Demo.
  useLayoutEffect(() => {
    if (!demoRef.current) {
      setZielFehlt(null);
      return;
    }
    // Die Demo hat mehr als eine Wurzel: die Miniatur hier UND ein geöffnetes Blatt „Mehr“, das
    // wie auf der echten Seite als Portal am Rand der Anwendung hängt. Beide tragen
    // `data-tutorial-demo`; gesucht wird ausschliesslich darin — nie auf der echten Seite.
    const wurzeln = (): Element[] =>
      Array.from(document.querySelectorAll(`[data-tutorial-demo="${definition.id}"]`));
    const anwenden = (): void => {
      const alle = wurzeln();
      for (const w of alle) {
        for (const el of Array.from(w.querySelectorAll("[data-tutorial-aktiv]"))) {
          el.removeAttribute("data-tutorial-aktiv");
        }
      }
      if (!zielName) {
        setZielFehlt(null);
        return;
      }
      const treffer = alle.flatMap((w) =>
        Array.from(w.querySelectorAll(`[${ZIEL_ATTRIBUT}="${zielName}"]`)),
      );
      for (const el of treffer) {
        el.setAttribute("data-tutorial-aktiv", "true");
      }
      setZielFehlt(treffer.length === 0 ? zielName : null);
    };
    anwenden();
    // Die Demo baut sich innerhalb eines Teils um (Übung, Blatt „Mehr“): dann neu zuordnen.
    const beobachter = new MutationObserver(anwenden);
    beobachter.observe(document.body, { childList: true, subtree: true });
    return () => beobachter.disconnect();
  }, [zielName, modul, schrittIndex, lauf, definition.id]);

  // ---------------------------------------------------------------------------------------------
  // KLARA-VORSCHAU: die Lage an den Rahmen melden (`fernsteuerung.ts`). Die Befehle sind dieselben
  // Handlungen wie die Knöpfe unten; die Referenz sorgt dafür, dass Klara stets die aktuelle
  // Fassung ruft. Ohne Klara (kein Meldeweg) passiert hier nichts.
  // ---------------------------------------------------------------------------------------------
  const melden = useContext(TutorialMeldungCtx);
  const befehle = useRef({
    pause: () => {},
    fortsetzen: () => {},
    zurueck: () => {},
    weiter: () => {},
  });
  befehle.current = {
    pause: () => setSpielt(false),
    fortsetzen: () => {
      if (!spielt) {
        abspielenOderPause();
      }
    },
    zurueck: () => zuSchritt(schrittIndex - 1),
    weiter: () => zuSchritt(schrittIndex + 1),
  };
  const fernbefehle = useMemo(
    () => ({
      pause: () => befehle.current.pause(),
      fortsetzen: () => befehle.current.fortsetzen(),
      zurueck: () => befehle.current.zurueck(),
      weiter: () => befehle.current.weiter(),
    }),
    [],
  );
  const fernSchrittTitel = t(schritt.titelKey, werte);
  const fernSchrittText = text(schritt.textKey);
  const fernTeilText = teil ? text(teil.textKey) : null;
  useEffect(() => {
    melden?.({
      definitionId: definition.id,
      schrittIndex,
      schrittAnzahl: schritte.length,
      schrittId: schritt.id,
      schrittTitel: fernSchrittTitel,
      schrittText: fernSchrittText,
      teilText: fernTeilText,
      zielName,
      zielFehlt,
      spielt,
      interaktiv: Boolean(schritt.interaktiv),
      ...fernbefehle,
    });
  }, [
    melden,
    definition.id,
    schrittIndex,
    schritte.length,
    schritt.id,
    schritt.interaktiv,
    fernSchrittTitel,
    fernSchrittText,
    fernTeilText,
    zielName,
    zielFehlt,
    spielt,
    fernbefehle,
  ]);
  useEffect(() => () => melden?.(null), [melden]);

  const verweisAbfangen = (e: MouseEvent<HTMLElement>): void => {
    // Über den React-Baum kommen hier auch Klicks aus dem Blatt „Mehr“ der Demo an (Portal).
    const anker = (e.target as Element | null)?.closest?.("a");
    if (anker) {
      e.preventDefault();
      e.stopPropagation();
      setDemoVerweis(anker.getAttribute("href") ?? "");
    }
  };

  // ---------------------------------------------------------------------------------------------
  // Die Begleitung (Runde 3, Bens Befund): läuft die Vorführung in das modale Blatt „Mehr“ hinein,
  // sperrt dessen Modalgrenze diesen Bereich — Pause-Knopf und Erklärung wären unerreichbar,
  // während die Vorführung weiterläuft. Die Grenze gehört der echten Seite und bleibt, wie sie
  // ist; stattdessen reicht der Rahmen der Demo dieselbe Steuerung, und die Demo stellt sie IN das
  // Blatt. Es ist derselbe Zustand und dieselbe Handlung wie oben (`spielt`, `abspielenOderPause`,
  // `teilWaehlen`) — keine zweite Uhr.
  // ---------------------------------------------------------------------------------------------
  const begleitung = (
    <section
      data-testid="tutorial-begleitung"
      aria-label={t("tutorial.begleitung.label", { titel: t(definition.titelKey) })}
      className="mb-3 rounded-card border-2 border-brand/60 bg-surface p-2.5"
    >
      <p className="text-[12.5px] font-semibold text-ink">
        {t("tutorial.begleitung.label", { titel: t(definition.titelKey) })} · {t(schritt.titelKey)}
      </p>
      <p
        data-testid="tutorial-gerade-blatt"
        aria-live="polite"
        className="mt-1 text-[12.5px] leading-relaxed text-text"
      >
        <span className="font-semibold">
          {spielt ? t("tutorial.vorfuehrung.laeuft") : t("tutorial.vorfuehrung.steht")}
        </span>{" "}
        {teil ? text(teil.textKey) : null}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="tutorial-abspielen-blatt"
          aria-pressed={spielt}
          onClick={abspielenOderPause}
          className={KNOPF}
        >
          {spielt ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
          {spielt ? t("tutorial.pause") : t("tutorial.abspielen")}
        </button>
      </div>
      <ol className="mt-2 space-y-1">
        {teile.map((x, i) => (
          <li key={x.id}>
            <button
              type="button"
              data-testid="tutorial-teil-blatt"
              data-teil={x.id}
              aria-current={i === teilIndex ? "step" : undefined}
              onClick={() => teilWaehlen(i)}
              className="w-full rounded-btn border border-transparent px-2 py-1 text-left text-[12px] leading-relaxed text-muted hover:border-hairline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand aria-[current=step]:border-brand/50 aria-[current=step]:bg-ink/5 aria-[current=step]:text-text"
            >
              <span className="font-semibold">{i + 1}. </span>
              {text(x.textKey)}
            </button>
          </li>
        ))}
      </ol>
      <details data-testid="tutorial-begleitung-erklaerung" className="mt-2">
        <summary className="cursor-pointer text-[12px] font-semibold text-brand-text">
          {t("tutorial.begleitung.erklaerung")}
        </summary>
        <p className="mt-1 whitespace-pre-line text-[12.5px] leading-relaxed text-text">
          {text(schritt.textKey)}
        </p>
      </details>
      <p className="mt-2 text-[11.5px] text-muted-2">{t("tutorial.begleitung.zurueck")}</p>
    </section>
  );

  const Demo = modul?.Demo;
  const Uebergang = modul?.Uebergang;
  const nr = schrittIndex + 1;

  return (
    <section
      id={id}
      data-testid="tutorial-bereich"
      data-tutorial={definition.id}
      aria-labelledby={titelId}
      onKeyDown={beiTaste}
      className="print-hide mb-6 rounded-card border-2 border-brand/60 bg-surface p-4 shadow-tile sm:p-5"
    >
      {/* Kopf: Titel, Lernziel, Vorlesen, Schliessen. Die Textspalte hat eine Grundbreite: reicht
          der Platz daneben nicht, rücken die Knöpfe darunter, statt den Text zusammenzudrücken. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div data-testid="tutorial-kopftext" className="min-w-0 flex-[1_1_16rem]">
          <h2
            id={titelId}
            ref={titelRef}
            tabIndex={-1}
            className="text-[17px] font-semibold text-ink outline-none focus-visible:underline"
          >
            {t(definition.titelKey)}
          </h2>
          <p
            data-testid="tutorial-lernziel"
            className="mt-1 text-[13px] leading-relaxed text-muted"
          >
            <span className="font-semibold text-text">{t("tutorial.lernziel")}: </span>
            {text(definition.lernzielKey)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {vorlesbar ? (
            <button
              type="button"
              data-testid="tutorial-vorlesen"
              aria-pressed={liest}
              onClick={vorlesenUmschalten}
              className={KNOPF}
            >
              {liest ? (
                <VolumeX size={14} aria-hidden="true" />
              ) : (
                <Volume2 size={14} aria-hidden="true" />
              )}
              {liest ? t("tutorial.vorlesen.stop") : t("tutorial.vorlesen.start")}
            </button>
          ) : null}
          <button
            type="button"
            data-testid="tutorial-schliessen"
            onClick={() => schliessen(true)}
            className={KNOPF}
          >
            <X size={14} aria-hidden="true" />
            {t("tutorial.schliessen")}
          </button>
        </div>
      </div>
      <p className="mt-1 text-[11.5px] text-muted-2">
        {vorlesbar ? t("tutorial.vorlesen.hinweis") : t("tutorial.vorlesen.nichtMoeglich")}
      </p>

      {/* Fortschritt und Kapitelwahl. */}
      <div className="mt-3">
        <p
          data-testid="tutorial-fortschritt"
          aria-live="polite"
          className="text-[12px] font-semibold text-muted-2"
        >
          {t("tutorial.fortschritt", { nr, gesamt: schritte.length, titel: t(schritt.kurzKey) })}
        </p>
        <progress
          data-testid="tutorial-fortschrittsbalken"
          aria-label={t("tutorial.fortschritt.label")}
          value={nr}
          max={schritte.length}
          className="tutorial-fortschritt mt-1 block h-1.5 w-full appearance-none overflow-hidden rounded-pill bg-hairline"
        />
      </div>
      <nav aria-label={t("tutorial.kapitel")} className="mt-3">
        <ol className="flex flex-wrap gap-1.5">
          {schritte.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                data-testid="tutorial-kapitel"
                data-schritt={s.id}
                aria-current={i === schrittIndex ? "step" : undefined}
                onClick={() => zuSchritt(i)}
                className="rounded-pill border border-hairline bg-page px-2.5 py-1 text-[12px] text-muted hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand aria-[current=step]:border-brand aria-[current=step]:bg-ink/5 aria-[current=step]:font-semibold aria-[current=step]:text-ink"
              >
                {i + 1}. {t(s.kurzKey)}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* Links: die Erklärung — vollständig als Text. */}
        <div data-testid="tutorial-erklaerung" data-schritt={schritt.id} className="min-w-0">
          <h3 className="text-[15px] font-semibold text-ink">{t(schritt.titelKey)}</h3>
          <p className="mt-1.5 whitespace-pre-line text-[13.5px] leading-relaxed text-text">
            {text(schritt.textKey)}
          </p>
          <details data-testid="tutorial-vertiefung" className="mt-2">
            <summary className="cursor-pointer text-[12.5px] font-semibold text-brand-text">
              {t("tutorial.vertiefung")}
            </summary>
            <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-muted">
              {text(schritt.vertiefungKey)}
            </p>
          </details>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="tutorial-zurueck"
              disabled={schrittIndex === 0}
              onClick={() => zuSchritt(schrittIndex - 1)}
              className={KNOPF}
            >
              <ArrowLeft size={14} aria-hidden="true" />
              {t("tutorial.zurueck")}
            </button>
            {letzterSchritt ? (
              <button
                type="button"
                data-testid="tutorial-beenden"
                onClick={() => schliessen(true)}
                className={KNOPF_HAUPT}
              >
                {t("tutorial.beenden")}
              </button>
            ) : (
              <button
                type="button"
                data-testid="tutorial-weiter"
                onClick={() => zuSchritt(schrittIndex + 1)}
                className={KNOPF_HAUPT}
              >
                {t("tutorial.weiter")}
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              data-testid="tutorial-abspielen"
              aria-pressed={spielt}
              onClick={abspielenOderPause}
              className={KNOPF}
            >
              {spielt ? (
                <Pause size={14} aria-hidden="true" />
              ) : (
                <Play size={14} aria-hidden="true" />
              )}
              {spielt ? t("tutorial.pause") : t("tutorial.abspielen")}
            </button>
            <button
              type="button"
              data-testid="tutorial-wiederholen"
              onClick={wiederholen}
              className={KNOPF}
            >
              <RotateCcw size={14} aria-hidden="true" />
              {t("tutorial.wiederholen")}
            </button>
          </div>

          {/* Die Vorführung als Liste: jeder Teil lesbar und einzeln anwählbar. */}
          <div className="mt-4">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-2">
              {t("tutorial.vorfuehrung")}
            </p>
            <ol className="mt-1.5 space-y-1">
              {teile.map((x, i) => (
                <li key={x.id}>
                  <button
                    type="button"
                    data-testid="tutorial-teil"
                    data-teil={x.id}
                    aria-current={i === teilIndex ? "step" : undefined}
                    onClick={() => teilWaehlen(i)}
                    className="w-full rounded-btn border border-transparent px-2 py-1 text-left text-[12.5px] leading-relaxed text-muted hover:border-hairline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand aria-[current=step]:border-brand/50 aria-[current=step]:bg-ink/5 aria-[current=step]:text-text"
                  >
                    <span className="font-semibold">{i + 1}. </span>
                    {text(x.textKey)}
                  </button>
                </li>
              ))}
            </ol>
            {reduziert ? (
              <p data-testid="tutorial-reduziert" className="mt-2 text-[11.5px] text-muted-2">
                {t("tutorial.reduziert")}
              </p>
            ) : null}
          </div>
        </div>

        {/* Rechts: die Demo — jederzeit als Demo erkennbar. */}
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="rounded-pill bg-ai-surface-1 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-ai">
              {t("tutorial.demo.kennzeichen")}
            </span>
            <span className="text-[11.5px] text-muted-2">{t("tutorial.demo.hinweis")}</span>
          </div>
          <p
            data-testid="tutorial-gerade"
            aria-live="polite"
            className="mb-2 text-[12.5px] leading-relaxed text-text"
          >
            <span className="font-semibold">
              {spielt ? t("tutorial.vorfuehrung.laeuft") : t("tutorial.vorfuehrung.steht")}
            </span>{" "}
            {teil ? text(teil.textKey) : null}
          </p>
          {zielFehlt ? (
            <output
              data-tutorial-ziel-fehlt={zielFehlt}
              className="mb-2 block rounded-btn bg-trust-crit-bg px-2.5 py-1.5 text-[12px] text-trust-crit-text"
            >
              {t("tutorial.ziel.fehlt", { ziel: zielFehlt })}
            </output>
          ) : null}
          <section
            ref={demoRef}
            data-tutorial-demo={definition.id}
            data-testid="tutorial-demo"
            aria-label={t("tutorial.demo.label")}
            onClickCapture={verweisAbfangen}
            className="tutorial-demo rounded-card border-2 border-dashed border-ai-dashed bg-page p-3 md:[zoom:0.9]"
          >
            {Demo ? (
              <Demo
                schrittId={schritt.id}
                teilIndex={teilIndex}
                teilZeit={teilZeit}
                lauf={lauf}
                reduziert={reduziert}
                zuTeil={zuTeil}
                anhalten={anhalten}
                teilWahl={teilWahl}
                begleitung={begleitung}
              />
            ) : ladefehler ? (
              <p className="text-[12.5px] text-trust-crit-text">
                <output>{t("tutorial.laden.fehler")}</output>{" "}
                <button
                  type="button"
                  onClick={() => setLadeversuch((v) => v + 1)}
                  className="font-semibold underline"
                >
                  {t("tutorial.laden.nochmal")}
                </button>
              </p>
            ) : (
              <p className="text-[12.5px] text-muted-2">{t("tutorial.laden")}</p>
            )}
          </section>
          {demoVerweis !== null ? (
            <output className="mt-2 block text-[12px] text-muted">
              {t("tutorial.demo.verweis", { ziel: demoVerweis })}
            </output>
          ) : null}
        </div>
      </div>

      {letzterSchritt && Uebergang ? (
        <div className="mt-4">
          <Uebergang zurEchtenSeite={zurEchtenSeite} zielGefunden={zielGefunden} />
        </div>
      ) : null}
    </section>
  );
}
