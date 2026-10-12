// @vitest-environment jsdom
// ================================================================================================
// produkt:20261010:assistenz-name-avatar · ERSTEINRICHTUNG, MEINE ASSISTENZ UND DIE OFFENE FIGUR.
// ================================================================================================
//
// Die ECHTE Hülle (`AppShell` mit Einrichtungsband, Profillader und beweglicher Assistenz), die
// ECHTE Profilseite und der ECHTE Server (`buildApp(buildServices())`, In-Memory). Ersetzt ist allein
// der Transport (`fetch` → `app.inject`), wie in `tests/profil-berichtigung/`. Fiktive Konten.
//
//   E1  Erstanmeldung: das Band fragt „Wie soll deine Assistenz heißen?"; ohne Name und Motiv geht
//       nichts an den Server, der Grund steht am Feld; danach tragen Figur, Tooltip, zugängliche
//       Beschriftung und Gesprächskopf Name und Motiv — der Name als Text, nie als Markup.
//   E2  Meine Assistenz: Abbrechen erhält die Auswahl; nur das Motiv ändern; Bewegung reduzieren;
//       die geöffnete Figur übernimmt alles ohne Abmeldung.
//   E3  Speicherfehler: Eingabe bleibt, bestätigter Stand bleibt; „Erneut speichern" und „Abbrechen".
//   E4  Nicht mehr angebotenes Motiv: neutrale Ersatzgrafik mit Hinweis, der Name bleibt.
//   E5  Kontowechsel im selben Browser: kein fremder Name, das zweite Konto bekommt seine Einrichtung.
//
// Echtes Layout, Breiten, Fokusbild und Tastatur im Browser misst
// `tests-smoke/assistenz-name-avatar-browser.spec.ts`.
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
import { meldeErgebnis } from "../../apps/web/src/components/assistenz/ausdruck";
import { setzeKlaraVorschauAktiv } from "../../apps/web/src/components/klara-vorschau/aktiv";
import { zuruecksetzenGanz } from "../../apps/web/src/components/klara-vorschau/zustand";
import i18n from "../../apps/web/src/i18n";
import { verwerfeAssistenzProfil } from "../../apps/web/src/lib/assistenzProfil";
import { Profile } from "../../apps/web/src/pages/Profile";
import { AppShell } from "../../apps/web/src/shell/AppShell";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";
import { bis, klick, medienStub, q, ruhe, tippe } from "../fe003-tutorial-fragen/huelle";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ADA = { name: "Ada Fiktiv", email: "ada@assistenz-ui.test", password: "ada-geheim-1" };
const WANDA = { name: "Wanda Fiktiv", email: "wanda@assistenz-ui.test", password: "wanda-geh-1" };
const NAME_MIT_MARKUP = "<b>Mia</b>";
const BILD = (id: string) => `/assistenz/erstauswahl-v1/${id}.png`;

let services: AppServices;
let app: FastifyInstance | null = null;
let cookie: string | null = null;
let adaCookie = "";
let adaId = "";
let wandaCookie = "";
let vorherigerFetch: typeof globalThis.fetch;
let stoerung: { methode: string; pfad: string } | null = null;
const anfragen: { methode: string; pfad: string }[] = [];

function drahtAufbauen(): void {
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    if (!app) {
      throw new Error(`Draht ohne App: ${methode} ${url}`);
    }
    anfragen.push({ methode, pfad: url.split("?")[0] ?? url });
    if (stoerung && stoerung.methode === methode && url.startsWith(stoerung.pfad)) {
      stoerung = null;
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

async function anmelden(email: string, password: string): Promise<string> {
  const r = await (app as FastifyInstance).inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  expect(r.statusCode, r.body).toBe(200);
  return `kw_session=${(r.json() as { token: string }).token}`;
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
    headers: { cookie: mit },
    ...(payload ? { payload } : {}),
  });
  return { status: r.statusCode, body: r.body === "" ? null : r.json() };
}

async function profil(mit: string): Promise<Record<string, unknown> | null> {
  const r = await draht("GET", "/api/me/assistenz", mit);
  expect(r.status).toBe(200);
  return (r.body as { profil: Record<string, unknown> | null }).profil;
}

async function vorrichtung(): Promise<void> {
  services = buildServices();
  app = buildApp(services);
  await app.ready();
  const a = await app.inject({ method: "POST", url: "/api/auth/register", payload: ADA });
  expect(a.statusCode, "Ersteinrichtung (Ada)").toBe(201);
  adaId = (a.json() as { id: string }).id;
  const w = await app.inject({ method: "POST", url: "/api/auth/register", payload: WANDA });
  expect(w.statusCode, "zweites Konto (Wanda)").toBe(201);
  const wandaId = (w.json() as { id: string }).id;
  adaCookie = await anmelden(ADA.email, ADA.password);
  const frei = await draht("POST", `/api/auth/users/${wandaId}/approve`, adaCookie);
  expect(frei.status, "Wanda freigegeben").toBeLessThan(300);
  wandaCookie = await anmelden(WANDA.email, WANDA.password);
  // Der Nutzungshinweis hat Vorrang vor der Einrichtung; hier ist er schon bestätigt.
  for (const mit of [adaCookie, wandaCookie]) {
    expect((await draht("POST", "/api/auth/notice", mit)).status).toBeLessThan(300);
  }
}

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

async function montiere(route: string, seite: ReactNode): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
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
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: [route] },
                  createElement(AppShell, null, seite),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await ruhe();
}

function abbauen(): void {
  if (root) {
    act(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
  }
}

const puts = (): number =>
  anfragen.filter((a) => a.methode === "PUT" && a.pfad === "/api/me/assistenz").length;

async function figur(): Promise<HTMLButtonElement> {
  await bis(() => Boolean(q(document, "klara-figur")), 160);
  const f = q<HTMLButtonElement>(document, "klara-figur");
  if (!f) {
    throw new Error("Figur fehlt");
  }
  return f;
}

function radio(id: string): HTMLInputElement {
  const r = document.querySelector<HTMLInputElement>(
    `[data-testid="assistenz-avatar-${id}"] input[type="radio"]`,
  );
  if (!r) {
    throw new Error(`Motiv ${id} fehlt`);
  }
  return r;
}

function namensfeld(): HTMLInputElement {
  const f = q<HTMLInputElement>(document, "assistenz-name");
  if (!f) {
    throw new Error("Namensfeld fehlt");
  }
  return f;
}

beforeAll(() => {
  drahtAufbauen();
});

afterAll(() => {
  globalThis.fetch = vorherigerFetch;
});

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  zuruecksetzenGanz();
  verwerfeAssistenzProfil();
  meldeErgebnis(null);
  setzeKlaraVorschauAktiv(true);
  medienStub();
  Element.prototype.scrollIntoView = () => {};
  await i18n.changeLanguage("de");
  stoerung = null;
  anfragen.length = 0;
  await vorrichtung();
  cookie = adaCookie;
});

afterEach(async () => {
  abbauen();
  document.body.innerHTML = "";
  setzeKlaraVorschauAktiv(false);
  zuruecksetzenGanz();
  verwerfeAssistenzProfil();
  await app?.close();
  app = null;
  cookie = null;
});

describe("E1 · Erstanmeldung: Einrichtung, Feldprüfung, danach Name und Motiv in der Assistenz", () => {
  it("ohne Name/Motiv nichts gespeichert; danach Figur, Tooltip und Gesprächskopf persönlich", async () => {
    await montiere("/start", createElement("div", { "data-testid": "leere-seite" }));
    await bis(() => Boolean(q(document, "assistenz-einrichtung")), 160);
    const band = q(document, "assistenz-einrichtung");
    expect(band?.textContent).toContain("Wie soll deine Assistenz heißen?");
    // Kein Dialog: die Seite bleibt bedienbar, nichts ist gesperrt.
    expect(band?.getAttribute("aria-modal")).toBeNull();
    expect(q(document, "leere-seite")?.closest("[inert]")).toBeNull();

    // Neutral, solange kein Name gespeichert ist — kein fester Produktname.
    const f = await figur();
    expect(f.getAttribute("aria-label")).toBe("Assistenz – Gespräch öffnen oder schließen");
    expect(f.getAttribute("title")).toBe("Assistenz – Gespräch öffnen oder schließen");

    await klick(q(document, "assistenz-einrichtung-starten"));
    await bis(() => Boolean(q(document, "assistenz-formular-einrichtung")));
    expect(namensfeld().value).toBe("");
    expect(document.activeElement).toBe(namensfeld());

    const vorher = puts();
    await klick(q(document, "assistenz-speichern"));
    expect(q(document, "assistenz-name-fehler")?.textContent).toBe("Bitte gib einen Namen ein.");
    expect(q(document, "assistenz-avatar-fehler")?.textContent).toBe("Bitte wähle ein Motiv.");
    expect(namensfeld().getAttribute("aria-invalid")).toBe("true");
    const fehlerId = q(document, "assistenz-name-fehler")?.id ?? "-";
    expect(namensfeld().getAttribute("aria-describedby")).toContain(fehlerId);
    expect(puts(), "unvollständig darf nichts an den Server gehen").toBe(vorher);
    expect(await profil(adaCookie)).toBeNull();

    await tippe(namensfeld(), NAME_MIT_MARKUP);
    await klick(radio("eule"));
    expect(radio("eule").checked).toBe(true);
    expect(q(document, "assistenz-vorschau-name")?.textContent).toBe(NAME_MIT_MARKUP);
    await klick(q(document, "assistenz-speichern"));
    await bis(() => Boolean(q(document, "assistenz-einrichtung-fertig")), 120);
    expect(q(document, "assistenz-einrichtung-fertig")?.textContent).toContain(NAME_MIT_MARKUP);
    expect(await profil(adaCookie)).toMatchObject({ name: NAME_MIT_MARKUP, avatar: "eule" });

    // Die offene Figur übernimmt Name und Motiv sofort — als Text, ohne erzeugtes Markup.
    await bis(() => (f.getAttribute("aria-label") ?? "").startsWith(NAME_MIT_MARKUP));
    const beschriftung = `${NAME_MIT_MARKUP} – Gespräch öffnen oder schließen`;
    expect(f.getAttribute("aria-label")).toBe(beschriftung);
    expect(f.getAttribute("title")).toBe(beschriftung);
    expect(q<HTMLImageElement>(document, "klara-avatar")?.getAttribute("src")).toBe(BILD("eule"));
    await klick(f);
    await bis(() => Boolean(q(document, "klara-gespraech")));
    const kopf = document.querySelector('[data-testid="klara-gespraech"] h2');
    expect(kopf?.textContent).toBe(NAME_MIT_MARKUP);
    const kopfBild = q<HTMLImageElement>(document, "klara-gespraech-avatar");
    expect(kopfBild?.getAttribute("src")).toBe(BILD("eule"));
    expect(document.querySelector("b"), "der Name darf kein Markup erzeugen").toBeNull();

    // Abschluss am Konto: nach erneutem Aufbau erscheint das Band nicht mehr.
    await klick(q(document, "assistenz-einrichtung-schliessen"));
    abbauen();
    verwerfeAssistenzProfil();
    await montiere("/start", createElement("div", { "data-testid": "leere-seite" }));
    await figur();
    await bis(() => (q(document, "klara-figur")?.getAttribute("aria-label") ?? "").length > 0);
    await ruhe(40);
    expect(q(document, "assistenz-einrichtung")).toBeNull();
  });
});

describe("E2/E3 · Meine Assistenz: Abbrechen, einzeln ändern, Bewegung, Speicherfehler", () => {
  it("Änderungen wirken in der geöffneten Figur ohne Abmeldung; ein Fehler verliert nichts", async () => {
    const start = await draht("PUT", "/api/me/assistenz", adaCookie, {
      name: "Mia",
      avatar: "eule",
      einrichtungAbschliessen: true,
      fassung: 0,
    });
    expect(start.status).toBe(200);
    await montiere("/profil?bereich=assistenz", createElement(Profile));
    await bis(() => Boolean(q(document, "assistenz-formular-aendern")), 160);
    const f = await figur();
    await bis(() => (f.getAttribute("aria-label") ?? "").startsWith("Mia"));
    expect(namensfeld().value).toBe("Mia");
    expect(radio("eule").checked).toBe(true);

    // Abbrechen erhält die bisherige Auswahl.
    await tippe(namensfeld(), "Kai");
    await klick(radio("wolke"));
    await klick(q(document, "assistenz-abbrechen"));
    expect(namensfeld().value).toBe("Mia");
    expect(radio("eule").checked).toBe(true);
    expect(q(document, "assistenz-meldung")?.textContent).toContain("Abgebrochen");
    expect(await profil(adaCookie)).toMatchObject({ name: "Mia", avatar: "eule" });

    // Nur das Motiv — der Name bleibt; die Figur wechselt sofort.
    await klick(radio("fuchs"));
    await klick(q(document, "assistenz-speichern"));
    const meldung = () => q(document, "assistenz-meldung")?.textContent ?? "";
    await bis(() => meldung().includes("Gespeichert"));
    expect(q(document, "assistenz-meldung")?.textContent).toBe(
      "Gespeichert: Mia mit dem Motiv „Fuchs“.",
    );
    expect(await profil(adaCookie)).toMatchObject({ name: "Mia", avatar: "fuchs" });
    await bis(() => q(document, "klara-avatar")?.getAttribute("src") === BILD("fuchs"));
    expect(q(document, "klara-avatar")?.getAttribute("src")).toBe(BILD("fuchs"));
    // Zustand aus dem echten Ereignis: bestätigtes Speichern = Freude (expressives Motiv).
    expect(f.getAttribute("data-zustand")).toBe("freude");
    expect(f.getAttribute("data-stil")).toBe("expressiv");

    // Bewegung reduzieren: am Konto gespeichert, an der Figur wirksam.
    await klick(q(document, "assistenz-bewegung"));
    await klick(q(document, "assistenz-speichern"));
    await bis(() => f.getAttribute("data-bewegung") === "reduziert");
    expect(f.getAttribute("data-bewegung")).toBe("reduziert");
    expect(await profil(adaCookie)).toMatchObject({ bewegung: "reduziert" });

    // E3 · Speicherfehler: Eingabe bleibt, bestätigter Stand bleibt, „Erneut speichern" gelingt.
    stoerung = { methode: "PUT", pfad: "/api/me/assistenz" };
    await tippe(namensfeld(), "Kai");
    await klick(q(document, "assistenz-speichern"));
    await bis(() => Boolean(q(document, "assistenz-speicherfehler")));
    expect(q(document, "assistenz-speicherfehler")?.getAttribute("role")).toBe("alert");
    expect(q(document, "assistenz-speicherfehler")?.textContent).toContain("Nicht gespeichert");
    expect(namensfeld().value).toBe("Kai");
    expect(await profil(adaCookie)).toMatchObject({ name: "Mia" });
    expect(f.getAttribute("aria-label")).toBe("Mia – Gespräch öffnen oder schließen");
    // Tatsächlich fehlgeschlagen: Fehlerzustand mit Text an der Figur.
    expect(f.getAttribute("data-zustand")).toBe("fehler");
    expect(q(document, "klara-figur-zustand")?.textContent).toContain("Fehlgeschlagen");
    // Die übrige Anwendung bleibt bedienbar: die Figur öffnet weiter ihr Gespräch.
    await klick(f);
    await bis(() => Boolean(q(document, "klara-gespraech")));
    expect(q(document, "klara-gespraech")).not.toBeNull();

    await klick(q(document, "assistenz-wiederholen"));
    await bis(() => (f.getAttribute("aria-label") ?? "").startsWith("Kai"));
    expect(await profil(adaCookie)).toMatchObject({ name: "Kai", avatar: "fuchs" });
    expect(document.querySelector('[data-testid="klara-gespraech"] h2')?.textContent).toBe("Kai");

    // Noch ein Fehler — diesmal „Abbrechen": zurück zum bestätigten Stand.
    stoerung = { methode: "PUT", pfad: "/api/me/assistenz" };
    await tippe(namensfeld(), "Lio");
    await klick(q(document, "assistenz-speichern"));
    await bis(() => Boolean(q(document, "assistenz-speicherfehler")));
    await klick(q(document, "assistenz-abbrechen"));
    expect(q(document, "assistenz-speicherfehler")).toBeNull();
    // Abbrechen beendet den Fehlerzustand der Figur.
    expect(f.getAttribute("data-zustand")).not.toBe("fehler");
    expect(namensfeld().value).toBe("Kai");
    expect(await profil(adaCookie)).toMatchObject({ name: "Kai" });
  });
});

describe("E4 · ein nicht mehr angebotenes Motiv: Ersatzgrafik mit Hinweis, Name bleibt", () => {
  it("Figur und Meine Assistenz zeigen die neutrale Ersatzgrafik und den Hinweis", async () => {
    const jetzt = new Date().toISOString();
    expect(
      await services.assistenzProfile.schreibe({
        kontoId: adaId,
        name: "Mia",
        avatar: "motiv-aus-altbestand",
        bewegung: "standard",
        eingerichtetAm: jetzt,
        fassung: 1,
        geaendertAm: jetzt,
      }),
    ).toBe(true);
    await montiere("/profil?bereich=assistenz", createElement(Profile));
    const f = await figur();
    await bis(() => (f.getAttribute("aria-label") ?? "").startsWith("Mia"));
    expect(f.querySelector('[data-avatar-ersatz="unbekannt"]')).not.toBeNull();
    await bis(() => Boolean(q(document, "assistenz-avatar-fehlt")), 120);
    expect(q(document, "assistenz-avatar-fehlt")?.textContent).toContain("nicht mehr angeboten");
    expect(namensfeld().value).toBe("Mia");
    await klick(f);
    await bis(() => Boolean(q(document, "klara-avatar-fehlt")));
    expect(q(document, "klara-avatar-fehlt")?.textContent).toContain("dein Name bleibt erhalten");
  });
});

describe("E6 · klassischer Hilfeknopf ohne festen Produktnamen (K6)", () => {
  it("ohne Profil neutral „Assistenz“/„Deine Assistenz“, mit Profil der persönliche Name", async () => {
    setzeKlaraVorschauAktiv(false);
    await montiere("/start", createElement("div", { "data-testid": "leere-seite" }));
    // Der klassische Hilfeknopf (`KlaraAssistant`) — an seiner Beschriftung „… — Hilfe zu dieser Seite“.
    const knopf = (): HTMLButtonElement | null =>
      document.querySelector<HTMLButtonElement>(
        'button[data-klara="1"][aria-label$="— Hilfe zu dieser Seite"]',
      );
    await bis(() => Boolean(knopf()), 160);
    expect(knopf()?.getAttribute("aria-label")).toBe("Assistenz öffnen — Hilfe zu dieser Seite");
    expect(knopf()?.getAttribute("title")).toBe("Assistenz öffnen — Hilfe zu dieser Seite");
    await klick(knopf());
    const flaeche = document.querySelector('section[data-klara="1"][aria-label]');
    expect(flaeche?.getAttribute("aria-label")).toBe("Deine Assistenz");
    abbauen();

    await draht("PUT", "/api/me/assistenz", adaCookie, {
      name: "Mia",
      avatar: "eule",
      einrichtungAbschliessen: true,
      fassung: 0,
    });
    verwerfeAssistenzProfil();
    await montiere("/start", createElement("div", { "data-testid": "leere-seite" }));
    await bis(() => knopf()?.getAttribute("aria-label")?.startsWith("Mia") ?? false, 160);
    expect(knopf()?.getAttribute("aria-label")).toBe("Mia öffnen — Hilfe zu dieser Seite");
  });
});

describe("E5 · Kontowechsel im selben Browser: getrennte Profile", () => {
  it("nach Ada sieht Wanda keinen fremden Namen und bekommt ihre eigene Einrichtung", async () => {
    await draht("PUT", "/api/me/assistenz", adaCookie, {
      name: "Mia",
      avatar: "eule",
      einrichtungAbschliessen: true,
      fassung: 0,
    });
    await montiere("/start", createElement("div", { "data-testid": "leere-seite" }));
    const f = await figur();
    await bis(() => (f.getAttribute("aria-label") ?? "").startsWith("Mia"));
    abbauen();

    cookie = wandaCookie;
    await montiere("/start", createElement("div", { "data-testid": "leere-seite" }));
    const g = await figur();
    await bis(() => Boolean(q(document, "assistenz-einrichtung")), 160);
    expect(g.getAttribute("aria-label")).toBe("Assistenz – Gespräch öffnen oder schließen");
    expect(document.body.textContent).not.toContain("Mia");
    expect(await profil(wandaCookie)).toBeNull();
    expect(await profil(adaCookie)).toMatchObject({ name: "Mia" });
  });
});
