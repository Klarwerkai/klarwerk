// @vitest-environment jsdom
// ================================================================================================
// JOB 3390 · LADEFEHLER-ALTER-TAB — DER ALTE TAB, DER ERST BEIM KLICK NACHLÄDT.
// ================================================================================================
//
// DIE BELEGTE LAGE (Pedi, 09.09.2026 12:49; Codex `0db1754c` / `LADEFEHLER-ADMIN-20260909.md`):
// Die App war seit Stunden offen, währenddessen wurde veröffentlicht. Der Klick auf „Verwaltung"
// lädt die Seite ERST IN DIESEM MOMENT nach — ihre Chunk-Adresse gibt es nicht mehr. Auf der
// Fläche stand die rote Fehlerkarte mit dem englischen Maschinensatz „This view could not be
// loaded — Failed to fetch dynamically imported module …/assets/Admin-C0Y_KbY4.js".
//
// WARUM DER VERSIONSWÄCHTER AUS JOB 3268 DAS NICHT AUFFÄNGT: der fragt `/health` beim Aufbau und
// dann alle fünf Minuten (`lib/versionswaechter.ts:60`, `:133-177`). Wer IN der Lücke zwischen zwei
// Abrufen klickt, sieht heute nur die Fehlerkarte. Das sind zwei getrennte Zustände — der Kopf von
// `lib/versionswaechter.ts:10-13` sagt selbst, dass der Ladefehler der andere ist.
//
// WAS HIER GEMESSEN WIRD, an der GEMOUNTETEN Fehlergrenze:
//   A1/A2  Ein Stale-Import-`TypeError` in der Grenze → die ruhige Karte („Neue Version verfügbar"
//          + `app.staleBundle` + Knopf „Neu laden"), DE und EN. NICHT die generische Karte, und
//          NICHT die Chunk-Adresse für den Menschen.
//   A3     DERSELBE Weg wie im Produkt: eine über `lazy()` nachgeladene Seite, deren `import()`
//          ablehnt, in `<Suspense>` um eine `ErrorBoundary` (Aufbau wie `routes.tsx:190`/`:200`).
//   A4     Ein GEWÖHNLICHER Programmfehler → unverändert `error.title` und die `error.detail`-Zeile
//          mit dem echten Grund; die Neu-laden-Karte erscheint NICHT.
//   A5     Mit ungesicherter Eingabe → erst die vorhandene Rückfrage des Entwurfsschutzes; „Hier
//          bleiben" lädt nicht, „Verwerfen" lädt genau einmal.
//   A6     OHNE `NavGuardProvider` → die Grenze stürzt nicht selbst ab; der Knopf lädt direkt neu.
//   A7     Nichts lädt von selbst: nach Zeitvorlauf und erneutem Render ist der Zähler 0.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type ReactNode,
  Suspense,
  act,
  createElement,
  lazy,
  useEffect,
} from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  type DirtyGuard,
  NavGuardProvider,
  useNavGuard,
} from "../../apps/web/src/app/NavGuardContext";
import { ErrorBoundary } from "../../apps/web/src/components/ErrorBoundary";
import { Splash } from "../../apps/web/src/components/Splash";
import i18n from "../../apps/web/src/i18n";
import { STALE_BUNDLE_KEY } from "../../apps/web/src/lib/staleChunk";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * PEDIS FEHLER, WÖRTLICH. Chrome wirft für einen `import()`, dessen Stück nicht mehr da ist, genau
 * diesen `TypeError` — er ist die eine der drei Browser-Formulierungen, die
 * `lib/staleChunk.ts:23-24` kennt. Jeder Fall baut sich seinen eigenen: React rendert nach einem
 * Fehlschlag erneut, und ein geteiltes Fehlerobjekt wäre eine Quelle für Rätsel, keine Ersparnis.
 */
const CHUNK_ADRESSE = "https://app.example/assets/Admin-C0Y_KbY4.js";
const ladefehler = (): TypeError =>
  new TypeError(`Failed to fetch dynamically imported module ${CHUNK_ADRESSE}`);

/** Ein ganz gewöhnlicher Programmfehler — die Gegenprobe zur Abgrenzung (A4). */
const PROGRAMMFEHLER = "kaputt";

let container: HTMLDivElement | null = null;
let root: { render(n: unknown): void; unmount(): void } | null = null;
let konsoleZurueck: (() => void) | null = null;
let fehlerAusgaben: string[] = [];

async function ruhen(): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

/** Meldet einen Entwurfsschutz an — dieselbe Schnittstelle, die `erfassen/Blatt.tsx` benutzt. */
function Entwurfsschutz({ guard }: { guard: DirtyGuard }): null {
  const { setGuard } = useNavGuard();
  useEffect(() => {
    setGuard(guard);
    return () => setGuard(null);
  }, [setGuard, guard]);
  return null;
}

/** Ein Kind, das beim Rendern wirft — der Stale-Import in seiner kürzesten Form. */
function Stolperer({ fehler }: { fehler: () => Error }): never {
  throw fehler();
}

async function mounten(baum: ReactNode): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(baum);
    await ruhen();
  });
  await act(ruhen);
}

function abbauen(): void {
  if (root) {
    act(() => root?.unmount());
    root = null;
  }
  container?.remove();
  container = null;
}

/** Der Baum aus dem Produkt: Entwurfsschutz oben, Fehlergrenze darunter (`App.tsx:107-111`). */
function mitWaechter(kind: ReactNode, guard: DirtyGuard | null = null): ReactNode {
  return createElement(
    NavGuardProvider,
    null,
    guard ? createElement(Entwurfsschutz, { guard }) : null,
    createElement(ErrorBoundary, null, kind),
  );
}

const text = (): string => (container?.textContent ?? "").replace(/\s+/g, " ");

const karte = (): HTMLElement | null =>
  container?.querySelector('[data-testid="ladefehler-neue-version"]') ?? null;

function neuLadenKnopf(): HTMLButtonElement {
  const el = container?.querySelector('[data-testid="ladefehler-neue-version-neu-laden"]');
  if (!(el instanceof HTMLButtonElement)) {
    throw new Error("Der Knopf „Neu laden“ fehlt an der Ladefehler-Karte");
  }
  return el;
}

function dialogKnopf(beschriftung: string): HTMLButtonElement {
  const el = [...document.querySelectorAll("button")].find(
    (b) => (b.textContent ?? "").trim() === beschriftung,
  );
  if (!(el instanceof HTMLButtonElement)) {
    throw new Error(`Der Knopf „${beschriftung}“ fehlt in der Rückfrage`);
  }
  return el;
}

/** Ersatz für `location.reload()` — jsdom bringt ihn nicht mit (Muster aus
 *  `tests/erstladezeit/nachladefehler-zeigt-karte.test.tsx:219-228`). */
function mitReloadErsatz(): { laden: ReturnType<typeof vi.fn>; zurueck: () => void } {
  const echteLage = window.location;
  const laden = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, reload: laden },
  });
  return {
    laden,
    zurueck: () =>
      Object.defineProperty(window, "location", { configurable: true, value: echteLage }),
  };
}

beforeEach(async () => {
  // Die Fehlergrenze schreibt bewusst nach `console.error` (`ErrorBoundary.tsx:25`). Das ist hier
  // erwartete Ausgabe und kein Rauschen — sie wird eingesammelt und in A1 als Beleg GELESEN.
  fehlerAusgaben = [];
  const original = console.error;
  console.error = (...args: unknown[]): void => {
    fehlerAusgaben.push(args.map((a) => String(a)).join(" "));
  };
  konsoleZurueck = () => {
    console.error = original;
  };
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  abbauen();
  vi.useRealTimers();
  konsoleZurueck?.();
  konsoleZurueck = null;
  await i18n.changeLanguage("de");
  vi.clearAllMocks();
});

describe("JOB 3390 · der Ladefehler im alten Tab zeigt die Neu-laden-Karte", () => {
  it("A1: Stale-Import auf Deutsch → ruhige Karte statt Maschinensatz", async () => {
    await mounten(mitWaechter(createElement(Stolperer, { fehler: ladefehler })));

    expect(karte(), "der Ladefehler zeigt weiter die generische Fehlerkarte").not.toBeNull();
    expect(text(), "der ehrliche Satz zum alten Stand fehlt").toContain(i18n.t(STALE_BUNDLE_KEY));
    expect(neuLadenKnopf().textContent?.trim()).toBe(i18n.t("version.neu.neuLaden"));
    expect(neuLadenKnopf().disabled).toBe(false);

    // DIE ABLÖSUNG: für DIESE Fehlerklasse darf die generische Karte nicht mehr erscheinen.
    expect(text(), "die generische Fehlerkarte steht daneben").not.toContain(i18n.t("error.title"));
    expect(text(), "die generische Fehlerkarte steht daneben").not.toContain(i18n.t("error.body"));
    expect(text(), "die Chunk-Adresse gehört in die Konsole, nicht vor den Menschen").not.toContain(
      "Admin-C0Y_KbY4.js",
    );
    // Sichtbar heißt messbar sichtbar (LEHRE JOB 3179): kein `hidden`, kein `sr-only`.
    expect(karte()?.hasAttribute("hidden")).toBe(false);
    expect(karte()?.getAttribute("aria-hidden")).toBeNull();
    expect(karte()?.className ?? "").not.toContain("sr-only");
    // Die Diagnose bleibt trotzdem da — kein stiller Absturz.
    expect(fehlerAusgaben.join(" ")).toContain("[KLARWERK] UI-Fehler abgefangen:");
  });

  it("A2: Stale-Import auf Englisch → derselbe Ausgang, andere Sprache", async () => {
    await i18n.changeLanguage("en");
    await mounten(mitWaechter(createElement(Stolperer, { fehler: ladefehler })));

    expect(karte()).not.toBeNull();
    expect(text()).toContain("A new version of the app is available");
    expect(neuLadenKnopf().textContent?.trim()).toBe("Reload");
    expect(text()).not.toContain(i18n.t("error.title"));
    expect(text()).not.toContain("Admin-C0Y_KbY4.js");
  });

  it("A3: der echte Weg — eine über lazy() nachgeladene Seite, deren import() ablehnt", async () => {
    // KEINE ATTRAPPE. `routes.tsx:82` bindet die Verwaltung als
    // `lazy(() => import("./pages/Admin").then(…))`, `routes.tsx:190` legt die Fehlergrenze um die
    // Seite und `routes.tsx:200` den `<Suspense fallback={<Splash />}>` darum. Genau dieser Aufbau
    // steht hier — nur der Import lehnt kontrolliert ab, wie er es im alten Tab wirklich tut.
    const Seite = lazy(() => Promise.reject(ladefehler()));
    await mounten(
      createElement(
        NavGuardProvider,
        null,
        createElement(
          Suspense,
          { fallback: createElement(Splash) },
          createElement(ErrorBoundary, null, createElement(Seite)),
        ),
      ),
    );

    expect(karte(), "der echte Nachladefehler landet nicht in der neuen Karte").not.toBeNull();
    expect(text()).toContain(i18n.t(STALE_BUNDLE_KEY));
    expect(neuLadenKnopf().textContent?.trim()).toBe(i18n.t("version.neu.neuLaden"));
    expect(text()).not.toContain(i18n.t("error.title"));
    expect(text()).not.toContain("Admin-C0Y_KbY4.js");
    // „Lädt …" wäre jetzt eine Lüge — das Stück kommt nicht mehr.
    expect(text()).not.toContain(i18n.t("state.loading"));
  });

  it("A4: ein gewöhnlicher Programmfehler behält die generische Karte samt Detailzeile", async () => {
    await mounten(
      mitWaechter(createElement(Stolperer, { fehler: () => new Error(PROGRAMMFEHLER) })),
    );

    expect(text(), "der normale Fehler verlor seinen Titel").toContain(i18n.t("error.title"));
    expect(text()).toContain(i18n.t("error.body"));
    expect(text(), "die ehrliche Detailzeile ist weg").toContain(
      `${i18n.t("error.detail")}: ${PROGRAMMFEHLER}`,
    );
    expect(
      karte(),
      "ein Programmfehler wird als „neue Version“ ausgegeben — das wäre eine Lüge",
    ).toBeNull();
  });

  it("A5: ungesicherte Eingabe → Rückfrage; „Hier bleiben“ lädt nicht, „Verwerfen“ genau einmal", async () => {
    await mounten(
      mitWaechter(createElement(Stolperer, { fehler: ladefehler }), {
        isDirty: () => true,
        save: async () => {},
      }),
    );
    const ersatz = mitReloadErsatz();
    try {
      await act(async () => {
        neuLadenKnopf().click();
        await ruhen();
      });
      expect(
        ersatz.laden,
        "ungesicherte Eingabe und trotzdem sofort neu geladen — genau der stille Verlust",
      ).not.toHaveBeenCalled();
      expect(
        document.querySelector("[data-navguard-dialog]"),
        "ohne sichtbare Rückfrage wäre der Klick ein Datenverlust",
      ).not.toBeNull();

      await act(async () => {
        dialogKnopf(i18n.t("nav.guard.stay")).click();
        await ruhen();
      });
      expect(ersatz.laden, "„Hier bleiben“ hat trotzdem neu geladen").not.toHaveBeenCalled();
      expect(karte(), "nach „Hier bleiben“ ist die Karte verschwunden").not.toBeNull();

      await act(async () => {
        neuLadenKnopf().click();
        await ruhen();
      });
      await act(async () => {
        dialogKnopf(i18n.t("nav.guard.discard")).click();
        await ruhen();
      });
      expect(
        ersatz.laden,
        "bewusstes Verwerfen führt nicht zur neuen Version",
      ).toHaveBeenCalledTimes(1);
    } finally {
      ersatz.zurueck();
    }
  });

  it("A6: ohne NavGuardProvider stürzt die letzte Auffanglinie nicht selbst ab", async () => {
    // `useNavGuard()` WIRFT ohne Anbieter (`NavGuardContext.tsx:99-105`). Würde die Fehlergrenze ihn
    // so lesen, wäre der Absturz zurück, gegen den sie gebaut ist — und zwar ohne jede Grenze
    // darüber, die ihn noch fangen könnte.
    await mounten(
      createElement(ErrorBoundary, null, createElement(Stolperer, { fehler: ladefehler })),
    );

    expect(karte(), "ohne Anbieter rendert die Karte nicht").not.toBeNull();
    expect(text()).toContain(i18n.t(STALE_BUNDLE_KEY));
    expect(
      fehlerAusgaben.join(" "),
      "useNavGuard hat in der letzten Auffanglinie geworfen",
    ).not.toContain("must be used within NavGuardProvider");

    const ersatz = mitReloadErsatz();
    try {
      await act(async () => {
        neuLadenKnopf().click();
        await ruhen();
      });
      expect(ersatz.laden, "ohne Anbieter muss der Knopf direkt neu laden").toHaveBeenCalledTimes(
        1,
      );
    } finally {
      ersatz.zurueck();
    }
  });

  it("A7: nichts lädt von selbst neu — kein Timer, kein Effekt, kein zweiter Aufruf", async () => {
    await mounten(mitWaechter(createElement(Stolperer, { fehler: ladefehler })));
    const ersatz = mitReloadErsatz();
    try {
      // Gestellt werden NUR die Taktgeber; `setTimeout` bleibt echt, sonst käme `ruhen()` (und damit
      // jedes Abarbeiten der React-Warteschlange) nie zurück — die Lehre aus
      // `tests/d1r-neue-version-im-alten-tab/versionshinweis-mounted.test.tsx:346-348`.
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
        await ruhen();
      });
      vi.useRealTimers();

      // Und ein zweiter Render derselben Grenze löst auch keinen Aufruf aus.
      await act(async () => {
        root?.render(mitWaechter(createElement(Stolperer, { fehler: ladefehler })));
        await ruhen();
      });

      expect(karte(), "die Karte ist zwischendurch verschwunden").not.toBeNull();
      expect(
        ersatz.laden,
        "die Karte lädt von selbst neu — das ist der stille Verlust, gegen den schon JOB 3268 steht",
      ).not.toHaveBeenCalled();
    } finally {
      ersatz.zurueck();
    }
  });
});
