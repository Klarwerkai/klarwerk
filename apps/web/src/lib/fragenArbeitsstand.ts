// ================================================================================================
// PEDI 28.09.2026 · ERGÄNZUNG 1 — DIE ARBEIT AUF DER SEITE „FRAGEN" GEHT NICHT MEHR VERLOREN.
// ================================================================================================
//
// Bis hierher lebten Entwurf und Antwort der Fragenseite nur im React-Zustand von `pages/Ask.tsx`.
// Jeder Abbau der Seite nahm beides mit: das Tutorial öffnen, die Breite wechseln (`AppShell` hat
// für schmal und breit getrennte Rückgaben und montiert die Seite neu), weg- und zurücknavigieren,
// neu laden, ab- und wieder anmelden.
//
// DIE BAUFORM, und warum sie so eng ist:
//   · EIN Eintrag JE KONTO. Der Schlüssel trägt die Kontokennung aus der zuletzt beantworteten
//     Sitzungsabfrage; ohne Kennung wird weder gelesen noch geschrieben. Ein anderes Konto im
//     selben Browser liest einen anderen Schlüssel und sieht nichts. Das Abmelden löscht den
//     Eintrag bewusst NICHT — „nach erneuter Anmeldung wieder aufnehmen" ist die Zusage.
//   · Die Antwort wird so abgelegt, wie sie angezeigt wurde — mit ihren Quellen, ihrem Beleg und
//     ihrer Lücken-Id. Beim Wiederkommen wird sie aus dem Speicher gezeigt; es geht KEINE neue
//     Modellanfrage hinaus.
//   · Verwerfen heißt Löschen. Ein geleertes Feld ist ein verworfener Entwurf und wird als leer
//     gespeichert; der Knopf „Entwurf verwerfen" tut dasselbe ausdrücklich. Nichts davon kann
//     später wieder auftauchen, weil es keine zweite Ablage gibt.
//   · Jeder Speicherfehler (gesperrter Speicher, Quote voll, kaputter Eintrag) endet still in
//     „kein Arbeitsstand" — dieselbe fehlertolerante Grenze wie `persistentToggle.ts`.
//
// DOM-frei: der Speicher wird hereingereicht, damit die Regeln ohne Browser prüfbar sind.
import type { AnswerResult, VerschlossenHinweis } from "../api/types";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const PRAEFIX = "kw.fragen.arbeitsstand.v1:";

/** Die zuletzt angezeigte Antwort — genau das, was die Fläche zum Zeichnen braucht. */
export interface GespeicherteAntwort {
  /** Die Frage, zu der diese Antwort gehört. */
  frage: string;
  result: AnswerResult;
  /** Der Answer-Receipt dieses Antwortvorgangs (für „Das hat mir geholfen"). */
  receipt: string;
  verschlossen: VerschlossenHinweis[];
  gapId: string | null;
  /** Zeitpunkt der Antwort (ISO) — die Fläche nennt ihn, damit niemand sie für frisch hält. */
  angezeigtAm: string;
}

export interface FragenArbeitsstand {
  /** Der Text im Fragefeld, wie er zuletzt stand. Leer = kein Entwurf. */
  entwurf: string;
  antwort: GespeicherteAntwort | null;
}

/**
 * Der Browserspeicher — oder `undefined`, wenn es keinen gibt oder schon das Ermitteln wirft
 * (gesperrter Speicher, `SecurityError`). Dieselbe Grenze wie `safeLocalStorage`, nur mit
 * `removeItem`, weil Verwerfen hier Löschen heißt.
 */
export function fragenSpeicher(): StorageLike | undefined {
  try {
    const holder = globalThis as unknown as { localStorage?: StorageLike };
    return holder.localStorage ?? undefined;
  } catch {
    return undefined;
  }
}

function arbeitsstandSchluessel(konto: string): string {
  return `${PRAEFIX}${konto}`;
}

function istObjekt(wert: unknown): wert is Record<string, unknown> {
  return typeof wert === "object" && wert !== null && !Array.isArray(wert);
}

function antwortAus(roh: unknown): GespeicherteAntwort | null {
  if (!istObjekt(roh)) {
    return null;
  }
  const { frage, result, receipt, verschlossen, gapId, angezeigtAm } = roh;
  if (
    typeof frage !== "string" ||
    frage.trim() === "" ||
    !istObjekt(result) ||
    typeof result.answered !== "boolean" ||
    !Array.isArray(result.sources) ||
    typeof receipt !== "string" ||
    !Array.isArray(verschlossen) ||
    !(gapId === null || typeof gapId === "string") ||
    typeof angezeigtAm !== "string" ||
    Number.isNaN(Date.parse(angezeigtAm))
  ) {
    return null;
  }
  return {
    frage,
    result: result as unknown as AnswerResult,
    receipt,
    verschlossen: verschlossen as VerschlossenHinweis[],
    gapId,
    angezeigtAm,
  };
}

/**
 * Den Arbeitsstand EINES Kontos lesen. `null` heißt „nichts wiederaufzunehmen" — ohne Konto, ohne
 * Speicher, ohne Eintrag, bei beschädigtem Eintrag und bei einem Eintrag ohne Inhalt.
 */
export function arbeitsstandLesen(
  storage: StorageLike | undefined,
  konto: string | null,
): FragenArbeitsstand | null {
  if (!storage || !konto) {
    return null;
  }
  try {
    const roh = storage.getItem(arbeitsstandSchluessel(konto));
    if (roh === null) {
      return null;
    }
    const wert: unknown = JSON.parse(roh);
    if (!istObjekt(wert) || typeof wert.entwurf !== "string") {
      return null;
    }
    const antwort = antwortAus(wert.antwort);
    if (wert.entwurf.trim() === "" && antwort === null) {
      return null;
    }
    return { entwurf: wert.entwurf, antwort };
  } catch {
    return null;
  }
}

/**
 * Den Arbeitsstand EINES Kontos schreiben. Ein leerer Stand (kein Entwurf, keine Antwort) löscht
 * den Eintrag — es bleibt nichts liegen, was niemand mehr braucht.
 */
export function arbeitsstandSchreiben(
  storage: StorageLike | undefined,
  konto: string | null,
  stand: FragenArbeitsstand,
): void {
  if (!storage || !konto) {
    return;
  }
  try {
    const schluessel = arbeitsstandSchluessel(konto);
    if (stand.entwurf.trim() === "" && stand.antwort === null) {
      storage.removeItem(schluessel);
      return;
    }
    storage.setItem(schluessel, JSON.stringify(stand));
  } catch {
    // Speicher voll/verweigert → der Stand lebt dann nur in dieser Sitzung.
  }
}

/**
 * Ist der Entwurf etwas, das NOCH NICHT gesendet wurde? Ein Feld, in dem genau die beantwortete
 * Frage steht, ist kein offener Entwurf — sonst hieße jede Rückkehr „du hast etwas angefangen".
 */
function offenerEntwurf(stand: FragenArbeitsstand): boolean {
  const entwurf = stand.entwurf.trim();
  return entwurf !== "" && entwurf !== stand.antwort?.frage.trim();
}

/** Was beim Wiederkommen aufgenommen wurde — die Grundlage des sichtbaren Hinweises. */
export interface Wiederaufnahme {
  /** Ein ungesendeter Entwurf steht wieder im Feld. */
  entwurf: boolean;
  /** Zeitpunkt der wieder angezeigten Antwort; `null`, wenn keine aufgenommen wurde. */
  antwortAm: string | null;
}

/**
 * Den Hinweis aus dem gelesenen Stand ableiten. Kam eine Startfrage über die Adresse (`?q=`),
 * steht SIE im Feld und nicht der Entwurf — dann wird auch kein Entwurf angekündigt.
 */
export function wiederaufnahmeAus(
  stand: FragenArbeitsstand | null,
  startfrageAusAdresse: boolean,
): Wiederaufnahme | null {
  if (stand === null) {
    return null;
  }
  const entwurf = !startfrageAusAdresse && offenerEntwurf(stand);
  const antwortAm = stand.antwort?.angezeigtAm ?? null;
  return entwurf || antwortAm !== null ? { entwurf, antwortAm } : null;
}
