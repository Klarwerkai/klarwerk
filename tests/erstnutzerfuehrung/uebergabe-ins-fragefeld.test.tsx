// @vitest-environment jsdom
// ================================================================================================
// R-0474 · RUNDE 2 (Ben B1) — DIE ANGEBOTENE FRAGE KOMMT IM FRAGEFELD AN, NICHT NUR IN DER ADRESSE.
// ================================================================================================
//
// BENS GEGENBELEG: Palette auf `/fragen?q=Alte%20Frage` geöffnet, Nulltreffer „zzqx Hydraulikdruck"
// → Klick oder Enter. Die Adresse wechselte, im Fragefeld stand weiter „Alte Frage": der Router
// montiert `/fragen` bei einem reinen Adresswechsel nicht neu, und `Ask` las `?q=` nur als
// Initialwert. Die Runde-1-Fälle maßen nur `pathname + search` und sahen das nicht.
//
// GEMESSEN WIRD DESHALB AM ECHTEN FRAGEFELD: echte Routen (`/start`, `/fragen`, `/hilfe`), echte
// `Ask`, echte `CommandPalette`, echte `Help`. Ersetzt sind nur die Rollenquelle (fest `viewer`
// aus einer Sitzung) und die Datenendpunkte (leer, kein Netz). Es wird NICHT abgeschickt — die
// Übergabe füllt nur vor (SCRUM-272), und das wird mitgeprüft.
//   Ü1  Ausgang /start → Klick: das Feld trägt die Nulltreffer-Eingabe.
//   Ü2  Ausgang /fragen?q=Alte Frage → Klick: das Feld wechselt auf die neue Eingabe.
//   Ü3  Ausgang /fragen?q=Alte Frage → Enter: dasselbe.
//   Ü4  Ausgang /fragen, eigene Eingabe im Feld, Palette-Nulltreffer: die angebotene Frage gewinnt.
//   Ü5  Hilfe → Link: das Feld trägt das Stichwort.
//   Ü6  Kein Auto-Ask: keine der Übergaben stellt die Frage.
//
// RUNDE 3 (Ben B3) — DERSELBE WECHSEL MIT AUSDRÜCKLICHEM ANTWORTWUNSCH (`ask=1`, `askAnswerHref`):
// auf der schon offenen Seite wurde die ALTE Frage gesendet, das Feld zeigte danach die neue.
//   A1  /fragen?q=Alte Frage → askAnswerHref("Neue Frage"): gesendet GENAU „Neue Frage", Feld ebenso.
//   A2  frisch /fragen?q=Alte Frage&ask=1 → „Alte Frage" einmal; danach askAnswerHref("Neue Frage")
//       → zusätzlich GENAU „Neue Frage" (ein Schuss je Navigation, nicht je Montage).
//   A3  Gegenprobe ohne ask=1 (askQuestionHref) auf der offenen Seite: nichts gesendet, Feld neu.
//   A4  Kein zweiter Schuss: ein erneutes Rendern derselben Navigation sendet nicht nochmals.
import { afterEach, describe, expect, it, vi } from "vitest";

const aufrufe = vi.hoisted(() => ({ ask: [] as string[] }));

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "viewer", stufe2: false, isSessionRole: true }),
}));
vi.mock("../../apps/web/src/api/endpoints", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../apps/web/src/api/endpoints")>();
  return {
    endpoints: {
      ...original.endpoints,
      ...ERSATZ,
    },
  };
});
// Nur was die zwei Seiten abrufen, wird ersetzt; der Rest (z. B. die Upload-Grenzen der Hilfe)
// bleibt die echte Tabelle — deren Abrufe laufen ohne Netz ins Leere und stören keinen Fall.
const ERSATZ = vi.hoisted(() => ({
  ko: { list: vi.fn(async () => []) },
  conflicts: { list: vi.fn(async () => []) },
  directory: { list: vi.fn(async () => []) },
  reasoner: {
    status: vi.fn(async () => ({
      active: true,
      mode: "cloud",
      reachable: "active",
      tasks: { answer: true },
    })),
  },
  ask: {
    ask: vi.fn(async (frage: string) => {
      aufrufe.ask.push(frage);
      throw new Error("in diesem Test wird nicht gefragt");
    }),
    helpful: vi.fn(),
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  MemoryRouter,
  type NavigateFunction,
  Route,
  Routes,
  useNavigate,
} from "../../apps/web/node_modules/react-router-dom";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { askAnswerHref, askQuestionHref } from "../../apps/web/src/lib/askQuestion";
import { Ask } from "../../apps/web/src/pages/Ask";
import { Help } from "../../apps/web/src/pages/Help";
import { CommandPalette } from "../../apps/web/src/shell/CommandPalette";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

const NEU = "zzqx Hydraulikdruck";
const ALT = "Alte Frage";

/** Hält den echten `navigate` des Routers fest — so navigiert der Test wie ein Link, ohne Neumontage. */
let lenken: NavigateFunction | null = null;
function Lenker(): null {
  lenken = useNavigate();
  return null;
}

async function gehe(ziel: string): Promise<void> {
  await act(async () => {
    lenken?.(ziel);
  });
  await ruhe();
}

interface Stand {
  container: HTMLDivElement;
  root: Root;
}
let stand: Stand | null = null;

afterEach(() => {
  if (stand) {
    const s = stand;
    act(() => s.root.unmount());
    s.container.remove();
    stand = null;
  }
  aufrufe.ask.length = 0;
});

async function ruhe(): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

async function montiere(pfad: string): Promise<Stand> {
  await i18n.changeLanguage("de");
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          ToastProvider,
          null,
          createElement(
            MemoryRouter,
            { initialEntries: [pfad] },
            createElement(
              NavGuardProvider,
              null,
              createElement(CommandPalette),
              createElement(Lenker),
              createElement(
                Routes,
                null,
                createElement(Route, { path: "/start", element: createElement("p", null, "S") }),
                createElement(Route, { path: "/fragen", element: createElement(Ask) }),
                createElement(Route, { path: "/hilfe", element: createElement(Help) }),
              ),
            ),
          ),
        ),
      ),
    );
  });
  stand = { container, root };
  await ruhe();
  return stand;
}

/** Das Fragefeld der Fragen-Seite — das Eingabefeld IM Formular (die Palette hat keins). */
function fragefeld(s: Stand): HTMLInputElement {
  const feld = s.container.querySelector<HTMLInputElement>("form input");
  if (!feld) {
    throw new Error("Die Fragen-Seite ist nicht montiert.");
  }
  return feld;
}

async function tippe(feld: HTMLInputElement, text: string): Promise<void> {
  const setzer = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setzer?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function paletteFeld(s: Stand): HTMLInputElement {
  const feld = s.container.querySelector<HTMLInputElement>('[data-cmd="suchfeld"]');
  if (!feld) {
    throw new Error("„Gehe zu …“ ist nicht offen.");
  }
  return feld;
}

async function paletteMitNulltreffer(s: Stand): Promise<void> {
  await act(async () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true, cancelable: true }),
    );
  });
  await tippe(paletteFeld(s), NEU);
  expect(s.container.querySelector('[data-cmd="als-frage"]'), "kein Frage-Angebot").not.toBeNull();
}

async function klickeAngebot(s: Stand): Promise<void> {
  await act(async () => {
    s.container.querySelector<HTMLButtonElement>('[data-cmd="als-frage"]')?.click();
  });
  await ruhe();
}

async function enter(s: Stand): Promise<void> {
  await act(async () => {
    paletteFeld(s).dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  await ruhe();
}

describe("R-0474 · Ben B1 — die Palette übergibt die Eingabe bis ins Fragefeld", () => {
  it("Ü1: Ausgang /start → Klick: das Fragefeld trägt die Eingabe", async () => {
    const s = await montiere("/start");
    await paletteMitNulltreffer(s);
    await klickeAngebot(s);
    expect(fragefeld(s).value).toBe(NEU);
  });

  it("Ü2: Ausgang /fragen?q=Alte Frage → Klick: das Feld wechselt auf die neue Eingabe", async () => {
    const s = await montiere(`/fragen?q=${encodeURIComponent(ALT)}`);
    expect(fragefeld(s).value, "Kalibrierung: die alte Frage steht vorher da").toBe(ALT);
    await paletteMitNulltreffer(s);
    await klickeAngebot(s);
    expect(fragefeld(s).value).toBe(NEU);
  });

  it("Ü3: Ausgang /fragen?q=Alte Frage → Enter: das Feld wechselt auf die neue Eingabe", async () => {
    const s = await montiere(`/fragen?q=${encodeURIComponent(ALT)}`);
    expect(fragefeld(s).value).toBe(ALT);
    await paletteMitNulltreffer(s);
    await enter(s);
    expect(fragefeld(s).value).toBe(NEU);
  });

  it("Ü4: Ausgang /fragen mit eigener Eingabe → das Angebot ersetzt sie; ohne Übergabe bleibt sie", async () => {
    const s = await montiere("/fragen");
    await tippe(fragefeld(s), "selbst getippt");
    await ruhe();
    expect(fragefeld(s).value, "Gegenprobe: ohne Übergabe bleibt die eigene Eingabe").toBe(
      "selbst getippt",
    );
    await paletteMitNulltreffer(s);
    await klickeAngebot(s);
    expect(fragefeld(s).value).toBe(NEU);
    expect(aufrufe.ask, "Ü6: die Übergabe stellt die Frage nicht").toEqual([]);
  });
});

describe("R-0474 · die Hilfe übergibt das Stichwort bis ins Fragefeld", () => {
  it("Ü5/Ü6: Hilfe → Link „als Frage stellen“ → das Fragefeld trägt das Stichwort, nichts gefragt", async () => {
    const s = await montiere("/hilfe");
    const suche = s.container.querySelector<HTMLInputElement>('[data-testid="hilfe-suche"]');
    if (!suche) {
      throw new Error("Die Hilfeseite hat kein Suchfeld.");
    }
    await tippe(suche, NEU);
    await act(async () => {
      s.container.querySelector<HTMLAnchorElement>('[data-testid="hilfe-als-frage"]')?.click();
    });
    await ruhe();
    expect(fragefeld(s).value).toBe(NEU);
    expect(aufrufe.ask).toEqual([]);
  });
});

describe("R-0474 · Ben B3 — Antwortlink (ask=1) auf der schon offenen Fragen-Seite", () => {
  const ALT_Q = `/fragen?q=${encodeURIComponent(ALT)}`;
  const NEUE = "Neue Frage";

  it("A1: /fragen?q=Alte Frage → askAnswerHref(Neue Frage): gesendet wird genau die neue Frage", async () => {
    const s = await montiere(ALT_Q);
    expect(fragefeld(s).value).toBe(ALT);
    expect(aufrufe.ask, "Kalibrierung: ohne ask=1 nichts gesendet").toEqual([]);
    await gehe(askAnswerHref(NEUE));
    expect(fragefeld(s).value).toBe(NEUE);
    expect(aufrufe.ask).toEqual([NEUE]);
  });

  it("A2: frisch mit ask=1 → alte Frage einmal; danach Antwortlink → genau zusätzlich die neue", async () => {
    const s = await montiere(askAnswerHref(ALT));
    expect(aufrufe.ask, "frische Montage sendet ihre Frage einmal").toEqual([ALT]);
    await gehe(askAnswerHref(NEUE));
    expect(fragefeld(s).value).toBe(NEUE);
    expect(aufrufe.ask).toEqual([ALT, NEUE]);
  });

  it("A3: Gegenprobe ohne ask=1 auf der offenen Seite: nur vorbefüllt, nichts gesendet", async () => {
    const s = await montiere(ALT_Q);
    await gehe(askQuestionHref(NEUE));
    expect(fragefeld(s).value).toBe(NEUE);
    expect(aufrufe.ask).toEqual([]);
  });

  it("A4: derselbe Stand, weiteres Tippen löst keinen zweiten Schuss aus", async () => {
    const s = await montiere(ALT_Q);
    await gehe(askAnswerHref(NEUE));
    await tippe(fragefeld(s), "weiter getippt");
    await ruhe();
    expect(aufrufe.ask).toEqual([NEUE]);
  });
});
