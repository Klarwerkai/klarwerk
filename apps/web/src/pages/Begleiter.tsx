// ================================================================================================
// produkt:20261010:klara-office-mac-maskottchen (KLARA-OFFICE-02) — DIE FLÄCHE DER BEGLEITAPP.
// ================================================================================================
//
// Diese Seite ist, was die native Begleitapp auf dem Mac (`apps/desktop/klara-begleiter`) in ihrem
// frei beweglichen Fenster zeigt. Sie läuft OHNE Hülle (`shell/AppShell.tsx`) und kennt zwei Lagen:
//   · FIGUR — nur die gewählte Figur mit ihrem tatsächlichen Zustand. Das Fenster ist so klein wie
//     die Figur; es verdeckt vom Dokument darunter nichts weiter.
//   · GESPRÄCH — seit produkt:20261011:assistenz-minimalistische-oberflaeche in VIER Bereichen:
//       1. Kopf: Figur, persönlicher Name, Zustand, Menü, Einklappen;
//       2. Kontextzeile: das gebundene Word-Fenster in einer Zeile — ein Klick zeigt Fenster, Host,
//          Fassung, Verbindungsweg und Datenweg;
//       3. Gespräch: Markierung mit höchstens zwei Vorschlägen (nur, wenn Word wirklich etwas
//          markiert meldet), Antworten aus Word, das eigene Klara-Gespräch (ungekürzt);
//       4. Eingabe: ein Feld, ein Mikrofon, Senden.
//     Ein laufender Vorgang ergänzt den Steuerbereich. Sprache, Figur, Verbindungen, Daten und
//     Fassungen stehen im Menü (Neues Gespräch, Verlauf, Meine Funktionen, Einstellungen, Hilfe).
// Lage, Ziehen, Andocken, Bildschirmrand und Mehrmonitor gehören der App; die Seite meldet ihr nur
// die gewünschte Lage und Tastaturschritte (`lib/begleiterBruecke.ts`).
//
// DER WORD-KONTEXT kommt AUSSCHLIESSLICH vom Office-Adapter im Word-Fenster (`word-addin/
// begleiter.js`) über den Kanal des eigenen Kontos. Ein inaktives Fenster liefert keine Auswahl;
// Fragen zur Markierung und das Einfügen laufen über dieses Word-Fenster zurück. Das Gespräch hier
// sendet keinen Dokumenttext. Verlangt eine Frage ohne verbundenes Word das Dokument, erklärt die
// Fläche den Verbindungsweg GENAU DANN — am Auftrag, nicht vorher (UI-MIN-04).
import {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import type { KlaraObjektbezug } from "../api/klaraGespraech";
import { useSession } from "../app/AuthContext";
import {
  DUNKEL_ABFRAGE,
  DUNKLE_TOKEN,
  DatenFreigaben,
  EinklappenSymbol,
  MenueListe,
  type MenueSeite,
  MenueSymbol,
  MikrofonSymbol,
  NeuSeite,
  Unterseite,
  VerlaufSeite,
  type Vorgang,
  VorgangsLeiste,
} from "../components/klara-vorschau/AssistenzMinimal";
import {
  KlaraEchtGespraech,
  useKlaraKiLage,
} from "../components/klara-vorschau/KlaraEchtGespraech";
import {
  type Absendeergebnis,
  KlaraAuftragKarte,
  KlaraSprachausgabe,
  type SprachZiel,
  useKlaraSprache,
} from "../components/klara-vorschau/KlaraSprache";
import {
  vergiss as echtVergessen,
  einwilligen,
  fehlerBild,
  fragen,
  ladeEcht,
  leseEcht,
  stoppen,
  useEchtGespraech,
} from "../components/klara-vorschau/echt";
import { auftrittAus, useAssistenzProfil } from "../components/klara-vorschau/profil";
import {
  leseVorlesen,
  stoppeVorlesen,
  useKlaraVorlesen,
  vorlesen,
} from "../components/klara-vorschau/vorlesen";
import type { Herkunft } from "../components/klara-vorschau/zustand";
import { LegalFooter } from "../legal/LegalPages";
import {
  BEGLEITER_ABRUF_MS,
  type BegleiterAdapter,
  type BegleiterKontext,
  aktionLaeuft,
  begleiterApi,
  bewegungsSchritt,
  dokumentBezogen,
  figurZustand,
  gueltigeAuswahl,
  laufendeWordAktionen,
  neuerAuftragsschluessel,
  waehleAdapter,
} from "../lib/begleiter";
import { anNative, appFassung, hoereAufNative, inBegleitApp } from "../lib/begleiterBruecke";
import {
  type BegleiterUrsprung,
  begleiterEntwurfAnKontoBinden,
  entferneBegleiterAbgewiesen,
  fuegeBegleiterAbgewiesenHinzu,
  leseBegleiterEntwurf,
  setzeBegleiterEntwurf,
  useBegleiterEntwurf,
  zielGewechselt,
} from "../lib/begleiterEntwurf";
import { toReasonerLocale } from "../lib/reasonerLocale";
import { APP_VERSION } from "../version";

/** Der zentrale Klara-Bereich in Klarwerk — der vorhandene Direktweg (`pages/Profile.tsx`). */
const KLARA_SETUP_PFAD = "/profil?bereich=klara";

const KNOPF =
  "inline-flex h-8 items-center gap-1 rounded-btn border border-hairline bg-surface px-2.5 text-[12px] font-semibold text-text hover:border-ink/30 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const KNOPF_KI =
  "inline-flex h-8 items-center rounded-btn border border-ai bg-ai-surface-2 px-2.5 text-[12px] font-semibold text-ai hover:bg-ai-surface-1 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const SYMBOL_KNOPF =
  "inline-flex shrink-0 items-center justify-center rounded-btn border border-hairline bg-surface text-text hover:border-ink/30 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const KLEINTITEL = "font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2";
const ABSCHNITT = "text-[12.5px] font-semibold text-ink";

/** Der Ring der Figur je Zustand — Farbe UND Text (der Text steht daneben, nie nur die Farbe). */
const RING: Record<string, string> = {
  ruhe: "ring-hairline",
  wartet: "ring-ai",
  antwortet: "ring-trust-pos-fill",
  fehler: "ring-trust-crit-fill",
  hoert: "ring-brand",
  spricht: "ring-brand",
};

/** Die Bedienvorliebe „reduzierte Bewegung" — im Browser gemerkt, kein Inhalt. */
const REDUZIERT_SPEICHER = "klarwerk.begleiter.reduziert";

function leseReduziert(): boolean {
  try {
    const roh = localStorage.getItem(REDUZIERT_SPEICHER);
    if (roh === "an" || roh === "aus") {
      return roh === "an";
    }
  } catch {
    // ohne Speicher: Systemvorgabe
  }
  return typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

function merkeReduziert(an: boolean): void {
  try {
    localStorage.setItem(REDUZIERT_SPEICHER, an ? "an" : "aus");
  } catch {
    // gilt dann bis zum Neuladen
  }
}

function kuerze(text: string, max: number): string {
  const glatt = text.replace(/\s+/g, " ").trim();
  return glatt.length > max ? `${glatt.slice(0, max - 1)}…` : glatt;
}

/**
 * Nacharbeit 57 (UI-MIN-06/07/14): hat der Kanal eine Beauftragung NACHWEISLICH abgelehnt? Nur eine
 * gelesene 4xx-Antwort (ausser 408) belegt das — die Route prüft vor dem Anlegen. Verbindungs-,
 * Lese- und Parsefehler sowie 5xx/408 lassen offen, ob die Aktion schon angelegt ist.
 */
function ablehnungBelegt(fehler: unknown): boolean {
  if (!(fehler instanceof ApiError)) {
    return false;
  }
  return fehler.status >= 400 && fehler.status < 500 && fehler.status !== 408;
}

/** UI-MIN-16: die Systemdarstellung, live (Wechsel während die App läuft). */
function useDunkel(): boolean {
  const lies = (): boolean =>
    typeof window.matchMedia === "function" && window.matchMedia(DUNKEL_ABFRAGE).matches;
  const [dunkel, setDunkel] = useState(lies);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const mq = window.matchMedia(DUNKEL_ABFRAGE);
    const neu = (): void => setDunkel(mq.matches);
    neu();
    mq.addEventListener?.("change", neu);
    return () => mq.removeEventListener?.("change", neu);
  }, []);
  return dunkel;
}

type Ausstehend = "frage";

export function Begleiter(): JSX.Element {
  const { t, i18n } = useTranslation();
  const sitzung = useSession();
  const kontoId = sitzung.user?.id ?? null;
  const echt = useEchtGespraech();
  const ki = useKlaraKiLage();
  const vorlese = useKlaraVorlesen();
  const auftritt = auftrittAus(useAssistenzProfil());
  const name = auftritt.name ?? t("klaraprodukt.name.neutral");
  const app = inBegleitApp();
  const appStand = appFassung();
  const eingabeId = useId();
  const menueId = useId();
  const dunkel = useDunkel();
  const farbStil: CSSProperties = dunkel ? DUNKLE_TOKEN : {};

  const [offen, setOffen] = useState(false);
  const [reduziert, setReduziert] = useState(leseReduziert);
  // Nacharbeit 5 (UI-MIN-12): EIN Entwurf, kontogebunden in der Sitzung, samt Ursprung
  // (`lib/begleiterEntwurf.ts`) — übersteht Einklappen, Wiederöffnen und Neuladen.
  const entwurf = useBegleiterEntwurf();
  const eingabe = entwurf.kontoId === kontoId ? entwurf.text : "";
  const kontoIdRef = useRef(kontoId);
  kontoIdRef.current = kontoId;
  const sitzungBeantwortet = !sitzung.isLoading && sitzung.sitzungslage !== "unbeantwortet";
  useEffect(() => {
    if (sitzungBeantwortet) {
      begleiterEntwurfAnKontoBinden(kontoId);
    }
  }, [sitzungBeantwortet, kontoId]);
  /** UI-MIN-12: ein Entwurf, begonnen an einem anderen Word-Ziel als dem jetzigen. */
  const [zielFrage, setZielFrage] = useState<BegleiterUrsprung | null>(null);
  const [kontext, setKontext] = useState<BegleiterKontext | null>(null);
  const [kontextFehler, setKontextFehler] = useState<string | null>(null);
  /**
   * UI-MIN-06/14 (Ben, Nacharbeit 54 · MAC5-01): ob der jüngste Kontextabruf GELUNGEN ist. Nur dann
   * ist „keine Word-Aktion läuft“ eine bestätigte Aussage; vor der ersten Antwort und nach einem
   * Fehler ist der Stand unbekannt.
   */
  const [kontextBestaetigt, setKontextBestaetigt] = useState(false);
  /**
   * Die zuletzt BESTÄTIGT laufenden Word-Aktionen — getrennt vom Auswahlkontext und an das Konto
   * gebunden. Ein gescheiterter Abruf verwirft die Auswahl (kein alter Dokumenttext als aktuelle
   * Auswahl), aber nicht diese Liste: sie bleibt als „unbestätigt“ sichtbar und stoppbar, bis ein
   * gelungener Abruf ihr Ende zeigt.
   */
  const [bekannteAktionen, setBekannteAktionen] = useState<{
    kontoId: string | null;
    liste: ReturnType<typeof laufendeWordAktionen>;
  }>({ kontoId: null, liste: [] });
  /**
   * UI-MIN-06/14 (Ben, Nacharbeit 56 · MAC5-01-REST): EIGENE Beauftragungen, unabhängig vom
   * Kontextabruf und an das Konto gebunden.
   *   · `ausstehend`: der Auftrag ist abgeschickt, der Kanal hat noch nicht geantwortet — er zählt
   *     sofort als laufender Vorgang (noch ohne Stopp, weil es noch keine Kennung gibt).
   *   · `angenommen`: der Kanal hat ihn mit Kennung angenommen — er bleibt mit Stopp sichtbar, bis
   *     ein Kontextabruf, der NACH der Annahme gestartet wurde (`abAbruf`), den Stand liefert. Ein
   *     älterer Abruf (vor oder während der Beauftragung gestartet) bestätigt keinen Leerlauf.
   *   · `unklar` (Nacharbeit 57): der Auftrag ging hinaus, eine Antwort mit Kennung kam aber nicht
   *     an (Verbindung, Lesen, Parsen, Serverfehler). Der Kanal kann ihn angenommen haben — er zählt
   *     weiter als Vorgang. Nacharbeit 58 (Ben, MACG57-POST-GET-01): KEIN Kontextabruf löst ihn auf —
   *     auch ein jüngerer leerer nicht, denn der ursprüngliche POST kann noch vor dem Anlegen warten.
   *     Aufgelöst wird er nur durch die auftragsbezogene Klärung seines `schluessel`
   *     (`begleiterApi.klaere`): `angenommen` ⇒ weiter als angenommene Aktion mit Kennung und Stopp;
   *     `nicht_angelegt` ⇒ der Kanal hat den Schlüssel gesperrt, ein verspäteter POST legt nichts an.
   *     Scheitert die Klärung, bleibt die Ungewissheit und sie wird wiederholt. Der Auftrag selbst
   *     wird NICHT erneut gesendet.
   */
  const abrufNummerRef = useRef(0);
  /**
   * Nacharbeit 59: die Serverzeit (`jetzt`) des zuletzt gelesenen Kontexts dieses Kontos — der
   * Ausstellungszeitpunkt eines Auftrags. Der Kanal nimmt ältere Aufträge nie mehr an; nur so ist
   * „nicht angelegt“ nach einer Klärung dauerhaft wahr.
   */
  // Nacharbeit 64: dazu die Kanalinstanz desselben Kontexts (Bestandskontinuität).
  const serverZeitRef = useRef<{ kontoId: string | null; jetzt: string; kanal: string } | null>(
    null,
  );
  const [eigene, setEigene] = useState<{
    kontoId: string | null;
    ausstehend: number;
    angenommen: Array<{
      instanz: string;
      titel: string;
      aktion: BegleiterAdapter["aktionen"][number];
      abAbruf: number;
      /**
       * Nacharbeit 65 (Ben): die Kanalinstanz, die die Annahme belegt. Nur ein Abruf DERSELBEN
       * Instanz darf den Eintrag über `abAbruf` auflösen; eine andere (Serverneustart) erst über
       * die Bestandsmeldung des Fensters (`vorNeustart`).
       */
      kanal: string;
    }>;
    unklar: Array<{
      schluessel: string;
      instanz: string;
      titel: string;
      ausgestelltAm: string;
      kanal: string;
    }>;
  }>({ kontoId: null, ausstehend: 0, angenommen: [], unklar: [] });
  /**
   * Nacharbeit 64 (Ben): nach einem Serverneustart (neue Kanalinstanz) ist der Bestand des Kanals
   * verloren — das belegt KEIN Ende. Alles, was vorher als laufend bekannt war, bleibt deshalb
   * (unbestätigt, mit Stopp) stehen, bis sein Word-Fenster sich in der neuen Instanz mit seinem
   * Bestand gemeldet hat: läuft es dort noch, zeigt es der Kontext selbst (übernommen); sonst läuft
   * dazu nachweislich nichts mehr.
   */
  const [vorNeustart, setVorNeustart] = useState<{
    kontoId: string | null;
    liste: Array<{ instanz: string; titel: string; aktion: BegleiterAdapter["aktionen"][number] }>;
  }>({ kontoId: null, liste: [] });
  const kanalRef = useRef<{ kontoId: string; kanal: string } | null>(null);
  /**
   * Nacharbeit 66 (Ben): angeforderte Stopps je Aktion (Fenster, Kanalinstanz der Anforderung) —
   * bis ihr Ende belegt ist. Zeigt der Kontext dieselbe Aktion laufend OHNE Abbruchanforderung
   * (etwa nach einem Neustart vom Fenster neu gemeldet), geht der Stopp erneut hinaus. Neu
   * beauftragt wird dabei nichts.
   */
  // Nacharbeit 67 (Ben): nicht die Kanalinstanz beim Klick zählt — sie beweist nicht, dass die
  // Aktion dort übernommen war —, sondern die, in der die Aktion tatsächlich GESEHEN wurde
  // (`gesehenIn`); und nur Abrufe, die nach dem Klick gestartet wurden (`abAbruf`).
  const stoppRef = useRef<{
    kontoId: string | null;
    wuensche: Map<string, { instanz: string; abAbruf: number; gesehenIn: string | null }>;
  }>({ kontoId: null, wuensche: new Map() });
  const eigeneRef = useRef(eigene);
  eigeneRef.current = eigene;
  const bekannteRef = useRef(bekannteAktionen);
  bekannteRef.current = bekannteAktionen;
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [aktionFehler, setAktionFehler] = useState<string | null>(null);
  const [jetzt, setJetzt] = useState(() => Date.now());
  // Grundansicht (UI-MIN): Menü, Unterseite, Rückfragen genau dann, wenn sie nötig sind.
  const [menueOffen, setMenueOffen] = useState(false);
  const [menueSeite, setMenueSeite] = useState<MenueSeite | null>(null);
  const [einwilligungFuer, setEinwilligungFuer] = useState<Ausstehend | null>(null);
  const [nachEinwilligung, setNachEinwilligung] = useState<Ausstehend | null>(null);
  /** UI-MIN-04: die Frage, die das Dokument braucht, solange Word nicht verbunden ist. */
  const [wordHilfeFuer, setWordHilfeFuer] = useState<string | null>(null);
  const [kiAusGezeigt, setKiAusGezeigt] = useState(false);
  const figurRef = useRef<HTMLButtonElement | null>(null);
  const menueKnopfRef = useRef<HTMLButtonElement>(null);
  const menueErsterRef = useRef<HTMLButtonElement>(null);
  const zurueckRef = useRef<HTMLButtonElement>(null);
  const eingabeRef = useRef<HTMLInputElement>(null);
  /** UI-MIN-06/14 (Nacharbeit 47): die zuletzt gezeigte Zahl laufender Vorgänge — für die App. */
  const vorgaengeAnzahlRef = useRef(0);

  // Die Seite ist durchsichtig: in der Lage FIGUR ist nur die Figur zu sehen, nicht ein Kasten.
  useEffect(() => {
    const html = document.documentElement.style.background;
    const body = document.body.style.background;
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    return () => {
      document.documentElement.style.background = html;
      document.body.style.background = body;
    };
  }, []);

  // BPA-01 AC10: jeder Wechsel der Anmeldung geht an die App — sie entwertet die Browserkarte
  // sofort und gibt sie erst nach eigener Prüfung beim Server wieder frei. Kein Konto im Rumpf.
  const gemeldetesKonto = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (gemeldetesKonto.current !== kontoId) {
      gemeldetesKonto.current = kontoId;
      anNative({ art: "anmeldung" });
    }
  }, [kontoId]);

  // Das eigene Gespräch — dieselbe Ablage wie Klara im Produkt.
  useEffect(() => {
    if (!kontoId) {
      echtVergessen();
      stoppeVorlesen();
      return;
    }
    void ladeEcht(kontoId, t);
  }, [kontoId, t]);

  // Der Word-Kontext — nur unter der eigenen Anmeldung, im Takt gelesen.
  useEffect(() => {
    // Kontowechsel bzw. Abmeldung: nichts vom vorigen Konto bleibt — weder Auswahl noch Aktionen.
    // (Läuft der Effekt nur wegen eines Sprachwechsels neu, bleiben die Aktionen desselben Kontos.)
    setKontext(null);
    setKontextBestaetigt(false);
    setBekannteAktionen((alt) => (alt.kontoId === kontoId ? alt : { kontoId, liste: [] }));
    setEigene((alt) =>
      alt.kontoId === kontoId ? alt : { kontoId, ausstehend: 0, angenommen: [], unklar: [] },
    );
    setVorNeustart((alt) => (alt.kontoId === kontoId ? alt : { kontoId, liste: [] }));
    if (!kontoId) {
      return;
    }
    let beendet = false;
    // Überholte Antworten: nur eine JÜNGERE Anfrage darf den Stand überschreiben — eine langsame
    // ältere Antwort setzt einen frischeren Vorgangsstand nicht zurück. Die Nummer zählt über die
    // ganze Fläche (`abrufNummerRef`), damit eigene Beauftragungen ihr „ab hier frisch“ kennen.
    let angewandt = 0;
    const lies = async (): Promise<void> => {
      abrufNummerRef.current += 1;
      const nummer = abrufNummerRef.current;
      try {
        const k = await begleiterApi.kontext();
        if (beendet || nummer < angewandt) {
          return;
        }
        angewandt = nummer;
        const kanal = k.kanal ?? "";
        serverZeitRef.current = { kontoId, jetzt: k.jetzt, kanal };
        // Nacharbeit 64: neue Kanalinstanz ⇒ alles bisher als laufend Bekannte bleibt unbestätigt
        // stehen (Bestand verloren ≠ beendet) — aus dem letzten Kontext und den eigenen Annahmen.
        const vorher = kanalRef.current;
        if (vorher && vorher.kontoId === kontoId && vorher.kanal !== kanal) {
          const bekannt = bekannteRef.current.kontoId === kontoId ? bekannteRef.current.liste : [];
          const eigen = eigeneRef.current.kontoId === kontoId ? eigeneRef.current.angenommen : [];
          const bisher = [
            ...bekannt.map((b) => ({
              instanz: b.adapter.instanz,
              titel: b.adapter.dokument.titel,
              aktion: b.aktion,
            })),
            ...eigen.map((e) => ({ instanz: e.instanz, titel: e.titel, aktion: e.aktion })),
          ];
          setVorNeustart((alt) => {
            const liste = alt.kontoId === kontoId ? [...alt.liste] : [];
            for (const b of bisher) {
              if (!liste.some((x) => x.aktion.id === b.aktion.id)) {
                liste.push(b);
              }
            }
            return { kontoId, liste };
          });
        }
        kanalRef.current = { kontoId, kanal };
        // Belegt erledigt ist ein Eintrag erst, wenn sein Fenster in DIESER Instanz seinen Bestand
        // gemeldet hat — läuft die Aktion dort noch, steht sie im Kontext selbst (übernommen).
        setVorNeustart((alt) =>
          alt.kontoId !== kontoId
            ? alt
            : {
                kontoId,
                liste: alt.liste.filter((e) => {
                  const f = k.adapter.find((a) => a.instanz === e.instanz);
                  return !f?.bestand && !f?.aktionen.some((x) => x.id === e.aktion.id);
                }),
              },
        );
        // Nacharbeit 66 (Ben): angeforderte Stopps bis zum belegten Ende verfolgen und, wo der
        // Kanal sie verloren hat, erneut zustellen.
        const stopps = stoppRef.current.kontoId === kontoId ? stoppRef.current.wuensche : null;
        for (const [aktionId, wunsch] of stopps ?? []) {
          // Ein vor dem Klick gestarteter Abruf belegt nichts über diesen Wunsch.
          if (nummer <= wunsch.abAbruf) {
            continue;
          }
          const fenster = k.adapter.find((a) => a.instanz === wunsch.instanz);
          const aktion = fenster?.aktionen.find((x) => x.id === aktionId);
          if (aktion) {
            wunsch.gesehenIn = kanal;
            if (aktion.stand !== "offen" && aktion.stand !== "uebergeben") {
              stopps?.delete(aktionId); // beendet: Words Ende ist belegt
            } else if (!aktion.abbruchAngefordert) {
              // Läuft weiter, aber der Kanal kennt den Stopp nicht (mehr): erneut zustellen.
              void begleiterApi.stoppe(wunsch.instanz, aktionId).catch(() => undefined);
            }
          } else if (wunsch.gesehenIn === kanal || fenster?.bestand === true) {
            // Belegtes Ende: in DIESER Instanz gesehen und nun fort, oder das Fenster hat hier
            // seinen vollständigen Bestand gemeldet — ohne diese Aktion. Fehlt das Fenster bzw.
            // seine Bestandsmeldung (Wiederanmeldung nach Neustart noch offen), bleibt der Wunsch.
            stopps?.delete(aktionId);
          }
        }
        setKontext(k);
        setKontextFehler(null);
        setKontextBestaetigt(true);
        setBekannteAktionen({ kontoId, liste: laufendeWordAktionen(k) });
        // Angenommene eigene Aufträge: ein Abruf, der NACH ihrer Annahme gestartet wurde, ist
        // maßgeblich — läuft der Auftrag, zeigt ihn der Kontext selbst; sonst ist sein Ende belegt.
        // (Sicher, weil die Aktion bei ihrer Annahme schon im Kanal lag.) Aufträge mit UNKLAREM
        // Ausgang löst ein Abruf dagegen nie auf — nur ihre Klärung (Nacharbeit 58).
        // Nacharbeit 65 (Ben): das gilt nur für Annahmen DERSELBEN Kanalinstanz. Eine Annahme aus
        // einer anderen (etwa eine verspätete Antwort von vor einem Neustart) löst ein Abruf nicht
        // auf — sie wandert in `vorNeustart` und bleibt mit Stopp, bis ihr Fenster in dieser
        // Instanz seinen Bestand gemeldet hat oder der Kontext die Aktion selbst zeigt.
        const fremd =
          eigeneRef.current.kontoId === kontoId
            ? eigeneRef.current.angenommen.filter((e) => e.kanal !== kanal)
            : [];
        if (fremd.length > 0) {
          setVorNeustart((alt) => {
            const liste = alt.kontoId === kontoId ? [...alt.liste] : [];
            for (const e of fremd) {
              if (!liste.some((x) => x.aktion.id === e.aktion.id)) {
                liste.push({ instanz: e.instanz, titel: e.titel, aktion: e.aktion });
              }
            }
            return { kontoId, liste };
          });
        }
        const verschoben = new Set(fremd.map((e) => e.aktion.id));
        setEigene((alt) =>
          alt.kontoId !== kontoId
            ? alt
            : {
                ...alt,
                angenommen: alt.angenommen.filter((e) =>
                  e.kanal === kanal ? nummer <= e.abAbruf : !verschoben.has(e.aktion.id),
                ),
              },
        );
      } catch (fehler) {
        if (beendet || nummer < angewandt) {
          return;
        }
        angewandt = nummer;
        // Ohne frische Antwort keine Auswahl: der alte Stand wird verworfen, nicht weiter gezeigt.
        // Die zuletzt bestätigt laufenden Aktionen bleiben dagegen (unbestätigt) samt Stopp.
        setKontext(null);
        setKontextBestaetigt(false);
        setKontextFehler(fehlerBild(fehler, t).text);
      }
      setJetzt(Date.now());
    };
    void lies();
    const uhr = window.setInterval(() => void lies(), BEGLEITER_ABRUF_MS);
    return () => {
      beendet = true;
      window.clearInterval(uhr);
    };
  }, [kontoId, t]);

  // Nacharbeit 58 (Ben, MACG57-POST-GET-01): jeder Auftrag mit unklarem Ausgang wird über SEINEN
  // Schlüssel geklärt — sofort und, solange die Klärung selbst scheitert, im Takt des Kontextabrufs.
  // Das Ergebnis ist endgültig: `angenommen` (genau diese Aktion, weiter mit Kennung und Stopp) oder
  // `nicht_angelegt` (der Kanal hat den Schlüssel gesperrt). Der Auftrag wird nie erneut gesendet.
  // Nacharbeit 63/64: je Auftrag „Schlüssel|Ausstellungszeitpunkt|Kanalinstanz|Fenster“ — die
  // Klärung braucht alles davon.
  const unklarSchluessel =
    eigene.kontoId === kontoId
      ? eigene.unklar
          .map((e) => `${e.schluessel}|${e.ausgestelltAm}|${e.kanal}|${e.instanz}`)
          .join(" ")
      : "";
  useEffect(() => {
    if (!kontoId || unklarSchluessel === "") {
      return;
    }
    let beendet = false;
    const unterwegs = new Set<string>();
    const klaere = (auftrag: {
      schluessel: string;
      ausgestelltAm: string;
      kanal: string;
      instanz: string;
    }): void => {
      const schluessel = auftrag.schluessel;
      if (unterwegs.has(schluessel)) {
        return;
      }
      unterwegs.add(schluessel);
      void begleiterApi
        .klaere(auftrag)
        .then((k) => {
          if (beendet) {
            return;
          }
          // Nacharbeit 64: Auftrag aus der Zeit vor einem Serverneustart, sein Fenster hat sich
          // noch nicht gemeldet — nichts ist belegt. Der Vorgang bleibt (keine 0), gefragt wird
          // weiter; nichts wird neu gesendet.
          if (k.stand === "offen") {
            setAktionFehler(t("begleiter.aktion.ausgangOffenNeustart"));
            return;
          }
          // Erst NACH dieser Antwort gestartete Abrufe sehen die (schon angelegte) Aktion sicher.
          const abAbruf = abrufNummerRef.current;
          setEigene((alt) => {
            const e = alt.unklar.find((x) => x.schluessel === schluessel);
            if (alt.kontoId !== kontoId || !e) {
              return alt;
            }
            const unklar = alt.unklar.filter((x) => x.schluessel !== schluessel);
            if (k.stand !== "angenommen") {
              return { ...alt, unklar };
            }
            const aktion = { ...k.aktion, ergebnis: null, grund: null };
            // Nacharbeit 65: Herkunft = die Kanalinstanz, die die Annahme belegt.
            const kanal = k.kanal ?? auftrag.kanal;
            const eintrag = { instanz: k.instanz, titel: e.titel, aktion, abAbruf, kanal };
            return { ...alt, unklar, angenommen: [...alt.angenommen, eintrag] };
          });
          // `unbekannt` (Nacharbeit 63): nicht mehr sicher klärbar — es wird nichts behauptet außer
          // dem, was sicher ist: angenommen werden kann er nicht mehr, und dazu läuft nichts.
          // `nicht_laufend` (Nacharbeit 64): nach einem Neustart hat das Zielfenster seinen Bestand
          // gemeldet und führt den Auftrag nicht aus — ob er je angenommen war, bleibt offen.
          setAktionFehler(
            k.stand === "angenommen"
              ? null
              : k.stand === "unbekannt"
                ? t("begleiter.aktion.ausgangUnbekannt")
                : k.stand === "nicht_laufend"
                  ? t("begleiter.aktion.nichtLaufendNachNeustart")
                  : t("begleiter.aktion.nichtAngelegtGeklaert"),
          );
        })
        .catch(() => {
          // Klärung gescheitert: die Ungewissheit bleibt sichtbar; der nächste Takt fragt erneut.
        })
        .finally(() => {
          unterwegs.delete(schluessel);
        });
    };
    const alle = (): void => {
      for (const eintrag of unklarSchluessel.split(" ")) {
        const [schluessel = "", ausgestelltAm = "", kanal = "", instanz = ""] = eintrag.split("|");
        klaere({ schluessel, ausgestelltAm, kanal, instanz });
      }
    };
    alle();
    const uhr = window.setInterval(alle, BEGLEITER_ABRUF_MS);
    return () => {
      beendet = true;
      window.clearInterval(uhr);
    };
  }, [kontoId, unklarSchluessel, t]);

  const adapter: BegleiterAdapter | null = waehleAdapter(kontext, gewaehlt);
  const auswahl = gueltigeAuswahl(adapter);
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  /** Das Word-Ziel in diesem Augenblick — Fenster, Host, Titel, Auswahlstand (kein Text). */
  const ursprungJetzt = (): BegleiterUrsprung => {
    const a = adapterRef.current;
    if (!a) {
      return { instanz: null, titel: null, host: null, auswahlStand: 0 };
    }
    return {
      instanz: a.instanz,
      titel: a.dokument.titel || null,
      host: a.host,
      auswahlStand: gueltigeAuswahl(a)?.stand ?? 0,
    };
  };
  /** Getippt oder diktiert: ein NEUER Entwurf merkt sich sein Ziel beim ersten Zeichen. */
  const setEingabe = (neu: string | ((alt: string) => string)): void => {
    const alt = leseBegleiterEntwurf().text;
    setzeBegleiterEntwurf(
      kontoIdRef.current,
      typeof neu === "function" ? neu(alt) : neu,
      ursprungJetzt(),
    );
  };

  // Die Lage des Fensters und die Fassung gehen an die App; im Browser bleibt das ohne Wirkung.
  useEffect(() => {
    anNative({ art: "bereit", webFassung: APP_VERSION });
    // Verlässt die Seite die Fläche (abgemeldet → Anmeldemaske), braucht die App ein grosses Fenster:
    // eine Anmeldung in Figurgrösse wäre unbedienbar.
    return () => {
      anNative({ art: "modus", modus: "gespraech" });
    };
  }, []);
  useEffect(() => {
    anNative({ art: "reduziert", an: reduziert });
  }, [reduziert]);
  // UI-MIN-15 (Nacharbeit 46): die Titelleiste des Mac-Fensters trägt denselben Namen wie der Kopf —
  // den gewählten aus dem Profil, sonst die neutrale Bezeichnung.
  useEffect(() => {
    anNative({ art: "name", name });
  }, [name]);

  const setzeReduziert = useCallback((an: boolean): void => {
    setReduziert(an);
    merkeReduziert(an);
  }, []);

  useEffect(
    () =>
      hoereAufNative((befehl, wert) => {
        if (befehl === "vorgaenge-melden") {
          // Die App blendet beim Schließen erst aus, wenn diese Antwort „0“ sagt.
          anNative({
            art: "vorgaenge",
            anzahl: vorgaengeAnzahlRef.current,
            ...(wert === undefined ? {} : { anfrage: wert }),
          });
        } else if (befehl === "einstellungen-oeffnen") {
          // MAC-04/UI-05 (Nacharbeit 54): der übliche Mac-Weg führt in den vorhandenen Bereich
          // „Einstellungen“ — Entwurf, Gespräch und die Vorgangsleiste mit ihren Stopps bleiben.
          setOffen(true);
          setMenueOffen(false);
          setMenueSeite("einstellungen");
        } else if (befehl === "figur-klick") {
          setOffen((o) => !o);
        } else if (befehl === "gespraech-oeffnen") {
          setOffen(true);
        } else if (befehl === "gespraech-schliessen") {
          setOffen(false);
        } else if (befehl === "reduziert-an" || befehl === "reduziert-aus") {
          setzeReduziert(befehl === "reduziert-an");
        }
      }),
    [setzeReduziert],
  );

  // Geschlossen beginnt das nächste Öffnen wieder in der Grundansicht. Die Word-Verbindungshilfe
  // bleibt dagegen stehen, bis verbunden oder „Ohne Dokument fragen“ gewählt ist (Nacharbeit 5).
  useEffect(() => {
    if (!offen) {
      setMenueOffen(false);
      setMenueSeite(null);
      setEinwilligungFuer(null);
      setZielFrage(null);
      setKiAusGezeigt(false);
    }
  }, [offen]);
  useEffect(() => {
    if (menueOffen) {
      menueErsterRef.current?.focus({ preventScroll: true });
    }
  }, [menueOffen]);
  useEffect(() => {
    if (menueSeite) {
      zurueckRef.current?.focus({ preventScroll: true });
    }
  }, [menueSeite]);

  // Gesprächsbezug: die Begleitapp, mit dem Namen des gebundenen Word-Dokuments als Objekt.
  const objekt = adapter
    ? adapter.dokument.titel || t("begleiter.kontext.ohneTitel")
    : t("begleiter.figur.ohneWord");
  const herkunft: Herkunft = {
    pfad: "/begleiter",
    seite: "andere",
    seitenName: t("begleiter.gespraech.bezug"),
    objekt,
  };
  const bezug: KlaraObjektbezug = {
    pfad: herkunft.pfad,
    seitenName: herkunft.seitenName,
    objekt: herkunft.objekt,
  };
  const herkunftRef = useRef(herkunft);
  herkunftRef.current = herkunft;

  const sendebereit =
    Boolean(echt.gespraech?.einwilligungAm) &&
    !ki.abgeschaltet &&
    echt.laeuftSeit === null &&
    echt.laden === "bereit";

  const fragenSenden = async (text: string, ziel?: Herkunft): Promise<Absendeergebnis> => {
    if (!sendebereit) {
      return { stand: "nicht_gesendet", antwort: null };
    }
    const h = ziel ?? herkunftRef.current;
    const stand = await fragen(
      text,
      { pfad: h.pfad, seitenName: h.seitenName, objekt: h.objekt },
      toReasonerLocale(i18n.language),
      t,
    );
    if (stand === "veraltet") {
      return { stand: "nicht_gesendet", antwort: null };
    }
    const letzte = [...leseEcht().nachrichten].reverse().find((n) => n.von === "klara");
    return { stand, antwort: letzte?.text ?? null };
  };

  const sprechen = useKlaraSprache({
    setzeEingabe: setEingabe,
    ziel: (): SprachZiel => ({
      seitenName: herkunftRef.current.seitenName,
      objekt: herkunftRef.current.objekt,
      bekannt: true,
      herkunft: herkunftRef.current,
    }),
  });
  // Geschlossen hört die Figur nicht mehr zu — kein Mikrofon ohne sichtbaren Stopp.
  const aufnahmeAbbrechen = sprechen.abbrechen;
  useEffect(() => {
    if (!offen) {
      aufnahmeAbbrechen();
    }
  }, [offen, aufnahmeAbbrechen]);

  // „Antworten automatisch vorlesen" (Klara 02) — nur, wenn die Person es eingeschaltet hat.
  const letzteKlara = [...echt.nachrichten].reverse().find((n) => n.von === "klara") ?? null;
  const letzteId = letzteKlara?.id ?? null;
  const gelesenRef = useRef<string | null>(letzteId);
  useEffect(() => {
    if (letzteId === null || letzteId === gelesenRef.current) {
      return;
    }
    gelesenRef.current = letzteId;
    if (
      letzteKlara &&
      (letzteKlara.modus === "ki" || letzteKlara.modus === "ohne_ki") &&
      leseVorlesen().auto
    ) {
      vorlesen(letzteId, letzteKlara.text, i18n.language);
    }
  }, [letzteId, letzteKlara, i18n.language]);

  // Die Figur folgt dem tatsächlichen Zustand.
  const zustand = figurZustand({
    wartet: echt.laeuftSeit !== null || laufendeWordAktionen(kontext).length > 0,
    hoert: sprechen.laeuft !== null,
    liest: vorlese.liest !== null,
    letzteModus: letzteKlara?.modus ?? null,
    letzteAm: letzteKlara ? Date.parse(letzteKlara.angelegtAm) : null,
    stoerung: echt.laden === "fehler" || kontextFehler !== null,
    jetzt,
  });
  useEffect(() => {
    anNative({ art: "zustand", zustand });
  }, [zustand]);
  const zustandText = t(`begleiter.figur.zustand.${zustand}`);

  // ---------------------------------------------------------------------------------------------
  // Senden: Einwilligung beim ersten Senden; die Word-Verbindungshilfe genau beim Auftrag, der das
  // Dokument braucht; die KI-Sperre wird am Auftrag erklärt. Der Entwurf verlässt das Feld erst,
  // wenn die Frage wirklich an den Frageweg geht.
  // ---------------------------------------------------------------------------------------------
  const wordVerbunden = Boolean(adapter?.aktiv);
  /**
   * Der allgemeine Frageweg (ohne Dokumenttext). Der Entwurf verlässt das Feld erst mit der
   * Übergabe; kommt er nicht an und steht inzwischen neuer Text im Feld, wird er SEPARAT
   * aufbewahrt (Zurückholen/Verwerfen) — nie still verworfen.
   */
  const allgemeinSenden = (): void => {
    const e0 = leseBegleiterEntwurf();
    const roh = e0.text;
    const frage = roh.trim();
    if (!frage || !sendebereit) {
      return;
    }
    const ursprung = e0.ursprung;
    const konto = kontoIdRef.current;
    setWordHilfeFuer(null);
    setEingabe("");
    void fragenSenden(frage).then((r) => {
      if (r.stand !== "nicht_gesendet" || kontoIdRef.current !== konto) {
        return;
      }
      if (!leseBegleiterEntwurf().text.trim()) {
        setzeBegleiterEntwurf(konto, roh, ursprung);
      } else {
        fuegeBegleiterAbgewiesenHinzu(konto, roh, ursprung);
      }
    });
  };
  /**
   * Der gebundene Hostweg (UI-MIN-03/04): die Frage geht an GENAU dieses Word-Fenster mit GENAU
   * diesem Auswahlstand; Word beantwortet sie mit seinen eigenen Regeln. Der Entwurf verlässt das Feld
   * erst, wenn der Kanal den Auftrag angenommen hat — und nur, wenn das Feld ihn noch unverändert trägt.
   */
  const anWordSenden = async (instanz: string, auswahlStand: number): Promise<void> => {
    const roh = leseBegleiterEntwurf().text;
    const frage = roh.trim();
    if (!frage) {
      return;
    }
    setZielFrage(null);
    setWordHilfeFuer(null);
    const ok = await beauftrage("frage", frage, instanz, auswahlStand);
    if (ok && leseBegleiterEntwurf().text === roh) {
      setEingabe("");
    }
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: nur die erreichte Sendebereitschaft löst aus.
  useEffect(() => {
    if (nachEinwilligung && sendebereit) {
      setNachEinwilligung(null);
      allgemeinSenden();
    }
  }, [nachEinwilligung, sendebereit]);
  const senden = (e: FormEvent): void => {
    e.preventDefault();
    const frage = eingabe.trim();
    if (!frage) {
      return;
    }
    // UI-MIN-03/04 (Nacharbeit 5): eine Frage, die das Dokument meint, geht über den gebundenen
    // Hostweg — getippt wie diktiert. Ohne Verbindung bleibt die Verbindungshilfe wirksam, bei jedem
    // Versuch, bis Word verbunden ist oder ausdrücklich „Ohne Dokument fragen“ gewählt wurde.
    if (dokumentBezogen(frage)) {
      const a = adapter;
      if (!a || !a.aktiv) {
        setWordHilfeFuer(frage);
        return;
      }
      const jetzt = { instanz: a.instanz, auswahlStand: auswahl?.stand ?? 0 };
      const ursprung = leseBegleiterEntwurf().ursprung;
      // UI-MIN-12: anderes Fenster, andere Markierung oder ohne Word begonnen — erst klären.
      if (zielGewechselt(ursprung, jetzt)) {
        setZielFrage(ursprung);
        return;
      }
      void anWordSenden(jetzt.instanz, jetzt.auswahlStand);
      return;
    }
    if (ki.abgeschaltet) {
      setKiAusGezeigt(true);
      return;
    }
    if (echt.laden !== "bereit" || echt.laeuftSeit !== null) {
      return;
    }
    if (!echt.gespraech?.einwilligungAm) {
      setEinwilligungFuer("frage");
      return;
    }
    allgemeinSenden();
  };
  const einwilligenUndSenden = (): void => {
    void einwilligen(true, bezug, t).then((ok) => {
      if (ok) {
        setEinwilligungFuer(null);
        setNachEinwilligung("frage");
      }
    });
  };

  // Was eingefügt würde: die jüngste Antwort aus Word, sonst die jüngste Antwort im Gespräch.
  const wordAntwort =
    [...(adapter?.aktionen ?? [])]
      .reverse()
      .find((a) => a.art === "frage" && a.stand === "erledigt" && a.ergebnis)?.ergebnis ?? null;
  const gespraechAntwort =
    letzteKlara && (letzteKlara.modus === "ki" || letzteKlara.modus === "ohne_ki")
      ? letzteKlara.text
      : null;
  const einfuegeText = wordAntwort ?? gespraechAntwort;

  /**
   * Beauftragt GENAU das angegebene Word-Fenster (Vorgabe: das gebundene, mit seinem aktuellen
   * Auswahlstand). `true`, wenn der Kanal den Auftrag angenommen hat.
   */
  const beauftrage = async (
    art: "einfuegen" | "frage",
    text: string,
    instanz: string | null = adapter?.instanz ?? null,
    auswahlStand: number = auswahl?.stand ?? 0,
  ): Promise<boolean> => {
    if (!instanz) {
      return false;
    }
    setAktionFehler(null);
    const konto = kontoIdRef.current;
    // Nacharbeit 59: ohne Serverzeit eines gelesenen Kontexts dieses Kontos geht kein Auftrag hinaus.
    const serverZeit = serverZeitRef.current;
    if (!konto || serverZeit?.kontoId !== konto || !serverZeit.kanal) {
      setAktionFehler(
        t("begleiter.aktion.nichtBeauftragt", { grund: t("begleiter.aktion.ohneServerzeit") }),
      );
      return false;
    }
    const titel =
      kontext?.adapter.find((a) => a.instanz === instanz)?.dokument.titel ??
      adapterRef.current?.dokument.titel ??
      "";
    // MAC5-01-REST: ab dem Abschicken zählt der Auftrag als laufend (noch ohne Kennung).
    setEigene((alt) => (alt.kontoId === konto ? { ...alt, ausstehend: alt.ausstehend + 1 } : alt));
    const zurueck = (): void =>
      setEigene((alt) =>
        alt.kontoId === konto ? { ...alt, ausstehend: Math.max(0, alt.ausstehend - 1) } : alt,
      );
    // Nacharbeit 58: der Schlüssel bindet GENAU diesen Auftrag — für seine Klärung, falls die Antwort
    // verloren geht.
    const schluessel = neuerAuftragsschluessel();
    try {
      const ausgestelltAm = serverZeit.jetzt;
      const auftrag = {
        art,
        text,
        auswahlStand,
        schluessel,
        ausgestelltAm,
        kanal: serverZeit.kanal,
      };
      const antwort = await begleiterApi.beauftrage(instanz, auftrag);
      // Angenommen: mit Kennung und Stopp halten, bis ein NACH JETZT gestarteter Abruf den Stand
      // liefert. Abrufe, die vorher (auch während der Beauftragung) losgingen, zählen nicht.
      const abAbruf = abrufNummerRef.current;
      setEigene((alt) =>
        alt.kontoId !== konto
          ? alt
          : {
              ...alt,
              ausstehend: Math.max(0, alt.ausstehend - 1),
              angenommen: [
                ...alt.angenommen,
                {
                  instanz,
                  titel,
                  aktion: {
                    id: antwort.aktion.id,
                    art: antwort.aktion.art,
                    stand: antwort.aktion.stand,
                    ergebnis: null,
                    grund: null,
                  },
                  abAbruf,
                  // Nacharbeit 65: angenommen hat ihn nur die Instanz, für die er ausgestellt war.
                  kanal: serverZeit.kanal,
                },
              ],
            },
      );
      return true;
    } catch (fehler) {
      const grund = fehler instanceof ApiError ? fehler.message : fehlerBild(fehler, t).text;
      if (!ablehnungBelegt(fehler)) {
        // Nacharbeit 57/58: unklarer Ausgang — der Kanal kann ihn angenommen haben oder noch
        // annehmen. Weiter als Vorgang zählen (keine bestätigte 0), bis seine Klärung vorliegt.
        setEigene((alt) =>
          alt.kontoId !== konto
            ? alt
            : {
                ...alt,
                ausstehend: Math.max(0, alt.ausstehend - 1),
                unklar: [
                  ...alt.unklar,
                  {
                    schluessel,
                    instanz,
                    titel,
                    ausgestelltAm: serverZeit.jetzt,
                    kanal: serverZeit.kanal,
                  },
                ],
              },
        );
        setAktionFehler(t("begleiter.aktion.ausgangUnklar", { grund }));
        return false;
      }
      zurueck();
      setAktionFehler(t("begleiter.aktion.nichtBeauftragt", { grund }));
      return false;
    }
  };
  /** UI-MIN-06/14: eine Word-Aktion stoppen — am Kanal, bei übergebener bis ins Word-Fenster. */
  const wordAktionStoppen = async (instanz: string, aktionId: string): Promise<void> => {
    setAktionFehler(null);
    // Nacharbeit 66 (Ben): der Stoppwunsch gilt bis zum belegten Ende — auch über einen
    // Serverneustart, der ihn im Kanal verliert, bevor Word ihn erhalten hat (`stoppWuensche`).
    if (kontoId) {
      if (stoppRef.current.kontoId !== kontoId) {
        stoppRef.current = { kontoId, wuensche: new Map() };
      }
      const bisher = stoppRef.current.wuensche.get(aktionId);
      stoppRef.current.wuensche.set(aktionId, {
        instanz,
        abAbruf: abrufNummerRef.current,
        gesehenIn: bisher?.gesehenIn ?? null,
      });
    }
    try {
      await begleiterApi.stoppe(instanz, aktionId);
    } catch (fehler) {
      setAktionFehler(
        t("begleiter.aktion.nichtGestoppt", {
          grund: fehler instanceof ApiError ? fehler.message : fehlerBild(fehler, t).text,
        }),
      );
    }
  };

  const tasteAnFigur = (e: KeyboardEvent<HTMLButtonElement>): void => {
    const schritt = bewegungsSchritt(e.key, e.shiftKey);
    if (schritt) {
      e.preventDefault();
      anNative({ art: "bewegen", ...schritt });
    }
  };

  // Der Steuerbereich: jeder laufende Vorgang einzeln, mit der Wirkung, die er wirklich hat.
  const vorgaenge: Vorgang[] = [];
  if (sprechen.laeuft) {
    vorgaenge.push({
      art: "aufnahme",
      text: t(`klarasprache.laeuft.${sprechen.laeuft}`),
      aktionen: [
        {
          testId: "klara-aufnahme-stoppen",
          label: t("klarasprache.stoppen"),
          onClick: sprechen.stoppen,
        },
      ],
    });
  }
  if (echt.laeuftSeit !== null) {
    vorgaenge.push({
      art: "anfrage",
      text: t("begleiter.eingabe.laeuft"),
      aktionen: [
        { testId: "begleiter-stoppen", label: t("begleiter.eingabe.stoppen"), onClick: stoppen },
      ],
    });
  }
  if (vorlese.liest !== null) {
    vorgaenge.push({
      art: "vorlesen",
      text: t("assistenzminimal.vorgang.vorlesen", { assistenz: name }),
      aktionen: [
        {
          testId: "klara-vorlesen-stoppen",
          label: t("klarasprache.vorlesenStop"),
          onClick: stoppeVorlesen,
        },
      ],
    });
  }
  // UI-MIN-06/14: jede laufende Word-Aktion ALLER eigenen Fenster, einzeln, mit Stopp bis zum
  // BESTÄTIGTEN Ende. `offen` wird sofort zurückgezogen (Word erhält sie nie); `uebergeben` (Nacharbeit
  // 7): der Abbruch geht an das ausführende Word-Fenster, die Zeile sagt „Stopp angefordert“, bis
  // Word ihn bestätigt. Eine schon ausgeführte Einfügung nimmt nur Word zurück — das steht dabei.
  // Nacharbeit 54 (MAC5-01): nach einem gescheiterten Abruf die zuletzt bestätigt laufenden Aktionen
  // dieses Kontos — als „unbestätigt“, weiterhin mit ihrem Stopp.
  const wordLaufend = kontextBestaetigt
    ? laufendeWordAktionen(kontext)
    : bekannteAktionen.kontoId === kontoId
      ? bekannteAktionen.liste
      : [];
  for (const { adapter: a, aktion } of wordLaufend) {
    const fenster = a.dokument.titel || t("begleiter.kontext.ohneTitel");
    const art = t(`begleiter.aktion.art.${aktion.art}`);
    // Nacharbeit 60: meldet sich das ausführende Word-Fenster nicht mehr, ist das Ende unbekannt —
    // die Aktion bleibt mit Stopp stehen (er geht mit der nächsten Meldung des Fensters hinaus).
    const text = !kontextBestaetigt
      ? t("begleiter.vorgang.wordUnbestaetigt", { fenster, art })
      : aktion.stand === "offen"
        ? t("begleiter.vorgang.wordOffen", { fenster, art })
        : !a.aktiv
          ? t("begleiter.vorgang.wordVerbindungVerloren", { fenster, art })
          : aktion.abbruchAngefordert
            ? t("begleiter.vorgang.wordStoppAngefordert", { fenster, art })
            : t("begleiter.vorgang.wordUebergeben", { fenster, art });
    vorgaenge.push({
      art: `word-${aktion.id}`,
      text,
      aktionen: [
        {
          testId: "begleiter-word-stopp",
          label:
            aktion.stand === "offen"
              ? t("begleiter.vorgang.wordStopp")
              : t("begleiter.vorgang.wordAbbrechen"),
          onClick: () => void wordAktionStoppen(a.instanz, aktion.id),
        },
      ],
    });
  }
  // Nacharbeit 56 (MAC5-01-REST): eigene, schon angenommene Aufträge, die der Kontext noch nicht
  // zeigt (kein nach der Annahme gestarteter Abruf), mit Kennung und Stopp — und Aufträge, deren
  // Annahme noch aussteht. Was der Kontext schon zeigt, steht oben genau einmal.
  if (eigene.kontoId === kontoId) {
    const gezeigt = new Set(wordLaufend.map((w) => w.aktion.id));
    for (const e of eigene.angenommen) {
      if (gezeigt.has(e.aktion.id)) {
        continue;
      }
      const fenster = e.titel || t("begleiter.kontext.ohneTitel");
      const art = t(`begleiter.aktion.art.${e.aktion.art}`);
      vorgaenge.push({
        art: `word-${e.aktion.id}`,
        text: t("begleiter.vorgang.wordOffen", { fenster, art }),
        aktionen: [
          {
            testId: "begleiter-word-stopp",
            label: t("begleiter.vorgang.wordStopp"),
            onClick: () => void wordAktionStoppen(e.instanz, e.aktion.id),
          },
        ],
      });
    }
    for (const e of eigene.unklar) {
      vorgaenge.push({
        art: `word-unklar-${e.schluessel}`,
        text: t("begleiter.vorgang.wordUnklar", {
          fenster: e.titel || t("begleiter.kontext.ohneTitel"),
        }),
        aktionen: [],
      });
    }
    if (eigene.ausstehend > 0) {
      vorgaenge.push({
        art: "word-ausstehend",
        text: t("begleiter.vorgang.wordWirdUebergeben", { anzahl: eigene.ausstehend }),
        aktionen: [],
      });
    }
  }
  // Nacharbeit 64 (Ben): vor einem Serverneustart laufende Aktionen — bis ihr Fenster in der neuen
  // Kanalinstanz seinen Bestand gemeldet hat, mit ehrlichem „Ende nicht bestätigt“ und Stopp (er
  // wirkt, sobald das Fenster die Aktion dem Kanal wieder gemeldet hat).
  if (vorNeustart.kontoId === kontoId) {
    const gezeigt = new Set([
      ...wordLaufend.map((w) => w.aktion.id),
      ...(eigene.kontoId === kontoId ? eigene.angenommen.map((e) => e.aktion.id) : []),
    ]);
    for (const e of vorNeustart.liste) {
      if (gezeigt.has(e.aktion.id)) {
        continue;
      }
      const fenster = e.titel || t("begleiter.kontext.ohneTitel");
      const art = t(`begleiter.aktion.art.${e.aktion.art}`);
      vorgaenge.push({
        art: `word-${e.aktion.id}`,
        text: t("begleiter.vorgang.wordNeustartOffen", { fenster, art }),
        aktionen: [
          {
            testId: "begleiter-word-stopp",
            label: t("begleiter.vorgang.wordAbbrechen"),
            onClick: () => void wordAktionStoppen(e.instanz, e.aktion.id),
          },
        ],
      });
    }
  }
  // Eingeklappt bleibt jeder laufende Vorgang an der Figur sichtbar; die App vergrössert dafür das
  // Fenster (`figur-vorgang`). Ohne Vorgang bleibt es so klein wie die Figur.
  const eingeklapptMitVorgaengen = !offen && vorgaenge.length > 0;
  useEffect(() => {
    anNative({
      art: "modus",
      modus: offen ? "gespraech" : eingeklapptMitVorgaengen ? "figur-vorgang" : "figur",
    });
  }, [offen, eingeklapptMitVorgaengen]);
  // UI-MIN-06/14 (Nacharbeit 47): jede Änderung der Zahl laufender Vorgänge geht an die App; ein
  // angefordertes Schließen wird erst nach bestätigter 0 ausgeführt.
  // Nacharbeit 54 (MAC5-01): ein UNBEKANNTER Word-Stand ist keine 0. Solange der Kontext für ein
  // angemeldetes Konto nicht bestätigt ist (vor der ersten Antwort, nach einem Abruffehler), meldet
  // die Fläche mindestens 1 — die App blendet dann nicht aus. Ohne Konto (nach beantworteter
  // Sitzung) gibt es keine eigenen Word-Aktionen.
  const wordStandBekannt = kontextBestaetigt || (sitzungBeantwortet && !kontoId);
  const anzahlVorgaenge = wordStandBekannt ? vorgaenge.length : Math.max(vorgaenge.length, 1);
  vorgaengeAnzahlRef.current = anzahlVorgaenge;
  useEffect(() => {
    anNative({ art: "vorgaenge", anzahl: anzahlVorgaenge });
  }, [anzahlVorgaenge]);
  // Der Griff: die Fläche der Figur, in der die App das Ziehen mit der Maus übernimmt.
  // biome-ignore lint/correctness/useExhaustiveDependencies: Lage und Vorgänge verschieben die Figur.
  useEffect(() => {
    const el = figurRef.current;
    if (!el) {
      return;
    }
    const melden = (): void => {
      const r = el.getBoundingClientRect();
      anNative({ art: "griff", x: r.left, y: r.top, breite: r.width, hoehe: r.height });
    };
    melden();
    const spaet = window.setTimeout(melden, 300);
    window.addEventListener("resize", melden);
    return () => {
      window.clearTimeout(spaet);
      window.removeEventListener("resize", melden);
    };
  }, [offen, eingeklapptMitVorgaengen]);

  const figur = (
    <button
      ref={figurRef}
      type="button"
      data-testid="begleiter-figur"
      data-zustand={zustand}
      data-reduziert={reduziert ? "an" : "aus"}
      aria-label={t("begleiter.figur.label", { name })}
      aria-expanded={offen}
      title={`${name} · ${zustandText}`}
      onClick={() => setOffen((o) => !o)}
      onKeyDown={tasteAnFigur}
      className={`relative shrink-0 rounded-full bg-surface ring-4 ${RING[zustand] ?? RING.ruhe} ${
        offen ? "h-9 w-9" : "h-[72px] w-[72px]"
      } ${
        !reduziert && (zustand === "wartet" || zustand === "hoert" || zustand === "spricht")
          ? "animate-pulse"
          : ""
      } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`}
    >
      <img
        src={auftritt.avatarUrl}
        alt=""
        draggable={false}
        className="h-full w-full select-none rounded-full object-contain"
      />
      {!adapter?.aktiv ? (
        <span
          data-testid="begleiter-figur-ohne-word"
          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface bg-muted-2"
        />
      ) : null}
    </button>
  );

  if (!offen) {
    // UI-MIN-06/14 (Nacharbeit 5): eingeklappt bleibt JEDER laufende Vorgang einzeln benannt und —
    // wo es einen echten Abbruch gibt — stoppbar. Eine Aufnahme endet beim Einklappen ohnehin.
    return (
      <div
        data-darstellung={dunkel ? "dunkel" : "hell"}
        data-lage={eingeklapptMitVorgaengen ? "figur-vorgang" : "figur"}
        className={`flex h-screen w-screen flex-col items-center gap-2 overflow-y-auto ${
          eingeklapptMitVorgaengen ? "justify-start pt-2" : "justify-center"
        }`}
        style={farbStil}
      >
        {figur}
        <span className="sr-only" aria-live="polite">
          {zustandText}
        </span>
        {eingeklapptMitVorgaengen ? (
          <div className="w-full overflow-hidden rounded-card border border-hairline bg-surface text-text shadow-lg">
            <VorgangsLeiste
              vorgaenge={vorgaenge}
              testId="begleiter-figur-vorgaenge"
              label={t("assistenzminimal.figur.vorgaenge")}
            />
          </div>
        ) : null}
      </div>
    );
  }

  const host = adapter ? t(`begleiter.kontext.host.${adapter.host}`) : null;
  const titel = adapter ? adapter.dokument.titel || t("begleiter.kontext.ohneTitel") : null;
  // Das Fenster, in dem der Entwurf begonnen wurde — nur, solange der Kanal es noch AKTIV meldet.
  const ursprungsFenster =
    zielFrage?.instanz != null
      ? (kontext?.adapter.find((a) => a.instanz === zielFrage.instanz && a.aktiv) ?? null)
      : null;
  const kontextZeile = !adapter
    ? t("begleiter.figur.ohneWord")
    : !adapter.aktiv
      ? t("begleiter.zeile.inaktiv", { host, titel })
      : auswahl
        ? t("begleiter.zeile.markiert", { host, titel })
        : t("begleiter.zeile.word", { host, titel });
  const kiKurz = ki.abgeschaltet
    ? t("assistenzminimal.ki.aus")
    : ki.ohneModell
      ? t("assistenzminimal.ki.ohneModell")
      : null;
  const zurueck = (): void => {
    setMenueSeite(null);
    window.setTimeout(() => eingabeRef.current?.focus({ preventScroll: true }), 0);
  };

  return (
    <div
      data-testid="begleiter-gespraech"
      data-oberflaeche="minimal"
      data-seite={menueSeite ?? "gespraech"}
      data-darstellung={dunkel ? "dunkel" : "hell"}
      data-einwilligung={echt.gespraech?.einwilligungAm ? "ja" : "nein"}
      className="flex h-screen w-screen flex-col overflow-hidden rounded-card border border-hairline bg-page text-text shadow-lg"
      style={farbStil}
      onKeyDown={(e) => {
        if (e.key !== "Escape") {
          return;
        }
        // Escape geht genau eine Stufe zurück: Unterseite → Gespräch, Menü → zu, sonst einklappen.
        if (menueSeite) {
          setMenueSeite(null);
          menueKnopfRef.current?.focus({ preventScroll: true });
        } else if (menueOffen) {
          setMenueOffen(false);
          menueKnopfRef.current?.focus({ preventScroll: true });
        } else {
          setOffen(false);
        }
      }}
    >
      {/* 1 · Kopf */}
      <header className="flex items-center gap-2 border-b border-hairline bg-surface px-3 py-2">
        {figur}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-ink">{name}</p>
          <p data-testid="begleiter-zustand" aria-live="polite" className="text-[11px] text-muted">
            {zustandText}
          </p>
        </div>
        <button
          ref={menueKnopfRef}
          type="button"
          data-testid="begleiter-menue-knopf"
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
          data-testid="begleiter-schliessen"
          aria-label={t("assistenzminimal.einklappen")}
          title={t("assistenzminimal.einklappen.hinweis")}
          onClick={() => setOffen(false)}
          className={`${SYMBOL_KNOPF} h-8 w-8`}
        >
          <EinklappenSymbol />
        </button>
      </header>
      {menueOffen ? (
        <MenueListe
          id={menueId}
          ersterRef={menueErsterRef}
          onWahl={(seite) => {
            setMenueOffen(false);
            if (seite === "neu" && echt.nachrichten.length === 0) {
              window.setTimeout(() => eingabeRef.current?.focus({ preventScroll: true }), 0);
              return;
            }
            setMenueSeite(seite);
          }}
        />
      ) : null}
      <VorgangsLeiste
        vorgaenge={vorgaenge}
        testId="begleiter-vorgaenge"
        label={t("assistenzminimal.vorgang.label")}
      />

      {menueSeite ? (
        <Unterseite seite={menueSeite} zurueckRef={zurueckRef} onZurueck={zurueck}>
          {menueSeite === "neu" ? (
            <NeuSeite kontext={bezug} onFertig={() => zurueck()} />
          ) : menueSeite === "verlauf" ? (
            <VerlaufSeite pfad="/begleiter" onZumGespraech={zurueck} />
          ) : menueSeite === "funktionen" ? (
            <div className="space-y-3">
              <section data-testid="begleiter-funktionen">
                <h4 className={ABSCHNITT}>{t("assistenzminimal.funktionen.verfuegbar")}</h4>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-[12px] leading-relaxed text-text">
                  <li>{t("begleiter.funktionen.fragen")}</li>
                  <li>{t("begleiter.funktionen.markierung")}</li>
                  <li>{t("begleiter.funktionen.einfuegen")}</li>
                  <li>
                    {sprechen.moeglich
                      ? t("assistenzminimal.funktionen.sprechen")
                      : t("assistenzminimal.funktionen.sprechenNa")}
                  </li>
                  {sprechen.moeglich ? (
                    <li>
                      {t("assistenzminimal.funktionen.auftrag")}{" "}
                      <button
                        type="button"
                        data-testid="begleiter-auftrag-sprechen"
                        onClick={() => {
                          setMenueSeite(null);
                          sprechen.starten("auftrag");
                        }}
                        className={`${KNOPF} mt-1`}
                      >
                        {t("klarasprache.auftragSprechen")}
                      </button>
                    </li>
                  ) : null}
                  <li>{t("assistenzminimal.funktionen.vorlesen")}</li>
                </ul>
              </section>
              <section className="rounded-card border border-dashed border-hairline px-3 py-2">
                <h4 className={ABSCHNITT}>{t("assistenzminimal.funktionen.geplant")}</h4>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
                  {t("klaraprodukt.offen.text")}
                </p>
              </section>
            </div>
          ) : menueSeite === "einstellungen" ? (
            <div className="space-y-4">
              {/* MAC-04 (Ben, Nacharbeit 56 · MAC5-04-REST): der zentrale Klara-Bereich in Klarwerk
                  (Profil › Klara, vorhandener Direktweg). Er öffnet sich neben dem Begleiter —
                  in der App im Browser —, damit Entwurf, Gespräch und laufende Stopps hier bleiben.
                  Keine zweite Einstellungsverwaltung: hier stehen nur die Begleiter-Einstellungen. */}
              <section data-testid="begleiter-einstellungen-zentral" className="space-y-1.5">
                <h4 className={ABSCHNITT}>{t("begleiter.einstellungen.zentral.titel")}</h4>
                <p className="text-[11.5px] leading-relaxed text-text">
                  {t("begleiter.einstellungen.zentral.text")}
                </p>
                <a
                  href={KLARA_SETUP_PFAD}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="begleiter-einstellungen-zentral-link"
                  className={KNOPF}
                >
                  {t("begleiter.einstellungen.zentral.link")}
                </a>
              </section>
              <section className="space-y-1.5">
                <h4 className={ABSCHNITT}>{t("assistenzminimal.einstellungen.sprache")}</h4>
                <KlaraSprachausgabe />
              </section>
              <section data-testid="begleiter-verbindungen" className="space-y-1.5">
                <h4 className={ABSCHNITT}>{t("assistenzminimal.einstellungen.verbindungen")}</h4>
                <p className="text-[11.5px] leading-relaxed text-text">
                  {t("begleiter.kontext.leer")}
                </p>
                <p data-testid="begleiter-version" className="text-[11px] text-muted-2">
                  {appStand
                    ? t("begleiter.version.app", { web: APP_VERSION, app: appStand })
                    : t("begleiter.version.browser", { web: APP_VERSION })}
                </p>
              </section>
              <section className="space-y-1.5">
                <h4 className={ABSCHNITT}>{t("assistenzminimal.einstellungen.darstellung")}</h4>
                <label className="flex items-center gap-2 text-[12px]">
                  <input
                    type="checkbox"
                    data-testid="begleiter-reduziert"
                    checked={reduziert}
                    onChange={(e) => setzeReduziert(e.target.checked)}
                  />
                  {t("begleiter.figur.reduziert")}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={!app}
                    onClick={() => anNative({ art: "zuruecksetzen" })}
                    className={KNOPF}
                  >
                    {t("begleiter.figur.zuruecksetzen")}
                  </button>
                  <button
                    type="button"
                    disabled={!app}
                    onClick={() => anNative({ art: "andocken", seite: "links" })}
                    className={KNOPF}
                  >
                    {t("begleiter.figur.links")}
                  </button>
                  <button
                    type="button"
                    disabled={!app}
                    onClick={() => anNative({ art: "andocken", seite: "rechts" })}
                    className={KNOPF}
                  >
                    {t("begleiter.figur.rechts")}
                  </button>
                  <button
                    type="button"
                    disabled={!app}
                    onClick={() => anNative({ art: "ausblenden" })}
                    className={KNOPF}
                  >
                    {t("begleiter.figur.ausblenden")}
                  </button>
                </div>
                <p className="text-[11px] text-muted-2">{t("begleiter.figur.einblendenHinweis")}</p>
              </section>
              <DatenFreigaben kontext={bezug} />
              <section className="space-y-1">
                <h4 className={ABSCHNITT}>{t("begleiter.berechtigung.titel")}</h4>
                <p className="text-[11.5px] leading-relaxed text-text">
                  {t("begleiter.berechtigung.text")}
                </p>
              </section>
            </div>
          ) : (
            <div className="space-y-3">
              <section data-testid="begleiter-hilfe" className="space-y-1">
                <h4 className={ABSCHNITT}>
                  {t("assistenzminimal.hilfe.bedienung", { assistenz: name })}
                </h4>
                <ul className="list-disc space-y-1 pl-5 text-[11.5px] leading-relaxed text-text">
                  <li>{t("begleiter.hilfe.grundansicht")}</li>
                  <li>{t("begleiter.hilfe.word")}</li>
                  <li>{t("assistenzminimal.hilfe.menue")}</li>
                  <li>{t("assistenzminimal.hilfe.sprechen")}</li>
                  <li>{t("assistenzminimal.hilfe.vorgaenge")}</li>
                  <li>{t("begleiter.figur.einblendenHinweis")}</li>
                </ul>
              </section>
              <LegalFooter />
            </div>
          )}
        </Unterseite>
      ) : (
        <>
          {/* 2 · Kontext: eine Zeile; ein Klick zeigt Fenster, Host, Fassung, Weg, Datenweg. */}
          <details data-testid="begleiter-kontext" className="border-b border-hairline bg-surface">
            <summary
              data-testid="begleiter-kontext-zeile"
              title={t("assistenzminimal.kontext.label")}
              className="flex cursor-pointer items-center gap-1.5 px-3 py-1.5 text-[12px] text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            >
              <span className="min-w-0 flex-1 truncate">{kontextZeile}</span>
              {kiKurz ? (
                <span
                  data-testid="begleiter-verfuegbarkeit"
                  className="shrink-0 rounded-pill border border-hairline px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-muted"
                >
                  {kiKurz}
                </span>
              ) : null}
            </summary>
            <div className="space-y-2 px-3 pb-2.5">
              {kontextFehler ? (
                <p
                  role="alert"
                  data-testid="begleiter-kontext-fehler"
                  className="rounded-btn bg-trust-crit-bg px-2.5 py-1.5 text-[11.5px] text-trust-crit-text"
                >
                  {t("begleiter.kontext.fehler", { grund: kontextFehler })}
                </p>
              ) : kontext === null ? (
                <p className="text-[11.5px] text-muted-2">{t("begleiter.kontext.laden")}</p>
              ) : kontext.adapter.length === 0 ? (
                <p data-testid="begleiter-kontext-leer" className="text-[11.5px] text-muted">
                  {t("begleiter.kontext.leer")}
                </p>
              ) : (
                <ul className="space-y-1">
                  {kontext.adapter.map((a) => {
                    const gebunden = adapter?.instanz === a.instanz;
                    return (
                      <li
                        key={a.instanz}
                        data-testid="begleiter-fenster"
                        data-aktiv={a.aktiv ? "ja" : "nein"}
                        data-gebunden={gebunden ? "ja" : "nein"}
                        className={`rounded-btn border px-2.5 py-1.5 text-[11.5px] ${
                          gebunden ? "border-brand bg-surface" : "border-hairline bg-page"
                        }`}
                      >
                        <p className="font-semibold text-ink">
                          {a.dokument.titel || t("begleiter.kontext.ohneTitel")}
                        </p>
                        <p className="text-muted">
                          {t(`begleiter.kontext.host.${a.host}`)}
                          {a.hostFassung
                            ? ` · ${t("begleiter.kontext.fassung", { fassung: a.hostFassung })}`
                            : ""}
                          {" · "}
                          {a.aktiv ? t("begleiter.kontext.aktiv") : t("begleiter.kontext.inaktiv")}
                        </p>
                        {gebunden ? (
                          <p className="text-[11px] font-semibold text-brand-text">
                            {t("begleiter.kontext.gebunden")}
                          </p>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setGewaehlt(a.instanz)}
                            className={`${KNOPF} mt-1`}
                          >
                            {t("begleiter.kontext.binden")}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              <div>
                <p className={KLEINTITEL}>{t("assistenzminimal.kontext.datenweg")}</p>
                <p className="text-[11.5px] leading-relaxed text-text">
                  {t("begleiter.gespraech.hinweis")}
                </p>
              </div>
            </div>
          </details>

          {/* 3 · Gespräch */}
          <div
            data-testid="begleiter-gespraechsbereich"
            className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-2.5"
          >
            {adapter && auswahl ? (
              <section
                data-testid="begleiter-auswahl"
                data-host={adapter.host}
                className="space-y-1.5 rounded-card border border-hairline bg-surface px-2.5 py-2"
              >
                <p className={KLEINTITEL}>
                  {t("begleiter.kontext.auswahl.titel")}
                  {host ? ` · ${host}` : ""}
                </p>
                <p
                  data-testid="begleiter-auswahl-text"
                  className="max-h-16 overflow-y-auto whitespace-pre-wrap text-[12px] text-text"
                >
                  {kuerze(auswahl.text, 600)}
                </p>
                {auswahl.gekuerzt || auswahl.text.length > 600 ? (
                  <p className="text-[11px] text-muted-2">
                    {t("begleiter.kontext.auswahl.gekuerzt", { laenge: auswahl.laenge })}
                  </p>
                ) : null}
                {/* Höchstens zwei Vorschläge — beide über DIESES Word-Fenster. */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    data-testid="begleiter-vorschlag-erklaeren"
                    disabled={aktionLaeuft(adapter)}
                    onClick={() =>
                      void beauftrage("frage", t("begleiter.vorschlag.erklaerenFrage"))
                    }
                    className={KNOPF_KI}
                  >
                    {t("begleiter.vorschlag.erklaeren")}
                  </button>
                  <button
                    type="button"
                    data-testid="begleiter-vorschlag-verbessern"
                    disabled={aktionLaeuft(adapter)}
                    onClick={() =>
                      void beauftrage("frage", t("begleiter.vorschlag.verbessernFrage"))
                    }
                    className={KNOPF_KI}
                  >
                    {t("begleiter.vorschlag.verbessern")}
                  </button>
                </div>
                <details data-testid="begleiter-auswahl-mehr">
                  <summary className="cursor-pointer text-[11.5px] font-semibold text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
                    {t("assistenzminimal.markierung.mehr")}
                  </summary>
                  {/* Eigene Fragen zur Markierung stellt man im gemeinsamen Eingabefeld — sie
                      gehen über DIESES Word-Fenster (Nacharbeit 5, ein Einstieg). */}
                  <p className="mt-1 text-[11px] text-muted-2">
                    {t("begleiter.kontext.frage.hinweis")}
                  </p>
                  {einfuegeText ? (
                    <div className="mt-1.5 space-y-1">
                      <button
                        type="button"
                        data-testid="begleiter-einfuegen"
                        onClick={() => void beauftrage("einfuegen", einfuegeText)}
                        className={KNOPF}
                      >
                        {t("begleiter.kontext.einfuegen.knopf")}
                      </button>
                      <p className="text-[11px] text-muted-2">
                        {kuerze(einfuegeText, 140)} · {t("begleiter.kontext.einfuegen.hinweis")}
                      </p>
                    </div>
                  ) : null}
                </details>
              </section>
            ) : null}

            {aktionFehler ? (
              <p
                role="alert"
                data-testid="begleiter-aktion-fehler"
                className="rounded-btn bg-trust-warn-bg px-2 py-1 text-[11px] text-trust-warn-text"
              >
                {aktionFehler}
              </p>
            ) : null}

            {adapter && adapter.aktionen.length > 0 ? (
              <ol className="space-y-1" data-testid="begleiter-aktionen">
                {[...adapter.aktionen].reverse().map((a) => (
                  <li
                    key={a.id}
                    data-stand={a.stand}
                    className="rounded-btn bg-surface px-2 py-1 text-[11px] text-text"
                  >
                    <span className="font-semibold">{t(`begleiter.aktion.art.${a.art}`)}</span>
                    {" · "}
                    {t(`begleiter.aktion.stand.${a.stand}`)}
                    {a.grund ? ` · ${t("begleiter.aktion.grund", { grund: a.grund })}` : ""}
                    {a.art === "frage" && a.ergebnis ? (
                      <span className="mt-0.5 block whitespace-pre-wrap text-[11.5px]">
                        <span className={KLEINTITEL}>{t("begleiter.aktion.antwort")}</span>{" "}
                        {kuerze(a.ergebnis, 800)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : null}

            <KlaraEchtGespraech
              minimal
              kontext={bezug}
              pfad="/begleiter"
              ki={ki}
              sprecher={name}
              onErneutFragen={(text) => {
                void fragenSenden(text);
              }}
              onNeuLaden={() => {
                if (kontoId) {
                  void ladeEcht(kontoId, t);
                }
              }}
            />
            <KlaraAuftragKarte
              s={sprechen}
              sendebereit={sendebereit}
              absenden={(text, ziel) => fragenSenden(text, ziel.herkunft)}
            />
          </div>

          {/* 4 · Eingabe — nötige Rückfragen erscheinen genau hier, am Auftrag. */}
          <form
            data-testid="begleiter-eingabe-form"
            onSubmit={senden}
            className="space-y-1.5 border-t border-hairline bg-surface px-3 py-2"
          >
            {wordHilfeFuer !== null ? (
              <section
                data-testid="begleiter-word-hilfe"
                data-verbunden={wordVerbunden ? "ja" : "nein"}
                aria-label={t("begleiter.wordhilfe.titel")}
                className="rounded-card border border-brand/50 bg-surface px-3 py-2 text-[11.5px] leading-relaxed text-text"
              >
                <p className="font-semibold text-ink">{t("begleiter.wordhilfe.text")}</p>
                {wordVerbunden ? (
                  <p data-testid="begleiter-word-hilfe-verbunden" className="mt-0.5">
                    {t("begleiter.wordhilfe.verbunden", { titel: titel ?? "" })}
                  </p>
                ) : (
                  <p className="mt-0.5">{t("begleiter.kontext.leer")}</p>
                )}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {wordVerbunden && adapter ? (
                    <button
                      type="button"
                      data-testid="begleiter-word-hilfe-senden"
                      onClick={() =>
                        // Ausdrücklich gewählt: an das jetzt verbundene Fenster.
                        void anWordSenden(adapter.instanz, auswahl?.stand ?? 0)
                      }
                      className={KNOPF_KI}
                    >
                      {t("begleiter.wordhilfe.senden", { titel: titel ?? "" })}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    data-testid="begleiter-word-hilfe-allgemein"
                    onClick={() => {
                      // Ausdrücklich ohne Dokument: dieselbe Frage über das eigene Gespräch.
                      if (ki.abgeschaltet) {
                        setWordHilfeFuer(null);
                        setKiAusGezeigt(true);
                        return;
                      }
                      if (!echt.gespraech?.einwilligungAm) {
                        setWordHilfeFuer(null);
                        setEinwilligungFuer("frage");
                        return;
                      }
                      allgemeinSenden();
                    }}
                    className={KNOPF}
                  >
                    {t("begleiter.wordhilfe.allgemein")}
                  </button>
                  <button
                    type="button"
                    data-testid="begleiter-word-hilfe-abbrechen"
                    onClick={() => setWordHilfeFuer(null)}
                    className={KNOPF}
                  >
                    {t("assistenzminimal.neu.nein")}
                  </button>
                </div>
              </section>
            ) : null}
            {einwilligungFuer ? (
              <section
                data-testid="begleiter-einwilligung"
                aria-label={t("klaragespraech.einwilligung.titel")}
                className="rounded-card border border-ai/40 bg-surface px-3 py-2"
              >
                <p className="text-[12px] font-semibold text-ink">
                  {t("assistenzminimal.einwilligung.frage")}
                </p>
                <p className="mt-0.5 max-h-20 overflow-y-auto text-[11.5px] leading-relaxed text-text">
                  {t("klaragespraech.einwilligung.text", { assistenz: name })}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    data-testid="begleiter-einwilligung-erteilen"
                    onClick={einwilligenUndSenden}
                    className={KNOPF_KI}
                  >
                    {t("assistenzminimal.einwilligung.senden")}
                  </button>
                  <button
                    type="button"
                    data-testid="begleiter-einwilligung-abbrechen"
                    onClick={() => setEinwilligungFuer(null)}
                    className={KNOPF}
                  >
                    {t("assistenzminimal.einwilligung.nichtJetzt")}
                  </button>
                </div>
              </section>
            ) : null}
            {zielFrage ? (
              <section
                data-testid="begleiter-ziel-klaeren"
                aria-label={t("assistenzminimal.ziel.titel")}
                className="rounded-card border border-ai/40 bg-surface px-3 py-2 text-[12px] leading-relaxed text-text"
              >
                <p>
                  {t("begleiter.ziel.frage", {
                    ursprung: zielFrage.titel ?? t("begleiter.ziel.ohneWord"),
                    jetzt: titel ?? "",
                  })}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {ursprungsFenster ? (
                    <button
                      type="button"
                      data-testid="begleiter-ziel-ursprung"
                      onClick={() =>
                        void anWordSenden(ursprungsFenster.instanz, zielFrage.auswahlStand)
                      }
                      className={KNOPF_KI}
                    >
                      {t("begleiter.ziel.ursprung", { titel: zielFrage.titel ?? "" })}
                    </button>
                  ) : zielFrage.instanz === null ? null : (
                    <p data-testid="begleiter-ziel-ursprung-weg" className="text-[11px] text-muted">
                      {t("begleiter.ziel.ursprungWeg")}
                    </p>
                  )}
                  {wordVerbunden && adapter ? (
                    <button
                      type="button"
                      data-testid="begleiter-ziel-jetzt"
                      onClick={() => void anWordSenden(adapter.instanz, auswahl?.stand ?? 0)}
                      className={KNOPF}
                    >
                      {t("begleiter.ziel.jetzt", { titel: titel ?? "" })}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    data-testid="begleiter-ziel-abbrechen"
                    onClick={() => setZielFrage(null)}
                    className={KNOPF}
                  >
                    {t("assistenzminimal.neu.nein")}
                  </button>
                </div>
              </section>
            ) : null}
            {entwurf.kontoId === kontoId
              ? entwurf.abgewiesen.map((a) => (
                  <div
                    key={a.id}
                    data-testid="begleiter-abgewiesen"
                    className="rounded-btn bg-trust-warn-bg px-2.5 py-1.5 text-[11.5px] leading-relaxed text-trust-warn-text"
                  >
                    <p>{t("assistenzminimal.abgewiesen.text", { text: kuerze(a.text, 80) })}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        data-testid="begleiter-abgewiesen-zurueckholen"
                        onClick={() => {
                          const e0 = entferneBegleiterAbgewiesen(kontoId, a.id);
                          if (!e0) {
                            return;
                          }
                          const jetzt = leseBegleiterEntwurf().text;
                          if (!jetzt.trim()) {
                            setzeBegleiterEntwurf(kontoId, e0.text, e0.ursprung);
                          } else {
                            setEingabe(`${jetzt.trimEnd()} ${e0.text.trim()}`);
                          }
                        }}
                        className={KNOPF}
                      >
                        {t("assistenzminimal.abgewiesen.zurueck")}
                      </button>
                      <button
                        type="button"
                        data-testid="begleiter-abgewiesen-verwerfen"
                        onClick={() => entferneBegleiterAbgewiesen(kontoId, a.id)}
                        className={KNOPF}
                      >
                        {t("assistenzminimal.abgewiesen.verwerfen")}
                      </button>
                    </div>
                  </div>
                ))
              : null}
            {ki.abgeschaltet && kiAusGezeigt ? (
              <p
                data-testid="begleiter-ki-aus-hinweis"
                className="rounded-btn bg-trust-crit-bg px-2.5 py-1.5 text-[11.5px] leading-relaxed text-trust-crit-text"
              >
                {t("d5kiaus.hinweis")}
              </p>
            ) : null}
            {sprechen.hinweis ? (
              <output
                data-testid="begleiter-sprache-hinweis"
                className="block rounded-btn bg-trust-warn-bg px-2 py-1 text-[11px] leading-relaxed text-trust-warn-text"
              >
                {sprechen.hinweis}
              </output>
            ) : null}
            <div className="flex items-center gap-1.5">
              <label htmlFor={eingabeId} className="sr-only">
                {t("assistenzminimal.eingabe.label", { name })}
              </label>
              <input
                ref={eingabeRef}
                id={eingabeId}
                data-testid="begleiter-eingabe"
                value={eingabe}
                enterKeyHint="send"
                onChange={(e) => {
                  setEingabe(e.target.value);
                  if (wordHilfeFuer !== null && e.target.value.trim() !== wordHilfeFuer) {
                    setWordHilfeFuer(null);
                  }
                }}
                placeholder={t("assistenzminimal.eingabe.platzhalter")}
                className="h-9 min-w-0 flex-1 rounded-btn border border-hairline bg-page px-2 text-[12.5px] text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              />
              {sprechen.moeglich ? (
                <button
                  type="button"
                  data-testid="begleiter-mikrofon"
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
                    // EIN Spracheinstieg: Diktat ins Feld, gesendet wird nur mit „Senden“.
                    if (sprechen.laeuft) {
                      sprechen.stoppen();
                    } else {
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
                data-testid="begleiter-senden"
                disabled={
                  eingabe.trim().length === 0 ||
                  // Der Word-Weg braucht das eigene Gespräch nicht; der allgemeine schon.
                  (!dokumentBezogen(eingabe) &&
                    (echt.laden !== "bereit" || echt.laeuftSeit !== null))
                }
                className={`${KNOPF_KI} h-9`}
              >
                {t("begleiter.eingabe.senden")}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
