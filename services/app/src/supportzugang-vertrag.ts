import type { Role } from "../../auth";
import { canManageUsers } from "../../rbac";

// ================================================================================================
// produkt:20261011:peter-p11 (PETER-20261011-P11) — DER INTEGRATIONSVERTRAG FÜR BEGRENZTEN SUPPORT.
// ================================================================================================
//
// Phase: Konzept jetzt, Betreiber nach dem PoC. Dieses Modul legt fest, WIE ein künftiger
// Supportzugang sich verhalten muss — als reine Funktionen ohne Speicher, Route, Zeitgeber oder
// Netzverbindung. Es ist nirgends an `build-app.ts` angeschlossen: Es öffnet keinen Zugang, startet
// keine Relaisinstanz und keine Supportsitzung. Der bisherige Fernhilfeweg (ausgehend, auf Klick,
// `docs/operations/UEBERGABE-KLARWERK-Insel.md`) und sein Relaisblocker bleiben unberührt.
//
// Wer später den Zugang baut, hängt Sitzungsprüfung, Hintergrundjobs und Prüfprotokoll an diese
// Funktionen; die Gegenprobe `tests/begrenzter-support/supportzugang-vertrag.test.ts` hält jedes
// Kriterium P11-AC01…AC08 mit Positiv- und Negativfall fest. Konzept und Grenzen:
// `docs/operations/begrenzter-support.md`.

export const SUPPORTZUGANG_VERTRAGSFASSUNG = "0.1.0-konzept";

/** Der Zugang ist nicht gebaut; ein Betreiber ist erst nach dem PoC benannt. */
export const SUPPORTZUGANG_PHASE = Object.freeze({
  phase: "konzept",
  betreiber: "nach PoC",
  zugangAktiv: false,
} as const);

const MINUTE = 60_000;

// ------------------------------------------------------------------------------------------------
// P11-AC01 — namentliche Supportidentität statt gemeinsamem Dauerkonto.
// ------------------------------------------------------------------------------------------------

export interface SupportIdentitaet {
  /** Persönliche Anmeldekennung beim Betreiber, z. B. `vorname.nachname@betreiber.example`. */
  readonly kennung: string;
  readonly anzeigename: string;
  readonly betreiber: string;
  /** Die Anmeldung dieser Person ist mit zweitem Faktor bestätigt. */
  readonly mfaBestaetigt: boolean;
}

/** Namen, die eine Funktion statt einer Person benennen — dahinter steht ein geteiltes Konto. */
const FUNKTIONSNAMEN = [
  "support",
  "helpdesk",
  "service",
  "admin",
  "administrator",
  "root",
  "team",
  "klarwerk",
  "betreiber",
  "hotline",
  "info",
  "kontakt",
  "test",
  "gast",
  "notfall",
];

function istFunktionsname(wert: string): boolean {
  const klein = wert.trim().toLowerCase();
  return FUNKTIONSNAMEN.includes(klein.replace(/\d+$/, ""));
}

export type IdentitaetsFehler =
  | "kennung_fehlt"
  | "geteiltes_konto"
  | "name_fehlt"
  | "betreiber_fehlt"
  | "mfa_fehlt";

export function identitaetPruefen(
  id: SupportIdentitaet,
): { ok: true } | { ok: false; fehler: IdentitaetsFehler } {
  const kennung = id.kennung.trim();
  if (kennung === "") return { ok: false, fehler: "kennung_fehlt" };
  if (istFunktionsname(kennung.split("@")[0] ?? "")) {
    return { ok: false, fehler: "geteiltes_konto" };
  }
  if (id.anzeigename.trim() === "" || istFunktionsname(id.anzeigename)) {
    return { ok: false, fehler: "name_fehlt" };
  }
  if (id.betreiber.trim() === "") return { ok: false, fehler: "betreiber_fehlt" };
  if (!id.mfaBestaetigt) return { ok: false, fehler: "mfa_fehlt" };
  return { ok: true };
}

// ------------------------------------------------------------------------------------------------
// P11-AC05 — vorgeschlagene Zeitwerte: konfigurierbar, nicht beschlossen, keine SLA.
// ------------------------------------------------------------------------------------------------

export interface SupportZeitwerte {
  readonly sitzungMinuten: number;
  readonly inaktivitaetMinuten: number;
  /** Obergrenze ab Erteilung; nur durch ausdrücklich erneuerte Freigabe erreichbar. */
  readonly hoechstMinuten: number;
}

export interface FestgelegteZeitwerte extends SupportZeitwerte {
  /** `vorschlag` = unveränderte Werte aus P11; `konfiguriert` = vom Betreiber gesetzt. */
  readonly herkunft: "vorschlag" | "konfiguriert";
  /** Kein Zeitwert ist eine zugesagte Reaktions-, Bereitschafts- oder Verfügbarkeitszeit. */
  readonly sla: false;
  readonly beschlossen: false;
}

export const VORGESCHLAGENE_ZEITWERTE: FestgelegteZeitwerte = Object.freeze({
  sitzungMinuten: 60,
  inaktivitaetMinuten: 15,
  hoechstMinuten: 240,
  herkunft: "vorschlag",
  sla: false,
  beschlossen: false,
});

export const ZEITWERTE_HINWEIS =
  "Vorschlag aus PETER-20261011-P11, noch nicht beschlossen. Begrenzung des Zugriffs, keine zugesagte Reaktions- oder Bereitschaftszeit.";

export function zeitwerteFestlegen(
  abweichung: Partial<SupportZeitwerte> = {},
): { ok: true; werte: FestgelegteZeitwerte } | { ok: false; fehler: string } {
  const v = VORGESCHLAGENE_ZEITWERTE;
  const werte: SupportZeitwerte = {
    sitzungMinuten: abweichung.sitzungMinuten ?? v.sitzungMinuten,
    inaktivitaetMinuten: abweichung.inaktivitaetMinuten ?? v.inaktivitaetMinuten,
    hoechstMinuten: abweichung.hoechstMinuten ?? v.hoechstMinuten,
  };
  for (const [name, wert] of Object.entries(werte)) {
    if (!Number.isInteger(wert) || wert <= 0) {
      return { ok: false, fehler: `${name}_ungueltig` };
    }
  }
  if (werte.inaktivitaetMinuten > werte.sitzungMinuten) {
    return { ok: false, fehler: "inaktivitaet_ueber_sitzung" };
  }
  if (werte.sitzungMinuten > werte.hoechstMinuten) {
    return { ok: false, fehler: "sitzung_ueber_hoechstdauer" };
  }
  const unveraendert =
    werte.sitzungMinuten === v.sitzungMinuten &&
    werte.inaktivitaetMinuten === v.inaktivitaetMinuten &&
    werte.hoechstMinuten === v.hoechstMinuten;
  return {
    ok: true,
    werte: Object.freeze({
      ...werte,
      herkunft: unveraendert ? "vorschlag" : "konfiguriert",
      sla: false,
      beschlossen: false,
    }),
  };
}

// ------------------------------------------------------------------------------------------------
// P11-AC03 / P11-AC04 — Diagnose ohne Inhalt als Ausgangspunkt; Lesen, Ändern, Export getrennt.
// ------------------------------------------------------------------------------------------------

export type SupportRecht = "diagnose" | "lesen" | "aendern" | "export";

/**
 * Was Diagnose sieht: Betriebszustand ohne Wissensinhalt. Titel, Texte, Anhänge, Personennamen
 * und Suchbegriffe gehören NICHT dazu.
 */
export const DIAGNOSE_UMFANG = Object.freeze([
  "Version, Commit und Instanzidentität (/health)",
  "KI-Status ohne Prompt- und Antworttext",
  "Fehlerkennungen und Zeitpunkte aus dem Protokoll ohne Inhaltswerte",
  "Zählwerte (Anzahl Objekte, Konten, Jobs) ohne Titel oder Namen",
  "Konfigurationsschalter ohne Geheimniswerte",
] as const);

/** Diagnose ist das einzige Recht ohne Inhaltszugriff. */
export function mitInhaltszugriff(recht: SupportRecht): boolean {
  return recht !== "diagnose";
}

// ------------------------------------------------------------------------------------------------
// P11-AC02 — Kundenadmin bestätigt Zweck, Datenbereich und Dauer.
// ------------------------------------------------------------------------------------------------

export interface Kundenadmin {
  readonly kennung: string;
  readonly rolle: Role;
}

export interface ExportRegel {
  readonly zweck: string;
  readonly loeschfristTage: number;
}

export interface FreigabeAntrag {
  /** Konkreter Supportfall, z. B. Ticketkennung des Kunden. */
  readonly fall: string;
  readonly zweck: string;
  /** Konkreter Datenbereich, z. B. ein Wissensraum oder eine Importquelle. */
  readonly datenbereich: string;
  readonly dauerMinuten: number;
  /** Fehlt oder leer: nur Diagnose. Jedes weitere Recht steht einzeln im Antrag. */
  readonly rechte?: readonly SupportRecht[];
  /** Pflicht, sobald `export` beantragt ist. */
  readonly export?: ExportRegel;
}

export interface SupportFreigabe {
  readonly id: string;
  readonly fall: string;
  readonly zweck: string;
  readonly datenbereich: string;
  readonly rechte: readonly SupportRecht[];
  readonly export: ExportRegel | null;
  readonly identitaet: SupportIdentitaet;
  readonly bestaetigtVon: string;
  readonly erteiltAm: number;
  readonly endetAm: number;
  readonly letzteBedienungAm: number;
  readonly zeitwerte: FestgelegteZeitwerte;
  readonly widerrufenAm: number | null;
  readonly abgeschlossenAm: number | null;
}

// ------------------------------------------------------------------------------------------------
// P11-AC08 — Protokoll mit realem Beleg.
// ------------------------------------------------------------------------------------------------

export interface SupportBeleg {
  /** Woher der Beleg stammt: Adminbestätigung im Produkt oder Ticket beim Kunden. */
  readonly art: "adminbestaetigung" | "ticket";
  /** Auffindbare Kennung des Belegs beim Kunden oder im Prüfprotokoll. */
  readonly referenz: string;
  readonly am: number;
}

export interface SupportEreignis {
  readonly art:
    | "erteilt"
    | "verlaengert"
    | "widerrufen"
    | "abgelaufen"
    | "nachbeendet"
    | "abgeschlossen";
  readonly freigabeId: string;
  readonly am: number;
  readonly durch: string;
  readonly beleg?: SupportBeleg;
  readonly ergebnis?: string;
  readonly beendet?: readonly string[];
  readonly nichtBeendet?: readonly string[];
}

export type BelegFehler = "beleg_fehlt" | "beleg_platzhalter" | "beleg_zukunft";

const PLATZHALTER = /^(-+|\.+|x+|todo|tbd|offen|beleg|n\/?a|keine?|folgt|\?+)$/i;

export function belegPruefen(
  beleg: SupportBeleg | undefined,
  jetzt: number,
): { ok: true } | { ok: false; fehler: BelegFehler } {
  if (!beleg || beleg.referenz.trim() === "") return { ok: false, fehler: "beleg_fehlt" };
  if (PLATZHALTER.test(beleg.referenz.trim())) return { ok: false, fehler: "beleg_platzhalter" };
  if (!Number.isFinite(beleg.am) || beleg.am > jetzt) {
    return { ok: false, fehler: "beleg_zukunft" };
  }
  return { ok: true };
}

export type ErteilungsFehler =
  | IdentitaetsFehler
  | BelegFehler
  | "kein_kundenadmin"
  | "selbstfreigabe"
  | "fall_fehlt"
  | "zweck_fehlt"
  | "datenbereich_fehlt"
  | "dauer_ungueltig"
  | "dauer_ueber_sitzung"
  | "exportzweck_fehlt";

export type ErteilungsErgebnis =
  | { ok: true; freigabe: SupportFreigabe; ereignis: SupportEreignis }
  | { ok: false; fehler: ErteilungsFehler };

export function freigabeErteilen(eingabe: {
  readonly id: string;
  readonly antrag: FreigabeAntrag;
  readonly identitaet: SupportIdentitaet;
  readonly admin: Kundenadmin;
  readonly beleg: SupportBeleg;
  readonly zeitwerte?: FestgelegteZeitwerte;
  readonly jetzt: number;
}): ErteilungsErgebnis {
  const { id, antrag, identitaet, admin, beleg, jetzt } = eingabe;
  const zeitwerte = eingabe.zeitwerte ?? VORGESCHLAGENE_ZEITWERTE;
  const person = identitaetPruefen(identitaet);
  if (!person.ok) return { ok: false, fehler: person.fehler };
  if (!canManageUsers(admin.rolle)) return { ok: false, fehler: "kein_kundenadmin" };
  if (admin.kennung.trim().toLowerCase() === identitaet.kennung.trim().toLowerCase()) {
    return { ok: false, fehler: "selbstfreigabe" };
  }
  if (antrag.fall.trim() === "") return { ok: false, fehler: "fall_fehlt" };
  if (antrag.zweck.trim() === "") return { ok: false, fehler: "zweck_fehlt" };
  if (antrag.datenbereich.trim() === "") return { ok: false, fehler: "datenbereich_fehlt" };
  if (!Number.isInteger(antrag.dauerMinuten) || antrag.dauerMinuten <= 0) {
    return { ok: false, fehler: "dauer_ungueltig" };
  }
  if (antrag.dauerMinuten > zeitwerte.sitzungMinuten) {
    return { ok: false, fehler: "dauer_ueber_sitzung" };
  }
  const rechte = new Set<SupportRecht>(["diagnose", ...(antrag.rechte ?? [])]);
  let exportRegel: ExportRegel | null = null;
  if (rechte.has("export")) {
    const ex = antrag.export;
    if (
      !ex ||
      ex.zweck.trim() === "" ||
      !Number.isInteger(ex.loeschfristTage) ||
      ex.loeschfristTage <= 0
    ) {
      return { ok: false, fehler: "exportzweck_fehlt" };
    }
    exportRegel = { zweck: ex.zweck, loeschfristTage: ex.loeschfristTage };
  }
  const belegOk = belegPruefen(beleg, jetzt);
  if (!belegOk.ok) return { ok: false, fehler: belegOk.fehler };
  const freigabe: SupportFreigabe = Object.freeze({
    id,
    fall: antrag.fall,
    zweck: antrag.zweck,
    datenbereich: antrag.datenbereich,
    rechte: Object.freeze([...rechte]),
    export: exportRegel,
    identitaet,
    bestaetigtVon: admin.kennung,
    erteiltAm: jetzt,
    endetAm: jetzt + antrag.dauerMinuten * MINUTE,
    letzteBedienungAm: jetzt,
    zeitwerte,
    widerrufenAm: null,
    abgeschlossenAm: null,
  });
  return {
    ok: true,
    freigabe,
    ereignis: { art: "erteilt", freigabeId: id, am: jetzt, durch: admin.kennung, beleg },
  };
}

// ------------------------------------------------------------------------------------------------
// P11-AC06 — Ablauf und Inaktivität beenden den Zugriff technisch.
// ------------------------------------------------------------------------------------------------

export type FreigabeZustand = "aktiv" | "abgelaufen" | "inaktiv" | "widerrufen" | "abgeschlossen";

export function freigabeZustand(f: SupportFreigabe, jetzt: number): FreigabeZustand {
  if (f.abgeschlossenAm !== null) return "abgeschlossen";
  if (f.widerrufenAm !== null) return "widerrufen";
  if (jetzt >= f.endetAm) return "abgelaufen";
  if (jetzt - f.letzteBedienungAm >= f.zeitwerte.inaktivitaetMinuten * MINUTE) return "inaktiv";
  return "aktiv";
}

/**
 * `bedienung` = Handlung der benannten Person; nur sie zählt als Aktivität.
 * `hintergrund` = Abfrage eines Jobs oder Pollings; sie verlängert nichts (keine stille Verlängerung).
 */
export type Anfrageart = "bedienung" | "hintergrund";

export type ZugriffsErgebnis =
  | { erlaubt: true; freigabe: SupportFreigabe }
  | { erlaubt: false; grund: Exclude<FreigabeZustand, "aktiv"> | "recht_fehlt" };

export function zugriffPruefen(
  f: SupportFreigabe,
  recht: SupportRecht,
  jetzt: number,
  art: Anfrageart,
): ZugriffsErgebnis {
  const zustand = freigabeZustand(f, jetzt);
  if (zustand !== "aktiv") return { erlaubt: false, grund: zustand };
  if (!f.rechte.includes(recht)) return { erlaubt: false, grund: "recht_fehlt" };
  const freigabe = art === "bedienung" ? Object.freeze({ ...f, letzteBedienungAm: jetzt }) : f;
  return { erlaubt: true, freigabe };
}

// ------------------------------------------------------------------------------------------------
// P11-AC07 — Widerruf (ebenso Ablauf und Abschluss) beendet auch bestehende Sitzungen und Jobs.
// ------------------------------------------------------------------------------------------------

/** Eine laufende Sitzung oder ein Hintergrundjob, der unter einer Freigabe gestartet wurde. */
export interface FreigabeBindung {
  readonly art: "sitzung" | "job";
  readonly kennung: string;
  readonly freigabeId: string;
}

/** Beendet eine Bindung im Betrieb; `true` nur, wenn sie danach nachweislich nicht mehr läuft. */
export type BindungBeenden = (b: FreigabeBindung) => boolean;

function bindungenBeenden(
  freigabeId: string,
  laufend: readonly FreigabeBindung[],
  beenden: BindungBeenden,
): { beendet: string[]; nichtBeendet: string[] } {
  const beendet: string[] = [];
  const nichtBeendet: string[] = [];
  for (const b of laufend) {
    if (b.freigabeId !== freigabeId) continue;
    let ok = false;
    try {
      ok = beenden(b) === true;
    } catch {
      ok = false;
    }
    (ok ? beendet : nichtBeendet).push(`${b.art}:${b.kennung}`);
  }
  return { beendet, nichtBeendet };
}

export type BeendigungsErgebnis<F extends string> =
  | { ok: true; freigabe: SupportFreigabe; ereignis: SupportEreignis; vollstaendig: boolean }
  | { ok: false; fehler: F };

export function widerrufen(eingabe: {
  readonly freigabe: SupportFreigabe;
  readonly admin: Kundenadmin;
  readonly laufend: readonly FreigabeBindung[];
  readonly beenden: BindungBeenden;
  readonly jetzt: number;
}): BeendigungsErgebnis<"kein_kundenadmin" | "bereits_beendet"> {
  const { freigabe, admin, laufend, beenden, jetzt } = eingabe;
  if (!canManageUsers(admin.rolle)) return { ok: false, fehler: "kein_kundenadmin" };
  if (freigabe.widerrufenAm !== null || freigabe.abgeschlossenAm !== null) {
    return { ok: false, fehler: "bereits_beendet" };
  }
  // Der Widerruf gilt sofort, auch wenn eine Bindung sich nicht beenden ließ; die steht dann offen
  // im Ereignis, macht den Widerruf unvollständig und wird über `beendigungWiederholen` nachbeendet.
  const { beendet, nichtBeendet } = bindungenBeenden(freigabe.id, laufend, beenden);
  return {
    ok: true,
    freigabe: Object.freeze({ ...freigabe, widerrufenAm: jetzt }),
    vollstaendig: nichtBeendet.length === 0,
    ereignis: {
      art: "widerrufen",
      freigabeId: freigabe.id,
      am: jetzt,
      durch: admin.kennung,
      beendet,
      nichtBeendet,
    },
  };
}

export type AblaufErgebnis =
  | { faellig: false }
  | { faellig: true; ereignis: SupportEreignis; vollstaendig: boolean };

/** Ablauf oder Inaktivität: dieselbe Beendigung laufender Bindungen wie beim Widerruf. */
export function ablaufDurchsetzen(eingabe: {
  readonly freigabe: SupportFreigabe;
  readonly laufend: readonly FreigabeBindung[];
  readonly beenden: BindungBeenden;
  readonly jetzt: number;
}): AblaufErgebnis {
  const { freigabe, laufend, beenden, jetzt } = eingabe;
  const zustand = freigabeZustand(freigabe, jetzt);
  if (zustand !== "abgelaufen" && zustand !== "inaktiv") return { faellig: false };
  const { beendet, nichtBeendet } = bindungenBeenden(freigabe.id, laufend, beenden);
  return {
    faellig: true,
    vollstaendig: nichtBeendet.length === 0,
    ereignis: {
      art: "abgelaufen",
      freigabeId: freigabe.id,
      am: jetzt,
      durch: "system",
      ergebnis: zustand,
      beendet,
      nichtBeendet,
    },
  };
}

export type NachbeendigungsErgebnis =
  | { ok: true; freigabe: SupportFreigabe; ereignis: SupportEreignis; vollstaendig: boolean }
  | { ok: false; fehler: "noch_aktiv" };

/**
 * Wiederholt die Beendigung verbliebener Sitzungen und Jobs einer Freigabe, die widerrufen,
 * abgeschlossen, abgelaufen oder inaktiv ist — so oft, bis nichts mehr läuft. `laufend` sind die
 * noch offenen Bindungen (z. B. `nichtBeendet` des vorigen Ereignisses). Die Freigabe bleibt
 * unverändert gesperrt: Eine Nachbeendigung gibt keinen Zugriff frei und setzt keinen Zeitpunkt
 * zurück. Jeder Versuch wird als `nachbeendet` protokolliert, auch ein erneut erfolgloser.
 */
export function beendigungWiederholen(eingabe: {
  readonly freigabe: SupportFreigabe;
  /** Wer den Versuch auslöst: `system` oder die Kennung eines Kundenadmins. */
  readonly durch: string;
  readonly laufend: readonly FreigabeBindung[];
  readonly beenden: BindungBeenden;
  readonly jetzt: number;
}): NachbeendigungsErgebnis {
  const { freigabe, durch, laufend, beenden, jetzt } = eingabe;
  const zustand = freigabeZustand(freigabe, jetzt);
  if (zustand === "aktiv") return { ok: false, fehler: "noch_aktiv" };
  const { beendet, nichtBeendet } = bindungenBeenden(freigabe.id, laufend, beenden);
  return {
    ok: true,
    freigabe,
    vollstaendig: nichtBeendet.length === 0,
    ereignis: {
      art: "nachbeendet",
      freigabeId: freigabe.id,
      am: jetzt,
      durch,
      ergebnis: zustand,
      beendet,
      nichtBeendet,
    },
  };
}

// ------------------------------------------------------------------------------------------------
// P11-AC08 — Verlängerung und Abschluss mit realem Beleg.
// ------------------------------------------------------------------------------------------------

export type VerlaengerungsFehler =
  | BelegFehler
  | "kein_kundenadmin"
  | "nicht_aktiv"
  | "dauer_ungueltig"
  | "ueber_hoechstdauer";

export type VerlaengerungsErgebnis =
  | { ok: true; freigabe: SupportFreigabe; ereignis: SupportEreignis }
  | { ok: false; fehler: VerlaengerungsFehler };

export function verlaengern(eingabe: {
  readonly freigabe: SupportFreigabe;
  readonly admin: Kundenadmin;
  readonly zusatzMinuten: number;
  readonly beleg: SupportBeleg;
  readonly jetzt: number;
}): VerlaengerungsErgebnis {
  const { freigabe, admin, zusatzMinuten, beleg, jetzt } = eingabe;
  if (!canManageUsers(admin.rolle)) return { ok: false, fehler: "kein_kundenadmin" };
  // Abgelaufen, inaktiv oder widerrufen wird nicht verlängert, sondern neu erteilt.
  if (freigabeZustand(freigabe, jetzt) !== "aktiv") return { ok: false, fehler: "nicht_aktiv" };
  if (
    !Number.isInteger(zusatzMinuten) ||
    zusatzMinuten <= 0 ||
    zusatzMinuten > freigabe.zeitwerte.sitzungMinuten
  ) {
    return { ok: false, fehler: "dauer_ungueltig" };
  }
  const endetAm = freigabe.endetAm + zusatzMinuten * MINUTE;
  if (endetAm > freigabe.erteiltAm + freigabe.zeitwerte.hoechstMinuten * MINUTE) {
    return { ok: false, fehler: "ueber_hoechstdauer" };
  }
  const belegOk = belegPruefen(beleg, jetzt);
  if (!belegOk.ok) return { ok: false, fehler: belegOk.fehler };
  return {
    ok: true,
    freigabe: Object.freeze({ ...freigabe, endetAm }),
    ereignis: {
      art: "verlaengert",
      freigabeId: freigabe.id,
      am: jetzt,
      durch: admin.kennung,
      beleg,
      ergebnis: `bis ${new Date(endetAm).toISOString()}`,
    },
  };
}

export function abschliessen(eingabe: {
  readonly freigabe: SupportFreigabe;
  /** Die benannte Supportperson oder ein Kundenadmin. */
  readonly durch: string;
  readonly ergebnis: string;
  readonly beleg: SupportBeleg;
  readonly laufend: readonly FreigabeBindung[];
  readonly beenden: BindungBeenden;
  readonly jetzt: number;
}): BeendigungsErgebnis<BelegFehler | "bereits_abgeschlossen" | "ergebnis_fehlt"> {
  const { freigabe, durch, ergebnis, beleg, laufend, beenden, jetzt } = eingabe;
  if (freigabe.abgeschlossenAm !== null) return { ok: false, fehler: "bereits_abgeschlossen" };
  if (ergebnis.trim() === "" || PLATZHALTER.test(ergebnis.trim())) {
    return { ok: false, fehler: "ergebnis_fehlt" };
  }
  const belegOk = belegPruefen(beleg, jetzt);
  if (!belegOk.ok) return { ok: false, fehler: belegOk.fehler };
  const { beendet, nichtBeendet } = bindungenBeenden(freigabe.id, laufend, beenden);
  return {
    ok: true,
    freigabe: Object.freeze({ ...freigabe, abgeschlossenAm: jetzt }),
    vollstaendig: nichtBeendet.length === 0,
    ereignis: {
      art: "abgeschlossen",
      freigabeId: freigabe.id,
      am: jetzt,
      durch,
      beleg,
      ergebnis,
      beendet,
      nichtBeendet,
    },
  };
}
