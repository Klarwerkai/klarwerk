// SCRUM-510: Confluence-Seite → normalisiertes ImportItem (der quell-agnostische Import-Vertrag). Der
// Import-Kern (library-analytics) kennt Confluence nicht; nur dieser Mapper übersetzt die Confluence-
// Domäne in die generischen Felder. Titel/Body → KO-Inhalt; Space+pageId+URL → Provenienz/Ursprung (für
// Re-Sync-Idempotenz); Labels → Tags; Read-Restriktionen → Governance-Signal für die Vertraulichkeit.

import type { Confidentiality, KnowledgeType } from "../../knowledge-object";
import type { ImportItem } from "../../library-analytics";
// JOB 2703 D2: die EINE Kuerzungsregel liegt in `structure` (D1: library-analytics, umgelegt).
import { kernaussageAusHtml } from "../../structure";
// WP-IC-PAKET-1b (bens ROT-1): decodeHtmlEntities auch für die NICHT-Body-Felder — Confluence liefert
// Entities nicht nur im Storage-HTML, sondern auch in Titel/Autor/Labels.
import { decodeHtmlEntities } from "../../structure";
import type { ConfluencePage } from "./rest-client";
import { confluenceStorageToHtml } from "./storage";

export interface ConfluenceMapOptions {
  baseUrl: string; // für die absolute Seiten-URL (Provenienz)
  spaceKey: string; // landet als Kategorie/Space-Anker
  defaultType?: KnowledgeType; // Wissensart, wenn die Quelle keine hergibt (Default best_practice)
}

// Eine Seite gilt als eingeschränkt, wenn user- ODER group-Read-Restriktionen gesetzt sind.
export function isPageRestricted(page: ConfluencePage): boolean {
  const read = page.restrictions?.read?.restrictions;
  const users = read?.user?.results ?? [];
  const groups = read?.group?.results ?? [];
  return users.length > 0 || groups.length > 0;
}

// SCRUM-511: Quell-Governance → Vertraulichkeit. Eine RESTRINGIERTE Seite trägt ein explizites
// Governance-Signal → mindestens „vertraulich". Eine NICHT restringierte Seite hat KEIN Signal →
// undefined; der Import-Kern stuft dann fail-safe auf „vertraulich" (R3). NIE „intern" aus dem Mapper.
export function confluenceGovernanceConfidentiality(
  page: ConfluencePage,
): Confidentiality | undefined {
  return isPageRestricted(page) ? "vertraulich" : undefined;
}

// AUFTRAG-mega27 A2: Elternkette → QUELLNEUTRALER Pfad. Die Elterntitel in Quell-Reihenfolge
// (Wurzel zuerst), OHNE die Seite selbst. Confluence liefert `ancestors` bereits so sortiert.
// Dekodierung wie bei Titel/Autor/Labels (WP-IC-PAKET-1b ROT-1): EINMAL hier an der Quelle — der
// Marker textCodec="decoded" am Item gilt für diese Werte mit, die Anzeige dekodiert NICHT erneut.
//
// KEIN FELD OHNE ERZEUGER, KEINE ERFUNDENE WURZEL: fehlt der Expand, ist die Seite selbst eine
// Wurzelseite oder tragen alle Ahnen leere Titel, liefert diese Funktion `undefined` — der Mapper
// lässt das Feld dann WEG. Kein leeres Array, kein Platzhalter-Ordner, kein aus dem Titel geratener
// Pfad. Eine Seite ohne Elternkette hängt später sichtbar direkt unter dem Quell-Container.
export function confluenceSourcePath(page: ConfluencePage): string[] | undefined {
  if (!Array.isArray(page.ancestors)) {
    return undefined;
  }
  const path = page.ancestors
    .map((ancestor) => (ancestor?.title ? decodeHtmlEntities(ancestor.title).trim() : ""))
    .filter((title) => title.length > 0);
  return path.length > 0 ? path : undefined;
}

// ================================================================================================
// JOB 1042 D3 — DIE IDENTITÄT DER ELTERNKETTE, NEBEN IHREM NAMEN
// ================================================================================================
//
// DER BEFUND (Vollurteil zu D2, Z. 48-50): „Der tatsächliche Informationsverlust liegt im Mapper:
// Vorfahren-IDs verschwinden, Titel bleiben." Nachgemessen: `rest-client.ts:43` fordert
// `ancestors` samt `id` an — die Identität KOMMT an und wird zwei Zeilen später weggeworfen.
//
// WARUM DER TITELPFAD BLEIBT, WIE ER IST: er ist die ANZEIGE (Ordnerbaum, Vorschau, Dreizustand)
// und dort richtig. Was ihm fehlt, ist Dauerhaftigkeit: benennt jemand einen Elternordner um,
// ändert sich der Pfad, obwohl es derselbe Ordner ist. Titel und Identität bekommen deshalb
// GETRENNTE Rollen (Urteil, Hinweise Z. 263-265) — nicht ein Feld, das beides halb kann.
//
// KEINE ORDNUNG, KEINE ERFINDUNG: `ancestors` trägt je Ahne genau `id` und `title`, also keine
// Geschwisterposition. Ein `ordinal` würde hier weder aus der Antwortreihenfolge noch aus einer
// Titelsortierung abgeleitet (Urteil Z. 267-268) — es fehlt schlicht, und das ist die ehrliche
// Angabe. Die TIEFE braucht kein eigenes Feld: sie ist die Länge dieser Kette.

/**
 * Der Zustand EINER Ahnenkette. Dieser Typ BENENNT einen Mangel — er entscheidet nicht, was der
 * Import daraufhin tut. Die fail-closed Regel für fehlende IDs ist eine offene Ownerentscheidung
 * (Korrekturpflicht 1 des Vollurteils) und wird hier bewusst nicht vorweggenommen.
 */
export type ConfluenceAhnenBefund = "ok" | "fehlende-id" | "zyklus";

/** Getrimmte ID eines Ahnen, oder `undefined` wenn keine brauchbare vorliegt. */
function ahnenId(ancestor: { id?: string } | undefined): string | undefined {
  const id = ancestor?.id?.trim();
  return id && id.length > 0 ? id : undefined;
}

/**
 * Die STABILE Elternkette: die Vorfahren-IDs in Quell-Reihenfolge (Wurzel zuerst), ohne die Seite
 * selbst — dieselbe Form und dieselbe Zurückhaltung wie `confluenceSourcePath`.
 *
 * `undefined` heisst „keine verwendbare Kette" und deckt ZWEI Fälle ab: die Seite ist eine
 * Wurzelseite, ODER mindestens ein Ahne trägt keine ID. Der zweite Fall ist der wichtige: eine
 * TEILWEISE Kette wäre schlimmer als gar keine, weil jede Zuordnung zwischen Titel und ID ab dem
 * Loch verschoben wäre. Welcher der beiden Fälle vorliegt, sagt `confluenceAhnenBefund`.
 */
export function confluenceAncestorIds(page: ConfluencePage): string[] | undefined {
  if (!Array.isArray(page.ancestors) || page.ancestors.length === 0) {
    return undefined;
  }
  const ids: string[] = [];
  for (const ancestor of page.ancestors) {
    const id = ahnenId(ancestor);
    if (id === undefined) {
      return undefined; // lückenhaft ⇒ keine Kette (s. o.)
    }
    ids.push(id);
  }
  return ids;
}

/**
 * Der Befund zur Ahnenkette einer Seite — die Diagnose, nicht die Reaktion.
 *
 * `ok` schliesst die WURZELSEITE ausdrücklich ein: keine Ahnen zu haben ist kein Mangel, sondern
 * die Lage der obersten Seite. Ein `zyklus` liegt vor, wenn die Seite in ihrer eigenen Kette steht
 * oder ein Vorfahr darin doppelt vorkommt — beides kann Confluence nicht liefern und deutet auf
 * beschädigte oder manipulierte Antwortdaten.
 */
export function confluenceAhnenBefund(page: ConfluencePage): ConfluenceAhnenBefund {
  if (!Array.isArray(page.ancestors) || page.ancestors.length === 0) {
    return "ok";
  }
  const ids = confluenceAncestorIds(page);
  if (ids === undefined) {
    return "fehlende-id";
  }
  const eigene = page.id?.trim();
  if (eigene && ids.includes(eigene)) {
    return "zyklus";
  }
  return new Set(ids).size === ids.length ? "ok" : "zyklus";
}

export function mapConfluencePageToImportItem(
  page: ConfluencePage,
  opts: ConfluenceMapOptions,
): ImportItem {
  const bodyHtml = confluenceStorageToHtml(page.body?.storage?.value ?? "");
  // JOB 2703 D1 (Review R2-3): hier stand `htmlToPlainText(bodyHtml)` — der GESAMTE Klartext der
  // Seite wurde zur Kernaussage, während der Volltext ohnehin als `bodyHtml` mitreist. Jetzt: der
  // erste Absatz, höchstens 500 Zeichen, an einer Satzgrenze (die eine Hilfsfunktion in
  // library-analytics, Begründung dort). `bodyHtml` bleibt unverändert der Volltext.
  const plain = kernaussageAusHtml(bodyHtml);
  // WP-IC-PAKET-1b (bens ROT-1): ALLE textuellen Quellfelder EINMAL an der Quelle dekodieren — nicht
  // nur das Body-Statement (htmlToPlainText). Titel (auch als Statement-Fallback), Autor und Labels
  // tragen sonst rohe Entities in Kandidaten, Themen-Ableitung (explore/select) und angenommene KOs.
  const title = decodeHtmlEntities(page.title);
  const tags = (page.metadata?.labels?.results ?? [])
    .map((l) => (l.name ? decodeHtmlEntities(l.name).trim() : undefined))
    .filter((n): n is string => !!n);
  const webui = page._links?.webui;
  const url = webui ? `${opts.baseUrl.replace(/\/+$/, "")}${webui}` : undefined;
  const rawAuthor = page.version?.by?.displayName?.trim();
  const author = rawAuthor ? decodeHtmlEntities(rawAuthor) : undefined;
  // IC-1: Provenienz-Datum der letzten Version (Confluence version.when, ISO) → nur wenn vorhanden.
  const updatedAt = page.version?.when?.trim();
  const governance = confluenceGovernanceConfidentiality(page);
  // AUFTRAG-mega27 A2: die Elternkette (Wurzel zuerst, ohne die Seite selbst) — oder gar nichts.
  const sourcePath = confluenceSourcePath(page);

  return {
    title,
    // Kernaussage: Plaintext des Body (Fallback dekodierter Titel, damit statement nie leer ist); der
    // volle Rich-Body reist als bodyHtml mit und wird serverseitig sanitisiert (KoService.create).
    statement: plain || title,
    type: opts.defaultType ?? "best_practice",
    category: opts.spaceKey,
    ...(author ? { author } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    // SCRUM-511: nur setzen, wenn ein Governance-Signal vorliegt (restringiert). Sonst undefined →
    // fail-safe „vertraulich" im Import-Kern (kein stiller intern-Default).
    ...(governance ? { confidentiality: governance } : {}),
    // SCRUM-510 R2b: quellneutrale Provenienz — externalId = Confluence-pageId (Re-Sync-Anker),
    // sourceScope = Confluence-Space. Der Import-Kern kennt nur diese neutralen Begriffe.
    externalId: page.id,
    sourceScope: opts.spaceKey,
    // AUFTRAG-mega27 A2: quellneutrale HIERARCHIE innerhalb des Containers. Ein Jira-Adapter füllt
    // dasselbe Feld später mit Epic/Projekt — der Import-Kern kennt weiterhin kein Confluence-Symbol.
    ...(sourcePath ? { sourcePath } : {}),
    ...(typeof page.version?.number === "number" ? { sourceVersion: page.version.number } : {}),
    ...(url ? { url } : {}),
    provider: "Confluence",
    ...(bodyHtml ? { bodyHtml } : {}),
    // IC-1: Provenienz-Datum (nur wenn die Quelle es liefert) — für die Read-only-Erkundung.
    ...(updatedAt ? { updatedAt } : {}),
    // WP-IC-PAKET-1c (bens ROT-2): Decode-Marker — die Textfelder sind hier KANONISCH dekodiert;
    // die Anzeige darf sie nicht erneut dekodieren (Doppel-Dekodier-Kette bei Literal-Entities).
    textCodec: "decoded",
  };
}
