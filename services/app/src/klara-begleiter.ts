import { randomUUID } from "node:crypto";

// ================================================================================================
// produkt:20261010:klara-office-mac-maskottchen (KLARA-OFFICE-02) — DER KONTEXTKANAL DER BEGLEITAPP.
// ================================================================================================
//
// „Die Begleitapp empfängt ausschließlich den gebundenen zulässigen Kontext vom Office-Adapter und
// führt dokumentbezogene Aktionen über ihn zurück. Veraltete, fremde oder nicht angemeldete
// Nachrichten werden abgewiesen; Hintergrundbetrieb ohne aktiven Adapter behauptet keine aktuelle
// Auswahl." (KO-02-05)
//
// WARUM ÜBER DEN SERVER: Word für Mac lädt das Aufgabenfenster in seinem eigenen WebView-Prozess,
// Word im Web in einem fremden Rahmen in Chrome. Die Begleitapp ist ein dritter Prozess. Ein
// gemeinsamer Speicher oder ein lokaler Port wäre je Host anders und im Browser gesperrt; der eine
// Weg, den alle drei mit derselben Anmeldung gehen können, ist die eigene Klarwerk-Instanz.
//
// DIE REGELN DIESES KANALS:
//   · Er gehört GENAU EINEM KONTO. Das Konto kommt aus der Sitzung, nie aus Pfad oder Rumpf; eine
//     fremde und eine unbekannte Adapterkennung antworten gleich (404 `nicht_angemeldet`).
//   · Ein Adapter (EIN geladenes Aufgabenfenster = EIN Dokumentfenster) meldet sich an und trägt
//     dabei Host, Hostfassung und die Dokumentkennung, die Office liefert. Erst danach nimmt der
//     Kanal Meldungen von ihm an. Sichtbarkeit eines Fensters zählt nicht — nur diese Anmeldung.
//   · Jede Meldung trägt eine streng steigende Folgenummer. Eine gleiche oder kleinere Nummer ist
//     veraltet oder wiederholt und wird abgewiesen (409 `veraltet`).
//   · Ein Adapter ist nur AKTIV, solange er sich innerhalb von `BEGLEITER_AKTIV_MS` gemeldet hat.
//     Ein inaktiver Adapter liefert der Begleitapp KEINE Auswahl — auch nicht die zuletzt bekannte.
//     Nach `BEGLEITER_ABLAUF_MS` ohne Meldung ist er vergessen und muss sich neu anmelden.
//   · Dokumentbezogene Aktionen (Einfügen, Frage zum Dokument) legt die Begleitapp hier ab; der
//     Adapter holt sie mit seiner nächsten Meldung und führt sie in Word aus. Ein Einfügen gilt nur
//     für den Auswahlstand, den die Begleitapp gesehen hat; hat sich die Auswahl seither geändert,
//     wird es abgewiesen statt an eine andere Stelle geschrieben.
//
// WAS HIER NICHT LIEGT: Nichts davon wird gespeichert. Der Kanal lebt im Arbeitsspeicher dieses
// Prozesses; ein Neustart vergisst alle Adapter (sie melden sich von selbst neu an). Ins
// Prüfprotokoll geht nichts — eine Auswahl dort wäre nach dem Schließen nicht mehr zu entfernen.

/** So lange gilt ein Adapter nach seiner letzten Meldung als aktiv. */
export const BEGLEITER_AKTIV_MS = 12_000;
/** Danach ist er vergessen und muss sich neu anmelden. */
export const BEGLEITER_ABLAUF_MS = 60_000;
/** Höchstlänge der übermittelten Auswahl. Der Adapter kürzt vorher und meldet die volle Länge. */
export const BEGLEITER_AUSWAHL_MAX = 4_000;
/** Höchstlänge eines Aktionstextes (eingefügte Antwort oder Frage). */
export const BEGLEITER_AKTION_TEXT_MAX = 8_000;
/** Höchstlänge eines Ergebnistextes, den der Adapter zurückmeldet. */
export const BEGLEITER_ERGEBNIS_MAX = 8_000;
/** So viele offene Aktionen darf ein Adapter gleichzeitig haben. */
export const BEGLEITER_AKTIONEN_OFFEN_MAX = 3;
/** So lange wartet eine Aktion auf ihre Ausführung; danach ist sie verfallen. */
export const BEGLEITER_AKTION_FRIST_MS = 120_000;
/** So viele Adapter (Dokumentfenster) hält ein Konto gleichzeitig. */
export const BEGLEITER_ADAPTER_MAX = 8;

/**
 * So viele Auftragsschlüssel (angelegt oder als „nicht angelegt“ geklärt) merkt sich der Kanal je
 * Konto höchstens. Nacharbeit 59: es weicht NIE ein Vermerk, dessen Schlüssel noch angenommen werden
 * könnte (siehe `BEGLEITER_SCHLUESSEL_FRIST_MS`); ist kein Platz, wird abgewiesen statt verdrängt.
 */
export const BEGLEITER_AUFTRAEGE_MERKEN_MAX = 64;
/**
 * Nacharbeit 59 (Ben): ein Auftrag mit Schlüssel trägt seinen Ausstellungszeitpunkt — die Serverzeit
 * (`jetzt`) des Kontexts, den die Begleitapp gesehen hat. Älter als diese Frist wird er nie mehr
 * angenommen (409 `schluessel_abgelaufen`), gleich wie lange er unterwegs war oder gewartet hat.
 */
export const BEGLEITER_SCHLUESSEL_FRIST_MS = 120_000;
/**
 * So lange bleibt ein Vermerk MINDESTENS. Ein Ausstellungszeitpunkt liegt immer vor der Klärung
 * (die Begleitapp kennt ihn, bevor sie sendet), also ist nach Klärung + Frist jeder verspätete POST
 * dieses Schlüssels sicher abgelaufen. Der doppelte Wert fängt Rücksprünge der Serveruhr bis zu einer
 * Frist auf.
 */
export const BEGLEITER_VERMERK_MINDESTENS_MS = 2 * BEGLEITER_SCHLUESSEL_FRIST_MS;

const INSTANZ = /^bgl-[0-9a-f]{32}$/;
/** Ein von der Begleitapp je Beauftragung erzeugter, zufälliger Schlüssel (Korrelation). */
const AUFTRAGSSCHLUESSEL = /^[A-Za-z0-9_-]{16,64}$/;
const DOKUMENTKENNUNG = /^(url|neu)-[0-9a-f]{16,64}$/;
const HOSTFASSUNG = /^[0-9A-Za-z .()_-]{0,40}$/;

/** Steuerzeichen außer Tabulator, Zeilenvorschub und Wagenrücklauf (die Word in Auswahlen liefert). */
function hatSteuerzeichen(wert: string): boolean {
  for (let i = 0; i < wert.length; i += 1) {
    const c = wert.charCodeAt(i);
    if ((c < 32 && c !== 9 && c !== 10 && c !== 13) || c === 127) {
      return true;
    }
  }
  return false;
}

export const BEGLEITER_HOSTS = ["word-mac", "word-web", "word-windows", "word-andere"] as const;
export type BegleiterHost = (typeof BEGLEITER_HOSTS)[number];

export const BEGLEITER_AKTION_ARTEN = ["einfuegen", "frage"] as const;
export type BegleiterAktionArt = (typeof BEGLEITER_AKTION_ARTEN)[number];

/**
 * Was der Adapter über eine ausgeführte Aktion meldet. `gestoppt` nimmt der Kanal nur an, wenn die
 * Begleitapp den Abbruch dieser Aktion angefordert hat (siehe `stoppen`).
 */
const ERGEBNIS_STAENDE = ["erledigt", "abgelehnt", "fehler", "gestoppt"] as const;
type ErgebnisStand = (typeof ERGEBNIS_STAENDE)[number];

/**
 * `gestoppt` (produkt:20261011:assistenz-minimalistische-oberflaeche, UI-MIN-06/14): die Aktion hat
 * auf Wunsch der Begleitapp keine weitere Wirkung — entweder zurückgezogen, BEVOR das Word-Fenster sie
 * abgeholt hat, oder vom Word-Fenster während der Ausführung abgebrochen und so bestätigt.
 */
export type BegleiterAktionStand = "offen" | "uebergeben" | ErgebnisStand | "verfallen";

export interface BegleiterDokument {
  /** Kennung aus Office: Prüfsumme der Dokumentadresse (`url-…`) oder Fensternonce (`neu-…`). */
  readonly kennung: string;
  /** Der Dateiname, wie Office ihn liefert — oder leer bei einem nie gespeicherten Dokument. */
  readonly titel: string;
  readonly gespeichert: boolean;
}

export interface BegleiterAktion {
  readonly id: string;
  readonly art: BegleiterAktionArt;
  readonly text: string;
  /** Der Auswahlstand des Adapters, den die Begleitapp beim Auftrag gesehen hat. */
  readonly auswahlStand: number;
  stand: BegleiterAktionStand;
  readonly angelegtAm: number;
  geaendertAm: number;
  ergebnis: string | null;
  grund: string | null;
  /** Die Begleitapp hat den Abbruch einer schon übergebenen Aktion angefordert; Word bestätigt ihn. */
  abbruchAngefordert: boolean;
  /**
   * Nacharbeit 64: der Auftragsschlüssel der Begleitapp (falls vorhanden). Er geht mit dem Auftrag
   * an Word, damit das Fenster ihn nach einem Serverneustart zurückmelden kann (`anmelden.laufend`).
   */
  schluessel?: string | null;
}

/** So viele BEENDETE Aktionen zeigt der Kontext je Adapter (laufende immer alle). */
export const BEGLEITER_VERLAUF_ANZEIGE_MAX = 5;
/** So viele BEENDETE Aktionen hält der Kanal je Adapter (laufende immer alle). */
export const BEGLEITER_VERLAUF_MAX = 10;

/** Läuft die Aktion noch — wartet sie auf Word oder führt Word sie aus? */
function laeuft(a: BegleiterAktion): boolean {
  return a.stand === "offen" || a.stand === "uebergeben";
}

/**
 * produkt:20261011:assistenz-minimalistische-oberflaeche (UI-MIN-06/14, Ben Nacharbeit 54 · MAC5-02):
 * gekürzt wird NUR der Verlauf beendeter Aktionen. Jede noch laufende Aktion bleibt — gleich wie viele
 * jüngere schon fertig sind —, sonst verlöre die Begleitapp ihren Stopp, während Word weiterarbeitet.
 * Die Reihenfolge bleibt; die Obergrenze laufender Aktionen setzt `beauftragen` (höchstens drei).
 */
export function mitLaufenden(
  aktionen: readonly BegleiterAktion[],
  beendetMax: number,
): BegleiterAktion[] {
  const beendet = aktionen.filter((a) => !laeuft(a));
  const behalten = new Set(beendet.slice(Math.max(0, beendet.length - beendetMax)));
  return aktionen.filter((a) => laeuft(a) || behalten.has(a));
}

interface AdapterEintrag {
  readonly instanz: string;
  readonly host: BegleiterHost;
  readonly hostFassung: string;
  readonly dokument: BegleiterDokument;
  seq: number;
  auswahl: string | null;
  auswahlLaenge: number;
  auswahlStand: number;
  readonly angemeldetAm: number;
  zuletztAm: number;
  auswahlAm: number;
  aktionen: BegleiterAktion[];
  /**
   * Nacharbeit 61 (Ben): das Fenster hat sich abgemeldet, während Word noch eine übergebene Aktion
   * ausführte. Es bleibt — inaktiv, ohne Auswahl und ohne neue Aufträge — nur, damit diese Aktion
   * sichtbar und stoppbar bleibt und ihr Ende noch gemeldet werden kann.
   */
  abgemeldet?: boolean;
  /**
   * Nacharbeit 64: das Fenster hat bei seiner Anmeldung in DIESER Kanalinstanz vollständig gemeldet,
   * was es noch ausführt (`laufend`). Erst damit ist für Aufträge an dieses Fenster aus einer
   * früheren Kanalinstanz belegt, ob dazu noch etwas läuft.
   */
  bestandGemeldet?: boolean;
}

/** Was die Begleitapp über einen Adapter erfährt. */
export interface BegleiterAdapterSicht {
  instanz: string;
  host: BegleiterHost;
  hostFassung: string;
  dokument: { titel: string; gespeichert: boolean };
  aktiv: boolean;
  /** Millisekunden seit der letzten Meldung. */
  stilleMs: number;
  /** Nacharbeit 64: hat das Fenster in dieser Kanalinstanz seinen laufenden Bestand gemeldet? */
  bestand: boolean;
  /** Nur bei einem AKTIVEN Adapter — sonst `null`, auch wenn früher eine Auswahl bekannt war. */
  auswahl: { text: string; laenge: number; stand: number; gekuerzt: boolean } | null;
  aktionen: Array<{
    id: string;
    art: BegleiterAktionArt;
    stand: BegleiterAktionStand;
    ergebnis: string | null;
    grund: string | null;
    /** Nur vorhanden (und `true`), solange bzw. nachdem der Abbruch angefordert wurde. */
    abbruchAngefordert?: true;
  }>;
}

export interface BegleiterKontext {
  jetzt: string;
  aktivMs: number;
  /**
   * Nacharbeit 64: die Kennung DIESER Kanalinstanz (neu nach jedem Serverneustart). Ein Wechsel
   * heißt: der Bestand im Arbeitsspeicher ist verloren — nichts davon ist als beendet belegt.
   */
  kanal: string;
  adapter: BegleiterAdapterSicht[];
}

/** Was der Adapter mit seiner Meldung zurückbekommt: die Aktionen, die er jetzt ausführen soll. */
export interface BegleiterAuftragFuerAdapter {
  id: string;
  art: BegleiterAktionArt;
  text: string;
  auswahlStand: number;
  /** Nacharbeit 64: nur wenn der Auftrag einen Schlüssel trägt (für `anmelden.laufend`). */
  schluessel?: string;
}

export interface BegleiterMeldeAntwort {
  aktionen: BegleiterAuftragFuerAdapter[];
  /** Kennungen übergebener Aktionen, deren Abbruch angefordert ist — bis Word ein Ende meldet. */
  abbrechen?: string[];
  /**
   * Nacharbeit 63 (Ben): nur wenn die Meldung Ergebnisse trug — die Kennungen, für die es danach
   * NICHTS mehr zu melden gibt (übernommen, oder die Aktion war schon beendet bzw. ist hier
   * unbekannt). Ein abgewiesenes Ergebnis (etwa „gestoppt“ ohne Abbruchanforderung bei einem
   * angemeldeten Fenster) fehlt hier: der Adapter muss es behalten.
   */
  quittiert?: string[];
}

export class BegleiterFehler extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    readonly grund: string,
    message: string,
  ) {
    super(message);
    this.name = "BegleiterFehler";
  }
}

function ungueltig(feld: string, warum: string): BegleiterFehler {
  return new BegleiterFehler(400, "ungueltig", `${feld}: ${warum}`);
}

function nichtAngemeldet(): BegleiterFehler {
  // Fremd, unbekannt und abgelaufen antworten GLEICH — keine Auskunft über fremde Fenster.
  return new BegleiterFehler(
    404,
    "nicht_angemeldet",
    "Dieses Word-Fenster ist bei der Begleitapp nicht angemeldet.",
  );
}

function objekt(roh: unknown, feld: string): Record<string, unknown> {
  if (typeof roh !== "object" || roh === null || Array.isArray(roh)) {
    throw ungueltig(feld, "erwartet ein Objekt");
  }
  return roh as Record<string, unknown>;
}

function ganzzahl(roh: unknown, feld: string, min: number): number {
  if (typeof roh !== "number" || !Number.isSafeInteger(roh) || roh < min) {
    throw ungueltig(feld, `erwartet eine ganze Zahl ab ${min}`);
  }
  return roh;
}

function text(roh: unknown, feld: string, max: number, leerErlaubt: boolean): string {
  if (typeof roh !== "string") {
    throw ungueltig(feld, "erwartet Text");
  }
  if (roh.length > max) {
    throw ungueltig(feld, `länger als ${max} Zeichen`);
  }
  if (hatSteuerzeichen(roh)) {
    throw ungueltig(feld, "enthält Steuerzeichen");
  }
  if (!leerErlaubt && roh.trim().length === 0) {
    throw ungueltig(feld, "ist leer");
  }
  return roh;
}

function aus<T extends string>(roh: unknown, werte: readonly T[], feld: string): T {
  if (typeof roh !== "string" || !(werte as readonly string[]).includes(roh)) {
    throw ungueltig(feld, `erwartet ${werte.join(" | ")}`);
  }
  return roh as T;
}

export function pruefeAuftragsschluessel(roh: unknown): string {
  if (typeof roh !== "string" || !AUFTRAGSSCHLUESSEL.test(roh)) {
    throw ungueltig("schluessel", "kein Auftragsschlüssel");
  }
  return roh;
}

/**
 * Nacharbeit 58 (Ben, MACG57-POST-GET-01): was der Kanal über EINEN Auftragsschlüssel weiß —
 * angelegt (mit der Aktion) oder als „nicht angelegt“ geklärt (`aktion: null`, gesperrt).
 */
interface AuftragsVermerk {
  readonly instanz: string | null;
  readonly aktion: BegleiterAktion | null;
  /** Wann der Kanal den Vermerk angelegt hat (Annahme bzw. Klärung). */
  readonly am: number;
}

/** Das Ergebnis einer Klärung — immer auf genau diesen Schlüssel bezogen. */
export type BegleiterKlaerung =
  | { stand: "angenommen"; instanz: string; aktion: BegleiterAktion }
  | { stand: "nicht_angelegt" }
  /**
   * Nacharbeit 63: die Annahmehistorie dieses (abgelaufenen) Schlüssels ist nicht mehr sicher
   * feststellbar. Sicher ist nur: angenommen werden kann er nicht mehr, und dazu läuft nichts.
   */
  | { stand: "unbekannt" }
  /**
   * Nacharbeit 64: Auftrag aus einer früheren Kanalinstanz; sein Zielfenster hat seinen Bestand
   * gemeldet und führt ihn nicht aus. Ob er je angenommen war, ist nicht mehr belegbar.
   */
  | { stand: "nicht_laufend" }
  /** Nacharbeit 64: Auftrag aus früherer Kanalinstanz; Zielfenster hat sich noch nicht gemeldet. */
  | { stand: "offen" };

export function pruefeInstanz(roh: unknown): string {
  if (typeof roh !== "string" || !INSTANZ.test(roh)) {
    throw ungueltig("instanz", "keine Adapterkennung");
  }
  return roh;
}

function pruefeDokument(roh: unknown): BegleiterDokument {
  const d = objekt(roh, "dokument");
  if (typeof d.kennung !== "string" || !DOKUMENTKENNUNG.test(d.kennung)) {
    throw ungueltig("dokument.kennung", "keine Dokumentkennung aus Office");
  }
  if (typeof d.gespeichert !== "boolean") {
    throw ungueltig("dokument.gespeichert", "erwartet wahr oder falsch");
  }
  if (d.gespeichert !== d.kennung.startsWith("url-")) {
    throw ungueltig("dokument", "Kennung und Speicherstand passen nicht zusammen");
  }
  return {
    kennung: d.kennung,
    titel: text(d.titel ?? "", "dokument.titel", 120, true).trim(),
    gespeichert: d.gespeichert,
  };
}

/**
 * Der Kanal. Eine Instanz je Serverprozess (`build-app.ts`); Uhr und Kennungsquelle sind für die
 * Prüfung austauschbar.
 */
export class BegleiterKanal {
  private readonly konten = new Map<string, Map<string, AdapterEintrag>>();
  /** Je Konto: Auftragsschlüssel → Vermerk. Getrennt von den Adaptern (die verfallen können). */
  private readonly auftraege = new Map<string, Map<string, AuftragsVermerk>>();

  constructor(
    private readonly uhr: () => number = Date.now,
    private readonly neueId: () => string = randomUUID,
    /**
     * Nacharbeit 64 (Ben): die Kennung dieser Kanalinstanz. Der Bestand lebt nur im Arbeitsspeicher;
     * jede neue Instanz (Serverneustart) hat eine neue Kennung — nur innerhalb DERSELBEN ist ein
     * fehlender Vermerk ein Beleg (Bestandskontinuität).
     */
    readonly epoche: string = randomUUID(),
  ) {}

  private adapterVon(konto: string): Map<string, AdapterEintrag> {
    let adapter = this.konten.get(konto);
    if (!adapter) {
      adapter = new Map();
      this.konten.set(konto, adapter);
    }
    return adapter;
  }

  /**
   * Vergisst abgelaufene Adapter und lässt nie abgeholte Aktionen verfallen.
   *
   * Nacharbeit 60 (Ben): eine an Word ÜBERGEBENE Aktion endet nur mit Words eigener Meldung
   * (`erledigt`, `gestoppt`, …) — weder eine Frist noch der Verbindungsverlust ersetzt diesen Beleg.
   * Ein stiller Adapter mit einer solchen Aktion bleibt deshalb (inaktiv, „Verbindung verloren“)
   * samt Aktion und Stopp erhalten; ein angeforderter Abbruch geht mit seiner nächsten Meldung
   * hinaus. Nur `offen` verfällt: Word hat sie nie erhalten, also hatte sie sicher keine Wirkung.
   */
  private aufraeumen(konto: string): Map<string, AdapterEintrag> | undefined {
    const adapter = this.konten.get(konto);
    if (!adapter) {
      return undefined;
    }
    const jetzt = this.uhr();
    for (const [instanz, e] of adapter) {
      for (const a of e.aktionen) {
        if (a.stand === "offen" && jetzt - a.angelegtAm > BEGLEITER_AKTION_FRIST_MS) {
          a.stand = "verfallen";
          a.geaendertAm = jetzt;
        }
      }
      if (jetzt - e.zuletztAm > BEGLEITER_ABLAUF_MS && !e.aktionen.some(laeuft)) {
        adapter.delete(instanz);
      }
    }
    if (adapter.size === 0) {
      this.konten.delete(konto);
      return undefined;
    }
    return adapter;
  }

  private vermerke(konto: string): Map<string, AuftragsVermerk> {
    let v = this.auftraege.get(konto);
    if (!v) {
      v = new Map();
      this.auftraege.set(konto, v);
    }
    return v;
  }

  /**
   * Nacharbeit 59 (Ben): Platz für einen neuen Vermerk. Entfernt werden NUR Vermerke, deren Schlüssel
   * nachweislich nicht mehr angenommen werden kann (älter als `BEGLEITER_VERMERK_MINDESTENS_MS`).
   * Reicht das nicht, wird der Aufruf abgewiesen (409) — nie eine noch wirksame Sperre verdrängt.
   *
   * Nacharbeit 62 (Ben, MACG60-VERMERK-LEBENSDAUER-01): zwei Fristen, nicht eine. Die
   * Mindestaufbewahrung gilt dem SCHLÜSSEL (verspäteter Doppelstart); die Zuordnung einer
   * angenommenen Aktion gilt dagegen, solange die AKTION läuft — sonst meldete `klaeren` für eine
   * weiterhin übergebene Aktion „nicht_angelegt“. Ein Vermerk weicht also erst, wenn beides vorbei
   * ist: Mindestaufbewahrung abgelaufen UND seine Aktion (falls angenommen) beendet.
   */
  private platzFuerVermerk(konto: string, anzahl = 1): void {
    const v = this.vermerke(konto);
    const jetzt = this.uhr();
    for (const [schluessel, vermerk] of v) {
      const aktionLaeuft = vermerk.aktion !== null && laeuft(vermerk.aktion);
      if (jetzt - vermerk.am > BEGLEITER_VERMERK_MINDESTENS_MS && !aktionLaeuft) {
        v.delete(schluessel);
      }
    }
    if (v.size + anzahl > BEGLEITER_AUFTRAEGE_MERKEN_MAX) {
      throw new BegleiterFehler(
        409,
        "zu_viele_auftraege",
        "Zu viele offene Aufträge in kurzer Zeit. Bitte gleich noch einmal versuchen.",
      );
    }
  }

  private vermerkSetzen(konto: string, schluessel: string, vermerk: AuftragsVermerk): void {
    this.vermerke(konto).set(schluessel, vermerk);
  }

  private eintrag(konto: string, instanz: string): AdapterEintrag {
    const e = this.aufraeumen(konto)?.get(instanz);
    if (!e) {
      throw nichtAngemeldet();
    }
    return e;
  }

  /**
   * Ein Dokumentfenster meldet sich an. Eine erneute Anmeldung derselben Kennung (nach einem
   * Neustart des Servers oder einem Verbindungsabbruch) beginnt die Folgenummern von vorn und
   * verwirft die alte Auswahl — sie war in der Zwischenzeit nicht belegt.
   *
   * Nacharbeit 60 (Ben): dieselbe Kennung ist dasselbe geladene Aufgabenfenster (die Kennung
   * entsteht je Verbindung neu) — seine noch laufenden Aktionen bleiben samt Abbruchanforderung
   * erhalten, bis Word ihr Ende meldet. Ein NEUES Fenster verdrängt nur ein Fenster OHNE laufende
   * Aktion; haben alle eine, wird die Anmeldung abgewiesen (409 `zu_viele_fenster`).
   */
  anmelden(konto: string, roh: unknown): { instanz: string; aktivMs: number } {
    const k = objekt(roh, "rumpf");
    const instanz = pruefeInstanz(k.instanz);
    const host = aus(k.host, BEGLEITER_HOSTS, "host");
    const hostFassung = typeof k.hostFassung === "string" ? k.hostFassung.trim() : "";
    if (!HOSTFASSUNG.test(hostFassung)) {
      throw ungueltig("hostFassung", "keine Fassungsangabe");
    }
    const dokument = pruefeDokument(k.dokument);
    // Nacharbeit 64: was das Fenster noch ausführt — vollständig, auch leer. Nur dann gilt sein
    // Bestand als gemeldet (`bestandGemeldet`).
    const laufendGemeldet = k.laufend === undefined ? null : this.laufendLesen(k.laufend);
    const adapter = this.aufraeumen(konto) ?? this.adapterVon(konto);
    if (!adapter.has(instanz) && adapter.size >= BEGLEITER_ADAPTER_MAX) {
      // Das am längsten stille Fenster OHNE laufende Aktion weicht; ein Konto hat nicht beliebig
      // viele Fenster offen. Eines mit laufender Aktion weicht nie (sonst verschwände ihr Stopp).
      let aeltester: AdapterEintrag | null = null;
      for (const e of adapter.values()) {
        if (e.aktionen.some(laeuft)) {
          continue;
        }
        if (aeltester === null || e.zuletztAm < aeltester.zuletztAm) {
          aeltester = e;
        }
      }
      if (!aeltester) {
        throw new BegleiterFehler(
          409,
          "zu_viele_fenster",
          "In allen verbundenen Word-Fenstern läuft gerade eine Aktion. Bitte eine beenden oder stoppen.",
        );
      }
      adapter.delete(aeltester.instanz);
    }
    const jetzt = this.uhr();
    // Dasselbe Fenster meldet sich neu an: seine laufenden Aktionen bleiben (Nacharbeit 60).
    const laufendBisher = adapter.get(instanz)?.aktionen.filter(laeuft) ?? [];
    // Nacharbeit 64 (Ben): meldet das Fenster Aktionen, die dieser Kanal nicht (mehr) kennt — nach
    // einem Serverneustart —, werden sie übernommen: wieder sichtbar, stoppbar, ihr Ende meldbar,
    // und mit Schlüssel wieder klärbar. Neu angelegt wird dadurch nichts (Word führt sie schon aus).
    const uebernehmen = (laufendGemeldet ?? []).filter(
      (l, i, alle) =>
        alle.findIndex((x) => x.id === l.id) === i && !laufendBisher.some((a) => a.id === l.id),
    );
    const mitSchluessel = uebernehmen.filter(
      (l) => l.schluessel && !this.auftraege.get(konto)?.has(l.schluessel),
    );
    if (mitSchluessel.length > 0) {
      this.platzFuerVermerk(konto, mitSchluessel.length);
    }
    const uebernommen: BegleiterAktion[] = uebernehmen.map((l) => ({
      id: l.id,
      art: l.art,
      text: "",
      auswahlStand: 0,
      stand: "uebergeben",
      angelegtAm: jetzt,
      geaendertAm: jetzt,
      ergebnis: null,
      grund: "nach_neustart_uebernommen",
      // Nacharbeit 65 (Ben): ein vom Fenster schon angenommener Abbruch geht nicht verloren — seine
      // spätere `gestoppt`-Endmeldung ist dann berechtigt und wird übernommen.
      abbruchAngefordert: l.abbruch,
      schluessel: l.schluessel,
    }));
    // Dasselbe für schon bekannte Aktionen: meldet das Fenster einen laufenden Abbruch, bleibt er.
    for (const a of laufendBisher) {
      if (laufendGemeldet?.some((l) => l.id === a.id && l.abbruch) && a.stand === "uebergeben") {
        a.abbruchAngefordert = true;
      }
    }
    for (const a of uebernommen) {
      if (a.schluessel && !this.auftraege.get(konto)?.has(a.schluessel)) {
        this.vermerkSetzen(konto, a.schluessel, { instanz, aktion: a, am: jetzt });
      }
    }
    adapter.set(instanz, {
      instanz,
      host,
      hostFassung,
      dokument,
      seq: 0,
      auswahl: null,
      auswahlLaenge: 0,
      auswahlStand: 0,
      angemeldetAm: jetzt,
      zuletztAm: jetzt,
      auswahlAm: 0,
      aktionen: [...laufendBisher, ...uebernommen],
      bestandGemeldet: laufendGemeldet !== null,
    });
    this.konten.set(konto, adapter);
    return { instanz, aktivMs: BEGLEITER_AKTIV_MS };
  }

  /**
   * Nacharbeit 64: `laufend` einer Anmeldung — `[{ id, art, schluessel?, abbruch? }]`, höchstens
   * zehn. `abbruch` (Nacharbeit 65): das Fenster bricht diesen Auftrag bereits ab.
   */
  private laufendLesen(roh: unknown): Array<{
    id: string;
    art: BegleiterAktionArt;
    schluessel: string | null;
    abbruch: boolean;
  }> {
    if (!Array.isArray(roh)) {
      throw ungueltig("laufend", "erwartet eine Liste");
    }
    if (roh.length > 10) {
      throw ungueltig("laufend", "höchstens 10 Einträge");
    }
    return roh.map((eintrag: unknown, i) => {
      const l = objekt(eintrag, `laufend[${i}]`);
      return {
        id: text(l.id, `laufend[${i}].id`, 64, false),
        art: aus(l.art, BEGLEITER_AKTION_ARTEN, `laufend[${i}].art`),
        schluessel:
          l.schluessel === undefined || l.schluessel === null
            ? null
            : pruefeAuftragsschluessel(l.schluessel),
        abbruch: l.abbruch === true,
      };
    });
  }

  /**
   * Die laufende Meldung eines angemeldeten Fensters: Auswahl (oder keine) und Ergebnisse
   * ausgeführter Aktionen. Zurück gehen die Aktionen, die der Adapter jetzt ausführen soll.
   */
  melden(konto: string, instanz: string, roh: unknown): BegleiterMeldeAntwort {
    pruefeInstanz(instanz);
    const k = objekt(roh, "rumpf");
    const e = this.eintrag(konto, instanz);
    const seq = ganzzahl(k.seq, "seq", 1);
    if (seq <= e.seq) {
      throw new BegleiterFehler(
        409,
        "veraltet",
        `Meldung ${seq} ist veraltet; zuletzt angenommen wurde ${e.seq}.`,
      );
    }
    let auswahl: string | null = null;
    let auswahlLaenge = 0;
    let auswahlStand = e.auswahlStand;
    if (k.auswahl !== null && k.auswahl !== undefined) {
      const a = objekt(k.auswahl, "auswahl");
      auswahl = text(a.text, "auswahl.text", BEGLEITER_AUSWAHL_MAX, true);
      auswahlLaenge = ganzzahl(a.laenge, "auswahl.laenge", auswahl.length);
      auswahlStand = ganzzahl(a.stand, "auswahl.stand", 1);
    } else if (k.auswahlStand !== undefined) {
      auswahlStand = ganzzahl(k.auswahlStand, "auswahlStand", 0);
    }
    if (auswahlStand < e.auswahlStand) {
      throw new BegleiterFehler(409, "veraltet", "Der Auswahlstand ist älter als der bekannte.");
    }
    const erledigt = Array.isArray(k.erledigt) ? k.erledigt : [];
    if (erledigt.length > 10) {
      throw ungueltig("erledigt", "höchstens 10 Ergebnisse je Meldung");
    }
    const ergebnisse = erledigt.map((meldung: unknown, i) => {
      const r = objekt(meldung, `erledigt[${i}]`);
      return {
        id: text(r.id, `erledigt[${i}].id`, 64, false),
        stand: aus(r.stand, ERGEBNIS_STAENDE, `erledigt[${i}].stand`),
        ergebnis:
          r.ergebnis === undefined || r.ergebnis === null
            ? null
            : text(r.ergebnis, `erledigt[${i}].ergebnis`, BEGLEITER_ERGEBNIS_MAX, true),
        grund:
          r.grund === undefined || r.grund === null
            ? null
            : text(r.grund, `erledigt[${i}].grund`, 200, true),
      };
    });

    // Erst nach vollständiger Prüfung wird etwas übernommen — eine halbe Meldung gibt es nicht.
    const jetzt = this.uhr();
    e.seq = seq;
    // Nacharbeit 61: ein abgemeldetes Fenster meldet nur noch Ergebnisse nach — es wird dadurch
    // weder wieder aktiv noch bekommt es eine Auswahl oder neue Aufträge.
    if (!e.abgemeldet) {
      e.zuletztAm = jetzt;
      if (auswahlStand !== e.auswahlStand) {
        e.auswahlAm = jetzt;
      }
      e.auswahl = auswahl;
      e.auswahlLaenge = auswahlLaenge;
      e.auswahlStand = auswahlStand;
    }
    const quittiert: string[] = [];
    for (const r of ergebnisse) {
      // Nur eigene, übergebene Aktionen — eine fremde oder schon beendete Kennung bleibt wirkungslos.
      const a = e.aktionen.find((x) => x.id === r.id && x.stand === "uebergeben");
      // „gestoppt“ gilt nur als Antwort auf einen angeforderten Abbruch — sonst bleibt sie übergeben.
      // Nacharbeit 61: oder vom abgemeldeten Fenster selbst, das seine Arbeit beim Trennen beendet.
      if (a && (r.stand !== "gestoppt" || a.abbruchAngefordert || e.abgemeldet)) {
        a.stand = r.stand;
        a.ergebnis = r.ergebnis;
        a.grund = r.grund;
        a.geaendertAm = jetzt;
      }
      // Nacharbeit 63: quittiert ist, was hier nichts mehr offen lässt — übernommen, schon beendet
      // oder unbekannt. Ein ABGEWIESENES Ergebnis einer noch übergebenen Aktion bleibt offen.
      if (!a || a.stand !== "uebergeben") {
        quittiert.push(r.id);
      }
    }
    const auftraege: BegleiterAuftragFuerAdapter[] = [];
    for (const a of e.aktionen) {
      if (a.stand === "offen" && !e.abgemeldet) {
        a.stand = "uebergeben";
        a.geaendertAm = jetzt;
        auftraege.push({
          id: a.id,
          art: a.art,
          text: a.text,
          auswahlStand: a.auswahlStand,
          ...(a.schluessel ? { schluessel: a.schluessel } : {}),
        });
      }
    }
    if (e.abgemeldet && !e.aktionen.some(laeuft)) {
      // Alles Übergebene hat Word beendet gemeldet: jetzt darf das abgemeldete Fenster gehen.
      this.entfernen(konto, instanz);
    }
    const abbrechen = e.aktionen
      .filter((a) => a.stand === "uebergeben" && a.abbruchAngefordert)
      .map((a) => a.id);
    // `abbrechen` nur, wenn es etwas abzubrechen gibt — der bisherige Drahtvertrag bleibt sonst gleich.
    // `quittiert` nur, wenn die Meldung Ergebnisse trug (Nacharbeit 63).
    return {
      aktionen: auftraege,
      ...(abbrechen.length > 0 ? { abbrechen } : {}),
      ...(ergebnisse.length > 0 ? { quittiert } : {}),
    };
  }

  /**
   * Das Fenster schließt (Aufgabenfenster entladen, Begleiter getrennt, Dokumentwechsel).
   *
   * Nacharbeit 61 (Ben): eine nie abgeholte Aktion endet dabei bestätigt ohne Wirkung (`gestoppt`,
   * Word hat sie nie erhalten). Eine an Word ÜBERGEBENE Aktion endet dagegen nicht durch das
   * Abmelden — etwa ein schon angestoßenes Einfügen kann noch abschließen. Solange es eine gibt,
   * bleibt das Fenster als „abgemeldet“ samt Aktion und Stopp stehen, bis sein Ende gemeldet ist
   * (`melden` nimmt die Nachmeldung an) — gelöscht wird erst dann.
   */
  abmelden(konto: string, instanz: string): boolean {
    pruefeInstanz(instanz);
    const e = this.aufraeumen(konto)?.get(instanz);
    if (!e) {
      return false;
    }
    const jetzt = this.uhr();
    for (const a of e.aktionen) {
      if (a.stand === "offen") {
        a.stand = "gestoppt";
        a.grund = "fenster_abgemeldet";
        a.geaendertAm = jetzt;
      }
    }
    if (e.aktionen.some(laeuft)) {
      e.abgemeldet = true;
      e.auswahl = null;
      e.auswahlLaenge = 0;
      return true;
    }
    this.entfernen(konto, instanz);
    return true;
  }

  private entfernen(konto: string, instanz: string): void {
    const adapter = this.konten.get(konto);
    adapter?.delete(instanz);
    if (adapter && adapter.size === 0) {
      this.konten.delete(konto);
    }
  }

  /** Was die Begleitapp sieht — ausschließlich die Fenster DIESES Kontos. */
  kontext(konto: string): BegleiterKontext {
    const adapter = this.aufraeumen(konto);
    const jetzt = this.uhr();
    const liste = adapter ? [...adapter.values()] : [];
    liste.sort((a, b) => b.auswahlAm - a.auswahlAm || b.zuletztAm - a.zuletztAm);
    return {
      jetzt: new Date(jetzt).toISOString(),
      aktivMs: BEGLEITER_AKTIV_MS,
      kanal: this.epoche,
      adapter: liste.map((e) => {
        const aktiv = !e.abgemeldet && jetzt - e.zuletztAm <= BEGLEITER_AKTIV_MS;
        return {
          instanz: e.instanz,
          host: e.host,
          hostFassung: e.hostFassung,
          dokument: { titel: e.dokument.titel, gespeichert: e.dokument.gespeichert },
          aktiv,
          stilleMs: jetzt - e.zuletztAm,
          bestand: e.bestandGemeldet === true,
          auswahl:
            aktiv && e.auswahl !== null
              ? {
                  text: e.auswahl,
                  laenge: e.auswahlLaenge,
                  stand: e.auswahlStand,
                  gekuerzt: e.auswahlLaenge > e.auswahl.length,
                }
              : null,
          aktionen: mitLaufenden(e.aktionen, BEGLEITER_VERLAUF_ANZEIGE_MAX).map((a) => ({
            id: a.id,
            art: a.art,
            stand: a.stand,
            ergebnis: a.ergebnis,
            grund: a.grund,
            // Nur wenn angefordert — der bisherige Drahtvertrag bleibt sonst unverändert.
            ...(a.abbruchAngefordert ? { abbruchAngefordert: true as const } : {}),
          })),
        };
      }),
    };
  }

  /**
   * Die Begleitapp beauftragt eine dokumentbezogene Aktion. Sie geht NUR an einen aktiven Adapter;
   * ein Einfügen nur, wenn die Auswahl dieselbe ist, die die Begleitapp gesehen hat.
   *
   * Nacharbeit 58 (MACG57-POST-GET-01): trägt der Auftrag einen `schluessel`, ist er an ihn
   * gebunden. Derselbe Schlüssel legt nie eine zweite Aktion an (dieselbe kommt zurück), und ein
   * per `klaeren` als „nicht angelegt“ gesperrter Schlüssel legt auch nachträglich nichts mehr an.
   */
  beauftragen(konto: string, instanz: string, roh: unknown): BegleiterAktion {
    pruefeInstanz(instanz);
    const k = objekt(roh, "rumpf");
    const art = aus(k.art, BEGLEITER_AKTION_ARTEN, "art");
    const inhalt = text(k.text, "text", BEGLEITER_AKTION_TEXT_MAX, false);
    const auswahlStand = ganzzahl(k.auswahlStand, "auswahlStand", 0);
    const schluessel = k.schluessel === undefined ? null : pruefeAuftragsschluessel(k.schluessel);
    if (schluessel !== null) {
      const vermerk = this.auftraege.get(konto)?.get(schluessel);
      if (vermerk && vermerk.aktion === null) {
        throw new BegleiterFehler(
          409,
          "geklaert_nicht_angelegt",
          "Dieser Auftrag wurde bereits als nicht angelegt geklärt und wird nicht mehr ausgeführt.",
        );
      }
      if (vermerk?.aktion) {
        if (vermerk.instanz !== instanz) {
          throw new BegleiterFehler(
            409,
            "schluessel_vergeben",
            "Dieser Auftragsschlüssel ist vergeben.",
          );
        }
        return vermerk.aktion;
      }
      // Nacharbeit 59: ohne Vermerk nur, solange der Schlüssel noch frisch ist — so kann ein
      // verspäteter POST nie eine Sperre überleben, die nach Ablauf entfernt wurde.
      this.pruefeAusstellung(k.ausgestelltAm);
      // Nacharbeit 64: nur ein Auftrag, der in DIESER Kanalinstanz ausgestellt wurde — einer aus der
      // Zeit vor einem Neustart wird nie angenommen (seine Klärung wäre sonst nicht mehr belegbar).
      if (k.kanal !== this.epoche) {
        throw new BegleiterFehler(
          409,
          "kanal_neu_gestartet",
          "Klarwerk wurde inzwischen neu gestartet. Der Auftrag wurde nicht angenommen.",
        );
      }
      this.platzFuerVermerk(konto);
    }
    const e = this.eintrag(konto, instanz);
    if (e.abgemeldet) {
      // Nacharbeit 61: ein abgemeldetes Fenster nimmt keine neuen Aufträge an.
      throw nichtAngemeldet();
    }
    const jetzt = this.uhr();
    if (jetzt - e.zuletztAm > BEGLEITER_AKTIV_MS) {
      throw new BegleiterFehler(
        409,
        "adapter_inaktiv",
        "Das Word-Fenster meldet sich gerade nicht. Klara im Word-Fenster öffnen und erneut versuchen.",
      );
    }
    if (art === "einfuegen" && (auswahlStand === 0 || auswahlStand !== e.auswahlStand)) {
      throw new BegleiterFehler(
        409,
        "veraltet",
        "Die Auswahl in Word hat sich geändert. Bitte die aktuelle Auswahl übernehmen.",
      );
    }
    const offen = e.aktionen.filter(laeuft);
    if (offen.length >= BEGLEITER_AKTIONEN_OFFEN_MAX) {
      throw new BegleiterFehler(409, "zu_viele", "Es warten bereits Aktionen auf dieses Fenster.");
    }
    const aktion: BegleiterAktion = {
      id: this.neueId(),
      art,
      text: inhalt,
      auswahlStand,
      stand: "offen",
      angelegtAm: jetzt,
      geaendertAm: jetzt,
      ergebnis: null,
      grund: null,
      abbruchAngefordert: false,
      schluessel,
    };
    e.aktionen.push(aktion);
    // Der Kanal ist kein Verlauf: von den BEENDETEN bleiben nur die jüngsten — laufende alle.
    e.aktionen = mitLaufenden(e.aktionen, BEGLEITER_VERLAUF_MAX);
    if (schluessel !== null) {
      this.vermerkSetzen(konto, schluessel, { instanz, aktion, am: jetzt });
    }
    return aktion;
  }

  /**
   * Nacharbeit 59 (Ben): der Ausstellungszeitpunkt eines Auftrags mit Schlüssel — die Serverzeit
   * des Kontexts, den die Begleitapp gesehen hat. Fehlt er, liegt er in der Zukunft oder ist er
   * älter als `BEGLEITER_SCHLUESSEL_FRIST_MS`, wird nichts angelegt.
   */
  private pruefeAusstellung(roh: unknown): void {
    const am = this.ausstellungLesen(roh);
    if (this.uhr() - am > BEGLEITER_SCHLUESSEL_FRIST_MS) {
      throw new BegleiterFehler(
        409,
        "schluessel_abgelaufen",
        "Dieser Auftrag ist zu alt und wird nicht mehr angenommen. Bitte erneut auslösen.",
      );
    }
  }

  /** Der Ausstellungszeitpunkt als Serverzeit; fehlend oder in der Zukunft ist ungültig (400). */
  private ausstellungLesen(roh: unknown): number {
    const am = typeof roh === "string" ? Date.parse(roh) : Number.NaN;
    if (Number.isNaN(am)) {
      throw ungueltig("ausgestelltAm", "erwartet die Serverzeit des Kontexts");
    }
    if (am > this.uhr()) {
      throw ungueltig("ausgestelltAm", "liegt in der Zukunft");
    }
    return am;
  }

  /**
   * Nacharbeit 58 (Ben, MACG57-POST-GET-01): auftragsbezogene Klärung eines Auftrags, dessen
   * Antwort die Begleitapp nicht lesen konnte. Ein jüngerer leerer Kontextabruf beweist nichts —
   * der ursprüngliche POST kann noch vor dem Anlegen warten (Anmeldung, Space-Abfrage). Diese
   * Klärung ist dagegen ENDGÜLTIG, weil sie im selben synchronen Kanal entscheidet:
   *   · Ist unter dem Schlüssel eine Aktion angelegt: `angenommen` mit genau dieser Aktion.
   *   · Sonst: der Schlüssel wird GESPERRT (`nicht_angelegt`) — kommt der ursprüngliche POST
   *     später an, legt er nichts mehr an (409 `geklaert_nicht_angelegt`).
   * Wiederholbar (gleiches Ergebnis); legt selbst nie eine Aktion an.
   *
   * Nacharbeit 59 (Ben): die Sperre bleibt, bis jeder verspätete POST dieses Schlüssels sicher
   * abgelaufen ist (`BEGLEITER_VERMERK_MINDESTENS_MS`); sie wird nie wegen anderer Schlüssel
   * verdrängt. Ist dafür kein Platz, antwortet die Klärung 409 — die Begleitapp bleibt dann bei
   * „unklar“ und fragt erneut, statt „nicht angelegt“ ohne wirksame Sperre zu melden.
   *
   * Nacharbeit 63 (Ben, MACG62-VERMERK-ENDHISTORIE-01): ein FEHLENDER Vermerk beweist nur dann
   * „nicht angelegt“, wenn ein Vermerk zu diesem Auftrag noch existieren müsste. Dafür trägt die
   * Klärung den Ausstellungszeitpunkt des Auftrags (`rumpf.ausgestelltAm`). Ein Vermerk entsteht
   * nie vor ihm und hält mindestens 2 × Frist; ist der Auftrag höchstens eine Frist alt, wäre ein
   * angenommener also noch vermerkt (auch bei einem Uhrrücksprung bis zu einer Frist). Ist er älter,
   * kann die Annahmehistorie bereinigt sein — dann ehrlich `unbekannt`. Annehmen kann der Kanal ihn
   * dann ohnehin nicht mehr (abgelaufen), und LAUFEN kann dazu nichts: der Vermerk einer laufenden
   * Aktion wird nie bereinigt (Nacharbeit 62).
   *
   * Nacharbeit 64 (Ben): all das gilt nur bei BESTANDSKONTINUITÄT — der Auftrag wurde in DIESER
   * Kanalinstanz ausgestellt (`rumpf.kanal`). Stammt er aus einer früheren (Serverneustart), ist die
   * Historie verloren: weder Nichtannahme noch Ende ist belegt. Dann entscheidet allein das
   * Zielfenster (`rumpf.instanz`), sobald es sich in dieser Instanz mit seinem Bestand angemeldet
   * hat: führt es den Auftrag noch aus, ist er übernommen und vermerkt (oben: `angenommen`);
   * sonst `nicht_laufend` — dazu läuft nichts, ob er je angenommen war, bleibt offen. Hat es sich
   * noch nicht gemeldet: `offen` (weiter fragen). Annehmen kann der Kanal ihn ohnehin nie mehr.
   */
  klaeren(konto: string, roh: unknown, rumpf?: unknown): BegleiterKlaerung {
    const schluessel = pruefeAuftragsschluessel(roh);
    const vermerk = this.auftraege.get(konto)?.get(schluessel);
    if (vermerk?.aktion && vermerk.instanz !== null) {
      return { stand: "angenommen", instanz: vermerk.instanz, aktion: vermerk.aktion };
    }
    if (vermerk) {
      return { stand: "nicht_angelegt" };
    }
    const k = rumpf === undefined || rumpf === null ? {} : objekt(rumpf, "rumpf");
    const ausgestelltAm = this.ausstellungLesen(k.ausgestelltAm);
    if (k.kanal !== this.epoche) {
      const instanz = typeof k.instanz === "string" ? k.instanz : null;
      const fenster = instanz ? this.aufraeumen(konto)?.get(instanz) : undefined;
      return fenster?.bestandGemeldet ? { stand: "nicht_laufend" } : { stand: "offen" };
    }
    if (this.uhr() - ausgestelltAm > BEGLEITER_SCHLUESSEL_FRIST_MS) {
      return { stand: "unbekannt" };
    }
    this.platzFuerVermerk(konto);
    this.vermerkSetzen(konto, schluessel, { instanz: null, aktion: null, am: this.uhr() });
    return { stand: "nicht_angelegt" };
  }

  /**
   * produkt:20261011:assistenz-minimalistische-oberflaeche (UI-MIN-06/14): die Begleitapp stoppt
   * eine eigene Aktion.
   *   · `offen`: sofort `gestoppt` — das Word-Fenster holt sie nie ab (`melden` übergibt nur `offen`).
   *   · `uebergeben` (Nacharbeit 7): der Abbruch wird ANGEFORDERT und mit jeder Meldung an das
   *     ausführende Word-Fenster weitergereicht (`abbrechen`). Die Aktion bleibt `uebergeben`, bis
   *     Word ihr Ende meldet: `gestoppt` (abgebrochen, keine weitere Wirkung) oder — war sie schon
   *     fertig — `erledigt`. Eine bereits ausgeführte Einfügung wird dadurch NICHT zurückgenommen;
   *     das kann nur Word selbst (Rückgängig). Der Kanal behauptet keinen Stopp, den Word nicht
   *     bestätigt hat; ohne Antwort verfällt sie nach der Frist.
   *   · beendet: unverändert zurück.
   */
  stoppen(konto: string, instanz: string, aktionId: string): BegleiterAktion {
    pruefeInstanz(instanz);
    const id = text(aktionId, "aktion", 64, false);
    const e = this.eintrag(konto, instanz);
    const a = e.aktionen.find((x) => x.id === id);
    if (!a) {
      throw new BegleiterFehler(404, "unbekannt", "Diese Aktion gibt es für dieses Fenster nicht.");
    }
    if (a.stand === "uebergeben") {
      if (!a.abbruchAngefordert) {
        a.abbruchAngefordert = true;
        a.geaendertAm = this.uhr();
      }
      return a;
    }
    if (a.stand === "offen") {
      a.stand = "gestoppt";
      a.geaendertAm = this.uhr();
    }
    return a;
  }
}
