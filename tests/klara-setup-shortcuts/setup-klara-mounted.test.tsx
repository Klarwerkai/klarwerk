// @vitest-environment jsdom
// ================================================================================================
// produkt:20261012:klara-setup-shortcuts-umsetzung · SETUP › KLARA UND DIE TASTENKÜRZEL, BEDIENT.
// ================================================================================================
//
// Die ECHTE Hülle (`AppShell` mit Kopfband, Zahnradmenü, Befehlspalette, Seitenhilfe und der
// Assistenz im Produktbetrieb), die ECHTE Profilseite über echte Routen und der ECHTE Server
// (`buildApp(buildServices())`, In-Memory). Ersetzt ist allein der Transport (`fetch` →
// `app.inject`), wie in `tests/assistenz-profil/assistenz-mounted.test.tsx`. Fiktive Konten.
// Attrappe ist nur die Spracherkennung des Browsers (`SpeechRecognition`), wie in Klara 02.
//
//   B1  K1/K2/K3/K4/K5/K10  Zahnrad › Persönliche Einstellungen › „Klara“: alle Gruppen des Bestands,
//       vorhandene Werte, Speichern in einer bestehenden Gruppe, Zuständigkeit getrennter Hosts,
//       Verwaltungsverweis nur für admin, Geltungsbereich ohne systemweites Versprechen.
//   B2  K6/K9/K11/K12/K13/K14/K15/K16  Festlegen, Abbrechen (Escape), Palette-Konflikt, Doppel-
//       belegung, Ausführen genau einmal je Betätigung, idempotentes Öffnen mit erhaltener Eingabe,
//       Wiederholung, Textfelder, Editor-Kürzel, Dialog, Ändern, Entfernen, Speicherfehler.
//   B3  K7/K8/K17/K18  Neuladen: Belegung wirkt sofort wieder; entfernt bleibt entfernt; Standard
//       und „alle zurücksetzen“; Diktieren, Auftrag sprechen und Aufnahme stoppen über die
//       vorhandene Sprachleiste — gesendet wird nichts; Mikrofon-Ablehnung bleibt sichtbar.
//   B4  K4/K7  Rollen und Konten: die zweite Person (Leserolle) sieht ihre eigenen Standards und
//       keinen Verwaltungsverweis.
//
// NICHT gemessen: echte Tastatur und Fokusbild eines Browsers, echte Mikrofonfreigabe, VoiceOver,
// deutsches/englisches Hardware-Layout am Mac — das bleibt Host- und Bedienabnahme (AA-05).
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import type { FastifyInstance } from "fastify";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { meldeErgebnis } from "../../apps/web/src/components/assistenz/ausdruck";
import { setzeKlaraVorschauAktiv } from "../../apps/web/src/components/klara-vorschau/aktiv";
import { vergiss } from "../../apps/web/src/components/klara-vorschau/echt";
import { zuruecksetzenGanz } from "../../apps/web/src/components/klara-vorschau/zustand";
import i18n from "../../apps/web/src/i18n";
import { verwerfeAssistenzProfil } from "../../apps/web/src/lib/assistenzProfil";
import { verwerfeEigeninitiative } from "../../apps/web/src/lib/klaraEigeninitiative";
import {
  KLARA_AKTION_EREIGNIS,
  verwerfeTastenkuerzel,
} from "../../apps/web/src/lib/klaraTastenkuerzel";
import { Profile } from "../../apps/web/src/pages/Profile";
import { AppShell } from "../../apps/web/src/shell/AppShell";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";
import { bis, klick, medienStub, q, ruhe, tippe } from "../fe003-tutorial-fragen/huelle";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ADA = { name: "Ada Fiktiv", email: "ada@klara-setup.test", password: "ada-geheim-1" };
const WANDA = { name: "Wanda Fiktiv", email: "wanda@klara-setup.test", password: "wanda-geh-1" };
const BASIS = "/api/me/assistenz/tastenkuerzel";

let services: AppServices;
let app: FastifyInstance | null = null;
let cookie: string | null = null;
let adaCookie = "";
let wandaCookie = "";
let vorherigerFetch: typeof globalThis.fetch;
let stoerung: { methode: string; pfad: string } | null = null;
const anfragen: { methode: string; pfad: string }[] = [];
/** Jede Klara-Aktion, die der zentrale Ausführungsweg gemeldet hat. */
let ausgeloest: string[] = [];
const zaehle = (e: Event): void => {
  ausgeloest.push((e as CustomEvent<{ aktion: string }>).detail.aktion);
};

// ------------------------------------------------------------------------------------------------
// Die Attrappe der Spracherkennung (wie Klara 02): „hört“, was der Test ihr sagt.
// ------------------------------------------------------------------------------------------------
type Ergebnis = ArrayLike<{ transcript: string }> & { isFinal?: boolean };

class RekorderDoppel {
  static letzter: RekorderDoppel | null = null;
  static alle = 0;
  lang = "";
  continuous = false;
  interimResults = false;
  gestartet = 0;
  gestoppt = 0;
  onresult: ((e: { resultIndex: number; results: ArrayLike<Ergebnis> }) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e?: { error?: string }) => void) | null = null;
  constructor() {
    RekorderDoppel.letzter = this;
    RekorderDoppel.alle += 1;
  }
  start(): void {
    this.gestartet += 1;
  }
  stop(): void {
    this.gestoppt += 1;
    this.onend?.();
  }
  hoert(text: string): void {
    this.onresult?.({
      resultIndex: 0,
      results: [Object.assign([{ transcript: text }], { isFinal: true })],
    });
  }
}

type Fenster = Record<string, unknown>;
const fenster = window as unknown as Fenster;

// ------------------------------------------------------------------------------------------------
// Vorrichtung.
// ------------------------------------------------------------------------------------------------
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

interface KuerzelStand {
  aktionen: { aktion: string; belegung: Record<string, unknown> | null; quelle: string }[];
}

async function amServer(mit: string, aktion: string) {
  const r = await draht("GET", BASIS, mit);
  expect(r.status).toBe(200);
  return (r.body as KuerzelStand).aktionen.find((a) => a.aktion === aktion);
}

async function vorrichtung(): Promise<void> {
  services = buildServices();
  app = buildApp(services);
  await app.ready();
  const a = await app.inject({ method: "POST", url: "/api/auth/register", payload: ADA });
  expect(a.statusCode, "Ersteinrichtung (Ada)").toBe(201);
  const w = await app.inject({ method: "POST", url: "/api/auth/register", payload: WANDA });
  expect(w.statusCode, "zweites Konto (Wanda)").toBe(201);
  const wandaId = (w.json() as { id: string }).id;
  adaCookie = await anmelden(ADA.email, ADA.password);
  const frei = await draht("POST", `/api/auth/users/${wandaId}/approve`, adaCookie);
  expect(frei.status, "Wanda freigegeben").toBeLessThan(300);
  wandaCookie = await anmelden(WANDA.email, WANDA.password);
  for (const mit of [adaCookie, wandaCookie]) {
    expect((await draht("POST", "/api/auth/notice", mit)).status).toBeLessThan(300);
  }
}

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

async function montiere(route: string): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const seiten = createElement(
    Routes,
    null,
    createElement(Route, { path: "/profil", element: createElement(Profile) }),
    createElement(Route, {
      path: "*",
      element: createElement("div", { "data-testid": "leere-seite" }),
    }),
  );
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
                  createElement(AppShell, null, seiten),
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

/** Neuladen: Seite weg, Browserspeicher der Konten verworfen, neu aufgebaut. */
async function neuLaden(route: string): Promise<void> {
  abbauen();
  verwerfeTastenkuerzel();
  verwerfeAssistenzProfil();
  verwerfeEigeninitiative();
  await montiere(route);
}

interface Taste {
  code: string;
  key: string;
  strg?: boolean;
  umschalt?: boolean;
  alt?: boolean;
  meta?: boolean;
  repeat?: boolean;
}

async function druecke(ziel: EventTarget, t: Taste): Promise<KeyboardEvent> {
  const e = new KeyboardEvent("keydown", {
    code: t.code,
    key: t.key,
    ctrlKey: t.strg ?? false,
    shiftKey: t.umschalt ?? false,
    altKey: t.alt ?? false,
    metaKey: t.meta ?? false,
    repeat: t.repeat ?? false,
    bubbles: true,
    cancelable: true,
  });
  await act(async () => {
    ziel.dispatchEvent(e);
  });
  await ruhe(5);
  return e;
}

const STRG_UMSCHALT_E: Taste = { code: "KeyE", key: "E", strg: true, umschalt: true };
const STRG_UMSCHALT_U: Taste = { code: "KeyU", key: "U", strg: true, umschalt: true };

function zeile(aktion: string): HTMLElement {
  const z = q(document, `klara-kuerzel-${aktion}`);
  if (!z) {
    throw new Error(`Zeile ${aktion} fehlt`);
  }
  return z;
}

const inZeile = (aktion: string, testId: string): HTMLButtonElement | null =>
  zeile(aktion).querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);

const meldung = (): HTMLElement | null => q(document, "klara-kuerzel-meldung");

const kuerzelPuts = (): number =>
  anfragen.filter((a) => a.methode === "PUT" && a.pfad === BASIS).length;

/** „Festlegen“ bzw. „Ändern“ und warten, bis die Aufnahme den Fokus hat. */
async function aufnahmeStarten(aktion: string): Promise<HTMLElement> {
  await klick(inZeile(aktion, "klara-kuerzel-festlegen"));
  await bis(() => document.activeElement === q(document, "klara-kuerzel-aufnahme"));
  const feld = q(document, "klara-kuerzel-aufnahme");
  expect(document.activeElement, `Aufnahme für ${aktion} hat den Fokus`).toBe(feld);
  return feld as HTMLElement;
}

/** Belegen über die Aufnahme und warten, bis der Server die Änderung bestätigt hat. */
async function belegen(aktion: string, t: Taste): Promise<void> {
  const vorher = kuerzelPuts();
  const feld = await aufnahmeStarten(aktion);
  await druecke(feld, t);
  await bis(
    () =>
      kuerzelPuts() > vorher &&
      !(meldung()?.textContent ?? "").startsWith("Wird gespeichert") &&
      (meldung()?.textContent ?? "") !== "",
    120,
  );
  expect(meldung()?.textContent ?? "").toMatch(/^Gespeichert: /);
  expect(zeile(aktion).dataset.quelle).toBe("eigen");
}

/** Kürzelliste geladen und die (nachgeladene) Assistenz bereit, Aktionen auszuführen. */
async function zumBereich(): Promise<void> {
  await bis(() => Boolean(q(document, "klara-kuerzel-liste")), 160);
  expect(q(document, "klara-kuerzel-liste"), "Kürzelliste geladen").not.toBeNull();
  await bis(() => Boolean(q(document, "klara-figur")), 160);
  expect(q(document, "klara-figur"), "Assistenz geladen").not.toBeNull();
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
  vergiss();
  verwerfeAssistenzProfil();
  verwerfeEigeninitiative();
  verwerfeTastenkuerzel();
  meldeErgebnis(null);
  // Der normale Produkteinstieg: Seitenhilfe und Assistenz nebeneinander.
  setzeKlaraVorschauAktiv(false);
  medienStub();
  Element.prototype.scrollIntoView = () => {};
  fenster.SpeechRecognition = RekorderDoppel;
  RekorderDoppel.letzter = null;
  RekorderDoppel.alle = 0;
  await i18n.changeLanguage("de");
  stoerung = null;
  anfragen.length = 0;
  ausgeloest = [];
  window.addEventListener(KLARA_AKTION_EREIGNIS, zaehle);
  await vorrichtung();
  cookie = adaCookie;
});

afterEach(async () => {
  window.removeEventListener(KLARA_AKTION_EREIGNIS, zaehle);
  abbauen();
  document.body.innerHTML = "";
  fenster.SpeechRecognition = undefined;
  fenster.webkitSpeechRecognition = undefined;
  zuruecksetzenGanz();
  vergiss();
  verwerfeAssistenzProfil();
  verwerfeEigeninitiative();
  verwerfeTastenkuerzel();
  await app?.close();
  app = null;
  cookie = null;
});

describe("B1 · Setup › Klara über die reguläre Navigation, alle Einstellungen gruppiert", () => {
  it("Zahnrad › Persönliche Einstellungen › Klara; Werte bleiben; Speichern; Hosts mit Zuständigkeit", async () => {
    // Vorhandene Werte: Profil, Unterstützungsmodus und ein ruhender Hinweis am Server.
    const profil = await draht("PUT", "/api/me/assistenz", adaCookie, {
      name: "Mia",
      avatar: "eule",
      einrichtungAbschliessen: true,
      fassung: 0,
    });
    expect(profil.status).toBe(200);
    const modusVorher = await draht("PUT", "/api/me/assistenz/eigeninitiative", adaCookie, {
      modus: "hinweise",
    });
    expect(modusVorher.status).toBe(200);
    const hinweis = await draht("POST", "/api/me/assistenz/eigeninitiative/hinweise", adaCookie, {
      schluessel: "seite:fragen",
      stand: "zurueckgestellt",
    });
    expect(hinweis.status).toBe(200);

    await montiere("/start");
    await bis(() => Boolean(q(document, "kopfband-zahnrad")), 160);
    await klick(q(document, "kopfband-zahnrad"));
    await bis(() => Boolean(q(document, "zahnrad-persoenlich")));
    await klick(q(document, "zahnrad-persoenlich"));
    await bis(() => (q(document, "zeile-assistenz")?.textContent ?? "").includes("Mia"), 160);
    const zeileKlara = q(document, "zeile-assistenz");
    expect(zeileKlara?.textContent).toContain("Klara");
    expect(zeileKlara?.textContent).toContain("Mia");
    await klick(zeileKlara?.querySelector("button") ?? zeileKlara);
    await bis(() => Boolean(q(document, "detail-assistenz")), 160);
    const karte = q(document, "detail-assistenz") as HTMLElement;
    expect(karte.querySelector('[data-einst="detailtitel"]')?.textContent).toBe("Klara");

    // Alle Gruppen des Bestands, jede als benannter Abschnitt mit Überschrift.
    const gruppen = [
      ["klara-setup-erscheinung", "Name und Erscheinung"],
      ["klara-setup-unterstuetzung", "Unterstützung"],
      ["klara-setup-faehigkeiten", "Fähigkeiten"],
      ["klara-setup-sprachausgabe", "Sprachausgabe"],
      ["klara-setup-tastenkuerzel", "Tastenkürzel"],
      ["klara-setup-organisation", "Vorgaben der Organisation"],
      ["klara-setup-browser", "Klara im Browser"],
      ["klara-setup-word", "Klara in Word"],
    ] as const;
    for (const [id, titel] of gruppen) {
      const g = q(karte, id);
      expect(g, id).not.toBeNull();
      const h = g?.querySelector("h2");
      expect(h?.textContent, id).toBe(titel);
      expect(g?.getAttribute("aria-labelledby"), id).toBe(h?.id);
    }

    // Vorhandene Werte stehen da.
    await bis(() => Boolean(q<HTMLInputElement>(karte, "assistenz-name")));
    expect(q<HTMLInputElement>(karte, "assistenz-name")?.value).toBe("Mia");
    await bis(() => q(karte, "klara-eigeninitiative")?.getAttribute("data-modus") === "hinweise");
    expect(q(karte, "klara-eigeninitiative")?.getAttribute("data-modus")).toBe("hinweise");
    await bis(() => Boolean(q(karte, "klara-setup-hinweis")));
    expect(q(karte, "klara-setup-hinweis")?.textContent).toContain("Seitenerklärung");
    expect(q(karte, "klara-setup-hinweise")?.textContent).toContain(
      "Hinweise legst du direkt am Hinweis neben der Figur ab.",
    );
    expect(q(karte, "klara-setup-sprachausgabe")?.textContent).toContain(
      "Gilt nur für diesen Browser",
    );

    // Speichern in einer bestehenden Gruppe über ihren bisherigen Weg …
    const radio = karte.querySelector<HTMLInputElement>(
      '[data-testid="klara-eigeninitiative-auftraege"] input',
    );
    await klick(radio);
    await bis(() => q(karte, "klara-eigeninitiative")?.getAttribute("data-modus") === "auftraege");
    const modus = await draht("GET", "/api/me/assistenz/eigeninitiative", adaCookie);
    expect((modus.body as { modus: string }).modus).toBe("auftraege");
    // … und eine Fehlerrückmeldung ohne vorgetäuschtes Speichern.
    stoerung = { methode: "PUT", pfad: "/api/me/assistenz/eigeninitiative" };
    const nachfrage = '[data-testid="klara-eigeninitiative-nachfrage"] input';
    await klick(karte.querySelector<HTMLInputElement>(nachfrage));
    await bis(() => (q(karte, "klara-eigeninitiative-stand")?.textContent ?? "").length > 0);
    await bis(
      () =>
        !(q(karte, "klara-eigeninitiative-stand")?.textContent ?? "").includes("Wird gespeichert"),
    );
    expect(q(karte, "klara-eigeninitiative")?.getAttribute("data-modus")).toBe("auftraege");
    const nachFehler = await draht("GET", "/api/me/assistenz/eigeninitiative", adaCookie);
    expect((nachFehler.body as { modus: string }).modus).toBe("auftraege");

    // Getrennte Hosts mit klarer Zuständigkeit und direktem Zugang.
    expect(q(karte, "klara-setup-browser")?.textContent).toContain("chrome://extensions/shortcuts");
    expect(q(karte, "klara-setup-word")?.textContent).toContain("Word › Klara › Zahnrad");
    // Rollenregel: Ada ist admin und sieht den Weg in die Verwaltung.
    expect(q(karte, "klara-setup-verwaltung")?.getAttribute("href")).toBe("/admin");

    // „Tastenkürzel“ ist sichtbar, verbunden mit der Kürzelliste, mit tatsächlichem Geltungsbereich.
    await zumBereich();
    const geltung = q(karte, "klara-kuerzel-geltung")?.textContent ?? "";
    expect(geltung).toContain("in Klarwerk, solange das Klarwerk-Fenster aktiv ist");
    expect(geltung).toContain("für später vorgemerkt");
    expect(karte.textContent).not.toMatch(/systemweit (verfügbar|aktiv)|in allen Programmen/);
    for (const aktion of [
      "oeffnen",
      "seitenhilfe",
      "diktieren",
      "auftragSprechen",
      "aufnahmeStoppen",
      "vorlesenStoppen",
    ]) {
      expect(zeile(aktion).dataset.quelle, aktion).toBe("standard");
      expect(q(zeile(aktion), "klara-kuerzel-wert")?.textContent, aktion).toContain("Nicht belegt");
    }
    // Beschriftung mit Aktionsnamen für Screenreader.
    expect(inZeile("oeffnen", "klara-kuerzel-festlegen")?.getAttribute("aria-label")).toBe(
      "Kürzel für „Klara öffnen“ festlegen",
    );
  });
});

describe("B2 · Festlegen, Abbrechen, Konflikte, Ausführen, Ändern, Entfernen, Speicherfehler", () => {
  it("jede Betätigung genau eine Aktion; alte Belegung wirkungslos; nichts vorgetäuscht", async () => {
    await montiere("/profil?bereich=klara");
    await zumBereich();

    // Abbrechen mit Escape: bisherige Belegung bleibt, Fokus zurück am Auslöser.
    let feld = await aufnahmeStarten("oeffnen");
    expect(q(document, "klara-kuerzel-aufnahme")?.getAttribute("aria-describedby")).toBeTruthy();
    await druecke(feld, { code: "Escape", key: "Escape" });
    expect(meldung()?.textContent).toBe("Abgebrochen – es bleibt bei der bisherigen Belegung.");
    expect(document.activeElement).toBe(inZeile("oeffnen", "klara-kuerzel-festlegen"));
    expect(zeile("oeffnen").dataset.quelle).toBe("standard");
    expect(kuerzelPuts()).toBe(0);

    // Der ungeprüfte Kandidat Control+Command+K kollidiert mit der Befehlspalette.
    feld = await aufnahmeStarten("oeffnen");
    await druecke(feld, { code: "KeyK", key: "k", strg: true, meta: true });
    expect(meldung()?.getAttribute("role")).toBe("alert");
    expect(meldung()?.textContent).toContain("öffnet bereits die Befehlspalette");
    expect(meldung()?.textContent).toContain("Es bleibt bei der bisherigen Belegung.");
    expect(document.querySelector('[data-cmd="suchfeld"]'), "Palette ging mit auf").toBeNull();
    expect(kuerzelPuts()).toBe(0);

    // Nur Zusatztasten: die Aufnahme wartet und erklärt.
    feld = await aufnahmeStarten("oeffnen");
    await druecke(feld, { code: "ShiftLeft", key: "Shift", umschalt: true });
    expect(q(document, "klara-kuerzel-aufnahme")).not.toBeNull();
    expect(zeile("oeffnen").textContent).toContain("Halte die Zusatztasten");
    // Während der Aufnahme löst kein Kürzel aus — auch nicht über die Hülle.
    expect(ausgeloest).toEqual([]);
    // Festlegen: die tatsächlich gedrückte Kombination, gespeichert erst nach Serverantwort.
    const vorher = kuerzelPuts();
    await druecke(feld, STRG_UMSCHALT_E);
    await bis(() => zeile("oeffnen").dataset.quelle === "eigen", 120);
    expect(kuerzelPuts()).toBe(vorher + 1);
    expect(meldung()?.textContent).toBe("Gespeichert: „Klara öffnen“ mit Strg+Umschalt+E.");
    expect(q(zeile("oeffnen"), "klara-kuerzel-wert")?.textContent).toContain("Strg+Umschalt+E");
    expect(q(zeile("oeffnen"), "klara-kuerzel-anzeige")?.getAttribute("title")).toBe(
      "Strg + Umschalt + E",
    );
    expect((await amServer(adaCookie, "oeffnen"))?.belegung).toMatchObject({
      code: "KeyE",
      strg: true,
      umschalt: true,
      alt: false,
      meta: false,
    });
    expect(document.activeElement).toBe(inZeile("oeffnen", "klara-kuerzel-festlegen"));
    expect(inZeile("oeffnen", "klara-kuerzel-festlegen")?.textContent).toBe("Ändern");

    // Doppelbelegung: dieselbe Kombination für „Diktieren“ — konkrete Meldung, nichts gespeichert,
    // und die Aufnahme hat dabei „Klara öffnen“ NICHT ausgelöst.
    const putsVorDoppel = kuerzelPuts();
    feld = await aufnahmeStarten("diktieren");
    await druecke(feld, STRG_UMSCHALT_E);
    expect(meldung()?.textContent).toContain("ist schon „Klara öffnen“ zugeordnet");
    expect(kuerzelPuts()).toBe(putsVorDoppel);
    expect(zeile("diktieren").dataset.quelle).toBe("standard");
    expect(ausgeloest).toEqual([]);
    expect(q(document, "klara-gespraech")).toBeNull();

    // Ausführen: eine Betätigung, eine Aktion — Klara öffnet.
    await druecke(document.body, STRG_UMSCHALT_E);
    expect(ausgeloest).toEqual(["oeffnen"]);
    await bis(() => Boolean(q(document, "klara-gespraech")), 120);
    expect(q(document, "klara-gespraech")).not.toBeNull();
    // Texteingabe bleibt normal: Buchstaben ohne Befehlstaste lösen nichts aus.
    const eingabe = q<HTMLInputElement>(document, "klara-eingabe") as HTMLInputElement;
    await tippe(eingabe, "Entwurf bleibt");
    await druecke(eingabe, { code: "KeyE", key: "e" });
    await druecke(eingabe, { code: "KeyE", key: "E", umschalt: true });
    expect(ausgeloest).toEqual(["oeffnen"]);
    // Idempotent: erneut auslösen holt dieselbe Fläche nach vorn — keine zweite, Eingabe bleibt.
    await druecke(eingabe, STRG_UMSCHALT_E);
    expect(ausgeloest).toEqual(["oeffnen", "oeffnen"]);
    expect(document.querySelectorAll('[data-testid="klara-gespraech"]')).toHaveLength(1);
    expect(q<HTMLInputElement>(document, "klara-eingabe")?.value).toBe("Entwurf bleibt");
    // Gedrückt gehalten (Wiederholung) ist keine neue Betätigung.
    await druecke(document.body, { ...STRG_UMSCHALT_E, repeat: true });
    expect(ausgeloest).toEqual(["oeffnen", "oeffnen"]);
    // Ein Editor, der die Kombination selbst behandelt, geht vor.
    const editor = document.createElement("div");
    editor.setAttribute("contenteditable", "true");
    editor.addEventListener("keydown", (e) => e.preventDefault());
    document.body.appendChild(editor);
    await druecke(editor, STRG_UMSCHALT_E);
    expect(ausgeloest).toEqual(["oeffnen", "oeffnen"]);
    editor.remove();
    // Ein offener Dialog (Befehlspalette) sperrt die Kürzel.
    await act(async () => {
      window.dispatchEvent(new Event("open-command-palette"));
    });
    await bis(() => Boolean(document.querySelector('[data-cmd="suchfeld"]')));
    expect(document.querySelector('[data-cmd="suchfeld"]')).not.toBeNull();
    await druecke(document.body, STRG_UMSCHALT_E);
    expect(ausgeloest).toEqual(["oeffnen", "oeffnen"]);
    await druecke(document.querySelector('[data-cmd="suchfeld"]') as Element, {
      code: "Escape",
      key: "Escape",
    });
    await bis(() => !document.querySelector('[data-cmd="suchfeld"]'));

    // Ändern: die neue Belegung wirkt sofort, die alte nicht mehr.
    await belegen("oeffnen", STRG_UMSCHALT_U);
    expect(meldung()?.textContent).toBe("Gespeichert: „Klara öffnen“ mit Strg+Umschalt+U.");
    ausgeloest = [];
    await druecke(document.body, STRG_UMSCHALT_E);
    expect(ausgeloest).toEqual([]);
    await druecke(document.body, STRG_UMSCHALT_U);
    expect(ausgeloest).toEqual(["oeffnen"]);

    // Speicherfehler: nichts vorgetäuscht — sichtbarer Fehler, bisherige Belegung gilt weiter.
    stoerung = { methode: "PUT", pfad: BASIS };
    feld = await aufnahmeStarten("oeffnen");
    await druecke(feld, { code: "KeyX", key: "X", strg: true, umschalt: true });
    await bis(() => meldung()?.dataset.fehler === "true", 120);
    expect(meldung()?.getAttribute("role")).toBe("alert");
    expect(meldung()?.textContent).toBe(
      "Nicht gespeichert – die Verbindung zum Server ist gestört. Es gilt weiter die bisherige Belegung.",
    );
    expect(q(zeile("oeffnen"), "klara-kuerzel-wert")?.textContent).toContain("Strg+Umschalt+U");
    expect((await amServer(adaCookie, "oeffnen"))?.belegung).toMatchObject({ code: "KeyU" });
    ausgeloest = [];
    await druecke(document.body, { code: "KeyX", key: "X", strg: true, umschalt: true });
    expect(ausgeloest).toEqual([]);
    await druecke(document.body, STRG_UMSCHALT_U);
    expect(ausgeloest).toEqual(["oeffnen"]);

    // Entfernen: danach löst die Kombination nichts mehr aus.
    await klick(inZeile("oeffnen", "klara-kuerzel-entfernen"));
    await bis(() => zeile("oeffnen").dataset.quelle === "entfernt", 120);
    expect(meldung()?.textContent).toBe("Entfernt: „Klara öffnen“ hat kein Kürzel mehr.");
    expect(document.activeElement).toBe(inZeile("oeffnen", "klara-kuerzel-festlegen"));
    ausgeloest = [];
    await druecke(document.body, STRG_UMSCHALT_U);
    expect(ausgeloest).toEqual([]);
  });
});

describe("B3 · Neuladen, Standard, Diktat und Aufnahme über den vorhandenen Weg", () => {
  it("nach Neuladen wirksam; entfernt bleibt entfernt; Reset; Diktat/Aufnahme ohne Senden", async () => {
    // Stand wie aus einer früheren Sitzung: eigene Belegungen und ein entferntes Kürzel.
    const kombi = (code: string, taste: string) => ({
      code,
      taste,
      strg: true,
      alt: false,
      umschalt: true,
      meta: false,
    });
    for (const [aktion, belegung] of [
      ["diktieren", kombi("KeyX", "X")],
      ["auftragSprechen", kombi("KeyU", "U")],
      ["aufnahmeStoppen", kombi("Digit8", "8")],
      ["seitenhilfe", kombi("KeyE", "E")],
      ["oeffnen", null],
    ] as const) {
      const r = await draht("PUT", BASIS, adaCookie, { aktion, belegung });
      expect(r.status, aktion).toBe(200);
    }
    await montiere("/profil?bereich=klara");
    await zumBereich();
    expect(zeile("oeffnen").dataset.quelle).toBe("entfernt");
    expect(q(zeile("oeffnen"), "klara-kuerzel-wert")?.textContent).toContain("Nicht belegt");
    expect(zeile("diktieren").dataset.quelle).toBe("eigen");
    // Mit Spracherkennung keine Voraussetzungs-Warnung.
    expect(q(zeile("diktieren"), "klara-kuerzel-voraussetzung")).toBeNull();

    // Seitenhilfe über ihr Kürzel — dieselbe Fläche wie der ?-Knopf.
    await druecke(document.body, { code: "KeyE", key: "E", strg: true, umschalt: true });
    expect(ausgeloest).toEqual(["seitenhilfe"]);
    await bis(() => Boolean(document.querySelector('section[data-klara="1"][aria-label]')));
    expect(document.querySelector('section[data-klara="1"][aria-label]')).not.toBeNull();

    // Diktieren: öffnet Klara (die Seitenhilfe schliesst — nie zwei Flächen) und startet das
    // vorhandene Diktat ins Eingabefeld. Gesendet wird nichts.
    const fragenVorher = anfragen.filter((a) => a.pfad === "/api/ask").length;
    await druecke(document.body, { code: "KeyX", key: "X", strg: true, umschalt: true });
    await bis(() => Boolean(q(document, "klara-aufnahme-laeuft")), 120);
    expect(q(document, "klara-gespraech")).not.toBeNull();
    expect(q(document, "klara-aufnahme-laeuft")?.getAttribute("data-art")).toBe("diktat");
    expect(RekorderDoppel.letzter?.gestartet).toBe(1);
    await act(async () => {
      RekorderDoppel.letzter?.hoert("Hallo aus dem Diktat");
    });
    await ruhe(5);
    expect(q<HTMLInputElement>(document, "klara-eingabe")?.value).toContain("Hallo aus dem Diktat");
    // Noch einmal „Diktieren“ während es läuft: kein zweiter Rekorder.
    await druecke(document.body, { code: "KeyX", key: "X", strg: true, umschalt: true });
    expect(RekorderDoppel.alle).toBe(1);
    // „Aufnahme stoppen“ über sein Kürzel beendet über den vorhandenen Stopp.
    await druecke(document.body, { code: "Digit8", key: "*", strg: true, umschalt: true });
    await bis(() => !q(document, "klara-aufnahme-laeuft"));
    expect(RekorderDoppel.letzter?.gestoppt).toBe(1);
    // „Auftrag sprechen“ (Aufnahme): die vorhandene Karte entsteht erst nach dem Sprechen.
    await druecke(document.body, { code: "KeyU", key: "U", strg: true, umschalt: true });
    await bis(() => q(document, "klara-aufnahme-laeuft")?.getAttribute("data-art") === "auftrag");
    expect(q(document, "klara-aufnahme-laeuft")?.getAttribute("data-art")).toBe("auftrag");
    // Die Mikrofonfreigabe bleibt beim Browser: eine Ablehnung wird ehrlich gemeldet.
    await act(async () => {
      RekorderDoppel.letzter?.onerror?.({ error: "not-allowed" });
      RekorderDoppel.letzter?.onend?.();
    });
    await bis(() => Boolean(q(document, "klara-sprache-hinweis")));
    expect(q(document, "klara-sprache-hinweis")).not.toBeNull();
    expect(anfragen.filter((a) => a.pfad === "/api/ask").length).toBe(fragenVorher);
    expect(ausgeloest).toEqual([
      "seitenhilfe",
      "diktieren",
      "diktieren",
      "aufnahmeStoppen",
      "auftragSprechen",
    ]);

    // Eine Aktion auf Standard, dann alle auf Standard — die definierten Standards sind „unbelegt“.
    await klick(inZeile("oeffnen", "klara-kuerzel-standard"));
    await bis(() => zeile("oeffnen").dataset.quelle === "standard", 120);
    expect(meldung()?.textContent).toBe(
      "„Klara öffnen“ ist wieder auf dem Standard: Nicht belegt.",
    );
    await klick(q(document, "klara-kuerzel-alle-standard"));
    await bis(() => zeile("diktieren").dataset.quelle === "standard", 120);
    expect(meldung()?.textContent).toBe("Alle Kürzel sind wieder auf dem Standard.");
    for (const aktion of ["seitenhilfe", "diktieren", "auftragSprechen", "aufnahmeStoppen"]) {
      expect(zeile(aktion).dataset.quelle, aktion).toBe("standard");
      expect((await amServer(adaCookie, aktion))?.quelle, aktion).toBe("standard");
    }
    ausgeloest = [];
    await druecke(document.body, { code: "KeyX", key: "X", strg: true, umschalt: true });
    expect(ausgeloest).toEqual([]);

    // Neuladen nach einer Änderung im Setup: dieselbe Belegung steht da und wirkt.
    await belegen("oeffnen", STRG_UMSCHALT_U);
    await neuLaden("/profil?bereich=klara");
    await zumBereich();
    expect(zeile("oeffnen").dataset.quelle).toBe("eigen");
    expect(q(zeile("oeffnen"), "klara-kuerzel-wert")?.textContent).toContain("Strg+Umschalt+U");
    ausgeloest = [];
    await druecke(document.body, STRG_UMSCHALT_U);
    expect(ausgeloest).toEqual(["oeffnen"]);
    await bis(() => Boolean(q(document, "klara-gespraech")), 120);
    expect(q(document, "klara-gespraech")).not.toBeNull();
  });
});

describe("B4 · Rollen und Konten", () => {
  it("Wanda (Leserolle) sieht ihre eigenen Standards und keinen Verwaltungsverweis", async () => {
    const belegung = { code: "KeyU", taste: "U", strg: true, alt: false, umschalt: true };
    const r = await draht("PUT", BASIS, adaCookie, {
      aktion: "oeffnen",
      belegung: { ...belegung, meta: false },
    });
    expect(r.status).toBe(200);
    cookie = wandaCookie;
    await montiere("/profil?bereich=klara");
    await zumBereich();
    expect(zeile("oeffnen").dataset.quelle).toBe("standard");
    expect(q(document, "klara-setup-verwaltung")).toBeNull();
    expect(q(document, "klara-setup-organisation")?.textContent).toContain("nicht änderbar");
    await druecke(document.body, STRG_UMSCHALT_U);
    expect(ausgeloest).toEqual([]);
    // Wanda legt ihre eigene Belegung fest; Adas bleibt unberührt.
    await belegen("oeffnen", STRG_UMSCHALT_E);
    expect((await amServer(wandaCookie, "oeffnen"))?.belegung).toMatchObject({ code: "KeyE" });
    expect((await amServer(adaCookie, "oeffnen"))?.belegung).toMatchObject({ code: "KeyU" });
  });
});
