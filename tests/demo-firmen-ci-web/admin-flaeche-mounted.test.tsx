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
//   A8  404                    Kennt der Server den Weg gar nicht, ist „kein Firmenprofil" die
//                              wahre Auskunft — und ausdrücklich kein Fehler.
//
// JOB 3563 · DIE KARTE AN DER EINEN QUELLE — BENs zweimal benannte Prüflücke, jetzt gemessen:
//
//   A9   Hintergrundänderung   Schaltet jemand ANDERSWO um, zieht der Schalter mit — ohne
//                              Neuladen, ohne Fokuswechsel, ohne Klick.
//   A10  Der nächste PUT       …und der nächste Klick dreht die fremde Profilwahl NICHT zurück.
//   A11  Überholte Antwort     Ein ÄLTERER Stand dreht die Anzeige nicht zurück (Monotonie-Riegel
//                              `brandTheme.ts`, durch die Fläche hindurch gemessen).
//   A12  Sofort-Effekt         Nach dem eigenen PUT steht die neue Stellung da — ohne zweiten GET.
//
// JOB 3563 RUNDE 2 · BENs ZWEI KORREKTURPFLICHTEN AN RUNDE 1, jede mit ihrem eigenen Fall:
//
//   A13  Kein zweiter Abruf    Kennt das Modul den Stand schon, löst das Öffnen der Karte KEINEN
//                              weiteren `GET /api/branding` aus (Korrekturpflicht 1, wörtlich:
//                              „Ein bereits erfolgreich geladener Modulstand verursacht beim
//                              Öffnen keinen zusätzlichen GET").
//   A14  Fehlererholung        Nach einem gescheiterten Erstabruf stellt eine erfolgreiche
//                              HINTERGRUNDÜBERNAHME die Bedienelemente wieder her — ohne Klick —,
//                              und der nächste PUT rechnet mit diesem Stand (Korrekturpflicht 2;
//                              BENs Gegenprobe an Runde 1: Wurzelattribut `advisor` gesetzt, Karte
//                              weiterhin „nicht abrufbar · Erneut versuchen").
//   A15  Bestätigt bleibt      Ein bestätigter Stand bleibt sichtbar und bedienbar, wenn eine
//                              spätere Auffrischung scheitert (LEHREN §7, Auftrag §9).
//   A16  Wiederholung          Ohne bestätigten Stand bleibt der Weg „Erneut versuchen" erhalten
//                              und ruft wirklich neu ab.
//
// JOB 3563 RUNDE 3 · BENs KORREKTURPFLICHT AN RUNDE 2 — DER GEMEINSAME START:
//
//   A17  Start überlappt       Der Modulstart hat seinen Abruf noch UNTERWEGS, und die Karte wird
//                              geöffnet: über beide Aufrufstellen zusammen entsteht GENAU EIN
//                              `GET /api/branding`. BENs Gegenprobe an Runde 2, wörtlich: „Karte
//                              startet neben laufendem Modulabruf einen zweiten GET: expected
//                              ‚spy' to be called 1 times, but got 2 times."
//   A18  …und wenn er scheitert  Der geteilte Erstabruf darf kein Sackgassen-Versprechen sein:
//                              scheitert er, zeigt die Karte den Ausweg, und „Erneut versuchen"
//                              ruft wirklich neu ab (sonst hinge sie an der abgelehnten Antwort).
//
// ------------------------------------------------------------------------------------------------
// WARUM JEDER FALL EIN FRISCHES MODULREGISTER BEKOMMT (BENs Prüflücke 6 an Runde 1)
// ------------------------------------------------------------------------------------------------
// Der Markenstand lebt im MODUL (`lib/brandTheme.ts`) und überlebt jedes Unmounten — genau das ist
// seit JOB 3563 der Punkt der Karte. Bis Runde 1 stellte das `beforeEach` den Urstand mit
// `uebernimmBranding({ …, version: -1000 })` her. Das war ein KÜNSTLICHER Stand: das Modul kannte
// danach einen, ein frisch geladenes Browserfenster kennt aber KEINEN (`aktuellesBranding() ===
// null`). BEN wörtlich: „Außerdem echten Modulstart mit `null` prüfen: Das bisherige `beforeEach`
// setzt stattdessen einen künstlichen Stand mit Version −1000."
//
// Seit die Karte genau an dieser Unterscheidung hängt (`enabled: gemeldet === null`), wäre der
// künstliche Boden nicht mehr nur ungenau, sondern würde den halben Vertrag unmessbar machen: mit
// ihm gäbe es nie einen Erstabruf, nie einen Ladezustand, nie eine Fehlerbox. `vi.resetModules()`
// vor jedem Fall stellt deshalb das her, was der Browser herstellt — ein leeres Modul. Alles, was
// die Karte braucht (React, React-Query, i18n, das Modul, die Seite), wird DANACH geholt, damit
// Test und Bauteil dieselben Instanzen benutzen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  demoStatus: vi.fn(),
  demoSeed: vi.fn(),
  demoPurge: vi.fn(),
  // JOB 3636: dieselbe Karte trägt seither eine zweite Ladefläche („Advisor-Demodaten"), die ihre
  // Paketliste selbst holt. Die Attrappe muss den Weg kennen — sonst fiele diese Karte beim Mounten
  // aus, und die Fälle unten würden an einem Fehler messen, der mit dem Erscheinungsbild nichts zu
  // tun hat.
  demoPackages: vi.fn(),
}));

// `ApiError` bleibt die ECHTE Klasse: die 404-Unterscheidung in `ladeBranding` hängt an
// `instanceof`, und eine nachgebaute Klasse führte genau daran vorbei.
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
      demoPackages: { list: d.demoPackages, load: vi.fn() },
    },
  },
}));
vi.mock("../../apps/web/src/api/hooks", () => ({
  useFeatures: () => ({ data: { features: { demodaten: true } } }),
  useUsers: () => ({ data: [] }),
  useAudit: () => ({ data: [] }),
}));

import type { BrandingStand } from "../../apps/web/src/lib/brandTheme";

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

/**
 * Ein frisch geladenes Fenster: leeres Modulregister, leerer Markenstand, neue Wurzel.
 *
 * Die Reihenfolge ist Absicht — erst `vi.resetModules()`, dann JEDER Import. Ein Bauteil, das noch
 * aus dem alten Register käme, hätte ein anderes React und einen anderen Markenstand als der Test.
 */
async function frischesFenster() {
  vi.resetModules();
  const react = await import("../../apps/web/node_modules/react");
  const reactDom = await import("../../apps/web/node_modules/react-dom/client");
  const reactQuery = await import("../../apps/web/node_modules/@tanstack/react-query");
  const client = await import("../../apps/web/src/api/client");
  const toast = await import("../../apps/web/src/app/ToastContext");
  const i18nModul = await import("../../apps/web/src/i18n");
  const brand = await import("../../apps/web/src/lib/brandTheme");
  const seite = await import("../../apps/web/src/pages/AdminDatenDetails");

  await i18nModul.default.changeLanguage("de");
  const container = document.createElement("div");
  document.body.appendChild(container);
  return {
    act: react.act,
    createElement: react.createElement,
    i18n: i18nModul.default,
    ApiError: client.ApiError,
    brand,
    container,
    root: reactDom.createRoot(container),
    qc: new reactQuery.QueryClient({ defaultOptions: { queries: { retry: false } } }),
    Anbieter: reactQuery.QueryClientProvider,
    Meldungen: toast.ToastProvider,
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
          f.Meldungen,
          null,
          f.createElement(f.Karte, { onZurueck: () => undefined }),
        ),
      ),
    );
  });
  await f.act(async () => {
    await flush();
  });
}

const abschnitt = (): HTMLElement => {
  const el = f.container.querySelector('[data-einst="erscheinungsbild"]');
  expect(el, "Abschnitt „Demo-Erscheinungsbild“").not.toBeNull();
  return el as HTMLElement;
};

const feld = <T extends HTMLElement>(testId: string): T => {
  const el = abschnitt().querySelector(`[data-testid="${testId}"]`);
  expect(el, testId).not.toBeNull();
  return el as T;
};

/** Die Fehlerbox der Hülle — `null`, wenn keine da ist. */
const fehlerbox = (): HTMLElement | null =>
  abschnitt().querySelector('[data-einst="abfrage-fehler"]');

beforeEach(async () => {
  d.get.mockReset();
  d.put.mockReset();
  d.demoStatus.mockReset();
  d.demoSeed.mockReset();
  d.demoPurge.mockReset();
  d.demoPackages.mockReset();
  d.demoPackages.mockResolvedValue({ packages: [] });
  d.demoStatus.mockResolvedValue({ present: false, count: 0 });
  d.get.mockResolvedValue(stand());
  f = await frischesFenster();
  document.documentElement.removeAttribute(f.brand.BRAND_ATTRIBUT);
});

afterEach(async () => {
  await f.act(async () => {
    f.root.unmount();
  });
  f.container.remove();
  f.qc.clear();
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
    // Der Stand kommt vom Server, aus GENAU der Adresse des Vertrags — und weil das Modul beim
    // echten Start noch nichts weiß, holt die Karte ihn hier selbst, GENAU EINMAL.
    expect(d.get).toHaveBeenCalledWith("/branding");
    expect(d.get).toHaveBeenCalledTimes(1);
  });

  it("A2 · Einschalten: genau ein PUT mit dem Vertragskörper, Marke sofort an der Wurzel", async () => {
    await stelleAuf();
    serverNimmtAn(stand({ aktiv: true, version: 2 }));
    const schalter = feld<HTMLInputElement>("marke-schalter");
    await f.act(async () => {
      schalter.click();
      await flush();
    });
    expect(d.put).toHaveBeenCalledTimes(1);
    expect(d.put.mock.calls[0]?.[0]).toBe("/admin/branding");
    expect(d.put.mock.calls[0]?.[1]).toEqual({ profil: "advisor", aktiv: true });
    expect(document.documentElement.getAttribute(f.brand.BRAND_ATTRIBUT)).toBe("advisor");
  });

  it("A3 · Ausschalten: derselbe Weg zurück, und das Attribut ist restlos weg", async () => {
    d.get.mockResolvedValue(stand({ aktiv: true }));
    await stelleAuf();
    serverNimmtAn(stand({ aktiv: false, version: 3 }));
    await f.act(async () => {
      feld<HTMLInputElement>("marke-schalter").click();
      await flush();
    });
    expect(d.put.mock.calls[0]?.[1]).toEqual({ profil: "advisor", aktiv: false });
    expect(document.documentElement.hasAttribute(f.brand.BRAND_ATTRIBUT)).toBe(false);
  });

  it("A4 · Profil zurücknehmen: der Schalter fällt mit — nie „aktiv ohne Profil“", async () => {
    d.get.mockResolvedValue(stand({ aktiv: true }));
    await stelleAuf();
    serverNimmtAn(stand({ profil: null, aktiv: false, version: 4, marke: null }));
    const auswahl = feld<HTMLSelectElement>("marke-profil");
    await f.act(async () => {
      auswahl.value = "";
      auswahl.dispatchEvent(new Event("change", { bubbles: true }));
      await flush();
    });
    expect(d.put.mock.calls[0]?.[1]).toEqual({ profil: null, aktiv: false });
    expect(document.documentElement.hasAttribute(f.brand.BRAND_ATTRIBUT)).toBe(false);
    // Ohne Profil ist der Schalter nicht bedienbar und sagt auch, warum.
    expect(feld<HTMLInputElement>("marke-schalter").disabled).toBe(true);
    expect(abschnitt().textContent).toContain("Ohne Firmenprofil gibt es nichts zu verwenden.");
  });

  // ==============================================================================================
  // JOB 3563 · A9–A16 — BENs PRÜFLÜCKE 6, GESCHLOSSEN UND GEMESSEN.
  // ==============================================================================================
  // HERKUNFT, damit die Kopplung nicht wieder verlorengeht:
  //   · `archiv/3511/runde-1/ben.md:30` — „fehlt ein gemeinsamer Test von Admin-Schalter und
  //     Hintergrundaktualisierung: `AdminDatenDetails.tsx:55` hält einen eigenen Query-Zustand.
  //     Testvorschlag: externe Änderung übernehmen und anschließend Schalterstellung sowie
  //     nächsten PUT prüfen."
  //   · `archiv/3511/runde-2/ben.md:31` — „Für `AdminDatenDetails.tsx:55` weiterhin erforderlich:
  //     externe Änderung nachführen, Schalterstellung und nächsten PUT gemeinsam prüfen."
  //   · In JOB 3511 R2 stand der Fall schon einmal hier (als A9) und WURDE WIEDER ENTFERNT, weil
  //     die Reparatur damals nicht ohne Regression zu haben war (`archiv/3511/runde-2/
  //     RUECKGABE.md:51`). Er ist jetzt zurück, weil die Reparatur da ist.
  //   · JOB 3563 R1 `ben.md`, Korrekturpflichten 1 und 2 — die beiden Löcher, die A9/A10 offen
  //     ließen: der zusätzliche Abruf (A13) und die Fehlerbox über einem bestätigten Stand (A14).
  //
  // DER WEG DER EXTERNEN ÄNDERUNG IST DER ECHTE: `uebernimmBranding` ist genau die Stelle, in der
  // die gedrosselte Nachführung `frischeMarke` endet (`brandTheme.ts`). Es wird also nicht ein
  // Testhaken bewegt, sondern derselbe Griff, den der Takt bedient.

  it("A9 · der Schalter folgt einer Hintergrundänderung — ohne Neuladen, ohne Klick", async () => {
    d.get.mockResolvedValue(stand({ profil: null, aktiv: false, version: 1, marke: null }));
    await stelleAuf();
    // Ausgangslage: kein Profil, Schalter aus und nicht bedienbar.
    expect(feld<HTMLSelectElement>("marke-profil").value).toBe("");
    expect(feld<HTMLInputElement>("marke-schalter").checked).toBe(false);
    expect(feld<HTMLInputElement>("marke-schalter").disabled).toBe(true);

    // Jemand anders schaltet um — zweiter Administrator, zweiter Tab, zweites Fenster.
    await f.act(async () => {
      f.brand.uebernimmBranding(stand({ aktiv: true, version: 2 }));
      await flush();
    });

    expect(feld<HTMLSelectElement>("marke-profil").value).toBe("advisor");
    expect(feld<HTMLInputElement>("marke-schalter").checked).toBe(true);
    expect(feld<HTMLInputElement>("marke-schalter").disabled).toBe(false);
  });

  it("A10 · der nächste PUT dreht die fremde Profilwahl nicht zurück", async () => {
    d.get.mockResolvedValue(stand({ profil: null, aktiv: false, version: 1, marke: null }));
    await stelleAuf();
    await f.act(async () => {
      f.brand.uebernimmBranding(stand({ aktiv: true, version: 2 }));
      await flush();
    });

    // Der schärfere der beiden Fälle: er misst die FOLGE, nicht die Anzeige. Ein Klick auf das
    // Kästchen schaltet ab — und muss das fremde Profil dabei mitschicken.
    serverNimmtAn(stand({ aktiv: false, version: 3 }));
    await f.act(async () => {
      feld<HTMLInputElement>("marke-schalter").click();
      await flush();
    });
    expect(d.put).toHaveBeenCalledTimes(1);
    expect(d.put.mock.calls[0]?.[1]).toEqual({ profil: "advisor", aktiv: false });
  });

  it("A11 · eine ÜBERHOLTE Antwort dreht die Anzeige nicht zurück", async () => {
    // Prüflücke aus dem Auftrag §8.6 (b): Die Fläche darf den Monotonie-Riegel des Moduls nicht
    // umgehen — sonst hätte die Reparatur genau den Fehler wieder eingebaut, den JOB 3511 R2
    // (Korrekturpflicht 2) beseitigt hat.
    d.get.mockResolvedValue(stand({ aktiv: true, version: 5 }));
    await stelleAuf();
    expect(feld<HTMLInputElement>("marke-schalter").checked).toBe(true);

    // Ein verspäteter Abruf löst mit einer ÄLTEREN Version auf. Gefahren wird er über GENAU den
    // Griff, den auch die Karte benutzt (`holeMarkeFuerFlaeche`) — nicht über `uebernimmBranding`,
    // denn das ist die Stelle NACH dem Riegel und würde ihn gerade nicht messen.
    d.get.mockResolvedValue(stand({ profil: null, aktiv: false, version: 3, marke: null }));
    await f.act(async () => {
      await f.brand.holeMarkeFuerFlaeche();
      await flush();
    });
    expect(feld<HTMLSelectElement>("marke-profil").value).toBe("advisor");
    expect(feld<HTMLInputElement>("marke-schalter").checked).toBe(true);
  });

  it("A12 · nach dem eigenen PUT steht die neue Stellung da — ohne zweiten Abruf", async () => {
    // Prüflücke aus dem Auftrag §8.6 (a): Der Sofort-Effekt des eigenen Schaltens darf durch die
    // Umstellung nicht verlorengehen — und er darf nicht durch einen NACHGESCHOBENEN Abruf
    // erkauft sein (das wäre der zweite Takt, den `brandTheme.ts` ausschließt).
    await stelleAuf();
    const abrufeVorher = d.get.mock.calls.length;
    serverNimmtAn(stand({ aktiv: true, version: 2 }));
    await f.act(async () => {
      feld<HTMLInputElement>("marke-schalter").click();
      await flush();
    });
    expect(feld<HTMLInputElement>("marke-schalter").checked).toBe(true);
    expect(document.documentElement.getAttribute(f.brand.BRAND_ATTRIBUT)).toBe("advisor");
    expect(d.get.mock.calls.length, "ein zusätzlicher Abruf nach dem eigenen PUT").toBe(
      abrufeVorher,
    );
  });

  it("A13 · kennt das Modul den Stand, holt das Öffnen der Karte NICHTS mehr", async () => {
    // BENs Korrekturpflicht 1 an Runde 1, wörtlich: „Ein bereits erfolgreich geladener Modulstand
    // verursacht beim Öffnen keinen zusätzlichen GET." Runde 1 tat genau das — der `useQuery` lief
    // unbedingt und legte einen zweiten Abrufweg neben die gedrosselte Nachführung des Moduls.
    //
    // Der Stand wird auf dem ECHTEN Weg hergestellt, nicht gesetzt: `holeMarkeFuerFlaeche` ist der
    // Griff, durch den auch die Anwendung ihre erste Antwort ins Modul legt.
    d.get.mockResolvedValue(stand({ aktiv: true, version: 7 }));
    await f.brand.holeMarkeFuerFlaeche();
    expect(d.get, "der Aufbau selbst braucht genau einen Abruf").toHaveBeenCalledTimes(1);

    await stelleAuf();

    expect(d.get, "das Öffnen der Karte hat zusätzlich abgerufen").toHaveBeenCalledTimes(1);
    // Und der bekannte Stand steht nicht nur da, er ist auch bedienbar.
    expect(feld<HTMLSelectElement>("marke-profil").value).toBe("advisor");
    expect(feld<HTMLInputElement>("marke-schalter").checked).toBe(true);
    expect(feld<HTMLInputElement>("marke-schalter").disabled).toBe(false);
    expect(fehlerbox()).toBeNull();
  });

  it("A14 · nach einem Abruffehler stellt die Hintergrundübernahme die Bedienung wieder her", async () => {
    // BENs Korrekturpflicht 2 an Runde 1 mit seiner eigenen Gegenprobe: „externe Version 2
    // übernommen, Wurzelattribut `advisor`, Karte weiterhin ‚nicht abrufbar · Erneut versuchen'."
    // Die Fehlerbox der unabhängigen Abfrage stand über einem bestätigten Modulstand.
    d.get.mockRejectedValue(new Error("kaputt"));
    await stelleAuf();
    expect(fehlerbox(), "ohne bekannten Stand gehört die Fehlerbox dorthin").not.toBeNull();
    expect(abschnitt().querySelector('[data-testid="marke-schalter"]')).toBeNull();
    const abrufeNachFehler = d.get.mock.calls.length;

    // Der Hintergrundtakt hat Erfolg, wo der Kartenabruf scheiterte — kein Klick, kein Neuladen.
    await f.act(async () => {
      f.brand.uebernimmBranding(stand({ aktiv: true, version: 2 }));
      await flush();
    });

    expect(fehlerbox(), "Fehlerbox über einem bestätigten Stand").toBeNull();
    expect(feld<HTMLSelectElement>("marke-profil").value).toBe("advisor");
    expect(feld<HTMLInputElement>("marke-schalter").checked).toBe(true);
    expect(feld<HTMLInputElement>("marke-schalter").disabled).toBe(false);
    expect(d.get.mock.calls.length, "die Erholung hat einen Abruf nachgeschoben").toBe(
      abrufeNachFehler,
    );

    // Und die FOLGE stimmt auch: der nächste PUT rechnet mit dem übernommenen Stand.
    serverNimmtAn(stand({ aktiv: false, version: 3 }));
    await f.act(async () => {
      feld<HTMLInputElement>("marke-schalter").click();
      await flush();
    });
    expect(d.put).toHaveBeenCalledTimes(1);
    expect(d.put.mock.calls[0]?.[1]).toEqual({ profil: "advisor", aktiv: false });
  });

  it("A15 · ein bestätigter Stand bleibt stehen, wenn eine spätere Auffrischung scheitert", async () => {
    // Auftrag §9 („Cache mit gescheiterter Auffrischung") und LEHREN §7: es wird nichts geleert,
    // nichts zurückgesetzt und nichts gemeldet — der zuletzt bestätigte Stand bleibt bedienbar.
    d.get.mockResolvedValue(stand({ aktiv: true, version: 5 }));
    await stelleAuf();
    expect(feld<HTMLInputElement>("marke-schalter").checked).toBe(true);

    d.get.mockRejectedValue(new Error("Netz weg"));
    await f.act(async () => {
      await expect(f.brand.holeMarkeFuerFlaeche()).rejects.toThrow("Netz weg");
      await flush();
    });

    expect(fehlerbox(), "Fehlerbox über einem bestätigten Stand").toBeNull();
    expect(feld<HTMLSelectElement>("marke-profil").value).toBe("advisor");
    expect(feld<HTMLInputElement>("marke-schalter").checked).toBe(true);
    expect(feld<HTMLInputElement>("marke-schalter").disabled).toBe(false);
  });

  it("A16 · ohne bestätigten Stand bleibt „Erneut versuchen“ — und ruft wirklich neu ab", async () => {
    d.get.mockRejectedValue(new Error("kaputt"));
    await stelleAuf();
    const box = fehlerbox();
    expect(box, "Fehlerbox mit Ausweg").not.toBeNull();
    const erneut = (box as HTMLElement).querySelector("button");
    expect(erneut, "„Erneut versuchen“ in der Fehlerbox").not.toBeNull();
    const abrufeVorher = d.get.mock.calls.length;

    d.get.mockResolvedValue(stand({ aktiv: true, version: 4 }));
    await f.act(async () => {
      (erneut as HTMLButtonElement).click();
      await flush();
    });

    expect(d.get.mock.calls.length, "„Erneut versuchen“ hat nicht neu abgerufen").toBe(
      abrufeVorher + 1,
    );
    expect(fehlerbox()).toBeNull();
    expect(feld<HTMLInputElement>("marke-schalter").checked).toBe(true);
  });

  // ==============================================================================================
  // JOB 3563 RUNDE 3 · A17/A18 — BENs KORREKTURPFLICHT AN RUNDE 2, DER GEMEINSAME START.
  // ==============================================================================================
  // A13 misst den Fall NACH dem Erstabruf: das Modul kennt den Stand, die Karte holt nichts mehr.
  // Der Übergang davor blieb ungemessen — und genau dort war noch ein zweiter Abruf. BEN, JOB 3563
  // R2, wörtlich: „`enabled: gemeldet === null` unterscheidet nicht zwischen ‚noch kein Abruf' und
  // ‚Abruf läuft bereits'." Sein Vorschlag ist der Aufbau dieser beiden Fälle: „Modul starten,
  // Antwort offenhalten, Karte mounten. Über beide Aufrufstellen zusammen darf genau ein GET
  // entstehen."
  //
  // GESTARTET WIRD DER ECHTE WEG: `initBrandTheme()` ist die eine Zeile, die `main.tsx` beim Start
  // der Anwendung ausführt — nicht ein Testhaken, der `frischeMarke` direkt anstößt.

  it("A17 · Modulstart unterwegs, Karte geöffnet: über beide Wege zusammen GENAU EIN Abruf", async () => {
    let loesen: (s: BrandingStand) => void = () => undefined;
    d.get.mockImplementation(
      () =>
        new Promise<BrandingStand>((aufloesen) => {
          loesen = aufloesen;
        }),
    );

    // Der Anwendungsstart holt die Marke einmal — und diese Antwort bleibt jetzt aus.
    f.brand.initBrandTheme();
    expect(d.get, "der Modulstart holt genau einmal").toHaveBeenCalledTimes(1);

    // Und WÄHRENDDESSEN öffnet Pedi die Karte.
    await stelleAuf();
    expect(
      d.get,
      "die Karte legte einen zweiten GET neben den laufenden Modulabruf",
    ).toHaveBeenCalledTimes(1);
    // Solange kein Stand bestätigt ist, behauptet die Karte nichts — kein „aus", kein Fehler.
    expect(abschnitt().querySelector('[data-testid="marke-schalter"]')).toBeNull();
    expect(fehlerbox(), "ein laufender Abruf ist kein Fehler").toBeNull();

    // Die eine Antwort trifft ein: sie bedient Modul UND Karte.
    await f.act(async () => {
      loesen(stand({ aktiv: true, version: 9 }));
      await flush();
    });

    expect(d.get, "nach der Antwort wurde nachgeschoben").toHaveBeenCalledTimes(1);
    expect(feld<HTMLSelectElement>("marke-profil").value).toBe("advisor");
    expect(feld<HTMLInputElement>("marke-schalter").checked).toBe(true);
    expect(feld<HTMLInputElement>("marke-schalter").disabled).toBe(false);
    expect(fehlerbox()).toBeNull();
    expect(document.documentElement.getAttribute(f.brand.BRAND_ATTRIBUT)).toBe("advisor");
  });

  it("A18 · scheitert der geteilte Erstabruf, bleibt „Erneut versuchen“ ein echter Weg", async () => {
    // Ein geteilter Abruf darf keine Sackgasse werden: hängt die Karte danach am abgelehnten
    // Versprechen, drückt der Mensch „Erneut versuchen" und es geschieht nichts.
    let ablehnen: (grund: unknown) => void = () => undefined;
    d.get.mockImplementationOnce(
      () =>
        new Promise<BrandingStand>((_, zurueckweisen) => {
          ablehnen = zurueckweisen;
        }),
    );

    f.brand.initBrandTheme();
    await stelleAuf();
    expect(d.get, "die Karte legte einen zweiten GET daneben").toHaveBeenCalledTimes(1);

    await f.act(async () => {
      ablehnen(new Error("Netz weg"));
      await flush();
    });

    const box = fehlerbox();
    expect(box, "ohne bekannten Stand gehört die Fehlerbox dorthin").not.toBeNull();
    const erneut = (box as HTMLElement).querySelector("button");
    expect(erneut, "„Erneut versuchen“ in der Fehlerbox").not.toBeNull();

    d.get.mockResolvedValue(stand({ aktiv: true, version: 4 }));
    await f.act(async () => {
      (erneut as HTMLButtonElement).click();
      await flush();
    });

    expect(d.get, "„Erneut versuchen“ hat nicht neu abgerufen").toHaveBeenCalledTimes(2);
    expect(fehlerbox()).toBeNull();
    expect(feld<HTMLInputElement>("marke-schalter").checked).toBe(true);
  });

  it("A5 · das Umschalten rührt keinen einzigen Demodatenweg an", async () => {
    await stelleAuf();
    serverNimmtAn(stand({ aktiv: true, version: 2 }));
    await f.act(async () => {
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
    expect(fehlerbox()).not.toBeNull();
  });

  it("A8 · kennt der Server den Weg gar nicht (404), steht dort „kein Firmenprofil“ statt eines Fehlers", async () => {
    // DER FALL, DEN DER TORLAUF GEFUNDEN HAT: der Serverweg entsteht in JOB 3510. Auf jedem Stand
    // davor antwortet `/api/branding` mit 404 — und ohne diese Unterscheidung stünde in der Karte
    // „Demodaten" DAUERHAFT eine Fehlerbox (tests/design/h6-detail-zustandsweg.test.ts, Fall K).
    d.get.mockRejectedValue(new f.ApiError(404, "NOT_FOUND", "Not Found"));
    await stelleAuf();
    expect(fehlerbox(), "Fehlerbox, obwohl der Server nur sagt „gibt es hier nicht“").toBeNull();
    expect(feld<HTMLSelectElement>("marke-profil").value).toBe("");
    expect(feld<HTMLInputElement>("marke-schalter").checked).toBe(false);
    expect(feld<HTMLInputElement>("marke-schalter").disabled).toBe(true);
    expect(abschnitt().textContent).toContain("Ohne Firmenprofil gibt es nichts zu verwenden.");
  });

  it("A7 · DE und EN: beide Fassungen sind im Bestand und erscheinen auf der Fläche", async () => {
    await stelleAuf();
    expect(abschnitt().textContent).toContain("Firmen-CI verwenden");
    await f.act(async () => {
      await f.i18n.changeLanguage("en");
      await flush();
    });
    const text = abschnitt().textContent ?? "";
    expect(text).toContain("Demo appearance");
    expect(text).toContain("Use company CI");
    expect(text).toContain("Company profile");
    // Kein Schlüssel-Durchschlag: i18next gibt bei fehlender Übersetzung den Schlüssel aus.
    expect(text).not.toContain("einst.marke.");
  });
});
