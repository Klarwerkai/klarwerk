// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME 20260922 · HILFE NACH FEHLGESCHLAGENER AUFFRISCHUNG EINER BEREITS BESTÄTIGTEN SITZUNG.
// ================================================================================================
//
// WAS JOB 4358 OFFEN LIESS — und warum diese Datei NEBEN `hilfe-rollenhinweise-sitzung.test.tsx`
// steht, statt sie zu erweitern:
//
//   4358 K2 lässt `/api/auth/me` schon beim ERSTEN Abruf scheitern. Eine Rolle stand dort nie fest —
//   gemessen ist also „es wird nichts erfunden". Der Betriebsfall, um den es hier geht, ist ein
//   anderer: Die Sitzung WAR bestätigt (Links und Rollenhinweise stehen), und erst die spätere
//   Auffrischung scheitert. react-query BEHÄLT dabei die zuletzt erfolgreiche Antwort in `me.data`
//   — eine Fassung, die daraus liest, zeigte die alte Rolle als aktuelle Berechtigung weiter an.
//   Die abgeschlossenen 4358-Kriterien bleiben unverändert; diese Datei misst nur den neuen Fall.
//
// DIE ZUSAGE, GEMESSEN IN VIER SCHRITTEN AN EINEM BAUM (keine Neumontage):
//   1. bestätigt   — echte Anmeldung als viewer, die Karte führt nach der Rolle der Sitzung;
//   2. ausstehend  — `useSession().refresh()` läuft, `/api/auth/me` hat noch NICHT geantwortet: das
//                    ist kein Fehler, die zuletzt bestätigte Rolle gilt weiter;
//   3. gescheitert — die Antwort kommt als 401 / 500 / Netzfehler: die Seite bleibt lesbar, führt
//                    aber weder Link noch Sperre noch Rollensatz;
//   4. erholt      — ein zweiter `refresh()` mit echter Antwort: die viewer-Führung steht wieder da.
// Der Kontrollfall durchläuft dieselben Schritte mit ECHTER Antwort in Schritt 3 und muss die
// viewer-Aussage unverändert lassen — sonst wären die Messstellen blind.
//
// ECHTER KONTEXT, keine Attrappe der Rollenquelle — dieselbe Bauform wie der 4358-Prüfstand:
//   echte Fastify-App (`buildApp`) → echte Konten → echter `AuthProvider` mit react-query → echter
//   `RoleProvider` → echte `pages/Help.tsx`. EINZIGER ERSATZ IST DER TRANSPORT: `globalThis.fetch`
//   liegt auf einer Brücke nach `app.inject`; sie kann die Antwort auf `/api/auth/me` zurückhalten
//   (Schritt 2) und für Schritt 3 durch die jeweilige Fehlerart ersetzen.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider, useSession } from "../../apps/web/src/app/AuthContext";
import { RoleProvider, useRole } from "../../apps/web/src/app/RoleContext";
import { ALL_ITEMS, ROLES, ROLE_RANK, type Role } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
import { PILOT_CHECKLIST } from "../../apps/web/src/lib/pilotChecklist";
import { Help } from "../../apps/web/src/pages/Help";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

/** Wie `/api/auth/me` sich verhalten soll — der Regelfall und die drei Fehlerarten. */
type MeLage = "echt" | 401 | 500 | "netz";

let app: ReturnType<typeof buildApp>;
let angemeldet = "";
let meLage: MeLage = "echt";
/** Wie oft `/api/auth/me` ANGEFRAGT wurde — daran hängt der Beginn des Wartens (Schritt 2). */
let meAnfragen = 0;
/** Wie oft `/api/auth/me` BEANTWORTET wurde — daran hängt das Ende jedes Schritts. */
let meAntworten = 0;
/** Solange gesetzt, hält die Brücke die Antwort auf `/api/auth/me` zurück. */
let meFreigabe: Promise<void> | null = null;
let vorherigerFetch: typeof globalThis.fetch;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function anmelden(mail: string, passwort: string): Promise<{ token: string; id: string }> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: mail, password: passwort },
  });
  const koerper = res.json() as { token: string; user: { id: string } };
  return { token: String(koerper.token), id: String(koerper.user.id) };
}

/** Erstadministrator (legt an) und Lea als Betrachterin (viewer) — beides echte Konten. */
async function konten(): Promise<void> {
  app = buildApp(buildServices());
  await app.ready();
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Chef", email: "chef@hilfe-auffrischung.test", password: "secret123" },
  });
  const chef = await anmelden("chef@hilfe-auffrischung.test", "secret123");
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${chef.token}` },
    payload: {
      name: "Lea",
      email: "lea@hilfe-auffrischung.test",
      password: "passwort12",
      role: "viewer",
    },
  });
  if (angelegt.statusCode >= 300) {
    throw new Error(`Konto Lea wurde nicht angelegt: ${angelegt.statusCode} ${angelegt.body}`);
  }
  angemeldet = (await anmelden("lea@hilfe-auffrischung.test", "passwort12")).token;
}

async function serverrolle(token: string): Promise<string> {
  const res = await app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { authorization: `Bearer ${token}` },
  });
  return String((res.json() as { role?: unknown }).role ?? "");
}

function brueckeSetzen(): void {
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    const kopf: Record<string, string> = {};
    new Headers(init?.headers as HeadersInit | undefined).forEach((wert, name) => {
      kopf[name] = wert;
    });
    kopf.authorization = `Bearer ${angemeldet}`;
    const istMe = url.endsWith("/api/auth/me");
    if (istMe) {
      meAnfragen += 1;
      if (meFreigabe) {
        await meFreigabe;
      }
    }
    if (istMe && meLage !== "echt") {
      meAntworten += 1;
      if (meLage === "netz") {
        throw new TypeError("Failed to fetch");
      }
      const koerper =
        meLage === 401
          ? { error: "UNAUTHORIZED", message: "Nicht angemeldet." }
          : { error: "INTERNAL", message: "Dienst gerade nicht erreichbar." };
      return {
        ok: false,
        status: meLage,
        statusText: String(meLage),
        text: async () => JSON.stringify(koerper),
      };
    }
    const antwort = await app.inject({
      method: methode as "GET",
      url: url.replace(/^https?:\/\/[^/]+/, ""),
      headers: kopf,
      ...(init?.body !== undefined && init?.body !== null ? { payload: String(init.body) } : {}),
    });
    if (istMe) {
      meAntworten += 1;
    }
    return {
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      status: antwort.statusCode,
      statusText: String(antwort.statusCode),
      text: async () => antwort.body,
    };
  }) as unknown as typeof globalThis.fetch;
}

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
/** Die Auffrischung der ECHTEN Sitzung — aus `useSession()`, nicht nachgebaut. */
let auffrischen: (() => void) | null = null;
/** Was der ECHTE `RoleProvider` gerade meldet — nur gelesen, nie gesetzt. */
let rollenlage: { role: Role; isSessionRole: boolean } | null = null;

function Sitzungsgriff(): null {
  auffrischen = useSession().refresh;
  return null;
}

function Rollenblick(): null {
  const { role, isSessionRole } = useRole();
  rollenlage = { role, isSessionRole };
  return null;
}

async function montieren(): Promise<void> {
  await i18n.changeLanguage("de");
  const flaeche = document.createElement("div");
  document.body.appendChild(flaeche);
  container = flaeche;
  const wurzel = createRoot(flaeche);
  root = wurzel;
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  await act(async () => {
    wurzel.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          AuthProvider,
          null,
          createElement(Sitzungsgriff),
          createElement(
            RoleProvider,
            null,
            createElement(Rollenblick),
            createElement(MemoryRouter, { initialEntries: ["/hilfe"] }, createElement(Help)),
          ),
        ),
      ),
    );
    await flush();
  });
}

/**
 * Warten, bis der Zähler über `vorher` gestiegen ist — die Obergrenze ist nur ein Notausgang gegen
 * ein Hängen; entschieden wird am Zähler, und danach wird geprüft, dass er wirklich gestiegen ist.
 */
async function bisGestiegen(zaehler: () => number, vorher: number, was: string): Promise<void> {
  for (let i = 0; i < 200 && zaehler() === vorher; i++) {
    await act(flush);
  }
  expect(zaehler(), was).toBeGreaterThan(vorher);
  // React die Antwort noch zu Ende rendern lassen.
  await act(flush);
  await act(flush);
}

async function bisAntwort(vorher: number): Promise<void> {
  await bisGestiegen(() => meAntworten, vorher, "`/api/auth/me` hat nicht geantwortet");
}

/**
 * `useSession().refresh()` auslösen und die Antwort auf `/api/auth/me` ZURÜCKHALTEN, bis sie
 * angefragt ist. Gibt die Freigabe zurück; die Antwort kommt erst nach deren Aufruf.
 */
async function auffrischenAusstehend(): Promise<() => void> {
  let freigeben: () => void = () => {};
  meFreigabe = new Promise<void>((los) => {
    freigeben = los;
  });
  const anfragenVorher = meAnfragen;
  await act(async () => {
    auffrischen?.();
    await flush();
  });
  await bisGestiegen(
    () => meAnfragen,
    anfragenVorher,
    "die Auffrischung erreichte `/api/auth/me` nicht",
  );
  return () => {
    meFreigabe = null;
    freigeben();
  };
}

/** Die zurückgehaltene Antwort freigeben und warten, bis sie angekommen ist. */
async function freigebenUndWarten(freigeben: () => void): Promise<void> {
  const vorher = meAntworten;
  freigeben();
  await bisAntwort(vorher);
}

/** `useSession().refresh()` auslösen und warten, bis `/api/auth/me` darauf geantwortet hat. */
async function auffrischenUndWarten(): Promise<void> {
  await freigebenUndWarten(await auffrischenAusstehend());
}

function abbauen(): void {
  if (root) {
    const wurzel = root;
    act(() => wurzel.unmount());
  }
  container?.remove();
  root = null;
  container = null;
  auffrischen = null;
  rollenlage = null;
}

function flaeche(): HTMLElement {
  if (!container) {
    throw new Error("Die Hilfeseite ist nicht montiert.");
  }
  return container;
}

// ------------------------------------------------------------------------------------------------
// MESSSTELLEN — am INHALT, wie in den Bestandsprüfständen; dieselbe Liste, die ein Mensch liest.
// ------------------------------------------------------------------------------------------------

function einstiegsListe(): HTMLElement {
  const anker = i18n.t(PILOT_CHECKLIST[0]?.labelKey ?? "");
  const treffer = [...flaeche().querySelectorAll("ol")].filter((liste) =>
    (liste.textContent ?? "").includes(anker),
  );
  expect(treffer, "genau EINE Einstiegsführung auf der Hilfeseite").toHaveLength(1);
  return treffer[0] as HTMLElement;
}

function mindestrolle(item: { to: string }): Role {
  const eintrag = ALL_ITEMS.find((nav) => nav.path === item.to);
  if (!eintrag) {
    throw new Error(`Route ohne Navigationseintrag: ${item.to}`);
  }
  return eintrag.minRole;
}

function offeneLinks(): string[] {
  return [...einstiegsListe().querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "");
}

function rollenhinweise(): HTMLElement[] {
  return [...einstiegsListe().querySelectorAll("li")].filter((li) =>
    ROLES.some((rolle) =>
      (li.textContent ?? "").includes(
        i18n.t("pilot.access.locked", { rolle: i18n.t(`role.name.${rolle}`) }),
      ),
    ),
  );
}

/** Was ein einzelner Schritt der Einstiegsführung zeigt: sein Link und sein Sperrhinweis. */
interface SchrittLage {
  id: string;
  link: string | null;
  hinweis: string | null;
}

function sperrtext(rolle: Role): string {
  return i18n.t("pilot.access.locked", { rolle: i18n.t(`role.name.${rolle}`) });
}

/**
 * JE SCHRITT gelesen, nicht nur gezählt (Ben, Runde 1): Ein Hinweis mit der falschen Rolle oder am
 * falschen Schritt muss auffallen. Jeder Listeneintrag wird über seinen Text dem Schritt zugeordnet;
 * gelesen wird der Sperrtext JEDER bekannten Rolle, damit auch ein falscher sichtbar wird.
 */
function schrittLagen(): SchrittLage[] {
  const eintraege = [...einstiegsListe().querySelectorAll(":scope > li")];
  expect(eintraege, "die Einstiegsführung hat nicht einen Eintrag je Schritt").toHaveLength(
    PILOT_CHECKLIST.length,
  );
  return PILOT_CHECKLIST.map((item, i) => {
    const li = eintraege[i] as HTMLElement;
    const text = li.textContent ?? "";
    expect(text, `Eintrag ${i + 1} gehört nicht zum Schritt „${item.id}"`).toContain(
      i18n.t(item.labelKey),
    );
    const hinweise = ROLES.map(sperrtext).filter((satz) => text.includes(satz));
    expect(hinweise.length, `Schritt „${item.id}": mehr als ein Sperrhinweis`).toBeLessThanOrEqual(
      1,
    );
    const links = [...li.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "");
    expect(links.length, `Schritt „${item.id}": mehr als ein Link`).toBeLessThanOrEqual(1);
    return { id: item.id, link: links[0] ?? null, hinweis: hinweise[0] ?? null };
  });
}

/** Aus der Navigation gerechnet: offen → Link auf den Weg; gesperrt → Hinweis mit der Mindestrolle. */
function erwarteteSchrittLagen(rolle: Role): SchrittLage[] {
  return PILOT_CHECKLIST.map((item) => {
    const minRole = mindestrolle(item);
    const offen = ROLE_RANK[rolle] >= ROLE_RANK[minRole];
    return {
      id: item.id,
      link: offen ? item.to : null,
      hinweis: offen ? null : sperrtext(minRole),
    };
  });
}

function wegeFuer(rolle: Role): string[] {
  return PILOT_CHECKLIST.filter((item) => ROLE_RANK[rolle] >= ROLE_RANK[mindestrolle(item)]).map(
    (item) => item.to,
  );
}

function zusammenfassung(rolle: Role): string {
  return i18n.t("pilot.access.summary", {
    rolle: i18n.t(`role.name.${rolle}`),
    offen: wegeFuer(rolle).length,
    gesamt: PILOT_CHECKLIST.length,
  });
}

function seitentext(): string {
  return (flaeche().textContent ?? "").replace(/\s+/g, " ");
}

/** Die Karte führt GENAU nach dieser Rolle — Links, Sperren und Rollensatz stimmen überein. */
function fuehrtNach(rolle: Role, lage: string): void {
  expect(rollenlage, `${lage}: der RoleProvider meldet keine Sitzungsrolle`).toEqual({
    role: rolle,
    isSessionRole: true,
  });
  expect(offeneLinks(), `${lage}: die Links folgen nicht der Rolle ${rolle}`).toEqual(
    wegeFuer(rolle),
  );
  expect(
    rollenhinweise(),
    `${lage}: die Rollenhinweise folgen nicht der Rolle ${rolle}`,
  ).toHaveLength(PILOT_CHECKLIST.length - wegeFuer(rolle).length);
  expect(
    schrittLagen(),
    `${lage}: Link oder Sperrhinweis eines Schritts folgt nicht der Rolle ${rolle}`,
  ).toEqual(erwarteteSchrittLagen(rolle));
  expect(seitentext(), `${lage}: der Rollensatz fehlt`).toContain(zusammenfassung(rolle));
  expect(seitentext(), `${lage}: der Wartesatz steht noch`).not.toContain(
    i18n.t("pilot.access.roleUnknown"),
  );
}

/** Nichts Rollengebundenes wird behauptet — weder Weg noch Sperre noch Zahl. */
function keineRollenaussage(lage: string): void {
  expect(offeneLinks(), `${lage}: es wird noch geführt`).toEqual([]);
  expect(
    rollenhinweise().map((li) => (li.textContent ?? "").trim()),
    `${lage}: es wird noch gesperrt`,
  ).toEqual([]);
  for (const rolle of ROLES) {
    expect(seitentext(), `${lage}: die Karte behauptet die Rolle ${rolle}`).not.toContain(
      zusammenfassung(rolle),
    );
  }
  expect(seitentext(), `${lage}: der ehrliche Satz fehlt`).toContain(
    i18n.t("pilot.access.roleUnknown"),
  );
}

function vollstaendigLesbar(lage: string): void {
  const text = (einstiegsListe().textContent ?? "").replace(/\s+/g, " ");
  for (const item of PILOT_CHECKLIST) {
    expect(text, `${lage}: Schritt „${item.id}" fehlt`).toContain(i18n.t(item.labelKey));
  }
  expect(seitentext(), `${lage}: die Hilfeseite ist zusammengebrochen`).toContain(
    i18n.t("pilot.access.title"),
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  localStorage.clear();
  meLage = "echt";
  meAnfragen = 0;
  meAntworten = 0;
  meFreigabe = null;
  await konten();
  brueckeSetzen();
});

afterEach(async () => {
  abbauen();
  meFreigabe = null;
  globalThis.fetch = vorherigerFetch;
  await app?.close();
  await i18n.changeLanguage("de");
});

/** Schritt 1: echte Sitzung als viewer — zugleich der Beleg, dass die Messstellen sehen. */
async function bestaetigtAlsViewer(): Promise<ReturnType<typeof createRoot> | null> {
  expect(await serverrolle(angemeldet), "der Server führt Lea nicht als viewer").toBe("viewer");
  const vorher = meAntworten;
  await montieren();
  await bisAntwort(vorher);
  vollstaendigLesbar("bestätigt");
  fuehrtNach("viewer", "bestätigt");
  expect(offeneLinks().length, "die Messstelle für Links ist blind").toBeGreaterThan(0);
  expect(rollenhinweise().length, "die Messstelle für Hinweise ist blind").toBeGreaterThan(0);
  expect(
    schrittLagen().filter((lage) => lage.hinweis !== null).length,
    "die Messstelle für Hinweise je Schritt ist blind",
  ).toBeGreaterThan(0);
  return root;
}

// ================================================================================================
// BESTÄTIGT → AUFFRISCHUNG STEHT AUS → SCHEITERT → ZWEITE AUFFRISCHUNG GELINGT.
// ================================================================================================
//
// Jede der drei Fehlerarten wird GETRENNT gemessen, jede am eigenen, einmal montierten Baum.
describe("Hilfe · Auffrischung einer bestätigten viewer-Sitzung scheitert", () => {
  for (const lage of [401, 500, "netz"] as const) {
    it(`${lage}: lesbar ohne veraltete Rollenöffnung, danach Erholung`, async () => {
      const wurzel = await bestaetigtAlsViewer();
      const lagenVorher = schrittLagen();
      const hinweiseVorher = rollenhinweise().map((li) => (li.textContent ?? "").trim());

      // 2. AUSSTEHEND — die Anfrage läuft, die Antwort fehlt noch: das ist KEIN Fehler.
      meLage = lage;
      const antwortenVorher = meAntworten;
      const freigeben = await auffrischenAusstehend();
      expect(meAntworten, "die Antwort kam, obwohl sie zurückgehalten wird").toBe(antwortenVorher);
      vollstaendigLesbar("ausstehend");
      fuehrtNach("viewer", "ausstehend");

      // 3. GESCHEITERT — die zuletzt bestätigte Rolle darf nicht weiter gelten.
      await freigebenUndWarten(freigeben);
      expect(root, "die Fläche wurde neu montiert").toBe(wurzel);
      expect(
        rollenlage?.isSessionRole,
        `${lage}: der RoleProvider hält die alte Sitzungsrolle`,
      ).toBe(false);
      vollstaendigLesbar(String(lage));
      keineRollenaussage(String(lage));

      // 4. ERHOLUNG — ein zweiter `refresh()` mit echter Serverantwort, am selben Baum.
      meLage = "echt";
      await auffrischenUndWarten();
      expect(root, "die Fläche wurde neu montiert").toBe(wurzel);
      vollstaendigLesbar("erholt");
      fuehrtNach("viewer", "erholt");
      // Die VOLLSTÄNDIGEN Hinweise (Schrittname + Sperrtext) sind wieder genau die der Ausgangslage.
      expect(schrittLagen(), "erholt: die Schritte zeigen nicht wieder die Ausgangslage").toEqual(
        lagenVorher,
      );
      expect(
        rollenhinweise().map((li) => (li.textContent ?? "").trim()),
        "erholt: die Rollenhinweise sind nicht wieder die der Ausgangslage",
      ).toEqual(hinweiseVorher);
    });
  }

  // KALIBRIERUNG — dieselben Schritte ohne Fehler: die viewer-Aussage bleibt unverändert. Fiele
  // hier die Führung weg, wären die Befunde oben wertlos (sie zeigten nur, dass jede Auffrischung
  // die Karte leert).
  it("Kontrollfall ohne Fehler: die Auffrischung lässt die viewer-Aussage unverändert", async () => {
    const wurzel = await bestaetigtAlsViewer();
    const linksVorher = offeneLinks();
    const hinweiseVorher = rollenhinweise().map((li) => (li.textContent ?? "").trim());

    const freigeben = await auffrischenAusstehend();
    fuehrtNach("viewer", "Kontrolle ausstehend");

    await freigebenUndWarten(freigeben);
    expect(root, "die Fläche wurde neu montiert").toBe(wurzel);
    vollstaendigLesbar("Kontrolle");
    fuehrtNach("viewer", "Kontrolle");
    expect(offeneLinks(), "Kontrolle: die Links haben sich verändert").toEqual(linksVorher);
    expect(
      rollenhinweise().map((li) => (li.textContent ?? "").trim()),
      "Kontrolle: die Rollenhinweise haben sich verändert",
    ).toEqual(hinweiseVorher);
  });
});
