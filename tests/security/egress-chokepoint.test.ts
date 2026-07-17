import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// SCRUM-502 R7 — Regress-Bremse: Aufrufe EXTERNER Modell-APIs (Hosts/Endpunkte von OpenAI/Anthropic/…)
// dürfen NUR in den designierten Chokepoint-Client-Dateien stehen, die über einen Pflicht-Sensitivity-
// Wrapper laufen (cappedModelClient / cappedTranscriber). Ein neuer Direkt-Egress irgendwo sonst muss
// diesen Test SOFORT ROT machen — genau die Lücke, durch die die Medien-Transkription (R7) rutschte.

// Signaturen eines direkten externen Modell-API-Aufrufs (Host ODER charakteristischer Endpunkt).
const EGRESS_PATTERNS: RegExp[] = [
  /api\.openai\.com/,
  /api\.anthropic\.com/,
  /generativelanguage\.googleapis/,
  /\/v1\/audio\/transcriptions/,
  /\/v1\/messages/,
  /\/v1\/embeddings/,
  /\/chat\/completions/,
];

// Die EINZIGEN Dateien, die extern sprechen dürfen — jede ist durch ihren Sensitivity-Chokepoint-
// Wrapper gedeckt (model-client → cappedModelClient; transcriber → cappedTranscriber).
const ALLOWLIST = ["services/reasoner/src/model-client.ts", "services/media/src/transcriber.ts"];

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function walkTs(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") {
        continue;
      }
      walkTs(full, out);
    } else if (entry.name.endsWith(".ts") && !/\.(test|spec)\.ts$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

// Reine, testbare Kern-Regel: liefert die (nicht-allowlisteten) Dateien mit externem Modell-Egress.
function findEgressViolations(
  files: { path: string; content: string }[],
  allowlist: readonly string[] = ALLOWLIST,
): string[] {
  return files
    .filter((f) => !allowlist.some((a) => f.path.replaceAll("\\", "/").endsWith(a)))
    .filter((f) => EGRESS_PATTERNS.some((p) => p.test(f.content)))
    .map((f) => f.path);
}

describe("SCRUM-502 R7: externer Modell-Egress nur im Chokepoint (arch-Guard)", () => {
  it("kein direkter externer Modell-API-Aufruf ausserhalb der Chokepoint-Dateien", () => {
    const files = walkTs(join(REPO_ROOT, "services")).map((full) => ({
      path: relative(REPO_ROOT, full).replaceAll("\\", "/"),
      content: readFileSync(full, "utf8"),
    }));
    // Sicherheitsnetz: die Allowlist-Dateien existieren wirklich und enthalten den Egress (sonst wäre
    // die Regel wirkungslos/veraltet).
    const allow = files.filter((f) => ALLOWLIST.some((a) => f.path.endsWith(a)));
    expect(allow.length).toBe(ALLOWLIST.length);
    expect(allow.every((f) => EGRESS_PATTERNS.some((p) => p.test(f.content)))).toBe(true);

    expect(findEgressViolations(files)).toEqual([]);
  });

  it("die Regel greift: ein Direkt-Egress ausserhalb der Allowlist wird erkannt (ROT)", () => {
    const synthetic = [
      { path: "services/foo/src/leak.ts", content: 'await fetch("https://api.openai.com/v1/…")' },
      { path: "services/foo/src/whisper.ts", content: "fetch(`${b}/v1/audio/transcriptions`)" },
      { path: "services/reasoner/src/model-client.ts", content: "https://api.anthropic.com" }, // allowlisted
      { path: "services/foo/src/harmlos.ts", content: "const x = 1;" },
    ];
    expect(findEgressViolations(synthetic)).toEqual([
      "services/foo/src/leak.ts",
      "services/foo/src/whisper.ts",
    ]);
  });
});
