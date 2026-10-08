// @vitest-environment jsdom
// ================================================================================================
// Aufnahme 20260922 · import-gesamtvertrag (R-0179, FR-EXT-01) — DIE BEFUNDÜBERSICHT DES IMPORTS.
// ================================================================================================
//
// FR-EXT-01: „Screen zeigt Pipeline, Beispiel-Importe und Ergebnis-Befunde (Kandidaten/Konflikte/
// fehlend/veraltet/Dubletten/IP)". Geprüft wird zweierlei:
//   1. die reine Zählung `importFindingsOverview` — je Art aus genau EINER vorhandenen Quelle, und
//      ein nicht lesbares Signal ist `null` („nicht ermittelt"), nie 0;
//   2. die montierte Zeile `ImportFindingsOverview` an echten Hooks mit gestellten Endpunkten —
//      sechs Arten sichtbar, ein gescheiterter Endpunkt erscheint als „nicht ermittelt".
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Conflict, ImportCandidate } from "../../apps/web/src/api/types";
import { IMPORT_FINDING_KINDS, importFindingsOverview } from "../../apps/web/src/lib/extConcept";
import importbefunde from "../../apps/web/src/texte/importbefunde";
import { repoPfad } from "../support/repoPfad";

const netz = vi.hoisted(() => ({
  konflikte: [] as unknown[],
  konflikteScheitern: false,
  erneut: [] as string[],
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

/** Ein Bestand, in dem jede Befundart mindestens einmal und unterscheidbar oft vorkommt. */
const BESTAND: ImportCandidate[] = [
  kandidat({ id: "a", status: "angenommen", koId: "ko-a" }),
  kandidat({ id: "b", status: "angenommen", koId: "ko-b" }),
  kandidat({ id: "c", status: "angenommen", koId: "ko-c" }),
  kandidat({ id: "d", duplicate: true }),
  kandidat({
    id: "e",
    item: { title: "", statement: "S", type: "best_practice", category: "" },
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
  kandidat({
    id: "g",
    item: {
      title: "T",
      statement: "S",
      type: "best_practice",
      category: "Anlage 1",
      confidentiality: "vertraulich",
    },
  }),
  kandidat({
    id: "h",
    item: {
      title: "T",
      statement: "S",
      type: "best_practice",
      category: "Anlage 1",
      confidentiality: "intern",
    },
  }),
];

describe("importFindingsOverview — sechs Arten aus vorhandenen Signalen", () => {
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
    const befunde = importFindingsOverview(BESTAND, {
      // ko-a in offenem, ko-b nur in gelöstem Widerspruch; ko-x gehört keinem Kandidaten.
      conflicts: [konflikt("ko-a", "ko-x"), konflikt("ko-b", "ko-x", "geloest")],
      pendingIds: ["ko-b", "ko-c", "ko-fremd"],
    });
    expect(befunde).toEqual({
      candidates: 8,
      conflicts: 1,
      missing: 1,
      outdated: 2,
      duplicates: 1,
      protected: 2,
    });
  });

  it("ein nicht gelesenes Signal ist „nicht ermittelt“ (null), nie 0", () => {
    const befunde = importFindingsOverview(BESTAND);
    expect(befunde.conflicts).toBeNull();
    expect(befunde.outdated).toBeNull();
    // Was die Prüfliste selbst trägt, bleibt gezählt.
    expect(befunde.candidates).toBe(8);
    expect(befunde.missing).toBe(1);
  });

  it("ohne Stufe ist ein Kandidat nicht schützenswert (Übernahme-Standard „intern“, N11)", () => {
    expect(importFindingsOverview([kandidat()]).protected).toBe(0);
  });

  it("ein nicht übernommener Kandidat trägt weder Widerspruch noch Veraltung", () => {
    const befunde = importFindingsOverview([kandidat({ koId: null })], {
      conflicts: [konflikt("ko-a", "ko-b")],
      pendingIds: ["ko-a"],
    });
    expect(befunde.conflicts).toBe(0);
    expect(befunde.outdated).toBe(0);
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
  // Beide Abfragen abschließen lassen (Erfolg oder Fehler).
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
  it("zeigt alle sechs Arten mit Zahl", async () => {
    netz.konflikteScheitern = false;
    netz.konflikte = [konflikt("ko-a", "ko-x")];
    netz.erneut = ["ko-c"];
    const ziel = await montiere(BESTAND);
    expect(ziel.querySelector('[data-testid="import-befunde"]')?.textContent).toContain("Befunde");
    expect(wert(ziel, "candidates")).toBe("Kandidaten:8");
    expect(wert(ziel, "conflicts")).toBe("Widersprüche:1");
    expect(wert(ziel, "missing")).toBe("Angaben fehlen:1");
    expect(wert(ziel, "outdated")).toBe("Veraltet:1");
    expect(wert(ziel, "duplicates")).toBe("Dubletten:1");
    expect(wert(ziel, "protected")).toBe("Schützenswert:2");
  });

  it("ein gescheiterter Konfliktabruf steht als „nicht ermittelt“ da, nicht als 0", async () => {
    netz.konflikteScheitern = true;
    netz.erneut = [];
    const ziel = await montiere(BESTAND);
    expect(wert(ziel, "conflicts")).toBe("Widersprüche:nicht ermittelt");
    expect(ziel.querySelector('[data-befund="conflicts"]')?.getAttribute("data-wert")).toBe(
      "offen",
    );
    expect(wert(ziel, "outdated")).toBe("Veraltet:0");
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
