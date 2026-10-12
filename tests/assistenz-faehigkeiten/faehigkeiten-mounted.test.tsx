// @vitest-environment jsdom
// ================================================================================================
// produkt:20261011:assistenz-skills-werkzeuge (BPA-11) · DIE FÄHIGKEITSOBERFLÄCHE AM ECHTEN SERVER.
// ================================================================================================
//
// Die ECHTE Komponente (`FaehigkeitenBereich` unter „Meine Assistenz") und der ECHTE Server
// (`buildApp(buildServices())`, In-Memory). Ersetzt ist allein der Transport (`fetch` →
// `app.inject`), wie in `tests/assistenz-profil/assistenz-mounted.test.tsx`. Eine Testfähigkeit mit
// Ersatzadapter wird über die Registry der laufenden Ausführung registriert (administrativer
// Schritt). Fiktives Konto.
//
//   M1  Antwortverlust NACH der Serverwirkung: die Oberfläche hält Kennung und Bindung fest, sperrt
//       Eingabe und neue Vorschau; „Stand abrufen" zeigt das gespeicherte Ergebnis — keine zweite
//       Wirkung.
//   M2  Antwortverlust, dann „Denselben Auftrag erneut senden": dieselbe Kennung, gespeichertes
//       Ergebnis, keine zweite Wirkung.
//   M3  Antwortverlust VOR dem Server: „Stand abrufen" meldet „nicht angekommen", erneutes Senden
//       führt genau einmal aus.
//   M4  Versionskonflikt (409): Vorschau verworfen, keine Wirkung, kein „unbekannter Ausgang".
//   M5  Bedienweg AC09: Favorit und bestätigte Routine per Klick speichern, nach erneutem Öffnen
//       wiederfinden, deaktivieren — der Serverstand folgt jedem Schritt.
//
// Den Bedienweg im echten Browser misst `tests-smoke/assistenz-faehigkeiten-browser.spec.ts`.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import type { FastifyInstance } from "fastify";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { FaehigkeitenBereich } from "../../apps/web/src/components/assistenz/FaehigkeitenBereich";
import "../../apps/web/src/i18n";
import type {
  AdapterAntwort,
  Faehigkeitsvertrag,
} from "../../services/app/src/assistenz-faehigkeiten";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";
import { bis, klick, q, ruhe, tippe } from "../fe003-tutorial-fragen/huelle";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ADA = { name: "Ada Fiktiv", email: "ada@faehigkeit-ui.test", password: "ada-geheim-1" };

const TESTSUCHE: Faehigkeitsvertrag = {
  id: "ui-testsuche",
  fassung: "1.0.0",
  name: "UI-Testsuche",
  beschreibung: "Synthetische Suche über den freigegebenen Wikimedia-Weg.",
  zwecke: ["ui_recherche"],
  datenempfaenger: {
    art: "extern",
    anbieter: "wikimedia",
    anbieterName: "Wikipedia (Wikimedia)",
    host: "wikipedia.org",
  },
  wirkung: "lesen",
  modell: false,
  aktionen: ["netz_anfrage_anbieter"],
  eingaben: [{ name: "suchbegriff", maxLaenge: 200, pflicht: true }],
  ergebnis: { art: "trefferliste", felder: ["titel", "url", "auszug"], quellenPflicht: true },
  hoechsteSchutzstufe: "oeffentlich",
  grenzen: { maxTreffer: 5, zeitlimitMs: 2_000, kostenJeAufrufCent: 0 },
  kostenzuordnung: null,
  credential: null,
  ruecknahme: "keine_wirkung",
  unterschritte: [],
  verantwortlich: "Testverantwortung",
};

const TREFFER: AdapterAntwort = {
  status: "ok",
  eintraege: [
    { titel: "Kreiselpumpe", url: "https://de.wikipedia.org/wiki/Kreiselpumpe", auszug: "x" },
  ],
};

let services: AppServices;
let app: FastifyInstance | null = null;
let cookie = "";
let aufrufe = 0;
let vorherigerFetch: typeof globalThis.fetch;
/**
 * `nach`: die Anfrage erreicht den Server (Wirkung tritt ein), die Antwort geht verloren.
 * `vor`: die Anfrage erreicht den Server nicht.
 */
let verlust: { pfad: string; wann: "vor" | "nach" } | null = null;
const anfragen: { methode: string; pfad: string; rumpf: string }[] = [];

function drahtAufbauen(): void {
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    if (!app) {
      throw new Error(`Draht ohne App: ${methode} ${url}`);
    }
    const pfad = url.split("?")[0] ?? url;
    const rumpf = init?.body !== undefined && init.body !== null ? String(init.body) : "";
    anfragen.push({ methode, pfad, rumpf });
    const stoerung = verlust && methode === "POST" && pfad === verlust.pfad ? verlust : null;
    if (stoerung?.wann === "vor") {
      verlust = null;
      throw new TypeError("Failed to fetch (Prüfstand: Verbindung vor dem Server getrennt)");
    }
    const kopf: Record<string, string> = {};
    new Headers(init?.headers).forEach((wert, name) => {
      kopf[name] = wert;
    });
    kopf.cookie = cookie;
    const antwort = await app.inject({
      method: methode as "GET",
      url,
      headers: kopf,
      ...(rumpf ? { payload: rumpf } : {}),
    });
    if (stoerung?.wann === "nach") {
      verlust = null;
      throw new TypeError("Failed to fetch (Prüfstand: Antwort nach dem Server verloren)");
    }
    return {
      status: antwort.statusCode,
      statusText: String(antwort.statusCode),
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      text: async () => antwort.body,
    };
  }) as unknown as typeof globalThis.fetch;
}

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

async function montiere(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(createElement(FaehigkeitenBereich));
  });
  await ruhe();
  await bis(() => Boolean(q(document, "faehigkeit-ui-testsuche")));
}

function abbauen(): void {
  if (root) {
    act(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
  }
}

const AUSFUEHREN_PFAD = "/api/me/faehigkeiten/auftraege";

function ausfuehrungen(): { auftragId: string }[] {
  return anfragen
    .filter((a) => a.methode === "POST" && a.pfad === AUSFUEHREN_PFAD)
    .map((a) => JSON.parse(a.rumpf) as { auftragId: string });
}

async function serverAuftraege(): Promise<{ auftragId: string; zustand: string }[]> {
  const r = await (app as FastifyInstance).inject({
    method: "GET",
    url: "/api/me/faehigkeiten/auftraege",
    headers: { cookie },
  });
  return (r.json() as { auftraege: { auftragId: string; zustand: string }[] }).auftraege;
}

/** Fähigkeit öffnen, Suchbegriff tippen, Vorschau holen — bis „Ausführen" bereitsteht. */
async function vorschauBereit(): Promise<void> {
  await klick(q(document, "faehigkeit-nutzen-ui-testsuche"));
  await bis(() => Boolean(q(document, "faehigkeit-feld-suchbegriff")));
  await tippe(
    q<HTMLInputElement>(document, "faehigkeit-feld-suchbegriff") as HTMLInputElement,
    "Kreiselpumpe",
  );
  await klick(q(document, "faehigkeit-vorschau"));
  await bis(() => Boolean(q(document, "faehigkeit-ausfuehren")));
  expect(q(document, "faehigkeit-ausfuehren")).toBeTruthy();
}

beforeAll(() => {
  drahtAufbauen();
});

afterAll(() => {
  globalThis.fetch = vorherigerFetch;
});

beforeEach(async () => {
  services = buildServices();
  app = buildApp(services);
  await app.ready();
  const a = await app.inject({ method: "POST", url: "/api/auth/register", payload: ADA });
  expect(a.statusCode).toBe(201);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ADA.email, password: ADA.password },
  });
  cookie = `kw_session=${(login.json() as { token: string }).token}`;
  aufrufe = 0;
  anfragen.length = 0;
  verlust = null;
  const registry = services.faehigkeiten?.registry;
  expect(registry).toBeDefined();
  registry?.registriere(TESTSUCHE);
  registry?.installiereAdapter({
    faehigkeitId: TESTSUCHE.id,
    fassung: TESTSUCHE.fassung,
    transport: "ersatz",
    fuehreAus: async () => {
      aufrufe += 1;
      return TREFFER;
    },
  });
  await montiere();
});

afterEach(async () => {
  abbauen();
  await app?.close();
  app = null;
});

describe("M1–M4 · Ausführung mit unbekanntem Ausgang behält die Auftragsidentität", () => {
  it("M1 · Antwort verloren nach der Wirkung → Stand abrufen zeigt das gespeicherte Ergebnis", async () => {
    await vorschauBereit();
    verlust = { pfad: AUSFUEHREN_PFAD, wann: "nach" };
    await klick(q(document, "faehigkeit-ausfuehren"));
    await bis(() => Boolean(q(document, "faehigkeit-ungewiss")));
    expect(aufrufe).toBe(1);
    // Identität bleibt: keine neue Vorschau, keine neue Eingabe, kein Ausführen-Knopf.
    expect(q<HTMLButtonElement>(document, "faehigkeit-vorschau")?.disabled).toBe(true);
    expect(q<HTMLInputElement>(document, "faehigkeit-feld-suchbegriff")?.disabled).toBe(true);
    expect(q(document, "faehigkeit-ausfuehren")).toBeNull();

    await klick(q(document, "faehigkeit-stand-abrufen"));
    await bis(() => Boolean(q(document, "faehigkeit-ergebnis")));
    expect(q(document, "faehigkeit-ergebnis")?.textContent).toContain("erfolgreich");
    expect(q(document, "faehigkeit-ungewiss")).toBeNull();
    expect(aufrufe).toBe(1);
    expect(await serverAuftraege()).toHaveLength(1);
  });

  it("M2 · Antwort verloren → denselben Auftrag erneut senden: gleiche Kennung, keine zweite Wirkung", async () => {
    await vorschauBereit();
    verlust = { pfad: AUSFUEHREN_PFAD, wann: "nach" };
    await klick(q(document, "faehigkeit-ausfuehren"));
    await bis(() => Boolean(q(document, "faehigkeit-ungewiss")));
    await klick(q(document, "faehigkeit-erneut-senden"));
    await bis(() => Boolean(q(document, "faehigkeit-ergebnis")));
    const gesendet = ausfuehrungen();
    expect(gesendet).toHaveLength(2);
    expect(gesendet[1]?.auftragId).toBe(gesendet[0]?.auftragId);
    expect(aufrufe).toBe(1);
    expect(await serverAuftraege()).toHaveLength(1);
  });

  it("M3 · Verbindung vor dem Server getrennt → nicht angekommen; erneut senden führt genau einmal aus", async () => {
    await vorschauBereit();
    verlust = { pfad: AUSFUEHREN_PFAD, wann: "vor" };
    await klick(q(document, "faehigkeit-ausfuehren"));
    await bis(() => Boolean(q(document, "faehigkeit-ungewiss")));
    expect(aufrufe).toBe(0);
    await klick(q(document, "faehigkeit-stand-abrufen"));
    await bis(() => Boolean(q(document, "faehigkeit-hinweis")));
    expect(q(document, "faehigkeit-hinweis")?.textContent).toContain("nicht angekommen");
    await klick(q(document, "faehigkeit-erneut-senden"));
    await bis(() => Boolean(q(document, "faehigkeit-ergebnis")));
    expect(aufrufe).toBe(1);
    const gesendet = ausfuehrungen();
    expect(gesendet[1]?.auftragId).toBe(gesendet[0]?.auftragId);
  });

  it("M4 · Versionskonflikt (409) verwirft die Vorschau ohne Wirkung", async () => {
    await vorschauBereit();
    // Vertrag nach der Vorschau geändert, Adapter derselben Fassung neu installiert: die Fähigkeit
    // bleibt verfügbar, aber die angezeigte Bindung stimmt nicht mehr → 409.
    const registry = services.faehigkeiten?.registry;
    registry?.registriere({ ...TESTSUCHE, grenzen: { ...TESTSUCHE.grenzen, maxTreffer: 4 } });
    registry?.installiereAdapter({
      faehigkeitId: TESTSUCHE.id,
      fassung: TESTSUCHE.fassung,
      transport: "ersatz",
      fuehreAus: async () => {
        aufrufe += 1;
        return TREFFER;
      },
    });
    let status409 = false;
    const vorher = globalThis.fetch;
    globalThis.fetch = (async (e: unknown, i?: RequestInit) => {
      const r = await vorher(e as RequestInfo, i);
      if (String(e).startsWith(AUSFUEHREN_PFAD) && r.status === 409) {
        status409 = true;
      }
      return r;
    }) as typeof globalThis.fetch;
    await klick(q(document, "faehigkeit-ausfuehren"));
    await bis(() => q(document, "faehigkeit-ausfuehren") === null);
    await ruhe();
    globalThis.fetch = vorher;
    expect(status409).toBe(true);
    expect(q(document, "faehigkeit-ungewiss")).toBeNull();
    expect(q<HTMLButtonElement>(document, "faehigkeit-vorschau")?.disabled).toBe(false);
    expect(aufrufe).toBe(0);
    expect(await serverAuftraege()).toEqual([]);
  });
});

describe("M5 · Bedienweg AC09: Favorit und bestätigte Routine speichern, wiederfinden, deaktivieren", () => {
  it("Klicks speichern am Server; nach erneutem Öffnen auffindbar; Deaktivieren wirkt", async () => {
    expect(q(document, "faehigkeiten-keine-vormerkungen")).toBeTruthy();
    await klick(q(document, "faehigkeit-favorit-ui-testsuche"));
    await bis(() => Boolean(q(document, "faehigkeit-vormerkung-ui-testsuche-favorit")));
    await klick(q(document, "faehigkeit-routine-ui-testsuche"));
    await bis(() => Boolean(q(document, "faehigkeit-vormerkung-ui-testsuche-routine")));

    // Wiederfinden: neu öffnen — der Stand kommt vom Server.
    abbauen();
    await montiere();
    await bis(() => Boolean(q(document, "faehigkeit-vormerkung-ui-testsuche-routine")));
    for (const art of ["favorit", "routine"]) {
      const zeile = q(document, `faehigkeit-vormerkung-ui-testsuche-${art}`);
      expect(zeile?.getAttribute("data-aktiv")).toBe("true");
      expect(zeile?.textContent).toContain("UI-Testsuche");
      expect(zeile?.textContent).toContain("Bereit.");
    }

    await klick(q(document, "faehigkeit-deaktivieren-ui-testsuche-routine"));
    await bis(
      () =>
        q(document, "faehigkeit-vormerkung-ui-testsuche-routine")?.getAttribute("data-aktiv") ===
        "false",
    );
    const r = await (app as FastifyInstance).inject({
      method: "GET",
      url: "/api/me/faehigkeiten",
      headers: { cookie },
    });
    const vm = (r.json() as { vormerkungen: { vormerkung: { art: string; aktiv: boolean } }[] })
      .vormerkungen;
    expect(vm.map((v) => [v.vormerkung.art, v.vormerkung.aktiv])).toEqual([
      ["favorit", false],
      ["routine", false],
    ]);
  });
});
