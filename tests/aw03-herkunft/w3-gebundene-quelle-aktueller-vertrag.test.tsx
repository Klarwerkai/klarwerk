// @vitest-environment jsdom
// W3 / AW03-K02: neue Montage auf 86f2/.1017. Definitionen, noch kein Laufbeleg.
// Reale Import-/KO-Dienste, regulär registrierte HTTP-Leserouten und echte Webhooks;
// nur GA-Ablage In-Memory und fetch -> app.inject. Kein Browser-/Office-/Host-/PG-Nachweis.
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement, type ReactNode } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { AnweisungLesestand, KoVersionSnapshot } from "../../apps/web/src/api/types";
import {
  GespeicherteFassung,
  GespeicherteFassungAnsicht,
} from "../../apps/web/src/components/GespeicherteFassung";
import { LesestandAnsicht } from "../../apps/web/src/components/gesamtanweisung/LesestandAnsicht";
import i18n from "../../apps/web/src/i18n";
import { leseGespeicherteFassung } from "../../apps/web/src/lib/objektbezug";
import { quellabschnitteAus as webAbschnitte } from "../../apps/web/src/lib/quellabschnitt";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { sichtbarkeitsfilterFuer } from "../../services/app/src/sichtbarkeit";
import { quellabschnitteAus } from "../../services/knowledge-object";
import { GesamtanweisungDienst } from "../../services/knowledge-object/src/gesamtanweisung-service";
import type { ImportItem } from "../../services/library-analytics";
import { InMemoryAnweisungRepo } from "../wiki-gesamtanweisung/pruefstand";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };
const OFFEN = sichtbarkeitsfilterFuer({ id: "w3-autor", role: "admin" });
const apps: App[] = [];
const mounts: { root: ReturnType<typeof createRoot>; container: HTMLDivElement }[] = [];
const clients: QueryClient[] = [];

beforeEach(async () => {
  vi.stubEnv("KLARWERK_SKIP_KEYCHAIN", "1");
  await i18n.changeLanguage("de");
});
afterEach(async () => {
  await act(async () => {
    for (const { root } of mounts.splice(0)) root.unmount();
  });
  for (const client of clients.splice(0)) client.clear();
  for (const container of document.querySelectorAll("[data-w3-mount]")) container.remove();
  for (const app of apps.splice(0)) await app.close();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function zeichne(element: ReactNode) {
  const container = document.createElement("div");
  container.dataset.w3Mount = "";
  document.body.appendChild(container);
  const root = createRoot(container);
  mounts.push({ root, container });
  await act(async () => root.render(element));
  return container;
}

async function anmelden(app: App, email: string): Promise<Auth> {
  const res = await app.inject({ method: "POST", url: "/api/auth/login",
    payload: { email, password: "fiktiv12345" } });
  expect(res.statusCode, res.body).toBe(200);
  return { authorization: "Bearer " + res.json().token };
}

async function bestand() {
  const services = buildServices();
  const app = buildApp(services);
  apps.push(app);
  const registriert = await app.inject({ method: "POST", url: "/api/auth/register",
    payload: { name: "W3 Admin", email: "admin@w3.test", password: "fiktiv12345" } });
  expect(registriert.statusCode, registriert.body).toBe(201);
  const admin = await anmelden(app, "admin@w3.test");
  const angelegt = await app.inject({ method: "POST", url: "/api/users", headers: admin,
    payload: { name: "W3 Leser", email: "leser@w3.test", password: "fiktiv12345", role: "viewer" } });
  expect(angelegt.statusCode, angelegt.body).toBe(201);
  const viewer = await anmelden(app, "leser@w3.test");
  const quelle = (version: number): ImportItem => ({
    title: "Fiktive W3-Pumpenwartung", statement: "W3 Quellfassung " + version,
    bodyHtml: "<p>W3 Quelltext " + version + ".</p>", type: "best_practice", category: "W3",
    provider: "Confluence", externalId: "W3-SEITE", sourceVersion: version,
    url: "https://wiki.example.test/w3", confidentiality: "intern",
  });
  for (const version of [7, 8]) {
    await services.library.importJson([quelle(version)], "w3-autor", () => ({ dublette: false }),
      { zielDarf: () => true });
  }
  const [ko] = await services.ko.list();
  if (!ko) throw new Error("W3-Erstimport fehlt");
  await services.ko.revise(ko.id, { statement: "W3 heutige Fachüberarbeitung" }, "w3-autor");
  const fassungen = await services.ko.versionsOf(ko.id);
  expect(fassungen.map((f) => f.version)).toEqual([1, 2, 3]);
  const anker = fassungen.find((f) => f.version === 1)?.snapshot.sources.find(
    (s) => s.externalId === "W3-SEITE");
  if (!anker?.sourceRecordId) throw new Error("W3 gebundene Revision fehlt");
  const dienst = new GesamtanweisungDienst({ ko: services.ko, repo: new InMemoryAnweisungRepo(),
    kennung: randomUUID, jetzt: () => "2026-10-21T00:00:00.000Z" });
  let anweisung = await dienst.anlegen({ titel: "W3 fiktive Anleitung" }, "w3-autor");
  anweisung = await dienst.bausteinAufnehmen(anweisung.id, anweisung.version,
    { koId: ko.id, koVersion: 1, nachweisHash: null }, OFFEN);
  return { app, services, admin, viewer, id: ko.id, anker, dienst, anweisung };
}

function revision(app: App, auth: Auth, id: string, sourceRecordId: string) {
  return app.inject({ method: "GET", headers: auth,
    url: "/api/kos/" + encodeURIComponent(id) + "/quellrevisionen/" + encodeURIComponent(sourceRecordId) });
}

async function gespeicherteAnsicht(f: Awaited<ReturnType<typeof bestand>>, auth: Auth) {
  vi.stubGlobal("fetch", async (input: unknown) => {
    const res = await f.app.inject({ method: "GET", url: String(input), headers: auth });
    // Auch der heutige Rechtekontext-Kopf läuft durch den unveränderten API-Client.
    return { status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300,
      statusText: String(res.statusCode), headers: new Headers(res.headers as HeadersInit),
      text: async () => res.body };
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  const container = await zeichne(createElement(QueryClientProvider, { client },
    createElement(GespeicherteFassung, { koId: f.id, fassung: 1, ankerId: f.anker.id })));
  return { client, container };
}

const marke = (container: HTMLElement, name: string) =>
  container.querySelector<HTMLElement>('[data-testid="gespeicherte-fassung' + name + '"]');

async function bis(soll: () => void) {
  await vi.waitFor(async () => { await act(async () => { await Promise.resolve(); }); soll(); },
    { timeout: 3000, interval: 10 });
}

describe("W3 · gebundene Quelle am heutigen Öffnungsweg", () => {
  it("vom tatsächlichen Absatzlink zur Quellfassung 7 trotz Re-Sync und manueller Fassung 3", async () => {
    const f = await bestand();
    const vorher = await f.services.ko.versionsOf(f.id);
    const stand = JSON.parse(JSON.stringify(await f.dienst.lesen(f.anweisung.id, OFFEN))) as AnweisungLesestand;
    const absatz = await zeichne(createElement(LesestandAnsicht, { stand,
      lage: { art: "stand", frisch: true, auffrischungGescheitert: false, offline: false },
      zeit: stand.geaendertAm }));
    const link = absatz.querySelector<HTMLAnchorElement>('[data-testid="ga-lesestand-fassung-oeffnen"]');
    expect(link).not.toBeNull();
    const href = new URL(link?.getAttribute("href") ?? "", "https://klarwerk.example.test");
    expect(href.pathname).toBe("/wissen/" + f.id);
    expect(leseGespeicherteFassung(href.searchParams)).toEqual({ fassung: 1, ankerId: f.anker.id });
    expect(stand.bausteine[0]?.quellabschnitte?.[0]).toMatchObject({
      quellfassung: 7, quellrevision: f.anker.sourceRecordId, fundstelle: "quellseite:W3-SEITE@7" });
    const quellinhalt = await revision(f.app, f.viewer, f.id, f.anker.sourceRecordId ?? "");
    expect(quellinhalt.statusCode, quellinhalt.body).toBe(200);
    expect(quellinhalt.json()).toMatchObject({ uebernommenInFassung: 1, abgleich: "bestaetigt",
      inhalt: { statement: "W3 Quellfassung 7", bodyHtml: "<p>W3 Quelltext 7.</p>" } });
    const { container } = await gespeicherteAnsicht(f, f.viewer);
    await bis(() => expect(marke(container, "-quellinhalt-aussage")?.textContent).toBe("W3 Quellfassung 7"));
    expect(container.textContent).not.toContain("W3 heutige Fachüberarbeitung");
    expect(container.textContent).not.toContain("W3 Quelltext 8");
    expect((await revision(f.app, f.viewer, f.id, "fremde-revision")).statusCode).toBe(404);
    expect(await f.services.ko.versionsOf(f.id)).toEqual(vorher);
  });

  it("heutige Quellleser, Freigabestufe und Space gelten auch für alte Inhalte und gecachte Abfragen", async () => {
    const f = await bestand();
    const { client, container } = await gespeicherteAnsicht(f, f.viewer);
    await bis(() => expect(marke(container, "-quellinhalt-aussage")?.textContent).toBe("W3 Quellfassung 7"));
    await f.services.ko.setQuellrechte(f.id, { stufe: "intern", leser: [], version: 8 }, "w3-autor");
    await act(async () => { await client.invalidateQueries({ queryKey: ["ko", f.id] }); });
    await bis(() => expect(marke(container, "-fehler")).not.toBeNull());
    expect(container.textContent).not.toContain("W3 Quelltext 7");
    for (const auth of [f.admin, f.viewer]) {
      expect((await revision(f.app, auth, f.id, f.anker.sourceRecordId ?? "")).statusCode).toBe(404);
    }
    const route = "/api/kos/" + f.id + "/versions";
    expect((await f.app.inject({ method: "GET", url: route, headers: f.viewer })).statusCode).toBe(404);
    await f.services.ko.setQuellrechte(f.id, { stufe: "intern", version: 8 }, "w3-autor");
    await f.services.ko.setConfidentiality(f.id, "vertraulich", "w3-autor");
    expect((await revision(f.app, f.viewer, f.id, f.anker.sourceRecordId ?? "")).statusCode).toBe(404);
    expect((await revision(f.app, f.admin, f.id, f.anker.sourceRecordId ?? "")).statusCode).toBe(200);
    await f.services.ko.setLeadingSpace(f.id, "w3-nicht-lesbarer-space", "w3-autor", null);
    expect((await revision(f.app, f.admin, f.id, f.anker.sourceRecordId ?? "")).statusCode).toBe(404);
    expect((await f.app.inject({ method: "GET", url: route, headers: f.admin })).statusCode).toBe(404);
    // Auch die Absatzprojektion muss den aktuellen Space an dieselbe Sichtbarkeitsregel tragen.
    const danach = await f.dienst.lesen(f.anweisung.id, OFFEN);
    expect(danach.bausteine).toHaveLength(0);
    expect(JSON.stringify(danach)).not.toContain("W3 Quelltext 7");
  });

  it("alte Anker bleiben ungeprüft und eine fehlende gebundene Fassung bleibt ohne Ersatz", async () => {
    const f = await bestand();
    const saetze = await f.services.ko.versionsOf(f.id);
    const snapshot = saetze[0]?.snapshot;
    if (!snapshot) throw new Error("W3 gespeicherter Inhalt fehlt");
    const { externalId: _id, sourceVersion: _version, sourceRecordId: _revision, ...ohneStand } = f.anker;
    const alt = { ...ohneStand, excerpt: null, url: "javascript:alert(1)" };
    const anker = [alt];
    expect(webAbschnitte(anker)).toEqual(quellabschnitteAus(anker));
    expect(quellabschnitteAus(anker)?.[0]).toMatchObject({ stand: "ungeprueft", fundstelle: null });
    const fassungen = [{ ...saetze[0], snapshot: { ...snapshot, sources: anker } }] as KoVersionSnapshot[];
    const container = await zeichne(createElement(GespeicherteFassungAnsicht,
      { fassung: 1, ankerId: f.anker.id, lage: { art: "da", fassungen } }));
    expect(marke(container, "-quellinhalt-nicht-erhalten")).not.toBeNull();
    expect(container.querySelector("a")).toBeNull();
    const fehlt = await zeichne(createElement(GespeicherteFassungAnsicht,
      { fassung: 99, ankerId: null, lage: { art: "da", fassungen: saetze as KoVersionSnapshot[] } }));
    expect(marke(fehlt, "-fehlt")).not.toBeNull();
    expect(fehlt.textContent).not.toContain("W3 Quelltext 7");
    const unbekannt = await zeichne(createElement(GespeicherteFassungAnsicht,
      { fassung: 1, ankerId: null, lage: { art: "da", fassungen: [{ ...fassungen[0],
        snapshot: { ...snapshot, sources: undefined } }] as unknown as KoVersionSnapshot[] } }));
    expect(marke(unbekannt, "-quellen-unbekannt")).not.toBeNull();
  });
});
