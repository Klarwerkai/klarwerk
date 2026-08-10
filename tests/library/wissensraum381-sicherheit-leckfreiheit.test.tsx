// @vitest-environment jsdom
// ==================================================================================================
// AUFTRAG PRO 381 · BÜNDEL 1 (Sicherheit) · `R-11` — DIE SCHÄRFSTE ZUSICHERUNG DES VERTRAGS.
// ==================================================================================================
//
// Rot-Reihenfolge aus PLAN PRO 378 §8: Sicherheit ZUERST. Wer mit den Bauteilen beginnt, hat eine
// sichtbare Ortszeile, bevor er eine getestete Leckfreiheit hat.
//
// DER FALL (PLAN 378 §5.2, ARCH-Entscheidung 7 = `V-2`):
//   `Z-2` — `HOME_UNASSIGNED`: das Wissensobjekt hat kein Zuhause.
//   `Z-3` — Zuhause vorhanden, aber für DIESEN Betrachter unsichtbar.
// Beide bekommen `home: null` auf der Leitung. Die Trefferzeile muss in BEIDEN Fällen ZEICHENGLEICH
// aussehen — nicht „ähnlich“, nicht „auch leer“, sondern Zeichen für Zeichen dasselbe Markup.
//
// Stünde bei `Z-2` sichtbar „Noch ohne Zuhause“ und bei `Z-3` nichts, wäre DAS FEHLEN DES TEXTES die
// Auskunft: *dieser Beitrag hat einen Ort, den du nicht sehen darfst.* Das ist schwächer als ein
// Name — aber eine Existenzspur, und REF-0001 `:49` verbietet Existenz- UND Metadatenspur.
//
// GEPRÜFT WIRD AM GERENDERTEN ERGEBNIS, NICHT AN DEN PROPS. Eine Zusicherung über die Eingabe wäre
// wertlos: dass zweimal `null` hineingeht, ist trivial. Die Frage ist, ob zweimal dasselbe
// herauskommt — auch dann, wenn ein zweiter Marker versehentlich am Objekt klebt.
import { beforeEach, describe, expect, it } from "vitest";

import { ladeOrtArtefakt, ortExport, sichtbareKette } from "./support/wissensraum-ort-vertrag";

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Rendert ein noch nicht existierendes Bauteil und gibt sein Markup zurück. Bewusst OHNE Router:
 * `A-7` sagt, die Heimatzeile ist kein Link — bräuchte sie einen Router, wäre sie einer.
 */
async function heimatzeileMarkup(props: Record<string, unknown>): Promise<string> {
  const modul = await ladeOrtArtefakt("homeLine");
  const Komp = ortExport(modul, "KoHomeLine", "homeLine");
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    // `as never`: das Bauteil existiert zur Typprüfzeit noch nicht; die Wirklichkeit prüft der Test.
    root.render(createElement(Komp as never, props));
  });
  const markup = container.innerHTML;
  act(() => {
    root.unmount();
  });
  container.remove();
  return markup;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

describe("PRO 381 · R-11 — `Z-2` und `Z-3` rendern zeichengleiches Markup", () => {
  it("R-11 (a): Ohne-Zuordnung und zurückgehaltenes Zuhause ergeben Zeichen für Zeichen dasselbe", async () => {
    // Was der Server in BEIDEN Lagen schickt: kein zweiter Marker (§5.2 Regel 1).
    //
    // GEPRÜFT WERDEN BEIDE SCHREIBWEISEN, und der Grund ist eine ausgewiesene Abweichung zwischen
    // den beiden Verträgen: PLAN PRO 378 §5.2 schreibt `home: null`, die Gegenseite BASIC 379 §6
    // beschliesst „`home` ist optional und FEHLT, sobald keine leckfreie Aussage möglich ist".
    // Welche Form die Umsetzungswelle wählt, ist eine Ownerfrage — leckfrei muss sie in BEIDEN
    // sein, und genau deshalb steht hier kein „entweder/oder", sondern beides.
    const alsNull = await heimatzeileMarkup({ home: null });
    const alsFehlend = await heimatzeileMarkup({});
    expect(await heimatzeileMarkup({ home: null })).toBe(alsNull);
    expect(await heimatzeileMarkup({})).toBe(alsFehlend);
    // Und die beiden Schreibweisen dürfen sich auch untereinander nicht unterscheiden — sonst wäre
    // die SCHREIBWEISE die Auskunft, und ein gemischt antwortender Server leckte über sie.
    expect(alsFehlend).toBe(alsNull);
  });

  it("R-11 (b): und beide rendern GAR NICHTS — kein Element, kein Platzhalter, kein Layout-Loch", async () => {
    // §5.2 Regel 4: „Wo nichts steht, steht nichts — auch kein Layout-Loch, das man abzählen könnte.“
    // Ein leerer <div> mit Höhe wäre bereits eine abzählbare Spur und deshalb ein Leck.
    expect(await heimatzeileMarkup({ home: null })).toBe("");
    expect(await heimatzeileMarkup({})).toBe("");
  });

  it("R-11 (c): ein durchgesickerter ZWEITER Marker ändert das Markup nicht", async () => {
    // Die Verschärfung, ohne die `R-11` (a) zahnlos wäre. §5.2 Regel 1 verlangt, dass der Client
    // gar nicht wissen KANN, welcher der beiden Fälle vorliegt. Sollte die Serverseite je ein
    // zusätzliches Feld mitschicken — versehentlich, aus Bequemlichkeit oder aus einer späteren
    // Welle —, darf die Oberfläche es NICHT zu einem sichtbaren Unterschied machen.
    const neutral = await heimatzeileMarkup({ home: null });
    const marker: Array<Record<string, unknown>> = [
      { home: null, homeWithheld: true },
      { home: null, homeState: "WITHHELD" },
      { home: null, homeDepth: 4 },
      { home: null, home_unassigned: false },
    ];
    for (const props of marker) {
      expect(await heimatzeileMarkup(props)).toBe(neutral);
    }
  });

  it("R-11 (d): Gegenprobe — ein SICHTBARES Zuhause rendert sehr wohl etwas", async () => {
    // Ohne diese Zeile wäre `R-11` von einem Bauteil erfüllbar, das nie irgendetwas rendert. Der
    // Test prüft damit die Ununterscheidbarkeit der stummen Fälle UND die Existenz des Falls `Z-1`.
    const kette = sichtbareKette(2);
    const z1 = await heimatzeileMarkup({ home: { chain: kette } });
    expect(z1).not.toBe("");
    expect(z1).toContain(kette[1]?.name ?? "");
    expect(z1).not.toBe(await heimatzeileMarkup({ home: null }));
  });
});
