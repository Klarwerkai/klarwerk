// ================================================================================================
// OFFICE IM ARTIKEL · DER WOPI-KERN: WAS KLARWERK ALS DATEIHOST ENTSCHEIDET, OHNE NETZ.
// ================================================================================================
//
// Auftrag `produkt:20261007:office-machbarkeit`. Der Plan dazu steht in
// `docs/entscheidungen/office-im-artikel-integrationsweg.md`; diese Datei ist die TEILPROBE daraus,
// und ihr Umfang ist eng:
//
//   ENTHALTEN   die Entscheidungen, die Klarwerk als WOPI-Host trifft — welches Format, welcher
//               Schreibweg aus den vorhandenen Rechten, Ausgabe und Prüfung der Zugangsmarke,
//               die Sperrregeln (Lock/Unlock/RefreshLock/UnlockAndRelock/GetLock) und die
//               Annahme eines Speicherns (PutFile).
//   NICHT       keine Route, kein Editor, kein Netzaufruf, kein Microsoft- oder Collabora-Dienst.
//   GRENZE      Die Datei ist NICHT verdrahtet. Sie beweist nicht, dass Office im Artikel läuft —
//               sie macht die Hostseite prüfbar, bevor ein Editor angeschlossen wird.
//
// WARUM WOPI UND NICHT EIN EIGENES PROTOKOLL: dasselbe Protokoll sprechen Microsoft 365 für das Web
// (nur mit CSPP-Zulassung) und die selbst betriebenen Editoren (Collabora Online, ONLYOFFICE Docs).
// Was hier entschieden wird, gilt für beide — der Hostteil wird einmal gebaut.
//
// KEINE NEUE RECHTEACHSE: `officeSchreibweg` bildet die Regeln ab, die `routes/ko-routes.ts`
// (`revise`, `PROPOSAL_REQUIRED`) und `sichtbarkeit.ts` (`darfSehen`) schon durchsetzen. Die
// Zugangsmarke ersetzt diese Prüfung nicht: sie bindet eine Editor-Anfrage an Nutzer, Artikel,
// Anhang und Fassung; die Rechte werden bei JEDER WOPI-Anfrage frisch aus der Sitzung gelesen.

import { createHmac, timingSafeEqual } from "node:crypto";
import { MAX_OBJECT_BYTES } from "../../object-store";

// ------------------------------------------------------------------------------------------------
// FORMATE — Word, Excel, PowerPoint
// ------------------------------------------------------------------------------------------------

export type OfficeAnwendung = "word" | "excel" | "powerpoint";

export interface OfficeFormat {
  readonly endung: string;
  readonly mime: string;
  readonly anwendung: OfficeAnwendung;
  /**
   * `true`: im Editor bearbeitbar. `false`: nur Ansicht — die Binärformate bis Office 2003 werden
   * erst nach einer Umwandlung in das OOXML-Format bearbeitet, nie still an Ort und Stelle.
   */
  readonly bearbeitbar: boolean;
}

export const OFFICE_FORMATE: readonly OfficeFormat[] = [
  {
    endung: "docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    anwendung: "word",
    bearbeitbar: true,
  },
  {
    endung: "xlsx",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    anwendung: "excel",
    bearbeitbar: true,
  },
  {
    endung: "pptx",
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    anwendung: "powerpoint",
    bearbeitbar: true,
  },
  { endung: "doc", mime: "application/msword", anwendung: "word", bearbeitbar: false },
  { endung: "xls", mime: "application/vnd.ms-excel", anwendung: "excel", bearbeitbar: false },
  {
    endung: "ppt",
    mime: "application/vnd.ms-powerpoint",
    anwendung: "powerpoint",
    bearbeitbar: false,
  },
];

/** Browser melden eine unbekannte Datei als diesen Typ; dann entscheidet die Endung allein. */
const UNBESTIMMTER_TYP = "application/octet-stream";

/**
 * Das Office-Format eines Anhangs — oder `undefined`. Die Endung entscheidet; ein angegebener
 * Medientyp muss zu ihr passen. Widersprechen sich beide (`bericht.docx` als `image/png`), ist es
 * KEIN Office-Anhang: fail-closed statt raten.
 */
export function officeFormatFuer(name: string, mime: string): OfficeFormat | undefined {
  const punkt = name.lastIndexOf(".");
  if (punkt < 1) {
    return undefined;
  }
  const endung = asciiKlein(name.slice(punkt + 1));
  const format = OFFICE_FORMATE.find((f) => f.endung === endung);
  if (!format) {
    return undefined;
  }
  return mime === format.mime || mime === UNBESTIMMTER_TYP ? format : undefined;
}

// ------------------------------------------------------------------------------------------------
// SCHREIBWEG — aus den vorhandenen Rechten, nicht aus einer neuen Matrix
// ------------------------------------------------------------------------------------------------

/**
 * Die drei Rechte, die der Aufrufer aus dem Bestand liest:
 *   `darfLesen`                ← `ko.read` UND `darfSehen(user, ko)`
 *   `darfBearbeiten`           ← `ko.create` (dasselbe Recht wie `revise` und `propose`)
 *   `darfFreigegebenesAendern` ← `users.manage` (dieselbe Prüfung wie am `revise`-Zweig)
 */
export interface OfficeRechte {
  readonly darfLesen: boolean;
  readonly darfBearbeiten: boolean;
  readonly darfFreigegebenesAendern: boolean;
}

/**
 * `direkt`     — der Editor darf speichern; die Übernahme wird eine neue Fassung (Status `offen`).
 * `vorschlag`  — freigegebener Artikel ohne Freigaberecht: der Editor öffnet NUR LESEND; eine
 *                Änderung läuft über den bestehenden Vorschlagsweg (`propose`), nicht über PutFile.
 * `nur-lesen`  — kein Bearbeitungsrecht oder ein nicht bearbeitbares Format.
 * `kein-zugang`— nicht sichtbar; die Route antwortet wie `ko-routes.ts` mit 404.
 */
export type OfficeSchreibweg = "direkt" | "vorschlag" | "nur-lesen" | "kein-zugang";

export function officeSchreibweg(
  rechte: OfficeRechte,
  artikel: { readonly status: string },
  format: OfficeFormat,
): OfficeSchreibweg {
  if (!rechte.darfLesen) {
    return "kein-zugang";
  }
  if (!format.bearbeitbar || !rechte.darfBearbeiten) {
    return "nur-lesen";
  }
  if (artikel.status === "validiert" && !rechte.darfFreigegebenesAendern) {
    return "vorschlag";
  }
  return "direkt";
}

// ------------------------------------------------------------------------------------------------
// ZUGANGSMARKE — das WOPI-`access_token`
// ------------------------------------------------------------------------------------------------
//
// Der Editor ruft den Host SERVER-ZU-SERVER und trägt dabei kein Klarwerk-Cookie. Er bekommt
// deshalb eine Marke, die genau EINEN Anhang EINES Artikels in EINER Ausgangsfassung für EINEN
// Nutzer öffnet. Sie ist signiert (HMAC-SHA-256 mit einem Serverschlüssel), nicht verschlüsselt:
// sie enthält keine Geheimnisse, nur Kennungen. Sie steht in der Anfrage-URL des Editors — die
// Protokollierung muss sie deshalb schwärzen (`log-sanitize.ts`), bevor der Weg verdrahtet wird.

/** WOPI empfiehlt eine Gültigkeit von zehn Stunden; die Rechte werden trotzdem je Anfrage geprüft. */
export const ZUGANGSMARKE_GUELTIG_MS = 10 * 60 * 60 * 1000;

/** Ein Schlüssel unter 32 Byte ist für HMAC-SHA-256 zu schwach und wird abgewiesen. */
export const ZUGANGSMARKE_MIN_SCHLUESSEL_BYTES = 32;

const MARKEN_KONTEXT = "klarwerk-wopi-v1.";

export interface ZugangsmarkenInhalt {
  readonly koId: string;
  /** Die WOPI-Dateikennung ist die Anhangskennung (`KoAttachment.id`). */
  readonly anhangId: string;
  readonly nutzerId: string;
  /** Nur bei Schreibweg `direkt` wahr. */
  readonly schreiben: boolean;
  /**
   * Die Artikelfassung, die beim ÖFFNEN galt. Sie entscheidet nur, ob eine NEUE Editor-Sitzung
   * beginnen darf (`entscheideSitzungsbeginn`). Die Übernahme prüft NICHT gegen sie, sondern gegen
   * die Sitzungsbasis, die der Host nach jeder eigenen Übernahme nachzieht (`entscheideUebernahme`).
   */
  readonly fassung: number;
  /** Ablauf in Millisekunden seit der Epoche (WOPI: `access_token_ttl`). */
  readonly bis: number;
}

export type MarkenPruefung =
  | { readonly gueltig: true; readonly inhalt: ZugangsmarkenInhalt }
  | {
      readonly gueltig: false;
      readonly grund: "form" | "signatur" | "abgelaufen" | "falsche-datei";
    };

function pruefeSchluessel(schluessel: Buffer): void {
  if (schluessel.length < ZUGANGSMARKE_MIN_SCHLUESSEL_BYTES) {
    throw new Error(
      `office-wopi: der Markenschlüssel hat ${schluessel.length} Byte, verlangt sind mindestens ${ZUGANGSMARKE_MIN_SCHLUESSEL_BYTES}.`,
    );
  }
}

function signatur(nutzlast: string, schluessel: Buffer): Buffer {
  return createHmac("sha256", schluessel)
    .update(MARKEN_KONTEXT + nutzlast)
    .digest();
}

export function stelleZugangsmarkeAus(
  inhalt: Omit<ZugangsmarkenInhalt, "bis">,
  schluessel: Buffer,
  jetzt: number,
): { marke: string; bis: number } {
  pruefeSchluessel(schluessel);
  const bis = jetzt + ZUGANGSMARKE_GUELTIG_MS;
  const nutzlast = Buffer.from(JSON.stringify({ ...inhalt, bis }), "utf8").toString("base64url");
  return { marke: `${nutzlast}.${signatur(nutzlast, schluessel).toString("base64url")}`, bis };
}

function istInhalt(wert: unknown): wert is ZugangsmarkenInhalt {
  if (!wert || typeof wert !== "object") {
    return false;
  }
  const w = wert as Record<string, unknown>;
  return (
    typeof w.koId === "string" &&
    w.koId.length > 0 &&
    typeof w.anhangId === "string" &&
    w.anhangId.length > 0 &&
    typeof w.nutzerId === "string" &&
    w.nutzerId.length > 0 &&
    typeof w.schreiben === "boolean" &&
    Number.isInteger(w.fassung) &&
    (w.fassung as number) >= 1 &&
    Number.isInteger(w.bis)
  );
}

/**
 * Prüft eine Marke für die WOPI-Dateikennung aus der Anfrage-URL. Reihenfolge: Form, Signatur
 * (zeitkonstant), Inhalt, Ablauf, Dateibindung — eine Marke für Anhang A öffnet Anhang B nie.
 */
export function pruefeZugangsmarke(
  marke: string,
  dateiKennung: string,
  schluessel: Buffer,
  jetzt: number,
): MarkenPruefung {
  pruefeSchluessel(schluessel);
  const teile = marke.split(".");
  if (teile.length !== 2 || teile[0] === "" || teile[1] === "") {
    return { gueltig: false, grund: "form" };
  }
  const [nutzlast, sig] = teile as [string, string];
  const erwartet = signatur(nutzlast, schluessel);
  const erhalten = Buffer.from(sig, "base64url");
  if (erhalten.length !== erwartet.length || !timingSafeEqual(erhalten, erwartet)) {
    return { gueltig: false, grund: "signatur" };
  }
  let inhalt: unknown;
  try {
    inhalt = JSON.parse(Buffer.from(nutzlast, "base64url").toString("utf8"));
  } catch {
    return { gueltig: false, grund: "form" };
  }
  if (!istInhalt(inhalt)) {
    return { gueltig: false, grund: "form" };
  }
  if (inhalt.bis <= jetzt) {
    return { gueltig: false, grund: "abgelaufen" };
  }
  if (inhalt.anhangId !== dateiKennung) {
    return { gueltig: false, grund: "falsche-datei" };
  }
  return { gueltig: true, inhalt };
}

// ------------------------------------------------------------------------------------------------
// CHECKFILEINFO — was der Editor über die Datei erfährt
// ------------------------------------------------------------------------------------------------

export interface CheckFileInfo {
  readonly BaseFileName: string;
  readonly OwnerId: string;
  readonly Size: number;
  readonly UserId: string;
  readonly UserFriendlyName: string;
  /** Ändert sich mit jedem gespeicherten Inhalt: Artikelfassung und Objektkennung. */
  readonly Version: string;
  readonly ReadOnly: boolean;
  readonly UserCanWrite: boolean;
  readonly SupportsLocks: true;
  readonly SupportsUpdate: boolean;
  /** „Speichern unter" legt keine Datei neben dem Artikel an — es gibt nur DIESEN Anhang. */
  readonly UserCanNotWriteRelative: true;
  readonly SupportsRename: false;
  /** Die Herkunft der einbettenden Seite; nur sie darf dem Editor Nachrichten schicken. */
  readonly PostMessageOrigin?: string;
}

export function checkFileInfo(args: {
  anhang: { readonly name: string; readonly objectId: string; readonly size: number };
  artikel: { readonly author: string; readonly version: number };
  nutzer: { readonly id: string; readonly name: string };
  schreiben: boolean;
  postMessageOrigin?: string;
}): CheckFileInfo {
  const { anhang, artikel, nutzer, schreiben, postMessageOrigin } = args;
  return {
    BaseFileName: anhang.name,
    OwnerId: artikel.author,
    Size: anhang.size,
    UserId: nutzer.id,
    UserFriendlyName: nutzer.name,
    Version: `${artikel.version}-${anhang.objectId}`,
    ReadOnly: !schreiben,
    UserCanWrite: schreiben,
    SupportsLocks: true,
    SupportsUpdate: schreiben,
    UserCanNotWriteRelative: true,
    SupportsRename: false,
    ...(postMessageOrigin === undefined ? {} : { PostMessageOrigin: postMessageOrigin }),
  };
}

// ------------------------------------------------------------------------------------------------
// SPERREN — die WOPI-Lock-Regeln
// ------------------------------------------------------------------------------------------------
//
// Eine Sperre gehört einer Editor-Sitzung und läuft nach 30 Minuten ohne Erneuern ab (WOPI). Eine
// abgelaufene Sperre ist KEINE Sperre. Bei 409 nennt `xWopiLock` die bestehende Sperre (leer, wenn
// keine besteht) — so verlangt es das Protokoll, damit der Editor den Konflikt erklären kann.
//
// Die Sperre ersetzt den Bearbeitungshinweis (`bearbeitungshinweis.ts`) NICHT: der zeigt Menschen
// in der Klarwerk-Fläche, wer gerade bearbeitet; die Sperre regelt den Schreibzugriff des Editors.

export const SPERRE_DAUER_MS = 30 * 60 * 1000;
export const SPERRE_MAX_LAENGE = 1024;

export interface Sperre {
  readonly kennung: string;
  readonly bis: number;
}

export type SperrAnfrage =
  | { readonly art: "LOCK"; readonly lock: string }
  | { readonly art: "UNLOCK"; readonly lock: string }
  | { readonly art: "REFRESH_LOCK"; readonly lock: string }
  | { readonly art: "UNLOCK_AND_RELOCK"; readonly lock: string; readonly alterLock: string }
  | { readonly art: "GET_LOCK" };

export interface SperrErgebnis {
  readonly status: 200 | 400 | 409;
  /** Der Sperrstand NACH der Anfrage. */
  readonly sperre: Sperre | undefined;
  readonly xWopiLock?: string;
}

function wirksam(sperre: Sperre | undefined, jetzt: number): Sperre | undefined {
  return sperre && sperre.bis > jetzt ? sperre : undefined;
}

function lockLesbar(lock: string): boolean {
  return lock.length > 0 && lock.length <= SPERRE_MAX_LAENGE;
}

export function wendeSperreAn(
  bestand: Sperre | undefined,
  anfrage: SperrAnfrage,
  jetzt: number,
): SperrErgebnis {
  const aktuell = wirksam(bestand, jetzt);
  const konflikt = (): SperrErgebnis => ({
    status: 409,
    sperre: aktuell,
    xWopiLock: aktuell?.kennung ?? "",
  });
  const neu = (kennung: string): Sperre => ({ kennung, bis: jetzt + SPERRE_DAUER_MS });

  if (anfrage.art === "GET_LOCK") {
    return { status: 200, sperre: aktuell, xWopiLock: aktuell?.kennung ?? "" };
  }
  if (!lockLesbar(anfrage.lock)) {
    return { status: 400, sperre: aktuell };
  }
  switch (anfrage.art) {
    case "LOCK":
      // Dieselbe Kennung erneut sperren heißt erneuern; eine fremde Kennung ist ein Konflikt.
      if (!aktuell || aktuell.kennung === anfrage.lock) {
        return { status: 200, sperre: neu(anfrage.lock) };
      }
      return konflikt();
    case "REFRESH_LOCK":
      return aktuell?.kennung === anfrage.lock
        ? { status: 200, sperre: neu(anfrage.lock) }
        : konflikt();
    case "UNLOCK":
      return aktuell?.kennung === anfrage.lock ? { status: 200, sperre: undefined } : konflikt();
    case "UNLOCK_AND_RELOCK":
      if (!lockLesbar(anfrage.alterLock)) {
        return { status: 400, sperre: aktuell };
      }
      return aktuell?.kennung === anfrage.alterLock
        ? { status: 200, sperre: neu(anfrage.lock) }
        : konflikt();
  }
}

// ------------------------------------------------------------------------------------------------
// PUTFILE — ein Speichern des Editors annehmen oder abweisen
// ------------------------------------------------------------------------------------------------
//
// Ein angenommenes PutFile legt den Inhalt als NEUES Objekt im Objektspeicher ab (der Speicher ist
// unveränderlich je Kennung) und vermerkt es als Arbeitsstand der Sitzung. Es erzeugt KEINE
// Artikelfassung: Editoren speichern automatisch alle paar Minuten, und jede Speicherung als
// Fassung wäre Rauschen. Die Fassung entsteht bei der Übernahme (Plan, Abschnitt 5) — mit
// `expectedVersion = Sitzungsbasis` über das bestehende CAS (siehe SITZUNGSBASIS unten); wer
// außerhalb der Sitzung dazwischen geschrieben hat, bekommt dort den `KO_STALE`-Konflikt.

/**
 * Größte Datei, deren Daten-URL in den Objektspeicher passt (`MAX_OBJECT_BYTES` misst die Länge
 * der Daten-URL, nicht die Dateigröße). Aus derselben Grenze abgeleitet, nicht abgeschrieben.
 */
export function passtInObjektspeicher(groesse: number, mime: string): boolean {
  const kopf = `data:${mime};base64,`.length;
  return kopf + 4 * Math.ceil(groesse / 3) <= MAX_OBJECT_BYTES;
}

export type PutFileErgebnis =
  | { readonly status: 200 }
  | { readonly status: 401; readonly grund: "nur-lesen" }
  | {
      readonly status: 409;
      readonly grund: "ohne-sperre" | "fremde-sperre";
      readonly xWopiLock: string;
    }
  | { readonly status: 413 };

export function entscheidePutFile(args: {
  marke: ZugangsmarkenInhalt;
  sperre: Sperre | undefined;
  /** Kopfzeile `X-WOPI-Lock` der Anfrage. */
  xWopiLock: string | undefined;
  groesse: number;
  mime: string;
  jetzt: number;
}): PutFileErgebnis {
  if (!args.marke.schreiben) {
    return { status: 401, grund: "nur-lesen" };
  }
  const aktuell = wirksam(args.sperre, args.jetzt);
  // Nur eine gesperrte Datei wird überschrieben. Die Ausnahme des Protokolls für eine NEUE, leere
  // Datei gibt es hier nicht: am Artikel hängt der Anhang immer schon mit Inhalt.
  if (!aktuell) {
    return { status: 409, grund: "ohne-sperre", xWopiLock: "" };
  }
  if (aktuell.kennung !== args.xWopiLock) {
    return { status: 409, grund: "fremde-sperre", xWopiLock: aktuell.kennung };
  }
  if (!passtInObjektspeicher(args.groesse, args.mime)) {
    return { status: 413 };
  }
  return { status: 200 };
}

// ------------------------------------------------------------------------------------------------
// SITZUNGSBASIS — eigene Übernahmen und fremde Änderungen getrennt (bens Befund, Nacharbeit 1)
// ------------------------------------------------------------------------------------------------
//
// Runde 1 band die Konfliktprüfung an die Fassung IN DER MARKE. Eine Marke ändert sich während der
// Sitzung nicht, die Artikelfassung aber schon — durch die EIGENE Übernahme. Die zweite Übernahme
// derselben Sitzung wäre dann an der ersten gescheitert (`KO_STALE` gegen sich selbst), und jeder
// weitere Teilnehmer der gemeinsamen Sitzung hätte eine andere Marke mit einer anderen Fassung.
//
// DIE REGEL: Die Basis gehört der EDITOR-SITZUNG (eine je Anhang, serverseitig beim Host), nicht der
// Marke und nicht dem Nutzer.
//   · Beginn   — die erste Sperre einer freien Datei beginnt die Sitzung. Basis = Markenfassung,
//                aber nur, wenn sie GLEICH der aktuellen Artikelfassung ist; sonst 409, der Editor
//                lädt neu und bekommt eine frische Marke. Wer einer laufenden Sitzung beitritt, ändert
//                die Basis nicht — der Editor zeigt ihm den Inhalt der Sitzung, nicht seine Fassung.
//   · Übernahme — CAS gegen die Basis. Gelingt sie, wird die NEUE Fassung die Basis: die eigene
//                Übernahme ist danach kein Konflikt. Die Marken bleiben gültig; sie tragen nur die
//                Öffnungsfassung und werden für die Übernahme nicht mehr befragt.
//   · Fremde Änderung — weicht die Artikelfassung von der Basis ab, hat jemand AUSSERHALB der Sitzung
//                geschrieben (Klarwerk-Texteditor, Import, Word-Add-in). Dann `KO_STALE`; die Basis
//                wird NICHT still nachgezogen — sonst überschriebe die nächste Übernahme die fremde
//                Änderung. Aufgelöst wird durch Schließen der Sitzung und Neuöffnen (neue Basis) oder
//                durch Einreichen des Arbeitsstands als Vorschlag.
//   · Ende     — ein erfolgreiches Entsperren beendet die Sitzung samt Basis und Arbeitsstand-Zeiger;
//                eine abgelaufene Sperre ebenso, sobald die nächste Sitzung beginnt. Die Objekte des
//                Arbeitsstands bleiben im Objektspeicher.

export type Sitzungsbeginn =
  | { readonly erlaubt: true; readonly basisFassung: number }
  | { readonly erlaubt: false; readonly markenFassung: number; readonly artikelFassung: number };

export function entscheideSitzungsbeginn(
  markenFassung: number,
  artikelFassung: number,
): Sitzungsbeginn {
  return markenFassung === artikelFassung
    ? { erlaubt: true, basisFassung: artikelFassung }
    : { erlaubt: false, markenFassung, artikelFassung };
}

export type UebernahmeEntscheidung =
  | { readonly art: "uebernehmen"; readonly expectedVersion: number }
  | { readonly art: "ohne-sitzung" }
  | { readonly art: "ohne-arbeitsstand" }
  | {
      readonly art: "fremde-aenderung";
      readonly basisFassung: number;
      readonly artikelFassung: number;
    };

export function entscheideUebernahme(args: {
  /** `undefined`: keine laufende Sitzung für diesen Anhang. */
  basisFassung: number | undefined;
  artikelFassung: number;
  hatArbeitsstand: boolean;
}): UebernahmeEntscheidung {
  if (args.basisFassung === undefined) {
    return { art: "ohne-sitzung" };
  }
  if (!args.hatArbeitsstand) {
    return { art: "ohne-arbeitsstand" };
  }
  if (args.artikelFassung !== args.basisFassung) {
    return {
      art: "fremde-aenderung",
      basisFassung: args.basisFassung,
      artikelFassung: args.artikelFassung,
    };
  }
  return { art: "uebernehmen", expectedVersion: args.basisFassung };
}

function asciiKlein(text: string): string {
  return text.replace(/[A-Z]/g, (zeichen) => zeichen.toLowerCase());
}
