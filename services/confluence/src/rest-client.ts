// SCRUM-510 (Import-Variante B, Adapter #1): read-only Confluence-REST-Client, gescoped auf EINEN Space.
// Nur LESENDE Endpunkte (Seiten + Body-Storage + Version + Labels + Read-Restriktionen). Die Credentials
// (Service-Account + read-only API-Token) sind BEWUSST von den Modell-Credentials getrennt (eigene env-
// Variablen, eigener Namespace) und verlassen den Prozess nie: sie bleiben in der Config-Closure, werden
// nie geloggt/exportiert und nie an den Client gegeben. `fetchFn` ist injizierbar → deterministische
// Fixture-Tests ohne Netz und ohne Live-Token.

export interface ConfluenceRestConfig {
  baseUrl: string; // z. B. https://acme.atlassian.net/wiki
  email: string; // Service-Account (read-only)
  apiToken: string; // read-only API-Token — NIE ein Modell-Credential, nie loggen/exportieren
  spaceKey: string; // gescoped auf EINEN Space (Space K)
  fetchFn?: typeof fetch;
  pageLimit?: number;
}

// Nur die für das Mapping benötigten Felder (Confluence-Cloud REST v1, content mit expand). Alles
// optional — der Mapper ist defensiv gegen fehlende Felder.
export interface ConfluenceUser {
  displayName?: string;
}
export interface ConfluencePage {
  id: string;
  title: string;
  type?: string;
  status?: string;
  body?: { storage?: { value?: string } };
  version?: { number?: number; by?: ConfluenceUser };
  _links?: { webui?: string };
  metadata?: { labels?: { results?: { name?: string }[] } };
  // Read-Restriktionen (Space-/Seiten-Governance): sind user- ODER group-Restriktionen gesetzt, gilt die
  // Seite als eingeschränkt → Governance-Signal für die Vertraulichkeit (SCRUM-511).
  restrictions?: {
    read?: {
      restrictions?: {
        user?: { results?: unknown[] };
        group?: { results?: unknown[] };
      };
    };
  };
}

// Die Expand-Felder, die das Mapping braucht (Body + Version + Labels + Read-Restriktionen).
const EXPAND =
  "body.storage,version,metadata.labels,restrictions.read.restrictions.user,restrictions.read.restrictions.group";

export class ConfluenceRestClient {
  constructor(private readonly config: ConfluenceRestConfig) {}

  // Basic-Auth aus Service-Account + read-only Token (Confluence-Cloud-Konvention). Bleibt lokal in
  // dieser Methode; der Token wird nie geloggt.
  private authHeader(): string {
    const raw = `${this.config.email}:${this.config.apiToken}`;
    return `Basic ${Buffer.from(raw, "utf8").toString("base64")}`;
  }

  private get base(): string {
    return this.config.baseUrl.replace(/\/+$/, "");
  }

  // Liest die aktuellen Seiten des konfigurierten Space (read-only GET). Erste Ausbaustufe: eine
  // Ergebnisseite bis `pageLimit` (Default 50); Cursor-Pagination ist bewusst Folgearbeit.
  async listPages(): Promise<ConfluencePage[]> {
    const fetchFn = this.config.fetchFn ?? fetch;
    const params = new URLSearchParams({
      spaceKey: this.config.spaceKey,
      type: "page",
      status: "current",
      limit: String(this.config.pageLimit ?? 50),
      expand: EXPAND,
    });
    const res = await fetchFn(`${this.base}/rest/api/content?${params.toString()}`, {
      method: "GET",
      headers: { authorization: this.authHeader(), accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Confluence-API antwortete mit ${res.status}`);
    }
    const data = (await res.json()) as { results?: ConfluencePage[] };
    return data.results ?? [];
  }
}

// Baut die Config aus dedizierten env-Variablen (getrennt von den Modell-Credentials). Fehlt eine, gibt
// es keinen Client (undefined → Import bleibt inaktiv). Die Werte kommen aus dem Secret/Launcher, nie
// aus dem Code/Repo.
export function confluenceRestConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): ConfluenceRestConfig | undefined {
  const baseUrl = env.KLARWERK_CONFLUENCE_BASE_URL;
  const email = env.KLARWERK_CONFLUENCE_USER;
  const apiToken = env.KLARWERK_CONFLUENCE_TOKEN;
  const spaceKey = env.KLARWERK_CONFLUENCE_SPACE;
  if (!baseUrl || !email || !apiToken || !spaceKey) {
    return undefined;
  }
  const limit = Number(env.KLARWERK_CONFLUENCE_PAGE_LIMIT);
  return {
    baseUrl,
    email,
    apiToken,
    spaceKey,
    ...(Number.isInteger(limit) && limit > 0 ? { pageLimit: limit } : {}),
  };
}
