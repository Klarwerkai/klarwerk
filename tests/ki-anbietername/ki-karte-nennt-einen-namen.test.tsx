// @vitest-environment jsdom
// ================================================================================================
// JOB 3120 · UX-10 TEIL 1 — EIN DIENST, EIN NAME.
// ================================================================================================
//
// WAS HIER GEMESSEN WIRD (und was ausdrücklich NICHT): Nicht, dass irgendwo im Quelltext eine
// Funktion aufgerufen wird — sondern dass zwei Zeichenketten, die ein Mensch auf derselben Karte
// nebeneinander liest, WÖRTLICH übereinstimmen:
//
//   Statuszeile der KI-Karte (`KiDetail`)  ==  Detail der Cloud-Zeile (`KiZugaengeDetail`)
//
// Der Vergleichswert wird deshalb nicht im Test hingeschrieben, sondern aus der GEMOUNTETEN
// Zugangsliste GELESEN (`leseZugangsDetail`) und dann in der Statuszeile gesucht. Ein Test, der nur
// „irgendein Text steht da" prüfte, bestünde beide Gegenproben aus §6 des Auftrags und wäre selbst
// der Fehler.
//
// HERMETIK: kein Netz. `fetch` ist global durch einen Spion ersetzt, der die vier Wege der Karte am
// Pfad unterscheidet (`/reasoner/config`, `/reasoner/test`, `/reasoner/test-local`,
// `/reasoner/conflict-self-test`, `/reasoner/duplicate-self-test`). Es wird kein Schlüssel und keine
// Endpunkt-URL angezeigt oder erfunden — die Fixtures tragen ausschließlich Client-/Modellnamen, wie
// sie `services/reasoner/src/service.ts:956` bzw. `:847` in die Antwort schreibt.
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
import { KiDetail, KiZugaengeDetail } from "../../apps/web/src/pages/AdminKiDetails";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Die drei Client-Namen, wie `services/reasoner/src/model-client.ts` sie bildet.
const ANTHROPIC = "anthropic:claude-sonnet-4-6";
const OPENAI = "cloud:openai:gpt-6-astra";
const UNBEKANNT = "irgendwas:modell-x";
const LOKAL = "local:Qwen3-32B-AWQ";

/** Eine vollständige, gültige Konfigurationsantwort — nur die zwei Felder je Fall verstellt. */
function konfig(over: Partial<ReasonerConfigStatus> & { provider: string }): ReasonerConfigStatus {
  const tasks = [
    "structure",
    "assist",
    "interview",
    "answer",
    "select",
    "extract",
    "describe",
    "group",
  ] as const;
  return {
    // `provider` kommt aus `...over` (Pflichtfeld der Signatur); `model` bildet den Bestand nach:
    // beide tragen DENSELBEN Client-Namen (`service.ts:956-957`).
    model: over.provider,
    configured: true,
    mode: "model",
    fallbackAvailable: true,
    supportsLocales: ["de", "en", "nl"],
    tasks: [...tasks],
    taskConfig: { global: "auto", perTask: {} },
    effective: Object.fromEntries(tasks.map((t) => [t, "model"])),
    cloudConfigured: true,
    localConfigured: false,
    effectiveProvider: Object.fromEntries(tasks.map((t) => [t, "cloud"])),
    persisted: true,
    ...over,
  };
}

interface Antworten {
  config: unknown;
  test?: unknown;
  testLocal?: unknown;
  conflict?: unknown;
  dup?: unknown;
}

function fetchSpion(antworten: Antworten): void {
  vi.stubGlobal("fetch", (async (url: unknown) => {
    const pfad = String(url);
    const körper = pfad.includes("/reasoner/config")
      ? antworten.config
      : pfad.includes("/reasoner/test-local")
        ? antworten.testLocal
        : pfad.includes("/reasoner/test")
          ? antworten.test
          : pfad.includes("/reasoner/conflict-self-test")
            ? antworten.conflict
            : pfad.includes("/reasoner/duplicate-self-test")
              ? antworten.dup
              : undefined;
    return {
      ok: körper !== undefined,
      status: körper !== undefined ? 200 : 404,
      statusText: körper !== undefined ? "OK" : "Not Found",
      text: async () => JSON.stringify(körper ?? { error: "NOT_FOUND", message: "kein Fixture" }),
    } as unknown as Response;
  }) as unknown as typeof fetch);
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

async function karteMounten(
  komponente: typeof KiDetail | typeof KiZugaengeDetail,
): Promise<HTMLDivElement> {
  await i18n.changeLanguage("de");
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
        createElement(ToastProvider, null, createElement(komponente, { onZurueck: () => {} })),
      ),
    );
    await durchlaufen();
  });
  await act(durchlaufen);
  return container;
}

/** Der Anbietername, wie die Zugangsliste ihn ZEIGT — gelesen, nicht hingeschrieben. */
async function leseZugangsDetail(): Promise<string> {
  const container = await karteMounten(KiZugaengeDetail);
  expect(container.querySelector('[data-testid="detail-ki-zugaenge"]')).toBeTruthy();
  // JOB 3134: je Anbieter eine Zeile — die des EINGERICHTETEN Anbieters ist die, die ein Detail
  // (Anbieter · Modell) trägt; die andere sagt „nicht konfiguriert" ohne Modell.
  // Das Detail ist der `text-muted-2`-Monospace-Span; die Zustandspille daneben ist ebenfalls
  // Monospace, aber `uppercase` — sie zählt nicht.
  const cloudZeile = [...container.querySelectorAll("li")].find((li) =>
    li.querySelector("span.font-mono.text-muted-2"),
  );
  const detail = cloudZeile?.querySelector("span.font-mono.text-muted-2")?.textContent ?? "";
  expect(detail, "keine Anbieterzeile nennt ein Detail").not.toBe("");
  // Sofort wieder abbauen: die zweite Karte wird gleich gemountet, und eine noch lebende erste
  // Karte würde ihre späten Zustandswechsel außerhalb von `act` melden.
  const eintrag = gemountet.pop();
  if (eintrag) {
    act(() => eintrag.root.unmount());
    eintrag.container.remove();
  }
  return detail;
}

/** Der Kasten eines Selbsttests, gefunden über seine sichtbare Beschriftung. */
function selbsttestKasten(container: HTMLDivElement, beschriftung: string): HTMLElement {
  const kopf = [...container.querySelectorAll("p.font-semibold")].find((p) =>
    (p.textContent ?? "").includes(`· ${beschriftung}:`),
  );
  expect(kopf, `Selbsttest-Kasten „${beschriftung}" nicht gefunden`).toBeTruthy();
  const kasten = kopf?.parentElement;
  expect(kasten).toBeTruthy();
  return kasten as HTMLElement;
}

/** Der Text der Statuszeile, so wie i18n ihn mit einem gegebenen Anbieternamen setzen würde. */
function statuszeileMit(name: string): string {
  return i18n.t("adm.ai.status", { provider: name, mode: i18n.t("adm.ai.modeModel") });
}

/** Knopf über seine sichtbare Beschriftung finden und drücken. */
async function knopfDruecken(container: HTMLDivElement, beschriftung: string): Promise<void> {
  const knopf = [...container.querySelectorAll("button")].find(
    (b) => (b.textContent ?? "").trim() === beschriftung,
  );
  expect(knopf, `Knopf „${beschriftung}" nicht gefunden`).toBeTruthy();
  await act(async () => {
    knopf?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await durchlaufen();
  });
  await act(durchlaufen);
}

describe("JOB 3120 A1–A3: Statuszeile und Zugangsliste nennen denselben Dienst gleich", () => {
  it("A1 · Anthropic: der Name der Statuszeile ist WÖRTLICH der Name der Zugangszeile", async () => {
    fetchSpion({ config: konfig({ provider: ANTHROPIC }) });
    const zugangsName = await leseZugangsDetail();
    expect(zugangsName).toBe("Claude (Anthropic) · claude-sonnet-4-6");

    const karte = await karteMounten(KiDetail);
    const text = karte.textContent ?? "";
    expect(karte.querySelector('[data-testid="detail-ki"]')).toBeTruthy();
    // Die ganze Statuszeile, mit dem aus der ANDEREN Karte gelesenen Namen.
    expect(text, "die Statuszeile nennt einen anderen Namen als die Zugangsliste").toContain(
      statuszeileMit(zugangsName),
    );
    // Und die rohe Client-Kennung steht nirgends mehr auf der Karte.
    expect(text).not.toContain(ANTHROPIC);
  });

  it("A2 · ChatGPT: derselbe Vergleich für den zweiten Cloud-Anbieter", async () => {
    fetchSpion({ config: konfig({ provider: OPENAI }) });
    const zugangsName = await leseZugangsDetail();
    expect(zugangsName).toBe("ChatGPT (OpenAI) · gpt-6-astra");

    const karte = await karteMounten(KiDetail);
    const text = karte.textContent ?? "";
    expect(text).toContain(statuszeileMit(zugangsName));
    expect(text).not.toContain(OPENAI);
  });

  it("A3 · unbekanntes Präfix: die rohe Kennung bleibt wörtlich stehen, es wird nichts geraten", async () => {
    fetchSpion({ config: konfig({ provider: UNBEKANNT }) });
    const karte = await karteMounten(KiDetail);
    const text = karte.textContent ?? "";
    // Ehrlichkeit vor Optik: lieber eine rohe Kennung als ein falscher Anbietername.
    expect(text).toContain(statuszeileMit(UNBEKANNT));
    // JOB 3134: die Auswahlliste nennt die beiden Anbieter IMMER (als wählbare bzw. ausgegraute
    // Einträge) — die Zusage „nichts geraten" gilt der STATUSZEILE, und die wird hier gezielt gelesen.
    const status = karte.querySelector('[data-testid="ki-status"]')?.textContent ?? "";
    expect(status).toContain(UNBEKANNT);
    expect(status).not.toContain("(OpenAI)");
    expect(status).not.toContain("(Anthropic)");
  });
});

describe("JOB 3120 B1–B4: die vier Ergebniszeilen sprechen dieselbe Sprache", () => {
  it("B1 · Schlüsseltest: die Ergebniszeile nennt denselben Anbieter wie die Statuszeile", async () => {
    fetchSpion({
      config: konfig({ provider: ANTHROPIC }),
      test: {
        ok: true,
        provider: ANTHROPIC,
        mode: "model",
        detail: "OK",
        at: "2026-09-06T00:00:00Z",
      },
    });
    const karte = await karteMounten(KiDetail);
    await knopfDruecken(karte, i18n.t("adm.ai.test"));
    const text = karte.textContent ?? "";
    expect(text).toContain(
      i18n.t("adm.ai.testOk", { provider: "Claude (Anthropic) · claude-sonnet-4-6" }),
    );
    // Statuszeile und Ergebniszeile nennen denselben Dienst — und keine rohe Kennung mehr.
    expect(text).toContain(statuszeileMit("Claude (Anthropic) · claude-sonnet-4-6"));
    expect(text).not.toContain(ANTHROPIC);
  });

  it("B2 · lokaler Test: der lokale Name bleibt wörtlich, die Zeile bricht nicht", async () => {
    fetchSpion({
      config: konfig({ provider: ANTHROPIC, localConfigured: true, localProvider: LOKAL }),
      testLocal: {
        ok: true,
        provider: LOKAL,
        mode: "model",
        detail: "OK",
        at: "2026-09-06T00:00:00Z",
      },
    });
    const karte = await karteMounten(KiDetail);
    await knopfDruecken(karte, i18n.t("adm.ai.testLocal"));
    expect(karte.textContent ?? "").toContain(i18n.t("adm.ai.testLocalOk", { provider: LOKAL }));
  });

  it("B2b · lokale Zeile mit einem übersetzbaren Namen: auch sie geht durch die EINE Ableitung", async () => {
    // BEWUSST SYNTHETISCH und hier begründet: der echte lokale Testweg meldet immer einen
    // `local:`-Namen (`service.ts:399/409` → `secondary.name`), und dort IST die Ableitung die
    // Identität — B2 könnte deshalb nicht unterscheiden, ob die Zeile die Ableitung benutzt oder
    // den Rohwert durchreicht. Gemessen wird hier die ANZEIGEREGEL dieser Zeile, nicht ein
    // Serverwert: bekommt sie einen übersetzbaren Client-Namen, übersetzt sie ihn wie jede andere
    // Stelle der Karte.
    fetchSpion({
      config: konfig({ provider: ANTHROPIC }),
      testLocal: {
        ok: true,
        provider: OPENAI,
        mode: "model",
        detail: "OK",
        at: "2026-09-06T00:00:00Z",
      },
    });
    const karte = await karteMounten(KiDetail);
    await knopfDruecken(karte, i18n.t("adm.ai.testLocal"));
    const text = karte.textContent ?? "";
    expect(text).toContain(
      i18n.t("adm.ai.testLocalOk", { provider: "ChatGPT (OpenAI) · gpt-6-astra" }),
    );
    expect(text).not.toContain(OPENAI);
  });

  it("B3/B4 · Konflikt- und Duplikat-Selbsttest nennen denselben Anbieter", async () => {
    fetchSpion({
      config: konfig({ provider: ANTHROPIC }),
      conflict: {
        ok: true,
        code: "ok",
        provider: ANTHROPIC,
        mode: "model",
        conflictCreated: true,
        hasKollision: true,
        streitwertAWoertlich: true,
        streitwertBWoertlich: true,
        streitpunkt: "Streitwert",
        messageKey: "adm.conflictSelfTest.ok",
      },
      dup: {
        ok: true,
        code: "ok",
        provider: ANTHROPIC,
        mode: "model",
        duplicateCreated: true,
        relation: "duplicate_of",
        messageKey: "adm.dupSelfTest.ok",
      },
    });
    const karte = await karteMounten(KiDetail);
    await knopfDruecken(karte, i18n.t("adm.selfTest.button"));
    const text = karte.textContent ?? "";
    const zeile = i18n.t("adm.conflictSelfTest.provider", {
      provider: "Claude (Anthropic) · claude-sonnet-4-6",
    });
    // JEDER der beiden Kästen einzeln — eine Zählung über die ganze Karte könnte auch von zwei
    // Treffern in EINEM Kasten erfüllt werden.
    expect(selbsttestKasten(karte, i18n.t("adm.conflictSelfTest.label")).textContent).toContain(
      zeile,
    );
    expect(selbsttestKasten(karte, i18n.t("adm.dupSelfTest.label")).textContent).toContain(zeile);
    expect(text).not.toContain(ANTHROPIC);
  });
});

describe("JOB 3120 C1: ohne Cloud-Konfiguration wird kein Anbieter behauptet", () => {
  it("C1 · deterministischer Ersatzmodus: die Statuszeile nennt keinen Cloud-Anbieter", async () => {
    // So sieht die echte Antwort ohne jedes Modell aus (`service.ts:956`: `fallback.name`).
    fetchSpion({
      config: {
        ...konfig({ provider: "deterministic" }),
        model: undefined,
        configured: false,
        mode: "demo",
        cloudConfigured: false,
        effective: {},
        effectiveProvider: {},
      },
    });
    const karte = await karteMounten(KiDetail);
    const text = karte.textContent ?? "";
    // Erst der Beleg, dass die Karte überhaupt dasteht — sonst wäre jede „nicht enthalten"-Zusage
    // unten geschenkt (eine leere Fläche enthält nie etwas).
    expect(karte.querySelector('[data-testid="detail-ki"]')).toBeTruthy();
    expect(text).toContain(
      i18n.t("adm.ai.status", {
        provider: "deterministic",
        mode: i18n.t("adm.ai.modeDemo"),
      }),
    );
    // JOB 3134: die Auswahlliste nennt beide Anbieter als (ausgegraute) Einträge — die Zusage
    // „kein Anbieter behauptet" gilt der STATUSZEILE.
    const status = karte.querySelector('[data-testid="ki-status"]')?.textContent ?? "";
    expect(status).toContain("deterministic");
    expect(status).not.toContain("(OpenAI)");
    expect(status).not.toContain("(Anthropic)");
  });
});
