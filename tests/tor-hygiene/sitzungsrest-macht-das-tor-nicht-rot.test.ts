// ================================================================================================
// JOB 3080 · EIN SITZUNGSREST IM PRODUKTBAUM DARF DAS TOR NICHT ROT MACHEN.
// ================================================================================================
//
// DER VORFALL, zweimal protokolliert (Steuerungsakte `UEBERGABE.md:171-174`, für dich nicht
// lesbar, hier vollständig zitiert): am 04.09.2026 mussten die Jobs 3018 und 3044 ihren Einbau
// wiederholen, weil ein unversionierter Sitzungsrest (`.claude/settings.local.json`) den
// Formatprüfer im Tor auf `main` rot machte. Die Fehlerausgabe beider Läufe war wörtlich
// dieselbe (Kontrollakten `archiv/3018/runde-1/tor-main.1.err:6`, `archiv/3044/runde-4/tor-main.1.err:6`):
//
//   ./.claude/settings.local.json format ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//     × Formatter would have printed the following content:
//
// DER WEG: `tools/check:10` ruft `./tools/lint`, `tools/lint:7` ruft ohne Pfad-Einschränkung
// `npx @biomejs/biome check "$@"` auf dem GANZEN Baum, einschließlich versteckter Ordner.
// `biome.json` → `files.ignore` kennt vor diesem Job keinen Eintrag für Agenten-Sitzungsordner.
//
// WARUM DER FIXTURE-BAUM AUSSERHALB DES REPOS LIEGT: ein Ordner namens `.claude/` oder `.codex/`
// IM Repo wäre echter Sitzungszustand eines Menschen oder Agenten — kein Test darf ihn anlegen
// oder löschen. Der Fixture-Baum entsteht deshalb je Fall in `mkdtemp(os.tmpdir())` und wird in
// `afterAll` wieder entfernt.
//
// `--no-errors-on-unmatched`, GEMESSEN statt vermutet: ohne diese Flagge meldet Biome für
// `check .claude .codex`, sobald BEIDE Pfade vollständig ignoriert sind, selbst einen Fehler
// (`internalError/io … No files were processed in the specified paths.`, Exit-Code 1) — ein
// Erfolg sähe sonst wie ein Fehlschlag aus. Die Flagge betrifft nur den Fall „nichts zu prüfen",
// nicht gefundene Formatabweichungen: Fall (b) unten bleibt mit ihr trotzdem korrekt rot, weil
// dort wieder echte Dateien gefunden werden.
//
// DREI FÄLLE, EINE ZUSAGE:
//   (a) Der Sitzungsordner hält das Tor nicht mehr auf — Biome läuft NUR über `.claude`/`.codex`
//       und findet nichts zu melden.
//   (b) GEGENPROBE — die echte, gerade editierte `biome.json`, aber zur Laufzeit um die beiden
//       neuen Einträge gekürzt: derselbe Lauf wird wieder rot. Das beweist, dass der Eintrag
//       wirkt und nicht eine Biome-Voreinstellung.
//   (c) Der Prüfer ist nicht stumpf geworden — voller Lauf über den ganzen Fixture-Baum mit der
//       ECHTEN Konfiguration: `src/echte-quelle.ts` wird weiterhin gemeldet, während die beiden
//       Sitzungsordner in derselben Ausgabe schweigen. Das schließt die naheliegende Halbheit
//       aus: ein zu weites Muster, das gleich den halben Baum verschluckt.
//
// GEMESSENER ZWISCHENSTAND (Red-first, VOR Lieferpunkt 2 — Auftragstext sagte „(c) grün" voraus;
// gemessen wurde stattdessen (a) UND (c) rot, weil Biome `.claude`/`.codex` heute ganz normal
// mitscannt, wie der Vorfall oben ja gerade belegt): alle drei Fälle rot. Die Einzelheiten stehen
// in der RUECKGABE.md dieses Jobs.
//
// `.codex/` steht mit demselben Argument in `files.ignore` wie `.claude/`: ein Arbeitsordner
// eines Agenten-Werkzeugs, nie Produktquelle, nie versioniert (`git ls-files` nennt genau sechs
// Punktdateien, keine davon unter `.claude/` oder `.codex/`). Für `.claude/` gibt es die beiden
// oben zitierten Vorfälle, für `.codex/` keinen protokollierten Vorfall — das wird hier nicht
// behauptet, sondern dieselbe vorbeugende Regel angewandt.
//
// KEIN `npx`: das Tor ist ohne Netz, also ruft dieser Test den Binärpfad
// `node_modules/.bin/biome` direkt per `spawnSync`, genau den Bestand, den `tools/lint:7` am
// Ende auch ausführt.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { repoPfad } from "../support/repoPfad";

const BIOME_BIN = repoPfad("node_modules/.bin/biome");

// Absichtlich falsch eingerückt (vier statt der in `biome.json` festgelegten zwei Leerzeichen) —
// das ist der Fall aus dem Vorfall vom 04.09.2026, wörtlich nachgebaut.
const FALSCH_FORMATIERTES_JSON = '{\n    "a": 1\n}\n';

// Die Kontrolle aus Fall (c): eine gewöhnliche, absichtlich falsch formatierte Quelldatei
// (Einrückung, fehlende Leerzeichen, fehlendes Semikolon).
const FALSCH_FORMATIERTE_QUELLE = "export function f(a,b) {\n    return a+b\n}\n";

const angelegteVerzeichnisse: string[] = [];

/**
 * Baut einen Prüfbaum: `biome.json` (Inhalt frei wählbar), zwei absichtlich falsch formatierte
 * Sitzungsordner und eine absichtlich falsch formatierte echte Quelldatei.
 *
 * Wirft, statt den Test zu schwächen, wenn das Environment das Anlegen von `.claude` verweigert
 * (EPERM/EACCES) — ein Test unter einem anderen Ordnernamen bewiese nichts über den Vorfall vom
 * 04.09.2026.
 */
function baueFixture(biomeJsonInhalt: string): string {
  const wurzel = mkdtempSync(join(tmpdir(), "kw-job3080-"));
  angelegteVerzeichnisse.push(wurzel);
  writeFileSync(join(wurzel, "biome.json"), biomeJsonInhalt, "utf-8");
  try {
    mkdirSync(join(wurzel, ".claude"), { recursive: true });
  } catch (fehler) {
    throw new Error(
      `Environment verweigert das Anlegen von .claude im Fixture (${String(fehler)}) — der Test bricht ab, statt einen anderen Ordnernamen zu prüfen.`,
    );
  }
  writeFileSync(join(wurzel, ".claude", "settings.local.json"), FALSCH_FORMATIERTES_JSON, "utf-8");
  mkdirSync(join(wurzel, ".codex"), { recursive: true });
  writeFileSync(join(wurzel, ".codex", "state.json"), FALSCH_FORMATIERTES_JSON, "utf-8");
  mkdirSync(join(wurzel, "src"), { recursive: true });
  writeFileSync(join(wurzel, "src", "echte-quelle.ts"), FALSCH_FORMATIERTE_QUELLE, "utf-8");
  return wurzel;
}

function fahreBiome(cwd: string, pfade: string[]): { code: number | null; aus: string } {
  const r = spawnSync(BIOME_BIN, ["check", ...pfade], { cwd, encoding: "utf-8" });
  return { code: r.status, aus: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

afterAll(() => {
  for (const wurzel of angelegteVerzeichnisse) {
    rmSync(wurzel, { recursive: true, force: true });
  }
});

describe("JOB 3080 · der Formatprüfer im Tor übersieht Agenten-Sitzungsordner, sonst nichts", () => {
  it("(a) der Sitzungsordner hält das Tor nicht mehr auf", () => {
    const echteBiomeJson = readFileSync(repoPfad("biome.json"), "utf-8");
    const wurzel = baueFixture(echteBiomeJson);

    // --no-errors-on-unmatched: „nichts zu prüfen, weil alles ignoriert ist" ist hier der
    // Erfolgsfall, kein Fehler. Ohne die Flagge meldet Biome dafür selbst einen Fehler
    // (gemessen: `internalError/io … No files were processed`, Exit-Code 1).
    const { code, aus } = fahreBiome(wurzel, [".claude", ".codex", "--no-errors-on-unmatched"]);

    expect(code, aus).toBe(0);
    expect(aus).not.toContain(".claude");
    expect(aus).not.toContain(".codex");
  });

  it("(b) GEGENPROBE — ohne die beiden neuen Einträge wird derselbe Lauf wieder rot", () => {
    const echteBiomeJson = JSON.parse(readFileSync(repoPfad("biome.json"), "utf-8")) as {
      files: { ignore: string[] };
    };
    const neueEintraege = echteBiomeJson.files.ignore.filter(
      (muster) => muster.includes(".claude") || muster.includes(".codex"),
    );
    expect(
      neueEintraege.length,
      "biome.json muss zwei files.ignore-Einträge für .claude und .codex enthalten " +
        "(Lieferpunkt 2 dieses Auftrags) — ohne sie kann diese Gegenprobe nichts entfernen.",
    ).toBe(2);

    const gekuerzteIgnore = echteBiomeJson.files.ignore.filter(
      (muster) => !muster.includes(".claude") && !muster.includes(".codex"),
    );
    const gekuerzteBiomeJson = JSON.stringify({
      ...echteBiomeJson,
      files: { ...echteBiomeJson.files, ignore: gekuerzteIgnore },
    });
    const wurzel = baueFixture(gekuerzteBiomeJson);

    const { code, aus } = fahreBiome(wurzel, [".claude", ".codex", "--no-errors-on-unmatched"]);

    expect(code, "ohne den Eintrag muss der Fund zurückkehren").not.toBe(0);
    expect(aus).toContain(".claude");
    expect(aus).toContain(".codex");
  });

  it("(c) der Prüfer ist nicht stumpf geworden — echte Quellen werden weiterhin gemeldet", () => {
    const echteBiomeJson = readFileSync(repoPfad("biome.json"), "utf-8");
    const wurzel = baueFixture(echteBiomeJson);

    const { code, aus } = fahreBiome(wurzel, ["."]);

    expect(code, "eine falsch formatierte echte Quelldatei muss das Tor rot machen").not.toBe(0);
    expect(aus).toContain("echte-quelle.ts");
    expect(aus, "die Sitzungsordner dürfen in derselben Ausgabe nicht auftauchen").not.toContain(
      ".claude",
    );
    expect(aus).not.toContain(".codex");
  });
});
