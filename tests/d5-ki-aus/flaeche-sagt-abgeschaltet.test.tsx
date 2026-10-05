// @vitest-environment jsdom
// ================================================================================================
// D5 · KI AUS — DIE FRAGEFLÄCHE SAGT „ABGESCHALTET", NICHT „NICHT VERFÜGBAR" (DE · EN · NL).
// ================================================================================================
//
// Die echte Ask-Seite (`apps/web/src/pages/Ask.tsx`) gegen die echte App im selben Prozess — über
// den Draht aus `kette.ts`, also mit denselben Routen, derselben Sitzung und demselben Server, die
// auch der Browser erreicht. Den Weg über PostgreSQL, Socket und Chromium misst
// `tests/d5-gesamtweg/ki-aus-pg-browser.integration.test.ts`; diese Datei läuft im Tor und hält
// die Fläche fest: die VORBEREITETE Seite (Antwort steht, Abschaltung kommt danach), die neue Frage
// auf der vorbereiteten Seite und die FRISCHE Seite in allen drei Sprachen — jeweils mit den
// Zählern an Retrieval-, Antwortweg- und Modellgrenze.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { type AppServices, buildServices } from "../../services/app/src/build-app";
import {
  type Aufbau,
  type Draht,
  FRAGE,
  adapterUmgebungSetzen,
  appAufbauen,
  drahtAufbauen,
  eintragMitOriginal,
  neuesKonto,
} from "../klara-quellen-nutzerweg/kette";
import {
  ALLE_GRENZEN,
  type Grenzen,
  differenz,
  frageAnfragenMarkieren,
  gelesen,
  grenzenZaehlen,
  zugriffsbefund,
} from "./zaehler";

adapterUmgebungSetzen();

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Ask } from "../../apps/web/src/pages/Ask";
import d5kiaus from "../../apps/web/src/texte/d5kiaus";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let draht: Draht;
let aufbau: Aufbau | null = null;
let grenzen: Grenzen | null = null;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const durchlaufen = async (): Promise<void> => {
  for (let i = 0; i < 40; i += 1) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

beforeAll(() => {
  draht = drahtAufbauen();
});

afterAll(async () => {
  draht.abbauen();
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  if (root) {
    act(() => root?.unmount());
    container.remove();
    root = null;
  }
  grenzen?.abbauen();
  grenzen = null;
  if (aufbau) {
    await aufbau.app.close();
    aufbau = null;
  }
  draht.setzeApp(null);
  draht.setzeCookie(null);
  draht.lage.generierungen = 0;
  draht.aufrufe.length = 0;
  await i18n.changeLanguage("de");
});

async function seiteOeffnen(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({
    // Wie im Betrieb: ein gelesener Status bleibt eine Weile gültig — genau deshalb weiss eine
    // schon offene Seite von der Abschaltung zunächst nichts (`apps/web/src/main.tsx`).
    defaultOptions: { queries: { retry: false, staleTime: 60_000 }, mutations: { retry: false } },
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
              createElement(MemoryRouter, { initialEntries: ["/fragen"] }, createElement(Ask)),
            ),
          ),
        ),
      ),
    );
    await durchlaufen();
  });
  await act(durchlaufen);
}

function sendeknopf(): HTMLButtonElement {
  const el = container.querySelector<HTMLButtonElement>("form button[type=submit]");
  expect(el, "kein Absendeknopf").not.toBeNull();
  return el as HTMLButtonElement;
}

async function absenden(text: string): Promise<void> {
  const eingabe = container.querySelector<HTMLInputElement>("form input") as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(eingabe, text);
    eingabe.dispatchEvent(new Event("input", { bubbles: true }));
    await durchlaufen();
  });
  await act(async () => {
    sendeknopf().click();
    await durchlaufen();
  });
  await act(durchlaufen);
}

async function vorrichtung(): Promise<{ aufbau: Aufbau; dienste: AppServices }> {
  let dienste: AppServices | undefined;
  // Die Zähler zählen nur im Kontext einer Frage-Anfrage — ohne die Markierung sähen sie nichts,
  // und jede Null unten wäre wertlos.
  const a = await appAufbauen(
    false,
    () => {
      dienste = buildServices();
      return dienste;
    },
    frageAnfragenMarkieren,
  );
  aufbau = a;
  draht.setzeApp(a.app);
  grenzen = grenzenZaehlen(dienste as AppServices, draht);
  await eintragMitOriginal(a.app, a.admin);
  const leser = await neuesKonto(a.app, "d5-kiaus-flaeche", a.admin);
  draht.setzeCookie(`kw_session=${leser.token}`);
  return { aufbau: a, dienste: dienste as AppServices };
}

async function kiAus(a: Aufbau): Promise<void> {
  const res = await a.app.inject({
    method: "PUT",
    url: "/api/reasoner/config",
    headers: a.admin.kopf,
    payload: { global: "deterministic" },
  });
  expect(res.statusCode, res.body).toBe(200);
}

function text(testid: string): string | null {
  const el = container.querySelector(`[data-testid="${testid}"]`);
  return el ? (el.textContent ?? "").trim() : null;
}

describe("D5 · KI aus — die Fragefläche", () => {
  it("F1 · vorbereitete Seite: dieselbe Frage erneut → die Antwort bleibt, darunter die Abschaltauskunft; null Zugriffe; danach gesperrt", async () => {
    const { aufbau: a } = await vorrichtung();
    await seiteOeffnen();
    const start = (grenzen as Grenzen).stand();
    await absenden(FRAGE);
    // KALIBRIERUNG: dieselben Zähler sehen die Frage der Fläche, solange die KI an ist.
    const d0 = differenz(start, (grenzen as Grenzen).stand());
    expect(
      gelesen(d0),
      "Kalibrierung: die Ablagen zählten die Frage der Fläche nicht",
    ).toBeGreaterThan(0);
    expect(
      d0.modell,
      "Kalibrierung: der Modelldraht zählte die Frage der Fläche nicht",
    ).toBeGreaterThan(0);
    expect(
      container.querySelector('[data-testid="ask-answer"]'),
      "Ausgangspunkt fehlt",
    ).not.toBeNull();

    await kiAus(a);
    const vorher = (grenzen as Grenzen).stand();
    expect(sendeknopf().disabled, "die vorbereitete Seite weiss schon von der Abschaltung").toBe(
      false,
    );
    await absenden(FRAGE);
    expect(
      zugriffsbefund(differenz(vorher, (grenzen as Grenzen).stand()), ALLE_GRENZEN),
      "die vorbereitete Seite hat nach der Abschaltung Kundeninhalt lesen lassen",
    ).toBe("");
    expect(text("ask-ki-abgeschaltet")).toBe(d5kiaus.de["d5kiaus.text"]);
    // Nach der Absage liest die Seite den Status neu: jetzt gesperrt, mit dem Hinweis.
    await act(durchlaufen);
    expect(sendeknopf().disabled, "nach der Absage bleibt der Knopf offen").toBe(true);
    expect(text("ask-ki-abgeschaltet-hinweis")).toBe(d5kiaus.de["d5kiaus.hinweis"]);
  });

  it('F2 · vorbereitete Seite, NEUE Frage: Absagekarte mit eigenem Wortlaut und ohne „Erneut versuchen"', async () => {
    const { aufbau: a } = await vorrichtung();
    await seiteOeffnen();
    await kiAus(a);
    const vorher = (grenzen as Grenzen).stand();
    await absenden("Welche Schrauben hat die XQ42?");
    expect(zugriffsbefund(differenz(vorher, (grenzen as Grenzen).stand()), ALLE_GRENZEN)).toBe("");
    expect(text("ask-ki-abgeschaltet")).toBe(
      `${d5kiaus.de["d5kiaus.titel"]}${d5kiaus.de["d5kiaus.text"]}`,
    );
    const karte = container.querySelector('[data-testid="ask-error"]');
    expect(karte?.textContent ?? "").not.toContain(i18n.t("ask.error.retry"));
    expect(karte?.textContent ?? "").not.toContain(i18n.t("ask.error.title"));
  });

  for (const sprache of ["de", "en", "nl"] as const) {
    it(`F3 · frische Seite (${sprache}): „abgeschaltet" statt „nicht verfügbar", Knopf gesperrt, keine Frage geht hinaus`, async () => {
      const { aufbau: a } = await vorrichtung();
      await kiAus(a);
      await i18n.changeLanguage(sprache);
      await seiteOeffnen();
      expect(text("ask-ki-abgeschaltet-hinweis")).toBe(d5kiaus[sprache]["d5kiaus.hinweis"]);
      expect(container.textContent ?? "").not.toContain(i18n.t("ai.unavailable.hint"));
      expect(sendeknopf().disabled).toBe(true);
      const vorher = (grenzen as Grenzen).stand();
      await absenden(FRAGE);
      expect(draht.aufrufe.some((r) => r.url.startsWith("/api/ask"))).toBe(false);
      expect(zugriffsbefund(differenz(vorher, (grenzen as Grenzen).stand()), ALLE_GRENZEN)).toBe(
        "",
      );
      // Der Weg zur Bibliothek steht daneben — das Leserecht ist nicht Teil der Abschaltung.
      expect(container.querySelector('[data-testid="ask-ai-alternative"]')).not.toBeNull();
    });
  }
});
