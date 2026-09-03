// ================================================================================================
// A27 (OFFEN.md:81) — DIE AUTORIN ERFÄHRT AN IHREM EIGENEN OBJEKT, DASS ES KOLLIDIERT.
// UND: DIE SEITE BEHAUPTET NIE ETWAS, DAS SIE NICHT WEISS.
// ================================================================================================
//
// Das sind zwei Hälften EINES Versprechens, und die zweite ist die schwerere. JOB 3002 hat sie
// fünfmal verfehlt (archiv/3002/runde-1..5, alle ROT); vier der fünf Korrekturpflichten von Codex
// (LEHREN.md, JOB 3002 R2–R5) hängen an genau einer Frage: was weiß eine Abfrage gerade wirklich?
//
// DER ALTE FEHLER, in einer Zeile: `conflicts.data ?? []`. Dieses `?? []` macht aus VIER Lagen EINE.
// „lädt noch", „Abruf gescheitert", „alter Zwischenspeicher", „erfolgreich und wirklich leer" sehen
// danach identisch aus — und die Seite leitet aus allen vieren denselben Satz ab: „keine Kollision".
// Drei davon sind eine Erfindung.
//
// DESHALB STEHT DIE REGEL HIER UND NICHT IN DEN SEITEN. Zwei Flächen zeigen dieselbe Auskunft
// (Detailseite und Startseite). Läge die Ableitung in beiden, driftete sie — genau daran fiel
// Runde 4, in der die Startseite noch mit `?? []` las, während die Detailseite schon zählte.
//
// Und deshalb nimmt `quellenlage()` KEIN Query-Objekt entgegen, sondern vier Skalare: so ist jede
// Kombination in einer Tabelle prüfbar (tests/ko/job3025-quellenlage.test.ts), ohne React, ohne
// DOM, ohne Mount. Ein neuer Abrufzustand von TanStack Query muss dort eine Zeile bekommen, bevor
// er eine Seite erreicht — der vergessene `fetchStatus: "paused"` war der letzte Rotpunkt (R5).
import type { Conflict, EigenerBefund, KnowledgeObject } from "../api/types";
import { conflictImpact } from "./conflictImpact";

// ------------------------------------------------------------------------------------------------
// 1 · DAS ZUSTANDSMODELL EINER QUELLE
// ------------------------------------------------------------------------------------------------

/**
 * Die sechs Lagen, die eine Leseabfrage einnehmen kann. Sie sind vollständig in dem Sinn, dass
 * jede Kombination der vier Eingangsfelder in genau einer davon landet.
 */
export type Lage =
  | "laedt"
  | "frisch"
  | "erstfehler"
  | "auffrischung_laeuft"
  | "auffrischung_gescheitert"
  | "pausiert";

/**
 * Der Eingang: AUSSCHLIESSLICH Skalare plus die Daten. Kein `UseQueryResult`, keine React-
 * Abhängigkeit — sonst wäre die Regel nur über einen Mount prüfbar (siehe Kopfkommentar).
 * Die Feldnamen spiegeln TanStack Query v5 eins zu eins, damit an der Aufrufstelle nichts
 * übersetzt und dabei verfälscht wird.
 */
export interface Quellenzustand<T> {
  /** `pending` = noch nie beantwortet · `success` = Daten liegen vor · `error` = letzter Abruf scheiterte. */
  readonly status: "pending" | "success" | "error";
  /** `fetching` = Abruf läuft · `paused` = Abruf gewollt, aber offline angehalten · `idle` = nichts offen. */
  readonly fetchStatus: "fetching" | "paused" | "idle";
  readonly isError: boolean;
  /** 0 bedeutet: dieser Wert kam nie aus einer Antwort (Platzhalter/Initialwert). */
  readonly dataUpdatedAt: number;
  readonly data: T | undefined;
}

/**
 * Die Lagen, von der SCHWÄCHSTEN zur stärksten. „Schwach" heißt: wie wenig darf diese Lage tragen.
 *
 *   erstfehler                gar nichts da, und der Versuch ist gescheitert
 *   laedt                     gar nichts da, aber es wird gearbeitet
 *   pausiert                  vielleicht ein alter Stand — ein Versuch ist derzeit unmöglich (offline)
 *   auffrischung_gescheitert  alter Stand, der Versuch ist gescheitert
 *   auffrischung_laeuft       alter Stand, der Versuch läuft
 *   frisch                    aktuell, vollständig, belastbar
 *
 * Die Reihenfolge ist keine Geschmacksfrage: sie entscheidet, welcher Satz der Nutzerin erscheint,
 * wenn mehrere Quellen gleichzeitig schwächeln (`gesamtlage`). Sie steigt monoton mit „wie viel
 * liegt vor" und, bei gleichem Bestand, mit „wie gesund ist der Weg dorthin".
 */
export const LAGE_VON_SCHWACH_NACH_STARK: readonly Lage[] = [
  "erstfehler",
  "laedt",
  "pausiert",
  "auffrischung_gescheitert",
  "auffrischung_laeuft",
  "frisch",
];

/**
 * Die Lage EINER Quelle.
 *
 * Die Reihenfolge der Prüfungen trägt die Aussage:
 *
 * 1. `paused` zuerst, und zwar UNABHÄNGIG davon, ob Daten vorliegen. Ein angehaltener Abruf ist
 *    weder ein laufender („lädt" behauptete Arbeit, die gerade nicht stattfindet) noch ein
 *    gescheiterter — offline ist der aktuellere und der einzige behebbare Grund. Genau dieser Fall
 *    fehlte in JOB 3002 Runde 5 und war dort der letzte Rotpunkt (LEHREN.md, JOB 3002 R5).
 * 2. Ohne Daten entscheidet der Fehler: `erstfehler` gegen `laedt`. Ein laufender Erstabruf darf
 *    NIE als „ließ sich nicht laden" erscheinen (Codex R3).
 * 3. Mit Daten ist `erstfehler` ausgeschlossen — der Zwischenspeicher bleibt zeigbar. Es bleibt die
 *    Frage, wie belastbar er ist: gescheitert, in Auffrischung, oder frisch.
 *
 * `dataUpdatedAt === 0` zählt als „keine Daten": ein Wert ohne Zeitstempel stammt nie aus einer
 * Antwort. Ihn als geladen zu führen wäre die Verneinung aus dem Nichts.
 */
export function quellenlage<T>(q: Quellenzustand<T>): Lage {
  if (q.fetchStatus === "paused") {
    return "pausiert";
  }
  const hatDaten = q.data !== undefined && q.dataUpdatedAt > 0;
  const gescheitert = q.isError || q.status === "error";
  if (!hatDaten) {
    return gescheitert ? "erstfehler" : "laedt";
  }
  if (gescheitert) {
    return "auffrischung_gescheitert";
  }
  return q.fetchStatus === "fetching" ? "auffrischung_laeuft" : "frisch";
}

/** Die schwächste Lage gewinnt — eine Auskunft ist nur so belastbar wie ihre schwächste Quelle. */
export function gesamtlage(...lagen: readonly Lage[]): Lage {
  let beste = LAGE_VON_SCHWACH_NACH_STARK.length - 1;
  for (const lage of lagen) {
    beste = Math.min(beste, LAGE_VON_SCHWACH_NACH_STARK.indexOf(lage));
  }
  return LAGE_VON_SCHWACH_NACH_STARK[beste] ?? "erstfehler";
}

/**
 * DIE REGEL, hart: eine negative oder zeitabhängige Aussage über den Bestand („keine Kollision",
 * „aktuell geprüft") entsteht NUR aus `frisch`. In allen fünf anderen Lagen steht an derselben
 * Stelle ein Satz über die Datenlage — nie eine Aussage über den Bestand.
 */
export function bestandsaussageErlaubt(lage: Lage): boolean {
  return lage === "frisch";
}

/** Der Satz über die Datenlage. `frisch` trägt keinen — dort steht die Sache selbst. */
const DATENLAGE_KEY: Record<Lage, string | null> = {
  laedt: "kollision.lage.laedt",
  frisch: null,
  erstfehler: "kollision.lage.erstfehler",
  auffrischung_laeuft: "kollision.lage.auffrischungLaeuft",
  auffrischung_gescheitert: "kollision.lage.auffrischungGescheitert",
  pausiert: "kollision.lage.pausiert",
};

/**
 * EINE Lage trägt zwei Sätze — und das ist kein Sonderfall, sondern der ehrliche Umgang mit ihr.
 *
 * `pausiert` ist die EINZIGE Gesamtlage, die auch ohne jeden früheren Stand eintreten kann:
 * `quellenlage()` beantwortet `paused` VOR der Datenfrage (:100-102), während jede stärkere Lage
 * (`auffrischung_*`, `frisch`) Daten voraussetzt und jede schwächere (`laedt`, `erstfehler`) einen
 * eigenen Satz hat. Wer beim kalten Offline-Einstieg trotzdem „Stand von zuletzt" schreibt,
 * behauptet einen Stand, den es nie gab — dieselbe Erfindung aus dem Nichts wie die Verneinung
 * ohne Grundlage, nur an der anderen Flanke (Ben, JOB 3025 Runde 2, Korrekturpflicht 2).
 *
 * Der Satz ohne Stand sagt deshalb NUR, dass gerade nicht geprüft werden kann. Er verneint nichts
 * und behauptet auch keinen früheren Stand — beides wäre in dieser Lage unbelegt.
 */
function datenlageKeyFuer(lage: Lage, hatFruherenStand: boolean): string | null {
  if (lage === "pausiert" && !hatFruherenStand) {
    return "kollision.lage.pausiertOhneStand";
  }
  return DATENLAGE_KEY[lage];
}

/**
 * Wiederholen anbieten heißt: ein neuer Versuch kann jetzt etwas ändern. Bei `laedt` und
 * `auffrischung_laeuft` läuft bereits einer; bei `pausiert` scheitert jeder, solange das Netz fehlt.
 * Ein Knopf, der nichts bewirkt, wäre eine Scheinfunktion (REGELN.md §7).
 */
function wiederholenSinnvoll(lage: Lage): boolean {
  return lage === "erstfehler" || lage === "auffrischung_gescheitert";
}

// ------------------------------------------------------------------------------------------------
// 2 · DIE AUSKUNFT
// ------------------------------------------------------------------------------------------------

/** Vorhandensein und Art — mehr trägt `EigenerBefund`, und mehr darf hier nie stehen (A28). */
export type Befundart = "keine" | "dublette" | "konflikt" | "beides";

export interface KollisionsWeg {
  readonly to: string;
  readonly textKey: string;
}

export interface Kollisionsauskunft {
  readonly lage: Lage;
  readonly art: Befundart;
  /** Zahl der EIGENEN Objekte, an denen ein Befund hängt (auf der Detailseite 0 oder 1). */
  readonly anzahl: number;
  /** Nur bei `frisch` wahr — nur dann darf hier eine Aussage über den Bestand stehen. */
  readonly bestandGesichert: boolean;
  /** Der Satz, der an der Stelle steht. */
  readonly satzKey: string;
  /** Der Vorbehalt über die Datenlage. Genau dann `null`, wenn `lage === "frisch"`. */
  readonly datenlageKey: string | null;
  /** Ein neuer Versuch kann jetzt etwas ändern. */
  readonly wiederholenMoeglich: boolean;
  /**
   * DER neue Versuch — er frischt genau die drei Quellen auf, aus denen diese Auskunft entsteht.
   *
   * Er gehört hierher und nicht in die Seiten: stünde er dort, hätten beide Flächen ihre eigene
   * Liste der aufzufrischenden Quellen, und eine vierte Quelle würde an einer Seite vergessen —
   * dieselbe Drift, gegen die schon die Ableitung hier liegt. Nur sinnvoll bei
   * `wiederholenMoeglich`; sonst läuft entweder schon ein Abruf oder es fehlt das Netz.
   */
  readonly erneutPruefen: () => void;
  /** Weiterführender Weg — `null`, solange kein Befund feststeht. */
  readonly weg: KollisionsWeg | null;
}

const WEG_DUBLETTE: KollisionsWeg = { to: "/duplikate", textKey: "kollision.wegDuplikate" };
const WEG_KONFLIKT: KollisionsWeg = { to: "/konflikte", textKey: "kollision.wegKonflikte" };

function art(dublette: boolean, konflikt: boolean): Befundart {
  if (dublette && konflikt) {
    return "beides";
  }
  if (dublette) {
    return "dublette";
  }
  return konflikt ? "konflikt" : "keine";
}

/**
 * Eine Quelle, wie die Seiten sie halten: die vier Skalare PLUS der neue Versuch.
 *
 * `refetch` steht bewusst NICHT in `Quellenzustand` — sonst wäre der Eingang von `quellenlage()`
 * kein reiner Skalarsatz mehr und die Tabellenprobe bräuchte für jede Zeile eine Funktion. Die
 * Trennung ist die Aussage: die LAGE entsteht aus Skalaren, die HANDLUNG hängt an der Abfrage.
 */
export interface Quelle<T> extends Quellenzustand<T> {
  readonly refetch: () => unknown;
}

/** Bei „beides" führt der Konflikt — er ist die stärkere Aussage (Wahrheit vor Redaktion). */
function weg(a: Befundart): KollisionsWeg | null {
  if (a === "keine") {
    return null;
  }
  return a === "dublette" ? WEG_DUBLETTE : WEG_KONFLIKT;
}

/**
 * Der gemeinsame Schluss beider Flächen — hier und nur hier wird entschieden, was dasteht.
 *
 * ES GIBT GENAU DREI AUSGÄNGE:
 *   · Ein Befund liegt vor → er wird GENANNT, in jeder Lage. Eine Kollision, die der Autorin
 *     verschwiegen wird, ist genau Pedis Ausgangsbefund A27. Ist die Lage nicht `frisch`, steht der
 *     Vorbehalt als eigene, ruhigere Zeile daneben — der Befund wird eingeordnet, nicht kassiert.
 *   · Kein Befund UND `frisch` → die Verneinung. Die einzige Lage, in der sie erlaubt ist.
 *   · Kein Befund und nicht `frisch` → NUR der Satz über die Datenlage. Kein „keine Kollision",
 *     keine 0, keine Beruhigung. Das ist der Fall, an dem JOB 3002 R4 und R5 fielen.
 */
function schluss(
  quellen: Kollisionsquellen,
  lage: Lage,
  a: Befundart,
  anzahl: number,
  satzKeys: { readonly praefix: string },
): Kollisionsauskunft {
  const datenlageKey = datenlageKeyFuer(lage, hatFruherenStand(quellen));
  // `datenlageKey === null` ist per Bauart genau `lage === "frisch"` — dieselbe Bedingung wie
  // `bestandsaussageErlaubt`. Der Ausdruck sagt deshalb wörtlich: die Verneinung steht da, wo kein
  // Vorbehalt nötig ist, und sonst steht der Vorbehalt.
  const satzKey =
    a !== "keine" ? `${satzKeys.praefix}.${a}` : (datenlageKey ?? `${satzKeys.praefix}.keine`);
  return {
    lage,
    art: a,
    anzahl,
    bestandGesichert: bestandsaussageErlaubt(lage),
    satzKey,
    datenlageKey,
    wiederholenMoeglich: wiederholenSinnvoll(lage),
    // Über `alleQuellen` und nicht als drei Zeilen: die Liste der Quellen steht damit an EINER
    // Stelle in dieser Datei — derselben, aus der auch `gesamtlage` sie liest.
    erneutPruefen: (): void => {
      for (const q of alleQuellen(quellen)) {
        void q.refetch();
      }
    },
    weg: weg(a),
  };
}

/**
 * Die drei Quellen, aus denen beide Flächen lesen.
 *
 * WARUM DIE KO-LISTE DABEI IST, obwohl sie keinen Befund trägt: eine Kollisionsaussage ist immer
 * eine Aussage über das VERHÄLTNIS dieses Objekts zum übrigen Bestand. „Keine offene Kollision"
 * heißt „gemessen am aktuellen Bestand nichts gefunden" — ohne aktuellen Bestand ist das eine
 * Behauptung ohne Grundlage. Deshalb geht `kos` in die `gesamtlage` ein.
 *
 * WARUM SIE NICHT FILTERT: es wäre naheliegend, Befunde auf Objekte zu beschränken, die in `kos`
 * stehen. Das wäre falsch — `ko.list` ist die SICHTBARE Liste, nicht der vollständige Bestand. Ein
 * Befund, der dort nicht auftaucht, würde stillschweigend verschwinden, und das ist genau der
 * Zustand, den A27 beendet. Die Liste entscheidet über die Belastbarkeit der Auskunft, nie über
 * ihren Inhalt.
 */
export interface Kollisionsquellen {
  readonly befunde: Quelle<readonly EigenerBefund[]>;
  readonly konflikte: Quelle<readonly Conflict[]>;
  readonly kos: Quelle<readonly KnowledgeObject[]>;
}

/**
 * DIE Liste der drei Quellen — die einzige Stelle, an der sie aufgezählt werden. Beide Auswertungen
 * (`gesamtlage` und `erneutPruefen`) lesen sie hier, damit eine vierte Quelle nicht an einer der
 * beiden vergessen werden kann.
 */
function alleQuellen(q: Kollisionsquellen): readonly Quelle<unknown>[] {
  return [q.befunde, q.konflikte, q.kos];
}

function lageDerQuellen(q: Kollisionsquellen): Lage {
  return gesamtlage(...alleQuellen(q).map(quellenlage));
}

/**
 * Liegt für JEDE der drei Quellen ein früherer Stand vor? Dieselbe Bedingung, mit der
 * `quellenlage()` „hat Daten" beantwortet (:103) — ein Wert ohne Zeitstempel kam nie aus einer
 * Antwort. Gebraucht wird sie nur für den Offline-Satz (siehe `datenlageKeyFuer`).
 */
function hatFruherenStand(q: Kollisionsquellen): boolean {
  return alleQuellen(q).every((x) => x.data !== undefined && x.dataUpdatedAt > 0);
}

/**
 * DETAILSEITE — der Befund an genau diesem Objekt.
 *
 * Zwei Quellen tragen zur Art bei, und das ist Absicht: `/api/duplicate-signal` spricht auch dann,
 * wenn die Gegenseite für den Betrachter unsichtbar ist (api/types.ts:184-197), `/api/conflicts`
 * dagegen trägt die sichtbaren Paare. Wer nur eine läse, verlöre je nach Sichtbarkeitslage die
 * halbe Auskunft. Aus der Konfliktliste wird ausschließlich das VORHANDENSEIN gelesen
 * (`conflictImpact(...).affected`) — nie Kennung, Titel oder Zitat der Gegenseite (A28,
 * OFFEN.md:165).
 */
export function eigeneKollisionDetail(
  args: Kollisionsquellen & { readonly koId: string },
): Kollisionsauskunft {
  const lage = lageDerQuellen(args);
  const eigener = args.befunde.data?.find((b) => b.koId === args.koId);
  const konfliktSichtbar =
    args.konflikte.data !== undefined && conflictImpact(args.koId, args.konflikte.data).affected;
  const a = art(eigener?.dublette === true, eigener?.konflikt === true || konfliktSichtbar);
  return schluss(args, lage, a, a === "keine" ? 0 : 1, { praefix: "kollision.detail" });
}

/**
 * STARTSEITE — dieselbe Regel, dieselbe Funktionsfamilie, andere Fläche.
 *
 * Gezählt werden EIGENE Objekte, und „eigen" weiß nur `/api/duplicate-signal` (der Server filtert
 * dort auf den Betrachter). Die Konfliktliste kann deshalb hier keine neuen Objekte beitragen —
 * sie kann aber die ART eines bereits bekannten Befunds vervollständigen: die drei Antworten
 * kommen getrennt an, und ein Signal-Eintrag mit `konflikt: false` kann durch die frischere
 * Konfliktliste überholt sein. Beides zu lesen ist die vollständigere Auskunft, nicht die doppelte.
 */
export function eigeneKollisionStart(q: Kollisionsquellen): Kollisionsauskunft {
  const lage = lageDerQuellen(q);
  // Bewusst KEIN `?? []`: das ist die Zeile, an der JOB 3002 fünfmal fiel. Fehlende Daten sind
  // hier eine LAGE (oben schon ermittelt), keine leere Liste — die Schleife läuft dann einfach
  // nicht, und `schluss` setzt den Satz über die Datenlage statt einer Verneinung.
  const befunde: readonly EigenerBefund[] = q.befunde.data === undefined ? [] : q.befunde.data;
  const konflikte = q.konflikte.data;
  let dublette = false;
  let konflikt = false;
  let anzahl = 0;
  for (const b of befunde) {
    const mitKonflikt =
      b.konflikt || (konflikte !== undefined && conflictImpact(b.koId, konflikte).affected);
    if (!b.dublette && !mitKonflikt) {
      continue;
    }
    anzahl += 1;
    dublette = dublette || b.dublette;
    konflikt = konflikt || mitKonflikt;
  }
  const a = art(dublette, konflikt);
  return schluss(q, lage, a, a === "keine" ? 0 : anzahl, { praefix: "kollision.start" });
}
