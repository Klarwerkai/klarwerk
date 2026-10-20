// @vitest-environment jsdom
// ================================================================================================
// MACOS-20261014 (produkt:20261011:assistenz-minimalistische-oberflaeche r2) · UI-01/02/03/04, MAC-03
// — EINE ARBEITSAUFGABE IM HAUPTFENSTER, MIT GEÖFFNETER UND MIT AUSGEBLENDETER ASSISTENZ.
// ================================================================================================
//
// Die Aufgabe (synthetisch): die Verwaltung pflegt die realen Lagebild-Werte des Bereichs „Gesamt“
// auf der Kapital-Sicht — DATEN AUSWÄHLEN (Bereich), PRÜFEN (angezeigter Stand), QUELLE VERSTEHEN
// (Herkunft und Beleg je Zahl, Zeitraum, Stand), KORRIGIEREN (Stundensatz) und das ERGEBNIS
// VERWENDEN (die Rechnung aus dem neuen Stand). Alles auf EINER Seite, ohne globale Startseite.
//
// Echt: Hülle (`AppShell`) mit der Assistenz im Produktbetrieb, die Karte
// `components/LagebildWerte.tsx`, der Server (`buildApp(buildServices())`, Speicherablage) über den
// Draht aus `tests/klara-quellen-nutzerweg/kette.ts`, die Anmeldung. Fiktive Konten und Werte.
//
// Zum Prüfen gehört der tatsächliche Prüfstatus jeder Zahl (UI-03): eine fachliche Prüfung führen die
// Lagebild-Werte nicht — das steht offen an jeder erfassten Zahl (Nacharbeit 47).
//
//   H1  Assistenz OFFEN: die Kontextzeile nennt die geöffneten Daten (UI-01); die Karte bleibt
//       bedienbar, der Entwurf im Gespräch bleibt (UI-04); der ganze Weg bis zur Korrektur am
//       Server (UI-02/03); die Zeile folgt dem neuen Stand.
//   H2  Assistenz EINGEKLAPPT: derselbe Weg ohne Assistenzfläche; Wiederöffnen zeigt Entwurf und
//       den aktuellen Bezug (UI-04, MAC-03).
//
// WAS DIESE DATEI NICHT ERSETZT: den Browser und den Mac (Layout, Fenstergrössen, Screenreader,
// Hell/Dunkel), die Bedienung durch Peter und eine Prüfung der installierten Fassung (UI-06, UI-08).
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
import { bis, klick, medienStub, q, ruhe, tippe } from "../fe003-tutorial-fragen/huelle";
import {
  type Aufbau,
  type Draht,
  adapterUmgebungSetzen,
  appAufbauen,
  drahtAufbauen,
} from "../klara-quellen-nutzerweg/kette";

adapterUmgebungSetzen();

const URL = "/api/management/lagebild-werte";

interface GelesenerBereich {
  bereich: string;
  werte: { version: number; werte: Record<string, unknown> } | null;
}
const ENTWURF = "Synthetische Frage zum Stundensatz, noch nicht gesendet";
const BELEG = "Zeiterfassung Q3 (synthetisch)";

let draht: Draht;
let aufbau: Aufbau | null = null;
let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let echterFetch: typeof globalThis.fetch;

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
  medienStub();
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

/** Die Verwaltung (erstes Konto) mit einem gespeicherten Stand 1 für „Gesamt“. */
async function vorrichtung(): Promise<Aufbau> {
  const a = await appAufbauen();
  aufbau = a;
  draht.setzeApp(a.app);
  const erst = await a.app.inject({
    method: "PUT",
    url: `${URL}/gesamt`,
    headers: a.admin.kopf,
    payload: {
      zeitraumVon: "2025-07-01",
      zeitraumBis: "2025-09-30",
      werte: {
        hourlyRate: { wert: 72.5, herkunft: "eigene_eingabe", beleg: null },
        hoursSavedPerValidatedKo: { wert: 1.5, herkunft: "gemessen", beleg: BELEG },
        reuseFactor: { wert: 4, herkunft: "eigene_eingabe", beleg: null },
      },
      basisVersion: 0,
      anfrageId: "hauptfenster-0001",
    },
  });
  expect(erst.statusCode, erst.body).toBe(200);
  draht.setzeCookie(`kw_session=${a.admin.token}`);
  return a;
}

/** Die echte Hülle mit der Kapital-Sicht der Lagebild-Werte als Inhalt. */
async function montiere(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const r = createRoot(container);
  root = r;
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
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
                  { initialEntries: ["/kapital"] },
                  createElement(AppShell, null, createElement(LagebildWerteKarte)),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await ruhe();
  await bis(() => Boolean(q(document, "klara-figur")), 200);
  await bis(() => Boolean(q(document, "lagebild-anzeige")), 200);
}

async function gespraechOeffnen(): Promise<void> {
  if (!q(document, "klara-gespraech")) {
    await klick(q(document, "klara-figur"));
  }
  await bis(() => Boolean(q(document, "klara-gespraech")));
}

const text = (testId: string): string => q(document, testId)?.textContent ?? "";
const puts = (): number =>
  draht.aufrufe.filter((a) => a.methode === "PUT" && a.url.startsWith(URL)).length;

/**
 * Prüfen und Quelle verstehen: angezeigter Stand, Herkunft und Beleg der gemessenen Zahl — und ihr
 * tatsächlicher Prüfstatus (UI-03, Nacharbeit 47): eine fachliche Prüfung gibt es für Lagebild-Werte
 * nicht, also steht an JEDER erfassten Zahl sichtbar „offen – nicht fachlich geprüft“.
 */
function standUndHerkunft(version: string): void {
  expect(q(document, "lagebild-anzeige")?.dataset.version).toBe(version);
  const gemessen = document.querySelector<HTMLElement>(
    '[data-testid="lagebild-zeile"][data-feld="hoursSavedPerValidatedKo"]',
  );
  expect(gemessen?.dataset.herkunft).toBe("gemessen");
  expect(gemessen?.textContent).toContain(BELEG);
  const zeilen = document.querySelectorAll<HTMLElement>('[data-testid="lagebild-zeile"]');
  expect(zeilen.length).toBeGreaterThan(0);
  for (const zeile of Array.from(zeilen)) {
    const status = zeile.querySelector<HTMLElement>('[data-testid="lagebild-pruefstatus"]');
    expect(status?.dataset.pruefstatus, zeile.dataset.feld).toBe("nicht_geprueft");
    expect(status?.textContent, zeile.dataset.feld).toBe(
      "Prüfstatus: offen – nicht fachlich geprüft",
    );
  }
  expect(text("lagebild-zeitraum")).not.toBe("");
  expect(q(document, "lagebild-stand")).not.toBeNull();
}

/** Korrigieren: den Stundensatz über die Karte ändern und speichern — am Server Stand + 1. */
async function stundensatzKorrigieren(wert: string, neuerStand: string): Promise<void> {
  const vorher = puts();
  await klick(q(document, "lagebild-bearbeiten"));
  await bis(() => Boolean(q(document, "lagebild-form")));
  const satz = q<HTMLInputElement>(document, "lagebild-eingabe-hourlyRate");
  await tippe(satz as HTMLInputElement, wert);
  await act(async () => {
    q(document, "lagebild-form")?.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
  await bis(() => q(document, "lagebild-anzeige")?.dataset.version === neuerStand, 200);
  expect(puts()).toBe(vorher + 1);
  expect(q(document, "lagebild-anzeige")?.dataset.version).toBe(neuerStand);
}

describe("H · eine Arbeitsaufgabe im Hauptfenster (UI-01/02/03/04, MAC-03)", () => {
  it("H1 · Assistenz offen: Bezug auf die geöffneten Daten, Karte bedienbar, Entwurf bleibt", async () => {
    const a = await vorrichtung();
    await montiere();
    await gespraechOeffnen();
    await tippe(q<HTMLInputElement>(document, "klara-eingabe") as HTMLInputElement, ENTWURF);

    // UI-01: worauf sich die Assistenz bezieht — ohne Aufklappen in der Kontextzeile.
    await bis(() => text("klara-bezug-zeile").includes("Stand 1"), 120);
    expect(text("klara-bezug-zeile")).toContain("Lagebild-Werte");
    expect(text("klara-bezug-zeile")).toContain("Stand 1");
    expect(text("klara-ort-objekt")).toContain("Stand 1");

    // Daten auswählen: die Bereichswahl der Seite ist bedienbar, während die Assistenz offen ist.
    const wahl = q<HTMLSelectElement>(document, "lagebild-bereich-wahl");
    expect(wahl?.value).toBe("gesamt");
    expect(wahl?.disabled).toBe(false);

    // Prüfen und Quelle verstehen: Stand, Herkunft und Beleg der Zahl, Zeitraum.
    standUndHerkunft("1");

    // Korrigieren — die Karte bleibt neben dem offenen Gespräch bedienbar (UI-04).
    await stundensatzKorrigieren("80", "2");
    expect(q(document, "klara-gespraech")).not.toBeNull();
    const amServer = await a.app.inject({ method: "GET", url: URL, headers: a.admin.kopf });
    const bereiche = (amServer.json() as { bereiche: GelesenerBereich[] }).bereiche;
    const gesamt = bereiche.find((b) => b.bereich === "gesamt");
    expect(gesamt?.werte?.version).toBe(2);
    expect(gesamt?.werte?.werte.hourlyRate).toMatchObject({ wert: 80 });

    // Ergebnis verwenden: die Rechnung beruht auf dem neuen Stand und fehlt nicht mangels Werten.
    expect(q(document, "lagebild-ergebnis")).not.toBeNull();
    const keineWerte = '[data-testid="lagebild-grund"][data-grund="keine_werte"]';
    expect(document.querySelector(keineWerte)).toBeNull();

    // Die Kontextzeile folgt dem Angezeigten; der Entwurf im Gespräch ist unberührt.
    await bis(() => text("klara-bezug-zeile").includes("Stand 2"), 120);
    expect(text("klara-bezug-zeile")).toContain("Stand 2");
    expect(q<HTMLInputElement>(document, "klara-eingabe")?.value).toBe(ENTWURF);
  });

  it("H2 · Assistenz eingeklappt: derselbe Weg ohne Assistenzfläche; Wiederöffnen behält alles", async () => {
    await vorrichtung();
    await montiere();
    await gespraechOeffnen();
    await tippe(q<HTMLInputElement>(document, "klara-eingabe") as HTMLInputElement, ENTWURF);
    await klick(q(document, "klara-schliessen"));
    expect(q(document, "klara-gespraech")).toBeNull();

    // Ohne Assistenzfläche: auswählen, prüfen, Herkunft verstehen, korrigieren, verwenden.
    expect(q<HTMLSelectElement>(document, "lagebild-bereich-wahl")?.value).toBe("gesamt");
    standUndHerkunft("1");
    await stundensatzKorrigieren("75", "2");
    expect(q(document, "lagebild-ergebnis")).not.toBeNull();
    // Abbrechen eines begonnenen Bearbeitens schreibt nichts.
    const vorher = puts();
    await klick(q(document, "lagebild-bearbeiten"));
    await klick(q(document, "lagebild-abbrechen"));
    expect(q(document, "lagebild-form")).toBeNull();
    expect(puts()).toBe(vorher);

    // Bewusst wieder öffnen: Entwurf und der aktuelle Bezug sind da.
    await gespraechOeffnen();
    expect(q<HTMLInputElement>(document, "klara-eingabe")?.value).toBe(ENTWURF);
    await bis(() => text("klara-bezug-zeile").includes("Stand 2"), 120);
    expect(text("klara-bezug-zeile")).toContain("Stand 2");
  });
});
