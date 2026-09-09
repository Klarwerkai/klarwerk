// @vitest-environment jsdom
// ================================================================================================
// JOB 3363 · LESEVARIANTE-PRUEFKARTE — DIE GEMOUNTETE PRÜFKARTE, ÜBER DIE GANZE ECHTE KETTE.
// ================================================================================================
//
// DER WEG IST DER ECHTE, Glied für Glied: `POST /api/library/import/candidates` legt den Kandidaten
// über `createImportCandidates` ab (Status „neu", `koId` null), die Queue-Route liefert ihn, der
// echte Client (`endpoints.library.importCandidates.list`, `useImportCandidates`) holt ihn über die
// Transportbrücke von JOB 2703, die echte Seite `ImportReview` (apps/web/src/pages/Stufe2.tsx)
// rendert die Karte, und die Karte fragt über die ECHTE Route
// `GET /api/library/import/candidates/:id/lesevariante/:lang` nach der Leseübersetzung.
//
// NICHTS DARAN IST ERSETZT — kein Endpunktattrappe, kein Haken-Mock, kein erfundenes Wissensobjekt
// und keine Kunst-KO-Kennung. Gelesen wird `textContent` der Fläche, nicht ein Feld am Endpunkt.
//
// DIE KALIBRIERUNG: zwei Kandidaten aus demselben Import.
//   · S01 trägt die Seiten-Id einer der 36 Confluence-Seiten der Lieferung → deutsche Lesefassung.
//   · Der zweite trägt eine Seiten-Id, die in der Lieferung NICHT vorkommt → keine Übersetzung.
// Eine Fläche, die pauschal übersetzte, fiele am zweiten durch; eine, die gar nicht übersetzt,
// fällt am ersten durch.
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
import { lokalisierungsPaket } from "../../services/app/src/lesevarianten";
import { type Bruecke, bruecke } from "../library/job2703-bruecke";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Alles aus der LIEFERUNG gelesen — kein Wert dieses Tests ist abgeschrieben. */
const S01 = (() => {
  const paket = lokalisierungsPaket("advisor-ict-en-v1");
  const record = paket?.records.find((r) => r.key === "S01");
  if (!paket || !record?.confluence_id || !record.de || !record.en) {
    throw new Error("Die Lieferung advisor-ict-en-v1 trägt keinen vollständigen Datensatz S01.");
  }
  return {
    confluenceId: record.confluence_id,
    titelEn: record.en.title,
    titelDe: record.de.title,
    absatzEn: record.en.paragraphs[0] ?? "",
    absatzDe: record.de.paragraphs[0] ?? "",
  };
})();

const OHNE_TITEL = "Untranslated page about nothing in the delivery";
const OHNE_AUSSAGE = "This page has no counterpart in the localisation delivery.";

let b: Bruecke;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(async () => {
  await i18n.changeLanguage("de");
  b = await bruecke();
});

afterEach(async () => {
  if (root) {
    act(() => root?.unmount());
    container.remove();
    root = null;
  }
  b.abbauen();
  await i18n.changeLanguage("de");
});

/** Glied 1: die zwei Kandidaten über die ECHTE Einreih-Route. */
async function einreihen(): Promise<{ id: string; status: string; koId: string | null }[]> {
  const res = await b.a.inject({
    method: "POST",
    url: "/api/library/import/candidates",
    headers: b.kopf,
    payload: {
      items: [
        {
          title: S01.titelEn,
          statement: S01.absatzEn,
          type: "best_practice",
          category: "Onboarding",
          bodyHtml: `<p>${S01.absatzEn}</p>`,
          provider: "Confluence",
          externalId: S01.confluenceId,
        },
        {
          title: OHNE_TITEL,
          statement: OHNE_AUSSAGE,
          type: "best_practice",
          category: "Onboarding",
          bodyHtml: `<p>${OHNE_AUSSAGE}</p>`,
          provider: "Confluence",
          externalId: "9999999999",
        },
      ],
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json();
}

async function mounten(): Promise<void> {
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
  await beruhigen();
}

/** Warten, bis Queue-Abruf UND die Variantenabrufe je Karte durch sind. */
async function beruhigen(): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    await act(flush);
  }
}

const text = (): string => (container.textContent ?? "").replace(/\s+/g, " ");

/** Die Kopfzeilen aller Prüfkarten, in Reihenfolge — das ist die Stelle, die übersetzt wird. */
const kartentitel = (): string[] =>
  [...container.querySelectorAll('[data-testid="imp-kandidat-titel"]')].map(
    (el) => el.textContent ?? "",
  );

/** Die Karte, die den genannten Text trägt — Kandidatenkarten sind Geschwister im Baum. */
function karteMit(inhalt: string): HTMLElement {
  const treffer = [...container.querySelectorAll<HTMLElement>("div")].filter(
    (el) => (el.textContent ?? "").includes(inhalt) && el.querySelector("[data-testid]") !== null,
  );
  const engste = treffer[treffer.length - 1];
  if (!engste) {
    throw new Error(`Keine Karte mit „${inhalt}" auf der Fläche.`);
  }
  return engste;
}

describe("JOB 3363 · die Prüfkarte in Stufe 2 zeigt die Leseübersetzung des Kandidaten", () => {
  it("F1 · DE: Titel und Kernaussage stehen deutsch da, mit der Kennzeichnung „Übersetzung“ und ohne Freigabe-Behauptung", async () => {
    await einreihen();
    await mounten();
    const gesehen = text();
    // ERST DIE KALIBRIERUNG: hat die Warteschlange überhaupt beide Karten? Ohne diese Zeile wäre
    // ein leeres Brett von einer nicht übersetzten Karte nicht zu unterscheiden.
    expect(kartentitel(), "die Queue hat die Kandidaten gar nicht geladen").toHaveLength(2);
    expect({
      // Die KOPFZEILEN beider Karten — genau die Stelle, die dieser Auftrag übersetzt.
      titel: kartentitel(),
      deutscheAussage: gesehen.includes(S01.absatzDe),
      kennzeichnung: container.querySelectorAll('[data-testid="lesevariante-hinweis"]').length,
      keineFreigabe: gesehen.includes("Übersetzung, keine Freigabe"),
      umschalter: container.querySelectorAll('[data-testid="lesevariante-umschalter"]').length,
      // DAS ORIGINAL BLEIBT SICHTBAR, WO ES HINGEHÖRT: die Quellzeile benennt die Confluence-Seite
      // mit IHREM Titel (`importQuellangabe` liest `item.title`). Sie ist eine Herkunftsangabe,
      // keine Lesefassung — sie wird deshalb ausdrücklich NICHT übersetzt.
      quellzeileNenntOriginal: (
        container.querySelector('[data-testid="imp-quelle"]')?.textContent ?? ""
      ).includes(S01.titelEn),
    }).toEqual({
      titel: [S01.titelDe, OHNE_TITEL],
      deutscheAussage: true,
      // GENAU EINE Kennzeichnung: die zweite Karte hat keine Übersetzung.
      kennzeichnung: 1,
      keineFreigabe: true,
      umschalter: 1,
      quellzeileNenntOriginal: true,
    });
  });

  it("F2 · der Kandidat OHNE Datensatz in der Lieferung bleibt englisch — und trägt keinen Hinweis", async () => {
    await einreihen();
    await mounten();
    const karte = karteMit(OHNE_TITEL);
    expect({
      original: (karte.textContent ?? "").includes(OHNE_TITEL),
      hinweisInDieserKarte: karte.querySelectorAll('[data-testid="lesevariante-hinweis"]').length,
    }).toEqual({ original: true, hinweisInDieserKarte: 0 });
  });

  it("F3 · EN: die Oberfläche steht in der Originalsprache — Original ohne Hinweis, auf BEIDEN Karten", async () => {
    await einreihen();
    await i18n.changeLanguage("en");
    await mounten();
    const gesehen = text();
    expect({
      englischerTitel: gesehen.includes(S01.titelEn),
      deutscherTitel: gesehen.includes(S01.titelDe),
      deutscheAussage: gesehen.includes(S01.absatzDe),
      kennzeichnung: container.querySelectorAll('[data-testid="lesevariante-hinweis"]').length,
    }).toEqual({
      englischerTitel: true,
      deutscherTitel: false,
      deutscheAussage: false,
      kennzeichnung: 0,
    });
  });

  it("F4 · der Sprachwechsel wirkt LIVE — dieselbe montierte Fläche wechselt EN → DE → EN", async () => {
    await einreihen();
    await i18n.changeLanguage("en");
    await mounten();
    expect({ titel: kartentitel() }).toEqual({ titel: [S01.titelEn, OHNE_TITEL] });

    await act(async () => {
      await i18n.changeLanguage("de");
    });
    await beruhigen();
    expect({
      titel: kartentitel(),
      hinweise: container.querySelectorAll('[data-testid="lesevariante-hinweis"]').length,
    }).toEqual({ titel: [S01.titelDe, OHNE_TITEL], hinweise: 1 });

    await act(async () => {
      await i18n.changeLanguage("en");
    });
    await beruhigen();
    expect({
      titel: kartentitel(),
      hinweise: container.querySelectorAll('[data-testid="lesevariante-hinweis"]').length,
    }).toEqual({ titel: [S01.titelEn, OHNE_TITEL], hinweise: 0 });
  });

  it("F5 · der Umschalter „Original anzeigen“ führt in EINEM Klick zurück zum englischen Wortlaut", async () => {
    await einreihen();
    await mounten();
    // VOR dem Klick steht die Lesefassung da — sonst wäre der Fall bauartbedingt grün (er wäre es
    // auch bei einer Karte, die NIE übersetzt).
    expect(kartentitel()).toEqual([S01.titelDe, OHNE_TITEL]);
    const umschalter = container.querySelector<HTMLButtonElement>(
      '[data-testid="lesevariante-umschalter"]',
    );
    expect(umschalter, "ohne Umschalter gäbe es keinen Weg zurück zum Original").not.toBeNull();
    await act(async () => {
      umschalter?.click();
      await flush();
    });
    await beruhigen();
    expect({
      titel: kartentitel(),
      // Die Kennzeichnung bleibt stehen — sie sagt jetzt, dass das Original zu sehen ist.
      hinweis: container.querySelectorAll('[data-testid="lesevariante-hinweis"]').length,
      original: text().includes("Original (Englisch)"),
    }).toEqual({ titel: [S01.titelEn, OHNE_TITEL], hinweis: 1, original: true });
  });

  it("F6 · der ganze importierte Seitentext und die Prüf-Knöpfe bleiben unberührt — der Kandidat ist nach dem Blick unverändert", async () => {
    const angelegt = await einreihen();
    await mounten();
    const gesehen = text();
    // Annehmen/Ablehnen/Nachfragen stehen weiter da (Status „neu" ist offen).
    expect({
      annehmen: gesehen.includes("Annehmen"),
      ablehnen: gesehen.includes("Ablehnen"),
    }).toEqual({ annehmen: true, ablehnen: true });
    // UND DER KANDIDAT SELBST: kein Statuswechsel, keine KO-Kennung, kein zweiter Eintrag.
    const queue = await b.a.inject({
      method: "GET",
      url: "/api/library/import/candidates",
      headers: b.kopf,
    });
    const nachher = queue.json() as { id: string; status: string; koId: string | null }[];
    expect(nachher.map((k) => ({ id: k.id, status: k.status, koId: k.koId }))).toEqual(
      angelegt.map((k) => ({ id: k.id, status: "neu", koId: null })),
    );
  });
});
