// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME 20260922 · GESAMT-KONFLIKTKLASSIFIKATION — AN DER ECHTEN KONFLIKTSEITE.
// ================================================================================================
//
// Gemessen an der gemounteten Seite `Conflicts`:
//   · R-0252 — der Satz `konflikt-arbeitsart` steht VOR dem Kartenpaar und sagt, welche Arbeit
//     vorliegt und woher die Einordnung stammt (gewählt / von der Prüfung erkannt) — oder dass sie
//     nicht bestimmt ist. Das Band trägt je Arbeitsart genau die zugesagten Knöpfe.
//   · R-0215 — ein OFFENER Wahrheitskonflikt: „Eskalieren" vorn, Entscheidungen und Zweitmeinung
//     sichtbar gesperrt, der Grund darunter. Ein offener Kontextkonflikt wird nicht gesperrt.
//   · R-0263 — nach „Links gilt" wird gewählt, ob die Seite überstimmt oder nur präzisiert; die
//     Präzisierung verlangt den Geltungsbereich und schickt ihn mit.
//
// Gerüst und Mock-Bauform wie `tests/conflict-description/beschreibung-sichtbar.test.tsx` (dieselbe
// echte Seite, kein Playwright-Import — sonst zöge die Datei in die Browsergruppe).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const daten = vi.hoisted(() => ({ konflikte: [] as unknown[], rufe: [] as unknown[][] }));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "controller" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: () => T) => vi.fn(async () => v());
  return {
    endpoints: {
      conflicts: {
        list: ok(() => daten.konflikte),
        escalate: vi.fn(async (id: string) => {
          daten.rufe.push(["escalate", id]);
          return {};
        }),
        einordnen: vi.fn(async (id: string, arbeitsart: string) => {
          daten.rufe.push(["einordnen", id, arbeitsart]);
          return {};
        }),
      },
      duplicates: { list: ok(() => []), settings: ok(() => ({ minConfidence: 0.5 })) },
      validation: { board: ok(() => []), overview: ok(() => []) },
      lifecycle: { pending: ok(() => []) },
      ko: {
        list: ok(() => KOS),
        act: vi.fn(async (id: string, body: unknown) => {
          daten.rufe.push(["act", id, body]);
          return {};
        }),
      },
      gaps: { list: ok(() => []), summary: ok(() => ({ total: 0, byPriority: {} })) },
      directory: { list: ok(() => []) },
      analytics: { busfactor: ok(() => []), expertise: ok(() => []) },
      aiCheck: {
        coverageSummary: ok(() => ({ total: 2, incomplete: 0, unchecked: 0, noCoverage: 0 })),
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
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Conflicts } from "../../apps/web/src/pages/Conflicts";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const ko = (id: string, titel: string) => ({
  id,
  title: titel,
  statement: `Aussage ${id}`,
  status: "validiert",
  category: "Technik",
  trust: 80,
  conditions: [],
  measures: [],
  sources: [],
  tags: [],
  createdAt: "2026-08-01T06:00:00.000Z",
  updatedAt: "2026-08-01T06:00:00.000Z",
});

const KOS = [ko("ko-a", "Beitrag A"), ko("ko-b", "Beitrag B")];

/** Von Hand angelegt: kein `origin` — also auch kein „Kein Widerspruch" (`canDismiss`). */
const manuell = (type: string, extra: Record<string, unknown> = {}) => ({
  id: `c-${type}`,
  koA: "ko-a",
  koB: "ko-b",
  type,
  description: "Von Hand erfasst.",
  status: "offen",
  secondOpinion: null,
  decidedBy: null,
  decision: null,
  createdAt: "2026-08-01T06:00:00.000Z",
  ...extra,
});

/** Automatisch erkannt — dann gehört „Kein Widerspruch" ins Band. */
const automatisch = (type: string, extra: Record<string, unknown> = {}) =>
  manuell(type, {
    origin: "auto",
    detector: { trigger: "background", method: "model", confidence: 0.9, rationale: "Grund." },
    ...extra,
  });

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
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
                MemoryRouter,
                { initialEntries: ["/konflikte"] },
                createElement(Conflicts),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await act(flush);
}

const t = (key: string, vars?: Record<string, unknown>): string =>
  vars ? String(i18n.t(key, vars)) : String(i18n.t(key));

const marke = (kennung: string): HTMLElement | null =>
  container.querySelector<HTMLElement>(`[data-testid="${kennung}"]`);

const knopf = (kennung: string): HTMLButtonElement | null =>
  container.querySelector<HTMLButtonElement>(`[data-testid="pruefen-knopf-${kennung}"]`);

/** Die Beschriftungen des Aktionsbands in der gezeichneten Folge (wie KF1b im Nachbartest). */
const band = (): string[] =>
  [...(marke("pruefen-aktionsband")?.querySelectorAll("button") ?? [])].map((b) =>
    (b.textContent ?? "").trim(),
  );

const satz = (): string => (marke("konflikt-arbeitsart")?.textContent ?? "").trim();

async function klick(el: HTMLElement | null): Promise<void> {
  expect(el, "das Bedienelement fehlt").not.toBeNull();
  await act(async () => {
    el?.click();
    await flush();
  });
}

/** Ein React-gebundenes Textfeld so füllen, wie ein Mensch tippt (nativer Setter + input-Ereignis). */
async function tippe(el: HTMLElement | null, wert: string): Promise<void> {
  expect(el, "das Eingabefeld fehlt").not.toBeNull();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(el, wert);
    el?.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

const bestaetigen = (): HTMLButtonElement | undefined =>
  [...container.querySelectorAll("button")].find(
    (b) => (b.textContent ?? "").trim() === t("con.resolveConfirm"),
  );

beforeEach(async () => {
  daten.konflikte = [];
  daten.rufe = [];
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

describe("R-0252 · die Konfliktseite sagt vorab, welche Arbeit vorliegt", () => {
  it("der Satz steht VOR dem Kartenpaar", async () => {
    daten.konflikte = [automatisch("truth")];
    await mount();
    const p = marke("konflikt-arbeitsart");
    const paar = marke("pruefen-paar");
    expect(p).not.toBeNull();
    expect(paar).not.toBeNull();
    // DOCUMENT_POSITION_FOLLOWING: das Paar folgt dem Satz.
    expect((p as Node).compareDocumentPosition(paar as Node) & 4).toBe(4);
  });

  it("ohne Einordnung: erst einordnen — die typabhängigen Aktionen sind bis dahin gesperrt", async () => {
    daten.konflikte = [automatisch("truth", { status: "eskaliert" })];
    await mount();
    expect(satz()).toBe(t("konfliktarbeit.satz.offen"));
    expect(band()).toEqual([
      t("konfliktarbeit.einordnen.regel"),
      t("konfliktarbeit.einordnen.sache"),
      t("konfliktarbeit.einordnen.version"),
      t("con.side.left"),
      t("con.side.right"),
      t("con.side.both"),
      t("con.side.none"),
      t("con.secondOpinionAdd"),
    ]);
    for (const kennung of ["links-gilt", "rechts-gilt", "beide-gelten", "zweitmeinung"]) {
      expect(knopf(kennung)?.disabled, kennung).toBe(true);
    }
    // „Kein Widerspruch" verneint den Befund und braucht keine Art der Arbeit.
    expect(knopf("kein-widerspruch")?.disabled).toBe(false);
    expect(marke("konflikt-einordnung-zuerst")?.textContent).toBe(
      t("konfliktarbeit.einordnung.zuerst"),
    );

    // Die Einordnung ruft den echten Weg und speichert die gewählte Art.
    await klick(knopf("einordnen-regel"));
    expect(daten.rufe).toEqual([["einordnen", "c-truth", "regel"]]);
  });

  it("nach der Einordnung: kein Einordnungsknopf mehr, das Band der gewählten Art gilt", async () => {
    daten.konflikte = [automatisch("truth", { status: "eskaliert", arbeitsart: "sache" })];
    await mount();
    expect(knopf("einordnen-regel")).toBeNull();
    expect(marke("konflikt-einordnung-zuerst")).toBeNull();
    expect(knopf("links-gilt")?.disabled).toBe(false);
  });

  it("von der Prüfung als Regelkonflikt erkannt (Art „truth“): Regel-Satz, keine Zweitmeinung", async () => {
    daten.konflikte = [automatisch("truth", { status: "eskaliert", arbeitsart: "regel" })];
    await mount();
    expect(satz()).toBe(`${t("konfliktarbeit.satz.regel")} ${t("konfliktarbeit.erkannt")}`);
    expect(band()).toEqual([
      t("con.side.left"),
      t("con.side.right"),
      t("con.side.both"),
      t("con.side.none"),
    ]);
    // Die Konfliktart bleibt sichtbar „Wahrheit“ — die Arbeitsart ersetzt sie nicht.
    expect(marke("pruefen-pille-art")?.textContent).toBe(t("con.type.truth"));
  });

  it("bei der Anlage als Versionskonflikt gewählt: welcher Stand gilt — ohne „beide gelten“", async () => {
    daten.konflikte = [manuell("temporal", { arbeitsart: "version" })];
    await mount();
    expect(satz()).toBe(`${t("konfliktarbeit.satz.version")} ${t("konfliktarbeit.gewaehlt")}`);
    expect(band()).toEqual([
      t("konfliktarbeit.knopf.standLinks"),
      t("konfliktarbeit.knopf.standRechts"),
    ]);
    expect(knopf("beide-gelten")).toBeNull();
    expect(knopf("zweitmeinung")).toBeNull();
  });

  it("EN: derselbe Satz in der Oberflächensprache", async () => {
    daten.konflikte = [manuell("temporal", { arbeitsart: "version" })];
    await i18n.changeLanguage("en");
    await mount();
    expect(satz()).toBe(
      "Version conflict: the same thing in two states — the question is which state applies. Classified this way when it was reported.",
    );
  });
});

describe("R-0215 · der Eskalationspfad des Wahrheitskonflikts ist verbindlich", () => {
  it("offener Wahrheitskonflikt: Eskalieren vorn, Entscheidung und Zweitmeinung gesperrt, Grund darunter", async () => {
    daten.konflikte = [automatisch("truth")];
    await mount();
    expect(band()[0]).toBe(t("con.escalate"));
    for (const kennung of ["links-gilt", "rechts-gilt", "beide-gelten", "zweitmeinung"]) {
      expect(knopf(kennung)?.disabled, kennung).toBe(true);
    }
    // „Kein Widerspruch" entscheidet keine Wahrheit — er bleibt bedienbar.
    expect(knopf("kein-widerspruch")?.disabled).toBe(false);
    expect(marke("konflikt-eskalation-zuerst")?.textContent).toBe(
      t("konfliktarbeit.eskalation.zuerst"),
    );

    // Ein Klick auf die gesperrte Entscheidung öffnet nichts und schreibt nichts.
    await klick(knopf("links-gilt"));
    expect(marke("pruefen-aufloesung")).toBeNull();
    expect(daten.rufe).toEqual([]);

    // „Eskalieren" ruft den echten Weg.
    await klick(knopf("eskalieren"));
    expect(daten.rufe).toEqual([["escalate", "c-truth"]]);
  });

  it("eskalierter Wahrheitskonflikt: kein Eskalieren-Knopf mehr, die Entscheidungen sind frei", async () => {
    daten.konflikte = [automatisch("truth", { status: "eskaliert", arbeitsart: "sache" })];
    await mount();
    expect(knopf("eskalieren")).toBeNull();
    expect(knopf("links-gilt")?.disabled).toBe(false);
    expect(marke("konflikt-eskalation-zuerst")).toBeNull();
  });

  it("offener Kontextkonflikt: keine Eskalation, keine Sperre", async () => {
    daten.konflikte = [automatisch("context", { arbeitsart: "sache" })];
    await mount();
    expect(knopf("eskalieren")).toBeNull();
    expect(knopf("links-gilt")?.disabled).toBe(false);
    expect(knopf("zweitmeinung")?.disabled).toBe(false);
    expect(marke("konflikt-eskalation-zuerst")).toBeNull();
  });
});

describe("R-0263 · Vorrang und Geltungsbereich bei der Entscheidung", () => {
  it("„Links gilt“ überstimmt: der Vorrang der linken Seite reist mit — ohne Geltungsbereich", async () => {
    daten.konflikte = [automatisch("context", { arbeitsart: "sache" })];
    await mount();
    await klick(knopf("links-gilt"));
    expect(marke("konflikt-vorrang")).not.toBeNull();
    expect(marke("konflikt-geltungsbereich")).toBeNull();
    await klick(bestaetigen() ?? null);
    expect(daten.rufe).toEqual([
      [
        "act",
        "ko-a",
        {
          action: "resolve-conflict",
          conflictId: "c-context",
          decision: t("con.prefill.side", { title: "Beitrag A" }),
          vorrang: { art: "ueberstimmt", gilt: "ko-a" },
        },
      ],
    ]);
  });

  it("Präzisierung: erst mit Geltungsbereich bestätigbar, dann reist er mit", async () => {
    daten.konflikte = [automatisch("context", { arbeitsart: "sache" })];
    await mount();
    await klick(knopf("rechts-gilt"));
    await klick(marke("konflikt-vorrang-praezisiert"));
    expect(marke("konflikt-geltungsbereich")).not.toBeNull();
    expect(bestaetigen()?.disabled, "ohne Geltungsbereich bestätigbar").toBe(true);

    await tippe(marke("konflikt-geltungsbereich"), "Bolzen X an Anlage 3");
    expect(bestaetigen()?.disabled).toBe(false);
    await klick(bestaetigen() ?? null);
    expect(daten.rufe).toEqual([
      [
        "act",
        "ko-a",
        {
          action: "resolve-conflict",
          conflictId: "c-context",
          decision: t("con.prefill.side", { title: "Beitrag B" }),
          vorrang: { art: "schraenkt_ein", gilt: "ko-b", geltungsbereich: "Bolzen X an Anlage 3" },
        },
      ],
    ]);
  });

  it("„Beide gelten“ legt keinen Vorrang fest; der Versionskonflikt kennt keine Präzisierung", async () => {
    daten.konflikte = [automatisch("context", { arbeitsart: "sache" })];
    await mount();
    await klick(knopf("beide-gelten"));
    expect(marke("konflikt-vorrang")).toBeNull();
    await klick(bestaetigen() ?? null);
    const [ruf] = daten.rufe;
    expect(ruf?.[2]).not.toHaveProperty("vorrang");
  });

  it("Klaras Vorschlag steht im Entscheidungsweg — er belegt nichts vor, entscheiden tut die Person", async () => {
    daten.konflikte = [
      automatisch("context", {
        arbeitsart: "sache",
        detector: {
          trigger: "background",
          method: "model",
          confidence: 0.9,
          rationale: "Grund.",
          vorschlag: { art: "praezisierung", spezieller: "ko-b", geltungsbereich: "Bolzen X" },
        },
      }),
    ];
    await mount();
    await klick(knopf("links-gilt"));
    expect(marke("konflikt-vorschlag")?.textContent).toBe(
      t("konfliktarbeit.vorschlag.praezisierung", { title: "Beitrag B", bereich: "Bolzen X" }),
    );
    // Kein Vorbelegen: die Wahl steht auf „überstimmt“, bis die Person anders wählt.
    expect(marke("konflikt-geltungsbereich")).toBeNull();
    await klick(bestaetigen() ?? null);
    const [ruf] = daten.rufe;
    expect((ruf?.[2] as { vorrang?: unknown }).vorrang).toEqual({
      art: "ueberstimmt",
      gilt: "ko-a",
    });
  });

  it("ohne Vorschlag der Prüfung behauptet die Fläche keinen", async () => {
    daten.konflikte = [automatisch("context", { arbeitsart: "sache" })];
    await mount();
    await klick(knopf("links-gilt"));
    expect(marke("konflikt-vorschlag")).toBeNull();
  });

  it("Versionskonflikt: „Linker Stand gilt“ überstimmt ohne Wahl der Präzisierung", async () => {
    daten.konflikte = [manuell("temporal", { arbeitsart: "version" })];
    await mount();
    await klick(knopf("links-gilt"));
    expect(marke("konflikt-vorrang")).toBeNull();
    await klick(bestaetigen() ?? null);
    const [ruf] = daten.rufe;
    expect((ruf?.[2] as { vorrang?: unknown }).vorrang).toEqual({
      art: "ueberstimmt",
      gilt: "ko-a",
    });
  });
});
