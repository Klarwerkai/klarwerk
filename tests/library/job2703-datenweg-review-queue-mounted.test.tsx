// @vitest-environment jsdom
// ================================================================================================
// JOB 2703 · D2 — DER DATENWEG, GLIED FUER GLIED: Import/Persistenz → Service → Wiretyp →
// Clientabruf → gemountete Review-Queue. Je Glied EINE Assertion, damit ein Bruch benennt, WO er
// liegt (Auftrag §3).
// ================================================================================================
//
// PEDIS FRAGE: „Zeigt Klara denselben Text ueberall gleich gekuerzt — oder je nach Weg anders?"
//
// Der Weg ist der ECHTE: der Confluence-Mapper baut das Item, `POST /api/library/import/candidates`
// legt es ab, `GET /api/library/import/candidates` liefert das DTO, der echte Client
// (`endpoints.library.importCandidates.list`, `useImportCandidates`) holt es ueber die
// Transportbruecke, und die echte Seite `ImportReview` (apps/web/src/pages/Stufe2.tsx) rendert die
// Karte. Gelesen wird `textContent` — nicht ein Feld am Endpunkt (BEN 2614 D4: „ein Feld am
// API-Endpunkt ist ein Scheinbeleg").
import { afterEach, beforeEach, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { ImportReview } from "../../apps/web/src/pages/Stufe2";
import { mapConfluencePageToImportItem } from "../../services/confluence/src/mapper";
import type { ConfluencePage } from "../../services/confluence/src/rest-client";
import { KERNAUSSAGE_MAX } from "../../services/structure";
import { type Bruecke, bruecke } from "./job2703-bruecke";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const OPTS = { baseUrl: "https://acme.atlassian.net/wiki", spaceKey: "K" };
const ABSATZ_1 = "Bei Überdruck über 6 bar ist Ventil X sofort zu schließen.";
const ABSATZ_2 = "Danach wird der Druck am Manometer M4 abgelesen und im Schichtbuch vermerkt.";
const ABSATZ_3 = "Erst nach Freigabe durch den Schichtleiter darf die Anlage wieder anfahren.";
const SATZ =
  "Die Pumpe P-12 wird wöchentlich auf Dichtheit geprüft und das Ergebnis dokumentiert. ";
const DREISSIG_KB = SATZ.repeat(Math.ceil(30_000 / SATZ.length));

function seite(id: string, title: string, bodyHtml: string): ConfluencePage {
  return {
    id,
    title,
    body: { storage: { value: bodyHtml } },
    version: { number: 1 },
    _links: { webui: `/spaces/K/pages/${id}/x` },
    metadata: { labels: { results: [] } },
    restrictions: { read: { restrictions: { user: { results: [] }, group: { results: [] } } } },
  };
}

interface Kandidat {
  id: string;
  item: { statement: string; bodyHtml?: string; title: string };
}

let b: Bruecke;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(async () => {
  await i18n.changeLanguage("de");
  b = await bruecke();
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    container.remove();
    root = null;
  }
  b.abbauen();
});

/** Glied 1: die beiden Items — Drei-Absatz-Seite und 30-KB-Seite — durch den ECHTEN Mapper. */
function items() {
  return [
    mapConfluencePageToImportItem(
      seite(
        "2703",
        "Überdruck an Ventil X",
        `<p>${ABSATZ_1}</p><p>${ABSATZ_2}</p><p>${ABSATZ_3}</p>`,
      ),
      OPTS,
    ),
    mapConfluencePageToImportItem(seite("2704", "Pumpe P-12", `<p>${DREISSIG_KB}</p>`), OPTS),
  ];
}

async function einreihen(): Promise<Kandidat[]> {
  const res = await b.a.inject({
    method: "POST",
    url: "/api/library/import/candidates",
    headers: b.kopf,
    payload: { items: items() },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json() as Kandidat[];
}

function karteVon(kandidaten: Kandidat[], title: string): Kandidat {
  const k = kandidaten.find((c) => c.item.title === title);
  if (!k) {
    throw new Error(`Kandidat „${title}" fehlt: ${kandidaten.map((c) => c.item.title).join(", ")}`);
  }
  return k;
}

async function mounten(): Promise<string> {
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
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

describe("JOB 2703 · D2 · der Datenweg bis zur gemounteten Review-Queue, je Glied eine Assertion", () => {
  it("G1 · IMPORT/PERSISTENZ: POST /api/library/import/candidates legt beide Kandidaten mit gekuerzter Aussage ab", async () => {
    const angelegt = await einreihen();
    expect(angelegt.map((c) => c.item.statement)).toEqual([ABSATZ_1, items()[1]?.statement ?? ""]);
  });

  it("G2 · SERVICE: LibraryService.listImportCandidates traegt die kurze Aussage UND den vollen Koerper", async () => {
    await einreihen();
    const liste = await b.dienste.library.listImportCandidates();
    const drei = liste.find((c) => c.item.title === "Überdruck an Ventil X");
    expect({
      statement: drei?.item.statement,
      koerperTraegtAbsatz3: (drei?.item.bodyHtml ?? "").includes(ABSATZ_3),
    }).toEqual({ statement: ABSATZ_1, koerperTraegtAbsatz3: true });
  });

  it("G3 · WIRETYP: GET /api/library/import/candidates liefert dasselbe DTO — kurze Aussage, voller Koerper, 30 KB unter der Kante", async () => {
    await einreihen();
    const res = await b.a.inject({
      method: "GET",
      url: "/api/library/import/candidates",
      headers: b.kopf,
    });
    const kandidaten = res.json() as Kandidat[];
    const drei = karteVon(kandidaten, "Überdruck an Ventil X");
    const gross = karteVon(kandidaten, "Pumpe P-12");
    expect({
      status: res.statusCode,
      statement: drei.item.statement,
      koerperTraegtAbsatz3: (drei.item.bodyHtml ?? "").includes(ABSATZ_3),
      grossUnterKante: gross.item.statement.length <= KERNAUSSAGE_MAX,
      grossKoerperVoll: (gross.item.bodyHtml ?? "").length > 30_000,
    }).toEqual({
      status: 200,
      statement: ABSATZ_1,
      koerperTraegtAbsatz3: true,
      grossUnterKante: true,
      grossKoerperVoll: true,
    });
  });

  it("G4 · CLIENTABRUF: endpoints.library.importCandidates.list() ueber die Bruecke — derselbe Stand beim Client", async () => {
    await einreihen();
    const kandidaten = (await endpoints.library.importCandidates.list()) as unknown as Kandidat[];
    const drei = karteVon(kandidaten, "Überdruck an Ventil X");
    expect({
      ueberBruecke: b.aufrufe.some(
        (c) => c.method === "GET" && c.url === "/api/library/import/candidates",
      ),
      statement: drei.item.statement,
    }).toEqual({ ueberBruecke: true, statement: ABSATZ_1 });
  });

  it("G5 · GEMOUNTETE REVIEW-QUEUE: die echte Seite zeigt Absatz 1 und nicht Absatz 2/3 — und fuer 30 KB hoechstens die Kernaussage", async () => {
    const angelegt = await einreihen();
    const gross = karteVon(angelegt, "Pumpe P-12");
    const text = await mounten();
    expect(text, "die Queue hat den Kandidaten gar nicht geladen").toContain(
      "Überdruck an Ventil X",
    );
    console.info(
      `JOB 2703 · G5 · Seitentext ${text.length} Zeichen · Absatz 1 sichtbar=${text.includes(ABSATZ_1)} · Absatz 3 sichtbar=${text.includes(ABSATZ_3)}`,
    );
    expect({
      absatz1: text.includes(ABSATZ_1),
      absatz2: text.includes(ABSATZ_2),
      absatz3: text.includes(ABSATZ_3),
      grossKernaussage: text.includes(gross.item.statement),
      grossVolltext: text.includes(SATZ.repeat(8)),
    }).toEqual({
      absatz1: true,
      absatz2: false,
      absatz3: false,
      grossKernaussage: true,
      grossVolltext: false,
    });
  });
});
