// @vitest-environment jsdom
// ================================================================================================
// KI-WAHL-BETRIEBSABNAHME · Antwort 29 (BEN, Nacharbeit 10) — DIE WAHL JE SCHUTZSTUFE IN DER
// ADMINKARTE: AUSWÄHLEN, SPEICHERN, WIEDERÖFFNEN.
// ================================================================================================
//
// BENs Befund: die Schutzstufenregel einschliesslich „Keine KI" war nur serverseitig vorhanden; die
// KI-Karte (`AdminKiDetails.tsx`, `KiDetail`) bot keine Auswahl, ihr Speicherweg trug nur
// `global`/`perTask`. Diese Datei bedient die ECHTE Karte gegen den ECHTEN Server und liest danach am
// Server nach, was gilt:
//
//   K1 · „Keine KI" für „vertraulich" wählen → `taskConfig.proSchutzstufe` am Server; die Zuordnung
//        (`global`) bleibt unberührt.
//   K2 · eine zweite Stufe dazu → beide Stufen stehen am Server (keine Stufe überschreibt die andere).
//   K3 · Karte schließen und WIEDER ÖFFNEN → die Auswahlfelder zeigen den gespeicherten Stand.
//   K4 · zurück auf „Wie die Aufgabenwahl" → die Stufe verschwindet am Server; ohne belegte Stufe
//        ist die Regel ganz fort.
//
// WAS ECHT IST: Server (`buildApp`/`buildServices`, In-Memory), Clientabruf, Karte, Toasts. Ersetzt
// ist allein der Transport: `fetch` liegt auf `app.inject` (dieselbe Bauform wie
// `tests/verwaltung-schreibwege/karten-am-echten-server.test.tsx`).
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
import { KiDetail } from "../../apps/web/src/pages/AdminKiDetails";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ADMIN = {
  name: "Ada Schutzstufe",
  email: "ada@schutzstufe.test",
  password: "schutzstufe-admin-4711",
};

let app: FastifyInstance | null = null;
let cookie = "";
let vorherigerFetch: typeof globalThis.fetch;
const vorherigeUmgebung: Record<string, string | undefined> = {};
const UMGEBUNG = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "KLARWERK_REASONER_POLICY"] as const;

function drahtAufbauen(): void {
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    if (!app) {
      throw new Error(`Draht ohne App: ${methode} ${url}`);
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

interface Konfig {
  taskConfig: { global: string; proSchutzstufe?: Record<string, string> };
}

async function serverStand(): Promise<Konfig["taskConfig"]> {
  const r = await (app as FastifyInstance).inject({
    method: "GET",
    url: "/api/reasoner/config",
    headers: { cookie },
  });
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as Konfig).taskConfig;
}

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

function schliessen(): void {
  if (root) {
    act(() => root?.unmount());
    root = null;
  }
  container?.remove();
}

const auswahl = (stufe: string): HTMLSelectElement | null =>
  container.querySelector<HTMLSelectElement>(`select[data-testid="ki-schutzstufe-${stufe}"]`);

const erfolgToasts = (): number => container.querySelectorAll("output.bg-trust-pos-bg").length;

async function karte(): Promise<void> {
  await montiere(createElement(KiDetail, { onZurueck: () => undefined }));
  await warteBis(() => auswahl("vertraulich") !== null, "Schutzstufenwahl in der KI-Karte");
  await warteBis(() => auswahl("vertraulich")?.disabled === false, "Auswahl bedienbar");
}

async function waehle(stufe: string, wert: string): Promise<void> {
  const feld = auswahl(stufe);
  if (!feld) {
    throw new Error(`Auswahl für ${stufe} fehlt — sichtbar: ${text().slice(0, 400)}`);
  }
  const vorher = erfolgToasts();
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(feld, wert);
    feld.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await warteBis(() => erfolgToasts() > vorher, `gespeichert: ${stufe} → ${wert || "leer"}`);
  await warteBis(() => auswahl(stufe)?.disabled === false, "Kanal wieder frei");
}

beforeAll(() => {
  for (const name of UMGEBUNG) {
    vorherigeUmgebung[name] = process.env[name];
    process.env[name] = "";
  }
  drahtAufbauen();
});

afterAll(() => {
  globalThis.fetch = vorherigerFetch;
  for (const name of UMGEBUNG) {
    if (vorherigeUmgebung[name] === undefined) {
      Reflect.deleteProperty(process.env, name);
    } else {
      process.env[name] = vorherigeUmgebung[name];
    }
  }
});

beforeEach(async () => {
  await i18n.changeLanguage("de");
  const services = buildServices();
  await services.reasoner.loadPersistedPolicy();
  app = buildApp(services);
  await app.ready();
  const a = await app.inject({ method: "POST", url: "/api/auth/register", payload: ADMIN });
  expect(a.statusCode, "Admin-Ersteinrichtung").toBe(201);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ADMIN.email, password: ADMIN.password },
  });
  expect(login.statusCode, login.body).toBe(200);
  cookie = `kw_session=${(login.json() as { token: string }).token}`;
});

afterEach(async () => {
  schliessen();
  await app?.close();
  app = null;
  cookie = "";
});

describe("Antwort 29 · KI je Vertraulichkeitsstufe in der Adminkarte", () => {
  it("K1–K4 · auswählen, speichern, wiederöffnen, zurücknehmen — der Server trägt jeden Schritt", async () => {
    const ausgang = await serverStand();
    expect(ausgang.proSchutzstufe, "Ausgangslage: keine Stufenregel").toBeUndefined();

    await karte();
    const optionen = [...(auswahl("vertraulich")?.options ?? [])].map((o) => o.textContent);
    expect(optionen, "„Keine KI“ fehlt in der Auswahl").toContain(i18n.t("adm.ai.stufe.keineKi"));
    expect(auswahl("intern")?.value, "ohne Regel: wie die Aufgabenwahl").toBe("");

    // K1 · Keine KI für vertraulich.
    await waehle("vertraulich", "deterministic");
    const k1 = await serverStand();
    expect(k1.proSchutzstufe).toEqual({ vertraulich: "deterministic" });
    expect(k1.global, "die Zuordnung wurde nebenbei verändert").toBe(ausgang.global);

    // K2 · eine zweite Stufe dazu — die erste bleibt.
    await waehle("streng_vertraulich", "deterministic");
    expect((await serverStand()).proSchutzstufe).toEqual({
      vertraulich: "deterministic",
      streng_vertraulich: "deterministic",
    });

    // K3 · schließen und wieder öffnen: die Karte liest den gespeicherten Stand zurück.
    schliessen();
    await karte();
    expect(auswahl("vertraulich")?.value).toBe("deterministic");
    expect(auswahl("streng_vertraulich")?.value).toBe("deterministic");
    expect(auswahl("intern")?.value).toBe("");

    // K4 · zurücknehmen: erst eine Stufe, dann die letzte — danach keine Regel mehr.
    await waehle("vertraulich", "");
    expect((await serverStand()).proSchutzstufe).toEqual({ streng_vertraulich: "deterministic" });
    await waehle("streng_vertraulich", "");
    expect((await serverStand()).proSchutzstufe, "die Regel blieb stehen").toBeUndefined();
  });
});
