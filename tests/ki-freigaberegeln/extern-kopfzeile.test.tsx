// @vitest-environment jsdom
// ================================================================================================
// R-0606 · „IN DER KOPFZEILE STEHT SICHTBAR ‚EXTERN: BLOCKIERT'" — gemountet, je Stand und Sprache.
// ================================================================================================
//
// Gegenstand: `apps/web/src/shell/ExternStatus.tsx`, gebunden an `publicStatus().extern` des Servers
// (die Serverseite misst `tests/admin-ki-freigabe/vertrauliche-freigabe-bis-zum-anbieter.test.ts` V6).
//   X1  jeder der drei Stände steht als Satz da — DE, EN, NL;
//   X2  ohne gültige Serverauskunft steht NICHTS da (keine Behauptung ohne Deckung);
//   X3  die Anzeige steht im Kopfband VOR der vermessenen Kopfbandzeile, nicht in ihr.
// EHRLICHE GRENZE: jsdom rechnet kein Layout — gemessen wird der Baum, nicht Pixel.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import i18n from "../../apps/web/src/i18n";
import { ExternStatus, externStand } from "../../apps/web/src/shell/ExternStatus";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

let container: HTMLDivElement | null = null;
let root: Root | null = null;

async function montiere(status: unknown): Promise<HTMLElement | null> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
  // Die Auskunft liegt bereits im Cache — kein Netz, keine zweite Quelle.
  qc.setQueryData(["reasoner", "status"], status);
  await act(async () => {
    root?.render(createElement(QueryClientProvider, { client: qc }, createElement(ExternStatus)));
  });
  return container.querySelector<HTMLElement>('[data-testid="extern-status"]');
}

async function abbauen(): Promise<void> {
  const alt = root;
  root = null;
  if (alt) {
    await act(async () => {
      alt.unmount();
    });
  }
  container?.remove();
  container = null;
}

afterEach(async () => {
  await abbauen();
  await i18n.changeLanguage("de");
});

const ERWARTET: Record<string, Record<string, string>> = {
  de: {
    blockiert: "Extern: Blockiert",
    frei: "Extern: Freigegeben",
    frei_vertraulich: "Extern: Freigegeben, auch Vertrauliches",
  },
  en: {
    blockiert: "External: Blocked",
    frei: "External: Allowed",
    frei_vertraulich: "External: Allowed, including confidential content",
  },
  nl: {
    blockiert: "Extern: Geblokkeerd",
    frei: "Extern: Vrijgegeven",
    frei_vertraulich: "Extern: Vrijgegeven, ook vertrouwelijke inhoud",
  },
};

describe("R-0606 · der externe Freigabestand in der Kopfzeile", () => {
  for (const sprache of ["de", "en", "nl"] as const) {
    for (const stand of ["blockiert", "frei", "frei_vertraulich"] as const) {
      it(`X1 · ${sprache}/${stand}: der Satz steht da und trägt den Stand`, async () => {
        await i18n.changeLanguage(sprache);
        const zeile = await montiere({ active: false, mode: "deterministic", extern: stand });
        expect(zeile?.textContent).toBe(ERWARTET[sprache]?.[stand]);
        expect(zeile?.dataset.extern).toBe(stand);
        expect(zeile?.title.length ?? 0).toBeGreaterThan(20);
      });
    }
  }

  it("X2 · ohne gültige Auskunft steht nichts da", async () => {
    // Gecacht vorliegende, aber ungültige oder unvollständige Auskünfte (alter Server, fremde Form).
    for (const status of [[], { active: true }, { extern: "offen" }, { extern: null }]) {
      expect(await montiere(status)).toBeNull();
      await abbauen();
    }
    expect(externStand(undefined)).toBeNull();
    expect(externStand({ extern: "blockiert" })).toBe("blockiert");
  });

  it("X3 · im Kopfband steht die Anzeige vor der Kopfbandzeile, nicht in ihr", () => {
    const quelle = readFileSync(join(WURZEL, "apps/web/src/shell/Kopfband.tsx"), "utf8");
    const anzeige = quelle.indexOf("<ExternStatus />");
    // Das gerenderte Kopfband-Element — nicht die Erwähnungen von `<header>` in den Kommentaren.
    const zeile = quelle.search(/<header\s+ref=\{bandRef\}/);
    expect(anzeige).toBeGreaterThan(0);
    expect(zeile).toBeGreaterThan(anzeige);
    expect(quelle.slice(zeile)).not.toContain("<ExternStatus");
  });
});
