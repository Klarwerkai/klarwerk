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
// ZWEI BETRIEBSARTEN DER FLÄCHE (produkt:20261010:assistenz-produkteinstieg):
//   · `produkt` — der normale Produkteinstieg ohne Vorschau-Aufruf. Nur der echte Betrieb, kein
//     Demo-Schalter, keine vorgefertigten Aktionen; Name und Avatar aus dem persönlichen Profil
//     (`profil.ts`), ohne Profil neutral „Deine Assistenz“. Der Hilfeknopf bleibt daneben erreichbar,
//     offen ist immer nur eine der beiden Flächen (`../assistenzFlaechen.ts`).
//   · `vorschau` — wie geliefert nach `/klara-vorschau`, mit Demo-Betrieb und „Vorschau beenden“.
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
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { setzeKlaraEntwurf } from "../../api/chat";
import { kiArbeitswegApi } from "../../api/kiArbeitsweg";
import type { KlaraObjektbezug } from "../../api/klaraGespraech";
import { type VormachenHost, lernauftragKlaerung, vormachenApi } from "../../api/vormachen";
import { useSession } from "../../app/AuthContext";
import { HOME_ROUTE } from "../../app/navigation";
// produkt:20261010:assistenz-name-avatar: Name, Motiv und Bewegung aus dem persönlichen Profil.
import { animationsStil } from "../../lib/assistenzAvatare";
import { useAssistenzAnzeige, useAssistenzT } from "../../lib/assistenzProfil";
import { internerPfad } from "../../lib/internerPfad";
import { erkenneAuftrag, istAusfuehrungsauftrag } from "../../lib/klaraAuftragErkennung";
// produkt:20261008:klara-eigeninitiative: Modus, Hinweise und übertragene Aufgaben.
import {
  type Hinweis,
  hinweisErlaubt,
  hinweisFuer,
  ladeEigeninitiative,
  legeHinweisAb,
  merkeGezeigt,
  useEigeninitiative,
  verwerfeEigeninitiative,
  warSchonGezeigt,
  wirksamerModus,
} from "../../lib/klaraEigeninitiative";
import { istLernauftrag } from "../../lib/lernauftrag";
import { leseobjektJetzt, useLeseobjekt } from "../../lib/leseobjekt";
import { leserHref } from "../../lib/objektbezug";
import { toReasonerLocale } from "../../lib/reasonerLocale";
import { anfrageEpoche, aufRechtekontextwechsel } from "../../lib/rechtekontext";
import { meldeVormachen } from "../../lib/vormachenAnzeige";
import { useTutorialFuerKlara } from "../../tutorial/TutorialRahmen";
import type { TutorialFernLage } from "../../tutorial/fernsteuerung";
import { AvatarBild } from "../assistenz/AvatarBild";
import { AvatarMimik } from "../assistenz/AvatarMimik";
// produkt:20261010:assistenz-name-avatar: die neun Zustände der Figur aus echten Ereignissen.
import {
  ausdruckNachFrage,
  beginneAktion,
  ermittleZustand,
  istAktuelleAktion,
  meldeErgebnis,
  useLetztesErgebnis,
  zustandsTextSchluessel,
} from "../assistenz/ausdruck";
import {
  meldeFlaeche,
  useAndereFlaecheOffen,
  useAndereFlaecheSchliesst,
} from "../assistenzFlaechen";
import { MeineFunktionen } from "../funktionen/MeineFunktionen";
// produkt:20261012:klara-setup-shortcuts-umsetzung: konfigurierte Kürzel führen vorhandene Wege aus.
import { useKlaraAktion } from "../klara-setup/KlaraKuerzelAusfuehrung";
import { VormachenFlaeche } from "../vormachen/VormachenFlaeche";
// produkt:20261011:assistenz-minimalistische-oberflaeche: Menü, Unterseiten, Vorgangsleiste.
import {
  DUNKEL_ABFRAGE,
  DUNKLE_TOKEN,
  EinklappenSymbol,
  EinstellungenSeite,
  FunktionenSeite,
  HilfeSeite,
  MenueListe,
  type MenueSeite,
  MenueSymbol,
  MikrofonSymbol,
  NeuSeite,
  Unterseite,
  VerlaufSeite,
  type Vorgang,
  VorgangsLeiste,
} from "./AssistenzMinimal";
import { KiArbeitsweg } from "./KiArbeitsweg";
import { KlaraArbeitsueberblick } from "./KlaraArbeitsueberblick";
import { KlaraAufgaben } from "./KlaraAufgaben";
import { KlaraAusfuehrungen } from "./KlaraAusfuehrung";
import { KlaraEchtGespraech, useKlaraKiLage } from "./KlaraEchtGespraech";
import {
  KlaraHinweis,
  KlaraModusWahl,
  KlaraUebertrageneAufgaben,
  istOffen,
} from "./KlaraEigeninitiative";
import { KlaraErinnerungen } from "./KlaraErinnerungen";
import { KlaraLernauftrag, type LernauftragLage } from "./KlaraLernauftrag";
import { KlaraNotizen } from "./KlaraNotizen";
import { KlaraQualitaet } from "./KlaraQualitaet";
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
  type AuftragsUmgebung,
  brecheAuftragAb,
  ladeAuftraege,
  starteAuftrag,
  useAusfuehrungen,
} from "./auftrag";
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
  einwilligen,
  leseEcht,
  objektbezugAus,
  pruefeEcht,
  starteQuellpruefung,
  useEchtGespraech,
} from "./echt";
import {
  eingabeAnKontoBinden,
  entferneAbgewiesen,
  fuegeAbgewiesenHinzu,
  leseEingabe,
  leseEingabeHerkunft,
  setzeEingabe,
  useAbgewiesen,
  useEingabe,
} from "./eingabe";
import { useErinnerungen } from "./erinnerungen";
import {
  type LaufenderKiAuftrag,
  ersetzeKiAuftrag,
  ladeKiAuftraege,
  laufendeKiAuftraege,
  nachzulesendeGespraeche,
  useKiAuftraege,
} from "./kiAuftraege";
import {
  type Uebersetzer,
  ermittleKontext,
  herkunftFuer,
  seiteAusPfad,
  seitenErklaerung,
} from "./kontext";
import { legeNotiz } from "./notizen";
import { auftrittAus, useAssistenzProfil } from "./profil";
import {
  leseVorlesen,
  stoppeVorlesen,
  useKlaraVorlesen,
  vorlesen as vorlesenStarten,
} from "./vorlesen";
import { formuliere, liesNach, setzeVorschlag, uebernehme } from "./vorschlag";
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
  type Textvorschlag,
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
  vorschauEndeZustand,
  wirksamePosition,
} from "./zustand";

/** So lange „läuft“ eine vorgefertigte Anfrage — sichtbar, aber kurz. */
const VERZOEGERUNG_MS = 700;
/**
 * Echter Betrieb: Klaras eingebaute Hilfe liest die Lage des Tutorials erst, nachdem es sich geöffnet
 * hat („Zeige mir den nächsten Schritt“ öffnet es im selben Klick). Kein vorgetäuschtes Rechnen.
 */
const HILFE_TAKT_MS = 400;
/**
 * Klara 12: ein Hinweis erscheint erst, wenn die Seite eine Weile steht — nicht schon beim
 * Durchklicken. Danach höchstens einmal je Sitzung (`lib/klaraEigeninitiative.ts`).
 */
const HINWEIS_VERZUG_MS = 1500;
const HINWEIS_BREITE = 260;
const PANEL_BREITE = 360;
const MINI_GROESSE = 48;
/**
 * Produktbetrieb: unten bleibt dieser Streifen für den Hilfeknopf (`KlaraAssistant`, unten rechts)
 * frei — Figur und sichtbare Beschriftung legen sich nie darüber.
 */
const HILFE_FREIRAUM = 80;
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
/** Assistenz minimal: ein Knopf, der nur ein Symbol zeigt (Name über aria-label/title). */
const SYMBOL_KNOPF =
  "inline-flex shrink-0 items-center justify-center rounded-btn border border-hairline bg-surface text-text hover:border-ink/30 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const KLEINTITEL = "font-mono text-klein font-semibold uppercase tracking-wider text-muted-2";
const DEMO_SCHILD =
  "rounded-pill bg-trust-warn-bg px-1.5 py-0.5 font-mono text-klein font-semibold uppercase text-trust-warn-text";

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

/** UI-MIN-10/UI-S12: der Sitzungsschalter der Vergleichsbasis (nur für die Vergleichssonde). */
const VERGLEICH_SCHLUESSEL = "klarwerk.assistenz.vergleich";
/** So oft liest die Assistenz einen laufenden KI-Auftrag nach (nur solange einer läuft). */
const KI_NACHLESEN_MS = 4000;

function vergleichFrueher(): boolean {
  try {
    return sessionStorage.getItem(VERGLEICH_SCHLUESSEL) === "frueher";
  } catch {
    return false;
  }
}

/**
 * produkt:20261011:assistenz-minimalistische-oberflaeche (UI-MIN-05/12): derselbe Ort — dieselbe
 * Seite und dasselbe Objekt (Wissensobjekt, Entwurf, Artikel). Der angezeigte Objekttext zählt
 * nicht: auf „Fragen“ wandert er mit jedem Tastendruck im Fragefeld.
 */
function gleicherOrt(a: Herkunft, b: Herkunft): boolean {
  return (
    a.pfad === b.pfad &&
    (a.koId ?? "") === (b.koId ?? "") &&
    (a.entwurfId ?? "") === (b.entwurfId ?? "") &&
    (a.artikelId ?? "") === (b.artikelId ?? "")
  );
}

const BEZUG_KNOEPFE: readonly Bezug[] = ["seite", "markierung", "frei"];

interface AuswahlKnopf {
  x: number;
  y: number;
  text: string;
  herkunft: Herkunft;
}

export function KlaraVorschau({
  betriebsart = "vorschau",
}: {
  betriebsart?: "vorschau" | "produkt";
} = {}): JSX.Element {
  // produkt:20261010:assistenz-name-avatar: `t` trägt den persönlichen Namen als `{{assistenz}}`;
  // Name, Motiv und Bewegung kommen aus dem kontobezogenen Profil (`lib/assistenzProfil.ts`).
  const { t, i18n } = useAssistenzT();
  const assistenz = useAssistenzAnzeige();
  const produkt = betriebsart === "produkt";
  // UI-MIN-10/UI-S12 (Nacharbeit 3, Bens Befund): die BISHERIGE Produktfläche als Vergleichsbasis.
  // Sie ist der unveränderte zweite Zweig unten (mit allen `produkt`-Bedingungen von
  // produkt:20261010:assistenz-produkteinstieg). Erreichbar nur über den Sitzungsschalter
  // `VERGLEICH_SCHLUESSEL` — kein Bedienelement, keine andere Datenquelle; die Vorher-Nachher-Sonde
  // (`tests-smoke/assistenz-minimal-vergleich-browser.spec.ts`) setzt ihn in ihrem eigenen Kontext.
  const [frueher] = useState(() => produkt && vergleichFrueher());
  const minimal = produkt && !frueher;
  // produkt:20261010:assistenz-produkteinstieg: der Leseeinstieg `profil.ts` bleibt angeschlossen.
  // Der am Konto gespeicherte Name (dieser Auftrag) hat Vorrang; ohne ihn gilt ein über
  // `setzeAssistenzProfil` gesetzter Name, sonst die neutrale Bezeichnung.
  const auftritt = auftrittAus(useAssistenzProfil());
  const anzeigeName = assistenz.name ?? auftritt.name ?? t("klaraprodukt.name.neutral");
  const figurLabel = produkt
    ? t("klaraprodukt.figur.label", { name: anzeigeName })
    : t("klaravorschau.figur.label");
  const z = useKlaraZustand();
  const location = useLocation();
  const navigate = useNavigate();
  const tutorial = useTutorialFuerKlara();
  const schmal = useMedien(SCHMAL);
  // UI-MIN-16: im Produktbetrieb folgt die Assistenz der Systemdarstellung (Vorschau unverändert).
  const dunkel = useMedien(DUNKEL_ABFRAGE) && minimal;
  const farbStil: CSSProperties = dunkel ? DUNKLE_TOKEN : {};
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
  const rechteEpoche = useSyncExternalStore(aufRechtekontextwechsel, anfrageEpoche, anfrageEpoche);
  const ki = useKlaraKiLage();
  // Im Produktbetrieb gibt es nur den echten Betrieb — auch wenn die Sitzung noch einen in der
  // Vorschau gewählten Demo-Betrieb trägt.
  const istEcht = produkt || z.betrieb === "echt";
  const istEchtRef = useRef(istEcht);
  istEchtRef.current = istEcht;
  const kontoIdRef = useRef(kontoId);
  kontoIdRef.current = kontoId;
  // Klara 03 · K6: Markierung, Demo-Verlauf und Entwurf gehören dem Konto, unter dem sie entstanden.
  // Gebunden wird erst, wenn der Server die Sitzungsfrage beantwortet hat — während des Ladens ist
  // „kein Konto“ keine Abmeldung (`Sitzungslage`, AuthContext). Dasselbe gilt für die angefangene
  // Eingabe (`eingabe.ts`).
  const sitzungBeantwortet = !sitzung.isLoading && sitzung.sitzungslage !== "unbeantwortet";
  useEffect(() => {
    if (sitzungBeantwortet) {
      aendere((alt) => anKontoBinden(alt, kontoId));
      eingabeAnKontoBinden(kontoId);
    }
  }, [sitzungBeantwortet, kontoId]);
  // Klara 12: der Unterstützungsmodus des Kontos — vom Server, nach jeder Anmeldung und jedem
  // Neuladen neu gelesen; abgemeldet bleibt nichts davon im Browser.
  useEffect(() => {
    if (!sitzungBeantwortet) {
      return;
    }
    if (kontoId) {
      void ladeEigeninitiative(kontoId);
    } else {
      verwerfeEigeninitiative();
    }
  }, [sitzungBeantwortet, kontoId]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Rechteepoche und erfolgreiche Sessionantwort sind Wiederprüfanlässe auch bei gleicher Konto-ID.
  useEffect(() => {
    if (!kontoId) {
      // Abgemeldet: nichts vom Gespräch bleibt im Browser stehen — und nichts wird mehr vorgelesen.
      echtVergessen();
      stoppeVorlesen();
      return;
    }
    if (istEcht) {
      void pruefeEcht(kontoId, t);
    }
    // Erfolgreiche Sessionprüfung ist auch bei gleichem Rechteheader ein zusätzlicher Anlass.
  }, [kontoId, istEcht, t, rechteEpoche, sitzung.sitzungGeprueftAm]);
  useEffect(() => {
    if (kontoId && istEcht) return starteQuellpruefung(kontoId, t);
    return undefined;
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
    // MACOS-20261014 · UI-01: auf der Kapital-Sicht wechseln Bereich und Stand der Lagebild-Werte
    // ohne Seitenwechsel (Auswahl, Speichern) — die Kontextzeile folgt dem Angezeigten.
    const nachlesen =
      seite === "erfassung" || seite === "fragen" || location.pathname === "/kapital"
        ? window.setInterval(neu, 300)
        : 0;
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
    hoehe: produkt ? Math.max(FIGUR_GROESSE, fenster.hoehe - HILFE_FREIRAUM) : fenster.hoehe,
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
  // Nie zwei offene Flächen: öffnet sich das Gespräch, schliesst der Hilfeknopf seine Fläche — und
  // öffnet jemand die Hilfe, schliesst sich das Gespräch (Sitzung, Auswahl und Eingabe bleiben).
  // Solange die Hilfe offen ist, tritt die Figur zurück: deren Fläche liegt unten rechts, wo die
  // Figur steht, und die Figur verdeckte sonst ihren Inhalt.
  useEffect(() => {
    meldeFlaeche("assistenz", panelSichtbar);
  }, [panelSichtbar]);
  useAndereFlaecheSchliesst("assistenz", () =>
    aendere((alt) => (alt.offen ? { ...alt, offen: false } : alt)),
  );
  const hilfeOffen = useAndereFlaecheOffen("assistenz");
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
    if (istEchtRef.current && aktion === "modus") {
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
  const zeigerDefinitionId = lage?.definitionId ?? null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `schrittId` ist der Auslöser bei Schrittwechsel.
  useEffect(() => {
    if (!zeigerAn) {
      setTreffer(null);
      return;
    }
    const suchen = (): void => {
      const neu = findeZiel(zielName, document, zeigerDefinitionId);
      setTreffer((alt) => (alt?.el === neu?.el && alt?.ort === neu?.ort ? alt : neu));
    };
    suchen();
    const uhr = window.setInterval(suchen, 400);
    return () => window.clearInterval(uhr);
  }, [zeigerAn, zielName, schrittId, zeigerDefinitionId]);
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
    const gefunden = findeZiel(l.zielName, document, l.definitionId);
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
  // Die angefangene Eingabe liegt ausserhalb der Figur (`eingabe.ts`): Schliessen, Verkleinern,
  // Breitenwechsel und Neuladen verlieren sie nicht.
  const eingabe = useEingabe();
  // produkt:20261011:assistenz-minimalistische-oberflaeche: ein NEUER Entwurf merkt sich den Ort,
  // an dem er beginnt (getippt oder diktiert) — `eingabe.ts` hält beides zusammen.
  const setEingabe = useCallback((neu: string | ((alt: string) => string)): void => {
    setzeEingabe(
      kontoIdRef.current,
      typeof neu === "function" ? neu(leseEingabe()) : neu,
      kontextRef.current,
    );
  }, []);
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
      /**
       * produkt:20261011:assistenz-minimalistische-oberflaeche (UI-MIN-03/12): gerufen GENAU dann,
       * wenn die Frage alle Prüfungen bestanden hat und an den Frageweg übergeben wird — erst ab hier
       * darf der Entwurf das Eingabefeld verlassen.
       */
      beiUebergabe?: () => void;
    } = {},
  ): Promise<Absendeergebnis> => {
    const { art = "frage", fest, ziel, beiUebergabe } = optionen;
    if (!echtSendebereit || pruefungLaeuft.current) {
      return Promise.resolve({ stand: "nicht_gesendet", antwort: null });
    }
    if (lageRef.current) {
      pausieren();
    }
    // Eine neue Aktion beendet Fehler-, Pause- und Freudezustand der Figur; ihr Ergebnis zählt nur,
    // solange keine neuere Aktion begann (assistenz-avatarzustaende).
    const aktion = beginneAktion();
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
        beiUebergabe?.();
        const stand = await echtFragen(text, bezug, sprache, t, seitenbezug);
        if (stand !== "veraltet" && !istAktuelleAktion(aktion)) {
          // assistenz-avatarzustaende (K4): eine neuere Aktion hat inzwischen begonnen — das späte
          // Ende dieser Frage (z. B. das Ablegen nach einem Stopp) überschreibt weder den Ausdruck
          // der Figur noch den Status einer inzwischen laufenden neuen Frage. Festgehalten ist es im
          // Gespräch. Läuft keine Frage mehr, endet nur der Laufstatus.
          if (leseEcht().laeuftSeit === null) {
            aendere((alt) => (alt.status === "laeuft" ? { ...alt, status: "antwort" } : alt));
          }
          return { stand, antwort: null };
        }
        if (stand === "veraltet") {
          // Kontowechsel während der Frage: nichts mehr ansagen, nichts mehr zeigen.
          aendere((alt) => ({ ...alt, status: "ruhe" }));
          return { stand: "nicht_gesendet", antwort: null };
        }
        aendere((alt) => ({ ...alt, status: "antwort" }));
        const letzte = [...leseEcht().nachrichten].reverse().find((n) => n.von === "klara");
        // Das tatsächliche Ergebnis für den Ausdruck der Figur: belegte Antwort = Freude (kurz),
        // Antwort ohne geprüfte Quelle = Fehler „quelle", gestoppt = Pause, fehlgeschlagen = Fehler
        // (technisch oder fehlende Angabe) — bis zur nächsten Aktion.
        const ausdruck = ausdruckNachFrage(stand, letzte ?? null);
        meldeErgebnis(ausdruck?.art ?? null, {
          aktion,
          ...(ausdruck?.fehlerArt ? { fehlerArt: ausdruck.fehlerArt } : {}),
        });
        setAnsage(t(`klaragespraech.ansage.${stand}`));
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

  // ---------------------------------------------------------------------------------------------
  // Klara 04 (produkt:20261008:klara-vorschlaege): Umformulieren und Notizentwurf im ECHTEN Betrieb.
  // Der Vorschlag steht neben dem Original; geändert wird erst nach „Übernehmen“ — im Editor des
  // Objekts, gespeichert über dessen Speicherweg (`vorschlag.ts`, `lib/klaraUebernahme.ts`).
  // ---------------------------------------------------------------------------------------------
  const umformulierenEcht = (): void => {
    const z0 = leseZustand();
    const a = z0.auswahl;
    if (!a || z0.status === "laeuft") {
      return;
    }
    const konto = z0.kontoId;
    setAuswahlSperre(null);
    aendere((alt) => ({ ...alt, status: "laeuft" }));
    void formuliere(a, toReasonerLocale(i18n.language), t).then((r) => {
      if ("gesperrt" in r) {
        setAuswahlSperre({ id: a.id, text: r.gesperrt });
        setAnsage(r.gesperrt);
        aendere((alt) => ({ ...alt, status: "ruhe" }));
        return;
      }
      // Ein Kontowechsel während des Formulierens: der Vorschlag gehört dem alten Konto.
      aendere((alt) =>
        alt.kontoId === konto
          ? {
              ...alt,
              textvorschlag: r.vorschlag,
              status: r.vorschlag.stand === "offen" ? "entscheidung" : "antwort",
            }
          : { ...alt, status: "ruhe" },
      );
      setAnsage(r.vorschlag.meldung ?? t("klaravorschlag.ansage.bereit"));
    });
  };
  const notizEcht = (): void => {
    const a = leseZustand().auswahl;
    if (!a) {
      return;
    }
    aendere((alt) => ({
      ...alt,
      entwurf: {
        id: neueId("entwurf"),
        art: "notiz",
        inhalt: entwurfsInhalt(a),
        herkunft: a.herkunft,
        erinnerung: "",
        termin: "",
        gespeichert: false,
        echt: true,
      },
    }));
    setAnsage(t("klaravorschlag.notiz.ansage"));
  };
  const vorschlagUebernehmen = (wahl?: { nr: number; stand: string }): void => {
    const v = leseZustand().textvorschlag;
    if (!v) {
      return;
    }
    void uebernehme(v, leseobjektJetzt(), t, wahl).then(() => {
      const nach = leseZustand().textvorschlag;
      if (nach?.id === v.id) {
        aendere((alt) => ({
          ...alt,
          status: nach.stand === "rueckfrage" ? "entscheidung" : "antwort",
        }));
        setAnsage(nach.meldung ?? t(`klaravorschlag.stand.${nach.stand}`));
      }
    });
  };
  // Nach der Übernahme: ist die Bearbeitung des Objekts zu, liest Klara am Server nach, was dort steht.
  const tv = z.textvorschlag;
  const nachgelesen = useRef<string | null>(null);
  useEffect(() => {
    if (!tv || tv.stand !== "in_bearbeitung") {
      return;
    }
    const imEditor = leseobjekt?.koId === tv.herkunft.koId && leseobjekt?.modus === "bearbeiten";
    if (imEditor) {
      if (!tv.bearbeitungGesehen) {
        setzeVorschlag(tv.id, { bearbeitungGesehen: true });
      }
      nachgelesen.current = null;
      return;
    }
    if (tv.bearbeitungGesehen && nachgelesen.current !== tv.id) {
      nachgelesen.current = tv.id;
      void liesNach(tv, t).then(() => {
        const nach = leseZustand().textvorschlag;
        if (nach?.id === tv.id) {
          setAnsage(t(`klaravorschlag.stand.${nach.stand}`, { fassung: nach.gespeichertFassung }));
        }
      });
    }
  }, [tv, leseobjekt, t]);
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
  // ---------------------------------------------------------------------------------------------
  // Klara 05 (produkt:20261008:klara-aktionen): EIN Ausführungsweg für getippte und gesprochene
  // Aufträge (`auftrag.ts`). Nur im echten Betrieb, nur mit gelesenem Gespräch — und nur, was die
  // Person selbst eingibt oder als Auftrag spricht; kein Text einer Antwort oder Markierung.
  // ---------------------------------------------------------------------------------------------
  const ausfuehrungen = useAusfuehrungen();
  const ausfuehrungLaeuft = ausfuehrungen.some(
    (a) => a.phase === "pruefen" || a.phase === "laeuft",
  );
  const ausfuehrungBereit =
    istEcht && Boolean(kontoId) && echt.laden === "bereit" && !ausfuehrungLaeuft;
  const ortRef = useRef(`${location.pathname}${location.search}`);
  ortRef.current = `${location.pathname}${location.search}`;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const auftragsUmgebung = useCallback(
    (): AuftragsUmgebung => ({
      t: tRef.current,
      navigiere: (pfad) => navigateRef.current(pfad),
      ort: () => ortRef.current,
    }),
    [],
  );
  const ausfuehren = (
    text: string,
    quelle: "getippt" | "gesprochen",
    ziel?: Herkunft,
  ): "gestartet" | "kein_auftrag" | "belegt" => {
    if (!istEcht || !kontoId || echt.laden !== "bereit") {
      return "kein_auftrag";
    }
    const r = starteAuftrag(text, quelle, ziel ?? kontextRef.current, auftragsUmgebung());
    if (r === "gestartet") {
      setAnsage(t("klaraauftrag.ansage.gestartet"));
    } else if (r === "belegt") {
      setAnsage(t("klaraauftrag.belegt"));
    }
    return r;
  };
  // Nach Neuladen oder neuer Anmeldung: die Aufträge des eigenen Gesprächs vom Server.
  const gespraechId = echt.gespraech?.id ?? null;
  useEffect(() => {
    if (istEcht && gespraechId) {
      void ladeAuftraege(gespraechId, kontextRef.current);
    }
  }, [istEcht, gespraechId]);
  // Nacharbeit 35/38 (Ben, UI-MIN-06/14) × BPA-13: die KI-Aufträge der eigenen Gespräche gelten für
  // die ganze Assistenz — unabhängig von der geöffneten Unterseite UND vom aktuellen Gespräch. Ein
  // laufender Auftrag eines früheren Gesprächs bleibt sichtbar und an SEIN Gespräch gebunden.
  // Gelesen wird vom Server; nachgelesen nur, solange dort etwas läuft oder eine Übergabe aussteht.
  const kiStand = useKiAuftraege();
  const kiAktiv = minimal && istEcht;
  const kiLaufend = kiAktiv ? laufendeKiAuftraege(kiStand) : [];
  const kiNachlesen = kiAktiv ? nachzulesendeGespraeche(kiStand).join(",") : "";
  useEffect(() => {
    if (kiAktiv && gespraechId) {
      void ladeKiAuftraege(gespraechId);
    }
  }, [kiAktiv, gespraechId]);
  useEffect(() => {
    if (!kiNachlesen) {
      return;
    }
    const ids = kiNachlesen.split(",");
    const uhr = window.setInterval(() => {
      for (const id of ids) {
        void ladeKiAuftraege(id);
      }
    }, KI_NACHLESEN_MS);
    return () => window.clearInterval(uhr);
  }, [kiNachlesen]);
  /**
   * Unterbrechen oder Stoppen eines laufenden KI-Auftrags — derselbe Serverweg wie in der Fläche,
   * gebunden an das Gespräch, aus dem der Auftrag stammt (nicht an das gerade geöffnete).
   */
  const kiSchritt = async (l: LaufenderKiAuftrag, was: "unterbrechen" | "stoppen") => {
    try {
      if (was === "stoppen") {
        const r = await kiArbeitswegApi.stoppe(l.gespraechId, l.auftrag.job.jobId);
        ersetzeKiAuftrag(l.gespraechId, r.auftrag);
        setAnsage(r.text);
      } else {
        const r = await kiArbeitswegApi.unterbrich(l.gespraechId, l.auftrag.job.jobId);
        ersetzeKiAuftrag(l.gespraechId, r.auftrag);
      }
    } catch (fehler) {
      setAnsage(fehler instanceof Error ? fehler.message : String(fehler));
    }
  };
  const eingabeAuftrag = istEcht ? erkenneAuftrag(eingabe) : null;
  // Klara 14: ein Verbesserungsschritt wird nur VORBEREITET — der Satz steht danach im Eingabefeld
  // und geht erst mit „Senden“ über denselben Ausführungsweg wie ein getippter Auftrag.
  const befundVorbereiten = (satz: string): void => {
    setEingabe(satz);
    setAnsage(t("klaraqualitaet.vorbereitet"));
    document.getElementById(eingabeId)?.focus();
  };

  /**
   * Ein gesprochener Auftrag: gesendet mit GENAU dem Ziel, das seine Karte zeigt. Ein klarer
   * Ausführungsauftrag geht an denselben Ausführungsweg wie ein getippter (Klara 05).
   */
  const auftragSenden = (text: string, ziel: SprachZiel): Promise<Absendeergebnis> => {
    const r = ausfuehren(text, "gesprochen", ziel.herkunft);
    if (r === "gestartet") {
      return Promise.resolve({ stand: "uebergeben", antwort: null });
    }
    if (r === "belegt") {
      return Promise.resolve({ stand: "nicht_gesendet", antwort: null });
    }
    return fragenSenden(text, ziel.herkunft);
  };
  const [lernauftrag, setLernauftrag] = useState<LernauftragLage | null>(null);
  const lerneAus = async (
    text: string,
    wahl?: { host: VormachenHost; vorgaenge: string[] },
  ): Promise<void> => {
    try {
      const { sitzung } = await vormachenApi.starteAusLernauftrag(text, wahl);
      meldeVormachen(true, kontoId);
      setLernauftrag({ stand: "gestartet", host: sitzung.host, vorgaenge: sitzung.vorgaenge });
      setAnsage(t("vormachen.lernauftrag.ansage"));
    } catch (fehler) {
      const klaerung = lernauftragKlaerung(fehler);
      if (klaerung) {
        setLernauftrag({ stand: "klaerung", text, klaerung });
        setAnsage(klaerung.frage);
        return;
      }
      const grund = fehler instanceof Error ? fehler.message : String(fehler);
      setLernauftrag({ stand: "fehler", grund });
    }
  };

  const senden = (e: FormEvent): void => {
    e.preventDefault();
    const frage = eingabe.trim();
    if (!frage) {
      return;
    }
    if (istEcht && istLernauftrag(frage)) {
      setEingabe("");
      void lerneAus(frage);
      return;
    }
    const r = ausfuehren(frage, "getippt");
    if (r !== "kein_auftrag") {
      if (r === "gestartet") {
        setEingabe("");
      }
      return;
    }
    if (istEcht && !echtSendebereit) {
      return;
    }
    setEingabe("");
    void fragenSenden(frage);
  };
  // Klara 06: der Text im Eingabefeld wird zur privaten Notiz — mit dem gewählten Bezug (Seite,
  // Markierung oder frei) als Rücklink, OHNE an den Frageweg zu gehen. Das Feld leert sich sofort;
  // bis der Server bestätigt, steht die Notiz als „wird gespeichert“ bzw. „Nicht gespeichert“ mit
  // „Erneut speichern“ in „Meine Notizen“ — der Text geht dabei nicht verloren.
  const alsNotizSpeichern = (): void => {
    const text = eingabe.trim();
    if (!text) {
      return;
    }
    const z0 = leseZustand();
    const objektbezug = objektbezugFuer(z0.bezug, kontextRef.current, z0.auswahl);
    const weg = diktiertRef.current ? "diktiert" : "geschrieben";
    setEingabe("");
    void legeNotiz({ weg, inhalt: text, objektbezug }, t);
  };

  // Klara 02: Diktieren füllt das Eingabefeld, „Auftrag sprechen“ zeigt die Karte mit Ziel.
  const objektLeer = [
    t("klaravorschau.objekt.keins"),
    t("klaravorschau.objekt.keineFrage"),
    t("klaravorschau.objekt.neuerEntwurf"),
  ];
  // Klara 06: ob das Eingabefeld (auch) diktiert wurde — eine daraus gespeicherte Notiz heisst dann
  // „diktiert“. Ein geleertes Feld beginnt wieder als getippt.
  const diktiertRef = useRef(false);
  useEffect(() => {
    if (!eingabe) {
      diktiertRef.current = false;
    }
  }, [eingabe]);
  const sprechen = useKlaraSprache({
    setzeEingabe: (f) => {
      diktiertRef.current = true;
      setEingabe(f);
    },
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

  // produkt:20261012:klara-setup-shortcuts-umsetzung (AA-04): konfigurierte Kürzel kommen über den
  // einen Ausführungsweg (`klara-setup/KlaraKuerzelAusfuehrung.tsx`) und laufen hier über die
  // VORHANDENEN Wege — kein zweites Gespräch, keine eigene Aufnahme. „Klara öffnen“ ist idempotent:
  // `oeffnen` setzt nur `offen` auf dem einen Zustand und holt den Fokus ins Gespräch; Verlauf,
  // Eingabe und Auswahl bleiben stehen. Diktat und Auftrag öffnen das Gespräch zuerst, damit der
  // Stopp sichtbar ist; Mikrofonfreigabe und „nicht verfügbar“ regelt `useKlaraSprache` wie beim Klick.
  useKlaraAktion((aktion) => {
    if (aktion === "oeffnen") {
      oeffnen();
    } else if (aktion === "diktieren" || aktion === "auftragSprechen") {
      oeffnen();
      if (!sprechen.laeuft) {
        sprechen.starten(aktion === "diktieren" ? "diktat" : "auftrag");
      }
    } else if (aktion === "aufnahmeStoppen") {
      if (sprechen.laeuft) {
        sprechen.stoppen();
      }
    } else if (aktion === "vorlesenStoppen") {
      stoppeVorlesen();
    }
  });

  // ---------------------------------------------------------------------------------------------
  // produkt:20261010:assistenz-name-avatar — der Zustand der Figur (ANIMATIONSZUSTAENDE.json), nur
  // aus echten Ereignissen: Mikrofon aktiv, Sprachausgabe spielt, Anfrage läuft, Entscheidung nötig,
  // Ergebnis des letzten Vorgangs, verkleinert. „Nachdenken" (assistenz-avatarzustaende): solange der
  // Frageweg die am Server abgelegte Frage bearbeitet; davor und beim Ablegen der Antwort „Warten".
  // ---------------------------------------------------------------------------------------------
  const vorleseLage = useKlaraVorlesen();
  const letztesErgebnis = useLetztesErgebnis();
  const figurZustand = ermittleZustand({
    minimiert: z.minimiert,
    // Bestätigte Aktivität, nicht die Anforderung: `hoert` ab `audiostart`, `spielt` ab `start`.
    hoertZu: sprechen.hoert,
    spricht: vorleseLage.spielt !== null,
    laeuft: z.status === "laeuft",
    // assistenz-avatarzustaende: Nachdenken, solange der Frageweg die abgelegte Frage tatsächlich
    // bearbeitet (`echt.ts`, `verarbeitetSeit`) — endet mit Antwort, Fehler oder Abbruch.
    verarbeitet: istEcht && echt.verarbeitetSeit !== null,
    rueckfrage: z.status === "entscheidung",
    ergebnis: letztesErgebnis,
    jetzt: Date.now(),
  });
  const figurStil = animationsStil(assistenz.motiv);
  // assistenz-avatarzustaende: technischer Fehler, fehlende Quelle und fehlende Angabe unterscheiden
  // sich in Text und ruhiger Darstellung.
  const figurFehlerArt =
    figurZustand === "fehler" ? (letztesErgebnis?.fehlerArt ?? "technisch") : undefined;
  const figurZustandText = t(zustandsTextSchluessel(figurZustand, figurFehlerArt));

  // ---------------------------------------------------------------------------------------------
  // Klara 12 (produkt:20261008:klara-eigeninitiative): wann sich Klara von selbst meldet.
  //   · „Nur auf Nachfrage“ (Vorgabe): nichts erscheint von selbst.
  //   · „Passende Hinweise anbieten“: EIN Hinweis aus dem tatsächlichen Kontext (Seite, Anleitung,
  //     Prüfstatus des gelesenen Objekts) neben der Figur — erst wenn niemand gerade mit Klara
  //     arbeitet, höchstens einmal je Sitzung, nicht solange er geschlossen/zurückgestellt ruht.
  //     Der Hinweis selbst führt nichts aus; erst ein Klick auf sein Angebot öffnet die vorhandene
  //     Hilfe (erklären bzw. nächsten Schritt zeigen — Klarwerk-Hilfe, ohne KI, ohne Änderung).
  //   · „Ausdrücklich übertragene Aufgaben“: keine Hinweise; die selbst erteilten Aufträge
  //     (Klara 05, vom Server) stehen sichtbar im Gespräch, offene zählt die Figur.
  // ---------------------------------------------------------------------------------------------
  const eigen = useEigeninitiative();
  const unterstuetzung = wirksamerModus(eigen);
  const offeneAufgaben = ausfuehrungen.filter(istOffen).length;
  const hinweisKandidat = istEcht
    ? hinweisFuer({
        pfad: kontext.pfad,
        koId: kontext.koId,
        pruefstatus: kontext.pruefstatus,
        modus: kontext.modus,
        tutorialVorhanden: tutorial.vorhanden,
        tutorialOffen: tutorial.offen,
        erklaerbar: seitenErklaerung(kontext.pfad, t) !== null,
      })
    : null;
  const beschaeftigt =
    panelSichtbar ||
    hilfeOffen ||
    z.minimiert ||
    z.status !== "ruhe" ||
    ziehPos !== null ||
    auswahlKnopf !== null ||
    sprechen.hoert ||
    ausfuehrungLaeuft;
  const hinweisSchluessel = hinweisErlaubt(hinweisKandidat, eigen, {
    beschaeftigt,
    jetzt: Date.now(),
  })
    ? hinweisKandidat.schluessel
    : null;
  const hinweisKandidatRef = useRef<Hinweis | null>(hinweisKandidat);
  hinweisKandidatRef.current = hinweisKandidat;
  const [hinweis, setHinweis] = useState<Hinweis | null>(null);
  useEffect(() => {
    if (!hinweisSchluessel) {
      setHinweis(null);
      return;
    }
    setHinweis((alt) => (alt?.schluessel === hinweisSchluessel ? alt : null));
    if (warSchonGezeigt(hinweisSchluessel)) {
      return;
    }
    const uhr = window.setTimeout(() => {
      const k = hinweisKandidatRef.current;
      if (k?.schluessel === hinweisSchluessel) {
        merkeGezeigt(k.schluessel);
        setHinweis(k);
        setAnsage(
          tRef.current(`klarainitiative.hinweis.${k.art}.text`, {
            seite: kontextRef.current.seitenName,
          }),
        );
      }
    }, HINWEIS_VERZUG_MS);
    return () => window.clearTimeout(uhr);
  }, [hinweisSchluessel]);
  /** Das Angebot annehmen: die Person bestellt jetzt die Hilfe — vorher geschah nichts. */
  const hinweisAnnehmen = (): void => {
    const h = hinweis;
    setHinweis(null);
    oeffnen();
    if (!h || hilfeGesperrt) {
      return;
    }
    if (h.angebot === "zeige") {
      zeige();
    } else if (h.art === "ungeprueft") {
      anfrage(t("klarainitiative.hinweis.ungeprueft.angebot"), "modus", () => ({
        text: t("klarainitiative.erklaerung.ungeprueft", { objekt: kontextRef.current.objekt }),
      }));
    } else {
      erklaere();
    }
  };
  const hinweisAblegen = (stand: "geschlossen" | "zurueckgestellt"): void => {
    const h = hinweis;
    setHinweis(null);
    setFokusZiel("figur");
    if (!h || !kontoId) {
      return;
    }
    void legeHinweisAb(kontoId, h.schluessel, stand);
    setAnsage(
      t(
        stand === "geschlossen"
          ? "klarainitiative.hinweis.ansage.geschlossen"
          : "klarainitiative.hinweis.ansage.spaeter",
      ),
    );
  };
  // Links neben der Figur; ist dort kein Platz, rechts daneben — immer ganz im Fenster.
  const hinweisLinks = position.x - HINWEIS_BREITE - 8;
  const hinweisRechts = position.x + FIGUR_GROESSE + 8;
  const hinweisMaxLinks = fenster.breite - HINWEIS_BREITE - 8;
  const hinweisStil: CSSProperties = {
    left: hinweisLinks >= 8 ? hinweisLinks : Math.max(8, Math.min(hinweisRechts, hinweisMaxLinks)),
    top: Math.max(8, Math.min(position.y, fenster.hoehe - 220)),
  };

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
    // Nur der Vorschau-Anteil geht; angefangene Frage und gültige Bezugsauswahl bleiben.
    vorschauEndeZustand();
    setzeKlaraVorschauAktiv(false);
    if (location.pathname.startsWith(VORSCHAU_PFAD)) {
      navigate(HOME_ROUTE);
    }
  };

  // ---------------------------------------------------------------------------------------------
  // produkt:20261011:assistenz-minimalistische-oberflaeche — die Grundansicht im Produktbetrieb.
  // Menü und Unterseiten verändern weder Eingabe noch Gespräch: beide liegen ausserhalb der Fläche
  // (`eingabe.ts`, `echt.ts`). Die Einwilligung wird gefragt, wenn sie gebraucht wird — beim ersten
  // Senden —, und danach geht genau das ab, was die Person gewählt hatte.
  // ---------------------------------------------------------------------------------------------
  type Ausstehend = "frage" | KontextAktion | "umformulieren";
  const [menueOffen, setMenueOffen] = useState(false);
  const [menueSeite, setMenueSeite] = useState<MenueSeite | null>(null);
  const erinnerungsVorgang = useErinnerungen().entwurf?.vorgang ?? null;
  const [einwilligungFuer, setEinwilligungFuer] = useState<Ausstehend | null>(null);
  const [nachEinwilligung, setNachEinwilligung] = useState<Ausstehend | null>(null);
  // UI-MIN-12: ein Entwurf, begonnen an einem anderen Ort als dem jetzigen — wohin soll er?
  const [zielFrage, setZielFrage] = useState<{ ursprung: Herkunft; jetzt: Herkunft } | null>(null);
  // UI-MIN-07: die ausführliche Erklärung der KI-Sperre erscheint am betroffenen Auftrag.
  const [kiAusGezeigt, setKiAusGezeigt] = useState(false);
  // UI-MIN-03/12: abgewiesene Entwürfe, während im Feld schon neuer Text stand — kontogebunden in
  // der Sitzung (`eingabe.ts`), bis die Person sie zurückholt oder verwirft (Nacharbeit 5).
  const abgewiesen = useAbgewiesen();
  const menueId = useId();
  const menueKnopfRef = useRef<HTMLButtonElement>(null);
  const menueErsterRef = useRef<HTMLButtonElement>(null);
  const unterseiteZurueckRef = useRef<HTMLButtonElement>(null);
  const eingabeRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (menueOffen) {
      menueErsterRef.current?.focus({ preventScroll: true });
    }
  }, [menueOffen]);
  useEffect(() => {
    if (menueSeite) {
      unterseiteZurueckRef.current?.focus({ preventScroll: true });
    }
  }, [menueSeite]);
  // Eingeklappt: beim nächsten Öffnen steht wieder die Grundansicht da (Eingabe und Gespräch bleiben).
  useEffect(() => {
    if (!panelSichtbar) {
      setMenueOffen(false);
      setMenueSeite(null);
      setEinwilligungFuer(null);
      setZielFrage(null);
      setKiAusGezeigt(false);
    }
  }, [panelSichtbar]);
  // F08: der berechtigte Rücklink öffnet die eigenen Notizen; der Server prüft das Original frisch.
  const notizRuecklink = new URLSearchParams(location.search).get("notiz");
  useEffect(() => {
    if (notizRuecklink && istEcht && kontoId) oeffnen();
  }, [notizRuecklink, istEcht, kontoId, oeffnen]);
  useEffect(() => {
    if (notizRuecklink && istEcht && kontoId && panelSichtbar) {
      setMenueOffen(false);
      setMenueSeite("funktionen");
    }
  }, [notizRuecklink, istEcht, kontoId, panelSichtbar]);
  // Ein bewusster „Erinnern“-Klick an der Nachricht öffnet den bestehenden Entwurfsweg.
  // Keine dauernde Erinnerungskarte in der Grundansicht und kein erneutes Öffnen beim Tippen.
  useEffect(() => {
    if (minimal && istEcht && kontoId && panelSichtbar && erinnerungsVorgang) {
      setMenueOffen(false);
      setMenueSeite("funktionen");
    }
  }, [minimal, istEcht, kontoId, panelSichtbar, erinnerungsVorgang]);
  useEffect(() => {
    if (!ki.abgeschaltet) {
      setKiAusGezeigt(false);
    }
  }, [ki.abgeschaltet]);
  const eingabeFokussieren = (): void => {
    window.setTimeout(() => eingabeRef.current?.focus({ preventScroll: true }), 0);
  };
  const zurueckZumGespraech = (): void => {
    setMenueSeite(null);
    eingabeFokussieren();
  };
  /**
   * Sendet den Entwurf mit GENAU diesem Ziel. Nacharbeit 3 (Bens Befund): der Entwurf bleibt im
   * Feld, bis die Frage tatsächlich an den Frageweg übergeben ist (`beiUebergabe`) — erst dann wird
   * das Feld geleert, und nur, wenn es noch genau diesen Entwurf trägt. Wird die Frage vorher
   * abgewiesen (`nicht_gesendet`, etwa eine Markierung ohne Leserecht), ist nichts geleert. Hat die
   * Person in der Zwischenzeit selbst etwas anderes ins Feld geschrieben, bleibt ihr neuer Text
   * unberührt, und der abgewiesene Entwurf steht SEPARAT zum Zurückholen bereit — und bleibt dort,
   * auch über weitere Sendeversuche und ein Neuladen hinweg, bis zur bewussten Entscheidung.
   */
  const entwurfSenden = (ziel: Herkunft): void => {
    const roh = leseEingabe();
    const frage = roh.trim();
    if (!frage) {
      return;
    }
    const ursprung = leseEingabeHerkunft();
    const konto = kontoIdRef.current;
    setZielFrage(null);
    void echtFrage(frage, {
      ziel,
      beiUebergabe: () => {
        if (kontoIdRef.current === konto && leseEingabe() === roh) {
          setEingabe("");
        }
      },
    }).then((r) => {
      if (r.stand !== "nicht_gesendet" || kontoIdRef.current !== konto) {
        return;
      }
      if (leseEingabe() === roh) {
        return; // der Entwurf steht unverändert im Feld — nichts verloren
      }
      if (!leseEingabe().trim()) {
        setzeEingabe(konto, roh, ursprung);
        return;
      }
      fuegeAbgewiesenHinzu(konto, roh, ursprung);
    });
  };
  /**
   * Nacharbeit 24 (Ben, UI-MIN-12): ein erkannter Ausführungsauftrag geht mit GENAU dem gewählten
   * Ziel an den Ausführungsweg (Klara 05) — nie still mit dem Ort, an dem man gerade steht. Das Feld
   * leert sich erst mit dem Start, und nur, wenn es noch genau diesen Entwurf trägt.
   */
  const auftragAbschicken = (ziel: Herkunft): void => {
    const roh = leseEingabe();
    const text = roh.trim();
    if (!text) {
      return;
    }
    setZielFrage(null);
    const r = ausfuehren(text, "getippt", ziel);
    if (r === "gestartet" && leseEingabe() === roh) {
      setEingabe("");
    }
  };
  /** Ist der aktuelle Entwurf ein Ausführungsauftrag (dann gilt der Ausführungsweg)? */
  const entwurfIstAuftrag = (): boolean => istEcht && erkenneAuftrag(leseEingabe()) !== null;
  /** Das in der Zielklärung gewählte Ziel: Auftrag an den Ausführungsweg, sonst der Frageweg. */
  const zielGewaehlt = (ziel: Herkunft): void => {
    if (entwurfIstAuftrag()) {
      auftragAbschicken(ziel);
    } else {
      entwurfSenden(ziel);
    }
  };
  const abgewiesenZurueckholen = (id: string): void => {
    const a = entferneAbgewiesen(kontoIdRef.current, id);
    if (!a) {
      return;
    }
    const jetzt = leseEingabe();
    // Leeres Feld: der Entwurf samt Ursprung zurück. Sonst angehängt — der neue Text bleibt.
    if (!jetzt.trim()) {
      setzeEingabe(kontoIdRef.current, a.text, a.herkunft);
    } else {
      setEingabe(`${jetzt.trimEnd()} ${a.text.trim()}`);
    }
    eingabeFokussieren();
  };
  // Integration main (Klara 05): `ausfuehren` ist dort der Ausführungsweg für Aufträge — dieser
  // Schritt führt das Ausstehende des minimalen Gesprächs aus und heisst deshalb anders.
  const ausstehendAusfuehren = (was: Ausstehend): void => {
    if (was === "frage") {
      if (!leseEingabe().trim()) {
        return;
      }
      const jetzt = kontextRef.current;
      const ursprung = leseEingabeHerkunft();
      const z0 = leseZustand();
      // Nur der Seitenbezug hängt am Ort; Markierung und freie Frage tragen ihr Ziel selbst.
      if (
        ursprung &&
        wirksamerBezug(z0.bezug, z0.auswahl) === "seite" &&
        !gleicherOrt(ursprung, jetzt)
      ) {
        setZielFrage({ ursprung, jetzt });
        return;
      }
      entwurfSenden(jetzt);
    } else if (was === "umformulieren") {
      umformulierenEcht();
    } else {
      void echtFrage("", { art: was });
    }
  };
  /** Senden und Vorschläge: ohne gespeicherte Einwilligung erst fragen, dann ausführen. */
  const mitEinwilligung = (was: Ausstehend): void => {
    if (ki.abgeschaltet) {
      // Die Sperre bleibt wirksam; erklärt wird sie genau an diesem Auftrag.
      setKiAusGezeigt(true);
      return;
    }
    if (echt.laden !== "bereit" || echt.laeuftSeit !== null) {
      return;
    }
    if (!echt.gespraech?.einwilligungAm) {
      setEinwilligungFuer(was);
      return;
    }
    ausstehendAusfuehren(was);
  };
  const einwilligenUndAusfuehren = (): void => {
    const was = einwilligungFuer;
    if (!was) {
      return;
    }
    void einwilligen(true, objektbezugAus(kontextRef.current), t).then((ok) => {
      if (ok) {
        setEinwilligungFuer(null);
        setNachEinwilligung(was);
      }
    });
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: nur die erreichte Sendebereitschaft löst aus.
  useEffect(() => {
    if (nachEinwilligung && echtSendebereit) {
      const was = nachEinwilligung;
      setNachEinwilligung(null);
      ausstehendAusfuehren(was);
    }
  }, [nachEinwilligung, echtSendebereit]);
  const sendenMinimal = (e: FormEvent): void => {
    e.preventDefault();
    const frage = eingabe.trim();
    if (!frage) {
      return;
    }
    if (istEcht && istLernauftrag(frage)) {
      setEingabe("");
      void lerneAus(frage);
      return;
    }
    // Integration main (Klara 05): ein erkannter Ausführungsauftrag geht — wie im bisherigen
    // Gespräch — an den EINEN Ausführungsweg; alles andere ist eine Frage an den Frageweg.
    // Nacharbeit 24 (UI-MIN-12): der Auftrag trägt die Herkunft seines Entwurfs. Wurde er an einem
    // anderen Ort begonnen, wird das Ziel zuerst geklärt — nie still auf den neuen Ort gesendet.
    if (entwurfIstAuftrag()) {
      const jetzt = kontextRef.current;
      const ursprung = leseEingabeHerkunft();
      if (ursprung && !gleicherOrt(ursprung, jetzt)) {
        setZielFrage({ ursprung, jetzt });
        return;
      }
      auftragAbschicken(ursprung ?? jetzt);
      return;
    }
    mitEinwilligung("frage");
  };
  const menueWahl = (seite: MenueSeite): void => {
    setMenueOffen(false);
    if (seite === "neu" && echt.nachrichten.length === 0) {
      // Es gibt nichts, was unerreichbar würde: das leere Gespräch ist schon das neue.
      eingabeFokussieren();
      return;
    }
    setMenueSeite(seite);
  };
  const zurEntscheidung = (): void => {
    setMenueOffen(false);
    setMenueSeite(null);
    if (!panelSichtbar) {
      oeffnen();
    }
    window.setTimeout(() => {
      document
        .querySelector<HTMLElement>('[data-testid="klara-textvorschlag"]')
        ?.scrollIntoView?.({ block: "nearest" });
    }, 0);
  };
  // Jeder tatsächlich laufende Vorgang einzeln, mit der Wirkung, die er wirklich hat.
  const vorgaenge: Vorgang[] = [];
  if (sprechen.laeuft) {
    vorgaenge.push({
      art: "aufnahme",
      text: t(`klarasprache.laeuft.${sprechen.laeuft}`),
      // Dieselbe Kennung wie die Aufnahmeanzeige des vorhandenen Sprachwegs (KlaraSprache.tsx):
      // Diktat und gesprochener Auftrag bleiben unterscheidbar.
      textTestId: "klara-aufnahme-laeuft",
      textArt: sprechen.laeuft,
      aktionen: [
        {
          testId: "klara-aufnahme-stoppen",
          label: t("klarasprache.stoppen"),
          onClick: sprechen.stoppen,
        },
      ],
    });
  }
  if (istEcht && echt.laeuftSeit !== null) {
    vorgaenge.push({
      art: "anfrage",
      text: t("klaragespraech.laeuftSeit", {
        s: Math.max(0, Math.floor((Date.now() - echt.laeuftSeit) / 1000)),
      }),
      textTestId: "klara-laeuft-seit",
      aktionen: [
        { testId: "klara-stoppen", label: t("klaragespraech.stoppen"), onClick: echtStoppen },
      ],
    });
  } else if (z.status === "laeuft") {
    vorgaenge.push({ art: "arbeit", text: t("assistenzminimal.vorgang.arbeit"), aktionen: [] });
  }
  // Integration main (Klara 05): jeder laufende Ausführungsauftrag einzeln, mit dessen eigenem
  // Abbruch (`brecheAuftragAb`: keine weiteren Schritte; schon Gespeichertes bleibt, Rückgängig nur
  // über den Auftrag selbst) — auch bei offenem Menü und eingeklappter Figur.
  // Nacharbeit 35 (Ben): jeder laufende KI-Auftrag (BPA-13) einzeln, mit der vorhandenen Wirkung —
  // Unterbrechen (fortsetzbar) und Stoppen (keine weitere Arbeit) — auch eingeklappt.
  // Nacharbeit 38: aus ALLEN eigenen Gesprächen, jeder an sein Gespräch gebunden.
  for (const l of kiLaufend) {
    vorgaenge.push({
      art: `ki-${l.auftrag.job.jobId}`,
      text: t("assistenzminimal.vorgang.ki", { ziel: kuerze(l.auftrag.auftrag.ziel, 60) }),
      aktionen: [
        {
          testId: "klara-ki-unterbrechen",
          label: t("kiarbeitsweg.unterbrechen"),
          onClick: () => void kiSchritt(l, "unterbrechen"),
        },
        {
          testId: "klara-ki-stoppen",
          label: t("kiarbeitsweg.stoppen"),
          onClick: () => void kiSchritt(l, "stoppen"),
        },
      ],
    });
  }
  for (const a of ausfuehrungen) {
    if (a.phase === "pruefen" || a.phase === "laeuft") {
      vorgaenge.push({
        art: `ausfuehrung-${a.lokalId}`,
        text: t("assistenzminimal.vorgang.ausfuehrung", { wortlaut: kuerze(a.wortlaut, 60) }),
        aktionen: [
          {
            testId: "klara-ausfuehrung-stoppen",
            label: t("klaraauftrag.knopf.abbrechen"),
            onClick: () => void brecheAuftragAb(a.lokalId, auftragsUmgebung()),
          },
        ],
      });
    }
  }
  if (vorleseLage.liest !== null) {
    vorgaenge.push({
      art: "vorlesen",
      text: t("assistenzminimal.vorgang.vorlesen"),
      aktionen: [
        {
          testId: "klara-vorlesen-stoppen",
          label: t("klarasprache.vorlesenStop"),
          onClick: stoppeVorlesen,
        },
      ],
    });
  }
  if (z.begleiten && lage) {
    vorgaenge.push({
      art: "begleitung",
      text: t(
        lage.spielt
          ? "assistenzminimal.vorgang.begleitung"
          : "assistenzminimal.vorgang.begleitungPausiert",
        { nr: lage.schrittIndex + 1, gesamt: lage.schrittAnzahl },
      ),
      aktionen: [
        lage.spielt
          ? {
              testId: "klara-vorgang-pause",
              label: t("assistenzminimal.vorgang.pause"),
              onClick: pausieren,
            }
          : {
              testId: "klara-vorgang-fortsetzen",
              label: t("assistenzminimal.vorgang.fortsetzen"),
              onClick: fortsetzen,
            },
        {
          testId: "klara-vorgang-beenden",
          label: t("assistenzminimal.vorgang.beenden"),
          onClick: begleitungBeenden,
        },
      ],
    });
  }
  if (istEcht && tv && (tv.stand === "offen" || tv.stand === "rueckfrage")) {
    vorgaenge.push({
      art: "entscheidung",
      text: t("assistenzminimal.vorgang.entscheidung"),
      aktionen: [
        {
          testId: "klara-vorgang-entscheidung",
          label: t("assistenzminimal.vorgang.ansehen"),
          onClick: zurEntscheidung,
        },
      ],
    });
  }
  const kiText = ki.abgeschaltet
    ? t("d5kiaus.hinweis")
    : ki.ohneModell
      ? t("klaragespraech.ki.ohneModell")
      : ki.unbekannt
        ? t("klaragespraech.ki.unbekannt")
        : null;
  const kiKurz = ki.abgeschaltet
    ? t("assistenzminimal.ki.aus")
    : ki.ohneModell
      ? t("assistenzminimal.ki.ohneModell")
      : null;
  // Bei abgeschalteter KI bleiben die Vorschläge bedienbar: der Klick erklärt die Sperre am
  // Auftrag (`mitEinwilligung`), statt dauerhaft einen Hinweisblock zu zeigen.
  const aktionGesperrt =
    echt.laden !== "bereit" || echt.laeuftSeit !== null || z.status === "laeuft";

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
        data-zurueckgetreten={hilfeOffen ? "true" : "false"}
        className={`fixed z-[60] flex-col items-center ${hilfeOffen ? "hidden" : "flex"}`}
        data-darstellung={dunkel ? "dunkel" : "hell"}
        style={{ ...farbStil, left: position.x, top: position.y, width: FIGUR_GROESSE }}
      >
        <button
          ref={figurRef}
          type="button"
          data-testid="klara-figur"
          data-status={z.status}
          data-betrieb={istEcht ? "echt" : "demo"}
          data-betriebsart={betriebsart}
          data-minimiert={z.minimiert ? "true" : "false"}
          data-angedockt={z.angedockt ?? ""}
          data-geparkt={z.geparkt ? String(z.geparkt.absatz) : ""}
          data-ablage={ablage ? "true" : "false"}
          data-bewegung={assistenz.bewegungReduziert ? "reduziert" : "standard"}
          data-zustand={figurZustand}
          data-fehlerart={figurFehlerArt}
          data-stil={figurStil}
          aria-label={figurLabel}
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
          title={ablage ? t("klaravorschau.figur.ablegen") : figurLabel}
          className={`klara-figur relative grid place-items-center overflow-hidden rounded-full border-2 border-brand bg-surface shadow-popover focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ink ${
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
            className="klara-motiv pointer-events-none h-full w-full"
            // Die Mimik der Motive mit Gesicht (Lidschlag, Mund/Schnabel), deckungsgleich über dem
            // unveränderten Bild; sachliche Objekte und die Ersatzgrafik bekommen keine.
            ueberlagerung={
              <AvatarMimik
                motivId={assistenz.motiv?.id}
                zustand={figurZustand}
                bewegungReduziert={assistenz.bewegungReduziert}
              />
            }
          />
        </button>
        {/* Produktbetrieb: der Name steht SICHTBAR an der Figur — der Einstieg ist ohne Vorwissen
            zu finden. Die Beschriftung ist kein eigenes Ziel; bedient wird die Figur selbst. */}
        {produkt ? (
          <span
            data-testid="klara-figur-name"
            aria-hidden="true"
            className="pointer-events-none mt-1 whitespace-nowrap rounded-pill bg-ink px-2 py-0.5 text-[11px] font-semibold text-page shadow-tile"
          >
            {anzeigeName}
          </span>
        ) : null}
        {/* produkt:20261011:assistenz-minimalistische-oberflaeche: eingeklappt bleibt jeder laufende
            Vorgang an der Figur stoppbar. Eine Aufnahme endet beim Einklappen ohnehin (siehe
            `aufnahmeAbbrechen`) — es gibt kein Mikrofon ohne sichtbaren Stopp. */}
        {minimal && !panelSichtbar ? (
          <VorgangsLeiste
            kompakt
            vorgaenge={vorgaenge.filter((v) => v.aktionen.length > 0)}
            testId="klara-figur-vorgaenge"
            label={t("assistenzminimal.figur.vorgaenge")}
          />
        ) : null}
        {z.status !== "ruhe" ? (
          <span
            data-testid="klara-figur-status"
            className={`mt-1 whitespace-nowrap rounded-pill px-2 py-0.5 text-klein font-semibold shadow-tile ${
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
        {/* produkt:20261010:assistenz-name-avatar: jeder Zustand der Figur steht auch als Text da —
            unabhängig von Bewegung, Licht und Farbe. Warten und Rückfrage nennt schon der Status
            oben; verkleinert bleibt die Figur ohne zusätzliche Pille (der Text steht vorgelesen). */}
        {!z.minimiert &&
        figurZustand !== "bereit" &&
        figurZustand !== "warten" &&
        figurZustand !== "ratlos" &&
        !(figurZustand === "freude" && z.status === "antwort") ? (
          <span
            data-testid="klara-figur-zustand"
            data-zustand={figurZustand}
            data-fehlerart={figurFehlerArt}
            className={`mt-1 whitespace-nowrap rounded-pill px-2 py-0.5 text-klein font-semibold shadow-tile ${
              figurFehlerArt === "technisch"
                ? "bg-trust-crit-bg text-trust-crit-text"
                : "bg-surface text-text"
            }`}
          >
            {figurZustandText}
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
        {/* Klara 12: im Aufgabenmodus zeigt die Figur, wie viele übertragene Aufgaben offen sind. */}
        {istEcht && unterstuetzung === "auftraege" && offeneAufgaben > 0 && !z.minimiert ? (
          <span
            data-testid="klara-figur-aufgaben"
            data-anzahl={offeneAufgaben}
            className="mt-1 whitespace-nowrap rounded-pill bg-ai-surface-1 px-2 py-0.5 text-klein font-semibold text-ai shadow-tile"
          >
            {t("klarainitiative.figur.offen", { anzahl: offeneAufgaben })}
          </span>
        ) : null}
        {z.geparkt && parkAbsatz ? (
          <span
            data-testid="klara-geparkt"
            className="mt-1 whitespace-nowrap rounded-pill bg-surface px-2 py-0.5 text-klein text-muted shadow-tile"
          >
            {t("klaravorschau.figur.geparkt", { nr: z.geparkt.absatz })}
          </span>
        ) : null}
        <span id={hinweisId} className="sr-only">
          {t("klaravorschau.figur.tastatur")} {t(STATUS_TEXT[z.status])} {figurZustandText}{" "}
          {istEcht ? t("klaragespraech.betrieb.echtKurz") : t("klaragespraech.betrieb.demoKurz")}
        </span>
      </div>
      <output data-klara="1" className="sr-only" data-testid="klara-ansage">
        {ansage}
      </output>

      {/* ------------------------------------------------------------------ Klara 12: Hinweis */}
      {hinweis && !beschaeftigt ? (
        <KlaraHinweis
          hinweis={hinweis}
          ort={kontext.seitenName}
          t={t}
          stil={hinweisStil}
          onAngebot={hinweisAnnehmen}
          onSpaeter={() => hinweisAblegen("zurueckgestellt")}
          onSchliessen={() => hinweisAblegen("geschlossen")}
        />
      ) : null}

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
          {produkt
            ? t("klaraprodukt.auswahl.knopf", { name: anzeigeName })
            : t("klaravorschau.auswahl.knopf")}
        </button>
      ) : null}

      {zeigeBegleitung && panelSichtbar ? <KlaraZeiger treffer={treffer} /> : null}

      {/* ------------------------------------------------------------------ das Gespräch */}
      {/* produkt:20261011:assistenz-minimalistische-oberflaeche: im Produktbetrieb vier Bereiche —
          Kopf, Kontextzeile, Gespräch, Eingabe. Ein laufender Vorgang ergänzt den Steuerbereich;
          alles Weitere steht im Menü oder erscheint, wenn der nächste Schritt es braucht. Die
          Vorschau (`betriebsart="vorschau"`) bleibt darunter unverändert. */}
      {panelSichtbar && minimal ? (
        <section
          data-klara="1"
          data-testid="klara-gespraech"
          data-ansicht={z.ansicht}
          data-oberflaeche="minimal"
          data-seite={menueSeite ?? "gespraech"}
          data-einwilligung={echt.gespraech?.einwilligungAm ? "ja" : "nein"}
          aria-labelledby={`${hinweisId}-titel`}
          onKeyDown={(e) => {
            if (e.key !== "Escape") {
              return;
            }
            e.preventDefault();
            e.stopPropagation();
            // Escape geht genau einen Schritt zurück: Unterseite → Gespräch, Menü → zu, sonst
            // einklappen.
            if (menueSeite) {
              setMenueSeite(null);
              menueKnopfRef.current?.focus({ preventScroll: true });
            } else if (menueOffen) {
              setMenueOffen(false);
              menueKnopfRef.current?.focus({ preventScroll: true });
            } else {
              schliessen();
            }
          }}
          data-darstellung={dunkel ? "dunkel" : "hell"}
          className={`fixed z-[59] flex flex-col overflow-hidden border border-hairline bg-surface text-text shadow-popover ${panelForm}`}
          style={{ ...panelStil, ...farbStil }}
        >
          {/* 1 · Kopf: Avatar, persönlicher Name, Menü, Einklappen. */}
          <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
            <AvatarBild
              motiv={assistenz.motiv}
              alt=""
              ersatzBeschriftung=""
              testId="klara-gespraech-avatar"
              className="h-7 w-7 shrink-0 rounded-full"
            />
            <h2
              id={`${hinweisId}-titel`}
              ref={panelTitelRef}
              tabIndex={-1}
              data-testid="klara-panel-titel"
              className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink outline-none focus-visible:underline"
            >
              {anzeigeName}
            </h2>
            <button
              ref={menueKnopfRef}
              type="button"
              data-testid="klara-menue-knopf"
              aria-expanded={menueOffen}
              aria-controls={menueOffen ? menueId : undefined}
              aria-label={t("assistenzminimal.menue.knopf")}
              title={t("assistenzminimal.menue.knopf")}
              onClick={() => {
                if (menueSeite) {
                  setMenueSeite(null);
                  setMenueOffen(true);
                } else {
                  setMenueOffen((o) => !o);
                }
              }}
              className={`${SYMBOL_KNOPF} h-8 w-8`}
            >
              <MenueSymbol />
            </button>
            <button
              type="button"
              data-testid="klara-schliessen"
              aria-label={t("assistenzminimal.einklappen")}
              title={t("assistenzminimal.einklappen.hinweis")}
              onClick={schliessen}
              className={`${SYMBOL_KNOPF} h-8 w-8`}
            >
              <EinklappenSymbol />
            </button>
          </div>
          {assistenz.avatarFehlt ? (
            <p
              data-testid="klara-avatar-fehlt"
              className="border-b border-hairline px-3 py-1 text-[11.5px] text-text"
            >
              {t("assistenz.avatar.fehlt")}
            </p>
          ) : null}
          {menueOffen ? (
            <MenueListe id={menueId} ersterRef={menueErsterRef} onWahl={menueWahl} />
          ) : null}

          {/* Steuerbereich — nur solange etwas läuft; auch über Menü und Unterseiten. */}
          <VorgangsLeiste
            vorgaenge={vorgaenge}
            testId="klara-vorgaenge"
            label={t("assistenzminimal.vorgang.label")}
          />

          {/* Ein laufender Erinnerungsentwurf bleibt beim Unterseitenwechsel montiert:
              Zurück/Escape blendet ihn aus, nur Abbrechen verwirft ihn. */}
          {menueSeite === "funktionen" || erinnerungsVorgang ? (
            <Unterseite
              seite="funktionen"
              verborgen={menueSeite !== "funktionen"}
              zurueckRef={menueSeite === "funktionen" ? unterseiteZurueckRef : null}
              onZurueck={zurueckZumGespraech}
            >
              <FunktionenSeite
                lernfunktionen={
                  istEcht && kontoId ? (
                    <>
                      <VormachenFlaeche />
                      <MeineFunktionen />
                    </>
                  ) : null
                }
                sprachMoeglich={sprechen.moeglich}
                onAuftragSprechen={() => {
                  setMenueSeite(null);
                  sprechen.starten("auftrag");
                }}
                vorschauLink={
                  <Link to={VORSCHAU_PFAD} data-testid="klara-zur-vorschau" className={KNOPF}>
                    {t("klaraprodukt.vorschau.link")}
                  </Link>
                }
                // Integration main (Klara 06): die eigenen Notizen wiederfinden — dieselbe Liste
                // wie im bisherigen Panel; angelegt wird an der Nachricht im Gespräch.
                notizen={istEcht && kontoId ? <KlaraNotizen auftragskarte /> : null}
                // Integration main (Klara 07): die eigenen Aufgaben wiederfinden — dieselbe Liste
                // wie im bisherigen Panel; angelegt wird über den Ausführungsweg im Gespräch.
                aufgaben={istEcht && kontoId ? <KlaraAufgaben /> : null}
                arbeitsueberblick={
                  istEcht && kontoId ? (
                    <KlaraArbeitsueberblick key={kontoId} kontoId={kontoId} />
                  ) : null
                }
                erinnerungen={istEcht && kontoId ? <KlaraErinnerungen /> : null}
                // Integration main (BPA-13): derselbe KI-Arbeitsweg am eigenen gespeicherten
                // Gespräch wie im bisherigen Panel — erreichbar über „Meine Funktionen“.
                kiArbeitsweg={
                  istEcht && echt.gespraech ? (
                    <KiArbeitsweg
                      gespraechId={echt.gespraech.id}
                      kontext={objektbezugAus(kontext)}
                    />
                  ) : null
                }
              />
            </Unterseite>
          ) : null}
          {menueSeite && menueSeite !== "funktionen" ? (
            <Unterseite
              seite={menueSeite}
              zurueckRef={unterseiteZurueckRef}
              onZurueck={zurueckZumGespraech}
            >
              {menueSeite === "neu" ? (
                <NeuSeite
                  kontext={objektbezugAus(kontext)}
                  onFertig={(erledigt) => {
                    if (erledigt) {
                      setAnsage(t("assistenzminimal.neu.erledigt"));
                    }
                    zurueckZumGespraech();
                  }}
                />
              ) : menueSeite === "verlauf" ? (
                <VerlaufSeite pfad={location.pathname} onZumGespraech={zurueckZumGespraech} />
              ) : menueSeite === "einstellungen" ? (
                <EinstellungenSeite
                  kontext={objektbezugAus(kontext)}
                  seitenName={kontext.seitenName}
                  ki={ki}
                  kiText={kiText}
                  // Nacharbeit 33 (Ben, UI-MIN-08/15): Klara 12 — wann sich Klara meldet. Dieselbe
                  // persönlich gespeicherte Wahl wie im bisherigen Panel, nur in den Einstellungen.
                  unterstuetzung={
                    kontoId ? (
                      <KlaraModusWahl
                        kontoId={kontoId}
                        t={t}
                        onGewaehlt={(m, ok) =>
                          setAnsage(
                            ok
                              ? t(`klarainitiative.ansage.${m}`)
                              : t("klarainitiative.ansage.fehler"),
                          )
                        }
                      />
                    ) : null
                  }
                  darstellung={
                    <>
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
                        data-testid="klara-andocken"
                        onClick={andocken}
                        className={KNOPF}
                      >
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
                    </>
                  }
                />
              ) : (
                <HilfeSeite
                  seitenHilfe={
                    <section data-testid="klara-modi" aria-label={t("klaravorschau.modus.label")}>
                      <div className="flex flex-wrap gap-1.5">
                        {(
                          [
                            ["erklaere", erklaere],
                            ["zeige", zeige],
                            ["begleite", begleite],
                          ] as const
                        ).map(([modus, ausloesen]) => (
                          <button
                            key={modus}
                            type="button"
                            data-testid={`klara-modus-${modus}`}
                            disabled={hilfeGesperrt}
                            onClick={() => {
                              // Das Ergebnis steht im Gespräch — dorthin zurück.
                              setMenueSeite(null);
                              ausloesen();
                            }}
                            className={KNOPF}
                          >
                            {t(`klaravorschau.modus.${modus}`)}
                          </button>
                        ))}
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
                  }
                />
              )}
            </Unterseite>
          ) : !menueSeite ? (
            <>
              {/* 2 · Kontext: eine Zeile; ein Klick zeigt Ort, Fassung, Bezug, Datenweg, KI. */}
              <details data-testid="klara-kontext" className="border-b border-hairline">
                <summary
                  data-testid="klara-kontext-zeile"
                  title={t("assistenzminimal.kontext.label")}
                  className="flex cursor-pointer items-center gap-1.5 px-3 py-1.5 text-[12px] text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                >
                  <span data-testid="klara-bezug-zeile" className="min-w-0 flex-1 truncate">
                    {bezugZeile(z.bezug, kontext, auswahl, t)}
                  </span>
                  {kiKurz ? (
                    <span
                      data-testid="klara-verfuegbarkeit"
                      data-ki={ki.abgeschaltet ? "aus" : "ohne_modell"}
                      className="shrink-0 rounded-pill border border-hairline px-1.5 py-0.5 font-mono text-klein font-semibold uppercase text-muted"
                    >
                      {kiKurz}
                    </span>
                  ) : null}
                </summary>
                <div className="space-y-2 px-3 pb-2.5">
                  <dl
                    data-testid="klara-ort"
                    className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5"
                  >
                    <dt className={KLEINTITEL}>{t("klaravorschau.ort.label")}</dt>
                    <dd data-testid="klara-ort-seite" className="text-[12px] text-text">
                      {kontext.seitenName}
                    </dd>
                    <dt className={KLEINTITEL}>{t("klaravorschau.ort.objekt")}</dt>
                    <dd data-testid="klara-ort-objekt" className="text-[12px] text-text">
                      {kontext.objekt}
                    </dd>
                    {kontext.fassung ? (
                      <>
                        <dt className={KLEINTITEL}>{t("klarakontext.ort.fassung")}</dt>
                        <dd data-testid="klara-ort-fassung" className="text-[12px] text-text">
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
                          className="text-[12px] text-text"
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
                          className="text-[12px] text-text"
                        >
                          {t(`klarakontext.modus.${kontext.modus}`)}
                          {kontext.lesart === "uebersetzung"
                            ? ` · ${t("klarakontext.lesart.uebersetzung")}`
                            : ""}
                        </dd>
                      </>
                    ) : null}
                  </dl>
                  <section
                    data-testid="klara-bezug"
                    data-bezug={wirksamerBezug(z.bezug, auswahl)}
                    aria-label={t("assistenzminimal.kontext.bezug")}
                  >
                    <p className={KLEINTITEL}>{t("assistenzminimal.kontext.bezug")}</p>
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
                  </section>
                  <div>
                    <p className={KLEINTITEL}>{t("assistenzminimal.kontext.datenweg")}</p>
                    <p
                      data-testid="klara-datenweg"
                      className="text-[11.5px] leading-relaxed text-text"
                    >
                      {t("klaragespraech.hinweis")}
                    </p>
                  </div>
                  {kiText || ki.extern ? (
                    <div>
                      <p className={KLEINTITEL}>{t("assistenzminimal.kontext.ki")}</p>
                      {kiText ? (
                        <p
                          data-testid={
                            ki.abgeschaltet
                              ? "klara-ki-aus"
                              : ki.ohneModell
                                ? "klara-ki-ohne-modell"
                                : "klara-ki-unbekannt"
                          }
                          className="text-[11.5px] leading-relaxed text-text"
                        >
                          {kiText}
                        </p>
                      ) : null}
                      {ki.extern ? (
                        <p
                          data-testid="klara-extern"
                          data-extern={ki.extern}
                          className="text-[11px] text-muted"
                        >
                          {ki.extern === "blockiert"
                            ? t("topbar.extern.blockiert")
                            : ki.extern === "frei"
                              ? t("topbar.extern.frei")
                              : t("topbar.extern.freiVertraulich")}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </details>

              {/* 3 · Gespräch: der ungekürzte Verlauf; scrollt, die Eingabe bleibt stehen. */}
              <div
                data-testid="klara-gespraechsbereich"
                className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3"
              >
                {auswahl ? (
                  <section
                    data-testid="klara-auswahl"
                    data-seite={auswahl.herkunft.seite}
                    className="rounded-card border border-hairline bg-page px-3 py-2"
                  >
                    <h3
                      data-testid="klara-auswahl-titel"
                      tabIndex={-1}
                      className={`${KLEINTITEL} outline-none focus-visible:underline`}
                    >
                      {t("klaravorschau.auswahl.titel")}
                    </h3>
                    <blockquote
                      data-testid="klara-auswahl-text"
                      className="mt-1 max-h-16 overflow-y-auto border-l-2 border-brand pl-2 text-[12px] italic leading-relaxed text-text"
                    >
                      {auswahl.text}
                    </blockquote>
                    <p data-testid="klara-auswahl-herkunft" className="mt-1 text-[11px] text-muted">
                      {herkunftZeile(auswahl.herkunft, t)}
                    </p>
                    {auswahlAndereSeite ? (
                      <p
                        data-testid="klara-auswahl-andere-seite"
                        className="mt-1 text-[11px] text-muted-2"
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
                    {/* Höchstens zwei Vorschläge — aus der Markierung und dem gelieferten Frageweg. */}
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {(["erklaeren", "zusammenfassen"] as const).map((a) => (
                        <button
                          key={a}
                          type="button"
                          data-testid={`klara-aktion-${a}`}
                          disabled={aktionGesperrt}
                          onClick={() => mitEinwilligung(a)}
                          className={KNOPF_KI}
                        >
                          {t(`klaravorschau.aktion.${a}`)}
                        </button>
                      ))}
                    </div>
                    <details data-testid="klara-auswahl-mehr" className="mt-1.5">
                      <summary className="cursor-pointer text-[11.5px] font-semibold text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
                        {t("assistenzminimal.markierung.mehr")}
                      </summary>
                      <p
                        data-testid="klara-aktion-nur-demo"
                        className="mt-1 text-[11px] leading-relaxed text-muted-2"
                      >
                        {t("klaraprodukt.auswahl.offen")}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
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
                        <button
                          type="button"
                          data-testid="klara-aktion-umformulieren"
                          disabled={aktionGesperrt}
                          onClick={() => mitEinwilligung("umformulieren")}
                          className={KNOPF_KI}
                        >
                          {t("klaravorschau.aktion.umformulieren")}
                        </button>
                        <button
                          type="button"
                          data-testid="klara-aktion-notiz"
                          onClick={notizEcht}
                          className={KNOPF}
                        >
                          {t("klaravorschau.aktion.notiz")}
                        </button>
                        {/* produkt:20261007:interner-chat: nur ein ENTWURF im Chat. */}
                        <button
                          type="button"
                          data-testid="klara-aktion-nachricht"
                          onClick={() => {
                            const h = auswahl.herkunft;
                            const text = auswahl.text.slice(0, 1200);
                            const quelle = (h.titel || h.objekt || h.seitenName).slice(0, 200);
                            setzeKlaraEntwurf({
                              ausschnitt: h.koId
                                ? {
                                    text,
                                    quelle,
                                    fiktiv: false,
                                    koId: h.koId,
                                    ...(h.fassung ? { fassung: h.fassung } : {}),
                                  }
                                : { text, quelle, fiktiv: true, pfad: h.pfad },
                            });
                            navigate("/chat?klara=1");
                          }}
                          className={KNOPF}
                        >
                          {t("chat.klara.ausKlara")}
                        </button>
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
                    </details>
                  </section>
                ) : null}

                {/* Die beim Fokuswechsel aufgehobene Markierung — nur, wenn es sie gibt. */}
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
                      className="mt-1 text-[11px] text-muted"
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

                <KlaraEchtGespraech
                  minimal
                  kontext={objektbezugAus(kontext)}
                  pfad={location.pathname}
                  ki={ki}
                  onErneutFragen={(text, bezugDamals) => {
                    void echtFrage(text, { fest: { text, bezug: bezugDamals } });
                  }}
                  onNeuLaden={() => {
                    if (kontoId) {
                      void pruefeEcht(kontoId, t);
                    }
                  }}
                  sprecher={anzeigeName}
                />
                {/* Integration main (Klara 05): Ausführungsaufträge — Grenze, Schritte, Abbrechen,
                    Rückgängig — auch im minimalen Gespräch, als Ergebnis im Gesprächsbereich. */}
                {istEcht ? <KlaraAusfuehrungen umgebung={auftragsUmgebung} /> : null}
                {z.textvorschlag ? (
                  <TextvorschlagKarte v={z.textvorschlag} onUebernehmen={vorschlagUebernehmen} />
                ) : null}
                {z.entwurf?.echt ? <EntwurfKarte entwurf={z.entwurf} /> : null}
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
                {lernauftrag ? (
                  <KlaraLernauftrag
                    lage={lernauftrag}
                    waehle={(text, host, vorgaenge) => void lerneAus(text, { host, vorgaenge })}
                    schliesse={() => setLernauftrag(null)}
                  />
                ) : null}
                <KlaraAuftragKarte
                  s={sprechen}
                  sendebereit={sprachSendebereit}
                  absenden={auftragSenden}
                  {...(istEcht ? { ausfuehrbar: istAusfuehrungsauftrag } : {})}
                  ausfuehrungBereit={ausfuehrungBereit}
                />
                <div ref={endeRef} />
              </div>

              {/* 4 · Eingabe: ein Feld, ein Mikrofon, Senden. Nötige Rückfragen erscheinen hier. */}
              <form
                data-testid="klara-eingabe-form"
                onSubmit={sendenMinimal}
                className="space-y-1.5 border-t border-hairline px-3 py-2"
              >
                {einwilligungFuer ? (
                  <section
                    data-testid="klara-einwilligung"
                    aria-label={t("klaragespraech.einwilligung.titel")}
                    className="rounded-card border border-ai/40 bg-surface px-3 py-2"
                  >
                    <p className="text-[12px] font-semibold text-ink">
                      {t("assistenzminimal.einwilligung.frage")}
                    </p>
                    <p className="mt-0.5 max-h-20 overflow-y-auto text-[11.5px] leading-relaxed text-text">
                      {t("klaragespraech.einwilligung.text")}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        data-testid="klara-einwilligung-erteilen"
                        onClick={einwilligenUndAusfuehren}
                        className={KNOPF_KI}
                      >
                        {t("assistenzminimal.einwilligung.senden")}
                      </button>
                      <button
                        type="button"
                        data-testid="klara-einwilligung-abbrechen"
                        onClick={() => {
                          setEinwilligungFuer(null);
                          eingabeFokussieren();
                        }}
                        className={KNOPF}
                      >
                        {t("assistenzminimal.einwilligung.nichtJetzt")}
                      </button>
                    </div>
                  </section>
                ) : null}
                {zielFrage ? (
                  <section
                    data-testid="klara-ziel-klaeren"
                    aria-label={t("assistenzminimal.ziel.titel")}
                    className="rounded-card border border-ai/40 bg-surface px-3 py-2"
                  >
                    <p className="text-[12px] leading-relaxed text-text">
                      {t("assistenzminimal.ziel.frage", {
                        ursprung: `${zielFrage.ursprung.seitenName} · ${zielFrage.ursprung.objekt}`,
                        jetzt: `${zielFrage.jetzt.seitenName} · ${zielFrage.jetzt.objekt}`,
                      })}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        data-testid="klara-ziel-ursprung"
                        onClick={() => zielGewaehlt(zielFrage.ursprung)}
                        className={KNOPF_KI}
                      >
                        {t("assistenzminimal.ziel.ursprung", {
                          ort: zielFrage.ursprung.seitenName,
                        })}
                      </button>
                      <button
                        type="button"
                        data-testid="klara-ziel-jetzt"
                        onClick={() => zielGewaehlt(kontextRef.current)}
                        className={KNOPF}
                      >
                        {t("assistenzminimal.ziel.jetzt", { ort: kontext.seitenName })}
                      </button>
                      <button
                        type="button"
                        data-testid="klara-ziel-abbrechen"
                        onClick={() => {
                          setZielFrage(null);
                          eingabeFokussieren();
                        }}
                        className={KNOPF}
                      >
                        {t("assistenzminimal.neu.nein")}
                      </button>
                    </div>
                  </section>
                ) : null}
                {ki.abgeschaltet && kiAusGezeigt ? (
                  <p
                    data-testid="klara-ki-aus-hinweis"
                    className="rounded-btn bg-trust-crit-bg px-2.5 py-1.5 text-[11.5px] leading-relaxed text-trust-crit-text"
                  >
                    {t("d5kiaus.hinweis")}
                  </p>
                ) : null}
                {abgewiesen.map((a) => (
                  <div
                    key={a.id}
                    data-testid="klara-abgewiesen"
                    className="rounded-btn bg-trust-warn-bg px-2.5 py-1.5 text-[11.5px] leading-relaxed text-trust-warn-text"
                  >
                    <p>{t("assistenzminimal.abgewiesen.text", { text: kuerze(a.text, 80) })}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        data-testid="klara-abgewiesen-zurueckholen"
                        onClick={() => abgewiesenZurueckholen(a.id)}
                        className={KNOPF}
                      >
                        {t("assistenzminimal.abgewiesen.zurueck")}
                      </button>
                      <button
                        type="button"
                        data-testid="klara-abgewiesen-verwerfen"
                        onClick={() => entferneAbgewiesen(kontoIdRef.current, a.id)}
                        className={KNOPF}
                      >
                        {t("assistenzminimal.abgewiesen.verwerfen")}
                      </button>
                    </div>
                  </div>
                ))}
                {sprechen.zwischen ? (
                  <p
                    data-testid="klara-aufnahme-zwischen"
                    aria-live="polite"
                    className="text-[11.5px] italic text-muted"
                  >
                    {sprechen.zwischen}
                  </p>
                ) : null}
                {sprechen.hinweis ? (
                  <output
                    data-testid="klara-sprache-hinweis"
                    className="block rounded-btn bg-trust-warn-bg px-2 py-1 text-[11px] leading-relaxed text-trust-warn-text"
                  >
                    {sprechen.hinweis}
                  </output>
                ) : null}
                <div className="flex items-center gap-1.5">
                  <label htmlFor={eingabeId} className="sr-only">
                    {t("assistenzminimal.eingabe.label", { name: anzeigeName })}
                  </label>
                  <input
                    ref={eingabeRef}
                    id={eingabeId}
                    data-testid="klara-eingabe"
                    value={eingabe}
                    enterKeyHint="send"
                    onChange={(e) => setEingabe(e.target.value)}
                    placeholder={t("assistenzminimal.eingabe.platzhalter")}
                    className="h-9 min-w-0 flex-1 rounded-input border border-hairline bg-surface px-2.5 text-[13px] text-text outline-none placeholder:text-muted-2 focus:border-ink/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                  />
                  {sprechen.moeglich ? (
                    <button
                      type="button"
                      data-testid="klara-mikrofon"
                      data-aufnahme={sprechen.laeuft ?? ""}
                      aria-pressed={sprechen.laeuft !== null}
                      aria-label={
                        sprechen.laeuft
                          ? t("assistenzminimal.mikrofon.stopp")
                          : t("assistenzminimal.mikrofon.start")
                      }
                      title={
                        sprechen.laeuft
                          ? t("assistenzminimal.mikrofon.stopp")
                          : t("assistenzminimal.mikrofon.start")
                      }
                      onClick={() => {
                        if (sprechen.laeuft) {
                          sprechen.stoppen();
                        } else {
                          // EIN Spracheinstieg: Diktat ins Eingabefeld — gesendet wird nur mit
                          // „Senden“. Der gesprochene Auftrag mit Rückfragen steht unter
                          // „Meine Funktionen“.
                          sprechen.starten("diktat");
                        }
                      }}
                      className={`${SYMBOL_KNOPF} h-9 w-9 ${
                        sprechen.laeuft ? "border-ai bg-ai-surface-1 text-ai" : ""
                      }`}
                    >
                      <MikrofonSymbol />
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    data-testid="klara-senden"
                    disabled={
                      !eingabe.trim() || echt.laden !== "bereit" || echt.laeuftSeit !== null
                    }
                    className={`${KNOPF_KI} h-9`}
                  >
                    {t("assistenzminimal.senden")}
                  </button>
                </div>
                {/* Integration main (Klara 05): nur wenn der Text ein Ausführungsauftrag ist, steht
                    vor dem Senden, welche Schritte er auslöst — situationsbezogen, kein Dauerblock. */}
                {eingabeAuftrag ? (
                  <p
                    data-testid="klara-eingabe-auftrag"
                    className="text-[11px] leading-relaxed text-ai"
                  >
                    {t("klaraauftrag.eingabeHinweis", {
                      schritte: eingabeAuftrag.schritte
                        .map((s, i) =>
                          t("klaraauftrag.schritt", {
                            nr: i + 1,
                            aktion: t(`klaraauftrag.aktion.${s.aktion}`),
                            titel: s.name,
                          }),
                        )
                        .join(" · "),
                    })}
                  </p>
                ) : null}
              </form>
            </>
          ) : null}
        </section>
      ) : panelSichtbar ? (
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
          {/* Kopf. produkt:20261010:assistenz-name-avatar: der Name der Assistenz muss im Kopf
              sichtbar bleiben. Vorher hatte die Knopfleiste `shrink-0` und drückte den Titel im
              360 px breiten Gespräch auf Breite 0; jetzt hat der Titel eine Mindestbreite und die
              Knöpfe brechen bei Platzmangel in eine eigene Zeile um. */}
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-hairline px-3 py-2">
            <div className="flex min-w-[10rem] flex-1 items-center gap-2">
              <AvatarBild
                motiv={assistenz.motiv}
                alt=""
                ersatzBeschriftung=""
                testId="klara-gespraech-avatar"
                className="h-8 w-8 shrink-0 rounded-full"
              />
              <div className="min-w-0 flex-1">
                <h2
                  id={`${hinweisId}-titel`}
                  ref={panelTitelRef}
                  tabIndex={-1}
                  data-testid="klara-panel-titel"
                  className="break-words text-[14px] font-semibold text-ink outline-none focus-visible:underline"
                >
                  {produkt ? anzeigeName : t("klaravorschau.panel.titel")}
                </h2>
                {assistenz.avatarFehlt ? (
                  <p data-testid="klara-avatar-fehlt" className="text-[11.5px] text-text">
                    {t("assistenz.avatar.fehlt")}
                  </p>
                ) : null}
                <p className={KLEINTITEL}>
                  {produkt
                    ? t("klaraprodukt.untertitel")
                    : istEcht
                      ? t("klaragespraech.untertitel")
                      : t("klaravorschau.panel.untertitel")}
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
            <div className="ml-auto flex flex-wrap justify-end gap-1">
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
                data-betrieb={istEcht ? "echt" : "demo"}
                className={
                  istEcht
                    ? "rounded-pill border border-ai bg-ai-surface-1 px-1.5 py-0.5 font-mono text-klein font-semibold uppercase text-ai"
                    : DEMO_SCHILD
                }
              >
                {istEcht
                  ? t("klaragespraech.betrieb.echtKurz")
                  : t("klaragespraech.betrieb.demoKurz")}
              </span>
              {/* Produktbetrieb: kein Demo-Schalter — vorgefertigte Antworten gibt es nur in der
                  getrennten Vorschau (Link im Fuss). */}
              {!produkt ? (
                <>
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
                </>
              ) : null}
            </div>
            {!istEcht ? (
              <p
                data-testid="klara-demo-hinweis"
                className="rounded-btn bg-trust-warn-bg px-2.5 py-1.5 text-[11.5px] leading-relaxed text-trust-warn-text"
              >
                {t("klaravorschau.panel.demoHinweis")}
              </p>
            ) : null}

            {/* Klara 12: im Aufgabenmodus stehen die übertragenen Aufgaben zuerst da. */}
            {istEcht && unterstuetzung === "auftraege" ? (
              <KlaraUebertrageneAufgaben liste={ausfuehrungen} t={t} />
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

            {/* Klara 14: Befunde zum geöffneten Wissensobjekt erklären — lesend, mit Vorschlag. */}
            {istEcht && kontext.koId ? (
              <KlaraQualitaet
                koId={kontext.koId}
                titel={kontext.titel ?? kontext.objekt}
                darfBearbeiten={kontext.darfBearbeiten === true}
                onVorbereiten={befundVorbereiten}
              />
            ) : null}

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
                <p className={`${KLEINTITEL} mt-2`}>
                  {produkt ? t("klaraprodukt.aktion.label") : t("klaravorschau.aktion.label")}
                </p>
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
                      {produkt
                        ? t("klaraprodukt.auswahl.offen")
                        : t("klaragespraech.aktionHinweis")}
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
                      {/* Klara 04: Formulierungsvorschlag (über den Formulierungsweg des Editors) und
                          Notizentwurf — beide ändern am Objekt nichts. */}
                      <button
                        type="button"
                        data-testid="klara-aktion-umformulieren"
                        disabled={!echtSendebereit || z.status === "laeuft"}
                        onClick={umformulierenEcht}
                        className={KNOPF_KI}
                      >
                        {t("klaravorschau.aktion.umformulieren")}
                      </button>
                      <button
                        type="button"
                        data-testid="klara-aktion-notiz"
                        onClick={notizEcht}
                        className={KNOPF}
                      >
                        {t("klaravorschau.aktion.notiz")}
                      </button>
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
                  {/* produkt:20261007:interner-chat: die Markierung wird nur ein ENTWURF. Ziel und
                      Text stehen danach im Chat sichtbar da; erst „Senden" dort verschickt etwas. */}
                  <button
                    type="button"
                    data-testid="klara-aktion-nachricht"
                    onClick={() => {
                      const h = auswahl.herkunft;
                      const text = auswahl.text.slice(0, 1200);
                      const quelle = (h.titel || h.objekt || h.seitenName).slice(0, 200);
                      setzeKlaraEntwurf({
                        ausschnitt: h.koId
                          ? {
                              text,
                              quelle,
                              fiktiv: false,
                              koId: h.koId,
                              ...(h.fassung ? { fassung: h.fassung } : {}),
                            }
                          : { text, quelle, fiktiv: true, pfad: h.pfad },
                      });
                      navigate("/chat?klara=1");
                    }}
                    className={KNOPF}
                  >
                    {t("chat.klara.ausKlara")}
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

            {/* Klara 04: Original und Vorschlag, Ziel und Bearbeitungsfassung, Rückfrage. */}
            {istEcht && z.textvorschlag ? (
              <TextvorschlagKarte v={z.textvorschlag} onUebernehmen={vorschlagUebernehmen} />
            ) : null}

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

            {/* Produktbetrieb: was noch nicht freigegeben ist, steht als solches da — ohne Knopf. */}
            {produkt ? (
              <section
                data-testid="klara-offen"
                aria-label={t("klaraprodukt.offen.titel")}
                className="rounded-card border border-dashed border-hairline px-3 py-2"
              >
                <p className={KLEINTITEL}>{t("klaraprodukt.offen.titel")}</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
                  {t("klaraprodukt.offen.text")}
                </p>
              </section>
            ) : null}

            {/* Entwurf — ein Demo-Entwurf der Vorschau erscheint nie im Produktbetrieb; ein echter
                Notizentwurf (Klara 04) erscheint überall, ohne Demo-Felder. */}
            {z.entwurf && (z.entwurf.echt || !produkt) ? (
              <EntwurfKarte entwurf={z.entwurf} />
            ) : null}

            {/* Klara 12: wann sich Klara meldet — persönlich gespeichert. */}
            {kontoId ? (
              <KlaraModusWahl
                kontoId={kontoId}
                t={t}
                onGewaehlt={(m, ok) =>
                  setAnsage(
                    ok ? t(`klarainitiative.ansage.${m}`) : t("klarainitiative.ansage.fehler"),
                  )
                }
              />
            ) : null}

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
                {/* Klara 04: Vorschlag, Übernahme und Rückfrage. */}
                <li data-testid="klara-bedienhilfe-vorschlag">
                  {t("klaravorschlag.bedienhilfe.umformulieren")}
                </li>
                <li>{t("klaravorschlag.bedienhilfe.uebernehmen")}</li>
                <li>{t("klaravorschlag.bedienhilfe.rueckfrage")}</li>
                <li>{t("klaravorschlag.bedienhilfe.notiz")}</li>
                {/* Klara 05: Aufträge ausführen, stoppen, korrigieren und rückgängig machen. */}
                <li data-testid="klara-bedienhilfe-auftrag">
                  {t("klaraauftrag.bedienhilfe.ausfuehren")}
                </li>
                <li>{t("klaraauftrag.bedienhilfe.grenze")}</li>
                <li>{t("klaraauftrag.bedienhilfe.stoppen")}</li>
                <li>{t("klaraauftrag.bedienhilfe.rueckgaengig")}</li>
                <li>{t("klaraauftrag.bedienhilfe.sprechen")}</li>
                {/* Klara 06: private Notizen anlegen, wiederfinden und als Arbeitszettel führen. */}
                <li data-testid="klara-bedienhilfe-notiz">{t("klaranotiz.bedienhilfe.anlegen")}</li>
                <li>{t("klaranotiz.bedienhilfe.gespraech")}</li>
                <li>{t("klaranotiz.bedienhilfe.ausschnitt")}</li>
                <li>{t("klaranotiz.bedienhilfe.wiederfinden")}</li>
                <li>{t("klaranotiz.bedienhilfe.arbeitszettel")}</li>
                <li>{t("klaranotiz.bedienhilfe.privat")}</li>
                <li>{t("klaranotiz.bedienhilfe.fehler")}</li>
                {/* Klara 07: persönliche Aufgaben aus Notiz und Auftrag, bearbeiten, erledigen. */}
                <li data-testid="klara-bedienhilfe-aufgabe">
                  {t("klaraaufgabe.bedienhilfe.auftrag")}
                </li>
                <li>{t("klaraaufgabe.bedienhilfe.notiz")}</li>
                <li>{t("klaraaufgabe.bedienhilfe.bearbeiten")}</li>
                <li>{t("klaraaufgabe.bedienhilfe.privat")}</li>
                <li>{t("klaraaufgabe.bedienhilfe.fehler")}</li>
                {/* Klara 10: Erinnerungen — Zeit klären, Zustellung, Regeln, Bedienung, Grenzen. */}
                <li data-testid="klara-bedienhilfe-erinnerung">
                  {t("klaraerinnerung.bedienhilfe.anlegen")}
                </li>
                <li>{t("klaraerinnerung.bedienhilfe.klaeren")}</li>
                <li>{t("klaraerinnerung.bedienhilfe.zustellung")}</li>
                <li>{t("klaraerinnerung.bedienhilfe.sommerzeit")}</li>
                <li>{t("klaraerinnerung.bedienhilfe.verpasst")}</li>
                <li>{t("klaraerinnerung.bedienhilfe.bedienen")}</li>
                <li data-testid="klara-bedienhilfe-erinnerung-assistent">
                  {t("klaraerinnerung.bedienhilfe.assistent")}
                </li>
                <li>{t("klaraerinnerung.bedienhilfe.uebergabe")}</li>
                <li>{t("klaraerinnerung.bedienhilfe.zusammenfassung")}</li>
                <li data-testid="klara-bedienhilfe-erinnerung-routine">
                  {t("klaraerinnerung.bedienhilfe.routine")}
                </li>
                <li>{t("klaraerinnerung.bedienhilfe.privat")}</li>
                {/* Klara 11: den vorhandenen Kalender verbinden, eintragen, entscheiden. */}
                <li data-testid="klara-bedienhilfe-kalender">
                  {t("klarakalender.bedienhilfe.verbinden")}
                </li>
                <li>{t("klarakalender.bedienhilfe.eintragen")}</li>
                <li>{t("klarakalender.bedienhilfe.konflikt")}</li>
                <li>{t("klarakalender.bedienhilfe.privat")}</li>
                {/* Klara 12: Modi, Hinweise und übertragene Aufgaben. */}
                <li data-testid="klara-bedienhilfe-eigeninitiative">
                  {t("klarainitiative.bedienhilfe.modi")}
                </li>
                <li>{t("klarainitiative.bedienhilfe.hinweise")}</li>
                <li>{t("klarainitiative.bedienhilfe.aufgaben")}</li>
                {/* Klara 14: Befunde erklären, Vorschlag, Grundlage und Rechte. */}
                <li data-testid="klara-bedienhilfe-qualitaet">
                  {t("klaraqualitaet.bedienhilfe.erklaeren")}
                </li>
                <li>{t("klaraqualitaet.bedienhilfe.vorschlag")}</li>
                <li>{t("klaraqualitaet.bedienhilfe.grundlage")}</li>
                <li>{t("klaraqualitaet.bedienhilfe.rechte")}</li>
                <li>{t("klaragespraech.bedienhilfe.stoppen")}</li>
                <li>{t("klaragespraech.bedienhilfe.speichern")}</li>
                <li>{t("klaragespraech.bedienhilfe.schritt")}</li>
                {produkt ? (
                  <li>{t("klaraprodukt.vorschau.hinweis")}</li>
                ) : (
                  <li>{t("klaragespraech.bedienhilfe.demo")}</li>
                )}
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
                    void pruefeEcht(kontoId, t);
                  }
                }}
                {...(produkt ? { sprecher: anzeigeName } : {})}
              />
            ) : (
              <DemoVerlauf verlauf={z.verlauf} />
            )}
            {/* Klara 05: Ausführungsaufträge — Grenze, Schritte, Abbrechen, Rückgängig. */}
            {istEcht ? <KlaraAusfuehrungen umgebung={auftragsUmgebung} /> : null}
            {/* Klara 06: die privaten Notizen — anlegen, wiederfinden, öffnen, ändern. */}
            {istEcht && kontoId ? <KlaraArbeitsueberblick key={kontoId} kontoId={kontoId} /> : null}
            {istEcht && kontoId ? <KlaraNotizen /> : null}
            {/* Klara 07: die persönlichen Aufgaben — öffnen, ändern, priorisieren, erledigen. */}
            {istEcht && kontoId ? <KlaraAufgaben /> : null}
            {/* Klara 10: persönliche Erinnerungen — anlegen, klären, ändern, pausieren, erledigen. */}
            {istEcht && kontoId ? <KlaraErinnerungen /> : null}
            {/* Klara 02: der gesprochene Auftrag — erkannter Text, Ziel, Rückfragen, Ergebnis. */}
            {lernauftrag ? (
              <KlaraLernauftrag
                lage={lernauftrag}
                waehle={(text, host, vorgaenge) => void lerneAus(text, { host, vorgaenge })}
                schliesse={() => setLernauftrag(null)}
              />
            ) : null}
            <KlaraAuftragKarte
              s={sprechen}
              sendebereit={sprachSendebereit}
              absenden={auftragSenden}
              {...(istEcht ? { ausfuehrbar: istAusfuehrungsauftrag } : {})}
              ausfuehrungBereit={ausfuehrungBereit}
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
                {produkt ? t("klaraprodukt.eingabe.label") : t("klaravorschau.eingabe.label")}
              </label>
              <input
                id={eingabeId}
                data-testid="klara-eingabe"
                value={eingabe}
                enterKeyHint="send"
                onChange={(e) => setEingabe(e.target.value)}
                placeholder={
                  produkt
                    ? t("klaraprodukt.eingabe.platzhalter")
                    : t("klaravorschau.eingabe.platzhalter")
                }
                className="h-9 w-full rounded-input border border-hairline bg-surface px-2.5 text-[13px] text-text outline-none placeholder:text-muted-2 focus:border-ink/30"
              />
              {/* Klara 05: vor dem Senden sichtbar, dass dieser Text ein Ausführungsauftrag ist. */}
              {eingabeAuftrag ? (
                <p
                  data-testid="klara-eingabe-auftrag"
                  className="mt-0.5 text-[11px] leading-relaxed text-ai"
                >
                  {t("klaraauftrag.eingabeHinweis", {
                    schritte: eingabeAuftrag.schritte
                      .map((s, i) =>
                        t("klaraauftrag.schritt", {
                          nr: i + 1,
                          aktion: t(`klaraauftrag.aktion.${s.aktion}`),
                          titel: s.name,
                        }),
                      )
                      .join(" · "),
                  })}
                </p>
              ) : null}
            </div>
            {/* Klara 06: getippt oder diktiert als private Notiz speichern — ohne Senden. */}
            {istEcht ? (
              <button
                type="button"
                data-testid="klara-als-notiz"
                title={t("klaranotiz.alsNotizHilfe")}
                disabled={!eingabe.trim() || sprechen.laeuft === "diktat"}
                onClick={alsNotizSpeichern}
                className={KNOPF}
              >
                {t("klaranotiz.alsNotiz")}
              </button>
            ) : null}
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
                disabled={
                  !eingabe.trim() ||
                  (istEcht && !echtSendebereit && !(eingabeAuftrag && ausfuehrungBereit))
                }
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
            {produkt ? (
              <Link to={VORSCHAU_PFAD} data-testid="klara-zur-vorschau" className={KNOPF}>
                {t("klaraprodukt.vorschau.link")}
              </Link>
            ) : (
              <button
                type="button"
                data-testid="klara-beenden"
                onClick={vorschauBeenden}
                className={KNOPF}
              >
                {t("klaravorschau.knopf.beenden")}
              </button>
            )}
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
              <div className="mb-0.5 flex flex-wrap items-center gap-1.5 text-klein text-muted-2">
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
// Klara 04 · der Formulierungsvorschlag im ECHTEN Betrieb — Original und Vorschlag, Ziel und
// Bearbeitungsfassung, Rückfrage, Ergebnis. Das Original ändert sich erst nach „Übernehmen“, und
// auch dann nur im Editor des Objekts; was gespeichert wurde, liest Klara am Server nach.
// -------------------------------------------------------------------------------------------------
const VORSCHLAG_ENDE: readonly Textvorschlag["stand"][] = [
  "gespeichert",
  "eingereicht",
  "nicht_gespeichert",
  "verworfen",
];

function TextvorschlagKarte({
  v,
  onUebernehmen,
}: {
  v: Textvorschlag;
  onUebernehmen: (wahl?: { nr: number; stand: string }) => void;
}): JSX.Element {
  // produkt:20261010:assistenz-name-avatar: `t` mit dem persönlichen Namen (`{{assistenz}}`).
  const { t } = useAssistenzT();
  const h = v.herkunft;
  const titel = h.titel ?? h.objekt;
  const ende = VORSCHLAG_ENDE.includes(v.stand);
  const uebernehmbar =
    v.neu.length > 0 && (v.stand === "offen" || v.stand === "rueckfrage" || v.stand === "fehler");
  const warnend = v.stand === "fehler" || v.stand === "rueckfrage";
  return (
    <section
      data-testid="klara-textvorschlag"
      data-stand={v.stand}
      aria-label={t("klaravorschlag.titel")}
      className="rounded-card border border-hairline bg-surface px-3 py-2.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <h3 className="text-[12.5px] font-semibold text-ink">{t("klaravorschlag.titel")}</h3>
        <span
          data-testid="klara-textvorschlag-ki"
          data-ki={v.ki}
          className={
            v.ki === "ki"
              ? "rounded-pill border border-ai bg-ai-surface-1 px-1.5 py-0.5 font-mono text-klein font-semibold uppercase text-ai"
              : "rounded-pill border border-hairline px-1.5 py-0.5 font-mono text-klein font-semibold uppercase text-muted"
          }
        >
          {v.ki === "ki" ? t("klaravorschlag.ki.ki") : t("klaravorschlag.ki.ohneKi")}
        </span>
      </div>
      {/* Ziel und Bearbeitungsfassung: wohin eine Übernahme ginge — und wo sie wirkt. */}
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11.5px]">
        <dt className={KLEINTITEL}>{t("klaravorschlag.ziel")}</dt>
        <dd data-testid="klara-textvorschlag-ziel" className="text-text">
          {herkunftZeile(h, t)}{" "}
          <Link
            to={herkunftZiel(h)}
            data-testid="klara-textvorschlag-quelle"
            className="font-semibold text-brand-text hover:underline"
          >
            {t("klaravorschlag.zurQuelle")}
          </Link>
        </dd>
        <dt className={KLEINTITEL}>{t("klaravorschlag.fassung")}</dt>
        <dd data-testid="klara-textvorschlag-fassung" className="text-text">
          {h.koId
            ? v.feld
              ? t("klaravorschlag.fassungEditorFeld", { feld: t(`klaravorschlag.feld.${v.feld}`) })
              : t("klaravorschlag.fassungEditor", { titel })
            : t("klaravorschlag.fassungKeine")}
        </dd>
      </dl>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div>
          <p className={KLEINTITEL}>{t("klaravorschlag.original")}</p>
          <p
            data-testid="klara-textvorschlag-original"
            className="mt-0.5 rounded-btn bg-page px-2 py-1 text-[11.5px] leading-relaxed text-muted"
          >
            {v.original}
          </p>
        </div>
        <div>
          <p className={KLEINTITEL}>{t("klaravorschlag.neu")}</p>
          <p
            data-testid="klara-textvorschlag-neu"
            className="mt-0.5 rounded-btn bg-ai-surface-2 px-2 py-1 text-[11.5px] leading-relaxed text-text"
          >
            {v.neu || "—"}
          </p>
        </div>
      </div>
      <p
        data-testid="klara-textvorschlag-stand"
        aria-live="polite"
        className="mt-1.5 text-[11.5px] font-semibold text-text"
      >
        {t(`klaravorschlag.stand.${v.stand}`, { fassung: v.gespeichertFassung ?? "?" })}
      </p>
      {v.meldung ? (
        <p
          role={warnend ? "alert" : undefined}
          data-testid="klara-textvorschlag-meldung"
          className={
            warnend
              ? "mt-1 rounded-btn bg-trust-warn-bg px-2 py-1 text-[11.5px] leading-relaxed text-trust-warn-text"
              : "mt-1 text-[11.5px] text-muted"
          }
        >
          {v.meldung}
        </p>
      ) : null}
      {v.stand === "rueckfrage" && v.rueckfrage === "stellen" && v.stellen ? (
        <ul className="mt-1 space-y-1">
          {v.stellen.map((s) => (
            <li key={s.nr}>
              <button
                type="button"
                data-testid="klara-textvorschlag-stelle"
                data-nr={s.nr}
                data-feld={s.feld}
                onClick={() => onUebernehmen({ nr: s.nr, stand: v.stellenStand ?? "" })}
                className="w-full rounded-btn border border-hairline px-2 py-1 text-left text-[11.5px] text-text hover:border-ink/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              >
                <span className="font-semibold">{t(`klaravorschlag.feld.${s.feld}`)}:</span>{" "}
                {s.davor ? `…${s.davor} ` : ""}
                <mark className="bg-brand/30">{kuerze(v.original, 60)}</mark>
                {s.danach ? ` ${s.danach}…` : ""}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {v.stand === "rueckfrage" && v.rueckfrage === "anderes_objekt" && h.koId ? (
        <Link
          to={leserHref({ koId: h.koId, fassung: null })}
          data-testid="klara-textvorschlag-zum-objekt"
          className="mt-1 inline-flex text-[12px] font-semibold text-brand-text hover:underline"
        >
          {t("klaravorschlag.zumObjekt", { titel })}
        </Link>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {uebernehmbar && !(v.stand === "rueckfrage" && v.rueckfrage === "stellen") ? (
          <button
            type="button"
            data-testid="klara-textvorschlag-uebernehmen"
            onClick={() => onUebernehmen()}
            className={KNOPF_KI}
          >
            {t("klaravorschlag.uebernehmen")}
          </button>
        ) : null}
        {v.stand === "wartet" || v.stand === "in_bearbeitung" || ende ? null : (
          <button
            type="button"
            data-testid="klara-textvorschlag-verwerfen"
            onClick={() => {
              setzeVorschlag(v.id, { stand: "verworfen", meldung: undefined });
              aendere((z) => ({ ...z, status: "antwort" }));
            }}
            className={KNOPF}
          >
            {t("klaravorschlag.verwerfen")}
          </button>
        )}
        {ende ? (
          <button
            type="button"
            data-testid="klara-textvorschlag-schliessen"
            onClick={() => aendere((z) => ({ ...z, textvorschlag: null }))}
            className={KNOPF}
          >
            {t("klaravorschlag.schliessen")}
          </button>
        ) : null}
      </div>
    </section>
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
  if (entwurf.echt) {
    // Klara 04: der echte Notizentwurf — Inhalt und Herkunft, ohne Demo-Felder (Aufgabe,
    // Erinnerung, Termin, Demo-Speichern sind nicht freigegeben). Er bleibt in dieser Sitzung.
    return (
      <section
        data-testid="klara-entwurf"
        data-art={entwurf.art}
        data-echt="true"
        className="rounded-card border border-hairline bg-page px-3 py-2.5"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[12.5px] font-semibold text-ink">
            {t("klaravorschlag.notiz.titel")}
          </h3>
          <span
            data-testid="klara-entwurf-sitzung"
            className="rounded-pill border border-hairline px-1.5 py-0.5 font-mono text-klein font-semibold uppercase text-muted"
          >
            {t("klaravorschlag.notiz.kennzeichen")}
          </span>
        </div>
        <label htmlFor={`${id}-inhalt`} className={`${KLEINTITEL} mt-2 block`}>
          {t("klaravorschau.entwurf.inhalt")}
        </label>
        <textarea
          id={`${id}-inhalt`}
          data-testid="klara-entwurf-inhalt"
          value={entwurf.inhalt}
          rows={3}
          onChange={(e) => setze({ inhalt: e.target.value })}
          className="mt-0.5 w-full rounded-input border border-hairline bg-surface px-2 py-1.5 text-[12.5px] text-text outline-none focus:border-ink/30"
        />
        <p data-testid="klara-entwurf-herkunft" className="mt-1 text-[11.5px] text-muted">
          {herkunftZeile(entwurf.herkunft, t)}
        </p>
        <Link
          to={herkunftZiel(entwurf.herkunft)}
          data-testid="klara-entwurf-ruecklink"
          className="mt-1 inline-flex text-[12px] font-semibold text-brand-text hover:underline"
        >
          {t("klaravorschlag.notiz.ruecklink", { objekt: entwurf.herkunft.objekt })}
        </Link>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-2">
          {t("klaravorschlag.notiz.hinweis")}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {/* Klara 06: der Ausschnitt wird zur privaten Notiz am Server — mit der markierten Stelle
              als Rücklink. Der Entwurf geht in „Meine Notizen“ über; dort steht sein Speicherstand
              samt „Erneut speichern“ (derselbe Vorgang, keine Doppelnotiz). */}
          <button
            type="button"
            data-testid="klara-entwurf-als-notiz"
            disabled={!entwurf.inhalt.trim()}
            onClick={() => {
              aendere((z) => (z.entwurf?.id === entwurf.id ? { ...z, entwurf: null } : z));
              void legeNotiz(
                {
                  weg: "ausschnitt",
                  inhalt: entwurf.inhalt,
                  objektbezug: { ...objektbezugAus(entwurf.herkunft), bezug: "markierung" },
                },
                t,
              );
            }}
            className={KNOPF}
          >
            {t("klaranotiz.entwurfAlsNotiz")}
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
      </section>
    );
  }
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
