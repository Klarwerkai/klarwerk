import { createHmac } from "node:crypto";
import type { AuditEntry, AuditService } from "../../audit";
import type { Conflict } from "../../conflicts";
import type { KnowledgeObject } from "../../knowledge-object";
import type { SessionUser } from "./http";
import { darfSehen } from "./sichtbarkeit";
import type { IntervalHandle } from "./trash-sweep-scheduler";

// ================================================================================================
// R-0710 (aufnahme:20260922:gesamt-webhooks) — WISSENSEREIGNISSE KONTROLLIERT AN FREMDWERKZEUGE.
// ================================================================================================
//
// Andere Werkzeuge werden von selbst benachrichtigt, sobald ein Wissensobjekt validiert wurde, seine
// Revalidierung fällig ist („Stimmt das noch?", der Zustand, den Management und Arbeitsbereich als
// „veraltet" zählen) oder ein Widerspruch offen steht. Bis hierher konnte fremde Software nur selbst
// abholen (Export, Fragen, MCP).
//
// WOHER DIE EREIGNISSE KOMMEN — ZUSTANDSABGLEICH STATT HAKEN AN JEDEM SCHREIBWEG. Validiert wird über
// Bewertung, Admin-Validierung, Überarbeitung mit Freigabe und Vorschlagsübernahme; Widersprüche
// entstehen über die Route, die KI-Prüfung, Beispielpakete und Selbsttests. Ein Haken an jeder dieser
// Stellen verpasst die nächste. Der Melder fragt deshalb im Takt den GESPEICHERTEN Zustand ab —
// dieselben Lesewege wie Board, Arbeitsbereich und Kennzahlen — und meldet, was neu ist.
//
// WAS „NEU" IST, STEHT IN DER AUDITKETTE. Jedes erkannte Ereignis wird über `recordOnce` mit einer
// stabilen Kennung angehängt (`wissen.validiert:<id>:<fassung>` usw.). Der eindeutige Index der Kette
// lässt genau EINEN Schreiber gewinnen — auch bei mehreren Instanzen und nach einem Neustart; nur
// dieser Schreiber stellt zu. Beim allerersten Lauf wird der vorgefundene Zustand als GRUNDSTAND
// festgehalten und NICHT gemeldet: Wer Meldungen einschaltet, bekommt, was danach geschieht, nicht
// den ganzen Altbestand.
//
// KONTROLLIERT:
//   · Ziele nur aus der Betriebsumgebung (`KLARWERK_WEBHOOKS`), kein Weg über die Oberfläche.
//   · Nur https (http allein für die eigene Maschine), keine Zugangsdaten in der Adresse, keine
//     Weiterleitung, feste Zeitgrenze. Ein fehlerhafter Eintrag wird verworfen (fail-closed).
//   · Jede Meldung ist mit dem Geheimnis des Ziels signiert (HMAC-SHA-256 über Zeit und Rumpf).
//   · Die Meldung trägt NUR Kennungen und Fassung, keinen Inhalt. Und nur für Objekte, die auch der
//     Dienst-Schlüssel-Export zeigen darf: nicht vertraulich, ohne führenden Space (dieselbe Regel,
//     `darfSehen` mit einem Betrachter ohne Spaces in der Rolle `viewer`). Wer mehr wissen will,
//     holt es über die Schnittstelle mit eigenem Schlüssel und dessen Rechten.
//   · Erkennung, Zustellung und endgültiges Scheitern stehen im Prüfprotokoll.
//   · Vor JEDEM Zustellversuch wird die Sichtbarkeit neu geprüft. Wird ein Objekt zwischen zwei
//     Versuchen vertraulich, einem Space zugeordnet oder gelöscht, geht die Meldung nicht mehr
//     hinaus; der Abbruch steht im Protokoll.
//
// DAUERHAFT: Die Zustellvorgänge liegen in der Kette, nicht nur im Speicher. `erkannt` nennt die
// Ziele, die das Ereignis bei der Erkennung abonniert hatten; jeder erfolglose Versuch steht als
// `zustellversuch` da; der Abschluss (zugestellt, gescheitert, abgebrochen) ist je Ziel und Ereignis
// über `recordOnce` eindeutig. Nach einem Neustart nimmt der Melder jeden Vorgang ohne Abschluss
// wieder auf und zählt die Versuche weiter. Zugestellt wird damit mindestens einmal: Ein Neustart
// zwischen erfolgreicher Antwort und Abschlusseintrag oder zwei gleichzeitig neu gestartete Instanzen
// können eine Meldung doppelt senden — der Empfänger erkennt sie an derselben `kennung`.

export const WISSENSEREIGNISSE = [
  "wissen.validiert",
  "wissen.revalidierung_faellig",
  "widerspruch.offen",
] as const;
export type Wissensereignis = (typeof WISSENSEREIGNISSE)[number];

export const WEBHOOKS_ENV = "KLARWERK_WEBHOOKS";
export const WEBHOOKS_TAKT_ENV = "KLARWERK_WEBHOOKS_TAKT_SEK";

export const MELDER_AKTEUR = "system:wissensereignisse";
export const AKTION_GRUNDSTAND = "wissensereignis.grundstand";
export const AKTION_ERKANNT = "wissensereignis.erkannt";
export const AKTION_ZUGESTELLT = "wissensereignis.zugestellt";
export const AKTION_GESCHEITERT = "wissensereignis.zustellung-gescheitert";
export const AKTION_ABGEBROCHEN = "wissensereignis.zustellung-abgebrochen";
export const AKTION_VERSUCH = "wissensereignis.zustellversuch";
const ABSCHLUSS_AKTIONEN = [AKTION_ZUGESTELLT, AKTION_GESCHEITERT, AKTION_ABGEBROCHEN] as const;

export const SIGNATUR_HEADER = "x-klarwerk-signatur";
export const EREIGNIS_HEADER = "x-klarwerk-ereignis";
export const KENNUNG_HEADER = "x-klarwerk-kennung";

export const TAKT_STANDARD_SEK = 60;
export const TAKT_MIN_SEK = 10;
export const ZUSTELL_ZEITGRENZE_MS = 10_000;
/** So viele Takte lang wird eine Meldung versucht, danach gilt sie als gescheitert. */
export const MAX_VERSUCHE = 5;
export const GEHEIMNIS_MIN_LAENGE = 32;

// Derselbe Betrachter wie ein Dienst-Schlüssel am Export (`dienst-schluessel.ts`, `sitzungsrolle`
// `viewer`, ohne `spaceLesbar`): sieht nur nicht vertrauliche Objekte ohne führenden Space.
const MELDE_BETRACHTER: SessionUser = { id: MELDER_AKTEUR, role: "viewer" };

// ------------------------------------------------------------------------------------------------
// Ziele aus der Umgebung
// ------------------------------------------------------------------------------------------------

export interface WebhookZiel {
  readonly id: string;
  readonly url: string;
  readonly ereignisse: readonly Wissensereignis[];
  readonly geheimnis: string;
}

export interface WebhookLage {
  readonly ziele: readonly WebhookZiel[];
  /** Gründe, aus denen Einträge verworfen wurden — ohne Adresse und ohne Geheimnis. */
  readonly fehler: readonly string[];
}

const KENNUNG = /^[a-z0-9][a-z0-9-]{1,47}$/;
const EIGENE_MASCHINE = new Set(["localhost", "127.0.0.1", "[::1]"]);

function istEreignis(wert: unknown): wert is Wissensereignis {
  return (WISSENSEREIGNISSE as readonly unknown[]).includes(wert);
}

function pruefeAdresse(roh: unknown): string | undefined {
  if (typeof roh !== "string") {
    return undefined;
  }
  let url: URL;
  try {
    url = new URL(roh);
  } catch {
    return undefined;
  }
  if (url.username !== "" || url.password !== "") {
    return undefined;
  }
  if (url.protocol === "https:") {
    return url.toString();
  }
  if (url.protocol === "http:" && EIGENE_MASCHINE.has(url.hostname)) {
    return url.toString();
  }
  return undefined;
}

/**
 * Liest `KLARWERK_WEBHOOKS` — eine JSON-Liste, z. B.
 *   [{"id":"n8n-wissen","url":"https://…","ereignisse":["wissen.validiert"],"geheimnis":"<≥32 Zeichen>"}]
 * Nicht gesetzt → keine Ziele, der Melder läuft nicht.
 */
export function ladeWebhookZiele(
  env: Record<string, string | undefined> = process.env,
): WebhookLage {
  const roh = env[WEBHOOKS_ENV]?.trim();
  if (!roh) {
    return { ziele: [], fehler: [] };
  }
  let liste: unknown;
  try {
    liste = JSON.parse(roh);
  } catch {
    return { ziele: [], fehler: [`${WEBHOOKS_ENV} ist kein gültiges JSON.`] };
  }
  if (!Array.isArray(liste)) {
    return { ziele: [], fehler: [`${WEBHOOKS_ENV} muss eine JSON-Liste sein.`] };
  }
  const ziele: WebhookZiel[] = [];
  const fehler: string[] = [];
  for (const [index, eintrag] of liste.entries()) {
    const e = (eintrag ?? {}) as Record<string, unknown>;
    const id = typeof e.id === "string" && KENNUNG.test(e.id) ? e.id : undefined;
    if (!id) {
      fehler.push(`Eintrag ${index + 1}: Kennung fehlt oder ist ungültig (a-z, 0-9, Bindestrich).`);
      continue;
    }
    if (ziele.some((z) => z.id === id)) {
      fehler.push(`${id}: Kennung doppelt.`);
      continue;
    }
    const url = pruefeAdresse(e.url);
    if (!url) {
      fehler.push(
        `${id}: Adresse fehlt oder ist nicht erlaubt (nur https, http nur für die eigene Maschine, keine Zugangsdaten in der Adresse).`,
      );
      continue;
    }
    const ereignisse: unknown[] = Array.isArray(e.ereignisse) ? e.ereignisse : [];
    if (ereignisse.length === 0 || !ereignisse.every(istEreignis)) {
      fehler.push(
        `${id}: Ereignisse fehlen oder sind unbekannt (${WISSENSEREIGNISSE.join(", ")}).`,
      );
      continue;
    }
    if (typeof e.geheimnis !== "string" || e.geheimnis.length < GEHEIMNIS_MIN_LAENGE) {
      fehler.push(`${id}: Geheimnis fehlt oder ist kürzer als ${GEHEIMNIS_MIN_LAENGE} Zeichen.`);
      continue;
    }
    ziele.push({
      id,
      url,
      ereignisse: [...new Set(ereignisse.filter(istEreignis))],
      geheimnis: e.geheimnis,
    });
  }
  return { ziele, fehler };
}

/** Takt aus `KLARWERK_WEBHOOKS_TAKT_SEK`; ungültig → Vorgabe, zu klein → Untergrenze. */
export function resolveWebhookTaktMs(roh: string | undefined): number {
  const n = Number(roh);
  if (roh === undefined || roh.trim() === "" || !Number.isFinite(n) || n <= 0) {
    return TAKT_STANDARD_SEK * 1000;
  }
  return Math.max(Math.floor(n), TAKT_MIN_SEK) * 1000;
}

// ------------------------------------------------------------------------------------------------
// Erkennung
// ------------------------------------------------------------------------------------------------

export interface WissensereignisQuellen {
  /** Alle Wissensobjekte außerhalb des Papierkorbs (`KoService.list`). */
  wissensobjekte(): Promise<readonly KnowledgeObject[]>;
  /** Kennungen mit anstehendem „Stimmt das noch?" (`LifecycleService.pendingRevalidation`). */
  revalidierungFaellig(): Promise<readonly string[]>;
  /** Ungelöste Widersprüche (`ConflictService.unresolved`). */
  offeneWidersprueche(): Promise<readonly Conflict[]>;
  /** Ein Wissensobjekt frisch gelesen (`KoService.get`) — unmittelbar vor jedem Zustellversuch. */
  wissensobjekt(id: string): Promise<KnowledgeObject | undefined>;
}

/** Darf das Objekt JETZT gemeldet werden? Dieselbe Regel wie im Stand (`ladeStand`). */
function meldbar(ko: KnowledgeObject | undefined): boolean {
  return ko !== undefined && !ko.deletedAt && darfSehen(MELDE_BETRACHTER, ko);
}

/** Der Rumpf einer Meldung — nur Kennungen, kein Inhalt. */
export interface Meldung {
  format: "klarwerk-wissensereignis";
  formatVersion: 1;
  kennung: string;
  ereignis: Wissensereignis;
  zeitpunkt: string;
  wissensobjekt?: { id: string; version: number };
  widerspruch?: { id: string; art: string; wissensobjekte: [string, string] };
}

export interface Befund {
  kennung: string;
  ereignis: Wissensereignis;
  ziel: string;
  daten: Pick<Meldung, "wissensobjekt" | "widerspruch">;
}

/** Ein gelesener Stand: die meldbaren Objekte und die Zustände, aus denen Ereignisse folgen. */
export interface Stand {
  /** Objekte, die der Export-Betrachter heute sehen darf — Grundlage JEDER Meldung. */
  sichtbar: ReadonlyMap<string, KnowledgeObject>;
  faellig: readonly string[];
  widersprueche: readonly Conflict[];
}

export async function ladeStand(quellen: WissensereignisQuellen): Promise<Stand> {
  const [kos, faellig, widersprueche] = await Promise.all([
    quellen.wissensobjekte(),
    quellen.revalidierungFaellig(),
    quellen.offeneWidersprueche(),
  ]);
  const sichtbar = new Map<string, KnowledgeObject>();
  for (const ko of kos) {
    if (meldbar(ko)) {
      sichtbar.set(ko.id, ko);
    }
  }
  return { sichtbar, faellig, widersprueche };
}

// R-1349 (Aufnahme gesamt-aufruferwaechter, Nacharbeit 7): hier stand `erhebeBefunde(quellen)`,
// eine Hülle um `befundeAus(await ladeStand(quellen))`. Weder der Melder noch ein Test rief sie —
// der Melder lädt den Stand in `lauf` selbst und leitet die Befunde daraus ab (`ladeBekannt`,
// `erkenne`).

/** Der gespeicherte Zustand als Menge meldbarer Befunde — reine Ableitung, kein Schreibweg. */
function befundeAus({ sichtbar, faellig, widersprueche }: Stand): Befund[] {
  const befunde: Befund[] = [];
  for (const ko of sichtbar.values()) {
    if (ko.status === "validiert") {
      befunde.push({
        kennung: `wissen.validiert:${ko.id}:${ko.version}`,
        ereignis: "wissen.validiert",
        ziel: ko.id,
        daten: { wissensobjekt: { id: ko.id, version: ko.version } },
      });
    }
  }
  for (const id of new Set(faellig)) {
    const ko = sichtbar.get(id);
    if (ko) {
      befunde.push({
        kennung: `wissen.revalidierung_faellig:${ko.id}:${ko.version}`,
        ereignis: "wissen.revalidierung_faellig",
        ziel: ko.id,
        daten: { wissensobjekt: { id: ko.id, version: ko.version } },
      });
    }
  }
  for (const c of widersprueche) {
    // Beide Seiten müssen meldbar sein — sonst verriete die Meldung ein verborgenes Objekt.
    if (c.status === "geloest" || !sichtbar.has(c.koA) || !sichtbar.has(c.koB)) {
      continue;
    }
    befunde.push({
      kennung: `widerspruch.offen:${c.id}`,
      ereignis: "widerspruch.offen",
      ziel: c.id,
      daten: { widerspruch: { id: c.id, art: c.type, wissensobjekte: [c.koA, c.koB] } },
    });
  }
  return befunde;
}

// ------------------------------------------------------------------------------------------------
// Zustellung
// ------------------------------------------------------------------------------------------------

export interface ZustellAnfrage {
  url: string;
  headers: Record<string, string>;
  body: string;
}

/** Ergebnis eines Versuchs: HTTP-Status oder `null`, wenn keine Antwort kam. */
export type Zusteller = (anfrage: ZustellAnfrage) => Promise<{ status: number | null }>;

/** `t=<Unix-Sekunden>,v1=<HMAC-SHA-256 hex über "<t>.<Rumpf>">`. */
export function signiere(geheimnis: string, sekunden: number, body: string): string {
  const v1 = createHmac("sha256", geheimnis).update(`${sekunden}.${body}`, "utf8").digest("hex");
  return `t=${sekunden},v1=${v1}`;
}

export const fetchZusteller: Zusteller = async ({ url, headers, body }) => {
  try {
    const antwort = await fetch(url, {
      method: "POST",
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(ZUSTELL_ZEITGRENZE_MS),
    });
    await antwort.body?.cancel().catch(() => undefined);
    return { status: antwort.status };
  } catch {
    return { status: null };
  }
};

// ------------------------------------------------------------------------------------------------
// Der Melder
// ------------------------------------------------------------------------------------------------

export interface WissensereignisMelderDeps {
  quellen: WissensereignisQuellen;
  audit: Pick<AuditService, "list" | "record" | "recordOnce">;
  ziele: readonly WebhookZiel[];
  zusteller?: Zusteller;
  now?: () => number;
  log?: { warn: (text: string) => void };
}

interface Ausstehend {
  ziel: WebhookZiel;
  meldung: Meldung;
  versuche: number;
  /** Zugestellt oder gescheitert, aber der Abschlusseintrag ist noch nicht geschrieben. */
  abschluss?: { action: string; payload: Record<string, unknown> };
}

export interface LaufErgebnis {
  erkannt: number;
  zugestellt: number;
  gescheitert: number;
  abgebrochen: number;
  ausstehend: number;
}

/** Eindeutige Kennung des Abschlusses je Ziel und Ereignis (`recordOnce`). */
export function abschlussKennung(zielId: string, kennung: string): string {
  return `wissensereignis.abschluss:${zielId}:${kennung}`;
}

/** Alle Wissensobjekte, deren Kennung die Meldung trägt. */
function objekteDer(meldung: Meldung): string[] {
  if (meldung.wissensobjekt) {
    return [meldung.wissensobjekt.id];
  }
  return meldung.widerspruch ? [...meldung.widerspruch.wissensobjekte] : [];
}

function zahl(wert: unknown): number {
  return typeof wert === "number" && Number.isFinite(wert) ? wert : 0;
}

export class WissensereignisMelder {
  private readonly deps: WissensereignisMelderDeps;
  private readonly zusteller: Zusteller;
  private readonly now: () => number;
  private bekannt: Set<string> | undefined;
  private warteschlange: Ausstehend[] = [];
  private laeuft = false;

  constructor(deps: WissensereignisMelderDeps) {
    this.deps = deps;
    this.zusteller = deps.zusteller ?? fetchZusteller;
    this.now = deps.now ?? (() => Date.now());
  }

  /** Ein Takt: Zustand abgleichen, Neues festhalten, ausstehende Meldungen zustellen. */
  async lauf(): Promise<LaufErgebnis> {
    if (this.laeuft) {
      return {
        erkannt: 0,
        zugestellt: 0,
        gescheitert: 0,
        abgebrochen: 0,
        ausstehend: this.warteschlange.length,
      };
    }
    this.laeuft = true;
    try {
      const stand = await ladeStand(this.deps.quellen);
      const erkannt = await this.erkenne(stand);
      const ergebnis = await this.stelleZu();
      return { erkannt, ...ergebnis, ausstehend: this.warteschlange.length };
    } finally {
      this.laeuft = false;
    }
  }

  // Bekannt ist, was im Grundstand steht oder schon als erkannt in der Kette liegt. Der Grundstand
  // wird nur einmal je Installation geschrieben; eine zweite Instanz übernimmt den der ersten.
  // Beim ersten Aufruf nimmt der Melder außerdem die Zustellvorgänge ohne Abschluss wieder auf.
  private async ladeBekannt(stand: Stand): Promise<Set<string>> {
    if (this.bekannt) {
      return this.bekannt;
    }
    let grundstand = (await this.deps.audit.list({ action: AKTION_GRUNDSTAND }))[0];
    if (!grundstand) {
      const kennungen = befundeAus(stand).map((b) => b.kennung);
      await this.deps.audit.recordOnce(AKTION_GRUNDSTAND, {
        actor: MELDER_AKTEUR,
        action: AKTION_GRUNDSTAND,
        target: "wissensereignisse",
        payload: { kennungen },
      });
      grundstand = (await this.deps.audit.list({ action: AKTION_GRUNDSTAND }))[0];
    }
    const bekannt = new Set<string>();
    const ausGrundstand = grundstand?.payload.kennungen;
    if (Array.isArray(ausGrundstand)) {
      for (const k of ausGrundstand) {
        if (typeof k === "string") {
          bekannt.add(k);
        }
      }
    }
    const erkannteEintraege = await this.deps.audit.list({ action: AKTION_ERKANNT });
    for (const eintrag of erkannteEintraege) {
      if (eintrag.eventId) {
        bekannt.add(eintrag.eventId);
      }
    }
    await this.nimmWiederAuf(erkannteEintraege);
    this.bekannt = bekannt;
    return bekannt;
  }

  // Wiederaufnahme nach einem Neustart: jedes erkannte Ereignis je abonniertem und weiterhin
  // eingetragenem Ziel, für das noch kein Abschluss in der Kette steht. Die Versuche zählen weiter.
  private async nimmWiederAuf(erkannteEintraege: readonly AuditEntry[]): Promise<void> {
    const abgeschlossen = new Set<string>();
    for (const action of ABSCHLUSS_AKTIONEN) {
      for (const e of await this.deps.audit.list({ action })) {
        if (e.eventId) {
          abgeschlossen.add(e.eventId);
        }
      }
    }
    const versuche = new Map<string, number>();
    for (const e of await this.deps.audit.list({ action: AKTION_VERSUCH })) {
      const schluessel = abschlussKennung(String(e.payload.ziel), String(e.payload.kennung));
      versuche.set(schluessel, Math.max(versuche.get(schluessel) ?? 0, zahl(e.payload.versuch)));
    }
    for (const e of erkannteEintraege) {
      const p = e.payload;
      if (!e.eventId || !istEreignis(p.ereignis) || !Array.isArray(p.ziele)) {
        continue;
      }
      // Dieselben Felder, die `erkenne` aus dem Befund in die Kette geschrieben hat.
      const daten = p as Pick<Meldung, "wissensobjekt" | "widerspruch">;
      const meldung: Meldung = {
        format: "klarwerk-wissensereignis",
        formatVersion: 1,
        kennung: e.eventId,
        ereignis: p.ereignis,
        zeitpunkt: e.at,
        ...(daten.wissensobjekt ? { wissensobjekt: daten.wissensobjekt } : {}),
        ...(daten.widerspruch ? { widerspruch: daten.widerspruch } : {}),
      };
      for (const ziel of this.deps.ziele) {
        const schluessel = abschlussKennung(ziel.id, e.eventId);
        if (
          p.ziele.includes(ziel.id) &&
          ziel.ereignisse.includes(p.ereignis) &&
          !abgeschlossen.has(schluessel) &&
          !this.warteschlange.some((w) => w.ziel.id === ziel.id && w.meldung.kennung === e.eventId)
        ) {
          this.warteschlange.push({ ziel, meldung, versuche: versuche.get(schluessel) ?? 0 });
        }
      }
    }
  }

  private async erkenne(stand: Stand): Promise<number> {
    const bekannt = await this.ladeBekannt(stand);
    let erkannt = 0;
    for (const befund of befundeAus(stand)) {
      if (bekannt.has(befund.kennung)) {
        continue;
      }
      const ziele = this.deps.ziele.filter((z) => z.ereignisse.includes(befund.ereignis));
      const geschrieben = await this.deps.audit.recordOnce(befund.kennung, {
        actor: MELDER_AKTEUR,
        action: AKTION_ERKANNT,
        target: befund.ziel,
        payload: { ereignis: befund.ereignis, ...befund.daten, ziele: ziele.map((z) => z.id) },
      });
      bekannt.add(befund.kennung);
      if (!geschrieben) {
        // Eine andere Instanz hat dasselbe Ereignis zuerst festgehalten — sie stellt zu.
        continue;
      }
      erkannt += 1;
      const meldung: Meldung = {
        format: "klarwerk-wissensereignis",
        formatVersion: 1,
        kennung: befund.kennung,
        ereignis: befund.ereignis,
        zeitpunkt: new Date(this.now()).toISOString(),
        ...befund.daten,
      };
      for (const ziel of ziele) {
        this.warteschlange.push({ ziel, meldung, versuche: 0 });
      }
    }
    return erkannt;
  }

  // Die Rechte gelten zum Zeitpunkt JEDES einzelnen Versands (BEN, Nacharbeit 2 und 3): Die
  // betroffenen Objekte werden unmittelbar vor dem Versuch frisch gelesen — nicht aus dem Stand des
  // Takts, der während vorangehender, womöglich langsamer Zustellungen veralten kann.
  private async nochMeldbar(meldung: Meldung): Promise<boolean> {
    for (const id of objekteDer(meldung)) {
      if (!meldbar(await this.deps.quellen.wissensobjekt(id))) {
        return false;
      }
    }
    return true;
  }

  private async stelleZu(): Promise<Omit<LaufErgebnis, "erkannt" | "ausstehend">> {
    let zugestellt = 0;
    let gescheitert = 0;
    let abgebrochen = 0;
    const offen: Ausstehend[] = [];
    for (const eintrag of this.warteschlange) {
      const protokollBasis = {
        ziel: eintrag.ziel.id,
        ereignis: eintrag.meldung.ereignis,
        kennung: eintrag.meldung.kennung,
      };
      // Ein bereits entschiedener Vorgang, dessen Abschlusseintrag noch fehlt: nur nachtragen.
      if (eintrag.abschluss) {
        const { action, payload } = eintrag.abschluss;
        if (!(await this.schliesseAb(eintrag, action, payload))) {
          offen.push(eintrag);
        }
        continue;
      }
      if (!(await this.nochMeldbar(eintrag.meldung))) {
        abgebrochen += 1;
        const payload = {
          ...protokollBasis,
          versuche: eintrag.versuche,
          grund: "nicht-mehr-meldbar",
        };
        if (!(await this.schliesseAb(eintrag, AKTION_ABGEBROCHEN, payload))) {
          offen.push({ ...eintrag, abschluss: { action: AKTION_ABGEBROCHEN, payload } });
        }
        continue;
      }
      if (eintrag.versuche >= MAX_VERSUCHE) {
        // Nach einem Neustart: alle Versuche verbraucht, aber kein Abschluss geschrieben.
        gescheitert += 1;
        const payload = { ...protokollBasis, versuche: eintrag.versuche, status: null };
        if (!(await this.schliesseAb(eintrag, AKTION_GESCHEITERT, payload))) {
          offen.push({ ...eintrag, abschluss: { action: AKTION_GESCHEITERT, payload } });
        }
        continue;
      }
      const body = JSON.stringify(eintrag.meldung);
      const signatur = signiere(eintrag.ziel.geheimnis, Math.floor(this.now() / 1000), body);
      const { status } = await this.zusteller({
        url: eintrag.ziel.url,
        headers: {
          "content-type": "application/json",
          "user-agent": "KLARWERK-Wissensereignisse/1",
          [EREIGNIS_HEADER]: eintrag.meldung.ereignis,
          [KENNUNG_HEADER]: eintrag.meldung.kennung,
          [SIGNATUR_HEADER]: signatur,
        },
        body,
      });
      eintrag.versuche += 1;
      const protokoll = { ...protokollBasis, versuche: eintrag.versuche, status };
      if (status !== null && status >= 200 && status < 300) {
        zugestellt += 1;
        if (!(await this.schliesseAb(eintrag, AKTION_ZUGESTELLT, protokoll))) {
          offen.push({ ...eintrag, abschluss: { action: AKTION_ZUGESTELLT, payload: protokoll } });
        }
        continue;
      }
      // Der erfolglose Versuch steht dauerhaft in der Kette — ein Neustart zählt von hier weiter.
      await this.protokolliere(AKTION_VERSUCH, eintrag, {
        ziel: eintrag.ziel.id,
        kennung: eintrag.meldung.kennung,
        versuch: eintrag.versuche,
        status,
      });
      if (eintrag.versuche >= MAX_VERSUCHE) {
        gescheitert += 1;
        this.deps.log?.warn(
          `Wissensereignis ${eintrag.meldung.kennung} an ${eintrag.ziel.id} nach ${eintrag.versuche} Versuchen nicht zugestellt (zuletzt ${status ?? "keine Antwort"}).`,
        );
        if (!(await this.schliesseAb(eintrag, AKTION_GESCHEITERT, protokoll))) {
          offen.push({ ...eintrag, abschluss: { action: AKTION_GESCHEITERT, payload: protokoll } });
        }
      } else {
        offen.push(eintrag);
      }
    }
    this.warteschlange = offen;
    return { zugestellt, gescheitert, abgebrochen };
  }

  /** Schreibt den eindeutigen Abschluss; `false`, wenn die Kette ihn gerade nicht annimmt. */
  private async schliesseAb(
    eintrag: Ausstehend,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<boolean> {
    const kennung = abschlussKennung(eintrag.ziel.id, eintrag.meldung.kennung);
    try {
      // `false` heißt: der Abschluss steht schon (andere Instanz) — auch dann ist der Vorgang zu.
      await this.deps.audit.recordOnce(kennung, {
        actor: MELDER_AKTEUR,
        action,
        target: this.zielVon(eintrag),
        payload,
      });
      return true;
    } catch (error) {
      this.deps.log?.warn(`Prüfprotokoll für ${action}: ${String(error)}`);
      return false;
    }
  }

  private zielVon(eintrag: Ausstehend): string {
    return eintrag.meldung.wissensobjekt?.id ?? eintrag.meldung.widerspruch?.id ?? "";
  }

  private async protokolliere(
    action: string,
    eintrag: Ausstehend,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.deps.audit
      .record({ actor: MELDER_AKTEUR, action, target: this.zielVon(eintrag), payload })
      .catch((error) => this.deps.log?.warn(`Prüfprotokoll für ${action}: ${String(error)}`));
  }
}

export interface MelderHandle {
  stop: () => void;
}

/** Startet den Takt. Ein Fehler eines Takts geht an `onError`, der nächste Takt läuft normal. */
export function starteWissensereignisMelder(opts: {
  melder: WissensereignisMelder;
  intervalMs: number;
  onError?: (error: unknown) => void;
  setIntervalFn?: (callback: () => void, ms: number) => IntervalHandle;
  clearIntervalFn?: (handle: IntervalHandle) => void;
}): MelderHandle {
  const setI = opts.setIntervalFn ?? setInterval;
  const clearI = opts.clearIntervalFn ?? clearInterval;
  const handle = setI(() => {
    opts.melder.lauf().catch((error) => opts.onError?.(error));
  }, opts.intervalMs);
  (handle as { unref?: () => void })?.unref?.();
  return { stop: () => clearI(handle) };
}
