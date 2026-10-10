// ================================================================================================
// KLARA-VORSCHAU · DER ZUSTAND — eine Quelle für Figur, Gespräch, Ausschnitt und Entwürfe.
// ================================================================================================
//
// WARUM AUSSERHALB VON REACT: Die Hülle rendert unter 900 px einen anderen Baum als darüber
// (`shell/AppShell.tsx`). Klara wird bei jedem Wechsel der Fensterbreite also NEU montiert — ein
// `useState` in der Figur verlöre dabei Position, Verlauf und offenen Vorschlag. Hier liegt der
// Zustand einmal, React liest ihn über `useSyncExternalStore`, und die Sitzung (sessionStorage)
// hält ihn über ein Neuladen. Nichts davon geht an den Server: die Vorschau speichert nichts. Das
// ECHTE Gespräch (Klara 01) liegt NICHT hier, sondern am Server unter dem eigenen Konto (`echt.ts`);
// hier steht nur, welcher Betrieb gewählt ist.
//
// Die Funktionen hier sind REIN (Position klemmen, andocken, Antwort einsortieren) und ohne DOM
// prüfbar (`tests/klara-vorschau/`).
import { useSyncExternalStore } from "react";
import { eingabeZuruecksetzen } from "./eingabe";

export const FIGUR_GROESSE = 72;
export const RAND_ABSTAND = 12;
/** So nah am Rand (px) dockt Klara beim Loslassen an. */
export const ANDOCK_ZONE = 40;
/** Breite der seitlichen Ansicht auf breiten Bildschirmen. */
export const SEITLICH_BREITE = 380;
/** Ab hier gilt ein Zeigerweg als Ziehen und nicht mehr als Klick. */
export const ZIEH_SCHWELLE = 6;

export interface Position {
  x: number;
  y: number;
}

export interface Flaeche {
  breite: number;
  hoehe: number;
}

export type Rand = "links" | "rechts";
export type Ansicht = "kompakt" | "seitlich";
/**
 * Klara 01 (produkt:20261008:klara-basis): ECHTER Betrieb (Frageweg von Klarwerk, Gespräch unter dem
 * eigenen Konto — `echt.ts`) oder DEMO (die vorgefertigten Antworten der Vorschau). Sichtbar
 * umschaltbar; der echte Betrieb ist der Anfang.
 */
export type Betrieb = "echt" | "demo";
/** `artikel` ist der fiktive Vorschau-Artikel, `wissen` ein echtes Wissensobjekt (Klara 03). */
export type SeitenArt = "uebersicht" | "artikel" | "wissen" | "erfassung" | "fragen" | "andere";
/**
 * Der Arbeitsstatus des Gesprächs. Den AUSDRUCK der Figur — die neun Zustände aus
 * `ANIMATIONSZUSTAENDE.json` (bereit … pause) — leitet `components/assistenz/ausdruck.ts` aus diesem
 * Status und weiteren echten Ereignissen ab (Mikrofon, Vorlesen, Ergebnis, verkleinert).
 */
export type Status = "ruhe" | "laeuft" | "antwort" | "entscheidung";
export type Aktion = "erklaeren" | "zusammenfassen" | "umformulieren" | "notiz" | "frage" | "modus";
/**
 * Klara 03 (produkt:20261007:klara-kontext-tutorial): worauf sich eine Frage bezieht — die Seite mit
 * ihrem Objekt, die gemerkte Markierung oder nichts davon (freies Gespräch). Sichtbar umschaltbar.
 */
export type Bezug = "seite" | "markierung" | "frei";

/** Woher etwas stammt: Seite und konkretes Objekt zum Zeitpunkt des Geschehens. */
export interface Herkunft {
  pfad: string;
  seite: SeitenArt;
  seitenName: string;
  objekt: string;
  artikelId?: string;
  absatz?: number;
  // Klara 03 — aus dem Appzustand, nicht aus dem Bildschirmtext geraten:
  /** Das echte Wissensobjekt und die Fassung, die in diesem Augenblick zu sehen war. */
  koId?: string;
  fassung?: number;
  /** Der Titel des Wissensobjekts (ohne Anführungszeichen). */
  titel?: string;
  pruefstatus?: "geprueft" | "ungeprueft";
  modus?: "lesen" | "bearbeiten";
  lesart?: "original" | "uebersetzung";
  /** Die Erfassung: Kennung des geöffneten Entwurfs aus der Adresse (`?draft=`). */
  entwurfId?: string;
  /**
   * Nacharbeit 5: der Wortlaut des Seitenobjekts für den Frageweg — Titel des Entwurfs (Erfassung)
   * bzw. die Frage im echten Fragefeld (Fragen). Ungekürzt bis 300 Zeichen; `objekt` ist die Anzeige.
   */
  kontextText?: string;
  /** Darf die Rolle das Objekt hier bearbeiten? (Anzeige der erlaubten Aktionen) */
  darfBearbeiten?: boolean;
}

export interface Auswahl {
  id: string;
  text: string;
  herkunft: Herkunft;
}

export interface Vorschlag {
  original: string;
  neu: string;
  artikelId?: string;
  absatz?: number;
  status: "offen" | "uebernommen" | "verworfen";
}

export interface Nachricht {
  id: string;
  von: "du" | "klara";
  text: string;
  herkunft: Herkunft;
  aktion?: Aktion;
  /** Klaras Antworten in der Vorschau sind IMMER vorgefertigt. */
  demo: boolean;
  vorschlag?: Vorschlag;
}

export interface Entwurf {
  id: string;
  art: "notiz" | "aufgabe";
  inhalt: string;
  herkunft: Herkunft;
  erinnerung: string;
  termin: string;
  gespeichert: boolean;
}

export interface Geparkt {
  artikelId: string;
  absatz: number;
}

export interface BegleitStand {
  definitionId: string;
  schrittIndex: number;
  spielt: boolean;
}

function istBegleitStand(roh: unknown): roh is BegleitStand {
  const s = roh as Partial<BegleitStand> | null;
  return (
    typeof s === "object" &&
    s !== null &&
    typeof s.definitionId === "string" &&
    typeof s.schrittIndex === "number" &&
    Number.isInteger(s.schrittIndex) &&
    s.schrittIndex >= 0 &&
    typeof s.spielt === "boolean"
  );
}

export interface KlaraZustand {
  /** Obere linke Ecke der Figur im Fenster. `null` = Startplatz (unten rechts). */
  position: Position | null;
  angedockt: Rand | null;
  geparkt: Geparkt | null;
  offen: boolean;
  minimiert: boolean;
  ansicht: Ansicht;
  verlauf: Nachricht[];
  auswahl: Auswahl | null;
  /** Durch bewusste Übernahme geänderte Absätze: `artikelId#absatz` → Text. */
  artikelText: Record<string, string>;
  status: Status;
  entwurf: Entwurf | null;
  begleiten: boolean;
  betrieb: Betrieb;
  /** Klara 03: der gewählte Bezug der nächsten Frage. */
  bezug: Bezug;
  /**
   * Klara 03 · K4/K5: der Schritt, an dem die Begleitung zuletzt stand. Nach einem Neuladen steht
   * das Tutorial geschlossen da; mit diesem Stand öffnet Klara es wieder an DEMSELBEN Schritt
   * (`KlaraVorschau.tsx`), statt bei Schritt 1. Beim Breitenwechsel behält der Tutorialbereich
   * seinen Schritt selbst — dort ist nichts wiederherzustellen.
   */
  begleitStand: BegleitStand | null;
  /**
   * Klara 03: das Konto, dem Markierung, Demo-Verlauf und Entwurf gehören. `null` = noch keinem
   * zugeordnet. Meldet die Sitzung ein anderes Konto, wird all das verworfen (`anKontoBinden`).
   */
  kontoId: string | null;
}

export const ANFANG: KlaraZustand = {
  position: null,
  angedockt: null,
  geparkt: null,
  offen: false,
  minimiert: false,
  ansicht: "kompakt",
  verlauf: [],
  auswahl: null,
  artikelText: {},
  status: "ruhe",
  entwurf: null,
  begleiten: false,
  betrieb: "echt",
  bezug: "seite",
  begleitStand: null,
  kontoId: null,
};

const BEZUEGE: readonly Bezug[] = ["seite", "markierung", "frei"];

/**
 * Klara 03 · K6: Inhalte gehören der Person, die sie markiert hat. Abmelden verwirft Markierung,
 * Demo-Verlauf und Entwurf; ein anderes Konto (etwa nach Neuladen mit fremder Sitzung im selben Tab)
 * findet nichts davon vor. Position und Ansicht der Figur bleiben — sie verraten keinen Inhalt.
 */
export function anKontoBinden(z: KlaraZustand, kontoId: string | null): KlaraZustand {
  if (z.kontoId === kontoId) {
    return z;
  }
  const fremd = kontoId === null || (z.kontoId !== null && z.kontoId !== kontoId);
  if (!fremd) {
    // Erstes Zuordnen eines noch keinem Konto gehörenden Zustands.
    return { ...z, kontoId };
  }
  return {
    ...z,
    kontoId,
    auswahl: null,
    verlauf: [],
    entwurf: null,
    artikelText: {},
    bezug: "seite",
    status: "ruhe",
  };
}

// ------------------------------------------------------------------------------------------------
// Reine Geometrie.
// ------------------------------------------------------------------------------------------------

export function startPosition(f: Flaeche): Position {
  return {
    x: Math.max(RAND_ABSTAND, f.breite - FIGUR_GROESSE - RAND_ABSTAND * 2),
    y: Math.max(RAND_ABSTAND, f.hoehe - FIGUR_GROESSE - RAND_ABSTAND * 6),
  };
}

/** Hält die Figur vollständig im sichtbaren Bereich — auch nach Fenster- oder Vollbildwechsel. */
export function klemme(p: Position, f: Flaeche): Position {
  const maxX = Math.max(RAND_ABSTAND, f.breite - FIGUR_GROESSE - RAND_ABSTAND);
  const maxY = Math.max(RAND_ABSTAND, f.hoehe - FIGUR_GROESSE - RAND_ABSTAND);
  return {
    x: Math.round(Math.min(Math.max(p.x, RAND_ABSTAND), maxX)),
    y: Math.round(Math.min(Math.max(p.y, RAND_ABSTAND), maxY)),
  };
}

/** Der nächstgelegene Rand und ob die Figur in seiner Andockzone liegt. */
export function naechsterRand(p: Position, f: Flaeche): { rand: Rand; inZone: boolean } {
  const links = p.x;
  const rechts = f.breite - (p.x + FIGUR_GROESSE);
  const rand: Rand = links <= rechts ? "links" : "rechts";
  return { rand, inZone: Math.min(links, rechts) <= ANDOCK_ZONE };
}

export function angedocktePosition(rand: Rand, y: number, f: Flaeche): Position {
  const x = rand === "links" ? RAND_ABSTAND : f.breite - FIGUR_GROESSE - RAND_ABSTAND;
  return klemme({ x, y }, f);
}

/**
 * Die tatsächlich gezeichnete Position: Startplatz, angedockt (folgt dem Rand bei Fensteränderung)
 * oder frei — immer geklemmt.
 */
export function wirksamePosition(z: KlaraZustand, f: Flaeche): Position {
  const basis = z.position ?? startPosition(f);
  if (z.angedockt) {
    return angedocktePosition(z.angedockt, basis.y, f);
  }
  return klemme(basis, f);
}

// ------------------------------------------------------------------------------------------------
// Der Speicher.
// ------------------------------------------------------------------------------------------------

const SITZUNG = "klarwerk.klaraVorschau.zustand";

function laden(): KlaraZustand {
  try {
    const roh = typeof sessionStorage === "undefined" ? null : sessionStorage.getItem(SITZUNG);
    if (!roh) {
      return ANFANG;
    }
    const gelesen = JSON.parse(roh) as Partial<KlaraZustand>;
    // Eine laufende Anfrage überlebt kein Neuladen — der Zeitgeber dazu ist weg.
    const status = gelesen.status === "laeuft" ? "antwort" : (gelesen.status ?? "ruhe");
    const betrieb = gelesen.betrieb === "demo" ? "demo" : "echt";
    const bezug = BEZUEGE.includes(gelesen.bezug as Bezug) ? (gelesen.bezug as Bezug) : "seite";
    const kontoId = typeof gelesen.kontoId === "string" ? gelesen.kontoId : null;
    const begleitStand = istBegleitStand(gelesen.begleitStand) ? gelesen.begleitStand : null;
    return { ...ANFANG, ...gelesen, status, betrieb, bezug, kontoId, begleitStand };
  } catch {
    return ANFANG;
  }
}

let zustand: KlaraZustand = laden();
const hoerer = new Set<() => void>();

function sichern(): void {
  try {
    sessionStorage.setItem(SITZUNG, JSON.stringify(zustand));
  } catch {
    // Privater Modus oder voller Speicher: die Vorschau läuft dann ohne Sitzungsgedächtnis weiter.
  }
}

export function leseZustand(): KlaraZustand {
  return zustand;
}

export function aendere(f: (z: KlaraZustand) => KlaraZustand): void {
  const neu = f(zustand);
  if (neu === zustand) {
    return;
  }
  zustand = neu;
  sichern();
  for (const h of hoerer) {
    h();
  }
}

/**
 * „Vorschau beenden“ (produkt:20261010:assistenz-produkteinstieg): verworfen wird NUR, was der
 * Vorschau gehört — Demo-Verlauf, Demo-Entwurf, übernommene Absätze der fiktiven Artikel, ein dort
 * geparkter Platz, eine Markierung aus einem fiktiven Artikel, Demo-Betrieb und Begleitung. Die
 * persönliche Arbeit bleibt: gültige Markierung und Bezugsauswahl, Konto, Lage der Figur — und die
 * angefangene Eingabe (`eingabe.ts`), die hier gar nicht berührt wird. Die Kontotrennung
 * (`anKontoBinden`) gilt unverändert. Rein, ohne DOM prüfbar.
 */
export function nachVorschauEnde(z: KlaraZustand): KlaraZustand {
  const auswahl = z.auswahl && z.auswahl.herkunft.seite !== "artikel" ? z.auswahl : null;
  const bezug: Bezug = z.bezug === "markierung" && !auswahl ? "seite" : z.bezug;
  return {
    ...z,
    offen: false,
    minimiert: false,
    geparkt: null,
    verlauf: [],
    entwurf: null,
    artikelText: {},
    auswahl,
    bezug,
    status: "ruhe",
    begleiten: false,
    begleitStand: null,
    betrieb: "echt",
  };
}

/** Für „Vorschau beenden“: nur den Vorschau-Anteil verwerfen (`nachVorschauEnde`). */
export function vorschauEndeZustand(): void {
  aendere(nachVorschauEnde);
}

/** Nur für Tests: alles auf Anfang — auch die angefangene Eingabe. */
export function zuruecksetzenGanz(): void {
  eingabeZuruecksetzen();
  zustand = ANFANG;
  try {
    sessionStorage.removeItem(SITZUNG);
  } catch {
    // ohne Sitzungsspeicher nichts zu entfernen
  }
  for (const h of hoerer) {
    h();
  }
}

function abonnieren(h: () => void): () => void {
  hoerer.add(h);
  return () => hoerer.delete(h);
}

export function useKlaraZustand(): KlaraZustand {
  return useSyncExternalStore(abonnieren, leseZustand, leseZustand);
}

let zaehler = 0;
export function neueId(praefix: string): string {
  zaehler += 1;
  return `${praefix}-${Date.now().toString(36)}-${zaehler}`;
}

export function artikelSchluessel(artikelId: string, absatz: number): string {
  return `${artikelId}#${absatz}`;
}

/** Der Status nach einer neuen Antwort: ein offener Vorschlag verlangt eine Entscheidung. */
export function statusNachAntwort(verlauf: readonly Nachricht[]): Status {
  return verlauf.some((n) => n.vorschlag?.status === "offen") ? "entscheidung" : "antwort";
}

/** Übernimmt oder verwirft einen Vorschlag. Nur „übernehmen“ ändert den Artikeltext. */
export function entscheide(
  z: KlaraZustand,
  nachrichtId: string,
  entscheidung: "uebernommen" | "verworfen",
): KlaraZustand {
  let artikelText = z.artikelText;
  const verlauf = z.verlauf.map((n) => {
    if (n.id !== nachrichtId || !n.vorschlag || n.vorschlag.status !== "offen") {
      return n;
    }
    const v = n.vorschlag;
    if (entscheidung === "uebernommen" && v.artikelId && v.absatz) {
      artikelText = { ...artikelText, [artikelSchluessel(v.artikelId, v.absatz)]: v.neu };
    }
    return { ...n, vorschlag: { ...v, status: entscheidung } };
  });
  const offen = verlauf.some((n) => n.vorschlag?.status === "offen");
  return {
    ...z,
    verlauf,
    artikelText,
    status: offen ? "entscheidung" : "antwort",
  };
}
