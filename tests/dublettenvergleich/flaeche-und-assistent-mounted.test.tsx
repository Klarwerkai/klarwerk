// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME 20260922 · GESAMT-DUBLETTENVERGLEICH (Mounted) — FLÄCHE, ASSISTENT UND HINWEIS.
// ================================================================================================
//
// Die echten Seiten im jsdom, gestellt sind nur die Datenquellen (Gerüst wie
// `tests/review26-duplikat-prozente/flaechen-benennen-die-metrik-mounted.test.tsx`):
//
//   R-0261  Quelle, Quelldatum und Konfidenz je Seite stehen auf der Karte, OHNE ein „Mehr" zu
//           öffnen; der Satz zur Beweislage steht nur in freigegebenen Fällen (nicht redigiert, eine
//           oder keine Seite belegt) und schweigt sonst.
//   R-1107  der Assistent führt durch vier Schritte; freigegeben wird erst nach der Vorschau mit
//           ausdrücklicher Bestätigung — vorher geht kein Aufruf an den Server.
//   R-0565  wer eine Seite verfasst hat, sieht den Grund und keinen Freigabeknopf.
//   R-1107  der aufgegangene Artikel nennt den verbleibenden und verweist darauf.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const daten = vi.hoisted(() => ({
  nutzer: "u1",
  duplikate: [] as unknown[],
  kos: [] as unknown[],
  einzeln: {} as Record<string, unknown>,
  aufrufe: [] as { id: string; auftrag: Record<string, unknown> }[],
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: daten.nutzer, name: "Pia", email: "p@x.de", role: "controller" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: () => T) => vi.fn(async () => v());
  return {
    endpoints: {
      duplicates: {
        list: ok(() => daten.duplikate),
        settings: ok(() => ({ minConfidence: 0.5 })),
        merge: vi.fn(async (id: string, auftrag: Record<string, unknown>) => {
          daten.aufrufe.push({ id, auftrag });
          return {
            befund: { id, status: "geschlossen" },
            fuehrend: { id: "ko-a", version: 3, status: "offen" },
            aufgehend: { id: "ko-b" },
          };
        }),
      },
      conflicts: { list: ok(() => []) },
      validation: { board: ok(() => []), overview: ok(() => []) },
      lifecycle: { pending: ok(() => []) },
      ko: {
        list: ok(() => daten.kos),
        get: vi.fn(async (id: string) => {
          const ko = daten.einzeln[id];
          if (!ko) {
            throw new Error("nicht gefunden");
          }
          return ko;
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
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { AufgegangenHinweis } from "../../apps/web/src/components/AufgegangenHinweis";
import i18n from "../../apps/web/src/i18n";
import { DuplicateMerge } from "../../apps/web/src/pages/DuplicateMerge";
import { Duplicates } from "../../apps/web/src/pages/Duplicates";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const quelle = (id: string, label: string, at: string) => ({
  id,
  label,
  url: null,
  excerpt: null,
  kind: "external",
  peerValidated: false,
  author: "x",
  at,
});

const ko = (id: string, teil: Record<string, unknown>) => ({
  id,
  title: `Titel ${id}`,
  statement: `Aussage ${id}`,
  bodyHtml: null,
  status: "offen",
  type: "best_practice",
  category: "Instandhaltung",
  trust: 0,
  confidence: 84,
  version: 2,
  author: "autor-x",
  originalAuthor: "autor-x",
  conditions: [],
  measures: [],
  sources: [],
  attachments: [],
  comments: [],
  tags: [],
  neededValidations: 2,
  assignments: [],
  asset: null,
  history: [],
  createdAt: "2026-09-01T06:00:00.000Z",
  ...teil,
});

const KO_A = ko("ko-a", {
  title: "Pumpe P3 entlüften",
  statement: "Nach dem Anfahren zehn Sekunden entlüften.",
  conditions: ["Nur bei Stillstand"],
  sources: [quelle("qa", "Wartungshandbuch P3", "2026-03-02T08:00:00.000Z")],
});
const KO_B = ko("ko-b", {
  title: "Dosierpumpe Luft ablassen",
  statement: "Beim Start Luft ablassen, bis Medium austritt.",
  conditions: ["Nur bei Stillstand", "Mit Schutzbrille"],
  sources: [],
  createdAt: "2026-09-05T06:00:00.000Z",
});

const PAAR = {
  id: "dup-1",
  koA: "ko-a",
  koB: "ko-b",
  relation: "teilweise",
  aspects: [],
  eigenanteilA: "",
  eigenanteilB: "Schutzbrille tragen.",
  recommendation: "zusammenfuehren_pruefen",
  status: "offen",
  pairKey: "dup|ko-a|ko-b",
  origin: "auto",
  detector: { trigger: "validation", method: "deterministic", lexicalScore: 0.9 },
  createdAt: "2026-09-08T09:00:00.000Z",
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mounte(pfad: string, inhalt: unknown): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
              createElement(MemoryRouter, { initialEntries: [pfad] }, inhalt as never),
            ),
          ),
        ),
      ),
    );
  });
  // Mehrere abgeschlossene `act`-Runden, nicht eine: React wendet die Ergebnisse einer Runde erst
  // an ihrem Ende an. Abhängige Abfragen — Sitzungsstatus → Nutzer (→ Rolle, Kennung) und
  // aufgegangener Artikel → Führungsartikel — starten erst in der NÄCHSTEN Runde. Mit einer Runde
  // sah die Seite noch keinen Nutzer (Sperre „keinRecht") und der Hinweis noch keinen Titel.
  for (let runde = 0; runde < 6; runde++) {
    await act(flush);
  }
}

const mounteBrett = (): Promise<void> => mounte("/duplikate", createElement(Duplicates) as unknown);

const mounteAssistent = (): Promise<void> =>
  mounte(
    "/duplikate/dup-1/zusammenfuehren",
    createElement(
      Routes,
      null,
      createElement(Route, {
        path: "/duplikate/:id/zusammenfuehren",
        element: createElement(DuplicateMerge),
      }),
    ) as unknown,
  );

const text = (el: Element | null | undefined): string =>
  (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const marke = (id: string): Element | null => container.querySelector(`[data-testid="${id}"]`);

async function klick(el: Element | null): Promise<void> {
  expect(el, "das Element zum Klicken fehlt").not.toBeNull();
  await act(async () => {
    (el as HTMLElement).click();
  });
  await act(flush);
}

beforeEach(async () => {
  daten.nutzer = "u1";
  daten.duplikate = [PAAR];
  daten.kos = [KO_A, KO_B];
  daten.einzeln = {};
  daten.aufrufe = [];
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

describe("R-0261 · Quelle, Quelldatum und Konfidenz ohne Aufklappen", () => {
  it("B1 · je Seite steht der Beleg auf der Karte — ausserhalb jedes „Mehr“", async () => {
    await mounteBrett();
    const a = marke("pruefen-paar-beleg-a");
    const b = marke("pruefen-paar-beleg-b");
    expect(a, "Karte a trägt keinen Beleg").not.toBeNull();
    expect(b, "Karte b trägt keinen Beleg").not.toBeNull();
    expect(a?.closest("details"), "der Beleg liegt in einem Aufklapper").toBeNull();
    expect(text(a)).toContain("Wartungshandbuch P3");
    expect(text(a)).toContain(i18n.t("evidence.sourceDate", { date: "" }).trim());
    expect(text(a)).toContain("84");
    // Ohne Quelle: ehrliches „kein Quelldatum", kein Ersatzdatum aus der Erfassung.
    expect(text(b)).toContain(i18n.t("evidence.noDate"));
    expect(text(b)).not.toContain("2026");
  });

  it("B2 · genau eine Seite belegt: der Satz zur Beweislage steht im „Mehr“ und nennt sie", async () => {
    await mounteBrett();
    for (const d of [...container.querySelectorAll("details")]) {
      (d as HTMLDetailsElement).open = true;
    }
    await act(flush);
    const satz = text(marke("dublette-beweislage"));
    expect(satz).toContain("Pumpe P3 entlüften");
    expect(satz).toContain("kein Urteil");
  });

  it("B3 · redigiertes Paar: der Beleg bleibt, der Satz zur Beweislage schweigt", async () => {
    daten.duplikate = [{ ...PAAR, redacted: true }];
    await mounteBrett();
    for (const d of [...container.querySelectorAll("details")]) {
      (d as HTMLDetailsElement).open = true;
    }
    await act(flush);
    expect(marke("pruefen-paar-beleg-a")).not.toBeNull();
    expect(marke("dublette-beweislage")).toBeNull();
  });

  it("B4 · beide Seiten belegt: der Satz schweigt", async () => {
    daten.kos = [
      KO_A,
      { ...KO_B, sources: [quelle("qb", "Betriebsanweisung", "2026-04-01T08:00:00.000Z")] },
    ];
    await mounteBrett();
    for (const d of [...container.querySelectorAll("details")]) {
      (d as HTMLDetailsElement).open = true;
    }
    await act(flush);
    expect(marke("dublette-beweislage")).toBeNull();
  });

  it("B5 · das „···“-Menü führt in den Assistenten — das Aktionsband bleibt bei seinen vier Knöpfen", async () => {
    await mounteBrett();
    const band = marke("pruefen-aktionsband");
    expect(band?.querySelectorAll("button").length).toBe(4);
    await klick(marke("pruefen-menue-duplikat-a"));
    const panel = marke("pruefen-menue-panel-duplikat-a");
    const link = [...(panel?.querySelectorAll("a") ?? [])].find(
      (a) => a.getAttribute("href") === "/duplikate/dup-1/zusammenfuehren",
    );
    expect(link, "der Menüweg in den Assistenten fehlt").toBeDefined();
    expect(text(link)).toContain(i18n.t("dublettenvergleich.menue"));
  });
});

describe("R-1107 / R-0201 · der Assistent: vier Schritte, Vorschau, ausdrückliche Freigabe", () => {
  it("A1 · durch alle vier Schritte; ohne Bestätigung keine Freigabe, mit ihr genau ein Aufruf", async () => {
    await mounteAssistent();
    const schritte = marke("zusammenfuehren-schritte");
    expect(schritte?.querySelectorAll("li").length).toBe(4);
    expect(text(schritte?.querySelector('[aria-current="step"]'))).toContain(
      i18n.t("dublettenvergleich.schritt.fuehrung"),
    );
    // Schritt 1: der Vorschlag ist erklärt (älterer Artikel, da keiner geprüft und keiner enthält).
    expect(text(marke("fuehrung-grund"))).toBe(i18n.t("dublettenvergleich.vorschlag.aelter"));

    await klick(marke("zusammenfuehren-weiter"));
    // Schritt 2: je Feld die Lage — Titel weichen ab, Bedingungen mit Herkunft.
    expect(marke("schritt-inhalte")).not.toBeNull();
    expect(text(marke("lage-titel"))).toBe(i18n.t("dublettenvergleich.lage.abweichend"));
    expect(text(marke("feld-bedingungen"))).toContain(i18n.t("dublettenvergleich.herkunft.beide"));
    expect(text(marke("feld-bedingungen"))).toContain(
      i18n.t("dublettenvergleich.herkunft.aufgehend"),
    );
    expect(text(marke("eigenanteil"))).toContain("Schutzbrille tragen.");
    // Feld für Feld: die Kernaussage der anderen Seite wählen.
    const kern = container.querySelector(
      '[data-testid="feld-kernaussage"] input[value="aufgehend"]',
    );
    await klick(kern);

    await klick(marke("zusammenfuehren-weiter"));
    expect(marke("schritt-quellen")).not.toBeNull();
    expect(text(marke("schritt-quellen"))).toContain("Wartungshandbuch P3");

    await klick(marke("zusammenfuehren-weiter"));
    expect(marke("schritt-vorschau")).not.toBeNull();
    expect(text(marke("vorschau-kernaussage"))).toBe(KO_B.statement as string);
    expect(text(marke("vorschau-fassung"))).toContain("Fassung 3");
    expect(text(marke("vorschau-verbleib"))).toContain("nicht gelöscht");

    const freigeben = marke("zusammenfuehren-freigeben") as HTMLButtonElement | null;
    expect(freigeben?.disabled, "Freigabe ohne Bestätigung möglich").toBe(true);
    await klick(freigeben);
    expect(daten.aufrufe, "ohne Bestätigung ging ein Aufruf hinaus").toEqual([]);

    await klick(marke("zusammenfuehren-bestaetigung"));
    expect((marke("zusammenfuehren-freigeben") as HTMLButtonElement).disabled).toBe(false);
    await klick(marke("zusammenfuehren-freigeben"));
    expect(daten.aufrufe).toHaveLength(1);
    const auftrag = daten.aufrufe[0]?.auftrag;
    expect(daten.aufrufe[0]?.id).toBe("dup-1");
    expect(auftrag?.bestaetigt).toBe(true);
    expect(auftrag?.fuehrend).toEqual({ id: "ko-a", version: 2 });
    expect(auftrag?.aufgehend).toEqual({ id: "ko-b", version: 2 });
    expect(auftrag?.kernaussage).toBe("aufgehend");
    expect(auftrag?.bedingungen).toEqual(["Nur bei Stillstand", "Mit Schutzbrille"]);
    expect(marke("zusammenfuehren-erledigt")).not.toBeNull();
  });

  it("A2 · ein Schrittwechsel nimmt die Bestätigung zurück", async () => {
    await mounteAssistent();
    for (let i = 0; i < 3; i++) {
      await klick(marke("zusammenfuehren-weiter"));
    }
    await klick(marke("zusammenfuehren-bestaetigung"));
    await klick(marke("zusammenfuehren-zurueck"));
    await klick(marke("zusammenfuehren-weiter"));
    expect((marke("zusammenfuehren-freigeben") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("Nacharbeit 2 (Ben, R-0201) · Fliesstext sichtbar, Freigabe an die gesehene Fassung gebunden", () => {
  it("A3 · der Fliesstext beider Seiten steht am Kernaussagenfeld; die Vorschau zeigt den entstehenden", async () => {
    daten.kos = [
      { ...KO_A, bodyHtml: "<p>Ventil V2 zuerst öffnen.</p>" },
      { ...KO_B, bodyHtml: "<p>Erst Auffangschale, dann Ventil.</p>" },
    ];
    await mounteAssistent();
    await klick(marke("zusammenfuehren-weiter"));
    expect(text(marke("fliesstext-fuehrend"))).toContain("Ventil V2 zuerst öffnen.");
    expect(text(marke("fliesstext-aufgehend"))).toContain("Erst Auffangschale, dann Ventil.");
    // Die Kopplung steht ausdrücklich da, mit der Lage des Fliesstexts.
    expect(text(marke("fliesstext-kopplung"))).toContain(
      i18n.t("dublettenvergleich.lage.abweichend"),
    );
    await klick(
      container.querySelector('[data-testid="feld-kernaussage"] input[value="aufgehend"]'),
    );
    await klick(marke("zusammenfuehren-weiter"));
    await klick(marke("zusammenfuehren-weiter"));
    expect(text(marke("vorschau-fliesstext"))).toContain("Erst Auffangschale, dann Ventil.");
    expect(text(marke("vorschau-fliesstext"))).not.toContain("Ventil V2 zuerst öffnen.");
    expect(marke("vorschau-fliesstext-ersetzt")).not.toBeNull();
  });

  it("A4 · trifft eine neue Fassung ein, fällt die Bestätigung, die Freigabe sperrt — bis neu geprüft ist", async () => {
    await mounteAssistent();
    for (let i = 0; i < 3; i++) {
      await klick(marke("zusammenfuehren-weiter"));
    }
    await klick(marke("zusammenfuehren-bestaetigung"));
    expect((marke("zusammenfuehren-freigeben") as HTMLButtonElement).disabled).toBe(false);

    // Während der Assistent offen ist, kommt Seite a in einer neuen Fassung an.
    daten.kos = [{ ...KO_A, version: 3, statement: "Inzwischen anders formuliert." }, KO_B];
    await act(async () => {
      await qc.invalidateQueries({ queryKey: ["kos"] });
    });
    for (let runde = 0; runde < 4; runde++) {
      await act(flush);
    }
    expect(marke("zusammenfuehren-veraltet")).not.toBeNull();
    const haken = marke("zusammenfuehren-bestaetigung") as HTMLInputElement;
    expect(haken.checked).toBe(false);
    expect(haken.disabled).toBe(true);
    const freigeben = marke("zusammenfuehren-freigeben") as HTMLButtonElement;
    expect(freigeben.disabled).toBe(true);
    await klick(freigeben);
    expect(daten.aufrufe, "die alte Bestätigung trug eine neue Fassung").toEqual([]);
    // Die Vorschau zeigt weiter den gesehenen Stand, nicht still den neuen.
    expect(text(marke("vorschau-kernaussage"))).toBe(KO_A.statement as string);

    // Neuer Stand: von vorn, erneut bestätigen — erst dann geht die NEUE Fassung hinaus.
    await klick(marke("zusammenfuehren-neuer-stand"));
    expect(marke("schritt-fuehrung")).not.toBeNull();
    expect(marke("zusammenfuehren-veraltet")).toBeNull();
    for (let i = 0; i < 3; i++) {
      await klick(marke("zusammenfuehren-weiter"));
    }
    expect(text(marke("vorschau-kernaussage"))).toBe("Inzwischen anders formuliert.");
    await klick(marke("zusammenfuehren-bestaetigung"));
    await klick(marke("zusammenfuehren-freigeben"));
    expect(daten.aufrufe).toHaveLength(1);
    expect(daten.aufrufe[0]?.auftrag.fuehrend).toEqual({ id: "ko-a", version: 3 });
  });
});

describe("R-0565 · wer eine Seite verfasst hat, führt nicht zusammen", () => {
  it("K1 · der Autor sieht den Grund und keinen Freigabeweg", async () => {
    daten.nutzer = "autor-x";
    await mounteAssistent();
    expect(text(marke("pruefen-satz-gesperrt"))).toBe(
      i18n.t("dublettenvergleich.sperre.eigeneSeite"),
    );
    expect(marke("zusammenfuehren-freigeben")).toBeNull();
    expect(marke("zusammenfuehren-weiter")).toBeNull();
    expect(daten.aufrufe).toEqual([]);
  });
});

describe("R-1107 · der aufgegangene Artikel verweist auf den verbleibenden", () => {
  it("H1 · Hinweis mit Titel und Verweis", async () => {
    daten.einzeln = {
      "ko-b": {
        ...KO_B,
        mergedInto: {
          koId: "ko-a",
          version: 3,
          overlapId: "dup-1",
          at: "2026-09-20T10:00:00.000Z",
          by: "u9",
        },
      },
      "ko-a": KO_A,
    };
    await mounte("/wissen/ko-b", createElement(AufgegangenHinweis, { koId: "ko-b" }) as unknown);
    const hinweis = marke("aufgegangen-hinweis");
    expect(text(hinweis)).toContain("Pumpe P3 entlüften");
    expect(text(hinweis)).toContain("aufgegangen");
    expect(marke("aufgegangen-link")?.getAttribute("href")).toBe("/wissen/ko-a");
  });

  it("H2 · ohne Verweis zeichnet der Hinweis nichts", async () => {
    daten.einzeln = { "ko-b": KO_B };
    await mounte("/wissen/ko-b", createElement(AufgegangenHinweis, { koId: "ko-b" }) as unknown);
    expect(marke("aufgegangen-hinweis")).toBeNull();
  });
});
