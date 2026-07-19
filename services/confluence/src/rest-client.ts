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

  // SCRUM-510-R3 (WP4): zentrale Redaction für JEDEN Fehlertext, der aus dem Request-Bauer propagiert/
  // geloggt werden könnte. Ein fetch-Reject/Timeout/Parse-Fehler kann in Message ODER Stack die
  // Ziel-URL, einen credential-tragenden URL-Teil oder (theoretisch) den Token/Basic-Auth-Wert führen —
  // hier wird all das entfernt, BEVOR es diese Klasse verlässt. Wir kennen unsere eigenen Geheimnisse
  // (Token + Basic-Auth-Base64) und ersetzen sie hart; zusätzlich wird jeder `user:pass@host`-Anteil
  // generisch entschärft. Idempotent auf bereits sauberem Text.
  private redactSecrets(text: string): string {
    let out = text;
    const token = this.config.apiToken;
    if (token) {
      out = out.split(token).join("[redacted-token]");
    }
    const auth = this.authHeader(); // "Basic <base64(email:token)>"
    const b64 = auth.slice("Basic ".length);
    if (b64) {
      out = out.split(auth).join("[redacted]").split(b64).join("[redacted]");
    }
    // Credential-tragende URLs (userinfo@host) generisch entschärfen — auch für fremde/unerwartete Werte.
    out = out.replace(/(https?:\/\/)[^/\s@]*@/gi, "$1[redacted]@");
    return out;
  }

  // SCRUM-510-R3 (WP4): erzeugt aus einem beliebigen gefangenen Fehler eine NEUE, redigierte Fehlermeldung
  // — mit eigenem, sauberem Stack (der Original-Fehler wird NICHT als `cause` angehängt, dessen Message/
  // Stack könnten das Geheimnis noch tragen). So ist der propagierte Fehler garantiert leck-frei.
  private redactedError(prefix: string, err: unknown): Error {
    const raw = err instanceof Error ? err.message : String(err);
    return new Error(`${prefix}: ${this.redactSecrets(raw)}`);
  }

  // Nicht-geheime Config nach außen (für den Mapper: Provenienz-URL + Kategorie). KEIN Token-Getter.
  get baseUrl(): string {
    return this.config.baseUrl.replace(/\/+$/, "");
  }
  get spaceKey(): string {
    return this.config.spaceKey;
  }

  // R2a: die gepinnte Origin aus der konfigurierten baseUrl. Nicht-https/ungültig ⇒ Abbruch VOR jedem
  // Netzcall (kein Token an einen unverschlüsselten/fremden Host).
  private allowedOrigin(): string {
    try {
      const u = new URL(this.baseUrl);
      if (u.protocol !== "https:") {
        throw new Error("plain-http");
      }
      return u.origin;
    } catch {
      throw new Error("Confluence: baseUrl ist nicht https — Abbruch, kein Request.");
    }
  }

  // Zentraler Request-Bauer (WP1/R2a): EIN Ort, an dem Origin-Pin (https + exakte Origin), redirect:error
  // und Basic-Auth erzwungen werden. Jede Confluence-URL läuft hierdurch — kein verstreuter fetch.
  private async getContent(
    url: string,
    allowedOrigin: string,
  ): Promise<{ results: ConfluencePage[]; next: string | null }> {
    assertAllowedConfluenceUrl(url, allowedOrigin); // vor JEDEM Netzcall
    const fetchFn = this.config.fetchFn ?? fetch;
    // SCRUM-510-R3 (WP4): fetch-Reject/Timeout redigiert propagieren — der rohe Fetch-Fehler (dessen
    // Message/Stack die URL/Credentials tragen könnte) verlässt den Request-Bauer NIE unredigiert.
    let res: Response;
    try {
      res = await fetchFn(url, {
        method: "GET",
        headers: { authorization: this.authHeader(), accept: "application/json" },
        redirect: "error", // kein Folgen auf fremde Hosts
      });
    } catch (err) {
      throw this.redactedError("Confluence-Request fehlgeschlagen", err);
    }
    if (!res.ok) {
      // Nur der Status (eine Zahl) — strukturell token-frei.
      throw new Error(`Confluence-API antwortete mit ${res.status}`);
    }
    // SCRUM-510-R3 (WP4): auch ein Parse-Fehler wird redigiert (der JSON-Body/Fehlertext könnte Reste
    // tragen). EIN Ausgang, EIN Redaction-Kontrakt für alle Fehlerklassen dieses Bauers.
    let data: { results?: ConfluencePage[]; _links?: { next?: string } };
    try {
      data = (await res.json()) as { results?: ConfluencePage[]; _links?: { next?: string } };
    } catch (err) {
      throw this.redactedError("Confluence-Antwort nicht lesbar", err);
    }
    return { results: data.results ?? [], next: data._links?.next ?? null };
  }

  private firstUrl(): string {
    const params = new URLSearchParams({
      spaceKey: this.config.spaceKey,
      type: "page",
      status: "current",
      limit: String(this.config.pageLimit ?? 50),
      expand: EXPAND,
    });
    return `${this.baseUrl}/rest/api/content?${params.toString()}`;
  }

  // Liest die ERSTE Ergebnisseite des konfigurierten Space (read-only GET).
  async listPages(): Promise<ConfluencePage[]> {
    return (await this.getContent(this.firstUrl(), this.allowedOrigin())).results;
  }

  // SCRUM-510 WP2: liest den GESAMTEN Space über Cursor-Pagination (folgt _links.next). Jeder Folge-
  // Request geht ausschließlich an die gepinnte Origin (der relative next-Pfad wird mit der Origin
  // präfixiert und erneut assert-geprüft). Harte Iterations-Obergrenze als Sicherheitsnetz gegen
  // fehlerhafte next-Zyklen. redirect:error auf jedem Hop.
  // SCRUM-510 (WP3): der Cap ist ein Sicherheitsnetz — er darf aber nicht STILL enden. Bricht die Schleife
  // ab, obwohl noch ein `next`-Cursor offen ist, wird `truncated: true` gemeldet (der Space wurde NICHT
  // vollständig gelesen). Der Aufrufer macht daraus einen ehrlichen „unvollständig"-Status, nie ein „fertig".
  async listAllPages(maxPages = 500): Promise<{ pages: ConfluencePage[]; truncated: boolean }> {
    const allowedOrigin = this.allowedOrigin();
    const out: ConfluencePage[] = [];
    let url: string | null = this.firstUrl();
    let i = 0;
    for (; url && i < maxPages; i++) {
      const { results, next }: { results: ConfluencePage[]; next: string | null } =
        await this.getContent(url, allowedOrigin);
      out.push(...results);
      // WP-E (19.07.2026): Atlassian Cloud liefert next RELATIV ZUM KONTEXTPFAD (z. B.
      // /rest/api/content?...&start=25 — der /wiki-Anteil steckt in _links.base, nicht in next). Nur mit
      // der Origin präfixiert landete Hop 2 auf <origin>/rest/... (Jira-Namensraum → 404/Redirect →
      // Abbruch ab Seite 2). Daher gegen die baseUrl inkl. Kontextpfad auflösen (nextUrl); getContent
      // assert-prüft die gepinnte Origin unverändert vor jedem Hop.
      url = next ? this.nextUrl(next, allowedOrigin) : null;
    }
    // Cap erreicht UND es gäbe noch einen Folge-Cursor → abgeschnitten (unvollständig).
    return { pages: out, truncated: i >= maxPages && url !== null };
  }

  // Setzt den next-Cursor zu einer absoluten URL auf der gepinnten Origin zusammen. Trägt next den
  // Kontextpfad der baseUrl bereits (Altform /wiki/rest/...), reicht die Origin — sonst entstünde
  // /wiki/wiki/... . Sonst (Atlassian-Realform /rest/...) wird die baseUrl inkl. Kontextpfad vorangestellt.
  private nextUrl(next: string, allowedOrigin: string): string {
    const path = next.startsWith("/") ? next : `/${next}`;
    const contextPath = new URL(this.baseUrl).pathname.replace(/\/+$/, "");
    const hasContext =
      contextPath !== "" &&
      (path.startsWith(`${contextPath}/`) || path.startsWith(`${contextPath}?`));
    return hasContext ? `${allowedOrigin}${path}` : `${this.baseUrl}${path}`;
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
