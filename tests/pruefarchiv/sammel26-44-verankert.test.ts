// ================================================================================================
// R-2042 (OFFEN I5) — DIE BEN-RUNDEN SAMMEL26–44 SIND IM REPOSITORY VERANKERT, NICHT NUR IN `_relay/`.
// ================================================================================================
//
// GEGENSTAND. I5 hielt fest, dass `_relay/` in `.gitignore` steht und mit keinem Klon reist, und
// dass die Runden sammel26–44 deshalb noch nirgends gesichert waren. Das Archiv
// `docs/qm/pruefarchiv-sammel26-44.md` führt jetzt je Runde genau eine Zeile mit den versionierten
// Fundstellen. Dieser Prüfstand hält drei Dinge:
//
//   1. JEDE RUNDE GENAU EINMAL. Keine Runde fehlt still, keine steht doppelt.
//   2. JEDE FUNDSTELLE TRÄGT. Die genannte Datei existiert, die Zeile liegt in ihr, und die Datei
//      nennt die Runde selbst. Ein Archiv, das auf Stellen zeigt, die nichts mehr sagen, ist ein
//      Haufen. Die Zeilennummer ist ein Stand vom Erheben; geprüft wird die Nennung in der Datei,
//      damit eine fremde Änderung oberhalb der Stelle diesen Prüfstand nicht rot macht.
//   3. SPURLOS HEISST SPURLOS. Eine Zeile ohne Fundstelle muss das sagen, statt leer zu wirken.
//
// WAS ER NICHT PRÜFT: ob die damaligen Befunde heute noch geschlossen sind, und ob ein Inhalts-SHA
// stimmt. Die Berichte liegen nur in `_relay/`; das Archiv führt den SHA deshalb als „fehlt“. Die
// Regel verlangt kein SHA-Feld, damit ein nachgereichter Bericht die Zeile ergänzen kann.
//
// Die Regel ist eine reine Funktion und wird zuerst an synthetischen Archiven gegengeprüft.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const WURZEL = fileURLToPath(new URL("../../", import.meta.url));
const ARCHIV_PFAD = "docs/qm/pruefarchiv-sammel26-44.md";
const RUNDEN = Array.from({ length: 19 }, (_, i) => 26 + i);
const SPURLOS = "keine versionierte Spur";

interface Zeile {
  runde: number;
  befund: string;
  fundstellen: { pfad: string; zeile: number }[];
}

function zeilenAus(archiv: string): Zeile[] {
  return archiv
    .split("\n")
    .filter((l) => /^\|\s*sammel\d+\s*\|/.test(l))
    .map((l) => {
      const zellen = l.split("|").map((z) => z.trim());
      const fundstellen = [...(zellen[6] ?? "").matchAll(/`([^`]+?):(\d+)`/g)].map((m) => ({
        pfad: m[1] as string,
        zeile: Number(m[2]),
      }));
      return {
        runde: Number((zellen[1] as string).replace("sammel", "")),
        befund: zellen[4] ?? "",
        fundstellen,
      };
    });
}

/** Liefert alle Mängel; leer heißt: das Archiv trägt. `lesen` gibt `null` für fehlende Dateien. */
function maengel(archiv: string, lesen: (pfad: string) => string | null): string[] {
  const funde: string[] = [];
  const zeilen = zeilenAus(archiv);
  for (const n of RUNDEN) {
    const anzahl = zeilen.filter((z) => z.runde === n).length;
    if (anzahl !== 1) funde.push(`sammel${n}: ${anzahl} Zeilen statt genau einer`);
  }
  for (const z of zeilen) {
    if (!RUNDEN.includes(z.runde)) funde.push(`sammel${z.runde}: nicht im Archivumfang 26–44`);
    if (z.fundstellen.length === 0 && !z.befund.includes(SPURLOS)) {
      funde.push(`sammel${z.runde}: ohne Fundstelle, sagt aber nicht „${SPURLOS}“`);
    }
    const marke = new RegExp(`sammel${z.runde}(?!\\d)`);
    for (const f of z.fundstellen) {
      const text = lesen(f.pfad);
      if (text === null) {
        funde.push(`sammel${z.runde}: ${f.pfad} fehlt`);
        continue;
      }
      if (f.zeile < 1 || f.zeile > text.split("\n").length) {
        funde.push(`sammel${z.runde}: ${f.pfad}:${f.zeile} liegt außerhalb der Datei`);
      }
      if (!marke.test(text)) funde.push(`sammel${z.runde}: ${f.pfad} nennt die Runde nicht`);
    }
  }
  return funde;
}

function kopf(): string {
  return (
    "| Runde | Stand | Verdikt | Befund | Folge | Fundstellen | Inhalts-SHA |\n" +
    "|---|---|---|---|---|---|---|\n"
  );
}

function synthetisch(ausser: number[] = [], extra = ""): string {
  const zeilen = RUNDEN.filter((n) => !ausser.includes(n)).map(
    (n) => `| sammel${n} | — | — | ${SPURLOS} | — | — | fehlt |`,
  );
  return `${kopf()}${zeilen.join("\n")}\n${extra}`;
}

describe("Kalibrierung der Archivregel an synthetischen Archiven", () => {
  const keineDatei = () => null;

  it("ein vollständiges, spurloses Archiv trägt", () => {
    expect(maengel(synthetisch(), keineDatei)).toEqual([]);
  });

  it("eine fehlende Runde ist rot", () => {
    expect(maengel(synthetisch([31]), keineDatei)).toEqual([
      "sammel31: 0 Zeilen statt genau einer",
    ]);
  });

  it("eine doppelte Runde ist rot", () => {
    const doppelt = synthetisch([], `| sammel40 | — | — | ${SPURLOS} | — | — | fehlt |`);
    expect(maengel(doppelt, keineDatei)).toEqual(["sammel40: 2 Zeilen statt genau einer"]);
  });

  it("eine Zeile ohne Fundstelle, die nicht spurlos sagt, ist rot", () => {
    const archiv = synthetisch([38], "| sammel38 | — | — | Befund ohne Beleg | — | — | fehlt |");
    expect(maengel(archiv, keineDatei)).toEqual([
      "sammel38: ohne Fundstelle, sagt aber nicht „keine versionierte Spur“",
    ]);
  });

  it("eine Fundstelle, die die Runde nicht nennt, fehlt oder zu kurz ist, ist rot", () => {
    const archiv = synthetisch(
      [32, 33, 34],
      [
        "| sammel32 | — | — | x | — | `a.ts:1` | fehlt |",
        "| sammel33 | — | — | x | — | `fehlt.ts:1` | fehlt |",
        "| sammel34 | — | — | x | — | `b.ts:9` | fehlt |",
      ].join("\n"),
    );
    const dateien: Record<string, string> = {
      // `sammel320` ist nicht `sammel32`: die Marke endet an der Ziffernfolge.
      "a.ts": "// sammel320\n",
      "b.ts": "// sammel34\n",
    };
    expect(maengel(archiv, (p) => dateien[p] ?? null)).toEqual([
      "sammel32: a.ts nennt die Runde nicht",
      "sammel33: fehlt.ts fehlt",
      "sammel34: b.ts:9 liegt außerhalb der Datei",
    ]);
  });
});

describe("R-2042: das echte Archiv sammel26–44", () => {
  const archiv = readFileSync(join(WURZEL, ARCHIV_PFAD), "utf8");
  const lesen = (pfad: string) => {
    const voll = join(WURZEL, pfad);
    return existsSync(voll) ? readFileSync(voll, "utf8") : null;
  };

  it("führt jede Runde genau einmal, und jede Fundstelle nennt ihre Runde", () => {
    expect(maengel(archiv, lesen)).toEqual([]);
  });

  it("zählt so, wie es im Text steht: 9 Runden mit Spur, 10 ohne", () => {
    const zeilen = zeilenAus(archiv);
    expect(zeilen.filter((z) => z.fundstellen.length > 0).map((z) => z.runde)).toEqual([
      32, 33, 34, 37, 39, 40, 42, 43, 44,
    ]);
    expect(zeilen.filter((z) => z.fundstellen.length === 0)).toHaveLength(10);
    expect(archiv).toContain("9 haben versionierte Spuren");
  });

  it("OFFEN.md I5 verweist auf das Archiv und behält den historischen Wortlaut", () => {
    const register = readFileSync(join(WURZEL, "OFFEN.md"), "utf8");
    const i5 = register.split("\n").find((l) => l.startsWith("| I5 |"));
    expect(i5).toBeDefined();
    expect(i5).toContain("Die älteren Runden sammel26–44 stehen weiterhin aus.");
    expect(i5).toContain(ARCHIV_PFAD);
  });
});
