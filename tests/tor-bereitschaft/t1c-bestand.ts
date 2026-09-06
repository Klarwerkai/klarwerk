import { readdirSync } from "node:fs";
import { join } from "node:path";

// JOB 3159: im eigenen Arbeitsbaum mit Python Path.rglob, .ts/.tsx ohne .test.ts/.test.tsx
// und ohne node_modules, dist oder Punkt-Einträge gemessen: 460 Quelldateien unter apps/web/src.
// Diese Zahl steigt nur mit einer neuen Messung und fällt nie stillschweigend.
export const BESTAND_UNTERGRENZE = 460;

/** Eigener Baumdurchlauf; repo-relative POSIX-Pfade, keine Abhängigkeit vom Modalgrenzen-Sucher. */
export function erhebeBestand(wurzel: string, verzeichnis = ""): string[] {
  const gefunden: string[] = [];
  const offen = [verzeichnis.split(/[\\/]/).filter(Boolean)];
  while (offen.length > 0) {
    const teile = offen.pop();
    if (!teile) break;
    for (const eintrag of readdirSync(join(wurzel, ...teile), { withFileTypes: true })) {
      const name = eintrag.name;
      if (name.startsWith(".") || name === "node_modules" || name === "dist") continue;
      const pfad = [...teile, name];
      if (eintrag.isDirectory()) {
        offen.push(pfad);
      } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
        gefunden.push(pfad.join("/"));
      }
    }
  }
  return gefunden;
}
