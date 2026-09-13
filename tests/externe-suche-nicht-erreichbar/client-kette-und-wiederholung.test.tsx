// @vitest-environment jsdom
// ================================================================================================
// JOB 3876 — DER NETZABBRUCH AUF `/extern` WIRD AM ECHTEN CLIENT GEMESSEN, NICHT AN DER ERSETZTEN
// ENDPUNKTSCHICHT.
// ================================================================================================
//
// WAS HIER ANDERS GEMESSEN WIRD ALS IN DER NACHBARDATEI. `netzabbruch-nennt-den-grund.test.tsx`
// misst den SATZ: dass ein Mensch „Externe Suche ist nicht verfügbar." liest und nicht „Failed to
// fetch". Sie speist ihren Wurf dafür am ENDPUNKT ein — `:40-42` ersetzt
// `apps/web/src/api/endpoints` als Ganzes, `:138` wirft über `searchMock.mockRejectedValue(...)`.
// `apps/web/src/api/client.ts` läuft in jener Datei kein einziges Mal. Diese Datei misst die NAHT:
// dass ein Wurf aus `fetch` den Weg durch `client.ts` UNVERPACKT überlebt und beim Klassifizierer
// wirklich als Nicht-`ApiError` ankommt.
//
// WARUM DAS NÖTIG IST — die befürchtete Änderung ist im Haus bereits gebaut. `client.ts:67-82`
// (`mitFrist`, JOB 3782) fängt genau solche Würfe ab und ERSETZT sie durch
// `new ApiError(408, "TIMEOUT", …)` (`:71-78`). Die Bauform „Netzfehler in einen ApiError
// verpacken" ist also vorhanden und in Gebrauch. Zöge jemand sie von `mitFrist` nach `apiFetch`
// hoch — der naheliegende nächste Schritt für „ehrliche Fehlermeldungen überall" —, dann wäre
// `klassifiziereSuchfehler(...).serverantwort` plötzlich `true`, die Fläche zeigte den
// Serverfehler-Zweig statt „nicht erreichbar", und KEIN Fall der Nachbardatei würde rot: N1–N4
// speisen ihren `TypeError` hinter dieser Stelle ein, N5 (`:243-304`) ruft `klassifiziereSuchfehler`
// direkt auf. Genau diese Verstellung ist in der Rückgabe gemessen (R1): C2 rot, Nachbardatei grün.
//
// DER MESSSTAND ERSETZT `globalThis.fetch` UND SONST NICHTS. Kein `vi.mock` auf `endpoints`, keines
// auf `client` — diese Datei ruft `vi` überhaupt nicht auf. Gefahren wird die echte Kette
//     ExternalKnowledge (`pages/ExternalKnowledge.tsx:20`)
//       → endpoints.external.search (`api/endpoints.ts:807`)
//       → api.get (`api/client.ts:85`)
//       → apiFetch (`api/client.ts:21-47`)
//       → fetch (`api/client.ts:28`).
// Dass die Adresse wirklich der CLIENT baut und nicht der Test, hält C1 mit der abgelesenen
// Aufrufadresse fest (`BASE = "/api"`, `client.ts:19`); der Ersatz wirft ausserdem bei jeder
// Adresse ohne `/api`-Wurzel.
//
// ZEITFESTIGKEIT STATT FESTER DURCHLAUFZAHLEN (Lehre 13.09., JOB 3813 R1, Korrekturpflicht 1:
// „Feste `durchlaufen()`-Folgen dürfen keinen abgeschlossenen Request ersetzen"): gewartet wird auf
// einen BEOBACHTBAREN Abschluss. Der `fetch`-Ersatz meldet jeden Aufruf und dessen Auflösung
// (`abschluss(n)`, erfüllt ODER abgewiesen); erst danach wird auf die Fläche gewartet, und zwar auf
// eine NEUTRALE Bedingung — der Suchknopf nimmt wieder an, also `search.isPending === false`. Nie
// auf eine feste Zahl von Umläufen, und nie auf das erwartete Ergebnis: eine Wartebedingung, die
// das Ergebnis vorwegnimmt, verwandelt jede falsche Anzeige in eine Zeitüberschreitung und lässt
// die eigentliche Zusicherung nie zu Wort kommen. Der Ablauf von C4 läuft zweimal — einmal mit
// sofortigen, einmal mit um 30 ms VERZÖGERTEN Antworten (C4v).
//
// DAS SICHTBARKEITSFENSTER (`verborgen`/`sichtbarerText`) ist aus der Nachbardatei ÜBERNOMMEN und
// nicht neu erfunden. Importieren lässt es sich nicht: es ist dort modul-lokal und nicht
// exportiert, und die Nachbardatei ist in diesem Auftrag ausdrücklich KEIN Zielpfad (§10 — sie
// bleibt unverändert, auch kein „kleines Aufräumen"). Die Zusammenführung beider Fenster in eine
// gemeinsame Bühne bleibt Folgearbeit.
//
// DIE EHRLICHE GRENZE: jsdom, kein echter Browser, kein echter Server, kein echtes Netz. jsdom
// rechnet kein Layout — „sichtbar" heisst hier ausschliesslich: nicht von der Fläche selbst
// verborgen. Der von Codex zusätzlich bestellte Browsertest („für das tatsächliche
// Browserverhalten", `archiv/3802/runde-2/ben.md:24`) ist nach §10 nicht Teil dieses Auftrags und
// bleibt offen.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { ApiError } from "../../apps/web/src/api/client";
import { endpoints } from "../../apps/web/src/api/endpoints";
import type { ExternalResult } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import {
  buildExternalSearchView,
  klassifiziereSuchfehler,
} from "../../apps/web/src/lib/externalKnowledge";
import { ExternalKnowledge } from "../../apps/web/src/pages/ExternalKnowledge";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Der Katalogwert einer Sprache — gelesen, nicht abgeschrieben (Hausform der Nachbardatei). */
function katalog(sprache: string, schluessel: string, werte?: Record<string, unknown>): string {
  return i18n.getFixedT(sprache)(schluessel, werte ?? {});
}

const SUCHWORT = "Dichtung";
/** Die Adresse, die der CLIENT aus `BASE` (`client.ts:19`) und `endpoints.ts:807` baut. */
const ERWARTETE_ADRESSE = `/api/external/search?q=${SUCHWORT}`;

const TREFFER: ExternalResult = {
  title: "Dichtungswerk Nord",
  url: "https://beispiel.invalid/dichtung",
  snippet: "Ein Treffer, der nach dem zweiten Versuch nichts mehr belegt.",
  provider: "wikipedia",
};

// ------------------------------------------------------------------------------------------------
// DER MESSSTAND: nur `fetch`, und er sagt, wann er fertig ist.
// ------------------------------------------------------------------------------------------------

/**
 * Was `apiFetch` von einer Antwort WIRKLICH liest: `status` (`client.ts:30`), `text()` (`:34`),
 * `ok` (`:37`) und `statusText` (`:42`). Mehr wird hier nicht gebaut — ein halbes `Response`, das
 * mehr verspricht, als der Client benutzt, wäre eine Behauptung über ungemessene Felder.
 */
interface Antwortartig {
  status: number;
  ok: boolean;
  statusText: string;
  text: () => Promise<string>;
}

/** Ein Zug des Netzes: eine Antwort, oder ein Wurf, wie ihn `fetch` selbst wirft. */
type Netzzug = () => Promise<Antwortartig>;

function antwort(status: number, rumpf: unknown, statusText: string): Netzzug {
  return async () => ({
    status,
    ok: status >= 200 && status < 300,
    statusText,
    text: async () => (rumpf === undefined ? "" : JSON.stringify(rumpf)),
  });
}

/** Der Netzabbruch, wie ihn Chromium meldet — das Objekt selbst bleibt greifbar (C2). */
function netzabbruch(wurf: unknown): Netzzug {
  return async () => {
    throw wurf;
  };
}

/** Derselbe Zug, nur später. Damit misst C4v die Zeitfestigkeit statt sie zu behaupten. */
function verzoegert(zug: Netzzug, ms: number): Netzzug {
  return async () => {
    await new Promise((auf) => setTimeout(auf, ms));
    return zug();
  };
}

interface Marke {
  fertig: Promise<void>;
  melde: () => void;
}

interface Messstand {
  /** Jede Adresse, mit der `fetch` gerufen wurde, in Aufrufreihenfolge. */
  readonly adressen: string[];
  /** Löst auf, sobald der `n`-te `fetch`-Aufruf (1-basiert) fertig ist — erfüllt ODER abgewiesen. */
  abschluss: (n: number) => Promise<void>;
}

let vorherigesFetch: typeof globalThis.fetch;

function netzSteht(zuege: Netzzug[]): Messstand {
  const adressen: string[] = [];
  const marken: Marke[] = [];
  const marke = (i: number): Marke => {
    while (marken.length <= i) {
      let melde: () => void = () => {};
      const fertig = new Promise<void>((auf) => {
        melde = auf;
      });
      marken.push({ fertig, melde });
    }
    const gefunden = marken[i];
    if (gefunden === undefined) {
      throw new Error(`Marke ${i} fehlt`);
    }
    return gefunden;
  };

  globalThis.fetch = (async (eingabe: unknown): Promise<unknown> => {
    const adresse = String(eingabe);
    const i = adressen.length;
    adressen.push(adresse);
    const meine = marke(i);
    try {
      // R4: Der Messstand baut KEINE Adresse. Kommt hier etwas ohne `/api`-Wurzel an, hat nicht
      // `apiFetch` sie gebaut, sondern jemand anders — dann ist die Kette abgekürzt und der Fall
      // fällt laut auf, statt still weiterzulaufen.
      if (!adresse.startsWith("/api")) {
        throw new Error(
          `Adresse ohne /api-Wurzel: ${adresse} — die baut der Client, nicht der Test`,
        );
      }
      const zug = zuege[i];
      if (zug === undefined) {
        throw new Error(`kein Netzzug für fetch-Aufruf ${i + 1} (${adresse})`);
      }
      return await zug();
    } finally {
      meine.melde();
    }
  }) as typeof globalThis.fetch;

  return { adressen, abschluss: (n) => marke(n - 1).fertig };
}

// ------------------------------------------------------------------------------------------------
// DIE FLÄCHE
// ------------------------------------------------------------------------------------------------

let container: HTMLDivElement | undefined;
let root: ReturnType<typeof createRoot> | undefined;

function flaeche(): HTMLDivElement {
  if (container === undefined) {
    throw new Error("keine Fläche montiert");
  }
  return container;
}

function mount(): void {
  const neu = document.createElement("div");
  document.body.appendChild(neu);
  container = neu;
  const wurzel = createRoot(neu);
  root = wurzel;
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  act(() => {
    wurzel.render(
      createElement(QueryClientProvider, { client: qc }, createElement(ExternalKnowledge)),
    );
  });
}

// Ist dieser Knoten (samt Elternkette) für einen sehenden Menschen da? Aus der Nachbardatei
// übernommen (`netzabbruch-nennt-den-grund.test.tsx:101-134`, dort nicht exportiert; s. Kopf).
// jsdom rechnet kein Layout — geprüft wird genau das, was die Fläche selbst setzen würde, um etwas
// zu verbergen.
function verborgen(el: Element): boolean {
  for (let node: Element | null = el; node !== null; node = node.parentElement) {
    if (node.hasAttribute("hidden") || node.getAttribute("aria-hidden") === "true") {
      return true;
    }
    if (/\b(sr-only|invisible|hidden)\b/.test(node.getAttribute("class") ?? "")) {
      return true;
    }
    if (
      /display:\s*none|visibility:\s*hidden|clip:\s*rect\(0/.test(node.getAttribute("style") ?? "")
    ) {
      return true;
    }
  }
  return false;
}

function sichtbarerText(): string {
  const teile: string[] = [];
  const gehe = (el: Element): void => {
    if (verborgen(el)) {
      return;
    }
    for (const kind of el.childNodes) {
      if (kind.nodeType === 3) {
        teile.push(kind.textContent ?? "");
      } else if (kind.nodeType === 1) {
        gehe(kind as Element);
      }
    }
  };
  gehe(flaeche());
  return teile.join(" ");
}

/** Tippt das Suchwort ein (nur beim ersten Mal nötig) und drückt den Suchknopf. */
function suchknopf(): HTMLButtonElement {
  const knopf = [...flaeche().querySelectorAll("button")].find(
    (b) => (b.textContent ?? "").includes(katalog("de", "ext.search")) && !verborgen(b),
  );
  if (!(knopf instanceof HTMLButtonElement)) {
    throw new Error(`Suchknopf nicht gefunden; sichtbar: ${sichtbarerText()}`);
  }
  return knopf;
}

async function suche(tippen: boolean): Promise<void> {
  if (tippen) {
    const feld = [...flaeche().querySelectorAll("input")].find(
      (el) => el.getAttribute("placeholder") === katalog("de", "ext.placeholder"),
    );
    if (!(feld instanceof HTMLInputElement)) {
      throw new Error(`Suchfeld nicht gefunden; sichtbar: ${sichtbarerText()}`);
    }
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    act(() => {
      setter?.call(feld, SUCHWORT);
      feld.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  const knopf = suchknopf();
  if (knopf.disabled) {
    throw new Error(`Suchknopf ist gesperrt; sichtbar: ${sichtbarerText()}`);
  }
  await act(async () => {
    knopf.click();
  });
}

/**
 * Zeitfest warten (Lieferung 6, Lehre JOB 3813 R1): erst auf den BEOBACHTBAREN Abschluss des
 * `n`-ten `fetch`-Aufrufs, danach auf die Fläche — bis der Suchknopf wieder annimmt. Das ist
 * `search.isPending === false` (`ExternalKnowledge.tsx:65`), also das ENDE DES ABRUFS.
 *
 * DIE BEDINGUNG IST AUSDRÜCKLICH NEUTRAL und nennt das erwartete Ergebnis NICHT. Wartete sie auf
 * „der Satz steht da", verwandelte jede falsche Anzeige sich in eine Zeitüberschreitung, und die
 * eigentliche Zusicherung käme nie zum Zug — die Gegenprobe R3 (die zweite Suche liefert wieder den
 * alten Treffer) muss an der Zeile rot werden, die die veraltete Trefferaussage ausschliesst, und
 * nicht hier. Die Obergrenze ist nur die Reissleine gegen einen Hänger.
 */
async function bisAbgeschlossen(stand: Messstand, n: number): Promise<string> {
  await act(async () => {
    await stand.abschluss(n);
  });
  for (let i = 0; i < 200; i++) {
    if (!suchknopf().disabled) {
      return sichtbarerText();
    }
    await act(async () => {
      await new Promise((auf) => setTimeout(auf, 2));
    });
  }
  throw new Error(`Suchlauf ${n} nicht abgeschlossen; sichtbar: ${sichtbarerText()}`);
}

/** Den Wurf eines Aufrufs greifen, ohne ihn zu deuten. */
async function wurfVon(lauf: () => Promise<unknown>): Promise<unknown> {
  const NICHTS = Symbol("nichts geworfen");
  let gefangen: unknown = NICHTS;
  try {
    await lauf();
  } catch (err) {
    gefangen = err;
  }
  if (gefangen === NICHTS) {
    throw new Error("erwartet war ein Wurf, es kam keiner");
  }
  return gefangen;
}

beforeEach(() => {
  vorherigesFetch = globalThis.fetch;
});

afterEach(() => {
  // Auch wenn eine Zusicherung gefallen ist: `afterEach` läuft, der Baum geht ab und `fetch` steht
  // wieder so da, wie er vorgefunden wurde. Sonst nähme ein Nachbarfall den Ersatz mit.
  const wurzel = root;
  if (wurzel !== undefined) {
    act(() => {
      wurzel.unmount();
    });
  }
  root = undefined;
  container?.remove();
  container = undefined;
  globalThis.fetch = vorherigesFetch;
});

describe("JOB 3876: die Kette vom echten `fetch` bis zum Satz auf der Fläche", () => {
  it("C1 · Netzabbruch durch die GANZE Kette: der Katalogsatz steht da, der Client baut die Adresse", async () => {
    const stand = netzSteht([netzabbruch(new TypeError("Failed to fetch"))]);
    mount();
    await suche(true);
    const text = await bisAbgeschlossen(stand, 1);

    expect(text).toContain("Externe Suche ist nicht verfügbar.");
    expect(text).toContain(katalog("de", "ext.unavailable"));

    // Nichts aus dem Maschinenraum, und keine Aussage ohne Grundlage.
    expect(text).not.toContain("Failed to fetch");
    expect(text).not.toContain("ext.unavailable");
    expect(text).not.toContain(katalog("de", "extpage.noResults"));
    expect(text).not.toContain(katalog("de", "extpage.disabled"));
    expect(flaeche().querySelectorAll("li")).toHaveLength(0);

    // R4: DER CLIENT hat die Adresse gebaut — `BASE` aus `client.ts:19` plus `endpoints.ts:807`.
    // Der Test hat nirgends eine Adresse genannt.
    expect(stand.adressen).toEqual([ERWARTETE_ADRESSE]);
  });

  it("C2 · die Naht: der Wurf aus `endpoints.external.search` ist KEIN ApiError", async () => {
    const wurf = new TypeError("Failed to fetch");
    const stand = netzSteht([netzabbruch(wurf)]);

    const gefangen = await wurfVon(() => endpoints.external.search(SUCHWORT));

    // Unverpackt: es ist DASSELBE Objekt, das `fetch` geworfen hat. Eine Verpackung in `apiFetch`
    // (so wie `mitFrist` sie `client.ts:71-78` baut) macht genau diese drei Zeilen rot.
    expect(gefangen).toBe(wurf);
    expect(gefangen).toBeInstanceOf(TypeError);
    expect(gefangen).not.toBeInstanceOf(ApiError);

    const eingeordnet = klassifiziereSuchfehler(gefangen);
    expect(eingeordnet?.serverantwort).toBe(false);
    expect(
      buildExternalSearchView({ pending: false, hasSearched: true, error: eingeordnet }),
    ).toEqual({ kind: "unreachable" });

    expect(stand.adressen).toEqual([ERWARTETE_ADRESSE]);
  });

  it("C3 · die Gegenrichtung: eine echte 501-Antwort IST ein ApiError und zeigt „abgeschaltet“", async () => {
    const abgeschaltet = (): Netzzug =>
      antwort(
        501,
        { error: "EXTERNAL_SEARCH_DISABLED", message: "external search disabled" },
        "Not Implemented",
      );
    const stand = netzSteht([abgeschaltet(), abgeschaltet()]);

    const gefangen = await wurfVon(() => endpoints.external.search(SUCHWORT));
    expect(gefangen).toBeInstanceOf(ApiError);
    expect((gefangen as ApiError).status).toBe(501);
    expect((gefangen as ApiError).code).toBe("EXTERNAL_SEARCH_DISABLED");
    expect(klassifiziereSuchfehler(gefangen)?.serverantwort).toBe(true);

    // Und derselbe Weg auf der Fläche: der Server HAT geantwortet, also sein Zweig, nicht
    // „nicht erreichbar".
    mount();
    await suche(true);
    const text = await bisAbgeschlossen(stand, 2);
    expect(text).toContain(katalog("de", "extpage.disabled"));
    expect(text).not.toContain(katalog("de", "ext.unavailable"));
    expect(stand.adressen).toEqual([ERWARTETE_ADRESSE, ERWARTETE_ADRESSE]);
  });

  /**
   * Der zweite Teil der Bestellung (`archiv/3802/runde-2/ben.md:24`): „erfolgreiche Suche → offline
   * → erneute Suche", EIN Mount, zwei Durchgänge. Gemessen wird, was NACH dem zweiten Versuch
   * dasteht — die Erwartung wird nicht vorweggenommen.
   */
  async function erfolgDannOffline(verzug: number): Promise<void> {
    const treffer = antwort(200, [TREFFER], "OK");
    const abbruch = netzabbruch(new TypeError("Failed to fetch"));
    const stand = netzSteht(
      verzug === 0
        ? [treffer, abbruch]
        : [verzoegert(treffer, verzug), verzoegert(abbruch, verzug)],
    );

    mount();
    await suche(true);
    const ersterText = await bisAbgeschlossen(stand, 1);
    expect(ersterText).toContain(TREFFER.title);
    expect(ersterText).toContain(katalog("de", "extpage.resultsTitle", { n: 1 }));
    expect(flaeche().querySelectorAll("li")).toHaveLength(1);

    // Jetzt fällt das Netz aus, dieselbe Suche ein zweites Mal.
    await suche(false);
    const zweiterText = await bisAbgeschlossen(stand, 2);

    // ZUERST die Zusicherung, um die es in C4 GEHT, und deshalb vor allen anderen: keine
    // Trefferaussage, die der zweite Versuch nicht mehr trägt. GEMESSEN, NICHT ANGENOMMEN — der
    // Ist-Zustand des Produkts ist damit festgenagelt: `useMutation` setzt `data` beim neuen Lauf
    // zurück (`query-core/mutation.js`, Fall `"pending"`: `data: void 0`), und
    // `buildExternalSearchView` entscheidet den Fehler vor den Treffern
    // (`lib/externalKnowledge.ts:109`). Bliebe die alte Liste stehen, wird GENAU DIESE Zeile rot —
    // die Gegenprobe R3 steht in der Rückgabe.
    expect(zweiterText).not.toContain(TREFFER.title);
    expect(zweiterText).not.toContain(TREFFER.snippet);
    expect(zweiterText).not.toContain(katalog("de", "extpage.resultsTitle", { n: 1 }));
    expect(flaeche().querySelectorAll("li")).toHaveLength(0);

    // Und erst danach: was STATTDESSEN dasteht, und keine erfundene Nebenaussage.
    expect(zweiterText).toContain(katalog("de", "ext.unavailable"));
    expect(zweiterText).not.toContain("Failed to fetch");
    expect(zweiterText).not.toContain(katalog("de", "extpage.noResults"));
    expect(zweiterText).not.toContain(katalog("de", "extpage.disabled"));

    expect(stand.adressen).toEqual([ERWARTETE_ADRESSE, ERWARTETE_ADRESSE]);
  }

  it("C4 · erfolgreiche Suche → offline → erneute Suche: der alte Treffer bleibt NICHT stehen", async () => {
    await erfolgDannOffline(0);
  });

  it("C4v · derselbe Ablauf mit um 30 ms verzögerten Antworten — zeitfest, nicht umlaufgezählt", async () => {
    await erfolgDannOffline(30);
  });
});
