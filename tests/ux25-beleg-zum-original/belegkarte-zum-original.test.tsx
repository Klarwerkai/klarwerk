// @vitest-environment jsdom
// ================================================================================================
// JOB 3272 · UX-25 — VON DER BELEGKARTE ZUM ORIGINAL.
// ================================================================================================
//
// DER GEMESSENE AUSGANGSZUSTAND (Stand `ce15b78`, `MehrAbschnitte.tsx:1200-1217`): die Belegkarte
// zeichnet den Belegnamen als `<div>`, darunter eine Maschinenzeile, in der die rohe Kennung
// `object:8f2c…` steht (gebaut in `koEvidence.ts:24`). Kein `<button>`, kein `<a>`, kein `onClick`.
// Das Original liegt drei Abschnitte tiefer unter „Anhänge" — nichts sagt das, und nichts führt
// hin.
//
// WAS HIER GEMESSEN WIRD: die WIRKUNG an der gemounteten ECHTEN Lesefläche über die echte Route
// `/wissen/:id` (`KnowledgeDetail` → `BibliothekFlaeche` → `BibliothekLesen` → `MehrAbschnitte`),
// mit stillgelegter HTTP-Grenze. Bauform wörtlich übernommen aus
// `tests/berichtskopf-spruenge/kopf-fuehrt-zu-quellen-und-anhaengen.test.tsx` (JOB 3108 · UX-03) —
// dieselbe Fläche, dieselben Attrappen. Nichts ist nachgebaut.
//
// NICHT die Anwesenheit eines Knopfes ist der Fall, sondern wo der Fokus danach LIEGT: auf genau
// dem Anhang, den der Beleg meint (Fall R). Ein Knopf, der nur den Abschnitt aufklappt und den
// Nutzer dann suchen lässt, ist bei vielen Anhängen genau die Zumutung, die UX-25 beseitigt.
//
// BENANNTE PRÜFLÜCKE: jsdom führt für einen nativen `<button>` keine Vorgabehandlung auf `keydown`
// aus — ein hier abgeschicktes `Enter` bewirkte nichts. Gemessen wird deshalb (1) dass das Ziel ein
// echter, fokussierbarer `<button>` in der Tabulator-Reihenfolge ist und (2) seine AKTIVIERUNG.
// Dasselbe Vorgehen wie A4 im Kopfzugangs-Test, mit derselben Begründung.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  /** Welche Belege der Server liefert — je Fall gesetzt. */
  belege: [] as unknown[],
  /** Der Belegabruf scheitert (Zustandsmodell: kein „fehlt" aus einem Fehler). */
  belegeFehler: false,
  /**
   * RUNDE 2: welche Anhänge das Objekt trägt. `null` = der Regelbestand (att-1/att-2). Bens
   * Gegenbeispiel braucht einen anderen: zwei Anhänge mit DERSELBEN Kennung.
   */
  anhaenge: null as unknown[] | null,
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Eva", email: "e@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

/**
 * Der Dateiname ist mit Absicht lang und unterscheidet sich erst am ENDE — so wird sichtbar, ob er
 * abgeschnitten wird (Lehre JOB 3266 R2/R3: `truncate` am Titel schneidet unterscheidende Enden
 * weg).
 */
const ANHANG_NAME = "Pruefprotokoll-Spritzzone-Linie-3-2026-08-31-Nachmessung-Seite-4.png";
const BELEG_TITEL = `Beleg zu ${ANHANG_NAME}`;

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = vi.fn(async () => []);
  return {
    endpoints: {
      ko: {
        get: vi.fn(async () => globalThis.__job3272Ko),
        list: vi.fn(async () => [globalThis.__job3272Ko]),
        versions: leer,
        evidence: vi.fn(async () => {
          if (box.belegeFehler) {
            throw new Error("Belegabruf gescheitert");
          }
          return box.belege;
        }),
        neighbors: vi.fn(async () => ({
          center: "ko-1",
          neighbors: [],
          excludedTags: [],
          limit: 8,
        })),
        act: vi.fn(async () => globalThis.__job3272Ko),
      },
      conflicts: { list: leer },
      duplicateSignal: { list: leer },
      audit: { list: leer },
      directory: { list: vi.fn(async () => [{ id: "u1", name: "Eva" }]) },
      lifecycle: { pending: leer, linked: leer },
      external: { policy: vi.fn(async () => ({ stage: "blocked", enabled: false })) },
      uploadLimits: {
        get: vi.fn(async () => ({ maxAttachments: 8, maxAttachmentBytes: 20000000 })),
      },
      reasoner: {
        status: vi.fn(async () => ({ active: false, mode: "off" })),
        config: vi.fn(async () => ({})),
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
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import type { EvidenceRecord, KnowledgeObject } from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";

declare global {
  // Der Bestand wird über den globalen Namensraum gereicht: `vi.mock` wird hochgezogen und darf
  // nichts aus dem Modulrumpf schließen.
  // eslint-disable-next-line no-var
  var __job3272Ko: KnowledgeObject;
}

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** `scrollIntoView` fehlt in jsdom — sie wird MITGESCHRIEBEN statt stillgelegt (wie JOB 3108). */
let scrollRufe: unknown[] = [];
(Element.prototype as unknown as { scrollIntoView: (o?: unknown) => void }).scrollIntoView = (
  o,
) => {
  scrollRufe.push(o ?? null);
};

function beleg(overrides: Partial<EvidenceRecord>): EvidenceRecord {
  return {
    id: "ev-1",
    koId: "ko-1",
    koVersion: 1,
    kind: "attachment",
    label: BELEG_TITEL,
    createdBy: "u1",
    createdAt: "2026-08-31T10:00:00.000Z",
    ...overrides,
  };
}

function ko(): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Reinigung Spritzzone Linie 3",
    statement: "Die Spritzzone wird nach jeder Schicht nass gereinigt.",
    bodyHtml: "<p>Reinigung und Prüfung.</p>",
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
    attachments: box.anhaenge ?? [
      {
        id: "att-1",
        name: ANHANG_NAME,
        mime: "image/png",
        objectId: "obj-1",
        thumbnail: "data:image/png;base64,iVBORw0KGgo=",
        author: "u1",
        at: "2026-08-01T00:00:00.000Z",
      },
      {
        id: "att-2",
        name: "linie-3-uebersicht.png",
        mime: "image/png",
        objectId: "obj-2",
        thumbnail: "data:image/png;base64,iVBORw0KGgo=",
        author: "u1",
        at: "2026-08-01T00:00:00.000Z",
      },
    ],
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

async function mount(): Promise<void> {
  globalThis.__job3272Ko = ko();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
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
                  { initialEntries: ["/wissen/ko-1"] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/wissen/:id",
                      element: createElement(KnowledgeDetail),
                    }),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  await act(flush);
}

function el(testId: string): HTMLElement {
  const treffer = container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  if (!treffer) {
    throw new Error(`„${testId}" fehlt auf der Lesefläche`);
  }
  return treffer;
}

const abschnitt = (schluessel: string): HTMLDetailsElement | null =>
  container.querySelector<HTMLDetailsElement>(`[data-bib-abschnitt="${schluessel}"]`);

const text = (e: Element): string => (e.textContent ?? "").replace(/\s+/g, " ").trim();

async function klick(ziel: HTMLElement): Promise<void> {
  await act(async () => {
    ziel.click();
    await flush();
  });
  await act(flush);
}

/** Einen Abschnitt VON HAND auf- oder zuklappen — der Weg, den ein Mensch am `<summary>` geht. */
async function vonHand(schluessel: string, offen: boolean): Promise<void> {
  const d = abschnitt(schluessel);
  if (!d) {
    throw new Error(`Abschnitt „${schluessel}" fehlt`);
  }
  await act(async () => {
    d.open = offen;
    // jsdom stellt `toggle` in die Warteschlange, statt es sofort zu liefern; es steigt nicht auf.
    d.dispatchEvent(new Event("toggle"));
    await flush();
  });
  await act(flush);
}

/** „Mehr" aufklappen und den Abschnitt „Belege" öffnen — der Weg zur Belegkarte. */
async function belegeOeffnen(): Promise<void> {
  await klick(el("bib-mehr"));
  await vonHand("belege", true);
}

/**
 * Die Belegkarte wird über ihren SICHTBAREN Titel gefunden, nicht über ein eigens dafür gesetztes
 * Attribut: der Fall soll auch am Ausgangsstand greifen und dort genau das eine melden, was fehlt —
 * das Bedienelement.
 */
function belegKarte(titel: string): HTMLElement {
  const karten = Array.from(container.querySelectorAll("li"));
  const treffer = karten.filter((li) => (li.textContent ?? "").includes(titel));
  if (treffer.length === 0) {
    throw new Error(`Belegkarte zu „${titel}" fehlt`);
  }
  // Die INNERSTE Karte: `<li>` sind hier nicht verschachtelt, aber die Liste ist es nicht wert,
  // sich darauf zu verlassen.
  return treffer[treffer.length - 1] as HTMLElement;
}

/** Der Anhangknopf zu einer Anhangskennung — der Anker aus Lieferung 4. */
const anhangKnopf = (anhangId: string): HTMLElement | null =>
  container.querySelector<HTMLElement>(`[data-bib-anhang="${anhangId}"]`);

/** Das innerste Element, dessen Text GENAU dem Satz entspricht. */
function satzKnoten(wurzel: HTMLElement, satz: string): HTMLElement | null {
  const kandidaten = Array.from(wurzel.querySelectorAll<HTMLElement>("*")).filter(
    (e) => text(e) === satz,
  );
  return kandidaten.length > 0 ? (kandidaten[kandidaten.length - 1] as HTMLElement) : null;
}

/**
 * „Sichtbar" heißt messbar sichtbar (Lehre JOB 3179): weder `hidden`, `aria-hidden`, `sr-only` noch
 * eine Clip-/0-Pixel-Regel — an keinem Element im Pfad bis zur Karte.
 */
function pruefeSichtbar(knoten: HTMLElement, bis: HTMLElement): void {
  for (let e: HTMLElement | null = knoten; e && e !== bis.parentElement; e = e.parentElement) {
    expect(e.hasAttribute("hidden"), `hidden an ${e.tagName}`).toBe(false);
    expect(e.getAttribute("aria-hidden"), `aria-hidden an ${e.tagName}`).not.toBe("true");
    const klassen = e.className.toString();
    expect(klassen, `sr-only an ${e.tagName}`).not.toContain("sr-only");
    expect(klassen, `Clip-Regel an ${e.tagName}`).not.toContain("clip");
    expect(klassen, `Null-Höhe an ${e.tagName}`).not.toMatch(/\bh-0\b|\bw-0\b/);
  }
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.belege = [];
  box.belegeFehler = false;
  box.anhaenge = null;
  scrollRufe = [];
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

describe("JOB 3272 · UX-25 — die Belegkarte führt zum Original", () => {
  it("R0 · KALIBRIERUNG: die echte Lesefläche steht, die Belegkarte trägt ihren Namen", async () => {
    box.belege = [beleg({ attachmentId: "att-1", objectId: "obj-1", mime: "image/png" })];
    await mount();
    await belegeOeffnen();
    const karte = belegKarte(BELEG_TITEL);
    // Der Name steht VOLLSTÄNDIG da — nicht abgeschnitten (Lehre JOB 3266 R2/R3).
    expect(text(karte)).toContain(BELEG_TITEL);
    const titelKnoten = satzKnoten(karte, BELEG_TITEL);
    expect(titelKnoten, "der Belegname steht nicht als eigener Knoten").not.toBeNull();
    // Umbrechen statt abschneiden — und zwar an KEINEM Element im Pfad bis zur Karte. Das gilt bei
    // jeder Fensterbreite und ist damit die Aussage, die eine Pixelmessung bei 320/360/390 px
    // tragen müsste. (Der Chromium-Nachweis an der gebauten Seite gehört ins Tor; in dieser
    // Sandkiste gibt es kein `apps/web/dist` — s. RUECKGABE, PRÜFLÜCKEN.)
    for (
      let e: HTMLElement | null = titelKnoten as HTMLElement;
      e && e !== karte.parentElement;
      e = e.parentElement
    ) {
      const klassen = e.className.toString();
      expect(klassen, `der Belegname wird abgeschnitten (${e.tagName})`).not.toContain("truncate");
      expect(klassen, `kein Umbruch erlaubt (${e.tagName})`).not.toContain("whitespace-nowrap");
      expect(klassen, `der Text wird abgeschnitten (${e.tagName})`).not.toContain(
        "overflow-hidden",
      );
    }
    expect(
      (titelKnoten as HTMLElement).className.toString(),
      "lange Dateinamen ohne Leerzeichen brauchen einen Umbruchpunkt",
    ).toContain("break-words");
    // Und die zwei Anhänge sind wirklich da — sonst prüfte R1 ein leeres Blatt.
    expect((globalThis.__job3272Ko.attachments ?? []).length).toBe(2);
  });

  it("R1 · der Belegbezug führt hin: Abschnitt „Anhänge“ offen, Fokus auf GENAU att-1", async () => {
    box.belege = [beleg({ attachmentId: "att-1", objectId: "obj-1", mime: "image/png" })];
    await mount();
    await belegeOeffnen();
    const karte = belegKarte(BELEG_TITEL);

    const knoepfe = Array.from(karte.querySelectorAll("button"));
    expect(knoepfe.length, "die Belegkarte bietet kein Bedienelement an").toBe(1);
    const sprung = knoepfe[0] as HTMLButtonElement;
    // Ein echter Knopf in der Tabulator-Reihenfolge, mit sprechendem zugänglichem Namen.
    expect(sprung.type).toBe("button");
    expect(sprung.disabled).toBe(false);
    expect(sprung.tabIndex).toBe(0);
    expect(sprung.getAttribute("aria-disabled")).not.toBe("true");
    const name = sprung.getAttribute("aria-label") ?? text(sprung);
    expect(name, "der zugängliche Name nennt den Beleg nicht").toContain(BELEG_TITEL);
    expect(name, "der zugängliche Name nennt den Zweck nicht").toContain(
      i18n.t("ko.evidenceToOriginalHint"),
    );
    pruefeSichtbar(sprung, karte);
    act(() => sprung.focus());
    expect(document.activeElement, "der Knopf nimmt den Fokus nicht an").toBe(sprung);

    await klick(sprung);
    const anhaenge = abschnitt("anhaenge");
    expect(anhaenge, "der Abschnitt „anhaenge“ wurde nicht gemountet").not.toBeNull();
    expect((anhaenge as HTMLDetailsElement).open, "der Abschnitt steht nicht offen").toBe(true);
    const ziel = anhangKnopf("att-1");
    expect(ziel, "der Anhangknopf trägt keinen Anker `data-bib-anhang`").not.toBeNull();
    expect(document.activeElement, "der Fokus liegt nicht auf dem gemeinten Anhang").toBe(ziel);
    // Nicht der Abschnittskopf, nicht der falsche Anhang.
    expect(document.activeElement).not.toBe(
      (anhaenge as HTMLDetailsElement).querySelector("summary"),
    );
    expect(document.activeElement).not.toBe(anhangKnopf("att-2"));
    expect(scrollRufe, "der Sprung führt einmal ins Bild").toEqual([{ block: "start" }]);
  });

  it("F · Bezug ohne Original: die Karte sagt es in Worten und bietet KEINEN Weg an", async () => {
    box.belege = [beleg({ objectId: "obj-weg", mime: "image/png" })];
    await mount();
    await belegeOeffnen();
    const karte = belegKarte(BELEG_TITEL);

    expect(
      karte.querySelectorAll("button").length,
      "die Karte bietet einen Weg an, der ins Leere führt",
    ).toBe(0);
    const satz = i18n.t("ko.evidenceOriginalDetached");
    expect(satz).toBe("Original nicht mehr an diesem Objekt");
    expect(text(karte), "der fehlende Bezug wird verschwiegen").toContain(satz);
    const knoten = satzKnoten(karte, satz);
    expect(knoten, "der Satz steht in keinem eigenen Knoten").not.toBeNull();
    // Lieferung 5: sichtbar heißt messbar sichtbar — die Gegenprobe mit `sr-only` macht das rot.
    pruefeSichtbar(knoten as HTMLElement, karte);
    // Und keine Sackgasse über `aria-disabled`.
    expect(karte.querySelector("[aria-disabled]")).toBeNull();
  });

  it("K · Beleg ganz ohne Bezug: kein Knopf, kein Fehl-Satz, und nirgends „object:“", async () => {
    box.belege = [
      beleg({
        id: "ev-q",
        kind: "source",
        label: "DIN EN 1672-2",
        url: "https://example.org/din",
        provider: "example.org",
      }),
    ];
    await mount();
    await belegeOeffnen();
    const karte = belegKarte("DIN EN 1672-2");

    expect(karte.querySelectorAll("button").length).toBe(0);
    expect(text(karte)).not.toContain(i18n.t("ko.evidenceOriginalDetached"));
    expect(text(karte), "die rohe Kennung steht noch in der Anzeige").not.toContain("object:");
    // Die übrigen Angaben der Maschinenzeile bleiben, wie sie waren.
    expect(text(karte)).toContain("v1");
    expect(text(karte)).toContain("example.org");
    expect(text(karte)).toContain("https://example.org/din");
  });

  it("K2 · auch ein Anhangbeleg MIT Original zeigt die rohe Kennung nicht mehr", async () => {
    box.belege = [beleg({ attachmentId: "att-1", objectId: "obj-1", mime: "image/png" })];
    await mount();
    await belegeOeffnen();
    const karte = belegKarte(BELEG_TITEL);
    expect(text(karte), "die rohe Kennung steht noch in der Anzeige").not.toContain("object:");
    expect(text(karte), "die Kennung steht roh im Text").not.toContain("obj-1");
    // Der Rest der Maschinenzeile ist unberührt.
    expect(text(karte)).toContain("v1");
    expect(text(karte)).toContain("image/png");
  });

  it("U · der Kopfzugang bleibt unverändert: ohne Anker fokussiert der Sprung das `<summary>`", async () => {
    box.belege = [beleg({ attachmentId: "att-1", objectId: "obj-1" })];
    await mount();
    await klick(el("bib-sprung-anhaenge"));
    const anhaenge = abschnitt("anhaenge") as HTMLDetailsElement;
    expect(anhaenge.open).toBe(true);
    expect(document.activeElement, "der Kopfzugang hat sich bewegt").toBe(
      anhaenge.querySelector("summary"),
    );
    expect(scrollRufe).toEqual([{ block: "start" }]);
  });

  it("Z · zweimal denselben Anhang anspringen wirkt zweimal — auch nach Zuklappen von Hand", async () => {
    box.belege = [beleg({ attachmentId: "att-1", objectId: "obj-1" })];
    await mount();
    await belegeOeffnen();
    const sprung = belegKarte(BELEG_TITEL).querySelector("button") as HTMLButtonElement;

    await klick(sprung);
    expect((abschnitt("anhaenge") as HTMLDetailsElement).open).toBe(true);
    expect(document.activeElement).toBe(anhangKnopf("att-1"));

    await vonHand("anhaenge", false);
    expect((abschnitt("anhaenge") as HTMLDetailsElement).open, "Vorbedingung: zu").toBe(false);
    act(() => (document.activeElement as HTMLElement | null)?.blur());

    await klick(belegKarte(BELEG_TITEL).querySelector("button") as HTMLButtonElement);
    expect(
      (abschnitt("anhaenge") as HTMLDetailsElement).open,
      "der zweite Sprung wirkte nicht",
    ).toBe(true);
    expect(document.activeElement).toBe(anhangKnopf("att-1"));
    expect(scrollRufe.length, "beide Sprünge führen ins Bild").toBe(2);
  });

  it("Z2 · ein bereits offener Abschnitt wird trotzdem angesprungen", async () => {
    box.belege = [beleg({ attachmentId: "att-1", objectId: "obj-1" })];
    await mount();
    await belegeOeffnen();
    await vonHand("anhaenge", true);
    expect((abschnitt("anhaenge") as HTMLDetailsElement).open, "Vorbedingung: offen").toBe(true);
    act(() => (document.activeElement as HTMLElement | null)?.blur());

    await klick(belegKarte(BELEG_TITEL).querySelector("button") as HTMLButtonElement);
    expect(document.activeElement, "der Sprung in den offenen Abschnitt wirkte nicht").toBe(
      anhangKnopf("att-1"),
    );
  });

  it("E · Belegfehler: der Fehlersatz steht, aber KEIN „Original nicht mehr an diesem Objekt“", async () => {
    box.belegeFehler = true;
    await mount();
    await belegeOeffnen();
    const belege = abschnitt("belege") as HTMLDetailsElement;
    expect(text(belege)).toContain(i18n.t("state.error"));
    expect(
      text(belege),
      "aus einem Fehler wird eine negative Tatsachenaussage abgeleitet",
    ).not.toContain(i18n.t("ko.evidenceOriginalDetached"));
    expect(belege.querySelector("[data-bib-beleg-sprung]")).toBeNull();
  });

  it("L · Leerfall: kein Beleg → weder Knopf noch Fehl-Satz, nur der Leersatz", async () => {
    box.belege = [];
    await mount();
    await belegeOeffnen();
    const belege = abschnitt("belege") as HTMLDetailsElement;
    expect(text(belege)).toContain(i18n.t("ko.evidenceEmpty"));
    expect(text(belege)).not.toContain(i18n.t("ko.evidenceOriginalDetached"));
  });

  // ----------------------------------------------------------------------------------------------
  // RUNDE 2 · BENs Gegenbeispiel AN DER FLÄCHE (Korrekturpflicht 1)
  // ----------------------------------------------------------------------------------------------
  //
  // Sein Befund, wörtlich gemessen: bei zwei Anhängen mit derselben Kennung führte der Weg zum
  // ERSTEN — `Expected: "linie-3-uebersicht.png"`, `Received: "Pruefprotokoll-…-Seite-4.png —
  // Original in neuem Tab öffnen"`. Die reine Regel hält das jetzt auf (koEvidence.test.ts, Fall D);
  // HIER wird gemessen, dass die Fläche daraus wirklich keinen Weg mehr anbietet. Ohne diesen Fall
  // wäre nur die Funktion geprüft, nicht das Versprechen.
  const DOPPELTE_KENNUNG = [
    {
      id: "doppelt",
      name: ANHANG_NAME,
      mime: "image/png",
      objectId: "obj-1",
      thumbnail: "data:image/png;base64,iVBORw0KGgo=",
      author: "u1",
      at: "2026-08-01T00:00:00.000Z",
    },
    {
      id: "doppelt",
      name: "linie-3-uebersicht.png",
      mime: "image/png",
      objectId: "obj-2",
      thumbnail: "data:image/png;base64,iVBORw0KGgo=",
      author: "u1",
      at: "2026-08-01T00:00:00.000Z",
    },
  ];

  it("D · mehrdeutiger Bezug: KEIN Knopf, sondern der ehrliche Satz — kein Sprung ins Falsche", async () => {
    box.anhaenge = DOPPELTE_KENNUNG;
    box.belege = [beleg({ attachmentId: "doppelt", objectId: "obj-2", mime: "image/png" })];
    await mount();
    await belegeOeffnen();
    const karte = belegKarte(BELEG_TITEL);

    expect(
      karte.querySelectorAll("button").length,
      "die Karte bietet einen Weg an, der auf ein geratenes Original führt",
    ).toBe(0);
    expect(karte.querySelector("[data-bib-beleg-sprung]")).toBeNull();
    const satz = i18n.t("ko.evidenceOriginalDetached");
    expect(text(karte), "der mehrdeutige Bezug wird verschwiegen").toContain(satz);
    pruefeSichtbar(satzKnoten(karte, satz) as HTMLElement, karte);
    // Und niemand hat unterwegs den Fokus verschoben: es gab keinen Sprung, also auch keinen Scroll.
    expect(scrollRufe).toEqual([]);
  });

  it("D2 · derselbe Bestand, aber ein EINDEUTIG benannter Anhang bleibt erreichbar", async () => {
    // Die Verschärfung darf die Fläche nicht stumm machen: ein dritter, eindeutig benannter Anhang
    // im selben Bestand behält seinen Weg. Sonst wäre „fehlt" nur eine bequeme Pauschalantwort.
    box.anhaenge = [
      ...DOPPELTE_KENNUNG,
      {
        id: "att-3",
        name: "kalibrierschein.png",
        mime: "image/png",
        objectId: "obj-3",
        thumbnail: "data:image/png;base64,iVBORw0KGgo=",
        author: "u1",
        at: "2026-08-01T00:00:00.000Z",
      },
    ];
    box.belege = [beleg({ attachmentId: "att-3", objectId: "obj-3", mime: "image/png" })];
    await mount();
    await belegeOeffnen();
    const sprung = belegKarte(BELEG_TITEL).querySelector("button") as HTMLButtonElement | null;
    expect(sprung, "der eindeutige Nachbar hat seinen Weg verloren").not.toBeNull();

    await klick(sprung as HTMLButtonElement);
    expect(document.activeElement, "der Fokus liegt nicht auf att-3").toBe(anhangKnopf("att-3"));
  });

  // ----------------------------------------------------------------------------------------------
  // RUNDE 2 · BENs Prüflücke 6 — DER CACHEFALL
  // ----------------------------------------------------------------------------------------------
  it("C · gescheiterte AUFFRISCHUNG: die Belege bleiben stehen, der Weg auch, mit Standhinweis", async () => {
    box.belege = [beleg({ attachmentId: "att-1", objectId: "obj-1", mime: "image/png" })];
    await mount();
    await belegeOeffnen();
    // Vorbedingung: ein erfolgreich geholter Stand steht da.
    expect(belegKarte(BELEG_TITEL).querySelectorAll("button").length).toBe(1);

    // Jetzt scheitert die AUFFRISCHUNG — der Bestand im Zwischenspeicher bleibt.
    box.belegeFehler = true;
    await act(async () => {
      await qc.refetchQueries({ queryKey: ["ko", "ko-1", "evidence"] });
      await flush();
    });
    await act(flush);

    const belege = abschnitt("belege") as HTMLDetailsElement;
    // 1 · Die zuletzt erfolgreich geholten Werte sind NICHT verschwunden (REGELN Punkt 7).
    expect(text(belege), "die Belege sind hinter einer Fehlerfläche verschwunden").toContain(
      BELEG_TITEL,
    );
    const karte = belegKarte(BELEG_TITEL);
    const sprung = karte.querySelector("button") as HTMLButtonElement | null;
    expect(sprung, "der Weg zum Original ist mit der Auffrischung verschwunden").not.toBeNull();
    // 2 · Aus dem Abrufscheitern entsteht KEINE neue negative Tatsachenaussage.
    expect(
      text(karte),
      "aus einem gescheiterten Abruf wird „Original nicht mehr an diesem Objekt“",
    ).not.toContain(i18n.t("ko.evidenceOriginalDetached"));
    // 3 · Und es wird nicht verschwiegen, dass der Stand alt ist — die EINE Bauform des Hauses.
    const hinweis = belege.querySelector('[data-testid="auffrischung-fehlgeschlagen"]');
    expect(
      hinweis,
      "der Standhinweis fehlt — der alte Stand gibt sich als frisch aus",
    ).not.toBeNull();
    expect(text(hinweis as Element)).toContain("Auffrischung fehlgeschlagen");
    // 4 · Der Weg wirkt weiterhin: kein halb erloschener Knopf.
    await klick(sprung as HTMLButtonElement);
    expect(document.activeElement).toBe(anhangKnopf("att-1"));
  });

  it("EN · derselbe Weg auf Englisch — die Fläche spricht, nicht der Programmschlüssel", async () => {
    box.belege = [beleg({ objectId: "obj-weg" })];
    await i18n.changeLanguage("en");
    await mount();
    await belegeOeffnen();
    const satz = i18n.t("ko.evidenceOriginalDetached");
    expect(satz).not.toContain("ko.");
    expect(satz).not.toBe("Original nicht mehr an diesem Objekt");
    expect(text(belegKarte(BELEG_TITEL))).toContain(satz);
    await i18n.changeLanguage("de");
  });
});
