// @vitest-environment jsdom
// ================================================================================================
// JOB 3288 · IMPORT-VOLLTEXT — DIE PRUEFKARTE ZEIGT DEN GANZEN SEITENTEXT UND DIE QUELLE.
// ================================================================================================
//
// DER BEFUND (Codex, 1.188, Advisor-Import): 36 Reviewkarten, auf jeder derselbe DEMO-Satz — der
// erste Absatz der Seite. Fachtext und Quelladresse waren nirgends erreichbar, obwohl der Volltext
// als `bodyHtml` im Kandidaten liegt (Mapper `services/confluence/src/mapper.ts:155-160`). Pedi
// musste blind annehmen.
//
// DER WEG IST DER ECHTE, Glied fuer Glied wie in `tests/library/job2703-...`: Confluence-Mapper →
// `POST /api/library/import/candidates` → `GET .../candidates` → echter Client → die ECHTE Seite
// `ImportReview` (apps/web/src/pages/Stufe2.tsx). Gelesen wird der DOM, nicht ein Feld am Endpunkt.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

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
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { ImportReview } from "../../apps/web/src/pages/Stufe2";
import { mapConfluencePageToImportItem } from "../../services/confluence/src/mapper";
import type { ConfluencePage } from "../../services/confluence/src/rest-client";
import type { ImportItem } from "../../services/library-analytics";
import { type Bruecke, bruecke } from "../library/job2703-bruecke";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BASIS = "https://acme.atlassian.net/wiki";
const OPTS = { baseUrl: BASIS, spaceKey: "ADV" };

// Absatz 1 ist der DEMO-Hinweis aus Pedis Livebefund — genau der Satz, der auf allen 36 Karten
// stand. Absatz 2 und 3 sind der Fachtext, den niemand sehen konnte.
const ABSATZ_1 = "DEMO-Inhalt: Diese Seite dient der Vorführung und ist kein Beratungsergebnis.";
const ABSATZ_2 = "Die Netzentgelte werden je Entnahmestelle nach Jahresbenutzungsdauer bestimmt.";
const ABSATZ_3 = "Bei mehr als 2.500 Stunden gilt der Leistungspreis, sonst der Arbeitspreis.";

const LANGER_SATZ =
  "Der Messstellenbetrieb wird gesondert abgerechnet und im Netznutzungsvertrag benannt. ";
const LANGER_TEXT = LANGER_SATZ.repeat(30); // rund 2.400 Zeichen Klartext, deutlich über dem Deckel

let b: Bruecke;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;
const flush = () => new Promise((r) => setTimeout(r, 0));

function seite(id: string, title: string, bodyHtml: string): ConfluencePage {
  return {
    id,
    title,
    body: { storage: { value: bodyHtml } },
    version: { number: 1 },
    _links: { webui: `/spaces/ADV/pages/${id}/${encodeURIComponent(title)}` },
    metadata: { labels: { results: [] } },
    restrictions: { read: { restrictions: { user: { results: [] }, group: { results: [] } } } },
  } as unknown as ConfluencePage;
}

async function einreihen(items: ImportItem[]): Promise<void> {
  const res = await b.a.inject({
    method: "POST",
    url: "/api/library/import/candidates",
    headers: b.kopf,
    payload: { items },
  });
  expect(res.statusCode, res.body).toBe(201);
}

async function mounten(): Promise<HTMLElement> {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
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
                  ImageDescribeProvider,
                  null,
                  createElement(
                    MemoryRouter,
                    { initialEntries: ["/import"] },
                    createElement(ImportReview),
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
  for (let i = 0; i < 10; i += 1) {
    await act(flush);
  }
  return container;
}

/** Die eine Karte mit diesem Titel — erhoben ueber ihre Quellzeile, nicht ueber Layoutklassen. */
function karte(wurzel: HTMLElement, titel: string): HTMLElement {
  const treffer = [...wurzel.querySelectorAll<HTMLElement>('[data-testid="imp-quelle"]')]
    .map((q) => q.parentElement)
    .filter((p): p is HTMLElement => p !== null && (p.textContent ?? "").includes(titel));
  expect(treffer.length, `genau eine Karte „${titel}" erwartet`).toBe(1);
  return treffer[0] as HTMLElement;
}

function klicken(el: Element | null | undefined): void {
  expect(el, "Schaltfläche fehlt").toBeTruthy();
  act(() => {
    (el as HTMLElement).click();
  });
}

function text(el: Element): string {
  return (el.textContent ?? "").replace(/\s+/g, " ");
}

/**
 * SICHTBAR HEISST MESSBAR SICHTBAR (Lehre aus JOB 3179 · UX-24): ein Hinweis, der nur fuer
 * Screenreader existiert, ist keine Ankuendigung fuer den, der hinsieht. Geprueft wird der Knoten
 * SAMT seinen Vorfahren bis zur Karte — `sr-only`, `hidden`, `aria-hidden` und eine
 * 0-Pixel-/Clip-Regel machen ihn unsichtbar, egal auf welcher Ebene sie steht.
 */
function sichtbar(el: Element | null, bis: Element): boolean {
  if (el === null) {
    return false;
  }
  for (let k: Element | null = el; k !== null && k !== bis.parentElement; k = k.parentElement) {
    const klassen = k.className ?? "";
    const klassentext = typeof klassen === "string" ? klassen : "";
    if (
      k.hasAttribute("hidden") ||
      k.getAttribute("aria-hidden") === "true" ||
      /\bsr-only\b|\bhidden\b|\binvisible\b|\bopacity-0\b|\bw-0\b|\bh-0\b/.test(klassentext)
    ) {
      return false;
    }
  }
  return true;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  b = await bruecke();
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
    container.remove();
    root = null;
  }
  b.abbauen();
  await i18n.changeLanguage("de");
});

describe("JOB 3288 · Volltext und Quelle auf der Import-Prüfkarte", () => {
  it("V1 · geschlossen zeigt die Karte nur die Kernaussage — aufgeklappt ALLE drei Absätze", async () => {
    await einreihen([
      mapConfluencePageToImportItem(
        seite("101", "Netzentgelte", `<p>${ABSATZ_1}</p><p>${ABSATZ_2}</p><p>${ABSATZ_3}</p>`),
        OPTS,
      ),
    ]);
    const wurzel = await mounten();
    const k = karte(wurzel, "Netzentgelte");
    const vorher = text(k);
    klicken(k.querySelector('[data-testid="imp-volltext-schalter"]'));
    const nachher = text(k);
    expect({
      vorherAbsatz1: vorher.includes(ABSATZ_1),
      vorherAbsatz2: vorher.includes(ABSATZ_2),
      vorherAbsatz3: vorher.includes(ABSATZ_3),
      nachherAbsatz1: nachher.includes(ABSATZ_1),
      nachherAbsatz2: nachher.includes(ABSATZ_2),
      nachherAbsatz3: nachher.includes(ABSATZ_3),
    }).toEqual({
      vorherAbsatz1: true,
      vorherAbsatz2: false,
      vorherAbsatz3: false,
      nachherAbsatz1: true,
      nachherAbsatz2: true,
      nachherAbsatz3: true,
    });
  });

  it("V2 · der Aufklapper meldet seinen Zustand (aria-expanded) und benennt beide Richtungen", async () => {
    await einreihen([
      mapConfluencePageToImportItem(seite("102", "Zustand", `<p>${ABSATZ_2}</p>`), OPTS),
    ]);
    const wurzel = await mounten();
    const k = karte(wurzel, "Zustand");
    const schalter = k.querySelector<HTMLButtonElement>('[data-testid="imp-volltext-schalter"]');
    const zu = {
      expanded: schalter?.getAttribute("aria-expanded"),
      beschriftung: text(schalter as Element).trim(),
    };
    klicken(schalter);
    const auf = {
      expanded: schalter?.getAttribute("aria-expanded"),
      beschriftung: text(schalter as Element).trim(),
    };
    expect({ zu, auf }).toEqual({
      zu: { expanded: "false", beschriftung: "Ganzen importierten Text anzeigen" },
      auf: { expanded: "true", beschriftung: "Ganzen Text ausblenden" },
    });
  });

  it("V3 · die Quelle steht auf der Karte: Link auf die Confluence-URL, neuer Tab angekündigt, Titel und Raum", async () => {
    await einreihen([
      mapConfluencePageToImportItem(seite("103", "Quellseite", `<p>${ABSATZ_2}</p>`), OPTS),
    ]);
    const wurzel = await mounten();
    const k = karte(wurzel, "Quellseite");
    const link = k.querySelector<HTMLAnchorElement>('[data-testid="imp-quelle-link"]');
    const zeile = text(k.querySelector('[data-testid="imp-quelle"]') as Element);
    expect({
      href: link?.getAttribute("href"),
      target: link?.getAttribute("target"),
      rel: link?.getAttribute("rel"),
      beschriftung: text(link as Element).trim(),
      neuerTabAngekuendigt: zeile.includes("öffnet einen neuen Tab"),
      // Nicht nur vorhanden — SICHTBAR (Gegenprobe mit `sr-only` macht diese Zeile rot).
      neuerTabSichtbar: sichtbar(k.querySelector('[data-testid="imp-quelle-neuertab"]'), k),
      titelUndRaum: zeile.includes("Quellseite · Raum ADV"),
    }).toEqual({
      href: `${BASIS}/spaces/ADV/pages/103/Quellseite`,
      target: "_blank",
      rel: "noreferrer",
      beschriftung: "Quelle öffnen",
      neuerTabAngekuendigt: true,
      neuerTabSichtbar: true,
      titelUndRaum: true,
    });
  });

  it("V4 · Skript und Ereignisattribut aus dem Quell-Body werden entschärft, der Fachtext bleibt", async () => {
    // Der Angriff kommt aus der QUELLE: eine Confluence-Seite, die Skript und ein onerror-Bild
    // traegt. Die Kette bis hierher sanitisiert `bodyHtml` NICHT (nur `KoService.create` tut das,
    // und das ist erst NACH dem Annehmen) — der Schutz muss also an der Anzeige stehen.
    await einreihen([
      mapConfluencePageToImportItem(
        seite(
          "104",
          "Angriff",
          `<p>${ABSATZ_2}</p><script>window.__job3288 = 1;</script><img src="x" onerror="window.__job3288 = 2">`,
        ),
        OPTS,
      ),
    ]);
    const wurzel = await mounten();
    const k = karte(wurzel, "Angriff");
    klicken(k.querySelector('[data-testid="imp-volltext-schalter"]'));
    const volltext = k.querySelector('[data-testid="imp-volltext"]');
    expect(volltext, "Volltextkasten fehlt").toBeTruthy();
    expect({
      skriptknoten: k.querySelectorAll("script").length,
      onerrorKnoten: k.querySelectorAll("[onerror]").length,
      ausgefuehrt: (globalThis as { __job3288?: number }).__job3288 ?? null,
      fachtextDa: text(k).includes(ABSATZ_2),
    }).toEqual({ skriptknoten: 0, onerrorKnoten: 0, ausgefuehrt: null, fachtextDa: true });
  });

  it("V5 · langer Volltext wird gedeckelt ANGEZEIGT — mit Hinweis, und „Mehr anzeigen“ hebt beides auf", async () => {
    await einreihen([
      mapConfluencePageToImportItem(seite("105", "Langtext", `<p>${LANGER_TEXT}</p>`), OPTS),
    ]);
    const wurzel = await mounten();
    const k = karte(wurzel, "Langtext");
    klicken(k.querySelector('[data-testid="imp-volltext-schalter"]'));
    // Der gerenderte Rumpf ist das ERSTE div im Volltextkasten (davor steht nur die Beschriftung
    // als span, danach ggf. die Knopfzeile) — genau der Knoten, der die zwei Deckelklassen traegt.
    const rumpf = () => k.querySelector('[data-testid="imp-volltext"] > div:first-of-type');
    const gedeckelt = {
      hinweis: k.querySelector('[data-testid="imp-volltext-gekuerzt"]') !== null,
      maxHoehe: (rumpf()?.className ?? "").includes("max-h-64"),
      ueberlaufVersteckt: (rumpf()?.className ?? "").includes("overflow-hidden"),
      knopf: text(k.querySelector('[data-testid="imp-volltext-mehr"]') as Element).trim(),
    };
    klicken(k.querySelector('[data-testid="imp-volltext-mehr"]'));
    const ganz = {
      hinweis: k.querySelector('[data-testid="imp-volltext-gekuerzt"]') !== null,
      maxHoehe: (rumpf()?.className ?? "").includes("max-h-64"),
      ueberlaufVersteckt: (rumpf()?.className ?? "").includes("overflow-hidden"),
      knopf: text(k.querySelector('[data-testid="imp-volltext-mehr"]') as Element).trim(),
    };
    expect({ gedeckelt, ganz }).toEqual({
      gedeckelt: {
        hinweis: true,
        maxHoehe: true,
        ueberlaufVersteckt: true,
        knopf: "Mehr anzeigen",
      },
      ganz: {
        hinweis: false,
        maxHoehe: false,
        ueberlaufVersteckt: false,
        knopf: "Weniger anzeigen",
      },
    });
  });

  it("V6 · kurzer Volltext bekommt gar keinen Deckel — kein Hinweis auf eine Kürzung, die nicht stattfindet", async () => {
    await einreihen([
      mapConfluencePageToImportItem(seite("106", "Kurztext", `<p>${ABSATZ_2}</p>`), OPTS),
    ]);
    const wurzel = await mounten();
    const k = karte(wurzel, "Kurztext");
    klicken(k.querySelector('[data-testid="imp-volltext-schalter"]'));
    expect({
      mehrKnopf: k.querySelector('[data-testid="imp-volltext-mehr"]') !== null,
      hinweis: k.querySelector('[data-testid="imp-volltext-gekuerzt"]') !== null,
      inhaltDa: text(k).includes(ABSATZ_2),
    }).toEqual({ mehrKnopf: false, hinweis: false, inhaltDa: true });
  });

  it("V7 · ohne Volltext steht ein ehrlicher Satz da — kein leerer Aufklapper", async () => {
    // Tritt echt auf: ein Apply-Lauf ohne `fetchItem`-faehigen Adapter reiht den Snapshot-Stand
    // OHNE `bodyHtml` ein (confluence-import-routes.ts, `ohneBildauszug`).
    await einreihen([
      {
        title: "Ohne Rumpf",
        statement: ABSATZ_1,
        type: "best_practice",
        category: "ADV",
        provider: "Confluence",
        externalId: "107",
        url: `${BASIS}/spaces/ADV/pages/107/Ohne`,
        textCodec: "decoded",
      } as ImportItem,
    ]);
    const wurzel = await mounten();
    const k = karte(wurzel, "Ohne Rumpf");
    expect({
      schalter: k.querySelector('[data-testid="imp-volltext-schalter"]') !== null,
      satz: text(k.querySelector('[data-testid="imp-volltext-fehlt"]') as Element).trim(),
    }).toEqual({
      schalter: false,
      satz: "Für diesen Beitrag wurde kein Volltext übertragen — hier steht nur die Kernaussage.",
    });
  });

  it("V8 · eine unsichere gespeicherte Quelladresse wird GEZEIGT, aber nie klickbar", async () => {
    await einreihen([
      {
        title: "Altlast",
        statement: ABSATZ_1,
        type: "best_practice",
        category: "ADV",
        provider: "Confluence",
        externalId: "108",
        // Altdaten aus der Zeit vor der Persistenz-Härtung.
        url: "javascript:alert(1)",
        bodyHtml: `<p>${ABSATZ_2}</p>`,
        textCodec: "decoded",
      } as ImportItem,
    ]);
    const wurzel = await mounten();
    const k = karte(wurzel, "Altlast");
    expect({
      link: k.querySelector('[data-testid="imp-quelle-link"]') !== null,
      hinweis: text(k.querySelector('[data-testid="imp-quelle-unsicher"]') as Element).trim(),
    }).toEqual({
      link: false,
      hinweis:
        "Die gespeicherte Quelladresse ist keine sichere Webadresse — sie ist deshalb nicht anklickbar.",
    });
  });

  it("V9 · auf Englisch (Vorführungssprache) tragen Aufklapper und Quelle englische Beschriftungen", async () => {
    await einreihen([
      mapConfluencePageToImportItem(seite("109", "English", `<p>${ABSATZ_2}</p>`), OPTS),
    ]);
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    const wurzel = await mounten();
    const k = karte(wurzel, "English");
    const schalter = k.querySelector<HTMLButtonElement>('[data-testid="imp-volltext-schalter"]');
    klicken(schalter);
    expect({
      schalter: text(schalter as Element).trim(),
      label: text(k.querySelector('[data-testid="imp-volltext"] > span') as Element).trim(),
      quelle: text(k.querySelector('[data-testid="imp-quelle-link"]') as Element).trim(),
      neuerTab: text(k.querySelector('[data-testid="imp-quelle-neuertab"]') as Element).trim(),
    }).toEqual({
      schalter: "Hide full text",
      label: "Full imported content",
      quelle: "Open source",
      neuerTab: "opens a new tab",
    });
  });
});
