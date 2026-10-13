// @vitest-environment jsdom
// ================================================================================================
// produkt:20261013:produktbudget-anwender-admin · DIE KARTE „PRODUKTBUDGETS" — montiert.
// ================================================================================================
//
// Der Nutzerweg `/admin?bereich=ki` → Zeile → Karte über die ECHTE Verwaltung, echte i18n, ein
// Netz, das genau `GET/PUT /api/admin/produktbudget…` beantwortet. Fiktive Werte.
//
//   M1  Weg und Anzeige: Betrag, Währung, Geltung, Anbieter, Zeitraum, verbraucht, reserviert, Rest,
//       Stand, abgelöste Empfehlung, offene Nr.-32-Frage, fester Satz
//   M2  Speichern: der PUT trägt Text-Betrag, gesehene Fassung und Änderungskennung
//   M3  Unklarer Ausgang (Netzfehler): Eingabe bleibt, erneutes Speichern mit DERSELBEN Kennung
//   M4  Konflikt: neuer Stand sichtbar, Eingabe bleibt; erst der Knopf bezieht sie auf den neuen
//   M5  Englisch: Titel und Dezimalpunkt
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
import type { BudgetBereich, Produktbudgetstand } from "../../apps/web/src/api/produktbudget";
import i18n from "../../apps/web/src/i18n";
import { adminHref } from "../../apps/web/src/lib/adminSections";
import {
  type Stand,
  abbauen,
  beruhige,
  klicke,
  montiere,
  setzeStufe2,
  sprache,
  tippe,
} from "../admin-navigation/vorrichtung";

const WEG = "/api/admin/produktbudget";
const t = (key: string): string => i18n.t(key);

function bereich(teil: Partial<BudgetBereich> & Pick<BudgetBereich, "bereich">): BudgetBereich {
  return {
    betragCent: 2000,
    waehrung: "EUR",
    zeitraum: "einmalig",
    fassung: 0,
    geaendertAm: null,
    geaendertVon: null,
    anbieter: "perplexity",
    original: "produkt:20261011:assistenz-recherche-perplexity",
    abgeloest: null,
    verbrauchtCent: 0,
    reserviertCent: 0,
    verbleibendCent: 2000,
    ueberschrittenCent: 0,
    buchungen: 0,
    sperre: null,
    letzteAenderungen: [],
    ...teil,
  };
}

function stand(perplexity: Partial<BudgetBereich> = {}): Produktbudgetstand {
  return {
    gelesenAm: "2026-10-13T12:00:00.000Z",
    bereiche: [
      bereich({
        bereich: "perplexity-poc",
        abgeloest: { betragCent: 3000, waehrung: "USD" },
        verbrauchtCent: 450,
        reserviertCent: 500,
        verbleibendCent: 1050,
        buchungen: 2,
        ...perplexity,
      }),
      // PBE-12: Claude und ChatGPT nach der Übernahme von Peters bestätigter Gesamtperiode.
      bereich({
        bereich: "nr32-claude",
        anbieter: "anthropic",
        original: "produkt:20261011:peter-p03",
        fassung: 1,
        geaendertAm: "2026-10-13T13:50:00.000Z",
        geaendertVon: "vorgabe:peter-20261013",
        konten: [
          {
            konto: "u-kim",
            zuweisungCent: 800,
            unterlimitCent: 500,
            fassung: 2,
            belegtCent: 300,
            grenzeCent: 500,
          },
        ],
      }),
      bereich({
        bereich: "nr32-chatgpt",
        anbieter: "openai",
        original: "produkt:20261011:peter-p03",
      }),
    ],
  };
}

interface Antwort {
  status: number;
  body: unknown;
}

let lesen: () => Antwort = () => ({ status: 200, body: stand() });
type Schreibantwort = Antwort | "netzfehler";
let schreiben: (rumpf: Record<string, unknown>) => Schreibantwort | Promise<Schreibantwort> =
  () => ({
    status: 200,
    body: { ...stand(), wiederholt: false, geaendert: true },
  });
let puts: Record<string, unknown>[] = [];
/** Die Pfade der Schreibaufrufe — sie tragen bei der Zuweisung das Konto. */
let putPfade: string[] = [];
/** Fiktive Konten für die Auswahl der Zuweisungsfläche. */
const KONTEN = [
  { id: "u-kim", name: "Kim Fiktiv", email: "kim@beispiel.test", role: "viewer", approved: true },
  { id: "u-lea", name: "Lea Fiktiv", email: "lea@beispiel.test", role: "viewer", approved: true },
];

function netz(): void {
  puts = [];
  putPfade = [];
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: async (eingabe: unknown, init?: { method?: string; body?: string }) => {
      const pfad = String(eingabe);
      const methode = (init?.method ?? "GET").toUpperCase();
      let a: Antwort | "netzfehler";
      if (methode === "GET" && pfad.endsWith(WEG)) {
        a = lesen();
      } else if (methode === "GET" && pfad.endsWith("/api/users")) {
        a = { status: 200, body: KONTEN };
      } else if (methode === "PUT" && pfad.startsWith(`${WEG}/`)) {
        const rumpf = JSON.parse(init?.body ?? "{}") as Record<string, unknown>;
        puts.push(rumpf);
        putPfade.push(pfad);
        a = await schreiben(rumpf);
      } else {
        throw new Error(`kein Netz in diesem Prüfstand: ${methode} ${pfad}`);
      }
      if (a === "netzfehler") {
        throw new TypeError("Failed to fetch");
      }
      return {
        status: a.status,
        ok: a.status < 400,
        statusText: a.status < 400 ? "OK" : "Fehler",
        text: async () => JSON.stringify(a.body),
      };
    },
  });
}

let aktiv: Stand | null = null;

beforeEach(() => {
  setzeStufe2(true);
  lesen = () => ({ status: 200, body: stand() });
  schreiben = () => ({ status: 200, body: { ...stand(), wiederholt: false, geaendert: true } });
  netz();
});

afterEach(async () => {
  if (aktiv) {
    abbauen(aktiv);
    aktiv = null;
  }
  await sprache("de");
  vi.clearAllMocks();
});

async function karte(): Promise<Stand> {
  const s = montiere(adminHref("ki", "produktbudget"));
  aktiv = s;
  await beruhige();
  expect(s.container.querySelector('[data-testid="detail-produktbudget"]')).not.toBeNull();
  return s;
}

function text(s: Stand, testId: string): string {
  return s.container.querySelector(`[data-testid="${testId}"]`)?.textContent ?? "";
}

function eingabe(s: Stand, id: string): HTMLInputElement {
  const feld = s.container.querySelector(`[data-testid="pb-eingabe-betrag-${id}"]`);
  if (!(feld instanceof window.HTMLInputElement)) {
    throw new Error("Betragsfeld fehlt");
  }
  return feld;
}

describe("M1 · Weg und Anzeige", () => {
  it("unter „KI“ steht die Zeile; die Karte zeigt jeden Bereich vollständig", async () => {
    const s = montiere(adminHref("ki"));
    aktiv = s;
    await beruhige();
    const zeile = s.container.querySelector('[data-testid="zeile-ki-produktbudget"]');
    expect(zeile?.textContent).toContain(t("produktbudget.titel"));
    await klicke(zeile);
    expect(s.container.querySelector('[data-testid="detail-produktbudget"]')).not.toBeNull();
    expect(text(s, "ort")).toBe(adminHref("ki", "produktbudget"));

    expect(text(s, "pb-anbieter-perplexity-poc")).toBe(t("produktbudget.anbieter.perplexity"));
    expect(text(s, "pb-geltung-perplexity-poc")).toBe(t("produktbudget.geltung.perplexity-poc"));
    expect(text(s, "pb-betrag-perplexity-poc")).toBe("20,00 EUR");
    expect(text(s, "pb-zeitraum-perplexity-poc")).toBe(t("produktbudget.zeitraum.einmalig"));
    expect(text(s, "pb-verbraucht-perplexity-poc")).toBe("4,50 EUR");
    expect(text(s, "pb-reserviert-perplexity-poc")).toBe("5,00 EUR");
    expect(text(s, "pb-verbleibend-perplexity-poc")).toBe("10,50 EUR");
    expect(text(s, "pb-kostenweg-perplexity-poc")).toBe(t("produktbudget.kostenweg.offen"));
    expect(text(s, "pb-stand-perplexity-poc")).toBe(t("produktbudget.stand.vorgabe"));
    expect(text(s, "pb-abgeloest-perplexity-poc")).toContain("30,00 USD");

    // PBE-12: alle drei einmalig; keine überholte „offene Frage“ mehr.
    for (const id of ["nr32-claude", "nr32-chatgpt"]) {
      expect(text(s, `pb-zeitraum-${id}`)).toBe(t("produktbudget.zeitraum.einmalig"));
      expect(text(s, `pb-kostenweg-${id}`)).toBe(t("produktbudget.kostenweg.offen"));
      expect(s.container.querySelector(`[data-testid="pb-frage-${id}"]`)).toBeNull();
    }
    // Zuweisungen je Konto stehen in der Verwaltungskarte.
    expect(text(s, "pb-konto-nr32-claude-u-kim")).toContain("8,00 EUR");
    expect(text(s, "pb-konto-nr32-claude-u-kim")).toContain("5,00 EUR");
    expect(text(s, "pb-zuweisungen-nr32-chatgpt")).toContain(t("produktbudget.zuweisung.keine"));
    expect(text(s, "pb-anbieter-nr32-claude")).toBe(t("produktbudget.anbieter.anthropic"));
    expect(text(s, "pb-anbieter-nr32-chatgpt")).toBe(t("produktbudget.anbieter.openai"));
    expect(text(s, "produktbudget-ehrlichkeit")).toBe(t("produktbudget.ehrlichkeit"));
    expect(t("produktbudget.ehrlichkeit")).not.toBe("produktbudget.ehrlichkeit");
    expect(puts, "die Anzeige schreibt nichts").toEqual([]);
  });
});

describe("M2 · Speichern", () => {
  it("der PUT trägt Text-Betrag, gesehene Fassung und eine Änderungskennung; danach der neue Stand", async () => {
    schreiben = () => ({
      status: 200,
      body: {
        ...stand({ betragCent: 2500, verbleibendCent: 1550, fassung: 1 }),
        wiederholt: false,
        geaendert: true,
      },
    });
    const s = await karte();
    await tippe(eingabe(s, "perplexity-poc"), "25");
    await klicke(s.container.querySelector('[data-testid="pb-speichern-perplexity-poc"]'));
    expect(puts).toHaveLength(1);
    expect(puts[0]).toMatchObject({
      betrag: "25",
      waehrung: "EUR",
      zeitraum: "einmalig",
      fassung: 0,
    });
    expect(String(puts[0]?.aenderungId)).toMatch(/^pb-[0-9a-f]{32}$/);
    expect(puts[0]).not.toHaveProperty("mandant");
    expect(text(s, "pb-betrag-perplexity-poc")).toBe("25,00 EUR");
    expect(text(s, "pb-meldung-perplexity-poc")).toBe(t("produktbudget.gespeichert"));
  });
});

describe("M3 · unklarer Schreibausgang", () => {
  it("Netzfehler: die Eingabe bleibt; erneutes Speichern sendet DIESELBE Änderungskennung", async () => {
    let erster = true;
    schreiben = () => {
      if (erster) {
        erster = false;
        return "netzfehler";
      }
      return {
        status: 200,
        body: { ...stand({ betragCent: 2600, fassung: 1 }), wiederholt: true, geaendert: false },
      };
    };
    const s = await karte();
    await tippe(eingabe(s, "perplexity-poc"), "26");
    const knopf = s.container.querySelector('[data-testid="pb-speichern-perplexity-poc"]');
    await klicke(knopf);
    expect(text(s, "pb-meldung-perplexity-poc")).toBe(t("produktbudget.fehler.unklar"));
    expect(eingabe(s, "perplexity-poc").value, "die Eingabe ist verloren").toBe("26");
    await klicke(knopf);
    expect(puts).toHaveLength(2);
    expect(puts[1]?.aenderungId).toBe(puts[0]?.aenderungId);
    expect(text(s, "pb-betrag-perplexity-poc")).toBe("26,00 EUR");
  });
});

describe("M3b · Antwortverlust, danach geänderte Eingabe (Ben, nacharbeit-2)", () => {
  it("die geänderte Eingabe bekommt eine NEUE Kennung und wird gespeichert, nicht verworfen", async () => {
    let erster = true;
    schreiben = (rumpf) => {
      if (erster) {
        erster = false;
        return "netzfehler"; // die erste Sendung (26) ging verloren
      }
      return {
        status: 200,
        body: {
          ...stand({ betragCent: 2700, fassung: 1 }),
          wiederholt: false,
          geaendert: rumpf.betrag === "27",
        },
      };
    };
    const s = await karte();
    await tippe(eingabe(s, "perplexity-poc"), "26");
    const knopf = s.container.querySelector('[data-testid="pb-speichern-perplexity-poc"]');
    await klicke(knopf);
    expect(text(s, "pb-meldung-perplexity-poc")).toBe(t("produktbudget.fehler.unklar"));
    await tippe(eingabe(s, "perplexity-poc"), "27");
    await klicke(knopf);
    expect(puts).toHaveLength(2);
    expect(puts[1]).toMatchObject({ betrag: "27", fassung: 0 });
    expect(puts[1]?.aenderungId, "die alte Kennung stünde für eine andere Eingabe").not.toBe(
      puts[0]?.aenderungId,
    );
    expect(text(s, "pb-betrag-perplexity-poc")).toBe("27,00 EUR");
    expect(text(s, "pb-meldung-perplexity-poc")).toBe(t("produktbudget.gespeichert"));
  });
});

describe("M3c · Eingabe während des Speicherns", () => {
  it("die alte Antwort löscht nur den bestätigten Entwurf; die neue Eingabe bleibt", async () => {
    let freigeben: ((a: Schreibantwort) => void) | null = null;
    schreiben = (rumpf) =>
      rumpf.betrag === "25"
        ? new Promise<Schreibantwort>((ja) => {
            freigeben = ja;
          })
        : {
            status: 200,
            body: {
              ...stand({ betragCent: 3000, fassung: 2 }),
              wiederholt: false,
              geaendert: true,
            },
          };
    const s = await karte();
    await tippe(eingabe(s, "perplexity-poc"), "25");
    await klicke(s.container.querySelector('[data-testid="pb-speichern-perplexity-poc"]'));
    expect(puts).toHaveLength(1);
    // Die Antwort steht noch aus — die Person tippt weiter.
    await tippe(eingabe(s, "perplexity-poc"), "30");
    await act(async () => {
      (freigeben as ((a: Schreibantwort) => void) | null)?.({
        status: 200,
        body: {
          ...stand({ betragCent: 2500, fassung: 1 }),
          wiederholt: false,
          geaendert: true,
          bestaetigteFassung: 1,
        },
      });
      await new Promise((r) => setTimeout(r, 0));
    });
    await beruhige(5);
    expect(text(s, "pb-betrag-perplexity-poc")).toBe("25,00 EUR");
    expect(eingabe(s, "perplexity-poc").value, "die neue Eingabe wurde verworfen").toBe("30");
    expect(text(s, "pb-meldung-perplexity-poc")).toBe(t("produktbudget.gespeichertWeitere"));
    // Gespeichert wird sie als NEUE Änderung auf der eben bestätigten eigenen Fassung.
    await klicke(s.container.querySelector('[data-testid="pb-speichern-perplexity-poc"]'));
    expect(puts).toHaveLength(2);
    expect(puts[1]).toMatchObject({ betrag: "30", fassung: 1 });
    expect(puts[1]?.aenderungId).not.toBe(puts[0]?.aenderungId);
    expect(text(s, "pb-betrag-perplexity-poc")).toBe("30,00 EUR");
  });
});

describe("M3d · fremde Änderung zwischen eigener Speicherung und Antwort (Ben, nacharbeit-3)", () => {
  it("die Folgeeingabe beruht auf der EIGENEN bestätigten Fassung — die fremde löst 409 aus", async () => {
    let freigeben: ((a: Schreibantwort) => void) | null = null;
    schreiben = (rumpf) =>
      rumpf.betrag === "25"
        ? new Promise<Schreibantwort>((ja) => {
            freigeben = ja;
          })
        : {
            // Der Server prüft die Fassung: die Folgeeingabe trägt die eigene (1), der Stand ist 2.
            status: rumpf.fassung === 2 ? 200 : 409,
            body:
              rumpf.fassung === 2
                ? {
                    ...stand({ betragCent: 3000, fassung: 3 }),
                    wiederholt: false,
                    geaendert: true,
                  }
                : {
                    error: "CONFLICT",
                    grund: "konflikt",
                    message: "geändert",
                    stand: stand({ betragCent: 1800, fassung: 2 }),
                  },
          };
    const s = await karte();
    await tippe(eingabe(s, "perplexity-poc"), "25");
    await klicke(s.container.querySelector('[data-testid="pb-speichern-perplexity-poc"]'));
    await tippe(eingabe(s, "perplexity-poc"), "30");
    // Die eigene Änderung stellte Fassung 1 her; bis zum Lesen des Antwortstands hat eine andere
    // Person schon Fassung 2 (18,00 EUR) gespeichert.
    await act(async () => {
      (freigeben as ((a: Schreibantwort) => void) | null)?.({
        status: 200,
        body: {
          ...stand({ betragCent: 1800, fassung: 2 }),
          wiederholt: false,
          geaendert: true,
          bestaetigteFassung: 1,
        },
      });
      await new Promise((r) => setTimeout(r, 0));
    });
    await beruhige(5);
    expect(eingabe(s, "perplexity-poc").value).toBe("30");
    await klicke(s.container.querySelector('[data-testid="pb-speichern-perplexity-poc"]'));
    expect(puts).toHaveLength(2);
    expect(puts[1], "die fremde Fassung 2 wurde still als Grundlage übernommen").toMatchObject({
      betrag: "30",
      fassung: 1,
    });
    expect(text(s, "pb-meldung-perplexity-poc")).toBe(t("produktbudget.fehler.konflikt"));
    expect(text(s, "pb-betrag-perplexity-poc")).toBe("18,00 EUR");
    expect(eingabe(s, "perplexity-poc").value).toBe("30");
  });
});

describe("M4 · Konflikt", () => {
  it("409: neuer Stand sichtbar, Eingabe bleibt; erst der Knopf bezieht sie auf die neue Fassung", async () => {
    let runde = 0;
    schreiben = () => {
      runde += 1;
      if (runde === 1) {
        return {
          status: 409,
          body: {
            error: "CONFLICT",
            grund: "konflikt",
            message: "geändert",
            stand: stand({ betragCent: 1800, verbleibendCent: 850, fassung: 1 }),
          },
        };
      }
      return {
        status: 200,
        body: {
          ...stand({ betragCent: 2700, fassung: 2 }),
          wiederholt: false,
          geaendert: true,
        },
      };
    };
    const s = await karte();
    await tippe(eingabe(s, "perplexity-poc"), "27");
    await klicke(s.container.querySelector('[data-testid="pb-speichern-perplexity-poc"]'));
    expect(text(s, "pb-meldung-perplexity-poc")).toBe(t("produktbudget.fehler.konflikt"));
    expect(text(s, "pb-betrag-perplexity-poc")).toBe("18,00 EUR");
    expect(eingabe(s, "perplexity-poc").value).toBe("27");

    await klicke(
      s.container.querySelector('[data-testid="pb-konflikt-uebernehmen-perplexity-poc"]'),
    );
    await klicke(s.container.querySelector('[data-testid="pb-speichern-perplexity-poc"]'));
    expect(puts).toHaveLength(2);
    expect(puts[1]).toMatchObject({ betrag: "27", fassung: 1 });
    expect(puts[1]?.aenderungId).not.toBe(puts[0]?.aenderungId);
    expect(text(s, "pb-betrag-perplexity-poc")).toBe("27,00 EUR");
  });
});

/** Eine Auswahl ändern — über den NATIVEN Setter, sonst sieht React sie nicht. */
async function waehle(feld: Element | null, wert: string): Promise<void> {
  if (!(feld instanceof window.HTMLSelectElement)) {
    throw new Error("Auswahlfeld nicht gefunden.");
  }
  const setzer = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
  await act(async () => {
    setzer?.call(feld, wert);
    feld.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
  });
  await beruhige(2);
}

describe("MZ · Zuweisung mit verzögerter Antwort (Ben, nacharbeit-6)", () => {
  it("Konto und Betrag sind während des Speicherns gesperrt; die Antwort leert nur den gesendeten Entwurf", async () => {
    let freigeben: ((a: Schreibantwort) => void) | null = null;
    schreiben = () =>
      new Promise<Schreibantwort>((ja) => {
        freigeben = ja;
      });
    const s = await karte();
    const konto = (): HTMLSelectElement =>
      s.container.querySelector(
        '[data-testid="pb-zuweisung-konto-nr32-chatgpt"]',
      ) as HTMLSelectElement;
    const betrag = (): HTMLInputElement =>
      s.container.querySelector(
        '[data-testid="pb-zuweisung-betrag-nr32-chatgpt"]',
      ) as HTMLInputElement;
    await waehle(konto(), "u-kim");
    await tippe(betrag(), "6");
    await klicke(s.container.querySelector('[data-testid="pb-zuweisung-speichern-nr32-chatgpt"]'));
    expect(putPfade).toEqual([`${WEG}/nr32-chatgpt/konten/u-kim`]);
    expect(puts).toEqual([{ zuweisung: "6", fassung: 0 }]);
    // Während die Antwort aussteht: beide Felder gesperrt, Kontowechsel und Folgebetrag wirkungslos.
    expect(konto().disabled).toBe(true);
    expect(betrag().disabled).toBe(true);
    await waehle(konto(), "u-lea");
    await tippe(betrag(), "7");
    const bestaetigt = stand();
    const chatgpt = bestaetigt.bereiche.find((b) => b.bereich === "nr32-chatgpt");
    if (chatgpt) {
      chatgpt.konten = [
        {
          konto: "u-kim",
          zuweisungCent: 600,
          unterlimitCent: null,
          fassung: 1,
          belegtCent: 0,
          grenzeCent: 600,
        },
      ];
    }
    await act(async () => {
      (freigeben as ((a: Schreibantwort) => void) | null)?.({ status: 200, body: bestaetigt });
      await new Promise((r) => setTimeout(r, 0));
    });
    await beruhige(5);
    expect(konto().disabled).toBe(false);
    expect(konto().value, "das gesendete Konto wurde still gewechselt").toBe("u-kim");
    expect(betrag().value).toBe("");
    expect(text(s, "pb-konto-nr32-chatgpt-u-kim")).toContain("6,00 EUR");
    // Ein Wechsel NACH der Antwort ist ein neuer Vorgang — mit der Fassung des anderen Kontos.
    await waehle(konto(), "u-lea");
    await tippe(betrag(), "7");
    await klicke(s.container.querySelector('[data-testid="pb-zuweisung-speichern-nr32-chatgpt"]'));
    expect(putPfade[1]).toBe(`${WEG}/nr32-chatgpt/konten/u-lea`);
    expect(puts[1]).toEqual({ zuweisung: "7", fassung: 0 });
  });
});

describe("M5 · Sprache", () => {
  it("Englisch: Titel übersetzt, Beträge mit Dezimalpunkt", async () => {
    const s = await karte();
    await sprache("en");
    expect(s.container.textContent).toContain("Product budgets");
    expect(text(s, "pb-betrag-perplexity-poc")).toBe("20.00 EUR");
    const englisch = t("produktbudget.ehrlichkeit");
    expect(text(s, "produktbudget-ehrlichkeit")).toBe(englisch);
    expect(englisch).not.toBe(i18n.getFixedT("de")("produktbudget.ehrlichkeit"));
  });
});
