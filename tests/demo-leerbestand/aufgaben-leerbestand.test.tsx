// @vitest-environment jsdom
// ================================================================================================
// JOB 3762 · L4 — „KEINE AUFGABEN, WEIL ES NOCH NICHTS GIBT" AUF EINER FRISCH AUFGESETZTEN INSTANZ.
// ================================================================================================
//
// BEFUND VOR DEM BAU, wie bei der Bibliothek: die Zusage aus Lieferung 4 war auf `/aufgaben`
// BEREITS GEBAUT. `pages/MyTasks.tsx` unterscheidet vier Lagen an EINER Stelle —
//
//     ladephase === "loading" ? t("state.loading")
//       : ladephase === "error" ? t("loadstate.error.title")
//         : taskFilter === "all" ? t("task.none")
//           : t("task.noneFiltered")
//
// — und der erste Schritt liegt hinter dem Knopf „Wie geht es weiter?" (`task-wie-weiter`, dahinter
// die vorhandenen `EmptyStateCtas`). Die Ladephase kommt aus dem gemeinsamen Vertrag
// `lib/loadingState.ts` über GENAU die Quellen der Liste. Auch die Tests dazu gibt es:
// `tests/aufgaben-ansicht/leerzustand-nur-mit-daten.test.tsx` (E1–E8, JOB 3101).
//
// DIESER AUFTRAG BAUT DAS NICHT ZUM ZWEITEN MAL (Lieferung 6). Was hier hinzukommt und dort fehlt,
// ist die Sicht der LEEREN INSTANZ: dass der Leersatz auch dann steht, wenn es NICHTS gibt — nicht
// nur, wenn nichts OFFEN ist — und dass der erste Schritt daran hängt. Dazu die drei Sprachen, die
// E1–E8 nicht messen.
//
// Der gefilterte Fall (L4b) ist der Zwilling von L3b in der Bibliothek: „es gibt nichts" und „diese
// Auswahl ist leer" sind zwei Sätze. Vertauscht man sie, werden L4 und L4b rot.
//
// ------------------------------------------------------------------------------------------------
// RUNDE 2 — WARUM DIESE DATEI JETZT GEGEN `endpoints` MOCKT UND NICHT MEHR GEGEN `api/hooks`.
// ------------------------------------------------------------------------------------------------
// BENS BEFUND AN RUNDE 1, Prüfpunkt 3 (Nutzenkette) und Prüfpunkt 6 (Prüflücken): „Bibliothek und
// Aufgaben mocken bereits die Hooks" und „es fehlen die Übergänge von leerem Cache zu laufender,
// gescheiterter und pausierter Auffrischung. Testvorschlag: echte QueryClients verwenden."
// Ein gemockter Hook kennt weder `isFetching` noch `isPaused` noch einen Refetch — die Übergänge
// aus §9 sind damit gar nicht darstellbar, und die Kette begann hinter dem Ladevertrag statt an der
// Drahtantwort. Jetzt ist nur der Wire gesetzt (dieselbe Hausform wie `start-leere-instanz.test.tsx`
// und `tests/d1-meine-entwuerfe/start-zugang-meine-entwuerfe.test.tsx`): echte Hooks, echter
// `QueryClient`, echte Lagen. L5-Auf-c/-d messen dadurch, was vorher nicht messbar war.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Eine anliegende Validierungsaufgabe — so vollständig, wie die Zeile sie liest. */
const AUFGABE = {
  id: "ko-1",
  title: "Ventil V1 prüfen",
  status: "offen",
  author: "u1",
  originalAuthor: "u1",
};

const box = vi.hoisted(() => ({
  /** `GET /api/validation/board` — die anliegenden Validierungsaufgaben. */
  board: (async () => []) as () => Promise<unknown>,
  /** `GET /api/conflicts` — L5-Auf-a/-b verstellen sie. */
  conflicts: (async () => []) as () => Promise<unknown>,
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      validation: {
        board: vi.fn(() => box.board()),
        settings: ok({ defaultNeededValidations: 3 }),
      },
      conflicts: { list: vi.fn(() => box.conflicts()) },
      lifecycle: { pending: ok([]) },
      gaps: { list: ok([]), summary: ok({ open: 0, byPriority: {} }) },
      audit: { list: ok([]) },
      ko: { list: ok([]) },
      directory: { list: ok([{ id: "u1", name: "Pia", email: "p@x.de", role: "editor" }]) },
    },
  };
});
vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u1", role: "experte" } }),
}));
vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte", stufe2: false }),
}));
vi.mock("../../apps/web/src/app/ToastContext", () => ({ useToast: () => ({ push: () => {} }) }));

import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import { MyTasks } from "../../apps/web/src/pages/MyTasks";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/** Derselbe `QueryClient` über zwei Mounts hinweg ist der Weg zum Zwischenspeicher (L5-Auf-d). */
async function mount(adresse = "/aufgaben", gemeinsam?: QueryClient): Promise<QueryClient> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const neu = createRoot(container);
  root = neu;
  const qc = gemeinsam ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    neu.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: [adresse] }, createElement(MyTasks)),
      ),
    );
    await flush();
  });
  await act(flush);
  return qc;
}

function abbauen(): void {
  act(() => root?.unmount());
  container.remove();
  root = null;
}

const text = (): string => (container.textContent ?? "").replace(/\s+/g, " ");
const weiterKnopf = (): HTMLElement | null =>
  container.querySelector<HTMLElement>('[data-testid="task-wie-weiter"]');
const standHinweis = (): HTMLElement | null =>
  container.querySelector<HTMLElement>('[data-testid="task-stand-veraltet"]');

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.board = async () => [];
  box.conflicts = async () => [];
});

afterEach(() => {
  onlineManager.setOnline(true);
  if (root) {
    act(() => root?.unmount());
  }
  container?.remove();
  root = null;
});

describe("JOB 3762 · L4 · die leere Instanz auf `/aufgaben`", () => {
  it("VORBEDINGUNG: die Oberfläche läuft auf Deutsch", () => {
    expect(i18n.language).toBe("de");
  });

  it("L4 · alle Quellen erfolgreich und leer ⇒ der Leersatz UND der Weg zum ersten Schritt", async () => {
    await mount();
    expect(text()).toContain(i18n.t("task.none"));
    expect(weiterKnopf(), "ohne ihn sagte die Fläche nur, dass nichts ist").not.toBeNull();
    // Und nichts behauptet, der Stand sei nicht frisch — er ist es.
    expect(standHinweis()).toBeNull();
  });

  it("L4-EN/NL · derselbe Satz in allen drei Sprachen", async () => {
    for (const sprache of ["en", "nl"]) {
      await i18n.changeLanguage(sprache);
      await mount();
      const satz = i18n.t("task.none");
      expect(satz, `Schlüssel fehlt in ${sprache}`).not.toBe("task.none");
      expect(text(), sprache).toContain(satz);
      abbauen();
    }
  });

  it("L4b · Bestand VORHANDEN, Filter ohne Treffer ⇒ der ANDERE Satz, und kein „Wie geht es weiter?“", async () => {
    // Eine Validierungsaufgabe liegt an; der Filter „Konflikt" trifft sie nicht.
    box.board = async () => [AUFGABE];
    await mount("/aufgaben?art=conflict");
    expect(text()).toContain(i18n.t("task.noneFiltered"));
    expect(text(), "„Nichts offen.“ wäre hier falsch — es ist etwas offen").not.toContain(
      i18n.t("task.none"),
    );
    // Der erste Schritt ist hier die falsche Auskunft: offen IST etwas, nur nicht in dieser Auswahl.
    expect(weiterKnopf()).toBeNull();
  });

  it("L4c · GEGENPROBE MIT BESTAND: mit Aufgaben steht gar kein Leersatz da", async () => {
    box.board = async () => [AUFGABE];
    await mount();
    expect(text()).not.toContain(i18n.t("task.none"));
    expect(text()).not.toContain(i18n.t("task.noneFiltered"));
    expect(text()).toContain("Ventil V1 prüfen");
  });
});

describe("JOB 3762 · L5 · `/aufgaben` behauptet nichts ohne Grundlage", () => {
  it("L5-Auf-a · eine Quelle im Fehler ⇒ kein Leersatz, sondern der Fehlerhinweis", async () => {
    box.conflicts = async () => {
      throw new Error("500");
    };
    await mount();
    expect(text(), "ein Fehler ist keine Leere").not.toContain(i18n.t("task.none"));
    expect(text()).toContain(i18n.t("loadstate.error.title"));
    expect(weiterKnopf()).toBeNull();
  });

  it("L5-Auf-b · eine Quelle lädt noch ⇒ kein Leersatz, sondern der Ladezustand", async () => {
    box.conflicts = () => new Promise(() => {});
    await mount();
    expect(text()).not.toContain(i18n.t("task.none"));
    expect(text()).toContain(i18n.t("state.loading"));
    expect(weiterKnopf()).toBeNull();
  });

  // ----------------------------------------------------------------------------------------------
  // L5-Auf-c — DIE ZWEITE HÄLFTE VON REGELN §7, DIE HIER BIS RUNDE 2 FEHLTE.
  // ----------------------------------------------------------------------------------------------
  // Der Ladevertrag hält die Gruppe bei einem gescheiterten Nachlauf bewusst auf `loaded`: die
  // Werte bleiben sichtbar, die Liste schlägt nicht auf „Nichts offen." um. Nur stand „Nichts
  // offen." dadurch UNMARKIERT da, obwohl der letzte Versuch, das nachzuprüfen, gescheitert war —
  // eine Tatsachenaussage über JETZT aus einem Stand von vorhin (Auftrag §9, „Cache mit
  // gescheiterter Auffrischung"). Jetzt trägt die Fläche dafür den vorhandenen `StaleMarker`.
  it("L5-Auf-c · leer bestätigt, dann Auffrischung GESCHEITERT ⇒ der Leersatz bleibt, markiert", async () => {
    const qc = await mount();
    expect(text(), "Vorbedingung: der Stand ist bestätigt leer").toContain(i18n.t("task.none"));
    expect(standHinweis(), "Vorbedingung: noch nichts zu markieren").toBeNull();

    box.conflicts = async () => {
      throw new Error("500");
    };
    await act(async () => {
      void qc.invalidateQueries({ queryKey: ["conflicts"] });
      await flush();
    });
    // Zweite Runde: der Fehlschlag steht im Speicher, der Neuanstrich der Fläche folgt ihm erst im
    // nächsten Durchlauf. Unter Last (vier Worker) war eine Runde zu wenig — gemessen an genau
    // diesem Fall, der einzeln grün und im Sammellauf rot war.
    await act(flush);
    // KALIBRIERUNG: der Nachlauf ist wirklich gescheitert und die Daten sind wirklich noch da.
    expect(qc.getQueryState(["conflicts"])?.status).toBe("error");
    expect(qc.getQueryState(["conflicts"])?.data).toEqual([]);

    expect(text(), "REGELN §7: ein gescheiterter Nachlauf leert die Liste nicht").toContain(
      i18n.t("task.none"),
    );
    expect(standHinweis(), "und er sagt, dass der Stand nicht mehr frisch ist").not.toBeNull();
    expect(text()).toContain(i18n.t("loadstate.stale"));
  });

  // ----------------------------------------------------------------------------------------------
  // L5-Auf-d — BENANNTER RESTFALL, gemessen und ABSICHTLICH nicht grün gebogen.
  // ----------------------------------------------------------------------------------------------
  // Offline RUHT jeder Abruf (`fetchStatus: "paused"`), er scheitert nicht. `isGroupStale()`
  // (`lib/loadingState.ts`) kennt nur `isError` und wird deshalb nicht wahr — „Nichts offen." steht
  // ohne Markierung da. Der richtige Satz wäre einer über die VERBINDUNG, wie ihn die Startseite
  // (`kollision.lage.pausiert`) und die Bibliothek (`lib.liste.offline`) führen; dafür fehlt ein
  // Offline-Bauteil neben `StaleMarker` in `components/LoadState.tsx` — ausserhalb der Zielpfade
  // dieses Auftrags (§4). Dieser Fall hält den Ist-Zustand fest, damit er nicht unbemerkt bleibt;
  // wird er behoben, wird er rot und ist umzudrehen, nicht zu löschen.
  it("L5-Auf-d · offline mit bestätigtem Leerstand ⇒ der Leersatz bleibt, aber OHNE Markierung (Ist-Zustand)", async () => {
    const qc = await mount();
    expect(text(), "Vorbedingung").toContain(i18n.t("task.none"));
    abbauen();
    onlineManager.setOnline(false);
    try {
      await mount("/aufgaben", qc);
      // Die Werte bleiben — das ist richtig (REGELN §7).
      expect(text()).toContain(i18n.t("task.none"));
      // Und das ist der Mangel: keine Einordnung des Stands.
      expect(standHinweis(), "Ist-Zustand, kein Sollzustand").toBeNull();
    } finally {
      onlineManager.setOnline(true);
    }
  });
});
