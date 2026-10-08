// ================================================================================================
// AUFTRAG gesamt-sendehook-sammler — DIE EINE GRUNDMENGE DER SENDEHAKEN-WÄCHTER.
// ================================================================================================
//
// Zwei Wächter bewachen denselben Vertrag („onSend IMMER synchron"):
// `services/app/src/sync-onsend-hooks.test.ts` (der Sammler) und
// `services/app/src/b44-send-return-waechter.test.ts` (die Kanten um ihn herum). Bis zu diesem
// Auftrag erhob jeder seine Dateien selbst — und verschieden: der eine den ganzen Quellbaum mit
// allen Code-Endungen, der andere nur `.ts` unter services/. Eine `.mts`-Datei mit
// `app.addHook(hook, async …)` lag damit in der Grundmenge des einen und außerhalb der des anderen
// (bens Befund zum Kandidaten 8e554855). Zwei Grundmengen für einen Vertrag sind dieselbe Bauart wie
// die alte Handliste: jede Abweichung ist eine Stelle, an die keiner hinsieht. Deshalb steht die
// Grundmenge HIER, einmal, und beide Wächter lesen sie.
//
// GELTUNGSBEREICH: Diese Datei ist eine TESTHILFE und enthält keine Zusicherung.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { REPO_WURZEL } from "./repoPfad";

export { REPO_WURZEL };

const CODE = /\.(?:[cm]?[jt]s|[jt]sx)$/;
// Abhängigkeiten, Bauausgaben und unversionierte Arbeitsordner (.gitignore) — überall im Baum.
const NICHT_ERHOBEN = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  "test-results",
  "playwright-report",
  "_relay",
  "LOT",
]);
// Die Testbäume — nur auf oberster Ebene; ein `tests`-Ordner tief im Produktbaum bleibt erhoben.
// Dort hängen Prüfstände bewusst eigene async-onSend-Hooks an Test-Apps (z. B.
// tests/app/mega71-onsend-synchron.test.ts Teil 2 als fremder Hook) — Messaufbau, kein Produkt.
const TESTBAEUME = new Set(["tests", "tests-smoke"]);

/**
 * Alle Produkt-Codedateien des Repos (alle JS/TS-Endungen außer *.test.* / *.spec.*), ohne
 * node_modules, Punkt-Verzeichnisse, Bauausgaben, Arbeitsordner und die Testbäume.
 */
export function produktCodeDateien(dir: string = REPO_WURZEL, ebene = 0): string[] {
  const out: string[] = [];
  for (const eintrag of readdirSync(dir, { withFileTypes: true })) {
    const pfad = join(dir, eintrag.name);
    if (eintrag.isDirectory()) {
      const ausgenommen =
        eintrag.name.startsWith(".") ||
        NICHT_ERHOBEN.has(eintrag.name) ||
        (ebene === 0 && TESTBAEUME.has(eintrag.name));
      if (!ausgenommen) {
        out.push(...produktCodeDateien(pfad, ebene + 1));
      }
    } else if (CODE.test(eintrag.name) && !/\.(?:test|spec)\.[^.]+$/.test(eintrag.name)) {
      out.push(pfad);
    }
  }
  return out;
}

/**
 * Kommentare raus, Zeilennummern ERHALTEN (Muster aus tests/app/mega70-rohlink-sammler.test.ts):
 * eine bloße Erwähnung („hier stand ein async onSend") zählt nicht als Registrierung, Fundstellen
 * bleiben zitierfähig.
 */
export function ohneKommentare(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|\s)\/\/.*$/gm, (m) => m.replace(/[^\n]/g, " "));
}
