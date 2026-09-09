import { type ConsoleMessage, type Request, type Response, test as basis } from "@playwright/test";
import { installiereNavDiagnose } from "./nav-diagnose";

export { expect } from "@playwright/test";

/**
 * Nur die Diagnose-Sonden verwenden diese automatische Fixture. Alle sechs Bestandskanten
 * bleiben unverändert. Mitschnitt bleibt im Läufer über page.goto/Reload/Seitenfehler hinweg
 * erhalten; bei Rot zusätzlich im Tor-Log, bei jedem Ausgang als Playwright-Anhang.
 */
export const test = basis.extend<{ navDiagnose: undefined }>({
  navDiagnose: [
    async ({ page }, use, info) => {
      const zeilen: string[] = [];
      const offen = new Set<Promise<void>>();
      const nummern = new Map<Request, number>();
      const log = (art: string, detail: Record<string, unknown>) => {
        zeilen.push(JSON.stringify({ zeit: Date.now(), art, ...detail }));
      };
      const konsole = (msg: ConsoleMessage) => {
        const text = msg.text();
        if (text.startsWith("KW-NAV-DIAG ")) zeilen.push(text.slice("KW-NAV-DIAG ".length));
        // Der Router meldet den Aufruf vor seinem Layout-Effekt selbst. Keine beliebigen
        // Konsolentexte protokollieren (sie könnten Inhalte oder Zugangsdaten tragen).
        if (text.includes("You should call navigate() in a React.useEffect()")) {
          log("router-warnung", { grund: "navigate-vor-layout-effekt" });
        }
      };
      const relevant = (request: Request) => new URL(request.url()).pathname === "/api/auth/notice";
      const anfrage = (request: Request) => {
        if (!relevant(request)) return;
        nummern.set(request, nummern.size + 1);
        log("notice-request", { anfrage: nummern.get(request), methode: request.method() });
      };
      const antwort = (response: Response) => {
        if (!relevant(response.request())) return;
        const detail = { anfrage: nummern.get(response.request()), status: response.status() };
        log("notice-response", detail);
        const lesen = response.json().then(
          (data: unknown) => {
            const due =
              data !== null && typeof data === "object" && "due" in data ? data.due : null;
            log("notice-body", { ...detail, due: typeof due === "boolean" ? due : null });
          },
          () => {
            // Diagnosefehler sichtbar halten; ein fehlender Body ist kein bestätigter Hinweis.
            log("notice-body-unlesbar", detail);
          },
        );
        offen.add(lesen);
        void lesen.then(() => offen.delete(lesen));
      };
      const fehlgeschlagen = (request: Request) => {
        if (relevant(request) || request.resourceType() === "script") {
          log("requestfailed", {
            pfad: new URL(request.url()).pathname,
            anfrage: nummern.get(request),
            grund: request.failure()?.errorText ?? null,
          });
        }
      };
      const seitenfehler = (error: Error) =>
        log("pageerror", {
          name: error.name,
          // Ohne Meldungstext; Bündelpositionen bleiben für die Zuordnung im Trace erhalten.
          stack: (error.stack ?? "")
            .split("\n")
            .slice(1)
            .join("\n")
            .replace(/https?:\/\/[^\s)]+/g, (url) => url.replace(/[?#][^:\s)]*/g, "")),
        });
      page.on("console", konsole);
      page.on("request", anfrage);
      page.on("response", antwort);
      page.on("requestfailed", fehlgeschlagen);
      page.on("pageerror", seitenfehler);
      await page.addInitScript(installiereNavDiagnose);
      try {
        await use(undefined);
      } finally {
        page.off("console", konsole);
        page.off("request", anfrage);
        page.off("response", antwort);
        page.off("requestfailed", fehlgeschlagen);
        page.off("pageerror", seitenfehler);
        await Promise.all(offen);
        log("test-ende", { status: info.status, pfad: new URL(page.url()).pathname });
        const body = zeilen.join("\n");
        await info.attach("navigation-diagnose.jsonl", {
          body,
          contentType: "application/x-ndjson",
        });
        if (info.status !== info.expectedStatus) console.log(`KW-NAV-DIAG\n${body}`);
      }
    },
    { auto: true },
  ],
});
