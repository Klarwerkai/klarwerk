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
  // WP-SHIP8-CLOSE-6 (bens ROT-1): appendOnce ist eine Mutation (exactly-once-Beleg) — das
  // Replay ist deterministisch (der Set-/Index-Guard macht Doppel-Zeilen im Journal harmlos).
  auditRepo: ["append", "appendOnce"],
  // WP-SUBMIT-ASYNC: der Prüf-Status (aiCheck) ist eine Mutation am KO-JSONB → journalieren,
  // sonst wäre er nach einem Dev-Neustart weg (pending-Erkennung/Badges würden lügen).
  koRepo: ["insert", "update", "delete", "setAiCheck", "resolveAiCheck"],
  koVersions: ["append"],
  evidence: ["append"],
  // SCRUM-504: der atomare Bootstrap-Claim ist eine Mutation (fügt den Admin ein) → muss journaliert
  // werden, sonst überlebt der erste Admin den Dev-Neustart nicht. In Dev (sequenziell) genau einmal mit
  // Erfolg gerufen; Replay auf die leere Instanz beansprucht den Slot identisch.
  users: ["insert", "update", "delete", "tryClaimBootstrapAdmin"],
  sessions: ["create", "delete", "deleteByUser"],
  resetTokens: ["create", "delete"],
  drafts: ["insert", "update", "delete"],
  gaps: ["insert", "update", "delete"],
  // SCRUM-507 R2: die Bewertung (inkl. koVersion) wird per upsert journaled; die Invalidierung ist
  // versionsgebunden (keine separate Löschung), daher kein weiterer Mutator nötig.
  ratings: ["upsert"],
  assignments: ["create", "update"],
  conflictsRepo: ["insert", "update"],
  // Berater-Konzept Duplikate 04.07. (Stufe D3b): Überschneidungs-Einträge überleben den Neustart.
  overlapRepo: ["insert", "update"],
  // Pedi 04.07.: eingestellte Anzeige-Schwelle überlebt den Neustart (letzter Set gewinnt).
  overlapSettings: ["set"],
  lifecycleRepo: ["addCoupling", "markPending", "clearPending", "savePath", "setProgress"],
  objects: ["insert"],
  // SCRUM-510 (WP3): der atomar-idempotente Insert ist ebenfalls eine Mutation → muss journaliert werden,
  // sonst überleben so eingereihte Import-Kandidaten den Dev-Neustart nicht.
  // WP-D-CLEAN: removeAll (Testdaten-Aufräumen) ebenfalls — sonst wären die Kandidaten nach einem
  // Dev-Neustart wieder da. WP-NIGHT-FIX (bens F2-TOCTOU): der Cleanup löscht jetzt gezielt per
  // removeByIds — dieselbe Journal-Pflicht.
  // WP-SHIP8-CLOSE-3 (bens ROT-1): claim/resolveClaim mutieren den Kandidaten (Status + Lease) →
  // journalieren, sonst wäre nach einem Dev-Neustart ein Claim/Abschluss verloren (Replay ist
  // deterministisch: beide CAS-Methoden tragen ihre Bedingung in den args).
  // WP-SHIP8-CLOSE-7 (bens ROT-1): clearAuditPending ist ebenfalls ein bedingter Kandidaten-Write.
  candidates: [
    "insert",
    "insertIfAbsent",
    "update",
    "removeAll",
    "removeByIds",
    "claim",
    "resolveClaim",
    "clearAuditPending",
  ],
  modelRuns: ["append"],
  // Audit-P3 (SCRUM-397): Gelesen-Status überlebt den Neustart (Dev-Journal).
  notificationSeen: ["markSeen"],
  // SCRUM-386: kundeneigene KI-Assist-Presets überleben den Neustart (Replace-Semantik,
  // args tragen die komplette Liste inkl. fertiger ids → Replay exakt).
  assistPresets: ["replaceAll"],
  // SCRUM-525 P.5 (WP6): die KI-Zuordnung (Policy) überlebt den Neustart (letzter Set gewinnt).
  reasonerPolicy: ["set"],
  // SCRUM-395: Standard-Prüferanzahl überlebt den Neustart (letzter Set gewinnt).
  validationSettings: ["setDefaultNeeded"],
  // SCRUM-414: Regler „externe Wissensabfrage" überlebt den Neustart (letzter Set gewinnt).
  externalKnowledge: ["setStage"],
  // SCRUM-421: Upload-Grenzen überleben den Neustart (letzter Set gewinnt).
  uploadLimits: ["set"],
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
