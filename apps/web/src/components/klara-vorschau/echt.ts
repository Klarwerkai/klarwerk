// ================================================================================================
// KLARA 01 (produkt:20261008:klara-basis) · DAS ECHTE GESPRÄCH — Frageweg, Ablage, Stopp, Fehler.
// ================================================================================================
//
// WAS HIER GESCHIEHT: Im echten Betrieb fragt Klara über den UNVERÄNDERTEN Frageweg `POST /api/ask`
// (dort wirken KI-Abschaltung, Sichtbarkeit und die zentralen Freigaben) und hält Frage und Antwort
// im eigenen Gespräch am Server fest (`/api/me/klara/...`). Nach Neuladen, neuer Anmeldung und
// Seitenwechsel liest Klara das Gespräch von dort.
//
// DIE DREI EHRLICHKEITSREGELN:
//   1. Eine Antwort heisst nur dann „KI-Antwort", wenn der Frageweg `demo: false` meldet — sonst
//      „ohne KI" (wörtliche geprüfte Aussage oder Lücke). Klara erfindet kein Etikett.
//   2. Eine Nachricht gilt nur als gespeichert, wenn der Server sie bestätigt hat. Scheitert die
//      Ablage, steht sie mit „Nicht gespeichert" da — nie still.
//   3. Ein Stopp, eine Abschaltung, eine abgelaufene Anmeldung, eine abgewiesene Berechtigung und ein
//      Netzfehler werden als genau das gezeigt (`fehlerBild`), nicht als leere Antwort.
//
// WARUM AUSSERHALB VON REACT: aus demselben Grund wie `zustand.ts` — die Hülle montiert Klara bei
// jeder Breitenänderung neu. Der Inhalt liegt NICHT im Sitzungsspeicher des Browsers: die Wahrheit ist
// der Server, und beim Abmelden wird er hier vergessen (`vergiss`).
import type { TFunction } from "i18next";
import { useSyncExternalStore } from "react";
import { ApiError } from "../../api/client";
import {
  type KlaraGespraech,
  type KlaraGespraechNachricht,
  type KlaraNachrichtEingabe,
  type KlaraObjektbezug,
  type KlaraSchritt,
  type KlaraSchrittStand,
  type KlaraSeitenbezug,
  klaraGespraechApi,
} from "../../api/klaraGespraech";
import { kiBremsSatz } from "../../lib/kiBremse";
import type { ReasonerLocale } from "../../lib/reasonerLocale";
import { fehlendeGrundlage, quellenAngabenAus } from "./bezug";
import type { Herkunft } from "./zustand";

export type Speicherstand = "ja" | "laeuft" | "nein";

export interface EchtNachricht extends KlaraGespraechNachricht {
  gespeichert: Speicherstand;
  /** Bei „nein": womit Klara erneut speichern kann. Fehlt sie, ist kein zweiter Versuch möglich. */
  nochmal?: KlaraNachrichtEingabe;
  /** Bei „nein" ohne `nochmal`: warum diese Nachricht gar nicht ablegbar war. */
  ohneBeleg?: boolean;
}

export type Ladestand = "aus" | "laedt" | "bereit" | "fehler";

export interface EchtZustand {
  kontoId: string | null;
  laden: Ladestand;
  ladeFehler: string | null;
  gespraech: Omit<KlaraGespraech, "nachrichten"> | null;
  nachrichten: EchtNachricht[];
  /** Beginn der laufenden Anfrage (ms) — oder `null`. */
  laeuftSeit: number | null;
  /**
   * produkt:20261010:assistenz-avatarzustaende — die tatsächliche Verarbeitungsphase: der Server hat
   * die Frage angenommen und abgelegt, die Antwort wird jetzt am Frageweg (`POST /api/ask`)
   * erarbeitet. Gesetzt unmittelbar vor dem Aufruf, beendet sobald er mit Antwort, Fehler oder
   * Abbruch zurückkehrt — kein Zeitgeber. `null`: keine Verarbeitung.
   */
  verarbeitetSeit: number | null;
  /** Der zuletzt gescheiterte Verwaltungsschritt (Einwilligung, neues Gespräch, Löschen). */
  hinweis: string | null;
  /** `false`, wenn der letzte Schritt NICHT gespeichert werden konnte. */
  schrittGespeichert: boolean;
}

const LEER: EchtZustand = {
  kontoId: null,
  laden: "aus",
  ladeFehler: null,
  gespraech: null,
  nachrichten: [],
  laeuftSeit: null,
  verarbeitetSeit: null,
  hinweis: null,
  schrittGespeichert: true,
};

let zustand: EchtZustand = LEER;
const hoerer = new Set<() => void>();
let laufend: AbortController | null = null;
let lokalZaehler = 0;

// ------------------------------------------------------------------------------------------------
// Bens Befund (nacharbeit-3): JEDER ASYNCHRONE ABLAUF GEHÖRT DEM KONTO, UNTER DEM ER BEGANN.
// ------------------------------------------------------------------------------------------------
// `vergiss()` (Abmelden, Kontowechsel) zählt die Generation hoch. Jeder Ablauf merkt sich beim Start
// seine Generation und prüft sie nach JEDEM `await` und vor JEDEM weiteren Schreibaufruf. Ist sie
// veraltet, endet er ohne jede Zustandsänderung und ohne weiteren Aufruf am Server — sonst setzte eine
// verspätete Antwort den Gesprächskopf des alten Kontos wieder ein, oder eine Fortsetzung von
// `fragen()` schickte die alte Frage unter der Sitzung des neuen Kontos weiter.
let generation = 0;

/** Ein Ablauf, dessen Konto inzwischen vergessen wurde. Wird nie angezeigt, nur beendet. */
class Veraltet extends Error {
  constructor() {
    super("Klara: Ablauf eines vergessenen Kontos beendet.");
    this.name = "Veraltet";
  }
}

function gueltig(gen: number): boolean {
  return gen === generation;
}

function pruefe(gen: number): void {
  if (!gueltig(gen)) {
    throw new Veraltet();
  }
}

function setze(f: (z: EchtZustand) => EchtZustand): void {
  const neu = f(zustand);
  if (neu === zustand) {
    return;
  }
  zustand = neu;
  for (const h of hoerer) {
    h();
  }
}

export function leseEcht(): EchtZustand {
  return zustand;
}

export function useEchtGespraech(): EchtZustand {
  return useSyncExternalStore(
    (h) => {
      hoerer.add(h);
      return () => hoerer.delete(h);
    },
    leseEcht,
    leseEcht,
  );
}

/** Abmelden, Kontowechsel, Tests: alles Gelesene vergessen, eine laufende Anfrage stoppen. */
export function vergiss(): void {
  generation += 1;
  laufend?.abort();
  laufend = null;
  zustand = LEER;
  for (const h of hoerer) {
    h();
  }
}

// ------------------------------------------------------------------------------------------------
// Reine Helfer.
// ------------------------------------------------------------------------------------------------

/**
 * Der Objektbezug, wie ihn der Server annimmt: Seite, Objekt und ggf. Artikelabsatz — seit Klara 03
 * auch Wissensobjekt, Fassung, Modus, Prüfstatus und Lesart, soweit der Appzustand sie kennt.
 * Den gewählten Bezug einer Frage setzt `objektbezugFuer` (`bezug.ts`).
 */
export function objektbezugAus(h: Herkunft): KlaraObjektbezug {
  return {
    pfad: h.pfad,
    seitenName: h.seitenName,
    objekt: h.objekt,
    ...(h.artikelId ? { artikelId: h.artikelId } : {}),
    ...(h.absatz ? { absatz: h.absatz } : {}),
    ...(h.koId ? { koId: h.koId } : {}),
    ...(h.fassung ? { fassung: h.fassung } : {}),
    ...(h.modus ? { modus: h.modus } : {}),
    ...(h.pruefstatus ? { pruefstatus: h.pruefstatus } : {}),
    ...(h.lesart ? { lesart: h.lesart } : {}),
  };
}

/** Der tatsächliche Zustand hinter einem Fehler — Grundschlüssel und ein Satz für den Menschen. */
export function fehlerBild(fehler: unknown, t: TFunction): { grund: string; text: string } {
  if (fehler instanceof ApiError) {
    if (fehler.code === "KI_ABGESCHALTET") {
      // Der Satz des Servers (D5) — derselbe Wortlaut wie auf der Seite „Fragen".
      return { grund: "ki_abgeschaltet", text: fehler.message || t("d5kiaus.hinweis") };
    }
    if (fehler.status === 401) {
      return { grund: "anmeldung", text: t("klaragespraech.fehler.anmeldung") };
    }
    if (fehler.status === 403) {
      return { grund: "berechtigung", text: t("klaragespraech.fehler.berechtigung") };
    }
    const bremse = kiBremsSatz(fehler);
    if (bremse) {
      return { grund: "gebremst", text: bremse };
    }
    if (fehler.status === 409 && fehler.details.grund === "einwilligung_fehlt") {
      return { grund: "einwilligung_fehlt", text: t("klaragespraech.einwilligung.fehlt") };
    }
    return {
      grund: "server",
      text: t("klaragespraech.fehler.server", { status: fehler.status }),
    };
  }
  if (fehler instanceof SyntaxError) {
    return { grund: "server", text: t("klaragespraech.fehler.server", { status: "?" }) };
  }
  return { grund: "netz", text: t("klaragespraech.fehler.netz") };
}

/** Wie eine Antwort des Fragewegs heisst: nur `demo: false` ist eine KI-Antwort. */
export function antwortModus(demo: boolean): "ki" | "ohne_ki" {
  return demo ? "ohne_ki" : "ki";
}

/** Der Gesprächsfaden: die vorigen getippten Fragen, älteste zuerst, höchstens drei. */
export function fadenAus(nachrichten: readonly EchtNachricht[]): string[] {
  return nachrichten
    .filter((n) => n.von === "du" && n.modus === "frage")
    .map((n) => n.text)
    .slice(-3);
}

/** Lief beim Laden noch eine Frage, ist sie mit dem Neuladen untergegangen. */
export function schrittUnterbrochen(s: KlaraSchritt | null, laeuftSeit: number | null): boolean {
  return s?.stand === "laeuft" && laeuftSeit === null;
}

// ------------------------------------------------------------------------------------------------
// Ablage.
// ------------------------------------------------------------------------------------------------

function ohneNachrichten(g: KlaraGespraech): Omit<KlaraGespraech, "nachrichten"> {
  return {
    id: g.id,
    objektbezug: g.objektbezug,
    letzterSchritt: g.letzterSchritt,
    einwilligungAm: g.einwilligungAm,
    angelegtAm: g.angelegtAm,
    geaendertAm: g.geaendertAm,
  };
}

function istGespraech(roh: unknown): roh is KlaraGespraech {
  return (
    typeof roh === "object" &&
    roh !== null &&
    typeof (roh as KlaraGespraech).id === "string" &&
    Array.isArray((roh as KlaraGespraech).nachrichten)
  );
}

/** Liest das eigene Gespräch — einmal je Konto, erneut nach einem Ladefehler. */
export async function ladeEcht(kontoId: string, t: TFunction): Promise<void> {
  if (zustand.kontoId === kontoId && (zustand.laden === "bereit" || zustand.laden === "laedt")) {
    return;
  }
  if (zustand.kontoId !== kontoId) {
    vergiss();
  }
  const gen = generation;
  setze((z) => ({ ...z, kontoId, laden: "laedt", ladeFehler: null }));
  try {
    const roh: unknown = await klaraGespraechApi.aktuelles();
    const kandidat =
      typeof roh === "object" && roh !== null ? (roh as { gespraech?: unknown }).gespraech : null;
    const g = istGespraech(kandidat) ? kandidat : null;
    if (!gueltig(gen) || zustand.kontoId !== kontoId) {
      return; // inzwischen abgemeldet oder anderes Konto
    }
    setze((z) => ({
      ...z,
      laden: "bereit",
      gespraech: g ? ohneNachrichten(g) : null,
      nachrichten: g ? g.nachrichten.map((n) => ({ ...n, gespeichert: "ja" as const })) : [],
    }));
  } catch (fehler) {
    if (!gueltig(gen) || zustand.kontoId !== kontoId) {
      return;
    }
    setze((z) => ({ ...z, laden: "fehler", ladeFehler: fehlerBild(fehler, t).text }));
  }
}

function uebernimmKopf(g: KlaraGespraech): void {
  setze((z) => ({ ...z, gespraech: ohneNachrichten(g) }));
}

async function sichereGespraech(bezug: KlaraObjektbezug, gen: number): Promise<string> {
  pruefe(gen);
  const vorhanden = zustand.gespraech?.id;
  if (vorhanden) {
    return vorhanden;
  }
  const { gespraech } = await klaraGespraechApi.beginne(bezug);
  pruefe(gen);
  setze((z) => ({ ...z, gespraech: ohneNachrichten(gespraech) }));
  return gespraech.id;
}

function lokaleNachricht(e: KlaraNachrichtEingabe, gespeichert: Speicherstand): EchtNachricht {
  lokalZaehler += 1;
  return {
    id: `lokal-${Date.now().toString(36)}-${lokalZaehler}`,
    von: e.von,
    modus: e.modus,
    text: e.text,
    objektbezug: e.objektbezug,
    antwortId: e.antwortId ?? null,
    quellen: e.quellen ?? [],
    ...(e.quellenAngaben ? { quellenAngaben: e.quellenAngaben } : {}),
    wissensklasse: e.wissensklasse ?? null,
    grund: e.grund ?? null,
    angelegtAm: new Date().toISOString(),
    gespeichert,
  };
}

function ersetzeNachricht(lokalId: string, n: EchtNachricht): void {
  setze((z) => ({ ...z, nachrichten: z.nachrichten.map((m) => (m.id === lokalId ? n : m)) }));
}

/**
 * Was aus einer Ablage wurde — unterscheidbar, weil der Aufrufer daran entscheidet: ohne
 * Einwilligung geht keine Frage an den Frageweg, und ein veralteter Ablauf tut gar nichts mehr.
 */
export type Ablage = "ja" | "nein" | "einwilligung_fehlt" | "veraltet";

async function legeAb(lokalId: string, e: KlaraNachrichtEingabe, gen: number): Promise<Ablage> {
  try {
    const id = await sichereGespraech(e.objektbezug, gen);
    const { nachricht, gespraech } = await klaraGespraechApi.nachricht(id, e);
    if (!gueltig(gen)) {
      return "veraltet";
    }
    ersetzeNachricht(lokalId, { ...nachricht, gespeichert: "ja" });
    uebernimmKopf(gespraech);
    return "ja";
  } catch (fehler) {
    if (fehler instanceof Veraltet || !gueltig(gen)) {
      return "veraltet";
    }
    const n = zustand.nachrichten.find((m) => m.id === lokalId);
    if (n) {
      ersetzeNachricht(lokalId, { ...n, gespeichert: "nein", nochmal: e });
    }
    if (fehler instanceof ApiError && fehler.details.grund === "einwilligung_fehlt") {
      // Anderswo widerrufen: Klara zeigt den Stand des Servers, nicht den eigenen.
      setze((z) => {
        if (!z.gespraech) {
          return z;
        }
        return { ...z, gespraech: { ...z.gespraech, einwilligungAm: null } };
      });
      return "einwilligung_fehlt";
    }
    return "nein";
  }
}

/** Zeigt die Nachricht sofort („wird gespeichert …") und hält sie am Server fest. */
async function speichere(e: KlaraNachrichtEingabe, gen: number): Promise<Ablage> {
  if (!gueltig(gen)) {
    return "veraltet";
  }
  const lokal = lokaleNachricht(e, "laeuft");
  setze((z) => ({ ...z, nachrichten: [...z.nachrichten, lokal] }));
  return legeAb(lokal.id, e, gen);
}

/** Zweiter Versuch für eine nicht gespeicherte Nachricht. */
export async function nochmalSpeichern(nachrichtId: string): Promise<void> {
  const gen = generation;
  const n = zustand.nachrichten.find((m) => m.id === nachrichtId);
  if (!n?.nochmal) {
    return;
  }
  ersetzeNachricht(nachrichtId, { ...n, gespeichert: "laeuft" });
  await legeAb(nachrichtId, n.nochmal, gen);
}

async function setzeSchritt(
  art: KlaraSchritt["art"],
  text: string,
  bezug: KlaraObjektbezug,
  stand: KlaraSchrittStand,
  gen: number,
): Promise<void> {
  try {
    const id = await sichereGespraech(bezug, gen);
    const { gespraech } = await klaraGespraechApi.schritt(id, {
      art,
      text: text.slice(0, 8_000),
      objektbezug: bezug,
      stand,
    });
    if (!gueltig(gen)) {
      return;
    }
    uebernimmKopf(gespraech);
    setze((z) => ({ ...z, schrittGespeichert: true }));
  } catch {
    if (gueltig(gen)) {
      setze((z) => ({ ...z, schrittGespeichert: false }));
    }
  }
}

// ------------------------------------------------------------------------------------------------
// Einwilligung, neues Gespräch, Löschen.
// ------------------------------------------------------------------------------------------------

export async function einwilligen(
  erteilt: boolean,
  bezug: KlaraObjektbezug,
  t: TFunction,
): Promise<boolean> {
  const gen = generation;
  setze((z) => ({ ...z, hinweis: null }));
  try {
    const id = await sichereGespraech(bezug, gen);
    const { gespraech } = await klaraGespraechApi.einwilligung(id, erteilt);
    if (!gueltig(gen)) {
      return false;
    }
    uebernimmKopf(gespraech);
    return true;
  } catch (fehler) {
    if (fehler instanceof Veraltet || !gueltig(gen)) {
      return false;
    }
    setze((z) => ({
      ...z,
      hinweis: t("klaragespraech.einwilligung.nichtGespeichert", {
        grund: fehlerBild(fehler, t).text,
      }),
    }));
    return false;
  }
}

export async function neuesGespraech(bezug: KlaraObjektbezug, t: TFunction): Promise<void> {
  const gen = generation;
  setze((z) => ({ ...z, hinweis: null }));
  try {
    const { gespraech } = await klaraGespraechApi.beginne(bezug);
    if (!gueltig(gen)) {
      return;
    }
    setze((z) => ({
      ...z,
      gespraech: ohneNachrichten(gespraech),
      nachrichten: [],
      schrittGespeichert: true,
    }));
  } catch (fehler) {
    if (gueltig(gen)) {
      setze((z) => ({ ...z, hinweis: fehlerBild(fehler, t).text }));
    }
  }
}

export async function loescheGespraech(t: TFunction): Promise<void> {
  const id = zustand.gespraech?.id;
  if (!id) {
    return;
  }
  const gen = generation;
  setze((z) => ({ ...z, hinweis: null }));
  try {
    await klaraGespraechApi.loesche(id);
    if (!gueltig(gen)) {
      return;
    }
    setze((z) => ({ ...z, gespraech: null, nachrichten: [], schrittGespeichert: true }));
  } catch (fehler) {
    if (gueltig(gen)) {
      setze((z) => ({ ...z, hinweis: fehlerBild(fehler, t).text }));
    }
  }
}

// ------------------------------------------------------------------------------------------------
// Fragen, Stoppen, Hilfe.
// ------------------------------------------------------------------------------------------------

export function laeuft(): boolean {
  return laufend !== null;
}

/** „Anfrage stoppen" — wirkt auch, wenn die Frage gerade noch abgelegt wird. */
export function stoppen(): void {
  laufend?.abort();
}

/** `veraltet`: das Konto wurde während der Frage vergessen — der Ablauf endete ohne Wirkung. */
export type Fragestand = Exclude<KlaraSchrittStand, "laeuft"> | "veraltet";

/**
 * Eine Frage im echten Betrieb. Voraussetzung (prüft der Aufrufer UND der Server): ein Gespräch mit
 * Einwilligung. Reihenfolge: Schritt „läuft" → Frage ablegen → Frageweg → Antwort ablegen → Schritt.
 *
 * Bens Befund (nacharbeit-3): Lehnt der Server die Ablage der Frage mit `einwilligung_fehlt` ab (in
 * einem anderen Tab widerrufen), geht die Frage NICHT an den Frageweg. Klara zeigt stattdessen den
 * tatsächlichen Zustand: die Frage als „Nicht gespeichert", die Einwilligungskarte wieder offen und
 * einen Fehlerhinweis „Ohne Einwilligung schickt Klara keine Frage los."
 */
export async function fragen(
  frage: string,
  bezug: KlaraObjektbezug,
  locale: ReasonerLocale,
  t: TFunction,
  /** Klara 03 (Nacharbeit 5): der gewählte Seitenkontext für den Frageweg — frei: keiner. */
  seitenbezug?: KlaraSeitenbezug,
): Promise<Fragestand> {
  if (laufend) {
    return "fehlgeschlagen";
  }
  const gen = generation;
  const steuerung = new AbortController();
  laufend = steuerung;
  setze((z) => ({ ...z, laeuftSeit: Date.now() }));
  const faden = fadenAus(zustand.nachrichten);
  let stand: Fragestand;
  try {
    await setzeSchritt("frage", frage, bezug, "laeuft", gen);
    if (!gueltig(gen)) {
      return "veraltet";
    }
    const frageAblage = await speichere(
      { von: "du", modus: "frage", text: frage, objektbezug: bezug },
      gen,
    );
    if (frageAblage === "veraltet" || !gueltig(gen)) {
      return "veraltet";
    }
    if (frageAblage === "einwilligung_fehlt") {
      // KEIN Aufruf des Fragewegs. Der Fehlerhinweis braucht keine Einwilligung und wird abgelegt.
      await speichere(
        {
          von: "klara",
          modus: "fehler",
          text: t("klaragespraech.einwilligung.fehlt"),
          grund: "einwilligung_fehlt",
          objektbezug: bezug,
        },
        gen,
      );
      stand = "fehlgeschlagen";
    } else {
      stand = await frageStellen(frage, bezug, locale, faden, steuerung, gen, t, seitenbezug);
    }
  } finally {
    if (laufend === steuerung) {
      laufend = null;
    }
    if (gueltig(gen)) {
      setze((z) => ({ ...z, laeuftSeit: null, verarbeitetSeit: null }));
    }
  }
  if (stand === "veraltet" || !gueltig(gen)) {
    return "veraltet";
  }
  await setzeSchritt("frage", frage, bezug, stand, gen);
  return stand;
}

/** Der Frageweg selbst, nach abgelegter Frage. Jede Fortsetzung prüft zuerst das Konto. */
async function frageStellen(
  frage: string,
  bezug: KlaraObjektbezug,
  locale: ReasonerLocale,
  faden: readonly string[],
  steuerung: AbortController,
  gen: number,
  t: TFunction,
  seitenbezug?: KlaraSeitenbezug,
): Promise<Fragestand> {
  // Die Frage ist am Server abgelegt; ab jetzt erarbeitet der Frageweg die Antwort.
  setze((z) => ({ ...z, verarbeitetSeit: Date.now() }));
  const verarbeitungEnde = (): void => {
    if (gueltig(gen)) {
      setze((z) => (z.verarbeitetSeit === null ? z : { ...z, verarbeitetSeit: null }));
    }
  };
  try {
    let antwort: Awaited<ReturnType<typeof klaraGespraechApi.frage>>;
    try {
      antwort = await klaraGespraechApi.frage(frage, locale, faden, steuerung.signal, seitenbezug);
    } finally {
      // Antwort, Fehler oder Abbruch: die Verarbeitung ist zu Ende (das Ablegen ist Warten).
      verarbeitungEnde();
    }
    if (!gueltig(gen)) {
      return "veraltet";
    }
    const r = antwort.result;
    const beantwortet = r.answered && Boolean(r.answer);
    // Ohne Antwort steht Klaras fester Satz da — der ist nie eine KI-Antwort. Klara 03: er sagt,
    // WELCHE Grundlage fehlt (zur Markierung, zum Artikel, allgemein) und ob es Ungeprüftes gibt.
    const roh = beantwortet && r.answer ? r.answer : fehlendeGrundlage(antwort, bezug, t);
    const text = roh.slice(0, 20_000);
    const getragen = r.citedSources?.length ? r.citedSources : r.sources;
    // Klara 03 · K3: eine Nicht-Antwort hat keine Quelle. Herangezogene Kandidaten neben dem Satz
    // „keine Grundlage“ sähen aus wie Belege, die es nicht gibt.
    const quellen = beantwortet ? getragen.filter((q) => q.length > 0).slice(0, 20) : [];
    // Klara 03 · K3: Titel, Fassung und Prüfstatus jeder Quelle — wie DIESE Antwort sie nannte.
    const quellenAngaben = beantwortet ? quellenAngabenAus(antwort, quellen) : [];
    const eingabe: KlaraNachrichtEingabe = {
      von: "klara",
      modus: beantwortet ? antwortModus(r.demo === true) : "ohne_ki",
      text,
      objektbezug: bezug,
      quellen,
      ...(quellenAngaben.length > 0 ? { quellenAngaben } : {}),
      ...(typeof r.knowledgeClass === "string" ? { wissensklasse: r.knowledgeClass } : {}),
    };
    if (antwort.answerId) {
      const ablage = await speichere({ ...eingabe, antwortId: antwort.answerId }, gen);
      if (ablage === "veraltet") {
        return "veraltet";
      }
    } else {
      // Ohne Antwortkennung nimmt der Server die Antwort zu Recht nicht an — sie steht da, aber
      // ausdrücklich als nicht gespeichert.
      const ohneBeleg: EchtNachricht = { ...lokaleNachricht(eingabe, "nein"), ohneBeleg: true };
      setze((z) => ({ ...z, nachrichten: [...z.nachrichten, ohneBeleg] }));
    }
    return "beantwortet";
  } catch (fehler) {
    if (!gueltig(gen)) {
      // Abgebrochen durch `vergiss()` (Kontowechsel): nichts ablegen, nichts zeigen.
      return "veraltet";
    }
    if (steuerung.signal.aborted) {
      const ablage = await speichere(
        {
          von: "klara",
          modus: "abgebrochen",
          text: t("klaragespraech.abgebrochen"),
          objektbezug: bezug,
        },
        gen,
      );
      return ablage === "veraltet" ? "veraltet" : "abgebrochen";
    }
    const bild = fehlerBild(fehler, t);
    const ablage = await speichere(
      {
        von: "klara",
        modus: "fehler",
        text: bild.text,
        grund: bild.grund,
        objektbezug: bezug,
      },
      gen,
    );
    return ablage === "veraltet" ? "veraltet" : "fehlgeschlagen";
  }
}

/**
 * Klaras eingebaute Hilfe (Seite erklären, Tutorial zeigen/begleiten) im echten Betrieb: KEINE KI,
 * keine Einwilligung nötig — aber Teil des Gesprächs, gekennzeichnet als „Klarwerk-Hilfe · ohne KI".
 */
export async function hilfe(
  bitte: string,
  antwort: string,
  bezug: KlaraObjektbezug,
): Promise<void> {
  const gen = generation;
  const bitteAblage = await speichere(
    { von: "du", modus: "hilfe", text: bitte, objektbezug: bezug },
    gen,
  );
  if (bitteAblage === "veraltet") {
    return;
  }
  const antwortAblage = await speichere(
    { von: "klara", modus: "hilfetext", text: antwort, objektbezug: bezug },
    gen,
  );
  if (antwortAblage === "veraltet") {
    return;
  }
  await setzeSchritt("hilfe", bitte, bezug, "beantwortet", gen);
}
