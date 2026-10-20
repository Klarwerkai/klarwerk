import {
  type AnbieterFehlerlage,
  type AnbieterKalender,
  type AnbieterKonto,
  type AnbieterTermin,
  type KalenderAnbieter,
  KalenderAnbieterFehler,
  type KalenderInhalt,
  type Serienart,
  type Teilnehmer,
} from "./klara-kalender-anbindung";

// ================================================================================================
// produkt:20261008:klara-kalender (AW-17) — MICROSOFT 365 ALS ERSTER KALENDERANBIETER.
// ================================================================================================
//
// Spricht den VERTRAG von Microsoft Graph an (`/me`, `/me/calendars`, `…/events`, `…/calendarView`),
// nicht das Netz: `fetchFn` ist injizierbar, jeder Test dieses Moduls setzt ein Vertragsdouble ein —
// dieselbe Bauform wie `services/sharepoint/src/graph-client.ts`. KEIN Testfall lässt einen echten
// Aufruf hinaus. Die Abnahme gegen einen echten, abgegrenzten Microsoft-365-Testkalender steht aus
// und ist hier nicht behauptet (Anbieterzugang, Lizenz und Scopes vorher prüfen — nicht aus einer
// installierten Office-App folgern).
//
// DIE HÄRTUNGEN SIND DIESELBEN WIE BEIM SHAREPOINT-CLIENT:
//   1. HTTPS-ORIGIN-PINNING: jede Ziel-URL ist https und hat die Origin der Basisadresse.
//   2. `redirect: "error"`: kein Token an ein Umleitungsziel.
//   3. FRIST UND GRÖSSENKANTE: eine hängende oder übergroße Antwort hält nichts fest.
//
// DER ZUGANG kommt ausschließlich aus der Betreiber-Einspeisung (`zugang()`); er lebt nur im Aufruf,
// wird nie geloggt, nie in eine URL geschrieben und nie in einen Fehler übernommen. Jeder Fehler, der
// dieses Modul verlässt, ist ein `KalenderAnbieterFehler` mit festem Satz.
//
// ZUORDNUNG OHNE DUBLETTE: Klara legt jedes Ereignis mit ihrem stabilen Mapping-Schlüssel an — als
// `transactionId` (Graph verwirft ein zweites Anlegen mit derselben Kennung) UND als erweiterte
// Eigenschaft, über die eine verlorene Antwort wiedergefunden wird (`sucheVorgang`).
//
// RECHTE: Graph nennt je Kalender `canEdit` und den Besitzer. Daraus folgen die getrennten Rechte
// (lesen; eigene Termine schreiben; geteilten Kalender bearbeiten; einladen). Ob der Zugang die Scopes
// `Calendars.ReadWrite` bzw. `Calendars.ReadWrite.Shared` trägt, zeigt erst die Antwort (403 →
// `recht_fehlt`) — es wird nicht vorab behauptet.

export const M365_TIMEOUT_MS = 15_000;
export const M365_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
export const M365_MAX_TERMINE = 100;

/** Die erweiterte Eigenschaft, unter der Klara ihren Vorgangsschlüssel am Ereignis führt. */
export const M365_VORGANG_EIGENSCHAFT =
  "String {6d1f6c2a-3b8e-4f57-9a43-7e0b5d2c9a11} Name KlarwerkVorgang";

const EREIGNIS_FELDER =
  "id,subject,body,start,end,location,attendees,organizer,type,seriesMasterId,isCancelled,changeKey";

export interface M365KalenderConfig {
  /** https-Basisadresse, z. B. `https://graph.microsoft.com/v1.0`. */
  readonly baseUrl: string;
  /** Der Zugang aus der Betreiber-Einspeisung; `null` heißt: keiner (mehr) vorhanden. */
  readonly zugang: () => Promise<string | null>;
  readonly fetchFn?: typeof fetch;
  readonly timeoutMs?: number;
  readonly maxResponseBytes?: number;
}

interface GraphEmail {
  address?: string;
  name?: string;
}

interface GraphEreignis {
  id?: string;
  subject?: string;
  body?: { content?: string; contentType?: string };
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  location?: { displayName?: string };
  attendees?: { emailAddress?: GraphEmail; status?: { response?: string } }[];
  organizer?: { emailAddress?: GraphEmail };
  type?: string;
  seriesMasterId?: string | null;
  isCancelled?: boolean;
  changeKey?: string;
  "@odata.etag"?: string;
  singleValueExtendedProperties?: { id?: string; value?: string }[];
}

interface GraphKalender {
  id?: string;
  name?: string;
  canEdit?: boolean;
  owner?: GraphEmail;
}

/** Die Lage einer Graph-Antwort — dieselben Unterscheidungen, die der Dienst wirklich braucht. */
export function m365Lage(status: number): AnbieterFehlerlage {
  if (status === 401) {
    return "verbindung_abgelaufen";
  }
  if (status === 403) {
    return "recht_fehlt";
  }
  if (status === 404 || status === 410) {
    return "nicht_gefunden";
  }
  if (status === 409 || status === 412) {
    return "version_geaendert";
  }
  return "anbieter_ausgefallen";
}

function serienart(typ: string | undefined): Serienart {
  if (typ === "seriesMaster") {
    return "serie";
  }
  return typ === "occurrence" || typ === "exception" ? "vorkommen" : "einzel";
}

function antwort(r: string | undefined): Teilnehmer["antwort"] {
  switch (r) {
    case "accepted":
    case "organizer":
      return "zugesagt";
    case "declined":
      return "abgesagt";
    case "tentativelyAccepted":
      return "vorbehalt";
    default:
      return "offen";
  }
}

/** Liest genau die Felder, die Klara kennt — fremder Text bleibt Text, nie Anweisung. */
export function ausGraph(e: GraphEreignis, kalenderId: string): AnbieterTermin {
  if (typeof e.id !== "string" || e.id.length === 0) {
    throw new KalenderAnbieterFehler("anbieter_ausgefallen");
  }
  const vorgang =
    e.singleValueExtendedProperties?.find((p) => p.id === M365_VORGANG_EIGENSCHAFT)?.value ?? null;
  return {
    id: e.id,
    kalenderId,
    version: e["@odata.etag"] ?? e.changeKey ?? "",
    titel: e.subject ?? "",
    beginn: e.start?.dateTime ?? "",
    ende: e.end?.dateTime ?? "",
    zeitzone: e.start?.timeZone ?? "",
    ort: e.location?.displayName ?? "",
    beschreibung: e.body?.content ?? "",
    teilnehmer: (e.attendees ?? []).map((t) => ({
      adresse: t.emailAddress?.address ?? "",
      name: t.emailAddress?.name ?? "",
      antwort: antwort(t.status?.response),
    })),
    serienart: serienart(e.type),
    serienId: e.seriesMasterId ?? null,
    abgesagt: e.isCancelled === true,
    organisator: e.organizer?.emailAddress?.address ?? "",
    vorgang,
  };
}

/** Der Graph-Körper zu Klaras Feldern — NUR die übergebenen; fehlende bleiben beim Anbieter, wie sie sind. */
export function nachGraph(i: Partial<KalenderInhalt>): Record<string, unknown> {
  const k: Record<string, unknown> = {};
  if (i.titel !== undefined) {
    k.subject = i.titel;
  }
  if (i.beschreibung !== undefined) {
    k.body = { contentType: "text", content: i.beschreibung };
  }
  if (i.beginn !== undefined && i.zeitzone !== undefined) {
    k.start = { dateTime: i.beginn, timeZone: i.zeitzone };
  }
  if (i.ende !== undefined && i.zeitzone !== undefined) {
    k.end = { dateTime: i.ende, timeZone: i.zeitzone };
  }
  if (i.ort !== undefined) {
    k.location = { displayName: i.ort };
  }
  if (i.teilnehmer !== undefined) {
    k.attendees = i.teilnehmer.map((t) => ({
      emailAddress: { address: t.adresse, name: t.name },
      type: "required",
    }));
  }
  return k;
}

export class M365KalenderAnbieter implements KalenderAnbieter {
  readonly art = "microsoft365" as const;
  private readonly basis: URL;
  private readonly zugang: () => Promise<string | null>;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxBytes: number;
  private eigeneAdresse: string | null = null;

  constructor(config: M365KalenderConfig) {
    let basis: URL;
    try {
      basis = new URL(config.baseUrl);
    } catch {
      throw new KalenderAnbieterFehler("anbieter_ausgefallen");
    }
    if (basis.protocol !== "https:") {
      throw new KalenderAnbieterFehler("anbieter_ausgefallen");
    }
    this.basis = basis;
    this.zugang = config.zugang;
    this.fetchFn = config.fetchFn ?? fetch;
    this.timeoutMs = config.timeoutMs ?? M365_TIMEOUT_MS;
    this.maxBytes = config.maxResponseBytes ?? M365_MAX_RESPONSE_BYTES;
  }

  private url(pfad: string, query: Record<string, string> = {}): string {
    const u = new URL(`${this.basis.pathname.replace(/\/$/, "")}${pfad}`, this.basis.origin);
    for (const [k, v] of Object.entries(query)) {
      u.searchParams.set(k, v);
    }
    if (u.protocol !== "https:" || u.origin !== this.basis.origin) {
      throw new KalenderAnbieterFehler("anbieter_ausgefallen");
    }
    return u.toString();
  }

  private async ruf(
    methode: "GET" | "POST" | "PATCH" | "DELETE",
    url: string,
    optionen: { koerper?: unknown; version?: string } = {},
  ): Promise<unknown> {
    const token = await this.zugang();
    if (!token) {
      throw new KalenderAnbieterFehler("verbindung_abgelaufen");
    }
    // Beschreibung als Text, nicht als HTML: sonst wäre jedes Nachlesen eine scheinbare Änderung.
    // Zeiten kommen in der Graph-Vorgabe (UTC) zurück; der Feldvergleich nutzt je Seite die eigene Basis.
    const kopf: Record<string, string> = {
      authorization: `Bearer ${token}`,
      accept: "application/json",
      prefer: 'outlook.body-content-type="text"',
    };
    if (optionen.koerper !== undefined) {
      kopf["content-type"] = "application/json";
    }
    if (optionen.version) {
      kopf["if-match"] = optionen.version;
    }
    const ac = new AbortController();
    const frist = setTimeout(() => ac.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchFn(url, {
        method: methode,
        headers: kopf,
        redirect: "error",
        signal: ac.signal,
        ...(optionen.koerper === undefined ? {} : { body: JSON.stringify(optionen.koerper) }),
      });
    } catch {
      throw new KalenderAnbieterFehler("anbieter_ausgefallen");
    } finally {
      clearTimeout(frist);
    }
    if (!res.ok) {
      throw new KalenderAnbieterFehler(m365Lage(res.status));
    }
    if (res.status === 204) {
      return null;
    }
    let text: string;
    try {
      text = await res.text();
    } catch {
      throw new KalenderAnbieterFehler("anbieter_ausgefallen");
    }
    if (text.length > this.maxBytes) {
      throw new KalenderAnbieterFehler("anbieter_ausgefallen");
    }
    if (text.length === 0) {
      return null;
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new KalenderAnbieterFehler("anbieter_ausgefallen");
    }
  }

  private ereignisPfad(kalenderId: string, id?: string): string {
    const k = `/me/calendars/${encodeURIComponent(kalenderId)}/events`;
    return id === undefined ? k : `${k}/${encodeURIComponent(id)}`;
  }

  private ereignisQuery(): Record<string, string> {
    return {
      $select: EREIGNIS_FELDER,
      $expand: `singleValueExtendedProperties($filter=id eq '${M365_VORGANG_EIGENSCHAFT}')`,
    };
  }

  async konto(): Promise<AnbieterKonto> {
    const me = (await this.ruf(
      "GET",
      this.url("/me", { $select: "id,displayName,userPrincipalName,mail" }),
    )) as { id?: string; displayName?: string; userPrincipalName?: string; mail?: string } | null;
    if (!me?.id) {
      throw new KalenderAnbieterFehler("anbieter_ausgefallen");
    }
    const adresse = me.mail ?? me.userPrincipalName ?? "";
    this.eigeneAdresse = adresse.toLowerCase();
    return { kennung: me.id, anzeige: me.displayName ?? adresse, adresse };
  }

  async kalender(): Promise<AnbieterKalender[]> {
    if (this.eigeneAdresse === null) {
      await this.konto();
    }
    const roh = (await this.ruf(
      "GET",
      this.url("/me/calendars", { $select: "id,name,canEdit,owner", $top: "50" }),
    )) as { value?: GraphKalender[] } | null;
    return (roh?.value ?? [])
      .filter((k): k is GraphKalender & { id: string } => typeof k.id === "string")
      .map((k) => {
        const besitzer = k.owner?.address ?? "";
        const eigen = besitzer.toLowerCase() === this.eigeneAdresse;
        const darf = k.canEdit === true;
        return {
          id: k.id,
          name: k.name ?? "",
          art: eigen ? ("eigen" as const) : ("geteilt" as const),
          besitzer,
          rechte: {
            lesen: true,
            eigeneSchreiben: eigen && darf,
            geteiltBearbeiten: !eigen && darf,
            einladen: darf,
          },
        };
      });
  }

  async liesZeitraum(kalenderId: string, von: string, bis: string): Promise<AnbieterTermin[]> {
    const roh = (await this.ruf(
      "GET",
      this.url(`/me/calendars/${encodeURIComponent(kalenderId)}/calendarView`, {
        startDateTime: von,
        endDateTime: bis,
        $top: String(M365_MAX_TERMINE),
        ...this.ereignisQuery(),
      }),
    )) as { value?: GraphEreignis[] } | null;
    return (roh?.value ?? []).map((e) => ausGraph(e, kalenderId));
  }

  async hole(kalenderId: string, id: string): Promise<AnbieterTermin | null> {
    try {
      const e = (await this.ruf(
        "GET",
        this.url(this.ereignisPfad(kalenderId, id), this.ereignisQuery()),
      )) as GraphEreignis | null;
      return e ? ausGraph(e, kalenderId) : null;
    } catch (err) {
      if (err instanceof KalenderAnbieterFehler && err.lage === "nicht_gefunden") {
        return null;
      }
      throw err;
    }
  }

  async sucheVorgang(kalenderId: string, vorgang: string): Promise<AnbieterTermin | null> {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(vorgang)) {
      return null;
    }
    const roh = (await this.ruf(
      "GET",
      this.url(this.ereignisPfad(kalenderId), {
        ...this.ereignisQuery(),
        $filter: `singleValueExtendedProperties/Any(ep: ep/id eq '${M365_VORGANG_EIGENSCHAFT}' and ep/value eq '${vorgang}')`,
        $top: "2",
      }),
    )) as { value?: GraphEreignis[] } | null;
    const treffer = roh?.value ?? [];
    return treffer[0] ? ausGraph(treffer[0], kalenderId) : null;
  }

  async lege(
    kalenderId: string,
    inhalt: Partial<KalenderInhalt>,
    vorgang: string,
  ): Promise<AnbieterTermin> {
    const e = (await this.ruf("POST", this.url(this.ereignisPfad(kalenderId)), {
      koerper: {
        ...nachGraph(inhalt),
        transactionId: vorgang,
        singleValueExtendedProperties: [{ id: M365_VORGANG_EIGENSCHAFT, value: vorgang }],
      },
    })) as GraphEreignis | null;
    if (!e) {
      throw new KalenderAnbieterFehler("anbieter_ausgefallen");
    }
    return ausGraph(e, kalenderId);
  }

  async aendere(
    kalenderId: string,
    id: string,
    inhalt: Partial<KalenderInhalt>,
    version: string,
  ): Promise<AnbieterTermin> {
    // AW17-K04: ohne gelesene Fassung kein Schreiben — es gäbe sonst kein `If-Match`, und eine
    // zwischenzeitliche Änderung würde still überschrieben. Es geht kein Aufruf hinaus.
    if (!version) {
      throw new KalenderAnbieterFehler("version_geaendert");
    }
    const e = (await this.ruf("PATCH", this.url(this.ereignisPfad(kalenderId, id)), {
      koerper: nachGraph(inhalt),
      version,
    })) as GraphEreignis | null;
    if (!e) {
      throw new KalenderAnbieterFehler("anbieter_ausgefallen");
    }
    return ausGraph(e, kalenderId);
  }

  async loesche(kalenderId: string, id: string, version: string): Promise<void> {
    // Kein unbedingtes DELETE: ohne Fassung (z. B. eines nie gelesenen Serienmasters) geht kein
    // Aufruf hinaus; die Löschung muss erst an eine gelesene Fassung gebunden werden.
    if (!version) {
      throw new KalenderAnbieterFehler("version_geaendert");
    }
    await this.ruf("DELETE", this.url(this.ereignisPfad(kalenderId, id)), { version });
  }
}

// ================================================================================================
// DIE BETREIBER-EINSPEISUNG — derselbe Weg wie beim SharePoint-Import (`sharepointClientFromEnv`).
// ================================================================================================
//
//   KLARWERK_KALENDER_M365_BASE_URL  https-Basisadresse (z. B. https://graph.microsoft.com/v1.0)
//   KLARWERK_KALENDER_M365_TOKEN     delegiertes Zugangsmerkmal des abgegrenzten Testkalenderkontos
//   KLARWERK_KALENDER_M365_KONTEN    Komma-Liste der Klarwerk-Anmeldeadressen, die DIESES Konto
//                                    verwenden dürfen — sonst niemand
//
// Der Token wird HIER gelesen und nur in die Closure gebunden; er verlässt die Fabrik nie als Wert.
// Es gibt KEINE Kontenautomatik: ein Klarwerk-Konto ohne Eintrag bekommt keinen Anbieter und sieht
// „nicht verbunden“ — persönliche Erinnerungen bleiben davon unberührt. Ein Zugang je Person über eine
// eigene Microsoft-Anmeldung ist eine offene Produktentscheidung und hier nicht vorweggenommen.

export interface M365Einspeisung {
  /** Der Anbieter für das Klarwerk-Konto mit dieser Anmeldeadresse — oder `null`. */
  readonly fuer: (anmeldeadresse: string | null | undefined) => KalenderAnbieter | null;
}

export function kalenderAnbieterAusEnv(
  env: Record<string, string | undefined> = process.env,
  fetchFn?: typeof fetch,
): M365Einspeisung | undefined {
  const baseUrl = env.KLARWERK_KALENDER_M365_BASE_URL;
  const token = env.KLARWERK_KALENDER_M365_TOKEN;
  const konten = (env.KLARWERK_KALENDER_M365_KONTEN ?? "")
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length > 0);
  let https = false;
  try {
    https = new URL(baseUrl ?? "").protocol === "https:";
  } catch {
    https = false;
  }
  if (!baseUrl || !token || konten.length === 0 || !https) {
    return undefined;
  }
  const erlaubt = new Set(konten);
  const anbieter = new M365KalenderAnbieter({
    baseUrl,
    zugang: async () => token,
    ...(fetchFn ? { fetchFn } : {}),
  });
  return {
    fuer: (adresse) => (adresse && erlaubt.has(adresse.trim().toLowerCase()) ? anbieter : null),
  };
}
