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

const INSTANZ = /^bgl-[0-9a-f]{32}$/;
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

/** Was der Adapter über eine ausgeführte Aktion meldet. */
const ERGEBNIS_STAENDE = ["erledigt", "abgelehnt", "fehler"] as const;
type ErgebnisStand = (typeof ERGEBNIS_STAENDE)[number];

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
  /** Nur bei einem AKTIVEN Adapter — sonst `null`, auch wenn früher eine Auswahl bekannt war. */
  auswahl: { text: string; laenge: number; stand: number; gekuerzt: boolean } | null;
  aktionen: Array<{
    id: string;
    art: BegleiterAktionArt;
    stand: BegleiterAktionStand;
    ergebnis: string | null;
    grund: string | null;
  }>;
}

export interface BegleiterKontext {
  jetzt: string;
  aktivMs: number;
  adapter: BegleiterAdapterSicht[];
}

/** Was der Adapter mit seiner Meldung zurückbekommt: die Aktionen, die er jetzt ausführen soll. */
export interface BegleiterAuftragFuerAdapter {
  id: string;
  art: BegleiterAktionArt;
  text: string;
  auswahlStand: number;
}

export interface BegleiterMeldeAntwort {
  aktionen: BegleiterAuftragFuerAdapter[];
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

  constructor(
    private readonly uhr: () => number = Date.now,
    private readonly neueId: () => string = randomUUID,
  ) {}

  private adapterVon(konto: string): Map<string, AdapterEintrag> {
    let adapter = this.konten.get(konto);
    if (!adapter) {
      adapter = new Map();
      this.konten.set(konto, adapter);
    }
    return adapter;
  }

  /** Vergisst abgelaufene Adapter und lässt unbeantwortete Aktionen verfallen. */
  private aufraeumen(konto: string): Map<string, AdapterEintrag> | undefined {
    const adapter = this.konten.get(konto);
    if (!adapter) {
      return undefined;
    }
    const jetzt = this.uhr();
    for (const [instanz, e] of adapter) {
      if (jetzt - e.zuletztAm > BEGLEITER_ABLAUF_MS) {
        adapter.delete(instanz);
        continue;
      }
      for (const a of e.aktionen) {
        if (
          (a.stand === "offen" || a.stand === "uebergeben") &&
          jetzt - a.angelegtAm > BEGLEITER_AKTION_FRIST_MS
        ) {
          a.stand = "verfallen";
          a.geaendertAm = jetzt;
        }
      }
    }
    if (adapter.size === 0) {
      this.konten.delete(konto);
      return undefined;
    }
    return adapter;
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
    const adapter = this.aufraeumen(konto) ?? this.adapterVon(konto);
    if (!adapter.has(instanz) && adapter.size >= BEGLEITER_ADAPTER_MAX) {
      // Das am längsten stille Fenster weicht; ein Konto hat nicht beliebig viele Fenster offen.
      let aeltester: AdapterEintrag | null = null;
      for (const e of adapter.values()) {
        if (aeltester === null || e.zuletztAm < aeltester.zuletztAm) {
          aeltester = e;
        }
      }
      if (aeltester) {
        adapter.delete(aeltester.instanz);
      }
    }
    const jetzt = this.uhr();
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
      aktionen: [],
    });
    this.konten.set(konto, adapter);
    return { instanz, aktivMs: BEGLEITER_AKTIV_MS };
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
    e.zuletztAm = jetzt;
    if (auswahlStand !== e.auswahlStand) {
      e.auswahlAm = jetzt;
    }
    e.auswahl = auswahl;
    e.auswahlLaenge = auswahlLaenge;
    e.auswahlStand = auswahlStand;
    for (const r of ergebnisse) {
      // Nur eigene, übergebene Aktionen — eine fremde oder schon beendete Kennung bleibt wirkungslos.
      const a = e.aktionen.find((x) => x.id === r.id && x.stand === "uebergeben");
      if (a) {
        a.stand = r.stand;
        a.ergebnis = r.ergebnis;
        a.grund = r.grund;
        a.geaendertAm = jetzt;
      }
    }
    const auftraege: BegleiterAuftragFuerAdapter[] = [];
    for (const a of e.aktionen) {
      if (a.stand === "offen") {
        a.stand = "uebergeben";
        a.geaendertAm = jetzt;
        auftraege.push({ id: a.id, art: a.art, text: a.text, auswahlStand: a.auswahlStand });
      }
    }
    return { aktionen: auftraege };
  }

  /** Das Fenster schließt (Aufgabenfenster entladen, Begleiter getrennt). */
  abmelden(konto: string, instanz: string): boolean {
    pruefeInstanz(instanz);
    const adapter = this.aufraeumen(konto);
    const geloescht = adapter?.delete(instanz) ?? false;
    if (adapter && adapter.size === 0) {
      this.konten.delete(konto);
    }
    return geloescht;
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
      adapter: liste.map((e) => {
        const aktiv = jetzt - e.zuletztAm <= BEGLEITER_AKTIV_MS;
        return {
          instanz: e.instanz,
          host: e.host,
          hostFassung: e.hostFassung,
          dokument: { titel: e.dokument.titel, gespeichert: e.dokument.gespeichert },
          aktiv,
          stilleMs: jetzt - e.zuletztAm,
          auswahl:
            aktiv && e.auswahl !== null
              ? {
                  text: e.auswahl,
                  laenge: e.auswahlLaenge,
                  stand: e.auswahlStand,
                  gekuerzt: e.auswahlLaenge > e.auswahl.length,
                }
              : null,
          aktionen: e.aktionen.slice(-5).map((a) => ({
            id: a.id,
            art: a.art,
            stand: a.stand,
            ergebnis: a.ergebnis,
            grund: a.grund,
          })),
        };
      }),
    };
  }

  /**
   * Die Begleitapp beauftragt eine dokumentbezogene Aktion. Sie geht NUR an einen aktiven Adapter;
   * ein Einfügen nur, wenn die Auswahl dieselbe ist, die die Begleitapp gesehen hat.
   */
  beauftragen(konto: string, instanz: string, roh: unknown): BegleiterAktion {
    pruefeInstanz(instanz);
    const k = objekt(roh, "rumpf");
    const art = aus(k.art, BEGLEITER_AKTION_ARTEN, "art");
    const inhalt = text(k.text, "text", BEGLEITER_AKTION_TEXT_MAX, false);
    const auswahlStand = ganzzahl(k.auswahlStand, "auswahlStand", 0);
    const e = this.eintrag(konto, instanz);
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
    const offen = e.aktionen.filter((a) => a.stand === "offen" || a.stand === "uebergeben");
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
    };
    e.aktionen.push(aktion);
    // Nur die jüngsten Einträge bleiben — der Kanal ist kein Verlauf.
    if (e.aktionen.length > 10) {
      e.aktionen = e.aktionen.slice(-10);
    }
    return aktion;
  }
}
