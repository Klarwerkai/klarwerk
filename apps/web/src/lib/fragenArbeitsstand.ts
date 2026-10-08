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
  /**
   * R-0338: die Fassung jeder herangezogenen Quelle, wie der SERVER sie zu dieser Antwort meldete
   * (`AskResponse.quellenStand`) — Grundlage des Auffrischen-Vertrags (`antwortFrische`). Eigener
   * Schlüsselname: ein früherer, nie ausgelieferter Stand legte unter `quellenStand` einen Wert aus
   * dem Browserbestand ab; der wird bewusst nicht als Serverstand gelesen.
   */
  serverQuellenStand?: QuellenStand;
  /** R-0338, Regel 4: die Fassungen, die die Fläche beim Eintreffen kannte (`beobachtungAus`). */
  beobachtet?: QuellenStand;
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
  const serverQuellenStand = quellenStandLesen(roh.serverQuellenStand);
  const beobachtet = quellenStandLesen(roh.beobachtet);
  return {
    frage,
    result: result as unknown as AnswerResult,
    receipt,
    verschlossen: verschlossen as VerschlossenHinweis[],
    gapId,
    angezeigtAm,
    ...(serverQuellenStand ? { serverQuellenStand } : {}),
    ...(beobachtet ? { beobachtet } : {}),
  };
}

// Ein beschädigter Stand ist KEIN Grund, die Antwort zu verwerfen — er ist dann bloss unbekannt,
// und es gilt Regel 4 des Auffrischen-Vertrags (wie für einen Eintrag von vor diesem Feld).
function quellenStandLesen(roh: unknown): QuellenStand | undefined {
  if (!istObjekt(roh)) {
    return undefined;
  }
  const eintraege = Object.entries(roh);
  return eintraege.every(([, v]) => typeof v === "number" && Number.isInteger(v))
    ? (Object.fromEntries(eintraege) as QuellenStand)
    : undefined;
}

// ================================================================================================
// R-0338 (Aufnahme gesamt-suchindex-aktualitaet) — DER AUFFRISCHEN-VERTRAG DER FRAGENSEITE.
// ================================================================================================
//
// Ändert sich Wissen, zeigt Klara nicht weiter den alten Stand. WANN NEU GELADEN WIRD:
//   1 Jede gestellte Frage — auch dieselbe noch einmal — holt die Antwort neu vom Server. Der liest
//     die Suchprojektion, die im selben Schreibvorgang wie jede Überarbeitung entsteht; eine
//     ersetzte, zurückgezogene oder aufgegangene Fassung ist dort kein Kandidat.
//   2 Eine STEHENDE Antwort (wiederaufgenommen oder eben angekommen) wird nie von selbst neu
//     erzeugt — es geht ohne Absenden keine Modellanfrage hinaus (Ergänzung 1). Sie wird aber gegen
//     den Bestand geprüft, sooft der neu geladen ist (Öffnen der Seite, Fensterfokus, Auffrischung
//     nach einer Änderung): hat sich eine ihrer Quellen seither geändert, ist sie ÜBERHOLT und wird
//     nicht mehr gezeigt. Die Fläche sagt das und bietet „Neu fragen" an.
//   3 MIT QUELLENSTAND. Der Stand kommt vom SERVER (`AskResponse.quellenStand`): die Fassungen, die
//     die Antwort tatsächlich gelesen hat — nicht der Browserbestand von eben (Ben, Nacharbeit 3).
//     Überholt ist sie, sobald eine Quelle im Bestand fehlt (Papierkorb, nicht mehr sichtbar — etwa
//     nach einer Heraufstufung), aufgegangen ist oder eine NEUERE Fassung trägt. Kennt der Browser
//     nur eine ÄLTERE Fassung als die Antwort, ist sein Bestand der veraltete, nicht die Antwort.
//   4 OHNE BELASTBAREN QUELLENSTAND (Altbestand, ein älterer Server, eine Quelle fehlt im Stand)
//     bleibt die Antwort nicht unbegrenzt stehen. Überholt ist sie, sobald eine Quelle fehlt oder
//     aufgegangen ist — und für jede Quelle sonst:
//       · kannte die Fläche sie beim Eintreffen der Antwort (`beobachtet`), sobald sie seither eine
//         neuere Fassung trägt. Das ist KEINE Aussage darüber, was die Antwort gelesen hat, nur eine
//         Untergrenze: was danach kam, kam nach der Antwort;
//       · sonst nach ihrem Verlauf: eine Änderung NACH dem Zeitpunkt der Antwort — oder es lässt
//         sich gar nicht sagen (kein lesbarer Zeitpunkt, eine spätere Fassung ohne Verlauf).
//     Im Zweifel also „Neu fragen", nie still der alte Stand.
//   5 Ohne geladenen Bestand ist die Antwort UNGEPRÜFT: sie bleibt mit ihrem Zeitpunkt stehen —
//     der Bestand lädt mit der Seite, das ist ein Augenblick und kein Dauerzustand.

/** Die Fassung jeder herangezogenen Quelle, wie die Antwort sie gelesen hat. */
export type QuellenStand = Record<string, number>;

export type AntwortFrische = "aktuell" | "ueberholt" | "ungeprueft";

/** Was die Regel vom Bestand braucht — genau die Felder, die eine Änderung verraten. */
export interface QuellenBestandEintrag {
  id: string;
  version: number;
  mergedInto?: unknown;
  /** Der Änderungsverlauf (Fassung + Zeitpunkt) — für Antworten ohne Quellenstand (Regel 4). */
  history?: readonly { version: number; at: string }[];
}

/**
 * Den Quellenstand einer eben angekommenen Antwort festhalten — aus dem, was der SERVER zu dieser
 * Antwort meldet. `undefined`, wenn er keinen oder einen unvollständigen Stand meldet: dann gibt es
 * keinen Stand, für den die Fläche bürgen könnte, und es gilt Regel 4.
 */
export function quellenStandAus(
  quellen: readonly string[],
  vomServer: Readonly<Record<string, unknown>> | undefined,
): QuellenStand | undefined {
  if (!vomServer) {
    return undefined;
  }
  const stand: QuellenStand = {};
  for (const id of quellen) {
    const fassung = vomServer[id];
    if (typeof fassung !== "number" || !Number.isInteger(fassung)) {
      return undefined;
    }
    stand[id] = fassung;
  }
  return stand;
}

/**
 * Regel 4, erster Spiegelstrich: die Fassungen, die die FLÄCHE beim Eintreffen der Antwort von
 * ihren Quellen kannte — nur die, die sie kannte. Ohne geladenen Bestand leer.
 */
export function beobachtungAus(
  quellen: readonly string[],
  bestand: readonly QuellenBestandEintrag[] | undefined,
): QuellenStand {
  const nachId = new Map((bestand ?? []).map((ko) => [ko.id, ko]));
  const beobachtet: QuellenStand = {};
  for (const id of quellen) {
    const ko = nachId.get(id);
    if (ko) {
      beobachtet[id] = ko.version;
    }
  }
  return beobachtet;
}

/** Die Antwort, wie die Regel sie sieht: Quellen, Serverstand, Beobachtung, Zeitpunkt. */
export interface StehendeAntwort {
  quellen: readonly string[];
  stand: QuellenStand | undefined;
  beobachtet?: QuellenStand | undefined;
  am: string | null;
}

/** Regeln 3–5 des Vertrags (oben). */
export function antwortFrische(
  antwort: StehendeAntwort,
  bestand: readonly QuellenBestandEintrag[] | undefined,
): AntwortFrische {
  if (!bestand) {
    return "ungeprueft";
  }
  const nachId = new Map(bestand.map((ko) => [ko.id, ko]));
  const { stand } = antwort;
  if (stand) {
    for (const [id, fassung] of Object.entries(stand)) {
      const ko = nachId.get(id);
      if (!ko || ko.mergedInto || ko.version > fassung) {
        return "ueberholt";
      }
    }
    return "aktuell";
  }
  if (antwort.quellen.length === 0) {
    // Ohne Quelle gibt es nichts, das sich ändern könnte — wie bisher mit Zeitpunkt.
    return "ungeprueft";
  }
  const am = antwort.am === null ? Number.NaN : Date.parse(antwort.am);
  for (const id of antwort.quellen) {
    const ko = nachId.get(id);
    const gesehen = antwort.beobachtet?.[id];
    if (!ko) {
      // Fehlte die Quelle der Fläche schon beim Eintreffen, belegt ihr Fehlen jetzt keine Änderung
      // NACH der Antwort. Ohne Beobachtung (Altbestand) ist Fehlen dagegen der sichere Grund.
      if (antwort.beobachtet && gesehen === undefined) {
        continue;
      }
      return "ueberholt";
    }
    if (ko.mergedInto) {
      return "ueberholt";
    }
    if (gesehen !== undefined ? ko.version > gesehen : seitherGeaendert(ko, am)) {
      return "ueberholt";
    }
  }
  return "ungeprueft";
}

/** Regel 4: hat sich die Quelle nach `am` geändert — oder lässt sich das nicht ausschliessen? */
function seitherGeaendert(ko: QuellenBestandEintrag, am: number): boolean {
  if (Number.isNaN(am)) {
    return true;
  }
  const verlauf = ko.history ?? [];
  if (verlauf.length === 0) {
    // Ohne Verlauf ist nur die Erstfassung sicher unverändert.
    return ko.version > 1;
  }
  return verlauf.some((eintrag) => {
    const zeit = Date.parse(eintrag.at);
    return Number.isNaN(zeit) || zeit > am;
  });
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
