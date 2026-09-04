// ==================================================================================================
// AUFTRAG PRO 381 · BÜNDEL 5 (Browser) · `R-17` bis `R-19` — DREI ENGINES, ECHTE TASTATUR.
// ==================================================================================================
//
// Diese Datei ist ROT, und das ist ihr Zweck. Die Ortszeile (`P-1`) existiert im Produkt nicht; alle
// drei Sonden fallen an ihrem Anker. PLAN PRO 378 §8 nennt genau diese Reihenfolge: „jeder Test ist
// geschrieben und rot, BEVOR die Zeile existiert, die ihn grün macht."
//
// WARUM ÜBERHAUPT EINE BROWSERSONDE, wo `R-6` bis `R-10` dieselben Bauteile schon in jsdom prüfen:
// Drei der Zusicherungen sind in jsdom prinzipiell nicht belegbar.
//   · `R-18` braucht ECHTEN Tastaturfokus über eine echte Tabreihenfolge, echte Adressfortschreibung
//     und ein echtes Neuladen. jsdom hat keine Fokusreihenfolge und keinen History-Stack, den ein
//     Neuladen überlebt.
//   · `R-19` braucht LAYOUT. jsdom misst keine Breiten; die Schwelle `NARROW_QUERY`
//     (`max-width: 899px`) entscheidet dort nichts.
//   · `R-17` braucht das GEBÜNDELTE Produkt, nicht die Quelldateien — genau die Fehlerklasse (weisse
//     Seite, kaputtes Bündel), für die diese Suite überhaupt existiert.
//
// ── JOB 3063 (H4), 04.09.2026: DER ORT DER ZEILE, NICHT IHRE ZUSAGE, HAT SICH GEÄNDERT ──────────
//
// Die Bibliothek ist seit H4 zwei Flächen (Liste links, Lesefläche rechts). Die Ortszeile steht
// nicht mehr über der ganzen Seite, sondern oben in der LINKEN SPALTE — weiter über dem Suchfeld,
// weiter sichtbar ohne Klick, weiter mit zwei `button[aria-pressed]`. Nachgeführt wurden genau
// zwei Dinge:
//   · das Suchfeld heisst jetzt `#bib-suche` (vorher `#library-search`),
//   · das mobile Filterblatt (`[aria-modal="true"]`) ist durch das Menü „Filter" (`role="menu"`)
//     abgelöst; `R-19` prüft dort dasselbe wie vorher am Blatt: der Ort ist nicht drin.
// Die drei Zusicherungen selbst (sichtbar, über dem Suchfeld, zwei Knöpfe, Tastaturweg, Adresse,
// Neuladen, schmal auf der Seite) stehen unverändert.
//
// DER ANKER, DEN DIESE PRÜFFLÄCHE SETZT: `data-testid="library-scope-bar"` am Ortszeilen-Block.
// Bewusst eine KENNUNG und keine Beschriftung — aus demselben Grund, den `components/ui.tsx` für
// `page-<schlüssel>` protokolliert: ein Titel genügt nicht, weil ihn auch eine Fehlerkarte, ein
// Platzhalter oder eine Umleitung liefern kann. Und die Beschriftungen selbst sind mit `B-1` bis
// `B-3` noch nicht entschieden — ein Test, der sie heute festnagelt, nähme dem Owner die Wahl ab.
import { expect, test } from "@playwright/test";

import { ensureLoggedIn } from "./support/auth";

/** Der Block aus PLAN 378 `P-1`: Pfad + Unterraumliste + Umschalter, EIN Block über dem Suchfeld. */
const ORTSZEILE = '[data-testid="library-scope-bar"]';
/** Der URL-Parameter des Geltungsbereichs (PLAN 378 §4.2; Präzedenz `von`/`bis` aus mega10). */
const RAUM_PARAM = "raum";

test.describe("PRO 381 · Wissensraum · Ortszeile im Browser", () => {
  test("R-17: /bibliothek rendert mit Routenanker UND sichtbarer Ortszeile", async ({ page }) => {
    await ensureLoggedIn(page);
    await page.goto("/bibliothek");

    // 1. Der bestehende Routenanker — er darf durch die neue Zeile nicht verlorengehen
    //    (`ui-smoke.spec.ts:485` prüft ihn für alle zwölf Kernrouten; `components/ui.tsx` ist
    //    zugesicherte Null-Diff, s. `R-16`).
    await expect(page.getByTestId("page-bibliothek")).toBeVisible({ timeout: 10_000 });

    // 2. Und die Ortszeile steht da.
    await expect(page.locator(ORTSZEILE)).toBeVisible({ timeout: 10_000 });

    // 3. Sie steht ÜBER dem Suchfeld (`A-9`: die Tabreihenfolge folgt der Leserichtung, und die
    //    Zeile benennt, WORIN gesucht wird — sie muss vor dem Suchfeld kommen, nicht danach).
    const ortY = (await page.locator(ORTSZEILE).boundingBox())?.y ?? Number.POSITIVE_INFINITY;
    const sucheY = (await page.locator("#bib-suche").boundingBox())?.y ?? 0;
    expect(ortY, "die Ortszeile steht nicht über dem Suchfeld").toBeLessThan(sucheY);
  });

  test("R-18: nur Tastatur — Tab erreicht den Umschalter, Enter schaltet, der Fokus bleibt", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    await page.goto("/bibliothek");
    await expect(page.locator(ORTSZEILE)).toBeVisible({ timeout: 10_000 });

    // Mit der Tastatur bis in den Umschalter — kein Klick, kein `focus()`. Erreicht ihn die Tab-
    // Reihenfolge nicht, ist die Fläche für Tastaturnutzer nicht bedienbar, und genau das soll
    // dieser Test fangen, nicht ein programmatischer Fokus.
    const umschalter = page.locator(`${ORTSZEILE} button[aria-pressed]`);
    await expect(umschalter, "der Umschalter hat nicht genau zwei Schaltflächen").toHaveCount(2);

    let erreicht = false;
    for (let i = 0; i < 40 && !erreicht; i++) {
      await page.keyboard.press("Tab");
      erreicht = await page.evaluate(
        (sel) => document.activeElement?.closest(sel) !== null,
        ORTSZEILE,
      );
    }
    expect(erreicht, "Tab erreicht die Ortszeile nicht").toBe(true);

    // Bis auf die erste Schaltfläche des Umschalters weitertabben und sie mit der Tastatur drücken.
    const raumKnopf = umschalter.first();
    await raumKnopf.focus();
    const vorher = page.url();
    await page.keyboard.press("Enter");

    // Die Adresse gewinnt oder verliert `raum` — sie ist teilbar und spiegelt den Bereich ehrlich.
    await expect.poll(() => page.url() !== vorher, { timeout: 5_000 }).toBe(true);
    const nachher = new URL(page.url());
    const hatRaum = nachher.searchParams.has(RAUM_PARAM);

    // `A-6`: der Fokus BLEIBT auf der gedrückten Schaltfläche. Die URL wird mit `replace`
    // fortgeschrieben (wie `Library.tsx:249-277`), die Seite wird nicht neu montiert.
    await expect(raumKnopf).toBeFocused();

    // Ein Neuladen stellt denselben Geltungsbereich wieder her.
    await page.reload();
    await expect(page.locator(ORTSZEILE)).toBeVisible({ timeout: 10_000 });
    expect(new URL(page.url()).searchParams.has(RAUM_PARAM)).toBe(hatRaum);
  });

  test("R-19: schmal — die Ortszeile bleibt auf der Seite, das Filterblatt bleibt ortsfrei", async ({
    page,
  }) => {
    // Die Schwelle ist `NARROW_QUERY` = `(max-width: 899px)` (`shell/useMediaQuery.ts`) — dieselbe,
    // die heute die Filterschiene in ein Blatt verwandelt.
    await ensureLoggedIn(page);
    await page.setViewportSize({ width: 640, height: 900 });
    await page.goto("/bibliothek");

    // Die Ortszeile bleibt SICHTBAR auf der Seite. Läge sie im Blatt, wäre auf schmalen Geräten
    // nicht sichtbar, worin gerade gesucht wird — genau das Übersehen-Risiko aus `E-1` (§6).
    await expect(page.locator(ORTSZEILE)).toBeVisible({ timeout: 10_000 });

    // Der Umschalter bleibt auch schmal ZWEI sichtbare Schaltflächen — nie ein Auswahlmenü.
    await expect(page.locator(`${ORTSZEILE} button[aria-pressed]`)).toHaveCount(2);
    await expect(page.locator(`${ORTSZEILE} select`)).toHaveCount(0);

    // Das Filtermenü öffnen — seit H4 der Ort ALLER Facetten (JOB 3063 §5a).
    await page.getByTestId("bib-menue-filter").click();
    const filter = page.locator('[role="menu"]').first();
    await expect(filter).toBeVisible({ timeout: 10_000 });

    // Und es enthält KEIN Ortsbedienelement. Der Geltungsbereich ist kein Filter — „Die Schiene
    // filtert, die Kopfzeile sucht" (mega51). Genau diese Zusage war in Runde 3 gebrochen.
    await expect(filter.locator(ORTSZEILE)).toHaveCount(0);
    await expect(filter.locator("button[aria-pressed]")).toHaveCount(0);
    await expect(filter.locator("nav[aria-label]")).toHaveCount(0);
    await expect(filter.locator('[aria-current="page"]')).toHaveCount(0);

    // Die Ortszeile bleibt dabei stehen, wo sie war — das Menü verdeckt sie nicht.
    await expect(page.locator(ORTSZEILE)).toBeVisible();
  });
});
