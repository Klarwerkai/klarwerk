// @vitest-environment jsdom
// ================================================================================================
// JOB 3268 · D1-R — DER ALTE TAB ERFÄHRT, DASS ES EINE NEUE VERSION GIBT.
// ================================================================================================
//
// DIE BELEGTE LAGE (Codex d4db9b3e/c5418bcc, 08.09.2026 05:50–05:52, Live 1.0.0-beta.1.184):
// Pedis seit Stunden offener Chrome-Tab 1117061511 (/erfassen) hatte KEINEN Knopf „Meine Entwürfe"
// und ein unbenanntes Mehr-Menü; der Editor war leer, Speichern deaktiviert. Ein frischer Tab
// desselben Profils zeigte beides. Nach einem kontrollierten Neuladen derselben Adresse erschien
// „Meine Entwürfe" mit neun Entwürfen. Die alte Oberfläche lief also weiter — sie ist nicht
// abgestürzt, sie war nur alt, und NICHTS in ihr sagte das.
//
// WARUM DER VORHANDENE HINWEIS DAS NICHT DECKT: `lib/staleChunk.ts` reagiert ausschliesslich auf
// einen LADEFEHLER (`import()` eines Chunks scheitert). Eine alte Oberfläche, die erfolgreich
// weiterläuft, wirft nie einen solchen Fehler — genau Pedis Fall. Beide Zustände bleiben deshalb
// getrennt und tragen getrennte Texte (A7).
//
// WAS HIER GEMESSEN WIRD, an der GEMOUNTETEN Fläche mit nachgestelltem `/health`:
//   A1  Live-Version ≠ Build-Version → der Hinweis steht da, DE und EN, mit Knopf „Neu laden".
//   A2  gleiche Version → KEIN Hinweis (kein Dauerlärm nach jedem Abruf).
//   A3  Abruf scheitert (Netz weg) ODER antwortet nicht mit 200 → KEIN Hinweis (kein Fehlalarm).
//   A4  Klick OHNE ungesicherte Eingabe → `location.reload()` wird gerufen.
//   A5  Klick MIT ungesicherter Eingabe → KEIN Neuladen, sondern die sichtbare Rückfrage des
//       vorhandenen Entwurfsschutzes; erst „Entwurf speichern" sichert und lädt dann neu.
//   A6  Versteckter Tab → KEIN Abruf. Wird er sichtbar, wird genau dann geprüft.
//   A7  Der staleChunk-Ladefehlerhinweis bleibt bestehen und ist vom neuen Hinweis unterscheidbar.
//
// RUNDE 2 (BENs Urteil: Korrekturpflicht 1 und zwei Prüflücken):
//   A8  `/health` meldet den Ersatzwert „unbekannt“ → KEIN Hinweis, und der Wächter fragt WEITER;
//       die nächste gültige Antwort erreicht den Tab noch. (Gegen den echten Serverwert gepinnt in
//       `unbekannt-ist-keine-version.test.tsx`.)
//   A9  Der Fünf-Minuten-Takt wird an der gestellten Uhr gemessen statt behauptet.
//   A10 Eine SCHEITERNDE oder noch laufende Entwurfssicherung lädt NICHT neu — erst die gelungene.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { act, createElement, useEffect } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  type DirtyGuard,
  NavGuardProvider,
  useNavGuard,
} from "../../apps/web/src/app/NavGuardContext";
import { VersionsHinweis } from "../../apps/web/src/components/VersionsHinweis";
import i18n from "../../apps/web/src/i18n";
import { STALE_BUNDLE_KEY } from "../../apps/web/src/lib/staleChunk";
import { VERSIONSABRUF_INTERVALL_MS } from "../../apps/web/src/lib/versionswaechter";
import { APP_VERSION } from "../../apps/web/src/version";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Was der nachgestellte `/health` als Nächstes tut. Eine Quelle für alle Fälle. */
const lage = {
  antwort: "neu" as "neu" | "gleich" | "netzfehler" | "status500" | "ohneVersion" | "unbekannt",
  abrufe: [] as string[],
};

/**
 * Der Ersatzwert, den `/health` ausgibt, wenn der Server seine eigene Version nicht lesen kann
 * (`services/app/src/build-app.ts:966-979`). Hier steht er NACHGESTELLT; gegen die echte
 * Serverkonstante gepinnt ist er in `unbekannt-ist-keine-version.test.tsx`.
 */
const SERVER_ERSATZWERT = "unbekannt";

/** Eine Version, die es sicher nicht ist — der Live-Stand nach dem nächsten Deploy. */
const FREMDE_VERSION = "1.0.0-beta.1.999";

function nachgestellterHealth(): void {
  (globalThis as unknown as { fetch: unknown }).fetch = vi.fn(async (eingabe: unknown) => {
    lage.abrufe.push(String(eingabe));
    if (lage.antwort === "netzfehler") {
      throw new TypeError("Failed to fetch");
    }
    if (lage.antwort === "status500") {
      return new Response("", { status: 500 });
    }
    const version =
      lage.antwort === "gleich"
        ? APP_VERSION
        : lage.antwort === "ohneVersion"
          ? undefined
          : lage.antwort === "unbekannt"
            ? SERVER_ERSATZWERT
            : FREMDE_VERSION;
    return new Response(JSON.stringify({ status: "ok", version, commit: "abc" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

/** Meldet einen Entwurfsschutz an — dieselbe Schnittstelle, die `erfassen/Blatt.tsx` benutzt. */
function Entwurfsschutz({ guard }: { guard: DirtyGuard | null }): null {
  const { setGuard } = useNavGuard();
  useEffect(() => {
    setGuard(guard);
    return () => setGuard(null);
  }, [setGuard, guard]);
  return null;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const ruhen = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(guard: DirtyGuard | null = null): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        NavGuardProvider,
        null,
        createElement(Entwurfsschutz, { guard }),
        createElement(VersionsHinweis),
      ),
    );
    await ruhen();
  });
  await act(ruhen);
}

function unmount(): void {
  act(() => root.unmount());
  container.remove();
}

const hinweis = (): HTMLElement | null =>
  container.querySelector('[data-testid="versions-hinweis"]');

function neuLadenKnopf(): HTMLButtonElement {
  const el = container.querySelector('[data-testid="versions-hinweis-neu-laden"]');
  if (!(el instanceof HTMLButtonElement)) {
    throw new Error("Der Knopf „Neu laden“ fehlt am Versionshinweis");
  }
  return el;
}

/** Der Ersatz für `location.reload()` — jsdom bringt ihn nicht mit (Muster aus
 *  `tests/erstladezeit/nachladefehler-zeigt-karte.test.tsx:219`). */
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

/** Stellt `document.visibilityState` — in jsdom sonst fest auf „visible". */
function stelleSichtbarkeit(wert: "visible" | "hidden"): void {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => wert });
}

beforeEach(async () => {
  lage.antwort = "neu";
  lage.abrufe = [];
  stelleSichtbarkeit("visible");
  nachgestellterHealth();
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  // Eine gestellte Uhr, die ein abgebrochener Fall stehen lässt, hängt JEDEN folgenden Fall dieser
  // Datei auf (gemessen: A10 lief in die Zeitgrenze, weil A9 vorher abbrach).
  vi.useRealTimers();
  await i18n.changeLanguage("de");
  stelleSichtbarkeit("visible");
  vi.clearAllMocks();
});

describe("JOB 3268 D1-R · der alte Tab sieht die neue Version", () => {
  it("A1: Live-Version ≠ Build-Version → sichtbarer Hinweis mit Knopf, DE und EN", async () => {
    await mount();
    const de = hinweis();
    expect(de, "der alte Tab erfährt nichts von der neuen Version").not.toBeNull();
    expect(de?.textContent ?? "").toContain(i18n.t("version.neu.hinweis"));
    expect(i18n.t("version.neu.hinweis").length).toBeLessThanOrEqual(60);
    const deutsch = (de?.textContent ?? "").trim();
    expect(neuLadenKnopf().textContent?.trim()).toBe(i18n.t("version.neu.neuLaden"));
    // LEHRE JOB 3179 (UX-24): „sichtbar" heisst messbar sichtbar. Ein Hinweis, der nur für den
    // Screenreader da ist, hätte Pedis Fall nicht gelöst — er hat auf den Bildschirm gesehen.
    const klassen = de?.className ?? "";
    expect(de?.hasAttribute("hidden"), "der Hinweis ist versteckt").toBe(false);
    expect(de?.getAttribute("aria-hidden"), "der Hinweis ist aus dem Baum genommen").toBeNull();
    expect(klassen, "nur für den Screenreader — auf dem Bildschirm unsichtbar").not.toContain(
      "sr-only",
    );
    unmount();

    await i18n.changeLanguage("en");
    await mount();
    const en = hinweis();
    expect(en).not.toBeNull();
    expect(en?.textContent ?? "").toContain("New version available");
    expect((en?.textContent ?? "").trim()).not.toBe(deutsch);
    expect(neuLadenKnopf().textContent?.trim()).toBe("Reload");
    unmount();
  });

  it("A2: gleiche Version → kein Hinweis", async () => {
    lage.antwort = "gleich";
    await mount();
    expect(lage.abrufe.length, "ohne Abruf misst dieser Fall nichts").toBeGreaterThan(0);
    expect(hinweis(), "gleicher Stand, trotzdem ein Hinweis — das wäre Lärm").toBeNull();
    unmount();
  });

  it("A3: Abruf scheitert oder antwortet ohne Version → kein Hinweis (kein Fehlalarm)", async () => {
    lage.antwort = "netzfehler";
    await mount();
    expect(hinweis(), "ein gescheiterter Abruf ist keine neue Version").toBeNull();
    unmount();

    lage.antwort = "status500";
    await mount();
    expect(hinweis(), "ein 500 ist keine neue Version").toBeNull();
    unmount();

    lage.antwort = "ohneVersion";
    await mount();
    expect(hinweis(), "eine Antwort ohne Versionsfeld ist keine neue Version").toBeNull();
    unmount();
  });

  it("A4: Klick ohne ungesicherte Eingabe → es wird wirklich neu geladen", async () => {
    await mount();
    const ersatz = mitReloadErsatz();
    await act(async () => {
      neuLadenKnopf().click();
      await ruhen();
    });
    expect(
      ersatz.laden,
      "der Knopf muss den einzigen Weg zur neuen Version wirklich gehen",
    ).toHaveBeenCalledTimes(1);
    ersatz.zurueck();
    unmount();
  });

  it("A5: Klick mit ungesicherter Eingabe → erst Rückfrage und Sicherung, dann neu laden", async () => {
    const gesichert = vi.fn(async () => {});
    await mount({ isDirty: () => true, save: gesichert });
    const ersatz = mitReloadErsatz();
    await act(async () => {
      neuLadenKnopf().click();
      await ruhen();
    });
    // KEIN stiller Verlust: nichts ist neu geladen, die Rückfrage steht sichtbar da.
    expect(
      ersatz.laden,
      "ungesicherte Eingabe und trotzdem sofort neu geladen",
    ).not.toHaveBeenCalled();
    const dialog = document.querySelector("[data-navguard-dialog]");
    expect(dialog, "ohne sichtbare Rückfrage wäre der Klick ein Datenverlust").not.toBeNull();
    expect(document.body.textContent ?? "").toContain(i18n.t("nav.guard.title"));

    const sichern = [...document.querySelectorAll("button")].find(
      (b) => (b.textContent ?? "").trim() === i18n.t("nav.guard.save"),
    );
    expect(sichern, "die Rückfrage bietet das Sichern nicht an").toBeDefined();
    await act(async () => {
      sichern?.click();
      await ruhen();
    });
    expect(gesichert, "der vorhandene Entwurfsschutz wurde nicht benutzt").toHaveBeenCalledTimes(1);
    expect(
      ersatz.laden,
      "nach dem Sichern muss die neue Version wirklich kommen",
    ).toHaveBeenCalledTimes(1);
    ersatz.zurueck();
    unmount();
  });

  it("A6: versteckter Tab → kein Abruf; sichtbar geworden → genau dann geprüft", async () => {
    stelleSichtbarkeit("hidden");
    await mount();
    expect(lage.abrufe, "ein ausgeblendeter Tab darf den Server nicht fragen").toEqual([]);
    expect(hinweis()).toBeNull();

    stelleSichtbarkeit("visible");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await ruhen();
    });
    expect(lage.abrufe.length, "beim Zurückkommen auf den Tab wird geprüft").toBe(1);
    expect(hinweis(), "nach dem Fokuswechsel steht der Hinweis da").not.toBeNull();
    unmount();
  });

  it("A7: der Ladefehler-Hinweis bleibt bestehen und ist unterscheidbar benannt", async () => {
    // §5.4: zwei verschiedene Zustände, zwei verschiedene Texte. Der alte Hinweis gehört zum
    // GESCHEITERTEN Nachladen eines Chunks, der neue zur weiterlaufenden alten Oberfläche.
    expect(STALE_BUNDLE_KEY).toBe("app.staleBundle");
    for (const sprache of ["de", "en"]) {
      await i18n.changeLanguage(sprache);
      const alt = i18n.t(STALE_BUNDLE_KEY);
      const neu = i18n.t("version.neu.hinweis");
      expect(alt.length, `${sprache}: der Ladefehler-Hinweis ist verschwunden`).toBeGreaterThan(0);
      expect(neu, `${sprache}: beide Zustände tragen denselben Satz`).not.toBe(alt);
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // RUNDE 2 — die drei Fälle aus BENs Urteil (Korrekturpflicht 1 und die zwei Prüflücken).
  // ══════════════════════════════════════════════════════════════════════════════════════════════

  it("A8: „unbekannt“ vom Server → kein Hinweis, und der Wächter fragt weiter", async () => {
    // BENS GEGENBEISPIEL, jetzt ein Bestandsfall: `/health` meldet den Ersatzwert, den der Server
    // ausgibt, wenn er seine eigene Version nicht lesen kann. Das ist fehlendes Wissen, keine neue
    // Lieferung — und weil der Wächter nach einem Ja aufhört zu fragen, wäre der Fehlalarm auch
    // nicht mehr zu korrigieren gewesen.
    lage.antwort = "unbekannt";
    await mount();
    expect(lage.abrufe.length, "ohne Abruf misst dieser Fall nichts").toBe(1);
    expect(hinweis(), "„unbekannt“ wurde als neue Lieferung angezeigt").toBeNull();

    // DIE ZWEITE HÄLFTE DER PFLICHT: die Prüfung ist NICHT beendet. Kommt danach eine gültige,
    // abweichende Version, steht der Hinweis da.
    lage.antwort = "neu";
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await ruhen();
    });
    expect(lage.abrufe.length, "nach „unbekannt“ wurde nicht mehr gefragt").toBe(2);
    expect(hinweis(), "die spätere gültige Antwort erreicht den Tab nicht mehr").not.toBeNull();
    unmount();
  });

  it("A9: nach fünf Minuten wird von selbst erneut geprüft", async () => {
    // Die Prüflücke aus BENs Punkt 6: der Takt war als Bauart da, aber nie gemessen. Gemessen wird
    // hier die ECHTE Frist aus dem Produkt (`VERSIONSABRUF_INTERVALL_MS`), nicht eine abgeschriebene
    // Zahl — und die gestellte Uhr macht daraus eine Messung statt einer Wartezeit.
    lage.antwort = "gleich";
    // NUR die Uhr des Wächters wird gestellt: `setTimeout` bleibt echt, sonst käme `ruhen()` (und
    // damit jedes Abarbeiten der React-Warteschlange in dieser Datei) nie zurück.
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    try {
      await mount();
      expect(lage.abrufe.length, "der Abruf beim Aufbau fehlt").toBe(1);

      // Kurz vor der Frist: unverändert ein Abruf. Ohne diese Hälfte wäre auch ein Sekundentakt
      // grün. `ruhen()` läuft auf der ECHTEN Uhr und lässt angefangene Abrufe wirklich ankommen —
      // ohne das bliebe ein zu schneller Takt in der Warteschlange stecken und unsichtbar.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(VERSIONSABRUF_INTERVALL_MS - 1000);
        await ruhen();
      });
      expect(lage.abrufe.length, "es wird früher gefragt als zugesagt").toBe(1);

      lage.antwort = "neu";
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
        await ruhen();
      });
      expect(lage.abrufe.length, "nach fünf Minuten wurde nicht erneut gefragt").toBe(2);
      expect(hinweis(), "der zweite Abruf hat nichts bewirkt").not.toBeNull();
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it("A10: scheiternde Sicherung → kein Neuladen; verzögerte Sicherung → erst danach", async () => {
    // BENs Prüflücke: A5 benutzte eine sofort erfolgreiche Sicherungsattrappe. Der teure Fall ist
    // der andere — die Sicherung schlägt fehl. Dann darf NICHTS neu geladen werden, sonst ist genau
    // der Inhalt weg, den der Klick retten sollte.
    let loesen: (() => void) | null = null;
    let scheitern = true;
    const gesichert = vi.fn(
      () =>
        new Promise<void>((erfuellen, verwerfen) => {
          loesen = () =>
            scheitern ? verwerfen(new Error("Speichern fehlgeschlagen")) : erfuellen();
        }),
    );
    await mount({ isDirty: () => true, save: gesichert });
    const ersatz = mitReloadErsatz();

    const sichernKnopf = (): HTMLButtonElement | undefined =>
      [...document.querySelectorAll("button")].find(
        (b) => (b.textContent ?? "").trim() === i18n.t("nav.guard.save"),
      );

    await act(async () => {
      neuLadenKnopf().click();
      await ruhen();
    });
    await act(async () => {
      sichernKnopf()?.click();
      await ruhen();
    });
    // Die Sicherung LÄUFT NOCH: kein Neuladen, solange nichts gesichert ist.
    expect(gesichert).toHaveBeenCalledTimes(1);
    expect(ersatz.laden, "neu geladen, während die Sicherung noch lief").not.toHaveBeenCalled();

    // Sie scheitert: der Dialog bleibt stehen, es wird NICHT neu geladen.
    await act(async () => {
      loesen?.();
      await ruhen();
    });
    expect(
      ersatz.laden,
      "nach einer GESCHEITERTEN Sicherung neu geladen — genau der Datenverlust",
    ).not.toHaveBeenCalled();
    expect(
      document.querySelector("[data-navguard-dialog]"),
      "der Dialog verschwindet, obwohl nichts gesichert ist",
    ).not.toBeNull();

    // Zweiter Anlauf, diesmal erfolgreich: erst jetzt wird neu geladen.
    scheitern = false;
    await act(async () => {
      sichernKnopf()?.click();
      await ruhen();
    });
    await act(async () => {
      loesen?.();
      await ruhen();
    });
    expect(gesichert).toHaveBeenCalledTimes(2);
    expect(
      ersatz.laden,
      "die gelungene Sicherung führt nicht zur neuen Version",
    ).toHaveBeenCalledTimes(1);
    ersatz.zurueck();
    unmount();
  });
});
