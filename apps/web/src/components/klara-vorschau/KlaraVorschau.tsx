// ================================================================================================
// KLARA-VORSCHAU (produkt:20261007:klara-vorschau) — Klara als bewegliche Figur über der App.
// ================================================================================================
//
// WAS DIESE FLÄCHE IST: die erste ansehbare Fassung der Idee „Klara bewegt sich frei über den
// Bildschirm, erkennt, wo sie ist und was markiert ist“. Sie lebt in der bestehenden Hülle
// (`shell/AppShell.tsx`) und ersetzt dort — nur bei eingeschalteter Vorschau — den Hilfeknopf.
//
// ZWEI BETRIEBE, SICHTBAR UNTERSCHIEDEN (Klara 01, produkt:20261008:klara-basis):
//   · ECHT (Anfang): getippte Fragen gehen mit Einwilligung über den Frageweg `POST /api/ask`, das
//     Gespräch liegt unter dem eigenen Konto am Server (`echt.ts`, `KlaraEchtGespraech.tsx`). Eine
//     laufende Anfrage lässt sich stoppen; jeder Fehler zeigt den tatsächlichen Zustand.
//   · DEMO: die Vorschau wie geliefert — jede Antwort vorgefertigt (`antworten.ts`) und als Demo
//     gekennzeichnet; Notiz, Erinnerung und Termin nur in dieser Browser-Sitzung. Die Aktionen mit
//     einem markierten Ausschnitt gibt es nur hier: im echten Betrieb geht kein Seitentext an die KI.
// Keine Beobachtung ausserhalb des Browsers.
//
// BEDIENUNG, DREI WEGE FÜR JEDE HANDLUNG:
//   · Verschieben: Maus und Touch (Pointer-Ereignisse), Tastatur (Pfeiltasten, Umschalt = grösser,
//     Pos1 = Startplatz). Ziehen öffnet das Gespräch NICHT — erst ein Klick ohne Weg tut das.
//   · Nah am Rand losgelassen dockt Klara an und bleibt bei Fensteränderung an diesem Rand. Auf
//     einem Artikelabsatz losgelassen parkt sie dort und wandert beim Scrollen mit.
//   · Jede Lage wird geklemmt: nach Scrollen, Fensteränderung und Vollbild bleibt sie im Bild.
import {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { KlaraObjektbezug } from "../../api/klaraGespraech";
import { useSession } from "../../app/AuthContext";
import { HOME_ROUTE } from "../../app/navigation";
// produkt:20261010:assistenz-name-avatar: Name, Motiv und Bewegung aus dem persönlichen Profil.
import { useAssistenzAnzeige, useAssistenzT } from "../../lib/assistenzProfil";
import { internerPfad } from "../../lib/internerPfad";
import { leseobjektJetzt, useLeseobjekt } from "../../lib/leseobjekt";
import { leserHref } from "../../lib/objektbezug";
import { toReasonerLocale } from "../../lib/reasonerLocale";
import { useTutorialFuerKlara } from "../../tutorial/TutorialRahmen";
import type { TutorialFernLage } from "../../tutorial/fernsteuerung";
import { AvatarBild } from "../assistenz/AvatarBild";
import { KlaraEchtGespraech, useKlaraKiLage } from "./KlaraEchtGespraech";
import {
  type Absendeergebnis,
  KlaraAuftragKarte,
  KlaraSprachLeiste,
  KlaraSprachausgabe,
  type SprachZiel,
  VorlesenKnopf,
  useKlaraSprache,
} from "./KlaraSprache";
import { KlaraTutorialKarte, KlaraZeiger, type ZielTreffer, findeZiel } from "./KlaraTutorial";
import { setzeKlaraVorschauAktiv } from "./aktiv";
import { antwortAufAuswahl, antwortAufFrage, entwurfsInhalt, kuerze } from "./antworten";
import { VORSCHAU_PFAD, artikelPfad, demoArtikel } from "./artikel";
import {
  type KontextAktion,
  ZIELSPRACHEN,
  type Zielsprache,
  bezugZeile,
  frageText,
  herkunftTeile,
  mitSeitenbezug,
  moeglicheAktionen,
  objektbezugFuer,
  pruefeAuswahl,
  seitenbezugAusObjektbezug,
  seitenbezugFuer,
  sperrgrund,
  uebersetzung,
  wirksamerBezug,
} from "./bezug";
import {
  fragen as echtFragen,
  hilfe as echtHilfe,
  stoppen as echtStoppen,
  vergiss as echtVergessen,
  ladeEcht,
  leseEcht,
  objektbezugAus,
  useEchtGespraech,
} from "./echt";
import {
  type Uebersetzer,
  ermittleKontext,
  herkunftFuer,
  seiteAusPfad,
  seitenErklaerung,
} from "./kontext";
import { leseVorlesen, stoppeVorlesen, vorlesen as vorlesenStarten } from "./vorlesen";
import {
  type Aktion,
  type Bezug,
  type Entwurf,
  FIGUR_GROESSE,
  type Herkunft,
  type Nachricht,
  type Position,
  SEITLICH_BREITE,
  type Status,
  type Vorschlag,
  ZIEH_SCHWELLE,
  aendere,
  anKontoBinden,
  angedocktePosition,
  entscheide,
  klemme,
  leseZustand,
  naechsterRand,
  neueId,
  statusNachAntwort,
  useKlaraZustand,
  wirksamePosition,
  zuruecksetzenGanz,
} from "./zustand";

/** So lange „läuft“ eine vorgefertigte Anfrage — sichtbar, aber kurz. */
const VERZOEGERUNG_MS = 700;
/**
 * Echter Betrieb: Klaras eingebaute Hilfe liest die Lage des Tutorials erst, nachdem es sich geöffnet
 * hat („Zeige mir den nächsten Schritt“ öffnet es im selben Klick). Kein vorgetäuschtes Rechnen.
 */
const HILFE_TAKT_MS = 400;
const PANEL_BREITE = 360;
const MINI_GROESSE = 48;
const SCHMAL = "(max-width: 899px)";
const REDUZIERT = "(prefers-reduced-motion: reduce)";

const STATUS_TEXT: Record<Status, string> = {
  ruhe: "klaravorschau.status.ruhe",
  laeuft: "klaravorschau.status.laeuft",
  antwort: "klaravorschau.status.antwort",
  entscheidung: "klaravorschau.status.entscheidung",
};

const ANFRAGE_TEXT = {
  erklaeren: "klaravorschau.anfrage.erklaeren",
  zusammenfassen: "klaravorschau.anfrage.zusammenfassen",
  umformulieren: "klaravorschau.anfrage.umformulieren",
  notiz: "klaravorschau.anfrage.notiz",
} as const;

const KNOPF =
  "inline-flex h-8 items-center gap-1 rounded-btn border border-hairline bg-surface px-2.5 text-[12px] font-semibold text-text hover:border-ink/30 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const KNOPF_KI =
  "inline-flex h-8 items-center rounded-btn border border-ai bg-ai-surface-2 px-2.5 text-[12px] font-semibold text-ai hover:bg-ai-surface-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const KLEINTITEL = "font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2";
const DEMO_SCHILD =
  "rounded-pill bg-trust-warn-bg px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-trust-warn-text";

interface Fenster {
  breite: number;
  hoehe: number;
  /** Abstand der sichtbaren Unterkante zur Fensterunterkante (Bildschirmtastatur). */
  unten: number;
}

function leseFenster(): Fenster {
  const vv = window.visualViewport;
  const hoehe = vv ? vv.height : window.innerHeight;
  const unten = vv ? Math.max(0, Math.round(window.innerHeight - (vv.height + vv.offsetTop))) : 0;
  return { breite: window.innerWidth, hoehe, unten };
}

function useFenster(): Fenster {
  const [fenster, setFenster] = useState<Fenster>(leseFenster);
  useEffect(() => {
    const neu = (): void => setFenster(leseFenster());
    const vv = window.visualViewport;
    window.addEventListener("resize", neu);
    vv?.addEventListener("resize", neu);
    vv?.addEventListener("scroll", neu);
    document.addEventListener("fullscreenchange", neu);
    return () => {
      window.removeEventListener("resize", neu);
      vv?.removeEventListener("resize", neu);
      vv?.removeEventListener("scroll", neu);
      document.removeEventListener("fullscreenchange", neu);
    };
  }, []);
  return fenster;
}

function useMedien(abfrage: string): boolean {
  const lesen = (): boolean =>
    typeof window.matchMedia === "function" && window.matchMedia(abfrage).matches;
  const [treffer, setTreffer] = useState(lesen);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const mq = window.matchMedia(abfrage);
    const neu = (): void => setTreffer(mq.matches);
    neu();
    mq.addEventListener?.("change", neu);
    return () => mq.removeEventListener?.("change", neu);
  }, [abfrage]);
  return treffer;
}

/** Das Element im Vollbild — Klara muss DORT hinein, sonst verschwindet sie hinter dem Vollbild. */
function useVollbild(): Element | null {
  const [el, setEl] = useState<Element | null>(() => document.fullscreenElement ?? null);
  useEffect(() => {
    const neu = (): void => setEl(document.fullscreenElement ?? null);
    document.addEventListener("fullscreenchange", neu);
    return () => document.removeEventListener("fullscreenchange", neu);
  }, []);
  return el;
}

/** Herkunft samt Absatz — seit Klara 03 auch mit Fassung, Prüfstatus und Lesart (`bezug.ts`). */
function herkunftZeile(h: Herkunft, t: Uebersetzer): string {
  return herkunftTeile(h, t).join(" · ");
}

// R-1398: `h.pfad` ist ein früher gelesener `location.pathname` — nur ein interner Pfad wird
// Navigationsziel (lib/internerPfad.ts, GHSA-wrjc/GHSA-jjmj). Klara 03: eine Markierung aus einem
// Wissensobjekt führt in die Lesefläche DIESES Objekts mit der Fassung von damals (`leserHref`).
function herkunftZiel(h: Herkunft): string {
  if (h.koId) {
    return leserHref({ koId: h.koId, fassung: h.fassung ?? null });
  }
  return h.artikelId && h.absatz
    ? `${artikelPfad(h.artikelId)}#absatz-${h.absatz}`
    : internerPfad(h.pfad, HOME_ROUTE);
}

const BEZUG_KNOEPFE: readonly Bezug[] = ["seite", "markierung", "frei"];

interface AuswahlKnopf {
  x: number;
  y: number;
  text: string;
  herkunft: Herkunft;
}

export function KlaraVorschau(): JSX.Element {
  // produkt:20261010:assistenz-name-avatar: `t` trägt den persönlichen Namen als `{{assistenz}}`.
  const { t, i18n } = useAssistenzT();
  const assistenz = useAssistenzAnzeige();
  const z = useKlaraZustand();
  const location = useLocation();
  const navigate = useNavigate();
  const tutorial = useTutorialFuerKlara();
  const schmal = useMedien(SCHMAL);
  // Reduzierte Bewegung: Systemeinstellung ODER die eigene Wahl unter „Meine Assistenz".
  const reduziert = useMedien(REDUZIERT) || assistenz.bewegungReduziert;
  const fenster = useFenster();
  const vollbildEl = useVollbild();
  const hinweisId = useId();
  const eingabeId = useId();

  // ---------------------------------------------------------------------------------------------
  // Klara 01 · echter Betrieb: das eigene Gespräch vom Server, die Lage der KI aus dem Status.
  // ---------------------------------------------------------------------------------------------
  const sitzung = useSession();
  const kontoId = sitzung.user?.id ?? null;
  const echt = useEchtGespraech();
  const ki = useKlaraKiLage();
  const istEcht = z.betrieb === "echt";
  // Klara 03 · K6: Markierung, Demo-Verlauf und Entwurf gehören dem Konto, unter dem sie entstanden.
  // Gebunden wird erst, wenn der Server die Sitzungsfrage beantwortet hat — während des Ladens ist
  // „kein Konto“ keine Abmeldung (`Sitzungslage`, AuthContext).
  const sitzungBeantwortet = !sitzung.isLoading && sitzung.sitzungslage !== "unbeantwortet";
  useEffect(() => {
    if (sitzungBeantwortet) {
      aendere((alt) => anKontoBinden(alt, kontoId));
    }
  }, [sitzungBeantwortet, kontoId]);
  useEffect(() => {
    if (!kontoId) {
      // Abgemeldet: nichts vom Gespräch bleibt im Browser stehen — und nichts wird mehr vorgelesen.
      echtVergessen();
      stoppeVorlesen();
      return;
    }
    if (istEcht) {
      void ladeEcht(kontoId, t);
    }
  }, [kontoId, istEcht, t]);
  // „Anfrage läuft seit … s“ — einmal je Sekunde neu gezeichnet, nur solange eine läuft.
  const [, setTakt] = useState(0);
  useEffect(() => {
    if (echt.laeuftSeit === null) {
      return;
    }
    const uhr = window.setInterval(() => setTakt((n) => n + 1), 1000);
    return () => window.clearInterval(uhr);
  }, [echt.laeuftSeit]);

  // ---------------------------------------------------------------------------------------------
  // Wo bin ich? Seite und Objekt — neu bei Seitenwechsel, Eingabe und Öffnen.
  // ---------------------------------------------------------------------------------------------
  // Klara 03: das Objekt der Lesefläche (Titel, Fassung, Prüfstatus, Lesen/Bearbeiten) kommt aus
  // dem Appzustand (`lib/leseobjekt.ts`); jede Meldung dort liest den Kontext neu.
  const leseobjekt = useLeseobjekt();
  const [kontext, setKontext] = useState<Herkunft>(() =>
    ermittleKontext(location.pathname, t, document, location.search, leseobjektJetzt()),
  );
  const kontextRef = useRef(kontext);
  kontextRef.current = kontext;
  // Für Ereignishörer, die einmal angemeldet werden (Markierung, Ziehen): der aktuelle Übersetzer.
  const tRef = useRef(t);
  tRef.current = t;
  // NACHARBEIT 3 (Bens Befund): Ein Entwurf lädt oft erst nach dem Seitenwechsel, und ein Wechsel
  // über `?draft=` setzt den Titel PROGRAMMATISCH (`Blatt.tsx` → `setTitle`) — ohne input-Ereignis.
  // Klara liest deshalb auf Seiten, deren Objekt aus einem Feld kommt (Erfassung, Fragen), das
  // tatsächlich angezeigte Objekt fortlaufend nach und reagiert zusätzlich auf jeden Wechsel der
  // Abfrage (`location.search`). Neu gesetzt wird nur, wenn sich wirklich etwas geändert hat.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `z.offen` und `leseobjekt` sind Auslöser.
  useEffect(() => {
    const neu = (): void => {
      const gemessen = ermittleKontext(
        location.pathname,
        t,
        document,
        location.search,
        leseobjektJetzt(),
      );
      setKontext((alt) =>
        alt.pfad === gemessen.pfad &&
        alt.seitenName === gemessen.seitenName &&
        alt.objekt === gemessen.objekt &&
        alt.artikelId === gemessen.artikelId &&
        alt.koId === gemessen.koId &&
        alt.fassung === gemessen.fassung &&
        alt.pruefstatus === gemessen.pruefstatus &&
        alt.modus === gemessen.modus &&
        alt.lesart === gemessen.lesart &&
        alt.entwurfId === gemessen.entwurfId &&
        alt.kontextText === gemessen.kontextText &&
        alt.darfBearbeiten === gemessen.darfBearbeiten
          ? alt
          : gemessen,
      );
    };
    neu();
    // Seiten werden nachgeladen — ihr Objekt steht erst kurz nach dem Seitenwechsel da.
    const spaet = window.setTimeout(neu, 400);
    const seite = seiteAusPfad(location.pathname).seite;
    const nachlesen =
      seite === "erfassung" || seite === "fragen" ? window.setInterval(neu, 300) : 0;
    let eingabeUhr = 0;
    const beiEingabe = (): void => {
      window.clearTimeout(eingabeUhr);
      eingabeUhr = window.setTimeout(neu, 60);
    };
    document.addEventListener("input", beiEingabe, true);
    return () => {
      window.clearTimeout(spaet);
      window.clearInterval(nachlesen);
      window.clearTimeout(eingabeUhr);
      document.removeEventListener("input", beiEingabe, true);
    };
  }, [location.pathname, location.search, t, z.offen, leseobjekt]);

  const lageRef = useRef<TutorialFernLage | null>(tutorial.lage);
  lageRef.current = tutorial.lage;

  const panelSichtbar = z.offen && !z.minimiert;
  const seitlichBreit = panelSichtbar && z.ansicht === "seitlich" && !schmal;
  const flaeche = {
    breite: seitlichBreit ? fenster.breite - SEITLICH_BREITE : fenster.breite,
    hoehe: fenster.hoehe,
  };

  // ---------------------------------------------------------------------------------------------
  // Ansage für Hilfstechnik + Fokusführung.
  // ---------------------------------------------------------------------------------------------
  const [ansage, setAnsage] = useState("");
  const figurRef = useRef<HTMLButtonElement | null>(null);
  const panelTitelRef = useRef<HTMLHeadingElement | null>(null);
  const [fokusZiel, setFokusZiel] = useState<"panel" | "auswahl" | "figur" | null>(null);
  useEffect(() => {
    if (!fokusZiel) {
      return;
    }
    const el =
      fokusZiel === "figur"
        ? figurRef.current
        : fokusZiel === "auswahl"
          ? document.querySelector<HTMLElement>('[data-testid="klara-auswahl-titel"]')
          : panelTitelRef.current;
    if (el) {
      el.focus({ preventScroll: true });
      setFokusZiel(null);
    }
  });

  const oeffnen = useCallback((ziel: "panel" | "auswahl" = "panel") => {
    aendere((alt) => ({
      ...alt,
      offen: true,
      minimiert: false,
      status: alt.status === "antwort" ? "ruhe" : alt.status,
    }));
    setFokusZiel(ziel);
  }, []);
  const schliessen = useCallback(() => {
    aendere((alt) => ({ ...alt, offen: false, minimiert: false }));
    setFokusZiel("figur");
  }, []);
  const minimieren = useCallback(() => {
    aendere((alt) => ({ ...alt, offen: false, minimiert: true }));
    setFokusZiel("figur");
  }, []);

  // Seitliche Ansicht: die App rückt zur Seite (index.css, `body.klara-seitlich`).
  useEffect(() => {
    if (!seitlichBreit) {
      return;
    }
    document.body.classList.add("klara-seitlich");
    return () => document.body.classList.remove("klara-seitlich");
  }, [seitlichBreit]);

  // ---------------------------------------------------------------------------------------------
  // Parken am Absatz: die Figur folgt dem Absatz beim Scrollen.
  // ---------------------------------------------------------------------------------------------
  const [, setParkTakt] = useState(0);
  useEffect(() => {
    if (!z.geparkt) {
      return;
    }
    const neu = (): void => setParkTakt((n) => n + 1);
    document.addEventListener("scroll", neu, true);
    window.addEventListener("resize", neu);
    const spaet = window.setTimeout(neu, 300);
    return () => {
      document.removeEventListener("scroll", neu, true);
      window.removeEventListener("resize", neu);
      window.clearTimeout(spaet);
    };
  }, [z.geparkt]);
  const parkAbsatz =
    z.geparkt && kontext.artikelId === z.geparkt.artikelId
      ? document.querySelector<HTMLElement>(
          `[data-klara-artikel="${z.geparkt.artikelId}"] [data-klara-absatz="${z.geparkt.absatz}"]`,
        )
      : null;

  // ---------------------------------------------------------------------------------------------
  // Ziehen mit Maus, Finger und Stift — Pointer-Ereignisse decken alle drei ab.
  // ---------------------------------------------------------------------------------------------
  const zieh = useRef<{ x: number; y: number; ursprung: Position; gezogen: boolean } | null>(null);
  const [ziehPos, setZiehPos] = useState<Position | null>(null);
  const gezogenAm = useRef(Number.NEGATIVE_INFINITY);

  let position: Position;
  if (ziehPos) {
    position = ziehPos;
  } else if (parkAbsatz) {
    const r = parkAbsatz.getBoundingClientRect();
    position = klemme({ x: r.right + 8, y: r.top }, flaeche);
  } else {
    position = wirksamePosition(z, flaeche);
  }

  const ablegen = (p: Position, zeigerX: number, zeigerY: number): void => {
    const unterZeiger =
      typeof document.elementsFromPoint === "function"
        ? document.elementsFromPoint(zeigerX, zeigerY)
        : [];
    const absatzEl = unterZeiger
      .map((el) => el.closest<HTMLElement>("[data-klara-absatz]"))
      .find((el): el is HTMLElement => Boolean(el) && !el?.closest("[data-klara]"));
    const artikelId = absatzEl?.closest<HTMLElement>("[data-klara-artikel]")?.dataset.klaraArtikel;
    const nr = absatzEl ? Number(absatzEl.dataset.klaraAbsatz) : Number.NaN;
    if (absatzEl && artikelId && Number.isFinite(nr)) {
      const herkunft = herkunftFuer(absatzEl, kontextRef.current, t);
      aendere((alt) => ({
        ...alt,
        position: p,
        angedockt: null,
        geparkt: { artikelId, absatz: nr },
        auswahl: { id: neueId("auswahl"), text: absatzEl.innerText.trim(), herkunft },
        bezug: "markierung",
      }));
      setAnsage(t("klaravorschau.figur.geparkt", { nr }));
      return;
    }
    const { rand, inZone } = naechsterRand(p, flaeche);
    aendere((alt) => ({
      ...alt,
      position: inZone ? angedocktePosition(rand, p.y, flaeche) : p,
      angedockt: inZone ? rand : null,
      geparkt: null,
    }));
    setAnsage(
      inZone
        ? t("klaravorschau.figur.angedockt", { rand: t(`klaravorschau.rand.${rand}`) })
        : t("klaravorschau.figur.verschoben"),
    );
  };

  const beiZeigerRunter = (e: PointerEvent<HTMLButtonElement>): void => {
    if (e.pointerType === "mouse" && e.button !== 0) {
      return;
    }
    zieh.current = { x: e.clientX, y: e.clientY, ursprung: position, gezogen: false };
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // Ohne Fang (z. B. ein bereits beendeter Zeiger) zieht Klara trotzdem, solange er über ihr ist.
    }
  };
  const beiZeigerBewegung = (e: PointerEvent<HTMLButtonElement>): void => {
    const z0 = zieh.current;
    if (!z0) {
      return;
    }
    const dx = e.clientX - z0.x;
    const dy = e.clientY - z0.y;
    if (!z0.gezogen && Math.hypot(dx, dy) < ZIEH_SCHWELLE) {
      return;
    }
    z0.gezogen = true;
    setZiehPos(klemme({ x: z0.ursprung.x + dx, y: z0.ursprung.y + dy }, flaeche));
  };
  const beiZeigerHoch = (e: PointerEvent<HTMLButtonElement>): void => {
    const z0 = zieh.current;
    zieh.current = null;
    if (z0?.gezogen) {
      gezogenAm.current = performance.now();
      const ziel = klemme(
        { x: z0.ursprung.x + (e.clientX - z0.x), y: z0.ursprung.y + (e.clientY - z0.y) },
        flaeche,
      );
      ablegen(ziel, e.clientX, e.clientY);
    }
    setZiehPos(null);
  };
  const beiZeigerAbbruch = (): void => {
    zieh.current = null;
    setZiehPos(null);
  };

  const positionZuruecksetzen = (): void => {
    aendere((alt) => ({ ...alt, position: null, angedockt: null, geparkt: null }));
    setAnsage(t("klaravorschau.figur.zurueckgesetzt"));
  };

  const beiFigurKlick = (e: ReactMouseEvent<HTMLButtonElement>): void => {
    // Ein Ziehen endet mit einem Klick-Ereignis — das öffnet NICHT das Gespräch. Ein Tastaturklick
    // (Eingabe/Leertaste, `detail === 0`) ist nie das Ende eines Ziehens.
    if (e.detail > 0 && performance.now() - gezogenAm.current < 400) {
      return;
    }
    if (panelSichtbar) {
      schliessen();
    } else {
      oeffnen();
    }
  };

  const beiFigurTaste = (e: KeyboardEvent<HTMLButtonElement>): void => {
    const schritt = e.shiftKey ? 64 : 16;
    const versatz: Record<string, [number, number]> = {
      ArrowLeft: [-schritt, 0],
      ArrowRight: [schritt, 0],
      ArrowUp: [0, -schritt],
      ArrowDown: [0, schritt],
    };
    const v = versatz[e.key];
    if (v) {
      e.preventDefault();
      const neu = klemme({ x: position.x + v[0], y: position.y + v[1] }, flaeche);
      aendere((alt) => ({ ...alt, position: neu, angedockt: null, geparkt: null }));
      setAnsage(t("klaravorschau.figur.verschoben"));
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      positionZuruecksetzen();
      return;
    }
    if (e.key === "Escape" && panelSichtbar) {
      e.preventDefault();
      schliessen();
    }
  };

  const andocken = (): void => {
    const { rand } = naechsterRand(position, flaeche);
    aendere((alt) => ({
      ...alt,
      position: angedocktePosition(rand, position.y, flaeche),
      angedockt: rand,
      geparkt: null,
    }));
    setAnsage(t("klaravorschau.figur.angedockt", { rand: t(`klaravorschau.rand.${rand}`) }));
  };

  // ---------------------------------------------------------------------------------------------
  // Markierung: „Klara fragen“ an der Auswahl, und Text auf Klara ziehen.
  // ---------------------------------------------------------------------------------------------
  const [auswahlKnopf, setAuswahlKnopf] = useState<AuswahlKnopf | null>(null);
  // Klara 03 · K2: Wer markiert und dann in Klara klickt oder tippt (Fokuswechsel), verliert die
  // Markierung auf der Seite — der Browser hebt sie auf. Klara merkt sich die zuletzt gesehene
  // Markierung samt Herkunft und bietet sie im Gespräch zur Übernahme an.
  const letzteMarkierung = useRef<AuswahlKnopf | null>(null);
  const [vorgemerkt, setVorgemerkt] = useState<AuswahlKnopf | null>(null);
  // K6: eine Vormerkung gehört dem Konto, unter dem markiert wurde.
  // biome-ignore lint/correctness/useExhaustiveDependencies: der Kontowechsel ist der Auslöser.
  useEffect(() => {
    letzteMarkierung.current = null;
    setVorgemerkt(null);
  }, [kontoId]);
  useEffect(() => {
    let uhr = 0;
    const pruefen = (): void => {
      const sel = window.getSelection();
      const text = sel?.toString().replace(/\s+/g, " ").trim() ?? "";
      if (!sel || sel.isCollapsed || sel.rangeCount === 0 || text.length < 2) {
        setAuswahlKnopf(null);
        const fokusInKlara = document.activeElement?.closest("[data-klara]") ?? null;
        if (fokusInKlara && letzteMarkierung.current) {
          setVorgemerkt(letzteMarkierung.current);
        }
        // Aufgehoben, weil auf der Seite weitergearbeitet wird: dann gilt die Markierung als verworfen.
        letzteMarkierung.current = null;
        return;
      }
      const anker = sel.anchorNode;
      const ankerEl = anker instanceof Element ? anker : (anker?.parentElement ?? null);
      if (ankerEl?.closest("[data-klara]")) {
        return;
      }
      const r = sel.getRangeAt(0).getBoundingClientRect();
      const neu: AuswahlKnopf = {
        x: r.left,
        y: r.bottom + 8,
        text,
        herkunft: herkunftFuer(anker, kontextRef.current, tRef.current),
      };
      letzteMarkierung.current = neu;
      setAuswahlKnopf(neu);
    };
    const spaeter = (): void => {
      window.clearTimeout(uhr);
      uhr = window.setTimeout(pruefen, 120);
    };
    document.addEventListener("selectionchange", spaeter);
    document.addEventListener("scroll", spaeter, true);
    return () => {
      window.clearTimeout(uhr);
      document.removeEventListener("selectionchange", spaeter);
      document.removeEventListener("scroll", spaeter, true);
    };
  }, []);

  const uebernehmeAuswahl = (text: string, herkunft: Herkunft): void => {
    aendere((alt) => ({
      ...alt,
      auswahl: { id: neueId("auswahl"), text: text.slice(0, 1200), herkunft },
      // Klara 03: wer bewusst eine Markierung übergibt, meint sie — der Bezug folgt sichtbar.
      bezug: "markierung",
      offen: true,
      minimiert: false,
    }));
    // Der Ausschnitt ist gemerkt; die Markierung auf der Seite darf gehen (sonst stünde der Knopf
    // „Klara fragen“ beim nächsten Scrollen wieder da).
    letzteMarkierung.current = null;
    setVorgemerkt(null);
    window.getSelection()?.removeAllRanges();
    setAuswahlKnopf(null);
    setFokusZiel("auswahl");
  };

  const ziehHerkunft = useRef<Herkunft | null>(null);
  useEffect(() => {
    const start = (e: DragEvent): void => {
      const sel = window.getSelection();
      ziehHerkunft.current = herkunftFuer(
        sel?.anchorNode ?? (e.target as Node | null),
        kontextRef.current,
        tRef.current,
      );
    };
    document.addEventListener("dragstart", start);
    return () => document.removeEventListener("dragstart", start);
  }, []);
  const [ablage, setAblage] = useState(false);
  const traegtText = (e: ReactDragEvent): boolean =>
    Array.from(e.dataTransfer?.types ?? []).includes("text/plain");
  const beiZiehenUeber = (e: ReactDragEvent<HTMLButtonElement>): void => {
    if (traegtText(e)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setAblage(true);
    }
  };
  const beiAblegen = (e: ReactDragEvent<HTMLButtonElement>): void => {
    setAblage(false);
    const text = e.dataTransfer.getData("text/plain").replace(/\s+/g, " ").trim();
    if (!text) {
      return;
    }
    e.preventDefault();
    uebernehmeAuswahl(text, ziehHerkunft.current ?? kontextRef.current);
    ziehHerkunft.current = null;
  };

  // ---------------------------------------------------------------------------------------------
  // Anfragen: sichtbar „läuft“, dann eine vorgefertigte Antwort — immer als Demo gekennzeichnet.
  // ---------------------------------------------------------------------------------------------
  const anfrage = (
    duText: string,
    aktion: Aktion,
    erzeugen: () => { text: string; vorschlag?: Vorschlag; entwurf?: Entwurf },
    fertig?: (antwort: string) => void,
    bezug?: Herkunft,
  ): void => {
    // Klara 02: ein gesprochener Auftrag bringt sein beim Sprechen bestätigtes Ziel mit.
    const herkunft = bezug ?? kontextRef.current;
    // Klara 01: im echten Betrieb ist Klaras eingebaute Hilfe (Seite erklären, Tutorial) Teil des
    // gespeicherten Gesprächs — gekennzeichnet als „Klarwerk-Hilfe · ohne KI“, nicht als Demo.
    if (leseZustand().betrieb === "echt" && aktion === "modus") {
      aendere((alt) => ({ ...alt, status: "laeuft" }));
      window.setTimeout(() => {
        const ergebnis = erzeugen();
        const fertig = (): void => aendere((alt) => ({ ...alt, status: "antwort" }));
        void echtHilfe(duText, ergebnis.text, objektbezugAus(herkunft)).finally(fertig);
      }, HILFE_TAKT_MS);
      return;
    }
    aendere((alt) => ({
      ...alt,
      status: "laeuft",
      verlauf: [
        ...alt.verlauf,
        { id: neueId("du"), von: "du", text: duText, herkunft, aktion, demo: false },
      ],
    }));
    window.setTimeout(() => {
      const ergebnis = erzeugen();
      aendere((alt) => {
        const verlauf: Nachricht[] = [
          ...alt.verlauf,
          {
            id: neueId("klara"),
            von: "klara",
            text: ergebnis.text,
            herkunft,
            aktion,
            demo: true,
            ...(ergebnis.vorschlag ? { vorschlag: ergebnis.vorschlag } : {}),
          },
        ];
        return {
          ...alt,
          verlauf,
          status: statusNachAntwort(verlauf),
          ...(ergebnis.entwurf ? { entwurf: ergebnis.entwurf } : {}),
        };
      });
      fertig?.(ergebnis.text);
    }, VERZOEGERUNG_MS);
  };

  const mitAuswahl = (aktion: "erklaeren" | "zusammenfassen" | "umformulieren" | "notiz"): void => {
    const a = z.auswahl;
    if (!a) {
      return;
    }
    const duText = t(ANFRAGE_TEXT[aktion], { auszug: kuerze(a.text, 60) });
    if (aktion === "notiz") {
      anfrage(duText, aktion, () => ({
        text: t("klaravorschau.antwort.notiz"),
        entwurf: {
          id: neueId("entwurf"),
          art: "notiz",
          inhalt: entwurfsInhalt(a),
          herkunft: a.herkunft,
          erinnerung: "",
          termin: "",
          gespeichert: false,
        },
      }));
      return;
    }
    anfrage(duText, aktion, () => antwortAufAuswahl(aktion, a, t, leseZustand().artikelText));
  };

  // ---------------------------------------------------------------------------------------------
  // Tutorial: „Erkläre mir das“, „Zeige mir den nächsten Schritt“, „Begleite die Durchführung“.
  // ---------------------------------------------------------------------------------------------
  const [einmalZeigen, setEinmalZeigen] = useState(false);
  const [tutorialHinweis, setTutorialHinweis] = useState<string | null>(null);
  const [treffer, setTreffer] = useState<ZielTreffer | null>(null);
  const trefferRef = useRef<ZielTreffer | null>(null);
  trefferRef.current = treffer;
  const lage = tutorial.lage;
  const zeigerAn = lage !== null && (z.begleiten || einmalZeigen);
  const zielName = lage?.zielName ?? null;
  const schrittId = lage?.schrittId ?? null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `schrittId` ist der Auslöser bei Schrittwechsel.
  useEffect(() => {
    if (!zeigerAn) {
      setTreffer(null);
      return;
    }
    const suchen = (): void => {
      const neu = findeZiel(zielName);
      setTreffer((alt) => (alt?.el === neu?.el && alt?.ort === neu?.ort ? alt : neu));
    };
    suchen();
    const uhr = window.setInterval(suchen, 400);
    return () => window.clearInterval(uhr);
  }, [zeigerAn, zielName, schrittId]);
  // Das gezeigte Element ins Bild holen, sobald es feststeht.
  useEffect(() => {
    if (treffer && typeof treffer.el.scrollIntoView === "function") {
      treffer.el.scrollIntoView({ block: "center", behavior: reduziert ? "auto" : "smooth" });
    }
  }, [treffer, reduziert]);
  // Ohne Tutorial (anderer Ort, geschlossen) gibt es nichts zu zeigen.
  useEffect(() => {
    if (!tutorial.offen) {
      setEinmalZeigen(false);
    }
  }, [tutorial.offen]);

  // ---------------------------------------------------------------------------------------------
  // Klara 03 · K4/K5: DER SCHRITT DER BEGLEITUNG ÜBERSTEHT DEN NEUAUFBAU DER HÜLLE.
  // ---------------------------------------------------------------------------------------------
  // Beim Breitenwechsel über 900 px montiert die Hülle Klara neu (`shell/AppShell.tsx`); der
  // Tutorialbereich in `<main>` steht in beiden Bäumen an derselben Stelle und behält seinen
  // Schritt (Nacharbeit 2, gemessen im Smoke). Nach einem NEULADEN dagegen steht das Tutorial
  // geschlossen da. Klara merkt sich deshalb den Schritt und öffnet es nach dem Einbau wieder — über
  // dieselben Befehle wie die Knöpfe des Tutorials („Weiter“), ohne zweiten Zähler. Schliesst die
  // Person das Tutorial selbst (oder verlässt sie die Seite), endet die Begleitung.
  const lageDefinition = lage?.definitionId ?? null;
  const lageIndex = lage?.schrittIndex ?? null;
  const lageSpielt = lage?.spielt ?? null;
  const wiederherstellen = useRef<{ ziel: number; spielt: boolean; definitionId: string } | null>(
    null,
  );
  useEffect(() => {
    if (!z.begleiten || lageDefinition === null || lageIndex === null || lageSpielt === null) {
      return;
    }
    if (wiederherstellen.current) {
      return; // während des Wiederherstellens zählt der gemerkte Stand, nicht die Zwischenschritte
    }
    aendere((alt) =>
      alt.begleitStand?.definitionId === lageDefinition &&
      alt.begleitStand.schrittIndex === lageIndex &&
      alt.begleitStand.spielt === lageSpielt
        ? alt
        : {
            ...alt,
            begleitStand: {
              definitionId: lageDefinition,
              schrittIndex: lageIndex,
              spielt: lageSpielt,
            },
          },
    );
  }, [z.begleiten, lageDefinition, lageIndex, lageSpielt]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: nur beim Einbau — danach gilt die Person.
  useEffect(() => {
    const s = leseZustand();
    if (!(s.begleiten && s.begleitStand && tutorial.vorhanden && !tutorial.offen)) {
      return;
    }
    wiederherstellen.current = {
      ziel: s.begleitStand.schrittIndex,
      spielt: s.begleitStand.spielt,
      definitionId: s.begleitStand.definitionId,
    };
    // Nacharbeit 2: NACH dem Einbau-Effekt des Rahmens öffnen. `TutorialProvider` schliesst beim
    // Einbau (Pfad-Effekt); Eltern-Effekte laufen nach denen der Kinder — ein sofortiges Öffnen
    // würde dort im selben Durchgang wieder überschrieben.
    const uhr = window.setTimeout(() => tutorial.oeffnen(), 0);
    return () => window.clearTimeout(uhr);
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: jede neue Lage ist der Auslöser.
  useEffect(() => {
    const w = wiederherstellen.current;
    if (!w || !lage) {
      return;
    }
    if (lage.definitionId !== w.definitionId) {
      wiederherstellen.current = null; // ein anderes Tutorial — nichts zu übertragen
      return;
    }
    if (lage.schrittIndex < w.ziel) {
      lage.weiter();
      return;
    }
    wiederherstellen.current = null;
    if (!w.spielt && lage.spielt) {
      lage.pause();
    }
    setTutorialHinweis(
      t("klarakontext.tutorial.wiederhergestellt", {
        nr: lage.schrittIndex + 1,
        titel: lage.schrittTitel,
      }),
    );
  }, [lage]);
  const tutorialWarOffen = useRef(tutorial.offen);
  useEffect(() => {
    if (tutorialWarOffen.current && !tutorial.offen && !wiederherstellen.current) {
      aendere((alt) =>
        alt.begleiten || alt.begleitStand ? { ...alt, begleiten: false, begleitStand: null } : alt,
      );
    }
    tutorialWarOffen.current = tutorial.offen;
  }, [tutorial.offen]);

  // Fehlklick während der Begleitung: freundlich sagen, was gerade gezeigt wird — nichts abfangen.
  useEffect(() => {
    if (!z.begleiten) {
      return;
    }
    const beiKlick = (e: MouseEvent): void => {
      const ziel = e.target as Element | null;
      if (!ziel || ziel.closest("[data-klara]")) {
        return;
      }
      const bedien = ziel.closest("button, a, input, textarea, select, [role='button']");
      if (!bedien) {
        return;
      }
      const inDemo = Boolean(ziel.closest("[data-tutorial-demo]"));
      if (ziel.closest('[data-testid="tutorial-bereich"]') && !inDemo) {
        return; // die Steuerung des Tutorials selbst
      }
      if (!inDemo && !ziel.closest('[data-testid="page-fragen"]')) {
        return;
      }
      const gezeigt = trefferRef.current?.el;
      if (gezeigt && (gezeigt === bedien || gezeigt.contains(ziel) || bedien.contains(gezeigt))) {
        return;
      }
      setTutorialHinweis(
        t("klaravorschau.tutorial.falschKlick", {
          teil: lageRef.current?.teilText ?? t("klaravorschau.tutorial.flaeche"),
        }),
      );
    };
    document.addEventListener("click", beiKlick, true);
    return () => document.removeEventListener("click", beiKlick, true);
  }, [z.begleiten, t]);

  const zeigeText = (l: TutorialFernLage | null): string => {
    if (!l) {
      return t("klaravorschau.modus.keinTutorial");
    }
    const gefunden = findeZiel(l.zielName);
    const teil = l.teilText ?? t("klaravorschau.tutorial.flaeche");
    const schritt = t("klaravorschau.tutorial.schritt", {
      nr: l.schrittIndex + 1,
      gesamt: l.schrittAnzahl,
      titel: l.schrittTitel,
    });
    if (!gefunden) {
      return `${schritt}. ${t("klaravorschau.tutorial.fehlzielGanz", { ziel: teil })}`;
    }
    if (gefunden.ort === "demo" && l.zielName) {
      return `${schritt}. ${t("klaravorschau.tutorial.fehlzielDemo", { ziel: teil })}`;
    }
    return `${schritt}. ${t("klaravorschau.tutorial.zeigt", {
      teil,
      ort: t("klaravorschau.tutorial.ortEcht"),
    })}`;
  };

  const erklaere = (): void => {
    const l = lageRef.current;
    anfrage(t("klaravorschau.modus.erklaere"), "modus", () => {
      if (l) {
        const schritt = t("klaravorschau.tutorial.schritt", {
          nr: l.schrittIndex + 1,
          gesamt: l.schrittAnzahl,
          titel: l.schrittTitel,
        });
        return { text: `${schritt}\n${l.schrittText}` };
      }
      const k = kontextRef.current;
      const artikel = k.seite === "artikel" ? demoArtikel(k.artikelId) : null;
      const erklaerung = artikel
        ? `${artikel.titel} – ${artikel.kurz}`
        : k.seite === "uebersicht"
          ? t("klaravorschau.vorschauseite.intro")
          : (seitenErklaerung(k.pfad, t) ?? t("klaravorschau.objekt.keins"));
      return { text: t("klaravorschau.modus.erklaereSeite", { seite: k.seitenName, erklaerung }) };
    });
  };

  const zeige = (): void => {
    if (tutorial.vorhanden && !tutorial.offen) {
      tutorial.oeffnen();
    }
    setEinmalZeigen(tutorial.vorhanden);
    setTutorialHinweis(null);
    anfrage(t("klaravorschau.modus.zeige"), "modus", () => ({ text: zeigeText(lageRef.current) }));
  };

  const begleite = (): void => {
    if (tutorial.vorhanden && !tutorial.offen) {
      tutorial.oeffnen();
    }
    if (tutorial.vorhanden) {
      aendere((alt) => ({ ...alt, begleiten: true }));
    }
    setTutorialHinweis(null);
    anfrage(t("klaravorschau.modus.begleite"), "modus", () => ({
      text: zeigeText(lageRef.current),
    }));
  };

  const pausieren = (): void => {
    const l = lageRef.current;
    if (!l) {
      return;
    }
    l.pause();
    setTutorialHinweis(
      t("klaravorschau.tutorial.pausiert", { nr: l.schrittIndex + 1, titel: l.schrittTitel }),
    );
  };
  const fortsetzen = (): void => {
    const l = lageRef.current;
    if (!l) {
      return;
    }
    l.fortsetzen();
    setTutorialHinweis(
      t("klaravorschau.tutorial.fortgesetzt", { nr: l.schrittIndex + 1, titel: l.schrittTitel }),
    );
  };
  const begleitungBeenden = (): void => {
    aendere((alt) => ({ ...alt, begleiten: false, begleitStand: null }));
    setEinmalZeigen(false);
    setTutorialHinweis(t("klaravorschau.tutorial.beendet"));
  };

  // ---------------------------------------------------------------------------------------------
  // Freie Frage — während eines Tutorials eine ZWISCHENFRAGE: das Tutorial hält am selben Schritt.
  // ---------------------------------------------------------------------------------------------
  const [eingabe, setEingabe] = useState("");
  // Klara 01: eine Frage im echten Betrieb geht nur mit gelesenem Gespräch und gespeicherter
  // Einwilligung, nicht bei abgeschalteter KI und nicht, solange eine andere läuft.
  const echtSendebereit =
    Boolean(echt.gespraech?.einwilligungAm) &&
    !ki.abgeschaltet &&
    echt.laeuftSeit === null &&
    echt.laden === "bereit";
  // Klaras Hilfe wird im echten Betrieb Teil des Gesprächs — erst, wenn es gelesen ist.
  const hilfeGesperrt = istEcht && echt.laden !== "bereit";
  // Klara 02: „Antworten automatisch vorlesen“ — nur, wenn die Person es eingeschaltet hat.
  const autoVorlesen = (id: string, text: string | null): void => {
    if (text && leseVorlesen().auto) {
      vorlesenStarten(id, text, i18n.language);
    }
  };
  // Klara 03 · K6: warum eine Markierung gerade nicht an den Frageweg darf — oder `null`.
  const [auswahlSperre, setAuswahlSperre] = useState<{ id: string; text: string } | null>(null);
  const pruefungLaeuft = useRef(false);
  /**
   * Eine Frage im echten Betrieb.
   *   · `art`: die getippte/gesprochene Frage oder eine Aktion mit der Markierung (Klara 03);
   *   · `fest`: „Erneut fragen“ — der gespeicherte Wortlaut mit dem Bezug von damals, unverändert;
   *   · `ziel` (Klara 02): der Ort, auf den sich die Frage bezieht. Getippte Fragen nehmen den
   *     aktuellen Ort; ein gesprochener Auftrag gibt das Ziel mit, das seine Karte zeigt — Anzeige und
   *     Gesprächsbezug sind damit dasselbe, auch nach einem Seitenwechsel zwischen Sprechen und Senden.
   *
   * Klara 03 · K6: Geht die Markierung mit, prüft Klara sie VORHER gegen den heutigen Stand und die
   * heutigen Rechte (`pruefeAuswahl`). Unsichtbar, vertraulich oder nicht mehr im Text: es geht
   * nichts an den Frageweg, und der Grund steht an der Markierung.
   */
  const echtFrage = (
    eingabeText: string,
    optionen: {
      art?: KontextAktion | "frage";
      fest?: { text: string; bezug: KlaraObjektbezug };
      ziel?: Herkunft;
    } = {},
  ): Promise<Absendeergebnis> => {
    const { art = "frage", fest, ziel } = optionen;
    if (!echtSendebereit || pruefungLaeuft.current) {
      return Promise.resolve({ stand: "nicht_gesendet", antwort: null });
    }
    if (lageRef.current) {
      pausieren();
    }
    aendere((alt) => ({ ...alt, status: "laeuft" }));
    const sprache = toReasonerLocale(i18n.language);
    const z0 = leseZustand();
    const auswahlJetzt = z0.auswahl;
    const mitMarkierung =
      !fest &&
      auswahlJetzt !== null &&
      (art !== "frage" || wirksamerBezug(z0.bezug, auswahlJetzt) === "markierung");
    pruefungLaeuft.current = true;
    return (async (): Promise<Absendeergebnis> => {
      try {
        if (mitMarkierung && auswahlJetzt) {
          const grund = sperrgrund(await pruefeAuswahl(auswahlJetzt), t);
          if (grund) {
            setAuswahlSperre({ id: auswahlJetzt.id, text: grund });
            setAnsage(grund);
            aendere((alt) => ({ ...alt, status: "ruhe" }));
            return { stand: "nicht_gesendet", antwort: null };
          }
          setAuswahlSperre(null);
        }
        // Der Ort der Frage: das Ziel eines gesprochenen Auftrags oder die aktuelle Seite.
        const kontextJetzt = ziel ?? kontextRef.current;
        const text =
          fest?.text ?? frageText(art, eingabeText, z0.bezug, kontextJetzt, auswahlJetzt, t);
        const gewaehlt = art === "frage" ? z0.bezug : "markierung";
        // Nacharbeit 5: der gewählte Seiten-/Objektkontext geht MIT an den Frageweg — der Server
        // löst das Objekt unter den Rechten auf. Frei: keiner.
        // Nacharbeit 6: „Erneut fragen“ nimmt GENAU den damals gesendeten Seitenbezug (am
        // gespeicherten Objektbezug), und jede neue Frage hält ihren Seitenbezug dort fest.
        const seitenbezug = fest
          ? seitenbezugAusObjektbezug(fest.bezug)
          : seitenbezugFuer(gewaehlt, kontextJetzt, auswahlJetzt);
        const bezug =
          fest?.bezug ??
          mitSeitenbezug(objektbezugFuer(gewaehlt, kontextJetzt, auswahlJetzt), seitenbezug);
        pruefungLaeuft.current = false;
        const stand = await echtFragen(text, bezug, sprache, t, seitenbezug);
        if (stand === "veraltet") {
          // Kontowechsel während der Frage: nichts mehr ansagen, nichts mehr zeigen.
          aendere((alt) => ({ ...alt, status: "ruhe" }));
          return { stand: "nicht_gesendet", antwort: null };
        }
        aendere((alt) => ({ ...alt, status: "antwort" }));
        setAnsage(t(`klaragespraech.ansage.${stand}`));
        const letzte = [...leseEcht().nachrichten].reverse().find((n) => n.von === "klara");
        const antwort = letzte?.text ?? null;
        if (letzte) {
          autoVorlesen(letzte.id, antwort);
        }
        return { stand, antwort };
      } finally {
        pruefungLaeuft.current = false;
      }
    })();
  };

  // Klara 03: Erklären, Zusammenfassen und Übersetzen mit der Markierung im ECHTEN Betrieb.
  const [zielsprache, setZielsprache] = useState<Zielsprache>(() => {
    const ui = toReasonerLocale(i18n.language);
    return ui === "de" ? "en" : ui;
  });
  const mitAuswahlEcht = (aktion: KontextAktion | "uebersetzen"): void => {
    const a = leseZustand().auswahl;
    if (!a) {
      return;
    }
    if (aktion !== "uebersetzen") {
      void echtFrage("", { art: aktion });
      return;
    }
    // Übersetzen geht an keine KI: Klara zeigt die vorhandene Leseübersetzung (Klarwerk-Hilfe).
    if (hilfeGesperrt) {
      return;
    }
    aendere((alt) => ({ ...alt, status: "laeuft" }));
    const bitte = t("klarakontext.uebersetzen.bitte", {
      sprache: t(`klarakontext.sprache.${zielsprache}`),
      auszug: kuerze(a.text, 60),
    });
    const bezug = objektbezugFuer("markierung", kontextRef.current, a);
    void uebersetzung(a, zielsprache, t)
      .then((antwort) => echtHilfe(bitte, antwort, bezug))
      .finally(() => aendere((alt) => ({ ...alt, status: "antwort" })));
  };
  /**
   * EIN Weg für getippte und gesprochene Fragen (Klara 02): im echten Betrieb der Frageweg mit
   * Einwilligung, im Demo-Betrieb die vorgefertigte, gekennzeichnete Antwort.
   */
  const fragenSenden = (frage: string, ziel?: Herkunft): Promise<Absendeergebnis> => {
    if (istEcht) {
      return echtFrage(frage, ziel ? { ziel } : {});
    }
    const l = lageRef.current;
    if (l) {
      pausieren();
    }
    return new Promise((fertig) => {
      anfrage(
        frage,
        "frage",
        () => ({ text: antwortAufFrage(frage, ziel ?? kontextRef.current, t, l) }),
        (antwort) => {
          autoVorlesen(`demo-${Date.now()}`, antwort);
          fertig({ stand: "demo", antwort });
        },
        ziel,
      );
    });
  };
  /** Ein gesprochener Auftrag: gesendet mit GENAU dem Ziel, das seine Karte zeigt. */
  const auftragSenden = (text: string, ziel: SprachZiel): Promise<Absendeergebnis> =>
    fragenSenden(text, ziel.herkunft);
  const senden = (e: FormEvent): void => {
    e.preventDefault();
    const frage = eingabe.trim();
    if (!frage) {
      return;
    }
    if (istEcht && !echtSendebereit) {
      return;
    }
    setEingabe("");
    void fragenSenden(frage);
  };

  // Klara 02: Diktieren füllt das Eingabefeld, „Auftrag sprechen“ zeigt die Karte mit Ziel.
  const objektLeer = [
    t("klaravorschau.objekt.keins"),
    t("klaravorschau.objekt.keineFrage"),
    t("klaravorschau.objekt.neuerEntwurf"),
  ];
  const sprechen = useKlaraSprache({
    setzeEingabe: setEingabe,
    ziel: (): SprachZiel => {
      const k = kontextRef.current;
      return {
        seitenName: k.seitenName,
        objekt: k.objekt,
        bekannt: !objektLeer.includes(k.objekt),
        herkunft: k,
      };
    },
  });
  const sprachSendebereit = istEcht ? echtSendebereit : z.status !== "laeuft";
  // Geschlossen oder verkleinert hört Klara nicht mehr zu — kein Mikrofon ohne sichtbaren Stopp.
  const aufnahmeAbbrechen = sprechen.abbrechen;
  useEffect(() => {
    if (!panelSichtbar) {
      aufnahmeAbbrechen();
    }
  }, [panelSichtbar, aufnahmeAbbrechen]);

  // ---------------------------------------------------------------------------------------------
  // Vollbild, Ende der Vorschau.
  // ---------------------------------------------------------------------------------------------
  const vollbildUmschalten = (): void => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.()?.catch(() => {});
    } else {
      document.documentElement.requestFullscreen?.()?.catch(() => {});
    }
  };
  const vorschauBeenden = (): void => {
    // Eine laufende echte Anfrage endet mit Klara; das gespeicherte Gespräch bleibt am Server.
    echtStoppen();
    stoppeVorlesen();
    if (document.fullscreenElement) {
      document.exitFullscreen?.()?.catch(() => {});
    }
    zuruecksetzenGanz();
    setzeKlaraVorschauAktiv(false);
    if (location.pathname.startsWith(VORSCHAU_PFAD)) {
      navigate(HOME_ROUTE);
    }
  };

  // Verlauf: das Neueste ins Bild.
  const endeRef = useRef<HTMLDivElement | null>(null);
  const anzahlNachrichten = istEcht ? echt.nachrichten.length : z.verlauf.length;
  useEffect(() => {
    if (anzahlNachrichten > 0 && typeof endeRef.current?.scrollIntoView === "function") {
      endeRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [anzahlNachrichten]);

  // ---------------------------------------------------------------------------------------------
  // Lage des Gesprächs: kompakt neben der Figur, seitlich am rechten Rand, schmal als Blatt unten
  // (über der Bildschirmtastatur).
  // ---------------------------------------------------------------------------------------------
  const groesse = z.minimiert ? MINI_GROESSE : FIGUR_GROESSE;
  let panelStil: CSSProperties;
  if (schmal) {
    panelStil = {
      left: 0,
      right: 0,
      bottom: fenster.unten,
      maxHeight: Math.round(fenster.hoehe * (z.ansicht === "seitlich" ? 0.85 : 0.6)),
    };
  } else if (z.ansicht === "seitlich") {
    panelStil = { right: 0, top: 0, bottom: 0, width: SEITLICH_BREITE };
  } else {
    const links =
      position.x - PANEL_BREITE - 12 >= 8
        ? position.x - PANEL_BREITE - 12
        : Math.max(8, Math.min(position.x + FIGUR_GROESSE + 12, fenster.breite - PANEL_BREITE - 8));
    const untenHaelfte = position.y + FIGUR_GROESSE / 2 > fenster.hoehe / 2;
    panelStil = untenHaelfte
      ? {
          left: links,
          bottom: Math.max(8, window.innerHeight - (position.y + FIGUR_GROESSE)),
          maxHeight: Math.min(fenster.hoehe - 16, Math.max(260, position.y + FIGUR_GROESSE - 16)),
          width: PANEL_BREITE,
        }
      : {
          left: links,
          top: position.y,
          maxHeight: Math.min(fenster.hoehe - 16, Math.max(260, fenster.hoehe - position.y - 16)),
          width: PANEL_BREITE,
        };
  }

  const panelForm = schmal
    ? "rounded-t-card"
    : z.ansicht === "seitlich"
      ? "border-y-0 border-r-0"
      : "rounded-card";
  const auswahl = z.auswahl;
  const auswahlAndereSeite = auswahl !== null && auswahl.herkunft.pfad !== location.pathname;
  const zeigeBegleitung = lage !== null && (z.begleiten || einmalZeigen);

  const inhalt = (
    <>
      {/* ------------------------------------------------------------------ die Figur */}
      <div
        data-klara="1"
        data-testid="klara-figur-huelle"
        className="fixed z-[60] flex flex-col items-center"
        style={{ left: position.x, top: position.y, width: FIGUR_GROESSE }}
      >
        <button
          ref={figurRef}
          type="button"
          data-testid="klara-figur"
          data-status={z.status}
          data-betrieb={z.betrieb}
          data-minimiert={z.minimiert ? "true" : "false"}
          data-angedockt={z.angedockt ?? ""}
          data-geparkt={z.geparkt ? String(z.geparkt.absatz) : ""}
          data-ablage={ablage ? "true" : "false"}
          data-bewegung={assistenz.bewegungReduziert ? "reduziert" : "standard"}
          aria-label={t("klaravorschau.figur.label")}
          aria-expanded={panelSichtbar}
          aria-describedby={hinweisId}
          onPointerDown={beiZeigerRunter}
          onPointerMove={beiZeigerBewegung}
          onPointerUp={beiZeigerHoch}
          onPointerCancel={beiZeigerAbbruch}
          onClick={beiFigurKlick}
          onKeyDown={beiFigurTaste}
          onDragOver={beiZiehenUeber}
          onDragLeave={() => setAblage(false)}
          onDrop={beiAblegen}
          title={ablage ? t("klaravorschau.figur.ablegen") : t("klaravorschau.figur.label")}
          className={`klara-figur grid place-items-center overflow-hidden rounded-full border-2 border-brand bg-surface shadow-popover focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ink ${
            ziehPos ? "cursor-grabbing" : "cursor-grab"
          }`}
          style={{ width: groesse, height: groesse }}
        >
          <AvatarBild
            motiv={assistenz.motiv}
            alt=""
            ersatzBeschriftung=""
            width={groesse}
            height={groesse}
            testId="klara-avatar"
            className="pointer-events-none h-full w-full"
          />
        </button>
        {z.status !== "ruhe" ? (
          <span
            data-testid="klara-figur-status"
            className={`mt-1 whitespace-nowrap rounded-pill px-2 py-0.5 text-[10.5px] font-semibold shadow-tile ${
              z.status === "entscheidung"
                ? "bg-brand text-ink"
                : z.status === "laeuft"
                  ? "bg-ai-surface-1 text-ai"
                  : "bg-ink text-page"
            }`}
          >
            {t(STATUS_TEXT[z.status])}
          </span>
        ) : null}
        {/* Klara 01: der Demo-Betrieb ist auch an der geschlossenen Figur zu erkennen. */}
        {!istEcht ? (
          <span
            data-testid="klara-figur-demo"
            className={`mt-1 whitespace-nowrap shadow-tile ${DEMO_SCHILD}`}
          >
            {t("klaragespraech.betrieb.demo")}
          </span>
        ) : null}
        {z.geparkt && parkAbsatz ? (
          <span
            data-testid="klara-geparkt"
            className="mt-1 whitespace-nowrap rounded-pill bg-surface px-2 py-0.5 text-[10.5px] text-muted shadow-tile"
          >
            {t("klaravorschau.figur.geparkt", { nr: z.geparkt.absatz })}
          </span>
        ) : null}
        <span id={hinweisId} className="sr-only">
          {t("klaravorschau.figur.tastatur")} {t(STATUS_TEXT[z.status])}{" "}
          {istEcht ? t("klaragespraech.betrieb.echtKurz") : t("klaragespraech.betrieb.demoKurz")}
        </span>
      </div>
      <output data-klara="1" className="sr-only" data-testid="klara-ansage">
        {ansage}
      </output>

      {/* ------------------------------------------------------------------ „Klara fragen“ */}
      {auswahlKnopf ? (
        <button
          type="button"
          data-klara="1"
          data-testid="klara-auswahl-knopf"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => uebernehmeAuswahl(auswahlKnopf.text, auswahlKnopf.herkunft)}
          className="fixed z-[61] inline-flex h-8 items-center gap-1.5 rounded-pill border border-brand bg-ink px-3 text-[12px] font-semibold text-page shadow-popover focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          style={{
            left: Math.max(8, Math.min(auswahlKnopf.x, fenster.breite - 160)),
            top: Math.max(8, Math.min(auswahlKnopf.y, fenster.hoehe - 48)),
          }}
        >
          <AvatarBild
            motiv={assistenz.motiv}
            alt=""
            ersatzBeschriftung=""
            className="h-5 w-5 rounded-full bg-surface"
          />
          {t("klaravorschau.auswahl.knopf")}
        </button>
      ) : null}

      {zeigeBegleitung && panelSichtbar ? <KlaraZeiger treffer={treffer} /> : null}

      {/* ------------------------------------------------------------------ das Gespräch */}
      {panelSichtbar ? (
        <section
          data-klara="1"
          data-testid="klara-gespraech"
          data-ansicht={z.ansicht}
          aria-labelledby={`${hinweisId}-titel`}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              schliessen();
            }
          }}
          className={`fixed z-[59] flex flex-col overflow-hidden border border-hairline bg-surface shadow-popover ${panelForm}`}
          style={panelStil}
        >
          {/* Kopf */}
          <div className="flex items-start justify-between gap-2 border-b border-hairline px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <AvatarBild
                motiv={assistenz.motiv}
                alt=""
                ersatzBeschriftung=""
                testId="klara-gespraech-avatar"
                className="h-8 w-8 shrink-0 rounded-full"
              />
              <div className="min-w-0">
                <h2
                  id={`${hinweisId}-titel`}
                  ref={panelTitelRef}
                  tabIndex={-1}
                  className="text-[14px] font-semibold text-ink outline-none focus-visible:underline"
                >
                  {t("klaravorschau.panel.titel")}
                </h2>
                {assistenz.avatarFehlt ? (
                  <p data-testid="klara-avatar-fehlt" className="text-[11.5px] text-text">
                    {t("assistenz.avatar.fehlt")}
                  </p>
                ) : null}
                <p className={KLEINTITEL}>
                  {istEcht ? t("klaragespraech.untertitel") : t("klaravorschau.panel.untertitel")}
                </p>
                <p
                  data-testid="klara-status-text"
                  data-status={z.status}
                  aria-live="polite"
                  className="text-[11.5px] font-semibold text-text"
                >
                  {t(STATUS_TEXT[z.status])}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-1">
              <button
                type="button"
                data-testid="klara-ansicht"
                onClick={() =>
                  aendere((alt) => ({
                    ...alt,
                    ansicht: alt.ansicht === "seitlich" ? "kompakt" : "seitlich",
                  }))
                }
                className={KNOPF}
              >
                {z.ansicht === "seitlich"
                  ? t("klaravorschau.knopf.kompakt")
                  : t("klaravorschau.knopf.seitlich")}
              </button>
              <button
                type="button"
                data-testid="klara-minimieren"
                onClick={minimieren}
                className={KNOPF}
              >
                {t("klaravorschau.knopf.minimieren")}
              </button>
              <button
                type="button"
                data-testid="klara-schliessen"
                onClick={schliessen}
                className={KNOPF}
              >
                {t("klaravorschau.knopf.schliessen")}
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {/* Klara 01: echter Betrieb oder Demo — sichtbar und umschaltbar. */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="sr-only">{t("klaragespraech.betrieb.label")}</span>
              <span
                data-testid="klara-betrieb"
                data-betrieb={z.betrieb}
                className={
                  istEcht
                    ? "rounded-pill border border-ai bg-ai-surface-1 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-ai"
                    : DEMO_SCHILD
                }
              >
                {istEcht
                  ? t("klaragespraech.betrieb.echtKurz")
                  : t("klaragespraech.betrieb.demoKurz")}
              </span>
              <button
                type="button"
                data-testid="klara-betrieb-echt"
                aria-pressed={istEcht}
                onClick={() => aendere((alt) => ({ ...alt, betrieb: "echt" }))}
                className={KNOPF}
              >
                {t("klaragespraech.betrieb.echt")}
              </button>
              <button
                type="button"
                data-testid="klara-betrieb-demo"
                aria-pressed={!istEcht}
                disabled={echt.laeuftSeit !== null}
                onClick={() => aendere((alt) => ({ ...alt, betrieb: "demo" }))}
                className={KNOPF}
              >
                {t("klaragespraech.betrieb.demo")}
              </button>
            </div>
            {!istEcht ? (
              <p
                data-testid="klara-demo-hinweis"
                className="rounded-btn bg-trust-warn-bg px-2.5 py-1.5 text-[11.5px] leading-relaxed text-trust-warn-text"
              >
                {t("klaravorschau.panel.demoHinweis")}
              </p>
            ) : null}

            {/* Du bist hier */}
            <dl data-testid="klara-ort" className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
              <dt className={KLEINTITEL}>{t("klaravorschau.ort.label")}</dt>
              <dd data-testid="klara-ort-seite" className="text-[12.5px] font-semibold text-text">
                {kontext.seitenName}
              </dd>
              <dt className={KLEINTITEL}>{t("klaravorschau.ort.objekt")}</dt>
              <dd data-testid="klara-ort-objekt" className="text-[12.5px] text-text">
                {kontext.objekt}
              </dd>
              {/* Klara 03: Fassung, Prüfstatus und Modus — aus dem Appzustand, nur wenn bekannt. */}
              {kontext.fassung ? (
                <>
                  <dt className={KLEINTITEL}>{t("klarakontext.ort.fassung")}</dt>
                  <dd data-testid="klara-ort-fassung" className="text-[12.5px] text-text">
                    {t("klarakontext.fassung", { nr: kontext.fassung })}
                  </dd>
                </>
              ) : null}
              {kontext.pruefstatus ? (
                <>
                  <dt className={KLEINTITEL}>{t("klarakontext.ort.pruefstatus")}</dt>
                  <dd
                    data-testid="klara-ort-pruefstatus"
                    data-pruefstatus={kontext.pruefstatus}
                    className="text-[12.5px] text-text"
                  >
                    {t(`klarakontext.pruefstatus.${kontext.pruefstatus}`)}
                  </dd>
                </>
              ) : null}
              {kontext.modus ? (
                <>
                  <dt className={KLEINTITEL}>{t("klarakontext.ort.modus")}</dt>
                  <dd
                    data-testid="klara-ort-modus"
                    data-modus={kontext.modus}
                    className="text-[12.5px] text-text"
                  >
                    {t(`klarakontext.modus.${kontext.modus}`)}
                    {kontext.lesart === "uebersetzung"
                      ? ` · ${t("klarakontext.lesart.uebersetzung")}`
                      : ""}
                  </dd>
                </>
              ) : null}
            </dl>

            {/* Klara 03 · K1: der Bezug der nächsten Frage — sichtbar und umschaltbar. */}
            <section
              data-testid="klara-bezug"
              data-bezug={wirksamerBezug(z.bezug, auswahl)}
              aria-label={t("klarakontext.bezug.label")}
              className="rounded-card border border-hairline bg-page px-3 py-2"
            >
              <p className={KLEINTITEL}>{t("klarakontext.bezug.label")}</p>
              <p data-testid="klara-bezug-zeile" className="text-[12.5px] font-semibold text-ink">
                {bezugZeile(z.bezug, kontext, auswahl, t)}
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {BEZUG_KNOEPFE.map((b) => (
                  <button
                    key={b}
                    type="button"
                    data-testid={`klara-bezug-${b}`}
                    aria-pressed={wirksamerBezug(z.bezug, auswahl) === b}
                    disabled={b === "markierung" && !auswahl}
                    onClick={() => {
                      aendere((alt) => ({ ...alt, bezug: b }));
                      setAnsage(
                        t("klarakontext.bezug.gewechselt", {
                          bezug: bezugZeile(b, kontext, auswahl, t),
                        }),
                      );
                    }}
                    className={KNOPF}
                  >
                    {t(`klarakontext.bezug.knopf.${b}`)}
                  </button>
                ))}
              </div>
              <p data-testid="klara-aktionen-moeglich" className="mt-1.5 text-[11.5px] text-muted">
                {t("klarakontext.aktionen.label")}{" "}
                {moeglicheAktionen({
                  kontext,
                  auswahl,
                  echt: istEcht,
                  sendebereit: echtSendebereit,
                  tutorialVorhanden: tutorial.vorhanden,
                })
                  .map((a) => t(`klarakontext.aktionen.${a}`))
                  .join(" · ") || t("klarakontext.aktionen.keine")}
              </p>
            </section>

            {/* Markierter Ausschnitt */}
            {auswahl ? (
              <section
                data-testid="klara-auswahl"
                data-seite={auswahl.herkunft.seite}
                className="rounded-card border border-hairline bg-page px-3 py-2.5"
              >
                <h3
                  data-testid="klara-auswahl-titel"
                  tabIndex={-1}
                  className="text-[12px] font-semibold text-ink outline-none focus-visible:underline"
                >
                  {t("klaravorschau.auswahl.titel")}
                </h3>
                <blockquote
                  data-testid="klara-auswahl-text"
                  className="mt-1 max-h-28 overflow-y-auto border-l-2 border-brand pl-2 text-[12px] italic leading-relaxed text-text"
                >
                  {auswahl.text}
                </blockquote>
                <p data-testid="klara-auswahl-herkunft" className="mt-1 text-[11.5px] text-muted">
                  {herkunftZeile(auswahl.herkunft, t)}
                </p>
                {auswahlAndereSeite ? (
                  <p
                    data-testid="klara-auswahl-andere-seite"
                    className="mt-1 text-[11.5px] text-muted-2"
                  >
                    {t("klaravorschau.auswahl.andereSeite", {
                      seite: auswahl.herkunft.seitenName,
                      objekt: auswahl.herkunft.objekt,
                    })}{" "}
                    <Link
                      to={herkunftZiel(auswahl.herkunft)}
                      className="font-semibold text-brand-text hover:underline"
                    >
                      {t("klaravorschau.auswahl.zurHerkunft")}
                    </Link>
                  </p>
                ) : null}
                {auswahlSperre && auswahlSperre.id === auswahl.id ? (
                  <p
                    role="alert"
                    data-testid="klara-auswahl-gesperrt"
                    className="mt-1 rounded-btn bg-trust-warn-bg px-2 py-1 text-[11.5px] leading-relaxed text-trust-warn-text"
                  >
                    {auswahlSperre.text}
                  </p>
                ) : null}
                <p className={`${KLEINTITEL} mt-2`}>{t("klaravorschau.aktion.label")}</p>
                {istEcht ? (
                  <>
                    <p
                      data-testid="klara-auswahl-hinweis"
                      className="mt-1 text-[11.5px] leading-relaxed text-muted"
                    >
                      {t("klarakontext.auswahl.hinweis")}
                    </p>
                    <p
                      data-testid="klara-aktion-nur-demo"
                      className="mt-1 text-[11.5px] leading-relaxed text-muted-2"
                    >
                      {t("klaragespraech.aktionHinweis")}
                    </p>
                  </>
                ) : null}
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {istEcht ? (
                    <>
                      {(["erklaeren", "zusammenfassen"] as const).map((a) => (
                        <button
                          key={a}
                          type="button"
                          data-testid={`klara-aktion-${a}`}
                          disabled={!echtSendebereit || z.status === "laeuft"}
                          onClick={() => mitAuswahlEcht(a)}
                          className={KNOPF_KI}
                        >
                          {t(`klaravorschau.aktion.${a}`)}
                        </button>
                      ))}
                      <span className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          data-testid="klara-aktion-uebersetzen"
                          disabled={hilfeGesperrt || z.status === "laeuft"}
                          onClick={() => mitAuswahlEcht("uebersetzen")}
                          className={KNOPF}
                        >
                          {t("klarakontext.aktion.uebersetzen")}
                        </button>
                        <label className="sr-only" htmlFor={`${eingabeId}-sprache`}>
                          {t("klarakontext.uebersetzen.zielsprache")}
                        </label>
                        <select
                          id={`${eingabeId}-sprache`}
                          data-testid="klara-uebersetzen-sprache"
                          value={zielsprache}
                          onChange={(e) => setZielsprache(e.target.value as Zielsprache)}
                          className="h-8 rounded-input border border-hairline bg-surface px-1.5 text-[12px] text-text"
                        >
                          {ZIELSPRACHEN.map((s) => (
                            <option key={s} value={s}>
                              {t(`klarakontext.sprache.${s}`)}
                            </option>
                          ))}
                        </select>
                      </span>
                    </>
                  ) : (
                    (["erklaeren", "zusammenfassen", "umformulieren", "notiz"] as const).map(
                      (a) => (
                        <button
                          key={a}
                          type="button"
                          data-testid={`klara-aktion-${a}`}
                          disabled={z.status === "laeuft"}
                          onClick={() => mitAuswahl(a)}
                          className={KNOPF_KI}
                        >
                          {t(`klaravorschau.aktion.${a}`)}
                        </button>
                      ),
                    )
                  )}
                  <button
                    type="button"
                    data-testid="klara-auswahl-entfernen"
                    onClick={() => {
                      setAuswahlSperre(null);
                      aendere((alt) => ({
                        ...alt,
                        auswahl: null,
                        bezug: alt.bezug === "markierung" ? "seite" : alt.bezug,
                      }));
                    }}
                    className={KNOPF}
                  >
                    {t("klaravorschau.auswahl.entfernen")}
                  </button>
                </div>
              </section>
            ) : (
              <p
                data-testid="klara-auswahl-leer"
                className="text-[11.5px] leading-relaxed text-muted-2"
              >
                {t("klaravorschau.auswahl.leer")}
              </p>
            )}

            {/* Klara 03 · K2: die beim Fokuswechsel aufgehobene Markierung — mit ihrer Herkunft. */}
            {vorgemerkt && vorgemerkt.text !== auswahl?.text ? (
              <section
                data-testid="klara-vorgemerkt"
                className="rounded-card border border-dashed border-hairline px-3 py-2"
              >
                <p className={KLEINTITEL}>{t("klarakontext.vorgemerkt.titel")}</p>
                <blockquote className="mt-1 max-h-16 overflow-y-auto border-l-2 border-brand/50 pl-2 text-[12px] italic text-text">
                  {kuerze(vorgemerkt.text, 160)}
                </blockquote>
                <p
                  data-testid="klara-vorgemerkt-herkunft"
                  className="mt-1 text-[11.5px] text-muted"
                >
                  {herkunftZeile(vorgemerkt.herkunft, t)}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    data-testid="klara-vorgemerkt-uebernehmen"
                    onClick={() => uebernehmeAuswahl(vorgemerkt.text, vorgemerkt.herkunft)}
                    className={KNOPF_KI}
                  >
                    {t("klarakontext.vorgemerkt.uebernehmen")}
                  </button>
                  <button
                    type="button"
                    data-testid="klara-vorgemerkt-verwerfen"
                    onClick={() => setVorgemerkt(null)}
                    className={KNOPF}
                  >
                    {t("klarakontext.vorgemerkt.verwerfen")}
                  </button>
                </div>
              </section>
            ) : null}

            {/* Hilfe zur Seite: erklären, zeigen, begleiten */}
            <section data-testid="klara-modi" aria-label={t("klaravorschau.modus.label")}>
              <p className={KLEINTITEL}>{t("klaravorschau.modus.label")}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  data-testid="klara-modus-erklaere"
                  disabled={hilfeGesperrt}
                  onClick={erklaere}
                  className={KNOPF}
                >
                  {t("klaravorschau.modus.erklaere")}
                </button>
                <button
                  type="button"
                  data-testid="klara-modus-zeige"
                  disabled={hilfeGesperrt}
                  onClick={zeige}
                  className={KNOPF}
                >
                  {t("klaravorschau.modus.zeige")}
                </button>
                <button
                  type="button"
                  data-testid="klara-modus-begleite"
                  disabled={hilfeGesperrt}
                  onClick={begleite}
                  className={KNOPF}
                >
                  {t("klaravorschau.modus.begleite")}
                </button>
              </div>
              {!tutorial.vorhanden ? (
                <p className="mt-1 text-[11.5px] text-muted-2">
                  {t("klaravorschau.modus.keinTutorial")}{" "}
                  <Link
                    to="/fragen"
                    data-testid="klara-zu-fragen"
                    className="font-semibold text-brand-text hover:underline"
                  >
                    {t("klaravorschau.modus.zuFragen")}
                  </Link>
                </p>
              ) : null}
            </section>

            {zeigeBegleitung && lage ? (
              <KlaraTutorialKarte
                lage={lage}
                treffer={treffer}
                hinweis={tutorialHinweis}
                onPause={pausieren}
                onFortsetzen={fortsetzen}
                onBeenden={begleitungBeenden}
              />
            ) : tutorialHinweis ? (
              <output className="block text-[11.5px] text-muted-2">{tutorialHinweis}</output>
            ) : null}

            {/* Entwurf */}
            {z.entwurf ? <EntwurfKarte entwurf={z.entwurf} /> : null}

            {/* Klara 01: Bedienhilfe zu dieser Fähigkeit — von Anfang an über Klara. */}
            <details
              data-testid="klara-bedienhilfe"
              className="rounded-card border border-hairline"
            >
              <summary className="cursor-pointer px-2.5 py-1.5 text-[12px] font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
                {t("klaragespraech.bedienhilfe.titel")}
              </summary>
              <ul className="list-disc space-y-1 px-2.5 pb-2 pl-6 text-[11.5px] leading-relaxed text-text">
                <li>{t("klaragespraech.bedienhilfe.fragen")}</li>
                {/* Klara 03: Bezug, Markierung, Quellen, Übersetzen und Tutorialbegleitung. */}
                <li data-testid="klara-bedienhilfe-bezug">{t("klarakontext.bedienhilfe.bezug")}</li>
                <li>{t("klarakontext.bedienhilfe.markierung")}</li>
                <li>{t("klarakontext.bedienhilfe.quellen")}</li>
                <li>{t("klarakontext.bedienhilfe.uebersetzen")}</li>
                <li>{t("klarakontext.bedienhilfe.tutorial")}</li>
                <li>{t("klaragespraech.bedienhilfe.stoppen")}</li>
                <li>{t("klaragespraech.bedienhilfe.speichern")}</li>
                <li>{t("klaragespraech.bedienhilfe.schritt")}</li>
                <li>{t("klaragespraech.bedienhilfe.demo")}</li>
                <li>{t("klaragespraech.bedienhilfe.bedienen")}</li>
                {/* Klara 02: Sprechen, Diktieren und Vorlesen — erklärt, wo es bedient wird. */}
                <li data-testid="klara-bedienhilfe-sprache">
                  {t("klarasprache.bedienhilfe.diktieren")}
                </li>
                <li>{t("klarasprache.bedienhilfe.auftrag")}</li>
                <li>{t("klarasprache.bedienhilfe.stoppen")}</li>
                <li>{t("klarasprache.bedienhilfe.datenschutz")}</li>
                <li>{t("klarasprache.bedienhilfe.ohneMikrofon")}</li>
              </ul>
            </details>

            <KlaraSprachausgabe />

            {/* Verlauf — im echten Betrieb das gespeicherte Gespräch (Klara 01), sonst die Demo. */}
            {istEcht ? (
              <KlaraEchtGespraech
                kontext={objektbezugAus(kontext)}
                pfad={location.pathname}
                ki={ki}
                // Klara 03: „Erneut fragen“ mit Wortlaut UND Bezug von damals.
                onErneutFragen={(text, bezugDamals) => {
                  void echtFrage(text, { fest: { text, bezug: bezugDamals } });
                }}
                onNeuLaden={() => {
                  if (kontoId) {
                    void ladeEcht(kontoId, t);
                  }
                }}
              />
            ) : (
              <DemoVerlauf verlauf={z.verlauf} />
            )}
            {/* Klara 02: der gesprochene Auftrag — erkannter Text, Ziel, Rückfragen, Ergebnis. */}
            <KlaraAuftragKarte
              s={sprechen}
              sendebereit={sprachSendebereit}
              absenden={auftragSenden}
            />
            <div ref={endeRef} />
          </div>

          {/* Eingabe — bleibt am unteren Rand des Gesprächs, auch über der Bildschirmtastatur. */}
          <form
            data-testid="klara-eingabe-form"
            onSubmit={senden}
            className="flex flex-wrap items-end gap-1.5 border-t border-hairline px-3 py-2"
          >
            {istEcht && echt.laeuftSeit !== null ? (
              <p
                data-testid="klara-laeuft-seit"
                aria-live="off"
                className="w-full text-[11px] font-semibold text-ai"
              >
                {t("klaragespraech.laeuftSeit", {
                  s: Math.max(0, Math.floor((Date.now() - echt.laeuftSeit) / 1000)),
                })}
              </p>
            ) : null}
            <KlaraSprachLeiste s={sprechen} />
            <div className="min-w-0 flex-1">
              <label htmlFor={eingabeId} className={KLEINTITEL}>
                {t("klaravorschau.eingabe.label")}
              </label>
              <input
                id={eingabeId}
                data-testid="klara-eingabe"
                value={eingabe}
                enterKeyHint="send"
                onChange={(e) => setEingabe(e.target.value)}
                placeholder={t("klaravorschau.eingabe.platzhalter")}
                className="h-9 w-full rounded-input border border-hairline bg-surface px-2.5 text-[13px] text-text outline-none placeholder:text-muted-2 focus:border-ink/30"
              />
            </div>
            {istEcht && echt.laeuftSeit !== null ? (
              <button
                type="button"
                data-testid="klara-stoppen"
                onClick={echtStoppen}
                className={KNOPF}
              >
                {t("klaragespraech.stoppen")}
              </button>
            ) : (
              <button
                type="submit"
                data-testid="klara-senden"
                disabled={!eingabe.trim() || (istEcht && !echtSendebereit)}
                className={KNOPF_KI}
              >
                {t("klaravorschau.eingabe.senden")}
              </button>
            )}
          </form>

          {/* Fuss: Lage der Figur, Vollbild, Ende */}
          <div className="flex flex-wrap gap-1.5 border-t border-hairline px-3 py-2">
            <button type="button" data-testid="klara-andocken" onClick={andocken} className={KNOPF}>
              {t("klaravorschau.knopf.andocken")}
            </button>
            <button
              type="button"
              data-testid="klara-zuruecksetzen"
              onClick={positionZuruecksetzen}
              className={KNOPF}
            >
              {t("klaravorschau.knopf.zuruecksetzen")}
            </button>
            {z.geparkt ? (
              <button
                type="button"
                data-testid="klara-parken-loesen"
                onClick={() => aendere((alt) => ({ ...alt, geparkt: null }))}
                className={KNOPF}
              >
                {t("klaravorschau.knopf.parkenLoesen")}
              </button>
            ) : null}
            <button
              type="button"
              data-testid="klara-vollbild"
              aria-pressed={Boolean(vollbildEl)}
              onClick={vollbildUmschalten}
              className={KNOPF}
            >
              {vollbildEl
                ? t("klaravorschau.knopf.vollbildAus")
                : t("klaravorschau.knopf.vollbild")}
            </button>
            <button
              type="button"
              data-testid="klara-beenden"
              onClick={vorschauBeenden}
              className={KNOPF}
            >
              {t("klaravorschau.knopf.beenden")}
            </button>
          </div>
        </section>
      ) : null}
    </>
  );

  // Element-Vollbild (z. B. eine Grafik): Klara zieht mit hinein. Dokument-Vollbild braucht das nicht.
  const vollbildZiel =
    vollbildEl && vollbildEl !== document.documentElement && vollbildEl !== document.body
      ? vollbildEl
      : null;
  return vollbildZiel ? createPortal(inhalt, vollbildZiel) : inhalt;
}

// -------------------------------------------------------------------------------------------------
// Der Verlauf des Demo-Betriebs — unverändert aus der Vorschau, jede Klara-Antwort als Demo markiert.
// -------------------------------------------------------------------------------------------------
function DemoVerlauf({ verlauf }: { verlauf: readonly Nachricht[] }): JSX.Element {
  const { t } = useAssistenzT();
  return (
    <section data-testid="klara-verlauf" aria-label={t("klaravorschau.verlauf.titel")}>
      <p className={KLEINTITEL}>{t("klaravorschau.verlauf.titel")}</p>
      {verlauf.length === 0 ? (
        <p className="mt-1 text-[11.5px] text-muted-2">{t("klaravorschau.verlauf.leer")}</p>
      ) : (
        <ol className="mt-1 space-y-2">
          {verlauf.map((n) => (
            <li
              key={n.id}
              data-testid="klara-nachricht"
              data-von={n.von}
              data-aktion={n.aktion ?? ""}
              className={`rounded-card px-2.5 py-2 text-[12px] leading-relaxed ${
                n.von === "du"
                  ? "ml-6 bg-ink/5 text-text"
                  : "mr-2 border border-ai/30 bg-ai-surface-2 text-text"
              }`}
            >
              <div className="mb-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-muted-2">
                <span className="font-semibold text-text">
                  {n.von === "du"
                    ? t("klaravorschau.verlauf.du")
                    : t("klaravorschau.verlauf.klara")}
                </span>
                <span data-testid="klara-nachricht-herkunft">
                  {t("klaravorschau.verlauf.auf", {
                    seite: n.herkunft.seitenName,
                    objekt: n.herkunft.objekt,
                  })}
                </span>
                {n.demo ? (
                  <span data-testid="klara-demo-kennzeichen" className={DEMO_SCHILD}>
                    {t("klaravorschau.antwort.kennzeichen")}
                  </span>
                ) : null}
              </div>
              <p className="whitespace-pre-line">{n.text}</p>
              {n.von === "klara" ? (
                <div className="mt-1">
                  <VorlesenKnopf id={n.id} text={n.text} />
                </div>
              ) : null}
              {n.vorschlag ? <VorschlagKarte nachrichtId={n.id} vorschlag={n.vorschlag} /> : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// -------------------------------------------------------------------------------------------------
// Vorschlag mit Originalvergleich — die Artikeländerung geschieht ERST durch „Übernehmen“.
// -------------------------------------------------------------------------------------------------
function VorschlagKarte({
  nachrichtId,
  vorschlag,
}: {
  nachrichtId: string;
  vorschlag: Vorschlag;
}): JSX.Element {
  const { t } = useAssistenzT();
  const uebernehmbar = Boolean(vorschlag.artikelId && vorschlag.absatz);
  return (
    <div
      data-testid="klara-vorschlag"
      data-status={vorschlag.status}
      className="mt-2 rounded-card border border-hairline bg-surface p-2"
    >
      <p className="text-[11.5px] font-semibold text-ink">{t("klaravorschau.vorschlag.titel")}</p>
      <div className="mt-1 grid gap-2 sm:grid-cols-2">
        <div>
          <p className={KLEINTITEL}>{t("klaravorschau.vorschlag.original")}</p>
          <p
            data-testid="klara-vorschlag-original"
            className="mt-0.5 rounded-btn bg-page px-2 py-1 text-[11.5px] leading-relaxed text-muted"
          >
            {vorschlag.original}
          </p>
        </div>
        <div>
          <p className={KLEINTITEL}>{t("klaravorschau.vorschlag.neu")}</p>
          <p
            data-testid="klara-vorschlag-neu"
            className="mt-0.5 rounded-btn bg-ai-surface-2 px-2 py-1 text-[11.5px] leading-relaxed text-text"
          >
            {vorschlag.neu}
          </p>
        </div>
      </div>
      {vorschlag.status === "offen" ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            data-testid="klara-vorschlag-uebernehmen"
            disabled={!uebernehmbar}
            onClick={() => aendere((z) => entscheide(z, nachrichtId, "uebernommen"))}
            className={KNOPF_KI}
          >
            {t("klaravorschau.vorschlag.uebernehmen")}
          </button>
          <button
            type="button"
            data-testid="klara-vorschlag-verwerfen"
            onClick={() => aendere((z) => entscheide(z, nachrichtId, "verworfen"))}
            className={KNOPF}
          >
            {t("klaravorschau.vorschlag.verwerfen")}
          </button>
          {!uebernehmbar ? (
            <span className="text-[11px] text-muted-2">
              {t("klaravorschau.vorschlag.nurArtikel")}
            </span>
          ) : null}
        </div>
      ) : (
        <p data-testid="klara-vorschlag-ergebnis" className="mt-1.5 text-[11.5px] text-text">
          {vorschlag.status === "uebernommen"
            ? t("klaravorschau.vorschlag.uebernommen", { nr: vorschlag.absatz })
            : t("klaravorschau.vorschlag.verworfen")}
        </p>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------------------------------
// Notiz- oder Aufgabenentwurf mit Rücklink — Erinnerung, Termin und Speichern sind Demo.
// -------------------------------------------------------------------------------------------------
function EntwurfKarte({ entwurf }: { entwurf: Entwurf }): JSX.Element {
  const { t } = useAssistenzT();
  const id = useId();
  const artikel = entwurf.herkunft.artikelId ? demoArtikel(entwurf.herkunft.artikelId) : null;
  const setze = (teil: Partial<Entwurf>): void =>
    aendere((z) => (z.entwurf ? { ...z, entwurf: { ...z.entwurf, ...teil } } : z));
  return (
    <section
      data-testid="klara-entwurf"
      data-art={entwurf.art}
      className="rounded-card border border-hairline bg-page px-3 py-2.5"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[12.5px] font-semibold text-ink">{t("klaravorschau.entwurf.titel")}</h3>
        <span data-testid="klara-entwurf-demo" className={DEMO_SCHILD}>
          {t("klaravorschau.entwurf.demo")}
        </span>
      </div>
      <fieldset className="mt-1.5">
        <legend className={KLEINTITEL}>{t("klaravorschau.entwurf.art")}</legend>
        <div className="mt-0.5 flex gap-3 text-[12px] text-text">
          {(["notiz", "aufgabe"] as const).map((art) => (
            <label key={art} className="inline-flex items-center gap-1">
              <input
                type="radio"
                name={`${id}-art`}
                data-testid={`klara-entwurf-art-${art}`}
                checked={entwurf.art === art}
                onChange={() => setze({ art })}
              />
              {t(`klaravorschau.entwurf.${art}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor={`${id}-inhalt`} className={`${KLEINTITEL} mt-2 block`}>
        {t("klaravorschau.entwurf.inhalt")}
      </label>
      <textarea
        id={`${id}-inhalt`}
        data-testid="klara-entwurf-inhalt"
        value={entwurf.inhalt}
        rows={3}
        onChange={(e) => setze({ inhalt: e.target.value, gespeichert: false })}
        className="mt-0.5 w-full rounded-input border border-hairline bg-surface px-2 py-1.5 text-[12.5px] text-text outline-none focus:border-ink/30"
      />
      <Link
        to={herkunftZiel(entwurf.herkunft)}
        data-testid="klara-entwurf-ruecklink"
        className="mt-1 inline-flex text-[12px] font-semibold text-brand-text hover:underline"
      >
        {artikel && entwurf.herkunft.absatz
          ? t("klaravorschau.entwurf.ruecklink", {
              titel: artikel.titel,
              nr: entwurf.herkunft.absatz,
            })
          : t("klaravorschau.entwurf.ruecklinkSeite", { seite: entwurf.herkunft.seitenName })}
      </Link>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="text-[11.5px] text-muted">
          <span className="flex items-center gap-1">
            {t("klaravorschau.entwurf.erinnerung")}
            <span className={DEMO_SCHILD}>{t("klaravorschau.entwurf.demo")}</span>
          </span>
          <input
            type="datetime-local"
            data-testid="klara-entwurf-erinnerung"
            value={entwurf.erinnerung}
            onChange={(e) => setze({ erinnerung: e.target.value })}
            className="mt-0.5 h-8 w-full rounded-input border border-hairline bg-surface px-2 text-[12px]"
          />
        </label>
        <label className="text-[11.5px] text-muted">
          <span className="flex items-center gap-1">
            {t("klaravorschau.entwurf.termin")}
            <span className={DEMO_SCHILD}>{t("klaravorschau.entwurf.demo")}</span>
          </span>
          <input
            type="date"
            data-testid="klara-entwurf-termin"
            value={entwurf.termin}
            onChange={(e) => setze({ termin: e.target.value })}
            className="mt-0.5 h-8 w-full rounded-input border border-hairline bg-surface px-2 text-[12px]"
          />
        </label>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-2">
        {t("klaravorschau.entwurf.demoHinweis")}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          data-testid="klara-entwurf-speichern"
          onClick={() => setze({ gespeichert: true })}
          className={KNOPF_KI}
        >
          {t("klaravorschau.entwurf.speichern")}
        </button>
        <button
          type="button"
          data-testid="klara-entwurf-verwerfen"
          onClick={() => aendere((z) => ({ ...z, entwurf: null }))}
          className={KNOPF}
        >
          {t("klaravorschau.entwurf.verwerfen")}
        </button>
      </div>
      {entwurf.gespeichert ? (
        <output
          data-testid="klara-entwurf-gespeichert"
          className="mt-1.5 block rounded-btn bg-trust-warn-bg px-2 py-1 text-[11.5px] text-trust-warn-text"
        >
          {t("klaravorschau.entwurf.gespeichert")}
        </output>
      ) : null}
    </section>
  );
}

export default KlaraVorschau;
