// ================================================================================================
// Aufnahme 20260922 · gesamt-browser-inferenz · R-0719 — DAS NICHT-ZIEL „CLIENT-SEITIGE INFERENZ"
// UND DER HEUTIGE STAND.
// ================================================================================================
//
// Der Auftrag ist eine Klärung, keine Umsetzung (`docs/entscheidungen/browser-inferenz.md`). Diese
// Datei hält fest, worauf die Klärung sich stützt, damit sie nicht still veraltet:
//   B1  das Nicht-Ziel steht wörtlich in `specs/stories/reasoner.md`, in derselben Zeile wie das
//       Nachtrainieren, und verweist auf die Klärung
//   B2  das Frontend bringt keine Sprachmodell-/ML-Laufzeit mit — einzige rechnende Engine ist die
//       Bild-Texterkennung `tesseract.js` (Auftrag `gesamt-ocr`), die die Klärung als Befund nennt
//   B3  kein Frontend-Quelltext spricht einen KI-Anbieter direkt an; die Adressen stehen serverseitig
//   B4  jede Stelle, auf die die Klärung als Beleg zeigt, gibt es im Bestand, und die Entscheidung
//       ist als offen benannt
//
// WAS DIESE DATEI NICHT BELEGT: welche der Alternativen A/B/C gelten soll — das entscheidet Pedi.
// Gemessen wird nur der heutige Stand. Ob die Browser-OCR tatsächlich Text erkennt, belegen die
// Prüfungen des Auftrags `gesamt-ocr`.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REASONER_SPEC = "specs/stories/reasoner.md";
const KLAERUNG = "docs/entscheidungen/browser-inferenz.md";
const WEB_PAKET = "apps/web/package.json";
const WEB_QUELLEN = "apps/web/src";
const SERVER_CLIENT = "services/reasoner/src/model-client.ts";

const lies = (pfad: string): string => readFileSync(pfad, "utf8");

/** Laufzeiten, mit denen ein Sprachmodell oder ein anderes gelerntes Modell im Browser rechnet. */
const BROWSER_ML_LAUFZEITEN = [
  "@mlc-ai/web-llm",
  "@xenova/transformers",
  "@huggingface/transformers",
  "onnxruntime-web",
  "@tensorflow/tfjs",
  "@mediapipe/tasks-genai",
  "@mediapipe/tasks-text",
  "@wllama/wllama",
  "wllama",
  "node-llama-cpp",
];

/** Direkte Anbieterwege — im Frontend verboten, im Server-Client vorhanden (Kalibrierung). */
const ANBIETER_MUSTER = [
  /api\.openai\.com/,
  /api\.anthropic\.com/,
  /generativelanguage\.googleapis\.com/,
  /from\s+["']openai["']/,
  /from\s+["']@anthropic-ai\/sdk["']/,
];

function quelltexte(verzeichnis: string): string[] {
  const dateien: string[] = [];
  for (const name of readdirSync(verzeichnis)) {
    const pfad = join(verzeichnis, name);
    if (statSync(pfad).isDirectory()) {
      dateien.push(...quelltexte(pfad));
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
      dateien.push(pfad);
    }
  }
  return dateien;
}

function anbieterTreffer(text: string): string[] {
  return ANBIETER_MUSTER.filter((muster) => muster.test(text)).map(String);
}

describe("Browser-Inferenz · Nicht-Ziel und heutiger Stand (R-0719)", () => {
  it("B1 · das Nicht-Ziel steht wörtlich neben dem Nachtrainieren und verweist auf die Klärung", () => {
    const spec = lies(REASONER_SPEC);
    const start = spec.indexOf("## Nicht-Ziele (v1)");
    expect(start).toBeGreaterThan(-1);
    const ende = spec.indexOf("\n## ", start + 1);
    const abschnitt = spec.slice(start, ende === -1 ? undefined : ende);

    expect(abschnitt).toContain("Fine-Tuning eigener Modelle; Client-seitige Inferenz.");
    expect(abschnitt).toContain(KLAERUNG);
  });

  it("B2 · das Frontend bringt keine ML-Laufzeit mit; einzige Engine ist die Browser-OCR", () => {
    const paket = JSON.parse(lies(WEB_PAKET)) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const namen = Object.keys({ ...paket.dependencies, ...paket.devDependencies });

    // Kalibrierung: der Befund der Klärung (Alternative B) ist noch wahr — fiele `tesseract.js`
    // weg, wäre die Umfangsfrage anders zu stellen.
    expect(namen).toContain("tesseract.js");
    expect(lies("apps/web/src/lib/files.ts")).toContain("tesseract-core-simd-lstm.wasm.js");

    expect(namen.filter((name) => BROWSER_ML_LAUFZEITEN.includes(name))).toEqual([]);
  });

  it("B3 · kein Frontend-Quelltext spricht einen KI-Anbieter direkt an", () => {
    // Kalibrierung: dieselben Muster finden die Anbieteradressen im Server-Client.
    expect(anbieterTreffer(lies(SERVER_CLIENT)).length).toBeGreaterThan(0);

    const dateien = quelltexte(WEB_QUELLEN);
    expect(dateien.length).toBeGreaterThan(50);
    const treffer = dateien
      .map((pfad) => ({ pfad, muster: anbieterTreffer(lies(pfad)) }))
      .filter((eintrag) => eintrag.muster.length > 0);
    expect(treffer).toEqual([]);
  });

  it("B4 · die Klärung zeigt nur auf Vorhandenes und lässt die Entscheidung offen", () => {
    const klaerung = lies(KLAERUNG);
    expect(klaerung).toContain("R-0719");
    expect(klaerung).toContain("F-0719");
    expect(klaerung).toContain("**Entscheidung offen:**");
    for (const alternative of ["**A**", "**B**", "**C**"]) {
      expect(klaerung).toContain(alternative);
    }

    const pfade = [
      ...new Set(
        [...klaerung.matchAll(/`((?:apps|services|specs|docs|tests|tests-smoke)\/[^`\s]+)`/g)].map(
          (m) => m[1] as string,
        ),
      ),
    ];
    expect(pfade.length).toBeGreaterThan(5);
    expect(pfade.filter((pfad) => !existsSync(pfad))).toEqual([]);
  });
});
