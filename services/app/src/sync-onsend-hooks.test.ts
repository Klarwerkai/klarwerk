import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// WP-E2 (ben-Auflage 1b): Architektur-Pin auf QUELLTEXT-Ebene. Die WP-E-Regel "app-globale onSend-
// Hooks IMMER synchron (Callback-Stil)" ist im Typsystem nicht erzwingbar — dieser Test macht einen
// Rückbau (async onSend) an den Produktionsstellen rot, BEVOR er das wrap-thenable-Doppel-Send-
// Fenster (ERR_HTTP_HEADERS_SENT → Prozess-Crash) wieder öffnet. Quelltext-Pins statt Laufzeit-
// Introspektion: Fastify exponiert die Hook-Definitionsform (async vs. Callback) zur Laufzeit nicht.

const SRC = dirname(fileURLToPath(import.meta.url));

function read(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

// Die beiden Produktionsstellen mit app-globalen onSend-Hooks: der Noindex-Hook (von server.ts
// verdrahtet) und Schicht 2 der Add-in-Statics (per skip-override app-global).
const PRODUCTION_FILES = ["server.ts", "noindex-hook.ts", "routes/addin-static-routes.ts"];

describe("WP-E2: globale onSend-Hooks bleiben synchron (Callback-Stil)", () => {
  it("keine async-onSend-Registrierung in den Produktionsdateien", () => {
    for (const rel of PRODUCTION_FILES) {
      expect(read(rel), `${rel}: async onSend ist verboten (WP-E)`).not.toMatch(
        /addHook\(\s*["']onSend["']\s*,\s*async/,
      );
    }
  });

  it("beide Stellen registrieren onSend im 4-Parameter-Callback-Stil (done)", () => {
    expect(read("noindex-hook.ts")).toMatch(
      /addHook\(\s*["']onSend["']\s*,\s*\(_?request,\s*reply,\s*payload,\s*done\)/,
    );
    expect(read("routes/addin-static-routes.ts")).toMatch(
      /addHook\(\s*["']onSend["']\s*,\s*\(request,\s*reply,\s*payload,\s*done\)/,
    );
  });

  it("server.ts verdrahtet den Noindex-Hook über die exportierte Produktionsfunktion", () => {
    expect(read("server.ts")).toMatch(/registerNoindexHook\(app\)/);
  });
});
