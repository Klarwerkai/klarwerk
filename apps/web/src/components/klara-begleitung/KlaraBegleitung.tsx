// ================================================================================================
// AKTIVE BEGLEITUNG (produkt:20261011:assistenz-aktive-beobachtung · BPA-05) — DIE OBERFLÄCHE.
// ================================================================================================
//
// Eine kompakte Statusleiste, die NICHT am Gespräch der Assistenz hängt: sie steht in der Hülle
// neben der Figur und bleibt sichtbar und bedienbar, wenn das Gespräch geschlossen ist (K3).
//
//   aus       → nur auf Seiten mit eingerichtetem Vorgang: ein Angebot mit EINEM Satzfeld
//               („Produktrecherche, 30 Minuten") und „Begleitung starten" (K1)
//   aktiv     → „Begleiten · Bereich · bis HH:MM", Zweck, Mikrofon/Video aus, Pause, Stopp
//   pausiert  → derselbe Platz mit Grund und „Fortsetzen" — Fortsetzen prüft Konto, Rechte, Ablauf
//   beendet   → ein Satz, dass der beobachtete Kontext verworfen ist
//
// Tastatur: Alt+Umschalt+P Pause/Fortsetzen, Alt+Umschalt+S Stopp — über `event.code`, damit die
// Wahltaste auf dem Mac (die aus „p" ein „π" macht) die Kürzel nicht verschluckt.
//
// Dauerhaft liegt nur die FREIGABE (Zweck, Bereich, Endpunkt) im Sitzungsspeicher dieses Tabs —
// damit ein Neuladen sie nicht verlängert, sondern pausiert wiederfindet (K7). Bewusst übernommene
// Notizen liegen getrennt daneben und überleben den Stopp; gelesene Feldwerte liegen nirgends (K8).
//
// RECHTE (K7, G04): Die Berechtigung ist NICHT „angemeldet". Sie ist die Rolle aus der vom Server
// bestätigten Sitzung, gemessen an den Rollen, die der Vorgang selbst zulässt (`darf`). Sie wird
// vor JEDEM Lesen geprüft (`darfLesen`); fällt sie weg, wird pausiert, ohne zu lesen. Fortsetzen
// nach einem Entzug verlangt eine Serverbestätigung, die jünger ist als der Entzug.
//
// HOSTZUSTAND (K2, K7): verborgenes Fenster → Pause „verborgen" ohne vorheriges Lesen; gesperrter
// Bildschirm → Pause „Sperrbildschirm" über die Idle Detection API, wenn der Browser sie hat und
// der Nutzer sie erlaubt (`hostzustand.ts`). Beides nur durch den Nutzer fortsetzbar.
//
// DER MELDER (Nacharbeit 3, Ben AC07/G10 und AC07-Wiederaufnahme): Er wird beim Start UND bei jedem
// Fortsetzen — auch nach Neuladen — aus der Geste heraus neu eingerichtet. Aktiviert wird erst,
// wenn sein tatsächlicher Zustand feststeht; danach werden Ablauf, Stopp, Konto und Rechte ein
// zweites Mal geprüft, weil sie sich während des asynchronen Starts geändert haben können. Die
// Leiste sagt die Sperrerkennung erst zu, wenn der Melder läuft; scheitert er, bleibt bzw. wird
// die Begleitung pausiert und der Fehler steht da. Während einer Pause läuft kein Melder.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSession } from "../../app/AuthContext";
import { useAssistenzT } from "../../lib/assistenzProfil";
import {
  KONTEXT_EREIGNIS,
  SYSTEM_EREIGNIS,
  eingerichteteBereiche,
  istSystemereignis,
  liesVorgang,
} from "./adapter";
import { type MelderErgebnis, sperrmelderVerfuegbar, starteSperrmelder } from "./hostzustand";
import {
  AUS,
  type Begleitung,
  type Bereich,
  type Freigabe,
  type KontextEreignis,
  type Notiz,
  auskunft,
  beschaeftigt,
  darf,
  darfLesen,
  fortsetzen,
  leseAuftrag,
  naechsterHinweis,
  nimmKontext,
  pausiere,
  pruefeAblauf,
  sicherung,
  starte,
  stoppe,
  systemereignis,
  verwirf,
  wiederherstellen,
} from "./kern";
import { GRUND_UNTEN, type Platz, platzNebenFigur } from "./platz";

const FREIGABE_SCHLUESSEL = "klarwerk.begleitung.freigabe";
const NOTIZ_PRAEFIX = "klarwerk.begleitung.notizen.";
/** Solange nach einer Eingabe gewartet wird, bevor gelesen und geprüft wird. */
const TIPPPAUSE_MS = 1500;
/** Takt für Ablauf und Seitenwechsel, auch ohne Eingabe. */
const TAKT_MS = 5000;
// Nacharbeit 5 (Ben, Bildbeleg AKTIV-HINWEIS.png): hier stand `bg-[var(--kw-surface,#fff)]`. Die
// Themevariable ist ein RGB-Kanaltripel („255 255 255", `styles/themes.css`), kein Farbwert — der
// Browser verwarf die Deklaration, die Leiste war DURCHSICHTIG, und das Formular darunter schien
// durch Zweck, Hinweis und Knöpfe. `--kw-line` gab es gar nicht. Jetzt tragen die Token-Klassen
// der App (`bg-surface`, `border-hairline`, `text-text` = `rgb(var(--kw-…))` in
// `tailwind.config.ts`) eine deckende Fläche in jedem Theme; gemessen im echten Chromium an der
// gebauten App (`tests/klara-begleitung/begleitleiste-deckend-chromium.test.ts`).
//
// Nacharbeit 9 (Ben G10, Bildbeleg bei 390 × 700): die Assistenzfigur lag über Hinweis und
// Tastaturzeile. Der Abstand nach unten und die Höchsthöhe kommen jetzt aus `platz.ts` — gemessen
// an der tatsächlichen Figur; reicht der Platz nicht, scrollt die Leiste statt überdeckt zu werden.
const RAHMEN =
  "fixed left-4 z-40 max-w-sm overflow-y-auto rounded-lg border border-hairline bg-surface p-3 text-sm text-text shadow-lg";
/** Die Hülle der Assistenzfigur samt Namensschild (`klara-vorschau/KlaraVorschau.tsx`). */
const FIGUR = '[data-testid="klara-figur-huelle"]';
/** Wie oft die Lage der verschiebbaren Figur nachgemessen wird, solange die Leiste steht. */
const PLATZ_TAKT_MS = 400;

/** Verborgener Tab: der Nutzer ist nirgends im Bereich — es wird nichts gelesen. */
function nirgends(konto: string): KontextEreignis {
  return { quelle: { art: "vorgang", kennung: "" }, konto, felder: [] };
}

function lies<T>(schluessel: string): T | null {
  try {
    const roh = window.sessionStorage.getItem(schluessel);
    return roh ? (JSON.parse(roh) as T) : null;
  } catch {
    return null;
  }
}

function schreib(schluessel: string, wert: unknown): void {
  try {
    if (wert === null) {
      window.sessionStorage.removeItem(schluessel);
    } else {
      window.sessionStorage.setItem(schluessel, JSON.stringify(wert));
    }
  } catch {
    // ohne Sitzungsspeicher gilt die Freigabe nur bis zum Neuladen — kürzer, nie länger
  }
}

function ladeNotizen(konto: string | null): Notiz[] {
  return konto ? (lies<Notiz[]>(`${NOTIZ_PRAEFIX}${konto}`) ?? []) : [];
}

/** Anzeige des Sperrbildschirmmelders: noch nicht entschieden, läuft, oder nur Fenstersignal. */
type MelderAnzeige = "startet" | "laeuft" | "nur_fenster";

/** Die Zusage „wird erkannt" steht NUR, wenn die Begleitung aktiv ist UND der Melder läuft. */
function sperreSchluessel(phase: Begleitung["phase"], melder: MelderAnzeige): string {
  if (melder === "startet") {
    return "begleitung.status.sperreStartet";
  }
  if (phase !== "aktiv") {
    return "begleitung.status.sperreRuht";
  }
  return melder === "laeuft"
    ? "begleitung.status.sperreBildschirm"
    : "begleitung.status.sperreFenster";
}

function neueId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  return typeof c?.randomUUID === "function"
    ? c.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export interface KlaraBegleitungProps {
  /** Das angemeldete Konto; `null` heißt abgemeldet. */
  readonly konto: string | null;
  /** Die Rolle aus der vom Server bestätigten Sitzung; `null` heißt keine Berechtigung. */
  readonly rolle: string | null;
  /** Zeitpunkt der letzten Serverbestätigung dieser Sitzung (`/auth/me`). */
  readonly rechteGeprueftAm?: number;
  /** Fordert eine frische Serverbestätigung an (nach einem Entzug). */
  readonly pruefeRechte?: () => void;
  readonly jetzt?: () => number;
}

/** Die Begleitung in der Hülle — Konto, Rolle und Bestätigungszeitpunkt aus der echten Sitzung. */
export function KlaraBegleitungImProdukt(): JSX.Element | null {
  const { user, sitzungGeprueftAm, refresh } = useSession();
  return (
    <KlaraBegleitung
      konto={user?.id ?? null}
      rolle={user?.role ?? null}
      rechteGeprueftAm={sitzungGeprueftAm ?? 0}
      pruefeRechte={refresh}
    />
  );
}

export function KlaraBegleitung({
  konto,
  rolle,
  rechteGeprueftAm = 0,
  pruefeRechte,
  jetzt = Date.now,
}: KlaraBegleitungProps): JSX.Element | null {
  const { t, i18n } = useAssistenzT();
  const [b, setB] = useState<Begleitung>(() => {
    const gesichert = lies<Freigabe>(FREIGABE_SCHLUESSEL);
    return gesichert && gesichert.konto === konto ? wiederherstellen(gesichert, jetzt()) : AUS;
  });
  // Notizen gehören einem Konto: wechselt es, wird die Liste des neuen Kontos geladen — die alte
  // wird nie unter dem neuen Konto geschrieben.
  const [notizStand, setNotizStand] = useState(() => ({ konto, liste: ladeNotizen(konto) }));
  if (notizStand.konto !== konto) {
    setNotizStand({ konto, liste: ladeNotizen(konto) });
  }
  const notizen = notizStand.konto === konto ? notizStand.liste : [];
  const setNotizen = (aendern: (alt: Notiz[]) => Notiz[]): void =>
    setNotizStand((s) => ({ konto: s.konto, liste: aendern(s.liste) }));
  const [bereiche, setBereiche] = useState<Bereich[]>(() => eingerichteteBereiche(document));
  const [satz, setSatz] = useState("");
  const [meldung, setMeldung] = useState<string | null>(null);
  // Was der Sperrbildschirmmelder TATSÄCHLICH tut: „laeuft" erst nach erfolgreichem Start.
  const [melder, setMelder] = useState<MelderAnzeige>("nur_fenster");
  // Die aktuelle Berechtigung gilt für den Bereich DIESER Begleitung, nicht für „irgendeinen".
  const darfBegleiten = b.freigabe ? darf(b.freigabe.bereich, rolle) : false;
  const lage = useRef({ konto: konto ?? "", darfBegleiten, rechteGeprueftAm });
  lage.current = { konto: konto ?? "", darfBegleiten, rechteGeprueftAm };
  const rolleJetzt = useRef(rolle);
  rolleJetzt.current = rolle;
  const aktuell = useRef(b);
  aktuell.current = b;
  const zeitgeber = useRef<number | null>(null);
  // Nacharbeit 12 (Ben AC02, Hostprobe 84): `document.hidden` erfasst ein SICHTBARES, aber
  // unfokussiertes Fenster nicht — beim Wechsel in ein anderes oder privates Fenster blieb die
  // Begleitung aktiv. Der Fensterfokus wird deshalb über `blur`/`focus` des Fensters verfolgt und
  // vor JEDEM lokalen Lesen geprüft. Gezählt werden die Ereignisse selbst, nicht `hasFocus()`: der
  // Wert vor dem ersten Ereignis ist „fokussiert", denn gestartet wird stets per Klick in diese Seite.
  const fokusVerloren = useRef(false);
  const melderBeenden = useRef<(() => void) | null>(null);
  /** Jeder Einrichtungsversuch bekommt eine Nummer; ein überholter Versuch wirkt nicht mehr. */
  const melderVersuch = useRef(0);
  const leisteRef = useRef<HTMLElement | null>(null);
  const [platz, setPlatz] = useState<Platz>({ unten: GRUND_UNTEN, maxHoehe: 10_000 });

  // Der Figur ausweichen (G10): nach jedem Rendern (die Leiste erscheint oder wächst), bei
  // Größenänderung und im Takt, weil die Figur verschiebbar ist. Ohne sichtbare Leiste wird nichts
  // gemessen; ein unveränderter Platz löst kein neues Rendern aus.
  const messePlatz = useCallback((): void => {
    const leiste = leisteRef.current;
    if (!leiste) {
      return;
    }
    const figur = document.querySelector<HTMLElement>(FIGUR);
    // Die UNGEKÜRZTE Höhe: `scrollHeight` (Inhalt samt Polster, unabhängig von `max-height`) plus
    // Rahmen. Die gemessene Kastenhöhe wäre nach eigener Begrenzung schon gekürzt (Nacharbeit 10).
    const inhaltHoehe = leiste.scrollHeight + (leiste.offsetHeight - leiste.clientHeight);
    const neu = platzNebenFigur(
      leiste.getBoundingClientRect(),
      inhaltHoehe,
      figur ? figur.getBoundingClientRect() : null,
      window.innerHeight,
    );
    setPlatz((alt) => (alt.unten === neu.unten && alt.maxHoehe === neu.maxHoehe ? alt : neu));
  }, []);
  useLayoutEffect(() => {
    messePlatz();
  });
  useEffect(() => {
    const takt = window.setInterval(messePlatz, PLATZ_TAKT_MS);
    window.addEventListener("resize", messePlatz);
    return () => {
      window.clearInterval(takt);
      window.removeEventListener("resize", messePlatz);
    };
  }, [messePlatz]);
  const lageDerLeiste = {
    ref: leisteRef,
    style: { bottom: platz.unten, maxHeight: platz.maxHoehe },
  };

  // Nur die Freigabe wird gesichert — nie Kontext, Hinweis oder Feldwerte.
  const freigabe = sicherung(b);
  useEffect(() => {
    schreib(FREIGABE_SCHLUESSEL, freigabe);
  }, [freigabe]);

  useEffect(() => {
    if (notizStand.konto) {
      const liste = notizStand.liste;
      schreib(`${NOTIZ_PRAEFIX}${notizStand.konto}`, liste.length > 0 ? liste : null);
    }
  }, [notizStand]);

  /** Liest den Vorgang (falls aktiv) und prüft danach, ob ein Hinweis fällig ist. */
  const abtasten = useCallback(
    (ereignis?: KontextEreignis) => {
      setB((alt) => {
        const zeit = jetzt();
        const lageJetzt = { ...lage.current, jetzt: zeit };
        let neu = pruefeAblauf(alt, zeit);
        if (neu.phase === "aktiv" && neu.freigabe) {
          if (!ereignis && (document.hidden || fokusVerloren.current)) {
            // Verborgenes oder unfokussiertes Fenster: pausieren, OHNE vorher zu lesen.
            neu = systemereignis(neu, document.hidden ? "verborgen" : "fokusverlust", zeit);
          } else {
            // Erst prüfen, dann lesen: ohne aktuelle Berechtigung wird das Dokument nicht angefasst,
            // und `nimmKontext` pausiert mit dem passenden Grund.
            const e =
              ereignis ??
              (darfLesen(neu, lageJetzt)
                ? liesVorgang(document, neu.freigabe.bereich.kennung, lageJetzt.konto)
                : nirgends(lageJetzt.konto));
            neu = nimmKontext(neu, e, lageJetzt).begleitung;
          }
        }
        return naechsterHinweis(neu, zeit);
      });
    },
    [jetzt],
  );

  // Konto- und Rechtewechsel pausieren sofort — nicht erst beim nächsten Lesen.
  useEffect(() => {
    setB((alt) => {
      if (!alt.freigabe || (alt.phase !== "aktiv" && alt.phase !== "pausiert")) {
        return alt;
      }
      if ((konto ?? "") !== alt.freigabe.konto) {
        return alt.grund === "kontowechsel" ? alt : systemereignis(alt, "kontowechsel", jetzt());
      }
      if (!darfBegleiten && alt.rechteentzugAm === null) {
        return systemereignis(alt, "rechteentzug", jetzt());
      }
      return alt;
    });
  }, [konto, darfBegleiten, jetzt]);

  /** Beendet einen laufenden Melder und entwertet jeden noch ausstehenden Einrichtungsversuch. */
  const beendeMelder = useCallback(() => {
    melderVersuch.current += 1;
    melderBeenden.current?.();
    melderBeenden.current = null;
  }, []);

  /**
   * Richtet den Melder neu ein — synchron aus der Geste (Erlaubnisanfrage vor dem ersten `await`).
   * `weiter` bekommt den tatsächlichen Zustand; ein überholter Versuch ruft `weiter` nie und gibt
   * einen dennoch gestarteten Melder sofort wieder frei. Ohne API bleibt alles synchron.
   */
  const richteMelderEin = useCallback(
    (weiter: (zustand: MelderErgebnis["zustand"]) => void) => {
      beendeMelder();
      if (!sperrmelderVerfuegbar()) {
        setMelder("nur_fenster");
        weiter("nur_fenster");
        return;
      }
      const versuch = melderVersuch.current;
      let entschieden = false;
      setMelder("startet");
      const beiSperre = (): void => {
        if (!entschieden && versuch === melderVersuch.current) {
          // Nacharbeit 4 (Ben AC07): Sperre WÄHREND der Einrichtung. Der Versuch wird entwertet —
          // seine spätere Antwort aktiviert nichts mehr, der Melder wird freigegeben. Beim
          // Fortsetzen wird aus der Pause eine Sperrbildschirmpause; beim Erststart bleibt es bei
          // „aus". In beiden Fällen braucht es danach eine neue, bewusste Handlung.
          beendeMelder();
          setMelder("nur_fenster");
          setMeldung(t("begleitung.fehler.gesperrtBeimStart"));
        }
        setB((alt) => systemereignis(alt, "sperrbildschirm", jetzt()));
      };
      // Nacharbeit 12: Fokusverlust WÄHREND der Einrichtung entwertet den Versuch genauso — auch
      // wenn das Fenster vor der Antwort wieder fokussiert ist. Die Rückkehr allein aktiviert nichts.
      const beiFokusverlust = (): void => {
        if (!entschieden && versuch === melderVersuch.current) {
          beendeMelder();
          setMelder("nur_fenster");
          setMeldung(t("begleitung.fehler.fokusBeimStart"));
          setB((alt) => systemereignis(alt, "fokusverlust", jetzt()));
        }
      };
      window.addEventListener("blur", beiFokusverlust);
      void starteSperrmelder(beiSperre).then((r) => {
        window.removeEventListener("blur", beiFokusverlust);
        if (versuch !== melderVersuch.current) {
          if (r.zustand === "laeuft") {
            r.beenden();
          }
          return;
        }
        entschieden = true;
        if (r.zustand === "laeuft") {
          melderBeenden.current = r.beenden;
        }
        setMelder(r.zustand === "laeuft" ? "laeuft" : "nur_fenster");
        weiter(r.zustand);
      });
    },
    [beendeMelder, jetzt, t],
  );

  // Außerhalb von „aktiv" läuft kein Melder: Pause, Stopp, Ablauf und Abbau geben ihn frei.
  // Fortsetzen richtet ihn neu ein und prüft ihn, bevor wieder beobachtet wird.
  useEffect(() => {
    if (b.phase !== "aktiv") {
      beendeMelder();
      setMelder("nur_fenster");
    }
  }, [b.phase, beendeMelder]);
  useEffect(() => beendeMelder, [beendeMelder]);

  // Fensterfokus (Nacharbeit 12): ein anderes — auch privates — Fenster im Vordergrund pausiert die
  // Begleitung sofort und verwirft den flüchtigen Kontext; die Rückkehr setzt NICHT fort.
  useEffect(() => {
    const weg = (): void => {
      fokusVerloren.current = true;
      setB((alt) => (alt.phase === "aktiv" ? systemereignis(alt, "fokusverlust", jetzt()) : alt));
    };
    const zurueck = (): void => {
      fokusVerloren.current = false;
    };
    window.addEventListener("blur", weg);
    window.addEventListener("focus", zurueck);
    return () => {
      window.removeEventListener("blur", weg);
      window.removeEventListener("focus", zurueck);
    };
  }, [jetzt]);

  const aktiv = b.phase === "aktiv";

  // Eingaben im Bereich: erst nach der Tipppause lesen, damit kein Hinweis mitten ins Tippen fällt.
  // Beim Einschalten und nach jedem Fortsetzen wird sofort frischer Kontext gelesen.
  useEffect(() => {
    if (!aktiv) {
      return;
    }
    const beiEingabe = (): void => {
      setB((alt) => beschaeftigt(alt, jetzt() + TIPPPAUSE_MS));
      if (zeitgeber.current !== null) {
        window.clearTimeout(zeitgeber.current);
      }
      zeitgeber.current = window.setTimeout(() => abtasten(), TIPPPAUSE_MS + 50);
    };
    const takt = window.setInterval(() => abtasten(), TAKT_MS);
    const sicht = (): void => abtasten();
    document.addEventListener("input", beiEingabe, true);
    document.addEventListener("change", beiEingabe, true);
    document.addEventListener("visibilitychange", sicht);
    abtasten();
    return () => {
      document.removeEventListener("input", beiEingabe, true);
      document.removeEventListener("change", beiEingabe, true);
      document.removeEventListener("visibilitychange", sicht);
      window.clearInterval(takt);
      if (zeitgeber.current !== null) {
        window.clearTimeout(zeitgeber.current);
        zeitgeber.current = null;
      }
    };
  }, [aktiv, abtasten, jetzt]);

  // Host-Adapter (Browser, Nativanwendung) und Systemereignisse.
  useEffect(() => {
    const kontext = (e: Event): void => {
      const detail = (e as CustomEvent<KontextEreignis>).detail;
      if (detail && typeof detail === "object" && detail.quelle && Array.isArray(detail.felder)) {
        abtasten(detail);
      }
    };
    const system = (e: Event): void => {
      const art = (e as CustomEvent<{ ereignis?: unknown }>).detail?.ereignis;
      if (istSystemereignis(art)) {
        setB((alt) => systemereignis(alt, art, jetzt()));
      }
    };
    window.addEventListener(KONTEXT_EREIGNIS, kontext);
    window.addEventListener(SYSTEM_EREIGNIS, system);
    return () => {
      window.removeEventListener(KONTEXT_EREIGNIS, kontext);
      window.removeEventListener(SYSTEM_EREIGNIS, system);
    };
  }, [abtasten, jetzt]);

  // Solange nichts läuft: eingerichtete Vorgänge auf der Seite finden (Seitenwechsel, Nachladen).
  useEffect(() => {
    if (b.phase !== "aus") {
      return;
    }
    const neu = (): void => {
      setBereiche((alt) => {
        const da = eingerichteteBereiche(document);
        return JSON.stringify(da) === JSON.stringify(alt) ? alt : da;
      });
    };
    neu();
    const beobachter = new MutationObserver(neu);
    beobachter.observe(document.body, { childList: true, subtree: true });
    return () => beobachter.disconnect();
  }, [b.phase]);

  const pauseOderFortsetzen = useCallback(() => {
    const alt = aktuell.current;
    if (alt.phase === "aktiv") {
      setMeldung(null);
      setB(pausiere(alt, "nutzer", jetzt()));
      return;
    }
    if (alt.phase !== "pausiert") {
      return;
    }
    const abgelehnt = (r: Extract<ReturnType<typeof fortsetzen>, { ok: false }>): void => {
      // Inzwischen gestoppt: kein Fehlersatz — der Stopp spricht für sich.
      setMeldung(r.fehler === "nicht_pausiert" ? null : t(`begleitung.fehler.${r.fehler}`));
      if (r.fehler === "rechte_unbestaetigt") {
        // Eine frische Serverantwort holen; Fortsetzen bleibt eine bewusste zweite Handlung.
        pruefeRechte?.();
      }
      setB(r.begleitung);
    };
    const vorab = fortsetzen(alt, { ...lage.current, jetzt: jetzt() });
    if (!vorab.ok) {
      abgelehnt(vorab);
      return;
    }
    setMeldung(null);
    // Die Hostüberwachung neu herstellen und ihren Zustand prüfen, BEVOR wieder beobachtet wird.
    richteMelderEin((zustand) => {
      const jetztStand = aktuell.current;
      // Zweite Prüfung am aktuellen Stand: Ablauf, Stopp, Konto und Rechte während des Starts.
      const r = fortsetzen(jetztStand, { ...lage.current, jetzt: jetzt() });
      if (!r.ok) {
        beendeMelder();
        abgelehnt(r);
        return;
      }
      if (fokusVerloren.current || document.hidden) {
        // Im Moment der Entscheidung ist ein anderes Fenster vorn: nicht aktivieren.
        beendeMelder();
        setB(pausiere(jetztStand, "fokusverlust", jetzt()));
        setMeldung(t("begleitung.fehler.fokusBeimStart"));
        return;
      }
      if (zustand === "ausgefallen") {
        setB(pausiere(jetztStand, "sperrmelder", jetzt()));
        setMeldung(t("begleitung.fehler.sperrmelder"));
        return;
      }
      setB(r.begleitung);
    });
  }, [jetzt, t, pruefeRechte, richteMelderEin, beendeMelder]);

  const stopp = useCallback(() => {
    setMeldung(null);
    setB((alt) => stoppe(alt));
  }, []);

  useEffect(() => {
    if (b.phase !== "aktiv" && b.phase !== "pausiert") {
      return;
    }
    const taste = (e: KeyboardEvent): void => {
      if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey) {
        return;
      }
      if (e.code === "KeyP") {
        e.preventDefault();
        pauseOderFortsetzen();
      } else if (e.code === "KeyS") {
        e.preventDefault();
        stopp();
      }
    };
    window.addEventListener("keydown", taste, true);
    return () => window.removeEventListener("keydown", taste, true);
  }, [b.phase, pauseOderFortsetzen, stopp]);

  const ende = useMemo(
    () =>
      b.freigabe
        ? new Date(b.freigabe.endetAm).toLocaleTimeString(i18n.language, {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "",
    [b.freigabe, i18n.language],
  );

  // Angeboten wird nur ein Vorgang, den diese Rolle begleiten lassen darf.
  const bereich = bereiche.find((x) => darf(x, rolle));
  const starten = (): void => {
    if (!bereich || !konto) {
      return;
    }
    const r = starte(leseAuftrag(satz), bereich, { konto, jetzt: jetzt(), id: neueId() });
    if (!r.ok) {
      setMeldung(t(`begleitung.fehler.${r.fehler}`));
      return;
    }
    setMeldung(null);
    const gewaehlt = bereich;
    const freigabeKonto = konto;
    // Aus der Startgeste heraus den Melder einrichten; aktiviert wird erst danach.
    richteMelderEin((zustand) => {
      const zeit = jetzt();
      const neu = r.begleitung;
      // Während des Starts kann sich die Lage geändert haben: Konto, Rolle, ein anderer Start.
      if (aktuell.current.phase !== "aus") {
        beendeMelder();
        return;
      }
      if (lage.current.konto !== freigabeKonto) {
        beendeMelder();
        setMeldung(t("begleitung.fehler.anderes_konto"));
        return;
      }
      if (!darf(gewaehlt, rolleJetzt.current)) {
        beendeMelder();
        setMeldung(t("begleitung.fehler.keine_rechte"));
        return;
      }
      if (fokusVerloren.current || document.hidden) {
        beendeMelder();
        setMeldung(t("begleitung.fehler.fokusBeimStart"));
        return;
      }
      setSatz("");
      if (zustand === "ausgefallen") {
        setB(pausiere(neu, "sperrmelder", zeit));
        setMeldung(t("begleitung.fehler.sperrmelder"));
        return;
      }
      setB(neu);
    });
  };

  const notizUebernehmen = (): void => {
    const h = b.hinweis;
    if (!h || !b.freigabe) {
      return;
    }
    const text = t("begleitung.notiz.text", {
      bereich: b.freigabe.bereich.bezeichnung,
      feld: h.bezeichnung,
      wert: h.wert,
    });
    setNotizen((alt) => [...alt, { id: neueId(), text, uebernommenAm: jetzt() }]);
    setB((alt) => verwirf(alt));
  };

  // Abgemeldet oder ein anderes Konto: die pausierte Begleitung gehört nicht diesem Konto — es sieht
  // weder Zweck noch Bereich, und es kann sie nicht fortsetzen.
  if (!konto || (b.freigabe !== null && b.phase !== "aus" && b.freigabe.konto !== konto)) {
    return null;
  }

  const notizListe =
    notizen.length > 0 ? (
      <div data-testid="begleitung-notizen" className="mt-2">
        <p className="text-xs font-semibold">{t("begleitung.notiz.titel")}</p>
        <ul className="text-xs">
          {notizen.map((n) => (
            <li key={n.id} className="flex items-center justify-between gap-2">
              <span>{n.text}</span>
              <button
                type="button"
                className="underline"
                onClick={() => setNotizen((alt) => alt.filter((x) => x.id !== n.id))}
              >
                {t("begleitung.notiz.loeschen")}
              </button>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  if (b.phase === "aus") {
    if (!bereich) {
      return null;
    }
    return (
      <section
        {...lageDerLeiste}
        aria-label={t("begleitung.region")}
        className={RAHMEN}
        data-testid="begleitung-angebot"
      >
        <p className="font-semibold">{t("begleitung.angebot.titel")}</p>
        <p className="text-xs">
          {t("begleitung.angebot.bereich", { bereich: bereich.bezeichnung })}
        </p>
        <form
          className="mt-2 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            starten();
          }}
        >
          <label className="text-xs" htmlFor="begleitung-auftrag">
            {t("begleitung.angebot.feld")}
          </label>
          <input
            id="begleitung-auftrag"
            data-testid="begleitung-auftrag"
            className="rounded border px-2 py-1"
            value={satz}
            placeholder={t("begleitung.angebot.platzhalter")}
            onChange={(e) => setSatz(e.target.value)}
          />
          <p className="text-xs">{t("begleitung.angebot.erklaerung")}</p>
          <button type="submit" className="rounded border px-2 py-1 font-semibold">
            {t("begleitung.angebot.starten")}
          </button>
        </form>
        {melder === "startet" ? (
          <p className="mt-1 text-xs" data-testid="begleitung-sperrerkennung">
            {t("begleitung.status.sperreStartet")}
          </p>
        ) : null}
        {meldung ? (
          <p role="alert" className="mt-1 text-xs">
            {meldung}
          </p>
        ) : null}
        {notizListe}
      </section>
    );
  }

  if (b.phase === "beendet") {
    const satzEnde =
      b.grund === "abgelaufen" ? "begleitung.beendet.abgelaufen" : "begleitung.beendet.stopp";
    return (
      <section
        {...lageDerLeiste}
        aria-label={t("begleitung.region")}
        className={RAHMEN}
        data-testid="begleitung-beendet"
      >
        {/* `<output>` trägt die Statusrolle selbst — dieselbe Ansage wie `role="status"`. */}
        <output className="block">{t(satzEnde)}</output>
        {notizListe}
        <button type="button" className="mt-2 rounded border px-2 py-1" onClick={() => setB(AUS)}>
          {t("begleitung.knopf.schliessen")}
        </button>
      </section>
    );
  }

  const f = b.freigabe as Freigabe;
  const info = auskunft(b, notizen);
  return (
    <section
      {...lageDerLeiste}
      aria-label={t("begleitung.region")}
      className={RAHMEN}
      data-testid="begleitung-status"
    >
      <output aria-live="polite" className="block font-semibold" data-testid="begleitung-zustand">
        {t(aktiv ? "begleitung.status.aktiv" : "begleitung.status.pausiert", {
          bereich: f.bereich.bezeichnung,
          ende,
        })}
      </output>
      <p className="text-xs">{t("begleitung.status.zweck", { zweck: f.zweck })}</p>
      <p className="text-xs" data-testid="begleitung-medien">
        {t("begleitung.status.medien")}
      </p>
      <p className="text-xs" data-testid="begleitung-sperrerkennung">
        {t(sperreSchluessel(b.phase, melder))}
      </p>
      {b.phase === "pausiert" && b.grund ? (
        <p className="text-xs" data-testid="begleitung-grund">
          {t(`begleitung.grund.${b.grund}`)}
        </p>
      ) : null}
      {aktiv && b.ausserhalb ? (
        <p className="text-xs" data-testid="begleitung-ausserhalb">
          {t("begleitung.status.ausserhalb")}
        </p>
      ) : null}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className="rounded border px-2 py-1"
          aria-keyshortcuts="Alt+Shift+P"
          onClick={pauseOderFortsetzen}
        >
          {t(aktiv ? "begleitung.knopf.pause" : "begleitung.knopf.fortsetzen")}
        </button>
        <button
          type="button"
          className="rounded border px-2 py-1"
          aria-keyshortcuts="Alt+Shift+S"
          onClick={stopp}
        >
          {t("begleitung.knopf.stopp")}
        </button>
      </div>
      <p className="mt-1 text-xs" data-testid="begleitung-tastatur">
        {t("begleitung.tastatur")}
      </p>
      {meldung ? (
        <p role="alert" className="mt-1 text-xs">
          {meldung}
        </p>
      ) : null}
      {aktiv && b.hinweis ? (
        <div className="mt-2 rounded border p-2" data-testid="begleitung-hinweis">
          <p>
            {b.hinweis.einheiten.length > 0
              ? t("begleitung.hinweis.einheit", {
                  feld: b.hinweis.bezeichnung,
                  wert: b.hinweis.wert,
                  einheiten: b.hinweis.einheiten.join(", "),
                })
              : t("begleitung.hinweis.einheitOhneVorgabe", {
                  feld: b.hinweis.bezeichnung,
                  wert: b.hinweis.wert,
                })}
          </p>
          <p className="text-xs">{t("begleitung.hinweis.selbst")}</p>
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              className="rounded border px-2 py-1"
              onClick={() => setB((alt) => verwirf(alt))}
            >
              {t("begleitung.hinweis.verwerfen")}
            </button>
            <button type="button" className="rounded border px-2 py-1" onClick={notizUebernehmen}>
              {t("begleitung.hinweis.notiz")}
            </button>
          </div>
        </div>
      ) : null}
      {notizListe}
      <details className="mt-2 text-xs" data-testid="begleitung-auskunft">
        <summary>{t("begleitung.auskunft.titel")}</summary>
        <p>
          {t("begleitung.auskunft.freigabe", {
            wert: t(info.gespeichert.freigabe ? "begleitung.ja" : "begleitung.nein"),
          })}
        </p>
        <p>{t("begleitung.auskunft.notizen", { anzahl: info.gespeichert.notizen })}</p>
        <p>{t("begleitung.auskunft.fluechtig", { anzahl: info.fluechtig.felder })}</p>
        <p>{t("begleitung.auskunft.keinVerlauf")}</p>
      </details>
    </section>
  );
}
