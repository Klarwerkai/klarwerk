// ================================================================================================
// WORD-HOST-GESAMTWEG · DER DIALOG BEHÄLT SEINEN OFFICE-OPENER — GEMESSEN AM DRAHT
// ================================================================================================
//
// Realhostbeleg 05.10.2026 (Word für das Web): der Anmeldedialog meldete „Signed in", die Anmeldung
// erreichte das Seitenfenster nie, office.js warf `Sys.ArgumentNullException … conversationId`. Der
// ausgelieferte Kopf der Dialogseite war `Cross-Origin-Opener-Policy: same-origin` — für ein
// Fenster, das ein fremder Office-Rahmen geöffnet hat, trennt er die Opener-Beziehung, über die
// office.js im Dialog seine Gegenstelle findet. `services/app/src/security-headers.ts` setzt deshalb
// GENAU für die Dialogseite `unsafe-none`.
//
// Gemessen wird die ECHTE Produktionsregistrierung (`registerSecurityHeaders`) per `app.inject`:
//   K1  die Dialogseite — auch mit der Office-Query `?_host_Info=…` — trägt `unsafe-none`
//   K2  Gegenprobe: das Taskpane, die Wurzel, die API und jede Pfadvariante behalten `same-origin`
//   K3  nichts sonst am Dialog wird gelockert: Ersatz-CSP unverändert, CORP bleibt `same-origin`
// Was diese Datei NICHT ersetzt: die automatische Übergabe im echten Word-Web-Dialog. Sie bleibt
// ein getrennter Realhostnachweis (`docs/operations/word-web-hostabnahme/README.md`, W4/W5).
import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  OFFICE_DIALOG_COOP,
  OFFICE_DIALOG_PATH,
  WORD_ADDIN_CSP,
  registerSecurityHeaders,
} from "../../services/app/src/security-headers";

const TASKPANE = "/word-addin/taskpane.html";
/** Die Office-Query aus dem Realhostbeleg (OFFICE-DIALOG-FEHLER.json), in Teilen geschrieben. */
const HOST_INFO = [
  "?_host_Info=word$web$16.00$de-de",
  "74101732-14a8-b271-55bd-bbec48d22dda",
  "isDialog$$0",
].join("$");

/** Was Word im Web wirklich aufruft — samt Office-Query. */
const DIALOG_WIE_WORD = `${OFFICE_DIALOG_PATH}${HOST_INFO}`;

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();
  await registerSecurityHeaders(app);
  // Stellvertreter-Routen: die Kopfzeilen kommen aus helmet und dem onSend-Hook, nicht aus der Route.
  for (const pfad of [
    OFFICE_DIALOG_PATH,
    TASKPANE,
    "/",
    "/api/auth/me",
    "/word-addin/anmeldung.htmlx",
    "/word-addin/Anmeldung.html",
    "/word-addin/anmeldung.html/",
  ]) {
    app.get(pfad, async (_request, reply) => reply.type("text/html").send("ok"));
  }
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

async function kopf(url: string): Promise<Record<string, unknown>> {
  const antwort = await app.inject({ method: "GET", url });
  expect(antwort.statusCode, url).toBe(200);
  return antwort.headers;
}

describe("Word-Host-Gesamtweg · die Dialogseite kappt den Office-Opener nicht", () => {
  it("K1 · die Dialogseite trägt `unsafe-none` — mit und ohne Office-Query", async () => {
    expect(OFFICE_DIALOG_COOP).toBe("unsafe-none");
    for (const url of [OFFICE_DIALOG_PATH, DIALOG_WIE_WORD]) {
      const k = await kopf(url);
      expect(k["cross-origin-opener-policy"], url).toBe("unsafe-none");
    }
  });

  it("K2 · Gegenprobe: alles andere behält `same-origin` — die Korrektur ist kein Pauschalwert", async () => {
    for (const url of [
      TASKPANE,
      `${TASKPANE}${HOST_INFO}`,
      "/",
      "/api/auth/me",
      "/word-addin/anmeldung.htmlx",
      "/word-addin/Anmeldung.html",
      "/word-addin/anmeldung.html/",
    ]) {
      const k = await kopf(url);
      expect(k["cross-origin-opener-policy"], url).toBe("same-origin");
    }
  });

  it("K3 · sonst wird am Dialog nichts gelockert: Ersatz-CSP und CORP unverändert, kein XFO-Zuwachs", async () => {
    const k = await kopf(DIALOG_WIE_WORD);
    expect(k["content-security-policy"]).toBe(WORD_ADDIN_CSP);
    expect(k["cross-origin-resource-policy"]).toBe("same-origin");
    expect(k["x-frame-options"]).toBeUndefined();
    // Der Wert steht genau einmal da — kein Rest von helmet daneben.
    expect(Array.isArray(k["cross-origin-opener-policy"])).toBe(false);
  });
});
