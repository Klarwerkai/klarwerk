import { createHmac, timingSafeEqual } from "node:crypto";

// ================================================================================================
// KLARA-OFFICE-01 · DER GEMEINSAME OFFICE-KONTEXT (produkt:20261010:klara-office-gemeinsamer-kern)
// ================================================================================================
//
// WAS HIER STEHT: der Vertrag zwischen Assistenzkern und Hostadapter — rein, ohne HTTP und ohne
// Ablage. Die Route (`routes/office-kontext-routes.ts`) prüft Anmeldung, Herkunft und Sitzung und
// fragt dann genau diese Funktionen.
//
// KEINE ZWEITE VERWALTUNG. Nutzer, Add-in-Instanz, Dokumentidentität, Ablauf und Zustimmung kommen
// aus der vorhandenen Klara-Sitzung (`KlaraSessionService`): die `documentContextId` vergibt der
// Server dort aus dem Dokumentbeschreiber (KW-S4-20 §3); ein Dokumentwechsel ist dort ein Rebind,
// der Zustimmung und Auflösung verwirft. Dieser Kern ergänzt NUR, was es bisher nicht gab: welche
// Hostanwendung, welches Objekt, welche Auswahl in welcher Folge zu dieser Sitzung gemeldet wurde —
// und ob ein Einfügeziel noch genau dazu gehört.
//
// BEGRENZTER KONTEXT. Die Meldung trägt KEINEN Text: nur Länge und SHA-256 der Auswahl. Damit kann
// über diesen Weg kein Office-Textmaterial in eine KI-Verarbeitung gelangen und nichts als geprüftes
// Wissensobjekt umgedeutet werden. Wer markierten Text an eine KI geben will, geht weiter über den
// vorhandenen Antwortweg mit Sitzungstor und Dokumenttext-Riegel (`pruefeDokumenttextFreigabe`).
//
// OFFIZIELLE SCHNITTSTELLEN. Eine Auswahl gilt nur, wenn der Adapter sie über die Host-API gelesen
// hat (`quelle: "host-api"`, bei Word `context.document.getSelection()`). Eine Markierung im
// Seitenfenster (`window.getSelection`) oder ein eigener Tutorialanker ist keine Dokumentauswahl
// und wird an dieser Grenze abgelehnt.

/** Kennung und Fassung dieses Vertrags; Adapter und Kern müssen dieselbe tragen. */
export const OFFICE_KONTEXT_VERTRAG = "klarwerk.office-kontext/1";

export const OFFICE_HOSTANWENDUNGEN = ["word", "outlook", "excel", "powerpoint"] as const;
export type OfficeHostanwendung = (typeof OFFICE_HOSTANWENDUNGEN)[number];

/**
 * Die Adapter, die tatsächlich geliefert sind. Outlook, Excel und PowerPoint stehen im Vertrag,
 * werden aber abgelehnt, bis ihr Adapter gebaut und belegt ist — sie bleiben sichtbar offen.
 */
export const GELIEFERTE_ADAPTER: readonly OfficeHostanwendung[] = ["word"];

export const OFFICE_OBJEKTARTEN = ["dokument", "mail", "termin"] as const;
export type OfficeObjektart = (typeof OFFICE_OBJEKTARTEN)[number];

/** Welches Objekt welche Anwendung führt. */
const OBJEKTART_JE_HOST: Record<OfficeHostanwendung, readonly OfficeObjektart[]> = {
  word: ["dokument"],
  excel: ["dokument"],
  powerpoint: ["dokument"],
  outlook: ["mail", "termin"],
};

/** Gültigkeit einer Kontextmarke. Kurz: eine Auswahl ist ein Augenblick, kein Arbeitstag. */
export const OFFICE_KONTEXT_TTL_MS = 2 * 60 * 1000;

/** Größte gemeldete Auswahllänge (Zeichen); darüber ist es kein Zielbereich mehr. */
export const OFFICE_AUSWAHL_MAX_LAENGE = 1_000_000;

const PRUEFSUMME = /^[0-9a-f]{64}$/;
const KURZWERT = /^[A-Za-z0-9 ._()/+-]{1,64}$/;

export interface OfficeKontextMeldung {
  readonly vertrag: typeof OFFICE_KONTEXT_VERTRAG;
  readonly host: {
    readonly anwendung: OfficeHostanwendung;
    readonly plattform: string;
    readonly version: string;
  };
  readonly objekt: { readonly art: OfficeObjektart };
  readonly auswahl: {
    readonly quelle: "host-api";
    readonly art: "text" | "leer";
    readonly laenge: number;
    readonly pruefsumme: string;
  };
  readonly sequenz: number;
}

export type OfficeMeldungsFehler =
  | "vertrag_unbekannt"
  | "form_ungueltig"
  | "felder_unzulaessig"
  | "adapter_nicht_geliefert"
  | "objekt_passt_nicht"
  | "auswahl_nicht_vom_host"
  | "sequenz_ungueltig";

const MELDUNGSFELDER = ["vertrag", "host", "objekt", "auswahl", "sequenz"];
const HOSTFELDER = ["anwendung", "plattform", "version"];
const OBJEKTFELDER = ["art"];
const AUSWAHLFELDER = ["quelle", "art", "laenge", "pruefsumme"];

function istObjekt(wert: unknown): wert is Record<string, unknown> {
  return typeof wert === "object" && wert !== null && !Array.isArray(wert);
}

/** Genau diese Felder, keins mehr: jedes weitere (etwa `text`) ist ein Bruch des engen Kontexts. */
function nurFelder(wert: Record<string, unknown>, erlaubt: readonly string[]): boolean {
  return Object.keys(wert).every((schluessel) => erlaubt.includes(schluessel));
}

/**
 * Prüft eine Meldung des Hostadapters. Fail-closed: alles, was nicht exakt der Vertragsform
 * entspricht, wird mit benanntem Grund abgelehnt — nie „repariert".
 */
export function pruefeMeldung(
  roh: unknown,
): { ok: true; meldung: OfficeKontextMeldung } | { ok: false; grund: OfficeMeldungsFehler } {
  if (!istObjekt(roh)) {
    return { ok: false, grund: "form_ungueltig" };
  }
  if (roh.vertrag !== OFFICE_KONTEXT_VERTRAG) {
    return { ok: false, grund: "vertrag_unbekannt" };
  }
  const { host, objekt, auswahl, sequenz } = roh;
  if (!istObjekt(host) || !istObjekt(objekt) || !istObjekt(auswahl)) {
    return { ok: false, grund: "form_ungueltig" };
  }
  if (
    !nurFelder(roh, MELDUNGSFELDER) ||
    !nurFelder(host, HOSTFELDER) ||
    !nurFelder(objekt, OBJEKTFELDER) ||
    !nurFelder(auswahl, AUSWAHLFELDER)
  ) {
    return { ok: false, grund: "felder_unzulaessig" };
  }
  const anwendung = host.anwendung;
  if (
    typeof anwendung !== "string" ||
    !(OFFICE_HOSTANWENDUNGEN as readonly string[]).includes(anwendung) ||
    typeof host.plattform !== "string" ||
    !KURZWERT.test(host.plattform) ||
    typeof host.version !== "string" ||
    !KURZWERT.test(host.version)
  ) {
    return { ok: false, grund: "form_ungueltig" };
  }
  const app = anwendung as OfficeHostanwendung;
  if (!GELIEFERTE_ADAPTER.includes(app)) {
    return { ok: false, grund: "adapter_nicht_geliefert" };
  }
  if (
    typeof objekt.art !== "string" ||
    !OBJEKTART_JE_HOST[app].includes(objekt.art as OfficeObjektart)
  ) {
    return { ok: false, grund: "objekt_passt_nicht" };
  }
  if (auswahl.quelle !== "host-api") {
    return { ok: false, grund: "auswahl_nicht_vom_host" };
  }
  const laenge = auswahl.laenge;
  if (
    (auswahl.art !== "text" && auswahl.art !== "leer") ||
    typeof laenge !== "number" ||
    !Number.isInteger(laenge) ||
    laenge < 0 ||
    laenge > OFFICE_AUSWAHL_MAX_LAENGE ||
    (auswahl.art === "leer") !== (laenge === 0) ||
    typeof auswahl.pruefsumme !== "string" ||
    !PRUEFSUMME.test(auswahl.pruefsumme)
  ) {
    return { ok: false, grund: "form_ungueltig" };
  }
  if (typeof sequenz !== "number" || !Number.isSafeInteger(sequenz) || sequenz < 1) {
    return { ok: false, grund: "sequenz_ungueltig" };
  }
  return {
    ok: true,
    meldung: {
      vertrag: OFFICE_KONTEXT_VERTRAG,
      host: {
        anwendung: app,
        plattform: host.plattform as string,
        version: host.version as string,
      },
      objekt: { art: objekt.art as OfficeObjektart },
      auswahl: {
        quelle: "host-api",
        art: auswahl.art as "text" | "leer",
        laenge,
        pruefsumme: auswahl.pruefsumme as string,
      },
      sequenz,
    },
  };
}

// ------------------------------------------------------------------------------------------------
// DER OFFICE-BEZUG — nie eine Klarwerk-Wissenskennung
// ------------------------------------------------------------------------------------------------

export interface OfficeBezug {
  readonly art: "office-bezug";
  /** `office:<anwendung>:<documentContextId>#<sequenz>` — trägt nie `ko-`/`koId`. */
  readonly kennung: string;
  readonly host: OfficeKontextMeldung["host"];
  readonly objekt: OfficeKontextMeldung["objekt"] & { readonly documentContextId: string };
  readonly auswahl: { readonly art: "text" | "leer"; readonly laenge: number };
  readonly sequenz: number;
  readonly erfasstAm: string;
  /** Office-Inhalt ist kein geprüftes Wissen. Fest, damit niemand ihn so umdeutet. */
  readonly pruefstand: "ungeprueft";
}

export function officeBezug(
  meldung: OfficeKontextMeldung,
  documentContextId: string,
  jetzt: number,
): OfficeBezug {
  return {
    art: "office-bezug",
    kennung: `office:${meldung.host.anwendung}:${documentContextId}#${meldung.sequenz}`,
    host: meldung.host,
    objekt: { art: meldung.objekt.art, documentContextId },
    auswahl: { art: meldung.auswahl.art, laenge: meldung.auswahl.laenge },
    sequenz: meldung.sequenz,
    erfasstAm: new Date(jetzt).toISOString(),
    pruefstand: "ungeprueft",
  };
}

// ------------------------------------------------------------------------------------------------
// DIE KONTEXTMARKE — der enge, signierte Handlungsbezug
// ------------------------------------------------------------------------------------------------

export interface KontextmarkenInhalt {
  readonly v: 1;
  /** Sitzung, Konto, Instanz, Dokumentkontext — dieselben Werte wie die Klara-Bindung. */
  readonly sid: string;
  readonly act: string;
  readonly inst: string;
  readonly doc: string;
  readonly host: OfficeHostanwendung;
  readonly seq: number;
  /** SHA-256 der Auswahl, auf die sich die Marke bezieht. */
  readonly sum: string;
  readonly exp: number;
}

function b64url(daten: Buffer | string): string {
  return Buffer.from(daten).toString("base64url");
}

function signatur(nutzlast: string, schluessel: Buffer): Buffer {
  return createHmac("sha256", schluessel).update(nutzlast).digest();
}

export function stelleKontextmarkeAus(
  inhalt: Omit<KontextmarkenInhalt, "v" | "exp">,
  schluessel: Buffer,
  jetzt: number,
): { marke: string; bis: number } {
  const bis = jetzt + OFFICE_KONTEXT_TTL_MS;
  const nutzlast = b64url(JSON.stringify({ v: 1, ...inhalt, exp: bis }));
  return { marke: `${nutzlast}.${b64url(signatur(nutzlast, schluessel))}`, bis };
}

export type MarkenPruefung =
  | { gueltig: true; inhalt: KontextmarkenInhalt }
  | { gueltig: false; grund: "marke_ungueltig" | "marke_abgelaufen" };

export function pruefeKontextmarke(
  marke: unknown,
  schluessel: Buffer,
  jetzt: number,
): MarkenPruefung {
  if (typeof marke !== "string" || marke.length > 2048) {
    return { gueltig: false, grund: "marke_ungueltig" };
  }
  const teile = marke.split(".");
  if (teile.length !== 2 || !teile[0] || !teile[1]) {
    return { gueltig: false, grund: "marke_ungueltig" };
  }
  const [nutzlast, sig] = teile as [string, string];
  const erwartet = signatur(nutzlast, schluessel);
  const erhalten = Buffer.from(sig, "base64url");
  if (erhalten.length !== erwartet.length || !timingSafeEqual(erhalten, erwartet)) {
    return { gueltig: false, grund: "marke_ungueltig" };
  }
  let inhalt: unknown;
  try {
    inhalt = JSON.parse(Buffer.from(nutzlast, "base64url").toString("utf8"));
  } catch {
    return { gueltig: false, grund: "marke_ungueltig" };
  }
  if (!istObjekt(inhalt) || inhalt.v !== 1 || typeof inhalt.exp !== "number") {
    return { gueltig: false, grund: "marke_ungueltig" };
  }
  if (inhalt.exp <= jetzt) {
    return { gueltig: false, grund: "marke_abgelaufen" };
  }
  return { gueltig: true, inhalt: inhalt as unknown as KontextmarkenInhalt };
}

// ------------------------------------------------------------------------------------------------
// HANDLUNGSBEZUG — gehört das Ziel noch zu dieser Sitzung, diesem Konto, diesem Dokument?
// ------------------------------------------------------------------------------------------------

export type HandlungsbezugGrund =
  | "konto_gewechselt"
  | "sitzung_gewechselt"
  | "instanz_gewechselt"
  | "dokument_gewechselt"
  | "auswahl_veraltet"
  | "ziel_abweichend";

/**
 * `verwerfen`: der Bezug gehört zu einem anderen Konto, einer anderen Sitzung oder einem anderen
 * Dokument — er wird nicht wiederverwendet. `aktualisieren`: derselbe Rahmen, aber die Auswahl hat
 * sich bewegt — der Adapter meldet sie neu und fragt danach erneut.
 */
export type Folgeaktion = "verwerfen" | "aktualisieren";

const FOLGE: Readonly<Record<string, Folgeaktion>> = {
  konto_gewechselt: "verwerfen",
  sitzung_gewechselt: "verwerfen",
  instanz_gewechselt: "verwerfen",
  dokument_gewechselt: "verwerfen",
  sitzung_nicht_aktiv: "verwerfen",
  auswahl_veraltet: "aktualisieren",
  ziel_abweichend: "aktualisieren",
  marke_ungueltig: "aktualisieren",
  marke_abgelaufen: "aktualisieren",
};

export function folgeaktionFuer(grund: string): Folgeaktion {
  return FOLGE[grund] ?? "verwerfen";
}

export function pruefeHandlungsbezug(lage: {
  readonly marke: KontextmarkenInhalt;
  readonly bindung: {
    readonly sessionId: string;
    readonly actorId: string;
    readonly addinInstanceId: string;
    readonly documentContextId: string;
  };
  /** Die zuletzt angenommene Meldung dieser Sitzung; `undefined` = keine (etwa nach Neustart). */
  readonly letzteSequenz: number | undefined;
  readonly zielPruefsumme: unknown;
}): { gueltig: true } | { gueltig: false; grund: HandlungsbezugGrund; aktion: Folgeaktion } {
  const nein = (grund: HandlungsbezugGrund) => ({
    gueltig: false as const,
    grund,
    aktion: folgeaktionFuer(grund),
  });
  const { marke, bindung } = lage;
  if (marke.act !== bindung.actorId) {
    return nein("konto_gewechselt");
  }
  if (marke.sid !== bindung.sessionId) {
    return nein("sitzung_gewechselt");
  }
  if (marke.inst !== bindung.addinInstanceId) {
    return nein("instanz_gewechselt");
  }
  if (marke.doc !== bindung.documentContextId) {
    return nein("dokument_gewechselt");
  }
  if (lage.letzteSequenz === undefined || lage.letzteSequenz !== marke.seq) {
    return nein("auswahl_veraltet");
  }
  if (lage.zielPruefsumme !== marke.sum) {
    return nein("ziel_abweichend");
  }
  return { gueltig: true };
}

// ------------------------------------------------------------------------------------------------
// ERLAUBTE AKTIONEN — und welche davon eine Bestätigung brauchen
// ------------------------------------------------------------------------------------------------

export interface OfficeAktion {
  readonly aktion: "kontext-lesen" | "fragen" | "text-pruefen" | "einfuegen";
  /** Der vorhandene Weg, der die Aktion ausführt — dieser Kern führt selbst nichts aus. */
  readonly weg: string;
  /**
   * `keine`: harmlos, ohne Rückfrage. `zweiter-klick`: schreibt ins Dokument — der Mensch
   * bestätigt am Panel (vorhandene Regel KW-KA6-MEMO), nach bestandener Zielprüfung.
   * Externe KI bleibt zusätzlich an die Sitzungszustimmung gebunden (`zustimmung`).
   */
  readonly bestaetigung: "keine" | "zweiter-klick";
  readonly zielpruefung: boolean;
  readonly zustimmung: "sitzungstor" | "nicht-noetig";
}

const WORD_AKTIONEN: readonly OfficeAktion[] = [
  {
    aktion: "kontext-lesen",
    weg: "office.js Word.Document.getSelection",
    bestaetigung: "keine",
    zielpruefung: false,
    zustimmung: "nicht-noetig",
  },
  {
    aktion: "fragen",
    weg: "POST /api/ask",
    bestaetigung: "keine",
    zielpruefung: false,
    zustimmung: "sitzungstor",
  },
  {
    aktion: "text-pruefen",
    weg: "POST /api/check-text",
    bestaetigung: "keine",
    zielpruefung: false,
    zustimmung: "sitzungstor",
  },
  {
    aktion: "einfuegen",
    weg: "office.js Word.Range.insertText",
    bestaetigung: "zweiter-klick",
    zielpruefung: true,
    zustimmung: "nicht-noetig",
  },
];

export function erlaubteAktionen(anwendung: OfficeHostanwendung): readonly OfficeAktion[] {
  return anwendung === "word" ? WORD_AKTIONEN : [];
}

// ------------------------------------------------------------------------------------------------
// HERKUNFT — der Kanal antwortet nur der eigenen Anwendung
// ------------------------------------------------------------------------------------------------

function hostOhneStandardport(host: string, protokoll: string): string {
  const standard = protokoll === "https:" ? ":443" : protokoll === "http:" ? ":80" : "";
  const klein = host.toLowerCase();
  return standard !== "" && klein.endsWith(standard) ? klein.slice(0, -standard.length) : klein;
}

/**
 * Enger als die allgemeine Herkunftsprüfung (`csrf.ts`): eine `Origin` MUSS vorliegen — ein
 * Aufruf ohne Herkunftsangabe (Programmclient, Loopback-Werkzeug) bekommt keinen Office-Kontext.
 * Erlaubt sind die eingetragenen Herkünfte der Installation (exakt) und die eigene Herkunft.
 * `Sec-Fetch-Site`, wenn vorhanden, muss `same-origin` sein.
 */
export function herkunftErlaubt(lage: {
  readonly origin: unknown;
  readonly secFetchSite: unknown;
  readonly eigenerHost: string;
  readonly eingetragen: readonly string[];
}): boolean {
  if (lage.secFetchSite !== undefined && lage.secFetchSite !== "same-origin") {
    return false;
  }
  if (typeof lage.origin !== "string" || lage.origin === "null") {
    return false;
  }
  let url: URL;
  try {
    url = new URL(lage.origin);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return false;
  }
  if (lage.eingetragen.includes(url.origin)) {
    return true;
  }
  return url.host !== "" && url.host === hostOhneStandardport(lage.eigenerHost, url.protocol);
}

/** Die eingetragene Herkunft aus `APP_BASE_URL`, sonst keine. */
export function eingetrageneHerkuenfte(appBaseUrl: string | undefined): string[] {
  if (!appBaseUrl) {
    return [];
  }
  try {
    const url = new URL(appBaseUrl);
    return url.protocol === "https:" || url.protocol === "http:" ? [url.origin] : [];
  } catch {
    return [];
  }
}
