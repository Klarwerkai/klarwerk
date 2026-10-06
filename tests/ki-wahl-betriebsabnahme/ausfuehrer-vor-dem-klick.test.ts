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
//   A1–A3 · die Ableitung `ausfuehrerWer`: Adminsicht nennt Stufe UND Anbieter/Modell je Aufgabe,
//           bei abweichender Zuordnung je Aufgabe getrennt; öffentliche Sicht nur die Stufe
//           (WP-VIP2-GATE-2 — ob Nicht-Admins den Namen sehen sollen, ist offene Produktentscheidung).
//   A4    · die Zeile rendert auch OHNE `RoleProvider` (das Blatt in seinen Einzeltests) — als
//           öffentliche Sicht, ohne zu werfen.
//   A5    · im Blatt steht sie im Menü „KI" VOR dem ersten Eintrag, für `structure` und `assist`.
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
import { ausfuehrerWer } from "../../apps/web/src/lib/aiAusfuehrer";
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

describe("N-0070 · wer führt die Palette aus — die Ableitung", () => {
  it("A1 · Admin, eine Wahl für beide Aufgaben: EINMAL Stufe und Anbieter mit Modell", () => {
    const wer = ausfuehrerWer({
      tasks: ["structure", "assist"],
      istAdmin: true,
      config: konfig(),
      status: { active: true, mode: "cloud" },
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
      status: { active: true, mode: "cloud" },
      t: DE,
    });
    expect(wer).toContain(`${DE("adm.ai.task.structure")}: `);
    expect(wer).toContain(`${DE("adm.ai.task.assist")}: `);
    expect(wer).toContain(anbieterUndModell(ANTHROPIC));
    expect(wer).toContain(anbieterUndModell(OPENAI));
  });

  it("A3 · ohne Adminsicht: nur die Stufe, kein Anbieter- oder Modellname", () => {
    const wer = ausfuehrerWer({
      tasks: ["structure", "assist"],
      istAdmin: false,
      config: konfig(),
      status: { active: true, mode: "cloud" },
      t: DE,
    });
    expect(wer).toBe(DE("reasoner.taskInfo.cloud"));
    expect(wer).not.toContain("Claude");
    expect(wer).not.toContain("claude-sonnet");
  });
});

describe("N-0070 · die Zeile in der Fläche", () => {
  let wurzel: Root | null = null;
  let behaelter: HTMLDivElement | null = null;

  afterEach(() => {
    act(() => wurzel?.unmount());
    behaelter?.remove();
    wurzel = null;
    behaelter = null;
  });

  it("A4 · ohne RoleProvider: keine Ausnahme, die öffentliche Stufe steht im Satz", async () => {
    await act(async () => {
      await i18n.changeLanguage("de");
    });
    const abfragen = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
    });
    abfragen.setQueryData(["reasoner", "status"], { active: true, mode: "cloud" });
    behaelter = document.createElement("div");
    document.body.appendChild(behaelter);
    const ziel = behaelter;
    await act(async () => {
      wurzel = createRoot(ziel);
      wurzel.render(
        createElement(
          QueryClientProvider,
          { client: abfragen },
          createElement(AiAusfuehrerZeile, { tasks: ["structure", "assist"] }),
        ),
      );
    });
    const zeile = ziel.querySelector('[data-testid="ki-ausfuehrer"]');
    expect(zeile, "die Zeile wurde nicht gerendert").not.toBeNull();
    expect(zeile?.textContent).toBe(
      i18n.t(AI_AUSFUEHRER_KEY, { lng: "de", wer: DE("reasoner.taskInfo.cloud") }),
    );
  });

  it("A5 · im Blatt: im Menü „KI“ VOR dem ersten Eintrag, für structure und assist", () => {
    const blatt = readFileSync(
      join(process.cwd(), "apps/web/src/components/erfassen/Blatt.tsx"),
      "utf8",
    );
    const menue = blatt.indexOf('name="ki"');
    expect(menue, "das Menü „KI“ fehlt im Blatt").toBeGreaterThan(0);
    const zeile = blatt.indexOf("<AiAusfuehrerZeile tasks={KI_PALETTE_AUFGABEN} />", menue);
    const ersterEintrag = blatt.indexOf("<MenueEintrag", menue);
    expect(zeile, "die Ausführerzeile steht nicht im Menü „KI“").toBeGreaterThan(menue);
    expect(zeile, "die Ausführerzeile steht erst NACH einem ausführbaren Eintrag").toBeLessThan(
      ersterEintrag,
    );
    expect(blatt).toContain('const KI_PALETTE_AUFGABEN = ["structure", "assist"] as const;');
  });
});
