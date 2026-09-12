// @vitest-environment jsdom
// ================================================================================================
// JOB 3762 · DIE LEERE INSTANZ SAGT, DASS SIE LEER IST — UND DIE STARTSEITE FÄLLT DABEI NICHT UM.
// ================================================================================================
//
// Die Demo startet gegen eine garantiert LEERE Datenhaltung (Pedis Zeile DEMO-ZUGANG-START:
// „eigene, garantiert LEERE Datenhaltung"). Genau dieser Zustand ist der einzige, den im Alltag
// niemand sieht — und deshalb der, in dem die Oberfläche am schlechtesten aussah.
//
// WARUM DIESE TESTS GEGEN `endpoints` MOCKEN UND NICHT GEGEN `api/hooks`: L1 ist ein Fehler im
// LESEN DER DRAHTANTWORT. Ein gemockter Hook läge hinter der Stelle, an der er entsteht; der Fall
// wäre dann nicht mehr „der Server einer leeren Instanz antwortet `{}`", sondern „jemand reicht der
// Seite ein `{}`". Die Hausform dafür steht in `tests/d1-meine-entwuerfe/start-zugang-meine-
// entwuerfe.test.tsx` — echte Hooks, echter QueryClient, nur der Wire ist gesetzt.
//
// DIE FÄLLE
//   L1  · `gaps.summary` antwortet erfolgreich mit `{}` → die Seite STEHT (vorher warf
//         `data?.byPriority.hoch`, und `?? 0` kam nie zum Zug) und behauptet keine Lücken.
//   L2  · alles erfolgreich und leer → der Satz mit dem ersten Schritt, in DE, EN und NL.
//   L2c · und er ERSETZT „Nichts offen." (Auftrag §8 Punkt 7 — Ablösung, kein zweiter Satz daneben).
//   L2d · die Zahl-Pille bleibt aus: „noch nichts da" ist kein offener Vorgang.
//   L2e · GEGENPROBE MIT BESTAND — mit Wissensobjekten steht der Satz NICHT da (Prüfpunkt 6b).
//   L2f · DER ECHTE ERSTBESUCH — Admin OHNE Vermerk im Speicher. Beide Führungszeilen stehen.
//   L5a · gescheiterter Abruf (500) → kein Leersatz, keine Verneinung. Die Störung ist sichtbar.
//   L5b · laufender Abruf → dasselbe. „Es ist nichts da" und „ich weiß es nicht" sind zwei Sätze.
//   L5c/L5c2 · offline MIT und OHNE bestätigten Stand, L5d · laufende Auffrischung,
//         L5e · gescheiterte Auffrischung — damit zu JEDEM Zustand aus §9 ein benannter Fall gehört
//         (LEHREN.md, Vorgabe an §9-Aufträge).
//
// ------------------------------------------------------------------------------------------------
// RUNDE 2 — WAS BEN AN RUNDE 1 GEMESSEN HAT, UND WAS DIESE DATEI DESHALB JETZT ANDERS VERLANGT.
// ------------------------------------------------------------------------------------------------
// 1. „Erfolgreich leer geladen, anschließend KO-Auffrischung angehalten; `fetchStatus === 'fetching'`
//    bestätigt → Karteninhalt `\"\"`." Runde 1 hat das mit L5d ausdrücklich FESTGESCHRIEBEN — der
//    Fall verlangte wörtlich das Verschwinden des Leersatzes und sicherte damit das Gegenteil von
//    §9 („War der Cache leer, bleibt der Leersatz stehen, ohne zu flackern"). L5c, L5d und L5e sind
//    deshalb umgedreht: der BESTÄTIGTE Stand bleibt sichtbar und wird eingeordnet. Was bleibt, ist
//    die Zusage dahinter — OHNE vorherigen Erfolg entsteht keine Leeraussage; dafür steht jetzt L5c2
//    (kalter Offline-Einstieg ohne jeden Stand) neben L5a/L5b.
// 2. „Der Start-Test setzt vor jedem Fall den Erstbesuchsvermerk." Damit lief kein einziger Fall
//    gegen den Besuch, für den dieser Auftrag gebaut ist. Der Vermerk bleibt in `beforeEach` — er
//    hält die anderen Fälle frei von der zweiten Zeile —, und L2f nimmt ihn ausdrücklich weg.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Ein Wissensobjekt, so schmal wie die Startseite es liest (Titel + Kennung). */
const EIN_KO = {
  id: "ko-1",
  title: "Ventil V1 prüfen",
  status: "validiert",
  author: "u1",
  version: 1,
  history: [],
};

const box = vi.hoisted(() => ({
  /** Die Antwort auf `GET /api/gaps/summary` — L1 setzt sie auf `{}`. */
  summary: (async () => ({
    open: 0,
    byPriority: { hoch: 0, mittel: 0, niedrig: 0 },
  })) as () => Promise<unknown>,
  /** Die Antwort auf `GET /api/ko` — der Bestand. */
  kos: (async () => []) as () => Promise<unknown>,
  /** Die Antwort auf `GET /api/validation/board` — L5a/L5b verstellen sie. */
  board: (async () => []) as () => Promise<unknown>,
}));

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  RoleProvider: ({ children }: { children: unknown }) => children,
  useRole: () => ({
    role: "admin",
    stufe2: false,
    setRole: () => {},
    setStufe2: () => {},
    isSessionRole: true,
    canPreview: false,
    previewActive: false,
  }),
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      validation: {
        board: vi.fn(() => box.board()),
        settings: ok({ defaultNeededValidations: 3 }),
      },
      conflicts: { list: ok([]) },
      lifecycle: { pending: ok([]) },
      gaps: { summary: vi.fn(() => box.summary()), list: ok([]) },
      notifications: { list: ok([]) },
      learningPaths: { byRole: ok(null), progress: ok(null) },
      duplicateSignal: { list: ok([]) },
      livewall: { get: ok({ saved: [], helped: [], helpedToday: 0 }) },
      ko: { list: vi.fn(() => box.kos()) },
      directory: { list: ok([{ id: "u1", name: "Pia", email: "p@x.de", role: "editor" }]) },
      analytics: { overview: ok({ total: 0, byStatus: { offen: 0, validiert: 0 } }) },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { markStartOrientationSeen } from "../../apps/web/src/lib/startOrientation";
import { Start } from "../../apps/web/src/pages/Start";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/**
 * Der Zwischenspeicher bleibt über einen Mount hinweg erhalten, wenn derselbe `QueryClient`
 * gereicht wird — das ist der Weg zur Lage `veraltet` (L5c): erst online leer laden, dann das Netz
 * trennen und am SELBEN Speicher neu betreten. Die Hausform steht in
 * `tests/kollision-netztrennung/start-fuerdich-offline.test.tsx` (S-6/S-9).
 */
async function mount(gemeinsam?: QueryClient): Promise<QueryClient> {
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
        createElement(
          AuthProvider,
          null,
          createElement(
            ToastProvider,
            null,
            createElement(
              NavGuardProvider,
              null,
              createElement(MemoryRouter, { initialEntries: ["/start"] }, [
                createElement(Start, { key: "s" }),
              ]),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  // Zwei Runden: die Sitzung löst in zwei Stufen auf (`/auth/status`, dann `/auth/me`).
  await act(flush);
  await act(flush);
  return qc;
}

/** Den Baum abbauen, ohne den Zwischenspeicher wegzuwerfen. */
function abbauen(): void {
  act(() => root?.unmount());
  container.remove();
  root = null;
}

/** Die Karte „FÜR DICH" — dort steht die Zeile, um die es geht. */
function karte(): HTMLElement {
  const el = container.querySelector<HTMLElement>('[data-testid="h5-fuerdich"]');
  if (!el) {
    throw new Error("Die Karte „FÜR DICH“ fehlt — die Startseite steht nicht.");
  }
  return el;
}

const kartentext = (): string => (karte().textContent ?? "").replace(/\s+/g, " ");

/** Die Zeile des ersten Schritts — ihr Meta-Platz trägt die Einordnung des Datenstands. */
function ersterSchrittZeile(): HTMLElement | null {
  for (const el of karte().querySelectorAll<HTMLElement>('[data-testid="h5-fuerdich-zeile"]')) {
    if ((el.textContent ?? "").includes(i18n.t("start.leer.ersterSchritt"))) {
      return el;
    }
  }
  return null;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  // Ohne den Vermerk stünde die Erststart-Zeile für die Admin-Rolle in der Karte — sie ist eine
  // eigene Führungszeile (§5a von JOB 3064) und hätte mit dem leeren Bestand nichts zu tun. L2f
  // nimmt ihn ausdrücklich weg und misst genau diesen Besuch (Bens Korrekturpflicht 2).
  window.localStorage.clear();
  markStartOrientationSeen(window.localStorage);
  box.summary = async () => ({ open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } });
  box.kos = async () => [];
  box.board = async () => [];
});

afterEach(() => {
  onlineManager.setOnline(true);
  if (root) {
    act(() => root?.unmount());
  }
  container?.remove();
  root = null;
});

describe("JOB 3762 · L1 · der Absturzpfad in `Start.tsx`", () => {
  it("VORBEDINGUNG: die Oberfläche läuft auf Deutsch", () => {
    expect(i18n.language).toBe("de");
  });

  it("L1 · `gaps.summary` antwortet erfolgreich mit `{}` — die Startseite STEHT", async () => {
    box.summary = async () => ({});
    await mount();
    // Vorher warf `gapsSummary.data?.byPriority.hoch`: der Optional-Zugriff endete vor
    // `byPriority`, der Mount brach ab, und die Demo war beim ersten Öffnen weiss.
    expect(container.querySelector('[data-testid="page-start"]')).not.toBeNull();
    expect(karte()).not.toBeNull();
  });

  it("L1b · und sie behauptet dabei keine kritischen Lücken", async () => {
    box.summary = async () => ({});
    await mount();
    // Aus `0` entsteht keine Zeile (`forYouZeilen` lässt `count <= 0` aus) — also steht dort weder
    // eine Zahl noch ein Satz über Lücken. `0` ist ein Zählwert, keine Aussage.
    expect(kartentext()).not.toContain(i18n.t("work.criticalGaps"));
  });

  it("L1c · ein vorhandenes Summary wird weiterhin gelesen (der Fall, der nicht verloren gehen darf)", async () => {
    box.summary = async () => ({ open: 3, byPriority: { hoch: 3, mittel: 0, niedrig: 0 } });
    await mount();
    expect(kartentext()).toContain(i18n.t("work.criticalGaps"));
    // Und dann ist der Bestand nicht das Thema: es wartet etwas.
    expect(kartentext()).not.toContain(i18n.t("start.leer.ersterSchritt"));
  });
});

describe("JOB 3762 · L2 · der erste Blick in eine leere Demo", () => {
  it("L2 · alles erfolgreich und leer ⇒ der Satz nennt den Zustand UND den ersten Schritt", async () => {
    await mount();
    expect(kartentext()).toContain(i18n.t("start.leer.ersterSchritt"));
  });

  it("L2b · derselbe Satz auf Englisch und Niederländisch", async () => {
    for (const sprache of ["en", "nl"]) {
      await i18n.changeLanguage(sprache);
      await mount();
      const satz = i18n.t("start.leer.ersterSchritt");
      expect(satz, `Schlüssel fehlt in ${sprache}`).not.toBe("start.leer.ersterSchritt");
      expect(kartentext(), sprache).toContain(satz);
      abbauen();
    }
  });

  it("L2c · ABLÖSUNG: der schwächere Satz „Nichts offen.“ steht nicht daneben", async () => {
    await mount();
    expect(kartentext(), "zwei Leersätze in einer Karte wären zwei Auskünfte").not.toContain(
      i18n.t("task.none"),
    );
  });

  it("L2d · er ist ein Weg, keine Sackgasse — und trägt keine Zahl-Pille", async () => {
    await mount();
    const zeile = container.querySelector<HTMLAnchorElement>('[data-testid="h5-fuerdich-zeile"]');
    expect(zeile?.getAttribute("href")).toBe("/erfassen");
    // Die Pille summiert `count`. Eine `1` behauptete einen offenen Vorgang; es ist aber keiner
    // offen, es ist nur noch nichts da.
    expect(container.querySelector('[data-testid="h5-fuerdich-pille"]')).toBeNull();
  });

  it("L2e · GEGENPROBE MIT BESTAND: mit Wissensobjekten steht der Satz NICHT da", async () => {
    box.kos = async () => [EIN_KO];
    await mount();
    expect(kartentext(), "der Bestand ist nicht leer").not.toContain(
      i18n.t("start.leer.ersterSchritt"),
    );
    // Und die bisherige Verneinung kommt an ihre Stelle zurück — nichts ist verloren gegangen.
    expect(kartentext()).toContain(i18n.t("task.none"));
  });

  // ----------------------------------------------------------------------------------------------
  // L2f — DER BESUCH, FÜR DEN DIESER AUFTRAG GEBAUT IST (Bens Korrekturpflicht 2 aus Runde 1).
  // ----------------------------------------------------------------------------------------------
  // Wer eine frisch aufgesetzte Demo zum ERSTEN Mal öffnet, ist Administrator und hat den
  // Orientierungsvermerk nicht im Speicher. Genau dann steht die Erststart-Führungszeile in der
  // Karte (§5a von JOB 3064) — und in Runde 1 verdrängte sie den Satz über den leeren Bestand,
  // weil die Bedingung `zeilen.length === 0` lautete. Ben: „Die Ersteinrichtungszeile darf die
  // zugesagte Information über den leeren Bestand samt erstem Schritt nicht verdrängen."
  //
  // Beide Zeilen sind FÜHRUNG und keine wartende Arbeit, und sie nennen zwei verschiedene erste
  // Schritte: „so richtest du ein" (/admin) und „so kommt das erste Wissen herein" (/erfassen).
  describe("L2f · der echte Erstbesuch — Admin OHNE Vermerk im Speicher", () => {
    it("L2f · beide Führungszeilen stehen: Ersteinrichtung UND der leere Bestand", async () => {
      window.localStorage.clear();
      await mount();
      expect(
        kartentext(),
        "die Erststart-Zeile darf den Satz über den leeren Bestand nicht verdrängen",
      ).toContain(i18n.t("start.leer.ersterSchritt"));
      expect(kartentext(), "und sie selbst steht weiter da").toContain(i18n.t("start.menu.erst"));
      // KALIBRIERUNG: es ist wirklich der Erstbesuch — ohne die Erststart-Zeile misst L2f nichts.
      const ziele = [...karte().querySelectorAll<HTMLAnchorElement>("a")].map((a) =>
        a.getAttribute("href"),
      );
      expect(ziele).toContain("/admin");
      expect(ziele).toContain("/erfassen");
    });

    it("L2f-EN/NL · derselbe Erstbesuch in allen drei Sprachen", async () => {
      for (const sprache of ["en", "nl"]) {
        await i18n.changeLanguage(sprache);
        // Der Mount von eben hat den Vermerk gesetzt (`markStartOrientationSeen` im Effekt) — für
        // den nächsten Erstbesuch muss er wieder weg.
        window.localStorage.clear();
        await mount();
        const satz = i18n.t("start.leer.ersterSchritt");
        expect(satz, `Schlüssel fehlt in ${sprache}`).not.toBe("start.leer.ersterSchritt");
        expect(kartentext(), sprache).toContain(satz);
        expect(kartentext(), sprache).toContain(i18n.t("start.menu.erst"));
        abbauen();
      }
    });
  });
});

describe("JOB 3762 · L5 · „es ist nichts da“ und „ich weiß es nicht“ sind zwei Aussagen", () => {
  it("L5a · eine Quelle scheitert (500) ⇒ kein Leersatz, keine Verneinung, aber die Störung", async () => {
    box.board = async () => {
      throw new Error("500");
    };
    await mount();
    expect(kartentext(), "ein Fehler ist keine Leere").not.toContain(
      i18n.t("start.leer.ersterSchritt"),
    );
    expect(kartentext()).not.toContain(i18n.t("task.none"));
    // Eine Störung darf nicht wie Leere aussehen: der Weg heraus steht da (REGELN §7).
    expect(container.querySelector('[data-testid="h5-fuerdich-wiederholen"]')).not.toBeNull();
  });

  it("L5b · ein Abruf läuft noch ⇒ kein Leersatz und keine Verneinung", async () => {
    box.kos = () => new Promise(() => {});
    await mount();
    expect(kartentext(), "solange etwas läuft, steht keine Behauptung").not.toContain(
      i18n.t("start.leer.ersterSchritt"),
    );
    expect(kartentext()).not.toContain(i18n.t("task.none"));
    // Und ein laufender Erstabruf ist keine Störung: kein Wiederholen-Knopf (§9).
    expect(container.querySelector('[data-testid="h5-fuerdich-wiederholen"]')).toBeNull();
  });

  // ----------------------------------------------------------------------------------------------
  // L5c2 — OHNE JEDEN BESTÄTIGTEN STAND ENTSTEHT KEINE LEERAUSSAGE (Bens Nachsatz zu
  // Korrekturpflicht 1: „Ohne vorherigen Erfolg weiterhin keine Leeraussage").
  // ----------------------------------------------------------------------------------------------
  // Der kalte Offline-Einstieg: ein FRISCHER Zwischenspeicher, das Netz weg. Jede Abfrage ruht ohne
  // Daten, die Lage ist `gescheitert` — und dort darf nichts über den Bestand dastehen. Das ist der
  // Fall, den L5c von L5c unterscheidet: nicht „offline" ist die Bedingung, sondern „es gab nie
  // eine bestätigte Antwort".
  it("L5c2 · KALTER Offline-Einstieg ohne jeden Stand ⇒ kein Leersatz, kein „Stand von zuletzt“", async () => {
    onlineManager.setOnline(false);
    try {
      await mount();
      expect(kartentext(), "ohne bestätigte Antwort keine Aussage über den Bestand").not.toContain(
        i18n.t("start.leer.ersterSchritt"),
      );
      expect(kartentext()).not.toContain(i18n.t("task.none"));
      // Und die Karte schweigt nicht: sie sagt, dass gerade nicht geprüft werden kann — in der
      // Form OHNE Stand, denn einen Stand gab es nie (`forYou.ts:220-224`).
      expect(kartentext()).toContain(i18n.t("kollision.lage.pausiertOhneStand"));
    } finally {
      onlineManager.setOnline(true);
    }
  });

  // ----------------------------------------------------------------------------------------------
  // L5c/L5d/L5e — DER BESTÄTIGTE LEERSTAND BLEIBT STEHEN UND WIRD EINGEORDNET (Auftrag §9, Zeilen
  // „Cache mit laufender Auffrischung", „Cache mit gescheiterter Auffrischung" und „offline";
  // REGELN §7, erster Satz).
  // ----------------------------------------------------------------------------------------------
  // RUNDE 1 HAT DIESE DREI FÄLLE ANDERSHERUM FESTGESCHRIEBEN — sie verlangten, dass der Leersatz
  // verschwindet. Ben hat daran gemessen, dass die Karte beim Auffrischen wörtlich `""` wird, und
  // das als Verstoß gegen §9 gewertet („War der Cache leer, bleibt der Leersatz stehen, ohne zu
  // flackern"). Die Zusage, um die es wirklich geht, trennt nicht „online/offline", sondern
  // „bestätigt/unbestätigt": ein einmal erfolgreich geholtes `[]` IST der Stand, den REGELN §7
  // sichtbar lassen will. Was er NICHT ist, ist eine Aussage über JETZT — und das sagt die
  // Datenlagezeile daneben, jedes Mal.
  it("L5c · leer geladen, dann offline wiederbetreten ⇒ der Leersatz BLEIBT, mit „Stand von zuletzt“", async () => {
    const qc = await mount();
    expect(kartentext(), "Vorbedingung: online steht der Satz").toContain(
      i18n.t("start.leer.ersterSchritt"),
    );
    abbauen();
    onlineManager.setOnline(false);
    try {
      await mount(qc);
      expect(
        kartentext(),
        "§9: der zuletzt bestätigte Inhalt bleibt — die Karte wird nicht leer",
      ).toContain(i18n.t("start.leer.ersterSchritt"));
      // Und er steht nicht unkommentiert da: die Datenlagezeile ordnet ihn ein — in der Form MIT
      // Stand, weil jetzt wirklich einer sichtbar ist (`StartKarten.tsx:239`).
      expect(kartentext()).toContain(i18n.t("kollision.lage.pausiert"));
      expect(
        kartentext(),
        "die schwächere Verneinung kommt hier nicht zusätzlich dazu",
      ).not.toContain(i18n.t("task.none"));
    } finally {
      onlineManager.setOnline(true);
    }
  });

  it("L5d · leerer Cache, Auffrischung LÄUFT ⇒ der Leersatz bleibt — und die Auffrischung wird benannt", async () => {
    const qc = await mount();
    expect(kartentext(), "Vorbedingung").toContain(i18n.t("start.leer.ersterSchritt"));

    let aufloesen: ((wert: unknown) => void) | null = null;
    box.kos = () =>
      new Promise((r) => {
        aufloesen = r;
      });
    await act(async () => {
      void qc.invalidateQueries({ queryKey: ["kos"] });
      await flush();
    });
    // KALIBRIERUNG: der Abruf läuft wirklich — sonst misst dieser Fall nichts.
    expect(qc.getQueryState(["kos", undefined])?.fetchStatus).toBe("fetching");
    expect(
      kartentext(),
      "§9: War der Cache leer, bleibt der Leersatz stehen, ohne zu flackern",
    ).toContain(i18n.t("start.leer.ersterSchritt"));
    // Und er behauptet nicht, Auskunft über JETZT zu sein: die Zeile sagt, dass nachgeprüft wird.
    expect(
      (ersterSchrittZeile()?.textContent ?? "").replace(/\s+/g, " "),
      "die laufende Auffrischung wird benannt",
    ).toContain(i18n.t("start.leer.auffrischung"));

    // Nach dem Abschluss ist der Stand wieder frisch — und der Zusatz verschwindet.
    await act(async () => {
      aufloesen?.([]);
      await flush();
    });
    expect(kartentext()).toContain(i18n.t("start.leer.ersterSchritt"));
    expect(
      (ersterSchrittZeile()?.textContent ?? "").replace(/\s+/g, " "),
      "ohne laufenden Abruf steht dort nichts",
    ).not.toContain(i18n.t("start.leer.auffrischung"));
  });

  it("L5e · leerer Cache, Auffrischung GESCHEITERT ⇒ der Leersatz bleibt, markiert als nicht frisch", async () => {
    const qc = await mount();
    expect(kartentext(), "Vorbedingung").toContain(i18n.t("start.leer.ersterSchritt"));

    box.kos = async () => {
      throw new Error("500");
    };
    await act(async () => {
      void qc.invalidateQueries({ queryKey: ["kos"] });
      await flush();
    });
    // Zweite Runde: der Fehlschlag steht im Speicher, der Neuanstrich folgt erst danach (unter Last
    // war eine Runde zu wenig — s. `aufgaben-leerbestand.test.tsx`, L5-Auf-c).
    await act(flush);
    expect(kartentext(), "REGELN §7: ein gescheiterter Nachlauf leert die Karte nicht").toContain(
      i18n.t("start.leer.ersterSchritt"),
    );
    expect(kartentext(), "und er sagt ehrlich, dass er nicht frisch ist").toContain(
      i18n.t("loadstate.stale"),
    );
    // Der Weg zurück zur Frische steht da (REGELN §7).
    expect(container.querySelector('[data-testid="h5-fuerdich-wiederholen"]')).not.toBeNull();
  });
});
