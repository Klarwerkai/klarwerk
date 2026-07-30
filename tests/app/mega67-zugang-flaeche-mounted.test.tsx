// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega67 BLOCK C + D — DIE FLÄCHE: ZUSTÄNDE MIT EIGENEN TEXTEN, KEIN GEHEIMNIS, KEIN FELD.
// AUFTRAG-mega69 BLOCK B3 (bens sammel65-Auflage 3): der Vertrag ist ehrlich auf die DREI in der
// echten Fläche erreichbaren Zustände verengt — „not-built" war unerreichbar (die einzige
// Produktionsaufrufstelle übergab fest "active") und ist samt Testbehauptung entfernt. Der
// Testname darf nicht mehr behaupten als der Beleg trägt.
// ================================================================================================
//
// Die drei Zustände werden am ECHTEN Bauteil belegt (nicht an der puren Ableitung allein), weil der
// Fehler, um den es geht, ein Anzeige-Fehler ist: ein Text, der mehr behauptet als ablesbar ist.
//
// Zwei Fälle tragen den Block:
//  · „kein Eingabefeld" — geprüft am gerenderten DOM, nicht an der Absicht. Ein Formular, das ein
//    Geheimnis entgegennimmt, ohne es sicher abzulegen, wäre schlimmer als keines; mit Pedis
//    Entscheidung vom 30.07. (Umgebungsvariable) braucht es das Feld nie.
//  · „kein Wert, keine Maske mit Länge" — ebenfalls am DOM. Eine Maske sähe hilfreich aus und
//    verriete die Länge des Geheimnisses.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "admin" }),
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    importAccess: { confluence: vi.fn() },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { endpoints } from "../../apps/web/src/api/endpoints";
import type { ImportAccessStatus } from "../../apps/web/src/api/types";
import { ImportAccessPanel } from "../../apps/web/src/components/ImportAccessPanel";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const zugangMock = endpoints.importAccess.confluence as unknown as ReturnType<typeof vi.fn>;

const VARS = [
  "KLARWERK_CONFLUENCE_BASE_URL",
  "KLARWERK_CONFLUENCE_USER",
  "KLARWERK_CONFLUENCE_TOKEN",
  "KLARWERK_CONFLUENCE_SPACE",
];

function antwort(over: Partial<ImportAccessStatus> = {}): ImportAccessStatus {
  return {
    system: "confluence",
    enabled: true,
    credentials: VARS.map((name) => ({ name, present: true })),
    credentialsUsable: true,
    blocker: null,
    lastConnectedAt: null,
    ...over,
  };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<{ container: HTMLElement; unmount: () => void }> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(QueryClientProvider, { client }, createElement(ImportAccessPanel)));
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

const zustand = (c: HTMLElement): string | null =>
  c.querySelector("[data-testid=import-access-state]")?.getAttribute("data-state") ?? null;
const zustandText = (c: HTMLElement): string =>
  c.querySelector("[data-testid=import-access-state]")?.textContent ?? "";

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("mega67 D / mega69 B3 · drei erreichbare Zustände, drei EIGENE Texte", () => {
  it("eingeschaltet + Zugangsdaten stehen → ready", async () => {
    zugangMock.mockResolvedValue(antwort());
    const { container, unmount } = await mount();
    expect(zustand(container)).toBe("ready");
    // Und ausdrücklich NICHT „verbunden": das wüsste nur ein echter Aufruf an Confluence, und
    // genau den verbietet Block C.
    expect(zustandText(container)).not.toMatch(/verbunden/i);
    unmount();
  });

  it("eingeschaltet, aber Zugangsdaten fehlen → no-credentials, mit Grund", async () => {
    zugangMock.mockResolvedValue(
      antwort({
        credentials: VARS.map((name) => ({
          name,
          present: name !== "KLARWERK_CONFLUENCE_TOKEN",
        })),
        credentialsUsable: false,
        blocker: "missing",
      }),
    );
    const { container, unmount } = await mount();
    expect(zustand(container)).toBe("no-credentials");
    expect(container.querySelector("[data-testid=import-access-blocker]")).not.toBeNull();
    // Die eine fehlende Variable ist BENANNT und als fehlend markiert — das ist die Antwort auf
    // „warum geht das nicht".
    expect(
      container
        .querySelector("[data-testid=import-access-var-KLARWERK_CONFLUENCE_TOKEN]")
        ?.getAttribute("data-present"),
    ).toBe("no");
    expect(
      container
        .querySelector("[data-testid=import-access-var-KLARWERK_CONFLUENCE_USER]")
        ?.getAttribute("data-present"),
    ).toBe("yes");
    unmount();
  });

  // „Ausgeschaltet" heißt bei uns WÖRTLICH, dass die Route nicht existiert. Der Text darf deshalb
  // nicht „vorübergehend nicht verfügbar" sagen — das verspräche, dass es von selbst wiederkommt.
  it("ausgeschaltet → disabled, und NICHT „vorübergehend nicht verfügbar“", async () => {
    zugangMock.mockResolvedValue(antwort({ enabled: false }));
    const { container, unmount } = await mount();
    expect(zustand(container)).toBe("disabled");
    expect(container.textContent ?? "").not.toMatch(/vorübergehend/i);
    expect(container.textContent ?? "").toMatch(/nicht eingeschaltet/i);
    unmount();
  });

  // Der stille Fall: alle vier stehen, und es geht trotzdem nicht. Ohne eigenen Grund wäre er von
  // „eine fehlt" ununterscheidbar.
  it("alle Variablen stehen, aber unverschlüsselte Adresse → eigener, benannter Grund", async () => {
    zugangMock.mockResolvedValue(
      antwort({ credentialsUsable: false, blocker: "insecure-base-url" }),
    );
    const { container, unmount } = await mount();
    expect(zustand(container)).toBe("no-credentials");
    const grund = container.querySelector("[data-testid=import-access-blocker]")?.textContent ?? "";
    expect(grund).toMatch(/https/i);
    // Nicht derselbe Text wie „es fehlt etwas" — je Zustand ein eigener Text.
    expect(grund).not.toMatch(/fehlt/i);
    unmount();
  });

  // mega69 B3: DREI Fälle für DREI Zustände — der frühere Name „die vier Texte" behauptete einen
  // vierten, den weder die Fälle noch die echte Fläche je erzeugt haben.
  it("die drei Texte sind wirklich VERSCHIEDEN (kein geliehener Text)", async () => {
    const faelle: Partial<ImportAccessStatus>[] = [
      {},
      { credentialsUsable: false, blocker: "missing" },
      { enabled: false },
    ];
    const texte: string[] = [];
    for (const fall of faelle) {
      zugangMock.mockResolvedValue(antwort(fall));
      const { container, unmount } = await mount();
      texte.push(zustandText(container));
      unmount();
    }
    expect(new Set(texte).size).toBe(texte.length);
  });
});

describe("mega67 C · die Fläche nimmt KEIN Geheimnis entgegen und zeigt keines", () => {
  // Der tragende Fall des Blocks. Geprüft am gerenderten DOM, nicht an der Absicht: ein Feld, das
  // ein Geheimnis annimmt, ohne es sicher abzulegen, wäre schlimmer als keines.
  it("kein Eingabefeld, kein Formular, kein Speichern-Knopf", async () => {
    zugangMock.mockResolvedValue(antwort());
    const { container, unmount } = await mount();
    expect(container.querySelectorAll("input").length).toBe(0);
    expect(container.querySelectorAll("textarea").length).toBe(0);
    expect(container.querySelectorAll("form").length).toBe(0);
    expect(container.querySelectorAll("button").length).toBe(0);
    unmount();
  });

  it("kein Wert und KEINE MASKE MIT LÄNGE — nur die Namen und Ja/Nein", async () => {
    zugangMock.mockResolvedValue(antwort());
    const { container, unmount } = await mount();
    const text = container.textContent ?? "";
    // Die Namen stehen da (sie sind der einzige Weg, den Zustand zu ändern) …
    for (const name of VARS) {
      expect(text).toContain(name);
    }
    // … und sonst nichts, was nach einem Wert aussieht. Eine Maske verriete die Länge.
    expect(text).not.toMatch(/[•*]{2,}/);
    expect(text).not.toMatch(/\.\.\./);
    unmount();
  });

  // Ehrlich leer statt erfunden: es gibt im Bestand keinen Ort, der einen erfolgreichen Kontakt
  // festhält. Die Fläche sagt das, statt die Zeile wegzulassen — eine fehlende Zeile läse sich
  // wie „nie verbunden".
  it("„zuletzt verbunden“ wird nicht erfunden, sondern als unbekannt benannt", async () => {
    zugangMock.mockResolvedValue(antwort());
    const { container, unmount } = await mount();
    expect(container.textContent ?? "").toMatch(/nicht festgehalten/i);
    unmount();
  });

  // Ohne Auskunft keine Behauptung — die Fläche rät keinen der vier Zustände.
  it("solange keine Auskunft vorliegt, steht gar nichts da", async () => {
    zugangMock.mockImplementation(() => new Promise(() => {}));
    const { container, unmount } = await mount();
    expect(container.textContent).toBe("");
    unmount();
  });
});
