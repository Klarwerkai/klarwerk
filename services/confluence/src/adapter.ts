// SCRUM-510: Confluence als Adapter #1 des quell-agnostischen Import-Vertrags (SourceAdapter). Der
// Adapter liest die Space-Seiten (read-only REST) und liefert normalisierte ImportItems — der Import-
// Kern (createImportCandidates → acceptToKo) kennt die Quelle nicht. Eine spätere Quelle (Jira-TEST,
// Adapter #2) ist NUR ein weiterer SourceAdapter, kein Umbau dieses Pfads.
//
// R2a (Encapsulation): nach außen (Paket-index) ist NUR createConfluenceAdapterFromEnv erreichbar — der
// Roh-Client, seine token-tragende Config und der env-Resolver bleiben modul-intern.

import type { ImportItem, SourceAdapter } from "../../library-analytics";
import { type ConfluenceMapOptions, mapConfluencePageToImportItem } from "./mapper";
import {
  ConfluenceRestClient,
  type ConfluenceRestConfig,
  confluenceClientFromEnv,
} from "./rest-client";

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
