// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega32 BLOCK E — WAS DER LESER STATTDESSEN SIEHT.
// ================================================================================================
//
// Der reine Ableitungstest (ask-check-caveat.test.ts) belegt, dass der Vertrag eine Stufe
// heruntergeht. Dieser Test fährt die ECHTE Ask-Seite und belegt die andere Hälfte von Pedis
// Entscheidung: dass der Prüfvorbehalt SICHTBAR ist und benennt, worauf er sich bezieht.
import { afterEach, describe, expect, it, vi } from "vitest";

const bestand = vi.hoisted(() => ({
  kos: [] as unknown[],
}));

// AUFTRAG-mega71 Block E: Ask stellt die Rollenfrage jetzt am RoleLink-Tor (useRole). Diese Datei
// prüft NICHT die Rollen-Lage (das tun der mega70/71-Rohlink-Sammler und mega51-mounted am Tor
// selbst) — sie mountet die Fläche wie mega69-ask-kostenhinweis mit fester Expertinnen-Rolle.
vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ko: { list: vi.fn(async () => bestand.kos) },
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
      ask: vi.fn(async () => ({
        result: {
          answered: true,
          answer: "Ventil V4 wird jährlich geprüft.",
          knowledgeClass: "gesichert",
          trust: 90,
          sources: ["k1"],
          // mega53 B1: die Antwort steht auf dieser Quelle — ohne Zuordnung koennte sie
          // seit mega53 gar nicht mehr "gesichert" heissen (das ist der Fall in
          // tests/ask/mega53-zwei-faelle.test.ts).
          citedSources: ["k1"],
          steps: [],
          demo: false,
          captionSources: [],
        },
        gap: null,
        receipt: "r",
      })),
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

const PROVEN = {
  available: 4,
  selected: 4,
  alreadyOpen: 0,
  attempted: 4,
  completed: 4,
  skipped: 0,
  capped: false,
  aborted: false,
};
// Der Lauf meldet „done", nichts übersprungen, nichts abgebrochen — nur gedeckelt. Bens Fall.
const CAPPED = {
  ...PROVEN,
  available: 12479,
  selected: 20,
  attempted: 20,
  completed: 20,
  capped: true,
};

function ko(aiCheck: unknown) {
  return {
    id: "k1",
    title: "Ventilprüfung",
    statement: "Ventil V4 wird jährlich geprüft.",
    type: "best_practice",
    category: "Betrieb",
    status: "validiert",
    trust: 90,
    author: "u1",
    createdAt: "2026-01-01T00:00:00.000Z",
    aiCheck,
  };
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
          { initialEntries: ["/fragen?q=Ventil&ask=1"] },
          createElement(ToastProvider, null, createElement(Ask)),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  // ============================================================================================
  // JOB 3064 H5 NACHGEFÜHRT, nicht gelockert.
  // ============================================================================================
  // Vertrag, Statusplakette, Evidenzplakette, Prüfvorbehalt und Quellenliste stehen seit dem Umbau
  // nach `design/klarwerk/Fragen.dc.html` nicht mehr dauerhaft unter der Antwort, sondern hinter
  // „…" → „Mehr" an der Antwortkarte (Auftrag §5). Jede Zusage dieser Datei bleibt wörtlich —
  // besonders die VERNEINUNGEN („nirgends mehr Gesichert", „kein Vorbehalt"): die wären bei
  // geschlossenem Blatt geschenkt. Deshalb wird hier für JEDEN Fall geöffnet, und ab da über
  // `document.body` gemessen (das Blatt ist dorthin portaliert, s. `Seitenblatt.tsx`) — also über
  // Fläche UND Blatt, die echte Obermenge dessen, was der Leser bekommt.
  await act(async () => {
    container.querySelector<HTMLButtonElement>('[data-testid="ask-menu"]')?.click();
    await flush();
  });
  await act(async () => {
    container.querySelector<HTMLButtonElement>('[data-testid="ask-menu-punkt-mehr"]')?.click();
    await flush();
  });
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

// AUFTRAG-mega33 A4: der Test darf nicht mehr nur das Fehlen EINES Titels prüfen — und dieser
// Titel lautete nicht einmal „Gesichert". Geprüft wird jetzt das Fehlen des WORTES in allem, was
// der Leser bekommt: sichtbarer Text UND Export.
// Kein \b-Anker: `textContent` klebt die Plaketten aneinander („GesichertEvidenz: Gesichert“),
// eine Wortgrenze gäbe es dort nie. Geprüft wird das WORT in seiner Anzeigeform (großes G) —
// beiläufige Kleinschreibung in Fließtext („nicht als gesichert eingestuft“) ist keine Behauptung.
const GESICHERT = "Gesichert";

async function copyToClipboard(container: HTMLElement): Promise<string> {
  const copied: string[] = [];
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: async (v: string) => void copied.push(v) },
    configurable: true,
  });
  const button = Array.from(container.querySelectorAll("button")).find((b) =>
    (b.textContent ?? "").includes(i18n.t("ask.export.copy")),
  );
  expect(button, "Kopieren-Schaltfläche nicht gefunden").toBeTruthy();
  await act(async () => {
    button?.click();
    await flush();
  });
  expect(copied).toHaveLength(1);
  return copied[0] ?? "";
}

describe("mega32 E / mega33 A · die Antwortansicht sagt nicht mehr „gesichert“, wenn sie es nicht weiß", () => {
  it("gedeckelte Quelle: der Prüfvorbehalt steht da und benennt seinen Bezug", async () => {
    await i18n.changeLanguage("de");
    bestand.kos = [ko({ status: "done", coverage: CAPPED })];
    const { unmount } = await mountAsk();
    const text = document.body.textContent ?? "";

    // Der Vorbehalt ist sichtbar …
    expect(document.querySelector('[data-testid="ask-check-caveat"]')).not.toBeNull();
    expect(text).toContain(i18n.t("ask.checkCaveat.title"));
    // … und benennt, worauf er sich bezieht: 1 von 1 herangezogenen Quellen.
    expect(text).toContain("1 von 1");
    expect(text).toContain("nicht vollständig gelaufen");

    // Der Vertrag steht eine Stufe darunter — NICHT mehr „gesichert“.
    expect(text).toContain(i18n.t("ask.contract.unverified.title"));
    expect(text).not.toContain(i18n.t("ask.contract.verified.title"));

    // Und die betroffene Quelle trägt die Plakette, damit der Vorbehalt zuordenbar ist.
    expect(document.querySelector('[data-testid="ask-source-unproven"]')).not.toBeNull();
    unmount();
  });

  it("A4 · gedeckelte Quelle: NIRGENDS mehr „Gesichert“ — weder sichtbar noch exportiert", async () => {
    await i18n.changeLanguage("de");
    bestand.kos = [ko({ status: "done", coverage: CAPPED })];
    const { container, unmount } = await mountAsk();
    const text = document.body.textContent ?? "";

    // 1 Vertragskasten · 2 Statusplakette · 3 Evidenzplakette — alles, was der Leser SIEHT.
    expect(text).not.toContain(GESICHERT);
    expect(text).toContain(i18n.t("ask.status.unverified"));
    expect(text).toContain(`${i18n.t("ask.evidence")}: ${i18n.t("ask.knowledgeClass.ungeprueft")}`);
    // 4 Review-Wächter: er schweigt nicht mehr, nur weil die rohe Klasse „gesichert“ sagt.
    expect(text).toContain(i18n.t("ask.reviewGuard.unverifiedLabel"));

    // 5 Kopieren / Markdown-Download — die Form, die das Haus verlässt.
    const markdown = await copyToClipboard(container);
    expect(markdown).not.toContain(GESICHERT);
    expect(markdown).toContain(i18n.t("ask.status.unverified"));
    expect(markdown).toContain(
      `${i18n.t("ask.evidence")}: ${i18n.t("ask.knowledgeClass.ungeprueft")}`,
    );
    unmount();
  });

  it("A4-Gegenprobe: mit belegtem Lauf steht „Gesichert“ sichtbar UND im Export", async () => {
    await i18n.changeLanguage("de");
    bestand.kos = [ko({ status: "done", coverage: PROVEN })];
    const { container, unmount } = await mountAsk();
    const text = document.body.textContent ?? "";

    // Ohne diese Gegenprobe wäre die Zusage oben auch von einer Seite erfüllt, die das Wort
    // überhaupt nie zeigt — die Prüfung muss in beide Richtungen kalibriert sein.
    expect(text).toContain(GESICHERT);
    expect(await copyToClipboard(container)).toContain(GESICHERT);
    unmount();
  });

  it("gar kein Prüf-Lauf: eigener Satz, nicht derselbe", async () => {
    await i18n.changeLanguage("de");
    bestand.kos = [ko(undefined)];
    const { unmount } = await mountAsk();
    const text = document.body.textContent ?? "";

    expect(document.querySelector('[data-testid="ask-check-caveat"]')).not.toBeNull();
    expect(text).toContain("gar kein Prüf-Lauf vermerkt");
    expect(text).not.toContain("nicht vollständig gelaufen");
    unmount();
  });

  it("belegt vollständiger Lauf: kein Vorbehalt, und „gesichert“ darf stehen bleiben", async () => {
    await i18n.changeLanguage("de");
    bestand.kos = [ko({ status: "done", coverage: PROVEN })];
    const { unmount } = await mountAsk();
    const text = document.body.textContent ?? "";

    // Kein Dauerrauschen.
    expect(document.querySelector('[data-testid="ask-check-caveat"]')).toBeNull();
    expect(document.querySelector('[data-testid="ask-source-unproven"]')).toBeNull();
    // Und der Vertrag darf jetzt sagen, was er belegen kann.
    expect(text).toContain(i18n.t("ask.contract.verified.title"));
    unmount();
  });
});
