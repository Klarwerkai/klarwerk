// ================================================================================================
// produkt:20261011:assistenz-browser-aktionen (BPA-03) — BERECHTIGTE FUNKTIONEN AUF EINER
// BROWSERSEITE AUSFÜHREN: DER VERTRAG DES BROWSERADAPTERS.
// ================================================================================================
//
// KEIN ZWEITER KERN. Klara 05 (`klara-auftrag.ts`, `klara-ausfuehrung.ts`) und PV-02
// (`klara-aktionsverlauf.ts`) führen Aufträge an den Türen der Anwendung aus. Eine fremde Webseite
// hat keine solche Tür; ihr Gegenstück ist der Seitenausführer der Erweiterung
// (`extensions/klara-browser/aktion.js`). Diese Datei legt fest, was Klara dort darf, und führt es
// mit denselben Grundsätzen aus: Auftragsquelle (`getippt`/`gesprochen`), Aktionskennung je
// Schritt, Prüfung vor JEDEM Schritt, Nachlesen vor einer Erfolgsmeldung, Rücknahme nur, wo sie
// wirklich möglich ist. Fremde Anweisungen erkennt dieselbe Regel wie bei Skills
// (`enthaeltFremdeAnweisung`).
//
// DIE GRENZEN (G04/G07/G08/G12, BPA-03):
//   · DAS REGISTER trennt Lesen, Entwurf füllen, Entwurf speichern, Entwurf löschen und endgültiges
//     Auslösen. Jede Art hat einen festen Vertrag (Folge, Rücknahme, Bestätigung); ein Seitenprofil
//     nennt je Website und Formular, welche davon dort tatsächlich unterstützt sind.
//   · DER AUFTRAG kommt nur von der Person. Er bindet Mandant, Nutzer, Sitzung, Host, Tab, Seite,
//     Formular und Werte und ist danach unveränderlich. Seiteninhalt, Tooltip und Download sind
//     Daten (`inhaltAufnehmen`): sie ändern weder Ziel noch Werte noch erlaubte Handlungen.
//   · EIN ENTWURFSAUFTRAG erlaubt kein Auslösen. Auslösen steht nur im Auftrag, wenn die Person es
//     ausdrücklich nennt, und wirkt erst mit einer Außenaktionsbestätigung, die an genau diesen
//     Auftrag, dieses Formular und diese Werte gebunden ist — und genau einmal gilt.
//   · VOR JEDEM SCHRITT: Halt (Pause/Abbruch), aktuelle Rechte, Tab und Seite, Hindernisse
//     (CAPTCHA, MFA, Anmeldung) und der Formularaufbau. Ein geänderter Aufbau wird nur dann neu
//     gebunden, wenn jedes beauftragte Feld genau einmal unter derselben Beschriftung steht — sonst
//     gezielte Klärung. Kein Schreiben in ein „ähnliches" Feld.
//   · SPEICHERN ist erst nach dem Nachlesen auf der Seite ein Erfolg. Ein unklarer Speicherausgang
//     wird vor jeder Wiederholung an der Seite abgeglichen; ein unklares Auslösen wird nie
//     wiederholt, sondern der Person zur Prüfung übergeben.
//   · KEINE UMGEHUNG: CAPTCHA, MFA, Anmeldung, nicht unterstützte Seite und gesperrte Handlung
//     enden in einem konkreten manuellen Schritt, nie in einem gemeldeten Erfolg.
//
// BEWUSST NICHT HIER: die Übertragung zwischen Worker und Seite (`chrome.scripting`) und die
// Oberfläche der Bestätigung. Beide reichen ihre Ergebnisse über `BrowserSeitenadapter` bzw.
// `bestaetige` herein; diese Datei vertraut keiner Antwort mehr, als der Vertrag erlaubt.
import { createHash, randomUUID } from "node:crypto";
import { enthaeltFremdeAnweisung } from "./assistenz-faehigkeiten";
import { aktionskennung } from "./klara-aktionsverlauf";
import { KLARA_QUELLEN_DES_AUFTRAGS, type KlaraAuftragsQuelle } from "./klara-auftrag";

// ------------------------------------------------------------------------------------------------
// DAS CAPABILITY-REGISTER
// ------------------------------------------------------------------------------------------------

export const BROWSER_HANDLUNGSARTEN = [
  "lesen",
  "entwurf_fuellen",
  "entwurf_speichern",
  "entwurf_loeschen",
  "ausloesen",
] as const;
export type BrowserHandlungsArt = (typeof BROWSER_HANDLUNGSARTEN)[number];

export interface BrowserHandlungsvertrag {
  readonly art: BrowserHandlungsArt;
  /** `keine`: liest nur; `eingabe`: ungespeicherte Feldwerte; `eigener_entwurf`; `aussenwirkung`. */
  readonly folge: "keine" | "eingabe" | "eigener_entwurf" | "aussenwirkung";
  readonly ruecknahme: "keine" | "feldwerte_zurueck" | "entwurf_loeschen";
  /** Harmlose beauftragte Schritte laufen ohne Rückfrage; Außenwirkung braucht ihre Bestätigung. */
  readonly bestaetigung: "keine_zusaetzliche" | "aussenaktionsbestaetigung";
  /** Ob die Handlung einen Knopf der Seite auslöst. */
  readonly knopf: boolean;
  readonly beschreibung: string;
}

type Handlungsvertraege = Readonly<Record<BrowserHandlungsArt, BrowserHandlungsvertrag>>;

export const BROWSER_HANDLUNGSVERTRAG: Handlungsvertraege = {
  lesen: {
    art: "lesen",
    folge: "keine",
    ruecknahme: "keine",
    bestaetigung: "keine_zusaetzliche",
    knopf: false,
    beschreibung: "Formularaufbau und gespeicherte Entwürfe lesen; ändert nichts.",
  },
  entwurf_fuellen: {
    art: "entwurf_fuellen",
    folge: "eingabe",
    ruecknahme: "feldwerte_zurueck",
    bestaetigung: "keine_zusaetzliche",
    knopf: false,
    beschreibung: "Beauftragte Werte in benannte Felder eintragen; nichts wird gespeichert.",
  },
  entwurf_speichern: {
    art: "entwurf_speichern",
    folge: "eigener_entwurf",
    ruecknahme: "entwurf_loeschen",
    bestaetigung: "keine_zusaetzliche",
    knopf: true,
    beschreibung: "Den Entwurf auf der Seite speichern; er bleibt ein Entwurf der Person.",
  },
  entwurf_loeschen: {
    art: "entwurf_loeschen",
    folge: "eigener_entwurf",
    ruecknahme: "keine",
    bestaetigung: "keine_zusaetzliche",
    knopf: true,
    beschreibung: "Nur zur Rücknahme: den von Klara gespeicherten Entwurf wieder löschen.",
  },
  ausloesen: {
    art: "ausloesen",
    folge: "aussenwirkung",
    ruecknahme: "keine",
    bestaetigung: "aussenaktionsbestaetigung",
    knopf: true,
    beschreibung: "Endgültig auslösen (Senden, Bestellen …); wirkt nach außen, nicht rücknehmbar.",
  },
};

export interface BrowserHandlung {
  readonly art: BrowserHandlungsArt;
  /** Der zugängliche Name des Knopfs auf der Seite; `null` bei Lesen und Füllen. */
  readonly knopf: string | null;
}

export interface BrowserFormularProfil {
  /** Der zugängliche Name des Formulars (`aria-label`/`aria-labelledby`). */
  readonly name: string;
  /** Die Feldbeschriftungen, in die Klara schreiben darf. */
  readonly felder: readonly string[];
  /** Das Feld, dessen Wert einen gespeicherten Entwurf in der Entwurfsliste wiedererkennt. */
  readonly kennfeld: string | null;
  readonly handlungen: readonly BrowserHandlung[];
}

export interface BrowserEntwurfsliste {
  /** Der zugängliche Name der Liste gespeicherter Entwürfe. */
  readonly name: string;
  /** Das `data-*`-Attribut, das je Eintrag die Kennung der Seite trägt. */
  readonly kennung: string;
}

export interface BrowserSeitenprofil {
  readonly id: string;
  readonly fassung: string;
  readonly origin: string;
  readonly pfad: string;
  readonly formulare: readonly BrowserFormularProfil[];
  readonly entwurfsliste: BrowserEntwurfsliste | null;
  /** Adapter-/Sicherheitsverantwortung (Rolle, keine erfundene Person). */
  readonly verantwortlich: string;
}

export class BrowserVertragFehler extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrowserVertragFehler";
  }
}

const ORIGIN = /^https:\/\/[a-z0-9.-]+(?::\d{1,5})?$/;
const KENNUNGSATTRIBUT = /^data-[a-z0-9-]{1,40}$/;

function pruefeFormular(p: BrowserSeitenprofil, f: BrowserFormularProfil): void {
  if (new Set(f.felder).size !== f.felder.length) {
    throw new BrowserVertragFehler(`Profil ${p.id}: Feld doppelt in „${f.name}".`);
  }
  if (f.kennfeld !== null && !f.felder.includes(f.kennfeld)) {
    throw new BrowserVertragFehler(`Profil ${p.id}: Kennfeld fehlt in „${f.name}".`);
  }
  const knoepfe = new Map<string, BrowserHandlungsArt>();
  for (const h of f.handlungen) {
    const v = BROWSER_HANDLUNGSVERTRAG[h.art];
    if (v.knopf !== (h.knopf !== null)) {
      throw new BrowserVertragFehler(`Profil ${p.id}: Knopfangabe passt nicht zu „${h.art}".`);
    }
    if (h.knopf !== null) {
      // Ein Knopf ist genau eine Handlung — „Speichern" kann nicht zugleich „Senden" sein.
      const frueher = knoepfe.get(h.knopf);
      if (frueher !== undefined) {
        throw new BrowserVertragFehler(`Profil ${p.id}: Knopf „${h.knopf}" ist schon ${frueher}.`);
      }
      knoepfe.set(h.knopf, h.art);
    }
  }
  const arten = new Set(f.handlungen.map((h) => h.art));
  if (!arten.has("lesen")) {
    throw new BrowserVertragFehler(`Profil ${p.id}: „${f.name}" ohne Lesen.`);
  }
  if (arten.has("entwurf_speichern") && (f.kennfeld === null || p.entwurfsliste === null)) {
    // Ohne Liste und Kennfeld liest niemand nach, ob gespeichert wurde.
    throw new BrowserVertragFehler(`Profil ${p.id}: Speichern ohne Nachlesen in „${f.name}".`);
  }
  if (arten.has("entwurf_loeschen") && p.entwurfsliste === null) {
    throw new BrowserVertragFehler(`Profil ${p.id}: Löschen ohne Entwurfsliste.`);
  }
}

/** Weist jedes Profil ab, das mehr verspricht, als das Register trägt. */
export function pruefeSeitenprofil(p: BrowserSeitenprofil): void {
  if (!ORIGIN.test(p.origin)) {
    throw new BrowserVertragFehler(`Profil ${p.id}: nur https-Herkunft ohne Pfad.`);
  }
  if (!p.pfad.startsWith("/")) {
    throw new BrowserVertragFehler(`Profil ${p.id}: der Pfad beginnt mit „/".`);
  }
  if (p.entwurfsliste && !KENNUNGSATTRIBUT.test(p.entwurfsliste.kennung)) {
    throw new BrowserVertragFehler(`Profil ${p.id}: die Entwurfskennung ist ein data-Attribut.`);
  }
  const namen = new Set<string>();
  for (const f of p.formulare) {
    if (namen.has(f.name)) {
      throw new BrowserVertragFehler(`Profil ${p.id}: Formular „${f.name}" doppelt.`);
    }
    namen.add(f.name);
    pruefeFormular(p, f);
  }
}

export class BrowserFaehigkeitsregister {
  private readonly profile: readonly BrowserSeitenprofil[];

  constructor(profile: readonly BrowserSeitenprofil[]) {
    for (const p of profile) {
      pruefeSeitenprofil(p);
    }
    this.profile = profile;
  }

  /** Das Profil genau dieser Seite — oder `null`: dann unterstützt Klara sie nicht. */
  profilFuer(origin: string, pfad: string): BrowserSeitenprofil | null {
    return this.profile.find((p) => p.origin === origin && p.pfad === pfad) ?? null;
  }

  /** Die tatsächlich unterstützten Handlungen eines Formulars, je mit ihrem Vertrag. */
  handlungen(origin: string, pfad: string, formular: string): readonly BrowserHandlungsvertrag[] {
    const f = this.profilFuer(origin, pfad)?.formulare.find((x) => x.name === formular);
    return (f?.handlungen ?? []).map((h) => BROWSER_HANDLUNGSVERTRAG[h.art]);
  }
}

// ------------------------------------------------------------------------------------------------
// DIE MANUELLE ÜBERGABE
// ------------------------------------------------------------------------------------------------

export type BrowserUebergabeGrund =
  | "nicht_unterstuetzt"
  | "captcha"
  | "mfa"
  | "anmeldung"
  | "gesperrte_handlung"
  | "pruefen";

export interface BrowserUebergabe {
  readonly grund: BrowserUebergabeGrund;
  /** Der konkrete nächste Schritt für die Person. */
  readonly schritt: string;
}

/** Die manuelle Übergabe mit ihrem konkreten nächsten Schritt (auch für den Produktweg). */
export function uebergabe(
  grund: BrowserUebergabeGrund,
  ort: string,
  was: string,
): BrowserUebergabe {
  const schritt: Record<BrowserUebergabeGrund, string> = {
    nicht_unterstuetzt: `Klara unterstützt ${ort} nicht. Trage ${was} bitte selbst ein; Klara hat dort nichts verändert.`,
    captcha: `${ort} verlangt eine Sicherheitsprüfung (CAPTCHA). Löse sie selbst und beauftrage Klara danach erneut; bis dahin hat Klara nichts eingetragen.`,
    mfa: `${ort} verlangt einen Bestätigungscode (MFA). Gib ihn selbst ein und beauftrage Klara danach erneut; Klara liest und füllt keine Codes.`,
    anmeldung: `${ort} verlangt eine Anmeldung. Melde dich selbst an und beauftrage Klara danach erneut; Klara füllt keine Kennwörter.`,
    gesperrte_handlung: `${was} ist für Klara auf ${ort} nicht freigegeben. Löse es selbst aus, wenn du es willst.`,
    pruefen: `Ob ${was} auf ${ort} gewirkt hat, ist unklar. Prüfe es auf der Seite selbst; Klara wiederholt es nicht.`,
  };
  return { grund, schritt: schritt[grund] };
}

// ------------------------------------------------------------------------------------------------
// DER AUFTRAG
// ------------------------------------------------------------------------------------------------

export interface BrowserZiel {
  readonly tabId: number;
  readonly origin: string;
  readonly pfad: string;
  readonly formular: string;
}

export interface BrowserAuftragEingabe {
  readonly quelle: KlaraAuftragsQuelle;
  /** Der Auftrag in den Worten der Person (getippt oder gesprochen und korrigiert). */
  readonly wortlaut: string;
  readonly mandant: string;
  readonly nutzer: string;
  readonly sitzung: string;
  readonly host: { readonly browser: string; readonly version: string };
  readonly ziel: BrowserZiel;
  readonly felder: readonly { readonly label: string; readonly wert: string }[];
  readonly speichern: boolean;
  /** Nur wenn die Person das endgültige Auslösen ausdrücklich beauftragt hat: dessen Knopf. */
  readonly ausloesen: string | null;
}

export interface BrowserAuftrag extends BrowserAuftragEingabe {
  readonly id: string;
  readonly profil: { readonly id: string; readonly fassung: string };
  readonly erlaubt: readonly BrowserHandlungsArt[];
  readonly angelegtAm: string;
}

export const BROWSER_MAX_FELDER = 20;
export const BROWSER_MAX_WERT = 4000;

function eingefroren<T>(wert: T): T {
  if (typeof wert === "object" && wert !== null) {
    for (const v of Object.values(wert)) {
      eingefroren(v);
    }
    Object.freeze(wert);
  }
  return wert;
}

export type BrowserAuftragsAnlage =
  | { readonly ok: true; readonly auftrag: BrowserAuftrag }
  | { readonly ok: false; readonly uebergabe: BrowserUebergabe }
  | { readonly ok: false; readonly fehler: string };

function gesperrt(ort: string, was: string): BrowserAuftragsAnlage {
  return { ok: false, uebergabe: uebergabe("gesperrte_handlung", ort, was) };
}

/** Legt einen Auftrag an — nur aus der Eingabe der Person, nie aus Seiteninhalt. */
export function neuerBrowserAuftrag(
  register: BrowserFaehigkeitsregister,
  e: BrowserAuftragEingabe,
  optionen: { readonly jetzt?: Date; readonly id?: string } = {},
): BrowserAuftragsAnlage {
  if (!(KLARA_QUELLEN_DES_AUFTRAGS as readonly string[]).includes(e.quelle)) {
    return { ok: false, fehler: "Ein Auftrag ist getippt oder gesprochen." };
  }
  if (!e.wortlaut.trim() || !e.mandant || !e.nutzer || !e.sitzung) {
    return { ok: false, fehler: "Wortlaut, Mandant, Nutzer und Sitzung sind nötig." };
  }
  if (
    e.felder.length > BROWSER_MAX_FELDER ||
    e.felder.some((f) => f.wert.length > BROWSER_MAX_WERT)
  ) {
    return { ok: false, fehler: "Zu viele oder zu lange Werte." };
  }
  if (new Set(e.felder.map((f) => f.label)).size !== e.felder.length) {
    return { ok: false, fehler: "Jedes Feld nur einmal." };
  }
  const ort = `${e.ziel.origin}${e.ziel.pfad}`;
  const profil = register.profilFuer(e.ziel.origin, e.ziel.pfad);
  const formular = profil?.formulare.find((f) => f.name === e.ziel.formular);
  if (!profil || !formular) {
    const was = e.felder.map((f) => `„${f.label}"`).join(", ") || "den Entwurf";
    return { ok: false, uebergabe: uebergabe("nicht_unterstuetzt", ort, was) };
  }
  const arten = new Set(formular.handlungen.map((h) => h.art));
  const fremd = e.felder.find((f) => !formular.felder.includes(f.label));
  if (fremd) {
    return gesperrt(ort, `Das Feld „${fremd.label}"`);
  }
  if (e.felder.length > 0 && !arten.has("entwurf_fuellen")) {
    return gesperrt(ort, "Ausfüllen");
  }
  if (e.speichern && !arten.has("entwurf_speichern")) {
    return gesperrt(ort, "Speichern");
  }
  const knopf = e.ausloesen;
  if (
    knopf !== null &&
    !formular.handlungen.some((h) => h.art === "ausloesen" && h.knopf === knopf)
  ) {
    return gesperrt(ort, `„${knopf}"`);
  }
  const erlaubt: BrowserHandlungsArt[] = ["lesen"];
  if (e.felder.length > 0) {
    erlaubt.push("entwurf_fuellen");
  }
  if (e.speichern) {
    erlaubt.push("entwurf_speichern");
    if (arten.has("entwurf_loeschen")) {
      erlaubt.push("entwurf_loeschen");
    }
  }
  if (knopf !== null) {
    erlaubt.push("ausloesen");
  }
  const auftrag: BrowserAuftrag = eingefroren({
    ...structuredClone(e),
    id: optionen.id ?? randomUUID(),
    profil: { id: profil.id, fassung: profil.fassung },
    erlaubt,
    angelegtAm: (optionen.jetzt ?? new Date()).toISOString(),
  });
  return { ok: true, auftrag };
}

// ------------------------------------------------------------------------------------------------
// DIE SEITE — was der Seitenausführer der Erweiterung liefert
// ------------------------------------------------------------------------------------------------

export type SeitenHindernis = "captcha" | "mfa" | "anmeldung";

export interface SeitenFeld {
  readonly label: string;
  readonly typ: string;
  /** Leer bei gesperrten Feldern (Kennwort, Einmalcode, Datei). */
  readonly wert: string;
  readonly gesperrt: boolean;
}

export interface SeitenFormular {
  readonly name: string;
  /** Fingerabdruck des AUFBAUS (Beschriftungen, Typen, Namen, Knöpfe) — ohne Werte. */
  readonly fingerabdruck: string;
  readonly felder: readonly SeitenFeld[];
  readonly knoepfe: readonly string[];
}

export interface SeitenEntwurf {
  readonly id: string;
  readonly text: string;
}

export interface SeitenLage {
  readonly tabId: number;
  readonly origin: string;
  readonly pfad: string;
  readonly hindernisse: readonly SeitenHindernis[];
  /** Wie viele Formulare diesen Namen tragen; gebunden wird nur bei genau einem. */
  readonly formularTreffer: number;
  readonly formular: SeitenFormular | null;
  readonly entwuerfe: readonly SeitenEntwurf[];
}

export type SeitenFehler =
  | "ziel_geaendert"
  | "feld_fehlt"
  | "feld_mehrdeutig"
  | "feld_gesperrt"
  | "knopf_fehlt"
  | "eintrag_fehlt"
  /** Ein erwarteter Feldwert stand unmittelbar vor der Wirkung nicht mehr auf der Seite. */
  | "wert_geaendert"
  /** Die Übertragung hat belastbar NICHTS auf der Seite ausgeführt (z. B. Skript nie injiziert). */
  | "nicht_ausgefuehrt"
  /** Ausgang unbekannt: die Wirkung kann eingetreten sein. */
  | "zeitueberschreitung"
  | "verbindung";

export type SeitenAntwort<T> =
  | { readonly ok: true; readonly wert: T }
  | { readonly ok: false; readonly grund: SeitenFehler };

export interface BrowserFeldwert {
  readonly label: string;
  readonly wert: string;
}

/** Die Brücke zum Seitenausführer. Jede Antwort ist unvertrauter Seiteninhalt. */
export interface BrowserSeitenadapter {
  /** Fassung des Seitenausführers, z. B. `aktion.js@1.0.0`. */
  readonly fassung: string;
  /** `null`: der Tab ist nicht mehr da. */
  lage(
    tabId: number,
    formular: string,
    liste: BrowserEntwurfsliste | null,
  ): Promise<SeitenLage | null>;
  /** `erwartet`: nur eintragen, wenn das Feld unmittelbar vorher genau diesen Wert zeigt. */
  fuelle(
    tabId: number,
    a: { formular: string; fingerabdruck: string; label: string; wert: string; erwartet?: string },
  ): Promise<SeitenAntwort<{ wert: string }>>;
  /** `werte`: nur klicken, wenn diese Felder unmittelbar vorher genau diese Werte zeigen. */
  klicke(
    tabId: number,
    a: {
      formular: string;
      fingerabdruck: string;
      knopf: string;
      werte?: readonly BrowserFeldwert[];
    },
  ): Promise<SeitenAntwort<null>>;
  loesche(
    tabId: number,
    a: { liste: BrowserEntwurfsliste; id: string; knopf: string },
  ): Promise<SeitenAntwort<null>>;
}

// ------------------------------------------------------------------------------------------------
// DIE AUSSENAKTIONSBESTÄTIGUNG
// ------------------------------------------------------------------------------------------------

export interface BrowserAussenbestaetigung {
  readonly auftragId: string;
  readonly knopf: string;
  /** `aussenFingerabdruck` zu genau diesem Auftrag, Formularaufbau und diesen Werten. */
  readonly fingerabdruck: string;
  readonly nutzer: string;
  readonly bestaetigtAm: string;
}

export function aussenFingerabdruck(a: BrowserAuftrag, formularFingerabdruck: string): string {
  const teile = [
    a.id,
    a.mandant,
    a.nutzer,
    a.ziel.tabId,
    a.ziel.origin,
    a.ziel.pfad,
    a.ziel.formular,
    formularFingerabdruck,
    a.ausloesen,
    a.felder,
  ];
  return createHash("sha256").update(JSON.stringify(teile)).digest("hex");
}

// ------------------------------------------------------------------------------------------------
// DIE AUSFÜHRUNG
// ------------------------------------------------------------------------------------------------

export type BrowserSchrittArt = "lesen" | "fuellen" | "speichern" | "nachlesen" | "ausloesen";
export type BrowserSchrittStand =
  | "offen"
  | "erfolgt"
  | "unklar"
  | "fehlgeschlagen"
  | "uebersprungen"
  | "zurueckgenommen";

export interface BrowserSchritt {
  readonly nr: number;
  /** Dieselbe Kennungsform wie die Schritte des Aktionskerns. */
  readonly aktionskennung: string;
  readonly art: BrowserSchrittArt;
  readonly feld: string | null;
  readonly knopf: string | null;
  readonly stand: BrowserSchrittStand;
  /** Was nachgelesen bzw. abgeglichen wurde — Kennungen und Zustände, keine Seiteninhalte. */
  readonly beleg: string | null;
  readonly am: string | null;
}

export type BrowserLaufStand =
  | "bereit"
  | "laeuft"
  | "pausiert"
  | "abgebrochen"
  | "klaerung"
  | "uebergabe"
  | "bestaetigung_noetig"
  | "unklar"
  | "gestoppt_recht"
  | "fertig";

/** Nach diesen Ständen läuft kein Schritt mehr; ein neuer Versuch ist ein neuer Auftrag. */
const ENDSTAENDE: readonly BrowserLaufStand[] = [
  "abgebrochen",
  "fertig",
  "gestoppt_recht",
  "uebergabe",
];

export type BrowserEreignis =
  | "begonnen"
  | "gelesen"
  | "eingetragen"
  | "gespeichert"
  | "nachgelesen"
  | "abgeglichen"
  | "ausgeloest"
  | "ziel_aktualisiert"
  | "klaerung"
  | "uebergabe"
  | "bestaetigung_noetig"
  | "bestaetigt"
  | "unklar"
  | "pausiert"
  | "fortgesetzt"
  | "abgebrochen"
  | "recht_entzogen"
  | "zurueckgenommen";

export interface BrowserVerlaufseintrag {
  readonly ereignis: BrowserEreignis;
  readonly nr: number | null;
  readonly am: string;
}

export interface BrowserInhaltBefund {
  readonly herkunft: "seite" | "tooltip" | "download";
  readonly zeichen: number;
  /** Nur ein Hinweis. Behandelt wird JEDER Inhalt als Daten, ob erkannt oder nicht. */
  readonly fremdeAnweisung: boolean;
}

export interface BrowserErgebnis {
  readonly entwurfId: string;
  readonly nachgelesen: boolean;
  readonly zurueckgenommen: boolean;
}

export interface BrowserAnsicht {
  readonly auftragId: string;
  readonly quelle: KlaraAuftragsQuelle;
  readonly stand: BrowserLaufStand;
  /** Nur bei bestätigtem Effekt: alle Schritte erfolgt, Gespeichertes nachgelesen. */
  readonly erfolg: boolean;
  readonly text: string;
  readonly ziel: BrowserZiel;
  readonly host: { readonly browser: string; readonly version: string; readonly adapter: string };
  readonly schritte: readonly BrowserSchritt[];
  readonly ergebnis: BrowserErgebnis | null;
  readonly klaerung: string | null;
  readonly uebergabe: BrowserUebergabe | null;
  readonly bestaetigung: { readonly knopf: string; readonly bestaetigtAm: string } | null;
  readonly inhalte: readonly BrowserInhaltBefund[];
  readonly verlauf: readonly BrowserVerlaufseintrag[];
}

export type BrowserRuecknahme =
  | { readonly art: "zurueckgenommen"; readonly beleg: string }
  | { readonly art: "nicht_ruecknehmbar"; readonly text: string }
  | { readonly art: "ziel_fehlt" | "unklar" | "nichts" | "laeuft"; readonly text: string };

export interface BrowserAusfuehrungDeps {
  readonly adapter: BrowserSeitenadapter;
  readonly register: BrowserFaehigkeitsregister;
  /** Aktuelle Nutzer-/Website-/Mandantenrechte — vor JEDEM Schritt gefragt. */
  readonly rechte: (auftrag: BrowserAuftrag, schritt: BrowserSchrittArt) => Promise<boolean>;
  readonly jetzt?: () => Date;
  readonly warte?: (ms: number) => Promise<void>;
  /** Wie oft das Nachlesen die Seite liest, bevor es „unklar" meldet. */
  readonly nachleseVersuche?: number;
}

interface Bindung {
  readonly tabId: number;
  readonly origin: string;
  readonly pfad: string;
  readonly formular: string;
  fingerabdruck: string;
}

type Schritt = { -readonly [K in keyof BrowserSchritt]: BrowserSchritt[K] };
type Folge = "weiter" | "nochmal" | "von_vorn" | "halt";

/** Wie oft ein Lauf nach einer Zielaktualisierung neu ansetzen darf, bevor er klärt. */
const MAX_NEUBINDUNGEN = 3;

export class BrowserAusfuehrung {
  private stand: BrowserLaufStand = "bereit";
  private readonly schritte: Schritt[];
  private bindung: Bindung | null = null;
  private readonly vorherWerte = new Map<string, string>();
  private vorherEntwuerfe: readonly string[] = [];
  private ergebnis: BrowserErgebnis | null = null;
  private klaerung: string | null = null;
  private uebergabeGrund: BrowserUebergabe | null = null;
  private bestaetigung: BrowserAussenbestaetigung | null = null;
  private angewandt: BrowserAussenbestaetigung | null = null;
  private halt: "pausiert" | "abgebrochen" | null = null;
  /** Von aussen gemeldeter Rechteentzug (Widerruf der Seitenfreigabe, Abmelden): endgültig. */
  private entzogen = false;
  private laufend: Promise<BrowserAnsicht> | null = null;
  private ruecknahmeLaeuft = false;
  private readonly inhalte: BrowserInhaltBefund[] = [];
  private readonly verlauf: BrowserVerlaufseintrag[] = [];
  private readonly profil: BrowserSeitenprofil;
  private readonly formular: BrowserFormularProfil;

  constructor(
    readonly auftrag: BrowserAuftrag,
    private readonly deps: BrowserAusfuehrungDeps,
  ) {
    const profil = deps.register.profilFuer(auftrag.ziel.origin, auftrag.ziel.pfad);
    const formular = profil?.formulare.find((f) => f.name === auftrag.ziel.formular);
    if (!profil || !formular || profil.fassung !== auftrag.profil.fassung) {
      throw new BrowserVertragFehler("Das Seitenprofil des Auftrags gilt nicht mehr.");
    }
    this.profil = profil;
    this.formular = formular;
    const plan: Pick<Schritt, "art" | "feld" | "knopf">[] = [
      { art: "lesen", feld: null, knopf: null },
      ...auftrag.felder.map((f) => ({ art: "fuellen" as const, feld: f.label, knopf: null })),
    ];
    if (auftrag.speichern) {
      plan.push({ art: "speichern", feld: null, knopf: this.knopf("entwurf_speichern") });
      plan.push({ art: "nachlesen", feld: null, knopf: null });
    }
    if (auftrag.ausloesen !== null) {
      plan.push({ art: "ausloesen", feld: null, knopf: auftrag.ausloesen });
    }
    this.schritte = plan.map((p, i) => ({
      ...p,
      nr: i + 1,
      aktionskennung: aktionskennung(auftrag.id, i + 1),
      stand: "offen",
      beleg: null,
      am: null,
    }));
  }

  private knopf(art: BrowserHandlungsArt): string | null {
    return this.formular.handlungen.find((h) => h.art === art)?.knopf ?? null;
  }

  private jetzt(): string {
    return (this.deps.jetzt?.() ?? new Date()).toISOString();
  }

  private merke(ereignis: BrowserEreignis, nr: number | null = null): void {
    this.verlauf.push({ ereignis, nr, am: this.jetzt() });
  }

  private setze(s: Schritt, stand: BrowserSchrittStand, beleg: string | null): void {
    s.stand = stand;
    s.beleg = beleg;
    s.am = this.jetzt();
  }

  private wert(label: string): string {
    return this.auftrag.felder.find((f) => f.label === label)?.wert ?? "";
  }

  private ort(): string {
    return `${this.auftrag.ziel.origin}${this.auftrag.ziel.pfad}`;
  }

  private leseLage(): Promise<SeitenLage | null> {
    const z = this.auftrag.ziel;
    return this.deps.adapter.lage(z.tabId, z.formular, this.profil.entwurfsliste);
  }

  private fingerabdruck(): string {
    return this.bindung?.fingerabdruck ?? "";
  }

  // ---------------------------------------------------------------- Steuerung durch die Person

  /** Ausführen und Fortsetzen sind derselbe Weg; ein zweiter Klick erhält denselben Lauf. */
  ausfuehren(): Promise<BrowserAnsicht> {
    if (!this.laufend) {
      this.laufend = this.lauf().finally(() => {
        this.laufend = null;
      });
    }
    return this.laufend;
  }

  fortsetzen(): Promise<BrowserAnsicht> {
    return this.ausfuehren();
  }

  /** Auch im ersten, noch synchronen Abschnitt eines Laufs gilt er als laufend. */
  private laeuftGerade(): boolean {
    return this.laufend !== null || this.stand === "laeuft";
  }

  /** Hält vor dem nächsten Schritt an. Was schon geschehen ist, bleibt stehen und sichtbar. */
  pausiere(): void {
    if (this.laeuftGerade()) {
      this.halt ??= "pausiert";
    } else if (!ENDSTAENDE.includes(this.stand)) {
      this.stand = "pausiert";
      this.merke("pausiert");
    }
  }

  /** Beendet den Auftrag: kein weiterer Schritt; Gespeichertes wird nicht still zurückgenommen. */
  brecheAb(): void {
    if (this.laeuftGerade()) {
      this.halt = "abgebrochen";
    } else if (this.stand !== "fertig" && this.stand !== "abgebrochen") {
      this.beende("abgebrochen");
    }
  }

  /**
   * Das Recht ist entzogen (die Person hat die Freigabe der Seite widerrufen oder sich abgemeldet).
   * Kein weiterer Schritt; ein gerade laufender Schritt meldet noch sein tatsächliches Ergebnis,
   * danach endet der Lauf mit `gestoppt_recht`. Die Rechteprüfung vor jedem Schritt bleibt davon
   * unberührt — dies macht den Entzug nur sofort wirksam, statt erst beim nächsten Schritt.
   */
  rechtEntzogen(): void {
    this.entzogen = true;
    if (!this.laeuftGerade() && !ENDSTAENDE.includes(this.stand)) {
      this.beende("gestoppt_recht");
    }
  }

  private beende(stand: "abgebrochen" | "gestoppt_recht"): void {
    for (const s of this.schritte) {
      if (s.stand === "offen") {
        this.setze(s, "uebersprungen", null);
      }
    }
    this.stand = stand;
    this.merke(stand === "abgebrochen" ? "abgebrochen" : "recht_entzogen");
  }

  /** Seiteninhalt, Tooltip oder Download: Daten, nie Auftrag. Behalten wird nur der Befund. */
  inhaltAufnehmen(herkunft: BrowserInhaltBefund["herkunft"], text: string): BrowserInhaltBefund {
    const befund: BrowserInhaltBefund = {
      herkunft,
      zeichen: text.length,
      fremdeAnweisung: enthaeltFremdeAnweisung(text),
    };
    this.inhalte.push(befund);
    return befund;
  }

  /**
   * Was die vorhandene Bestätigung zeigen muss — genau eine Wirkung, an diese Werte gebunden. Die
   * Werte sind die des Auftrags (die Eingabe der Person), nicht was die Seite gerade zeigt.
   */
  bestaetigungsBedarf(): {
    knopf: string;
    fingerabdruck: string;
    text: string;
    werte: readonly BrowserFeldwert[];
  } | null {
    const knopf = this.auftrag.ausloesen;
    if (this.stand !== "bestaetigung_noetig" || !this.bindung || knopf === null) {
      return null;
    }
    return {
      knopf,
      fingerabdruck: aussenFingerabdruck(this.auftrag, this.bindung.fingerabdruck),
      text: `„${knopf}" auf ${this.ort()} wirkt nach außen und ist nicht rücknehmbar.`,
      werte: this.auftrag.felder.map((f) => ({ label: f.label, wert: f.wert })),
    };
  }

  /** Nimmt eine Außenaktionsbestätigung an — nur, wenn sie genau diesen Auftrag meint. */
  bestaetige(b: BrowserAussenbestaetigung): boolean {
    const bedarf = this.bestaetigungsBedarf();
    if (
      !bedarf ||
      b.auftragId !== this.auftrag.id ||
      b.nutzer !== this.auftrag.nutzer ||
      b.knopf !== bedarf.knopf ||
      b.fingerabdruck !== bedarf.fingerabdruck
    ) {
      return false;
    }
    this.bestaetigung = b;
    this.merke("bestaetigt");
    return true;
  }

  /**
   * Ein ausdrücklicher Einzelwunsch „löse X aus". Er wirkt nur, wenn genau dieses Auslösen im
   * Auftrag steht; dann läuft er über den gebundenen Weg samt Bestätigung. Sonst: Übergabe.
   */
  loeseAus(knopf: string): Promise<BrowserAnsicht> {
    if (!this.auftrag.erlaubt.includes("ausloesen") || this.auftrag.ausloesen !== knopf) {
      this.uebergabeGrund = uebergabe("gesperrte_handlung", this.ort(), `„${knopf}"`);
      this.merke("uebergabe");
      return Promise.resolve(this.ansicht());
    }
    return this.ausfuehren();
  }

  // ---------------------------------------------------------------- der Lauf

  private async lauf(): Promise<BrowserAnsicht> {
    if (ENDSTAENDE.includes(this.stand) || this.ruecknahmeLaeuft) {
      return this.ansicht();
    }
    const vorher = this.stand;
    this.stand = "laeuft";
    this.klaerung = null;
    this.halt = null;
    this.merke(vorher === "bereit" ? "begonnen" : "fortgesetzt");
    let neuansaetze = 0;
    for (let i = 0; i < this.schritte.length; i++) {
      const s = this.schritte[i] as Schritt;
      if (s.stand === "erfolgt" || s.stand === "zurueckgenommen") {
        continue;
      }
      if (this.halt === "abgebrochen") {
        this.beende("abgebrochen");
        return this.ansicht();
      }
      if (this.halt === "pausiert") {
        this.stand = "pausiert";
        this.merke("pausiert", s.nr);
        return this.ansicht();
      }
      const recht =
        !this.entzogen && (await this.deps.rechte(this.auftrag, s.art).catch(() => false));
      if (!recht || this.entzogen) {
        // Nach dem Entzug (oder ohne Antwort der Rechteprüfung) liest Klara nichts mehr von der Seite.
        this.beende("gestoppt_recht");
        return this.ansicht();
      }
      let lage: SeitenLage | null;
      try {
        lage = await this.leseLage();
      } catch {
        // Das LESEN vor dem Schritt kam nicht zurück. Lesen wirkt nicht — der Schritt selbst hat
        // noch nicht begonnen. Er bleibt offen (kein „unklar", das ein späteres Speichern für
        // immer sperren würde); Fortsetzen prüft Recht und Ziel neu. Ist inzwischen das Recht weg
        // (etwa abgemeldet, darum kam nichts zurück), heisst der Stand ehrlich so.
        const nochRecht =
          !this.entzogen && (await this.deps.rechte(this.auftrag, s.art).catch(() => false));
        if (!nochRecht) {
          this.beende("gestoppt_recht");
          return this.ansicht();
        }
        this.halteAn(
          "Die Seite hat nicht geantwortet. Für diesen Schritt wurde nichts ausgeführt; setze fort, sobald sie wieder offen ist.",
          s.nr,
        );
        return this.ansicht();
      }
      let folge: Folge;
      try {
        const pruefung = this.pruefeLage(lage, s);
        folge = pruefung === "weiter" ? await this.schritt(s, lage as SeitenLage) : pruefung;
      } catch {
        // Die Verbindung zur Seite brach WÄHREND des Schritts ab: die Wirkung ist unbekannt und wird
        // vor jeder Wiederholung abgeglichen (ein Auslösen wird nie wiederholt).
        folge = this.unklar(s, "verbindung");
      }
      if (this.entzogen) {
        // Während des Schritts entzogen: sein tatsächliches Ergebnis steht (oben), weiter geht nichts.
        if (
          this.stand === "laeuft" ||
          this.stand === "klaerung" ||
          this.stand === "bestaetigung_noetig"
        ) {
          this.beende("gestoppt_recht");
        }
        return this.ansicht();
      }
      if (folge === "weiter") {
        continue;
      }
      if (folge === "halt") {
        return this.ansicht();
      }
      if (neuansaetze >= MAX_NEUBINDUNGEN) {
        this.halteAn(`Das Formular „${this.auftrag.ziel.formular}" ändert sich laufend.`, s.nr);
        return this.ansicht();
      }
      neuansaetze++;
      // „nochmal": derselbe Schritt mit frisch geprüftem Ziel; „von_vorn": offen gewordene
      // frühere Schritte zuerst nachholen.
      i = folge === "von_vorn" ? -1 : i - 1;
    }
    this.stand = "fertig";
    return this.ansicht();
  }

  private halteAn(klaerung: string, nr: number): void {
    this.stand = "klaerung";
    this.klaerung = klaerung;
    this.merke("klaerung", nr);
  }

  private gibAb(u: BrowserUebergabe, nr: number | null): void {
    this.stand = "uebergabe";
    this.uebergabeGrund = u;
    for (const s of this.schritte) {
      if (s.stand === "offen") {
        this.setze(s, "uebersprungen", null);
      }
    }
    this.merke("uebergabe", nr);
  }

  private unklar(s: Schritt, beleg: string, klaerung: string | null = null): "halt" {
    this.setze(s, "unklar", beleg);
    this.stand = "unklar";
    this.klaerung = klaerung;
    this.merke("unklar", s.nr);
    return "halt";
  }

  /** Tab, Seite, Hindernisse und Formular — vor jedem Schritt. */
  private pruefeLage(lage: SeitenLage | null, s: Schritt): Folge {
    const z = this.auftrag.ziel;
    if (!lage || lage.tabId !== z.tabId) {
      this.halteAn("Der Tab des Auftrags ist nicht mehr offen. Nichts weiter geändert.", s.nr);
      return "halt";
    }
    if (lage.origin !== z.origin || lage.pfad !== z.pfad) {
      this.halteAn(
        `Im Tab des Auftrags ist nicht mehr ${this.ort()} geöffnet. Klara schreibt nicht in eine andere Seite; öffne sie wieder oder gib einen neuen Auftrag.`,
        s.nr,
      );
      return "halt";
    }
    const hindernis = lage.hindernisse[0];
    if (hindernis) {
      this.gibAb(uebergabe(hindernis, this.ort(), ""), s.nr);
      return "halt";
    }
    if (lage.formularTreffer !== 1 || !lage.formular) {
      this.halteAn(
        lage.formularTreffer === 0
          ? `Das Formular „${z.formular}" ist auf der Seite nicht zu finden.`
          : `Auf der Seite stehen ${lage.formularTreffer} Formulare „${z.formular}". Welches ist gemeint?`,
        s.nr,
      );
      return "halt";
    }
    if (this.bindung && lage.formular.fingerabdruck !== this.bindung.fingerabdruck) {
      return this.aktualisiereZiel(lage.formular, s);
    }
    return "weiter";
  }

  /**
   * Der Aufbau hat sich geändert. Neu gebunden wird nur, wenn jedes beauftragte Feld genau einmal
   * unter seiner Beschriftung steht und die benötigten Knöpfe eindeutig da sind. Eingetragene
   * Werte, die dabei verloren gingen, werden wieder offen — nie in ein anderes Feld umgeleitet.
   */
  private aktualisiereZiel(f: SeitenFormular, s: Schritt): Folge {
    const zaehle = (label: string) => f.felder.filter((x) => x.label === label).length;
    const problem = this.auftrag.felder.find((x) => zaehle(x.label) !== 1);
    if (problem) {
      const n = zaehle(problem.label);
      this.halteAn(
        n === 0
          ? `Das Feld „${problem.label}" gibt es im geänderten Formular nicht mehr. Klara schreibt nicht in ein ähnliches Feld — welches ist gemeint?`
          : `Im geänderten Formular gibt es „${problem.label}" ${n}-mal. Welches ist gemeint?`,
        s.nr,
      );
      return "halt";
    }
    const knoepfe = this.schritte.map((x) => x.knopf).filter((k): k is string => k !== null);
    const fehlt = knoepfe.find((k) => f.knoepfe.filter((x) => x === k).length !== 1);
    if (fehlt !== undefined) {
      this.halteAn(`Den Knopf „${fehlt}" gibt es im geänderten Formular nicht eindeutig.`, s.nr);
      return "halt";
    }
    let offenGeworden = false;
    for (const x of this.schritte) {
      if (x.art === "fuellen" && x.stand === "erfolgt" && x.feld !== null) {
        const jetzt = f.felder.find((y) => y.label === x.feld)?.wert;
        if (jetzt !== this.wert(x.feld)) {
          this.setze(x, "offen", "nach Neuaufbau wieder offen");
          offenGeworden = true;
        }
      }
    }
    if (this.bindung) {
      this.bindung.fingerabdruck = f.fingerabdruck;
    }
    this.merke("ziel_aktualisiert", s.nr);
    return offenGeworden ? "von_vorn" : "weiter";
  }

  private schritt(s: Schritt, lage: SeitenLage): Promise<Folge> {
    switch (s.art) {
      case "lesen":
        return Promise.resolve(this.lesen(s, lage));
      case "fuellen":
        return this.fuellen(s, lage);
      case "speichern":
        return this.speichern(s);
      case "nachlesen":
        return this.nachlesen(s);
      case "ausloesen":
        return this.ausloesenSchritt(s, lage);
    }
  }

  private lesen(s: Schritt, lage: SeitenLage): Folge {
    const f = lage.formular as SeitenFormular;
    for (const x of this.auftrag.felder) {
      const feld = f.felder.filter((y) => y.label === x.label);
      if (feld.length !== 1) {
        this.halteAn(
          feld.length === 0
            ? `Das Feld „${x.label}" steht nicht im Formular „${f.name}". Klara schreibt nicht in ein ähnliches Feld.`
            : `Im Formular „${f.name}" gibt es „${x.label}" ${feld.length}-mal. Welches ist gemeint?`,
          s.nr,
        );
        return "halt";
      }
      if (feld[0]?.gesperrt) {
        this.gibAb(uebergabe("gesperrte_handlung", this.ort(), `Das Feld „${x.label}"`), s.nr);
        return "halt";
      }
      this.vorherWerte.set(x.label, feld[0]?.wert ?? "");
    }
    this.bindung = {
      tabId: lage.tabId,
      origin: lage.origin,
      pfad: lage.pfad,
      formular: f.name,
      fingerabdruck: f.fingerabdruck,
    };
    this.vorherEntwuerfe = lage.entwuerfe.map((e) => e.id);
    this.setze(s, "erfolgt", `Formular ${f.fingerabdruck}`);
    this.merke("gelesen", s.nr);
    return "weiter";
  }

  private seitenfehler(s: Schritt, grund: SeitenFehler): Folge {
    if (grund === "ziel_geaendert") {
      return "nochmal";
    }
    if (grund === "zeitueberschreitung" || grund === "verbindung") {
      return this.unklar(s, grund);
    }
    if (grund === "nicht_ausgefuehrt") {
      // Belastbar nichts geschehen: der Schritt bleibt offen und darf beim Fortsetzen laufen.
      this.setze(s, "offen", "nicht ausgeführt");
      this.halteAn("Die Seite war nicht erreichbar; nichts wurde ausgeführt.", s.nr);
      return "halt";
    }
    if (grund === "wert_geaendert") {
      this.halteAn(
        `Ein Feld zeigt auf der Seite nicht mehr den beauftragten Wert. Klara löst „${s.knopf ?? s.feld}" nicht aus und überschreibt nichts; prüfe das Formular.`,
        s.nr,
      );
      return "halt";
    }
    if (grund === "feld_gesperrt" || grund === "knopf_fehlt") {
      const was = `„${s.feld ?? s.knopf ?? ""}"`;
      this.gibAb(uebergabe("gesperrte_handlung", this.ort(), was), s.nr);
      return "halt";
    }
    this.halteAn(
      grund === "feld_mehrdeutig"
        ? `„${s.feld}" ist im Formular nicht eindeutig. Welches Feld ist gemeint?`
        : `„${s.feld ?? s.knopf}" ist im Formular nicht mehr zu finden.`,
      s.nr,
    );
    return "halt";
  }

  private async fuellen(s: Schritt, lage: SeitenLage): Promise<Folge> {
    const label = s.feld ?? "";
    const soll = this.wert(label);
    if (s.stand === "unklar") {
      // Abgleich vor der Wiederholung. Eintragen ist idempotent, nachgelesen wird trotzdem.
      if (lage.formular?.felder.find((f) => f.label === label)?.wert === soll) {
        this.setze(s, "erfolgt", "abgeglichen");
        this.merke("abgeglichen", s.nr);
        return "weiter";
      }
    }
    const antwort = await this.deps.adapter.fuelle(this.auftrag.ziel.tabId, {
      formular: this.auftrag.ziel.formular,
      fingerabdruck: this.fingerabdruck(),
      label,
      wert: soll,
    });
    if (!antwort.ok) {
      return this.seitenfehler(s, antwort.grund);
    }
    if (antwort.wert.wert !== soll) {
      this.setze(s, "fehlgeschlagen", "Die Seite zeigt einen anderen Wert.");
      this.halteAn(`„${label}" zeigt nach dem Eintragen nicht den beauftragten Wert.`, s.nr);
      return "halt";
    }
    this.setze(s, "erfolgt", "nachgelesen");
    this.merke("eingetragen", s.nr);
    return "weiter";
  }

  /** Eigene Entwürfe auf der Seite: vor dem Auftrag nicht da und mit dem Wert des Kennfelds. */
  private neueEigene(lage: SeitenLage): SeitenEntwurf[] {
    const kennfeld = this.formular.kennfeld;
    const kenn = kennfeld === null ? "" : this.wert(kennfeld);
    if (!kenn) {
      return [];
    }
    return lage.entwuerfe.filter(
      (e) => !this.vorherEntwuerfe.includes(e.id) && e.text.includes(kenn),
    );
  }

  /** Liest die Seite bis zu `nachleseVersuche`-mal; `null`, wenn sie nicht mehr offen ist. */
  private async leseNach(): Promise<SeitenEntwurf[] | null> {
    const versuche = this.deps.nachleseVersuche ?? 3;
    const warte = this.deps.warte ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
    for (let v = 0; v < versuche; v++) {
      if (v > 0) {
        await warte(200);
      }
      const lage = await this.leseLage();
      const z = this.auftrag.ziel;
      if (!lage || lage.origin !== z.origin || lage.pfad !== z.pfad) {
        return null;
      }
      const neu = this.neueEigene(lage);
      if (neu.length > 0) {
        return neu;
      }
    }
    return [];
  }

  private async speichern(s: Schritt): Promise<Folge> {
    if (s.stand === "unklar") {
      // Der Ausgang des letzten Speicherns ist unbekannt: erst an der Seite abgleichen.
      const neu = await this.leseNach();
      if (neu === null) {
        this.halteAn("Die Seite ist zum Abgleich nicht mehr offen.", s.nr);
        return "halt";
      }
      if (neu.length > 0) {
        this.setze(s, "erfolgt", "abgeglichen: gespeichert, ohne Wiederholung");
        this.merke("abgeglichen", s.nr);
        return "weiter";
      }
      // „Nicht sichtbar" ist kein Beleg für „nicht gespeichert": eine Speicherung kann verzögert
      // erscheinen. Ohne belastbare Nichtausführung wird NICHT erneut gespeichert.
      return this.unklar(
        s,
        "abgeglichen: noch nicht sichtbar",
        "Noch ist kein passender Entwurf zu sehen. Klara speichert nicht erneut, solange offen ist, ob die erste Speicherung gewirkt hat. Prüfe die Entwurfsliste oder setze später fort.",
      );
    }
    const antwort = await this.deps.adapter.klicke(this.auftrag.ziel.tabId, {
      formular: this.auftrag.ziel.formular,
      fingerabdruck: this.fingerabdruck(),
      knopf: s.knopf ?? "",
    });
    if (!antwort.ok) {
      return this.seitenfehler(s, antwort.grund);
    }
    this.setze(s, "erfolgt", "ausgelöst");
    this.merke("gespeichert", s.nr);
    return "weiter";
  }

  private async nachlesen(s: Schritt): Promise<Folge> {
    const neu = await this.leseNach();
    const eintrag = neu?.[0];
    if (!neu || neu.length !== 1 || !eintrag) {
      return this.unklar(
        s,
        neu === null ? "Seite nicht mehr offen" : `${neu.length} Treffer`,
        neu && neu.length > 1
          ? `Auf der Seite stehen ${neu.length} neue passende Entwürfe. Prüfe sie selbst.`
          : "Speichern wurde ausgelöst, aber der Entwurf ist auf der Seite nicht zu sehen.",
      );
    }
    this.ergebnis = { entwurfId: eintrag.id, nachgelesen: true, zurueckgenommen: false };
    this.setze(s, "erfolgt", `Entwurf ${eintrag.id}`);
    this.merke("nachgelesen", s.nr);
    return "weiter";
  }

  private async ausloesenSchritt(s: Schritt, lage: SeitenLage): Promise<Folge> {
    if (s.stand === "unklar") {
      // Eine Außenwirkung wird nie auf Verdacht wiederholt.
      this.gibAb(uebergabe("pruefen", this.ort(), `„${s.knopf}"`), s.nr);
      return "halt";
    }
    const fp = aussenFingerabdruck(this.auftrag, lage.formular?.fingerabdruck ?? "");
    const b = this.bestaetigung;
    // Eine Bestätigung gilt genau einmal und nur für genau diesen Stand.
    this.bestaetigung = null;
    if (!b || b.fingerabdruck !== fp) {
      this.stand = "bestaetigung_noetig";
      this.merke("bestaetigung_noetig", s.nr);
      return "halt";
    }
    // Die Bestätigung gilt den Werten des Auftrags. Wirksam ist aber, was JETZT auf der Seite
    // steht: weicht ein Feld ab (etwa ein geänderter Empfänger), wird nicht ausgelöst.
    const abweichung = this.auftrag.felder.find((f) => {
      const ist = lage.formular?.felder.filter((x) => x.label === f.label) ?? [];
      return ist.length !== 1 || ist[0]?.wert !== f.wert;
    });
    if (abweichung) {
      this.halteAn(
        `„${abweichung.label}" zeigt auf der Seite nicht mehr den bestätigten Wert. Klara löst „${s.knopf}" nicht aus und überschreibt nichts; prüfe das Formular und bestätige danach neu.`,
        s.nr,
      );
      return "halt";
    }
    const antwort = await this.deps.adapter.klicke(this.auftrag.ziel.tabId, {
      formular: this.auftrag.ziel.formular,
      fingerabdruck: this.fingerabdruck(),
      knopf: s.knopf ?? "",
      // Derselbe Abgleich noch einmal im Seitenausführer, unmittelbar vor dem Klick.
      werte: this.auftrag.felder,
    });
    if (!antwort.ok && antwort.grund !== "zeitueberschreitung" && antwort.grund !== "verbindung") {
      return this.seitenfehler(s, antwort.grund);
    }
    this.angewandt = b;
    if (!antwort.ok) {
      return this.unklar(s, antwort.grund);
    }
    this.setze(s, "erfolgt", `ausgelöst mit Bestätigung vom ${b.bestaetigtAm}`);
    this.merke("ausgeloest", s.nr);
    return "weiter";
  }

  // ---------------------------------------------------------------- Rücknahme

  /** Nimmt nur zurück, was wirklich rücknehmbar ist, und liest das Ergebnis nach. */
  async ruecknahme(): Promise<BrowserRuecknahme> {
    if (this.laeuftGerade() || this.ruecknahmeLaeuft) {
      return { art: "laeuft", text: "Der Auftrag läuft noch; erst pausieren oder abbrechen." };
    }
    const aussen = this.schritte.find(
      (s) => s.art === "ausloesen" && (s.stand === "erfolgt" || s.stand === "unklar"),
    );
    if (aussen) {
      const wie = aussen.stand === "erfolgt" ? "ausgelöst" : "möglicherweise ausgelöst";
      return {
        art: "nicht_ruecknehmbar",
        text: `„${aussen.knopf}" wurde ${wie} und wirkt nach außen. Klara kann das nicht zurücknehmen. Eine Gegenmaßnahme (etwa eine Korrekturnachricht) ist keine Rücknahme und braucht einen eigenen Auftrag.`,
      };
    }
    this.ruecknahmeLaeuft = true;
    try {
      if (this.ergebnis && !this.ergebnis.zurueckgenommen) {
        return await this.loescheEntwurf(this.ergebnis.entwurfId);
      }
      const speichern = this.schritte.find((s) => s.art === "speichern");
      if (speichern?.stand === "zurueckgenommen") {
        return { art: "nichts", text: "Der Entwurf ist bereits zurückgenommen." };
      }
      if (speichern && speichern.stand !== "offen" && speichern.stand !== "uebersprungen") {
        return {
          art: "unklar",
          text: "Ob gespeichert wurde, ist unklar. Prüfe die Seite selbst.",
        };
      }
      const gefuellt = this.schritte.filter((s) => s.art === "fuellen" && s.stand === "erfolgt");
      if (gefuellt.length > 0) {
        return await this.setzeFelderZurueck(gefuellt);
      }
      return { art: "nichts", text: "Es gibt keine rücknehmbare Änderung von Klara." };
    } finally {
      this.ruecknahmeLaeuft = false;
    }
  }

  private async loescheEntwurf(id: string): Promise<BrowserRuecknahme> {
    const liste = this.profil.entwurfsliste;
    const knopf = this.knopf("entwurf_loeschen");
    if (!liste || knopf === null || !this.auftrag.erlaubt.includes("entwurf_loeschen")) {
      return {
        art: "nicht_ruecknehmbar",
        text: `Diese Seite bietet Klara kein Löschen an. Der Entwurf ${id} bleibt gespeichert; lösche ihn bei Bedarf selbst.`,
      };
    }
    if (!(await this.deps.rechte(this.auftrag, "speichern").catch(() => false))) {
      return { art: "ziel_fehlt", text: "Dir fehlt jetzt das Recht dafür. Nichts geändert." };
    }
    const z = this.auftrag.ziel;
    const vorher = await this.leseLage();
    if (!vorher || vorher.origin !== z.origin || vorher.pfad !== z.pfad) {
      return { art: "ziel_fehlt", text: `Öffne ${this.ort()} im Tab des Auftrags wieder.` };
    }
    if (!vorher.entwuerfe.some((e) => e.id === id)) {
      return { art: "ziel_fehlt", text: `Der Entwurf ${id} ist auf der Seite nicht mehr da.` };
    }
    const andere = vorher.entwuerfe.map((e) => e.id).filter((x) => x !== id);
    const antwort = await this.deps.adapter.loesche(z.tabId, { liste, id, knopf });
    const nachher = await this.leseLage();
    const ids = new Set(nachher?.entwuerfe.map((e) => e.id) ?? []);
    if (!nachher || ids.has(id) || andere.some((x) => !ids.has(x))) {
      return {
        art: "unklar",
        text: antwort.ok
          ? "Löschen wurde ausgelöst, aber die Seite zeigt nicht den erwarteten Stand. Prüfe die Entwurfsliste selbst."
          : "Das Löschen wurde nicht ausgeführt. Der Entwurf bleibt gespeichert.",
      };
    }
    for (const s of this.schritte) {
      if ((s.art === "speichern" || s.art === "nachlesen") && s.stand === "erfolgt") {
        this.setze(s, "zurueckgenommen", `Entwurf ${id} gelöscht`);
      }
    }
    if (this.ergebnis) {
      this.ergebnis = { ...this.ergebnis, zurueckgenommen: true };
    }
    this.merke("zurueckgenommen");
    return { art: "zurueckgenommen", beleg: `Entwurf ${id} gelöscht; ${andere.length} andere da` };
  }

  /**
   * Setzt eigene, ungespeicherte Feldwerte zurück — je Feld erst nach erneuter Prüfung von Recht,
   * Tab, Seitenadresse, Formularaufbau und EIGENEM Feldwert. Hat jemand das Feld seither geändert,
   * bleibt es stehen; bei Zielwechsel oder Rechteentzug hält die Rücknahme an und sagt, wie weit
   * sie kam.
   */
  private async setzeFelderZurueck(gefuellt: Schritt[]): Promise<BrowserRuecknahme> {
    const z = this.auftrag.ziel;
    const bindung = this.bindung;
    let zurueck = 0;
    const halt = (art: "ziel_fehlt" | "unklar", grund: string): BrowserRuecknahme => {
      if (zurueck > 0) {
        this.merke("zurueckgenommen");
      }
      const stand = `${zurueck} von ${gefuellt.length} Feldern zurückgesetzt.`;
      return { art, text: `${grund} Nichts weiter geändert; ${stand}` };
    };
    if (!bindung) {
      return halt("ziel_fehlt", "Das Ziel des Auftrags ist nicht gebunden.");
    }
    for (const s of gefuellt) {
      const recht = await this.deps.rechte(this.auftrag, "fuellen").catch(() => false);
      if (!recht) {
        return halt("ziel_fehlt", "Dir fehlt jetzt das Recht dafür.");
      }
      const lage = await this.leseLage();
      if (!lage || lage.tabId !== z.tabId || lage.origin !== z.origin || lage.pfad !== z.pfad) {
        return halt("ziel_fehlt", `Im Tab des Auftrags ist nicht mehr ${this.ort()} geöffnet.`);
      }
      const f = lage.formular;
      if (
        lage.hindernisse.length > 0 ||
        lage.formularTreffer !== 1 ||
        !f ||
        f.fingerabdruck !== bindung.fingerabdruck
      ) {
        return halt("ziel_fehlt", `Das Formular „${z.formular}" hat sich geändert.`);
      }
      const label = s.feld ?? "";
      const eigen = this.wert(label);
      const ist = f.felder.filter((x) => x.label === label);
      if (ist.length !== 1 || ist[0]?.wert !== eigen) {
        return halt(
          "unklar",
          `„${label}" wurde seit Klaras Eintrag geändert; Klara überschreibt das nicht.`,
        );
      }
      const alt = this.vorherWerte.get(label) ?? "";
      const antwort = await this.deps.adapter.fuelle(z.tabId, {
        formular: z.formular,
        fingerabdruck: bindung.fingerabdruck,
        label,
        wert: alt,
        erwartet: eigen,
      });
      if (!antwort.ok || antwort.wert.wert !== alt) {
        return halt("unklar", `„${label}" ließ sich nicht zurücksetzen.`);
      }
      this.setze(s, "zurueckgenommen", "vorheriger Wert nachgelesen");
      zurueck++;
    }
    this.merke("zurueckgenommen");
    return { art: "zurueckgenommen", beleg: `${gefuellt.length} Felder auf den vorherigen Wert` };
  }

  // ---------------------------------------------------------------- Sicht

  private erfolgreich(): boolean {
    return (
      this.stand === "fertig" &&
      this.schritte.every((s) => s.stand === "erfolgt") &&
      (!this.auftrag.speichern || this.ergebnis?.nachgelesen === true)
    );
  }

  private textFuer(): string {
    const felder = this.schritte.filter((s) => s.art === "fuellen");
    const eingetragen = felder.filter((s) => s.stand === "erfolgt").length;
    const gespeichert =
      this.ergebnis && !this.ergebnis.zurueckgenommen
        ? `Entwurf ${this.ergebnis.entwurfId} ist gespeichert.`
        : "Nichts gespeichert.";
    const teil = `${eingetragen} von ${felder.length} Feldern eingetragen. ${gespeichert}`;
    switch (this.stand) {
      case "bereit":
        return "Bereit. Noch nichts geschehen.";
      case "laeuft":
        return `Läuft. ${teil}`;
      case "pausiert":
        return `Pausiert. ${teil} Fortsetzen prüft das Ziel erneut.`;
      case "abgebrochen":
        return `Abgebrochen. ${teil} Bereits Geschehenes bleibt sichtbar.`;
      case "gestoppt_recht":
        return `Gestoppt: das Recht für diese Seite besteht nicht mehr. ${teil}`;
      case "klaerung":
        return `Klärung nötig: ${this.klaerung ?? ""} ${teil}`;
      case "uebergabe":
        return `Bitte selbst weitermachen: ${this.uebergabeGrund?.schritt ?? ""} ${teil}`;
      case "bestaetigung_noetig":
        return `Bestätigung nötig, bevor „${this.auftrag.ausloesen}" ausgelöst wird. ${teil}`;
      case "unklar":
        return `Ergebnis unklar — vor jeder Wiederholung wird die Seite abgeglichen. ${teil}`;
      case "fertig":
        return this.erfolgreich() ? `Erledigt und nachgelesen. ${teil}` : `Beendet. ${teil}`;
    }
  }

  ansicht(): BrowserAnsicht {
    const angewandt = this.angewandt;
    return {
      auftragId: this.auftrag.id,
      quelle: this.auftrag.quelle,
      stand: this.stand,
      erfolg: this.erfolgreich(),
      text: this.textFuer(),
      ziel: this.auftrag.ziel,
      host: { ...this.auftrag.host, adapter: this.deps.adapter.fassung },
      schritte: this.schritte.map((s) => ({ ...s })),
      ergebnis: this.ergebnis ? { ...this.ergebnis } : null,
      klaerung: this.klaerung,
      uebergabe: this.uebergabeGrund,
      bestaetigung: angewandt
        ? { knopf: angewandt.knopf, bestaetigtAm: angewandt.bestaetigtAm }
        : null,
      // Nach einem Rechteentzug zeigt die Sicht nur noch eigene Schritte, keine Seitenbefunde.
      inhalte: this.stand === "gestoppt_recht" ? [] : this.inhalte.map((x) => ({ ...x })),
      verlauf: this.verlauf.map((x) => ({ ...x })),
    };
  }
}
