// @vitest-environment jsdom
// ================================================================================================
// JOB 4360 · Q — DER QUELLSTAND AM WISSENSOBJEKT: die ABLEITUNG, die BESCHRIFTUNG, und das NICHTS.
// ================================================================================================
//
// WAS DIESE DATEI TRÄGT und was nicht — der Satz steht vorn, damit ihn niemand suchen muss:
//
//   · SIE TRÄGT die Fälle, die ein einzelner Browserlauf nicht tragen kann, weil sie VIELE
//     verschiedene Quellen nebeneinander brauchen: eine Quelle OHNE gespeicherten Stand, eine mit
//     einem unbrauchbaren Wert (0, negativ, Bruchzahl, NaN), zwei Quellen nebeneinander, und die
//     Beschriftung in DE/EN/NL aus dem WIRKLICHEN Katalog.
//   · SIE BEHAUPTET KEINE SICHTBARKEIT. jsdom rechnet kein Layout; „im Baum" ist hier nicht
//     „ein Mensch sieht es". Den Sichtbarkeitsnachweis trägt ausschliesslich
//     `gesamtweg-im-echten-browser.test.ts` über `strecke.ts` (echtes Chromium, gebaute Fläche,
//     `sichtbarerText` samt Textnachkommen — die Lehre aus 4295 R1/R2/R3).
//
// UND SIE IST NICHT DIE HÄLFTE EINES ZWEITEN WEGES: gemessen wird die ECHTE Lesefläche über die
// ECHTE Route `/wissen/:id` (`KnowledgeDetail` → `BibliothekFlaeche` → `BibliothekLesen` →
// `MehrAbschnitte`). Attrappe ist allein das Netz darunter (`api/endpoints`). Bauform wörtlich
// übernommen aus `tests/q1c-nachladen/mehr-abschnitte-holen-nach.test.tsx` — nichts nachgebaut.
//
// DIE SOLLWERTE KOMMEN AUS `i18n.ts`, nicht aus dieser Datei: die Beschriftung wird je Sprache mit
// `getFixedT` geholt. Ein hier abgeschriebenes „Version" wäre grün geblieben, wenn der Katalog es
// morgen ändert — und hätte für „nl" von vornherein das Falsche geprüft.
//
// DIE FÄLLE:
//   Q1  Eine Quelle MIT Stand zeigt ihn, mit der Katalogbeschriftung — in de, en und nl.
//   Q2  Eine Quelle OHNE Stand zeigt NICHTS: kein Knoten, kein „—", keine geratene 1. Herkunft,
//       Adresse, Aufnahmezeit und Datei bleiben unverändert da (4095/4077 bleiben grün).
//   Q3  Unbrauchbare Werte (0, negativ, Bruchzahl, NaN) sind KEIN Stand — vier Löcher, viermal nichts.
//   Q4  Zwei Quellen nebeneinander: genau EINE trägt den Stand, und zwar die richtige.
import { describe, expect, it, vi } from "vitest";

/** Die Marke der neuen Angabe — bewusst als Literal, nicht aus dem Produkt importiert. */
const STAND_MARKE = "bib-quelle-stand";
const QUELLEN = "quellen";

/** Der Stand, den die Quelle mit Herkunft SharePoint trägt (Sekunden seit 1970, wie der Mapper). */
const STAND = Math.floor(Date.parse("2026-09-12T09:15:00Z") / 1000);
const DATEINAME = "Wartungsnotiz.txt";
const ADRESSE = "https://contoso.sharepoint.test/sites/technik/Freigegeben/Wartungsnotiz.txt";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Eva", email: "e@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = async () => [];
  return {
    endpoints: {
      ko: {
        get: async () => globalThis.__job4360Ko,
        list: async () => [globalThis.__job4360Ko],
        evidence: leer,
        versions: leer,
        neighbors: async () => ({ center: "ko-1", neighbors: [], excludedTags: [], limit: 8 }),
        act: async () => globalThis.__job4360Ko,
      },
      library: { search: async () => [globalThis.__job4360Ko] },
      conflicts: { list: leer },
      duplicateSignal: { list: leer },
      audit: { list: leer },
      directory: { list: async () => [{ id: "u1", name: "Eva" }] },
      lifecycle: { pending: leer, linked: leer, couplingsFor: leer },
      external: { policy: async () => ({ stage: "blocked", enabled: false }) },
      uploadLimits: { get: async () => ({ maxAttachments: 8, maxAttachmentBytes: 20000000 }) },
      reasoner: {
        status: async () => ({ active: false, mode: "off" }),
        config: async () => ({}),
        assist: async () => ({ text: "" }),
        assistPresets: leer,
        extract: async () => ({ points: [], note: null }),
        describeImage: async () => ({}),
      },
      aiCheck: { coverageSummary: async () => ({ total: 0 }) },
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
import type { KnowledgeObject, KoSource } from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";

declare global {
  // Der Bestand reist über den globalen Namensraum: `vi.mock` wird hochgezogen und darf nichts aus
  // dem Modulrumpf schliessen (dieselbe Bauform wie JOB 3430).
  // eslint-disable-next-line no-var
  var __job4360Ko: KnowledgeObject;
}

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

/** Die drei Sprachen, die das Haus pflegt — und in denen die Beschriftung stehen muss. */
const SPRACHEN = ["de", "en", "nl"] as const;

/** Die Beschriftung, wie sie WIRKLICH im Katalog steht. Nicht abgeschrieben. */
function beschriftung(sprache: string): string {
  return i18n.getFixedT(sprache)("w2.source.version");
}

function quelle(overrides: Partial<KoSource> = {}): KoSource {
  return {
    id: "q-1",
    label: DATEINAME,
    url: ADRESSE,
    excerpt: null,
    kind: "external",
    peerValidated: false,
    provider: "SharePoint",
    objectId: "obj-1",
    author: "u1",
    at: "2026-09-12T09:20:00.000Z",
    ...overrides,
  } as KoSource;
}

function ko(sources: KoSource[]): KnowledgeObject {
  return {
    id: "ko-1",
    title: DATEINAME,
    statement: "Die Abfüllanlage wird nach jeder Schicht gewartet.",
    bodyHtml: "<p>Zeile eins aus der Datei.</p>",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Produktion",
    tags: [],
    confidence: 80,
    trust: 80,
    status: "offen",
    version: 1,
    author: "u1",
    originalAuthor: "u1",
    neededValidations: 2,
    assignments: [],
    asset: null,
    confidentiality: "intern",
    history: [],
    createdAt: "2026-09-12T09:20:00.000Z",
    comments: [],
    sources,
    attachments: [
      {
        id: "att-1",
        name: DATEINAME,
        mime: "text/plain",
        objectId: "obj-1",
        author: "u1",
        at: "2026-09-12T09:20:00.000Z",
      },
    ],
  } as KnowledgeObject;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/** Die Fläche aufbauen, „Mehr" öffnen, den Quellenabschnitt aufklappen — der Weg eines Menschen. */
async function flaeche(sources: KoSource[], sprache = "de"): Promise<void> {
  await i18n.changeLanguage(sprache);
  globalThis.__job4360Ko = ko(sources);
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: Number.POSITIVE_INFINITY,
        refetchOnWindowFocus: false,
      },
    },
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
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
                  { initialEntries: ["/wissen/ko-1"] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/wissen/:id",
                      element: createElement(KnowledgeDetail),
                    }),
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
  const mehr = container.querySelector<HTMLElement>('[data-testid="bib-mehr"]');
  if (!mehr) {
    throw new Error("JOB 4360: die Lesefläche bietet kein „Mehr“ an — der Aufbau steht nicht.");
  }
  await act(async () => {
    mehr.click();
    await flush();
  });
  const abschnitt = container.querySelector<HTMLDetailsElement>(
    `[data-bib-abschnitt="${QUELLEN}"]`,
  );
  if (!abschnitt) {
    throw new Error("JOB 4360: der Abschnitt „Quellen und Belege“ fehlt auf der Lesefläche.");
  }
  await act(async () => {
    abschnitt.open = true;
    // jsdom stellt `toggle` in die Warteschlange, statt es sofort zu liefern; es steigt nicht auf.
    abschnitt.dispatchEvent(new Event("toggle"));
    await flush();
  });
  await act(flush);
}

function abbauen(): void {
  act(() => root.unmount());
  container.remove();
}

/** Alle Stand-Knoten des Quellenabschnitts. LEER ist hier eine Aussage, kein Aufbaufehler. */
function staende(): HTMLElement[] {
  const abschnitt = container.querySelector(`[data-bib-abschnitt="${QUELLEN}"]`);
  return [...(abschnitt?.querySelectorAll<HTMLElement>(`[data-testid="${STAND_MARKE}"]`) ?? [])];
}

const text = (e: Element | null): string => (e?.textContent ?? "").replace(/\s+/g, " ").trim();

/**
 * Der Stand, der am Quelleneintrag MIT DIESER BESCHRIFTUNG steht.
 *
 * Gesucht wird über den Listeneintrag und nicht über die Reihenfolge der Treffer: eine vertauschte
 * Zuordnung („Stand der ersten Quelle an beiden") bliebe sonst unauffällig, und genau die ist der
 * Fehler, den dieser Weg ausschliessen soll (Runde 2, BENs Prüflücke 6). Der Eintrag wird an SEINEM
 * Text erkannt, nicht an einem Klassennamen — der ändert sich beim nächsten Umbau.
 */
function standAmEintrag(beschriftungDerQuelle: string): string {
  const abschnitt = container.querySelector(`[data-bib-abschnitt="${QUELLEN}"]`);
  const treffer = [...(abschnitt?.querySelectorAll("li") ?? [])].filter((li) =>
    text(li).includes(beschriftungDerQuelle),
  );
  if (treffer.length !== 1) {
    throw new Error(
      `JOB 4360: „${beschriftungDerQuelle}" steht ${treffer.length}-mal als Quelleneintrag, erwartet genau einmal.`,
    );
  }
  return text(treffer[0]?.querySelector(`[data-testid="${STAND_MARKE}"]`) ?? null);
}

/** Der Quellenabschnitt als ein Text — für die Zusagen, die daneben stehen bleiben müssen. */
function abschnittstext(): string {
  return text(container.querySelector(`[data-bib-abschnitt="${QUELLEN}"]`));
}

// ------------------------------------------------------------------------------------------------
// Q1 — DER KERN: der gespeicherte Stand steht da, mit der Beschriftung des Katalogs, in DE/EN/NL.
// ------------------------------------------------------------------------------------------------
describe("JOB 4360 · Q1 — der Quellstand steht am Wissensobjekt", () => {
  for (const sprache of SPRACHEN) {
    it(`„${sprache}": die Quelle mit gespeichertem Stand zeigt ihn samt Katalogbeschriftung`, async () => {
      await flaeche([quelle({ sourceVersion: STAND })], sprache);
      try {
        const gefunden = staende();
        expect(
          gefunden.length,
          `in „${sprache}" steht der Quellstand nicht genau einmal am Quellenabschnitt`,
        ).toBe(1);
        const gelesen = text(gefunden[0] ?? null);
        // DER WERT IST GENAU DER GESPEICHERTE — nicht gerundet, nicht in ein Datum verwandelt,
        // und keine Zahl, die ihn bloss ENTHÄLT. Runde 2, BENs Korrekturpflicht 1: seine Mutation
        // `String(sourceVersion) + "0"` hat die Teilzeichenkettenprüfung überlebt.
        expect(
          gelesen.replace(/\D+/g, ""),
          `in „${sprache}" steht nicht genau der gespeicherte Stand ${STAND} — gelesen: „${gelesen}"`,
        ).toBe(String(STAND));
        // UND DER GANZE SICHTBARE TEXT IST Beschriftung + Wert: eine nackte Zahl wäre ein Rätsel,
        // ein Wort ohne den richtigen Wert eine Behauptung, und ein Zusatz daneben eine dritte Sache.
        expect(
          gelesen,
          `in „${sprache}" lautet der Quellstand nicht „${beschriftung(sprache)} ${STAND}"`,
        ).toBe(`${beschriftung(sprache)} ${STAND}`);
      } finally {
        abbauen();
      }
    });
  }
});

// ------------------------------------------------------------------------------------------------
// Q2 — FEHLEN HEISST FEHLEN. Und alles andere bleibt genau so stehen wie vorher.
// ------------------------------------------------------------------------------------------------
describe("JOB 4360 · Q2 — eine Quelle ohne gespeicherten Stand zeigt NICHTS", () => {
  it("kein Knoten, kein „—“, keine geratene 0/1 — Herkunft, Adresse, Zeit und Datei bleiben", async () => {
    await flaeche([quelle()]);
    try {
      expect(
        staende().length,
        "eine Quelle ohne gespeicherten Stand hat trotzdem einen Stand gezeigt",
      ).toBe(0);
      const ganz = abschnittstext();
      // Die naheliegenden Erfindungen, jede einzeln ausgeschlossen — mit der Beschriftung davor,
      // damit die Zusicherung nicht an einer zufälligen „1" im Dateinamen hängt.
      for (const erfindung of ["Version —", "Version 0", "Version 1", "Version unbekannt"]) {
        expect(ganz, `der Quellenabschnitt erfindet „${erfindung}"`).not.toContain(erfindung);
      }
      // ── UND DIE BESTEHENDEN ZUSAGEN VON 4095/4077 STEHEN UNVERÄNDERT DA. ──────────────────
      expect(ganz, "die Herkunft ist verschwunden").toContain("SharePoint");
      expect(ganz, "die Adresse ist verschwunden").toContain(ADRESSE);
      expect(
        container.querySelector('[data-testid="bib-quelle-zeit"]'),
        "die Aufnahmezeit ist verschwunden",
      ).not.toBeNull();
      expect(
        text(container.querySelector('[data-testid="bib-quelle-datei"]')),
        "der aufgelöste Dateiname ist verschwunden",
      ).toBe(DATEINAME);
    } finally {
      abbauen();
    }
  });
});

// ------------------------------------------------------------------------------------------------
// Q3 — VIER LÖCHER, VIERMAL NICHTS. Ein beschädigter Wert ist kein Stand.
// ------------------------------------------------------------------------------------------------
describe("JOB 4360 · Q3 — unbrauchbare Werte sind kein Quellstand", () => {
  for (const [name, wert] of [
    ["null als Zahl", 0],
    ["negativ", -3],
    ["Bruchzahl", 1.5],
    ["NaN", Number.NaN],
  ] as const) {
    it(`„${name}" (${String(wert)}) zeigt nichts statt einer Behauptung`, async () => {
      await flaeche([quelle({ sourceVersion: wert })]);
      try {
        expect(
          staende().map((e) => text(e)),
          `„${name}" wurde als Quellstand ausgegeben`,
        ).toEqual([]);
      } finally {
        abbauen();
      }
    });
  }
});

// ------------------------------------------------------------------------------------------------
// Q4 — ZWEI QUELLEN NEBENEINANDER: der Stand hängt an der RICHTIGEN.
// Ohne diesen Fall bliebe eine Fläche grün, die den Stand der einen Quelle an allen zeigt.
// ------------------------------------------------------------------------------------------------
describe("JOB 4360 · Q4 — der Stand hängt an seiner eigenen Quelle", () => {
  it("eine importierte und eine von Hand angelegte Quelle: genau ein Stand, an der importierten", async () => {
    const importiert = quelle({ id: "q-import", label: DATEINAME, sourceVersion: STAND });
    // Die Handquelle wird AUSGESCHRIEBEN und nicht aus `quelle()` abgeleitet: `exactOptionalProperty
    // Types` verbietet ein ausdrückliches `undefined`, und genau darum geht es hier — die Felder
    // fehlen, sie stehen nicht auf „nichts".
    const vonHand: KoSource = {
      id: "q-hand",
      label: "Handbuch, Seite 12",
      url: null,
      excerpt: null,
      kind: "external",
      peerValidated: false,
      provider: null,
      author: "u1",
      at: "2026-09-12T09:20:00.000Z",
    };
    await flaeche([importiert, vonHand]);
    try {
      const gefunden = staende();
      expect(gefunden.length, "der Stand steht nicht genau einmal im Abschnitt").toBe(1);
      expect(text(gefunden[0] ?? null)).toBe(`${beschriftung("de")} ${STAND}`);
      // Der Träger ist der Listeneintrag der IMPORTIERTEN Quelle — erkennbar an ihrer Beschriftung.
      const eintrag = gefunden[0]?.closest("li");
      expect(text(eintrag ?? null), "der Stand hängt am falschen Listeneintrag").toContain(
        DATEINAME,
      );
      expect(text(eintrag ?? null), "der Stand hängt an der Handquelle").not.toContain(
        "Handbuch, Seite 12",
      );
    } finally {
      abbauen();
    }
  });

  // ----------------------------------------------------------------------------------------------
  // RUNDE 2 · BENs PRÜFLÜCKE 6 — ZWEI QUELLEN MIT VERSCHIEDENEN STÄNDEN.
  // ----------------------------------------------------------------------------------------------
  //
  // Q4 oben schliesst „ein Stand an allen Quellen" nur aus, weil die zweite Quelle GAR KEINEN trägt.
  // Trügen beide einen, bliebe eine Fläche grün, die den Stand der ERSTEN Quelle an beiden zeigt
  // (ein gehobener Wert, eine falsche Schleifenvariable — der übliche Fehler). Dieser Fall stellt
  // genau das: zwei Quellen, zwei verschiedene gespeicherte Stände, und JEDER muss an SEINEM
  // Listeneintrag stehen. Die Zuordnung wird über den Listeneintrag geprüft, nicht über die
  // Reihenfolge der Treffer — eine vertauschte Reihenfolge wäre sonst unauffällig.
  it("zwei Quellen mit verschiedenen Ständen: jeder Stand steht an seiner eigenen Quelle", async () => {
    const ALT = STAND;
    const NEU = STAND + 604800; // eine Woche später, damit sich die Ziffernfolgen klar unterscheiden
    const erste = quelle({ id: "q-a", label: "Wartungsnotiz-A.txt", sourceVersion: ALT });
    const zweite = quelle({ id: "q-b", label: "Wartungsnotiz-B.txt", sourceVersion: NEU });
    await flaeche([erste, zweite]);
    try {
      expect(staende().length, "es stehen nicht genau zwei Stände im Abschnitt").toBe(2);
      expect(
        { a: standAmEintrag("Wartungsnotiz-A.txt"), b: standAmEintrag("Wartungsnotiz-B.txt") },
        "die Stände hängen nicht an ihren eigenen Quellen",
      ).toEqual({
        a: `${beschriftung("de")} ${ALT}`,
        b: `${beschriftung("de")} ${NEU}`,
      });
    } finally {
      abbauen();
    }
  });
});
