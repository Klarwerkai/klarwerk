// @vitest-environment jsdom
// ================================================================================================
// JOB 4309 · A10 — DER BEDIENTE ABSAGETEST, DAUERHAFT ÜBERNOMMEN (BENs Empfehlung zu 4156 R3).
// ================================================================================================
//
// BEN WÖRTLICH (`archiv/4156/runde-3/ben.md:23` und `:30`): „A7 prüft Übersetzungsschlüssel, nicht
// die Bedienung … Empfehlung: meinen DOM-Fall dauerhaft übernehmen" — „de/en/nl, Eingabe bleibt
// erhalten, keine Erfolgsnavigation."
//
// SEIN FALL LAG IN `/tmp` (`ben.md:14`) und war damit beim nächsten Neustart weg. Hier steht er im
// Bestand, und zwar an der Stelle, an der er hingehört: die ABNAHME des Anschlusses.
//
// ------------------------------------------------------------------------------------------------
// WAS ER MISST UND WAS EIN SCHLÜSSELVERGLEICH NICHT MESSEN KANN
// ------------------------------------------------------------------------------------------------
// `a7-desktop-journal-kein-stiller-verlust.test.ts` prüft, dass es den Satz GIBT. Das sagt nichts
// darüber, ob er an der Fläche ankommt, ob die Eingabe des Menschen dabei stehen bleibt und ob die
// Fläche trotz Absage weiterspringt. Genau diese drei Dinge werden hier am gezeichneten DOM
// gemessen — in allen drei Sprachen, denn ein Satz, der nur auf Deutsch ankommt, ist für zwei
// Drittel der Zielgruppe keiner.
//
// DIE KALIBRIERUNG STEHT DANEBEN UND IST PFLICHT: „keine Erfolgsnavigation" wäre trivial wahr, wenn
// diese Fläche überhaupt nie navigierte. Der letzte Fall legt deshalb erfolgreich an und zeigt, dass
// die Weiterleitung sehr wohl stattfindet — erst damit ist ihr Ausbleiben eine Aussage.
//
// DIE ABSAGE IST DIE ECHTE: `{"error":"ANWEISUNG_ABLAGE_FLUECHTIG"}` mit Status 400, genau so, wie
// `services/app/src/build-app.ts` sie schickt, wenn die Instanz nicht dauerhaft ablegen kann, und
// genau so, wie `api.ts:104` sie liest (der Code, NICHT der Status — 400 tragen auch `VALIDATION`
// und `INVALID`).
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
  BEREICH_MARKE,
  GesamtanweisungBereich,
} from "../../apps/web/src/components/gesamtanweisung/GesamtanweisungBereich";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SPRACHEN = ["de", "en", "nl"] as const;
const TITEL = "Anlage anfahren (JOB 4309)";
/** Die Marke der Zielseite — sie erscheint NUR, wenn wirklich navigiert wurde. */
const ZIEL_MARKE = "a10-ziel-der-navigation";

let container: HTMLDivElement;
let root: Root;

/** Der Text, wie er WIRKLICH in `i18n.ts` steht — nicht hier abgeschrieben. */
function text(sprache: string, schluessel: string): string {
  return String(i18n.getResource(sprache, "translation", schluessel) ?? "");
}

/**
 * Die Antwort des Servers, festgelegt je Fall.
 *
 * Absichtlich KEIN `new Response(...)`: die jsdom-Umgebung bringt die Fetch-Klassen nicht
 * verlässlich mit, und `api/client.ts` liest genau drei Dinge — `status`, `ok` und `text()`
 * (dieselbe Begründung wie in `tests/wiki-gesamtanweisung/f9-oberflaeche.test.tsx:100-102`).
 */
function antworte(status: number, rumpf: unknown): void {
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: async () =>
      ({
        status,
        ok: status >= 200 && status < 300,
        statusText: String(status),
        text: async () => JSON.stringify(rumpf),
      }) as unknown as Response,
  });
}

beforeEach(() => {
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

/** Den Einstieg zeichnen — MIT einer zweiten Route, damit eine Navigation sichtbar würde. */
async function zeigeEinstieg(): Promise<void> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/gesamtanweisungen"] },
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
                // Die Zielseite ist ABSICHTLICH nicht der Bereich selbst: so lässt sich
                // „navigiert" von „neu gezeichnet" unterscheiden.
                createElement(Route, {
                  path: "/gesamtanweisungen/:id",
                  element: createElement("p", { "data-testid": ZIEL_MARKE }, "Ziel"),
                }),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await ruhen();
}

async function ruhen(): Promise<void> {
  for (let i = 0; i < 12; i += 1) {
    await act(async () => {
      await new Promise((fertig) => setTimeout(fertig, 0));
    });
  }
}

/** Tippen, wie ein Mensch tippt — React hört auf den nativen Setter plus Ereignis. */
function tippe(element: HTMLInputElement, wert: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(element, wert);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

/** Titel eintragen und absenden — über `submit`, also den Enter-Weg, nicht über ein Zeigegerät. */
async function legeAn(titel: string): Promise<void> {
  const feld = container.querySelector<HTMLInputElement>('input[name="titel"]');
  expect(feld, "kein Titelfeld").not.toBeNull();
  await act(async () => {
    tippe(feld as HTMLInputElement, titel);
  });
  const formular = container.querySelector<HTMLFormElement>(
    `[data-testid="${BEREICH_MARKE}-anlegen"]`,
  );
  expect(formular, "kein Anlegen-Formular").not.toBeNull();
  await act(async () => {
    (formular as HTMLFormElement).dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
  await ruhen();
}

describe("JOB 4309 A10 · eine abgelehnte Speicherung ist sichtbar, bedienbar und folgenlos", () => {
  for (const sprache of SPRACHEN) {
    it(`${sprache}: die Absage steht da, der Titel bleibt stehen, es wird NICHT weitergeleitet`, async () => {
      antworte(400, {
        error: "ANWEISUNG_ABLAGE_FLUECHTIG",
        message: "Diese Instanz kann Anweisungen nicht dauerhaft ablegen.",
      });
      await act(async () => {
        await i18n.changeLanguage(sprache);
      });
      await zeigeEinstieg();
      await legeAn(TITEL);

      // 1. DIE ABSAGE IST SICHTBAR — als Satz in Anwendersprache, nicht als roher Code.
      const absage = container.querySelector(`[data-testid="${BEREICH_MARKE}-fehler"]`);
      expect(absage, `${sprache}: die Absage erscheint gar nicht`).not.toBeNull();
      const satz = text(sprache, "ga.ablageFluechtig");
      expect(satz.length, `${sprache}: der Absagesatz fehlt im Sprachbestand`).toBeGreaterThan(0);
      expect(
        (absage as Element).textContent,
        `${sprache}: es steht ein anderer Satz da als der des Servers`,
      ).toContain(satz);
      expect(
        (absage as Element).textContent,
        `${sprache}: der Maschinencode steht auf der Fläche`,
      ).not.toContain("ANWEISUNG_ABLAGE_FLUECHTIG");
      // Sie wird ANGESAGT, nicht nur gezeigt: ohne `role="alert"` liest ein Screenreader sie nicht.
      expect((absage as Element).getAttribute("role")).toBe("alert");

      // 2. DIE EINGABE BLEIBT STEHEN — der erneute Versuch ist erreichbar und nicht hinter einem
      //    Neuladen versteckt.
      const feld = container.querySelector<HTMLInputElement>('input[name="titel"]');
      expect(feld?.value, `${sprache}: der getippte Titel ist weg`).toBe(TITEL);
      const knopf = container.querySelector<HTMLButtonElement>(
        `[data-testid="${BEREICH_MARKE}-anlegen"] button[type="submit"]`,
      );
      expect(knopf?.disabled, `${sprache}: der Knopf bleibt nach der Absage tot`).toBe(false);

      // 3. KEINE ERFOLGSNAVIGATION — die Zielseite ist nicht gezeichnet.
      expect(
        container.querySelector(`[data-testid="${ZIEL_MARKE}"]`),
        `${sprache}: die Fläche ist trotz Absage weitergesprungen — der Mensch glaubt, es sei angelegt`,
      ).toBeNull();
      expect(
        container.querySelector(`[data-testid="${BEREICH_MARKE}-anlegen"]`),
        `${sprache}: das Formular ist verschwunden`,
      ).not.toBeNull();
    });
  }

  // ==============================================================================================
  // DIE KALIBRIERUNG — ohne sie wäre „keine Erfolgsnavigation" trivial wahr.
  // ==============================================================================================
  it("KALIBRIERUNG: bei einer bestätigten Anlage wird sehr wohl weitergeleitet — mit der Kennung des Servers", async () => {
    antworte(201, { id: "a-4309", version: 1, stand: "entwurf", titel: TITEL });
    await zeigeEinstieg();
    await legeAn(TITEL);
    expect(
      container.querySelector(`[data-testid="${ZIEL_MARKE}"]`),
      "eine bestätigte Anlage führt nirgendwohin — dann sagt der Fall darüber nichts aus",
    ).not.toBeNull();
    expect(container.querySelector(`[data-testid="${BEREICH_MARKE}-fehler"]`)).toBeNull();
  });

  it("KALIBRIERUNG: ein leerer Titel löst gar keinen Versuch aus — die Absage kommt nicht von der Eingabe", async () => {
    let gerufen = 0;
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: async () => {
        gerufen += 1;
        throw new Error("hier darf gar nichts gerufen werden");
      },
    });
    await zeigeEinstieg();
    await legeAn("   ");
    expect(gerufen, "ein leerer Titel geht an den Server").toBe(0);
    expect(container.querySelector(`[data-testid="${BEREICH_MARKE}-fehler"]`)).toBeNull();
    expect(container.querySelector(`[data-testid="${ZIEL_MARKE}"]`)).toBeNull();
  });
});
