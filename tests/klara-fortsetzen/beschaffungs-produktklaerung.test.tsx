// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from "vitest";
import {
  type AuftragsUmgebung,
  ergaenzeBeschaffung,
  leseAusfuehrungen,
  starteAuftrag,
  vergissAusfuehrungen,
} from "../../apps/web/src/components/klara-vorschau/auftrag";
import { vergiss } from "../../apps/web/src/components/klara-vorschau/echt";
import type { Herkunft } from "../../apps/web/src/components/klara-vorschau/zustand";
import i18n from "../../apps/web/src/i18n";
import { fehlendeBeschaffungsangaben } from "../../apps/web/src/lib/klaraBeschaffungsauftrag";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import { type App, draht, registrieren } from "./vorrichtung";

let app: App;
let token = "";
let originalFetch: typeof globalThis.fetch;
let auftragsanlagen = 0;
const herkunft: Herkunft = {
  pfad: "/start",
  seite: "uebersicht",
  seitenName: "Start",
  objekt: "Fiktive BES-1-Produktklärung",
};
const u: AuftragsUmgebung = { t: i18n.t.bind(i18n), navigiere: () => {}, ort: () => "/start" };
const auf = (m: "GET" | "POST" | "PUT" | "DELETE", p: string, b?: unknown) =>
  draht(app, token)(m, p, b);

beforeEach(async () => {
  vergiss();
  vergissAusfuehrungen();
  await i18n.changeLanguage("de");
  app = buildApp(assembleServices(inMemoryRepos()));
  await app.ready();
  token = await registrieren(app);
  originalFetch = globalThis.fetch;
  auftragsanlagen = 0;
  // Bestehender Client-/Klärungscaller spricht über normale Auth-Routen mit echter InMemory-App.
  globalThis.fetch = (async (input, init) => {
    const url = typeof input === "string" ? input : String(input);
    const method = (init?.method ?? "GET") as "GET" | "POST" | "PUT" | "DELETE";
    if (method === "POST" && /\/auftraege$/.test(url)) auftragsanlagen++;
    const r = await auf(method, url, init?.body ? JSON.parse(String(init.body)) : undefined);
    return new Response(r.body, {
      status: r.statusCode,
      headers: { "content-type": "application/json" },
    });
  }) as typeof globalThis.fetch;
});
afterEach(async () => {
  globalThis.fetch = originalFetch;
  vergiss();
  vergissAusfuehrungen();
  await app.close();
});

async function fertigeOriginale(produkt: string, menge = "500 Stück") {
  await expect
    .poll(() => leseAusfuehrungen()[0]?.phase, { timeout: 5000, interval: 10 })
    .toBe("fertig");
  expect(auftragsanlagen).toBe(1);
  const g = (await auf("GET", "/api/me/klara/gespraech")).json().gespraech;
  expect(g?.id).toBeTruthy();
  const jobs = (await auf("GET", `/api/me/klara/gespraeche/${g.id}/auftraege`)).json().auftraege;
  expect(jobs).toHaveLength(1);
  expect(jobs[0]).toMatchObject({
    stand: "abgeschlossen",
    beschaffung: { produkt, menge, termin: "2035-11-30" },
  });
  const ds = (await auf("GET", "/api/drafts")).json();
  expect(ds).toHaveLength(2);
  for (const d of ds) expect(d.payload.bodyHtml).toContain(produkt);
  const anfrage = ds.find((d: { id: string }) => d.id === jobs[0].schritte[1].ergebnis.id);
  expect(anfrage.payload.bodyHtml).toContain(jobs[0].schritte[0].ergebnis.id);
}

it("BES-P1 · konkreter BES-1-Satz speichert vor Produktklärung weder Auftrag noch Entwurf; bewusste PX-18-Wahl bindet danach beide Originale", async () => {
  expect(
    starteAuftrag(
      "Besorge neue Angebote für die Verpackung von Produkt „PX-17“ oder Produkt „PX-18“ für 500 Stück bis 2035-11-30",
      "getippt",
      herkunft,
      u,
    ),
  ).toBe("gestartet");
  const a = leseAusfuehrungen()[0];
  expect(a).toMatchObject({ phase: "rueckfrage", auftrag: null, gespraechId: null });
  expect(a?.beschaffung && fehlendeBeschaffungsangaben(a.beschaffung)).toEqual(["produkt"]);
  expect(auftragsanlagen).toBe(0);
  expect((await auf("GET", "/api/me/klara/gespraech")).json().gespraech).toBeNull();
  expect((await auf("GET", "/api/drafts")).json()).toHaveLength(0);
  if (!a) throw new Error("Gezielte Produktrückfrage fehlt");
  ergaenzeBeschaffung(a.lokalId, { produkt: "PX-18" }, u);
  await fertigeOriginale("PX-18");
  expect(leseAusfuehrungen()[0]?.wortlaut).toBe(a.wortlaut);
});

it.each([
  [
    'Prepare new offers for the packaging of product "PX-17" or product PX-17 for 500 pieces by 2035-11-30',
    "500 pieces",
  ],
  [
    "Vraag nieuwe offertes voor de verpakking van product PX-17 voor 500 stuks voor 2035-11-30",
    "500 stuks",
  ],
])(
  "BES-P2 · gleiche Produktwiederholung/eindeutiger Gegenfall braucht keine Produktklärung: %s",
  async (text, menge) => {
    expect(starteAuftrag(text, "getippt", herkunft, u)).toBe("gestartet");
    expect(leseAusfuehrungen()[0]?.beschaffung?.produkt).toBe("PX-17");
    expect(leseAusfuehrungen()[0]?.phase).not.toBe("rueckfrage");
    await fertigeOriginale("PX-17", menge);
  },
);
