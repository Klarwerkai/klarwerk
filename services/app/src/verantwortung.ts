// ================================================================================================
// HAUPTVERANTWORTUNG ÜBERGEBEN — EINZELN, GESAMMELT, AUF MEHRERE NACHFOLGER VERTEILT.
// ================================================================================================
//
// Auftrag `produkt:20261007:ownership-uebergabe`. Dieses Modul urteilt, die Routen
// (`routes/verantwortung-routes.ts`) lesen und schreiben.
//
// WAS „HAUPTVERANTWORTUNG" HIER IST — und was nicht. Es ist die bestehende Angabe
// `ownership.owner` am Wissensobjekt (`knowledge-object/src/ownership.ts`, JOB 557); fehlt sie,
// trägt der Autor die Verantwortung (`responsibleOf`). Eine Übergabe setzt AUSSCHLIESSLICH
// `ownership.owner`. Unberührt bleiben, jeweils getrennt erkennbar:
//   · Autorschaft          — `author` und `originalAuthor` (die bestehende Autorenübergabe
//                            `transfer-author`, FR-LIF-02, bleibt ein eigener Weg),
//   · Mitwirkung           — `ownership.reviewers` / `ownership.validators`,
//   · Freigabe             — `status`, `validationDecisionRef`, Fassung und `history`.
//
// WARUM DAS KEINE RECHTE ERWEITERT. `ownership.owner` verleiht kein Recht (ownership.ts: „KEINE
// RECHTEVERGABE"); gesehen wird ein Objekt allein nach `darfSehen` (Stufe, Autor, führender Space).
// Damit niemand für einen Beitrag verantwortlich wird, den er nicht lesen darf, ist ein Nachfolger
// für einen Beitrag nur wählbar, wenn er ihn HEUTE schon sieht — die Übergabe öffnet nichts.
//
// WER NACHFOLGEN DARF: ein AKTIVES Konto (freigegeben, Zugang nicht abgelaufen) mit dem Recht,
// Wissen zu erstellen (`ko.create`: Experte, Controller, Admin). Ein Betrachter kann keine
// Nacharbeit leisten und wäre ein Verantwortlicher, der nichts ändern darf.
import type { PublicUser } from "../../auth";
import { type KnowledgeObject, responsibleOf } from "../../knowledge-object";
import { can } from "../../rbac";
import type { SessionUser } from "./http";
import { darfSehen } from "./sichtbarkeit";
import { type SpaceFassung, lesbareSpaces } from "./spaces";
import type { NachfolgeRepo } from "./verantwortung-nachfolge";

/** Wie viele Beiträge EIN Aufruf höchstens bewegt — ein Personalwechsel, kein Massenimport. */
export const UEBERGABE_HOECHSTZAHL = 1_000;

/**
 * Der Zugangsstand eines Kontos, so wie die Anmeldung ihn auslegt:
 *   · `aktiv`      — freigegeben, ohne Ende,
 *   · `befristet`  — freigegeben, der Zugang endet aber zu einem festgesetzten Zeitpunkt,
 *   · `abgelaufen` — Befristung erreicht; das ist auch die DEAKTIVIERUNG dieses Auftrags
 *                    (Zugang sofort beenden, „Befristung beenden" öffnet ihn wieder),
 *   · `gesperrt`   — nicht (mehr) freigegeben,
 *   · `geloescht`  — die Kennung nennt kein Konto mehr.
 *
 * WARUM `befristet` NICHT `aktiv` IST (Nacharbeit 2, Ben K5): ein befristeter Zugang endet ohne
 * weiteres Zutun. Trüge ein solches Konto Hauptverantwortung, läge der Beitrag nach dem Fristablauf
 * bei einer inaktiven Person. Deshalb ist es kein zulässiger Nachfolger, eigener Bestand eines
 * befristeten Kontos gilt schon VOR dem Ablauf als zu klären (`…/ungeklaert`), und eine Befristung
 * lässt sich nur setzen, wenn das Konto keinen Bestand mehr trägt (`kontoendeSperre`).
 */
export type Zugangsstand = "aktiv" | "befristet" | "abgelaufen" | "gesperrt" | "geloescht";

/**
 * Der Ablaufzeitpunkt — oder `undefined`, wenn der Zugang nie endet. Ein unlesbarer Wert sperrt
 * niemanden aus — dieselbe Nachsicht wie `AuthService.zugangAbgelaufen`. Schreibend lässt
 * `setAccessExpiry` ohnehin nur lesbare Werte herein.
 */
function ablauf(wert: string | undefined): number | undefined {
  if (wert === undefined) {
    return undefined;
  }
  const zeitpunkt = Date.parse(wert);
  return Number.isNaN(zeitpunkt) ? undefined : zeitpunkt;
}

export function zugangsstand(konto: PublicUser | undefined, jetzt: number): Zugangsstand {
  if (!konto) {
    return "geloescht";
  }
  if (!konto.approved) {
    return "gesperrt";
  }
  const ende = ablauf(konto.accessExpiresAt);
  if (ende === undefined) {
    return "aktiv";
  }
  return ende <= jetzt ? "abgelaufen" : "befristet";
}

/** Die Sicht eines beliebigen Kontos — so, wie `makeGuards` sie für dessen Anfrage bilden würde. */
export function sitzungVon(konto: PublicUser, spaces: readonly SpaceFassung[]): SessionUser {
  return { id: konto.id, role: konto.role, spaceLesbar: lesbareSpaces(spaces, konto.id) };
}

/** Darf dieses Konto überhaupt Hauptverantwortung tragen (unabhängig vom einzelnen Beitrag)? */
export function kannVerantworten(konto: PublicUser | undefined, jetzt: number): boolean {
  return (
    konto !== undefined && zugangsstand(konto, jetzt) === "aktiv" && can(konto.role, "ko.create")
  );
}

/** Eine gewünschte Zuordnung: dieser Beitrag geht an dieses Konto. */
export interface Zuteilung {
  koId: string;
  an: string;
}

export type Ablehnung =
  | "NICHT_GEFUNDEN"
  | "NICHT_MEHR_BEI_PERSON"
  | "ZIEL_IST_PERSON"
  | "ZIEL_UNBEKANNT"
  | "ZIEL_NICHT_AKTIV"
  | "ZIEL_BEFRISTET"
  | "ZIEL_OHNE_SCHREIBRECHT"
  | "ZIEL_SIEHT_BEITRAG_NICHT"
  | "ZIEL_OHNE_PRUEFRECHT";

export const ABLEHNUNGSTEXT: Record<Ablehnung, string> = {
  NICHT_GEFUNDEN: "Den Beitrag gibt es nicht mehr.",
  NICHT_MEHR_BEI_PERSON:
    "Die Verantwortung liegt inzwischen bei jemand anderem — der Beitrag wurde nicht verändert.",
  ZIEL_IST_PERSON: "Nachfolger und bisherige Person sind dasselbe Konto.",
  ZIEL_UNBEKANNT: "Das gewählte Konto gibt es nicht.",
  ZIEL_NICHT_AKTIV: "Das gewählte Konto ist nicht aktiv (gesperrt oder abgelaufen).",
  ZIEL_BEFRISTET:
    "Der Zugang des gewählten Kontos ist befristet und endet von selbst — es kann keine Hauptverantwortung übernehmen.",
  ZIEL_OHNE_SCHREIBRECHT:
    "Das gewählte Konto darf kein Wissen bearbeiten und kann keine Verantwortung tragen.",
  ZIEL_SIEHT_BEITRAG_NICHT:
    "Das gewählte Konto darf diesen Beitrag nicht sehen. Eine Übergabe erweitert keine Rechte — erst Zugang klären (Space, Vertraulichkeit).",
  ZIEL_OHNE_PRUEFRECHT:
    "Das gewählte Konto darf nicht prüfen (Rolle Controller oder Admin nötig). Eine Übergabe vergibt keine Rolle.",
};

/**
 * ADMIN-05: darf dieses Konto DIESEN offenen Vorgang übernehmen? Dieselbe Grundregel wie für
 * Beiträge (aktiv, unbefristet, nicht die Person selbst) und je Art das Recht, das die Arbeit
 * verlangt — die Übergabe vergibt es nicht nachträglich:
 *   · Entwurf, Lücke ... Wissen anlegen (`ko.create`), denn beides endet in einem Beitrag;
 *   · Prüfaufgabe ...... prüfen (`ko.validate`) UND das Objekt heute schon lesen (`darfSehen`).
 * Was die Übergabe dem Ziel SICHTBAR neu gibt, nennt die Vorschau als Rechtewirkung: einen privaten
 * Entwurf darf danach das Ziel lesen und bearbeiten — und nur diesen.
 */
export function vorgangZielGrund(
  art: "entwurf" | "luecke" | "pruefaufgabe",
  ziel: PublicUser | undefined,
  ko: KnowledgeObject | undefined,
  spaces: readonly SpaceFassung[],
  jetzt: number,
): Ablehnung | null {
  if (!ziel) {
    return "ZIEL_UNBEKANNT";
  }
  const zugang = zugangsstand(ziel, jetzt);
  if (zugang === "befristet") {
    return "ZIEL_BEFRISTET";
  }
  if (zugang !== "aktiv") {
    return "ZIEL_NICHT_AKTIV";
  }
  if (art !== "pruefaufgabe") {
    return can(ziel.role, "ko.create") ? null : "ZIEL_OHNE_SCHREIBRECHT";
  }
  if (!can(ziel.role, "ko.validate")) {
    return "ZIEL_OHNE_PRUEFRECHT";
  }
  if (!ko) {
    return "NICHT_GEFUNDEN";
  }
  return darfSehen(sitzungVon(ziel, spaces), ko) ? null : "ZIEL_SIEHT_BEITRAG_NICHT";
}

export type Urteil =
  | { art: "bereit" }
  | { art: "erledigt" }
  | { art: "abgelehnt"; grund: Ablehnung };

/**
 * Darf dieses Konto die Hauptverantwortung für DIESEN Beitrag tragen? `null` heisst ja, sonst der
 * Grund. Dieselbe Frage stellen Bestand (Auswahlliste je Beitrag), Vorschau und Ausführung.
 */
export function zielGrund(
  ko: KnowledgeObject,
  ziel: PublicUser | undefined,
  spaces: readonly SpaceFassung[],
  jetzt: number,
): Ablehnung | null {
  if (!ziel) {
    return "ZIEL_UNBEKANNT";
  }
  const zugang = zugangsstand(ziel, jetzt);
  if (zugang === "befristet") {
    return "ZIEL_BEFRISTET";
  }
  if (zugang !== "aktiv") {
    return "ZIEL_NICHT_AKTIV";
  }
  if (!can(ziel.role, "ko.create")) {
    return "ZIEL_OHNE_SCHREIBRECHT";
  }
  if (!darfSehen(sitzungVon(ziel, spaces), ko)) {
    return "ZIEL_SIEHT_BEITRAG_NICHT";
  }
  return null;
}

/** Die Konten, die für diesen Beitrag als Nachfolger zulässig sind — ohne die bisherige Person. */
export function zulaessigeZiele(
  ko: KnowledgeObject,
  von: string,
  konten: readonly PublicUser[],
  spaces: readonly SpaceFassung[],
  jetzt: number,
): string[] {
  return konten
    .filter((k) => k.id !== von && zielGrund(ko, k, spaces, jetzt) === null)
    .map((k) => k.id);
}

/**
 * Das Urteil über EINE Zuteilung — für Vorschau und Ausführung dasselbe, jeweils neu gefällt.
 *
 * `erledigt` heisst: der Nachfolger IST schon verantwortlich UND darf es heute noch sein. So wird
 * eine Wiederholung nach einem Teilfehler nie doppelt geschrieben und nie als Fehler gemeldet.
 *
 * Nacharbeit 2 (Ben): die Zielprüfung steht VOR „erledigt". Ist ein schon eingetragener Nachfolger
 * inzwischen abgelaufen, gesperrt, befristet oder ohne Leserecht, ist die Zeile nicht erledigt,
 * sondern abgelehnt — die Übergabe meldet sich unvollständig, und der Beitrag erscheint als
 * ungeklärter Bestand dieses Nachfolgers, der neu zugeteilt werden muss. Geschrieben wird dabei
 * nichts, also auch nichts doppelt.
 */
export function beurteile(
  ko: KnowledgeObject | undefined,
  von: string,
  ziel: PublicUser | undefined,
  zielId: string,
  spaces: readonly SpaceFassung[],
  jetzt: number,
): Urteil {
  if (!ko) {
    return { art: "abgelehnt", grund: "NICHT_GEFUNDEN" };
  }
  if (zielId === von) {
    return { art: "abgelehnt", grund: "ZIEL_IST_PERSON" };
  }
  const grund = zielGrund(ko, ziel, spaces, jetzt);
  if (grund !== null) {
    return { art: "abgelehnt", grund };
  }
  const verantwortlich = responsibleOf(ko);
  if (verantwortlich === zielId) {
    return { art: "erledigt" };
  }
  if (verantwortlich !== von) {
    return { art: "abgelehnt", grund: "NICHT_MEHR_BEI_PERSON" };
  }
  return { art: "bereit" };
}

/** Ein befristetes Konto mit Bearbeitungsrecht hat keine (zulässige) Nachfolge — es entsteht nichts. */
export class NachfolgeFehlt extends Error {
  readonly code = "NACHFOLGE_FEHLT";
  constructor() {
    super(
      "Dieser Zugang ist befristet, und für neue Beiträge ist keine aktive Nachfolge benannt. Es wurde nichts angelegt — die Kontoverwaltung muss die Befristung mit einer Nachfolge speichern.",
    );
    this.name = "NachfolgeFehlt";
  }
}

/**
 * Nacharbeit 6 (Ben): die Nachfolge ist aktiv, darf aber DIESEN Beitrag nicht lesen (Vertraulichkeit
 * oder Space). Eine Übergabe erweitert keine Rechte — also entsteht der Beitrag so nicht, und der
 * Klärungsbedarf wird benannt.
 */
export class NachfolgeSiehtBeitragNicht extends Error {
  readonly code = "NACHFOLGE_SIEHT_BEITRAG_NICHT";
  constructor() {
    super(
      "Dieser Zugang ist befristet, und die benannte Nachfolge darf diesen Beitrag (Vertraulichkeit oder Space) nicht lesen. Es wurde nichts angelegt — bitte eine andere Stufe oder einen anderen Space wählen oder die Kontoverwaltung eine Nachfolge mit Zugang benennen lassen. Zugriffsrechte wurden nicht verändert.",
    );
    this.name = "NachfolgeSiehtBeitragNicht";
  }
}

/**
 * Nacharbeit 4/6 (Ben K5): wer die Hauptverantwortung für einen NEUEN Beitrag trägt.
 *
 * `undefined` heisst: der Autor selbst (unbefristet aktiv, oder kein Konto — Import/Seed). Ist der
 * Autor befristet und darf Wissen anlegen, trägt die benannte Nachfolge die Verantwortung ab der
 * Anlage — über das Kontoende hinaus. Geprüft wird sie mit DERSELBEN Regel wie jede reguläre
 * Übergabe (`zielGrund`): aktiv, unbefristet, Bearbeitungsrecht UND Leserecht an genau diesem
 * Beitrag (Vertraulichkeit, Space — `darfSehen`). Ist sie nicht zulässig, entsteht der Beitrag
 * nicht, und der Grund wird benannt; Rechte werden dabei nicht erweitert.
 */
export function verantwortungBeiAnlage(
  konto: (id: string) => Promise<PublicUser | undefined>,
  nachfolge: NachfolgeRepo,
  spaces: () => Promise<readonly SpaceFassung[]>,
  jetzt: () => number,
): (ko: KnowledgeObject) => Promise<string | undefined> {
  return async (ko) => {
    const zeit = jetzt();
    const autor = await konto(ko.author);
    if (!autor || zugangsstand(autor, zeit) !== "befristet" || !can(autor.role, "ko.create")) {
      return undefined;
    }
    const eintrag = await nachfolge.lies(ko.author);
    const ziel = eintrag ? await konto(eintrag.nachfolger) : undefined;
    if (!ziel || ziel.id === ko.author) {
      throw new NachfolgeFehlt();
    }
    const grund = zielGrund(ko, ziel, await spaces(), zeit);
    if (grund === "ZIEL_SIEHT_BEITRAG_NICHT") {
      throw new NachfolgeSiehtBeitragNicht();
    }
    if (grund !== null) {
      throw new NachfolgeFehlt();
    }
    return ziel.id;
  };
}

export class ZuteilungsFehler extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZuteilungsFehler";
  }
}

function kennung(wert: unknown): string | null {
  return typeof wert === "string" && wert.trim().length > 0 ? wert.trim() : null;
}

/** Die Person, um deren Bestand es geht — Pflichtangabe jedes Aufrufs. */
export function pruefePerson(roh: unknown): string {
  const id = kennung(roh);
  if (id === null) {
    throw new ZuteilungsFehler("Die bisherige Person (von) fehlt.");
  }
  return id;
}

/**
 * Prüft die Form einer Zuteilungsliste. Ein Beitrag darf nur EINEM Nachfolger zugeteilt sein —
 * zwei verschiedene Ziele für denselben Beitrag wären ein Widerspruch, den niemand still auflösen
 * darf. Eine wörtlich doppelte Zeile wird zusammengefasst.
 */
export function pruefeZuteilungen(roh: unknown): Zuteilung[] {
  if (!Array.isArray(roh) || roh.length === 0) {
    throw new ZuteilungsFehler("Es ist kein Beitrag zugeteilt.");
  }
  if (roh.length > UEBERGABE_HOECHSTZAHL) {
    throw new ZuteilungsFehler(
      `Höchstens ${UEBERGABE_HOECHSTZAHL} Beiträge je Übergabe — bitte in Pakete teilen.`,
    );
  }
  const raus = new Map<string, string>();
  for (const eintrag of roh) {
    const e = (typeof eintrag === "object" && eintrag !== null ? eintrag : {}) as Record<
      string,
      unknown
    >;
    const koId = kennung(e.koId);
    const an = kennung(e.an);
    if (koId === null || an === null) {
      throw new ZuteilungsFehler("Jede Zuteilung braucht koId und an.");
    }
    const vorhanden = raus.get(koId);
    if (vorhanden !== undefined && vorhanden !== an) {
      throw new ZuteilungsFehler("Ein Beitrag ist zwei verschiedenen Nachfolgern zugeteilt.");
    }
    raus.set(koId, an);
  }
  return [...raus].map(([koId, an]) => ({ koId, an }));
}
