// ================================================================================================
// produkt:20261007:klara-erinnerungen-kalender · EQF-07 — PERSÖNLICHE ROUTINEN (REIN, OHNE ABLAGE).
// ================================================================================================
//
// Eine Routine ist eine Erinnerung mit der Aktion `routine_bericht` und einer eigenen, VERSIONIERTEN
// Definition (Funktionsfassung): welche Abschnitte der Bericht hat, welche festen Quellen er liest,
// wohin er geht und welche Wirkung erlaubt ist. Zeit, Serie, Sommerzeit, Nachholregel, Pause,
// Läufe und Übernahme sind DIESELBEN wie bei jeder Erinnerung — es gibt keine zweite Zeitsteuerung.
//
// GETRENNT GESPEICHERT (EQF-07): Definition (`routine` an der Erinnerung, eigene Fassung) · Zeitauftrag
// (Zeitplan der Erinnerung) · Vorkommen und Versuch (`klara_erinnerung_laeufe`) · tatsächliches
// Ergebnis (eine Notiz in „Meine Notizen“ mit festem Vorgangsschlüssel je Vorkommen, ihre Kennung
// und Fassung im Lauf) · Benachrichtigung (`klara_erinnerung_meldungen`).
//
// ERLAUBTE WIRKUNG: genau eine — den Bericht in der EIGENEN Ablage anlegen. Versand, Export, Nachricht
// oder Bestellung sind keine Wirkung dieser Routine; wer sie verlangt, bekommt eine klare Ablehnung
// statt einer erfundenen Befugnis.
//
// Diese Datei enthält nur Regeln: Prüfen der Eingabe, Deuten einer Änderung in Worten („künftig
// montags“, „nimm die erledigten Aufgaben dazu“, „pausieren“, „beenden“) und das Zusammensetzen des
// Berichtstexts aus tatsächlich gelesenen Quellen.
import type { Wochentag } from "./klara-erinnerung-zeit";
import { type KlaraNotiz, notizIstQuellengebunden } from "./klara-notiz";
import { type PflegeAuftrag, type PflegeErgebnis, pflegeAus } from "./klara-wissenspflege";

export const ROUTINE_ABSCHNITTE = [
  "offene_aufgaben",
  "erledigte_aufgaben",
  "neue_notizen",
] as const;
export type RoutineAbschnitt = (typeof ROUTINE_ABSCHNITTE)[number];

/** Die einzige erlaubte Wirkung — Erstellung in der eigenen Ablage. */
export const ROUTINE_WIRKUNGEN = ["bericht_erstellen"] as const;
export type RoutineWirkung = (typeof ROUTINE_WIRKUNGEN)[number];

export const ROUTINE_NOTIZEN_MAX = 20;
/** Zeitraum, aus dem „erledigte Aufgaben“ und „neue Notizen“ stammen: die 7 Tage vor dem Termin. */
export const ROUTINE_RUECKBLICK_TAGE = 7;
export const ROUTINE_EINTRAEGE_MAX = 50;

export interface KlaraRoutine {
  /** Fassung der Funktionsdefinition — jede Änderung der Abschnitte/Quellen erhöht sie. */
  readonly fassung: number;
  readonly abschnitte: readonly RoutineAbschnitt[];
  /** Feste Quellen: eigene Notizen, die in jeden Bericht gehören. */
  readonly notizIds: readonly string[];
  /** Ergebnisablage: „Meine Notizen“ (persönlich). */
  readonly ziel: "meine_notizen";
  readonly wirkungen: readonly RoutineWirkung[];
  /** Eindeutige erlaubte Schritte laufen ohne erneute Einzelbestätigung. */
  readonly modus: "automatisch";
  /** Ausdrücklich bestellte Wissenspflege auf demselben Zeit-/Lauf-/Ergebnisweg. */
  readonly wissenspflege?: PflegeAuftrag;
}

/** Das tatsächliche Ergebnis eines Laufs — am Lauf gespeichert, in der Meldung gezeigt. */
export interface KlaraRoutineErgebnis {
  readonly wissenspflege?: PflegeErgebnis;
  readonly status: "erstellt" | "teilweise";
  readonly notizId: string;
  readonly notizFassung: number;
  readonly routineFassung: number;
  readonly erstelltAm: string;
  /** Die gelesenen Quellen mit ihrer Fassung — welcher Stand im Bericht steht. */
  readonly quellen: readonly { art: "aufgabe" | "notiz"; id: string; fassung: number }[];
  /** Was NICHT im Bericht steht, mit Grund — der offene Rest. */
  readonly offen: readonly { was: string; grund: "quelle_geloescht" | "quelle_unlesbar" }[];
  /** Der Bericht kam aus einem früheren Versuch desselben Vorkommens (Readback). */
  readonly wiederholt?: boolean;
  /** Bewusst zurückgenommen (Notiz entfernt) — nur, solange niemand sie geändert hatte. */
  readonly zurueckgenommenAm?: string;
  /**
   * Nacharbeit 9 (Ben, EQF-07-K06): der Aufbau des Berichts — fertige Abschnitte bleiben, wie sie
   * sind; nur unlesbare werden bei der Fortsetzung neu gelesen. `termin`: die Kopfzeile des Laufs.
   */
  readonly teile?: readonly BerichtTeil[];
  readonly termin?: string;
  /** Der offene Rest ist (noch) nachholbar — die vorhandene Wiederaufnahme setzt ihn fort. */
  readonly fortsetzbar?: boolean;
  /** Wann der Rest zuletzt in DENSELBEN Bericht nachgetragen wurde. */
  readonly fortgesetztAm?: string;
  /**
   * Nacharbeit 11 (Ben, AW18-K06): die beabsichtigte Fortsetzung, VOR der Berichtsänderung am
   * gehaltenen Lauf festgehalten. Nach einem Absturz zwischen Änderung und Abschluss erkennt das
   * Readback daran die EIGENE neue Berichtsfassung (Fassung + Inhaltsprüfsumme) — unabhängig von
   * der nachgelagerten Meldung. Stimmt beides nicht, ist es fremde Arbeit.
   */
  readonly fortsetzung?: KlaraRoutineFortsetzung;
  /**
   * Nacharbeit 12 (Ben, EQF-07-K09): der Bericht ist fertig fortgesetzt, die Meldung darüber steht
   * noch aus (Schreibfehler, verlorene Antwort, nur Fassungswechsel). Die vorhandene Wiederaufnahme
   * holt NUR die Meldung nach — über ihre feste Kennung, ohne erneute Berichtsänderung.
   */
  readonly meldungAusstehend?: boolean;
}

export interface KlaraRoutineFortsetzung {
  /** Die Berichtsfassung, auf die geschrieben wird, und die Fassung danach. */
  readonly vonFassung: number;
  readonly nachFassung: number;
  /** SHA-256 des geschriebenen Berichtsinhalts. */
  readonly inhaltHash: string;
  /** Das Ergebnis, das nach erfolgreicher Änderung gilt (ohne eigene `fortsetzung`). */
  readonly ergebnis: Omit<KlaraRoutineErgebnis, "fortsetzung">;
  readonly laufStatus: "zugestellt" | "teilweise";
}

export class RoutineEingabeFehler extends Error {
  constructor(
    readonly grund: "eingabe" | "wirkung_nicht_beauftragt",
    message: string,
  ) {
    super(message);
    this.name = "RoutineEingabeFehler";
  }
}

function istAbschnitt(x: unknown): x is RoutineAbschnitt {
  return typeof x === "string" && (ROUTINE_ABSCHNITTE as readonly string[]).includes(x);
}

/**
 * Prüft eine Routinendefinition aus der Eingabe. Ohne Angaben: offene und erledigte Aufgaben.
 * Verlangte Wirkungen jenseits der Erstellung (Versand, Export …) werden abgelehnt.
 */
export function routineAus(roh: unknown, fassung = 1): KlaraRoutine {
  const o = roh === undefined || roh === null ? {} : roh;
  if (typeof o !== "object" || Array.isArray(o)) {
    throw new RoutineEingabeFehler("eingabe", "routine ist ein Objekt.");
  }
  const r = o as Record<string, unknown>;
  let wissenspflege: PflegeAuftrag | undefined;
  if (r.wissenspflege !== undefined) {
    try {
      wissenspflege = pflegeAus(r.wissenspflege);
    } catch (fehler) {
      throw new RoutineEingabeFehler(
        "eingabe",
        fehler instanceof Error ? fehler.message : "Ungültiger Pflegeauftrag.",
      );
    }
  }
  const abschnitteRoh =
    r.abschnitte ?? (wissenspflege ? [] : ["offene_aufgaben", "erledigte_aufgaben"]);
  if (!Array.isArray(abschnitteRoh) || (abschnitteRoh.length === 0 && !wissenspflege)) {
    throw new RoutineEingabeFehler(
      "eingabe",
      "routine.abschnitte braucht mindestens einen Abschnitt.",
    );
  }
  const abschnitte: RoutineAbschnitt[] = [];
  for (const a of abschnitteRoh) {
    if (!istAbschnitt(a)) {
      throw new RoutineEingabeFehler(
        "eingabe",
        `routine.abschnitte: erlaubt sind ${ROUTINE_ABSCHNITTE.join(", ")}.`,
      );
    }
    if (!abschnitte.includes(a)) {
      abschnitte.push(a);
    }
  }
  const notizRoh = r.notizIds ?? [];
  if (
    !Array.isArray(notizRoh) ||
    notizRoh.length > ROUTINE_NOTIZEN_MAX ||
    notizRoh.some((n) => typeof n !== "string" || n.length === 0 || n.length > 200)
  ) {
    throw new RoutineEingabeFehler(
      "eingabe",
      `routine.notizIds: höchstens ${ROUTINE_NOTIZEN_MAX} Kennungen eigener Notizen.`,
    );
  }
  const wirkungRoh = r.wirkungen ?? ["bericht_erstellen"];
  if (wissenspflege && (abschnitte.length > 0 || notizRoh.length > 0))
    throw new RoutineEingabeFehler(
      "eingabe",
      "Eine Wissenspflegevorlage liest ausschließlich ihre ausdrücklich ausgewählten Wissensobjekte.",
    );
  if (!Array.isArray(wirkungRoh) || wirkungRoh.length === 0) {
    throw new RoutineEingabeFehler("eingabe", "routine.wirkungen ist eine Liste.");
  }
  for (const w of wirkungRoh) {
    if (w !== "bericht_erstellen") {
      throw new RoutineEingabeFehler(
        "wirkung_nicht_beauftragt",
        `„${String(w)}“ ist keine Wirkung dieser Routine. Sie legt nur den Bericht in „Meine Notizen“ an — Versand, Export oder Nachricht wären ein eigener, ausdrücklich zu erteilender Auftrag.`,
      );
    }
  }
  if (r.modus !== undefined && r.modus !== "automatisch") {
    throw new RoutineEingabeFehler("eingabe", "routine.modus ist „automatisch“.");
  }
  return {
    fassung,
    abschnitte,
    notizIds: [...new Set(notizRoh as string[])],
    ziel: "meine_notizen",
    wirkungen: ["bericht_erstellen"],
    modus: "automatisch",
    ...(wissenspflege ? { wissenspflege } : {}),
  };
}

// ------------------------------------------------------------------------------------------------
// ÄNDERUNG IN WORTEN (getippt oder diktiert): „künftig montags“, „nimm … dazu“, „pausieren“, …
// ------------------------------------------------------------------------------------------------

export type RoutinenAenderung =
  | { art: "wochentag"; wochentag: Wochentag }
  | { art: "abschnitt_dazu"; abschnitt: RoutineAbschnitt }
  | { art: "abschnitt_weg"; abschnitt: RoutineAbschnitt }
  | { art: "pausieren" }
  | { art: "fortsetzen" }
  | { art: "beenden" }
  | { art: "unklar" };

const TAGE: Record<string, Wochentag> = {
  montag: 1,
  dienstag: 2,
  mittwoch: 3,
  donnerstag: 4,
  freitag: 5,
  samstag: 6,
  sonntag: 7,
};

function normal(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function abschnittIn(t: string): RoutineAbschnitt | null {
  if (/\berledigt/.test(t)) {
    return "erledigte_aufgaben";
  }
  if (/\boffen/.test(t)) {
    return "offene_aufgaben";
  }
  if (/\bnotiz/.test(t)) {
    return "neue_notizen";
  }
  return null;
}

/**
 * Deutet eine Änderung in Worten. Mehrdeutiges oder Unbekanntes ergibt `unklar` — es wird nichts
 * geraten und nichts geändert.
 */
export function deuteRoutinenAenderung(text: string): RoutinenAenderung {
  const t = normal(text);
  if (t.length === 0) {
    return { art: "unklar" };
  }
  // Ein negiertes Statuswort bestellt keine Gegenhandlung. „Nicht mehr ausführen“ und
  // Abschnittsänderungen mit „nicht mehr“ bleiben in ihren bestehenden Zweigen.
  if (
    /\bnicht\b/.test(t) &&
    /\b(pausier|pause|aussetz|anhalten|fortsetz|weiter machen|wieder aufnehmen|weitermachen|beende|stopp|abschalten)/.test(
      t,
    )
  ) {
    return { art: "unklar" };
  }
  const tage = Object.entries(TAGE).filter(([name]) => new RegExp(`\\b${name}s?\\b`).test(t));
  const kuenftig = /\b(kuenftig|ab jetzt|ab sofort|immer|stattdessen|nur noch)\b/.test(t);
  if (tage.length === 1 && kuenftig) {
    return { art: "wochentag", wochentag: (tage[0] as [string, Wochentag])[1] };
  }
  if (tage.length > 1) {
    return { art: "unklar" };
  }
  const abschnitt = abschnittIn(t);
  if (abschnitt && /\b(dazu|hinzu|ergaenz|auch|aufnehmen|nimm)\b/.test(t)) {
    return { art: "abschnitt_dazu", abschnitt };
  }
  if (abschnitt && /\b(weg|ohne|entfern|nicht mehr|streich)\b/.test(t)) {
    return { art: "abschnitt_weg", abschnitt };
  }
  if (/\b(pausier|pause|aussetz|anhalten)/.test(t)) {
    return { art: "pausieren" };
  }
  if (/\b(fortsetz|weiter machen|wieder aufnehmen|weitermachen)/.test(t)) {
    return { art: "fortsetzen" };
  }
  if (/\b(beende|beenden|stopp|stoppen|abschalten|nicht mehr ausfuehren)\b/.test(t)) {
    return { art: "beenden" };
  }
  return { art: "unklar" };
}

// ------------------------------------------------------------------------------------------------
// DER BERICHT — nur aus tatsächlich gelesenen Quellen, mit offenem Rest.
// ------------------------------------------------------------------------------------------------

export interface BerichtQuelle {
  readonly art: "aufgabe" | "notiz";
  readonly id: string;
  readonly fassung: number;
  readonly titel: string;
  readonly zusatz: string;
}

export interface BerichtTeil {
  readonly titel: string;
  readonly eintraege: readonly BerichtQuelle[];
  /** `null`: gelesen; sonst Grund, warum dieser Abschnitt fehlt. */
  readonly fehlt: "quelle_unlesbar" | null;
}

const ABSCHNITT_TITEL: Record<RoutineAbschnitt, string> = {
  offene_aufgaben: "Offene Aufgaben",
  erledigte_aufgaben: `Erledigte Aufgaben (${ROUTINE_RUECKBLICK_TAGE} Tage vor dem Termin)`,
  neue_notizen: `Neue oder geänderte Notizen (${ROUTINE_RUECKBLICK_TAGE} Tage vor dem Termin)`,
};

export function abschnittTitel(a: RoutineAbschnitt): string {
  return ABSCHNITT_TITEL[a];
}

/** Umkehrung von `abschnittTitel` — für die Fortsetzung eines unlesbaren Abschnitts. */
export function abschnittVonTitel(titel: string): RoutineAbschnitt | null {
  return ROUTINE_ABSCHNITTE.find((a) => ABSCHNITT_TITEL[a] === titel) ?? null;
}

/** Die Zeile eines nicht lesbaren Abschnitts — auch Erkennungszeichen für die Fortsetzung. */
const NICHT_LESBAR = "- (nicht lesbar — siehe „Noch offen“)";

/** Der Berichtstext — deterministisch aus Kopf, Teilen und offenem Rest. */
export function berichtText(kopf: {
  titel: string;
  termin: string;
  routineFassung: number;
  teile: readonly BerichtTeil[];
  offen: readonly { was: string; grund: string }[];
}): string {
  const zeilen = [
    `${kopf.titel} — Lauf für ${kopf.termin}`,
    `Funktionsfassung ${kopf.routineFassung}. Erstellt aus den unten genannten Quellen und Fassungen.`,
  ];
  for (const teil of kopf.teile) {
    zeilen.push("", `## ${teil.titel}`);
    if (teil.fehlt) {
      zeilen.push(NICHT_LESBAR);
    } else if (teil.eintraege.length === 0) {
      zeilen.push("- keine");
    } else {
      for (const q of teil.eintraege) {
        const zusatz = q.zusatz ? ` — ${q.zusatz}` : "";
        zeilen.push(`- ${q.titel}${zusatz} [${q.art} ${q.id}, Fassung ${q.fassung}]`);
      }
    }
  }
  if (kopf.offen.length > 0) {
    zeilen.push("", "## Noch offen");
    for (const o of kopf.offen) {
      zeilen.push(
        `- ${o.was}: ${o.grund === "quelle_geloescht" ? "Quelle gelöscht" : "Quelle gerade nicht lesbar"}`,
      );
    }
  }
  return zeilen.join("\n");
}

/**
 * FNR-2: Statt Titel und erster Zeile einer quellengebundenen Notiz (z. B. aus einer geschützten
 * Klara-Antwort) steht im Bericht nur dieser Verweis mit Kennung und Fassung. Der Bericht selbst
 * hat keine Quellenbindung; eine Kopie bliebe nach dem Rechteentzug lesbar und ginge über die
 * Wissensübernahme weiter. Die Ursprungsnotiz behält ihren eigenen Quellschutz bei jedem Abruf.
 */
const QUELLENGEBUNDENE_NOTIZ_TITEL = "Notiz mit Quellenbindung";
const QUELLENGEBUNDENE_NOTIZ_ZUSATZ = "Inhalt nur in der Notiz selbst";

/** Eine eigene Notiz als Berichtseintrag: Titel, Anfang der ersten Zeile, Kennung und Fassung. */
export function notizEintrag(n: KlaraNotiz): BerichtQuelle {
  // Dieselbe Abgrenzung wie der Quellschutz der Notizablage (`QuellgeschuetzteKlaraNotizen`).
  if (n.quelle || notizIstQuellengebunden(n)) {
    return {
      art: "notiz",
      id: n.id,
      fassung: n.fassung,
      titel: QUELLENGEBUNDENE_NOTIZ_TITEL,
      zusatz: QUELLENGEBUNDENE_NOTIZ_ZUSATZ,
    };
  }
  const erste = n.inhalt.trim().split("\n")[0]?.trim() ?? "";
  const zusatz = [...erste].length > 80 ? `${[...erste].slice(0, 79).join("")}…` : erste;
  return {
    art: "notiz",
    id: n.id,
    fassung: n.fassung,
    titel: n.titel,
    zusatz: zusatz === n.titel ? "" : zusatz,
  };
}

/**
 * Readback: das Ergebnis aus einem SCHON gespeicherten Bericht (zweiter Ausführer, verlorene
 * Antwort, Wiederanlauf) — Quellen und Fassungen stehen in seinem eigenen, deterministisch
 * erzeugten Text. Nichts wird neu gelesen oder neu geschrieben.
 */
export function ergebnisAusBericht(n: KlaraNotiz): KlaraRoutineErgebnis {
  const quellen = [...n.inhalt.matchAll(/\[(aufgabe|notiz) ([^,\]]+), Fassung (\d+)\]/g)].map(
    (m) => ({
      art: m[1] as "aufgabe" | "notiz",
      id: m[2] ?? "",
      fassung: Number(m[3]),
    }),
  );
  const routineFassung = Number(/Funktionsfassung (\d+)\./.exec(n.inhalt)?.[1] ?? "0");
  const rest = n.inhalt.split("\n## Noch offen\n")[1] ?? "";
  const offen = rest
    .split("\n")
    .filter((z) => z.startsWith("- "))
    .map((z) => {
      const [was, grund] = z.slice(2).split(/: (?=Quelle )/);
      const geloescht = grund?.includes("gelöscht") ?? false;
      return {
        was: was ?? "",
        grund: geloescht ? ("quelle_geloescht" as const) : ("quelle_unlesbar" as const),
      };
    });
  const { termin, teile } = aufbauAusBericht(n.inhalt);
  return {
    status: offen.length > 0 ? "teilweise" : "erstellt",
    notizId: n.id,
    notizFassung: n.fassung,
    routineFassung,
    erstelltAm: n.angelegtAm,
    quellen,
    offen,
    ...(termin !== null ? { termin, teile } : {}),
    fortsetzbar: termin !== null && offen.some((o) => o.grund === "quelle_unlesbar"),
  };
}

/** Fehlender Rest: nicht lesbare Abschnitte bzw. feste Notizen („Notiz <Kennung>“). */
export const FESTE_NOTIZEN_TITEL = "Feste Notizen";

/**
 * Der Aufbau eines SELBST erzeugten Berichts (`berichtText`) — damit ein über Readback gefundener
 * Teilbericht wie ein frisch geschriebener fortgesetzt werden kann. `termin: null`: nicht erkennbar.
 */
export function aufbauAusBericht(inhalt: string): {
  termin: string | null;
  teile: BerichtTeil[];
} {
  const zeilen = inhalt.split("\n");
  const kopf = /^.* — Lauf für (.+)$/.exec(zeilen[0] ?? "");
  type Teil = { titel: string; eintraege: BerichtQuelle[]; fehlt: "quelle_unlesbar" | null };
  const teile: BerichtTeil[] = [];
  let aktuell: Teil | null = null;
  for (const z of zeilen.slice(1)) {
    const titel = /^## (.+)$/.exec(z)?.[1];
    if (titel !== undefined) {
      if (aktuell) {
        teile.push(aktuell);
      }
      aktuell = titel === "Noch offen" ? null : { titel, eintraege: [], fehlt: null };
      continue;
    }
    if (!aktuell || !z.startsWith("- ")) {
      continue;
    }
    if (z === NICHT_LESBAR) {
      aktuell.fehlt = "quelle_unlesbar";
      continue;
    }
    const m = /^- (.*?)(?: — (.*))? \[(aufgabe|notiz) ([^,\]]+), Fassung (\d+)\]$/.exec(z);
    if (m) {
      aktuell.eintraege.push({
        art: m[3] as "aufgabe" | "notiz",
        id: m[4] ?? "",
        fassung: Number(m[5]),
        titel: m[1] ?? "",
        zusatz: m[2] ?? "",
      });
    }
  }
  if (aktuell) {
    teile.push(aktuell);
  }
  return { termin: kopf?.[1] ?? null, teile };
}

/** Vorgangsschlüssel der Ergebnisnotiz je Vorkommen — derselbe Termin legt nie eine zweite an. */
export function ergebnisVorgang(vorkommenId: string): string {
  return `routine-${vorkommenId.replace(/[^A-Za-z0-9_-]+/g, "-")}`.slice(0, 100);
}
