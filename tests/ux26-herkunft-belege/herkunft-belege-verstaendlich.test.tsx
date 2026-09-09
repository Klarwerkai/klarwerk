// @vitest-environment jsdom
// ================================================================================================
// JOB 3384 · UX-26 — HERKUNFT UND BELEG-LEERSTAND VERSTÄNDLICH.
// ================================================================================================
//
// DER GEMESSENE AUSGANGSZUSTAND (Stand `d84b086`):
//
//   (a) `MehrAbschnitte.tsx:1066` beschriftet jede Zeile der Herkunftskette über
//       `auditActionLabel`. Fehlt der `audit.action.*`-Schlüssel, greift dort der
//       sprachunabhängige Rückfall (`auditAction.ts:18`, Trenner → Leerzeichen). Acht am
//       Schreibweg gemessene KO-Ereignisse hatten keinen Schlüssel — darunter `ask.query`
//       (`services/ask/src/service.ts:905`, `target: result.sources[0]`), das Pedi am 06.09. als
//       „ask query" in der deutschen Anzeige sah (N-0053).
//   (b) `MehrAbschnitte.tsx:1059` war `auditEvents.length > 0 ? <ul> : null` — bei null
//       Ereignissen stand GAR NICHTS da.
//   (c) `MehrAbschnitte.tsx:1251` zeigte bei leerer Belegliste einen Satz ohne Weg.
//
// WAS HIER GEMESSEN WIRD: die WIRKUNG an der gemounteten ECHTEN Lesefläche über die echte Route
// `/wissen/:id` (`KnowledgeDetail` → `BibliothekFlaeche` → `BibliothekLesen` → `MehrAbschnitte`),
// mit stillgelegter HTTP-Grenze und ECHTEM i18next in DE **und** EN. Bauform wörtlich übernommen
// aus `tests/ux25-beleg-zum-original/belegkarte-zum-original.test.tsx` (JOB 3272) — dieselbe
// Fläche, dieselben Attrappen. Nichts ist nachgebaut.
//
// WARUM NICHT NUR `auditActionLabel` GEPRÜFT WIRD: ein reiner Funktionstest berührte die
// Anzeigestelle `:1066` nicht und zeigte damit gerade nicht, dass Pedi es auch SIEHT. Gemessen
// wird deshalb der Text im DOM des Abschnitts, nicht der Rückgabewert einer Funktion.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  /** Welche Belege der Server liefert — je Fall gesetzt. */
  belege: [] as unknown[],
  /** Welche Audit-Ereignisse `GET /api/audit` liefert — je Fall gesetzt. */
  ereignisse: [] as unknown[],
  /** Der Audit-Abruf scheitert (Zustandsmodell: kein Leersatz aus einem Fehler). */
  ereignisseFehler: false,
  /** Die Rolle der angemeldeten Person — entscheidet über `canEdit` (`MehrAbschnitte.tsx:210`). */
  rolle: "experte" as string,
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Eva", email: "e@x.de", role: box.rolle })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = vi.fn(async () => []);
  return {
    endpoints: {
      ko: {
        get: vi.fn(async () => globalThis.__job3384Ko),
        list: vi.fn(async () => [globalThis.__job3384Ko]),
        versions: leer,
        evidence: vi.fn(async () => box.belege),
        neighbors: vi.fn(async () => ({
          center: "ko-1",
          neighbors: [],
          excludedTags: [],
          limit: 8,
        })),
        act: vi.fn(async () => globalThis.__job3384Ko),
      },
      conflicts: { list: leer },
      duplicateSignal: { list: leer },
      audit: {
        list: vi.fn(async () => {
          if (box.ereignisseFehler) {
            throw new Error("Audit-Abruf gescheitert");
          }
          return box.ereignisse;
        }),
      },
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
import type { AuditEntry, EvidenceRecord, KnowledgeObject } from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";

declare global {
  // Der Bestand reist über den globalen Namensraum: `vi.mock` wird hochgezogen und darf nichts aus
  // dem Modulrumpf schließen (dieselbe Bauform wie JOB 3272).
  // eslint-disable-next-line no-var
  var __job3384Ko: KnowledgeObject;
}

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** `scrollIntoView` fehlt in jsdom — mitgeschrieben statt stillgelegt (wie JOB 3108/3272). */
(Element.prototype as unknown as { scrollIntoView: (o?: unknown) => void }).scrollIntoView = () =>
  undefined;

function ereignis(action: string, seq: number): AuditEntry {
  return {
    seq,
    at: "2026-09-01T09:00:00.000Z",
    actor: "u1",
    action,
    target: "ko-1",
    payload: {},
    prevHash: "",
    hash: `h${seq}`,
  };
}

function beleg(overrides: Partial<EvidenceRecord>): EvidenceRecord {
  return {
    id: "ev-1",
    koId: "ko-1",
    koVersion: 1,
    kind: "attachment",
    label: "Beleg zum Prüfprotokoll",
    createdBy: "u1",
    createdAt: "2026-08-31T10:00:00.000Z",
    ...overrides,
  } as EvidenceRecord;
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
    attachments: [
      {
        id: "att-1",
        name: "pruefprotokoll.png",
        mime: "image/png",
        objectId: "obj-1",
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
  globalThis.__job3384Ko = ko();
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

/** „Mehr" aufklappen und einen der dreizehn Abschnitte öffnen. */
async function oeffne(schluessel: string): Promise<HTMLDetailsElement> {
  await klick(el("bib-mehr"));
  await vonHand(schluessel, true);
  const d = abschnitt(schluessel);
  if (!d) {
    throw new Error(`Abschnitt „${schluessel}" fehlt nach dem Aufklappen`);
  }
  return d;
}

/**
 * „Sichtbar" heißt messbar sichtbar (Lehre JOB 3179): weder `hidden`, `aria-hidden`, `sr-only`
 * noch eine Clip-/0-Pixel-Regel — an keinem Element im Pfad bis zum Abschnitt.
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

/** Das innerste Element, dessen Text GENAU dem Satz entspricht. */
function satzKnoten(wurzel: HTMLElement, satz: string): HTMLElement | null {
  const kandidaten = Array.from(wurzel.querySelectorAll<HTMLElement>("*")).filter(
    (e) => text(e) === satz,
  );
  return kandidaten.length > 0 ? (kandidaten[kandidaten.length - 1] as HTMLElement) : null;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.belege = [];
  box.ereignisse = [];
  box.ereignisseFehler = false;
  box.rolle = "experte";
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
});

afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  qc.clear();
  vi.clearAllMocks();
  await i18n.changeLanguage("de");
});

describe("JOB 3384 · UX-26 — die Herkunftskette spricht Deutsch, der Leerstand nennt einen Weg", () => {
  // ----------------------------------------------------------------------------------------------
  // FALL 1 — DER EREIGNISNAME (Lieferung 2)
  // ----------------------------------------------------------------------------------------------
  it("1a · DE: `ask.query` heißt „Frage gestellt“ — „ask query“ steht nirgends mehr", async () => {
    box.ereignisse = [ereignis("ask.query", 1)];
    await mount();
    const kette = await oeffne("herkunftskette");

    const name = i18n.t("audit.action.ask_query");
    expect(name, "der Schlüssel fehlt — i18next gibt den Schlüsselnamen zurück").not.toBe(
      "audit.action.ask_query",
    );
    expect(text(kette), "der fachliche Name steht nicht in der Herkunftskette").toContain(name);
    const knoten = satzKnoten(kette, name);
    expect(knoten, "der Name steht nicht als eigener Knoten").not.toBeNull();
    pruefeSichtbar(knoten as HTMLElement, kette);
    // Die humanisierte Form des Rückfalls (`auditAction.ts:18`) — sie war Pedis Befund.
    expect(text(kette), "der Programmbrocken „ask query“ steht weiterhin da").not.toContain(
      "ask query",
    );
    expect(text(kette), "der rohe Punktcode steht da").not.toContain("ask.query");
  });

  it("1b · EN: derselbe Code trägt den englischen Namen, nicht die Humanisierung", async () => {
    box.ereignisse = [ereignis("ask.query", 1)];
    await i18n.changeLanguage("en");
    await mount();
    const kette = await oeffne("herkunftskette");

    const name = i18n.t("audit.action.ask_query");
    expect(name).not.toBe("audit.action.ask_query");
    // E50d: DE und EN sagen dasselbe, aber nicht dasselbe Wort — sonst wäre EN unbedient.
    expect(name, "EN und DE tragen denselben Text — eine der beiden Sprachen fehlt").not.toBe(
      "Frage gestellt",
    );
    expect(text(kette)).toContain(name);
    expect(text(kette), "der Programmbrocken steht auch auf EN da").not.toContain("ask query");
  });

  it("1c · alle acht gemessenen Codes tragen in DE, EN und NL einen eigenen Namen", async () => {
    // Die Liste ist am Schreibweg gemessen (s. Kopfkommentar von `i18n.ts`, Block „JOB 3384") —
    // sie steht hier, damit ein NEUER Code ohne Schlüssel nicht still wieder als Brocken erscheint.
    const codes = [
      "ask.query",
      "answer.helpful",
      "ko.document-appended",
      "ko.ownership",
      "ko.ownership-role",
      "ko.tags-changed",
      "ko.create-followup-failed",
      "ko.create-rollback-failed",
    ];
    for (const sprache of ["de", "en", "nl"]) {
      await i18n.changeLanguage(sprache);
      for (const code of codes) {
        const key = `audit.action.${code.replace(/[.-]/g, "_")}`;
        const wert = i18n.t(key);
        expect(wert, `${sprache}: ${key} fehlt`).not.toBe(key);
        expect(wert, `${sprache}: ${key} trägt die Humanisierung statt eines Namens`).not.toBe(
          code.replace(/[._-]/g, " "),
        );
      }
    }
    await i18n.changeLanguage("de");
    // Der Fall braucht eine gemountete Fläche nicht — aber `afterEach` hängt an ihr.
    await mount();
  });

  // ----------------------------------------------------------------------------------------------
  // FALL 2 — DER RÜCKFALL LEBT (Lieferung 2, letzter Satz)
  // ----------------------------------------------------------------------------------------------
  it("2 · ein unvorhergesehener Code erscheint humanisiert, nicht als roher Punktcode", async () => {
    box.ereignisse = [ereignis("voellig.unbekannt", 1)];
    await mount();
    const kette = await oeffne("herkunftskette");

    expect(text(kette), "der Rückfall wurde entfernt").toContain("voellig unbekannt");
    expect(text(kette), "der rohe Punktcode steht auf der Fläche").not.toContain(
      "voellig.unbekannt",
    );
  });

  // ----------------------------------------------------------------------------------------------
  // FALL 3 — LEERSTAND HERKUNFTSKETTE (Lieferung 4) samt Zustandsmodell
  // ----------------------------------------------------------------------------------------------
  it("3a · ohne Ereignisse steht ein Satz da — nicht nichts", async () => {
    box.ereignisse = [];
    await mount();
    const kette = await oeffne("herkunftskette");

    const satz = i18n.t("ko.lineageEventsEmpty");
    expect(satz).not.toBe("ko.lineageEventsEmpty");
    expect(text(kette), "der Leerstand schweigt weiterhin").toContain(satz);
    const knoten = satzKnoten(kette, satz);
    expect(knoten, "der Satz steht nicht als eigener Knoten").not.toBeNull();
    pruefeSichtbar(knoten as HTMLElement, kette);
    // Ehrlichkeit vor Optik: der Satz behauptet nicht, es sei nie etwas geschehen.
    expect(satz.toLowerCase()).toContain("verzeichnet");
  });

  it("3b · ein gescheiterter Abruf ist KEIN Beweis für Leere — Fehlerzeile statt Leersatz", async () => {
    box.ereignisseFehler = true;
    await mount();
    const kette = await oeffne("herkunftskette");

    expect(text(kette)).toContain(i18n.t("state.error"));
    expect(
      text(kette),
      "aus einem gescheiterten Abruf wird eine Bestandsaussage abgeleitet",
    ).not.toContain(i18n.t("ko.lineageEventsEmpty"));
  });

  // ----------------------------------------------------------------------------------------------
  // FALL 4 — LEERSTAND BELEGE MIT GÜLTIGEM NÄCHSTEN SCHRITT (Lieferung 5)
  // ----------------------------------------------------------------------------------------------
  it("4a · Rolle `experte`: Satz UND ein Weg, der wirklich zum Quellenformular führt", async () => {
    box.belege = [];
    box.rolle = "experte";
    await mount();
    const belege = await oeffne("belege");

    expect(text(belege)).toContain(i18n.t("ko.evidenceEmpty"));
    const weg = belege.querySelector<HTMLButtonElement>("[data-bib-beleg-leer-weg]");
    expect(weg, "der Leerstand bietet keinen nächsten Schritt an").not.toBeNull();
    const knopf = weg as HTMLButtonElement;
    // Ein echter Knopf in der Tabulator-Reihenfolge mit sprechendem zugänglichem Namen.
    expect(knopf.type).toBe("button");
    expect(knopf.disabled).toBe(false);
    expect(knopf.tabIndex).toBe(0);
    expect(knopf.getAttribute("aria-disabled")).not.toBe("true");
    const name = knopf.getAttribute("aria-label") ?? text(knopf);
    expect(name).toContain(i18n.t("ko.evidenceEmptyCta"));
    expect(name, "der Name sagt nicht, wohin der Weg führt").toContain(
      i18n.t("ko.evidenceEmptyCtaHint"),
    );
    pruefeSichtbar(knopf, belege);

    await klick(knopf);
    const quellen = abschnitt("quellen");
    expect(quellen, "der Abschnitt „quellen“ wurde nicht gemountet").not.toBeNull();
    const q = quellen as HTMLDetailsElement;
    expect(q.open, "der Weg führt nicht in den offenen Abschnitt").toBe(true);
    expect(document.activeElement, "der Fokus folgt dem Weg nicht").toBe(
      q.querySelector("summary"),
    );
    // UND dort steht wirklich ein Formular — sonst wäre der Weg eine Sackgasse.
    expect(
      q.querySelector("input"),
      "der Zielabschnitt trägt kein Eingabefeld für die Quelle",
    ).not.toBeNull();
  });

  it("4b · Rolle `viewer`: derselbe Satz, aber KEIN Knopf ins Leere", async () => {
    box.belege = [];
    box.rolle = "viewer";
    await mount();
    const belege = await oeffne("belege");

    expect(text(belege)).toContain(i18n.t("ko.evidenceEmpty"));
    expect(
      belege.querySelector("[data-bib-beleg-leer-weg]"),
      "einem Leser wird ein Weg angeboten, den seine Rolle nicht gehen kann",
    ).toBeNull();
    // Gegenprobe zur Rollenprüfung: der Zielabschnitt trägt für `viewer` wirklich kein Formular.
    await vonHand("quellen", true);
    expect(
      (abschnitt("quellen") as HTMLDetailsElement).querySelector("input"),
      "die Voraussetzung des Falls stimmt nicht — auch `viewer` sieht ein Formular",
    ).toBeNull();
  });

  // ----------------------------------------------------------------------------------------------
  // FALL 5 — ORIGINAL UND BELEGDATENSATZ IN WORTEN GETRENNT (Lieferung 3)
  // ----------------------------------------------------------------------------------------------
  it("5 · die Belegkarte nennt den Nachweis anders als die Sache, auf die er zeigt", async () => {
    box.belege = [beleg({ kind: "attachment", attachmentId: "att-1", objectId: "obj-1" })];
    await mount();
    const belege = await oeffne("belege");

    const art = i18n.t("ko.evidenceKind.attachment");
    const zumOriginal = i18n.t("ko.evidenceToOriginal");
    expect(text(belege), "die Art-Beschriftung fehlt").toContain(art);
    expect(text(belege), "der Weg zum Original fehlt").toContain(zumOriginal);
    // Zwei Namen für zwei Dinge: die Art benennt den BELEG, der Knopf das ORIGINAL.
    expect(art).not.toBe(zumOriginal);
    expect(art.toLowerCase(), "die Art sagt nicht, dass dies ein Beleg ist").toContain("beleg");
    expect(art.toLowerCase(), "die Art sagt nicht, worauf der Beleg zeigt").toContain("anhang");
    expect(zumOriginal.toLowerCase(), "der Knopf benennt das Original nicht").toContain("original");
    // Und dasselbe auf EN — sonst wäre der Unterschied nur auf einer Sprache da (E50d).
    await i18n.changeLanguage("en");
    const artEn = i18n.t("ko.evidenceKind.attachment");
    expect(artEn).not.toBe(art);
    expect(artEn.toLowerCase()).toContain("evidence");
    expect(artEn.toLowerCase()).toContain("attachment");
  });

  // ----------------------------------------------------------------------------------------------
  // FALL 6 — KEIN ENGLISCHER PROGRAMMBROCKEN MEHR IM DEUTSCHEN BELEGABSCHNITT (Lieferung 6)
  // ----------------------------------------------------------------------------------------------
  it("6 · die deutsche Anzeige des Belegabschnitts trägt „Evidence“ nicht mehr als Aussage", async () => {
    box.belege = [beleg({ kind: "attachment", attachmentId: "att-1", objectId: "obj-1" })];
    await mount();
    const belege = await oeffne("belege");

    // Der Konsistenzblock (`:1185`), die Fassungszeilen (`:1224`) und die Belegkarte stehen hier
    // alle im DOM — genau die Stellen, an denen das Wort als Hauptaussage stand.
    expect(
      text(belege),
      "der englische Programmbrocken „Evidence“ steht weiterhin in der deutschen Anzeige",
    ).not.toContain("Evidence");
  });
});
