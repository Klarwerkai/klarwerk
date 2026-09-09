// @vitest-environment jsdom
// ================================================================================================
// JOB 3326 · LESEVARIANTE — DIE ADMIN-AKTION UND DIE KURZVORSCHAU.
// ================================================================================================
//
//   L  „Übersetzungen für Paket laden" im Beispielpaket-Bereich: ruft die Ladeaktion, zeigt die
//      ehrliche Bilanz und BENENNT die Datensätze ohne Wissensobjekt (statt sie zu verschweigen).
//   V  Die Kurzvorschau (`KoSummaryDisclosure`) zeigt in der übersetzten Sprache die deutsche
//      Kernaussage MIT Kennzeichnung — und ohne Variante unverändert das Original.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  ladeRufe: [] as string[],
  /** Die Bilanz, die der Server zurückgibt. */
  bilanz: {} as Record<string, unknown>,
  varianten: [] as Record<string, unknown>[],
  /**
   * JOB 3326 R3: Wird sie gesetzt, antwortet die Übersicht NICHT sofort — der Test hält jede
   * Anfrage an und löst sie in der Reihenfolge auf, die er beweisen will. Nur so ist die
   * verspätete Antwort einer ÜBERHOLTEN Anfrage überhaupt nachstellbar.
   */
  haltAn: null as
    | null
    | ((lang: string, aufloesen: (eintraege: Record<string, unknown>[]) => void) => void),
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    admin: {
      import: {
        loadExamples: vi.fn(async () => ({ package: "konflikte", created: 0, skipped: 0 })),
        loadLesevarianten: vi.fn(async (pkg: string) => {
          box.ladeRufe.push(pkg);
          return box.bilanz;
        }),
      },
    },
    lesevarianten: {
      uebersicht: vi.fn(async (lang: string) => {
        if (box.haltAn) {
          const halten = box.haltAn;
          return new Promise<{ lang: string; eintraege: Record<string, unknown>[] }>((fertig) => {
            halten(lang, (eintraege) => fertig({ lang, eintraege }));
          });
        }
        return { lang, eintraege: lang === "de" ? box.varianten : [] };
      }),
      fuerKo: vi.fn(async () => {
        throw new Error("in diesem Test nicht benutzt");
      }),
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { ExamplePackages } from "../../apps/web/src/components/ExamplePackages";
import { KoSummaryDisclosure } from "../../apps/web/src/components/KoSummaryDisclosure";
import i18n from "../../apps/web/src/i18n";
import { lesevariantenVerwerfen } from "../../apps/web/src/lib/lesevariante";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(element: JSX.Element): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(createElement(QueryClientProvider, { client: qc }, element));
    await flush();
  });
  await act(flush);
}

function text(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

function knopf(teil: string): HTMLButtonElement {
  const treffer = [...container.querySelectorAll("button")].filter((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(teil),
  ) as HTMLButtonElement[];
  const erster = treffer[0];
  if (!erster) {
    throw new Error(`Knopf „${teil}" nicht gefunden`);
  }
  return erster;
}

beforeEach(async () => {
  box.ladeRufe = [];
  box.bilanz = {
    paket: "advisor-ict-en-v1",
    records: 43,
    sprachen: ["de"],
    // JOB 3326 R2: die Bilanz der ECHTEN Lage — 36 Datensätze mit Objekt, aber 42 Objekte, weil
    // die sechs Grundlagen-Bausteine ZUSÄTZLICH zu ihrer Confluence-Kopie bedient werden.
    zugeordnet: 36,
    objekte: 42,
    ueberConfluence: 36,
    ueberPaketschluessel: 6,
    neu: 42,
    aktualisiert: 0,
    textGeaendert: [],
    nichtZugeordnet: ["WORD-COMPARE"],
    originalGeaendert: [],
    quellabgleichBestaetigt: 6,
    quellabgleichUnbestaetigt: 36,
    ohneText: [],
  };
  box.varianten = [];
  box.haltAn = null;
  lesevariantenVerwerfen();
  await act(async () => {
    await i18n.changeLanguage("de");
  });
});

afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  await act(async () => {
    await i18n.changeLanguage("de");
  });
});

describe('JOB 3326 · L · die Admin-Aktion „Übersetzungen für Paket laden"', () => {
  it("L1 · der Knopf steht im Beispielpaket-Bereich und ruft genau das Advisor-Paket", async () => {
    await mount(createElement(ExamplePackages));
    expect(container.querySelector('[data-testid="lesevarianten-laden"]')).not.toBeNull();
    await act(async () => {
      knopf("Übersetzungen laden").click();
      await flush();
    });
    expect(box.ladeRufe).toEqual(["advisor-ict-en-v1"]);
  });

  it("L2 · die Bilanz wird ehrlich gezeigt und die nicht zugeordneten Datensätze BENANNT", async () => {
    await mount(createElement(ExamplePackages));
    await act(async () => {
      knopf("Übersetzungen laden").click();
      await flush();
    });
    const bilanz = container.querySelector('[data-testid="lesevarianten-bilanz"]')?.textContent;
    // DATENSÄTZE und OBJEKTE stehen beide da — eine Zahl allein könnte die Lage nicht sagen.
    expect(bilanz).toContain("36 Datensätze");
    expect(bilanz).toContain("42 Objekte");
    // Und der fehlende Quellbeleg wird BEZIFFERT, nicht verschwiegen.
    expect(bilanz).toContain("36 ohne Quellbeleg");
    const offen = container.querySelector('[data-testid="lesevarianten-offen"]');
    expect(offen?.textContent).toContain("WORD-COMPARE");
  });

  it("L3 · sind alle Datensätze zugeordnet, steht keine Restzeile da (nichts wird erfunden)", async () => {
    box.bilanz = { ...box.bilanz, zugeordnet: 43, neu: 43, nichtZugeordnet: [] };
    await mount(createElement(ExamplePackages));
    await act(async () => {
      knopf("Übersetzungen laden").click();
      await flush();
    });
    expect(container.querySelector('[data-testid="lesevarianten-offen"]')).toBeNull();
  });

  it("L4 · der Hinweis sagt ausdrücklich, dass kein Wissensobjekt entsteht und kein Modell läuft", async () => {
    await mount(createElement(ExamplePackages));
    expect(text()).toContain("Es entsteht kein neues Wissensobjekt, es wird kein Modell gerufen");
  });
});

describe("JOB 3326 · V · die Kurzvorschau", () => {
  const KO = {
    id: "ko-1",
    statement: "Harbor Field Services is a fictional customer with 25 office users.",
  };

  it("V1 · mit Variante: deutsche Kernaussage MIT Kennzeichnung", async () => {
    box.varianten = [
      {
        koId: "ko-1",
        lang: "de",
        originalLanguage: "en",
        title: "Kundenprofil: Harbor Field Services",
        statement: "Harbor Field Services ist ein fiktiver Kunde mit 25 Büronutzern.",
        herkunft: "lokale Lieferung advisor-ict-en-v1",
        status: "draft_translation_not_business_approval",
        originalGeaendert: false,
        quellabgleich: "bestaetigt",
        updatedAt: "2026-09-08T12:00:00.000Z",
      },
    ];
    await mount(createElement(KoSummaryDisclosure, { source: KO, defaultOpen: true }));
    expect(text()).toContain("Harbor Field Services ist ein fiktiver Kunde");
    expect(text()).not.toContain("is a fictional customer");
    expect(
      container.querySelector('[data-testid="ko-preview-uebersetzung"]')?.textContent,
    ).toContain("Übersetzung · Original: Englisch");
  });

  it("V2 · ohne Variante: unverändert das Original, KEINE Kennzeichnung", async () => {
    await mount(createElement(KoSummaryDisclosure, { source: KO, defaultOpen: true }));
    expect(text()).toContain("is a fictional customer");
    expect(container.querySelector('[data-testid="ko-preview-uebersetzung"]')).toBeNull();
  });

  it("V3 · ein Aufrufer ohne Wissensobjekt-Kennung (Import-Kandidat) bleibt unverändert", async () => {
    box.varianten = [
      {
        koId: "ko-1",
        lang: "de",
        originalLanguage: "en",
        title: "Kundenprofil: Harbor Field Services",
        statement: "Harbor Field Services ist ein fiktiver Kunde mit 25 Büronutzern.",
        herkunft: "lokale Lieferung advisor-ict-en-v1",
        status: "draft_translation_not_business_approval",
        originalGeaendert: false,
        quellabgleich: "bestaetigt",
        updatedAt: "2026-09-08T12:00:00.000Z",
      },
    ];
    await mount(
      createElement(KoSummaryDisclosure, {
        source: { statement: "Ein Import-Kandidat ohne KO-Kennung." },
        defaultOpen: true,
      }),
    );
    expect(text()).toContain("Ein Import-Kandidat ohne KO-Kennung.");
    expect(container.querySelector('[data-testid="ko-preview-uebersetzung"]')).toBeNull();
  });

  it("V4 · ein durchgereichter Volltext (Import-Review) bleibt der echte Wortlaut", async () => {
    box.varianten = [
      {
        koId: "ko-1",
        lang: "de",
        originalLanguage: "en",
        title: "Kundenprofil: Harbor Field Services",
        statement: "Harbor Field Services ist ein fiktiver Kunde mit 25 Büronutzern.",
        herkunft: "lokale Lieferung advisor-ict-en-v1",
        status: "draft_translation_not_business_approval",
        originalGeaendert: false,
        quellabgleich: "bestaetigt",
        updatedAt: "2026-09-08T12:00:00.000Z",
      },
    ];
    await mount(
      createElement(KoSummaryDisclosure, {
        source: KO,
        text: "Der wörtliche Volltext aus dem Import.",
        defaultOpen: true,
      }),
    );
    expect(text()).toContain("Der wörtliche Volltext aus dem Import.");
    expect(container.querySelector('[data-testid="ko-preview-uebersetzung"]')).toBeNull();
  });
});

// ================================================================================================
// JOB 3326 R3 (Codex 300d1c3a, Punkt 3) — DIE VERSPÄTETE ANTWORT EINER ÜBERHOLTEN ANFRAGE.
// ================================================================================================
//
// Der Vorrat prüfte bis Runde 2 nur `stand.lang`. Bei DE(A) → EN → DE(B) steht am Ende wieder
// „de", also bestand die verspätete Antwort A diese Prüfung und überschrieb den frischen Stand B.
// Die Oberfläche zeigte dann — je nach Reihenfolge der Antworten — den Text aus dem ERSTEN Klick.
//
// GEMESSEN WIRD MIT ECHTEN VERZÖGERTEN ANTWORTEN, nicht mit einem Spion auf die Aufrufe: der Test
// hält jede Anfrage an und löst B ZUERST, A ZULETZT auf. Zwischen den Sprachwechseln wird der
// Vorrat AUSDRÜCKLICH NICHT zurückgesetzt.
describe("JOB 3326 R3 · der Vorrat gehört der letzten Anfrage", () => {
  function anhalten() {
    const offen: { lang: string; aufloesen: (e: Record<string, unknown>[]) => void }[] = [];
    box.haltAn = (lang, aufloesen) => {
      offen.push({ lang, aufloesen });
    };
    return offen;
  }

  function variante(statement: string): Record<string, unknown> {
    return {
      koId: "ko-1",
      lang: "de",
      originalLanguage: "en",
      title: "Kundenprofil",
      statement,
      herkunft: "lokale Lieferung advisor-ict-en-v1",
      status: "draft_translation_not_business_approval",
      originalGeaendert: false,
      quellabgleich: "bestaetigt",
      updatedAt: "2026-09-08T12:00:00.000Z",
    };
  }

  it("G1 · DE(A) → EN → DE(B): die verspätete Antwort A überschreibt den Stand B NICHT", async () => {
    const offen = anhalten();
    await mount(
      createElement(KoSummaryDisclosure, {
        source: { id: "ko-1", statement: "Original statement." },
        defaultOpen: true,
      }),
    );
    // A läuft (de). Jetzt auf EN und wieder zurück auf DE — ohne den Vorrat zu verwerfen.
    await act(async () => {
      await i18n.changeLanguage("en");
      await flush();
    });
    await act(async () => {
      await i18n.changeLanguage("de");
      await flush();
    });
    const de = offen.filter((o) => o.lang === "de");
    expect(de.length, "es müssen ZWEI de-Anfragen offen sein (A und B)").toBe(2);

    // B zuerst — das ist der Stand, den der Leser sehen muss.
    await act(async () => {
      de[1]?.aufloesen([variante("NEUER Stand aus Anfrage B.")]);
      await flush();
    });
    expect(text()).toContain("NEUER Stand aus Anfrage B.");

    // Und jetzt trudelt A ein. Sie ist überholt und darf nichts mehr schreiben.
    await act(async () => {
      de[0]?.aufloesen([variante("ALTER Stand aus Anfrage A.")]);
      await flush();
    });
    expect(text(), "die überholte Antwort A hat den Stand B überschrieben").not.toContain(
      "ALTER Stand aus Anfrage A.",
    );
    expect(text()).toContain("NEUER Stand aus Anfrage B.");
  });

  it("G2 · KALIBRIERUNG: löst NUR A auf, zeigt die Fläche auch nichts Falsches (A bleibt überholt)", async () => {
    const offen = anhalten();
    await mount(
      createElement(KoSummaryDisclosure, {
        source: { id: "ko-1", statement: "Original statement." },
        defaultOpen: true,
      }),
    );
    await act(async () => {
      await i18n.changeLanguage("en");
      await flush();
    });
    await act(async () => {
      await i18n.changeLanguage("de");
      await flush();
    });
    const de = offen.filter((o) => o.lang === "de");
    await act(async () => {
      de[0]?.aufloesen([variante("ALTER Stand aus Anfrage A.")]);
      await flush();
    });
    // Ohne die Anfragegeneration stünde hier der Text von A. Mit ihr steht das Original da —
    // ehrlich „noch nichts geladen" statt einer überholten Übersetzung.
    expect(text()).not.toContain("ALTER Stand aus Anfrage A.");
    expect(text()).toContain("Original statement.");
  });

  it("G3 · das Verwerfen nimmt laufenden Antworten das Schreibrecht", async () => {
    const offen = anhalten();
    await mount(
      createElement(KoSummaryDisclosure, {
        source: { id: "ko-1", statement: "Original statement." },
        defaultOpen: true,
      }),
    );
    expect(offen.length).toBe(1);
    // Der Admin lädt Übersetzungen — der Vorrat wird verworfen, WÄHREND die Anfrage läuft.
    act(() => {
      lesevariantenVerwerfen();
    });
    await act(async () => {
      offen[0]?.aufloesen([variante("Antwort zu einem verworfenen Vorrat.")]);
      await flush();
    });
    expect(text()).not.toContain("Antwort zu einem verworfenen Vorrat.");
  });
});
