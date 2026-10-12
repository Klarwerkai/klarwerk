// ================================================================================================
// BPA-13 · AC06 (K6) — DIE TATSÄCHLICHE, BEGRENZTE DATEIWIRKUNG EINES PROGRAMMIERAUFTRAGS.
// ================================================================================================
//
// Nacharbeit 2 (Ben, offene_belege): „bisher ist nur die Prüfung übergebener Pfadlisten belegt".
// Diese Datei schreibt WIRKLICH — in einen synthetischen Arbeitsbereich unter dem Temp-Ordner — und
// misst danach im Dateisystem, was geschrieben wurde und was unberührt blieb: ein fremder
// Projektordner daneben, ein Symlink aus dem Arbeitsbereich hinaus, Löschen und Betriebsaktionen.
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  KI_CODEX_MAX_BYTES,
  wendeCodexAenderungenAn,
} from "../../services/app/src/ki-codex-arbeitsbereich";

let basis = "";
let wurzel = "";
let fremd = "";

beforeEach(() => {
  basis = mkdtempSync(join(tmpdir(), "bpa13-codex-"));
  wurzel = join(basis, "arbeitsbereich");
  fremd = join(basis, "fremdes-projekt");
  mkdirSync(join(wurzel, "src"), { recursive: true });
  mkdirSync(fremd, { recursive: true });
  writeFileSync(join(fremd, "geheim.ts"), "ORIGINAL");
  writeFileSync(join(wurzel, "src", "alt.ts"), "export const ALT = 1;\n");
  // Zwei Wege aus dem Arbeitsbereich hinaus, beide INNERHALB eines erlaubten Präfixes angelegt.
  symlinkSync(fremd, join(wurzel, "src", "ordner-link"));
  symlinkSync(join(fremd, "geheim.ts"), join(wurzel, "src", "datei-link.ts"));
});

afterEach(() => {
  rmSync(basis, { recursive: true, force: true });
});

const auftrag = () => ({ paketId: "kp_synth", wurzel, erlaubtePfade: ["src", "tests"] });

describe("K6 · nur erlaubte Dateien werden wirklich geschrieben", () => {
  it("legt an und ändert im Arbeitsbereich — mit Prüfsumme des geschriebenen Inhalts", async () => {
    const inhalt = "export const PREIS = 120;\n";
    const w = await wendeCodexAenderungenAn(auftrag(), [
      { pfad: "src/preis.ts", art: "anlegen", inhalt },
      { pfad: "src/alt.ts", art: "aendern", inhalt: "export const ALT = 2;\n" },
      { pfad: "tests/preis.test.ts", art: "anlegen", inhalt: "// leer\n" },
    ]);
    expect(w.abgelehnt).toEqual([]);
    expect(w.geschrieben.map((g) => [g.pfad, g.art])).toEqual([
      ["src/preis.ts", "anlegen"],
      ["src/alt.ts", "aendern"],
      ["tests/preis.test.ts", "anlegen"],
    ]);
    expect(readFileSync(join(wurzel, "src", "preis.ts"), "utf8")).toBe(inhalt);
    expect(readFileSync(join(wurzel, "src", "alt.ts"), "utf8")).toBe("export const ALT = 2;\n");
    expect(w.geschrieben[0]?.sha256).toBe(createHash("sha256").update(inhalt).digest("hex"));
  });

  it("fremder Projektordner, Symlinks, Löschen und Betriebsaktionen bleiben ohne Wirkung", async () => {
    const w = await wendeCodexAenderungenAn(
      auftrag(),
      [
        { pfad: "../fremdes-projekt/geheim.ts", art: "aendern", inhalt: "UEBERSCHRIEBEN" },
        { pfad: join(fremd, "geheim.ts"), art: "aendern", inhalt: "UEBERSCHRIEBEN" },
        { pfad: "src/ordner-link/geheim.ts", art: "aendern", inhalt: "UEBERSCHRIEBEN" },
        { pfad: "src/ordner-link/neu.ts", art: "anlegen", inhalt: "NEU" },
        { pfad: "src/datei-link.ts", art: "aendern", inhalt: "UEBERSCHRIEBEN" },
        { pfad: "src/alt.ts", art: "loeschen" },
        { pfad: "docs/notiz.md", art: "anlegen", inhalt: "x" },
      ],
      ["deploy", "shell", "npm install"],
    );
    expect(w.geschrieben).toEqual([]);
    expect(w.abgelehnt).toEqual([
      { pfad: "../fremdes-projekt/geheim.ts", grund: "ausserhalb_arbeitsbereich" },
      { pfad: join(fremd, "geheim.ts"), grund: "ausserhalb_arbeitsbereich" },
      { pfad: "src/ordner-link/geheim.ts", grund: "ausserhalb_nach_aufloesung" },
      { pfad: "src/ordner-link/neu.ts", grund: "ausserhalb_nach_aufloesung" },
      { pfad: "src/datei-link.ts", grund: "symlink" },
      { pfad: "src/alt.ts", grund: "loeschen_nicht_erlaubt" },
      { pfad: "docs/notiz.md", grund: "pfad_nicht_erlaubt" },
    ]);
    expect(w.abgelehnteAktionen).toEqual(["deploy", "shell", "npm install"]);
    // Die Gegenprobe im Dateisystem: nichts ausserhalb ist berührt, nichts gelöscht.
    expect(readFileSync(join(fremd, "geheim.ts"), "utf8")).toBe("ORIGINAL");
    expect(existsSync(join(fremd, "neu.ts"))).toBe(false);
    expect(existsSync(join(wurzel, "src", "alt.ts"))).toBe(true);
    expect(existsSync(join(wurzel, "docs"))).toBe(false);
  });

  it("überschreibt nicht beim Anlegen, legt nicht beim Ändern an und begrenzt die Grösse", async () => {
    const w = await wendeCodexAenderungenAn(auftrag(), [
      { pfad: "src/alt.ts", art: "anlegen", inhalt: "NEU" },
      { pfad: "src/fehlt.ts", art: "aendern", inhalt: "NEU" },
      { pfad: "src/ohne-inhalt.ts", art: "anlegen" },
      { pfad: "src/gross.ts", art: "anlegen", inhalt: "x".repeat(KI_CODEX_MAX_BYTES + 1) },
    ]);
    expect(w.geschrieben).toEqual([]);
    expect(w.abgelehnt.map((a) => a.grund)).toEqual([
      "existiert_bereits",
      "existiert_nicht",
      "inhalt_fehlt",
      "zu_gross",
    ]);
    expect(readFileSync(join(wurzel, "src", "alt.ts"), "utf8")).toBe("export const ALT = 1;\n");
    expect(existsSync(join(wurzel, "src", "fehlt.ts"))).toBe(false);
    expect(existsSync(join(wurzel, "src", "gross.ts"))).toBe(false);
  });
});
