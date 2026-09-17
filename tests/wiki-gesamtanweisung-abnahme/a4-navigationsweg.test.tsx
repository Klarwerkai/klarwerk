// @vitest-environment jsdom
// ================================================================================================
// JOB 4156 · A4 — DIE SEITE IST UNTER IHRER ADRESSE WIRKLICH DA. NOCH NICHT IM MENÜ.
// ================================================================================================
//
// DER AUFTRAG VERLANGT MEHR, ALS HIER GEMESSEN WIRD, und das steht als Erstes da, damit niemand
// diesen Fall für die Erfüllung von Lieferung 5 hält: verlangt ist „über die Navigation erreichbar
// — nicht nur über eine getippte Adresse". Genau das ist NICHT geliefert.
//
// WARUM NICHT: ein Menüpunkt entsteht ausschliesslich in `apps/web/src/app/navigation.ts`
// (`NAV_GROUPS` ist die einzige Quelle, von der Router, Zahnrad-Menü, Schnellnavigation und die
// Rollen-Karte erben). Diese Datei liegt ausserhalb der Zielpfade dieses Auftrags. Runde 1 hat sie
// angefasst und wurde dafür zu Recht zurückgewiesen; in Runde 2 ist die Änderung zurückgenommen.
//
// WAS DIESER FALL DESHALB MISST — und es ist die ehrliche Teilaussage, nicht ihr Ersatz:
//   · die Adresse `/gesamtanweisungen` löst in `routes.tsx` wirklich auf die Fläche auf,
//   · die Adresse `/gesamtanweisungen/:id` ebenfalls, und sie reicht die Kennung durch,
//   · beides in de/en/nl, am gezeichneten DOM.
// Ein Fall, der stattdessen nur `routes.tsx` als Text läse, wäre wertlos: er sähe nicht, dass die
// Route im `*`-Zweig landet und auf die Startseite umleitet.
//
// UND ER HÄLT DIE LÜCKE FEST: der letzte Fall prüft ausdrücklich, dass es KEINEN Menüpunkt gibt.
// Er ist als Schuld gebaut, nicht als Ziel — wer den Menüpunkt nachliefert, macht ihn rot und
// ersetzt ihn durch die positive Erwartung.
//
// GEGENPROBE (gefahren, siehe RUECKGABE): in `routes.tsx` die Zeile
// `<Route path="/gesamtanweisungen" …>` entfernen. Dann leitet der `*`-Zweig auf `/start` um, die
// Fläche erscheint nicht, und die ersten beiden Fälle werden namentlich rot.
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "experte" })),
    logout: vi.fn(async () => ({})),
  },
}));

import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ALL_ITEMS, EXTRA_GUARDED_ITEMS } from "../../apps/web/src/app/navigation";
import {
  BEREICH_MARKE,
  GesamtanweisungBereich,
} from "../../apps/web/src/components/gesamtanweisung/GesamtanweisungBereich";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: async () => {
      throw new Error("kein Netz in diesem Prüfstand");
    },
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  await i18n.changeLanguage("de");
});

/**
 * Die Adresse fahren — mit GENAU der Routentabelle, die `routes.tsx` für diesen Bereich anlegt.
 *
 * Die ganze `AppRoutes` zu mounten wäre hier nicht schärfer, sondern nur langsamer: sie zieht 27
 * nachgeladene Seiten und die volle Hülle mit. Dass die zwei Zeilen wirklich in `routes.tsx`
 * stehen, hält der Fall ganz unten fest.
 */
async function zeige(adresse: string): Promise<void> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        MemoryRouter,
        { initialEntries: [adresse] },
        createElement(
          QueryClientProvider,
          { client },
          createElement(
            AuthProvider,
            null,
            createElement(
              RoleProvider,
              null,
              createElement(
                Routes,
                null,
                createElement(Route, {
                  path: "/gesamtanweisungen",
                  element: createElement(GesamtanweisungBereich),
                }),
                createElement(Route, {
                  path: "/gesamtanweisungen/:id",
                  element: createElement(GesamtanweisungBereich),
                }),
              ),
            ),
          ),
        ),
      ),
    );
  });
  for (let i = 0; i < 8; i += 1) {
    await act(async () => {
      await new Promise((fertig) => setTimeout(fertig, 0));
    });
  }
}

/** Der Text, wie er WIRKLICH in `i18n.ts` steht — nicht hier abgeschrieben. */
function text(sprache: string, schluessel: string): string {
  return String(i18n.getResource(sprache, "translation", schluessel) ?? "");
}

describe("A4 · der Weg zur Gesamtanweisung", () => {
  it("`/gesamtanweisungen` zeigt den Einstieg — mit einem bedienbaren Anlegen-Formular", async () => {
    await zeige("/gesamtanweisungen");
    expect(
      container.querySelector(`[data-testid="${BEREICH_MARKE}"]`),
      "Der Einstieg der Gesamtanweisung erscheint unter seiner Adresse nicht.",
    ).not.toBeNull();
    const formular = container.querySelector(`[data-testid="${BEREICH_MARKE}-anlegen"]`);
    expect(formular, "kein Anlegen-Formular").not.toBeNull();
    expect(container.querySelector('input[name="titel"]'), "kein Titelfeld").not.toBeNull();
  });

  it("`/gesamtanweisungen/:id` reicht die Kennung an die Fläche durch", async () => {
    await zeige("/gesamtanweisungen/a-1");
    expect(
      container.querySelector(`[data-testid="${BEREICH_MARKE}-anweisung"]`),
      "Die geöffnete Anweisung erscheint unter ihrer Adresse nicht.",
    ).not.toBeNull();
    // Der Einstieg darf hier NICHT stehen: eine Adresse, zwei Zustände, nicht beide zugleich.
    expect(container.querySelector(`[data-testid="${BEREICH_MARKE}-anlegen"]`)).toBeNull();
  });

  it("der Einstieg ist in de/en/nl beschriftet — Anwendersprache, kein interner Begriff", async () => {
    for (const sprache of ["de", "en", "nl"]) {
      await act(async () => {
        await i18n.changeLanguage(sprache);
      });
      await zeige("/gesamtanweisungen");
      const inhalt = container.textContent ?? "";
      expect(inhalt, `Titel in ${sprache}`).toContain(text(sprache, "ga.bereich.titel"));
      expect(inhalt, `Knopf in ${sprache}`).toContain(text(sprache, "ga.bereich.anlegen"));
      await act(async () => {
        root.unmount();
      });
      container.remove();
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
    }
  });

  it("der Einstieg behauptet NICHTS über den Bestand — es gibt keine Listenroute", async () => {
    // Abschnitt 9 des Auftrags: keine negative Aussage ohne frische, erfolgreiche Datengrundlage.
    // Ein Satz wie „es ist noch keine Gesamtanweisung angelegt" wäre hier unbelegt.
    await zeige("/gesamtanweisungen");
    const inhalt = (container.textContent ?? "").toLowerCase();
    for (const verboten of ["keine gesamtanweisung", "noch nichts angelegt", "0 anweisungen"]) {
      expect(inhalt, `unbelegte Bestandsaussage: ${verboten}`).not.toContain(verboten);
    }
  });

  it("OFFENE LÜCKE: es gibt KEINEN Menüpunkt — die Seite ist nur über ihre Adresse erreichbar", () => {
    // Lieferung 5 verlangt den Menüpunkt; `navigation.ts` liegt ausserhalb der Zielpfade. Diese
    // Zeile ist die Schuld, nicht das Ziel: wer den Punkt nachliefert, macht sie rot.
    const alle = [...ALL_ITEMS, ...EXTRA_GUARDED_ITEMS];
    const treffer = alle.filter((i) => i.path.startsWith("/gesamtanweisungen"));
    expect(
      treffer.map((i) => i.id),
      "Die Navigation kennt die Gesamtanweisung jetzt doch — dann ist Lieferung 5 erfüllt und dieser Fall gehört durch die positive Erwartung ersetzt.",
    ).toEqual([]);
  });

  it("die zwei Routen stehen wirklich in `routes.tsx` — sonst prüfte dieser Lauf seine eigene Tabelle", () => {
    const quelle = readFileSync("apps/web/src/routes.tsx", "utf8");
    expect(quelle).toContain('<Route path="/gesamtanweisungen" element={<GesamtanweisungBereich');
    expect(quelle).toContain(
      '<Route path="/gesamtanweisungen/:id" element={<GesamtanweisungBereich',
    );
  });
});
