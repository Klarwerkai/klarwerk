import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { nimmSkillDateiAuf } from "../services/app/src/assistenz-faehigkeiten";

// Administrativer Leseweg: Die explizit gewählte Datei wird ausschließlich beschrieben.
// Weder Registry, Adapterinstallation noch eine Ausführung sind Teil dieses Werkzeugs.
const argumente = process.argv.slice(2);
if (argumente.length !== 1 || !argumente[0]) {
  process.stderr.write("Aufruf: npx tsx tools/skill-ablage-vorschau.ts <SKILL.md>\n");
  process.exitCode = 2;
} else {
  try {
    const datei = resolve(argumente[0]);
    const ablage = nimmSkillDateiAuf(readFileSync(datei, "utf8"), datei);
    process.stdout.write(`${JSON.stringify(ablage, null, 2)}\n`);
  } catch {
    process.stderr.write("SKILL-Vorschau: Die gewählte Datei konnte nicht gelesen werden.\n");
    process.exitCode = 1;
  }
}
