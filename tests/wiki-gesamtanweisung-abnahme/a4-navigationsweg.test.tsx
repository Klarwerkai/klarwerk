// @vitest-environment jsdom
// ================================================================================================
// JOB 4156/4309 · A4 — DIE SEITE IST UNTER IHRER ADRESSE DA. UND SEIT JOB 4309 IM MENÜ.
// ================================================================================================
//
// JOB 4156 KONNTE LIEFERUNG 5 NICHT ERFÜLLEN, und das stand hier als Schuld: verlangt ist „über die
// Navigation erreichbar — nicht nur über eine getippte Adresse". Ein Menüpunkt entsteht
// ausschliesslich in `apps/web/src/app/navigation.ts` (`NAV_GROUPS` ist die einzige Quelle, von der
// Router, Zahnrad-Menü, Schnellnavigation und die Rollen-Karte erben), und diese Datei lag
// ausserhalb der Zielpfade von 4156.
//
// JOB 4309 HAT SIE IN DEN ZIELPFADEN und liefert den Punkt nach. Der letzte Fall unten war als
// Schuld gebaut („es gibt KEINEN Menüpunkt") und ist mit dem Eintrag rot geworden (Arbeitsprüfung
// cd46bb7ceb9b46b5a937f1296b645814); er steht jetzt in seiner positiven Form an derselben Stelle
// und misst DREI Dinge, die einzeln schiefgehen können: der Eintrag ist da, eine berechtigte Rolle
// sieht ihn, eine unberechtigte NICHT.
//
// WAS DIESE DATEI SONST MISST — unverändert:
//   · die Adresse `/gesamtanweisungen` löst wirklich auf die Fläche auf,
//   · die Adresse `/gesamtanweisungen/:id` ebenfalls, und sie reicht die Kennung durch,
//   · beides in de/en/nl, am gezeichneten DOM.
// Ein Fall, der stattdessen nur `routes.tsx` als Text läse, wäre wertlos: er sähe nicht, dass die
// Route im `*`-Zweig landet und auf die Startseite umleitet.
//
// DIE ROUTENQUELLE HAT SICH DABEI GEÄNDERT, und der letzte Fall führt das nach: `/gesamtanweisungen`
// steht seit JOB 4309 NICHT mehr als eigene `<Route>`-Zeile in `routes.tsx`, sondern entsteht aus
// `GUARDED_ITEMS.map(…)` — eine Routenquelle, nicht zwei Definitionen für denselben Pfad. Nur
// `/gesamtanweisungen/:id` bleibt eine eigene Zeile (keine Detailseite bekommt einen Menüpunkt,
// JOB 562).
//
// GEGENPROBEN (gefahren, siehe RUECKGABE): den Menüeintrag aus `NAV_GROUPS` nehmen → der Menüfall
// und der Sichtbarkeitsfall werden namentlich rot; in `routes.tsx` die `:id`-Zeile entfernen → der
// zweite Fall wird rot, weil der `*`-Zweig auf `/start` umleitet.
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
import {
  ALL_ITEMS,
  EXTRA_GUARDED_ITEMS,
  NAV_GROUPS,
  type NavItem,
  canSee,
  istAktiverEintrag,
} from "../../apps/web/src/app/navigation";
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

  it("JOB 4309: die Gesamtanweisung IST ein Menüpunkt — genau einer, mit ihrem Pfad", () => {
    const alle = [...ALL_ITEMS, ...EXTRA_GUARDED_ITEMS];
    const treffer = alle.filter((i) => i.path.startsWith("/gesamtanweisungen"));
    expect(
      treffer.map((i) => i.id),
      "Die Navigation kennt die Gesamtanweisung nicht — dann ist sie nur über eine getippte Adresse erreichbar, und genau das verbietet Pedis Zeile.",
    ).toEqual(["gesamtanweisungen"]);
    const punkt = treffer[0] as NavItem;
    expect(punkt.path, "der Menüpunkt zeigt nicht auf den Einstieg").toBe("/gesamtanweisungen");
    // Er steht in den GRUPPEN und nicht im Fuss oder in einer Nebenliste: nur von dort erben
    // Zahnrad-Menü, Schnellnavigation und Rollen-Karte (`navigation.ts`, Kopf von NAV_GROUPS).
    expect(
      NAV_GROUPS.flatMap((g) => g.items).map((i) => i.id),
      "der Punkt steht nicht in NAV_GROUPS — dann erbt ihn kein Menü",
    ).toContain("gesamtanweisungen");
  });

  it("JOB 4309: eine berechtigte Rolle sieht ihn, eine unberechtigte NICHT", () => {
    // DIE SCHRANKE IST DIE RECHTELAGE DER ROUTENGRUPPE: der Einstieg ist ein Formular, das
    // `POST /api/gesamtanweisungen` ruft, und diese Tür fordert `ko.create` — gemessen in
    // `a1-tuer-in-der-gebauten-app.test.ts` („der Gast kommt gar nicht erst zum Anlegen", 403).
    // Ohne diesen Fall wäre auch ein Punkt erfüllt, den JEDE Rolle sieht.
    const punkt = ALL_ITEMS.find((i) => i.id === "gesamtanweisungen") as NavItem;
    expect(punkt, "der Menüpunkt fehlt").toBeDefined();
    expect(canSee(punkt, "experte", false), "der Experte sieht seinen eigenen Bereich nicht").toBe(
      true,
    );
    expect(canSee(punkt, "controller", false)).toBe(true);
    expect(canSee(punkt, "admin", false)).toBe(true);
    expect(
      canSee(punkt, "viewer", false),
      "die Betrachterin sieht einen Punkt, dessen einzige Handlung sie mit 403 abweist",
    ).toBe(false);
    // Und er hängt NICHT am Erweitert-Schalter: er wäre sonst für die berechtigte Rolle unsichtbar,
    // solange Stufe 2 aus ist — dasselbe Ergebnis wie gar kein Punkt.
    expect(punkt.stufe2 ?? false).toBe(false);
  });

  it("JOB 4309: die geöffnete Anweisung behält ihren Ort im Menü — ohne zweiten Eintrag", () => {
    // Der Auftrag verlangt, dass `/gesamtanweisungen/:id` den Punkt aktiv hält. Das leistet die
    // Präfixregel von `istAktiverEintrag` schon von selbst; ein `aktivAuchUnter` mit dem EIGENEN
    // Pfad wäre eine zweite Wahrheit über dieselbe Frage. Hier steht, dass es wirklich trägt.
    const punkt = ALL_ITEMS.find((i) => i.id === "gesamtanweisungen") as NavItem;
    expect(istAktiverEintrag(punkt, "/gesamtanweisungen")).toBe(true);
    expect(
      istAktiverEintrag(punkt, "/gesamtanweisungen/a-1"),
      "auf der geöffneten Anweisung ist kein Menüpunkt ausgezeichnet — die Nutzerin verliert ihren Ort",
    ).toBe(true);
    // Die Segmentgrenze gilt weiterhin: ein Nachbar mit gleichem Anfang zählt NICHT.
    expect(istAktiverEintrag(punkt, "/gesamtanweisungenX")).toBe(false);
    // Und es gibt wirklich nur EINEN Eintrag — keine eigene Zeile für die Detailseite (JOB 562).
    expect(
      [...ALL_ITEMS, ...EXTRA_GUARDED_ITEMS].filter((i) => i.path.includes("/gesamtanweisungen/")),
    ).toEqual([]);
  });

  it("die Routenquelle stimmt: der Einstieg kommt aus GUARDED_ITEMS, die `:id`-Zeile aus routes.tsx", () => {
    const quelle = readFileSync("apps/web/src/routes.tsx", "utf8");
    // ZWEI DEFINITIONEN FÜR DENSELBEN PFAD WÄREN DER FEHLER: stünde die Einstiegsroute weiterhin
    // als eigene Zeile da, gewänne sie gegen `GUARDED_ITEMS.map(…)` und die Seite hätte kein
    // Rollen-Gate mehr — genau der Zustand, den JOB 4156 ehrlich ausgewiesen hat.
    expect(
      quelle,
      "`/gesamtanweisungen` steht noch als eigene Route neben GUARDED_ITEMS — zwei Definitionen für denselben Pfad",
    ).not.toContain('<Route path="/gesamtanweisungen" element={<GesamtanweisungBereich');
    expect(quelle).toContain(
      '<Route path="/gesamtanweisungen/:id" element={<GesamtanweisungBereich',
    );
    // Der Einstieg braucht seinen Seiteneintrag, sonst fiele die berechtigte Rolle auf
    // `PlaceholderPage` (`Guarded`, routes.tsx) — ein Menüpunkt, der ins Leere führt.
    expect(quelle, "kein PAGES-Eintrag für den Menüpunkt").toContain(
      "gesamtanweisungen: GesamtanweisungBereich",
    );
  });
});
