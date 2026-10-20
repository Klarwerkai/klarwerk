// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from "vitest";
import {
  type AuftragsUmgebung,
  brecheAuftragAb,
  ladeAuftraege,
  leseAusfuehrungen,
  starteAuftrag,
  vergissAusfuehrungen,
  waehleErinnerungszeit,
} from "../../apps/web/src/components/klara-vorschau/auftrag";
import { leseEcht, vergiss } from "../../apps/web/src/components/klara-vorschau/echt";
import type { Herkunft } from "../../apps/web/src/components/klara-vorschau/zustand";
import i18n from "../../apps/web/src/i18n";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import { type App, draht, registrieren } from "./vorrichtung";

let app: App;
let token = "";
let originalFetch: typeof globalThis.fetch;
let halte: "vorschau" | "anlage" | null = null;
let freigabe: (() => void) | null = null;
let gehalten = false;
let anlagen = 0;
const herkunft: Herkunft = {
  pfad: "/start",
  seite: "uebersicht",
  seitenName: "Start",
  objekt: "Fiktiver R-G2-Stoppfall",
};
const u: AuftragsUmgebung = { t: i18n.t.bind(i18n), navigiere: () => {}, ort: () => "/start" };
const zeit = { datum: "2035-10-22", uhrzeit: "09:00", zeitzone: "Europe/Berlin" };
const bis = async (f: () => boolean) => {
  await expect.poll(f, { timeout: 5000, interval: 10 }).toBe(true);
};

beforeEach(async () => {
  vergiss();
  vergissAusfuehrungen();
  await i18n.changeLanguage("de");
  app = buildApp(assembleServices(inMemoryRepos()));
  await app.ready();
  token = await registrieren(app);
  originalFetch = globalThis.fetch;
  halte = null;
  freigabe = null;
  gehalten = false;
  anlagen = 0;
  globalThis.fetch = (async (input, init) => {
    const url = typeof input === "string" ? input : String(input);
    const method = (init?.method ?? "GET") as "GET" | "POST" | "PUT" | "DELETE";
    const response = await draht(app, token)(
      method,
      url,
      init?.body ? JSON.parse(String(init.body)) : undefined,
    );
    if (method === "POST" && /\/auftraege$/.test(url)) anlagen++;
    const sollHalten =
      (halte === "vorschau" && url.endsWith("/erinnerungen/vorschau")) ||
      (halte === "anlage" && method === "POST" && /\/auftraege$/.test(url));
    if (sollHalten) {
      gehalten = true;
      await new Promise<void>((resolve) => {
        freigabe = resolve;
      });
    }
    return new Response(response.body, {
      status: response.statusCode,
      headers: { "content-type": "application/json" },
    });
  }) as typeof globalThis.fetch;
});
afterEach(async () => {
  freigabe?.();
  globalThis.fetch = originalFetch;
  vergiss();
  await app.close();
});

async function rueckfrage() {
  expect(
    starteAuftrag(
      "Lege mir die Aufgabe „R-G2 Filter prüfen“ an und erinnere mich",
      "getippt",
      herkunft,
      u,
    ),
  ).toBe("gestartet");
  await bis(() => leseAusfuehrungen()[0]?.phase === "rueckfrage");
  const a = leseAusfuehrungen()[0];
  if (!a) throw new Error("Rückfrage fehlt");
  return a;
}

it("R-G2a · echte gehaltene Zeitvorschau → endgültiger lokaler Stopp → verspätete Antwort erzeugt keinen Auftrag", async () => {
  const a = await rueckfrage();
  halte = "vorschau";
  const lauf = waehleErinnerungszeit(a.lokalId, 2, zeit, u);
  await bis(() => gehalten);
  await brecheAuftragAb(a.lokalId, u);
  expect(leseAusfuehrungen()[0]).toMatchObject({ abbruch: true, phase: "fertig", auftrag: null });
  halte = null;
  freigabe?.();
  await lauf;
  expect(anlagen).toBe(0);
  expect(leseAusfuehrungen()[0]).toMatchObject({ abbruch: true, phase: "fertig", auftrag: null });
  // Frisches Laden kann keinen verlorenen endgültigen Stopp als fortsetzbaren Serverauftrag zeigen.
  const g = (await draht(app, token)("GET", "/api/me/klara/gespraech")).json().gespraech;
  expect(g).toBeNull();
  vergissAusfuehrungen();
  expect(leseAusfuehrungen()).toHaveLength(0);
  expect((await draht(app, token)("GET", "/api/me/klara/aufgaben")).json().aufgaben).toHaveLength(
    0,
  );
  expect(
    (await draht(app, token)("GET", "/api/me/klara/erinnerungen")).json().erinnerungen,
  ).toHaveLength(0);
});

it("R-G2b · Stopp gewinnt während tatsächlicher Serveranlage; zurückkommender Auftrag wird vor jeder Wirkung persistent abgebrochen", async () => {
  const a = await rueckfrage();
  halte = "anlage";
  const lauf = waehleErinnerungszeit(a.lokalId, 2, zeit, u);
  await bis(() => gehalten);
  expect(anlagen).toBe(1);
  await brecheAuftragAb(a.lokalId, u);
  halte = null;
  freigabe?.();
  await lauf;
  await bis(() => Boolean(leseAusfuehrungen()[0]?.auftrag?.abgebrochenAm));
  const gid = leseEcht().gespraech?.id;
  if (!gid) throw new Error("Tatsächliches Gespräch fehlt");
  const liste = (await draht(app, token)("GET", `/api/me/klara/gespraeche/${gid}/auftraege`)).json()
    .auftraege;
  expect(liste).toHaveLength(1);
  expect(liste[0]).toMatchObject({
    stand: "abgebrochen",
    abgebrochenAm: expect.any(String),
    schritte: [],
  });
  await bis(() => Date.now() > Date.parse(liste[0].angelegtAm));
  vergissAusfuehrungen();
  await ladeAuftraege(gid, herkunft);
  expect(leseAusfuehrungen()[0]).toMatchObject({
    abbruch: true,
    phase: "fertig",
    auftrag: { stand: "abgebrochen" },
  });
  expect((await draht(app, token)("GET", "/api/me/klara/aufgaben")).json().aufgaben).toHaveLength(
    0,
  );
  expect(
    (await draht(app, token)("GET", "/api/me/klara/erinnerungen")).json().erinnerungen,
  ).toHaveLength(0);
});
