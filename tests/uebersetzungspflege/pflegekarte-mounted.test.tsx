// @vitest-environment jsdom
// ================================================================================================
// R-1034 / FR-I18N-02 · DIE KARTE „ÜBERSETZUNGEN" AN DER ECHTEN VERWALTUNGSFLÄCHE.
// ================================================================================================
//
// Montiert wird `pages/Admin` unter den echten Anbietern (`tests/admin-navigation/vorrichtung.tsx`)
// mit den ECHTEN Wörterbüchern. Ersetzt ist allein das Netz: die drei Wege der Pflege antworten wie
// der Server (`services/app/src/routes/i18n-routes.ts`), alles andere scheitert ehrlich.
//
//   P1  Verwaltung › System trägt die Zeile „Übersetzungen", und sie öffnet die Karte.
//   P2  Suchen → Anpassen → Speichern: der PUT geht mit genau dem Text hinaus, und die eigene
//       Oberfläche zeigt ihn sofort — ohne Neuladen, ohne Codeänderung.
//   P3  Ein Text, dem ein Platzhalter des mitgelieferten fehlt, lässt sich nicht speichern.
//   P4  Zurücksetzen schickt das DELETE und stellt den mitgelieferten Text wieder her.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../apps/web/src/api/auth")>();
  return {
    ...original,
    authApi: {
      ...original.authApi,
      status: vi.fn(async () => ({ needsSetup: false })),
      me: vi.fn(async () => ({ id: "u-admin", name: "Ada", email: "a@x.de", role: "admin" })),
    },
  };
});

import { act } from "../../apps/web/node_modules/react";
import i18n from "../../apps/web/src/i18n";
import { adminHref } from "../../apps/web/src/lib/adminSections";
import {
  type Stand,
  abbauen,
  beruhige,
  klicke,
  montiere,
  tippe,
} from "../admin-navigation/vorrichtung";

const t = (key: string, opts?: Record<string, unknown>): string =>
  opts ? i18n.t(key, opts) : i18n.t(key);

const SCHLUESSEL = "adm.backup.title";
const MIT_PLATZHALTER = "uebersetzungen.treffer";

interface Ruf {
  methode: string;
  pfad: string;
  rumpf: unknown;
}

let stand: Stand | null = null;
let rufe: Ruf[] = [];
let gepflegt: Record<string, string> = {};
let original = "";

/** Ein Netz, das die Pflegewege wie der Server beantwortet — und sonst ehrlich scheitert. */
function pflegeNetz(): void {
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: async (eingabe: unknown, init?: { method?: string; body?: string }) => {
      const pfad = String(eingabe);
      const methode = (init?.method ?? "GET").toUpperCase();
      const rumpf = init?.body ? JSON.parse(init.body) : undefined;
      rufe.push({ methode, pfad, rumpf });
      const antworte = (daten: unknown) => ({
        status: 200,
        ok: true,
        statusText: "OK",
        text: async () => JSON.stringify(daten),
      });
      if (methode === "GET" && pfad === "/api/i18n/locales") {
        return antworte({
          locales: ["de", "en", "nl"],
          sprachen: ["de", "en", "nl"].map((k) => ({ kennung: k, name: null, grundsprache: true })),
        });
      }
      if (methode === "GET" && pfad === "/api/i18n/de") {
        return antworte({ sprache: "de", texte: { ...gepflegt } });
      }
      const schreib = /^\/api\/admin\/i18n\/de\/([^/]+)$/.exec(pfad);
      if (schreib && methode === "PUT") {
        const schluessel = decodeURIComponent(schreib[1] ?? "");
        const text = (rumpf as { text: string }).text;
        gepflegt[schluessel] = text;
        return antworte({ sprache: "de", schluessel, text });
      }
      if (schreib && methode === "DELETE") {
        const schluessel = decodeURIComponent(schreib[1] ?? "");
        const entfernt = schluessel in gepflegt;
        gepflegt = Object.fromEntries(Object.entries(gepflegt).filter(([k]) => k !== schluessel));
        return antworte({ sprache: "de", schluessel, entfernt });
      }
      throw new Error(`kein Netz in diesem Prüfstand: ${methode} ${pfad}`);
    },
  });
}

/** Ein gesteuertes Textfeld füllen — über den nativen Setter, sonst sieht React es nicht. */
async function schreibe(feld: Element | null, wert: string): Promise<void> {
  if (!(feld instanceof window.HTMLTextAreaElement)) {
    throw new Error("Textfeld nicht gefunden.");
  }
  const prototyp = window.HTMLTextAreaElement.prototype;
  const setzer = Object.getOwnPropertyDescriptor(prototyp, "value")?.set;
  await act(async () => {
    setzer?.call(feld, wert);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
  });
  await beruhige(2);
}

function knopf(wurzel: ParentNode, text: string): HTMLButtonElement | undefined {
  return [...wurzel.querySelectorAll("button")].find((b) => (b.textContent ?? "").trim() === text);
}

async function oeffneKarte(): Promise<Stand> {
  const s = montiere(adminHref("system", "uebersetzungen"));
  stand = s;
  await beruhige();
  return s;
}

async function sucheZeile(s: Stand, schluessel: string): Promise<HTMLElement> {
  await tippe(s.container.querySelector('[data-testid="uebersetzungen-suche"]'), schluessel);
  const zeile = s.container.querySelector<HTMLElement>(`li[data-schluessel="${schluessel}"]`);
  if (!zeile) {
    throw new Error(`Zeile ${schluessel} nicht gefunden.`);
  }
  return zeile;
}

beforeEach(() => {
  window.localStorage.setItem("kw.stufe2.v1", "1");
  rufe = [];
  gepflegt = {};
  original = i18n.t(SCHLUESSEL);
  pflegeNetz();
});

afterEach(() => {
  if (stand) {
    abbauen(stand);
    stand = null;
  }
  // Der mitgelieferte Text kommt für die übrigen Fälle zurück — auch wenn ein Fall scheitert.
  i18n.addResource("de", "translation", SCHLUESSEL, original);
  vi.clearAllMocks();
});

describe("R-1034 · die Karte „Übersetzungen“ an der echten Verwaltungsfläche", () => {
  it("P1 · Verwaltung › System trägt die Zeile, und sie öffnet die Karte", async () => {
    const s = montiere(adminHref("system"));
    stand = s;
    await beruhige();
    const zeile = s.container.querySelector('[data-testid="zeile-uebersetzungen"]');
    expect(zeile?.textContent).toContain(t("uebersetzungen.titel"));
    await klicke(zeile);
    expect(s.container.querySelector('[data-testid="detail-uebersetzungen"]')).not.toBeNull();
    expect(s.container.textContent).toContain(t("uebersetzungen.sprachwahlHinweis"));
  });

  it("P2 · suchen, anpassen, speichern — die eigene Oberfläche zeigt den Text sofort", async () => {
    const s = await oeffneKarte();
    const zeile = await sucheZeile(s, SCHLUESSEL);
    expect(zeile.textContent).toContain(original);

    await klicke(knopf(zeile, t("uebersetzungen.anpassen")));
    await schreibe(zeile.querySelector('[data-testid="uebersetzungen-text"]'), "Datensicherung");
    await klicke(zeile.querySelector('[data-testid="uebersetzungen-speichern"]'));
    await beruhige();

    const geschrieben = rufe.filter((r) => r.methode !== "GET");
    expect(geschrieben).toEqual([
      {
        methode: "PUT",
        pfad: `/api/admin/i18n/de/${SCHLUESSEL}`,
        rumpf: { text: "Datensicherung" },
      },
    ]);
    // Dieselbe Sitzung sieht den neuen Text sofort — über dieselbe i18n-Instanz wie jede Fläche.
    expect(i18n.t(SCHLUESSEL)).toBe("Datensicherung");
    expect(s.container.textContent).toContain(t("uebersetzungen.gespeichert"));
    const angepasst = s.container.querySelector(
      `li[data-schluessel="${SCHLUESSEL}"] [data-testid="uebersetzungen-angepasst"]`,
    );
    expect(angepasst?.textContent).toContain("Datensicherung");
  });

  it("P3 · fehlt ein Platzhalter des mitgelieferten Textes, bleibt Speichern gesperrt", async () => {
    const s = await oeffneKarte();
    const zeile = await sucheZeile(s, MIT_PLATZHALTER);
    await klicke(knopf(zeile, t("uebersetzungen.anpassen")));
    await schreibe(zeile.querySelector('[data-testid="uebersetzungen-text"]'), "Viele Texte");

    const speichern = zeile.querySelector<HTMLButtonElement>(
      '[data-testid="uebersetzungen-speichern"]',
    );
    expect(speichern?.disabled).toBe(true);
    expect(zeile.textContent).toContain("{{anzahl}}");
    await klicke(speichern);
    expect(rufe.filter((r) => r.methode !== "GET")).toEqual([]);
  });

  it("P4 · Zurücksetzen schickt das DELETE und stellt den mitgelieferten Text wieder her", async () => {
    gepflegt = { [SCHLUESSEL]: "Datensicherung" };
    const s = await oeffneKarte();
    // Die Sitzung trägt die Anpassung schon (wie nach dem Start über `bindTextpflege`).
    const { legeTexteUeber } = await import("../../apps/web/src/lib/textpflege");
    legeTexteUeber(i18n, "de", { [SCHLUESSEL]: "Datensicherung" });
    const zeile = await sucheZeile(s, SCHLUESSEL);

    await klicke(knopf(zeile, t("uebersetzungen.zuruecksetzen")));
    await beruhige();

    expect(rufe.filter((r) => r.methode !== "GET")).toEqual([
      { methode: "DELETE", pfad: `/api/admin/i18n/de/${SCHLUESSEL}`, rumpf: undefined },
    ]);
    expect(i18n.t(SCHLUESSEL)).toBe(original);
    expect(s.container.textContent).toContain(t("uebersetzungen.zurueckgesetzt"));
  });
});
