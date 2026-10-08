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
import { type KnowledgeObject, ownershipOf, responsibleOf } from "../../knowledge-object";
import { can } from "../../rbac";
import type { SessionUser } from "./http";
import { darfSehen } from "./sichtbarkeit";
import { type SpaceFassung, lesbareSpaces } from "./spaces";

/** Wie viele Beiträge EIN Aufruf höchstens bewegt — ein Personalwechsel, kein Massenimport. */
export const UEBERGABE_HOECHSTZAHL = 1_000;

/**
 * Der Zugangsstand eines Kontos, so wie die Anmeldung ihn auslegt:
 *   · `aktiv`      — freigegeben und nicht abgelaufen,
 *   · `abgelaufen` — Befristung erreicht; das ist auch die DEAKTIVIERUNG dieses Auftrags
 *                    (Zugang sofort beenden, „Befristung beenden" öffnet ihn wieder),
 *   · `gesperrt`   — nicht (mehr) freigegeben,
 *   · `geloescht`  — die Kennung nennt kein Konto mehr.
 */
export type Zugangsstand = "aktiv" | "abgelaufen" | "gesperrt" | "geloescht";

/**
 * Ist dieser Ablaufwert erreicht? Ein unlesbarer Wert sperrt niemanden aus — dieselbe Nachsicht wie
 * `AuthService.zugangAbgelaufen`. Schreibend lässt `setAccessExpiry` ohnehin nur lesbare Werte herein.
 */
function abgelaufen(wert: string | undefined, jetzt: number): boolean {
  if (wert === undefined) {
    return false;
  }
  const zeitpunkt = Date.parse(wert);
  return !Number.isNaN(zeitpunkt) && zeitpunkt <= jetzt;
}

export function zugangsstand(konto: PublicUser | undefined, jetzt: number): Zugangsstand {
  if (!konto) {
    return "geloescht";
  }
  if (!konto.approved) {
    return "gesperrt";
  }
  return abgelaufen(konto.accessExpiresAt, jetzt) ? "abgelaufen" : "aktiv";
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
  | "ZIEL_OHNE_SCHREIBRECHT"
  | "ZIEL_SIEHT_BEITRAG_NICHT";

export const ABLEHNUNGSTEXT: Record<Ablehnung, string> = {
  NICHT_GEFUNDEN: "Den Beitrag gibt es nicht mehr.",
  NICHT_MEHR_BEI_PERSON:
    "Die Verantwortung liegt inzwischen bei jemand anderem — der Beitrag wurde nicht verändert.",
  ZIEL_IST_PERSON: "Nachfolger und bisherige Person sind dasselbe Konto.",
  ZIEL_UNBEKANNT: "Das gewählte Konto gibt es nicht.",
  ZIEL_NICHT_AKTIV: "Das gewählte Konto ist nicht aktiv (gesperrt oder abgelaufen).",
  ZIEL_OHNE_SCHREIBRECHT:
    "Das gewählte Konto darf kein Wissen bearbeiten und kann keine Verantwortung tragen.",
  ZIEL_SIEHT_BEITRAG_NICHT:
    "Das gewählte Konto darf diesen Beitrag nicht sehen. Eine Übergabe erweitert keine Rechte — erst Zugang klären (Space, Vertraulichkeit).",
};

export type Urteil =
  | { art: "bereit" }
  | { art: "erledigt" }
  | { art: "abgelehnt"; grund: Ablehnung };

/**
 * Das Urteil über EINE Zuteilung — für Vorschau und Ausführung dasselbe, jeweils neu gefällt.
 *
 * `erledigt` heisst: der Nachfolger IST schon verantwortlich. So wird eine Wiederholung nach einem
 * Teilfehler nie doppelt geschrieben und nie als Fehler gemeldet.
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
  const verantwortlich = responsibleOf(ko);
  if (verantwortlich === zielId) {
    return { art: "erledigt" };
  }
  if (verantwortlich !== von) {
    return { art: "abgelehnt", grund: "NICHT_MEHR_BEI_PERSON" };
  }
  if (!ziel) {
    return { art: "abgelehnt", grund: "ZIEL_UNBEKANNT" };
  }
  if (zugangsstand(ziel, jetzt) !== "aktiv") {
    return { art: "abgelehnt", grund: "ZIEL_NICHT_AKTIV" };
  }
  if (!can(ziel.role, "ko.create")) {
    return { art: "abgelehnt", grund: "ZIEL_OHNE_SCHREIBRECHT" };
  }
  if (!darfSehen(sitzungVon(ziel, spaces), ko)) {
    return { art: "abgelehnt", grund: "ZIEL_SIEHT_BEITRAG_NICHT" };
  }
  return { art: "bereit" };
}

/**
 * Die neue Verantwortungsangabe: derselbe Bestand, nur ein anderer `owner`. Prüfende und
 * Validierende (Mitwirkung) bleiben in ihrer Reihenfolge stehen.
 */
export function mitNeuemOwner(ko: KnowledgeObject, an: string) {
  const bisher = ownershipOf(ko);
  return {
    owner: an,
    reviewers: bisher?.reviewers ?? [],
    validators: bisher?.validators ?? [],
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
