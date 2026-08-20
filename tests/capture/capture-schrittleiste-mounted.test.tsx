// @vitest-environment jsdom
// ================================================================================================
// JOB 1154 D2 — D-029: DIE SCHRITTLEISTE NIMMT IHRE SPERRE POSITIV AB.
// ================================================================================================
//
// WARUM DIESE DATEI NEU IST, OBWOHL D1 SCHON GETESTET HAT: D1 hat das FEHLEN von Tooltip und
// Sperrgrund als gruene Erwartung festgeschrieben. BEN dazu woertlich: „Die MANGEL-WAECHTER
// duerfen nicht als Erfuellung von D-029/D-030 gelten." Ein gruener Test, der einen Mangel
// festschreibt, verteidigt ihn — er wird rot, sobald jemand den Mangel behebt. Diese Datei dreht
// die Richtung um: sie prueft das SOLLVERHALTEN und ist gegen den Stand vor dem Vorlauf rot.
//
// DREI GETRENNTE PRUEFBLOECKE, weil BEN drei getrennte Eigenschaften verlangt und je eine
// fachlich entfernende Gegenmutation ausschliesslich den zugehoerigen Block rot machen soll:
//
//   Block A — SICHTBARER SPERRGRUND: eine fuer alle lesbare Zeile unter der Leiste. Sie wird
//             ueber `data-testid` gefunden, NICHT ueber die Attribute der Knoepfe. Nimmt man die
//             Attribute weg (GM-B), bleibt A gruen.
//   Block B — ZUGAENGLICHE BEGRUENDUNG am Bedienelement selbst: `title` (Maus) und
//             `aria-describedby` auf einen eigenen, nur fuer Hilfstechnik sichtbaren Text
//             (Screenreader). Bewusst ein EIGENES Element und nicht die Zeile aus Block A —
//             sonst haette GM-A auch diesen Block gerissen und die Bloecke waeren nicht disjunkt.
//   Block C — GESPERRTE INTERAKTION: `disabled` UND `aria-disabled`, und der Klick bewegt den
//             Schritt wirklich nicht. `disabled` allein genuegt nicht: es sagt der Hilfstechnik
//             nichts ueber den GRUND und nimmt den Knopf zugleich aus dem Fokuslauf.
//
// Die Gegenprobe steht in jedem Block: ein NICHT gesperrter Schritt darf keinen Sperrgrund
// tragen. Ohne sie waere ein Renderer gruen, der jedem Schritt denselben Hinweis anhaengt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: { policy: ok({ enabled: false }) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([]) },
      gaps: { list: ok([]) },
      drafts: { list: ok([]) },
      reasoner: {
        status: ok({ active: true, mode: "cloud", reachable: "active" }),
        config: ok(null),
        // Strukturieren liefert einen echten Entwurf — nur damit wird der Studio-Schritt
        // ueberhaupt erreichbar und die Gegenprobe „nicht gesperrt = kein Sperrgrund" moeglich.
        structure: vi.fn(async () => ({
          title: "Dosierventil bei Kaltstart vorwaermen",
          statement: "Nach Stillstand klemmt das Ventil DP-4 sporadisch.",
          conditions: ["Nach Wochenendstillstand"],
          measures: ["Ventil DP-4 vor dem Anfahren vorwaermen"],
          tags: ["ventil"],
        })),
      },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Capture } from "../../apps/web/src/pages/Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
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

function buttonByText(part: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(part),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${part}“ nicht gefunden`);
  }
  return btn;
}

async function click(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await flush();
  });
}

/**
 * Klappt den Arbeitsraum auf — und nur dann, wenn er zu ist. Der Zustand wird am
 * `aria-expanded` des Aufklappers abgelesen, nicht an seiner Beschriftung: die Beschriftung
 * ist selbst einer der hart deutschen Traeger aus D-030 und darf hier nichts steuern.
 */
async function openWorkspace(): Promise<void> {
  const b = container.querySelector<HTMLButtonElement>('button[aria-controls="capture-workspace"]');
  if (!b) {
    throw new Error("Der Aufklapper des Arbeitsraums ist auf der gemounteten Seite nicht da.");
  }
  if (b.getAttribute("aria-expanded") !== "true") {
    await click(b);
  }
}

/**
 * Die drei Schritt-Knoepfe der Leiste, in Anzeigereihenfolge. Sie werden ueber ihre sichtbare
 * Nummerierung „1 · ", „2 · ", „3 · " gefunden — das ist die Bauform des Renderers und
 * unabhaengig von der Sprache, in der die Beschriftung dahinter steht.
 */
function schrittKnoepfe(): HTMLButtonElement[] {
  return [...container.querySelectorAll("button")].filter((b) =>
    /^\s*[123]\s*·/.test(b.textContent ?? ""),
  );
}

function schrittKnopf(nr: 1 | 2 | 3): HTMLButtonElement {
  const treffer = schrittKnoepfe().find((b) =>
    new RegExp(`^\\s*${nr}\\s*·`).test(b.textContent ?? ""),
  );
  if (!treffer) {
    throw new Error(
      `Schritt-Knopf ${nr} nicht gefunden. Gefunden: ${schrittKnoepfe()
        .map((b) => (b.textContent ?? "").trim())
        .join(" | ")}`,
    );
  }
  return treffer;
}

/** Der sichtbare Sperrgrund unter der Leiste — die Flaeche, die Block A prueft. */
function sperrgrundZeile(): HTMLElement | null {
  return container.querySelector<HTMLElement>("[data-testid=capture-step-lockreason]");
}

/** Loest `aria-describedby` eines Knopfes auf und gibt den Text der referenzierten Knoten. */
function beschreibungVon(btn: HTMLElement): string | null {
  const ids = (btn.getAttribute("aria-describedby") ?? "").trim();
  if (!ids) {
    return null;
  }
  // Bewusst ueber den Attributselektor und nicht ueber `#${CSS.escape(id)}`: `CSS` ist in jsdom
  // nicht definiert, und ein TypeError im Helfer haette wie ein fachlicher Fehlschlag ausgesehen.
  const texte = ids
    .split(/\s+/)
    .map((id) => container.querySelector(`[id="${id}"]`))
    .map((n) => (n?.textContent ?? "").trim())
    .filter((s) => s.length > 0);
  return texte.length > 0 ? texte.join(" ") : null;
}

const t = (key: string): string => i18n.getFixedT("de")(key);

/** Rohtext eintippen — Vorbedingung dafuer, dass „Strukturieren" ueberhaupt bedienbar ist. */
async function typeFreitext(value: string): Promise<void> {
  const ta = [...container.querySelectorAll("textarea")].find(
    (x) => x.placeholder === i18n.t("capture.rawPlaceholder"),
  );
  if (!(ta instanceof HTMLTextAreaElement)) {
    throw new Error("Freitext-Feld nicht gefunden");
  }
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ta) as object, "value")?.set;
  setter?.call(ta, value);
  await act(async () => {
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
}

/**
 * Fuehrt bis in den Schritt „Wissensseite". Danach ist Schritt 1 (Erzaehlen) ERREICHBAR und
 * Schritt 2 der aktuelle — genau die Lage, in der sich gesperrt und nicht gesperrt am selben
 * Renderer unterscheiden lassen.
 */
async function bisWissensseite(): Promise<void> {
  await openWorkspace();
  await typeFreitext("Nach dem Wochenende klemmt das Dosierventil DP-4 beim Anfahren.");
  await click(buttonByText(i18n.t("capture.structure")));
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  // Defensiv, damit ein Fehlschlag VOR der Montage nicht durch einen TypeError im Abbau
  // ueberdeckt wird — der gemeldete Grund waere dann nicht mehr der echte.
  if (root) {
    act(() => root.unmount());
    root = undefined as unknown as ReturnType<typeof createRoot>;
  }
  container?.remove();
  vi.clearAllMocks();
});

// ================================================================================================
// VORBEDINGUNGEN — sie gehoeren keinem der drei Bloecke an.
// ================================================================================================
// Diese Faelle sichern nur, dass ueberhaupt gemessen wird, was gemessen werden soll. Waeren sie
// Teil eines Pruefblocks, wuerde eine Gegenmutation an der Leiste sie mitreissen und die
// verlangte Trennschaerfe „genau ein Block rot" waere nicht mehr belegbar.
describe("JOB 1154 D2 · Vorbedingungen der Schrittleiste", () => {
  it("V1 · die Leiste rendert genau drei Schritt-Knoepfe", async () => {
    await mount();
    await openWorkspace();
    expect(schrittKnoepfe().length).toBe(3);
  });

  it("V2 · im Startzustand sind alle drei Schritte gesperrt", async () => {
    await mount();
    await openWorkspace();
    // Erzaehlen ist der aktuelle Schritt, Wissensseite hat keinen Entwurf, Einreichen laeuft
    // ueber „Pruefen & einreichen". Das ist die Lage, in der ein Sperrgrund noetig ist.
    for (const nr of [1, 2, 3] as const) {
      expect(schrittKnopf(nr).disabled, `Schritt ${nr} ist nicht gesperrt.`).toBe(true);
    }
  });

  it("V3 · nach dem Strukturieren ist Schritt 1 erreichbar und Schritt 2 der aktuelle", async () => {
    await mount();
    await bisWissensseite();
    expect(schrittKnopf(1).disabled, "Erzaehlen ist nach dem Strukturieren nicht erreichbar.").toBe(
      false,
    );
    expect(schrittKnopf(2).disabled, "Die Wissensseite ist nicht der aktuelle Schritt.").toBe(true);
  });
});

// ================================================================================================
// BLOCK A — SICHTBARER SPERRGRUND
// ================================================================================================
describe("JOB 1154 D2 · D-029 Block A: der Sperrgrund ist sichtbar", () => {
  it("A1 · unter der Leiste steht eine sichtbare Begruendung, solange ein Schritt gesperrt ist", async () => {
    await mount();
    await openWorkspace();
    const zeile = sperrgrundZeile();
    expect(
      zeile,
      "Unter der Schrittleiste steht keine sichtbare Begruendung — gesperrte Schritte erklaeren " +
        "sich damit nur dem, der die Bauart kennt.",
    ).not.toBeNull();
    expect((zeile?.textContent ?? "").trim().length).toBeGreaterThan(0);
  });

  it("A2 · sie nennt den Grund 'noch kein Entwurf' fuer die Wissensseite", async () => {
    await mount();
    await openWorkspace();
    // Der fachlich wichtigste Grund: die Wissensseite ist zu, weil noch nichts strukturiert wurde.
    // Genau diesen Satz braucht der Nutzer, um zu wissen, was er tun muss.
    expect(sperrgrundZeile()?.textContent ?? "").toContain(
      t("capture.wizard.step.lockedNeedDraft"),
    );
  });

  it("A3 · sie nennt den Grund fuer den Einreichen-Schritt", async () => {
    await mount();
    await openWorkspace();
    expect(sperrgrundZeile()?.textContent ?? "").toContain(
      t("capture.wizard.step.lockedViaSubmit"),
    );
  });

  it("A4 · Gegenprobe: ist kein Schritt mehr gesperrt, verschwindet die Zeile", async () => {
    await mount();
    await bisWissensseite();
    const zeile = sperrgrundZeile();
    // Nach dem Strukturieren ist Schritt 1 offen; die Zeile darf jetzt NUR noch die Gruende
    // der weiterhin gesperrten Schritte nennen — und keinen Grund fuer den offenen Schritt.
    expect(
      (zeile?.textContent ?? "").includes(t("capture.wizard.step.lockedNeedDraft")),
      "Die Zeile nennt weiterhin den Grund 'noch kein Entwurf', obwohl ein Entwurf vorliegt — " +
        "der Hinweis haengt dann nicht am tatsaechlichen Zustand.",
    ).toBe(false);
  });
});

// ================================================================================================
// BLOCK B — TOOLTIP UND ZUGAENGLICHE BEGRUENDUNG AM BEDIENELEMENT
// ================================================================================================
describe("JOB 1154 D2 · D-029 Block B: die Begruendung haengt am Bedienelement", () => {
  it("B1 · jeder gesperrte Schritt traegt einen Tooltip mit seinem Grund", async () => {
    await mount();
    await openWorkspace();
    for (const nr of [1, 2, 3] as const) {
      const btn = schrittKnopf(nr);
      const titel = btn.getAttribute("title");
      expect(
        titel,
        `Schritt ${nr} ist gesperrt, traegt aber keinen Tooltip — mit der Maus ist der Grund nicht zu erfahren.`,
      ).toBeTruthy();
      expect((titel ?? "").trim().length).toBeGreaterThan(0);
    }
  });

  it("B2 · der Tooltip nennt den zutreffenden Grund, nicht irgendeinen", async () => {
    await mount();
    await openWorkspace();
    expect(schrittKnopf(2).getAttribute("title")).toBe(t("capture.wizard.step.lockedNeedDraft"));
    expect(schrittKnopf(3).getAttribute("title")).toBe(t("capture.wizard.step.lockedViaSubmit"));
  });

  it("B3 · der Grund ist ueber aria-describedby auch fuer Hilfstechnik aufloesbar", async () => {
    await mount();
    await openWorkspace();
    // Ein `title` allein erreicht Screenreader nicht verlaesslich. Erst eine aufloesbare
    // Beschreibung macht die Sperre angekuendigt statt nur sichtbar.
    for (const nr of [1, 2, 3] as const) {
      const beschreibung = beschreibungVon(schrittKnopf(nr));
      expect(
        beschreibung,
        `Schritt ${nr} hat keine aufloesbare Beschreibung (aria-describedby zeigt auf nichts).`,
      ).toBeTruthy();
    }
    expect(beschreibungVon(schrittKnopf(2))).toBe(t("capture.wizard.step.lockedNeedDraft"));
  });

  it("B4 · Gegenprobe: ein offener Schritt traegt weder Tooltip noch Beschreibung", async () => {
    await mount();
    await bisWissensseite();
    const offen = schrittKnopf(1);
    expect(offen.disabled).toBe(false);
    expect(
      offen.getAttribute("title"),
      "Ein erreichbarer Schritt traegt einen Sperr-Tooltip — der Hinweis haengt nicht am Zustand.",
    ).toBeNull();
    expect(beschreibungVon(offen)).toBeNull();
  });
});

// ================================================================================================
// BLOCK C — GESPERRTE INTERAKTION
// ================================================================================================
describe("JOB 1154 D2 · D-029 Block C: die Sperre haelt und ist angekuendigt", () => {
  it("C1 · ein gesperrter Schritt ist als gesperrt ausgezeichnet", async () => {
    await mount();
    await openWorkspace();
    for (const nr of [1, 2, 3] as const) {
      const btn = schrittKnopf(nr);
      expect(btn.disabled, `Schritt ${nr} ist nicht gesperrt.`).toBe(true);
      expect(
        btn.getAttribute("aria-disabled"),
        `Schritt ${nr} ist technisch gesperrt, kuendigt das der Hilfstechnik aber nicht an.`,
      ).toBe("true");
    }
  });

  it("C2 · der Klick auf einen gesperrten Schritt bewegt den Wizard nicht", async () => {
    await mount();
    await bisWissensseite();
    // Schritt 2 ist der aktuelle und damit gesperrt; Schritt 1 ist offen. Ein Klick auf 2 darf
    // die Lage nicht veraendern — gemessen an der Erreichbarkeit von Schritt 1.
    const vorher = schrittKnopf(1).disabled;
    await click(schrittKnopf(2));
    expect(schrittKnopf(1).disabled, "Der Klick auf einen gesperrten Schritt hat gewirkt.").toBe(
      vorher,
    );
  });

  it("C3 · der aktuelle Schritt ist als aktueller ausgezeichnet", async () => {
    await mount();
    await bisWissensseite();
    // `aria-current` unterscheidet „gesperrt, weil schon hier" von „gesperrt, weil noch zu".
    // Ohne diese Auszeichnung klingen beide Zustaende fuer Hilfstechnik gleich.
    expect(
      schrittKnopf(2).getAttribute("aria-current"),
      "Der aktuelle Schritt ist nicht als aktueller ausgezeichnet.",
    ).toBe("step");
  });

  it("C4 · Gegenprobe: ein offener Schritt ist weder disabled noch aria-disabled", async () => {
    await mount();
    await bisWissensseite();
    const offen = schrittKnopf(1);
    expect(offen.disabled).toBe(false);
    expect(offen.getAttribute("aria-disabled")).not.toBe("true");
    expect(offen.getAttribute("aria-current")).not.toBe("step");
  });
});
