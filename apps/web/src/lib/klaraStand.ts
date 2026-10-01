import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { APP_VERSION } from "../version";

// R-1028 (Auftrag deploy-health-commit): der sichtbare Stand im Word-Panel („Klara <Stand>").
//
// Die Programmversion darin ist DIESELBE Konstante, die die Web-Topbar zeigt (`APP_VERSION` aus
// `apps/web/src/version.ts`) — das Plugin `klara-stand` in `apps/web/vite.config.ts` reicht sie
// beim Bauen herein. Word-Panel und Web-Konsole können so keine unterschiedlichen Programmstände
// behaupten. Bauzeit und Git-Kürzel bleiben dahinter stehen: sie beantworten „wann und woraus
// wurde gebaut", die Version „welcher Stand ist das".
//
// Die Plugin-Fabrik `klaraStand()` wohnt ebenfalls hier und nicht in `apps/web/vite.config.ts`:
// `tests/deploy-health-commit/eine-programmversion.test.ts` führt GENAU DIESES Plugin aus und
// importiert es dafür statisch. Ein statischer Import der Vite-Konfiguration zöge sie in den
// Root-Typcheck, wo sie nicht typisierbar ist (Begründung am Kopf von `vite.config.ts`, JOB 4367);
// ein Import über einen Laufzeitpfad verbirgt den Modulpfad vor dem Wächter in
// `tests/legal/mega61-rechtsseiten.test.tsx`. Dasselbe Muster wie `textmodulVertrag()`.
//
// Die Add-in-Fassung (`KLARA_TASKPANE_FASSUNG`, = `<Version>` im Office-Manifest) ist davon
// getrennt: Office verlangt dort vier Zahlen, sie steuert den Office-Cache und wird im Panel als
// „Add-in-Fassung" bezeichnet, nicht als Stand.

/** Der Text, der im gebauten Word-Panel an die Stelle von `__KLARA_STAND__` tritt. */
export function klaraStandText(version: string, gebautUm: Date, gitKuerzel: string): string {
  const zeit = `${gebautUm.toISOString().slice(0, 16).replace("T", " ")}Z`;
  return [version, zeit, gitKuerzel].filter((teil) => teil.length > 0).join(" · ");
}

/**
 * Das Build-Plugin `klara-stand`, eingetragen in `apps/web/vite.config.ts`.
 *
 * STRUKTURELL TYPISIERT, ohne `import type { Plugin } from "vite"` — wie `textmodulVertrag()`.
 */
interface KlaraStandPlugin {
  readonly name: "klara-stand";
  readonly apply: "build";
  configResolved(config: {
    readonly root: string;
    readonly build: { readonly outDir: string };
  }): void;
  closeBundle(): void;
}

// AUFTRAG-mega69 Block E: der sichtbare Auslieferungsstand von Klara (public/word-addin/
// taskpane.html trägt den Platzhalter __KLARA_STAND__ und zeigt ihn unauffällig an). Der Wert
// entsteht beim Bauen — Programmversion (`APP_VERSION`, wie die Web-Topbar; R-1028),
// Datum/Uhrzeit (UTC) plus, wenn verfügbar, das kurze Git-Kürzel.
// Damit ändert er sich bei jeder Auslieferung von selbst; niemand pflegt eine Zahl von Hand, und
// es gibt keine zweite Wahrheit neben dem Build. Ohne .git (z. B. Docker-Kontext ohne Repo)
// bleibt ehrlich nur der Zeitstempel. public/ wird von Vite 1:1 kopiert (kein Transform-Hook für
// diese Dateien) — deshalb der Ersatz NACH dem Bündeln direkt in dist/.
export function klaraStand(): KlaraStandPlugin {
  let ziel: { root: string; outDir: string } | null = null;
  return {
    name: "klara-stand",
    apply: "build",
    configResolved(resolved) {
      ziel = { root: resolved.root, outDir: resolved.build.outDir };
    },
    closeBundle() {
      if (!ziel) {
        return;
      }
      const file = resolve(ziel.root, ziel.outDir, "word-addin", "taskpane.html");
      let html: string;
      try {
        html = readFileSync(file, "utf8");
      } catch {
        return; // kein word-addin im Build (z. B. abgespeckter Test-Build) — nichts zu stempeln
      }
      let sha = "";
      try {
        sha = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
          .toString()
          .trim();
      } catch {
        // ohne Git-Kontext trägt der Stand nur den Zeitstempel — ehrlich statt erfunden
      }
      // R-1028: vorn steht die Programmversion aus DERSELBEN Konstante wie in der Web-Topbar.
      const stamp = klaraStandText(APP_VERSION, new Date(), sha);
      // replaceAll: der Platzhalter steht auch in erklärenden Kommentaren der Datei — nach dem
      // Stempeln trägt die ausgelieferte Fassung überall denselben Stand (replace() erwischte nur
      // das erste Vorkommen, und das war ein Kommentar).
      writeFileSync(file, html.replaceAll("__KLARA_STAND__", stamp));
    },
  };
}
