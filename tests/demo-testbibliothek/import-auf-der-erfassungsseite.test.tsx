// @vitest-environment jsdom
// ================================================================================================
// gesamt-nutzerverwaltung · FRAGE 6 — DER IMPORT DES FACHKONTOS ÜBER DIE OBERFLÄCHE.
// ================================================================================================
//
// Bens Befund (Nacharbeit 7): Der Server erlaubte dem Demo-Arbeitskonto den Import aus seiner
// Testbibliothek, die Oberfläche bot ihn aber nirgends an — `/import` ist Admin und Stufe 2. Jetzt
// hängt derselbe SharePoint-Bereich auf der Erfassungsseite (`pages/Capture.tsx`, unter dem
// Dateiimport) im Modus `nurTestbibliothek`. Diese Datei bedient ihn so, wie das Konto es tut:
//
//   T1  Das zugeordnete Fachkonto sieht den Bereich mit eigenem Titel, NUR die Datei seiner
//       Testbibliothek, kreuzt sie an, die Messung läuft, „Importieren" geht — und am Server steht
//       danach genau dieser Kandidat in der Prüfung. Jeder Graph-Abruf ging an seine Bibliothek.
//   T2  Ein Fachkonto OHNE Zuordnung sieht nichts, und die Fläche fragt die Dateiliste gar nicht an.
//   T3  Der Admin sieht auf der Erfassungsseite nichts — sein Weg ist die Verwaltung.
//   T4  Verdrahtung: `Capture.tsx` hängt den Bereich mit `nurTestbibliothek` ein, und `/import`
//       bleibt unverändert Admin und Stufe 2 (keine Adminfläche geöffnet).
//
// WAS ECHT IST: Server (`buildApp`/`buildServices`), Clientabruf (`api/client.ts`), Fläche, Rollen.
// Ersetzt ist der Transport: `fetch` liegt auf `app.inject` (die Bahn-Sandbox lässt keinen
// Horchsocket zu) — und Microsoft Graph ist ein Vertragsdouble mit zwei getrennten Laufwerken. Pedis
// Grenze gilt: simulierte Office-Tests ersetzen keine echte Microsoft-365-Abnahme.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import type { FastifyInstance } from "fastify";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { Fragment, type ReactNode, act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider, useSession } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { SharePointImportBereich } from "../../apps/web/src/components/sharepoint-import/SharePointImportBereich";
import i18n from "../../apps/web/src/i18n";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const WURZEL = join(__dirname, "..", "..");
const GRAPH = "https://graph.microsoft.test/v1.0";
const INSTANZ = "b!instanzbibliothek";
const TESTBIBLIOTHEK = "b!demo-testbibliothek";
const ZUORDNUNG = "KLARWERK_SHAREPOINT_TESTBIBLIOTHEKEN";

const VORHER: Record<string, string | undefined> = {};
const SETZEN: Record<string, string> = {
  KLARWERK_SHAREPOINT_IMPORT: "1",
  KLARWERK_SHAREPOINT_BASE_URL: GRAPH,
  KLARWERK_SHAREPOINT_TOKEN: "vertragsdouble-nur-fuer-den-test",
  KLARWERK_SHAREPOINT_DRIVE: INSTANZ,
};
for (const [name, wert] of Object.entries(SETZEN)) {
  VORHER[name] = process.env[name];
  process.env[name] = wert;
}
VORHER[ZUORDNUNG] = process.env[ZUORDNUNG];
delete process.env[ZUORDNUNG];

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DEMO_DATEI = {
  id: "01DEMOPUMPE",
  name: "Pumpenwartung-Demo.docx",
  webUrl: "https://contoso.sharepoint.test/sites/demo/Testbibliothek/Pumpenwartung-Demo.docx",
  lastModifiedDateTime: "2026-10-10T09:00:00Z",
  size: 18_432,
  file: { mimeType: DOCX },
};
const INSTANZ_DATEI = {
  id: "01INSTANZVERTRAG",
  name: "Kundenvertrag-intern.docx",
  webUrl: "https://contoso.sharepoint.test/sites/technik/Freigegeben/Kundenvertrag-intern.docx",
  lastModifiedDateTime: "2026-10-01T12:00:00Z",
  size: 40_960,
  file: { mimeType: DOCX },
};
const LAUFWERKE: Record<string, (typeof DEMO_DATEI)[]> = {
  [INSTANZ]: [INSTANZ_DATEI],
  [TESTBIBLIOTHEK]: [DEMO_DATEI],
};
const NICHT_DA = { error: { code: "itemNotFound" } };

const ADMIN = {
  name: "Ada Verwaltung",
  email: "ada@testbibliothek.test",
  password: "admin-geheim-1",
};
const DEMO = {
  name: "Demo Fachkonto",
  email: "demo@testbibliothek.test",
  password: "demo-geheim-1",
};

let app: FastifyInstance | null = null;
/** Die Sitzung, mit der die gemountete Fläche spricht. */
let cookie: string | null = null;
let adminCookie = "";
let demoCookie = "";
let demoId = "";
let vorherigerFetch: typeof globalThis.fetch;
const graphAufrufe: string[] = [];
const flaechenAufrufe: string[] = [];

function graphAntwort(body: unknown, status = 200): Response {
  const ok = status >= 200 && status < 300;
  const headers = { get: () => null };
  return { ok, status, headers, json: async () => body } as unknown as Response;
}

/** Microsoft Graph als Vertragsdouble: zwei Laufwerke, jedes kennt nur seine eigenen Dateien. */
function graph(url: string): Response {
  graphAufrufe.push(url);
  const laufwerk = decodeURIComponent(url.slice(`${GRAPH}/drives/`.length).split("/")[0] ?? "");
  const dateien = LAUFWERKE[laufwerk];
  if (!dateien) {
    return graphAntwort(NICHT_DA, 404);
  }
  if (url.includes("/root/children")) {
    return graphAntwort({ value: dateien });
  }
  const treffer = dateien.find((d) => url.includes(`/items/${d.id}`));
  return treffer ? graphAntwort(treffer) : graphAntwort(NICHT_DA, 404);
}

function drahtAufbauen(): void {
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    if (url.startsWith(`${GRAPH}/drives/`)) {
      return graph(url);
    }
    if (!app) {
      throw new Error(`Draht ohne App: ${url}`);
    }
    const methode = (init?.method ?? "GET").toUpperCase();
    flaechenAufrufe.push(`${methode} ${url}`);
    const kopf: Record<string, string> = {};
    new Headers(init?.headers).forEach((wert, name) => {
      kopf[name] = wert;
    });
    if (cookie) {
      kopf.cookie = cookie;
    }
    const rumpf = init?.body !== undefined && init.body !== null ? String(init.body) : undefined;
    const antwort = await app.inject({
      method: methode as "GET",
      url,
      headers: kopf,
      ...(rumpf !== undefined ? { payload: rumpf } : {}),
    });
    return {
      status: antwort.statusCode,
      statusText: String(antwort.statusCode),
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      text: async () => antwort.body,
    };
  }) as unknown as typeof globalThis.fetch;
}

async function anmelden(email: string, password: string): Promise<string> {
  const r = await (app as FastifyInstance).inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  expect(r.statusCode, `Anmeldung ${email}`).toBe(200);
  return `kw_session=${(r.json() as { token: string }).token}`;
}

async function vorrichtung(): Promise<void> {
  app = buildApp(buildServices());
  await app.ready();
  const a = await app.inject({ method: "POST", url: "/api/auth/register", payload: ADMIN });
  expect(a.statusCode, "Admin-Ersteinrichtung").toBe(201);
  adminCookie = await anmelden(ADMIN.email, ADMIN.password);
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { cookie: adminCookie },
    payload: { ...DEMO, role: "experte" },
  });
  expect(angelegt.statusCode, "Demokonto als experte").toBe(201);
  demoId = (angelegt.json() as { id: string }).id;
  demoCookie = await anmelden(DEMO.email, DEMO.password);
}

// ------------------------------------------------------------------------------------------------
// Fläche
// ------------------------------------------------------------------------------------------------
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

async function ruhe(runden = 30): Promise<void> {
  for (let i = 0; i < runden; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

const text = (): string => (container?.textContent ?? "").replace(/\s+/g, " ");
const t = (key: string): string => i18n.t(key);
const per = <T extends Element>(testId: string): T | null =>
  container.querySelector<T>(`[data-testid="${testId}"]`);

async function warteBis(bedingung: () => boolean, was: string): Promise<void> {
  for (let i = 0; i < 300; i++) {
    if (bedingung()) {
      return;
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
  }
  throw new Error(`Zustand nie erreicht: ${was} — sichtbar: ${text().slice(0, 400)}`);
}

// App.tsx montiert geschützte Inhalte erst nach der Sitzungsabfrage. Ohne diese Grenze würde
// der Test vor /auth/me mit der vorläufigen Preview-Rolle "experte" auch als Admin anfragen.
function BeiBestaetigterSitzung({ children }: { children: ReactNode }): JSX.Element | null {
  const sitzung = useSession();
  if (sitzung.isLoading || sitzung.signOutFailed || !sitzung.user) {
    return null;
  }
  return createElement(Fragment, null, children);
}

async function montiere(inhalt: ReactNode): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const angemeldet = createElement(BeiBestaetigterSitzung, null, inhalt);
  const router = createElement(
    MemoryRouter,
    null,
    createElement(NavGuardProvider, null, angemeldet),
  );
  const toast = createElement(ToastProvider, null, router);
  const rolle = createElement(RoleProvider, null, toast);
  const auth = createElement(AuthProvider, null, rolle);
  await act(async () => {
    root?.render(createElement(QueryClientProvider, { client: qc }, auth));
  });
  await ruhe();
}

const erfassungsbereich = (): ReactNode =>
  createElement<{ nurTestbibliothek?: boolean }>(SharePointImportBereich, {
    nurTestbibliothek: true,
  });

async function klick(el: Element | null): Promise<void> {
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Bedienelement fehlt — sichtbar: ${text().slice(0, 400)}`);
  }
  await act(async () => {
    el.click();
  });
  await ruhe();
}

beforeAll(() => {
  drahtAufbauen();
});

afterAll(() => {
  globalThis.fetch = vorherigerFetch;
  for (const [name, wert] of Object.entries(VORHER)) {
    if (wert === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = wert;
    }
  }
});

beforeEach(async () => {
  await i18n.changeLanguage("de");
  graphAufrufe.length = 0;
  flaechenAufrufe.length = 0;
  await vorrichtung();
});

afterEach(async () => {
  if (root) {
    act(() => root?.unmount());
    container.remove();
    root = null;
  }
  delete process.env[ZUORDNUNG];
  await app?.close();
  app = null;
  cookie = null;
});

describe("Frage 6 · der Import aus der eigenen Testbibliothek auf der Erfassungsseite", () => {
  it("T1 · das zugeordnete Fachkonto wählt, misst und importiert — nur aus seiner Bibliothek", async () => {
    process.env[ZUORDNUNG] = `${demoId}=${TESTBIBLIOTHEK}`;
    cookie = demoCookie;
    await montiere(erfassungsbereich());

    await warteBis(() => per("sharepoint-testbibliothek") !== null, "Bereich der Testbibliothek");
    expect(text()).toContain(t("testbibliothek.titel"));
    expect(text()).toContain(t("testbibliothek.hinweis"));
    const dateiBox = `sharepoint-datei-${DEMO_DATEI.id}`;
    await warteBis(() => per(dateiBox) !== null, "Datei der Testbibliothek");
    expect(text()).toContain("Pumpenwartung-Demo.docx");
    expect(text(), "keine Datei der Instanzbibliothek").not.toContain("Kundenvertrag-intern");
    expect(per(`sharepoint-datei-${INSTANZ_DATEI.id}`)).toBeNull();
    // Keine Verwaltungsfläche auf der Erfassungsseite: weder Zugangskarte noch ihre Auskunft.
    expect(flaechenAufrufe.some((a) => a.includes("/import/sharepoint/zugang"))).toBe(false);

    await klick(per(dateiBox));
    const knopf = (): HTMLButtonElement | null => per<HTMLButtonElement>("sharepoint-uebernehmen");
    await warteBis(() => knopf()?.disabled === false, "Messung fertig, Import freigegeben");
    await klick(knopf());
    await warteBis(() => per("sharepoint-ergebnis") !== null, "Ergebnisbild");
    expect(per("sharepoint-uebernahmefehler")).toBeNull();

    // Am Server: genau dieser Kandidat wartet in der Prüfung, gelesen mit Adminrechten.
    const r = await (app as FastifyInstance).inject({
      method: "GET",
      url: "/api/library/import/candidates",
      headers: { cookie: adminCookie },
    });
    const kandidaten = r.json() as { item: { externalId?: string } }[];
    const ids = kandidaten.map((k) => k.item.externalId);
    expect(ids).toContain(DEMO_DATEI.id);
    expect(ids).not.toContain(INSTANZ_DATEI.id);

    const eigenesLaufwerk = `${GRAPH}/drives/${TESTBIBLIOTHEK}/`;
    expect(graphAufrufe.length).toBeGreaterThan(0);
    const daneben = graphAufrufe.filter((u) => !u.startsWith(eigenesLaufwerk));
    expect(daneben, "jeder Graph-Abruf ging an die Testbibliothek").toEqual([]);
  });

  it("T2 · ein Fachkonto OHNE Zuordnung sieht nichts — und die Dateiliste wird nicht angefragt", async () => {
    cookie = demoCookie;
    await montiere(erfassungsbereich());
    await warteBis(
      () => flaechenAufrufe.some((a) => a.includes("/import/sharepoint/testbibliothek")),
      "Auskunft über die eigene Testbibliothek",
    );
    await ruhe();

    expect(per("sharepoint-testbibliothek")).toBeNull();
    expect(text()).not.toContain(t("testbibliothek.titel"));
    const liste = flaechenAufrufe.filter((a) => a.includes("/admin/import/sharepoint/"));
    expect(liste, "kein Abruf der Dateiliste ohne Zuordnung").toEqual([]);
    expect(graphAufrufe).toEqual([]);
  });

  it("T3 · der Admin sieht auf der Erfassungsseite nichts — sein Weg ist die Verwaltung", async () => {
    cookie = adminCookie;
    await montiere(erfassungsbereich());
    await ruhe(60);

    expect(per("sharepoint-testbibliothek")).toBeNull();
    expect(per("sharepoint-verwaltung")).toBeNull();
    const sharepoint = flaechenAufrufe.filter((a) => a.includes("/sharepoint/"));
    expect(sharepoint, "die Erfassungsseite fragt für den Admin nichts an").toEqual([]);
  });

  it("T4 · Verdrahtung: Erfassen hängt den Bereich ein, /import bleibt Admin und Stufe 2", () => {
    const erfassen = readFileSync(join(WURZEL, "apps/web/src/pages/Capture.tsx"), "utf8");
    expect(erfassen).toContain("<SharePointImportBereich nurTestbibliothek />");
    const navigation = readFileSync(join(WURZEL, "apps/web/src/app/navigation.ts"), "utf8");
    const importEintrag = /path: "\/import",[\s\S]*?minRole: "(\w+)",[\s\S]*?stufe2: (\w+)/.exec(
      navigation,
    );
    expect(importEintrag?.[1], "/import bleibt Admin").toBe("admin");
    expect(importEintrag?.[2], "/import bleibt Stufe 2").toBe("true");
  });
});
