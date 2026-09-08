// @vitest-environment jsdom
// ================================================================================================
// JOB 3235 · UX-18-R2 — DER WOERTERBUCH-FALL REICHT NICHT. WAS STEHT WIRKLICH AUF DER FLAECHE?
// ================================================================================================
//
// `namen-sind-unterscheidbar.test.ts` misst die Woerterbuecher. Das ist die halbe Zusage: es sagt
// nichts darueber, was ein Mensch auf `/import` untereinander LIEST. Dieser Fall mountet deshalb
// die echte Galerie (`ImportSourceGallery`) und liest die sichtbaren Kachelnamen aus dem Baum —
// in DE und in EN.
//
// WARUM DIE AUFKLAPPER GEKLICKT WERDEN: Seit JOB 3235 tragen `word-sys` und `pdf-sys` den Zustand
// `planned` (gemessen: es gibt keine begonnene Word-/PDF-Quellenanbindung, Kopfkommentar bei
// SYSTEM_SOURCES). Geplante Kacheln liegen hinter der Zeile „In Planung (n)"
// (`FileTypePicker.tsx:319-337`), Vorgabe zugeklappt. Dass sie DORT stehen, ist Teil der Aussage
// dieses Falls — und ein zugeklappter Aufklapper duerfte den Namensvergleich nicht dadurch
// bestehen, dass eine der beiden Kacheln gar nicht gerendert ist. Deshalb wird zuerst geprueft,
// dass die Systemkachel eingeklappt IST, dann aufgeklappt und dann verglichen.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { ImportSourceGallery } from "../../apps/web/src/components/ImportSourceGallery";
import i18n from "../../apps/web/src/i18n";
import { FILE_SOURCES, SYSTEM_SOURCES } from "../../apps/web/src/lib/importSourceGallery";
import { kernDesNamens } from "./kern";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

// Die Paare, um die es geht: dasselbe Format, einmal als System, einmal als Datei.
const PAARE: readonly {
  readonly format: string;
  readonly system: string;
  readonly datei: string;
}[] = [
  { format: "Word", system: "word-sys", datei: "docx" },
  { format: "PDF", system: "pdf-sys", datei: "pdf" },
];

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(createElement(ImportSourceGallery, { onActivate: () => {} }));
  });
}

/** Der SICHTBARE Name einer Kachel im gemounteten Baum; null, wenn die Kachel nicht gerendert ist. */
function nameAusDemBaum(id: string): string | null {
  const kachel = container.querySelector(`[data-id="${id}"]`);
  const name = kachel?.querySelector("[data-tile-name]");
  return name ? (name.textContent ?? "").trim() : null;
}

async function alleAufklappen(): Promise<void> {
  const knoepfe = Array.from(
    container.querySelectorAll<HTMLElement>('[data-testid="planned-disclosure"]'),
  );
  // Beide Gruppen haben einen — sonst misst der Fall an der Flaeche vorbei.
  expect(knoepfe.length, "Aufklappzeilen der zwei Gruppen").toBe(2);
  for (const knopf of knoepfe) {
    await act(async () => {
      knopf.click();
    });
  }
}

beforeEach(() => {
  globalThis.localStorage?.clear();
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  await i18n.changeLanguage("de");
});

describe("JOB 3235 · die zwei Gruppen der Galerie tragen fuer dasselbe Format zwei Namen", () => {
  for (const sprache of ["de", "en"] as const) {
    it(`${sprache.toUpperCase()}: Systemname und Dateiname sind sichtbar verschieden`, async () => {
      await i18n.changeLanguage(sprache);
      await mount();
      await alleAufklappen();

      for (const paar of PAARE) {
        const systemName = nameAusDemBaum(paar.system);
        const dateiName = nameAusDemBaum(paar.datei);
        expect(systemName, `${sprache}: Systemkachel ${paar.system} fehlt im Baum`).toBeTruthy();
        expect(dateiName, `${sprache}: Dateikachel ${paar.datei} fehlt im Baum`).toBeTruthy();
        // Kein roher i18n-Schluessel auf der Flaeche.
        expect(systemName, `${sprache}: ${paar.system}`).not.toContain("imp.gallery.");
        expect(dateiName, `${sprache}: ${paar.datei}`).not.toContain("imp.gallery.");
        expect(
          systemName,
          `${sprache}/${paar.format}: beide Gruppen zeigen denselben Text "${systemName}"`,
        ).not.toBe(dateiName);
        // Und der Unterschied ist ein echter, kein Klammerzusatz (dieselbe Regel wie im
        // Woerterbuch-Fall — hier am gerenderten Text gemessen).
        expect(
          kernDesNamens(systemName ?? ""),
          `${sprache}/${paar.format}: "${systemName}" und "${dateiName}" meinen dasselbe Ding`,
        ).not.toBe(kernDesNamens(dateiName ?? ""));
      }
    });
  }

  it("DE: die zwei Systemkacheln liegen wirklich hinter der Zeile In Planung (Zustand `planned`)", async () => {
    await i18n.changeLanguage("de");
    await mount();
    // Zugeklappt: die Systemkacheln sind NICHT im Baum — genau das macht den Aufklapp-Schritt oben
    // noetig und belegt zugleich den geaenderten Zustand an der Flaeche.
    for (const paar of PAARE) {
      expect(
        nameAusDemBaum(paar.system),
        `${paar.system} steht ohne Aufklappen sichtbar`,
      ).toBeNull();
      // Die Dateikachel dagegen steht unveraendert offen da (Zustand `elsewhere`).
      expect(nameAusDemBaum(paar.datei), `${paar.datei} fehlt sichtbar`).toBeTruthy();
    }
    await alleAufklappen();
    for (const paar of PAARE) {
      expect(nameAusDemBaum(paar.system), `${paar.system} fehlt nach dem Aufklappen`).toBeTruthy();
    }
  });

  it("die Aufklappzeile der Systemgruppe nennt die Zahl, die das Modell fuehrt", async () => {
    await i18n.changeLanguage("de");
    await mount();
    const systemGeplant = SYSTEM_SOURCES.filter((s) => s.state === "planned").length;
    const dateiGeplant = FILE_SOURCES.filter((s) => s.state === "planned").length;
    const zeilen = Array.from(
      container.querySelectorAll<HTMLElement>('[data-testid="planned-disclosure"]'),
    ).map((el) => (el.textContent ?? "").trim());
    expect(zeilen[0], "Systemgruppe").toBe(`In Planung (${systemGeplant})`);
    expect(zeilen[1], "Dateigruppe").toBe(`In Planung (${dateiGeplant})`);
    // Der gemessene Zuwachs von JOB 3235: Word und PDF sind dazugekommen (vorher 10).
    expect(systemGeplant).toBe(12);
  });
});
