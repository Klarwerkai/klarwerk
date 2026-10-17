// @vitest-environment jsdom
// ================================================================================================
// aufnahme:20260922:excel-erster-weg · Ben-Befund B · DER GEMEINSAME ANMELDEDIALOG NENNT DEN HOST
// ================================================================================================
//
// Excel und PowerPoint nutzen die vorhandene Dialogseite `apps/web/public/word-addin/anmeldung.html`.
// Ausgeführt wird die AUSGELIEFERTE Seite (Rumpf und Inline-Skript, wie in
// `tests/office-web-anmeldung/dialogseite.test.ts`), mit dem Aufruf, den das jeweilige Fenster
// wirklich macht. Geprüft: der Zwecksatz nennt Excel bzw. PowerPoint, Word bleibt Word, und ohne
// erkennbaren Host steht kein falscher Host da, sondern „Office".
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { REPO_WURZEL } from "../support/repoPfad";
import { lies } from "./buehne";

const DIALOG = join(REPO_WURZEL, "apps/web/public/word-addin/anmeldung.html");

interface Seite {
  document: {
    body: { innerHTML: string };
    getElementById(id: string): { textContent: string | null } | null;
  };
  history: { replaceState(zustand: unknown, titel: string, url: string): void };
  fetch?: unknown;
  Office?: unknown;
}

const g = globalThis as unknown as Seite;

function zerlege(html: string): { markup: string; script: string } {
  const rumpf = html.indexOf("<body>");
  const auf = html.indexOf("<script>", rumpf);
  const zu = html.lastIndexOf("</script>");
  return {
    markup: html.slice(rumpf + "<body>".length, auf),
    script: html.slice(auf + "<script>".length, zu),
  };
}

async function oeffne(abfrage: string): Promise<string> {
  const { markup, script } = zerlege(readFileSync(DIALOG, "utf8"));
  g.history.replaceState(null, "", `/word-addin/anmeldung.html${abfrage}`);
  g.fetch = async (url: string) => {
    if (url === "/api/auth/status") {
      const koerper = { needsSetup: false, oidcEnabled: false };
      return { ok: true, status: 200, json: async () => koerper };
    }
    // Nicht angemeldet: die Seite zeigt ihr Formular samt Zwecksatz.
    return { ok: false, status: url === "/api/auth/me" ? 401 : 404, json: async () => ({}) };
  };
  g.Office = {
    context: { ui: { messageParent(): void {} } },
    onReady(cb: () => void): void {
      cb();
    },
  };
  g.document.body.innerHTML = markup;
  new Function(script)();
  for (let i = 0; i < 10; i += 1) {
    await new Promise((r) => setTimeout(r, 0));
  }
  return g.document.getElementById("zweck")?.textContent ?? "";
}

afterEach(() => {
  Reflect.deleteProperty(g, "fetch");
  Reflect.deleteProperty(g, "Office");
  g.document.body.innerHTML = "";
  g.history.replaceState(null, "", "/");
});

describe("Ben-Befund B · der Anmeldedialog nennt den tatsächlichen Host", () => {
  it("das Excel-/PowerPoint-Fenster übergibt seinen Host an die Dialogseite", () => {
    expect(lies("taskpane.js")).toContain(
      '"/word-addin/anmeldung.html" + "?host=" + encodeURIComponent(z.host || "")',
    );
  });

  const FAELLE: [string, string][] = [
    ["?host=excel&_host_Info=Excel$Mac$16.01$de-DE$telemetry$isDialog$$0", "Excel"],
    ["?host=powerpoint", "PowerPoint"],
    ["?_host_Info=Word$Mac$16.01$de-DE$telemetry$isDialog$$0", "Word"],
    ["", "Office"],
  ];

  it.each(FAELLE)("Aufruf „%s“ → %s", async (abfrage, host) => {
    const zweck = await oeffne(abfrage);
    expect(zweck).toContain(host);
    if (host !== "Word") {
      expect(zweck).not.toContain("Word");
    }
  });
});
