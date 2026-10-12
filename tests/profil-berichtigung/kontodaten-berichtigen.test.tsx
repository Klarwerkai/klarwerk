// @vitest-environment jsdom
// ================================================================================================
// R-0582 (DS13) · R-1680 — EIGENE KONTODATEN MIT ERHALTENEM ÄNDERUNGSVERLAUF BERICHTIGEN.
// ================================================================================================
//
// Der Zielzustand: „Jeder kann seine Kontodaten im Profil selbst berichtigen; Verwalter koennen
// korrigieren, und Wissensobjekte behalten ihre Fassungsgeschichte." Bis zu diesem Auftrag zeigte
// das Profil Name und E-Mail nur an, und `PUT /api/users/:id` kannte allein Rolle, Freigabe,
// Passwort und Befristung — berichtigen konnte weder das Konto selbst noch ein Admin.
//
//   B1  Selbst · Name      Profil → „Kontodaten berichtigen" → Name · Server, Sitzung, Profilzeile,
//                          Prüfprotokoll (`user.account-corrected`, Name vorher/nachher, keine Adresse)
//   B2  Selbst · E-Mail    ohne/mit falschem Passwort abgelehnt (nichts geändert) · mit richtigem
//                          Passwort geändert · Anmeldung nur noch mit neuer Adresse
//   B3  Selbst · Fehler    Adresse eines anderen Kontos → Satz des Servers, nichts geändert ·
//                          Verbindungsstörung → Meldung, nichts geändert
//   B4  Admin              Nutzerkarte → „Kontodaten berichtigen" · /api/users und Anmeldung des
//                          Kontos · Prüfprotokoll mit via „admin"
//   B5  Grenzen am Draht   leerer Name/ungültige Adresse → 400 ohne Schreiben · fremdes Konto nur
//                          über den Admin-Weg (403 für Nicht-Admins) · ohne Sitzung 401
//   B6  Fassungsgeschichte die Versionen eines Wissensobjekts bleiben nach der Berichtigung seines
//                          Verfassers vollständig lesbar
//
// WAS ECHT IST: Server (`buildApp`/`buildServices`, In-Memory, eigene Instanz je Fall), Clientabruf
// (`authApi`/`endpoints`), Karten, Toasts. Ersetzt ist allein der Transport (`fetch` → `app.inject`),
// wie in `tests/verwaltung-schreibwege/karten-am-echten-server.test.tsx`.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import type { FastifyInstance } from "fastify";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { type ReactNode, act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { NutzerDetail } from "../../apps/web/src/pages/AdminKontenDetails";
import { Profile } from "../../apps/web/src/pages/Profile";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ADMIN = { name: "Ada Verwaltung", email: "ada@verwaltung.test", password: "admin-geheim-1" };
const WANDA = { name: "Wanda Wartend", email: "wanda@verwaltung.test", password: "wanda-geheim-1" };

let app: FastifyInstance | null = null;
let cookie: string | null = null;
let adminCookie = "";
let wandaCookie = "";
let wandaId = "";
let vorherigerFetch: typeof globalThis.fetch;
let stoerung: { methode: string; pfad: string } | null = null;
let gestoerteAufrufe = 0;

function drahtAufbauen(): void {
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    if (!app) {
      throw new Error(`Draht ohne App: ${methode} ${url}`);
    }
    if (stoerung && stoerung.methode === methode && url.startsWith(stoerung.pfad)) {
      stoerung = null;
      gestoerteAufrufe += 1;
      throw new TypeError("Failed to fetch (Prüfstand: Verbindung gestört)");
    }
    const kopf: Record<string, string> = {};
    new Headers(init?.headers).forEach((wert, name) => {
      kopf[name] = wert;
    });
    if (cookie) {
      kopf.cookie = cookie;
    }
    const antwort = await app.inject({
      method: methode as "GET",
      url,
      headers: kopf,
      ...(init?.body !== undefined && init.body !== null ? { payload: String(init.body) } : {}),
    });
    return {
      status: antwort.statusCode,
      statusText: String(antwort.statusCode),
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      text: async () => antwort.body,
    };
  }) as unknown as typeof globalThis.fetch;
}

async function anmelden(
  email: string,
  password: string,
): Promise<{ status: number; token: string }> {
  const r = await (app as FastifyInstance).inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  return { status: r.statusCode, token: (r.json() as { token?: string }).token ?? "" };
}

async function draht(
  methode: "GET" | "PUT" | "POST",
  url: string,
  mit: string,
  payload?: Record<string, unknown>,
): Promise<{ status: number; body: unknown }> {
  const r = await (app as FastifyInstance).inject({
    method: methode,
    url,
    headers: mit === "" ? {} : { cookie: mit },
    ...(payload ? { payload } : {}),
  });
  return { status: r.statusCode, body: r.body === "" ? null : r.json() };
}

async function ich(mit: string): Promise<{ name: string; email: string }> {
  const r = await draht("GET", "/api/auth/me", mit);
  expect(r.status, "GET /api/auth/me").toBe(200);
  return r.body as { name: string; email: string };
}

interface Eintrag {
  actor: string;
  action: string;
  target: string;
  payload?: Record<string, unknown>;
}

async function berichtigungen(): Promise<Eintrag[]> {
  const r = await draht("GET", "/api/audit", adminCookie);
  expect(r.status, "GET /api/audit").toBe(200);
  return (r.body as Eintrag[]).filter((e) => e.action === "user.account-corrected");
}

async function vorrichtung(): Promise<void> {
  app = buildApp(buildServices());
  await app.ready();
  const a = await app.inject({ method: "POST", url: "/api/auth/register", payload: ADMIN });
  expect(a.statusCode, "Admin-Ersteinrichtung").toBe(201);
  const w = await app.inject({ method: "POST", url: "/api/auth/register", payload: WANDA });
  expect(w.statusCode, "zweites Konto").toBe(201);
  wandaId = (w.json() as { id: string }).id;
  const admin = await anmelden(ADMIN.email, ADMIN.password);
  adminCookie = `kw_session=${admin.token}`;
  const frei = await draht("POST", `/api/auth/users/${wandaId}/approve`, adminCookie);
  expect(frei.status, "Vorbedingung: Wanda freigegeben").toBeLessThan(300);
  const wanda = await anmelden(WANDA.email, WANDA.password);
  expect(wanda.status).toBe(200);
  wandaCookie = `kw_session=${wanda.token}`;
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

async function montiere(inhalt: ReactNode): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root?.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(
                MemoryRouter,
                null,
                createElement(NavGuardProvider, null, inhalt, createElement(ToastViewport)),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await ruhe();
}

function knopf(teil: string): HTMLButtonElement {
  const treffer = [...container.querySelectorAll("button")].filter((b) =>
    (b.textContent ?? "").includes(teil),
  );
  if (treffer.length === 0) {
    throw new Error(`Knopf „${teil}“ fehlt — sichtbar: ${text().slice(0, 400)}`);
  }
  return treffer[0] as HTMLButtonElement;
}

async function klick(el: Element | null | undefined): Promise<void> {
  if (!(el instanceof HTMLElement)) {
    throw new Error("Bedienelement fehlt");
  }
  await act(async () => {
    el.click();
  });
  await ruhe();
}

async function tippe(feld: Element | null | undefined, wert: string): Promise<void> {
  if (!(feld instanceof HTMLInputElement)) {
    throw new Error("Eingabefeld fehlt");
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(feld, wert);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await ruhe(5);
}

/** Das Eingabefeld unter einer `Field`-Beschriftung (`<label><span>Text</span><input/></label>`). */
function feld(beschriftung: string): HTMLInputElement | null {
  const l = [...container.querySelectorAll("label")].find(
    (el) => (el.querySelector("span")?.textContent ?? "").trim() === beschriftung,
  );
  return l?.querySelector("input") ?? null;
}

const fehlerToasts = (): string[] =>
  [...container.querySelectorAll("output.bg-trust-crit-bg")].map((o) => o.textContent ?? "");
const erfolgToasts = (): string[] =>
  [...container.querySelectorAll("output.bg-trust-pos-bg")].map((o) => o.textContent ?? "");
/** Die stehende Fehlermeldung IN der Kontodatenkarte (nicht irgendwo auf der Seite). */
const alarm = (): string =>
  container.querySelector('[data-testid="detail-kontodaten"] [role="alert"]')?.textContent ?? "";

beforeAll(() => {
  drahtAufbauen();
});

afterAll(() => {
  globalThis.fetch = vorherigerFetch;
});

beforeEach(async () => {
  await i18n.changeLanguage("de");
  stoerung = null;
  gestoerteAufrufe = 0;
  await vorrichtung();
});

afterEach(async () => {
  if (root) {
    act(() => root?.unmount());
    container.remove();
    root = null;
  }
  await app?.close();
  app = null;
  cookie = null;
});

/** Wanda öffnet ihr Profil und die Karte „Kontodaten berichtigen". */
async function kontodatenKarte(): Promise<void> {
  cookie = wandaCookie;
  await montiere(createElement(Profile));
  const zeile = (): Element | null => container.querySelector('[data-testid="zeile-kontodaten"]');
  await warteBis(() => zeile() !== null, "Profilzeile „Kontodaten berichtigen“");
  // Erst öffnen, wenn die Sitzung geladen ist — die Karte belegt ihre Felder mit diesem Stand vor.
  await warteBis(
    () =>
      (container.querySelector('[data-testid="zeile-name"]')?.textContent ?? "").includes(
        WANDA.name,
      ),
    "Sitzungsnutzer geladen",
  );
  await klick(zeile());
  await warteBis(
    () => container.querySelector('[data-testid="detail-kontodaten"]') !== null,
    "Detailkarte Kontodaten",
  );
  expect(feld(t("adm.name"))?.value, "vorbelegt mit dem eigenen Namen").toBe(WANDA.name);
  expect(feld(t("adm.email"))?.value, "vorbelegt mit der eigenen Adresse").toBe(WANDA.email);
}

// ------------------------------------------------------------------------------------------------
// B1 · Name selbst berichtigen
// ------------------------------------------------------------------------------------------------
describe("B1 · Selbstberichtigung des Namens im Profil", () => {
  it("schreibt am Server, die Sitzung und die Profilzeile tragen ihn, das Protokoll hält vorher/nachher", async () => {
    await kontodatenKarte();
    expect(feld(t("prof.correctPassword")), "für den Namen kein Passwortfeld").toBeNull();
    await tippe(feld(t("adm.name")), "  Wanda Berichtigt  ");
    await klick(knopf(t("prof.correctSubmit")));
    await warteBis(() => text().includes(t("prof.correctSaved")), "Bestätigung");

    expect((await ich(wandaCookie)).name, "GET /api/auth/me nach der Berichtigung").toBe(
      "Wanda Berichtigt",
    );
    expect((await ich(wandaCookie)).email, "die Adresse ist unberührt").toBe(WANDA.email);

    // Zurück auf die Zeilenliste: die Namenszeile zeigt den berichtigten Namen ohne Neuladen.
    await klick(container.querySelector('[data-einst="zurueck"]'));
    await warteBis(
      () =>
        (container.querySelector('[data-testid="zeile-name"]')?.textContent ?? "").includes(
          "Wanda Berichtigt",
        ),
      "Profilzeile mit neuem Namen",
    );

    const eintraege = await berichtigungen();
    expect(eintraege, "genau ein Vermerk").toHaveLength(1);
    const e = eintraege[0] as Eintrag;
    expect(e.actor).toBe(wandaId);
    expect(e.target).toBe(wandaId);
    expect(e.payload).toMatchObject({
      fields: ["name"],
      via: "self",
      previousName: WANDA.name,
      targetName: "Wanda Berichtigt",
    });
    expect(JSON.stringify(e.payload), "keine Adresse im Protokoll").not.toContain("@");
  });

  it("ohne Änderung wird nichts gesendet und nichts vermerkt", async () => {
    await kontodatenKarte();
    await klick(knopf(t("prof.correctSubmit")));
    await warteBis(() => text().includes(t("prof.correctUnchanged")), "Hinweis „Nichts geändert“");
    expect(await berichtigungen()).toEqual([]);
  });
});

// ------------------------------------------------------------------------------------------------
// B2 · E-Mail selbst berichtigen — nur mit dem aktuellen Passwort
// ------------------------------------------------------------------------------------------------
describe("B2 · Selbstberichtigung der E-Mail", () => {
  const NEU = "wanda.neu@verwaltung.test";

  it("falsches Passwort: abgelehnt, nichts geändert", async () => {
    await kontodatenKarte();
    await tippe(feld(t("adm.email")), NEU);
    await warteBis(() => feld(t("prof.correctPassword")) !== null, "Passwortfeld erscheint");
    await tippe(feld(t("prof.correctPassword")), "ganz-falsch-999");
    await klick(knopf(t("prof.correctSubmit")));
    await warteBis(() => alarm() !== "", "Ablehnung");
    expect(alarm()).toContain("Aktuelles Passwort ist falsch.");
    expect((await ich(wandaCookie)).email).toBe(WANDA.email);
    expect(await berichtigungen()).toEqual([]);
  });

  it("am Draht ohne Passwort: 401, nichts geändert", async () => {
    const r = await draht("PUT", "/api/auth/me", wandaCookie, { email: NEU });
    expect(r.status).toBe(401);
    expect((await ich(wandaCookie)).email).toBe(WANDA.email);
  });

  it("richtiges Passwort: geändert — Anmeldung nur noch mit der neuen Adresse", async () => {
    await kontodatenKarte();
    await tippe(feld(t("adm.email")), NEU);
    await tippe(feld(t("prof.correctPassword")), WANDA.password);
    await klick(knopf(t("prof.correctSubmit")));
    await warteBis(() => text().includes(t("prof.correctSaved")), "Bestätigung");
    expect((await ich(wandaCookie)).email).toBe(NEU);
    expect((await anmelden(NEU, WANDA.password)).status, "neue Adresse").toBe(200);
    expect((await anmelden(WANDA.email, WANDA.password)).status, "alte Adresse").toBe(401);
    const e = (await berichtigungen())[0] as Eintrag;
    expect(e.payload).toMatchObject({ fields: ["email"], via: "self" });
    expect(JSON.stringify(e.payload), "weder alte noch neue Adresse im Protokoll").not.toContain(
      "@",
    );
  });
});

// ------------------------------------------------------------------------------------------------
// B3 · Fehlerzustände der Selbstberichtigung
// ------------------------------------------------------------------------------------------------
describe("B3 · Fehlerzustände", () => {
  it("die Adresse eines anderen Kontos: Satz des Servers, nichts geändert", async () => {
    await kontodatenKarte();
    await tippe(feld(t("adm.email")), ADMIN.email.toUpperCase());
    await tippe(feld(t("prof.correctPassword")), WANDA.password);
    await klick(knopf(t("prof.correctSubmit")));
    await warteBis(() => alarm() !== "", "Ablehnung");
    expect(alarm()).toContain("E-Mail ist bereits vergeben.");
    expect((await ich(wandaCookie)).email).toBe(WANDA.email);
    expect(await berichtigungen()).toEqual([]);
  });

  it("Verbindungsstörung beim Senden: Meldung, die Eingabe bleibt, am Server nichts geändert", async () => {
    await kontodatenKarte();
    await tippe(feld(t("adm.name")), "Wanda Gestört");
    stoerung = { methode: "PUT", pfad: "/api/auth/me" };
    await klick(knopf(t("prof.correctSubmit")));
    await warteBis(() => alarm() !== "", "Fehlermeldung");
    expect(gestoerteAufrufe, "die Störung ist wirklich eingetreten").toBe(1);
    expect(text()).not.toContain(t("prof.correctSaved"));
    expect(feld(t("adm.name"))?.value, "die Eingabe bleibt stehen").toBe("Wanda Gestört");
    expect((await ich(wandaCookie)).name).toBe(WANDA.name);
  });
});

// ------------------------------------------------------------------------------------------------
// B4 · Der Admin berichtigt ein fremdes Konto
// ------------------------------------------------------------------------------------------------
describe("B4 · Verwalterkorrektur über die Nutzerkarte", () => {
  const NEU = { name: "Wanda Korrigiert", email: "wanda.korrigiert@verwaltung.test" };

  it("schreibt Name und E-Mail, /api/users und die Anmeldung des Kontos folgen, Protokoll via admin", async () => {
    cookie = adminCookie;
    await montiere(createElement(NutzerDetail, { nutzerId: wandaId, onZurueck: () => undefined }));
    await warteBis(() => text().includes(WANDA.email), "Nutzerkarte");
    await klick(knopf(t("adm.correct")));
    expect(feld(t("adm.name"))?.value, "vorbelegt").toBe(WANDA.name);
    await tippe(feld(t("adm.name")), NEU.name);
    await tippe(feld(t("adm.email")), NEU.email);
    await klick(knopf(t("adm.correctSave")));
    await warteBis(() => erfolgToasts().length > 0, "Erfolgsmeldung");
    expect(fehlerToasts()).toEqual([]);
    await warteBis(() => text().includes(NEU.email), "die Karte zeigt die neue Adresse");

    const liste = (await draht("GET", "/api/users", adminCookie)).body as {
      id: string;
      name: string;
      email: string;
    }[];
    expect(liste.find((u) => u.id === wandaId)).toMatchObject(NEU);
    expect((await anmelden(NEU.email, WANDA.password)).status, "neue Adresse").toBe(200);
    expect((await anmelden(WANDA.email, WANDA.password)).status, "alte Adresse").toBe(401);

    const e = (await berichtigungen())[0] as Eintrag;
    expect(e.target).toBe(wandaId);
    expect(e.actor).not.toBe(wandaId);
    expect(e.payload).toMatchObject({
      fields: ["name", "email"],
      via: "admin",
      previousName: WANDA.name,
      targetName: NEU.name,
      actorName: ADMIN.name,
    });
  });

  it("Fehler: Adresse vergeben — Meldung, nichts geändert", async () => {
    cookie = adminCookie;
    await montiere(createElement(NutzerDetail, { nutzerId: wandaId, onZurueck: () => undefined }));
    await warteBis(() => text().includes(WANDA.email), "Nutzerkarte");
    await klick(knopf(t("adm.correct")));
    await tippe(feld(t("adm.email")), ADMIN.email);
    await klick(knopf(t("adm.correctSave")));
    await warteBis(() => fehlerToasts().length > 0, "Fehlermeldung");
    expect(fehlerToasts()[0]).toContain("E-Mail ist bereits vergeben.");
    expect((await ich(wandaCookie)).email).toBe(WANDA.email);
    expect(await berichtigungen()).toEqual([]);
  });
});

// ------------------------------------------------------------------------------------------------
// B5 · Grenzen am Draht
// ------------------------------------------------------------------------------------------------
describe("B5 · Formwache und Rechte", () => {
  it("leerer Name und ungültige Adresse: 400, nichts geschrieben — selbst und durch den Admin", async () => {
    for (const [url, mit] of [
      ["/api/auth/me", wandaCookie],
      [`/api/users/${wandaId}`, adminCookie],
    ] as const) {
      expect((await draht("PUT", url, mit, { name: "   " })).status, `${url} Name`).toBe(400);
      expect((await draht("PUT", url, mit, { email: "kein-at" })).status, `${url} E-Mail`).toBe(
        400,
      );
      expect((await draht("PUT", url, mit, { name: 42 })).status, `${url} Typ`).toBe(400);
    }
    expect(await ich(wandaCookie)).toMatchObject({ name: WANDA.name, email: WANDA.email });
    expect(await berichtigungen()).toEqual([]);
  });

  it("ein fremdes Konto berichtigt nur der Admin; ohne Sitzung 401", async () => {
    const adminId = ((await ich(adminCookie)) as unknown as { id: string }).id;
    const fremd = await draht("PUT", `/api/users/${adminId}`, wandaCookie, { name: "Übernahme" });
    expect(fremd.status, "Nicht-Admin an fremdem Konto").toBe(403);
    expect((await ich(adminCookie)).name).toBe(ADMIN.name);
    expect((await draht("PUT", "/api/auth/me", "", { name: "Niemand" })).status).toBe(401);
  });
});

// ------------------------------------------------------------------------------------------------
// B6 · Wissensobjekte behalten ihre Fassungsgeschichte
// ------------------------------------------------------------------------------------------------
describe("B6 · Fassungsgeschichte bleibt bei der Berichtigung erhalten", () => {
  it("zwei Fassungen vor der Berichtigung des Verfassers — dieselben zwei danach", async () => {
    const angelegt = await draht("POST", "/api/kos", adminCookie, {
      confidentiality: "intern",
      title: "Ventil X schließt bei Überdruck",
      statement: "Bei Überdruck Ventil X manuell schließen.",
      type: "best_practice",
      category: "Anlage 1",
    });
    expect(angelegt.status).toBe(201);
    const id = (angelegt.body as { id: string }).id;
    const revidiert = await draht("PUT", `/api/kos/${id}`, adminCookie, {
      action: "revise",
      changes: { statement: "Bei Überdruck Ventil X ZUERST entlasten, dann schließen." },
    });
    expect(revidiert.status).toBe(200);

    const fassungen = async (): Promise<{ version: number; statement?: string }[]> => {
      const r = await draht("GET", `/api/kos/${id}/versions`, adminCookie);
      expect(r.status).toBe(200);
      return (r.body as { version: number; statement?: string }[]).sort(
        (a, b) => a.version - b.version,
      );
    };
    const vorher = await fassungen();
    expect(vorher.map((v) => v.version)).toEqual([1, 2]);

    const korrektur = await draht("PUT", "/api/auth/me", adminCookie, { name: "Ada Neu" });
    expect(korrektur.status).toBe(200);
    expect(await fassungen(), "die Historie ist unverändert lesbar").toEqual(vorher);
  });
});
