// @vitest-environment jsdom
// ================================================================================================
// produkt:20261015:klara-powerpoint-validierung (PP-03) · DER NUTZERWEG AM PPTX-ANHANG, MIT ECHTEM SERVER.
// ================================================================================================
//
// Gemountet sind die ECHTE Fläche `FolienDaten` (dieselbe, die `OfficeImArtikel` am PowerPoint-Anhang
// zeigt, Host H04) und die ECHTE Gruppe `KlaraDatenkontrolleGruppe` aus Setup › Klara. Der Server ist
// echt (`buildApp(buildServices())`, In-Memory) mit echter `.pptx`; ersetzt ist nur der Transport
// (`fetch` → `app.inject`, wie `tests/klara-bildanalyse-ocr/setup-schalter-mounted.test.tsx`).
// Fiktiver Bestand aus `pp03-pruefdeck.ts`.
//
//   F1  An der Zahl steht der Zustand der Kontrolle (falsche Summe → Klärungsbedarf), nicht der
//       bloße PP-02-Prüfstand; die Datenlage über der Folienliste nennt den Punkt, ein Klick öffnet
//       die Prüfdetails mit Grund und Rechnung — ohne zweite, widersprechende Statusliste.
//   F2  Korrektur in der Fläche: fehlender Bezugszeitraum ergänzt → die Klärung entfällt an der
//       Zahl, im Detailbereich und in der Datenlage; die Korrektur steht in der Historie.
//   F3  Setup › Klara: „nur Klärungen einzeln“ wird am Server gespeichert und wirkt in der Datenlage;
//       Zählung und Zustände bleiben gleich, offene Prüfungen lassen sich einblenden.
//   F5  UI-VORPROBE R13: ein Einstieg aus der Datenlage zu einer schon offenen Zahl setzt den Fokus
//       erneut auf die Herkunft; R14: dort stehen die Prüfdetails ohne zweite Überschrift.
//   F6  UI-VORPROBE R15: nach einer Korrektur sagt eine von Anfang an vorhandene Live-Region den
//       neuen Zustand an.
//   F4  Ein Neuabruf derselben Datenfassung (z. B. beim Fensterfokus) — die Kontrolle trägt dann eine
//       neue Berechnungszeit — nimmt dem Korrekturfeld nicht den Fokus (UI-04/05, Risiko R5 der
//       UI-Vorbereitung).
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import type { FastifyInstance } from "fastify";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { FolienDaten } from "../../apps/web/src/components/bibliothek/FolienDaten";
import { KlaraDatenkontrolleGruppe } from "../../apps/web/src/components/klara-setup/KlaraSetup";
import i18n from "../../apps/web/src/i18n";
import {
  ladeAssistenzProfil,
  verwerfeAssistenzProfil,
} from "../../apps/web/src/lib/assistenzProfil";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";
import { PPTX, pruefdeck } from "./pp03-pruefdeck";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ADA = { name: "Ada Fiktiv", email: "ada@pp03-anschluss.test", password: "ada-geheim-1" };

let services: AppServices;
let app: FastifyInstance | null = null;
let cookie: string | null = null;
let ada = { id: "", cookie: "" };
let vorherigerFetch: typeof globalThis.fetch;
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

async function draht(methode: "GET" | "POST", url: string, payload?: unknown) {
  const r = await (app as FastifyInstance).inject({
    method: methode,
    url,
    headers: { cookie: ada.cookie },
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });
  return {
    status: r.statusCode,
    body: r.body === "" ? null : (r.json() as Record<string, unknown>),
  };
}

const ids: Record<string, string> = {};
let koId = "";
let anhangId = "";

async function vorrichtung(): Promise<void> {
  services = buildServices();
  app = buildApp(services);
  await app.ready();
  const a = await app.inject({ method: "POST", url: "/api/auth/register", payload: ADA });
  expect(a.statusCode, "Ersteinrichtung (Ada)").toBe(201);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ADA.email, password: ADA.password },
  });
  expect(login.statusCode, login.body).toBe(200);
  ada = {
    id: (a.json() as { id: string }).id,
    cookie: `kw_session=${(login.json() as { token: string }).token}`,
  };
  expect((await draht("POST", "/api/auth/notice")).status).toBeLessThan(300);

  // Der Artikel mit dem PowerPoint-Anhang — über den echten Wissensobjekt- und Objektdienst.
  const bytes = await pruefdeck();
  const ref = await services.objects.put({
    name: "Kennzahlen.pptx",
    mime: PPTX,
    data: `data:${PPTX};base64,${bytes.toString("base64")}`,
    purpose: "attachment",
  });
  const ko = await services.ko.create({
    title: "Kennzahlen Q4 2025 (fiktiv)",
    statement: "Fiktive Kennzahlen mit Präsentation.",
    type: "best_practice",
    category: "Testbestand",
    author: ada.id,
    confidentiality: "intern",
  });
  const mit = await services.ko.addAttachment(ko.id, ada.id, {
    name: "Kennzahlen.pptx",
    mime: PPTX,
    objectId: ref.id,
    size: ref.size,
  });
  koId = ko.id;
  anhangId = mit.attachments?.[0]?.id ?? "";

  const ort = (shapeId: string, zeile?: number, spalte?: number) => ({
    anhangId,
    sldId: "256",
    shapeId,
    ...(zeile === undefined ? {} : { zeile, spalte }),
  });
  const erfasse = async (auftrag: Record<string, unknown>) => {
    const r = await draht("POST", `/api/kos/${koId}/datenpunkte`, auftrag);
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    return String(r.body?.id);
  };
  ids.summeFalsch = await erfasse({
    art: "zahl",
    wert: "1.100 T€",
    einheit: "T€",
    zeitraum: "Q4 2025",
    bezugsgroesse: "Umsatz Konzern",
    erfassung: "direkt",
    ort: ort("4", 4, 2),
  });
  ids.ohneZeitraum = await erfasse({
    art: "zahl",
    wert: "12 %",
    einheit: "%",
    bezugsgroesse: "Markt DACH",
    erfassung: "direkt",
    ort: ort("8"),
  });
  ids.kosten = await erfasse({
    art: "zahl",
    wert: "500 T€",
    einheit: "T€",
    zeitraum: "Q4 2025",
    bezugsgroesse: "Kosten Konzern",
    erfassung: "direkt",
    ort: ort("5", 4, 2),
  });
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;
let qc: QueryClient | null = null;

async function abwarten(): Promise<void> {
  for (let i = 0; i < 15; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
  }
}

/** „Seite laden“: Profil des Kontos gelesen, Setup-Gruppe und Fläche am Anhang montiert. */
async function laden(): Promise<void> {
  if (root) {
    const alt = root;
    act(() => alt.unmount());
  }
  verwerfeAssistenzProfil();
  cookie = ada.cookie;
  const neu = createRoot(container);
  root = neu;
  await act(async () => {
    await ladeAssistenzProfil(ada.id);
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc = client;
  await act(async () => {
    neu.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          MemoryRouter,
          null,
          createElement(KlaraDatenkontrolleGruppe),
          createElement(FolienDaten, { koId, anhangId }),
        ),
      ),
    );
  });
  await abwarten();
}

const el = (sel: string): HTMLElement | null => container.querySelector<HTMLElement>(sel);
const zahl = (id: string) => el(`button[data-datenpunkt="${id}"]`);
const lagePunkte = () =>
  [...container.querySelectorAll<HTMLElement>("[data-datenlage] [data-offener-punkt]")].map(
    (p) => `${p.dataset.offenerPunkt}:${p.dataset.dimension}:${p.dataset.stand}`,
  );

async function klick(e: HTMLElement | null): Promise<void> {
  expect(e).toBeTruthy();
  await act(async () => {
    e?.click();
  });
  await abwarten();
}

async function tippen(e: HTMLInputElement | null, text: string): Promise<void> {
  expect(e).toBeTruthy();
  const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set as (
    v: string,
  ) => void;
  await act(async () => {
    setzer.call(e, text);
    e?.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeAll(() => {
  drahtAufbauen();
});

afterAll(() => {
  globalThis.fetch = vorherigerFetch;
});

beforeEach(async () => {
  await i18n.changeLanguage("de");
  anfragen.length = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
  await vorrichtung();
});

afterEach(async () => {
  if (root) {
    const alt = root;
    act(() => alt.unmount());
    root = null;
  }
  container.remove();
  verwerfeAssistenzProfil();
  await app?.close();
  app = null;
  cookie = null;
});

describe("PP-03 · Nutzerweg am PowerPoint-Anhang mit echtem Server", () => {
  it("F1 · Zustand der Kontrolle an der Zahl, Datenlage mit Einstieg in die Prüfdetails", async () => {
    await laden();
    const falsch = zahl(ids.summeFalsch ?? "");
    expect(falsch?.dataset.zustand).toBe("klaerung");
    expect(falsch?.getAttribute("aria-label")).toContain("Klärungsbedarf");
    expect(zahl(ids.ohneZeitraum ?? "")?.dataset.zustand).toBe("klaerung");
    // Die Datenlage über der Folienliste — aus der Route, nicht aus der Fläche gerechnet.
    expect(el("[data-datenlage]")?.textContent).toContain("3 Datenpunkte");
    expect(lagePunkte()).toContain(`${ids.summeFalsch}:berechnung:klaerung`);
    expect(lagePunkte()).toContain(`${ids.ohneZeitraum}:struktur:klaerung`);
    expect(anfragen.some((a) => a.pfad.endsWith("/folien-daten"))).toBe(true);

    // Ein Klick auf den Punkt öffnet die Prüfdetails dieser Zahl im Detailbereich.
    await klick(
      el(
        `[data-datenlage] [data-offener-punkt="${ids.summeFalsch}"][data-dimension="berechnung"] button`,
      ),
    );
    const herkunft = el(`[data-herkunft="${ids.summeFalsch}"]`);
    expect(herkunft).toBeTruthy();
    expect(herkunft?.querySelector("[data-datenkontrolle]")).toBeTruthy();
    expect(
      herkunft?.querySelector("[data-herkunft-zustand]")?.getAttribute("data-herkunft-zustand"),
    ).toBe("klaerung");
    const befund = herkunft?.querySelector('[data-befund="berechnung.summe_falsch"]');
    expect(befund?.textContent).toContain("= 1.000");
    expect(befund?.textContent).toContain("1.100 T€");
    // Keine zweite Statusliste neben der Kontrolle (PP-02-Liste nur ohne Kontrolle).
    expect(herkunft?.querySelector("[data-herkunft-dimensionen]")).toBeNull();
  });

  it("F2 · Korrektur in der Fläche hebt die Klärung auf — an der Zahl, im Detail, in der Datenlage", async () => {
    await laden();
    await klick(zahl(ids.ohneZeitraum ?? ""));
    const herkunft = () => el(`[data-herkunft="${ids.ohneZeitraum}"]`);
    expect(herkunft()?.querySelector('[data-befund="struktur.zeitraum_fehlt"]')).toBeTruthy();

    await klick(herkunft()?.querySelector<HTMLElement>("[data-korrigieren-oeffnen]") ?? null);
    const formular = herkunft()?.querySelector<HTMLFormElement>("form[data-korrigieren]");
    expect(formular).toBeTruthy();
    await tippen(
      formular?.querySelector<HTMLInputElement>('input[id$="-zeitraum"]') ?? null,
      "2025",
    );
    await tippen(
      formular?.querySelector<HTMLInputElement>('input[id$="-grund"]') ?? null,
      "Zeitraum aus der Quelle ergänzt (fiktiv)",
    );
    await act(async () => {
      formular?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await abwarten();

    expect(
      anfragen.some(
        (a) => a.methode === "POST" && a.pfad === `/api/datenpunkte/${ids.ohneZeitraum}/korrektur`,
      ),
    ).toBe(true);
    expect(herkunft()?.querySelector('[data-befund="struktur.zeitraum_fehlt"]')).toBeNull();
    expect(
      herkunft()?.querySelector("[data-herkunft-zustand]")?.getAttribute("data-herkunft-zustand"),
    ).not.toBe("klaerung");
    expect(herkunft()?.querySelector('[data-korrektur="2"]')).toBeTruthy();
    expect(zahl(ids.ohneZeitraum ?? "")?.dataset.zustand).not.toBe("klaerung");
    expect(lagePunkte()).not.toContain(`${ids.ohneZeitraum}:struktur:klaerung`);
    // Am Server: neue Datenfassung, die Kontrolle gilt ihr.
    const amServer = await draht("GET", `/api/datenpunkte/${ids.ohneZeitraum}`);
    expect(amServer.body?.fassung).toBe(2);
    expect((amServer.body?.kontrolle as { datenFassung: number }).datenFassung).toBe(2);
  });

  it("F3 · Setup › Klara: Sichtbarkeit offener Datenpunkte, gespeichert und wirksam, ohne Prüfung zu umgehen", async () => {
    await laden();
    const alle = lagePunkte();
    const zaehlung = el("[data-datenlage] ul")?.textContent;
    expect(alle.some((p) => p.endsWith(":offen"))).toBe(true);
    const radio = (w: string) =>
      el(`[data-testid="klara-datenkontrolle-${w}"]`) as HTMLInputElement | null;
    expect(radio("alle")?.checked).toBe(true);

    await klick(radio("nur_klaerung"));
    expect(el('[data-testid="klara-datenkontrolle-meldung"]')?.textContent).toBe(
      i18n.t("datenkontrolle.setup.gespeichert"),
    );
    expect(anfragen.some((a) => a.methode === "PUT" && a.pfad === "/api/me/assistenz")).toBe(true);
    const profil = await draht("GET", "/api/me/assistenz");
    expect(
      (profil.body?.profil as { datenkontrolleOffenePunkte?: string }).datenkontrolleOffenePunkte,
    ).toBe("nur_klaerung");

    // Neu laden: die Wahl gilt; Klärungen stehen weiter einzeln da, offene Prüfungen als Zahl.
    await laden();
    expect(radio("nur_klaerung")?.checked).toBe(true);
    const verdichtet = lagePunkte();
    expect(verdichtet.every((p) => !p.endsWith(":offen"))).toBe(true);
    expect(verdichtet).toEqual(alle.filter((p) => !p.endsWith(":offen")));
    const zusammen = el("[data-offene-zusammengefasst]");
    expect(Number(zusammen?.dataset.offeneZusammengefasst)).toBe(alle.length - verdichtet.length);
    // Zählung und Zustand an der Zahl bleiben unverändert.
    expect(el("[data-datenlage] ul")?.textContent).toBe(zaehlung);
    expect(zahl(ids.summeFalsch ?? "")?.dataset.zustand).toBe("klaerung");

    await klick(el("[data-offene-einblenden]"));
    expect(lagePunkte()).toEqual(alle);
  });

  it("F4 · Neuabruf derselben Fassung nimmt dem Korrekturfeld nicht den Fokus", async () => {
    await laden();
    await klick(zahl(ids.ohneZeitraum ?? ""));
    const herkunft = () => el(`[data-herkunft="${ids.ohneZeitraum}"]`);
    await klick(herkunft()?.querySelector<HTMLElement>("[data-korrigieren-oeffnen]") ?? null);
    const feld = herkunft()?.querySelector<HTMLInputElement>('input[id$="-zeitraum"]') ?? null;
    expect(feld).toBeTruthy();
    await act(async () => {
      feld?.focus();
    });
    expect(document.activeElement).toBe(feld);
    const vorher = anfragen.filter((a) => a.pfad === `/api/datenpunkte/${ids.ohneZeitraum}`).length;
    // Neuabruf wie beim Fensterfokus: dieselbe Datenfassung, neue Berechnungszeit der Kontrolle.
    await act(async () => {
      await qc?.invalidateQueries();
    });
    await abwarten();
    const nachher = anfragen.filter(
      (a) => a.pfad === `/api/datenpunkte/${ids.ohneZeitraum}`,
    ).length;
    expect(nachher).toBeGreaterThan(vorher);
    expect(document.activeElement).toBe(feld);
  });

  it("F5 · R13 erneuter Einstieg setzt den Fokus, R14 Prüfdetails ohne zweite Überschrift", async () => {
    await laden();
    const punkt = () =>
      el(
        `[data-datenlage] [data-offener-punkt="${ids.summeFalsch}"][data-dimension="berechnung"] button`,
      );
    await klick(punkt());
    const herkunft = el(`[data-herkunft="${ids.summeFalsch}"]`);
    const kopf = herkunft?.querySelector("h6");
    expect(document.activeElement).toBe(kopf);
    // R14: im Detailbereich nur EINE h6 (der Wert); die Prüfdetails sind eine benannte Gruppe.
    expect(herkunft?.querySelectorAll("h6")).toHaveLength(1);
    expect(herkunft?.querySelector("[data-datenkontrolle]")?.getAttribute("role")).toBe("group");
    // Fokus woandershin, dann derselbe Einstieg noch einmal: der Fokus kehrt zur Herkunft zurück.
    await act(async () => {
      zahl(ids.kosten ?? "")?.focus();
    });
    expect(document.activeElement).not.toBe(kopf);
    await klick(punkt());
    expect(document.activeElement).toBe(el(`[data-herkunft="${ids.summeFalsch}"] h6`));
  });

  it.each(["Knopf", "Escape"])(
    "R18 · Schließen per %s gibt den Fokus an den Datenlage-Eintrag zurück",
    async (weg) => {
      await laden();
      const einstieg = el(
        `[data-datenlage] [data-offener-punkt="${ids.summeFalsch}"][data-dimension="berechnung"] button`,
      );
      await klick(einstieg);
      const herkunft = el(`[data-herkunft="${ids.summeFalsch}"]`);
      expect(document.activeElement).toBe(herkunft?.querySelector("h6"));
      if (weg === "Knopf") {
        await klick(herkunft?.querySelector<HTMLElement>("[data-herkunft-schliessen]") ?? null);
      } else {
        await act(async () => {
          herkunft?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        });
        await abwarten();
      }
      expect(el(`[data-herkunft="${ids.summeFalsch}"]`)).toBeNull();
      expect(document.activeElement).toBe(einstieg);
    },
  );

  it("R18 · Verschwindet der Datenlage-Einstieg nach dem Speichern, erhält die Zahl den Fokus", async () => {
    await laden();
    const einstieg = el(
      `[data-datenlage] [data-offener-punkt="${ids.ohneZeitraum}"][data-dimension="struktur"] button`,
    );
    await klick(einstieg);
    const herkunft = () => el(`[data-herkunft="${ids.ohneZeitraum}"]`);
    await klick(herkunft()?.querySelector<HTMLElement>("[data-korrigieren-oeffnen]") ?? null);
    const formular = herkunft()?.querySelector<HTMLFormElement>("form[data-korrigieren]");
    await tippen(
      formular?.querySelector<HTMLInputElement>('input[id$="-zeitraum"]') ?? null,
      "2025",
    );
    await tippen(
      formular?.querySelector<HTMLInputElement>('input[id$="-grund"]') ?? null,
      "Zeitraum ergänzt (fiktiv)",
    );
    await act(async () => {
      formular?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await abwarten();
    expect(einstieg?.isConnected).toBe(false);
    await klick(herkunft()?.querySelector<HTMLElement>("[data-herkunft-schliessen]") ?? null);
    expect(document.activeElement).toBe(zahl(ids.ohneZeitraum ?? ""));
  });

  it("F6 · R15 Live-Ansage des neuen Zustands nach der Korrektur", async () => {
    await laden();
    await klick(zahl(ids.ohneZeitraum ?? ""));
    const herkunft = () => el(`[data-herkunft="${ids.ohneZeitraum}"]`);
    const ansage = () => herkunft()?.querySelector("[data-herkunft-ansage]");
    expect(ansage()?.tagName).toBe("OUTPUT"); // implizite Rolle „status“
    expect(ansage()?.getAttribute("aria-live")).toBe("polite");
    expect(ansage()?.textContent).toBe("");
    await klick(herkunft()?.querySelector<HTMLElement>("[data-korrigieren-oeffnen]") ?? null);
    const formular = herkunft()?.querySelector<HTMLFormElement>("form[data-korrigieren]");
    await tippen(
      formular?.querySelector<HTMLInputElement>('input[id$="-zeitraum"]') ?? null,
      "2025",
    );
    await tippen(
      formular?.querySelector<HTMLInputElement>('input[id$="-grund"]') ?? null,
      "Zeitraum ergänzt (fiktiv)",
    );
    await act(async () => {
      formular?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await abwarten();
    const zustand = zahl(ids.ohneZeitraum ?? "")?.dataset.zustand ?? "";
    expect(ansage()?.textContent).toBe(
      i18n.t("datenkontrolle.ansage", {
        zustand: i18n.t(`praesentationdaten.zustand.${zustand}`),
        fassung: 2,
      }),
    );
    expect(ansage()?.textContent).toContain("Gespeichert");
  });
});
