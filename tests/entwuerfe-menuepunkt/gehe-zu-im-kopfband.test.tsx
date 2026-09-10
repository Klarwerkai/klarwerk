// @vitest-environment jsdom
// ================================================================================================
// JOB 3503 · TEIL 3b — „GEHE ZU …" STEHT SICHTBAR IM KOPFBAND UND ÖFFNET DIE VORHANDENE PALETTE.
// ================================================================================================
//
// PEDIS WORTLAUT (10.09. 06:48 über Codex, Auftrag §3b): „Gehe zu" soll ebenfalls direkt sichtbar
// oben im Kopfband stehen, nicht nur hinter dem Zahnrad. Der vorhandene Tastaturweg bleibt und soll
// erkennbar bleiben. Und ausdrücklich: „die vorhandene Such- und Befehlspalette wird
// wiederverwendet, keine zweite."
//
// GENAU DIESE DREI ZUSAGEN WERDEN HIER GEMESSEN, und die dritte ist die, an der ein zweiter Bau
// auffallen würde:
//
// A  der Knopf STEHT im Kopfband — mit seinem Namen UND seiner Tastenkombination, DE und EN
// B  sein Klick öffnet die Palette, und es ist DIESELBE: zu jedem Zeitpunkt genau EIN Suchfeld im
//    Baum, und der Zustand der einen Fläche (Eingabe) wird von beiden Griffen geteilt
// C  der Tastaturweg ⌘K/Strg+K ist UNVERÄNDERT da — vor und nach dem Klick
// D  und die Palette findet den neuen Bereich „Meine Entwürfe": beide Teile dieses Auftrags hängen
//    zusammen, weil der Punkt in `NAV_GROUPS` steht und die Gliederung ihn kennt
//
// Gemessen wird am ECHTEN Kopfband (`shell/Kopfband.tsx`, das Bauteil, das die Hülle einsetzt) und
// an der ECHTEN `CommandPalette` — einzige Attrappe ist die Endpunktgrenze.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    // `experte`: die Rolle, die „Meine Entwürfe" sieht — Fall D prüft genau ihren Treffer.
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "experte" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      validation: { board: ok([]) },
      conflicts: { list: ok([]) },
      duplicates: { list: ok([]) },
      gaps: { summary: ok({ open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } }) },
      lifecycle: { pending: ok([]) },
      notifications: { list: ok([]), markSeen: ok({ unseenCount: 0 }) },
      features: { get: ok({ features: {} }) },
      reasoner: {
        status: ok({ active: false, mode: "none", reachable: "unknown", tasks: {} }),
        config: ok(null),
      },
      external: { policy: ok({ stage: "blocked" }) },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, useLocation } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ModalBoundaryProvider } from "../../apps/web/src/app/ModalBoundaryContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CommandPalette } from "../../apps/web/src/shell/CommandPalette";
import { Kopfband } from "../../apps/web/src/shell/Kopfband";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: Root;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
};

function Adresse(): JSX.Element {
  const ort = useLocation();
  return createElement("span", { "data-testid": "adresse" }, `${ort.pathname}${ort.search}`);
}

/**
 * Das echte Kopfband und die echte Palette unter denselben Anbietern.
 *
 * `ModalBoundaryProvider` ist nötig, weil die Palette ihre Fläche als modale Region anmeldet —
 * dieselbe Verdrahtung, die `AppShell` herstellt.
 */
async function montiere(): Promise<void> {
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
                MemoryRouter,
                { initialEntries: ["/start"] },
                createElement(
                  NavGuardProvider,
                  null,
                  // `children` steht IM Props-Objekt (wie in `tests/bedienbarkeit/
                  // u3-menuepunkt-erklaert-sich.test.tsx`): der Anbieter deklariert `children` als
                  // Pflichtfeld, die variadische Form von `createElement` erfüllt das für TypeScript
                  // nicht.
                  createElement(ModalBoundaryProvider, {
                    hostRef: { current: null },
                    children: [
                      createElement(Kopfband, { key: "band" }),
                      createElement(CommandPalette, { key: "palette" }),
                    ],
                  }),
                  createElement(Adresse),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await flush();
}

function abbauen(): void {
  act(() => root.unmount());
  container.remove();
}

function adresse(): string {
  return container.querySelector('[data-testid="adresse"]')?.textContent ?? "";
}

function knopf(): HTMLButtonElement {
  const el = container.querySelector<HTMLButtonElement>('[data-testid="kopfband-gehezu"]');
  if (!el) {
    throw new Error("der Knopf „Gehe zu …“ fehlt im Kopfband");
  }
  return el;
}

/** ALLE Suchfelder der Palette im Baum — die Zahl ist die Aussage über „keine zweite Palette". */
function palettenFelder(): HTMLInputElement[] {
  return [
    ...container.querySelectorAll<HTMLInputElement>(
      `input[aria-label="${i18n.t("cmd.suchfeld")}"]`,
    ),
  ];
}

function paletteOffen(): boolean {
  return palettenFelder().length > 0;
}

/** Ein Klick, wie ein Zeiger ihn erzeugt: `mousedown`, `mouseup`, `click`. */
async function klick(el: Element): Promise<void> {
  await act(async () => {
    for (const art of ["mousedown", "mouseup", "click"]) {
      el.dispatchEvent(new MouseEvent(art, { bubbles: true, cancelable: true }));
    }
  });
  await flush();
}

/** Das Kürzel hängt am FENSTER (`CommandPalette.tsx`), nicht am DOM-Knoten. */
async function kuerzel(): Promise<void> {
  await act(async () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true, cancelable: true }),
    );
  });
  await flush();
}

async function escapeTaste(): Promise<void> {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  await flush();
}

async function tippe(feld: HTMLInputElement, text: string): Promise<void> {
  const setzer = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setzer?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await flush();
}

/** Die gerenderten Treffer der offenen Palette: Weg und angezeigter Name. */
function treffer(): { pfad: string; name: string }[] {
  return [...container.querySelectorAll<HTMLButtonElement>("li button[data-cmd-pfad]")].map(
    (b) => ({
      pfad: b.getAttribute("data-cmd-pfad") ?? "",
      name: b.querySelector("[data-cmd-name]")?.textContent ?? "",
    }),
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  abbauen();
  vi.clearAllMocks();
});

describe("JOB 3503 · 3b-A · der Knopf steht sichtbar im Kopfband", () => {
  it("er trägt den vorhandenen Namen „Gehe zu …“ UND die Tastenkombination ⌘K", async () => {
    await montiere();
    const k = knopf();
    // Der Name kommt aus derselben Quelle wie die Zahnrad-Zeile — kein zweiter Textschlüssel.
    expect(k.textContent).toContain(i18n.t("menue.schnellnavigation"));
    expect(i18n.t("menue.schnellnavigation")).toBe("Gehe zu …");
    // Und die Kombination ist am Knopf ERKENNBAR (Auftrag §3b), nicht bloss im Hintergrund aktiv.
    expect(k.textContent, "die Tastenkombination steht nicht am Knopf").toContain("⌘K");
    // Ein Knopf, kein Verweis: er navigiert nicht, er öffnet eine Fläche.
    expect(k.tagName).toBe("BUTTON");
    expect(k.getAttribute("type")).toBe("button");
  });

  it("auf Englisch trägt derselbe Knopf den englischen Namen — und dasselbe Zeichen", async () => {
    await i18n.changeLanguage("en");
    await montiere();
    expect(knopf().textContent).toContain("Go to …");
    expect(knopf().textContent).toContain("⌘K");
    await i18n.changeLanguage("de");
  });
});

describe("JOB 3503 · 3b-B · der Klick öffnet die VORHANDENE Palette, keine zweite", () => {
  it("zu → offen → zu, und zu JEDEM Zeitpunkt steht genau ein Suchfeld im Baum", async () => {
    await montiere();
    expect(paletteOffen(), "die Palette stand schon vor dem Klick offen").toBe(false);

    await klick(knopf());
    expect(paletteOffen(), "der Klick öffnet die Palette nicht").toBe(true);
    // DIE ZUSAGE „keine zweite Palette": es ist genau EIN Suchfeld da, nicht zwei.
    expect(palettenFelder(), "es steht mehr als eine Palette im Baum").toHaveLength(1);

    await escapeTaste();
    expect(paletteOffen()).toBe(false);
  });

  // ================================================================================================
  // WIE „DIESELBE FLÄCHE" HIER BEWIESEN WIRD — und wie NICHT.
  // ================================================================================================
  // Ein erster Anlauf dieses Falls wollte die Identität daran zeigen, dass die EINGABE eine
  // Schliessung überlebt. Das war eine erfundene Erwartung, und die Messung hat sie widerlegt: die
  // Fläche leert ihr Feld beim Schliessen (`expected '' to be 'Biblio'`). Das ist richtiges
  // Produktverhalten — jede Suche beginnt frisch —, und es steht unten als eigene Zusage.
  //
  // BEWIESEN WIRD DIE IDENTITÄT AM GETEILTEN OFFEN-ZUSTAND: Das Kürzel SCHALTET UM
  // (`CommandPalette.tsx`, `setOpen((v) => !v)`). Drückt man es, WÄHREND der Knopf die Fläche
  // geöffnet hat, und sie geht daraufhin ZU, dann greifen beide Griffe auf denselben Zustand — zwei
  // unabhängige Flächen könnten das nicht. Zusammen mit „zu jedem Zeitpunkt genau ein Suchfeld"
  // ist das die Aussage, die Pedis Bedingung „keine zweite" wirklich trägt.
  it("beide Griffe teilen EINEN Zustand: das Kürzel schliesst, was der Knopf geöffnet hat", async () => {
    await montiere();

    // Der Knopf öffnet — und es ist die echte Palette mit echten Zielen.
    await klick(knopf());
    expect(palettenFelder()).toHaveLength(1);
    const feld = palettenFelder()[0];
    expect(feld).toBeTruthy();
    if (feld) {
      await tippe(feld, "Biblio");
    }
    expect(treffer().map((t) => t.pfad)).toContain("/bibliothek");

    // JETZT das Kürzel, bei OFFENER Fläche: es schaltet sie zu. Genau das kann nur gelingen, wenn
    // Knopf und Kürzel denselben Offen-Zustand bedienen.
    await kuerzel();
    expect(
      paletteOffen(),
      "das Kürzel schliesst die vom Knopf geöffnete Fläche nicht — es sind zwei Zustände",
    ).toBe(false);

    // Und die Fläche beginnt frisch: die Eingabe von vorhin ist fort. Gemessen, nicht vermutet.
    await klick(knopf());
    expect(palettenFelder()).toHaveLength(1);
    expect(palettenFelder()[0]?.value, "eine alte Suche steht wieder da").toBe("");
    await escapeTaste();
  });
});

describe("JOB 3503 · 3b-C · der Tastaturweg bleibt unverändert", () => {
  it("⌘K öffnet VOR und NACH dem Klick — der Knopf ergänzt das Kürzel, er ersetzt es nicht", async () => {
    await montiere();

    // Vorher: das Kürzel allein trägt.
    await kuerzel();
    expect(paletteOffen(), "⌘K öffnet nicht mehr").toBe(true);
    await escapeTaste();
    expect(paletteOffen()).toBe(false);

    // Dazwischen: der Klick.
    await klick(knopf());
    expect(paletteOffen()).toBe(true);
    await escapeTaste();

    // Nachher: das Kürzel trägt unverändert weiter.
    await kuerzel();
    expect(paletteOffen(), "nach dem Klick trägt ⌘K nicht mehr").toBe(true);
    await escapeTaste();
    expect(paletteOffen()).toBe(false);
  });

  it("der Knopf ist ohne Maus erreichbar und wird durch Aktivierung des FOKUSSIERTEN Knopfes ausgelöst", async () => {
    // Wie in den übrigen Fällen dieses Auftrags ehrlich abgegrenzt: jsdom leitet Enter nicht in
    // einen Knopfklick um (das tut der Browser). Gemessen wird deshalb, dass der Knopf in der
    // Tabulatorfolge liegt und Fokus annimmt — der Rest ist Browsersache und steht als Zeile
    // K-gehezu in `tests/design/h1-funktionsinventar.test.ts`.
    await montiere();
    const k = knopf();
    expect(k.getAttribute("tabindex"), "der Knopf ist aus der Tabulatorfolge genommen").toBeNull();
    expect(k.hasAttribute("disabled")).toBe(false);
    k.focus();
    expect(document.activeElement).toBe(k);
    await klick(document.activeElement ?? k);
    expect(paletteOffen()).toBe(true);
    await escapeTaste();
  });
});

describe("JOB 3503 · 3b-D · die Palette findet den neuen Bereich „Meine Entwürfe“", () => {
  it("Eingabe des Namens, den der Mensch im Kopfband liest, führt auf /entwuerfe", async () => {
    await montiere();
    await klick(knopf());
    const feld = palettenFelder()[0];
    expect(feld).toBeTruthy();
    // Gesucht wird mit dem Wort, das am Kopfband-Punkt STEHT — nicht mit einem Testwort.
    if (feld) {
      await tippe(feld, i18n.t("mob.drafts"));
    }
    const zeilen = treffer().filter((t) => t.pfad === "/entwuerfe");
    expect(zeilen, "„Meine Entwürfe“ ist über „Gehe zu …“ nicht auffindbar").toHaveLength(1);
    expect(zeilen[0]?.name).toBe(i18n.t("mob.drafts"));

    // Und der Treffer trägt: der Klick geht wirklich dorthin.
    const ziel = container.querySelector<HTMLButtonElement>(
      'li button[data-cmd-pfad="/entwuerfe"]',
    );
    expect(ziel).toBeTruthy();
    if (ziel) {
      await klick(ziel);
    }
    expect(adresse()).toBe("/entwuerfe");
  });
});
