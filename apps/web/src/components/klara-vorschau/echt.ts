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
  klaraGespraechApi,
} from "../../api/klaraGespraech";
import { kiBremsSatz } from "../../lib/kiBremse";
import type { ReasonerLocale } from "../../lib/reasonerLocale";
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
  hinweis: null,
  schrittGespeichert: true,
};

let zustand: EchtZustand = LEER;
const hoerer = new Set<() => void>();
let laufend: AbortController | null = null;
let lokalZaehler = 0;

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

/** Der Objektbezug, wie ihn der Server annimmt: Seite, Objekt und ggf. Artikelabsatz. */
export function objektbezugAus(h: Herkunft): KlaraObjektbezug {
  return {
    pfad: h.pfad,
    seitenName: h.seitenName,
    objekt: h.objekt,
    ...(h.artikelId ? { artikelId: h.artikelId } : {}),
    ...(h.absatz ? { absatz: h.absatz } : {}),
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
  setze((z) => ({ ...z, kontoId, laden: "laedt", ladeFehler: null }));
  try {
    const roh: unknown = await klaraGespraechApi.aktuelles();
    const kandidat =
      typeof roh === "object" && roh !== null ? (roh as { gespraech?: unknown }).gespraech : null;
    const g = istGespraech(kandidat) ? kandidat : null;
    if (zustand.kontoId !== kontoId) {
      return; // inzwischen abgemeldet oder anderes Konto
    }
    setze((z) => ({
      ...z,
      laden: "bereit",
      gespraech: g ? ohneNachrichten(g) : null,
      nachrichten: g ? g.nachrichten.map((n) => ({ ...n, gespeichert: "ja" as const })) : [],
    }));
  } catch (fehler) {
    if (zustand.kontoId !== kontoId) {
      return;
    }
    setze((z) => ({ ...z, laden: "fehler", ladeFehler: fehlerBild(fehler, t).text }));
  }
}

function uebernimmKopf(g: KlaraGespraech): void {
  setze((z) => ({ ...z, gespraech: ohneNachrichten(g) }));
}

async function sichereGespraech(bezug: KlaraObjektbezug): Promise<string> {
  const vorhanden = zustand.gespraech?.id;
  if (vorhanden) {
    return vorhanden;
  }
  const { gespraech } = await klaraGespraechApi.beginne(bezug);
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
    wissensklasse: e.wissensklasse ?? null,
    grund: e.grund ?? null,
    angelegtAm: new Date().toISOString(),
    gespeichert,
  };
}

function ersetzeNachricht(lokalId: string, n: EchtNachricht): void {
  setze((z) => ({ ...z, nachrichten: z.nachrichten.map((m) => (m.id === lokalId ? n : m)) }));
}

async function legeAb(lokalId: string, e: KlaraNachrichtEingabe): Promise<boolean> {
  try {
    const id = await sichereGespraech(e.objektbezug);
    const { nachricht, gespraech } = await klaraGespraechApi.nachricht(id, e);
    ersetzeNachricht(lokalId, { ...nachricht, gespeichert: "ja" });
    uebernimmKopf(gespraech);
    return true;
  } catch (fehler) {
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
    }
    return false;
  }
}

/** Zeigt die Nachricht sofort („wird gespeichert …") und hält sie am Server fest. */
async function speichere(e: KlaraNachrichtEingabe): Promise<boolean> {
  const lokal = lokaleNachricht(e, "laeuft");
  setze((z) => ({ ...z, nachrichten: [...z.nachrichten, lokal] }));
  return legeAb(lokal.id, e);
}

/** Zweiter Versuch für eine nicht gespeicherte Nachricht. */
export async function nochmalSpeichern(nachrichtId: string): Promise<void> {
  const n = zustand.nachrichten.find((m) => m.id === nachrichtId);
  if (!n?.nochmal) {
    return;
  }
  ersetzeNachricht(nachrichtId, { ...n, gespeichert: "laeuft" });
  await legeAb(nachrichtId, n.nochmal);
}

async function setzeSchritt(
  art: KlaraSchritt["art"],
  text: string,
  bezug: KlaraObjektbezug,
  stand: KlaraSchrittStand,
): Promise<void> {
  try {
    const id = await sichereGespraech(bezug);
    const { gespraech } = await klaraGespraechApi.schritt(id, {
      art,
      text: text.slice(0, 8_000),
      objektbezug: bezug,
      stand,
    });
    uebernimmKopf(gespraech);
    setze((z) => ({ ...z, schrittGespeichert: true }));
  } catch {
    setze((z) => ({ ...z, schrittGespeichert: false }));
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
  setze((z) => ({ ...z, hinweis: null }));
  try {
    const id = await sichereGespraech(bezug);
    const { gespraech } = await klaraGespraechApi.einwilligung(id, erteilt);
    uebernimmKopf(gespraech);
    return true;
  } catch (fehler) {
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
  setze((z) => ({ ...z, hinweis: null }));
  try {
    const { gespraech } = await klaraGespraechApi.beginne(bezug);
    setze((z) => ({
      ...z,
      gespraech: ohneNachrichten(gespraech),
      nachrichten: [],
      schrittGespeichert: true,
    }));
  } catch (fehler) {
    setze((z) => ({ ...z, hinweis: fehlerBild(fehler, t).text }));
  }
}

export async function loescheGespraech(t: TFunction): Promise<void> {
  const id = zustand.gespraech?.id;
  if (!id) {
    return;
  }
  setze((z) => ({ ...z, hinweis: null }));
  try {
    await klaraGespraechApi.loesche(id);
    setze((z) => ({ ...z, gespraech: null, nachrichten: [], schrittGespeichert: true }));
  } catch (fehler) {
    setze((z) => ({ ...z, hinweis: fehlerBild(fehler, t).text }));
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

export type Fragestand = Exclude<KlaraSchrittStand, "laeuft">;

/**
 * Eine Frage im echten Betrieb. Voraussetzung (prüft der Aufrufer UND der Server): ein Gespräch mit
 * Einwilligung. Reihenfolge: Schritt „läuft" → Frage ablegen → Frageweg → Antwort ablegen → Schritt.
 */
export async function fragen(
  frage: string,
  bezug: KlaraObjektbezug,
  locale: ReasonerLocale,
  t: TFunction,
): Promise<Fragestand> {
  if (laufend) {
    return "fehlgeschlagen";
  }
  const steuerung = new AbortController();
  laufend = steuerung;
  setze((z) => ({ ...z, laeuftSeit: Date.now() }));
  const faden = fadenAus(zustand.nachrichten);
  let stand: Fragestand;
  try {
    await setzeSchritt("frage", frage, bezug, "laeuft");
    await speichere({ von: "du", modus: "frage", text: frage, objektbezug: bezug });
    try {
      const antwort = await klaraGespraechApi.frage(frage, locale, faden, steuerung.signal);
      const r = antwort.result;
      const beantwortet = r.answered && Boolean(r.answer);
      // Ohne Antwort steht Klaras fester Satz da — der ist nie eine KI-Antwort.
      const roh = beantwortet && r.answer ? r.answer : t("klaragespraech.antwort.keine");
      const text = roh.slice(0, 20_000);
      const getragen = r.citedSources?.length ? r.citedSources : r.sources;
      const quellen = getragen.filter((q) => q.length > 0).slice(0, 20);
      const eingabe: KlaraNachrichtEingabe = {
        von: "klara",
        modus: beantwortet ? antwortModus(r.demo === true) : "ohne_ki",
        text,
        objektbezug: bezug,
        quellen,
        ...(typeof r.knowledgeClass === "string" ? { wissensklasse: r.knowledgeClass } : {}),
      };
      if (antwort.answerId) {
        await speichere({ ...eingabe, antwortId: antwort.answerId });
      } else {
        // Ohne Antwortkennung nimmt der Server die Antwort zu Recht nicht an — sie steht da, aber
        // ausdrücklich als nicht gespeichert.
        const ohneBeleg: EchtNachricht = { ...lokaleNachricht(eingabe, "nein"), ohneBeleg: true };
        setze((z) => ({ ...z, nachrichten: [...z.nachrichten, ohneBeleg] }));
      }
      stand = "beantwortet";
    } catch (fehler) {
      if (steuerung.signal.aborted) {
        await speichere({
          von: "klara",
          modus: "abgebrochen",
          text: t("klaragespraech.abgebrochen"),
          objektbezug: bezug,
        });
        stand = "abgebrochen";
      } else {
        const bild = fehlerBild(fehler, t);
        await speichere({
          von: "klara",
          modus: "fehler",
          text: bild.text,
          grund: bild.grund,
          objektbezug: bezug,
        });
        stand = "fehlgeschlagen";
      }
    }
  } finally {
    laufend = null;
    setze((z) => ({ ...z, laeuftSeit: null }));
  }
  await setzeSchritt("frage", frage, bezug, stand);
  return stand;
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
  await speichere({ von: "du", modus: "hilfe", text: bitte, objektbezug: bezug });
  await speichere({ von: "klara", modus: "hilfetext", text: antwort, objektbezug: bezug });
  await setzeSchritt("hilfe", bitte, bezug, "beantwortet");
}
