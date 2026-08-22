// H3-LUECKEN · JOB 1577 D7 — DIE DREI CONSUMER-VERBOTE, dauerhaft als Compiler-Negativtest.
//
// KORREKTUR ZU D6 (BENs Pruefluecke 2). In D5 waren diese drei Verbote eine einmalige Messung mit
// `tsc`, in D6 fehlten sie ganz. BEN verlangt sie „dauerhaft gruen … jede einzelne Oeffnung muss
// den Test rot faerben" — also als Test, der im Tor mitlaeuft, nicht als Protokollzeile.
//
// Der Test schreibt eine Fixture in ein TEMPORAERES Verzeichnis, laesst `tsc --noEmit` darauf
// laufen und prueft die EXAKT erwartete Diagnose je Verbot. Er ruft damit den Compiler als
// Messgeraet auf, so wie ein Laufzeittest die Laufzeit aufruft.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");
let ordner: string;

/** Legt eine Consumer-Fixture an und gibt die Diagnosen von `tsc --noEmit` zurueck. */
function diagnosen(quelle: string): string {
  const datei = join(ordner, "fixture.ts");
  writeFileSync(datei, quelle, "utf8");
  const rel = relative(WURZEL, datei);
  try {
    execFileSync(
      "npx",
      [
        "tsc",
        "--noEmit",
        "--strict",
        "--target",
        "ES2022",
        "--module",
        "ESNext",
        "--moduleResolution",
        "bundler",
        rel,
      ],
      { cwd: WURZEL, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    return ""; // Exit 0 = keine Diagnose = das Verbot greift NICHT
  } catch (fehler) {
    const e = fehler as { stdout?: string; stderr?: string };
    return `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }
}

beforeAll(() => {
  ordner = mkdtempSync(join(tmpdir(), "h3-typvertrag-"));
});
afterAll(() => {
  rmSync(ordner, { recursive: true, force: true });
});

const INDEX = JSON.stringify(
  join(WURZEL, "services", "wissensnetz", "index.ts").replace(/\.ts$/, ""),
);

describe("H3 · der Consumer-Typvertrag (Compiler-Negativtest)", () => {
  it("C1 · `LesemodellService` ist ueber den Paket-Index NICHT importierbar", () => {
    const aus = diagnosen(`
import { LesemodellService } from ${INDEX};
export const x = LesemodellService;
`);
    expect(aus, "der Import gelang — der Consumer koennte sich eine Sicht bauen").not.toBe("");
    expect(aus).toContain("TS2305");
    expect(aus).toContain("LesemodellService");
  });

  it("C2 · `WissensnetzSicht` ist ueber den Paket-Index NICHT importierbar", () => {
    const aus = diagnosen(`
import type { WissensnetzSicht } from ${INDEX};
export const y = (s: WissensnetzSicht) => s;
`);
    expect(aus, "der Eingabetyp jeder Auswertung ist oeffentlich geworden").not.toBe("");
    expect(aus).toContain("TS2305");
    expect(aus).toContain("WissensnetzSicht");
  });

  it("C3 · die Option `sichtbar` wird am Einstieg abgelehnt", () => {
    const aus = diagnosen(`
import { wissensnetzLuecken } from ${INDEX};
export const z = (b: never, lm: never) =>
  wissensnetzLuecken(b, lm, { sichtbar: () => true });
`);
    expect(aus, "ein Praedikat im Optionsobjekt wurde angenommen — der alte Bypass").not.toBe("");
    expect(aus).toContain("TS2353");
    expect(aus).toContain("sichtbar");
  });

  it("C4 · KALIBRIERUNG: ein ERLAUBTER Consumer kompiliert — der Test misst nicht nur Fehler", () => {
    // Ohne diesen Fall waere jede der drei Zusicherungen auch dann gruen, wenn der Compiler
    // aus einem ganz anderen Grund immer meckert.
    const aus = diagnosen(`
import { wissensnetzLuecken, type Sichtmetrik } from ${INDEX};
export const ok = (b: never, lm: never): Promise<Sichtmetrik> =>
  wissensnetzLuecken(b, lm, { deckel: 10 });
`);
    expect(aus, `der erlaubte Weg kompiliert nicht:\n${aus}`).toBe("");
  });
});
