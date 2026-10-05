// @vitest-environment jsdom
// ================================================================================================
// RESTPRÜFUNG GESAMTANWEISUNG · A7 — DER ABGELEHNTE TITEL ÜBERSTEHT DAS NEUZEICHNEN, JE KONTO.
// ================================================================================================
//
// DIE SCHNELLE HÄLFTE ZU `a7-journal-absage-im-echten-prozess.test.ts`. Dort misst ein echtes
// Chromium gegen den echten Serverprozess im Journalbetrieb, dass der abgelehnte Titel nach dem
// Neuladen wieder im Feld steht. Das läuft nur, wo Chromium läuft. Hier stehen die Regeln des
// Merkers selbst, am gezeichneten DOM, im Tor:
//
//   1. Nach einer Absage und einem vollständigen Neuzeichnen (neuer React-Baum, neuer Abfragespeicher
//      — nur `sessionStorage` bleibt, wie beim Neuladen eines Tabs) steht der Titel wieder im Feld.
//   2. Ein ANDERES Konto im selben Tab sieht ihn nicht. Die Abmeldung leert `sessionStorage` nicht;
//      ohne diese Trennung wäre der Merker ein Leck zwischen Konten.
//   2b. BEN R1 (BEN-1): wechselt die bestätigte Sitzung bei MONTIERTER Fläche (kein Neuaufbau, nur
//      `auth/me` frisch), zeigt das Feld den Entwurf des neuen Kontos — nie den des alten —, und eine
//      Eingabe danach überschreibt ausschliesslich den eigenen Merker.
//   3. Nach der BESTÄTIGTEN Anlage ist er fort — sonst stünde ein angelegter Titel beim nächsten
//      Besuch wieder als unbestätigte Arbeit da.
//
// Die Absage ist die echte Drahtform (`ANWEISUNG_ABLAGE_FLUECHTIG`, Status 400), dieselbe wie in
// `tests/wiki-gesamtanweisung-abnahme/a10-absage-bleibt-bedienbar.test.tsx`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";

/** Das Konto, als das die Fläche gerade angemeldet ist — je Fall umstellbar. */
const konto = vi.hoisted(() => ({ id: "u-restpruefung-1" }));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: konto.id, name: "Pia", email: "p@x.de", role: "experte" })),
    logout: vi.fn(async () => ({})),
  },
}));

import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import {
  BEREICH_MARKE,
  GesamtanweisungBereich,
} from "../../apps/web/src/components/gesamtanweisung/GesamtanweisungBereich";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TITEL = "Anlage anfahren (Restpruefung A7, unbestaetigt)";
const ZIEL_MARKE = "a7-restpruefung-ziel";

let container: HTMLDivElement;
let root: Root | undefined;
/** Der Abfragespeicher des gerade montierten Baums — über ihn wird die Sitzung aufgefrischt. */
let client: QueryClient | undefined;

/**
 * Der Server, festgelegt je Fall: die Liste ist leer, das Anlegen antwortet wie angegeben.
 * Dieselbe schlanke Antwortform wie in a10 — `api/client.ts` liest `status`, `ok` und `text()`.
 */
function server(anlegen: { status: number; rumpf: unknown }): void {
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: async (_adresse: unknown, optionen?: { method?: string }) => {
      const schreibt = String(optionen?.method ?? "GET").toUpperCase() === "POST";
      const status = schreibt ? anlegen.status : 200;
      const rumpf = schreibt ? anlegen.rumpf : { eintraege: [] };
      return {
        status,
        ok: status >= 200 && status < 300,
        statusText: String(status),
        text: async () => JSON.stringify(rumpf),
      } as unknown as Response;
    },
  });
}

async function ruhen(): Promise<void> {
  for (let i = 0; i < 12; i += 1) {
    await act(async () => {
      await new Promise((fertig) => setTimeout(fertig, 0));
    });
  }
}

/** Ein vollständig NEUER Baum — wie nach dem Neuladen: nichts aus dem vorigen Zeichnen lebt weiter. */
async function zeichneNeu(): Promise<void> {
  const alt = root;
  if (alt) {
    await act(async () => {
      alt.unmount();
    });
  }
  container.replaceChildren();
  const neu = createRoot(container);
  root = neu;
  const frisch = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client = frisch;
  await act(async () => {
    neu.render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/gesamtanweisungen"] },
        createElement(
          QueryClientProvider,
          { client: frisch },
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

function feld(): HTMLInputElement {
  const f = container.querySelector<HTMLInputElement>('input[name="titel"]');
  expect(f, "kein Titelfeld").not.toBeNull();
  return f as HTMLInputElement;
}

async function legeAn(titel: string): Promise<void> {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(feld(), titel);
    feld().dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    container
      .querySelector(`[data-testid="${BEREICH_MARKE}-anlegen"]`)
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await ruhen();
}

beforeEach(() => {
  window.sessionStorage.clear();
  konto.id = "u-restpruefung-1";
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(async () => {
  const alt = root;
  root = undefined;
  if (alt) {
    await act(async () => {
      alt.unmount();
    });
  }
  container.remove();
  window.sessionStorage.clear();
});

describe("Restprüfung A7 · der unbestätigte Titel übersteht das Neuzeichnen — und nur für sein Konto", () => {
  it("nach der Absage und einem neuen Baum steht der Titel wieder im Feld, der Knopf ist bedienbar", async () => {
    server({
      status: 400,
      rumpf: { error: "ANWEISUNG_ABLAGE_FLUECHTIG", message: "nicht dauerhaft ablegbar" },
    });
    await zeichneNeu();
    await legeAn(TITEL);
    // Vorbedingung: es WAR eine Absage, und es wurde nicht weitergeleitet.
    expect(container.querySelector(`[data-testid="${BEREICH_MARKE}-fehler"]`)).not.toBeNull();
    expect(container.querySelector(`[data-testid="${ZIEL_MARKE}"]`)).toBeNull();

    await zeichneNeu();
    expect(feld().value, "der abgelehnte Titel ist nach dem Neuzeichnen fort").toBe(TITEL);
    const knopf = container.querySelector<HTMLButtonElement>(
      `[data-testid="${BEREICH_MARKE}-anlegen"] button[type="submit"]`,
    );
    expect(knopf?.disabled, "der Knopf ist nach dem Neuzeichnen tot").toBe(false);
    // Die alte Absage gehört zum Versuch davor und steht nicht mehr da.
    expect(container.querySelector(`[data-testid="${BEREICH_MARKE}-fehler"]`)).toBeNull();
  });

  it("ein anderes Konto im selben Tab sieht den Titel NICHT", async () => {
    server({
      status: 400,
      rumpf: { error: "ANWEISUNG_ABLAGE_FLUECHTIG", message: "nicht dauerhaft ablegbar" },
    });
    await zeichneNeu();
    await legeAn(TITEL);

    konto.id = "u-restpruefung-2";
    await zeichneNeu();
    expect(feld().value, "der Titel eines fremden Kontos steht im Feld").toBe("");
    expect(JSON.stringify({ ...window.sessionStorage })).not.toContain("u-restpruefung-2");

    // GEGENPROBE: das erste Konto bekommt ihn zurück — die Trennung ist keine Löschung.
    konto.id = "u-restpruefung-1";
    await zeichneNeu();
    expect(feld().value, "das eigene Konto verliert seinen Titel").toBe(TITEL);
  });

  it("nach der BESTÄTIGTEN Anlage ist der Titel fort — kein angelegter Titel als unbestätigte Arbeit", async () => {
    server({ status: 201, rumpf: { id: "a-restpruefung", version: 1, stand: "entwurf" } });
    await zeichneNeu();
    await legeAn(TITEL);
    // Vorbedingung: die Anlage WURDE bestätigt und die Fläche ist weitergegangen.
    expect(container.querySelector(`[data-testid="${ZIEL_MARKE}"]`)).not.toBeNull();

    await zeichneNeu();
    expect(feld().value, "ein bestätigter Titel steht als unbestätigte Arbeit wieder da").toBe("");
    expect(window.sessionStorage.length, "der Merker bleibt nach der Bestätigung liegen").toBe(0);
  });

  it("wer das Feld leert, verwirft auch den Merker", async () => {
    server({
      status: 400,
      rumpf: { error: "ANWEISUNG_ABLAGE_FLUECHTIG", message: "nicht dauerhaft ablegbar" },
    });
    await zeichneNeu();
    await legeAn(TITEL);
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(feld(), "");
      feld().dispatchEvent(new Event("input", { bubbles: true }));
    });
    await zeichneNeu();
    expect(feld().value).toBe("");
    expect(window.sessionStorage.length).toBe(0);
  });

  it("BEN-1 · Sitzungswechsel OHNE Neuaufbau: jedes Konto sieht und schreibt nur seinen eigenen Entwurf", async () => {
    const A = "u-restpruefung-1";
    const B = "u-restpruefung-2";
    const ENTWURF_A = "Entwurf von Konto A (Restpruefung)";
    const ENTWURF_B = "Entwurf von Konto B (Restpruefung)";
    const merker = (id: string): string | null =>
      window.sessionStorage.getItem(`kw.ga.anlegen.titel.${id}`);
    window.sessionStorage.setItem(`kw.ga.anlegen.titel.${A}`, ENTWURF_A);
    window.sessionStorage.setItem(`kw.ga.anlegen.titel.${B}`, ENTWURF_B);
    server({
      status: 400,
      rumpf: { error: "ANWEISUNG_ABLAGE_FLUECHTIG", message: "nicht dauerhaft ablegbar" },
    });

    /** Die Sitzung wechselt, die Fläche bleibt montiert — nur `auth/me` antwortet jetzt anders. */
    const wechsleZu = async (id: string): Promise<void> => {
      konto.id = id;
      await act(async () => {
        await client?.refetchQueries({ queryKey: ["auth"] });
      });
      await ruhen();
    };
    const baum = root;

    await zeichneNeu();
    expect(feld().value, "A sieht seinen eigenen Entwurf nicht").toBe(ENTWURF_A);
    // Wie in Bens Gegenbeleg: A erhält eine Anlageabsage, sein Titel bleibt im Feld.
    await legeAn(ENTWURF_A);
    expect(container.querySelector(`[data-testid="${BEREICH_MARKE}-fehler"]`)).not.toBeNull();
    const montiert = root;
    expect(montiert, "kein montierter Baum").toBeDefined();
    expect(montiert).not.toBe(baum);

    await wechsleZu(B);
    expect(root, "der Wechsel hat den Baum neu aufgebaut — dann misst der Fall nichts").toBe(
      montiert,
    );
    expect(feld().value, "nach dem Wechsel zu B steht As Titel im Feld").toBe(ENTWURF_B);

    // B arbeitet weiter — geschrieben wird NUR unter Bs Schlüssel.
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(feld(), `${ENTWURF_B} · weiter`);
      feld().dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(merker(B)).toBe(`${ENTWURF_B} · weiter`);
    expect(merker(A), "Bs Eingabe hat As Entwurf verändert").toBe(ENTWURF_A);

    // Zurück zu A, weiterhin ohne Neuaufbau: A sieht seinen Entwurf, Bs bleibt unberührt.
    await wechsleZu(A);
    expect(root).toBe(montiert);
    expect(feld().value, "nach dem Rückwechsel zu A steht Bs Titel im Feld").toBe(ENTWURF_A);
    expect(merker(B)).toBe(`${ENTWURF_B} · weiter`);

    // Und nach dem Neuaufbau (Reload) je Konto genau der eigene Stand.
    await zeichneNeu();
    expect(feld().value).toBe(ENTWURF_A);
    konto.id = B;
    await zeichneNeu();
    expect(feld().value, "Bs Entwurf ist nach dem Neuaufbau überschrieben").toBe(
      `${ENTWURF_B} · weiter`,
    );
  });
});
