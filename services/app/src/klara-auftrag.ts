// ================================================================================================
// produkt:20261008:klara-aktionen (Klara 05, AW-10) — DIE AUFTRAGSGRENZE AUSSERHALB DES SPRACHMODELLS.
// ================================================================================================
//
// „Persistentes Ziel mit erlaubten Quellen, Werkzeugen, Handlungen, Verantwortlichem und
// Ergebnisanforderung führen. Produktlogik prüft jeden Schritt, Umfangserweiterung bleibt eigener
// Auftrag." (AW-10.) Diese Datei ist genau diese Produktlogik — rein, ohne Ablage und ohne Netz. Sie
// wird vom Gesprächsdienst (`klara-gespraech.ts`) unter dem Standvergleich des eigenen Gesprächs
// angewandt; ein Auftrag gehört damit genau dem Konto, dem das Gespräch gehört.
//
// WAS HIER ENTSCHIEDEN WIRD — und was nicht:
//   · Ein Auftrag trägt seine GRENZE in Fassungen: erlaubte Aktionen, erlaubte Ziele, erlaubte
//     Quellen, Ergebnisanforderung, geplante Schrittzahl. Eine Korrektur schreibt eine neue Fassung
//     und darf die Grenze nur ENGER machen; eine Erweiterung wird abgewiesen (eigener Auftrag).
//   · Jeder Schritt wird beim Beginn gegen die AKTUELLE Fassung geprüft: Aktion erlaubt, Ziel
//     erlaubt (oder Ergebnis eines früheren Schritts desselben Auftrags), Auftrag nicht abgebrochen,
//     Fassung nicht veraltet. Teilaufgaben erben damit dieselbe Grenze.
//   · Ein Schritt hat einen Wiederholschlüssel: derselbe Schlüssel ist derselbe Schritt. Eine
//     Wiederholung nach Verbindungsabbruch legt keinen zweiten an und meldet `wiederholt`.
//   · Abbrechen verhindert jeden WEITEREN Schritt. Was schon lief, darf sein tatsächliches Ergebnis
//     noch melden, und Gespeichertes bleibt sichtbar — nichts wird still zurückgenommen.
//   · Rückgängig ist ein eigener Übergang (`zurueckgenommen`), nur für einen gespeicherten Schritt,
//     der als rücknehmbar gemeldet wurde.
//
// BEWUSST NICHT HIER: Rechte am Ziel und dessen Fassung. Die prüft der vorhandene Ausführungsweg
// selbst (`/api/drafts`, `/api/kos/:id`, `requirePermission`, `expectedUpdatedAt`) — kein zweites
// Rechtesystem. Diese Grenze kann eine Handlung nur VERHINDERN, nie erlauben, was der Produktweg
// verbietet. Es gibt auch kein Ablaufdatum als Ersatz für diese Prüfung: geprüft wird je Schritt.

export const KLARA_AKTIONEN = [
  "oeffnen",
  "entwurf_erstellen",
  "entwurf_bearbeiten",
  "aufgabe_bearbeiten",
] as const;
export type KlaraAktion = (typeof KLARA_AKTIONEN)[number];

export const KLARA_ZIELARTEN = ["wissensobjekt", "entwurf", "aufgabe", "neuer_entwurf"] as const;
export type KlaraZielArt = (typeof KLARA_ZIELARTEN)[number];

const ERGEBNISARTEN = ["wissensobjekt", "entwurf", "aufgabe"] as const;
type KlaraErgebnisArt = (typeof ERGEBNISARTEN)[number];

export const KLARA_QUELLEN_DES_AUFTRAGS = ["getippt", "gesprochen"] as const;
export type KlaraAuftragsQuelle = (typeof KLARA_QUELLEN_DES_AUFTRAGS)[number];

export type KlaraAuftragStand =
  | "vorgeschlagen"
  | "laeuft"
  | "abgeschlossen"
  | "teilweise"
  | "fehlgeschlagen"
  | "abgebrochen";

export const KLARA_SCHRITT_STAENDE = [
  "begonnen",
  "gespeichert",
  "abgeschlossen",
  "fehlgeschlagen",
  "zurueckgenommen",
] as const;
export type KlaraAuftragSchrittStand = (typeof KLARA_SCHRITT_STAENDE)[number];

/** Ein Ziel, wie die Person es auf dem Bildschirm gewählt hat. `neuer_entwurf` hat noch keine Kennung. */
export interface KlaraAuftragZiel {
  readonly art: KlaraZielArt;
  readonly id: string | null;
  readonly titel: string;
  /** Der beim Planen gesehene Stand (Fassung bzw. Änderungszeit) — Anzeige, keine Erlaubnis. */
  readonly stand: string | null;
  /** Wo das Ziel in der Anwendung steht (interner Pfad), sofern es schon eines gibt. */
  readonly pfad: string | null;
}

/** Was ein Schritt tatsächlich hervorgebracht hat — am Server nachgelesen, bevor es hier steht. */
export interface KlaraAuftragErgebnis {
  readonly art: KlaraErgebnisArt;
  readonly id: string;
  readonly titel: string;
  readonly stand: string | null;
  readonly pfad: string;
}

export interface KlaraAuftragSchritt {
  readonly schluessel: string;
  readonly nr: number;
  readonly aktion: KlaraAktion;
  readonly ziel: KlaraAuftragZiel;
  /** Die Fassung der Grenze, unter der der Schritt begonnen wurde. */
  readonly auftragFassung: number;
  readonly stand: KlaraAuftragSchrittStand;
  readonly ergebnis: KlaraAuftragErgebnis | null;
  readonly ruecknehmbar: boolean;
  /** Bei `fehlgeschlagen`: der tatsächliche Grund in Worten. */
  readonly grund: string | null;
  readonly begonnenAm: string;
  readonly geaendertAm: string;
}

/** Eine Fassung der Grenze. Die aktuelle steht am Auftrag selbst, frühere in `fassungen`. */
export interface KlaraAuftragGrenze {
  readonly fassung: number;
  readonly erlaubteAktionen: readonly KlaraAktion[];
  readonly erlaubteZiele: readonly KlaraAuftragZiel[];
  readonly erlaubteQuellen: readonly string[];
  readonly ergebnis: string;
  readonly geplanteSchritte: number;
  /** Warum diese Fassung entstand (Korrektur) — bei Fassung 1 `null`. */
  readonly grund: string | null;
  readonly am: string;
}

export type KlaraAuftragEreignis =
  | "vorgeschlagen"
  | "begonnen"
  | "gespeichert"
  | "abgeschlossen"
  | "fehlgeschlagen"
  | "zurueckgenommen"
  | "abgebrochen"
  | "korrigiert"
  | "auftrag_abgeschlossen";

export interface KlaraAuftragVerlaufseintrag {
  readonly ereignis: KlaraAuftragEreignis;
  readonly am: string;
  readonly nr: number | null;
  readonly fassung: number;
}

export interface KlaraAuftrag extends KlaraAuftragGrenze {
  readonly id: string;
  readonly quelle: KlaraAuftragsQuelle;
  /** Der Auftrag in den Worten der Person (getippt oder gesprochen und korrigiert). */
  readonly wortlaut: string;
  /** Kurzbeschreibung des Ziels („Entwurf „Wartung“ anlegen“). */
  readonly ziel: string;
  /** Die verantwortliche Person — immer das Konto, das den Auftrag gab. */
  readonly verantwortlich: string;
  readonly stand: KlaraAuftragStand;
  readonly abgebrochenAm: string | null;
  readonly schritte: readonly KlaraAuftragSchritt[];
  /** Frühere Fassungen der Grenze, älteste zuerst. */
  readonly fassungen: readonly KlaraAuftragGrenze[];
  readonly verlauf: readonly KlaraAuftragVerlaufseintrag[];
  readonly angelegtAm: string;
  readonly geaendertAm: string;
}

export const KLARA_AUFTRAEGE_JE_GESPRAECH = 20;
export const KLARA_AUFTRAG_MAX_SCHRITTE = 20;
const MAX_ZIELE = 10;
const MAX_QUELLEN = 10;
const MAX_VERLAUF = 200;

export type KlaraAuftragGrund =
  | "eingabe"
  | "auftrag_unbekannt"
  | "abgebrochen"
  | "abgeschlossen"
  | "fassung_veraltet"
  | "ausserhalb_auftrag"
  | "erweiterung"
  | "uebergang"
  | "schluessel_belegt"
  | "voll";

export class KlaraAuftragFehler extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    readonly grund: KlaraAuftragGrund,
    message: string,
  ) {
    super(message);
    this.name = "KlaraAuftragFehler";
  }
}

function eingabeFehler(message: string): KlaraAuftragFehler {
  return new KlaraAuftragFehler(400, "eingabe", message);
}

// ------------------------------------------------------------------------------------------------
// Prüfung der Eingaben aus dem Netz — nur bekannte Felder, jedes begrenzt.
// ------------------------------------------------------------------------------------------------

function text(wert: unknown, max: number, feld: string): string {
  if (typeof wert !== "string" || wert.trim().length === 0 || wert.length > max) {
    throw eingabeFehler(`${feld} ist Pflicht und höchstens ${max} Zeichen lang.`);
  }
  return wert.trim();
}

function wahlweiseText(wert: unknown, max: number, feld: string): string | null {
  if (wert === undefined || wert === null) {
    return null;
  }
  return text(wert, max, feld);
}

function wahl<T extends string>(wert: unknown, erlaubt: readonly T[], feld: string): T {
  if (typeof wert !== "string" || !(erlaubt as readonly string[]).includes(wert)) {
    throw eingabeFehler(`${feld} muss einer der Werte ${erlaubt.join(", ")} sein.`);
  }
  return wert as T;
}

function ganzzahl(wert: unknown, min: number, max: number, feld: string): number {
  if (typeof wert !== "number" || !Number.isSafeInteger(wert) || wert < min || wert > max) {
    throw eingabeFehler(`${feld} muss eine ganze Zahl von ${min} bis ${max} sein.`);
  }
  return wert;
}

/** Dieselbe Regel wie `internerPfad` der Oberfläche und `pruefeObjektbezug`: nur eigene Adressen. */
function internerPfad(wert: unknown, feld: string): string {
  const pfad = text(wert, 300, feld);
  // biome-ignore lint/suspicious/noControlCharactersInRegex: genau diese Zeichen werden abgewiesen.
  if (!pfad.startsWith("/") || pfad.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(pfad)) {
    throw eingabeFehler(`${feld} muss eine Adresse dieser Anwendung sein.`);
  }
  return pfad;
}

function objekt(roh: unknown, feld: string): Record<string, unknown> {
  if (typeof roh !== "object" || roh === null || Array.isArray(roh)) {
    throw eingabeFehler(`${feld} fehlt.`);
  }
  return roh as Record<string, unknown>;
}

export function pruefeZiel(roh: unknown, feld = "ziel"): KlaraAuftragZiel {
  const o = objekt(roh, feld);
  const art = wahl(o.art, KLARA_ZIELARTEN, `${feld}.art`);
  const id = wahlweiseText(o.id, 200, `${feld}.id`);
  if (art === "neuer_entwurf" ? id !== null : id === null) {
    throw eingabeFehler(
      art === "neuer_entwurf"
        ? `${feld}.id gibt es bei einem neuen Entwurf noch nicht.`
        : `${feld}.id ist Pflicht.`,
    );
  }
  return {
    art,
    id,
    titel: text(o.titel, 300, `${feld}.titel`),
    stand: wahlweiseText(o.stand, 100, `${feld}.stand`),
    pfad: o.pfad === undefined || o.pfad === null ? null : internerPfad(o.pfad, `${feld}.pfad`),
  };
}

function pruefeErgebnis(roh: unknown): KlaraAuftragErgebnis {
  const o = objekt(roh, "ergebnis");
  return {
    art: wahl(o.art, ERGEBNISARTEN, "ergebnis.art"),
    id: text(o.id, 200, "ergebnis.id"),
    titel: text(o.titel, 300, "ergebnis.titel"),
    stand: wahlweiseText(o.stand, 100, "ergebnis.stand"),
    pfad: internerPfad(o.pfad, "ergebnis.pfad"),
  };
}

function liste<T>(roh: unknown, max: number, feld: string, f: (x: unknown, i: number) => T): T[] {
  if (!Array.isArray(roh) || roh.length === 0 || roh.length > max) {
    throw eingabeFehler(`${feld}: mindestens ein und höchstens ${max} Einträge.`);
  }
  return roh.map(f);
}

function aktionen(roh: unknown): KlaraAktion[] {
  const werte = liste(roh, KLARA_AKTIONEN.length, "erlaubteAktionen", (x, i) =>
    wahl(x, KLARA_AKTIONEN, `erlaubteAktionen[${i}]`),
  );
  return [...new Set(werte)];
}

function ziele(roh: unknown): KlaraAuftragZiel[] {
  return liste(roh, MAX_ZIELE, "erlaubteZiele", (x, i) => pruefeZiel(x, `erlaubteZiele[${i}]`));
}

function quellen(roh: unknown): string[] {
  const werte = liste(roh, MAX_QUELLEN, "erlaubteQuellen", (x, i) =>
    text(x, 200, `erlaubteQuellen[${i}]`),
  );
  return [...new Set(werte)];
}

// ------------------------------------------------------------------------------------------------
// Regeln.
// ------------------------------------------------------------------------------------------------

/** Dasselbe Ziel: gleiche Art und gleiche Kennung — ein neuer Entwurf über seinen Titel. */
function gleichesZiel(a: KlaraAuftragZiel, b: KlaraAuftragZiel): boolean {
  if (a.art !== b.art) {
    return false;
  }
  return a.id === null && b.id === null ? a.titel === b.titel : a.id === b.id;
}

/**
 * Ist das Ziel innerhalb der Grenze? Entweder steht es unter den erlaubten Zielen, oder es ist das
 * Ergebnis eines früheren Schritts DESSELBEN Auftrags (der eben angelegte Entwurf darf geöffnet
 * werden) — eine Teilaufgabe erbt die Grenze, sie erweitert sie nicht.
 */
function zielErlaubt(a: KlaraAuftrag, ziel: KlaraAuftragZiel): boolean {
  if (a.erlaubteZiele.some((z) => gleichesZiel(z, ziel))) {
    return true;
  }
  return (
    ziel.id !== null &&
    a.schritte.some(
      (s) =>
        s.ergebnis !== null &&
        s.ergebnis.art === ziel.art &&
        s.ergebnis.id === ziel.id &&
        (s.stand === "gespeichert" || s.stand === "abgeschlossen"),
    )
  );
}

const ENDSTAENDE: readonly KlaraAuftragSchrittStand[] = [
  "gespeichert",
  "abgeschlossen",
  "fehlgeschlagen",
  "zurueckgenommen",
];

/** Der Stand des Auftrags folgt aus seinen Schritten — nie aus einer Behauptung des Browsers. */
export function auftragsStand(a: KlaraAuftrag): KlaraAuftragStand {
  if (a.abgebrochenAm) {
    return "abgebrochen";
  }
  if (a.schritte.length === 0) {
    return "vorgeschlagen";
  }
  if (a.schritte.some((s) => s.stand === "begonnen")) {
    return "laeuft";
  }
  const fertig = a.schritte.filter((s) => ENDSTAENDE.includes(s.stand));
  if (fertig.length < a.geplanteSchritte) {
    return "laeuft";
  }
  const gescheitert = fertig.filter((s) => s.stand === "fehlgeschlagen").length;
  if (gescheitert === 0) {
    return "abgeschlossen";
  }
  return gescheitert === fertig.length ? "fehlgeschlagen" : "teilweise";
}

function mitVerlauf(
  a: KlaraAuftrag,
  ereignis: KlaraAuftragEreignis,
  am: string,
  nr: number | null,
): KlaraAuftrag {
  const eintrag: KlaraAuftragVerlaufseintrag = { ereignis, am, nr, fassung: a.fassung };
  return { ...a, verlauf: [...a.verlauf, eintrag].slice(-MAX_VERLAUF) };
}

/** Stand neu ableiten; wird der Auftrag dabei abgeschlossen, steht das im Verlauf. */
function abgeleitet(a: KlaraAuftrag, jetzt: string): KlaraAuftrag {
  const stand = auftragsStand(a);
  const neu: KlaraAuftrag = { ...a, stand, geaendertAm: jetzt };
  return stand === "abgeschlossen" && a.stand !== "abgeschlossen"
    ? mitVerlauf(neu, "auftrag_abgeschlossen", jetzt, null)
    : neu;
}

function grenzeAus(a: KlaraAuftrag): KlaraAuftragGrenze {
  return {
    fassung: a.fassung,
    erlaubteAktionen: a.erlaubteAktionen,
    erlaubteZiele: a.erlaubteZiele,
    erlaubteQuellen: a.erlaubteQuellen,
    ergebnis: a.ergebnis,
    geplanteSchritte: a.geplanteSchritte,
    grund: a.grund,
    am: a.am,
  };
}

// ------------------------------------------------------------------------------------------------
// Die vier Übergänge — rein: alter Auftrag (oder Liste) hinein, neuer heraus.
// ------------------------------------------------------------------------------------------------

export interface KlaraAuftragEingabe {
  quelle?: unknown;
  wortlaut?: unknown;
  ziel?: unknown;
  erlaubteAktionen?: unknown;
  erlaubteZiele?: unknown;
  erlaubteQuellen?: unknown;
  ergebnis?: unknown;
  geplanteSchritte?: unknown;
}

export function neuerAuftrag(
  eingabe: KlaraAuftragEingabe,
  verantwortlich: string,
  id: string,
  jetzt: string,
): KlaraAuftrag {
  const a: KlaraAuftrag = {
    id,
    quelle: wahl(eingabe.quelle, KLARA_QUELLEN_DES_AUFTRAGS, "quelle"),
    wortlaut: text(eingabe.wortlaut, 2_000, "wortlaut"),
    ziel: text(eingabe.ziel, 600, "ziel"),
    verantwortlich,
    fassung: 1,
    erlaubteAktionen: aktionen(eingabe.erlaubteAktionen),
    erlaubteZiele: ziele(eingabe.erlaubteZiele),
    erlaubteQuellen: quellen(eingabe.erlaubteQuellen),
    ergebnis: text(eingabe.ergebnis, 600, "ergebnis"),
    geplanteSchritte: ganzzahl(
      eingabe.geplanteSchritte,
      1,
      KLARA_AUFTRAG_MAX_SCHRITTE,
      "geplanteSchritte",
    ),
    grund: null,
    am: jetzt,
    stand: "vorgeschlagen",
    abgebrochenAm: null,
    schritte: [],
    fassungen: [],
    verlauf: [],
    angelegtAm: jetzt,
    geaendertAm: jetzt,
  };
  return mitVerlauf(a, "vorgeschlagen", jetzt, null);
}

/**
 * Legt den Auftrag zu den vorhandenen. Ist das Gespräch voll, weichen die ältesten ABGESCHLOSSENEN
 * Aufträge; ein laufender wird nie still entfernt.
 */
export function mitNeuemAuftrag(
  vorhanden: readonly KlaraAuftrag[],
  neu: KlaraAuftrag,
): KlaraAuftrag[] {
  const alle = [...vorhanden];
  while (alle.length >= KLARA_AUFTRAEGE_JE_GESPRAECH) {
    const i = alle.findIndex((a) => a.stand !== "laeuft" && a.stand !== "vorgeschlagen");
    if (i < 0) {
      throw new KlaraAuftragFehler(
        409,
        "voll",
        `Es laufen bereits ${KLARA_AUFTRAEGE_JE_GESPRAECH} Aufträge in diesem Gespräch. Bitte einen beenden oder abbrechen.`,
      );
    }
    alle.splice(i, 1);
  }
  return [...alle, neu];
}

export interface KlaraKorrekturEingabe {
  erlaubteAktionen?: unknown;
  erlaubteZiele?: unknown;
  erlaubteQuellen?: unknown;
  ergebnis?: unknown;
  geplanteSchritte?: unknown;
  grund?: unknown;
}

/**
 * Eine Korrektur schreibt eine NEUE Fassung der Grenze. Sie darf nur einschränken: jede Aktion, jedes
 * Ziel und jede Quelle muss schon in der bisherigen Fassung stehen. Was schon geschehen ist, bleibt
 * in den Schritten stehen — eine Korrektur nimmt nichts zurück.
 */
export function korrigiere(
  a: KlaraAuftrag,
  eingabe: KlaraKorrekturEingabe,
  jetzt: string,
): KlaraAuftrag {
  if (a.abgebrochenAm) {
    throw new KlaraAuftragFehler(
      409,
      "abgebrochen",
      "Der Auftrag ist abgebrochen. Für weitere Schritte bitte einen neuen Auftrag geben.",
    );
  }
  if (a.stand === "abgeschlossen" || a.stand === "teilweise" || a.stand === "fehlgeschlagen") {
    throw new KlaraAuftragFehler(
      409,
      "abgeschlossen",
      "Der Auftrag ist bereits beendet – eine neue Grenze wäre ein neuer Auftrag.",
    );
  }
  const neueAktionen = aktionen(eingabe.erlaubteAktionen);
  const neueZiele = ziele(eingabe.erlaubteZiele);
  const neueQuellen =
    eingabe.erlaubteQuellen === undefined
      ? [...a.erlaubteQuellen]
      : quellen(eingabe.erlaubteQuellen);
  const erweitert =
    neueAktionen.some((x) => !a.erlaubteAktionen.includes(x)) ||
    neueZiele.some((z) => !a.erlaubteZiele.some((alt) => gleichesZiel(alt, z))) ||
    neueQuellen.some((q) => !a.erlaubteQuellen.includes(q));
  const geplant =
    eingabe.geplanteSchritte === undefined
      ? a.geplanteSchritte
      : ganzzahl(eingabe.geplanteSchritte, 0, KLARA_AUFTRAG_MAX_SCHRITTE, "geplanteSchritte");
  if (erweitert || geplant > a.geplanteSchritte) {
    throw new KlaraAuftragFehler(
      409,
      "erweiterung",
      "Eine Korrektur darf die Befugnis nicht erweitern. Mehr Aktionen, Ziele oder Quellen sind ein eigener Auftrag – die bisherige Grenze gilt weiter.",
    );
  }
  // Was schon begonnen wurde, ist geschehen: die geplante Zahl kann nicht darunter fallen.
  const geschehen = a.schritte.length;
  const korrigiert: KlaraAuftrag = {
    ...a,
    fassungen: [...a.fassungen, grenzeAus(a)],
    fassung: a.fassung + 1,
    erlaubteAktionen: neueAktionen,
    erlaubteZiele: neueZiele,
    erlaubteQuellen: neueQuellen,
    ergebnis: eingabe.ergebnis === undefined ? a.ergebnis : text(eingabe.ergebnis, 600, "ergebnis"),
    geplanteSchritte: Math.max(geplant, geschehen),
    grund: text(eingabe.grund, 300, "grund"),
    am: jetzt,
  };
  return abgeleitet(mitVerlauf(korrigiert, "korrigiert", jetzt, null), jetzt);
}

export interface KlaraSchrittEingabe {
  nr?: unknown;
  aktion?: unknown;
  ziel?: unknown;
  auftragFassung?: unknown;
  stand?: unknown;
  ergebnis?: unknown;
  ruecknehmbar?: unknown;
  grund?: unknown;
}

type Uebergaenge = Readonly<Record<KlaraAuftragSchrittStand, readonly KlaraAuftragSchrittStand[]>>;

const UEBERGAENGE: Uebergaenge = {
  begonnen: ["gespeichert", "abgeschlossen", "fehlgeschlagen"],
  gespeichert: ["abgeschlossen", "zurueckgenommen"],
  abgeschlossen: ["zurueckgenommen"],
  fehlgeschlagen: [],
  zurueckgenommen: [],
};

const SCHLUESSEL = /^[A-Za-z0-9_-]{1,100}$/;

/**
 * Beginnt einen Schritt oder meldet sein Ergebnis. Derselbe Schlüssel mit demselben Stand ist eine
 * Wiederholung (z. B. nach Verbindungsabbruch): nichts ändert sich, `wiederholt` ist `true`.
 */
export function setzeSchritt(
  a: KlaraAuftrag,
  schluessel: string,
  eingabe: KlaraSchrittEingabe,
  jetzt: string,
): { auftrag: KlaraAuftrag; schritt: KlaraAuftragSchritt; wiederholt: boolean } {
  if (!SCHLUESSEL.test(schluessel)) {
    throw eingabeFehler(
      "Der Schrittschlüssel besteht aus höchstens 100 Buchstaben, Ziffern, - und _.",
    );
  }
  const aktion = wahl(eingabe.aktion, KLARA_AKTIONEN, "aktion");
  const ziel = pruefeZiel(eingabe.ziel);
  const stand = wahl(eingabe.stand, KLARA_SCHRITT_STAENDE, "stand");
  const vorhanden = a.schritte.find((s) => s.schluessel === schluessel);

  if (!vorhanden) {
    if (stand !== "begonnen") {
      throw new KlaraAuftragFehler(409, "uebergang", "Ein Schritt muss zuerst begonnen werden.");
    }
    if (a.abgebrochenAm) {
      throw new KlaraAuftragFehler(
        409,
        "abgebrochen",
        "Der Auftrag wurde abgebrochen – es beginnt kein weiterer Schritt.",
      );
    }
    if (a.stand === "abgeschlossen") {
      throw new KlaraAuftragFehler(409, "abgeschlossen", "Der Auftrag ist bereits abgeschlossen.");
    }
    const fassung = ganzzahl(eingabe.auftragFassung, 1, Number.MAX_SAFE_INTEGER, "auftragFassung");
    if (fassung !== a.fassung) {
      throw new KlaraAuftragFehler(
        409,
        "fassung_veraltet",
        `Der Auftrag wurde inzwischen korrigiert (jetzt Fassung ${a.fassung}). Der Schritt beginnt nicht unter der alten Grenze.`,
      );
    }
    if (!a.erlaubteAktionen.includes(aktion) || !zielErlaubt(a, ziel)) {
      throw new KlaraAuftragFehler(
        409,
        "ausserhalb_auftrag",
        "Dieser Schritt liegt ausserhalb der Grenze des Auftrags und wird nicht ausgeführt.",
      );
    }
    if (a.schritte.length >= Math.min(a.geplanteSchritte, KLARA_AUFTRAG_MAX_SCHRITTE)) {
      throw new KlaraAuftragFehler(
        409,
        "ausserhalb_auftrag",
        "Der Auftrag hat keine weiteren geplanten Schritte.",
      );
    }
    const schritt: KlaraAuftragSchritt = {
      schluessel,
      nr: ganzzahl(eingabe.nr, 1, KLARA_AUFTRAG_MAX_SCHRITTE, "nr"),
      aktion,
      ziel,
      auftragFassung: fassung,
      stand: "begonnen",
      ergebnis: null,
      ruecknehmbar: false,
      grund: null,
      begonnenAm: jetzt,
      geaendertAm: jetzt,
    };
    const neu = mitVerlauf(
      { ...a, schritte: [...a.schritte, schritt] },
      "begonnen",
      jetzt,
      schritt.nr,
    );
    return { auftrag: abgeleitet(neu, jetzt), schritt, wiederholt: false };
  }

  if (vorhanden.aktion !== aktion || !gleichesZiel(vorhanden.ziel, ziel)) {
    throw new KlaraAuftragFehler(
      409,
      "schluessel_belegt",
      "Dieser Schrittschlüssel gehört zu einem anderen Schritt.",
    );
  }
  if (vorhanden.stand === stand) {
    return { auftrag: a, schritt: vorhanden, wiederholt: true };
  }
  if (!UEBERGAENGE[vorhanden.stand].includes(stand)) {
    throw new KlaraAuftragFehler(
      409,
      "uebergang",
      `Ein Schritt im Stand „${vorhanden.stand}“ kann nicht „${stand}“ werden.`,
    );
  }
  let ergebnis = vorhanden.ergebnis;
  let ruecknehmbar = vorhanden.ruecknehmbar;
  let grund: string | null = null;
  if (stand === "gespeichert" || stand === "abgeschlossen") {
    if (vorhanden.stand === "begonnen") {
      ergebnis = pruefeErgebnis(eingabe.ergebnis);
      ruecknehmbar = eingabe.ruecknehmbar === true;
    }
  } else if (stand === "fehlgeschlagen") {
    grund = text(eingabe.grund, 300, "grund");
  } else if (stand === "zurueckgenommen" && !vorhanden.ruecknehmbar) {
    throw new KlaraAuftragFehler(
      409,
      "uebergang",
      "Dieser Schritt ist nicht rücknehmbar – seine Wirkung bleibt bestehen.",
    );
  }
  const schritt: KlaraAuftragSchritt = {
    ...vorhanden,
    stand,
    ergebnis,
    ruecknehmbar: stand === "zurueckgenommen" ? false : ruecknehmbar,
    grund,
    geaendertAm: jetzt,
  };
  const neu = mitVerlauf(
    { ...a, schritte: a.schritte.map((s) => (s.schluessel === schluessel ? schritt : s)) },
    stand,
    jetzt,
    schritt.nr,
  );
  return { auftrag: abgeleitet(neu, jetzt), schritt, wiederholt: false };
}

/** Abbrechen: kein weiterer Schritt. Schon Gespeichertes bleibt, wie es ist. Wiederholbar. */
export function brecheAb(a: KlaraAuftrag, jetzt: string): KlaraAuftrag {
  if (a.abgebrochenAm) {
    return a;
  }
  if (a.stand === "abgeschlossen" || a.stand === "teilweise" || a.stand === "fehlgeschlagen") {
    throw new KlaraAuftragFehler(
      409,
      "abgeschlossen",
      "Der Auftrag ist bereits beendet – es gibt nichts mehr abzubrechen.",
    );
  }
  return abgeleitet(mitVerlauf({ ...a, abgebrochenAm: jetzt }, "abgebrochen", jetzt, null), jetzt);
}
