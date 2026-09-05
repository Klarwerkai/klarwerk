import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

// ================================================================================================
// JOB 3071 · LIEFERUNG 7 — DIE ABLÖSUNG DES FEST VERDRAHTETEN LITERALS.
// ================================================================================================
//
// Abgelöst wird `resolution: { reason: "participant_deleted", by: null, … }` in `onKoRemoved`. Nach
// diesem Auftrag gibt es dort genau EINE Stelle, die den Grund bestimmt — die Ableitung aus dem
// Port — und keinen zweiten Weg daneben. Ein Verhaltenstest sieht das nicht: er misst das Ergebnis
// EINER Lage, nicht die Zahl der Wege. Wer morgen ein zweites `participant_deleted` in denselben
// Körper schriebe („für den Sonderfall X"), käme an den Verhaltenstests vorbei.
//
// DIESER WÄCHTER LIEST DESHALB DEN KÖRPER SELBST und hält zwei Dinge fest:
//   1. `onKoRemoved` verdrahtet keinen Abschlussgrund mehr als Literal in seinen Schreib-Patch;
//      der Grund kommt aus einer Variablen.
//   2. Der Aufräumweg des Dienstes hat weiterhin genau EINEN Schreibaufruf (`closeOpenForKo`).
//
// Er ersetzt keinen Verhaltenstest — er deckt den Fall ab, den ein Verhaltenstest nicht sehen kann.
describe("JOB 3071 · Lieferung 7: der Grund entsteht aus der Ableitung, nicht aus einem Literal", () => {
  async function koerperVonOnKoRemoved(): Promise<string> {
    const quelle = await readFile(
      new URL("../../services/conflicts/src/overlap-service.ts", import.meta.url),
      "utf8",
    );
    const zeilen = quelle.split("\n");
    const start = zeilen.findIndex((z) => z.includes("async onKoRemoved("));
    expect(start, "onKoRemoved nicht gefunden").toBeGreaterThan(-1);
    // Bis zur nächsten Methode auf derselben Einrückungsebene (zwei Leerzeichen + Bezeichner).
    const rest = zeilen.slice(start + 1);
    const ende = rest.findIndex((z) => /^ {2}(async |private |public |[a-zA-Z])/.test(z));
    return rest.slice(0, ende === -1 ? rest.length : ende).join("\n");
  }

  /** Codezeilen ohne Kommentare — die Begründungen im Körper dürfen die Wörter nennen. */
  function code(koerper: string): string[] {
    return koerper
      .split("\n")
      .map((z) => z.trim())
      .filter(
        (z) => z.length > 0 && !z.startsWith("//") && !z.startsWith("*") && !z.startsWith("/*"),
      );
  }

  it("der Schreib-Patch trägt die abgeleitete Variable, kein Grund-Literal", async () => {
    const koerper = await koerperVonOnKoRemoved();
    const start = koerper.indexOf("this.repo.closeOpenForKo(");
    expect(start, "der eine Schreibaufruf fehlt").toBeGreaterThan(-1);
    const aufruf = koerper.slice(start, koerper.indexOf("\n    );", start));
    // Vor JOB 3071 stand hier wörtlich `reason: "participant_deleted", by: null`. Steht wieder ein
    // Literal im Patch, ist die Ableitung umgangen — auch dann, wenn sie daneben noch existiert.
    expect(aufruf, `Grund wieder fest im Patch: ${aufruf}`).not.toMatch(/reason:\s*"/);
    expect(aufruf).toContain("resolution");
  });

  it("genau EINE Ableitung bestimmt den Grund, und sie steht vor dem Schreiben", async () => {
    const koerper = await koerperVonOnKoRemoved();
    const zeilen = code(koerper);
    // Eine einzige Zuweisung — zwei wären zwei Stellen, die den Grund bestimmen.
    expect(zeilen.filter((z) => /^const resolution =/.test(z))).toHaveLength(1);
    // Und sie hängt am Rückgabewert des Ports, nicht an einer Nebenbedingung des Aufrufs.
    expect(zeilen.filter((z) => /^const zurueckgezogenVon = await this\./.test(z))).toHaveLength(1);
    expect(koerper.indexOf("const resolution =")).toBeLessThan(
      koerper.indexOf("this.repo.closeOpenForKo("),
    );
  });

  it("es bleibt bei genau EINEM Schreibaufruf im Aufräumweg", async () => {
    const zeilen = code(await koerperVonOnKoRemoved());
    expect(zeilen.filter((z) => z.includes("this.repo.closeOpenForKo("))).toHaveLength(1);
    // Kein zweiter Schreibweg daneben (Einzel-Update oder CAS je Befund).
    expect(zeilen.filter((z) => z.includes("this.repo.update("))).toEqual([]);
    expect(zeilen.filter((z) => z.includes("this.repo.supersedeIfOpen("))).toEqual([]);
  });

  it("die eine Stelle, die den Grund bestimmt, kennt beide Gründe — und sonst keine", async () => {
    const quelle = await readFile(
      new URL("../../services/conflicts/src/overlap-service.ts", import.meta.url),
      "utf8",
    );
    const codezeilen = quelle
      .split("\n")
      .map((z) => z.trim())
      .filter(
        (z) => z.length > 0 && !z.startsWith("//") && !z.startsWith("*") && !z.startsWith("/*"),
      );
    // `participant_deleted` und `withdrawn_own` stehen im ganzen Dienst nur noch in der Ableitung.
    const fundstellen = codezeilen.filter(
      (z) => z.includes('"participant_deleted"') || z.includes('"withdrawn_own"'),
    );
    expect(fundstellen).toHaveLength(2);
  });
});
