// ================================================================================================
// R-1107 / R-0201 / R-0565 (Aufnahme gesamt-dublettenvergleich) — ZWEI DUBLETTEN BEWUSST ZU EINEM.
// ================================================================================================
//
// Der Serverteil des Zusammenführen-Assistenten (Fläche: `apps/web/src/pages/DuplicateMerge.tsx`).
// Er steht HIER und nicht in einem der beiden Module, weil er beide braucht: das Wissensobjekt
// (knowledge-object) und den Dublettenbefund (conflicts). `conflicts` kennt keine Wissensobjekte,
// `knowledge-object` keine Befunde — dieselbe Lage wie bei der Erkennung (duplicate-detection.ts).
//
// WAS GESCHIEHT, in dieser Reihenfolge:
//   1. Der Führungsartikel bekommt eine NEUE FASSUNG über den gewöhnlichen Überarbeitungsweg
//      (`KoService.revise`, bedingt auf die gesehene Fassung). Sie ist wie jede Überarbeitung
//      UNGEPRÜFT (Status „offen", Vertrauen 0) und läuft damit normal durch die Prüfung —
//      zusammengeführtes Wissen gilt nicht ungeprüft als gesichert. Beleg `ko.merge-received`.
//   2. Der aufgehende Artikel bekommt den Verweis `mergedInto` (`KoService.markMergedInto`). Er wird
//      NICHT gelöscht: Text, Quellen, Anhänge, Kommentare und Historie bleiben, er bleibt lesbar.
//   3. Der Befund schliesst als `merged` (`OverlapService.closeAsMerged`).
//   4. Der gewöhnliche Nachlauf einer neuen Fassung am Führungsartikel (Revisions-Sweep, KI-Prüfung).
//
// WAS DER MENSCH ENTSCHEIDET (R-0201 „Feld für Feld"): Titel und Kernaussage (samt Fliesstext) je
// von einer Seite, Bedingungen und Massnahmen Position für Position aus beiden Seiten, und welche
// Quellen des aufgehenden Artikels mitgehen. Neuer Text entsteht hier nicht — jede Position muss
// wörtlich an einer der beiden Seiten stehen. Die Quellen des Führungsartikels bleiben immer.
//
// WER DARF (R-0565): Zusammenführen ist kuratorisch (`ko.validate`, an der Route), und es entscheidet
// immer auch über die Gegenseite. Deshalb führt NIEMAND zusammen, der an einer der beiden Seiten
// Autor ist — auch kein Controller oder Admin. Ausserdem muss der Mensch den Inhalt BEIDER Seiten
// lesen dürfen (`feldFreigabe`, dieselbe Regel wie die Feldredaktion der Dublettenliste) und beide
// müssen im selben Space liegen — sonst würde Inhalt in einen anderen Leserkreis verschoben.
//
// DIE BENANNTE GRENZE: die drei Schreibschritte haben KEINE gemeinsame Transaktion; jeder ist für
// sich atomar mit seinem Beleg. Alles, was fachlich scheitern kann (Rechte, Fassungen, Stand des
// Befunds, Eingaben), wird VOR dem ersten Schreibschritt geprüft. Bricht danach die Infrastruktur
// ab, kann ein Zwischenstand bleiben (neue Fassung am Führungsartikel ohne Verweis am anderen) —
// verloren geht dabei nichts, und beide Artikel bleiben gewöhnlich bearbeitbar.
import type { ConflictService, OverlapEntry, OverlapService } from "../../conflicts";
import type { KnowledgeObject, KoService, KoSource } from "../../knowledge-object";
import type { SessionUser } from "./http";
import { type KoSichtbarkeitsZugang, feldFreigabe, paarSichtbar } from "./sichtbarkeit";

export type ZusammenfuehrungsSeite = "fuehrend" | "aufgehend";

/** Was die Fläche nach Schritt 4 („Freigeben") schickt. */
export interface ZusammenfuehrungsAuftrag {
  fuehrend: { id: string; version: number };
  aufgehend: { id: string; version: number };
  titel: ZusammenfuehrungsSeite;
  kernaussage: ZusammenfuehrungsSeite;
  bedingungen: string[];
  massnahmen: string[];
  /** Kennungen der Quellen des AUFGEHENDEN Artikels, die in den Führungsartikel übernommen werden. */
  quellen: string[];
  /** Die ausdrückliche Freigabe nach der Vorschau — ohne sie wird nichts geschrieben. */
  bestaetigt: true;
  vermerk?: string;
}

type FehlerCode = "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "INVALID";

/** Fachfehler des Zusammenführens. Die Codes stehen alle in `STATUS_BY_CODE`/`ERLAUBTE_FEHLERCODES`. */
export class ZusammenfuehrungsFehler extends Error {
  readonly code: FehlerCode;

  constructor(code: FehlerCode, message: string) {
    super(message);
    this.code = code;
    this.name = "ZusammenfuehrungsFehler";
  }
}

export interface ZusammenfuehrungsDeps {
  ko: KoService;
  overlaps: OverlapService;
  kos: KoSichtbarkeitsZugang;
  conflicts?: Pick<ConflictService, "onKoRevised">;
  aiCheckWorker?: { enqueue(koId: string, koVersion?: number): void };
}

export interface ZusammenfuehrungsErgebnis {
  befund: OverlapEntry;
  fuehrend: { id: string; version: number; status: string };
  aufgehend: { id: string; mergedInto: KnowledgeObject["mergedInto"] };
}

/** Dieselbe Normalform wie die Fläche (`lib/dublettenZusammenfuehrung.ts`, `normal`). */
function normal(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function textListe(wert: unknown, feld: string): string[] {
  if (!Array.isArray(wert) || wert.some((w) => typeof w !== "string")) {
    throw new ZusammenfuehrungsFehler("INVALID", `${feld} muss eine Liste von Texten sein.`);
  }
  // Leere Positionen tragen nichts; doppelte würden die Fassung zweimal dasselbe sagen lassen.
  return [...new Set((wert as string[]).map(normal).filter((w) => w.length > 0))];
}

function seite(wert: unknown, feld: string): ZusammenfuehrungsSeite {
  if (wert !== "fuehrend" && wert !== "aufgehend") {
    throw new ZusammenfuehrungsFehler("INVALID", `${feld} muss "fuehrend" oder "aufgehend" sein.`);
  }
  return wert;
}

function artikel(wert: unknown, feld: string): { id: string; version: number } {
  const { id, version } = (wert ?? {}) as { id?: unknown; version?: unknown };
  if (
    typeof id !== "string" ||
    id.length === 0 ||
    typeof version !== "number" ||
    !Number.isInteger(version)
  ) {
    throw new ZusammenfuehrungsFehler("INVALID", `${feld} braucht Kennung und gesehene Fassung.`);
  }
  return { id, version };
}

/** Der rohe Rumpf als Auftrag — oder ein INVALID mit Grund. Kein stilles Auffüllen. */
export function leseZusammenfuehrungsAuftrag(body: unknown): ZusammenfuehrungsAuftrag {
  const roh = (body ?? {}) as Record<string, unknown>;
  // R-1107: „kein Ein-Klick-Automatismus" — die Freigabe nach der Vorschau ist ein eigenes Feld,
  // das die Fläche erst im vierten Schritt setzt. Fehlt es, ist das kein Zusammenführen.
  if (roh.bestaetigt !== true) {
    throw new ZusammenfuehrungsFehler(
      "INVALID",
      "Die ausdrückliche Freigabe nach der Vorschau fehlt — es wurde nichts zusammengeführt.",
    );
  }
  const vermerk = typeof roh.vermerk === "string" ? roh.vermerk.trim() : "";
  return {
    fuehrend: artikel(roh.fuehrend, "fuehrend"),
    aufgehend: artikel(roh.aufgehend, "aufgehend"),
    titel: seite(roh.titel, "titel"),
    kernaussage: seite(roh.kernaussage, "kernaussage"),
    bedingungen: textListe(roh.bedingungen, "bedingungen"),
    massnahmen: textListe(roh.massnahmen, "massnahmen"),
    quellen: textListe(roh.quellen, "quellen"),
    bestaetigt: true,
    ...(vermerk ? { vermerk } : {}),
  };
}

/** Jede Position muss wörtlich an einer der beiden Seiten stehen — hier entsteht kein neuer Text. */
function nurVorhandenes(gewaehlt: string[], a: string[], b: string[], feld: string): void {
  const vorhanden = new Set([...a, ...b].map(normal));
  const fremd = gewaehlt.filter((w) => !vorhanden.has(w));
  if (fremd.length > 0) {
    throw new ZusammenfuehrungsFehler(
      "INVALID",
      `${feld}: ${fremd.length} Position(en) stehen an keiner der beiden Seiten.`,
    );
  }
}

/**
 * R-0565 — die Rechte- und Sichtregel, VOR jedem Schreibschritt. Getrennt von `fuehreZusammen`,
 * damit die Regel an EINER benannten Stelle steht; die Fläche spiegelt sie nur zur Erklärung.
 */
async function pruefeKuratorischesRecht(
  user: SessionUser,
  a: KnowledgeObject,
  b: KnowledgeObject,
  kos: KoSichtbarkeitsZugang,
): Promise<void> {
  const eigene = [a, b].filter(
    (ko) => typeof ko.author === "string" && ko.author.length > 0 && ko.author === user.id,
  );
  if (eigene.length > 0) {
    throw new ZusammenfuehrungsFehler(
      "FORBIDDEN",
      "Du bist Autor einer Seite dieses Paares. Zusammenführen entscheidet auch über die Gegenseite und bleibt deshalb eine kuratorische Handlung eines anderen Menschen.",
    );
  }
  const freigabe = await feldFreigabe(user, a.id, b.id, kos);
  if (!freigabe.a || !freigabe.b) {
    throw new ZusammenfuehrungsFehler(
      "FORBIDDEN",
      "Zusammenführen verlangt Einsicht in den Inhalt beider Seiten; mindestens eine ist für dich redigiert.",
    );
  }
  const spaceVon = (ko: KnowledgeObject): string | null =>
    typeof ko.spaceId === "string" ? ko.spaceId : null;
  if (spaceVon(a) !== spaceVon(b)) {
    throw new ZusammenfuehrungsFehler(
      "FORBIDDEN",
      "Die beiden Artikel liegen in verschiedenen Spaces; ihr Inhalt würde in einen anderen Leserkreis verschoben.",
    );
  }
}

/** Die neue Fassung des Führungsartikels — ausschliesslich aus den Werten beider Seiten. */
function neueFassung(
  fuehrend: KnowledgeObject,
  aufgehend: KnowledgeObject,
  auftrag: ZusammenfuehrungsAuftrag,
): {
  title: string;
  statement: string;
  bodyHtml?: string | null;
  conditions: string[];
  measures: string[];
  sources: KoSource[];
} {
  const kern = auftrag.kernaussage === "aufgehend" ? aufgehend : fuehrend;
  const vorhandeneQuellen = new Set((fuehrend.sources ?? []).map((q) => q.id));
  const mitgenommen = (aufgehend.sources ?? []).filter(
    (q) => auftrag.quellen.includes(q.id) && !vorhandeneQuellen.has(q.id),
  );
  return {
    title: (auftrag.titel === "aufgehend" ? aufgehend : fuehrend).title,
    statement: kern.statement,
    // Die Kernaussage reist MIT ihrem Fliesstext — sonst stünde der Text der einen Seite über dem
    // Rumpf der anderen. Bleibt die Kernaussage beim Führungsartikel, wird der Rumpf nicht berührt.
    ...(auftrag.kernaussage === "aufgehend" ? { bodyHtml: aufgehend.bodyHtml ?? null } : {}),
    conditions: auftrag.bedingungen,
    measures: auftrag.massnahmen,
    // Die Quellen des Führungsartikels bleiben IMMER; die gewählten des anderen kommen dazu.
    sources: [...(fuehrend.sources ?? []), ...mitgenommen],
  };
}

export async function fuehreZusammen(
  deps: ZusammenfuehrungsDeps,
  user: SessionUser,
  overlapId: string,
  auftrag: ZusammenfuehrungsAuftrag,
): Promise<ZusammenfuehrungsErgebnis> {
  // `get` blendet einen offenen Befund mit überholter Fassungsbindung aus — derselbe Lesepfad wie
  // `GET /api/duplicates/:id`. Ein geschlossener Befund wird gelesen und ehrlich abgewiesen.
  // Nicht sichtbar sieht aus wie nicht vorhanden (mega74 D, dieselbe Regel wie
  // `GET /api/duplicates/:id`): ein Paar, das dieser Mensch nicht sehen darf, bekommt kein 403,
  // sonst wäre die Abweisung selbst die Auskunft, dass es das Paar gibt.
  const befund = await deps.overlaps.get(overlapId);
  if (!befund || !(await paarSichtbar(user, befund.koA, befund.koB, deps.kos))) {
    throw new ZusammenfuehrungsFehler("NOT_FOUND", "Überschneidung nicht gefunden.");
  }
  if (befund.status === "geschlossen") {
    throw new ZusammenfuehrungsFehler("CONFLICT", "Diese Überschneidung ist bereits geschlossen.");
  }
  const paar = [befund.koA, befund.koB];
  if (
    auftrag.fuehrend.id === auftrag.aufgehend.id ||
    !paar.includes(auftrag.fuehrend.id) ||
    !paar.includes(auftrag.aufgehend.id)
  ) {
    throw new ZusammenfuehrungsFehler(
      "INVALID",
      "Führungsartikel und aufgehender Artikel müssen die beiden Seiten dieses Befunds sein.",
    );
  }
  const fuehrend = await deps.ko.get(auftrag.fuehrend.id);
  const aufgehend = await deps.ko.get(auftrag.aufgehend.id);
  if (!fuehrend || !aufgehend) {
    throw new ZusammenfuehrungsFehler("NOT_FOUND", "Eine Seite dieses Paares gibt es nicht mehr.");
  }
  await pruefeKuratorischesRecht(user, fuehrend, aufgehend, deps.kos);
  if (fuehrend.mergedInto || aufgehend.mergedInto) {
    throw new ZusammenfuehrungsFehler(
      "CONFLICT",
      "Eine Seite ist bereits in einem anderen Artikel aufgegangen.",
    );
  }
  if (
    fuehrend.version !== auftrag.fuehrend.version ||
    aufgehend.version !== auftrag.aufgehend.version
  ) {
    throw new ZusammenfuehrungsFehler(
      "CONFLICT",
      "Eine Seite wurde seit der Vorschau geändert. Es wurde nichts zusammengeführt — bitte die Vorschau neu öffnen.",
    );
  }
  nurVorhandenes(auftrag.bedingungen, fuehrend.conditions, aufgehend.conditions, "bedingungen");
  nurVorhandenes(auftrag.massnahmen, fuehrend.measures, aufgehend.measures, "massnahmen");
  const quellKennungen = new Set((aufgehend.sources ?? []).map((q) => q.id));
  if (auftrag.quellen.some((id) => !quellKennungen.has(id))) {
    throw new ZusammenfuehrungsFehler(
      "INVALID",
      "quellen: nur Quellen des aufgehenden Artikels können mitgenommen werden.",
    );
  }

  // --- 1. Die neue Fassung des Führungsartikels (gewöhnliche, ungeprüfte Überarbeitung) ---------
  const revidiert = await deps.ko.revise(
    fuehrend.id,
    neueFassung(fuehrend, aufgehend, auftrag),
    user.id,
    {
      expectedVersion: fuehrend.version,
      zusatzBeleg: {
        action: "ko.merge-received",
        payload: {
          from: aufgehend.id,
          fromVersion: aufgehend.version,
          overlapId,
          quellen: auftrag.quellen.length,
        },
      },
    },
  );
  // --- 2. Der aufgehende Artikel bleibt und verweist -------------------------------------------
  const aufgegangen = await deps.ko.markMergedInto(
    aufgehend.id,
    { koId: fuehrend.id, version: revidiert.version, overlapId },
    user.id,
    aufgehend.version,
  );
  // --- 3. Der Befund schliesst als „zusammengeführt" -------------------------------------------
  const geschlossen = await deps.overlaps.closeAsMerged(
    overlapId,
    user.id,
    {
      survivorKoId: fuehrend.id,
      survivorVersion: revidiert.version,
      retiredKoId: aufgehend.id,
    },
    auftrag.vermerk,
  );
  // --- 4. Der gewöhnliche Nachlauf einer neuen Fassung (wie `nachNeuerFassung`, ko-routes.ts) ---
  // ERST NACH dem Abschluss: der Sweep schlösse sonst genau diesen Befund als `superseded`.
  await deps.conflicts?.onKoRevised(fuehrend.id, revidiert.version);
  await deps.overlaps.onKoRevised(fuehrend.id, revidiert.version);
  let stand: KnowledgeObject = revidiert;
  if (deps.aiCheckWorker && revidiert.aiCheck) {
    await deps.ko.markAiCheckPending(fuehrend.id);
    const markiert = await deps.ko.get(fuehrend.id);
    deps.aiCheckWorker.enqueue(fuehrend.id, markiert?.aiCheck?.koVersion);
    stand = markiert ?? revidiert;
  }
  return {
    befund: geschlossen,
    fuehrend: { id: stand.id, version: stand.version, status: stand.status },
    aufgehend: { id: aufgegangen.id, mergedInto: aufgegangen.mergedInto },
  };
}
