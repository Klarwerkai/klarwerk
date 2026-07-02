// SCRUM-387: Lokale Dev-Persistenz für die KLARWERK Desktop-App.
//
// Problem: Ohne DATABASE_URL läuft der Monolith in-memory — jeder Neustart löscht Nutzer und
// Daten, Pedi landet immer wieder in der Ersteinrichtung. Docker/Postgres ist auf dem Ziel-Mac
// nicht verlässlich vorhanden (Stakeholder-Auskunft 02.07.), daher Lösungsweg 2 des Arbeitsbriefs.
//
// Ansatz: MUTATIONS-JOURNAL statt Zustands-Snapshot. Jede schreibende Repo-Methode wird über die
// BESTEHENDEN öffentlichen Repo-Interfaces abgefangen (Proxy in der Kompositionswurzel — kein
// Griff in Modul-Interna, keine Modul-Änderung) und nach erfolgreicher Ausführung als eine
// JSONL-Zeile angehängt (append-only, damit crash-sicher: eine ggf. halb geschriebene letzte
// Zeile wird beim Laden defensiv verworfen). Beim Start wird das Journal in frische In-Memory-
// Repos zurückgespielt — die Repos sind deterministische Zustandsautomaten ohne interne
// ID-/Zeit-Erzeugung, das Replay ist daher exakt.
//
// Bewusst NUR Dev: aktiviert ausschließlich über KLARWERK_DEV_PERSIST=1 (setzt nur die
// Desktop-App). Produktion bleibt Postgres (DATABASE_URL hat Vorrang, siehe server.ts).
// Die Journal-Datei liegt unter .localdb/ (gitignored) und enthält KEINE Klartext-Passwörter
// (Auth speichert Salt+Hash), aber Session-Token — sie bleibt deshalb lokal und unversioniert.
// Bekannte, akzeptierte Grenze: das Journal wächst monoton (Kompaktierung = Folge-Ticket).
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { type AppRepos, type AppServices, assembleServices, inMemoryRepos } from "./build-app";

// Eine Journal-Zeile: welches Repo, welche Methode, welche Argumente (JSON-serialisierbar —
// alle Repo-Entitäten sind reine Datenobjekte mit String-/Zahl-Feldern).
export interface JournalEntry {
  repo: string;
  method: string;
  args: unknown[];
}

// Schreibende Methoden je Repo — exakt die Mutationsflächen der öffentlichen Interfaces.
// Lesemethoden werden NICHT journaliert. Neue Mutationsmethoden müssen hier ergänzt werden
// (Test „deckt alle AppRepos-Schlüssel ab" schützt vor vergessenen ganzen Repos).
export const MUTATING_METHODS: Readonly<Record<keyof AppRepos, readonly string[]>> = {
  auditRepo: ["append"],
  koRepo: ["insert", "update", "delete"],
  koVersions: ["append"],
  evidence: ["append"],
  users: ["insert", "update", "delete"],
  sessions: ["create", "delete", "deleteByUser"],
  resetTokens: ["create", "delete"],
  drafts: ["insert", "update", "delete"],
  gaps: ["insert", "update", "delete"],
  ratings: ["upsert"],
  assignments: ["create", "update"],
  conflictsRepo: ["insert", "update"],
  lifecycleRepo: ["addCoupling", "markPending", "clearPending", "savePath", "setProgress"],
  objects: ["insert"],
  candidates: ["insert", "update"],
  modelRuns: ["append"],
} as const;

// Journal defensiv laden: fehlende Datei → leer; eine korrupte (z. B. beim Crash halb
// geschriebene) Zeile beendet das Einlesen ab dort — alles Gültige davor bleibt erhalten.
export function readJournal(file: string): JournalEntry[] {
  if (!existsSync(file)) {
    return [];
  }
  const entries: JournalEntry[] = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (line.trim().length === 0) {
      continue;
    }
    try {
      const parsed: unknown = JSON.parse(line);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        typeof (parsed as JournalEntry).repo === "string" &&
        typeof (parsed as JournalEntry).method === "string" &&
        Array.isArray((parsed as JournalEntry).args)
      ) {
        entries.push(parsed as JournalEntry);
      }
    } catch {
      break;
    }
  }
  return entries;
}

// Journal in frische Repos zurückspielen — ausschließlich über die öffentlichen Interfaces.
// Unbekannte Repo-/Methodennamen werden bewusst übersprungen (versionstolerant statt Crash).
export async function replayJournal(repos: AppRepos, entries: JournalEntry[]): Promise<void> {
  for (const entry of entries) {
    const allowed = MUTATING_METHODS[entry.repo as keyof AppRepos];
    if (!allowed || !allowed.includes(entry.method)) {
      continue;
    }
    const target = repos[entry.repo as keyof AppRepos] as unknown as Record<string, unknown>;
    const method = target[entry.method];
    if (typeof method === "function") {
      await (method as (...args: unknown[]) => Promise<unknown>).apply(target, entry.args);
    }
  }
}

// Proxy um ein Repo: Mutationen laufen unverändert durch und werden NACH Erfolg journaliert.
// Kein `any`: der Proxy erhält den konkreten Interface-Typ des Repos zurück.
function journaled<T extends object>(
  repo: T,
  name: keyof AppRepos,
  write: (entry: JournalEntry) => void,
): T {
  const mutators = MUTATING_METHODS[name];
  return new Proxy(repo, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") {
        return value;
      }
      const fn = value as (...args: unknown[]) => unknown;
      if (typeof prop !== "string" || !mutators.includes(prop)) {
        return fn.bind(target);
      }
      return async (...args: unknown[]) => {
        const result = await fn.apply(target, args);
        write({ repo: name, method: prop, args });
        return result;
      };
    },
  });
}

// Alle Repos eines Satzes journalieren (gemeinsame Schreibfunktion → EINE Datei).
export function journaledRepos(repos: AppRepos, write: (entry: JournalEntry) => void): AppRepos {
  const wrapped = {} as Record<keyof AppRepos, object>;
  for (const key of Object.keys(MUTATING_METHODS) as (keyof AppRepos)[]) {
    wrapped[key] = journaled(repos[key] as object, key, write);
  }
  return wrapped as unknown as AppRepos;
}

// Komposition „Dev-Persistenz": Journal laden → in In-Memory-Repos zurückspielen →
// Repos journalierend wrappen → identisch verdrahtete Service-Landschaft.
// append-only via appendFileSync: kein Rewrite der Datei bei jeder Mutation, crash-tolerant
// in Kombination mit dem defensiven Parser (s. o.).
export async function buildDevPersistServices(file: string): Promise<AppServices> {
  mkdirSync(dirname(file), { recursive: true });
  const repos = inMemoryRepos();
  await replayJournal(repos, readJournal(file));
  const write = (entry: JournalEntry): void => {
    appendFileSync(file, `${JSON.stringify(entry)}\n`, "utf8");
  };
  return assembleServices(journaledRepos(repos, write));
}
