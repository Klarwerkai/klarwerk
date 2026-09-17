// ================================================================================================
// JOB 4086 — SHAREPOINT-DATEI → NORMALISIERTES ImportItem (der quell-agnostische Import-Vertrag).
// ================================================================================================
//
// Der Import-Kern (`library-analytics`) kennt SharePoint nicht; nur dieser Mapper übersetzt die
// Graph-Domäne in die generischen Felder. Er ist damit Adapter #2 desselben Vertrags, den
// `services/confluence/src/mapper.ts` als Adapter #1 füllt — kein zweiter Kern, kein zweiter Weg.
//
// ================================================================================================
// JOB 4232 — WAS DIESER MAPPER SEIT HEUTE TUT, UND WAS ER WEITERHIN AUSDRÜCKLICH NICHT TUT.
// ================================================================================================
//
// BIS JOB 4232 STAND HIER: „ER LIEST DEN DATEIINHALT NICHT." Das galt für jeden Typ, und der
// entstehende Eintrag trug sichtbar „kein Volltext hinterlegt" (`imp.fullText.missing`). Diese
// Zusage ist jetzt für GENAU EINEN Typ abgelöst und für alle anderen unverändert gültig — ein
// Kommentar, der das Gegenteil dessen behauptet, was die Datei tut, ist dieselbe Unwahrheit wie ein
// Text auf der Fläche, der mehr verspricht als der Zustand hergibt.
//
// ER TRÄGT TEXT NUR DANN, WENN TEXT GELESEN WURDE. `bodyHtml` entsteht ausschliesslich aus dem
// Befund `{ art: "text" }` des Graph-Clients — also aus WIRKLICH geholten, streng als UTF-8
// dekodierten Bytes einer `text/plain`-Datei. Jeder andere Befund (`nur-merkmale`, `leer`,
// `zu-gross`, `unlesbar`) lässt das Feld WEG, so wie bisher: kein leerer String, kein Platzhalter,
// keine geratene Kernaussage. Für diese Dateien bleibt „kein Volltext hinterlegt" die Wahrheit.
//
// ER LIEST WEITERHIN KEIN OFFICE-, PDF- ODER MARKDOWN-FORMAT. Deren Text läge hinter einer
// Extraktionskette, die dieser Auftrag nicht baut; eine erfundene Kernaussage („Dokument aus
// SharePoint") wäre eine Scheinfunktion — sie sähe nach Inhalt aus und trüge keinen.
//
// ER RÄT KEINE VERTRAULICHKEIT. Confluence kann sie messen (Leseeinschränkungen der Seite); der
// DriveItem-Vertrag trägt ohne einen ZWEITEN Abruf (`/permissions`) kein Governance-Signal.
// `confidentiality` bleibt deshalb WEG — und der Import-Kern stuft eine echte Leerstelle
// fail-safe auf „vertraulich" ein (`library-analytics/src/service.ts`, Erstanlage). Genau dieser
// Fall ist dort vorgesehen: „andere Provider, die gar kein Governance-Signal liefern".
//
// ================================================================================================
// DER QUELLSTAND — DIE EINZIGE MONOTON WACHSENDE ANGABE, DIE DIE QUELLE JE DATEI WIRKLICH FÜHRT.
// ================================================================================================
//
// `ImportItem.sourceVersion` ist eine ZAHL, und der Re-Sync des Import-Kerns vergleicht sie
// grösser/kleiner. Ein DriveItem hat keine Revisionsnummer an sich (die `/versions`-Liste wäre ein
// weiterer Abruf und ein weiterer Vertrag). Was es hat, ist `lastModifiedDateTime`.
//
// Der Quellstand ist deshalb dieser Zeitpunkt IN SEKUNDEN seit 1970 — abgeleitet, nicht erfunden:
// er wächst genau dann, wenn die Datei in SharePoint geändert wurde, und er ist eine positive
// sichere Ganzzahl (`normalizeSourceVersion` verlangt genau das). Liefert die Quelle den Zeitpunkt
// nicht oder ist er unlesbar, FEHLT das Feld — kein Platzhalter, keine geratene 1.

import type { ImportItem } from "../../library-analytics";
import { kernaussageAusKlartext } from "../../structure";
import type { GraphDriveItem, SharePointInhalt } from "./graph-client";

export interface SharePointMapOptions {
  /** Die Bibliothek/das Laufwerk — landet als Kategorie und als quellneutraler Container-Anker. */
  driveId: string;
  /**
   * JOB 4232 — der Befund über den Inhalt dieser Datei, so wie der Client ihn WIRKLICH gemessen hat.
   *
   * FEHLT er, entsteht kein Volltext. Das ist Absicht und kein Versehen: ein Aufrufer, der den
   * Inhalt nicht gemessen hat, kann auch keinen behaupten — und der Mapper rät ihn nicht.
   */
  inhalt?: SharePointInhalt;
}

/**
 * Klartext → der HTML-Rumpf des Import-Vertrags.
 *
 * ZWEI DINGE PASSIEREN HIER, UND BEIDE SIND NÖTIG:
 *   1. MASKIEREN. `bodyHtml` ist ein HTML-Feld, und der Sanitizer der Persistenz
 *      (`structure/sanitizeHtml`) wirft alles weg, was wie ein unerlaubtes Tag aussieht. Eine
 *      Textdatei, die „<Wert> einsetzen" enthält, verlöre ihre spitzen Klammern — aus echtem Inhalt
 *      würde stillschweigend ein anderer. Maskiert bleibt der Text ZEICHENGLEICH das, was in der
 *      Datei stand.
 *   2. ABSÄTZE ERHALTEN. Leerzeile → neuer Absatz, einfacher Umbruch → `<br />`. Das ist die
 *      Struktur, die eine Textdatei WIRKLICH trägt; mehr wird nicht hineingelesen (keine
 *      Überschriften, keine Listen, kein Markdown — s. Kopf).
 */
function klartextAlsHtml(text: string): string {
  const maskiere = (s: string): string =>
    s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((absatz) => absatz.trim())
    .filter((absatz) => absatz.length > 0)
    .map((absatz) => `<p>${maskiere(absatz).replaceAll("\n", "<br />")}</p>`)
    .join("");
}

/** Der Anbietername am Herkunfts-Anker. Er ist der Schlüsselanteil des Re-Sync (provider+externalId). */
export const SHAREPOINT_PROVIDER = "SharePoint";

/** Nur DATEIEN sind importierbar. Ordner stehen in der Liste, tragen aber keinen Import-Weg. */
export function istDatei(item: GraphDriveItem): boolean {
  return item.file !== undefined && item.folder === undefined;
}

/**
 * Der Quellstand einer Datei — Sekunden seit 1970, oder `undefined`.
 *
 * `undefined` ist eine AUSSAGE („diese Datei nennt keinen Änderungszeitpunkt") und darf nie durch
 * eine Ersatzzahl gefüllt werden: eine erfundene Version erzeugte beim nächsten Lauf ein falsches
 * „Quelle ist neuer" oder ein falsches „unverändert".
 */
export function sharepointQuellstand(item: GraphDriveItem): number | undefined {
  const roh = item.lastModifiedDateTime?.trim();
  if (!roh) {
    return undefined;
  }
  const ms = Date.parse(roh);
  if (!Number.isFinite(ms) || ms <= 0) {
    return undefined;
  }
  return Math.floor(ms / 1000);
}

/**
 * Datei → ImportItem. Wirft NICHT: eine Datei ohne Kennung oder ohne Namen ist keine importierbare
 * Quelle, und `undefined` sagt das dem Aufrufer, statt einen Eintrag mit leeren Feldern zu bauen.
 */
export function mapDriveItemToImportItem(
  item: GraphDriveItem,
  opts: SharePointMapOptions,
): ImportItem | undefined {
  const id = item.id?.trim();
  const name = item.name?.trim();
  if (!id || !name || !istDatei(item)) {
    return undefined;
  }
  const beschreibung = item.description?.trim();
  const autor = item.lastModifiedBy?.user?.displayName?.trim();
  const url = item.webUrl?.trim();
  const stand = sharepointQuellstand(item);
  const geaendert = item.lastModifiedDateTime?.trim();
  // JOB 4232: Volltext GENAU DANN, wenn welcher gelesen wurde. Jeder andere Befund lässt das Feld
  // weg — dieselbe Regel wie bisher, nur ist „gelesen" jetzt für `text/plain` erreichbar.
  const gelesen = opts.inhalt?.art === "text" ? opts.inhalt.text : undefined;
  const bodyHtml = gelesen ? klartextAlsHtml(gelesen) : undefined;
  // JOB 4232: die Kernaussage aus dem WIRKLICH gelesenen Text — erster Absatz, an einer Satzgrenze
  // gekürzt, mit DERSELBEN Hausregel wie der Confluence-Mapper (`structure/kernaussage.ts`). Keine
  // zweite Kürzungsauslegung, und nichts Geratenes: was hier steht, stand in der Datei.
  const ausText = gelesen ? kernaussageAusKlartext(gelesen) : "";
  return {
    title: name,
    // Die Kernaussage ist die Beschreibung der Datei, wenn die Quelle eine führt — sonst der erste
    // Satz des gelesenen Textes, sonst der Dateiname. Der Import-Vertrag verlangt einen nicht-leeren
    // Satz; jede der drei Füllungen stammt WIRKLICH aus der Quelle (dieselbe Regel wie im
    // Confluence-Mapper). Die Beschreibung steht vorn, weil ein Mensch sie geschrieben hat.
    statement: beschreibung && beschreibung.length > 0 ? beschreibung : ausText || name,
    type: "best_practice",
    category: opts.driveId,
    ...(autor ? { author: autor } : {}),
    // Quellneutrale Provenienz: externalId = DriveItem-Id (Re-Sync-Anker), sourceScope = Laufwerk.
    externalId: id,
    sourceScope: opts.driveId,
    ...(stand !== undefined ? { sourceVersion: stand } : {}),
    ...(url ? { url } : {}),
    provider: SHAREPOINT_PROVIDER,
    ...(bodyHtml ? { bodyHtml } : {}),
    ...(geaendert ? { updatedAt: geaendert } : {}),
    // Graph liefert JSON mit bereits dekodierten Zeichenketten — kein HTML-Entity-Vertrag wie bei
    // Confluences Storage-XHTML. Der Marker sagt der Anzeige deshalb: NICHT noch einmal dekodieren.
    textCodec: "decoded",
  };
}
