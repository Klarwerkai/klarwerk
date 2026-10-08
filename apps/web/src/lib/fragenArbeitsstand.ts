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
import type { AnswerResult, Fragekontext, VerschlossenHinweis } from "../api/types";

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
  /**
   * R-0305/R-1099 (Ben, Nacharbeit 10): der Fragekontext (R-1633), mit dem DIESE Antwort gestellt
   * wurde — die Zweitmeinung nach einer Wiederaufnahme fragt mit genau ihm. Drei Lesarten:
   *   · ein Objekt — mit diesem Werk/dieser Schicht/Rolle gefragt;
   *   · `null`     — ausdrücklich OHNE Kontext gefragt;
   *   · fehlt      — Altstand von vor dieser Ablage: der Kontext ist UNBEKANNT. Dann wird keine
   *                  kontextgleiche Zweitmeinung behauptet (s. `components/fragen/Zweitmeinung.tsx`).
   */
  fragekontext?: Fragekontext | null;
}

/**
 * Der gespeicherte Fragekontext — streng gelesen: `null` bleibt „ohne Kontext", ein Objekt nur mit
 * Zeichenketten in `werk`/`schicht`/`rolle`, alles andere (fehlt, beschädigt) ist `undefined` =
 * UNBEKANNT. Ein beschädigter Kontext wird nie zu „ohne Kontext" umgedeutet.
 */
function fragekontextAus(roh: unknown): Fragekontext | null | undefined {
  if (roh === null) {
    return null;
  }
  if (!istObjekt(roh)) {
    return undefined;
  }
  const kontext: Fragekontext = {};
  for (const feld of ["werk", "schicht", "rolle"] as const) {
    const wert = roh[feld];
    if (wert === undefined) {
      continue;
    }
    if (typeof wert !== "string") {
      return undefined;
    }
    kontext[feld] = wert;
  }
  return kontext;
}

export interface FragenArbeitsstand {
  /** Der Text im Fragefeld, wie er zuletzt stand. Leer = kein Entwurf. */
  entwurf: string;
  antwort: GespeicherteAntwort | null;
  /**
   * Die Startadressen (`?q=`/`?ask=1` samt Navigationskennung), die dieser Stand schon übernommen
   * hat — s. `startadresseMarke`. Öffnet eine davon die Seite erneut (Neuladen, Zurück, Vor), ist
   * sie verbraucht: dann gewinnt der Stand, und es wird nicht noch einmal gefragt.
   *
   * Ben R2, F2/F3: bis Runde 2 stand hier nur die ZULETZT übernommene Marke. Lag dazwischen eine
   * zweite Startadresse, galt die ältere beim Zurückgehen wieder als neu — sie holte einen
   * verworfenen Entwurf zurück und fragte das Modell ein zweites Mal. Deshalb eine Liste.
   *
   * Ben R3, F2/F3: Runde 3 begrenzte die Liste auf 50 Marken. Nach der 51. Startadresse galt die
   * erste wieder als neu — mit denselben beiden Folgen. Ein Verlaufseintrag behält seine Kennung,
   * solange es ihn gibt; eine Grenze, ab der er „vergessen" werden darf, gibt es nicht. Die Liste
   * ist deshalb UNBEGRENZT. Eine Marke ist rund 25 Zeichen lang (Kennung, Antwortwunsch, Prüfwert —
   * kein Fragetext); selbst tausende Startadressen bleiben weit unter der Speichergrenze, und
   * scheitert das Schreiben doch, greift dieselbe stille Grenze wie bei jedem Speicherfehler.
   */
  startadressen: string[];
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
  const fragekontext = fragekontextAus(roh.fragekontext);
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
    // Fehlt oder beschädigt: das Feld fehlt auch hier — „unbekannt" hat genau eine Darstellung.
    ...(fragekontext === undefined ? {} : { fragekontext }),
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
    // Runde-2-Einträge trugen EINE Marke unter `startfrage` — sie wird übernommen, nicht verloren.
    const startadressen = Array.isArray(wert.startadressen)
      ? wert.startadressen.filter((m): m is string => typeof m === "string")
      : typeof wert.startfrage === "string"
        ? [wert.startfrage]
        : [];
    if (wert.entwurf.trim() === "" && antwort === null && startadressen.length === 0) {
      return null;
    }
    return { entwurf: wert.entwurf, antwort, startadressen };
  } catch {
    return null;
  }
}

/**
 * Den Arbeitsstand EINES Kontos schreiben. Ein leerer Stand (kein Entwurf, keine Antwort, keine
 * verbrauchte Startadresse) löscht den Eintrag — es bleibt nichts liegen, was niemand mehr braucht.
 * Die Startadresse allein hält den Eintrag: sonst käme ein bewusst geleertes Feld beim Neuladen
 * derselben Adresse mit der Startfrage wieder.
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
    if (stand.entwurf.trim() === "" && stand.antwort === null && stand.startadressen.length === 0) {
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

/**
 * Die Marke einer Startadresse: Navigationskennung + Startfrage + Antwortwunsch — oder `null`, wenn
 * die Adresse keine Startfrage trägt.
 *
 * WARUM DIE NAVIGATIONSKENNUNG (`location.key`) DAZUGEHÖRT: Jeder neue Weg auf die Seite (Link,
 * Enter auf Start, Suche) erzeugt eine neue Kennung — die Startfrage gilt dann, auch wenn sie
 * wörtlich dieselbe ist wie beim letzten Mal. Neuladen und Zurück behalten die Kennung — dann ist
 * es DIESELBE Adresse, sie wurde schon übernommen, und der gespeicherte Stand gewinnt.
 */
/**
 * Eine Marke der Liste der übernommenen Startadressen hinzufügen: ohne Doppel, die jüngste zuletzt,
 * ohne Obergrenze (s. `FragenArbeitsstand.startadressen`). Ohne Marke bleibt die Liste, wie sie ist.
 */
export function startadresseMerken(liste: readonly string[], marke: string | null): string[] {
  if (marke === null) {
    return [...liste];
  }
  return [...liste.filter((m) => m !== marke), marke];
}

export function startadresseMarke(
  navigationsKennung: string,
  startfrage: string | null,
  autoFrage: boolean,
): string | null {
  return startfrage === null
    ? null
    : `${navigationsKennung}:${autoFrage ? "1" : "0"}:${pruefwert(startfrage)}`;
}

/**
 * Die Marke trägt die Startfrage NICHT im Klartext, sondern als Prüfwert (FNV-1a, 32 Bit): Sie
 * bleibt auch nach „Entwurf verwerfen" im Speicher stehen, und dort soll dann kein Fragetext mehr
 * liegen (Datenschutzerklärung Abschnitt 4, `s4.p8`: „Ein verworfener Entwurf wird sofort
 * entfernt"). Für die einzige Frage, die sie beantwortet — „ist das dieselbe Adresse?" —, reicht
 * die Gleichheit des Prüfwerts.
 */
function pruefwert(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

/**
 * Ben R1, F8: Der Antwortbeleg (Receipt) gilt auf dem Server 30 Minuten
 * (`services/ask/src/receipt.ts`, `ANSWER_RECEIPT_TTL_MS`). Die Fläche rechnet mit einer Minute
 * Abstand, damit ein Klick kurz vor Ablauf nicht erst am Server scheitert. Gemessen wird ab dem
 * Zeitpunkt, zu dem die Antwort ankam — der Beleg entstand unmittelbar davor.
 */
const BELEG_GUELTIG_MS = 29 * 60_000;

/** Kann „Hat geholfen" mit dem Beleg dieser Antwort noch angenommen werden? */
export function belegNochGueltig(
  receipt: string,
  antwortAm: string | null,
  jetztMs: number,
): boolean {
  if (receipt === "" || antwortAm === null) {
    return false;
  }
  const am = Date.parse(antwortAm);
  return !Number.isNaN(am) && jetztMs - am < BELEG_GUELTIG_MS;
}
