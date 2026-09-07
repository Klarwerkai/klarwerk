// @vitest-environment jsdom
// ================================================================================================
// JOB 3134 · KI-WAHL — NACHWEIS E: DIE KARTE, GEMOUNTET. Wählen, Speichern, Neuladen, Status.
// ================================================================================================
//
// Pedis Befund war eine KARTE, die sich widersprach: Dropdown „Claude", Status „ChatGPT". Hier wird
// die echte Karte (`KiDetail`) gemountet und Pedis Handgriffe werden nachgespielt: beide Anbieter
// in der Liste, ein nicht eingerichteter ausgegraut mit Grund; wählen → „nicht gespeichert, aktiv
// bleibt …"; speichern → der Server bekommt GENAU die Wahl, die Statuszeile folgt; Speicherfehler →
// alter Stand bleibt; altes Prüfergebnis verschwindet nach dem Wechsel; „wie global" entfernt die
// Aufgabe wirklich (Codex-Nachtrag); ENV-Sperre benennt die Variable; DE und EN.
//
// HERMETIK: kein Netz. Ein `fetch`-Spion spielt den Server: GET liefert den Stand, PUT übernimmt
// die Wahl in den Stand (so wie `PUT /api/reasoner/config` den frischen configStatus zurückgibt).
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { ReasonerConfigStatus } from "../../apps/web/src/api/types";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { KiDetail } from "../../apps/web/src/pages/AdminKiDetails";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const OPENAI_NAME = "cloud:openai:gpt-4o-mini";
const ANTHROPIC_NAME = "anthropic:claude-sonnet-4-6";
const TASKS = [
  "structure",
  "assist",
  "interview",
  "answer",
  "select",
  "extract",
  "describe",
  "group",
] as const;

const EINGERICHTET = {
  openai: { configured: true, name: OPENAI_NAME, model: "gpt-4o-mini" },
  anthropic: { configured: true, name: ANTHROPIC_NAME, model: "claude-sonnet-4-6" },
};

/** Der Serverstand für eine globale Wahl — so, wie `configStatus()` ihn liefert. */
function konfig(
  global: string,
  over: Partial<ReasonerConfigStatus> = {},
  perTask: Record<string, string> = {},
): ReasonerConfigStatus {
  const provider =
    global === "openai" || global === "auto"
      ? OPENAI_NAME
      : global === "anthropic"
        ? ANTHROPIC_NAME
        : "deterministic";
  const modell = provider !== "deterministic";
  const anbieterFuer = (wahl: string): "openai" | "anthropic" | "deterministic" =>
    wahl === "openai" || wahl === "auto"
      ? "openai"
      : wahl === "anthropic"
        ? "anthropic"
        : "deterministic";
  return {
    provider,
    ...(modell ? { model: provider } : {}),
    configured: true,
    mode: modell ? "model" : "demo",
    fallbackAvailable: true,
    supportsLocales: ["de", "en", "nl"],
    tasks: [...TASKS],
    taskConfig: { global, perTask },
    effective: Object.fromEntries(TASKS.map((t) => [t, "model"])),
    cloudConfigured: true,
    localConfigured: false,
    effectiveProvider: Object.fromEntries(TASKS.map((t) => [t, "cloud"])),
    effectiveAnbieter: Object.fromEntries(
      TASKS.map((t) => [t, anbieterFuer(perTask[t] ?? global)]),
    ),
    cloudProviders: EINGERICHTET,
    autoAnbieter: "openai",
    persisted: true,
    policySource: "db",
    ...over,
  };
}

interface Server {
  stand: ReasonerConfigStatus;
  putAnfragen: { global: string; perTask: Record<string, string> }[];
  putScheitert: boolean;
  probe: unknown;
}

/** Der Spion als Server: GET liefert den Stand, PUT übernimmt die Wahl in den Stand. */
function server(stand: ReasonerConfigStatus, probe?: unknown): Server {
  const s: Server = {
    stand,
    putAnfragen: [],
    putScheitert: false,
    probe: probe ?? {
      ok: true,
      provider: stand.provider,
      mode: "model",
      detail: "Modell hat geantwortet.",
      at: "2026-09-06T00:00:00Z",
      anbieter: "openai",
    },
  };
  vi.stubGlobal("fetch", (async (url: unknown, init?: { method?: string; body?: string }) => {
    const pfad = String(url);
    const antwort = (koerper: unknown, status = 200): Response =>
      ({
        ok: status < 400,
        status,
        statusText: status < 400 ? "OK" : "Error",
        text: async () => JSON.stringify(koerper),
      }) as unknown as Response;
    if (pfad.includes("/reasoner/config")) {
      if (init?.method === "PUT") {
        const payload = JSON.parse(init.body ?? "{}") as {
          global: string;
          perTask: Record<string, string>;
        };
        s.putAnfragen.push(payload);
        if (s.putScheitert) {
          return antwort({ error: "DB_DOWN", message: "db write down" }, 500);
        }
        s.stand = konfig(payload.global, {}, payload.perTask);
        return antwort(s.stand);
      }
      return antwort(s.stand);
    }
    if (pfad.includes("/reasoner/test")) {
      return antwort(s.probe);
    }
    return antwort({ error: "NOT_FOUND", message: "kein Fixture" }, 404);
  }) as unknown as typeof fetch);
  return s;
}

const durchlaufen = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

const gemountet: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];

afterEach(() => {
  for (const { root, container } of gemountet.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function karteMounten(sprache: "de" | "en" = "de"): Promise<HTMLDivElement> {
  await i18n.changeLanguage(sprache);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  gemountet.push({ root, container });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(ToastProvider, null, createElement(KiDetail, { onZurueck: () => {} })),
      ),
    );
    await durchlaufen();
  });
  await act(durchlaufen);
  return container;
}

function feld(container: HTMLDivElement, testId: string): HTMLSelectElement {
  const el = container.querySelector<HTMLSelectElement>(`[data-testid="${testId}"]`);
  expect(el, `Auswahlfeld ${testId} nicht gefunden`).toBeTruthy();
  return el as HTMLSelectElement;
}

async function waehlen(select: HTMLSelectElement, wert: string): Promise<void> {
  await act(async () => {
    select.value = wert;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await durchlaufen();
  });
}

async function knopfDruecken(container: HTMLDivElement, beschriftung: string): Promise<void> {
  const knopf = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(beschriftung),
  );
  expect(knopf, `Knopf „${beschriftung}" nicht gefunden`).toBeTruthy();
  await act(async () => {
    knopf?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await durchlaufen();
  });
  await act(durchlaufen);
}

const status = (c: HTMLDivElement): string =>
  c.querySelector('[data-testid="ki-status"]')?.textContent ?? "";
const ungespeichert = (c: HTMLDivElement): string | null =>
  c.querySelector('[data-testid="ki-ungespeichert"]')?.textContent ?? null;
const optionen = (select: HTMLSelectElement) =>
  [...select.options].map((o) => ({
    value: o.value,
    text: o.textContent ?? "",
    disabled: o.disabled,
  }));

describe("JOB 3134 E: die Karte nennt beide Anbieter und die Wahl bestimmt, was der Server bekommt", () => {
  it("E1 · beide Anbieter stehen als eigene Einträge in der Liste, ein nicht eingerichteter ausgegraut mit Grund — kein „cloud“ mehr", async () => {
    server(
      konfig("openai", {
        cloudProviders: {
          ...EINGERICHTET,
          anthropic: {
            configured: false,
            grund: "ANTHROPIC_API_KEY fehlt (weder ENV noch Schlüsselbund).",
          },
        },
      }),
    );
    const karte = await karteMounten();
    const global = feld(karte, "ki-wahl-global");
    const werte = optionen(global);
    expect(werte.map((o) => o.value)).toEqual([
      "auto",
      "openai",
      "anthropic",
      "local",
      "deterministic",
    ]);
    expect(werte.find((o) => o.value === "openai")).toEqual({
      value: "openai",
      text: "Extern · ChatGPT (OpenAI) · gpt-4o-mini",
      disabled: false,
    });
    const claude = werte.find((o) => o.value === "anthropic");
    expect(claude?.disabled).toBe(true);
    expect(claude?.text).toBe("Extern · Claude (Anthropic) (nicht eingerichtet)");
    expect(werte.find((o) => o.value === "auto")?.text).toContain("derzeit ChatGPT (OpenAI)");
    // Status, Auswahl und Zugang sagen dasselbe: ChatGPT ist gewählt UND aktiv.
    expect(global.value).toBe("openai");
    expect(status(karte)).toContain("ChatGPT (OpenAI) · gpt-4o-mini");
    // Der Grund des fehlenden Anbieters steht in der Zugangsliste (KiZugaengeDetail), hier nur die
    // Ausgrauung — die Karte bleibt ohne zweiten Einstellungsdschungel.
    expect(karte.textContent ?? "").not.toContain("ANTHROPIC_API_KEY fehlt");
    // Tastatur: ein natives Auswahlfeld, erreichbar und nicht gesperrt.
    expect(global.tagName).toBe("SELECT");
    expect(global.disabled).toBe(false);
    expect(global.tabIndex).toBe(0);
  });

  it("E2 · wählen → „nicht gespeichert, aktiv bleibt …“; übernehmen → der Server bekommt GENAU die Wahl, die Statuszeile folgt", async () => {
    const s = server(konfig("openai"));
    const karte = await karteMounten();
    expect(ungespeichert(karte)).toBeNull();

    await waehlen(feld(karte, "ki-wahl-global"), "anthropic");
    const hinweis = ungespeichert(karte) ?? "";
    expect(hinweis).toContain(i18n.t("adm.ai.dirtyHint"));
    expect(hinweis).toContain("Gewählt: Claude (Anthropic)");
    expect(hinweis).toContain("aktiv: ChatGPT (OpenAI) · gpt-4o-mini");
    // Die Statuszeile behauptet NICHT die ungespeicherte Wahl.
    expect(status(karte)).toContain("ChatGPT (OpenAI) · gpt-4o-mini");
    expect(s.putAnfragen).toHaveLength(0);

    await knopfDruecken(karte, i18n.t("adm.ai.save"));
    expect(s.putAnfragen).toEqual([{ global: "anthropic", perTask: {} }]);
    expect(ungespeichert(karte)).toBeNull();
    expect(status(karte)).toContain("Claude (Anthropic) · claude-sonnet-4-6");
    expect(status(karte)).not.toContain("OpenAI");
    expect(karte.textContent ?? "").toContain(i18n.t("adm.ai.applied"));
    expect(feld(karte, "ki-wahl-global").value).toBe("anthropic");
  });

  it("E3 · ein altes Prüfergebnis verschwindet nach dem Wechsel — es galt dem anderen Anbieter", async () => {
    server(konfig("openai"));
    const karte = await karteMounten();
    await knopfDruecken(karte, i18n.t("adm.ai.test"));
    const okZeile = i18n.t("adm.ai.testOk", { provider: "ChatGPT (OpenAI) · gpt-4o-mini" });
    expect(karte.textContent ?? "").toContain(okZeile);

    await waehlen(feld(karte, "ki-wahl-global"), "anthropic");
    // Noch nicht gespeichert: das Ergebnis der GESPEICHERTEN Zuordnung darf stehen bleiben.
    expect(karte.textContent ?? "").toContain(okZeile);
    await knopfDruecken(karte, i18n.t("adm.ai.save"));
    expect(karte.textContent ?? "").not.toContain(okZeile);
  });

  it("E4 · Speicherfehler: die Wahl bleibt als „nicht gespeichert“ stehen, aktiv bleibt der alte Stand", async () => {
    const s = server(konfig("openai"));
    s.putScheitert = true;
    const karte = await karteMounten();
    await waehlen(feld(karte, "ki-wahl-global"), "anthropic");
    await knopfDruecken(karte, i18n.t("adm.ai.save"));
    expect(s.putAnfragen).toHaveLength(1);
    expect(ungespeichert(karte)).toContain("Gewählt: Claude (Anthropic)");
    expect(status(karte)).toContain("ChatGPT (OpenAI) · gpt-4o-mini");
    expect(karte.textContent ?? "").not.toContain(i18n.t("adm.ai.applied"));
    expect(feld(karte, "ki-wahl-global").value).toBe("anthropic");
  });

  it("E5 · Codex-Nachtrag: „wie global“ ENTFERNT die Aufgabe — der Server bekommt sie nicht mehr, die andere Abweichung bleibt", async () => {
    const s = server(konfig("openai", {}, { assist: "anthropic", answer: "anthropic" }));
    const karte = await karteMounten();
    // Die Abweichungen stehen ausgeschrieben unter dem globalen Feld.
    const abweichungen = karte.querySelector('[data-testid="ki-abweichungen"]')?.textContent ?? "";
    expect(abweichungen).toContain(`${i18n.t("adm.ai.task.assist")} → Claude (Anthropic)`);
    expect(abweichungen).toContain(`${i18n.t("adm.ai.task.answer")} → Claude (Anthropic)`);
    // Je Aufgabe: das Abzeichen nennt den Anbieter, nicht nur „extern".
    expect(karte.textContent ?? "").toContain(i18n.t("adm.ai.eff.anthropic"));

    const assist = feld(karte, "ki-wahl-assist");
    expect(assist.value).toBe("anthropic");
    await waehlen(assist, "");
    await knopfDruecken(karte, i18n.t("adm.ai.save"));
    // GEGENMUTATION (der alte Fehler): bliebe der Schlüssel erhalten, stünde hier `assist: "anthropic"`.
    expect(s.putAnfragen).toEqual([{ global: "openai", perTask: { answer: "anthropic" } }]);
    expect(Object.hasOwn(s.putAnfragen[0]?.perTask ?? {}, "assist")).toBe(false);
  });

  it("E6 · ein migrierter Bestandswert wird gemeldet, nicht still umgedeutet", async () => {
    server(
      konfig("openai", {
        migration: {
          global: { von: "cloud", nach: "openai" },
          perTask: { answer: { von: "model", nach: "openai" } },
        },
      }),
    );
    const karte = await karteMounten();
    const hinweis = karte.querySelector('[data-testid="ki-migration"]')?.textContent ?? "";
    expect(hinweis).toContain("„cloud“");
    expect(hinweis).toContain("ChatGPT (OpenAI)");
    expect(hinweis).toContain(i18n.t("adm.ai.task.answer"));
    expect(hinweis).toContain("„model“");
  });

  it("E7 · ENV-Sperre: die Karte nennt KLARWERK_REASONER_POLICY und sperrt Auswahl und Speichern", async () => {
    server(konfig("openai", { policySource: "env", persisted: false }));
    const karte = await karteMounten();
    const sperre = karte.querySelector('[data-testid="ki-env-gesperrt"]')?.textContent ?? "";
    expect(sperre).toContain("KLARWERK_REASONER_POLICY");
    expect(feld(karte, "ki-wahl-global").disabled).toBe(true);
    const speichern = [...karte.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").includes(i18n.t("adm.ai.save")),
    );
    expect(speichern?.disabled).toBe(true);
  });

  it("E8 · Englisch: dieselbe Karte, dieselben Anbieter, übersetzte Sätze", async () => {
    server(konfig("openai"));
    const karte = await karteMounten("en");
    const werte = optionen(feld(karte, "ki-wahl-global"));
    expect(werte.find((o) => o.value === "anthropic")?.text).toBe(
      "External · Claude (Anthropic) · claude-sonnet-4-6",
    );
    expect(werte.find((o) => o.value === "auto")?.text).toContain("currently ChatGPT (OpenAI)");
    await waehlen(feld(karte, "ki-wahl-global"), "anthropic");
    expect(ungespeichert(karte)).toContain("Selected: Claude (Anthropic)");
    expect(ungespeichert(karte)).toContain("still active: ChatGPT (OpenAI) · gpt-4o-mini");
    await i18n.changeLanguage("de");
  });

  it("E9 · Neuladen: die Karte zeigt, was der Server gespeichert hat — nicht, was zuletzt gewählt war", async () => {
    // Der Server hat Claude gespeichert (z. B. aus einer früheren Sitzung).
    server(konfig("anthropic"));
    const karte = await karteMounten();
    expect(feld(karte, "ki-wahl-global").value).toBe("anthropic");
    expect(status(karte)).toContain("Claude (Anthropic) · claude-sonnet-4-6");
    expect(ungespeichert(karte)).toBeNull();
  });
});
