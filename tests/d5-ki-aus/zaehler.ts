// ================================================================================================
// D5 · KI AUS — DIE UNABHÄNGIGEN ZÄHLER AN DEN ECHTEN GRENZEN DES FRAGEWEGS.
// ================================================================================================
//
// Ein leerer Antworttext oder ein ausgebliebener Anbieteraufruf beweist für sich nichts: auch eine
// Frage, die den ganzen Bestand gelesen und nur die Antwort verschluckt hat, sähe so aus. Diese
// Datei zählt deshalb dort, wo Kundeninhalt WIRKLICH gelesen oder weitergegeben wird — von aussen,
// ohne dass das Produkt davon weiss oder daran mitzählt:
//
//   1. LESEN: JEDE Methode der Ablagen, aus denen der Frageweg liest oder in die er ablegt —
//      Wissensobjekte, Fassungen, Suchprojektion, Metadatenprojektion, Lücken, Antwortbelege und
//      (Runde 3, Bens Befund) die Konflikte, die die Route für die Einstufung nachliest.
//      Gezählt UNTERHALB der Dienstmethoden, an den Ablage-Instanzen, die die laufende App wirklich
//      benutzt, und zwar IM AUGENBLICK DER AUSFÜHRUNG. Das ist die Korrektur aus Bens Runde-1-Befund:
//      die erste Fassung zählte am Eintritt in `KoService.findCandidates` — ein zweites Lesen INNERHALB
//      dieses Dienstes (`repo.listByIds` nach `await findSearchHits`) blieb unsichtbar.
//   2. ANTWORTWEG: `Reasoner.answer` / `answerRetrievalOnly` — hier gehen die gelesenen Kandidaten
//      an die KI bzw. an ihren deterministischen Ersatz.
//   3. MODELLTRANSPORT: der instrumentierte lokale Modelldraht aus `kette.ts` (`draht.lage`), der
//      jede Generierung zählt, die über `fetch` hinausginge.
//   4. DATENBANK (nur im PostgreSQL-Lauf): jede SQL-Anweisung an eine Inhaltstabelle, mitgeschnitten
//      am Treiber (`pg.Client.prototype.query`) — unterhalb jedes Produktcodes.
//
// NUR DIE FRAGE ZÄHLT. Gezählt wird ausschliesslich im asynchronen Kontext einer Frage-Anfrage
// (`POST /api/ask`, `POST /api/reasoner`, s. `frageAnfragenMarkieren`). Liest die Fläche daneben die
// Bestandsliste (`GET /api/kos`), ist das der MENSCHLICHE Leseweg und kein KI-bedingter Zugriff.
//
// ANGEHALTEN WIRD NACH EINEM LESEN, nicht davor (`anhalten`): die Ausführung liest, ist damit
// gezählt, und bleibt stehen, bevor das Gelesene an ihren Aufrufer zurückgeht. Was nach der
// Freigabe noch gelesen wird, geschah NACH der bestätigten Abschaltung — genau das muss null sein.
//
// DIE GEGENPROBEN (`sperreEntfernen`) nehmen die Sperre an benannten Prüfpunkten heraus und setzen
// sie danach zurück: die Prüfpunkte des Fragedienstes (`AskService.pruefeKiSperre`) nach ihrem
// Namen, dazu die Prüfung am Modell-Chokepoint (`Reasoner.kiSperreVorUebertragung`).
import { AsyncLocalStorage } from "node:async_hooks";
import type { FastifyInstance } from "fastify";
import pg, { type Pool } from "pg";
import type { AppServices } from "../../services/app/src/build-app";
import {
  resetModelSemaphoreForTests,
  withModelSlot,
} from "../../services/reasoner/src/model-concurrency";
import type { Draht } from "../klara-quellen-nutzerweg/kette";

export interface Grenzstand {
  /** Ausführungen je Ablagemethode, `<ablage>.<methode>` — nur im Kontext einer Frage-Anfrage. */
  lesen: Record<string, number>;
  antwortweg: number;
  modell: number;
  /** Die Reihenfolge der gezählten Ablagezugriffe — damit ein Befund sagt, WAS zuerst geschah. */
  folge: string[];
}

export type Grenze = "lesen" | "antwortweg" | "modell";

/** Eine angehaltene Ausführung: sie hat gelesen und steht, bis sie freigegeben wird. */
export interface Halt {
  /** Erfüllt, sobald die Ausführung ihr Lesen beendet hat und wartet. */
  erreicht: Promise<void>;
  freigeben(): void;
}

export interface Grenzen {
  stand(): Grenzstand;
  /**
   * Die nächste Ausführung dieses Punktes im Frage-Kontext bleibt NACH ihrem Lesen stehen. Punkte:
   * `<ablage>.<methode>` (s. `ablagen`) oder `antwort` (nach `Reasoner.answer`, vor der Rückgabe).
   * `mal` wählt das wievielte Auftreten ab jetzt (Vorgabe: das nächste).
   */
  anhalten(punkt: string, mal?: number): Halt;
  abbauen(): void;
}

// ------------------------------------------------------------------------------------------------
// DER FRAGE-KONTEXT
// ------------------------------------------------------------------------------------------------

const frageKontext = new AsyncLocalStorage<{ frage: true }>();

function inFrage(): boolean {
  return frageKontext.getStore()?.frage === true;
}

/**
 * Vor `ready()` anzubringen (`appAufbauen(…, …, frageAnfragenMarkieren)` bzw. `platz.ts`):
 * markiert die Frage-Anfragen für Zähler und Mitschnitt.
 */
export function frageAnfragenMarkieren(app: FastifyInstance): void {
  app.addHook("onRequest", (request, _reply, done) => {
    const pfad = request.url.split("?")[0] ?? "";
    // R-0700: Klaras eigener Ausführungszugang ist der dritte Frage-Eingang.
    const klaraAusfuehrung = /^\/api\/klara\/sessions\/[^/]+\/execute$/.test(pfad);
    if (
      request.method === "POST" &&
      (pfad === "/api/ask" || pfad === "/api/reasoner" || klaraAusfuehrung)
    ) {
      frageKontext.run({ frage: true }, done);
      return;
    }
    done();
  });
}

// ------------------------------------------------------------------------------------------------
// DIE ABLAGEN
// ------------------------------------------------------------------------------------------------

type Beliebig = Record<string, unknown>;

/** Welche Ablage unter welchem Namen gezählt wird — gelesen an den Instanzen der laufenden App. */
function ablagen(dienste: AppServices): [string, unknown][] {
  const ko = dienste.ko as unknown as Beliebig;
  const suche = ko.searchProjections as Beliebig | undefined;
  const ask = dienste.ask as unknown as Beliebig;
  const konflikte = (dienste as unknown as { conflicts?: Beliebig }).conflicts;
  return [
    ["ko", ko.repo],
    ["fassungen", ko.versions],
    ["suchprojektion", suche],
    ["metadaten", suche?.metadata],
    // Die In-Memory-Suche liest den Bestand über ihre eigene Referenz; ist es dieselbe Instanz wie
    // `ko.repo`, wird sie unten nur einmal (als `ko`) umwickelt.
    ["ko", suche?.kos],
    ["luecken", ask.gaps],
    ["belege", ask.answerSnapshots],
    ["konflikte", konflikte?.repo],
  ];
}

/** Alle Methodennamen einer Instanz, über die ganze Prototypkette — ohne Zugriffsfunktionen. */
function methoden(objekt: object): string[] {
  const namen = new Set<string>();
  let stufe: object | null = objekt;
  while (stufe && stufe !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(stufe)) {
      const d = Object.getOwnPropertyDescriptor(stufe, name);
      if (name !== "constructor" && d && typeof d.value === "function") {
        namen.add(name);
      }
    }
    stufe = Object.getPrototypeOf(stufe);
  }
  return [...namen];
}

function istVersprechen(wert: unknown): wert is Promise<unknown> {
  return typeof (wert as { then?: unknown } | null)?.then === "function";
}

export function grenzenZaehlen(dienste: AppServices, draht: Draht): Grenzen {
  const lesen: Record<string, number> = {};
  const folge: string[] = [];
  let antwortweg = 0;
  const halte = new Map<string, { rest: number; erreicht: () => void; warten: Promise<void> }>();
  const abbau: (() => void)[] = [];
  const umwickelt = new Set<object>();

  // Hält die Ausführung NACH dem Lesen an: das Ergebnis liegt vor, geht aber erst nach der Freigabe
  // an den Aufrufer zurück. Nur im Frage-Kontext, und nur die NÄCHSTE Ausführung dieses Punktes.
  const vielleichtHalten = (punkt: string, ergebnis: unknown): unknown => {
    const halt = halte.get(punkt);
    if (!halt || !istVersprechen(ergebnis)) {
      return ergebnis;
    }
    if (halt.rest > 1) {
      halt.rest -= 1;
      return ergebnis;
    }
    halte.delete(punkt);
    return ergebnis.then(async (wert) => {
      halt.erreicht();
      await halt.warten;
      return wert;
    });
  };

  const einzeln = (ziel: Beliebig, name: string, zaehlen: () => void, punkt: string): void => {
    const original = ziel[name] as (...args: unknown[]) => unknown;
    const hatteEigene = Object.hasOwn(ziel, name);
    ziel[name] = (...args: unknown[]): unknown => {
      if (!inFrage()) {
        return original.apply(ziel, args);
      }
      zaehlen();
      return vielleichtHalten(punkt, original.apply(ziel, args));
    };
    abbau.push(() => {
      if (hatteEigene) {
        ziel[name] = original;
      } else {
        Reflect.deleteProperty(ziel, name);
      }
    });
  };

  for (const [ablage, instanz] of ablagen(dienste)) {
    if (!instanz || typeof instanz !== "object" || umwickelt.has(instanz)) {
      continue;
    }
    umwickelt.add(instanz);
    for (const name of methoden(instanz)) {
      const punkt = `${ablage}.${name}`;
      einzeln(
        instanz as Beliebig,
        name,
        () => {
          lesen[punkt] = (lesen[punkt] ?? 0) + 1;
          folge.push(punkt);
        },
        punkt,
      );
    }
  }
  // Ohne Bestandsablage und Suche gäbe es nichts, dessen Nullbleiben etwas bewiese. Ob sie WIRKLICH
  // gelesen werden, zeigt erst die Ausgangsfrage (`vorrichtung()` verlangt dort Zählerstände).
  const ko = dienste.ko as unknown as Beliebig;
  if (!ko.repo || !ko.searchProjections) {
    throw new Error("D5-Zähler: KoService trägt `repo`/`searchProjections` nicht mehr.");
  }
  if (!(dienste as unknown as { conflicts?: Beliebig }).conflicts?.repo) {
    throw new Error("D5-Zähler: ConflictService trägt `repo` nicht mehr.");
  }

  const reasoner = dienste.reasoner as unknown as Beliebig;
  for (const name of ["answer", "answerRetrievalOnly"]) {
    if (typeof reasoner[name] !== "function") {
      throw new Error(`D5-Zähler: Reasoner.${name} gibt es nicht — die Grenze ist verschoben.`);
    }
    einzeln(
      reasoner,
      name,
      () => {
        antwortweg += 1;
      },
      "antwort",
    );
  }

  return {
    stand: () => ({
      lesen: { ...lesen },
      antwortweg,
      modell: draht.lage.generierungen,
      folge: [...folge],
    }),
    anhalten(punkt, mal = 1) {
      let erreicht!: () => void;
      let freigeben!: () => void;
      const erreichtVersprechen = new Promise<void>((r) => {
        erreicht = r;
      });
      const warten = new Promise<void>((r) => {
        freigeben = r;
      });
      halte.set(punkt, { rest: mal, erreicht, warten });
      return { erreicht: erreichtVersprechen, freigeben };
    },
    abbauen() {
      for (const zurueck of abbau.reverse()) {
        zurueck();
      }
    },
  };
}

/** Der Unterschied zweier Stände — was ZWISCHEN den beiden Messpunkten geschah. */
export function differenz(vorher: Grenzstand, nachher: Grenzstand): Grenzstand {
  const lesen: Record<string, number> = {};
  for (const punkt of new Set([...Object.keys(vorher.lesen), ...Object.keys(nachher.lesen)])) {
    const d = (nachher.lesen[punkt] ?? 0) - (vorher.lesen[punkt] ?? 0);
    if (d !== 0) {
      lesen[punkt] = d;
    }
  }
  return {
    lesen,
    antwortweg: nachher.antwortweg - vorher.antwortweg,
    modell: nachher.modell - vorher.modell,
    folge: nachher.folge.slice(vorher.folge.length),
  };
}

/** Alle Ablagezugriffe eines Standes zusammen. */
export function gelesen(d: Grenzstand): number {
  return Object.values(d.lesen).reduce((a, b) => a + b, 0);
}

/**
 * Der BEFUND „nach der Sperre kein KI-bedingter Zugriff" — als Satz, nicht als Boolean.
 *
 * Leer heisst: an keiner der Grenzen ist etwas passiert. Sonst steht da, WO — beim Lesen mit der
 * Ablagemethode und in der Reihenfolge, in der es geschah.
 */
export function zugriffsbefund(d: Grenzstand, grenzen: readonly Grenze[]): string {
  const teile: string[] = [];
  if (grenzen.includes("lesen") && gelesen(d) > 0) {
    teile.push(`lesen[${d.folge.join(" → ")}]`);
  }
  for (const g of ["antwortweg", "modell"] as const) {
    if (grenzen.includes(g) && d[g] !== 0) {
      teile.push(`${g}=${d[g]}`);
    }
  }
  return teile.join(" · ");
}

export const ALLE_GRENZEN: readonly Grenze[] = ["lesen", "antwortweg", "modell"];

/** Nach einer Freigabe: warten, bis die freigegebene Ausführung zu Ende gelaufen ist. */
export async function ruhe(ms = 150): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

// ------------------------------------------------------------------------------------------------
// DIE GEGENPROBEN
// ------------------------------------------------------------------------------------------------

/** Die benannten Prüfpunkte — die des Fragedienstes und die am Modell-Chokepoint. */
export type Pruefpunkt =
  /** Die Route vor dem Dienst, nach Anmeldung und Klara-Einwilligung (Lauf 5 Runde 2, Bens B1). */
  | "diensteinstieg"
  | "vorauswahl"
  | "suchprojektion"
  | "antwortweg"
  | "ergebnis"
  | "auslieferung"
  | "uebertragung"
  /** Die Abschalt-Epoche: ohne sie zählt nur noch der AKTUELLE Zustand (Stand vor Runde 3). */
  | "epoche";

/**
 * GEGENPROBE: die Sperre an den genannten Prüfpunkten herausnehmen. Gibt den Rückbau zurück; ohne
 * ihn bliebe die Gegenprobe in jedem folgenden Fall wirksam.
 */
export function sperreEntfernen(
  dienste: AppServices,
  entfernt: ReadonlySet<Pruefpunkt>,
): () => void {
  const ask = dienste.ask as unknown as {
    pruefeKiSperre?: (schritt: string, ...rest: unknown[]) => void;
    kiSperre?: { abgeschaltet(): boolean; stand(): number };
  };
  const reasoner = dienste.reasoner as unknown as {
    kiSperreVorUebertragung?: (...args: unknown[]) => void;
  };
  const echt = ask.pruefeKiSperre;
  if (typeof echt !== "function" || typeof reasoner.kiSperreVorUebertragung !== "function") {
    throw new Error(
      "D5-Gegenprobe: der Frageweg trägt die benannten Sperren nicht — dann gibt es nichts zu entfernen, und die Gegenprobe wäre wertlos.",
    );
  }
  ask.pruefeKiSperre = function (this: unknown, schritt: string, ...rest: unknown[]) {
    if (entfernt.has(schritt as Pruefpunkt)) {
      return;
    }
    echt.call(this, schritt, ...rest);
  };
  if (entfernt.has("uebertragung")) {
    reasoner.kiSperreVorUebertragung = () => undefined;
  }
  // Ohne Epoche: die Sperre sieht nur noch, ob JETZT abgeschaltet ist (eine feste Zahl ändert sich nie).
  const echteSperre = ask.kiSperre;
  if (entfernt.has("epoche")) {
    if (!echteSperre) {
      throw new Error("D5-Gegenprobe: der Frageweg trägt keine KI-Sperre mit Epoche.");
    }
    ask.kiSperre = { abgeschaltet: () => echteSperre.abgeschaltet(), stand: () => 0 };
  }
  return () => {
    Reflect.deleteProperty(ask, "pruefeKiSperre");
    Reflect.deleteProperty(reasoner, "kiSperreVorUebertragung");
    if (echteSperre) {
      ask.kiSperre = echteSperre;
    }
  };
}

// ------------------------------------------------------------------------------------------------
// DER MODELLPLATZ — EINE AUSFÜHRUNG VOR DER ÜBERTRAGUNG ANHALTEN
// ------------------------------------------------------------------------------------------------

export interface Modellplatz {
  /** Den belegten Platz freigeben: die wartende Ausführung erhält ihn und geht an den Chokepoint. */
  freigeben(): void;
  /** Umgebung und Semaphore wiederherstellen. */
  abbauen(): void;
}

/**
 * Belegt den EINZIGEN Modellplatz (`KLARWERK_MODEL_MAX_INFLIGHT=1`), damit der nächste Modellaufruf
 * im Slot-Rahmen wartet — genau zwischen Kettenbildung und Übertragung (`cappedModelClient`).
 */
export function modellplatzBelegen(): Modellplatz {
  const gemerkt = process.env.KLARWERK_MODEL_MAX_INFLIGHT;
  process.env.KLARWERK_MODEL_MAX_INFLIGHT = "1";
  resetModelSemaphoreForTests();
  let freigeben!: () => void;
  const belegt = new Promise<void>((r) => {
    freigeben = r;
  });
  void withModelSlot(() => belegt);
  return {
    freigeben,
    abbauen() {
      freigeben();
      if (gemerkt === undefined) {
        Reflect.deleteProperty(process.env, "KLARWERK_MODEL_MAX_INFLIGHT");
      } else {
        process.env.KLARWERK_MODEL_MAX_INFLIGHT = gemerkt;
      }
      resetModelSemaphoreForTests();
    },
  };
}

// ================================================================================================
// DATENBANK-MITSCHNITT — NUR FÜR DEN POSTGRESQL-LAUF.
// ================================================================================================

/** Die Tabellen, in denen Kundeninhalt steht (Bestand, Fassungen, Suchtext, Originale, Belege). */
const INHALTSTABELLEN =
  /\b(from|join|into|update)\s+(kos|ko_versions|ko_search_projections|ko_metadata_projections|ko_evidence|objects|answer_snapshots|answer_records|gaps|conflicts)\b/i;

// WARUM DER MITSCHNITT AN DIE ANFRAGE GEBUNDEN IST — gemessen, nicht vorsorglich. Die erste Fassung
// schnitt ein ZEITFENSTER mit, und im ersten PostgreSQL-Lauf stand darin
// `SELECT data FROM kos WHERE (kos.deleted_at_key IS NULL AND (kos.confidentiality_key = …` — die
// Bestandsliste, die die Fragefläche beim Laden für die Quellentitel holt (`useKos` → `GET /api/kos`).
// Das ist der MENSCHLICHE Leseweg und ausdrücklich kein KI-bedingter Zugriff; ihn mitzuzählen hiesse,
// dem Leserecht die Abschaltung anzulasten. Gezählt wird deshalb nur, was im asynchronen Kontext
// einer Frage-Anfrage an den Treiber geht.
//
// DIE GRENZE DIESER ZUORDNUNG, benannt statt verschwiegen: muss eine Anfrage auf eine freie
// Verbindung WARTEN, ruft der Pool sie aus dem Kontext der freigebenden Anfrage zurück — dann wäre
// die Zuordnung falsch. Das wird nicht angenommen, sondern bei jeder Anweisung am Pool abgelesen;
// hat je eine Anfrage gewartet, scheitert `beenden()` laut, statt eine Null zu melden.
//
// ANHALTEN AUF SQL-EBENE (`anhaltenNach`): die nächste Anweisung des Frage-Kontexts, deren Text zum
// Muster passt, läuft durch — ihr ERGEBNIS aber geht erst nach der Freigabe an den Aufrufer. Das ist
// die Lage aus Bens Probe, nur eine Ebene tiefer: gelesen, angehalten, dann abgeschaltet.
//
// `parameter` (Lauf 2, im ersten eigenen PostgreSQL-Lauf gemessen): die Vorauswahl stellt JE
// SUCHBEGRIFF eine eigene Suchabfrage, gleichzeitig. Ohne Parameterbedingung hielt der Halt die
// erste beliebige an — war deren Begriff trefferlos, folgte kein Nachladen, und die Gegenprobe sah
// „nichts gelesen", obwohl die Sperre fehlte. Mit ihr wird genau die Abfrage des tragenden Begriffs
// angehalten.

export interface SqlMitschnitt {
  /** Mitschneiden bis `beenden()` — nur Anweisungen aus Frage-Anfragen an Inhaltstabellen. */
  beginnen(pool: Pool): void;
  beenden(): string[];
  /** Die nächste passende Anweisung einer Frage-Anfrage nach ihrer Ausführung anhalten. */
  anhaltenNach(muster: RegExp, parameter?: RegExp): Halt;
  abbauen(): void;
}

export function sqlMitschnitt(): SqlMitschnitt {
  const proto = pg.Client.prototype as unknown as { query: (...args: unknown[]) => unknown };
  const original = proto.query;
  let aktiv: Pool | null = null;
  let gewartet = 0;
  let gesehen: string[] = [];
  let halt: {
    muster: RegExp;
    parameter: RegExp | undefined;
    erreicht: () => void;
    warten: Promise<void>;
  } | null = null;
  proto.query = function (this: unknown, ...args: unknown[]) {
    const erstes = args[0];
    const text =
      typeof erstes === "string"
        ? erstes
        : typeof (erstes as { text?: unknown } | null)?.text === "string"
          ? (erstes as { text: string }).text
          : "";
    const frage = inFrage();
    if (aktiv) {
      gewartet = Math.max(gewartet, aktiv.waitingCount);
      if (frage && INHALTSTABELLEN.test(text)) {
        gesehen.push(text.replace(/\s+/g, " ").slice(0, 160));
      }
    }
    const ergebnis = original.apply(this, args);
    const h = halt;
    const werte =
      (Array.isArray(args[1]) ? args[1] : (erstes as { values?: unknown } | null)?.values) ?? [];
    if (
      frage &&
      h &&
      h.muster.test(text) &&
      (!h.parameter || h.parameter.test(JSON.stringify(werte))) &&
      istVersprechen(ergebnis)
    ) {
      halt = null;
      return ergebnis.then(async (wert) => {
        h.erreicht();
        await h.warten;
        return wert;
      });
    }
    return ergebnis;
  };
  return {
    beginnen(pool) {
      gesehen = [];
      gewartet = 0;
      aktiv = pool;
    },
    beenden() {
      aktiv = null;
      if (gewartet > 0) {
        throw new Error(
          `D5-SQL-Mitschnitt UNZUVERLÄSSIG: im Messfenster warteten bis zu ${gewartet} Anfragen auf eine Verbindung — die Zuordnung zur Frage-Anfrage ist dann nicht belegt, und eine Null wäre keine Aussage.`,
        );
      }
      return gesehen;
    },
    anhaltenNach(muster, parameter) {
      let erreicht!: () => void;
      let freigeben!: () => void;
      const erreichtVersprechen = new Promise<void>((r) => {
        erreicht = r;
      });
      const warten = new Promise<void>((r) => {
        freigeben = r;
      });
      halt = { muster, parameter, erreicht, warten };
      return { erreicht: erreichtVersprechen, freigeben };
    },
    abbauen() {
      proto.query = original;
    },
  };
}
