// @vitest-environment jsdom
// ================================================================================================
// JOB 4224 · D5 · LIEFERUNGEN 5 UND 6 — OHNE ANBIETER EIN ERLAUBTER WEG, UND DER WEG ÜBERSTEHT
// NEULADEN UND FEHLER
// ================================================================================================
//
// LIEFERUNG 5. Steht kein KI-Anbieter zur Verfügung, ist der Fragen-Knopf hart ausgegraut
// (`useAiAvailable("answer")`, PAKET 1 D-AISTATE) und darunter steht der Satz „KI nicht verfügbar"
// (`ai.unavailable.hint`). Er NENNT die Lage — er sagt aber nicht, was die Person STATTDESSEN tun
// kann, und genau das verlangt der Auftrag. Zweiter Teil der Zusage: es wird nichts heimlich
// freigegeben und nichts nach draußen gesendet; der Draht zählt beides mit.
//
// LIEFERUNG 6. Die Eingabe übersteht ein Neuladen (die Fläche liest die Frage aus `?q=`,
// `lib/askQuestion.ts`), und ein Serverfehler zwischendurch lässt weder Antwort noch Beleg
// wortlos verschwinden: steht schon eine Antwort, bleibt sie mit dem Hinweis stehen, dass die
// Auffrischung gescheitert ist (§9 des Auftrags, `auffrischungGescheitert` in `Ask.tsx`).
//
// EHRLICHE GRENZE, und sie gehört an dieselbe Stelle wie die Zusage: ein Neuladen stellt die
// ANTWORT nicht wieder her — die Fläche hält keinen Antwortspeicher über einen Seitenwechsel
// hinweg. Was übersteht, ist die FRAGE; der Beleg ist danach eine Bedienung entfernt. Gemessen
// wird genau das, nicht mehr.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  type Aufbau,
  type Draht,
  FRAGE,
  adapterUmgebungSetzen,
  appAufbauen,
  drahtAufbauen,
  eintragMitOriginal,
  neuesKonto,
} from "./kette";

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

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let draht: Draht;
let aufbau: Aufbau | null = null;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const durchlaufen = async (): Promise<void> => {
  for (let i = 0; i < 40; i += 1) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

beforeAll(async () => {
  await i18n.changeLanguage("de");
  draht = drahtAufbauen();
});

afterAll(() => {
  draht.abbauen();
});

afterEach(async () => {
  if (root) {
    act(() => root?.unmount());
    container.remove();
    root = null;
  }
  if (aufbau) {
    await aufbau.app.close();
    aufbau = null;
  }
  draht.setzeApp(null);
  draht.setzeCookie(null);
  draht.lage.generierungen = 0;
  draht.aufrufe.length = 0;
});

async function seiteOeffnen(adresse = "/fragen"): Promise<void> {
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
              createElement(MemoryRouter, { initialEntries: [adresse] }, createElement(Ask)),
            ),
          ),
        ),
      ),
    );
    await durchlaufen();
  });
  await act(durchlaufen);
}

function feld(): HTMLInputElement {
  const el = container.querySelector<HTMLInputElement>("form input");
  expect(el, "kein Fragefeld auf der Fläche").not.toBeNull();
  return el as HTMLInputElement;
}

function sendeknopf(): HTMLButtonElement {
  const el = container.querySelector<HTMLButtonElement>("form button[type=submit]");
  expect(el, "kein Absendeknopf").not.toBeNull();
  return el as HTMLButtonElement;
}

async function absenden(text: string): Promise<void> {
  const eingabe = feld();
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

async function vorrichtung(ohneModell = false): Promise<Aufbau> {
  const a = await appAufbauen(ohneModell);
  aufbau = a;
  draht.setzeApp(a.app);
  return a;
}

async function alsLeser(a: Aufbau): Promise<void> {
  const leser = await neuesKonto(a.app, "leser", a.admin);
  draht.setzeCookie(`kw_session=${leser.token}`);
}

describe("JOB 4224 · D5 · A — ohne freigegebenen Anbieter", () => {
  it("A1 · der Weg ist gesperrt, sagt WARUM und sagt, was stattdessen möglich ist", async () => {
    const a = await vorrichtung(true);
    await eintragMitOriginal(a.app, a.admin);
    await alsLeser(a);
    await seiteOeffnen();

    // Kalibrierung: der Knopf ist wirklich zu — sonst misst dieser Fall die falsche Lage.
    expect(sendeknopf().disabled, "ohne Anbieter ist der Fragen-Knopf nicht gesperrt").toBe(true);
    // Die Lage steht da …
    const text = container.textContent ?? "";
    expect(text).toContain(i18n.t("ai.unavailable.hint"));
    // … UND der erlaubte Weg daneben.
    const weg = container.querySelector('[data-testid="ask-ai-alternative"]');
    expect(weg, `die Fläche nennt keinen erlaubten Weg: ${text.slice(0, 500)}`).not.toBeNull();
    expect((weg?.textContent ?? "").trim().length).toBeGreaterThan(0);
    expect(weg?.textContent ?? "").not.toContain("ask.");
  });

  it("A2 · es wird nichts heimlich freigegeben und nichts nach draußen gesendet", async () => {
    const a = await vorrichtung(true);
    await eintragMitOriginal(a.app, a.admin);
    await alsLeser(a);
    await seiteOeffnen();

    // Der Versuch, trotzdem abzusenden, darf keinen Anbieter wecken.
    await absenden(FRAGE);
    expect(draht.lage.generierungen, "ohne Anbieter ging etwas an ein Modell").toBe(0);
    expect(
      draht.aufrufe.some((r) => r.url.startsWith("/api/ask")),
      "ohne Anbieter wurde trotzdem eine Frage abgesetzt",
    ).toBe(false);
    // Und es gibt keinen Schalter, der sich hier selbst umlegt: der Knopf bleibt zu.
    expect(sendeknopf().disabled).toBe(true);
  });
});

describe("JOB 4224 · D5 · N — Neuladen und Serverfehler", () => {
  it("N1 · die Frage übersteht ein Neuladen, und der Beleg ist danach wieder erreichbar", async () => {
    const a = await vorrichtung();
    const eintrag = await eintragMitOriginal(a.app, a.admin);
    await alsLeser(a);
    await seiteOeffnen();
    await absenden(FRAGE);
    expect(document.body.querySelector('[data-testid="ask-answer"]')).not.toBeNull();

    // Neuladen: die Fläche wird abgebaut und mit der Frage in der Adresse neu aufgebaut — genau
    // das, was der Browser beim Neuladen einer `/fragen?q=…`-Seite tut.
    act(() => root?.unmount());
    container.remove();
    root = null;
    await seiteOeffnen(`/fragen?q=${encodeURIComponent(FRAGE)}`);
    expect(feld().value, "die Eingabe hat das Neuladen nicht überstanden").toBe(FRAGE);

    // Und derselbe Weg trägt wieder bis zum Original.
    await absenden(FRAGE);
    const menue = document.body.querySelector<HTMLButtonElement>('[data-testid="ask-menu"]');
    expect(menue, "keine Antwortkarte nach dem Neuladen").not.toBeNull();
    await act(async () => {
      (menue as HTMLButtonElement).click();
      await durchlaufen();
    });
    const punkt = document.body.querySelector<HTMLButtonElement>(
      '[data-testid="ask-menu-punkt-mehr"]',
    );
    await act(async () => {
      (punkt as HTMLButtonElement).click();
      await durchlaufen();
    });
    await act(durchlaufen);
    const links = [
      ...document.body.querySelectorAll<HTMLAnchorElement>(
        '[data-testid="answer-source-original"]',
      ),
    ];
    expect(
      links.some((el) => el.getAttribute("href") === `/api/objects/${eintrag.objectId}/raw`),
      "nach dem Neuladen führt kein Weg mehr zum Original",
    ).toBe(true);
  });

  it("N2 · ein Serverfehler bei der Auffrischung lässt die Antwort NICHT wortlos verschwinden", async () => {
    const a = await vorrichtung();
    await eintragMitOriginal(a.app, a.admin);
    await alsLeser(a);
    await seiteOeffnen();
    await absenden(FRAGE);
    const vorher = document.body.querySelector('[data-testid="ask-answer"]');
    expect(vorher, "ohne stehende Antwort misst dieser Fall nichts").not.toBeNull();
    const wortlaut = vorher?.textContent ?? "";
    expect(wortlaut.length).toBeGreaterThan(0);

    // Derselbe Weg, EIN Serverfehler dazwischen — eine Auffrischung derselben Frage.
    draht.stoerungEinmal("/api/ask", 500);
    await absenden(FRAGE);
    await act(durchlaufen);

    // Die Antwort steht weiter da …
    const nachher = document.body.querySelector('[data-testid="ask-answer"]');
    expect(nachher, "die Antwort ist nach dem Fehler wortlos verschwunden").not.toBeNull();
    // … und die Fläche SAGT, dass die Auffrischung gescheitert ist (`Ask.tsx`, §9).
    const seite = document.body.textContent ?? "";
    const hinweis = document.body.querySelector('[data-testid="ask-auffrischung-fehlgeschlagen"]');
    expect(
      hinweis,
      `kein Hinweis auf die gescheiterte Auffrischung: ${seite.slice(0, 500)}`,
    ).not.toBeNull();
    expect(hinweis?.textContent ?? "").toContain(i18n.t("ask.refreshFailed"));
  });
});
