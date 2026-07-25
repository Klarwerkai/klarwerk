// AUFTRAG-mega2 Block F — Audit-Forensik (READ-ONLY, NUR SELECT).
//
// Zweck: Vor JEDER Reparatur der Audit-Kette das ERSTE tatsächlich verletzte Glied der Live-Daten
// lesen und benennen. Hypothese: Postgres `jsonb` verändert die Schlüsselreihenfolge der Payload,
// wodurch der neu berechnete Nutzdaten-Hash vom gespeicherten abweicht und `verifyChain` bricht.
// Dieses Werkzeug bestätigt oder widerlegt genau diese Hypothese AN DEN DATEN — es repariert nichts.
//
// HARTE GRENZEN (bewusst):
//   - Ausschließlich SELECT. Kein INSERT/UPDATE/DELETE, keine Migration, kein Schemaeingriff, keine
//     Neuversiegelung. Alle abgesetzten Statements stehen in AUDIT_FORENSICS_SQL und beginnen mit SELECT.
//   - Verbindungsdaten NUR aus der Umgebungsvariablen KLARWERK_AUDIT_DB_URL (kein Host/Passwort/String
//     im Quelltext).
//   - Der Export sendet nichts nach außen; er schreibt eine lokale Datei mit dem UNVERÄNDERTEN Bestand
//     (inkl. aller gespeicherten Hashes und der rohen jsonb-Textform der Payload).
//   - NICHT in die Anwendung eingebunden, NICHT beim Start ausgeführt, NICHT Teil von tools/check.
//
// Hash-/Verifikationslogik wird aus services/audit/src/chain.ts IMPORTIERT (nicht dupliziert).
//
// Aufruf (Pedi):
//   KLARWERK_AUDIT_DB_URL='postgres://…' npx tsx tools/audit-forensics.ts <export-pfad.json>
//   (Export-Pfad alternativ über KLARWERK_AUDIT_EXPORT_PATH.)

import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { Pool } from "pg";
import { GENESIS, hashEntry } from "../services/audit/src/chain";
import type { AuditEntry } from "../services/audit/src/types";

const DB_URL_ENV = "KLARWERK_AUDIT_DB_URL";
const EXPORT_PATH_ENV = "KLARWERK_AUDIT_EXPORT_PATH";

// Alle abgesetzten Statements — ausschließlich SELECT. Zentral gehalten, damit der Read-only-Scan-Test
// sie prüfen kann. payload::text liefert die ROHE jsonb-Speicherform (kanonische Schlüsselreihenfolge),
// zusätzlich zur vom Treiber geparsten payload — genau der Vergleich, der die Serialisierungs-Hypothese
// bestätigt/widerlegt.
export const AUDIT_FORENSICS_SQL = {
  chainInOrder:
    "SELECT seq, at, actor, action, target, payload, payload::text AS payload_text, prev_hash, hash FROM audit ORDER BY seq ASC",
} as const;

export interface ForensicRow {
  seq: number;
  at: string;
  actor: string;
  action: string;
  target: string;
  payload: Record<string, unknown>;
  payload_text: string;
  prev_hash: string;
  hash: string;
}

type ViolationClass = "PREVHASH_BREAK" | "PAYLOADHASH_MISMATCH";

export interface Analyzed {
  row: ForensicRow;
  recomputedHash: string;
  prevHashOk: boolean;
  payloadHashOk: boolean;
  // Die ERSTE Bruchklasse dieser Zeile in Produktionsreihenfolge (prevHash vor payloadHash) — nur zur
  // Benennung des ERSTEN verletzten Glieds. Die Gesamtaggregation nutzt bewusst NICHT dieses exklusive
  // Feld, sondern die beiden unabhängigen Booleans (bens Sammel-Review 3, Auflage E).
  violationClass: ViolationClass | undefined;
}

// hashEntry-kompatibles Teilobjekt aus einer gelesenen Zeile bauen (Feldnamen wie in AuditEntry).
function toHashInput(row: ForensicRow): Omit<AuditEntry, "hash"> {
  return {
    seq: row.seq,
    at: row.at,
    actor: row.actor,
    action: row.action,
    target: row.target,
    payload: row.payload,
    prevHash: row.prev_hash,
  };
}

// Analyse in Sequenzreihenfolge — spiegelt die Semantik von verifyChain:
//   1) prevHash muss auf den GESPEICHERTEN Hash des Vorgängers zeigen (bzw. GENESIS am Anfang),
//   2) der neu berechnete Nutzdaten-Hash muss dem gespeicherten Hash entsprechen.
// prevHash wird VOR payloadHash geprüft (wie in verifyChain) — die zuerst verletzte Prüfung benennt
// die Fehlerklasse des Glieds.
export function analyze(rows: readonly ForensicRow[]): Analyzed[] {
  const out: Analyzed[] = [];
  let expectedPrev = GENESIS;
  for (const row of rows) {
    const recomputedHash = hashEntry(toHashInput(row));
    const prevHashOk = row.prev_hash === expectedPrev;
    const payloadHashOk = row.hash === recomputedHash;
    let violationClass: ViolationClass | undefined;
    if (!prevHashOk) {
      violationClass = "PREVHASH_BREAK";
    } else if (!payloadHashOk) {
      violationClass = "PAYLOADHASH_MISMATCH";
    }
    out.push({ row, recomputedHash, prevHashOk, payloadHashOk, violationClass });
    // Nächster erwarteter prevHash = GESPEICHERTER Hash dieses Eintrags (wie verifyChain: prev = entry.hash).
    expectedPrev = row.hash;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------
// Serialisierungs-Diagnose: kann der GESPEICHERTE Hash durch reine SCHLÜSSEL-Umsortierung derselben
// (inhaltsgleichen) Payload reproduziert werden? Falls ja, ist bewiesen: Inhalt identisch, nur die
// Reihenfolge unterscheidet sich → Hypothese BESTÄTIGT. Wir erzeugen Kandidaten-OBJEKTE mit
// verschiedener Einfügereihenfolge und hashen sie mit hashEntry (JSON.stringify folgt der
// Einfügereihenfolge) — so bleibt die Hashformel bei chain.ts, ohne sie zu duplizieren.
// ---------------------------------------------------------------------------------------------------

const MAX_OBJECT_KEYS = 8; // n!-Grenze für die erschöpfende Reihenfolge-Suche pro Objektknoten
const VARIANT_CAP = 200_000; // Deckel gegen kombinatorische Explosion

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) {
    return [items.slice()];
  }
  const out: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const head = items[i] as T;
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const p of permutations(rest)) {
      out.push([head, ...p]);
    }
  }
  return out;
}

function cartesian(factors: readonly (readonly unknown[])[], cap: number): unknown[][] | "capped" {
  let acc: unknown[][] = [[]];
  for (const factor of factors) {
    const next: unknown[][] = [];
    for (const prefix of acc) {
      for (const item of factor) {
        next.push([...prefix, item]);
        if (next.length > cap) {
          return "capped";
        }
      }
    }
    acc = next;
  }
  return acc;
}

// Liefert alle inhaltsgleichen Reihenfolge-Varianten eines Wertes (Arrays behalten ihre Element-
// reihenfolge, wie jsonb; nur Objekt-Schlüssel werden permutiert). "capped" = zu groß für die Suche.
function orderingVariants(value: unknown): unknown[] | "capped" {
  if (value === null || typeof value !== "object") {
    return [value];
  }
  if (Array.isArray(value)) {
    const factors: unknown[][] = [];
    for (const el of value) {
      const v = orderingVariants(el);
      if (v === "capped") {
        return "capped";
      }
      factors.push(v);
    }
    const combos = cartesian(factors, VARIANT_CAP);
    if (combos === "capped") {
      return "capped";
    }
    return combos; // jede Kombination IST das Array mit gewählten Element-Varianten
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length > MAX_OBJECT_KEYS) {
    return "capped";
  }
  const perKey: unknown[][] = [];
  for (const k of keys) {
    const v = orderingVariants(obj[k]);
    if (v === "capped") {
      return "capped";
    }
    perKey.push(v);
  }
  const out: unknown[] = [];
  for (const perm of permutations(keys.map((_, i) => i))) {
    const factors = perm.map((i) => perKey[i] as unknown[]);
    const combos = cartesian(factors, VARIANT_CAP);
    if (combos === "capped") {
      return "capped";
    }
    for (const combo of combos) {
      const rebuilt: Record<string, unknown> = {};
      perm.forEach((keyIdx, slot) => {
        rebuilt[keys[keyIdx] as string] = combo[slot];
      });
      out.push(rebuilt);
      if (out.length > VARIANT_CAP) {
        return "capped";
      }
    }
  }
  return out;
}

type Reproduction =
  | { status: "confirmed"; serialization: string }
  | { status: "not-found" }
  | { status: "capped" };

// Versucht, den gespeicherten Hash eines Eintrags durch reine Schlüssel-Umsortierung der Payload zu
// reproduzieren. Nutzt hashEntry (chain.ts) auf reihenfolge-varianten Kandidaten-Objekten.
function tryReproduceStoredHash(row: ForensicRow): Reproduction {
  const base = toHashInput(row);
  const candidates = orderingVariants(row.payload);
  if (candidates === "capped") {
    return { status: "capped" };
  }
  for (const candidate of candidates) {
    const payload = candidate as Record<string, unknown>;
    const h = hashEntry({ ...base, payload });
    if (h === row.hash) {
      return { status: "confirmed", serialization: JSON.stringify(payload) };
    }
  }
  return { status: "not-found" };
}

// Kanonische (schlüssel-sortierte) Serialisierung — nur zur menschlichen Anschauung im Bericht.
function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    sorted[k] = canonicalize(obj[k]);
  }
  return sorted;
}

function firstDiffIndex(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) {
      return i;
    }
  }
  return a.length === b.length ? -1 : n;
}

// ---------------------------------------------------------------------------------------------------
// Bericht + Export
// ---------------------------------------------------------------------------------------------------

export function buildReport(analyzed: readonly Analyzed[]): string {
  const lines: string[] = [];
  const total = analyzed.length;
  // bens Sammel-Review 3, Auflage E: BEIDE Hashprüfungen werden je Zeile UNABHÄNGIG aggregiert — nicht
  // mehr nach der exklusiven ersten Bruchklasse gefiltert. Sonst verschwindet ein gleichzeitig falscher
  // Nutzdatenhash in einer Zeile, die bereits einen prevHash-Bruch trägt. Eine Zeile kann in BEIDEN
  // Listen erscheinen; genau das soll sie, wenn beide Prüfungen brechen.
  const prevBreaks = analyzed.filter((a) => !a.prevHashOk);
  const payloadMismatches = analyzed.filter((a) => !a.payloadHashOk);
  const bothInSameRow = analyzed.filter((a) => !a.prevHashOk && !a.payloadHashOk);
  const intactCount = analyzed.filter((a) => a.prevHashOk && a.payloadHashOk).length;
  // Das ERSTE verletzte Glied wird weiterhin in Produktionsreihenfolge benannt (violationClass: prev vor
  // payload) — für die Einzeldiagnose des ersten Bruchs.
  const first = analyzed.find((a) => a.violationClass !== undefined);

  lines.push("========================================================================");
  lines.push("AUFTRAG-mega2 Block F — Audit-Forensik (READ-ONLY)");
  lines.push("========================================================================");
  lines.push(`Gelesene Einträge (Sequenzreihenfolge): ${total}`);
  lines.push("");

  if (!first) {
    lines.push("BEFUND: Kette LÜCKENLOS — kein verletztes Glied gefunden.");
    lines.push(
      "Weder ein prevHash-Bruch noch ein Nutzdaten-Hash-Fehler. verifyChain würde grün sein.",
    );
    return `${lines.join("\n")}\n`;
  }

  const f = first.row;
  lines.push("------------------------------------------------------------------------");
  lines.push("ERSTES VERLETZTES GLIED");
  lines.push("------------------------------------------------------------------------");
  lines.push(`seq:            ${f.seq}`);
  lines.push(`Zeitpunkt (at): ${f.at}`);
  lines.push(`actor/action:   ${f.actor} / ${f.action}`);
  lines.push(`target:         ${f.target}`);
  const klasseHinweis =
    first.violationClass === "PREVHASH_BREAK"
      ? "  (die VERKETTUNG bricht — prevHash zeigt nicht auf den Vorgänger-Hash)"
      : "  (der NUTZDATEN-Hash des Eintrags selbst passt nicht)";
  lines.push(`Fehlerklasse:   ${first.violationClass}${klasseHinweis}`);
  lines.push("");
  lines.push(`gespeicherter Hash:  ${f.hash}`);
  lines.push(`neu berechneter Hash: ${first.recomputedHash}`);

  if (first.violationClass === "PREVHASH_BREAK") {
    const idx = analyzed.indexOf(first);
    const expectedPrev = idx === 0 ? GENESIS : (analyzed[idx - 1] as Analyzed).row.hash;
    lines.push(`erwarteter prevHash: ${expectedPrev}`);
    lines.push(`gespeicherter prevHash: ${f.prev_hash}`);
  } else {
    // Serialisierungs-Diagnose für den ersten Nutzdaten-Hash-Fehler.
    const currentSer = JSON.stringify(f.payload);
    const storedText = f.payload_text;
    const canonicalSer = JSON.stringify(canonicalize(f.payload));
    lines.push("");
    lines.push("NUTZDATEN-SERIALISIERUNG (Serialisierungs-Hypothese):");
    lines.push(`  gespeicherte jsonb-Textform (payload::text): ${storedText}`);
    lines.push(`  neu serialisiert JSON.stringify(payload):    ${currentSer}`);
    lines.push(`  kanonisch (Schlüssel sortiert):              ${canonicalSer}`);
    const diffAt = firstDiffIndex(storedText, currentSer);
    lines.push(
      diffAt < 0
        ? "  → gespeicherte und neu serialisierte Form sind identisch (Unterschied liegt ggf. nur in der URSPRÜNGLICHEN Schreib-Serialisierung)."
        : `  → erste Abweichung gespeichert↔neu an Position ${diffAt}.`,
    );
    lines.push("");
    const repro = tryReproduceStoredHash(f);
    if (repro.status === "confirmed") {
      lines.push("  HYPOTHESE BESTÄTIGT: Der gespeicherte Hash lässt sich durch reine SCHLÜSSEL-");
      lines.push("  UMSORTIERUNG derselben Payload exakt reproduzieren. Der Inhalt ist SEMANTISCH");
      lines.push(
        "  INHALTSGLEICH, aber BYTEVERSCHIEDEN — nur die Schlüsselreihenfolge unterscheidet sich",
      );
      lines.push(
        "  (jsonb kanonisiert die Schlüssel). Es liegt KEINE inhaltliche Manipulation vor.",
      );
      lines.push(`  reproduzierende Schreib-Serialisierung: ${repro.serialization}`);
    } else if (repro.status === "not-found") {
      lines.push("  HYPOTHESE NICHT BESTÄTIGT: Keine Schlüssel-Umsortierung der gelesenen Payload");
      lines.push("  reproduziert den gespeicherten Hash. Der Inhalt könnte sich TATSÄCHLICH");
      lines.push("  unterscheiden (echte Abweichung/Manipulation) — nicht bloß die Reihenfolge.");
    } else {
      lines.push(
        "  HYPOTHESE UNGEPRÜFT: Payload zu groß/tief für die erschöpfende Reihenfolge-Suche",
      );
      lines.push(
        `  (Deckel: ${MAX_OBJECT_KEYS} Schlüssel/Objekt, ${VARIANT_CAP} Varianten). Manuell prüfen.`,
      );
    }
  }

  lines.push("");
  lines.push("------------------------------------------------------------------------");
  lines.push("GESAMTMUSTER");
  lines.push("------------------------------------------------------------------------");
  // Unabhängig gezählt: eine Zeile mit BEIDEN Brüchen zählt in BEIDEN Zeilen mit. „intakte Einträge"
  // sind ausschließlich Zeilen, die BEIDE Prüfungen bestehen (nicht total minus Summe — das würde
  // Doppelbrüche doppelt abziehen).
  lines.push(`prevHash-Brüche:        ${prevBreaks.length}`);
  lines.push(`Nutzdaten-Hash-Fehler:  ${payloadMismatches.length}`);
  lines.push(`Zeilen mit BEIDEN:      ${bothInSameRow.length}`);
  lines.push(`intakte Einträge:       ${intactCount}`);
  if (bothInSameRow.length > 0) {
    lines.push(
      `  Sequenzen mit BEIDEN Fehlerklassen (prevHash UND Nutzdaten): ${bothInSameRow.map((a) => a.row.seq).join(", ")}`,
    );
  }
  if (prevBreaks.length > 0 && payloadMismatches.length > 0) {
    lines.push(
      "→ ZWEI verschiedene Fehlerklassen vorhanden — es gibt einen andersartigen zweiten Bruch,",
    );
    lines.push(
      "  nicht nur ein einziges Serialisierungsmuster. Betroffene Sequenzen einzeln prüfen.",
    );
    lines.push(
      `  prevHash-Bruch-Sequenzen:      ${prevBreaks.map((a) => a.row.seq).join(", ") || "—"}`,
    );
    lines.push(
      `  Nutzdaten-Fehler-Sequenzen:    ${payloadMismatches.map((a) => a.row.seq).join(", ") || "—"}`,
    );
  } else if (payloadMismatches.length > 0) {
    lines.push(
      "→ EINHEITLICHES Muster: ausschließlich Nutzdaten-Hash-Fehler, keine prevHash-Brüche.",
    );
    lines.push("  Das passt zur Serialisierungs-Hypothese (jsonb-Schlüsselreihenfolge).");
  } else if (prevBreaks.length > 0) {
    lines.push(
      "→ EINHEITLICHES Muster: ausschließlich prevHash-Brüche (Verkettung), keine Nutzdaten-Fehler.",
    );
  }
  return `${lines.join("\n")}\n`;
}

function resolveExportPath(): string | undefined {
  const arg = process.argv[2];
  if (arg && arg.trim().length > 0) {
    return arg;
  }
  const fromEnv = process.env[EXPORT_PATH_ENV];
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv;
  }
  return undefined;
}

async function main(): Promise<void> {
  const url = process.env[DB_URL_ENV];
  if (!url || url.trim().length === 0) {
    process.stderr.write(
      `FEHLER: Verbindungs-String fehlt. Setze ${DB_URL_ENV} (nur aus der Umgebung, nie im Quelltext).\n` +
        `Aufruf: ${DB_URL_ENV}='postgres://…' npx tsx tools/audit-forensics.ts <export-pfad.json>\n`,
    );
    process.exitCode = 1;
    return;
  }
  const exportPath = resolveExportPath();
  if (!exportPath) {
    process.stderr.write(
      `FEHLER: Export-Pfad fehlt. Als erstes Argument oder über ${EXPORT_PATH_ENV} angeben.\n`,
    );
    process.exitCode = 1;
    return;
  }

  const pool = new Pool({ connectionString: url });
  try {
    const res = await pool.query<ForensicRow>(AUDIT_FORENSICS_SQL.chainInOrder);
    const rows = res.rows;

    // Export: UNVERÄNDERTER Bestand inkl. aller gespeicherten Hashes und der rohen jsonb-Textform.
    const exportPayload = {
      exportedAt: new Date().toISOString(),
      note: "AUFTRAG-mega2 Block F — unveränderter Original-Audit-Bestand (READ-ONLY). Nichts nach außen gesendet.",
      count: rows.length,
      entries: rows,
    };
    writeFileSync(exportPath, `${JSON.stringify(exportPayload, null, 2)}\n`, "utf8");

    const analyzed = analyze(rows);
    process.stdout.write(buildReport(analyzed));
    process.stdout.write(
      `\nExport geschrieben: ${exportPath} (${rows.length} Einträge, unverändert)\n`,
    );
  } finally {
    await pool.end();
  }
}

// Nur bei DIREKTEM Aufruf ausführen — beim Import (z. B. Read-only-Scan-Test) passiert nichts.
const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  void main();
}
