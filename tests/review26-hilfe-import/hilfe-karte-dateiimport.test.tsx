// @vitest-environment jsdom
// ================================================================================================
// JOB 3468 · REVIEW26-HILFE-IMPORT — gemessen an der GEMOUNTETEN Hilfe (Fall D und E).
// ================================================================================================
//
// WARUM GEMOUNTET UND NICHT NUR ÜBER `filterHelpTopics`. Der Filter ist DOM-frei und im Zwilling
// `hilfe-findet-dateiimport.test.ts` schon geprüft. Er bliebe auch dann grün, wenn das Kapitel im
// Suchraum der SEITE gar nicht ankäme — gebaut und nie gerufen ist der teuerste Fehler dieses
// Projekts. Geprüft wird deshalb die echte Seite `pages/Help.tsx` mit echtem Router und echtem
// i18n; der Suchbegriff geht in das ECHTE Eingabefeld. Attrappen gibt es keine.
//
// DIE DREI ZUSTÄNDE DES GRENZEN-ZUSATZES, und alle drei stehen hier als eigener Fall:
//   · Serverwerte liegen vor   → `[data-testid="upload-limits-hint"]` steht IN der Kapitelkarte.
//   · kein Abfragekontext      → kein Zusatz (`UploadLimitsHint.tsx:28-30`), Kapitel bleibt da.
//   · Abruf scheitert / offline → kein Zusatz, KEINE Fehlermeldung in der Hilfekarte.
// In allen drei Fällen bleibt das Kapitel auffindbar und lesbar — es hängt an keinem Abruf.
//
// DIE GEGENPROBEN dieser Datei (RUECKGABE.md, beide gemessen):
//   1. `uploadLimits: true` aus dem Kapitel entfernen     → E1 und E2 rot.
//   2. `help.fileimport.body` (EN) auf den DE-Text setzen → D3 rot (en).
//
// WAS D2 NICHT LEISTET, ausdrücklich: es vergleicht das `href` der Karte mit `topic.to` und belegt
// damit, dass der Link wirklich die Route des Kapitels trägt — nicht, DASS diese Route die richtige
// ist. Wer `to` verstellt, macht deshalb nicht D2 rot, sondern `R1` im DOM-freien Zwilling (dort
// wird die Adresse aus Registry und `wege.ts` abgeleitet). Gemessen: `to: "/erfassen"` → R1, R2 und
// V3 rot, D2 grün. Die beiden Fälle teilen sich die Arbeit, keiner ersetzt den anderen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import type { UploadLimits } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import { HELP_TOPICS } from "../../apps/web/src/lib/helpTopics";
import { maxRawAttachmentMb, transferLimitMb } from "../../apps/web/src/lib/uploadLimits";
import { Help } from "../../apps/web/src/pages/Help";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const KAPITEL = "fileimport";
const GRENZEN: UploadLimits = { maxAttachments: 8, maxAttachmentBytes: 20_000_000 };

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/**
 * Die Seite montieren. `grenzen` entscheidet über den Abfragekontext:
 *   "keiner"    → gar kein QueryClientProvider (die isolierte Montage, `UploadLimitsHint.tsx:28`)
 *   "fehler"    → Provider, aber der Abruf scheitert (Netz aus; kein Retry)
 *   UploadLimits → Provider mit bereits gelieferten Werten im Cache
 */
async function mountHilfe(grenzen: UploadLimits | "keiner" | "fehler"): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const seite = createElement(MemoryRouter, { initialEntries: ["/hilfe"] }, createElement(Help));
  if (grenzen === "keiner") {
    await act(async () => {
      root.render(seite);
      await flush();
    });
    return;
  }
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (grenzen !== "fehler") {
    qc.setQueryData(["upload-limits"], grenzen);
  }
  await act(async () => {
    root.render(createElement(QueryClientProvider, { client: qc }, seite));
    await flush();
  });
}

function suchfeld(): HTMLInputElement {
  const feld = container.querySelector<HTMLInputElement>('input[data-testid="hilfe-suche"]');
  if (!feld) {
    throw new Error("Suchfeld fehlt");
  }
  return feld;
}

/** Tippen wie ein Mensch: über den nativen Setter, damit React den Zustand wirklich übernimmt. */
async function tippe(wert: string): Promise<void> {
  const el = suchfeld();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(el, wert);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
}

function karte(id: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(`[data-hilfe-thema="${id}"]`);
  if (!el) {
    throw new Error(`Kapitel ${id} steht nicht auf der Fläche`);
  }
  return el;
}

const sichtbareKapitel = (): string[] =>
  [...container.querySelectorAll<HTMLElement>("[data-hilfe-thema]")].map(
    (el) => el.dataset.hilfeThema ?? "",
  );

const flach = (roh: string): string => roh.replace(/\s+/g, " ").trim();
const text = (el: ParentNode | null): string =>
  flach((el instanceof HTMLElement ? el.textContent : (el?.textContent ?? "")) ?? "");

function kapitelDef(): (typeof HELP_TOPICS)[number] {
  const def = HELP_TOPICS.find((t) => t.id === KAPITEL);
  if (!def) {
    throw new Error(`HELP_TOPICS führt kein Kapitel \`${KAPITEL}\``);
  }
  return def;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("JOB 3468 · D — „import“ getippt: die Karte steht da und führt hin", () => {
  it("D1: die Karte erscheint, der Leerzustand NICHT", async () => {
    await mountHilfe("keiner");
    await tippe("import");
    expect(sichtbareKapitel(), "die gemeldete Suche findet die Karte nicht").toContain(KAPITEL);
    expect(text(container), "der Leerzustand steht trotz Treffer da").not.toContain(
      i18n.t("help.noResults"),
    );
  });

  it("D2: der Handlungslink zeigt auf die belegte Route und öffnet keinen Tab", async () => {
    await mountHilfe("keiner");
    await tippe("import");
    const link = karte(KAPITEL).querySelector<HTMLAnchorElement>(
      `[data-testid="hilfe-route-${KAPITEL}"]`,
    );
    expect(link, "die Karte hat keinen Handlungslink").not.toBeNull();
    expect(link?.getAttribute("href")).toBe(kapitelDef().to);
    expect(link?.hasAttribute("target"), "die interne Route öffnet einen Tab").toBe(false);
  });

  it("D3: die Karte NENNT den Weg mit den Beschriftungen der Bedienfläche — in DE, EN und NL", async () => {
    // Nicht „das Wort Import steht da", sondern: der Text benennt Fläche, Modus und Knopf WÖRTLICH
    // so, wie die Bedienfläche sie beschriftet. Die Erwartung ist deshalb aus dem Textbestand
    // GELESEN (`nav.capture`, `erfassen.weg.datei`, `capture.file.pick`, `capture.file.importMode.*`)
    // und nicht abgeschrieben: wer einen dieser Knöpfe umbenennt, macht diesen Fall rot — genau
    // dann ist die Anleitung nämlich falsch geworden.
    const beschriftungen = [
      "nav.capture",
      "erfassen.weg.datei",
      "capture.file.pick",
      "capture.file.importMode.points",
      "capture.file.importMode.whole",
    ];
    await mountHilfe("keiner");
    for (const lng of ["de", "en", "nl"] as const) {
      await act(async () => {
        await i18n.changeLanguage(lng);
        await flush();
      });
      await tippe("import");
      const inhalt = text(karte(KAPITEL));
      for (const schluessel of beschriftungen) {
        expect(inhalt, `${lng}: die Anleitung nennt „${i18n.t(schluessel)}“ nicht`).toContain(
          flach(i18n.t(schluessel)),
        );
      }
    }
  });

  it("D4: der Erklärtext hängt nicht am Link — ohne ihn bleibt die Anleitung stehen", async () => {
    await mountHilfe("keiner");
    await tippe("import");
    const k = karte(KAPITEL);
    const absaetze = [...k.querySelectorAll("[data-hilfe-absatz]")].map((p) => text(p));
    expect(absaetze.length, "die Anleitung steht nicht als Absätze da").toBeGreaterThanOrEqual(3);
    expect(absaetze.join(" ")).toContain(flach(i18n.t("capture.file.pick")));
  });

  it("D5: die Karte trägt keine externe Adresse und keinen Quellenblock", async () => {
    await mountHilfe("keiner");
    await tippe("import");
    const k = karte(KAPITEL);
    expect(k.querySelector(`[data-testid="hilfe-quellen-${KAPITEL}"]`)).toBeNull();
    for (const a of k.querySelectorAll("a")) {
      expect(a.getAttribute("href") ?? "", "externe Adresse in der Hilfekarte").toMatch(/^\//);
    }
  });
});

describe("JOB 3468 · E — die Grenzen kommen vom Server, oder es steht nichts da", () => {
  it("E1: mit gelieferten Werten steht der Grenzen-Zusatz IN der Kapitelkarte", async () => {
    await mountHilfe(GRENZEN);
    await tippe("import");
    const zusatz = karte(KAPITEL).querySelector<HTMLElement>('[data-testid="upload-limits-hint"]');
    expect(zusatz, "die Karte zeigt die geltenden Upload-Grenzen nicht").not.toBeNull();
    // Anzahl und Größe stehen wirklich da — und zwar aus dem Serverwert gerechnet, nicht getippt.
    expect(text(zusatz)).toBe(
      flach(
        i18n.t("capture.uploadLimits", {
          count: GRENZEN.maxAttachments,
          mb: transferLimitMb(GRENZEN.maxAttachmentBytes),
          raw: maxRawAttachmentMb(GRENZEN.maxAttachmentBytes),
        }),
      ),
    );
  });

  it("E2: GENAU diese eine Karte trägt den Zusatz — keine andere", async () => {
    await mountHilfe(GRENZEN);
    await tippe("");
    const mitZusatz = [...container.querySelectorAll<HTMLElement>("[data-hilfe-thema]")]
      .filter((k) => k.querySelector('[data-testid="upload-limits-hint"]') !== null)
      .map((k) => k.dataset.hilfeThema ?? "");
    expect(mitZusatz).toEqual([KAPITEL]);
  });

  it("E3: ohne Abfragekontext kein Zusatz — und das Kapitel bleibt auffindbar und lesbar", async () => {
    await mountHilfe("keiner");
    await tippe("import");
    expect(sichtbareKapitel()).toContain(KAPITEL);
    expect(
      karte(KAPITEL).querySelector('[data-testid="upload-limits-hint"]'),
      "ohne Serverwerte wird eine Grenze behauptet",
    ).toBeNull();
    expect(text(karte(KAPITEL))).toContain(flach(i18n.t("capture.file.pick")));
  });

  it("E4: scheitert der Abruf, bleibt die Karte stumm über die Grenzen — keine Fehlermeldung", async () => {
    // Die Hilfe behauptet nichts über einen Dienst, den sie nicht führt (Auftrag §9). Das Netz ist
    // hier wirklich aus: `fetch` wirft, der Abruf scheitert, es wird nicht erneut versucht.
    const abruf = vi.fn(() => Promise.reject(new Error("offline")));
    vi.stubGlobal("fetch", abruf);
    await mountHilfe("fehler");
    await tippe("import");
    expect(
      abruf.mock.calls.length,
      "der Abruf lief gar nicht — der Fall misst nichts",
    ).toBeGreaterThan(0);
    const k = karte(KAPITEL);
    expect(k.querySelector('[data-testid="upload-limits-hint"]')).toBeNull();
    const inhalt = text(k);
    expect(inhalt, "die Hilfekarte meldet einen fremden Dienstfehler").not.toContain("offline");
    expect(inhalt).toContain(flach(i18n.t("capture.file.pick")));
  });
});
