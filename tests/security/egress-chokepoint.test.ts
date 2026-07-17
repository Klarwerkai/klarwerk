import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// SCRUM-502 R7/R8 — Regress-Bremse (Defense-in-Depth). Externer Modell-/Audio-Egress UND der Zugriff
// auf das Modell-Credential dürfen NUR in den designierten Chokepoint-Client-Dateien stehen, die über
// einen Pflicht-Sensitivity-Wrapper laufen (cappedModelClient / cappedTranscriber). Ein neuer Egress
// oder Credential-Zugriff IRGENDWO sonst — auch via Anbieter-SDK, dynamischer URL, generischem
// HTTP-Client oder in einem anderen Verzeichnis (nicht nur services/**) — macht diesen Test SOFORT ROT.
// R8 verbreitert R7 (das nur services/** + Host-Literale scannte) auf das GESAMTE Repo und auf
// SDK-Instanzierung + Credential-Zugriff — die Lücken, die ben-ROT benannt hat.

// Signaturen eines externen Modell-Egress ODER Credential-Zugriffs (jede Gruppe für sich verräterisch).
const EGRESS_PATTERNS: RegExp[] = [
  // (a) Modell-/Audio-Hosts + charakteristische Endpunkte (direkter HTTP-Egress; deckt auch dynamisch
  //     zusammengesetzte URLs ab, sobald der charakteristische Endpunkt-Teilstring im Code steht).
  /api\.openai\.com/,
  /api\.anthropic\.com/,
  /generativelanguage\.googleapis/,
  /\/v1\/audio\/transcriptions/,
  /\/v1\/messages/,
  /\/v1\/embeddings/,
  /\/chat\/completions/,
  // (b) Anbieter-SDKs — sprechen selbst mit dem Modell-Host, auch ohne sichtbare URL.
  /@anthropic-ai\/sdk/,
  /@google\/generative-ai/,
  /from\s+["']openai["']/,
  /require\(\s*["']openai["']\s*\)/,
  /\bnew\s+(?:OpenAI|Anthropic|GoogleGenerativeAI)\b/,
  // (c) Credential-Zugriff — der Schlüssel/das Keychain-Geheimnis ist NUR im Chokepoint erreichbar
  //     (Credential-Gating). „ANTHROPIC_API_KEY" als Fließtext (z. B. i18n-Hilfetext) wird NICHT
  //     geflaggt: verlangt wird eine Code-Form (quotiertes Literal ODER env-Member-/Bracket-Zugriff).
  /["'](?:ANTHROPIC_API_KEY|OPENAI_API_KEY|MEDIA_TRANSCRIBE_API_KEY|GEMINI_API_KEY|GOOGLE_API_KEY)["']/,
  /(?:process\.env|\benv)\s*[.[]\s*["']?(?:ANTHROPIC_API_KEY|OPENAI_API_KEY|MEDIA_TRANSCRIBE_API_KEY|GEMINI_API_KEY|GOOGLE_API_KEY)\b/,
  /find-generic-password/,
  /add-generic-password/,
];

// Die EINZIGEN Dateien, die extern sprechen / das Credential lesen dürfen — jede ist durch ihren
// Sensitivity-Chokepoint-Wrapper gedeckt (model-client → cappedModelClient; transcriber →
// cappedTranscriber) und exportiert den ROHEN Client NICHT nach außen (Encapsulation, s. R8).
const ALLOWLIST = ["services/reasoner/src/model-client.ts", "services/media/src/transcriber.ts"];

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Verzeichnisse ohne eigenen Quellcode-Vertrag (Abhängigkeiten, Build-Artefakte, VCS, Coverage).
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "coverage", "test-results"]);

function walkTs(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) {
        continue;
      }
      walkTs(full, out);
    } else if (entry.name.endsWith(".ts") && !/\.(test|spec)\.ts$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

// Reine, testbare Kern-Regel: liefert die (nicht-allowlisteten) Dateien mit Egress-/Credential-Signal.
function findEgressViolations(
  files: { path: string; content: string }[],
  allowlist: readonly string[] = ALLOWLIST,
): string[] {
  return files
    .filter((f) => !allowlist.some((a) => f.path.replaceAll("\\", "/").endsWith(a)))
    .filter((f) => EGRESS_PATTERNS.some((p) => p.test(f.content)))
    .map((f) => f.path);
}

describe("SCRUM-502 R8: externer Modell-Egress + Credential nur im Chokepoint (arch-Guard, repo-weit)", () => {
  it("kein Egress-/Credential-Zugriff ausserhalb der Chokepoint-Dateien (GESAMTES Repo)", () => {
    // R8: das GANZE Repo, nicht nur services/** (ben-ROT: Code ausserhalb services/** wurde übersehen).
    const files = walkTs(REPO_ROOT).map((full) => ({
      path: relative(REPO_ROOT, full).replaceAll("\\", "/"),
      content: readFileSync(full, "utf8"),
    }));
    // Sicherheitsnetz: die Allowlist-Dateien existieren wirklich und enthalten ein Signal (sonst wäre
    // die Regel wirkungslos/veraltet).
    const allow = files.filter((f) => ALLOWLIST.some((a) => f.path.endsWith(a)));
    expect(allow.length).toBe(ALLOWLIST.length);
    expect(allow.every((f) => EGRESS_PATTERNS.some((p) => p.test(f.content)))).toBe(true);

    expect(findEgressViolations(files)).toEqual([]);
  });

  it("die Regel greift: Bypass via Host/SDK/dynamischer URL/Credential/anderem Verzeichnis → ROT", () => {
    const synthetic = [
      // (a) Host-Literal ausserhalb der Allowlist
      { path: "services/foo/src/leak.ts", content: 'await fetch("https://api.openai.com/v1/…")' },
      // (b) Anbieter-SDK in einem ANDEREN Verzeichnis (apps/**)
      {
        path: "apps/web/src/sneaky.ts",
        content: 'import Anthropic from "@anthropic-ai/sdk";\nconst c = new Anthropic();',
      },
      // (a) dynamisch zusammengesetzte URL (charakteristischer Endpunkt-Teilstring) in scripts/**
      {
        path: "scripts/backfill.ts",
        content: 'const host = base + "/v1/messages";\nawait fetch(host);',
      },
      // (c) Credential-Zugriff ausserhalb des Chokepoints
      { path: "services/bar/src/creds.ts", content: "const k = process.env.ANTHROPIC_API_KEY;" },
      // (c) Keychain-Zugriff in desktop-app/**
      {
        path: "desktop-app/src/setup.ts",
        content: 'execFileSync("security", ["add-generic-password", "-s", "Klarwerk"]);',
      },
      // allowlisted → NICHT geflaggt (obwohl Host + Credential-Literal enthalten)
      {
        path: "services/reasoner/src/model-client.ts",
        content: 'const u = "https://api.anthropic.com"; const e = "ANTHROPIC_API_KEY";',
      },
      // harmlos
      { path: "services/foo/src/harmlos.ts", content: "const x = 1;" },
    ];
    expect([...findEgressViolations(synthetic)].sort()).toEqual(
      [
        "apps/web/src/sneaky.ts",
        "desktop-app/src/setup.ts",
        "scripts/backfill.ts",
        "services/bar/src/creds.ts",
        "services/foo/src/leak.ts",
      ].sort(),
    );
  });
});
