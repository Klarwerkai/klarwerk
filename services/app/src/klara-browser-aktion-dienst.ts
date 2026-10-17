// ================================================================================================
// produkt:20261011:assistenz-browser-aktionen (BPA-03) — DER PRODUKTWEG DER BROWSERAKTIONEN.
// (Ben, Nacharbeit 9: „BrowserAusfuehrung hat keinen Produktaufrufer. Worker, tatsächliche
// Rechteprüfung, Bestätigungs-/Statusoberfläche und vorhandener Auftragsverlauf sind nicht
// angebunden.")
// ================================================================================================
//
// Hier wird der Vertrag (`klara-browser-aktion.ts`) an das angeschlossen, was es im Produkt gibt —
// nach demselben Muster wie BPA-13 (`ki-arbeitsbegleitung-dienst.ts`), ohne zweite Assistenz,
// zweites Rechtesystem oder zweite Ablage:
//
//   · AUFTRAG = der Wortlaut der Person (getippt oder gesprochen) aus der Leiste der Erweiterung,
//     erkannt über feste Satzformen gegen das SEITENPROFIL (`klara-browser-auftrag-erkennung.ts`),
//     gebunden an Mandant, Nutzer, Anmeldesitzung (Marke), Host, Tab, Seite, Formular und Werte.
//   · RECHTE = vor JEDEM Schritt frisch über dieselbe Anmeldeprüfung wie jede Anfrage
//     (`AuthService.authenticate`: Sitzung, Frist, Sperre, Freigabe) und die vorhandenen Rollen-
//     rechte — `ko.read` zum Lesen, `ko.create` für jede Wirkung (wie `entwurf_erstellen` im
//     Aktionskern). Dazu die Seitenfreigabe der Erweiterung (BPA-01): widerruft die Person sie,
//     meldet die Erweiterung das, und der Lauf endet vor dem nächsten Schritt.
//   · SEITE = über `BrowserBefehlsrelais`: die Erweiterung holt jeden Schritt mit ihrer eigenen
//     angemeldeten Anfrage ab und führt ihn mit `chrome.scripting` in der isolierten Welt aus.
//   · BESTÄTIGUNG = die Außenaktionsbestätigung des Vertrags: an Auftrag, Nutzer (aus der Sitzung,
//     nie aus dem Rumpf), Knopf, Formularaufbau und Werte gebunden, genau einmal gültig.
//   · VERLAUF = das eigene Klara-Gespräch (`KlaraGespraech.browserAuftraege`) mit seinem
//     Standvergleich — Wortlaut, Ziel, Schritte samt Aktionskennung, Ergebnis-ID, Bestätigung,
//     Rücknahme. Keine Seiteninhalte.
//
// WAS NICHT GESPEICHERT WIRD: der laufende Lauf selbst. Er lebt im Arbeitsspeicher dieses
// Prozesses (wie der Begleiterkanal). Nach einem Neustart zeigt der Verlauf den letzten Stand
// ehrlich als „unterbrochen" — nie als Erfolg; was auf der Seite geschah, prüft die Person dort.
import { createHash, randomUUID } from "node:crypto";
import type { AuthService } from "../../auth";
import { can } from "../../rbac";
import { KLARA_QUELLEN_DES_AUFTRAGS, type KlaraAuftragsQuelle } from "./klara-auftrag";
import {
  BROWSER_ADRESSBINDUNG_OHNE,
  type BrowserAnsicht,
  BrowserAusfuehrung,
  type BrowserErgebnis,
  type BrowserFaehigkeitsregister,
  type BrowserFeldwert,
  type BrowserLaufStand,
  type BrowserRuecknahme,
  type BrowserSchritt,
  type BrowserSchrittArt,
  type BrowserUebergabe,
  type BrowserVerlaufseintrag,
  neuerBrowserAuftrag,
  uebergabe,
} from "./klara-browser-aktion";
import { BROWSER_WORTLAUT_MAX, erkenneBrowserAuftrag } from "./klara-browser-auftrag-erkennung";
import {
  BROWSER_ABHOLFRIST_MS,
  BROWSER_ANTWORTFRIST_MS,
  type BrowserBefehl,
  BrowserBefehlsrelais,
} from "./klara-browser-relais";
import { type KlaraGespraechDienst, KlaraGespraechFehler } from "./klara-gespraech";
import { KLARA_SINGLE_TENANT_ID } from "./services/klara-session-service";

/** So lange wartet eine Taktanfrage höchstens auf den nächsten Befehl. */
export const BROWSER_TAKT_MS = 20_000;
/** So lange bleibt ein ruhender Lauf steuerbar (Rücknahme, Fortsetzen). */
export const BROWSER_LAUF_ABLAUF_MS = 30 * 60_000;
/** So viele Läufe hält ein Konto zugleich im Arbeitsspeicher. */
export const BROWSER_LAEUFE_JE_KONTO = 5;

const LESEND: readonly BrowserSchrittArt[] = ["lesen", "nachlesen"];
const ENDE: readonly BrowserLaufStand[] = ["abgebrochen", "fertig", "gestoppt_recht", "uebergabe"];
const VORGANG = /^[\w-]{8,64}$/;
const FASSUNG = /^aktion\.js@[\w.+-]{1,20}$/;
const KURZ = /^[\w .()+/-]{0,40}$/;
/** Ein Gespräch, das die Erweiterung neu beginnt, bezieht sich auf keine Seite der Anwendung. */
const BEZUG = { pfad: "/", seitenName: "Klara im Browser", objekt: "Auftrag auf einer Webseite" };

export type BrowserAktionGrund =
  | "eingabe"
  | "unbekannt"
  | "nur_sitzung"
  | "andere_sitzung"
  | "veraltet"
  | "laeuft"
  | "keine_bestaetigung"
  | "bestaetigung_passt_nicht"
  | "zu_viele";

export class BrowserAktionFehler extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409,
    readonly grund: BrowserAktionGrund,
    message: string,
  ) {
    super(message);
    this.name = "BrowserAktionFehler";
  }
}

const eingabe = (text: string) => new BrowserAktionFehler(400, "eingabe", text);

/** Ein Browserauftrag im Verlauf des Gesprächs — sein Ergebnisbeleg. */
export interface BrowserAuftragEintrag {
  readonly id: string;
  /** Der Vorgangsschlüssel des Klicks in der Leiste — derselbe ist derselbe Auftrag (AC07). */
  readonly vorgang?: string;
  readonly quelle: KlaraAuftragsQuelle;
  readonly wortlaut: string;
  /** Herkunft und Pfad der Seite, ohne Abfrage und Anker. */
  readonly ort: string;
  readonly formular: string | null;
  readonly profil: { readonly id: string; readonly fassung: string } | null;
  readonly host: {
    readonly browser: string;
    readonly version: string;
    readonly erweiterung: string;
    readonly adapter: string;
  };
  /** Die beauftragten Felder (Beschriftungen); die Werte stehen im Wortlaut der Person. */
  readonly felder: readonly string[];
  readonly speichern: boolean;
  readonly ausloesen: string | null;
  readonly stand: BrowserLaufStand | "unterbrochen";
  readonly erfolg: boolean;
  readonly text: string;
  readonly schritte: readonly BrowserSchritt[];
  readonly ergebnis: BrowserErgebnis | null;
  readonly klaerung: string | null;
  readonly uebergabe: BrowserUebergabe | null;
  readonly bestaetigung: { readonly knopf: string; readonly bestaetigtAm: string } | null;
  readonly ruecknahme: {
    readonly art: BrowserRuecknahme["art"];
    readonly text: string;
    readonly am: string;
  } | null;
  readonly verlauf: readonly BrowserVerlaufseintrag[];
  readonly angelegtAm: string;
  readonly geaendertAm: string;
}

/** Was eine Rücknahme jetzt tatsächlich bewirken kann — angeboten wird nur, was möglich ist. */
export type BrowserRuecknahmeAngebot =
  | "entwurf_loeschen"
  | "felder_zuruecksetzen"
  | "nicht_ruecknehmbar"
  /** Gespeichert, aber die Seite bietet Klara kein Löschen: der Entwurf bleibt, die Person löscht. */
  | "kein_loeschen"
  | "unklar"
  | null;

/** Die Sicht der Leiste: der Eintrag plus das, was nur ein lebender Lauf weiss. */
export interface BrowserAuftragSicht extends BrowserAuftragEintrag {
  readonly gespraechId: string | null;
  /** Nur bei `bestaetigung_noetig`: was die Bestätigung zeigt und woran sie gebunden ist. */
  readonly bedarf: {
    readonly knopf: string;
    readonly text: string;
    readonly fingerabdruck: string;
    readonly werte: readonly BrowserFeldwert[];
  } | null;
  readonly ruecknahmeAngebot: BrowserRuecknahmeAngebot;
  /** Ob der Lauf in dieser Anmeldesitzung noch lebt (steuerbar ist). */
  readonly steuerbar: boolean;
  /** Ob gerade ein Schritt oder eine Rücknahme läuft. */
  readonly laeuft: boolean;
}

export type BrowserAnlageAntwort =
  | {
      readonly art: "auftrag";
      readonly auftrag: BrowserAuftragSicht;
      readonly befehl: BrowserBefehl | null;
    }
  | { readonly art: "klaerung"; readonly text: string };

export interface BrowserTaktAntwort {
  readonly auftrag: BrowserAuftragSicht;
  readonly befehl: BrowserBefehl | null;
}

export interface BrowserAktionNutzer {
  readonly id: string;
}

export interface BrowserAktionDienstDeps {
  readonly gespraeche: KlaraGespraechDienst;
  readonly auth: Pick<AuthService, "authenticate">;
  readonly register: BrowserFaehigkeitsregister;
  readonly fristen?:
    | {
        readonly abholMs?: number;
        readonly antwortMs?: number;
        readonly taktMs?: number;
        readonly ablaufMs?: number;
      }
    | undefined;
  readonly jetzt?: () => Date;
}

interface Lauf {
  readonly id: string;
  readonly kontoId: string;
  readonly marke: string;
  /** Nur im Arbeitsspeicher: die Anmeldung, unter der die Rechte je Schritt geprüft werden. */
  readonly token: string;
  readonly vorgang: string;
  readonly ausfuehrung: BrowserAusfuehrung;
  readonly relais: BrowserBefehlsrelais;
  readonly basis: Pick<
    BrowserAuftragEintrag,
    | "id"
    | "quelle"
    | "wortlaut"
    | "ort"
    | "formular"
    | "profil"
    | "felder"
    | "speichern"
    | "ausloesen"
    | "angelegtAm"
  > & {
    readonly host: { browser: string; version: string; erweiterung: string };
    readonly vorgang: string;
  };
  gespraechId: string | null;
  /** Die Person hat das Gespräch gelöscht: dieser Lauf schreibt nicht weiter (kein neues an seiner Stelle). */
  gespraechGeloescht: boolean;
  operation: Promise<void> | null;
  ruecknahme: BrowserAuftragEintrag["ruecknahme"];
  folge: number;
  zuletzt: number;
  widerrufen: boolean;
  schreibkette: Promise<void>;
  /** Was zuletzt in den Verlauf ging — ein unveränderter Stand wird nicht erneut geschrieben. */
  geschrieben: string;
}

/** Die Anmeldesitzung als Marke — nicht umkehrbar, kein Anmeldenachweis, eigener Zweck. */
export function browserSitzungsmarke(token: string): string {
  return createHash("sha256").update(`klara-browser-sitzung\0${token}`).digest("hex").slice(0, 32);
}

function text(roh: unknown, max: number, feld: string): string {
  if (typeof roh !== "string" || roh.length > max) {
    throw eingabe(`${feld} ist ein Text mit höchstens ${max} Zeichen.`);
  }
  return roh;
}

function kurz(roh: unknown, feld: string): string {
  const t = text(roh ?? "", 40, feld);
  if (!KURZ.test(t)) throw eingabe(`${feld} enthält unzulässige Zeichen.`);
  return t;
}

function objekt(roh: unknown, feld: string): Record<string, unknown> {
  if (typeof roh !== "object" || roh === null || Array.isArray(roh)) {
    throw eingabe(`${feld} fehlt.`);
  }
  return roh as Record<string, unknown>;
}

function folgeAus(roh: unknown): number {
  if (!Number.isSafeInteger(roh) || (roh as number) < 1) {
    throw eingabe("folge ist eine positive ganze Zahl.");
  }
  return roh as number;
}

/** Herkunft und Pfad einer Seitenadresse — ohne Abfrage und Anker (die nichts binden). */
function ortAus(url: string): { origin: string; pfad: string } | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return { origin: u.origin, pfad: u.pathname };
  } catch {
    return null;
  }
}

function angebot(
  a: BrowserAnsicht,
  loeschenErlaubt: boolean,
  ruecknahmeOffen: boolean,
): BrowserRuecknahmeAngebot {
  const aussen = a.schritte.some(
    (s) => s.art === "ausloesen" && (s.stand === "erfolgt" || s.stand === "unklar"),
  );
  if (aussen) return "nicht_ruecknehmbar";
  // Eine Rücknahme blieb ohne Antwort der Seite: ob sie gewirkt hat, ist offen — kein neues Angebot.
  if (ruecknahmeOffen) return "unklar";
  if (a.ergebnis && !a.ergebnis.zurueckgenommen) {
    return loeschenErlaubt ? "entwurf_loeschen" : "kein_loeschen";
  }
  const speichern = a.schritte.find((s) => s.art === "speichern");
  // Schon zurückgenommen: ein zweites Angebot könnte nichts mehr bewirken (der Kern meldet dann
  // „nichts") — es wird nicht gemacht.
  if (a.ergebnis?.zurueckgenommen || speichern?.stand === "zurueckgenommen") return null;
  if (speichern && (speichern.stand === "erfolgt" || speichern.stand === "unklar")) {
    return "unklar";
  }
  if (a.schritte.some((s) => s.art === "fuellen" && s.stand === "erfolgt")) {
    return "felder_zuruecksetzen";
  }
  return null;
}

export class BrowserAktionDienst {
  private readonly laeufe = new Map<string, Lauf>();
  private readonly vorgaenge = new Map<string, string>();
  private readonly abholMs: number;
  private readonly antwortMs: number;
  private readonly taktMs: number;
  private readonly ablaufMs: number;

  constructor(private readonly deps: BrowserAktionDienstDeps) {
    this.abholMs = deps.fristen?.abholMs ?? BROWSER_ABHOLFRIST_MS;
    this.antwortMs = deps.fristen?.antwortMs ?? BROWSER_ANTWORTFRIST_MS;
    this.taktMs = deps.fristen?.taktMs ?? BROWSER_TAKT_MS;
    this.ablaufMs = deps.fristen?.ablaufMs ?? BROWSER_LAUF_ABLAUF_MS;
  }

  private jetzt(): Date {
    return this.deps.jetzt?.() ?? new Date();
  }

  // ---------------------------------------------------------------- anlegen

  async lege(
    nutzer: BrowserAktionNutzer,
    token: string,
    roh: unknown,
  ): Promise<BrowserAnlageAntwort> {
    // Nur eine echte Anmeldesitzung dieses Kontos trägt einen Browserauftrag (kein Dienstschlüssel).
    const angemeldet = await this.deps.auth.authenticate(token);
    if (!angemeldet || angemeldet.id !== nutzer.id) {
      throw new BrowserAktionFehler(403, "nur_sitzung", "Nur mit eigener Anmeldung möglich.");
    }
    const r = objekt(roh, "Auftrag");
    const vorgang = text(r.vorgang, 64, "vorgang");
    if (!VORGANG.test(vorgang)) throw eingabe("vorgang ist eine Kennung.");
    const quelle = r.quelle as KlaraAuftragsQuelle;
    if (!(KLARA_QUELLEN_DES_AUFTRAGS as readonly string[]).includes(quelle)) {
      throw eingabe("quelle ist getippt oder gesprochen.");
    }
    const wortlaut = text(r.wortlaut, BROWSER_WORTLAUT_MAX, "wortlaut").trim();
    if (!wortlaut) throw eingabe("wortlaut fehlt.");
    const z = objekt(r.ziel, "ziel");
    if (!Number.isSafeInteger(z.tabId) || (z.tabId as number) < 0) {
      throw eingabe("ziel.tabId ist eine Tab-Kennung.");
    }
    const tabId = z.tabId as number;
    const url = text(z.url, 2048, "ziel.url");
    const h = objekt(r.host ?? {}, "host");
    const host = {
      browser: kurz(h.browser, "host.browser"),
      version: kurz(h.version, "host.version"),
      erweiterung: kurz(h.erweiterung, "host.erweiterung"),
    };
    const ort = ortAus(url);
    const ortText = ort ? `${ort.origin}${ort.pfad}` : "diese Seite";
    const marke = browserSitzungsmarke(token);
    // Ein zweiter Klick auf „Ausführen" (derselbe Vorgang, dasselbe Ziel) ist DERSELBE Auftrag
    // (AC07) — auch nach einem Neustart, dann aus dem Verlauf. Neu geprüft wird dagegen derselbe
    // Text für ein ANDERES Ziel (anderer Tab, andere Seite) und nach einer Übergabe: sie bewirkte auf
    // der Seite nichts, und ihr nächster Schritt lautet gerade, Klara erneut zu beauftragen.
    const schon = this.vorgaenge.get(`${nutzer.id}:${vorgang}`);
    const frueher = schon ? this.laeufe.get(schon) : undefined;
    if (frueher) {
      if (
        frueher.marke === marke &&
        frueher.basis.ort === ortText &&
        frueher.ausfuehrung.auftrag.ziel.tabId === tabId &&
        frueher.ausfuehrung.ansicht().stand !== "uebergabe"
      ) {
        return { art: "auftrag", ...(await this.antwort(frueher)) };
      }
    } else {
      const g = await this.deps.gespraeche.aktuelles(nutzer.id);
      const imVerlauf = [...(g?.browserAuftraege ?? [])]
        .reverse()
        .find((e) => e.vorgang === vorgang);
      if (imVerlauf && imVerlauf.ort === ortText && imVerlauf.stand !== "uebergabe") {
        return { art: "auftrag", auftrag: this.sichtAus(imVerlauf, g?.id ?? null), befehl: null };
      }
    }
    this.raeumeAuf(nutzer.id);
    const angelegtAm = this.jetzt().toISOString();
    const basis = {
      id: randomUUID(),
      vorgang,
      quelle,
      wortlaut,
      ort: ortText,
      formular: null,
      profil: null,
      felder: [],
      speichern: false,
      ausloesen: null,
      angelegtAm,
      host,
    };
    const profil = ort ? this.deps.register.profilFuer(ort.origin, ort.pfad) : null;
    if (!profil || !ort) {
      // AC10: eine nicht unterstützte Seite ist eine Übergabe mit konkretem Schritt — im Verlauf.
      const u = uebergabe("nicht_unterstuetzt", ortText, "den Auftrag");
      return {
        art: "auftrag",
        auftrag: await this.uebergabeEintrag(nutzer.id, basis, u),
        befehl: null,
      };
    }
    const erkannt = erkenneBrowserAuftrag(wortlaut, profil);
    if (!erkannt.ok && erkannt.art === "klaerung") {
      // Rückfrage, bevor irgendetwas auf der Seite geschieht — wie die Klärung in Klara 05.
      return { art: "klaerung", text: erkannt.text };
    }
    if (!erkannt.ok) {
      const u = uebergabe("gesperrte_handlung", ortText, erkannt.was);
      return {
        art: "auftrag",
        auftrag: await this.uebergabeEintrag(
          nutzer.id,
          { ...basis, profil: { id: profil.id, fassung: profil.fassung } },
          u,
        ),
        befehl: null,
      };
    }
    const anlage = neuerBrowserAuftrag(
      this.deps.register,
      {
        quelle,
        wortlaut,
        mandant: KLARA_SINGLE_TENANT_ID,
        nutzer: nutzer.id,
        sitzung: marke,
        host: { browser: host.browser, version: host.version },
        ziel: { tabId, origin: ort.origin, pfad: ort.pfad, formular: erkannt.formular },
        felder: erkannt.felder,
        speichern: erkannt.speichern,
        ausloesen: erkannt.ausloesen,
      },
      { id: basis.id, jetzt: this.jetzt() },
    );
    const mitZiel = {
      ...basis,
      formular: erkannt.formular,
      profil: { id: profil.id, fassung: profil.fassung },
      felder: erkannt.felder.map((f) => f.label),
      speichern: erkannt.speichern,
      ausloesen: erkannt.ausloesen,
    };
    if (!anlage.ok) {
      if ("uebergabe" in anlage) {
        return {
          art: "auftrag",
          auftrag: await this.uebergabeEintrag(nutzer.id, mitZiel, anlage.uebergabe),
          befehl: null,
        };
      }
      throw eingabe(anlage.fehler);
    }
    if (!this.platzFuer(nutzer.id)) {
      throw new BrowserAktionFehler(
        409,
        "zu_viele",
        "Es laufen schon mehrere Browseraufträge. Bitte erst einen beenden.",
      );
    }
    const relais = new BrowserBefehlsrelais(
      `Erweiterung ${host.erweiterung || "?"} · aktion.js`,
      { abholMs: this.abholMs, antwortMs: this.antwortMs },
      profil.adressbindung ?? BROWSER_ADRESSBINDUNG_OHNE,
    );
    // Die Rechteprüfung braucht den Lauf; sie wird erst beim ersten Schritt gerufen.
    const bezug: { lauf?: Lauf } = {};
    const ausfuehrung = new BrowserAusfuehrung(anlage.auftrag, {
      adapter: relais,
      register: this.deps.register,
      rechte: (a, schritt) =>
        bezug.lauf ? this.rechte(bezug.lauf, a.nutzer, schritt) : Promise.resolve(false),
      jetzt: () => this.jetzt(),
    });
    const lauf: Lauf = {
      id: basis.id,
      kontoId: nutzer.id,
      marke,
      token,
      vorgang,
      relais,
      ausfuehrung,
      basis: mitZiel,
      gespraechId: null,
      gespraechGeloescht: false,
      operation: null,
      ruecknahme: null,
      folge: 0,
      zuletzt: Date.now(),
      widerrufen: false,
      schreibkette: Promise.resolve(),
      geschrieben: "",
    };
    bezug.lauf = lauf;
    this.laeufe.set(lauf.id, lauf);
    this.vorgaenge.set(`${nutzer.id}:${vorgang}`, lauf.id);
    await this.schreibe(lauf);
    this.betreibe(lauf, () => lauf.ausfuehrung.ausfuehren());
    return { art: "auftrag", ...(await this.antwort(lauf)) };
  }

  /** Die echte Rechteprüfung vor jedem Schritt — frisch, mit derselben Anmeldeprüfung wie jede Anfrage. */
  private async rechte(lauf: Lauf, nutzer: string, schritt: BrowserSchrittArt): Promise<boolean> {
    if (lauf.widerrufen) return false;
    const u = await this.deps.auth.authenticate(lauf.token);
    if (!u || u.id !== nutzer || u.id !== lauf.kontoId) return false;
    return can(u.role, LESEND.includes(schritt) ? "ko.read" : "ko.create");
  }

  // ---------------------------------------------------------------- die Erweiterung im Takt

  async takt(
    nutzer: BrowserAktionNutzer,
    token: string,
    id: string,
    roh: unknown,
  ): Promise<BrowserTaktAntwort> {
    const lauf = this.steuerbar(nutzer, token, id);
    const r = objekt(roh, "Takt");
    this.zaehle(lauf, r.folge);
    const seite = r.seite === undefined ? null : objekt(r.seite, "seite");
    if (seite?.adapter !== undefined) {
      const fassung = text(seite.adapter, 40, "seite.adapter");
      if (FASSUNG.test(fassung))
        lauf.relais.setzeFassung(`Erweiterung ${lauf.basis.host.erweiterung || "?"} · ${fassung}`);
    }
    if (seite?.recht === "entzogen") {
      this.widerrufe(lauf);
    }
    if (r.antwort !== undefined) {
      const a = objekt(r.antwort, "antwort");
      if (!Number.isSafeInteger(a.nr)) throw eingabe("antwort.nr ist die Nummer des Befehls.");
      // Eine veraltete Nummer wird still verworfen: der Befehl ist schon beantwortet oder verfallen.
      lauf.relais.antworte(a.nr as number, a.ergebnis ?? null);
    }
    return this.antwort(lauf);
  }

  async steuere(
    nutzer: BrowserAktionNutzer,
    token: string,
    id: string,
    roh: unknown,
  ): Promise<BrowserTaktAntwort> {
    const lauf = this.steuerbar(nutzer, token, id);
    // Ohne Folgenummer: eine Steuerung kann neben einem wartenden Takt unterwegs sein, und jede
    // ist für sich unschädlich wiederholbar (eine zweite Bestätigung findet keinen Bedarf mehr).
    const r = objekt(roh, "Steuerung");
    const a = lauf.ausfuehrung;
    switch (r.art) {
      case "pause":
        a.pausiere();
        break;
      case "abbruch":
        a.brecheAb();
        break;
      case "widerruf":
        this.widerrufe(lauf);
        break;
      case "fortsetzen":
        this.betreibe(lauf, () => a.fortsetzen());
        break;
      case "bestaetigen": {
        const bedarf = a.bestaetigungsBedarf();
        if (!bedarf) {
          throw new BrowserAktionFehler(
            409,
            "keine_bestaetigung",
            "Gerade ist nichts zu bestätigen.",
          );
        }
        const angenommen = a.bestaetige({
          auftragId: lauf.id,
          knopf: bedarf.knopf,
          fingerabdruck: text(r.fingerabdruck, 64, "fingerabdruck"),
          // Wer bestätigt, kommt aus der Anmeldung — nie aus dem Rumpf.
          nutzer: nutzer.id,
          bestaetigtAm: this.jetzt().toISOString(),
        });
        if (!angenommen) {
          throw new BrowserAktionFehler(
            409,
            "bestaetigung_passt_nicht",
            "Die Bestätigung gilt nicht mehr für diesen Stand. Bitte neu ansehen und bestätigen.",
          );
        }
        this.betreibe(lauf, () => a.fortsetzen());
        break;
      }
      case "ruecknahme": {
        if (lauf.operation) {
          throw new BrowserAktionFehler(
            409,
            "laeuft",
            "Der Auftrag läuft noch; erst pausieren oder abbrechen.",
          );
        }
        this.betreibe(lauf, async () => {
          let ergebnis: BrowserRuecknahme;
          try {
            ergebnis = await a.ruecknahme();
          } catch {
            // Darf nicht still verschwinden: ein Löschen kann schon gewirkt haben.
            ergebnis = {
              art: "unklar",
              text: "Die Rücknahme kam nicht zu Ende. Ob sie gewirkt hat, ist unklar; prüfe die Seite selbst.",
            };
          }
          lauf.ruecknahme = {
            art: ergebnis.art,
            text: "beleg" in ergebnis ? ergebnis.beleg : ergebnis.text,
            am: this.jetzt().toISOString(),
          };
        });
        break;
      }
      default:
        throw eingabe("art ist pause, fortsetzen, abbruch, bestaetigen, ruecknahme oder widerruf.");
    }
    return this.antwort(lauf);
  }

  // ---------------------------------------------------------------- lesen

  async liste(nutzer: BrowserAktionNutzer): Promise<BrowserAuftragSicht[]> {
    const g = await this.deps.gespraeche.aktuelles(nutzer.id);
    const eintraege = [...(g?.browserAuftraege ?? [])].reverse();
    return eintraege.map((e) => this.sichtAus(e, g?.id ?? null));
  }

  async sicht(
    nutzer: BrowserAktionNutzer,
    token: string,
    id: string,
  ): Promise<BrowserAuftragSicht> {
    const lauf = this.laeufe.get(id);
    if (lauf && lauf.kontoId === nutzer.id && lauf.marke === browserSitzungsmarke(token)) {
      return this.sichtVon(lauf);
    }
    const g = await this.deps.gespraeche.aktuelles(nutzer.id);
    const e = (g?.browserAuftraege ?? []).find((x) => x.id === id);
    if (!e) throw new BrowserAktionFehler(404, "unbekannt", "Browserauftrag nicht gefunden.");
    return this.sichtAus(e, g?.id ?? null);
  }

  // ---------------------------------------------------------------- intern

  private steuerbar(nutzer: BrowserAktionNutzer, token: string, id: string): Lauf {
    this.raeumeAuf(nutzer.id);
    const lauf = this.laeufe.get(id);
    // Fremd und unbekannt antworten gleich.
    if (!lauf || lauf.kontoId !== nutzer.id) {
      throw new BrowserAktionFehler(
        404,
        "unbekannt",
        "Browserauftrag nicht gefunden oder nicht mehr steuerbar.",
      );
    }
    if (lauf.marke !== browserSitzungsmarke(token)) {
      // Eine andere Anmeldung desselben Kontos steuert nicht den Lauf einer früheren.
      throw new BrowserAktionFehler(
        409,
        "andere_sitzung",
        "Dieser Auftrag gehört zu einer früheren Anmeldung.",
      );
    }
    lauf.zuletzt = Date.now();
    return lauf;
  }

  private zaehle(lauf: Lauf, roh: unknown): void {
    const folge = folgeAus(roh);
    if (folge <= lauf.folge) {
      throw new BrowserAktionFehler(409, "veraltet", "Veraltete oder wiederholte Meldung.");
    }
    lauf.folge = folge;
  }

  private widerrufe(lauf: Lauf): void {
    lauf.widerrufen = true;
    lauf.ausfuehrung.rechtEntzogen();
    lauf.relais.melde();
  }

  /** Startet eine Operation (Lauf, Fortsetzen, Rücknahme), solange keine läuft. */
  private betreibe(lauf: Lauf, f: () => Promise<unknown>): void {
    if (lauf.operation) return;
    const op = (async () => {
      try {
        await f();
      } finally {
        lauf.operation = null;
        await this.schreibe(lauf);
        lauf.relais.melde();
      }
    })();
    lauf.operation = op;
    op.catch(() => {});
  }

  /** Wartet auf den nächsten Befehl — oder darauf, dass der Lauf zur Ruhe kommt. */
  private async antwort(lauf: Lauf): Promise<BrowserTaktAntwort> {
    const bis = Date.now() + this.taktMs;
    for (;;) {
      const befehl = lauf.relais.abholen();
      if (befehl) {
        await this.schreibe(lauf);
        return { auftrag: this.sichtVon(lauf), befehl };
      }
      const op = lauf.operation;
      if (!op) {
        await lauf.schreibkette;
        return { auftrag: this.sichtVon(lauf), befehl: null };
      }
      const rest = bis - Date.now();
      if (rest <= 0) {
        return { auftrag: this.sichtVon(lauf), befehl: null };
      }
      await Promise.race([lauf.relais.warte(rest), op]);
    }
  }

  private sichtVon(lauf: Lauf): BrowserAuftragSicht {
    const a = lauf.ausfuehrung.ansicht();
    const laeuft = lauf.operation !== null;
    return {
      ...this.eintragVon(lauf, a),
      gespraechId: lauf.gespraechId,
      bedarf: lauf.ausfuehrung.bestaetigungsBedarf(),
      ruecknahmeAngebot: laeuft
        ? null
        : angebot(
            a,
            lauf.ausfuehrung.auftrag.erlaubt.includes("entwurf_loeschen"),
            lauf.ausfuehrung.ruecknahmeOffen() || lauf.ruecknahme?.art === "unklar",
          ),
      steuerbar: true,
      laeuft,
    };
  }

  private sichtAus(e: BrowserAuftragEintrag, gespraechId: string | null): BrowserAuftragSicht {
    const lebt = this.laeufe.get(e.id);
    if (lebt) return { ...this.sichtVon(lebt), steuerbar: false };
    // Ohne lebenden Lauf ist ein nicht beendeter Stand unterbrochen — nie ein stiller Erfolg.
    const unterbrochen = e.stand !== "unterbrochen" && !ENDE.includes(e.stand);
    return {
      ...e,
      ...(unterbrochen
        ? {
            stand: "unterbrochen" as const,
            erfolg: false,
            text: `Unterbrochen — der Lauf besteht nicht mehr. Zuletzt: ${e.text} Prüfe auf der Seite selbst, was geschehen ist.`,
          }
        : {}),
      gespraechId,
      bedarf: null,
      ruecknahmeAngebot: null,
      steuerbar: false,
      laeuft: false,
    };
  }

  private eintragVon(lauf: Lauf, a: BrowserAnsicht): BrowserAuftragEintrag {
    return {
      ...lauf.basis,
      host: { ...lauf.basis.host, adapter: lauf.relais.fassung },
      stand: a.stand,
      erfolg: a.erfolg,
      text: a.text,
      schritte: a.schritte,
      ergebnis: a.ergebnis,
      klaerung: a.klaerung,
      uebergabe: a.uebergabe,
      bestaetigung: a.bestaetigung,
      ruecknahme: lauf.ruecknahme,
      verlauf: a.verlauf,
      geaendertAm: this.jetzt().toISOString(),
    };
  }

  private async uebergabeEintrag(
    kontoId: string,
    basis: Lauf["basis"],
    u: BrowserUebergabe,
  ): Promise<BrowserAuftragSicht> {
    const jetzt = this.jetzt().toISOString();
    const e: BrowserAuftragEintrag = {
      ...basis,
      host: { ...basis.host, adapter: "nicht verwendet" },
      stand: "uebergabe",
      erfolg: false,
      text: `Bitte selbst weitermachen: ${u.schritt}`,
      schritte: [],
      ergebnis: null,
      klaerung: null,
      uebergabe: u,
      bestaetigung: null,
      ruecknahme: null,
      verlauf: [{ ereignis: "uebergabe", nr: null, am: jetzt }],
      geaendertAm: jetzt,
    };
    const gespraechId = await this.trageEin(kontoId, null, e);
    return {
      ...e,
      gespraechId,
      bedarf: null,
      ruecknahmeAngebot: null,
      steuerbar: false,
      laeuft: false,
    };
  }

  /** Schreibt den Stand in den Verlauf — nacheinander, damit kein älterer Stand einen neueren überholt. */
  private schreibe(lauf: Lauf): Promise<void> {
    const e = this.eintragVon(lauf, lauf.ausfuehrung.ansicht());
    const stand = JSON.stringify({ ...e, geaendertAm: "" });
    if (stand === lauf.geschrieben) return lauf.schreibkette;
    lauf.geschrieben = stand;
    lauf.schreibkette = lauf.schreibkette
      .then(async () => {
        if (lauf.gespraechGeloescht) return;
        const id = await this.trageEin(lauf.kontoId, lauf.gespraechId, e);
        if (id === null && lauf.gespraechId !== null) {
          // Das Gespräch des Laufs gibt es nicht mehr (die Person hat es gelöscht): hier endet die
          // Aufzeichnung; es wird kein anderes oder neues Gespräch dafür genommen.
          lauf.gespraechGeloescht = true;
          return;
        }
        lauf.gespraechId = id;
      })
      .catch(() => {});
    return lauf.schreibkette;
  }

  /** Legt einen Eintrag im Gespräch an oder ersetzt ihn; ohne Gespräch beginnt ein neues. */
  private async trageEin(
    kontoId: string,
    gespraechId: string | null,
    e: BrowserAuftragEintrag,
  ): Promise<string | null> {
    const ersetze = (liste: readonly BrowserAuftragEintrag[]) =>
      liste.some((x) => x.id === e.id) ? liste.map((x) => (x.id === e.id ? e : x)) : [...liste, e];
    let id = gespraechId ?? (await this.deps.gespraeche.aktuelles(kontoId))?.id ?? null;
    for (let versuch = 0; versuch < 2; versuch++) {
      if (!id) {
        id = (await this.deps.gespraeche.beginne(kontoId, BEZUG)).id;
      }
      try {
        await this.deps.gespraeche.aendereBrowserAuftraege(kontoId, id, ersetze);
        return id;
      } catch (fehler) {
        // Hat die Person das Gespräch gelöscht, endet die Aufzeichnung dieses Laufs dort — es wird
        // kein neues an seiner Stelle angelegt. Ist es voll, beginnt ein neues (erste Anlage).
        if (fehler instanceof KlaraGespraechFehler && fehler.grund === "voll" && !gespraechId) {
          id = null;
          continue;
        }
        if (fehler instanceof KlaraGespraechFehler && fehler.grund === "unbekannt") {
          return null;
        }
        throw fehler;
      }
    }
    return id;
  }

  /**
   * Ob für das Konto noch ein Lauf Platz hat. Gezählt werden nur Läufe, die noch etwas tun können
   * (laufend, pausiert, in Klärung, wartend auf Bestätigung, unklar). Ein beendeter, ruhender Lauf
   * wird dafür verdrängt — sein Ergebnis steht im Verlauf (AC08: ein Abbruch belegt keinen Platz).
   */
  private platzFuer(kontoId: string): boolean {
    const eigene = [...this.laeufe.values()].filter((l) => l.kontoId === kontoId);
    const tot = (l: Lauf) => !l.operation && ENDE.includes(l.ausfuehrung.ansicht().stand);
    if (eigene.filter((l) => !tot(l)).length >= BROWSER_LAEUFE_JE_KONTO) return false;
    const ruhend = eigene.filter(tot).sort((a, b) => a.zuletzt - b.zuletzt);
    let anzahl = eigene.length;
    for (const alt of ruhend) {
      if (anzahl < BROWSER_LAEUFE_JE_KONTO) break;
      this.laeufe.delete(alt.id);
      this.vorgaenge.delete(`${alt.kontoId}:${alt.vorgang}`);
      anzahl--;
    }
    return anzahl < BROWSER_LAEUFE_JE_KONTO;
  }

  /** Vergisst ruhende Läufe nach ihrer Frist. Ein Lauf mit laufendem Schritt bleibt. */
  private raeumeAuf(kontoId: string): void {
    const grenze = Date.now() - this.ablaufMs;
    for (const [id, l] of this.laeufe) {
      if (l.kontoId === kontoId && !l.operation && l.zuletzt < grenze) {
        this.laeufe.delete(id);
        this.vorgaenge.delete(`${l.kontoId}:${l.vorgang}`);
      }
    }
  }
}
