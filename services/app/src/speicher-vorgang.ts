// ==================================================================================================
// Auftrag gesamt-dubletten-rueckzug (Runden 2/3, Bens BEN-R3-1..3) — DIE RÜCKNAHME-KLAMMER OHNE
// DATENBANK.
// ==================================================================================================
//
// Rückzug und Wiederherstellen (KoService.delete/restore → `imRuecknahmeVorgang`) sind atomar. Mit
// PostgreSQL trägt das `withPgTx`. Ohne Datenbank — InMemory und das Dev-Journal der Desktop-App —
// gibt diese Klammer dieselbe Zusage:
//
//   VORHER-ABBILD  Jede schreibende Ablage-Methode, die im Körper mit dem Kontext DIESES Vorgangs
//                  gerufen wird, hinterlegt vor dem Schreiben, wie ihre Zeilen vorher aussahen.
//   ROLLBACK       Wirft der Körper ODER der Journal-Abschluss, stellt die Klammer alle Schritte in
//                  umgekehrter Reihenfolge exakt zurück (`zuruecksetzen` bzw. `verwerfen`) und wirft
//                  den Fehler weiter.
//   JOURNAL        Das Dev-Journal hält die Zeilen des Vorgangs zurück (`journalZeileFuer`) und
//                  schreibt sie beim Abschluss als EINE Journalzeile (dev-persist.ts,
//                  `VORGANG_ZEILE`). Das Replay wendet sie nur als Ganzes an und nur mit ihrer
//                  Bestätigungszeile (Lauf 5, BEN-R4-1). Kehrt der Abschluss zurück, wirkt der
//                  Vorgang auch nach Replay; wirft er, wird der Speicher zurückgestellt. Ist der
//                  Ausgang ungewiss (Lauf 5, Runde 2, BEN-R5-1: `JournalAusgangUngewiss`), liefert
//                  das Journal bis zur Klärung an der Datei nichts aus und trägt den Vorgang dann
//                  nach, wenn die Datei ihn trägt (dev-persist.ts, `mitBestaetigung`).
//   ISOLATION      (Runde 3, BEN-R3-3) Die Klammer hält für die ganze Dauer des Vorgangs eine
//                  Sperre. Unter derselben Sperre schreibt der Audit-Dienst ausserhalb eines
//                  Vorgangs seine Kettenglieder (`kettenSperre`: `last` + `append` ungeteilt). Jeder
//                  andere Aufruf der vier Ablagen OHNE Vorgangskontext wartet, solange ein Vorgang
//                  offen ist. Ein unabhängiger Schreiber sieht so nie unbestätigte Zeilen, sein
//                  Beleg hängt nie an einem gepufferten Beleg, und seine Journalzeile folgt der des
//                  Vorgangs.
//   FAIL-CLOSED    Eine schreibende Methode mit dem Vorgangskontext, für die es keine Rückstellung
//                  gibt, wird NICHT ausgeführt, sondern wirft — der Vorgang rollt dann zurück.
//
// Die Isolation umfasst die vier Ablagen dieses Wegs (Wissensobjekte, Überschneidungen, Konflikte,
// Belege). Andere Ablagen beschreibt der Vorgang nicht.
import type { TxContext } from "../../db-tx";
import type { WithTx } from "../../knowledge-object";

// Die vier Ablagen, die der Rücknahme-Weg beschreibt — strukturell, ohne Rückgriff auf
// `AppRepos` (build-app.ts importiert diese Datei; ein Rückimport wäre ein Zyklus).
type Ablagen = { koRepo: object; overlapRepo: object; conflictsRepo: object; auditRepo: object };
type AblageName = keyof Ablagen;

interface OffenerVorgang {
  readonly rueckstellungen: (() => void)[];
  // Je Journal (Abschlussfunktion) die zurückgehaltenen Zeilen in Schreibreihenfolge.
  readonly journal: Map<(zeilen: unknown[]) => void, unknown[]>;
}

const offeneVorgaenge = new WeakMap<object, OffenerVorgang>();

function vorgangIn(args: readonly unknown[]): OffenerVorgang | undefined {
  for (const arg of args) {
    if (typeof arg === "object" && arg !== null) {
      const vorgang = offeneVorgaenge.get(arg);
      if (vorgang) {
        return vorgang;
      }
    }
  }
  return undefined;
}

/**
 * Für das Dev-Journal (dev-persist.ts): gehört dieser Aufruf zu einem offenen Vorgang, wird `zeile`
 * bis zu dessen Abschluss zurückgehalten (Rückgabe `true`); beim Abschluss ruft die Klammer
 * `abschluss` EINMAL mit allen Zeilen des Vorgangs. Sonst `false` — sofort schreiben. Der
 * Vorgangskontext selbst wird nicht journaliert (`ohneVorgang`).
 */
export function journalZeileFuer<Z>(
  args: readonly unknown[],
  zeile: Z,
  abschluss: (zeilen: Z[]) => void,
): boolean {
  const vorgang = vorgangIn(args);
  if (!vorgang) {
    return false;
  }
  const schluessel = abschluss as (zeilen: unknown[]) => void;
  const zeilen = vorgang.journal.get(schluessel) ?? [];
  zeilen.push(zeile);
  vorgang.journal.set(schluessel, zeilen);
  return true;
}

/** Die Argumente ohne den Vorgangskontext — die Journalzeile trägt ihn nicht. */
export function ohneVorgang(args: readonly unknown[]): unknown[] {
  return args.map((arg) =>
    typeof arg === "object" && arg !== null && offeneVorgaenge.has(arg) ? undefined : arg,
  );
}

type Methode = (...args: unknown[]) => Promise<unknown>;
type Erfassung = (
  ziel: Record<string, unknown>,
  echt: Methode,
  args: unknown[],
  vorgang: OffenerVorgang,
) => Promise<unknown>;

/** Eine Methode der Ablage, an die Ablage gebunden (auch ohne umhüllenden Proxy). */
function gebunden<F>(ziel: Record<string, unknown>, name: string): F {
  return (ziel[name] as (...args: unknown[]) => unknown).bind(ziel) as F;
}

function hatMethoden(ziel: object, namen: readonly string[]): boolean {
  const r = ziel as Record<string, unknown>;
  return namen.every((n) => typeof r[n] === "function");
}

// Mengenbasiertes Schliessen (Konflikte, Überschneidungen): Vorher-Abbild aller Einträge, danach je
// geschlossenem Eintrag eine exakte Rückstellung.
const schliessenErfassen: Erfassung = async (ziel, echt, args, vorgang) => {
  const alle = (await gebunden<() => Promise<{ id: string }[]>>(ziel, "all")()) ?? [];
  const vorher = new Map(alle.map((e) => [e.id, e]));
  const geschlossen = (await echt(...args)) as { id: string }[];
  const zuruecksetzen = gebunden<(id: string, v: unknown) => void>(ziel, "zuruecksetzen");
  for (const e of geschlossen) {
    vorgang.rueckstellungen.push(() => zuruecksetzen(e.id, vorher.get(e.id)));
  }
  return geschlossen;
};

const ERFASSUNG: Readonly<Record<AblageName, Readonly<Record<string, Erfassung>>>> = {
  koRepo: {
    update: async (ziel, echt, args, vorgang) => {
      const neu = args[0] as { id: string };
      const vorher = await gebunden<(id: string) => Promise<unknown>>(ziel, "findById")(neu.id);
      const ergebnis = await echt(...args);
      const zuruecksetzen = gebunden<(id: string, v: unknown) => void>(ziel, "zuruecksetzen");
      vorgang.rueckstellungen.push(() => zuruecksetzen(neu.id, vorher));
      return ergebnis;
    },
  },
  overlapRepo: { closeOpenForKo: schliessenErfassen },
  conflictsRepo: { closeOpenForKo: schliessenErfassen },
  auditRepo: {
    append: async (ziel, echt, args, vorgang) => {
      const eintrag = args[0] as { seq: number };
      const ergebnis = await echt(...args);
      const verwerfen = gebunden<(seq: number) => void>(ziel, "verwerfen");
      vorgang.rueckstellungen.push(() => verwerfen(eintrag.seq));
      return ergebnis;
    },
    appendOnce: async (ziel, echt, args, vorgang) => {
      const eintrag = args[0] as { seq: number };
      const geschrieben = await echt(...args);
      if (geschrieben === true) {
        const verwerfen = gebunden<(seq: number) => void>(ziel, "verwerfen");
        vorgang.rueckstellungen.push(() => verwerfen(eintrag.seq));
      }
      return geschrieben;
    },
  },
};

// Die schreibenden Methoden der vier Ablagen. Mit Vorgangskontext gerufen, ohne Erfassung oben,
// werden sie abgewiesen (fail-closed). Mindestens die Mutationsflächen des Dev-Journals
// (dev-persist.ts, `MUTATING_METHODS`) — der Abgleich steht in
// tests/dubletten-ruecknahme-lesepfad/atomar-ohne-datenbank.test.ts. Alles andere sind Lesezugriffe
// und laufen durch (z. B. `audit.last(tx)` für die Kette).
export const SCHREIBEND: Readonly<Record<AblageName, readonly string[]>> = {
  koRepo: ["insert", "update", "delete", "setAiCheck", "resolveAiCheck", "bumpTrust"],
  overlapRepo: ["insert", "insertIfVersionsCurrent", "supersedeIfOpen", "update", "closeOpenForKo"],
  conflictsRepo: [
    "insert",
    "insertIfVersionsCurrent",
    "supersedeIfOpen",
    "update",
    "closeOpenForKo",
  ],
  auditRepo: ["append", "appendOnce"],
};

// Welche Rückstellmethoden eine Ablage braucht, damit die Klammer sie führen kann.
const RUECKSTELLUNG: Readonly<Record<AblageName, readonly string[]>> = {
  koRepo: ["findById", "zuruecksetzen"],
  overlapRepo: ["all", "zuruecksetzen"],
  conflictsRepo: ["all", "zuruecksetzen"],
  auditRepo: ["verwerfen"],
};

/** Der Zustand einer Klammer: ist gerade ein Vorgang offen, und wann endet er? */
interface KlammerZustand {
  offen: Promise<void> | undefined;
}

/** Wartet, bis kein Vorgang dieser Klammer mehr offen ist. */
async function frei(zustand: KlammerZustand): Promise<void> {
  while (zustand.offen) {
    await zustand.offen;
  }
}

function erfassend<T extends object>(ablage: T, name: AblageName, zustand: KlammerZustand): T {
  const erfassung = ERFASSUNG[name];
  const schreibend = SCHREIBEND[name];
  return new Proxy(ablage, {
    get(ziel, prop, receiver) {
      const wert = Reflect.get(ziel, prop, receiver);
      if (typeof wert !== "function" || typeof prop !== "string") {
        return wert;
      }
      const echt = (wert as Methode).bind(ziel);
      return (...args: unknown[]) => {
        const vorgang = vorgangIn(args);
        if (!vorgang) {
          // Ohne Vorgangskontext: sofort, wenn kein Vorgang offen ist — sonst erst nach dessen
          // Abschluss bzw. Rückstellung (keine unbestätigten Zeilen lesen oder überschreiben).
          return zustand.offen ? frei(zustand).then(() => echt(...args)) : echt(...args);
        }
        const erfassen = erfassung[prop];
        if (erfassen) {
          return erfassen(ziel as Record<string, unknown>, echt, args, vorgang);
        }
        if (!schreibend.includes(prop)) {
          return echt(...args);
        }
        return Promise.reject(
          new Error(
            `${String(name)}.${prop} ist im Rücknahme-Vorgang ohne Datenbank nicht rückstellbar.`,
          ),
        );
      };
    },
  });
}

/**
 * Baut die Klammer über einem Ablagensatz ohne Datenbank. Liefert die zu verwendenden Ablagen
 * (erfassend), die Klammer und die Kettensperre für den Audit-Dienst — oder `undefined`, wenn eine
 * der vier beteiligten Ablagen keine exakte Rückstellung kann (ein Test-Double ohne
 * `zuruecksetzen`/`verwerfen`); dann bleibt es beim Weg ohne Klammer.
 */
export function speicherVorgang<R extends Ablagen>(
  repos: R,
):
  | {
      repos: R;
      klammer: WithTx;
      kettenSperre: <T>(tx: TxContext | undefined, fn: () => Promise<T>) => Promise<T>;
    }
  | undefined {
  for (const [name, noetig] of Object.entries(RUECKSTELLUNG)) {
    if (!hatMethoden(repos[name as AblageName], noetig)) {
      return undefined;
    }
  }
  const zustand: KlammerZustand = { offen: undefined };
  const erfasst: R = {
    ...repos,
    koRepo: erfassend(repos.koRepo, "koRepo", zustand),
    overlapRepo: erfassend(repos.overlapRepo, "overlapRepo", zustand),
    conflictsRepo: erfassend(repos.conflictsRepo, "conflictsRepo", zustand),
    auditRepo: erfassend(repos.auditRepo, "auditRepo", zustand),
  };
  const eigeneKontexte = new WeakSet<object>();

  // Die EINE Sperre: Vorgänge dieser Klammer und Kettenglieder des Audit-Dienstes ausserhalb eines
  // Vorgangs laufen nacheinander.
  let kette: Promise<unknown> = Promise.resolve();
  function exklusiv<T>(fn: () => Promise<T>): Promise<T> {
    const lauf = kette.then(fn);
    kette = lauf.catch(() => undefined);
    return lauf;
  }

  const kettenSperre = <T>(tx: TxContext | undefined, fn: () => Promise<T>): Promise<T> =>
    tx && eigeneKontexte.has(tx) ? fn() : exklusiv(fn);

  function zurueckstellen(vorgang: OffenerVorgang, fehler: unknown): never {
    // Jeder Schritt wird zurückgestellt, auch wenn ein einzelner dabei scheitert; ein solches
    // Scheitern wird NICHT verschwiegen, sondern mit dem Ausgangsfehler gemeldet.
    const gescheitert: unknown[] = [];
    for (const zurueck of [...vorgang.rueckstellungen].reverse()) {
      try {
        zurueck();
      } catch (e) {
        gescheitert.push(e);
      }
    }
    if (gescheitert.length > 0) {
      throw new AggregateError(
        [fehler, ...gescheitert],
        "Rücknahme-Vorgang gescheitert und nicht vollständig zurückgestellt",
      );
    }
    throw fehler;
  }

  const klammer: WithTx = <T>(fn: (tx: TxContext) => Promise<T>): Promise<T> =>
    exklusiv(async () => {
      const kontext: TxContext = { brand: "TxContext" };
      const vorgang: OffenerVorgang = { rueckstellungen: [], journal: new Map() };
      offeneVorgaenge.set(kontext, vorgang);
      eigeneKontexte.add(kontext);
      let beenden: () => void = () => undefined;
      zustand.offen = new Promise<void>((r) => {
        beenden = r;
      });
      try {
        let ergebnis: T;
        try {
          ergebnis = await fn(kontext);
          // Der Journal-Abschluss gehört zum Vorgang: je Journal EIN Aufruf mit allen Zeilen.
          // Wirft er, gilt der Vorgang als gescheitert und wird zurückgestellt.
          for (const [abschluss, zeilen] of vorgang.journal) {
            abschluss(zeilen);
          }
        } catch (fehler) {
          zurueckstellen(vorgang, fehler);
        }
        return ergebnis;
      } finally {
        offeneVorgaenge.delete(kontext);
        eigeneKontexte.delete(kontext);
        zustand.offen = undefined;
        beenden();
      }
    });

  return { repos: erfasst, klammer, kettenSperre };
}
