// ================================================================================================
// JOB 4086 — DER LESENDE GRAPH-CLIENT: ZWEI ABRUFE, MEHR KANN ER NICHT.
// ================================================================================================
//
// Er spricht den VERTRAG von Microsoft Graph an (`/drives/{drive}/…`), nicht das Netz: `fetchFn`
// ist injizierbar, und jeder Test dieses Moduls setzt ein Vertragsdouble ein — genau die Bauform,
// die `services/confluence/src/rest-client.test.ts` seit SCRUM-510 führt. Es gibt in diesem Modul
// KEINEN Testfall, der einen echten Aufruf hinauslässt.
//
// DIE DREI HÄRTUNGEN SIND DIESELBEN WIE BEIM CONFLUENCE-CLIENT, und sie sind hier nicht Zierat:
//   1. HTTPS-ORIGIN-PINNING. Jede Ziel-URL muss https sein UND dieselbe Origin tragen wie die
//      konfigurierte Basisadresse. Sonst Abbruch OHNE Netzaufruf — auch für den `@odata.nextLink`,
//      den die Gegenstelle schickt (er ist FREMDER Text und wird wie solcher geprüft).
//   2. `redirect: "error"`. Kein Folgen auf einen fremden Host, also kein Token an ein Umleitungsziel.
//   3. FRIST UND GRÖSSENKANTE. Eine hängende oder unbegrenzt antwortende Gegenstelle hält den
//      Aufrufer nicht fest und füllt nicht den Prozessspeicher.
//
// DER TOKEN LEBT NUR IN DER CLOSURE. `sharepointClientFromEnv` liest ihn aus der Umgebung und gibt
// einen CLIENT zurück, nie den Token und nie eine token-tragende Config.
//
// UND ES GIBT HIER KEINE REDACTION — weil es nichts zu redigieren gibt, und das ist die stärkere
// Zusage. Der Confluence-Client reicht fremde Fehlertexte weiter und entschärft sie deshalb
// (`redactSecrets`); dieser hier reicht KEINEN fremden Text weiter. Jeder Fehler, der diese Klasse
// verlässt, ist ein `SharePointRequestError` mit einem der vier festen Sätze aus `LAGE_MELDUNG` —
// eine fremde Message, ein Stack oder eine Ziel-URL kann strukturell nicht durchrutschen, weil sie
// nirgends übernommen wird.

import { istHttpsAdresse } from "./credential-state";

/** Config INKL. Token — modul-intern (NICHT über die Paket-index re-exportiert). */
export interface SharePointGraphConfig {
  /** https-Basisadresse des Graph-Dienstes, z. B. `https://graph.microsoft.com/v1.0`. */
  baseUrl: string;
  /** Das Zugangsmerkmal (Bearer). NIE loggen, nie zurückgeben, nie in eine URL schreiben. */
  accessToken: string;
  /** Die Bibliothek/das Laufwerk, auf das dieser Client gescoped ist. */
  driveId: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  maxResponseBytes?: number;
  /** Einträge je Ergebnisseite. */
  pageLimit?: number;
  /** Wie viele Ergebnisseiten höchstens gelesen werden (Sicherheitsnetz gegen endlose Cursor). */
  maxPages?: number;
}

export const SHAREPOINT_REQUEST_TIMEOUT_MS = 15_000;
export const SHAREPOINT_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
export const SHAREPOINT_PAGE_LIMIT = 50;
export const SHAREPOINT_MAX_PAGES = 10;

// ================================================================================================
// DIE VIER LAGEN — UND WARUM ES GENAU VIER SIND.
// ================================================================================================
//
// Der Auftrag verlangt vier Fehlerlagen in Anwendersprache. Diese Aufzählung ist die
// SERVERSEITIGE Hälfte davon: sie führt nur Unterscheidungen, die der Server WIRKLICH treffen kann.
//   · `keine-berechtigung` — Graph antwortet 403: das Konto darf diese Datei/Bibliothek nicht sehen.
//   · `nicht-gefunden`     — Graph antwortet 404: die Quelle gibt es nicht (mehr).
//   · `abgelaufen`         — Graph antwortet 401: das hinterlegte Zugangsmerkmal gilt nicht mehr.
//   · `nicht-erreichbar`   — alles Übrige: Netzfehler, Frist, zu grosse Antwort, 5xx.
//
// Die vierte Lage ist bewusst eine ZUSAMMENFASSUNG und kein Sammelbecken für Unbekanntes: Aus
// Sicht des Aufrufers ist „die Gegenstelle hat nicht brauchbar geantwortet" EIN Sachverhalt, und
// der Satz auf der Fläche sagt genau das (abgelaufen ODER nicht erreichbar). Eine fünfte Lage
// „unbekannter Fehler" wäre ein Satz, der dem Menschen nichts sagt — und ein Statuscode auf der
// Fläche ist ausdrücklich verboten.
export type SharePointFehlerlage =
  | "keine-berechtigung"
  | "nicht-gefunden"
  | "abgelaufen"
  | "nicht-erreichbar";

/**
 * Der EINE Fehlertyp dieses Moduls. Modul-intern (nicht über die Paket-index exportiert) — nach
 * aussen führt `sharepointFehlerlage` die Lage, nicht die Klasse.
 *
 * Die Meldung nennt NIE Host, URL oder Token: sie ist ein fester Satz je Lage.
 */
export class SharePointRequestError extends Error {
  readonly lage: SharePointFehlerlage;

  constructor(lage: SharePointFehlerlage) {
    super(LAGE_MELDUNG[lage]);
    this.name = "SharePointRequestError";
    this.lage = lage;
  }
}

const LAGE_MELDUNG: Record<SharePointFehlerlage, string> = {
  "keine-berechtigung": "SharePoint: Das hinterlegte Konto darf diese Quelle nicht lesen.",
  "nicht-gefunden": "SharePoint: Die Quelle ist dort nicht (mehr) vorhanden.",
  abgelaufen: "SharePoint: Das hinterlegte Zugangsmerkmal gilt nicht mehr.",
  "nicht-erreichbar": "SharePoint: Die Quelle hat nicht brauchbar geantwortet.",
};

/**
 * Die Lage eines gefangenen Fehlers — oder `null`, wenn er gar nicht aus diesem Modul stammt.
 *
 * ERKANNT WIRD ÜBER DAS FELD, nicht über `instanceof`: der Fehlertyp ist modul-intern (dieselbe
 * Kapselungsregel wie bei Confluence, `confluenceGrenze` in den Import-Routen liest ebenso ein
 * Feld). Ein Duck-Type auf die vier Lagen ist genau die Auskunft, die der Aufrufer braucht.
 */
export function sharepointFehlerlage(err: unknown): SharePointFehlerlage | null {
  if (!err || typeof err !== "object" || !("lage" in err)) {
    return null;
  }
  const lage = (err as { lage: unknown }).lage;
  return typeof lage === "string" && lage in LAGE_MELDUNG ? (lage as SharePointFehlerlage) : null;
}

/** Ein Eintrag einer Bibliothek, so wie Graph ihn liefert. Gelesen wird NUR, was hier steht. */
export interface GraphDriveItem {
  id?: string;
  name?: string;
  webUrl?: string;
  /** ISO-Zeitstempel der letzten Änderung — der Quellstand dieser Datei. */
  lastModifiedDateTime?: string;
  size?: number;
  description?: string;
  /** Gesetzt, wenn der Eintrag eine DATEI ist (Graph-Vertrag: `file`-Facette). */
  file?: { mimeType?: string };
  /** Gesetzt, wenn der Eintrag ein ORDNER ist. */
  folder?: { childCount?: number };
  lastModifiedBy?: { user?: { displayName?: string } };
  parentReference?: { driveId?: string; path?: string };
}

/** Das Ergebnis eines Listenabrufs. `truncated` heisst: es gibt weitere, ungelesene Einträge. */
export interface SharePointListResult {
  items: GraphDriveItem[];
  truncated: boolean;
}

// Genau die Felder, die der Mapper braucht. Ein offener Abruf holte den ganzen DriveItem-Vertrag
// samt Feldern, die dieses Produkt nie liest — Antwortgrösse ohne Gegenwert.
const SELECT =
  "id,name,webUrl,lastModifiedDateTime,size,description,file,folder,lastModifiedBy,parentReference";

/**
 * Erlaubt genau dann, wenn die URL https ist UND ihre Origin exakt der gepinnten entspricht.
 * Sonst Abbruch — und zwar VOR jedem Netzaufruf. Rein und testbar.
 */
export function pruefeGraphUrl(url: string, erlaubteOrigin: string): void {
  let geparst: URL;
  try {
    geparst = new URL(url);
  } catch {
    throw new SharePointRequestError("nicht-erreichbar");
  }
  if (geparst.protocol !== "https:" || geparst.origin !== erlaubteOrigin) {
    throw new SharePointRequestError("nicht-erreichbar");
  }
}

export class SharePointGraphClient {
  constructor(private readonly config: SharePointGraphConfig) {}

  /** Nicht-geheime Config nach aussen (für die Provenienz). KEIN Token-Getter. */
  get baseUrl(): string {
    return this.config.baseUrl.replace(/\/+$/, "");
  }
  get driveId(): string {
    return this.config.driveId;
  }

  private erlaubteOrigin(): string {
    if (!istHttpsAdresse(this.baseUrl)) {
      // Kein Token an einen unverschlüsselten oder unlesbaren Host — Abbruch ohne Request.
      throw new SharePointRequestError("nicht-erreichbar");
    }
    return new URL(this.baseUrl).origin;
  }

  /**
   * Der EINE Netzweg dieses Clients. Beide Abrufe laufen hier durch — so bekommen sie denselben
   * Origin-Pin, dieselbe Frist, dieselbe Grössengrenze und `redirect:"error"` — und nicht eine
   * zweite, abweichende Kopie.
   */
  private async holeJson(url: string, erlaubteOrigin: string): Promise<unknown> {
    pruefeGraphUrl(url, erlaubteOrigin);
    const fetchFn = this.config.fetchFn ?? fetch;
    const timeoutMs = this.config.timeoutMs ?? SHAREPOINT_REQUEST_TIMEOUT_MS;
    const maxBytes = this.config.maxResponseBytes ?? SHAREPOINT_MAX_RESPONSE_BYTES;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    // Die Frist wird gegen den Aufruf GERACET, nicht nur als Signal gesetzt: ein fetch, das das
    // Abbruchsignal nicht kennt (Vertragsdouble, fremde Implementierung), kann den Aufrufer sonst
    // trotzdem festhalten.
    const frist = new Promise<never>((_, reject) => {
      controller.signal.addEventListener(
        "abort",
        () => reject(new SharePointRequestError("nicht-erreichbar")),
        { once: true },
      );
    });
    try {
      let res: Response;
      try {
        res = await Promise.race([
          fetchFn(url, {
            method: "GET",
            headers: {
              authorization: `Bearer ${this.config.accessToken}`,
              accept: "application/json",
            },
            redirect: "error",
            signal: controller.signal,
          }),
          frist,
        ]);
      } catch {
        // DER ROHE FETCH-FEHLER VERLÄSST DIESE KLASSE NIE — weder als Message noch als `cause`.
        throw new SharePointRequestError("nicht-erreichbar");
      }
      const lage = statusLage(res.status);
      if (lage !== null) {
        throw new SharePointRequestError(lage);
      }
      if (!res.ok) {
        throw new SharePointRequestError("nicht-erreichbar");
      }
      try {
        return await Promise.race([leseBegrenzt(res, maxBytes), frist]);
      } catch (err) {
        if (sharepointFehlerlage(err) !== null) {
          throw err;
        }
        throw new SharePointRequestError("nicht-erreichbar");
      }
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Die berechtigte Dateiliste EINER Bibliothek oder EINES Ordners.
   *
   * „Berechtigt" ist keine eigene Filterung dieses Produkts: Graph liefert genau die Einträge aus,
   * auf die das hinterlegte Konto Leserechte hat — was es nicht sehen darf, steht gar nicht erst in
   * der Antwort. Darf es den Ordner selbst nicht sehen, ist die Antwort 403 und damit die Lage
   * `keine-berechtigung`; eine LEERE Liste ist deshalb eine Aussage über das Ergebnis und nie eine
   * über die Rechte.
   */
  async listeDateien(ordnerId?: string): Promise<SharePointListResult> {
    const erlaubteOrigin = this.erlaubteOrigin();
    const maxPages = this.config.maxPages ?? SHAREPOINT_MAX_PAGES;
    const items: GraphDriveItem[] = [];
    let url: string | null = this.ersteSeite(ordnerId);
    let seiten = 0;
    for (; url !== null && seiten < maxPages; seiten++) {
      const daten = (await this.holeJson(url, erlaubteOrigin)) as {
        value?: unknown;
        "@odata.nextLink"?: unknown;
      };
      for (const eintrag of Array.isArray(daten?.value) ? daten.value : []) {
        if (eintrag && typeof eintrag === "object") {
          items.push(eintrag as GraphDriveItem);
        }
      }
      const weiter = daten?.["@odata.nextLink"];
      url = typeof weiter === "string" && weiter.length > 0 ? weiter : null;
    }
    // Abgeschnitten heisst: es gäbe noch einen Cursor, aber der Deckel ist erreicht. Das wird
    // GEMELDET und nicht verschwiegen — eine unvollständige Liste, die sich für vollständig
    // ausgibt, wäre die teuerste Sorte Unwahrheit.
    return { items, truncated: url !== null };
  }

  /**
   * EINE Datei samt ihrer Merkmale. `undefined` gibt es hier NICHT: ein 404 ist beim gezielten
   * Abruf einer benannten Datei eine eigene Lage (`nicht-gefunden`) und keine leere Antwort — der
   * Aufrufer soll ihn dem Menschen als Satz zeigen, nicht als stilles Nichts.
   */
  async holeDatei(itemId: string): Promise<GraphDriveItem> {
    const erlaubteOrigin = this.erlaubteOrigin();
    const params = new URLSearchParams({ $select: SELECT });
    const url = `${this.baseUrl}/drives/${encodeURIComponent(this.driveId)}/items/${encodeURIComponent(itemId)}?${params.toString()}`;
    const daten = await this.holeJson(url, erlaubteOrigin);
    if (!daten || typeof daten !== "object" || typeof (daten as { id?: unknown }).id !== "string") {
      throw new SharePointRequestError("nicht-gefunden");
    }
    return daten as GraphDriveItem;
  }

  private ersteSeite(ordnerId?: string): string {
    const params = new URLSearchParams({
      $select: SELECT,
      $top: String(this.config.pageLimit ?? SHAREPOINT_PAGE_LIMIT),
    });
    const laufwerk = `${this.baseUrl}/drives/${encodeURIComponent(this.driveId)}`;
    const ziel = ordnerId
      ? `${laufwerk}/items/${encodeURIComponent(ordnerId)}/children`
      : `${laufwerk}/root/children`;
    return `${ziel}?${params.toString()}`;
  }
}

/** Die Statuszahlen, die eine EIGENE Lage tragen. Alles Übrige ist „nicht erreichbar". */
function statusLage(status: number): SharePointFehlerlage | null {
  if (status === 401) {
    return "abgelaufen";
  }
  if (status === 403) {
    return "keine-berechtigung";
  }
  if (status === 404) {
    return "nicht-gefunden";
  }
  return null;
}

/**
 * env→CLIENT (nicht env→Config). Der Token wird HIER gelesen und in die Client-Closure gebunden —
 * er verlässt diese Funktion nie als Wert. Fehlt eine Variable ODER ist die Basisadresse nicht
 * https, gibt es keinen Client (`undefined` → der Import ist nicht eingerichtet).
 *
 * Modul-intern: von aussen führt der einzige Weg über `createSharePointAdapterFromEnv`.
 */
export function sharepointClientFromEnv(
  env: Record<string, string | undefined> = process.env,
): SharePointGraphClient | undefined {
  const baseUrl = env.KLARWERK_SHAREPOINT_BASE_URL;
  const accessToken = env.KLARWERK_SHAREPOINT_TOKEN;
  const driveId = env.KLARWERK_SHAREPOINT_DRIVE;
  if (!baseUrl || !accessToken || !driveId || !istHttpsAdresse(baseUrl)) {
    return undefined;
  }
  return new SharePointGraphClient({ baseUrl, accessToken, driveId });
}

/**
 * Body begrenzt lesen. Drei Stufen, je nachdem, was die Antwort hergibt: `content-length` vorab
 * (kein einziges Byte, wenn die Zahl schon zu gross ist), dann der Stream mit laufender Zählung,
 * sonst — Vertragsdoubles ohne Body-Stream — der gewöhnliche `json()`-Weg.
 */
async function leseBegrenzt(res: Response, maxBytes: number): Promise<unknown> {
  const kopf = (res as { headers?: { get?: (name: string) => string | null } }).headers;
  const angekuendigt = Number(kopf?.get?.("content-length"));
  if (Number.isFinite(angekuendigt) && angekuendigt > maxBytes) {
    throw new SharePointRequestError("nicht-erreichbar");
  }
  const body = (res as { body?: ReadableStream<Uint8Array> | null }).body;
  if (body && typeof body.getReader === "function") {
    const reader = body.getReader();
    const stuecke: Buffer[] = [];
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
          throw new SharePointRequestError("nicht-erreichbar");
        }
        stuecke.push(Buffer.from(value));
      }
    }
    return JSON.parse(Buffer.concat(stuecke).toString("utf8"));
  }
  return res.json();
}
