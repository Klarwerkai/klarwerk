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
//   W2  Stufe 1           Vorschau, Checkbox, zwei Passwortfelder; ohne alles kein Weiter, KEIN Aufruf.
//   W3  Stufe 2           Erst danach die große Warnung; erst ihr Knopf ruft den Reset — mit der
//                         Kennung der gezeigten Vorschau, bestaetigt=true und beiden Passwörtern.
//   W4  Abbrechen         In jeder Stufe ohne Aufruf zurück, Passwörter und Haken sind verworfen.
//   W5  falsches Passwort Zurück zu Stufe 1, Felder leer, Meldung „Falsches Passwort".
//   W6  andere Absage     Nennt ihren eigenen Grund statt „Falsches Passwort".
//
// PETER-20261011-P08 ergänzt:
//   W7  Vorschau          Nennt die konkreten Mengen: was entfernt wird, was erhalten bleibt.
//   W8  Checkbox          Ohne gesetzten Haken bleibt „Weiter" gesperrt, auch mit zwei Passwörtern.
//   W9  zweites Passwort  Ohne zweite Eingabe bleibt „Weiter" gesperrt.
//   W10 veraltet          409 VORSCHAU_VERALTET → Grund sichtbar, Vorschau neu geladen, nichts aus.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FirmenresetAuftrag, FirmenresetVorschau } from "../../apps/web/src/api/types";

const VORSCHAU: FirmenresetVorschau = {
  kennung: "kennung-1",
  entfernt: {
    wissensobjekte: 7,
    offeneFragen: 3,
    weitereEintraege: 42,
    ablagen: ["drafts", "sessions"],
  },
  erhalten: { benutzerkonten: 4, woerterbuch: 5, protokolleintraege: 60 },
};

const d = vi.hoisted(() => ({
  available: true,
  vorschau: undefined as unknown,
  status: vi.fn(),
  factoryReset: vi.fn(async (_a: unknown): Promise<{ ok: boolean }> => ({ ok: true })),
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    admin: {
      factoryResetStatus: d.status,
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

const passwortfelder = (): HTMLInputElement[] => [
  ...container.querySelectorAll<HTMLInputElement>('input[type="password"]'),
];
const passwortfeld = (): HTMLInputElement | null => passwortfelder()[0] ?? null;
const haken = (): HTMLInputElement | null =>
  container.querySelector('[data-testid="firmenreset-bestaetigt"]');

async function tippe(wert: string, feld = 0): Promise<void> {
  const el = passwortfelder()[feld];
  if (!el) {
    throw new Error(`Passwortfeld ${feld + 1} fehlt`);
  }
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el) as object, "value")?.set;
  setter?.call(el, wert);
  await act(async () => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

async function hakenSetzen(): Promise<void> {
  const el = haken();
  if (!el) {
    throw new Error("Bestätigungshaken fehlt");
  }
  await act(async () => {
    el.click();
    await flush();
  });
}

/** Stufe 1 vollständig ausfüllen: Haken und beide Passwörter. */
async function stufe1(pw = "geheim-123"): Promise<void> {
  await klick(AUSLOESER());
  await hakenSetzen();
  await tippe(pw, 0);
  await tippe(pw, 1);
}

const AUSLOESER = () => i18n.t("adm.factory.button");
const WEITER = () => i18n.t("adm.factory.continue");
const AUSFUEHREN = () => i18n.t("adm.factory.execute");
const ABBRECHEN = () => i18n.t("adm.factory.cancel");
const WARNUNG = () => i18n.t("adm.factory.confirm2");

beforeEach(async () => {
  await i18n.changeLanguage("de");
  d.available = true;
  d.vorschau = VORSCHAU;
  d.status.mockReset();
  d.status.mockImplementation(async () =>
    d.available ? { available: true, vorschau: d.vorschau } : { available: false },
  );
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

  it("W2 Stufe 1 verlangt Haken und zwei Passwörter; ohne Eingabe kein Weiter und kein Aufruf", async () => {
    await karte();
    expect(passwortfeld()).toBeNull();
    await klick(AUSLOESER());
    expect(passwortfelder()).toHaveLength(2);
    for (const feld of passwortfelder()) {
      expect(feld.autocomplete).toBe("current-password");
    }
    expect(haken()?.checked).toBe(false);
    // Die Warnung steht noch NICHT — sie ist die zweite Stufe.
    expect(inhalt()).not.toContain(WARNUNG());
    expect(knopf(AUSFUEHREN())).toBeUndefined();
    expect(knopf(WEITER())?.disabled).toBe(true);
    await tippe("   ", 0);
    await tippe("   ", 1);
    await hakenSetzen();
    expect(knopf(WEITER())?.disabled).toBe(true);
    expect(d.factoryReset).not.toHaveBeenCalled();
  });

  it("W3 erst nach Stufe 1 die große Warnung; ihr Knopf ruft mit Kennung, Haken und Passwörtern", async () => {
    await karte();
    await stufe1("geheim-123");
    await klick(WEITER());
    expect(d.factoryReset).not.toHaveBeenCalled();
    // Große, deutliche Warnung: eigener Block mit Überschrift und Warntext.
    const ueberschrift = [...container.querySelectorAll("span")].find((s) => text(s) === WARNUNG());
    expect(ueberschrift, "Warnüberschrift fehlt").toBeDefined();
    expect(ueberschrift?.className).toContain("font-bold");
    expect(inhalt()).toContain(i18n.t("adm.factory.warnBody"));
    await klick(AUSFUEHREN());
    expect(d.factoryReset).toHaveBeenCalledTimes(1);
    const auftrag: FirmenresetAuftrag = {
      kennung: "kennung-1",
      bestaetigt: true,
      passwort1: "geheim-123",
      passwort2: "geheim-123",
    };
    expect(d.factoryReset.mock.calls[0]?.[0]).toEqual(auftrag);
    expect(inhalt()).toContain(i18n.t("adm.factory.restartHint"));
  });

  it("W4 Abbrechen in beiden Stufen ruft nichts und verwirft Passwörter und Haken", async () => {
    await karte();
    await stufe1();
    await klick(ABBRECHEN());
    expect(passwortfeld()).toBeNull();
    await klick(AUSLOESER());
    expect(passwortfelder().map((f) => f.value)).toEqual(["", ""]);
    expect(haken()?.checked).toBe(false);
    await hakenSetzen();
    await tippe("geheim-123", 0);
    await tippe("geheim-123", 1);
    await klick(WEITER());
    await klick(ABBRECHEN());
    expect(inhalt()).not.toContain(WARNUNG());
    expect(knopf(AUSLOESER())).toBeInstanceOf(HTMLButtonElement);
    expect(d.factoryReset).not.toHaveBeenCalled();
  });

  it("W5 falsches Passwort → zurück zu Stufe 1, Felder leer, „Falsches Passwort“", async () => {
    d.factoryReset.mockImplementation(async () => {
      throw new ApiError(401, "INVALID_PASSWORD", "Falsches Passwort.");
    });
    await karte();
    await stufe1("nicht-meins");
    await klick(WEITER());
    await klick(AUSFUEHREN());
    expect(passwortfelder().map((f) => f.value)).toEqual(["", ""]);
    expect(haken()?.checked).toBe(false);
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
    await stufe1();
    await klick(WEITER());
    await klick(AUSFUEHREN());
    expect(meldungen()).toContain(grund);
    expect(meldungen()).not.toContain(i18n.t("adm.factory.wrongPassword"));
  });

  it("W7 die Vorschau nennt, was entfernt wird und was erhalten bleibt — mit Mengen", async () => {
    await karte();
    await klick(AUSLOESER());
    const vorschau = container.querySelector('[data-testid="firmenreset-vorschau"]');
    expect(vorschau, "Vorschau fehlt").not.toBeNull();
    const entfernt = text(vorschau?.querySelector('[data-vorschau="entfernt"]') as Element);
    const erhalten = text(vorschau?.querySelector('[data-vorschau="erhalten"]') as Element);
    expect(entfernt).toContain(i18n.t("adm.factory.vorschau.kos", { anzahl: 7 }));
    expect(entfernt).toContain(i18n.t("adm.factory.vorschau.fragen", { anzahl: 3 }));
    expect(entfernt).toContain(
      i18n.t("adm.factory.vorschau.weitere", { anzahl: 42, ablagen: "drafts, sessions" }),
    );
    expect(erhalten).toContain(i18n.t("adm.factory.vorschau.konten", { anzahl: 4 }));
    expect(erhalten).toContain(i18n.t("adm.factory.vorschau.woerterbuch", { anzahl: 5 }));
    expect(erhalten).toContain(i18n.t("adm.factory.vorschau.protokoll", { anzahl: 60 }));
    expect(entfernt).not.toContain(i18n.t("adm.factory.vorschau.konten", { anzahl: 4 }));
  });

  it("W8 ohne gesetzten Haken bleibt Weiter gesperrt, auch mit zwei Passwörtern", async () => {
    await karte();
    await klick(AUSLOESER());
    await tippe("geheim-123", 0);
    await tippe("geheim-123", 1);
    expect(knopf(WEITER())?.disabled).toBe(true);
    await hakenSetzen();
    expect(knopf(WEITER())?.disabled).toBe(false);
    await hakenSetzen(); // wieder abgewählt
    expect(knopf(WEITER())?.disabled).toBe(true);
    expect(d.factoryReset).not.toHaveBeenCalled();
  });

  it("W9 ohne zweite Passworteingabe bleibt Weiter gesperrt", async () => {
    await karte();
    await klick(AUSLOESER());
    await hakenSetzen();
    await tippe("geheim-123", 0);
    expect(knopf(WEITER())?.disabled).toBe(true);
    await tippe("geheim-123", 1);
    expect(knopf(WEITER())?.disabled).toBe(false);
  });

  it("W10 veraltete Vorschau → Grund sichtbar, Vorschau neu geladen, zurück zu Stufe 1", async () => {
    const grund = "Der Bestand hat sich seit der Vorschau geändert. Es wurde nichts gelöscht.";
    d.factoryReset.mockImplementation(async () => {
      throw new ApiError(409, "VORSCHAU_VERALTET", grund);
    });
    await karte();
    await stufe1();
    await klick(WEITER());
    const abrufeVorher = d.status.mock.calls.length;
    d.vorschau = { ...VORSCHAU, kennung: "kennung-2" };
    await klick(AUSFUEHREN());
    expect(meldungen()).toContain(grund);
    expect(d.status.mock.calls.length).toBeGreaterThan(abrufeVorher);
    expect(inhalt()).not.toContain(i18n.t("adm.factory.restartHint"));
    expect(haken()?.checked).toBe(false);
    // Der nächste Versuch trägt die NEUE Kennung.
    d.factoryReset.mockImplementation(async () => ({ ok: true }));
    await act(flush);
    await hakenSetzen();
    await tippe("geheim-123", 0);
    await tippe("geheim-123", 1);
    await klick(WEITER());
    await klick(AUSFUEHREN());
    const aufrufe = d.factoryReset.mock.calls;
    expect((aufrufe[aufrufe.length - 1]?.[0] as FirmenresetAuftrag).kennung).toBe("kennung-2");
  });
});
