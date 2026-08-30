// @vitest-environment jsdom
// ================================================================================================
// JOB 2626 · D1 — WENN KLARA NICHT ANTWORTEN KANN, SAGT SIE WARUM: gemessen DORT, WO DER MENSCH LIEST.
// ================================================================================================
//
// Pedis Frage vom 27.08. bekam „Keine belastbare Grundlage." — ehrlich und unbrauchbar: drei Tore
// seines Dokuments waren gleichzeitig zu (nicht validiert, keine Stufe, kein Volltext), und der
// Satz nannte keines. Der Servicevertrag (`AskResult.verschlossen`) steht in der Schwesterdatei
// `job2626-klara-torlage-vertrag.test.ts`. DIESE Datei misst die Antwortflaeche selbst — die echte
// `Ask`-Seite, gemountet, mit einer Serverantwort, wie sie der Vertrag liefert.
//
// Warum an der Flaeche und nicht am Endpunkt: BEN in 2614 D4 — „`answered=true` plus KO in
// `sources` am API-Endpunkt ist ein Scheinbeleg." Der Beleg gehoert an die Stelle, wo der Mensch
// liest. Gemessen wird `textContent` (was Auge und Vorleseprogramm sehen), NICHT `title`-Attribute.
//
// Die Faelle:
//   S1 · Pedis Fall: drei Tore zu → alle drei stehen lesbar in der Antwortflaeche, beim Titel.
//   S2 · Nur EIN Tor zu → genau dieses eine, die beiden anderen NICHT (kein falsch benanntes Tor).
//   S3 · GEGENPROBE: ohne `verschlossen` (aelterer Server / nichts zu melden) bleibt die Flaeche wie
//        sie war — die generische Leermeldung, keine erfundene Torlage.
//   S4 · GEGENPROBE: bei einer ANTWORT erscheint keine Torlage, auch wenn der Server eine schickte.
//   S5 · Die Torlage haengt an GENAU EINER Frage: eine Folgefrage ohne Torlage raeumt sie weg.
//   S6 · Dieselben Worte wie Station 3 (JOB 2623): die Kurztexte sind die Torbegriffe der
//        Validierungsflaeche, damit ein Mensch in beiden Flaechen dasselbe liest.
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AskResponse } from "../../apps/web/src/api/types";

const bestand = vi.hoisted(() => ({
  kos: [] as unknown[],
  antwort: null as unknown,
}));

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ko: { list: vi.fn(async () => bestand.kos) },
    conflicts: { list: vi.fn(async () => []) },
    directory: { list: vi.fn(async () => []) },
    reasoner: {
      status: vi.fn(async () => ({
        active: true,
        mode: "cloud",
        reachable: "active",
        tasks: { answer: true },
      })),
    },
    ask: {
      ask: vi.fn(async () => bestand.antwort),
      helpful: vi.fn(),
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Ask } from "../../apps/web/src/pages/Ask";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

const TITEL = "Turbinenwartung Kesselhaus";

/** Die Nicht-Antwort, wie sie der Server liefert — `verschlossen` kommt je Fall dazu. */
function nichtAntwort(extra: Partial<AskResponse> = {}): AskResponse {
  return {
    result: {
      answered: false,
      answer: "",
      knowledgeClass: "luecke",
      trust: 0,
      sources: [],
      citedSources: [],
      steps: [],
      demo: false,
      captionSources: [],
    } as unknown as AskResponse["result"],
    gap: null,
    receipt: "r",
    ...extra,
  };
}

function antwort(extra: Partial<AskResponse> = {}): AskResponse {
  return {
    result: {
      answered: true,
      answer: "Zustaendigkeit liegt beim Schichtleiter.",
      knowledgeClass: "gesichert",
      trust: 90,
      sources: ["k1"],
      citedSources: ["k1"],
      steps: [],
      demo: false,
      captionSources: [],
    } as unknown as AskResponse["result"],
    gap: null,
    receipt: "r",
    ...extra,
  };
}

const DREI_ZU = {
  id: "k1",
  title: TITEL,
  status: "entwurf",
  freigabeFehlt: true,
  stufeFehlt: true,
  volltextFehlt: true,
};

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mountAsk(): Promise<{ container: HTMLElement; unmount: () => void }> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          MemoryRouter,
          { initialEntries: ["/fragen"] },
          createElement(ToastProvider, null, createElement(Ask)),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

/** Eine Frage tippen und absenden — der Weg, den auch Pedi geht. */
async function fragen(container: HTMLElement, frage: string): Promise<void> {
  const feld = container.querySelector<HTMLInputElement>("form input");
  expect(feld, "die Fragen-Seite hat kein Eingabefeld").not.toBeNull();
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(feld, frage);
    (feld as HTMLInputElement).dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(async () => {
    (container.querySelector("form") as HTMLFormElement).dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await flush();
  });
  await act(flush);
}

async function seite(serverAntwort: AskResponse): Promise<{
  container: HTMLElement;
  unmount: () => void;
}> {
  await i18n.changeLanguage("de");
  bestand.kos = [];
  bestand.antwort = serverAntwort;
  const s = await mountAsk();
  await fragen(s.container, "Welche Schutzausruestung ist bei der Turbinenwartung vorgeschrieben?");
  return s;
}

const TOR = {
  freigabe: (): string => i18n.t("ask.verschlossen.freigabe"),
  stufe: (): string => i18n.t("ask.verschlossen.stufe"),
  volltext: (): string => i18n.t("ask.verschlossen.volltext"),
};

function torlage(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('[data-testid="ask-verschlossen"]');
}

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("JOB 2626 · S — die Torlage steht dort, wo der Mensch liest", () => {
  it("S1 · Pedis Fall: drei Tore zu — alle drei stehen lesbar in der Antwortflaeche, beim Titel", async () => {
    const { container, unmount } = await seite(nichtAntwort({ verschlossen: [DREI_ZU] }));

    // Die Nicht-Antwort ist wirklich da — sonst misst der Fall an einer anderen Flaeche.
    expect(container.textContent ?? "").toContain(i18n.t("ask.noBasisTitle"));
    const lage = torlage(container);
    expect(
      lage,
      "die Torlage fehlt in der Antwortflaeche — der Mensch liest weiter nur die Leere",
    ).not.toBeNull();
    expect(
      lage?.closest('[data-testid="ask-result-anchor"]'),
      "die Torlage steht nicht an der Ergebnisflaeche",
    ).not.toBeNull();
    const text = lage?.textContent ?? "";
    expect(text, "der Titel des verschlossenen Dokuments fehlt").toContain(TITEL);
    // ALLE drei — eines zu nennen und zwei zu verschweigen, schickt in die falsche Richtung (§2).
    expect(text, "Tor „Freigabe“ fehlt").toContain(TOR.freigabe());
    expect(text, "Tor „Stufe“ fehlt").toContain(TOR.stufe());
    expect(text, "Tor „Volltext“ fehlt").toContain(TOR.volltext());
    // Der volle Satz je Tor haengt als Maus-Hinweis am Tor — vorhanden, aber KEIN Ersatz fuer
    // den lesbaren Kurztext (Kalibrierung: textContent sieht ihn nicht).
    const pillen = [...(lage?.querySelectorAll<HTMLElement>("[title]") ?? [])];
    expect(pillen.map((p) => p.title)).toEqual([
      i18n.t("ask.verschlossen.freigabeHint"),
      i18n.t("ask.verschlossen.stufeHint"),
      i18n.t("ask.verschlossen.volltextHint"),
    ]);
    expect(text).not.toContain(i18n.t("ask.verschlossen.freigabeHint"));
    unmount();
  });

  it("S2 · nur EIN Tor zu — genau dieses steht da, die beiden anderen NICHT", async () => {
    const { container, unmount } = await seite(
      nichtAntwort({
        verschlossen: [
          { ...DREI_ZU, status: "validiert", freigabeFehlt: false, stufeFehlt: false },
        ],
      }),
    );

    const text = torlage(container)?.textContent ?? "";
    expect(text).toContain(TITEL);
    expect(text).toContain(TOR.volltext());
    expect(text, "ein Tor wurde genannt, das nicht zu ist (§4: nichts erfinden)").not.toContain(
      TOR.freigabe(),
    );
    expect(text, "ein Tor wurde genannt, das nicht zu ist (§4: nichts erfinden)").not.toContain(
      TOR.stufe(),
    );
    unmount();
  });

  it("S3 · GEGENPROBE: ohne `verschlossen` bleibt die Leermeldung, wie sie war — nichts erfunden", async () => {
    const { container, unmount } = await seite(nichtAntwort());

    expect(container.textContent ?? "").toContain(i18n.t("ask.noBasisTitle"));
    expect(torlage(container), "eine Torlage ohne Grundlage — erfunden").toBeNull();
    const text = container.textContent ?? "";
    expect(text).not.toContain(TOR.freigabe());
    expect(text).not.toContain(TOR.stufe());
    expect(text).not.toContain(TOR.volltext());
    unmount();
  });

  it("S4 · GEGENPROBE: bei einer ANTWORT erscheint keine Torlage — auch wenn der Server eine schickte", async () => {
    bestand.kos = [
      {
        id: "k1",
        title: TITEL,
        statement: "Zustaendigkeit liegt beim Schichtleiter.",
        type: "best_practice",
        category: "Wartung",
        status: "validiert",
        trust: 90,
        author: "u1",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    await i18n.changeLanguage("de");
    bestand.antwort = antwort({ verschlossen: [DREI_ZU] });
    const { container, unmount } = await mountAsk();
    await fragen(container, `${TITEL} Zustaendigkeit`);

    expect(container.textContent ?? "").not.toContain(i18n.t("ask.noBasisTitle"));
    expect(
      torlage(container),
      "die Torlage gehoert zur Nicht-Antwort, nicht zur Antwort",
    ).toBeNull();
    unmount();
  });

  it("S5 · die Torlage haengt an GENAU EINER Frage — die Folgefrage ohne Torlage raeumt sie weg", async () => {
    const { container, unmount } = await seite(nichtAntwort({ verschlossen: [DREI_ZU] }));
    expect(torlage(container)).not.toBeNull();

    bestand.antwort = nichtAntwort();
    await fragen(container, "Wer wartet die Turbine?");
    expect(
      torlage(container),
      "die Torlage der ERSTEN Frage steht neben dem Ergebnis der ZWEITEN",
    ).toBeNull();
    unmount();
  });

  it("S6 · dieselben Worte wie Station 3: die Kurztexte sind die Torbegriffe der Validierungsflaeche", async () => {
    // Der Auftrag (§2) nennt die Torbegriffe von Station 3 (JOB 2623, PRO2) als „Freigabe fehlt"
    // und „Stufe fehlt". GRENZE, ehrlich: Station 3 steht auf dem Basisstand 71d3c2b NICHT im Baum
    // (`Validation.tsx` ist fuer 2623 D3 gesperrt, ein grep nach beiden Texten findet dort nichts)
    // — gepinnt wird deshalb der Wortlaut aus dem Auftrag, nicht eine gemessene Gleichheit mit
    // der Validierungsflaeche. Wer eines der beiden umbenennt, muss es an BEIDEN Stellen tun.
    await i18n.changeLanguage("de");
    expect(TOR.freigabe()).toBe("Freigabe fehlt");
    expect(TOR.stufe()).toBe("Stufe fehlt");
    // Und die drei Saetze aus §2 des Auftrags — woertlich, als Maus-Hinweis je Tor.
    expect(i18n.t("ask.verschlossen.freigabeHint")).toBe(
      "Das Dokument ist noch nicht freigegeben.",
    );
    expect(i18n.t("ask.verschlossen.stufeHint")).toBe(
      "Für das Dokument ist keine Vertraulichkeitsstufe gesetzt.",
    );
    expect(i18n.t("ask.verschlossen.volltextHint")).toBe(
      "Von diesem Dokument liegt noch kein durchsuchbarer Text vor.",
    );
  });
});
