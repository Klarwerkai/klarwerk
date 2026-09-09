// @vitest-environment jsdom
// C1/C2/C4: Der direkte Folgewechsel ist auf der vorgeschriebenen Arbeitsraum-Bühne blockiert.
// Die Pins belegen die Räumung und den fehlenden Bedienweg, keinen gelungenen Folgewechsel.
// C3: Ein Klick auf disabled bricht nicht ab; die verspätete Quittung wird ausdrücklich gemessen.
// Bei Behebung muss der jeweilige Sollpfad durchlaufen und it.fails auf it umgestellt werden.
import { describe, expect, it } from "vitest";
import { CAPTURE_FILE_TEXT as T } from "../../apps/web/src/lib/captureFromFile";
import {
  buttonByText,
  click,
  container,
  dateiEinlesen,
  dateiEinlesenBeenden,
  dateiEinlesenStarten,
  fehlerpin,
  modusKarte,
  mount,
  pageText,
  sichtbar,
  txt,
} from "./datei-buehne";

const PARAMS = { name: "NUTZERPRUEFUNG.txt", chars: 240 };
const KEINE_KARTEN =
  "BEFUND C1/C2/C4: Abbrechen entfernt beide Importart-Karten; capture-workspace ist aria-hidden=true. Moduswechsel danach nicht bedienbar.";
const ABBRUCH_GESPERRT =
  "BEFUND C3: Abbrechen ist beim Einlesen disabled; der Klick bricht nicht ab, nach Moduswechsel und Lösen der Bremse erscheint loadedStatsWhole für NUTZERPRUEFUNG.txt (240 Zeichen).";

function keineQuittung(): void {
  for (const key of [T.loadedStats, T.loadedStatsWhole]) {
    expect(pageText(), `Keine alte Quittung: ${key}`).not.toContain(txt(key, PARAMS));
  }
}
function anleitung(whole: boolean): void {
  expect(sichtbar()).toContain(txt(whole ? T.hintWhole : T.hint));
  expect(pageText()).not.toContain(txt(whole ? T.hint : T.hintWhole));
  expect(
    modusKarte(whole ? T.importModeWhole : T.importModePoints).getAttribute("aria-pressed"),
  ).toBe("true");
}
async function wechselNachAbbruch(whole: boolean): Promise<void> {
  const karten = container.querySelectorAll("button[aria-pressed]");
  if (karten.length === 0) {
    // Nur dieser vollständig gemessene Befund darf it.fails erfüllen. Mount-/Klick-/Textfehler
    // landen über fehlerpin in der außerhalb von it.fails geprüften Nebenfehlerliste.
    expect(container.querySelector("#capture-workspace")?.getAttribute("aria-hidden")).toBe("true");
    expect(pageText()).not.toContain(txt(T.hint));
    expect(pageText()).not.toContain(txt(T.hintWhole));
    throw new Error(KEINE_KARTEN);
  }
  await click(modusKarte(whole ? T.importModeWhole : T.importModePoints));
  anleitung(whole);
  keineQuittung();
}
async function fertigAbbrechen(whole: boolean): Promise<void> {
  await mount();
  if (whole) await click(modusKarte(T.importModeWhole));
  await dateiEinlesen();
  expect(sichtbar()).toContain(txt(whole ? T.loadedStatsWhole : T.loadedStats, PARAMS));
  await click(buttonByText(txt(T.cancel)));
  keineQuittung();
}

describe("JOB 3379 · Abbruch dann Moduswechsel, DE", () => {
  it.fails("C1 · Punkte → einlesen → Abbrechen → Ganzes", async () => {
    await fehlerpin(KEINE_KARTEN, async () => {
      await fertigAbbrechen(false);
      await wechselNachAbbruch(true);
      return false;
    });
  });
  it.fails("C2 · Ganzes → einlesen → Abbrechen → Punkte", async () => {
    await fehlerpin(KEINE_KARTEN, async () => {
      await fertigAbbrechen(true);
      await wechselNachAbbruch(false);
      return false;
    });
  });
  it.fails("C3 · laufendes Einlesen → Abbruchklick → Ganzes → verspätetes Ende", async () => {
    await fehlerpin(ABBRUCH_GESPERRT, async () => {
      await mount();
      await dateiEinlesenStarten();
      expect(sichtbar()).toContain(txt(T.extracting, PARAMS));
      keineQuittung();
      const cancel = buttonByText(txt(T.cancel));
      const gesperrt = cancel.disabled;
      await click(cancel);
      if (gesperrt) {
        // Kein Entfernen des disabled-Attributs: der wirklich unmögliche Abbruch wird gemessen.
        expect(sichtbar()).toContain(txt(T.extracting, PARAMS));
        await click(modusKarte(T.importModeWhole));
        anleitung(true);
        keineQuittung();
        await dateiEinlesenBeenden();
        expect(sichtbar()).toContain(txt(T.loadedStatsWhole, PARAMS));
        expect(pageText()).not.toContain(txt(T.loadedStats, PARAMS));
        return true;
      }
      keineQuittung();
      await wechselNachAbbruch(true);
      await dateiEinlesenBeenden();
      anleitung(true);
      keineQuittung();
      return false;
    });
  });
  it.fails("C4 · nach Abbruch Punkte → Ganzes → Punkte; jeder Zwischenstand", async () => {
    await fehlerpin(KEINE_KARTEN, async () => {
      await fertigAbbrechen(false);
      await wechselNachAbbruch(true);
      await wechselNachAbbruch(false);
      return false;
    });
  });
});
