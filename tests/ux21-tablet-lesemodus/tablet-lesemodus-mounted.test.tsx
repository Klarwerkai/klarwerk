// @vitest-environment jsdom
// ================================================================================================
// JOB 3335 · UX-21 — DER TABLET-LESEMODUS DER BIBLIOTHEK: DIE TREFFERLISTE KLAPPT DER MENSCH.
// ================================================================================================
//
// DER BEFUND (N-0044, Pedis Nutzungsprüfung vom 06.09. auf dem iPad hochkant, 768 × 1024): der
// Bericht stand neben der 380 px breiten Liste und hatte 356 px für seinen Text — „unnötig enger
// Leseraum". Seit JOB 3121 (UX-14) gibt es zwei Bänder: schmal (< 760 px, EINE Fläche trägt die
// Breite, `SCHMAL_ABFRAGE`) und breit (Liste UND Bericht nebeneinander). Ein 768er-Tablet fällt in
// „breit" — die Anordnung des Desktops auf einer Fläche, die dafür zu schmal ist. Wer die Liste
// dort loswerden wollte, konnte es nicht: nichts klappt sie ein; und schmal klappt sie nicht der
// Mensch, sondern die Breite (der Rückweg SCHLIESST den Bericht, er blendet die Liste nicht dazu).
//
// WAS DIESER AUFTRAG BAUT: ein drittes Band, das Lese-Tablet (`TABLET_LESE_QUERY`,
// `shell/useMediaQuery.ts`). Dort trägt der Bericht die Fläche in einem Leseraum, und die Liste
// kommt auf Wunsch DAZU — über einen beschrifteten Schalter in der haftenden Leiste neben dem
// Rückweg — ohne dass der Bericht schliesst. Die Wahl merkt sich die Fläche über den vorhandenen
// `usePersistentEnum` (derselbe Weg wie die Sortierung).
//
// GEMESSEN WIRD AN DER GEMOUNTETEN FLÄCHE, NICHT AM QUELLTEXT: welche Fläche im DOM steht, was
// der Schalter behauptet (`aria-expanded`), wo der Fokus sitzt, was in der Adresse steht. Die
// Breite kommt aus `matchMedia`, gelesen an der EINEN Stelle des Hauses
// (`shell/useMediaQuery.ts:11`); die Attrappe hier WERTET die Abfragen des Produkts gegen eine
// Zahl aus (`min-width`/`max-width` in px), statt eine bestimmte Abfrage zu erraten. So prüft
// derselbe Aufbau die Bandgrenzen (759 → 760, 899 → 900) und nicht nur „schmal ja/nein".
//
// GENAU EIN BÜHNENAUFBAU für alle Fälle (Codex-Lehre zu JOB 3258): eine Datei, ein `createRoot`,
// eine Mockdeklaration. Die Chromium-Messung daneben (`tablet-chromium.test.ts`) misst Breiten —
// das kann jsdom nicht; hier steht, WAS gebaut wird, dort, WIE BREIT es ist.
//
//   R1  768 · Bericht offen        → ein Schalter, der die Liste einblendet, während der Bericht
//                                    offen bleibt (heute gibt es nur `bib-zurueck`, und der schliesst)
//   R2  768 · Schalter gedrückt    → Liste im Baum UND Bericht im Baum; Adresse unverändert
//   R3  768 · eingeklappt          → die Liste ist NICHT im Baum (nicht nur unsichtbar)
//   R4  768 · Suche + Facette      → überleben Ein- und Ausklappen, kein neuer Abruf
//   R5  390 · unverändert (3121)   → kein Schalter, Bericht ersetzt Liste, Rückweg da
//   R6  1280 · unverändert         → kein Schalter, Liste und Bericht nebeneinander
//   R7  `aria-expanded` folgt dem Zustand; Beschriftung DE und EN übersetzt
//   R8  Fokus: ausklappen → gelesene Zeile; einklappen → der Schalter
//   R9  Auffrischungssatz: genau einmal, in beiden Klappzuständen
//   R10 Bandgrenzen: 759 Telefon · 760/768/899 Tablet · 900 Desktop — keine Lücke
//   R11 die Vorliebe überlebt ein Neumontieren (usePersistentEnum)
//   R12 768 ohne Wahl: die Liste trägt die Fläche allein, keine Vorwahl, kein Schalter
//   R13 Breitenwechsel ohne Neuladen 1280 → 768 → 1280, ohne zweiten Abruf
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";

function ko(overrides: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "ko",
    title: "Titel",
    statement: "Aussage",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "validiert",
    version: 1,
    originalAuthor: "u9",
    author: "u9",
    neededValidations: 2,
    assignments: [],
    asset: null,
    confidentiality: "intern",
    createdAt: "2026-07-20T00:00:00.000Z",
    history: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

const KOS = [
  ko({ id: "k1", title: "Ventil X bei Überdruck schließen", category: "Anlage 1" }),
  ko({ id: "k2", title: "Rührwerk Y vor der Reinigung entlüften", category: "Anlage 1" }),
  ko({ id: "k3", title: "Pumpe Z nach dem Spülen entlüften", category: "Anlage 2" }),
];

/** Der Zeitpunkt des zuletzt ERFOLGREICHEN Abrufs — die Zahl im Auffrischungssatz stammt aus ihm. */
const ZULETZT_ERFOLGREICH = Date.parse("2026-09-06T09:30:00.000Z");

const stand = vi.hoisted(() => ({ auffrischungScheitert: false, rufe: 0 }));

vi.mock("../../apps/web/src/api/hooks", () => {
  const ruf = () => {
    stand.rufe += 1;
    return Promise.resolve({});
  };
  const ok = <T,>(data: T) => ({
    data,
    isLoading: false,
    isError: false,
    isRefetchError: false,
    isFetching: false,
    isStale: false,
    fetchStatus: "idle",
    dataUpdatedAt: ZULETZT_ERFOLGREICH,
    error: null,
    refetch: ruf,
  });
  const alt = <T,>(data: T) => ({
    ...ok(data),
    isError: true,
    isRefetchError: true,
    error: new Error("Netz weg"),
  });
  return {
    useKos: () => (stand.auffrischungScheitert ? alt(KOS) : ok(KOS)),
    useLibrarySearch: () => (stand.auffrischungScheitert ? alt(KOS) : ok(KOS)),
    useDirectory: () => ok([{ id: "u9", name: "Eva" }]),
    useConflicts: () => ok([]),
    useEigeneBefunde: () => ok([]),
    useKo: (id: string) => ok(KOS.find((k) => k.id === id)),
    useAudit: () => ok([]),
    useReasonerStatus: () => ok({ active: false, mode: "off" }),
    koQueryKey: (id: string) => ["ko", id],
  };
});
vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u1", role: "experte" } }),
}));
vi.mock("../../apps/web/src/app/RoleContext", () => ({ useRole: () => ({ role: "experte" }) }));
vi.mock("../../apps/web/src/app/ToastContext", () => ({ useToast: () => ({ push: () => {} }) }));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, useLocation } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import { AUFFRISCHUNG_HINWEIS_MARKE } from "../../apps/web/src/lib/confidentiality";
import { Library } from "../../apps/web/src/pages/Library";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ---- Die Attrappe für `matchMedia` -------------------------------------------------------------
// Sie WERTET jede Abfrage des Produkts gegen eine Fensterbreite in Pixeln aus — genau die zwei
// Formen, die das Haus benutzt: `(max-width: Npx)` (Telefon, `SCHMAL_ABFRAGE`) und
// `(min-width: Apx) and (max-width: Bpx)` (Tablet, `TABLET_LESE_QUERY`). Eine Abfrage ohne
// Breitenbedingung wäre ein Produkt, das etwas anderes fragt, als dieser Test versteht — dann
// bricht die Attrappe ab, statt still „falsch" zu antworten. Die Hörer werden geführt, damit ein
// Breitenwechsel OHNE Neuladen ankommt (R13). Bauform wie `tests/bibliothek-schmal/…-mounted`.
type Hoerer = () => void;
let hoerer: Hoerer[] = [];
let fensterBreite = 1280;
function passt(abfrage: string): boolean {
  const min = /min-width:\s*(\d+)px/.exec(abfrage);
  const max = /max-width:\s*(\d+)px/.exec(abfrage);
  if (min === null && max === null) {
    throw new Error(`matchMedia-Attrappe: unbekannte Abfrage „${abfrage}"`);
  }
  return (
    (min === null || fensterBreite >= Number(min[1])) &&
    (max === null || fensterBreite <= Number(max[1]))
  );
}
function setzeBreite(px: number): void {
  hoerer = [];
  fensterBreite = px;
  (globalThis as unknown as { matchMedia?: unknown }).matchMedia = (abfrage: string) => ({
    get matches() {
      return passt(abfrage);
    },
    media: abfrage,
    addEventListener: (_typ: string, fn: Hoerer) => {
      hoerer.push(fn);
    },
    removeEventListener: (_typ: string, fn: Hoerer) => {
      hoerer = hoerer.filter((h) => h !== fn);
    },
  });
}
function wechsleBreite(px: number): void {
  fensterBreite = px;
  act(() => {
    for (const h of [...hoerer]) {
      h();
    }
  });
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

/** Schreibt die aktuelle Adresse in den Baum — so wird „Adresse unverändert" zur Messung. */
function Sonde(): ReturnType<typeof createElement> {
  const ort = useLocation();
  return createElement("span", { "data-testid": "sonde-adresse" }, `${ort.pathname}${ort.search}`);
}

function flaeche(adresse: string): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          MemoryRouter,
          { initialEntries: [adresse] },
          createElement(Library),
          createElement(Sonde),
        ),
      ),
    );
  });
}
function abbauen(): void {
  act(() => {
    root.unmount();
  });
  container.remove();
}

beforeEach(async () => {
  setzeBreite(1280);
  stand.auffrischungScheitert = false;
  stand.rufe = 0;
  window.localStorage.clear();
  await i18n.changeLanguage("de");
});

afterEach(() => {
  abbauen();
  hoerer = [];
});

// ---- Griffe -----------------------------------------------------------------------------------
// `da` liest den GANZEN Baum, AUSDRÜCKLICH EINSCHLIESSLICH `hidden`- und `aria-hidden`-Teilbäumen
// (Codex-Lehre zu JOB 3258): die Zusage von Lieferung 3 lautet „nicht gebaut", nicht „nicht
// sichtbar". Eine Liste, die als `hidden`-Block im DOM bliebe, würde hier GEFUNDEN — und R3 rot.
function da(marke: string): HTMLElement | null {
  const el = container.querySelector(`[data-testid="${marke}"]`);
  return el instanceof HTMLElement ? el : null;
}
function alle(marke: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(`[data-testid="${marke}"]`)];
}
function zeilen(): HTMLElement[] {
  return alle("bib-zeile");
}
function zeile(id: string): HTMLElement | undefined {
  return zeilen().find((z) => z.getAttribute("data-bib-id") === id);
}
function rueckweg(): HTMLElement | null {
  return da("bib-zurueck");
}
function schalter(): HTMLButtonElement | null {
  const el = da("bib-liste-schalter");
  return el instanceof HTMLButtonElement ? el : null;
}
function klickeSchalter(): void {
  const s = schalter();
  if (s === null) {
    throw new Error("Der Schalter „Trefferliste“ fehlt");
  }
  act(() => {
    s.click();
  });
}
function suchfeld(): HTMLInputElement {
  const el = da("bib-suche");
  if (!(el instanceof HTMLInputElement)) {
    throw new Error("Suchfeld fehlt");
  }
  return el;
}
function adresse(): string {
  return (da("sonde-adresse")?.textContent ?? "").trim();
}
/** Der Titel des Berichts auf der Lesefläche — nicht der Zeilentitel in der Liste. */
function leseTitel(): string {
  return (da("bib-titel")?.textContent ?? "").trim();
}
function hinweise(): HTMLElement[] {
  return alle(AUFFRISCHUNG_HINWEIS_MARKE);
}

const TABLET = 768;

describe("JOB 3335 · UX-21 · das Lese-Tablet klappt die Trefferliste auf Wunsch", () => {
  it("R1 · 768 mit Bericht: ein beschrifteter Schalter blendet die Liste ein, ohne den Bericht zu schliessen", () => {
    setzeBreite(TABLET);
    flaeche("/bibliothek?eintrag=k2");
    expect(da("bib-lesen")).not.toBeNull();
    expect(leseTitel()).toBe(KOS[1]?.title);
    // Der Kern: ein Bedienelement, das die Liste EINBLENDET — nicht der Rückweg, der schliesst.
    const s = schalter();
    expect(s).not.toBeNull();
    expect(s?.type).toBe("button");
    expect(s?.disabled).toBe(false);
    expect(s?.getAttribute("tabindex")).toBeNull();
    expect(s?.closest("[aria-hidden='true']")).toBeNull();
    expect(s?.closest("[hidden]")).toBeNull();
    // Er hat einen sichtbaren Fokusring in der Hausform (wie der Rückweg daneben) — dieselbe
    // Klassenkette, kein zweiter Stil.
    for (const klasse of [
      "focus-visible:outline",
      "focus-visible:outline-2",
      "focus-visible:outline-offset-2",
      "focus-visible:outline-brand",
    ]) {
      expect(s?.classList.contains(klasse), klasse).toBe(true);
    }
    // Der Rückweg steht weiter daneben — er bedeutet auch hier etwas (Bericht schliessen).
    expect(rueckweg()).not.toBeNull();
    // Und beide stehen in DERSELBEN haftenden Leiste.
    expect(s?.parentElement).toBe(rueckweg()?.parentElement);
    // Vorgabe: eingeklappt — der Leseraum ist der Zweck dieses Bandes.
    expect(da("bib-liste")).toBeNull();
    klickeSchalter();
    expect(da("bib-liste")).not.toBeNull();
    expect(da("bib-lesen")).not.toBeNull();
    expect(leseTitel()).toBe(KOS[1]?.title);
  });

  it("R2 · der Schalter ändert NUR die Sichtbarkeit der Liste: Bericht bleibt, Adresse bleibt, kein Abruf", () => {
    setzeBreite(TABLET);
    flaeche("/bibliothek?eintrag=k2");
    const adresseVorher = adresse();
    expect(adresseVorher).toBe("/bibliothek?eintrag=k2");
    const rufeVorher = stand.rufe;
    klickeSchalter();
    expect(da("bib-liste")).not.toBeNull();
    expect(zeilen()).toHaveLength(KOS.length);
    expect(da("bib-lesen")).not.toBeNull();
    expect(da("bib-titel")).not.toBeNull();
    expect(rueckweg()).not.toBeNull();
    // Die gelesene Zeile ist in der Liste als gewählt markiert — die Trefferstelle ist wiederzufinden.
    expect(zeile("k2")?.getAttribute("aria-current")).toBe("true");
    expect(adresse()).toBe(adresseVorher);
    expect(stand.rufe).toBe(rufeVorher);
    klickeSchalter();
    expect(da("bib-liste")).toBeNull();
    expect(da("bib-lesen")).not.toBeNull();
    expect(adresse()).toBe(adresseVorher);
    expect(stand.rufe).toBe(rufeVorher);
  });

  it("R3 · eingeklappt heisst nicht gebaut: kein Listenknoten, kein Suchfeld, keine Zeile — auch nicht versteckt", () => {
    setzeBreite(TABLET);
    flaeche("/bibliothek?eintrag=k2");
    // `da`/`alle` lesen `hidden`- und `aria-hidden`-Teilbäume MIT (s. o.): ein CSS-Versteck fiele hier
    // durch, weil die Knoten im Baum stünden.
    expect(da("bib-liste")).toBeNull();
    for (const marke of ["bib-suche", "bib-menue-filter", "bib-menue-bereich", "bib-liste-menue"]) {
      expect(da(marke), marke).toBeNull();
    }
    expect(zeilen()).toHaveLength(0);
    // KALIBRIERUNG: derselbe Griff findet die Liste, sobald sie gebaut ist — sonst bewiese das
    // `null` oben nur einen falschen Selektor.
    klickeSchalter();
    expect(da("bib-liste")).not.toBeNull();
    expect(da("bib-suche")).not.toBeNull();
    expect(zeilen()).toHaveLength(KOS.length);
    klickeSchalter();
    expect(da("bib-liste")).toBeNull();
    expect(zeilen()).toHaveLength(0);
  });

  it("R4 · Suchbegriff und Facette überleben Ein- und Ausklappen — und nichts wird neu abgerufen", () => {
    setzeBreite(TABLET);
    // Suchbegriff UND Facettenwahl in der Adresse: „Anlage 1" lässt k1 und k2 übrig, k3 fällt raus.
    flaeche("/bibliothek?q=entl%C3%BCften&category=Anlage+1&eintrag=k2");
    expect(da("bib-lesen")).not.toBeNull();
    const rufeVorher = stand.rufe;
    const adresseVorher = adresse();
    for (let runde = 0; runde < 2; runde++) {
      klickeSchalter();
      expect(suchfeld().value).toBe("entlüften");
      // Die Filterwahl wirkt weiter (k3 aus „Anlage 2" ist nicht dabei), der Suchbegriff ordnet
      // weiter: k2 trägt „entlüften" im Titel und steht vor k1 (dieselbe benannte Grenze wie in
      // JOB 3121 F3: die Vorauswahl nach `q` trifft der Server, hier eine Attrappe).
      const titel = zeilen().map((z) =>
        (z.querySelector('[data-bib-text="zeile-titel"]')?.textContent ?? "").trim(),
      );
      expect(titel).toEqual([KOS[1]?.title, KOS[0]?.title]);
      expect(da("bib-menue-filter")?.textContent).toContain("1");
      klickeSchalter();
      expect(da("bib-liste")).toBeNull();
    }
    expect(adresse()).toBe(adresseVorher);
    expect(stand.rufe).toBe(rufeVorher);
  });

  it("R5 · 390 bleibt JOB 3121: kein Schalter, der Bericht ersetzt die Liste, der Rückweg führt zurück", () => {
    setzeBreite(390);
    flaeche("/bibliothek?eintrag=k2");
    expect(schalter()).toBeNull();
    expect(da("bib-lesen")).not.toBeNull();
    expect(da("bib-liste")).toBeNull();
    expect(rueckweg()).not.toBeNull();
    act(() => {
      (rueckweg() as HTMLButtonElement).click();
    });
    expect(da("bib-liste")).not.toBeNull();
    expect(da("bib-lesen")).toBeNull();
    expect(rueckweg()).toBeNull();
    expect(schalter()).toBeNull();
    // Die Liste trägt die Fläche allein — und sagt es (Breite: `BibliothekListe.tsx`, `lage`).
    expect(da("bib-liste")?.getAttribute("data-lage")).toBe("allein");
  });

  it("R6 · 1280 bleibt breit: kein Schalter, Liste und Bericht nebeneinander, kein Rückweg", () => {
    setzeBreite(1280);
    flaeche("/bibliothek?eintrag=k2");
    expect(schalter()).toBeNull();
    expect(rueckweg()).toBeNull();
    expect(da("bib-liste")).not.toBeNull();
    expect(da("bib-lesen")).not.toBeNull();
    expect(leseTitel()).toBe(KOS[1]?.title);
    expect(zeilen()).toHaveLength(KOS.length);
    expect(da("bib-liste")?.getAttribute("data-lage")).toBe("spalte");
    // Keine Schwebelage am Desktop: die Liste ist eine Spalte, kein Überzug.
    expect(da("bib-liste")?.classList.contains("absolute")).toBe(false);
  });

  it("R7 · `aria-expanded` sagt, was im Baum steht, und die Beschriftung ist in DE und EN übersetzt", async () => {
    setzeBreite(TABLET);
    flaeche("/bibliothek?eintrag=k2");
    const s = schalter() as HTMLButtonElement;
    expect(s.getAttribute("aria-expanded")).toBe("false");
    expect(s.textContent?.trim()).toBe("Trefferliste einblenden");
    klickeSchalter();
    expect(schalter()?.getAttribute("aria-expanded")).toBe("true");
    expect(schalter()?.textContent?.trim()).toBe("Trefferliste ausblenden");
    // `aria-controls` zeigt auf die Liste, die JETZT im Baum steht — nicht auf eine Kennung ins Leere.
    const liste = da("bib-liste") as HTMLElement;
    expect(liste.id.length).toBeGreaterThan(0);
    expect(schalter()?.getAttribute("aria-controls")).toBe(liste.id);
    klickeSchalter();
    expect(schalter()?.getAttribute("aria-expanded")).toBe("false");
    expect(schalter()?.getAttribute("aria-controls")).toBeNull();
    // Englisch: kein roher Schlüssel, ein Satz in der Sprache.
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    expect(schalter()?.textContent?.trim()).toBe("Show result list");
    expect(schalter()?.textContent).not.toContain("lib.");
    klickeSchalter();
    expect(schalter()?.textContent?.trim()).toBe("Hide result list");
    expect(schalter()?.textContent).not.toContain("lib.");
  });

  it("R8 · der Fokus geht mit: ausklappen → die gelesene Zeile, einklappen → der Schalter", () => {
    setzeBreite(TABLET);
    flaeche("/bibliothek?eintrag=k2");
    act(() => {
      schalter()?.focus();
    });
    expect(document.activeElement).toBe(schalter());
    klickeSchalter();
    // Der erste sinnvolle Halt der Liste ist die Trefferstelle selbst: die Zeile des offenen Berichts.
    expect(document.activeElement).toBe(zeile("k2"));
    expect(document.activeElement).not.toBe(document.body);
    klickeSchalter();
    // Die Zeile ist mit der Liste verschwunden; der Fokus liegt auf dem Schalter, nicht auf <body>.
    expect(document.activeElement).toBe(schalter());
  });

  it("R8b · ausklappen ohne auffindbare Zeile: der Fokus nimmt das Suchfeld, nie <body>", () => {
    setzeBreite(TABLET);
    // Die Wahl aus der Adresse steht NICHT in der gefilterten Liste (k3 ist „Anlage 2").
    flaeche("/bibliothek?category=Anlage+1&eintrag=k3");
    expect(da("bib-lesen")).not.toBeNull();
    klickeSchalter();
    expect(zeile("k3")).toBeUndefined();
    expect(document.activeElement).toBe(suchfeld());
  });

  // ------------------------------------------------------------------------------------------------
  // R8c/R8d · JOB 3335 RUNDE 2 — BENs GEGENPROBE: DIE ROLLPOSITION HÄNGT NICHT AN DER ZEILE.
  // ------------------------------------------------------------------------------------------------
  // Runde 1 stellte den Rollstand der Liste nur wieder her, wenn die Zeile des offenen Berichts in
  // der Liste stand (`zeile !== undefined && … && stand !== null`). Lag der Bericht außerhalb der
  // gefilterten Treffer, warf der Effekt den Merker weg und fokussierte bloß das Suchfeld — die
  // Position war verloren (BEN, Runde 1: „expected +0 to be 240"). Gemessen wird hier der DOM-Zustand
  // der Rollspur (`bib-spur`, `BibliothekListe.tsx`) in jsdom: `scrollTop` ist dort eine gespeicherte
  // Zahl, kein Layout — die Pixel misst `tablet-chromium.test.ts` T6/T7.
  it("R8c · Bericht außerhalb der Treffer: die Rollposition der Liste überlebt Ein- und Ausklappen", () => {
    setzeBreite(TABLET);
    flaeche("/bibliothek?category=Anlage+1&eintrag=k3");
    klickeSchalter();
    expect(zeile("k3")).toBeUndefined();
    const spur = da("bib-spur") as HTMLElement;
    expect(spur).not.toBeNull();
    spur.scrollTop = 240;
    expect(spur.scrollTop).toBe(240);
    klickeSchalter();
    expect(da("bib-spur")).toBeNull();
    klickeSchalter();
    // Die Spur ist ein NEUES Element (die Liste war nicht im Baum) — und steht trotzdem bei 240.
    expect(da("bib-spur")).not.toBe(spur);
    expect(da("bib-spur")?.scrollTop).toBe(240);
    // Der Fokus liegt auf einem Halt der Liste, nicht auf <body> (ohne Layout: das Suchfeld).
    expect(document.activeElement).not.toBe(document.body);
    expect(da("bib-liste")?.contains(document.activeElement)).toBe(true);
    // Und der Bericht ist noch offen.
    expect(leseTitel()).toBe(KOS[2]?.title);
  });

  it("R8d · KONTROLLE mit auffindbarer Zeile: Rollposition UND Fokus auf der gelesenen Zeile", () => {
    setzeBreite(TABLET);
    flaeche("/bibliothek?eintrag=k2");
    klickeSchalter();
    const spur = da("bib-spur") as HTMLElement;
    spur.scrollTop = 180;
    klickeSchalter();
    klickeSchalter();
    expect(da("bib-spur")?.scrollTop).toBe(180);
    expect(document.activeElement).toBe(zeile("k2"));
  });

  it("R9 · der Auffrischungssatz steht GENAU EINMAL — eingeklappt am Bericht, ausgeklappt an der Liste", () => {
    stand.auffrischungScheitert = true;
    setzeBreite(TABLET);
    flaeche("/bibliothek?eintrag=k2");
    expect(da("bib-liste")).toBeNull();
    expect(hinweise()).toHaveLength(1);
    expect(da("bib-hinweis-erneut")).not.toBeNull();
    // Der Schalter bleibt bedienbar und behauptet keine Treffer.
    klickeSchalter();
    const liste = da("bib-liste") as HTMLElement;
    expect(hinweise()).toHaveLength(1);
    expect(liste.querySelector(`[data-testid="${AUFFRISCHUNG_HINWEIS_MARKE}"]`)).not.toBeNull();
    expect(alle("bib-hinweis-erneut")).toHaveLength(1);
    klickeSchalter();
    expect(hinweise()).toHaveLength(1);
    expect(da("bib-liste")).toBeNull();
  });

  it("R10 · die Bandgrenzen sind lückenlos: 759 Telefon · 760, 768, 899 Tablet · 900 Desktop", () => {
    // Telefon: kein Schalter, der Bericht ersetzt die Liste, der Rückweg ist da.
    setzeBreite(759);
    flaeche("/bibliothek?eintrag=k2");
    expect(schalter()).toBeNull();
    expect(rueckweg()).not.toBeNull();
    expect(da("bib-liste")).toBeNull();
    abbauen();
    // Tablet an beiden Rändern und in der Mitte: der Schalter ist da.
    for (const px of [760, 768, 899]) {
      setzeBreite(px);
      flaeche("/bibliothek?eintrag=k2");
      expect(schalter(), `${px} px`).not.toBeNull();
      expect(rueckweg(), `${px} px`).not.toBeNull();
      expect(da("bib-liste"), `${px} px`).toBeNull();
      abbauen();
    }
    // Desktop: kein Schalter, kein Rückweg, beides nebeneinander.
    setzeBreite(900);
    flaeche("/bibliothek?eintrag=k2");
    expect(schalter()).toBeNull();
    expect(rueckweg()).toBeNull();
    expect(da("bib-liste")).not.toBeNull();
    expect(da("bib-lesen")).not.toBeNull();
    // `afterEach` baut diese letzte Fläche ab.
  });

  it("R11 · die Vorliebe überlebt ein Neumontieren, und NUR sie wird gespeichert", () => {
    setzeBreite(TABLET);
    flaeche("/bibliothek?eintrag=k2");
    expect(da("bib-liste")).toBeNull();
    const schluessel = (): string[] =>
      Array.from(
        { length: window.localStorage.length },
        (_, i) => window.localStorage.key(i) ?? "",
      );
    const schluesselVorher = schluessel();
    klickeSchalter();
    expect(da("bib-liste")).not.toBeNull();
    // Genau EIN neuer Schlüssel im Speicher — die Bedien-Vorliebe, nichts sonst (keine Auswahl,
    // keine Suche: die wohnen in der Adresse, JOB 3104).
    const neu = schluessel().filter((k) => !schluesselVorher.includes(k));
    expect(neu).toHaveLength(1);
    abbauen();
    flaeche("/bibliothek?eintrag=k2");
    expect(da("bib-liste")).not.toBeNull();
    expect(schalter()?.getAttribute("aria-expanded")).toBe("true");
    expect(da("bib-liste")?.getAttribute("data-lage")).toBe("darueber");
    // Und zurück: eingeklappt bleibt eingeklappt.
    klickeSchalter();
    abbauen();
    flaeche("/bibliothek?eintrag=k2");
    expect(da("bib-liste")).toBeNull();
    expect(schalter()?.getAttribute("aria-expanded")).toBe("false");
  });

  it("R12 · 768 ohne Wahl: die Liste trägt die Fläche allein — keine Vorwahl, kein Schalter, kein leerer Bericht", () => {
    setzeBreite(TABLET);
    flaeche("/bibliothek");
    expect(da("bib-liste")).not.toBeNull();
    expect(da("bib-liste")?.getAttribute("data-lage")).toBe("allein");
    expect(zeilen()).toHaveLength(KOS.length);
    expect(da("bib-lesen")).toBeNull();
    expect(schalter()).toBeNull();
    expect(rueckweg()).toBeNull();
    // Nichts ist STILL vorgewählt (dieselbe Begründung wie schmal, JOB 3121): sonst stünde der
    // Erstbesuch sofort in einem Bericht, den niemand gewählt hat — mit eingeklappter Liste.
    expect(container.querySelector('[data-testid="bib-zeile"][aria-current="true"]')).toBeNull();
    // Eine Zeile wählen: der Bericht kommt, die Liste klappt (Vorgabe) ein, der Fokus geht auf den
    // ersten Halt der Leiste — nicht auf <body>, denn die gedrückte Zeile ist weg.
    act(() => {
      zeile("k2")?.click();
    });
    expect(da("bib-lesen")).not.toBeNull();
    expect(leseTitel()).toBe(KOS[1]?.title);
    expect(da("bib-liste")).toBeNull();
    expect(schalter()).not.toBeNull();
    expect(document.activeElement).toBe(rueckweg());
    expect(adresse()).toBe("/bibliothek?eintrag=k2");
  });

  it("R13 · Breitenwechsel ohne Neuladen: 1280 → 768 → 1280, ohne zweiten Abruf", () => {
    setzeBreite(1280);
    flaeche("/bibliothek?eintrag=k2");
    expect(da("bib-liste")).not.toBeNull();
    expect(schalter()).toBeNull();
    const rufeVorher = stand.rufe;
    wechsleBreite(TABLET);
    expect(da("bib-liste")).toBeNull();
    expect(da("bib-lesen")).not.toBeNull();
    expect(schalter()).not.toBeNull();
    wechsleBreite(1280);
    expect(da("bib-liste")).not.toBeNull();
    expect(da("bib-lesen")).not.toBeNull();
    expect(schalter()).toBeNull();
    expect(stand.rufe).toBe(rufeVorher);
  });
});
