// @vitest-environment jsdom
// ================================================================================================
// produkt:20261011:assistenz-lernen-hostfortsetzung · BPA-06 AC01 — DER LERNAUFTRAG IM KLARA-GESPRÄCH.
// ================================================================================================
//
// Die echte Hülle (`AppShell`) mit der echten Klara und der echten Lernanzeige (`VormachenAnzeige`),
// verbunden über den Draht aus `tests/klara-quellen-nutzerweg/kette.ts` mit der ECHTEN App im
// selben Prozess — derselbe Aufbau wie `tests/klara-aufgaben/aufgaben-am-server.test.tsx`.
//
//   G1  „Verfolge, wie ich diesen Bericht erstelle.“ im Eingabefeld: der Lernmodus startet mit dem
//       abgegrenzten Bereich (Klarwerk; Entwurf anlegen, speichern), die Lernanzeige zeigt ihn,
//       „Pause“ wirkt sofort am Server.
//   G2  „Lerne, wie ich das mache.“: Klara fragt gezielt nach dem Vorgang; die gewählte Option
//       startet genau diesen Bereich.
//   G3  „Schau mir zu, wie ich in Excel rechne.“: nicht freigegeben, nichts wird beobachtet.
// Kein Sprachmodell (`appAufbauen(true)`), fiktive Konten und Daten.
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
import { setzeKlaraVorschauAktiv } from "../../apps/web/src/components/klara-vorschau/aktiv";
import { vergiss } from "../../apps/web/src/components/klara-vorschau/echt";
import { zuruecksetzenGanz } from "../../apps/web/src/components/klara-vorschau/zustand";
import i18n from "../../apps/web/src/i18n";
import { meldeVormachen } from "../../apps/web/src/lib/vormachenAnzeige";
import { AppShell } from "../../apps/web/src/shell/AppShell";
import { alle, bis, klick, medienStub, q, ruhe, tippe } from "../fe003-tutorial-fragen/huelle";
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
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let draht: Draht;
let aufbau: Aufbau | null = null;
let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let echterFetch: typeof globalThis.fetch;

type Sitzung = { id: string; host: string; vorgaenge: string[]; zweck: string; zustand: string };

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
  vergiss();
  meldeVormachen(false);
  setzeKlaraVorschauAktiv(false);
  medienStub();
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  if (root) {
    const r = root;
    act(() => r.unmount());
    root = null;
  }
  container?.remove();
  container = null;
  document.body.innerHTML = "";
  globalThis.fetch = echterFetch;
  window.fetch = echterFetch;
  vergiss();
  meldeVormachen(false);
  setzeKlaraVorschauAktiv(false);
  zuruecksetzenGanz();
  if (aufbau) {
    await aufbau.app.close();
    aufbau = null;
  }
  draht.setzeApp(null);
  draht.setzeCookie(null);
  draht.aufrufe.length = 0;
});

async function vorrichtung(): Promise<{ a: Aufbau; ich: Konto }> {
  const a = await appAufbauen(true);
  aufbau = a;
  draht.setzeApp(a.app);
  const ich = await neuesKonto(a.app, "lernauftrag", a.admin);
  draht.setzeCookie(`kw_session=${ich.token}`);
  return { a, ich };
}

async function montiereUndOeffne(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const r = createRoot(container);
  root = r;
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const seite = createElement("div", { "data-testid": "seite" }, "Seite");
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
                  { initialEntries: ["/start"] },
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
  await bis(() => Boolean(q(document, "klara-figur")), 200);
  await klick(q(document, "klara-figur"));
  await bis(() => Boolean(q(document, "klara-gespraech")));
  await bis(() => {
    const laden = q(document, "klara-echt-hinweis")?.dataset.laden;
    return laden === undefined || laden === "bereit" || laden === "fehler";
  }, 160);
}

async function sage(text: string): Promise<void> {
  const eingabe = q<HTMLInputElement>(document, "klara-eingabe") as HTMLInputElement;
  await tippe(eingabe, text);
  await klick(q(document, "klara-senden"));
  await bis(() => Boolean(q(document, "klara-lernauftrag")), 120);
}

async function sitzungen(a: Aufbau, ich: Konto): Promise<Sitzung[]> {
  const r = await a.app.inject({ method: "GET", url: "/api/me/vormachen", headers: ich.kopf });
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { sitzungen: Sitzung[] }).sitzungen;
}

describe("BPA-06 AC01 · Lernauftrag im Klara-Gespräch → vorhandener Lernmodus", () => {
  it("G1 · der Satz startet den abgegrenzten Lernmodus; Lernanzeige sichtbar, Pause wirkt", async () => {
    const { a, ich } = await vorrichtung();
    await montiereUndOeffne();
    const satz = "Verfolge, wie ich diesen Bericht erstelle.";
    await sage(satz);
    expect(q(document, "klara-lernauftrag")?.dataset.stand).toBe("gestartet");
    const bereich = q(document, "klara-lernauftrag-bereich")?.textContent ?? "";
    expect(bereich).toContain(i18n.t("vormachen.host.klarwerk_web"));
    expect(bereich).toContain(i18n.t("vormachen.vorgang.entwurf_anlegen"));
    const [s] = await sitzungen(a, ich);
    expect(s).toMatchObject({
      host: "klarwerk_web",
      vorgaenge: ["entwurf_anlegen", "entwurf_speichern"],
      zweck: satz,
      zustand: "lernt",
    });

    // Die vorhandene Lernanzeige der Hülle zeigt den Lernmodus — mit sofortiger Pause.
    await bis(() => q(document, "vormachen-anzeige")?.dataset.zustand === "lernt", 120);
    // EQF-06-K01: die dauerhafte Anzeige nennt Anwendung und genau die freigegebenen Vorgänge.
    const umfang = q(document, "vormachen-anzeige-umfang")?.textContent ?? "";
    expect(umfang).toContain(i18n.t("vormachen.host.klarwerk_web"));
    expect(umfang).toContain(i18n.t("vormachen.vorgang.entwurf_anlegen"));
    expect(umfang).toContain(i18n.t("vormachen.vorgang.entwurf_speichern"));
    expect(umfang).not.toContain(i18n.t("vormachen.vorgang.zur_pruefung_einreichen"));
    expect(umfang).not.toContain(i18n.t("vormachen.host.word"));
    await klick(q(document, "vormachen-anzeige-pause"));
    await bis(() => q(document, "vormachen-anzeige")?.dataset.zustand === "pausiert", 120);
    // Auch pausiert bleibt der Umfang sichtbar.
    expect(q(document, "vormachen-anzeige-umfang")?.textContent).toBe(umfang);
    expect((await sitzungen(a, ich))[0]?.zustand).toBe("pausiert");
  });

  it("G2 · Vorgang unklar: gezielte Rückfrage, die gewählte Option startet genau sie", async () => {
    const { a, ich } = await vorrichtung();
    await montiereUndOeffne();
    await sage("Lerne, wie ich das mache.");
    expect(q(document, "klara-lernauftrag")?.dataset.stand).toBe("klaerung");
    expect(q(document, "klara-lernauftrag-frage")?.textContent).toContain("Klarwerk");
    expect(await sitzungen(a, ich)).toEqual([]);
    const [erste] = alle(document, "klara-lernauftrag-option");
    await klick(erste);
    await bis(() => q(document, "klara-lernauftrag")?.dataset.stand === "gestartet", 120);
    expect((await sitzungen(a, ich))[0]).toMatchObject({
      host: "klarwerk_web",
      vorgaenge: ["entwurf_anlegen", "entwurf_speichern"],
    });
  });

  it("G4 · unbekannte genannte Anwendung: erst klären, keine Lernsitzung, keine Lernanzeige", async () => {
    const { a, ich } = await vorrichtung();
    await montiereUndOeffne();
    await sage("Verfolge, wie ich diesen Bericht in LibreOffice erstelle.");
    expect(q(document, "klara-lernauftrag")?.dataset.stand).toBe("klaerung");
    expect(q(document, "klara-lernauftrag-frage")?.textContent).toContain("LibreOffice");
    expect(await sitzungen(a, ich)).toEqual([]);
    expect(q(document, "vormachen-anzeige")).toBeNull();
    // Die Wahl „in Klarwerk“ startet erst jetzt den Lernmodus.
    const optionen = alle(document, "klara-lernauftrag-option");
    const klarwerk = optionen.find((o) => (o.textContent ?? "").includes("Klarwerk"));
    await klick(klarwerk);
    await bis(() => q(document, "klara-lernauftrag")?.dataset.stand === "gestartet", 120);
    expect((await sitzungen(a, ich))[0]).toMatchObject({ host: "klarwerk_web" });
  });

  it("G5 · klein geschriebene unbekannte Anwendung: ebenso erst klären, keine Lernsitzung", async () => {
    const { a, ich } = await vorrichtung();
    await montiereUndOeffne();
    await sage("Verfolge, wie ich diesen Bericht in libreoffice erstelle.");
    expect(q(document, "klara-lernauftrag")?.dataset.stand).toBe("klaerung");
    expect(q(document, "klara-lernauftrag-frage")?.textContent).toContain("libreoffice");
    expect(await sitzungen(a, ich)).toEqual([]);
    expect(q(document, "vormachen-anzeige")).toBeNull();
  });

  it("G6 · Anwendung nach Possessivwort: erst klären, keine Lernsitzung, keine Lernanzeige", async () => {
    const { a, ich } = await vorrichtung();
    await montiereUndOeffne();
    await sage("Verfolge, wie ich diesen Bericht in meinem LibreOffice erstelle.");
    expect(q(document, "klara-lernauftrag")?.dataset.stand).toBe("klaerung");
    expect(q(document, "klara-lernauftrag-frage")?.textContent).toContain("LibreOffice");
    expect(await sitzungen(a, ich)).toEqual([]);
    expect(q(document, "vormachen-anzeige")).toBeNull();
  });

  it("G3 · nicht freigegebene Anwendung: Klara sagt es, nichts wird beobachtet", async () => {
    const { a, ich } = await vorrichtung();
    await montiereUndOeffne();
    await sage("Schau mir zu, wie ich in Excel rechne.");
    expect(q(document, "klara-lernauftrag")?.dataset.stand).toBe("klaerung");
    expect(q(document, "klara-lernauftrag-frage")?.textContent).toContain("Excel");
    expect(alle(document, "klara-lernauftrag-option")).toHaveLength(0);
    expect(await sitzungen(a, ich)).toEqual([]);
    expect(q(document, "vormachen-anzeige")).toBeNull();
  });
});
