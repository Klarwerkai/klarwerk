// ================================================================================================
// R-0170 — DER LESENDE JIRA-CLIENT: VORGÄNGE EINES PROJEKTS UND SEINE PROJEKTROLLEN.
// ================================================================================================
//
// Er spricht den VERTRAG der Jira-REST-API v2 an, nicht das Netz: `fetchFn` ist injizierbar, und
// jeder Test dieses Moduls setzt ein Vertragsdouble ein (dieselbe Bauform wie Confluence und
// SharePoint). Es gibt in diesem Modul KEINEN Testfall, der einen echten Aufruf hinauslässt.
//
// GENAU VIER LESEWEGE, ALLE `GET`:
//   1. eine Ergebnisseite der Vorgänge des Projekts (JQL `project = "KEY" ORDER BY key ASC`),
//   2. ein einzelner Vorgang über seinen Schlüssel,
//   3. die Rollenliste des Projekts,
//   4. die Besetzung EINER Rolle (Benutzer und Gruppen).
//
// ZWEI SUCHVERTRÄGE, EIN CURSOR. Jira Cloud blättert die Suche über `GET /rest/api/2/search/jql`
// mit einem undurchsichtigen `nextPageToken`; Jira Data Center/Server über `GET /rest/api/2/search`
// mit `startAt`. Welcher gilt, folgt aus dem Anmeldeweg (`cloud` → Cloud, `pat` → Data Center). Nach
// aussen gibt es EINEN Begriff: `weiter` — eine Zeichenkette, die nur dieser Client deutet.
//
// DIE DREI HÄRTUNGEN SIND DIESELBEN WIE BEIM SHAREPOINT-CLIENT:
//   1. HTTPS-ORIGIN-PINNING. Jede Ziel-URL muss https sein UND die Origin der konfigurierten
//      Basisadresse tragen. Die Rollenadressen, die Jira in seiner Antwort nennt, werden NICHT
//      angesprungen — dieser Client nimmt daraus nur die Rollenkennung und baut die Adresse selbst.
//   2. `redirect: "error"`. Kein Folgen auf einen fremden Host, also kein Token an ein Umleitungsziel.
//   3. FRIST UND GRÖSSENKANTE.
//
// KEIN FREMDER TEXT VERLÄSST DIESE DATEI. Jeder Fehler ist ein `JiraRequestError` mit einem festen
// Satz je Lage; eine fremde Meldung, ein Stack oder eine Ziel-URL wird nirgends übernommen.
//
// DER TOKEN LEBT NUR IN DER CLOSURE. `jiraClientFromEnv` liest ihn aus der Umgebung und gibt einen
// CLIENT zurück, nie den Token und nie eine token-tragende Config.

import {
  type JiraAuthMode,
  istHttpsAdresse,
  istProjektschluessel,
  jiraAuthMode,
} from "./credential-state";

/** Config INKL. Zugangsmerkmal — modul-intern (NICHT über die Paket-index re-exportiert). */
export interface JiraRestConfig {
  /** https-Basisadresse der Jira-Instanz, z. B. `https://firma.atlassian.net`. */
  baseUrl: string;
  /** Der Projektschlüssel, auf den dieser Client gescoped ist. */
  projectKey: string;
  authMode: JiraAuthMode;
  /** Nur Cloud: die Kennung (E-Mail) zum API-Token. */
  user?: string;
  /** API-Token (Cloud) bzw. persönliches Zugriffstoken (Data Center). NIE loggen, nie zurückgeben. */
  token: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  maxResponseBytes?: number;
  /** Vorgänge je Ergebnisseite. */
  pageLimit?: number;
}

export const JIRA_REQUEST_TIMEOUT_MS = 15_000;
export const JIRA_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
export const JIRA_PAGE_LIMIT = 50;
/** Höchstzahl gelesener Projektrollen — Sicherheitsnetz gegen eine unbegrenzte Rollenliste. */
export const JIRA_MAX_ROLLEN = 50;

/**
 * Die Lagen, die der Server WIRKLICH unterscheiden kann — dieselben vier wie bei SharePoint, plus
 * eine fünfte, die es nur hier gibt:
 *
 *   `rollen-nicht-lesbar` — die Vorgänge sind lesbar, die Besetzung der Projektrollen aber nicht
 *   (Jira verlangt dafür das Recht, das Projekt zu verwalten). Ohne Rollen gibt es keine Leserechte,
 *   und ein Vorgang ohne Leserechte sähe am Herkunftsanker aus wie ein uneingeschränkt lesbarer.
 *   Deshalb wird in dieser Lage NICHTS übernommen, und der Mensch liest genau diesen Grund.
 */
export type JiraFehlerlage =
  | "keine-berechtigung"
  | "nicht-gefunden"
  | "abgelaufen"
  | "nicht-erreichbar"
  | "rollen-nicht-lesbar";

const LAGE_MELDUNG: Record<JiraFehlerlage, string> = {
  "keine-berechtigung": "Jira: Das hinterlegte Konto darf diese Quelle nicht lesen.",
  "nicht-gefunden": "Jira: Die Quelle ist dort nicht (mehr) vorhanden.",
  abgelaufen: "Jira: Das hinterlegte Zugangsmerkmal gilt nicht mehr.",
  "nicht-erreichbar": "Jira: Die Quelle hat nicht brauchbar geantwortet.",
  "rollen-nicht-lesbar": "Jira: Die Projektrollen sind mit dem hinterlegten Konto nicht lesbar.",
};

/**
 * Der EINE Fehlertyp dieses Moduls. Modul-intern — nach aussen führt `jiraFehlerlage` die Lage,
 * nicht die Klasse. Die Meldung nennt NIE Host, URL oder Token.
 */
export class JiraRequestError extends Error {
  readonly lage: JiraFehlerlage;

  constructor(lage: JiraFehlerlage) {
    super(LAGE_MELDUNG[lage]);
    this.name = "JiraRequestError";
    this.lage = lage;
  }
}

/** Die Lage eines gefangenen Fehlers — oder `null`, wenn er nicht aus diesem Modul stammt. */
export function jiraFehlerlage(err: unknown): JiraFehlerlage | null {
  if (!err || typeof err !== "object" || !("lage" in err)) {
    return null;
  }
  const lage = (err as { lage: unknown }).lage;
  return typeof lage === "string" && lage in LAGE_MELDUNG ? (lage as JiraFehlerlage) : null;
}

/** Ein Jira-Vorgang, so wie die REST-API v2 ihn liefert. Gelesen wird NUR, was hier steht. */
export interface JiraIssue {
  id?: string;
  key?: string;
  fields?: {
    summary?: string;
    /** v2 liefert die Beschreibung als Zeichenkette (Wiki-Markup); alles andere wird nicht gelesen. */
    description?: unknown;
    labels?: unknown;
    /** Zeitpunkt der letzten Änderung, z. B. `2026-09-01T10:00:00.000+0200`. */
    updated?: string;
    issuetype?: { name?: string; hierarchyLevel?: number; subtask?: boolean };
    /** Der übergeordnete Vorgang (Cloud: auch das Epic einer Story). */
    parent?: { key?: string; fields?: { summary?: string } };
    reporter?: { displayName?: string } | null;
    creator?: { displayName?: string } | null;
    /** Sicherheitsstufe des Vorgangs. Gesetzt heisst: enger lesbar als das Projekt. */
    security?: { id?: string; name?: string } | null;
    project?: { key?: string };
  };
}

/** Ein Rolleninhaber, so wie `GET /project/{key}/role/{id}` ihn liefert. */
interface JiraRollenAkteur {
  type?: string;
  name?: string;
  actorUser?: { accountId?: string };
  actorGroup?: { name?: string; groupId?: string };
}

/** Die Benutzer- und Gruppenkennungen ALLER Projektrollen, in Quell-Reihenfolge, ohne Doppelte. */
export interface JiraRollenbesetzung {
  users: string[];
  groups: string[];
  /** Die gelesenen Rollennamen — nur für die Auskunft, keine Rechteposition. */
  rollen: string[];
}

// Genau die Felder, die der Mapper braucht.
const FELDER =
  "summary,description,labels,updated,issuetype,parent,reporter,creator,security,project";

/**
 * Erlaubt genau dann, wenn die URL https ist UND ihre Origin exakt der gepinnten entspricht.
 * Sonst Abbruch — VOR jedem Netzaufruf.
 */
export function pruefeJiraUrl(url: string, erlaubteOrigin: string): void {
  let geparst: URL;
  try {
    geparst = new URL(url);
  } catch {
    throw new JiraRequestError("nicht-erreichbar");
  }
  if (geparst.protocol !== "https:" || geparst.origin !== erlaubteOrigin) {
    throw new JiraRequestError("nicht-erreichbar");
  }
}

/** Höchstlänge eines Cursors — ein Cloud-`nextPageToken` ist deutlich kürzer. */
const MAX_WEITER = 2048;

export class JiraRestClient {
  constructor(private readonly config: JiraRestConfig) {}

  /** Nicht-geheime Config nach aussen (für die Provenienz). KEIN Token-Getter. */
  get baseUrl(): string {
    return this.config.baseUrl.replace(/\/+$/, "");
  }
  get projectKey(): string {
    return this.config.projectKey;
  }

  /**
   * Ist `weiter` ein Cursor, den DIESER Client deuten kann? Cloud: ein nicht leeres Token ohne
   * Leer- und Steuerzeichen. Data Center: eine Startposition (Ziffern).
   */
  istGueltigerCursor(weiter: string): boolean {
    if (weiter.length === 0 || weiter.length > MAX_WEITER) {
      return false;
    }
    return this.config.authMode === "pat"
      ? /^\d{1,9}$/.test(weiter)
      : /^[\x21-\x7e]+$/.test(weiter);
  }

  private erlaubteOrigin(): string {
    if (!istHttpsAdresse(this.baseUrl)) {
      throw new JiraRequestError("nicht-erreichbar");
    }
    return new URL(this.baseUrl).origin;
  }

  private anmeldung(): string {
    if (this.config.authMode === "pat") {
      return `Bearer ${this.config.token}`;
    }
    const paar = `${this.config.user ?? ""}:${this.config.token}`;
    return `Basic ${Buffer.from(paar, "utf8").toString("base64")}`;
  }

  /** Der EINE Netzweg: gepinnte Origin, mit Anmeldung, JSON, Frist und Grössenkante. */
  private async holeJson(url: string): Promise<unknown> {
    pruefeJiraUrl(url, this.erlaubteOrigin());
    const maxBytes = this.config.maxResponseBytes ?? JIRA_MAX_RESPONSE_BYTES;
    const fetchFn = this.config.fetchFn ?? fetch;
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs ?? JIRA_REQUEST_TIMEOUT_MS,
    );
    // Die Frist wird gegen den Aufruf GERACET: ein fetch, das das Abbruchsignal nicht kennt, kann
    // den Aufrufer sonst trotzdem festhalten.
    const frist = new Promise<never>((_, reject) => {
      controller.signal.addEventListener(
        "abort",
        () => reject(new JiraRequestError("nicht-erreichbar")),
        { once: true },
      );
    });
    try {
      let res: Response;
      try {
        res = await Promise.race([
          fetchFn(url, {
            method: "GET",
            headers: { authorization: this.anmeldung(), accept: "application/json" },
            redirect: "error",
            signal: controller.signal,
          }),
          frist,
        ]);
      } catch {
        // DER ROHE FETCH-FEHLER VERLÄSST DIESE KLASSE NIE — weder als Message noch als `cause`.
        throw new JiraRequestError("nicht-erreichbar");
      }
      const lage = statusLage(res.status);
      if (lage !== null) {
        throw new JiraRequestError(lage);
      }
      if (!res.ok) {
        throw new JiraRequestError("nicht-erreichbar");
      }
      try {
        return await Promise.race([leseBegrenzt(res, maxBytes), frist]);
      } catch (err) {
        if (jiraFehlerlage(err) !== null) {
          throw err;
        }
        throw new JiraRequestError("nicht-erreichbar");
      }
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * EINE Ergebnisseite der Vorgänge des Projekts, samt Cursor auf die nächste (`null` = letzte).
   *
   * „Berechtigt" ist keine eigene Filterung dieses Produkts: Jira liefert genau die Vorgänge, die
   * das hinterlegte Konto sehen darf. Epics sind Vorgänge desselben Projekts und kommen mit.
   */
  async listeVorgangsSeite(
    weiter: string | null,
  ): Promise<{ issues: JiraIssue[]; weiter: string | null }> {
    if (weiter !== null && !this.istGueltigerCursor(weiter)) {
      throw new JiraRequestError("nicht-erreichbar");
    }
    const limit = String(this.config.pageLimit ?? JIRA_PAGE_LIMIT);
    const jql = `project = "${this.projectKey}" ORDER BY key ASC`;
    if (this.config.authMode === "pat") {
      const start = weiter === null ? 0 : Number(weiter);
      const params = new URLSearchParams({
        jql,
        startAt: String(start),
        maxResults: limit,
        fields: FELDER,
      });
      const daten = (await this.holeJson(`${this.baseUrl}/rest/api/2/search?${params}`)) as {
        issues?: unknown;
        total?: unknown;
      };
      const issues = alsVorgaenge(daten?.issues);
      const naechste = start + issues.length;
      const gesamt = typeof daten?.total === "number" ? daten.total : naechste;
      return {
        issues,
        weiter: issues.length > 0 && naechste < gesamt ? String(naechste) : null,
      };
    }
    const params = new URLSearchParams({ jql, maxResults: limit, fields: FELDER });
    if (weiter !== null) {
      params.set("nextPageToken", weiter);
    }
    const daten = (await this.holeJson(`${this.baseUrl}/rest/api/2/search/jql?${params}`)) as {
      issues?: unknown;
      nextPageToken?: unknown;
      isLast?: unknown;
    };
    const token = daten?.nextPageToken;
    const naechste = daten?.isLast !== true && typeof token === "string" ? token : null;
    return {
      issues: alsVorgaenge(daten?.issues),
      weiter: naechste !== null && this.istGueltigerCursor(naechste) ? naechste : null,
    };
  }

  /**
   * EIN Vorgang über seinen Schlüssel. Ein 404 ist die Lage `nicht-gefunden`. Gehört der Vorgang
   * zu einem ANDEREN Projekt, gilt er hier ebenso als nicht gefunden: dieser Client ist auf ein
   * Projekt gescoped, und die Leserechte, die er dazu liest, sind die DIESES Projekts.
   */
  async holeVorgang(schluessel: string): Promise<JiraIssue> {
    const params = new URLSearchParams({ fields: FELDER });
    const url = `${this.baseUrl}/rest/api/2/issue/${encodeURIComponent(schluessel)}?${params}`;
    const daten = (await this.holeJson(url)) as JiraIssue | null;
    if (!daten || typeof daten !== "object" || typeof daten.key !== "string") {
      throw new JiraRequestError("nicht-gefunden");
    }
    if (daten.fields?.project?.key?.toUpperCase() !== this.projectKey.toUpperCase()) {
      throw new JiraRequestError("nicht-gefunden");
    }
    return daten;
  }

  /**
   * Die Besetzung ALLER Projektrollen: wer über eine Rolle in diesem Projekt steht.
   *
   * Gelesen wird die Rollenliste (`/project/{key}/role`, Name → Adresse) und je Rolle ihre
   * Besetzung. Aus der Adresse nimmt dieser Client nur die Rollenkennung; aufgerufen wird die selbst
   * gebaute Adresse auf der gepinnten Origin. Eine Rolle ohne lesbare Kennung wird nicht geraten,
   * sondern macht den Lauf `nicht-erreichbar` — eine still ausgelassene Rolle wäre ein fehlendes
   * Leserecht, das niemand sähe.
   */
  async leseRollenbesetzung(): Promise<JiraRollenbesetzung> {
    const projekt = encodeURIComponent(this.projectKey);
    const liste = await this.holeJson(`${this.baseUrl}/rest/api/2/project/${projekt}/role`);
    if (!liste || typeof liste !== "object" || Array.isArray(liste)) {
      throw new JiraRequestError("nicht-erreichbar");
    }
    const eintraege = Object.entries(liste as Record<string, unknown>);
    if (eintraege.length > JIRA_MAX_ROLLEN) {
      throw new JiraRequestError("nicht-erreichbar");
    }
    const besetzung: JiraRollenbesetzung = { users: [], groups: [], rollen: [] };
    for (const [rollenname, adresse] of eintraege) {
      const kennung =
        typeof adresse === "string" ? /\/role\/(\d+)\/?$/.exec(adresse)?.[1] : undefined;
      if (kennung === undefined) {
        throw new JiraRequestError("nicht-erreichbar");
      }
      const rollenUrl = `${this.baseUrl}/rest/api/2/project/${projekt}/role/${kennung}`;
      const rolle = (await this.holeJson(rollenUrl)) as { actors?: unknown } | null;
      merke(besetzung.rollen, rollenname);
      const akteure: unknown = rolle?.actors;
      for (const akteur of Array.isArray(akteure) ? akteure : []) {
        trageAkteurEin(besetzung, akteur as JiraRollenAkteur);
      }
    }
    return besetzung;
  }
}

/** Fügt einen nicht leeren Wert an, wenn er noch fehlt (Quell-Reihenfolge bleibt). */
function merke(liste: string[], wert: string | undefined): void {
  const sauber = wert?.trim();
  if (sauber && !liste.includes(sauber)) {
    liste.push(sauber);
  }
}

/**
 * Ein Rolleninhaber → Kennung. Übernommen wird, was die QUELLE als Kennung führt: Benutzer über
 * `accountId` (Cloud), sonst `name` (Data Center: der Benutzername); Gruppen über ihren Namen, sonst
 * ihre `groupId`. Nie über den Anzeigenamen. Ein Inhaber ohne Kennung wird nicht geraten.
 */
function trageAkteurEin(besetzung: JiraRollenbesetzung, akteur: JiraRollenAkteur): void {
  if (!akteur || typeof akteur !== "object") {
    return;
  }
  if (akteur.type === "atlassian-user-role-actor") {
    merke(besetzung.users, akteur.actorUser?.accountId || akteur.name);
  } else if (akteur.type === "atlassian-group-role-actor") {
    merke(besetzung.groups, akteur.actorGroup?.name || akteur.name || akteur.actorGroup?.groupId);
  }
}

function alsVorgaenge(roh: unknown): JiraIssue[] {
  return Array.isArray(roh) ? roh.filter((e): e is JiraIssue => !!e && typeof e === "object") : [];
}

/** Die Statuszahlen, die eine EIGENE Lage tragen. Alles Übrige ist „nicht erreichbar". */
function statusLage(status: number): JiraFehlerlage | null {
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
 * env→CLIENT (nicht env→Config). Der Token wird HIER gelesen und in die Client-Closure gebunden.
 * Fehlt eine Variable, ist der Anmeldeweg unbekannt, die Basisadresse nicht https oder der
 * Projektschlüssel nicht in Schlüsselform, gibt es keinen Client (`undefined`).
 *
 * Modul-intern: von aussen führt der einzige Weg über `createJiraAdapterFromEnv`.
 */
export function jiraClientFromEnv(
  env: Record<string, string | undefined> = process.env,
): JiraRestClient | undefined {
  const authMode = jiraAuthMode(env);
  const baseUrl = env.KLARWERK_JIRA_BASE_URL;
  const token = env.KLARWERK_JIRA_TOKEN;
  const user = env.KLARWERK_JIRA_USER;
  const projectKey = env.KLARWERK_JIRA_PROJECT?.trim();
  if (authMode === null || !baseUrl || !token || !istHttpsAdresse(baseUrl)) {
    return undefined;
  }
  if (!projectKey || !istProjektschluessel(projectKey)) {
    return undefined;
  }
  if (authMode === "cloud") {
    return user ? new JiraRestClient({ baseUrl, projectKey, authMode, user, token }) : undefined;
  }
  return new JiraRestClient({ baseUrl, projectKey, authMode, token });
}

/**
 * Body begrenzt lesen: `content-length` vorab, dann der Stream mit laufender Zählung, sonst —
 * Vertragsdoubles ohne Body-Stream — der gewöhnliche `json()`-Weg.
 */
async function leseBegrenzt(res: Response, maxBytes: number): Promise<unknown> {
  const kopf = (res as { headers?: { get?: (name: string) => string | null } }).headers;
  const angekuendigt = Number(kopf?.get?.("content-length"));
  if (Number.isFinite(angekuendigt) && angekuendigt > maxBytes) {
    throw new JiraRequestError("nicht-erreichbar");
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
          throw new JiraRequestError("nicht-erreichbar");
        }
        stuecke.push(Buffer.from(value));
      }
    }
    return JSON.parse(Buffer.concat(stuecke).toString("utf8"));
  }
  return res.json();
}
