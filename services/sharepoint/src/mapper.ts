// ================================================================================================
// JOB 4086 — SHAREPOINT-DATEI → NORMALISIERTES ImportItem (der quell-agnostische Import-Vertrag).
// ================================================================================================
//
// Der Import-Kern (`library-analytics`) kennt SharePoint nicht; nur dieser Mapper übersetzt die
// Graph-Domäne in die generischen Felder. Er ist damit Adapter #2 desselben Vertrags, den
// `services/confluence/src/mapper.ts` als Adapter #1 füllt — kein zweiter Kern, kein zweiter Weg.
//
// ================================================================================================
// WAS DIESER MAPPER AUSDRÜCKLICH NICHT TUT — UND WARUM DAS EHRLICHER IST ALS DER SCHEIN.
// ================================================================================================
//
// ER LIEST DEN DATEIINHALT NICHT. Der Auftrag scopet den Adapter auf zwei Dinge: die berechtigte
// Dateiliste lesen und EINE Datei samt ihrer MERKMALE abrufen. Der Text einer `.docx` läge hinter
// einem zweiten Abruf (`/content`) und einer Extraktionskette, die dieser Auftrag nicht baut.
//
// Die Folge wird deshalb BENANNT statt kaschiert: `bodyHtml` fehlt, und das entstehende
// Wissensobjekt trägt sichtbar „kein Volltext hinterlegt" (`imp.fullText.missing` auf der
// Prüffläche). Eine erfundene Kernaussage („Dokument aus SharePoint") wäre eine Scheinfunktion —
// sie sähe nach Inhalt aus und trüge keinen.
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
import type { GraphDriveItem } from "./graph-client";

export interface SharePointMapOptions {
  /** Die Bibliothek/das Laufwerk — landet als Kategorie und als quellneutraler Container-Anker. */
  driveId: string;
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
  return {
    title: name,
    // Die Kernaussage ist die Beschreibung der Datei, wenn die Quelle eine führt — sonst der
    // Dateiname. Der Import-Vertrag verlangt einen nicht-leeren Satz; der Name ist die ehrlichste
    // Füllung, weil er WIRKLICH aus der Quelle stammt (dieselbe Regel wie im Confluence-Mapper).
    statement: beschreibung && beschreibung.length > 0 ? beschreibung : name,
    type: "best_practice",
    category: opts.driveId,
    ...(autor ? { author: autor } : {}),
    // Quellneutrale Provenienz: externalId = DriveItem-Id (Re-Sync-Anker), sourceScope = Laufwerk.
    externalId: id,
    sourceScope: opts.driveId,
    ...(stand !== undefined ? { sourceVersion: stand } : {}),
    ...(url ? { url } : {}),
    provider: SHAREPOINT_PROVIDER,
    ...(geaendert ? { updatedAt: geaendert } : {}),
    // Graph liefert JSON mit bereits dekodierten Zeichenketten — kein HTML-Entity-Vertrag wie bei
    // Confluences Storage-XHTML. Der Marker sagt der Anzeige deshalb: NICHT noch einmal dekodieren.
    textCodec: "decoded",
  };
}
