// @vitest-environment jsdom
// ================================================================================================
// JOB 3605 · ENTWUERFE-MENUEPUNKT OHNE SONDERSTELLUNG — AUF DEM SCHMALEN BAND STEHT KEIN PUNKT MEHR
// ALLEIN NEBEN DEM LOGO.
// ================================================================================================
//
// PEDIS VORGABE (11.09.2026, Vormittag, über Codex, Nachricht 0bd3a41e, zum Bildschirmfoto
// „Screenshot 2026-09-11 at 09.16.52.png"): bei schmaler Webfläche stand „Meine Entwürfe" allein
// neben dem Logo. Er verlangt, der Punkt sei „normaler Teil der gesamten Navigation, keine
// Sonderstellung / kein immer sichtbarer Sonderknopf"; der Zugang solle „wie die übrigen Punkte ins
// Menü wandern".
//
// DAS IST KEINE UMKEHR EINER ENTSCHEIDUNG, SONDERN EINE RÜCKNAHME EINER AUSLEGUNG. Codex hat das am
// 11.09. um 09:36 richtiggestellt: „Meine Entwürfe" war von Pedi von Anfang an als normaler Punkt
// wie „Bibliothek" verlangt. Die Sonderstellung (JOB 3525, `KopfbandPunkteSchmal`) entstand beim
// Bauen als gut gemeinte Antwort auf Pedis echten Befund vom 10.09. 09:05 („ich finde es nicht") —
// die richtige Antwort darauf ist das BESCHRIFTETE Menü, das JOB 3525 ebenfalls gebaut hat, nicht
// ein bevorzugter Einzelpunkt daneben.
//
// WAS DIESE DATEI MISST, und warum sie neben der Schwesterdatei steht: `kopfband-schmal.test.tsx`
// trägt die Zusagen von JOB 3525 und ist dort nachgeführt, wo sie das alte Verhalten festschrieben.
// HIER steht die Zusage von JOB 3605 als eigene, positiv formulierte Aussage — damit ein späterer
// Umbau nicht bloss eine abgeschwächte Erwartung passieren lässt, sondern an einem Satz scheitert,
// der Pedis Vorgabe nennt.
//
// GEMESSEN WIRD AN DER ECHTEN HÜLLE (`shell/AppShell.tsx`) mit einer echten Breitenauswertung —
// dieselbe Bauart wie in der Schwesterdatei, dieselbe Begründung: es geht um zwei Bänder, nicht um
// einen Schalter.
//
// EHRLICHE GRENZE, ausdrücklich benannt: jsdom rechnet KEIN Layout. „Kein Punkt steht bevorzugt
// neben dem Logo" ist hier eine Aussage über den BAUM. Dass die Zeile danach auch wirklich trägt
// (56 px, kein Überlauf, keine Überlappung), misst Chromium —
// `kopfband-schmal-chromium.test.ts` (ohne Firmen-CI) und `kopfband-ci-chromium.test.ts` (mit).
//
// DIE FÄLLE:
//   N1  760 / 800 / 899 px: im Kopfband steht KEIN Navigationspunkt — keiner ist bevorzugt
//   N2  760 / 800 / 899 px: „Meine Entwürfe" steht hinter dem Menü-Knopf und ÖFFNET seine Route
//   N3  760 / 800 / 899 px: dort steht die VOLLE Reihe der Rolle — alle auf demselben Weg
//   N4  1000 px: die breite Bauform ist unberührt — volle Punktreihe oben, kein Menü-Knopf
//   N5  „Gehe zu …" bleibt auf dem Band ein Knopf (Auftrag §3.3: eine Funktion, kein Punkt)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    // `experte` ist die kleinste Rolle, die „Meine Entwürfe" sieht (navigation.ts, `minRole`).
    // Mit `viewer` gäbe es den Punkt gar nicht und jeder Fall hier wäre leer.
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "experte" })),
    logout: vi.fn(async () => ({})),
  },
}));

// Derselbe breite Endpoints-Mock wie in der Schwesterdatei: jede Namenskette liefert eine Funktion,
// die `[]` auflöst. Die Hülle ruft an mehr Stellen ab, als dieser Auftrag berührt.
vi.mock("../../apps/web/src/api/endpoints", () => {
  const make = (): unknown =>
    new Proxy(
      vi.fn(async () => []),
      {
        get(target, prop, recv) {
          if (prop in target || typeof prop === "symbol") {
            return Reflect.get(target, prop, recv);
          }
          return make();
        },
      },
    );
  return { endpoints: make() };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, useLocation } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { canSee, kopfbandItems } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
import { AppShell } from "../../apps/web/src/shell/AppShell";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

/**
 * Die Breiten des Auftrags §5. 760, 800 und 899 sind das obere schmale Band; 1000 ist die breite
 * Bauform und steht hier als Gegenprobe, dass die Änderung sie nicht berührt.
 */
const BAND = [760, 800, 899] as const;
const BREIT = 1000;

/**
 * Welche Punkte diese Rolle überhaupt sehen darf — aus derselben Regel gerechnet, die das Produkt
 * benutzt (`canSee`), nicht abgeschrieben. `experte` sieht „Prüfen" nicht (`validierung` verlangt
 * `controller`); „alle Punkte" heisst hier deshalb „alle, die diese Rolle sehen darf".
 */
const SICHTBARE_PUNKTE = kopfbandItems()
  .filter((i) => canSee(i, "experte", false))
  .map((i) => i.id);

/** Wertet eine Abfrage aus `min-width`/`max-width` gegen eine Breite aus. */
function passt(query: string, breite: number): boolean {
  let ergebnis = true;
  for (const m of query.matchAll(/\((min|max)-width:\s*(\d+)px\)/g)) {
    const grenze = Number(m[2]);
    ergebnis = ergebnis && (m[1] === "min" ? breite >= grenze : breite <= grenze);
  }
  return ergebnis;
}

function setzeBreite(breite: number): void {
  (globalThis as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (q) =>
    ({
      matches: passt(q, breite),
      media: q,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

let container: HTMLDivElement;
let root: Root;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
};

/** Zeigt die stehende Adresse an — so wird „die Route öffnet" gemessen statt behauptet. */
function Adresse(): JSX.Element {
  const ort = useLocation();
  return createElement("span", { "data-testid": "adresse" }, ort.pathname);
}

async function montiere(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
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
              ToastProvider,
              null,
              createElement(
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: ["/start"] },
                  createElement(AppShell, null, createElement(Adresse)),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await flush();
}

function abbauen(): void {
  act(() => root.unmount());
  container.remove();
}

function kopfband(): HTMLElement {
  const el = container.querySelector<HTMLElement>('header[data-testid="kopfband"]');
  if (!el) {
    throw new Error("das Kopfband steht nicht");
  }
  return el;
}

/** Die Ids der Punkte, die OBEN im Kopfband stehen — in Bildreihenfolge. */
function punkteOben(): string[] {
  return [...kopfband().querySelectorAll("[data-kopfband-punkt]")].map(
    (a) => a.getAttribute("data-kopfband-punkt") ?? "",
  );
}

function menueKnopf(): HTMLButtonElement | null {
  return kopfband().querySelector<HTMLButtonElement>('[data-testid="kopfband-menue"]');
}

function drawer(): HTMLElement | null {
  return container.querySelector<HTMLElement>("dialog[aria-modal='true']");
}

function adresse(): string {
  return container.querySelector('[data-testid="adresse"]')?.textContent ?? "";
}

async function klick(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
  });
  await flush();
}

/** Den Drawer über den beschrifteten Knopf aufziehen — den Weg, den auch ein Mensch nimmt. */
async function oeffneMenue(breite: number): Promise<HTMLElement> {
  const knopf = menueKnopf();
  expect(knopf, `${breite}px: es gibt keinen Menü-Knopf`).not.toBeNull();
  expect(
    knopf?.textContent?.trim().length,
    `${breite}px: der Menü-Knopf ist stumm`,
  ).toBeGreaterThan(0);
  if (knopf) {
    await klick(knopf);
  }
  const auf = drawer();
  expect(auf, `${breite}px: der Klick auf „Menü“ öffnet nichts`).not.toBeNull();
  if (!auf) {
    throw new Error("unerreichbar");
  }
  return auf;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  abbauen();
  vi.clearAllMocks();
  await i18n.changeLanguage("de");
});

// ================================================================================================
// N1 — DIE EIGENTLICHE ZUSAGE DIESES AUFTRAGS.
// ================================================================================================
//
// Formuliert als „KEINER", nicht als „nicht Meine Entwürfe": Pedis Satz ist kein Satz über diesen
// einen Punkt, sondern über die Stimmigkeit der Zeile. Würde jemand morgen „Bibliothek" statt
// „Meine Entwürfe" hochziehen, wäre die Sonderstellung zurück — und dieser Fall rot.
describe("JOB 3605 · N1 · auf dem schmalen Band steht kein Punkt bevorzugt neben dem Logo", () => {
  for (const breite of BAND) {
    it(`${breite} px: das Kopfband trägt KEINEN Navigationspunkt`, async () => {
      setzeBreite(breite);
      await montiere();
      expect(
        punkteOben(),
        `${breite}px: dieser Punkt steht bevorzugt im Kopfband, statt im Menü zu wohnen`,
      ).toEqual([]);
    });
  }
});

// ================================================================================================
// N2 — UND DER ZUGANG GEHT DABEI NICHT VERLOREN (Auftrag §3.2).
// ================================================================================================
//
// „Ein Punkt, der die Sonderstellung verliert und dabei unauffindbar wird, wäre schlimmer als der
// Ist-Zustand." Deshalb wird hier nicht nur geprüft, dass die Zeile DA STEHT, sondern dass ihr
// Klick die Adresse wirklich auf `/entwuerfe` stellt.
describe("JOB 3605 · N2 · „Meine Entwürfe“ ist über das Menü erreichbar und öffnet seine Route", () => {
  for (const breite of BAND) {
    it(`${breite} px: Menü öffnen → „Meine Entwürfe“ klicken → die Adresse ist /entwuerfe`, async () => {
      setzeBreite(breite);
      await montiere();
      expect(adresse(), "der Fall startet nicht auf /start").toBe("/start");
      const auf = await oeffneMenue(breite);
      const zeile = auf.querySelector<HTMLAnchorElement>('a[href="/entwuerfe"]');
      expect(zeile, `${breite}px: „Meine Entwürfe“ steht nicht im Menü`).not.toBeNull();
      // Der Name, den Pedi liest — nicht bloss ein Anker mit richtigem Ziel.
      expect(zeile?.textContent, `${breite}px: die Zeile ist unbeschriftet`).toContain(
        i18n.t("mob.drafts"),
      );
      if (zeile) {
        await klick(zeile);
      }
      expect(adresse(), `${breite}px: der Klick führt nicht auf /entwuerfe`).toBe("/entwuerfe");
    });
  }
});

// ================================================================================================
// N3 — „WIE JEDER ANDERE": DIE GANZE REIHE STEHT AUF DEMSELBEN WEG.
// ================================================================================================
describe("JOB 3605 · N3 · hinter dem Menü-Knopf steht die VOLLE Reihe der Rolle", () => {
  for (const breite of BAND) {
    it(`${breite} px: jeder sichtbare Kopfbandpunkt steht im Menü — keiner fehlt, keiner doppelt oben`, async () => {
      setzeBreite(breite);
      await montiere();
      const auf = await oeffneMenue(breite);
      // Kalibrierung: steht die Reihe leer da, prüfte dieser Fall nichts.
      expect(SICHTBARE_PUNKTE.length, "die Rolle sieht gar keinen Punkt").toBeGreaterThan(1);
      for (const item of kopfbandItems().filter((i) => SICHTBARE_PUNKTE.includes(i.id))) {
        expect(
          auf.querySelector(`a[href="${item.path}"]`),
          `${breite}px: „${item.id}“ fehlt im Menü`,
        ).not.toBeNull();
      }
      // Und keiner von ihnen steht zusätzlich oben — das wäre die Sonderstellung durch die Hintertür.
      expect(punkteOben(), `${breite}px: ein Punkt steht zusätzlich oben`).toEqual([]);
    });
  }
});

// ================================================================================================
// N4 — DIE BREITE BAUFORM IST UNBERÜHRT (Auftrag §5, Breite 1000 px).
// ================================================================================================
describe("JOB 3605 · N4 · breit (1000 px) ändert sich nichts", () => {
  it("die volle Punktreihe steht oben, und es gibt keinen Menü-Knopf", async () => {
    setzeBreite(BREIT);
    await montiere();
    expect(menueKnopf(), "bei 1000px steht ein Menü-Knopf im Kopfband").toBeNull();
    expect(punkteOben(), "bei 1000px fehlt die volle Punktreihe").toEqual(SICHTBARE_PUNKTE);
  });
});

// ================================================================================================
// N5 — „GEHE ZU …" BLEIBT, UND DAS IST AUSDRÜCKLICH ERLAUBT (Auftrag §3.3).
// ================================================================================================
//
// Er ist eine FUNKTION (dieselbe Palette wie ⌘K, `shell/CommandPalette.tsx`), kein
// Navigationspunkt — Pedis Satz über die „gesamte Navigation" trifft ihn nicht. Dieser Fall steht
// hier, damit die Aufräumarbeit dieses Auftrags ihn nicht versehentlich mitnimmt.
describe("JOB 3605 · N5 · „Gehe zu …“ bleibt auf dem Band ein Knopf", () => {
  for (const breite of BAND) {
    it(`${breite} px: der Knopf steht mit Beschriftung und Kürzel im Kopfband`, async () => {
      setzeBreite(breite);
      await montiere();
      const knopf = kopfband().querySelector<HTMLButtonElement>('[data-testid="kopfband-gehezu"]');
      expect(knopf, `${breite}px: „Gehe zu …“ ist mit verschwunden`).not.toBeNull();
      expect(knopf?.textContent).toContain(i18n.t("menue.schnellnavigation"));
      expect(knopf?.textContent, `${breite}px: das Kürzel fehlt`).toContain("⌘K");
      // Und er ist kein Navigationspunkt geworden, um die Lücke zu füllen.
      expect(knopf?.getAttribute("data-kopfband-punkt")).toBeNull();
    });
  }
});
