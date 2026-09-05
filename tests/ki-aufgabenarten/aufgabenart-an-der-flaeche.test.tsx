// @vitest-environment jsdom
// ================================================================================================
// JOB 3069 · V9 Nebenbefund (f) — IN DER PILLE STEHT EIN WORT, KEIN PROGRAMMSCHLÜSSEL.
// ================================================================================================
//
// Gefahren wird die ECHTE Kette (Bauform aus JOB 3044,
// `tests/ki-lauf-dauer/modell-und-dauer-an-der-flaeche.test.tsx`): `Capital` (die exportierte
// Seite) → `ReasonerRunsCard` → `useModelRuns(50)` → `endpoints.modelRuns.recent` →
// `api.get("/model-runs")` → `fetch`. Die Attrappe sitzt ganz unten am `fetch` und liefert
// AUSSCHLIESSLICH JSON; sie entscheidet nichts über Sichtbarkeit. Alle anderen Endpunkte antworten
// mit 500 — die übrigen Karten zeigen dann ihren eigenen Fehlerzustand, was diese Datei nicht
// prüft und nicht stört: `ReasonerRunsCard` hängt an keinem davon.
//
// WIRKUNGSNACHWEIS, KEIN ANWESENHEITSNACHWEIS (Lehre JOB 3062 R5): Geprüft wird der TEXT IM
// DOKUMENT, nachdem der Zustand ausgelöst wurde — nicht, ob ein Schlüssel im Wörterbuch steht.
//
// WAS HIER NICHT GEMESSEN WIRD: jsdom rechnet kein Layout. Ob die Pille im echten Browser lesbar
// PLATZIERT ist, sagt diese Datei nicht.
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
import { REASONER_TASKS } from "../../apps/web/src/api/types";
import type { ModelRunRecord, ModelRunTask } from "../../apps/web/src/api/types";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { summarizeModelRuns } from "../../apps/web/src/lib/modelRuns";
import { Capital } from "../../apps/web/src/pages/Stufe2";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => onlineManager.setOnline(true));

// `i18n` ist modulglobal: ohne diese Rückstellung trüge ein Sprachwechsel (R5) in alle
// nachfolgenden Fälle dieser Datei weiter. Dieselbe Vorsicht wie beim `onlineManager` darüber.
afterEach(async () => {
  if (i18n.language !== "de") {
    await i18n.changeLanguage("de");
  }
});

const START = "2026-09-05T10:00:00.000Z";

function lauf(over: Partial<ModelRunRecord> = {}): ModelRunRecord {
  return {
    id: "r1",
    task: "structure",
    provider: "deterministic",
    demo: false,
    fallback: false,
    locale: "de",
    startedAt: START,
    finishedAt: "2026-09-05T10:00:00.100Z",
    status: "success",
    ...over,
  };
}

function stelleFetch(laeufe: readonly ModelRunRecord[]): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      const pfad = String(url);
      if (!pfad.includes("/api/model-runs")) {
        return { ok: false, status: 500, statusText: "no", text: async () => "{}" } as Response;
      }
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify(laeufe),
      } as Response;
    }),
  );
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
});

async function mounten(): Promise<HTMLDivElement> {
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
  return container;
}

function karte(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>('[data-testid="mrun-card"]');
  expect(el, "die Reasoner-Karte fehlt").toBeTruthy();
  return el as HTMLElement;
}

function zeile(container: HTMLElement, id: string): HTMLElement {
  const treffer = Array.from(
    container.querySelectorAll<HTMLElement>('[data-testid="mrun-row"]'),
  ).find((el) => el.getAttribute("data-run-id") === id);
  expect(treffer, `keine Laufzeile für ${id} gerendert`).toBeTruthy();
  return treffer as HTMLElement;
}

// ══ R2 · KEIN ROHER SCHLÜSSEL, SONDERN DREI WÖRTER ══════════════════════════════════════════════
describe("JOB 3069 · R2 — extract/describe/group lesen sich als Wort", () => {
  it("R2a · in der ganzen Karte steht kein Text, der mit `mrun.task.` beginnt", async () => {
    stelleFetch([
      lauf({ id: "e", task: "extract" }),
      lauf({ id: "d", task: "describe" }),
      lauf({ id: "g", task: "group" }),
    ]);
    const container = await mounten();
    expect(
      karte(container).textContent ?? "",
      "ein Programmschlüssel steht auf dem Bildschirm — genau der Rotpunkt dieses Auftrags",
    ).not.toContain("mrun.task.");
  });

  it("R2b · und zwar stehen dort die drei Beschriftungen, je in ihrer eigenen Pille", async () => {
    stelleFetch([
      lauf({ id: "e", task: "extract" }),
      lauf({ id: "d", task: "describe" }),
      lauf({ id: "g", task: "group" }),
    ]);
    const container = await mounten();
    expect(zeile(container, "e").textContent).toContain("Extrahieren");
    expect(zeile(container, "d").textContent).toContain("Bild beschreiben");
    expect(zeile(container, "g").textContent).toContain("Gruppieren");
    // Und die Wörter sind die des Wörterbuchs, nicht zufällig gleichlautende.
    expect(zeile(container, "e").textContent).toContain(i18n.t("mrun.task.extract"));
    expect(zeile(container, "d").textContent).toContain(i18n.t("mrun.task.describe"));
    expect(zeile(container, "g").textContent).toContain(i18n.t("mrun.task.group"));
  });

  it("R2c · ALLE acht Arten tragen ein Wort — die Liste kommt aus der einen Quelle", async () => {
    // Kein viertes Abschreiben der acht Namen: die Läufe werden aus `REASONER_TASKS` erzeugt.
    stelleFetch(REASONER_TASKS.map((task, i) => lauf({ id: `t${i}`, task })));
    const container = await mounten();
    expect(karte(container).textContent ?? "").not.toContain("mrun.task.");
    REASONER_TASKS.forEach((task, i) => {
      const text = zeile(container, `t${i}`).textContent ?? "";
      const wort = i18n.t(`mrun.task.${task}`);
      expect(`${task}: ${wort}`).not.toContain("mrun.task.");
      expect(`${task} → ${text.includes(wort)}`).toBe(`${task} → true`);
    });
  });
});

// ══ R4 · EINE UNBEKANNTE ART BEKOMMT KEINEN ERFUNDENEN NAMEN ════════════════════════════════════
//
// JOB 3069 R2 (BEN, Korrekturpflicht 1): Runde 1 prüfte hier NUR den harmlosen Wert
// `zusammenfassen` und schloss daraus auf „nie ein `mrun.task.`-Rohtext". BENs Gegenprobe mit
// `task: "mrun.task.neu"` kippte den Fall sofort — die Karte reichte den Wert wörtlich durch. Der
// Wert vom Draht wird jetzt gar nicht mehr gerendert; die Fälle unten fahren BEINE Werte: den
// harmlosen UND den bösartigen.
describe("JOB 3069 · R4 — eine unbekannte Aufgabenart an der Fläche", () => {
  // BENs Wert steht bewusst an ERSTER Stelle: er ist der Fall, der Runde 1 rot gemacht hat.
  const UNBEKANNTE = ["mrun.task.neu", "zusammenfassen", "SUMMARIZE", ""] as const;

  it.each(UNBEKANNTE)(
    "R4e · task=%o · kein `mrun.task.`-Rohtext, kein geliehener Name einer bekannten Art",
    async (wert) => {
      const fremd = wert as unknown as ModelRunTask;
      stelleFetch([lauf({ id: "x", task: fremd }), lauf({ id: "e", task: "extract" })]);
      const container = await mounten();
      const z = zeile(container, "x");
      expect(
        z.textContent ?? "",
        "ein Programmschlüssel steht auf dem Bildschirm — genau BENs Rotpunkt aus Runde 1",
      ).not.toContain("mrun.task.");
      // Und der Wert vom Draht taucht auch sonst nirgends in der Zeile auf: die Fläche reicht
      // kein Maschinenwort durch, auch kein harmlos aussehendes.
      if (wert !== "") {
        expect(z.textContent ?? "").not.toContain(wert);
      }
      // Die Wissenslücke wird nicht geglättet: keine der acht Beschriftungen darf hier stehen.
      for (const task of REASONER_TASKS) {
        const wort = i18n.t(`mrun.task.${task}`);
        expect(`${task} geliehen: ${(z.textContent ?? "").includes(wort)}`).toBe(
          `${task} geliehen: false`,
        );
      }
    },
  );

  it.each(UNBEKANNTE)(
    "R4f · task=%o · stattdessen steht die Lücke als Satz da — und die Karte trägt weiter",
    async (wert) => {
      const fremd = wert as unknown as ModelRunTask;
      stelleFetch([lauf({ id: "x", task: fremd }), lauf({ id: "e", task: "extract" })]);
      const container = await mounten();
      expect(
        zeile(container, "x").querySelector('[data-testid="mrun-task-unbekannt"]')?.textContent,
      ).toBe(i18n.t("mrun.taskUnknown"));
      // Der bekannte Nachbar bleibt unberührt, und die Kopfzeile zählt beide Läufe.
      expect(zeile(container, "e").textContent).toContain(i18n.t("mrun.task.extract"));
      expect(karte(container).textContent).toContain(i18n.t("mrun.total", { n: 2 }));
    },
  );

  it("R4g · BENs Zählprobe an genau seinem Wert: total 1, unbekannt 1, alle acht Zähler 0", async () => {
    // Die Fläche und die Zählung derselben Daten in EINEM Fall — BENs Korrekturpflicht 1 verlangt
    // beides zusammen.
    stelleFetch([lauf({ id: "x", task: "mrun.task.neu" as unknown as ModelRunTask })]);
    const container = await mounten();
    expect(karte(container).textContent ?? "").not.toContain("mrun.task.");

    const s = summarizeModelRuns([
      lauf({ id: "x", task: "mrun.task.neu" as unknown as ModelRunTask }),
    ]);
    expect(s.total).toBe(1);
    expect(s.unbekannteArten).toBe(1);
    for (const task of REASONER_TASKS) {
      expect(`${task}=${s.byTask[task]}`).toBe(`${task}=0`);
    }
  });
});

// ══ R5 · DIE DREI SPRACHEN AN DER GEMOUNTETEN KARTE ═════════════════════════════════════════════
//
// JOB 3069 R2 (BEN, Korrekturpflicht 3): Runde 1 mass ausschliesslich Deutsch und schloss aus dem
// Diff auf EN und NL. Ein Diff ist kein Wirkungsnachweis — ein Schlüssel im falschen Sprachblock,
// ein Tippfehler im Namen oder ein Block, den `init` gar nicht lädt, fällt so nicht auf. Hier wird
// die Sprache wirklich umgeschaltet und der SICHTBARE Text gelesen.
//
// Die Erwartungen stehen ausgeschrieben und NICHT als `i18n.t(...)`: gegen den eigenen Übersetzer
// geprüft wäre die Zusage zirkulär (ein falsches Wort im Wörterbuch bliebe grün). Sie sind der
// wörtliche Soll-Text aus Lieferung 5 des Auftrags.
describe("JOB 3069 · R5 — die Beschriftungen stehen in allen drei Sprachen an der Fläche", () => {
  const SOLL = {
    de: {
      extract: "Extrahieren",
      describe: "Bild beschreiben",
      group: "Gruppieren",
      unbekannt: "Aufgabenart unbekannt",
    },
    en: {
      extract: "Extract",
      describe: "Describe image",
      group: "Group",
      unbekannt: "Task type unknown",
    },
    nl: {
      extract: "Extraheren",
      describe: "Afbeelding beschrijven",
      group: "Groeperen",
      unbekannt: "Taaktype onbekend",
    },
  } as const;

  it.each(["de", "en", "nl"] as const)(
    "R5 · %s: extract, describe und group lesen sich als Wort — kein Programmschlüssel",
    async (sprache) => {
      await i18n.changeLanguage(sprache);
      stelleFetch([
        lauf({ id: "e", task: "extract", locale: sprache }),
        lauf({ id: "d", task: "describe", locale: sprache }),
        lauf({ id: "g", task: "group", locale: sprache }),
      ]);
      const container = await mounten();
      expect(karte(container).textContent ?? "").not.toContain("mrun.task.");
      expect(zeile(container, "e").textContent).toContain(SOLL[sprache].extract);
      expect(zeile(container, "d").textContent).toContain(SOLL[sprache].describe);
      expect(zeile(container, "g").textContent).toContain(SOLL[sprache].group);
    },
  );

  it.each(["de", "en", "nl"] as const)(
    "R5 · %s: auch die unbekannte Art hat in dieser Sprache einen Satz, keinen Schlüssel",
    async (sprache) => {
      await i18n.changeLanguage(sprache);
      stelleFetch([lauf({ id: "x", task: "mrun.task.neu" as unknown as ModelRunTask })]);
      const container = await mounten();
      const text =
        zeile(container, "x").querySelector('[data-testid="mrun-task-unbekannt"]')?.textContent ??
        "";
      expect(text).not.toContain("mrun.task");
      // Ausgeschrieben statt `i18n.t(...)`: `fallbackLng` ist "de", ein FEHLENDER en/nl-Schlüssel
      // würde sonst still die deutsche Fassung zeigen und trotzdem grün bleiben.
      expect(text).toBe(SOLL[sprache].unbekannt);
    },
  );
});
