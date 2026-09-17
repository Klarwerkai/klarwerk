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
// ================================================================================================
// JOB 4232 R3 — ZWEI WEGE, ZWEI TRANSPORTE. UND WARUM DAS KEINE ZWEITE KOPIE IST.
// ================================================================================================
//
// Seit JOB 4232 holt dieser Client auch den INHALT einer Textdatei. Die zwei Wege unterscheiden sich
// nicht in ihrer Strenge, sondern darin, WER die Zieladresse bestimmt:
//
//   METADATEN (Liste, Merkmale) → `holeJson` über `fetch`. Die Origin bestimmt der BETREIBER
//                                 (`baseUrl`), sie ist gepinnt, der Token geht mit.
//   INHALT                      → `holeBytes` über eine SELBST aufgebaute Verbindung
//                                 (`gebundenerTransport`, `node:https`). Die Adresse bestimmt die
//                                 GEGENSTELLE (`@microsoft.graph.downloadUrl`) — deshalb wird sie
//                                 geprüft, aufgelöst und die Verbindung an die geprüfte Zahl
//                                 GEBUNDEN. Kein Token, keine Umleitung.
//
// Es sind keine zwei Auslegungen derselben Frage: die vier Fehlerlagen, die Frist und die
// Bytegrenzen sind für beide dieselben Begriffe, und beide enden in `SharePointRequestError`.
// Getrennt ist allein der Verbindungsaufbau — und genau dort liegt der Unterschied, der zählt.
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

import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import type { LookupFunction } from "node:net";
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
  /** JOB 4232: die ZUSÄTZLICHE, engere Kante des Inhaltswegs (s. `SHAREPOINT_MAX_TEXT_BYTES`). */
  maxTextBytes?: number;
  /**
   * JOB 4232 R2: die Namensauflösung der Zielprüfung (s. `pruefeDownloadZiel`). Injizierbar aus
   * demselben Grund wie `fetchFn`: eine Sperre, die nur mit echtem DNS messbar wäre, wäre gar nicht
   * gemessen.
   */
  aufloeseFn?: SharePointAufloesung;
  /**
   * JOB 4232 R3: der Verbindungsaufbau des INHALTSWEGS. Vorgabe ist die an die geprüfte Adresse
   * GEBUNDENE Verbindung (`gebundenerTransport`); injizierbar, damit sie ohne Netz messbar ist.
   */
  inhaltsTransport?: SharePointInhaltsTransport;
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
// JOB 4232 — DER INHALTSWEG: EINE ZUSÄTZLICHE, ENGERE KANTE. KEINE GELOCKERTE.
// ================================================================================================
//
// Die vier Kanten darüber bleiben, wie sie sind — keine einzige wird für den Inhalt erhöht. Was
// hinzukommt, ist eine EIGENE, SCHÄRFERE Grenze für den Dateiinhalt: 256 KiB, ein Zwanzigstel der
// Antwortkante. Sie ist begründet und nicht geraten: der Inhalt ist hier `text/plain`, und 256 KiB
// reiner Text sind rund 40.000 Wörter — mehr, als ein Mensch je als EINEN Wissenseintrag annimmt.
// Was darüber liegt, ist kein Wissenseintrag, sondern ein Datenbestand; er wird deshalb ehrlich als
// `zu-gross` benannt und NICHT halb übernommen.
//
// DIE FRIST BLEIBT DIE VORHANDENE (`SHAREPOINT_REQUEST_TIMEOUT_MS`) — sie wird für den Inhaltsweg
// nicht verlängert. Seit Runde 4 ist sie dort auch wirklich eine FRIST und nicht bloss eine
// Untätigkeitsgrenze: sie läuft über Auflösung UND Download und beendet die Verbindung, wenn sie
// fällt (`starteInhaltsfrist`).
export const SHAREPOINT_MAX_TEXT_BYTES = 256 * 1024;

/** Der EINE Medientyp, dessen Inhalt dieser Client wirklich lesen kann (JOB 4232, Lieferung 2). */
export const SHAREPOINT_TEXT_MIME = "text/plain";

/**
 * Was aus dem Inhalt EINER Datei geworden ist. Fünf Befunde, und sie sind keine fünfte FEHLERLAGE:
 * die vier Lagen bleiben, was sie sind (Netz, Recht, Bestand, Zugang) und reisen weiter als
 * `SharePointRequestError`. Was hier steht, sind TATSACHEN ÜBER DEN INHALT — und eine Tatsache
 * gehört in ein Ergebnis, nicht in eine Ausnahme.
 *
 *   `text`          — der Inhalt wurde WIRKLICH gelesen und ist lesbarer Text.
 *   `leer`          — die Datei ist nachweislich leer. Das ist weder „übernommen" noch „nur
 *                     Merkmale", sondern eine dritte, eigene Aussage.
 *   `nur-merkmale`  — dieser Typ wird von diesem Weg nicht gelesen (alles ausser `text/plain`).
 *   `zu-gross`      — über der Inhaltskante. Ein halber Text entsteht nicht.
 *   `unlesbar`      — geholt, aber nicht als Text dekodierbar (fremde/kaputte Kodierung).
 */
export type SharePointInhaltsbefund = "text" | "leer" | "nur-merkmale" | "zu-gross" | "unlesbar";

/**
 * Was die MERKMALE einer Datei über ihren Inhalt hergeben — die Auskunft VOR dem Lesen.
 *
 * `unlesbar` fehlt hier mit Absicht: ob sich ein Text dekodieren lässt, zeigt sich erst am Byte.
 * Eine Vorschau, die das behauptete, wäre eine Zusage ohne Messung.
 */
export type SharePointInhaltsvorschau = Exclude<SharePointInhaltsbefund, "unlesbar">;

/** Der Befund samt Text — den Text trägt NUR der Fall, der ihn wirklich gelesen hat. */
export type SharePointInhalt =
  | { readonly art: "text"; readonly text: string }
  | { readonly art: Exclude<SharePointInhaltsbefund, "text"> };

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
  /**
   * JOB 4232 — die VORAUTORISIERTE Downloadadresse von Graph, kurzlebig und bereits mit Berechtigung
   * versehen. Sie kommt NUR beim gezielten Abruf mit (`SELECT_INHALT`), nie in der Liste: eine
   * Auswahlliste voller Zeitschlüssel wäre eine Halde, und keine einzige davon würde gebraucht.
   */
  "@microsoft.graph.downloadUrl"?: string;
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

// JOB 4232: NUR der gezielte Abruf einer Datei, die wirklich übernommen werden soll, holt die
// vorautorisierte Downloadadresse mit. Die Liste bekommt sie NICHT — sie ist ein Schlüssel auf Zeit,
// und eine Liste voller Schlüssel wäre eine Halde, von der keiner gebraucht würde.
const SELECT_INHALT = `${SELECT},@microsoft.graph.downloadUrl`;

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

// ================================================================================================
// JOB 4232 — WARUM DER INHALTSWEG NICHT GEPINNT WERDEN KANN, UND WAS STATTDESSEN GILT.
// ================================================================================================
//
// Microsoft Graph gibt den Inhalt einer Datei auf zwei Wegen heraus. `/items/{id}/content` antwortet
// mit einer UMLEITUNG (302) auf einen Speicherhost; dieser Client folgt keiner Umleitung
// (`redirect: "error"`, Härtung 2), und er DARF ihr auch nicht folgen — der Speicherhost ist eine
// fremde Origin, und ein `Authorization`-Kopf dorthin wäre genau das Token-Leck, gegen das die
// Härtung steht. Der zweite Weg ist `@microsoft.graph.downloadUrl`: eine VORAUTORISIERTE Adresse,
// die Graph im Merkmalsabruf mitgibt. Sie trägt ihre Berechtigung SELBST.
//
// DIESER CLIENT NIMMT DEN ZWEITEN WEG, und daraus folgen vier Auflagen, die hier erzwungen werden:
//   1. KEIN `Authorization`-KOPF auf diese Adresse. Nie. Sie braucht keinen, und ein mitgeschickter
//      wäre das Zugangsmerkmal der Instanz an einen Host, den nicht wir bestimmt haben.
//   2. HTTPS-ZWANG. Eine Adresse ohne https ist keine, die ein Zugangsartefakt tragen darf — auch
//      ein vorautorisierter Schlüssel in der Query ist ein Geheimnis.
//   3. `redirect: "error"` GILT WEITER. Der Weg endet bei dem Host, den Graph genannt hat, und geht
//      nicht über einen dritten weiter.
//   4. KEIN PRIVATES ZIEL. Loopback, private und Link-Local-Bereiche sowie Adressen mit
//      eingebetteten Zugangsdaten sind gesperrt: eine Antwort der Gegenstelle bestimmt hier eine
//      Zieladresse, und ohne diese Sperre wäre das ein Griff ins innere Netz dieser Installation
//      (SSRF) — dieselbe Sorte Vertrauen in fremden Text, die schon der `@odata.nextLink` nicht
//      bekommt.
//
// DIE ORIGIN IST BEWUSST NICHT GEPINNT, und das ist kein Nachlass: sie ist bei Microsoft 365
// mandanten- und speicherabhängig (`*.sharepoint.com`, `*.files.1drv.com`, …), und ein geratener Pin
// wäre entweder zu weit (jeder Unterhost) oder falsch. Was hier steht, ist die Grenze, die WIRKLICH
// trägt: kein Geheimnis hinaus, kein Weg ins eigene Netz hinein.
//
// GEPRÜFT AM CODE, NICHT AN DER DOKUMENTATION: diese Sitzung hat keinen Netzzugang zur
// Graph-Dokumentation. Der Vertrag ist gegen den vorhandenen Client und die Testdoubles dieses
// Hauses geprüft; die Abnahme gegen einen echten Microsoft-365-Mandanten steht weiterhin aus (D10).

// ================================================================================================
// JOB 4232 RUNDE 2 — WARUM DIE ERSTE SPERRE NICHT TRUG (BENS MESSUNG, KORREKTURPFLICHT 1).
// ================================================================================================
//
// Die Sperre aus Runde 1 las die Zeichenkette des Hostnamens mit regulären Ausdrücken. Ben hat vier
// Wege gemessen, die daran vorbeigingen — und alle vier sind keine Kuriosität, sondern die
// gewöhnlichen Schreibweisen derselben Adresse:
//
//     ::ffff:127.0.0.1        → `new URL(...).hostname` NORMALISIERT das zu `::ffff:7f00:1`.
//     ::ffff:10.0.0.5           Die Regel suchte nach `127.` im Text; im Hexadezimalen steht das
//     ::ffff:169.254.169.254    nicht mehr da. Die Metadatenadresse der Cloud lag damit frei.
//     localhost.              → der abschließende Punkt (absoluter FQDN) ist gültig und macht aus
//                               `localhost` eine Zeichenkette, die weder gleich `localhost` ist
//                               noch auf `.localhost` endet.
//
// DIE LEHRE: Eine Adresse ist keine Zeichenkette, sondern eine ZAHL. Ab hier wird sie geparst —
// IPv4 als vier Zahlen, IPv6 als acht Gruppen, mit der eingebetteten IPv4 an ihrem Platz — und die
// Bereiche werden auf den ZAHLEN entschieden. Damit trifft dieselbe Regel jede Schreibweise
// derselben Adresse, auch die, an die heute niemand denkt.
//
// UND DIE DRITTE LÜCKE, die Ben ebenfalls benannt hat: ein Name, der auf eine private Adresse
// ZEIGT, ist in der Zeichenkette gar nicht zu sehen (`speicher.example.com` → 127.0.0.1). Dagegen
// hilft nur, ihn aufzulösen, BEVOR verbunden wird — s. `pruefeDownloadZiel`.

/** Der Hostname in seiner einen Vergleichsform: klein, ohne Klammern, Zone und Schlusspunkt. */
export function normalisiereHost(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .replace(/%.*$/, "") // IPv6-Zonenkennung (`fe80::1%eth0`)
    .replace(/\.+$/, ""); // absoluter FQDN (`localhost.`)
}

/** Vier Zahlen — oder `null`, wenn die Zeichenkette keine IPv4-Adresse ist. */
function alsIpv4(text: string): [number, number, number, number] | null {
  const teile = text.split(".");
  if (teile.length !== 4) {
    return null;
  }
  const zahlen: number[] = [];
  for (const teil of teile) {
    if (!/^\d{1,3}$/.test(teil)) {
      return null;
    }
    const zahl = Number(teil);
    if (zahl > 255) {
      return null;
    }
    zahlen.push(zahl);
  }
  return [zahlen[0] ?? 0, zahlen[1] ?? 0, zahlen[2] ?? 0, zahlen[3] ?? 0];
}

/**
 * Acht Gruppen — oder `null`. Eine am Ende eingebettete IPv4 (`::ffff:127.0.0.1`) wird VORHER in
 * ihre zwei Gruppen umgerechnet, damit beide Schreibweisen derselben Adresse dieselben Zahlen
 * ergeben. Genau diese Gleichheit fehlte in Runde 1.
 */
function alsIpv6(text: string): number[] | null {
  if (!text.includes(":")) {
    return null;
  }
  let rest = text;
  const schnitt = rest.lastIndexOf(":");
  const eingebettet = alsIpv4(rest.slice(schnitt + 1));
  if (eingebettet) {
    const [a, b, c, d] = eingebettet;
    rest = `${rest.slice(0, schnitt + 1)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const haelften = rest.split("::");
  if (haelften.length > 2) {
    return null;
  }
  const teile = (s: string | undefined): string[] => (s ?? "").split(":").filter((g) => g !== "");
  const links = teile(haelften[0]);
  const rechts = haelften.length === 2 ? teile(haelften[1]) : [];
  const gruppen =
    haelften.length === 2
      ? [...links, ...Array(8 - links.length - rechts.length).fill("0"), ...rechts]
      : links;
  if (gruppen.length !== 8) {
    return null;
  }
  const zahlen: number[] = [];
  for (const gruppe of gruppen) {
    if (!/^[0-9a-f]{1,4}$/.test(gruppe)) {
      return null;
    }
    zahlen.push(Number.parseInt(gruppe, 16));
  }
  return zahlen;
}

/** Die IPv4-Bereiche, die diese Installation NIE von aussen ansteuern lässt. */
function istPrivatesIpv4(a: number, b: number): boolean {
  return (
    a === 0 || // „dieses Netz"
    a === 10 || // privat
    a === 127 || // Loopback
    (a === 100 && b >= 64 && b <= 127) || // Carrier-NAT
    (a === 169 && b === 254) || // Link-Local — hier liegen die Metadatendienste der Cloud
    (a === 172 && b >= 16 && b <= 31) || // privat
    (a === 192 && b === 168) || // privat
    (a === 192 && b === 0) || // IETF-Protokollzuweisungen
    (a === 198 && (b === 18 || b === 19)) || // Messbereich
    a >= 224 // Multicast und reserviert
  );
}

/** Dieselbe Frage für IPv6 — samt der eingebetteten IPv4, die Runde 1 durchrutschen liess. */
function istPrivatesIpv6(gruppen: number[]): boolean {
  const g = (i: number): number => gruppen[i] ?? 0;
  if (gruppen.every((x) => x === 0)) {
    return true; // `::` (unspezifiziert)
  }
  if (gruppen.slice(0, 7).every((x) => x === 0) && g(7) === 1) {
    return true; // `::1` (Loopback)
  }
  if ((g(0) & 0xffc0) === 0xfe80) {
    return true; // fe80::/10 Link-Local
  }
  if ((g(0) & 0xfe00) === 0xfc00) {
    return true; // fc00::/7 Unique-Local
  }
  if ((g(0) & 0xff00) === 0xff00) {
    return true; // ff00::/8 Multicast
  }
  // Die drei Formen, in denen eine IPv4 in einer IPv6 steckt: v4-mapped (`::ffff:a.b.c.d`),
  // v4-compatible (`::a.b.c.d`) und NAT64 (`64:ff9b::a.b.c.d`). In allen dreien entscheidet die
  // eingebettete IPv4 — sonst wäre die Sperre über die Schreibweise umgehbar (bens Befund).
  const nullen = gruppen.slice(0, 5).every((x) => x === 0);
  const eingebettet =
    (nullen && (g(5) === 0xffff || g(5) === 0)) ||
    (g(0) === 0x64 && g(1) === 0xff9b && gruppen.slice(2, 6).every((x) => x === 0));
  return eingebettet ? istPrivatesIpv4(g(6) >> 8, g(6) & 0xff) : false;
}

/**
 * Zeigt DIESE Adresse ins private, lokale oder reservierte Netz? Entschieden auf den Zahlen, nicht
 * am Text — deshalb gilt die Antwort für jede Schreibweise derselben Adresse.
 *
 * `false` für alles, was keine Adresse ist (ein Name): darüber sagt diese Funktion nichts, das
 * beantwortet erst die Auflösung in `pruefeDownloadZiel`.
 */
export function istPrivateAdresse(adresse: string): boolean {
  const roh = normalisiereHost(adresse);
  const v4 = alsIpv4(roh);
  if (v4 !== null) {
    return istPrivatesIpv4(v4[0], v4[1]);
  }
  const v6 = alsIpv6(roh);
  return v6 !== null ? istPrivatesIpv6(v6) : false;
}

/** Die Hostformen, die eine von der Gegenstelle genannte Adresse NIE haben darf. */
function istPrivaterHost(hostname: string): boolean {
  const host = normalisiereHost(hostname);
  if (host === "" || host === "localhost" || host.endsWith(".localhost")) {
    return true;
  }
  return istPrivateAdresse(host);
}

/** Ist dieser Host eine Adresse (dann ist oben schon entschieden) oder ein Name (dann folgt DNS)? */
function istAdressliteral(host: string): boolean {
  return alsIpv4(host) !== null || alsIpv6(host) !== null;
}

/**
 * Erlaubt genau dann, wenn die von Graph genannte Downloadadresse https ist, keine eingebetteten
 * Zugangsdaten trägt und nicht ins private/lokale Netz zeigt. Sonst Abbruch — VOR jedem Netzaufruf.
 * Rein und testbar, wie `pruefeGraphUrl` daneben.
 */
export function pruefeDownloadUrl(url: string): void {
  let geparst: URL;
  try {
    geparst = new URL(url);
  } catch {
    throw new SharePointRequestError("nicht-erreichbar");
  }
  if (
    geparst.protocol !== "https:" ||
    geparst.username !== "" ||
    geparst.password !== "" ||
    istPrivaterHost(geparst.hostname)
  ) {
    throw new SharePointRequestError("nicht-erreichbar");
  }
}

/** Namensauflösung als VERTRAG — injizierbar, damit die Zielprüfung ohne Netz messbar ist. */
export type SharePointAufloesung = (host: string) => Promise<readonly string[]>;

/**
 * JOB 4232 R2/R3 — DIE ZIELPRÜFUNG DES INHALTSWEGS, EINSCHLIESSLICH DER AUFLÖSUNG.
 *
 * `pruefeDownloadUrl` sieht nur, was in der Adresse STEHT. Ein Name sagt nichts darüber, wohin er
 * zeigt: `speicher.example.com` kann auf `127.0.0.1` auflösen, und dann führte der Weg ins Innere
 * dieser Installation, ohne dass die Zeichenkette je verdächtig ausgesehen hätte (bens
 * Korrekturpflicht 1). Deshalb wird der Name hier AUFGELÖST und JEDE zurückgegebene Adresse geprüft,
 * bevor irgendeine Verbindung aufgebaut wird.
 *
 * ================================================================================================
 * RUNDE 3 — ZWEI ÄNDERUNGEN, UND BEIDE WAREN NÖTIG.
 * ================================================================================================
 *
 * (1) FAIL-CLOSED. Runde 2 ging bei einem Auflösungsfehler oder einer leeren Antwort WEITER, mit der
 *     Begründung, ohne Adresse käme ohnehin keine Verbindung zustande. Ben hat gemessen, dass der
 *     Abruf danach trotzdem stattfindet (`expected 1 to be +0`) — die Begründung stimmte also nicht
 *     mit dem Verhalten überein, und sie war auch sachlich zu schwach: Ein Angreifer, der die
 *     Auflösung beherrscht, kann den ersten Versuch scheitern lassen und den zweiten gelingen. Wer
 *     nicht weiss, wohin ein Name zeigt, verbindet nicht. Keine Adresse heisst ab hier: Abbruch.
 *
 * (2) DIE GEPRÜFTE ADRESSE WIRD ZURÜCKGEGEBEN, nicht weggeworfen. Genau sie bindet der
 *     Verbindungsaufbau (`pinneAufAdresse`), und damit ist das Fenster zwischen Prüfung und
 *     Verbindung geschlossen — ein DNS-Wechsel in dieser Zeitspanne kann das Ziel nicht mehr
 *     verschieben. Dokumentiert war das in Runde 2; dokumentiert ist nicht gesperrt.
 *
 * ZURÜCK KOMMT DIE ADRESSE, AUF DIE VERBUNDEN WERDEN DARF: bei einem Adressliteral es selbst, bei
 * einem Namen die ERSTE geprüfte Adresse. Geprüft sind dann ALLE — eine einzige private in der
 * Antwort verwirft den ganzen Weg, denn der Verbindungsaufbau könnte sonst genau sie wählen.
 */
export async function pruefeDownloadZiel(
  url: string,
  aufloese: SharePointAufloesung,
): Promise<string> {
  pruefeDownloadUrl(url);
  const host = normalisiereHost(new URL(url).hostname);
  if (istAdressliteral(host)) {
    return host; // Eine Adresse löst niemand auf — sie ist oben bereits entschieden.
  }
  let adressen: readonly string[] = [];
  try {
    adressen = await aufloese(host);
  } catch {
    // FAIL-CLOSED: Ein Auflösungsfehler ist keine Entwarnung. Wer nicht weiss, wohin ein Name
    // zeigt, verbindet nicht.
    throw new SharePointRequestError("nicht-erreichbar");
  }
  if (adressen.length === 0) {
    throw new SharePointRequestError("nicht-erreichbar");
  }
  for (const adresse of adressen) {
    if (istPrivateAdresse(adresse)) {
      throw new SharePointRequestError("nicht-erreichbar");
    }
  }
  const erste = normalisiereHost(adressen[0] ?? "");
  if (erste === "" || !istAdressliteral(erste)) {
    // Was keine Adresse ist, kann auch nicht gebunden werden. Fail-closed statt raten.
    throw new SharePointRequestError("nicht-erreichbar");
  }
  return erste;
}

/** Die Auflösung des Betriebs. Ihr Fehler reist nach oben — dort wird daraus ein Abbruch. */
async function standardAufloesung(host: string): Promise<readonly string[]> {
  const treffer = await lookup(host, { all: true });
  return treffer.map((t) => t.address);
}

// ================================================================================================
// JOB 4232 RUNDE 3 — DIE VERBINDUNG WIRD AN DIE GEPRÜFTE ADRESSE GEBUNDEN.
// ================================================================================================
//
// BENS KORREKTURPFLICHT 1, ZWEITER TEIL: „Verbindungsaufbau an die geprüfte öffentliche Adresse
// binden." Runde 2 hatte das Fenster zwischen Prüfung und Verbindung nur BESCHRIEBEN — und Ben hat
// zu Recht gesagt: „seine Dokumentation erfüllt die Sperrpflicht nicht."
//
// WARUM DER INHALTSWEG DAFÜR `fetch` VERLÄSST. `fetch` bestimmt seine Zieladresse selbst; es gibt
// keine Stelle, an der ein Aufrufer sagen könnte „verbinde auf DIESE Adresse". Das Fenster ist damit
// eine Eigenschaft des Werkzeugs, nicht des Codes: Wer es schliessen will, muss die Verbindung
// selbst aufbauen. `node:https` kann genau das — es nimmt ein `lookup`, und der TLS-Name bleibt der
// Hostname aus der Adresse (die Zertifikatsprüfung wird also NICHT schwächer, sie bleibt gegen den
// Namen gerichtet, während die Verbindung auf die geprüfte Zahl geht).
//
// WAS DER WECHSEL ZUSÄTZLICH BRINGT: `node:https` folgt von sich aus KEINER Umleitung. Die Härtung
// `redirect:"error"` war beim Inhaltsweg eine Option, die man vergessen kann; jetzt ist sie die
// Bauform — eine 302 kommt hier als Statuszahl an und fällt durch `istErfolg` auf „nicht erreichbar".
//
// UND WAS ER KOSTET, ehrlich: der Metadatenweg (Liste, Merkmale) läuft weiter über `fetch`. Er ist
// auf die KONFIGURIERTE Basis-Origin gepinnt — eine Adresse, die der Betreiber setzt und nicht die
// Gegenstelle. Die Zieladresse, die ein Fremder bestimmt, ist allein die Downloadadresse, und genau
// die ist ab hier gebunden.

/** Was der Inhaltsweg von einer Verbindung zurückbekommt. `bytes: null` heisst „über der Kante". */
export interface SharePointInhaltsAntwort {
  readonly status: number;
  readonly bytes: Buffer | null;
}

/**
 * Der Verbindungsaufbau des Inhaltswegs als VERTRAG — injizierbar aus demselben Grund wie `fetchFn`:
 * ein Weg, der nur mit echtem Netz messbar wäre, wäre gar nicht gemessen.
 */
export type SharePointInhaltsTransport = (
  url: string,
  optionen: {
    readonly adresse: string;
    readonly akzeptiert: string;
    readonly maxBytes: number;
    /**
     * Die UNTÄTIGKEITSGRENZE des Sockets, gedeckelt auf die Restzeit der absoluten Frist. Sie ist
     * die zweite Sicherung, nicht die erste — die erste ist `abbruch`.
     */
    readonly timeoutMs: number;
    /**
     * DIE ABSOLUTE FRIST, als Signal. Sie steht hier und nicht nur als Zahl daneben, weil eine
     * Grenze, die niemand durchsetzt, keine ist: Wer diesen Vertrag erfüllt, MUSS bei `abort` seine
     * Verbindung beenden (s. `starteInhaltsfrist`, bens Korrekturpflicht 1 aus Runde 3).
     */
    readonly abbruch: AbortSignal;
  },
) => Promise<SharePointInhaltsAntwort>;

// ================================================================================================
// JOB 4232 RUNDE 4 — EINE UNTÄTIGKEITSGRENZE IST KEINE FRIST (bens Korrekturpflicht 1).
// ================================================================================================
//
// DER BEFUND, den Runde 3 sich eingehandelt hat: `timeout:` an `node:https` ist eine Grenze für
// UNTÄTIGKEIT — sie läuft bei jedem empfangenen Byte neu los. Eine Gegenstelle, die alle 40 ms ein
// Datenstück schickt, hält den Abruf damit beliebig lange fest, ohne die Grenze je zu verletzen; Ben
// hat es gemessen („expected 'pending' to be 'rejected'"). Dasselbe galt für die Namensauflösung, die
// VOR jeder Verbindung liegt und von keiner Transportgrenze gedeckt war.
//
// WAS AB HIER GILT: Eine Uhr, die beim ERSTEN Schritt des Inhaltswegs anläuft und BEIDE Teile deckt —
// Auflösung und Download. Läuft sie ab, geschieht zweierlei, und beides ist nötig:
//   1. DER AUFRUFER WIRD FREI. Das Rennen gegen `abgelaufen` endet, auch wenn der Transport ein
//      fremder ist, der das Signal nicht kennt (dieselbe Bauform wie beim Metadatenweg, s. `holeJson`).
//   2. DIE VERBINDUNG WIRD BEENDET. Das Signal geht in den Transport, und `gebundenerTransport`
//      baut seine Anfrage darauf ab. Ein freigegebener Aufrufer über einem weiterlaufenden Socket
//      wäre die halbe Lösung — und die teurere, weil unsichtbar.
//
// EHRLICH GESAGT, WAS SIE NICHT KANN: `dns.lookup` kennt kein Abbruchsignal. Die Auflösung selbst
// läuft im Betriebssystem zu Ende; was die Frist sperrt, ist der WEG DANACH — nach ihrem Ablauf wird
// keine Verbindung mehr aufgebaut und kein Ergebnis mehr verwendet. Der Aufrufer wartet nicht.
interface Inhaltsfrist {
  /** Für den Transport: hierauf wird die Verbindung abgebaut. */
  readonly signal: AbortSignal;
  /** Für den Aufrufer: lehnt ab, wenn die Frist fällt. Sie erfüllt NIE. */
  readonly abgelaufen: Promise<never>;
  /** Was von der Frist noch übrig ist — mindestens 1 ms, damit daraus keine „keine Grenze" wird. */
  verbleibend(): number;
  beenden(): void;
}

function starteInhaltsfrist(timeoutMs: number): Inhaltsfrist {
  const regler = new AbortController();
  const ende = Date.now() + timeoutMs;
  const wecker = setTimeout(() => regler.abort(), timeoutMs);
  const abgelaufen = new Promise<never>((_, ablehnen) => {
    regler.signal.addEventListener(
      "abort",
      () => ablehnen(new SharePointRequestError("nicht-erreichbar")),
      { once: true },
    );
  });
  // Eine Ablehnung, der niemand zuhört, ist im Knoten ein unbehandelter Fehler und kann den Prozess
  // beenden. Dieser Griff macht sie behandelt; die Rennen darüber bekommen ihre Ablehnung trotzdem —
  // `catch` erzeugt eine ABGELEITETE Zusage und nimmt der ursprünglichen nichts weg.
  void abgelaufen.catch(() => undefined);
  return {
    signal: regler.signal,
    abgelaufen,
    verbleibend: () => Math.max(1, ende - Date.now()),
    beenden: () => clearTimeout(wecker),
  };
}

/**
 * Die Namensauflösung, die IMMER dieselbe geprüfte Adresse liefert — der Kern der Bindung.
 *
 * Sie ignoriert den Hostnamen, den sie bekommt, und das ist der Punkt: Zwischen Prüfung und
 * Verbindung kann die echte Auflösung das Ziel nicht mehr verschieben. Rein und ohne Netz prüfbar.
 */
export function pinneAufAdresse(adresse: string): LookupFunction {
  const familie = adresse.includes(":") ? 6 : 4;
  return ((
    _hostname: string,
    optionen: unknown,
    rueckruf?: (fehler: null, adressen: unknown, familie?: number) => void,
  ): void => {
    const melde = (typeof optionen === "function" ? optionen : rueckruf) as (
      fehler: null,
      adressen: unknown,
      familie?: number,
    ) => void;
    const alle =
      typeof optionen === "object" && optionen !== null && "all" in optionen
        ? (optionen as { all?: boolean }).all === true
        : false;
    if (alle) {
      melde(null, [{ address: adresse, family: familie }]);
      return;
    }
    melde(null, adresse, familie);
  }) as unknown as LookupFunction;
}

/**
 * Der gebundene Transport des Betriebs: eine Verbindung auf die geprüfte Adresse, TLS gegen den
 * Namen, keine Umleitung, harte Bytegrenze — und ZWEI Zeitgrenzen, die verschiedene Dinge tun:
 *
 *   `timeout:`  — die Untätigkeitsgrenze des Sockets. Sie fängt die Verbindung, die STEHT.
 *   `abbruch`   — die absolute Frist. Sie fängt die Verbindung, die LÄUFT und nicht aufhört.
 *
 * Die zweite war bis Runde 3 nicht da, und genau dort lag bens Befund: ein Dauerstrom aus kleinen
 * Datenstücken verletzt die erste nie. Beide enden hier an derselben Stelle — `destroy`, also eine
 * wirklich geschlossene Verbindung, nicht nur ein freigegebener Aufrufer.
 */
function gebundenerTransport(
  url: string,
  optionen: Parameters<SharePointInhaltsTransport>[1],
): Promise<SharePointInhaltsAntwort> {
  return new Promise<SharePointInhaltsAntwort>((erfuellen, ablehnen) => {
    // Der Horcher auf die Frist wird wieder abgemeldet, sobald dieser Weg entschieden ist: eine
    // Frist, die auf eine längst beendete Anfrage feuert, wäre ein Leck und ein Rätsel im Protokoll.
    let aufAbbruch: (() => void) | null = null;
    const abmelden = (): void => {
      if (aufAbbruch !== null) {
        optionen.abbruch.removeEventListener("abort", aufAbbruch);
        aufAbbruch = null;
      }
    };
    const fertig = (wert: SharePointInhaltsAntwort): void => {
      abmelden();
      erfuellen(wert);
    };
    const gescheitert = (fehler: Error): void => {
      abmelden();
      ablehnen(fehler);
    };

    const anfrage = httpsRequest(
      url,
      {
        method: "GET",
        headers: { accept: optionen.akzeptiert },
        lookup: pinneAufAdresse(optionen.adresse),
        timeout: optionen.timeoutMs,
      },
      (antwort) => {
        const stuecke: Buffer[] = [];
        let gelesen = 0;
        // Die angekündigte Grösse beendet den Weg, bevor ein einziges Byte gelesen wird.
        const angekuendigt = Number(antwort.headers["content-length"]);
        if (Number.isFinite(angekuendigt) && angekuendigt > optionen.maxBytes) {
          antwort.destroy();
          fertig({ status: antwort.statusCode ?? 0, bytes: null });
          return;
        }
        antwort.on("data", (stueck: Buffer) => {
          gelesen += stueck.byteLength;
          if (gelesen > optionen.maxBytes) {
            antwort.destroy();
            fertig({ status: antwort.statusCode ?? 0, bytes: null });
            return;
          }
          stuecke.push(stueck);
        });
        antwort.on("end", () => {
          fertig({ status: antwort.statusCode ?? 0, bytes: Buffer.concat(stuecke) });
        });
        // EIN ABGEBROCHENER STROM IST KEIN HALBER TEXT: der Fehler reist nach oben und wird dort
        // zur Lage `nicht-erreichbar`. Was hier NIE herauskommt, ist ein unvollständiger Puffer.
        antwort.on("error", gescheitert);
      },
    );
    // DIE ABSOLUTE FRIST BEENDET DIE VERBINDUNG WIRKLICH. `destroy` schliesst den Socket und meldet
    // sich als `error` — der Weg endet damit in derselben Lage wie jeder andere Netzabbruch, und es
    // bleibt kein Strom zurück, der weiterliest, während oben schon niemand mehr wartet.
    if (optionen.abbruch.aborted) {
      anfrage.destroy(new Error("Frist"));
    } else {
      aufAbbruch = (): void => {
        anfrage.destroy(new Error("Frist"));
      };
      optionen.abbruch.addEventListener("abort", aufAbbruch, { once: true });
    }
    anfrage.on("timeout", () => {
      anfrage.destroy(new Error("Frist"));
    });
    anfrage.on("error", gescheitert);
    anfrage.end();
  });
}

/**
 * Der Medientyp einer Datei, wie die QUELLE ihn nennt — ohne Parameter (`; charset=…`), klein
 * geschrieben. `null`, wenn die Quelle keinen nennt: „unbekannt" ist von „text/plain" zu
 * unterscheiden, und aus einem fehlenden Typ wird hier NICHTS geraten.
 */
export function sharepointMedientyp(item: GraphDriveItem): string | null {
  const roh = item.file?.mimeType?.split(";")[0]?.trim().toLowerCase();
  return roh && roh.length > 0 ? roh : null;
}

/**
 * Was die Merkmale über den Inhalt hergeben — die Aussage der VORSCHAU.
 *
 * SIE RUHT AUF EINER MESSUNG DER QUELLE und nicht auf dem Dateinamen: Grundlage sind der Medientyp
 * und die Grösse aus dem DriveItem-Vertrag. Eine `.txt`-Endung ohne gemeldeten Medientyp genügt
 * ausdrücklich NICHT — sie ist eine Behauptung des Namens, keine der Datei.
 */
export function sharepointInhaltsvorschau(
  item: GraphDriveItem,
  maxBytes: number = SHAREPOINT_MAX_TEXT_BYTES,
): SharePointInhaltsvorschau {
  if (sharepointMedientyp(item) !== SHAREPOINT_TEXT_MIME) {
    return "nur-merkmale";
  }
  const groesse = item.size;
  if (typeof groesse === "number" && Number.isFinite(groesse)) {
    if (groesse > maxBytes) {
      return "zu-gross";
    }
    if (groesse === 0) {
      return "leer";
    }
  }
  return "text";
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
   * DER METADATENWEG: Liste und Merkmale. Gepinnte Origin, MIT Token, JSON.
   *
   * JOB 4232 R3 — HIER STAND BIS ZU DIESER RUNDE EIN GEMEINSAMER NETZWEG für Metadaten UND Inhalt,
   * mit zwei Stellschrauben (Zielprüfung, Token ja/nein). Der Inhaltsweg ist ausgezogen: er baut
   * seine Verbindung selbst auf, um sie an die geprüfte Adresse zu binden
   * (`gebundenerTransport`, bens Korrekturpflicht 1). Was hier bleibt, ist ein Weg mit EINEM
   * Aufrufer — und er wird deshalb wieder als das geschrieben, was er ist, statt eine Generik zu
   * behalten, die niemand mehr benutzt. Der Token steht damit auch nicht mehr hinter einer
   * Bedingung: auf DIESEM Weg geht er immer mit, auf dem anderen gibt es ihn gar nicht.
   *
   * Die drei Härtungen dieses Wegs sind unverändert: Origin-Pin, `redirect:"error"`, Frist und
   * Grössenkante.
   */
  private async holeJson(url: string, erlaubteOrigin: string): Promise<unknown> {
    pruefeGraphUrl(url, erlaubteOrigin);
    const maxBytes = this.config.maxResponseBytes ?? SHAREPOINT_MAX_RESPONSE_BYTES;
    const fetchFn = this.config.fetchFn ?? fetch;
    const timeoutMs = this.config.timeoutMs ?? SHAREPOINT_REQUEST_TIMEOUT_MS;
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
  async holeDatei(itemId: string, mitInhaltsadresse = false): Promise<GraphDriveItem> {
    const erlaubteOrigin = this.erlaubteOrigin();
    const params = new URLSearchParams({
      $select: mitInhaltsadresse ? SELECT_INHALT : SELECT,
    });
    const url = `${this.baseUrl}/drives/${encodeURIComponent(this.driveId)}/items/${encodeURIComponent(itemId)}?${params.toString()}`;
    const daten = await this.holeJson(url, erlaubteOrigin);
    if (!daten || typeof daten !== "object" || typeof (daten as { id?: unknown }).id !== "string") {
      throw new SharePointRequestError("nicht-gefunden");
    }
    return daten as GraphDriveItem;
  }

  /**
   * JOB 4232 — DER INHALT EINER DATEI, ODER DIE EHRLICHE AUSKUNFT, WARUM NICHT.
   *
   * Die vier Fehlerlagen WERFEN weiterhin (Recht, Bestand, Zugang, Netz) — daran ändert dieser Weg
   * nichts. Was er ZURÜCKGIBT, ist ein Befund über den Inhalt, und jeder Befund ausser `text` heisst:
   * es gibt keinen Text, und es wird auch keiner erfunden.
   *
   * KEIN ZWEITER ABRUF AUF VERDACHT: Ist der Typ nicht `text/plain`, die Datei leer oder zu gross,
   * steht der Befund schon an den Merkmalen fest — und es geht gar kein Inhaltsabruf hinaus.
   */
  async holeTextInhalt(item: GraphDriveItem): Promise<SharePointInhalt> {
    const maxBytes = this.maxTextBytes();
    const vorschau = sharepointInhaltsvorschau(item, maxBytes);
    if (vorschau !== "text") {
      return { art: vorschau };
    }
    const adresse = item["@microsoft.graph.downloadUrl"]?.trim();
    if (!adresse) {
      // Die Quelle nennt keine Inhaltsadresse. Das ist kein Netzfehler und keine Rechtefrage — es
      // heisst schlicht: gelesen wurde nichts. Ein geratener `/content`-Pfad wäre die Umleitung, der
      // dieser Client bewusst nicht folgt (Härtung 2).
      return { art: "unlesbar" };
    }
    const bytes = await this.holeBytes(adresse, maxBytes);
    if (bytes === null) {
      // Über der Kante — und zwar an den WIRKLICH gelesenen Bytes gemessen, nicht an der Zahl, die
      // die Quelle angekündigt hat. Ein halber Text entsteht nicht.
      return { art: "zu-gross" };
    }
    const text = dekodiereText(bytes);
    if (text === null) {
      return { art: "unlesbar" };
    }
    // „Leer" ist eine eigene Aussage: die Datei wurde gelesen, und sie trägt keinen Text. Das ist
    // weder „übernommen" noch „nur Merkmale".
    return text.trim().length === 0 ? { art: "leer" } : { art: "text", text };
  }

  /** Die Inhaltskante dieses Clients — höchstens die eigene, nie die grössere Antwortkante. */
  private maxTextBytes(): number {
    return Math.min(
      this.config.maxTextBytes ?? SHAREPOINT_MAX_TEXT_BYTES,
      this.config.maxResponseBytes ?? SHAREPOINT_MAX_RESPONSE_BYTES,
    );
  }

  /**
   * Die Rohbytes einer vorautorisierten Downloadadresse — OHNE Zugangsmerkmal. `null` heisst „über
   * der Kante"; das ist eine Tatsache über die Datei und keine Fehlerlage, deshalb kein Wurf.
   *
   * JOB 4232 R3 — DIESER WEG GEHT NICHT MEHR ÜBER `fetch`. Erst wird das Ziel geprüft UND die
   * Adresse festgehalten, dann wird die Verbindung an genau diese Adresse gebunden (Begründung am
   * Kopf von `gebundenerTransport`). Der Metadatenweg darüber bleibt unverändert bei `fetch`: seine
   * Origin bestimmt der Betreiber, nicht die Gegenstelle.
   *
   * KEIN ZUGANGSMERKMAL: hier gibt es keinen Zweig, der einen Bearer setzen könnte — der Kopf wird
   * gar nicht erst gebaut.
   */
  private async holeBytes(url: string, maxBytes: number): Promise<Buffer | null> {
    // JOB 4232 R4 — DIE UHR LÄUFT AB HIER, und sie deckt BEIDE Teile: die Auflösung und den
    // Download. Bis Runde 3 hatte die Auflösung gar keine Grenze und der Download nur eine
    // Untätigkeitsgrenze (s. `starteInhaltsfrist`, bens Korrekturpflicht 1).
    const frist = starteInhaltsfrist(this.config.timeoutMs ?? SHAREPOINT_REQUEST_TIMEOUT_MS);
    try {
      let antwort: SharePointInhaltsAntwort;
      try {
        // Das Rennen gilt auch hier: `dns.lookup` kennt kein Abbruchsignal, also wird der AUFRUFER
        // freigegeben — und weil danach geworfen wird, entsteht keine Verbindung mehr.
        const adresse = await Promise.race([
          pruefeDownloadZiel(url, this.config.aufloeseFn ?? standardAufloesung),
          frist.abgelaufen,
        ]);
        const transport = this.config.inhaltsTransport ?? gebundenerTransport;
        antwort = await Promise.race([
          transport(url, {
            adresse,
            akzeptiert: `${SHAREPOINT_TEXT_MIME}, */*;q=0.1`,
            maxBytes,
            // Die Untätigkeitsgrenze bekommt nur noch, was von der absoluten Frist übrig ist: ein
            // Transport, der allein auf die Zahl schaut, kann sie damit nicht überziehen.
            timeoutMs: frist.verbleibend(),
            abbruch: frist.signal,
          }),
          frist.abgelaufen,
        ]);
      } catch (err) {
        // DER ROHE FEHLER VERLÄSST DIESE KLASSE NIE — weder als Message noch als `cause`.
        if (sharepointFehlerlage(err) !== null) {
          throw err;
        }
        throw new SharePointRequestError("nicht-erreichbar");
      }
      const lage = statusLage(antwort.status);
      if (lage !== null) {
        throw new SharePointRequestError(lage);
      }
      // Alles ausser 2xx — auch eine UMLEITUNG, der dieser Weg bewusst nicht folgt.
      if (antwort.status < 200 || antwort.status >= 300) {
        throw new SharePointRequestError("nicht-erreichbar");
      }
      return antwort.bytes;
    } finally {
      frist.beenden();
    }
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

// JOB 4232 R3 — HIER STAND `leseBytesBegrenzt`, der Bytezähler über einem `fetch`-Body. Der
// Inhaltsweg baut seine Verbindung seit dieser Runde selbst auf (`gebundenerTransport`) und zählt
// die Bytes dort, wo sie ankommen. Der alte Leser hatte damit keinen Aufrufer mehr und ist ENTFERNT,
// nicht danebengelassen.

/**
 * JOB 4232 — BYTES → TEXT, ODER GAR NICHTS.
 *
 * `null` heisst „nicht als Text lesbar", und das ist eine ehrliche Wissenslücke: die Bytes liegen
 * vor, aber sie ergeben keinen Text, den dieses Produkt verantworten kann.
 *
 * STRENG DEKODIERT (`fatal: true`): Der bequeme Weg (`toString("utf8")`) ersetzt jedes ungültige Byte
 * durch U+FFFD und liefert IMMER eine Zeichenkette — aus einer Datei in einer fremden Kodierung
 * entstünde so ein Text voller Fragezeichen, der aussieht wie Inhalt und keiner ist. Genau diese
 * Sorte Schein verbietet der Auftrag.
 *
 * Eine BOM wird entfernt (sie ist Kodierbeiwerk, kein Zeichen des Textes); ein NUL-Byte lässt die
 * Datei durchfallen — es ist gültiges Unicode, aber kein Zeichen, das in einem Text vorkommt, und in
 * der Praxis das Zeichen einer Binärdatei mit falsch gemeldetem Medientyp.
 */
function dekodiereText(bytes: Buffer): string | null {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
  // Escape-frei geschrieben, damit in dieser Datei kein unsichtbares Zeichen im Quelltext steht:
  // 0xFEFF ist die BOM, 0 das NUL-Byte.
  const ohneBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  return ohneBom.indexOf(String.fromCharCode(0)) !== -1 ? null : ohneBom;
}
