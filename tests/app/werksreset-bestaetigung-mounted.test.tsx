// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME gesamt-werksreset · R-0537 / R-1154 — DIE WERKSRESET-KARTE AM ECHTEN BAUTEIL.
// ================================================================================================
//
// R-0537: „Bevor eine Anlage vollständig zurückgesetzt wird, muss sich der Verwalter noch einmal mit
// Passwort ausweisen, dazu kommt eine deutliche zweite Warnung." R-1154: „Der Weg verlangt eine
// Passwortbestaetigung und zeigt eine grosse Warnung."
//
// Gemessen an der echten Karte (echtes React, echtes i18n, echtes React-Query); Attrappen nur an
// der Endpunktgrenze. Die Serverseite (Passwortprüfung, Sperre im Datenbankbetrieb, Neustart in
// die Ersteinrichtung) prüfen `services/app/src/admin-routes.test.ts` und
// `services/app/src/factory-reset.test.ts`.
//
//   W1  nicht verfügbar   Kein Auslöser, nur die Aussage „in dieser Installation nicht verfügbar".
//   W2  Stufe 1           Passwortfeld; ohne Passwort kein Weiter, noch KEIN Aufruf.
//   W3  Stufe 2           Erst danach die große Warnung; erst ihr Knopf ruft den Reset MIT Passwort.
//   W4  Abbrechen         In jeder Stufe ohne Aufruf zurück, das Passwort ist verworfen.
//   W5  falsches Passwort Zurück zu Stufe 1, Feld leer, Meldung „Falsches Passwort".
//   W6  andere Absage     Nennt ihren eigenen Grund statt „Falsches Passwort".
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  available: true,
  factoryReset: vi.fn(async (_pw: string): Promise<{ ok: boolean }> => ({ ok: true })),
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    admin: {
      factoryResetStatus: vi.fn(async () => ({ available: d.available })),
      factoryReset: d.factoryReset,
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { ApiError } from "../../apps/web/src/api/client";
import { ToastProvider, useToast } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { WerkseinstellungenDetail } from "../../apps/web/src/pages/AdminDatenDetails";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

// Die Meldungen rendert sonst die AppShell; hier macht ein schlichter Zeuge sie sichtbar.
function Meldungen() {
  const { toasts } = useToast();
  return createElement(
    "ul",
    { "data-testid": "meldungen" },
    toasts.map((m) => createElement("li", { key: m.id }, m.message)),
  );
}

async function karte(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          ToastProvider,
          null,
          createElement(
            MemoryRouter,
            null,
            createElement(WerkseinstellungenDetail, { onZurueck: () => {} }),
            createElement(Meldungen),
          ),
        ),
      ),
    );
    await flush();
  });
  // Nacharbeit 1 (rot: „Lädt …" statt Karte): React führt die Effekte erst am ENDE eines `act` aus —
  // die Statusabfrage startet also erst nach dem ersten Block. Die Antwort und ihr Rendern brauchen
  // eigene `act`-Runden, wie in `tests/seitenhilfe-admin/vier-adminflaechen-erklaeren-sich.test.tsx`.
  await act(flush);
  await act(flush);
  // Kein Fall misst den Ladezustand: steht er noch, ist das ein Prüfstandsfehler, kein Befund.
  if (container.querySelector('[data-einst="laedt"]')) {
    throw new Error("Statusabfrage der Karte ist nicht beantwortet");
  }
}

const text = (el: Element): string => (el.textContent ?? "").replace(/\s+/g, " ").trim();
const inhalt = (): string => text(container);
const meldungen = (): string =>
  text(container.querySelector('[data-testid="meldungen"]') as Element);

function knopf(beschriftung: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll("button")].find((b) => text(b) === beschriftung);
}

async function klick(beschriftung: string): Promise<void> {
  const b = knopf(beschriftung);
  if (!b) {
    throw new Error(`Knopf „${beschriftung}" nicht gefunden`);
  }
  await act(async () => {
    b.click();
    await flush();
  });
  // Antwort der Mutation (Erfolg/Absage) und ihre Folgezustände in eigener Runde rendern.
  await act(flush);
}

const passwortfeld = (): HTMLInputElement | null =>
  container.querySelector('input[type="password"]');

async function tippe(wert: string): Promise<void> {
  const el = passwortfeld();
  if (!el) {
    throw new Error("Passwortfeld fehlt");
  }
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el) as object, "value")?.set;
  setter?.call(el, wert);
  await act(async () => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

const AUSLOESER = () => i18n.t("adm.factory.button");
const WEITER = () => i18n.t("adm.factory.continue");
const AUSFUEHREN = () => i18n.t("adm.factory.execute");
const ABBRECHEN = () => i18n.t("adm.factory.cancel");
const WARNUNG = () => i18n.t("adm.factory.confirm2");

beforeEach(async () => {
  await i18n.changeLanguage("de");
  d.available = true;
  d.factoryReset.mockReset();
  d.factoryReset.mockImplementation(async () => ({ ok: true }));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("R-0537 / R-1154 · Werksreset nur mit Passwort und zweiter, großer Warnung", () => {
  it("W1 nicht verfügbar → kein Auslöser, nur die Aussage", async () => {
    d.available = false;
    await karte();
    expect(inhalt()).toContain(i18n.t("adm.factory.unavailable"));
    expect(knopf(AUSLOESER())).toBeUndefined();
  });

  it("W2 Stufe 1 verlangt das Passwort; ohne Eingabe kein Weiter und kein Aufruf", async () => {
    await karte();
    expect(passwortfeld()).toBeNull();
    await klick(AUSLOESER());
    expect(passwortfeld()).toBeInstanceOf(HTMLInputElement);
    expect(passwortfeld()?.autocomplete).toBe("current-password");
    // Die Warnung steht noch NICHT — sie ist die zweite Stufe.
    expect(inhalt()).not.toContain(WARNUNG());
    expect(knopf(AUSFUEHREN())).toBeUndefined();
    expect(knopf(WEITER())?.disabled).toBe(true);
    await tippe("   ");
    expect(knopf(WEITER())?.disabled).toBe(true);
    expect(d.factoryReset).not.toHaveBeenCalled();
  });

  it("W3 erst nach dem Passwort die große Warnung; ihr Knopf ruft mit dem Passwort", async () => {
    await karte();
    await klick(AUSLOESER());
    await tippe("geheim-123");
    await klick(WEITER());
    expect(d.factoryReset).not.toHaveBeenCalled();
    // Große, deutliche Warnung: eigener Block mit Überschrift und Warntext.
    const ueberschrift = [...container.querySelectorAll("span")].find((s) => text(s) === WARNUNG());
    expect(ueberschrift, "Warnüberschrift fehlt").toBeDefined();
    expect(ueberschrift?.className).toContain("font-bold");
    expect(inhalt()).toContain(i18n.t("adm.factory.warnBody"));
    await klick(AUSFUEHREN());
    expect(d.factoryReset).toHaveBeenCalledTimes(1);
    expect(d.factoryReset.mock.calls[0]?.[0]).toBe("geheim-123");
    expect(inhalt()).toContain(i18n.t("adm.factory.restartHint"));
  });

  it("W4 Abbrechen in beiden Stufen ruft nichts und verwirft das Passwort", async () => {
    await karte();
    await klick(AUSLOESER());
    await tippe("geheim-123");
    await klick(ABBRECHEN());
    expect(passwortfeld()).toBeNull();
    await klick(AUSLOESER());
    expect(passwortfeld()?.value).toBe("");
    await tippe("geheim-123");
    await klick(WEITER());
    await klick(ABBRECHEN());
    expect(inhalt()).not.toContain(WARNUNG());
    expect(knopf(AUSLOESER())).toBeInstanceOf(HTMLButtonElement);
    expect(d.factoryReset).not.toHaveBeenCalled();
  });

  it("W5 falsches Passwort → zurück zu Stufe 1, Feld leer, „Falsches Passwort“", async () => {
    d.factoryReset.mockImplementation(async () => {
      throw new ApiError(401, "INVALID_PASSWORD", "Falsches Passwort.");
    });
    await karte();
    await klick(AUSLOESER());
    await tippe("nicht-meins");
    await klick(WEITER());
    await klick(AUSFUEHREN());
    expect(passwortfeld()?.value).toBe("");
    expect(inhalt()).not.toContain(WARNUNG());
    expect(meldungen()).toContain(i18n.t("adm.factory.wrongPassword"));
    expect(inhalt()).not.toContain(i18n.t("adm.factory.restartHint"));
  });

  it("W6 eine andere Absage nennt ihren Grund statt „Falsches Passwort“", async () => {
    const grund = "Werksreset ist nur in der lokalen Desktop-Version möglich.";
    d.factoryReset.mockImplementation(async () => {
      throw new ApiError(403, "FORBIDDEN", grund);
    });
    await karte();
    await klick(AUSLOESER());
    await tippe("geheim-123");
    await klick(WEITER());
    await klick(AUSFUEHREN());
    expect(meldungen()).toContain(grund);
    expect(meldungen()).not.toContain(i18n.t("adm.factory.wrongPassword"));
  });
});
