// @vitest-environment jsdom
// ================================================================================================
// produkt:20261010:assistenz-aktionen-verlauf-ruecknahme (PV-02) — DER BEDIENWEG IN DER ECHTEN
// KLARA GEGEN DEN ECHTEN SERVER.
// ================================================================================================
//
// Dieselbe Vorrichtung wie `tests/klara-aktionen/auftrag-am-server.test.tsx`: die echte Hülle
// (`AppShell`) mit der echten Klara, über den Draht aus `tests/klara-quellen-nutzerweg/kette.ts`
// mit der ECHTEN App im selben Prozess verbunden. Was am Bildschirm steht, wird am Server
// nachgelesen. Keine Attrappe einer Wirkung; das Netz bleibt unberührt. Ein echtes Layout, echte
// Engines und echte Menschen misst diese Datei nicht.
//
//   N1 · K2/K3/K4  getippte Bearbeitung → Karte „Ausgeführt“, Nachweis mit Aktionskennung, Zeitpunkt,
//                  ausführender Identität, vorher/neu und Prüfprotokoll; NEULADEN → derselbe Nachweis,
//                  „Rückgängig“ direkt erreichbar → „Zurückgenommen“ mit neuem Stand.
//   N2 · K5        Rücknahme nach einer Änderung im Editor: die Karte erklärt eigenen und aktuellen
//                  Stand und führt mit „Im Entwurf korrigieren“ zum vorhandenen Editor.
//   N3 · K2        ohne Treffer entsteht kein Auftrag am Server, und nichts steht als ausgeführt da.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { setzeKlaraVorschauAktiv } from "../../apps/web/src/components/klara-vorschau/aktiv";
import { vergiss } from "../../apps/web/src/components/klara-vorschau/echt";
import { zuruecksetzenGanz } from "../../apps/web/src/components/klara-vorschau/zustand";
import i18n from "../../apps/web/src/i18n";
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

beforeAll(() => {
  draht = drahtAufbauen();
  if (typeof Element.prototype.scrollIntoView !== "function") {
    Element.prototype.scrollIntoView = () => {};
  }
});

afterAll(() => {
  draht.abbauen();
});

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  zuruecksetzenGanz();
  vergiss();
  setzeKlaraVorschauAktiv(true);
  medienStub();
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  abbauen();
  document.body.innerHTML = "";
  vergiss();
  setzeKlaraVorschauAktiv(false);
  zuruecksetzenGanz();
  if (aufbau) {
    await aufbau.app.close();
    aufbau = null;
  }
  draht.setzeApp(null);
  draht.setzeCookie(null);
  draht.lage.generierungen = 0;
  draht.lage.vorlagen.length = 0;
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

async function app(): Promise<Aufbau> {
  const a = await appAufbauen(false);
  aufbau = a;
  draht.setzeApp(a.app);
  return a;
}

function alsKonto(k: Konto): void {
  draht.setzeCookie(`kw_session=${k.token}`);
}

async function montiere(pfad: string): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const r = createRoot(container);
  root = r;
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const inhalt = createElement(
    "div",
    { "data-testid": "seite" },
    createElement(
      Routes,
      null,
      createElement(Route, {
        path: "/erfassen",
        element: createElement("div", { "data-testid": "seite-erfassen" }),
      }),
      createElement(Route, {
        path: "/fragen",
        element: createElement("div", { "data-testid": "seite-fragen" }),
      }),
    ),
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
                  createElement(AppShell, null, inhalt),
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
}

async function klaraOeffnen(pfad = "/fragen"): Promise<void> {
  await montiere(pfad);
  if (!q(document, "klara-gespraech")) {
    await klick(q(document, "klara-figur"));
  }
  await bis(() => Boolean(q(document, "klara-gespraech")));
  await bis(() => q(document, "klara-echt-hinweis")?.dataset.laden === "bereit", 200);
}

/** Neuladen: alles im Browser vergessen, Klara frisch öffnen — der Stand kommt vom Server. */
async function neuLaden(k: Konto): Promise<void> {
  abbauen();
  document.body.innerHTML = "";
  vergiss();
  zuruecksetzenGanz();
  setzeKlaraVorschauAktiv(true);
  alsKonto(k);
  await klaraOeffnen();
  await bis(() => Boolean(karte()?.dataset.phase), 400);
}

const text = (wurzel: ParentNode | null | undefined, id: string): string =>
  (wurzel ? q(wurzel, id)?.textContent : "") ?? "";

const karte = (): HTMLElement | null => q(document, "klara-ausfuehrung");

/** Der Ergebnisstand der neuesten Karte, wie sie ihn zeigt (`data-ergebnisstand`). */
const ergebnisstand = (): string =>
  q(document, "klara-ausfuehrung-ergebnisstand")?.dataset.ergebnisstand ?? "";

function schritte(): HTMLElement[] {
  const k = karte();
  return k ? alle(k, "klara-ausfuehrung-schritt") : [];
}

async function tippeUndSende(satz: string): Promise<void> {
  const feld = q<HTMLInputElement>(document, "klara-eingabe");
  if (!feld) {
    throw new Error("Eingabefeld fehlt");
  }
  await tippe(feld, satz);
  await klick(q(document, "klara-senden"));
}

async function bisPhase(...phasen: string[]): Promise<void> {
  await bis(() => phasen.includes(karte()?.dataset.phase ?? ""), 400);
  expect(phasen, karte()?.textContent ?? "").toContain(karte()?.dataset.phase);
}

interface Entwurf {
  id: string;
  payload: { title?: string; statement?: string };
  updatedAt: string;
}

async function entwurfAnlegen(a: Aufbau, k: Konto, title: string): Promise<Entwurf> {
  const r = await a.app.inject({
    method: "POST",
    url: "/api/drafts",
    headers: k.kopf,
    payload: { title, statement: "Basis." },
  });
  expect(r.statusCode, r.body).toBe(201);
  return r.json() as Entwurf;
}

async function entwurfLesen(a: Aufbau, k: Konto, id: string): Promise<Entwurf> {
  const r = await a.app.inject({ method: "GET", url: `/api/drafts/${id}`, headers: k.kopf });
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as Entwurf;
}

async function auftragsKennung(a: Aufbau, k: Konto): Promise<string> {
  const g = await a.app.inject({ method: "GET", url: "/api/me/klara/gespraech", headers: k.kopf });
  const gid = (g.json() as { gespraech: { id: string } | null }).gespraech?.id;
  if (!gid) {
    return "";
  }
  const r = await a.app.inject({
    method: "GET",
    url: `/api/me/klara/gespraeche/${gid}/auftraege`,
    headers: k.kopf,
  });
  const [x] = (r.json() as { auftraege: { id: string }[] }).auftraege;
  return x?.id ?? "";
}

// ================================================================================================
describe("N1 · K2/K3/K4 — ausgeführt, nachgewiesen, nach dem Neuladen zurückgenommen", () => {
  it("die Karte zeigt Ergebnis und Nachweis; nach Neuladen bleibt beides, Rückgängig wirkt", async () => {
    const a = await app();
    const ich = await neuesKonto(a.app, "pv02-erika", a.admin);
    const d = await entwurfAnlegen(a, ich, "Pumpe P9");
    alsKonto(ich);
    await klaraOeffnen();
    await tippeUndSende("Ergänze im Entwurf „Pumpe P9“: Dichtung prüfen");
    await bisPhase("fertig");

    const k = karte() as HTMLElement;
    expect(ergebnisstand()).toBe("ausgefuehrt");
    expect(text(k, "klara-ausfuehrung-ergebnisstand")).toContain("Ausgeführt");
    const nachher = await entwurfLesen(a, ich, d.id);
    expect(nachher.payload.statement).toBe("Basis. Dichtung prüfen");
    const aid = await auftragsKennung(a, ich);

    const pruefeNachweis = (stand: "gespeichert" | "zurueckgenommen") => {
      const s = schritte()[0] as HTMLElement;
      const n = q(s, "klara-ausfuehrung-nachweis") as HTMLElement;
      expect(n).not.toBeNull();
      expect(text(n, "klara-nachweis-aktionskennung")).toBe(`klara-auftrag-${aid}-1`);
      expect(text(n, "klara-nachweis-vorgang")).toContain("Entwurf bearbeiten · Schritt 1");
      expect(q(n, "klara-nachweis-zeitpunkt")?.dataset.am).not.toBe("");
      expect(text(n, "klara-nachweis-ausfuehrend")).toContain("im Auftrag von pv02-erika");
      expect(q(n, "klara-nachweis-ergebnis")?.dataset.stand).toBe(stand);
      expect(q(n, "klara-nachweis-vorher")?.dataset.stand).toBe(d.updatedAt);
      expect(text(n, "klara-nachweis-vorher")).toContain("Fassung vom");
      expect(q(n, "klara-nachweis-neu")?.dataset.stand).toBe(nachher.updatedAt);
      expect(q(n, "klara-nachweis-wirkung")?.dataset.vertrag).toBe("entwurf_bearbeiten");
      expect(text(n, "klara-nachweis-recht")).toContain("ko.create");
      return n;
    };
    const n = pruefeNachweis("gespeichert");
    expect(text(n, "klara-nachweis-ruecknahme")).toContain("Rücknehmbar");

    // Das Prüfprotokoll zu genau diesem Schritt — aus der vorhandenen Kette.
    await klick(q(n, "klara-nachweis-protokoll-laden"));
    await bis(() => alle(n, "klara-nachweis-protokoll-eintrag").length > 0, 200);
    const eintraege = alle(n, "klara-nachweis-protokoll-eintrag");
    expect(eintraege.map((e) => e.dataset.stand)).toEqual(["begonnen", "gespeichert"]);
    expect(eintraege.every((e) => e.dataset.aktionskennung === `klara-auftrag-${aid}-1`)).toBe(
      true,
    );

    // NEULADEN: derselbe Nachweis kommt vom Server; Rückgängig ist direkt erreichbar.
    await neuLaden(ich);
    expect(karte()?.dataset.phase).toBe("fertig");
    expect(ergebnisstand()).toBe("ausgefuehrt");
    pruefeNachweis("gespeichert");
    const knopf = q(schritte()[0] as HTMLElement, "klara-ausfuehrung-rueckgaengig");
    expect(knopf, "Rückgängig nach dem Neuladen nicht erreichbar").not.toBeNull();
    await klick(knopf);
    await bis(() => schritte()[0]?.dataset.stand === "zurueckgenommen", 200);

    const zurueck = await entwurfLesen(a, ich, d.id);
    expect(zurueck.payload.statement).toBe("Basis.");
    expect(zurueck.updatedAt).not.toBe(nachher.updatedAt);
    expect(ergebnisstand()).toBe("zurueckgenommen");
    const n2 = pruefeNachweis("zurueckgenommen");
    expect(q(n2, "klara-nachweis-ruecknahme-stand")?.dataset.stand).toBe(zurueck.updatedAt);

    // Und noch einmal neu geladen: der zurückgenommene Stand bleibt, kein Rückgängig mehr.
    await neuLaden(ich);
    expect(schritte()[0]?.dataset.stand).toBe("zurueckgenommen");
    expect(q(schritte()[0] as HTMLElement, "klara-ausfuehrung-rueckgaengig")).toBeNull();
    pruefeNachweis("zurueckgenommen");
  });
});

// ================================================================================================
describe("N2 · K5 — die Rücknahme überschreibt keine neuere Fassung und erklärt den Stand", () => {
  it("nach einer Änderung im Editor: Konfliktblock mit beiden Ständen und Korrekturweg", async () => {
    const a = await app();
    const ich = await neuesKonto(a.app, "pv02-konflikt", a.admin);
    alsKonto(ich);
    await klaraOeffnen();
    await tippeUndSende("Lege den Entwurf „Konfliktprobe K1“ an");
    await bisPhase("fertig");
    const listen = await a.app.inject({ method: "GET", url: "/api/drafts", headers: ich.kopf });
    const [d] = (listen.json() as Entwurf[]).filter((x) => x.payload.title === "Konfliktprobe K1");
    const angelegt = d as Entwurf;
    const erster = schritte()[0] as HTMLElement;
    const klarasStand = q(erster, "klara-nachweis-neu")?.dataset.stand ?? "";
    expect(klarasStand).toBe(angelegt.updatedAt);

    // Ein zweiter Tab bearbeitet den Entwurf im vorhandenen Editor weiter.
    await new Promise((r) => setTimeout(r, 5));
    const weiter = await a.app.inject({
      method: "PUT",
      url: `/api/drafts/${angelegt.id}`,
      headers: ich.kopf,
      payload: { statement: "Inzwischen ausgefüllt." },
    });
    expect(weiter.statusCode, weiter.body).toBe(200);
    const aktuell = await entwurfLesen(a, ich, angelegt.id);

    await klick(q(karte() as HTMLElement, "klara-ausfuehrung-rueckgaengig"));
    await bis(() => Boolean(q(document, "klara-ausfuehrung-ruecknahme-konflikt")), 200);
    const konflikt = q(document, "klara-ausfuehrung-ruecknahme-konflikt") as HTMLElement;
    expect(konflikt.dataset.grund).toBe("geaendert");
    const staende = q(konflikt, "klara-ruecknahme-konflikt-staende") as HTMLElement;
    expect(staende.dataset.eigen).toBe(klarasStand);
    expect(staende.dataset.aktuell).toBe(aktuell.updatedAt);
    expect(staende.textContent).toContain("Die neuere Fassung bleibt unverändert");
    const weg = q<HTMLAnchorElement>(konflikt, "klara-ruecknahme-konflikt-korrekturweg");
    expect(weg?.getAttribute("href")).toBe(`/erfassen?draft=${angelegt.id}`);
    expect(weg?.textContent).toBe("Im Entwurf korrigieren");
    // Die bisherige Meldung von Klara 05 bleibt, der Schritt bleibt gespeichert.
    expect(text(document, "klara-ausfuehrung-ruecknahme-meldung")).toContain("weiter geändert");
    expect(schritte()[0]?.dataset.stand).toBe("gespeichert");
    expect((await entwurfLesen(a, ich, angelegt.id)).payload.statement).toBe(
      "Inzwischen ausgefüllt.",
    );

    // Der Korrekturweg führt in den vorhandenen Editor.
    await klick(weg);
    await bis(() => Boolean(q(document, "seite-erfassen")), 200);
    expect(q(document, "seite-erfassen")).not.toBeNull();
  });
});

// ================================================================================================
describe("N3 · K2 — ohne Ausführung steht nichts als ausgeführt da", () => {
  it("unbekanntes Ziel: kein Auftrag am Server, kein Ergebnisstand „Ausgeführt“", async () => {
    const a = await app();
    const ich = await neuesKonto(a.app, "pv02-ohne", a.admin);
    alsKonto(ich);
    await klaraOeffnen();
    await tippeUndSende("Öffne den Artikel „Gibt es nicht 4712“");
    await bisPhase("unbekannt");
    expect(ergebnisstand()).not.toBe("ausgefuehrt");
    expect(await auftragsKennung(a, ich)).toBe("");
  });
});
