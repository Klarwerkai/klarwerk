// @vitest-environment jsdom
// ================================================================================================
// R-1563 / R-1581 (BEN, Nacharbeit 5) — DIE SCHREIBENDEN VERWALTUNGSWEGE, ÜBER DIE ECHTEN KARTEN.
// ================================================================================================
//
// Bis hierher waren die Verwaltungskarten nur LESEND belegt (Öffnen, Zustände, Hülle). Diese Datei
// fährt jeden schreibenden Weg so, wie ein Admin ihn bedient — Knopf, Feld, Auswahl in der echten
// Karte — und liest danach am Server nach, was wirklich gilt. Je Weg: schreiben, erneut lesen,
// Fehlerfall (der Server lehnt ab oder die Verbindung bricht) mit unverändertem Stand, Rücknahme.
//
//   W1  Freigabekette     eigenes wartendes Konto · Login abgewiesen (NOT_APPROVED) · „Freigeben"
//                         in der Nutzerkarte · Login gelingt · /api/users sagt approved
//   W2  Rollenänderung    Auswahl in der Nutzerkarte · /api/users und /api/auth/me des Kontos ·
//                         Rücknahme · Fehler: Selbst-Herabstufung des letzten Admins wird abgelehnt
//   W3  Passwort-Reset    Admin setzt in der Nutzerkarte · altes Passwort tot, neues gilt ·
//                         Fehler: Störung beim Senden lässt das alte Passwort gelten
//   W4  Selbstbedienung   Profil → Passwort ändern mit eigenem Konto · falsches altes Passwort wird
//                         abgelehnt (nichts geändert) · richtiges ändert es
//   W5  Grenzen           Upload-Grenzen schreiben/lesen/zurücknehmen · Fehler: Wert außerhalb des
//                         Bandes lehnt der Server ab
//   W6  Externe Abfrage   Stufe schreiben/lesen/zurücknehmen · Fehler: Störung beim Speichern
//   W7  Duplikat-Schwelle schreiben/lesen/zurücknehmen · Fehler: Wert außerhalb des Bandes
//
// Die KI-Konfiguration (Anbieter-/Modellwahl je Aufgabe) ist hier BEWUSST nicht noch einmal gebaut:
// sie hat ihren eigenen Durchstich am echten Server samt Fehler- und Rücknahmefällen
// (`tests/admin-ki-oberflaeche/freigabe-durchstich.test.tsx`, `tests/admin-ki-freigabe-gegenproben/`).
//
// WAS ECHT IST: Server (`buildApp`/`buildServices`, In-Memory, eigene Instanz je Fall — keine
// fremden Konten, kein Vorführbestand), Clientabruf (`endpoints`/`api/client.ts`), Karten, Toasts.
// Ersetzt ist allein der Transport: `fetch` liegt auf `app.inject` (die Bahn-Sandbox lässt keinen
// Horchsocket zu). Die eine Störung (W3, W6) ist ein ausdrücklich geschalteter Verbindungsfehler
// dieses Transports — er erreicht den Server NICHT, und genau das wird hinterher nachgelesen.
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
import {
  KiDupDetail,
  KiExternDetail,
  KiGrenzenDetail,
} from "../../apps/web/src/pages/AdminKiDetails";
import { NutzerDetail } from "../../apps/web/src/pages/AdminKontenDetails";
import { Profile } from "../../apps/web/src/pages/Profile";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ADMIN = { name: "Ada Verwaltung", email: "ada@verwaltung.test", password: "admin-geheim-1" };
const WANDA = { name: "Wanda Wartend", email: "wanda@verwaltung.test", password: "wanda-geheim-1" };

let app: FastifyInstance | null = null;
/** Die Sitzung, mit der die gemountete Fläche spricht (Admin oder Wanda). */
let cookie: string | null = null;
let adminCookie = "";
let wandaId = "";
let adminId = "";
let vorherigerFetch: typeof globalThis.fetch;

/** Eine einmalige, ausdrücklich geschaltete Verbindungsstörung für genau EINEN Aufruf. */
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
      // Der Server sieht diesen Aufruf nie — die Karte bekommt eine echte Fehlantwort.
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

interface Anmeldung {
  status: number;
  body: { token?: string; error?: string };
}

async function anmelden(email: string, password: string): Promise<Anmeldung> {
  const r = await (app as FastifyInstance).inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  return { status: r.statusCode, body: r.json() as Anmeldung["body"] };
}

async function lies<T>(pfad: string, mit = adminCookie): Promise<T> {
  const r = await (app as FastifyInstance).inject({
    method: "GET",
    url: pfad,
    headers: { cookie: mit },
  });
  expect(r.statusCode, `GET ${pfad}`).toBe(200);
  return r.json() as T;
}

interface Grenzen {
  maxAttachments: number;
  maxAttachmentBytes: number;
}

async function nutzer(id: string): Promise<{ role: string; approved: boolean }> {
  const liste = await lies<{ id: string; role: string; approved: boolean }[]>("/api/users");
  const u = liste.find((x) => x.id === id);
  if (!u) {
    throw new Error(`Konto ${id} fehlt in /api/users`);
  }
  return u;
}

async function vorrichtung(): Promise<void> {
  app = buildApp(buildServices());
  await app.ready();
  // Erstes Konto = Admin (Ersteinrichtung), zweites = wartendes Konto (Selbstregistrierung).
  const a = await app.inject({ method: "POST", url: "/api/auth/register", payload: ADMIN });
  expect(a.statusCode, "Admin-Ersteinrichtung").toBe(201);
  adminId = (a.json() as { id: string }).id;
  const w = await app.inject({ method: "POST", url: "/api/auth/register", payload: WANDA });
  expect(w.statusCode, "wartendes Testkonto").toBe(201);
  wandaId = (w.json() as { id: string; approved: boolean }).id;
  expect((w.json() as { approved: boolean }).approved, "das Testkonto wartet").toBe(false);
  const login = await anmelden(ADMIN.email, ADMIN.password);
  expect(login.status).toBe(200);
  adminCookie = `kw_session=${login.body.token ?? ""}`;
  cookie = adminCookie;
}

async function freigebenPerDraht(): Promise<void> {
  const r = await (app as FastifyInstance).inject({
    method: "POST",
    url: `/api/auth/users/${wandaId}/approve`,
    headers: { cookie: adminCookie },
  });
  expect(r.statusCode, "Vorbedingung: Wanda freigegeben").toBeLessThan(300);
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

const text = (): string => (container?.textContent ?? "").replace(/\s+/g, " ");
const t = (key: string): string => i18n.t(key);
const ohneZurueck = (): void => undefined;

/** Die Fehlermeldungen im Toast-Sichtfenster (rot), nicht die Karte selbst. */
const fehlerToasts = (): string[] =>
  [...container.querySelectorAll("output.bg-trust-crit-bg")].map((o) => o.textContent ?? "");
const erfolgToasts = (): string[] =>
  [...container.querySelectorAll("output.bg-trust-pos-bg")].map((o) => o.textContent ?? "");

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

async function waehle(auswahl: Element | null | undefined, wert: string): Promise<void> {
  if (!(auswahl instanceof HTMLSelectElement)) {
    throw new Error("Auswahlfeld fehlt");
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(auswahl, wert);
    auswahl.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await ruhe();
}

/** Das Eingabefeld unter einer `Field`-Beschriftung (`<label><span>Text</span><input/></label>`). */
function feld(beschriftung: string): HTMLInputElement | null {
  const l = [...container.querySelectorAll("label")].find(
    (el) => (el.querySelector("span")?.textContent ?? "").trim() === beschriftung,
  );
  return l?.querySelector("input") ?? null;
}

const nachAria = (name: string): HTMLInputElement | null =>
  container.querySelector<HTMLInputElement>(`input[aria-label="${name}"]`);

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

// ------------------------------------------------------------------------------------------------
// W1 · Freigabekette
// ------------------------------------------------------------------------------------------------
describe("W1 · Freigabe eines wartenden Kontos über die echte Nutzerkarte", () => {
  it("vorher abgewiesen, „Freigeben“ in der Karte, danach Login möglich", async () => {
    const vorher = await anmelden(WANDA.email, WANDA.password);
    expect(vorher.status, "das wartende Konto kommt vorher nicht hinein").toBe(403);
    expect(vorher.body.error).toBe("NOT_APPROVED");

    await montiere(createElement(NutzerDetail, { nutzerId: wandaId, onZurueck: ohneZurueck }));
    await warteBis(() => text().includes(WANDA.email), "Nutzerkarte mit Wandas Konto");
    expect(container.querySelector("select"), "vor der Freigabe keine Rollenwahl").toBeNull();
    await klick(knopf(t("adm.approve")));
    await warteBis(() => container.querySelector("select") !== null, "Karte zeigt freigegeben");

    expect((await nutzer(wandaId)).approved, "/api/users nach der Freigabe").toBe(true);
    const nachher = await anmelden(WANDA.email, WANDA.password);
    expect(nachher.status, "nach der Freigabe kommt das Konto hinein").toBe(200);
  });
});

// ------------------------------------------------------------------------------------------------
// W2 · Rollenänderung
// ------------------------------------------------------------------------------------------------
describe("W2 · Rollenänderung über die Nutzerkarte", () => {
  it("schreiben, am Server und in der Sitzung des Kontos lesen, zurücknehmen", async () => {
    await freigebenPerDraht();
    await montiere(createElement(NutzerDetail, { nutzerId: wandaId, onZurueck: ohneZurueck }));
    await warteBis(() => container.querySelector("select") !== null, "Rollenwahl");

    await waehle(container.querySelector("select"), "controller");
    expect((await nutzer(wandaId)).role, "/api/users nach der Änderung").toBe("controller");
    const login = await anmelden(WANDA.email, WANDA.password);
    const sitzungWanda = `kw_session=${login.body.token ?? ""}`;
    const ich = await lies<{ role: string }>("/api/auth/me", sitzungWanda);
    expect(ich.role, "die Sitzung des Kontos trägt die neue Rolle").toBe("controller");

    await waehle(container.querySelector("select"), "experte");
    expect((await nutzer(wandaId)).role, "Rücknahme").toBe("experte");
    expect(fehlerToasts(), "kein Fehler auf dem gelungenen Weg").toEqual([]);
  });

  it("Fehler: der letzte Admin kann sich nicht selbst herabstufen — Meldung, Stand unverändert", async () => {
    await montiere(createElement(NutzerDetail, { nutzerId: adminId, onZurueck: ohneZurueck }));
    await warteBis(() => container.querySelector("select") !== null, "eigene Rollenwahl");
    await waehle(container.querySelector("select"), "experte");
    await warteBis(() => fehlerToasts().length > 0, "Fehlermeldung des Servers");
    expect(fehlerToasts()[0]?.trim().length ?? 0).toBeGreaterThan(0);
    expect((await nutzer(adminId)).role, "der Server hat nichts geändert").toBe("admin");
    expect((container.querySelector("select") as HTMLSelectElement).value).toBe("admin");
  });
});

// ------------------------------------------------------------------------------------------------
// W3 · Passwort-Reset durch den Admin
// ------------------------------------------------------------------------------------------------
describe("W3 · Passwort-Reset über die Nutzerkarte", () => {
  const NEU = "wanda-neu-12345";

  async function resetFormular(): Promise<void> {
    await montiere(createElement(NutzerDetail, { nutzerId: wandaId, onZurueck: ohneZurueck }));
    await warteBis(() => container.querySelector("select") !== null, "Nutzerkarte");
    await klick(knopf(t("adm.reset")));
    await tippe(container.querySelector(`input[placeholder="${t("adm.newPassword")}"]`), NEU);
    await tippe(container.querySelector(`input[placeholder="${t("adm.newPasswordRepeat")}"]`), NEU);
  }

  it("setzt das Passwort: das alte gilt nicht mehr, das neue schon", async () => {
    await freigebenPerDraht();
    await resetFormular();
    await klick(knopf(t("adm.resetConfirm")));
    await warteBis(() => erfolgToasts().length > 0, "Erfolgsmeldung");
    expect((await anmelden(WANDA.email, WANDA.password)).status, "altes Passwort").toBe(401);
    expect((await anmelden(WANDA.email, NEU)).status, "neues Passwort").toBe(200);
  });

  it("Fehler: bricht die Verbindung beim Senden, meldet die Karte es — und das alte Passwort gilt", async () => {
    await freigebenPerDraht();
    await resetFormular();
    stoerung = { methode: "POST", pfad: `/api/auth/users/${wandaId}/reset` };
    await klick(knopf(t("adm.resetConfirm")));
    await warteBis(() => fehlerToasts().length > 0, "Fehlermeldung");
    expect(gestoerteAufrufe, "die Störung ist wirklich eingetreten").toBe(1);
    expect((await anmelden(WANDA.email, WANDA.password)).status, "altes Passwort").toBe(200);
    expect((await anmelden(WANDA.email, NEU)).status, "neues Passwort gilt nicht").toBe(401);
  });

  it("Fehler: abweichende Wiederholung sendet nichts", async () => {
    await freigebenPerDraht();
    await resetFormular();
    await tippe(
      container.querySelector(`input[placeholder="${t("adm.newPasswordRepeat")}"]`),
      `${NEU}x`,
    );
    expect(knopf(t("adm.resetConfirm")).disabled, "Bestätigen ist gesperrt").toBe(true);
    expect(text()).toContain(t("adm.passwordMismatch"));
    expect((await anmelden(WANDA.email, WANDA.password)).status, "altes Passwort").toBe(200);
  });
});

// ------------------------------------------------------------------------------------------------
// W4 · Selbstbedienungs-Passwortänderung
// ------------------------------------------------------------------------------------------------
describe("W4 · Selbstbedienung: das eigene Passwort im Profil ändern", () => {
  const NEU = "wanda-selbst-123";

  async function profilFormular(altes: string): Promise<void> {
    await freigebenPerDraht();
    const login = await anmelden(WANDA.email, WANDA.password);
    cookie = `kw_session=${login.body.token ?? ""}`;
    await montiere(createElement(Profile));
    const zeile = (): Element | null => container.querySelector('[data-testid="zeile-passwort"]');
    await warteBis(() => zeile() !== null, "Profil");
    await klick(zeile());
    await tippe(feld(t("prof.oldPassword")), altes);
    await tippe(feld(t("prof.newPassword")), NEU);
    await klick(knopf(t("prof.passwordSubmit")));
  }

  it("Fehler: falsches altes Passwort wird abgelehnt — nichts geändert", async () => {
    await profilFormular("ganz-falsch-999");
    await warteBis(() => container.querySelector(".bg-trust-crit-bg") !== null, "Ablehnung");
    expect(text()).not.toContain(t("prof.passwordChanged"));
    expect((await anmelden(WANDA.email, WANDA.password)).status, "altes Passwort").toBe(200);
    expect((await anmelden(WANDA.email, NEU)).status, "neues Passwort gilt nicht").toBe(401);
  });

  it("richtiges altes Passwort: geändert, das neue gilt, das alte nicht", async () => {
    await profilFormular(WANDA.password);
    await warteBis(() => text().includes(t("prof.passwordChanged")), "Bestätigung");
    expect((await anmelden(WANDA.email, NEU)).status, "neues Passwort").toBe(200);
    expect((await anmelden(WANDA.email, WANDA.password)).status, "altes Passwort").toBe(401);
  });
});

// ------------------------------------------------------------------------------------------------
// W5 · Upload-Grenzen
// ------------------------------------------------------------------------------------------------
describe("W5 · Grenzen über die Karte „Grenzen“", () => {
  async function karte(): Promise<void> {
    await montiere(createElement(KiGrenzenDetail, { onZurueck: ohneZurueck }));
    await warteBis(() => nachAria(t("adm.upload.maxAttachments")) !== null, "Grenzen-Karte");
  }

  const grenzen = (): Promise<Grenzen> => lies<Grenzen>("/api/upload-limits");
  const anzahlFeld = (): HTMLInputElement | null => nachAria(t("adm.upload.maxAttachments"));

  it("schreiben, erneut lesen, zurücknehmen", async () => {
    const vorher = await grenzen();
    await karte();
    await tippe(anzahlFeld(), "12");
    await klick(knopf(t("adm.upload.save")));
    await warteBis(() => erfolgToasts().length > 0, "gespeichert");
    expect((await grenzen()).maxAttachments, "gelesen").toBe(12);
    await warteBis(() => anzahlFeld()?.value === "12", "die Karte zeigt den neuen Stand");

    await tippe(anzahlFeld(), String(vorher.maxAttachments));
    await klick(knopf(t("adm.upload.save")));
    await warteBis(() => erfolgToasts().length > 1, "Rücknahme gespeichert");
    expect(await grenzen(), "Rücknahme").toEqual(vorher);
  });

  it("Fehler: ein Wert außerhalb des Bandes wird vom Server abgelehnt — Stand unverändert", async () => {
    const vorher = await grenzen();
    await karte();
    await tippe(anzahlFeld(), "99");
    await klick(knopf(t("adm.upload.save")));
    await warteBis(() => fehlerToasts().length > 0, "Ablehnung");
    expect(await grenzen(), "nichts geändert").toEqual(vorher);
  });
});

// ------------------------------------------------------------------------------------------------
// W6 · Externe Abfrage
// ------------------------------------------------------------------------------------------------
describe("W6 · Externe Abfrage über die Karte „Externe Wissensabfrage“", () => {
  async function karte(): Promise<void> {
    await montiere(createElement(KiExternDetail, { onZurueck: ohneZurueck }));
    await warteBis(() => text().includes(t("adm.ext.stage.blocked")), "Extern-Karte");
  }

  const stufe = async (): Promise<string> =>
    (await lies<{ stage: string }>("/api/external/policy")).stage;
  // Die vier Stufen stehen in der Karte in dieser Reihenfolge (`AdminKiDetails.tsx`,
  // `EXTERNAL_STAGES`) als Knöpfe mit `aria-pressed` — gewählt wird über die Stelle, nicht über
  // eine Teilzeichenkette, die auch im Erklärtext einer Nachbarstufe stehen könnte.
  const STUFEN = ["blocked", "search_on_click", "search_attach", "open"];
  const stufenKnopf = (s: string): Element | undefined =>
    [...container.querySelectorAll("button[aria-pressed]")][STUFEN.indexOf(s)];

  it("schreiben, erneut lesen, zurücknehmen", async () => {
    const vorher = await stufe();
    expect(vorher, "Ausgangslage dieser Instanz").not.toBe("blocked");
    await karte();
    expect(stufenKnopf("blocked")?.textContent).toContain(t("adm.ext.stage.blocked"));
    await klick(stufenKnopf("blocked"));
    await klick(knopf(t("adm.ext.save")));
    await warteBis(() => erfolgToasts().length > 0, "gespeichert");
    expect(await stufe(), "gelesen").toBe("blocked");

    await klick(stufenKnopf(vorher));
    await klick(knopf(t("adm.ext.save")));
    await warteBis(() => erfolgToasts().length > 1, "Rücknahme gespeichert");
    expect(await stufe(), "Rücknahme").toBe(vorher);
  });

  it("Fehler: bricht die Verbindung beim Speichern, meldet die Karte es — Stand unverändert", async () => {
    const vorher = await stufe();
    await karte();
    await klick(stufenKnopf("blocked"));
    stoerung = { methode: "PUT", pfad: "/api/external/policy" };
    await klick(knopf(t("adm.ext.save")));
    await warteBis(() => fehlerToasts().length > 0, "Fehlermeldung");
    expect(gestoerteAufrufe, "die Störung ist wirklich eingetreten").toBe(1);
    expect(await stufe(), "nichts geändert").toBe(vorher);
  });
});

// ------------------------------------------------------------------------------------------------
// W7 · Duplikat-Schwelle
// ------------------------------------------------------------------------------------------------
describe("W7 · Duplikat-Schwelle über die Karte „Duplikate“", () => {
  async function karte(): Promise<void> {
    await montiere(createElement(KiDupDetail, { onZurueck: ohneZurueck }));
    await warteBis(() => nachAria(t("adm.dup.threshold")) !== null, "Duplikat-Karte");
  }

  const schwelle = async (): Promise<number> =>
    (await lies<{ minConfidence: number }>("/api/duplicates/settings")).minConfidence;
  const schwellenFeld = (): HTMLInputElement | null => nachAria(t("adm.dup.threshold"));

  it("schreiben, erneut lesen, zurücknehmen", async () => {
    const vorher = await schwelle();
    await karte();
    await tippe(schwellenFeld(), "70");
    await klick(knopf(t("adm.dup.save")));
    await warteBis(() => erfolgToasts().length > 0, "gespeichert");
    expect(await schwelle(), "gelesen").toBe(0.7);

    await tippe(schwellenFeld(), String(Math.round(vorher * 100)));
    await klick(knopf(t("adm.dup.save")));
    await warteBis(() => erfolgToasts().length > 1, "Rücknahme gespeichert");
    expect(await schwelle(), "Rücknahme").toBe(vorher);
  });

  it("Fehler: ein Wert außerhalb des Bandes wird vom Server abgelehnt — Stand unverändert", async () => {
    const vorher = await schwelle();
    await karte();
    await tippe(schwellenFeld(), "150");
    await klick(knopf(t("adm.dup.save")));
    await warteBis(() => fehlerToasts().length > 0, "Ablehnung");
    expect(await schwelle(), "nichts geändert").toBe(vorher);
  });
});
