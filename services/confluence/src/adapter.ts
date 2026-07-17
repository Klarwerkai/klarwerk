// SCRUM-510: Confluence als Adapter #1 des quell-agnostischen Import-Vertrags (SourceAdapter). Der
// Adapter liest die Space-Seiten (read-only REST) und liefert normalisierte ImportItems — der Import-
// Kern (createImportCandidates → acceptToKo) kennt die Quelle nicht. Eine spätere Quelle (Jira-TEST,
// Adapter #2) ist NUR ein weiterer SourceAdapter, kein Umbau dieses Pfads.

import type { ImportItem, SourceAdapter } from "../../library-analytics";
import { type ConfluenceMapOptions, mapConfluencePageToImportItem } from "./mapper";
import {
  ConfluenceRestClient,
  type ConfluenceRestConfig,
  confluenceRestConfigFromEnv,
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

// SCRUM-510/515 (Flag + inerter Trigger): baut den Adapter NUR, wenn das Flag KLARWERK_CONFLUENCE_IMPORT
// AN ist UND die Confluence-Credentials/Space vollständig konfiguriert sind. Ist das Flag AUS (Default)
// oder fehlt die Config, gibt es keinen Adapter (undefined) → es existiert KEIN aktiver Import-Pfad.
export function createConfluenceAdapterFromEnv(
  env: Record<string, string | undefined> = process.env,
): ConfluenceSourceAdapter | undefined {
  if (!isConfluenceImportEnabled(env)) {
    return undefined;
  }
  const config = confluenceRestConfigFromEnv(env);
  if (!config) {
    return undefined;
  }
  return adapterFromConfig(config);
}

// Baut den Adapter aus einer fertigen Config (Test-/Wiederverwendungs-Einstieg mit injizierbarem fetchFn).
export function adapterFromConfig(config: ConfluenceRestConfig): ConfluenceSourceAdapter {
  return new ConfluenceSourceAdapter(new ConfluenceRestClient(config), {
    baseUrl: config.baseUrl,
    spaceKey: config.spaceKey,
  });
}
