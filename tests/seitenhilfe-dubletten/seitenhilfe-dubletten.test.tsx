// @vitest-environment jsdom
// ================================================================================================
// JOB 3671 — SEITENHILFE AUF DEN ZWEI DUBLETTENFLÄCHEN.
// ================================================================================================
//
// Die Stelle, an der ein Neuling am ehesten falsch entscheidet: zwei fast gleiche Wissensobjekte,
// vier Knöpfe, und im Zahnrad stand dazu bis hierher „Zu dieser Seite gibt es keine Erklärung."
// (`/duplikate` hat kein Hilfekapitel, `navHilfeFor` gibt darum `null` — lib/navHilfe.ts:54.)
//
// WARUM GEMOUNTET UND NICHT GEGREPPT: `HelpTip` rendert NICHTS (components/HelpTip.tsx). Ein
// Quellbefund „der Aufruf steht da" beweist also gerade nicht, dass ein Mensch den Text erreicht —
// er erreicht ihn nur, wenn der Sammler der ECHTEN Hülle ihn aufnimmt und das Zahnrad ihn listet.
// Deshalb fahren diese Fälle `AppShell` + Seite im jsdom und lesen die Zahnradliste ab.
//
// WAS DIE FÄLLE PINNEN — nicht „ein Text ist da", sondern DIE ZUSAGEN DES TEXTES:
//   S1/S3  beide Flächen melden sich, und zwar in JEDEM Zustand (leer, „nicht gefunden").
//   S2     Sprachwächter: der DOM wird gegen die jeweilige SPRACHRESSOURCE geprüft (kein Rückfall
//          auf Deutsch) — die Korrekturpflicht aus JOB 3742 R1, hier von Anfang an so gebaut.
//   S4     der Rückweg heisst auf der Konfliktseite „Konflikte" und nicht „Duplikate".
//   S5     die vorhandene Ampel-Legende wird NICHT gedoppelt (Auftrag §4.3).
//   S6     die ROLLENZUSAGE hängt an ihrer Voraussetzung: wer die Fläche sieht, darf entscheiden.
//   S7     die SCHMAL-ZUSAGE hängt an der Layoutbauform (`flex-col sm:flex-row`).
//   S8     kein Erklärtext im Sichtfeld (Pedi 04.09.).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const daten = vi.hoisted(() => ({ antworten: {} as Record<string, unknown> }));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "controller" })),
    logout: vi.fn(async () => ({})),
  },
}));

// Ein Endpunktbaum, der auf JEDEN Pfad antwortet (die Hülle ruft weit mehr als die zwei Seiten) —
// mit echten Daten genau dort, wo `daten.antworten` einen Pfad nennt. Bauform aus
// `tests/app/h1-seitenhilfe-mounted.test.tsx`, um den Pfad erweitert.
vi.mock("../../apps/web/src/api/endpoints", () => {
  const make = (pfad: string): unknown =>
    new Proxy(
      vi.fn(async () => daten.antworten[pfad] ?? []),
      {
        get(target, prop, recv) {
          if (prop in target || typeof prop === "symbol") {
            return Reflect.get(target, prop, recv);
          }
          return make(pfad === "" ? String(prop) : `${pfad}.${String(prop)}`);
        },
      },
    );
  return { endpoints: make("") };
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
import { GUARDED_ITEMS } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
import { DuplicateCompare } from "../../apps/web/src/pages/DuplicateCompare";
import { Duplicates } from "../../apps/web/src/pages/Duplicates";
import { AppShell } from "../../apps/web/src/shell/AppShell";
import { ROLE_PERMISSIONS, can } from "../../services/rbac";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const SPRACHEN = ["de", "en", "nl"] as const;
type Sprache = (typeof SPRACHEN)[number];

const ko = (id: string, titel: string, aussage: string): Record<string, unknown> => ({
  id,
  title: titel,
  statement: aussage,
  bodyHtml: null,
  status: "validiert",
  type: "technik",
  category: "Betrieb",
  trust: 80,
  conditions: [],
  measures: [],
  sources: [],
  attachments: [],
  comments: [],
  tags: [],
  neededValidations: 3,
  createdAt: "2026-09-01T06:00:00.000Z",
  updatedAt: "2026-09-01T06:00:00.000Z",
});

const KOS = [
  ko("ko-a", "Reifenwechsel A", "Reifen bei unter 1,6 mm Profiltiefe tauschen."),
  ko("ko-b", "Reifenwechsel B", "Abgefahrene Pneus sind vor der Fahrt zu ersetzen."),
];

const PAAR = {
  id: "dup-1",
  koA: "ko-a",
  koB: "ko-b",
  relation: "identisch",
  aspects: [],
  eigenanteilA: "",
  eigenanteilB: "",
  recommendation: "zusammenfuehren_pruefen",
  status: "offen",
  pairKey: "dup|ko-a|ko-b",
  origin: "auto",
  detector: {
    trigger: "validation",
    method: "model",
    lexicalScore: 0.26,
    confidence: 0.95,
    rationale: "Gleiche Reifenaussage, anders formuliert.",
    modelLabel: "anthropic:test",
  },
  createdAt: "2026-09-08T09:00:00.000Z",
};

const VERGLEICHSPFAD = "/duplikate/dup-1/vergleich";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function setzeBreite(schmal: boolean): void {
  (globalThis as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (q) =>
    ({
      matches: schmal,
      media: q,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

async function mounte(pfad: string, inhalt: unknown): Promise<void> {
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
                createElement(MemoryRouter, { initialEntries: [pfad] }, inhalt as never),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await act(flush);
}

/** Das Brett `/duplikate` in der echten Hülle. */
const mounteBrett = (): Promise<void> =>
  mounte("/duplikate", createElement(AppShell, null, createElement(Duplicates)) as unknown);

/** Die Vergleichsseite in der echten Hülle — als Duplikat- oder als Konfliktaufruf. */
const mounteVergleich = (
  art: "duplicate" | "conflict" = "duplicate",
  pfad = VERGLEICHSPFAD,
): Promise<void> =>
  mounte(
    pfad,
    createElement(
      AppShell,
      null,
      createElement(
        Routes,
        null,
        createElement(Route, {
          path: art === "duplicate" ? "/duplikate/:id/vergleich" : "/konflikte/:id/vergleich",
          element: createElement(DuplicateCompare, { kind: art }),
        }),
      ),
    ) as unknown,
  );

const einzeilig = (text: string | null | undefined): string =>
  (text ?? "").replace(/\s+/g, " ").trim();

async function klick(el: Element | null | undefined): Promise<void> {
  if (!(el instanceof HTMLElement)) {
    throw new Error("Element zum Klicken fehlt");
  }
  await act(async () => {
    el.click();
    await flush();
  });
}

/** Öffnet Zahnrad → „Seitenhilfe" (breit) und gibt den Text der Liste zurück. */
async function seitenhilfeText(): Promise<string> {
  await klick(container.querySelector('[data-testid="kopfband-zahnrad"]'));
  await klick(container.querySelector('[data-testid="zahnrad-seitenhilfe"]'));
  const liste = container.querySelector('[data-testid="seitenhilfe-liste"]');
  if (!liste) {
    throw new Error("Die Seitenhilfe-Liste fehlt — das Zahnrad hat nichts zu zeigen.");
  }
  return einzeilig(liste.textContent);
}

// ------------------------------------------------------------------------------------------------
// DER SPRACHWÄCHTER-KERN (Korrekturpflicht aus JOB 3742 R1).
// ------------------------------------------------------------------------------------------------
//
// `i18n.t` würde eine fehlende niederländische Zeile still auf Deutsch beantworten (fallbackLng:
// "de", i18n.ts) — ein Test, der gegen `t()` prüft, wäre grün, während der Niederländer Deutsch
// liest. Deshalb wird hier die SPRACHRESSOURCE selbst gelesen; fehlt sie, fliegt der Fall mit
// Nennung von Schlüssel UND Sprache.
function ressource(sprache: Sprache, schluessel: string): string {
  const wert: unknown = i18n.getResource(sprache, "translation", schluessel);
  if (typeof wert !== "string" || wert.trim() === "") {
    throw new Error(`Schlüssel ${schluessel} fehlt in der Sprachressource ${sprache}`);
  }
  return wert;
}

/** Der erwartete Text: Ressource der Sprache, Einsetzungen ebenfalls aus der Ressource dieser Sprache. */
function eingesetzt(
  sprache: Sprache,
  schluessel: string,
  einsetzungen: Record<string, string> = {},
): string {
  let text = ressource(sprache, schluessel);
  for (const [name, wert] of Object.entries(einsetzungen)) {
    text = text.replaceAll(`{{${name}}}`, wert);
  }
  return einzeilig(text);
}

const brettTexte = (sprache: Sprache): readonly string[] => [
  eingesetzt(sprache, "dup.seitenhilfe.flaeche.titel"),
  eingesetzt(sprache, "dup.seitenhilfe.flaeche.text", {
    mehr: ressource(sprache, "pruefen.more"),
  }),
  eingesetzt(sprache, "dup.seitenhilfe.entscheidung.titel"),
  eingesetzt(sprache, "dup.seitenhilfe.entscheidung.text", {
    bibliothek: ressource(sprache, "nav.library"),
  }),
];

const vergleichTexte = (
  sprache: Sprache,
  brettSchluessel = "pruefen.tab.duplikate",
): readonly string[] => [
  eingesetzt(sprache, "dcmp.seitenhilfe.titel"),
  eingesetzt(sprache, "dcmp.seitenhilfe.text", {
    mehr: ressource(sprache, "pruefen.more"),
    legende: ressource(sprache, "dcmp.legendHelpTitle"),
    brett: ressource(sprache, brettSchluessel),
  }),
];

beforeEach(async () => {
  daten.antworten = {
    "duplicates.list": [PAAR],
    "duplicates.settings": { minConfidence: 0.5 },
    "ko.list": KOS,
    "aiCheck.coverageSummary": { total: 2, incomplete: 0, unchecked: 0, noCoverage: 0 },
    "gaps.summary": { total: 0, byPriority: {} },
  };
  setzeBreite(false);
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.clearAllMocks();
  await i18n.changeLanguage("de");
});

describe("JOB 3671 · S1 — das Brett Duplikate erklaert sich im Zahnrad", () => {
  it("beide Einträge stehen vollständig in der Seitenhilfe (Titel UND Text)", async () => {
    await mounteBrett();
    const text = await seitenhilfeText();
    for (const erwartet of brettTexte("de")) {
      expect(text).toContain(erwartet);
    }
  });

  it("der Platzhalter ohne Erklaerung ist damit weg", async () => {
    await mounteBrett();
    const text = await seitenhilfeText();
    expect(text).not.toContain(ressource("de", "menue.seitenhilfe.leer"));
  });

  // Wer nicht weiterweiss, hat oft gerade KEIN Paar vor sich. Eine Hilfe, die erst mit der ersten
  // Karte erscheint, fehlt genau dann.
  it("auch ohne offene Dublette steht die Hilfe da", async () => {
    daten.antworten = { ...daten.antworten, "duplicates.list": [] };
    await mounteBrett();
    expect(einzeilig(container.querySelector('[data-testid="pruefen-flaeche"]')?.textContent)).toBe(
      ressource("de", "dup.empty"),
    );
    const text = await seitenhilfeText();
    expect(text).toContain(brettTexte("de")[1] ?? "");
  });
});

describe("JOB 3671 · S2 — Sprachwächter: DE, EN und NL kommen aus ihrer eigenen Ressource", () => {
  for (const sprache of SPRACHEN) {
    it(`${sprache}: die vier Zeilen des Bretts stehen wörtlich so im DOM`, async () => {
      await i18n.changeLanguage(sprache);
      await mounteBrett();
      const text = await seitenhilfeText();
      for (const erwartet of brettTexte(sprache)) {
        expect(text).toContain(erwartet);
      }
      // Eine fehlende Einsetzung fällt sonst niemandem auf: `{{mehr}}` stünde wörtlich da.
      expect(text).not.toContain("{{");
    });

    it(`${sprache}: die zwei Zeilen der Vergleichsseite stehen wörtlich so im DOM`, async () => {
      await i18n.changeLanguage(sprache);
      await mounteVergleich();
      const text = await seitenhilfeText();
      for (const erwartet of vergleichTexte(sprache)) {
        expect(text).toContain(erwartet);
      }
      expect(text).not.toContain("{{");
    });
  }

  // Eine niederländische Zeile, die den deutschen Satz KOPIERT, ist keine Übersetzung. Der Fall
  // vergleicht die drei Ressourcen unmittelbar gegeneinander.
  it("kein Schlüssel trägt in zwei Sprachen denselben Wortlaut", () => {
    const schluessel = [
      "dup.seitenhilfe.flaeche.titel",
      "dup.seitenhilfe.flaeche.text",
      "dup.seitenhilfe.entscheidung.titel",
      "dup.seitenhilfe.entscheidung.text",
      "dcmp.seitenhilfe.titel",
      "dcmp.seitenhilfe.text",
    ];
    for (const s of schluessel) {
      const werte = SPRACHEN.map((sprache) => ressource(sprache, s));
      expect(new Set(werte).size, `${s} ist nicht in allen drei Sprachen verschieden`).toBe(
        SPRACHEN.length,
      );
    }
  });
});

describe("JOB 3671 · S3 — die Vergleichsseite erklärt sich in JEDEM Zustand", () => {
  it("mit gefundenem Paar steht der Eintrag im Zahnrad", async () => {
    await mounteVergleich();
    const text = await seitenhilfeText();
    for (const erwartet of vergleichTexte("de")) {
      expect(text).toContain(erwartet);
    }
  });

  it("auch im Zustand nicht gefunden — dem Zustand, in dem man am ehesten sucht", async () => {
    await mounteVergleich("duplicate", "/duplikate/gibt-es-nicht/vergleich");
    expect(einzeilig(container.querySelector("main")?.textContent)).toContain(
      ressource("de", "dcmp.notFound"),
    );
    const text = await seitenhilfeText();
    expect(text).toContain(vergleichTexte("de")[1] ?? "");
  });
});

describe("JOB 3671 · S4 — der Rückweg nennt das Brett, von dem der Aufruf kam", () => {
  it("Konfliktaufruf nennt den Reiter Konflikte, nicht Duplikate", async () => {
    daten.antworten = {
      ...daten.antworten,
      "conflicts.list": [{ ...PAAR, id: "con-1", type: "truth" }],
    };
    await mounteVergleich("conflict", "/konflikte/con-1/vergleich");
    const text = await seitenhilfeText();
    expect(text).toContain(vergleichTexte("de", "pruefen.tab.konflikte")[1] ?? "");
    expect(text).not.toContain(vergleichTexte("de", "pruefen.tab.duplikate")[1] ?? "");
  });
});

describe("JOB 3671 · S5 — die vorhandene Ampel-Legende wird nicht gedoppelt", () => {
  it("der Zahnradtext erklärt die Farben nicht selbst, sondern nennt die Legende", async () => {
    await mounteVergleich();
    const zahnrad = await seitenhilfeText();
    // Er VERWEIST auf sie (ihr Titel steht drin) …
    expect(zahnrad).toContain(ressource("de", "dcmp.legendHelpTitle"));
    // … und erklärt die drei Farben NICHT ein zweites Mal.
    expect(zahnrad).not.toContain(ressource("de", "dcmp.legendHelpBody"));
    for (const ton of ["green", "yellow", "red"]) {
      expect(zahnrad).not.toContain(ressource("de", `dcmp.tone.${ton}.meaning`));
    }
  });

  it("die Legende selbst steht unveraendert im Mehr der Seite", async () => {
    await mounteVergleich();
    for (const d of [...container.querySelectorAll("details")]) {
      (d as HTMLDetailsElement).open = true;
    }
    await act(flush);
    const mehr = einzeilig(
      container.querySelector('[data-testid="pruefen-mehr-vergleich"]')?.textContent,
    );
    expect(mehr).toContain(ressource("de", "dcmp.legendHelpTitle"));
    expect(mehr).toContain(ressource("de", "dcmp.legendHelpBody"));
  });
});

// ------------------------------------------------------------------------------------------------
// S6 — DIE ROLLENZUSAGE HÄNGT AN IHRER VORAUSSETZUNG.
// ------------------------------------------------------------------------------------------------
//
// Der Hilfetext sagt „Entscheiden darf, wer Wissen prüfen darf; mit einer schwächeren Rolle führt
// der Weg hierher nicht auf diese Fläche". Das ist heute wahr, weil ZWEI Dinge zusammenpassen:
// beide Routen verlangen `controller`, und die vier Abschlüsse verlangen `ko.validate`, das genau
// controller und admin haben. Verschiebt jemand eines von beiden, wird die Zusage falsch — und
// dieser Fall rot. Er ersetzt keine Montage mit Betrachterrolle: eine solche Montage könnte die
// Aussage gar nicht widerlegen, weil ein Betrachter die Fläche nie zu sehen bekommt.
describe("JOB 3671 · S6 — wer die Fläche sieht, darf auch entscheiden", () => {
  it("beide Routen verlangen mindestens die Rolle controller", () => {
    for (const pfad of ["/duplikate", "/duplikate/:id/vergleich", "/konflikte/:id/vergleich"]) {
      const item = GUARDED_ITEMS.find((i) => i.path === pfad);
      expect(item, `Route ${pfad} steht nicht unter dem Rollen-Gate`).toBeDefined();
      expect(item?.minRole, `Route ${pfad}`).toBe("controller");
    }
  });

  it("die vier Abschlüsse verlangen `ko.validate` — controller und admin haben es, viewer und experte nicht", () => {
    expect(can("controller", "ko.validate")).toBe(true);
    expect(can("admin", "ko.validate")).toBe(true);
    expect(can("viewer", "ko.validate")).toBe(false);
    expect(can("experte", "ko.validate")).toBe(false);
    // Und keine Rolle unter controller bekommt das Recht still dazu.
    expect(ROLE_PERMISSIONS.viewer).not.toContain("ko.validate");
    expect(ROLE_PERMISSIONS.experte).not.toContain("ko.validate");
  });
});

// ------------------------------------------------------------------------------------------------
// S7 — DIE SCHMAL-ZUSAGE HÄNGT AN DER LAYOUTBAUFORM.
// ------------------------------------------------------------------------------------------------
//
// jsdom rechnet kein CSS aus; „untereinander" lässt sich dort nicht messen. Messbar ist die Bauform,
// die es erzeugt: `PruefenPaar` ist `flex-col sm:flex-row` — unter 640 px also untereinander, und
// die ERSTE Karte (`…-karte-a`, auf die `dup.side.left` wirkt) steht oben. Genau das sagt der Text.
describe("JOB 3671 · S7 — schmal stimmt die Beschreibung auch", () => {
  it("die zwei Karten sind schmal untereinander, breit nebeneinander — Karte a kommt zuerst", async () => {
    await mounteBrett();
    const paar = container.querySelector('[data-testid="pruefen-paar"]');
    expect(paar).not.toBeNull();
    const klassen = paar?.className ?? "";
    expect(klassen).toContain("flex-col");
    expect(klassen).toContain("sm:flex-row");
    const karten = [...(paar?.children ?? [])].map((c) => c.getAttribute("data-testid"));
    expect(karten).toEqual(["pruefen-paar-karte-a", "pruefen-paar-karte-b"]);
  });

  it("im Drawer (≤ 899 px) steht dieselbe Seitenhilfe", async () => {
    setzeBreite(true);
    await mounteBrett();
    await klick(container.querySelector(`[aria-label="${i18n.t("topbar.openMenu")}"]`));
    const dialog = container.querySelector("dialog[aria-modal='true']");
    expect(dialog).not.toBeNull();
    await klick(dialog?.querySelector('[data-testid="zahnrad-seitenhilfe"]'));
    const text = einzeilig(dialog?.querySelector('[data-testid="seitenhilfe-liste"]')?.textContent);
    for (const erwartet of brettTexte("de")) {
      expect(text).toContain(erwartet);
    }
  });
});

describe("JOB 3671 · S8 — kein Erklärtext im Sichtfeld (Pedi 04.09.)", () => {
  it("das Brett zeigt die zwei Hilfetexte nicht auf der Fläche", async () => {
    await mounteBrett();
    const main = einzeilig(container.querySelector("main")?.textContent);
    for (const erwartet of brettTexte("de")) {
      expect(main).not.toContain(erwartet);
    }
  });

  it("die Vergleichsseite zeigt ihren Hilfetext nicht auf der Fläche", async () => {
    await mounteVergleich();
    const main = einzeilig(container.querySelector("main")?.textContent);
    for (const erwartet of vergleichTexte("de")) {
      expect(main).not.toContain(erwartet);
    }
  });
});
