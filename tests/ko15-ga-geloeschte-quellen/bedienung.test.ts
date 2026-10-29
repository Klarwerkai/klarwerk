// Tatsächliche gebaute Fläche, Sitzungskeks, UI-Aktionen und Readback; kein PG-/Neustartbeweis.
import { afterEach, describe, expect, it } from "vitest";
import {
  type Browser,
  type Kontext,
  fn,
  mitFlaeche,
  starteChromium,
  warte,
} from "../gast-nutzerweg/browserweg";
import { PASSWORT, mussGelingen } from "../gast-nutzerweg/strecke";
import { meldeAnMitTastatur } from "../gesamtanweisung-nutzerweg/weg";
import { profilFuer } from "../gesamtanweisung-tastaturweg/weg";
import { EMAIL, type Welt, welt } from "./pruefstand";

let browser: Browser | undefined;
let kontext: Kontext | undefined;
let w: Welt | undefined;
afterEach(async () => {
  await kontext?.close();
  await browser?.close();
  await w?.schliessen();
  kontext = undefined;
  browser = undefined;
  w = undefined;
});

describe("KO15/M12 · gelöschte Quellen im echten Browser bearbeiten", () => {
  for (const purge of [false, true])
    it(`${purge ? "Endlöschung" : "Papierkorb"}: Kopf speichern, sichtbare Abschnitte tauschen, Reload`, async () => {
      w = await welt(mitFlaeche().vorListen);
      const x = w;
      await x.entfernen(purge);
      browser = await starteChromium();
      const profil = await profilFuer(browser, "de");
      kontext = profil.kontext;
      const seite = profil.seite;
      await meldeAnMitTastatur(seite, x.basis, EMAIL, PASSWORT);
      await seite.goto(`${x.basis}/gesamtanweisungen/${x.kanonisch.id}`, {
        waitUntil: "domcontentloaded",
      });
      const bausteine = '[data-testid="ga-lesestand-baustein"]';
      await warte(
        seite,
        "(s) => document.querySelectorAll(s).length === 2",
        "zwei sichtbare Abschnitte",
        bausteine,
        10_000,
      );
      expect(
        await seite.evaluate<string[]>(
          fn("(s) => [...document.querySelectorAll(s)].map(e => e.dataset.baustein)"),
          bausteine,
        ),
      ).toEqual([x.kanonisch.bausteine[0]!.id, x.kanonisch.bausteine[2]!.id]);
      const titel = `GA weiter im Browser · ${purge ? "Purge" : "Trash"}`;
      await seite.fill("#ga-kopf-titel", titel);
      await seite.click('[data-testid="ga-kopf-speichern"]');
      await warte(
        seite,
        `() => !!document.querySelector('[data-testid="ga-kopf-gespeichert"]')`,
        "Speicherbestätigung",
        undefined,
        10_000,
      );
      await warte(
        seite,
        `(t) => document.querySelector('[data-testid="ga-seite-titel"]')?.textContent === t`,
        "gespeicherter Kopf aus Lesestand",
        titel,
        10_000,
      );
      // Der echte UI-Weg sendet nur die beiden sichtbaren IDs. Unsichtbare Slots bleiben serverseitig.
      const erster = `${bausteine}[data-baustein="${x.kanonisch.bausteine[0]!.id}"]`;
      await seite.click(`${erster} button[aria-label*="unten"]`);
      const sichtbarNeu = [x.kanonisch.bausteine[2]!.id, x.kanonisch.bausteine[0]!.id];
      await warte(
        seite,
        "(v) => JSON.stringify([...document.querySelectorAll(v.sel)].map(e => e.dataset.baustein)) === JSON.stringify(v.ids)",
        "neue Reihenfolge aus gespeichertem Bestand",
        { sel: bausteine, ids: sichtbarNeu },
        10_000,
      );
      await seite.reload({ waitUntil: "domcontentloaded" });
      await warte(
        seite,
        '(t) => document.querySelector("#ga-kopf-titel")?.value === t',
        "Kopf nach Reload",
        titel,
        10_000,
      );
      expect(
        await seite.evaluate<string[]>(
          fn("(s) => [...document.querySelectorAll(s)].map(e => e.dataset.baustein)"),
          bausteine,
        ),
      ).toEqual(sichtbarNeu);
      expect(
        await seite.evaluate<boolean>(
          fn(`() => !!document.querySelector('[data-testid="ga-lesestand-unvollstaendig"]')`),
        ),
      ).toBe(true);
      const body = await seite.evaluate<string>(fn("() => document.body.innerText"));
      x.ohneSpur(body);
      const readback = mussGelingen(
        "Browser-Readback",
        await x.admin.sende("GET", `/api/gesamtanweisungen/${x.kanonisch.id}`),
      );
      x.ohneSpur(readback.text);
      expect(readback.json).toMatchObject({
        titel,
        version: x.kanonisch.version + 2,
        unvollstaendig: true,
        verborgeneBausteine: 2,
      });
      const [a, b, c, d] = x.kanonisch.bausteine;
      expect((await x.bestand()).anweisung?.bausteine).toEqual([
        { ...c, position: 0 },
        b,
        { ...a, position: 2 },
        d,
      ]);
      process.stderr.write(
        `KO15 GA Bedienbeleg: ${purge ? "Purge" : "Trash"}, echte UI-Kopf-/Reihenfolgeänderung und Reload bestätigt\n`,
      );
    }, 60_000);
});
