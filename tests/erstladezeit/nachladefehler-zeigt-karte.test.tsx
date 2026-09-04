// @vitest-environment jsdom
// ================================================================================================
// JOB 3030 — WENN EIN NACHGELADENES STÜCK NICHT KOMMT, STEHT DA EINE KARTE MIT AUSWEG.
// ================================================================================================
//
// DIE LÜCKE, DIE DIESE DATEI SCHLIESST (ben, JOB 3030 R4, Prüfpunkt 6): „Ein echter
// `AppRoutes`-Mount mit kontrolliert abgelehntem Seitenimport fehlt; vorgeschlagen ist eine Prüfung
// auf Fehlerkarte und Neu-laden-Knopf."
//
// WARUM DAS EIN EIGENER FALL SEIN MUSS. Vor JOB 3030 KONNTE eine Seite nicht „nicht ankommen": ihr
// Code lag im Eintritt, und wenn der da war, war sie da. Seit der Aufteilung ist das Nachladen ein
// eigener Netzweg mit eigenem Fehlerfall — abgebrochene Verbindung, Auslieferung einer neuen
// Fassung während die Seite offen ist, ein Zwischenspeicher, der ein Stück nicht mehr findet. Der
// Auftrag hat in §8.5 zugesagt, das sei „keine weiße Seite", weil die vorhandene Fehlergrenze
// greife. Bis hierher war das eine Behauptung über fremden Code, nicht eine Messung.
//
// WIE HIER GEMESSEN WIRD. Zwei Seitenmodule werden so ersetzt, dass ihr `import()` ABLEHNT — genau
// das, was ein fehlgeschlagener Abruf im Browser auslöst. Danach wird die ECHTE `AppRoutes`
// gemountet und gelesen, was auf der Fläche steht.
//
// WELCHE KONTEXTE DABEI WIRKLICH STEHEN — genau vier, und keiner mehr (ben, JOB 3030 R5,
// Korrekturpflicht 2; hier stand vorher die zu weite Behauptung „dieselben Kontexte wie in
// `App.tsx`"):
//     `QueryClientProvider` · `AuthProvider` · `RoleProvider` · `MemoryRouter`
// `AuthProvider` und `RoleProvider` stehen, weil `Guarded` (`routes.tsx:136`) `useRole` liest und
// dieses ohne Provider wirft; `QueryClientProvider`, weil `AuthProvider` `useQuery` benutzt; der
// Router, weil `AppRoutes` Routen auflöst. NICHT montiert sind `ToastProvider`,
// `ImageDescribeProvider`, `NavGuardProvider` und `AppShell` — keiner von ihnen liegt auf dem Weg
// vom fehlgeschlagenen Nachladen zur Fehlerkarte, und was hier nicht steht, soll auch nicht
// behauptet werden. Der Preis, benannt: wanderte die Fehlergrenze eines Tages in die `AppShell`,
// würde dieser Test es nicht sehen — er misst `AppRoutes` und seine eigene äußere Grenze.
//
// DER MARKER `rahmen` IST DER GANZE UNTERSCHIED zwischen den beiden Fällen. Er steht INNERHALB der
// äußeren Fehlergrenze (der Stelle, die in `App.tsx:105` die ganze Anwendung umschließt), aber
// AUSSERHALB von `AppRoutes`:
//   · Fängt die INNERE Grenze aus `Guarded` (`routes.tsx:148`), bleibt der Marker stehen — nur die
//     Seite ist weg, der Rahmen der Anwendung steht.
//   · Fängt erst die ÄUSSERE, verschwindet er mit. Dann hat der Fehler `AppRoutes` verlassen.
// Ohne diesen Marker sähen beide Fälle im DOM gleich aus (dieselbe Karte), und der Test könnte den
// Unterschied nicht benennen, den er messen soll.
//
// DIE OFFENE KANTE, die dieser Test nicht schließt, sondern BELEGT (Fall F3): die vier direkt in
// `AppRoutes` hängenden Routen (`/wissen/:id`, `/erfassen/neu`, `/mobile`, `/ui-kit`) haben KEINE
// eigene Fehlergrenze — sie laufen bis zur äußeren. Der Mensch sieht auch dort eine Karte mit
// Neu-laden-Knopf und keine weiße Seite, aber die Shell geht mit. Das war vor JOB 3030 nicht
// erreichbar (statischer Import) und ist seither eine echte, gemessene Kante. Sie zu schließen
// hieße, die Fehlergrenze umzubauen — das schließt der Auftrag in §10 aus, also wird sie hier
// gemessen und in der Rückgabe benannt statt stillschweigend hingenommen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// SO WIRD DER FEHLSCHLAG ERZEUGT — und der Weg dorthin ist selbst ein Messergebnis. Der erste
// Versuch ließ die `vi.mock`-Fabrik WERFEN. Das erzeugte zwar eine Fehlerkarte, aber mit vitests
// eigener Meldung („There was an error when mocking a module") statt mit unserer: vitest fängt die
// Ausnahme der Fabrik ab und ersetzt sie. Der Test hätte dann eine Karte gemessen, deren Ursache er
// nicht kennt — genau die Sorte Beleg, die nichts belegt.
//
// DESHALB WIRFT JETZT DER ZUGRIFF AUF DEN EXPORT. `routes.tsx` holt die Seite als
// `import("./pages/Library").then((m) => ({ default: m.Library }))`; der Zugriff `m.Library` läuft
// in den Getter, dieser wirft, und `React.lazy` bekommt ein abgelehntes Promise MIT unserer
// Meldung. Das ist dieselbe Lage wie ein Stück, das im Browser nicht ankommt: das Modul steht nicht
// zur Verfügung, wenn die Route es braucht.
vi.mock("../../apps/web/src/pages/Library", () => ({
  get Library(): never {
    throw new Error("JOB 3030 Testfall: Stück der Bibliothek nicht ladbar");
  },
}));
vi.mock("../../apps/web/src/pages/UiKit", () => ({
  get UiKit(): never {
    throw new Error("JOB 3030 Testfall: Stück des UiKit nicht ladbar");
  },
}));

const GRUND_BEWACHT = "JOB 3030 Testfall: Stück der Bibliothek nicht ladbar";
const GRUND_DIREKT = "JOB 3030 Testfall: Stück des UiKit nicht ladbar";

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import "../../apps/web/src/i18n";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ErrorBoundary } from "../../apps/web/src/components/ErrorBoundary";
import i18n from "../../apps/web/src/i18n";
import { AppRoutes } from "../../apps/web/src/routes";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Kein Netz im Test: die Sitzungsabfrage soll scheitern, nicht hängen. Ohne Sitzung gilt die
// Vorschau-Rolle `experte`; `/bibliothek` verlangt `viewer` und ist damit erlaubt — die
// Rollenprüfung liegt VOR dem Nachladen und darf hier gerade nicht zuschlagen.
const KEIN_NETZ = (): Promise<never> =>
  Promise.reject(new Error("JOB 3030 Testfall: kein Netz für die Sitzungsabfrage"));

let container: HTMLDivElement | null = null;
let root: { render(n: unknown): void; unmount(): void } | null = null;
let fehlerAusgaben: string[] = [];
let konsoleZurueck: (() => void) | null = null;

const MARKER = "rahmen-steht";

async function ruhen(): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

async function mounten(pfad: string): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root?.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              MemoryRouter,
              { initialEntries: [pfad] },
              // Dieselbe Grenze, die `App.tsx:105` um die ganze Anwendung legt — und der Marker
              // darin, aber außerhalb von `AppRoutes`.
              createElement(
                ErrorBoundary,
                null,
                createElement("p", { "data-t": MARKER }, MARKER),
                createElement(AppRoutes),
              ),
            ),
          ),
        ),
      ),
    );
    await ruhen();
  });
  await act(ruhen);
}

const text = (): string => (container?.textContent ?? "").replace(/\s+/g, " ");

function neuLadenKnopf(): HTMLButtonElement | null {
  const beschriftung = i18n.t("error.reload");
  const treffer = [...(container?.querySelectorAll("button") ?? [])].find((b) =>
    (b.textContent ?? "").includes(beschriftung),
  );
  return treffer instanceof HTMLButtonElement ? treffer : null;
}

beforeEach(() => {
  (globalThis as unknown as { fetch: () => Promise<never> }).fetch = KEIN_NETZ;
  // Die Fehlergrenze schreibt bewusst nach `console.error` (`ErrorBoundary.tsx:25`). Das ist hier
  // erwartete Ausgabe und kein Rauschen — sie wird eingesammelt und unten als Beleg GELESEN,
  // statt sie stumm zu schalten.
  fehlerAusgaben = [];
  const original = console.error;
  console.error = (...args: unknown[]): void => {
    fehlerAusgaben.push(args.map((a) => String(a)).join(" "));
  };
  konsoleZurueck = () => {
    console.error = original;
  };
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    root = null;
  }
  container?.remove();
  container = null;
  konsoleZurueck?.();
  konsoleZurueck = null;
});

describe("JOB 3030 · ein Stück, das nicht kommt, ist keine weiße Seite", () => {
  it("F1 · bewachte Route: die Fehlerkarte steht IN der Anwendung, mit Neu-laden-Knopf", async () => {
    await mounten("/bibliothek");

    // 1. Es ist wirklich UNSER Fehler, der die Karte erzeugt — nicht irgendeiner. Das Fehlerdetail
    //    der Karte (`ErrorBoundary.tsx:52`) trägt die Meldung wörtlich.
    expect(text(), "die Karte muss den echten Grund nennen, nicht einen erfundenen").toContain(
      GRUND_BEWACHT,
    );
    // 2. Titel, Text und Detail-Vorspann stehen da — die ehrliche Karte, nicht eine leere Fläche.
    expect(text()).toContain(i18n.t("error.title"));
    expect(text()).toContain(i18n.t("error.body"));
    expect(text()).toContain(i18n.t("error.detail"));
    // 3. Der AUSWEG ist da und ist ein bedienbarer Knopf.
    const knopf = neuLadenKnopf();
    expect(knopf, "ohne Neu-laden-Knopf bliebe der Mensch mit der Karte allein").not.toBeNull();
    expect((knopf as HTMLButtonElement).disabled).toBe(false);
    // 4. Und die Ladefläche ist WEG: „Lädt …" wäre jetzt eine Lüge, das Stück kommt nicht mehr.
    expect(
      text(),
      "nach dem Fehlschlag darf die Fläche nicht weiter behaupten, etwas sei unterwegs",
    ).not.toContain(i18n.t("state.loading"));
    // 5. DER UNTERSCHIED: der Rahmen steht noch. Die innere Grenze aus `Guarded` hat gefangen.
    expect(
      container?.querySelector(`[data-t="${MARKER}"]`),
      "bei einer bewachten Route darf nur die SEITE verschwinden, nicht die ganze Anwendung",
    ).not.toBeNull();
    // 6. Und die Grenze hat den Fehler auch protokolliert — kein stiller Absturz.
    expect(fehlerAusgaben.join(" ")).toContain("[KLARWERK] UI-Fehler abgefangen:");
  });

  it("F2 · der Neu-laden-Knopf lädt wirklich neu", async () => {
    await mounten("/bibliothek");
    const knopf = neuLadenKnopf();
    expect(knopf).not.toBeNull();
    // jsdom bringt `location.reload` nicht mit; ohne diesen Ersatz wäre der Klick eine leere
    // Behauptung. Gemessen wird der AUFRUF, nicht das Neuladen selbst. Der Ersatz wird am Ende
    // ZURÜCKGENOMMEN — ein halb ausgetauschtes `window.location` wäre eine Falle für jeden Fall,
    // der danach in derselben Datei läuft.
    const echteLage = window.location;
    const laden = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload: laden },
    });
    await act(async () => {
      (knopf as HTMLButtonElement).click();
      await ruhen();
    });
    expect(laden, "der Knopf muss den einzigen richtigen Ausweg wirklich gehen").toHaveBeenCalled();
    Object.defineProperty(window, "location", { configurable: true, value: echteLage });
  });

  it("F3 · direkt gehängte Route: der Fehler verlässt AppRoutes — gemessen, nicht behauptet", async () => {
    await mounten("/ui-kit");

    // Auch hier: eine ehrliche Karte mit Ausweg, keine weiße Seite.
    expect(text()).toContain(GRUND_DIREKT);
    expect(text()).toContain(i18n.t("error.title"));
    expect(neuLadenKnopf(), "auch der äußere Weg muss den Ausweg anbieten").not.toBeNull();
    // ABER: der Marker ist mit verschwunden. `/ui-kit` hängt ohne `Guarded` und damit ohne eigene
    // Grenze in `AppRoutes` (`routes.tsx:170`); gefangen hat erst die äußere. Das ist die offene
    // Kante dieses Auftrags, und sie steht hier als Messwert statt als Vermutung.
    expect(
      container?.querySelector(`[data-t="${MARKER}"]`),
      "Ändert sich das, ist eine eigene Fehlergrenze für die direkt gehängten Routen dazugekommen " +
        "— dann gehört diese Zusicherung umgedreht und die Kante in der Doku gestrichen.",
    ).toBeNull();
  });
});
