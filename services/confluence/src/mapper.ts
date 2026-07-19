// SCRUM-510: Confluence-Seite → normalisiertes ImportItem (der quell-agnostische Import-Vertrag). Der
// Import-Kern (library-analytics) kennt Confluence nicht; nur dieser Mapper übersetzt die Confluence-
// Domäne in die generischen Felder. Titel/Body → KO-Inhalt; Space+pageId+URL → Provenienz/Ursprung (für
// Re-Sync-Idempotenz); Labels → Tags; Read-Restriktionen → Governance-Signal für die Vertraulichkeit.

import type { Confidentiality, KnowledgeType } from "../../knowledge-object";
import type { ImportItem } from "../../library-analytics";
import { htmlToPlainText } from "../../structure";
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

export function mapConfluencePageToImportItem(
  page: ConfluencePage,
  opts: ConfluenceMapOptions,
): ImportItem {
  const bodyHtml = confluenceStorageToHtml(page.body?.storage?.value ?? "");
  const plain = htmlToPlainText(bodyHtml).trim();
  const tags = (page.metadata?.labels?.results ?? [])
    .map((l) => l.name?.trim())
    .filter((n): n is string => !!n);
  const webui = page._links?.webui;
  const url = webui ? `${opts.baseUrl.replace(/\/+$/, "")}${webui}` : undefined;
  const author = page.version?.by?.displayName?.trim();
  // IC-1: Provenienz-Datum der letzten Version (Confluence version.when, ISO) → nur wenn vorhanden.
  const updatedAt = page.version?.when?.trim();
  const governance = confluenceGovernanceConfidentiality(page);

  return {
    title: page.title,
    // Kernaussage: Plaintext des Body (Fallback Titel, damit statement nie leer ist); der volle Rich-
    // Body reist als bodyHtml mit und wird serverseitig sanitisiert (KoService.create).
    statement: plain || page.title,
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
    ...(typeof page.version?.number === "number" ? { sourceVersion: page.version.number } : {}),
    ...(url ? { url } : {}),
    provider: "Confluence",
    ...(bodyHtml ? { bodyHtml } : {}),
    // IC-1: Provenienz-Datum (nur wenn die Quelle es liefert) — für die Read-only-Erkundung.
    ...(updatedAt ? { updatedAt } : {}),
  };
}
