// @vitest-environment jsdom
// ================================================================================================
// JOB 3511 · L5/L8/L9 — DIE BEDIENFLÄCHE „DEMO-ERSCHEINUNGSBILD", GEMOUNTET.
// ================================================================================================
//
// Gemessen wird an der ECHTEN Karte, die Pedi öffnet (Admin → Vorführdaten → Demodaten), mit
// echtem React, echtem i18n und echtem React-Query — nicht an einem herausgelösten Baustein. Die
// einzigen Attrappen sind die Endpunktgrenzen (`api/client`, `api/endpoints`, `api/hooks`);
// Bauform wie tests/demopaket-advisor/flaeche-mounted.test.tsx.
//
//   A1  Der Abschnitt ist da   Titel, Profilauswahl, Schalter — und der Satz, der erklärt, was
//                              passiert (gilt für alle · unabhängig von den Datenpaketen · lädt
//                              und löscht nichts).
//   A2  Einschalten            Ein Klick → GENAU EIN PUT mit dem Vertragskörper, und die Marke
//                              steht sofort an der Wurzel.
//   A3  Ausschalten            Der Rückweg schickt `aktiv:false` und nimmt das Attribut weg.
//   A4  Profil zurücknehmen    Ohne Profil fällt der Schalter mit — nie „aktiv ohne Profil".
//   A5  Keine Daten            Das Umschalten ruft KEINEN Demodatenweg auf.
//   A6  Abruffehler            Scheitert der Stand, behauptet die Fläche nichts, sondern bietet
//                              den Ausweg der Hülle an.
//   A7  DE und EN              Beide Sprachen stehen im Bestand und erscheinen auf der Fläche.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  demoStatus: vi.fn(),
  demoSeed: vi.fn(),
  demoPurge: vi.fn(),
}));

// `ApiError` bleibt die ECHTE Klasse: die 404-Unterscheidung in `ladeBranding` hängt an
// `instanceof`, und eine nachgebaute Klasse führte genau daran vorbei.
vi.mock("../../apps/web/src/api/client", async (echt) => ({
  ...(await echt<typeof import("../../apps/web/src/api/client")>()),
  api: { get: d.get, put: d.put },
}));
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    admin: { demoStatus: d.demoStatus, demoSeed: d.demoSeed, demoPurge: d.demoPurge },
  },
}));
vi.mock("../../apps/web/src/api/hooks", () => ({
  useFeatures: () => ({ data: { features: { demodaten: true } } }),
  useUsers: () => ({ data: [] }),
  useAudit: () => ({ data: [] }),
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { ApiError } from "../../apps/web/src/api/client";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import type { BrandingStand } from "../../apps/web/src/lib/brandTheme";
import { BRAND_ATTRIBUT } from "../../apps/web/src/lib/brandTheme";
import { DemodatenDetail } from "../../apps/web/src/pages/AdminDatenDetails";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Wörtlich die Form aus dem Vertrag (Auftrag §5.1). */
const stand = (teile: Partial<BrandingStand> = {}): BrandingStand => ({
  profil: "advisor",
  aktiv: false,
  version: 1,
  marke: {
    name: "Advisor",
    farben: { primaer: "#0578b7", schrift: "#161417" },
    logo: "/marke/advisor/adv-logo.svg",
  },
  ...teile,
});

/**
 * Der PUT antwortet — UND der Server merkt sich den neuen Stand für den nächsten GET.
 *
 * Das ist keine Bequemlichkeit, sondern die Nachstellung eines echten Servers: nach einem
 * erfolgreichen `PUT` liefert `GET /api/branding` genau das, was geschrieben wurde. Eine Attrappe,
 * bei der die beiden auseinanderlaufen, prüft eine Lage, die es am echten Server nie gibt — und
 * verdeckt, ob die Fläche ihren Stand vom Server oder aus einer eigenen Kopie nimmt.
 */
const serverNimmtAn = (antwort: BrandingStand): void => {
  d.put.mockResolvedValue(antwort);
  d.get.mockResolvedValue(antwort);
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function stelleAuf(): Promise<void> {
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          ToastProvider,
          null,
          createElement(DemodatenDetail, { onZurueck: () => undefined }),
        ),
      ),
    );
  });
  await act(async () => {
    await flush();
  });
}

const abschnitt = (): HTMLElement => {
  const el = container.querySelector('[data-einst="erscheinungsbild"]');
  expect(el, "Abschnitt „Demo-Erscheinungsbild“").not.toBeNull();
  return el as HTMLElement;
};

const feld = <T extends HTMLElement>(testId: string): T => {
  const el = abschnitt().querySelector(`[data-testid="${testId}"]`);
  expect(el, testId).not.toBeNull();
  return el as T;
};

beforeEach(async () => {
  await i18n.changeLanguage("de");
  document.documentElement.removeAttribute(BRAND_ATTRIBUT);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  d.get.mockReset();
  d.put.mockReset();
  d.demoStatus.mockReset();
  d.demoSeed.mockReset();
  d.demoPurge.mockReset();
  d.demoStatus.mockResolvedValue({ present: false, count: 0 });
  d.get.mockResolvedValue(stand());
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  qc.clear();
});

describe("JOB 3511 A · die Bedienfläche des Demo-Erscheinungsbilds", () => {
  it("A1 · Titel, Profilauswahl, Schalter — und der Satz, der sagt, was passiert", async () => {
    await stelleAuf();
    const text = abschnitt().textContent ?? "";
    expect(text).toContain("Demo-Erscheinungsbild");
    expect(text).toContain("Firmenprofil");
    expect(text).toContain("Firmen-CI verwenden");
    // Die drei Zusicherungen aus dem Auftrag, wörtlich auf der Fläche:
    expect(text).toContain("für alle Anwender dieser Installation");
    expect(text).toContain("unabhängig von den Demo-Datenpaketen");
    expect(text).toContain(
      "lädt keine Daten, löscht keine Daten und startet keine KI-Verarbeitung",
    );
    // Heute genau ein Firmenprofil zur Wahl — plus „keines".
    const auswahl = feld<HTMLSelectElement>("marke-profil");
    expect([...auswahl.options].map((o) => o.value)).toEqual(["", "advisor"]);
    expect(auswahl.value).toBe("advisor");
    expect(feld<HTMLInputElement>("marke-schalter").checked).toBe(false);
    // Der Stand kommt vom Server, aus GENAU der Adresse des Vertrags.
    expect(d.get).toHaveBeenCalledWith("/branding");
  });

  it("A2 · Einschalten: genau ein PUT mit dem Vertragskörper, Marke sofort an der Wurzel", async () => {
    await stelleAuf();
    serverNimmtAn(stand({ aktiv: true, version: 2 }));
    const schalter = feld<HTMLInputElement>("marke-schalter");
    await act(async () => {
      schalter.click();
      await flush();
    });
    expect(d.put).toHaveBeenCalledTimes(1);
    expect(d.put.mock.calls[0]?.[0]).toBe("/admin/branding");
    expect(d.put.mock.calls[0]?.[1]).toEqual({ profil: "advisor", aktiv: true });
    expect(document.documentElement.getAttribute(BRAND_ATTRIBUT)).toBe("advisor");
  });

  it("A3 · Ausschalten: derselbe Weg zurück, und das Attribut ist restlos weg", async () => {
    d.get.mockResolvedValue(stand({ aktiv: true }));
    await stelleAuf();
    serverNimmtAn(stand({ aktiv: false, version: 3 }));
    await act(async () => {
      feld<HTMLInputElement>("marke-schalter").click();
      await flush();
    });
    expect(d.put.mock.calls[0]?.[1]).toEqual({ profil: "advisor", aktiv: false });
    expect(document.documentElement.hasAttribute(BRAND_ATTRIBUT)).toBe(false);
  });

  it("A4 · Profil zurücknehmen: der Schalter fällt mit — nie „aktiv ohne Profil“", async () => {
    d.get.mockResolvedValue(stand({ aktiv: true }));
    await stelleAuf();
    serverNimmtAn(stand({ profil: null, aktiv: false, version: 4, marke: null }));
    const auswahl = feld<HTMLSelectElement>("marke-profil");
    await act(async () => {
      auswahl.value = "";
      auswahl.dispatchEvent(new Event("change", { bubbles: true }));
      await flush();
    });
    expect(d.put.mock.calls[0]?.[1]).toEqual({ profil: null, aktiv: false });
    expect(document.documentElement.hasAttribute(BRAND_ATTRIBUT)).toBe(false);
    // Ohne Profil ist der Schalter nicht bedienbar und sagt auch, warum.
    expect(feld<HTMLInputElement>("marke-schalter").disabled).toBe(true);
    expect(abschnitt().textContent).toContain("Ohne Firmenprofil gibt es nichts zu verwenden.");
  });

  // ==============================================================================================
  // KEIN FALL ZU BENs PRÜFLÜCKE 6 — und warum hier bewusst keiner steht.
  // ==============================================================================================
  // BEN schlug vor: „externe Änderung übernehmen und anschließend Schalterstellung sowie nächsten
  // PUT prüfen." Der Fall war geschrieben und hat die Lücke auch nachgewiesen. Die Lücke zu
  // SCHLIESSEN hat in dieser Runde dreimal eine echte Regression erzeugt (Läufe c11f0fea, 592c848c,
  // 2ee8ae7d) — zuletzt kaschierte der Speicherwert einen gescheiterten Abruf, sodass A6 und der
  // Torfall „Demo-Erscheinungsbild · /api/branding" der Endpunkt-Matrix ihre Fehlerbox verloren.
  // Ein Fall, der die HEUTIGE Lage grün festschreibt, wäre schlimmer als keiner: er verspräche
  // eine Deckung, die es nicht gibt. Die Lücke steht deshalb offen in der RUECKGABE, mit dem Ort,
  // an den sie gehört (zusammen mit dem Serverweg aus JOB 3510, der `version` wirklich monoton
  // vergibt). Siehe dort, Abschnitt PRUEFPUNKTE 6.

  it("A5 · das Umschalten rührt keinen einzigen Demodatenweg an", async () => {
    await stelleAuf();
    serverNimmtAn(stand({ aktiv: true, version: 2 }));
    await act(async () => {
      feld<HTMLInputElement>("marke-schalter").click();
      await flush();
    });
    expect(d.demoSeed).not.toHaveBeenCalled();
    expect(d.demoPurge).not.toHaveBeenCalled();
    // Und keine zweite Schreibadresse neben der einen des Vertrags.
    expect(new Set(d.put.mock.calls.map((c) => c[0] as string))).toEqual(
      new Set(["/admin/branding"]),
    );
  });

  it("A6 · scheitert der Stand, behauptet die Fläche nichts — sie bietet den Ausweg an", async () => {
    d.get.mockRejectedValue(new Error("kaputt"));
    await stelleAuf();
    const text = abschnitt().textContent ?? "";
    // Der Erklärsatz steht weiter da (er ist keine Tatsachenaussage über die Installation) …
    expect(text).toContain("Demo-Erscheinungsbild");
    // … aber weder Auswahl noch Schalter geben vor, einen Zustand zu kennen.
    expect(abschnitt().querySelector('[data-testid="marke-profil"]')).toBeNull();
    expect(abschnitt().querySelector('[data-testid="marke-schalter"]')).toBeNull();
    expect(abschnitt().querySelector('[data-einst="abfrage-fehler"]')).not.toBeNull();
  });

  it("A8 · kennt der Server den Weg gar nicht (404), steht dort „kein Firmenprofil“ statt eines Fehlers", async () => {
    // DER FALL, DEN DER TORLAUF GEFUNDEN HAT: der Serverweg entsteht in JOB 3510. Auf jedem Stand
    // davor antwortet `/api/branding` mit 404 — und ohne diese Unterscheidung stünde in der Karte
    // „Demodaten" DAUERHAFT eine Fehlerbox (tests/design/h6-detail-zustandsweg.test.ts, Fall K).
    d.get.mockRejectedValue(new ApiError(404, "NOT_FOUND", "Not Found"));
    await stelleAuf();
    expect(
      abschnitt().querySelector('[data-einst="abfrage-fehler"]'),
      "Fehlerbox, obwohl der Server nur sagt „gibt es hier nicht“",
    ).toBeNull();
    expect(feld<HTMLSelectElement>("marke-profil").value).toBe("");
    expect(feld<HTMLInputElement>("marke-schalter").checked).toBe(false);
    expect(feld<HTMLInputElement>("marke-schalter").disabled).toBe(true);
    expect(abschnitt().textContent).toContain("Ohne Firmenprofil gibt es nichts zu verwenden.");
  });

  it("A7 · DE und EN: beide Fassungen sind im Bestand und erscheinen auf der Fläche", async () => {
    await stelleAuf();
    expect(abschnitt().textContent).toContain("Firmen-CI verwenden");
    await act(async () => {
      await i18n.changeLanguage("en");
      await flush();
    });
    const text = abschnitt().textContent ?? "";
    expect(text).toContain("Demo appearance");
    expect(text).toContain("Use company CI");
    expect(text).toContain("Company profile");
    // Kein Schlüssel-Durchschlag: i18next gibt bei fehlender Übersetzung den Schlüssel aus.
    expect(text).not.toContain("einst.marke.");
    await act(async () => {
      await i18n.changeLanguage("de");
      await flush();
    });
  });
});
