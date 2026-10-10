// @vitest-environment jsdom
// ================================================================================================
// Aufnahme 20260922 · import-gesamtvertrag (R-0179, FR-EXT-01) — DIE BEFUNDÜBERSICHT DES IMPORTS.
// ================================================================================================
//
// FR-EXT-01: „Screen zeigt Pipeline, Beispiel-Importe und Ergebnis-Befunde (Kandidaten/Konflikte/
// fehlend/veraltet/Dubletten/IP)". Geprüft wird zweierlei:
//   1. die reine Zählung `importFindingsOverview` — je Art TREFFER und NICHT BEWERTET getrennt
//      (Nacharbeit 3, Bens Befunde: ein Nullbefund ist nur unter bewerteten Kandidaten einer), und
//      ein nicht lesbares Signal ist „nicht ermittelt", nie 0;
//   2. die montierte Zeile `ImportFindingsOverview` an echten Hooks mit gestellten Endpunkten.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Conflict, ImportCandidate, ImportKandidatBefund } from "../../apps/web/src/api/types";
import { IMPORT_FINDING_KINDS, importFindingsOverview } from "../../apps/web/src/lib/extConcept";
import importbefunde from "../../apps/web/src/texte/importbefunde";
import { repoPfad } from "../support/repoPfad";

const netz = vi.hoisted(() => ({
  konflikte: [] as unknown[],
  konflikteScheitern: false,
  erneut: [] as string[],
  befunde: [] as unknown[],
  befundeScheitern: false,
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    conflicts: {
      list: vi.fn(async () => {
        if (netz.konflikteScheitern) {
          throw new Error("kein Netz in diesem Prüfstand");
        }
        return netz.konflikte;
      }),
    },
    lifecycle: { pending: vi.fn(async () => netz.erneut) },
    library: {
      importCandidates: {
        befunde: vi.fn(async () => {
          if (netz.befundeScheitern) {
            throw new Error("kein Netz in diesem Prüfstand");
          }
          return netz.befunde;
        }),
      },
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { ImportFindingsOverview } from "../../apps/web/src/components/ImportFindingsOverview";
import "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function kandidat(over: Partial<ImportCandidate> = {}): ImportCandidate {
  return {
    id: "c",
    item: { title: "T", statement: "S", type: "best_practice", category: "Anlage 1" },
    status: "neu",
    duplicate: false,
    note: null,
    koId: null,
    createdAt: "2026-10-08T00:00:00.000Z",
    ...over,
  };
}

function konflikt(koA: string, koB: string, status: Conflict["status"] = "offen"): Conflict {
  return {
    id: `x-${koA}-${koB}`,
    koA,
    koB,
    type: "truth",
    description: "",
    status,
    secondOpinion: null,
    decidedBy: null,
    decision: null,
    createdAt: "2026-10-08T00:00:00.000Z",
  };
}

const NICHT_BEWERTET = { bewertet: false } as const;

function befund(
  id: string,
  schutz: ImportKandidatBefund["schutz"],
  veraltet: ImportKandidatBefund["veraltet"],
): ImportKandidatBefund {
  return { id, schutz, veraltet };
}

const ohneSchutz: ImportKandidatBefund["schutz"] = {
  bewertet: true,
  gruende: [],
  schutzdaten: [],
};
const alt: ImportKandidatBefund["veraltet"] = {
  bewertet: true,
  veraltet: true,
  stand: "2020-01-01T00:00:00Z",
};
const frisch: ImportKandidatBefund["veraltet"] = {
  bewertet: true,
  veraltet: false,
  stand: "2026-10-01T00:00:00Z",
};

/** Ein Bestand, in dem jede Befundart mindestens einmal und unterscheidbar oft vorkommt. */
const BESTAND: ImportCandidate[] = [
  kandidat({ id: "a", status: "angenommen", koId: "ko-a" }),
  kandidat({ id: "b", status: "angenommen", koId: "ko-b" }),
  kandidat({ id: "c", status: "angenommen", koId: "ko-c" }),
  kandidat({ id: "d", duplicate: true }),
  kandidat({
    id: "e",
    item: { title: "", statement: "S", type: "best_practice", category: "" },
    dublettenbefund: { ergebnis: "pruefung_nicht_moeglich" },
  }),
  kandidat({
    id: "f",
    item: {
      title: "T",
      statement: "S",
      type: "best_practice",
      category: "Anlage 1",
      confidentiality: "streng_vertraulich",
    },
  }),
  kandidat({ id: "g" }),
  kandidat({ id: "h" }),
];

/** Die Serverbefunde zu BESTAND: g trägt eine Schutzkennzeichnung, h ist bewertet ohne Treffer. */
const SERVERBEFUNDE: ImportKandidatBefund[] = [
  befund("a", ohneSchutz, NICHT_BEWERTET),
  befund("b", ohneSchutz, NICHT_BEWERTET),
  befund("c", ohneSchutz, frisch),
  befund("d", ohneSchutz, alt),
  befund("e", NICHT_BEWERTET, NICHT_BEWERTET),
  befund("f", { bewertet: true, gruende: ["einstufung"], schutzdaten: [] }, frisch),
  befund("g", { bewertet: true, gruende: ["kennzeichnung"], schutzdaten: [] }, alt),
  befund("h", ohneSchutz, frisch),
];

describe("importFindingsOverview — Treffer und „nicht bewertet“ getrennt", () => {
  it("nennt genau die sechs Arten aus FR-EXT-01, in dieser Reihenfolge", () => {
    expect([...IMPORT_FINDING_KINDS]).toEqual([
      "candidates",
      "conflicts",
      "missing",
      "outdated",
      "duplicates",
      "protected",
    ]);
  });

  it("zählt jede Art an ihrer Quelle", () => {
    const zaehlung = importFindingsOverview(BESTAND, {
      // ko-a in offenem, ko-b nur in gelöstem Widerspruch; ko-x gehört keinem Kandidaten.
      conflicts: [konflikt("ko-a", "ko-x"), konflikt("ko-b", "ko-x", "geloest")],
      pendingIds: ["ko-b", "ko-fremd"],
      befunde: SERVERBEFUNDE,
    });
    expect(zaehlung).toEqual({
      candidates: { found: 8, notAssessed: 0 },
      // Nur a, b, c sind übernommen; fünf Kandidaten sind auf Widersprüche nicht bewertbar.
      conflicts: { found: 1, notAssessed: 5 },
      missing: { found: 1, notAssessed: 0 },
      // Treffer: b (erneut prüfen), d und g (Quellstand alt). a hat keinen Stand, ist aber
      // übernommen und das Prüfsignal gelesen — bewertet ohne Treffer. Nicht bewertet bleibt e.
      outdated: { found: 3, notAssessed: 1 },
      duplicates: { found: 1, notAssessed: 1 },
      // f (Einstufung) und g (Kennzeichnung); e ist ohne Text nicht bewertet.
      protected: { found: 2, notAssessed: 1 },
    });
  });

  it("veraltet: ein neuer Kandidat mit altem Quellstand ist ein Treffer, ohne Stand nicht bewertet", () => {
    const neu = kandidat({ id: "n" });
    const mitAltemStand = importFindingsOverview([neu], {
      befunde: [befund("n", ohneSchutz, alt)],
    });
    const ohneStand = importFindingsOverview([neu], {
      befunde: [befund("n", ohneSchutz, NICHT_BEWERTET)],
    });
    expect(mitAltemStand.outdated).toEqual({ found: 1, notAssessed: 0 });
    expect(ohneStand.outdated).toEqual({ found: 0, notAssessed: 1 });
  });

  it("schützenswert: ohne Servererkennung ist ein unmarkierter Kandidat nicht bewertet, nicht 0", () => {
    const zaehlung = importFindingsOverview(BESTAND);
    // Allein die Einstufung von f ist ohne Servererkennung eine belegte Aussage.
    expect(zaehlung.protected).toEqual({ found: 1, notAssessed: 7 });
    expect(zaehlung.outdated).toEqual({ found: 0, notAssessed: 8 });
    expect(zaehlung.conflicts.found).toBeNull();
  });

  it("schützenswert: bewertet ohne Grund ist ein geprüfter Nullbefund", () => {
    const zaehlung = importFindingsOverview([kandidat({ id: "h" })], {
      befunde: [befund("h", ohneSchutz, frisch)],
    });
    expect(zaehlung.protected).toEqual({ found: 0, notAssessed: 0 });
  });
});

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
  }
  container?.remove();
  container = null;
  root = null;
});

async function montiere(kandidaten: readonly ImportCandidate[]): Promise<HTMLDivElement> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ziel = document.createElement("div");
  document.body.appendChild(ziel);
  container = ziel;
  root = createRoot(ziel);
  await act(async () => {
    root?.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(ImportFindingsOverview, { candidates: kandidaten }),
      ),
    );
  });
  // Alle Abfragen abschließen lassen (Erfolg oder Fehler).
  for (let i = 0; i < 20 && (client.isFetching() > 0 || i < 2); i += 1) {
    await act(async () => {
      await new Promise((fertig) => setTimeout(fertig, 0));
    });
  }
  return ziel;
}

function wert(ziel: HTMLElement, art: string): string | undefined {
  return ziel.querySelector(`[data-befund="${art}"]`)?.textContent ?? undefined;
}

describe("ImportFindingsOverview — montiert an den echten Hooks", () => {
  it("zeigt alle sechs Arten mit Treffern und „nicht bewertet“", async () => {
    netz.konflikteScheitern = false;
    netz.befundeScheitern = false;
    netz.konflikte = [konflikt("ko-a", "ko-x")];
    netz.erneut = ["ko-b"];
    netz.befunde = SERVERBEFUNDE;
    const ziel = await montiere(BESTAND);
    expect(ziel.querySelector('[data-testid="import-befunde"]')?.textContent).toContain("Befunde");
    expect(wert(ziel, "candidates")).toBe("Kandidaten:8");
    expect(wert(ziel, "conflicts")).toBe("Widersprüche:1 · 5 nicht bewertet");
    expect(wert(ziel, "missing")).toBe("Angaben fehlen:1");
    expect(wert(ziel, "outdated")).toBe("Veraltet:3 · 1 nicht bewertet");
    expect(wert(ziel, "duplicates")).toBe("Dubletten:1 · 1 nicht bewertet");
    expect(wert(ziel, "protected")).toBe("Schützenswert:2 · 1 nicht bewertet");
  });

  it("gescheiterte Abrufe: Konflikte „nicht ermittelt“, Schutz und Veraltung „nicht bewertet“", async () => {
    netz.konflikteScheitern = true;
    netz.befundeScheitern = true;
    netz.erneut = [];
    const ziel = await montiere(BESTAND);
    expect(wert(ziel, "conflicts")).toBe("Widersprüche:nicht ermittelt");
    expect(ziel.querySelector('[data-befund="conflicts"]')?.getAttribute("data-wert")).toBe(
      "offen",
    );
    // Ohne Serverbefunde: nur f ist durch seine Einstufung belegt; sieben sind nicht bewertet.
    expect(wert(ziel, "protected")).toBe("Schützenswert:1 · 7 nicht bewertet");
    // Ohne Quellstand bleiben nur die drei übernommenen über die Prüfanforderung bewertet.
    expect(wert(ziel, "outdated")).toBe("Veraltet:0 · 5 nicht bewertet");
  });
});

describe("Verdrahtung auf der Import-Seite", () => {
  it("Stufe2.tsx hängt die Befundzeile unter die Pipeline-Schritte", () => {
    const quelle = readFileSync(repoPfad("apps/web/src/pages/Stufe2.tsx"), "utf8");
    const pipeline = quelle.indexOf('t("ext.pipeline.title")');
    const befunde = quelle.indexOf("<ImportFindingsOverview candidates={query.data} />");
    expect(pipeline).toBeGreaterThan(0);
    expect(befunde).toBeGreaterThan(pipeline);
  });

  it("alle neuen Texte stehen in DE, EN und NL", () => {
    const schluessel = [
      "importbefunde.title",
      "importbefunde.notDetermined",
      "importbefunde.notAssessed",
      "importbefunde.hint",
      ...IMPORT_FINDING_KINDS.map((art) => `importbefunde.${art}`),
    ];
    for (const sprache of ["de", "en", "nl"] as const) {
      const texte: Record<string, string> = importbefunde[sprache];
      for (const s of schluessel) {
        expect(texte[s]?.trim(), `${sprache}: ${s}`).toBeTruthy();
      }
      expect(Object.keys(texte).sort(), sprache).toEqual([...schluessel].sort());
    }
  });
});
