// @vitest-environment jsdom
// ================================================================================================
// KI-WAHL-BETRIEBSABNAHME · N-0070 — DIE PALETTE AN DER EDITORLEISTE NENNT DEN AUSFÜHRER VOR DEM KLICK.
// ================================================================================================
//
// ORIGINALPUNKT (wörtlich): „Einen gut benannten Zugang zu KI, freier Anweisung und Vorlagen direkt
// an der Editorleiste anbieten; den jeweiligen Anbieter dort vor Ausführen anzeigen."
//
// GELIEFERT VOR DIESEM AUFTRAG (nicht wiederholt): der Zugang selbst — das Menü „KI" im Blatt mit
// Strukturieren, Werksaktionen, freier Anweisung und Vorlagen (JOB 3062/3584/3769; Chromium-Belege
// `tests/ki-freie-anweisung/ki-palette-390px-chromium.test.ts`, `tests/ki-palette-320/…`,
// `tests/ki-palette-fingertipp/…`). FEHLTE: die Anbieterangabe dort — jede andere KI-Fläche trägt
// sie über `AiModelInfo`, die Palette des Blattes nicht.
//
//   A1–A2 · die Ableitung `ausfuehrerWer`: Adminsicht nennt Stufe UND Anbieter/Modell je Aufgabe,
//           bei abweichender Zuordnung je Aufgabe getrennt.
//   A3    · Nacharbeit 5 (BEN): ohne Adminsicht gibt es keine aufgabenbezogene Auskunft — die Zeile
//           sagt „hier nicht bekannt" und gibt NIE die hausweite Stufe als Ausführer aus.
//   A3b   · GEGENPROBE zu BENs Fall: hausweit Cloud, `structure` lokal und `assist` regelbasiert
//           gestellt. Nicht-Admin: kein „Cloud-KI" im Satz. Admin: je Aufgabe die WAHRE Stufe.
//   A3c   · Admin, Auskunft noch nicht geladen: „wird ermittelt", nicht die hausweite Stufe.
//   A4    · der Satz rendert auch OHNE `RoleProvider` (das Blatt in seinen Einzeltests) — als
//           Nicht-Admin, ohne zu werfen, mit „hier nicht bekannt" trotz hausweit „cloud".
//   A5    · im Blatt steht er im Menü „KI", in der Fläche der freien Anweisung UNTER Eingabe und
//           Knopf (Nacharbeit 4: eine Zeile darüber schob die freie Eingabe am 390-px-Telefon
//           31,3 px unter den Rand, `ki-palette-390px-chromium.test.ts` B5a), für `structure` und
//           `assist`. Beim Öffnen der Palette steht er da — also vor jedem Ausführen.
//
// NACHARBEIT 4: als `.tsx`, damit die DOM-/JSX-Testkonfiguration (`tsconfig.tests-tsx.json`) gilt —
// als `.ts` lief die Datei unter der Node-reinen Wurzelkonfiguration ohne DOM und ohne JSX.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { ReasonerConfigStatus } from "../../apps/web/src/api/types";
import {
  AI_AUSFUEHRER_KEY,
  AiAusfuehrerZeile,
} from "../../apps/web/src/components/AiAusfuehrerZeile";
import i18n from "../../apps/web/src/i18n";
import { AUSFUEHRER_UNBEKANNT_KEY, ausfuehrerWer } from "../../apps/web/src/lib/aiAusfuehrer";
import { anbieterUndModell } from "../../apps/web/src/lib/aiOverview";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DE = (k: string): string => i18n.t(k, { lng: "de" });
const ANTHROPIC = "anthropic:claude-sonnet-4-6";
const OPENAI = "cloud:openai:gpt-4o-mini";

/** Ein Adminstand: alles Claude, wahlweise eine Aufgabe auf ChatGPT. */
function konfig(perTask: Partial<Record<"structure" | "assist", "openai">> = {}) {
  const anbieter = (task: "structure" | "assist") => perTask[task] ?? "anthropic";
  return {
    model: ANTHROPIC,
    provider: ANTHROPIC,
    effectiveProvider: { structure: "cloud", assist: "cloud" },
    effectiveAnbieter: { structure: anbieter("structure"), assist: anbieter("assist") },
    cloudProviders: {
      openai: { configured: true, name: OPENAI },
      anthropic: { configured: true, name: ANTHROPIC },
    },
  } as unknown as ReasonerConfigStatus;
}

/**
 * BENs Fall (Nacharbeit 5): hausweit ist Cloud eingerichtet und global gewählt, aber `structure`
 * ist ausdrücklich LOKAL und `assist` REGELBASIERT gestellt. Der öffentliche Status sagt dazu nur
 * `mode: "cloud"` — für keine der beiden Aufgaben die Wahrheit.
 */
function konfigLokalUndRegel(): ReasonerConfigStatus {
  return {
    model: ANTHROPIC,
    provider: ANTHROPIC,
    localProvider: "local:qwen3-32b",
    taskConfig: { global: "anthropic", perTask: { structure: "local", assist: "deterministic" } },
    effectiveProvider: { structure: "local", assist: "deterministic" },
    effectiveAnbieter: { structure: "local", assist: "deterministic" },
    cloudProviders: {
      openai: { configured: true, name: OPENAI },
      anthropic: { configured: true, name: ANTHROPIC },
    },
  } as unknown as ReasonerConfigStatus;
}

describe("N-0070 · wer führt die Palette aus — die Ableitung", () => {
  it("A1 · Admin, eine Wahl für beide Aufgaben: EINMAL Stufe und Anbieter mit Modell", () => {
    const wer = ausfuehrerWer({
      tasks: ["structure", "assist"],
      istAdmin: true,
      config: konfig(),
      t: DE,
    });
    expect(wer).toBe(`${DE("reasoner.taskInfo.cloud")} · ${anbieterUndModell(ANTHROPIC)}`);
    expect(wer).toContain("Claude (Anthropic)");
  });

  it("A2 · Admin, Aufgaben abweichend zugeordnet: jede Aufgabe mit IHREM Anbieter", () => {
    const wer = ausfuehrerWer({
      tasks: ["structure", "assist"],
      istAdmin: true,
      config: konfig({ assist: "openai" }),
      t: DE,
    });
    expect(wer).toContain(`${DE("adm.ai.task.structure")}: `);
    expect(wer).toContain(`${DE("adm.ai.task.assist")}: `);
    expect(wer).toContain(anbieterUndModell(ANTHROPIC));
    expect(wer).toContain(anbieterUndModell(OPENAI));
  });

  it("A3 · ohne Adminsicht: „hier nicht bekannt“ — weder Stufe noch Anbieter- oder Modellname", () => {
    const wer = ausfuehrerWer({
      tasks: ["structure", "assist"],
      istAdmin: false,
      config: undefined,
      t: DE,
    });
    expect(wer).toBe(DE(AUSFUEHRER_UNBEKANNT_KEY));
    expect(wer).not.toContain(DE("reasoner.taskInfo.cloud"));
    expect(wer).not.toContain("Claude");
    expect(wer).not.toContain("claude-sonnet");
  });

  it("A3b · GEGENPROBE: hausweit Cloud, Aufgaben lokal/regelbasiert — Nicht-Admin sieht kein „Cloud-KI“, Admin die wahre Stufe je Aufgabe", () => {
    const cloud = DE("reasoner.taskInfo.cloud");
    // Nicht-Admin: auch wenn eine Adminauskunft im Speicher läge, wird sie nicht benutzt — und die
    // hausweite Cloud wird nicht als Ausführer behauptet.
    const nichtAdmin = ausfuehrerWer({
      tasks: ["structure", "assist"],
      istAdmin: false,
      config: konfigLokalUndRegel(),
      t: DE,
    });
    expect(nichtAdmin, "die hausweite Cloud wird als Aufgabenausführer ausgegeben").not.toContain(
      cloud,
    );
    expect(nichtAdmin).toBe(DE(AUSFUEHRER_UNBEKANNT_KEY));
    // Admin: je Aufgabe die WAHRE Stufe, getrennt, ohne Cloud.
    const admin = ausfuehrerWer({
      tasks: ["structure", "assist"],
      istAdmin: true,
      config: konfigLokalUndRegel(),
      t: DE,
    });
    expect(admin).not.toContain(cloud);
    expect(admin).toContain(`${DE("adm.ai.task.structure")}: ${DE("reasoner.taskInfo.local")}`);
    expect(admin).toContain(`${DE("adm.ai.task.assist")}: ${DE("reasoner.taskInfo.rule")}`);
  });

  it("A3c · Admin, Auskunft noch nicht geladen: „wird ermittelt“ statt einer geratenen Stufe", () => {
    const wer = ausfuehrerWer({
      tasks: ["structure", "assist"],
      istAdmin: true,
      config: undefined,
      t: DE,
    });
    expect(wer).toBe(DE("reasoner.taskInfo.unknown"));
    expect(wer).not.toContain(DE("reasoner.taskInfo.cloud"));
  });
});

describe("N-0070 · der Satz in der Fläche", () => {
  let wurzel: Root | null = null;
  let behaelter: HTMLDivElement | null = null;

  afterEach(() => {
    act(() => wurzel?.unmount());
    behaelter?.remove();
    wurzel = null;
    behaelter = null;
  });

  it("A4 · ohne RoleProvider: keine Ausnahme, und trotz hausweit „cloud“ steht „hier nicht bekannt“", async () => {
    await act(async () => {
      await i18n.changeLanguage("de");
    });
    const abfragen = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
    });
    abfragen.setQueryData(["reasoner", "status"], { active: true, mode: "cloud" });
    const ziel = document.createElement("div");
    behaelter = ziel;
    document.body.appendChild(ziel);
    await act(async () => {
      const r = createRoot(ziel);
      wurzel = r;
      r.render(
        createElement(
          QueryClientProvider,
          { client: abfragen },
          createElement(AiAusfuehrerZeile, { tasks: ["structure", "assist"] }),
        ),
      );
    });
    const zeile = ziel.querySelector('[data-testid="ki-ausfuehrer"]');
    expect(zeile, "der Satz wurde nicht gerendert").not.toBeNull();
    expect(zeile?.textContent).toBe(
      i18n.t(AI_AUSFUEHRER_KEY, { lng: "de", wer: DE(AUSFUEHRER_UNBEKANNT_KEY) }),
    );
    expect(zeile?.textContent, "die hausweite Stufe steht als Ausführer da").not.toContain(
      DE("reasoner.taskInfo.cloud"),
    );
  });

  it("A5 · im Blatt: im Menü „KI“, unter freier Eingabe und Knopf, für structure und assist", () => {
    const blatt = readFileSync(
      join(process.cwd(), "apps/web/src/components/erfassen/Blatt.tsx"),
      "utf8",
    );
    const menue = blatt.indexOf('name="ki"');
    expect(menue, "das Menü „KI“ fehlt im Blatt").toBeGreaterThan(0);
    const menueEnde = blatt.indexOf("</Menue>", menue);
    const anweisung = blatt.indexOf("<AiAssistInstructions", menue);
    const zeile = blatt.indexOf("<AiAusfuehrerZeile tasks={KI_PALETTE_AUFGABEN} />", menue);
    expect(anweisung, "die freie Anweisung fehlt im Menü „KI“").toBeGreaterThan(menue);
    expect(zeile, "die Ausführerangabe steht nicht nach der freien Anweisung").toBeGreaterThan(
      anweisung,
    );
    expect(zeile, "die Ausführerangabe steht nicht mehr im Menü „KI“").toBeLessThan(menueEnde);
    expect(blatt).toContain('const KI_PALETTE_AUFGABEN = ["structure", "assist"] as const;');
  });
});
