// @vitest-environment jsdom
// ================================================================================================
// LADE-, LEER- UND FEHLERZUSTÄNDE · `QueryState` (components/ui.tsx) AN EINEM ECHTEN QUERYCLIENT.
// ================================================================================================
//
// `QueryState` ist die gemeinsame Zustandshülle von Risiko, Auswertung, Stufe 2, Wissensnetz,
// Nachbarschaft, Bereichsprofil, Risikohorizont und „An Artikel anhängen". Drei Lagen sagten dort
// bis hierher nicht die Wahrheit:
//
//   · Eine RUHENDE erste Anfrage (`fetchStatus: "paused"`, etwa ohne Netz) hat `isLoading: false`,
//     `isError: false` und keine Daten — sie fiel in den Leerzweig und behauptete „Nichts
//     vorhanden.", obwohl nie eine Antwort kam (R-0954 / R-0963: „lädt" bzw. kein „nichts gefunden").
//   · Ein ERSTFEHLER nannte nur die Meldung, aber keinen Weg (R-1015: „sagen, was der Nutzer jetzt
//     tun kann").
//   · Eine gescheiterte AUFFRISCHUNG ersetzte den sichtbaren Bestand durch die Fehlerfläche
//     (R-0956: Fehler kosten nichts; dieselbe Regel wie `lib/abfrageBestand.ts`).
//
// Gemessen wird gegen den echten `QueryClient` und den echten `onlineManager` — ein gemockter Hook
// kennt weder `fetchStatus` noch einen Refetch. Jeder Fall hält zugleich die Gegenrichtung fest:
// wirklich leerer Bestand bleibt beim heutigen Leersatz, laufender Abruf bleibt „Lädt …".
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
  useQuery,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { ApiError } from "../../apps/web/src/api/client";
import { QueryState } from "../../apps/web/src/components/ui";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LEERSATZ = "LEERSATZ-DER-FLAECHE";

/** Die Drahtantwort; jeder Fall setzt sie selbst. */
let antwort: () => Promise<string[]> = async () => [];

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function Pruefling(): ReturnType<typeof createElement> {
  const query = useQuery({ queryKey: ["querystate-probe"], queryFn: () => antwort() });
  return createElement(QueryState, {
    query,
    emptyText: LEERSATZ,
    // `createElement` leitet den Typparameter von `QueryState` nicht ab (er bleibt `unknown`); die
    // Abfrage liefert hier aber immer `string[]`.
    children: (zeilen: unknown) =>
      createElement(
        "ul",
        { "data-testid": "bestand" },
        (zeilen as string[]).map((z) => createElement("li", { key: z }, z)),
      ),
  });
}

async function mount(): Promise<QueryClient> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const neu = createRoot(container);
  root = neu;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    neu.render(createElement(QueryClientProvider, { client: qc }, createElement(Pruefling)));
    await flush();
  });
  await act(flush);
  return qc;
}

const text = (): string => (container.textContent ?? "").replace(/\s+/g, " ");
const bestand = (): string[] =>
  Array.from(container.querySelectorAll('[data-testid="bestand"] li')).map(
    (li) => li.textContent ?? "",
  );
const wiederholknopf = (): HTMLButtonElement | undefined =>
  Array.from(container.querySelectorAll("button")).find((b) =>
    (b.textContent ?? "").includes(i18n.t("loadstate.error.retry")),
  );

async function klick(knopf: HTMLButtonElement | undefined): Promise<void> {
  expect(knopf, "Vorbedingung: der Wiederholen-Knopf steht da").toBeDefined();
  await act(async () => {
    knopf?.click();
    await flush();
  });
  await act(flush);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  antwort = async () => [];
});

afterEach(async () => {
  onlineManager.setOnline(true);
  if (root) {
    act(() => root?.unmount());
  }
  container?.remove();
  root = null;
  await i18n.changeLanguage("de");
});

describe("QueryState · laden und wirklich leer bleiben, was sie waren", () => {
  it("L1 · solange der Abruf läuft, steht „Lädt …“ — kein Leersatz, kein Bestand", async () => {
    antwort = () => new Promise<string[]>(() => {});
    await mount();
    expect(text()).toContain(i18n.t("state.loading"));
    expect(text()).not.toContain(LEERSATZ);
    expect(bestand()).toEqual([]);
  });

  it("L2 · eine erfolgreiche LEERE Antwort zeigt den heutigen Leersatz der Fläche", async () => {
    antwort = async () => [];
    await mount();
    expect(text()).toContain(LEERSATZ);
    expect(text()).not.toContain(i18n.t("state.loading"));
    expect(wiederholknopf()).toBeUndefined();
  });
});

describe("QueryState · ruhende erste Anfrage ist kein leerer Bestand", () => {
  it("P1 · offline vor der ersten Antwort ⇒ „Noch keine Antwort vom Server.“, kein „Nichts vorhanden.“", async () => {
    antwort = async () => ["Eintrag A"];
    onlineManager.setOnline(false);
    const qc = await mount();
    // KALIBRIERUNG: die Abfrage ruht wirklich — sie lädt nicht und ist nicht gescheitert.
    expect(qc.getQueryState(["querystate-probe"])?.fetchStatus).toBe("paused");
    expect(qc.getQueryState(["querystate-probe"])?.status).toBe("pending");

    expect(text()).toContain(i18n.t("wissensnetz.keineAntwort"));
    expect(text()).not.toContain(LEERSATZ);
    expect(text()).not.toContain(i18n.t("state.empty"));
    expect(bestand()).toEqual([]);

    // Wieder online: die ruhende Anfrage läuft weiter, der Bestand kommt.
    await act(async () => {
      onlineManager.setOnline(true);
      await flush();
    });
    await act(flush);
    expect(bestand()).toEqual(["Eintrag A"]);
    expect(text()).not.toContain(i18n.t("wissensnetz.keineAntwort"));
  });
});

describe("QueryState · Erstfehler sagt, was man jetzt tun kann", () => {
  it("F1 · ohne Daten: Meldung UND „Erneut versuchen“; der Knopf ruft wirklich neu ab", async () => {
    let aufrufe = 0;
    antwort = async () => {
      aufrufe += 1;
      if (aufrufe === 1) {
        throw new Error("Draht: gestört");
      }
      return ["Eintrag B"];
    };
    await mount();
    expect(text()).toContain(i18n.t("state.error"));
    expect(text()).not.toContain(LEERSATZ);
    expect(bestand()).toEqual([]);

    await klick(wiederholknopf());
    expect(aufrufe, "der Knopf löst einen echten zweiten Abruf aus").toBe(2);
    expect(bestand()).toEqual(["Eintrag B"]);
    expect(text()).not.toContain(i18n.t("state.error"));
    expect(wiederholknopf()).toBeUndefined();
  });

  it("F2 · die Servermeldung eines ApiError bleibt erhalten, der Weg kommt hinzu", async () => {
    antwort = async () => {
      throw new ApiError(503, "unavailable", "Dienst gerade nicht erreichbar");
    };
    await mount();
    expect(text()).toContain("Dienst gerade nicht erreichbar");
    expect(wiederholknopf()).toBeDefined();
  });

  it("F3 · EN: der Weg ist übersetzt", async () => {
    await i18n.changeLanguage("en");
    antwort = async () => {
      throw new Error("wire down");
    };
    await mount();
    expect(text()).toContain(i18n.t("state.error"));
    const knopf = wiederholknopf();
    expect(knopf?.textContent ?? "").toContain("Try again");
  });
});

describe("QueryState · gescheiterte Auffrischung kostet den Bestand nicht", () => {
  it("S1 · Bestand bleibt sichtbar, darüber „Veraltet – Aktualisierung fehlgeschlagen“ mit Wiederholweg", async () => {
    antwort = async () => ["Eintrag C"];
    const qc = await mount();
    expect(bestand()).toEqual(["Eintrag C"]);
    expect(text()).not.toContain(i18n.t("loadstate.stale"));

    antwort = async () => {
      throw new Error("Draht: Auffrischung gestört");
    };
    await act(async () => {
      void qc.refetchQueries({ queryKey: ["querystate-probe"] });
      await flush();
    });
    await act(flush);
    // KALIBRIERUNG: react-query hält Fehler UND Daten zugleich.
    expect(qc.getQueryState(["querystate-probe"])?.status).toBe("error");

    expect(bestand(), "der Bestand bleibt").toEqual(["Eintrag C"]);
    expect(text()).toContain(i18n.t("loadstate.stale"));
    expect(text()).not.toContain(i18n.t("state.error"));

    antwort = async () => ["Eintrag C", "Eintrag D"];
    await klick(wiederholknopf());
    expect(bestand()).toEqual(["Eintrag C", "Eintrag D"]);
    expect(text()).not.toContain(i18n.t("loadstate.stale"));
  });
});
