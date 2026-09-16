// @vitest-environment jsdom
/// <reference path="./react-dom-flushsync.d.ts" />
// ================================================================================================
// JOB 4145 · WIKI-ORIENTIERUNG — DIE GLIEDERUNG IN DER LESESPALTE, UND DASS SIE WIRKLICH TRIFFT.
// ================================================================================================
//
// DER GEMESSENE AUSGANGSZUSTAND (am main `9ca774f` gelesen): die Lesespalte zeichnet den Fliesstext
// als einen durchgehenden Block (`BibliothekLesen.tsx`, `[data-testid="bib-text"]`). Die drei
// Sprungknoepfe am Kopf (`bib-kopf-spruenge`) fuehren zu Quellen, Originaldatei und Anhaengen —
// KEINER fuehrt in den Text. Wer in einer langen Prozessbeschreibung den dritten Abschnitt sucht,
// scrollt.
//
// WAS HIER GEMESSEN WIRD: die gemountete ECHTE Lesefläche ueber die echte Route `/wissen/:id`
// (`KnowledgeDetail` → `BibliothekFlaeche` → `BibliothekLesen`), mit stillgelegter HTTP-Grenze
// (Bauform aus `tests/berichtskopf-spruenge/kopf-fuehrt-zu-quellen-und-anhaengen.test.tsx`).
// Nichts an der Fläche ist nachgebaut.
//
// DIE ZUSAGE, AN DER ALLES HAENGT — und sie ist leicht zu uebersehen:
//
//     JEDER Eintrag der Gliederung muss GENAU SEIN Ueberschriftenelement im Lesetext treffen.
//
// Zweimal ist sie gebrochen, und beide Male an derselben Naht: die Leiste ZAEHLTE eine
// Textauswertung (R1 den HTML-String, R2 `innerHTML`), der Sprung traf ein DOM-Element. Wo der
// Browser anders zaehlt als die Regex — verschachtelte Ueberschriften —, sprang der Knopf auf den
// falschen Abschnitt, und zwar STILL: es sah aus, als haette die Leiste funktioniert. Seit R3 gibt
// es diese Naht nicht mehr: die Marken kommen aus `querySelectorAll` ueber den gerenderten
// Inhaltscontainer, und das Sprungziel IST die Elementreferenz.
//
// Dieser Prüfstand misst deshalb konsequent ueber ELEMENTIDENTITAET (`toBe`), nie ueber
// Textgleichheit, und zaehlt die Ueberschriften des Baums unabhaengig vom Produkt nach — einmal mit
// einer EIGENEN Regex am Quelltext (O1), sonst direkt am gemounteten Baum (`ueberschriften()`).
//
// BENANNTE PRÜFLÜCKE (O5): jsdom fuehrt fuer einen nativen `<button>` KEINE Vorgabehandlung auf
// `keydown` aus — ein hier abgeschicktes `Enter` bewirkt nichts, und ein Fall, der das dennoch
// behauptete, waere eine Luege ueber den Prüfstand. O5 misst deshalb, wie `kopf-fuehrt-zu-quellen-
// und-anhaengen.test.tsx` (A4) es fuer die Kopfknoepfe tut, die zwei Haelften, die zusammen die
// Tastaturbedienbarkeit tragen: (1) das Ziel ist ein echter `<button>` in der Tabulatorreihenfolge,
// VOR dem Fliesstext, den nichts im Pfad ausnimmt, und (2) seine AKTIVIERUNG — genau das, was der
// Browser aus `Enter` macht — springt und setzt den Fokus auf die Ueberschrift. Dass Chromium
// `Enter` wirklich in diese Aktivierung uebersetzt, ist hier NICHT gemessen.
//
// WAS SEIT R3 KEINE PRÜFLÜCKE MEHR IST (bis R2 stand hier eine): der CLIENT-Sanitizer bildet
// `h1 → h2` und `h4/h5/h6 → h3` ab (`apps/web/src/lib/richText.ts:51-57`). Solange die Leiste den
// ROHEN Quelltext las, zaehlte sie solche Ueberschriften nicht mit und verschob jedes folgende
// Sprungziel. Am gerenderten Baum gelesen ist die Frage gegenstandslos — V3 misst genau das.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  /** Das `bodyHtml` des Wissensobjekts — je Fall gesetzt. */
  bodyHtml: "",
  /** Die Lesevariante, die der Server liefert. `null` = es gibt keine (404 NO_LESEVARIANTE). */
  variante: null as null | { originalLanguage: string; title: string; bodyHtml: string },
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Eva", email: "e@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", async () => {
  // Der ECHTE Fehlertyp des Clients: „es gibt keine Uebersetzung" haengt an seinem `code`, und ein
  // nachgebauter Fehler pruefte diese Unterscheidung nicht (s. `useFrischeLesevariante`).
  const { ApiError: Fehler } = await import("../../apps/web/src/api/client");
  const leer = vi.fn(async () => []);
  return {
    endpoints: {
      ko: {
        get: vi.fn(async () => globalThis.__job4145Ko),
        list: vi.fn(async () => [globalThis.__job4145Ko]),
        versions: leer,
        evidence: leer,
        neighbors: vi.fn(async () => ({
          center: "ko-1",
          neighbors: [],
          excludedTags: [],
          limit: 8,
        })),
        act: vi.fn(async () => globalThis.__job4145Ko),
      },
      lesevarianten: {
        uebersicht: vi.fn(async (lang: string) => ({ lang, eintraege: [] })),
        fuerKo: vi.fn(async (koId: string, lang: string) => {
          if (!box.variante) {
            throw new Fehler(404, "NO_LESEVARIANTE", "Keine Lesevariante in dieser Sprache.");
          }
          return {
            koId,
            lang,
            originalLanguage: box.variante.originalLanguage,
            title: box.variante.title,
            statement: "Uebersetzte Kernaussage.",
            bodyHtml: box.variante.bodyHtml,
            herkunft: "lokale Lieferung job4145-v1",
            status: "draft_translation_not_business_approval",
            originalGeaendert: false,
            quellabgleich: "bestaetigt",
            sourceBodySha256: null,
            originalSha256: "a".repeat(64),
            uebersetzungSha256: "b".repeat(64),
            updatedAt: "2026-09-08T12:00:00.000Z",
          };
        }),
      },
      // Die Bibliothek links sucht ueber die Suchprojektion; ihre Menge ist hier derselbe eine
      // Eintrag. An der Suche selbst aendert dieser Auftrag nichts (Auftrag §10).
      library: { search: vi.fn(async () => [globalThis.__job4145Ko]) },
      conflicts: { list: leer },
      duplicateSignal: { list: leer },
      audit: { list: leer },
      directory: { list: vi.fn(async () => [{ id: "u1", name: "Eva" }]) },
      lifecycle: { pending: leer, linked: leer },
      external: { policy: vi.fn(async () => ({ stage: "blocked", enabled: false })) },
      objects: { upload: vi.fn(async () => ({ id: "obj-1", size: 1 })) },
      uploadLimits: {
        get: vi.fn(async () => ({ maxAttachments: 8, maxAttachmentBytes: 20000000 })),
      },
      reasoner: {
        status: vi.fn(async () => ({ active: false, mode: "off" })),
        config: vi.fn(async () => null),
        assist: vi.fn(async () => ({ text: "" })),
        assistPresets: leer,
        extract: vi.fn(async () => ({ points: [], note: null })),
        describeImage: vi.fn(async () => ({})),
      },
      aiCheck: { coverageSummary: vi.fn(async () => ({ total: 0 })) },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { flushSync } from "../../apps/web/node_modules/react-dom";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";
import { Library } from "../../apps/web/src/pages/Library";
// R2: der ECHTE Server-Sanitizer. Er belegt, dass BENs Gegenbeispiel wirklich gespeichert werden
// kann — ohne ihn waere V0 eine Behauptung ueber den Server statt einer Messung an ihm.
import { sanitizeHtml as serverSanitize } from "../../services/structure";

declare global {
  // eslint-disable-next-line no-var
  var __job4145Ko: KnowledgeObject;
}

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * `scrollIntoView` fehlt in jsdom. Statt sie stillzulegen, wird das ZIEL mitgeschrieben — die Frage
 * dieses Prüfstands ist nicht „wurde gesprungen", sondern WOHIN (Muster: `d44-sprung-mounted:41`).
 */
let sprungZiele: HTMLElement[] = [];
(Element.prototype as unknown as { scrollIntoView: (this: HTMLElement) => void }).scrollIntoView =
  function scrollIntoViewStub(this: HTMLElement): void {
    sprungZiele.push(this);
  };

/**
 * Zaehlt die Ueberschriften so, wie der Browser sie zaehlen wuerde — schlicht ueber die Tags.
 * Bewusst NICHT mit der Regex des Produkts: sonst pruefte der Test seine eigene Annahme.
 */
function wieDerBrowserZaehlt(html: string): number {
  return (html.match(/<h[23]\b/gi) ?? []).length;
}

/** Eine lange Prozessbeschreibung: drei Ueberschriften, dazwischen mehrere Bildschirmhoehen. */
const LANGER_TEXT = [
  "<h2>Zweck und Geltungsbereich</h2>",
  "<p>Die Anweisung gilt fuer alle Linien.</p>".repeat(40),
  "<h2>Ablauf der Pruefung</h2>",
  "<p>Die Pruefung folgt der Reihe nach.</p>".repeat(40),
  "<h3>Wiederholungspruefung</h3>",
  "<p>Nach jeder Beanstandung.</p>".repeat(40),
].join("");

/** Der Fall aus D44 M4: eine LEERE Ueberschrift dazwischen, die im DOM mitzaehlt. */
const TEXT_MIT_LEERER = [
  "<h2>Eins</h2>",
  "<p>a</p>".repeat(20),
  "<h3></h3>",
  "<p>b</p>".repeat(20),
  "<h2>Drei</h2>",
  "<p>c</p>".repeat(20),
].join("");

/** Ein Dokument ohne jede Ueberschrift — hier darf NICHTS behauptet werden. */
const TEXT_OHNE_UEBERSCHRIFT = "<p>Ein durchgehender Absatz ohne Gliederung.</p>".repeat(40);

// ================================================================================================
// R4 · BENS DRITTES GEGENBEISPIEL — DERSELBE TEXT, EIN ANDERER BAUM.
// ================================================================================================
//
// BEN-PRUEFUNG-JOB-4145-D3, Korrekturpflicht 1. Original und Uebersetzung DUERFEN denselben
// Fliesstext haben — nichts verbietet es, und beim Umschalten passiert dann genau das, was keine
// String-Betrachtung sehen kann: der HTML-String bleibt Zeichen fuer Zeichen gleich, aber React
// baut den Teilbaum neu (die beiden Zweige `gelesen ? … : …` haben verschiedene Bauteiltypen). Die
// in Runde 3 gespeicherten Elementreferenzen zeigten danach auf abgehaengte Knoten, und `isConnected`
// machte JEDEN Knopf der Leiste wirkungslos — ein stiller Totalausfall.
const GLEICHER_TEXT_BEIDE = [
  "<h2>DIN 123</h2>",
  "<p>Absatz zur Norm.</p>".repeat(20),
  "<h2>Abnahme</h2>",
  "<p>Absatz zur Abnahme.</p>".repeat(20),
].join("");

// ================================================================================================
// R2 · BENS GEGENBEISPIEL — VERSCHACHTELTE UEBERSCHRIFTEN, DIE DER SERVER DURCHLAESST.
// ================================================================================================
//
// BEN-PRUEFUNG-JOB-4145-D1, Korrekturpflicht 1. Der Eingang kommt NICHT aus der Luft: `V0` unten
// laesst ihn durch den ECHTEN Server-Sanitizer (`services/structure`) laufen und zeigt, dass die
// Verschachtelung dort stehen bleibt. Der BROWSER kann Ueberschriften dagegen nicht schachteln —
// er schliesst die erste beim Lesen der zweiten und hat DREI im Baum. Die Regex von
// `d44Gliederung` schliesst am ERSTEN `</h2>` und zaehlt am String ZWEI. Genau diese Differenz
// machte in Runde 1 den Knopf „Drei" still auf „Zwei" zeigen.
const VERSCHACHTELT = [
  "<h2>Eins<h2>Zwei</h2>",
  "<p>Absatz zwischen den Abschnitten.</p>".repeat(20),
  "<h2>Drei</h2>",
  "<p>Absatz am Ende.</p>".repeat(20),
].join("");

// ================================================================================================
// R3 · BENS ZWEITES GEGENBEISPIEL — DIE VERSCHACHTELUNG, DIE DER BROWSER NICHT AUFLOEST.
// ================================================================================================
//
// BEN-PRUEFUNG-JOB-4145-D2, Korrekturpflicht 1. Der Unterschied zu `VERSCHACHTELT` ist EIN Tag und
// er entscheidet alles: der Browser schliesst eine offene Ueberschrift nur, wenn sie das AKTUELLE
// Element ist. Steht `<strong>` dazwischen, greift die Regel NICHT — die Verschachtelung bleibt im
// Baum stehen, und `innerHTML` gibt sie genau so zurueck. Deshalb hat Runde 2 hier wieder falsch
// gezaehlt: DREI Ueberschriftenelemente, aber nur ZWEI Eintraege.
const VERSCHACHTELT_IM_STARK = [
  "<h2>Eins<strong><h2>Zwei</h2></strong></h2>",
  "<p>Absatz zwischen den Abschnitten.</p>".repeat(20),
  "<h2>Drei</h2>",
  "<p>Absatz am Ende.</p>".repeat(20),
].join("");

/**
 * R2 · Ueberschriften, die der CLIENT-Sanitizer abbildet: `h1 → h2`, `h4/h5/h6 → h3`
 * (`lib/richText.ts:51-57`). Am HTML-String gezaehlt waeren es NULL Eintraege (`<h1>` ist kein
 * `<h2>`), im Baum stehen ZWEI. Das ist die zweite Luecke, die Runde 1 nur benannt hatte.
 */
const ABGEBILDETE_EBENEN = [
  "<h1>Oben</h1>",
  "<p>Text unter der ersten Ueberschrift.</p>".repeat(20),
  "<h4>Unten</h4>",
  "<p>Text unter der zweiten Ueberschrift.</p>".repeat(20),
].join("");

/** Der Bildanker der Galerie (Fussnoten-Vertrag, `lib/bodyImages.ts`). */
const BILD_SRC = "data:image/png;base64,iVBORw0KGgo=";
/** Tabelle UND verankertes Bild neben den Ueberschriften — der Regressionsfall O8. */
const TEXT_MIT_TABELLE_UND_BILD = [
  "<h2>Kennzahlen</h2>",
  "<table><tbody><tr><td>Takt</td><td>12 s</td></tr></tbody></table>",
  "<h3>Zeichnung</h3>",
  `<figure data-image-id="bild-1"><img src="${BILD_SRC}" data-image-id="bild-1" alt="Zeichnung"><figcaption data-image-id="bild-1">Zeichnung der Zone</figcaption></figure>`,
].join("");

function ko(bodyHtml: string): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Reinigung Spritzzone Linie 3",
    statement: "Die Spritzzone wird nach jeder Schicht nass gereinigt.",
    bodyHtml,
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Produktion",
    tags: [],
    confidence: 80,
    trust: 80,
    status: "validiert",
    version: 1,
    author: "u1",
    originalAuthor: "u1",
    neededValidations: 2,
    assignments: [],
    asset: null,
    history: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    comments: [],
    sources: [],
    attachments: [],
  } as KnowledgeObject;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/**
 * Die Fläche unter ihrer Hülle montieren. `adresse` entscheidet, WELCHEN Weg ein Mensch geht:
 *
 *   `/wissen/ko-1`  — die Detailroute. Dort steht die Übersetzungskarte ÜBER der Fläche
 *                     (`pages/KnowledgeDetail.tsx`), und die Lesespalte zeigt darum immer das
 *                     ORIGINAL (`BibliothekFlaeche.tsx:1930` setzt `lesevarianteSchonGesagt`).
 *   `/bibliothek`   — die Bibliothek. Nur HIER traegt die Lesespalte die uebersetzte Lesart selbst
 *                     — der Fall, den Lieferung 1 meint und den O6 misst.
 */
/**
 * Der Baum, den die Fläche braucht — als eigene Funktion, weil Y1 ihn OHNE `act` zeichnen muss
 * (der Grund steht dort).
 */
function baum(adresse: string): ReturnType<typeof createElement> {
  return createElement(
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
              { initialEntries: [adresse] },
              createElement(
                Routes,
                null,
                createElement(Route, {
                  path: "/wissen/:id",
                  element: createElement(KnowledgeDetail),
                }),
                createElement(Route, {
                  path: "/bibliothek",
                  element: createElement(Library),
                }),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

async function mountAn(adresse: string): Promise<void> {
  globalThis.__job4145Ko = ko(box.bodyHtml);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(baum(adresse));
    await flush();
  });
  await act(flush);
  await act(flush);
}

const mount = (): Promise<void> => mountAn("/wissen/ko-1");

/**
 * Abbauen und mit einem ANDEREN `bodyHtml` neu montieren. Der Vorrat wird dabei verworfen: mit
 * `staleTime: Infinity` liefert derselbe `QueryClient` sonst den zuerst geholten Eintrag zurueck,
 * und der Fall maesse den alten Text unter neuem Namen (hier gemessen, Lauf 317d8b4c).
 */
async function neuMontierenMit(bodyHtml: string): Promise<void> {
  act(() => root.unmount());
  container.remove();
  qc.clear();
  box.bodyHtml = bodyHtml;
  await mount();
}

function el(testId: string): HTMLElement {
  const treffer = container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  if (!treffer) {
    throw new Error(`„${testId}" fehlt auf der Lesefläche`);
  }
  return treffer;
}

/**
 * Die Ueberschriften, die im LESETEXT stehen — die Menge, die die Leiste treffen muss.
 *
 * ALLE sechs Ebenen, nicht nur h2/h3: der Prüfstand zaehlt hier BREITER als das Produkt, damit eine
 * Ueberschrift, die im Baum steht und in der Leiste fehlt, auffaellt statt mitgezaehlt zu werden.
 */
function ueberschriften(): HTMLElement[] {
  return [...el("bib-text").querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6")];
}

/** Die Knoepfe der Gliederung, in ihrer Reihenfolge. */
function eintraege(): HTMLButtonElement[] {
  return [...el("bib-gliederung").querySelectorAll<HTMLButtonElement>("button")];
}

const text = (e: Element): string => (e.textContent ?? "").replace(/\s+/g, " ").trim();

async function klick(ziel: HTMLElement): Promise<void> {
  await act(async () => {
    ziel.click();
    await flush();
  });
  await act(flush);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.bodyHtml = LANGER_TEXT;
  box.variante = null;
  sprungZiele = [];
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  qc.clear();
  vi.clearAllMocks();
});

describe("JOB 4145 · WIKI-ORIENTIERUNG — die Gliederung steht in der Lesespalte und trifft", () => {
  it("O1 · so viele Eintraege, wie der Text Ueberschriften hat — unabhaengig nachgezaehlt", async () => {
    await mount();
    // Ohne diese Zeile waere der ganze Auftrag gegenstandslos: der Text IST lang.
    expect(text(el("bib-text")).length).toBeGreaterThan(2000);
    const erwartet = wieDerBrowserZaehlt(LANGER_TEXT);
    expect(erwartet, "die Vorlage traegt gar keine Ueberschriften").toBe(3);
    // Die eigene Zaehlung, das DOM und die Leiste sagen dasselbe.
    expect(ueberschriften()).toHaveLength(erwartet);
    expect(eintraege()).toHaveLength(erwartet);
    expect(eintraege().map((k) => text(k))).toEqual([
      "Zweck und Geltungsbereich",
      "Ablauf der Pruefung",
      "Wiederholungspruefung",
    ]);
  });

  it("O2 · Klick auf Eintrag 2 landet auf der ZWEITEN Ueberschrift — dasselbe Element", async () => {
    // Der Kern. `toBe` und nicht `toEqual`: es geht um Elementidentitaet, nicht um gleichen Text.
    await mount();
    await klick(eintraege()[1] as HTMLButtonElement);
    expect(sprungZiele).toHaveLength(1);
    expect(sprungZiele[0]).toBe(ueberschriften()[1]);
    expect(sprungZiele[0]?.textContent).toBe("Ablauf der Pruefung");
    expect(document.activeElement, "der Fokus liegt nicht auf der Ueberschrift").toBe(
      ueberschriften()[1],
    );
  });

  it("O3 · eine LEERE Ueberschrift dazwischen verschiebt das Ziel nicht", async () => {
    box.bodyHtml = TEXT_MIT_LEERER;
    await mount();
    // Kalibrierung: die leere Ueberschrift steht wirklich im DOM (der Sanitizer wirft sie nicht weg).
    expect(ueberschriften()).toHaveLength(wieDerBrowserZaehlt(TEXT_MIT_LEERER));
    expect(ueberschriften()).toHaveLength(3);
    expect(ueberschriften()[1]?.textContent).toBe("");
    // Sie erscheint NICHT in der Leiste — sie ist kein Gliederungspunkt.
    const knoepfe = eintraege();
    expect(knoepfe).toHaveLength(2);
    // …aber sie zaehlt mit: der zweite SICHTBARE Eintrag muss die DRITTE Ueberschrift treffen.
    await klick(knoepfe[1] as HTMLButtonElement);
    expect(sprungZiele[0]).toBe(ueberschriften()[2]);
    expect(sprungZiele[0]?.textContent).toBe("Drei");
    expect(document.activeElement).toBe(ueberschriften()[2]);
  });

  it("O4 · ohne Ueberschrift steht weder eine Leiste noch ein Ersatzsatz da", async () => {
    box.bodyHtml = TEXT_OHNE_UEBERSCHRIFT;
    await mount();
    expect(wieDerBrowserZaehlt(TEXT_OHNE_UEBERSCHRIFT)).toBe(0);
    expect(container.querySelector('[data-testid="bib-gliederung"]')).toBeNull();
    // Kein leerer Rahmen und kein Satz „keine Ueberschriften" — in der Lesespalte steht kein
    // Erklaertext (`tests/design/zielbild-h4-kein-erklaertext.test.ts`).
    expect(el("bib-lesen").querySelectorAll("nav")).toHaveLength(0);
    expect(text(el("bib-lesen"))).not.toContain(i18n.t("lib.lesen.gliederung.titel"));
    // Gegenprobe zur Kalibrierung: mit Ueberschriften gibt es GENAU EINE solche Leiste — ohne sie
    // maesse dieser Fall nur, dass die Lesespalte ueberhaupt kein `<nav>` enthaelt.
    await neuMontierenMit(LANGER_TEXT);
    expect(el("bib-lesen").querySelectorAll("nav")).toHaveLength(1);
  });

  it("O5 · Tastatur: echter Knopf VOR dem Fliesstext, Aktivierung springt und setzt den Fokus", async () => {
    await mount();
    const ziel = eintraege()[2] as HTMLButtonElement;
    // (1) Ein echter `<button type="button">` — kein `div` mit `onClick`, kein `tabIndex`-Nachbau —
    //     und nichts im Pfad nimmt ihn aus der Tabulatorreihenfolge.
    expect(ziel.type).toBe("button");
    expect(ziel.disabled).toBe(false);
    expect(ziel.tabIndex).toBe(0);
    expect(ziel.getAttribute("aria-hidden")).toBeNull();
    for (let e: HTMLElement | null = ziel; e && e !== document.body; e = e.parentElement) {
      expect(e.hasAttribute("hidden"), `hidden an ${e.tagName}`).toBe(false);
      expect(e.hasAttribute("inert"), `inert an ${e.tagName}`).toBe(false);
    }
    // Er steht im DOM VOR dem Fliesstext, also auch in der Tabulatorreihenfolge davor.
    // DOCUMENT_POSITION_FOLLOWING (4): `bib-text` kommt NACH der Leiste.
    const leiste = el("bib-gliederung");
    const flaeche = el("bib-text");
    expect(leiste.compareDocumentPosition(flaeche) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(4);
    expect(leiste.contains(flaeche)).toBe(false);
    act(() => ziel.focus());
    expect(document.activeElement, "der Knopf nimmt den Fokus nicht an").toBe(ziel);
    // (2) Die Aktivierung — was der Browser aus `Enter` macht — springt und uebergibt den Fokus.
    //     Dass Chromium `Enter` wirklich so uebersetzt, steht hier nicht (s. Kopf dieser Datei).
    await klick(ziel);
    expect(sprungZiele[0]).toBe(ueberschriften()[2]);
    expect(document.activeElement).toBe(ueberschriften()[2]);
    // Und die angesprungene Ueberschrift ist fokussierbar, ohne selbst in die Reihenfolge zu
    // geraten: sonst liefe ein Mensch beim Weitertabben durch jede Ueberschrift des Dokuments.
    expect((ueberschriften()[2] as HTMLElement).tabIndex).toBe(-1);
  });

  it("O6 · steht die Uebersetzung im Bild, stammen die Eintraege aus DEREN Ueberschriften", async () => {
    box.bodyHtml = "<h2>Original-Abschnitt A</h2><p>x</p><h2>Original-Abschnitt B</h2><p>y</p>";
    box.variante = {
      originalLanguage: "en",
      title: "Uebersetzter Titel",
      bodyHtml: "<h2>Uebersetzter Abschnitt</h2><p>z</p>",
    };
    // Auf der BIBLIOTHEK, nicht auf `/wissen/:id`: nur dort traegt die Lesespalte die uebersetzte
    // Lesart selbst (s. `mountAn`). Das ist ein Befund dieser Runde, kein Umweg.
    await mountAn("/bibliothek?eintrag=ko-1");
    // Vorbedingung: die Uebersetzung steht wirklich im Bild (sonst misst der Fall das Original).
    expect(text(el("bib-titel"))).toBe("Uebersetzter Titel");
    const knoepfe = eintraege();
    expect(knoepfe).toHaveLength(1);
    expect(text(knoepfe[0] as HTMLButtonElement)).toBe("Uebersetzter Abschnitt");
    // Die Ueberschriften des ORIGINALS duerfen die Leiste nicht fuellen — sie stehen nicht im Bild.
    expect(text(el("bib-gliederung"))).not.toContain("Original-Abschnitt");
    // Und der Sprung trifft die Ueberschrift des gezeichneten Textes.
    await klick(knoepfe[0] as HTMLButtonElement);
    expect(ueberschriften()).toHaveLength(1);
    expect(sprungZiele[0]).toBe(ueberschriften()[0]);
  });

  it("O7 · de/en/nl: der Bereich traegt in jeder Sprache einen Namen, nie den Schluessel", async () => {
    for (const sprache of ["de", "en", "nl"] as const) {
      await act(async () => {
        await i18n.changeLanguage(sprache);
        await flush();
      });
      await mount();
      const name = el("bib-gliederung").getAttribute("aria-label");
      expect(name, `kein aria-label in ${sprache}`).toBeTruthy();
      expect(name, `roher Schluessel in ${sprache}`).not.toBe("lib.lesen.gliederung.titel");
      expect(name).toBe(i18n.t("lib.lesen.gliederung.titel"));
      // Die Eintraege bleiben die Ueberschriften des Dokuments — sie werden NICHT uebersetzt.
      expect(text(eintraege()[0] as HTMLButtonElement)).toBe("Zweck und Geltungsbereich");
      act(() => root.unmount());
      container.remove();
    }
    // Die drei Namen sind wirklich drei verschiedene und nicht dreimal derselbe Rueckfall.
    const namen = new Set(
      (["de", "en", "nl"] as const).map((s) => i18n.getFixedT(s)("lib.lesen.gliederung.titel")),
    );
    expect(namen.size).toBe(3);
    // Aufraeumen fuer `afterEach`: die Schleife hat ihre letzte Montage schon abgebaut.
    box.bodyHtml = LANGER_TEXT;
    await i18n.changeLanguage("de");
    await mount();
  });

  it("O8 · REGRESSION: Kopfspruenge, Tabelle, Bild und Bildergalerie stehen unveraendert", async () => {
    box.bodyHtml = TEXT_MIT_TABELLE_UND_BILD;
    await mount();
    // Die drei Kopfspruenge sind unberuehrt und stehen weiter VOR dem Titel.
    const kopf = el("bib-kopf-spruenge");
    expect(kopf.compareDocumentPosition(el("bib-titel")) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      4,
    );
    expect(el("bib-sprung-quellen").tagName).toBe("BUTTON");
    expect(el("bib-sprung-anhaenge").tagName).toBe("BUTTON");
    // Tabelle und Bild aus dem `bodyHtml` stehen im Fliesstext.
    const flaeche = el("bib-text");
    const prosa = flaeche.querySelector<HTMLElement>(".prose-kw");
    expect(prosa, "der Fliesstext wird nicht mehr als `prose-kw` gezeichnet").not.toBeNull();
    expect((prosa as HTMLElement).querySelector("table tbody tr td")?.textContent).toBe("Takt");
    expect((prosa as HTMLElement).querySelector('img[data-image-id="bild-1"]')).not.toBeNull();
    expect((prosa as HTMLElement).querySelector("figcaption")?.textContent).toBe(
      "Zeichnung der Zone",
    );
    // Und die Bildergalerie darunter zeichnet ihre Kachel — ein Bild MEHR als im Fliesstext.
    expect(text(flaeche)).toContain(i18n.t("ko.gallery"));
    expect(flaeche.querySelectorAll("img").length).toBeGreaterThan(
      (prosa as HTMLElement).querySelectorAll("img").length,
    );
    // Die Leiste steht daneben und zaehlt beide Ueberschriften.
    expect(eintraege().map((k) => text(k))).toEqual(["Kennzahlen", "Zeichnung"]);
  });

  it("O9 · WAECHTER: das Sprungziel ist das Element, keine Textauswertung und keine Position", async () => {
    const quelle = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/bibliothek/BibliothekLesen.tsx"),
      "utf8",
    );
    // GEMESSEN WIRD DER CODE, NICHT DIE BEGRUENDUNG. Der Kopf des Bauteils NENNT die beiden
    // gescheiterten Wege („d44Gliederung", „innerHTML") — ohne diesen Schnitt verboete der Waechter
    // ausgerechnet das Aufschreiben der Lehre.
    const code = quelle.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
    // Kalibrierung des Schnitts: Kommentare weg, Code da.
    expect(code, "der Kommentarschnitt hat nicht gegriffen").not.toContain("BENS ZWEITES");
    expect(code).toContain("export function BibliothekLesen(");
    expect(code.length, "der Schnitt hat zu viel weggenommen").toBeGreaterThan(20000);

    // (1) Anzeige und Struktur kommen weiter aus der EINEN Stelle des Hauses.
    expect(code).toMatch(
      /import\s*\{[^}]*\bd44LeisteZeigen\b[^}]*\}\s*from\s*"\.\.\/d44Struktur";/,
    );
    expect(code).toContain("d44LeisteZeigen(");
    expect(code).toContain("d44SichtbareEintraege(");
    // (2) R3 · DIE TEXTAUSWERTUNG IST RAUS. `d44Gliederung` liest HTML als Text; daran sind Runde 1
    //     (HTML-String) und Runde 2 (`innerHTML`) gescheitert. Beide Wege sind im Code gesperrt.
    expect(code, "die Regex-Auswertung ist wieder im Spiel").not.toContain("d44Gliederung");
    expect(code, "es wird wieder serialisiert statt gezeigt").not.toContain("innerHTML");
    //     `h[23]` ist die Zeichenklasse jeder Ueberschriften-Regex dieses Hauses
    //     (`d44Struktur.ts:56`); `matchAll`, `.match(` und `new RegExp` sind die Wege, sie anzuwenden.
    for (const verboten of ["h[23]", "matchAll", ".match(", "new RegExp"]) {
      expect(code, `eigene Ueberschriften-Auswertung: ${verboten}`).not.toContain(verboten);
    }
    // (3) R3 · GESAMMELT WIRD AM GERENDERTEN BAUM, in GENAU EINER Abfrage ueber alle sechs Ebenen.
    expect(code.split('querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6")')).toHaveLength(2);
    // (4) R3 · UND DAS SPRUNGZIEL IST DAS ELEMENT. Kein Index, keine Position — das ist die
    //     Positionsgleichheit durch Konstruktion, die die Steuerung am 15.09. verlangt hat.
    //     Seit R4 nimmt der Sprung die MARKE entgegen (Element + Eintrag) statt nur das Element:
    //     nur so kann er bei einem toten Ziel neu sammeln, statt stillzuhalten.
    expect(code).toContain("springeZurUeberschrift = (marke: Sprungmarke)");
    expect(code).toContain("marke.ziel.isConnected");
    expect(code, "es wird wieder ueber eine Position nachgeschlagen").not.toContain("[position]");
    expect(code).toContain("onSprung(marke)");
    // (5) R4 · UND DIE MARKEN HAENGEN AM RENDERZYKLUS, NICHT AM HTML-STRING. Ein Effekt MIT
    //     Abhaengigkeitsliste kann den Austausch bei identischem Text nicht sehen — das war der
    //     Befund an Runde 3. `useLayoutEffect` ohne Liste laeuft nach jedem Render; abgeglichen
    //     wird am Ergebnis (`markenGleich`, Elementidentitaet), nicht an einem Merkmal.
    expect(code).toContain("useLayoutEffect(() => {");
    expect(code).toContain("markenGleich(vorher, frisch)");
    expect(code, "der Effekt haengt wieder an einem Merkmal").not.toContain(
      "}, [quelle, flaeche]);",
    );
    expect(code, "das Bauteil bekommt wieder den HTML-String").not.toContain(
      "readonly quelle: string",
    );
    //     Und der Klick haelt bei einem toten Ziel nicht still, sondern sammelt neu.
    expect(code).toContain("ersatzziel(textRef.current, marke.eintrag)");
    // Kalibrierung: der Waechter liest wirklich die Datei, die er meint.
    expect(code).toContain('data-testid="bib-gliederung"');
  });
});

// ==================================================================================================
// R2 · DIE DECKUNG VON ZAEHLUNG UND BAUM — BENS KORREKTURPFLICHT 1.
// ==================================================================================================
describe("JOB 4145 R2 · die Leiste zaehlt, was im Baum steht", () => {
  it("V0 · AUSGANGSLAGE: der ECHTE Server-Sanitizer laesst die Verschachtelung stehen", () => {
    // Ohne diese Zeile waere V1 eine Aussage ueber HTML, das so nie gespeichert wuerde.
    const gespeichert = serverSanitize(VERSCHACHTELT);
    console.info(`JOB 4145 R2 · V0 · Server-Sanitizer: ${gespeichert.slice(0, 120)}`);
    expect((gespeichert.match(/<h2\b/gi) ?? []).length, "der Server wirft Ueberschriften weg").toBe(
      3,
    );
    // Und die Verschachtelung ueberlebt wirklich: VOR dem ersten `</h2>` stehen ZWEI oeffnende.
    const ersterSchluss = gespeichert.indexOf("</h2>");
    expect(ersterSchluss, "kein schliessendes h2 im Ergebnis").toBeGreaterThan(-1);
    expect(
      gespeichert.slice(0, ersterSchluss).match(/<h2\b/gi) ?? [],
      "der Server hat die Verschachtelung aufgeloest — dann trifft dieser Fall nichts mehr",
    ).toHaveLength(2);
  });

  it("V1 · verschachtelte Ueberschriften: „Drei“ trifft die DRITTE Ueberschrift, nicht die zweite", async () => {
    box.bodyHtml = VERSCHACHTELT;
    await mount();
    // Kalibrierung am BAUM, unabhaengig vom Produkt: der Browser hat drei Ueberschriften daraus
    // gemacht, obwohl im String nur zwei `</h2>`-Paare stehen.
    const imBaum = ueberschriften();
    expect(imBaum.map((e) => e.textContent)).toEqual(["Eins", "Zwei", "Drei"]);
    // Die Leiste zaehlt dasselbe — in Runde 1 standen hier zwei Eintraege („Eins Zwei", „Drei").
    const knoepfe = eintraege();
    expect(knoepfe.map((k) => text(k))).toEqual(["Eins", "Zwei", "Drei"]);
    // DER KERN: der Knopf, auf dem „Drei" steht, wird angeklickt — so waehlt ein Mensch.
    const drei = knoepfe.find((k) => text(k) === "Drei");
    expect(drei, "kein Knopf mit der Beschriftung „Drei“").toBeDefined();
    await klick(drei as HTMLButtonElement);
    expect(sprungZiele[0], "der Sprung landete nicht auf der dritten Ueberschrift").toBe(imBaum[2]);
    expect(sprungZiele[0]?.textContent).toBe("Drei");
    expect(document.activeElement).toBe(imBaum[2]);
  });

  it("V2 · und der mittlere Knopf trifft die MITTLERE — die ganze Reihe deckt sich", async () => {
    box.bodyHtml = VERSCHACHTELT;
    await mount();
    const imBaum = ueberschriften();
    // Jeder Eintrag einzeln, nicht nur der auffaellige: eine Verschiebung um eins faellt sonst
    // ausgerechnet am ersten Eintrag nicht auf.
    for (let i = 0; i < imBaum.length; i++) {
      sprungZiele.length = 0;
      await klick(eintraege()[i] as HTMLButtonElement);
      expect(sprungZiele[0], `Eintrag ${i} traf die falsche Ueberschrift`).toBe(imBaum[i]);
    }
  });

  it("V3 · h1 und h4: was der Sanitizer auf h2/h3 abbildet, steht in der Leiste und trifft", async () => {
    box.bodyHtml = ABGEBILDETE_EBENEN;
    await mount();
    // Der Baum kennt nur h2/h3 — der Client-Sanitizer hat abgebildet (`richText.ts:51-57`).
    const imBaum = ueberschriften();
    expect(imBaum.map((e) => e.tagName)).toEqual(["H2", "H3"]);
    // In Runde 1 stand hier GAR KEINE Leiste: am String gezaehlt gab es null Treffer.
    const knoepfe = eintraege();
    expect(knoepfe.map((k) => text(k))).toEqual(["Oben", "Unten"]);
    await klick(knoepfe[1] as HTMLButtonElement);
    expect(sprungZiele[0]).toBe(imBaum[1]);
    expect(document.activeElement).toBe(imBaum[1]);
  });

  it("V4 · die Zusage allgemein: Zahl der Eintraege + leere = Zahl der Ueberschriften im Baum", async () => {
    // Vier Vorlagen in einem Fall — die Zusage gilt nicht nur fuer den einen Gegenbeispieltext.
    // Die Ausgangsmontage steht vor der Schleife: `neuMontierenMit` baut eine LEBENDE Montage ab.
    await mount();
    for (const vorlage of [
      LANGER_TEXT,
      TEXT_MIT_LEERER,
      VERSCHACHTELT,
      VERSCHACHTELT_IM_STARK,
      ABGEBILDETE_EBENEN,
    ]) {
      await neuMontierenMit(vorlage);
      const imBaum = ueberschriften();
      const sichtbar = eintraege();
      const leere = imBaum.filter((e) => (e.textContent ?? "").trim().length === 0).length;
      expect(
        sichtbar.length + leere,
        `Vorlage mit ${imBaum.length} Ueberschriften im Baum, ${sichtbar.length} Eintraegen`,
      ).toBe(imBaum.length);
      // Und die letzte Ueberschrift ist wirklich erreichbar — der Fall, der bei einer Verschiebung
      // um eins ins Leere liefe.
      sprungZiele.length = 0;
      await klick(sichtbar[sichtbar.length - 1] as HTMLButtonElement);
      expect(sprungZiele[0]).toBe(imBaum[imBaum.length - 1]);
    }
  });
});

// ==================================================================================================
// R3 · DIE VERSCHACHTELUNG, DIE IM BAUM STEHEN BLEIBT — BENS KORREKTURPFLICHT AN RUNDE 2.
// ==================================================================================================
describe("JOB 4145 R3 · auch eine im Baum erhaltene Verschachtelung trifft richtig", () => {
  it("W0 · AUSGANGSLAGE: der ECHTE Server-Sanitizer laesst `<strong>` ZWISCHEN den Ueberschriften stehen", () => {
    // Ohne diese Zeile waere W1 eine Aussage ueber HTML, das so nie gespeichert wuerde.
    const gespeichert = serverSanitize(VERSCHACHTELT_IM_STARK);
    console.info(`JOB 4145 R3 · W0 · Server-Sanitizer: ${gespeichert.slice(0, 140)}`);
    expect((gespeichert.match(/<h2\b/gi) ?? []).length, "der Server wirft Ueberschriften weg").toBe(
      3,
    );
    const ersterSchluss = gespeichert.indexOf("</h2>");
    expect(ersterSchluss, "kein schliessendes h2 im Ergebnis").toBeGreaterThan(-1);
    const davor = gespeichert.slice(0, ersterSchluss);
    // ZWEI oeffnende Ueberschriften vor dem ersten Schluss — und `<strong>` dazwischen. Genau das
    // hindert den Browser daran, die erste zu schliessen (er tut es nur, wenn sie das AKTUELLE
    // Element ist). Faellt eines der beiden weg, misst W1 nichts mehr.
    expect(davor.match(/<h2\b/gi) ?? [], "die Verschachtelung ist weg").toHaveLength(2);
    expect(davor, "der Server hat das `strong` zwischen den Ueberschriften entfernt").toContain(
      "<strong>",
    );
  });

  it("W1 · der Baum behaelt die Verschachtelung — und „Drei“ trifft trotzdem die DRITTE", async () => {
    box.bodyHtml = VERSCHACHTELT_IM_STARK;
    await mount();
    // Kalibrierung am BAUM, unabhaengig vom Produkt: DREI Ueberschriftenelemente, und das zweite
    // steckt wirklich IM ersten — das ist der Unterschied zu `VERSCHACHTELT`, wo der Browser
    // flachklopft.
    const imBaum = ueberschriften();
    expect(imBaum).toHaveLength(3);
    expect(
      imBaum[0]?.contains(imBaum[1] as HTMLElement),
      "der Browser hat flachgeklopft — dann misst dieser Fall nicht BENs Lage",
    ).toBe(true);
    expect(imBaum.map((e) => (e.textContent ?? "").trim())).toEqual(["EinsZwei", "Zwei", "Drei"]);
    // Die Leiste zeigt drei Eintraege. In Runde 2 standen hier zwei („EinsZwei", „Drei").
    const knoepfe = eintraege();
    expect(knoepfe.map((k) => text(k))).toEqual(["EinsZwei", "Zwei", "Drei"]);
    // DER KERN: der Knopf, auf dem „Drei" STEHT — so waehlt ein Mensch, nicht ueber eine Position.
    const drei = knoepfe.find((k) => text(k) === "Drei");
    expect(drei, "kein Knopf mit der Beschriftung „Drei“").toBeDefined();
    await klick(drei as HTMLButtonElement);
    expect(sprungZiele[0], "der Sprung landete nicht auf der dritten Ueberschrift").toBe(imBaum[2]);
    expect(sprungZiele[0]?.textContent).toBe("Drei");
    expect(document.activeElement).toBe(imBaum[2]);
    expect((imBaum[2] as HTMLElement).tabIndex).toBe(-1);
  });

  it("W2 · und JEDER Eintrag trifft sein eigenes Element — auch der aeussere und der innere", async () => {
    box.bodyHtml = VERSCHACHTELT_IM_STARK;
    await mount();
    const imBaum = ueberschriften();
    const knoepfe = eintraege();
    expect(knoepfe).toHaveLength(imBaum.length);
    // Die ganze Reihe, nicht nur der auffaellige Eintrag: eine Verschiebung um eins faellt sonst
    // ausgerechnet am ersten nicht auf. Der zweite Eintrag muss das INNERE Element treffen, nicht
    // das aeussere, das es enthaelt.
    for (let i = 0; i < imBaum.length; i++) {
      sprungZiele.length = 0;
      await klick(knoepfe[i] as HTMLButtonElement);
      expect(sprungZiele[0], `Eintrag ${i} („${text(knoepfe[i] as HTMLButtonElement)}“)`).toBe(
        imBaum[i],
      );
      expect(document.activeElement).toBe(imBaum[i]);
    }
  });
});

// ==================================================================================================
// R4 · DIE LEBENSDAUER DER SPRUNGZIELE — BENS KORREKTURPFLICHT AN RUNDE 3.
// ==================================================================================================
describe("JOB 4145 R4 · wird der Baum ausgetauscht, treffen die Knoepfe weiter", () => {
  it("X1 · Uebersetzung → Original → Uebersetzung bei IDENTISCHEM Fliesstext", async () => {
    box.bodyHtml = GLEICHER_TEXT_BEIDE;
    box.variante = {
      originalLanguage: "en",
      title: "Uebersetzter Titel",
      bodyHtml: GLEICHER_TEXT_BEIDE,
    };
    // Auf der BIBLIOTHEK: nur dort traegt die Lesespalte die uebersetzte Lesart selbst (s. `mountAn`).
    await mountAn("/bibliothek?eintrag=ko-1");
    expect(text(el("bib-titel")), "die Uebersetzung steht nicht im Bild").toBe(
      "Uebersetzter Titel",
    );

    // (1) In der Uebersetzung trifft der zweite Eintrag die zweite Ueberschrift.
    const uebersetzt = ueberschriften();
    expect(uebersetzt.map((e) => (e.textContent ?? "").trim())).toEqual(["DIN 123", "Abnahme"]);
    await klick(eintraege()[1] as HTMLButtonElement);
    expect(sprungZiele[0]).toBe(uebersetzt[1]);
    expect(document.activeElement).toBe(uebersetzt[1]);

    // (2) UMSCHALTEN auf das Original — derselbe HTML-String, ein NEUER Baum.
    await klick(el("lesevariante-umschalter"));
    expect(text(el("bib-titel"))).toBe("Reinigung Spritzzone Linie 3");
    const original = ueberschriften();
    // Kalibrierung: React hat wirklich ausgetauscht. Ohne diese zwei Zeilen misst X1 eine Lage,
    // die es gar nicht gibt — und der Fall waere auch am R3-Stand gruen.
    expect(original[1], "der Teilbaum wurde nicht ausgetauscht").not.toBe(uebersetzt[1]);
    expect(uebersetzt[1]?.isConnected, "der alte Knoten haengt noch am Baum").toBe(false);
    // DER KERN: in Runde 3 tat der Knopf hier NICHTS.
    sprungZiele.length = 0;
    await klick(eintraege()[1] as HTMLButtonElement);
    expect(sprungZiele[0], "nach dem Umschalten war der Knopf wirkungslos").toBe(original[1]);
    expect(document.activeElement).toBe(original[1]);

    // (3) UND ZURUECK — die Gegenrichtung zaehlt genauso.
    await klick(el("lesevariante-umschalter"));
    expect(text(el("bib-titel"))).toBe("Uebersetzter Titel");
    const wieder = ueberschriften();
    expect(wieder[1]).not.toBe(original[1]);
    sprungZiele.length = 0;
    await klick(eintraege()[1] as HTMLButtonElement);
    expect(sprungZiele[0], "auf dem Rueckweg war der Knopf wirkungslos").toBe(wieder[1]);
    expect(document.activeElement).toBe(wieder[1]);
  });

  it("X2 · und JEDER Eintrag trifft nach dem Umschalten, nicht nur der gepruefte", async () => {
    box.bodyHtml = GLEICHER_TEXT_BEIDE;
    box.variante = {
      originalLanguage: "en",
      title: "Uebersetzter Titel",
      bodyHtml: GLEICHER_TEXT_BEIDE,
    };
    await mountAn("/bibliothek?eintrag=ko-1");
    await klick(el("lesevariante-umschalter"));
    const imBaum = ueberschriften();
    const knoepfe = eintraege();
    expect(knoepfe).toHaveLength(imBaum.length);
    for (let i = 0; i < imBaum.length; i++) {
      sprungZiele.length = 0;
      await klick(eintraege()[i] as HTMLButtonElement);
      expect(sprungZiele[0], `Eintrag ${i} nach dem Umschalten`).toBe(imBaum[i]);
      expect(document.activeElement).toBe(imBaum[i]);
    }
  });

  it("X3 · Austausch OHNE Renderdurchlauf: der Klick sammelt neu, statt stillzuhalten", async () => {
    box.bodyHtml = LANGER_TEXT;
    await mount();
    const prosa = el("bib-text").querySelector<HTMLElement>(".prose-kw");
    expect(prosa, "der Fliesstext wird nicht als `prose-kw` gezeichnet").not.toBeNull();
    const knopf = eintraege()[1] as HTMLButtonElement;
    expect(text(knopf)).toBe("Ablauf der Pruefung");
    // Der Baum wird VORBEI AN REACT ausgetauscht — und die Reihe verschiebt sich zugleich: vorne
    // kommt eine Ueberschrift dazu. Hier kann die Leiste nicht nachsammeln (nichts rendert), die
    // alte POSITION 1 zeigt jetzt auf einen anderen Abschnitt, und der alte Knoten ist abgehaengt.
    // Genau in dieser Lage blieb der Knopf in Runde 3 wirkungslos.
    const vorher = ueberschriften();
    (prosa as HTMLElement).innerHTML = `<h2>Neu davor</h2>${(prosa as HTMLElement).innerHTML}`;
    const nachher = ueberschriften();
    expect(vorher[1]?.isConnected, "der alte Knoten haengt noch").toBe(false);
    expect(nachher.map((e) => (e.textContent ?? "").trim())).toEqual([
      "Neu davor",
      "Zweck und Geltungsbereich",
      "Ablauf der Pruefung",
      "Wiederholungspruefung",
    ]);
    // Der TEXT fuehrt zum Ziel, nicht die alte Position: „Ablauf der Pruefung" steht jetzt an 2.
    await klick(knopf);
    expect(sprungZiele[0], "der Klick hielt still oder traf die alte Position").toBe(nachher[2]);
    expect(document.activeElement).toBe(nachher[2]);
  });
});

// ==================================================================================================
// R5 · DIE LEISTE DARF AN KEINEM ZWEITEN RENDERDURCHLAUF HAENGEN.
// ==================================================================================================
//
// DER BEFUND, an dem der Torlauf vom 15.09. 23:05 gescheitert ist: `gliederung-mit-tastatur-
// chromium.test.ts` blieb in `frisch()` stehen — nach einem Seitenaufbau stand
// `[data-testid="bib-gliederung"]` 30 s lang NICHT im Baum. Die Frist gehoert genau dieser
// Wartezeile (die Wartezeilen des Klicks haben 20 000 ms); der Klick war also nie an der Reihe, und
// der Befund heisst nicht „der Sprung traf falsch", sondern DIE LEISTE WAR NICHT DA.
//
// DIE URSACHE STEHT IN DER REIHENFOLGE DES EINBAUS:
//
//   `<Lesegliederung>` steht im Baum VOR `<div ref={textRef}>` — so verlangt es Lieferung 3, damit
//   die Knoepfe in der Tabulatorreihenfolge vor dem Fliesstext liegen. React 18 legt beim ersten
//   Einbau zwar alle Knoten an, geht den Baum danach aber EINMAL in Dokumentreihenfolge durch und
//   erledigt je Knoten das Seine: `ref` anhaengen, Layouteffekte laufen lassen. Das Bauteil kommt in
//   dieser Reihe VOR dem `div` — sein `useLayoutEffect` liest `flaeche.current` also, BEVOR React
//   die `ref` gesetzt hat, und findet `null`. Es sammelt nichts, `d44LeisteZeigen` sagt „keine
//   Leiste" — und weil nichts gesammelt wurde, setzt es auch keinen Zustand: es gibt KEINEN Anlass,
//   noch einmal zu zeichnen.
//
//   Bis R4 erschien die Leiste deshalb nur, wenn ZUFAELLIG etwas anderes einen weiteren
//   Renderdurchlauf ausloeste — eine nachlaufende Abfrage, eine Meldung, ein Zustand. Beim ersten
//   Aufbau einer Seite tut das meistens etwas, und darum sahen alle bisherigen Faelle gruen aus.
//   Kommen die Antworten aber aus dem Vorrat — ein Mensch oeffnet denselben Eintrag ein zweites
//   Mal —, ist der Einbau der LETZTE Durchlauf, und die Leiste fehlt DAUERHAFT. Kein Fehler, keine
//   Meldung, nichts: genau die Gattung stiller Ausfall, gegen die dieser Auftrag steht.
//
// DIESER FALL MISST DEN ERSTEN BILDAUFBAU SELBST und macht dafuer zwei Dinge anders als alle
// anderen hier:
//
//   (1) KEIN `act`. `act` leert am Ende JEDE Schlange — Layouteffekte, Nachlaufeffekte, Zeitgeber,
//       Abfragen — und macht damit genau den Unterschied unsichtbar, um den es geht.
//   (2) `flushSync`. Es zeichnet und arbeitet die LAYOUT-Stufe vollstaendig ab, auch das, was ein
//       Layouteffekt selbst noch anstoesst (Reacts Zusage „vor dem Zeichnen"). Nachlaufeffekte
//       (`useEffect`), Zeitgeber und neue Abfragen bleiben liegen. Was danach im Baum steht, ist
//       das, was ein Mensch im ERSTEN Bild sieht.
describe("JOB 4145 R5 · die Gliederung steht schon im ersten Bildaufbau", () => {
  it("Y1 · derselbe Eintrag ein zweites Mal geoeffnet: Text UND Leiste stehen sofort", async () => {
    box.bodyHtml = LANGER_TEXT;
    await mount();
    const erwartet = eintraege().map((k) => text(k));
    expect(erwartet, "die Ausgangslage traegt schon keine Leiste").toHaveLength(3);

    // Abbauen, aber den VORRAT BEHALTEN (kein `qc.clear()`): der Weg eines Menschen, der denselben
    // Eintrag erneut oeffnet. Die Antworten stehen dann im Vorrat, und der Einbau braucht kein Netz.
    act(() => root.unmount());
    container.remove();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    // `IS_REACT_ACT_ENVIRONMENT` ist fuer diese eine Zeile aus: sonst traegt React die synchrone
    // Arbeit in die `act`-Schlange ein, statt sie hier abzuarbeiten — und `flushSync` faende nichts.
    const flagge = globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean };
    flagge.IS_REACT_ACT_ENVIRONMENT = false;
    try {
      flushSync(() => root.render(baum("/wissen/ko-1")));
    } finally {
      flagge.IS_REACT_ACT_ENVIRONMENT = true;
    }

    // KALIBRIERUNG: der Text steht wirklich schon im ersten Bild — sonst maesse der Fall nichts.
    const imBaum = ueberschriften();
    expect(
      imBaum,
      "der Fliesstext kam nicht aus dem Vorrat — dieser Fall misst dann nichts",
    ).toHaveLength(3);
    // DER KERN: und die Leiste steht MIT ihm da, nicht erst beim naechsten Durchlauf.
    expect(
      container.querySelector('[data-testid="bib-gliederung"]'),
      "die Gliederung fehlt im ersten Bildaufbau — sie wartet auf einen zweiten Renderdurchlauf",
    ).not.toBeNull();
    expect(eintraege().map((k) => text(k))).toEqual(erwartet);
    // Und sie ist nicht nur da, sie TRIFFT auch: die Ziele stammen aus demselben Bildaufbau.
    sprungZiele.length = 0;
    await klick(eintraege()[2] as HTMLButtonElement);
    expect(sprungZiele[0], "der Knopf aus dem ersten Bildaufbau traf nicht").toBe(imBaum[2]);
    expect(document.activeElement).toBe(imBaum[2]);
  });

  it("Y2 · WAECHTER: das Bauteil bekommt den KNOTEN, nicht eine `ref`, die spaeter gefuellt wird", () => {
    const quelle = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/bibliothek/BibliothekLesen.tsx"),
      "utf8",
    );
    const code = quelle.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
    expect(code, "der Kommentarschnitt hat nicht gegriffen").toContain(
      "export function BibliothekLesen(",
    );
    // Die `ref` des Fliesstextes wird ueber einen RUECKRUF gesetzt — nur er laeuft im Einbau selbst
    // und kann den Zustand anstossen, der die Leiste nachzieht. Ein `ref={textRef}` am Container
    // waere wieder der Stand, an dem der Torlauf 23:05 gescheitert ist.
    expect(code, "der Fliesstext haengt wieder an einem blossen `ref`-Objekt").not.toContain(
      "ref={textRef}",
    );
    expect(code).toContain("ref={textKnotenSetzen}");
    // Und das Bauteil bekommt den KNOTEN, nicht den Behaelter, in dem er irgendwann steht.
    expect(code, "die Leiste liest wieder aus einem `ref`-Objekt").not.toContain(
      "flaeche={textRef}",
    );
    expect(code).toContain("flaeche={textKnoten}");
    expect(code).toContain("readonly flaeche: HTMLDivElement | null");
  });
});
