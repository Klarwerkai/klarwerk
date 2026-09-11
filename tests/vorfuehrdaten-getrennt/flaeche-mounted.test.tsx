// @vitest-environment jsdom
// ================================================================================================
// JOB 3636 · VORFÜHRDATEN GETRENNT WÄHLEN — DIE ZWEI KARTEN, GEMOUNTET.
// ================================================================================================
//
// Pedi über Codex, 13:17: die Seite „soll vor dem Laden eindeutig zeigen, WELCHE Daten geladen
// werden"; er verlangt „getrennte Auswahl/Aktionen für allgemeine Demodaten und ‚Advisor-Demodaten
// laden'". Der Auftrag nennt in §4 die Regel, an der dieser Fall hängt: „Zweimal derselbe Aufruf
// mit zwei Beschriftungen wäre der Fehler, nicht die Lösung."
//
// GEMESSEN WIRD DESHALB DER AUFRUF, NICHT DIE BESCHRIFTUNG. Jeder Fall drückt einen Knopf und sieht
// an der Endpunktgrenze nach, welcher Weg wirklich gelaufen ist — und dass der jeweils andere
// STILL GEBLIEBEN ist. Ein Test, der nur den Text der Karte liest, wäre gegen genau den Fehler
// blind, den dieser Auftrag verbietet.
//
//   V1  Zwei Karten           Beide da, jede mit Beschreibung und eigenem, passendem Knopf.
//   V2  Knopf 1               „Demodaten laden" → `demoSeed`; das Paket wird NICHT geladen.
//   V3  Knopf 2               „Laden · Advisor ICT (EN)" → `demoPackages.load` mit der Kennung AUS
//                             DER SERVERLISTE; `demoSeed` bleibt ungerufen.
//   V4  Rückmeldung           Nach dem Laden nennt die Fläche das Paket beim Namen (§6).
//   V5  Paket fehlt           Steht das Advisor-Paket nicht in der Liste, gibt es keinen Knopf und
//                             keinen Aufruf — eine ehrliche Lücke statt einer erfundenen Kennung.
//   V6  DE und EN             Beide Karten samt Knöpfen und Paketbeschreibung in beiden Sprachen.
//   V7  Liste nicht abrufbar  Die Advisor-Karte sagt es und bietet den Ausweg; die allgemeine Karte
//                             bleibt vollständig bedienbar (LEHREN §7: nichts wird geleert).
//   V8  Nichts verdoppelt     Zurücksetzen und paketbezogenes Entfernen bleiben allein bei JOB 3277
//                             auf `/import`; der Gesamt-Entfernen-Weg steht unverändert da.
//   V9  Keine Kopplung        Kein Ladeknopf rührt das Erscheinungsbild an (kein PUT /branding).
//
// RUNDE 2 — BENs Korrekturpflichten 1 und 2, als bleibende Fälle statt als einmalige Gegenproben:
//
//   V10 Teilfehler            `failures` steht in Bilanz UND Meldung; die Meldung ist nicht grün.
//   V11 Papierkorb            `skippedInTrash` wird als solches genannt, nicht als „unverändert".
//   V12 Gesamt-Entfernen      Danach ist der Advisor-Bestand neu geholt und die Ladebilanz weg.
//   V13 Frisch laden          `force` räumt serverseitig auf — die Karte holt ebenfalls neu.
//
// Bauform wie `tests/demo-firmen-ci-web/admin-flaeche-mounted.test.tsx`: echte Karte, echtes React,
// echtes i18n, echtes React-Query; Attrappen ausschliesslich an den Endpunktgrenzen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  demoStatus: vi.fn(),
  demoSeed: vi.fn(),
  demoPurge: vi.fn(),
  paketListe: vi.fn(),
  paketLaden: vi.fn(),
}));

vi.mock("../../apps/web/src/api/client", async (echt) => ({
  ...(await echt<typeof import("../../apps/web/src/api/client")>()),
  api: { get: d.get, put: d.put },
}));
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    admin: {
      demoStatus: d.demoStatus,
      demoSeed: d.demoSeed,
      demoPurge: d.demoPurge,
      demoPackages: { list: d.paketListe, load: d.paketLaden },
    },
  },
}));
vi.mock("../../apps/web/src/api/hooks", () => ({
  useFeatures: () => ({ data: { features: { demodaten: true } } }),
  useUsers: () => ({ data: [] }),
  useAudit: () => ({ data: [] }),
}));

import type { DemoPackageInfo, DemoPackageResult } from "../../apps/web/src/api/types";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Die Kennung, die der Server wirklich führt (`services/app/src/example-packages/advisor-ict-en-v1.ts:91`). */
const ADVISOR = "advisor-ict-en-v1";

/** Der Listeneintrag des Advisor-Pakets, in der Form des Vertrags (`api/types.ts:1509`). */
const advisorPaket = (teile: Partial<DemoPackageInfo> = {}): DemoPackageInfo => ({
  id: ADVISOR,
  language: "en",
  fictional: true,
  title: { de: "Advisor ICT (EN)", en: "Advisor ICT (EN)", nl: "Advisor ICT (EN)" },
  description: {
    de: "Sechs freigegebene englische Grundlagen-Beiträge.",
    en: "Six approved English baseline entries.",
    nl: "Zes goedgekeurde Engelse basisbijdragen.",
  },
  items: 6,
  areas: ["Sales", "Commercial", "Technical"],
  loaded: 0,
  duplicates: 0,
  edited: 0,
  registered: 0,
  runs: 0,
  ...teile,
});

const ladeBilanz = (teile: Partial<DemoPackageResult> = {}): DemoPackageResult => ({
  package: ADVISOR,
  run: "run-1",
  created: 6,
  updated: 0,
  skipped: 0,
  removed: 0,
  removedAssigned: 0,
  registered: 6,
  duplicates: 0,
  skippedInTrash: 0,
  closedConflicts: 0,
  closedDuplicates: 0,
  failures: [],
  ...teile,
});

/**
 * Ein frisch geladenes Fenster. Reihenfolge ist Absicht: erst `vi.resetModules()`, dann JEDER
 * Import — sonst hätten Test und Bauteil verschiedene React- und Markenstände (`brandTheme.ts`
 * lebt im Modul und überlebt jedes Unmounten).
 */
async function frischesFenster() {
  vi.resetModules();
  const react = await import("../../apps/web/node_modules/react");
  const reactDom = await import("../../apps/web/node_modules/react-dom/client");
  const reactQuery = await import("../../apps/web/node_modules/@tanstack/react-query");
  // Die Next-Steps nach einem geglückten Seed sind `<Link>`s — ohne Router wirft React-Router beim
  // Rendern („Cannot destructure property 'basename'"). Der Speicherrouter ist die kleinste echte
  // Umgebung dafür; die Karte selbst navigiert in keinem Fall dieses Auftrags.
  const router = await import("../../apps/web/node_modules/react-router-dom");
  const toast = await import("../../apps/web/src/app/ToastContext");
  const i18nModul = await import("../../apps/web/src/i18n");
  const seite = await import("../../apps/web/src/pages/AdminDatenDetails");

  await i18nModul.default.changeLanguage("de");
  const container = document.createElement("div");
  document.body.appendChild(container);

  /**
   * ==============================================================================================
   * JOB 3636 R2 — DER MELDUNGSSPIEGEL: die Meldung wird an der MELDUNG gemessen.
   * ==============================================================================================
   *
   * Runde 1 prüfte die Erfolgsmeldung so:
   *
   *     const meldungen = f.container.ownerDocument.body.textContent ?? "";
   *     expect(meldungen).toContain("Advisor ICT (EN) · 6 angelegt");
   *
   * Das war eine Leermessung, und zwar eine, die nicht auffällt: `container` hängt selbst am
   * `body`, und derselbe Satz steht bereits in der Bilanzzeile der Karte. Der Fall wäre auch dann
   * grün geblieben, wenn gar keine Meldung gepusht worden wäre — er las die Karte zweimal.
   *
   * `ToastProvider` rendert seine Meldungen nicht selbst (das tut der Toaster der Anwendungshülle,
   * die hier bewusst nicht mitläuft). Dieser Spiegel hängt sich deshalb an denselben echten Bus
   * (`useToast()`, kein Mock) und schreibt jede Meldung mit ihrer STUFE in den DOM. Damit ist
   * beides messbar, was Runde 1 verfehlte: der Wortlaut UND ob eine Teilausführung als „success"
   * durchging.
   */
  const Meldungsspiegel = (): unknown =>
    react.createElement(
      "ul",
      { "data-testid": "meldungsspiegel" },
      toast
        .useToast()
        .toasts.map((m) => react.createElement("li", { key: m.id, "data-art": m.kind }, m.message)),
    );

  return {
    act: react.act,
    createElement: react.createElement,
    i18n: i18nModul.default,
    container,
    root: reactDom.createRoot(container),
    qc: new reactQuery.QueryClient({ defaultOptions: { queries: { retry: false } } }),
    Anbieter: reactQuery.QueryClientProvider,
    Router: router.MemoryRouter,
    Meldungen: toast.ToastProvider,
    Spiegel: Meldungsspiegel as () => JSX.Element,
    Karte: seite.DemodatenDetail,
  };
}

let f: Awaited<ReturnType<typeof frischesFenster>>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function stelleAuf(): Promise<void> {
  await f.act(async () => {
    f.root.render(
      f.createElement(
        f.Anbieter,
        { client: f.qc },
        f.createElement(
          f.Router,
          null,
          f.createElement(
            f.Meldungen,
            null,
            f.createElement(f.Karte, { onZurueck: () => undefined }),
            f.createElement(f.Spiegel, null),
          ),
        ),
      ),
    );
  });
  await f.act(async () => {
    await flush();
  });
}

const karte = (name: "allgemein" | "advisor"): HTMLElement => {
  const el = f.container.querySelector(`[data-einst="karte-${name}"]`);
  expect(el, `Karte „${name}“`).not.toBeNull();
  return el as HTMLElement;
};

const text = (name: "allgemein" | "advisor"): string =>
  (karte(name).textContent ?? "").replace(/\s+/g, " ").trim();

/** Ein Knopf der Karte, über seine sichtbare Schrift gesucht — so findet ihn auch Pedi. */
const knopf = (name: "allgemein" | "advisor", schrift: string): HTMLButtonElement => {
  const treffer = [...karte(name).querySelectorAll("button")].filter((b) =>
    (b.textContent ?? "").includes(schrift),
  );
  expect(treffer.length, `Knopf „${schrift}“ in Karte ${name}`).toBe(1);
  return treffer[0] as HTMLButtonElement;
};

/** Jede Meldung des echten Bus mit ihrer Stufe — „success" ist hier eine messbare Behauptung. */
const meldungen = (): { art: string; text: string }[] =>
  [...f.container.querySelectorAll('[data-testid="meldungsspiegel"] li')].map((li) => ({
    art: li.getAttribute("data-art") ?? "",
    text: (li.textContent ?? "").replace(/\s+/g, " ").trim(),
  }));

const klick = async (el: HTMLElement): Promise<void> => {
  await f.act(async () => {
    el.click();
  });
  await f.act(async () => {
    await flush();
  });
};

beforeEach(async () => {
  for (const spy of Object.values(d)) {
    spy.mockReset();
  }
  // Der Markenstand der Erscheinungsbild-Karte — sie gehört zur selben Detailkarte und darf in
  // keinem Fall dieses Auftrags mitreden.
  d.get.mockResolvedValue({ profil: null, aktiv: false, version: 1, marke: null });
  d.demoStatus.mockResolvedValue({ present: false, count: 0 });
  d.paketListe.mockResolvedValue({ packages: [advisorPaket()] });
  d.paketLaden.mockResolvedValue(ladeBilanz());
  d.demoSeed.mockResolvedValue({ kos: 12, users: 3, skipped: false, einmalkennwoerter: [] });
  f = await frischesFenster();
});

afterEach(async () => {
  await f.act(async () => {
    f.root.unmount();
  });
  f.container.remove();
  f.qc.clear();
});

describe("JOB 3636 · zwei Karten, zwei Wege", () => {
  it("V1 · beide Karten stehen da — je mit Beschreibung und eigenem Knopf", async () => {
    await stelleAuf();
    // Karte 1 trägt Titel und Bestand.
    //
    // JOB 3636 R2 — WAS DIE NÄCHSTE ZEILE BELEGT UND WAS NICHT (BENs Prüfpunkt 2 an Runde 1).
    // Sie hält fest, dass der HILFEKÖRPER `adm.seedHint` nicht ins Sichtfeld zurückwandert: er
    // steht im „?"-Menü dieser Karte, und derselbe Satz an zwei Orten macht
    // `tests/design/zielbild-h6-kein-erklaertext.test.ts` (Fall D-daten) rot — gemessen in
    // Runde 1, nicht vermutet. Das ist eine Zusage über den Hilfetext.
    //
    // Sie ist AUSDRÜCKLICH KEIN Beleg für Auftrag §1 („jede Karte sagt in einem Satz, was sie
    // enthält"). Karte 1 hat diesen kurzen eigenen Satz bis heute nicht; er braucht einen neuen
    // Schlüssel in `apps/web/src/i18n.ts`, und diese Datei steht in Runde 2 nicht in den
    // Zielpfaden. Der Punkt bleibt offen und steht so in der RUECKGABE (REST) — er wird hier
    // weder als erfüllt behauptet noch durch eine Abwesenheitszusage zugenagelt.
    expect(text("allgemein")).toContain("Demodaten laden");
    expect(text("allgemein")).not.toContain("Lädt einen kleinen, echten Demo-Bestand");
    expect(text("allgemein")).toContain("Demo-Bestand · keine");
    // Karte 2 nennt Paket, Beschreibung und Umfang — alles aus der Antwort des Servers.
    expect(text("advisor")).toContain("Advisor ICT (EN)");
    expect(text("advisor")).toContain("Sechs freigegebene englische Grundlagen-Beiträge.");
    expect(text("advisor")).toContain("6 Objekte · Sales, Commercial, Technical · Inhalte in EN");
    expect(text("advisor")).toContain("noch nicht geladen");
    // Zwei Knöpfe, zwei verschiedene Beschriftungen — und jeder steht in SEINER Karte.
    expect(knopf("allgemein", "Demodaten laden")).not.toBeNull();
    expect(knopf("advisor", "Laden · Advisor ICT (EN)")).not.toBeNull();
    expect(karte("allgemein").textContent).not.toContain("Advisor");
  });

  it("V2 · der erste Knopf lädt die allgemeinen Demodaten — und nur sie", async () => {
    await stelleAuf();
    await klick(knopf("allgemein", "Demodaten laden"));
    expect(d.demoSeed).toHaveBeenCalledTimes(1);
    expect(d.demoSeed).toHaveBeenCalledWith(false, "de");
    expect(d.paketLaden, "der Paketweg wurde mitgerufen").not.toHaveBeenCalled();
  });

  it("V3 · der zweite Knopf lädt das Advisor-PAKET, mit der Kennung aus der Serverliste", async () => {
    await stelleAuf();
    await klick(knopf("advisor", "Laden · Advisor ICT (EN)"));
    expect(d.paketLaden).toHaveBeenCalledTimes(1);
    expect(d.paketLaden).toHaveBeenCalledWith(ADVISOR);
    // DIE REGEL DES AUFTRAGS (§4): nicht derselbe Aufruf mit anderer Schrift.
    expect(d.demoSeed, "der Knopf rief den Seed-Weg").not.toHaveBeenCalled();
  });

  it("V4 · nach dem Laden nennt die Fläche das Paket beim Namen", async () => {
    await stelleAuf();
    await klick(knopf("advisor", "Laden · Advisor ICT (EN)"));
    const bilanz = karte("advisor").querySelector('[data-testid="advisor-bilanz"]');
    expect(bilanz, "keine Bilanz nach dem Laden").not.toBeNull();
    const gesagt = (bilanz?.textContent ?? "").replace(/\s+/g, " ").trim();
    expect(gesagt).toContain("Advisor ICT (EN)");
    expect(gesagt).toContain("6 angelegt");
    // Auch die Meldung nennt das Paket — „geladen" allein genügt nicht, wenn es zwei gibt.
    // Gemessen am Meldungsspiegel, NICHT am `body`: der enthält die Karte mit und hätte denselben
    // Satz auch ohne jede Meldung geliefert (s. Kommentar am Spiegel).
    expect(meldungen()).toEqual([
      { art: "success", text: "Advisor ICT (EN) · 6 angelegt, 0 unverändert (schon vorhanden)" },
    ]);
  });

  it("V5 · fehlt das Paket in der Liste, wird NICHTS geladen und es steht ehrlich da", async () => {
    d.paketListe.mockResolvedValue({ packages: [advisorPaket({ id: "irgendwas-anderes-v9" })] });
    await stelleAuf();
    expect(karte("advisor").querySelector('[data-testid="advisor-fehlt"]')).not.toBeNull();
    expect(text("advisor")).toContain("In dieser Installation nicht verfügbar");
    expect(karte("advisor").querySelectorAll("button").length, "ein Knopf ohne Paket").toBe(0);
    expect(d.paketLaden).not.toHaveBeenCalled();
  });

  it("V6 · beide Karten vollständig in EN", async () => {
    await stelleAuf();
    await f.act(async () => {
      await f.i18n.changeLanguage("en");
    });
    await f.act(async () => {
      await flush();
    });
    expect(text("allgemein")).toContain("Load demo data");
    expect(text("allgemein")).toContain("Demo content · none");
    expect(text("advisor")).toContain("Demo packages");
    expect(text("advisor")).toContain("Six approved English baseline entries.");
    expect(text("advisor")).toContain("6 objects · Sales, Commercial, Technical · content in EN");
    expect(text("advisor")).toContain("not loaded yet");
    expect(knopf("advisor", "Load · Advisor ICT (EN)")).not.toBeNull();
    // Und der englische Knopf lädt denselben Weg wie der deutsche.
    await klick(knopf("advisor", "Load · Advisor ICT (EN)"));
    expect(d.paketLaden).toHaveBeenCalledWith(ADVISOR);
    expect(d.demoSeed).not.toHaveBeenCalled();
  });

  it("V7 · ist die Liste nicht abrufbar, sagt nur die Advisor-Karte etwas — die andere trägt weiter", async () => {
    d.paketListe.mockRejectedValue(new Error("503"));
    await stelleAuf();
    const box = karte("advisor").querySelector('[data-einst="abfrage-fehler"]');
    expect(box, "keine Fehlerbox in der Advisor-Karte").not.toBeNull();
    expect((box?.textContent ?? "").replace(/\s+/g, " ")).toContain("nicht abrufbar");
    expect((box?.textContent ?? "").replace(/\s+/g, " ")).toContain("Erneut versuchen");
    // Die Karte behauptet dabei NICHTS über ein Paket — weder Name noch „nicht verfügbar".
    expect(text("advisor")).not.toContain("Advisor ICT (EN)");
    expect(text("advisor")).not.toContain("In dieser Installation nicht verfügbar");
    // Und die allgemeine Karte bleibt vollständig: Bestand, Beschreibung, Knopf, Wirkung.
    expect(karte("allgemein").querySelector('[data-einst="abfrage-fehler"]')).toBeNull();
    expect(text("allgemein")).toContain("Demo-Bestand · keine");
    await klick(knopf("allgemein", "Demodaten laden"));
    expect(d.demoSeed).toHaveBeenCalledTimes(1);
  });

  it("V8 · die Advisor-Karte verdoppelt die Eingriffe von JOB 3277 nicht", async () => {
    await stelleAuf();
    // Genau ein Knopf: laden. Zurücksetzen und paketbezogenes Entfernen wohnen weiter auf `/import`.
    const knoepfe = [...karte("advisor").querySelectorAll("button")].map((b) =>
      (b.textContent ?? "").trim(),
    );
    expect(knoepfe).toEqual(["Laden · Advisor ICT (EN)"]);
    // Der Gesamt-Entfernen-Weg steht unverändert da, ausserhalb beider Karten.
    const entfernen = f.container.querySelector('[data-einst="entfernen"]');
    expect(entfernen?.textContent).toContain("Demodaten entfernen");
  });

  it("V9 · kein Ladeknopf rührt das Erscheinungsbild an", async () => {
    await stelleAuf();
    await klick(knopf("advisor", "Laden · Advisor ICT (EN)"));
    await klick(knopf("allgemein", "Demodaten laden"));
    expect(d.put, "ein Ladeknopf hat die Firmen-CI geschaltet").not.toHaveBeenCalled();
  });

  // ==============================================================================================
  // JOB 3636 R2 — DIE VIER FÄLLE AUS BENS GEGENPROBEN, JETZT DAUERHAFT.
  // ==============================================================================================
  //
  // BEN hat sie an Runde 1 von Hand gefahren und alle drei rot gesehen (sein Abschnitt „EIGENE
  // MESSUNG": „Tests 3 failed | 9 skipped (12)"). Sie stehen hier, weil eine Gegenprobe, die nach
  // der Prüfung verschwindet, den Fehler nur einmal findet. V13 kommt dazu: dieselbe Klasse an der
  // Stelle, die BEN nicht gemessen hat.

  it("V10 · ein Lauf mit gescheiterten Nacharbeiten ist kein Erfolg — und sagt es", async () => {
    d.paketLaden.mockResolvedValue(
      ladeBilanz({
        created: 4,
        skipped: 0,
        failures: [
          { key: "ict-02", grund: "Anhang fehlt" },
          { key: "ict-05", grund: "Anker im Papierkorb" },
        ],
      }),
    );
    await stelleAuf();
    await klick(knopf("advisor", "Laden · Advisor ICT (EN)"));
    // Die Kartenzeile nennt Paket, Bilanz UND die Fehlschläge.
    const bilanz = karte("advisor").querySelector('[data-testid="advisor-bilanz"]');
    const gesagt = (bilanz?.textContent ?? "").replace(/\s+/g, " ").trim();
    expect(gesagt).toBe(
      "Advisor ICT (EN) · 4 angelegt, 0 unverändert (schon vorhanden) · 2 nicht ausgeführt",
    );
    // Und die Meldung ist NICHT grün. Das ist der eigentliche Befund: in Runde 1 stand hier
    // „success" mit dem Text „0 angelegt, 0 unverändert" über einem Lauf, der nichts zustande
    // gebracht hatte.
    expect(meldungen()).toEqual([
      {
        art: "info",
        text: "Advisor ICT (EN) · 4 angelegt, 0 unverändert (schon vorhanden) · 2 nicht ausgeführt",
      },
    ]);
  });

  it("V11 · was im Papierkorb liegt, wird als solches genannt — nicht als „unverändert“", async () => {
    d.paketLaden.mockResolvedValue(ladeBilanz({ created: 3, skipped: 0, skippedInTrash: 3 }));
    await stelleAuf();
    await klick(knopf("advisor", "Laden · Advisor ICT (EN)"));
    const gesagt = (
      karte("advisor").querySelector('[data-testid="advisor-bilanz"]')?.textContent ?? ""
    )
      .replace(/\s+/g, " ")
      .trim();
    expect(gesagt).toContain("3 im Papierkorb — nicht neu angelegt");
    // Ohne Fehlschläge bleibt die Stufe grün: drei Bausteine liegen im Papierkorb, das ist ein
    // Zustand des Bestands und kein Fehler des Laufs.
    expect(meldungen().map((m) => m.art)).toEqual(["success"]);
    expect(meldungen()[0]?.text).toContain("3 im Papierkorb — nicht neu angelegt");
  });

  it("V12 · nach dem Gesamt-Entfernen steht kein veralteter Advisor-Bestand mehr da", async () => {
    // Vorher: das Paket ist vollständig geladen. Nachher antwortet der Server leer — genau das,
    // was der Purge serverseitig anrichtet (`admin-routes.ts:154`: er nimmt das Paket mit).
    d.paketListe.mockResolvedValue({ packages: [advisorPaket({ loaded: 6 })] });
    d.demoPurge.mockResolvedValue({ kos: 12, conflicts: 1, duplicates: 1, gaps: 2, users: 3 });
    await stelleAuf();
    // Erst laden, damit auch die Bilanzzeile etwas behauptet, das der Purge ungültig macht.
    await klick(knopf("advisor", "Laden · Advisor ICT (EN)"));
    expect(text("advisor")).toContain("6 von 6 geladen");
    expect(karte("advisor").querySelector('[data-testid="advisor-bilanz"]')).not.toBeNull();

    d.paketListe.mockResolvedValue({ packages: [advisorPaket({ loaded: 0 })] });
    const vorher = d.paketListe.mock.calls.length;
    const entfernen = f.container.querySelector('[data-einst="entfernen"]') as HTMLElement;
    await klick(
      [...entfernen.querySelectorAll("button")].find((b) =>
        (b.textContent ?? "").includes("Demodaten entfernen"),
      ) as HTMLElement,
    );
    await klick(
      [...entfernen.querySelectorAll("button")].find((b) =>
        (b.textContent ?? "").includes("Ja, endgültig entfernen"),
      ) as HTMLElement,
    );
    expect(d.demoPurge).toHaveBeenCalledTimes(1);
    // DER BEFUND: die Liste wird wirklich neu geholt — und die Karte sagt danach den neuen Stand.
    expect(
      d.paketListe.mock.calls.length,
      "die Paketliste wurde nach dem Entfernen nicht neu geholt",
    ).toBeGreaterThan(vorher);
    expect(text("advisor")).toContain("noch nicht geladen");
    expect(text("advisor")).not.toContain("6 von 6 geladen");
    // Und die Bilanz des Ladens ist weg: „6 angelegt" wäre eine Aussage über sechs Objekte, die
    // derselbe Klick gerade gelöscht hat.
    expect(
      karte("advisor").querySelector('[data-testid="advisor-bilanz"]'),
      "die Ladebilanz überlebte das Entfernen",
    ).toBeNull();
  });

  it("V13 · auch „frisch laden“ frischt den Advisor-Bestand auf", async () => {
    // Dieselbe Klasse wie V12, an der Stelle, die BEN nicht gemessen hat: `force` räumt vorher das
    // vorhandene Demo-Set auf (`services/app/src/seed-demo.ts:213-215` ruft `purgeDemoSeed`), und
    // das nimmt die Paketbausteine mit — sie tragen denselben `demoSeed`-Merker.
    d.paketListe.mockResolvedValue({ packages: [advisorPaket({ loaded: 6 })] });
    d.demoSeed.mockResolvedValue({ kos: 0, users: 0, skipped: true, einmalkennwoerter: [] });
    await stelleAuf();
    await klick(knopf("allgemein", "Demodaten laden"));
    expect(text("advisor")).toContain("6 von 6 geladen");

    d.paketListe.mockResolvedValue({ packages: [advisorPaket({ loaded: 0 })] });
    d.demoSeed.mockResolvedValue({ kos: 12, users: 3, skipped: false, einmalkennwoerter: [] });
    const vorher = d.paketListe.mock.calls.length;
    await klick(knopf("allgemein", "Demo-Bestand neu laden"));
    expect(d.demoSeed).toHaveBeenLastCalledWith(true, "de");
    expect(
      d.paketListe.mock.calls.length,
      "die Paketliste wurde nach dem frischen Laden nicht neu geholt",
    ).toBeGreaterThan(vorher);
    expect(text("advisor")).toContain("noch nicht geladen");
  });
});
