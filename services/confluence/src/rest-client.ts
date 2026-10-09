// SCRUM-510 (Import-Variante B, Adapter #1) / R2a (Credential-Egress-Härtung, dieselbe Disziplin wie
// 502/514): read-only Confluence-REST-Client, gescoped auf EINEN Space. Nur LESENDE Endpunkte (Seiten +
// Body-Storage + Version + Labels + Read-Restriktionen; R-0163: Anhangsliste + Anhangsdownload einer
// Seite). Die Credentials (Service-Account + read-only
// API-Token) sind BEWUSST von den Modell-Credentials getrennt (eigene env-Variablen, eigener Namespace).
//
// R2a-Garantien: (1) der apiToken wird nur INNERHALB der Client-Closure aufgelöst und nie zurückgegeben/
// geloggt/in die URL geschrieben — der env→Client-Resolver gibt einen CLIENT zurück, NIE den Token oder
// eine token-tragende Config. (2) HTTPS-Origin-Pinning: jede Anfrage-URL muss https UND identisch zur
// konfigurierten Confluence-Origin sein — plain-http/fremder Host ⇒ Abbruch OHNE Netzcall. (3)
// redirect:"error" ⇒ kein Folgen auf einen fremden Host (kein Token an ein Redirect-Ziel). `fetchFn` ist
// injizierbar → deterministische Fixture-Tests ohne Netz/Live-Token.

import { type ConfluenceAuthMode, confluenceAuthMode } from "./credential-state";

// Config INKL. Token — modul-intern (NICHT über die Paket-index re-exportiert). Der Token lebt danach nur
// noch in der privaten Client-Closure.
export interface ConfluenceRestConfig {
  baseUrl: string; // https-Origin des Confluence (z. B. https://acme.atlassian.net/wiki)
  // R-0166: "cloud" (Standard) = Basic aus email + apiToken; "pat" = selbst betriebenes Confluence
  // (Data Center/Server) mit persönlichem Zugriffstoken als Bearer, ohne Kennung.
  authMode?: ConfluenceAuthMode;
  email?: string; // Service-Account (read-only) — nur beim Cloud-Weg
  apiToken: string; // read-only API-Token bzw. PAT — NIE ein Modell-Credential, nie loggen/exportieren/in URL
  spaceKey: string; // gescoped auf EINEN Space (Space K)
  fetchFn?: typeof fetch;
  pageLimit?: number;
  // JOB 2683 D1 (Review R2-1): Betriebsparameter der Netzgrenzen — Frist je Request, Zeitbudget für den
  // ganzen Space-Lauf, Obergrenze je Antwort. Ohne Angabe gelten die Konstanten darunter.
  timeoutMs?: number;
  totalBudgetMs?: number;
  maxResponseBytes?: number;
  // R-0163: Obergrenze je heruntergeladenem Anhang (Rohbytes). Ohne Angabe gilt die Konstante unten.
  maxAttachmentBytes?: number;
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
// R-0163: ein Anhang ist Rohinhalt, keine JSON-Antwort — eigene Kante. 20 MB entsprechen der
// Werksvorgabe für Anhänge (knowledge-object MAX_ATTACHMENT_BYTES); als Daten-URL (Base64, +33 %)
// bleibt ein solcher Anhang unter der festen Objektspeicher-Grenze von 30 MB.
export const CONFLUENCE_MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

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

// Ein Nicht-2xx-Status. Eigene Klasse nur, damit der Fristweg (`mitFrist`) ihn unverändert
// durchreicht statt ihn als „nicht lesbar" zu verpacken; `name` bleibt bewusst „Error".
class ConfluenceStatusError extends Error {
  /** ADMIN-02: der Status als Zahl, damit der Verbindungstest 401/403/404 unterscheiden kann. */
  readonly status: number;

  constructor(status: number) {
    // Nur der Status (eine Zahl) — strukturell token-frei.
    super(`Confluence-API antwortete mit ${status}`);
    this.status = status;
  }
}

/**
 * ADMIN-02 — was ein gescheiterter Verbindungstest über die Gegenstelle sagt. Erkannt wird an der
 * Fehlerklasse dieses Moduls (Status als Zahl, Frist), nie am Meldungstext. Alles, was nicht aus
 * diesem Modul stammt oder sich nicht deuten lässt, fällt ehrlich auf „nicht-erreichbar".
 */
export type ConfluenceVerbindungsfehler =
  | "anmeldung-abgewiesen"
  | "keine-berechtigung"
  | "nicht-gefunden"
  | "zeitueberschreitung"
  | "nicht-erreichbar";

export function confluenceVerbindungsfehler(err: unknown): ConfluenceVerbindungsfehler {
  if (err instanceof ConfluenceRequestError) {
    return err.grund === "timeout" || err.grund === "zeitbudget"
      ? "zeitueberschreitung"
      : "nicht-erreichbar";
  }
  if (err instanceof ConfluenceStatusError) {
    if (err.status === 401) {
      return "anmeldung-abgewiesen";
    }
    if (err.status === 403) {
      return "keine-berechtigung";
    }
    if (err.status === 404) {
      return "nicht-gefunden";
    }
  }
  return "nicht-erreichbar";
}

// ================================================================================================
// R-0163 — ZU EINER SEITE GEHÖREN IHRE ANHÄNGE UND BILDER.
// ================================================================================================
//
// Confluence führt Anhänge als Kindinhalte der Seite (`/content/{id}/child/attachment`). Ein Bild
// im Seitentext ist ein solcher Anhang, auf den `<ac:image><ri:attachment ri:filename=…/>` zeigt —
// es gibt keinen zweiten Bildweg. Gelesen werden nur Felder, die der Mapper braucht.
export interface ConfluenceAttachment {
  id: string;
  title: string; // Dateiname
  type?: string;
  status?: string;
  metadata?: { mediaType?: string };
  extensions?: { mediaType?: string; fileSize?: number };
  version?: { number?: number; when?: string };
  // Relativ zum Kontextpfad der baseUrl (Cloud: ohne `/wiki`), wie `_links.next`.
  _links?: { download?: string };
}

export interface ConfluenceAttachmentListResult {
  attachments: ConfluenceAttachment[];
  // true, wenn die Liste NICHT vollständig gelesen wurde (Cap, Frist, Größe, Budget).
  truncated: boolean;
}

export interface ConfluenceAnhangInhalt {
  bytes: Buffer;
  // `content-type` der Antwort ohne Parameter, falls geliefert.
  mime?: string;
}

const WEITERLEITUNG = new Set([301, 302, 303, 307, 308]);

// Ausgang des ersten Download-Hops: entweder der Inhalt oder das Ziel der einen Weiterleitung.
type ErsterHop = { inhalt: ConfluenceAnhangInhalt } | { weiter: string };

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

// R-0162: das 404 des Einzelabrufs als eigener Wert — `undefined`/`null` kann auch aus einem
// (fehlerhaften) 2xx-Body stammen und darf mit „nicht gefunden" nie verwechselt werden.
const NICHT_GEFUNDEN: unique symbol = Symbol("confluence-nicht-gefunden");

function istSeite(data: unknown): data is ConfluencePage {
  return !!data && typeof data === "object" && typeof (data as { id?: unknown }).id === "string";
}

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
  // R-0166: beim selbst betriebenen Confluence (authMode "pat") geht das persönliche Zugriffstoken
  // unverändert als Bearer — so verlangt es Confluence Data Center/Server; eine Kennung gibt es dort
  // nicht. Ohne Kennung kein Cloud-Header: ein Basic aus "undefined:<token>" wäre ein Fehlversuch.
  private authHeader(): string {
    if (this.config.authMode === "pat") {
      return `Bearer ${this.config.apiToken}`;
    }
    if (!this.config.email) {
      throw new Error("Confluence: Cloud-Anmeldung ohne Kennung — Abbruch, kein Request.");
    }
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
    // Cloud: "Basic <base64(email:token)>" — die Base64 trägt den Token nur kodiert, also lesbar, und wird
    // eigens ersetzt. Beim Bearer-Weg (R-0166) steht der Token roh im Header; den deckt die Zeile oben.
    if (this.config.authMode !== "pat" && this.config.email) {
      const auth = this.authHeader();
      const b64 = auth.slice("Basic ".length);
      if (b64) {
        out = out.split(auth).join("[redacted]").split(b64).join("[redacted]");
      }
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
  private async getContent<T = ConfluencePage>(
    url: string,
    allowedOrigin: string,
  ): Promise<{ results: T[]; next: string | null }> {
    const data = (await this.getJson(url, allowedOrigin)) as {
      results?: T[];
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
    const maxBytes = this.config.maxResponseBytes ?? CONFLUENCE_MAX_RESPONSE_BYTES;
    return this.mitFrist(
      url,
      {
        method: "GET",
        headers: { authorization: this.authHeader(), accept: "application/json" },
        redirect: "error", // kein Folgen auf fremde Hosts
      },
      async (res) => {
        // R-0162 (main): ein echtes 404 ist ein eigener Wert, nie mit einem leeren 2xx-Body
        // verwechselbar. R-0163: die Prüfung liegt im Lesezweig des gemeinsamen Fristrahmens.
        if (res.status === 404 && opts.nichtGefundenIstLeer) {
          return NICHT_GEFUNDEN;
        }
        if (!res.ok) {
          throw new ConfluenceStatusError(res.status);
        }
        return leseBegrenzt(res, maxBytes);
      },
    );
  }

  /**
   * R-0163: der Frist- und Redaction-Rahmen JEDES Requests dieses Clients, herausgezogen aus
   * `getJson`, damit der Anhangsabruf (`downloadAttachment`) dieselbe Frist, dieselbe Redaction
   * und dieselbe Fehlerklasse bekommt statt einer zweiten, abweichenden Kopie. Origin-Pin und
   * Redirect-Regel setzt der Aufrufer — sie unterscheiden sich zwischen JSON und Rohinhalt.
   */
  private async mitFrist<T>(
    url: string,
    init: RequestInit,
    lesen: (res: Response) => Promise<T>,
  ): Promise<T> {
    const fetchFn = this.config.fetchFn ?? fetch;
    const timeoutMs = this.config.timeoutMs ?? CONFLUENCE_REQUEST_TIMEOUT_MS;
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
        res = await Promise.race([fetchFn(url, { ...init, signal: controller.signal }), frist]);
      } catch (err) {
        if (err instanceof ConfluenceRequestError || abgelaufen) {
          throw new ConfluenceRequestError("timeout", timeoutMs);
        }
        throw this.redactedError("Confluence-Request fehlgeschlagen", err);
      }
      // SCRUM-510-R3 (WP4): auch ein Parse-Fehler wird redigiert (der JSON-Body/Fehlertext könnte Reste
      // tragen). EIN Ausgang, EIN Redaction-Kontrakt für alle Fehlerklassen dieses Bauers.
      // JOB 2683 D1: der Body wird begrenzt gelesen und steht unter derselben Frist.
      try {
        return await Promise.race([lesen(res), frist]);
      } catch (err) {
        if (err instanceof ConfluenceRequestError || err instanceof ConfluenceStatusError) {
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
    // ZUSAMMENFÜHRUNG (Nacharbeit 4): mains Fassung. Die Unterscheidung „404 = gelöscht" gegen
    // „unbrauchbare 2xx-Antwort" trägt seither `getPageStateById` (unten); der Löschabgleich beider
    // Aufträge fragt darüber (`adapter.isGoneAtSource`), nicht über diese Methode.
    const data = await this.getJson(this.pageUrl(pageId), this.allowedOrigin(), {
      nichtGefundenIstLeer: true,
    });
    return istSeite(data) ? data : undefined;
  }

  /**
   * R-0162 (Abgleich): wie `getPageById`, aber OHNE die beiden Fälle zu vermischen, die dort beide
   * `undefined` ergeben. NUR ein echtes 404 heißt `{ gefunden: false }`. Eine 2xx-Antwort ohne
   * verwendbare Seite (`{}`, `null`, fehlende id) ist ein Protokollfehler und WIRFT — eine unklare
   * Antwort darf nie als bestätigte Löschung gelesen werden.
   */
  async getPageStateById(
    pageId: string,
  ): Promise<{ gefunden: false } | { gefunden: true; page: ConfluencePage }> {
    const data = await this.getJson(this.pageUrl(pageId), this.allowedOrigin(), {
      nichtGefundenIstLeer: true,
    });
    if (data === NICHT_GEFUNDEN) {
      return { gefunden: false };
    }
    if (!istSeite(data)) {
      const err = new Error("Confluence-Einzelantwort ohne gültige Seite");
      err.name = "ConfluenceAntwortUngueltig";
      throw err;
    }
    return { gefunden: true, page: data };
  }

  private pageUrl(pageId: string): string {
    return `${this.baseUrl}/rest/api/content/${encodeURIComponent(pageId)}?expand=${encodeURIComponent(EXPAND)}`;
  }

  /**
   * R-0163 (Herkunftsangaben, diese Lieferung): ALLE Anhänge einer Seite, über `_links.next`
   * nachgeblättert — derselbe Netzweg wie jeder andere Abruf (Origin-Pin, Frist, Größengrenze,
   * Redaction). `complete: false`, wenn die Obergrenze griff.
   *
   * Lauf 2 (Befund Ben, Runde 3 von Lauf 1): eine Antwort zählt nur, wenn sie wirklich eine
   * Anhangsliste ist — ein Objekt mit `results` als Liste, jeder Eintrag mit Kennung. Alles andere
   * (auch eine Erfolgsantwort `{}` oder eine 404 für eine Seite, die gerade noch gelesen wurde) ist
   * ein UNBEKANNTER Zustand und wirft `ConfluenceUnusableResponseError`; der Adapter behält dann die
   * Teilliste mit Unvollständig-Marke, und die Annahme entfernt keine bestehende Anhangsquelle.
   *
   * ZUSAMMENFÜHRUNG (Nacharbeit 5): main bringt mit R-0163 (`confluence-import-anhaenge`) ein
   * eigenes `listAttachments` (unten, Rückgabe `truncated`) für die Dateiinhalte. Beide Wege
   * bestehen nebeneinander; dieser trägt deshalb einen eigenen Namen.
   */
  async listAttachmentsStreng(
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

  /**
   * R-0163: die Anhänge EINER Seite (Dateien und Bilder), vollständig über die Cursor-Pagination —
   * dieselbe Regel wie `listAllPages`: der erste Request wirft, ein scheiternder Folge-Request
   * behält das Gelesene und meldet `truncated`. Eine abgeschnittene Liste wird nie als vollständig
   * ausgegeben; der Aufrufer weist sie aus.
   */
  async listAttachments(pageId: string, maxPages = 20): Promise<ConfluenceAttachmentListResult> {
    const allowedOrigin = this.allowedOrigin();
    const params = new URLSearchParams({ limit: "50", expand: "version" });
    let url: string | null =
      `${this.baseUrl}/rest/api/content/${encodeURIComponent(pageId)}/child/attachment?${params.toString()}`;
    const out: ConfluenceAttachment[] = [];
    let i = 0;
    let abgebrochen = false;
    for (; url && i < maxPages; i++) {
      let results: ConfluenceAttachment[];
      let next: string | null;
      try {
        ({ results, next } = await this.getContent<ConfluenceAttachment>(url, allowedOrigin));
      } catch (err) {
        if (i > 0 && err instanceof ConfluenceRequestError) {
          abgebrochen = true;
          break;
        }
        throw err;
      }
      out.push(...results);
      url = next ? this.nextUrl(next, allowedOrigin) : null;
    }
    return { attachments: out, truncated: abgebrochen || (i >= maxPages && url !== null) };
  }

  /**
   * R-0163: die Rohbytes EINES Anhangs, begrenzt (Frist + `maxAttachmentBytes`).
   *
   * DER LINK IST RELATIV ZUM KONTEXTPFAD wie `_links.next` (Cloud: `/download/attachments/…` ohne
   * `/wiki`) und wird deshalb über `nextUrl` aufgelöst — nur mit der Origin präfixiert landete er
   * im Jira-Namensraum. Ein absoluter Link muss die gepinnte Origin tragen.
   *
   * GENAU EINE WEITERLEITUNG: Confluence Cloud beantwortet den Download mit 302 auf seinen
   * Mediendienst (anderer Host, signierte Adresse). Gefolgt wird nur über HTTPS und nur einmal; an
   * einen FREMDEN Host geht der Request OHNE Anmeldung — der Token verlässt die gepinnte Origin
   * weiterhin nie (R2a). Der zweite Hop steht wieder auf `redirect:"error"`.
   */
  async downloadAttachment(downloadLink: string): Promise<ConfluenceAnhangInhalt> {
    const allowedOrigin = this.allowedOrigin();
    const url = /^[a-z][a-z0-9+.-]*:/i.test(downloadLink)
      ? downloadLink
      : this.nextUrl(downloadLink, allowedOrigin);
    assertAllowedConfluenceUrl(url, allowedOrigin); // vor JEDEM Netzcall
    const maxBytes = this.config.maxAttachmentBytes ?? CONFLUENCE_MAX_ATTACHMENT_BYTES;
    const erster = await this.mitFrist<ErsterHop>(
      url,
      { method: "GET", headers: { authorization: this.authHeader() }, redirect: "manual" },
      async (res) => {
        if (WEITERLEITUNG.has(res.status)) {
          return { weiter: weiterleitungsZiel(res, url) };
        }
        if (!res.ok) {
          throw new ConfluenceStatusError(res.status);
        }
        return { inhalt: await leseAnhangBegrenzt(res, maxBytes) };
      },
    );
    if ("inhalt" in erster) {
      return erster.inhalt;
    }
    const ziel = erster.weiter;
    const gleicheOrigin = new URL(ziel).origin === allowedOrigin;
    return this.mitFrist(
      ziel,
      {
        method: "GET",
        headers: gleicheOrigin ? { authorization: this.authHeader() } : {},
        redirect: "error",
      },
      async (res) => {
        if (!res.ok) {
          throw new ConfluenceStatusError(res.status);
        }
        return leseAnhangBegrenzt(res, maxBytes);
      },
    );
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

  /**
   * ADMIN-02 — der Verbindungstest: EINE Seite des konfigurierten Space, ohne Expand, `limit=1`.
   * Derselbe Netzweg (Origin-Pin, Frist, Redaction), nur Kennungen, kein Seiteninhalt.
   */
  async pruefeVerbindung(): Promise<number> {
    const params = new URLSearchParams({
      spaceKey: this.config.spaceKey,
      type: "page",
      status: "current",
      limit: "1",
    });
    const url = `${this.baseUrl}/rest/api/content?${params.toString()}`;
    return (await this.getContent<{ id?: string }>(url, this.allowedOrigin())).results.length;
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
  // R-0166: der Anmeldeweg aus derselben Regel wie die Zustandsauskunft (credential-state.ts).
  // Unbekannter Wert ⇒ kein Client; beim persönlichen Zugriffstoken wird keine Kennung verlangt.
  const authMode = confluenceAuthMode(env);
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
    authMode,
    // Beim Cloud-Weg ist email oben schon als gesetzt geprüft; die Bedingung hier verengt nur den Typ
    // (exactOptionalPropertyTypes: `email` darf nie als ausdrücklich undefined ankommen).
    ...(authMode === "cloud" && email ? { email } : {}),
    apiToken,
    spaceKey,
    ...(Number.isInteger(limit) && limit > 0 ? { pageLimit: limit } : {}),
    ...(Number.isInteger(timeoutMs) && timeoutMs > 0 ? { timeoutMs } : {}),
    ...(Number.isInteger(budgetMs) && budgetMs > 0 ? { totalBudgetMs: budgetMs } : {}),
  });
}

// JOB 2683 D1: Body begrenzt lesen. Drei Stufen, je nachdem, was die Antwort hergibt: `content-length`
// vorab (kein einziges Byte, wenn die Zahl schon zu groß ist), dann der Stream mit laufender Zählung
// (undici/native fetch), sonst — Fixtures ohne Body-Stream — der gewöhnliche `json()`-Weg.
async function leseBegrenzt(res: Response, maxBytes: number): Promise<unknown> {
  const roh = await leseRohBegrenzt(res, maxBytes);
  return roh ? JSON.parse(roh.toString("utf8")) : res.json();
}

function kopfwert(res: Response, name: string): string | null | undefined {
  return (res as { headers?: { get?: (name: string) => string | null } }).headers?.get?.(name);
}

// R-0163: Rohbytes eines Anhangs — dieselben Stufen wie `leseBegrenzt`; Fixtures ohne Body-Stream
// liefern `arrayBuffer()`, das danach gegen dieselbe Kante geprüft wird.
async function leseAnhangBegrenzt(
  res: Response,
  maxBytes: number,
): Promise<ConfluenceAnhangInhalt> {
  let bytes = await leseRohBegrenzt(res, maxBytes);
  if (!bytes) {
    bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.byteLength > maxBytes) {
      throw new ConfluenceRequestError("zu_gross", maxBytes);
    }
  }
  const mime = kopfwert(res, "content-type")?.split(";")[0]?.trim().toLowerCase();
  return { bytes, ...(mime ? { mime } : {}) };
}

// R-0163: das Ziel einer Weiterleitung, absolut. Ohne `location` oder ohne HTTPS: Abbruch — ein
// Anhang wird nie über eine unverschlüsselte Verbindung nachgeladen. Kein Host in der Meldung.
function weiterleitungsZiel(res: Response, von: string): string {
  const location = kopfwert(res, "location");
  let ziel: URL;
  try {
    ziel = new URL(location ?? "", von);
  } catch {
    throw new Error("Confluence: Weiterleitung des Anhangs ohne gültiges Ziel — Abbruch.");
  }
  if (!location || ziel.protocol !== "https:") {
    throw new Error("Confluence: Weiterleitung des Anhangs nicht über HTTPS — Abbruch.");
  }
  return ziel.toString();
}

// Gemeinsamer Kern: `content-length` vorab, dann der Stream mit laufender Zählung. `undefined`,
// wenn die Antwort keinen Body-Stream hat (Fixture) — der Aufrufer wählt dann seinen Ersatzweg.
async function leseRohBegrenzt(res: Response, maxBytes: number): Promise<Buffer | undefined> {
  const angekuendigt = Number(kopfwert(res, "content-length"));
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
    return Buffer.concat(chunks);
  }
  return undefined;
}
