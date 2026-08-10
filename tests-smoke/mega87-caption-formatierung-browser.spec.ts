// AUFTRAG-mega87 Block A — FETT UND KURSIV IM ECHTEN BROWSER.
//
// WARUM ES DIESE SONDE ÜBERHAUPT BRAUCHT, und das ist der Kern des Ship-Blockers: die drei Teile
// des Befundes sind GENAU die drei, die jsdom nicht zeigen kann.
//
//   · jsdom kennt `document.execCommand` nicht (nachgemessen: `typeof … === "undefined"`). Die
//     gemounteten Tests fahren deshalb ausschließlich den Range-Rückfall. Ob der native Weg trägt,
//     ob er auf der richtigen Auswahl arbeitet und ob die Wirkungsmessung ihn korrekt als „hat
//     gewirkt" erkennt, sagt dort niemand. Hier läuft der echte Befehl von Chromium.
//   · jsdom verschiebt beim `mousedown` den Fokus NICHT von selbst; der gemountete Test muss das
//     nachstellen. Hier tut es der Browser — mit echtem Mausdruck auf echte Pixel.
//   · Die Auswahl ist eine echte Browser-Selection, keine per `addRange` gesetzte Attrappe.
//
// Der gemountete Test (`tests/capture/mega87-auswahl-ueberlebt-klick-mounted.test.tsx`) bleibt
// trotzdem stehen und ist nicht überflüssig: er fährt den AUSFALL-Fall („Befehl meldet Erfolg und
// tut nichts"), den ein funktionierender Browser gerade nicht herstellt. Die beiden Dateien belegen
// verschiedene Hälften derselben Zusage.
//
// WAS DIESE SONDE BELEGT UND WAS NICHT — nachgemessen, nicht angenommen:
//   · SIE BELEGT: der Klickpfad trägt in Chromium, Firefox und WebKit, mit echter Selection und
//     echtem `document.execCommand`. Das war vor mega87 in KEINEM Browser belegt.
//   · SIE BELEGT NICHT den Fokus-Teil des Blockers. Gegenprobe gefahren: mit zurückgebautem
//     `onMouseDown`/Gedächtnis/Wiederherstellung sind alle drei Fälle in allen drei Engines
//     ebenfalls grün. Die Ursache steht in `_relay/messung/mega87-browser-messung.spec.ts`: keine
//     der drei Engines kollabiert die Auswahl beim Fokuswechsel auf die Schaltfläche
//     (`collapsed === false`, Text unverändert) — anders als jsdom. Ein Browser, in dem der
//     beschriebene Fokus-Ausfall eintritt, ist hier nicht auffindbar.
//   · Der Fall „Befehl meldet Erfolg und tut nichts" lässt sich hier nicht herstellen, ohne
//     `execCommand` zu ersetzen — dann wäre es kein Browserbeleg mehr. Er bleibt beim jsdom-Test.
//
// HERMETISCH: kein Modell, kein Schlüssel, kein Netz, kein Egress. Das Bild ist ein eingebettetes
// 1×1-PNG als `data:`-URL, es wird nichts hochgeladen und nichts gespeichert. Der KI-Knopf im
// Formular ist ohne Modell deaktiviert — er berührt den Fett-/Kursiv-Weg nicht.
//
// WIE DIE BÜHNE ENTSTEHT, und warum GENAU SO: das Bildbeschreibungs-Formular hängt an einer
// `<figcaption>` innerhalb einer `<figure>`. Ein über „Bild vom Rechner …" eingefügtes Bild bekommt
// im Editor NUR ein nacktes `<img>` (`apps/web/src/lib/richText.ts:450-454`) — es gibt heute keinen
// Bedienweg, der ein frisch eingefügtes Bild mit einer Fußnote ausstattet. (Das ist ein eigener
// Befund; er steht im Bericht zu mega87 und wird hier belegt, nicht behoben.)
//
// Diese Sonde nimmt deshalb den EINFÜGE-Weg: ein Ausschnitt mit Bild und Bildunterschrift aus der
// Zwischenablage. Das ist kein Kunstgriff, sondern der reale Weg, auf dem Bild-Fußnoten heute in
// den Editor kommen (Word-/Web-Ausschnitte; der Sanitizer erlaubt `figure`/`figcaption`/`img` und
// `data:image/png`, `richText.ts:91-98`). Das Bild ist ein winziges eingebettetes PNG — keine
// Datei, kein Objekt-Store, kein Netz.
//
// AUSDRÜCKLICH VERWORFEN: das Beispielpaket „bilder" über `/api/admin/examples/load` zu laden. Es
// liefert echte figures und war der erste Entwurf dieser Sonde — aber der Smoke-Server hat EINEN
// Datenbestand für die ganze Suite (`support/auth.ts`), und die geladenen KOs landen auf dem
// Prüf-Board. Damit wurde `ui-smoke.spec.ts` „mega49: die Datenlage dieses Laufs ist die zugesagte"
// rot: der hermetische Lauf ohne Seed MUSS dort leer sein. Gemessen, nicht vermutet. Diese
// Kalibrierung ist wertvoll, WEIL sie so empfindlich ist — eine Sonde, die sich an ihr vorbeibaut,
// indem sie sie aufweicht, hätte den Lauf ärmer gemacht. Der Einfüge-Weg speichert nichts und
// lässt die Datenlage völlig unberührt.
//
// Aufruf: npm run smoke:ui:gate (Chromium, hermetisch) oder npm run smoke:ui (drei Engines).
import { type Page, expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

test.describe.configure({ mode: "serial" });

// DIE EINE ENGINE, DIE NICHT MITKANN — und zwar aus einem Grund in der VORRICHTUNG, nicht im
// Produkt. Nachgemessen in allen drei Engines mit einem synthetischen `ClipboardEvent`:
//
//   chromium: clipboardData vorhanden=true  inhalt="<figure><img …><figcaption>Test</figcaption>…"
//   firefox : clipboardData vorhanden=true  inhalt=""
//   webkit  : clipboardData vorhanden=true  inhalt="<figure><img …><figcaption>Test</figcaption>…"
//
// Firefox reicht ein `DataTransfer` aus einem selbstgebauten ClipboardEvent nicht durch: das Objekt
// ist da, sein Inhalt ist leer. Es kommt also gar kein Ausschnitt im Editor an — die Sonde scheitert
// vor ihrer ersten Zusicherung, an der Bühne. Über das Produkt sagt das nichts; Firefox' echter
// Einfügeweg ist davon nicht berührt.
//
// AUSDRÜCKLICH NICHT GETAN: die Bühne für Firefox über `page.evaluate`-DOM-Manipulation
// hineinschreiben. Dann prüfte die Sonde einen Zustand, den kein Nutzer herstellen kann — und der
// Wert eines Browserbelegs liegt gerade darin, dass er das nicht tut. Lieber eine benannte Lücke
// als ein Beleg, der keiner ist. Der Fett-/Kursiv-Weg selbst ist in Firefox durch die Messung in
// `_relay/messung/mega87-browser-messung.spec.ts` abgedeckt (dort trug die Bühne noch über das
// Beispielpaket): auch Firefox kollabiert die Auswahl beim Fokuswechsel nicht.
test.skip(
  ({ browserName }) => browserName === "firefox",
  "Firefox reicht clipboardData aus einem synthetischen ClipboardEvent leer durch (gemessen) — die Bühne entsteht dort nicht.",
);

const FELD = "#caption-form-text";
// Der eingefügte Ausschnitt. Der Text der Fußnote ist absichtlich mehrwortig — so lässt sich prüfen,
// dass GENAU das Markierte ausgezeichnet wird und nicht das ganze Feld.
const BILDUNTERSCHRIFT = "Riefen in Laufrichtung bei Schmiermangel";
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/**
 * Die Bühne: ein Editor, in dem ein Bild MIT Fußnote steht — eingefügt aus der Zwischenablage.
 *
 * Es wird nichts gespeichert und nichts angelegt; die Datenlage des Smoke-Servers bleibt unberührt
 * (siehe Kopf). Das ist die Herrichtung, nicht der Prüfling: geprüft wird ausschließlich, was der
 * Nutzer danach im Formular tut.
 */
async function buehneMitBild(page: Page): Promise<void> {
  await page.goto("/capture/frontdoor");
  const body = page.getByRole("textbox", { name: "Wissensseite — Fließtext" }).first();
  await expect(body).toBeVisible({ timeout: 15_000 });
  await body.click();

  await page.evaluate(
    ({ html, sel }) => {
      const el = document.querySelector(sel.body) as HTMLElement;
      el.focus();
      const dt = new DataTransfer();
      dt.setData("text/html", html);
      el.dispatchEvent(
        new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: dt }),
      );
    },
    {
      html: `<figure><img src="${TINY_PNG}" alt="Führungsschiene"><figcaption>${BILDUNTERSCHRIFT}</figcaption></figure>`,
      sel: { body: '[contenteditable="true"]' },
    },
  );

  // Die Fußnote muss als Bedienelement verankert sein (mega84) — sonst gäbe es den Weg gar nicht.
  const fussnote = page.locator("figcaption[data-kw-caption-open]").first();
  await expect(
    fussnote,
    "Der eingefügte Ausschnitt hat keine verankerte Bild-Fußnote ergeben",
  ).toBeVisible({ timeout: 10_000 });
}

/** Das Formular öffnen — über den Weg, den mega84 gebaut hat: Klick auf die Fußnote. */
async function formularOeffnen(page: Page): Promise<void> {
  await page.locator("figcaption[data-kw-caption-open]").first().click();
  await expect(page.locator(FELD)).toBeVisible({ timeout: 10_000 });
}

/** Was im Feld steht — mit Auszeichnung. */
function feldHtml(page: Page): Promise<string> {
  return page.locator(FELD).evaluate((el) => el.innerHTML);
}

test("mega87: im echten Browser überlebt die MAUS-Auswahl den Klick auf Fett", async ({ page }) => {
  await ensureLoggedIn(page);
  await buehneMitBild(page);
  await formularOeffnen(page);

  const feld = page.locator(FELD);
  // Alles im Feld auswählen — mit einem echten Dreifachklick, nicht per addRange.
  await feld.click({ clickCount: 3 });
  const markiert = await page.evaluate(() => window.getSelection()?.toString() ?? "");
  expect(markiert.length, "Vorbedingung: der Dreifachklick hat nichts markiert").toBeGreaterThan(0);

  // Der echte Klick: Chromium drückt die Maus, verschiebt den Fokus (wenn es darf) und löst aus.
  await page.locator('[data-testid="caption-form-bold"]').click();

  expect(
    await feldHtml(page),
    "Im echten Browser hat der Fett-Knopf die Auswahl nicht ausgezeichnet — genau der Ship-Blocker.",
  ).toMatch(/<(strong|b)\b/i);
  await expect(
    page.locator('[data-testid="caption-form-format-hint"]'),
    "Der Hinweis zum Markieren steht da, obwohl etwas markiert war",
  ).toHaveCount(0);
  // Der Fokus bleibt beim Nutzer, nicht auf dem Werkzeug.
  expect(
    await page.evaluate(() => document.activeElement?.id ?? null),
    "der Fokus ist auf der Schaltfläche hängengeblieben",
  ).toBe("caption-form-text");
});

test("mega87: im echten Browser trägt auch der reine TASTATURweg (markieren, Fokus, Leertaste)", async ({
  page,
}) => {
  await ensureLoggedIn(page);
  await buehneMitBild(page);
  await formularOeffnen(page);

  const feld = page.locator(FELD);
  // Rein über die Tastatur: fokussieren (kein Mausklick), dann markieren. `Pos1/Ende` ist dafür
  // untauglich — unter macOS bewegen sie in Chromium den Cursor nicht zeilenweise, gemessen:
  // `Shift+Home` markierte 0 Zeichen. `ControlOrMeta+A` ist die plattformneutrale Entsprechung und
  // eine echte Tastenkombination, kein `addRange`.
  await feld.focus();
  await page.keyboard.press("ControlOrMeta+A");
  const markiert = await page.evaluate(() => window.getSelection()?.toString() ?? "");
  expect(markiert.length, "Vorbedingung: die Tastenauswahl hat nichts markiert").toBeGreaterThan(0);

  // Und ausgelöst wird ebenfalls mit der Tastatur: Fokus auf den Knopf, Leertaste.
  await page.locator('[data-testid="caption-form-italic"]').focus();
  await page.keyboard.press(" ");

  expect(
    await feldHtml(page),
    "Über die Tastatur kam die Auswahl im echten Browser nicht an — der Tastaturweg wäre zweite Klasse.",
  ).toMatch(/<(em|i)\b/i);
  await expect(page.locator('[data-testid="caption-form-format-hint"]')).toHaveCount(0);
});

test("mega87: ohne Markierung sagt der echte Browser den Grund, statt stumm zu bleiben", async ({
  page,
}) => {
  await ensureLoggedIn(page);
  await buehneMitBild(page);
  await formularOeffnen(page);

  const feld = page.locator(FELD);
  await feld.click();
  // Einfacher Klick setzt nur einen Cursor — es ist nichts markiert.
  await page.keyboard.press("End");
  const vorher = await feldHtml(page);

  await page.locator('[data-testid="caption-form-bold"]').click();

  expect(await feldHtml(page), "es wurde etwas ausgezeichnet, obwohl nichts markiert war").toBe(
    vorher,
  );
  await expect(
    page.locator('[data-testid="caption-form-format-hint"]'),
    "Der Knopf hat nichts bewirkt UND nichts gesagt — der Ausfall, den man nicht sieht.",
  ).toBeVisible();
});
