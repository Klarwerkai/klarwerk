import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// AUFTRAG-mega2 Block F — testbarer Beleg der READ-ONLY-Eigenschaft des Forensik-Werkzeugs.
//
// EHRLICHKEIT: Dies ist ein STATISCHER Quelltext-Scan (kein Laufzeit-DB-Test, kein Import des
// Werkzeugs). Er belegt, dass tools/audit-forensics.ts ausschließlich SELECT absetzt und keinerlei
// mutierende SQL enthält, und dass der Verbindungs-String nur aus der Umgebung kommt. Reiner
// Quelltext-Scan (kein Import) — der ehrlichste, seiteneffektfreie Beleg.
// AUFTRAG-mega4 Block E: der Starter heißt jetzt eindeutig `tools/audit-forensics.sh` (keine
// Namenskollision mehr mit dem .ts-Modul).

const TOOL_TS_URL = new URL("../../tools/audit-forensics.ts", import.meta.url);
const TOOL_TS_SOURCE = readFileSync(TOOL_TS_URL, "utf8");
const LAUNCHER_URL = new URL("../../tools/audit-forensics.sh", import.meta.url);
const LAUNCHER_SOURCE = readFileSync(LAUNCHER_URL, "utf8");

const FORBIDDEN = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "ALTER",
  "TRUNCATE",
  "MERGE",
  "CREATE",
  "GRANT",
];

// Kommentare (// … und /* … */) entfernen, damit erklärende Prosa (die die verbotenen Wörter nennt)
// den Code-Scan nicht verfälscht. Geprüft wird der tatsächliche Code inkl. aller String-Literale.
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

describe("AUFTRAG-mega2 Block F: Audit-Forensik ist READ-ONLY (statischer Quelltext-Scan)", () => {
  it("Werkzeug-Code (ohne Kommentare) enthält keine mutierende SQL", () => {
    const code = stripComments(TOOL_TS_SOURCE);
    for (const keyword of FORBIDDEN) {
      const hit = new RegExp(`\\b${keyword}\\b`, "i").test(code);
      expect(hit, `verbotenes SQL-Schlüsselwort im Werkzeug-Code gefunden: ${keyword}`).toBe(false);
    }
  });

  it("das Werkzeug fragt die Audit-Tabelle ausschließlich per SELECT ab", () => {
    const code = stripComments(TOOL_TS_SOURCE);
    // Es GIBT eine Abfrage auf die audit-Tabelle …
    expect(/SELECT[\s\S]*?\bFROM\s+audit\b/i.test(code)).toBe(true);
    // … und jede Erwähnung von „FROM audit" wird von SELECT eingeleitet (kein DML/DDL auf audit).
    const fromAudit = /(\w+)\s+FROM\s+audit\b/gi;
    for (const m of code.matchAll(fromAudit)) {
      // Das Wort unmittelbar vor „FROM audit" ist Teil der Spaltenliste eines SELECT — es darf kein
      // mutierender Verb-Kontext sein. Wir prüfen zusätzlich, dass links davon SELECT steht.
      const upto = code.slice(0, m.index ?? 0);
      const lastSelect = upto.toUpperCase().lastIndexOf("SELECT");
      expect(lastSelect, "FROM audit ohne vorangehendes SELECT").toBeGreaterThanOrEqual(0);
    }
  });

  it("Verbindungs-String kommt nur aus der Umgebung (kein Literal im Quelltext)", () => {
    expect(TOOL_TS_SOURCE).toContain("KLARWERK_AUDIT_DB_URL");
    // Kein eingebetteter Postgres-Verbindungs-String (mit Host/Userinfo).
    expect(/postgres(ql)?:\/\/[^\s'"]*[:@]/i.test(stripComments(TOOL_TS_SOURCE))).toBe(false);
  });

  // AUFTRAG-mega3 Block E: die neu aggregierende/berichtende Logik (analyze/buildReport) darf KEINEN
  // neuen DB-Zugriff und KEINE zweite Query eingeführt haben — sie arbeitet ausschließlich auf den
  // bereits gelesenen Zeilen. Read-only bleibt strukturell erzwungen: genau EINE Query, genau EIN Pool.
  it("die neue Aggregations-/Berichtslogik führt keinen neuen DB-Zugriff ein (genau eine Query, ein Pool)", () => {
    const code = stripComments(TOOL_TS_SOURCE);
    // Genau ein SELECT-Statement zentral gehalten, weiterhin nur auf die audit-Tabelle.
    const selectCount = (code.match(/SELECT/gi) ?? []).length;
    expect(selectCount, "mehr als ein SELECT — unerwarteter zweiter DB-Zugriff").toBe(1);
    // Genau eine Query-Absetzung und genau eine Pool-Konstruktion.
    expect((code.match(/\.query\s*[<(]/g) ?? []).length).toBe(1);
    expect((code.match(/new\s+Pool\(/g) ?? []).length).toBe(1);
    // analyze/buildReport sind exportiert (testbar), aber rein — sie enthalten selbst keine SQL/Query.
    const analyzeBody = code.slice(
      code.indexOf("export function analyze"),
      code.indexOf("async function main"),
    );
    expect(/\.query\s*[<(]|new\s+Pool\(|SELECT/i.test(analyzeBody)).toBe(false);
  });

  it("der Bash-Starter setzt selbst keine SQL ab (nur tsx-Aufruf)", () => {
    const code = LAUNCHER_SOURCE.replace(/(^|[^:])#[^\n]*/g, "$1"); // Shell-Kommentare weg
    for (const keyword of FORBIDDEN) {
      expect(new RegExp(`\\b${keyword}\\b`, "i").test(code)).toBe(false);
    }
    expect(LAUNCHER_SOURCE).toContain("tsx tools/audit-forensics.ts");
  });
});
