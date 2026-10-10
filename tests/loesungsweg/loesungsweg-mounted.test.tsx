// @vitest-environment jsdom
// ================================================================================================
// R-1662 · GEFÜHRTER WEG VOM PROBLEM ZUR LÖSUNG — an der ECHTEN Fragen-Seite.
// ================================================================================================
//
// Die Ableitung (problemloesungsweg.test.ts) belegt die Regeln; diese Datei belegt, dass der Leser
// sie bekommt: „Was vermeiden" als Warnung direkt an der Antwort, der Knopf „Lösungsweg" und im
// Blatt Rahmung, belastbarste Quelle, bekannte Fehler, Personen mit Wissensspuren und den Weg zum
// neuen Fall. Im Lückenfall gibt es keinen Lösungsweg-Knopf; die Lückenkarte bleibt, wie sie ist.
import { afterEach, describe, expect, it, vi } from "vitest";

const bestand = vi.hoisted(() => ({
  kos: [] as unknown[],
  antwort: null as unknown,
  // Ben, Nacharbeit 2: gelöste Konflikte und Revalidierungsliste (Prüfpunkte 5 und 6).
  geloest: [] as unknown[],
  faellig: [] as string[],
  faelligFehler: false,
  // Ben, Nacharbeit 5: frühere Bestätigungen aus `ko.revalidated`.
  revalidiert: [] as unknown[],
}));

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ko: { list: vi.fn(async () => bestand.kos) },
    conflicts: {
      list: vi.fn(async () => []),
      geloest: vi.fn(async () => bestand.geloest),
    },
    lifecycle: {
      pending: vi.fn(async () => {
        if (bestand.faelligFehler) {
          throw new Error("Revalidierungsliste nicht erreichbar");
        }
        return bestand.faellig;
      }),
      revalidiert: vi.fn(async () => bestand.revalidiert),
    },
    directory: {
      list: vi.fn(async () => [
        { id: "u1", name: "Anna Ventil" },
        { id: "u2", name: "Bernd Dichtung" },
        { id: "u3", name: "Carla Ursprung" },
      ]),
    },
    reasoner: {
      status: vi.fn(async () => ({
        active: true,
        mode: "cloud",
        reachable: "active",
        tasks: { answer: true },
      })),
    },
    ask: {
      ask: vi.fn(async () => bestand.antwort),
      helpful: vi.fn(),
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
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Ask } from "../../apps/web/src/pages/Ask";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

const PROVEN = {
  available: 4,
  selected: 4,
  alreadyOpen: 0,
  attempted: 4,
  completed: 4,
  skipped: 0,
  capped: false,
  aborted: false,
};

function ko(
  id: string,
  title: string,
  type: string,
  author: string,
  originalAuthor: string,
): Record<string, unknown> {
  return {
    id,
    title,
    statement: `${title}: Druck an Maschine 4 prüfen.`,
    type,
    category: "Betrieb",
    status: "validiert",
    trust: 90,
    author,
    originalAuthor,
    createdAt: "2026-01-01T00:00:00.000Z",
    aiCheck: { status: "done", coverage: PROVEN },
  };
}

function antwort(sources: string[], cited: string[]): unknown {
  return {
    result: {
      answered: true,
      answer: "Den Druckspeicher an Maschine 4 prüfen.",
      knowledgeClass: "gesichert",
      trust: 90,
      sources,
      citedSources: cited,
      steps: [],
      demo: false,
      captionSources: [],
    },
    gap: null,
    receipt: "r",
  };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mountAsk(): Promise<{ container: HTMLElement; unmount: () => void }> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          MemoryRouter,
          { initialEntries: ["/fragen?q=Maschine%204%20Druck&ask=1"] },
          createElement(ToastProvider, null, createElement(Ask)),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

async function blattOeffnen(container: HTMLElement): Promise<HTMLElement> {
  const knopf = container.querySelector<HTMLButtonElement>('[data-testid="ask-loesungsweg"]');
  expect(knopf, "der Knopf „Lösungsweg“ fehlt an der Antwort").not.toBeNull();
  expect(knopf?.textContent).toBe(i18n.t("loesungsweg.oeffnen"));
  await act(async () => {
    knopf?.click();
    await flush();
  });
  const blatt = document.querySelector<HTMLElement>('[data-testid="ask-loesungsweg-blatt"]');
  expect(blatt, "das Blatt „Lösungsweg“ geht nicht auf").not.toBeNull();
  return blatt as HTMLElement;
}

const LOESUNG = ko("k1", "Druckspeicher prüfen", "best_practice", "u1", "u1");
const FEHLER = ko("k2", "Dichtung nicht nachziehen", "negativwissen", "u2", "u3");

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
  bestand.geloest = [];
  bestand.faellig = [];
  bestand.faelligFehler = false;
  bestand.revalidiert = [];
});

describe("R-1662 · Lösungsweg an der echten Fragen-Seite", () => {
  it("Negativwissen steht als „Was vermeiden“ im Warnblock direkt an der Antwort", async () => {
    await i18n.changeLanguage("de");
    bestand.kos = [LOESUNG, FEHLER];
    bestand.antwort = antwort(["k1", "k2"], ["k1"]);
    const { container, unmount } = await mountAsk();

    const warnungen = container.querySelector('[data-testid="ask-warnungen"]');
    const vermeiden = warnungen?.querySelector('[data-testid="ask-vermeiden"]');
    expect(vermeiden, "die Warnung „Was vermeiden“ fehlt im Warnblock").not.toBeNull();
    expect(vermeiden?.textContent).toContain(i18n.t("loesungsweg.vermeiden.titel"));
    const link = vermeiden?.querySelector<HTMLAnchorElement>(
      '[data-testid="ask-vermeiden-quelle"]',
    );
    expect(link?.textContent).toBe("Dichtung nicht nachziehen");
    expect(link?.getAttribute("href")).toBe("/wissen/k2");
    // Die Lösungsquelle ist KEIN Negativwissen und steht deshalb nicht in der Warnung.
    expect(vermeiden?.textContent).not.toContain("Druckspeicher prüfen");
    unmount();
  });

  it("das Blatt führt Schritt für Schritt: Rahmung, Quelle, Fehler, Personen, neuer Fall", async () => {
    await i18n.changeLanguage("de");
    bestand.kos = [LOESUNG, FEHLER];
    bestand.antwort = antwort(["k1", "k2"], ["k1", "k2"]);
    const { container, unmount } = await mountAsk();
    // Vor dem Griff steht kein Blatt da.
    expect(document.querySelector('[data-testid="ask-loesungsweg-blatt"]')).toBeNull();
    const blatt = await blattOeffnen(container);

    // Rahmung: belastbarste Hinweise, keine endgültige Lösung — bei belegter Einstufung.
    expect(blatt.querySelector('[data-testid="ask-loesungsweg-hinweis"]')?.textContent).toBe(
      i18n.t("loesungsweg.hinweis.geprueft"),
    );
    const quelle = blatt.querySelector('[data-testid="ask-loesungsweg-quelle"] a');
    expect(quelle?.textContent).toBe("Druckspeicher prüfen");
    expect(quelle?.getAttribute("href")).toBe("/wissen/k1");
    expect(blatt.querySelector('[data-testid="ask-loesungsweg-vermeiden"]')?.textContent).toContain(
      "Dichtung nicht nachziehen",
    );
    // Autor und Originalautor der tragenden Quellen — mit Namen aus dem Verzeichnis.
    const personen = [...blatt.querySelectorAll('[data-testid="ask-loesungsweg-person"]')].map(
      (p) => p.textContent ?? "",
    );
    expect(personen).toHaveLength(3);
    expect(personen[0]).toContain("Anna Ventil");
    expect(personen[0]).toContain("Druckspeicher prüfen");
    expect(personen[2]).toContain("Carla Ursprung");
    expect(personen[2]).toContain("Dichtung nicht nachziehen");
    // Keine erfundene Anfragefunktion: die Grenze ist ausgesprochen.
    expect(blatt.textContent).toContain(i18n.t("loesungsweg.personenGrenze"));
    // Neuer Fall: über RoleLink zur Erfassung (Rolle „experte" darf ihn gehen).
    const fall = blatt.querySelector('[data-testid="ask-loesungsweg-erfassen"]');
    expect(fall?.getAttribute("href")).toBe("/erfassen");
    unmount();
  });

  it("ungeprüfte Grundlage: die Rahmung sagt nicht „validiert“", async () => {
    await i18n.changeLanguage("de");
    bestand.kos = [{ ...LOESUNG, aiCheck: undefined }];
    bestand.antwort = antwort(["k1"], ["k1"]);
    const { container, unmount } = await mountAsk();
    const blatt = await blattOeffnen(container);
    const hinweis = blatt.querySelector('[data-testid="ask-loesungsweg-hinweis"]')?.textContent;
    expect(hinweis).toBe(i18n.t("loesungsweg.hinweis.ungeprueft"));
    expect(hinweis).not.toContain("validiert");
    unmount();
  });

  it("ohne Negativwissen: keine Vermeiden-Warnung und kein Vermeiden-Schritt", async () => {
    await i18n.changeLanguage("de");
    bestand.kos = [LOESUNG];
    bestand.antwort = antwort(["k1"], ["k1"]);
    const { container, unmount } = await mountAsk();
    expect(container.querySelector('[data-testid="ask-vermeiden"]')).toBeNull();
    const blatt = await blattOeffnen(container);
    expect(blatt.querySelector('[data-testid="ask-loesungsweg-vermeiden"]')).toBeNull();
    unmount();
  });

  // Ben, Nacharbeit 2 — Prüfpunkte 5 und 6 des Addendums an der echten Seite.
  it("gelöste Konflikte und fällige Revalidierung stehen mit ihren Quellen im Blatt", async () => {
    await i18n.changeLanguage("de");
    const ALT = ko("k9", "Druck nach 20 Minuten nachregeln", "technik", "u2", "u2");
    bestand.kos = [LOESUNG, ALT];
    bestand.antwort = antwort(["k1"], ["k1"]);
    bestand.geloest = [
      {
        id: "c1",
        koA: "k9",
        koB: "k1",
        type: "truth",
        description: "Widerspruch zur Druckangabe.",
        status: "geloest",
        secondOpinion: null,
        decidedBy: "u3",
        decision: "Druckspeicher zuerst; Nachregeln nur bei Baureihe 3.",
        resolutionReason: "decided",
        createdAt: "2026-02-01T00:00:00.000Z",
      },
    ];
    bestand.faellig = ["k1", "fremd"];
    const { container, unmount } = await mountAsk();
    const blatt = await blattOeffnen(container);
    await act(flush);

    const konflikte = [...blatt.querySelectorAll('[data-testid="ask-loesungsweg-konflikt"]')];
    expect(konflikte, "der gelöste Konflikt der Quelle fehlt im Blatt").toHaveLength(1);
    const k = konflikte[0] as HTMLElement;
    expect(k.textContent).toContain("Druckspeicher prüfen");
    expect(k.textContent).toContain("Druck nach 20 Minuten nachregeln");
    expect(k.textContent).toContain(i18n.t("loesungsweg.konflikt.entschieden"));
    expect(k.textContent).toContain("Druckspeicher zuerst; Nachregeln nur bei Baureihe 3.");
    expect([...k.querySelectorAll("a")].map((a) => a.getAttribute("href"))).toEqual([
      "/wissen/k1",
      "/wissen/k9",
    ]);

    const faelle = [
      ...blatt.querySelectorAll('[data-testid="ask-loesungsweg-revalidierung-fall"]'),
    ];
    expect(faelle, "nur die Quelle der Antwort, nicht der fremde Fall").toHaveLength(1);
    expect(faelle[0]?.textContent).toContain("Druckspeicher prüfen");
    expect(blatt.textContent).toContain(i18n.t("loesungsweg.revalidierung.text"));
    // /lebenszyklus verlangt „controller": die Expertin sieht die Lage, keinen toten Link.
    const fallLink = blatt.querySelector('[data-testid="ask-loesungsweg-revalidierung-link"]');
    expect(fallLink?.getAttribute("data-role-no-reach")).toBe("true");
    // Abgerufen wird mit genau den Quellen der Antwort.
    const { endpoints } = await import("../../apps/web/src/api/endpoints");
    expect(endpoints.conflicts.geloest).toHaveBeenCalledWith(["k1"]);
    unmount();
  });

  // Ben, Nacharbeit 5 — frühere Bestätigungen stehen GETRENNT von offenen Fällen.
  it("frühere Revalidierung: bestätigte Quelle unter „Früher bestätigt“, offene unter „Offen“", async () => {
    await i18n.changeLanguage("de");
    bestand.kos = [LOESUNG, FEHLER];
    bestand.antwort = antwort(["k1", "k2"], ["k1"]);
    bestand.faellig = ["k1"];
    bestand.revalidiert = [
      { koId: "k2", am: "2026-05-01T08:00:00.000Z", version: 6 },
      { koId: "k2", am: "2026-03-01T08:00:00.000Z", version: 4 },
    ];
    const { container, unmount } = await mountAsk();
    const blatt = await blattOeffnen(container);
    await act(flush);

    const offenTeil = blatt.querySelector('[data-testid="ask-loesungsweg-revalidierung-offen"]');
    expect(offenTeil?.textContent).toContain("Druckspeicher prüfen");
    expect(offenTeil?.textContent).not.toContain("Dichtung nicht nachziehen");

    const frueherTeil = blatt.querySelector(
      '[data-testid="ask-loesungsweg-revalidierung-frueher"]',
    );
    const zeilen = '[data-testid="ask-loesungsweg-revalidierung-bestaetigt"]';
    const bestaetigt = frueherTeil ? [...frueherTeil.querySelectorAll(zeilen)] : [];
    expect(bestaetigt, "nur die bestätigte Quelle, nicht die offene").toHaveLength(1);
    const zeile = bestaetigt[0]?.textContent ?? "";
    expect(zeile).toContain("Dichtung nicht nachziehen");
    expect(zeile).toContain("Fassung 6");
    expect(zeile).toContain("Bestätigungen insgesamt: 2");
    expect(bestaetigt[0]?.querySelector("a")?.getAttribute("href")).toBe("/wissen/k2");
    // Abgerufen wird mit genau den Quellen der Antwort.
    const { endpoints } = await import("../../apps/web/src/api/endpoints");
    expect(endpoints.lifecycle.revalidiert).toHaveBeenCalledWith(["k1", "k2"]);
    unmount();
  });

  it("nichts gefunden heisst „keine“ — ein Abruffehler heisst „nicht abrufbar“, nie „keine“", async () => {
    await i18n.changeLanguage("de");
    bestand.kos = [LOESUNG];
    bestand.antwort = antwort(["k1"], ["k1"]);
    bestand.faelligFehler = true;
    const { container, unmount } = await mountAsk();
    const blatt = await blattOeffnen(container);
    await act(flush);

    const konflikte = blatt.querySelector('[data-testid="ask-loesungsweg-konflikte"]');
    expect(konflikte?.textContent).toContain(i18n.t("loesungsweg.konflikt.keine"));
    const reval = blatt.querySelector('[data-testid="ask-loesungsweg-revalidierung"]');
    expect(reval?.textContent).toContain(i18n.t("loesungsweg.stand.fehler"));
    expect(reval?.textContent).not.toContain(i18n.t("loesungsweg.revalidierung.keine"));
    unmount();
  });

  it("ohne geöffnetes Blatt wird weder nach Konflikten noch nach Revalidierung gefragt", async () => {
    await i18n.changeLanguage("de");
    bestand.kos = [LOESUNG];
    bestand.antwort = antwort(["k1"], ["k1"]);
    const { container, unmount } = await mountAsk();
    expect(container.querySelector('[data-testid="ask-loesungsweg"]')).not.toBeNull();
    const { endpoints } = await import("../../apps/web/src/api/endpoints");
    expect(endpoints.conflicts.geloest).not.toHaveBeenCalled();
    expect(endpoints.lifecycle.pending).not.toHaveBeenCalled();
    unmount();
  });

  it("Lückenfall: kein Lösungsweg-Knopf — die Lückenkarte bleibt der Weg", async () => {
    await i18n.changeLanguage("de");
    bestand.kos = [LOESUNG];
    bestand.antwort = {
      result: {
        answered: false,
        answer: null,
        knowledgeClass: "unbekannt",
        trust: 0,
        sources: [],
        citedSources: [],
        steps: [],
        demo: false,
        captionSources: [],
      },
      gap: { id: "g1", question: "Maschine 4 Druck", status: "offen", priority: "mittel" },
      receipt: "r",
    };
    const { container, unmount } = await mountAsk();
    expect(container.querySelector('[data-testid="ask-gap"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="ask-loesungsweg"]')).toBeNull();
    unmount();
  });

  it("EN und NL tragen eigene Texte (kein deutscher Rückfall)", async () => {
    for (const sprache of ["en", "nl"] as const) {
      await i18n.changeLanguage(sprache);
      expect(i18n.t("loesungsweg.oeffnen")).not.toBe("Lösungsweg");
      expect(i18n.t("loesungsweg.hinweis.geprueft")).not.toContain("validierten");
    }
    await i18n.changeLanguage("de");
  });
});
