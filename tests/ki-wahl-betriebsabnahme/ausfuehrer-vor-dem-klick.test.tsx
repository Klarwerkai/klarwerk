// @vitest-environment jsdom
// ================================================================================================
// KI-WAHL-BETRIEBSABNAHME · N-0070 — DIE PALETTE AN DER EDITORLEISTE NENNT DEN AUSFÜHRER VOR DEM KLICK.
// ================================================================================================
//
// ORIGINALPUNKT (wörtlich): „Einen gut benannten Zugang zu KI, freier Anweisung und Vorlagen direkt
// an der Editorleiste anbieten; den jeweiligen Anbieter dort vor Ausführen anzeigen."
// ENTSCHEIDUNG Antwort 13 (über BEN, Nacharbeit 7): normale Anwender sollen den tatsächlich
// arbeitenden Dienst, seine Verfügbarkeit und Einschränkungen erkennen können.
//
// GELIEFERT VOR DIESEM AUFTRAG (nicht wiederholt): der Zugang selbst — das Menü „KI" im Blatt mit
// Strukturieren, Werksaktionen, freier Anweisung und Vorlagen (JOB 3062/3584/3769; Chromium-Belege
// `tests/ki-freie-anweisung/ki-palette-390px-chromium.test.ts`, `tests/ki-palette-320/…`,
// `tests/ki-palette-fingertipp/…`).
//
//   A1–A2 · Adminsicht: Stufe UND Anbieter/Modell je Aufgabe, bei abweichender Zuordnung getrennt.
//   A3    · Nicht-Admin OHNE geladene Ausführungsauskunft: „hier nicht bekannt" — nie die hausweite
//           Stufe als Ausführer (Nacharbeit 5).
//   A3b   · Admin, hausweit Cloud, `structure` lokal und `assist` regelbasiert: je Aufgabe die WAHRE
//           Stufe; eine Adminauskunft im Speicher wird für Nicht-Admins NICHT benutzt.
//   A3c   · Admin, Auskunft noch nicht geladen: „wird ermittelt", nicht die hausweite Stufe.
//   A6    · Antwort 13 · Nicht-Admin, GLOBAL Claude gewählt, aber `structure` LOKAL und `assist`
//           REGELBASIERT: der Satz nennt je Aufgabe IHREN Dienst — kein „Claude", kein „Cloud".
//   A7    · Antwort 13 · Nicht-Admin, Aufgabe läuft bei Claude: Dienstname, Verfügbarkeit und
//           Einschränkungen (vertrauliche Texte ohne Cloud-KI, Keine KI für Streng vertraulich).
//   A8    · Antwort 13 · Nicht-Admin, Claude gewählt, Freigabe fehlt: der TATSÄCHLICHE Ausführer
//           (regelbasiert) und der Grund — nicht der gewählte Anbieter.
//   A9    · BEN Nacharbeit 10 · Nicht-Admin, die Schutzstufen haben verschiedene Ausführer: jede Stufe
//           mit ihrem — kein einzelner behaupteter Dienst; Gegenprobe ohne Abweichung: ein Dienst.
//   A10   · BEN Nacharbeit 10 · Admin: Aufgabenwahl plus die abweichende Verteilung je Stufe.
//   A4    · der Satz rendert auch OHNE `RoleProvider` (das Blatt in seinen Einzeltests) — als
//           Nicht-Admin, aus der Ausführungsauskunft, trotz hausweit „cloud".
//   A5    · im Blatt steht er im Menü „KI", UNTER Eingabe und Knopf (Nacharbeit 4, B5a).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import type {
  ReasonerAusfuehrung,
  ReasonerAusfuehrungAntwort,
  ReasonerConfigStatus,
} from "../../apps/web/src/api/types";
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
 * ist ausdrücklich LOKAL und `assist` REGELBASIERT gestellt.
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

/** Die Auskunft für Nicht-Admins, wie `GET /api/reasoner/ausfuehrung` sie liefert. */
function auskunft(
  aufgaben: Partial<Record<"structure" | "assist", Partial<ReasonerAusfuehrung>>>,
): ReasonerAusfuehrungAntwort {
  const voll = (a: Partial<ReasonerAusfuehrung>): ReasonerAusfuehrung => ({
    ausfuehrer: "deterministic",
    gewaehlt: "deterministic",
    verfuegbar: false,
    einschraenkungen: [],
    keineKiFuer: [],
    ...a,
  });
  return {
    aufgaben: Object.fromEntries(
      Object.entries(aufgaben).map(([task, a]) => [task, voll(a ?? {})]),
    ),
  };
}

/** Antwort 13, BENs Gegenfall: global Claude, die Aufgaben aber lokal bzw. regelbasiert. */
const GLOBAL_CLAUDE_AUFGABEN_ANDERS = auskunft({
  structure: { ausfuehrer: "local", gewaehlt: "local", verfuegbar: true },
  assist: { ausfuehrer: "deterministic", gewaehlt: "deterministic" },
});

describe("N-0070 · wer führt die Palette aus — die Ableitung", () => {
  it("A1 · Admin, eine Wahl für beide Aufgaben: EINMAL Stufe und Anbieter mit Modell", () => {
    const wer = ausfuehrerWer({
      tasks: ["structure", "assist"],
      istAdmin: true,
      config: konfig(),
      ausfuehrung: undefined,
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
      ausfuehrung: undefined,
      t: DE,
    });
    expect(wer).toContain(`${DE("adm.ai.task.structure")}: `);
    expect(wer).toContain(`${DE("adm.ai.task.assist")}: `);
    expect(wer).toContain(anbieterUndModell(ANTHROPIC));
    expect(wer).toContain(anbieterUndModell(OPENAI));
  });

  it("A3 · Nicht-Admin ohne geladene Auskunft: „hier nicht bekannt“ — weder Stufe noch Name", () => {
    const wer = ausfuehrerWer({
      tasks: ["structure", "assist"],
      istAdmin: false,
      config: undefined,
      ausfuehrung: undefined,
      t: DE,
    });
    expect(wer).toBe(DE(AUSFUEHRER_UNBEKANNT_KEY));
    expect(wer).not.toContain(DE("reasoner.taskInfo.cloud"));
    expect(wer).not.toContain("Claude");
  });

  it("A3b · Admin: hausweit Cloud, Aufgaben lokal/regelbasiert — je Aufgabe die wahre Stufe; Nicht-Admin benutzt die Adminauskunft nicht", () => {
    const cloud = DE("reasoner.taskInfo.cloud");
    const nichtAdmin = ausfuehrerWer({
      tasks: ["structure", "assist"],
      istAdmin: false,
      config: konfigLokalUndRegel(),
      ausfuehrung: undefined,
      t: DE,
    });
    expect(nichtAdmin).toBe(DE(AUSFUEHRER_UNBEKANNT_KEY));
    const admin = ausfuehrerWer({
      tasks: ["structure", "assist"],
      istAdmin: true,
      config: konfigLokalUndRegel(),
      ausfuehrung: undefined,
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
      ausfuehrung: undefined,
      t: DE,
    });
    expect(wer).toBe(DE("reasoner.taskInfo.unknown"));
  });

  it("A6 · Antwort 13 · Nicht-Admin, global Claude, Aufgaben lokal bzw. regelbasiert: je Aufgabe IHR Dienst, kein Rückfall auf den globalen Anbieter", () => {
    const wer = ausfuehrerWer({
      tasks: ["structure", "assist"],
      istAdmin: false,
      config: undefined,
      ausfuehrung: GLOBAL_CLAUDE_AUFGABEN_ANDERS,
      t: DE,
    });
    expect(wer).toContain(
      `${DE("adm.ai.task.structure")}: ${DE("reasoner.taskInfo.local")} · ${DE("erfassen.ki.verfuegbar")}`,
    );
    expect(wer).toContain(`${DE("adm.ai.task.assist")}: ${DE("reasoner.taskInfo.rule")}`);
    expect(wer, "der globale Anbieter wird als Aufgabenausführer genannt").not.toContain("Claude");
    expect(wer).not.toContain(DE("reasoner.taskInfo.cloud"));
    expect(wer).not.toContain(DE(AUSFUEHRER_UNBEKANNT_KEY));
  });

  it("A7 · Antwort 13 · Nicht-Admin, Aufgaben laufen bei Claude: Dienst, Verfügbarkeit und Einschränkungen — ohne Modellkennung", () => {
    const claude: Partial<ReasonerAusfuehrung> = {
      ausfuehrer: "anthropic",
      gewaehlt: "anthropic",
      verfuegbar: true,
      einschraenkungen: ["vertraulich_ohne_cloud"],
      keineKiFuer: ["streng_vertraulich"],
    };
    const wer = ausfuehrerWer({
      tasks: ["structure", "assist"],
      istAdmin: false,
      config: undefined,
      ausfuehrung: auskunft({ structure: claude, assist: claude }),
      t: DE,
    });
    expect(wer).toBe(
      [
        "Claude (Anthropic)",
        DE("erfassen.ki.verfuegbar"),
        DE("erfassen.ki.einschraenkung.vertraulich_ohne_cloud"),
        `${DE("erfassen.ki.keineKiFuer")} ${DE("conf.level.streng_vertraulich")}`,
      ].join(" · "),
    );
    expect(wer).not.toContain("claude-sonnet");
  });

  it("A8 · Antwort 13 · Nicht-Admin, Claude gewählt, Freigabe fehlt: der TATSÄCHLICHE Ausführer und der Grund", () => {
    const ohneFreigabe: Partial<ReasonerAusfuehrung> = {
      ausfuehrer: "deterministic",
      gewaehlt: "anthropic",
      verfuegbar: false,
      einschraenkungen: ["freigabe_fehlt"],
    };
    const wer = ausfuehrerWer({
      tasks: ["structure", "assist"],
      istAdmin: false,
      config: undefined,
      ausfuehrung: auskunft({ structure: ohneFreigabe, assist: ohneFreigabe }),
      t: DE,
    });
    expect(wer).toBe(
      `${DE("reasoner.taskInfo.rule")} · ${DE("erfassen.ki.einschraenkung.freigabe_fehlt")}`,
    );
    expect(wer, "der nur gewählte, nicht arbeitende Anbieter steht als Ausführer da").not.toContain(
      "Claude",
    );
  });

  // BEN, Nacharbeit 10: global ChatGPT gewählt, die Stufenregel lenkt „intern" auf lokal und
  // „streng vertraulich" auf Keine KI. Ohne Inhaltskontext gibt es keinen einzelnen Ausführer.
  const STUFEN_VERTEILT: Partial<ReasonerAusfuehrung> = {
    ausfuehrer: "local",
    gewaehlt: "openai",
    verfuegbar: true,
    keineKiFuer: ["streng_vertraulich"],
    jeStufe: { intern: "local", vertraulich: "openai", streng_vertraulich: "deterministic" },
    stufenAbweichend: true,
  };
  const VERTEILUNG = [
    `${DE("conf.level.intern")}: ${DE("reasoner.taskInfo.local")}`,
    `${DE("conf.level.vertraulich")}: ChatGPT (OpenAI)`,
    `${DE("conf.level.streng_vertraulich")}: ${DE("reasoner.taskInfo.rule")}`,
  ].join(", ");

  it("A9 · Nicht-Admin, Stufen gehen auseinander: jede Stufe mit IHREM Ausführer — kein einzelner behaupteter Dienst", () => {
    const wer = ausfuehrerWer({
      tasks: ["structure", "assist"],
      istAdmin: false,
      config: undefined,
      ausfuehrung: auskunft({ structure: STUFEN_VERTEILT, assist: STUFEN_VERTEILT }),
      t: DE,
    });
    expect(wer.startsWith(VERTEILUNG), `gelesen: ${wer}`).toBe(true);
    // Gegenprobe: dieselbe Auskunft OHNE Abweichung nennt einen Dienst.
    const einheitlich = ausfuehrerWer({
      tasks: ["structure"],
      istAdmin: false,
      config: undefined,
      ausfuehrung: auskunft({
        structure: {
          ...STUFEN_VERTEILT,
          jeStufe: { intern: "local", vertraulich: "local", streng_vertraulich: "local" },
          stufenAbweichend: false,
        },
      }),
      t: DE,
    });
    expect(einheitlich.startsWith(`${DE("reasoner.taskInfo.local")} · `)).toBe(true);
    expect(einheitlich).not.toContain(DE("conf.level.intern"));
  });

  it("A10 · Admin: neben der Aufgabenwahl steht die abweichende Verteilung je Stufe", () => {
    const wer = ausfuehrerWer({
      tasks: ["structure"],
      istAdmin: true,
      config: konfig({ structure: "openai" }),
      ausfuehrung: auskunft({ structure: STUFEN_VERTEILT }),
      t: DE,
    });
    expect(wer).toBe(
      `${DE("reasoner.taskInfo.cloud")} · ${anbieterUndModell(OPENAI)} · ${DE("erfassen.ki.jeStufe")} ${VERTEILUNG}`,
    );
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

  it("A4 · ohne RoleProvider: keine Ausnahme; der Satz kommt aus der Ausführungsauskunft, nicht aus dem hausweiten „cloud“", async () => {
    await act(async () => {
      await i18n.changeLanguage("de");
    });
    const abfragen = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
    });
    abfragen.setQueryData(["reasoner", "status"], { active: true, mode: "cloud" });
    abfragen.setQueryData(["reasoner", "ausfuehrung"], GLOBAL_CLAUDE_AUFGABEN_ANDERS);
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
    const erwartet = ausfuehrerWer({
      tasks: ["structure", "assist"],
      istAdmin: false,
      config: undefined,
      ausfuehrung: GLOBAL_CLAUDE_AUFGABEN_ANDERS,
      t: DE,
    });
    expect(zeile?.textContent).toBe(i18n.t(AI_AUSFUEHRER_KEY, { lng: "de", wer: erwartet }));
    expect(zeile?.textContent).toContain(DE("reasoner.taskInfo.local"));
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
