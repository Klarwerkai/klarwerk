// ================================================================================================
// FE-003 · E8/E5 — DIE VORSCHAU IST DER KANDIDAT: gebaut, gestartet, per HTTP zugeordnet, KI aus.
// ================================================================================================
//
// Gegen den echten Anwendungsserver (Prüfstand und Quellen in `kandidat.ts`):
//   · /health meldet genau den erwarteten Commit und die Version aus package.json;
//   · /api/reasoner/status meldet KI aus (active=false, reachable=none);
//   · /fragen antwortet mit 200 und liefert die Anwendung aus — beim selbst gebauten Kandidaten
//     byte-gleich mit `apps/web/dist/index.html`, und das Bündel dahinter ist abrufbar.
// Ohne erreichbaren Server oder mit falscher Commit-Vorgabe (`FE003_ERWARTETER_COMMIT`) ist die
// Datei rot — kein Überspringen. Am Ende wird ein selbst gestarteter Server beendet und das geprüft.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import {
  DIST_INDEX,
  type Kandidat,
  type Stand,
  erwarteterStand,
  kandidatBereitstellen,
  pruefeKandidat,
} from "./kandidat";

let kandidat: Kandidat | undefined;
let stand: Stand;

beforeAll(async () => {
  stand = erwarteterStand();
  kandidat = await kandidatBereitstellen(inject("fe003KandidatUrl"));
}, 900_000);

afterAll(async () => {
  if (kandidat?.selbstGestartet) {
    expect(await kandidat.beenden(), "der selbst gestartete Server ist beendet").toBe(true);
    expect(kandidat.lebt()).toBe(false);
  }
});

function basis(): string {
  if (!kandidat) {
    throw new Error("kein Kandidat");
  }
  return kandidat.url;
}

describe("FE-003 E8 · die Vorschau ist dem Kandidaten zugeordnet", () => {
  it("/health meldet den erwarteten Commit und die Version aus package.json", async () => {
    const antwort = await fetch(`${basis()}/health`, { signal: AbortSignal.timeout(5_000) });
    expect(antwort.status).toBe(200);
    const health = (await antwort.json()) as Record<string, unknown>;
    expect(health.status).toBe("ok");
    expect(health.commit, "Commit des laufenden Kandidaten").toBe(stand.commit);
    expect(health.version, "Version des laufenden Kandidaten").toBe(stand.version);
  });

  it("E5 · die KI ist nicht verfügbar", async () => {
    const antwort = await fetch(`${basis()}/api/reasoner/status`, {
      signal: AbortSignal.timeout(5_000),
    });
    expect(antwort.status).toBe(200);
    const ki = (await antwort.json()) as Record<string, unknown>;
    expect(ki.active).toBe(false);
    expect(ki.reachable).toBe("none");
  });

  it("/fragen antwortet mit 200 und liefert die Anwendung aus", async () => {
    const antwort = await fetch(`${basis()}/fragen`, { signal: AbortSignal.timeout(5_000) });
    expect(antwort.status).toBe(200);
    expect(antwort.headers.get("content-type") ?? "").toContain("text/html");
    const html = await antwort.text();
    expect(html).toContain('<div id="root"');
    if (kandidat?.selbstGestartet) {
      expect(html, "ausgeliefert wird genau der eben gebaute Stand").toBe(
        readFileSync(DIST_INDEX, "utf8"),
      );
    }
    const skript = /<script[^>]+src="([^"]+)"/.exec(html)?.[1];
    expect(skript, "die Seite verweist auf ihr Bündel").toBeTruthy();
    const buendel = await fetch(new URL(skript as string, `${basis()}/fragen`), {
      signal: AbortSignal.timeout(5_000),
    });
    expect(buendel.status).toBe(200);
    expect(buendel.headers.get("content-type") ?? "").toMatch(/javascript/);
  });

  it("alle Zusagen zusammen, wie sie auch die Browserdatei vorab prüft", async () => {
    const befund = await pruefeKandidat(basis(), stand);
    expect(befund.health.commit).toBe(stand.commit);
  });
});
