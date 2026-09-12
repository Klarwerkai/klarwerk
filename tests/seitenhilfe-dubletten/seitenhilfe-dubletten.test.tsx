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
//
// JOB 3771 ERWEITERT DIESE DATEI (kein zweiter Wächter): dieselbe Fläche sagte im „?"-Menü und auf
// zwei Knopf-/Statustexten etwas anderes als der Zahnradtext oben. S9–S12 pinnen, dass die drei
// Texte nur noch das versprechen, was `OverlapService.close` wirklich tut.
//   S9     der „?"-Text trägt in DE/EN/NL keine Verschmelzungszusage.
//   S10    Knopf 3 und der Abschlussgrund versprechen keine Verknüpfung und sprechen dieselbe
//          Sprache; das Aktionsband bricht um, statt breiter zu werden.
//   S11    Gegenprobe: der historische Wortlaut wird von S9/S10 erkannt.
//   S12    Zustand: derselbe Wortlaut leer/fehlerhaft, und nach einem GESCHEITERTEN Abschluss
//          steht kein Abschlussgrund da.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const daten = vi.hoisted(() => ({
  antworten: {} as Record<string, unknown>,
  // JOB 3771 · S12: Pfade, die absichtlich scheitern — für den Fehlerzustand der Liste und für den
  // gescheiterten Abschluss. Ohne das käme man an den Zustand „Abschluss versucht, nichts
  // gespeichert" gar nicht heran.
  fehler: new Set<string>(),
}));

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
      vi.fn(async () => {
        if (daten.fehler.has(pfad)) {
          throw new Error(`Aufruf ${pfad} ist absichtlich gescheitert`);
        }
        return daten.antworten[pfad] ?? [];
      }),
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

/** JOB 3771: öffnet das „?"-Menü neben der Überschrift und gibt seinen Text zurück. Geschlossen
 *  rendert `PruefenMenue` seinen Inhalt gar nicht (PruefenMenue.tsx:90) — gelesen wird also genau
 *  das, was ein Mensch nach dem Klick vor sich hat. */
async function hilfeMenueText(): Promise<string> {
  await klick(container.querySelector('[data-testid="pruefen-menue-hilfe"]'));
  const panel = container.querySelector('[data-testid="pruefen-menue-panel-hilfe"]');
  if (!panel) {
    throw new Error("Das „?“-Menü der Dublettenfläche hat nichts zu zeigen.");
  }
  return einzeilig(panel.textContent);
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
  daten.fehler = new Set<string>();
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

// ================================================================================================
// JOB 3771 — DREI TEXTE SAGEN, WAS DIE VIER KNÖPFE WIRKLICH TUN.
// ================================================================================================
//
// WAS DIE FLÄCHE TATSÄCHLICH TUT, gemessen am Dienst: `OverlapService.linkRelated`
// (services/conflicts/src/overlap-service.ts:673-675) ruft nur `close(…, "linked_related", …)`;
// `close` (:732-749) setzt `status`, `resolution`, `closedAt` und schreibt einen Audit-Eintrag —
// mehr nicht. Kein Wissensobjekt wird angefasst, kein Verknüpfungsfeld beschrieben, und
// `"merged"` kommt im ganzen Modul nur als Typwert vor (overlap-types.ts:11, „Stufe D5").
//
// WARUM EIN WORTSTAMM-VERBOT UND KEIN WORTLAUT-PIN: ein Pin auf den heutigen Satz wäre grün, sobald
// jemand ihn umformuliert und dabei das Versprechen mitnimmt. Verboten ist deshalb die ZUSAGE,
// nicht die Formulierung — und zusätzlich wird die ehrliche Kernaussage positiv verlangt, damit
// ein leerer Text die Liste nicht trivial besteht.
const VERSCHMELZUNGSZUSAGEN: Record<Sprache, readonly string[]> = {
  // „verschmelz"/„verschmolz" getrennt, weil der Ablaut den Stamm bricht: der alte Satz sagte
  // „was verschmolzen wird", ein „verschmelz"-Verbot allein hätte ihn durchgelassen. Ebenso
  // „zusammenführ" (Infinitiv/Präsens) und „zusammengeführ" (Partizip mit eingeschobenem „ge").
  de: ["verschmelz", "verschmolz", "zusammenführ", "zusammengeführ", "zusammengelegt"],
  // „merg" deckt merge/merges/merging/merged in einem; ein „merge"-Verbot liesse „merging" durch.
  en: ["merg", "consolidat"],
  // „samenvoeg" (samenvoegen) und „samengevoeg" (samengevoegd) — dieselbe Partizip-Falle wie im DE.
  nl: ["samenvoeg", "samengevoeg", "samensmelt"],
};

// Die Verknüpfungszusage der Knopfbeschriftung und des Abschlussgrundes. „koppel" deckt
// „koppelen" und „gekoppeld"; „link" deckt „link them" und „Linked as related".
const VERKNUEPFUNGSZUSAGEN: Record<Sprache, readonly string[]> = {
  de: ["verknüpf", "verlink"],
  en: ["link"],
  nl: ["koppel"],
};

/** Knopf und Folgeanzeige sollen dieselbe Sprache sprechen: derselbe Wortstamm und derselbe Bezug. */
const GLEICHE_SPRACHE: Record<Sprache, { stamm: string; bezug: string }> = {
  de: { stamm: "vermerk", bezug: "verwandt" },
  en: { stamm: "note", bezug: "related" },
  nl: { stamm: "note", bezug: "verwant" },
};

/** Welche der verbotenen Stämme stehen im Text? Gibt die Treffer zurück, damit die Meldung sie nennt. */
function verstoesse(text: string, verbotene: readonly string[]): string[] {
  const klein = text.toLowerCase();
  return verbotene.filter((stamm) => klein.includes(stamm));
}

// Der historische Wortlaut vom 12.09.2026 (main 456787e) — die Gegenprobe von S11 hängt daran.
const ALTER_WORTLAUT = {
  hilfe: {
    de: "Zusammenführen passiert nie automatisch — du entscheidest bewusst, was verschmolzen wird.",
    en: "Merging never happens automatically — you deliberately decide what gets merged.",
    nl: "Samenvoegen gebeurt nooit automatisch — jij beslist bewust wat wordt samengevoegd.",
  },
  knopf: {
    de: "Beide behalten, verknüpfen",
    en: "Keep both, link them",
    nl: "Beide behouden, koppelen",
  },
  grund: { de: "Als verwandt verlinkt", en: "Linked as related", nl: "Als verwant gekoppeld" },
} as const;

/** Dasselbe Paar wie oben, aber bereits mit `linked_related` geschlossen — dann zeigt die Fläche
 *  den Abschlussgrund statt der vier Knöpfe (`canClose`, lib/duplicateBoard.ts:127). */
const PAAR_GESCHLOSSEN = {
  ...PAAR,
  status: "geschlossen",
  resolution: {
    reason: "linked_related",
    by: "u1",
    note: null,
    at: "2026-09-10T10:00:00.000Z",
  },
  closedAt: "2026-09-10T10:00:00.000Z",
};

describe("JOB 3771 · S9 — der „?“-Text verspricht kein Verschmelzen", () => {
  for (const sprache of SPRACHEN) {
    it(`${sprache}: kein Wortstamm, der ein Zusammenführen in Aussicht stellt`, async () => {
      await i18n.changeLanguage(sprache);
      await mounteBrett();
      const text = await hilfeMenueText();

      // 1 · Der Mensch liest wirklich die Ressource SEINER Sprache (kein Rückfall auf Deutsch).
      const ressourcentext = eingesetzt(sprache, "dup.help.detection.body");
      expect(text).toContain(ressourcentext);

      // 2 · Weder im DOM noch in der Ressource steht eine Verschmelzungszusage.
      const verbotene = VERSCHMELZUNGSZUSAGEN[sprache];
      expect(
        verstoesse(ressourcentext, verbotene),
        `die ${sprache.toUpperCase()}-Ressource zu dup.help.detection.body stellt ein Zusammenführen in Aussicht`,
      ).toEqual([]);

      // 3 · UND ZWAR IM GANZEN MENÜ, nicht nur im ersten Absatz. Darunter steht `dup.intro`
      // (Duplicates.tsx:221-222) — die Halbheit aus Auftrag §8.4 wäre, den ersten Absatz zu
      // korrigieren und den Widerspruch einen Zentimeter tiefer stehen zu lassen. Beide Absätze
      // werden hier zusammen gelesen, so wie ein Mensch sie liest.
      expect(text, `${sprache}: der zweite Absatz des „?“-Menüs fehlt`).toContain(
        eingesetzt(sprache, "dup.intro"),
      );
      expect(
        verstoesse(text, verbotene),
        `das „?“-Menü (${sprache}) verspricht ein Zusammenführen`,
      ).toEqual([]);
      expect(
        verstoesse(text, VERKNUEPFUNGSZUSAGEN[sprache]),
        `das „?“-Menü (${sprache}) verspricht eine Verknüpfung in den Objekten`,
      ).toEqual([]);
    });

    // Ein reines Verbot bestünde auch ein leergeräumter Text. Verlangt ist zusätzlich, dass der
    // Erkennungsweg erhalten bleibt UND die ehrliche Wirkung dasteht.
    it(`${sprache}: Erkennungsweg bleibt erhalten, und die tatsächliche Wirkung steht da`, async () => {
      await i18n.changeLanguage(sprache);
      const body = eingesetzt(sprache, "dup.help.detection.body").toLowerCase();
      const erkennung = { de: "modell", en: "model", nl: "model" }[sprache];
      const abschluss = { de: "abschlussgrund", en: "closing reason", nl: "afsluitreden" }[sprache];
      const bleiben = { de: "bleiben", en: "stay", nl: "blijven" }[sprache];
      expect(body, `${sprache}: der Erkennungsweg ist verschwunden`).toContain(erkennung);
      expect(body, `${sprache}: der festgehaltene Abschlussgrund fehlt`).toContain(abschluss);
      expect(body, `${sprache}: die Zusage „beide Objekte bleiben“ fehlt`).toContain(bleiben);
    });
  }
});

describe("JOB 3771 · S10 — Knopf und Abschlussgrund versprechen keine Verknüpfung", () => {
  for (const sprache of SPRACHEN) {
    it(`${sprache}: der dritte Knopf trägt die Ressource seiner Sprache, ohne Verknüpfungszusage`, async () => {
      await i18n.changeLanguage(sprache);
      await mounteBrett();
      const knopf = container.querySelector('[data-testid="pruefen-knopf-beide-verknuepfen"]');
      expect(knopf, "der dritte Entscheidungsknopf fehlt").not.toBeNull();
      const beschriftung = einzeilig(knopf?.textContent);
      expect(beschriftung).toBe(eingesetzt(sprache, "dup.side.both"));
      expect(
        verstoesse(beschriftung, VERKNUEPFUNGSZUSAGEN[sprache]),
        `die ${sprache.toUpperCase()}-Beschriftung von dup.side.both verspricht eine Verknüpfung`,
      ).toEqual([]);
    });

    it(`${sprache}: der angezeigte Abschlussgrund sagt dasselbe wie der Knopf`, async () => {
      await i18n.changeLanguage(sprache);
      daten.antworten = { ...daten.antworten, "duplicates.list": [PAAR_GESCHLOSSEN] };
      await mounteBrett();
      const satz = einzeilig(
        container.querySelector('[data-testid="pruefen-satz-geschlossen"]')?.textContent,
      );
      const grund = eingesetzt(sprache, "dup.reason.linked_related");
      expect(satz, "der Abschlussgrund steht nicht auf der Fläche").toContain(grund);
      expect(
        verstoesse(grund, VERKNUEPFUNGSZUSAGEN[sprache]),
        `die ${sprache.toUpperCase()}-Fassung von dup.reason.linked_related verspricht eine Verknüpfung`,
      ).toEqual([]);

      // Dieselbe Sprache: gemeinsamer Wortstamm und gemeinsamer Bezug — sonst liest ein Mensch am
      // Knopf das eine und danach etwas scheinbar anderes.
      const { stamm, bezug } = GLEICHE_SPRACHE[sprache];
      const knopftext = eingesetzt(sprache, "dup.side.both").toLowerCase();
      for (const [name, wert] of [
        ["Knopf", knopftext],
        ["Abschlussgrund", grund.toLowerCase()],
      ] as const) {
        expect(
          wert,
          `${sprache}: ${name} trägt den gemeinsamen Wortstamm „${stamm}“ nicht`,
        ).toContain(stamm);
        expect(wert, `${sprache}: ${name} nennt den Bezug „${bezug}“ nicht`).toContain(bezug);
      }
    });
  }

  // Die Längenauflage (Auftrag §5.2): die neue Beschriftung ist länger als die alte. Getragen wird
  // das nicht von der Knopfbreite, sondern vom Band: `flex flex-wrap` (PruefenPaar.tsx:188) setzt
  // den vierten Knopf auf die nächste Zeile, statt die Reihe aus dem 390-px-Fenster zu schieben.
  // jsdom rechnet kein CSS aus; messbar ist die Bauform, die den Umbruch erzeugt.
  it("das Aktionsband bricht um, statt breiter zu werden", async () => {
    await mounteBrett();
    const band = container.querySelector('[data-testid="pruefen-aktionsband"]');
    expect(band, "das Aktionsband fehlt").not.toBeNull();
    expect(band?.className ?? "").toContain("flex-wrap");
    expect([...(band?.children ?? [])].map((c) => c.getAttribute("data-testid"))).toEqual([
      "pruefen-knopf-links-behalten",
      "pruefen-knopf-rechts-behalten",
      "pruefen-knopf-beide-verknuepfen",
      "pruefen-knopf-kein-duplikat",
    ]);
  });
});

// ------------------------------------------------------------------------------------------------
// S11 — DIE GEGENPROBE, DOKUMENTIERT.
// ------------------------------------------------------------------------------------------------
//
// Alle Läufe mit
// `KLARWERK_SKIP_KEYCHAIN=1 npx vitest run tests/seitenhilfe-dubletten/seitenhilfe-dubletten.test.tsx`.
//
// ROT-ERST, am Katalogstand von main `456787e` (S9 noch ohne die Menü-weite Prüfung):
//   „Tests  15 failed | 26 passed (41)" — S9 6×, S10 6×, S11 1×, S12 2×.
//
// DREI GEGENPROBEN mit DIESER Fassung der Datei, je einzeln verstellt und zurückgenommen
// (`apps/web/src/i18n.ts` danach wieder sha256 95d905fe…):
//   1 · DE `dup.help.detection.body` auf den alten Satz → „5 failed | 36 passed", Meldung
//       „die DE-Ressource zu dup.help.detection.body stellt ein Zusammenführen in Aussicht:
//        expected [ 'verschmolz', 'zusammenführ' ] to deeply equal []".
//   2 · EN `dup.side.both` auf „Keep both, link them" → „3 failed | 38 passed", Meldung
//       „die EN-Beschriftung von dup.side.both verspricht eine Verknüpfung: expected [ 'link' ]".
//   3 · DE `dup.intro` auf den alten Satz → „3 failed | 38 passed", Meldung
//       „das „?“-Menü (de) verspricht ein Zusammenführen: expected [ 'zusammenführ' ]". Nur die
//       MENÜ-WEITE Prüfung fängt diesen Fall; die Ressourcenprüfung des ersten Absatzes bleibt
//       dabei grün — genau deshalb steht sie da.
//
// Der Fall darunter hält dieselbe Aussage dauerhaft und ohne `it.fails`-Pin: er führt den
// HISTORISCHEN Wortlaut durch DIESELBE Prüffunktion, die S9/S10 verwenden. Wird die Verbotsliste
// je so verwässert, dass sie den alten Satz durchliesse, wird er rot — auch dann, wenn der Katalog
// gerade sauber ist und S9/S10 deshalb nichts merken.
describe("JOB 3771 · S11 — der historische Wortlaut wird von der Prüfung erkannt", () => {
  for (const sprache of SPRACHEN) {
    it(`${sprache}: alter „?“-Satz und alte Knopf-/Grundtexte schlagen an`, () => {
      expect(
        verstoesse(ALTER_WORTLAUT.hilfe[sprache], VERSCHMELZUNGSZUSAGEN[sprache]),
        `${sprache}: die Verbotsliste erkennt den alten Verschmelzungssatz nicht mehr`,
      ).not.toEqual([]);
      for (const feld of ["knopf", "grund"] as const) {
        expect(
          verstoesse(ALTER_WORTLAUT[feld][sprache], VERKNUEPFUNGSZUSAGEN[sprache]),
          `${sprache}: die Verbotsliste erkennt den alten ${feld}-Text nicht mehr`,
        ).not.toEqual([]);
      }
    });
  }

  // Und der alte Wortlaut ist wirklich weg — nicht als zweiter Schlüssel danebengelegt.
  it("kein Schlüssel des Katalogs trägt den alten Wortlaut noch", () => {
    for (const sprache of SPRACHEN) {
      expect(eingesetzt(sprache, "dup.help.detection.body")).not.toContain(
        ALTER_WORTLAUT.hilfe[sprache],
      );
      expect(eingesetzt(sprache, "dup.side.both")).not.toBe(ALTER_WORTLAUT.knopf[sprache]);
      expect(eingesetzt(sprache, "dup.reason.linked_related")).not.toBe(
        ALTER_WORTLAUT.grund[sprache],
      );
    }
  });
});

// ------------------------------------------------------------------------------------------------
// S12 — ZUSTAND: DERSELBE WORTLAUT ÜBERALL, UND KEIN GRUND OHNE ABSCHLUSS.
// ------------------------------------------------------------------------------------------------
//
// S1/S3 decken die ANWESENHEIT der Hilfe in den Zuständen. Hier geht es um den WORTLAUT: ein Text,
// der im Leerzustand etwas anderes sagt als mit Paar, wäre wieder eine zweite Wahrheit. Und die
// Umkehrung der Ehrlichkeit: ein Abschlussgrund darf nur dastehen, wenn der Abschluss auch
// gespeichert wurde (`Duplicates.tsx:586-590` hängt ihn an `e.resolution`).
describe("JOB 3771 · S12 — der „?“-Text steht in jedem Zustand gleich da", () => {
  it("ohne offenes Paar steht derselbe Wortlaut im „?“-Menü", async () => {
    daten.antworten = { ...daten.antworten, "duplicates.list": [] };
    await mounteBrett();
    expect(einzeilig(container.querySelector('[data-testid="pruefen-flaeche"]')?.textContent)).toBe(
      ressource("de", "dup.empty"),
    );
    const text = await hilfeMenueText();
    expect(text).toContain(eingesetzt("de", "dup.help.detection.body"));
    expect(verstoesse(text, VERSCHMELZUNGSZUSAGEN.de)).toEqual([]);
  });

  it("im Fehlerzustand der Liste steht derselbe Wortlaut im „?“-Menü", async () => {
    daten.fehler.add("duplicates.list");
    await mounteBrett();
    const flaeche = einzeilig(
      container.querySelector('[data-testid="pruefen-flaeche"]')?.textContent,
    );
    expect(flaeche, "die Fläche zeigt gar keinen Fehlerzustand").toContain(
      ressource("de", "pruefen.loadError"),
    );
    const text = await hilfeMenueText();
    expect(text).toContain(eingesetzt("de", "dup.help.detection.body"));
    expect(verstoesse(text, VERSCHMELZUNGSZUSAGEN.de)).toEqual([]);
  });

  it("nach einem GESCHEITERTEN Abschluss steht kein Abschlussgrund da", async () => {
    daten.fehler.add("duplicates.linkRelated");
    await mounteBrett();
    await klick(container.querySelector('[data-testid="pruefen-knopf-beide-verknuepfen"]'));

    const alles = einzeilig(container.querySelector("main")?.textContent);
    expect(alles, "ein Abschlussgrund ohne gespeicherten Abschluss").not.toContain(
      ressource("de", "dup.reason.linked_related"),
    );
    expect(container.querySelector('[data-testid="pruefen-satz-geschlossen"]')).toBeNull();
    // Der Fund bleibt entscheidbar — die vier Knöpfe stehen weiterhin da.
    expect(
      container.querySelector('[data-testid="pruefen-knopf-beide-verknuepfen"]'),
    ).not.toBeNull();
  });
});
