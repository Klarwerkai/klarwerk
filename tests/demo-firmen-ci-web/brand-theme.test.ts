// @vitest-environment jsdom
// ================================================================================================
// JOB 3511 · L1/L2/L6/L7/L8 — EINE SITZUNG MIT DER MARKENEBENE, IN DER REIHENFOLGE, IN DER SIE
// WIRKLICH PASSIERT.
// ================================================================================================
//
// Diese Datei ist BEWUSST eine fortlaufende Sitzung und keine Sammlung unabhängiger Fälle. Der
// Gegenstand ist ein Modul mit Gedächtnis: es merkt sich die zuletzt gesehene `version` und den
// Zeitpunkt des letzten Abrufs, und genau daran hängen zwei Lieferungen (Drosselung auf einen
// Abruf je Minute, Übernahme ohne Neuladen). Ein Test, der dieses Gedächtnis vor jedem Fall
// zurücksetzt, könnte beides gar nicht messen. Die Reihenfolge IST der Prüffall.
//
//   S0  Ausgangslage    Der Mensch hat „klassisch" gewählt — die Wahl liegt im Browser.
//   S1  Start           Ein Abruf auf GET /api/branding, Attribut gesetzt, Wahl unangetastet.
//   S2  Drosselung      Fokus innerhalb der Minute → KEIN zweiter Abruf.
//   S3  Nachführung     Nach der Minute, neue `version` → Übernahme ohne Neuladen der Seite.
//   S4  Ruhe            Gleiche `version` → die Wurzel wird gar nicht erst angefasst.
//   S5  Abruffehler     Der zuletzt bekannte Zustand bleibt; nichts wird geleert, nichts fliegt.
//   S6  Der eine PUT    Die Adminfläche schreibt GENAU den Vertragskörper, nicht ein Feld mehr.
//   S7  Halbe Zustände  Profil ohne Schalter und Schalter ohne Profil sind beide „aus".
//   S8  Kein Speicher   Die Markenwahl hat keine zweite Heimat im Browser.
//   S9  Keine Übertragung  In der ganzen Sitzung nur diese zwei Adressen, keine dritte.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const a = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));

// Die einzige Attrappe ist die Endpunktgrenze — dieselbe Bauform wie
// tests/demopaket-advisor/flaeche-mounted.test.tsx. `ApiError` bleibt bewusst die ECHTE Klasse:
// `ladeBranding` unterscheidet 404 von jedem anderen Fehler über `instanceof`, und eine
// nachgebaute Klasse würde genau diese Unterscheidung am Prüfstand vorbeiführen.
vi.mock("../../apps/web/src/api/client", async (echt) => ({
  ...(await echt<typeof import("../../apps/web/src/api/client")>()),
  api: { get: a.get, put: a.put },
}));

import { ApiError } from "../../apps/web/src/api/client";
import {
  BRANDING_ADMIN_PFAD,
  BRANDING_MINDESTABSTAND_MS,
  BRANDING_PFAD,
  BRANDING_UNBEKANNT,
  BRAND_ATTRIBUT,
  type BrandingStand,
  initBrandTheme,
  ladeBranding,
  setzeBranding,
  uebernimmBranding,
} from "../../apps/web/src/lib/brandTheme";
import {
  DESIGN_THEME_ATTRIBUTE,
  DESIGN_THEME_STORAGE_KEY,
  initDesignTheme,
} from "../../apps/web/src/lib/designTheme";

/**
 * Der AUSFÜHRBARE Teil der Quelle. Die Kommentare sind bewusst draußen: sie erklären, warum es
 * keinen zweiten Speicher gibt, und nennen dabei `localStorage` beim Namen — eine Suche über den
 * Rohtext würde also genau die Erklärung als Verstoß zählen.
 */
const QUELLE = readFileSync(join(__dirname, "../../apps/web/src/lib/brandTheme.ts"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

// Strukturelle Sicht auf das jsdom-Fenster statt der DOM-lib. Bauform aus
// tests/capture/editor-figure-caption.test.ts:43 — und aus demselben Grund: der Wurzel-Typecheck
// (`tsconfig.json`) ist Node-rein, `.ts`-Dateien unter `tests/` bekommen dort kein `lib: dom`.
type WurzelLike = {
  setAttribute(name: string, wert: string): void;
  getAttribute(name: string): string | null;
  removeAttribute(name: string): void;
  hasAttribute(name: string): boolean;
};
type Ereignisziel = { dispatchEvent(ereignis: unknown): boolean };
type FensterLike = Ereignisziel & {
  document: Ereignisziel & { documentElement: WurzelLike };
  localStorage: { getItem(k: string): string | null; setItem(k: string, v: string): void };
  Event: new (typ: string) => unknown;
};

const w = globalThis as unknown as FensterLike;
const wurzel = (): WurzelLike => w.document.documentElement;
const melde = (ziel: Ereignisziel, typ: string): void => {
  ziel.dispatchEvent(new w.Event(typ));
};

/** Der Stand, wie der Server ihn liefert — wörtlich die Form aus dem Vertrag (Auftrag §5.1). */
const stand = (teile: Partial<BrandingStand> = {}): BrandingStand => ({
  profil: "advisor",
  aktiv: true,
  version: 1,
  marke: {
    name: "Advisor",
    farben: { primaer: "#0578b7", schrift: "#161417" },
    logo: "/marke/advisor/adv-logo.svg",
  },
  ...teile,
});

let jetzt = 1_700_000_000_000;
const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/** Wie viele Abrufe seit der letzten Frage dazugekommen sind. */
let gezaehlt = 0;
const neueAbrufe = (): number => {
  const n = a.get.mock.calls.length - gezaehlt;
  gezaehlt = a.get.mock.calls.length;
  return n;
};

beforeAll(() => {
  vi.spyOn(Date, "now").mockImplementation(() => jetzt);
  // NUR `setInterval` wird gefälscht, und das mit Absicht: der Takt aus `initBrandTheme` soll sich
  // auf Kommando auslösen lassen (S11), ohne dass 60 echte Sekunden vergehen. `setTimeout` bleibt
  // ECHT — `flush()` unten hängt daran, und ein gefälschtes `setTimeout` hielte genau die
  // Versprechen an, die diese Sitzung auflösen muss. Die Drosselung selbst hängt an `Date.now()`
  // und wird über `jetzt` gestellt, nicht über die Uhr der Timer.
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
});

afterAll(() => {
  vi.useRealTimers();
});

describe("JOB 3511 S · die Markenebene über eine Sitzung", () => {
  it("S0 · Ausgangslage: der Mensch hat „klassisch“ gewählt, und das steht im Browser", () => {
    w.localStorage.setItem(DESIGN_THEME_STORAGE_KEY, "classic");
    initDesignTheme();
    expect(wurzel().hasAttribute(DESIGN_THEME_ATTRIBUTE)).toBe(false);
    expect(wurzel().hasAttribute(BRAND_ATTRIBUT)).toBe(false);
  });

  it("S1 · Start: ein Abruf auf GET /api/branding, Marke gesetzt, Darstellungswahl unangetastet", async () => {
    a.get.mockResolvedValue(stand());
    initBrandTheme();
    await flush();
    expect(neueAbrufe()).toBe(1);
    expect(a.get).toHaveBeenLastCalledWith(BRANDING_PFAD);
    expect(wurzel().getAttribute(BRAND_ATTRIBUT)).toBe("advisor");
    // Lieferung 2: ZUSÄTZLICH zu data-theme, nie an seiner Stelle.
    expect(wurzel().hasAttribute(DESIGN_THEME_ATTRIBUTE)).toBe(false);
    expect(w.localStorage.getItem(DESIGN_THEME_STORAGE_KEY)).toBe("classic");
  });

  it("S2 · Drosselung: Fokus innerhalb der Minute löst KEINEN zweiten Abruf aus", async () => {
    jetzt += BRANDING_MINDESTABSTAND_MS - 1;
    melde(w, "focus");
    melde(w.document, "visibilitychange");
    await flush();
    expect(neueAbrufe()).toBe(0);
  });

  it("S3 · nach der Minute: geänderte version wird übernommen, ohne die Seite neu zu laden", async () => {
    jetzt += 2;
    a.get.mockResolvedValue(stand({ aktiv: false, version: 2 }));
    melde(w.document, "visibilitychange");
    await flush();
    expect(neueAbrufe()).toBe(1);
    // Ausschalten heißt: Attribut WEG. Kein data-brand="" und kein data-brand="keine".
    expect(wurzel().hasAttribute(BRAND_ATTRIBUT)).toBe(false);
  });

  it("S4 · gleiche version: die Wurzel wird gar nicht erst angefasst", async () => {
    // Ein Schreiben ist nur dadurch beobachtbar, dass es einen fremden Wert überschreibt. Die
    // Handverstellung ist deshalb die Sonde und nicht der Prüfgegenstand.
    wurzel().setAttribute(BRAND_ATTRIBUT, "handverstellt");
    jetzt += BRANDING_MINDESTABSTAND_MS;
    a.get.mockResolvedValue(stand({ aktiv: false, version: 2 }));
    melde(w, "focus");
    await flush();
    expect(neueAbrufe()).toBe(1);
    expect(wurzel().getAttribute(BRAND_ATTRIBUT)).toBe("handverstellt");
    wurzel().removeAttribute(BRAND_ATTRIBUT);
  });

  it("S5 · Abruffehler: der zuletzt bekannte Zustand bleibt, und nichts fliegt", async () => {
    jetzt += BRANDING_MINDESTABSTAND_MS;
    a.get.mockResolvedValue(stand({ aktiv: true, version: 3 }));
    melde(w, "focus");
    await flush();
    expect(wurzel().getAttribute(BRAND_ATTRIBUT)).toBe("advisor");

    jetzt += BRANDING_MINDESTABSTAND_MS;
    a.get.mockRejectedValue(new Error("offline"));
    melde(w, "focus");
    await flush();
    expect(neueAbrufe()).toBe(2);
    // LEHREN §7: eine gescheiterte Hintergrund-Auffrischung leert NICHTS.
    expect(wurzel().getAttribute(BRAND_ATTRIBUT)).toBe("advisor");
  });

  it("S6 · die Adminfläche schreibt GENAU den Vertragskörper — kein Feld mehr, kein Feld weniger", async () => {
    a.put.mockResolvedValue(stand({ profil: null, aktiv: false, version: 4, marke: null }));
    const antwort = await setzeBranding({ profil: null, aktiv: false });
    expect(a.put).toHaveBeenCalledTimes(1);
    expect(a.put.mock.calls[0]?.[0]).toBe(BRANDING_ADMIN_PFAD);
    expect(a.put.mock.calls[0]?.[1]).toEqual({ profil: null, aktiv: false });
    expect(Object.keys(a.put.mock.calls[0]?.[1] as object)).toEqual(["profil", "aktiv"]);
    uebernimmBranding(antwort);
    expect(wurzel().hasAttribute(BRAND_ATTRIBUT)).toBe(false);
  });

  it("S7 · halbe Zustände sind „aus“: Profil ohne Schalter, Schalter ohne Profil", () => {
    uebernimmBranding(stand({ profil: "advisor", aktiv: false, version: 5 }));
    expect(wurzel().hasAttribute(BRAND_ATTRIBUT)).toBe(false);
    uebernimmBranding(stand({ profil: null, aktiv: true, version: 6, marke: null }));
    expect(wurzel().hasAttribute(BRAND_ATTRIBUT)).toBe(false);
    uebernimmBranding(stand({ version: 7 }));
    expect(wurzel().getAttribute(BRAND_ATTRIBUT)).toBe("advisor");
  });

  it("S8 · keine zweite Speicherschicht: die Markenwahl kommt vom Server und sonst nirgendwoher", () => {
    expect(QUELLE).not.toMatch(/localStorage|sessionStorage|persistentToggle|document\.cookie/);
    // Und die Wahl des Menschen liegt nach der ganzen Sitzung unverändert da, wo sie hingehört.
    expect(w.localStorage.getItem(DESIGN_THEME_STORAGE_KEY)).toBe("classic");
    expect(wurzel().hasAttribute(DESIGN_THEME_ATTRIBUTE)).toBe(false);
  });

  it("S9 · in der ganzen Sitzung genau zwei Adressen — das Umschalten überträgt nichts sonst", () => {
    const gerufen = new Set(a.get.mock.calls.map((c) => c[0] as string));
    expect(gerufen).toEqual(new Set([BRANDING_PFAD]));
    expect(new Set(a.put.mock.calls.map((c) => c[0] as string))).toEqual(
      new Set([BRANDING_ADMIN_PFAD]),
    );
    // Lieferung 8: kein KI-Weg, kein Demo-Datenweg, kein zweiter Schreibweg.
    expect(QUELLE).not.toMatch(/\/(ai|reasoner|demo-seed|demo-packages)/);
  });

  // ==============================================================================================
  // S10 — DIE UNTERSCHEIDUNG, DIE DER TORLAUF ERZWUNGEN HAT.
  // ==============================================================================================
  // Der Serverweg entsteht in JOB 3510 und fehlt auf jedem Stand davor. Ohne die 404-Regel stünde
  // in der Karte „Demodaten" DAUERHAFT eine Fehlerbox — gefunden von
  // `tests/design/h6-detail-zustandsweg.test.ts`, Fall K. Die Regel darf aber nicht zum Schlucker
  // für jeden Fehler werden: nur „gibt es hier nicht" sagt etwas über die Installation aus.
  it("S10 · 404 heißt „diese Installation kennt keine Firmen-CI“ — jeder andere Fehler bleibt einer", async () => {
    a.get.mockRejectedValueOnce(new ApiError(404, "NOT_FOUND", "Not Found"));
    await expect(ladeBranding()).resolves.toEqual(BRANDING_UNBEKANNT);
    expect(BRANDING_UNBEKANNT.aktiv, "„unbekannt“ darf keine Marke einschalten").toBe(false);
    expect(BRANDING_UNBEKANNT.profil).toBeNull();
    // Eine Version, die der Server nie senden kann: kommt der echte Weg dazu, wird SEIN Stand
    // übernommen und nicht als „schon bekannt" verworfen.
    expect(BRANDING_UNBEKANNT.version).toBeLessThan(0);

    a.get.mockRejectedValueOnce(new ApiError(503, "UNAVAILABLE", "Service Unavailable"));
    await expect(ladeBranding()).rejects.toBeInstanceOf(ApiError);
    a.get.mockRejectedValueOnce(new Error("Netz weg"));
    await expect(ladeBranding()).rejects.toThrow("Netz weg");
    // Der Zähler wird hier ausdrücklich nachgeführt: dieser Fall ruft `ladeBranding` DREIMAL
    // direkt, an der Drosselung vorbei. Ohne diese Zeile trüge S11 die drei Aufrufe als „Takt"
    // in seine Messung — der Fall wäre grün, ohne den Takt je gemessen zu haben.
    expect(neueAbrufe(), "die drei direkten Abrufe dieses Falls").toBe(3);
  });

  // ==============================================================================================
  // S11/S12 — DIE ZWEI KORREKTURPFLICHTEN AUS BENs PRÜFUNG DER RUNDE 1.
  // ==============================================================================================

  it("S11 · ein Fenster, das NIEMAND anfasst, führt die Marke trotzdem nach", async () => {
    // BENs Befund, wörtlich: „Nach 120 Sekunden ohne Fokuswechsel weiterhin nur ein Abruf." Genau
    // dieser Bildschirm ist die Vorführfläche am Freitag: dauerhaft sichtbar, kein Klick, kein
    // Tabwechsel. Hier wird deshalb AUSSCHLIESSLICH die Zeit bewegt — kein `focus`, kein
    // `visibilitychange`. Vor der Reparatur blieb `neueAbrufe()` hier bei 0.
    expect(wurzel().getAttribute(BRAND_ATTRIBUT), "Ausgangslage: Marke an").toBe("advisor");
    a.get.mockResolvedValue(stand({ aktiv: false, version: 8 }));
    jetzt += BRANDING_MINDESTABSTAND_MS;
    vi.advanceTimersByTime(BRANDING_MINDESTABSTAND_MS);
    await flush();
    expect(neueAbrufe(), "der Takt hat nicht geschlagen").toBe(1);
    expect(wurzel().hasAttribute(BRAND_ATTRIBUT)).toBe(false);

    // Und die Drosselung gilt über ALLE Wege zusammen: der nächste Schlag kommt zu früh.
    a.get.mockResolvedValue(stand({ aktiv: true, version: 9 }));
    vi.advanceTimersByTime(BRANDING_MINDESTABSTAND_MS);
    await flush();
    expect(neueAbrufe(), "der Takt umgeht seine eigene Drosselung").toBe(0);
    expect(wurzel().hasAttribute(BRAND_ATTRIBUT)).toBe(false);
  });

  it("S12 · eine verspätete ÄLTERE Antwort dreht eine bestätigte Schaltung NICHT zurück", async () => {
    // BENs Gegenprobe, nachgestellt: der `GET` startet, WÄHREND er unterwegs ist bestätigt ein
    // `PUT` eine neuere Version — und erst danach trifft die alte Antwort ein. Vor der Reparatur
    // („jede ANDERE Version") nahm die alte Antwort das Attribut wieder weg.
    let loeseAlteAntwortAus: (s: BrandingStand) => void = () => undefined;
    a.get.mockImplementationOnce(
      () =>
        new Promise<BrandingStand>((aufloesen) => {
          loeseAlteAntwortAus = aufloesen;
        }),
    );
    jetzt += BRANDING_MINDESTABSTAND_MS;
    melde(w, "focus");
    await flush();
    expect(neueAbrufe(), "der Abruf ist gar nicht erst gestartet").toBe(1);

    // Jetzt schaltet Pedi ein; der Server bestätigt Version 20.
    uebernimmBranding(stand({ aktiv: true, version: 20 }));
    expect(wurzel().getAttribute(BRAND_ATTRIBUT)).toBe("advisor");

    // Und JETZT erst kommt die überholte Antwort von vorhin.
    loeseAlteAntwortAus(stand({ aktiv: false, version: 9 }));
    await flush();
    expect(
      wurzel().getAttribute(BRAND_ATTRIBUT),
      "eine ältere Antwort hat die bestätigte Schaltung zurückgedreht",
    ).toBe("advisor");

    // Gegenrichtung, damit der Wächter kein Dauer-Nein ist: eine NEUERE Antwort greift weiterhin.
    a.get.mockResolvedValue(stand({ aktiv: false, version: 21 }));
    jetzt += BRANDING_MINDESTABSTAND_MS;
    melde(w, "focus");
    await flush();
    expect(wurzel().hasAttribute(BRAND_ATTRIBUT)).toBe(false);
  });
});
