import { expect, it } from "vitest";
import { workflowWissensquelle } from "../../apps/web/src/lib/workflowWissensquelle";

const lauf = "a".repeat(64);
const ergebnis = `routine-${lauf}-2`;
const bezug = { workflowId: "einkauf", laufId: lauf, ergebnisId: ergebnis };
const vorgang = `/teamworkflows?workflow=einkauf&lauf=${lauf}&ergebnis=${ergebnis}`;
const quelle = {
  provider: "Klarwerk",
  sourceVersion: 3,
  externalId: "artikel",
  workflowQuellart: "wissensfassung" as const,
  url: null,
};
const ergebnisquelle = {
  ...quelle,
  workflowQuellart: "ergebnis" as const,
  workflowBezug: bezug,
  externalId: ergebnis,
};

it("öffnet die gespeicherte Quellfassung und das zugehörige Workflow-Ergebnis", () => {
  expect(workflowWissensquelle(quelle)).toEqual({
    typ: "quelle",
    href: "/wissen/artikel?fassung=3&ansicht=gespeichert",
  });
  expect(workflowWissensquelle(ergebnisquelle)).toEqual({
    typ: "ergebnis",
    href: vorgang,
  });
});

it("macht nur übereinstimmende, vorhandene Klarwerk-Belege zu internen Links", () => {
  for (const z of [
    { ...quelle, externalId: "../admin" },
    { ...quelle, provider: "Fremdsystem" },
    { ...quelle, sourceRemovedAt: "2026-11-25T19:00:00Z" },
    { ...quelle, sourceVersion: 0 },
    { provider: "Klarwerk", sourceVersion: 3, externalId: "artikel", url: null },
    { ...quelle, workflowBezug: bezug },
    { ...quelle, url: "/admin" },
    { ...quelle, url: "//example.invalid/wissen/artikel?fassung=3" },
    { ...ergebnisquelle, url: `${vorgang}&weiter=/admin` },
    { ...ergebnisquelle, externalId: "anderer-lauf" },
    { ...ergebnisquelle, workflowBezug: { ...bezug, laufId: "b".repeat(64) } },
    { ...ergebnisquelle, workflowBezug: { ...bezug, workflowId: "../admin" } },
  ])
    expect(workflowWissensquelle(z)).toBeNull();
});
