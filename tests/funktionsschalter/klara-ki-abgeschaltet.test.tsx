// @vitest-environment jsdom
// ================================================================================================
// R-1040 — ABGESCHALTETE KLARA-FUNKTIONEN ZEIGEN SICH EINHEITLICH UND EHRLICH.
// ================================================================================================
//
// DER BEFUND (Quelltext am Stand dieses Auftrags): Hat der Administrator die KI abgeschaltet
// (`kiAbgeschaltet`, D5), sagt `/fragen` „Der Administrator hat die KI abgeschaltet …"
// (`d5kiaus.hinweis`, `Ask.tsx`) — das Klara-Panel am selben Zustand dagegen „KI nicht verfügbar —
// für diese Aufgabe ist kein Modell aktiv" (`ai.unavailable.hint`, `KlaraAssistant.tsx`). Zwei
// Flächen, eine Lage, zwei Aussagen; die des Panels war falsch: es ist eine Entscheidung, keine
// Störung. Auch ein gescheiterter Statusabruf hiess dort „kein Modell aktiv".
//
// WAS HIER GEMESSEN WIRD: das ECHTE Klara-Panel mit dem ECHTEN `useAiAvailable` und dem ECHTEN
// Statusabruf `GET /api/reasoner/status`. Ersetzt sind nur der Transport (`fetch`, eine Antwort je
// Fall) und die Modellangabe `AiModelInfo` (sie braucht den Rollenkontext und ist hier nicht
// Gegenstand — dieselbe Ersetzung wie in `tests/dok1-export-wahrheit/faq-anzeigeweg.test.tsx`).
//
// Jeder „gesperrt"-Fall hat eine Kalibrierung: mit nutzbarem Modell ist derselbe Knopf nach
// derselben Eingabe OFFEN — sonst wäre „gesperrt" auch dann grün, wenn die Eingabe zu kurz war.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { KlaraAssistant } from "../../apps/web/src/components/KlaraAssistant";
import i18n from "../../apps/web/src/i18n";
import { aiSperrHinweisKey } from "../../apps/web/src/lib/aiAvailability";
import d5kiaus from "../../apps/web/src/texte/d5kiaus";

vi.mock("../../apps/web/src/components/AiModelInfo", () => ({ AiModelInfo: () => null }));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FRAGE = "Wie lege ich einen neuen Eintrag an?";

/** Was der Server für den Administratorentscheid „KI aus" meldet (D5): Antwortweg ohne Modell. */
const ABGESCHALTET = {
  active: true,
  mode: "local",
  reachable: "active",
  tasks: { answer: false, structure: true },
  billable: {},
  kiAbgeschaltet: true,
};
/** Dieselbe Sperre ohne Administratorentscheid — kein Modell eingerichtet. */
const OHNE_MODELL = {
  active: false,
  mode: "deterministic",
  reachable: "none",
  tasks: { answer: false },
  billable: {},
  kiAbgeschaltet: false,
};
/** Kalibrierung: ein nutzbares Modell für die Antwort. */
const NUTZBAR = {
  active: true,
  mode: "local",
  reachable: "active",
  tasks: { answer: true },
  billable: { answer: false },
  kiAbgeschaltet: false,
};

let statusAntwort: { code: number; rumpf: unknown } = { code: 200, rumpf: NUTZBAR };
let statusAbrufe = 0;
let vorherigerFetch: typeof globalThis.fetch;
// Nur gesetzt, wenn ein Fall wirklich montiert — der reine Regelfall montiert nichts.
let host: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let client: QueryClient | null = null;

beforeEach(() => {
  statusAbrufe = 0;
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown) => {
    const url = String(eingabe);
    const istStatus = url === "/api/reasoner/status";
    if (istStatus) {
      statusAbrufe += 1;
    }
    const code = istStatus ? statusAntwort.code : 404;
    const rumpf = JSON.stringify(
      istStatus ? statusAntwort.rumpf : { error: "NOT_FOUND", message: "nicht da" },
    );
    return {
      status: code,
      statusText: String(code),
      ok: code >= 200 && code < 300,
      text: async () => rumpf,
      json: async () => JSON.parse(rumpf),
    };
  }) as unknown as typeof globalThis.fetch;
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
  }
  client?.clear();
  host?.remove();
  root = null;
  client = null;
  host = null;
  globalThis.fetch = vorherigerFetch;
  await i18n.changeLanguage("de");
});

async function durchatmen(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 20; i += 1) {
      await new Promise((r) => setTimeout(r, 0));
    }
  });
}

/** Panel öffnen und eine Frage tippen — danach hängt die Sperre NUR noch am KI-Zustand. */
async function panelMitFrage(): Promise<void> {
  const neuerHost = document.createElement("div");
  document.body.append(neuerHost);
  const neueWurzel = createRoot(neuerHost);
  const neuerClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  host = neuerHost;
  root = neueWurzel;
  client = neuerClient;
  await act(async () => {
    neueWurzel.render(
      createElement(
        QueryClientProvider,
        { client: neuerClient },
        createElement(
          MemoryRouter,
          {
            initialEntries: ["/bibliothek"],
            future: { v7_startTransition: true, v7_relativeSplatPath: true },
          },
          createElement(KlaraAssistant),
        ),
      ),
    );
  });
  await durchatmen();
  const oeffnen = neuerHost.querySelector<HTMLButtonElement>(
    `button[aria-label="${i18n.t("klara.open")}"]`,
  );
  expect(oeffnen, "der Öffnen-Knopf des Klara-Panels fehlt").not.toBeNull();
  await act(async () => oeffnen?.click());
  const eingabe = neuerHost.querySelector<HTMLInputElement>("input");
  expect(eingabe, "das Suchfeld des Panels fehlt").not.toBeNull();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(eingabe, FRAGE);
    eingabe?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await durchatmen();
  expect(statusAbrufe, "der KI-Status wurde nie abgefragt").toBeGreaterThan(0);
}

/** Der Host des montierten Falls — ohne Montage ist jede Abfrage ein Fehler des Falls. */
function montiert(): HTMLDivElement {
  if (!host) {
    throw new Error("kein Panel montiert");
  }
  return host;
}

function kiKnopf(): HTMLButtonElement {
  const knopf = [...montiert().querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent === i18n.t("klara.aiSearch"),
  );
  expect(knopf, "der KI-Knopf des Panels fehlt").toBeDefined();
  return knopf as HTMLButtonElement;
}

function hinweis(): HTMLElement | null {
  return montiert().querySelector<HTMLElement>("[data-hinweis]");
}

describe("R-1040 · die Regel (rein)", () => {
  it("die Abschaltung gilt nur für die Antwort — so meldet sie der Server", () => {
    const andereAufgabe = aiSperrHinweisKey({ kiAbgeschaltet: true }, "structure", false);
    const nichtAbgeschaltet = aiSperrHinweisKey({ kiAbgeschaltet: false }, "answer", false);
    expect(aiSperrHinweisKey({ kiAbgeschaltet: true }, "answer", false)).toBe("d5kiaus.hinweis");
    expect(andereAufgabe).toBe("ai.unavailable.hint");
    expect(nichtAbgeschaltet).toBe("ai.unavailable.hint");
    expect(aiSperrHinweisKey(undefined, "answer", true)).toBe("ai.statusUnknown.hint");
    // Ein älterer Server ohne das Feld behauptet keine Abschaltung.
    expect(aiSperrHinweisKey({}, "answer", false)).toBe("ai.unavailable.hint");
  });
});

describe("R-1040 · das Klara-Panel sagt dieselbe Lage wie /fragen", () => {
  it("KALIBRIERUNG: mit nutzbarem Modell ist der Knopf nach derselben Eingabe offen, ohne Hinweis", async () => {
    statusAntwort = { code: 200, rumpf: NUTZBAR };
    await panelMitFrage();
    expect(kiKnopf().disabled).toBe(false);
    expect(hinweis()).toBeNull();
  });

  for (const sprache of ["de", "en", "nl"] as const) {
    it(`ABGESCHALTET (${sprache}): „vom Administrator abgeschaltet“, nicht „kein Modell aktiv“`, async () => {
      await i18n.changeLanguage(sprache);
      statusAntwort = { code: 200, rumpf: ABGESCHALTET };
      await panelMitFrage();
      const satz = d5kiaus[sprache]["d5kiaus.hinweis"];
      expect(kiKnopf().disabled).toBe(true);
      expect(hinweis()?.textContent).toBe(satz);
      expect(kiKnopf().title).toBe(satz);
      expect(montiert().textContent ?? "").not.toContain(i18n.t("ai.unavailable.hint"));
    });
  }

  it("OHNE MODELL: bleibt „kein Modell aktiv“ — die Abschaltung wird nicht behauptet", async () => {
    statusAntwort = { code: 200, rumpf: OHNE_MODELL };
    await panelMitFrage();
    expect(kiKnopf().disabled).toBe(true);
    expect(hinweis()?.textContent).toBe(i18n.t("ai.unavailable.hint"));
    expect(montiert().textContent ?? "").not.toContain(d5kiaus.de["d5kiaus.hinweis"]);
  });

  it("STATUS UNBEKANNT: sagt, dass der Zustand nicht feststeht — nicht „kein Modell aktiv“", async () => {
    statusAntwort = { code: 500, rumpf: { error: "INTERNAL", message: "kaputt" } };
    await panelMitFrage();
    expect(kiKnopf().disabled).toBe(true);
    expect(hinweis()?.textContent).toBe(i18n.t("ai.statusUnknown.hint"));
  });
});
