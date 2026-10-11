// @vitest-environment jsdom
// ================================================================================================
// R-1639 · R-2183 · R-0751 (Nacharbeit 3) — MEIN BEREICH UND DIE PFLEGE SEINER EINGÄNGE, GEMOUNTET.
// ================================================================================================
//
// Die Ableitung belegen services/management/src/horizon.test.ts (H1–H5), die Türen
// services/app/src/management-routes.test.ts. Dieser Test rendert die beiden Flächen der
// Risiko-Seite mit einer Antwort in Serverform; die Endpointgrenze ist die einzige Attrappe.
//   R1  Bereich mit Verantwortlichem, Bus-Faktor 1, Kritikalität, Trägern mit Frist und Arbeitsvorrat;
//       der 24-Monats-Filter blendet den 36-Monats-Träger aus
//   R2  ohne eigenen Bereich: der ehrliche Leersatz, keine Hauszahlen
//   P1  Pflege: Stufen/Verantwortung speichern und einen Ruhestandshorizont setzen — genau diese Werte
//       gehen an den Server
// Die Namen sind erfundene Testpersonen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  areas: [] as unknown[],
  seesAll: false,
  // R3 (Nacharbeit 5): die vollständige Antwort aus der ECHTEN Ableitung `riskHorizon`.
  antwort: null as unknown,
  setCategoryProfile: vi.fn(async (body: unknown) => body),
  // Nacharbeit 3: der Server MERKT sich den Horizont — die Profilabfrage liefert ihn danach aus.
  ruhestand: [] as { userId: string; horizonMonths: number }[],
  // P4: ab hier scheitert jeder weitere Abruf der Profile (Auffrischung nach dem Speichern).
  profileScheitern: false,
  setRetirement: vi.fn(async (_userId: string, _h: unknown) => ({ entry: null })),
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    management: {
      riskHorizon: vi.fn(async () =>
        d.antwort !== null
          ? d.antwort
          : { generatedAt: "2026-10-04T00:00:00.000Z", seesAll: d.seesAll, areas: d.areas },
      ),
      profiles: vi.fn(async () => {
        if (d.profileScheitern) {
          throw new Error("Pruefstand: Auffrischung gestoert");
        }
        return { categories: [], retirement: d.ruhestand };
      }),
      setCategoryProfile: d.setCategoryProfile,
      setRetirement: d.setRetirement,
    },
    directory: {
      list: vi.fn(async () => [
        { id: "u-mara", name: "Mara Beispiel" },
        { id: "u-rosa", name: "Rosa Beispiel" },
        { id: "u-tom", name: "Tom Beispiel" },
      ]),
    },
    ko: { list: vi.fn(async () => [{ id: "k1", category: "Presse", status: "offen" }]) },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { BereichsprofilPflege } from "../../apps/web/src/components/BereichsprofilPflege";
import { RisikoHorizont } from "../../apps/web/src/components/RisikoHorizont";
import i18n from "../../apps/web/src/i18n";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";
import type { KnowledgeObject } from "../../services/knowledge-object";
import { riskHorizon } from "../../services/management/src/horizon";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(komponente: typeof RisikoHorizont): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // Die App-Shell trägt den Benachrichtigungs-Bus (`ToastProvider` + `ToastViewport`); die
  // Ruhestandspflege meldet seit R-0953 Erfolg und Fehler darüber — die Vorrichtung trägt ihn mit.
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
            createElement(komponente),
            createElement(ToastViewport),
          ),
        ),
      ),
    );
  });
  await act(flush);
}

const alle = (id: string): Element[] => [...container.querySelectorAll(`[data-testid="${id}"]`)];
const eins = (id: string): Element | null => container.querySelector(`[data-testid="${id}"]`);

async function klicken(el: Element | null | undefined): Promise<void> {
  await act(async () => {
    (el as HTMLElement).click();
    await flush();
  });
}

async function waehlen(el: Element | null | undefined, wert: string): Promise<void> {
  const select = el as HTMLSelectElement;
  const setzer = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  await act(async () => {
    setzer?.call(select, wert);
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
}

const BEREICH = {
  category: "Presse",
  managerId: "u-mara",
  criticality: "hoch",
  singleSource: true,
  koCount: 3,
  bearers: [
    {
      userId: "u-rosa",
      horizonMonths: 24,
      currentHorizon: 24,
      // Mittags UTC: das angezeigte Kalenderdatum hängt so in keiner Zeitzone vom Versatz ab.
      dueAt: "2028-10-04T12:00:00.000Z",
      koCount: 2,
      openKoIds: ["k1", "k2"],
      soleBearer: true,
      openGaps: 1,
    },
    {
      userId: "u-tom",
      horizonMonths: 36,
      currentHorizon: 36,
      dueAt: "2029-10-04T00:00:00.000Z",
      koCount: 1,
      openKoIds: [],
      soleBearer: false,
      openGaps: 0,
    },
  ],
};

beforeEach(async () => {
  await i18n.changeLanguage("de");
  d.areas = [];
  d.seesAll = false;
  d.antwort = null;
  d.ruhestand = [];
  d.profileScheitern = false;
  d.setRetirement.mockImplementation(async (userId: string, h: unknown) => {
    d.ruhestand = d.ruhestand.filter((r) => r.userId !== userId);
    if (typeof h === "number") {
      d.ruhestand.push({ userId, horizonMonths: h });
    }
    return { entry: null };
  });
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.clearAllMocks();
});

describe("Mein Bereich · Ruhestandshorizonte und Arbeitsvorrat (Nacharbeit 3)", () => {
  it("R1 · Bereich, Verantwortliche, Bus-Faktor 1, Träger mit Frist und Arbeitsvorrat; 24 blendet 36 aus", async () => {
    d.areas = [BEREICH];
    await mount(RisikoHorizont);

    const bereich = eins("horizont-bereich");
    expect(bereich?.getAttribute("data-kategorie")).toBe("Presse");
    expect(eins("horizont-verantwortlich")?.textContent).toBe(
      i18n.t("risk.horizon.manager", { name: "Mara Beispiel" }),
    );
    expect(eins("horizont-busfaktor")).not.toBeNull();
    expect(eins("horizont-kritikalitaet")?.textContent).toContain(
      i18n.t("risk.horizon.level.hoch"),
    );

    // Standard: 36 Monate — beide Träger, nach Frist geordnet.
    expect(alle("horizont-traeger").map((t) => t.getAttribute("data-person"))).toEqual([
      "u-rosa",
      "u-tom",
    ]);
    const rosa = alle("horizont-traeger")[0];
    expect(rosa?.textContent).toContain("Rosa Beispiel");
    expect(rosa?.textContent).toContain("04.10.2028");
    expect(rosa?.querySelector('[data-testid="horizont-vorrat-einziger"]')).not.toBeNull();
    expect(rosa?.querySelector('[data-testid="horizont-vorrat-offen"]')?.textContent).toBe(
      i18n.t("risk.horizon.todo.openKos", { count: 2 }),
    );
    expect(rosa?.querySelector('[data-testid="horizont-vorrat-luecken"]')?.textContent).toBe(
      i18n.t("risk.horizon.todo.openGaps", { count: 1 }),
    );
    // Gegenprobe Tom: kein einziger Träger, nichts offen — keine leeren Vorratszeilen.
    const tom = alle("horizont-traeger")[1];
    expect(tom?.querySelector('[data-testid="horizont-vorrat-einziger"]')).toBeNull();
    expect(tom?.querySelector('[data-testid="horizont-vorrat-offen"]')).toBeNull();

    await klicken(container.querySelector('[data-testid="horizont-filter"][data-monate="24"]'));
    expect(alle("horizont-traeger").map((t) => t.getAttribute("data-person"))).toEqual(["u-rosa"]);
  });

  // R3 (Nacharbeit 5, ben K7/K14 · F4): ZEITFORTSCHRITT. Derselbe unveränderte Eintrag — gepflegt
  // mit 36 Monaten, Frist 04.10.2029 — durch die ECHTE Ableitung `riskHorizon` zu zwei fest
  // vorgegebenen Bezugszeiten und in der ECHTEN Fläche gerendert. Am 04.10.2026 sind es 36 Monate
  // bis zur Frist (nur im 36-Monats-Blick), am 04.01.2028 nur noch 21 (auch im 24-Monats-Blick).
  const FRIST = "2029-10-04T00:00:00.000Z";
  const antwortZu = (bezug: string) =>
    JSON.parse(
      JSON.stringify(
        riskHorizon({
          kos: [
            { id: "k1", category: "Presse", originalAuthor: "u-rosa", status: "offen" },
            { id: "k2", category: "Presse", originalAuthor: "u-rosa", status: "validiert" },
          ] as KnowledgeObject[],
          busFactor: [{ category: "Presse", koCount: 2, authorCount: 1, singleSource: true }],
          profiles: [],
          retirement: [
            {
              userId: "u-rosa",
              horizonMonths: 36,
              dueAt: FRIST,
              updatedAt: "2026-10-04T00:00:00.000Z",
              updatedBy: "u-admin",
            },
          ],
          gaps: [{ status: "offen", assignee: "u-rosa" }],
          viewer: { userId: "u-admin", seesAll: true },
          now: Date.parse(bezug),
        }),
      ),
    );
  const filter = (monate: number) =>
    container.querySelector(`[data-testid="horizont-filter"][data-monate="${monate}"]`);
  const personen = () => alle("horizont-traeger").map((t) => t.getAttribute("data-person"));
  const fristText = new Date(FRIST).toLocaleDateString("de", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  it("R3a · Bezugszeit 04.10.2026: der 36-Monats-Eintrag steht im 36-, nicht im 24-Monats-Blick", async () => {
    d.antwort = antwortZu("2026-10-04T00:00:00.000Z");
    await mount(RisikoHorizont);

    expect(personen(), "Standard 36 Monate").toEqual(["u-rosa"]);
    await klicken(filter(24));
    expect(personen(), "36 Monate bis zur Frist sind nicht „die nächsten 24“").toEqual([]);
    expect(eins("horizont-keine-traeger")).not.toBeNull();
  });

  it("R3b · Bezugszeit 04.01.2028, derselbe Eintrag: im 24-Monats-Blick, mit Arbeitsvorrat und unveränderter Frist", async () => {
    d.antwort = antwortZu("2028-01-04T00:00:00.000Z");
    await mount(RisikoHorizont);

    await klicken(filter(24));
    expect(personen()).toEqual(["u-rosa"]);
    const rosa = alle("horizont-traeger")[0];
    expect(rosa?.textContent, "die gespeicherte Frist bleibt").toContain(fristText);
    expect(rosa?.textContent).toContain(
      i18n.t("risk.horizon.bearer", { name: "Rosa Beispiel", months: 24, due: fristText }),
    );
    expect(rosa?.querySelector('[data-testid="horizont-vorrat-einziger"]')).not.toBeNull();
    expect(rosa?.querySelector('[data-testid="horizont-vorrat-offen"]')?.textContent).toBe(
      i18n.t("risk.horizon.todo.openKos", { count: 1 }),
    );
    expect(rosa?.querySelector('[data-testid="horizont-vorrat-luecken"]')?.textContent).toBe(
      i18n.t("risk.horizon.todo.openGaps", { count: 1 }),
    );
  });

  it("R2 · ohne eigenen Bereich: der Leersatz für „kein Bereich zugeordnet“", async () => {
    await mount(RisikoHorizont);
    expect(eins("horizont-leer")?.textContent).toBe(i18n.t("risk.horizon.noOwnArea"));
    expect(alle("horizont-bereich")).toHaveLength(0);
    // Nacharbeit 4: das Verzeichnis lädt mit der FLÄCHE, nicht erst mit der ersten Bereichskarte —
    // sonst zeigte R1 nach Ankunft des Bereichsblicks „Autorenname wird geladen" statt des Namens.
    expect(endpoints.directory.list).toHaveBeenCalled();
  });
});

describe("Pflege der Eingänge (Nacharbeit 3, nur Admin)", () => {
  it("P1 · Stufen und Verantwortung speichern, Ruhestandshorizont setzen — genau diese Werte gehen hinaus", async () => {
    await mount(BereichsprofilPflege);

    const zeile = container.querySelector(
      '[data-testid="pflege-bereich"][data-kategorie="Presse"]',
    );
    expect(zeile, "die Kategorie aus dem Bestand steht zur Pflege da").not.toBeNull();
    await waehlen(zeile?.querySelector('[data-testid="pflege-manager"]'), "u-mara");
    await waehlen(zeile?.querySelector('[data-faktor="criticality"]'), "hoch");
    await waehlen(zeile?.querySelector('[data-faktor="repetition"]'), "niedrig");
    await klicken(zeile?.querySelector('[data-testid="pflege-speichern"]'));

    expect(d.setCategoryProfile).toHaveBeenCalledWith({
      category: "Presse",
      managerId: "u-mara",
      criticality: "hoch",
      processProximity: null,
      repetition: "niedrig",
      damagePotential: null,
    });

    const rosa = container.querySelector('[data-testid="pflege-ruhestand"][data-person="u-rosa"]');
    await waehlen(rosa?.querySelector("select"), "24");
    expect(d.setRetirement).toHaveBeenCalledWith("u-rosa", 24);
    // Gegenprobe: „kein Eintrag" geht als null hinaus, nicht als 0.
    await waehlen(rosa?.querySelector("select"), "");
    expect(d.setRetirement).toHaveBeenLastCalledWith("u-rosa", null);
  });

  // R-0953 / R-0956 (Ben, Nacharbeit 2): der Ruhestandshorizont meldet Erfolg und Fehler über den
  // Benachrichtigungs-Bus; ein gescheitertes Speichern kostet die Auswahl nicht und lässt sich
  // mit demselben Wert wiederholen.
  const toastTexte = (): string[] =>
    [...container.querySelectorAll("output")].map((o) => o.textContent ?? "");
  const rosaZeile = (): Element | null =>
    container.querySelector('[data-testid="pflege-ruhestand"][data-person="u-rosa"]');
  const rosaAuswahl = (): HTMLSelectElement | null => rosaZeile()?.querySelector("select") ?? null;
  const nichtAufgefrischt = (): Element | null | undefined =>
    rosaZeile()?.querySelector('[data-testid="pflege-ruhestand-nicht-aufgefrischt"]');

  it("P2 · Erfolg: kurze Erfolgsmeldung, kein Fehlerblock", async () => {
    await mount(BereichsprofilPflege);
    await waehlen(rosaAuswahl(), "24");
    expect(d.setRetirement).toHaveBeenCalledWith("u-rosa", 24);
    expect(toastTexte()).toContain(
      i18n.t("risk.pflege.retirementSaved", { name: "Rosa Beispiel" }),
    );
    expect(rosaZeile()?.querySelector('[data-testid="pflege-ruhestand-fehler"]')).toBeNull();
    // Nacharbeit 3: nach Speichern UND erfolgreicher Auffrischung steht der neue Serverstand da —
    // und kein Hinweis auf eine ausstehende Auffrischung.
    expect(rosaAuswahl()?.value).toBe("24");
    expect(nichtAufgefrischt()).toBeNull();
  });

  // Nacharbeit 3 (Ben): `invalidateQueries` löst auch auf, wenn die Auffrischung scheitert. Die
  // Auswahl darf dann NICHT auf den alten Serverwert zurückspringen; Speichererfolg und
  // gescheiterte Auffrischung stehen getrennt da.
  it("P4 · Speichern gelingt, Auffrischung scheitert: Auswahl bleibt, Erfolg und „nicht aufgefrischt“ getrennt", async () => {
    await mount(BereichsprofilPflege);
    expect(rosaAuswahl()?.value, "Vorbedingung: kein Horizont gespeichert").toBe("");
    d.profileScheitern = true;
    await waehlen(rosaAuswahl(), "24");

    expect(d.setRetirement).toHaveBeenCalledWith("u-rosa", 24);
    expect(rosaAuswahl()?.value, "die gespeicherte Auswahl bleibt sichtbar").toBe("24");
    expect(toastTexte()).toContain(
      i18n.t("risk.pflege.retirementSaved", { name: "Rosa Beispiel" }),
    );
    expect(nichtAufgefrischt()?.textContent).toBe(
      i18n.t("risk.pflege.retirementNotRefreshed", { name: "Rosa Beispiel" }),
    );
    // Getrennt davon: kein Speicherfehler an der Zeile; die Liste trägt die Abrufstörung.
    expect(rosaZeile()?.querySelector('[data-testid="pflege-ruhestand-fehler"]')).toBeNull();
    expect(container.textContent).toContain(i18n.t("loadstate.stale"));

    // Gelingt die Auffrischung später, gilt der neue Serverstand, und der Hinweis verschwindet.
    d.profileScheitern = false;
    const wiederholen = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === i18n.t("loadstate.error.retry"),
    );
    await klicken(wiederholen);
    expect(rosaAuswahl()?.value).toBe("24");
    expect(nichtAufgefrischt()).toBeNull();
  });

  it("P3 · Fehler: Meldung im Bus und an der Zeile, Auswahl bleibt, „Erneut versuchen“ speichert denselben Wert", async () => {
    d.setRetirement.mockImplementationOnce(async () => {
      throw new Error("Pruefstand: Speichern gestoert");
    });
    await mount(BereichsprofilPflege);
    await waehlen(rosaAuswahl(), "36");

    const fehlertext = i18n.t("risk.pflege.retirementError", { name: "Rosa Beispiel" });
    expect(toastTexte(), "Fehler erscheint als Einblendung").toContain(fehlertext);
    const fehler = rosaZeile()?.querySelector('[data-testid="pflege-ruhestand-fehler"]');
    expect(fehler?.textContent).toContain(fehlertext);
    // Die Eingabe ist nicht verloren: der Server kennt noch keinen Horizont, die Auswahl zeigt 36.
    expect(rosaAuswahl()?.value).toBe("36");
    expect(rosaAuswahl()?.disabled).toBe(false);

    const erneut = rosaZeile()?.querySelector('[data-testid="pflege-ruhestand-erneut"]');
    expect(erneut?.textContent).toBe(i18n.t("loadstate.error.retry"));
    await klicken(erneut);
    expect(d.setRetirement).toHaveBeenCalledTimes(2);
    expect(d.setRetirement).toHaveBeenLastCalledWith("u-rosa", 36);
    expect(rosaZeile()?.querySelector('[data-testid="pflege-ruhestand-fehler"]')).toBeNull();
    expect(toastTexte()).toContain(
      i18n.t("risk.pflege.retirementSaved", { name: "Rosa Beispiel" }),
    );
  });

  // R-0953 (Ben, Nacharbeit 3): auch das Bereichsprofil meldet Erfolg und Fehler als Einblendung;
  // bei einem Fehler bleiben die Eingaben stehen, und „Speichern“ sendet sie erneut.
  it("P5 · Bereichsprofil: Fehler als Einblendung mit erhaltenen Eingaben, danach Erfolg als Einblendung", async () => {
    d.setCategoryProfile.mockImplementationOnce(async () => {
      throw new Error("Pruefstand: Profil gestoert");
    });
    await mount(BereichsprofilPflege);
    const zeile = container.querySelector(
      '[data-testid="pflege-bereich"][data-kategorie="Presse"]',
    );
    await waehlen(zeile?.querySelector('[data-testid="pflege-manager"]'), "u-mara");
    await waehlen(zeile?.querySelector('[data-faktor="criticality"]'), "hoch");
    await klicken(zeile?.querySelector('[data-testid="pflege-speichern"]'));

    expect(toastTexte()).toContain(i18n.t("risk.pflege.profileError", { category: "Presse" }));
    expect(zeile?.textContent).toContain(i18n.t("risk.pflege.error"));
    const manager = zeile?.querySelector<HTMLSelectElement>('[data-testid="pflege-manager"]');
    const kritik = zeile?.querySelector<HTMLSelectElement>('[data-faktor="criticality"]');
    expect(manager?.value, "Eingabe bleibt").toBe("u-mara");
    expect(kritik?.value, "Eingabe bleibt").toBe("hoch");

    await klicken(zeile?.querySelector('[data-testid="pflege-speichern"]'));
    expect(d.setCategoryProfile).toHaveBeenCalledTimes(2);
    expect(d.setCategoryProfile).toHaveBeenLastCalledWith(
      expect.objectContaining({ category: "Presse", managerId: "u-mara", criticality: "hoch" }),
    );
    expect(toastTexte()).toContain(i18n.t("risk.pflege.profileSaved", { category: "Presse" }));
    expect(zeile?.textContent).not.toContain(i18n.t("risk.pflege.error"));
  });
});
