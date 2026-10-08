// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME 20260922 (R-0305, R-1099) · DIE ZWEITMEINUNG AUF DER FRAGENSEITE — WAS DER MENSCH SIEHT.
// ================================================================================================
//
// Gemountet wird der echte Baustein `components/fragen/Zweitmeinung.tsx`. Der Endpunkt ist die
// Drahtgrenze (dieselbe Form wie POST /api/ask mit `zweitmeinung`); Renderer und Zustand sind das
// Produkt. Gelesen wird `textContent`.
//
//   M1 · Abweichung: Warnzeichen als Alarm, Grund der Abweichung, beide Antworten mit Stufe, Grenze
//        des Abgleichs — und die Anfrage trägt Frage, Sprache und Gesprächsfaden
//   M2 · keine Abweichung: der ehrliche Satz statt einer Warnung, die Grenze bleibt sichtbar
//   M3 · kein Zweitmodell gewählt: der Grund steht da, keine Gegenüberstellung
//   M4 · der Kostenhinweis folgt `billable`
import { afterEach, describe, expect, it, vi } from "vitest";

const draht = vi.hoisted(() => ({
  antwort: null as unknown,
  aufrufe: [] as unknown[][],
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ask: {
      zweitmeinung: vi.fn(async (...args: unknown[]) => {
        draht.aufrufe.push(args);
        return draht.antwort;
      }),
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { Zweitmeinung } from "../../apps/web/src/components/fragen/Zweitmeinung";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FRAGE = "Bei welchem Druck wird Ventil X geschlossen?";

function ergebnis(zweitmeinung: unknown) {
  return {
    result: {
      answered: true,
      answer: "Ab 5 bar schließen [1].",
      knowledgeClass: "gesichert",
      trust: 90,
      sources: ["k1"],
      citedSources: ["k1"],
      steps: [],
      demo: false,
    },
    gap: null,
    receipt: "beleg",
    zweitmeinung,
  };
}

const ZWEITE = {
  answered: true,
  answer: "Ab 7 bar schließen [1].",
  sources: ["k1"],
  citedSources: ["k1"],
  demo: false,
};

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

let aufraeumen: (() => void) | null = null;

afterEach(() => {
  aufraeumen?.();
  aufraeumen = null;
  draht.aufrufe = [];
});

async function montieren(billable: boolean | undefined = undefined): Promise<HTMLElement> {
  await i18n.changeLanguage("de");
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const baustein = createElement(Zweitmeinung, {
    frage: FRAGE,
    faden: ["Wie wird Ventil X gewartet?"],
    billable,
    titelVon: (id: string) => (id === "k1" ? "Ventil X bei Überdruck schließen" : undefined),
  });
  await act(async () => {
    root.render(createElement(QueryClientProvider, { client }, baustein));
  });
  aufraeumen = () => {
    act(() => root.unmount());
    container.remove();
  };
  return container;
}

async function einholen(container: HTMLElement): Promise<void> {
  const knopf = container.querySelector<HTMLButtonElement>(
    '[data-testid="ask-zweitmeinung-knopf"]',
  );
  expect(knopf, "der Knopf fehlt").not.toBeNull();
  await act(async () => {
    knopf?.click();
    await flush();
  });
}

const text = (c: HTMLElement, id: string): string =>
  c.querySelector(`[data-testid="${id}"]`)?.textContent ?? "";

describe("R-0305/R-1099 · die Zweitmeinung auf der Fragenseite", () => {
  it("M1 · Abweichung: Warnzeichen, Grund, beide Antworten, Grenze — Anfrage mit Faden", async () => {
    draht.antwort = ergebnis({
      status: "verglichen",
      ersteStufe: "cloud",
      zweiteStufe: "local",
      zweite: ZWEITE,
      abweichend: true,
      abweichungen: ["zahlen"],
    });
    const c = await montieren();
    expect(text(c, "ask-zweitmeinung-knopf")).toBe("Zweitmeinung einholen");
    await einholen(c);

    expect(draht.aufrufe).toHaveLength(1);
    expect(draht.aufrufe[0]?.slice(0, 3)).toEqual([FRAGE, "de", ["Wie wird Ventil X gewartet?"]]);
    // Ohne `kontext`-Eigenschaft gefragt: kein Fragekontext (Ben, Nacharbeit 9; s. kontext-bindung).
    expect(draht.aufrufe[0]?.[3]).toBeUndefined();
    const warnung = c.querySelector('[data-testid="ask-zweitmeinung-warnung"]');
    expect(warnung?.getAttribute("role")).toBe("alert");
    expect(warnung?.textContent).toContain("Warnzeichen");
    expect(text(c, "ask-zweitmeinung-abweichung-zahlen")).toBe(
      "Die beiden Antworten nennen unterschiedliche Zahlen.",
    );
    expect(text(c, "ask-zweitmeinung-a")).toContain("Antwort A · externes Modell");
    expect(text(c, "ask-zweitmeinung-a")).toContain("5 bar");
    expect(text(c, "ask-zweitmeinung-b")).toContain("Antwort B · lokales Modell");
    expect(text(c, "ask-zweitmeinung-b")).toContain("7 bar");
    expect(text(c, "ask-zweitmeinung-b-quellen")).toContain("Ventil X bei Überdruck schließen");
    expect(text(c, "ask-zweitmeinung-ergebnis")).toContain("Den Inhalt bewertet er nicht");
    // Beide Antworten sind als KI-Erzeugnis gekennzeichnet.
    expect(c.querySelectorAll('[data-testid="ai-generated-notice"]')).toHaveLength(2);
  });

  it("M2 · keine Abweichung: der ehrliche Satz, keine Warnung, die Grenze bleibt", async () => {
    draht.antwort = ergebnis({
      status: "verglichen",
      ersteStufe: "cloud",
      zweiteStufe: "cloud",
      zweite: { ...ZWEITE, answer: "Bei 5 bar schließen [1]." },
      abweichend: false,
      abweichungen: [],
    });
    const c = await montieren();
    await einholen(c);
    expect(c.querySelector('[data-testid="ask-zweitmeinung-warnung"]')).toBeNull();
    expect(text(c, "ask-zweitmeinung-gleich")).toBe(
      "Der automatische Abgleich hat keine Abweichung gefunden.",
    );
    expect(text(c, "ask-zweitmeinung-ergebnis")).toContain("bitte beide Antworten lesen");
  });

  it("M3 · kein Zweitmodell gewählt: der Grund, keine Gegenüberstellung", async () => {
    draht.antwort = ergebnis({ status: "nicht_moeglich", grund: "nicht_eingerichtet" });
    const c = await montieren();
    await einholen(c);
    expect(text(c, "ask-zweitmeinung-grund")).toContain("kein zweites Modell gewählt");
    expect(c.querySelector('[data-testid="ask-zweitmeinung-ergebnis"]')).toBeNull();
  });

  it("M4 · der Kostenhinweis steht nur, wenn der Antwortweg etwas kostet", async () => {
    const mit = await montieren(true);
    expect(mit.querySelector('[data-testid="ai-cost-hint"]')).not.toBeNull();
    aufraeumen?.();
    const ohne = await montieren(false);
    expect(ohne.querySelector('[data-testid="ai-cost-hint"]')).toBeNull();
  });
});
