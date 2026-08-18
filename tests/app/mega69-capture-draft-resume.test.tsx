// @vitest-environment jsdom
// ================================================================================================
// JOB 504 / D3 — DIE VOLLSTÄNDIGE FALLMATRIX DES FORTGESETZTEN ENTWURFS, BEIDE RESUME-PFADE.
// ================================================================================================
//
// DER AUFTRAGSTEXT IST DAS D2-URTEIL (`_relay/kopf/outbox/BEN-PRUEFUNG-JOB-504-D2.md`), dort
// Korrekturpflicht 6, wörtlich: „Für beide Resume-Pfade die fünf Einzelfälle `fehlend`, `null`,
// `ungültig`, `intern` und `vertraulich` kausal prüfen. Zusätzlich die Persistenzkette einer
// ausdrücklich gewählten `intern`-Deklaration testen."
//
// WORUM ES SACHLICH GEHT. Ein fortgesetzter Entwurf trägt eine Vertraulichkeitsstufe — oder eben
// nicht. Die Oberfläche braucht daraus ZWEI verschiedene Werte, und sie zu vermischen war der
// Befund aus BEN-D1:
//   · die ANZEIGE im Formular normalisiert auf „intern" (`confidentialityOf`) — ein Auswahlfeld
//     muss einen Wert zeigen;
//   · die MODELL-PROVENIENZ bekommt den ROHEN Wert (`declaredConfidentiality`), damit
//     `failSafeConfidentiality` das FEHLEN selbst sieht. Wer hier den geglätteten Wert übergibt,
//     macht aus einem nie erklärten Feld eine ausdrückliche Cloud-Freigabe — Bild und umgebender
//     Kontext gingen an den externen Anbieter.
//
// ================================================================================================
// WAS DIESE DATEI BAUT — UND WAS SIE AUSDRÜCKLICH NICHT NOCHMAL BAUT.
// ================================================================================================
//
// Am Startpin dieses Durchgangs ist die PRODUKTSEITE der Pflicht bereits erfüllt: beide Flächen
// führen `declaredConfidentiality` und übergeben es an den `ImageDescribeProvider`
// (`CaptureFrontDoor.tsx:887`, `Capture.tsx:3310`, beide mit dem Kommentar „JOB 504 D2"). Der
// Auftrag verlangt für diesen Fall Messbeleg und kausalen Wächter statt blindem Nachbau.
//
// Vier der zehn Matrixfelder tragen bereits dauerhafte Wächter. Sie werden hier NICHT wiederholt —
// eine zweite Fassung derselben Zusage wäre Doppelbau. Stattdessen hält Teil C fest, dass sie
// wirklich dort stehen; verschwindet einer, wird diese Datei rot und die Matrix bleibt geschlossen.
//
//   Vordertür · fehlend      → tests/capture/mega69-bildweg-mounted.test.tsx
//   Erfassen  · fehlend      → tests/capture/draft-save-fullstate-mounted.test.tsx
//   Erfassen  · intern       → tests/capture/draft-save-fullstate-mounted.test.tsx
//   Erfassen  · vertraulich  → tests/capture/draft-save-fullstate-mounted.test.tsx
//
// HIER GEBAUT werden die sechs offenen Felder und die Persistenzkette.
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ================================================================================================
// DIE SONDE — dieselbe Bauform wie in `draft-save-fullstate-mounted.test.tsx` (übernommen, nicht
// erfunden): beobachtet wird der Provenance-Wert, den die Seite dem Provider WIRKLICH übergibt.
// Kein Quelltext-String, sondern das Ergebnis des echten Resume-Pfads (Laden → State → Prop).
// Die übrigen Kontext-Exporte bleiben bedient, damit kein Aufrufer im Baum ins Leere läuft.
// ================================================================================================
const describeProvenance = vi.hoisted(() => ({ last: undefined as unknown }));

vi.mock("../../apps/web/src/app/ImageDescribeContext", () => ({
  ImageDescribeProvider: ({
    provenance,
    children,
  }: { provenance?: unknown; children?: unknown }) => {
    // Nur die INNERE, von der Seite gesetzte Provenienz zählt. Der äußere Provider der App-Schale
    // rendert ohne Prop; würde er mitgezählt, überschriebe sein `undefined` die Messung.
    if (provenance !== undefined) {
      describeProvenance.last = provenance;
    }
    return children as JSX.Element;
  },
  ImageDescribeValueProvider: ({ children }: { children?: unknown }) => children as JSX.Element,
  useImageDescribe: () => ({
    available: false,
    describe: async () => ({ text: null, demo: true }),
  }),
}));

const db = vi.hoisted(() => {
  const store: { id: string; payload: unknown; [k: string]: unknown }[] = [];
  const created: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];
  return {
    store,
    created,
    updated,
    create: (payload: Record<string, unknown>) => {
      created.push(payload);
      const draft = {
        id: `d${store.length + 1}`,
        payload,
        originalAuthor: "u1",
        lastEditor: "u1",
        createdAt: "2026-07-25T10:00:00.000Z",
        updatedAt: "2026-07-25T10:00:00.000Z",
      };
      store.push(draft);
      return draft;
    },
    reset: () => {
      store.length = 0;
      created.length = 0;
      updated.length = 0;
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
      external: { policy: ok({ stage: "search_on_click" }) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([]) },
      gaps: { list: ok([]) },
      drafts: {
        list: vi.fn(async () => [...db.store]),
        get: vi.fn(async (id: string) => db.store.find((d) => d.id === id) ?? null),
        create: vi.fn(async (p: Record<string, unknown>) => db.create(p)),
        update: vi.fn(async (_id: string, p: Record<string, unknown>) => {
          db.updated.push(p);
          return {};
        }),
        remove: vi.fn(async () => {}),
        promote: vi.fn(async () => ({})),
      },
      reasoner: {
        status: ok({ active: true, mode: "cloud", reachable: "active" }),
        config: ok(null),
        structure: vi.fn(async () => ({})),
        assist: vi.fn(async () => ({})),
        describeImage: vi.fn(async () => ({ text: null, demo: true })),
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
import { Capture } from "../../apps/web/src/pages/Capture";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(url: string, seite: "erfassen" | "frontdoor"): Promise<void> {
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
                  { initialEntries: [url] },
                  createElement(
                    Routes,
                    null,
                    seite === "erfassen"
                      ? createElement(Route, {
                          path: "/erfassen",
                          element: createElement(Capture),
                        })
                      : createElement(Route, {
                          path: "/capture/frontdoor",
                          element: createElement(CaptureFrontDoor),
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

function buttonByText(part: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(part),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${part}“ nicht gefunden`);
  }
  return btn;
}

function maybeButtonByText(part: string): HTMLButtonElement | null {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(part),
  );
  return btn instanceof HTMLButtonElement ? btn : null;
}

async function click(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
}

/** Der ECHTE Klickpfad des Arbeitsraums: Liste aufklappen → „Fortsetzen". */
async function fortsetzenImErfassen(): Promise<void> {
  const expand = maybeButtonByText("Entwürfe anzeigen");
  if (expand) {
    await click(expand);
  }
  await click(buttonByText(i18n.t("capture.resume")));
}

function seedDraft(payload: Record<string, unknown>): void {
  db.store.push({
    id: "d-seed",
    payload,
    originalAuthor: "u1",
    lastEditor: "u1",
    createdAt: "2026-07-25T10:00:00.000Z",
    updatedAt: "2026-07-25T10:00:00.000Z",
  });
}

/** Die gemessene Stufe — genau der Wert, der beim Bildbeschreibungs-Egress ankommt. */
function gemesseneStufe(): string | undefined {
  return (describeProvenance.last as { confidentiality?: string } | undefined)?.confidentiality;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  db.reset();
  describeProvenance.last = undefined;
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

// ================================================================================================
// TEIL A1 — DIE VORDERTÜR (`/capture/frontdoor?draft=…`), VIER OFFENE FELDER.
// ================================================================================================
//
// Der Deep-Link ist der Weg, den Klara nach dem Senden baut (taskpane.html). Geladen wird über
// `endpoints.drafts.get`; der Rohwert aus `payload.confidentiality` muss unverfälscht bis zur
// Provenienz durchreisen.
describe("JOB 504 D3 · Vordertür: der rohe Herkunftswert des fortgesetzten Entwurfs", () => {
  it("`null` ist KEINE Deklaration — fail-closed „vertraulich“", async () => {
    // Ein ausdrückliches `null` ist genauso wenig eine erklärte Stufe wie ein fehlendes Feld. Es
    // darf sich nicht an `confidentialityOf` vorbei zu „intern" glätten.
    db.store.push({ id: "d-null", payload: { title: "Ohne Stufe", confidentiality: null } });
    await mount("/capture/frontdoor?draft=d-null", "frontdoor");
    expect(gemesseneStufe()).toBe("vertraulich");
    expect(gemesseneStufe()).not.toBe("intern");
  });

  it("ein UNGÜLTIGER Wert wird nicht geglättet — fail-closed „vertraulich“", async () => {
    // Ein unbekannter Wert (Altbestand, fremder Schreiber, Tippfehler) ist kein Freibrief. Genau
    // hier gehen `confidentialityOf` (glättet zu „intern") und `failSafeConfidentiality`
    // (verschärft zu „vertraulich") auseinander — die Provenienz MUSS die zweite Regel benutzen.
    db.store.push({ id: "d-bad", payload: { title: "Fremd", confidentiality: "geheim" } });
    await mount("/capture/frontdoor?draft=d-bad", "frontdoor");
    expect(gemesseneStufe()).toBe("vertraulich");
  });

  it("ein gespeichertes „intern“ bleibt „intern“ — die bewusste Auswahl wird nicht verschärft", async () => {
    // Die Gegenrichtung, und sie ist genauso wichtig: ein fail-closed, das ALLES verschärft, wäre
    // kein Wächter, sondern ein kaputter Schalter. Ohne diesen Fall wären die beiden oberen auch
    // dann grün, wenn die Seite konstant „vertraulich" übergäbe.
    db.store.push({ id: "d-int", payload: { title: "Bewusst intern", confidentiality: "intern" } });
    await mount("/capture/frontdoor?draft=d-int", "frontdoor");
    expect(gemesseneStufe()).toBe("intern");
  });

  it("ein gespeichertes „vertraulich“ bleibt „vertraulich“ — kein Downgrade", async () => {
    db.store.push({
      id: "d-vtr",
      payload: { title: "Nicht nach draussen", confidentiality: "vertraulich" },
    });
    await mount("/capture/frontdoor?draft=d-vtr", "frontdoor");
    expect(gemesseneStufe()).toBe("vertraulich");
  });
});

// ================================================================================================
// TEIL A2 — DER ARBEITSRAUM (`/erfassen`, Liste → „Fortsetzen"), ZWEI OFFENE FELDER.
// ================================================================================================
//
// `origin: "tell"` hält den Entwurf im Arbeitsraum; „frontdoor" würde `loadDraft` zur Vordertür
// umleiten (`Capture.tsx:1803`) und damit den anderen Pfad messen.
describe("JOB 504 D3 · Erfassen: der rohe Herkunftswert des fortgesetzten Entwurfs", () => {
  it("`null` ist KEINE Deklaration — fail-closed „vertraulich“", async () => {
    seedDraft({ title: "Ohne Stufe", statement: "Text", origin: "tell", confidentiality: null });
    await mount("/erfassen", "erfassen");
    await fortsetzenImErfassen();
    expect(gemesseneStufe()).toBe("vertraulich");
    expect(gemesseneStufe()).not.toBe("intern");
  });

  it("ein UNGÜLTIGER Wert wird nicht geglättet — fail-closed „vertraulich“", async () => {
    seedDraft({ title: "Fremd", statement: "Text", origin: "tell", confidentiality: "geheim" });
    await mount("/erfassen", "erfassen");
    await fortsetzenImErfassen();
    expect(gemesseneStufe()).toBe("vertraulich");
  });
});

// ================================================================================================
// TEIL B — DIE PERSISTENZKETTE EINER AUSDRÜCKLICH GEWÄHLTEN „INTERN“-DEKLARATION.
// ================================================================================================
//
// D2-Urteil, Rotgrund 5: „Insbesondere muss ausgeschlossen werden, dass die bestehende bedingte
// Speicherung von `intern` eine ausdrücklich gewählte Deklaration verliert." Eine sichtbare
// Standardanzeige genügt dafür nicht — die Kette muss über die SPEICHERUNG laufen.
//
// Gemessen wird deshalb in zwei Gliedern:
//   1. Was der Speicherweg wirklich in die Payload schreibt (`drafts.create`-Aufzeichnung).
//   2. Was ein daraus erneut geladener Entwurf an die Provenienz übergibt.
// Zwischen beiden liegt kein Testwissen, sondern nur die echte Payload.
describe("JOB 504 D3 · gewähltes „intern“ überlebt Speichern und erneutes Laden", () => {
  it("Auswahl → Speicherung → erneutes Laden → Provenienz „intern“", async () => {
    seedDraft({
      title: "Bewusst intern",
      statement: "Frei nutzbar",
      origin: "tell",
      confidentiality: "intern",
    });
    await mount("/erfassen", "erfassen");
    await fortsetzenImErfassen();

    // Glied 1: die Stufe steht wirklich in der gespeicherten Payload — nicht nur im Formular.
    const gespeichert = db.store[0]?.payload as { confidentiality?: unknown };
    expect(gespeichert.confidentiality).toBe("intern");

    // Glied 2: derselbe Wert reist aus dem GELADENEN Entwurf zur Provenienz. Wäre die Speicherung
    // bedingt und ließe „intern" weg, käme hier fail-closed „vertraulich" an — und der Nutzer
    // verlöre still seine ausdrückliche Freigabe.
    expect(gemesseneStufe()).toBe("intern");
  });

  it("Gegenprobe der Kette: OHNE gespeicherte Stufe endet dieselbe Kette bei „vertraulich“", async () => {
    // Ohne diesen Fall wäre der Test oben auch dann grün, wenn die Provenienz konstant „intern"
    // meldete. Erst der Unterschied belegt, dass die Kette wirklich die Payload trägt.
    seedDraft({ title: "Ohne Stufe", statement: "Frei nutzbar", origin: "tell" });
    await mount("/erfassen", "erfassen");
    await fortsetzenImErfassen();
    const gespeichert = db.store[0]?.payload as { confidentiality?: unknown };
    expect(gespeichert.confidentiality).toBeUndefined();
    expect(gemesseneStufe()).toBe("vertraulich");
  });
});

// ================================================================================================
// TEIL C — DAS DECKUNGSREGISTER DER VIER AUSGELAGERTEN MATRIXFELDER.
// ================================================================================================
//
// Die Matrix aus Korrekturpflicht 6 hat zehn Felder. Sechs stehen oben; vier tragen bereits
// dauerhafte Wächter und werden nicht doppelt gebaut. Dieses Register hält fest, DASS es sie gibt —
// es ersetzt sie nicht und behauptet keine eigene Laufzeitwirkung. Verschwindet einer, wird diese
// Datei rot und die Lücke ist sichtbar, statt still zu entstehen.
const AUSGELAGERT: readonly { feld: string; datei: string; anker: string }[] = [
  {
    feld: "Vordertür · fehlend",
    datei: "tests/capture/mega69-bildweg-mounted.test.tsx",
    anker: "Entwurf OHNE Vertraulichkeitsfeld",
  },
  {
    feld: "Erfassen · fehlend",
    datei: "tests/capture/draft-save-fullstate-mounted.test.tsx",
    anker: "FEHLENDES Feld bleibt fail-closed",
  },
  {
    feld: "Erfassen · intern",
    datei: "tests/capture/draft-save-fullstate-mounted.test.tsx",
    anker: "GESPEICHERTES „intern“ bleibt „intern“",
  },
  {
    feld: "Erfassen · vertraulich",
    datei: "tests/capture/draft-save-fullstate-mounted.test.tsx",
    anker: "GESPEICHERTES „vertraulich“ bleibt „vertraulich“",
  },
];

describe("JOB 504 D3 · die Matrix ist geschlossen", () => {
  it("jedes ausgelagerte Feld hat seinen Wächter noch an Ort und Stelle", () => {
    const fehlen = AUSGELAGERT.filter((e) => !readFileSync(e.datei, "utf8").includes(e.anker)).map(
      (e) => `${e.feld} → ${e.datei} („${e.anker}“)`,
    );
    expect(
      fehlen,
      "Ein ausgelagerter Matrixfall ist verschwunden oder umbenannt. Entweder den Wächter " +
        "wiederherstellen oder den Fall hier aufnehmen — die Matrix darf nicht still schrumpfen.",
    ).toEqual([]);
  });

  it("zehn Felder, keines doppelt: sechs hier, vier ausgelagert", () => {
    // Ein reiner Zählvertrag gegen das stille Wachsen des Registers: würde jemand ein hier
    // gebautes Feld zusätzlich auslagern, stünde es zweimal — genau der Doppelbau, den diese
    // Datei vermeidet.
    expect(AUSGELAGERT).toHaveLength(4);
    expect(new Set(AUSGELAGERT.map((e) => e.feld)).size).toBe(4);
  });
});
