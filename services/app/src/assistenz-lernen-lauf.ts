// ================================================================================================
// produkt:20261011:assistenz-lernen-hostfortsetzung · BPA-06 — DER EINE LAUFWEG EINER ROUTINE.
// ================================================================================================
//
// Ein Lauf einer bestätigten P06-Routine — von Hand (`POST …/routinen/:id/lauf`) oder fällig aus der
// Zeitsteuerung (`assistenz-lernen-zeitsteuerung.ts`) — geht durch GENAU diesen Weg:
//   `planeLauf` (Zustand, Fassung, Eingaben, Schreibrecht, Halt) → Brücke → gebundener Klara-Auftrag
//   im Gespräch der Person, genau EINER je Laufkennung (`VormachenDienst.einmalJeLauf`).
// Ausgeführt wird der Auftrag danach über den vorhandenen Aktionskern. Kein zweiter Ausführungsweg.
import { createHash } from "node:crypto";
import {
  type Ausfuehrungsmodus,
  type LaufAnfrage,
  type LaufPlan,
  planeLauf,
} from "./assistenz-lernen";
import { alsKlaraAuftrag } from "./assistenz-lernen-auftrag";
import {
  KLARWERK_WEB_FASSUNG,
  KLARWERK_WEB_ZIELE,
  MANDANT_DIESER_INSTANZ,
  ZIEL_ERFASSUNG,
  funktionAusRoutine,
} from "./assistenz-lernen-p06";
import { WORD_AUSWAHL, WORD_DOKUMENT, WORD_MARKIERUNG, WORD_ZIELE } from "./assistenz-lernen-word";
import type { KlaraAuftragEingabe, KlaraAuftragHerkunft } from "./klara-auftrag";
import type { KlaraGespraechDienst } from "./klara-gespraech";
import type { Routine, VormachenDienst } from "./vormachen";

/** Ein Lauf, den `planeLauf` oder die Brücke nicht freigibt — nichts wird angelegt. */
export class LaufAbgelehnt extends Error {
  constructor(
    readonly status: 403 | 409,
    readonly grund: string,
    message: string,
    readonly plan?: LaufPlan,
  ) {
    super(message);
  }
}

/** Was einen Lauf ausmacht: Routine, Fassung, Gespräch und die Eingaben (Reihenfolge egal). */
export function laufAbdruck(
  routineId: string,
  fassung: number,
  gespraech: string,
  eingaben: Record<string, string>,
  /**
   * EQF-06-K06: die Übergabeart gehört zum Lauf — dieselbe Kennung mit anderer Art ist ein
   * Widerspruch. `selbststaendig` (die bisherige Art) ändert den Abdruck nicht.
   */
  ausfuehrung: Ausfuehrungsmodus = "selbststaendig",
): string {
  const sortiert = Object.entries(eingaben).sort(([a], [b]) => a.localeCompare(b));
  const art = ausfuehrung === "selbststaendig" ? {} : { ausfuehrung };
  const roh = JSON.stringify({ routineId, fassung, gespraech, eingaben: sortiert, ...art });
  return createHash("sha256").update(roh).digest("hex");
}

function gleicheHerkunft(a: KlaraAuftragHerkunft | undefined, b: KlaraAuftragHerkunft): boolean {
  return (
    a !== undefined &&
    a.art === b.art &&
    a.eigentuemer === b.eigentuemer &&
    a.routineId === b.routineId &&
    a.fassung === b.fassung &&
    a.lauf === b.lauf &&
    a.abdruck === b.abdruck
  );
}

/**
 * Nacharbeit 41: der Host eines Word-Laufs, wie ihn der Rand nach der Zielprüfung (BPA-04-Siegel,
 * `pruefeZielVorWirkung`, nachgerechnete Prüfsumme) übergibt.
 */
export interface WordLaufHost {
  readonly programm: string;
  readonly hostVersion: string;
  /** Prüfsumme der gebundenen Markierung und (Nacharbeit 43) des gebundenen Dokuments. */
  readonly auswahl: string;
  readonly dokumentFassung: string;
  /** Der Text genau dieser Markierung — nur, wenn die Routine eine Markierung übernimmt. */
  readonly markierung?: string;
  /** Der Text des ganzen Dokuments — nur, wenn die Routine das Dokument übernimmt. */
  readonly dokument?: string;
}

export interface RoutinenLaufAnfrage {
  readonly kontoId: string;
  /** Das AKTUELLE Anlagerecht der Person (Rolle jetzt, nicht beim Bestätigen). */
  readonly darfSchreiben: boolean;
  readonly routine: Routine;
  readonly gespraech: string;
  readonly lauf: string;
  readonly fassung: number;
  readonly eingaben: Record<string, string>;
  /** Nur bei Word-Routinen; ohne ihn läuft eine Word-Routine nicht. */
  readonly host?: WordLaufHost;
  /**
   * EQF-06-K06: `zeitplan`, wenn die Zeitsteuerung den Lauf anlegt. „Gemeinsam schrittweise“ läuft
   * dann nicht — es braucht die Person bei jedem Schritt.
   */
  readonly ausloeser?: "person" | "zeitplan";
}

/**
 * Die Eingaben des Laufs — bei Word mit Markierung und/oder Dokument, die allein der Host liefert
 * (eine gleichnamige Eingabe der Person wird verworfen).
 */
function laufEingaben(a: RoutinenLaufAnfrage): Record<string, string> {
  if (!a.host) {
    return a.eingaben;
  }
  const eigene = Object.fromEntries(
    Object.entries(a.eingaben).filter(([k]) => k !== WORD_MARKIERUNG && k !== WORD_DOKUMENT),
  );
  return {
    ...eigene,
    ...(a.host.markierung !== undefined ? { [WORD_MARKIERUNG]: a.host.markierung } : {}),
    ...(a.host.dokument !== undefined ? { [WORD_DOKUMENT]: a.host.dokument } : {}),
  };
}

export interface RoutinenLaufErgebnis {
  readonly auftragId: string;
  readonly gespraech: string;
  readonly wiederholt: boolean;
  /** Der geprüfte Plan — nur beim Anlegen, nicht bei einer Wiederholung. */
  readonly plan: LaufPlan | null;
}

/** Prüft den Lauf JETZT (`planeLauf`) und übersetzt ihn (Brücke); wirft `LaufAbgelehnt`. */
function pruefeUndUebersetze(a: RoutinenLaufAnfrage): {
  plan: LaufPlan;
  eingabe: KlaraAuftragEingabe;
} {
  const word = a.routine.host === "word";
  if (word && !a.host) {
    const message = "Diese Routine läuft in Word. Öffne Klara in Word und markiere den Text.";
    throw new LaufAbgelehnt(409, "host_fehlt", message);
  }
  if (!word && a.host) {
    throw new LaufAbgelehnt(409, "anderer_host", "Diese Routine läuft nicht in Word.");
  }
  const funktion = funktionAusRoutine(a.routine);
  if (!funktion && word) {
    const message = "Die Routine ist noch an kein Word gebunden. Erst binden, dann läuft sie.";
    throw new LaufAbgelehnt(409, "host_nicht_gebunden", message);
  }
  if (!funktion) {
    const message = "Diese Routine läuft nicht in Klarwerk, sondern über ihren Hostweg.";
    throw new LaufAbgelehnt(409, "anderer_host", message);
  }
  // EQF-06-K06: „gemeinsam schrittweise“ — kein Lauf ohne die Person (Zeitplan) und keiner, der am
  // Server in einem Zug durchläuft (Word-Hostlauf).
  if (funktion.ausfuehrung === "schrittweise" && (a.ausloeser === "zeitplan" || a.host)) {
    const message = "Gemeinsam schrittweise läuft nur mit dir, Schritt für Schritt in Klarwerk.";
    throw new LaufAbgelehnt(409, "schrittweise", message);
  }
  // Word (Nacharbeit 41): Host ist das gemeldete Programm mit seiner Hostfassung — ein anderes
  // Programm lehnt `planeLauf` ab, eine andere Fassung hält vor dem ersten Schritt (AC07). Objekt
  // ist die gebundene Markierung mit ihrer Prüfsumme als Fassung.
  let host: { kennung: string; hostVersion: string; ziele: LaufAnfrage["host"]["ziele"] } = {
    kennung: funktion.bindung.host,
    hostVersion: KLARWERK_WEB_FASSUNG,
    ziele: KLARWERK_WEB_ZIELE,
  };
  let objekt: { kennung: string; fassung: string } = ZIEL_ERFASSUNG;
  if (a.host) {
    host = { kennung: a.host.programm, hostVersion: a.host.hostVersion, ziele: WORD_ZIELE };
    // Fassung des Ziels: Prüfsummen von Markierung UND Dokument, wie sie gebunden wurden.
    objekt = { kennung: WORD_AUSWAHL, fassung: `${a.host.auswahl}|${a.host.dokumentFassung}` };
  }
  const anfrage: LaufAnfrage = {
    lauf: a.lauf,
    version: a.fassung,
    person: a.kontoId,
    mandant: MANDANT_DIESER_INSTANZ,
    sitzung: a.gespraech,
    eingaben: laufEingaben(a),
    host: { ...host, anwendung: funktion.bindung.anwendung },
    objekt,
    rechte: {
      objekt: objekt.kennung,
      fassung: objekt.fassung,
      beobachten: true,
      schreiben: a.darfSchreiben,
    },
    bestaetigungen: [],
  };
  const geplant = planeLauf(funktion, anfrage);
  if (geplant.stand === "abgelehnt") {
    const status = geplant.grund === "nur_beobachtung" ? 403 : 409;
    throw new LaufAbgelehnt(status, geplant.grund, geplant.text);
  }
  if (geplant.stand === "haelt_an") {
    const halt = geplant.schritte[geplant.schritte.length - 1];
    throw new LaufAbgelehnt(409, "haelt_an", halt?.grund ?? "", geplant);
  }
  const bruecke = alsKlaraAuftrag(funktion, geplant);
  if (!bruecke.ok) {
    throw new LaufAbgelehnt(409, bruecke.grund, bruecke.text);
  }
  return { plan: geplant, eingabe: bruecke.eingabe };
}

/** Prüft und legt den gebundenen Auftrag eines Laufs an (oder liefert den schon angelegten). */
export async function legeRoutinenLaufAn(
  deps: { vormachen: VormachenDienst; klara: KlaraGespraechDienst },
  a: RoutinenLaufAnfrage,
): Promise<RoutinenLaufErgebnis> {
  const { vormachen, klara } = deps;
  const { routine, kontoId, gespraech, lauf, fassung } = a;
  // Word: die Markierung gehört zum Abdruck — dieselbe Laufkennung mit anderer Markierung ist ein
  // Widerspruch, keine Wiederaufnahme (G12).
  const art = routine.ausfuehrung ?? "selbststaendig";
  const abdruck = laufAbdruck(routine.id, fassung, gespraech, laufEingaben(a), art);
  // Die strukturierte Herkunft des Auftrags — Grundlage für Wiederfinden und die Prüfung vor der
  // Wirkung im Aktionskern (`routineSperre`).
  const herkunft: KlaraAuftragHerkunft = {
    art: "routine",
    eigentuemer: kontoId,
    routineId: routine.id,
    fassung,
    lauf,
    abdruck,
  };
  let plan: LaufPlan | null = null;
  const erzeuge = async (): Promise<string> => {
    const geplant = pruefeUndUebersetze(a);
    plan = geplant.plan;
    const neu = await klara.legeAuftragAn(kontoId, gespraech, geplant.eingabe, herkunft);
    return neu.id;
  };

  // Ein früherer Versuch, dessen Eintrag fehlt: den schon angelegten Auftrag wiederfinden — nur über
  // die strukturierte Herkunft (Eigentümer, Routine, Fassung, Lauf, Abdruck).
  const finde = async (): Promise<string | null> => {
    const auftraege = await klara.auftraege(kontoId, gespraech);
    return auftraege.find((x) => gleicheHerkunft(x.herkunft, herkunft))?.id ?? null;
  };

  const ergebnis = await vormachen.einmalJeLauf(
    kontoId,
    routine.id,
    { kennung: lauf, fassung, abdruck, gespraech },
    { finde, erzeuge },
  );
  return { ...ergebnis, plan };
}

/**
 * Der geprüfte Plan eines schon angelegten Laufs, JETZT neu berechnet (Rechte, Pause, Fassung) —
 * für die Ergebnisprüfung einer Wiederholung. Wirft `LaufAbgelehnt` wie das Anlegen.
 */
export function planeRoutinenLauf(a: RoutinenLaufAnfrage): LaufPlan {
  return pruefeUndUebersetze(a).plan;
}
