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
  // R-0166: bei `authMode: "pat"` (Confluence im eigenen Haus) bleibt die Kennung ungenutzt.
  email?: string; // Service-Account (read-only)
  apiToken: string; // read-only API-Token — NIE ein Modell-Credential, nie loggen/exportieren/in URL
  // R-0166: Anmeldeart. "cloud" (Vorgabe) = Basic aus E-Mail + API-Token (Atlassian Cloud);
  // "pat" = Bearer mit Personal Access Token (Confluence Server/Data Center im eigenen Haus).
  authMode?: ConfluenceAuthMode;
  spaceKey: string; // gescoped auf EINEN Space (Space K)
  fetchFn?: typeof fetch;
  pageLimit?: number;
  // JOB 2683 D1 (Review R2-1): Betriebsparameter der Netzgrenzen — Frist je Request, Zeitbudget für den
  // ganzen Space-Lauf, Obergrenze je Antwort. Ohne Angabe gelten die Konstanten darunter.
  timeoutMs?: number;
  totalBudgetMs?: number;
  maxResponseBytes?: number;
}

// ================================================================================================
// R-0166 — DER ANMELDEWEG FÜR CONFLUENCE IM EIGENEN HAUS
// ================================================================================================
//
// Atlassian Cloud meldet sich mit E-Mail + API-Token per Basic an. Confluence Server/Data Center
// (ab 7.9) kennt dafür den Personal Access Token, der als `Authorization: Bearer <PAT>` gesendet
// wird — ohne Kennung. Welcher Weg gilt, entscheidet der Betreiber ausdrücklich über
// `KLARWERK_CONFLUENCE_AUTH`; geraten wird nichts. Ein unbekannter Wert ergibt KEINEN Client
// (fail-closed) statt stillschweigend auf Cloud zurückzufallen. Alle übrigen Riegel (HTTPS,
// Origin-Pinning, redirect:error, Redaction) gelten für beide Wege unverändert.
export type ConfluenceAuthMode = "cloud" | "pat";

export const CONFLUENCE_AUTH_MODES: readonly ConfluenceAuthMode[] = ["cloud", "pat"];

/**
 * Liest die Anmeldeart aus dem Wert von `KLARWERK_CONFLUENCE_AUTH`. Leer/ungesetzt = "cloud"
 * (heutiges Verhalten). `undefined` = ein Wert, den es nicht gibt — der Aufrufer baut dann nichts.
 */
export function confluenceAuthModeFrom(raw: string | undefined): ConfluenceAuthMode | undefined {
  const wert = (raw ?? "").trim().toLowerCase();
  if (wert === "") {
    return "cloud";
  }
  return (CONFLUENCE_AUTH_MODES as readonly string[]).includes(wert)
    ? (wert as ConfluenceAuthMode)
    : undefined;
}

// ================================================================================================
// JOB 2683 D1 (Review EXT1-20260828, Befund R2-1) — DER KNOPF, DER NIE AUFHÖRT ZU DREHEN.
// ================================================================================================
//
// DER BEFUND: `fetchFn(url, …)` lief ohne `signal`, ohne Frist, ohne Größenkante; `res.json()` las den
// Body unbegrenzt. Node/undici bricht erst nach 300 s Stille ab, `listAllPages` macht bis zu 500 solcher
// Aufrufe nacheinander — eine hängende Confluence-Instanz hielt „Erkunden" bis zu 500 × 5 Minuten fest,
// und weil die Route den Scan als geteilte Promise cached, warteten alle Admins an derselben Zusage.
//
// DREI GRENZEN, jede als benannter Betriebsparameter:
//   1. FRIST JE REQUEST (`CONFLUENCE_REQUEST_TIMEOUT_MS`): Verbindung UND Body. Sie gilt auch dann, wenn
//      ein fetch das Abort-Signal ignoriert — die Frist wird gegen den Aufruf GERACET, nicht nur gesetzt.
//   2. ZEITBUDGET JE LAUF (`CONFLUENCE_TOTAL_BUDGET_MS`): `listAllPages` liest keinen weiteren Cursor mehr,
//      wenn das Budget verbraucht ist, und meldet `truncated` mit Grund.
//   3. GRÖSSE JE ANTWORT (`CONFLUENCE_MAX_RESPONSE_BYTES`): `content-length` vorab, gelesene Bytes beim
//      Streamen — wird die Kante gerissen, wird die Antwort verworfen, nicht der Prozessspeicher.
//
// EINE LANGSAME ERGEBNISSEITE TÖTET DEN LAUF NICHT: scheitert ein Folge-Request an Frist oder Größe,
// behält `listAllPages` die bereits gelesenen Seiten und meldet `truncated: true` samt `abbruch` — der
// Aufrufer macht daraus ehrlich „unvollständig", nie „fertig". Nur wenn schon der ERSTE Request
// scheitert, gibt es nichts zu behalten; dann wirft der Client (die Route antwortet dann in Sekunden
// mit einem klaren Fehler statt nie).
//
// KEIN HOST, KEINE URL IN DEN MELDUNGEN: die Fehlertexte dieser Klasse nennen nur Grund und Grenze;
// die Redaction für fremde Fehlertexte (`redactSecrets`) bleibt davon unberührt.
export const CONFLUENCE_REQUEST_TIMEOUT_MS = 15_000;
export const CONFLUENCE_TOTAL_BUDGET_MS = 180_000;
export const CONFLUENCE_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

export type ConfluenceAbbruchGrund = "timeout" | "zu_gross" | "zeitbudget";

function dauerText(ms: number): string {
  return ms >= 1000 ? `${Math.round(ms / 1000)} s` : `${ms} ms`;
}

function abbruchMeldung(grund: ConfluenceAbbruchGrund, wert: number): string {
  switch (grund) {
    case "timeout":
      return `Confluence antwortet nicht — Zeitüberschreitung nach ${dauerText(wert)}.`;
    case "zu_gross":
      return `Confluence-Antwort zu groß (über ${Math.max(1, Math.round(wert / (1024 * 1024)))} MB) — nicht gelesen.`;
    default:
      return `Confluence-Lesezeit erschöpft nach ${dauerText(wert)} — der Space wurde nicht vollständig gelesen.`;
  }
}

export class ConfluenceRequestError extends Error {
  readonly code: "CONFLUENCE_TIMEOUT" | "CONFLUENCE_RESPONSE_TOO_LARGE" | "CONFLUENCE_BUDGET";
  readonly grund: ConfluenceAbbruchGrund;

  constructor(grund: ConfluenceAbbruchGrund, wert: number) {
    super(abbruchMeldung(grund, wert));
    this.name = "ConfluenceRequestError";
    this.grund = grund;
    this.code =
      grund === "timeout"
        ? "CONFLUENCE_TIMEOUT"
        : grund === "zu_gross"
          ? "CONFLUENCE_RESPONSE_TOO_LARGE"
          : "CONFLUENCE_BUDGET";
  }
}

/**
 * R-0162 (Runde 3): Confluence hat mit Erfolg geantwortet, aber ohne brauchbare Seite. Das ist ein
 * unbekannter Zustand — weder „vorhanden" noch „gelöscht".
 */
export class ConfluenceUnusableResponseError extends Error {
  readonly code = "CONFLUENCE_UNUSABLE_RESPONSE";

  constructor(was: "Seite" | "Anhangsliste" = "Seite") {
    super(
      was === "Seite"
        ? "Confluence-Antwort ohne Seiten-Id — Zustand der Seite unbekannt."
        : "Confluence-Antwort ist keine Anhangsliste — Anhänge der Seite unbekannt.",
    );
    this.name = "ConfluenceUnusableResponseError";
  }
}

/**
 * R-0163 (Lauf 2): ist `data` eine brauchbare Anhangsliste? `results` muss eine Liste sein und jeder
 * Eintrag eine nicht leere Kennung tragen — sonst lässt sich nicht sagen, welche Anhänge es gibt.
 */
export function istAnhangsliste(
  data: unknown,
): data is { results: ConfluenceAttachment[]; _links?: { next?: unknown } } {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const results = (data as { results?: unknown }).results;
  return (
    Array.isArray(results) &&
    results.every(
      (a) =>
        typeof a === "object" &&
        a !== null &&
        typeof (a as { id?: unknown }).id === "string" &&
        (a as { id: string }).id.trim() !== "",
    )
  );
}

/** Warum ein Space-Lauf vor dem letzten Cursor endete — reist mit `truncated: true`. */
export interface ConfluenceAbbruch {
  readonly grund: ConfluenceAbbruchGrund;
  /** Wie viele Seiten bis zum Abbruch gelesen wurden (und behalten werden). */
  readonly nachSeiten: number;
  readonly meldung: string;
}

export interface ConfluenceListAllResult {
  pages: ConfluencePage[];
  truncated: boolean;
  abbruch?: ConfluenceAbbruch;
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
  // IC-1: `when` = ISO-Zeitstempel der letzten Version (Confluence liefert es im `version`-Expand mit)
  // → Provenienz-Datum für die Read-only-Erkundung (updatedAt am ImportItem).
  version?: { number?: number; by?: ConfluenceUser; when?: string };
  _links?: { webui?: string };
  metadata?: { labels?: { results?: { name?: string }[] } };
  // AUFTRAG-mega27 A1: die ELTERNKETTE der Seite. Confluence liefert sie im `ancestors`-Expand
  // bereits in Quell-Reihenfolge (Wurzel zuerst, direkter Elternteil zuletzt) und OHNE die Seite
  // selbst. BEWUSST OHNE Unter-Expand (kein `ancestors.body`, kein `ancestors.version`): jeder
  // Ahne trägt dann nur seine Basisfelder — für Titel und Ordnung ist genau das nötig, mehr wäre
  // Antwortgröße ohne Gegenwert. Wir lesen davon nur id + title.
  ancestors?: { id?: string; title?: string }[];
  restrictions?: {
    read?: {
      restrictions?: {
        // R-0549: Cloud liefert je Benutzer `accountId`, Server/Data Center `username`/`userKey`;
        // je Gruppe `name`. Weitere Felder werden nicht gelesen.
        user?: {
          results?: { accountId?: string; username?: string; userKey?: string }[] | unknown[];
        };
        group?: { results?: { name?: string }[] | unknown[] };
      };
    };
  };
  // R-0163: die Anhänge der Seite (Expand `children.attachment`). `_links.next` heisst: es gibt
  // mehr, als diese Antwort trägt.
  children?: {
    attachment?: { results?: ConfluenceAttachment[]; _links?: { next?: string } };
  };
}

/** R-0163: ein Anhang, wie `/rest/api/content/{id}/child/attachment` ihn liefert. */
export interface ConfluenceAttachment {
  id?: string;
  title?: string;
  metadata?: { mediaType?: string };
  extensions?: { mediaType?: string; fileSize?: number };
  _links?: { download?: string };
}

// AUFTRAG-mega27 A1: `ancestors` kommt MINIMAL dazu — ohne jeden Unter-Expand. Die Elternkette ist
// die einzige Quelle einer echten Ordnerstruktur; sie verließ Confluence bisher nie, deshalb konnte
// die Auswahl nur abgeleitete Merkmale (Sprache/Thema) bündeln. Paginierung und der Abbruch mit
// `truncated` (listAllPages) bleiben davon unberührt — der Expand ändert nur den Inhalt je Seite.
// R-0163: `children.attachment` liefert die Anhangsliste der Seite ohne zusätzlichen Aufruf je Seite
// (nur Metadaten: Name, Typ, Größe, Abrufpfad — keine Dateiinhalte).
const EXPAND =
  "body.storage,version,metadata.labels,ancestors,restrictions.read.restrictions.user,restrictions.read.restrictions.group,children.attachment";

/**
 * R-0163: Obergrenze der nachgeblätterten Anhangsseiten je Quellseite (Sicherheitsnetz gegen eine
 * endlose `next`-Kette). Lauf 3 R3 (Bens B9): 200 Seiten zu je 50 = bis zu 10.000 Anhänge je
 * Quellseite — abgestimmt auf den Deckel der Eingangssäuberung
 * (`MAX_QUELL_ANHAENGE`, `services/library-analytics/src/quellangaben.ts`), damit kein lokaler Deckel
 * UNTER dem liegt, was dieser Adapter liefert. Wird die Grenze erreicht, gilt die Liste als
 * unvollständig (`complete: false`) und der Lauf weist die Seite aus.
 */
const MAX_ATTACHMENT_HOPS = 200;

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

  // Basic-Auth aus Service-Account + read-only Token (Confluence-Cloud-Konvention) oder — R-0166 —
  // Bearer mit Personal Access Token (Server/Data Center). Bleibt lokal in dieser Methode; der Token
  // wird nie geloggt/zurückgegeben.
  private authHeader(): string {
    if (this.config.authMode === "pat") {
      return `Bearer ${this.config.apiToken}`;
    }
    const raw = `${this.config.email ?? ""}:${this.config.apiToken}`;
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
    // "Basic <base64(email:token)>" bzw. "Bearer <PAT>" — beides samt Nutzlast entfernen.
    const auth = this.authHeader();
    const nutzlast = auth.slice(auth.indexOf(" ") + 1);
    if (nutzlast) {
      out = out.split(auth).join("[redacted]").split(nutzlast).join("[redacted]");
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
    const data = (await this.getJson(url, allowedOrigin)) as {
      results?: ConfluencePage[];
      _links?: { next?: string };
    };
    return { results: data?.results ?? [], next: data?._links?.next ?? null };
  }

  /**
   * JOB 2691 D1: der EINE Netzweg dieses Clients — bisher lag er in `getContent`, jetzt liegt er
   * hier, damit das Nachladen einer einzelnen Seite (`getPageById`) DENSELBEN Origin-Pin, dieselbe
   * Frist und Groessengrenze (2683), `redirect:error` und dieselbe Redaction bekommt und nicht eine
   * zweite, abweichende Kopie. `nichtGefundenIstLeer`: ein 404 ist beim Nachladen einer Seite eine
   * Antwort („inzwischen geloescht"), kein Fehler — beim Space-Listing bleibt jeder Nicht-2xx ein
   * Fehler.
   */
  private async getJson(
    url: string,
    allowedOrigin: string,
    opts: { nichtGefundenIstLeer?: boolean } = {},
  ): Promise<unknown> {
    assertAllowedConfluenceUrl(url, allowedOrigin); // vor JEDEM Netzcall
    const fetchFn = this.config.fetchFn ?? fetch;
    const timeoutMs = this.config.timeoutMs ?? CONFLUENCE_REQUEST_TIMEOUT_MS;
    const maxBytes = this.config.maxResponseBytes ?? CONFLUENCE_MAX_RESPONSE_BYTES;
    // JOB 2683 D1: EINE Frist für Verbindung und Body. Der Controller geht als `signal` an fetch (undici
    // bricht dann sauber ab); zusätzlich wird der Aufruf gegen die Frist GERACET — ein fetch, das das
    // Signal nicht kennt (Fixture, fremde Implementierung), kann den Aufrufer trotzdem nicht festhalten.
    const controller = new AbortController();
    let abgelaufen = false;
    const timer = setTimeout(() => {
      abgelaufen = true;
      controller.abort();
    }, timeoutMs);
    const frist = new Promise<never>((_, reject) => {
      controller.signal.addEventListener(
        "abort",
        () => reject(new ConfluenceRequestError("timeout", timeoutMs)),
        { once: true },
      );
    });
    try {
      // SCRUM-510-R3 (WP4): fetch-Reject/Timeout redigiert propagieren — der rohe Fetch-Fehler (dessen
      // Message/Stack die URL/Credentials tragen könnte) verlässt den Request-Bauer NIE unredigiert.
      let res: Response;
      try {
        res = await Promise.race([
          fetchFn(url, {
            method: "GET",
            headers: { authorization: this.authHeader(), accept: "application/json" },
            redirect: "error", // kein Folgen auf fremde Hosts
            signal: controller.signal,
          }),
          frist,
        ]);
      } catch (err) {
        if (err instanceof ConfluenceRequestError || abgelaufen) {
          throw new ConfluenceRequestError("timeout", timeoutMs);
        }
        throw this.redactedError("Confluence-Request fehlgeschlagen", err);
      }
      if (res.status === 404 && opts.nichtGefundenIstLeer) {
        return undefined;
      }
      if (!res.ok) {
        // Nur der Status (eine Zahl) — strukturell token-frei.
        throw new Error(`Confluence-API antwortete mit ${res.status}`);
      }
      // SCRUM-510-R3 (WP4): auch ein Parse-Fehler wird redigiert (der JSON-Body/Fehlertext könnte Reste
      // tragen). EIN Ausgang, EIN Redaction-Kontrakt für alle Fehlerklassen dieses Bauers.
      // JOB 2683 D1: der Body wird begrenzt gelesen und steht unter derselben Frist.
      try {
        return await Promise.race([leseBegrenzt(res, maxBytes), frist]);
      } catch (err) {
        if (err instanceof ConfluenceRequestError) {
          throw err;
        }
        if (abgelaufen) {
          throw new ConfluenceRequestError("timeout", timeoutMs);
        }
        throw this.redactedError("Confluence-Antwort nicht lesbar", err);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * JOB 2691 D1 (Befund R2-2): EINE Seite mit vollem Expand — der Volltext (`body.storage`) wird
   * nicht mehr im Snapshot gehalten, sondern beim Anwenden je Id hier nachgeladen. `undefined`,
   * wenn die Seite inzwischen nicht mehr existiert (404).
   */
  async getPageById(pageId: string): Promise<ConfluencePage | undefined> {
    const url = `${this.baseUrl}/rest/api/content/${encodeURIComponent(pageId)}?expand=${encodeURIComponent(EXPAND)}`;
    const data = await this.getJson(url, this.allowedOrigin(), { nichtGefundenIstLeer: true });
    // NUR eine 404 heisst „gibt es nicht" (`undefined`). R-0162 (Runde 3): eine 2xx-Antwort ohne
    // brauchbare Seiten-Id ist KEIN Beleg für eine Löschung, sondern eine unbrauchbare Antwort —
    // sie wirft, damit weder der Löschabgleich noch das Anwenden daraus „gelöscht" macht.
    if (data === undefined) {
      return undefined;
    }
    const id = typeof data === "object" && data ? (data as { id?: unknown }).id : undefined;
    if (typeof id !== "string" || id.trim() === "") {
      throw new ConfluenceUnusableResponseError();
    }
    return data as ConfluencePage;
  }

  /**
   * R-0163: ALLE Anhänge einer Seite, über `_links.next` nachgeblättert — derselbe Netzweg wie jeder
   * andere Abruf (Origin-Pin, Frist, Größengrenze, Redaction). `complete: false`, wenn die
   * Obergrenze griff.
   *
   * Lauf 2 (Befund Ben, Runde 3 von Lauf 1): eine Antwort zählt nur, wenn sie wirklich eine
   * Anhangsliste ist — ein Objekt mit `results` als Liste, jeder Eintrag mit Kennung. Alles andere
   * (auch eine Erfolgsantwort `{}` oder eine 404 für eine Seite, die gerade noch gelesen wurde) ist
   * ein UNBEKANNTER Zustand und wirft `ConfluenceUnusableResponseError`; der Adapter behält dann die
   * Teilliste mit Unvollständig-Marke, und die Annahme entfernt keine bestehende Anhangsquelle.
   */
  async listAttachments(
    pageId: string,
  ): Promise<{ attachments: ConfluenceAttachment[]; complete: boolean }> {
    const allowedOrigin = this.allowedOrigin();
    const out: ConfluenceAttachment[] = [];
    let url: string | null =
      `${this.baseUrl}/rest/api/content/${encodeURIComponent(pageId)}/child/attachment?limit=50`;
    let hops = 0;
    for (; url && hops < MAX_ATTACHMENT_HOPS; hops++) {
      const data = await this.getJson(url, allowedOrigin);
      if (!istAnhangsliste(data)) {
        throw new ConfluenceUnusableResponseError("Anhangsliste");
      }
      out.push(...data.results);
      const next = data._links?.next;
      url = typeof next === "string" && next !== "" ? this.nextUrl(next, allowedOrigin) : null;
    }
    return { attachments: out, complete: url === null };
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
  // JOB 2683 D1 (R2-1): dazu ein ZEITBUDGET für den ganzen Lauf und die Regel „eine langsame
  // Ergebnisseite tötet den Lauf nicht": scheitert ein FOLGE-Request an Frist oder Größe, bleiben die
  // gelesenen Seiten erhalten und `truncated` trägt den Grund (`abbruch`). Scheitert der ERSTE Request,
  // wird geworfen — es gibt nichts zu behalten, und ein leeres „unvollständig" wäre eine Lüge.
  async listAllPages(maxPages = 500): Promise<ConfluenceListAllResult> {
    const allowedOrigin = this.allowedOrigin();
    const budgetMs = this.config.totalBudgetMs ?? CONFLUENCE_TOTAL_BUDGET_MS;
    const start = Date.now();
    const out: ConfluencePage[] = [];
    let url: string | null = this.firstUrl();
    let i = 0;
    let abbruch: ConfluenceAbbruch | undefined;
    for (; url && i < maxPages; i++) {
      if (i > 0 && Date.now() - start >= budgetMs) {
        abbruch = {
          grund: "zeitbudget",
          nachSeiten: out.length,
          meldung: abbruchMeldung("zeitbudget", budgetMs),
        };
        break;
      }
      let results: ConfluencePage[];
      let next: string | null;
      try {
        ({ results, next } = await this.getContent(url, allowedOrigin));
      } catch (err) {
        if (i > 0 && err instanceof ConfluenceRequestError) {
          abbruch = { grund: err.grund, nachSeiten: out.length, meldung: err.message };
          break;
        }
        throw err;
      }
      out.push(...results);
      // WP-E (19.07.2026): Atlassian Cloud liefert next RELATIV ZUM KONTEXTPFAD (z. B.
      // /rest/api/content?...&start=25 — der /wiki-Anteil steckt in _links.base, nicht in next). Nur mit
      // der Origin präfixiert landete Hop 2 auf <origin>/rest/... (Jira-Namensraum → 404/Redirect →
      // Abbruch ab Seite 2). Daher gegen die baseUrl inkl. Kontextpfad auflösen (nextUrl); getContent
      // assert-prüft die gepinnte Origin unverändert vor jedem Hop.
      url = next ? this.nextUrl(next, allowedOrigin) : null;
    }
    // Cap erreicht UND es gäbe noch einen Folge-Cursor → abgeschnitten (unvollständig). Ebenso jeder
    // Abbruch durch Frist, Größe oder Budget.
    const truncated = (i >= maxPages && url !== null) || abbruch !== undefined;
    return { pages: out, truncated, ...(abbruch ? { abbruch } : {}) };
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
  // R-0166: unbekannte Anmeldeart ⇒ kein Client. Die Kennung ist nur für "cloud" Pflicht.
  const authMode = confluenceAuthModeFrom(env.KLARWERK_CONFLUENCE_AUTH);
  if (!authMode || !baseUrl || !apiToken || !spaceKey || (authMode === "cloud" && !email)) {
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
  // JOB 2683 D1: die Netzgrenzen sind Betriebsparameter — überschreibbar, nie abschaltbar (nur positive
  // ganze Zahlen zählen; alles andere fällt auf die Konstanten zurück).
  const timeoutMs = Number(env.KLARWERK_CONFLUENCE_TIMEOUT_MS);
  const budgetMs = Number(env.KLARWERK_CONFLUENCE_BUDGET_MS);
  return new ConfluenceRestClient({
    baseUrl,
    ...(authMode === "cloud" && email ? { email } : {}),
    apiToken,
    spaceKey,
    authMode,
    ...(Number.isInteger(limit) && limit > 0 ? { pageLimit: limit } : {}),
    ...(Number.isInteger(timeoutMs) && timeoutMs > 0 ? { timeoutMs } : {}),
    ...(Number.isInteger(budgetMs) && budgetMs > 0 ? { totalBudgetMs: budgetMs } : {}),
  });
}

// JOB 2683 D1: Body begrenzt lesen. Drei Stufen, je nachdem, was die Antwort hergibt: `content-length`
// vorab (kein einziges Byte, wenn die Zahl schon zu groß ist), dann der Stream mit laufender Zählung
// (undici/native fetch), sonst — Fixtures ohne Body-Stream — der gewöhnliche `json()`-Weg.
async function leseBegrenzt(res: Response, maxBytes: number): Promise<unknown> {
  const kopf = (res as { headers?: { get?: (name: string) => string | null } }).headers;
  const angekuendigt = Number(kopf?.get?.("content-length"));
  if (Number.isFinite(angekuendigt) && angekuendigt > maxBytes) {
    throw new ConfluenceRequestError("zu_gross", maxBytes);
  }
  const body = (res as { body?: ReadableStream<Uint8Array> | null }).body;
  if (body && typeof body.getReader === "function") {
    const reader = body.getReader();
    const chunks: Buffer[] = [];
    let gelesen = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        gelesen += value.byteLength;
        if (gelesen > maxBytes) {
          await reader.cancel().catch(() => undefined);
          throw new ConfluenceRequestError("zu_gross", maxBytes);
        }
        chunks.push(Buffer.from(value));
      }
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  }
  return res.json();
}
