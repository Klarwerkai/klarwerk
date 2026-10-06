// SCRUM-510: Confluence-Seite → normalisiertes ImportItem (der quell-agnostische Import-Vertrag). Der
// Import-Kern (library-analytics) kennt Confluence nicht; nur dieser Mapper übersetzt die Confluence-
// Domäne in die generischen Felder. Titel/Body → KO-Inhalt; Space+pageId+URL → Provenienz/Ursprung (für
// Re-Sync-Idempotenz); Labels → Tags; Read-Restriktionen → Governance-Signal für die Vertraulichkeit.

import type { Confidentiality, KnowledgeType, KoSourceRestrictions } from "../../knowledge-object";
import type { ImportItem } from "../../library-analytics";
// JOB 2703 D2: die EINE Kuerzungsregel liegt in `structure` (D1: library-analytics, umgelegt).
import { kernaussageAusHtml } from "../../structure";
// WP-IC-PAKET-1b (bens ROT-1): decodeHtmlEntities auch für die NICHT-Body-Felder — Confluence liefert
// Entities nicht nur im Storage-HTML, sondern auch in Titel/Autor/Labels.
import { decodeHtmlEntities } from "../../structure";
import type { ConfluenceAttachment, ConfluencePage } from "./rest-client";
import { confluenceStorageToHtml } from "./storage";

// ================================================================================================
// R-0163 — DIE ANHÄNGE EINER SEITE, QUELLNEUTRAL.
// ================================================================================================
//
// `ImportItem` steht unter Freeze-144 (`tests/library-analytics-freeze144.test.ts`), dessen Freigabe
// der Bau nicht zeichnet. Das Feld reist deshalb wie `originalAuthor` als ZUSÄTZLICHES Feld am Item:
// der Import-Kern liest es als fremdes, ungeprüftes Feld (`leseImportAnhaenge` in
// `library-analytics/src/service.ts`) und übernimmt nur, was dort besteht. Die Begriffe sind
// quellneutral — ein Jira-Adapter füllt dieselbe Form.
export interface ConfluenceImportAnhang {
  // Kennung des Anhangs in der Quelle (Confluence: attachment id).
  externalId: string;
  // Dateiname, an der Quelle EINMAL dekodiert (wie Titel/Labels).
  name: string;
  mime: string;
  size?: number;
  sourceVersion?: number;
  // Quellinterner Abrufweg — nur der Adapter derselben Quelle löst ihn auf (`fetchAttachment`).
  abruf: string;
}

export type ConfluenceImportItem = ImportItem & {
  attachments?: ConfluenceImportAnhang[];
  // Die Anhangsliste konnte nicht oder nicht vollständig gelesen werden. Fehlt das Feld, ist sie
  // vollständig — ein stilles „keine Anhänge" bei einem Lesefehler gibt es nicht.
  attachmentsIncomplete?: true;
};

/**
 * Ein Confluence-Anhang → quellneutraler Import-Anhang, oder `undefined`, wenn eine Pflichtangabe
 * fehlt (Kennung, Dateiname, Abrufweg). Kein geratener Name, kein erfundener Link.
 */
export function mapConfluenceAttachment(
  att: ConfluenceAttachment,
): ConfluenceImportAnhang | undefined {
  const externalId = att.id?.trim();
  const name = att.title ? decodeHtmlEntities(att.title).trim() : "";
  const abruf = att._links?.download?.trim();
  if (!externalId || !name || !abruf) {
    return undefined;
  }
  const mime = (att.extensions?.mediaType ?? att.metadata?.mediaType ?? "").trim().toLowerCase();
  const size = att.extensions?.fileSize;
  return {
    externalId,
    name,
    mime: mime || "application/octet-stream",
    ...(typeof size === "number" && Number.isFinite(size) && size >= 0 ? { size } : {}),
    ...(typeof att.version?.number === "number" ? { sourceVersion: att.version.number } : {}),
    abruf,
  };
}

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

// ================================================================================================
// package:confluence (K6) — WER DIE SEITE IN DER QUELLE LESEN DARF, NICHT NUR OB.
// ================================================================================================
//
// `isPageRestricted` darüber verdichtet die Restriktionslisten auf Ja/Nein — für die Einstufung
// (`confidentiality`) genügt das. Für die Nachvollziehbarkeit genügt es nicht: WELCHE Benutzer und
// Gruppen die Quelle zulässt, ging bis hierher verloren, obwohl der Client beide Listen anfordert
// (rest-client.ts, EXPAND `restrictions.read.restrictions.user/group`).
//
// ÜBERNOMMEN WIRD, WAS DIE QUELLE ALS KENNUNG LIEFERT — nichts wird erfunden oder umgedeutet:
//   · Benutzer: `accountId` (Cloud); auf älteren Server-Instanzen `userKey`, sonst `username`.
//   · Gruppen:  `name`, sonst `id`.
// Ein Eintrag ohne eine dieser Kennungen wird nicht geraten, sondern ausgelassen; Doppelte fallen
// weg, die Quell-Reihenfolge bleibt. Liefert die Quelle keine einzige Kennung (offene Seite oder
// leere Listen), FEHLT das Ergebnis — kein leeres Objekt, das wie eine Angabe aussähe.
//
// KEINE RECHTEABBILDUNG: Diese Kennungen sind Herkunftsangaben am Quellenanker. Ob und wie sie auf
// KLARWERK-Konten oder -Rollen wirken, entscheidet der gesonderte Rechteauftrag.
function quellKennung(eintrag: unknown, felder: readonly string[]): string | undefined {
  if (!eintrag || typeof eintrag !== "object") {
    return undefined;
  }
  const werte = eintrag as Record<string, unknown>;
  for (const feld of felder) {
    const wert = werte[feld];
    if (typeof wert === "string" && wert.trim().length > 0) {
      return wert.trim();
    }
  }
  return undefined;
}

function kennungenAus(liste: unknown[] | undefined, felder: readonly string[]): string[] {
  const kennungen: string[] = [];
  for (const eintrag of liste ?? []) {
    const kennung = quellKennung(eintrag, felder);
    if (kennung !== undefined && !kennungen.includes(kennung)) {
      kennungen.push(kennung);
    }
  }
  return kennungen;
}

export function confluenceReadRestrictions(page: ConfluencePage): KoSourceRestrictions | undefined {
  const read = page.restrictions?.read?.restrictions;
  const users = kennungenAus(read?.user?.results, ["accountId", "userKey", "username"]);
  const groups = kennungenAus(read?.group?.results, ["name", "id"]);
  if (users.length === 0 && groups.length === 0) {
    return undefined;
  }
  return { users, groups };
}

// JOB 3089 (N11) — QUELL-GOVERNANCE → VERTRAULICHKEIT. ABLÖSUNG VON SCRUM-511.
//
// DIE REGEL, IN EINEM SATZ: restringiert → „vertraulich", nicht restringiert → „intern" — und
// „intern" ist hier eine ECHTE Einstufung mit einem Erzeuger (die im Quellsystem nachgesehene,
// nicht vorhandene Leseeinschränkung), kein geratener Vorgabewert und kein stiller Default.
//
// WAS ABGELÖST IST: SCRUM-511 stand bis JOB 3089 an dieser Stelle und lautete „NIE ‚intern' aus dem
// Mapper" — eine nicht restringierte Seite lieferte `undefined`, woraus der Import-Kern fail-safe
// „vertraulich" machte (`library-analytics/src/service.ts:1568`). Folge im Betrieb: JEDE gewöhnliche
// Wiki-Seite wurde als vertraulich übernommen, und der Mensch las an ihr ein Vertraulichkeitszeichen.
//
// WER DAS ENTSCHIEDEN HAT: Pedi, Entscheidung 23 vom 05.09.2026, wörtlich: „Es ist nicht vertraulich
// … externe KI ist überall erlaubt". Vertraulich wird ab hier nur noch, was die Quelle ausdrücklich
// beschränkt (`isPageRestricted` darüber, unverändert) oder was ein Mensch selbst so markiert.
//
// DIESE FUNKTION LIEFERT DESHALB IMMER EINE STUFE (kein `| undefined` mehr): beide Fälle sind
// entschieden, ein dritter „weiß nicht" existiert an dieser Quelle nicht. Was der Import-Kern mit
// einer echten Leerstelle tut (andere Provider, die gar kein Governance-Signal liefern), bleibt
// davon unberührt — dort gilt sein fail-safe „vertraulich" weiter.
export function confluenceGovernanceConfidentiality(page: ConfluencePage): Confidentiality {
  return isPageRestricted(page) ? "vertraulich" : "intern";
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

// R-0163: `anhaenge` ist die gelesene Anhangsliste der Seite. Fehlt das Argument, wurde sie nicht
// gelesen (Erkundung/Space-Liste) — das Item trägt dann KEIN `attachments`-Feld. `unvollstaendig`
// stammt aus dem Lesen der Liste (Abbruch, Fehler) und reist sichtbar mit.
export function mapConfluencePageToImportItem(
  page: ConfluencePage,
  opts: ConfluenceMapOptions,
  anhaenge?: { attachments: readonly ConfluenceAttachment[]; unvollstaendig: boolean },
): ConfluenceImportItem {
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
  // package:confluence (K6): die konkreten Kennungen der Lese-Einschränkung — oder gar nichts.
  const sourceRestrictions = confluenceReadRestrictions(page);
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
    // JOB 3089 (N11): die Stufe steht IMMER am Item — Confluence entscheidet beide Fälle
    // (restringiert → vertraulich, offen → intern, s. oben). Kein bedingtes Weglassen mehr: ein
    // fehlendes Feld hiesse „diese Quelle weiss es nicht", und das ist seit Entscheidung 23 falsch.
    confidentiality: governance,
    // SCRUM-510 R2b: quellneutrale Provenienz — externalId = Confluence-pageId (Re-Sync-Anker),
    // sourceScope = Confluence-Space. Der Import-Kern kennt nur diese neutralen Begriffe.
    externalId: page.id,
    sourceScope: opts.spaceKey,
    // AUFTRAG-mega27 A2: quellneutrale HIERARCHIE innerhalb des Containers. Ein Jira-Adapter füllt
    // dasselbe Feld später mit Epic/Projekt — der Import-Kern kennt weiterhin kein Confluence-Symbol.
    ...(sourcePath ? { sourcePath } : {}),
    ...(typeof page.version?.number === "number" ? { sourceVersion: page.version.number } : {}),
    ...(sourceRestrictions ? { sourceRestrictions } : {}),
    ...(url ? { url } : {}),
    provider: "Confluence",
    ...(bodyHtml ? { bodyHtml } : {}),
    // IC-1: Provenienz-Datum (nur wenn die Quelle es liefert) — für die Read-only-Erkundung.
    ...(updatedAt ? { updatedAt } : {}),
    // WP-IC-PAKET-1c (bens ROT-2): Decode-Marker — die Textfelder sind hier KANONISCH dekodiert;
    // die Anzeige darf sie nicht erneut dekodieren (Doppel-Dekodier-Kette bei Literal-Entities).
    textCodec: "decoded",
    // R-0163: Anhänge und Bilder der Seite — nur, wenn die Liste gelesen wurde und etwas trägt.
    ...(anhaenge ? confluenceAnhangsFelder(anhaenge) : {}),
  };
}

/**
 * R-0163: die Anhangsfelder eines Items aus einer gelesenen Anhangsliste — die EINE Regel für
 * beide Wege, auf denen eine Seite in die Review-Queue kommt (`fetchItem` beim Anwenden,
 * `withAttachments` im Bereichsimport). Ein Eintrag ohne Pflichtangabe oder eine abgeschnittene
 * Liste macht das Item sichtbar unvollständig; eine leere, vollständige Liste setzt kein Feld.
 */
export function confluenceAnhangsFelder(anhaenge: {
  attachments: readonly ConfluenceAttachment[];
  unvollstaendig: boolean;
}): Pick<ConfluenceImportItem, "attachments" | "attachmentsIncomplete"> {
  const gemappt = anhaenge.attachments.map(mapConfluenceAttachment);
  const attachments = gemappt.filter((a): a is ConfluenceImportAnhang => a !== undefined);
  const unvollstaendig = anhaenge.unvollstaendig || attachments.length < gemappt.length;
  return {
    ...(attachments.length > 0 ? { attachments } : {}),
    ...(unvollstaendig ? { attachmentsIncomplete: true as const } : {}),
  };
}
