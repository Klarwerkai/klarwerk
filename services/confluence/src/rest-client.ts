// SCRUM-510 (Import-Variante B, Adapter #1) / R2a (Credential-Egress-Härtung, dieselbe Disziplin wie
// 502/514): read-only Confluence-REST-Client, gescoped auf EINEN Space. Nur LESENDE Endpunkte (Seiten +
// Body-Storage + Version + Labels + Read-Restriktionen). Die Credentials (Service-Account + read-only
// API-Token) sind BEWUSST von den Modell-Credentials getrennt (eigene env-Variablen, eigener Namespace).
//
// R2a-Garantien: (1) der apiToken wird nur INNERHALB der Client-Closure aufgelöst und nie zurückgegeben/
// geloggt/in die URL geschrieben — der env→Client-Resolver gibt einen CLIENT zurück, NIE den Token oder
// eine token-tragende Config. (2) HTTPS-Origin-Pinning: jede Anfrage-URL muss https UND identisch zur
// konfigurierten Confluence-Origin sein — plain-http/fremder Host ⇒ Abbruch OHNE Netzcall. (3)
// redirect:"error" ⇒ kein Folgen auf einen fremden Host (kein Token an ein Redirect-Ziel). `fetchFn` ist
// injizierbar → deterministische Fixture-Tests ohne Netz/Live-Token.

// Config INKL. Token — modul-intern (NICHT über die Paket-index re-exportiert). Der Token lebt danach nur
// noch in der privaten Client-Closure.
export interface ConfluenceRestConfig {
  baseUrl: string; // https-Origin des Confluence (z. B. https://acme.atlassian.net/wiki)
  email: string; // Service-Account (read-only)
  apiToken: string; // read-only API-Token — NIE ein Modell-Credential, nie loggen/exportieren/in URL
  spaceKey: string; // gescoped auf EINEN Space (Space K)
  fetchFn?: typeof fetch;
  pageLimit?: number;
}

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
  restrictions?: {
    read?: {
      restrictions?: {
        user?: { results?: unknown[] };
        group?: { results?: unknown[] };
      };
    };
  };
}

const EXPAND =
  "body.storage,version,metadata.labels,restrictions.read.restrictions.user,restrictions.read.restrictions.group";

// R2a: erlaubt genau dann, wenn die URL https ist UND ihre Origin exakt der gepinnten Confluence-Origin
// entspricht. Sonst Abbruch (kein Request). Rein & testbar.
export function assertAllowedConfluenceUrl(url: string, allowedOrigin: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Confluence: ungültige Ziel-URL — Abbruch.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Confluence: nur HTTPS erlaubt (Token-Egress-Schutz) — Abbruch.");
  }
  if (parsed.origin !== allowedOrigin) {
    throw new Error("Confluence: fremde Origin blockiert (Origin-Pinning) — Abbruch.");
  }
}

export class ConfluenceRestClient {
  constructor(private readonly config: ConfluenceRestConfig) {}

  // Basic-Auth aus Service-Account + read-only Token (Confluence-Cloud-Konvention). Bleibt lokal in
  // dieser Methode; der Token wird nie geloggt/zurückgegeben.
  private authHeader(): string {
    const raw = `${this.config.email}:${this.config.apiToken}`;
    return `Basic ${Buffer.from(raw, "utf8").toString("base64")}`;
  }

  // Nicht-geheime Config nach außen (für den Mapper: Provenienz-URL + Kategorie). KEIN Token-Getter.
  get baseUrl(): string {
    return this.config.baseUrl.replace(/\/+$/, "");
  }
  get spaceKey(): string {
    return this.config.spaceKey;
  }

  // Liest die aktuellen Seiten des konfigurierten Space (read-only GET). Erste Ausbaustufe: eine
  // Ergebnisseite bis `pageLimit` (Default 50); Cursor-Pagination ist bewusst Folgearbeit.
  async listPages(): Promise<ConfluencePage[]> {
    const fetchFn = this.config.fetchFn ?? fetch;
    // R2a: Origin aus der konfigurierten baseUrl pinnen; nicht-https/ungültig ⇒ Abbruch vor jedem Call.
    let allowedOrigin: string;
    try {
      const u = new URL(this.baseUrl);
      allowedOrigin = u.origin;
      if (u.protocol !== "https:") {
        throw new Error("plain-http");
      }
    } catch {
      throw new Error("Confluence: baseUrl ist nicht https — Abbruch, kein Request.");
    }
    const params = new URLSearchParams({
      spaceKey: this.config.spaceKey,
      type: "page",
      status: "current",
      limit: String(this.config.pageLimit ?? 50),
      expand: EXPAND,
    });
    const url = `${this.baseUrl}/rest/api/content?${params.toString()}`;
    assertAllowedConfluenceUrl(url, allowedOrigin); // https + Origin-Pin, bevor irgendein Netzcall läuft
    const res = await fetchFn(url, {
      method: "GET",
      headers: { authorization: this.authHeader(), accept: "application/json" },
      // R2a: keinem Redirect auf einen fremden Host folgen (kein Token an ein Redirect-Ziel).
      redirect: "error",
    });
    if (!res.ok) {
      throw new Error(`Confluence-API antwortete mit ${res.status}`);
    }
    const data = (await res.json()) as { results?: ConfluencePage[] };
    return data.results ?? [];
  }
}

// R2a: env→CLIENT (nicht env→Config). Der Token wird HIER gelesen und in die Client-Closure gebunden —
// er verlässt diese Funktion nie als Wert. Fehlt eine dedizierte Variable ODER ist baseUrl nicht https,
// gibt es keinen Client (undefined → Import bleibt inaktiv). Modul-intern (nicht über die index re-
// exportiert): von außen ist nur die gecappte Adapter-Factory erreichbar.
export function confluenceClientFromEnv(
  env: Record<string, string | undefined> = process.env,
): ConfluenceRestClient | undefined {
  const baseUrl = env.KLARWERK_CONFLUENCE_BASE_URL;
  const email = env.KLARWERK_CONFLUENCE_USER;
  const apiToken = env.KLARWERK_CONFLUENCE_TOKEN;
  const spaceKey = env.KLARWERK_CONFLUENCE_SPACE;
  if (!baseUrl || !email || !apiToken || !spaceKey) {
    return undefined;
  }
  // R2a: nur HTTPS-Origin — ein plain-http/ungültiger Host ⇒ kein Client (kein Token-Egress an einen
  // unverschlüsselten/fremden Host, strukturell ausgeschlossen).
  try {
    if (new URL(baseUrl).protocol !== "https:") {
      return undefined;
    }
  } catch {
    return undefined;
  }
  const limit = Number(env.KLARWERK_CONFLUENCE_PAGE_LIMIT);
  return new ConfluenceRestClient({
    baseUrl,
    email,
    apiToken,
    spaceKey,
    ...(Number.isInteger(limit) && limit > 0 ? { pageLimit: limit } : {}),
  });
}
