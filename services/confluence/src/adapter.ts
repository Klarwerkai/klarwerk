// SCRUM-510: Confluence als Adapter #1 des quell-agnostischen Import-Vertrags (SourceAdapter). Der
// Adapter liest die Space-Seiten (read-only REST) und liefert normalisierte ImportItems — der Import-
// Kern (createImportCandidates → acceptToKo) kennt die Quelle nicht. Eine spätere Quelle (Jira-TEST,
// Adapter #2) ist NUR ein weiterer SourceAdapter, kein Umbau dieses Pfads.
//
// R2a (Encapsulation): nach außen (Paket-index) ist NUR createConfluenceAdapterFromEnv erreichbar — der
// Roh-Client, seine token-tragende Config und der env-Resolver bleiben modul-intern.

import type { ImportItem, SourceAdapter } from "../../library-analytics";
import {
  type ConfluenceMapOptions,
  confluenceAhnenBefund,
  confluenceAncestorIds,
  mapConfluencePageToImportItem,
} from "./mapper";
import type { ConfluenceAbbruch, ConfluencePage } from "./rest-client";
import {
  ConfluenceRestClient,
  type ConfluenceRestConfig,
  confluenceClientFromEnv,
} from "./rest-client";

// SCRUM-510 WP2: Ergebnis eines vollständigen (paginierten) Space-Einlesens — normalisierte Items PLUS
// pro-Seite-Fehler (eine fehlerhafte Seite bricht den Lauf NICHT ab). `ref` ist die Herkunft (pageId
// oder Titel) zur ehrlichen Fehlerzuordnung, ohne Interna zu lecken.
export interface CollectResult {
  items: ImportItem[];
  // WP-SAMMEL20-FIX (bens Fix 6a): errorClass = PII-freie Fehlerklasse (Error.name) je nicht
  // lesbarer Seite — der Erkundungs-Wire trägt NUR sie, nie die rohe Fehlermeldung. Additiv.
  failed: { ref: string; error: string; errorClass?: string }[];
  // SCRUM-510 (WP3): true, wenn der Space-Read am Seiten-Cap abgeschnitten wurde (nicht vollständig). Der
  // Import-Kern macht daraus einen ehrlichen „unvollständig"-Status — nie eine stille „fertig"-Meldung.
  truncated: boolean;
  // JOB 1042 D3: der Hierarchie-Befund über die EINGESAMMELTEN Seiten. Additiv und rein
  // diagnostisch — er verändert weder `items` noch `failed` (s. hierarchieBefund).
  hierarchie?: ConfluenceHierarchieBefund;
  // JOB 2683 D2: WARUM der Lauf vor dem letzten Cursor endete (Frist, Größe, Zeitbudget) — nur
  // gesetzt, wenn `truncated` aus einem Abbruch stammt. Reist bis zur Erkundungs-Fläche, damit
  // „unvollständig" dort einen Grund hat. Additiv; der Seiten-Cap trägt keinen Abbruch.
  abbruch?: ConfluenceAbbruch;
}

// ================================================================================================
// JOB 1042 D3 — DER BAUMBEFUND ÜBER DIE GESAMTE SAMMLUNG
// ================================================================================================
//
// Der Baumleser im Mapper urteilt je SEITE (fehlende ID, Zyklus). Zwei der vom Vollurteil
// verlangten Negativfälle (Prüflücke 5) sind aber erst über die GANZE Sammlung sichtbar: eine
// doppelt gelieferte Seiten-ID und ein Elternteil, den die Sammlung gar nicht enthält. Deshalb
// sitzt diese Auswertung hier und nicht im Mapper.
//
// ER MELDET, ER SPERRT NICHT. Ob ein Mangel den Import anhalten soll (fail-closed) oder nicht, ist
// die ausdrücklich offene Ownerentscheidung aus Korrekturpflicht 1. Bis sie getroffen ist, bleiben
// `items`, `failed` und `truncated` von diesem Befund UNBERÜHRT — er ist eine Auskunft.
export interface ConfluenceHierarchieBefund {
  /** Gelieferte Seiten insgesamt (auch doppelt gelieferte zählen einzeln). */
  seiten: number;
  /** Seiten mit vollständiger, verwendbarer ID-Kette. */
  mitKette: number;
  /** Seiten ohne jeden Vorfahren — die obersten Seiten des Containers. */
  wurzeln: number;
  /** Längste vorgefundene Kette (0, wenn es nur Wurzeln gibt). */
  maximaleTiefe: number;
  /** Seiten-IDs, deren Kette mindestens einen Vorfahren ohne ID enthält. */
  fehlendeId: string[];
  /** Seiten-IDs, die in ihrer eigenen Kette stehen oder einen Vorfahren doppelt führen. */
  zyklus: string[];
  /** Seiten-IDs, die in dieser Sammlung mehr als einmal vorkommen (je ID einmal genannt). */
  doppelteId: string[];
  /** Seiten-IDs, deren direkter Elternteil in dieser Sammlung fehlt. */
  verwaisterElternteil: string[];
}

/**
 * Wertet die Ahnenketten einer eingesammelten Seitenmenge aus. Reine Funktion, keine Nebenwirkung.
 *
 * Die Reihenfolge der gemeldeten IDs folgt der Liefer-Reihenfolge — ein Befund soll zwischen zwei
 * Läufen über denselben Bestand gleich aussehen.
 */
export function hierarchieBefund(pages: readonly ConfluencePage[]): ConfluenceHierarchieBefund {
  const vorhandeneIds = new Set(pages.map((p) => p.id?.trim()).filter((id): id is string => !!id));
  const gesehen = new Set<string>();
  const doppelteId: string[] = [];
  const fehlendeId: string[] = [];
  const zyklus: string[] = [];
  const verwaisterElternteil: string[] = [];
  let mitKette = 0;
  let wurzeln = 0;
  let maximaleTiefe = 0;

  for (const page of pages) {
    const id = page.id?.trim() ?? "";
    if (id) {
      if (gesehen.has(id) && !doppelteId.includes(id)) {
        doppelteId.push(id);
      }
      gesehen.add(id);
    }
    if (!Array.isArray(page.ancestors) || page.ancestors.length === 0) {
      wurzeln += 1;
      continue;
    }
    const befund = confluenceAhnenBefund(page);
    if (befund === "fehlende-id") {
      fehlendeId.push(id);
      continue; // ohne Kette lässt sich weder Tiefe noch Elternteil bestimmen
    }
    if (befund === "zyklus") {
      zyklus.push(id);
    }
    const kette = confluenceAncestorIds(page);
    if (!kette) {
      continue;
    }
    mitKette += 1;
    maximaleTiefe = Math.max(maximaleTiefe, kette.length);
    const elternteil = kette[kette.length - 1];
    if (elternteil !== undefined && !vorhandeneIds.has(elternteil)) {
      verwaisterElternteil.push(id);
    }
  }

  return {
    seiten: pages.length,
    mitKette,
    wurzeln,
    maximaleTiefe,
    fehlendeId,
    zyklus,
    doppelteId,
    verwaisterElternteil,
  };
}

export class ConfluenceSourceAdapter implements SourceAdapter {
  readonly source = "Confluence";

  constructor(
    private readonly client: ConfluenceRestClient,
    private readonly mapOpts: ConfluenceMapOptions,
  ) {}

  async collect(): Promise<ImportItem[]> {
    const pages = await this.client.listPages();
    return pages.map((page) => mapConfluencePageToImportItem(page, this.mapOpts));
  }

  // SCRUM-510 WP2: liest den GESAMTEN Space (Cursor-Pagination) und mappt jede Seite EINZELN. Scheitert
  // das Mapping einer Seite, wird sie als `failed` verbucht und der Lauf läuft weiter (never block).
  async collectAll(): Promise<CollectResult> {
    // JOB 2683 D2: der Abbruchgrund reist mit — bis hierher blieb er im Client hängen.
    const { pages, truncated, abbruch } = await this.client.listAllPages();
    const items: ImportItem[] = [];
    const failed: CollectResult["failed"] = [];
    for (const page of pages) {
      try {
        items.push(mapConfluencePageToImportItem(page, this.mapOpts));
      } catch (err) {
        failed.push({
          ref: page.id || page.title || "(unbekannt)",
          error: err instanceof Error ? err.message : "Mapping fehlgeschlagen",
          errorClass: err instanceof Error ? err.name : "unknown",
        });
      }
    }
    // JOB 1042 D3: der Befund wird über die GELIEFERTEN Seiten gebildet, nicht über die erfolgreich
    // gemappten. Eine Seite, deren Mapping scheitert, hat trotzdem eine Ahnenkette — und gerade sie
    // will man im Befund sehen.
    return {
      items,
      failed,
      truncated,
      hierarchie: hierarchieBefund(pages),
      ...(abbruch ? { abbruch } : {}),
    };
  }
}

function isConfluenceImportEnabled(env: Record<string, string | undefined>): boolean {
  const flag = env.KLARWERK_CONFLUENCE_IMPORT;
  return flag === "1" || flag === "true";
}

// Baut den Adapter aus einem fertigen Client (nicht-geheime baseUrl/spaceKey für die Provenienz).
function adapterFromClient(client: ConfluenceRestClient): ConfluenceSourceAdapter {
  return new ConfluenceSourceAdapter(client, {
    baseUrl: client.baseUrl,
    spaceKey: client.spaceKey,
  });
}

// SCRUM-510/515 (Flag + inerter Trigger): baut den Adapter NUR, wenn das Flag KLARWERK_CONFLUENCE_IMPORT
// AN ist UND die Confluence-Credentials/Space vollständig + https konfiguriert sind. Ist das Flag AUS
// (Default), fehlt die Config oder ist baseUrl nicht https, gibt es keinen Adapter (undefined) → es
// existiert KEIN aktiver Import-Pfad. Der Token wird dabei nie als Wert nach außen gereicht (R2a).
export function createConfluenceAdapterFromEnv(
  env: Record<string, string | undefined> = process.env,
): ConfluenceSourceAdapter | undefined {
  if (!isConfluenceImportEnabled(env)) {
    return undefined;
  }
  const client = confluenceClientFromEnv(env);
  return client ? adapterFromClient(client) : undefined;
}

// Test-/Wiederverwendungs-Einstieg mit injizierbarem fetchFn. Nimmt eine token-tragende Config und ist
// daher BEWUSST modul-intern (nicht über die Paket-index exportiert) — von außen führt der einzige Weg
// über createConfluenceAdapterFromEnv (env→Client, Token in der Closure).
export function adapterFromConfig(config: ConfluenceRestConfig): ConfluenceSourceAdapter {
  return adapterFromClient(new ConfluenceRestClient(config));
}
