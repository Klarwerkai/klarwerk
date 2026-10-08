// ================================================================================================
// R-1107 / R-0201 / R-0565 (Aufnahme gesamt-dublettenvergleich) — DER ASSISTENT, OHNE DOM.
// ================================================================================================
//
// Die reine Logik des Zusammenführen-Assistenten (`pages/DuplicateMerge.tsx`): wer führt, was je
// Feld übereinstimmt oder abweicht, welche Auswahl am Anfang steht, wie die Vorschau aussieht und
// welcher Auftrag nach der Freigabe an den Server geht. Die Ansicht wählt und benennt nichts selbst.
//
// DIE ZUSAGEN, an genau dieser Stelle:
//   · Nichts Neues entsteht: jede Vorschauposition stammt wörtlich aus einer der beiden Seiten.
//   · Nichts geht verloren: die Quellen des Führungsartikels bleiben immer; was nicht übernommen
//     wird, nennt die Vorschau ausdrücklich — es bleibt im aufgegangenen Artikel lesbar.
//   · Kein Ein-Klick: der Auftrag trägt `bestaetigt: true` erst, wenn die Ansicht ihn nach der
//     Vorschau baut; vorher gibt es ihn gar nicht.
//   · Kuratorisch (R-0565): wer an einer Seite Autor ist, bekommt den Assistenten gesperrt — die
//     Fläche sagt warum. Die verbindliche Entscheidung fällt am Server (403), nicht hier.
import type {
  KnowledgeObject,
  KoSource,
  OverlapEntry,
  ZusammenfuehrungsAuftrag,
  ZusammenfuehrungsSeite,
} from "../api/types";
import type { Role } from "../app/navigation";
import { htmlToPlainText } from "./richText";

export type PaarSeite = "a" | "b";

/** Die vier Schritte des Assistenten (R-1107), in ihrer festen Reihenfolge. */
export const ASSISTENT_SCHRITTE = ["fuehrung", "inhalte", "quellen", "vorschau"] as const;
export type AssistentSchritt = (typeof ASSISTENT_SCHRITTE)[number];

// ------------------------------------------------------------------------------------------------
// Schritt 1 — wer führt, und warum gerade der.
// ------------------------------------------------------------------------------------------------

export interface FuehrungsVorschlag {
  seite: PaarSeite;
  /** i18n-Schlüssel des Satzes, der das Kriterium nennt — der Vorschlag ist erklärt, nicht gesetzt. */
  grundKey: string;
}

/**
 * Der Vorschlag für den Führungsartikel: der geprüfte vor dem ungeprüften; sonst der umfassendere,
 * wenn die Erkennung „A enthält B" bzw. „B enthält A" festgestellt hat; sonst der ältere. Der
 * Mensch kann ihn immer umdrehen.
 */
export function fuehrungsVorschlag(
  entry: Pick<OverlapEntry, "relation">,
  a: KnowledgeObject,
  b: KnowledgeObject,
): FuehrungsVorschlag {
  if (a.status === "validiert" && b.status !== "validiert") {
    return { seite: "a", grundKey: "dublettenvergleich.vorschlag.geprueft" };
  }
  if (b.status === "validiert" && a.status !== "validiert") {
    return { seite: "b", grundKey: "dublettenvergleich.vorschlag.geprueft" };
  }
  if (entry.relation === "a_enthaelt_b") {
    return { seite: "a", grundKey: "dublettenvergleich.vorschlag.umfassender" };
  }
  if (entry.relation === "b_enthaelt_a") {
    return { seite: "b", grundKey: "dublettenvergleich.vorschlag.umfassender" };
  }
  const zeitA = Date.parse(a.createdAt);
  const zeitB = Date.parse(b.createdAt);
  if (!Number.isNaN(zeitA) && !Number.isNaN(zeitB) && zeitB < zeitA) {
    return { seite: "b", grundKey: "dublettenvergleich.vorschlag.aelter" };
  }
  return { seite: "a", grundKey: "dublettenvergleich.vorschlag.aelter" };
}

/** Die beiden Artikel in der Rolle, die der Mensch gewählt hat. */
export function rollenVon(
  fuehrung: PaarSeite,
  a: KnowledgeObject,
  b: KnowledgeObject,
): { fuehrend: KnowledgeObject; aufgehend: KnowledgeObject } {
  return fuehrung === "a" ? { fuehrend: a, aufgehend: b } : { fuehrend: b, aufgehend: a };
}

// ------------------------------------------------------------------------------------------------
// Schritt 2 — je Feld sichtbar, was übereinstimmt, was abweicht und was nur eine Seite trägt.
// ------------------------------------------------------------------------------------------------

/**
 * Die Lage eines Feldes. Bewusst „abweichend" und nicht „widersprüchlich": ob zwei Formulierungen
 * einander fachlich widersprechen, sagt ein Textvergleich nicht — dafür gibt es die Konfliktfläche.
 * „nur eine Seite" ist die unsichere Lage: ob das Fehlen Absicht ist, weiss nur ein Mensch.
 */
export type FeldLage = "gleich" | "abweichend" | "nur_eine_seite" | "beide_leer";

function normal(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function feldLage(fuehrend: string, aufgehend: string): FeldLage {
  const f = normal(fuehrend);
  const g = normal(aufgehend);
  if (!f && !g) {
    return "beide_leer";
  }
  if (!f || !g) {
    return "nur_eine_seite";
  }
  return f === g ? "gleich" : "abweichend";
}

/**
 * Nacharbeit 2 (Ben, R-0201): die Lage des FLIESSTEXTS. Er reist mit der Kernaussage — wer die
 * Kernaussage einer Seite wählt, übernimmt auch deren Fliesstext (Serverregel `neueFassung`,
 * `services/app/src/dubletten-zusammenfuehrung.ts`). Verglichen wird der lesbare Text, nicht das
 * Markup: zwei gleichlautende Rümpfe mit anderer Auszeichnung „stimmen überein".
 */
export function fliesstextLage(
  fuehrend: string | null | undefined,
  aufgehend: string | null | undefined,
): FeldLage {
  return feldLage(htmlToPlainText(fuehrend ?? ""), htmlToPlainText(aufgehend ?? ""));
}

export type Positionsherkunft = "beide" | "fuehrend" | "aufgehend";

export interface Listenposition {
  text: string;
  herkunft: Positionsherkunft;
}

/** Bedingungen bzw. Massnahmen beider Seiten als eine Liste — Führungsartikel zuerst, ohne Dopplung. */
export function listenPositionen(fuehrend: string[], aufgehend: string[]): Listenposition[] {
  const f = fuehrend.map(normal).filter(Boolean);
  const g = aufgehend.map(normal).filter(Boolean);
  const inG = new Set(g);
  const inF = new Set(f);
  const positionen: Listenposition[] = [];
  const gesehen = new Set<string>();
  for (const text of [...f, ...g]) {
    if (gesehen.has(text)) {
      continue;
    }
    gesehen.add(text);
    positionen.push({
      text,
      herkunft: inF.has(text) && inG.has(text) ? "beide" : inF.has(text) ? "fuehrend" : "aufgehend",
    });
  }
  return positionen;
}

// ------------------------------------------------------------------------------------------------
// Die Auswahl, ihr Anfang und ihre Änderung.
// ------------------------------------------------------------------------------------------------

export interface ZusammenfuehrungsAuswahl {
  fuehrung: PaarSeite;
  titel: ZusammenfuehrungsSeite;
  kernaussage: ZusammenfuehrungsSeite;
  bedingungen: string[];
  massnahmen: string[];
  /** Kennungen der Quellen des aufgehenden Artikels, die mitgenommen werden. */
  quellen: string[];
}

/** Quellen des aufgehenden Artikels, die der Führungsartikel noch nicht trägt. */
export function mitnehmbareQuellen(
  fuehrend: KnowledgeObject,
  aufgehend: KnowledgeObject,
): KoSource[] {
  const vorhanden = new Set((fuehrend.sources ?? []).map((q) => q.id));
  return (aufgehend.sources ?? []).filter((q) => !vorhanden.has(q.id));
}

/**
 * Der Anfang: Titel und Kernaussage vom Führungsartikel, Bedingungen und Massnahmen als
 * Vereinigung beider Seiten, alle mitnehmbaren Quellen an — jede Position ist danach abwählbar.
 */
export function startAuswahl(
  fuehrung: PaarSeite,
  a: KnowledgeObject,
  b: KnowledgeObject,
): ZusammenfuehrungsAuswahl {
  const { fuehrend, aufgehend } = rollenVon(fuehrung, a, b);
  return {
    fuehrung,
    titel: "fuehrend",
    kernaussage: "fuehrend",
    bedingungen: listenPositionen(fuehrend.conditions, aufgehend.conditions).map((p) => p.text),
    massnahmen: listenPositionen(fuehrend.measures, aufgehend.measures).map((p) => p.text),
    quellen: mitnehmbareQuellen(fuehrend, aufgehend).map((q) => q.id),
  };
}

/** Eine Position an- oder abwählen; die Reihenfolge der Liste bleibt die der Positionen. */
export function umschalten(
  gewaehlt: readonly string[],
  text: string,
  alle: readonly string[],
): string[] {
  const neu = new Set(gewaehlt);
  if (neu.has(text)) {
    neu.delete(text);
  } else {
    neu.add(text);
  }
  return alle.filter((t) => neu.has(t));
}

// ------------------------------------------------------------------------------------------------
// Schritt 4 — die Vorschau und der Auftrag.
// ------------------------------------------------------------------------------------------------

export interface ZusammenfuehrungsVorschau {
  titel: string;
  kernaussage: string;
  /**
   * Der Fliesstext, der in der neuen Fassung TATSÄCHLICH steht — derselbe Wert, den der Server
   * schreibt: bei Kernaussage „aufgehend" der Rumpf der Gegenseite (auch ein leerer), sonst der
   * unveränderte Rumpf des Führungsartikels. `null` = kein Fliesstext.
   */
  fliesstext: string | null;
  bedingungen: string[];
  massnahmen: string[];
  /** Die Quellen der neuen Fassung: alle des Führungsartikels, dazu die mitgenommenen. */
  quellen: KoSource[];
  /** Die Fassungsnummer, die entsteht — eine gewöhnliche, ungeprüfte Überarbeitung. */
  neueFassung: number;
  /** Was NICHT übernommen wird. Es bleibt im aufgegangenen Artikel bzw. der Vorfassung lesbar. */
  nichtUebernommen: {
    bedingungen: string[];
    massnahmen: string[];
    quellen: KoSource[];
    /** Der bisherige Fliesstext des Führungsartikels wird ersetzt (bleibt in der Vorfassung). */
    fliesstextFuehrend: boolean;
  };
}

/** Dieselbe Leerregel wie `cleanBody` am Server: nur ein leerer oder weisser Rumpf ist keiner. */
function rumpf(html: string | null | undefined): string | null {
  return html?.trim() ? html : null;
}

export function vorschau(
  a: KnowledgeObject,
  b: KnowledgeObject,
  auswahl: ZusammenfuehrungsAuswahl,
): ZusammenfuehrungsVorschau {
  const { fuehrend, aufgehend } = rollenVon(auswahl.fuehrung, a, b);
  const alleBedingungen = listenPositionen(fuehrend.conditions, aufgehend.conditions);
  const alleMassnahmen = listenPositionen(fuehrend.measures, aufgehend.measures);
  const mitnehmbar = mitnehmbareQuellen(fuehrend, aufgehend);
  const gewaehlteQuellen = mitnehmbar.filter((q) => auswahl.quellen.includes(q.id));
  const kernVonAufgehend = auswahl.kernaussage === "aufgehend";
  const fliesstext = rumpf((kernVonAufgehend ? aufgehend : fuehrend).bodyHtml);
  return {
    titel: (auswahl.titel === "aufgehend" ? aufgehend : fuehrend).title,
    kernaussage: (kernVonAufgehend ? aufgehend : fuehrend).statement,
    fliesstext,
    bedingungen: alleBedingungen.map((p) => p.text).filter((t) => auswahl.bedingungen.includes(t)),
    massnahmen: alleMassnahmen.map((p) => p.text).filter((t) => auswahl.massnahmen.includes(t)),
    quellen: [...(fuehrend.sources ?? []), ...gewaehlteQuellen],
    neueFassung: fuehrend.version + 1,
    nichtUebernommen: {
      bedingungen: alleBedingungen
        .map((p) => p.text)
        .filter((t) => !auswahl.bedingungen.includes(t)),
      massnahmen: alleMassnahmen.map((p) => p.text).filter((t) => !auswahl.massnahmen.includes(t)),
      quellen: mitnehmbar.filter((q) => !auswahl.quellen.includes(q.id)),
      fliesstextFuehrend:
        kernVonAufgehend &&
        rumpf(fuehrend.bodyHtml) !== null &&
        fliesstextLage(fuehrend.bodyHtml, aufgehend.bodyHtml) !== "gleich",
    },
  };
}

/**
 * Nacharbeit 2 (Ben, R-0201): ist eine der beiden Seiten seit Beginn des Assistenten in einer
 * anderen Fassung angekommen? Dann gilt die gesehene Vorschau nicht mehr — die Freigabe wird
 * zurückgenommen, bis der Mensch den neuen Stand übernommen und erneut geprüft hat.
 */
export function fassungGeaendert(
  gesehen: { a: KnowledgeObject; b: KnowledgeObject },
  aktuell: { a: KnowledgeObject; b: KnowledgeObject },
): boolean {
  return gesehen.a.version !== aktuell.a.version || gesehen.b.version !== aktuell.b.version;
}

/** Der Auftrag an `POST /api/duplicates/:id/merge` — erst nach Vorschau und Freigabe gebaut. */
export function auftragAus(
  a: KnowledgeObject,
  b: KnowledgeObject,
  auswahl: ZusammenfuehrungsAuswahl,
  vermerk?: string,
): ZusammenfuehrungsAuftrag {
  const { fuehrend, aufgehend } = rollenVon(auswahl.fuehrung, a, b);
  const ansicht = vorschau(a, b, auswahl);
  const text = vermerk?.trim() ?? "";
  return {
    fuehrend: { id: fuehrend.id, version: fuehrend.version },
    aufgehend: { id: aufgehend.id, version: aufgehend.version },
    titel: auswahl.titel,
    kernaussage: auswahl.kernaussage,
    bedingungen: ansicht.bedingungen,
    massnahmen: ansicht.massnahmen,
    quellen: ansicht.quellen.filter((q) => auswahl.quellen.includes(q.id)).map((q) => q.id),
    bestaetigt: true,
    ...(text ? { vermerk: text } : {}),
  };
}

// ------------------------------------------------------------------------------------------------
// R-0565 — wer den Assistenten überhaupt benutzen kann.
// ------------------------------------------------------------------------------------------------

export type Sperrgrund = "keinRecht" | "eigeneSeite" | "geschlossen" | "aufgegangen" | "redigiert";

/**
 * Warum der Assistent für DIESEN Menschen an DIESEM Paar nicht freigeben kann — oder `null`.
 * Spiegel der Serverregel (`services/app/src/dubletten-zusammenfuehrung.ts`); der Server bleibt
 * massgeblich, die Fläche erklärt nur vorher, statt erst nach dem Klick abgewiesen zu werden.
 */
export function zusammenfuehrenGesperrt(lage: {
  userId: string | undefined;
  role: Role;
  entry: Pick<OverlapEntry, "status"> & { redacted?: boolean };
  a: KnowledgeObject;
  b: KnowledgeObject;
}): Sperrgrund | null {
  if (lage.role !== "controller" && lage.role !== "admin") {
    return "keinRecht";
  }
  if (lage.entry.status === "geschlossen") {
    return "geschlossen";
  }
  if (lage.a.mergedInto || lage.b.mergedInto) {
    return "aufgegangen";
  }
  const eigen = (ko: KnowledgeObject): boolean =>
    Boolean(lage.userId) && typeof ko.author === "string" && ko.author === lage.userId;
  if (eigen(lage.a) || eigen(lage.b)) {
    return "eigeneSeite";
  }
  if (lage.entry.redacted === true) {
    return "redigiert";
  }
  return null;
}
