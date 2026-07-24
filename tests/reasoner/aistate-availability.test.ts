// D-AISTATE (Pedi 23.07.) — PAKET 1 + 2, pure Frontend-Logik:
//  - useAiAvailable-Kern (deriveAiAvailable): je Aufgabe ehrlich available/nicht.
//  - ehrlicher aiCheck-Name je Modellzustand (mit KI / ohne KI).
//  - Reasoner-Badge aus ECHTER Erreichbarkeit (nicht nur konfiguriert).
//  - „Extern"-Pille (Achse 1) getrennt vom KI-Modell.
//  - alle neuen i18n-Schlüssel lösen in DE/EN/NL zu echtem Text auf.
import { describe, expect, it } from "vitest";
import type { ReasonerStatus } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import { aiModelUsable, deriveAiAvailable } from "../../apps/web/src/lib/aiAvailability";
import {
  aiCheckCardDoneKey,
  aiCheckCardRunningKey,
  aiCheckPendingHintKey,
  aiCheckPendingLabelKey,
} from "../../apps/web/src/lib/aiCheckStatusCard";
import { externalStagePill } from "../../apps/web/src/lib/externalStagePill";
import { reasonerReachabilityBadge } from "../../apps/web/src/lib/reasonerReachability";

const st = (over: Partial<ReasonerStatus>): ReasonerStatus =>
  ({ active: true, mode: "cloud", reachable: "active", ...over }) as ReasonerStatus;

describe("PAKET 3 (bens V4): deriveAiAvailable — Erreichbarkeit + Task-Policy + Ladefall", () => {
  it("per-Task-Karte: true ⇒ verfügbar, false ⇒ NICHT (Aufgabe bewusst deterministisch)", () => {
    const status = st({ tasks: { structure: true, assist: false } });
    expect(deriveAiAvailable(status, "structure")).toBe(true);
    // Aufgabe deterministisch gestellt → ausgegraut, obwohl global ein Modell da ist.
    expect(deriveAiAvailable(status, "assist")).toBe(false);
  });

  it("unerreichbar ⇒ ausgegraut, auch wenn global aktiv und Task cloud-fähig", () => {
    expect(
      deriveAiAvailable(st({ reachable: "unreachable", tasks: { answer: true } }), "answer"),
    ).toBe(false);
    // „unverified" (Start, noch nicht geprobt) zählt NICHT als unerreichbar → weiter verfügbar.
    expect(
      deriveAiAvailable(st({ reachable: "unverified", tasks: { answer: true } }), "answer"),
    ).toBe(true);
  });

  it("ohne per-Task-Karte (alte Antwort) → globaler Status entscheidet", () => {
    expect(deriveAiAvailable(st({}), "answer")).toBe(true);
    expect(
      deriveAiAvailable(st({ active: false, mode: "deterministic", reachable: "none" }), "answer"),
    ).toBe(false);
    // Kein Status geladen → nicht verfügbar (kein Fake-Grün — der Hook selbst hält den Ladefall offen).
    expect(deriveAiAvailable(undefined, "answer")).toBe(false);
  });

  it("aiModelUsable: aktiv + erreichbar ⇒ true; unreachable ⇒ false; unverified ⇒ true", () => {
    expect(aiModelUsable(st({ reachable: "active" }))).toBe(true);
    expect(aiModelUsable(st({ reachable: "unverified" }))).toBe(true);
    expect(aiModelUsable(st({ reachable: "unreachable" }))).toBe(false);
    expect(aiModelUsable(st({ active: false, reachable: "none" }))).toBe(false);
    expect(aiModelUsable(undefined)).toBe(false);
  });
});

describe("PAKET 1.4: ehrlicher aiCheck-Name je Modellzustand (mit KI / ohne KI)", () => {
  it("Modell aktiv nutzt die mit-KI-Keys; kein Modell die no-KI-Keys", () => {
    expect(aiCheckPendingLabelKey(true)).toBe("val.aiCheck.pendingAi");
    expect(aiCheckPendingLabelKey(false)).toBe("val.aiCheck.pending");
    expect(aiCheckPendingHintKey(true)).toBe("val.aiCheck.pendingHintAi");
    expect(aiCheckPendingHintKey(false)).toBe("val.aiCheck.pendingHint");
    expect(aiCheckCardRunningKey(true)).toBe("capture.aiCheck.runningAi");
    expect(aiCheckCardRunningKey(false)).toBe("capture.aiCheck.running");
    expect(aiCheckCardDoneKey(true)).toBe("capture.aiCheck.doneAi");
    expect(aiCheckCardDoneKey(false)).toBe("capture.aiCheck.done");
  });

  it("DE: der no-Modell-Text nennt nicht KI-Pruefung, der Modell-Text nennt mit KI", async () => {
    await i18n.changeLanguage("de");
    expect(i18n.t("val.aiCheck.pending")).not.toContain("KI-Prüfung");
    expect(i18n.t("val.aiCheck.pending")).toContain("Duplikat");
    expect(i18n.t("val.aiCheck.pendingAi")).toContain("mit KI");
  });
});

describe("PAKET 2: reasonerReachabilityBadge — grün NUR bei echter Erreichbarkeit", () => {
  const s = (over: Partial<ReasonerStatus>): ReasonerStatus =>
    ({ active: true, mode: "cloud", ...over }) as ReasonerStatus;

  it("active → pos, unverified → warn, unreachable → crit, none → neutral", () => {
    expect(reasonerReachabilityBadge(s({ reachable: "active" })).tone).toBe("pos");
    expect(reasonerReachabilityBadge(s({ reachable: "unverified" })).tone).toBe("warn");
    expect(reasonerReachabilityBadge(s({ reachable: "unreachable" })).tone).toBe("crit");
    expect(reasonerReachabilityBadge(s({ active: false, reachable: "none" })).tone).toBe("neutral");
  });

  it("abgelaufener/unerreichbarer Key ist nicht aktiv (gruen) — er ist rot", () => {
    expect(reasonerReachabilityBadge(s({ reachable: "unreachable" })).labelKey).toBe(
      "topbar.reasonerUnreachable",
    );
  });

  it("Rückwärtskompat: fehlt reachable, wird konfiguriert→ungeprüft (gelb), sonst offline (grau)", () => {
    // reachable fehlt ganz (ältere Antwort/Fixture) → aus active ableiten.
    expect(reasonerReachabilityBadge(s({})).tone).toBe("warn");
    expect(reasonerReachabilityBadge(s({ active: false })).tone).toBe("neutral");
    expect(reasonerReachabilityBadge(undefined).tone).toBe("neutral");
  });
});

describe("PAKET 2: externalStagePill — Achse 1 spiegelt die Policy-Stufe", () => {
  it("blocked → neutral/Blockiert, open → warn/Offen, search_* → warn/Suche", () => {
    expect(externalStagePill("blocked")).toMatchObject({
      tone: "neutral",
      labelKey: "topbar.external.blocked",
    });
    expect(externalStagePill("open")).toMatchObject({
      tone: "warn",
      labelKey: "topbar.external.open",
    });
    expect(externalStagePill("search_on_click").labelKey).toBe("topbar.external.search");
    expect(externalStagePill("search_attach").labelKey).toBe("topbar.external.search");
  });
});

describe("D-AISTATE: neue i18n-Schlüssel lösen in DE/EN/NL zu echtem Text auf", () => {
  const keys = [
    "ai.unavailable.hint",
    "val.aiCheck.pending",
    "val.aiCheck.pendingAi",
    "val.aiCheck.locked",
    "val.aiCheck.lockedAi",
    "capture.aiCheck.running",
    "capture.aiCheck.runningAi",
    "imp.groups.willGroupWithoutAi",
    "topbar.reasonerUnverified",
    "topbar.reasonerUnreachable",
    "topbar.external.blocked",
    "topbar.external.search",
    "topbar.external.open",
    "topbar.external.hint",
  ];

  it("kein roher Key, nicht leer — in allen drei Sprachen", async () => {
    for (const lng of ["de", "en", "nl"] as const) {
      await i18n.changeLanguage(lng);
      for (const key of keys) {
        const text = i18n.t(key);
        expect(text, `${lng}:${key}`).not.toBe(key);
        expect(text.length, `${lng}:${key}`).toBeGreaterThan(3);
      }
    }
    await i18n.changeLanguage("de");
  });
});
