// @vitest-environment jsdom
// ================================================================================================
// MACOS-20261014 · MAC-03 (produkt:20261011:assistenz-minimalistische-oberflaeche r2, Nacharbeit 52)
// — DIE AUSBLENDBARE ARBEITSBEREICHSLEISTE DES HAUPTFENSTERS, AN DER ECHTEN HÜLLE.
// ================================================================================================
//
// Echt: `AppShell` (breit) samt Kopfband, „Arbeitsbereiche“-Menü, Befehlspalette, Modalgrenze und
// der Assistenz im Produktbetrieb; der Server (`buildApp(buildServices())`) über den Draht aus
// `tests/klara-quellen-nutzerweg/kette.ts`; echte Anmeldung zweier fiktiver Konten.
//
//   L1  Vorgabe nach Fensterbreite (ab 1440 px ein, darunter aus); dieselben Ziele wie Kopfband und
//       „Arbeitsbereiche“-Menü — je Rolle (eine Quelle, keine eigenen Rechte); Aktivregel.
//   L2  Ausblenden: die Leiste ist NICHT im Baum, `<main>` erhält die Breite; Fokus wandert auf den
//       Einblend-Knopf und zurück; die Wahl bleibt über Neuladen.
//   L3  Umschalten montiert den Seiteninhalt nicht neu: Feld, Eingabe und Klara-Entwurf bleiben.
//   L4  Modalgrenze: eine offene Befehlspalette sperrt die Leiste wie das Kopfband.
//   L5  Der Datenweg (Lagebild-Werte) mit ein- und ausgeblendeter Leiste bei offener Assistenz: ein
//       begonnener Korrekturentwurf übersteht Aus- und Einblenden und wird gespeichert.
//
// NICHT gemessen: echte Breiten im Browser, Mac-Host, Screenreader, Peters Urteil (UI-06/UI-08).
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { LagebildWerteKarte } from "../../apps/web/src/components/LagebildWerte";
import { setzeKlaraVorschauAktiv } from "../../apps/web/src/components/klara-vorschau/aktiv";
import { vergiss } from "../../apps/web/src/components/klara-vorschau/echt";
import { eingabeZuruecksetzen } from "../../apps/web/src/components/klara-vorschau/eingabe";
import { setzeAssistenzProfil } from "../../apps/web/src/components/klara-vorschau/profil";
import { zuruecksetzenGanz } from "../../apps/web/src/components/klara-vorschau/zustand";
import i18n from "../../apps/web/src/i18n";
import { verwerfeEigeninitiative } from "../../apps/web/src/lib/klaraEigeninitiative";
import { AppShell } from "../../apps/web/src/shell/AppShell";
import { SEITENLEISTE_VORGABE_QUERY } from "../../apps/web/src/shell/Arbeitsbereichsleiste";
import { bis, klick, q, ruhe, tippe } from "../fe003-tutorial-fragen/huelle";
import {
  type Aufbau,
  type Draht,
  type Konto,
  adapterUmgebungSetzen,
  appAufbauen,
  drahtAufbauen,
  neuesKonto,
} from "../klara-quellen-nutzerweg/kette";

adapterUmgebungSetzen();

const URL = "/api/management/lagebild-werte";
const ENTWURF = "Synthetische Frage, noch nicht gesendet";
const SCHLUESSEL = "klarwerk.seitenleiste";

let draht: Draht;
let aufbau: Aufbau | null = null;
let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let echterFetch: typeof globalThis.fetch;

/** Fensterbreite: `breit` = ab 1440 px (Vorgabe „eingeblendet“), sonst darunter, nie schmal. */
function fenster(breit: boolean): void {
  (globalThis as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (m) =>
    ({
      matches: m === SEITENLEISTE_VORGABE_QUERY ? breit : false,
      media: m,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

beforeAll(() => {
  draht = drahtAufbauen();
  echterFetch = globalThis.fetch;
});

afterAll(() => {
  draht.abbauen();
});

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  zuruecksetzenGanz();
  eingabeZuruecksetzen();
  vergiss();
  verwerfeEigeninitiative();
  setzeKlaraVorschauAktiv(false);
  setzeAssistenzProfil(null);
  Element.prototype.scrollIntoView = () => {};
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  abbauen();
  document.body.innerHTML = "";
  globalThis.fetch = echterFetch;
  window.fetch = echterFetch;
  vergiss();
  eingabeZuruecksetzen();
  zuruecksetzenGanz();
  if (aufbau) {
    await aufbau.app.close();
    aufbau = null;
  }
  draht.setzeApp(null);
  draht.setzeCookie(null);
  draht.aufrufe.length = 0;
});

function abbauen(): void {
  if (root) {
    const r = root;
    act(() => r.unmount());
    root = null;
  }
  container?.remove();
  container = null;
}

async function vorrichtung(): Promise<Aufbau> {
  const a = await appAufbauen();
  aufbau = a;
  draht.setzeApp(a.app);
  draht.setzeCookie(`kw_session=${a.admin.token}`);
  return a;
}

/** Die echte Hülle; als Inhalt ein Probefeld und die Kapital-Karte der Lagebild-Werte. */
async function montiere(pfad = "/kapital"): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const r = createRoot(container);
  root = r;
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const seite = createElement(
    "div",
    null,
    createElement("input", { "data-testid": "probe-feld", "aria-label": "Probefeld" }),
    createElement(LagebildWerteKarte),
  );
  await act(async () => {
    r.render(
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
                  { initialEntries: [pfad] },
                  createElement(AppShell, null, seite),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await ruhe();
  await bis(() => Boolean(q(document, "kopfband")), 200);
  await bis(() => Boolean(q(document, "klara-figur")), 200);
}

const leiste = (): HTMLElement | null => q(document, "arbeitsbereichsleiste");
const hauptflaeche = (): HTMLElement | null => document.querySelector("main");
const ziele = (wurzel: ParentNode | null, selektor: string): string[] =>
  [...(wurzel?.querySelectorAll<HTMLAnchorElement>(selektor) ?? [])]
    .map((a) => a.getAttribute("href") ?? "")
    .sort();

/**
 * Ziele von Kopfband UND „Arbeitsbereiche“-Menü — die bestehende Navigation dieser Rolle. Erhoben bei
 * AUSGEBLENDETER Leiste: nur dann trägt das Kopfband die Bereiche (Nacharbeit 54 · MAC5-03).
 */
async function zieleDerBestehendenNavigation(): Promise<string[]> {
  const kopf = ziele(document, "header a[data-kopfband-punkt]");
  await klick(q(document, "kopfband-arbeitsbereiche"));
  await bis(() => Boolean(q(document, "arbeitsbereiche-menue")));
  const menue = ziele(q(document, "arbeitsbereiche-menue"), "a[href]");
  await klick(q(document, "kopfband-arbeitsbereiche"));
  return [...kopf, ...menue].sort();
}

/** Bereichseinstiege im Kopfband — Punkte und „Arbeitsbereiche“-Menü. */
const EINSTIEGE = 'header a[data-kopfband-punkt], [data-testid="kopfband-arbeitsbereiche"]';
const kopfbandEinstiege = (): number => document.querySelectorAll(EINSTIEGE).length;

describe("L · Arbeitsbereichsleiste (MAC-03)", () => {
  it("L1 · Vorgabe nach Breite; dieselben Ziele wie Kopfband und Menü — je Rolle; keine Doppelung", async () => {
    const a = await vorrichtung();
    // Unter 1440 px ohne eigene Wahl: ausgeblendet, nur der Einblend-Knopf — die Bereiche stehen
    // im Kopfband wie bisher.
    fenster(false);
    await montiere();
    expect(leiste()).toBeNull();
    expect(q(document, "seitenleiste-einblenden")).not.toBeNull();
    expect(hauptflaeche()?.dataset.seitenleiste).toBe("aus");
    expect(kopfbandEinstiege()).toBeGreaterThan(0);
    const bestehend = await zieleDerBestehendenNavigation();
    abbauen();

    // Ab 1440 px: eingeblendet, mit genau den Zielen der bestehenden Navigation dieser Rolle — und
    // das Kopfband zeigt sie dann NICHT ein zweites Mal (MAC5-03, redundante Einstiege).
    fenster(true);
    await montiere();
    expect(leiste()).not.toBeNull();
    expect(hauptflaeche()?.dataset.seitenleiste).toBe("an");
    // Die Rolle kommt asynchron aus der Anmeldung (`/api/auth/me`): bis sie da ist, zeigt jede
    // Navigation nur die Ziele der kleinsten Rolle. Gewartet wird auf den geladenen Stand, geprüft
    // wird danach unverändert auf GLEICHHEIT (Nacharbeit 55, Lauf an bb90d67e: 11 statt 17 Ziele).
    await bis(() => ziele(leiste(), "a[href]").length >= bestehend.length, 200);
    const leistenZiele = ziele(leiste(), "a[href]");
    expect(leistenZiele.length).toBeGreaterThan(0);
    expect(leistenZiele).toEqual(bestehend);
    expect(kopfbandEinstiege(), "Bereiche doppelt: Leiste UND Kopfband").toBe(0);
    // Suche und „Seite finden“ bleiben im Kopfband (kein Bereichseinstieg, sondern Werkzeuge).
    expect(document.querySelector('header input[type="search"]')).not.toBeNull();
    // Die Leiste ist eine benannte Navigation, kein Menü.
    expect(leiste()?.querySelector("nav")?.getAttribute("aria-label")).toBe("Arbeitsbereiche");
    expect(leiste()?.querySelector('[role="menuitem"], [role="menu"]')).toBeNull();
    // Aktivregel: Navigation über die Leiste markiert den neuen Ort.
    const bibliothek = leiste()?.querySelector<HTMLAnchorElement>(
      '[data-seitenleiste-punkt="bibliothek"]',
    );
    expect(bibliothek).not.toBeNull();
    await klick(bibliothek);
    await bis(() => bibliothek?.getAttribute("aria-current") === "page");
    expect(bibliothek?.getAttribute("aria-current")).toBe("page");

    // Ausblenden: das Kopfband trägt die Bereiche wieder — keine Lücke in der Navigation.
    await klick(q(document, "seitenleiste-ausblenden"));
    await bis(() => leiste() === null);
    expect(kopfbandEinstiege()).toBeGreaterThan(0);
    expect(await zieleDerBestehendenNavigation()).toEqual(bestehend);
    abbauen();

    // Eine zweite Rolle (nicht die Verwaltung): wieder genau ihre eigene Navigation.
    localStorage.removeItem("klarwerk.seitenleiste");
    const zweite: Konto = await neuesKonto(a.app, "leiste-rolle", a.admin);
    draht.setzeCookie(`kw_session=${zweite.token}`);
    fenster(false);
    await montiere("/start");
    const zweiteBestehend = await zieleDerBestehendenNavigation();
    abbauen();
    fenster(true);
    await montiere("/start");
    await bis(() => ziele(leiste(), "a[href]").length >= zweiteBestehend.length, 200);
    const zweiteZiele = ziele(leiste(), "a[href]");
    expect(zweiteZiele.length).toBeGreaterThan(0);
    expect(zweiteZiele).toEqual(zweiteBestehend);
    expect(kopfbandEinstiege()).toBe(0);
  });

  it("L2 · ausblenden: nicht im Baum, Fokus wandert, Wahl bleibt über Neuladen", async () => {
    await vorrichtung();
    fenster(true);
    await montiere();
    await klick(q(document, "seitenleiste-ausblenden"));
    await bis(() => leiste() === null);
    expect(leiste()).toBeNull();
    expect(document.querySelector("aside")).toBeNull();
    expect(hauptflaeche()?.dataset.seitenleiste).toBe("aus");
    const einblenden = q(document, "seitenleiste-einblenden");
    expect(einblenden?.getAttribute("aria-label")).toBe("Seitenleiste einblenden");
    expect(document.activeElement).toBe(einblenden);
    expect(localStorage.getItem(SCHLUESSEL)).toBe("aus");

    // Neuladen auf breitem Fenster: die eigene Wahl gilt vor der Vorgabe.
    abbauen();
    await montiere();
    expect(leiste()).toBeNull();

    // Wieder einblenden: Fokus auf „Seitenleiste ausblenden“, Wahl gemerkt.
    await klick(q(document, "seitenleiste-einblenden"));
    await bis(() => leiste() !== null);
    expect(document.activeElement).toBe(q(document, "seitenleiste-ausblenden"));
    expect(localStorage.getItem(SCHLUESSEL)).toBe("an");
    expect(hauptflaeche()?.dataset.seitenleiste).toBe("an");
  });

  it("L3 · Umschalten montiert den Inhalt nicht neu: Feld, Eingabe und Klara-Entwurf bleiben", async () => {
    await vorrichtung();
    fenster(true);
    await montiere();
    const feld = q<HTMLInputElement>(document, "probe-feld") as HTMLInputElement;
    await tippe(feld, "Synthetischer Arbeitsstand");
    await klick(q(document, "klara-figur"));
    await bis(() => Boolean(q(document, "klara-gespraech")));
    await tippe(q<HTMLInputElement>(document, "klara-eingabe") as HTMLInputElement, ENTWURF);

    for (const knopf of ["seitenleiste-ausblenden", "seitenleiste-einblenden"]) {
      await klick(q(document, knopf));
      await ruhe();
      expect(q(document, "probe-feld"), knopf).toBe(feld);
      expect(feld.value, knopf).toBe("Synthetischer Arbeitsstand");
      expect(q(document, "klara-gespraech"), knopf).not.toBeNull();
      expect(q<HTMLInputElement>(document, "klara-eingabe")?.value, knopf).toBe(ENTWURF);
    }
  });

  it("L4 · eine offene Befehlspalette sperrt die Leiste wie das Kopfband", async () => {
    await vorrichtung();
    fenster(true);
    await montiere();
    const region = (): Element | null | undefined => leiste()?.closest("[data-modal-region]");
    const kopfRegion = (): Element | null | undefined =>
      q(document, "kopfband")?.closest("[data-modal-region]");
    expect(region()?.hasAttribute("inert")).toBe(false);
    await act(async () => {
      window.dispatchEvent(new CustomEvent("open-command-palette", { detail: null }));
    });
    await bis(() => region()?.hasAttribute("inert") === true);
    expect(region()?.hasAttribute("inert")).toBe(true);
    expect(kopfRegion()?.hasAttribute("inert")).toBe(true);
  });

  it("L5 · Datenweg mit ein- und ausgeblendeter Leiste bei offener Assistenz", async () => {
    const a = await vorrichtung();
    const erst = await a.app.inject({
      method: "PUT",
      url: `${URL}/gesamt`,
      headers: a.admin.kopf,
      payload: {
        zeitraumVon: "2025-07-01",
        zeitraumBis: "2025-09-30",
        werte: {
          hourlyRate: { wert: 72.5, herkunft: "eigene_eingabe", beleg: null },
          hoursSavedPerValidatedKo: {
            wert: 1.5,
            herkunft: "gemessen",
            beleg: "Zeiterfassung Q3 (synthetisch)",
          },
          reuseFactor: { wert: 4, herkunft: "eigene_eingabe", beleg: null },
        },
        basisVersion: 0,
        anfrageId: "leiste-0001",
      },
    });
    expect(erst.statusCode, erst.body).toBe(200);
    fenster(true);
    await montiere();
    await bis(() => q(document, "lagebild-anzeige")?.dataset.version === "1", 200);
    await klick(q(document, "klara-figur"));
    await bis(() => Boolean(q(document, "klara-gespraech")));

    // Prüfen und Quelle verstehen bei eingeblendeter Leiste.
    expect(leiste()).not.toBeNull();
    const zeile = document.querySelector<HTMLElement>(
      '[data-testid="lagebild-zeile"][data-feld="hoursSavedPerValidatedKo"]',
    );
    expect(zeile?.dataset.herkunft).toBe("gemessen");
    expect(zeile?.querySelector('[data-testid="lagebild-pruefstatus"]')).not.toBeNull();

    // Korrektur beginnen, Leiste aus- und wieder einblenden: der Entwurf im Formular bleibt.
    await klick(q(document, "lagebild-bearbeiten"));
    await bis(() => Boolean(q(document, "lagebild-form")));
    const formular = q(document, "lagebild-form");
    const satz = q<HTMLInputElement>(document, "lagebild-eingabe-hourlyRate") as HTMLInputElement;
    await tippe(satz, "81");
    await klick(q(document, "seitenleiste-ausblenden"));
    expect(leiste()).toBeNull();
    expect(q(document, "lagebild-form")).toBe(formular);
    expect(satz.value).toBe("81");
    expect(q(document, "klara-gespraech")).not.toBeNull();
    await klick(q(document, "seitenleiste-einblenden"));
    expect(leiste()).not.toBeNull();
    expect(q(document, "lagebild-form")).toBe(formular);
    expect(satz.value).toBe("81");

    // Ergebnis verwenden: gespeichert als Stand 2 am Server.
    await act(async () => {
      q(document, "lagebild-form")?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    await bis(() => q(document, "lagebild-anzeige")?.dataset.version === "2", 200);
    expect(q(document, "lagebild-anzeige")?.dataset.version).toBe("2");
    expect(q(document, "lagebild-ergebnis")).not.toBeNull();
  });
});
