// @vitest-environment jsdom
// ================================================================================================
// JOB 3640 · DER RAHMEN IST KEIN VORBELEGTER FILTER — ER TRÄGT BIS IN DIE ÜBERNAHME.
// ================================================================================================
//
// Auftrag §4.2: „Nicht als vorbelegter Filter, den man wegklicken kann, sondern als Rahmen: was
// außerhalb liegt, erscheint nicht." Zwei Dinge muss ein Test dafür zeigen, und beide messen hier
// an der echten `ImportSelect`-Fläche (nur `endpoints` ist ersetzt):
//
//   1. DIE KETTE: der Rahmen steht in der Auswahl-Anfrage, kommt als effektives Kriterium zurück
//      und reist von dort GEMESSEN weiter in Gruppierung UND Übernahme.
//   2. DAS LECK: der einzige Weg, der aus dem Rahmen herausführte, ist der Umschaltknopf des
//      Titelbefunds (JOB 3356). Er fordert `{titleContains: [satz]}` an, und mehrere Einträge in
//      `titleContains` wirken als ODER — den Rahmen dort hineinzulegen würde die Auswahl
//      AUSWEITEN. Der Knopf entfällt deshalb im Rahmen. Der Fall dazu ist KALIBRIERT: ohne Rahmen
//      muss derselbe Knopf da sein, sonst prüfte er nichts.
//
// K6 (Bens Befund, package:confluence): der LETZTE Fall dieser Datei fährt dieselbe Fläche gegen
// die ECHTEN Routen `select`/`group`/`apply` — die Ersatzfunktionen reichen dort an die echten
// Endpunktfunktionen durch (`vi.importActual`), und die Brücke führt sie über `app.inject` an eine
// App mit echtem Confluence-Adapter (`../confluence-import-bedienung/confluence-buehne.ts`).
// Ersetzt ist dort allein die Antwort der externen Confluence-Instanz.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    // `run`: die Lauf-Akte der Übernahme (`ImportGroups` → `useImportRun`). Die bisherigen Fälle
    // lösen sie nie aus (ihre Bilanz trägt keine Laufkennung); der K6-Fall reicht sie durch.
    admin: { import: { select: vi.fn(), group: vi.fn(), apply: vi.fn(), run: vi.fn() } },
    reasoner: { status: vi.fn().mockResolvedValue({ active: false, mode: "deterministic" }) },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { ImportSelect } from "../../apps/web/src/components/ImportSelect";
import i18n from "../../apps/web/src/i18n";
import {
  type Buehne,
  baueBuehne,
  confluenceInstanz,
  seite,
} from "../confluence-import-bedienung/confluence-buehne";
import { FIRMA } from "./bestand";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

const selectMock = endpoints.admin.import.select as unknown as ReturnType<typeof vi.fn>;
const groupMock = endpoints.admin.import.group as unknown as ReturnType<typeof vi.fn>;
const applyMock = endpoints.admin.import.apply as unknown as ReturnType<typeof vi.fn>;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function mount(rahmen: string | null): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(ImportSelect, { chip: { themes: [], authors: [], spaces: [] }, rahmen }),
      ),
    );
  });
}

function verborgen(el: Element): boolean {
  for (let node: Element | null = el; node !== null; node = node.parentElement) {
    if (node.hasAttribute("hidden") || node.getAttribute("aria-hidden") === "true") {
      return true;
    }
    if (/\b(sr-only|invisible|hidden)\b/.test(node.getAttribute("class") ?? "")) {
      return true;
    }
  }
  return false;
}

function sichtbarerText(): string {
  const teile: string[] = [];
  const gehe = (el: Element): void => {
    if (verborgen(el)) {
      return;
    }
    for (const kind of el.childNodes) {
      if (kind.nodeType === 3) {
        teile.push(kind.textContent ?? "");
      } else if (kind.nodeType === 1) {
        gehe(kind as Element);
      }
    }
  };
  gehe(container);
  return teile.join(" ");
}

function knopfTexte(): string {
  return [...container.querySelectorAll("button")].map((b) => b.textContent ?? "").join(" | ");
}

async function klicken(teil: string): Promise<void> {
  const btn = [...container.querySelectorAll("button")].find(
    (b) => (b.textContent ?? "").includes(teil) && !verborgen(b),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${teil}" fehlt; Knöpfe: ${knopfTexte()}`);
  }
  await act(async () => {
    btn.click();
  });
  await act(flush);
}

function satzEingeben(satz: string): void {
  const feld = [...container.querySelectorAll("input")].find(
    (el) => el.getAttribute("placeholder") === i18n.t("imp.select.promptPlaceholder"),
  );
  if (!(feld instanceof HTMLInputElement)) {
    throw new Error("Freitext-Feld fehlt");
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(feld, satz);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const SATZ = "Restoring a customer file";

/** Die Antwort des Servers auf eine GERAHMTE Auswahl — `criteria` ist das, was er effektiv nahm. */
const GERAHMT = {
  matched: 1,
  limited: false,
  truncated: false,
  criteria: { titleContains: [FIRMA] },
  preview: [{ id: "a1", title: `[${FIRMA}] Onboarding`, hasImage: false, themes: ["Demo"] }],
};

/** Dieselbe Lage OHNE Rahmen — Kalibrierung des Lecks. */
const UNGERAHMT = {
  matched: 0,
  limited: false,
  truncated: false,
  criteria: { themes: ["Customer file restoration"] },
  preview: [],
  inferenceStatus: "ok" as const,
  titleFallback: { query: SATZ, matched: 2, criteria: { titleContains: [SATZ] } },
};

const GRUPPEN = {
  groups: [{ title: "Onboarding", ids: ["a1"] }],
  candidates: [
    {
      id: "a1",
      title: `[${FIRMA}] Onboarding`,
      alreadyImported: false,
      alreadyQueued: false,
      sourceNewer: false,
      hints: [],
    },
  ],
  demo: false,
  snapshotToken: 7,
};

beforeEach(async () => {
  vi.clearAllMocks();
  globalThis.localStorage?.clear();
  await i18n.changeLanguage("de");
  groupMock.mockResolvedValue(GRUPPEN);
  // Die vollständige Bilanz-Form des Vertrags (`ImportApplyResponse`) — eine halbe Attrappe ließe
  // die Fläche an `notFound` scheitern und der Fall bewiese nur, dass die Attrappe unvollständig ist.
  applyMock.mockResolvedValue({
    imported: 1,
    updates: 0,
    alreadyQueued: 0,
    failed: [],
    notFound: [],
  });
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

describe("JOB 3640 · der Rahmen trägt bis in die Übernahme", () => {
  it("Auswahl, Gruppierung und Übernahme laufen ALLE mit dem Rahmen", async () => {
    selectMock.mockResolvedValue(GERAHMT);
    mount(FIRMA);
    await klicken(i18n.t("imp.select.previewCta"));

    // 1 · Die Auswahl trägt ihn.
    expect(
      (selectMock.mock.calls.at(-1)?.[0] as { criteria: Record<string, unknown> }).criteria
        .titleContains,
    ).toEqual([FIRMA]);
    // Und die Fläche nennt ihn beim Namen, in derselben Kriterienliste wie jedes andere Kriterium.
    expect(sichtbarerText()).toContain(`Rahmen (Firma): ${FIRMA}`);

    // 2 · Die Gruppierung bekommt die EFFEKTIVEN Kriterien des Servers — und damit den Rahmen.
    await klicken(i18n.t("imp.groups.cta"));
    expect(groupMock).toHaveBeenCalledTimes(1);
    expect(
      (groupMock.mock.calls[0]?.[0] as { criteria: Record<string, unknown> }).criteria,
    ).toEqual({ titleContains: [FIRMA] });

    // 3 · Die Übernahme ebenso — hier endet die Kette, nicht bei der Vorschau.
    await klicken(i18n.t("imp.groups.applyCta", { n: 1 }));
    expect(applyMock).toHaveBeenCalledTimes(1);
    const uebernahme = applyMock.mock.calls[0]?.[0] as {
      criteria: Record<string, unknown>;
      includeIds: string[];
    };
    expect(uebernahme.criteria).toEqual({ titleContains: [FIRMA] });
    expect(uebernahme.includeIds).toEqual(["a1"]);
  });

  it("DAS LECK: im Rahmen gibt es keinen Umschaltknopf, und die ungerahmte Zahl sagt es", async () => {
    selectMock.mockResolvedValue({ ...UNGERAHMT, criteria: { titleContains: [FIRMA] } });
    mount(FIRMA);
    satzEingeben(SATZ);
    await klicken(i18n.t("imp.select.previewCta"));

    const text = sichtbarerText();
    // Der Titelbefund selbst bleibt lesbar — er ist eine Auskunft, kein Fehler.
    expect(text).toContain(`2 Seiten tragen „${SATZ}“ im Titel.`);
    // Aber er sagt, WORÜBER er zählt.
    expect(text).toContain("zählt den Gesamtbestand, nicht den Rahmen");
    // Und der Knopf, der aus dem Rahmen herausführte, existiert NICHT — geprüft am ganzen DOM.
    expect(knopfTexte()).not.toMatch(/Seite[n]? zeigen/);
  });

  it("KALIBRIERUNG: ohne Rahmen ist derselbe Knopf da — sonst prüfte der Fall darüber nichts", async () => {
    selectMock.mockResolvedValue(UNGERAHMT);
    mount(null);
    satzEingeben(SATZ);
    await klicken(i18n.t("imp.select.previewCta"));

    expect(knopfTexte()).toMatch(/Diese 2 Seiten zeigen/);
    expect(sichtbarerText()).not.toContain("zählt den Gesamtbestand, nicht den Rahmen");
    // Und er führt weiterhin genau auf die Server-Kriterien (unveränderter JOB-3356-Weg).
    selectMock.mockResolvedValue({
      matched: 2,
      limited: false,
      truncated: false,
      criteria: { titleContains: [SATZ] },
      preview: [{ id: "x", title: SATZ, hasImage: false, themes: [] }],
    });
    await klicken("Diese 2 Seiten zeigen");
    expect(
      (selectMock.mock.calls.at(-1)?.[0] as { criteria: Record<string, unknown> }).criteria,
    ).toEqual({ titleContains: [SATZ] });
  });

  it("EN: der Hinweis am ungerahmten Titelbefund gibt es auch auf Englisch", async () => {
    await i18n.changeLanguage("en");
    try {
      selectMock.mockResolvedValue({ ...UNGERAHMT, criteria: { titleContains: [FIRMA] } });
      mount(FIRMA);
      satzEingeben(SATZ);
      await klicken(i18n.t("imp.select.previewCta"));
      expect(sichtbarerText()).toContain("counts the entire source, not the frame");
      expect(sichtbarerText()).toContain(`Frame (company): ${FIRMA}`);
      expect(knopfTexte()).not.toMatch(/Show (that|those)/);
    } finally {
      await i18n.changeLanguage("de");
    }
  });
});

// ================================================================================================
// K6 · DER RAHMEN AN DER ECHTEN APP — FREMDE UND EIGENE SEITEN BIS ZUR TATSÄCHLICHEN ÜBERNAHME.
// ================================================================================================
//
// Drei Quellseiten: zwei tragen den Rahmen im Titel, eine (`Basic`) nicht. Der Mensch setzt den
// Rahmen, öffnet die Vorschau, wählt EINE Advisor-Seite ab, gruppiert (deterministisch — kein Modell
// in der Test-App, `reasoner.status` meldet „inaktiv") und übernimmt. Gemessen wird an drei Stellen:
// den Antworten der echten Routen, den gespeicherten Kandidaten und — beim Wechsel auf `Basic` — an
// der Fläche, die die alte Auswahl bis zur passenden neuen Vorschau sperrt.
//
// GRENZE, AUSDRÜCKLICH: der „Firmenrahmen" ist ein erklärter TITELWORTFILTER (`titleContains`),
// keine Zuordnung zu einer Firmenstruktur. Genau das wird hier gemessen — nicht mehr.
const RAHMEN_SEITEN = [
  seite("401", `[${FIRMA}] Onboarding`, 1, "Neue Kunden werden in drei Schritten eingerichtet."),
  seite("402", `[${FIRMA}] Abrechnung`, 1, "Rechnungen gehen am Monatsende hinaus."),
  seite("403", "[Basic] Onboarding", 1, "Basic-Kunden richten sich selbst ein."),
];
const GEWAEHLT = `[${FIRMA}] Onboarding`;
const ABGEWAEHLT = `[${FIRMA}] Abrechnung`;
const FREMD = "[Basic] Onboarding";

async function warteBis(bedingung: () => boolean, ms = 8000): Promise<void> {
  const ende = Date.now() + ms;
  while (!bedingung() && Date.now() < ende) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 25));
    });
  }
}

function haken(titel: string): HTMLInputElement {
  const el = [...container.querySelectorAll('input[type="checkbox"]')].find(
    (k) => k.getAttribute("aria-label") === titel,
  );
  if (!(el instanceof HTMLInputElement)) {
    throw new Error(`Haken „${titel}" fehlt; sichtbar: ${sichtbarerText()}`);
  }
  return el;
}

function hatKnopf(teil: string): boolean {
  return [...container.querySelectorAll("button")].some(
    (b) => (b.textContent ?? "").includes(teil) && !verborgen(b),
  );
}

describe("K6 · Firmenrahmen an den echten Routen: Vorschau, Abwahl, Gruppierung, Übernahme", () => {
  it("gespeichert ist genau die gewählte Advisor-Seite; der Wechsel auf Basic sperrt die alte Auswahl", async () => {
    const echt = await vi.importActual<typeof import("../../apps/web/src/api/endpoints")>(
      "../../apps/web/src/api/endpoints",
    );
    const runMock = endpoints.admin.import.run as unknown as ReturnType<typeof vi.fn>;
    selectMock.mockImplementation(echt.endpoints.admin.import.select);
    groupMock.mockImplementation(echt.endpoints.admin.import.group);
    applyMock.mockImplementation(echt.endpoints.admin.import.apply);
    runMock.mockImplementation(echt.endpoints.admin.import.run);
    let buehne: Buehne | null = null;
    try {
      buehne = await baueBuehne({
        fetchFn: confluenceInstanz({ ergebnisseiten: [RAHMEN_SEITEN] }).fetchFn,
      });
      const b = buehne;

      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
      const qc = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const zeichne = async (rahmen: string): Promise<void> => {
        await act(async () => {
          root.render(
            createElement(
              QueryClientProvider,
              { client: qc },
              createElement(ImportSelect, {
                chip: { themes: [], authors: [], spaces: [] },
                rahmen,
              }),
            ),
          );
        });
      };

      // 1 · DIE VORSCHAU IM RAHMEN — vom echten Server gefiltert.
      await zeichne(FIRMA);
      await klicken(i18n.t("imp.select.previewCta"));
      await warteBis(() => sichtbarerText().includes(GEWAEHLT));
      expect(
        (selectMock.mock.calls.at(-1)?.[0] as { criteria: Record<string, unknown> }).criteria
          .titleContains,
      ).toEqual([FIRMA]);
      const vorschau = (await selectMock.mock.results.at(-1)?.value) as {
        preview: Array<{ id?: string; title: string }>;
      };
      expect(vorschau.preview.map((p) => p.title).sort()).toEqual([ABGEWAEHLT, GEWAEHLT].sort());
      expect(sichtbarerText()).not.toContain(FREMD);
      const gewaehlteId = vorschau.preview.find((p) => p.title === GEWAEHLT)?.id;
      expect(gewaehlteId, "die Vorschau trägt keine Kandidaten-Id").toBeTruthy();

      // 2 · EINE ADVISOR-SEITE ABWÄHLEN — am Haken, wie der Mensch.
      expect(haken(ABGEWAEHLT).checked).toBe(true);
      await act(async () => {
        haken(ABGEWAEHLT).click();
      });
      await act(flush);
      expect(haken(ABGEWAEHLT).checked).toBe(false);
      expect(haken(GEWAEHLT).checked).toBe(true);

      // 3 · GRUPPIEREN — der echte Server bekommt Rahmen UND Auswahl und gibt nur die gewählte zurück.
      await klicken(i18n.t("imp.groups.cta"));
      await warteBis(() => hatKnopf(i18n.t("imp.groups.applyCta", { n: 1 })));
      const gruppenAnfrage = groupMock.mock.calls.at(-1)?.[0] as {
        criteria: Record<string, unknown>;
        selectedCandidateIds: string[];
      };
      expect(gruppenAnfrage.criteria).toEqual({ titleContains: [FIRMA] });
      expect(gruppenAnfrage.selectedCandidateIds).toEqual([gewaehlteId]);
      const gruppen = (await groupMock.mock.results.at(-1)?.value) as {
        candidates: Array<{ id: string; title: string }>;
      };
      expect(gruppen.candidates.map((c) => c.title)).toEqual([GEWAEHLT]);

      // 4 · ÜBERNEHMEN — und nachlesen, was WIRKLICH eingereiht wurde.
      await klicken(i18n.t("imp.groups.applyCta", { n: 1 }));
      await warteBis(() => applyMock.mock.results.length > 0);
      const bilanz = (await applyMock.mock.results.at(-1)?.value) as {
        imported: number;
        notFound: string[];
      };
      expect(bilanz.imported).toBe(1);
      expect(bilanz.notFound).toEqual([]);
      const kandidatenNachUebernahme = async (): Promise<string[]> => {
        const res = await b.app.inject({
          method: "GET",
          url: "/api/library/import/candidates",
          headers: b.kopf,
        });
        expect(res.statusCode).toBe(200);
        const liste = res.json() as Array<{ item: { externalId?: string; title: string } }>;
        return liste.map((k) => k.item.externalId ?? k.item.title).sort();
      };
      expect(await kandidatenNachUebernahme()).toEqual(["401"]);

      // 5 · RAHMENWECHSEL AUF BASIC — die alte Auswahl ist sofort gesperrt …
      const uebernahmenVorher = applyMock.mock.calls.length;
      const sperre = (): Element | null =>
        container.querySelector('[data-testid="rahmen-gruppen-gesperrt"]');
      await zeichne("Basic");
      expect(sperre()).not.toBeNull();
      expect(hatKnopf(i18n.t("imp.groups.applyCta", { n: 1 }))).toBe(false);
      // … bis die Vorschau zum neuen Rahmen passt (lädt die Fläche nicht selbst nach, holt der
      // Mensch sie — beide Wege enden in derselben Prüfung).
      await warteBis(() => sichtbarerText().includes(FREMD), 1500);
      if (!sichtbarerText().includes(FREMD)) {
        await klicken(i18n.t("imp.select.previewCta"));
        await warteBis(() => sichtbarerText().includes(FREMD));
      }
      expect(
        (selectMock.mock.calls.at(-1)?.[0] as { criteria: Record<string, unknown> }).criteria
          .titleContains,
      ).toEqual(["Basic"]);
      await warteBis(() => sperre() === null);
      expect(sperre()).toBeNull();
      expect(sichtbarerText()).not.toContain(GEWAEHLT);
      // Mit der alten Auswahl wurde nichts mehr abgeschickt, und im Bestand steht weiter nur sie.
      expect(applyMock.mock.calls.length).toBe(uebernahmenVorher);
      expect(await kandidatenNachUebernahme()).toEqual(["401"]);
    } finally {
      buehne?.abbauen();
      selectMock.mockReset();
      groupMock.mockReset();
      applyMock.mockReset();
      runMock.mockReset();
    }
  });
});
