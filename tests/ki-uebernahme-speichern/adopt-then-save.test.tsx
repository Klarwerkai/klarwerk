// @vitest-environment jsdom
// ================================================================================================
// JOB 3408 (KI-UEBERNAHME-SPEICHERN) — DER ZWEITE KLICK AUF „ENTWURF SICHERN" SCHREIBT WIEDER.
// ================================================================================================
//
// CODEX' BEDIENBEFUND (09.09. 15:18–15:23, Chrome gegen LIVE 1.229,
// `gespraech/arbeitsfenster-20260909/KI-UEBERNAHME-SPEICHERN.md`): eigener Entwurf, `recieved`
// ergänzt, „Entwurf sichern" (API quittiert `updatedAt 13:18:30.471Z`), KI → Rechtschreibung →
// Vorschlag `received`, „Übernehmen" (der Editor zeigt `received`), „Entwurf sichern" → NICHTS.
// Kein Laden, kein Erfolgshinweis, kein Fehler; die API trägt weiter `recieved`.
//
// DIE WURZEL: `saveRequestedRef` ist der Doppelklick-Schutz. Der Fehlerweg der Speichermutation
// löst ihn, der ERFOLGSWEG nicht — gelöst wurde er danach nur noch von den Tastatureingaben
// (`changeTitle`, `changeBodyHtml`) und vom Bereichswechsel. Wer nach dem ersten erfolgreichen
// Sichern nichts mehr TIPPT, sondern eine KI-Übernahme anklickt, kommt an dieser Sperre nie
// wieder vorbei.
//
// WIE HIER GEMESSEN WIRD (Auftrag §6, §8.1 und Lehre JOB 3376 R1): am ECHTEN Klickweg der
// gemounteten Fläche, und gezählt wird der AUSGEHENDE Schreibvorgang (`drafts.create`/`update`) —
// nicht der React-Zustand und nicht der Editorinhalt. R3 misst zusätzlich das Wiederöffnen gegen
// den beobachteten Schreibstand: eine frisch montierte Fläche mit `?draft=<id>` lädt das, was der
// Server WIRKLICH bekommen hat.
//
// Bauart übernommen von `tests/capture/frontdoor-discard-mounted.test.tsx` (dort: KI-Menü →
// Vorschlagskarte → „Verwerfen" an derselben Fläche); der Entwurfs-Pool nach dem Vorbild von
// `tests/capture/draft-save-fullstate-mounted.test.tsx`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Ein In-Memory-Entwurfsdienst: `create` legt an, `update` mischt teilweise (wie der echte Merge),
// `get` liest. Jeder Schreibvorgang wird MIT seiner Nutzlast protokolliert — das ist der Zähler,
// an dem dieser Test misst.
const db = vi.hoisted(() => {
  type Draft = { id: string; payload: Record<string, unknown>; updatedAt: string };
  const store = new Map<string, Draft>();
  const schreibvorgaenge: { art: "create" | "update"; payload: Record<string, unknown> }[] = [];
  let uhr = 0;
  const zeit = (): string => {
    uhr += 1;
    return `2026-09-09T13:00:0${uhr}.000Z`;
  };
  return {
    store,
    schreibvorgaenge,
    // Ein Schalter, mit dem der Fehlerweg (G2) und die offene Zeitlage (G1) gefahren werden.
    haenger: null as null | { aufloesen: () => void; ablehnen: (e: unknown) => void },
    scheitertEinmal: false,
    create: (payload: Record<string, unknown>): Draft => {
      schreibvorgaenge.push({ art: "create", payload });
      const draft = { id: `d${store.size + 1}`, payload: { ...payload }, updatedAt: zeit() };
      store.set(draft.id, draft);
      return draft;
    },
    update: (id: string, payload: Record<string, unknown>): Draft => {
      schreibvorgaenge.push({ art: "update", payload });
      const vorher = store.get(id);
      if (!vorher) {
        throw new Error(`Entwurf ${id} unbekannt`);
      }
      // Der echte Dienst mischt teilweise: fehlende Schlüssel lassen den Altwert stehen.
      const draft = { id, payload: { ...vorher.payload, ...payload }, updatedAt: zeit() };
      store.set(id, draft);
      return draft;
    },
    reset: () => {
      store.clear();
      schreibvorgaenge.length = 0;
      db.haenger = null;
      db.scheitertEinmal = false;
      uhr = 0;
    },
  };
});

const ki = vi.hoisted(() => ({
  assistText: "",
  strukturTitel: "",
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    reasoner: {
      status: vi.fn(async () => ({ active: true, mode: "cloud", reachable: "active" })),
      config: vi.fn(async () => null),
      structure: vi.fn(async () => ({
        title: ki.strukturTitel,
        statement: "Ventil vor der Wartung entlasten.",
        conditions: [],
        measures: [],
        tags: [],
        confidence: 70,
        demo: false,
      })),
      assist: vi.fn(async () => ({ text: ki.assistText, demo: false })),
    },
    drafts: {
      get: vi.fn(async (id: string) => {
        const draft = db.store.get(id);
        if (!draft) {
          throw new Error(`Entwurf ${id} unbekannt`);
        }
        return draft;
      }),
      list: vi.fn(async () => [...db.store.values()]),
      create: vi.fn(async (payload: Record<string, unknown>) => {
        if (db.scheitertEinmal) {
          db.scheitertEinmal = false;
          db.schreibvorgaenge.push({ art: "create", payload });
          throw new Error("Netz weg");
        }
        if (db.haenger) {
          const halten = db.haenger;
          db.schreibvorgaenge.push({ art: "create", payload });
          const draft = { id: `d${db.store.size + 1}`, payload: { ...payload }, updatedAt: "x" };
          await new Promise<void>((resolve, reject) => {
            halten.aufloesen = resolve;
            halten.ablehnen = reject;
          });
          db.store.set(draft.id, draft);
          return draft;
        }
        return db.create(payload);
      }),
      update: vi.fn(async (id: string, payload: Record<string, unknown>) => db.update(id, payload)),
      remove: vi.fn(async () => {}),
      promote: vi.fn(async () => ({})),
    },
    uploadLimits: {
      get: vi.fn(async () => ({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 })),
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { Blatt } from "../../apps/web/src/components/erfassen/Blatt";
import i18n from "../../apps/web/src/i18n";

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

async function mount(adresse = "/erfassen"): Promise<void> {
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
          ToastProvider,
          null,
          createElement(
            AuthProvider,
            null,
            createElement(
              MemoryRouter,
              { initialEntries: [adresse] },
              createElement(
                ImageDescribeProvider,
                null,
                createElement(
                  NavGuardProvider,
                  null,
                  createElement(Blatt, {
                    arbeitsraum: () => createElement("div", { "data-testid": "arbeitsraum" }),
                  }),
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

async function unmount(): Promise<void> {
  await act(async () => {
    root.unmount();
  });
  container.remove();
}

beforeEach(() => {
  db.reset();
  ki.assistText = "";
  ki.strukturTitel = "";
});

afterEach(async () => {
  if (root) {
    await unmount();
  }
  vi.clearAllMocks();
  if (i18n.language !== "de") {
    await i18n.changeLanguage("de");
  }
});

function sichernKnopf(): HTMLButtonElement {
  const btn = container.querySelector<HTMLButtonElement>('[data-testid="blatt-entwurf-sichern"]');
  if (!btn) {
    throw new Error("Der Knopf „Entwurf sichern“ ist nicht auf dem Blatt.");
  }
  return btn;
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

async function click(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
}

async function schreibeInsBlatt(html: string): Promise<void> {
  const editor = container.querySelector('[contenteditable="true"]');
  if (!editor) {
    throw new Error("Die Schreibfläche fehlt.");
  }
  await act(async () => {
    editor.innerHTML = html;
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

function editorHtml(): string {
  return container.querySelector("[contenteditable]")?.innerHTML ?? "";
}

// KI-Menü öffnen und einen Eintrag wählen — derselbe Weg, den ein Mensch geht.
async function kiWeg(eintrag: string): Promise<void> {
  const werkzeug = container.querySelector<HTMLButtonElement>('[data-testid="blatt-werkzeug-ki"]');
  if (!werkzeug) {
    throw new Error("Das Menü „KI“ ist nicht auf dem Blatt.");
  }
  await click(werkzeug);
  await click(buttonByText(eintrag));
}

function letzterRumpf(): string {
  const letzter = db.schreibvorgaenge.at(-1);
  return String(letzter?.payload.bodyHtml ?? "");
}

describe("JOB 3408 · Nach einer übernommenen KI-Korrektur speichert „Entwurf sichern“ wieder", () => {
  it("R1 — sichern → KI-Rechtschreibung übernehmen → sichern: ein ZWEITER Schreibvorgang trägt die Korrektur", async () => {
    ki.assistText = "Wir haben die Lieferung received.";
    await mount();
    await schreibeInsBlatt("<p>Wir haben die Lieferung recieved.</p>");

    await click(sichernKnopf());
    expect(db.schreibvorgaenge.length, "Der erste Klick schreibt einmal.").toBe(1);
    expect(letzterRumpf()).toContain("recieved");

    await kiWeg(i18n.t("capture.ai.action.spelling"));
    expect(container.textContent).toContain(i18n.t("fd.accept"));
    await click(buttonByText(i18n.t("fd.accept")));
    // Der Editor zeigt die Korrektur — das ist die Voraussetzung, nicht der Beleg.
    expect(editorHtml()).toContain("received");

    await click(sichernKnopf());
    // DER BELEG: ein zweiter AUSGEHENDER Schreibvorgang mit dem korrigierten Text.
    expect(db.schreibvorgaenge.length, "Der zweite Klick schreibt wieder.").toBe(2);
    expect(letzterRumpf()).toContain("received");
    expect(letzterRumpf()).not.toContain("recieved");
  }, 20000);

  it("R2 — dasselbe für die Struktur-/Titelübernahme: sichern → Vorschlag → übernehmen → sichern", async () => {
    ki.strukturTitel = "Ventil vor der Wartung entlasten";
    await mount();
    await schreibeInsBlatt("<p>ventil entlasten vor wartung</p>");

    await click(sichernKnopf());
    expect(db.schreibvorgaenge.length).toBe(1);
    const ersterTitel = String(db.schreibvorgaenge[0]?.payload.title ?? "");
    expect(ersterTitel).not.toBe(ki.strukturTitel);

    await kiWeg(i18n.t("erfassen.ki.struktur"));
    expect(container.textContent).toContain(i18n.t("fd.accept"));
    await click(buttonByText(i18n.t("fd.accept")));

    await click(sichernKnopf());
    expect(db.schreibvorgaenge.length, "Auch die Strukturübernahme ist wieder speicherbar.").toBe(
      2,
    );
    const zweiterTitel = String(db.schreibvorgaenge[1]?.payload.title ?? "");
    expect(zweiterTitel).toContain("Ventil vor der Wartung");
    expect(zweiterTitel).not.toBe(ersterTitel);
  }, 20000);

  it("R3 — Wiederöffnen: der erneut geladene Entwurf zeigt die Korrektur, nicht die alte Fassung", async () => {
    ki.assistText = "Wir haben die Lieferung received.";
    await mount();
    await schreibeInsBlatt("<p>Wir haben die Lieferung recieved.</p>");
    await click(sichernKnopf());
    await kiWeg(i18n.t("capture.ai.action.spelling"));
    await click(buttonByText(i18n.t("fd.accept")));
    await click(sichernKnopf());

    const id = [...db.store.keys()][0];
    expect(id, "Der Entwurf liegt beim Dienst.").toBeTruthy();
    // Gegen den beobachteten SCHREIBSTAND, nicht gegen den Editorzustand: neue Fläche, neuer Ladeweg.
    await unmount();
    await mount(`/erfassen?draft=${id}`);
    expect(editorHtml()).toContain("received");
    expect(editorHtml()).not.toContain("recieved");
  }, 20000);

  it("G1 — Doppelklickschutz: zwei Klicks während desselben laufenden Vorgangs schreiben genau EINMAL", async () => {
    db.haenger = { aufloesen: () => {}, ablehnen: () => {} };
    await mount();
    await schreibeInsBlatt("<p>Ein Satz, der gesichert werden will.</p>");

    const knopf = sichernKnopf();
    // Zwei Klicks, bevor der Vorgang antwortet — der zweite darf nicht schreiben.
    await act(async () => {
      knopf.click();
      knopf.click();
      await flush();
    });
    expect(db.schreibvorgaenge.length, "Zwei Klicks, EIN Schreibvorgang.").toBe(1);
    // Lieferung 2: Solange der Vorgang läuft, ist die Abweisung SICHTBAR — der Knopf trägt sie
    // (`busy` → `canSave` → `disabled`), der Klick geht nicht ins Leere.
    expect(sichernKnopf().disabled, "Der laufende Vorgang steht am Knopf.").toBe(true);

    await act(async () => {
      db.haenger?.aufloesen();
      await flush();
    });
    expect(db.schreibvorgaenge.length).toBe(1);
    expect(sichernKnopf().disabled, "Nach dem Erfolg nimmt der Knopf wieder an.").toBe(false);
  }, 20000);

  it("G2 — Fehlerweg: nach einem gescheiterten Speichern führt ein erneuter Klick zu einem neuen Schreibvorgang", async () => {
    db.scheitertEinmal = true;
    await mount();
    await schreibeInsBlatt("<p>Ein Satz, der beim ersten Mal scheitert.</p>");

    await click(sichernKnopf());
    expect(db.schreibvorgaenge.length).toBe(1);
    expect(db.store.size, "Gescheitert heisst: nichts liegt beim Dienst.").toBe(0);

    await click(sichernKnopf());
    expect(db.schreibvorgaenge.length, "Der zweite Versuch geht wieder hinaus.").toBe(2);
    expect(db.store.size).toBe(1);
  }, 20000);

  it("G3 — derselbe Weg auf Englisch: adopt → save schreibt ein zweites Mal", async () => {
    await i18n.changeLanguage("en");
    ki.assistText = "We have received the delivery.";
    await mount();
    await schreibeInsBlatt("<p>We have recieved the delivery.</p>");

    await click(sichernKnopf());
    expect(db.schreibvorgaenge.length).toBe(1);

    await kiWeg(i18n.t("capture.ai.action.spelling"));
    await click(buttonByText(i18n.t("fd.accept")));
    expect(editorHtml()).toContain("received");

    await click(sichernKnopf());
    expect(db.schreibvorgaenge.length).toBe(2);
    expect(letzterRumpf()).toContain("received");
  }, 20000);
});
