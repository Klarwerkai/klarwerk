// @vitest-environment jsdom
// ==============================================================================================
// AUFTRAG-mega70 BLOCK C — DER RENDERBELEG: WAS AUF DER KARTE STEHT, NICHT WAS IM QUELLTEXT STEHT
// ==============================================================================================
//
// B32 Block C (`OFFEN.md:200`) verlangt zweierlei:
//   1  die BETONTE HANDLUNG der Erfolgskarte richtet sich nach der Rolle
//   2  der BEGLEITTEXT erklaert, statt aufzufordern
//
// Beides ist im Quelltext gebaut (`lib/captureSuccess.ts:28-42` und `:50-56`). BEN hat den Beleg
// dafuer trotzdem zweimal zurueckgewiesen, woertlich: „belegt weiterhin NICHT den tatsaechlich
// gerenderten Begleittext." Der bestehende Fall `tests/capture/mega70-naechste-handlung-rolle.test.ts`
// ruft `captureNextSteps()` direkt auf und liest i18n-Konstanten — er rendert NICHTS.
//
// DIESE DATEI SCHLIESST GENAU DIESE LUECKE. Sie montiert die echte Erfassungsseite, geht den
// Klickpfad eines Menschen bis zum Einreichen, und liest DANN am gerenderten DOM:
//
//   R1  die betonte Handlung als ADMIN      — welches Element traegt `bg-ink` (die Betonung)?
//   R2  die betonte Handlung als EXPERTE    — dieselbe Karte, andere Rolle, andere Betonung
//   R3  der Begleittext, wie er dasteht     — aus `container.textContent`, nicht aus i18n
//   R4  die Kalibrierung: der Text fordert NICHT zu der Handlung auf, die die Rolle nicht darf
//
// Die Betonung ist am Element ablesbar, weil `Capture.tsx:3748-3750` sie als Klasse setzt:
// `s.primary ? "bg-ink text-white" : "border border-hairline bg-page text-text"`. Der Test liest
// die Klasse am gerenderten Knoten — nicht die Bedingung, aus der sie stammt.
//
// Die Bruecke zum echten Server ist dieselbe wie in mega21/mega23: kein gemockter Endpunkt, das
// Wissensobjekt wird wirklich angelegt.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bruecke = vi.hoisted(() => ({
  app: null as unknown as { inject: (o: Record<string, unknown>) => Promise<AnyRes> },
  token: "",
}));

interface AnyRes {
  statusCode: number;
  body: string;
}

vi.mock("../../apps/web/src/api/endpoints", async (importOriginal) => {
  const original = (await importOriginal()) as {
    endpoints: Record<string, Record<string, unknown>>;
  };
  const status = {
    active: true,
    mode: "cloud",
    reachable: "ok",
    tasks: { structure: true, extract: true },
  };
  return {
    ...original,
    endpoints: {
      ...original.endpoints,
      reasoner: {
        ...original.endpoints.reasoner,
        status: vi.fn(async () => status),
        config: vi.fn(async () => null),
        structure: vi.fn(async () => ({
          title: "Dichtungswechsel L4",
          statement: "Dichtung vor jedem Anlauf pruefen.",
          type: "best_practice",
          category: "Instandhaltung",
          tags: ["dichtung"],
          conditions: [],
          measures: [],
        })),
      },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement, useEffect } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider, useRole } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import type { Role } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
import { Capture } from "../../apps/web/src/pages/Capture";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function brueckeAufbauen(): void {
  (globalThis as unknown as { fetch: unknown }).fetch = async (
    input: unknown,
    init: { method?: string; body?: string; headers?: HeadersInit } = {},
  ) => {
    const url = String(input);
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((value, key) => {
      headers[key] = value;
    });
    if (bruecke.token) {
      headers.authorization = `Bearer ${bruecke.token}`;
    }
    const res = await bruecke.app.inject({
      method: init.method ?? "GET",
      url,
      headers,
      ...(init.body !== undefined ? { payload: init.body } : {}),
    });
    return {
      ok: res.statusCode < 400,
      status: res.statusCode,
      statusText: "",
      text: async () => res.body,
    };
  };
}

async function serverStarten(): Promise<void> {
  bruecke.app = buildApp(buildServices()) as unknown as typeof bruecke.app;
  bruecke.token = "";
  await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "blockc@x.de", password: "secret123" },
  });
  const login = await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "blockc@x.de", password: "secret123" },
  });
  bruecke.token = (JSON.parse(login.body) as { token: string }).token;
}

/**
 * Stellt die EFFEKTIVE Rolle ueber denselben Weg, den die Admin-Ansicht benutzt
 * (`RoleContext:50` → `setViewAs`). Kein Nachbau der Registry, kein Mock.
 */
function RolleStellen({ rolle }: { rolle: Role | null }): null {
  const { setRole } = useRole();
  useEffect(() => {
    if (rolle) {
      setRole(rolle);
    }
  }, [rolle, setRole]);
  return null;
}

async function mount(rolle: Role | null): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
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
                  { initialEntries: ["/erfassen"] },
                  createElement(RolleStellen, { rolle }),
                  createElement(
                    Routes,
                    null,
                    createElement(Route, { path: "/erfassen", element: createElement(Capture) }),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

function unmount(): void {
  act(() => root.unmount());
  container.remove();
}

function pageText(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

function buttonByText(part: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(part),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${part}" nicht gefunden. Sichtbar: ${pageText().slice(0, 900)}`);
  }
  return btn;
}

async function click(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
}

async function change(el: HTMLElement, value: string): Promise<void> {
  const proto = Object.getPrototypeOf(el) as object;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  await act(async () => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
}

/** Der Klickpfad eines Menschen bis zur Erfolgskarte. */
async function bisZurErfolgskarte(): Promise<void> {
  const textarea = container.querySelector("textarea");
  if (!(textarea instanceof HTMLTextAreaElement)) {
    throw new Error("Erzaehl-Feld nicht gefunden");
  }
  await change(textarea, "Die Dichtung an Linie 4 muss regelmaessig getauscht werden.");
  await click(buttonByText(i18n.t("capture.structure")));

  const kandidaten = [...container.querySelectorAll("button")].filter((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(i18n.t("capture.submit")),
  );
  const btn = kandidaten[kandidaten.length - 1];
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Einreichen-Knopf nicht gefunden. Sichtbar: ${pageText().slice(-900)}`);
  }
  if (btn.disabled) {
    throw new Error(`Einreichen ist gesperrt. Sichtbar: ${pageText().slice(-900)}`);
  }
  await click(btn);
}

/**
 * DAS HERZSTUECK: liest die BETONUNG am gerenderten Element, nicht die Bedingung im Quelltext.
 * `Capture.tsx:3748-3750` setzt `bg-ink` genau dann, wenn `s.primary` gilt.
 */
function erfolgskarte(): Element {
  // Die Karte traegt ihre eigene Flaechenfarbe (`Capture.tsx:3509`). Ohne diese Einschraenkung
  // griff der erste Anlauf den Knopf „Dokument-Editor oeffnen" AUSSERHALB der Karte — gemessen,
  // und der Grund, warum dieser Helfer existiert.
  const karte = [...container.querySelectorAll("div")].find(
    (el) =>
      el.className.includes("bg-trust-pos-bg") &&
      (el.textContent ?? "").includes(i18n.t("capture.savedTitle")),
  );
  if (!karte) {
    throw new Error(`Erfolgskarte nicht gefunden. Sichtbar: ${pageText().slice(-900)}`);
  }
  return karte;
}

function betontesElement(): { text: string; klassen: string } {
  const betont = [...erfolgskarte().querySelectorAll("a, span, div")].find(
    (el) => el.className.includes("bg-ink") && (el.textContent ?? "").trim().length > 0,
  );
  if (!betont) {
    throw new Error(
      `Kein betontes Element (bg-ink) IN DER KARTE. Karte: ${(erfolgskarte().textContent ?? "").slice(0, 600)}`,
    );
  }
  return {
    text: (betont.textContent ?? "").replace(/\s+/g, " ").trim(),
    klassen: betont.className,
  };
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  brueckeAufbauen();
  await serverStarten();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("mega70 Block C · die Erfolgskarte, am gerenderten Ergebnis gelesen", () => {
  it("R1 · ADMIN: die Karte steht, und die betonte Handlung ist die Pruefung", async () => {
    await mount(null); // Admin-Sitzung ohne Ansicht-als ⇒ effektive Rolle „admin"
    await bisZurErfolgskarte();

    // Die Karte ist WIRKLICH da — gelesen aus dem gerenderten Text, nicht behauptet.
    expect(pageText()).toContain(i18n.t("capture.savedTitle"));

    const betont = betontesElement();
    console.log("RENDERBELEG R1 · betontes Element:", JSON.stringify(betont.text));
    console.log("RENDERBELEG R1 · Klassen         :", betont.klassen);
    expect(betont.text).toContain(i18n.t("capture.savedValidate"));

    unmount();
  });

  it("R2 · EXPERTE: dieselbe Karte, und die Betonung wandert auf das Objekt-Ansehen", async () => {
    await mount("experte");
    await bisZurErfolgskarte();

    expect(pageText()).toContain(i18n.t("capture.savedTitle"));

    const betont = betontesElement();
    console.log("RENDERBELEG R2 · betontes Element:", JSON.stringify(betont.text));
    expect(betont.text).toContain(i18n.t("capture.savedViewKo"));
    // Und die Pruefung ist NICHT betont — sie bleibt aber sichtbar (Block B, RoleLink).
    expect(betont.text).not.toContain(i18n.t("capture.savedValidate"));
    expect(pageText()).toContain(i18n.t("capture.savedValidate"));

    unmount();
  });

  it("R3 · der BEGLEITTEXT steht so auf der Karte, wie er gemeint ist", async () => {
    await mount("experte");
    await bisZurErfolgskarte();

    const sichtbar = pageText();
    console.log(
      "RENDERBELEG R3 · Begleittext im Ergebnis gefunden:",
      sichtbar.includes("aber noch nicht validiert"),
    );
    // Aus dem GERENDERTEN Text, nicht aus i18n: er erklaert den Zustand …
    expect(sichtbar).toContain("aber noch nicht validiert");
    // … und den Prozess …
    expect(sichtbar).toContain("in der Validierung ausreichend bewertet");
    // … und er nimmt die Automatik ausdruecklich zurueck.
    expect(sichtbar).toContain("Automatisch validiert wird nichts");

    unmount();
  });

  it("R4 · KALIBRIERUNG: der Begleittext fordert die Expertin zu nichts auf, was sie nicht darf", async () => {
    await mount("experte");
    await bisZurErfolgskarte();

    // Der Begleittextabsatz selbst — nicht die ganze Seite, sonst faenge die Knopfbeschriftung
    // („Zur Pruefung geben") den Test ein und der Fall waere vakuos.
    const absatz = [...container.querySelectorAll("p")].find((p) =>
      (p.textContent ?? "").includes("noch nicht validiert"),
    );
    if (!absatz) {
      throw new Error(`Begleittext-Absatz nicht gefunden. Sichtbar: ${pageText().slice(-900)}`);
    }
    const text = (absatz.textContent ?? "").replace(/\s+/g, " ");
    console.log("RENDERBELEG R4 · Begleittext, wortwoertlich:", JSON.stringify(text));

    // Er ERKLAERT (Zustand + Prozess) …
    expect(text).toContain("noch nicht validiert");
    // … und FORDERT NICHT auf: keine Aufforderung, das Objekt selbst zur Pruefung zu geben.
    expect(text).not.toContain(i18n.t("capture.savedValidate"));
    expect(text).not.toMatch(/gib |gebe |reiche ein|schicke /i);

    unmount();
  });
});
