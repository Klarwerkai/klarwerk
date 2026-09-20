// @vitest-environment jsdom
// ================================================================================================
// JOB 4357 · A12 — DIE BESTANDSLISTE AUF DER FLÄCHE: VIER LAGEN, DREI SPRACHEN, EIN LINK JE ZEILE.
// ================================================================================================
//
// WAS DIESER FALL MISST UND WAS EIN SCHLÜSSELVERGLEICH NICHT MESSEN KANN. Dass es die Sätze GIBT,
// sagt nichts darüber, ob sie an der Fläche ankommen, ob sie in der richtigen LAGE erscheinen und ob
// die Zeile bedienbar ist. Genau das steht hier — am gezeichneten DOM, in de/en/nl, ohne Netz.
//
// DIE VIER LAGEN UND IHRE ZUSAGEN (`GesamtanweisungBereich.tsx`, Abschnitt zu den vier Lagen):
//   laden   „Lädt …" und KEIN Wort über den Bestand.
//   leer    ein Hinweissatz — erlaubt, weil eine ERFOLGREICHE leere Antwort vorliegt.
//   Fehler  ein Fehlersatz und AUSDRÜCKLICH KEIN Leersatz.
//   Stand   die Zeilen; scheitert eine Auffrischung, bleiben sie stehen und der Fehler steht daneben.
//
// DIE GEFÄHRLICHSTE VERWECHSLUNG DIESER LIEFERUNG ist „Fehler" gegen „leer": ein Mensch, dem bei
// einem Ausfall „es ist nichts gespeichert" angezeigt wird, legt dieselbe Anweisung ein zweites Mal
// an. Deshalb steht dafür ein eigener Fall — und zwar für BEIDE Ursachen: eine abgelehnte Antwort
// UND eine Antwort, die zwar gelingt, aber kein `eintraege` trägt.
//
// KEIN ECHTES NETZ: `fetch` wird je Fall festgelegt. `api/client.ts` liest genau drei Dinge —
// `status`, `ok` und `text()` (dieselbe Begründung wie `a10-absage-bleibt-bedienbar.test.tsx:70-76`).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "experte" })),
    logout: vi.fn(async () => ({})),
  },
}));

import type { AnweisungListeneintrag } from "../../apps/web/src/api/endpoints";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import {
  BEREICH_MARKE,
  GesamtanweisungBereich,
  LISTE_MARKE,
  bestandAus,
  juengsteAenderung,
} from "../../apps/web/src/components/gesamtanweisung/GesamtanweisungBereich";
import i18n from "../../apps/web/src/i18n";
import { ZAEHLER_FRISCHE_MS } from "../../apps/web/src/lib/loadingState";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SPRACHEN = ["de", "en", "nl"] as const;
/** Die Marke der Zielseite — sie erscheint NUR, wenn wirklich navigiert wurde. */
const ZIEL_MARKE = "a12-ziel-der-navigation";

// ==================================================================================================
// DIE ZWEI PRÜFEINTRÄGE — AUSDRÜCKLICH AUF DEN DRAHTTYP TYPISIERT.
// ==================================================================================================
//
// `AnweisungListeneintrag` und nicht ein Objektliteral, und das ist kein Stil: ohne die Annotation
// verbreitert TypeScript `stand` zu `string`, und `juengsteAenderung`/`bestandAus` nehmen den Eintrag
// dann nicht an. GEMESSEN, nicht vermutet: Runde 1 war im Tor rot mit
// „Type 'string' is not assignable to type '„entwurf" | „abgelehnt" | „vorgelegt" | „entschieden"'"
// (a12:212) — `npx tsc --noEmit -p tsconfig.json` sieht diese Datei NICHT, `./tools/build` prüft
// `tests/**/*.tsx` über `tsconfig.tests-tsx.json` mit.
//
// Die Annotation leistet zusätzlich etwas Fachliches: sie hält den Prüfstand an den ECHTEN Drahttyp.
// Ein Feld, das der Server nicht schickt, oder ein Stand, den das Modell nicht kennt, fällt hier
// auf — statt die Fläche gegen erfundene Daten grün zu messen.
const EINTRAG_A: AnweisungListeneintrag = {
  id: "ga-1",
  titel: "Anlage anfahren (JOB 4357)",
  stand: "vorgelegt",
  version: 3,
  urheber: "u-pia",
  erstelltAm: "2026-09-18T08:00:00.000Z",
  geaendertAm: "2026-09-19T10:30:00.000Z",
  sichtbareBausteine: 1,
  verborgeneBausteine: 1,
  unvollstaendig: true,
};

const EINTRAG_B: AnweisungListeneintrag = {
  id: "ga-2",
  titel: "Anlage abfahren (JOB 4357)",
  stand: "entwurf",
  version: 1,
  urheber: "u-ben",
  erstelltAm: "2026-09-17T08:00:00.000Z",
  geaendertAm: "2026-09-17T09:00:00.000Z",
  sichtbareBausteine: 0,
  verborgeneBausteine: 0,
  unvollstaendig: false,
};

let container: HTMLDivElement;
let root: Root;

/** Der Text, wie er WIRKLICH in `i18n.ts` steht — nicht hier abgeschrieben. */
function text(sprache: string, schluessel: string): string {
  return String(i18n.getResource(sprache, "translation", schluessel) ?? "");
}

/** Derselbe Satz mit eingesetzter Zahl — über i18next, nicht über eine eigene Ersetzung. */
function satz(schluessel: string, werte: Record<string, unknown>): string {
  return String(i18n.t(schluessel, werte));
}

function antworte(status: number, rumpf: unknown): void {
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: async () =>
      ({
        status,
        ok: status >= 200 && status < 300,
        statusText: String(status),
        text: async () => JSON.stringify(rumpf),
      }) as unknown as Response,
  });
}

/** Ein `fetch`, das NIE antwortet — die einzige ehrliche Art, die Ladefläche zu messen. */
function antworteNie(): void {
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: () => new Promise<Response>(() => undefined),
  });
}

function wirf(): void {
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: async () => {
      throw new Error("kein Netz in diesem Prüfstand");
    },
  });
}

// ==================================================================================================
// JOB 4357 R4 · EIN SERVER, DER SICH WIRKLICH ÄNDERT — FÜR DIE ZWEI CACHE-FÄLLE.
// ==================================================================================================
//
// DIE FÄLLE UNTEN FRAGEN NICHT, OB DER SERVER ANTWORTET, sondern ob die FLÄCHE den geänderten Stand
// HOLT. Dafür genügt ein fester Rumpf nicht: der Prüfstand muss den Schreibvorgang wirklich
// nachvollziehen, sonst wäre „die Liste zeigt den neuen Eintrag" auch dann grün, wenn sie gar nichts
// neu geholt hat (der alte Rumpf hätte ihn ja schon enthalten).
//
// `bestand` ist deshalb ein echter Zustand: `POST /api/gesamtanweisungen` legt an, `POST …/vorlegen`
// ändert den Stand, und `GET /api/gesamtanweisungen` gibt zurück, was in diesem Augenblick DA ist.
// Jeder Abruf wird gezählt — `abrufe.liste` ist der Beleg, dass wirklich ein zweites Mal gelesen
// wurde und nicht nur ein Zwischenspeicher gezeichnet.

interface Serverzustand {
  bestand: AnweisungListeneintrag[];
  abrufe: { liste: number };
}

/**
 * Der Lesestand EINER Anweisung — genau die Felder, die `GesamtanweisungSeite` liest.
 *
 * DIE BAUSTEINE ENTSTEHEN AUS `sichtbareBausteine` und sind nicht fest leer: `entscheidungSperre`
 * (`zustand.ts`) sperrt das Vorlegen auf der LEEREN Anweisung mit sichtbarem Grund — ein Lesestand
 * ohne Bausteine hätte den Knopf gar nicht bedienbar gemacht, und der Vorlege-Fall unten hätte
 * nichts gemessen. So bleiben Liste und Einzelabruf ausserdem widerspruchsfrei.
 */
function lesestandVon(eintrag: AnweisungListeneintrag): Record<string, unknown> {
  return {
    id: eintrag.id,
    titel: eintrag.titel,
    zweck: "",
    geltungsbereich: "",
    voraussetzungen: "",
    stand: eintrag.stand,
    version: eintrag.version,
    urheber: eintrag.urheber,
    erstelltAm: eintrag.erstelltAm,
    geaendertAm: eintrag.geaendertAm,
    bausteine: Array.from({ length: eintrag.sichtbareBausteine }, (_, i) => ({
      id: `b-${i + 1}`,
      position: i,
      koId: `ko-${i + 1}`,
      koVersion: 1,
      nachweisHash: null,
      voraussetzung: null,
      herkunft: { titel: `Schritt ${i + 1}`, autor: "u-pia", fassungAm: null, status: "draft" },
      rumpfHtml: null,
      aktuelleKoVersion: 1,
      aktualisierungsvorschlag: null,
      inhalt: { tabellenUeberschriften: null, abbildungen: null, geltung: null },
    })),
    unvollstaendig: eintrag.unvollstaendig,
    verborgeneBausteine: eintrag.verborgeneBausteine,
    pruefanbindung: "nicht_angebunden",
  };
}

/**
 * Ein `fetch`, der den Zustand oben bedient — adressabhängig und mit echtem Schreibvorgang.
 *
 * Er antwortet auf genau die Adressen, die dieser Bereich ruft. Alles andere ist ein Prüfstandfehler
 * und wird als 500 mit ausgeschriebener Adresse gemeldet, statt still etwas Brauchbares zu liefern.
 */
function serviere(zustand: Serverzustand): void {
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: async (eingabe: unknown, optionen?: { method?: string; body?: string }) => {
      const adresse = String(eingabe);
      const methode = String(optionen?.method ?? "GET").toUpperCase();
      const antwort = (status: number, rumpf: unknown) =>
        ({
          status,
          ok: status >= 200 && status < 300,
          statusText: String(status),
          text: async () => JSON.stringify(rumpf),
        }) as unknown as Response;

      if (methode === "GET" && adresse === "/api/gesamtanweisungen") {
        zustand.abrufe.liste += 1;
        return antwort(200, { eintraege: zustand.bestand });
      }
      if (methode === "POST" && adresse === "/api/gesamtanweisungen") {
        const titel = String(
          (JSON.parse(optionen?.body ?? "{}") as { titel?: unknown }).titel ?? "",
        );
        const neu: AnweisungListeneintrag = {
          id: `ga-neu-${zustand.bestand.length + 1}`,
          titel,
          stand: "entwurf",
          version: 1,
          urheber: "u-pia",
          erstelltAm: "2026-09-20T07:00:00.000Z",
          geaendertAm: "2026-09-20T07:00:00.000Z",
          sichtbareBausteine: 0,
          verborgeneBausteine: 0,
          unvollstaendig: false,
        };
        zustand.bestand = [...zustand.bestand, neu];
        return antwort(201, lesestandVon(neu));
      }
      const vorlegen = /^\/api\/gesamtanweisungen\/([^/]+)\/vorlegen$/.exec(adresse);
      if (methode === "POST" && vorlegen) {
        zustand.bestand = zustand.bestand.map((e) =>
          e.id === vorlegen[1]
            ? {
                ...e,
                stand: "vorgelegt",
                version: e.version + 1,
                geaendertAm: "2026-09-20T08:00:00.000Z",
              }
            : e,
        );
        const getroffen = zustand.bestand.find((e) => e.id === vorlegen[1]);
        return getroffen
          ? antwort(200, lesestandVon(getroffen))
          : antwort(404, { error: "NOT_FOUND", message: "gibt es nicht" });
      }
      const staende = /^\/api\/gesamtanweisungen\/([^/]+)\/staende$/.exec(adresse);
      if (methode === "GET" && staende) {
        return antwort(200, { staende: [1] });
      }
      const einzeln = /^\/api\/gesamtanweisungen\/([^/]+)$/.exec(adresse);
      if (methode === "GET" && einzeln) {
        const getroffen = zustand.bestand.find((e) => e.id === einzeln[1]);
        return getroffen
          ? antwort(200, lesestandVon(getroffen))
          : antwort(404, { error: "NOT_FOUND", message: "gibt es nicht" });
      }
      return antwort(500, {
        error: "PRUEFSTAND",
        message: `dieser Prüfstand bedient ${methode} ${adresse} nicht`,
      });
    },
  });
}

/**
 * Ein QueryClient MIT der Frischefrist des Produktbetriebs.
 *
 * `ZAEHLER_FRISCHE_MS` ist die eine Zahl des Hauses (`lib/loadingState.ts:130`) und steht in
 * `main.tsx:44` als `staleTime` des einzigen QueryClients der Anwendung. Sie wird IMPORTIERT und
 * nicht abgeschrieben: eine zweite Zahl hier wiche eines Tages von der ersten ab, und dann prüfte
 * dieser Fall eine Frist, die es im Betrieb nicht gibt.
 *
 * `retry: false` bleibt: die Wiederholung ist nicht der Gegenstand dieser Fälle, und sie würde
 * Fehlerfälle nur verlangsamen.
 */
function betrieblicherClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { staleTime: ZAEHLER_FRISCHE_MS, retry: false } },
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  await i18n.changeLanguage("de");
});

async function ruhen(): Promise<void> {
  for (let i = 0; i < 12; i += 1) {
    await act(async () => {
      await new Promise((fertig) => setTimeout(fertig, 0));
    });
  }
}

async function zeigeEinstieg(mitClient?: QueryClient): Promise<void> {
  const client = mitClient ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/gesamtanweisungen"] },
        createElement(
          QueryClientProvider,
          { client },
          createElement(
            AuthProvider,
            null,
            createElement(
              RoleProvider,
              null,
              createElement(
                Routes,
                null,
                createElement(Route, {
                  path: "/gesamtanweisungen",
                  element: createElement(GesamtanweisungBereich),
                }),
                // Die Zielseite ist ABSICHTLICH nicht der Bereich selbst: so lässt sich
                // „geöffnet" von „neu gezeichnet" unterscheiden.
                createElement(Route, {
                  path: "/gesamtanweisungen/:id",
                  element: createElement("p", { "data-testid": ZIEL_MARKE }, "Ziel"),
                }),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await ruhen();
}

function marke(name: string): Element | null {
  return container.querySelector(`[data-testid="${name}"]`);
}

/** Die GEÖFFNETE Anweisung — hier steht der Vorlege-Knopf. Derselbe Client wie der Einstieg. */
async function zeigeAnweisung(id: string, mitClient: QueryClient): Promise<void> {
  await act(async () => {
    root.render(
      createElement(
        MemoryRouter,
        { initialEntries: [`/gesamtanweisungen/${id}`] },
        createElement(
          QueryClientProvider,
          { client: mitClient },
          createElement(
            AuthProvider,
            null,
            createElement(
              RoleProvider,
              null,
              createElement(
                Routes,
                null,
                createElement(Route, {
                  path: "/gesamtanweisungen/:id",
                  element: createElement(GesamtanweisungBereich),
                }),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await ruhen();
}

/**
 * Die Fläche abbauen und frisch aufsetzen — der QueryClient BLEIBT.
 *
 * GENAU DAS IST DIE LAGE, um die es geht: ein Mensch verlässt die Liste, kommt zurück, und der
 * Zwischenspeicher der Anwendung lebt weiter (er hängt am `QueryClient` in `main.tsx`, nicht am
 * gezeichneten Baum). Ein neuer Client je Rendering hätte den gemessenen Fehler nie zeigen können —
 * das ist die Prüflücke, die BEN in Runde 3 benannt hat.
 */
async function neueFlaeche(): Promise<void> {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
}

/** Tippen, wie ein Mensch tippt — React hört auf den nativen Setter plus Ereignis. */
function tippe(element: HTMLInputElement, wert: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(element, wert);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

/** Titel eintragen und absenden — über `submit`, also den Enter-Weg. */
async function legeAn(titel: string): Promise<void> {
  const feld = container.querySelector<HTMLInputElement>('input[name="titel"]');
  expect(feld, "kein Titelfeld").not.toBeNull();
  await act(async () => {
    tippe(feld as HTMLInputElement, titel);
  });
  const formular = container.querySelector<HTMLFormElement>(
    `[data-testid="${BEREICH_MARKE}-anlegen"]`,
  );
  expect(formular, "kein Anlegen-Formular").not.toBeNull();
  await act(async () => {
    (formular as HTMLFormElement).dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
  await ruhen();
}

describe("A12 · die Bestandsliste auf der Fläche", () => {
  // ==============================================================================================
  // DIE ZWEI REINEN REGELN — ohne DOM, ohne Netz, damit ihr Urteil einzeln nachlesbar ist.
  // ==============================================================================================
  it("`bestandAus` trennt UNBEKANNT von LEER — eine Antwort ohne `eintraege` ist kein leerer Bestand", () => {
    expect(bestandAus({ eintraege: [] })).toEqual([]);
    expect(bestandAus({ eintraege: [EINTRAG_A] })).toEqual([EINTRAG_A]);
    // Alles andere ist UNBEKANNT. Ein `[]` an einer dieser Stellen wäre die Behauptung „nichts
    // gespeichert" über eine Antwort, die darüber nichts sagt.
    for (const unbrauchbar of [undefined, null, {}, { eintraege: null }, { id: "a-1" }, "x", 7]) {
      expect(
        bestandAus(unbrauchbar),
        `„${JSON.stringify(unbrauchbar)}" gilt als lesbarer Bestand`,
      ).toBeUndefined();
    }
  });

  it("`juengsteAenderung` nimmt die jüngste Änderung — und über nichts sagt sie nichts", () => {
    expect(juengsteAenderung([EINTRAG_B, EINTRAG_A])).toBe(EINTRAG_A.geaendertAm);
    expect(juengsteAenderung([])).toBe("");
  });

  // ==============================================================================================
  // LAGE „STAND" — DIE ZEILEN, IN DREI SPRACHEN (Abnahmekriterium 4).
  // ==============================================================================================
  for (const sprache of SPRACHEN) {
    it(`${sprache}: je Eintrag stehen Titel, Stand, Urheber, letzte Änderung und die Zahl der Bausteine`, async () => {
      antworte(200, { eintraege: [EINTRAG_A, EINTRAG_B] });
      await act(async () => {
        await i18n.changeLanguage(sprache);
      });
      await zeigeEinstieg();

      const zeilen = container.querySelectorAll(`[data-testid="${LISTE_MARKE}-eintrag"]`);
      expect(zeilen.length, `${sprache}: die Liste zeichnet nicht zwei Zeilen`).toBe(2);
      const erste = zeilen[0] as HTMLElement;
      const inhalt = erste.textContent ?? "";

      // Der TITEL — und er ist zugleich das fokussierbare Element (siehe eigener Fall unten).
      expect(inhalt, `${sprache}: der Titel fehlt`).toContain(EINTRAG_A.titel);
      // Der STAND als übersetztes Wort, nicht als roher Schlüssel.
      expect(inhalt, `${sprache}: die Beschriftung des Stands fehlt`).toContain(
        text(sprache, "ga.liste.stand"),
      );
      expect(inhalt, `${sprache}: der Stand steht nicht in Anwendersprache`).toContain(
        text(sprache, `ga.stand.${EINTRAG_A.stand}`),
      );
      expect(inhalt, `${sprache}: der rohe Standschlüssel steht auf der Fläche`).not.toContain(
        "ga.stand.",
      );
      // URHEBER und LETZTE ÄNDERUNG, je mit ihrer übersetzten Beschriftung und ihrem Wert.
      expect(inhalt, `${sprache}: die Beschriftung „Urheber" fehlt`).toContain(
        text(sprache, "ga.liste.urheber"),
      );
      expect(inhalt, `${sprache}: der Urheber fehlt`).toContain(EINTRAG_A.urheber);
      expect(inhalt, `${sprache}: die Beschriftung „letzte Änderung" fehlt`).toContain(
        text(sprache, "ga.liste.geaendert"),
      );
      expect(inhalt, `${sprache}: die letzte Änderung fehlt`).toContain(EINTRAG_A.geaendertAm);
      // DIE ZAHL DER BAUSTEINE — und die Kennzeichnung „unvollständig" MIT ihrer Zahl.
      expect(inhalt, `${sprache}: die Zahl der Bausteine fehlt`).toContain(
        satz("ga.liste.bausteine", { anzahl: EINTRAG_A.sichtbareBausteine }),
      );
      expect(
        erste.querySelector(`[data-testid="${LISTE_MARKE}-unvollstaendig"]`)?.textContent ?? "",
        `${sprache}: die Kennzeichnung nennt die Zahl der verborgenen Bausteine nicht`,
      ).toContain(satz("ga.liste.unvollstaendig", { anzahl: EINTRAG_A.verborgeneBausteine }));

      // DER VOLLSTÄNDIGE EINTRAG TRÄGT DIE KENNZEICHNUNG NICHT — ohne diesen Satz wäre die Prüfung
      // oben auch dann grün, wenn sie an JEDER Zeile stünde.
      const zweite = zeilen[1] as HTMLElement;
      expect(
        zweite.querySelector(`[data-testid="${LISTE_MARKE}-unvollstaendig"]`),
        `${sprache}: eine vollständige Anweisung wird als unvollständig gekennzeichnet`,
      ).toBeNull();
      expect(
        zweite.textContent ?? "",
        `${sprache}: die Zahl 0 fehlt beim zweiten Eintrag`,
      ).toContain(satz("ga.liste.bausteine", { anzahl: 0 }));

      // KEIN DEUTSCHER RÜCKFALL: stünde der deutsche Satz da, wäre der Nachweis oben auch mit einer
      // nicht übersetzten Fläche grün.
      if (sprache !== "de") {
        for (const schluessel of ["ga.liste.titel", "ga.liste.urheber", "ga.liste.geaendert"]) {
          expect(
            container.textContent ?? "",
            `${sprache}: auf der Fläche steht der DEUTSCHE Text zu ${schluessel}`,
          ).not.toContain(text("de", schluessel));
        }
      }

      // UND DAS ANLEGEN STEHT WEITERHIN DARUNTER — die Liste ersetzt es nicht.
      expect(
        marke(`${BEREICH_MARKE}-anlegen`),
        `${sprache}: das Anlegen-Formular fehlt`,
      ).not.toBeNull();
    });
  }

  it("die Reihenfolge der Fläche ist die des Servers — sie wird nicht nachsortiert", async () => {
    // Die Sortierung fällt im Dienst (`GesamtanweisungDienst.auflisten`). Eine zweite Sortierung
    // hier wäre die zweite Wahrheit, und ein Tastaturweg „zum zweiten Eintrag" wäre dann nicht mehr
    // wiederholbar. Gemessen wird mit einer Reihenfolge, die KEINER Regel entspricht.
    antworte(200, { eintraege: [EINTRAG_B, EINTRAG_A] });
    await zeigeEinstieg();
    const kennungen = [...container.querySelectorAll(`[data-testid="${LISTE_MARKE}-eintrag"]`)].map(
      (el) => el.getAttribute("data-anweisung"),
    );
    expect(kennungen).toEqual([EINTRAG_B.id, EINTRAG_A.id]);
  });

  // ==============================================================================================
  // DIE ZEILE IST BEDIENBAR — EIN ECHTER LINK MIT DER ADRESSE DIESER ANWEISUNG.
  // ==============================================================================================
  it("jede Zeile trägt GENAU EIN fokussierbares Element: einen Link auf /gesamtanweisungen/<id>", async () => {
    antworte(200, { eintraege: [EINTRAG_A, EINTRAG_B] });
    await zeigeEinstieg();
    for (const eintrag of [EINTRAG_A, EINTRAG_B]) {
      const zeile = container.querySelector(
        `[data-testid="${LISTE_MARKE}-eintrag"][data-anweisung="${eintrag.id}"]`,
      );
      expect(zeile, `die Zeile zu ${eintrag.id} fehlt`).not.toBeNull();
      // EIN Element, nicht zwei: zwei Ziele für eine Handlung wären zwei Tab-Stopps je Zeile, und
      // ein Bildschirmleser läse den zweiten ohne zu sagen, wohin er führt.
      const fokussierbar = (zeile as Element).querySelectorAll("a[href], button, [tabindex]");
      expect(
        fokussierbar.length,
        `die Zeile zu ${eintrag.id} hat ${fokussierbar.length} fokussierbare Elemente`,
      ).toBe(1);
      const link = fokussierbar[0] as HTMLAnchorElement;
      expect(link.tagName, "das fokussierbare Element ist kein Link").toBe("A");
      expect(
        link.getAttribute("href"),
        `der Link zu ${eintrag.id} zeigt nicht auf seine Anweisung`,
      ).toBe(`/gesamtanweisungen/${eintrag.id}`);
      // KEIN NACHGEBAUTER TASTENBEHANDLER: ein `tabindex` am Link wäre der Anfang davon.
      expect(
        link.hasAttribute("tabindex"),
        `der Link zu ${eintrag.id} trägt ein eigenes tabindex — die Reihenfolge des Dokuments trägt ihn schon`,
      ).toBe(false);
      // Der Link TRÄGT DEN TITEL: ein Link, der „öffnen" heisst, sagt nicht, was er öffnet.
      expect(link.textContent ?? "").toContain(eintrag.titel);
    }
  });

  // ==============================================================================================
  // LAGE „LEER" (Abnahmekriterium 4) — EIN HINWEISSATZ STATT NICHTS.
  // ==============================================================================================
  for (const sprache of SPRACHEN) {
    it(`${sprache}: eine erfolgreiche LEERE Antwort zeigt einen Hinweissatz, nicht eine leere Fläche`, async () => {
      antworte(200, { eintraege: [] });
      await act(async () => {
        await i18n.changeLanguage(sprache);
      });
      await zeigeEinstieg();
      const leer = marke(`${LISTE_MARKE}-leer`);
      expect(leer, `${sprache}: der Hinweissatz zum leeren Bestand fehlt`).not.toBeNull();
      const soll = text(sprache, "ga.liste.leer");
      expect(soll.length, `${sprache}: der Leersatz fehlt im Sprachbestand`).toBeGreaterThan(0);
      expect((leer as Element).textContent).toContain(soll);
      // UND KEIN FEHLERSATZ: eine erfolgreiche Antwort ist kein Ausfall.
      expect(
        marke(`${LISTE_MARKE}-fehler`),
        `${sprache}: neben dem Leersatz steht ein Fehler`,
      ).toBeNull();
      expect(
        container.querySelectorAll(`[data-testid="${LISTE_MARKE}-eintrag"]`).length,
        `${sprache}: es werden Zeilen gezeichnet, obwohl die Antwort leer war`,
      ).toBe(0);
    });
  }

  // ==============================================================================================
  // LAGE „FEHLER" — DIE GEFÄHRLICHSTE VERWECHSLUNG DIESER LIEFERUNG, BEIDE URSACHEN.
  // ==============================================================================================
  it("eine ABGELEHNTE Antwort zeigt einen Fehlersatz und AUSDRÜCKLICH NICHT den Leersatz", async () => {
    antworte(500, { error: "ERROR", message: "kaputt" });
    await zeigeEinstieg();
    const fehler = marke(`${LISTE_MARKE}-fehler`);
    expect(fehler, "der Fehlersatz fehlt").not.toBeNull();
    expect((fehler as Element).textContent).toContain(text("de", "ga.liste.fehler"));
    expect(
      (fehler as Element).getAttribute("role"),
      "ohne role=alert liest ein Screenreader ihn nicht",
    ).toBe("alert");
    expect(
      container.textContent ?? "",
      "bei einem Ausfall steht der Leersatz da — der Mensch legt dann alles ein zweites Mal an",
    ).not.toContain(text("de", "ga.liste.leer"));
    expect(marke(`${LISTE_MARKE}-leer`)).toBeNull();
  });

  it("eine GELUNGENE Antwort OHNE `eintraege` ist ebenfalls ein Fehler und nicht ein leerer Bestand", async () => {
    // DIE ZWEITE URSACHE, und sie ist die heimtückischere: Status 200, `ok: true`, brauchbares JSON —
    // nur ohne Bestand darin. Ein `?? []` in der Fläche zeigte hier den Leersatz.
    antworte(200, { id: "ga-1", titel: "keine Liste" });
    await zeigeEinstieg();
    expect(
      marke(`${LISTE_MARKE}-fehler`),
      "eine Antwort ohne Bestand gilt als gültig",
    ).not.toBeNull();
    expect(
      marke(`${LISTE_MARKE}-leer`),
      "eine unbrauchbare Antwort wird als leer ausgegeben",
    ).toBeNull();
    expect(container.textContent ?? "").not.toContain(text("de", "ga.liste.leer"));
  });

  it("solange geladen wird, steht KEIN Wort über den Bestand da", async () => {
    antworteNie();
    await zeigeEinstieg();
    const laedt = marke(`${LISTE_MARKE}-laedt`);
    expect(laedt, "die Ladefläche der Liste fehlt").not.toBeNull();
    expect((laedt as Element).textContent).toContain(text("de", "ga.liste.laedt"));
    for (const verboten of ["ga.liste.leer", "ga.liste.fehler"]) {
      expect(
        container.textContent ?? "",
        `während des Ladens steht schon ein Urteil über den Bestand da (${verboten})`,
      ).not.toContain(text("de", verboten));
    }
    // Das Anlegen ist davon UNBERÜHRT: es hängt an keinem Bestand.
    const knopf = container.querySelector<HTMLButtonElement>(
      `[data-testid="${BEREICH_MARKE}-anlegen"] button[type="submit"]`,
    );
    expect(knopf, "das Anlegen-Formular fehlt, solange die Liste lädt").not.toBeNull();
  });

  // ==============================================================================================
  // DER EINSTIEG BEHAUPTET NICHTS ÜBER DEN BESTAND, WENN ER IHN NICHT KENNT (A4, weitergeführt).
  // ==============================================================================================
  it("ohne Netz steht keine Bestandsaussage da — und das Anlegen bleibt bedienbar", async () => {
    wirf();
    await zeigeEinstieg();
    const inhalt = (container.textContent ?? "").toLowerCase();
    for (const unbelegt of ["keine gesamtanweisung", "noch nichts angelegt", "0 anweisungen"]) {
      expect(inhalt, `unbelegte Bestandsaussage: ${unbelegt}`).not.toContain(unbelegt);
    }
    expect(inhalt, "der Leersatz steht ohne Datengrundlage da").not.toContain(
      text("de", "ga.liste.leer").toLowerCase(),
    );
    expect(marke(`${LISTE_MARKE}-fehler`), "der Ausfall wird gar nicht benannt").not.toBeNull();
    // DER AUSFALL DER LISTE SPERRT DAS ANLEGEN NICHT: Feld bedienbar, Formular da. Der Knopf selbst
    // ist hier aus einem ANDEREN Grund noch tot (leerer Titel) — das wird deshalb nicht als Beleg
    // benutzt, sondern das Feld, an dem der Mensch anfängt.
    const feld = container.querySelector<HTMLInputElement>('input[name="titel"]');
    expect(feld, "das Titelfeld fehlt").not.toBeNull();
    expect(feld?.disabled, "ein Ausfall der Liste sperrt das Titelfeld").toBe(false);
    expect(marke(`${BEREICH_MARKE}-anlegen`), "das Anlegen-Formular fehlt").not.toBeNull();
  });

  // ==============================================================================================
  // JOB 4357 R4 · DER ZWISCHENSPEICHER — BENs KORREKTURPFLICHT 2, AN DER BETRIEBLICHEN FRIST.
  // ==============================================================================================
  //
  // DIE FEHLERKLASSE, gemessen von BEN am unveränderten Produkt der Runde 3 (Cloud-Auftrag
  // 223078d8e968459f9f0b25d0bf34de18): leere Liste → bestätigte Anlage → sofortige Rückkehr →
  // „Eintrag fehlt, Leersatz bleibt", `BEN_CACHE: gespeichert=true, Listenabrufe=1`.
  //
  // Der Grund war eine ANNAHME in `hooks.ts`: „react-query holt sie beim nächsten Aufbau ohnehin
  // neu." Das stimmt nur ohne Frist. Der Betrieb fährt `staleTime: ZAEHLER_FRISCHE_MS` (30 s,
  // `main.tsx:44`); ein abgebauter Eintrag bleibt bis `gcTime` liegen und gilt beim nächsten Aufbau
  // noch als frisch. Die Fläche zeichnet dann den ALTEN, leeren Bestand — und sagt dem Menschen
  // „Es ist bisher nichts gespeichert", unmittelbar nachdem er gespeichert hat.
  //
  // WARUM DIESE FÄLLE AM CLIENT HÄNGEN UND NICHT AM ROUTER: der Zwischenspeicher lebt im
  // `QueryClient`, nicht im gezeichneten Baum. Deshalb bauen sie die Fläche ab (`neueFlaeche`) und
  // setzen sie mit DEMSELBEN Client neu auf — genau der Weg, den ein Mensch geht, wenn er die Liste
  // verlässt und zurückkommt. Ein frischer Client je Rendering (Runde 3) konnte den Fehler baulich
  // nicht sehen.
  //
  // UND DER SERVER ÄNDERT SICH WIRKLICH (`serviere`): `abrufe.liste` belegt, dass ein ZWEITES Mal
  // gelesen wurde. Ohne diese Zahl wäre „der Eintrag steht da" auch dann grün, wenn die Antwort von
  // Anfang an beide Einträge getragen hätte.
  it("nach bestätigter Anlage und sofortiger Rückkehr steht die Anweisung in der Liste — nicht der Leersatz", async () => {
    const zustand: Serverzustand = { bestand: [], abrufe: { liste: 0 } };
    serviere(zustand);
    const client = betrieblicherClient();

    // 1. DER AUSGANGSSTAND: erfolgreich geladen und wirklich leer — der Leersatz steht zu Recht da.
    await zeigeEinstieg(client);
    expect(
      marke(`${LISTE_MARKE}-leer`),
      "der Ausgangsstand ist nicht der leere Bestand",
    ).not.toBeNull();
    expect(zustand.abrufe.liste, "die Liste wurde beim ersten Aufbau nicht geholt").toBe(1);

    // 2. ANLEGEN — bestätigt vom Server, und der Bestand hat sich WIRKLICH geändert.
    await legeAn("Anlage anfahren (R4)");
    expect(
      zustand.bestand.map((e) => e.titel),
      "der Server hat nichts angelegt",
    ).toEqual(["Anlage anfahren (R4)"]);
    expect(
      marke(ZIEL_MARKE),
      "die Fläche ist nach der Anlage nicht weitergesprungen",
    ).not.toBeNull();

    // 3. DIE RÜCKKEHR: neue Fläche, DERSELBE Client — wie beim Verlassen und Wiederkommen.
    await neueFlaeche();
    await zeigeEinstieg(client);

    expect(
      zustand.abrufe.liste,
      "die Liste wurde nach der Anlage kein zweites Mal geholt — der Zwischenspeicher gilt noch als frisch",
    ).toBeGreaterThan(1);
    expect(
      marke(`${LISTE_MARKE}-leer`),
      "nach der bestätigten Anlage steht der Leersatz da — der Mensch legt dann alles ein zweites Mal an",
    ).toBeNull();
    const zeilen = container.querySelectorAll(`[data-testid="${LISTE_MARKE}-eintrag"]`);
    expect(zeilen.length, "die angelegte Anweisung fehlt in der Liste").toBe(1);
    expect((zeilen[0] as HTMLElement).textContent ?? "").toContain("Anlage anfahren (R4)");
  });

  it("nach einer Statusänderung zeigt die Liste den NEUEN Stand — nicht den von vorhin", async () => {
    // DIE ZWEITE HÄLFTE VON BENs KORREKTURPFLICHT 2 („Statusänderungen entsprechend absichern").
    // Sie ist leiser als der falsche Leersatz und derselbe Fehler: die Liste zeigte „Entwurf", wo
    // der Mensch gerade „Vorgelegt" gemacht hat.
    const zustand: Serverzustand = {
      bestand: [{ ...EINTRAG_B, stand: "entwurf", sichtbareBausteine: 1 }],
      abrufe: { liste: 0 },
    };
    serviere(zustand);
    const client = betrieblicherClient();

    // 1. DER AUSGANGSSTAND auf der Liste: „Entwurf", sichtbar gelesen.
    await zeigeEinstieg(client);
    expect(
      marke(`${LISTE_MARKE}-stand`)?.textContent ?? "",
      "der Ausgangsstand der Liste ist nicht der Entwurf",
    ).toContain(text("de", "ga.stand.entwurf"));

    // 2. AUF DER ANWEISUNG VORLEGEN — derselbe Client, echter Knopf.
    await neueFlaeche();
    await zeigeAnweisung(EINTRAG_B.id, client);
    const vorlegen = container.querySelector<HTMLButtonElement>(
      '[data-testid="ga-entscheidung-vorlegen"]',
    );
    expect(vorlegen, "der Vorlege-Knopf fehlt").not.toBeNull();
    expect(
      vorlegen?.disabled,
      "der Vorlege-Knopf ist gesperrt — dann misst dieser Fall nichts",
    ).toBe(false);
    await act(async () => {
      (vorlegen as HTMLButtonElement).dispatchEvent(new Event("click", { bubbles: true }));
    });
    await ruhen();
    expect(
      zustand.bestand[0]?.stand,
      "der Server hat den Stand nicht geändert — dann sagt der Rest nichts",
    ).toBe("vorgelegt");

    // 3. DIE RÜCKKEHR AUF DIE LISTE: sie muss den NEUEN Stand nennen.
    await neueFlaeche();
    await zeigeEinstieg(client);
    expect(
      marke(`${LISTE_MARKE}-stand`)?.textContent ?? "",
      "die Liste zeigt nach dem Vorlegen weiterhin den alten Stand",
    ).toContain(text("de", "ga.stand.vorgelegt"));
    expect(
      marke(`${LISTE_MARKE}-stand`)?.textContent ?? "",
      "der alte Stand steht noch daneben",
    ).not.toContain(text("de", "ga.stand.entwurf"));
  });

  // ==============================================================================================
  // DIE GEÖFFNETE ANWEISUNG ZEIGT DIE LISTE NICHT — eine Adresse, ein Zustand.
  // ==============================================================================================
  it("`/gesamtanweisungen/:id` zeigt keine Bestandsliste", async () => {
    // HIER ANTWORTET EIN LESESTAND UND KEINE LISTE, und das ist kein Detail: die geöffnete Anweisung
    // ruft `GET /api/gesamtanweisungen/:id`, und derselbe `fetch` bedient jeden Aufruf dieses Falls.
    // Eine Listenantwort auf dem Lesepfad wäre ein Prüfstandfehler — sie sagte über die Frage dieses
    // Falls nichts und brächte nur `GesamtanweisungSeite` durcheinander.
    antworte(200, {
      id: "ga-1",
      titel: EINTRAG_A.titel,
      zweck: "",
      geltungsbereich: "",
      voraussetzungen: "",
      stand: "entwurf",
      version: 1,
      urheber: EINTRAG_A.urheber,
      erstelltAm: EINTRAG_A.erstelltAm,
      geaendertAm: EINTRAG_A.geaendertAm,
      bausteine: [],
      unvollstaendig: false,
      verborgeneBausteine: 0,
      pruefanbindung: "nicht_angebunden",
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => {
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ["/gesamtanweisungen/ga-1"] },
          createElement(
            QueryClientProvider,
            { client },
            createElement(
              AuthProvider,
              null,
              createElement(
                RoleProvider,
                null,
                createElement(
                  Routes,
                  null,
                  createElement(Route, {
                    path: "/gesamtanweisungen/:id",
                    element: createElement(GesamtanweisungBereich),
                  }),
                ),
              ),
            ),
          ),
        ),
      );
    });
    await ruhen();
    expect(marke(`${BEREICH_MARKE}-anweisung`), "die geöffnete Anweisung fehlt").not.toBeNull();
    expect(marke(LISTE_MARKE), "die Bestandsliste steht auf der geöffneten Anweisung").toBeNull();
  });
});
