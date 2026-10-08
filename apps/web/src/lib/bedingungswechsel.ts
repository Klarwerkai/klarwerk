// ================================================================================================
// R-1628 (aufnahme:20260922:gesamt-was-waere-wenn) — WAS WÄRE, WENN SICH EINE BEDINGUNG ÄNDERT?
// ================================================================================================
//
// Wortlaut der Quelle: „Wenn ich statt 5083-H111 jetzt 6082-T6 verwende — welche bestehenden
// Erfahrungswerte gelten dann noch, welche nicht? KLARWERK markiert, welche Wissensobjekte
// materialspezifisch sind und welche übertragbar sind."
//
// DIE REGEL IN EINEM SATZ: Ein Wissensobjekt wird danach eingeordnet, ob es die bisherige und/oder
// die neue Bedingung SELBST nennt — in seinen Bedingungen, im Titel, in der Aussage oder in einem
// Schlagwort. Die Fundstelle reist mit, damit ein Mensch sie lesen kann.
//
//   · `beide`      — nennt beide: für beide festgehalten (übertragbar, und zwar belegt);
//   · `nur_neu`    — nennt nur die neue: für sie schon festgehalten;
//   · `nur_bisher` — nennt nur die bisherige: an sie gebunden, für die neue NICHT belegt
//                    (das ist „materialspezifisch" der Quelle);
//   · `keine`      — nennt keine von beiden: ob es unter der neuen Bedingung gilt, hält der Bestand
//                    nicht fest. Das ist ausdrücklich KEIN „übertragbar".
//
// WAS AUSDRÜCKLICH NICHT GESCHIEHT: keine KI, keine Vermutung, keine Ähnlichkeit. Die Empfehlung
// ES-092 verwarf spekulative KI-Antworten, weil sie dem Kernversprechen „belegte Antwort mit
// Quelle" widersprechen; EC-20260905-R-1628 hielt belegte Szenarien mit sichtbaren Annahmen
// dagegen für zulässig. Gebaut ist genau das Zweite: die Annahme ist der eingegebene Wechsel, der Beleg die
// Fundstelle im Objekt. Ein Treffer ist eine Textstelle, keine fachliche Bewertung — steht dort
// „nicht für 5083-H111", ordnet die Regel trotzdem `nur_bisher` ein; die Fundstelle zeigt es.
//
// Verglichen wird mit dem, was die Fläche schon geladen hat (`GET /api/kos`, serverseitig nach
// Sichtbarkeit gefiltert) — kein neuer Lesweg, keine neue Freigabe.
import type { KnowledgeObject } from "../api/types";

export type BedingungsLage = "beide" | "nur_neu" | "nur_bisher" | "keine";

/**
 * Die Reihenfolge der Gruppen auf der Fläche: zuerst, was an die bisherige Bedingung gebunden ist
 * (die Frage der Quelle: „welche nicht?"), dann das Belegte, zuletzt das Offene.
 */
export const BEDINGUNGS_LAGEN: readonly BedingungsLage[] = [
  "nur_bisher",
  "beide",
  "nur_neu",
  "keine",
];

/** Wo im Objekt die Bedingung genannt ist — in dieser Reihenfolge wird gesucht. */
export type Fundort = "bedingung" | "titel" | "aussage" | "schlagwort";

export interface Fundstelle {
  fundort: Fundort;
  /** Der Wortlaut des Feldes, bei langen Feldern ein Ausschnitt um den Treffer. */
  text: string;
}

export interface BedingungsEinordnung {
  id: string;
  titel: string;
  lage: BedingungsLage;
  bisher: Fundstelle | null;
  neu: Fundstelle | null;
}

export interface Bedingungsvergleich {
  bisher: string;
  neu: string;
  /** Leer = ohne Themeneingrenzung. */
  thema: string;
  gruppen: Record<BedingungsLage, BedingungsEinordnung[]>;
  /**
   * Ohne Thema werden Objekte, die keine der beiden Bedingungen nennen, nur GEZÄHLT — sonst stünde
   * der halbe Bestand in der Liste. Mit Thema stehen sie einzeln in `gruppen.keine`.
   */
  ohneNennungAnzahl: number;
}

export type BedingungsvergleichErgebnis =
  | { ok: true; vergleich: Bedingungsvergleich }
  | { ok: false; grund: "unvollstaendig" | "gleich" };

/** Höchstlänge je Eingabe — dieselbe wie die Geltungsangaben (`GELTUNG_TEXT_MAX`). */
export const BEDINGUNG_TEXT_MAX = 80;

/** Länge eines Ausschnitts um den Treffer, wenn das Feld länger ist. */
const AUSSCHNITT = 160;

function normal(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function klein(text: string): string {
  return normal(text).toLocaleLowerCase("de");
}

const WORTZEICHEN = /[\p{L}\p{N}]/u;

/**
 * Steht `begriff` als eigenes Wort im Text? Gross-/Kleinschreibung und Leerraum zählen nicht;
 * davor und dahinter darf kein Buchstabe und keine Ziffer stehen („5083" trifft nicht „50830").
 * Gibt die Position im normalisierten Text zurück, sonst -1.
 */
function position(text: string, begriff: string): number {
  const heu = klein(text);
  let i = heu.indexOf(begriff);
  while (i >= 0) {
    const davor = i > 0 ? heu.charAt(i - 1) : "";
    const danach = heu.charAt(i + begriff.length);
    if (!WORTZEICHEN.test(davor) && !WORTZEICHEN.test(danach)) {
      return i;
    }
    i = heu.indexOf(begriff, i + 1);
  }
  return -1;
}

function ausschnitt(text: string, i: number, laenge: number): string {
  const t = normal(text);
  if (t.length <= AUSSCHNITT) {
    return t;
  }
  const rand = Math.max(0, Math.floor((AUSSCHNITT - laenge) / 2));
  const von = Math.max(0, i - rand);
  const bis = Math.min(t.length, von + AUSSCHNITT);
  return `${von > 0 ? "…" : ""}${t.slice(von, bis)}${bis < t.length ? "…" : ""}`;
}

function felder(ko: KnowledgeObject): [Fundort, string][] {
  return [
    ...(ko.conditions ?? []).map((c): [Fundort, string] => ["bedingung", c]),
    ["titel", ko.title ?? ""],
    ["aussage", ko.statement ?? ""],
    ...(ko.tags ?? []).map((s): [Fundort, string] => ["schlagwort", s]),
  ];
}

/** Die erste Fundstelle im Objekt — Bedingungen zuerst, dann Titel, Aussage, Schlagwort. */
export function fundstelle(ko: KnowledgeObject, begriff: string): Fundstelle | null {
  const b = klein(begriff);
  if (b.length === 0) {
    return null;
  }
  for (const [fundort, text] of felder(ko)) {
    const i = position(text, b);
    if (i >= 0) {
      return { fundort, text: ausschnitt(text, i, b.length) };
    }
  }
  return null;
}

/** Gehört das Objekt zum Thema? Teilwort genügt („Schweiß" trifft „Schweißnaht"). */
function zumThema(ko: KnowledgeObject, thema: string): boolean {
  const t = klein(thema);
  const texte: unknown[] = [ko.title, ko.statement, ko.category, ...(ko.conditions ?? [])];
  texte.push(...(ko.tags ?? []));
  return texte.some((feld) => typeof feld === "string" && klein(feld).includes(t));
}

function lageVon(bisher: Fundstelle | null, neu: Fundstelle | null): BedingungsLage {
  if (bisher && neu) {
    return "beide";
  }
  if (neu) {
    return "nur_neu";
  }
  return bisher ? "nur_bisher" : "keine";
}

/**
 * Ordnet den Bestand für den Wechsel „statt `bisher` jetzt `neu`" ein. Fehlt eine der beiden
 * Bedingungen oder sind beide gleich, gibt es nichts zu vergleichen — dann wird nichts geraten.
 */
export function vergleicheBedingungen(
  kos: readonly KnowledgeObject[],
  eingabe: { bisher: string; neu: string; thema?: string },
): BedingungsvergleichErgebnis {
  const bisher = normal(eingabe.bisher).slice(0, BEDINGUNG_TEXT_MAX);
  const neu = normal(eingabe.neu).slice(0, BEDINGUNG_TEXT_MAX);
  const thema = normal(eingabe.thema ?? "").slice(0, BEDINGUNG_TEXT_MAX);
  if (bisher.length === 0 || neu.length === 0) {
    return { ok: false, grund: "unvollstaendig" };
  }
  if (klein(bisher) === klein(neu)) {
    return { ok: false, grund: "gleich" };
  }
  const gruppen: Record<BedingungsLage, BedingungsEinordnung[]> = {
    nur_bisher: [],
    beide: [],
    nur_neu: [],
    keine: [],
  };
  let ohneNennungAnzahl = 0;
  for (const ko of kos) {
    if (thema && !zumThema(ko, thema)) {
      continue;
    }
    const fundBisher = fundstelle(ko, bisher);
    const fundNeu = fundstelle(ko, neu);
    const lage = lageVon(fundBisher, fundNeu);
    if (lage === "keine") {
      ohneNennungAnzahl += 1;
      if (!thema) {
        continue;
      }
    }
    gruppen[lage].push({ id: ko.id, titel: ko.title, lage, bisher: fundBisher, neu: fundNeu });
  }
  for (const lage of BEDINGUNGS_LAGEN) {
    gruppen[lage].sort((a, b) => a.titel.localeCompare(b.titel, "de") || a.id.localeCompare(b.id));
  }
  return { ok: true, vergleich: { bisher, neu, thema, gruppen, ohneNennungAnzahl } };
}

/** Die Bedingungen, die der Bestand schon führt — Vorschläge für die Eingabe, keine Vorgabe. */
export function bedingungsVorschlaege(kos: readonly KnowledgeObject[]): string[] {
  const gesehen = new Map<string, string>();
  for (const ko of kos) {
    for (const c of ko.conditions ?? []) {
      const t = normal(c);
      if (t.length > 0 && t.length <= BEDINGUNG_TEXT_MAX && !gesehen.has(klein(t))) {
        gesehen.set(klein(t), t);
      }
    }
  }
  return [...gesehen.values()].sort((a, b) => a.localeCompare(b, "de"));
}
