// ================================================================================================
// AKTIVE BEGLEITUNG (produkt:20261011:assistenz-aktive-beobachtung · BPA-05) — DER KERN.
// ================================================================================================
//
// Der Nutzer sagt: „Begleite mich bei dieser Recherche und mache mich auf fehlende Angaben
// aufmerksam." Die Assistenz beobachtet danach GENAU den freigegebenen Bereich, für genau die
// angegebene Dauer, und bietet dosierte Hinweise an. Mehr nicht.
//
// DER DATENWEG (Auftrag, data_paths_interfaces):
//   freigegebener Kontextadapter → flüchtiger Kontextzustand → erlaubte Prüfung → Hinweis.
// Dieser Kern ist die mittlere Stufe. Er ist REIN: kein Netz, kein Speicher, keine Uhr, keine
// Mediengeräte. Die Adapter (heute der Vorgangsadapter in `adapter.ts`; Browser- und Nativadapter
// liefern dieselben Ereignisse, sobald BPA-01/BPA-04 sie lesen) reichen Ereignisse herein, die
// Oberfläche (`KlaraBegleitung.tsx`) zeigt den Zustand.
//
// WAS DER KERN AUSDRÜCKLICH NICHT TUT:
//   · keine Historie: es gibt genau EINEN Kontextstand, jeder neue ersetzt den alten, Pause und
//     Stopp werfen ihn weg (K8). Keine Zähler je Person, keine Bewertung.
//   · kein Mikrofon, kein Video, kein Audio: die Freigabe trägt die drei Schalter fest auf `false`,
//     ein Auftrag, der sie verlangt, wird abgewiesen (K4). Begleiten ist weder Aufnahme noch Lernen.
//   · keine Dateneingabe: ein Hinweis erklärt den nächsten Schritt, er schreibt nie in ein Feld (K6).
//   · keine Quellenüberwachung: langfristige Dateiänderungen erkennt der bestehende, getrennte
//     Quellenänderungsdienst (`gesamtanweisung-service.ts`, `aenderungspruefung`), nicht dieser
//     Kern (K9).

// Die vier Modi der Assistenz (G08) sind begleiten, lernen, aufnehmen und ausführen. Dieser Kern
// kennt ausschließlich `begleiten`; eine Freigabe mit anderem Modus wird nicht wiederhergestellt.

export type BereichsArt = "vorgang" | "domain" | "anwendung";

/** Der freigegebene Bereich. `kennung` ist die Vorgangskennung, der Host bzw. die App-Kennung. */
export interface Bereich {
  readonly art: BereichsArt;
  readonly kennung: string;
  readonly bezeichnung: string;
  /**
   * Die Rollen, die diesen Bereich begleiten lassen dürfen (am Vorgang festgelegt). Fehlt die
   * Angabe, genügt eine bestätigte Anmeldung. Eine Rolle außerhalb der Liste — auch Verwaltung —
   * erhält dadurch keine Freigabe (G04).
   */
  readonly rollen?: readonly string[];
}

/** Die aktuelle Berechtigung für Bereich und Zweck: angemeldet UND Rolle am Vorgang zugelassen. */
export function darf(bereich: Bereich, rolle: string | null): boolean {
  if (rolle === null) {
    return false;
  }
  return !bereich.rollen || bereich.rollen.length === 0 || bereich.rollen.includes(rolle);
}

export type Phase = "aus" | "aktiv" | "pausiert" | "beendet";

/**
 * Warum die Begleitung pausiert oder endete. Die Regel je Grund steht in `fortsetzen`:
 *   nutzer          → Fortsetzen jederzeit, solange die Freigabe läuft
 *   sperrbildschirm → Fortsetzen nur durch den Nutzer, nie von selbst
 *   verborgen       → Fenster/Tab verborgen (anderes Fenster, Bildschirm aus): wie Sperrbildschirm
 *   kontowechsel    → Fortsetzen nur, wenn wieder DASSELBE Konto angemeldet ist
 *   rechteentzug    → Fortsetzen nur mit einer NACH dem Entzug vom Server bestätigten Berechtigung
 *   neustart        → nach Neuladen: Fortsetzen nur durch den Nutzer, Endpunkt unverändert
 *   stopp           → beendet; neue Begleitung braucht einen neuen Auftrag
 *   abgelaufen      → beendet; die Freigabe wird durch nichts verlängert
 */
export type Grund =
  | "nutzer"
  | "sperrbildschirm"
  | "verborgen"
  | "kontowechsel"
  | "rechteentzug"
  | "neustart"
  | "stopp"
  | "abgelaufen";

/** Die Freigabe. Sie enthält keinen beobachteten Inhalt — nur, WAS beobachtet werden darf. */
export interface Freigabe {
  readonly id: string;
  readonly modus: "begleiten";
  readonly zweck: string;
  readonly bereich: Bereich;
  /** Feldnamen, die nie gelesen werden (zusätzlich zu den am Feld markierten Ausschlüssen). */
  readonly ausschluesse: readonly string[];
  readonly beginn: number;
  /** Absoluter Endpunkt. Weder Pause noch Fortsetzen noch Neustart verschieben ihn. */
  readonly endetAm: number;
  readonly konto: string;
  /** Mindestabstand zwischen zwei Hinweisen. */
  readonly ruheMs: number;
  readonly medien: { readonly mikrofon: false; readonly video: false; readonly audio: false };
}

export interface Feld {
  readonly name: string;
  readonly bezeichnung: string;
  readonly wert: string;
  readonly art?: "text" | "passwort";
  /** Am Feld markiert: wird nie gelesen. Der Adapter liefert dann auch keinen Wert. */
  readonly ausgeschlossen?: boolean;
  /** Das Feld erwartet eine technische Einheit (z. B. Leistung, Spannung). */
  readonly einheitErwartet?: boolean;
  /** Zulässige Einheiten für den Hinweis, z. B. ["W", "kW"]. */
  readonly einheiten?: readonly string[];
}

/** Was ein Adapter meldet: wo der Nutzer gerade ist, und — falls im Bereich — welche Felder. */
export interface KontextEreignis {
  readonly quelle: {
    readonly art: BereichsArt;
    readonly kennung: string;
    /** Privates/Inkognito-Fenster laut Host. Wird nie gelesen, auch nicht im Bereich. */
    readonly privat?: boolean;
  };
  readonly konto: string;
  readonly felder: readonly Feld[];
}

/** Der flüchtige Kontext — nur im Arbeitsspeicher, genau einer, ohne Vorgänger. */
export interface KontextStand {
  readonly bereich: string;
  readonly erfasstAm: number;
  readonly felder: readonly Feld[];
}

export interface Hinweis {
  /** Kennzeichnet die SITUATION (Feld + Wert); gleiche Situation → gleiche Signatur. */
  readonly signatur: string;
  readonly art: "einheit_fehlt";
  readonly feld: string;
  readonly bezeichnung: string;
  readonly wert: string;
  readonly einheiten: readonly string[];
}

export interface Notiz {
  readonly id: string;
  readonly text: string;
  readonly uebernommenAm: number;
}

export interface Begleitung {
  readonly phase: Phase;
  readonly freigabe: Freigabe | null;
  readonly grund: Grund | null;
  /** Der Nutzer ist gerade außerhalb des Bereichs (anderes Fenster, privat, andere App). */
  readonly ausserhalb: boolean;
  readonly kontext: KontextStand | null;
  readonly hinweis: Hinweis | null;
  readonly verworfen: readonly string[];
  readonly letzterHinweisAm: number | null;
  /** Bis wann der Nutzer gerade tippt/klickt — solange wird nicht unterbrochen. */
  readonly beschaeftigtBis: number;
  /**
   * Zeitpunkt des letzten Rechteentzugs, solange er nicht durch eine spätere bestätigte
   * Berechtigung aufgehoben ist. Er bleibt stehen, auch wenn danach ein anderer Pausengrund kommt.
   */
  readonly rechteentzugAm: number | null;
}

export const AUS: Begleitung = {
  phase: "aus",
  freigabe: null,
  grund: null,
  ausserhalb: false,
  kontext: null,
  hinweis: null,
  verworfen: [],
  letzterHinweisAm: null,
  beschaeftigtBis: 0,
  rechteentzugAm: null,
};

export const STANDARD_DAUER_MIN = 30;
export const MAX_DAUER_MIN = 8 * 60;
export const STANDARD_RUHE_MS = 2 * 60 * 1000;
const MAX_ZWECK = 200;

// ------------------------------------------------------------------------------------------------
// DER EINFACHE AUFTRAG (K1)
// ------------------------------------------------------------------------------------------------

export interface Auftrag {
  readonly zweck: string;
  readonly dauerMin: number;
  /** Verlangte Medien. Im Begleitmodus immer abgewiesen (K4). */
  readonly medien: readonly ("mikrofon" | "video" | "audio")[];
}

const DAUER =
  /(\d{1,3})\s*(minuten|minute|minuut|minutes|min|stunden|stunde|std|uur|hours|hour|h)\b/i;
const STUNDEN = /^(stunden|stunde|std|uur|hours|hour|h)$/i;
const MEDIEN: readonly [RegExp, "mikrofon" | "video" | "audio"][] = [
  [/\b(mikrofon|microphone|microfoon)\b/i, "mikrofon"],
  [/\b(video|kamera|camera|bildschirmaufnahme|screen ?recording)\b/i, "video"],
  [/\b(audio|tonaufnahme|aufnehmen|aufzeichnen|mitschneiden|recording|opnemen)\b/i, "audio"],
];

/**
 * Liest einen Satz wie „Begleite mich 45 Minuten bei der Produktrecherche" — die Dauer, sonst
 * 30 Minuten; der Rest ist der Zweck. Verlangt der Satz Mikrofon, Video oder eine Aufnahme, steht
 * das in `medien` und `starte` weist ab, statt es still zu überhören.
 */
export function leseAuftrag(satz: string): Auftrag {
  const text = satz.replace(/\s+/g, " ").trim();
  const d = DAUER.exec(text);
  let dauerMin = STANDARD_DAUER_MIN;
  if (d?.[1] && d[2]) {
    const zahl = Number(d[1]);
    dauerMin = STUNDEN.test(d[2]) ? zahl * 60 : zahl;
  }
  const medien = MEDIEN.filter(([muster]) => muster.test(text)).map(([, art]) => art);
  const zweck = (d ? text.replace(d[0], " ") : text)
    .replace(/^(bitte\s+)?(begleite|begleit|accompany|begeleid)\s+(mich|me)\s*/i, "")
    .replace(/\s+(für|for|voor)\s*$/i, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:]+|[\s,;:]+$/g, "");
  return { zweck: [...zweck].slice(0, MAX_ZWECK).join(""), dauerMin, medien };
}

export type StartFehler = "zweck_fehlt" | "dauer_ungueltig" | "medien_nicht_im_begleitmodus";

export function starte(
  auftrag: Auftrag,
  bereich: Bereich,
  lage: { readonly konto: string; readonly jetzt: number; readonly id: string },
  optionen: { readonly ausschluesse?: readonly string[]; readonly ruheMs?: number } = {},
): { ok: true; begleitung: Begleitung } | { ok: false; fehler: StartFehler } {
  if (auftrag.medien.length > 0) {
    return { ok: false, fehler: "medien_nicht_im_begleitmodus" };
  }
  if (!auftrag.zweck.trim()) {
    return { ok: false, fehler: "zweck_fehlt" };
  }
  if (
    !Number.isInteger(auftrag.dauerMin) ||
    auftrag.dauerMin < 1 ||
    auftrag.dauerMin > MAX_DAUER_MIN
  ) {
    return { ok: false, fehler: "dauer_ungueltig" };
  }
  const freigabe: Freigabe = {
    id: lage.id,
    modus: "begleiten",
    zweck: auftrag.zweck.trim(),
    bereich,
    ausschluesse: [...(optionen.ausschluesse ?? [])],
    beginn: lage.jetzt,
    endetAm: lage.jetzt + auftrag.dauerMin * 60_000,
    konto: lage.konto,
    ruheMs: optionen.ruheMs ?? STANDARD_RUHE_MS,
    medien: { mikrofon: false, video: false, audio: false },
  };
  return { ok: true, begleitung: { ...AUS, phase: "aktiv", freigabe } };
}

// ------------------------------------------------------------------------------------------------
// ZUSTANDSWECHSEL
// ------------------------------------------------------------------------------------------------

/**
 * Pause: der flüchtige Kontext und ein offener Hinweis fallen weg — nach der Pause zählt frischer
 * Kontext. Ein Rechteentzug merkt sich seinen Zeitpunkt; ihn hebt nur eine spätere Bestätigung auf.
 */
export function pausiere(b: Begleitung, grund: Grund, jetzt: number): Begleitung {
  if (b.phase !== "aktiv" && b.phase !== "pausiert") {
    return b;
  }
  return {
    ...b,
    phase: "pausiert",
    grund,
    kontext: null,
    hinweis: null,
    ausserhalb: false,
    rechteentzugAm: grund === "rechteentzug" ? jetzt : b.rechteentzugAm,
  };
}

/** Stopp: alles Flüchtige ist weg, auch die verworfenen Signaturen. Die Freigabe bleibt nur zur Anzeige. */
export function stoppe(b: Begleitung, grund: "stopp" | "abgelaufen" = "stopp"): Begleitung {
  if (b.phase === "aus") {
    return b;
  }
  return {
    ...AUS,
    phase: "beendet",
    grund,
    freigabe: b.freigabe,
  };
}

/** Ein abgelaufener Endpunkt beendet — vor jeder anderen Regel. */
export function pruefeAblauf(b: Begleitung, jetzt: number): Begleitung {
  if (
    (b.phase === "aktiv" || b.phase === "pausiert") &&
    b.freigabe &&
    jetzt >= b.freigabe.endetAm
  ) {
    return stoppe(b, "abgelaufen");
  }
  return b;
}

export interface Lage {
  readonly konto: string;
  /** Ergebnis der aktuellen Rechteprüfung für Bereich und Zweck. */
  readonly darfBegleiten: boolean;
  readonly jetzt: number;
  /** Wann der Server diese Berechtigung zuletzt bestätigt hat (z. B. `/auth/me`). */
  readonly rechteGeprueftAm?: number;
}

export type FortsetzenFehler =
  | "abgelaufen"
  | "anderes_konto"
  | "keine_rechte"
  | "rechte_unbestaetigt"
  | "nicht_pausiert";

/**
 * Darf JETZT gelesen werden? Vor jedem Lesen — auch vor einer Hintergrundaktualisierung — geprüft:
 * aktiv, nicht abgelaufen, dasselbe Konto, aktuelle Berechtigung. Fällt die Antwort „nein", wird
 * gar nicht erst gelesen.
 */
export function darfLesen(b: Begleitung, lage: Lage): boolean {
  return (
    b.phase === "aktiv" &&
    b.freigabe !== null &&
    lage.jetzt < b.freigabe.endetAm &&
    lage.konto === b.freigabe.konto &&
    lage.darfBegleiten
  );
}

export type FortsetzenErgebnis =
  | { ok: true; begleitung: Begleitung }
  | { ok: false; fehler: FortsetzenFehler; begleitung: Begleitung };

export function fortsetzen(b: Begleitung, lage: Lage): FortsetzenErgebnis {
  const geprueft = pruefeAblauf(b, lage.jetzt);
  if (geprueft.phase === "beendet") {
    return { ok: false, fehler: "abgelaufen", begleitung: geprueft };
  }
  if (geprueft.phase !== "pausiert" || !geprueft.freigabe) {
    return { ok: false, fehler: "nicht_pausiert", begleitung: geprueft };
  }
  if (lage.konto !== geprueft.freigabe.konto) {
    return { ok: false, fehler: "anderes_konto", begleitung: geprueft };
  }
  if (!lage.darfBegleiten) {
    return { ok: false, fehler: "keine_rechte", begleitung: geprueft };
  }
  // Nach einem Entzug genügt ein positiver Wert allein nicht: er muss NACH dem Entzug vom Server
  // bestätigt sein. Ein zwischengespeicherter Stand von vorher hebt die Sperre nicht auf.
  if (
    geprueft.rechteentzugAm !== null &&
    !((lage.rechteGeprueftAm ?? Number.NEGATIVE_INFINITY) > geprueft.rechteentzugAm)
  ) {
    return { ok: false, fehler: "rechte_unbestaetigt", begleitung: geprueft };
  }
  return {
    ok: true,
    begleitung: { ...geprueft, phase: "aktiv", grund: null, rechteentzugAm: null },
  };
}

export type Systemereignis = "sperrbildschirm" | "verborgen" | "kontowechsel" | "rechteentzug";

export function systemereignis(b: Begleitung, ereignis: Systemereignis, jetzt: number): Begleitung {
  return b.phase === "aktiv" || b.phase === "pausiert" ? pausiere(b, ereignis, jetzt) : b;
}

/** Der Nutzer tippt oder klickt gerade — Hinweise warten bis dahin. */
export function beschaeftigt(b: Begleitung, bis: number): Begleitung {
  return { ...b, beschaeftigtBis: Math.max(b.beschaeftigtBis, bis) };
}

// ------------------------------------------------------------------------------------------------
// KONTEXT (K2, K3, K7)
// ------------------------------------------------------------------------------------------------

export type KontextErgebnis =
  | "uebernommen"
  | "nicht_aktiv"
  | "ausserhalb"
  | "privat"
  | "kontowechsel"
  | "rechteentzug"
  | "abgelaufen";

function gelesen(feld: Feld, freigabe: Freigabe): boolean {
  return (
    feld.ausgeschlossen !== true &&
    feld.art !== "passwort" &&
    !freigabe.ausschluesse.includes(feld.name)
  );
}

/**
 * Nimmt ein Adapterereignis entgegen. Übernommen wird NUR, was aktiv, im Bereich, nicht privat,
 * unter demselben Konto und mit gültigen Rechten anfällt — und davon nur die nicht ausgeschlossenen
 * Felder, als Kopie. Alles andere ändert höchstens den Status, nie den Kontext.
 */
export function nimmKontext(
  b: Begleitung,
  e: KontextEreignis,
  lage: Lage,
): { begleitung: Begleitung; ergebnis: KontextErgebnis } {
  const geprueft = pruefeAblauf(b, lage.jetzt);
  if (geprueft.phase === "beendet" && geprueft.grund === "abgelaufen" && b.phase !== "beendet") {
    return { begleitung: geprueft, ergebnis: "abgelaufen" };
  }
  if (geprueft.phase !== "aktiv" || !geprueft.freigabe) {
    return { begleitung: geprueft, ergebnis: "nicht_aktiv" };
  }
  const f = geprueft.freigabe;
  if (e.konto !== f.konto || lage.konto !== f.konto) {
    const begleitung = pausiere(geprueft, "kontowechsel", lage.jetzt);
    return { begleitung, ergebnis: "kontowechsel" };
  }
  if (!lage.darfBegleiten) {
    const begleitung = pausiere(geprueft, "rechteentzug", lage.jetzt);
    return { begleitung, ergebnis: "rechteentzug" };
  }
  if (e.quelle.privat === true) {
    return {
      begleitung: { ...geprueft, ausserhalb: true, kontext: null, hinweis: null },
      ergebnis: "privat",
    };
  }
  if (e.quelle.art !== f.bereich.art || e.quelle.kennung !== f.bereich.kennung) {
    return {
      begleitung: { ...geprueft, ausserhalb: true, kontext: null, hinweis: null },
      ergebnis: "ausserhalb",
    };
  }
  const felder = e.felder
    .filter((feld) => gelesen(feld, f))
    .map((feld) => ({
      name: feld.name,
      bezeichnung: feld.bezeichnung,
      wert: feld.wert,
      ...(feld.einheitErwartet ? { einheitErwartet: true } : {}),
      ...(feld.einheiten ? { einheiten: [...feld.einheiten] } : {}),
    }));
  const kontext: KontextStand = { bereich: f.bereich.kennung, erfasstAm: lage.jetzt, felder };
  // Ein offener Hinweis bleibt nur stehen, solange seine Situation unverändert besteht.
  const hinweis =
    geprueft.hinweis && befunde(kontext).some((h) => h.signatur === geprueft.hinweis?.signatur)
      ? geprueft.hinweis
      : null;
  return {
    begleitung: { ...geprueft, ausserhalb: false, kontext, hinweis },
    ergebnis: "uebernommen",
  };
}

// ------------------------------------------------------------------------------------------------
// HINWEISE (K5, K6)
// ------------------------------------------------------------------------------------------------

const NUR_ZAHL = /^\s*[+-]?\d+(?:[.,]\d+)?\s*$/;

/** Eine Zahl ohne Einheit. Dieselbe Regel nutzt die spätere Prüfung des Testformulars. */
export function ohneEinheit(wert: string): boolean {
  return NUR_ZAHL.test(wert);
}

/** Die regelbasierte Prüfung: ein technisches Feld mit Zahl, aber ohne Einheit. Kein Modell. */
export function befunde(kontext: KontextStand): Hinweis[] {
  return kontext.felder
    .filter((feld) => feld.einheitErwartet === true && ohneEinheit(feld.wert))
    .map((feld) => ({
      signatur: `einheit_fehlt:${feld.name}:${feld.wert.trim()}`,
      art: "einheit_fehlt" as const,
      feld: feld.name,
      bezeichnung: feld.bezeichnung,
      wert: feld.wert.trim(),
      einheiten: feld.einheiten ?? [],
    }));
}

/**
 * Dosierung: höchstens ein Hinweis, nicht während der Nutzer beschäftigt ist (Unterbrechung),
 * nicht vor Ablauf der konfigurierten Ruhe (`freigabe.ruheMs`) — und nie wieder für eine verworfene,
 * unveränderte Situation. Ändert sich der Wert, ist es eine neue Situation.
 */
export function naechsterHinweis(b: Begleitung, jetzt: number): Begleitung {
  if (b.phase !== "aktiv" || !b.freigabe || !b.kontext || b.hinweis) {
    return b;
  }
  if (jetzt < b.beschaeftigtBis) {
    return b;
  }
  if (b.letzterHinweisAm !== null && jetzt - b.letzterHinweisAm < b.freigabe.ruheMs) {
    return b;
  }
  const offen = befunde(b.kontext).find((h) => !b.verworfen.includes(h.signatur));
  return offen ? { ...b, hinweis: offen, letzterHinweisAm: jetzt } : b;
}

export function verwirf(b: Begleitung): Begleitung {
  if (!b.hinweis) {
    return b;
  }
  return { ...b, hinweis: null, verworfen: [...b.verworfen, b.hinweis.signatur] };
}

// ------------------------------------------------------------------------------------------------
// WIEDERANLAUF (K7) UND AUSKUNFT (K8)
// ------------------------------------------------------------------------------------------------

/**
 * Was über einen Neustart (Neuladen) hinweg bleibt: allein die Freigabe. Kein Kontext, kein
 * Hinweis, keine Feldwerte.
 */
export function sicherung(b: Begleitung): Freigabe | null {
  return b.phase === "aktiv" || b.phase === "pausiert" ? b.freigabe : null;
}

/** Nach dem Neuladen: abgelaufen bleibt abgelaufen; sonst pausiert bis zum bewussten Fortsetzen. */
export function wiederherstellen(freigabe: Freigabe | null, jetzt: number): Begleitung {
  if (!freigabe || freigabe.modus !== "begleiten") {
    return AUS;
  }
  const b: Begleitung = { ...AUS, phase: "pausiert", grund: "neustart", freigabe };
  return pruefeAblauf(b, jetzt);
}

export interface Auskunft {
  readonly modus: "begleiten";
  readonly medien: { readonly mikrofon: "aus"; readonly video: "aus"; readonly audio: "aus" };
  /** Was dauerhaft (über den Sitzungsspeicher) liegt: Freigabe ohne Inhalt und bewusst übernommene Notizen. */
  readonly gespeichert: { readonly freigabe: boolean; readonly notizen: number };
  /** Was nur im Arbeitsspeicher liegt und mit Pause/Stopp verfällt. */
  readonly fluechtig: { readonly felder: number; readonly hinweis: boolean };
  readonly aufnahme: "keine";
  readonly verlauf: "keiner";
  readonly quellenaenderung: "getrennter_dienst";
}

export function auskunft(b: Begleitung, notizen: readonly Notiz[]): Auskunft {
  return {
    modus: "begleiten",
    medien: { mikrofon: "aus", video: "aus", audio: "aus" },
    gespeichert: { freigabe: sicherung(b) !== null, notizen: notizen.length },
    fluechtig: { felder: b.kontext?.felder.length ?? 0, hinweis: b.hinweis !== null },
    aufnahme: "keine",
    verlauf: "keiner",
    quellenaenderung: "getrennter_dienst",
  };
}
