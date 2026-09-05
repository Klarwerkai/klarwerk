// @vitest-environment jsdom
// ================================================================================================
// JOB 2659 · D2 — DIE DECKUNG, DIE AUCH NACH DER MARKE GILT: gemessen DORT, WO DER MENSCH HANDELT.
// ================================================================================================
//
// BEN (2659 D1, Prüflücke 3): „Konkreter UI-/Integrationstest der gemounteten Ask-Seite:
// Halluzination und `KEINE_DECKUNG` dürfen nicht gerendert werden; stattdessen muss der Mensch den
// belegten Quellenwortlaut beziehungsweise die sichtbare Wissenslücke erhalten."
//
// WIE GEMESSEN WIRD: die echte `Ask`-Seite, gemountet. Hinter `endpoints.ask.ask` steht KEINE
// handgeschriebene Antwort, sondern die ECHTE Kette KoService → AskService → Reasoner, in der nur
// das Modell ein Fake ist — genau das Modell, das das Review beschreibt. Der Endpunkt-Mock ist die
// Wire-Grenze (Clientabruf); Renderer und Zustand sind das Produkt. Gelesen wird `textContent`.
//
//   U1 · GEGENPROBE: das gedeckte Modell — der Mensch liest die Modellantwort in der Antwortkarte.
//   U2 · BENs Fall `Gedeckter Satz [1]. Ventil sofort tauschen.` — der Mensch liest den
//        Quellenwortlaut, nirgends „tauschen".
//   U3 · Halluzination mit Marke (DIN 99999, 1234 bar) — Quellenwortlaut, nirgends die Erfindung.
//   U4 · `KEINE_DECKUNG` — die sichtbare Wissenslücke, nirgends das rohe Wort.
//   U5 · Text ohne Marke — ebenfalls die Wissenslücke, nicht die Prosa.
import { afterEach, describe, expect, it, vi } from "vitest";

import { InMemoryGapRepo } from "../../services/ask/src/repo";
import { AskService } from "../../services/ask/src/service";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { type ModelClient, Reasoner } from "../../services/reasoner";
import { ABSAGE_MARKE, ModelProvider } from "../../services/reasoner/src/provider-model";

const kette = vi.hoisted(() => ({
  ask: null as null | ((frage: string) => Promise<unknown>),
  kos: [] as unknown[],
}));

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ko: { list: vi.fn(async () => kette.kos) },
    conflicts: { list: vi.fn(async () => []) },
    directory: { list: vi.fn(async () => []) },
    gaps: { list: vi.fn(async () => []) },
    reasoner: {
      status: vi.fn(async () => ({
        active: true,
        mode: "cloud",
        reachable: "active",
        tasks: { answer: true },
      })),
    },
    ask: {
      // Der Clientabruf: dieselbe Wire-Form wie POST /api/ask ({ result, gap, receipt }), erzeugt
      // von der echten Service-Kette — nicht von Hand.
      ask: vi.fn(async (frage: string) => kette.ask?.(frage)),
      helpful: vi.fn(),
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
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Ask } from "../../apps/web/src/pages/Ask";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

const QUELLENWORTLAUT = "Bei Überdruck das Ventil X manuell schließen.";
const FRAGE = "Was tun bei Überdruck am Ventil?";

function fake(text: string): ModelClient {
  return { name: "fake", complete: async () => text };
}

/** Die echte Kette hinter dem Endpunkt — nur das Modell ist ein Fake. */
async function verdrahten(modell: ModelClient, statement: string = QUELLENWORTLAUT): Promise<void> {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  await koService.activateSearchProjectionV2();
  const ventil = await koService.create({
    title: "Ventil bei Überdruck schließen",
    statement,
    type: "best_practice",
    category: "Anlage 1",
    author: "anna",
  });
  await koService.setValidationState(ventil.id, { trust: 92, status: "validiert" });
  const ask = new AskService({
    reasoner: new Reasoner(new ModelProvider(modell)),
    koService,
    gaps: new InMemoryGapRepo(),
    audit: new AuditService({ repo: new InMemoryAuditRepo() }),
  });
  kette.kos = await koService.list();
  kette.ask = (frage) => ask.ask(frage, "pedi");
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mountAsk(): Promise<{ container: HTMLElement; unmount: () => void }> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          MemoryRouter,
          { initialEntries: ["/fragen"] },
          createElement(ToastProvider, null, createElement(Ask)),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

/** Eine Frage tippen und absenden — der Weg, den auch Pedi geht. */
async function fragen(container: HTMLElement, frage: string): Promise<void> {
  const feld = container.querySelector<HTMLInputElement>("form input");
  expect(feld, "die Fragen-Seite hat kein Eingabefeld").not.toBeNull();
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(feld, frage);
    (feld as HTMLInputElement).dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(async () => {
    (container.querySelector("form") as HTMLFormElement).dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await flush();
  });
  await act(flush);
  await act(flush);
}

async function seite(
  modell: ModelClient,
  statement: string = QUELLENWORTLAUT,
): Promise<{ container: HTMLElement; unmount: () => void }> {
  await i18n.changeLanguage("de");
  await verdrahten(modell, statement);
  const s = await mountAsk();
  await fragen(s.container, FRAGE);
  return s;
}

function antwortkarte(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('[data-testid="ask-answer"]');
}
function luecke(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('[data-testid="ask-gap"]');
}

/**
 * Der Kartentext, in dem die FUSSNOTENMARKE wieder als `[n]` steht.
 *
 * JOB 3064 · H5 setzt die Marke, die das Modell als „[1]" liefert, als Hochstellung (Zielbild
 * `Fragen.dc.html` Z.40/41) — `textContent` liest danach „… Ventil B 1." statt „… Ventil B [1].".
 * Die Zusage dieser Datei ist davon NICHT berührt: sie lautet „der Mensch liest den Wortlaut der
 * Quelle, nicht Modellprosa", und der Wortlaut ist unverändert — nur die Marke ist gesetzt statt
 * geklammert. Gemessen wird deshalb weiter der VOLLE Wortlaut mitsamt Marke, aus dem DOM
 * zurückgelesen. Verschluckte die Fläche die Ziffer, stünde hier „Ventil B ." und der Fall wäre
 * rot — die Messung ist also strenger als ein blosses `toContain` ohne Marke.
 */
function kartentextMitMarken(karte: HTMLElement | null): string {
  if (!karte) {
    return "";
  }
  const klon = karte.cloneNode(true) as HTMLElement;
  for (const sup of klon.querySelectorAll<HTMLElement>("sup[data-fussnote]")) {
    sup.textContent = `[${sup.getAttribute("data-fussnote") ?? ""}]`;
  }
  return klon.textContent ?? "";
}

afterEach(() => {
  vi.clearAllMocks();
  kette.ask = null;
  kette.kos = [];
  document.body.innerHTML = "";
});

describe("JOB 2659 · U — die gemountete Ask-Seite zeigt Quellenwortlaut oder Wissenslücke, nie Prosa", () => {
  it("U1 · GEGENPROBE: das gedeckte Modell — die Modellantwort steht in der Antwortkarte", async () => {
    const text = "Bei Überdruck das Ventil X manuell schließen [1].";
    const { container, unmount } = await seite(fake(text));
    const karte = antwortkarte(container);
    expect(karte, "keine Antwortkarte — die Gegenprobe misst ins Leere").not.toBeNull();
    expect(karte?.textContent ?? "").toContain("Ventil X manuell schließen");
    expect(luecke(container)).toBeNull();
    unmount();
  });

  it("U2 · BENs Fall: „Gedeckter Satz [1]. Ventil sofort tauschen.“ — der Mensch liest die Quelle", async () => {
    const { container, unmount } = await seite(
      fake(`${QUELLENWORTLAUT.slice(0, -1)} [1]. Ventil sofort tauschen.`),
    );
    const karte = antwortkarte(container);
    expect(karte, "keine Antwortkarte").not.toBeNull();
    expect(karte?.textContent ?? "").toContain(QUELLENWORTLAUT);
    expect(
      container.textContent ?? "",
      "der erfundene Nachsatz erreicht den Menschen",
    ).not.toContain("tauschen");
    unmount();
  });

  it("U3 · Halluzination mit Marke — Quellenwortlaut, nirgends DIN 99999 oder 1234 bar", async () => {
    const { container, unmount } = await seite(
      fake('Laut DIN 99999 liegt der Grenzwert bei 1234 bar. "Zitat aus Quelle 7". [1]'),
    );
    const karte = antwortkarte(container);
    expect(karte).not.toBeNull();
    expect(karte?.textContent ?? "").toContain(QUELLENWORTLAUT);
    const text = container.textContent ?? "";
    expect(text).not.toContain("DIN 99999");
    expect(text).not.toContain("1234");
    expect(text).not.toContain("Quelle 7");
    unmount();
  });

  it("U4 · KEINE_DECKUNG — die sichtbare Wissenslücke, nirgends das rohe Wort", async () => {
    const { container, unmount } = await seite(fake(ABSAGE_MARKE));
    expect(luecke(container), "keine sichtbare Wissenslücke").not.toBeNull();
    expect(container.textContent ?? "").toContain(i18n.t("ask.noBasisTitle"));
    expect(container.textContent ?? "").not.toContain(ABSAGE_MARKE);
    expect(antwortkarte(container)).toBeNull();
    unmount();
  });

  it("U5 · Text ohne Marke — die Wissenslücke, nicht die Prosa", async () => {
    const { container, unmount } = await seite(fake("Bei Überdruck sollte man irgendwas tun."));
    expect(luecke(container)).not.toBeNull();
    expect(container.textContent ?? "").not.toContain("irgendwas tun");
    expect(antwortkarte(container)).toBeNull();
    unmount();
  });

  // D3 (BEN-PRUEFUNG-JOB-2659-D2, Prüflücke 2): der Rollenwechsel aus denselben Wörtern, durch die
  // echte Service-Kette bis zum Renderer.
  it("U6 · Quelle „Ventil A öffnen. Ventil B schließen.“ · Modell „Ventil A schließen [1].“ — der Mensch liest die Quelle, nirgends die falsche Zuordnung", async () => {
    const QUELLE_AB = "Ventil A öffnen. Ventil B schließen.";
    const { container, unmount } = await seite(fake("Ventil A schließen [1]."), QUELLE_AB);
    const karte = antwortkarte(container);
    expect(karte, "keine Antwortkarte").not.toBeNull();
    expect(karte?.textContent ?? "").toContain(QUELLE_AB);
    expect(
      container.textContent ?? "",
      "die falsch zugeordnete Handlung erreicht den Menschen",
    ).not.toContain("Ventil A schließen");
    expect(luecke(container)).toBeNull();
    unmount();
  });

  // D4 (BEN-PRUEFUNG-JOB-2659-D3, Prüflücke 1): der Satzgrenzenverlust, durch die echte Kette.
  it("U7 · Quelle „Pruefen Sie Ventil A. Schliessen Sie Ventil B.“ · Modell „Ventil A schliessen [1].“ — der Mensch liest die Quelle, nie „Ventil A schliessen“", async () => {
    const QUELLE = "Pruefen Sie Ventil A. Schliessen Sie Ventil B.";
    const { container, unmount } = await seite(fake("Ventil A schliessen [1]."), QUELLE);
    const karte = antwortkarte(container);
    expect(karte, "keine Antwortkarte").not.toBeNull();
    expect(karte?.textContent ?? "").toContain(QUELLE);
    expect(
      container.textContent ?? "",
      "der Satz über die Satzgrenze erreicht den Menschen",
    ).not.toContain("Ventil A schliessen");
    expect(luecke(container)).toBeNull();
    unmount();
  });

  it("U7b · GEGENPROBE (BEN): „Schliessen Sie Ventil B [1].“ steht in einem Satz der Quelle und erscheint als Zitat", async () => {
    const { container, unmount } = await seite(
      fake("Schliessen Sie Ventil B [1]."),
      "Pruefen Sie Ventil A. Schliessen Sie Ventil B.",
    );
    expect(kartentextMitMarken(antwortkarte(container))).toContain("Schliessen Sie Ventil B [1].");
    unmount();
  });

  // D5 (BEN-PRUEFUNG-JOB-2659-D4, Prüflücke 1): das schließende Anführungszeichen, durch die Kette.
  it("U8 · Quelle „Pruefen Sie Ventil A.“ Schliessen Sie Ventil B. (mit Anführungszeichen) · Modell „Ventil A schliessen [1].“ — der Mensch liest die Quelle", async () => {
    const QUELLE = "„Pruefen Sie Ventil A.“ Schliessen Sie Ventil B.";
    const { container, unmount } = await seite(fake("Ventil A schliessen [1]."), QUELLE);
    const karte = antwortkarte(container);
    expect(karte, "keine Antwortkarte").not.toBeNull();
    expect(karte?.textContent ?? "").toContain(QUELLE);
    expect(container.textContent ?? "").not.toContain("Ventil A schliessen");
    expect(luecke(container)).toBeNull();
    unmount();
  });

  it("U8b · dasselbe mit Klammer: (Pruefen Sie Ventil A.) Schliessen Sie Ventil B.", async () => {
    const QUELLE = "(Pruefen Sie Ventil A.) Schliessen Sie Ventil B.";
    const { container, unmount } = await seite(fake("Ventil A schliessen [1]."), QUELLE);
    expect(antwortkarte(container)?.textContent ?? "").toContain(QUELLE);
    expect(container.textContent ?? "").not.toContain("Ventil A schliessen");
    unmount();
  });

  it("U8c · GEGENPROBE: der Satz in den Anführungszeichen ist Zitat und erscheint", async () => {
    const { container, unmount } = await seite(
      fake("Pruefen Sie Ventil A [1]"),
      "„Pruefen Sie Ventil A.“ Schliessen Sie Ventil B.",
    );
    expect(kartentextMitMarken(antwortkarte(container))).toContain("Pruefen Sie Ventil A [1]");
    unmount();
  });

  it("U6b · GEGENPROBE: die richtige Zuordnung „Ventil B schließen [1].“ geht als Zitat durch", async () => {
    const { container, unmount } = await seite(
      fake("Ventil B schließen [1]."),
      "Ventil A öffnen. Ventil B schließen.",
    );
    const karte = antwortkarte(container);
    expect(karte).not.toBeNull();
    expect(kartentextMitMarken(karte)).toContain("Ventil B schließen [1].");
    unmount();
  });
});
