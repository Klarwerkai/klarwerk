// @vitest-environment jsdom
// ================================================================================================
// JOB 3044 · V9 Scheibe 2 — MODELL UND DAUER STEHEN AN DER FLÄCHE, UND EIN FEHLEN BLEIBT LEER.
// ================================================================================================
//
// Gefahren wird die ECHTE Kette: `Capital` (die exportierte Seite) → `ReasonerRunsCard` →
// `useModelRuns(50)` → `endpoints.modelRuns.recent` → `api.get("/model-runs")` → `fetch`.
// Die Attrappe sitzt ganz unten am `fetch` und liefert AUSSCHLIESSLICH JSON; sie entscheidet
// nichts über Sichtbarkeit (Lehre JOB 3039 R1, Punkt 3). Alle anderen Endpunkte antworten mit
// 500 — die übrigen Karten der Seite zeigen dann ihren eigenen Fehlerzustand, was diese Datei
// nicht prüft und nicht stört: `ReasonerRunsCard` hängt an keinem davon.
//
// WAS HIER NICHT GEMESSEN WIRD: jsdom rechnet kein Layout. Ob die neuen Angaben im echten Browser
// lesbar PLATZIERT sind, sagt diese Datei nicht — gemessen ist, WAS im Dokument steht und was
// ausdrücklich NICHT darin steht.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "admin", stufe2: true, setStufe2: () => {} }),
}));

import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import type { ModelRunRecord } from "../../apps/web/src/api/types";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { formatiereDauer } from "../../apps/web/src/lib/modelRuns";
import { Capital } from "../../apps/web/src/pages/Stufe2";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// `onlineManager` ist modulglobal: ohne diese Rückstellung träte ein Offline-Fall an alle
// nachfolgenden Fälle dieser Datei weiter.
afterEach(() => onlineManager.setOnline(true));

const START = "2026-09-03T10:00:00.000Z";

function lauf(over: Partial<ModelRunRecord> = {}): ModelRunRecord {
  return {
    id: "r1",
    task: "structure",
    provider: "deterministic",
    demo: false,
    fallback: false,
    locale: "de",
    startedAt: START,
    finishedAt: "2026-09-03T10:00:00.100Z",
    status: "success",
    ...over,
  };
}

/** Start + Dauer in Millisekunden → gültiges Zeitstempelpaar. */
function dauer(ms: number): Pick<ModelRunRecord, "startedAt" | "finishedAt"> {
  return { startedAt: START, finishedAt: new Date(Date.parse(START) + ms).toISOString() };
}

type Antwort = { laeufe: readonly ModelRunRecord[] } | { fehler: true };

/** Legt `fetch` auf einen JSON-Lieferanten. Nur `/api/model-runs` wird bedient. */
function stelleFetch(antwort: () => Antwort): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      const pfad = String(url);
      if (!pfad.includes("/api/model-runs")) {
        return { ok: false, status: 500, statusText: "no", text: async () => "{}" } as Response;
      }
      const a = antwort();
      if ("fehler" in a) {
        return { ok: false, status: 500, statusText: "no", text: async () => "{}" } as Response;
      }
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify(a.laeufe),
      } as Response;
    }),
  );
}

const durchlaufen = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

// Ben (R2, Hinweis): jede gemountete Wurzel wird wieder abgebaut. Sonst laufen die Nebenabfragen
// der übrigen Karten nach dem Fall weiter und erzeugen `act`-Warnungen aus einem Test, der längst
// vorbei ist — Rauschen, das eine echte Warnung verdecken kann.
const gemountet: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];

afterEach(() => {
  for (const { root, container } of gemountet.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
});

async function mounten(): Promise<{ container: HTMLDivElement; qc: QueryClient }> {
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
        createElement(
          ToastProvider,
          null,
          createElement(MemoryRouter, { initialEntries: ["/kapital"] }, createElement(Capital)),
        ),
      ),
    );
    await durchlaufen();
  });
  await act(durchlaufen);
  return { container, qc };
}

function zeilen(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-testid="mrun-row"]'));
}

function zeile(container: HTMLElement, id: string): HTMLElement {
  const treffer = zeilen(container).find((el) => el.getAttribute("data-run-id") === id);
  expect(treffer, `keine Laufzeile für ${id} gerendert`).toBeTruthy();
  return treffer as HTMLElement;
}

describe("JOB 3044 · das Modell steht an der Fläche — oder ausdrücklich nichts", () => {
  it("F7 · ein echter Cloud-Lauf nennt seinen Modellbezeichner", async () => {
    stelleFetch(() => ({
      laeufe: [lauf({ id: "a", provider: "anthropic", model: "claude-sonnet-4-6" })],
    }));
    const { container } = await mounten();
    const z = zeile(container, "a");
    expect(z.querySelector('[data-testid="mrun-model"]')?.textContent).toContain(
      "claude-sonnet-4-6",
    );
    expect(container.textContent).toContain("claude-sonnet-4-6");
  });

  it("F8 · Altdatensatz (model === provider): „anthropic“ steht in der Zeile GENAU EINMAL, kein Modell-Label", async () => {
    stelleFetch(() => ({ laeufe: [lauf({ id: "a", provider: "anthropic", model: "anthropic" })] }));
    const { container } = await mounten();
    const z = zeile(container, "a");
    const treffer = (z.textContent ?? "").match(/anthropic/g) ?? [];
    expect(
      treffer.length,
      "der Providername darf nicht ein zweites Mal als „Modell“ erscheinen",
    ).toBe(1);
    expect(z.querySelector('[data-testid="mrun-model"]')).toBeNull();
  });

  it("F9 · ein Lauf ohne Modellaufruf trägt weder Label noch Ersatzwort", async () => {
    stelleFetch(() => ({ laeufe: [lauf({ id: "a", provider: "deterministic", task: "select" })] }));
    const { container } = await mounten();
    const z = zeile(container, "a");
    expect(z.querySelector('[data-testid="mrun-model"]')).toBeNull();
    // Unabhängig von jedem i18n-Wert: es darf kein Ersatzwort auftauchen.
    expect(z.textContent ?? "").not.toMatch(/unbekannt|unknown|onbekend/i);
    expect(z.textContent ?? "").not.toContain("Modell");
  });
});

describe("JOB 3044 · die Dauer steht an der Fläche — oder ausdrücklich nichts", () => {
  it("F10 · 1799 ms lesen sich als „1.8 s“; ein kaputtes Zeitstempelpaar erzeugt keine Angabe", async () => {
    stelleFetch(() => ({
      laeufe: [
        lauf({ id: "gut", ...dauer(1799) }),
        // F3-Daten: Ende VOR Start.
        lauf({ id: "kaputt", startedAt: "2026-09-03T10:00:01.799Z", finishedAt: START }),
      ],
    }));
    const { container } = await mounten();
    expect(
      zeile(container, "gut").querySelector('[data-testid="mrun-dauer"]')?.textContent,
    ).toContain("1.8 s");
    const k = zeile(container, "kaputt");
    expect(k.querySelector('[data-testid="mrun-dauer"]')).toBeNull();
    expect(k.textContent ?? "", "keine geratene Zeit, kein 0 ms, kein Strich").not.toMatch(
      /\d\s?ms|\d\s?s\b/,
    );
  });

  it("F11 · die Kopfzeile nennt Summe UND Grundmenge (aus 2 von 3)", async () => {
    stelleFetch(() => ({
      laeufe: [
        lauf({ id: "a", ...dauer(1799) }),
        lauf({ id: "b", ...dauer(4601) }),
        lauf({ id: "c", startedAt: "—", finishedAt: "—" }),
      ],
    }));
    const { container } = await mounten();
    const kopf = container.querySelector<HTMLElement>('[data-testid="mrun-laufzeit"]');
    expect(kopf, "die Summenzeile fehlt").toBeTruthy();
    const text = kopf?.textContent ?? "";
    // Summe der zwei gültigen Läufe: 1799 + 4601 = 6400 ms.
    expect(text).toContain("6.4 s");
    // Die Grundmenge steht als eigene Aussage da — unabhängig vom Satzbau geprüft, damit ein
    // Weglassen von {{n}}/{{total}} im Übersetzungstext nicht unbemerkt bleibt. „6.4 s“ enthält
    // weder eine 2 noch eine 3.
    expect(text, "die Zahl der beitragenden Läufe fehlt").toMatch(/\b2\b/);
    expect(text, "die Grundmenge (Gesamtzahl geladener Läufe) fehlt").toMatch(/\b3\b/);
    expect(text).toBe(i18n.t("mrun.runtimeTotal", { d: formatiereDauer(6400), n: 2, total: 3 }));
  });
});

describe("JOB 3044 · der Zustandsweg der Karte", () => {
  it("F12a · Erstfehler OHNE Daten: nur der Fehlertext, keine der drei neuen Aussagen", async () => {
    stelleFetch(() => ({ fehler: true }));
    const { container } = await mounten();
    const karte = container.querySelector<HTMLElement>('[data-testid="mrun-card"]');
    expect(karte, "die Reasoner-Karte fehlt").toBeTruthy();
    expect(karte?.textContent).toContain(i18n.t("state.error"));
    expect(zeilen(karte as HTMLElement)).toHaveLength(0);
    expect(karte?.querySelector('[data-testid="mrun-laufzeit"]')).toBeNull();
  });

  it("F12b · Cache mit gescheiterter Auffrischung: Läufe und Summe bleiben, der Fehler kommt HINZU", async () => {
    let scheitern = false;
    stelleFetch(() =>
      scheitern ? { fehler: true } : { laeufe: [lauf({ id: "a", ...dauer(1799) })] },
    );
    const { container, qc } = await mounten();
    expect(zeilen(container)).toHaveLength(1);

    scheitern = true;
    await act(async () => {
      await qc.refetchQueries({ queryKey: ["model-runs"] }).catch(() => undefined);
      await durchlaufen();
    });

    const karte = container.querySelector<HTMLElement>('[data-testid="mrun-card"]');
    expect(
      zeilen(karte as HTMLElement),
      "der geladene Bestand darf nicht verschwinden",
    ).toHaveLength(1);
    expect(karte?.querySelector('[data-testid="mrun-laufzeit"]')).toBeTruthy();
    expect(
      karte?.querySelector('[data-testid="mrun-refresh-error"]')?.textContent,
      "der Fehler muss als zusätzlicher Hinweis erscheinen",
    ).toBe(i18n.t("mrun.refreshFailed"));
  });

  // ── JOB 3044 R2 · DIE KANTE, DIE RUNDE 1 NICHT GEMESSEN HAT (Ben, Korrekturpflicht 1) ─────────
  //
  // Offline ist KEIN HTTP-Fehler: React Query lässt die Abfrage gar nicht erst laufen und setzt
  // `fetchStatus: "paused"`. `status` bleibt dabei `pending`, also `isError === false` und
  // `isLoading === true`. Runde 1 prüfte nur die abgelehnte Antwort (F12a/F12b) und behauptete den
  // Offline-Fall als „strukturell gedeckt" — er war es nicht: die Karte zeigte dauerhaft „Lädt …",
  // also einen Fortschritt, den es nicht gab. Diese zwei Fälle binden die Kante am echten
  // `onlineManager`, nicht an einer nachgebauten Lage.
  it("F12c · offline OHNE Cache: Fehlertext, KEIN Ladehinweis — es lädt ja nichts", async () => {
    onlineManager.setOnline(false);
    stelleFetch(() => ({ laeufe: [lauf({ id: "a", ...dauer(1799) })] }));
    const { container } = await mounten();
    const karte = container.querySelector<HTMLElement>('[data-testid="mrun-card"]');
    expect(karte, "die Reasoner-Karte fehlt").toBeTruthy();
    expect(karte?.textContent).toContain(i18n.t("state.error"));
    expect(
      karte?.textContent,
      "„Lädt …“ behauptet einen Fortschritt, den ein pausierter Abruf nicht macht",
    ).not.toContain(i18n.t("state.loading"));
    expect(zeilen(karte as HTMLElement)).toHaveLength(0);
    expect(karte?.querySelector('[data-testid="mrun-laufzeit"]')).toBeNull();
  });

  it("F12d · offline MIT Cache: Lauf und Summe bleiben, ein Offline-Hinweis kommt HINZU", async () => {
    stelleFetch(() => ({ laeufe: [lauf({ id: "a", ...dauer(1799) })] }));
    const { container, qc } = await mounten();
    expect(zeilen(container)).toHaveLength(1);

    onlineManager.setOnline(false);
    await act(async () => {
      // Nicht awaiten: eine pausierte Auffrischung löst ihr Versprechen erst wieder online ein.
      void qc.refetchQueries({ queryKey: ["model-runs"] });
      await durchlaufen();
    });

    const karte = container.querySelector<HTMLElement>('[data-testid="mrun-card"]');
    expect(
      zeilen(karte as HTMLElement),
      "der geladene Bestand darf offline nicht verschwinden",
    ).toHaveLength(1);
    expect(karte?.querySelector('[data-testid="mrun-laufzeit"]')).toBeTruthy();
    expect(
      karte?.querySelector('[data-testid="mrun-offline"]')?.textContent,
      "offline muss als eigener Hinweis erscheinen, nicht als „Auffrischung fehlgeschlagen“",
    ).toBe(i18n.t("mrun.offline"));
    expect(karte?.querySelector('[data-testid="mrun-refresh-error"]')).toBeNull();
  });

  it("F12e · erfolgreich LEER, danach offline: „noch keine Läufe“ bleibt, aber nicht als frische Tatsache", async () => {
    stelleFetch(() => ({ laeufe: [] }));
    const { container, qc } = await mounten();
    const karte = () => container.querySelector<HTMLElement>('[data-testid="mrun-card"]');
    expect(karte()?.textContent).toContain(i18n.t("mrun.empty"));
    expect(karte()?.querySelector('[data-testid="mrun-offline"]')).toBeNull();

    onlineManager.setOnline(false);
    await act(async () => {
      void qc.refetchQueries({ queryKey: ["model-runs"] });
      await durchlaufen();
    });

    // Der Leertext bleibt — er ist eine erfolgreich geladene Auskunft. Aber er darf offline nicht
    // ALLEIN dastehen: sonst behauptet er einen aktuellen Bestand, der gerade nicht abfragbar ist.
    expect(karte()?.textContent).toContain(i18n.t("mrun.empty"));
    expect(karte()?.querySelector('[data-testid="mrun-offline"]')?.textContent).toBe(
      i18n.t("mrun.offline"),
    );
    // Und es entsteht dabei keine Summenzeile: es gibt nichts, worüber summiert werden könnte.
    expect(karte()?.querySelector('[data-testid="mrun-laufzeit"]')).toBeNull();
  });

  // ── JOB 3044 R3 · DER EINFACHSTE OFFLINE-FALL ÜBERHAUPT (Ben, R2, Korrekturpflicht 1) ─────────
  //
  // F12c–F12e messen alle einen Zustand, in dem eine Abfrage LAUFEN WILL: erst dann setzt React
  // Query `fetchStatus: "paused"`. Der Alltagsfall ist ein anderer und war ungemessen: Die Seite
  // steht da, die Abfrage ruht (`fetchStatus: "idle"`), und DANN fällt die Verbindung weg. `idle`
  // wird dabei nicht zu `paused` — `runs.isPaused` bleibt false, und die Karte sagte kein Wort.
  // Sie zeigte also einen Bestand, der nicht mehr überprüfbar war, als wäre nichts geschehen.
  // Deshalb hängt die Lage jetzt am Netzzustand selbst, nicht an einem Nebeneffekt einer Abfrage.
  it("F12f · Netzverlust bei RUHENDER Abfrage: Bestand bleibt, der Offline-Hinweis erscheint von selbst", async () => {
    stelleFetch(() => ({ laeufe: [lauf({ id: "a", ...dauer(1799) })] }));
    const { container } = await mounten();
    const karte = () => container.querySelector<HTMLElement>('[data-testid="mrun-card"]');
    expect(zeilen(container)).toHaveLength(1);
    expect(karte()?.querySelector('[data-testid="mrun-offline"]')).toBeNull();

    // AUSDRÜCKLICH KEIN refetchQueries: nur der Netzzustand ändert sich.
    await act(async () => {
      onlineManager.setOnline(false);
      await durchlaufen();
    });

    expect(
      zeilen(container),
      "der geladene Bestand darf beim Netzverlust nicht verschwinden",
    ).toHaveLength(1);
    expect(
      zeile(container, "a").querySelector('[data-testid="mrun-dauer"]')?.textContent,
    ).toContain("1.8 s");
    expect(karte()?.querySelector('[data-testid="mrun-laufzeit"]')).toBeTruthy();
    expect(
      karte()?.querySelector('[data-testid="mrun-offline"]')?.textContent,
      "ohne Abonnement des Netzzustands bleibt dieser Hinweis aus — genau das war der Rotpunkt",
    ).toBe(i18n.t("mrun.offline"));
    expect(karte()?.textContent).not.toContain(i18n.t("state.loading"));
  });
});
