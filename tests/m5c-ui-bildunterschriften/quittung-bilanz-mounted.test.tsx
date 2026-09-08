// @vitest-environment jsdom
// ================================================================================================
// JOB 3254 · M5c-UI — DIE IMPORT-QUITTUNG NENNT DIE BESCHRIFTUNGSBILANZ
// ================================================================================================
//
// DER BEFUND, den diese Datei rot gemacht hat: `extractDocxRich` führt seit JOB 3210
// `captionsAssigned` und `captionsAmbiguous` — und `Capture.tsx` las sie nicht. Wer ein Word-
// Dokument mit fünf gefundenen Beschriftungen importierte, bekam eine Quittung über Zeichen,
// Format und Bildverluste; über die Beschriftungen kein Wort. Genau die zwei Bilder mit der offenen
// Frage waren die, die nur er beantworten kann.
//
// GEMESSEN WIRD AM ECHTEN KLICKPFAD auf der gemounteten Erfassen-Fläche: Datei über die vorhandene
// Ablagefläche einlesen, lesen, was ein Mensch liest. Die .docx ist echtes OOXML aus demselben
// Bauer wie JOB 3210 (`tests/m5-docx-bildunterschriften/docx-bauen.ts`); keine Echtdaten.
//
// WARUM `readDocxRich` GESEAMT IST — und nur diese eine Funktion: der echte Wrapper komprimiert
// jedes Bild über `canvas.toDataURL` (`files.ts:downscaleImageDataUrl`), und jsdom hat kein Canvas.
// Der Seam ruft deshalb den ECHTEN `extractDocxRich` mit dem ARGUMENT, das `Capture.tsx` ihm
// übergibt, und lässt allein die Bildkompression aus. Er merkt sich das Ergebnis — damit prüft
// dieselbe Datei beide Hälften des Auftrags an EINEM Ablauf: die Bilanz in der Quittung und die
// Kennungen, aus denen der Editor die Kennzeichnung am einzelnen Bild macht.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const aufrufe = vi.hoisted(() => ({
  argumente: [] as (string | undefined)[][],
  ergebnisse: [] as { assigned: number; ambiguous: number; ids: readonly string[] }[],
}));

vi.mock("../../apps/web/src/lib/files", async (importActual) => {
  const echt = await importActual<typeof import("../../apps/web/src/lib/files")>();
  const docx = await import("../../apps/web/src/lib/docx");
  return {
    ...echt,
    readDocxRich: async (file: File, imageCaptionPlaceholder?: string) => {
      aufrufe.argumente.push([imageCaptionPlaceholder]);
      const reich = await docx.extractDocxRich(await file.arrayBuffer(), {
        mapImage: async (src) => src,
        imageBudgetBytes: docx.MAX_INLINE_BODY_HTML_BYTES,
        ...(imageCaptionPlaceholder ? { imageCaptionPlaceholder } : {}),
      });
      aufrufe.ergebnisse.push({
        assigned: reich.captionsAssigned,
        ambiguous: reich.captionsAmbiguous,
        ids: reich.captionsAmbiguousImageIds,
      });
      return reich;
    },
  };
});

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: {
        policy: vi.fn(async () => ({ stage: "search_on_click" })),
        search: vi.fn(async () => []),
      },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([]) },
      gaps: { list: ok([]) },
      objects: { upload: vi.fn(async () => ({ id: "obj-1", name: "pruefdokument.docx" })) },
      drafts: {
        list: ok([]),
        create: vi.fn(async (payload: { title?: string }) => ({
          id: "d-42",
          payload: { title: payload.title ?? "pruefdokument.docx" },
        })),
        update: vi.fn(async () => ({})),
        remove: vi.fn(async () => {}),
        promote: vi.fn(async () => ({})),
      },
      reasoner: {
        status: ok({ active: false, mode: "cloud", reachable: "inactive" }),
        config: ok(null),
        structure: vi.fn(async () => ({})),
        interview: vi.fn(async () => ({ question: "", done: true, demo: false })),
      },
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
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CAPTURE_FILE_TEXT } from "../../apps/web/src/lib/captureFromFile";
import { mehrdeutigeFussnotenJetzt } from "../../apps/web/src/lib/editorFigures";
import { CaptureArbeitsraum } from "../../apps/web/src/pages/Capture";
import {
  type Absatz,
  PNG_BLAU,
  PNG_ROT,
  alsPuffer,
  baueDocx,
} from "../m5-docx-bildunterschriften/docx-bauen";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};
if (typeof (globalThis.crypto as { randomUUID?: unknown } | undefined)?.randomUUID !== "function") {
  let n = 0;
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
  });
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
                  { initialEntries: ["/erfassen"] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/erfassen",
                      element: createElement(CaptureArbeitsraum, { modus: "datei" }),
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
}

function pageText(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

function txt(key: string, params?: Record<string, unknown>): string {
  return String(i18n.t(key, params ?? {})).replace(/\s+/g, " ");
}

/** Die .docx über die bestehende Ablagefläche einlesen — derselbe Seam wie der Dateidialog. */
async function docxEinlesen(
  absaetze: readonly Absatz[],
  name = "pruefdokument.docx",
): Promise<void> {
  const { bytes } = await baueDocx(absaetze);
  const zone = container.querySelector<HTMLElement>("[data-testid=capture-dropzone]");
  if (!zone) {
    throw new Error("Ablagefläche nicht gefunden");
  }
  // `alsPuffer` statt des Buffers: ein echtes `ArrayBuffer` ist ein `BlobPart`, ein Node-Buffer
  // (dessen `buffer` auch ein SharedArrayBuffer sein kann) im DOM-Typvertrag nicht.
  const file = new File([alsPuffer(bytes)], name, {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const ev = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "dataTransfer", { value: { files: [file] } });
  await act(async () => {
    zone.dispatchEvent(ev);
    await flush();
  });
}

/**
 * Das Dokument aus JOB 3210 · B3/R4: DREI eindeutig beschriftete Bilder und danach
 * Bild–Legende–Bild. `captionsAssigned: 3`, `captionsAmbiguous: 2` — der Fall, an dem die Fläche
 * heute nichts sagt.
 */
function dokumentB3(): Absatz[] {
  const absaetze: Absatz[] = [];
  for (let i = 1; i <= 3; i += 1) {
    absaetze.push({ art: "text", text: `Zum Abschnitt ${i} gehört eine Ansicht.` });
    absaetze.push({ art: "beschriftung", text: `Abbildung ${i}: Ansicht ${i}` });
    absaetze.push({ art: "bild", png: i % 2 === 0 ? PNG_BLAU : PNG_ROT });
  }
  absaetze.push({ art: "text", text: "Der Anhang zeigt zwei Details." });
  absaetze.push({ art: "bild", png: PNG_ROT, alt: "detail-a.png" });
  absaetze.push({ art: "beschriftung", text: "Abbildung 4: Offen" });
  absaetze.push({ art: "bild", png: PNG_BLAU, alt: "detail-b.png" });
  return absaetze;
}

/** Ein Dokument mit GENAU EINER eindeutigen Beschriftung. */
function dokumentEineEindeutige(): Absatz[] {
  return [
    { art: "text", text: "Ein einzelner Abschnitt." },
    { art: "beschriftung", text: "Abbildung 1: Einzelfall" },
    { art: "bild", png: PNG_ROT },
  ];
}

/** Zwei Bilder, KEINE Word-Beschriftung — die Nullregel. */
function dokumentOhneBeschriftung(): Absatz[] {
  return [
    { art: "text", text: "Zwei Ansichten ohne jede Beschriftung." },
    { art: "bild", png: PNG_ROT },
    { art: "text", text: "Und noch ein Satz dazwischen." },
    { art: "bild", png: PNG_BLAU },
  ];
}

/**
 * Sagt die Quittung überhaupt etwas über Bildunterschriften? Gemessen am ZAHLENFREIEN Rumpf der
 * drei Sätze — so trifft die Frage jede Zahl und jede Sprache, statt an einer erratenen Ziffer zu
 * hängen. Die Zahl wird mit einem Kennwert eingesetzt und wieder herausgeschnitten.
 */
function nenntBeschriftungen(): boolean {
  const text = pageText();
  const rumpf = (key: string, params: Record<string, unknown>): string =>
    txt(key, params)
      .replace(/\s*77\s*/g, " ")
      .trim();
  return [
    rumpf(CAPTURE_FILE_TEXT.captionsBalance, { assigned: 77, ambiguous: 77 }),
    rumpf(CAPTURE_FILE_TEXT.captionsBalanceAssigned, { assigned: 77 }),
    rumpf(CAPTURE_FILE_TEXT.captionsBalanceAmbiguous, { ambiguous: 77 }),
  ].some((satz) => text.replace(/\s*\d+\s*/g, " ").includes(satz));
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  aufrufe.argumente = [];
  aufrufe.ergebnisse = [];
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.clearAllMocks();
  await i18n.changeLanguage("de");
});

describe("JOB 3254 · A · die Quittung nennt die Beschriftungsbilanz", () => {
  it("A1 · drei übernommen, zwei unklar — in EINEM Satz, auf Deutsch", async () => {
    await mount();
    await docxEinlesen(dokumentB3());

    expect(pageText()).toContain(
      txt(CAPTURE_FILE_TEXT.captionsBalance, { assigned: 3, ambiguous: 2 }),
    );
    // Der lokalisierte Platzhalter ist wirklich durch die Fläche gereist — und NUR er: die
    // Kennzeichnung am Bild reist seit Runde 2 als Bildkennung, nicht als zweiter injizierter Text.
    expect(aufrufe.argumente).toEqual([[i18n.t("capture.file.imageCaptionPlaceholder")]]);
  });

  it("A2 · dasselbe Dokument auf Englisch: derselbe Satz mit denselben Zahlen", async () => {
    await i18n.changeLanguage("en");
    await mount();
    await docxEinlesen(dokumentB3());

    expect(pageText()).toContain(
      txt(CAPTURE_FILE_TEXT.captionsBalance, { assigned: 3, ambiguous: 2 }),
    );
    // Der englische Satz ist wirklich ein anderer als der deutsche (sonst prüfte A2 nichts).
    expect(i18n.t(CAPTURE_FILE_TEXT.captionsBalance, { assigned: 3, ambiguous: 2 })).not.toBe(
      i18n.getFixedT("de")(CAPTURE_FILE_TEXT.captionsBalance, { assigned: 3, ambiguous: 2 }),
    );
  });

  it("A3 · Sprachwechsel NACH dem Einlesen: der Satz steht sofort in der neuen Sprache", async () => {
    await mount();
    await docxEinlesen(dokumentB3());
    const deutsch = txt(CAPTURE_FILE_TEXT.captionsBalance, { assigned: 3, ambiguous: 2 });
    expect(pageText()).toContain(deutsch);

    await act(async () => {
      await i18n.changeLanguage("en");
      await flush();
    });

    const englisch = txt(CAPTURE_FILE_TEXT.captionsBalance, { assigned: 3, ambiguous: 2 });
    expect(pageText(), "Der Satz blieb in der alten Sprache stehen").toContain(englisch);
    expect(pageText(), "Der deutsche Satz steht immer noch da").not.toContain(deutsch);
  });

  it("A4 · Nullregel: ohne Word-Beschriftung sagt die Quittung über Beschriftungen NICHTS", async () => {
    await mount();
    await docxEinlesen(dokumentOhneBeschriftung());

    // Die Quittung selbst ist da (sonst prüfte dieser Fall nichts) …
    expect(pageText()).toContain(txt("capture.file.importNote.docx"));
    // … aber kein Wort über Bildunterschriften, weder „0 übernommen" noch „0 unklar".
    expect(nenntBeschriftungen(), "Es steht ein Null-Satz über Beschriftungen da").toBe(false);
  });

  it("A5 · zwei Läufe hintereinander: die Quittung nennt die Zahlen des ZWEITEN Dokuments", async () => {
    await mount();
    await docxEinlesen(dokumentB3());
    expect(pageText()).toContain(
      txt(CAPTURE_FILE_TEXT.captionsBalance, { assigned: 3, ambiguous: 2 }),
    );

    await docxEinlesen(dokumentEineEindeutige(), "zweites.docx");

    expect(pageText()).toContain(txt(CAPTURE_FILE_TEXT.captionsBalanceAssigned, { assigned: 1 }));
    // Keine Sammlung über beide Läufe (3 + 1 = 4) und kein Rest des ersten Satzes.
    expect(pageText()).not.toContain(
      txt(CAPTURE_FILE_TEXT.captionsBalance, { assigned: 3, ambiguous: 2 }),
    );
    expect(pageText()).not.toContain(
      txt(CAPTURE_FILE_TEXT.captionsBalanceAssigned, { assigned: 4 }),
    );
    // Und die zweite Hälfte fehlt zu Recht: es gab keine unklare Beschriftung.
    expect(pageText()).not.toContain(
      txt(CAPTURE_FILE_TEXT.captionsBalanceAmbiguous, { ambiguous: 0 }),
    );
  });
});

// ================================================================================================
// A6–A8 · DIE ZWEITE HÄLFTE AM ECHTEN ABLAUF — DIE KENNUNGEN ERREICHEN DEN EDITOR
// ================================================================================================
// Runde 1 ist genau hier gescheitert: die Kennzeichnung am Einzelbild reiste im Rumpf und wurde von
// den Sanitizern gestrippt, bevor ein Mensch sie sah. Seit Runde 2 reist sie als BILDKENNUNG über
// die Ablage in `editorFigures.ts`, aus der `RichTextEditor` bei jeder Verankerung liest. Diese
// Zusicherungen messen die Ablage NACH dem echten Einlesen auf der gemounteten Fläche — nicht die
// Absicht im Quelltext.
describe("JOB 3254 · A6–A8 · was der Editor über die mehrdeutigen Fussnoten erfährt", () => {
  it("A6 · nach dem Einlesen stehen GENAU die Kennungen des Dokuments bereit", async () => {
    await mount();
    await docxEinlesen(dokumentB3());

    const gelesen = aufrufe.ergebnisse.at(-1);
    expect(gelesen?.ambiguous, "Die Vorbedingung fehlt — das Dokument ist nicht mehrdeutig").toBe(
      2,
    );
    expect([...mehrdeutigeFussnotenJetzt()], "Die Kennungen erreichen den Editor nicht").toEqual(
      gelesen?.ids,
    );
  });

  it("A7 · ein Dokument OHNE mehrdeutige Beschriftung löscht die Auskunft des vorigen", async () => {
    await mount();
    await docxEinlesen(dokumentB3());
    expect(mehrdeutigeFussnotenJetzt().size).toBe(2);

    await docxEinlesen(dokumentEineEindeutige(), "zweites.docx");
    expect(
      [...mehrdeutigeFussnotenJetzt()],
      "Die Kennungen des ERSTEN Dokuments stehen noch am Editor (Lehre JOB 3239)",
    ).toEqual([]);
  });

  it("A8 · ein Nicht-DOCX-Import räumt die Auskunft ebenfalls — sie gehört zum gelesenen Dokument", async () => {
    await mount();
    await docxEinlesen(dokumentB3());
    expect(mehrdeutigeFussnotenJetzt().size).toBe(2);

    // Eine reine Textdatei über dieselbe Ablagefläche: sie hat keine Bilder und keine Fussnoten.
    const zone = container.querySelector<HTMLElement>("[data-testid=capture-dropzone]");
    if (!zone) {
      throw new Error("Ablagefläche nicht gefunden");
    }
    const ev = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(ev, "dataTransfer", {
      value: {
        files: [new File(["Ein reiner Text ohne Bilder."], "notiz.txt", { type: "text/plain" })],
      },
    });
    await act(async () => {
      zone.dispatchEvent(ev);
      await flush();
    });

    expect(
      [...mehrdeutigeFussnotenJetzt()],
      "Nach einem Import ohne Bilder behauptet der Editor weiter offene Fragen",
    ).toEqual([]);
  });
});
